#!/usr/bin/env python3
"""Pack and publish the Popmundo Utils extension to the Chrome Web Store and
to addons.mozilla.org (AMO, Firefox).

Use --target chrome|firefox|all (default: all) to choose the store. With
`all`, Firefox is skipped with a warning when no AMO credentials are
configured, and a failure on one store does not prevent the other from being
attempted.

Chrome Web Store
    Uses the Chrome Web Store API v2 (the v1.1 API is retired 2026-10-15).
    Publish visibility (public vs. trusted testers) is no longer settable via
    the API - it must be configured once in the Developer Dashboard under
    Publisher > Distribution settings; `publish` always uses whatever is set
    there.

    Pass --skip-review to send skipReview=true with the publish request.
    Without it the request has no body (default behaviour).

AMO (Firefox)
    Uses the AMO v5 API. Only NEW VERSIONS of an existing listing can be
    published: the very first listing must be created by hand in the AMO
    developer hub. The version is submitted to the listed channel and enters
    review, like on the Chrome Web Store. --skip-review has no AMO equivalent
    and is ignored for Firefox.

Dependencies:
    pip install google-auth google-auth-oauthlib requests
    (the google packages are only needed for the Chrome Web Store)

Credentials setup (one-time, Chrome Web Store):
    python publish.py --get-token
    This opens a browser OAuth flow and prints the refresh token to store in
    your config file or environment variables.

AMO credentials (env vars or .amo_credentials.json):
    AMO_JWT_ISSUER     — API key ("JWT issuer"), from
                         https://addons.mozilla.org/developers/addon/api/key/
    AMO_JWT_SECRET     — API secret ("JWT secret"), from the same page
    AMO_ADDON_ID       — optional; add-on id or slug. Defaults to the gecko id
                         in manifest.json.

.amo_credentials.json format:
    {
        "jwt_issuer": "user:...",
        "jwt_secret": "...",
        "addon_id": "@popmundo-utils"
    }
    Add this file to .gitignore — it contains secrets.

Chrome Web Store credentials (env vars or .cws_credentials.json):
    CWS_EXTENSION_ID   — the extension's Chrome Web Store ID
    CWS_PUBLISHER_ID   — publisher ID, from Developer Dashboard > Publisher > Settings
    CWS_CLIENT_ID      — OAuth 2.0 client ID (from Google Cloud Console)
    CWS_CLIENT_SECRET  — OAuth 2.0 client secret
    CWS_REFRESH_TOKEN  — long-lived refresh token obtained via --get-token

.cws_credentials.json format:
    {
        "extension_id": "...",
        "publisher_id": "...",
        "client_id": "...",
        "client_secret": "...",
        "refresh_token": "..."
    }
    Add this file to .gitignore — it contains secrets.
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
import zipfile
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Pack configuration (mirrors pack.py)
# ---------------------------------------------------------------------------

INCLUDE_DIRS = [
    "_locales",
    "common",
    "features",
    "icons",
    "libs",
    "options",
]

INCLUDE_FILES = [
    "background.js",
    "manifest.json",
]

EXCLUDE_NAMES = {
    ".DS_Store",
    "Thumbs.db",
    ".cws_credentials.json",
    ".amo_credentials.json",
}

EXCLUDE_EXTENSIONS = {
    ".md",
    ".ps1",
    ".py",
    ".sh",
    ".zip",
}

# ---------------------------------------------------------------------------
# Chrome Web Store API
# ---------------------------------------------------------------------------

CWS_SCOPE = "https://www.googleapis.com/auth/chromewebstore"
CWS_API_BASE = "https://chromewebstore.googleapis.com/v2"
CWS_UPLOAD_BASE = "https://chromewebstore.googleapis.com/upload/v2"
CREDENTIALS_FILE = ".cws_credentials.json"

# ---------------------------------------------------------------------------
# AMO API
# ---------------------------------------------------------------------------

AMO_API_BASE = "https://addons.mozilla.org/api/v5"
AMO_CREDENTIALS_FILE = ".amo_credentials.json"
AMO_POLL_INTERVAL_SECONDS = 3
AMO_POLL_TIMEOUT_SECONDS = 300
AMO_REQUEST_TIMEOUT_SECONDS = 120


def item_resource(config: dict) -> str:
    return f"publishers/{config['publisher_id']}/items/{config['extension_id']}"

# ---------------------------------------------------------------------------
# Packing
# ---------------------------------------------------------------------------

def _should_exclude(path: Path) -> bool:
    return path.name in EXCLUDE_NAMES or path.suffix in EXCLUDE_EXTENSIONS


def _add_to_zip(zf: zipfile.ZipFile, root: Path, entry: Path) -> None:
    if entry.is_file():
        if not _should_exclude(entry):
            zf.write(entry, entry.relative_to(root))
    elif entry.is_dir():
        for child in sorted(entry.rglob("*")):
            if child.is_file() and not _should_exclude(child):
                zf.write(child, child.relative_to(root))


def pack(root: Path) -> Path:
    manifest_path = root / "manifest.json"
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    version = manifest.get("version", "unknown")

    output_name = f"popmundo-utils-v{version}.zip"
    output_path = root / output_name

    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in INCLUDE_FILES:
            _add_to_zip(zf, root, root / filename)
        for dirname in INCLUDE_DIRS:
            _add_to_zip(zf, root, root / dirname)

    file_count = len(zipfile.ZipFile(output_path).namelist())
    size_kb = output_path.stat().st_size / 1024
    print(f"Packed:    {output_name}  ({file_count} files, {size_kb:.1f} KB)")
    return output_path

# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

def load_credentials(root: Path) -> dict:
    """Load CWS credentials from environment variables or .cws_credentials.json."""
    keys = ("extension_id", "publisher_id", "client_id", "client_secret", "refresh_token")
    env_prefix = "CWS_"

    config = {k: os.environ.get(f"{env_prefix}{k.upper()}") for k in keys}

    if not all(config.values()):
        cred_path = root / CREDENTIALS_FILE
        if cred_path.exists():
            with open(cred_path, encoding="utf-8") as f:
                file_config = json.load(f)
            for k in keys:
                if not config[k]:
                    config[k] = file_config.get(k)

    missing = [k for k in keys if not config.get(k)]
    if missing:
        print(f"Missing credentials: {', '.join(missing)}")
        print(f"Set CWS_EXTENSION_ID / CWS_PUBLISHER_ID / CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN")
        print(f"or create {CREDENTIALS_FILE}.  Run --get-token to obtain a refresh token.")
        sys.exit(1)

    return config


def get_access_token(config: dict) -> str:
    # Imported here so that Firefox-only runs do not need the google packages
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    creds = Credentials(
        token=None,
        refresh_token=config["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=config["client_id"],
        client_secret=config["client_secret"],
        scopes=[CWS_SCOPE],
    )
    creds.refresh(Request())
    return creds.token

# ---------------------------------------------------------------------------
# Chrome Web Store operations
# ---------------------------------------------------------------------------

def upload(zip_path: Path, config: dict, access_token: str) -> None:
    url = f"{CWS_UPLOAD_BASE}/{item_resource(config)}:upload"
    headers = {"Authorization": f"Bearer {access_token}"}
    with open(zip_path, "rb") as f:
        resp = requests.post(url, headers=headers, data=f)

    data = resp.json()
    state = data.get("uploadState", "")

    if resp.status_code != 200 or state == "FAILED":
        print(f"Upload failed (HTTP {resp.status_code}): {data}")
        sys.exit(1)

    print(f"Uploaded:  {zip_path.name}  (state: {state})")


def _report_publish_error(resp: requests.Response, skip_review: bool) -> None:
    """Print a readable publish error (Google error envelope or raw body)."""
    try:
        error = resp.json().get("error")
    except ValueError:
        error = None

    if not isinstance(error, dict):
        print(f"Publish failed (HTTP {resp.status_code}): {resp.text}")
        return

    status = error.get("status", "")
    tag = f" [{status}]" if status else ""
    print(f"Publish failed (HTTP {resp.status_code}){tag}: {error.get('message', resp.text)}")

    for detail in error.get("details", []):
        if not isinstance(detail, dict):
            continue
        for violation in detail.get("fieldViolations", []):
            print(f"  - {violation.get('field', '')}: {violation.get('description', '')}")
        if detail.get("reason"):
            print(f"  - reason: {detail['reason']}")

    if skip_review and (
        status in ("INVALID_ARGUMENT", "FAILED_PRECONDITION")
        or resp.status_code in (400, 412)
    ):
        print("skipReview was requested but could not be honored; "
              "re-run without --skip-review to submit for normal review.")


def publish(config: dict, access_token: str, skip_review: bool = False) -> None:
    url = f"{CWS_API_BASE}/{item_resource(config)}:publish"
    headers = {"Authorization": f"Bearer {access_token}"}
    if skip_review:
        resp = requests.post(url, headers=headers, json={"skipReview": True})
    else:
        resp = requests.post(url, headers=headers)

    if resp.status_code not in (200, 201):
        _report_publish_error(resp, skip_review)
        sys.exit(1)

    data = resp.json()

    state = data.get("state", "unknown")
    warnings = data.get("warningInfo", {}).get("warnings")
    extra = f" warnings={warnings}" if warnings else ""
    print(f"Published: state={state}{extra}")


def get_status(config: dict, access_token: str) -> None:
    url = f"{CWS_API_BASE}/{item_resource(config)}:fetchStatus"
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(url, headers=headers)
    data = resp.json()

    if resp.status_code != 200:
        print(f"Status: request failed (HTTP {resp.status_code}): {data}")
        return

    print(
        f"Status: lastAsyncUploadState={data.get('lastAsyncUploadState', 'unknown')} "
        f"takenDown={data.get('takenDown', False)} warned={data.get('warned', False)}"
    )

    for label, key in (("published", "publishedItemRevisionStatus"), ("submitted", "submittedItemRevisionStatus")):
        revision = data.get(key)
        if not revision:
            print(f"Status ({label}): none")
            continue

        state = revision.get("state", "unknown")
        channels = revision.get("distributionChannels", [])
        if channels:
            channel_info = ", ".join(
                f"crxVersion={c.get('crxVersion', '')} deployPercentage={c.get('deployPercentage', '')}"
                for c in channels
            )
        else:
            channel_info = "no distribution channels"
        print(f"Status ({label}): state={state} {channel_info}")

# ---------------------------------------------------------------------------
# AMO (addons.mozilla.org) operations
# ---------------------------------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def amo_jwt(config: dict, now: int = None, jti: str = None) -> str:
    """Build the short-lived HS256 JWT the AMO API expects (hand-rolled to avoid a PyJWT dependency)."""
    now = int(time.time()) if now is None else now
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": config["jwt_issuer"],
        "jti": jti or str(uuid.uuid4()),
        "iat": now,
        "exp": now + 240,  # AMO accepts at most 5 minutes
    }
    signing_input = ".".join(
        _b64url(json.dumps(part, separators=(",", ":")).encode("utf-8")) for part in (header, payload)
    )
    signature = hmac.new(config["jwt_secret"].encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}"


def amo_headers(config: dict) -> dict:
    # A new token for every call: they are cheap, and a slow review poll must not outlive the expiry
    return {"Authorization": f"JWT {amo_jwt(config)}"}


def default_addon_id(root: Path) -> str:
    with open(root / "manifest.json", encoding="utf-8") as f:
        manifest = json.load(f)
    return manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id", "")


def load_amo_credentials(root: Path, required: bool) -> dict | None:
    """Load AMO credentials from environment variables or .amo_credentials.json.

    When they are incomplete, exits if `required`, otherwise returns None so the caller can skip Firefox.
    """
    keys = ("jwt_issuer", "jwt_secret", "addon_id")
    config = {k: os.environ.get(f"AMO_{k.upper()}") for k in keys}

    cred_path = root / AMO_CREDENTIALS_FILE
    if not all(config.values()) and cred_path.exists():
        with open(cred_path, encoding="utf-8") as f:
            file_config = json.load(f)
        for k in keys:
            if not config[k]:
                config[k] = file_config.get(k)

    if not config["addon_id"]:
        config["addon_id"] = default_addon_id(root)

    missing = [f"AMO_{k.upper()}" for k in keys if not config.get(k)]
    if missing:
        message = (f"Missing AMO credentials: {', '.join(missing)}. "
                   f"Set the environment variables or create {AMO_CREDENTIALS_FILE} "
                   f"(keys from https://addons.mozilla.org/developers/addon/api/key/).")
        if required:
            print(message)
            sys.exit(1)
        print(f"Skipping Firefox: {message}")
        return None

    return config


def _amo_error_text(resp: requests.Response) -> str:
    try:
        return json.dumps(resp.json())
    except ValueError:
        return resp.text[:500]


def amo_upload(zip_path: Path, config: dict) -> str:
    """Upload the zip to AMO, wait for the validation and return the upload uuid."""
    with open(zip_path, "rb") as f:
        resp = requests.post(
            f"{AMO_API_BASE}/addons/upload/",
            headers=amo_headers(config),
            data={"channel": "listed"},
            files={"upload": (zip_path.name, f, "application/zip")},
            timeout=AMO_REQUEST_TIMEOUT_SECONDS,
        )
    if resp.status_code not in (200, 201, 202):
        print(f"AMO upload failed (HTTP {resp.status_code}): {_amo_error_text(resp)}")
        sys.exit(1)

    upload_uuid = resp.json()["uuid"]
    print(f"Uploaded:  {zip_path.name}  (upload {upload_uuid}), waiting for AMO validation...")

    deadline = time.time() + AMO_POLL_TIMEOUT_SECONDS
    while True:
        resp = requests.get(
            f"{AMO_API_BASE}/addons/upload/{upload_uuid}/",
            headers=amo_headers(config),
            timeout=AMO_REQUEST_TIMEOUT_SECONDS,
        )
        if resp.status_code != 200:
            print(f"AMO validation check failed (HTTP {resp.status_code}): {_amo_error_text(resp)}")
            sys.exit(1)

        data = resp.json()
        if data.get("processed"):
            break
        if time.time() > deadline:
            print("AMO validation did not finish in time; check the developer hub and retry.")
            sys.exit(1)
        time.sleep(AMO_POLL_INTERVAL_SECONDS)

    if not data.get("valid"):
        print("AMO validation failed:")
        validation = data.get("validation") or {}
        for message in validation.get("messages", []):
            print(f"  - [{message.get('type', '')}] {message.get('message', '')}")
        if not validation.get("messages"):
            print(f"  {json.dumps(data)}")
        sys.exit(1)

    print("Validated: AMO accepted the package")
    return upload_uuid


def amo_publish(upload_uuid: str, config: dict, release_notes: str = None) -> None:
    """Create a new listed version of the add-on from a validated upload."""
    body = {"upload": upload_uuid}
    if release_notes:
        body["release_notes"] = {"en-US": release_notes}

    resp = requests.post(
        f"{AMO_API_BASE}/addons/addon/{requests.utils.quote(config['addon_id'], safe='')}/versions/",
        headers=amo_headers(config),
        json=body,
        timeout=AMO_REQUEST_TIMEOUT_SECONDS,
    )
    if resp.status_code not in (200, 201):
        print(f"AMO publish failed (HTTP {resp.status_code}): {_amo_error_text(resp)}")
        if resp.status_code == 404:
            print("The add-on was not found: the first listing must be created by hand in the AMO developer hub.")
        sys.exit(1)

    data = resp.json()
    status = (data.get("file") or {}).get("status", "unknown")
    print(f"Published: AMO version={data.get('version', 'unknown')} file status={status} (submitted for review)")


def amo_get_status(config: dict) -> None:
    addon_id = requests.utils.quote(config["addon_id"], safe="")

    resp = requests.get(
        f"{AMO_API_BASE}/addons/addon/{addon_id}/",
        headers=amo_headers(config),
        timeout=AMO_REQUEST_TIMEOUT_SECONDS,
    )
    if resp.status_code != 200:
        print(f"AMO status: request failed (HTTP {resp.status_code}): {_amo_error_text(resp)}")
        return

    addon = resp.json()
    current = addon.get("current_version") or {}
    print(
        f"AMO status: addon status={addon.get('status', 'unknown')} "
        f"current version={current.get('version', 'none')} "
        f"file status={(current.get('file') or {}).get('status', 'unknown')}"
    )

    resp = requests.get(
        f"{AMO_API_BASE}/addons/addon/{addon_id}/versions/",
        headers=amo_headers(config),
        params={"filter": "all_with_unlisted", "page_size": 3},
        timeout=AMO_REQUEST_TIMEOUT_SECONDS,
    )
    if resp.status_code != 200:
        print(f"AMO versions: request failed (HTTP {resp.status_code}): {_amo_error_text(resp)}")
        return

    for version in resp.json().get("results", []):
        print(
            f"AMO version {version.get('version', '?')}: "
            f"channel={version.get('channel', '?')} file status={(version.get('file') or {}).get('status', 'unknown')}"
        )

# ---------------------------------------------------------------------------
# One-time token helper
# ---------------------------------------------------------------------------

def run_get_token(root: Path) -> None:
    """Interactive OAuth flow to obtain a refresh token (run once)."""
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Run: pip install google-auth-oauthlib")
        sys.exit(1)

    cred_path = root / CREDENTIALS_FILE
    if cred_path.exists():
        with open(cred_path, encoding="utf-8") as f:
            file_config = json.load(f)
        client_id = file_config.get("client_id") or os.environ.get("CWS_CLIENT_ID")
        client_secret = file_config.get("client_secret") or os.environ.get("CWS_CLIENT_SECRET")
    else:
        client_id = os.environ.get("CWS_CLIENT_ID")
        client_secret = os.environ.get("CWS_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("CWS_CLIENT_ID and CWS_CLIENT_SECRET must be set before running --get-token.")
        sys.exit(1)

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes=[CWS_SCOPE])
    creds = flow.run_local_server(port=0)

    print(f"\nRefresh token:\n  {creds.refresh_token}\n")

    if cred_path.exists():
        try:
            with open(cred_path, encoding="utf-8") as f:
                file_config = json.load(f)
            file_config["refresh_token"] = creds.refresh_token
            with open(cred_path, "w", encoding="utf-8") as f:
                json.dump(file_config, f, indent=4)
                f.write("\n")
            print(f"Updated {CREDENTIALS_FILE} with the new refresh_token.")
        except (OSError, json.JSONDecodeError) as e:
            print(f"Failed to update {CREDENTIALS_FILE}: {e}")
            print(f"Copy the token above into {CREDENTIALS_FILE} manually.")
    else:
        print(f"Add it to {CREDENTIALS_FILE} as \"refresh_token\" or set CWS_REFRESH_TOKEN.")

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_store(name: str, action, results: dict) -> None:
    """Run one store's steps. The helpers exit on failure: that is recorded so the other store still gets attempted."""
    print(f"\n== {name} ==")
    try:
        action()
        results[name] = "ok"
    except SystemExit as e:
        results[name] = "failed" if e.code not in (0, None) else "ok"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pack and publish Popmundo Utils to the Chrome Web Store and/or addons.mozilla.org."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--pack-only", action="store_true",
        help="Pack the extension without publishing.",
    )
    mode.add_argument(
        "--publish-only", metavar="ZIP",
        help="Publish an already-packed zip file, skip packing.",
    )
    mode.add_argument(
        "--get-token", action="store_true",
        help="Run the OAuth flow to obtain a Chrome Web Store refresh token (one-time setup).",
    )
    mode.add_argument(
        "--get-status", action="store_true",
        help="Check the Chrome Web Store and/or AMO status and exit.",
    )
    parser.add_argument(
        "--target", choices=("chrome", "firefox", "all"), default="all",
        help="Store to publish to (default: all). With 'all', Firefox is skipped when AMO credentials are missing.",
    )
    parser.add_argument(
        "--skip-review", action="store_true",
        help="Ask the Chrome Web Store to skip review when publishing (skipReview=true). "
             "The store may still reject the request. Ignored for Firefox.",
    )
    parser.add_argument(
        "--release-notes", metavar="TEXT",
        help="Release notes (en-US) shown on the AMO version page. Ignored for Chrome.",
    )
    args = parser.parse_args()

    root = Path(__file__).parent.resolve()
    want_chrome = args.target in ("chrome", "all")
    want_firefox = args.target in ("firefox", "all")

    if args.get_token:
        run_get_token(root)
        return

    # Credentials are checked before packing/uploading anything. A store that is explicitly requested must have them,
    # with 'all' Firefox is optional so that Chrome-only setups keep working.
    amo_config = None
    if want_firefox and not args.pack_only:
        amo_config = load_amo_credentials(root, required=args.target == "firefox")

    results = {}

    if args.get_status:
        def chrome_status():
            config = load_credentials(root)
            print("Authenticating...")
            get_status(config, get_access_token(config))

        if want_chrome:
            run_store("Chrome Web Store", chrome_status, results)
        if amo_config:
            run_store("AMO", lambda: amo_get_status(amo_config), results)
        if "failed" in results.values():
            sys.exit(1)
        return

    if args.publish_only:
        zip_path = Path(args.publish_only).resolve()
        if not zip_path.exists():
            print(f"File not found: {zip_path}")
            sys.exit(1)
    else:
        zip_path = pack(root)

    if args.pack_only:
        return

    if args.skip_review and want_firefox and amo_config:
        print("Note: --skip-review only applies to the Chrome Web Store.")

    def chrome_publish():
        config = load_credentials(root)
        print("Authenticating...")
        access_token = get_access_token(config)

        print("Uploading...")
        upload(zip_path, config, access_token)

        print("Publishing (skipReview=true)..." if args.skip_review else "Publishing...")
        publish(config, access_token, skip_review=args.skip_review)

    def firefox_publish():
        print("Uploading...")
        upload_uuid = amo_upload(zip_path, amo_config)
        print("Publishing...")
        amo_publish(upload_uuid, amo_config, release_notes=args.release_notes)

    if want_chrome:
        run_store("Chrome Web Store", chrome_publish, results)
    if amo_config:
        run_store("AMO", firefox_publish, results)

    print("\nSummary: " +", ".join(f"{name}: {state}" for name, state in results.items()))
    if "failed" in results.values():
        sys.exit(1)


if __name__ == "__main__":
    main()
