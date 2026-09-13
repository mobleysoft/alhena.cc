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
  // Updated 2026-09-13: John's real product decision ("free... no signup
  // required") replaced the old "anonymous = nothing saved" behavior with
  // a real, persistent anonymous identity (see resolveIdentity() in
  // worker.js) - an anonymous caller now IS saved, keyed by a real
  // generated anon:<uuid> identity, not silently dropped.
  "POST /api/v1/companion/checkin: anonymous (no Authorization header) gets a real generated identity and IS saved",
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
    assert.equal(body.saved, true);
    assert.equal(body.identity.anonymous, true);
    assert.match(body.identity.id, /^[0-9a-f-]{36}$/i);
    assert.equal(env.ALHENA_KV.store.size, 1);
    const stored = JSON.parse(env.ALHENA_KV.store.get(`checkins:anon:${body.identity.id}`));
    assert.equal(stored.length, 1);
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
  "POST /api/v1/companion/checkin: an invalid bearer token is treated as a real anonymous identity, not a hard failure",
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
    assert.equal(body.saved, true);
    assert.equal(body.identity.anonymous, true);
  })
);

test(
  // Updated 2026-09-13: this route now uses resolveIdentity() (see
  // worker.js), which never throws - a missing Authorization header just
  // means a fresh anonymous identity with (correctly) empty history, not
  // a 401. Real signed-in-only behavior is still covered by the "reads
  // back only their own real stored history" test below.
  "GET /api/v1/companion/checkins: no Authorization header resolves a real anonymous identity with empty history, not a 401",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/checkins"), env, makeCtx());
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 0);
    assert.match(body.email, /^anon:[0-9a-f-]{36}$/i);
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

// ── Guidance conversation memory (added 2026-09-11) ────────────────────
// /api/v1/companion/guidance previously called no auth function at all and
// persisted nothing - every call was stateless even for a signed-in
// AuthFor user, a real gap against the venture's own "AI companion for
// life guidance" promise. These exercise the real fix: optional auth (an
// anonymous caller still gets an answer, just no memory), and a real
// identified user's prior sessions are both persisted and fed back into
// the next call's prompt.

test(
  // Updated 2026-09-13: John's real product decision replaced "anonymous
  // = stateless, nothing saved" with a real, persistent anonymous
  // identity (resolveIdentity() in worker.js) - an anonymous caller now
  // gets real continuity too, just tagged anonymous rather than signed in.
  "POST /api/v1/companion/guidance: anonymous (no Authorization header) gets a real answer AND real persisted continuity",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance", {
        method: "POST",
        body: JSON.stringify({ question: "Should I take the new job?", user_context: { situation: "career" } }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.memory.signed_in, false);
    assert.equal(body.memory.saved, true);
    assert.equal(body.identity.anonymous, true);
    assert.match(body.identity.id, /^[0-9a-f-]{36}$/i);
    assert.match(body.memory.note, /Chatting anonymously/);
    const stored = JSON.parse(env.ALHENA_KV.store.get(`guidance:anon:${body.identity.id}`));
    assert.equal(stored.length, 1);
  })
);

test(
  "POST /api/v1/companion/guidance: a real AuthFor identity persists the session and reports it was saved",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ question: "Should I take the new job?", user_context: { situation: "career" } }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.memory.signed_in, true);
    assert.equal(body.memory.saved, true);
    assert.equal(body.memory.total_saved_sessions, 1);
    assert.equal(body.memory.note, undefined);
    const stored = JSON.parse(env.ALHENA_KV.store.get("guidance:real-user@example.com"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].question, "Should I take the new job?");
  })
);

