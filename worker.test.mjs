// Real tests for the check-in persistence fix (2026-09-11): the venture's
// own spec_draft.mvp_feature describes a "structured journal," but
// /api/v1/companion/checkin previously persisted nothing anywhere. These
// exercise the real worker.js default export's fetch() handler against a
// fake KV namespace (records real get/put calls) and a mocked AuthFor /
// VendyAI fetch, not a reimplementation of the logic under test.

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

function makeFakeKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function makeEnv() {
  return { ALHENA_KV: makeFakeKV(), JWT_SECRET: "test_secret" };
}

function makeCtx() {
  return { waitUntil(p) { /* swallow background fetches in tests */ } };
}

function withMockedAuthFor(verifyResponse, testFn) {
  return async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("authfor.com/api/v1/verify")) {
        if (verifyResponse === null) return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 });
        return new Response(JSON.stringify(verifyResponse), { status: 200 });
      }
      if (u.includes("vendyai.com/api/billing/event")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return realFetch(url, opts);
    };
    try {
      await testFn();
    } finally {
      globalThis.fetch = realFetch;
    }
  };
}

test(
  "POST /api/v1/companion/checkin: anonymous (no Authorization header) is accepted but honestly reports saved:false",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkin", {
        method: "POST",
        body: JSON.stringify({ mood: "happy", energy_level: "high" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.saved, false);
    assert.match(body.note, /Sign in to save/);
    assert.equal(env.ALHENA_KV.store.size, 0);
  })
);

test(
  "POST /api/v1/companion/checkin: a real AuthFor identity persists the check-in and reports saved:true",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkin", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ mood: "anxious", energy_level: "low", notes: "rough day" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.saved, true);
    assert.equal(body.note, undefined);
    const stored = JSON.parse(env.ALHENA_KV.store.get("checkins:real-user@example.com"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].mood, "anxious");
  })
);

test(
  "POST /api/v1/companion/checkin: an invalid bearer token is treated as anonymous, not a hard failure",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkin", {
        method: "POST",
        headers: { Authorization: "Bearer garbage-token" },
        body: JSON.stringify({ mood: "neutral" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.saved, false);
  })
);

test(
  "GET /api/v1/companion/checkins: 401 with no Authorization header - unlike the checkin POST, history has no anonymous mode",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/checkins"), env, makeCtx());
    assert.equal(res.status, 401);
  })
);

test(
  "GET /api/v1/companion/checkins: a real identified user reads back only their own real stored history",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set(
      "checkins:real-user@example.com",
      JSON.stringify([{ timestamp: "2026-09-10T00:00:00.000Z", mood: "happy" }])
    );
    env.ALHENA_KV.store.set("checkins:someone-else@example.com", JSON.stringify([{ mood: "sad" }]));
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkins", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.email, "real-user@example.com");
    assert.equal(body.count, 1);
    assert.equal(body.checkins[0].mood, "happy");
  })
);

test(
  "GET /api/v1/companion/checkins: a real user with no history yet gets an empty list, not an error",
  withMockedAuthFor({ id: "u2", email: "new-user@example.com", name: "New User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkins", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 0);
    assert.deepEqual(body.checkins, []);
  })
);

test(
  "POST /api/v1/companion/checkin: MAX_STORED_CHECKINS caps history at 90 entries, dropping the oldest",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const seeded = Array.from({ length: 90 }, (_, i) => ({ timestamp: `t${i}`, mood: "neutral" }));
    env.ALHENA_KV.store.set("checkins:real-user@example.com", JSON.stringify(seeded));
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/checkin", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ mood: "happy" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const stored = JSON.parse(env.ALHENA_KV.store.get("checkins:real-user@example.com"));
    assert.equal(stored.length, 90);
    assert.equal(stored[0].timestamp, "t1");
    assert.equal(stored[89].mood, "happy");
  })
);
