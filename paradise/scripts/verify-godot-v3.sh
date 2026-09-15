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
  "$ROOT/public/_headers"
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
  "export_path=\"../../public/game-v3/index.html\""
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

if command -v godot >/dev/null 2>&1; then
  godot --headless --path "$PROJECT" --check-only --quit
elif command -v godot4 >/dev/null 2>&1; then
  godot4 --headless --path "$PROJECT" --check-only --quit
else
  echo "Godot CLI not installed; structure-only V3 verification passed."
fi

echo "Paradise V3 Godot scaffold verified: $PROJECT"
