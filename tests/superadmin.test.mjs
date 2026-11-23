// The Super Admin dashboard: only the admin account can open it, the payment numbers it shows, withdrawal review,
// finance holds, disputes, and the demo. Money must follow the existing milestone rules exactly.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { App } from "./harness.mjs";

const PAGES = [
  "/superadmin",
  "/superadmin/payments",
  "/superadmin/releases",
  "/superadmin/releases?view=escrow",
  "/superadmin/releases?view=decided",
  "/superadmin/applicants",
  "/superadmin/customers",
  "/superadmin/bookings",
  "/superadmin/disputes",
  "/superadmin/transactions",
  "/superadmin/reports",
  "/superadmin/settings",
];

async function signedIn(t, opts) {
  const app = await App.create(t, opts);
  await app.everyone();
  return app;
}

const sa = (app, body, who = app.admin) => app.call("/api/superadmin", body, who);
const csv = async (app, kind, who = app.admin) => {
  const r = await app.call(`/api/superadmin/export?kind=${kind}`, null, who);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  const [head, ...rows] = r.text
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n")
    .map((l) => l.split(","));
  return rows.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i]])));
};
const withdraw = (app, amount, who = app.pro) =>
  app.call("/api/wallet", { action: "payout", amount, method: "esewa_sandbox" }, who);
const reviewOn = async (app) =>
  assert.equal((await sa(app, { action: "settings", payoutReview: true })).status, 200);
/** The dashboard frame is on the page (a streamed 404 can't change its status code, so check the content). */
const isPage = (r) => /data-sa=/.test(r.text);

describe("who can open it", () => {
  test("only the admin account: customers and applicants get nothing, pages or API", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking();
    for (const url of PAGES) {
      const ok = await app.call(url, null, app.admin);
      assert.equal(ok.status, 200, url);
      assert.ok(isPage(ok), url);
      for (const who of [app.client, app.pro, ""]) {
        const r = await app.call(url, null, who);
        assert.ok(!isPage(r), `${url} opened for a non-admin`);
        assert.doesNotMatch(r.text, /data-stat=/, url);
      }
    }
    assert.ok(isPage(await app.call(`/superadmin/payments/${b.id}`, null, app.admin)));
    for (const who of [app.client, app.pro]) {
      assert.equal((await sa(app, { action: "settings", payoutReview: false }, who)).status, 404);
      assert.equal(
        (await sa(app, { action: "hold", bookingId: b.id, hold: true, reason: "check" }, who)).status,
        404,
      );
      assert.equal((await app.call("/api/superadmin/export?kind=transactions", null, who)).status, 404);
    }
  });

  test("an admin who is suspended can't get in", async (t) => {
    const app = await signedIn(t);
    await app.restartWith((db) => {
      db.users.find((u) => u.id === app.users.admin.id).suspended = {
        at: new Date().toISOString(),
        by: "x",
        reason: "test",
      };
    });
    assert.ok(!isPage(await app.call("/superadmin", null, app.admin)));
  });
});

describe("payment numbers", () => {
  test("10,000: 50 in → 30 out, 20 held; 50 in → 30 out, 40 held; approval → 40 out", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(10_000);
    const row = async () => (await csv(app, "payments"))[0];

    let r = await row();
    assert.deepEqual(
      [r.Total, r.Received, r.Released, r.Held, r.Remaining],
      ["10000", "5000", "3000", "2000", "5000"],
    );
    assert.equal(r["Applicant amount"], "10000", "the whole price is the applicant's");

    await b.half();
    await b.second();
    r = await row();
    assert.deepEqual([r.Received, r.Released, r.Held, r.Remaining], ["10000", "6000", "4000", "0"]);

    await b.deliver();
    await b.release();
    r = await row();
    assert.deepEqual([r.Released, r.Held, r["Payment status"]], ["10000", "0", "Completed"]);

    const tx = await csv(app, "transactions");
    const of = (type) =>
      tx
        .filter((x) => x.Type === type)
        .map((x) => Number(x["Amount (NPR)"]))
        .sort((a, b) => a - b);
    assert.deepEqual(of("Customer payment"), [5000, 5000]);
    assert.deepEqual(of("Escrow deposit"), [2000, 4000], "the 20% and then the 40% are held");
    assert.deepEqual(of("Escrow release"), [3000, 3000, 4000]);
    assert.deepEqual(of("Platform fee"), [1000], "only the posting fee is revenue; escrow never is");
    assert.ok(
      tx.every((x) => /^TX-[0-9A-F]{10}$/.test(x["Transaction ID"])),
      "every row has an id",
    );
    assert.equal(new Set(tx.map((x) => x["Transaction ID"])).size, tx.length, "ids are unique");
  });

  test("the overview shows escrow as held, never as revenue", async (t) => {
    const app = await signedIn(t);
    await app.booking(10_000);
    const page = (await app.call("/superadmin", null, app.admin)).text;
    const stat = (label) => page.match(new RegExp(`data-stat="${label}"[\\s\\S]*?<dd[^>]*>([^<]+)<`))?.[1];
    assert.equal(stat("Received from customers"), "Rs. 5,000");
    assert.equal(stat("Distributed to applicants"), "Rs. 3,000");
    assert.equal(stat("Held by Saksham"), "Rs. 5,000", "2,000 in escrow + 3,000 not yet withdrawn");
    assert.equal(stat("Saksham revenue"), "Rs. 1,000", "the posting fee only");
  });

  test("CSV cells can't run as spreadsheet formulas", async (t) => {
    const app = await signedIn(t);
    await app.booking();
    for (const kind of ["transactions", "payments", "payouts", "monthly"]) {
      const r = await app.call(`/api/superadmin/export?kind=${kind}`, null, app.admin);
      assert.equal(r.status, 200, kind);
      assert.doesNotMatch(r.text, /(^|,)[=+@]/m, kind);
    }
    assert.ok(
      app.db().audit.some((a) => a.action === "finance_export"),
      "downloads are logged",
    );
  });
});

