#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/godot/paradise-game"

required_files=(
  "$PROJECT/project.godot"
  "$PROJECT/scenes/paradise_main.tscn"
  "$PROJECT/scripts/paradise_controller.gd"
  "$PROJECT/export_presets.cfg"
  "$PROJECT/README.md"
  "$ROOT/public/game-v3/index.html"
  "$ROOT/public/game-v3/godot/index.html"
  "$ROOT/public/game-v3/godot/index.js"
  "$ROOT/public/game-v3/godot/index.wasm.br"
  "$ROOT/public/game-v3/godot/index.wasm.part00"
  "$ROOT/public/game-v3/godot/index.wasm.part01"
  "$ROOT/public/game-v3/godot/index.pck"
  "$ROOT/public/game-v3/godot/index.audio.worklet.js"
  "$ROOT/public/game-v3/godot/index.audio.position.worklet.js"
  "$ROOT/public/_headers"
  "$ROOT/worker.js"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required V3 file: $file" >&2
    exit 1
  fi
done

markers=(
  "v3-godot-glb-production-gate-runtime"
  "ShorelineEnvironmentSlot"
  "AlhenaSlot"
  "BlackLabSlot"
  "OceanSlot"
  "gl_compatibility"
  "export_path=\"../../public/game-v3/godot/index.html\""
)

for marker in "${markers[@]}"; do
  if ! grep -R -Fq "$marker" "$PROJECT"; then
    echo "Missing V3 project marker: $marker" >&2
    exit 1
  fi
done

if ! grep -Fq "Content-Type: application/wasm" "$ROOT/public/_headers"; then
  echo "Missing WASM header for web export" >&2
  exit 1
fi

if ! grep -Fq "index.wasm.part00" "$ROOT/worker.js"; then
  echo "Missing Worker chunked WASM mapping" >&2
  exit 1
fi

if ! grep -Fq "/api/paradise-godot/index.wasm" "$ROOT/public/game-v3/godot/index.html"; then
  echo "Missing Godot API WASM runtime reference" >&2
  exit 1
fi

if ! grep -Fq "index.pck" "$ROOT/public/game-v3/godot/index.html"; then
  echo "Missing Godot pack reference" >&2
  exit 1
fi

godot_bin=""
if command -v godot >/dev/null 2>&1; then
  godot_bin="$(command -v godot)"
elif command -v godot4 >/dev/null 2>&1; then
  godot_bin="$(command -v godot4)"
elif [[ -x "/Applications/Godot.app/Contents/MacOS/Godot" ]]; then
  godot_bin="/Applications/Godot.app/Contents/MacOS/Godot"
elif [[ -x "/opt/homebrew/Caskroom/godot/4.4.1/Godot.app/Contents/MacOS/Godot" ]]; then
  godot_bin="/opt/homebrew/Caskroom/godot/4.4.1/Godot.app/Contents/MacOS/Godot"
fi

if [[ -n "$godot_bin" ]]; then
  "$godot_bin" --headless --path "$PROJECT" --check-only --quit
else
  echo "Godot CLI not installed; structure-only V3 verification passed."
fi

echo "Paradise V3 Godot scaffold verified: $PROJECT"
