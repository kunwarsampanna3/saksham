// The owner's rules: posting fees, the 50% advance, the 7% at withdrawal, Saksham Credit, the admin dashboard,
// and Claude's suggestions.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import { App, postFor, sleep } from "./harness.mjs";

const DAY = 86_400_000;
const times = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
const iso = (ms) => new Date(ms).toISOString();

async function signedIn(t, opts) {
  const app = await App.create(t, opts);
  await app.everyone();
  return app;
}

const taskBody = (over = {}) => ({
  category: "plumbing",
  title: "Fix kitchen tap",
  details: "",
  quantity: 1,
  days: 4,
  city: "Kathmandu",
  online: false,
  womenOnly: false,
  budget: null,
  flexible: true,
  aiSource: "manual",
  post: postFor(3),
  ...over,
});

const abroadBody = (over = {}) => ({
  title: "Warehouse helpers",
  details: "",
  category: "moving",
  country: "Qatar",
  city: "Doha",
  workersNeeded: 2,
  days: 10,
  payPerWorker: 20_000,
  post: postFor(3),
  ...over,
});

/** Pretend the post was paid for `daysAgo` days ago. */
async function ageTo(app, id, daysAgo) {
  await app.restartWith((db) => {
    const item = db.tasks?.find((x) => x.id === id) ?? db.abroadJobs.find((x) => x.id === id);
    for (const key of ["paidAt", "endsAt", "removeAt"])
      item.post[key] = iso(Date.parse(item.post[key]) - daysAgo * DAY);
  });
}

const notices = (app, code) => (app.db().notifications ?? []).filter((n) => n.code === code);

async function until(check, ms = 8000) {
  for (let waited = 0; !check(); waited += 100) {
    if (waited > ms) throw new Error("timed out");
    await sleep(100);
  }
}

describe("paid posts", () => {
  test("3 days cost Rs 1,000 and 10 days Rs 4,000", async (t) => {
    const app = await signedIn(t);
    for (const [days, fee] of [
      [3, 1000],
      [10, 4000],
    ]) {
      const r = await app.call("/api/tasks", taskBody({ post: postFor(days) }), app.client);
      assert.equal(r.status, 200);
      const { post } = app.db().tasks.find((x) => x.id === r.json.id);
      assert.equal(post.fee, fee);
      assert.equal(Date.parse(post.endsAt) - Date.parse(post.paidAt), days * DAY);
      assert.equal(Date.parse(post.removeAt) - Date.parse(post.endsAt), 5 * DAY, "5 free days after");
      assert.match(post.ref, /^ESEWA-SBX-/);
    }
  });

  test("nothing is posted without paying the right fee", async (t) => {
    const app = await signedIn(t);
    const bad = [
      undefined,
      { ...postFor(3), fee: 1 },
      { ...postFor(10), fee: 1000 },
      { ...postFor(3), days: 7 },
      { ...postFor(3), requestId: "x" },
    ];
    for (const post of bad) {
      const r = await app.call("/api/tasks", taskBody({ post }), app.client);
      assert.ok(r.status >= 400, JSON.stringify(post));
      const a = await app.call("/api/abroad/jobs", abroadBody({ post }), app.client);
      assert.ok(a.status >= 400, JSON.stringify(post));
    }
    assert.equal(app.db().tasks?.length ?? 0, 0);
    assert.equal(app.db().abroadJobs?.length ?? 0, 0);
  });

  test("posting needs a fresh MPIN", async (t) => {
    const app = await signedIn(t);
    const stale = app.staleCookie("client");
    assert.equal((await app.call("/api/tasks", taskBody(), stale)).json.error, "reauth_required");
    assert.equal((await app.call("/api/abroad/jobs", abroadBody(), stale)).json.error, "reauth_required");
  });

  test("a repeated click pays once", async (t) => {
    const app = await signedIn(t);
    const body = taskBody();
    const all = await times(5, () => app.call("/api/tasks", body, app.client));
    assert.equal(new Set(all.map((r) => r.json.id)).size, 1);
    assert.equal(app.db().tasks.length, 1);
    const job = abroadBody();
    await times(5, () => app.call("/api/abroad/jobs", job, app.client));
    assert.equal(app.db().abroadJobs.length, 1);
  });

  test("with nobody hired it gets 5 free days, and says so once", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    await ageTo(app, task, 3.1);
    await until(() => notices(app, "post_free").length === 1);
    assert.equal((await app.offer(task)).status, 200, "still taking offers in the free days");
    assert.match((await app.call(`/task/${task}`, null, app.client)).text, /data-post-phase="free"/);
    await app.restartWith(() => {});
    await sleep(700);
    assert.equal(notices(app, "post_free").length, 1);
  });

  test("the last moment before removal still works", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    await ageTo(app, task, 7.99);
    assert.equal((await app.offer(task)).status, 200);
  });

  test("after that the post is removed", async (t) => {
    const app = await signedIn(t);
    app.pro2 = await app.login("pro2");
    const task = await app.task();
    const bid = (await app.offer(task)).json.id;
    await ageTo(app, task, 8.01);
    await until(() => notices(app, "post_expired").length === 1);
    assert.equal((await app.act(task, bid, { action: "accept", amount: 5000 })).json.error, "task_closed");
    assert.equal((await app.offer(task, 5000, "Late", app.pro2)).status, 404, "gone for everyone else");
    assert.ok(!(await app.call("/explore", null, app.pro2)).text.includes(task), "off the list");
    assert.match((await app.call(`/task/${task}`, null, app.client)).text, /data-post-phase="expired"/);
    assert.match((await app.call("/my-tasks?tab=done", null, app.client)).text, /Expired/);
    const db = app.db();
    assert.equal(db.tasks[0].status, "expired");
    assert.equal(db.bids[0].status, "declined");
    assert.equal(notices(app, "post_gone").length, 1);
  });

  test("a post with someone hired is never removed", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    await ageTo(app, b.task, 30);
    await sleep(700);
    assert.equal(app.db().tasks[0].status, "in_progress");
    assert.equal(notices(app, "post_expired").length, 0);
  });

  test("jobs abroad follow the same clock and can't reopen free", async (t) => {
    const app = await signedIn(t);
    const job = (await app.call("/api/abroad/jobs", abroadBody(), app.client)).json.id;
    const act = (body, who) => app.call(`/api/abroad/jobs/${job}`, body, who);
    await ageTo(app, job, 8.01);
    assert.equal((await act({ action: "apply", note: "", eligible: true }, app.pro)).json.error, "not_open");
    assert.equal((await act({ action: "reopen" }, app.client)).json.error, "cannot_reopen");
    assert.match((await app.call(`/abroad/jobs/${job}`, null, app.client)).text, /data-post-phase="expired"/);
  });

  test("posts from before posting was paid keep working", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    await app.restartWith((db) => {
      delete db.tasks[0].post;
      db.tasks[0].createdAt = iso(Date.now() - 60 * DAY);
    });
    assert.equal((await app.offer(task)).status, 200);
  });

  test("phone numbers are hidden in a post's title and details", async (t) => {
    const app = await signedIn(t);
    await app.call(
      "/api/tasks",
      taskBody({ title: "Tap 9812345678", details: "Call 9812345678" }),
      app.client,
    );
    assert.doesNotMatch(JSON.stringify(app.db().tasks[0]), /9812345678/);
  });
});

