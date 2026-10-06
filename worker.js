// Real gap found 2026-09-12 (endpoint audit, feature-completeness pass):
// app.html is a real, already-built chat/journal/goals/check-in UI with
// working backend routes below (/api/journal, /api/goals, /api/chat,
// /api/checkin, all live since 2026-09-11) - but nothing in production
// ever served the file itself. GET /app and /app.html both fell through
// to the generic marketing-page fallback (confirmed live: identical byte
// content to GET /), so a real visitor who clicked "CONNECT WITH ALHENA"
// had no way to ever reach the actual companion interface. Embedded here
// as a plain string constant (same pattern this file already uses for the
// marketing-page fallback below) rather than a build-tool-specific text
// import, so it stays servable both by wrangler and by plain `node --test`
// (worker.test.mjs imports this file directly under real Node, no wrangler
// bundler in the loop).
const APP_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Alhena — Your Personal Companion</title>\n  <meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n  <meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n  <meta name=\"apple-mobile-web-app-title\" content=\"Alhena\">\n  <meta name=\"theme-color\" content=\"#0a0a0f\">\n  <link rel=\"apple-touch-icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='40' fill='%230a0a0f'/%3E%3Ccircle cx='90' cy='70' r='28' fill='none' stroke='%23E91E63' stroke-width='3'/%3E%3Cpath d='M90 98 C60 98 42 120 42 145 L138 145 C138 120 120 98 90 98Z' fill='none' stroke='%23E91E63' stroke-width='3'/%3E%3Ccircle cx='90' cy='70' r='6' fill='%23E91E63'/%3E%3C/svg%3E\">\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600&display=swap\" rel=\"stylesheet\">\n  <style>\n    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n    :root {\n      --bg: #0a0a0f;\n      --surface: #12121a;\n      --surface-2: #1a1a25;\n      --border: #2a2a3a;\n      --text: #e8e8f0;\n      --text-muted: #8888a0;\n      --accent: #E91E63;\n      --accent-soft: rgba(233, 30, 99, 0.15);\n      --success: #4caf50;\n      --radius: 12px;\n    }\n\n    body {\n      font-family: 'Inter', -apple-system, sans-serif;\n      background: var(--bg);\n      color: var(--text);\n      min-height: 100vh;\n      display: flex;\n    }\n\n    /* ── Auth Screen ───────────────────────────────── */\n    /* Real 2026-09-13 product decision: no signup/login required to use\n       Alhena - see the anonymous-identity comment near init() below.\n       This is no longer the default first screen (hidden by default,\n       shown only via showSignInScreen() for a visitor who wants a real\n       account) - display:flex is applied by JS when it's opened. */\n    #auth-screen {\n      display: none;\n      align-items: center;\n      justify-content: center;\n      width: 100%;\n      min-height: 100vh;\n      padding: 20px;\n    }\n\n    .auth-card {\n      background: var(--surface);\n      border: 1px solid var(--border);\n      border-radius: 16px;\n      padding: 40px;\n      max-width: 400px;\n      width: 100%;\n    }\n\n    .auth-card h1 {\n      font-family: 'Playfair Display', serif;\n      font-size: 28px;\n      margin-bottom: 8px;\n    }\n\n    .auth-card p { color: var(--text-muted); margin-bottom: 24px; font-size: 14px; }\n\n    .form-group { margin-bottom: 16px; }\n    .form-group label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }\n    .form-group input {\n      width: 100%;\n      padding: 12px 14px;\n      background: var(--surface-2);\n      border: 1px solid var(--border);\n      border-radius: 8px;\n      color: var(--text);\n      font-size: 14px;\n      outline: none;\n      transition: border-color 0.2s;\n    }\n    .form-group input:focus { border-color: var(--accent); }\n\n    .btn {\n      width: 100%;\n      padding: 12px;\n      background: var(--accent);\n      color: #fff;\n      border: none;\n      border-radius: 8px;\n      font-size: 15px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: opacity 0.2s;\n      margin-top: 8px;\n    }\n    .btn:hover { opacity: 0.9; }\n    .btn:disabled { opacity: 0.5; cursor: not-allowed; }\n\n    .auth-toggle {\n      text-align: center;\n      margin-top: 16px;\n      font-size: 13px;\n      color: var(--text-muted);\n    }\n    .auth-toggle a { color: var(--accent); cursor: pointer; text-decoration: none; }\n\n    .auth-error { color: #f44336; font-size: 13px; margin-top: 8px; min-height: 18px; }\n\n    /* ── App Layout ────────────────────────────────── */\n    #app-screen { display: none; width: 100%; height: 100vh; }\n\n    .sidebar {\n      width: 260px;\n      background: var(--surface);\n      border-right: 1px solid var(--border);\n      display: flex;\n      flex-direction: column;\n      flex-shrink: 0;\n    }\n\n    .sidebar-header {\n      padding: 20px;\n      border-bottom: 1px solid var(--border);\n    }\n    .sidebar-header h2 {\n      font-family: 'Playfair Display', serif;\n      font-size: 22px;\n    }\n    .sidebar-header .user-name {\n      font-size: 13px;\n      color: var(--text-muted);\n      margin-top: 4px;\n    }\n\n    /* ── Badge Display ────────────────────────────── */\n    .badge-display {\n      display: flex;\n      gap: 6px;\n      margin-top: 10px;\n      flex-wrap: wrap;\n    }\n    .badge-icon {\n      font-size: 18px;\n      cursor: help;\n      position: relative;\n      display: inline-block;\n    }\n    .badge-icon .badge-tooltip {\n      visibility: hidden;\n      position: absolute;\n      bottom: 100%;\n      left: 50%;\n      transform: translateX(-50%);\n      background: var(--surface-2);\n      color: var(--text);\n      padding: 6px 10px;\n      border-radius: 6px;\n      font-size: 11px;\n      white-space: nowrap;\n      margin-bottom: 6px;\n      border: 1px solid var(--border);\n      z-index: 10;\n      pointer-events: none;\n    }\n    .badge-icon:hover .badge-tooltip {\n      visibility: visible;\n    }\n\n    /* ── Badge Celebration Animation ────────────── */\n    @keyframes badgePop {\n      0% { transform: scale(0); opacity: 0; }\n      50% { transform: scale(1.2); opacity: 1; }\n      100% { transform: scale(1); opacity: 1; }\n    }\n    .badge-celebration {\n      position: fixed;\n      top: 50%;\n      left: 50%;\n      transform: translate(-50%, -50%);\n      background: var(--surface);\n      border: 2px solid var(--accent);\n      border-radius: 16px;\n      padding: 32px;\n      text-align: center;\n      z-index: 2000;\n      animation: badgePop 0.5s ease;\n      box-shadow: 0 8px 32px rgba(0,0,0,0.5);\n    }\n    .badge-celebration-emoji {\n      font-size: 64px;\n      margin-bottom: 12px;\n    }\n    .badge-celebration h3 {\n      font-size: 20px;\n      margin-bottom: 8px;\n      color: var(--accent);\n    }\n    .badge-celebration p {\n      font-size: 14px;\n      color: var(--text-muted);\n    }\n    .badge-overlay {\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      background: rgba(0, 0, 0, 0.7);\n      z-index: 1999;\n    }\n\n    .nav-items { flex: 1; padding: 12px; overflow-y: auto; }\n\n    .nav-item {\n      display: flex;\n      align-items: center;\n      gap: 12px;\n      padding: 12px 14px;\n      border-radius: 8px;\n      cursor: pointer;\n      font-size: 14px;\n      color: var(--text-muted);\n      transition: all 0.15s;\n      margin-bottom: 4px;\n    }\n    .nav-item:hover { background: var(--surface-2); color: var(--text); }\n    .nav-item.active { background: var(--accent-soft); color: var(--accent); }\n    .nav-item svg { width: 20px; height: 20px; flex-shrink: 0; }\n\n    .sidebar-footer {\n      padding: 12px;\n      border-top: 1px solid var(--border);\n    }\n    .logout-btn {\n      width: 100%;\n      padding: 10px;\n      background: transparent;\n      border: 1px solid var(--border);\n      border-radius: 8px;\n      color: var(--text-muted);\n      font-size: 13px;\n      cursor: pointer;\n      transition: all 0.15s;\n    }\n    .logout-btn:hover { border-color: #f44336; color: #f44336; }\n\n    /* ── Main Content ──────────────────────────────── */\n    .main-content {\n      flex: 1;\n      display: flex;\n      flex-direction: column;\n      overflow: hidden;\n    }\n\n    /* ── Chat View ─────────────────────────────────── */\n    .chat-messages {\n      flex: 1;\n      overflow-y: auto;\n      padding: 20px;\n      display: flex;\n      flex-direction: column;\n      gap: 16px;\n    }\n\n    .message {\n      max-width: 75%;\n      padding: 12px 16px;\n      border-radius: 16px;\n      font-size: 14px;\n      line-height: 1.6;\n      white-space: pre-wrap;\n      position: relative;\n    }\n    .message.user {\n      align-self: flex-end;\n      background: var(--accent);\n      color: #fff;\n      border-bottom-right-radius: 4px;\n    }\n    .message.assistant {\n      align-self: flex-start;\n      background: var(--surface-2);\n      border: 1px solid var(--border);\n      border-bottom-left-radius: 4px;\n    }\n    .message .msg-time {\n      font-size: 11px;\n      opacity: 0.6;\n      margin-top: 6px;\n      display: block;\n    }\n\n    /* ── Sentiment Indicator ───────────────────────── */\n    .sentiment-dot {\n      width: 8px;\n      height: 8px;\n      border-radius: 50%;\n      position: absolute;\n      top: 8px;\n      right: 8px;\n    }\n    .sentiment-positive { background: #4caf50; }\n    .sentiment-neutral { background: #ffc107; }\n    .sentiment-negative { background: #f44336; }\n\n    .chat-input-area {\n      padding: 16px 20px;\n      border-top: 1px solid var(--border);\n      background: var(--surface);\n    }\n    .chat-input-wrap {\n      display: flex;\n      gap: 10px;\n      align-items: flex-end;\n    }\n    .chat-input-wrap textarea {\n      flex: 1;\n      padding: 12px 14px;\n      background: var(--surface-2);\n      border: 1px solid var(--border);\n      border-radius: 12px;\n      color: var(--text);\n      font-family: inherit;\n      font-size: 14px;\n      resize: none;\n      outline: none;\n      max-height: 120px;\n      min-height: 44px;\n      line-height: 1.4;\n      transition: border-color 0.2s;\n    }\n    .chat-input-wrap textarea:focus { border-color: var(--accent); }\n    .send-btn {\n      width: 44px;\n      height: 44px;\n      background: var(--accent);\n      border: none;\n      border-radius: 12px;\n      color: #fff;\n      cursor: pointer;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      flex-shrink: 0;\n      transition: opacity 0.2s;\n    }\n    .send-btn:hover { opacity: 0.9; }\n    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }\n\n    /* ── Panel Views (Journal, Goals, Check-in, Insights) ──── */\n    .panel-view { display: none; flex: 1; overflow-y: auto; padding: 24px; }\n    .panel-view.active { display: block; }\n\n    .panel-header {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      margin-bottom: 24px;\n    }\n    .panel-header h2 { font-size: 22px; font-family: 'Playfair Display', serif; }\n\n    .card {\n      background: var(--surface);\n      border: 1px solid var(--border);\n      border-radius: var(--radius);\n      padding: 16px;\n      margin-bottom: 12px;\n    }\n    .card h3 { font-size: 15px; margin-bottom: 6px; }\n    .card p { font-size: 13px; color: var(--text-muted); line-height: 1.5; }\n    .card .meta { font-size: 12px; color: var(--text-muted); margin-top: 8px; }\n\n    .btn-sm {\n      padding: 8px 16px;\n      background: var(--accent);\n      color: #fff;\n      border: none;\n      border-radius: 8px;\n      font-size: 13px;\n      font-weight: 600;\n      cursor: pointer;\n    }\n\n    /* ── Insights Dashboard ─────────────────────────── */\n    .insights-grid {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n      gap: 16px;\n      margin-bottom: 24px;\n    }\n\n    .insight-card {\n      background: var(--surface);\n      border: 1px solid var(--border);\n      border-radius: var(--radius);\n      padding: 20px;\n    }\n    .insight-card h3 {\n      font-size: 14px;\n      color: var(--text-muted);\n      margin-bottom: 12px;\n      text-transform: uppercase;\n      letter-spacing: 0.5px;\n    }\n    .insight-value {\n      font-size: 32px;\n      font-weight: 700;\n      color: var(--accent);\n      margin-bottom: 4px;\n    }\n    .insight-label {\n      font-size: 13px;\n      color: var(--text-muted);\n    }\n\n    /* ── CSS Mood Chart ────────────────────────────── */\n    .mood-chart {\n      display: flex;\n      align-items: flex-end;\n      gap: 6px;\n      height: 120px;\n      margin-top: 16px;\n    }\n    .mood-bar {\n      flex: 1;\n      background: var(--surface-2);\n      border-radius: 4px 4px 0 0;\n      position: relative;\n      transition: all 0.3s;\n      cursor: pointer;\n      min-height: 12px;\n    }\n    .mood-bar:hover {\n      opacity: 0.8;\n    }\n    .mood-bar.low { background: linear-gradient(to top, #f44336, #e57373); }\n    .mood-bar.medium { background: linear-gradient(to top, #ffc107, #ffd54f); }\n    .mood-bar.high { background: linear-gradient(to top, #4caf50, #81c784); }\n    .mood-bar .bar-label {\n      position: absolute;\n      bottom: -20px;\n      left: 50%;\n      transform: translateX(-50%);\n      font-size: 10px;\n      color: var(--text-muted);\n      white-space: nowrap;\n    }\n    .mood-bar .bar-value {\n      position: absolute;\n      top: -20px;\n      left: 50%;\n      transform: translateX(-50%);\n      font-size: 11px;\n      font-weight: 600;\n      color: var(--text);\n      opacity: 0;\n      transition: opacity 0.2s;\n    }\n    .mood-bar:hover .bar-value {\n      opacity: 1;\n    }\n\n    .weekly-summary {\n      background: var(--surface);\n      border: 1px solid var(--border);\n      border-radius: var(--radius);\n      padding: 20px;\n      margin-bottom: 16px;\n    }\n    .weekly-summary h3 {\n      font-size: 16px;\n      margin-bottom: 12px;\n      display: flex;\n      align-items: center;\n      gap: 8px;\n    }\n    .weekly-summary p {\n      font-size: 14px;\n      line-height: 1.6;\n      color: var(--text);\n    }\n\n    .stat-grid {\n      display: grid;\n      grid-template-columns: repeat(2, 1fr);\n      gap: 12px;\n      margin-top: 16px;\n    }\n    .stat-item {\n      text-align: center;\n    }\n    .stat-value {\n      font-size: 24px;\n      font-weight: 700;\n      color: var(--accent);\n    }\n    .stat-label {\n      font-size: 12px;\n      color: var(--text-muted);\n      margin-top: 4px;\n    }\n\n    /* ── Forms inside panels ─────────────────────── */\n    .panel-form { margin-bottom: 24px; }\n    .panel-form .form-group { margin-bottom: 12px; }\n    .panel-form textarea {\n      width: 100%;\n      padding: 12px 14px;\n      background: var(--surface-2);\n      border: 1px solid var(--border);\n      border-radius: 8px;\n      color: var(--text);\n      font-family: inherit;\n      font-size: 14px;\n      resize: vertical;\n      outline: none;\n      min-height: 80px;\n    }\n    .panel-form textarea:focus { border-color: var(--accent); }\n\n    .mood-selector {\n      display: flex;\n      gap: 8px;\n      flex-wrap: wrap;\n    }\n    .mood-btn {\n      width: 40px;\n      height: 40px;\n      border-radius: 50%;\n      border: 2px solid var(--border);\n      background: var(--surface-2);\n      color: var(--text);\n      font-size: 14px;\n      cursor: pointer;\n      transition: all 0.15s;\n    }\n    .mood-btn:hover { border-color: var(--accent); }\n    .mood-btn.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }\n\n    /* ── Progress bar ────────────────────────────── */\n    .progress-bar {\n      height: 6px;\n      background: var(--surface-2);\n      border-radius: 3px;\n      margin-top: 10px;\n      overflow: hidden;\n    }\n    .progress-bar .fill {\n      height: 100%;\n      background: var(--accent);\n      border-radius: 3px;\n      transition: width 0.3s;\n    }\n\n    .streak-badge {\n      display: inline-flex;\n      align-items: center;\n      gap: 4px;\n      background: var(--accent-soft);\n      color: var(--accent);\n      padding: 4px 10px;\n      border-radius: 20px;\n      font-size: 13px;\n      font-weight: 600;\n    }\n\n    .empty-state {\n      text-align: center;\n      padding: 48px 20px;\n      color: var(--text-muted);\n    }\n    .empty-state p { font-size: 14px; }\n\n    .typing-indicator {\n      display: none;\n      align-self: flex-start;\n      padding: 12px 16px;\n      background: var(--surface-2);\n      border: 1px solid var(--border);\n      border-radius: 16px;\n      border-bottom-left-radius: 4px;\n      font-size: 14px;\n      color: var(--text-muted);\n    }\n    .typing-indicator.visible { display: block; }\n\n    /* ── Responsive ───────────────────────────────── */\n    @media (max-width: 768px) {\n      .sidebar { display: none; position: fixed; z-index: 100; width: 100%; height: 100%; }\n      .sidebar.open { display: flex; }\n      .mobile-header {\n        display: flex !important;\n        align-items: center;\n        gap: 12px;\n        padding: 12px 16px;\n        border-bottom: 1px solid var(--border);\n        background: var(--surface);\n      }\n      .hamburger {\n        background: none;\n        border: none;\n        color: var(--text);\n        font-size: 24px;\n        cursor: pointer;\n        padding: 4px;\n      }\n      .message { max-width: 90%; }\n      .insights-grid {\n        grid-template-columns: 1fr;\n      }\n      .stat-grid {\n        grid-template-columns: 1fr;\n      }\n    }\n\n    .mobile-header { display: none; }\n\n    /* ── Onboarding Overlay ──────────────────────── */\n    .onboarding-overlay {\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      background: rgba(0, 0, 0, 0.75);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      z-index: 1000;\n      padding: 20px;\n      animation: fadeIn 0.3s ease;\n    }\n    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\n    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }\n\n    .onboarding-card {\n      background: var(--surface);\n      border: 1px solid var(--border);\n      border-radius: 20px;\n      padding: 40px;\n      max-width: 480px;\n      width: 100%;\n      text-align: center;\n      animation: slideUp 0.4s ease;\n    }\n    .onboarding-card h2 {\n      font-family: 'Playfair Display', serif;\n      font-size: 26px;\n      margin-bottom: 12px;\n    }\n    .onboarding-card p {\n      color: var(--text-muted);\n      font-size: 15px;\n      line-height: 1.6;\n      margin-bottom: 24px;\n    }\n    .onboarding-avatar {\n      width: 72px;\n      height: 72px;\n      border-radius: 50%;\n      background: var(--accent-soft);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      margin: 0 auto 20px;\n    }\n    .onboarding-avatar svg {\n      width: 36px;\n      height: 36px;\n      color: var(--accent);\n    }\n\n    .onboarding-step-indicator {\n      display: flex;\n      gap: 8px;\n      justify-content: center;\n      margin-bottom: 28px;\n    }\n    .onboarding-dot {\n      width: 8px;\n      height: 8px;\n      border-radius: 50%;\n      background: var(--border);\n      transition: background 0.3s, width 0.3s;\n    }\n    .onboarding-dot.active {\n      background: var(--accent);\n      width: 24px;\n      border-radius: 4px;\n    }\n\n    .interest-chips {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 10px;\n      justify-content: center;\n      margin-bottom: 24px;\n    }\n    .interest-chip {\n      padding: 10px 18px;\n      border-radius: 24px;\n      border: 1.5px solid var(--border);\n      background: var(--surface-2);\n      color: var(--text-muted);\n      font-size: 14px;\n      cursor: pointer;\n      transition: all 0.2s;\n      user-select: none;\n    }\n    .interest-chip:hover {\n      border-color: var(--accent);\n      color: var(--text);\n    }\n    .interest-chip.selected {\n      border-color: var(--accent);\n      background: var(--accent-soft);\n      color: var(--accent);\n      font-weight: 500;\n    }\n    .interest-chip-hint {\n      font-size: 13px;\n      color: var(--text-muted);\n      margin-bottom: 16px;\n    }\n\n    .onboarding-btn {\n      display: inline-block;\n      padding: 14px 32px;\n      background: var(--accent);\n      color: #fff;\n      border: none;\n      border-radius: 12px;\n      font-size: 15px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: opacity 0.2s, transform 0.15s;\n      margin-top: 4px;\n    }\n    .onboarding-btn:hover { opacity: 0.9; transform: translateY(-1px); }\n\n    .onboarding-checkmark {\n      width: 64px;\n      height: 64px;\n      border-radius: 50%;\n      background: rgba(76, 175, 80, 0.15);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      margin: 0 auto 20px;\n    }\n    .onboarding-checkmark svg {\n      width: 32px;\n      height: 32px;\n      color: var(--success);\n    }\n\n    /* ── Chat Welcome Area ───────────────────────── */\n    .chat-welcome {\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      flex: 1;\n      padding: 40px 20px;\n      text-align: center;\n    }\n    .chat-welcome-avatar {\n      width: 80px;\n      height: 80px;\n      border-radius: 50%;\n      background: var(--accent-soft);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      margin-bottom: 20px;\n    }\n    .chat-welcome-avatar svg {\n      width: 40px;\n      height: 40px;\n      color: var(--accent);\n    }\n    .chat-welcome h3 {\n      font-family: 'Playfair Display', serif;\n      font-size: 22px;\n      margin-bottom: 8px;\n    }\n    .chat-welcome p {\n      color: var(--text-muted);\n      font-size: 14px;\n      line-height: 1.6;\n      max-width: 380px;\n      margin-bottom: 24px;\n    }\n    .starter-chips {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 10px;\n      justify-content: center;\n      max-width: 480px;\n    }\n    .starter-chip {\n      padding: 10px 18px;\n      border-radius: 20px;\n      border: 1px solid var(--border);\n      background: var(--surface);\n      color: var(--text);\n      font-size: 13px;\n      cursor: pointer;\n      transition: all 0.2s;\n    }\n    .starter-chip:hover {\n      border-color: var(--accent);\n      background: var(--accent-soft);\n      color: var(--accent);\n    }\n\n    /* ── Back to Home Link ───────────────────────── */\n    .back-to-home {\n      display: block;\n      text-align: center;\n      font-size: 12px;\n      color: var(--text-muted);\n      text-decoration: none;\n      padding: 8px 10px 4px;\n      transition: color 0.15s;\n    }\n    .back-to-home:hover { color: var(--accent); }\n  </style>\n</head>\n<body>\n\n  <!-- ── Auth Screen ─────────────────────────────── -->\n  <div id=\"auth-screen\">\n    <div class=\"auth-card\">\n      <h1 id=\"auth-title\">Welcome to Alhena</h1>\n      <p id=\"auth-subtitle\">Sign in to start your journey</p>\n\n      <form id=\"auth-form\">\n        <div class=\"form-group\" id=\"name-group\" style=\"display:none\">\n          <label for=\"auth-name\">Name</label>\n          <input type=\"text\" id=\"auth-name\" placeholder=\"Your name\">\n        </div>\n        <div class=\"form-group\">\n          <label for=\"auth-email\">Email</label>\n          <input type=\"email\" id=\"auth-email\" placeholder=\"you@example.com\" required>\n        </div>\n        <div class=\"form-group\">\n          <label for=\"auth-password\">Password</label>\n          <input type=\"password\" id=\"auth-password\" placeholder=\"Min. 8 characters\" required minlength=\"8\">\n        </div>\n        <button type=\"submit\" class=\"btn\" id=\"auth-btn\">Sign In</button>\n        <div class=\"auth-error\" id=\"auth-error\"></div>\n      </form>\n\n      <div class=\"auth-toggle\">\n        <span id=\"auth-toggle-text\">Don't have an account?</span>\n        <a id=\"auth-toggle-link\" onclick=\"toggleAuthMode()\">Sign Up</a>\n      </div>\n      <div class=\"auth-toggle\">\n        <a onclick=\"cancelSignIn()\">Continue without signing in</a>\n      </div>\n    </div>\n  </div>\n\n  <!-- ── Onboarding Overlay ────────────────────────── -->\n  <div class=\"onboarding-overlay\" id=\"onboarding-overlay\" style=\"display:none\">\n    <div class=\"onboarding-card\">\n      <div class=\"onboarding-step-indicator\">\n        <div class=\"onboarding-dot active\" id=\"ob-dot-1\"></div>\n        <div class=\"onboarding-dot\" id=\"ob-dot-2\"></div>\n        <div class=\"onboarding-dot\" id=\"ob-dot-3\"></div>\n      </div>\n\n      <!-- Step 1: Welcome -->\n      <div id=\"ob-step-1\">\n        <div class=\"onboarding-avatar\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z\"/></svg>\n        </div>\n        <h2>Welcome to Alhena</h2>\n        <p>I'm your personal AI companion for reflection, growth, and well-being. Think of me as a thoughtful friend who's always here to listen.</p>\n        <button class=\"onboarding-btn\" onclick=\"onboardingNext(2)\">Continue</button>\n      </div>\n\n      <!-- Step 2: Interests -->\n      <div id=\"ob-step-2\" style=\"display:none\">\n        <h2>What brings you here?</h2>\n        <p>Select 1-3 areas you're interested in. This helps me personalize your experience.</p>\n        <div class=\"interest-chips\" id=\"interest-chips\">\n          <div class=\"interest-chip\" data-interest=\"stress_anxiety\" onclick=\"toggleInterest(this)\">Stress &amp; Anxiety</div>\n          <div class=\"interest-chip\" data-interest=\"career_guidance\" onclick=\"toggleInterest(this)\">Career Guidance</div>\n          <div class=\"interest-chip\" data-interest=\"personal_growth\" onclick=\"toggleInterest(this)\">Personal Growth</div>\n          <div class=\"interest-chip\" data-interest=\"relationships\" onclick=\"toggleInterest(this)\">Relationships</div>\n          <div class=\"interest-chip\" data-interest=\"health_wellness\" onclick=\"toggleInterest(this)\">Health &amp; Wellness</div>\n          <div class=\"interest-chip\" data-interest=\"decision_making\" onclick=\"toggleInterest(this)\">Decision Making</div>\n        </div>\n        <div class=\"interest-chip-hint\" id=\"interest-hint\">Choose at least 1 topic</div>\n        <button class=\"onboarding-btn\" id=\"ob-interests-btn\" onclick=\"onboardingNext(3)\" style=\"opacity:0.5;pointer-events:none\">Continue</button>\n      </div>\n\n      <!-- Step 3: All Set -->\n      <div id=\"ob-step-3\" style=\"display:none\">\n        <div class=\"onboarding-checkmark\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.5\" d=\"M5 13l4 4L19 7\"/></svg>\n        </div>\n        <h2>You're all set!</h2>\n        <p id=\"ob-summary\">Your personalized experience is ready. Alhena is here whenever you need a thoughtful conversation, journaling space, or help tracking your goals.</p>\n        <button class=\"onboarding-btn\" onclick=\"finishOnboarding()\">Start Chatting</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ── App Screen ──────────────────────────────── -->\n  <div id=\"app-screen\">\n    <!-- Mobile Header -->\n    <div class=\"mobile-header\">\n      <button class=\"hamburger\" onclick=\"toggleSidebar()\">&#9776;</button>\n      <span style=\"font-weight:600\">Alhena</span>\n    </div>\n\n    <!-- Sidebar -->\n    <div class=\"sidebar\" id=\"sidebar\">\n      <div class=\"sidebar-header\">\n        <h2>Alhena</h2>\n        <div class=\"user-name\" id=\"user-display-name\"></div>\n        <div class=\"badge-display\" id=\"badge-display\"></div>\n      </div>\n\n      <div class=\"nav-items\">\n        <div class=\"nav-item active\" data-view=\"chat\" onclick=\"switchView('chat')\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z\"/></svg>\n          Chat\n        </div>\n        <div class=\"nav-item\" data-view=\"journal\" onclick=\"switchView('journal')\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253\"/></svg>\n          Journal\n        </div>\n        <div class=\"nav-item\" data-view=\"goals\" onclick=\"switchView('goals')\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z\"/></svg>\n          Goals\n        </div>\n        <div class=\"nav-item\" data-view=\"checkin\" onclick=\"switchView('checkin')\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z\"/></svg>\n          Wellness\n        </div>\n        <div class=\"nav-item\" data-view=\"insights\" onclick=\"switchView('insights')\">\n          <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z\"/></svg>\n          Insights\n        </div>\n      </div>\n\n      <div class=\"sidebar-footer\">\n        <a href=\"/\" class=\"back-to-home\">&larr; Back to alhena.cc</a>\n        <a href=\"#\" class=\"back-to-home\" id=\"sign-in-link\" style=\"display:none\" onclick=\"showSignInScreen(); return false;\">Sign in with a real account</a>\n        <button class=\"logout-btn\" id=\"sign-out-btn\" onclick=\"logout()\">Sign Out</button>\n      </div>\n    </div>\n\n    <!-- Main Content -->\n    <div class=\"main-content\">\n\n      <!-- Chat View -->\n      <div id=\"view-chat\" style=\"display:flex;flex-direction:column;flex:1;overflow:hidden\">\n        <!-- Welcome area shown when no messages -->\n        <div class=\"chat-welcome\" id=\"chat-welcome\" style=\"display:none\">\n          <div class=\"chat-welcome-avatar\">\n            <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z\"/></svg>\n          </div>\n          <h3 id=\"chat-welcome-greeting\">Hello! I'm Alhena</h3>\n          <p>Your companion for reflection, growth, and well-being. Start a conversation, or try one of these:</p>\n          <div class=\"starter-chips\">\n            <div class=\"starter-chip\" onclick=\"sendStarter(this)\">I'm feeling stressed about work</div>\n            <div class=\"starter-chip\" onclick=\"sendStarter(this)\">Help me set a new goal</div>\n            <div class=\"starter-chip\" onclick=\"sendStarter(this)\">I need to make a big decision</div>\n          </div>\n        </div>\n        <div class=\"chat-messages\" id=\"chat-messages\"></div>\n        <div class=\"typing-indicator\" id=\"typing-indicator\">Alhena is thinking...</div>\n        <div class=\"chat-input-area\">\n          <div class=\"chat-input-wrap\">\n            <textarea id=\"chat-input\" placeholder=\"What's on your mind?\" rows=\"1\" onkeydown=\"handleChatKey(event)\"></textarea>\n            <button class=\"send-btn\" id=\"send-btn\" onclick=\"sendMessage()\">\n              <svg width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 19V5m-7 7l7-7 7 7\"/></svg>\n            </button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Journal View -->\n      <div id=\"view-journal\" class=\"panel-view\">\n        <div class=\"panel-header\">\n          <h2>Memory Journal</h2>\n          <button class=\"btn-sm\" onclick=\"showJournalForm()\">+ New Entry</button>\n        </div>\n\n        <div id=\"journal-form\" class=\"panel-form\" style=\"display:none\">\n          <div class=\"form-group\">\n            <label>Title (optional)</label>\n            <input type=\"text\" id=\"journal-title\" placeholder=\"Give it a title...\" style=\"width:100%;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none\">\n          </div>\n          <div class=\"form-group\">\n            <label>What's on your mind?</label>\n            <textarea id=\"journal-content\" placeholder=\"Write freely...\"></textarea>\n          </div>\n          <div class=\"form-group\">\n            <label>Mood</label>\n            <div class=\"mood-selector\" id=\"journal-mood\">\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"1\">1</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"2\">2</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"3\">3</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"4\">4</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"5\">5</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"6\">6</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"7\">7</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"8\">8</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"9\">9</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"10\">10</button>\n            </div>\n          </div>\n          <button class=\"btn-sm\" onclick=\"submitJournal()\">Save Entry</button>\n          <button class=\"btn-sm\" style=\"background:transparent;border:1px solid var(--border);margin-left:8px\" onclick=\"hideJournalForm()\">Cancel</button>\n        </div>\n\n        <div id=\"journal-list\"></div>\n      </div>\n\n      <!-- Goals View -->\n      <div id=\"view-goals\" class=\"panel-view\">\n        <div class=\"panel-header\">\n          <h2>Goal Tracking</h2>\n          <button class=\"btn-sm\" onclick=\"showGoalForm()\">+ New Goal</button>\n        </div>\n\n        <div id=\"goal-form\" class=\"panel-form\" style=\"display:none\">\n          <div class=\"form-group\">\n            <label>Goal title</label>\n            <input type=\"text\" id=\"goal-title\" placeholder=\"What do you want to achieve?\" style=\"width:100%;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none\">\n          </div>\n          <div class=\"form-group\">\n            <label>Description (optional)</label>\n            <textarea id=\"goal-desc\" placeholder=\"Describe your goal...\"></textarea>\n          </div>\n          <div class=\"form-group\">\n            <label>Category</label>\n            <select id=\"goal-category\" style=\"width:100%;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none\">\n              <option value=\"general\">General</option>\n              <option value=\"health\">Health & Wellness</option>\n              <option value=\"career\">Career</option>\n              <option value=\"relationships\">Relationships</option>\n              <option value=\"personal\">Personal Growth</option>\n              <option value=\"financial\">Financial</option>\n            </select>\n          </div>\n          <button class=\"btn-sm\" onclick=\"submitGoal()\">Create Goal</button>\n          <button class=\"btn-sm\" style=\"background:transparent;border:1px solid var(--border);margin-left:8px\" onclick=\"hideGoalForm()\">Cancel</button>\n        </div>\n\n        <div id=\"goals-list\"></div>\n      </div>\n\n      <!-- Wellness Check-in View -->\n      <div id=\"view-checkin\" class=\"panel-view\">\n        <div class=\"panel-header\">\n          <h2>Daily Wellness</h2>\n          <div id=\"streak-display\"></div>\n        </div>\n\n        <div id=\"checkin-form\" class=\"panel-form\">\n          <div class=\"card\">\n            <h3>How are you feeling today?</h3>\n            <p style=\"margin-bottom:12px\">Rate your mood from 1 (low) to 10 (great)</p>\n            <div class=\"mood-selector\" id=\"checkin-mood\">\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"1\">1</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"2\">2</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"3\">3</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"4\">4</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"5\">5</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"6\">6</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"7\">7</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"8\">8</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"9\">9</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"10\">10</button>\n            </div>\n          </div>\n\n          <div class=\"card\">\n            <h3>Energy level</h3>\n            <p style=\"margin-bottom:12px\">How's your energy? (1-10)</p>\n            <div class=\"mood-selector\" id=\"checkin-energy\">\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"1\">1</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"2\">2</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"3\">3</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"4\">4</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"5\">5</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"6\">6</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"7\">7</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"8\">8</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"9\">9</button>\n              <button type=\"button\" class=\"mood-btn\" data-mood=\"10\">10</button>\n            </div>\n          </div>\n\n          <div class=\"card\">\n            <h3>Any notes?</h3>\n            <textarea id=\"checkin-note\" placeholder=\"Anything on your mind...\" style=\"width:100%;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:14px;resize:vertical;outline:none;min-height:60px;margin-top:8px\"></textarea>\n          </div>\n\n          <button class=\"btn\" style=\"max-width:200px\" onclick=\"submitCheckin()\">Submit Check-in</button>\n        </div>\n\n        <div id=\"checkin-response\" style=\"display:none;margin-top:16px\"></div>\n\n        <h3 style=\"margin-top:32px;margin-bottom:16px\">Recent Check-ins</h3>\n        <div id=\"checkin-history\"></div>\n      </div>\n\n      <!-- Insights View -->\n      <div id=\"view-insights\" class=\"panel-view\">\n        <div class=\"panel-header\">\n          <h2>Your Insights</h2>\n        </div>\n\n        <!-- Weekly Summary -->\n        <div class=\"weekly-summary\">\n          <h3>\n            <svg width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\" style=\"flex-shrink:0\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z\"/></svg>\n            Weekly Summary\n          </h3>\n          <p id=\"weekly-summary-text\">Loading your insights...</p>\n        </div>\n\n        <!-- Stats Grid -->\n        <div class=\"insights-grid\">\n          <div class=\"insight-card\">\n            <h3>Wellness Streak</h3>\n            <div style=\"display:flex;align-items:center;gap:8px\">\n              <div class=\"insight-value\" id=\"insight-streak\">0</div>\n              <span style=\"font-size:28px\">🔥</span>\n            </div>\n            <div class=\"insight-label\">Days in a row</div>\n          </div>\n\n          <div class=\"insight-card\">\n            <h3>Conversation Stats</h3>\n            <div class=\"insight-value\" id=\"insight-conversations\">0</div>\n            <div class=\"insight-label\">Total conversations</div>\n            <div class=\"stat-grid\" style=\"margin-top:12px\">\n              <div class=\"stat-item\">\n                <div class=\"stat-value\" id=\"insight-messages-week\">0</div>\n                <div class=\"stat-label\">This week</div>\n              </div>\n              <div class=\"stat-item\">\n                <div class=\"stat-value\" id=\"insight-avg-engagement\">0</div>\n                <div class=\"stat-label\">Avg. messages</div>\n              </div>\n            </div>\n          </div>\n\n          <div class=\"insight-card\">\n            <h3>Goal Progress</h3>\n            <div class=\"insight-value\" id=\"insight-goal-completion\">0%</div>\n            <div class=\"insight-label\">Overall completion</div>\n            <div class=\"stat-grid\" style=\"margin-top:12px\">\n              <div class=\"stat-item\">\n                <div class=\"stat-value\" id=\"insight-goals-active\">0</div>\n                <div class=\"stat-label\">Active</div>\n              </div>\n              <div class=\"stat-item\">\n                <div class=\"stat-value\" id=\"insight-goals-completed\">0</div>\n                <div class=\"stat-label\">Completed</div>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <!-- Mood Trend Chart -->\n        <div class=\"insight-card\">\n          <h3>Mood Trend (Last 14 Days)</h3>\n          <div class=\"mood-chart\" id=\"mood-chart\">\n            <!-- Bars will be generated dynamically -->\n          </div>\n        </div>\n\n      </div>\n\n    </div>\n  </div>\n\n  <script>\n    // ── Config ─────────────────────────────────────\n    const API = window.location.hostname === 'localhost'\n      ? 'http://localhost:8787'\n      : 'https://alhena.cc';\n\n    // Conglomerate-wide identity provider (mascom/CLAUDE.md: \"AuthFor for\n    // auth, not a per-venture choice\") - Alhena has no local user store.\n    const AUTHFOR_API = 'https://authfor.com';\n\n    let authToken = localStorage.getItem('alhena_token');\n    let currentUser = null;\n    let isSignup = false;\n\n    // ── Anonymous, no-signup identity (added 2026-09-13) ────────────\n    // Real product decision, John's own words: \"we are making what is\n    // currently texting Jim into the alhena.cc product users around the\n    // world can start using at this time for free... there should be no\n    // signup required, it should just name them color animal\n    // tradePersonType.\" A real anonymous UUID (worker.js's\n    // resolveIdentity()/getOrCreateAnonymousProfile()) is persisted here\n    // in localStorage and replayed on every API call via the\n    // X-Alhena-Anon-Id header - see api() below. Chosen over a cookie\n    // because this file's api() helper already attaches identity\n    // manually via headers, never `credentials: 'include'`.\n    let anonId = localStorage.getItem('alhena_anon_id');\n    let selectedJournalMood = null;\n    let selectedCheckinMood = null;\n    let selectedCheckinEnergy = null;\n\n    // ── Session State (Smarter AI Engine) ─────────\n    let sessionTopics = [];\n    let sessionMessageCount = 0;\n    let lastDeepFollowupAt = 0;\n\n    // ── Badge System ───────────────────────────────\n    const BADGES = {\n      first_chat: { emoji: '💬', name: 'First Chat', description: 'Sent your first message' },\n      journaling_spirit: { emoji: '📝', name: 'Journaling Spirit', description: 'Created 3+ journal entries' },\n      goal_setter: { emoji: '🎯', name: 'Goal Setter', description: 'Created your first goal' },\n      wellness_warrior: { emoji: '💪', name: 'Wellness Warrior', description: '7-day check-in streak' },\n      deep_thinker: { emoji: '🧠', name: 'Deep Thinker', description: 'Had a 10+ message conversation' },\n      self_aware: { emoji: '✨', name: 'Self-Aware', description: 'Completed all onboarding interests' }\n    };\n\n    function getBadges() {\n      const badges = localStorage.getItem('alhena_badges');\n      return badges ? JSON.parse(badges) : [];\n    }\n\n    function setBadges(badges) {\n      localStorage.setItem('alhena_badges', JSON.stringify(badges));\n    }\n\n    function earnBadge(badgeKey) {\n      const earned = getBadges();\n      if (earned.includes(badgeKey)) return false;\n      earned.push(badgeKey);\n      setBadges(earned);\n      showBadgeCelebration(badgeKey);\n      renderBadges();\n      return true;\n    }\n\n    function showBadgeCelebration(badgeKey) {\n      const badge = BADGES[badgeKey];\n      if (!badge) return;\n\n      const overlay = document.createElement('div');\n      overlay.className = 'badge-overlay';\n      overlay.onclick = () => {\n        overlay.remove();\n        celebration.remove();\n      };\n\n      const celebration = document.createElement('div');\n      celebration.className = 'badge-celebration';\n      celebration.innerHTML = `\n        <div class=\"badge-celebration-emoji\">${badge.emoji}</div>\n        <h3>Badge Unlocked!</h3>\n        <p><strong>${badge.name}</strong></p>\n        <p>${badge.description}</p>\n      `;\n      celebration.onclick = () => {\n        overlay.remove();\n        celebration.remove();\n      };\n\n      document.body.appendChild(overlay);\n      document.body.appendChild(celebration);\n\n      setTimeout(() => {\n        if (overlay.parentNode) overlay.remove();\n        if (celebration.parentNode) celebration.remove();\n      }, 4000);\n    }\n\n    function renderBadges() {\n      const earned = getBadges();\n      const container = document.getElementById('badge-display');\n      if (!container) return;\n\n      if (earned.length === 0) {\n        container.innerHTML = '';\n        return;\n      }\n\n      container.innerHTML = earned.map(key => {\n        const badge = BADGES[key];\n        if (!badge) return '';\n        return `\n          <span class=\"badge-icon\">\n            ${badge.emoji}\n            <span class=\"badge-tooltip\">${badge.name}</span>\n          </span>\n        `;\n      }).join('');\n    }\n\n    function checkBadges() {\n      // Check badges asynchronously\n      checkFirstChatBadge();\n      checkJournalingBadge();\n      checkGoalSetterBadge();\n      checkWellnessWarriorBadge();\n      checkDeepThinkerBadge();\n    }\n\n    async function checkFirstChatBadge() {\n      try {\n        const data = await api('/api/chat/history?limit=1');\n        if (data.success && data.messages.length > 0) {\n          earnBadge('first_chat');\n        }\n      } catch {}\n    }\n\n    async function checkJournalingBadge() {\n      try {\n        const data = await api('/api/journal');\n        if (data.success && data.entries.length >= 3) {\n          earnBadge('journaling_spirit');\n        }\n      } catch {}\n    }\n\n    async function checkGoalSetterBadge() {\n      try {\n        const data = await api('/api/goals');\n        if (data.success && data.goals.length > 0) {\n          earnBadge('goal_setter');\n        }\n      } catch {}\n    }\n\n    async function checkWellnessWarriorBadge() {\n      try {\n        const data = await api('/api/checkin/history?days=30');\n        if (data.success && data.summary.streak >= 7) {\n          earnBadge('wellness_warrior');\n        }\n      } catch {}\n    }\n\n    async function checkDeepThinkerBadge() {\n      // This is checked after each conversation in sendMessage()\n    }\n\n    // ── API Helper ─────────────────────────────────\n    async function api(path, opts = {}) {\n      const headers = { 'Content-Type': 'application/json' };\n      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;\n      else if (anonId) headers['X-Alhena-Anon-Id'] = anonId;\n      const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });\n      const data = await res.json();\n      if (!res.ok && res.status === 401) {\n        if (authToken) { logout(); throw new Error('Session expired'); }\n        // 2026-09-13: the free companion routes (chat/guidance/checkin)\n        // never 401 an anonymous caller anymore - this now only fires for\n        // a real AuthFor-only route (Journal/Goals) hit while anonymous,\n        // which is expected, not a broken session. No forced logout.\n        throw new Error(data.error || 'Sign in with a real account to use this feature');\n      }\n      // A response carrying a fresh/renewed anonymous id (any companion\n      // route can mint one on first contact) keeps this browser's stored\n      // id in sync, same identity every subsequent call.\n      if (data && data.identity && data.identity.anonymous && data.identity.id && data.identity.id !== anonId) {\n        anonId = data.identity.id;\n        localStorage.setItem('alhena_anon_id', anonId);\n      }\n      return data;\n    }\n\n    // ── Auth ───────────────────────────────────────\n    function toggleAuthMode() {\n      isSignup = !isSignup;\n      document.getElementById('auth-title').textContent = isSignup ? 'Create Account' : 'Welcome to Alhena';\n      document.getElementById('auth-subtitle').textContent = isSignup ? 'Start your journey of self-discovery' : 'Sign in to start your journey';\n      document.getElementById('auth-btn').textContent = isSignup ? 'Create Account' : 'Sign In';\n      document.getElementById('name-group').style.display = isSignup ? 'block' : 'none';\n      document.getElementById('auth-toggle-text').textContent = isSignup ? 'Already have an account?' : \"Don't have an account?\";\n      document.getElementById('auth-toggle-link').textContent = isSignup ? 'Sign In' : 'Sign Up';\n      document.getElementById('auth-error').textContent = '';\n    }\n\n    document.getElementById('auth-form').addEventListener('submit', async (e) => {\n      e.preventDefault();\n      const btn = document.getElementById('auth-btn');\n      const errEl = document.getElementById('auth-error');\n      btn.disabled = true;\n      errEl.textContent = '';\n\n      const email = document.getElementById('auth-email').value;\n      const password = document.getElementById('auth-password').value;\n      const name = document.getElementById('auth-name').value;\n\n      try {\n        // Alhena has no local user store - identity is conglomerate-wide\n        // AuthFor (mascom/CLAUDE.md standing policy: \"AuthFor for auth,\n        // not a per-venture choice\"). This calls AuthFor's real\n        // /api/v1/register and /api/v1/login directly from the browser\n        // (same contract weylandai's authfor-integration-standard.js\n        // uses), never a local /api/auth/* endpoint.\n        const endpoint = isSignup ? '/api/v1/register' : '/api/v1/login';\n        const body = isSignup ? { email, password, name } : { email, password };\n        const res = await fetch(`${AUTHFOR_API}${endpoint}`, {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify(body)\n        });\n        const data = await res.json();\n\n        if (!res.ok || !data.token) { errEl.textContent = data.error || 'Sign in failed'; btn.disabled = false; return; }\n\n        authToken = data.token;\n        currentUser = data.user;\n        localStorage.setItem('alhena_token', authToken);\n        isNewSignup = isSignup;\n        showApp();\n      } catch (err) {\n        errEl.textContent = 'Network error — please try again';\n      }\n      btn.disabled = false;\n    });\n\n    // Real, no-signup product decision (2026-09-13): signing out of a\n    // real AuthFor account no longer dead-ends at a mandatory login\n    // screen - it drops back to the same free anonymous experience\n    // everyone else gets (init() re-resolves/keeps the anonymous\n    // identity and re-enters the app directly).\n    function logout() {\n      authToken = null;\n      currentUser = null;\n      localStorage.removeItem('alhena_token');\n      init();\n    }\n\n    // Reveals the real AuthFor sign-in screen for a visitor who wants a\n    // real account (cross-device history, or eventually payment) -\n    // opt-in now, never the mandatory first screen.\n    function showSignInScreen() {\n      document.getElementById('app-screen').style.display = 'none';\n      document.getElementById('auth-screen').style.display = 'flex';\n    }\n\n    // \"Continue without signing in\" on the (now opt-in) auth screen -\n    // currentUser is already a real anonymous identity from init(), so\n    // this just goes back to the app.\n    function cancelSignIn() {\n      showApp();\n    }\n\n    // ── App Init ───────────────────────────────────\n    let isNewSignup = false;\n\n    async function showApp() {\n      document.getElementById('auth-screen').style.display = 'none';\n      document.getElementById('app-screen').style.display = 'flex';\n      document.getElementById('user-display-name').textContent = currentUser?.name || currentUser?.email || '';\n\n      // The sign-in/sign-out affordance reflects real state: an\n      // anonymous visitor has nothing to \"sign out\" of, but can opt into\n      // a real account; a real AuthFor user gets the familiar sign-out.\n      const isAnon = !!currentUser?.anonymous;\n      const signInLink = document.getElementById('sign-in-link');\n      const signOutBtn = document.getElementById('sign-out-btn');\n      if (signInLink) signInLink.style.display = isAnon ? 'block' : 'none';\n      if (signOutBtn) signOutBtn.style.display = isAnon ? 'none' : 'block';\n\n      // Render badges\n      renderBadges();\n\n      // Show onboarding for new users who haven't completed it\n      if (!localStorage.getItem('alhena_onboarded') && isNewSignup) {\n        showOnboarding();\n      }\n\n      // Set time-aware greeting\n      setTimeAwareGreeting();\n\n      switchView('chat');\n      loadChatHistory();\n\n      // Check badges\n      checkBadges();\n    }\n\n    function setTimeAwareGreeting() {\n      const hour = new Date().getHours();\n      let timeGreeting = 'Hello';\n      if (hour >= 5 && hour < 12) timeGreeting = 'Good morning';\n      else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';\n      else if (hour >= 17 && hour < 22) timeGreeting = 'Good evening';\n\n      // Real 2026-09-13 product decision: greet a no-signup visitor by\n      // their real generated \"Color Animal TradePersonType\" name (e.g.\n      // \"Hey, Crimson Falcon Electrician\") right in the chat welcome\n      // area - the first thing they see, no signup screen in between.\n      const name = currentUser?.name;\n      const greeting = name ? `${timeGreeting}, ${name}! I'm Alhena` : `${timeGreeting}! I'm Alhena`;\n\n      const el = document.getElementById('chat-welcome-greeting');\n      if (el) el.textContent = greeting;\n    }\n\n    async function init() {\n      if (authToken) {\n        try {\n          // AuthFor's GET /api/v1/verify returns the identity object\n          // directly ({id, email, name}) on a 200, nothing on failure.\n          const res = await fetch(`${AUTHFOR_API}/api/v1/verify`, {\n            headers: { Authorization: `Bearer ${authToken}` }\n          });\n          if (res.ok) {\n            currentUser = await res.json();\n            showApp();\n            return;\n          }\n        } catch {}\n        // A stored token that no longer verifies - fall through to the\n        // real anonymous path below instead of forcing a login screen.\n        authToken = null;\n        localStorage.removeItem('alhena_token');\n      }\n\n      // Real, direct product decision (2026-09-13, John): \"there should\n      // be no signup required, it should just name them color animal\n      // tradePersonType, filling in a random choice for each of those\n      // from a list.\" Resolve (or mint) a real anonymous identity from\n      // worker.js's GET /api/v1/companion/identity and go straight into\n      // the app - no auth screen shown.\n      try {\n        const headers = {};\n        if (anonId) headers['X-Alhena-Anon-Id'] = anonId;\n        const res = await fetch(`${API}/api/v1/companion/identity`, { headers });\n        const data = await res.json();\n        if (data && data.id) {\n          anonId = data.id;\n          localStorage.setItem('alhena_anon_id', anonId);\n          currentUser = { name: data.name, anonymous: true };\n        } else {\n          currentUser = { name: 'Guest', anonymous: true };\n        }\n      } catch (err) {\n        // Even if identity provisioning fails (offline, etc.), still let\n        // the visitor start chatting - the backend mints a real identity\n        // on the first successful companion API call regardless.\n        currentUser = { name: 'Guest', anonymous: true };\n      }\n      showApp();\n    }\n\n    // ── View Switching ─────────────────────────────\n    function switchView(view) {\n      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));\n      document.getElementById('view-chat').style.display = view === 'chat' ? 'flex' : 'none';\n      ['journal', 'goals', 'checkin', 'insights'].forEach(v => {\n        const el = document.getElementById(`view-${v}`);\n        el.classList.toggle('active', v === view);\n      });\n\n      if (view === 'journal') loadJournal();\n      if (view === 'goals') loadGoals();\n      if (view === 'checkin') loadCheckinHistory();\n      if (view === 'insights') loadInsights();\n\n      // Close mobile sidebar\n      document.getElementById('sidebar').classList.remove('open');\n    }\n\n    function toggleSidebar() {\n      document.getElementById('sidebar').classList.toggle('open');\n    }\n\n    // ── Chat ───────────────────────────────────────\n    async function loadChatHistory() {\n      const container = document.getElementById('chat-messages');\n      const welcomeArea = document.getElementById('chat-welcome');\n      try {\n        const data = await api('/api/chat/history?limit=100');\n        if (data.success && data.messages.length > 0) {\n          welcomeArea.style.display = 'none';\n          container.style.display = 'flex';\n          container.innerHTML = data.messages.map(m => renderMessage(m)).join('');\n          container.scrollTop = container.scrollHeight;\n          sessionMessageCount = data.messages.length;\n        } else {\n          // No messages yet — show the welcome area, hide message container\n          welcomeArea.style.display = 'flex';\n          container.style.display = 'none';\n          sessionMessageCount = 0;\n        }\n      } catch {\n        // On error, show the welcome area as a fallback\n        welcomeArea.style.display = 'flex';\n        container.style.display = 'none';\n        sessionMessageCount = 0;\n      }\n    }\n\n    function renderMessage(msg) {\n      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n      const sentiment = msg.role === 'user' ? detectSentiment(msg.content) : null;\n      const sentimentDot = sentiment ? `<div class=\"sentiment-dot sentiment-${sentiment}\"></div>` : '';\n\n      return `<div class=\"message ${msg.role}\">\n        ${escapeHtml(msg.content)}\n        <span class=\"msg-time\">${time}</span>\n        ${sentimentDot}\n      </div>`;\n    }\n\n    function detectSentiment(text) {\n      const lower = text.toLowerCase();\n      const negativeWords = ['sad', 'angry', 'frustrated', 'upset', 'stressed', 'worried', 'anxious', 'terrible', 'awful', 'horrible', 'hate', 'disappointed'];\n      const positiveWords = ['happy', 'great', 'amazing', 'wonderful', 'excited', 'love', 'fantastic', 'awesome', 'good', 'better', 'excellent', 'grateful', 'thankful'];\n\n      const negCount = negativeWords.filter(w => lower.includes(w)).length;\n      const posCount = positiveWords.filter(w => lower.includes(w)).length;\n\n      if (negCount > posCount) return 'negative';\n      if (posCount > negCount) return 'positive';\n      return 'neutral';\n    }\n\n    function extractTopics(text) {\n      const lower = text.toLowerCase();\n      const topics = [];\n      const topicKeywords = {\n        work: ['work', 'job', 'career', 'office', 'boss', 'colleague', 'meeting'],\n        family: ['family', 'parent', 'sibling', 'child', 'mom', 'dad', 'brother', 'sister'],\n        health: ['health', 'exercise', 'sleep', 'diet', 'fitness', 'wellness'],\n        relationships: ['relationship', 'partner', 'friend', 'dating', 'marriage'],\n        stress: ['stress', 'anxiety', 'worried', 'overwhelmed'],\n        goals: ['goal', 'plan', 'achieve', 'accomplish']\n      };\n\n      for (const [topic, keywords] of Object.entries(topicKeywords)) {\n        if (keywords.some(k => lower.includes(k))) {\n          if (!topics.includes(topic)) topics.push(topic);\n        }\n      }\n      return topics;\n    }\n\n    function escapeHtml(str) {\n      const div = document.createElement('div');\n      div.textContent = str;\n      return div.innerHTML;\n    }\n\n    function handleChatKey(e) {\n      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }\n      // Auto-resize\n      const ta = e.target;\n      ta.style.height = 'auto';\n      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';\n    }\n\n    async function sendMessage() {\n      const input = document.getElementById('chat-input');\n      const message = input.value.trim();\n      if (!message) return;\n\n      // Hide welcome area if visible, show chat messages\n      const welcomeArea = document.getElementById('chat-welcome');\n      if (welcomeArea.style.display !== 'none') {\n        welcomeArea.style.display = 'none';\n      }\n      const container = document.getElementById('chat-messages');\n      container.style.display = 'flex';\n      const sendBtn = document.getElementById('send-btn');\n\n      // Track topics for contextual memory\n      const topics = extractTopics(message);\n      topics.forEach(t => {\n        if (!sessionTopics.includes(t)) sessionTopics.push(t);\n      });\n\n      // Show user message\n      container.innerHTML += renderMessage({ role: 'user', content: message, timestamp: new Date().toISOString() });\n      input.value = '';\n      input.style.height = 'auto';\n      sendBtn.disabled = true;\n      sessionMessageCount++;\n\n      // Show typing indicator\n      const typing = document.getElementById('typing-indicator');\n      typing.classList.add('visible');\n      container.scrollTop = container.scrollHeight;\n\n      // Build contextual message\n      let contextualMessage = message;\n\n      // Add contextual memory reference if topic was mentioned before\n      const repeatedTopics = topics.filter(t => sessionTopics.filter(st => st === t).length > 1);\n      if (repeatedTopics.length > 0 && sessionMessageCount > 3) {\n        contextualMessage = `[Context: User previously discussed ${repeatedTopics.join(', ')}] ${message}`;\n      }\n\n      // Add deep follow-up prompt if appropriate\n      if (sessionMessageCount >= 5 && sessionMessageCount - lastDeepFollowupAt >= 5) {\n        const shouldAskDeepFollowup = Math.random() < 0.3;\n        if (shouldAskDeepFollowup) {\n          contextualMessage += ' [AI Note: Consider offering a deeper follow-up or suggesting journaling about this topic]';\n          lastDeepFollowupAt = sessionMessageCount;\n        }\n      }\n\n      try {\n        const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: contextualMessage }) });\n        typing.classList.remove('visible');\n\n        if (data.success) {\n          container.innerHTML += renderMessage(data.message);\n        } else {\n          container.innerHTML += renderMessage({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() });\n        }\n      } catch {\n        typing.classList.remove('visible');\n        container.innerHTML += renderMessage({ role: 'assistant', content: \"I'm having trouble connecting. Please check your internet and try again.\", timestamp: new Date().toISOString() });\n      }\n\n      container.scrollTop = container.scrollHeight;\n      sendBtn.disabled = false;\n      input.focus();\n\n      // Check badges\n      checkFirstChatBadge();\n      if (sessionMessageCount >= 10) {\n        earnBadge('deep_thinker');\n      }\n    }\n\n    // ── Journal ────────────────────────────────────\n    function showJournalForm() { document.getElementById('journal-form').style.display = 'block'; }\n    function hideJournalForm() {\n      document.getElementById('journal-form').style.display = 'none';\n      document.getElementById('journal-title').value = '';\n      document.getElementById('journal-content').value = '';\n      selectedJournalMood = null;\n      document.querySelectorAll('#journal-mood .mood-btn').forEach(b => b.classList.remove('selected'));\n    }\n\n    document.querySelectorAll('#journal-mood .mood-btn').forEach(btn => {\n      btn.addEventListener('click', () => {\n        selectedJournalMood = parseInt(btn.dataset.mood);\n        document.querySelectorAll('#journal-mood .mood-btn').forEach(b => b.classList.remove('selected'));\n        btn.classList.add('selected');\n      });\n    });\n\n    async function submitJournal() {\n      const content = document.getElementById('journal-content').value.trim();\n      if (!content) return;\n\n      const body = {\n        title: document.getElementById('journal-title').value.trim() || undefined,\n        content,\n        mood: selectedJournalMood,\n      };\n\n      try {\n        const data = await api('/api/journal', { method: 'POST', body: JSON.stringify(body) });\n        if (data.success) {\n          hideJournalForm();\n          loadJournal();\n          checkJournalingBadge();\n        }\n      } catch {}\n    }\n\n    async function loadJournal() {\n      const container = document.getElementById('journal-list');\n      try {\n        const data = await api('/api/journal');\n        if (data.success && data.entries.length > 0) {\n          container.innerHTML = data.entries.map(e => `\n            <div class=\"card\">\n              <h3>${escapeHtml(e.title || 'Untitled')}</h3>\n              <div class=\"meta\">${new Date(e.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${e.mood ? ' &middot; Mood: ' + e.mood + '/10' : ''}</div>\n            </div>\n          `).join('');\n        } else {\n          container.innerHTML = '<div class=\"empty-state\"><p>No journal entries yet. Start writing to capture your thoughts!</p></div>';\n        }\n      } catch {\n        container.innerHTML = '<div class=\"empty-state\"><p>Could not load journal entries.</p></div>';\n      }\n    }\n\n    // ── Goals ──────────────────────────────────────\n    function showGoalForm() { document.getElementById('goal-form').style.display = 'block'; }\n    function hideGoalForm() {\n      document.getElementById('goal-form').style.display = 'none';\n      document.getElementById('goal-title').value = '';\n      document.getElementById('goal-desc').value = '';\n    }\n\n    async function submitGoal() {\n      const title = document.getElementById('goal-title').value.trim();\n      if (!title) return;\n\n      const body = {\n        title,\n        description: document.getElementById('goal-desc').value.trim() || undefined,\n        category: document.getElementById('goal-category').value,\n      };\n\n      try {\n        const data = await api('/api/goals', { method: 'POST', body: JSON.stringify(body) });\n        if (data.success) {\n          hideGoalForm();\n          loadGoals();\n          checkGoalSetterBadge();\n        }\n      } catch {}\n    }\n\n    async function updateGoalProgress(goalId, newProgress) {\n      try {\n        await api(`/api/goals/${goalId}`, { method: 'PUT', body: JSON.stringify({ progress: newProgress }) });\n        loadGoals();\n      } catch {}\n    }\n\n    async function loadGoals() {\n      const container = document.getElementById('goals-list');\n      try {\n        const data = await api('/api/goals');\n        if (data.success && data.goals.length > 0) {\n          container.innerHTML = data.goals.map(g => `\n            <div class=\"card\">\n              <div style=\"display:flex;justify-content:space-between;align-items:start\">\n                <div>\n                  <h3>${escapeHtml(g.title)}</h3>\n                  <div class=\"meta\">${g.category} &middot; ${g.status}</div>\n                </div>\n                <span style=\"font-size:20px;font-weight:700;color:var(--accent)\">${g.progress}%</span>\n              </div>\n              <div class=\"progress-bar\"><div class=\"fill\" style=\"width:${g.progress}%\"></div></div>\n              ${g.status === 'active' ? `\n                <div style=\"margin-top:12px;display:flex;gap:6px\">\n                  <button class=\"btn-sm\" style=\"font-size:12px;padding:6px 12px\" onclick=\"updateGoalProgress('${g.id}', ${Math.min(g.progress + 10, 100)})\">+10%</button>\n                  <button class=\"btn-sm\" style=\"font-size:12px;padding:6px 12px;background:var(--success)\" onclick=\"updateGoalProgress('${g.id}', 100)\">Complete</button>\n                </div>\n              ` : ''}\n            </div>\n          `).join('');\n        } else {\n          container.innerHTML = '<div class=\"empty-state\"><p>No goals yet. Set a goal to start tracking your progress!</p></div>';\n        }\n      } catch {\n        container.innerHTML = '<div class=\"empty-state\"><p>Could not load goals.</p></div>';\n      }\n    }\n\n    // ── Wellness Check-in ──────────────────────────\n    document.querySelectorAll('#checkin-mood .mood-btn').forEach(btn => {\n      btn.addEventListener('click', () => {\n        selectedCheckinMood = parseInt(btn.dataset.mood);\n        document.querySelectorAll('#checkin-mood .mood-btn').forEach(b => b.classList.remove('selected'));\n        btn.classList.add('selected');\n      });\n    });\n\n    document.querySelectorAll('#checkin-energy .mood-btn').forEach(btn => {\n      btn.addEventListener('click', () => {\n        selectedCheckinEnergy = parseInt(btn.dataset.mood);\n        document.querySelectorAll('#checkin-energy .mood-btn').forEach(b => b.classList.remove('selected'));\n        btn.classList.add('selected');\n      });\n    });\n\n    async function submitCheckin() {\n      if (!selectedCheckinMood) return;\n\n      const body = {\n        mood: selectedCheckinMood,\n        energy: selectedCheckinEnergy,\n        note: document.getElementById('checkin-note').value.trim() || undefined,\n      };\n\n      try {\n        const data = await api('/api/checkin', { method: 'POST', body: JSON.stringify(body) });\n        if (data.success) {\n          const respEl = document.getElementById('checkin-response');\n          respEl.style.display = 'block';\n          respEl.innerHTML = `<div class=\"card\"><h3>Alhena says:</h3><p>${escapeHtml(data.aiNote)}</p></div>`;\n          loadCheckinHistory();\n          checkWellnessWarriorBadge();\n        }\n      } catch {}\n    }\n\n    async function loadCheckinHistory() {\n      const container = document.getElementById('checkin-history');\n      const streakEl = document.getElementById('streak-display');\n      try {\n        const data = await api('/api/checkin/history?days=30');\n        if (data.success) {\n          if (data.summary.streak > 0) {\n            streakEl.innerHTML = `<span class=\"streak-badge\">🔥 ${data.summary.streak} day streak</span>`;\n          }\n\n          if (data.checkins.length > 0) {\n            container.innerHTML = data.checkins.map(c => `\n              <div class=\"card\" style=\"display:flex;align-items:center;gap:16px\">\n                <div style=\"font-size:28px;font-weight:700;color:var(--accent);min-width:40px;text-align:center\">${c.mood}</div>\n                <div>\n                  <div style=\"font-size:14px\">${new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>\n                  <div style=\"font-size:12px;color:var(--text-muted)\">${c.energy ? 'Energy: ' + c.energy + '/10' : ''}</div>\n                </div>\n              </div>\n            `).join('');\n          } else {\n            container.innerHTML = '<div class=\"empty-state\"><p>No check-ins yet. Complete your first daily check-in above!</p></div>';\n          }\n        }\n      } catch {\n        container.innerHTML = '<div class=\"empty-state\"><p>Could not load check-in history.</p></div>';\n      }\n    }\n\n    // ── Insights Dashboard ─────────────────────────\n    async function loadInsights() {\n      try {\n        // Load all data in parallel\n        const [checkinData, goalData, chatData] = await Promise.all([\n          api('/api/checkin/history?days=30'),\n          api('/api/goals'),\n          api('/api/chat/history?limit=1000')\n        ]);\n\n        // Process check-in data\n        if (checkinData.success) {\n          const streak = checkinData.summary.streak || 0;\n          document.getElementById('insight-streak').textContent = streak;\n\n          // Build mood chart (last 14 days)\n          renderMoodChart(checkinData.checkins);\n\n          // Generate weekly summary\n          generateWeeklySummary(checkinData.checkins);\n        }\n\n        // Process goal data\n        if (goalData.success && goalData.goals.length > 0) {\n          const goals = goalData.goals;\n          const activeGoals = goals.filter(g => g.status === 'active');\n          const completedGoals = goals.filter(g => g.status === 'completed');\n          const avgCompletion = goals.reduce((sum, g) => sum + g.progress, 0) / goals.length;\n\n          document.getElementById('insight-goal-completion').textContent = Math.round(avgCompletion) + '%';\n          document.getElementById('insight-goals-active').textContent = activeGoals.length;\n          document.getElementById('insight-goals-completed').textContent = completedGoals.length;\n        }\n\n        // Process chat data\n        if (chatData.success) {\n          const messages = chatData.messages;\n          const conversations = countConversations(messages);\n          const lastWeekMessages = countMessagesThisWeek(messages);\n          const avgEngagement = conversations > 0 ? Math.round(messages.length / conversations) : 0;\n\n          document.getElementById('insight-conversations').textContent = conversations;\n          document.getElementById('insight-messages-week').textContent = lastWeekMessages;\n          document.getElementById('insight-avg-engagement').textContent = avgEngagement;\n        }\n\n      } catch (err) {\n        console.error('Error loading insights:', err);\n      }\n    }\n\n    function renderMoodChart(checkins) {\n      const chart = document.getElementById('mood-chart');\n      if (!chart) return;\n\n      // Get last 14 days\n      const last14Days = [];\n      for (let i = 13; i >= 0; i--) {\n        const date = new Date();\n        date.setDate(date.getDate() - i);\n        date.setHours(0, 0, 0, 0);\n        last14Days.push(date);\n      }\n\n      // Map checkins to days\n      const moodMap = {};\n      checkins.forEach(c => {\n        const date = new Date(c.date);\n        date.setHours(0, 0, 0, 0);\n        const key = date.toISOString().split('T')[0];\n        moodMap[key] = c.mood;\n      });\n\n      // Generate bars\n      chart.innerHTML = last14Days.map(date => {\n        const key = date.toISOString().split('T')[0];\n        const mood = moodMap[key] || 0;\n        const height = mood > 0 ? (mood / 10) * 100 : 10;\n        const className = mood >= 7 ? 'high' : mood >= 4 ? 'medium' : mood > 0 ? 'low' : '';\n        const label = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });\n\n        return `\n          <div class=\"mood-bar ${className}\" style=\"height:${height}%\">\n            <div class=\"bar-value\">${mood > 0 ? mood : ''}</div>\n            <div class=\"bar-label\">${label}</div>\n          </div>\n        `;\n      }).join('');\n    }\n\n    function generateWeeklySummary(checkins) {\n      const el = document.getElementById('weekly-summary-text');\n      if (!el) return;\n\n      // Get last 7 days\n      const lastWeek = checkins.filter(c => {\n        const date = new Date(c.date);\n        const weekAgo = new Date();\n        weekAgo.setDate(weekAgo.getDate() - 7);\n        return date >= weekAgo;\n      });\n\n      if (lastWeek.length === 0) {\n        el.textContent = 'Start tracking your wellness to see personalized insights here.';\n        return;\n      }\n\n      const avgMood = lastWeek.reduce((sum, c) => sum + c.mood, 0) / lastWeek.length;\n      const previousWeek = checkins.filter(c => {\n        const date = new Date(c.date);\n        const twoWeeksAgo = new Date();\n        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);\n        const weekAgo = new Date();\n        weekAgo.setDate(weekAgo.getDate() - 7);\n        return date >= twoWeeksAgo && date < weekAgo;\n      });\n\n      let trend = '';\n      if (previousWeek.length > 0) {\n        const prevAvg = previousWeek.reduce((sum, c) => sum + c.mood, 0) / previousWeek.length;\n        const change = ((avgMood - prevAvg) / prevAvg * 100).toFixed(0);\n        if (change > 5) trend = `Your mood improved ${change}% this week. `;\n        else if (change < -5) trend = `Your mood decreased ${Math.abs(change)}% this week. `;\n        else trend = 'Your mood has been stable this week. ';\n      }\n\n      const bestDay = lastWeek.reduce((best, c) => c.mood > best.mood ? c : best, lastWeek[0]);\n      const dayName = new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' });\n\n      el.textContent = `${trend}You were most positive on ${dayName}. Keep tracking to see more patterns emerge!`;\n    }\n\n    function countConversations(messages) {\n      if (messages.length === 0) return 0;\n      let conversations = 1;\n      let lastTime = new Date(messages[0].timestamp);\n\n      messages.forEach((msg, i) => {\n        if (i === 0) return;\n        const time = new Date(msg.timestamp);\n        const diff = (time - lastTime) / 1000 / 60; // minutes\n        if (diff > 60) conversations++; // New conversation if gap > 1 hour\n        lastTime = time;\n      });\n\n      return conversations;\n    }\n\n    function countMessagesThisWeek(messages) {\n      const weekAgo = new Date();\n      weekAgo.setDate(weekAgo.getDate() - 7);\n      return messages.filter(m => new Date(m.timestamp) >= weekAgo).length;\n    }\n\n    // ── Conversation Starters ─────────────────────\n    function sendStarter(chipEl) {\n      const message = chipEl.textContent;\n      // Hide welcome area, show chat messages\n      document.getElementById('chat-welcome').style.display = 'none';\n      const container = document.getElementById('chat-messages');\n      container.style.display = 'flex';\n      // Put the message in the input and send\n      document.getElementById('chat-input').value = message;\n      sendMessage();\n    }\n\n    // ── Onboarding ──────────────────────────────────\n    let selectedInterests = [];\n\n    function showOnboarding() {\n      document.getElementById('onboarding-overlay').style.display = 'flex';\n    }\n\n    function onboardingNext(step) {\n      // Hide all steps\n      document.getElementById('ob-step-1').style.display = 'none';\n      document.getElementById('ob-step-2').style.display = 'none';\n      document.getElementById('ob-step-3').style.display = 'none';\n\n      // Update dots\n      document.getElementById('ob-dot-1').classList.toggle('active', step === 1);\n      document.getElementById('ob-dot-2').classList.toggle('active', step === 2);\n      document.getElementById('ob-dot-3').classList.toggle('active', step === 3);\n\n      // Show the target step\n      document.getElementById(`ob-step-${step}`).style.display = 'block';\n\n      // On step 3, save interests and update summary\n      if (step === 3) {\n        saveOnboardingInterests();\n        const interestLabels = selectedInterests.map(id => {\n          const chip = document.querySelector(`.interest-chip[data-interest=\"${id}\"]`);\n          return chip ? chip.textContent : id;\n        });\n        const summary = interestLabels.length > 0\n          ? `Great choices! I'll focus on ${interestLabels.join(', ')} to give you the most relevant experience. You can always explore other areas too.`\n          : 'Your personalized experience is ready. Alhena is here whenever you need a thoughtful conversation, journaling space, or help tracking your goals.';\n        document.getElementById('ob-summary').textContent = summary;\n      }\n    }\n\n    function toggleInterest(chipEl) {\n      const interest = chipEl.dataset.interest;\n      const idx = selectedInterests.indexOf(interest);\n\n      if (idx > -1) {\n        // Deselect\n        selectedInterests.splice(idx, 1);\n        chipEl.classList.remove('selected');\n      } else {\n        // Only allow up to 3\n        if (selectedInterests.length >= 3) return;\n        selectedInterests.push(interest);\n        chipEl.classList.add('selected');\n      }\n\n      // Update hint and button state\n      const hint = document.getElementById('interest-hint');\n      const btn = document.getElementById('ob-interests-btn');\n      const count = selectedInterests.length;\n\n      if (count === 0) {\n        hint.textContent = 'Choose at least 1 topic';\n        btn.style.opacity = '0.5';\n        btn.style.pointerEvents = 'none';\n      } else if (count < 3) {\n        hint.textContent = `${count} selected — you can pick ${3 - count} more`;\n        btn.style.opacity = '1';\n        btn.style.pointerEvents = 'auto';\n      } else {\n        hint.textContent = '3 selected — maximum reached';\n        btn.style.opacity = '1';\n        btn.style.pointerEvents = 'auto';\n      }\n    }\n\n    function saveOnboardingInterests() {\n      if (selectedInterests.length === 0) return;\n      // Cosmetic onboarding preference, not identity data - AuthFor (the\n      // real conglomerate-wide identity provider) has no concept of\n      // per-venture \"interests\", so this stays local rather than\n      // inventing a bespoke backend route for it.\n      localStorage.setItem('alhena_interests', JSON.stringify(selectedInterests));\n\n      // Check self-aware badge\n      if (selectedInterests.length >= 3) {\n        earnBadge('self_aware');\n      }\n    }\n\n    function finishOnboarding() {\n      localStorage.setItem('alhena_onboarded', 'true');\n      document.getElementById('onboarding-overlay').style.display = 'none';\n    }\n\n    // ── Bootstrap ──────────────────────────────────\n    init();\n  </script>\n    <!-- Cloudflare Web Analytics -->\n    <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"alhena-cc\"}'></script>\n    <!-- End Cloudflare Web Analytics -->\n<!-- MASCOM Conglomerate Nav -->\n<div id=\"mascom-nav\" style=\"position:fixed;bottom:0;left:0;right:0;height:32px;background:#0a0e14;border-top:1px solid rgba(70,130,180,0.2);display:flex;align-items:center;padding:0 12px;font-family:Inter,system-ui,sans-serif;font-size:11px;z-index:99999;gap:8px;opacity:0.85;transition:opacity 0.2s\" onmouseenter=\"this.style.opacity='1'\" onmouseleave=\"this.style.opacity='0.85'\">\n<span style=\"color:#4682B4;font-weight:600;letter-spacing:1px;font-size:10px\">MASCOM</span>\n<a href=\"https://mobleysoft.com\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">PublicOS</a>\n<a href=\"https://weylandai.com\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">WeylandAI</a>\n<a href=\"https://gamegob.com\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">GameGob</a>\n<a href=\"https://helmcorp.cc\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">HelmCorp</a>\n<a href=\"https://filmline.cc\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">FilmLine</a>\n<a href=\"https://halside.com\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">HALside</a>\n<a href=\"https://mobleyreport.com/news\" style=\"color:#888;text-decoration:none;padding:2px 6px;border-radius:3px\" onmouseenter=\"this.style.color='#c8c8d4'\" onmouseleave=\"this.style.color='#888'\">News</a>\n<span style=\"flex:1\"></span>\n<a href=\"https://authfor.com\" style=\"color:#666;text-decoration:none;font-size:10px\">AuthFor</a>\n</div>\n<!-- HelmCorp Analytics -->\n<!-- VentureForge:collated -->\n</body>\n</html>\n";

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

