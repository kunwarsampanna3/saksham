// Runs the production build in a throwaway folder with invented users. It never reads or writes the real .data.
import { spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** TEST_APP_DIR points the same tests at another checkout's build, e.g. to see them fail on old code. */
const APP = path.resolve(process.env.TEST_APP_DIR ?? fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.TEST_PORT ?? 3197);
export const BASE = `http://localhost:${PORT}`;
export const PIN = "7391";
export const requireFromApp = createRequire(path.join(APP, "package.json"));
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const bcrypt = requireFromApp("bcryptjs");
const PIN_HASH = bcrypt.hashSync(PIN, 12);
const SECRET = randomBytes(48).toString("hex");
const iso = (ms = Date.now()) => new Date(ms).toISOString();
let fakeIp = 0;

function seed() {
  const users = [];
  const verifications = [];
  const people = [
    ["client", ["client"]],
    ["pro", ["provider"]],
    ["pro2", ["provider"]],
    ["admin", ["client"]],
  ];
  people.forEach(([key, roles], i) => {
    const id = randomUUID();
    users.push({
      id,
      phone: `981000000${i}`,
      name: `Test ${key}`,
      city: "Kathmandu",
      roles,
      activeRole: roles[0],
      mpinHash: PIN_HASH,
      failedAttempts: 0,
      lockedUntil: null,
      lang: "en",
      isDemo: false,
      isAdmin: key === "admin",
      passkeys: [],
      categories: ["plumbing"],
      verified: true,
      createdAt: iso(),
      updatedAt: iso(),
    });
    for (const kind of ["id", "selfie"]) {
      verifications.push({
        id: randomUUID(),
        userId: id,
        kind,
        status: "verified",
        simulated: false,
        files: [],
        fields: {},
        submittedAt: iso(Date.now() - 60_000),
        decidedAt: iso(Date.now() - 60_000),
      });
    }
  });
  return { users, otps: [], verifications };
}

export class App {
  /**
   * @param t the test, which cleans up after itself
   * @param opts `demo` sets DEMO_MODE, `prepare` runs before the first start, `env` adds variables
   */
  static async create(t, { demo = false, prepare, env = {} } = {}) {
    if (!fs.existsSync(path.join(APP, ".next", "BUILD_ID")))
      throw new Error("No production build. Run `npm run build` first.");
    const app = new App();
    app.dir = fs.mkdtempSync(path.join(os.tmpdir(), "saksham-test-"));
    app.env = { DEMO_MODE: String(demo), TRUSTED_IP_HEADER: "", ...env };
    t.after(() => app.destroy());

    const cache = path.join(APP, ".next", "cache");
    fs.cpSync(path.join(APP, ".next"), path.join(app.dir, ".next"), {
      recursive: true,
      filter: (src) => !src.startsWith(cache),
    });
    for (const name of ["public", "package.json", "next.config.ts"])
      fs.cpSync(path.join(APP, name), path.join(app.dir, name), { recursive: true });
    fs.symlinkSync(path.join(APP, "node_modules"), path.join(app.dir, "node_modules"), "junction");

    fs.mkdirSync(path.join(app.dir, ".data"));
    app.dbFile = path.join(app.dir, ".data", "db.json");
    const db = seed();
    app.users = Object.fromEntries(db.users.map((u) => [u.name.slice(5), u]));
    await prepare?.(app, db);
    fs.writeFileSync(app.dbFile, JSON.stringify(db));
    await app.start();
    return app;
  }

  async start() {
    const next = path.join(APP, "node_modules", "next", "dist", "bin", "next");
    this.log = "";
    this.server = spawn(process.execPath, [next, "start", "-p", String(PORT), "-H", "127.0.0.1"], {
      cwd: this.dir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        SESSION_SECRET: SECRET,
        APP_ORIGIN: BASE,
        SITE_PASSWORD: "",
        RENDER: "",
        OWNER_PHONES: "",
        ANTHROPIC_API_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        RESEND_API_KEY: "",
        SMTP_HOST: "",
        ...this.env,
      },
    });
    this.server.stdout.on("data", (d) => (this.log += d));
    this.server.stderr.on("data", (d) => (this.log += d));
    for (let i = 0; i < 120; i++) {
      if (this.server.exitCode !== null) throw new Error(`The test server stopped:\n${this.log}`);
      try {
        await fetch(`${BASE}/terms`);
        return;
      } catch {
        await sleep(250);
      }
    }
    throw new Error(`The test server didn't start:\n${this.log}`);
  }

  async stop() {
    if (!this.server || this.server.exitCode !== null) return;
    const exited = new Promise((resolve) => this.server.once("exit", resolve));
    this.server.kill();
    await exited;
  }

  async destroy() {
    await this.stop();
    // Remove the link first, so deleting the folder can never follow it into the real node_modules.
    const link = path.join(this.dir, "node_modules");
    if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    if (!fs.existsSync(link))
      fs.rmSync(this.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  /** Every request claims a new IP, as an attacker would. */
  async call(url, body, cookie = "", headers = {}) {
    const form = body instanceof FormData;
    fakeIp++;
    const res = await fetch(BASE + url, {
      method: body ? "POST" : "GET",
      redirect: "manual",
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      headers: {
        origin: BASE,
        cookie,
        "x-forwarded-for": `10.${(fakeIp >> 16) & 255}.${(fakeIp >> 8) & 255}.${fakeIp & 255}`,
        ...(body && !form ? { "content-type": "application/json" } : {}),
        ...headers,
      },
    });
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      // a page, not JSON
    }
    const cookies = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .filter((c) => !c.endsWith("="))
      .join("; ");
    return { status: res.status, json, text, cookie: cookies, location: res.headers.get("location") };
  }

  async login(key, mpin = PIN) {
    const r = await this.call("/api/auth/login", { phone: this.users[key].phone, mpin });
    if (r.status !== 200) throw new Error(`login ${key}: ${r.status} ${r.text.slice(0, 200)}\n${this.log}`);
    return r.cookie;
  }

  async everyone() {
    this.client = await this.login("client");
    this.pro = await this.login("pro");
    this.admin = await this.login("admin");
  }

  db() {
    return JSON.parse(fs.readFileSync(this.dbFile, "utf8"));
  }

  async task(budget = null, who = this.client) {
    const r = await this.call(
      "/api/tasks",
      {
        category: "plumbing",
        title: "Fix kitchen tap",
        details: "",
        quantity: 1,
        days: 2,
        city: "Kathmandu",
        online: false,
        womenOnly: false,
        budget,
        flexible: true,
        aiSource: "manual",
      },
      who,
    );
    if (r.status !== 200) throw new Error(`task: ${r.status} ${r.text.slice(0, 200)}`);
    return r.json.id;
  }

  offer(task, amount = 5000, message = "I can do it", who = this.pro) {
    return this.call(`/api/tasks/${task}/bids`, { amount, days: 2, message }, who);
  }

  act(task, bid, body, who = this.client) {
    return this.call(`/api/tasks/${task}/bids/${bid}`, body, who);
  }

  async booking(plan = "milestones", amount = 5000) {
    const task = await this.task();
    const bid = (await this.offer(task, amount)).json.id;
    await this.act(task, bid, { action: "accept", amount });
    const r = await this.call("/api/bookings", { taskId: task, plan, method: "esewa_sandbox" }, this.client);
    if (r.status !== 200) throw new Error(`booking: ${r.status} ${r.text.slice(0, 200)}`);
    const { installments } = this.db().bookings.find((b) => b.id === r.json.id);
    return { id: r.json.id, task, installments };
  }

  /** A session cookie in the format used before sessions had ids. */
  legacyCookie(key) {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      role: "client",
      mpinAt: now,
      sub: this.users[key].id,
      iat: now,
      iss: "saksham",
      exp: now + 3600,
    };
    const body = `${enc({ alg: "HS256" })}.${enc(claims)}`;
    const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
    return `sk_session=${body}.${signature}`;
  }
}
