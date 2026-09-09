#!/usr/bin/env python3
"""Audit the immutable canonical Quantum Box runtime assets without rewriting them."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
PACKAGE = ROOT / "src/assets/canonical-runtime-assets-v2"
SOURCE_MANIFEST = PACKAGE / "manifests/source-manifest.json"
ARCHIVE_RUNTIME_MANIFEST = PACKAGE / "manifests/runtime-handoff.json"
SHIPPED_RUNTIME_MANIFEST = PACKAGE / "manifests/shipped-runtime-handoff.json"
EXPECTED_MANIFEST_HASHES = {
    SOURCE_MANIFEST: "aa12069a34edd3b60585b476bac6f73d01dfd503fbbbac6f9808b7e30ebdb842",
    ARCHIVE_RUNTIME_MANIFEST: "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae",
    SHIPPED_RUNTIME_MANIFEST: "51311236eaaec3cc6627ae987c94891a7d043043e630ffb8765a2bc64e3cd83e",
}
SHIPPED_PREFIXES = (
    "assets/fluxball/",
    "assets/qong/",
    "assets/quantman/",
    "assets/skipixl/",
)
ALLOWED_PIXELS = {
    (43, 28, 20, 255),
    (86, 67, 48, 255),
    (214, 189, 139, 255),
    (0, 0, 0, 0),
}
SHA256 = re.compile(r"[0-9a-f]{64}")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    for path, expected in EXPECTED_MANIFEST_HASHES.items():
        require(digest(path) == expected, f"canonical manifest hash drift: {path.name}")

    sources = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    archive_runtime = json.loads(ARCHIVE_RUNTIME_MANIFEST.read_text(encoding="utf-8"))
    runtime = json.loads(SHIPPED_RUNTIME_MANIFEST.read_text(encoding="utf-8"))
    source_entries = sources["sources"]
    runtime_entries = runtime["runtimeFiles"]

    require(sources["schemaVersion"] == "quantum-box-canonical-source-manifest-v2", "source schema drift")
    require(sources["sourceMutation"] == "prohibited", "source mutation contract drift")
    require(len(source_entries) == 26, "canonical source count drift")
    require(len({entry["sourceId"] for entry in source_entries}) == 26, "duplicate canonical source id")
    require(all(SHA256.fullmatch(entry["sha256"]) for entry in source_entries), "invalid canonical source hash")
    source_byte_count = 0
    verified_source_count = 0
    for entry in source_entries:
        source_locator = Path(entry["sourceLocator"])
        require(not source_locator.is_absolute(), f"canonical source locator is absolute: {entry['sourceId']}")
        require(".." not in source_locator.parts, f"canonical source locator escapes its root: {entry['sourceId']}")
        source_path = PROJECT_ROOT / source_locator
        require(
            source_path.resolve().is_relative_to(PROJECT_ROOT.resolve()),
            f"canonical source escapes Quantum Culture: {entry['sourceId']}",
        )
        # The private source archive is available in the development workspace,
        # but deliberately absent from the public source snapshot. Its immutable
        # hashes, dimensions, modes, and publication-safe locators remain pinned.
        if not source_path.is_file():
            continue
        require(digest(source_path) == entry["sha256"], f"canonical source hash drift: {entry['sourceId']}")
        with Image.open(source_path) as source_image:
            dimensions = entry["dimensions"]
            require(
                source_image.size == (dimensions["width"], dimensions["height"]),
                f"canonical source dimension drift: {entry['sourceId']}",
            )
            require(source_image.mode == entry["mode"], f"canonical source mode drift: {entry['sourceId']}")
        source_byte_count += source_path.stat().st_size
        verified_source_count += 1

    require(
        archive_runtime["schemaVersion"] == "quantum-box-canonical-runtime-handoff-v2",
        "archive runtime schema drift",
    )
    require(len(archive_runtime["runtimeFiles"]) == 45, "archive runtime count drift")
    require(
        runtime["schemaVersion"]
        == "quantum-box-canonical-shipped-runtime-handoff-v1",
        "shipped runtime schema drift",
    )
    require(
        runtime["status"] == "immutable-canonical-production-subset",
        "shipped runtime approval drift",
    )
    require(
        runtime["archiveHandoff"]["sha256"]
        == EXPECTED_MANIFEST_HASHES[ARCHIVE_RUNTIME_MANIFEST],
        "archive handoff lineage drift",
    )
    require(runtime["logicalResolution"] == {"width": 320, "height": 180}, "native resolution drift")
    require(
        runtime["palette"]
        == {"darkTobacco": "#2B1C14", "mutedTan": "#564330", "warmCream": "#D6BD8B"},
        "palette contract drift",
    )
    require(runtime["alphaContract"] == "binary-only-0-or-255", "alpha contract drift")
    require(runtime["scalingContract"] == "integer-nearest-neighbour-only", "scaling contract drift")
    require(len(runtime_entries) == 31, "shipped runtime file count drift")
    require(
        all(entry["relativePath"].startswith(SHIPPED_PREFIXES) for entry in runtime_entries),
        "retired asset entered the shipped handoff",
    )

    manifested_paths: set[str] = set()
    runtime_frame_count = 0
    files_by_id: dict[str, dict[str, object]] = {}
    for entry in runtime_entries:
        file_id = entry["fileId"]
        relative_path = entry["relativePath"]
        require(file_id not in files_by_id, f"duplicate runtime id: {file_id}")
        require(relative_path.startswith("assets/"), f"runtime path escapes asset root: {relative_path}")
        path = PACKAGE / relative_path
        require(path.is_file(), f"missing runtime asset: {relative_path}")
        require(path.resolve().is_relative_to(PACKAGE.resolve()), f"runtime path escapes package: {relative_path}")
        require(digest(path) == entry["sha256"], f"runtime hash drift: {file_id}")

        image = Image.open(path).convert("RGBA")
        dimensions = entry["dimensions"]
        require(image.size == (dimensions["width"], dimensions["height"]), f"dimension drift: {file_id}")
        pixels = set(image.getdata())
        require(pixels <= ALLOWED_PIXELS, f"off-palette pixel: {file_id}")
        require({pixel[3] for pixel in pixels} <= {0, 255}, f"non-binary alpha: {file_id}")
        require(all(pixel == (0, 0, 0, 0) for pixel in pixels if pixel[3] == 0), f"hidden RGB: {file_id}")

        frames = entry["frames"]
        require(frames, f"missing frame metadata: {file_id}")
        for order, frame in enumerate(frames):
            runtime_frame_count += 1
            rect = frame["rect"]
            anchor = frame["anchor"]
            require(frame["order"] == order, f"non-contiguous frame order: {file_id}")
            require(rect["x"] >= 0 and rect["y"] >= 0, f"negative frame rect: {file_id}")
            require(rect["x"] + rect["width"] <= image.width, f"frame exceeds width: {file_id}")
            require(rect["y"] + rect["height"] <= image.height, f"frame exceeds height: {file_id}")
            require(anchor["convention"] == "frame-local-integer", f"anchor convention drift: {file_id}")
            require(isinstance(anchor["x"], int) and isinstance(anchor["y"], int), f"fractional anchor: {file_id}")
            require(frame["parents"], f"missing source lineage: {file_id}/{frame['frameId']}")
        manifested_paths.add(relative_path)
        files_by_id[file_id] = entry

    actual_paths = {
        str(path.relative_to(PACKAGE))
        for prefix in SHIPPED_PREFIXES
        for path in (PACKAGE / prefix).glob("*.png")
    }
    require(actual_paths == manifested_paths, "shipped runtime manifest coverage drift")

    print(
        json.dumps(
            {
                "status": "pass",
                "sourceCount": len(source_entries),
                "verifiedSourceCount": verified_source_count,
                "unavailableSourceCount": len(source_entries) - verified_source_count,
                "verifiedSourceBytes": source_byte_count,
                "runtimeFileCount": len(runtime_entries),
                "runtimeFrameCount": runtime_frame_count,
                "sourceManifestSha256": digest(SOURCE_MANIFEST),
                "archiveRuntimeHandoffSha256": digest(ARCHIVE_RUNTIME_MANIFEST),
                "shippedRuntimeHandoffSha256": digest(SHIPPED_RUNTIME_MANIFEST),
                "palette": runtime["palette"],
                "alpha": runtime["alphaContract"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
