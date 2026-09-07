#!/usr/bin/env python3
"""Build or verify browser-independent pixel rows for shipped sprite frames."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/assets/runtime-pixel-frames-v1.json"
PALETTE = {
    (0, 0, 0, 0): ".",
    (43, 28, 20, 255): "D",
    (86, 67, 48, 255): "T",
    (214, 189, 139, 255): "C",
}
FAMILIES = (
    (
        "canonical-runtime-v2",
        ROOT / "src/assets/canonical-runtime-assets-v2/manifests/runtime-handoff.json",
    ),
    (
        "qgraph-cabinet-v1",
        ROOT
        / "src/assets/qgraph-cabinet-assets-v1/manifests/shipped-runtime-handoff.json",
    ),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def frame_rows(
    image: Image.Image, rect: dict[str, int], frame_key: str
) -> list[str]:
    rows: list[str] = []
    for y in range(rect["y"], rect["y"] + rect["height"]):
        row: list[str] = []
        for x in range(rect["x"], rect["x"] + rect["width"]):
            pixel = image.getpixel((x, y))
            code = PALETTE.get(pixel)
            require(code is not None, f"off-palette pixel in {frame_key} at {x},{y}: {pixel}")
            row.append(code)
        rows.append("".join(row))
    return rows


def build_family(family_id: str, manifest_path: Path) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    package_root = manifest_path.parents[1]
    frames: dict[str, dict[str, Any]] = {}
    for asset in manifest["runtimeFiles"]:
        image_path = package_root / asset["relativePath"]
        require(image_path.is_file(), f"missing sprite source: {image_path}")
        require(sha256(image_path) == asset["sha256"], f"sprite hash drift: {asset['fileId']}")
        with Image.open(image_path) as source:
            image = source.convert("RGBA")
            for frame in asset["frames"]:
                frame_key = f"{asset['fileId']}/{frame['frameId']}"
                require(frame_key not in frames, f"duplicate frame key: {family_id}/{frame_key}")
                rect = frame["rect"]
                rows = frame_rows(image, rect, f"{family_id}/{frame_key}")
                frames[frame_key] = {
                    "width": rect["width"],
                    "height": rect["height"],
                    "rows": rows,
                }
    return {
        "familyId": family_id,
        "manifestPath": str(manifest_path.relative_to(ROOT)),
        "manifestSha256": sha256(manifest_path),
        "frameCount": len(frames),
        "frames": frames,
    }


def build_payload() -> dict[str, Any]:
    return {
        "schemaVersion": "quantum-box-runtime-pixel-frames-v1",
        "status": "deterministic-build-time-browser-independent-raster",
        "encoding": {
            ".": "transparent",
            "D": "#2B1C14",
            "T": "#564330",
            "C": "#D6BD8B",
        },
        "families": [build_family(family_id, path) for family_id, path in FAMILIES],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the tracked frame index instead of rewriting it",
    )
    args = parser.parse_args()
    expected = build_payload()
    if args.check:
        require(OUTPUT.is_file(), f"missing runtime pixel frame index: {OUTPUT}")
        actual = json.loads(OUTPUT.read_text(encoding="utf-8"))
        require(actual == expected, "runtime pixel frame index is stale; regenerate it")
        print(
            "Runtime pixel frame audit passed: "
            + ", ".join(
                f"{family['familyId']}={family['frameCount']}"
                for family in expected["families"]
            )
        )
        return
    OUTPUT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
