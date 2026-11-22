// What keeps a 512 MB host (Render Free) from running out of memory.
import assert from "node:assert/strict";
import { test } from "node:test";
import { App, requireFromApp } from "./harness.mjs";

async function selfie(t, env) {
  const app = await App.create(t, {
    env,
    prepare: (a, db) => {
      db.verifications = db.verifications.filter((v) => v.userId !== a.users.pro.id);
      db.users.find((u) => u.id === a.users.pro.id).verified = false;
    },
  });
  const who = await app.login("pro");
  const sharp = requireFromApp("sharp");
  // No face in it, so automatic matching, when it runs, answers no_face.
  const picture = await sharp({ create: { width: 700, height: 500, channels: 3, background: "#88aacc" } })
    .jpeg()
    .toBuffer();
  const form = (name, extra = {}) => {
    const f = new FormData();
    f.set("consent", "yes");
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    f.set(name, new File([picture], `${name}.jpg`, { type: "image/jpeg" }));
    return f;
  };
  assert.equal(
    (await app.call("/api/verification/id", form("front", { docType: "passport" }), who)).status,
    200,
  );
  return { app, result: await app.call("/api/verification/selfie", form("selfie"), who) };
}

test("photos are served as they are, never resized on the server", async (t) => {
  const app = await App.create(t, { demo: true });
  for (const page of ["/", "/login", "/credits"]) {
    const { status, text } = await app.call(page);
    assert.equal(status, 200, page);
    assert.doesNotMatch(text, /_next\/image/, page);
  }
  const who = (await app.call("/api/auth/demo", { persona: "mina" })).cookie;
  assert.doesNotMatch((await app.call("/profile/bikash-tamang", null, who)).text, /_next\/image/);
  const resizer = await app.call("/_next/image?url=%2Fphotos%2Fbarber-shop.webp&w=640&q=75");
  assert.equal(resizer.status, 404, "the resizer must be off, even if someone calls it directly");
  assert.equal((await app.call("/photos/barber-shop.webp")).status, 200);
});

test("on Render a selfie waits for an admin, who can verify it", async (t) => {
  const { app, result } = await selfie(t, { RENDER: "true" });
  assert.equal(result.status, 200);
  assert.equal(result.json.match, "manual");
  assert.equal(result.json.status.selfie.status, "pending");

  const admin = await app.login("admin");
  const userId = app.users.pro.id;
  for (const kind of ["id", "selfie"]) {
    const r = await app.call("/api/verification/review", { userId, kind, decision: "verified" }, admin);
    assert.equal(r.status, 200, kind);
  }
  assert.equal(app.db().users.find((u) => u.id === userId).verified, true);
});

test("FACE_MATCH=off sends selfies to review anywhere", async (t) => {
  const { result } = await selfie(t, { FACE_MATCH: "off" });
  assert.equal(result.json.match, "manual");
});

test("FACE_MATCH=on matches automatically, also on Render", async (t) => {
  const { result } = await selfie(t, { RENDER: "true", FACE_MATCH: "on" });
  assert.equal(result.json.error, "no_face");
});

test("a laptop keeps automatic matching", async (t) => {
  const { result } = await selfie(t, { FACE_MATCH: "" });
  assert.equal(result.json.error, "no_face");
});
