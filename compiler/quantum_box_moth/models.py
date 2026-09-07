"""Immutable lifecycle records and fail-closed errors."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from .canonical import sha256_json


API_VERSION = "0.1.0"
API_SPECIFICATION_SHA256 = (
    "de1a2956b0751079ae98627ffd1b40b0bf967ba9998f6db1551c7473d4455a8d"
)
INTERMEDIATE_STATUSES = frozenset(("queued", "processing"))
TERMINAL_STATUSES = frozenset(("completed", "failed", "cancelled"))


@dataclass(frozen=True)
class ContractError(Exception):
    location: str
    detail: str

    def __str__(self) -> str:
        return "Moth contract validation failed at {}: {}".format(
            self.location, self.detail
        )


@dataclass(frozen=True)
class MothApiError(Exception):
    status: Optional[int]
    title: str
    detail: str
    retry_after_seconds: Optional[float] = None

    def __str__(self) -> str:
        prefix = "Moth API" if self.status is None else "Moth API HTTP {}".format(
            self.status
        )
        return "{}: {}: {}".format(prefix, self.title, self.detail)


class AmbiguousMutationError(MothApiError):
    """A POST or PUT may have reached its target and must not be repeated blindly."""


class ResultNotReadyError(MothApiError):
    pass


class ResultGoneError(MothApiError):
    pass


@dataclass(frozen=True)
class UnsupportedStatusError(Exception):
    status: str

    def __str__(self) -> str:
        return "Moth returned unsupported job status {!r}".format(self.status)


@dataclass(frozen=True)
class EngineContract:
    engine_id: str
    canonical_sha256: str
    redacted_sha256: str
    updated_at: str
    credits_per_run: int
    input_slots: Tuple[str, ...]
    output_type: str
    result_contract_state: str
    unresolved_gaps: Tuple[str, ...]


@dataclass(frozen=True)
class MutationApproval:
    """Reviewed local receipt; constructing this record is not itself approval."""

    engine_id: str
    engine_canonical_sha256: str
    request_sha256: str
    listed_credits: int
    approved_at_utc: str
    approval_note_sha256: str
    asset_sha256: Optional[str] = None

    def validate(self, engine: EngineContract, request_body: Dict[str, Any]) -> None:
        if self.engine_id != engine.engine_id:
            raise ContractError("approval.engineId", "does not match the engine")
        if self.engine_canonical_sha256 != engine.canonical_sha256:
            raise ContractError(
                "approval.engineCanonicalSha256", "does not match the pinned engine"
            )
        if self.request_sha256 != sha256_json(request_body):
            raise ContractError("approval.requestSha256", "does not match the request")
        if self.listed_credits != engine.credits_per_run:
            raise ContractError("approval.listedCredits", "does not match the listing")
        if not self.approved_at_utc or len(self.approval_note_sha256) != 64:
            raise ContractError("approval", "lacks review time or note digest")


@dataclass(frozen=True)
class SubmittedJob:
    job_id: str
    status: str
    submitted_at: str


@dataclass(frozen=True)
class StatusSnapshot:
    job_id: str
    engine_id: str
    status: str
    submitted_at: str
    updated_at: str
    raw: Dict[str, Any]


@dataclass(frozen=True)
class RetrievedResult:
    transport: str
    raw_bytes: bytes
    raw_sha256: str
    content_type: Optional[str]
    output_asset_id: Optional[str]
    metadata: Dict[str, Any]


@dataclass(frozen=True)
class UploadedAsset:
    asset_id: str
    content_type: str
    byte_sha256: str
    size_bytes: int


@dataclass(frozen=True)
class PollOutcome:
    state: str
    snapshots: Tuple[StatusSnapshot, ...]
    result: Optional[RetrievedResult]
    terminal_observed_at_utc: Optional[str]
    detail: str