describe("the 50% advance", () => {
  test("the recruiter pays 50 and 50, the applicant gets 30, 30 and 40", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(10_000);
    const now = () => app.db().bookings[0];
    const sum = (state) =>
      now()
        .installments.filter((i) => i.state === state)
        .reduce((n, i) => n + i.amount, 0);
    const receipts = (kind) =>
      app
        .db()
        .receipts.filter((r) => r.kind === kind)
        .map((r) => r.amount);

    assert.deepEqual(receipts("hold"), [5000], "50% advance");
    assert.deepEqual(receipts("release"), [3000], "30% straight away");
    assert.equal(sum("held"), 2000, "20% held");

    assert.equal((await b.half()).status, 200);
    assert.equal(notices(app, "half_done").length, 1, "the recruiter is told");
    assert.ok(
      app.db().messages.some((m) => m.system?.code === "half_done"),
      "and gets a chat message",
    );

    assert.equal((await b.second()).status, 200);
    assert.deepEqual(receipts("hold"), [5000, 5000]);
    assert.deepEqual(receipts("release"), [3000, 3000]);
    assert.equal(sum("held"), 4000, "the last 40% is held");

    assert.equal((await b.deliver()).status, 200);
    assert.equal((await b.release()).status, 200);
    assert.deepEqual(receipts("release"), [3000, 3000, 4000]);
    assert.equal(now().status, "completed");
    assert.equal(app.db().tasks[0].status, "completed");
    assert.ok(
      app.db().receipts.every((r) => r.fee === 0),
      "no fee until withdrawal",
    );
  });

  for (const amount of [100, 101, 999, 1001, 3333, 98_765, 350_001]) {
    test(`every rupee adds up for Rs ${amount}`, async (t) => {
      const app = await signedIn(t, {
        prepare: (a, db) => {
          db.tasks = [
            {
              ...taskBody(),
              post: undefined,
              id: "t-adds-up",
              clientId: a.users.client.id,
              clientName: "Test client",
              isExample: false,
              fairLow: 100,
              fairHigh: 100_000,
              photos: [],
              status: "assigned",
              acceptedBidId: "bid-adds-up",
              agreedPrice: amount,
              createdAt: iso(Date.now()),
              updatedAt: iso(Date.now()),
            },
          ];
          db.bids = [
            {
              id: "bid-adds-up",
              taskId: "t-adds-up",
              providerId: a.users.pro.id,
              providerName: "Test pro",
              isExample: false,
              amount,
              days: 2,
              message: "",
              status: "accepted",
              appearAt: iso(Date.now()),
              createdAt: iso(Date.now()),
              updatedAt: iso(Date.now()),
            },
          ];
        },
      });
      const r = await app.call(
        "/api/bookings",
        { taskId: "t-adds-up", method: "khalti_sandbox" },
        app.client,
      );
      const b = app.steps(r.json.id);
      assert.equal((await b.half()).status, 200);
      assert.equal((await b.second()).status, 200);
      assert.equal((await b.release()).status, 200);
      const db = app.db();
      const total = (kind) => db.receipts.filter((x) => x.kind === kind).reduce((n, x) => n + x.amount, 0);
      assert.equal(total("hold"), amount);
      assert.equal(total("release"), amount);
      for (const i of db.bookings[0].installments) assert.ok(i.amount >= 0 && Number.isInteger(i.amount));
    });
  }

  test("the steps can't be skipped, repeated or done by the wrong person", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    const [, kept, , finish] = b.installments;
    const call = (body, who) => app.call(`/api/bookings/${b.id}`, body, who);

    assert.equal((await b.second()).json.error, "half_not_reported");
    assert.equal((await call({ action: "half" }, app.client)).status, 403);
    for (const id of [kept.id, finish.id]) {
      assert.ok((await call({ action: "release", installmentId: id }, app.client)).status >= 400);
      assert.ok((await call({ action: "pay", installmentId: id }, app.client)).status >= 400);
    }
    assert.ok((await call({ action: "deliver", installmentId: kept.id }, app.pro)).status >= 400);
    assert.equal((await b.half()).status, 200);
    assert.equal((await b.half()).json.error, "bad_state");
    assert.equal((await call({ action: "second" }, app.pro)).status, 403);
    assert.equal((await call({ action: "second" }, app.staleCookie("client"))).json.error, "reauth_required");
    const paid = await times(5, () => b.second());
    assert.equal(paid.filter((r) => r.status === 200).length, 1, "charged once");
    assert.equal(
      (await call({ action: "release", installmentId: kept.id }, app.client)).json.error,
      "bad_state",
    );
  });

  test("a dispute refunds only what is still held", async (t) => {
    for (const [reported, back] of [
      [false, 1000],
      [true, 2000],
    ]) {
      const app = await signedIn(t);
      const b = await app.booking(5000);
      if (reported) {
        await b.half();
        await b.second();
      }
      const url = `/api/bookings/${b.id}/dispute`;
      await app.call(url, { action: "open", reason: "The work has stopped", wanted: "refund" }, app.client);
      assert.equal((await b.second()).status, 409, "frozen");
      assert.equal((await app.call(url, { action: "resolve", outcome: "refund" }, app.admin)).status, 200);
      const refunds = app.db().receipts.filter((r) => r.kind === "refund");
      assert.equal(
        refunds.reduce((n, r) => n + r.amount, 0),
        back,
      );
      await app.stop();
    }
  });

  test("the applicant is told to wait until the advance is paid", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    const bid = (await app.offer(task)).json.id;
    await app.act(task, bid, { action: "accept", amount: 5000 });
    assert.match((await app.call(`/task/${task}`, null, app.pro)).text, /Wait until the recruiter pays/);
  });

  test("family can confirm half work and the finished work", async (t) => {
    const app = await signedIn(t);
    const body = taskBody({ family: { country: "Qatar", familyName: "Aama" } });
    const task = (await app.call("/api/tasks", body, app.client)).json.id;
    const b = await app.book(task, 5000);
    const link = await app.call(`/api/bookings/${b.id}/family`, { action: "link" }, app.client);
    const token = link.json.url.split("/").pop();
    const confirm = (installmentId) => app.call("/api/confirm", { token, installmentId, ok: true, note: "" });
    const [, kept, , finish] = b.installments;
    assert.equal((await confirm(kept.id)).status, 409, "nothing to confirm before half is reported");
    await b.half();
    assert.equal((await confirm(kept.id)).status, 200);
    await b.second();
    assert.equal((await confirm(finish.id)).status, 200);
  });

  test("each step's screens open for both people", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    const pages = async () => {
      for (const who of [app.client, app.pro]) {
        for (const url of [`/payments/${b.id}`, `/task/${b.task}`, "/my-tasks?tab=progress", "/wallet"])
          assert.equal((await app.call(url, null, who)).status, 200, url);
        for (const r of app.db().receipts)
          assert.equal((await app.call(`/payments/${b.id}/receipt/${r.id}`, null, who)).status, 200);
      }
    };
    await pages();
    for (const step of ["half", "second", "deliver", "release"]) {
      await b[step]();
      await pages();
    }
  });
});

