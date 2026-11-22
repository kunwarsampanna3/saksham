// One test for each bug found in the November 2026 review, then checks that normal use still works.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { App, BASE, PIN, requireFromApp, sleep } from "./harness.mjs";

const times = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

async function signedIn(t, opts) {
  const app = await App.create(t, opts);
  await app.everyone();
  return app;
}

async function image(width = 700, height = 500) {
  const sharp = requireFromApp("sharp");
  return sharp({ create: { width, height, channels: 3, background: "#88aacc" } })
    .png()
    .toBuffer();
}

/** Noise in a big progressive JPEG: small enough to upload, slow to process. */
async function slowImage() {
  const sharp = requireFromApp("sharp");
  const side = 4000;
  return sharp(randomBytes(side * side * 3), { raw: { width: side, height: side, channels: 3 } })
    .jpeg({ quality: 12, progressive: true })
    .toBuffer();
}

function uploadForm(fields, name, bytes) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (bytes) form.set(name, new File([bytes], `${name}.png`, { type: "image/png" }));
  return form;
}

/** An ID photo whose retention ends `inMs` from now. */
function storedId(inMs) {
  const file = { id: randomUUID() };
  const prepare = (app, db) => {
    const user = app.users.pro2.id;
    const rel = `${user}/id/${file.id}.jpg`;
    file.abs = path.join(app.dir, ".data", "private", rel);
    fs.mkdirSync(path.dirname(file.abs), { recursive: true });
    fs.writeFileSync(file.abs, "test image");
    Object.assign(
      db.verifications.find((v) => v.userId === user && v.kind === "id"),
      {
        purgeAfter: new Date(Date.now() + inMs).toISOString(),
        files: [{ id: file.id, path: rel, mime: "image/jpeg", size: 10, label: "front" }],
      },
    );
  };
  return { file, prepare };
}

describe("saving data", () => {
  test("01 a damaged data file is never overwritten", async (t) => {
    const app = await signedIn(t, { demo: true });
    await app.stop();
    const good = fs.readFileSync(app.dbFile, "utf8");
    const broken = good.slice(0, -5);

    for (const content of [broken, "", "null", "{}"]) {
      fs.writeFileSync(app.dbFile, content);
      await app.start();
      const r = await app.call("/api/auth/otp/request", { phone: "9833333333", purpose: "signup" });
      assert.equal(fs.readFileSync(app.dbFile, "utf8"), content, "the damaged file was changed");
      assert.ok(r.status >= 500);
      await app.stop();
    }

    fs.writeFileSync(app.dbFile, broken);
    await app.start();
    await app.call("/api/auth/otp/request", { phone: "9833333333", purpose: "signup" });
    fs.writeFileSync(app.dbFile, good);
    await app.login("client"); // repairing the file is enough, no restart needed
    assert.equal(app.db().users.length, 4);
    assert.equal(JSON.parse(fs.readFileSync(`${app.dbFile}.bak`, "utf8")).users.length, 4);
  });

  test("02 one failed save does not break later saves", async (t) => {
    const app = await signedIn(t);
    const keep = `${app.dbFile}.keep`;
    fs.renameSync(app.dbFile, keep);
    fs.mkdirSync(app.dbFile); // makes saving fail, like a locked file or a full disk
    assert.equal((await app.call("/api/auth/role", { role: "client" }, app.client)).status, 500);
    fs.rmdirSync(app.dbFile);
    fs.renameSync(keep, app.dbFile);
    assert.equal((await app.call("/api/auth/role", { role: "client" }, app.client)).status, 200);
  });
});

