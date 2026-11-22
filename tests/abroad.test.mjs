// "Hire from abroad → hire Nepalis abroad": the rules, the money, the profiles and the demo.
import assert from "node:assert/strict";
import { test } from "node:test";
import { App, sleep } from "./harness.mjs";

const PAY = 50_000;

async function setup(t) {
  const app = await App.create(t);
  await app.everyone();
  app.pro2 = await app.login("pro2");
  return app;
}

async function post(app, over = {}, who = app.client) {
  return app.call(
    "/api/abroad/jobs",
    {
      title: "Villa renovation helpers",
      details: "Tiles and carrying",
      category: "construction",
      country: "Qatar",
      city: "Doha",
      workersNeeded: 2,
      days: 30,
      payPerWorker: PAY,
      ...over,
    },
    who,
  );
}

const act = (app, job, body, who) => app.call(`/api/abroad/jobs/${job}`, body, who);
const stored = (app, job) => app.db().abroadJobs.find((j) => j.id === job);
const applicationOf = (app, job, key) =>
  stored(app, job).applications.find((a) => a.userId === app.users[key].id);

async function apply(app, job, key, note = "I live here") {
  const r = await act(app, job, { action: "apply", note, eligible: true }, app[key]);
  assert.equal(r.status, 200, r.text.slice(0, 200));
}

const hire = (app, job, key, amount = PAY, who = app.client) =>
  act(app, job, { action: "hire", applicationId: applicationOf(app, job, key).id, amount }, who);

async function finish(app, bookingId, key) {
  const installmentId = app.db().bookings.find((b) => b.id === bookingId).installments[0].id;
  const url = `/api/bookings/${bookingId}`;
  assert.equal((await app.call(url, { action: "deliver", installmentId }, app[key])).status, 200);
  assert.equal((await app.call(url, { action: "release", installmentId }, app.client)).status, 200);
}

/** The public list only, not "Your jobs abroad". */
async function listed(app, job, who, query = "") {
  const { text } = await app.call(`/abroad?for=workers${query}`, null, who);
  assert.match(text, /Open jobs abroad/, "the board didn't render");
  // Not the <li>s: React may stream those after the closing </ul>.
  const ids = text.match(/<ul[^>]*data-jobs="([^"]*)"/)?.[1] ?? "";
  return ids.split(" ").includes(job);
}

test("Hire from abroad shows both options", async (t) => {
  const app = await setup(t);
  for (const choice of ["family", "workers"]) {
    const { status, text } = await app.call(`/abroad?for=${choice}`, null, app.client);
    assert.equal(status, 200);
    assert.match(text, /For family in Nepal/);
    assert.match(text, /Hire Nepalis abroad/);
  }
});

test("a job leaves the list when every place is filled, and stays on both profiles", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  await apply(app, job, "pro");
  await apply(app, job, "pro2");
  assert.ok(await listed(app, job, app.pro));

  assert.equal((await hire(app, job, "pro")).status, 200);
  assert.ok(await listed(app, job, app.pro), "one place is still free");
  assert.equal((await hire(app, job, "pro2")).status, 200);
  for (const who of [app.client, app.pro, app.admin])
    assert.equal(await listed(app, job, who), false, "filled jobs are off the list");

  for (const key of ["client", "pro", "pro2"]) {
    const profile = await app.call(`/profile/${app.users[key].id}`, null, app.admin);
    assert.equal(profile.status, 200, key);
    assert.ok(profile.text.includes(job), `${key}'s profile keeps the job`);
  }
});

test("each hire is a full Visa payment into escrow", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  await apply(app, job, "pro");
  const r = await hire(app, job, "pro");
  assert.equal(r.status, 200);
  const db = app.db();
  const booking = db.bookings.find((b) => b.id === r.json.bookingId);
  assert.equal(booking.method, "card_sandbox");
  assert.equal(booking.total, PAY);
  assert.deepEqual(
    booking.installments.map((i) => i.state),
    ["held"],
  );
  assert.match(r.json.ref, /^CARD-SBX-/);
  assert.equal(db.receipts.length, 1);
  assert.equal(db.receipts[0].amount, PAY);
});

test("a card number is never accepted or stored", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  await apply(app, job, "pro");
  const applicationId = applicationOf(app, job, "pro").id;
  const body = { action: "hire", applicationId, amount: PAY, cardNumber: "4242424242424242" };
  assert.equal((await act(app, job, body, app.client)).status, 422);
  assert.equal(app.db().bookings, undefined);
  assert.ok(!JSON.stringify(app.db()).includes("4242424242424242"));
});

