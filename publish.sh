#!/usr/bin/env bash
# Pack and publish the Popmundo Utils Chrome extension to the Chrome Web Store.
#
# Dependencies: curl, zip, jq, python3 (for version parsing)
#   macOS:  brew install jq
#   Linux:  apt install jq / dnf install jq
#
# Uses the Chrome Web Store API v2 (the v1.1 API is retired 2026-10-15).
# Publish visibility (public vs. trusted testers) is no longer settable via
# the API - it must be configured once in the Developer Dashboard under
# Publisher > Distribution settings; publish always uses whatever is set
# there.
#
# Credentials (env vars or .cws_credentials.json):
#   CWS_EXTENSION_ID   — Chrome Web Store extension ID
#   CWS_PUBLISHER_ID   — publisher ID, from Developer Dashboard > Publisher > Settings
#   CWS_CLIENT_ID      — OAuth 2.0 client ID
#   CWS_CLIENT_SECRET  — OAuth 2.0 client secret
#   CWS_REFRESH_TOKEN  — long-lived refresh token
#
# Usage:
#   ./publish.sh                        pack + upload + publish
#   ./publish.sh --pack-only
#   ./publish.sh --publish-only file.zip
#   ./publish.sh --get-status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CREDENTIALS_FILE=".cws_credentials.json"
CWS_TOKEN_URL="https://oauth2.googleapis.com/token"
CWS_API_BASE="https://chromewebstore.googleapis.com/v2"
CWS_UPLOAD_BASE="https://chromewebstore.googleapis.com/upload/v2"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

PACK_ONLY=false
PUBLISH_ONLY=""
GET_TOKEN=false
GET_STATUS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pack-only)    PACK_ONLY=true; shift ;;
        --publish-only) PUBLISH_ONLY="$2"; shift 2 ;;
        --get-token)    GET_TOKEN=true; shift ;;
        --get-status)   GET_STATUS=true; shift ;;
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

    if [[ -f "$CREDENTIALS_FILE" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        if jq --arg t "$refresh_token" '.refresh_token = $t' "$CREDENTIALS_FILE" > "$tmp_file"; then
            mv "$tmp_file" "$CREDENTIALS_FILE"
            echo "Updated ${CREDENTIALS_FILE} with the new refresh_token."
        else
            rm -f "$tmp_file"
            echo "Failed to update ${CREDENTIALS_FILE}; copy the token above manually."
        fi
    else
        echo "Add it to ${CREDENTIALS_FILE} as \"refresh_token\" or set CWS_REFRESH_TOKEN."
    fi
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
        --exclude ".cws_credentials.json" \
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
    if [[ -z "${CWS_PUBLISHER_ID:-}" && -f "$CREDENTIALS_FILE" ]]; then
        CWS_PUBLISHER_ID=$(jq -r '.publisher_id // empty' "$CREDENTIALS_FILE")
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
    [[ -z "${CWS_PUBLISHER_ID:-}"  ]] && missing+=(CWS_PUBLISHER_ID)
    [[ -z "${CWS_CLIENT_ID:-}"     ]] && missing+=(CWS_CLIENT_ID)
    [[ -z "${CWS_CLIENT_SECRET:-}" ]] && missing+=(CWS_CLIENT_SECRET)
    [[ -z "${CWS_REFRESH_TOKEN:-}" ]] && missing+=(CWS_REFRESH_TOKEN)

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Missing credentials: ${missing[*]}"
        echo "Set env vars or create ${CREDENTIALS_FILE}."
        exit 1
    fi

    ITEM_RESOURCE="publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}"
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

    local response http_code body state
    response=$(curl -s -w '\n%{http_code}' -X POST \
        "${CWS_UPLOAD_BASE}/${ITEM_RESOURCE}:upload" \
        -H "Authorization: Bearer ${access_token}" \
        --data-binary "@${zip_path}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    state=$(echo "$body" | jq -r '.uploadState // empty')

    if [[ "$http_code" != "200" || "$state" == "FAILED" ]]; then
        echo "Upload failed (HTTP ${http_code}): ${body}"
        exit 1
    fi

    echo "Uploaded:  $(basename "$zip_path")  (state: ${state})"
}

# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

publish() {
    local access_token="$1"

    local response http_code body state warnings extra
    response=$(curl -s -w '\n%{http_code}' -X POST \
        "${CWS_API_BASE}/${ITEM_RESOURCE}:publish" \
        -H "Authorization: Bearer ${access_token}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
        echo "Publish failed (HTTP ${http_code}): ${body}"
        exit 1
    fi

    state=$(echo "$body" | jq -r '.state // "unknown"')
    warnings=$(echo "$body" | jq -c '.warningInfo.warnings // empty')

    extra=""
    [[ -n "$warnings" ]] && extra=" warnings=${warnings}"

    echo "Published: state=${state}${extra}"
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

get_status() {
    local access_token="$1"

    local response http_code body
    response=$(curl -s -w '\n%{http_code}' -X GET \
        "${CWS_API_BASE}/${ITEM_RESOURCE}:fetchStatus" \
        -H "Authorization: Bearer ${access_token}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" ]]; then
        echo "Status: request failed (HTTP ${http_code}): ${body}"
        return
    fi

    echo "Status: lastAsyncUploadState=$(echo "$body" | jq -r '.lastAsyncUploadState // "unknown"')" \
         "takenDown=$(echo "$body" | jq -r '.takenDown // false')" \
         "warned=$(echo "$body" | jq -r '.warned // false')"

    local entry label key revision state channel_info
    for entry in "published:publishedItemRevisionStatus" "submitted:submittedItemRevisionStatus"; do
        label="${entry%%:*}"
        key="${entry#*:}"

        revision=$(echo "$body" | jq -c --arg k "$key" '.[$k] // empty')
        if [[ -z "$revision" || "$revision" == "null" ]]; then
            echo "Status (${label}): none"
            continue
        fi

        state=$(echo "$revision" | jq -r '.state // "unknown"')
        channel_info=$(echo "$revision" | jq -r '
            (.distributionChannels // [])
            | if length == 0 then "no distribution channels"
              else map("crxVersion=" + (.crxVersion // "") + " deployPercentage=" + ((.deployPercentage // 0) | tostring)) | join(", ")
              end
        ')

        echo "Status (${label}): state=${state} ${channel_info}"
    done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ "$GET_TOKEN" == true ]]; then
    get_token
    exit 0
fi

if [[ "$GET_STATUS" == true ]]; then
    load_credentials
    echo "Authenticating..."
    ACCESS_TOKEN=$(get_access_token)
    get_status "$ACCESS_TOKEN"
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
