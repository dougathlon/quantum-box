"""Contract inspection, local compilation, and explicitly approved acquisition.

Live submission is reachable only through an exact validated Qong preflight and
a separate content-addressed approval receipt. No API key is accepted as an
argument or written to an artifact.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
from pathlib import Path
import struct
import sys
from typing import Any, Dict, Sequence
import zlib

from .adapters import (
    LabyrinthMockNormalization,
    SequencedResult,
    candidate_bytes,
    decode_qong_contract_mock,
    evaluate_graph_result,
    evaluate_labyrinth_result,
)
from .canonical import canonical_json, sha256_bytes
from .client import MothApiClient
from .engine_contracts import ENGINE_CONTRACTS
from .models import API_SPECIFICATION_SHA256, API_VERSION, ContractError
from .qong_bank import (
    assemble_bank,
    coin_engine_report,
    immutable_json,
    inspect_first_rally_candidates,
    load_capture_directory,
    load_first_rally_candidate_directory,
    prepare_preflight,
    promote_bank,
)
from .qong_acquisition import acquire_qong_bank, create_approval
from .qong_browser_acquisition import (
    MIXED_BACKEND_POLICY,
    STRICT_BACKEND_POLICY,
    accept_browser_job,
    adopt_prior_browser_reservation,
    assemble_blocked_browser_bank,
    browser_acquisition_report,
    capture_completed_browser_status,
    capture_failed_browser_status,
    import_prior_browser_capture,
    prepare_browser_preflight,
    reserve_next_browser_item,
    retry_failed_browser_item,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("contracts", help="print pinned contract gaps; no network")
    commands.add_parser(
        "inspect-blur",
        help="inspect the live blur-v1 definition without submitting a job",
    )
    commands.add_parser(
        "inspect-qpixl",
        help="inspect the live qpixl-v1 definition without submitting a job",
    )
    commands.add_parser(
        "inspect-coin",
        help="inspect the live coin-toss-v1 definition without submitting a job",
    )
    qong_preflight = commands.add_parser(
        "prepare-qong-preflight",
        help="prepare the exact 120-job Qong Coin Toss plan; no submission",
    )
    qong_preflight.add_argument("--inspection", type=Path, required=True)
    qong_preflight.add_argument(
        "--accept-live-record-sha256", required=True
    )
    qong_preflight.add_argument("--output", type=Path, required=True)
    qong_assemble = commands.add_parser(
        "assemble-qong-bank",
        help="assemble a sanitized Story bank from 120 private captures; no network",
    )
    qong_assemble.add_argument("--preflight", type=Path, required=True)
    qong_assemble.add_argument("--captures", type=Path, required=True)
    qong_assemble.add_argument("--output", type=Path, required=True)
    qong_blocked_assemble = commands.add_parser(
        "assemble-qong-blocked-bank",
        help=(
            "assemble a bank from one captured even selector prefix and an "
            "immutable non-retryable provider blocker; no network"
        ),
    )
    qong_blocked_assemble.add_argument("--preflight", type=Path, required=True)
    qong_blocked_assemble.add_argument("--cache", type=Path, required=True)
    qong_blocked_assemble.add_argument(
        "--selector-bit-count", type=int, required=True
    )
    qong_blocked_assemble.add_argument("--output", type=Path, required=True)
    qong_candidates = commands.add_parser(
        "inspect-qong-candidate-pool",
        help="validate the first 32 private captures before remaining acquisition",
    )
    qong_candidates.add_argument("--preflight", type=Path, required=True)
    qong_candidates.add_argument("--captures", type=Path, required=True)
    qong_promote = commands.add_parser(
        "promote-qong-bank",
        help="replace only the exact unavailable Story placeholder with an accepted bank",
    )
    qong_promote.add_argument("--preflight", type=Path, required=True)
    qong_promote.add_argument("--captures", type=Path, required=True)
    qong_promote.add_argument("--accept-bank-sha256", required=True)
    qong_promote.add_argument(
        "--output",
        type=Path,
        default=Path("src/games/qong/packs/qong-story-pack-bank-v1.json"),
    )
    qong_blocked_promote = commands.add_parser(
        "promote-qong-blocked-bank",
        help=(
            "promote one exact blocked-prefix bank after accepting its content hash"
        ),
    )
    qong_blocked_promote.add_argument("--preflight", type=Path, required=True)
    qong_blocked_promote.add_argument("--cache", type=Path, required=True)
    qong_blocked_promote.add_argument(
        "--selector-bit-count", type=int, required=True
    )
    qong_blocked_promote.add_argument("--accept-bank-sha256", required=True)
    qong_blocked_promote.add_argument(
        "--output",
        type=Path,
        default=Path("src/games/qong/packs/qong-story-pack-bank-v1.json"),
    )
    qong_approval = commands.add_parser(
        "approve-qong-preflight",
        help="bind an explicit local approval note to one exact preflight; no network",
    )
    qong_approval.add_argument("--preflight", type=Path, required=True)
    qong_approval.add_argument("--note", type=Path, required=True)
    qong_approval.add_argument("--approved-at-utc", required=True)
    qong_approval.add_argument("--output", type=Path, required=True)
    qong_acquire = commands.add_parser(
        "acquire-qong-bank",
        help="submit/resume only the exact approved Qong jobs and collect private captures",
    )
    qong_acquire.add_argument("--preflight", type=Path, required=True)
    qong_acquire.add_argument("--approval", type=Path, required=True)
    qong_acquire.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-acquisition"),
    )
    qong_acquire.add_argument("--max-new-jobs", type=int)
    qong_acquire.add_argument("--timeout-seconds", type=float, default=900.0)
    qong_browser_preflight = commands.add_parser(
        "prepare-qong-browser-preflight",
        help="bind the authenticated showcase contract and exact 120-job plan",
    )
    qong_browser_preflight.add_argument("--contract-observed-at-utc", required=True)
    qong_browser_preflight.add_argument("--authorized-at-utc", required=True)
    qong_browser_preflight.add_argument(
        "--authorization-note-sha256", required=True
    )
    qong_browser_preflight.add_argument(
        "--backend-policy",
        choices=(STRICT_BACKEND_POLICY, MIXED_BACKEND_POLICY),
        default=STRICT_BACKEND_POLICY,
    )
    qong_browser_preflight.add_argument("--output", type=Path, required=True)
    qong_browser_reserve = commands.add_parser(
        "reserve-qong-browser-item",
        help="durably reserve the next exact item before one showcase Run",
    )
    qong_browser_reserve.add_argument("--preflight", type=Path, required=True)
    qong_browser_reserve.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_reserve.add_argument("--max-pending", type=int, default=1)
    qong_browser_accept = commands.add_parser(
        "accept-qong-browser-job",
        help="bind one returned Moth job UUID to its browser reservation",
    )
    qong_browser_accept.add_argument("--preflight", type=Path, required=True)
    qong_browser_accept.add_argument("--item-id", required=True)
    qong_browser_accept.add_argument("--job-id", required=True)
    qong_browser_accept.add_argument("--observed-at-utc", required=True)
    qong_browser_accept.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_capture = commands.add_parser(
        "capture-qong-browser-status",
        help="read one completed showcase status JSON from stdin and capture it",
    )
    qong_browser_capture.add_argument("--preflight", type=Path, required=True)
    qong_browser_capture.add_argument("--item-id", required=True)
    qong_browser_capture.add_argument("--observed-at-utc", required=True)
    qong_browser_capture.add_argument(
        "--status-base64",
        help="credential-screened UTF-8 status JSON encoded as base64; otherwise stdin",
    )
    qong_browser_capture.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_failure = commands.add_parser(
        "capture-qong-browser-failure",
        help="preserve one terminal failed/cancelled showcase status from stdin",
    )
    qong_browser_failure.add_argument("--preflight", type=Path, required=True)
    qong_browser_failure.add_argument("--item-id", required=True)
    qong_browser_failure.add_argument("--observed-at-utc", required=True)
    qong_browser_failure.add_argument(
        "--status-base64",
        help="credential-screened UTF-8 failure status encoded as base64; otherwise stdin",
    )
    qong_browser_failure.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_retry = commands.add_parser(
        "retry-qong-browser-item",
        help="reserve one bounded retry after an immutable retryable provider failure",
    )
    qong_browser_retry.add_argument("--preflight", type=Path, required=True)
    qong_browser_retry.add_argument("--item-id", required=True)
    qong_browser_retry.add_argument("--authorized-at-utc", required=True)
    qong_browser_retry.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_report = commands.add_parser(
        "report-qong-browser-acquisition",
        help="report the immutable showcase ledger without network access",
    )
    qong_browser_report.add_argument("--preflight", type=Path, required=True)
    qong_browser_report.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_adopt = commands.add_parser(
        "adopt-qong-browser-reservation",
        help="bind an immutable pre-ledger reservation to its accepted job",
    )
    qong_browser_adopt.add_argument("--preflight", type=Path, required=True)
    qong_browser_adopt.add_argument("--item-id", required=True)
    qong_browser_adopt.add_argument("--reserved-at-utc", required=True)
    qong_browser_adopt.add_argument("--reservation-receipt-sha256", required=True)
    qong_browser_adopt.add_argument("--adopted-at-utc", required=True)
    qong_browser_adopt.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qong_browser_import = commands.add_parser(
        "import-qong-browser-capture",
        help="copy one validated completed record from a retired browser ledger",
    )
    qong_browser_import.add_argument("--preflight", type=Path, required=True)
    qong_browser_import.add_argument(
        "--source-preflight-sha256", required=True
    )
    qong_browser_import.add_argument("--item-id", required=True)
    qong_browser_import.add_argument("--imported-at-utc", required=True)
    qong_browser_import.add_argument(
        "--cache",
        type=Path,
        default=Path(".moth-cache/qong-browser-acquisition"),
    )
    qpixl_study = commands.add_parser(
        "prepare-qpixl-study",
        help="generate the deterministic local QPixl signal-field study; no network",
    )
    qpixl_study.add_argument(
        "--output",
        type=Path,
        default=(
            Path("compiler")
            / "quantum_box_moth"
            / "studies"
            / "qpixl-signal-field-v1"
        ),
    )
    prepare = commands.add_parser(
        "prepare-blur-study",
        help="validate and hash a local PNG image/mask study; no network",
    )
    prepare.add_argument("--image", type=Path, required=True)
    prepare.add_argument("--mask", type=Path, required=True)
    prepare.add_argument("--strength", type=float, required=True)
    prepare.add_argument("--style", choices=("rx", "ry"), required=True)
    prepare.add_argument("--reach", type=float, required=True)
    prepare.add_argument("--size", type=int, default=256)
    downscale = prepare.add_mutually_exclusive_group()
    downscale.add_argument("--downscale", dest="downscale", action="store_true")
    downscale.add_argument("--no-downscale", dest="downscale", action="store_false")
    prepare.set_defaults(downscale=True)
    mock = commands.add_parser(
        "mock-candidates", help="generate local contract-mock promotion candidates"
    )
    mock.add_argument(
        "--output",
        type=Path,
        default=Path(".moth-cache/candidates"),
        help="ignored local output directory",
    )
    return parser


def _contract_report() -> Dict[str, Any]:
    return {
        "schemaVersion": "quantum-box-engine-contract-report-v1",
        "apiSpecification": {
            "version": API_VERSION,
            "canonicalSha256": API_SPECIFICATION_SHA256,
        },
        "requestMode": "local-pinned-evidence-no-network",
        "engines": [
            {
                "engineId": contract.engine_id,
                "canonicalSha256": contract.canonical_sha256,
                "redactedSha256": contract.redacted_sha256,
                "updatedAt": contract.updated_at,
                "listedCreditsPerRun": contract.credits_per_run,
                "inputSlots": list(contract.input_slots),
                "outputType": contract.output_type,
                "resultContractState": contract.result_contract_state,
                "unresolvedGaps": list(contract.unresolved_gaps),
                "livePostAuthorized": False,
            }
            for contract in ENGINE_CONTRACTS.values()
        ],
    }


def _blur_engine_report(record: Dict[str, Any]) -> Dict[str, Any]:
    contract = ENGINE_CONTRACTS["blur-v1"]
    properties = record.get("params_schema", {}).get("properties", {})
    if not isinstance(properties, dict):
        raise ContractError("blur-v1.params_schema.properties", "must be an object")
    inputs = record.get("input_files")
    if not isinstance(inputs, list):
        raise ContractError("blur-v1.input_files", "must be an array")
    input_names = [item.get("name") for item in inputs if isinstance(item, dict)]
    required_params = ("strength", "style", "reach", "size", "downscale")
    missing_params = [name for name in required_params if name not in properties]
    if missing_params:
        raise ContractError(
            "blur-v1.params_schema",
            "missing fields: {}".format(", ".join(missing_params)),
        )
    if record.get("engine_id") != contract.engine_id:
        raise ContractError("blur-v1.engine_id", "does not match blur-v1")
    if input_names != ["image", "mask"]:
        raise ContractError(
            "blur-v1.input_files", "expected ordered image and mask slots"
        )
    code_text = "\n".join(
        sample.get("source", "")
        for sample in record.get("code_samples", [])
        if isinstance(sample, dict) and isinstance(sample.get("source"), str)
    )
    canonical_sha256 = sha256_bytes(canonical_json(record).encode("utf-8"))
    evidence_path = (
        Path(__file__).resolve().parent
        / "evidence"
        / "blur-v1-operational-2026-08-04.json"
    )
    try:
        reviewed = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ContractError(
            "blur-v1 operational evidence", "could not read the reviewed snapshot"
        ) from error
    reviewed_record = reviewed.get("record")
    if not isinstance(reviewed_record, dict):
        raise ContractError(
            "blur-v1 operational evidence.record", "must be an object"
        )
    current_operational = _blur_operational_record(record)
    changes = _recursive_changes(reviewed_record, current_operational)
    material_changes = [
        change for change in changes if change["path"] != "$.updated_at"
    ]
    sample_schema_conflict = "non_locality" in code_text and "reach" not in code_text
    return {
        "schemaVersion": "quantum-box-blur-inspection-v1",
        "requestMode": "authenticated-read-only",
        "networkMutation": False,
        "engineId": contract.engine_id,
        "name": record.get("name"),
        "updatedAt": record.get("updated_at"),
        "listedCreditsPerRun": record.get("credits_per_run"),
        "isMultipart": record.get("is_multipart"),
        "inputFiles": input_names,
        "outputType": record.get("output_type"),
        "canonicalEngineRecordSha256": canonical_sha256,
        "pinnedCanonicalSha256": contract.canonical_sha256,
        "matchesPinnedContract": canonical_sha256 == contract.canonical_sha256,
        "operationalComparison": {
            "reviewedSourceCanonicalSha256": reviewed.get(
                "source_canonical_sha256"
            ),
            "reviewedUpdatedAt": reviewed_record.get("updated_at"),
            "currentUpdatedAt": current_operational.get("updated_at"),
            "changes": changes,
            "materialChanges": material_changes,
            "matchesReviewedOperationalContract": not material_changes,
        },
        "params": {
            name: {
                "default": properties[name].get("default"),
                "minimum": properties[name].get("minimum"),
                "maximum": properties[name].get("maximum"),
                "enum": properties[name].get("enum"),
            }
            for name in required_params
        },
        "contractWarning": (
            "Code samples use non_locality while the params schema uses reach. "
            "Do not submit until the live accepted field is confirmed."
            if sample_schema_conflict
            else None
        ),
        "safeToPrepareStudy": not material_changes,
        "submissionAuthorized": False,
    }


def _qpixl_engine_report(record: Dict[str, Any]) -> Dict[str, Any]:
    contract = ENGINE_CONTRACTS["qpixl-v1"]
    if record.get("engine_id") != contract.engine_id:
        raise ContractError("qpixl-v1.engine_id", "does not match qpixl-v1")
    properties = record.get("params_schema", {}).get("properties", {})
    if not isinstance(properties, dict):
        raise ContractError("qpixl-v1.params_schema.properties", "must be an object")
    canonical_sha256 = sha256_bytes(canonical_json(record).encode("utf-8"))
    params = {}
    for name, item in sorted(properties.items()):
        if not isinstance(item, dict):
            raise ContractError(
                "qpixl-v1.params_schema.{}".format(name), "must be an object"
            )
        params[name] = {
            key: item.get(key)
            for key in (
                "type",
                "default",
                "enum",
                "minimum",
                "maximum",
                "exclusiveMinimum",
                "minLength",
                "anyOf",
            )
            if key in item
        }
    machine_values = params.get("machine", {}).get("enum")
    mode_values = params.get("mode", {}).get("enum")
    backend_present = "backend_name" in params
    qpu_markers = []
    for values in (machine_values, mode_values):
        if isinstance(values, list):
            qpu_markers.extend(
                value
                for value in values
                if isinstance(value, str)
                and ("qpu" in value.lower() or value.lower().startswith("ibm_"))
            )
    code_text = "\n".join(
        sample.get("source", "")
        for sample in record.get("code_samples", [])
        if isinstance(sample, dict) and isinstance(sample.get("source"), str)
    )
    return {
        "schemaVersion": "quantum-box-qpixl-inspection-v1",
        "requestMode": "authenticated-read-only",
        "networkMutation": False,
        "engineId": contract.engine_id,
        "name": record.get("name"),
        "updatedAt": record.get("updated_at"),
        "listedCreditsPerRun": record.get("credits_per_run"),
        "isMultipart": record.get("is_multipart"),
        "inputFiles": [
            item.get("name")
            for item in record.get("input_files", [])
            if isinstance(item, dict)
        ],
        "outputType": record.get("output_type"),
        "canonicalEngineRecordSha256": canonical_sha256,
        "pinnedCanonicalSha256": contract.canonical_sha256,
        "matchesPinnedContract": canonical_sha256 == contract.canonical_sha256,
        "params": params,
        "qpuSurface": {
            "modeValues": mode_values,
            "machineValues": machine_values,
            "backendNameParameter": backend_present,
            "detectedQpuMarkers": sorted(set(qpu_markers)),
            "codeSampleMentionsQpu": "qpu" in code_text.lower(),
        },
        "resultContractState": contract.result_contract_state,
        "unresolvedGaps": list(contract.unresolved_gaps),
        "submissionAuthorized": False,
    }


def _description_sha256(value: Any) -> str:
    return sha256_bytes((value if isinstance(value, str) else "").encode("utf-8"))


def _blur_operational_record(record: Dict[str, Any]) -> Dict[str, Any]:
    code_text = "\n".join(
        sample.get("source", "")
        for sample in record.get("code_samples", [])
        if isinstance(sample, dict) and isinstance(sample.get("source"), str)
    )
    known_sample_params = (
        "strength",
        "style",
        "reach",
        "non_locality",
        "size",
        "downscale",
    )
    input_files = []
    for item in record.get("input_files", []):
        if not isinstance(item, dict):
            continue
        input_files.append(
            {
                "description_sha256": _description_sha256(item.get("description")),
                "mime_types": item.get("mime_types"),
                "name": item.get("name"),
                "required": item.get("required"),
            }
        )
    errors = []
    for item in record.get("error_codes", []):
        if not isinstance(item, dict):
            continue
        errors.append(
            {
                "description_sha256": _description_sha256(item.get("description")),
                "type": item.get("type"),
            }
        )
    properties = record.get("params_schema", {}).get("properties", {})
    params: Dict[str, Any] = {}
    if isinstance(properties, dict):
        for name, item in sorted(properties.items()):
            if not isinstance(item, dict):
                params[name] = item
                continue
            params[name] = {
                key: item[key]
                for key in ("default", "enum", "maximum", "minimum", "title", "type")
                if key in item
            }
            params[name]["description_sha256"] = _description_sha256(
                item.get("description")
            )
    return {
        "banner_image_tag": record.get("banner_image_tag"),
        "card_image_tag": record.get("card_image_tag"),
        "code_sample_param_names": sorted(
            name for name in known_sample_params if name in code_text
        ),
        "credits_per_run": record.get("credits_per_run"),
        "description_md_sha256": _description_sha256(record.get("description_md")),
        "description_sha256": _description_sha256(record.get("description")),
        "enabled": record.get("enabled"),
        "engine_id": record.get("engine_id"),
        "error_codes": errors,
        "execution_mode": record.get("execution_mode"),
        "has_estimate": record.get("has_estimate"),
        "has_estimate_fn": record.get("has_estimate_fn"),
        "has_validate_fn": record.get("has_validate_fn"),
        "input_files": input_files,
        "input_type": record.get("input_type"),
        "is_async": record.get("is_async"),
        "is_multipart": record.get("is_multipart"),
        "name": record.get("name"),
        "output_type": record.get("output_type"),
        "owner": record.get("owner"),
        "params": params,
        "queue": record.get("queue"),
        "run_policy": record.get("run_policy"),
        "sidecar_endpoint": record.get("sidecar_endpoint"),
        "updated_at": record.get("updated_at"),
        "visibility": record.get("visibility"),
    }


def _recursive_changes(
    reviewed: Any, current: Any, path: str = "$"
) -> list[Dict[str, Any]]:
    if isinstance(reviewed, dict) and isinstance(current, dict):
        changes = []
        for key in sorted(set(reviewed) | set(current)):
            child = "{}.{}".format(path, key)
            if key not in reviewed:
                changes.append({"path": child, "reviewed": "[ABSENT]", "current": current[key]})
            elif key not in current:
                changes.append({"path": child, "reviewed": reviewed[key], "current": "[ABSENT]"})
            else:
                changes.extend(_recursive_changes(reviewed[key], current[key], child))
        return changes
    if isinstance(reviewed, list) and isinstance(current, list):
        changes = []
        for index in range(max(len(reviewed), len(current))):
            child = "{}[{}]".format(path, index)
            if index >= len(reviewed):
                changes.append({"path": child, "reviewed": "[ABSENT]", "current": current[index]})
            elif index >= len(current):
                changes.append({"path": child, "reviewed": reviewed[index], "current": "[ABSENT]"})
            else:
                changes.extend(_recursive_changes(reviewed[index], current[index], child))
        return changes
    if reviewed == current:
        return []
    return [{"path": path, "reviewed": reviewed, "current": current}]


def _read_png(path: Path, label: str) -> tuple[bytes, int, int]:
    try:
        data = path.read_bytes()
    except OSError as error:
        raise ContractError(label, "could not read the selected file") from error
    from .adapters import decode_png_rgb

    try:
        width, height, _ = decode_png_rgb(data)
    except ContractError as error:
        raise ContractError(label, error.detail) from None
    return data, width, height


def _blur_study_report(args: argparse.Namespace) -> Dict[str, Any]:
    if not 0 <= args.strength <= 1:
        raise ContractError("strength", "must be between 0 and 1")
    if not 0 <= args.reach <= 1:
        raise ContractError("reach", "must be between 0 and 1")
    if not 8 <= args.size <= 1024:
        raise ContractError("size", "must be between 8 and 1024")
    image, width, height = _read_png(args.image, "image")
    mask, mask_width, mask_height = _read_png(args.mask, "mask")
    if (mask_width, mask_height) != (width, height):
        raise ContractError("mask", "dimensions must match the image")
    params = {
        "downscale": args.downscale,
        "reach": args.reach,
        "size": args.size,
        "strength": args.strength,
        "style": args.style,
    }
    study = {
        "engineId": "blur-v1",
        "engineCanonicalSha256": ENGINE_CONTRACTS["blur-v1"].canonical_sha256,
        "listedCredits": ENGINE_CONTRACTS["blur-v1"].credits_per_run,
        "image": {
            "filename": args.image.name,
            "sha256": sha256_bytes(image),
            "sizeBytes": len(image),
            "width": width,
            "height": height,
        },
        "mask": {
            "filename": args.mask.name,
            "sha256": sha256_bytes(mask),
            "sizeBytes": len(mask),
            "width": mask_width,
            "height": mask_height,
        },
        "params": params,
    }
    return {
        "schemaVersion": "quantum-box-blur-study-review-v1",
        "requestMode": "local-validation-no-network",
        "networkCalls": 0,
        "creditSpend": 0,
        "studySpec": study,
        "studySpecSha256": sha256_bytes(canonical_json(study).encode("utf-8")),
        "nextStep": (
            "Review this exact spec. It is not a submission receipt and cannot "
            "authorize a POST."
        ),
    }


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def _mock_png() -> bytes:
    width = height = 8
    rows = bytearray()
    for row in range(height):
        rows.append(0)
        for column in range(width):
            rows.extend(
                (
                    (row * 31 + column * 17) % 256,
                    (row * 13 + column * 47) % 256,
                    (row * 53 + column * 7) % 256,
                )
            )
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(
            b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
        )
        + _png_chunk(b"IDAT", zlib.compress(bytes(rows)))
        + _png_chunk(b"IEND", b"")
    )


def _write_immutable(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise ContractError(str(path), "content-addressed candidate changed bytes")
        return
    path.write_bytes(data)


def _read_json_object(path: Path, label: str) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError(label, "could not read a JSON object") from error
    if not isinstance(value, dict):
        raise ContractError(label, "must contain a JSON object")
    return value


def _mock_decisions(project_root: Path) -> Sequence[Dict[str, Any]]:
    qong = decode_qong_contract_mock(
        tuple(
            SequencedResult(
                "r{:02d}".format(index),
                canonical_json(
                    {"output": "heads" if index % 2 else "tails"}
                ).encode("utf-8"),
            )
            for index in range(1, 8)
        )
    )
    graph = evaluate_graph_result(
        canonical_json(
            {
                "output": {
                    "mode": "emu",
                    "dominant_bitstring": "0011",
                    "edge_agreement_score": 0.5,
                }
            }
        ).encode("utf-8")
    )
    quantman = evaluate_labyrinth_result(
        canonical_json(
            {
                "output": {
                    "results": {
                        "measurements": [
                            {"bitstring": "1010010110100101", "probability": 0.25}
                        ]
                    }
                }
            }
        ).encode("utf-8"),
        template_path=(
            project_root
            / "compiler/quantum_box_moth/fixtures/labyrinth-contract-mock-template.json"
        ),
        mock_normalization=LabyrinthMockNormalization(
            bit_order="leftmost-character-maps-to-q0",
            room_mapping="q0-maps-to-row-major-room-0",
            measurement_order="descending-probability",
            measurements_complete=True,
        ),
    )
    return (qong, graph, quantman)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "contracts":
        print(json.dumps(_contract_report(), indent=2, sort_keys=True))
        return 0
    if args.command == "inspect-blur":
        record = MothApiClient.from_env().engine("blur-v1")
        print(json.dumps(_blur_engine_report(record), indent=2, sort_keys=True))
        return 0
    if args.command == "inspect-qpixl":
        record = MothApiClient.from_env().engine("qpixl-v1")
        print(json.dumps(_qpixl_engine_report(record), indent=2, sort_keys=True))
        return 0
    if args.command == "inspect-coin":
        record = MothApiClient.from_env().engine("coin-toss-v1")
        print(json.dumps(coin_engine_report(record), indent=2, sort_keys=True))
        return 0
    if args.command == "prepare-qong-preflight":
        inspection = _read_json_object(args.inspection, "Coin Toss inspection")
        preflight = prepare_preflight(
            inspection, args.accept_live_record_sha256
        )
        immutable_json(args.output, preflight)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "preflightContentSha256": preflight["contentSha256"],
                    "expectedJobCount": preflight["plan"]["expectedJobCount"],
                    "maximumListedCredits": preflight["plan"][
                        "maximumListedCredits"
                    ],
                    "submissionAuthorized": False,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "assemble-qong-bank":
        preflight = _read_json_object(args.preflight, "Qong preflight")
        captures = load_capture_directory(args.captures)
        bank = assemble_bank(preflight, captures)
        immutable_json(args.output, bank)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "bankId": bank["bankId"],
                    "bankContentSha256": bank["contentSha256"],
                    "playPackCount": len(bank["playPacks"]),
                    "selectorBitCount": len(bank["selectorPack"]["bits"]),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "assemble-qong-blocked-bank":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        bank = assemble_blocked_browser_bank(
            preflight_value=preflight,
            cache_root=args.cache,
            selector_bit_count=args.selector_bit_count,
        )
        immutable_json(args.output, bank)
        completion = bank["selectorPack"]["qpuProvenance"][
            "selectorCompletion"
        ]
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "bankId": bank["bankId"],
                    "bankContentSha256": bank["contentSha256"],
                    "playPackCount": len(bank["playPacks"]),
                    "selectorBitCount": len(bank["selectorPack"]["bits"]),
                    "selectorCompletionContentSha256": completion[
                        "contentSha256"
                    ],
                    "ledgerPayloadSha256": completion[
                        "ledgerPayloadSha256"
                    ],
                    "ledgerByteSha256": completion["ledgerByteSha256"],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "inspect-qong-candidate-pool":
        preflight = _read_json_object(args.preflight, "Qong preflight")
        captures = load_first_rally_candidate_directory(args.captures)
        report = inspect_first_rally_candidates(preflight, captures)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "promote-qong-bank":
        preflight = _read_json_object(args.preflight, "Qong preflight")
        captures = load_capture_directory(args.captures)
        bank = assemble_bank(preflight, captures)
        promote_bank(args.output, bank, args.accept_bank_sha256)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "bankId": bank["bankId"],
                    "bankContentSha256": bank["contentSha256"],
                    "placeholderReplaced": True,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "promote-qong-blocked-bank":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        bank = assemble_blocked_browser_bank(
            preflight_value=preflight,
            cache_root=args.cache,
            selector_bit_count=args.selector_bit_count,
        )
        promote_bank(args.output, bank, args.accept_bank_sha256)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "bankId": bank["bankId"],
                    "bankContentSha256": bank["contentSha256"],
                    "selectorBitCount": len(bank["selectorPack"]["bits"]),
                    "placeholderReplaced": True,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "approve-qong-preflight":
        preflight = _read_json_object(args.preflight, "Qong preflight")
        try:
            note = args.note.read_bytes()
        except OSError as error:
            raise ContractError("approval note", "could not read the selected file") from error
        approval = create_approval(
            preflight,
            approved_at_utc=args.approved_at_utc,
            note=note,
        )
        immutable_json(args.output, approval)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "approvalContentSha256": approval["contentSha256"],
                    "preflightContentSha256": approval[
                        "preflightContentSha256"
                    ],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "acquire-qong-bank":
        preflight = _read_json_object(args.preflight, "Qong preflight")
        approval = _read_json_object(args.approval, "Qong approval")
        report = acquire_qong_bank(
            client=MothApiClient.from_env(),
            preflight_value=preflight,
            approval_value=approval,
            cache_root=args.cache,
            max_new_jobs=args.max_new_jobs,
            timeout_seconds=args.timeout_seconds,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "prepare-qong-browser-preflight":
        preflight = prepare_browser_preflight(
            contract_observed_at_utc=args.contract_observed_at_utc,
            authorized_at_utc=args.authorized_at_utc,
            authorization_note_sha256=args.authorization_note_sha256,
            backend_policy=args.backend_policy,
        )
        immutable_json(args.output, preflight)
        os.chmod(args.output.parent, 0o700)
        os.chmod(args.output, 0o600)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "output": str(args.output),
                    "preflightContentSha256": preflight["contentSha256"],
                    "expectedJobCount": preflight["plan"]["expectedJobCount"],
                    "accessBasis": preflight["access"]["basis"],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "reserve-qong-browser-item":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = reserve_next_browser_item(
            preflight_value=preflight,
            cache_root=args.cache,
            max_pending=args.max_pending,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "accept-qong-browser-job":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = accept_browser_job(
            preflight_value=preflight,
            cache_root=args.cache,
            item_id=args.item_id,
            job_id=args.job_id,
            accepted_observed_at_utc=args.observed_at_utc,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "capture-qong-browser-status":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        if args.status_base64 is None:
            raw_status = sys.stdin.buffer.read()
        else:
            try:
                raw_status = base64.b64decode(
                    args.status_base64.encode("ascii"), validate=True
                )
            except (UnicodeEncodeError, ValueError, binascii.Error) as error:
                raise ContractError(
                    "browser status base64", "must be canonical base64"
                ) from error
        if not raw_status:
            raise ContractError("browser status stdin", "must not be empty")
        report = capture_completed_browser_status(
            preflight_value=preflight,
            cache_root=args.cache,
            item_id=args.item_id,
            terminal_observed_at_utc=args.observed_at_utc,
            raw_status=raw_status,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "capture-qong-browser-failure":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        if args.status_base64 is None:
            raw_status = sys.stdin.buffer.read()
        else:
            try:
                raw_status = base64.b64decode(
                    args.status_base64.encode("ascii"), validate=True
                )
            except (UnicodeEncodeError, ValueError, binascii.Error) as error:
                raise ContractError(
                    "browser failure status base64", "must be canonical base64"
                ) from error
        if not raw_status:
            raise ContractError("browser failure status stdin", "must not be empty")
        report = capture_failed_browser_status(
            preflight_value=preflight,
            cache_root=args.cache,
            item_id=args.item_id,
            terminal_observed_at_utc=args.observed_at_utc,
            raw_status=raw_status,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "retry-qong-browser-item":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = retry_failed_browser_item(
            preflight_value=preflight,
            cache_root=args.cache,
            item_id=args.item_id,
            retry_authorized_at_utc=args.authorized_at_utc,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "report-qong-browser-acquisition":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = browser_acquisition_report(
            preflight_value=preflight, cache_root=args.cache
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "adopt-qong-browser-reservation":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = adopt_prior_browser_reservation(
            preflight_value=preflight,
            cache_root=args.cache,
            item_id=args.item_id,
            reserved_at_utc=args.reserved_at_utc,
            reservation_receipt_sha256=args.reservation_receipt_sha256,
            adopted_at_utc=args.adopted_at_utc,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "import-qong-browser-capture":
        preflight = _read_json_object(args.preflight, "Qong browser preflight")
        report = import_prior_browser_capture(
            preflight_value=preflight,
            cache_root=args.cache,
            source_preflight_sha256=args.source_preflight_sha256,
            item_id=args.item_id,
            imported_at_utc=args.imported_at_utc,
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    if args.command == "prepare-qpixl-study":
        from .generate_qpixl_study import generate

        manifest = generate(args.output)
        print(
            json.dumps(
                {
                    "networkCalls": 0,
                    "creditsSpent": 0,
                    "output": str(args.output),
                    "manifest": manifest,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    if args.command == "prepare-blur-study":
        print(json.dumps(_blur_study_report(args), indent=2, sort_keys=True))
        return 0
    if args.command == "mock-candidates":
        project_root = Path(__file__).resolve().parents[2]
        output: Path = args.output
        report = []
        for decision in _mock_decisions(project_root):
            decision_bytes = (canonical_json(decision) + "\n").encode("utf-8")
            decision_hash = sha256_bytes(decision_bytes)
            decision_path = output / "{}-decision-{}.json".format(
                decision["engineId"], decision_hash[:12]
            )
            _write_immutable(decision_path, decision_bytes)
            candidate_path = None
            if decision["candidate"] is not None:
                pack_bytes = candidate_bytes(decision)
                pack_hash = sha256_bytes(pack_bytes)
                candidate_path = output / "{}-candidate-{}.json".format(
                    decision["engineId"], pack_hash[:12]
                )
                _write_immutable(candidate_path, pack_bytes)
            report.append(
                {
                    "engineId": decision["engineId"],
                    "status": decision["status"],
                    "decisionPath": str(decision_path),
                    "candidatePath": (
                        str(candidate_path) if candidate_path is not None else None
                    ),
                }
            )
        print(json.dumps({"networkCalls": 0, "outputs": report}, indent=2))
        return 0
    return 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ContractError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
