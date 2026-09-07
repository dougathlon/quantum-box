"""Resumable, one-POST-per-item acquisition for an approved Qong preflight."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Dict, Mapping, Optional

from .canonical import canonical_json, sha256_bytes, sha256_json
from .client import MothApiClient
from .models import (
    AmbiguousMutationError,
    ContractError,
    EngineContract,
    MothApiError,
    MutationApproval,
)
from .polling import poll_job
from .qong_bank import (
    EXPECTED_JOB_COUNT,
    REQUEST_BODY,
    REQUEST_SHA256,
    capture_from_result,
    planned_items,
    validate_capture,
    validate_preflight,
)


APPROVAL_SCHEMA_VERSION = "quantum-box-qong-preflight-approval-v1"
LEDGER_SCHEMA_VERSION = "quantum-box-qong-acquisition-ledger-v1"
APPROVAL_FIELDS = frozenset(
    (
        "schemaVersion",
        "preflightContentSha256",
        "engineId",
        "engineCanonicalSha256",
        "requestSha256",
        "expectedJobCount",
        "maximumListedCredits",
        "approvedAtUtc",
        "approvalNoteSha256",
        "scope",
        "contentSha256",
    )
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_utc(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ContractError(label, "must be an ISO UTC time")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractError(label, "must be an ISO UTC time") from error
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise ContractError(label, "must use the UTC Z designator")
    return value


def require_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) != 64:
        raise ContractError(label, "must be a lowercase SHA-256")
    try:
        decoded = bytes.fromhex(value)
    except ValueError as error:
        raise ContractError(label, "must be a lowercase SHA-256") from error
    if len(decoded) != 32 or value != value.lower():
        raise ContractError(label, "must be a lowercase SHA-256")
    return value


def create_approval(
    preflight_value: Mapping[str, Any], *, approved_at_utc: str, note: bytes
) -> Dict[str, Any]:
    preflight = validate_preflight(preflight_value)
    require_utc(approved_at_utc, "approval.approvedAtUtc")
    if not note.strip():
        raise ContractError("approval note", "must not be empty")
    material = {
        "schemaVersion": APPROVAL_SCHEMA_VERSION,
        "preflightContentSha256": preflight["contentSha256"],
        "engineId": "coin-toss-v1",
        "engineCanonicalSha256": preflight["engine"][
            "canonicalEngineRecordSha256"
        ],
        "requestSha256": REQUEST_SHA256,
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "maximumListedCredits": preflight["plan"]["maximumListedCredits"],
        "approvedAtUtc": approved_at_utc,
        "approvalNoteSha256": sha256_bytes(note),
        "scope": "submit each exact preflight item at most once; poll and collect only",
    }
    return {**material, "contentSha256": sha256_json(material)}


def validate_approval(
    value: Mapping[str, Any], preflight_value: Mapping[str, Any]
) -> Dict[str, Any]:
    preflight = validate_preflight(preflight_value)
    if value.get("schemaVersion") != APPROVAL_SCHEMA_VERSION:
        raise ContractError("approval", "has an unknown schema")
    if set(value) != APPROVAL_FIELDS:
        raise ContractError("approval", "contains absent or unexpected fields")
    material = {key: item for key, item in value.items() if key != "contentSha256"}
    if value.get("contentSha256") != sha256_json(material):
        raise ContractError("approval.contentSha256", "does not match the approval")
    expected = {
        "preflightContentSha256": preflight["contentSha256"],
        "engineId": "coin-toss-v1",
        "engineCanonicalSha256": preflight["engine"][
            "canonicalEngineRecordSha256"
        ],
        "requestSha256": REQUEST_SHA256,
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "maximumListedCredits": preflight["plan"]["maximumListedCredits"],
    }
    for key, expected_value in expected.items():
        if value.get(key) != expected_value:
            raise ContractError("approval.{}".format(key), "does not match preflight")
    require_utc(value.get("approvedAtUtc"), "approval.approvedAtUtc")
    require_sha256(
        value.get("approvalNoteSha256"), "approval.approvalNoteSha256"
    )
    if value.get("scope") != (
        "submit each exact preflight item at most once; poll and collect only"
    ):
        raise ContractError("approval.scope", "does not match the bounded scope")
    return dict(value)


class QongAcquisitionLedger:
    def __init__(self, root: Path, preflight_sha256: str) -> None:
        self.root = root / preflight_sha256
        self.path = self.root / "ledger.json"
        self.capture_dir = self.root / "captures"

    def prepare(self) -> None:
        self.capture_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)
        os.chmod(self.capture_dir, 0o700)

    def read(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"attempts": {}}
        try:
            envelope = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(self.path), "is unreadable") from error
        if (
            not isinstance(envelope, dict)
            or envelope.get("schemaVersion") != LEDGER_SCHEMA_VERSION
            or not isinstance(envelope.get("payload"), dict)
            or envelope.get("payloadSha256") != sha256_json(envelope["payload"])
        ):
            raise ContractError(str(self.path), "has an invalid envelope")
        payload = envelope["payload"]
        if set(payload) != {"attempts"} or not isinstance(payload["attempts"], dict):
            raise ContractError(str(self.path), "has invalid payload fields")
        return payload

    def save(self, payload: Dict[str, Any]) -> None:
        self.prepare()
        envelope = {
            "schemaVersion": LEDGER_SCHEMA_VERSION,
            "payload": payload,
            "payloadSha256": sha256_json(payload),
        }
        data = (canonical_json(envelope) + "\n").encode("utf-8")
        descriptor, temporary = tempfile.mkstemp(
            prefix="ledger.", dir=str(self.root)
        )
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
            os.chmod(self.path, 0o600)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def update(self, item_id: str, **change: Any) -> Dict[str, Any]:
        payload = self.read()
        attempt = payload["attempts"].setdefault(item_id, {})
        if not isinstance(attempt, dict):
            raise ContractError("ledger.{}".format(item_id), "must be an object")
        attempt.update(change)
        self.save(payload)
        return attempt

    def write_capture(self, item_id: str, capture: Mapping[str, Any]) -> Path:
        self.prepare()
        path = self.capture_dir / "{}.json".format(item_id)
        data = (canonical_json(dict(capture)) + "\n").encode("utf-8")
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            if path.read_bytes() != data:
                raise ContractError(str(path), "immutable capture bytes changed")
            return path
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        return path


def acquire_qong_bank(
    *,
    client: MothApiClient,
    preflight_value: Mapping[str, Any],
    approval_value: Mapping[str, Any],
    cache_root: Path,
    max_new_jobs: Optional[int] = None,
    timeout_seconds: float = 900.0,
) -> Dict[str, Any]:
    preflight = validate_preflight(preflight_value)
    approval = validate_approval(approval_value, preflight)
    if max_new_jobs is not None and max_new_jobs <= 0:
        raise ContractError("max_new_jobs", "must be positive")
    engine_data = preflight["engine"]
    engine = EngineContract(
        engine_id="coin-toss-v1",
        canonical_sha256=engine_data["canonicalEngineRecordSha256"],
        redacted_sha256=engine_data["canonicalEngineRecordSha256"],
        updated_at=engine_data["updatedAt"],
        credits_per_run=engine_data["listedCreditsPerRun"],
        input_slots=(),
        output_type="application/json",
        result_contract_state="reviewed-single-formatted-outcome-per-job-v1",
        unresolved_gaps=(),
    )
    mutation_approval = MutationApproval(
        engine_id="coin-toss-v1",
        engine_canonical_sha256=engine.canonical_sha256,
        request_sha256=REQUEST_SHA256,
        listed_credits=engine.credits_per_run,
        approved_at_utc=approval["approvedAtUtc"],
        approval_note_sha256=approval["approvalNoteSha256"],
    )
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    accepted_backend_name = _established_backend_name(ledger)
    submitted = 0
    captured = 0
    pending = 0
    skipped = 0
    for item in planned_items():
        item_id = item["itemId"]
        current = ledger.read()["attempts"].get(item_id, {})
        state = current.get("state") if isinstance(current, dict) else None
        if state == "captured":
            skipped += 1
            continue
        if state in (
            "ambiguous-no-retry",
            "http-failure-no-retry",
            "failed",
            "cancelled",
            "result-gone",
            "backend-mismatch",
        ):
            raise ContractError(
                "ledger.{}".format(item_id),
                "is terminal and cannot be silently retried",
            )
        job_id = current.get("jobId") if isinstance(current, dict) else None
        submitted_at = (
            current.get("submittedAt") if isinstance(current, dict) else None
        )
        if state == "reserved-before-post" and not job_id:
            raise ContractError(
                "ledger.{}".format(item_id),
                "was reserved before a POST whose outcome is ambiguous",
            )
        if not job_id:
            if max_new_jobs is not None and submitted >= max_new_jobs:
                pending += 1
                continue
            ledger.update(
                item_id,
                state="reserved-before-post",
                requestSha256=REQUEST_SHA256,
                reservedAtUtc=utc_now(),
            )
            try:
                job = client.submit(engine, REQUEST_BODY, mutation_approval)
            except AmbiguousMutationError as error:
                ledger.update(
                    item_id,
                    state="ambiguous-no-retry",
                    safeDetail=str(error)[:500],
                )
                raise
            except MothApiError as error:
                ledger.update(
                    item_id,
                    state="http-failure-no-retry",
                    httpStatus=error.status,
                    safeDetail=str(error)[:500],
                )
                raise
            job_id = job.job_id
            submitted_at = job.submitted_at
            submitted += 1
            ledger.update(
                item_id,
                state="accepted",
                jobId=job.job_id,
                initialStatus=job.status,
                submittedAt=job.submitted_at,
            )
        if not isinstance(job_id, str) or not isinstance(submitted_at, str):
            raise ContractError("ledger.{}".format(item_id), "lacks job identity")
        snapshots = []
        outcome = poll_job(
            client,
            job_id,
            timeout_seconds=timeout_seconds,
            expected_engine_id="coin-toss-v1",
            expected_submitted_at=submitted_at,
            on_snapshot=lambda snapshot: snapshots.append(
                {
                    "status": snapshot.status,
                    "updatedAt": snapshot.updated_at,
                    "rawStatusSha256": sha256_json(snapshot.raw),
                }
            ),
        )
        if outcome.state in ("failed", "cancelled"):
            ledger.update(
                item_id,
                state=outcome.state,
                statusSnapshots=snapshots,
                terminalObservedAtUtc=outcome.terminal_observed_at_utc,
            )
            raise ContractError(
                "job {}".format(item_id), "ended with {}".format(outcome.state)
            )
        if outcome.state == "gone":
            ledger.update(
                item_id,
                state="result-gone",
                statusSnapshots=snapshots,
                terminalObservedAtUtc=outcome.terminal_observed_at_utc,
                safeDetail=outcome.detail,
            )
            raise ContractError(
                "job {}".format(item_id),
                "completed but its result is no longer retrievable",
            )
        if outcome.state != "completed" or outcome.result is None:
            ledger.update(
                item_id,
                state="accepted",
                statusSnapshots=snapshots,
                safeDetail=outcome.detail,
            )
            pending += 1
            continue
        if not outcome.snapshots or outcome.terminal_observed_at_utc is None:
            raise ContractError(
                "job {} completion".format(item_id),
                "lacks a terminal provider status snapshot or observation time",
            )
        terminal_snapshot = outcome.snapshots[-1]
        if terminal_snapshot.status != "completed":
            raise ContractError(
                "job {} completion".format(item_id),
                "terminal provider status is not completed",
            )
        capture = capture_from_result(
            item_id=item_id,
            moth_job_id=job_id,
            submitted_at=submitted_at,
            provider_updated_at=terminal_snapshot.updated_at,
            terminal_observed_at=outcome.terminal_observed_at_utc,
            retrieved_at=utc_now(),
            terminal_status_sha256=sha256_json(terminal_snapshot.raw),
            raw_result=outcome.result.raw_bytes,
        )
        if capture["rawResultSha256"] != outcome.result.raw_sha256:
            raise ContractError(
                "job {} result".format(item_id),
                "retrieved bytes do not match the client result digest",
            )
        backend_name = capture["result"]["backend"]
        if (
            accepted_backend_name is not None
            and backend_name != accepted_backend_name
        ):
            capture_path = ledger.write_capture(item_id, capture)
            ledger.update(
                item_id,
                state="backend-mismatch",
                statusSnapshots=snapshots,
                terminalObservedAtUtc=outcome.terminal_observed_at_utc,
                rawResultSha256=outcome.result.raw_sha256,
                captureContentSha256=capture["contentSha256"],
                capturePath=capture_path.name,
                expectedBackendName=accepted_backend_name,
                returnedBackendName=backend_name,
            )
            raise ContractError(
                "job {} result.backend".format(item_id),
                "does not match the canary-established backend {}".format(
                    accepted_backend_name
                ),
            )
        if accepted_backend_name is None:
            accepted_backend_name = backend_name
        capture_path = ledger.write_capture(item_id, capture)
        ledger.update(
            item_id,
            state="captured",
            statusSnapshots=snapshots,
            terminalObservedAtUtc=outcome.terminal_observed_at_utc,
            rawResultSha256=outcome.result.raw_sha256,
            captureContentSha256=capture["contentSha256"],
            capturePath=capture_path.name,
        )
        captured += 1
    total_captured = sum(
        1
        for attempt in ledger.read()["attempts"].values()
        if isinstance(attempt, dict) and attempt.get("state") == "captured"
    )
    return {
        "schemaVersion": "quantum-box-qong-acquisition-report-v1",
        "preflightContentSha256": preflight["contentSha256"],
        "newJobsSubmitted": submitted,
        "newCaptures": captured,
        "existingCaptures": skipped,
        "pendingItems": pending,
        "totalCaptured": total_captured,
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "backendName": accepted_backend_name,
        "complete": total_captured == EXPECTED_JOB_COUNT,
        "captureDirectory": str(ledger.capture_dir),
    }


def _established_backend_name(ledger: QongAcquisitionLedger) -> Optional[str]:
    backends = set()
    for item_id, attempt in ledger.read()["attempts"].items():
        if not isinstance(attempt, dict) or attempt.get("state") != "captured":
            continue
        capture_path = ledger.capture_dir / "{}.json".format(item_id)
        try:
            value = json.loads(capture_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(capture_path), "is unreadable") from error
        if not isinstance(value, dict):
            raise ContractError(str(capture_path), "is not a capture object")
        capture = validate_capture(value, item_id)
        backends.add(capture["result"]["backend"])
    if len(backends) > 1:
        raise ContractError(
            "captured result backends", "do not share one canary-established backend"
        )
    return next(iter(backends), None)
