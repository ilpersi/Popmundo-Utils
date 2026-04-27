#!/usr/bin/env bash
# Pack the Popmundo Utils Chrome extension into a zip archive for store publishing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Derive version from manifest.json using python3 (available on macOS)
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUTPUT="popmundo-utils-v${VERSION}.zip"

rm -f "$OUTPUT"

zip -r "$OUTPUT" \
    manifest.json \
    background.js \
    _locales \
    common \
    features \
    icons \
    libs \
    options \
    --exclude "*.DS_Store" \
    --excluce ".cws_credentials.json" \
    --exclude "*.md" \
    --exclude "*.ps1" \
    --exclude "*.py" \
    --exclude "*.sh" \
    --exclude "*.zip" \
    --exclude "*.json"

FILE_COUNT=$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')
SIZE_KB=$(du -k "$OUTPUT" | awk '{print $1}')
echo "Created ${OUTPUT}  (${FILE_COUNT} files, ${SIZE_KB} KB)"
