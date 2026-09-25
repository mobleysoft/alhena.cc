#!/bin/bash
# safe-deploy.sh - pre/post-deploy safety wrapper for alhena-paradise-worker.
#
# This worker is separate from the root alhena.cc companion worker. It serves
# paradise.alhena.cc static game assets from ./public through Cloudflare Assets.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source /Users/johnmobley/mascom/safe-deploy-lib.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="wrangler.toml"

sd_banner "alhena-paradise-worker"

sd_require_branch "$REPO_ROOT" main
sd_require_clean_tree "$REPO_ROOT"

sd_require_config_lines "$CONFIG" \
  'name = "alhena-paradise-worker"||Cloudflare Worker name for paradise.alhena.cc' \
  'binding = "ASSETS"||Cloudflare Assets binding serving Paradise game files'

echo "Pre-deploy checks passed: on main, clean tree, required Paradise asset binding present."
node --test scripts/test-cove.mjs scripts/test-rain.mjs scripts/test-foliage.mjs scripts/test-garden.mjs

sd_deploy "$CONFIG" "$@"

echo ""
echo "== post-deploy verification =="
sd_verify_response_body \
  "https://paradise.alhena.cc/" \
  'data-paradise-build="unified-cove-20260924"'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/main.js" \
  'createOcean'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/vendor/three.module.min.js" \
  'WebGLRenderer'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/ripple-field.js" \
  'createComputePipelineAsync'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/ocean.js" \
  'causticEvidence'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/locomotion.js" \
  'solveTwoBone'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/splash.js" \
  'createSplashes'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/foliage.js" \
  'createFrondGeometry'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/static-geometry.js" \
  'prepareStaticGeometry'
sd_verify_response_body \
  "https://paradise.alhena.cc/island/coastal-garden.js" \
  'createCoastalGarden'

sd_banner_done "alhena-paradise-worker"