test("two hires at once cannot overfill a job", async (t) => {
  const app = await setup(t);
  const job = (await post(app, { workersNeeded: 1 })).json.id;
  await apply(app, job, "pro");
  await apply(app, job, "pro2");
  const both = await Promise.all([hire(app, job, "pro"), hire(app, job, "pro2")]);
  assert.equal(both.filter((r) => r.status === 200).length, 1);
  assert.equal(app.db().bookings.length, 1);
  assert.equal(app.db().receipts.length, 1);
});

test("one applicant is charged once, however often Pay is pressed", async (t) => {
  const app = await setup(t);
  const job = (await post(app, { workersNeeded: 3 })).json.id;
  await apply(app, job, "pro");
  const all = await Promise.all([1, 2, 3, 4].map(() => hire(app, job, "pro")));
  assert.equal(all.filter((r) => r.status === 200).length, 1);
  assert.equal(app.db().receipts.length, 1);
});

test("completed work leaves the list, can be reopened, and closes again when done", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  await apply(app, job, "pro");
  await apply(app, job, "pro2");

  await finish(app, (await hire(app, job, "pro")).json.bookingId, "pro");
  assert.equal(await listed(app, job, app.pro2), false, "completed by someone: off the list");
  assert.equal((await hire(app, job, "pro2")).json.error, "not_open");
  const profile = await app.call(`/profile/${app.users.pro.id}`, null, app.pro);
  assert.match(profile.text, /46,500/, "the worker sees their pay after the 7% fee");
  const others = await app.call(`/profile/${app.users.pro.id}`, null, app.pro2);
  assert.doesNotMatch(others.text, /46,500/, "others don't");

  assert.equal((await act(app, job, { action: "reopen" }, app.client)).status, 200);
  assert.ok(await listed(app, job, app.pro2));
  await finish(app, (await hire(app, job, "pro2")).json.bookingId, "pro2");
  assert.equal(await listed(app, job, app.admin), false);
  assert.equal((await act(app, job, { action: "reopen" }, app.client)).json.error, "cannot_reopen");
});

test("a refunded hire frees the place again", async (t) => {
  const app = await setup(t);
  const job = (await post(app, { workersNeeded: 1 })).json.id;
  await apply(app, job, "pro");
  const { bookingId } = (await hire(app, job, "pro")).json;
  assert.equal(await listed(app, job, app.pro2), false);
  const url = `/api/bookings/${bookingId}/dispute`;
  await app.call(url, { action: "open", reason: "The worker could not come", wanted: "refund" }, app.client);
  assert.equal((await app.call(url, { action: "resolve", outcome: "refund" }, app.admin)).status, 200);
  assert.ok(await listed(app, job, app.pro2));
});

test("closing takes a job off the list and reopening brings it back", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  assert.equal((await act(app, job, { action: "close" }, app.pro)).status, 403);
  assert.equal((await act(app, job, { action: "close" }, app.client)).status, 200);
  assert.equal(await listed(app, job, app.pro), false);
  assert.equal((await act(app, job, { action: "apply", eligible: true }, app.pro)).json.error, "not_open");
  assert.equal((await act(app, job, { action: "reopen" }, app.client)).status, 200);
  assert.ok(await listed(app, job, app.pro));
});

test("who may post, apply and hire", async (t) => {
  const app = await setup(t);
  assert.equal((await post(app, {}, app.pro)).json.error, "client_only");
  const job = (await post(app)).json.id;
  assert.equal(
    (await act(app, job, { action: "apply", eligible: false }, app.pro)).json.error,
    "eligibility",
  );
  assert.equal(
    (await act(app, job, { action: "apply", eligible: true }, app.admin)).json.error,
    "provider_only",
  );
  await apply(app, job, "pro");
  assert.equal(
    (await act(app, job, { action: "apply", eligible: true }, app.pro)).json.error,
    "already_applied",
  );
  assert.equal((await hire(app, job, "pro", PAY, app.pro2)).status, 403, "only the recruiter hires");
  assert.equal((await hire(app, job, "pro", PAY - 1)).json.error, "price_changed");
  assert.equal((await act(app, job, { action: "withdraw" }, app.pro)).status, 200);
  assert.equal((await hire(app, job, "pro")).json.error, "not_pending");
  await apply(app, job, "pro");
  const applicationId = applicationOf(app, job, "pro").id;
  assert.equal((await act(app, job, { action: "decline", applicationId }, app.client)).status, 200);
  assert.equal(
    (await act(app, job, { action: "apply", eligible: true }, app.pro)).json.error,
    "already_applied",
  );
  assert.equal(app.db().bookings, undefined, "nothing was charged");
});

test("bad job details are refused", async (t) => {
  const app = await setup(t);
  const bad = [
    { workersNeeded: 0 },
    { workersNeeded: 51 },
    { days: 61 },
    { payPerWorker: 999 },
    { payPerWorker: 1_000_001 },
    { country: "Atlantis" },
    { title: "  " },
  ];
  for (const over of bad) assert.equal((await post(app, over)).status, 422, JSON.stringify(over));
});

