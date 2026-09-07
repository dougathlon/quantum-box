"""Build the sanitized, gameplay-authoritative SkiPixl B3 segment bank.

The source PNGs and provider UI captures remain in the visual-development
archive. This script verifies those originals, extracts only the submitted
grayscale bytes and returned value arrays needed by the decoder, and writes a
runtime fixture with exact provenance. It does not contact Moth or IBM.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image


RUNTIME_ROOT = Path(__file__).resolve().parents[1]
QUANTUM_CULTURE_ROOT = Path(__file__).resolve().parents[3]
PROGRAM_ROOT = (
    QUANTUM_CULTURE_ROOT
    / "drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware"
    / "brown-box-background-and-assets-v1"
)
MANIFEST_PATH = PROGRAM_ROOT / "manifests/background-job-manifest-v1.json"
OUTPUT_PATH = (
    RUNTIME_ROOT
    / "src/games/skipixl/data/qpixl-b3-segments-v1.json"
)
DECODER_VERSION = "skipixl-segment-ranked-residual-v3"
TREE_OBSTACLE_COUNT = 30
TREE_OBSTACLES_PER_SEGMENT = 10


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def quantum_culture_path(relative: str) -> Path:
    path = QUANTUM_CULTURE_ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def source_pixels(path: Path) -> list[int]:
    with Image.open(path) as image:
        if image.mode != "L" or image.size != (20, 20):
            raise ValueError(f"{path} must be a non-interlaced 20x20 grayscale source")
        pixels = list(image.getdata())
    if len(pixels) != 400 or any(not 0 <= value <= 255 for value in pixels):
        raise ValueError(f"{path} has invalid grayscale pixels")
    return pixels


def result_record(job: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    artifacts = {artifact["kind"]: artifact for artifact in job["rawArtifacts"]}
    artifact = artifacts.get("ui-result-json")
    if artifact is None:
        raise ValueError(f"{job['runId']} has no provider UI result capture")
    path = quantum_culture_path(artifact["path"])
    raw = path.read_bytes()
    if sha256_bytes(raw) != artifact["sha256"]:
        raise ValueError(f"{job['runId']} provider UI result hash drifted")
    record = json.loads(raw)
    if (
        record.get("job_id") != job["mothJobId"]
        or record.get("engine_id") != "qpixl-v1"
        or record.get("status") != "completed"
    ):
        raise ValueError(f"{job['runId']} provider UI identity is inconsistent")
    result = record.get("result")
    if not isinstance(result, dict):
        raise ValueError(f"{job['runId']} has no result object")
    values = result.get("output")
    if (
        result.get("backend") != "ibm_fez"
        or not isinstance(result.get("ibm_job_id"), str)
        or not isinstance(values, list)
        or len(values) != 400
        or any(not isinstance(value, (int, float)) for value in values)
    ):
        raise ValueError(f"{job['runId']} has an invalid IBM Fez result")
    return artifact, result


def decode_obstacles(
    segments: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], float]:
    winners: list[dict[str, Any]] = []
    for segment_order, segment in enumerate(segments):
        source = segment["sourcePixels"]
        returned = segment["returnedValues"]
        for local_row in range(20):
            row_start = local_row * 20
            candidates = []
            for column in range(20):
                index = row_start + column
                residual = returned[index] - source[index] / 255
                candidates.append((abs(residual), -column, column, residual))
            magnitude, _, column, residual = max(candidates)
            row = segment_order * 20 + local_row
            winners.append(
                {
                    "row": row,
                    "column": column,
                    "magnitude": magnitude,
                    "segmentId": segment["segmentId"],
                    "cellIndex": row_start + column,
                }
            )
    if len(winners) != 60:
        raise ValueError("SkiPixl decoder requires sixty ranked row winners")
    tree_rows = set()
    segment_kind_thresholds = []
    for segment_order in range(3):
        ranked = sorted(
            winners[segment_order * 20 : segment_order * 20 + 20],
            key=lambda winner: (-winner["magnitude"], winner["row"]),
        )
        selected = ranked[:TREE_OBSTACLES_PER_SEGMENT]
        tree_rows.update(winner["row"] for winner in selected)
        segment_kind_thresholds.append(selected[-1]["magnitude"])
    obstacles = [
        {
            "obstacleId": f"row-{winner['row'] + 1:02d}",
            "row": winner["row"],
            "distance": 70 + winner["row"] * 70,
            "column": winner["column"],
            "x": 120 + winner["column"] * 21,
            "kind": "tree" if winner["row"] in tree_rows else "rock",
            "segmentId": winner["segmentId"],
            "cellIndex": winner["cellIndex"],
        }
        for winner in winners
    ]
    return obstacles, segment_kind_thresholds


def payload_for(schedule_id: str, segments: list[dict[str, Any]], bank_hash: str) -> dict[str, Any]:
    obstacles, segment_kind_thresholds = decode_obstacles(segments)
    receipt_segments = [
        {
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
        for order, segment in enumerate(segments)
    ]
    return {
        "courseId": schedule_id,
        "courseLabel": f"B3 / {schedule_id.split('-')[-1].upper()}",
        "decoderVersion": DECODER_VERSION,
        "courseLength": 4270,
        "corridorMinX": 96,
        "corridorMaxX": 544,
        "cruiseSpeed": 72,
        "minSpeed": 56,
        "maxSpeed": 78,
        "parSeconds": 50,
        "winSeconds": 60,
        "rowSpacing": 70,
        "obstacles": obstacles,
        "receipt": {
            "schemaVersion": "skipixl-course-receipt-v2",
            "bankId": "qpixl-b3-segment-bank-v1",
            "bankContentSha256": bank_hash,
            "decoderVersion": DECODER_VERSION,
            "residualDefinition": "returnedValue - submittedGrayscaleByte / 255",
            "rowSelection": "maximum absolute residual; leftmost column breaks exact ties",
            "kindMapping": "within each twenty-row segment, rank winning residual magnitudes descending; strongest ten rows -> tree; remaining rows -> mogul; lower row breaks exact magnitude ties",
            "treeObstacleCount": TREE_OBSTACLE_COUNT,
            "treeObstaclesPerSegment": TREE_OBSTACLES_PER_SEGMENT,
            "segmentKindThresholds": segment_kind_thresholds,
            "segments": receipt_segments,
        },
    }


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    jobs = sorted(
        (job for job in manifest["jobs"] if job["runId"].endswith("-b3")),
        key=lambda job: int(job["bankSlot"][2:]),
    )
    if len(jobs) != 20:
        raise ValueError(f"Expected 20 B3 jobs, found {len(jobs)}")

    segments: list[dict[str, Any]] = []
    for job in jobs:
        source_path = quantum_culture_path(job["sourcePath"])
        source_raw = source_path.read_bytes()
        if sha256_bytes(source_raw) != job["sourceSha256"]:
            raise ValueError(f"{job['runId']} source hash drifted")
        pixels = source_pixels(source_path)
        artifact, result = result_record(job)
        returned = result["output"]
        segments.append(
            {
                "segmentId": job["runId"],
                "sourceIdentity": job["sourceIdentity"],
                "sourceSha256": job["sourceSha256"],
                "sourcePixelSha256": sha256_bytes(bytes(pixels)),
                "resultArtifactSha256": artifact["sha256"],
                "returnedValuesSha256": sha256_bytes(canonical_json(returned).encode()),
                "mothJobId": job["mothJobId"],
                "ibmJobId": result["ibm_job_id"],
                "sourcePixels": pixels,
                "returnedValues": returned,
            }
        )

    bank_core = {
        "schemaVersion": "skipixl-qpixl-segment-bank-v1",
        "bankId": "qpixl-b3-segment-bank-v1",
        "engineId": "qpixl-v1",
        "mode": "qpu",
        "backend": "ibm_fez",
        "shots": 4096,
        "dynamicRange": "min_avg_max",
        "discretize": 0,
        "allowHighShots": False,
        "captureClassification": "provider UI payload capture; not an HTTP response-body download",
        "decoderVersion": DECODER_VERSION,
        "segments": segments,
    }
    bank_hash = sha256_bytes(canonical_json(bank_core).encode())

    schedules = []
    for index in range(20):
        segment_indexes = [index, (index + 7) % 20, (index + 13) % 20]
        schedule_id = f"skipixl-b3-triplet-{index + 1:02d}"
        payload = payload_for(
            schedule_id,
            [segments[segment_index] for segment_index in segment_indexes],
            bank_hash,
        )
        schedules.append(
            {
                "scheduleId": schedule_id,
                "segmentIndexes": segment_indexes,
                "contentSha256": sha256_bytes(canonical_json(payload).encode()),
            }
        )

    output = {**bank_core, "bankContentSha256": bank_hash, "schedules": schedules}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"wrote {OUTPUT_PATH}")
    print(f"bank {bank_hash}")
    print(f"segments {len(segments)} schedules {len(schedules)}")


if __name__ == "__main__":
    main()
