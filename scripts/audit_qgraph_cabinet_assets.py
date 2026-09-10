#!/usr/bin/env python3
"""Verify the shipped Quarry/Fluxball QGraph asset handoff."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "src/assets/qgraph-cabinet-assets-v1"
SHIPPED_HANDOFF = PACKAGE / "manifests/shipped-runtime-handoff.json"
TYPESCRIPT_INTEGRATION = ROOT / "src/assets/QGraphCabinetAssets.ts"
EXPECTED_HANDOFF_SHA256 = "d8f9e8a66298477c303476c2b096551cf731b8b316a013c8b50a6cfb20d420ca"
PALETTE = {
    (43, 28, 20, 255),
    (86, 67, 48, 255),
    (214, 189, 139, 255),
    (0, 0, 0, 0),
}
EXPECTED_FILE_IDS = {
    "quag-player-directional-strip",
    "quag-cabinet-thumbnail",
    "fluxball-player-motion-strip",
    "qgraph-relationship-indicators",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixel_rows(image: Image.Image) -> tuple[tuple[tuple[int, ...], ...], ...]:
    pixels = image.load()
    return tuple(
        tuple(pixels[x, y] for x in range(image.width))
        for y in range(image.height)
    )


def rotate_rows_clockwise(
    rows: tuple[tuple[tuple[int, ...], ...], ...],
) -> tuple[tuple[tuple[int, ...], ...], ...]:
    size = len(rows)
    return tuple(
        tuple(rows[size - 1 - x][y] for x in range(size))
        for y in range(size)
    )


def main() -> None:
    assert digest(SHIPPED_HANDOFF) == EXPECTED_HANDOFF_SHA256
    raw_handoff = SHIPPED_HANDOFF.read_text(encoding="utf-8")
    payload = json.loads(raw_handoff)
    assert payload["schemaVersion"] == "quantum-box-qgraph-cabinet-shipped-runtime-handoff-v1"
    assert payload["status"] == "deterministic-local-shipped-runtime-handoff"
    assert payload["logicalResolution"] == {"width": 320, "height": 180}
    assert payload["palette"] == {
        "darkTobacco": "#2B1C14",
        "mutedTan": "#564330",
        "warmCream": "#D6BD8B",
    }
    assert payload["alphaContract"] == "binary-only-0-or-255"
    assert payload["scalingContract"] == "integer-nearest-neighbour-only"
    assert "enclose" not in raw_handoff.lower()

    files_by_id = {entry["fileId"]: entry for entry in payload["runtimeFiles"]}
    assert set(files_by_id) == EXPECTED_FILE_IDS

    thumbnail = files_by_id["quag-cabinet-thumbnail"]
    assert thumbnail["relativePath"] == "assets/quag/quag-cabinet-thumbnail-40x24.png"
    assert thumbnail["dimensions"] == {"width": 40, "height": 24}
    assert thumbnail["kind"] == "single-frame-runtime-sprite"
    assert len(thumbnail["frames"]) == 1
    assert thumbnail["frames"][0]["derivationMethod"] == "four-bird-miniature-from-player-masks-v6"
    assert len(thumbnail["frames"][0]["parents"]) == 4
    with Image.open(PACKAGE / thumbnail["relativePath"]) as icon:
        assert all(icon.getpixel((x, 11))[3] == 0 for x in range(40)), "bird rows must have no platform divider"

    quag = files_by_id["quag-player-directional-strip"]
    assert quag["relativePath"] == "assets/quag/quag-players-directional-strip-10x10.png"
    assert quag["dimensions"] == {"width": 1406, "height": 20}
    assert len(quag["frames"]) == 64
    assert [frame["frameId"] for frame in quag["frames"]] == [
        f"{player}-{facing}-{motion_name}"
        for player in "abcd"
        for facing in ("right", "left")
        for motion_name in (
            "idle",
            "waddle-a",
            "waddle-b",
            "flap-up",
            "flap-down",
            "fall",
            "catch",
            "impact",
        )
    ]
    assert all(
        frame["rect"]["width"] == 20
        and frame["rect"]["height"] == 20
        and frame["anchor"]
        == {"x": 10, "y": 19, "convention": "frame-local-integer"}
        and frame["derivationMethod"] == "original-comic-duck-two-facing-eight-motion-v5"
        for frame in quag["frames"]
    )

    quag_frames = {frame["frameId"]: frame for frame in quag["frames"]}
    with Image.open(PACKAGE / quag["relativePath"]).convert("RGBA") as strip:
        frame_pixels: dict[str, tuple[tuple[tuple[int, ...], ...], ...]] = {}
        for frame_id, frame in quag_frames.items():
            rect = frame["rect"]
            crop = strip.crop(
                (
                    rect["x"],
                    rect["y"],
                    rect["x"] + rect["width"],
                    rect["y"] + rect["height"],
                )
            )
            rows = pixel_rows(crop)
            frame_pixels[frame_id] = rows
            assert all(pixel[3] == 0 for pixel in rows[0]), frame_id
            assert all(pixel[3] == 0 for pixel in rows[-1]), frame_id
            assert all(row[0][3] == 0 and row[-1][3] == 0 for row in rows), frame_id
        for player in "abcd":
            motion_names = (
                "idle",
                "waddle-a",
                "waddle-b",
                "flap-up",
                "flap-down",
                "fall",
                "catch",
                "impact",
            )
            for motion_name in motion_names:
                right = frame_pixels[f"{player}-right-{motion_name}"]
                left = frame_pixels[f"{player}-left-{motion_name}"]
                assert left == tuple(tuple(reversed(row)) for row in right)
            assert len({frame_pixels[f"{player}-right-{name}"] for name in motion_names}) == 8
            assert frame_pixels[f"{player}-right-fall"] == rotate_rows_clockwise(
                frame_pixels[f"{player}-right-idle"]
            )
        silhouettes = {
            tuple(
                tuple(pixel[3] for pixel in row)
                for row in frame_pixels[f"{player}-right-idle"]
            )
            for player in "abcd"
        }
        assert len(silhouettes) == 4

    motion = files_by_id["fluxball-player-motion-strip"]
    assert motion["dimensions"] == {"width": 262, "height": 20}
    assert len(motion["frames"]) == 12
    assert [frame["frameId"] for frame in motion["frames"]] == [
        f"fluxball-player-{player}-{motion_name}"
        for player in "abcd"
        for motion_name in ("idle", "stride-a", "stride-b")
    ]

    frame_count = 0
    manifested_paths: set[str] = set()
    for entry in payload["runtimeFiles"]:
        path = PACKAGE / entry["relativePath"]
        assert path.is_file(), entry["fileId"]
        assert path.resolve().is_relative_to(PACKAGE.resolve()), entry["fileId"]
        assert digest(path) == entry["sha256"], entry["fileId"]
        with Image.open(path).convert("RGBA") as image:
            assert image.size == (
                entry["dimensions"]["width"],
                entry["dimensions"]["height"],
            )
            pixels = set(image.getdata())
            assert pixels.issubset(PALETTE), entry["fileId"]
            assert {pixel[3] for pixel in pixels}.issubset({0, 255}), entry["fileId"]
            assert all(pixel == (0, 0, 0, 0) for pixel in pixels if pixel[3] == 0)
        for order, frame in enumerate(entry["frames"]):
            assert frame["order"] == order
            rect = frame["rect"]
            assert rect["x"] + rect["width"] <= entry["dimensions"]["width"]
            assert rect["y"] + rect["height"] <= entry["dimensions"]["height"]
            frame_count += 1
        manifested_paths.add(entry["relativePath"])

    shipped_asset_paths = {
        str(path.relative_to(PACKAGE))
        for group in ("quag", "fluxball", "shared")
        for path in (PACKAGE / "assets" / group).glob("*.png")
    }
    assert manifested_paths == shipped_asset_paths
    integration_source = TYPESCRIPT_INTEGRATION.read_text(encoding="utf-8")
    assert EXPECTED_HANDOFF_SHA256 in integration_source
    print(
        "QGraph cabinet asset audit passed: "
        f"4 shipped files / {frame_count} shipped frames"
    )


if __name__ == "__main__":
    main()
