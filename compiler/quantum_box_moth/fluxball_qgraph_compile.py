"""Promote a complete captured Fluxball QGraph bank into runtime records."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Mapping, Sequence

from .canonical import canonical_bytes, sha256_bytes, sha256_json
from .fluxball_qgraph_batch import (
    BANK_ID,
    CAPTURE_SCHEMA_VERSION,
    build_targets,
    normalize_qgraph_result,
    redacted_request,
)
from .models import ContractError


RUNTIME_BANK_ID = "fluxball-qgraph-qpu-bank-v2"
RUNTIME_SCHEMA_VERSION = "fluxball-qgraph-rule-bank-v1"
SELECTION_POLICY = (
    "qpu-then-moth-emulator-then-local-aer-then-deterministic-classical"
)
FALLBACK_PACKS = {
    "2": {
        "packId": "fluxball-aer-two-qubit-v1",
        "contentSha256": (
            "af91a70fc633ef4808e658268309ad67d7b808b1d10d77e5e36fcf35090feedb"
        ),
    },
    "4": {
        "packId": "fluxball-aer-four-qubit-hybrid-v1",
        "contentSha256": (
            "ba9afa9d257d9a2f6e11d1b23cb3a21bf1a10f87e2c9ea6d54cde92873fe0db3"
        ),
    },
}
FOUR_PLAYER_COMBINATIONS = (
    ("equal", "equal"),
    ("equal", "opposed"),
    ("opposed", "equal"),
    ("opposed", "opposed"),
)


def eligible_round(target) -> int:
    if target.competitor_count == 2:
        return target.replicate
    try:
        combination = FOUR_PLAYER_COMBINATIONS.index(target.relationships)
    except ValueError as error:
        raise ContractError(
            f"target {target.target_id}.relationships", "is unsupported"
        ) from error
    return combination * 2 + target.replicate


def validate_capture(value: Mapping[str, Any], target) -> Dict[str, Any]:
    if value.get("schemaVersion") != CAPTURE_SCHEMA_VERSION:
        raise ContractError(f"capture {target.target_id}.schemaVersion", "is invalid")
    if value.get("bankId") != BANK_ID or value.get("targetId") != target.target_id:
        raise ContractError(f"capture {target.target_id}", "identity is invalid")
    if value.get("competitorCount") != target.competitor_count:
        raise ContractError(
            f"capture {target.target_id}.competitorCount", "is invalid"
        )
    if value.get("replicate") != target.replicate:
        raise ContractError(f"capture {target.target_id}.replicate", "is invalid")
    if value.get("playerOrder") != list(target.player_order):
        raise ContractError(f"capture {target.target_id}.playerOrder", "is invalid")
    if value.get("relationships") != list(target.relationships):
        raise ContractError(
            f"capture {target.target_id}.relationships", "is invalid"
        )
    expected_hash = value.get("contentSha256")
    material = {key: item for key, item in value.items() if key != "contentSha256"}
    if not isinstance(expected_hash, str) or sha256_json(material) != expected_hash:
        raise ContractError(f"capture {target.target_id}.contentSha256", "is invalid")
    if _contains_credentials(value):
        raise ContractError(f"capture {target.target_id}", "contains credential fields")
    result = value.get("result")
    normalized = normalize_qgraph_result(canonical_bytes(result), target)
    if normalized != result:
        raise ContractError(f"capture {target.target_id}.result", "is not canonical")
    if value.get("ibmJobId") != result.get("ibm_job_id"):
        raise ContractError(f"capture {target.target_id}.ibmJobId", "is inconsistent")
    raw_hash = value.get("rawResultSha256")
    if not isinstance(raw_hash, str) or len(raw_hash) != 64:
        raise ContractError(
            f"capture {target.target_id}.rawResultSha256", "is invalid"
        )
    return dict(value)


def runtime_record(capture: Mapping[str, Any], target, evidence_path: str) -> Dict[str, Any]:
    result = capture["result"]
    request = redacted_request(target)["params"]
    return {
        "recordId": (
            f"graph-v1-ibm-fez-{target.target_id}-"
            f"{str(capture['mothJobId'])[:8]}"
        ),
        "source": "moth-qgraph-qpu",
        "engineId": "graph-v1",
        "competitorCount": target.competitor_count,
        "eligibleRounds": [eligible_round(target)],
        "playerOrder": list(target.player_order),
        "mode": "qpu",
        "backendName": "ibm_fez",
        "mothJobId": capture["mothJobId"],
        "ibmJobId": capture["ibmJobId"],
        "submittedAt": capture["submittedAt"],
        "captureMethod": "committed-api-result",
        "rawResultSha256": capture["rawResultSha256"],
        "evidencePath": evidence_path,
        "shots": result["shots"],
        "numQubits": target.competitor_count,
        "couplingMap": result["coupling_map"],
        "operations": request["operations"],
        "measurementBasis": "computational",
        "bitOrder": "qubit-0-leftmost",
        "bitToSign": {"0": "+", "1": "-"},
        "measurements": [
            {"bitstring": item["bitstring"], "count": item["count"]}
            for item in result["measurements"]
        ],
        "claimBoundary": capture["claimBoundary"],
    }


def build_runtime_bank(captures: Mapping[str, Mapping[str, Any]]) -> Dict[str, Any]:
    records = []
    for target in build_targets():
        capture = captures.get(target.target_id)
        if capture is None:
            raise ContractError(
                "capture bank", f"is missing target {target.target_id}"
            )
        checked = validate_capture(capture, target)
        evidence_path = (
            "compiler/quantum_box_moth/evidence/"
            f"{RUNTIME_BANK_ID}/{target.target_id}.json"
        )
        records.append(runtime_record(checked, target, evidence_path))
    records.sort(
        key=lambda record: (
            record["competitorCount"],
            record["eligibleRounds"][0],
            record["recordId"],
        )
    )
    return {
        "schemaVersion": RUNTIME_SCHEMA_VERSION,
        "bankId": RUNTIME_BANK_ID,
        "selectionPolicy": SELECTION_POLICY,
        "fallbackPacks": FALLBACK_PACKS,
        "records": records,
    }


def promote_complete_bank() -> int:
    root = Path(__file__).resolve().parents[2]
    acquisition_dir = (
        root
        / "compiler/quantum_box_moth/acquisitions/fluxball-qgraph-qpu-bank-v2"
    )
    collection_path = acquisition_dir / "collection-state-v1.json"
    captures_dir = acquisition_dir / "captures-v1"
    if not collection_path.exists() or not captures_dir.exists():
        raise ContractError("capture bank", "has not been collected")
    state = json.loads(collection_path.read_text(encoding="utf-8"))
    jobs = state.get("jobs")
    if not isinstance(jobs, dict):
        raise ContractError("collection state.jobs", "is invalid")
    targets = build_targets()
    incomplete = [
        target.target_id
        for target in targets
        if not isinstance(jobs.get(target.target_id), dict)
        or jobs[target.target_id].get("state") != "captured"
    ]
    if incomplete:
        raise ContractError(
            "capture bank", f"has {len(incomplete)} uncaptured targets"
        )

    captures: Dict[str, Dict[str, Any]] = {}
    source_bytes: Dict[str, bytes] = {}
    for target in targets:
        path = captures_dir / f"{target.target_id}.json"
        if not path.exists():
            raise ContractError("capture bank", f"is missing {path.name}")
        data = path.read_bytes()
        try:
            value = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(path), "is not UTF-8 JSON") from error
        captures[target.target_id] = validate_capture(value, target)
        source_bytes[target.target_id] = data

    runtime_bank = build_runtime_bank(captures)
    evidence_dir = root / "compiler/quantum_box_moth/evidence" / RUNTIME_BANK_ID
    evidence_dir.mkdir(parents=True, exist_ok=True)
    index_entries = []
    for target in targets:
        destination = evidence_dir / f"{target.target_id}.json"
        _write_or_verify_bytes(destination, source_bytes[target.target_id])
        index_entries.append(
            {
                "targetId": target.target_id,
                "capturePath": str(destination.relative_to(root)),
                "captureByteSha256": sha256_bytes(source_bytes[target.target_id]),
                "captureContentSha256": captures[target.target_id]["contentSha256"],
                "rawResultSha256": captures[target.target_id]["rawResultSha256"],
            }
        )
    evidence_index = {
        "schemaVersion": "fluxball-qgraph-evidence-index-v1",
        "bankId": RUNTIME_BANK_ID,
        "captureCount": len(index_entries),
        "captures": index_entries,
    }
    _write_pretty_json(evidence_dir / "index-v1.json", evidence_index)
    runtime_path = root / "src/games/fluxball/data/fluxball-qgraph-rule-bank-v1.json"
    _write_pretty_json(runtime_path, runtime_bank)
    print(
        f"Promoted {len(index_entries)} validated IBM Fez captures into "
        f"{runtime_path.relative_to(root)}."
    )
    return 0


def _contains_credentials(value: Any) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            lowered = str(key).lower()
            if any(
                marker in lowered
                for marker in (
                    "authorization",
                    "credential",
                    "password",
                    "qpu_instance",
                    "qpu_token",
                    "secret",
                    "token",
                )
            ):
                return True
            if _contains_credentials(item):
                return True
    elif isinstance(value, list):
        return any(_contains_credentials(item) for item in value)
    return False


def _write_or_verify_bytes(path: Path, data: bytes) -> None:
    if path.exists():
        if path.read_bytes() != data:
            raise ContractError(str(path), "existing evidence bytes differ")
        return
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(data)
    os.chmod(temporary, 0o644)
    os.replace(temporary, path)


def _write_pretty_json(path: Path, value: Mapping[str, Any]) -> None:
    data = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(data)
    os.chmod(temporary, 0o644)
    os.replace(temporary, path)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--promote-complete-bank", action="store_true")
    args = parser.parse_args(argv)
    if not args.promote_complete_bank:
        parser.error("promotion requires --promote-complete-bank")
    try:
        return promote_complete_bank()
    except ContractError as error:
        print(error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