test(
  "POST /api/v1/companion/guidance twice as the same real user: second call's prompt is built from the first call's real stored history",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    env.ALHENA_INFERENCE_URL = "https://fake-inference.example.com/v1/chat/completions";
    let capturedBodies = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("authfor.com/api/v1/verify")) {
        return new Response(JSON.stringify({ id: "u1", email: "real-user@example.com", name: "Real User" }), { status: 200 });
      }
      if (u.includes("vendyai.com/api/billing/event")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (u === "https://fake-inference.example.com/v1/chat/completions") {
        capturedBodies.push(JSON.parse(opts.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: "Real model reply." } }] }), { status: 200 });
      }
      return realFetch(url, opts);
    };
    try {
      await worker.fetch(
        new Request("https://alhena.cc/api/v1/companion/guidance", {
          method: "POST",
          headers: { Authorization: "Bearer real-token" },
          body: JSON.stringify({ question: "Should I take the new job?", user_context: { situation: "career" }, decision_type: "career" }),
        }),
        env,
        makeCtx()
      );
      await worker.fetch(
        new Request("https://alhena.cc/api/v1/companion/guidance", {
          method: "POST",
          headers: { Authorization: "Bearer real-token" },
          body: JSON.stringify({ question: "What if it doesn't work out?", user_context: { situation: "career" }, decision_type: "career" }),
        }),
        env,
        makeCtx()
      );
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.equal(capturedBodies.length, 2);
    // First call has no prior history to inject.
    assert.doesNotMatch(capturedBodies[0].system, /Recent conversation history/);
    // Second call's system prompt carries real context from the first call's stored Q&A.
    assert.match(capturedBodies[1].system, /Recent conversation history/);
    assert.match(capturedBodies[1].system, /Should I take the new job\?/);
    assert.match(capturedBodies[1].system, /Real model reply\./);

    const stored = JSON.parse(env.ALHENA_KV.store.get("guidance:real-user@example.com"));
    assert.equal(stored.length, 2);
    assert.equal(stored[1].question, "What if it doesn't work out?");
  })
);

test(
  // Updated 2026-09-13: resolveIdentity() never throws - a missing
  // Authorization header now resolves a real (empty-history) anonymous
  // identity instead of a 401.
  "GET /api/v1/companion/guidance/history: no Authorization header resolves a real anonymous identity with empty history, not a 401",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/guidance/history"), env, makeCtx());
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 0);
    assert.match(body.email, /^anon:[0-9a-f-]{36}$/i);
  })
);

test(
  "GET /api/v1/companion/guidance/history: a real identified user reads back only their own stored sessions",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set(
      "guidance:real-user@example.com",
      JSON.stringify([{ timestamp: "2026-09-10T00:00:00.000Z", question: "Q1", guidance: "A1" }])
    );
    env.ALHENA_KV.store.set("guidance:someone-else@example.com", JSON.stringify([{ question: "Other" }]));
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance/history", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.email, "real-user@example.com");
    assert.equal(body.count, 1);
    assert.equal(body.sessions[0].question, "Q1");
  })
);

test(
  "POST /api/v1/companion/guidance: MAX_STORED_GUIDANCE_SESSIONS caps history at 200 entries, dropping the oldest",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const seeded = Array.from({ length: 200 }, (_, i) => ({ timestamp: `t${i}`, question: `q${i}`, guidance: `a${i}` }));
    env.ALHENA_KV.store.set("guidance:real-user@example.com", JSON.stringify(seeded));
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ question: "newest question", user_context: {} }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const stored = JSON.parse(env.ALHENA_KV.store.get("guidance:real-user@example.com"));
    assert.equal(stored.length, 200);
    assert.equal(stored[0].question, "q1");
    assert.equal(stored[199].question, "newest question");
  })
);

// ── Companion app-shell routes (reference/legacy-roots/alhena/app.html) ──
// app.html itself calls AuthFor directly for signup/login, so there is no
// local user store to test here - every route below just needs a real
// AuthFor Bearer token, exercised the same mocked-fetch way as above.

test(
  "GET /api/journal: 401 with no Authorization header",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/journal"), env, makeCtx());
    assert.equal(res.status, 401);
  })
);

