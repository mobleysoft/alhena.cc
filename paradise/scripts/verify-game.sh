#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_HTML="$ROOT/public/game/index.html"
TMP_MODULE="/tmp/paradise-game-module.mjs"
TMP_LIVE="/tmp/paradise-live-verify.html"
URL="${1:-https://paradise.alhena.cc/game/?v=verify}"

python3 - "$GAME_HTML" > "$TMP_MODULE" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
start = source.index('<script type="module">') + len('<script type="module">')
end = source.index('</script>', start)
print(source[start:end])
PY

node --check "$TMP_MODULE"
node "$ROOT/scripts/verify-assets.mjs" >/tmp/paradise-assets-verify.json
git -C "$ROOT/.." diff --check -- paradise/public/game/index.html

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

echo "Paradise game verified: $URL"
echo "Paradise assets verified: /tmp/paradise-assets-verify.json"
