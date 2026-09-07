#!/usr/bin/env python3
"""Audit every native Brown Box background frame without emitting derivatives."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "src" / "assets" / "brown-box"
PROGRAMME_PATH = ASSET_ROOT / "qrt-four-state-programme-v1.json"

sys.path.insert(0, str(PROJECT_ROOT))

from compiler.quantum_box_moth.adapters import decode_png_rgb  # noqa: E402


EXPECTED_WIDTH = 320
EXPECTED_HEIGHT = 180
EXPECTED_PALETTE = ((43, 28, 20), (86, 67, 48))
EXPECTED_LOOP_DURATION_MS = 22_800
EXPECTED_FRAME_DURATION_MS = 100
EXPECTED_LOOP_FRAME_COUNT = 228
EXPECTED_STATE_COUNT = 4


def fail(message: str) -> None:
    raise ValueError(message)


def js_round(value: float) -> int:
    """Match Math.round for the non-negative transition positions used here."""

    return math.floor(value + 0.5)


def read_programme() -> dict[str, Any]:
    value = json.loads(PROGRAMME_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        fail("Brown Box programme must be a JSON object.")
    return value


def validate_programme(programme: dict[str, Any]) -> None:
    expected = {
        "width": EXPECTED_WIDTH,
        "height": EXPECTED_HEIGHT,
        "frameDurationMs": EXPECTED_FRAME_DURATION_MS,
        "loopFrameCount": EXPECTED_LOOP_FRAME_COUNT,
        "loopDurationMs": EXPECTED_LOOP_DURATION_MS,
    }
    for key, expected_value in expected.items():
        if programme.get(key) != expected_value:
            fail(f"Programme {key} must be {expected_value!r}.")
    states = programme.get("states")
    if not isinstance(states, list) or len(states) != EXPECTED_STATE_COUNT:
        fail("Programme must contain exactly four states.")
    if programme.get("palette") != ["#2B1C14", "#564330"]:
        fail("Programme palette is not the exact two-brown contract.")
    transition = programme.get("transition")
    if not isinstance(transition, dict) or {
        "direction": transition.get("direction"),
        "boundaryLine": transition.get("boundaryLine"),
        "interpolation": transition.get("interpolation"),
    } != {
        "direction": "left-to-right",
        "boundaryLine": "none",
        "interpolation": "none",
    }:
        fail("Programme transition is not the invisible hard replacement contract.")


def load_endpoints(
    programme: dict[str, Any],
) -> tuple[list[tuple[tuple[int, int, int], ...]], list[dict[str, Any]]]:
    images: list[tuple[tuple[int, int, int], ...]] = []
    reports: list[dict[str, Any]] = []
    for state in programme["states"]:
        if not isinstance(state, dict):
            fail("Each programme state must be an object.")
        file_name = state.get("fileName")
        expected_sha256 = state.get("sha256")
        if not isinstance(file_name, str) or not isinstance(expected_sha256, str):
            fail("Each programme state requires a fileName and sha256.")
        path = ASSET_ROOT / file_name
        data = path.read_bytes()
        actual_sha256 = hashlib.sha256(data).hexdigest()
        if actual_sha256 != expected_sha256:
            fail(f"{file_name} does not match its declared SHA-256.")
        width, height, pixels = decode_png_rgb(data)
        if (width, height) != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
            fail(f"{file_name} is not a native 320x180 endpoint.")
        palette = tuple(sorted(set(pixels)))
        if palette != EXPECTED_PALETTE:
            fail(f"{file_name} contains colours outside the exact two-brown palette.")
        images.append(pixels)
        reports.append(
            {
                "stateId": state.get("stateId"),
                "fileName": file_name,
                "sha256": actual_sha256,
                "width": width,
                "height": height,
                "paletteRgb": [list(colour) for colour in palette],
            }
        )
    if len(set(report["sha256"] for report in reports)) != EXPECTED_STATE_COUNT:
        fail("The four endpoint files are not independently identifiable.")
    return images, reports


def audit_frames(
    programme: dict[str, Any],
    images: list[tuple[tuple[int, int, int], ...]],
) -> dict[str, Any]:
    hold = programme.get("holdFrameCount")
    sweep_steps = programme.get("sweepStepCount")
    phase_frames = programme.get("phaseFrameCount")
    if (hold, sweep_steps, phase_frames) != (8, 48, 57):
        fail("Programme phase timing must remain 8 hold plus 49 sweep frames.")

    frame_hashes: list[str] = []
    phase_boundaries: list[list[int]] = [[] for _ in images]
    palette = set(EXPECTED_PALETTE)
    for loop_tick in range(EXPECTED_LOOP_FRAME_COUNT):
        state_index = loop_tick // phase_frames
        phase_tick = loop_tick % phase_frames
        following_index = (state_index + 1) % len(images)
        sweep_step = max(0, phase_tick - hold)
        boundary = (
            0
            if phase_tick < hold
            else js_round(sweep_step * EXPECTED_WIDTH / sweep_steps)
        )
        if not 0 <= boundary <= EXPECTED_WIDTH:
            fail(f"Frame {loop_tick} has an invalid replacement boundary.")
        phase_boundaries[state_index].append(boundary)

        current = images[state_index]
        following = images[following_index]
        encoded = bytearray()
        seen: set[tuple[int, int, int]] = set()
        for row in range(EXPECTED_HEIGHT):
            row_start = row * EXPECTED_WIDTH
            for column in range(EXPECTED_WIDTH):
                source = following if column < boundary else current
                pixel = source[row_start + column]
                seen.add(pixel)
                encoded.extend(pixel)
        if seen != palette:
            fail(f"Frame {loop_tick} is not exactly two-colour.")
        frame_hashes.append(hashlib.sha256(encoded).hexdigest())

    if any(boundaries[:8] != [0] * 8 for boundaries in phase_boundaries):
        fail("A phase does not hold its endpoint for the first eight frames.")
    expected_sweep = [js_round(step * EXPECTED_WIDTH / 48) for step in range(49)]
    if any(boundaries[8:] != expected_sweep for boundaries in phase_boundaries):
        fail("A phase does not perform the declared discrete left-to-right sweep.")

    boundary_schedule_sha256 = hashlib.sha256(
        json.dumps(phase_boundaries[0], separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    return {
        "auditedFrameCount": len(frame_hashes),
        "uniqueFrameCount": len(set(frame_hashes)),
        "firstFrameRgbSha256": frame_hashes[0],
        "lastFrameRgbSha256": frame_hashes[-1],
        "phaseCount": len(phase_boundaries),
        "phasesWithExactBoundarySchedule": sum(
            boundaries == phase_boundaries[0] for boundaries in phase_boundaries
        ),
        "boundaryScheduleSha256": boundary_schedule_sha256,
        "holdFrameCount": hold,
        "sweepFrameCount": len(expected_sweep),
        "firstSweepBoundaryX": expected_sweep[0],
        "lastSweepBoundaryX": expected_sweep[-1],
        "paletteRgb": [list(colour) for colour in EXPECTED_PALETTE],
        "intermediateColourCount": 0,
        "authoredBoundaryPixelCount": 0,
    }


def main() -> int:
    programme = read_programme()
    validate_programme(programme)
    images, endpoint_reports = load_endpoints(programme)
    frame_report = audit_frames(programme, images)
    report = {
        "schemaVersion": "quantum-box-brown-box-native-frame-audit-v1",
        "passed": True,
        "scope": (
            "Native 320x180 background endpoints and all 228 discrete hard-crop "
            "compositions; this is not a browser framebuffer or gameplay screenshot."
        ),
        "programmeId": programme.get("programmeId"),
        "logicalResolution": [EXPECTED_WIDTH, EXPECTED_HEIGHT],
        "frameDurationMs": EXPECTED_FRAME_DURATION_MS,
        "loopDurationMs": EXPECTED_LOOP_DURATION_MS,
        "endpoints": endpoint_reports,
        "frames": frame_report,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Brown Box native-frame audit failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