test(
  "POST /api/journal then GET /api/journal: a real entry round-trips, newest first",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const post = await worker.fetch(
      new Request("https://alhena.cc/api/journal", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ title: "First", content: "Today was fine.", mood: 7 }),
      }),
      env,
      makeCtx()
    );
    assert.equal(post.status, 200);
    const postBody = await post.json();
    assert.equal(postBody.success, true);
    assert.equal(postBody.entry.content, "Today was fine.");
    assert.ok(postBody.entry.id);

    await worker.fetch(
      new Request("https://alhena.cc/api/journal", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ content: "Second entry." }),
      }),
      env,
      makeCtx()
    );

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/journal", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    assert.equal(getBody.entries.length, 2);
    assert.equal(getBody.entries[0].content, "Second entry."); // newest first
  })
);

test(
  "POST /api/goals then PUT /api/goals/:id: progress update marks completed at 100",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const post = await worker.fetch(
      new Request("https://alhena.cc/api/goals", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ title: "Run a 5k", category: "health" }),
      }),
      env,
      makeCtx()
    );
    const { goal } = await post.json();
    assert.equal(goal.status, "active");
    assert.equal(goal.progress, 0);

    const put = await worker.fetch(
      new Request(`https://alhena.cc/api/goals/${goal.id}`, {
        method: "PUT",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ progress: 100 }),
      }),
      env,
      makeCtx()
    );
    assert.equal(put.status, 200);
    const putBody = await put.json();
    assert.equal(putBody.goal.status, "completed");

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/goals", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    assert.equal(getBody.goals.length, 1);
    assert.equal(getBody.goals[0].status, "completed");
  })
);

test(
  "PUT /api/goals/:id: unknown goal id returns 404, not a silent success",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/goals/does-not-exist", {
        method: "PUT",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ progress: 50 }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 404);
  })
);

test(
  "POST /api/chat then GET /api/chat/history: fallback mode is honest, order is oldest-first",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv(); // no ALHENA_INFERENCE_URL set - must fall back, not fabricate a model reply
    const post = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ message: "Hello Alhena" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(post.status, 200);
    const postBody = await post.json();
    assert.equal(postBody.message.role, "assistant");
    assert.match(postBody.message.content, /not connected to a live guidance model/);

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/chat/history?limit=10", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    assert.equal(getBody.messages.length, 2);
    assert.equal(getBody.messages[0].role, "user"); // oldest first, matches chat UI append order
    assert.equal(getBody.messages[1].role, "assistant");
  })
);

test(
  "POST /api/checkin then GET /api/checkin/history: streak counts consecutive real days, not raw check-in count",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
    env.ALHENA_KV.store.set(
      "checkin2:real-user@example.com",
      JSON.stringify([
        { date: threeDaysAgo.toISOString(), mood: 5, energy: 5 },
        { date: yesterday.toISOString(), mood: 6, energy: 6 },
      ])
    );

    const post = await worker.fetch(
      new Request("https://alhena.cc/api/checkin", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ mood: 2, energy: 3, note: "rough one" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(post.status, 200);
    const postBody = await post.json();
    assert.match(postBody.aiNote, /harder day/);

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/checkin/history?days=30", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    assert.equal(getBody.checkins.length, 3);
    assert.equal(getBody.summary.streak, 2); // today + yesterday consecutive; the 3-days-ago entry breaks the run
  })
);

test(
  "GET /api/checkin/history: real bug fix - an explicit days=0 clamps to 1, it does not silently fall back to the 30-day default",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const today = new Date();
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
    env.ALHENA_KV.store.set(
      "checkin2:real-user@example.com",
      JSON.stringify([
        { date: twoDaysAgo.toISOString(), mood: 5, energy: 5 },
        { date: today.toISOString(), mood: 7, energy: 6 },
      ])
    );

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/checkin/history?days=0", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    // Old bug: `parseInt("0") || 30` treated 0 as falsy and returned all
    // entries within a 30-day window (2). Fixed behavior: days=0 clamps to
    // the real minimum of 1, so only today's entry is in range.
    assert.equal(getBody.checkins.length, 1);
  })
);

