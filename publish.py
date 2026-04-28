#!/usr/bin/env python3
"""Pack and publish the Popmundo Utils Chrome extension to the Chrome Web Store.

Dependencies:
    pip install google-auth google-auth-oauthlib requests

Credentials setup (one-time):
    python publish.py --get-token
    This opens a browser OAuth flow and prints the refresh token to store in
    your config file or environment variables.

Credentials (env vars or .cws_credentials.json):
    CWS_EXTENSION_ID   — the extension's Chrome Web Store ID
    CWS_CLIENT_ID      — OAuth 2.0 client ID (from Google Cloud Console)
    CWS_CLIENT_SECRET  — OAuth 2.0 client secret
    CWS_REFRESH_TOKEN  — long-lived refresh token obtained via --get-token

.cws_credentials.json format:
    {
        "extension_id": "...",
        "client_id": "...",
        "client_secret": "...",
        "refresh_token": "..."
    }
    Add this file to .gitignore — it contains secrets.
"""

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

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
CWS_UPLOAD_URL = "https://www.googleapis.com/upload/chromewebstore/v1.1/items/{item_id}"
CWS_PUBLISH_URL = "https://www.googleapis.com/chromewebstore/v1.1/items/{item_id}/publish"
CREDENTIALS_FILE = ".cws_credentials.json"

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
    keys = ("extension_id", "client_id", "client_secret", "refresh_token")
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
        print(f"Set CWS_EXTENSION_ID / CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN")
        print(f"or create {CREDENTIALS_FILE}.  Run --get-token to obtain a refresh token.")
        sys.exit(1)

    return config


def get_access_token(config: dict) -> str:
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
    url = CWS_UPLOAD_URL.format(item_id=config["extension_id"])
    headers = {
        "Authorization": f"Bearer {access_token}",
        "x-goog-api-version": "2",
    }
    with open(zip_path, "rb") as f:
        resp = requests.put(url, headers=headers, data=f)

    data = resp.json()
    state = data.get("uploadState", "")

    if resp.status_code != 200 or state == "FAILURE":
        errors = data.get("itemError", data)
        print(f"Upload failed (HTTP {resp.status_code}): {errors}")
        sys.exit(1)

    print(f"Uploaded:  {zip_path.name}  (state: {state})")


def publish(config: dict, access_token: str, target: str) -> None:
    url = CWS_PUBLISH_URL.format(item_id=config["extension_id"])
    headers = {
        "Authorization": f"Bearer {access_token}",
        "x-goog-api-version": "2",
        "Content-Length": "0",
    }
    resp = requests.post(url, headers=headers, params={"publishTarget": target})
    data = resp.json()
    status = data.get("status", [])

    if "OK" in status:
        print(f"Published: target={target}")
    else:
        print(f"Publish response: {data}")
        if resp.status_code not in (200, 201):
            sys.exit(1)

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
    print(f"Add it to {CREDENTIALS_FILE} as \"refresh_token\" or set CWS_REFRESH_TOKEN.")

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pack and publish Popmundo Utils to the Chrome Web Store."
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
        help="Run the OAuth flow to obtain a refresh token (one-time setup).",
    )
    parser.add_argument(
        "--target", choices=["default", "trustedTesters"], default="default",
        help="Publish target: 'default' (public) or 'trustedTesters'. Default: default.",
    )
    args = parser.parse_args()

    root = Path(__file__).parent.resolve()

    if args.get_token:
        run_get_token(root)
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

    config = load_credentials(root)
    print("Authenticating...")
    access_token = get_access_token(config)

    print(f"Uploading...")
    upload(zip_path, config, access_token)

    print(f"Publishing...")
    publish(config, access_token, args.target)


if __name__ == "__main__":
    main()
