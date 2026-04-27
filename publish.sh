#!/usr/bin/env bash
# Pack and publish the Popmundo Utils Chrome extension to the Chrome Web Store.
#
# Dependencies: curl, zip, jq, python3 (for version parsing)
#   macOS:  brew install jq
#   Linux:  apt install jq / dnf install jq
#
# Credentials (env vars or .cws_credentials.json):
#   CWS_EXTENSION_ID   — Chrome Web Store extension ID
#   CWS_CLIENT_ID      — OAuth 2.0 client ID
#   CWS_CLIENT_SECRET  — OAuth 2.0 client secret
#   CWS_REFRESH_TOKEN  — long-lived refresh token
#
# Usage:
#   ./publish.sh                        pack + upload + publish (public)
#   ./publish.sh --target trustedTesters
#   ./publish.sh --pack-only
#   ./publish.sh --publish-only file.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CREDENTIALS_FILE=".cws_credentials.json"
CWS_TOKEN_URL="https://oauth2.googleapis.com/token"
CWS_UPLOAD_URL="https://www.googleapis.com/upload/chromewebstore/v1.1/items"
CWS_PUBLISH_URL="https://www.googleapis.com/chromewebstore/v1.1/items"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

PACK_ONLY=false
PUBLISH_ONLY=""
TARGET="default"
GET_TOKEN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pack-only)    PACK_ONLY=true; shift ;;
        --publish-only) PUBLISH_ONLY="$2"; shift 2 ;;
        --target)       TARGET="$2"; shift 2 ;;
        --get-token)    GET_TOKEN=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Get refresh token (one-time OAuth flow)
# ---------------------------------------------------------------------------