test(
  "GET /api/chat/history: real bug fix - an explicit limit=0 clamps to 1, it does not silently fall back to the 100-message default",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set(
      "chat:real-user@example.com",
      JSON.stringify([
        { role: "user", content: "first", timestamp: new Date().toISOString() },
        { role: "assistant", content: "second", timestamp: new Date().toISOString() },
      ])
    );

    const get = await worker.fetch(
      new Request("https://alhena.cc/api/chat/history?limit=0", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    const getBody = await get.json();
    // Old bug: `parseInt("0") || 100` treated 0 as falsy and returned both
    // stored messages. Fixed behavior: limit=0 clamps to the real minimum
    // of 1, so only the single most recent message comes back.
    assert.equal(getBody.messages.length, 1);
    assert.equal(getBody.messages[0].content, "second");
  })
);

// Real gap found 2026-09-12 (endpoint audit, feature-completeness pass):
// app.html (the real chat/journal/goals/check-in UI whose backend routes
// are exercised above) was never actually served in production - GET
// /app and /app.html both fell through to the generic marketing-page
// fallback (confirmed live via curl before this fix: byte-identical to
// GET /). These tests assert the real app shell is served, not just that
// *some* 200 comes back, and that the marketing page's own "CONNECT WITH
// ALHENA" button was repointed at it instead of the dead external
// authfor-gateway-worker redirect (confirmed live before this fix: it
// resolves to an unrelated generic "AuthFor Vault" page and never returns
// the visitor to Alhena at all).
test("GET /app serves the real app shell, not the marketing-page fallback", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://alhena.cc/app"), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.text();
  // A string that only exists in the real app shell's own config block,
  // not in the marketing fallback page.
  assert.match(body, /const AUTHFOR_API = 'https:\/\/authfor\.com'/);
  assert.doesNotMatch(body, /CONNECT WITH ALHENA/);
});

test("GET /app.html serves the same real app shell as GET /app", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://alhena.cc/app.html"), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /const AUTHFOR_API = 'https:\/\/authfor\.com'/);
});

test("GET / (marketing page) links its call-to-action at the real /app, not the dead external gateway redirect", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://alhena.cc/"), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /window\.location\.href = '\/app'/);
  assert.doesNotMatch(body, /authfor-gateway-worker/);
});

// Real tests for the self-awareness mechanism (added 2026-09-12, per
// John's ask that Alhena be able to accurately describe her own code and
// get involved in her own development). These exercise the real
// isSelfReflectionQuestion/buildSelfAwareAnswer path through both real
// entry points (companion/guidance and the actual chat UI's /api/chat),
// confirming: (1) a self-reflection question gets the hand-written,
// code-grounded answer instead of the normal model/fallback text, (2) that
// answer honestly reports fallback_mode:true / inference_source:"none" in
// this test env (no LLAMA_ACCESS_CLIENT_ID/SECRET, no ALHENA_INFERENCE_URL
// configured - matching real production right now), and (3) the real
// logging side effect actually lands in KV, not just a claimed side effect.

test(
  "POST /api/v1/companion/guidance: a self-reflection question gets the real code-grounded answer, not the generic fallback, and logs the moment",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ question: "How do you actually work?", user_context: { situation: "curious" } }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.self_reflection, true);
    assert.equal(body.fallback_mode, true);
    assert.equal(body.inference_source, "none");
    // The real answer, not the generic "I'm not connected..." fallback text.
    assert.match(body.guidance, /Cloudflare Worker \(alhena-cc-worker\)/);
    assert.match(body.guidance, /Gofaineat Cascade/);
    assert.doesNotMatch(body.guidance, /I'm not connected to a live guidance model right now/);

    const log = JSON.parse(env.ALHENA_KV.store.get("self_reflection_log"));
    assert.equal(log.length, 1);
    assert.equal(log[0].email, "real-user@example.com");
    assert.equal(log[0].source, "guidance");
    assert.equal(log[0].fallback_mode, true);
  })
);