// ── Anonymous, no-signup identity (added 2026-09-13) ────────────────────
// Real, direct product decision from John: "we are making what is
// currently texting Jim into the alhena.cc product users around the
// world can start using at this time for free until we figure out what
// users will pay for and have some users to worry about" - immediately
// followed by "there should be no signup required, it should just name
// them color animal tradePersonType, filling in a random choice for each
// of those from a list." This section is the entire mechanism: three
// real word lists, a display-name generator, and resolveIdentity() below
// - a drop-in, NEVER-throwing replacement for authenticateViaAuthFor()/
// tryAuthenticateViaAuthFor() across the companion routes - that gives
// every caller, real AuthFor user or brand-new anonymous visitor, a real
// identity.email-shaped key so every existing KV-keyed route (chat,
// guidance, checkin, etc.) below works unchanged for both.
const ANON_COLORS = [
  'Crimson', 'Azure', 'Amber', 'Violet', 'Emerald', 'Scarlet', 'Cobalt',
  'Golden', 'Silver', 'Copper', 'Indigo', 'Coral', 'Jade', 'Ivory',
  'Onyx', 'Magenta', 'Turquoise', 'Maroon', 'Slate', 'Saffron',
  'Charcoal', 'Rose', 'Teal', 'Bronze', 'Lavender'
];
const ANON_ANIMALS = [
  'Falcon', 'Otter', 'Panther', 'Heron', 'Fox', 'Wolf', 'Badger', 'Lynx',
  'Raven', 'Owl', 'Bison', 'Stag', 'Hawk', 'Dolphin', 'Tiger', 'Marten',
  'Wren', 'Osprey', 'Coyote', 'Ibex', 'Kestrel', 'Mongoose', 'Peregrine',
  'Wolverine', 'Egret'
];
const ANON_TRADES = [
  'Electrician', 'Carpenter', 'Plumber', 'Locksmith', 'Blacksmith',
  'Falconer', 'Mason', 'Cobbler', 'Tailor', 'Weaver', 'Cooper',
  'Chandler', 'Cartwright', 'Fletcher', 'Glazier', 'Mechanic',
  'Surveyor', 'Vintner', 'Butcher', 'Baker', 'Farrier', 'Roofer',
  'Welder', 'Tanner', 'Miller'
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAnonymousDisplayName() {
  return `${randomFrom(ANON_COLORS)} ${randomFrom(ANON_ANIMALS)} ${randomFrom(ANON_TRADES)}`;
}

const ANON_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolves a real identity for every caller, real or anonymous - NEVER
// throws, NEVER returns null (unlike authenticateViaAuthFor/
// tryAuthenticateViaAuthFor above). A real AuthFor Bearer token still
// wins when present, preserving the existing signed-in path (useful for
// a returning user who wants cross-device history, or eventually real
// payment history via /api/v1/payments/stripe/session - untouched by
// this change). Otherwise resolves (and, on a brand-new caller, mints) a
// real anonymous identity keyed off a UUID the client persists in
// localStorage and replays via the `X-Alhena-Anon-Id` header - chosen
// over a cookie because this app's existing api() helper in app.html
// already attaches identity manually via headers + localStorage, never
// `credentials: 'include'`, and this file's CORS policy is wildcard '*'
// (Access-Control-Allow-Origin), which browsers refuse to combine with
// credentialed cookies anyway.
async function resolveIdentity(request) {
  const authIdentity = await tryAuthenticateViaAuthFor(request);
  if (authIdentity) {
    return { email: authIdentity.email, name: authIdentity.name || authIdentity.email, isAnonymous: false, anonId: null, isNew: false };
  }
  const headerAnonId = request.headers.get('X-Alhena-Anon-Id');
  const hasValidExisting = !!headerAnonId && ANON_ID_RE.test(headerAnonId);
  const anonId = hasValidExisting ? headerAnonId.toLowerCase() : crypto.randomUUID();
  return { email: `anon:${anonId}`, name: null, isAnonymous: true, anonId, isNew: !hasValidExisting };
}

const ANON_PROFILE_KEY_PREFIX = 'anon_profile:';

// Real, durable per-anonymous-visitor profile (just the generated display
// name + first-seen timestamp) - deliberately separate from the anonymous
// ID itself, per the product decision above ("Generate a real, unique
// anonymous ID... to key their actual stored state (separate from the
// display name, so state isn't lost if the same person somehow gets
// shown a duplicate name)"): every KV key elsewhere in this file uses the
// ID, never the name. The name is purely cosmetic and looked up/created
// here so a returning visitor sees the SAME name every time instead of a
// fresh random one per request.
async function getOrCreateAnonymousProfile(env, anonId) {
  const key = `${ANON_PROFILE_KEY_PREFIX}${anonId}`;
  const raw = await env.ALHENA_KV.get(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) return { name: parsed.name, isNew: false };
    } catch (e) { /* fall through and regenerate below */ }
  }
  const name = generateAnonymousDisplayName();
  await env.ALHENA_KV.put(key, JSON.stringify({ name, createdAt: new Date().toISOString() }));
  return { name, isNew: true };
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
// Real gap found 2026-09-11 (route-vs-reality audit): /api/v1/companion/
// guidance - the core "companion" endpoint this venture's spec describes
// ("AI companion for life guidance, decision support, and wellness
// coaching") - called no auth function at all and persisted nothing, so
// every call was stateless even for a signed-in AuthFor user: a "companion"
// that forgets every prior conversation the instant the response is sent.
// Same optional-auth pattern as tryAuthenticateViaAuthFor's own checkin fix
// (anonymous try-it-first UX preserved, persistence + continuity only for
// a real identified user), same bounded-list KV pattern as journal/goals/
// chat above (guidance:${email}, capped so history can't grow unbounded).
const MAX_STORED_GUIDANCE_SESSIONS = 200;
const GUIDANCE_HISTORY_TURNS_INJECTED = 5; // how many prior Q&A pairs get fed back into the prompt as real context

