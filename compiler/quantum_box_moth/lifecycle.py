"""One-shot submission and resumable polling orchestration."""

from __future__ import annotations

from typing import Any, Dict

from .ledger import JobLedger
from .models import (
    AmbiguousMutationError,
    EngineContract,
    MothApiError,
    MutationApproval,
    PollOutcome,
)
from .polling import poll_job


def submit_once(
    client,
    ledger: JobLedger,
    engine: EngineContract,
    request_body: Dict[str, Any],
    approval: MutationApproval,
) -> object:
    """Reserve before POST, persist 202 immediately, and never retry here."""
    ledger.reserve_submission(engine, request_body, approval)
    try:
        job = client.submit(engine, request_body, approval)
    except AmbiguousMutationError as error:
        ledger.record_ambiguous(approval.request_sha256, str(error))
        raise
    except MothApiError as error:
        ledger.record_http_failure(approval.request_sha256, error.status, str(error))
        raise
    ledger.record_accepted(approval.request_sha256, job)
    return job


def resume_poll(
    client,
    ledger: JobLedger,
    engine: EngineContract,
    request_sha256: str,
    *,
    timeout_seconds: float = 300.0,
    **poll_kwargs,
) -> PollOutcome:
    job = ledger.submitted_job(request_sha256)
    outcome = poll_job(
        client,
        job.job_id,
        timeout_seconds=timeout_seconds,
        expected_engine_id=engine.engine_id,
        expected_submitted_at=job.submitted_at,
        on_snapshot=lambda snapshot: ledger.record_snapshot(
            request_sha256, snapshot
        ),
        **poll_kwargs,
    )
    ledger.record_outcome(request_sha256, outcome)
    return outcome
