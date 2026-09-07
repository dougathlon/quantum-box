"""Conservative safe-GET polling over the documented status vocabulary."""

from __future__ import annotations

from datetime import datetime, timezone
import random
import time
from typing import Callable, List, Optional

from .models import (
    ContractError,
    INTERMEDIATE_STATUSES,
    TERMINAL_STATUSES,
    MothApiError,
    PollOutcome,
    ResultGoneError,
    ResultNotReadyError,
    StatusSnapshot,
    UnsupportedStatusError,
)


RETRYABLE_SAFE_GET_STATUSES = frozenset((429, 500, 502, 503, 504))


def _retry_delay(
    error: MothApiError, delay: float, maximum_delay: float, random_source
) -> float:
    pause = (
        error.retry_after_seconds
        if error.retry_after_seconds is not None
        else delay + random_source.uniform(0.0, delay * 0.2)
    )
    return min(maximum_delay, max(0.05, pause))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def poll_job(
    client,
    job_id: str,
    *,
    timeout_seconds: float = 300.0,
    initial_delay: float = 1.0,
    maximum_delay: float = 12.0,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    jitter: Optional[random.Random] = None,
    on_snapshot: Optional[Callable[[StatusSnapshot], None]] = None,
    expected_engine_id: Optional[str] = None,
    expected_submitted_at: Optional[str] = None,
) -> PollOutcome:
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")
    random_source = jitter or random.SystemRandom()
    deadline = monotonic() + timeout_seconds
    delay = max(0.05, initial_delay)
    snapshots: List[StatusSnapshot] = []
    while monotonic() < deadline:
        try:
            snapshot = client.status(job_id)
        except MothApiError as error:
            if error.status not in RETRYABLE_SAFE_GET_STATUSES:
                raise
            sleep(_retry_delay(error, delay, maximum_delay, random_source))
            delay = min(maximum_delay, delay * 2.0)
            continue

        snapshots.append(snapshot)
        if expected_engine_id is not None and snapshot.engine_id != expected_engine_id:
            raise ContractError(
                "job status.engine_id", "does not match the submitted engine"
            )
        if (
            expected_submitted_at is not None
            and snapshot.submitted_at != expected_submitted_at
        ):
            raise ContractError(
                "job status.submitted_at",
                "does not match the accepted submission",
            )
        if on_snapshot is not None:
            on_snapshot(snapshot)
        status = snapshot.status
        if status not in INTERMEDIATE_STATUSES and status not in TERMINAL_STATUSES:
            raise UnsupportedStatusError(status)
        if status in ("failed", "cancelled"):
            return PollOutcome(
                status,
                tuple(snapshots),
                None,
                utc_now(),
                "terminal status returned by Moth",
            )
        if status == "completed":
            try:
                result = client.result(job_id)
                return PollOutcome(
                    "completed",
                    tuple(snapshots),
                    result,
                    utc_now(),
                    "completed result retrieved",
                )
            except ResultNotReadyError:
                pass
            except ResultGoneError:
                return PollOutcome(
                    "gone",
                    tuple(snapshots),
                    None,
                    utc_now(),
                    "result endpoint returned documented 410 Gone",
                )
            except MothApiError as error:
                if error.status not in RETRYABLE_SAFE_GET_STATUSES:
                    raise
                sleep(_retry_delay(error, delay, maximum_delay, random_source))
                delay = min(maximum_delay, delay * 2.0)
                continue

        sleep(
            min(
                maximum_delay,
                delay + random_source.uniform(0.0, delay * 0.2),
            )
        )
        delay = min(maximum_delay, delay * 2.0)

    return PollOutcome(
        "pending-unknown",
        tuple(snapshots),
        None,
        None,
        "local timeout; remote job is not classified as failed",
    )