// Real "getting Alhena involved in the process" log (added 2026-09-12) -
// a single shared list (not per-user, since it's for John to review real
// user-surfaced gaps/ideas across everyone, not one person's own history),
// same bounded-list KV pattern as everything else in this file. Readable
// via `wrangler kv key get --namespace-id=<ALHENA_KV id> self_reflection_log`
// (same raw-KV mechanism every other feature here already uses), or via
// GET /api/v1/companion/self-reflection?secret=... below - added
// 2026-09-22, reusing paintedwhore.cc's fail-closed ADMIN_SECRET pattern
// rather than inventing a new one.
const MAX_STORED_SELF_REFLECTIONS = 300;

// Real tier-gating (added 2026-09-13, closing a genuine feature-
// completeness gap found this pass: /api/vendyai/webhook below has
// always written a real paying user's tier to `user:${email}` in KV on
// checkout.session.completed, but until now NOTHING in this file ever
// read that value back - a $0 free user and a $19.99/mo Elite subscriber
// got byte-identical behavior on every single route. Free tier is now a
// real, enforced daily cap on guidance+chat sessions combined; Premium/
// Elite are genuinely unlimited; Elite additionally gets a longer
// injected conversation-memory window and the new GET /api/insights
// route below. The subscription-recommendations copy is corrected in
// the same pass to only list what's real - "Priority responses" and
// "Daily wellness tracking" as a paid-only perk are removed (neither was
// ever implemented as a differentiator; wellness tracking is already
// free for everyone), same precedent as the 2026-09-03/2026-09-11
// removal of "Therapy integration" and "1:1 coaching calls" - a paid
// feature with zero implementation gets removed, not faked.
const FREE_TIER_DAILY_SESSION_LIMIT = 5;
const GUIDANCE_HISTORY_TURNS_INJECTED_ELITE = 15;

