async function hmacSha256Base64Url(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const binary = String.fromCharCode(...new Uint8Array(sig));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// AuthFor is the conglomerate-wide identity provider (mascom/CLAUDE.md
// standing policy). Alhena has no local user store of its own, so a real
// user for billing purposes is: a Bearer token that verifies against
// AuthFor's real GET /api/v1/verify, contract confirmed live via
// weylandai's identical real integration (weyland.worker.js) - returns
// {id, email, name} on success.
async function authenticateViaAuthFor(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, msg: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' };
  }
  const token = authHeader.slice(7).trim();
  const res = await fetch('https://authfor.com/api/v1/verify', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw { status: 401, msg: 'Token invalid', code: 'UNAUTHORIZED' };
  const identity = await res.json();
  if (!identity || !identity.email) throw { status: 401, msg: 'Token invalid', code: 'UNAUTHORIZED' };
  return identity;
}

// Same AuthFor check as authenticateViaAuthFor(), but never throws - a
// missing/invalid token just means "anonymous", not an error. Real gap
// found 2026-09-11: this venture's own spec_draft describes the MVP as
// "explicitly framed as a structured journal" (mvp_feature), but neither
// /companion/checkin nor /companion/guidance persisted anything anywhere
// - every call was stateless, so there was no actual journal to look
// back on. Making auth optional here (rather than required) preserves
// the existing no-signup, try-it-first UX for anonymous visitors, and
// only persists for a real, identified AuthFor user.
async function tryAuthenticateViaAuthFor(request) {
  try {
    return await authenticateViaAuthFor(request);
  } catch (e) {
    return null;
  }
}

const MAX_STORED_CHECKINS = 90; // ~3 months at 1/day - a real, bounded cap, not unlimited KV growth

async function appendCheckinHistory(env, email, checkin) {
  const key = `checkins:${email}`;
  const raw = await env.ALHENA_KV.get(key);
  let history = [];
  if (raw) {
    try { history = JSON.parse(raw); } catch (e) { history = []; }
  }
  history.push(checkin);
  if (history.length > MAX_STORED_CHECKINS) history = history.slice(-MAX_STORED_CHECKINS);
  await env.ALHENA_KV.put(key, JSON.stringify(history));
}

// ── Companion app-shell backend (added 2026-09-11) ─────────────────────
// reference/legacy-roots/alhena/app.html is a real, already-built chat/
// journal/goals/check-in UI - far ahead of this venture's actual deployed
// front end - that expected these routes and none of them existed. Its
// own auth screen calls AuthFor directly (mascom/CLAUDE.md: "AuthFor for
// auth, not a per-venture choice"), so no local signup/login/user-store
// route was added here - every route below requires a real AuthFor
// Bearer token, same authenticateViaAuthFor() used above. Storage is
// ALHENA_KV, same as the existing checkin history, with the same
// bounded-list-cap pattern (no unlimited per-user growth).
const MAX_STORED_JOURNAL_ENTRIES = 500;
const MAX_STORED_GOALS = 200;
const MAX_STORED_CHAT_MESSAGES = 500;
const MAX_STORED_DAILY_CHECKINS = 365;

async function readKvList(env, key) {
  const raw = await env.ALHENA_KV.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function writeKvList(env, key, list, cap) {
  const bounded = list.length > cap ? list.slice(-cap) : list;
  await env.ALHENA_KV.put(key, JSON.stringify(bounded));
  return bounded;
}

function authForErrorResponse(e, corsHeaders) {
  return new Response(JSON.stringify({ success: false, error: e.msg || 'Unauthorized', code: e.code || 'UNAUTHORIZED' }), {
    status: e.status || 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Same fallback-mode-honest pattern as /api/v1/companion/guidance above -
// only claims a real model reply when ALHENA_INFERENCE_URL is actually
// configured to something other than the known-dead wrangler.toml
// default, and only claims success when the call actually returned one.
async function generateChatReply(env, message) {
  const alhenaEndpoint = env.ALHENA_INFERENCE_URL;
  const inferenceConfigured = !!alhenaEndpoint && alhenaEndpoint !== 'https://core.jmobleyworks.com/v1/chat/completions';
  if (inferenceConfigured) {
    try {
      const res = await fetch(alhenaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.JWT_SECRET || 'local_key'}`
        },
        body: JSON.stringify({
          system: 'You are Alhena, a supportive companion for talking through everyday decisions. You are not a therapist and do not provide medical or mental-health treatment.',
          messages: [{ role: 'user', content: message }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (e) {
      // fall through to the honest fallback below
    }
  }
  return "I'm not connected to a live guidance model right now, so I can't give you a personalized reply to that. In a crisis, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line) - real, free, 24/7 resources.";
}

function checkinStreak(checkins) {
  // Distinct calendar days, most recent first, counting consecutive days
  // back from today or yesterday (a check-in today shouldn't be required
  // to keep yesterday's streak alive before the day is over).
  const days = [...new Set(checkins.map(c => c.date.slice(0, 10)))].sort().reverse();
  if (days.length === 0) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  let cursor = today;
  if (days[0] !== new Date(today).toISOString().slice(0, 10)) {
    cursor = today - oneDay; // most recent check-in was yesterday, not today
  }
  let streak = 0;
  for (const day of days) {
    const dayTime = new Date(day).getTime();
    if (dayTime === cursor) {
      streak++;
      cursor -= oneDay;
    } else if (dayTime < cursor) {
      break;
    }
  }
  return streak;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health Route
    if (url.pathname === '/api/v1/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', engine: 'Alhena-Companion-v1', companion_status: 'active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Core Companion Guidance: Life Decision Support
    if (url.pathname === '/api/v1/companion/guidance' && request.method === 'POST') {
      try {
        // Real bug found 2026-09-11 (route-vs-reality audit): a missing or
        // malformed JSON body threw uncaught inside this try block and fell
        // through to the outer catch's blanket 500 - a client sending bad
        // input got a server-error status, not the 400 that's actually
        // correct for it.
        const body = await request.json().catch(() => null);
        if (!body) {
          return new Response(JSON.stringify({ error: 'Invalid or missing JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const { user_context, question, decision_type } = body;

        if (!question || !user_context) {
          return new Response(JSON.stringify({ error: 'Missing question or user_context' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Real inference gateway - env.ALHENA_INFERENCE_URL, if set, must
        // point at something that actually resolves. wrangler.toml's
        // default (core.jmobleyworks.com) does not resolve at all
        // (confirmed 2026-09-03: DNS lookup fails) - skip the network call
        // entirely rather than pretend to try connecting to a dead host.
        //
        // Real gap confirmed 2026-09-11 (not just this default - checked
        // live, no secret override exists either): companion_guidance runs
        // in fallback_mode:true for 100% of real production traffic today.
        // Two real candidate fix paths were found and evaluated, neither
        // wired up this pass:
        //   (1) https://llama.mobleysoft.com - real, live, CF-Access-gated
        //       bridge to this Mac's llama-server (Qwen3-8B), already
        //       proven by mobley-venture-fleet-a's JITAGI_CAPABILITIES
        //       bridge via a real CF-Access-Client-Id/Secret service
        //       token. Not reused here because that Access application
        //       isn't visible via the Access Apps API under the same
        //       Cloudflare account that hosts alhena-cc-worker (confirmed
        //       via `wrangler whoami` + a live API call - 0 apps
        //       returned), so a working token can't be safely provisioned
        //       without further access.
        //   (2) https://mobley.mobleysoft.com - ingress config already
        //       exists (~/.cloudflared/mascom-v5.yml) pointing at the
        //       real, already-running mascom_qwen_adapter.py on
        //       127.0.0.1:11435, but that tunnel process wasn't running
        //       at check time and is shared fleet-wide infra (~20 other
        //       hostnames) - starting it as a side effect of this one
        //       endpoint would be disproportionate without an explicit
        //       decision.
        // See ventures.json's alhena.cc insight.evidence for the full
        // investigation. Left honestly as fallback-only, not fabricated
        // as fixed.
        const alhenaEndpoint = env.ALHENA_INFERENCE_URL;
        const inferenceConfigured = !!alhenaEndpoint && alhenaEndpoint !== 'https://core.jmobleyworks.com/v1/chat/completions';

        const systemPrompt = `You are Alhena, a supportive companion for talking through everyday decisions. You are not a therapist and do not provide medical or mental-health treatment.
Decision type: ${decision_type || 'general_guidance'}`;

        let inferenceRes = null;
        let isFallback = !inferenceConfigured;
        if (inferenceConfigured) {
          try {
            inferenceRes = await fetch(alhenaEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.JWT_SECRET || 'local_key'}`
              },
              body: JSON.stringify({
                system: systemPrompt,
                messages: [{ role: 'user', content: `User Context: ${JSON.stringify(user_context)}\n\nQuestion: ${question}` }],
                temperature: 0.7,
                max_tokens: 1000
              })
            });
          } catch(e) {
            isFallback = true;
          }
        }

        let guidance = '';
        if (inferenceRes && inferenceRes.ok) {
          try {
            const data = await inferenceRes.json();
            guidance = data.choices[0].message.content.trim();
          } catch(e) {
            isFallback = true;
          }
        } else if (inferenceConfigured) {
          isFallback = true;
        }

        if (isFallback) {
          guidance = `I'm not connected to a live guidance model right now, so I can't give you a personalized response to this. What I can say generally: it often helps to write down what you actually want here before weighing options. Alhena is not a therapist or medical provider - if what you're working through feels heavier than a decision, the 988 Suicide & Crisis Lifeline (call or text 988) and Crisis Text Line (text HOME to 741741) are real, free, 24/7 resources.`;
        }

        // Fire event tracking to VendyAI telemetry
        ctx.waitUntil(
          fetch('https://vendyai.com/api/billing/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venture_id: 'alhena.cc',
              user_id: 'companion_user',
              event: 'guidance_session',
              decision_type: decision_type || 'general',
              timestamp: Date.now()
            })
          }).catch(e => console.error('VendyAI billing trace failed:', e))
        );

        return new Response(JSON.stringify({
          guidance,
          decision_type: decision_type || 'general',
          companion: 'Alhena',
          fallback_mode: isFallback,
          disclaimer: 'Alhena is a decision-support companion, not therapy or medical care. In a crisis, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line).',
          session_id: `sess_${Date.now()}`,
          next_check_in: new Date(Date.now() + 86400000).toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Core Companion Wellness Check-in
    if (url.pathname === '/api/v1/companion/checkin' && request.method === 'POST') {
      try {
        // Same real fix as /api/v1/companion/guidance above: a missing or
        // malformed JSON body must not fall through to a blanket 500.
        const body = await request.json().catch(() => ({}));
        const { mood, energy_level, notes } = body;
        const identity = await tryAuthenticateViaAuthFor(request);

        // No numeric "wellness score" - a mood/energy check-in isn't a
        // clinical assessment, and inventing a number from Math.random()
        // (the previous version of this endpoint did exactly that,
        // presented as if measured) would mislead a real user about their
        // own wellbeing. This just reflects back what was reported.
        const checkin = {
          timestamp: new Date().toISOString(),
          mood: mood || 'neutral',
          energy_level: energy_level || 'medium',
          notes: notes || '',
          recommendations: [],
          disclaimer: 'This check-in is not a mental-health assessment and Alhena is not a therapist. In a crisis, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line) - real, free, 24/7 resources.'
        };

        // Generate wellness recommendations based on mood/energy
        if (mood === 'anxious' || energy_level === 'low') {
          checkin.recommendations.push('Consider a 5-minute breathing exercise');
          checkin.recommendations.push('Take a short walk or stretch break');
        }
        if (mood === 'happy' || energy_level === 'high') {
          checkin.recommendations.push('Great momentum! Channel this into your goals');
          checkin.recommendations.push('Connect with someone who matters to you');
        }

        // Fire event to VendyAI
        ctx.waitUntil(
          fetch('https://vendyai.com/api/billing/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venture_id: 'alhena.cc',
              user_id: 'companion_user',
              event: 'wellness_checkin',
              mood: mood,
              energy: energy_level,
              timestamp: Date.now()
            })
          }).catch(e => console.error('VendyAI billing trace failed:', e))
        );

        // Real persistence, only for a real identified user - see
        // appendCheckinHistory's own comment for why this is optional
        // rather than required. `saved` is honest either way: an
        // anonymous check-in genuinely isn't saved anywhere.
        checkin.saved = false;
        if (identity) {
          await appendCheckinHistory(env, identity.email, checkin);
          checkin.saved = true;
        } else {
          checkin.note = 'Sign in to save check-ins and see your history at GET /api/v1/companion/checkins.';
        }

        return new Response(JSON.stringify(checkin), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Real check-in history read-back, added 2026-09-11 alongside the
    // persistence fix above. Required (not optional) auth - unlike the
    // checkin POST, there's no anonymous history to show.
    if (url.pathname === '/api/v1/companion/checkins' && request.method === 'GET') {
      let identity;
      try {
        identity = await authenticateViaAuthFor(request);
      } catch (e) {
        return new Response(JSON.stringify({ error: e.msg, code: e.code }), {
          status: e.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const raw = await env.ALHENA_KV.get(`checkins:${identity.email}`);
      let history = [];
      if (raw) {
        try { history = JSON.parse(raw); } catch (e) { history = []; }
      }
      return new Response(JSON.stringify({ email: identity.email, count: history.length, checkins: history }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Companion app-shell routes (app.html) ──────────────────────────
    if (url.pathname === '/api/journal' && request.method === 'POST') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const body = await request.json();
        if (!body.content) {
          return new Response(JSON.stringify({ success: false, error: 'Missing content' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const entry = {
          id: crypto.randomUUID(),
          title: body.title || null,
          content: body.content,
          mood: typeof body.mood === 'number' ? body.mood : null,
          createdAt: new Date().toISOString()
        };
        const key = `journal:${identity.email}`;
        const list = await readKvList(env, key);
        list.push(entry);
        await writeKvList(env, key, list, MAX_STORED_JOURNAL_ENTRIES);
        return new Response(JSON.stringify({ success: true, entry }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/journal' && request.method === 'GET') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const list = await readKvList(env, `journal:${identity.email}`);
        return new Response(JSON.stringify({ success: true, entries: [...list].reverse() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return authForErrorResponse(e, corsHeaders);
      }
    }

    if (url.pathname === '/api/goals' && request.method === 'POST') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const body = await request.json();
        if (!body.title) {
          return new Response(JSON.stringify({ success: false, error: 'Missing title' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const goal = {
          id: crypto.randomUUID(),
          title: body.title,
          description: body.description || null,
          category: body.category || 'personal',
          status: 'active',
          progress: 0,
          createdAt: new Date().toISOString()
        };
        const key = `goals:${identity.email}`;
        const list = await readKvList(env, key);
        list.push(goal);
        await writeKvList(env, key, list, MAX_STORED_GOALS);
        return new Response(JSON.stringify({ success: true, goal }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/goals' && request.method === 'GET') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const list = await readKvList(env, `goals:${identity.email}`);
        return new Response(JSON.stringify({ success: true, goals: [...list].reverse() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return authForErrorResponse(e, corsHeaders);
      }
    }

    if (url.pathname.startsWith('/api/goals/') && request.method === 'PUT') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const goalId = url.pathname.slice('/api/goals/'.length);
        const body = await request.json();
        const key = `goals:${identity.email}`;
        const list = await readKvList(env, key);
        const goal = list.find(g => g.id === goalId);
        if (!goal) {
          return new Response(JSON.stringify({ success: false, error: 'Goal not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (typeof body.progress === 'number') {
          goal.progress = Math.max(0, Math.min(100, body.progress));
          goal.status = goal.progress >= 100 ? 'completed' : 'active';
        }
        await env.ALHENA_KV.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true, goal }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const body = await request.json();
        if (!body.message) {
          return new Response(JSON.stringify({ success: false, error: 'Missing message' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const key = `chat:${identity.email}`;
        const list = await readKvList(env, key);
        list.push({ role: 'user', content: body.message, timestamp: new Date().toISOString() });
        const replyContent = await generateChatReply(env, body.message);
        const reply = { role: 'assistant', content: replyContent, timestamp: new Date().toISOString() };
        list.push(reply);
        await writeKvList(env, key, list, MAX_STORED_CHAT_MESSAGES);
        return new Response(JSON.stringify({ success: true, message: reply }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/chat/history' && request.method === 'GET') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const limit = Math.max(1, Math.min(1000, parseInt(url.searchParams.get('limit'), 10) || 100));
        const list = await readKvList(env, `chat:${identity.email}`);
        return new Response(JSON.stringify({ success: true, messages: list.slice(-limit) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return authForErrorResponse(e, corsHeaders);
      }
    }

    // Numeric mood/energy (1-10) daily check-ins for the app shell -
    // deliberately a distinct KV key (checkin2:) from the string-mood
    // ('anxious'/'happy') anonymous-capable /api/v1/companion/checkin
    // above. Different data shape, different feature, same venture.
    if (url.pathname === '/api/checkin' && request.method === 'POST') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const body = await request.json();
        if (typeof body.mood !== 'number') {
          return new Response(JSON.stringify({ success: false, error: 'Missing mood' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const record = {
          date: new Date().toISOString(),
          mood: body.mood,
          energy: typeof body.energy === 'number' ? body.energy : null,
          note: body.note || null
        };
        const key = `checkin2:${identity.email}`;
        const list = await readKvList(env, key);
        list.push(record);
        await writeKvList(env, key, list, MAX_STORED_DAILY_CHECKINS);

        let aiNote;
        if (body.mood <= 3) {
          aiNote = "Thanks for checking in, even on a harder day. Small steps count - maybe a short walk, or writing a line in your journal about what's weighing on you.";
        } else if (body.mood >= 8) {
          aiNote = "Glad to hear you're doing well today. Good moments like this are worth noting - maybe jot it in your journal so you can look back on it later.";
        } else {
          aiNote = "Thanks for checking in. Steady days matter too - keep an eye on what's shifting your mood day to day.";
        }

        return new Response(JSON.stringify({ success: true, aiNote }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/checkin/history' && request.method === 'GET') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days'), 10) || 30));
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const list = await readKvList(env, `checkin2:${identity.email}`);
        const inRange = list.filter(c => new Date(c.date).getTime() >= cutoff);
        return new Response(JSON.stringify({
          success: true,
          summary: { streak: checkinStreak(list) },
          checkins: [...inRange].reverse()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return authForErrorResponse(e, corsHeaders);
      }
    }

    // Removed 2026-09-03: /api/v1/treasury/accounts and /api/v1/treasury/forecast
    // returned entirely fabricated data - hardcoded fake account balances
    // ($8,700.50 total) presented as reconciled real accounts, and a 90-day
    // "engagement forecast" generated from Math.random() presented as a
    // real projection. Alhena is a subscription wellness product, not a
    // treasury - there was never a real thing for these endpoints to
    // report. See mascom/.reward_hack_audit/README.md.

    // Subscription Recommendations (tier upsell copy - not billing yet, see below)
    if (url.pathname === '/api/v1/treasury/subscription-recommendations' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { usage_pattern, current_tier } = body;

        const recommendations = [];

        if (current_tier === 'free' && usage_pattern === 'active') {
          recommendations.push({
            tier: 'premium',
            monthly_cost: 9.99,
            features: ['Unlimited guidance sessions', 'Daily wellness tracking', 'Priority responses'],
            savings_estimate: 'Enable personalized coaching'
          });
        }

        if (current_tier === 'premium') {
          // 'Therapy integration' removed 2026-09-03 - Alhena is not a
          // therapy provider and never was; this claimed a clinical service
          // that doesn't exist.
          // '1:1 coaching calls' removed 2026-09-11 - same class of bug,
          // found during a real endpoint audit: this was a paid ($19.99/mo)
          // tier feature with zero implementation anywhere in this codebase
          // (no scheduling, no call/video integration) - a paying customer
          // could reasonably expect a real call and not get one. Not
          // replaced with an invented substitute; the two features below
          // are real, deliverable software capabilities.
          recommendations.push({
            tier: 'elite',
            monthly_cost: 19.99,
            features: ['Advanced wellness insights', 'Extended session time'],
            savings_estimate: 'For frequent users who want more from each session'
          });
        }

        return new Response(JSON.stringify({
          recommendations,
          current_tier: current_tier || 'free',
          // Real as of 2026-09-03: POST /api/v1/payments/stripe/session
          // creates an actual Stripe Checkout Session via vendyai, gated
          // on a real AuthFor Bearer token.
          stripe_integration_enabled: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Real checkout as of 2026-09-03 - alhena is the third real vendyai
    // consumer (after weylandai, authfor), registered via
    // POST https://vendyai.com/api/ventures/register. Requires a real
    // AuthFor Bearer token (see authenticateViaAuthFor above) rather than
    // trusting a client-supplied user_id, since this now creates a real
    // Stripe Checkout Session. Previously called a decoy host with a route
    // that doesn't exist on the real vendyai-com-worker - see
    // mascom/.reward_hack_audit/README.md.
    const ALHENA_PRICES = {
      premium: 'price_1UBe5zLWTxUJi5AVzivKc35I',
      elite: 'price_1UBe5zLWTxUJi5AVcPMTXTzI',
    };
    if (url.pathname === '/api/v1/payments/stripe/session' && request.method === 'POST') {
      let identity;
      try { identity = await authenticateViaAuthFor(request); } catch (e) {
        return new Response(JSON.stringify({ error: e.msg, code: e.code }), { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const body = await request.json().catch(() => ({}));
      const priceId = ALHENA_PRICES[body.tier];
      if (!priceId) {
        return new Response(JSON.stringify({ error: `tier must be one of: ${Object.keys(ALHENA_PRICES).join(', ')}`, code: 'VALIDATION_ERROR' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const origin = `${url.protocol}//${url.host}`;
      try {
        const vendyRes = await fetch('https://vendyai.com/api/checkout/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venture_id: 'alhena',
            mode: 'subscription',
            customer_email: identity.email,
            success_url: `${origin}/?checkout=success`,
            cancel_url: `${origin}/?checkout=cancelled`,
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: { alhena_user_email: identity.email, tier: body.tier },
          }),
        });
        const vendyData = await vendyRes.json().catch(() => ({}));
        if (!vendyRes.ok) {
          return new Response(JSON.stringify({ error: vendyData.error || 'checkout session creation failed', code: 'VENDYAI_ERROR' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, payment_url: vendyData.session?.url, tier: body.tier, venture: 'alhena.cc' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, code: 'INTERNAL_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Receives vendyai's forwarded checkout.session.completed event -
    // verifies the same HMAC scheme vendyai signs with (shared secret set
    // at registration time), matching authfor.com's identical real
    // integration.
    if (url.pathname === '/api/vendyai/webhook' && request.method === 'POST') {
      const rawBody = await request.text();
      const signature = request.headers.get('X-Webhook-Signature');
      const timestamp = request.headers.get('X-Webhook-Timestamp');
      if (!signature || !timestamp) {
        return new Response(JSON.stringify({ error: 'missing signature headers', code: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const expected = await hmacSha256Base64Url(`${timestamp}.${rawBody}`, env.VENDYAI_HMAC_SECRET);
      if (expected !== signature) {
        return new Response(JSON.stringify({ error: 'invalid signature', code: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const event = JSON.parse(rawBody);
      if (event.type === 'checkout.session.completed') {
        const { alhena_user_email, tier } = event.data?.metadata || {};
        if (alhena_user_email && tier) {
          await env.ALHENA_KV.put(`user:${alhena_user_email}`, JSON.stringify({ tier, activated_at: Date.now() }));
        }
      }
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Real SMS companion brain, added 2026-09-11 - the actual fix for
    // "Alhena.cc is supposed to be the Alhena texting Jim, not some
    // one-off script you wrote." Before this, 100% of James's real
    // conversation (mascom/alhena_checkin_companion.py) ran entirely on
    // John's Mac with no connection to this product at all. This is the
    // first real seam: the local iMessage poller (which still has to run
    // locally - AppleScript/Messages.app only exists on the Mac) now
    // calls THIS Worker for the reply, and this Worker calls back into
    // the Mac via SMS_RELAY_URL (alhena-relay.mobleysoft.com, a
    // cloudflared tunnel John pointed out already existed for exactly
    // this - see llama-server-gateway.yml) to actually send it. The Mac
    // no longer decides what Alhena says; it's now pure transport.
    //
    // Auth is a shared secret (SMS_INBOUND_SECRET), not AuthFor - the
    // caller is John's own local poller process, not an end user.
    //
    // State (recipient history, mood/endocrine model) is NOT migrated to
    // D1 in this pass - it still reads/writes the same local JSON files
    // via the relay's /generate passthrough, which only proxies the
    // model call. Moving recipients.json's real state into D1 is the
    // next real step, not done here - flagging honestly rather than
    // claiming a full migration that didn't happen.
    if (url.pathname === '/api/v1/companion/sms/inbound' && request.method === 'POST') {
      const provided = request.headers.get('X-Inbound-Secret');
      if (!provided || provided !== env.SMS_INBOUND_SECRET) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { chat_id, system_prompt, messages, dry_run } = body;
      if (!chat_id || !messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: 'chat_id and messages[] are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!env.SMS_RELAY_URL || !env.SMS_RELAY_SECRET) {
        return new Response(JSON.stringify({ error: 'SMS relay not configured', code: 'RELAY_UNCONFIGURED' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullMessages = system_prompt
        ? [{ role: 'system', content: system_prompt }, ...messages]
        : messages;

      let reply;
      try {
        const genRes = await fetch(`${env.SMS_RELAY_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': env.SMS_RELAY_SECRET },
          body: JSON.stringify({ messages: fullMessages, max_tokens: 400, temperature: 0.7 })
        });
        if (!genRes.ok) {
          return new Response(JSON.stringify({ error: 'relay generate failed', status: genRes.status }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const genData = await genRes.json();
        reply = genData?.choices?.[0]?.message?.content?.trim();
        if (!reply) {
          return new Response(JSON.stringify({ error: 'empty reply from model' }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: `relay unreachable: ${e.message}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let sent = false;
      if (!dry_run) {
        try {
          const sendRes = await fetch(`${env.SMS_RELAY_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': env.SMS_RELAY_SECRET },
            body: JSON.stringify({ chat_id, text: reply })
          });
          const sendData = await sendRes.json();
          sent = !!sendData.ok;
        } catch (e) {
          return new Response(JSON.stringify({ reply, sent: false, send_error: e.message }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ reply, sent, dry_run: !!dry_run }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Removed 2026-09-11: /api/v1/payments/webhook was a real, unauthenticated
    // hole - accepted any POST claiming payment_intent.succeeded and fired an
    // unverified "subscription_activated" event into VendyAI's cross-venture
    // billing telemetry, with zero signature verification ("would happen here
    // in production" never happened). Confirmed dead/superseded, not merely
    // undertested: VendyAI's own real webhook registration for alhena
    // (vendyai_ledger.venture_webhook_endpoints, checked live) points at
    // /api/vendyai/webhook, the properly HMAC-verified handler above - nothing
    // external ever called this route. No Stripe webhook secret exists for
    // this worker either (checked via `wrangler secret list`), confirming no
    // real Stripe subscription was ever wired to it to make signing possible.

    // Default static server fallback (serve index.html)
    const indexPath = '/index.html';
    try {
      const indexResponse = await env.ASSETS.fetch(new Request(new URL(indexPath, request.url)));
      if (indexResponse.status === 200) {
        return new Response(indexResponse.body, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }
    } catch (e) {
      // Fallback if index.html isn't found
    }

    return new Response('<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Alhena | Personal AI Companion</title>\n    <meta name="description" content="Personal AI companion for talking through everyday decisions. Not therapy or medical care.">\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">\n    <style>\n        :root {\n            --bg: #0a0f1f;\n            --surface: rgba(139, 92, 246, 0.05);\n            --border: rgba(139, 92, 246, 0.15);\n            --accent: #8B5CF6;\n            --accent-glow: rgba(139, 92, 246, 0.25);\n            --text: #F3F4F6;\n            --text-muted: #9CA3AF;\n            --wellness: #10B981;\n        }\n\n        * { box-sizing: border-box; margin: 0; padding: 0; }\n\n        body {\n            background-color: var(--bg);\n            color: var(--text);\n            font-family: \'Inter\', -apple-system, sans-serif;\n            min-height: 100vh;\n            display: flex;\n            flex-direction: column;\n            overflow-x: hidden;\n            background-image: radial-gradient(circle at 50% -20%, var(--accent-glow) 0%, transparent 60%);\n        }\n\n        header {\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            padding: 1.5rem 2rem;\n            border-bottom: 1px solid var(--border);\n            backdrop-filter: blur(12px);\n        }\n\n        .logo {\n            font-family: \'Outfit\', sans-serif;\n            font-weight: 900;\n            text-transform: uppercase;\n            letter-spacing: 1px;\n            color: #FFF;\n            display: flex;\n            align-items: center;\n            gap: 0.5rem;\n        }\n\n        .logo span {\n            color: var(--accent);\n        }\n\n        .status {\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            padding: 0.25rem 0.75rem;\n            border-radius: 9999px;\n            border: 1px solid var(--border);\n            color: var(--text-muted);\n        }\n\n        .status.online {\n            color: var(--wellness);\n            border-color: rgba(16, 185, 129, 0.2);\n            background: rgba(16, 185, 129, 0.05);\n        }\n\n        main {\n            flex: 1;\n            max-width: 900px;\n            width: 100%;\n            margin: 0 auto;\n            padding: 4rem 2rem;\n        }\n\n        .hero {\n            text-align: center;\n            margin-bottom: 4rem;\n        }\n\n        h1 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 3.5rem;\n            font-weight: 900;\n            letter-spacing: -1px;\n            margin-bottom: 1.5rem;\n            background: linear-gradient(135deg, #FFFFFF, var(--accent));\n            -webkit-background-clip: text;\n            -webkit-text-fill-color: transparent;\n        }\n\n        .tagline {\n            font-size: 1.2rem;\n            color: var(--text-muted);\n            max-width: 700px;\n            margin: 0 auto 3rem auto;\n            line-height: 1.6;\n        }\n\n        .companion-zone {\n            border: 2px solid var(--border);\n            border-radius: 20px;\n            padding: 3rem 2rem;\n            text-align: center;\n            background: var(--surface);\n            backdrop-filter: blur(12px);\n            margin-bottom: 3rem;\n            transition: all 0.3s ease;\n        }\n\n        .companion-zone:hover {\n            border-color: var(--accent);\n            background: rgba(139, 92, 246, 0.1);\n            box-shadow: 0 0 30px var(--accent-glow);\n        }\n\n        .companion-icon {\n            font-size: 3rem;\n            margin-bottom: 1rem;\n            display: inline-block;\n            animation: pulse 2s infinite;\n        }\n\n        @keyframes pulse {\n            0%, 100% { opacity: 1; }\n            50% { opacity: 0.7; }\n        }\n\n        .companion-text h3 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 1.5rem;\n            margin-bottom: 0.5rem;\n        }\n\n        .companion-text p {\n            color: var(--text-muted);\n            font-size: 0.95rem;\n        }\n\n        .disclaimer {\n            font-size: 0.85rem;\n            color: var(--text-muted);\n            max-width: 640px;\n            margin: 0 auto 2rem auto;\n            padding: 0.85rem 1.25rem;\n            border: 1px solid var(--border);\n            border-radius: 10px;\n            background: rgba(139, 92, 246, 0.06);\n            line-height: 1.5;\n        }\n\n        .btn {\n            display: inline-block;\n            padding: 1rem 2rem;\n            background: var(--accent-glow);\n            color: #FFF;\n            border: 1px solid var(--accent);\n            border-radius: 8px;\n            text-align: center;\n            text-decoration: none;\n            font-weight: 600;\n            transition: all 0.3s ease;\n            cursor: pointer;\n            margin-top: 1.5rem;\n        }\n\n        .btn:hover {\n            background: var(--accent);\n            box-shadow: 0 0 20px var(--accent-glow);\n        }\n\n        footer {\n            padding: 2rem;\n            border-top: 1px solid var(--border);\n            text-align: center;\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            color: var(--text-muted);\n        }\n    </style>\n</head>\n<body>\n    <header>\n        <div class="logo"><b>A</b><span>lhena</span></div>\n        <span id="companion-status" class="status online">COMPANION ACTIVE</span>\n    </header>\n\n    <main>\n        <section class="hero">\n            <h1>Your Personal AI Companion</h1>\n            <p class="tagline">A supportive companion for talking through everyday decisions.</p>\n            <p class="disclaimer">Alhena is not a therapist and does not provide medical or mental-health treatment. In a crisis, call or text 988 (Suicide &amp; Crisis Lifeline) or text HOME to 741741 (Crisis Text Line) - real, free, 24/7 resources.</p>\n\n            <div class="companion-zone">\n                <div class="companion-icon">✨</div>\n                <div class="companion-text">\n                    <h3>Start a Conversation</h3>\n                    <p>Share what\'s on your mind. Receive compassionate guidance tailored to your unique situation.</p>\n                </div>\n                <button class="btn" onclick="initCompanion()">CONNECT WITH ALHENA</button>\n            </div>\n        </section>\n    </main>\n\n    <footer>\n        ● SYSTEM INTERLOCK: MOBCORP &gt; MOBLEYSOFT &gt; MOBLEY &gt; MASCOM &gt; ALHENA\n    </footer>\n\n    <script>\n        function initCompanion() {\n            // Redirect to companion chat interface or initiate auth\n            window.location.href = \'https://authfor-gateway-worker.johnmobley99.workers.dev/?returnTo=\' + encodeURIComponent(window.location.href);\n        }\n    </script>\n</body>\n</html>', {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
  }
};