describe("money", () => {
  test("03 an installment is released once", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking("full");
    const body = { action: "release", installmentId: b.installments[0].id };
    const all = await times(5, () => app.call(`/api/bookings/${b.id}`, body, app.client));
    assert.equal(all.filter((r) => r.status === 200).length, 1);
    const receipts = app.db().receipts.filter((r) => r.kind === "release");
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].fee, 350);
  });

  test("04a an installment is charged once", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    const id = b.installments[1].id;
    const body = { action: "pay", installmentId: id };
    const all = await times(5, () => app.call(`/api/bookings/${b.id}`, body, app.client));
    assert.equal(all.filter((r) => r.status === 200).length, 1);
    assert.equal(app.db().receipts.filter((r) => r.installmentId === id).length, 1);
  });

  test("04b a payment and a release at the same moment are both kept", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    const [first, second] = b.installments;
    await Promise.all([
      app.call(`/api/bookings/${b.id}`, { action: "release", installmentId: first.id }, app.client),
      app.call(`/api/bookings/${b.id}`, { action: "pay", installmentId: second.id }, app.client),
    ]);
    const states = app.db().bookings[0].installments.map((i) => i.state);
    assert.deepEqual(states, ["released", "held", "scheduled"]);
  });

  test("08 a refunded booking cannot come back to life", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    const url = `/api/bookings/${b.id}/dispute`;
    const open = { action: "open", reason: "Work was not done as agreed", wanted: "refund" };
    await Promise.all([app.call(url, open, app.client), app.call(url, open, app.pro)]);
    assert.equal(app.db().disputes.length, 1);
    assert.equal((await app.call(url, { action: "resolve", outcome: "refund" }, app.admin)).status, 200);
    assert.equal((await app.call(url, { action: "resolve", outcome: "redo" }, app.admin)).status, 409);
    assert.equal(app.db().bookings[0].status, "refunded");
  });

  test("15 real accounts cannot judge their own dispute in demo mode", async (t) => {
    const app = await signedIn(t, { demo: true });
    const b = await app.booking();
    const url = `/api/bookings/${b.id}/dispute`;
    const open = { action: "open", reason: "I want to settle this myself", wanted: "refund" };
    await app.call(url, open, app.client);
    for (const who of [app.client, app.pro])
      assert.equal((await app.call(url, { action: "resolve", outcome: "refund" }, who)).status, 403);
    assert.equal(app.db().bookings[0].status, "disputed");
  });
});

describe("offers", () => {
  test("06 an agreed price cannot be raised, not even by withdrawing first", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    const bid = (await app.offer(task)).json.id;
    await app.act(task, bid, { action: "counter", amount: 4700 });
    assert.equal((await app.offer(task, 6000)).json.error, "above_agreed");
    assert.equal((await app.offer(task, 4600)).status, 200, "going lower is allowed");
    assert.equal(
      (await app.offer(task, 4700)).json.error,
      "above_agreed",
      "the lower price is the new limit",
    );
    assert.equal(
      (await app.act(task, bid, { action: "counter", amount: 4500 })).json.error,
      "counter_agreed",
    );
    await app.act(task, bid, { action: "withdraw" }, app.pro);
    assert.equal((await app.offer(task, 6000)).json.error, "above_agreed");
    assert.equal((await app.offer(task, 4600)).json.id, bid, "offering again reuses the same row");
  });

  test("07 accepting takes only the price that was on screen", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    const bid = (await app.offer(task, 5000)).json.id;
    await app.offer(task, 7000);
    assert.equal((await app.act(task, bid, { action: "accept", amount: 5000 })).json.error, "price_changed");
    assert.equal((await app.act(task, bid, { action: "accept" })).status, 422, "the amount is required");
    assert.equal(app.db().tasks[0].status, "open");
    assert.equal((await app.act(task, bid, { action: "accept", amount: 7000 })).json.agreedPrice, 7000);
  });

  test("17 phone numbers and emails are masked in offer messages", async (t) => {
    const app = await signedIn(t);
    const hidden = [
      "Call 9812345678",
      "Call 981-234-5678",
      "Call 981.234.5678",
      "Call (981) 234 5678",
      "Call +977 (981) 2345678",
      "Call ९८१२३४५६७८",
      "Call ９８１２３４５６７８",
      "Call 98123​45678",
      "Mail someone@example.com",
    ];
    const task = await app.task();
    for (const message of hidden) {
      await app.offer(task, 5000, message);
      const shown = (await app.call(`/api/tasks/${task}/live`, null, app.client)).json.offers[0].message;
      assert.match(shown, /••••/, message);
      assert.match(app.db().bids[0].message, /••••/, `saved unmasked: ${message}`);
    }
    for (const message of ["Rs. 9,800 for 2 days", "सेवा राम्रो हुन्छ, २ दिनमा", "Done by 22-11-2026"]) {
      await app.offer(task, 5000, message);
      assert.equal(app.db().bids[0].message, message, "ordinary text must not change");
    }
  });

  test("18 a counter cannot change after the task closes", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    const bid = (await app.offer(task)).json.id;
    await app.act(task, bid, { action: "counter", amount: 3000 });
    await app.act(task, bid, { action: "accept", amount: 5000 });
    assert.equal((await app.act(task, bid, { action: "respond", accept: true }, app.pro)).status, 409);
    const live = (await app.call(`/api/tasks/${task}/live`, null, app.client)).json;
    assert.equal(live.offers[0].amount, live.agreedPrice);
    assert.equal(live.offers[0].counter.status, "declined");
  });

  test("19 the posted price can always be accepted", async (t) => {
    const app = await signedIn(t);
    for (const budget of [500_000, 1_000_000]) {
      const task = await app.task(budget);
      assert.equal((await app.offer(task, budget)).status, 200);
      assert.equal((await app.offer(task, budget * 1.2)).status, 200, "so can the +20% button");
      assert.equal((await app.offer(task, budget * 2 + 1)).json.error, "amount_range");
    }
  });
});