describe("withdrawal review", () => {
  test("a withdrawal waits, keeps its amount reserved, and earns nothing until sent", async (t) => {
    const app = await signedIn(t);
    await reviewOn(app);
    await app.booking(10_000);
    const w = await withdraw(app, 3000);
    assert.equal(w.status, 200, w.text);
    assert.equal(w.json.payoutStatus, "requested");
    assert.equal((await withdraw(app, 100)).json.error, "payout_too_much", "the 3,000 is reserved");
    assert.deepEqual(
      (await csv(app, "transactions")).filter((x) => x.Type === "Platform fee").map((x) => x["Amount (NPR)"]),
      ["1000"],
      "no 7% until it is sent",
    );

    const approve = () => sa(app, { action: "payout", id: w.json.id, decision: "approve", reason: "" });
    assert.equal((await approve()).status, 200);
    assert.equal((await approve()).json.error, "already_decided", "never sent twice");
    const p = app.db().payouts[0];
    assert.equal(p.status, "sent_sandbox");
    assert.equal(p.review.by, app.users.admin.id);
    const fees = (await csv(app, "transactions")).filter((x) => x.Type === "Platform fee");
    assert.ok(
      fees.some((x) => x["Amount (NPR)"] === "210"),
      "now the 7% is revenue",
    );
    assert.ok(
      app.db().financeEvents.some((e) => e.action === "payout_approved" && e.adminName === "Test admin"),
    );
  });

  test("rejecting needs a reason and gives the money back", async (t) => {
    const app = await signedIn(t);
    await reviewOn(app);
    await app.booking(10_000);
    const w = await withdraw(app, 3000);
    const reject = (reason) => sa(app, { action: "payout", id: w.json.id, decision: "reject", reason });
    assert.equal((await reject("")).json.error, "reason");
    assert.equal((await reject("Name doesn't match the eSewa account")).status, 200);
    assert.equal(app.db().payouts[0].status, "rejected");
    assert.equal((await withdraw(app, 3000)).status, 200, "the balance is back");
    assert.ok(
      app.db().notifications.some((n) => n.code === "payout_rejected" && n.userId === app.users.pro.id),
    );
  });

  test("hold, then decide; a stale MPIN is refused", async (t) => {
    const app = await signedIn(t);
    await reviewOn(app);
    await app.booking(10_000);
    const w = await withdraw(app, 1000);
    const act = (decision, who = app.admin, reason = "Checking documents") =>
      sa(app, { action: "payout", id: w.json.id, decision, reason }, who);
    assert.equal((await act("hold", app.staleCookie("admin"))).json.error, "reauth_required");
    assert.equal((await act("hold")).status, 200);
    assert.equal((await act("hold")).json.error, "already_on_hold");
    assert.equal((await act("approve", app.admin, "")).status, 200);
  });

  test("the admin can't approve their own withdrawal", async (t) => {
    const app = await signedIn(t);
    await reviewOn(app);
    await app.restartWith((db) => {
      const admin = db.users.find((u) => u.id === app.users.admin.id);
      admin.roles = ["client", "provider"];
    });
    const task = await app.task();
    const bid = (await app.offer(task, 5000, "I can do it", app.admin)).json.id;
    await app.act(task, bid, { action: "accept", amount: 5000 });
    assert.equal(
      (await app.call("/api/bookings", { taskId: task, method: "esewa_sandbox" }, app.client)).status,
      200,
    );
    const mine = await withdraw(app, 1000, app.admin);
    assert.equal(mine.status, 200, mine.text);
    const r = await sa(app, { action: "payout", id: mine.json.id, decision: "approve", reason: "" });
    assert.equal(r.json.error, "own_payout");
  });

  test("with review off, withdrawals are sent at once as before", async (t) => {
    const app = await signedIn(t);
    await app.booking(10_000);
    assert.equal((await withdraw(app, 1000)).json.payoutStatus, "sent_sandbox");
  });
});

