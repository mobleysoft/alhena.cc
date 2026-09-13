#!/bin/bash
# safe-deploy.sh - pre/post-deploy safety wrapper for alhena-cc-worker.
#
# Built 2026-09-13, generalizing workers/venture-fleet/safe-deploy.sh's
# proven pattern (see /Users/johnmobley/mascom/safe-deploy-lib.sh) to this
# repo. alhena.cc is its own dedicated git repo (not part of the shared
# nginx/ multi-venture tree), but the same underlying hazard applies -
# AGENTS.md incident #4b: multiple concurrent Claude Code
# sessions/agents can read/write/deploy from this SAME on-disk checkout.
# Scope note: this covers ONLY the Cloudflare Worker (alhena-cc-worker,
# this repo) - the separate James-texting Python companion daemon
# (mascom/alhena_checkin_companion.py) is a different system on a
# different machine process and is out of scope here.
#
# Real bindings/secrets found by reading this repo's own wrangler.toml and
# `wrangler secret list` on 2026-09-13 (not guessed): a KV namespace for
# companion state/identity/journal/goals, and real secrets backing
# checkout (VENDYAI_HMAC_SECRET - alhena is a real vendyai checkout
# consumer per worker.js, calling https://vendyai.com/api/checkout/sessions
# over plain fetch rather than a Cloudflare service binding, so there is no
# D1 or a bindable Stripe key to assert here - only what's actually real),
# plus SMS relay/inbound secrets and LLAMA_ACCESS_CLIENT_ID/SECRET for the
# shared inference endpoint. Secrets aren't stored in wrangler.toml at all
# (set via `wrangler secret put`), so this script can only positively
# assert what's committed to config - the KV binding.
#
# Usage: ./safe-deploy.sh [extra wrangler deploy args]

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source /Users/johnmobley/mascom/safe-deploy-lib.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="wrangler.toml"

sd_banner "alhena-cc-worker"

# 1. Branch check.
sd_require_branch "$REPO_ROOT" main

# 2. Clean-tree check - this is a dedicated single-venture repo, so check
#    the whole tree rather than scoping to a subpath.
sd_require_clean_tree "$REPO_ROOT"

# 3. Positive binding assertions.
sd_require_config_lines "$CONFIG" \
  'binding = "ALHENA_KV"||KV namespace backing companion identity/journal/goals/chat history - losing this breaks nearly every /api/v1/companion/* and /api/* route'

echo "Pre-deploy checks passed: on main, clean tree, required bindings present."

# 4. Deploy for real.
sd_deploy "$CONFIG" "$@"

# 5. Post-deploy live verification against the real, unauthenticated health
#    probe (GET /api/v1/health) - checks for the distinguishing engine tag
#    rather than just "status":"ok" alone.
echo ""
echo "== post-deploy verification =="
sd_verify_response_body \
  "https://alhena.cc/api/v1/health" \
  '"engine":"Alhena-Companion-v1"'

sd_banner_done "alhena-cc-worker"