describe("sign-in", () => {
  test("05 five wrong MPINs lock, however fast they arrive", async (t) => {
    const app = await signedIn(t);
    const all = await times(30, (i) => app.call("/api/auth/reauth", { mpin: String(1200 + i) }, app.client));
    assert.equal(all.filter((r) => r.status === 401).length, 4, "four warnings, then the lock");
    // Through login, because re-auth has used up this account's per-minute limit by now.
    const right = await app.call("/api/auth/login", { phone: app.users.client.phone, mpin: PIN });
    assert.equal(right.status, 423, "the right MPIN waits too while locked");

    const phone = app.users.pro.phone;
    const logins = await times(12, (i) => app.call("/api/auth/login", { phone, mpin: String(1200 + i) }));
    assert.equal(logins.filter((r) => r.status === 401).length, 4);

    const unknown = await times(12, (i) =>
      app.call("/api/auth/login", { phone: "9844444444", mpin: String(1200 + i) }),
    );
    assert.equal(unknown.filter((r) => r.status === 401).length, 4, "unknown numbers look the same");
  });

  test("10 a copied cookie stops working after sign-out", async (t) => {
    const app = await App.create(t);
    const phone = await app.login("client");
    const laptop = await app.login("client");
    const resigned = (await app.call("/api/auth/reauth", { mpin: PIN }, phone)).cookie;
    await app.call("/api/auth/logout", {}, phone);
    assert.equal((await app.call("/api/notifications", null, phone)).status, 401);
    assert.equal((await app.call("/api/notifications", null, resigned)).status, 401, "re-signed copy");
    assert.equal((await app.call("/api/notifications", null, laptop)).status, 200, "other devices stay");
    await app.stop();
    await app.start();
    assert.equal(
      (await app.call("/api/notifications", null, phone)).status,
      401,
      "still out after a restart",
    );
  });

  async function resetPermission(app) {
    const phone = app.users.client.phone;
    const { devCode } = (await app.call("/api/auth/otp/request", { phone, purpose: "reset" })).json;
    return (await app.call("/api/auth/otp/verify", { phone, purpose: "reset", code: devCode })).cookie;
  }

  test("11 an MPIN reset ends older sessions", async (t) => {
    const app = await signedIn(t, { demo: true });
    const r = await app.call("/api/auth/reset-mpin", { mpin: "8264" }, await resetPermission(app));
    assert.equal(r.status, 200);
    assert.equal((await app.call("/api/notifications", null, app.client)).status, 401);
    assert.equal((await app.call("/api/notifications", null, r.cookie)).status, 200, "the new session works");
  });

  test("12 one reset permission changes the MPIN once", async (t) => {
    const app = await signedIn(t, { demo: true });
    const ticket = await resetPermission(app);
    const reset = (mpin) => app.call("/api/auth/reset-mpin", { mpin }, ticket);
    const both = await Promise.all([reset("8264"), reset("5937")]);
    assert.equal(both.filter((r) => r.status === 200).length, 1);
    assert.equal((await reset("4826")).status, 401);
  });

  test("13 a made-up IP header does not avoid rate limits", async (t) => {
    const app = await App.create(t);
    const body = { phone: "9822222222", purpose: "signup", code: "123456" };
    let limited = false;
    for (let i = 0; i < 200 && !limited; i++)
      limited = (await app.call("/api/auth/otp/verify", body)).status === 429;
    assert.ok(limited, "200 tries in a row were all let through");
  });

  test("14 a login link cannot leave the site", async (t) => {
    const app = await signedIn(t);
    const evil = [
      "/\\evil.example",
      "//evil.example",
      "/\t/evil.example",
      "/.//evil.example",
      "https://evil.example",
    ];
    for (const next of evil) {
      const r = await app.call(`/login?next=${encodeURIComponent(next)}`, null, app.client);
      assert.equal(new URL(r.location ?? "/", BASE).origin, BASE, JSON.stringify(next));
    }
    const ok = await app.call(`/login?next=${encodeURIComponent("/task/abc?tab=1")}`, null, app.client);
    assert.equal(new URL(ok.location, BASE).pathname, "/task/abc");
  });
});