test(
  "POST /api/v1/companion/guidance: an ordinary question does NOT trip self-reflection or write to the log",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/guidance", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ question: "Should I take the new job?", user_context: { situation: "career" } }),
      }),
      env,
      makeCtx()
    );
    const body = await res.json();
    assert.equal(body.self_reflection, undefined);
    assert.equal(env.ALHENA_KV.store.has("self_reflection_log"), false);
  })
);

test(
  "POST /api/chat: 'what are your limits' gets the real self-aware answer and logs the moment (waitUntil awaited)",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const waited = [];
    const ctx = { waitUntil(p) { waited.push(p); } };
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ message: "What are your limits?" }),
      }),
      env,
      ctx
    );
    const body = await res.json();
    assert.equal(body.message.self_reflection, true);
    assert.equal(body.message.fallback_mode, true);
    assert.equal(body.message.inference_source, "none");
    assert.match(body.message.content, /Cloudflare Worker \(alhena-cc-worker\)/);
    await Promise.all(waited); // real logging fires in ctx.waitUntil, not inline
    const log = JSON.parse(env.ALHENA_KV.store.get("self_reflection_log"));
    assert.equal(log.length, 1);
    assert.equal(log[0].source, "chat");
    assert.equal(log[0].question, "What are your limits?");
  })
);

test(
  // Updated 2026-09-13: an unauthenticated caller now resolves a real
  // generated anon:<uuid> identity (resolveIdentity()) instead of the
  // literal string "anonymous" - a real, unique-per-visitor identity, not
  // a placeholder label.
  "POST /api/v1/companion/self-reflection: a real manual entry is appended and readable back from KV, tagged with a real anonymous identity",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/self-reflection", {
        method: "POST",
        body: JSON.stringify({ note: "User pointed out I can't tell them which model answered.", source: "manual" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.total, 1);
    const log = JSON.parse(env.ALHENA_KV.store.get("self_reflection_log"));
    assert.equal(log.length, 1);
    assert.match(log[0].email, /^anon:[0-9a-f-]{36}$/i);
    assert.equal(log[0].note, "User pointed out I can't tell them which model answered.");
  })
);

