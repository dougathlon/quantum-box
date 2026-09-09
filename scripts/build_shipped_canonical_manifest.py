#!/usr/bin/env python3
"""Derive the production-only canonical sprite handoff from the immutable archive."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ROOT / "src/assets/canonical-runtime-assets-v2/manifests"
ARCHIVE_HANDOFF = MANIFESTS / "runtime-handoff.json"
SHIPPED_HANDOFF = MANIFESTS / "shipped-runtime-handoff.json"
ARCHIVE_HANDOFF_SHA256 = (
    "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae"
)
SHIPPED_PREFIXES = (
    "assets/fluxball/",
    "assets/qong/",
    "assets/quantman/",
    "assets/skipixl/",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if sha256(ARCHIVE_HANDOFF) != ARCHIVE_HANDOFF_SHA256:
        raise AssertionError("immutable canonical archive handoff hash drifted")

    archive = json.loads(ARCHIVE_HANDOFF.read_text(encoding="utf-8"))
    runtime_files = [
        entry
        for entry in archive["runtimeFiles"]
        if entry["relativePath"].startswith(SHIPPED_PREFIXES)
    ]
    if len(runtime_files) != 31:
        raise AssertionError("canonical production sprite count drifted")

    shipped = {
        "schemaVersion": "quantum-box-canonical-shipped-runtime-handoff-v1",
        "date": "2026-09-09",
        "status": "immutable-canonical-production-subset",
        "logicalResolution": archive["logicalResolution"],
        "palette": archive["palette"],
        "alphaContract": archive["alphaContract"],
        "scalingContract": archive["scalingContract"],
        "lineage": (
            "Production-only subset copied byte-for-byte from the immutable v2 "
            "runtime handoff. Retired physical Designer, player-walk, and morph "
            "families remain only in local source history."
        ),
        "archiveHandoff": {
            "relativePath": (
                "src/assets/canonical-runtime-assets-v2/manifests/"
                "runtime-handoff.json"
            ),
            "sha256": ARCHIVE_HANDOFF_SHA256,
        },
        "runtimeFiles": runtime_files,
    }
    SHIPPED_HANDOFF.write_text(
        json.dumps(shipped, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {SHIPPED_HANDOFF} with {len(runtime_files)} files; "
        f"sha256={sha256(SHIPPED_HANDOFF)}"
    )


if __name__ == "__main__":
    main()