async function getUserTier(env, email) {
  if (!email) return 'free';
  // Real, explicit, commented free-tier decision (2026-09-13, John's own
  // product call - see resolveIdentity() above): an anonymous, no-signup
  // visitor is NOT silently treated as 'premium'/'elite' (that would
  // misrepresent real subscription state if paid-tier logic is checked
  // elsewhere later) - it's a distinct, deliberately-unlimited
  // 'anonymous' tier. FREE_TIER_DAILY_SESSION_LIMIT below only ever gates
  // the 'free' tier, so returning 'anonymous' here bypasses the cap
  // without touching, weakening, or removing any of the real tier-
  // enforcement code - it stays intact for real signed-in free users.
  if (email.startsWith('anon:')) return 'anonymous';
  const raw = await env.ALHENA_KV.get(`user:${email}`);
  if (!raw) return 'free';
  try {
    const parsed = JSON.parse(raw);
    return parsed && (parsed.tier === 'premium' || parsed.tier === 'elite') ? parsed.tier : 'free';
  } catch (e) {
    return 'free';
  }
}

// One shared counter per user per real UTC calendar day - "a guidance
// session" in this product's own marketing copy has always meant both
// /api/v1/companion/guidance and /api/chat (the vendyai billing event
// both routes fire is literally named 'guidance_session'), so both
// routes below increment and check the same counter rather than each
// enforcing its own separate cap.
async function getDailySessionCount(env, email) {
  const day = new Date().toISOString().slice(0, 10);
  const raw = await env.ALHENA_KV.get(`session_count:${email}:${day}`);
  return raw ? (parseInt(raw, 10) || 0) : 0;
}