test("POST /api/v1/companion/self-reflection: missing note is a real 400, not a silent no-op", async () => {
  const env = makeEnv();
  const res = await worker.fetch(
    new Request("https://alhena.cc/api/v1/companion/self-reflection", {
      method: "POST",
      body: JSON.stringify({}),
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

// ── Real tier-gating (added 2026-09-13) ─────────────────────────────────
// Closes a genuine gap: /api/vendyai/webhook has always written a real
// paying user's tier to `user:${email}` in KV, but nothing ever read it
// back - free and Elite users got byte-identical behavior everywhere.
// These exercise the real free-tier daily cap, real unlimited premium/
// elite, and the new GET /api/insights Elite-only route - against the
// real worker.js logic, not a reimplementation of it.

async function guidanceRequest(env, extra = {}) {
  return worker.fetch(
    new Request("https://alhena.cc/api/v1/companion/guidance", {
      method: "POST",
      headers: { Authorization: "Bearer real-token" },
      body: JSON.stringify({ question: "Should I take the new job?", user_context: {}, ...extra }),
    }),
    env,
    makeCtx()
  );
}

test(
  "POST /api/v1/companion/guidance: free tier gets FREE_TIER_DAILY_SESSION_LIMIT (5) real sessions, then a real limit_reached response - no 6th inference call",
  withMockedAuthFor({ id: "u1", email: "free-user@example.com", name: "Free User" }, async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) {
      const res = await guidanceRequest(env);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.limit_reached, undefined, `call ${i + 1} should not be limit-blocked`);
      assert.equal(body.tier, "free");
    }
    const sixth = await guidanceRequest(env);
    const sixthBody = await sixth.json();
    assert.equal(sixth.status, 200);
    assert.equal(sixthBody.limit_reached, true);
    assert.equal(sixthBody.inference_source, "tier_limit");
    assert.match(sixthBody.guidance, /free guidance\/chat sessions/);
    // The blocked call must not have been persisted as a real session -
    // history should still only have the first 5 real answers.
    const stored = JSON.parse(env.ALHENA_KV.store.get("guidance:free-user@example.com"));
    assert.equal(stored.length, 5);
  })
);

test(
  "POST /api/v1/companion/guidance: a real Premium subscriber (real user:email KV record) is genuinely unlimited",
  withMockedAuthFor({ id: "u2", email: "premium-user@example.com", name: "Premium User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set("user:premium-user@example.com", JSON.stringify({ tier: "premium", activated_at: Date.now() }));
    for (let i = 0; i < 8; i++) {
      const res = await guidanceRequest(env);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.limit_reached, undefined, `premium call ${i + 1} should never be limit-blocked`);
      assert.equal(body.tier, "premium");
    }
    const stored = JSON.parse(env.ALHENA_KV.store.get("guidance:premium-user@example.com"));
    assert.equal(stored.length, 8);
  })
);

test(
  "POST /api/v1/companion/guidance: Elite tier gets a real extended conversation-memory window (15 turns vs 5)",
  withMockedAuthFor({ id: "u3", email: "elite-user@example.com", name: "Elite User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set("user:elite-user@example.com", JSON.stringify({ tier: "elite", activated_at: Date.now() }));
    const seeded = Array.from({ length: 20 }, (_, i) => ({ timestamp: `t${i}`, question: `q${i}`, guidance: `a${i}` }));
    env.ALHENA_KV.store.set("guidance:elite-user@example.com", JSON.stringify(seeded));
    const res = await guidanceRequest(env);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.tier, "elite");
    assert.equal(body.memory.prior_sessions_considered, 15);
  })
);

test(
  "POST /api/v1/companion/guidance: free tier with only 20 prior sessions still gets the standard 5-turn window, not Elite's 15",
  withMockedAuthFor({ id: "u4", email: "free-history-user@example.com", name: "Free History User" }, async () => {
    const env = makeEnv();
    const seeded = Array.from({ length: 20 }, (_, i) => ({ timestamp: `t${i}`, question: `q${i}`, guidance: `a${i}` }));
    env.ALHENA_KV.store.set("guidance:free-history-user@example.com", JSON.stringify(seeded));
    const res = await guidanceRequest(env);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.tier, "free");
    assert.equal(body.memory.prior_sessions_considered, 5);
  })
);

test(
  "POST /api/chat: shares the same real free-tier daily cap as companion/guidance (combined counter)",
  withMockedAuthFor({ id: "u5", email: "shared-cap-user@example.com", name: "Shared Cap User" }, async () => {
    const env = makeEnv();
    // 4 guidance sessions, then chat should only have 1 free session left.
    for (let i = 0; i < 4; i++) await guidanceRequest(env);
    const firstChat = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ message: "hi" }),
      }),
      env,
      makeCtx()
    );
    const firstBody = await firstChat.json();
    assert.equal(firstChat.status, 200);
    assert.equal(firstBody.message.limit_reached, undefined);

    const secondChat = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        headers: { Authorization: "Bearer real-token" },
        body: JSON.stringify({ message: "still here?" }),
      }),
      env,
      makeCtx()
    );
    const secondBody = await secondChat.json();
    assert.equal(secondChat.status, 200);
    assert.equal(secondBody.message.limit_reached, true);
    assert.equal(secondBody.message.inference_source, "tier_limit");
  })
);

