"""Crash-safe Qong acquisition through the authenticated Moth showcase UI.

This module never submits a provider request itself.  It reserves one exact
planned item before the browser presses Run, then binds the returned Moth job
identity and completed provider status to that reservation.
"""

from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, Mapping, Optional, Sequence

from .canonical import canonical_bytes, sha256_bytes, sha256_json
from .models import API_SPECIFICATION_SHA256, API_VERSION, ContractError
from .qong_acquisition import (
    QongAcquisitionLedger,
    require_sha256,
    require_utc,
    utc_now,
)
from .qong_bank import (
    EXPECTED_JOB_COUNT,
    FIRST_RALLY_CANDIDATE_COUNT,
    MIN_SELECTOR_BIT_COUNT,
    PLAY_PACK_COUNT,
    POSTSELECTION_STRATEGY,
    RALLIES_PER_PACK,
    REQUEST_BODY,
    REQUEST_SHA256,
    RESULT_CONTRACT,
    SELECTOR_BIT_COUNT,
    SELECTOR_COMPLETION_SCHEMA_VERSION,
    SELECTOR_COMPLETION_STRATEGY,
    assemble_bank,
    capture_from_result,
    immutable_json,
    planned_items,
    validate_capture,
    validate_selector_completion,
)


BROWSER_PREFLIGHT_SCHEMA_VERSION = "quantum-box-qong-showcase-preflight-v1"
BROWSER_PREFLIGHT_SCHEMA_VERSION_V2 = "quantum-box-qong-showcase-preflight-v2"
BROWSER_ACQUISITION_REPORT_SCHEMA_VERSION = (
    "quantum-box-qong-showcase-acquisition-report-v1"
)
BROWSER_CONTRACT_SOURCE = "authenticated-moth-showcase-v1"
STRICT_BACKEND_POLICY = "canary-established-single-backend-v1"
MIXED_BACKEND_POLICY = "provider-selected-per-job-v1"
MAX_PROVIDER_ATTEMPTS_PER_ITEM = 3
MAX_PENDING_BROWSER_RUNS = 16
SHOWCASE_URL = "https://platform.mothquantum.com/engines/showcase/coin-toss"
PROCESS_ENDPOINT = (
    "https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process"
)
STATUS_SCHEMA = "https://api.mothquantum.com/schemas/JobStatusOutputBody.json"
STATUS_FIELDS = frozenset(
    (
        "$schema",
        "job_id",
        "engine_id",
        "status",
        "progress",
        "steps",
        "result",
        "warnings",
        "submitted_at",
        "updated_at",
    )
)
FAILURE_STATUS_FIELDS = frozenset(
    (
        "$schema",
        "job_id",
        "engine_id",
        "status",
        "progress",
        "steps",
        "error",
        "warnings",
        "submitted_at",
        "updated_at",
    )
)
RESULT_FIELDS = frozenset(
    ("backend", "heads", "ibm_job_id", "mode", "output", "shots", "tails")
)
JOB_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)
SENSITIVE_KEY_PATTERN = re.compile(
    r"token|secret|password|authorization|api.?key", re.IGNORECASE
)


def prepare_browser_preflight(
    *,
    contract_observed_at_utc: str,
    authorized_at_utc: str,
    authorization_note_sha256: str,
    backend_policy: str = STRICT_BACKEND_POLICY,
) -> Dict[str, Any]:
    """Bind the exact visible contract, free-access authorization, and 120 jobs."""

    observed_at = require_utc(
        contract_observed_at_utc, "browser preflight.contractObservedAtUtc"
    )
    authorized_at = require_utc(
        authorized_at_utc, "browser preflight.authorizedAtUtc"
    )
    note_sha256 = require_sha256(
        authorization_note_sha256,
        "browser preflight.authorizationNoteSha256",
    )
    _require_chronology((observed_at, authorized_at))
    if backend_policy not in (STRICT_BACKEND_POLICY, MIXED_BACKEND_POLICY):
        raise ContractError(
            "browser preflight.backendPolicy", "is not an accepted policy"
        )
    contract = {
        "source": BROWSER_CONTRACT_SOURCE,
        "showcaseUrl": SHOWCASE_URL,
        "processEndpoint": PROCESS_ENDPOINT,
        "engineId": "coin-toss-v1",
        "contractObservedAtUtc": observed_at,
        "priceDisplay": "not-displayed",
        "requestBody": REQUEST_BODY,
        "requestBodySha256": REQUEST_SHA256,
        "terminalStatusSchema": STATUS_SCHEMA,
        "terminalStatusFields": sorted(STATUS_FIELDS),
        "resultFields": sorted(RESULT_FIELDS),
        "apiSpecificationVersion": API_VERSION,
        "apiSpecificationCanonicalSha256": API_SPECIFICATION_SHA256,
    }
    plan = {
        "playPackCount": PLAY_PACK_COUNT,
        "ralliesPerPlayPack": RALLIES_PER_PACK,
        "firstRallyCandidateCount": FIRST_RALLY_CANDIDATE_COUNT,
        "minimumFirstRallyTails": PLAY_PACK_COUNT,
        "postselectionStrategy": POSTSELECTION_STRATEGY,
        "selectorBitCount": SELECTOR_BIT_COUNT,
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "jobs": list(planned_items()),
    }
    material = {
        "schemaVersion": (
            BROWSER_PREFLIGHT_SCHEMA_VERSION_V2
            if backend_policy == MIXED_BACKEND_POLICY
            else BROWSER_PREFLIGHT_SCHEMA_VERSION
        ),
        "contract": {
            **contract,
            "canonicalContractRecordSha256": sha256_json(contract),
        },
        "access": {
            "basis": "user-confirmed-free-access",
            "listedCreditsPerRun": None,
            "maximumListedCredits": None,
            "authorizedAtUtc": authorized_at,
            "authorizationNoteSha256": note_sha256,
        },
        "plan": plan,
        "runtimeBoundary": {
            "providerCallsDuringPlay": 0,
            "assemblySelection": (
                "first four recorded tails from the ordered bounded candidate pool"
            ),
            "runtimeSelection": "two recorded selector bits decoded locally",
            "syntheticStoryFallback": False,
        },
    }
    if backend_policy == MIXED_BACKEND_POLICY:
        material["backendPolicy"] = backend_policy
    return {
        **material,
        "contentSha256": sha256_json(material),
        "submissionAuthorized": False,
    }