async function incrementDailySessionCount(env, email) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `session_count:${email}:${day}`;
  const count = await getDailySessionCount(env, email);
  // expirationTtl is a real Cloudflare KV option (ignored harmlessly by
  // the fake in-memory KV worker.test.mjs uses) - a genuine reason not
  // to leave these counters growing forever: 2 days is enough for the
  // UTC-day cutover to fully pass before the key expires on its own.
  await env.ALHENA_KV.put(key, String(count + 1), { expirationTtl: 172800 });
}

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

// Shared inference path (extracted 2026-09-12 from what used to be two
// separately-maintained copies of this same try-llama-bridge-then-try-
// alhena-url-then-honestly-fallback logic: one inline in /api/v1/companion/
// guidance, one in generateChatReply below for /api/chat - the real UI's
// actual chat endpoint). Unifying them fixes a real, until-now-undetected
// gap: /api/chat never even attempted the llama.mobleysoft.com bridge, so
// once LLAMA_ACCESS_CLIENT_ID/SECRET eventually get provisioned (see the
// still-open gap noted below), guidance would start giving live answers
// while the actual app.html chat UI kept silently running fallback-only
// forever, because its code path never tried the bridge at all. Same
// fallback-mode-honest contract as before: only claims a real model reply
// when a path is both configured AND actually returned one; returns
// {guidance, isFallback, usedLlamaBridge, inferenceSource} so callers -
// including the self-awareness answer below - can honestly report which
// one happened for THIS call, not a static claim.
async function runAlhenaInference(env, systemPrompt, userContent, priorMessages = []) {
  let inferenceRes = null;
  let isFallback = true;
  let usedLlamaBridge = false;

  // Gap closed 2026-09-13 (confirmed live via `wrangler secret list` on
  // alhena-cc-worker and a real production call returning
  // fallback_mode:false, inference_source:'llama_bridge'): both
  // LLAMA_ACCESS_CLIENT_ID and LLAMA_ACCESS_CLIENT_SECRET are now
  // provisioned, so this branch is real code that actually executes in
  // production, not a configured-but-never-taken path.
  if (env.LLAMA_ACCESS_CLIENT_ID && env.LLAMA_ACCESS_CLIENT_SECRET) {
    try {
      inferenceRes = await fetch('https://llama.mobleysoft.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Access-Client-Id': env.LLAMA_ACCESS_CLIENT_ID,
          'CF-Access-Client-Secret': env.LLAMA_ACCESS_CLIENT_SECRET,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...priorMessages,
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          chat_template_kwargs: { enable_thinking: false },
        }),
      });
      usedLlamaBridge = true;
      isFallback = false;
    } catch (e) {
      inferenceRes = null;
      isFallback = true;
    }
  }

  // Pre-existing path, tried only if the llama bridge above wasn't
  // configured or failed - env.ALHENA_INFERENCE_URL, if set, must point at
  // something that actually resolves. wrangler.toml's default
  // (core.jmobleyworks.com) does not resolve at all (confirmed 2026-09-03:
  // DNS lookup fails) - skip the network call entirely rather than pretend
  // to try connecting to a dead host.
  const alhenaEndpoint = env.ALHENA_INFERENCE_URL;
  const inferenceConfigured = !!alhenaEndpoint && alhenaEndpoint !== 'https://core.jmobleyworks.com/v1/chat/completions';

  if (isFallback && inferenceConfigured) {
    try {
      inferenceRes = await fetch(alhenaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.JWT_SECRET || 'local_key'}`
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [...priorMessages, { role: 'user', content: userContent }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      isFallback = false;
    } catch (e) {
      isFallback = true;
    }
  }

  let guidance = '';
  if (inferenceRes && inferenceRes.ok) {
    try {
      const data = await inferenceRes.json();
      if (data.error) throw new Error(data.error.message || 'inference error');
      guidance = data.choices[0].message.content.trim();
    } catch (e) {
      isFallback = true;
    }
  } else if (!isFallback) {
    isFallback = true;
  }

  if (isFallback) {
    guidance = "I'm not connected to a live guidance model right now, so I can't give you a personalized response to this. Alhena is not a therapist or medical provider - if what you're working through feels heavier than a decision, the 988 Suicide & Crisis Lifeline (call or text 988) and Crisis Text Line (text HOME to 741741) are real, free, 24/7 resources.";
  }

  // Real fix 2026-09-17 (portfolio depth audit, ground-truth pass): this
  // is exactly the gap the roadmap paragraph below already named honestly
  // - "whether to point you to real crisis resources depends on a general
  // model noticing the signal, not a dedicated, auditable check." Live-
  // tested against a real strong crisis message ("I just want it all to
  // stop") and confirmed the model's reply was supportive but never
  // included the actual 988/741741 numbers, even though the homepage
  // itself promises them. Fixed the same honest way isSelfReflectionQuestion
  // already does it for a different question - a plain, auditable keyword
  // check, not an ML classifier - and it always wins: if the message
  // matches and the model's own reply doesn't already contain "988", the
  // real resources are appended, guaranteed, regardless of what the model
  // said or didn't say.
  if (isCrisisSignal(userContent) && !guidance.includes('988')) {
    guidance = guidance.trim() + '\n\nIf you\'re in crisis or thinking about harming yourself: the 988 Suicide & Crisis Lifeline (call or text 988) and Crisis Text Line (text HOME to 741741) are real, free, 24/7 resources. If you\'re in immediate danger, call your local emergency number.';
  }

  const inferenceSource = isFallback ? 'none' : (usedLlamaBridge ? 'llama_bridge' : 'alhena_inference_url');
  return { guidance, isFallback, usedLlamaBridge, inferenceSource };
}

// Real self-awareness mechanism (added 2026-09-12, per John's ask: Alhena
// should be able to accurately describe her own code, what's really built
// vs. aspirational, and what she's aiming at). This is deliberately NOT
// "let the model answer questions about itself" - the same session that
// prompted this work caught a live example (James's check-in memory fix)
// of a model fabricating a fact about itself/a real person, so a model's
// own claim about its own deployment status is not trusted here either.
// Instead: a small, transparent, keyword-based check on the user's own
// message decides whether this looks like a question about how Alhena
// works/her limits/her roadmap, and if so, the reply is built entirely
// from real, checkable state - not generated. This is a plain regex list,
// not an ML classifier; described here exactly that plainly, not dressed
// up as more than it is.
// Real, plain keyword check (not an ML classifier, described here exactly
// that plainly - same honesty standard as isSelfReflectionQuestion below)
// for whether a message suggests the person may be in crisis or
// considering self-harm. Deliberately broader/cruder than a clinical
// screening tool would be - a false positive here just means the real
// 988/Crisis Text Line resources get appended to an otherwise-fine
// message, which is harmless; a false negative means a real gap, which
// is the actual risk this exists to close.
function isCrisisSignal(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\bkill(ing)? (myself|me)\b/i,
    /\bend(ing)? (it all|my life)\b/i,
    /\bwant(ed)? (it all )?to (stop|end)\b/i,
    /\bdon'?t (want|wanna) (to )?(be here|live|exist) anymore\b/i,
    /\bno (point|reason) (in|to) (living|going on)\b/i,
    /\bsuicid\w*/i,
    /\bself.?harm/i,
    /\bhurt(ing)? myself\b/i,
    /\bgive up on (everything|life)\b/i,
    /\bcan'?t (go on|do this anymore|take (it|this) anymore)\b/i,
  ];
  return patterns.some((re) => re.test(text));
}

function isSelfReflectionQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /how (do|does) (you|alhena)\b.{0,20}\bwork\b/i,
    /how (were|was) you (built|made|created)/i,
    /who (built|made|created) you/i,
    /what model (are you|do you use|is (this|that))/i,
    /are you (an ai|a bot|a real person|really real)\b/i,
    /are you connected to a\s*(real|live)?\s*(model|ai|llm)/i,
    /what are your (limits|limitations)/i,
    /are you always this good/i,
    /do you (actually |really )?remember/i,
    /what('?s| is) your roadmap/i,
    /what are you working on/i,
    /what('?s| is) next for you/i,
    /tell me about yourself/i,
    /are you (fabricat\w*|fake|making (this|it) up)/i,
    /is (this|alhena) (fake|fabricated|real)/i,
  ];
  return patterns.some((re) => re.test(text));
}

// Builds the actual self-aware answer text. Takes the SAME isFallback/
// inferenceSource values the current request's own runAlhenaInference()
// call just computed, so this can never claim a live model connection the
// request itself didn't have (or fail to admit one it did) - grounded in
// this session's real state, not a static paragraph reused every time.
function buildSelfAwareAnswer({ isFallback, inferenceSource }, { storedCap = MAX_STORED_GUIDANCE_SESSIONS, contextTurns = GUIDANCE_HISTORY_TURNS_INJECTED } = {}) {
  const liveLine = isFallback
    ? `Honestly: for this exact reply, I did not have a live language model connected (inference_source: "none"). My code has two possible model backends wired in - a shared internal bridge at llama.mobleysoft.com (credentials provisioned as of 2026-09-13, normally live) and an older direct-URL path (points at a host that has never resolved). Since the bridge is normally configured, this specific call most likely hit a transient failure (a timeout or an error from the bridge itself) rather than a missing-credential gap - either way, this answer is a hand-written, code-grounded fallback response, not something a model generated for you.`
    : `For this exact reply, I did have a live model connection (inference_source: "${inferenceSource}") - a real model call actually ran just now, though this particular paragraph is still hand-written and code-grounded rather than model-generated, on purpose (see below).`;

  return `I'm Alhena - a Cloudflare Worker (alhena-cc-worker) built for alhena.cc. I'm a decision-support companion, not a therapist or medical provider.

${liveLine}

Memory: This channel stores history in Cloudflare KV for both signed-in accounts and returning anonymous identities, capped at ${storedCap} stored entries. I include up to ${contextTurns} recent conversation turns in each new model request. Anonymous continuity depends on keeping the same anonymous ID on this device; signing in uses a separate account history. This is a bounded context window, not unlimited recall or automatic memory shared with every other channel.

Roadmap, honestly labeled as NOT built yet: there's a real design sketch (called the "Gofaineat Cascade," written 2026-09-12) for eventually turning how I generate guidance into a chain of narrow, reviewable classifier stages instead of one open-ended model call - first classifying what you're actually asking about, then how much emotional weight it carries, then picking one response strategy from a fixed, pre-authored menu, and only then generating the smallest possible fill-in-the-blank reply. The piece most likely to get built first is a dedicated crisis-signal classifier, because right now whether to point you to real crisis resources (988 / Crisis Text Line) depends on a general model noticing the signal, not a dedicated, auditable check. None of that cascade exists in my code today - I'm describing a real plan, not a feature I already have.

If something about how I work here seems off, missing, or worth building, say so - a real note gets written to a log (POST /api/v1/companion/self-reflection) that a real person actually reads later, not just acknowledged and dropped.`;
}

async function generateChatReply(env, message, priorMessages = [], contextTurns = GUIDANCE_HISTORY_TURNS_INJECTED) {
  const systemPrompt = 'You are Alhena, a supportive companion for talking through everyday decisions. You are not a therapist and do not provide medical or mental-health treatment.';
  const result = await runAlhenaInference(env, systemPrompt, message, priorMessages);
  if (isSelfReflectionQuestion(message)) {
    result.guidance = buildSelfAwareAnswer(result, { storedCap: MAX_STORED_CHAT_MESSAGES, contextTurns });
    result.self_reflection = true;
  }
  return result;
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

    // Real anonymous-identity provisioning endpoint (added 2026-09-13,
    // see resolveIdentity()/getOrCreateAnonymousProfile() above for the
    // full mechanism and the product decision behind it). app.html calls
    // this once on page load, before showing the chat UI: a real AuthFor
    // Bearer token (if present) short-circuits straight to that identity;
    // otherwise this mints (or looks up) a real anonymous UUID + a
    // "Color Animal TradePersonType" display name and returns both so the
    // client can store the ID in localStorage and greet the visitor by
    // name immediately, with no signup screen in between.
    if (url.pathname === '/api/v1/companion/identity' && (request.method === 'GET' || request.method === 'POST')) {
      const identity = await resolveIdentity(request);
      if (!identity.isAnonymous) {
        return new Response(JSON.stringify({ anonymous: false, id: identity.email, name: identity.name, isNew: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const profile = await getOrCreateAnonymousProfile(env, identity.anonId);
      return new Response(JSON.stringify({ anonymous: true, id: identity.anonId, name: profile.name, isNew: profile.isNew }), {
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

        // Real conversation continuity (added 2026-09-11, extended
        // 2026-09-13 to cover anonymous visitors too) - resolveIdentity()
        // always returns a real identity now, signed-in AuthFor user or
        // anonymous "Color Animal TradePersonType" visitor, so both get
        // real continuity: prior guidance sessions are read back below and
        // fed into this call's prompt, not just stored for later.
        const identity = await resolveIdentity(request);
        const tier = await getUserTier(env, identity.email);

        // Real free-tier cap, enforced before spending an inference call.
        // Anonymous callers resolve to tier 'anonymous' (see getUserTier
        // above), never 'free', so this never applies to them - the
        // explicit 2026-09-13 "free until we have users to worry about"
        // decision, not a bypass of the real signed-in free-tier cap.
        if (tier === 'free') {
          const sessionsUsedToday = await getDailySessionCount(env, identity.email);
          if (sessionsUsedToday >= FREE_TIER_DAILY_SESSION_LIMIT) {
            return new Response(JSON.stringify({
              guidance: `You've used today's ${FREE_TIER_DAILY_SESSION_LIMIT} free guidance/chat sessions. Sessions reset at midnight UTC, or upgrade to Premium for unlimited sessions (see /api/v1/treasury/subscription-recommendations).`,
              decision_type: decision_type || 'general',
              companion: 'Alhena',
              fallback_mode: false,
              inference_source: 'tier_limit',
              limit_reached: true,
              tier,
              disclaimer: 'Alhena is a decision-support companion, not therapy or medical care. In a crisis, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line).',
              memory: { signed_in: true, saved: false }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        const priorGuidanceHistory = await readKvList(env, `guidance:${identity.email}`);
        const guidanceHistoryTurns = tier === 'elite' ? GUIDANCE_HISTORY_TURNS_INJECTED_ELITE : GUIDANCE_HISTORY_TURNS_INJECTED;
        const recentGuidanceHistory = priorGuidanceHistory.slice(-guidanceHistoryTurns);
        const historyContext = recentGuidanceHistory.length > 0
          ? `\n\nRecent conversation history with this user, oldest first (use this for real continuity - refer back to it naturally rather than treating this as a first-ever message):\n` +
            recentGuidanceHistory.map((h, i) => `${i + 1}. [${h.decision_type || 'general'}] User asked: "${h.question}" - You responded: "${h.guidance}"`).join('\n')
          : '';

        // Real inference gateway - env.ALHENA_INFERENCE_URL, if set, must
        // point at something that actually resolves. wrangler.toml's
        // default (core.jmobleyworks.com) does not resolve at all
        // (confirmed 2026-09-03: DNS lookup fails) - skip the network call
        // entirely rather than pretend to try connecting to a dead host.
        //
        // Real gap confirmed 2026-09-11: companion_guidance ran in
        // fallback_mode:true for 100% of real production traffic. Two
        // candidate fix paths were found; path (1) below was reported
        // blocked because "that Access application isn't visible... under
        // the same Cloudflare account that hosts alhena-cc-worker" - RE-
        // VERIFIED 2026-09-12 and that reason no longer holds: a live API
        // check confirms alhena-cc-worker's zone (alhena.cc) and the
        // llama-server-gateway Access app are both on the same account
        // ($MY_CLOUDFLARE_ACCOUNT_ID). Wiring the real call now, matching
        // the exact working pattern already proven by mobley-venture-
        // fleet-a's JITAGI_CAPABILITIES bridge (same jitagi-kernel-m2m
        // service token, same https://llama.mobleysoft.com endpoint).
        //
        // Gap closed 2026-09-13: LLAMA_ACCESS_CLIENT_ID/SECRET are now set
        // as secrets on alhena-cc-worker (confirmed via `wrangler secret
        // list` - both present) and this path is live in production,
        // verified via a real guidance call returning
        // fallback_mode:false, inference_source:'llama_bridge' with a
        // coherent, question-specific reply. The ALHENA_INFERENCE_URL and
        // honest fallback_mode paths below remain as real, tested
        // fallbacks if the llama bridge call itself ever fails at
        // request time - never silently pretends to have a live model
        // when it doesn't.
        const systemPrompt = `You are Alhena, a supportive companion for talking through everyday decisions. You are not a therapist and do not provide medical or mental-health treatment.
Decision type: ${decision_type || 'general_guidance'}${historyContext}`;

        // Real shared inference path (see runAlhenaInference above) - same
        // llama-bridge-then-alhena-url-then-honest-fallback logic as
        // /api/chat now uses, extracted 2026-09-12 so both real entry
        // points behave identically instead of silently drifting apart.
        const inferenceResult = await runAlhenaInference(
          env,
          systemPrompt,
          `User Context: ${JSON.stringify(user_context)}\n\nQuestion: ${question}`
        );
        let { guidance, isFallback } = inferenceResult;

        // Real self-awareness override (added 2026-09-12): if the
        // question itself looks like it's asking how Alhena works/her
        // limits/her roadmap, replace whatever the inference path above
        // produced (model reply or fallback text) with the hand-written,
        // code-grounded answer - using the REAL isFallback/inferenceSource
        // this exact call just computed, not a static claim. See
        // buildSelfAwareAnswer for why a model's own claim about itself
        // isn't trusted here.
        const isSelfReflection = isSelfReflectionQuestion(question);
        if (isSelfReflection) {
          guidance = buildSelfAwareAnswer(inferenceResult, {
            storedCap: MAX_STORED_GUIDANCE_SESSIONS,
            contextTurns: tier === 'elite' ? GUIDANCE_HISTORY_TURNS_INJECTED_ELITE : GUIDANCE_HISTORY_TURNS_INJECTED,
          });
        }

        // Fire event tracking to VendyAI telemetry
        ctx.waitUntil(
          fetch('https://vendyai.com/api/billing/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venture_id: 'alhena.cc',
              user_id: identity.email,
              event: 'guidance_session',
              decision_type: decision_type || 'general',
              timestamp: Date.now()
            })
          }).catch(e => console.error('VendyAI billing trace failed:', e))
        );

        // Real persistence for every real identity, signed-in or
        // anonymous (2026-09-13 - see resolveIdentity() above), same
        // saved:true/false honesty as /api/v1/companion/checkin. Stored
        // even in fallback_mode so continuity data (the user's own
        // questions/context) already exists once real inference is wired
        // up, rather than starting memory from zero at that point.
        const entry = {
          timestamp: new Date().toISOString(),
          question,
          user_context,
          decision_type: decision_type || 'general',
          guidance,
          fallback_mode: isFallback
        };
        await writeKvList(env, `guidance:${identity.email}`, [...priorGuidanceHistory, entry], MAX_STORED_GUIDANCE_SESSIONS);
        const guidanceSaved = true;
        // Real free-tier usage counter, incremented only for a real
        // completed (not limit-blocked) free-tier session - premium/
        // elite/anonymous are genuinely never counted, so they never hit
        // a cap.
        if (tier === 'free') {
          ctx.waitUntil(incrementDailySessionCount(env, identity.email));
        }

        const response = {
          guidance,
          decision_type: decision_type || 'general',
          companion: 'Alhena',
          fallback_mode: isFallback,
          inference_source: inferenceResult.inferenceSource,
          tier,
          disclaimer: 'Alhena is a decision-support companion, not therapy or medical care. In a crisis, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line).',
          session_id: `sess_${Date.now()}`,
          next_check_in: new Date(Date.now() + 86400000).toISOString(),
          memory: {
            signed_in: !identity.isAnonymous,
            saved: guidanceSaved,
            prior_sessions_considered: recentGuidanceHistory.length,
            total_saved_sessions: priorGuidanceHistory.length + 1
          },
          identity: { anonymous: identity.isAnonymous, id: identity.isAnonymous ? identity.anonId : identity.email }
        };
        if (identity.isAnonymous) {
          response.memory.note = 'Chatting anonymously - your conversation is saved to this browser/device (see GET /api/v1/companion/identity for your name). Sign in with a real AuthFor account for cross-device history.';
        }
        if (isSelfReflection) {
          response.self_reflection = true;
          // Same real logging mechanism as /api/chat's version below -
          // a real event (this question, this answer, the real fallback/
          // inference_source state) appended to a shared, capped KV log a
          // human can actually read back later. Not auto-triaged, not fed
          // back into any automated retraining - a plain, honest log.
          ctx.waitUntil((async () => {
            const existing = await readKvList(env, 'self_reflection_log');
            await writeKvList(env, 'self_reflection_log', [...existing, {
              timestamp: new Date().toISOString(),
              email: identity.email,
              question,
              answer: guidance,
              fallback_mode: isFallback,
              inference_source: inferenceResult.inferenceSource,
              source: 'guidance'
            }], MAX_STORED_SELF_REFLECTIONS);
          })());
        }

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Real guidance-history read-back, added 2026-09-11 alongside the
    // continuity fix above - same shape as GET /api/v1/companion/checkins.
    // Extended 2026-09-13 to resolveIdentity() (see above): an anonymous
    // visitor now has real saved history too (guidance route above always
    // persists), so this returns theirs the same way it returns a real
    // AuthFor user's.
    if (url.pathname === '/api/v1/companion/guidance/history' && request.method === 'GET') {
      const identity = await resolveIdentity(request);
      const history = await readKvList(env, `guidance:${identity.email}`);
      return new Response(JSON.stringify({ email: identity.email, count: history.length, sessions: history }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Real "getting Alhena involved in the process" endpoint (added
    // 2026-09-12). Two ways an entry lands in self_reflection_log: (1)
    // automatically, when a user's message trips isSelfReflectionQuestion
    // inside /api/chat or /api/v1/companion/guidance above; (2) explicitly,
    // via this route - for the frontend (or a human) to flag a real gap or
    // idea that came up in conversation but didn't match the keyword list.
    // Deliberately NOT auto-triaged, NOT fed into any automated retraining
    // or code-change pipeline - it is exactly what it looks like: a real,
    // capped, append-only log a human reads later.
    if (url.pathname === '/api/v1/companion/self-reflection' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => null);
        if (!body || !body.note || typeof body.note !== 'string') {
          return new Response(JSON.stringify({ error: 'Missing note (string) describing the real gap or idea' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const identity = await resolveIdentity(request);
        const existing = await readKvList(env, 'self_reflection_log');
        const entry = {
          timestamp: new Date().toISOString(),
          email: identity.email,
          note: body.note,
          question: typeof body.question === 'string' ? body.question : null,
          source: typeof body.source === 'string' ? body.source : 'manual'
        };
        await writeKvList(env, 'self_reflection_log', [...existing, entry], MAX_STORED_SELF_REFLECTIONS);
        return new Response(JSON.stringify({ success: true, logged: true, total: Math.min(existing.length + 1, MAX_STORED_SELF_REFLECTIONS) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Real gap found 2026-09-22 depth audit: self_reflection_log has been
    // write-only since 2026-09-12 - the only documented read path was a
    // raw `wrangler kv key get` CLI call (a comment near
    // MAX_STORED_SELF_REFLECTIONS above still says exactly that), so the
    // venture's own recorded next step ("watching self_reflection_log +
    // real usage patterns") had no repeatable way to actually happen
    // without a human manually running that command and pasting the
    // namespace id each time. This log spans all users, not one person's
    // own data, so it can't hang off resolveIdentity() like every other
    // GET route here - it needs real admin auth, which this codebase
    // never had. Rather than inventing a new auth scheme, reused the
    // exact fail-closed pattern already built and live-verified on
    // paintedwhore.cc (nginx/workers/venture-fleet/src/worker.js,
    // PAINTEDWHORE_ADMIN_SECRET): a query-param secret, identical 404
    // whether the secret is unset or wrong, so this can never become an
    // accidental open read of cross-user data just because the route
    // exists - it only starts working once a human deliberately
    // provisions ALHENA_ADMIN_SECRET via
    // `wrangler secret put ALHENA_ADMIN_SECRET`.
    if (url.pathname === '/api/v1/companion/self-reflection' && request.method === 'GET') {
      const configuredSecret = env.ALHENA_ADMIN_SECRET;
      const providedSecret = url.searchParams.get('secret') || '';
      if (!configuredSecret || providedSecret !== configuredSecret) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const entries = await readKvList(env, 'self_reflection_log');
      return new Response(JSON.stringify({ count: entries.length, entries }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Core Companion Wellness Check-in
    if (url.pathname === '/api/v1/companion/checkin' && request.method === 'POST') {
      try {
        // Same real fix as /api/v1/companion/guidance above: a missing or
        // malformed JSON body must not fall through to a blanket 500.
        const body = await request.json().catch(() => ({}));
        const { mood, energy_level, notes } = body;
        const identity = await resolveIdentity(request);

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

        // Real persistence for every real identity, signed-in or
        // anonymous (2026-09-13 - see resolveIdentity() above and
        // appendCheckinHistory's own comment for the storage shape).
        await appendCheckinHistory(env, identity.email, checkin);
        checkin.saved = true;
        checkin.identity = { anonymous: identity.isAnonymous, id: identity.isAnonymous ? identity.anonId : identity.email };

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
    // persistence fix above. Extended 2026-09-13 to resolveIdentity(): the
    // checkin POST above now always saves (real or anonymous identity),
    // so this reads back either kind the same way.
    if (url.pathname === '/api/v1/companion/checkins' && request.method === 'GET') {
      const identity = await resolveIdentity(request);
      const raw = await env.ALHENA_KV.get(`checkins:${identity.email}`);
      let history = [];
      if (raw) {
        try { history = JSON.parse(raw); } catch (e) { history = []; }
      }
      return new Response(JSON.stringify({ email: identity.email, count: history.length, checkins: history }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Serve the real app shell itself - see the APP_HTML constant's
    // comment at the top of this file for why this route needed to exist.
    if ((url.pathname === '/app' || url.pathname === '/app.html') && request.method === 'GET') {
      return new Response(APP_HTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // ── Companion app-shell routes (app.html) ──────────────────────────
    if (url.pathname === '/api/journal' && request.method === 'POST') {
      try {
        // 2026-09-13 pivot follow-up (real gap found during this pass):
        // the anonymous, no-signup pivot only ever reached /api/chat and
        // the separate /api/v1/companion/* surface app.html doesn't
        // actually call - journal/goals/checkin, the routes the real app
        // UI calls for its core structured-journal/goal-tracking
        // features (this venture's own spec_draft mvp_feature), were
        // left requiring a full AuthFor sign-in, silently contradicting
        // "no signup required" for most of the real app. resolveIdentity
        // (never throws, real anonymous identity or a real AuthFor user)
        // is the same fix already proven on /api/chat - applied here
        // consistently rather than leaving it half-migrated.
        const identity = await resolveIdentity(request);
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
        const identity = await resolveIdentity(request);
        const list = await readKvList(env, `journal:${identity.email}`);
        return new Response(JSON.stringify({ success: true, entries: [...list].reverse() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // resolveIdentity never throws, so a real error reaching here is a
        // genuine server-side failure (KV/parse), not an auth failure -
        // authForErrorResponse would have mislabeled it a 401.
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/goals' && request.method === 'POST') {
      try {
        const identity = await resolveIdentity(request);
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
        const identity = await resolveIdentity(request);
        const list = await readKvList(env, `goals:${identity.email}`);
        return new Response(JSON.stringify({ success: true, goals: [...list].reverse() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.startsWith('/api/goals/') && request.method === 'PUT') {
      try {
        const identity = await resolveIdentity(request);
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
        // 2026-09-13: this route no longer requires a real AuthFor
        // session - resolveIdentity() (see above) resolves a real,
        // persistent anonymous identity when no Bearer token is present,
        // so the free companion chat works with zero signup. See the
        // getUserTier()/FREE_TIER_DAILY_SESSION_LIMIT comments for how
        // the free-tier cap correctly never applies to anonymous callers.
        const identity = await resolveIdentity(request);
        const body = await request.json();
        if (!body.message) {
          return new Response(JSON.stringify({ success: false, error: 'Missing message' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Real free-tier cap, shared with /api/v1/companion/guidance's
        // counter (see getUserTier/getDailySessionCount above) - checked
        // before spending an inference call, not after.
        const tier = await getUserTier(env, identity.email);
        if (tier === 'free') {
          const sessionsUsedToday = await getDailySessionCount(env, identity.email);
          if (sessionsUsedToday >= FREE_TIER_DAILY_SESSION_LIMIT) {
            return new Response(JSON.stringify({
              success: true,
              message: {
                role: 'assistant',
                content: `You've used today's ${FREE_TIER_DAILY_SESSION_LIMIT} free guidance/chat sessions. Sessions reset at midnight UTC, or upgrade to Premium for unlimited sessions (see /api/v1/treasury/subscription-recommendations).`,
                limit_reached: true,
                inference_source: 'tier_limit',
                timestamp: new Date().toISOString()
              }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        const key = `chat:${identity.email}`;
        const list = await readKvList(env, key);
        const contextTurns = tier === 'elite' ? GUIDANCE_HISTORY_TURNS_INJECTED_ELITE : GUIDANCE_HISTORY_TURNS_INJECTED;
        const priorMessages = list
          .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string')
          .slice(-contextTurns * 2)
          .map(({ role, content }) => ({ role, content }));
        list.push({ role: 'user', content: body.message, timestamp: new Date().toISOString() });
        const inference = await generateChatReply(env, body.message, priorMessages, contextTurns);
        if (tier === 'free') {
          ctx.waitUntil(incrementDailySessionCount(env, identity.email));
        }
        // Real fallback/inference_source metadata (added 2026-09-12,
        // matching what /api/v1/companion/guidance already exposed) - the
        // real UI's actual chat endpoint previously gave no signal at all
        // about whether a given reply was a live model answer or the
        // hand-written fallback text; now both endpoints report the same
        // real, per-call state honestly.
        const reply = {
          role: 'assistant',
          content: inference.guidance,
          fallback_mode: inference.isFallback,
          inference_source: inference.inferenceSource,
          timestamp: new Date().toISOString()
        };
        if (inference.self_reflection) reply.self_reflection = true;
        list.push(reply);
        await writeKvList(env, key, list, MAX_STORED_CHAT_MESSAGES);

        // Real "getting Alhena involved in the process" mechanism: when a
        // user's own message tripped the self-reflection check above, that
        // moment - the real question, this identified user, the real
        // fallback/inference_source state at the time - is written to a
        // shared, capped KV log a human can actually read back later (see
        // self_reflection_log below and the dedicated POST/GET routes).
        // This is the entire mechanism: a real logged event, nothing more
        // automated than that.
        if (inference.self_reflection) {
          ctx.waitUntil((async () => {
            const existing = await readKvList(env, 'self_reflection_log');
            await writeKvList(env, 'self_reflection_log', [...existing, {
              timestamp: new Date().toISOString(),
              email: identity.email,
              question: body.message,
              answer: inference.guidance,
              fallback_mode: inference.isFallback,
              inference_source: inference.inferenceSource,
              source: 'chat'
            }], MAX_STORED_SELF_REFLECTIONS);
          })());
        }

        return new Response(JSON.stringify({
          success: true,
          message: reply,
          identity: { anonymous: identity.isAnonymous, id: identity.isAnonymous ? identity.anonId : identity.email }
        }), {
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
        // 2026-09-13: resolveIdentity() (see above) - same no-signup
        // anonymous path as POST /api/chat, so history round-trips for
        // both real and anonymous identities.
        const identity = await resolveIdentity(request);
        // Real bug found 2026-09-12 (same class as the /api/checkin/history
        // `days` bug above and salesfactorai.com's days=0 bug found earlier
        // this session): `parseInt(...) || 100` silently overrode an
        // explicit, valid `limit=0` to the 100-message default instead of
        // clamping it to the real minimum of 1.
        const rawLimit = parseInt(url.searchParams.get('limit'), 10);
        const limit = Math.max(1, Math.min(1000, Number.isNaN(rawLimit) ? 100 : rawLimit));
        const list = await readKvList(env, `chat:${identity.email}`);
        return new Response(JSON.stringify({ success: true, messages: list.slice(-limit) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // resolveIdentity() never throws (unlike the old authenticateViaAuthFor
        // it replaced 2026-09-13), so a genuine 401 here is no longer
        // possible - any error reaching this catch is a real server-side
        // failure (e.g. KV), not an auth failure.
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Numeric mood/energy (1-10) daily check-ins for the app shell -
    // deliberately a distinct KV key (checkin2:) from the string-mood
    // ('anxious'/'happy') anonymous-capable /api/v1/companion/checkin
    // above. Different data shape, different feature, same venture.
    if (url.pathname === '/api/checkin' && request.method === 'POST') {
      try {
        const identity = await resolveIdentity(request);
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
        const identity = await resolveIdentity(request);
        // Real bug found 2026-09-12 (same class as salesfactorai.com's
        // days=0 bug found earlier this session): `parseInt(...) || 30`
        // treats an explicit, valid `days=0` the same as a missing/NaN
        // value, silently overriding it to the 30-day default instead of
        // clamping it to the real minimum of 1 like every other value
        // already goes through Math.max/Math.min for. A caller explicitly
        // asking for "just today" got a full 30-day window back instead.
        const rawDays = parseInt(url.searchParams.get('days'), 10);
        const days = Math.max(1, Math.min(365, Number.isNaN(rawDays) ? 30 : rawDays));
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
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Real Elite-tier feature (added 2026-09-13) - makes "Advanced
    // wellness insights" in the subscription-recommendations copy below
    // an actually-delivered capability instead of unenforced marketing
    // text. Computed entirely from the same real checkin2:${email} data
    // /api/checkin/history already reads - no fabricated numbers, no
    // Math.random() (see the treasury removal note just below for what
    // that class of mistake looked like last time).
    if (url.pathname === '/api/insights' && request.method === 'GET') {
      try {
        const identity = await authenticateViaAuthFor(request);
        const tier = await getUserTier(env, identity.email);
        if (tier !== 'elite') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Advanced wellness insights is an Elite-tier feature',
            code: 'TIER_REQUIRED',
            current_tier: tier
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const list = await readKvList(env, `checkin2:${identity.email}`);
        const now = Date.now();
        const daysAgoMs = n => now - n * 24 * 60 * 60 * 1000;
        const windowSince = ms => list.filter(c => new Date(c.date).getTime() >= ms);
        const avgMood = arr => arr.length ? arr.reduce((s, c) => s + c.mood, 0) / arr.length : null;
        const last7 = windowSince(daysAgoMs(7));
        const last30 = windowSince(daysAgoMs(30));
        const prior7 = windowSince(daysAgoMs(14)).filter(c => new Date(c.date).getTime() < daysAgoMs(7));
        const avgLast7 = avgMood(last7);
        const avgPrior7 = avgMood(prior7);
        let trend = 'not_enough_data';
        if (avgLast7 !== null && avgPrior7 !== null) {
          const diff = avgLast7 - avgPrior7;
          trend = diff > 0.5 ? 'improving' : diff < -0.5 ? 'declining' : 'stable';
        }
        return new Response(JSON.stringify({
          success: true,
          tier,
          total_checkins: list.length,
          streak: checkinStreak(list),
          avg_mood_7d: avgLast7,
          avg_mood_30d: avgMood(last30),
          trend_last_7d_vs_prior_7d: trend
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        if (e.status) return authForErrorResponse(e, corsHeaders);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
          // 'Daily wellness tracking' and 'Priority responses' removed
          // 2026-09-13, same class of bug as the 2026-09-03/2026-09-11
          // removals below: wellness tracking (/api/checkin,
          // /api/v1/companion/checkin) has always been free for every
          // tier, so listing it as a premium perk was never true, and
          // "priority" responses were never implemented (there is no
          // request-priority mechanism anywhere in this Worker). The one
          // feature below is real and enforced as of the same pass -
          // see FREE_TIER_DAILY_SESSION_LIMIT / getUserTier above.
          recommendations.push({
            tier: 'premium',
            monthly_cost: 9.99,
            features: [`Unlimited guidance & chat sessions (free tier is capped at ${FREE_TIER_DAILY_SESSION_LIMIT}/day, enforced)`],
            savings_estimate: 'No more waiting until tomorrow to keep talking with Alhena'
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
          // 'Extended session time' reworded 2026-09-13 to what it actually
          // is now that it's real: a longer injected conversation-memory
          // window (GUIDANCE_HISTORY_TURNS_INJECTED_ELITE), not literally
          // more session duration.
          recommendations.push({
            tier: 'elite',
            monthly_cost: 19.99,
            features: [
              `Extended conversation memory (Alhena recalls the last ${GUIDANCE_HISTORY_TURNS_INJECTED_ELITE} exchanges vs ${GUIDANCE_HISTORY_TURNS_INJECTED} on Premium)`,
              'Advanced wellness insights - GET /api/insights (mood trend, 7/30-day averages, real streak)'
            ],
            savings_estimate: 'For frequent users who want Alhena to remember more, and real insight into their own patterns'
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

    return new Response('<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Alhena | Personal AI Companion</title>\n    <meta name="description" content="Personal AI companion for talking through everyday decisions. Not therapy or medical care.">\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">\n    <style>\n        :root {\n            --bg: #0a0f1f;\n            --surface: rgba(139, 92, 246, 0.05);\n            --border: rgba(139, 92, 246, 0.15);\n            --accent: #8B5CF6;\n            --accent-glow: rgba(139, 92, 246, 0.25);\n            --text: #F3F4F6;\n            --text-muted: #9CA3AF;\n            --wellness: #10B981;\n        }\n\n        * { box-sizing: border-box; margin: 0; padding: 0; }\n\n        body {\n            background-color: var(--bg);\n            color: var(--text);\n            font-family: \'Inter\', -apple-system, sans-serif;\n            min-height: 100vh;\n            display: flex;\n            flex-direction: column;\n            overflow-x: hidden;\n            background-image: radial-gradient(circle at 50% -20%, var(--accent-glow) 0%, transparent 60%);\n        }\n\n        header {\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            padding: 1.5rem 2rem;\n            border-bottom: 1px solid var(--border);\n            backdrop-filter: blur(12px);\n        }\n\n        .logo {\n            font-family: \'Outfit\', sans-serif;\n            font-weight: 900;\n            text-transform: uppercase;\n            letter-spacing: 1px;\n            color: #FFF;\n            display: flex;\n            align-items: center;\n            gap: 0.5rem;\n        }\n\n        .logo span {\n            color: var(--accent);\n        }\n\n        .status {\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            padding: 0.25rem 0.75rem;\n            border-radius: 9999px;\n            border: 1px solid var(--border);\n            color: var(--text-muted);\n        }\n\n        .status.online {\n            color: var(--wellness);\n            border-color: rgba(16, 185, 129, 0.2);\n            background: rgba(16, 185, 129, 0.05);\n        }\n\n        main {\n            flex: 1;\n            max-width: 900px;\n            width: 100%;\n            margin: 0 auto;\n            padding: 4rem 2rem;\n        }\n\n        .hero {\n            text-align: center;\n            margin-bottom: 4rem;\n        }\n\n        h1 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 3.5rem;\n            font-weight: 900;\n            letter-spacing: -1px;\n            margin-bottom: 1.5rem;\n            background: linear-gradient(135deg, #FFFFFF, var(--accent));\n            -webkit-background-clip: text;\n            -webkit-text-fill-color: transparent;\n        }\n\n        .tagline {\n            font-size: 1.2rem;\n            color: var(--text-muted);\n            max-width: 700px;\n            margin: 0 auto 3rem auto;\n            line-height: 1.6;\n        }\n\n        .companion-zone {\n            border: 2px solid var(--border);\n            border-radius: 20px;\n            padding: 3rem 2rem;\n            text-align: center;\n            background: var(--surface);\n            backdrop-filter: blur(12px);\n            margin-bottom: 3rem;\n            transition: all 0.3s ease;\n        }\n\n        .companion-zone:hover {\n            border-color: var(--accent);\n            background: rgba(139, 92, 246, 0.1);\n            box-shadow: 0 0 30px var(--accent-glow);\n        }\n\n        .companion-icon {\n            font-size: 3rem;\n            margin-bottom: 1rem;\n            display: inline-block;\n            animation: pulse 2s infinite;\n        }\n\n        @keyframes pulse {\n            0%, 100% { opacity: 1; }\n            50% { opacity: 0.7; }\n        }\n\n        .companion-text h3 {\n            font-family: \'Outfit\', sans-serif;\n            font-size: 1.5rem;\n            margin-bottom: 0.5rem;\n        }\n\n        .companion-text p {\n            color: var(--text-muted);\n            font-size: 0.95rem;\n        }\n\n        .disclaimer {\n            font-size: 0.85rem;\n            color: var(--text-muted);\n            max-width: 640px;\n            margin: 0 auto 2rem auto;\n            padding: 0.85rem 1.25rem;\n            border: 1px solid var(--border);\n            border-radius: 10px;\n            background: rgba(139, 92, 246, 0.06);\n            line-height: 1.5;\n        }\n\n        .btn {\n            display: inline-block;\n            padding: 1rem 2rem;\n            background: var(--accent-glow);\n            color: #FFF;\n            border: 1px solid var(--accent);\n            border-radius: 8px;\n            text-align: center;\n            text-decoration: none;\n            font-weight: 600;\n            transition: all 0.3s ease;\n            cursor: pointer;\n            margin-top: 1.5rem;\n        }\n\n        .btn:hover {\n            background: var(--accent);\n            box-shadow: 0 0 20px var(--accent-glow);\n        }\n\n        footer {\n            padding: 2rem;\n            border-top: 1px solid var(--border);\n            text-align: center;\n            font-family: \'Courier New\', Courier, monospace;\n            font-size: 0.75rem;\n            color: var(--text-muted);\n        }\n    </style>\n</head>\n<body>\n    <header>\n        <div class="logo"><b>A</b><span>lhena</span></div>\n        <span id="companion-status" class="status online">COMPANION ACTIVE</span>\n    </header>\n\n    <main>\n        <section class="hero">\n            <h1>Your Personal AI Companion</h1>\n            <p class="tagline">A supportive companion for talking through everyday decisions.</p>\n            <p class="disclaimer">Alhena is not a therapist and does not provide medical or mental-health treatment. In a crisis, call or text 988 (Suicide &amp; Crisis Lifeline) or text HOME to 741741 (Crisis Text Line) - real, free, 24/7 resources.</p>\n\n            <div class="companion-zone">\n                <div class="companion-icon">✨</div>\n                <div class="companion-text">\n                    <h3>Start a Conversation</h3>\n                    <p>Share what\'s on your mind. Receive compassionate guidance tailored to your unique situation.</p>\n                </div>\n                <button class="btn" onclick="initCompanion()">CONNECT WITH ALHENA</button>\n            </div>\n        </section>\n    </main>\n\n    <footer>\n        ● SYSTEM INTERLOCK: MOBCORP &gt; MOBLEYSOFT &gt; MOBLEY &gt; MASCOM &gt; ALHENA\n    </footer>\n\n    <script>\n        function initCompanion() {\n            // Real fix 2026-09-12: this used to redirect to a generic,\n            // unrelated AuthFor Vault page on a different workers.dev\n            // subdomain that ignored returnTo and never sent the visitor\n            // back to Alhena at all - a real dead end, confirmed live.\n            // /app is the real Alhena chat/journal/goals UI (now\n            // actually served, see the GET /app route) with its own\n            // working AuthFor sign-in screen.\n            window.location.href = \'/app\';\n        }\n    </script>\n</body>\n</html>', {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
  }
};
