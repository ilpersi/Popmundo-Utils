#!/usr/bin/env bash
# Pack and publish the Popmundo Utils extension to the Chrome Web Store and to
# addons.mozilla.org (AMO, Firefox).
#
# Dependencies: curl, zip, jq, openssl, python3 (for version parsing)
#   macOS:  brew install jq
#   Linux:  apt install jq / dnf install jq
#
# Use --target chrome|firefox|all (default: all) to choose the store. With
# "all", Firefox is skipped with a warning when no AMO credentials are
# configured, and a failure on one store does not prevent the other from being
# attempted.
#
# Chrome Web Store: uses the Chrome Web Store API v2 (the v1.1 API is retired
# 2026-10-15). Publish visibility (public vs. trusted testers) is no longer
# settable via the API - it must be configured once in the Developer Dashboard
# under Publisher > Distribution settings; publish always uses whatever is set
# there.
#
# AMO (Firefox): uses the AMO v5 API. Only NEW VERSIONS of an existing listing
# can be published: the very first listing must be created by hand in the AMO
# developer hub. The version is submitted to the listed channel and enters
# review, like on the Chrome Web Store. --skip-review has no AMO equivalent and
# is ignored for Firefox.
#
# Chrome Web Store credentials (env vars or .cws_credentials.json):
#   CWS_EXTENSION_ID   — Chrome Web Store extension ID
#   CWS_PUBLISHER_ID   — publisher ID, from Developer Dashboard > Publisher > Settings
#   CWS_CLIENT_ID      — OAuth 2.0 client ID
#   CWS_CLIENT_SECRET  — OAuth 2.0 client secret
#   CWS_REFRESH_TOKEN  — long-lived refresh token
#
# AMO credentials (env vars or .amo_credentials.json, keys: jwt_issuer, jwt_secret, addon_id):
#   AMO_JWT_ISSUER     — API key ("JWT issuer"), from
#                        https://addons.mozilla.org/developers/addon/api/key/
#   AMO_JWT_SECRET     — API secret ("JWT secret"), from the same page
#   AMO_ADDON_ID       — optional; add-on id or slug. Defaults to the gecko id in manifest.json
#
# Usage:
#   ./publish.sh                        pack + upload + publish to both stores
#   ./publish.sh --target firefox       only AMO (--target chrome: only the Chrome Web Store)
#   ./publish.sh --pack-only
#   ./publish.sh --publish-only file.zip
#   ./publish.sh --get-status
#   ./publish.sh --skip-review          publish with skipReview=true (Chrome only)
#   ./publish.sh --release-notes "text" release notes for the AMO version (Firefox only)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CREDENTIALS_FILE=".cws_credentials.json"
CWS_TOKEN_URL="https://oauth2.googleapis.com/token"
CWS_API_BASE="https://chromewebstore.googleapis.com/v2"
CWS_UPLOAD_BASE="https://chromewebstore.googleapis.com/upload/v2"

AMO_CREDENTIALS_FILE=".amo_credentials.json"
AMO_API_BASE="https://addons.mozilla.org/api/v5"
AMO_POLL_INTERVAL_SECONDS=3
AMO_POLL_TIMEOUT_SECONDS=300

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

PACK_ONLY=false
PUBLISH_ONLY=""
GET_TOKEN=false
GET_STATUS=false
SKIP_REVIEW=false
TARGET="all"
RELEASE_NOTES=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pack-only)     PACK_ONLY=true; shift ;;
        --publish-only)  PUBLISH_ONLY="$2"; shift 2 ;;
        --get-token)     GET_TOKEN=true; shift ;;
        --get-status)    GET_STATUS=true; shift ;;
        --skip-review)   SKIP_REVIEW=true; shift ;;
        --target)        TARGET="$2"; shift 2 ;;
        --release-notes) RELEASE_NOTES="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

case "$TARGET" in
    chrome|firefox|all) ;;
    *) echo "Invalid --target '$TARGET' (use chrome, firefox or all)"; exit 1 ;;
esac

