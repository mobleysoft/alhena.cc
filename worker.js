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
        const body = await request.json();
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
        const body = await request.json();
        const { mood, energy_level, notes } = body;

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
          recommendations.push({
            tier: 'elite',
            monthly_cost: 19.99,
            features: ['1:1 coaching calls', 'Advanced wellness insights', 'Extended session time'],
            savings_estimate: 'For frequent users who want more coaching time'
          });
        }

        return new Response(JSON.stringify({
          recommendations,
          current_tier: current_tier || 'free',
          // Honest as of 2026-09-03: checkout is not wired to real billing
          // yet (see /api/v1/payments/stripe/session below) - was
          // previously claimed true while pointing at a non-functional
          // decoy host.
          stripe_integration_enabled: false
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

    // Checkout intentionally disabled as of 2026-09-03. This previously
    // called POST https://vendyai-com-worker.jmobleyworks.workers.dev/api/stripe/session
    // - a decoy host (see mascom/.reward_hack_audit/README.md's
    // "jmobleyworks decoy account" section) with a route that doesn't
    // exist on the real vendyai-com-worker at all, so this always 500'd
    // for a real user. Returning a clear, honest "not available" response
    // instead of a confusing error - real billing gets wired once this
    // product's live surface (this file) has been reviewed as safe to
    // charge for, matching the same pattern used for authfor.com and
    // weylandai.com's real vendyai integrations.
    if (url.pathname === '/api/v1/payments/stripe/session' && request.method === 'POST') {
      return new Response(JSON.stringify({
        error: 'Checkout is not enabled yet for Alhena.',
        code: 'NOT_AVAILABLE'
      }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Stripe Webhook Handler
    if (url.pathname === '/api/v1/payments/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        // Process webhook (signature verification would happen here in production)

        if (body.type === 'payment_intent.succeeded') {
          // Update subscription status and telemetry
          ctx.waitUntil(
            fetch('https://vendyai.com/api/billing/event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                venture_id: 'alhena.cc',
                event: 'subscription_activated',
                payment_id: body.payment_intent.id,
                amount: body.payment_intent.amount,
                timestamp: Date.now()
              })
            }).catch(e => console.error('VendyAI webhook trace failed:', e))
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

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

    return new Response('<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Alhena | Personal AI Companion</title>\n    <meta name="description" content="Personal AI companion platform providing life guidance, decision support, and wellness coaching through conversational AI.">\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">\n    <style>\n        :root {\n            --bg: #0a0f1f;\n            --surface: rgba(139, 92, 246, 0.05);\n            --border: rgba(139, 92, 246, 0.15);\n            --accent: #8B5CF6;\n            --accent-glow: rgba(139, 92, 246, 0.25);\n            --text: #F3F4F6;\n            --text-muted: #9CA3AF;\n            --wellness: #10B981;\n        }\n\n        * { box-sizing: border-box; margin: 0; padding: 0; }\n\n        body {\n            background-color: var(--bg);\n            color: var(--text);\n            font-family: \'Inter\', -apple-system, sans-serif;\n            min-height: 100vh;\n            display: flex;\n            flex-direction: column;\n            overflow-x: hidden;\n            background-image: radial-gradient(circle at 50% -20%, var(--accent-glow) 0%, transparent 60%);\n        }\n\n        header {\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            padding: 1.5rem 2rem;\n            border-bottom: 1px solid var(--border);\n            backdrop-filter: blur(12px);\n        }\n\n        .logo {\n            font-family: \'Outfit\', sans-serif;\n            font-weight: 900;\n            text-transform: uppercase;\n            letter-spacing: 1px;\n            color: #FFF;\n            display: flex;\n            align-items: center;\n            gap: 0.5rem;\n        }\n\n        .logo span {\n            color: var(--accent);\n        }\n\n        .status {\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            padding: 0.25rem 0.75rem;\n            border-radius: 9999px;\n            border: 1px solid var(--border);\n            color: var(--text-muted);\n        }\n\n        .status.online {\n            color: var(--wellness);\n            border-color: rgba(16, 185, 129, 0.2);\n            background: rgba(16, 185, 129, 0.05);\n        }\n\n        main {\n            flex: 1;\n            max-width: 900px;\n            width: 100%;\n            margin: 0 auto;\n            padding: 4rem 2rem;\n        }\n\n        .hero {\n            text-align: center;\n            margin-bottom: 4rem;\n        }\n\n        h1 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 3.5rem;\n            font-weight: 900;\n            letter-spacing: -1px;\n            margin-bottom: 1.5rem;\n            background: linear-gradient(135deg, #FFFFFF, var(--accent));\n            -webkit-background-clip: text;\n            -webkit-text-fill-color: transparent;\n        }\n\n        .tagline {\n            font-size: 1.2rem;\n            color: var(--text-muted);\n            max-width: 700px;\n            margin: 0 auto 3rem auto;\n            line-height: 1.6;\n        }\n\n        .companion-zone {\n            border: 2px solid var(--border);\n            border-radius: 20px;\n            padding: 3rem 2rem;\n            text-align: center;\n            background: var(--surface);\n            backdrop-filter: blur(12px);\n            margin-bottom: 3rem;\n            transition: all 0.3s ease;\n        }\n\n        .companion-zone:hover {\n            border-color: var(--accent);\n            background: rgba(139, 92, 246, 0.1);\n            box-shadow: 0 0 30px var(--accent-glow);\n        }\n\n        .companion-icon {\n            font-size: 3rem;\n            margin-bottom: 1rem;\n            display: inline-block;\n            animation: pulse 2s infinite;\n        }\n\n        @keyframes pulse {\n            0%, 100% { opacity: 1; }\n            50% { opacity: 0.7; }\n        }\n\n        .companion-text h3 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 1.5rem;\n            margin-bottom: 0.5rem;\n        }\n\n        .companion-text p {\n            color: var(--text-muted);\n            font-size: 0.95rem;\n        }\n\n        .btn {\n            display: inline-block;\n            padding: 1rem 2rem;\n            background: var(--accent-glow);\n            color: #FFF;\n            border: 1px solid var(--accent);\n            border-radius: 8px;\n            text-align: center;\n            text-decoration: none;\n            font-weight: 600;\n            transition: all 0.3s ease;\n            cursor: pointer;\n            margin-top: 1.5rem;\n        }\n\n        .btn:hover {\n            background: var(--accent);\n            box-shadow: 0 0 20px var(--accent-glow);\n        }\n\n        footer {\n            padding: 2rem;\n            border-top: 1px solid var(--border);\n            text-align: center;\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            color: var(--text-muted);\n        }\n    </style>\n</head>\n<body>\n    <header>\n        <div class="logo"><b>A</b><span>lhena</span></div>\n        <span id="companion-status" class="status online">COMPANION ACTIVE</span>\n    </header>\n\n    <main>\n        <section class="hero">\n            <h1>Your Personal AI Companion</h1>\n            <p class="tagline">Life guidance, decision support, and wellness coaching through empathetic conversational AI. Alhena is here to understand and support your growth.</p>\n\n            <div class="companion-zone">\n                <div class="companion-icon">✨</div>\n                <div class="companion-text">\n                    <h3>Start a Conversation</h3>\n                    <p>Share what\'s on your mind. Receive compassionate guidance tailored to your unique situation.</p>\n                </div>\n                <button class="btn" onclick="initCompanion()">CONNECT WITH ALHENA</button>\n            </div>\n        </section>\n    </main>\n\n    <footer>\n        ● SYSTEM INTERLOCK: MOBCORP &gt; MOBLEYSOFT &gt; MOBLEY &gt; MASCOM &gt; ALHENA\n    </footer>\n\n    <script>\n        function initCompanion() {\n            // Redirect to companion chat interface or initiate auth\n            window.location.href = \'https://authfor-gateway-worker.johnmobley99.workers.dev/?returnTo=\' + encodeURIComponent(window.location.href);\n        }\n    </script>\n</body>\n</html>', {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
  }
};