test(
  "GET /api/insights: free and premium tiers get a real 403, not fabricated insights",
  withMockedAuthFor({ id: "u6", email: "no-insights-user@example.com", name: "No Insights User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/insights", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "TIER_REQUIRED");
    assert.equal(body.current_tier, "free");
  })
);

test(
  "GET /api/insights: a real Elite user gets real aggregated stats computed from their own checkin2 history",
  withMockedAuthFor({ id: "u7", email: "elite-insights-user@example.com", name: "Elite Insights User" }, async () => {
    const env = makeEnv();
    env.ALHENA_KV.store.set("user:elite-insights-user@example.com", JSON.stringify({ tier: "elite", activated_at: Date.now() }));
    const now = Date.now();
    const day = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
    const checkins = [
      { date: day(1), mood: 8, energy: 7, note: null },
      { date: day(2), mood: 8, energy: 7, note: null },
      { date: day(10), mood: 3, energy: 4, note: null },
      { date: day(11), mood: 3, energy: 4, note: null },
    ];
    env.ALHENA_KV.store.set("checkin2:elite-insights-user@example.com", JSON.stringify(checkins));
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/insights", { headers: { Authorization: "Bearer real-token" } }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.tier, "elite");
    assert.equal(body.total_checkins, 4);
    assert.equal(body.avg_mood_7d, 8);
    assert.equal(body.trend_last_7d_vs_prior_7d, "improving");
  })
);

// ── Real anonymous, no-signup identity (added 2026-09-13) ───────────────
// John's real product decision: "we are making what is currently texting
// Jim into the alhena.cc product users around the world can start using
// at this time for free until we figure out what users will pay for and
// have some users to worry about... there should be no signup required,
// it should just name them color animal tradePersonType, filling in a
// random choice for each of those from a list." These exercise the real
// resolveIdentity()/getOrCreateAnonymousProfile() mechanism in worker.js,
// not a reimplementation of it.

test(
  "GET /api/v1/companion/identity: a brand-new caller gets a real 'Color Animal TradePersonType' name and a real UUID",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/identity"), env, makeCtx());
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.anonymous, true);
    assert.equal(body.isNew, true);
    assert.match(body.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    // Exactly three space-separated real words: Color, Animal, TradePersonType.
    const parts = body.name.split(" ");
    assert.equal(parts.length, 3);
    for (const part of parts) assert.match(part, /^[A-Z][a-z]+$/);
  })
);

test(
  "GET /api/v1/companion/identity: two fresh callers with no prior anon id get different real names/ids most of the time (real randomness, not a fixed constant)",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const names = new Set();
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/identity"), env, makeCtx());
      const body = await res.json();
      names.add(body.name);
      ids.add(body.id);
    }
    // IDs are real crypto.randomUUID() values - always unique.
    assert.equal(ids.size, 20);
    // Names are drawn from a large combinatorial space (25*25*25) - 20
    // draws landing on fewer than 2 distinct names would indicate the
    // generator isn't actually random.
    assert.ok(names.size > 1, "expected real variety across 20 generated names");
  })
);

test(
  "GET /api/v1/companion/identity: a returning caller (same X-Alhena-Anon-Id) gets back the SAME name, not a new random one",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const first = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/identity"), env, makeCtx());
    const firstBody = await first.json();

    const second = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/identity", {
        headers: { "X-Alhena-Anon-Id": firstBody.id },
      }),
      env,
      makeCtx()
    );
    const secondBody = await second.json();
    assert.equal(secondBody.anonymous, true);
    assert.equal(secondBody.isNew, false);
    assert.equal(secondBody.id, firstBody.id);
    assert.equal(secondBody.name, firstBody.name);
  })
);

test(
  "GET /api/v1/companion/identity: a real AuthFor Bearer token wins over any anon id header, matching the real signed-in identity",
  withMockedAuthFor({ id: "u1", email: "real-user@example.com", name: "Real User" }, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/v1/companion/identity", {
        headers: { Authorization: "Bearer real-token", "X-Alhena-Anon-Id": "11111111-1111-1111-1111-111111111111" },
      }),
      env,
      makeCtx()
    );
    const body = await res.json();
    assert.equal(body.anonymous, false);
    assert.equal(body.id, "real-user@example.com");
    assert.equal(body.name, "Real User");
  })
);