describe("7% at withdrawal", () => {
  const withdraw = (app, amount, who = app.pro) =>
    app.call("/api/wallet", { action: "payout", amount, method: "esewa_sandbox" }, who);

  test("the fee is 7% of what is withdrawn", async (t) => {
    const app = await signedIn(t);
    await app.booking(10_000);
    assert.equal((await withdraw(app, 3001)).json.error, "payout_too_much");
    assert.equal((await withdraw(app, 3000)).json.fee, 210);
  });

  test("many small withdrawals cost the same as one", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(3000);
    await b.finish();
    let fees = 0;
    for (const amount of [101, 107, 113, 127, 131, 2421]) {
      const r = await withdraw(app, amount);
      assert.equal(r.status, 200, r.text);
      fees += r.json.fee;
    }
    assert.equal(fees, 210);
    assert.equal((await withdraw(app, 100)).json.error, "payout_too_much");
  });

  test("money that paid 7% under the old rules isn't charged again", async (t) => {
    const bookingId = randomUUID();
    const installmentId = randomUUID();
    const app = await signedIn(t, {
      prepare: (a, db) => {
        const at = iso(Date.now() - DAY);
        db.bookings = [
          {
            id: bookingId,
            taskId: "old-task",
            bidId: "old-bid",
            clientId: a.users.client.id,
            providerId: a.users.pro.id,
            providerName: "Test pro",
            providerIsExample: false,
            total: 10_000,
            feeRate: 0.07,
            plan: "full",
            method: "esewa_sandbox",
            status: "completed",
            installments: [
              {
                id: installmentId,
                seq: 1,
                label: "full",
                pct: 100,
                amount: 10_000,
                dueDate: "2026-11-01",
                state: "released",
              },
            ],
            createdAt: at,
            updatedAt: at,
          },
        ];
        db.receipts = [
          {
            id: randomUUID(),
            bookingId,
            installmentId,
            kind: "release",
            amount: 10_000,
            fee: 700,
            method: "esewa_sandbox",
            ref: "OLD",
            receiptNo: "OLD",
            createdAt: at,
          },
        ];
      },
    });
    await app.booking(10_000); // 3,000 more, not yet taxed
    assert.equal((await withdraw(app, 9300)).json.fee, 0, "the old money leaves first, free");
    assert.equal((await withdraw(app, 3000)).json.fee, 210);
    assert.equal((await app.call(`/payments/${bookingId}`, null, app.client)).status, 200);
  });

  test("a booking from before can still be finished its old way", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(5000);
    await app.restartWith((db) => {
      const old = db.bookings[0];
      Object.assign(old, { plan: "two", feeRate: 0.07 });
      old.installments = old.installments.slice(0, 2).map((i, n) => ({
        ...i,
        label: n ? "second" : "first",
        amount: 2500,
        pct: 50,
        state: n ? "scheduled" : "held",
        releasedAt: undefined,
      }));
      db.receipts = [];
    });
    const [a, z] = app.db().bookings[0].installments.map((i) => i.id);
    for (const [action, installmentId] of [
      ["release", a],
      ["pay", z],
      ["release", z],
    ])
      assert.equal(
        (await app.call(`/api/bookings/${b.id}`, { action, installmentId }, app.client)).status,
        200,
      );
    const db = app.db();
    assert.equal(db.bookings[0].status, "completed");
    assert.equal(
      db.receipts.filter((r) => r.kind === "release").reduce((n, r) => n + r.fee, 0),
      350,
    );
  });
});