WANT_CHROME=false
WANT_FIREFOX=false
[[ "$TARGET" == "chrome"  || "$TARGET" == "all" ]] && WANT_CHROME=true
[[ "$TARGET" == "firefox" || "$TARGET" == "all" ]] && WANT_FIREFOX=true

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
        --exclude ".amo_credentials.json" \
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

report_publish_error() {
    local http_code="$1"
    local body="$2"

    local err_status
    if ! echo "$body" | jq -e '.error | type == "object"' >/dev/null 2>&1; then
        echo "Publish failed (HTTP ${http_code}): ${body}"
        return
    fi

    err_status=$(echo "$body" | jq -r '.error.status // empty')
    echo "Publish failed (HTTP ${http_code})${err_status:+ [${err_status}]}: $(echo "$body" | jq -r '.error.message // empty')"
    echo "$body" | jq -r '
        (.error.details // [])[]
        | ((.fieldViolations // [])[] | "  - " + (.field // "") + ": " + (.description // "")),
          (if .reason then "  - reason: " + .reason else empty end)
    ' 2>/dev/null || true

    if [[ "$SKIP_REVIEW" == true ]] && \
       [[ "$err_status" == "INVALID_ARGUMENT" || "$err_status" == "FAILED_PRECONDITION" \
          || "$http_code" == "400" || "$http_code" == "412" ]]; then
        echo "skipReview was requested but could not be honored; re-run without --skip-review to submit for normal review."
    fi
}

publish() {
    local access_token="$1"

    local response http_code body state warnings extra
    local extra_args=()
    if [[ "$SKIP_REVIEW" == true ]]; then
        extra_args=(-H "Content-Type: application/json" -d '{"skipReview":true}')
    fi

    response=$(curl -s -w '\n%{http_code}' -X POST \
        "${CWS_API_BASE}/${ITEM_RESOURCE}:publish" \
        -H "Authorization: Bearer ${access_token}" \
        ${extra_args[@]+"${extra_args[@]}"})
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
        report_publish_error "$http_code" "$body"
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
# AMO (addons.mozilla.org) operations
# ---------------------------------------------------------------------------

b64url() {
    openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# Short-lived HS256 JWT, as the AMO API expects. A new one is built for every call.
amo_jwt() {
    local now header payload signing_input signature
    now=$(date +%s)
    header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
    payload=$(jq -cn --arg iss "$AMO_JWT_ISSUER" --arg jti "$(openssl rand -hex 16)" --argjson iat "$now" \
        '{iss: $iss, jti: $jti, iat: $iat, exp: ($iat + 240)}' | tr -d '\n' | b64url)
    signing_input="${header}.${payload}"
    signature=$(printf '%s' "$signing_input" | openssl dgst -sha256 -hmac "$AMO_JWT_SECRET" -binary | b64url)
    echo "${signing_input}.${signature}"
}

# Returns 0 when the AMO credentials are complete, 1 (with a message in AMO_CREDENTIALS_ERROR) when they are not.
load_amo_credentials() {
    if [[ -z "${AMO_JWT_ISSUER:-}" && -f "$AMO_CREDENTIALS_FILE" ]]; then
        AMO_JWT_ISSUER=$(jq -r '.jwt_issuer // empty' "$AMO_CREDENTIALS_FILE")
    fi
    if [[ -z "${AMO_JWT_SECRET:-}" && -f "$AMO_CREDENTIALS_FILE" ]]; then
        AMO_JWT_SECRET=$(jq -r '.jwt_secret // empty' "$AMO_CREDENTIALS_FILE")
    fi
    if [[ -z "${AMO_ADDON_ID:-}" && -f "$AMO_CREDENTIALS_FILE" ]]; then
        AMO_ADDON_ID=$(jq -r '.addon_id // empty' "$AMO_CREDENTIALS_FILE")
    fi
    if [[ -z "${AMO_ADDON_ID:-}" ]]; then
        AMO_ADDON_ID=$(jq -r '.browser_specific_settings.gecko.id // empty' manifest.json)
    fi

    local missing=()
    [[ -z "${AMO_JWT_ISSUER:-}" ]] && missing+=(AMO_JWT_ISSUER)
    [[ -z "${AMO_JWT_SECRET:-}" ]] && missing+=(AMO_JWT_SECRET)
    [[ -z "${AMO_ADDON_ID:-}"   ]] && missing+=(AMO_ADDON_ID)

    if [[ ${#missing[@]} -gt 0 ]]; then
        AMO_CREDENTIALS_ERROR="Missing AMO credentials: ${missing[*]}. Set env vars or create ${AMO_CREDENTIALS_FILE} (keys from https://addons.mozilla.org/developers/addon/api/key/)."
        return 1
    fi

    AMO_ADDON_PATH=$(jq -rn --arg v "$AMO_ADDON_ID" '$v | @uri')
}

amo_upload() {
    local zip_path="$1"

    local response http_code body upload_uuid
    response=$(curl -s -w '\n%{http_code}' -X POST "${AMO_API_BASE}/addons/upload/" \
        -H "Authorization: JWT $(amo_jwt)" \
        -F "channel=listed" \
        -F "upload=@${zip_path};type=application/zip")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" && "$http_code" != "201" && "$http_code" != "202" ]]; then
        echo "AMO upload failed (HTTP ${http_code}): ${body}"
        exit 1
    fi

    upload_uuid=$(echo "$body" | jq -r '.uuid // empty')
    if [[ -z "$upload_uuid" ]]; then
        echo "AMO upload failed: no upload uuid in the answer: ${body}"
        exit 1
    fi
    echo "Uploaded:  $(basename "$zip_path")  (upload ${upload_uuid}), waiting for AMO validation..."

    local deadline=$(( $(date +%s) + AMO_POLL_TIMEOUT_SECONDS ))
    while true; do
        response=$(curl -s -w '\n%{http_code}' -X GET "${AMO_API_BASE}/addons/upload/${upload_uuid}/" \
            -H "Authorization: JWT $(amo_jwt)")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')

        if [[ "$http_code" != "200" ]]; then
            echo "AMO validation check failed (HTTP ${http_code}): ${body}"
            exit 1
        fi

        [[ "$(echo "$body" | jq -r '.processed // false')" == "true" ]] && break

        if (( $(date +%s) > deadline )); then
            echo "AMO validation did not finish in time; check the developer hub and retry."
            exit 1
        fi
        sleep "$AMO_POLL_INTERVAL_SECONDS"
    done

    if [[ "$(echo "$body" | jq -r '.valid // false')" != "true" ]]; then
        echo "AMO validation failed:"
        if [[ "$(echo "$body" | jq -r '(.validation.messages // []) | length')" == "0" ]]; then
            echo "  ${body}"
        else
            echo "$body" | jq -r '.validation.messages[] | "  - [" + (.type // "") + "] " + (.message // "")'
        fi
        exit 1
    fi

    echo "Validated: AMO accepted the package"
    AMO_UPLOAD_UUID="$upload_uuid"
}

amo_publish() {
    local upload_uuid="$1"

    local request_body
    request_body=$(jq -cn --arg upload "$upload_uuid" --arg notes "$RELEASE_NOTES" \
        '{upload: $upload} + (if $notes != "" then {release_notes: {"en-US": $notes}} else {} end)')

    local response http_code body
    response=$(curl -s -w '\n%{http_code}' -X POST "${AMO_API_BASE}/addons/addon/${AMO_ADDON_PATH}/versions/" \
        -H "Authorization: JWT $(amo_jwt)" \
        -H "Content-Type: application/json" \
        -d "$request_body")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
        echo "AMO publish failed (HTTP ${http_code}): ${body}"
        if [[ "$http_code" == "404" ]]; then
            echo "The add-on was not found: the first listing must be created by hand in the AMO developer hub."
        fi
        exit 1
    fi

    echo "Published: AMO version=$(echo "$body" | jq -r '.version // "unknown"')" \
         "file status=$(echo "$body" | jq -r '.file.status // "unknown"') (submitted for review)"
}

amo_get_status() {
    local response http_code body
    response=$(curl -s -w '\n%{http_code}' -X GET "${AMO_API_BASE}/addons/addon/${AMO_ADDON_PATH}/" \
        -H "Authorization: JWT $(amo_jwt)")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" ]]; then
        echo "AMO status: request failed (HTTP ${http_code}): ${body}"
        return
    fi

    echo "AMO status: addon status=$(echo "$body" | jq -r '.status // "unknown"')" \
         "current version=$(echo "$body" | jq -r '.current_version.version // "none"')" \
         "file status=$(echo "$body" | jq -r '.current_version.file.status // "unknown"')"

    response=$(curl -s -w '\n%{http_code}' -G "${AMO_API_BASE}/addons/addon/${AMO_ADDON_PATH}/versions/" \
        -H "Authorization: JWT $(amo_jwt)" \
        --data-urlencode "filter=all_with_unlisted" --data-urlencode "page_size=3")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" ]]; then
        echo "AMO versions: request failed (HTTP ${http_code}): ${body}"
        return
    fi

    echo "$body" | jq -r '(.results // [])[] | "AMO version " + (.version // "?") + ": channel=" + (.channel // "?") + " file status=" + (.file.status // "unknown")'
}

# ---------------------------------------------------------------------------
# Per-store steps
# ---------------------------------------------------------------------------

chrome_status() {
    load_credentials
    echo "Authenticating..."
    local access_token
    access_token=$(get_access_token)
    get_status "$access_token"
}

chrome_publish() {
    load_credentials

    echo "Authenticating..."
    local access_token
    access_token=$(get_access_token)

    echo "Uploading..."
    upload "$ZIP_PATH" "$access_token"

    if [[ "$SKIP_REVIEW" == true ]]; then
        echo "Publishing (skipReview=true)..."
    else
        echo "Publishing..."
    fi
    publish "$access_token"
}

firefox_publish() {
    echo "Uploading..."
    amo_upload "$ZIP_PATH"

    echo "Publishing..."
    amo_publish "$AMO_UPLOAD_UUID"
}

# Runs one store's steps in a subshell: the helpers call "exit 1" on failure, which must not stop the other store.
RESULTS=()
run_store() {
    local name="$1" step="$2" rc
    echo
    echo "== ${name} =="
    set +e
    ( set -e; "$step" )
    rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
        RESULTS+=("${name}: ok")
    else
        RESULTS+=("${name}: failed")
    fi
}

any_failed() {
    local result
    for result in ${RESULTS[@]+"${RESULTS[@]}"}; do
        [[ "$result" == *": failed" ]] && return 0
    done
    return 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ "$GET_TOKEN" == true ]]; then
    get_token
    exit 0
fi

# Credentials are checked before packing/uploading anything. A store that is explicitly requested must have them,
# with "all" Firefox is optional so that Chrome-only setups keep working.
AMO_READY=false
if [[ "$WANT_FIREFOX" == true && "$PACK_ONLY" != true ]]; then
    if load_amo_credentials; then
        AMO_READY=true
    elif [[ "$TARGET" == "firefox" ]]; then
        echo "$AMO_CREDENTIALS_ERROR"
        exit 1
    else
        echo "Skipping Firefox: $AMO_CREDENTIALS_ERROR"
    fi
fi

if [[ "$GET_STATUS" == true ]]; then
    [[ "$WANT_CHROME" == true ]] && run_store "Chrome Web Store" chrome_status
    [[ "$AMO_READY" == true ]] && run_store "AMO" amo_get_status
    any_failed && exit 1
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

if [[ "$SKIP_REVIEW" == true && "$AMO_READY" == true ]]; then
    echo "Note: --skip-review only applies to the Chrome Web Store."
fi

[[ "$WANT_CHROME" == true ]] && run_store "Chrome Web Store" chrome_publish
[[ "$AMO_READY" == true ]] && run_store "AMO" firefox_publish

echo
echo "Summary: $(IFS=,; echo "${RESULTS[*]}" | sed 's/,/, /g')"
any_failed && exit 1
exit 0
