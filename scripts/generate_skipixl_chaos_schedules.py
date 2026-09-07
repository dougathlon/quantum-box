"""Compile SkiPixl v7 residual-slalom course identities.

The QPixl segment bank is immutable provider evidence. This local compiler
derives three nested cuts, full-row spatial phases, and slalom gates from each
installed triplet. It
never contacts Moth or IBM and never rewrites the provider bank.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "src/games/skipixl/data/qpixl-b3-segments-v1.json"
OUTPUT_PATH = ROOT / "src/games/skipixl/data/skipixl-residual-cuts-v7.json"
EXPECTED_BANK_SHA256 = (
    "f09d509dd4f6980c0ac5146466e32c736f0688d13156334216720fa52dc8bffb"
)
DECODER_VERSION = "skipixl-triplet-residual-slalom-v7"
CUTS = (("P90", 0.90), ("P84", 0.84), ("P78", 0.78))
CORRIDOR_MIN_X = 96
CORRIDOR_MAX_X = 544
ROW_SPACING = 70
EASY_ROW_SPACING = 47
EASY_TARGET_SECONDS = 60
TARGET_SECONDS = 75
DENSE_ROW_HAZARD_COUNT = 8
SKIER_RADIUS = 9
OBSTACLE_RADII = {"tree": 17, "rock": 14}
GATE_COUNTS = {"P90": 0, "P84": 8, "P78": 12}
GATE_HALF_WIDTHS = {"P90": 0, "P84": 72, "P78": 54}


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_canonical(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def residuals(segment: dict[str, Any]) -> list[float]:
    return [
        returned - source / 255
        for source, returned in zip(
            segment["sourcePixels"], segment["returnedValues"]
        )
    ]


def percentile_threshold(values: list[float], percentile: float) -> float:
    magnitudes = sorted(abs(value) for value in values)
    return magnitudes[math.floor(len(magnitudes) * percentile)]


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def js_round(value: float) -> int:
    return math.floor(value + 0.5)


def js_imul(left: int, right: int) -> int:
    value = ((left & 0xFFFFFFFF) * (right & 0xFFFFFFFF)) & 0xFFFFFFFF
    return value if value < 0x80000000 else value - 0x100000000


def offset_sources(cell_index: int) -> tuple[int, int, int, int]:
    row, column = divmod(cell_index, 20)
    return (
        row * 20 + (column - 1) % 20,
        row * 20 + (column + 1) % 20,
        ((row - 1) % 20) * 20 + column,
        ((row + 1) % 20) * 20 + column,
    )


def qpixl_downhill_offset(
    cell_index: int,
    residual: float,
    left: float,
    right: float,
    above: float,
    below: float,
    row_spacing: int,
) -> int:
    values = (residual, left, right, above, below)
    coefficients = (2654435761, 2246822519, 3266489917, 668265263, 374761393)
    phase = js_imul(cell_index + 1, 1597334677) & 0xFFFFFFFF
    for value, coefficient in zip(values, coefficients):
        quantized = js_round((value + 1) * 1_000_000)
        phase = (phase + js_imul(quantized, coefficient)) & 0xFFFFFFFF
        phase = js_imul(phase ^ (phase >> 16), 2246822519) & 0xFFFFFFFF
    return phase % row_spacing - row_spacing // 2


def difficulty_for_cut(cut_id: str) -> str:
    return {"P90": "easy", "P84": "medium", "P78": "hard"}[cut_id]


def target_seconds_for_cut(cut_id: str) -> int:
    return EASY_TARGET_SECONDS if cut_id == "P90" else TARGET_SECONDS


def decode_gates(
    obstacles: list[dict[str, Any]], cut_id: str, course_length: int
) -> list[dict[str, Any]]:
    gate_count = GATE_COUNTS[cut_id]
    half_width = GATE_HALF_WIDTHS[cut_id]
    gates = []
    for index in range(gate_count):
        target_distance = course_length * (index + 1) / (gate_count + 1)
        anchor = sorted(
            obstacles,
            key=lambda item: (
                abs(item["distance"] - target_distance),
                -item["absoluteResidual"],
                item["obstacleId"],
            ),
        )[0]
        minimum_center = CORRIDOR_MIN_X + half_width + 8
        maximum_center = CORRIDOR_MAX_X - half_width - 8
        center_x = js_round(clamp(anchor["x"], minimum_center, maximum_center))
        gates.append(
            {
                "gateId": f"gate-{index + 1:02d}",
                "distance": js_round(target_distance),
                "centerX": center_x,
                "leftX": center_x - half_width,
                "rightX": center_x + half_width,
                "sourceObstacleId": anchor["obstacleId"],
                "segmentId": anchor["segmentId"],
                "cellIndex": anchor["cellIndex"],
                "residual": anchor["residual"],
            }
        )
    return sorted(gates, key=lambda gate: gate["distance"])


def row_is_saturated(row: list[dict[str, Any]]) -> bool:
    usable_minimum = CORRIDOR_MIN_X + SKIER_RADIUS
    usable_maximum = CORRIDOR_MAX_X - SKIER_RADIUS
    intervals = []
    for obstacle in row:
        radius = SKIER_RADIUS + OBSTACLE_RADII[obstacle["kind"]]
        start = max(usable_minimum, obstacle["x"] - radius)
        end = min(usable_maximum, obstacle["x"] + radius)
        if start <= end:
            intervals.append((start, end))
    intervals.sort()
    if not intervals or intervals[0][0] > usable_minimum:
        return False
    covered_until = intervals[0][1]
    for start, end in intervals[1:]:
        if start > covered_until:
            return False
        covered_until = max(covered_until, end)
        if covered_until >= usable_maximum:
            return True
    return covered_until >= usable_maximum


def receipt_segment(segment: dict[str, Any], order: int) -> dict[str, Any]:
    return {
        "order": order,
        "segmentId": segment["segmentId"],
        "sourceIdentity": segment["sourceIdentity"],
        "sourceSha256": segment["sourceSha256"],
        "sourcePixelSha256": segment["sourcePixelSha256"],
        "mothJobId": segment["mothJobId"],
        "ibmJobId": segment["ibmJobId"],
        "resultArtifactSha256": segment["resultArtifactSha256"],
        "returnedValuesSha256": segment["returnedValuesSha256"],
    }


def decode_course(
    bank: dict[str, Any], schedule: dict[str, Any], cut_id: str, percentile: float
) -> dict[str, Any]:
    row_spacing = EASY_ROW_SPACING if cut_id == "P90" else ROW_SPACING
    course_length = row_spacing * 61
    segments = [bank["segments"][index] for index in schedule["segmentIndexes"]]
    segment_residuals = [residuals(segment) for segment in segments]
    triplet_residuals = [value for values in segment_residuals for value in values]
    threshold = percentile_threshold(triplet_residuals, percentile)
    obstacles = []
    rows: list[list[dict[str, Any]]] = [[] for _ in range(60)]
    for segment_order, (segment, values) in enumerate(
        zip(segments, segment_residuals)
    ):
        for local_row in range(20):
            row_start = local_row * 20
            selected = []
            for column in range(20):
                cell_index = row_start + column
                residual = values[cell_index]
                magnitude = abs(residual)
                if magnitude < threshold:
                    continue
                neighbours = offset_sources(cell_index)
                left, right, above, below = (values[index] for index in neighbours)
                horizontal_offset = js_round(clamp((left - right) * 64, -9, 9))
                downhill_offset = qpixl_downhill_offset(
                    cell_index,
                    residual,
                    left,
                    right,
                    above,
                    below,
                    row_spacing,
                )
                row = segment_order * 20 + local_row
                base_x = 120 + column * 21
                base_distance = row_spacing + row * row_spacing
                selected.append(
                    {
                        "obstacleId": f"cell-row-{row + 1:02d}-col-{column + 1:02d}",
                        "row": row,
                        "distance": base_distance + downhill_offset,
                        "baseDistance": base_distance,
                        "downhillOffset": downhill_offset,
                        "column": column,
                        "x": js_round(clamp(base_x + horizontal_offset, CORRIDOR_MIN_X, CORRIDOR_MAX_X)),
                        "baseX": base_x,
                        "horizontalOffset": horizontal_offset,
                        "kind": "tree" if residual >= 0 else "rock",
                        "segmentId": segment["segmentId"],
                        "cellIndex": cell_index,
                        "residual": residual,
                        "absoluteResidual": magnitude,
                        "offsetSourceCellIndexes": list(neighbours),
                    }
                )
            selected.sort(key=lambda item: (item["distance"], item["column"]))
            for row_hazard_index, obstacle in enumerate(selected):
                obstacle["rowHazardIndex"] = row_hazard_index
                obstacle["rowHazardCount"] = len(selected)
                obstacles.append(obstacle)
                rows[segment_order * 20 + local_row].append(obstacle)
    obstacles.sort(key=lambda item: (item["distance"], item["x"], item["obstacleId"]))
    tree_count = sum(obstacle["kind"] == "tree" for obstacle in obstacles)
    dense_rows = sum(len(row) >= DENSE_ROW_HAZARD_COUNT for row in rows)
    saturated_rows = sum(row_is_saturated(row) for row in rows)
    difficulty_score = len(obstacles) + dense_rows * 4 + saturated_rows * 12
    triplet_id = schedule["scheduleId"]
    difficulty = difficulty_for_cut(cut_id)
    gates = decode_gates(obstacles, cut_id, course_length)
    receipt = {
        "schemaVersion": "skipixl-course-receipt-v7",
        "bankId": bank["bankId"],
        "bankContentSha256": bank["bankContentSha256"],
        "decoderVersion": DECODER_VERSION,
        "tripletId": triplet_id,
        "cutId": cut_id,
        "difficulty": difficulty,
        "residualDefinition": "returnedValue - submittedGrayscaleByte / 255",
        "rowSelection": f"select cells at or above this triplet's {cut_id} absolute-residual threshold; exact ties remain selected",
        "kindMapping": "positive or zero residual -> tree; negative residual -> mogul",
        "spatialOffsetRule": f"left/right neighbouring residual difference offsets x by at most 9 pixels; quantized cell and neighbouring residuals place each selected hazard across its complete {row_spacing}-unit source-row interval",
        "courseLengthRule": (
            "Easy compresses all sixty QPixl-derived rows to 47 distance units per row for a shorter hill"
            if cut_id == "P90"
            else "Medium and Hard retain all sixty QPixl-derived rows at 70 distance units per row"
        ),
        "gateRule": (
            "Easy is a gate-free downhill descent"
            if cut_id == "P90"
            else f"{GATE_COUNTS[cut_id]} slalom gates select QPixl obstacle anchors across the course; {GATE_HALF_WIDTHS[cut_id] * 2}-pixel openings; a miss adds 2.5 seconds"
        ),
        "selectionPercentile": percentile,
        "selectionThreshold": threshold,
        "obstacleCount": len(obstacles),
        "gateCount": len(gates),
        "treeObstacleCount": tree_count,
        "mogulObstacleCount": len(obstacles) - tree_count,
        "denseRowCount": dense_rows,
        "saturatedRowCount": saturated_rows,
        "difficultyScore": difficulty_score,
        "timeRule": (
            "60-second qualification limit for Easy; Medium and Hard retain 75 seconds"
        ),
        "segments": [receipt_segment(segment, index) for index, segment in enumerate(segments)],
    }
    payload = {
        "courseId": f"{triplet_id}-{cut_id.lower()}",
        "courseLabel": f"{difficulty.upper()} / {triplet_id.split('-')[-1].upper()}",
        "decoderVersion": DECODER_VERSION,
        "tripletId": triplet_id,
        "cutId": cut_id,
        "difficulty": difficulty,
        "courseLength": course_length,
        "corridorMinX": CORRIDOR_MIN_X,
        "corridorMaxX": CORRIDOR_MAX_X,
        "cruiseSpeed": 72,
        "minSpeed": 56,
        "maxSpeed": 78,
        "parSeconds": 65,
        "winSeconds": target_seconds_for_cut(cut_id),
        "difficultyScore": difficulty_score,
        "rowSpacing": row_spacing,
        "obstacles": obstacles,
        "gates": gates,
        "receipt": receipt,
    }
    return {
        "scheduleId": triplet_id,
        "cutId": cut_id,
        "selectionPercentile": percentile,
        "selectionThreshold": threshold,
        "contentSha256": sha256_canonical(payload),
        "obstacleCount": len(obstacles),
        "gateCount": len(gates),
        "treeObstacleCount": tree_count,
        "mogulObstacleCount": len(obstacles) - tree_count,
        "denseRowCount": dense_rows,
        "saturatedRowCount": saturated_rows,
        "difficultyScore": difficulty_score,
        "winSeconds": target_seconds_for_cut(cut_id),
        "parSeconds": 65,
    }


def main() -> None:
    bank = json.loads(SOURCE_PATH.read_text())
    if bank.get("bankContentSha256") != EXPECTED_BANK_SHA256:
        raise ValueError("SkiPixl source bank identity changed")
    schedules = [
        decode_course(bank, schedule, cut_id, percentile)
        for schedule in bank["schedules"]
        for cut_id, percentile in CUTS
    ]
    output = {
        "schemaVersion": "skipixl-residual-cut-catalog-v1",
        "decoderVersion": DECODER_VERSION,
        "sourceBankContentSha256": EXPECTED_BANK_SHA256,
        "cuts": [
            {"cutId": cut_id, "percentile": percentile}
            for cut_id, percentile in CUTS
        ],
        "schedules": schedules,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"wrote {OUTPUT_PATH}")
    for cut_id, _ in CUTS:
        counts = [
            item["obstacleCount"] for item in schedules if item["cutId"] == cut_id
        ]
        print(f"{cut_id}: {min(counts)}..{max(counts)} hazards")


if __name__ == "__main__":
    main()
