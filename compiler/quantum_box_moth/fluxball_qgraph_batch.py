"""Submit the approved Fluxball QGraph QPU bank once, with resumable receipts."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

from .canonical import canonical_bytes, sha256_bytes, sha256_json
from .client import ALLOWED_ORIGIN, MothApiClient
from .models import (
    AmbiguousMutationError,
    ContractError,
    EngineContract,
    INTERMEDIATE_STATUSES,
    MothApiError,
    MutationApproval,
    ResultGoneError,
    ResultNotReadyError,
    TERMINAL_STATUSES,
)


ENGINE_ID = "graph-v1"
BANK_ID = "fluxball-qgraph-qpu-bank-v2"
SHOTS = 4096
ACQUISITION_RELATIVE = Path(
    "compiler/quantum_box_moth/acquisitions/fluxball-qgraph-qpu-bank-v2"
)
CAPTURE_SCHEMA_VERSION = "fluxball-qgraph-qpu-capture-v1"
COLLECTION_STATE_SCHEMA_VERSION = "fluxball-qgraph-collection-state-v1"
EQUAL = {"XX": 1.0, "YY": -1.0, "ZZ": 1.0}
OPPOSED = {"XX": 1.0, "YY": 1.0, "ZZ": -1.0}
RELATIONSHIPS = {"equal": EQUAL, "opposed": OPPOSED}
PAIRINGS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("ab-cd", ("A", "B", "C", "D")),
    ("ac-bd", ("A", "C", "B", "D")),
    ("ad-bc", ("A", "D", "B", "C")),
)
EXISTING_JOBS = {
    "2p-equal-r1": "5993500c-b459-465f-8480-2d7191343e56",
    "4p-ab-cd-equal-equal-r1": "ea99a27a-3d00-4b66-b335-ce2f97293478",
}


@dataclass(frozen=True)
class Target:
    target_id: str
    competitor_count: int
    replicate: int
    player_order: Tuple[str, ...]
    relationships: Tuple[str, ...]
    existing_job_id: str | None = None


def build_targets() -> Tuple[Target, ...]:
    targets: List[Target] = []
    for relationship in ("equal", "opposed"):
        for replicate in range(1, 9):
            target_id = f"2p-{relationship}-r{replicate}"
            targets.append(
                Target(
                    target_id,
                    2,
                    replicate,
                    ("A", "B"),
                    (relationship,),
                    EXISTING_JOBS.get(target_id),
                )
            )
    for pairing, player_order in PAIRINGS:
        for first in ("equal", "opposed"):
            for second in ("equal", "opposed"):
                for replicate in (1, 2):
                    target_id = f"4p-{pairing}-{first}-{second}-r{replicate}"
                    targets.append(
                        Target(
                            target_id,
                            4,
                            replicate,
                            player_order,
                            (first, second),
                            EXISTING_JOBS.get(target_id),
                        )
                    )
    if len(targets) != 40 or len({target.target_id for target in targets}) != 40:
        raise AssertionError("Fluxball acquisition target matrix is incomplete")
    return tuple(targets)


def request_body(
    target: Target, qpu_token: str, qpu_instance: str
) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "num_qubits": target.competitor_count,
        "coupling_map": [[0, 1]]
        if target.competitor_count == 2
        else [[0, 1], [2, 3]],
        "operations": [],
        "shots": SHOTS,
        "mode": "qpu",
        "backend_name": "ibm_fez",
        "qpu_token": qpu_token,
        "qpu_instance": qpu_instance,
    }
    pairs = ((0, 1),) if target.competitor_count == 2 else ((0, 1), (2, 3))
    for pair, relationship in zip(pairs, target.relationships):
        params["operations"].append(
            {
                "type": "relationship",
                "qubits": list(pair),
                "paulis": dict(RELATIONSHIPS[relationship]),
                "update": True,
            }
        )
    return {"params": params}


def redacted_request(target: Target) -> Dict[str, Any]:
    body = request_body(target, "[REDACTED]", "[REDACTED]")
    body["params"].pop("qpu_token")
    body["params"].pop("qpu_instance")
    return body


def manifest(targets: Sequence[Target]) -> Dict[str, Any]:
    return {
        "schemaVersion": "fluxball-qgraph-acquisition-manifest-v1",
        "bankId": BANK_ID,
        "engineId": ENGINE_ID,
        "shotsPerJob": SHOTS,
        "targetCount": len(targets),
        "alreadyAcquiredCount": sum(
            target.existing_job_id is not None for target in targets
        ),
        "remainingSubmissionCount": sum(
            target.existing_job_id is None for target in targets
        ),
        "targets": [
            {
                "targetId": target.target_id,
                "competitorCount": target.competitor_count,
                "replicate": target.replicate,
                "playerOrder": list(target.player_order),
                "relationships": list(target.relationships),
                "redactedRequest": redacted_request(target),
                "redactedRequestSha256": sha256_json(redacted_request(target)),
                "existingMothJobId": target.existing_job_id,
            }
            for target in targets
        ],
    }


def submit_batch(delay_seconds: float) -> int:
    secrets = _required_secrets()
    targets = build_targets()
    root = Path(__file__).resolve().parents[2]
    acquisition_dir = root / ACQUISITION_RELATIVE
    acquisition_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = acquisition_dir / "manifest-v1.json"
    state_path = acquisition_dir / "submission-state-v1.json"
    events_path = acquisition_dir / "submission-events-v1.jsonl"
    expected_manifest = manifest(targets)
    _write_or_verify_manifest(manifest_path, expected_manifest)
    state = _load_state(state_path, targets)
    in_flight = state.get("inFlight")
    if in_flight is not None:
        target_id = (
            in_flight.get("targetId")
            if isinstance(in_flight, dict)
            else "unknown"
        )
        raise ContractError(
            "submission state",
            f"contains unresolved POST attempt {target_id}; reconcile it before resuming",
        )

    client = MothApiClient(ALLOWED_ORIGIN, secrets["MOTH_API_KEY"])
    live_record = client.engine(ENGINE_ID)
    engine = _validate_live_engine(live_record)

    pending = [
        target
        for target in targets
        if target.existing_job_id is None
        and target.target_id not in state["submittedJobs"]
    ]
    if not pending:
        print("Fluxball QGraph bank submission is already complete.")
        return 0

    print(
        f"Submitting {len(pending)} missing {ENGINE_ID} QPU jobs sequentially; "
        "POST requests are never retried."
    )
    for index, target in enumerate(pending, start=1):
        body = request_body(
            target,
            secrets["IBM_QPU_TOKEN"],
            secrets["IBM_QPU_INSTANCE"],
        )
        approval = MutationApproval(
            engine_id=ENGINE_ID,
            engine_canonical_sha256=engine.canonical_sha256,
            request_sha256=sha256_json(body),
            listed_credits=engine.credits_per_run,
            approved_at_utc=_utc_now(),
            approval_note_sha256=sha256_bytes(
                b"Doug authorized the Fluxball QGraph QPU bank batch."
            ),
        )
        print(f"[{index}/{len(pending)}] {target.target_id}")
        state["inFlight"] = {
            "targetId": target.target_id,
            "attemptedAtUtc": _utc_now(),
            "redactedRequestSha256": sha256_json(redacted_request(target)),
        }
        state["updatedAtUtc"] = _utc_now()
        _write_json_atomic(state_path, state, mode=0o600)
        _append_event(
            events_path,
            {"event": "submission-attempted", **state["inFlight"]},
        )
        try:
            submitted = client.submit(engine, body, approval)
        except AmbiguousMutationError as error:
            safe_error = _redact(str(error), secrets.values())
            _append_event(
                events_path,
                {
                    "event": "submission-stopped",
                    "targetId": target.target_id,
                    "observedAtUtc": _utc_now(),
                    "error": safe_error,
                },
            )
            print(f"Stopped safely at {target.target_id}: {safe_error}")
            return 1
        except (MothApiError, ContractError) as error:
            # Malformed accepted responses and server failures are converted to
            # AmbiguousMutationError by the client. Remaining failures occurred
            # before mutation or are definite client rejections.
            state["inFlight"] = None
            state["updatedAtUtc"] = _utc_now()
            _write_json_atomic(state_path, state, mode=0o600)
            safe_error = _redact(str(error), secrets.values())
            _append_event(
                events_path,
                {
                    "event": "submission-rejected",
                    "targetId": target.target_id,
                    "observedAtUtc": _utc_now(),
                    "error": safe_error,
                },
            )
            print(f"Rejected at {target.target_id}: {safe_error}")
            return 1
        receipt = {
            "targetId": target.target_id,
            "mothJobId": submitted.job_id,
            "status": submitted.status,
            "submittedAt": submitted.submitted_at,
            "redactedRequestSha256": sha256_json(redacted_request(target)),
        }
        state["submittedJobs"][target.target_id] = receipt
        state["inFlight"] = None
        state["updatedAtUtc"] = _utc_now()
        _write_json_atomic(state_path, state, mode=0o600)
        _append_event(events_path, {"event": "submitted", **receipt})
        print(f"  queued as {submitted.job_id}")
        if index < len(pending):
            time.sleep(delay_seconds)

    print(
        f"Submitted {len(pending)} jobs. Durable receipts: "
        f"{state_path.relative_to(root)}"
    )
    return 0


def collect_available(delay_seconds: float) -> int:
    """Run one resumable safe-GET sweep over every submitted job."""

    api_key = os.environ.get("MOTH_API_KEY", "")
    if not api_key:
        raise ContractError(
            "environment", "missing MOTH_API_KEY; IBM credentials are not required"
        )
    targets = build_targets()
    target_by_id = {target.target_id: target for target in targets}
    root = Path(__file__).resolve().parents[2]
    acquisition_dir = root / ACQUISITION_RELATIVE
    submission_path = acquisition_dir / "submission-state-v1.json"
    collection_path = acquisition_dir / "collection-state-v1.json"
    events_path = acquisition_dir / "collection-events-v1.jsonl"
    captures_dir = acquisition_dir / "captures-v1"
    if not submission_path.exists():
        raise ContractError("submission state", "is missing")
    submission = json.loads(submission_path.read_text(encoding="utf-8"))
    if submission.get("bankId") != BANK_ID:
        raise ContractError("submission state", "belongs to a different bank")
    if submission.get("inFlight") is not None:
        raise ContractError(
            "submission state", "contains an unresolved POST attempt"
        )
    submitted_jobs = submission.get("submittedJobs")
    if not isinstance(submitted_jobs, dict):
        raise ContractError("submission state.submittedJobs", "is invalid")
    missing = sorted(set(target_by_id).difference(submitted_jobs))
    unexpected = sorted(set(submitted_jobs).difference(target_by_id))
    if missing or unexpected:
        raise ContractError(
            "submission state.submittedJobs",
            "does not match the 40-target manifest",
        )

    captures_dir.mkdir(parents=True, exist_ok=True)
    state = _load_collection_state(collection_path)
    client = MothApiClient(ALLOWED_ORIGIN, api_key)
    captured_now = 0
    pending = 0
    terminal_failures = 0
    safe_get_failures = 0

    for index, target in enumerate(targets, start=1):
        receipt = submitted_jobs[target.target_id]
        if not isinstance(receipt, dict):
            raise ContractError(
                f"submission state.{target.target_id}", "receipt is invalid"
            )
        job_id = receipt.get("mothJobId")
        if not isinstance(job_id, str) or not job_id:
            raise ContractError(
                f"submission state.{target.target_id}.mothJobId", "is missing"
            )
        existing_capture = state["jobs"].get(target.target_id)
        if (
            isinstance(existing_capture, dict)
            and existing_capture.get("state") == "captured"
        ):
            continue
        print(f"[{index}/{len(targets)}] {target.target_id}")
        try:
            snapshot = client.status(job_id)
            if snapshot.engine_id != ENGINE_ID:
                raise ContractError(
                    f"status.{target.target_id}.engine_id", "is not graph-v1"
                )
            expected_submitted_at = receipt.get("submittedAt")
            if (
                isinstance(expected_submitted_at, str)
                and snapshot.submitted_at != expected_submitted_at
            ):
                raise ContractError(
                    f"status.{target.target_id}.submitted_at",
                    "does not match the durable submission receipt",
                )
            if (
                snapshot.status not in INTERMEDIATE_STATUSES
                and snapshot.status not in TERMINAL_STATUSES
            ):
                raise ContractError(
                    f"status.{target.target_id}.status",
                    f"unsupported value {snapshot.status!r}",
                )
            observation = {
                "targetId": target.target_id,
                "mothJobId": job_id,
                "state": snapshot.status,
                "providerUpdatedAt": snapshot.updated_at,
                "observedAtUtc": _utc_now(),
                "terminalStatusSha256": sha256_json(snapshot.raw),
            }
            if snapshot.status in INTERMEDIATE_STATUSES:
                state["jobs"][target.target_id] = observation
                pending += 1
                print(f"  {snapshot.status}")
            elif snapshot.status in ("failed", "cancelled"):
                state["jobs"][target.target_id] = observation
                terminal_failures += 1
                print(f"  {snapshot.status}")
            else:
                try:
                    result = client.result(job_id)
                except ResultNotReadyError:
                    observation["state"] = "completed-result-not-ready"
                    state["jobs"][target.target_id] = observation
                    pending += 1
                    print("  completed; result not ready")
                except ResultGoneError:
                    observation["state"] = "result-gone"
                    state["jobs"][target.target_id] = observation
                    terminal_failures += 1
                    print("  completed; result gone")
                else:
                    capture = build_capture(
                        target=target,
                        moth_job_id=job_id,
                        submitted_at=snapshot.submitted_at,
                        provider_updated_at=snapshot.updated_at,
                        terminal_status_sha256=sha256_json(snapshot.raw),
                        terminal_observed_at=_utc_now(),
                        retrieved_at=_utc_now(),
                        raw_result=result.raw_bytes,
                    )
                    if capture["rawResultSha256"] != result.raw_sha256:
                        raise ContractError(
                            f"result.{target.target_id}",
                            "client and capture result hashes disagree",
                        )
                    capture_path = captures_dir / f"{target.target_id}.json"
                    _write_json_atomic(capture_path, capture, mode=0o600)
                    state["jobs"][target.target_id] = {
                        **observation,
                        "state": "captured",
                        "capturePath": str(capture_path.relative_to(root)),
                        "captureContentSha256": capture["contentSha256"],
                        "rawResultSha256": capture["rawResultSha256"],
                    }
                    captured_now += 1
                    print("  captured")
            _append_event(events_path, state["jobs"][target.target_id])
        except (MothApiError, ContractError) as error:
            safe_error = _redact(str(error), (api_key,))
            state["jobs"][target.target_id] = {
                "targetId": target.target_id,
                "mothJobId": job_id,
                "state": "safe-get-failure",
                "observedAtUtc": _utc_now(),
                "safeError": safe_error,
            }
            _append_event(events_path, state["jobs"][target.target_id])
            safe_get_failures += 1
            print(f"  safe GET failed: {safe_error}")
            if isinstance(error, MothApiError) and error.status == 429:
                break
        finally:
            state["updatedAtUtc"] = _utc_now()
            _write_json_atomic(collection_path, state, mode=0o600)
        if index < len(targets) and delay_seconds:
            time.sleep(delay_seconds)

    counts = _collection_counts(state)
    print(
        "Collection sweep complete: "
        f"{captured_now} newly captured, {counts.get('captured', 0)} total captured, "
        f"{pending} pending in this sweep, {terminal_failures} terminal failures, "
        f"{safe_get_failures} safe-GET failures."
    )
    return 0 if terminal_failures == 0 and safe_get_failures == 0 else 1


def build_capture(
    *,
    target: Target,
    moth_job_id: str,
    submitted_at: str,
    provider_updated_at: str,
    terminal_status_sha256: str,
    terminal_observed_at: str,
    retrieved_at: str,
    raw_result: bytes,
) -> Dict[str, Any]:
    normalized = normalize_qgraph_result(raw_result, target)
    material = {
        "schemaVersion": CAPTURE_SCHEMA_VERSION,
        "bankId": BANK_ID,
        "targetId": target.target_id,
        "competitorCount": target.competitor_count,
        "replicate": target.replicate,
        "playerOrder": list(target.player_order),
        "relationships": list(target.relationships),
        "mothJobId": moth_job_id,
        "ibmJobId": normalized["ibm_job_id"],
        "submittedAt": submitted_at,
        "providerUpdatedAt": provider_updated_at,
        "terminalObservedAt": terminal_observed_at,
        "retrievedAt": retrieved_at,
        "terminalStatusSha256": terminal_status_sha256,
        "rawResultSha256": sha256_bytes(raw_result),
        "result": normalized,
        "claimBoundary": (
            "This is a completed Moth graph-v1 IBM Fez result acquired before "
            "play. Fluxball samples the stored computational-basis distribution "
            "classically and makes no network call during active play."
        ),
    }
    return {**material, "contentSha256": sha256_json(material)}


def normalize_qgraph_result(raw_result: bytes, target: Target) -> Dict[str, Any]:
    try:
        wrapper = json.loads(raw_result.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ContractError("QGraph result", "must be UTF-8 JSON") from error
    if not isinstance(wrapper, dict):
        raise ContractError("QGraph result", "must be a JSON object")
    output = wrapper.get("output", wrapper)
    if not isinstance(output, dict):
        raise ContractError("QGraph result.output", "must be an object")
    if output.get("mode") != "qpu":
        raise ContractError("QGraph result.mode", "must be qpu")
    if output.get("backend") != "ibm_fez":
        raise ContractError("QGraph result.backend", "must be ibm_fez")
    if output.get("num_qubits") != target.competitor_count:
        raise ContractError(
            "QGraph result.num_qubits", "does not match competitor count"
        )
    shots = output.get("shots")
    allowed_shots = (
        {1024, SHOTS}
        if target.target_id == "2p-equal-r1"
        else {SHOTS}
    )
    if not isinstance(shots, int) or isinstance(shots, bool) or shots not in allowed_shots:
        raise ContractError(
            "QGraph result.shots",
            "does not match the acquired target",
        )
    expected_coupling = (
        [[0, 1]]
        if target.competitor_count == 2
        else [[0, 1], [2, 3]]
    )
    if output.get("coupling_map") != expected_coupling:
        raise ContractError(
            "QGraph result.coupling_map", "does not match the target"
        )
    ibm_job_id = output.get("ibm_job_id")
    if not isinstance(ibm_job_id, str) or not ibm_job_id:
        raise ContractError("QGraph result.ibm_job_id", "is missing")
    measurements = output.get("measurements")
    if not isinstance(measurements, list) or not measurements:
        raise ContractError("QGraph result.measurements", "must be non-empty")
    observed_bitstrings = set()
    normalized_measurements = []
    total = 0
    for index, measurement in enumerate(measurements):
        if not isinstance(measurement, dict):
            raise ContractError(
                f"QGraph result.measurements[{index}]", "must be an object"
            )
        bitstring = measurement.get("bitstring")
        count = measurement.get("count")
        probability = measurement.get("probability")
        if (
            not isinstance(bitstring, str)
            or len(bitstring) != target.competitor_count
            or any(bit not in "01" for bit in bitstring)
        ):
            raise ContractError(
                f"QGraph result.measurements[{index}].bitstring", "is invalid"
            )
        if bitstring in observed_bitstrings:
            raise ContractError(
                "QGraph result.measurements", "contains a duplicate bitstring"
            )
        if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
            raise ContractError(
                f"QGraph result.measurements[{index}].count", "is invalid"
            )
        if (
            not isinstance(probability, (int, float))
            or isinstance(probability, bool)
            or abs(float(probability) - count / shots) > 1e-12
        ):
            raise ContractError(
                f"QGraph result.measurements[{index}].probability",
                "does not equal count divided by shots",
            )
        observed_bitstrings.add(bitstring)
        total += count
        normalized_measurements.append(
            {
                "bitstring": bitstring,
                "count": count,
                "probability": float(probability),
            }
        )
    if total != shots:
        raise ContractError(
            "QGraph result.measurements", "counts do not sum to shots"
        )
    dominant = output.get("dominant_bitstring")
    maximum_count = max(item["count"] for item in normalized_measurements)
    if dominant not in {
        item["bitstring"]
        for item in normalized_measurements
        if item["count"] == maximum_count
    }:
        raise ContractError(
            "QGraph result.dominant_bitstring", "is not a maximum-count outcome"
        )
    tomography = output.get("tomography")
    if not isinstance(tomography, dict):
        raise ContractError("QGraph result.tomography", "must be an object")
    return {
        "backend": "ibm_fez",
        "coupling_map": expected_coupling,
        "dominant_bitstring": dominant,
        "edge_agreement_score": output.get("edge_agreement_score"),
        "ibm_job_id": ibm_job_id,
        "measurements": normalized_measurements,
        "mode": "qpu",
        "num_qubits": target.competitor_count,
        "seed": output.get("seed"),
        "shots": shots,
        "tomography": tomography,
    }


def _required_secrets() -> Dict[str, str]:
    values = {
        key: os.environ.get(key, "")
        for key in ("MOTH_API_KEY", "IBM_QPU_TOKEN", "IBM_QPU_INSTANCE")
    }
    missing = [key for key, value in values.items() if not value]
    if missing:
        raise ContractError("environment", "missing " + ", ".join(missing))
    return values


def _validate_live_engine(record: Mapping[str, Any]) -> EngineContract:
    if record.get("engine_id") != ENGINE_ID:
        raise ContractError("engine.engine_id", "does not match graph-v1")
    params = record.get("params")
    if not isinstance(params, dict):
        schema = record.get("params_schema")
        params = schema.get("properties") if isinstance(schema, dict) else None
    if not isinstance(params, dict):
        raise ContractError("engine params", "live parameter schema is unavailable")
    required = {
        "num_qubits",
        "coupling_map",
        "operations",
        "shots",
        "mode",
        "backend_name",
    }
    missing = sorted(required.difference(params))
    if missing:
        raise ContractError(
            "engine params", "missing required fields: " + ", ".join(missing)
        )
    mode = params.get("mode")
    if isinstance(mode, dict) and isinstance(mode.get("enum"), list):
        if "qpu" not in mode["enum"]:
            raise ContractError("engine params.mode", "does not accept qpu")
    shots = params.get("shots")
    if isinstance(shots, dict) and isinstance(shots.get("maximum"), int):
        if shots["maximum"] < SHOTS:
            raise ContractError("engine params.shots", "maximum is below 4096")
    credits = record.get("credits_per_run")
    if not isinstance(credits, int) or credits < 0:
        raise ContractError("engine.credits_per_run", "is unavailable")
    updated_at = record.get("updated_at")
    output_type = record.get("output_type")
    if not isinstance(updated_at, str) or not updated_at:
        raise ContractError("engine.updated_at", "is unavailable")
    if not isinstance(output_type, str) or not output_type:
        raise ContractError("engine.output_type", "is unavailable")
    digest = sha256_json(dict(record))
    return EngineContract(
        engine_id=ENGINE_ID,
        canonical_sha256=digest,
        redacted_sha256=digest,
        updated_at=updated_at,
        credits_per_run=credits,
        input_slots=(),
        output_type=output_type,
        result_contract_state="live-successor-to-proven-qpu-contract",
        unresolved_gaps=(
            "Bit ordering remains a consumer convention pending formal contract evidence.",
        ),
    )


def _load_state(path: Path, targets: Sequence[Target]) -> Dict[str, Any]:
    if path.exists():
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict) or value.get("bankId") != BANK_ID:
            raise ContractError("submission state", "is invalid or belongs elsewhere")
        jobs = value.get("submittedJobs")
        if not isinstance(jobs, dict):
            raise ContractError("submission state", "submittedJobs is invalid")
        return value
    existing = {
        target.target_id: {
            "targetId": target.target_id,
            "mothJobId": target.existing_job_id,
            "status": "completed-before-batch",
        }
        for target in targets
        if target.existing_job_id is not None
    }
    state = {
        "schemaVersion": "fluxball-qgraph-submission-state-v1",
        "bankId": BANK_ID,
        "createdAtUtc": _utc_now(),
        "updatedAtUtc": _utc_now(),
        "inFlight": None,
        "submittedJobs": existing,
    }
    _write_json_atomic(path, state, mode=0o600)
    return state


def _load_collection_state(path: Path) -> Dict[str, Any]:
    if path.exists():
        value = json.loads(path.read_text(encoding="utf-8"))
        if (
            not isinstance(value, dict)
            or value.get("schemaVersion") != COLLECTION_STATE_SCHEMA_VERSION
            or value.get("bankId") != BANK_ID
            or not isinstance(value.get("jobs"), dict)
        ):
            raise ContractError("collection state", "is invalid or belongs elsewhere")
        return value
    state = {
        "schemaVersion": COLLECTION_STATE_SCHEMA_VERSION,
        "bankId": BANK_ID,
        "createdAtUtc": _utc_now(),
        "updatedAtUtc": _utc_now(),
        "jobs": {},
    }
    _write_json_atomic(path, state, mode=0o600)
    return state


def _collection_counts(state: Mapping[str, Any]) -> Dict[str, int]:
    jobs = state.get("jobs")
    if not isinstance(jobs, dict):
        return {}
    counts: Dict[str, int] = {}
    for value in jobs.values():
        key = value.get("state") if isinstance(value, dict) else "invalid"
        rendered = key if isinstance(key, str) else "invalid"
        counts[rendered] = counts.get(rendered, 0) + 1
    return counts


def _write_or_verify_manifest(path: Path, expected: Dict[str, Any]) -> None:
    if path.exists():
        observed = json.loads(path.read_text(encoding="utf-8"))
        if observed != expected:
            raise ContractError("manifest", "existing manifest does not match code")
        return
    _write_json_atomic(path, expected, mode=0o644)


def _write_json_atomic(path: Path, value: Dict[str, Any], mode: int) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(canonical_bytes(value) + b"\n")
    os.chmod(temporary, mode)
    os.replace(temporary, path)


def _append_event(path: Path, event: Dict[str, Any]) -> None:
    with path.open("ab") as handle:
        handle.write(canonical_bytes(event) + b"\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path, 0o600)


def _redact(value: str, secrets: Iterable[str]) -> str:
    safe = value
    for secret in secrets:
        if secret:
            safe = safe.replace(secret, "[REDACTED]")
    return safe[:2000]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("submit", "collect"))
    parser.add_argument("--execute-authorized-batch", action="store_true")
    parser.add_argument("--collect-available", action="store_true")
    parser.add_argument("--delay-seconds", type=float, default=3.0)
    args = parser.parse_args(argv)
    if args.delay_seconds < 0:
        parser.error("--delay-seconds must be non-negative")
    try:
        if args.command == "submit":
            if not args.execute_authorized_batch:
                parser.error("submission requires --execute-authorized-batch")
            if args.collect_available:
                parser.error("--collect-available is only valid with collect")
            return submit_batch(args.delay_seconds)
        if not args.collect_available:
            parser.error("collection requires --collect-available")
        if args.execute_authorized_batch:
            parser.error("--execute-authorized-batch is only valid with submit")
        return collect_available(args.delay_seconds)
    except (ContractError, MothApiError) as error:
        secrets = [
            os.environ.get(key, "")
            for key in ("MOTH_API_KEY", "IBM_QPU_TOKEN", "IBM_QPU_INSTANCE")
        ]
        print(_redact(str(error), secrets))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