describe("Saksham Credit", () => {
  /** `done` completed jobs of Rs 20,000 for the applicant, `posts` posts by the recruiter. */
  const history =
    (done, posts, { stars = 5, cancelled = 0, removed = 0 } = {}) =>
    (a, db) => {
      const at = iso(Date.now() - DAY);
      db.bookings = [];
      db.ratings = [];
      db.tasks = [];
      for (let i = 0; i < done; i++) {
        const id = randomUUID();
        db.bookings.push({
          id,
          taskId: `done-${i}`,
          bidId: "b",
          clientId: a.users.client.id,
          providerId: a.users.pro.id,
          providerName: "Test pro",
          providerIsExample: false,
          total: 20_000,
          feeRate: 0,
          plan: "advance",
          method: "esewa_sandbox",
          status: "completed",
          installments: [
            {
              id: randomUUID(),
              seq: 1,
              label: "finish",
              pct: 100,
              amount: 20_000,
              dueDate: "2026-11-01",
              state: "released",
            },
          ],
          createdAt: at,
          updatedAt: at,
        });
        db.ratings.push({
          id: randomUUID(),
          bookingId: id,
          taskId: `done-${i}`,
          raterId: a.users.client.id,
          rateeId: a.users.pro.id,
          stars,
          text: "",
          createdAt: at,
        });
      }
      for (let i = 0; i < posts + cancelled + removed; i++)
        db.tasks.push({
          ...taskBody(),
          post: undefined,
          id: `post-${i}`,
          clientId: a.users.client.id,
          clientName: "Test client",
          isExample: false,
          fairLow: 500,
          fairHigh: 5000,
          photos: [],
          status: i < posts ? "open" : "cancelled",
          removed: i >= posts + cancelled ? { at, by: "admin", reason: "test" } : undefined,
          createdAt: at,
          updatedAt: at,
        });
    };
  const apply = (app, kind, amount, who, example = false) =>
    app.call("/api/wallet", { action: "credit", kind, amount, months: 6, purpose: "Tools", example }, who);

  test("an applicant needs 10 completed jobs", async (t) => {
    const app = await signedIn(t, { prepare: history(9, 0) });
    assert.equal((await apply(app, "applicant", 1000, app.pro)).json.error, "credit_not_eligible");
  });

  test("with 10 they can apply, up to 15% of earnings", async (t) => {
    const app = await signedIn(t, { prepare: history(10, 0) });
    assert.equal((await apply(app, "applicant", 31_000, app.pro)).json.error, "credit_amount");
    assert.equal((await apply(app, "applicant", 30_000, app.pro)).status, 200);
    assert.equal((await apply(app, "applicant", 1000, app.pro)).json.error, "credit_amount", "limit used up");
  });

  test("a rating under 4.5 halves the applicant's limit", async (t) => {
    const app = await signedIn(t, { prepare: history(10, 0, { stars: 4 }) });
    assert.equal((await apply(app, "applicant", 16_000, app.pro)).json.error, "credit_amount");
    assert.equal((await apply(app, "applicant", 15_000, app.pro)).status, 200);
  });

  test("a recruiter needs 50 posts, not counting cancelled or taken down", async (t) => {
    const app = await signedIn(t, { prepare: history(10, 49, { cancelled: 5, removed: 5 }) });
    assert.equal((await apply(app, "recruiter", 1000, app.client)).json.error, "credit_not_eligible");
  });

  test("with 50 posts a recruiter can apply", async (t) => {
    const app = await signedIn(t, { prepare: history(10, 50) });
    assert.equal((await apply(app, "recruiter", 30_000, app.client)).status, 200);
    assert.equal((await apply(app, "applicant", 1000, app.client)).json.error, "credit_not_eligible");
  });

  test("example histories work only for demo accounts", async (t) => {
    const app = await signedIn(t, { demo: true });
    assert.equal((await apply(app, "recruiter", 1000, app.client, true)).json.error, "credit_not_eligible");
    const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
    assert.equal((await apply(app, "recruiter", 5000, mina, true)).status, 200);
  });

  test("an admin decides, and declining frees the limit", async (t) => {
    const app = await signedIn(t, { prepare: history(10, 0) });
    const id = (await apply(app, "applicant", 30_000, app.pro)).json.id;
    const decide = (who) =>
      app.call("/api/admin/manage", { action: "credit", userId: app.users.pro.id, id, approve: false }, who);
    assert.equal((await decide(app.pro)).status, 404);
    assert.equal((await decide(app.admin)).status, 200);
    assert.equal((await decide(app.admin)).json.error, "decided");
    assert.equal((await apply(app, "applicant", 30_000, app.pro)).status, 200);
  });
});