describe("verification", () => {
  test("09 a new ID needs a new selfie match", async (t) => {
    const app = await signedIn(t);
    const form = uploadForm({ docType: "passport", consent: "yes" }, "front", await image());
    assert.equal((await app.call("/api/verification/id", form, app.pro)).status, 200);
    const me = app.users.pro.id;
    assert.ok(!app.db().verifications.some((v) => v.userId === me && v.kind === "selfie"));
    await app.call("/api/verification/review", { userId: me, kind: "id", decision: "verified" }, app.admin);
    assert.equal(app.db().users.find((u) => u.id === me).verified, false);
  });

  test("09b an ID swapped during the face check does not get the badge", async (t) => {
    const app = await signedIn(t, {
      demo: true,
      prepare: (a, db) => (db.users.find((u) => u.id === a.users.pro.id).isDemo = true),
    });
    const [slowSelfie, newId] = await Promise.all([slowImage(), image()]);
    const check = () =>
      app.call("/api/verification/selfie", uploadForm({ consent: "yes" }, "selfie", slowSelfie), app.pro);
    assert.equal((await check()).status, 200, "warm-up");
    const started = Date.now();
    assert.equal((await check()).status, 200, "timing run");
    const duration = Date.now() - started;

    // Swap the ID halfway through the next check.
    const checking = check();
    await sleep(duration / 2);
    await app.call(
      "/api/verification/id",
      uploadForm({ docType: "passport", consent: "yes" }, "front", newId),
      app.pro,
    );
    assert.equal((await checking).status, 409);
    const me = app.users.pro.id;
    assert.ok(!app.db().verifications.some((v) => v.userId === me && v.kind === "selfie"));
  });

  test("16 an expired ID photo is not served", async (t) => {
    const { file, prepare } = storedId(6000);
    const app = await App.create(t, { prepare });
    const admin = await app.login("admin");
    const url = `/api/verification/file/${file.id}?user=${app.users.pro2.id}`;
    assert.equal((await app.call(url, null, admin)).status, 200, "served until it expires");
    await sleep(6000);
    assert.equal((await app.call(url, null, admin)).status, 404);
  });

  test("20 expired photos are deleted without anyone visiting", async (t) => {
    const { file, prepare } = storedId(-1000);
    const app = await App.create(t, { prepare });
    for (let i = 0; i < 20 && fs.existsSync(file.abs); i++) await sleep(250);
    assert.ok(!fs.existsSync(file.abs), "the photo is still on disk");
    await sleep(250);
    const record = app.db().verifications.find((v) => v.userId === app.users.pro2.id && v.kind === "id");
    assert.deepEqual(record.files, []);
    assert.equal(record.status, "verified", "the decision stays");
  });
});