test("a hire's pay and applicants' notes are private", async (t) => {
  const app = await setup(t);
  const job = (await post(app)).json.id;
  await apply(app, job, "pro", "Call 9812345678 about my night shifts");
  assert.match(applicationOf(app, job, "pro").note, /••••/, "phone numbers are masked");

  const other = await app.call(`/abroad/jobs/${job}`, null, app.pro2);
  assert.equal(other.status, 200);
  assert.doesNotMatch(other.text, /night shifts/);

  await hire(app, job, "pro");
  const task = applicationOf(app, job, "pro").taskId;
  assert.equal((await app.call(`/api/tasks/${task}/live`, null, app.pro2)).status, 404);
  assert.equal((await app.call(`/api/tasks/${task}/live`, null, app.pro)).status, 200);
  assert.equal((await app.offer(task, PAY, "me instead", app.pro2)).status, 404);
  const explore = await app.call("/explore", null, app.pro2);
  assert.ok(!explore.text.includes(task), "hires never appear in Browse tasks");
});

test("the demo has open, part-filled, filled and completed jobs, and its whole flow works", async (t) => {
  const app = await App.create(t, { demo: true });
  const demo = async (persona) => {
    const r = await app.call("/api/auth/demo", { persona });
    assert.equal(r.status, 200, persona);
    return r.cookie;
  };
  // Several sign-ins at once must not seed twice.
  await Promise.all([demo("suman"), demo("hari"), demo("gita")]);
  const [suman, hari, gita] = [await demo("suman"), await demo("hari"), await demo("gita")];
  assert.equal(app.db().abroadJobs.length, 7);
  assert.equal(app.db().bookings.length, 5);
  assert.equal(app.db().ratings.length, 2);

  const id = (n) => `a0000000-0000-4000-8000-00000000000${n}`;
  const [villa, electrician, driver, cleaning, catering] = [1, 2, 3, 4, 5].map(id);
  for (const job of [villa, electrician, driver]) assert.ok(await listed(app, job, hari), job);
  for (const job of [cleaning, catering]) assert.equal(await listed(app, job, hari), false, job);
  assert.equal(await listed(app, driver, hari, "&country=Malaysia"), false, "the country filter");

  for (const [who, cookie] of [
    ["suman", suman],
    ["hari", hari],
    ["gita", gita],
  ]) {
    for (const url of ["/abroad?for=workers", `/abroad/jobs/${villa}`, "/wallet", "/my-tasks", "/messages"])
      assert.equal((await app.call(url, null, cookie)).status, 200, `${who} ${url}`);
  }
  assert.equal((await act(app, driver, { action: "apply", eligible: true }, hari)).status, 200);

  for (const a of stored(app, villa).applications.filter((x) => x.status === "pending")) {
    const r = await act(app, villa, { action: "hire", applicationId: a.id, amount: 75_000 }, suman);
    assert.equal(r.status, 200);
  }
  assert.equal(await listed(app, villa, hari), false, "3 of 3: off the list");

  const before = app.db();
  for (const a of stored(app, cleaning).applications) {
    const b = before.bookings.find((x) => x.taskId === a.taskId);
    const body = { action: "release", installmentId: b.installments[0].id };
    assert.equal((await app.call(`/api/bookings/${b.id}`, body, suman)).status, 200);
  }
  const me = before.users.find((u) => u.name === "Suman Gurung").id;
  const profile = await app.call(`/profile/${me}`, null, hari);
  for (const job of [villa, cleaning, catering]) assert.ok(profile.text.includes(job), job);
});

test("an admin demo reset rebuilds the abroad demo", async (t) => {
  const app = await App.create(t, { demo: true });
  const mina = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
  assert.equal((await app.call("/api/admin", { action: "reset-demo" }, mina)).status, 200);
  await sleep(100);
  const db = app.db();
  assert.equal(db.abroadJobs.length, 7);
  assert.equal(db.bookings.length, 5);
  const users = new Set(db.users.map((u) => u.id));
  for (const job of db.abroadJobs) assert.ok(users.has(job.clientId), "no job points at a deleted account");
});

test("real accounts don't see demo jobs", async (t) => {
  const app = await App.create(t, { demo: true });
  await app.call("/api/auth/demo", { persona: "suman" });
  const pro = await app.login("pro");
  const villa = "a0000000-0000-4000-8000-000000000001";
  assert.equal(await listed(app, villa, pro), false);
  assert.equal((await act(app, villa, { action: "apply", eligible: true }, pro)).status, 404);
});