def validate_browser_preflight(value: Mapping[str, Any]) -> Dict[str, Any]:
    schema_version = value.get("schemaVersion")
    if schema_version not in (
        BROWSER_PREFLIGHT_SCHEMA_VERSION,
        BROWSER_PREFLIGHT_SCHEMA_VERSION_V2,
    ):
        raise ContractError("browser preflight", "has an unknown schema")
    if value.get("submissionAuthorized") is not False:
        raise ContractError(
            "browser preflight", "must not embed submission authority"
        )
    material = {
        key: item
        for key, item in value.items()
        if key not in ("contentSha256", "submissionAuthorized")
    }
    if value.get("contentSha256") != sha256_json(material):
        raise ContractError(
            "browser preflight.contentSha256", "does not match the plan"
        )
    contract = value.get("contract")
    access = value.get("access")
    if not isinstance(contract, dict) or not isinstance(access, dict):
        raise ContractError(
            "browser preflight", "contract or access record is absent"
        )
    expected = prepare_browser_preflight(
        contract_observed_at_utc=contract.get("contractObservedAtUtc"),
        authorized_at_utc=access.get("authorizedAtUtc"),
        authorization_note_sha256=access.get("authorizationNoteSha256"),
        backend_policy=(
            value.get("backendPolicy")
            if schema_version == BROWSER_PREFLIGHT_SCHEMA_VERSION_V2
            else STRICT_BACKEND_POLICY
        ),
    )
    if dict(value) != expected:
        raise ContractError(
            "browser preflight", "does not match the exact showcase plan"
        )
    return dict(value)


def reserve_next_browser_item(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    max_pending: int = 1,
) -> Dict[str, Any]:
    preflight = validate_browser_preflight(preflight_value)
    if not isinstance(max_pending, int) or isinstance(max_pending, bool) or not (
        1 <= max_pending <= MAX_PENDING_BROWSER_RUNS
    ):
        raise ContractError(
            "max_pending",
            "must be an integer from 1 through {}".format(
                MAX_PENDING_BROWSER_RUNS
            ),
        )
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    attempts = ledger.read()["attempts"]
    pending_states = {"reserved-before-browser-run", "accepted"}
    pending_count = sum(
        1
        for attempt in attempts.values()
        if isinstance(attempt, dict) and attempt.get("state") in pending_states
    )
    if pending_count >= max_pending:
        if max_pending == 1:
            pending_item_id, pending_attempt = next(
                (item_id, attempt)
                for item_id, attempt in attempts.items()
                if isinstance(attempt, dict)
                and attempt.get("state") in pending_states
            )
            if pending_attempt.get("state") == "reserved-before-browser-run":
                raise ContractError(
                    "ledger.{}".format(pending_item_id),
                    "is ambiguous until the browser submission outcome is bound",
                )
            raise ContractError(
                "ledger.{}".format(pending_item_id),
                "has an accepted job that must be collected before another Run",
            )
        raise ContractError(
            "browser acquisition",
            "already has the maximum pending browser Runs",
        )
    for item in planned_items():
        item_id = item["itemId"]
        current = attempts.get(item_id)
        if current is None:
            reserved_at = utc_now()
            ledger.update(
                item_id,
                state="reserved-before-browser-run",
                requestSha256=REQUEST_SHA256,
                reservedAtUtc=reserved_at,
                acquisitionSurface=BROWSER_CONTRACT_SOURCE,
            )
            return {
                "itemId": item_id,
                "role": item["role"],
                "request": REQUEST_BODY,
                "requestSha256": REQUEST_SHA256,
                "reservedAtUtc": reserved_at,
                "ledgerPath": str(ledger.path),
            }
        if not isinstance(current, dict):
            raise ContractError("ledger.{}".format(item_id), "must be an object")
        state = current.get("state")
        if state == "captured":
            continue
        if state in pending_states:
            continue
        raise ContractError(
            "ledger.{}".format(item_id),
            "is terminal and cannot be silently retried",
        )
    raise ContractError("browser acquisition", "all planned items are captured")


