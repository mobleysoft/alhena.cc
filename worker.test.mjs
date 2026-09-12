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

// ── Guidance conversation memory (added 2026-09-11) ────────────────────
// /api/v1/companion/guidance previously called no auth function at all and
// persisted nothing - every call was stateless even for a signed-in
// AuthFor user, a real gap against the venture's own "AI companion for
// life guidance" promise. These exercise the real fix: optional auth (an
// anonymous caller still gets an answer, just no memory), and a real
// identified user's prior sessions are both persisted and fed back into
// the next call's prompt.

test(
  "POST /api/v1/companion/guidance: anonymous (no Authorization header) still gets a real answer, honestly reports no memory",
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
    assert.equal(body.memory.saved, false);
    assert.match(body.memory.note, /Sign in to get guidance that remembers/);
    assert.equal(env.ALHENA_KV.store.size, 0);
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
  "GET /api/v1/companion/guidance/history: 401 with no Authorization header - no anonymous history to show",
  withMockedAuthFor(null, async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("https://alhena.cc/api/v1/companion/guidance/history"), env, makeCtx());
    assert.equal(res.status, 401);
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
  "POST /api/v1/companion/self-reflection: a real manual entry is appended and readable back from KV",
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
    assert.equal(log[0].email, "anonymous");
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