describe("finance holds", () => {
  test("a hold stops releases until it is lifted, and never releases anything itself", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(10_000);
    const hold = (on, reason = "Customer reported a fake ID") =>
      sa(app, { action: "hold", bookingId: b.id, hold: on, reason });
    assert.equal((await hold(true, "")).json.error, "reason");
    assert.equal((await hold(true)).status, 200);
    assert.equal((await hold(true)).json.error, "already_on_hold");
    const before = JSON.stringify(app.db().bookings[0].installments);

    await b.half();
    const second = await b.second();
    assert.equal(second.status, 409);
    assert.equal(second.json.error, "finance_hold", "the 2nd 50% would release 30%, so it waits");
    assert.equal(JSON.stringify(app.db().bookings[0].installments), before, "no money moved");

    assert.equal((await hold(false, "")).status, 200);
    assert.equal((await b.second()).status, 200);
    await b.deliver();
    await hold(true);
    assert.equal((await b.release()).json.error, "finance_hold");
    await hold(false, "");
    assert.equal((await b.release()).status, 200);
    assert.equal(app.db().bookings[0].status, "completed");
    assert.deepEqual(
      app.db().financeEvents.map((e) => e.action),
      ["booking_held", "booking_unheld", "booking_held", "booking_unheld"],
    );
    assert.ok(
      app.db().notifications.some((n) => n.code === "booking_on_hold" && n.userId === app.users.client.id),
    );
  });

  test("a finished booking can't be held", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(4000);
    await b.finish();
    const r = await sa(app, { action: "hold", bookingId: b.id, hold: true, reason: "late check" });
    assert.equal(r.json.error, "booking_closed");
  });
});

describe("disputes", () => {
  test("a refund returns only what is still held, once", async (t) => {
    const app = await signedIn(t);
    const b = await app.booking(10_000);
    const d = await app.call(
      `/api/bookings/${b.id}/dispute`,
      { action: "open", reason: "Never showed up", wanted: "refund" },
      app.client,
    );
    assert.equal(d.status, 200, d.text);
    const decide = (who) => sa(app, { action: "dispute", bookingId: b.id, outcome: "refund" }, who);
    assert.equal((await decide(app.pro)).status, 404);
    assert.equal((await decide(app.admin)).status, 200);
    const refunds = app.db().receipts.filter((r) => r.kind === "refund");
    assert.deepEqual(
      refunds.map((r) => r.amount),
      [2000],
      "the 20% held; the 30% already paid stays paid",
    );
    assert.equal((await decide(app.admin)).json.error, "no_dispute", "only once");
    const ev = app.db().financeEvents.find((e) => e.action === "dispute_refund");
    assert.equal(ev.amount, 2000);
    assert.equal(ev.adminName, "Test admin");
  });
});

describe("demo mode", () => {
  test("sample bookings follow the real rules and Mina can act on them", async (t) => {
    const app = await App.create(t, { demo: true });
    const sign = async (persona) => (await app.call("/api/auth/demo", { persona })).cookie;
    const mina = await sign("mina");
    assert.ok(isPage(await app.call("/superadmin", null, mina)), "Mina is the demo Super Admin");
    const bikash = await sign("bikash");
    assert.ok(!isPage(await app.call("/superadmin", null, bikash)), "applicants can't open it");

    assert.equal((await sa(app, { action: "settings", payoutReview: true }, mina)).status, 200);
    const seeded = await sa(app, { action: "seed" }, mina);
    assert.equal(seeded.status, 200, seeded.text);
    assert.equal(seeded.json.bookings, 9);
    assert.equal((await sa(app, { action: "seed" }, mina)).json.error, "already_seeded");
    assert.equal((await sa(app, { action: "seed" }, bikash)).status, 404);

    const db = app.db();
    for (const b of db.bookings) {
      const sum = (kind) =>
        db.receipts.filter((r) => r.bookingId === b.id && r.kind === kind).reduce((n, r) => n + r.amount, 0);
      const held = b.installments
        .filter((i) => i.state === "held" || i.state === "delivered")
        .reduce((n, i) => n + i.amount, 0);
      assert.equal(
        sum("hold"),
        sum("release") + held + sum("refund"),
        `every rupee is accounted for: ${b.id}`,
      );
    }
    const waiting = db.payouts.filter((p) => p.status === "requested");
    assert.equal(waiting.length, 3);
    const r = await sa(app, { action: "payout", id: waiting[0].id, decision: "approve", reason: "" }, mina);
    assert.equal(r.status, 200, r.text);

    assert.match(
      (await app.call("/superadmin", null, mina)).text,
      /simulated sandbox money/,
      "labelled as demo money",
    );
    for (const url of PAGES) assert.ok(isPage(await app.call(url, null, mina)), url);
  });
});
