#!/usr/bin/env python3
"""Pack the Popmundo Utils Chrome extension into a zip archive for store publishing."""

import json
import os
import zipfile
from pathlib import Path

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


def should_exclude(path: Path) -> bool:
    return path.name in EXCLUDE_NAMES or path.suffix in EXCLUDE_EXTENSIONS


def add_to_zip(zf: zipfile.ZipFile, root: Path, entry: Path) -> None:
    if entry.is_file():
        if not should_exclude(entry):
            zf.write(entry, entry.relative_to(root))
    elif entry.is_dir():
        for child in sorted(entry.rglob("*")):
            if child.is_file() and not should_exclude(child):
                zf.write(child, child.relative_to(root))


def main():
    root = Path(__file__).parent.resolve()

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
            add_to_zip(zf, root, root / filename)
        for dirname in INCLUDE_DIRS:
            add_to_zip(zf, root, root / dirname)

    file_count = len(zipfile.ZipFile(output_path).namelist())
    size_kb = output_path.stat().st_size / 1024
    print(f"Created {output_name}  ({file_count} files, {size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