describe("admin dashboard", () => {
  const manage = (app, body, who = app.admin) => app.call("/api/admin/manage", body, who);
  const controls = (app, over = {}, who = app.admin) =>
    manage(
      app,
      {
        action: "controls",
        signups: true,
        posting: true,
        applying: true,
        maintenance: false,
        maxOnline: 0,
        ...over,
      },
      who,
    );
  const pagesFor = (id) => [
    "/admin",
    "/admin/users",
    `/admin/users/${id}`,
    "/admin/posts",
    "/admin/money",
    "/admin/credit",
    "/admin/traffic",
    "/admin/moderation",
    "/admin/activity",
  ];

  test("every page is for admins only", async (t) => {
    const app = await signedIn(t);
    await app.booking();
    const secret = app.users.pro.phone;
    for (const url of pagesFor(app.users.pro.id)) {
      const ok = await app.call(url, null, app.admin);
      assert.equal(ok.status, 200, url);
      for (const who of [app.client, ""]) {
        const no = await app.call(url, null, who);
        assert.ok(!no.text.includes(secret), `${url} leaked a phone number`);
        // A streamed response can't change its status, so check that no dashboard content came with it.
        assert.doesNotMatch(no.text, /data-stat=|data-controls/, url);
      }
    }
    assert.equal((await controls(app, { maintenance: true }, app.client)).status, 404);
  });

  test("an owner sees a user's full data, and never the MPIN hash", async (t) => {
    const app = await signedIn(t);
    const page = await app.call(`/admin/users/${app.users.pro.id}`, null, app.admin);
    assert.ok(page.text.includes(app.users.pro.phone));
    assert.ok(!page.text.includes(app.users.pro.mpinHash));
  });

  test("the demo admin can't see or change real accounts", async (t) => {
    const app = await signedIn(t, { demo: true });
    const task = await app.task();
    const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
    const id = app.users.pro.id;
    for (const url of pagesFor(id))
      assert.ok(!(await app.call(url, null, mina)).text.includes(app.users.pro.phone), url);
    // Searching can't be used to work the number out either.
    const found = await app.call(`/admin/users?q=${app.users.pro.phone.slice(0, 8)}`, null, mina);
    assert.ok(!found.text.includes(`/admin/users/${id}`));
    assert.equal((await manage(app, { action: "suspend", userId: id, reason: "test" }, mina)).status, 403);
    assert.equal((await manage(app, { action: "sign-out", userId: id }, mina)).status, 403);
    const down = { action: "take-down", kind: "task", id: task, reason: "test" };
    assert.equal((await manage(app, down, mina)).status, 403);
  });

  test("suspending ends sessions and blocks sign-in until lifted", async (t) => {
    const app = await signedIn(t);
    const userId = app.users.pro.id;
    assert.equal((await manage(app, { action: "suspend", userId, reason: "Fake work" })).status, 200);
    assert.equal((await app.call("/api/notifications", null, app.pro)).status, 401);
    await assert.rejects(app.login("pro"), /suspended/);
    const page = await app.call("/wallet", null, app.pro);
    assert.ok(!page.text.includes("Available to withdraw"));
    assert.equal((await app.call("/login", null, app.pro)).status, 200, "no redirect loop");
    assert.equal((await manage(app, { action: "unsuspend", userId })).status, 200);
    assert.ok(await app.login("pro"));
  });

  test("admins can't be suspended, themselves included", async (t) => {
    const app = await signedIn(t);
    const r = await manage(app, { action: "suspend", userId: app.users.admin.id, reason: "test" });
    assert.equal(r.status, 403);
  });

  test("sign out everywhere", async (t) => {
    const app = await signedIn(t);
    await manage(app, { action: "sign-out", userId: app.users.pro.id });
    assert.equal((await app.call("/api/notifications", null, app.pro)).status, 401);
    assert.ok(await app.login("pro"));
  });

  test("taking down a post", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    await app.offer(task);
    const down = (id) => manage(app, { action: "take-down", kind: "task", id, reason: "Not allowed" });
    assert.equal((await down(task)).status, 200);
    assert.ok((await app.offer(task)).status >= 400);
    assert.equal(notices(app, "post_removed").length, 1);
    assert.equal((await down((await app.booking()).task)).json.error, "has_booking");
  });

  test("sign-ups, posting and applying can each be switched off", async (t) => {
    const app = await signedIn(t);
    const task = await app.task();
    await controls(app, { signups: false, posting: false, applying: false });
    const signup = await app.call("/api/auth/otp/request", { phone: "9844444444", purpose: "signup" });
    assert.equal(signup.json.error, "signups_paused");
    assert.equal((await app.call("/api/tasks", taskBody(), app.client)).json.error, "posting_paused");
    assert.equal((await app.call("/api/abroad/jobs", abroadBody(), app.client)).json.error, "posting_paused");
    assert.equal((await app.offer(task)).json.error, "applying_paused");
    assert.equal(app.db().tasks.length, 1, "nobody was charged");
    await controls(app);
    assert.equal((await app.offer(task)).status, 200);
  });

  test("maintenance mode, and the admin can always get back in", async (t) => {
    const app = await signedIn(t);
    await controls(app, { maintenance: true });
    for (const who of [app.client, ""]) assert.match((await app.call("/", null, who)).text, /data-paused/);
    assert.equal((await app.call("/api/tasks", taskBody(), app.client)).json.error, "maintenance");
    assert.doesNotMatch((await app.call("/", null, app.admin)).text, /data-paused="/);
    const admin = await app.login("admin");
    assert.equal((await controls(app, {}, admin)).status, 200);
    assert.doesNotMatch((await app.call("/", null, app.client)).text, /data-paused="/);
  });

  test("the visitor limit keeps people who are already here", async (t) => {
    const app = await signedIn(t);
    const seen = (who) => app.call("/api/traffic", { path: "/", view: true, mobile: false }, who);
    await seen(app.client);
    await controls(app, { maxOnline: 1 });
    assert.equal((await seen(app.client)).json.block, null);
    assert.equal((await seen(app.pro)).json.block, "busy");
    assert.match((await app.call("/", null, app.pro)).text, /data-paused="busy"/);
    assert.equal((await seen(app.admin)).json.block, null);
  });

  test("traffic counts visitors and stores nothing that identifies them", async (t) => {
    const app = await signedIn(t);
    const seen = (path, who = "") => app.call("/api/traffic", { path, view: true, mobile: true }, who);
    const visit = await seen("/explore?q=secret");
    await seen("/task/private-id-123", visit.cookie);
    await seen("/wallet", app.pro);
    await seen("/admin/users", app.admin);
    await app.call("/admin/traffic", null, app.admin); // saves the counts
    const [day] = app.db().traffic;
    assert.equal(day.views, 3, "admin pages aren't counted");
    assert.equal(day.visitors.length, 2);
    assert.deepEqual(Object.keys(day.pages).sort(), ["/explore", "/task/:id", "/wallet"]);
    const saved = JSON.stringify(day);
    for (const hidden of ["secret", "private-id-123", app.users.pro.id, "10.0."])
      assert.ok(!saved.includes(hidden));
  });

  test("changes are written to the activity log", async (t) => {
    const app = await signedIn(t);
    await manage(app, { action: "sign-out", userId: app.users.pro.id });
    await controls(app, { posting: false });
    assert.deepEqual(
      app.db().audit.map((a) => a.action),
      ["sign_out", "controls"],
    );
  });

  test("a newer document can't be approved unseen", async (t) => {
    const first = iso(Date.now() - 120_000);
    const app = await signedIn(t, {
      prepare: (a, db) => {
        const v = db.verifications.find((x) => x.userId === a.users.pro.id && x.kind === "id");
        Object.assign(v, { status: "pending", submittedAt: iso(Date.now()) });
      },
    });
    const body = { userId: app.users.pro.id, kind: "id", decision: "verified", submittedAt: first };
    assert.equal((await app.call("/api/verification/review", body, app.admin)).status, 409);
  });
});

/** Stands in for the Claude API. Records what Saksham sends. */
async function fakeClaude(t, answer, { stop = "end_turn", status = 200 } = {}) {
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen.push({ url: req.url, beta: req.headers["anthropic-beta"], body: JSON.parse(body) });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          stop_reason: stop,
          content: [{ type: "text", text: JSON.stringify(answer(seen.at(-1).body)) }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const env = {
    ANTHROPIC_API_KEY: "test-not-a-real-key",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  };
  return { seen, env };
}

describe("Claude: match and coach", () => {
  const candidates = (body) => {
    const text = body.messages[0].content;
    return JSON.parse(text.slice(text.indexOf("<candidates>\n") + 13, text.indexOf("\n</candidates>")));
  };
  const ask = (app, who, body) => app.call("/api/ai/suggest", { lang: "en", ...body }, who);
  const match = (app, who, text, over = {}) =>
    ask(app, who, { mode: "match", text, city: "Lalitpur", budget: null, ...over });

  test("matching uses Claude's picks and drops anyone it made up", async (t) => {
    const fake = await fakeClaude(t, (body) => {
      const tutor = candidates(body).find((c) => c.skills.includes("Tutoring"));
      return {
        picks: [
          { id: "c999", why: "Invented" },
          { id: tutor.id, why: "Teaches maths for class 10." },
        ],
      };
    });
    const app = await App.create(t, { demo: true, env: fake.env });
    const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
    const r = await match(app, mina, "A maths teacher for class 10, call 9812345678");
    assert.equal(r.json.source, "ai");
    assert.deepEqual(
      r.json.people.map((p) => p.id),
      ["sunita-k"],
    );
    assert.equal(r.json.people[0].why, "Teaches maths for class 10.");

    const { url, beta, body } = fake.seen[0];
    assert.match(url, /^\/v1\/messages/);
    assert.match(beta, /server-side-fallback-2026-07-01/);
    assert.equal(body.model, "claude-opus-5-5");
    assert.equal(body.fallbacks, "default");
    assert.equal(body.output_config.format.type, "json_schema");
    assert.ok(!("temperature" in body) && !("thinking" in body) && !("tool_choice" in body));
    const sent = JSON.stringify(body);
    for (const hidden of ["Sunita", "sunita-k", "Mina", "9812345678", "9800000001"])
      assert.ok(!sent.includes(hidden), `sent ${hidden}`);
  });

  test("coaching returns skills, steps and teachers from Saksham", async (t) => {
    const fake = await fakeClaude(t, (body) => ({
      summary: "You can start small.",
      skills: [
        {
          category: "web-design",
          why: "It fits online work.",
          steps: ["Learn HTML", "Build one site", "Apply"],
          teachers: [candidates(body).find((c) => c.skills.includes("Websites & design")).id, "c999"],
        },
      ],
    }));
    const app = await App.create(t, { demo: true, env: fake.env });
    const hari = (await app.call("/api/auth/demo", { persona: "hari" })).cookie;
    const r = await ask(app, hari, { mode: "coach", text: "I want online computer work" });
    assert.equal(r.json.source, "ai");
    assert.equal(r.json.skills[0].category, "web-design");
    assert.equal(r.json.skills[0].steps.length, 3);
    assert.equal(r.json.skills[0].teachers.length, 1);
  });

  for (const [name, opts] of [
    ["a refusal", { stop: "refusal" }],
    ["an API error", { status: 500 }],
    ["a cut-off answer", { stop: "max_tokens" }],
  ]) {
    test(`${name} falls back to simple matching`, async (t) => {
      const fake = await fakeClaude(t, () => ({ picks: [] }), opts);
      const app = await App.create(t, { demo: true, env: fake.env });
      const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
      const r = await match(app, mina, "maths teacher");
      assert.equal(r.json.source, "fallback");
      assert.equal(r.json.people[0].id, "sunita-k");
    });
  }

  test("without a key it still suggests the right people", async (t) => {
    const app = await App.create(t, { demo: true });
    const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
    for (const [need, first] of [
      ["I need a maths teacher for my daughter", "sunita-k"],
      ["electrician to fix wiring", "ramesh-electric"],
      ["plumber for a leaking pipe", "lakeside-plumbing"],
      ["I want to see someone about a leaking tap", "lakeside-plumbing"],
      ["पानीको धारा चुहियो", "lakeside-plumbing"],
      ["गणित पढाउने शिक्षक चाहियो", "sunita-k"],
    ]) {
      const r = await match(app, mina, need, { city: "" });
      assert.equal(r.json.source, "fallback");
      assert.equal(r.json.people[0]?.id, first, need);
    }
    assert.equal((await match(app, mina, "xqzv blorp")).json.people.length, 0, "nobody is a good answer");
    const plan = await ask(app, mina, { mode: "coach", text: "I want to build websites" });
    assert.equal(plan.json.skills[0].category, "web-design");
    assert.ok(plan.json.skills[0].teachers.length > 0);
  });

  test("real accounts are only shown real applicants", async (t) => {
    const app = await signedIn(t, { demo: true });
    const r = await match(app, app.client, "plumber for a tap", { city: "" });
    const real = new Set([app.users.pro.id, app.users.pro2.id]);
    assert.ok(r.json.people.length > 0);
    for (const p of r.json.people) assert.ok(real.has(p.id), p.id);
  });

  test("bad input and signed-out visitors are refused", async (t) => {
    const app = await signedIn(t);
    assert.equal((await match(app, "", "maths teacher")).status, 401);
    assert.equal((await match(app, app.client, "x")).status, 422);
    assert.equal((await match(app, app.client, "maths teacher", { budget: -1 })).status, 422);
    assert.equal((await match(app, app.client, "maths teacher", { city: "toString" })).status, 422);
  });

  test("the daily limit stops spending", async (t) => {
    const fake = await fakeClaude(t, () => ({ picks: [] }));
    const app = await App.create(t, { demo: true, env: { ...fake.env, AI_DAILY_LIMIT: "2" } });
    const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
    for (let i = 0; i < 4; i++) await match(app, mina, "maths teacher");
    assert.equal(fake.seen.length, 2);
  });
});

describe("open public demo", () => {
  const open = { RENDER: "true", PUBLIC_DEMO: "true" };

  test("anyone can open it, sign up and sign in, but nothing can be uploaded", async (t) => {
    const app = await App.create(t, { demo: true, env: open });
    const home = await app.call("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /data-public-demo/);
    for (const page of ["/login", "/signup", "/forgot-mpin"]) assert.equal((await app.call(page)).status, 200, page);

    const phone = "9812121212";
    const { devCode } = (await app.call("/api/auth/otp/request", { phone, purpose: "signup" })).json;
    const verified = await app.call("/api/auth/otp/verify", { phone, purpose: "signup", code: devCode });
    const body = { name: "Demo Visitor", city: "Kathmandu", role: "client", mpin: "8264", acceptTerms: true };
    assert.equal((await app.call("/api/auth/register", body, verified.cookie)).status, 200, "sign-up works");
    assert.equal((await app.call("/api/auth/login", { phone, mpin: "8264" })).status, 200, "sign-in works");
    await app.call("/api/auth/demo", { persona: "mina" }); // creates the example accounts
    const mina = await app.call("/api/auth/login", { phone: "9800000001", mpin: "2468" });
    assert.equal(mina.status, 200, "an example account by number and MPIN");

    const form = new FormData();
    form.set("docType", "passport");
    const upload = await app.call("/api/verification/id", form, mina.cookie);
    assert.equal(upload.json.error, "public_demo", "nothing can be uploaded");

    const manage = (b) => app.call("/api/admin/manage", b, mina.cookie);
    const controls = { action: "controls", signups: true, posting: true, applying: true, maintenance: true, maxOnline: 0 };
    assert.equal((await manage(controls)).json.error, "public_demo", "can't switch the site off");
    const bikash = app.db().users.find((u) => u.name === "Bikash Tamang");
    const suspend = { action: "suspend", userId: bikash?.id ?? randomUUID(), reason: "test" };
    assert.equal((await manage(suspend)).json.error, "public_demo");
    assert.equal((await app.call("/admin", null, mina.cookie)).status, 200, "can still look around");
  });

  test("without PUBLIC_DEMO a demo on Render stays locked, and a password still wins", async (t) => {
    const locked = await App.create(t, { demo: true, env: { RENDER: "true" } });
    assert.equal((await locked.call("/")).status, 503);
    await locked.stop();
    const withPassword = await App.create(t, {
      demo: true,
      env: { ...open, SITE_PASSWORD: "a-long-test-password-123" },
    });
    assert.equal((await withPassword.call("/")).status, 401);
  });
});

describe("my profile", () => {
  test("shows my skills, and I can change them", async (t) => {
    const app = await App.create(t);
    await app.everyone();
    const page = await app.call("/profile/me", null, app.pro);
    assert.equal(page.status, 200);
    assert.match(page.text, /data-skill="plumbing"/);
    assert.doesNotMatch(page.text, /Fair price/, "no price on the skill cards");
    const save = (categories, who = app.pro) => app.call("/api/profile", { categories }, who);
    assert.equal((await save(["coding", "tutoring"])).status, 200);
    assert.deepEqual(app.db().users.find((u) => u.id === app.users.pro.id).categories, ["coding", "tutoring"]);
    assert.equal((await save([])).json.error, "categories_required", "an applicant keeps at least one");
    assert.equal((await save(["not-a-skill"])).status, 422);
    assert.equal((await save([], app.client)).status, 200, "a recruiter may have none");
    assert.equal((await app.call(`/profile/${app.users.pro.id}`, null, app.pro)).status, 200);
    assert.equal((await save(["coding"], "")).status, 401);
  });
});