get_token() {
    local client_id="${CWS_CLIENT_ID:-}"
    local client_secret="${CWS_CLIENT_SECRET:-}"

    if [[ -z "$client_id" && -f "$CREDENTIALS_FILE" ]]; then
        client_id=$(jq -r '.client_id // empty' "$CREDENTIALS_FILE")
    fi
    if [[ -z "$client_secret" && -f "$CREDENTIALS_FILE" ]]; then
        client_secret=$(jq -r '.client_secret // empty' "$CREDENTIALS_FILE")
    fi

    if [[ -z "$client_id" || -z "$client_secret" ]]; then
        echo "CWS_CLIENT_ID and CWS_CLIENT_SECRET must be set before running --get-token."
        exit 1
    fi

    local port=8484
    local redirect_uri="http://localhost:${port}/"

    local auth_url
    auth_url=$(python3 - <<EOF
import urllib.parse
params = {
    "client_id":     "${client_id}",
    "redirect_uri":  "${redirect_uri}",
    "response_type": "code",
    "scope":         "https://www.googleapis.com/auth/chromewebstore",
    "access_type":   "offline",
    "prompt":        "consent",
}
print("https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params))
EOF
)

    echo "Opening browser for authorization..."
    if command -v open &>/dev/null; then
        open "$auth_url"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$auth_url"
    else
        echo "Open this URL in your browser:"
        echo "$auth_url"
    fi

    echo "Waiting for OAuth callback on port ${port}..."
    local code
    code=$(python3 - <<EOF
import http.server, urllib.parse, threading

code = [None]

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code[0] = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h1>Authorization complete. You may close this tab.</h1>")
        threading.Thread(target=self.server.shutdown).start()
    def log_message(self, *a): pass

http.server.HTTPServer(("localhost", ${port}), Handler).serve_forever()
print(code[0])
EOF
)

    if [[ -z "$code" ]]; then
        echo "Failed to obtain authorization code."
        exit 1
    fi

    local response
    response=$(curl -s -X POST "$CWS_TOKEN_URL" \
        -d "client_id=${client_id}" \
        -d "client_secret=${client_secret}" \
        -d "code=${code}" \
        -d "redirect_uri=${redirect_uri}" \
        -d "grant_type=authorization_code")

    local refresh_token
    refresh_token=$(echo "$response" | jq -r '.refresh_token // empty')

    if [[ -z "$refresh_token" ]]; then
        echo "Failed to obtain refresh token: $response"
        exit 1
    fi

    echo ""
    echo "Refresh token:"
    echo "  $refresh_token"
    echo ""
    echo "Add it to ${CREDENTIALS_FILE} as \"refresh_token\" or set CWS_REFRESH_TOKEN."
}

# ---------------------------------------------------------------------------
# Pack
# ---------------------------------------------------------------------------

pack() {
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
        --exclude "*.md" \
        --exclude "*.ps1" \
        --exclude "*.py" \
        --exclude "*.sh" \
        --exclude "*.zip" \
        > /dev/null

    FILE_COUNT=$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')
    SIZE_KB=$(du -k "$OUTPUT" | awk '{print $1}')
    echo "Packed:    ${OUTPUT}  (${FILE_COUNT} files, ${SIZE_KB} KB)"
    echo "$OUTPUT"
}

# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

load_credentials() {
    # Prefer env vars; fall back to .cws_credentials.json
    if [[ -z "${CWS_EXTENSION_ID:-}" && -f "$CREDENTIALS_FILE" ]]; then
        CWS_EXTENSION_ID=$(jq -r '.extension_id // empty' "$CREDENTIALS_FILE")
    fi
    if [[ -z "${CWS_CLIENT_ID:-}" && -f "$CREDENTIALS_FILE" ]]; then
        CWS_CLIENT_ID=$(jq -r '.client_id // empty' "$CREDENTIALS_FILE")
    fi
    if [[ -z "${CWS_CLIENT_SECRET:-}" && -f "$CREDENTIALS_FILE" ]]; then
        CWS_CLIENT_SECRET=$(jq -r '.client_secret // empty' "$CREDENTIALS_FILE")
    fi
    if [[ -z "${CWS_REFRESH_TOKEN:-}" && -f "$CREDENTIALS_FILE" ]]; then
        CWS_REFRESH_TOKEN=$(jq -r '.refresh_token // empty' "$CREDENTIALS_FILE")
    fi

    local missing=()
    [[ -z "${CWS_EXTENSION_ID:-}"  ]] && missing+=(CWS_EXTENSION_ID)
    [[ -z "${CWS_CLIENT_ID:-}"     ]] && missing+=(CWS_CLIENT_ID)
    [[ -z "${CWS_CLIENT_SECRET:-}" ]] && missing+=(CWS_CLIENT_SECRET)
    [[ -z "${CWS_REFRESH_TOKEN:-}" ]] && missing+=(CWS_REFRESH_TOKEN)

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Missing credentials: ${missing[*]}"
        echo "Set env vars or create ${CREDENTIALS_FILE}."
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# OAuth token refresh
# ---------------------------------------------------------------------------

get_access_token() {
    local response
    response=$(curl -s -X POST "$CWS_TOKEN_URL" \
        -d "client_id=${CWS_CLIENT_ID}" \
        -d "client_secret=${CWS_CLIENT_SECRET}" \
        -d "refresh_token=${CWS_REFRESH_TOKEN}" \
        -d "grant_type=refresh_token")

    local token
    token=$(echo "$response" | jq -r '.access_token // empty')

    if [[ -z "$token" ]]; then
        echo "Failed to obtain access token: $response"
        exit 1
    fi

    echo "$token"
}

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

upload() {
    local zip_path="$1"
    local access_token="$2"

    local response
    response=$(curl -s -X PUT \
        "${CWS_UPLOAD_URL}/${CWS_EXTENSION_ID}" \
        -H "Authorization: Bearer ${access_token}" \
        -H "x-goog-api-version: 2" \
        -H "Content-Type: application/zip" \
        --data-binary "@${zip_path}")

    local state
    state=$(echo "$response" | jq -r '.uploadState // empty')

    if [[ "$state" == "FAILURE" ]]; then
        echo "Upload failed: $(echo "$response" | jq -r '.itemError // .')"
        exit 1
    fi

    echo "Uploaded:  $(basename "$zip_path")  (state: ${state})"
}

# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

publish() {
    local access_token="$1"

    local response
    response=$(curl -s -X POST \
        "${CWS_PUBLISH_URL}/${CWS_EXTENSION_ID}/publish?publishTarget=${TARGET}" \
        -H "Authorization: Bearer ${access_token}" \
        -H "x-goog-api-version: 2" \
        -H "Content-Length: 0")

    local status
    status=$(echo "$response" | jq -r '.status[]? // empty' | tr '\n' ' ')

    if echo "$status" | grep -q "OK"; then
        echo "Published: target=${TARGET}"
    else
        echo "Publish response: $response"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ "$GET_TOKEN" == true ]]; then
    get_token
    exit 0
fi

if [[ -n "$PUBLISH_ONLY" ]]; then
    ZIP_PATH="$PUBLISH_ONLY"
    if [[ ! -f "$ZIP_PATH" ]]; then
        echo "File not found: $ZIP_PATH"
        exit 1
    fi
else
    ZIP_PATH=$(pack | tail -1)
fi

if [[ "$PACK_ONLY" == true ]]; then
    exit 0
fi

load_credentials

echo "Authenticating..."
ACCESS_TOKEN=$(get_access_token)

echo "Uploading..."
upload "$ZIP_PATH" "$ACCESS_TOKEN"

echo "Publishing..."
publish "$ACCESS_TOKEN"
