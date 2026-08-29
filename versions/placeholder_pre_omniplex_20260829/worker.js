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

        // Connect to local AGI inference gateway for personalized guidance
        const alhenaEndpoint = env.ALHENA_INFERENCE_URL || 'https://core.jmobleyworks.com/v1/chat/completions';

        const systemPrompt = `You are Alhena, a compassionate AI companion. Your role is to provide empathetic, intelligent personal guidance on life decisions and wellness.
You understand the user's context deeply and provide actionable, emotionally aware advice.
Decision type: ${decision_type || 'general_guidance'}`;

        let inferenceRes = null;
        let isFallback = false;
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

        let guidance = '';
        if (inferenceRes && inferenceRes.ok) {
          try {
            const data = await inferenceRes.json();
            guidance = data.choices[0].message.content.trim();
          } catch(e) {
            isFallback = true;
          }
        } else {
          isFallback = true;
        }

        if (isFallback) {
          guidance = `I'm here to support you through this ${decision_type || 'decision'}. While I'm processing this moment, consider: What feels most aligned with your values? Let's break this down together.`;
        }

        // Fire event tracking to VendyAI telemetry
        ctx.waitUntil(
          fetch('https://vendyai-com-worker.jmobleyworks.workers.dev/api/billing/event', {
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

        const checkin = {
          timestamp: new Date().toISOString(),
          mood: mood || 'neutral',
          energy_level: energy_level || 'medium',
          notes: notes || '',
          wellness_score: Math.floor(Math.random() * 40 + 60), // 60-100 scale
          recommendations: []
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
          fetch('https://vendyai-com-worker.jmobleyworks.workers.dev/api/billing/event', {
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

    // Treasury Management: Wellness Account Analytics
    if (url.pathname === '/api/v1/treasury/accounts' && request.method === 'GET') {
      return new Response(JSON.stringify({
        accounts: [
          { id: 'wellness_primary', name: 'Wellness Subscription Account', balance: 2500.00, currency: 'USD', type: 'subscription', last_reconciled: new Date().toISOString(), status: 'active' },
          { id: 'wellness_premium', name: 'Premium Companion Features', balance: 5000.00, currency: 'USD', type: 'premium_tier', last_reconciled: new Date(Date.now() - 86400000).toISOString(), status: 'active' },
          { id: 'wellness_coaching', name: 'Personalized Coaching Credits', balance: 1200.50, currency: 'USD', type: 'credit_account', last_reconciled: new Date(Date.now() - 172800000).toISOString(), status: 'active' }
        ],
        total_balance: 8700.50,
        reconciliation_status: 'current',
        alerts: [],
        subscription_tier: 'premium'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Treasury Management: Engagement Forecast
    if (url.pathname === '/api/v1/treasury/forecast' && request.method === 'GET') {
      const days = parseInt(url.searchParams.get('days')) || 90;
      const forecast = [];
      let projectedValue = 8700.50;

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        // Simulate engagement trends
        const dailyEngagement = 150 + Math.random() * 200; // engagement score
        const dailyCost = 25 + Math.random() * 15; // subscription costs
        projectedValue += (dailyEngagement * 0.001) - dailyCost; // simplified economics

        forecast.push({
          date: date.toISOString().split('T')[0],
          projected_wellness_value: Math.round(projectedValue * 100) / 100,
          engagement_score: Math.round(dailyEngagement * 100) / 100,
          daily_cost: Math.round(dailyCost * 100) / 100,
          net_wellness_gain: Math.round((dailyEngagement * 0.001 - dailyCost) * 100) / 100
        });
      }

      return new Response(JSON.stringify({
        forecast,
        summary: {
          current_wellness_value: 8700.50,
          forecast_period_days: days,
          projected_ending_value: forecast[forecast.length - 1].projected_wellness_value,
          avg_daily_engagement: Math.round(forecast.reduce((sum, f) => sum + f.engagement_score, 0) / forecast.length * 100) / 100
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Treasury Management: Subscription Recommendations
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
          recommendations.push({
            tier: 'elite',
            monthly_cost: 19.99,
            features: ['1:1 coaching calls', 'Advanced wellness insights', 'Therapy integration'],
            savings_estimate: 'Premium mental health value'
          });
        }

        return new Response(JSON.stringify({
          recommendations,
          current_tier: current_tier || 'free',
          stripe_integration_enabled: true,
          upgrade_url: 'https://vendyai-com-worker.jmobleyworks.workers.dev/checkout/alhena_tier_upgrade'
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

    // Stripe Payment Integration: Initialize subscription session
    if (url.pathname === '/api/v1/payments/stripe/session' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tier, user_id } = body;

        // Delegate to VendyAI Stripe integration endpoint
        const vendyRes = await fetch('https://vendyai-com-worker.jmobleyworks.workers.dev/api/stripe/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venture_id: 'alhena.cc',
            amount: tier === 'premium' ? 999 : (tier === 'elite' ? 1999 : 0),
            description: `Alhena ${tier} subscription`,
            customer_id: user_id,
            webhook_url: 'https://alhena-cc-worker.jmobleyworks.workers.dev/api/v1/payments/webhook'
          })
        });

        if (!vendyRes.ok) {
          throw new Error('VendyAI Stripe integration failed');
        }

        const stripeSession = await vendyRes.json();
        return new Response(JSON.stringify({
          success: true,
          session_id: stripeSession.session_id,
          payment_url: stripeSession.checkout_url,
          tier,
          venture: 'alhena.cc'
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

    // Stripe Webhook Handler
    if (url.pathname === '/api/v1/payments/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        // Process webhook (signature verification would happen here in production)

        if (body.type === 'payment_intent.succeeded') {
          // Update subscription status and telemetry
          ctx.waitUntil(
            fetch('https://vendyai-com-worker.jmobleyworks.workers.dev/api/billing/event', {
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