def retry_failed_browser_item(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    item_id: str,
    retry_authorized_at_utc: str,
) -> Dict[str, Any]:
    """Reserve a bounded retry while retaining every terminal provider attempt."""

    preflight = validate_browser_preflight(preflight_value)
    planned_item = next(
        (item for item in planned_items() if item["itemId"] == item_id), None
    )
    if planned_item is None:
        raise ContractError("browser retry itemId", "is not in the bounded plan")
    authorized_at = require_utc(
        retry_authorized_at_utc, "browser retry authorization time"
    )
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    payload = ledger.read()
    current = payload["attempts"].get(item_id)
    if not isinstance(current, dict) or current.get("state") not in (
        "failed",
        "cancelled",
    ):
        raise ContractError(
            "ledger.{}".format(item_id),
            "does not contain a terminal provider failure eligible for retry",
        )
    prior_attempts = current.get("priorAttempts", [])
    if not isinstance(prior_attempts, list) or any(
        not isinstance(attempt, dict) for attempt in prior_attempts
    ):
        raise ContractError(
            "ledger.{}.priorAttempts".format(item_id), "must be an array of objects"
        )
    attempt_number = current.get("attemptNumber", len(prior_attempts) + 1)
    if (
        not isinstance(attempt_number, int)
        or isinstance(attempt_number, bool)
        or attempt_number != len(prior_attempts) + 1
    ):
        raise ContractError(
            "ledger.{}.attemptNumber".format(item_id),
            "does not match the preserved attempt history",
        )
    if attempt_number >= MAX_PROVIDER_ATTEMPTS_PER_ITEM:
        raise ContractError(
            "ledger.{}".format(item_id),
            "has reached the bounded provider-attempt limit",
        )
    terminal_observed_at = require_utc(
        current.get("terminalObservedAtUtc"),
        "ledger.{}.terminalObservedAtUtc".format(item_id),
    )
    _require_chronology((terminal_observed_at, authorized_at))
    status_path_value = current.get("statusPath")
    if not isinstance(status_path_value, str) or Path(status_path_value).name != (
        status_path_value
    ):
        raise ContractError(
            "ledger.{}.statusPath".format(item_id), "must be one local filename"
        )
    status_path = ledger.root / "statuses" / status_path_value
    try:
        failure_status = json.loads(status_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError(str(status_path), "is unreadable") from error
    if (
        not isinstance(failure_status, dict)
        or set(failure_status) != FAILURE_STATUS_FIELDS
        or failure_status.get("status") != current.get("state")
        or failure_status.get("job_id") != current.get("jobId")
        or sha256_json(failure_status) != current.get("terminalStatusSha256")
        or not isinstance(failure_status.get("error"), dict)
        or failure_status["error"].get("retryable") is not True
        or sha256_json(failure_status["error"])
        != current.get("providerErrorSha256")
        or _non_null_sensitive_paths(failure_status)
    ):
        raise ContractError(
            "ledger.{}".format(item_id),
            "does not match one immutable provider-declared retryable failure",
        )
    preserved_attempt = {
        key: value for key, value in current.items() if key != "priorAttempts"
    }
    reserved_at = utc_now()
    _require_chronology((authorized_at, reserved_at))
    payload["attempts"][item_id] = {
        "state": "reserved-before-browser-run",
        "attemptNumber": attempt_number + 1,
        "priorAttempts": [*prior_attempts, preserved_attempt],
        "requestSha256": REQUEST_SHA256,
        "reservedAtUtc": reserved_at,
        "retryAuthorizedAtUtc": authorized_at,
        "retryReason": "provider-declared-retryable-terminal-failure-v1",
        "acquisitionSurface": BROWSER_CONTRACT_SOURCE,
    }
    ledger.save(payload)
    return {
        "itemId": item_id,
        "role": planned_item["role"],
        "attemptNumber": attempt_number + 1,
        "maximumAttempts": MAX_PROVIDER_ATTEMPTS_PER_ITEM,
        "request": REQUEST_BODY,
        "requestSha256": REQUEST_SHA256,
        "reservedAtUtc": reserved_at,
        "priorTerminalStatusSha256": current["terminalStatusSha256"],
        "ledgerPath": str(ledger.path),
    }


def accept_browser_job(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    item_id: str,
    job_id: str,
    accepted_observed_at_utc: str,
) -> Dict[str, Any]:
    preflight = validate_browser_preflight(preflight_value)
    observed_at = require_utc(
        accepted_observed_at_utc, "browser acceptance observation"
    )
    if JOB_ID_PATTERN.fullmatch(job_id) is None:
        raise ContractError("browser acceptance.jobId", "must be a Moth UUID")
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    attempts = ledger.read()["attempts"]
    current = attempts.get(item_id)
    if not isinstance(current, dict) or current.get("state") != (
        "reserved-before-browser-run"
    ):
        raise ContractError(
            "ledger.{}".format(item_id), "is not reserved for one browser Run"
        )
    for other_id, attempt in attempts.items():
        if other_id != item_id and isinstance(attempt, dict):
            if attempt.get("jobId") == job_id:
                raise ContractError("browser acceptance.jobId", "must be unique")
    ledger.update(
        item_id,
        state="accepted",
        jobId=job_id,
        acceptedObservedAtUtc=observed_at,
    )
    return {
        "itemId": item_id,
        "jobId": job_id,
        "state": "accepted",
        "ledgerPath": str(ledger.path),
    }


def capture_completed_browser_status(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    item_id: str,
    terminal_observed_at_utc: str,
    raw_status: bytes,
) -> Dict[str, Any]:
    preflight = validate_browser_preflight(preflight_value)
    terminal_observed_at = require_utc(
        terminal_observed_at_utc, "browser terminal observation"
    )
    try:
        status = json.loads(raw_status.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ContractError("browser status", "must be UTF-8 JSON") from error
    if not isinstance(status, dict) or set(status) != STATUS_FIELDS:
        raise ContractError(
            "browser status", "does not match the reviewed terminal schema"
        )
    sensitive_paths = _non_null_sensitive_paths(status)
    if sensitive_paths:
        raise ContractError(
            "browser status",
            "contains a non-null credential-like field and cannot be stored",
        )
    if status.get("$schema") != STATUS_SCHEMA:
        raise ContractError("browser status.$schema", "does not match")
    if status.get("engine_id") != "coin-toss-v1":
        raise ContractError("browser status.engine_id", "does not match")
    if status.get("status") != "completed":
        raise ContractError("browser status.status", "must be completed")
    if not isinstance(status.get("result"), dict) or set(status["result"]) != (
        RESULT_FIELDS
    ):
        raise ContractError("browser status.result", "has an unknown schema")
    submitted_at = require_utc(
        status.get("submitted_at"), "browser status.submitted_at"
    )
    updated_at = require_utc(
        status.get("updated_at"), "browser status.updated_at"
    )
    _require_chronology((submitted_at, updated_at, terminal_observed_at))

    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    current = ledger.read()["attempts"].get(item_id)
    if not isinstance(current, dict) or current.get("state") != "accepted":
        raise ContractError(
            "ledger.{}".format(item_id), "does not have one accepted browser job"
        )
    if status.get("job_id") != current.get("jobId"):
        raise ContractError("browser status.job_id", "does not match reservation")
    attempt_number = _browser_attempt_number(current, item_id)

    terminal_status_sha256 = sha256_json(status)
    status_dir = ledger.root / "statuses"
    existing_capture_path = ledger.capture_dir / "{}.json".format(item_id)
    if existing_capture_path.exists():
        try:
            existing_value = json.loads(
                existing_capture_path.read_text(encoding="utf-8")
            )
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(
                str(existing_capture_path), "is unreadable"
            ) from error
        if not isinstance(existing_value, dict):
            raise ContractError(str(existing_capture_path), "is not an object")
        capture = validate_capture(existing_value, item_id)
        _validate_status_against_capture(status, capture)
        terminal_observed_at = capture["terminalObservedAt"]
        retrieved_at = capture["retrievedAt"]
    else:
        retrieved_at = utc_now()
        _require_chronology(
            (submitted_at, updated_at, terminal_observed_at, retrieved_at)
        )
        capture = capture_from_result(
            item_id=item_id,
            moth_job_id=status["job_id"],
            submitted_at=submitted_at,
            provider_updated_at=updated_at,
            terminal_observed_at=terminal_observed_at,
            retrieved_at=retrieved_at,
            terminal_status_sha256=terminal_status_sha256,
            raw_result=canonical_bytes(status["result"]),
        )
        validate_capture(capture, item_id)

    status_path = immutable_json(
        status_dir / _status_filename(item_id, attempt_number), status
    )
    os.chmod(status_dir, 0o700)
    os.chmod(status_path, 0o600)
    capture_path = ledger.write_capture(item_id, capture)
    accepted_backend = _established_backend_name(
        ledger,
        exclude_item_id=item_id,
        allow_mixed=_allows_mixed_backends(preflight),
    )
    returned_backend = capture["result"]["backend"]
    state = "captured"
    if (
        not _allows_mixed_backends(preflight)
        and accepted_backend is not None
        and returned_backend != accepted_backend
    ):
        state = "backend-mismatch"
    ledger_fields = {
        "state": state,
        "submittedAt": submitted_at,
        "providerUpdatedAt": updated_at,
        "terminalObservedAtUtc": terminal_observed_at,
        "retrievedAtUtc": retrieved_at,
        "terminalStatusSha256": terminal_status_sha256,
        "rawResultSha256": capture["rawResultSha256"],
        "captureContentSha256": capture["contentSha256"],
        "capturePath": capture_path.name,
        "statusPath": status_path.name,
        "returnedBackendName": returned_backend,
        "backendPolicy": (
            MIXED_BACKEND_POLICY
            if _allows_mixed_backends(preflight)
            else STRICT_BACKEND_POLICY
        ),
    }
    if not _allows_mixed_backends(preflight):
        ledger_fields["expectedBackendName"] = accepted_backend or returned_backend
    ledger.update(item_id, **ledger_fields)
    if state == "backend-mismatch":
        raise ContractError(
            "job {} result.backend".format(item_id),
            "does not match the canary-established backend {}".format(
                accepted_backend
            ),
        )
    return {
        "itemId": item_id,
        "jobId": status["job_id"],
        "state": state,
        "backendName": returned_backend,
        "outcome": capture["result"]["output"],
        "captureContentSha256": capture["contentSha256"],
        "rawResultSha256": capture["rawResultSha256"],
        "terminalStatusSha256": terminal_status_sha256,
        "capturePath": str(capture_path),
        "statusPath": str(status_path),
    }


def capture_failed_browser_status(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    item_id: str,
    terminal_observed_at_utc: str,
    raw_status: bytes,
) -> Dict[str, Any]:
    """Preserve one terminal provider failure without creating a Qong capture."""

    preflight = validate_browser_preflight(preflight_value)
    terminal_observed_at = require_utc(
        terminal_observed_at_utc, "browser failure observation"
    )
    try:
        status = json.loads(raw_status.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ContractError("browser failure status", "must be UTF-8 JSON") from error
    if not isinstance(status, dict) or set(status) != FAILURE_STATUS_FIELDS:
        raise ContractError(
            "browser failure status", "does not match the reviewed failure schema"
        )
    if _non_null_sensitive_paths(status):
        raise ContractError(
            "browser failure status",
            "contains a non-null credential-like field and cannot be stored",
        )
    if status.get("$schema") != STATUS_SCHEMA:
        raise ContractError("browser failure status.$schema", "does not match")
    if status.get("engine_id") != "coin-toss-v1":
        raise ContractError("browser failure status.engine_id", "does not match")
    terminal_state = status.get("status")
    if terminal_state not in ("failed", "cancelled"):
        raise ContractError(
            "browser failure status.status", "must be failed or cancelled"
        )
    if not isinstance(status.get("error"), dict) or not status["error"]:
        raise ContractError("browser failure status.error", "must be a non-empty object")
    submitted_at = require_utc(
        status.get("submitted_at"), "browser failure status.submitted_at"
    )
    updated_at = require_utc(
        status.get("updated_at"), "browser failure status.updated_at"
    )
    _require_chronology((submitted_at, updated_at, terminal_observed_at))

    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    current = ledger.read()["attempts"].get(item_id)
    if not isinstance(current, dict) or current.get("state") != "accepted":
        raise ContractError(
            "ledger.{}".format(item_id), "does not have one accepted browser job"
        )
    if status.get("job_id") != current.get("jobId"):
        raise ContractError(
            "browser failure status.job_id", "does not match reservation"
        )
    attempt_number = _browser_attempt_number(current, item_id)
    terminal_status_sha256 = sha256_json(status)
    status_dir = ledger.root / "statuses"
    status_path = immutable_json(
        status_dir / _status_filename(item_id, attempt_number), status
    )
    os.chmod(status_dir, 0o700)
    os.chmod(status_path, 0o600)
    ledger.update(
        item_id,
        state=terminal_state,
        submittedAt=submitted_at,
        providerUpdatedAt=updated_at,
        terminalObservedAtUtc=terminal_observed_at,
        terminalStatusSha256=terminal_status_sha256,
        providerErrorSha256=sha256_json(status["error"]),
        statusPath=status_path.name,
        backendPolicy=(
            MIXED_BACKEND_POLICY
            if _allows_mixed_backends(preflight)
            else STRICT_BACKEND_POLICY
        ),
    )
    return {
        "itemId": item_id,
        "jobId": status["job_id"],
        "state": terminal_state,
        "terminalStatusSha256": terminal_status_sha256,
        "providerErrorSha256": sha256_json(status["error"]),
        "providerError": status["error"],
        "statusPath": str(status_path),
    }


def import_prior_browser_capture(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    source_preflight_sha256: str,
    item_id: str,
    imported_at_utc: str,
) -> Dict[str, Any]:
    """Import one exact completed record from a retired browser ledger."""

    preflight = validate_browser_preflight(preflight_value)
    if not _allows_mixed_backends(preflight):
        raise ContractError(
            "browser capture import", "requires the mixed-backend preflight"
        )
    source_sha256 = require_sha256(
        source_preflight_sha256, "source preflight content hash"
    )
    imported_at = require_utc(imported_at_utc, "browser capture import time")
    source_ledger = QongAcquisitionLedger(cache_root, source_sha256)
    source_payload = source_ledger.read()
    source_attempt = source_payload["attempts"].get(item_id)
    if not isinstance(source_attempt, dict) or source_attempt.get("state") not in (
        "captured",
        "backend-mismatch",
    ):
        raise ContractError(
            "source ledger.{}".format(item_id),
            "does not contain an immutable completed capture",
        )
    source_capture_path = source_ledger.capture_dir / "{}.json".format(item_id)
    source_status_path = source_ledger.root / "statuses" / "{}.json".format(item_id)
    try:
        capture_value = json.loads(source_capture_path.read_text(encoding="utf-8"))
        status_value = json.loads(source_status_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError(
            "source ledger.{}".format(item_id), "capture or status is unreadable"
        ) from error
    if not isinstance(capture_value, dict) or not isinstance(status_value, dict):
        raise ContractError(
            "source ledger.{}".format(item_id), "capture or status is not an object"
        )
    capture = validate_capture(capture_value, item_id)
    _validate_status_against_capture(status_value, capture)
    if source_attempt.get("jobId") != capture["mothJobId"]:
        raise ContractError(
            "source ledger.{}.jobId".format(item_id), "does not match capture"
        )
    if source_attempt.get("captureContentSha256") != capture["contentSha256"]:
        raise ContractError(
            "source ledger.{}.captureContentSha256".format(item_id),
            "does not match capture",
        )
    if source_attempt.get("terminalStatusSha256") != capture["terminalStatusSha256"]:
        raise ContractError(
            "source ledger.{}.terminalStatusSha256".format(item_id),
            "does not match status",
        )
    _require_chronology((capture["retrievedAt"], imported_at))

    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    attempts = ledger.read()["attempts"]
    expected_next = next(
        (
            item["itemId"]
            for item in planned_items()
            if item["itemId"] not in attempts
        ),
        None,
    )
    if expected_next != item_id:
        raise ContractError(
            "browser capture import", "must preserve exact planned ordering"
        )
    for attempt in attempts.values():
        if isinstance(attempt, dict) and attempt.get("jobId") == capture["mothJobId"]:
            raise ContractError("browser capture import", "Moth job ID is duplicated")

    status_dir = ledger.root / "statuses"
    status_path = immutable_json(status_dir / "{}.json".format(item_id), status_value)
    os.chmod(status_dir, 0o700)
    os.chmod(status_path, 0o600)
    capture_path = ledger.write_capture(item_id, capture)
    ledger.update(
        item_id,
        state="captured",
        jobId=capture["mothJobId"],
        requestSha256=capture["requestSha256"],
        submittedAt=capture["submittedAt"],
        providerUpdatedAt=capture["providerUpdatedAt"],
        terminalObservedAtUtc=capture["terminalObservedAt"],
        retrievedAtUtc=capture["retrievedAt"],
        terminalStatusSha256=capture["terminalStatusSha256"],
        rawResultSha256=capture["rawResultSha256"],
        captureContentSha256=capture["contentSha256"],
        capturePath=capture_path.name,
        statusPath=status_path.name,
        returnedBackendName=capture["result"]["backend"],
        backendPolicy=MIXED_BACKEND_POLICY,
        importedAtUtc=imported_at,
        importedFromPreflightContentSha256=source_sha256,
        importedSourceLedgerPayloadSha256=sha256_json(source_payload),
        importedSourceAttemptSha256=sha256_json(source_attempt),
    )
    return {
        "itemId": item_id,
        "jobId": capture["mothJobId"],
        "state": "captured",
        "backendName": capture["result"]["backend"],
        "captureContentSha256": capture["contentSha256"],
        "sourcePreflightContentSha256": source_sha256,
        "ledgerPath": str(ledger.path),
    }


def adopt_prior_browser_reservation(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    item_id: str,
    reserved_at_utc: str,
    reservation_receipt_sha256: str,
    adopted_at_utc: str,
) -> Dict[str, Any]:
    """Bind a pre-existing immutable reservation used before this ledger existed."""

    preflight = validate_browser_preflight(preflight_value)
    reserved_at = require_utc(reserved_at_utc, "prior reservation time")
    adopted_at = require_utc(adopted_at_utc, "reservation adoption time")
    receipt_sha256 = require_sha256(
        reservation_receipt_sha256, "prior reservation receipt hash"
    )
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    current = ledger.read()["attempts"].get(item_id)
    if not isinstance(current, dict) or current.get("state") not in (
        "accepted",
        "captured",
        "backend-mismatch",
    ):
        raise ContractError(
            "ledger.{}".format(item_id),
            "does not contain a bindable accepted browser job",
        )
    submitted_at = require_utc(
        current.get("submittedAt"), "ledger.{}.submittedAt".format(item_id)
    )
    _require_chronology((reserved_at, submitted_at, adopted_at))
    existing_reserved_at = require_utc(
        current.get("reservedAtUtc"),
        "ledger.{}.reservedAtUtc".format(item_id),
    )
    if datetime.fromisoformat(existing_reserved_at.replace("Z", "+00:00")) <= (
        datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
    ):
        raise ContractError(
            "ledger.{}.reservedAtUtc".format(item_id),
            "already precedes provider submission and must not be replaced",
        )
    ledger.update(
        item_id,
        reservedAtUtc=reserved_at,
        reservationReceiptSha256=receipt_sha256,
        reservationAdoptedAtUtc=adopted_at,
    )
    return {
        "itemId": item_id,
        "state": current["state"],
        "reservedAtUtc": reserved_at,
        "submittedAt": submitted_at,
        "reservationReceiptSha256": receipt_sha256,
        "ledgerPath": str(ledger.path),
    }


def browser_acquisition_report(
    *, preflight_value: Mapping[str, Any], cache_root: Path
) -> Dict[str, Any]:
    preflight = validate_browser_preflight(preflight_value)
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    attempts = ledger.read()["attempts"]
    ledger_bytes = ledger.path.read_bytes() if ledger.path.exists() else b""
    ledger_payload_sha256 = None
    if ledger_bytes:
        ledger_payload_sha256 = json.loads(ledger_bytes.decode("utf-8"))[
            "payloadSha256"
        ]
    counts: Dict[str, int] = {}
    historical_counts: Dict[str, int] = {}
    provider_attempt_count = 0
    for attempt in attempts.values():
        state = attempt.get("state") if isinstance(attempt, dict) else "invalid"
        counts[state] = counts.get(state, 0) + 1
        provider_attempt_count += 1
        if not isinstance(attempt, dict):
            continue
        prior_attempts = attempt.get("priorAttempts", [])
        if not isinstance(prior_attempts, list) or any(
            not isinstance(prior, dict) for prior in prior_attempts
        ):
            raise ContractError(
                "browser acquisition priorAttempts", "must be an array of objects"
            )
        provider_attempt_count += len(prior_attempts)
        for prior in prior_attempts:
            prior_state = prior.get("state", "invalid")
            historical_counts[prior_state] = (
                historical_counts.get(prior_state, 0) + 1
            )
    captured = counts.get("captured", 0)
    terminal_states = (
        "backend-mismatch",
        "failed",
        "cancelled",
        "invalid",
    )
    terminal = sum(counts.get(state, 0) for state in terminal_states)
    return {
        "schemaVersion": BROWSER_ACQUISITION_REPORT_SCHEMA_VERSION,
        "preflightContentSha256": preflight["contentSha256"],
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "captured": captured,
        "remaining": EXPECTED_JOB_COUNT - captured,
        "unattempted": EXPECTED_JOB_COUNT - len(attempts),
        "terminalFailures": terminal,
        "states": counts,
        "providerAttemptCount": provider_attempt_count,
        "historicalStates": historical_counts,
        "historicalTerminalFailures": sum(
            historical_counts.get(state, 0) for state in terminal_states
        ),
        "backendName": _established_backend_name(
            ledger, allow_mixed=_allows_mixed_backends(preflight)
        ),
        "backendNames": list(_captured_backend_names(ledger)),
        "backendPolicy": (
            MIXED_BACKEND_POLICY
            if _allows_mixed_backends(preflight)
            else STRICT_BACKEND_POLICY
        ),
        "complete": captured == EXPECTED_JOB_COUNT and terminal == 0,
        "blocked": terminal > 0,
        "ledgerPath": str(ledger.path),
        "ledgerPayloadSha256": ledger_payload_sha256,
        "ledgerByteSha256": sha256_bytes(ledger_bytes) if ledger_bytes else None,
        "captureDirectory": str(ledger.capture_dir),
    }


def assemble_blocked_browser_bank(
    *,
    preflight_value: Mapping[str, Any],
    cache_root: Path,
    selector_bit_count: int,
) -> Dict[str, Any]:
    """Seal a complete even selector prefix after a non-retryable provider stop."""

    preflight = validate_browser_preflight(preflight_value)
    if not _allows_mixed_backends(preflight):
        raise ContractError(
            "blocked selector assembly",
            "requires the exact provider-selected browser preflight",
        )
    if (
        type(selector_bit_count) is not int
        or selector_bit_count < MIN_SELECTOR_BIT_COUNT
        or selector_bit_count >= SELECTOR_BIT_COUNT
        or selector_bit_count % 2 != 0
    ):
        raise ContractError(
            "blocked selector assembly.selectorBitCount",
            "must be an even prefix from {} through {}".format(
                MIN_SELECTOR_BIT_COUNT, SELECTOR_BIT_COUNT - 2
            ),
        )
    base_capture_count = (
        FIRST_RALLY_CANDIDATE_COUNT
        + PLAY_PACK_COUNT * (RALLIES_PER_PACK - 1)
    )
    used_count = base_capture_count + selector_bit_count
    planned = list(planned_items())
    used_ids = [item["itemId"] for item in planned[:used_count]]
    unpaired_item_id = "s{:03d}".format(selector_bit_count + 1)
    ledger = QongAcquisitionLedger(cache_root, preflight["contentSha256"])
    payload = ledger.read()
    attempts = payload["attempts"]
    captures = []
    for item_id in [*used_ids, unpaired_item_id]:
        attempt = attempts.get(item_id)
        if not isinstance(attempt, dict) or attempt.get("state") != "captured":
            raise ContractError(
                "ledger.{}".format(item_id),
                "must contain one immutable completed capture",
            )
        capture_path = ledger.capture_dir / "{}.json".format(item_id)
        try:
            value = json.loads(capture_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(capture_path), "is absent or invalid") from error
        if not isinstance(value, dict):
            raise ContractError(str(capture_path), "must contain an object")
        capture = validate_capture(value, item_id)
        if (
            attempt.get("jobId") != capture["mothJobId"]
            or attempt.get("captureContentSha256") != capture["contentSha256"]
            or attempt.get("terminalStatusSha256")
            != capture["terminalStatusSha256"]
            or attempt.get("backendPolicy") != MIXED_BACKEND_POLICY
        ):
            raise ContractError(
                "ledger.{}".format(item_id), "does not match its capture"
            )
        if item_id != unpaired_item_id:
            captures.append(capture)

    blocked_items = []
    blocked_start = selector_bit_count + 2
    selector_index = blocked_start
    while selector_index <= SELECTOR_BIT_COUNT:
        item_id = "s{:03d}".format(selector_index)
        attempt = attempts.get(item_id)
        if attempt is None:
            break
        if not isinstance(attempt, dict) or attempt.get("state") != "failed":
            raise ContractError(
                "ledger.{}".format(item_id),
                "must be a non-retryable terminal provider blocker",
            )
        status_name = attempt.get("statusPath")
        if not isinstance(status_name, str) or Path(status_name).name != status_name:
            raise ContractError(
                "ledger.{}.statusPath".format(item_id),
                "must be one local filename",
            )
        status_path = ledger.root / "statuses" / status_name
        try:
            status = json.loads(status_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(status_path), "is absent or invalid") from error
        error_record = status.get("error") if isinstance(status, dict) else None
        if (
            not isinstance(status, dict)
            or set(status) != FAILURE_STATUS_FIELDS
            or status.get("$schema") != STATUS_SCHEMA
            or status.get("engine_id") != "coin-toss-v1"
            or status.get("status") != "failed"
            or status.get("job_id") != attempt.get("jobId")
            or sha256_json(status) != attempt.get("terminalStatusSha256")
            or not isinstance(error_record, dict)
            or error_record.get("type") != "unavailable"
            or error_record.get("retryable") is not False
            or sha256_json(error_record) != attempt.get("providerErrorSha256")
            or _non_null_sensitive_paths(status)
        ):
            raise ContractError(
                "ledger.{}".format(item_id),
                "does not match one immutable non-retryable provider blocker",
            )
        blocked_items.append(
            {
                "itemId": item_id,
                "mothJobId": status["job_id"],
                "terminalStatusSha256": attempt["terminalStatusSha256"],
                "providerErrorSha256": attempt["providerErrorSha256"],
                "errorType": "unavailable",
                "errorRetryable": False,
            }
        )
        selector_index += 1
    if not blocked_items:
        raise ContractError(
            "blocked selector assembly", "requires a preserved provider blocker"
        )
    unattempted_item_ids = [
        "s{:03d}".format(index)
        for index in range(selector_index, SELECTOR_BIT_COUNT + 1)
    ]
    if any(item_id in attempts for item_id in unattempted_item_ids):
        raise ContractError(
            "blocked selector assembly",
            "contains provider attempts after the preserved blocker",
        )
    expected_attempt_ids = set(
        [*used_ids, unpaired_item_id]
        + [item["itemId"] for item in blocked_items]
    )
    if set(attempts) != expected_attempt_ids:
        raise ContractError(
            "blocked selector assembly",
            "ledger attempts do not form one captured prefix and blocker",
        )
    ledger_bytes = ledger.path.read_bytes()
    envelope = json.loads(ledger_bytes.decode("utf-8"))
    stop_time = max(
        attempts[item["itemId"]]["terminalObservedAtUtc"]
        for item in blocked_items
    )
    completion_material = {
        "schemaVersion": SELECTOR_COMPLETION_SCHEMA_VERSION,
        "strategy": SELECTOR_COMPLETION_STRATEGY,
        "authorizedSelectorBitCount": SELECTOR_BIT_COUNT,
        "installedSelectorBitCount": selector_bit_count,
        "lastIncludedItemId": "s{:03d}".format(selector_bit_count),
        "unpairedCaptureItemId": unpaired_item_id,
        "unpairedCaptureContentSha256": attempts[unpaired_item_id][
            "captureContentSha256"
        ],
        "blockedItems": blocked_items,
        "unattemptedItemIds": unattempted_item_ids,
        "ledgerPayloadSha256": envelope["payloadSha256"],
        "ledgerByteSha256": sha256_bytes(ledger_bytes),
        "stoppedMutationAtUtc": stop_time,
    }
    selector_completion = validate_selector_completion(
        {
            **completion_material,
            "contentSha256": sha256_json(completion_material),
        },
        selector_bit_count=selector_bit_count,
    )
    return assemble_bank(
        preflight,
        captures,
        selector_bit_count=selector_bit_count,
        selector_completion=selector_completion,
    )


def _non_null_sensitive_paths(value: Any, path: str = "") -> Sequence[str]:
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            next_path = "{}.{}".format(path, key) if path else str(key)
            if SENSITIVE_KEY_PATTERN.search(str(key)) and item not in (None, ""):
                found.append(next_path)
            found.extend(_non_null_sensitive_paths(item, next_path))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            next_path = "{}[{}]".format(path, index)
            found.extend(_non_null_sensitive_paths(item, next_path))
    return tuple(found)


def _browser_attempt_number(attempt: Mapping[str, Any], item_id: str) -> int:
    prior_attempts = attempt.get("priorAttempts", [])
    if not isinstance(prior_attempts, list) or any(
        not isinstance(prior, dict) for prior in prior_attempts
    ):
        raise ContractError(
            "ledger.{}.priorAttempts".format(item_id), "must be an array of objects"
        )
    value = attempt.get("attemptNumber", len(prior_attempts) + 1)
    if (
        not isinstance(value, int)
        or isinstance(value, bool)
        or value != len(prior_attempts) + 1
        or not 1 <= value <= MAX_PROVIDER_ATTEMPTS_PER_ITEM
    ):
        raise ContractError(
            "ledger.{}.attemptNumber".format(item_id),
            "does not match the bounded attempt history",
        )
    return value


def _status_filename(item_id: str, attempt_number: int) -> str:
    return (
        "{}.json".format(item_id)
        if attempt_number == 1
        else "{}-attempt-{}.json".format(item_id, attempt_number)
    )


def _require_chronology(values: Sequence[str]) -> None:
    instants = tuple(
        datetime.fromisoformat(value.replace("Z", "+00:00")) for value in values
    )
    if any(left > right for left, right in zip(instants, instants[1:])):
        raise ContractError("browser status timestamps", "must be chronological")


def _allows_mixed_backends(preflight: Mapping[str, Any]) -> bool:
    return (
        preflight.get("schemaVersion") == BROWSER_PREFLIGHT_SCHEMA_VERSION_V2
        and preflight.get("backendPolicy") == MIXED_BACKEND_POLICY
    )


def _validate_status_against_capture(
    status: Mapping[str, Any], capture: Mapping[str, Any]
) -> None:
    if set(status) != STATUS_FIELDS or status.get("$schema") != STATUS_SCHEMA:
        raise ContractError("source browser status", "does not match schema")
    if _non_null_sensitive_paths(status):
        raise ContractError("source browser status", "contains credential-like data")
    if (
        status.get("engine_id") != "coin-toss-v1"
        or status.get("status") != "completed"
        or status.get("job_id") != capture.get("mothJobId")
        or status.get("submitted_at") != capture.get("submittedAt")
        or status.get("updated_at") != capture.get("providerUpdatedAt")
        or sha256_json(status) != capture.get("terminalStatusSha256")
        or not isinstance(status.get("result"), dict)
        or set(status["result"]) != RESULT_FIELDS
        or sha256_bytes(canonical_bytes(status["result"]))
        != capture.get("rawResultSha256")
        or status["result"] != capture.get("result")
    ):
        raise ContractError("source browser status", "does not match capture")


def _captured_backend_names(ledger: QongAcquisitionLedger) -> Sequence[str]:
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
    return tuple(sorted(backends))


def _established_backend_name(
    ledger: QongAcquisitionLedger,
    *,
    exclude_item_id: Optional[str] = None,
    allow_mixed: bool = False,
) -> Optional[str]:
    backends = set()
    for item_id, attempt in ledger.read()["attempts"].items():
        if item_id == exclude_item_id:
            continue
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
    if len(backends) > 1 and not allow_mixed:
        raise ContractError(
            "captured result backends",
            "do not share one canary-established backend",
        )
    return next(iter(backends), None) if len(backends) == 1 else None
