#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONSET="$ROOT/build/focus-mark.iconset"
mkdir -p "$ICONSET"

make_icon() {
  local filename="$1"
  local size="$2"
  sips -z "$size" "$size" "$ROOT/assets/focus-mark.png" --out "$ICONSET/$filename" >/dev/null
}

make_icon icon_16x16.png 16
make_icon icon_16x16@2x.png 32
make_icon icon_32x32.png 32
make_icon icon_32x32@2x.png 64
make_icon icon_128x128.png 128
make_icon icon_128x128@2x.png 256
make_icon icon_256x256.png 256
make_icon icon_256x256@2x.png 512
make_icon icon_512x512.png 512
make_icon icon_512x512@2x.png 1024

iconutil --convert icns --output "$ROOT/build/focus-mark.icns" "$ICONSET"