describe("normal use still works", () => {
  test("task, counter, booking, payments, rating and withdrawal", async (t) => {
    const app = await signedIn(t);
    const task = await app.task(5000);
    const bid = (await app.offer(task, 5000)).json.id;
    await app.act(task, bid, { action: "counter", amount: 4000 });
    assert.equal((await app.act(task, bid, { action: "respond", accept: true }, app.pro)).status, 200);
    assert.equal((await app.act(task, bid, { action: "accept", amount: 4000 })).json.agreedPrice, 4000);
    const made = await app.call(
      "/api/bookings",
      { taskId: task, plan: "two", method: "esewa_sandbox" },
      app.client,
    );
    const url = `/api/bookings/${made.json.id}`;
    const [a, b] = app.db().bookings[0].installments.map((i) => i.id);
    const step = async (action, installmentId, who) =>
      assert.equal((await app.call(url, { action, installmentId }, who)).status, 200, action);
    await step("deliver", a, app.pro);
    await step("release", a, app.client);
    await step("pay", b, app.client);
    await step("release", b, app.client);
    assert.equal(app.db().bookings[0].status, "completed");
    assert.equal((await app.call(`${url}/rate`, { stars: 5 }, app.client)).status, 200);
    const payout = { action: "payout", amount: 3720, method: "esewa_sandbox" };
    assert.equal((await app.call("/api/wallet", payout, app.pro)).status, 200);
  });

  test("a task can't be booked twice and earnings can't be withdrawn twice", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    const bid = (await app.offer(task, 2000)).json.id;
    await app.act(task, bid, { action: "accept", amount: 2000 });
    const book = { taskId: task, plan: "full", method: "esewa_sandbox" };
    await times(5, () => app.call("/api/bookings", book, app.client));
    const [booking] = app.db().bookings;
    assert.equal(app.db().bookings.length, 1);
    const release = { action: "release", installmentId: booking.installments[0].id };
    await app.call(`/api/bookings/${booking.id}`, release, app.client);
    await times(5, () =>
      app.call("/api/wallet", { action: "payout", amount: 1860, method: "esewa_sandbox" }, app.pro),
    );
    assert.equal(app.db().payouts.length, 1);
  });

  test("sign-up, role switch and language change", async (t) => {
    const app = await App.create(t, { demo: true });
    const phone = "9855555555";
    const { devCode } = (await app.call("/api/auth/otp/request", { phone, purpose: "signup" })).json;
    const verified = await app.call("/api/auth/otp/verify", { phone, purpose: "signup", code: devCode });
    const body = { name: "New Person", city: "Kathmandu", role: "client", mpin: "8264", acceptTerms: true };
    const joined = await app.call("/api/auth/register", body, verified.cookie);
    assert.equal(joined.status, 200);
    const switched = await app.call("/api/auth/role", { role: "provider", enable: true }, joined.cookie);
    assert.equal(switched.status, 200);
    assert.equal((await app.call("/api/notifications", null, switched.cookie)).status, 200);
    assert.equal((await app.call("/api/prefs", { lang: "ne" }, switched.cookie)).status, 200);
    assert.equal(app.db().users.find((u) => u.phone === phone).lang, "ne");
  });

  test("existing accounts and cookies keep working, and can still sign out", async (t) => {
    const app = await App.create(t);
    const cookie = app.legacyCookie("client");
    assert.equal((await app.call("/api/notifications", null, cookie)).status, 200);
    await app.call("/api/auth/logout", {}, cookie);
    assert.equal((await app.call("/api/notifications", null, cookie)).status, 401);
  });

  test("demo sign-in, pages and the demo reviewer", async (t) => {
    const app = await App.create(t, { demo: true });
    const demo = async (persona) => (await app.call("/api/auth/demo", { persona })).cookie;
    const mina = await demo("mina");
    const bikash = await demo("bikash");
    const task = await app.task(null, mina);
    const bid = (await app.offer(task, 5000, "I can do it", bikash)).json.id;
    await app.act(task, bid, { action: "accept", amount: 5000 }, mina);
    const made = await app.call(
      "/api/bookings",
      { taskId: task, plan: "full", method: "esewa_sandbox" },
      mina,
    );
    const url = `/api/bookings/${made.json.id}/dispute`;
    await app.call(url, { action: "open", reason: "Trying the demo reviewer", wanted: "redo" }, mina);
    assert.equal((await app.call(url, { action: "resolve", outcome: "redo" }, mina)).status, 200);
    const pages = [
      "/",
      "/explore",
      "/wallet",
      "/messages",
      "/verification",
      "/post",
      "/admin",
      `/task/${task}`,
      `/payments/${made.json.id}`,
    ];
    for (const page of pages) assert.equal((await app.call(page, null, mina)).status, 200, page);
  });
});