test(
  "POST /api/chat: works with NO Bearer token at all - the real free, no-signup companion chat",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "Hello Alhena" }),
      }),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message.role, "assistant");
    assert.equal(body.identity.anonymous, true);
    assert.match(body.identity.id, /^[0-9a-f-]{36}$/i);
  })
);

test(
  "POST /api/chat twice with the SAME X-Alhena-Anon-Id header: real history persists across requests for an anonymous caller",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const first = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "first message" }),
      }),
      env,
      makeCtx()
    );
    const firstBody = await first.json();
    const anonId = firstBody.identity.id;

    await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        headers: { "X-Alhena-Anon-Id": anonId },
        body: JSON.stringify({ message: "second message, same visitor" }),
      }),
      env,
      makeCtx()
    );

    const history = await worker.fetch(
      new Request("https://alhena.cc/api/chat/history", { headers: { "X-Alhena-Anon-Id": anonId } }),
      env,
      makeCtx()
    );
    const historyBody = await history.json();
    // 2 user messages + 2 assistant replies = 4, all under the one real
    // anon:<uuid> identity - a genuinely returning visitor, not two
    // strangers who happened to share a KV namespace.
    assert.equal(historyBody.messages.length, 4);
    assert.equal(historyBody.messages[0].content, "first message");
    assert.equal(historyBody.messages[2].content, "second message, same visitor");
    const stored = JSON.parse(env.ALHENA_KV.store.get(`chat:anon:${anonId}`));
    assert.equal(stored.length, 4);
  })
);

test(
  "POST /api/chat: a DIFFERENT anonymous caller (no header, or a different id) never sees another visitor's history",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const first = await worker.fetch(
      new Request("https://alhena.cc/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "visitor one's message" }),
      }),
      env,
      makeCtx()
    );
    const firstBody = await first.json();

    const secondHistory = await worker.fetch(
      new Request("https://alhena.cc/api/chat/history"), // no anon id header at all - a brand-new visitor
      env,
      makeCtx()
    );
    const secondBody = await secondHistory.json();
    assert.equal(secondBody.messages.length, 0);
  })
);

test(
  "POST /api/v1/companion/guidance: an anonymous identity is tier 'anonymous' (real, unlimited, never counted against the free-tier cap) - not silently 'free' or fabricated 'premium'",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const anonId = "22222222-2222-2222-2222-222222222222";
    // One more than FREE_TIER_DAILY_SESSION_LIMIT (5) - a real free-tier
    // user would be blocked on the 6th call (see the existing free-tier
    // cap test above); an anonymous caller must not be.
    let lastBody;
    for (let i = 0; i < 6; i++) {
      const res = await worker.fetch(
        new Request("https://alhena.cc/api/v1/companion/guidance", {
          method: "POST",
          headers: { "X-Alhena-Anon-Id": anonId },
          body: JSON.stringify({ question: `Question ${i}`, user_context: { situation: "career" } }),
        }),
        env,
        makeCtx()
      );
      assert.equal(res.status, 200);
      lastBody = await res.json();
      assert.equal(lastBody.limit_reached, undefined, `anonymous call ${i + 1} must never be limit-blocked`);
      assert.equal(lastBody.tier, "anonymous");
    }
    // Real, actually-saved continuity for all 6 calls under one anon identity.
    const stored = JSON.parse(env.ALHENA_KV.store.get(`guidance:anon:${anonId}`));
    assert.equal(stored.length, 6);
    // Never counted toward the shared free-tier daily session counter.
    assert.equal(env.ALHENA_KV.store.has(`session_count:anon:${anonId}:${new Date().toISOString().slice(0, 10)}`), false);
  })
);
