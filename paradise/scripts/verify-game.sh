#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_HTML="$ROOT/public/game/index.html"
GAME_V2_HTML="$ROOT/public/game-v2/index.html"
TMP_MODULE="/tmp/paradise-game-module.mjs"
TMP_V2_MODULE="/tmp/paradise-game-v2-module.mjs"
TMP_LIVE="/tmp/paradise-live-verify.html"
TMP_V2_LIVE="/tmp/paradise-v2-live-verify.html"
TMP_ROOT_LIVE="/tmp/paradise-root-live-verify.html"
URL="${1:-https://paradise.alhena.cc/game/?v=verify}"
V2_URL="${2:-https://paradise.alhena.cc/game-v2/?view=shore&time=sunset&weather=breeze&quality=cinematic&v=verify}"
ROOT_URL="${3:-https://paradise.alhena.cc/?v=verify}"

python3 - "$GAME_HTML" > "$TMP_MODULE" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
start = source.index('<script type="module">') + len('<script type="module">')
end = source.index('</script>', start)
print(source[start:end])
PY

node --check "$TMP_MODULE"

python3 - "$GAME_V2_HTML" > "$TMP_V2_MODULE" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
start = source.index('<script type="module">') + len('<script type="module">')
end = source.index('</script>', start)
print(source[start:end])
PY

node --check "$TMP_V2_MODULE"
node "$ROOT/scripts/verify-assets.mjs" >/tmp/paradise-assets-verify.json
git -C "$ROOT/.." diff --check -- paradise/public/game/index.html paradise/public/game-v2/index.html paradise/public/index.html paradise/verification/README.md

http_code="$(curl -L -s -o "$TMP_LIVE" -w '%{http_code}' "$URL")"
if [[ "$http_code" != "200" ]]; then
  echo "Paradise live check failed: HTTP $http_code for $URL" >&2
  exit 1
fi

required_markers=(
  "for (int i = 0; i < 32"
  "setDogRenderMode"
  "meshwater"
  "qualityMode"
  "spectral-ridge-field-perspective-water-lines"
  "installExperimentalReflectiveWater"
  "visibilitychange"
  "repeating-radial-gradient"
)

for marker in "${required_markers[@]}"; do
  if ! grep -Fq "$marker" "$TMP_LIVE"; then
    echo "Paradise live check failed: missing marker: $marker" >&2
    exit 1
  fi
done

root_code="$(curl -L -s -o "$TMP_ROOT_LIVE" -w '%{http_code}' "$ROOT_URL")"
if [[ "$root_code" != "200" ]]; then
  echo "Paradise root check failed: HTTP $root_code for $ROOT_URL" >&2
  exit 1
fi

root_markers=(
  "Launch 3D shore"
  "/game-v2/?view=shore&time=dawn&weather=breeze&quality=cinematic&presentation=1"
  "Legacy canvas prototype"
)

for marker in "${root_markers[@]}"; do
  if ! grep -Fq "$marker" "$TMP_ROOT_LIVE"; then
    echo "Paradise root check failed: missing marker: $marker" >&2
    exit 1
  fi
done

v2_code="$(curl -L -s -o "$TMP_V2_LIVE" -w '%{http_code}' "$V2_URL")"
if [[ "$v2_code" != "200" ]]; then
  echo "Paradise V2 live check failed: HTTP $v2_code for $V2_URL" >&2
  exit 1
fi

v2_markers=(
  "v2-jonswap-displaced-ocean-mesh"
  "v2-pandorachat-fullscreen-ocean-pass"
  "v2-canonical-pandorachat-webgl2-ocean-shader"
  "v2-jonswap-inspired-analytical-normals-fresnel-scatter-foam-fog-tonemap"
  "v2-pandorachat-parallax-reflection-caustic-horizon-breakup"
  "causticField"
  "jonswapSpectrum"
  "v2-pandorachat-background-owns-atmosphere"
  "v2-pandorachat-jonswap-fresnel-water-optics-overlay"
  "v2-perspective-shallow-water-displacement-ribbon"
  "uStorm"
  "v2-pbr-sky-ocean-environment-map"
  "v2-layered-shorebreak-wash-sheet"
  "v2-layered-atmospheric-cloud-bank"
  "v2-cinematic-atmospheric-sun-shafts"
  "v2-layered-depth-mist-over-ocean"
  "v2-softened-distant-island-silhouette"
  "v2-black-lab-procedural-rig-standin"
  "v2-black-lab-procedural-four-beat-gait-standin"
  "v2-black-lab-high-fidelity-transparent-billboard"
  "v2-black-lab-photo-contact-shadow"
  "v2-alhena-bartender-procedural-standin"
  "v2-alhena-high-fidelity-transparent-bartender-billboard"
  "v2-alhena-billboard-contact-shadow"
  "v2-high-fidelity-transparent-beach-bar-billboard"
  "v2-beach-bar-billboard-contact-shadow"
  "/assets/beach-bar-billboard.png"
  "v2-high-fidelity-transparent-beach-house-billboard"
  "v2-beach-house-billboard-contact-shadow"
  "/assets/beach-house-billboard.png"
  "v2-near-surface-fish-glint"
  "v2-reflective-shoreline-tide-pool"
  "v2-left-wet-rock-cluster"
  "v2-bleached-driftwood-log-a"
  "class=\"lens\""
  "mobile-controls"
  "v2-mobile-wrist-casting-haptic-feedback"
  "DeviceMotionEvent.requestPermission"
  "presentation"
  "hud-hidden"
  "installRuntimeAssetSlots"
)

for marker in "${v2_markers[@]}"; do
  if ! grep -Fq "$marker" "$TMP_V2_LIVE"; then
    echo "Paradise V2 live check failed: missing marker: $marker" >&2
    exit 1
  fi
done

echo "Paradise game verified: $URL"
echo "Paradise root verified: $ROOT_URL"
echo "Paradise V2 verified: $V2_URL"
echo "Paradise assets verified: /tmp/paradise-assets-verify.json"
