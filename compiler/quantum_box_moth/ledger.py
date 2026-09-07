"""Hash-validated, mode-0600 job ledger for one-shot approved submissions."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Dict, Optional

from .canonical import canonical_json, sha256_json
from .engine_contracts import ENGINE_CONTRACTS
from .models import (
    ContractError,
    EngineContract,
    MutationApproval,
    PollOutcome,
    StatusSnapshot,
    SubmittedJob,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class JobLedger:
    def __init__(self, root: Optional[Path] = None) -> None:
        self.root = root or Path(__file__).resolve().parents[2] / ".moth-cache"
        self.path = self.root / "jobs" / "quantum-box-ledger-v1.json"

    def prepare(self) -> None:
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(str(self.root), 0o700)
        for name in ("jobs", "results", "assets", "candidates"):
            path = self.root / name
            path.mkdir(mode=0o700, exist_ok=True)
            os.chmod(str(path), 0o700)

    @staticmethod
    def _envelope(payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "schemaVersion": "quantum-box-moth-job-ledger-v1",
            "payload": payload,
            "payloadSha256": sha256_json(payload),
        }

    def _write_atomic(self, value: Dict[str, Any]) -> None:
        self.prepare()
        data = (canonical_json(value) + "\n").encode("utf-8")
        descriptor, temporary = tempfile.mkstemp(
            prefix=self.path.name + ".", dir=str(self.path.parent)
        )
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, str(self.path))
            os.chmod(str(self.path), 0o600)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _write_immutable(self, path: Path, data: bytes) -> Path:
        self.prepare()
        try:
            descriptor = os.open(
                str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600
            )
        except FileExistsError:
            if path.read_bytes() != data:
                raise ContractError(str(path), "immutable cache entry changed bytes")
            return path
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        return path

    def read(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"attempts": []}
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(self.path), "ledger is unreadable") from error
        if (
            not isinstance(value, dict)
            or set(value) != {"schemaVersion", "payload", "payloadSha256"}
            or value["schemaVersion"] != "quantum-box-moth-job-ledger-v1"
            or not isinstance(value["payload"], dict)
            or sha256_json(value["payload"]) != value["payloadSha256"]
        ):
            raise ContractError(str(self.path), "ledger envelope or hash is invalid")
        self._validate(value["payload"])
        return value["payload"]

    def _save(self, payload: Dict[str, Any]) -> None:
        self._validate(payload)
        self._write_atomic(self._envelope(payload))

    @staticmethod
    def _validate(payload: Dict[str, Any]) -> None:
        if set(payload) != {"attempts"} or not isinstance(payload["attempts"], list):
            raise ContractError("ledger", "top-level fields are invalid")
        seen = set()
        allowed_states = {
            "reserved-before-post",
            "accepted",
            "ambiguous-no-retry",
            "http-failure-no-retry",
            "polling-ended-locally",
            "observed-terminal",
        }
        for index, attempt in enumerate(payload["attempts"]):
            if not isinstance(attempt, dict):
                raise ContractError(
                    "ledger.attempts[{}]".format(index), "must be an object"
                )
            identity = (attempt.get("engineId"), attempt.get("requestSha256"))
            if identity in seen:
                raise ContractError("ledger.attempts", "contains a duplicate request")
            seen.add(identity)
            if (
                not isinstance(identity[0], str)
                or re.fullmatch(r"[0-9a-f]{64}", str(identity[1])) is None
                or re.fullmatch(
                    r"[0-9a-f]{64}", str(attempt.get("engineCanonicalSha256"))
                )
                is None
                or re.fullmatch(
                    r"[0-9a-f]{64}", str(attempt.get("approvalNoteSha256"))
                )
                is None
                or attempt.get("state") not in allowed_states
                or type(attempt.get("listedCreditsReserved")) is not int
                or attempt["listedCreditsReserved"] < 0
            ):
                raise ContractError(
                    "ledger.attempts[{}]".format(index), "identity or state is invalid"
                )
            contract = ENGINE_CONTRACTS.get(identity[0])
            if (
                contract is None
                or attempt["engineCanonicalSha256"] != contract.canonical_sha256
                or attempt["listedCreditsReserved"] != contract.credits_per_run
            ):
                raise ContractError(
                    "ledger.attempts[{}]".format(index),
                    "does not match a pinned engine identity and credit listing",
                )
        serialized = canonical_json(payload)
        if (
            re.search(r"(?i)bearer\s+[^\s,;]+", serialized)
            or re.search(r"moth_[A-Za-z0-9._~-]{8,}", serialized)
            or "http://" in serialized
            or "https://" in serialized
            or "presigned" in serialized.lower()
        ):
            raise ContractError("ledger", "secret or URL material is forbidden")

    def reserve_submission(
        self,
        engine: EngineContract,
        request_body: Dict[str, Any],
        approval: MutationApproval,
    ) -> None:
        approval.validate(engine, request_body)
        payload = self.read()
        attempts = payload["attempts"]
        if any(
            item.get("engineId") == engine.engine_id
            and item.get("requestSha256") == approval.request_sha256
            for item in attempts
            if isinstance(item, dict)
        ):
            raise ContractError(
                "ledger", "the exact request already consumed its one POST allowance"
            )
        attempts.append(
            {
                "engineId": engine.engine_id,
                "engineCanonicalSha256": engine.canonical_sha256,
                "requestSha256": approval.request_sha256,
                "approvalNoteSha256": approval.approval_note_sha256,
                "listedCreditsReserved": engine.credits_per_run,
                "state": "reserved-before-post",
                "reservedAtUtc": utc_now(),
                "outcome": None,
            }
        )
        self._save(payload)

    @staticmethod
    def _attempt(payload: Dict[str, Any], request_sha256: str) -> Dict[str, Any]:
        attempt = next(
            (
                item
                for item in payload.get("attempts", [])
                if item.get("requestSha256") == request_sha256
            ),
            None,
        )
        if not isinstance(attempt, dict):
            raise ContractError("ledger", "the request is not reserved")
        return attempt

    def record_accepted(self, request_sha256: str, job: SubmittedJob) -> None:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        if attempt.get("state") != "reserved-before-post":
            raise ContractError("ledger", "accepted response cannot overwrite state")
        attempt.update(
            {
                "state": "accepted",
                "jobId": job.job_id,
                "submittedAt": job.submitted_at,
                "initialStatus": job.status,
            }
        )
        self._save(payload)

    def record_ambiguous(self, request_sha256: str, detail: str) -> None:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        attempt.update(
            {
                "state": "ambiguous-no-retry",
                "outcome": "ambiguous",
                "safeDetail": detail[:500],
            }
        )
        self._save(payload)

    def record_http_failure(
        self, request_sha256: str, status: Optional[int], detail: str
    ) -> None:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        attempt.update(
            {
                "state": "http-failure-no-retry",
                "outcome": "not-accepted-or-remote-state-unknown",
                "httpStatus": status,
                "safeDetail": detail[:500],
            }
        )
        self._save(payload)

    def record_snapshot(self, request_sha256: str, snapshot: StatusSnapshot) -> None:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        snapshots = attempt.setdefault("statusSnapshots", [])
        snapshots.append(
            {
                "status": snapshot.status,
                "submittedAt": snapshot.submitted_at,
                "updatedAt": snapshot.updated_at,
                "rawStatusSha256": sha256_json(snapshot.raw),
                "observedAtUtc": utc_now(),
            }
        )
        self._save(payload)

    def record_outcome(
        self, request_sha256: str, outcome: PollOutcome
    ) -> Optional[Path]:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        result_path = None
        if outcome.result is not None:
            result = outcome.result
            result_path = self.root / "results" / "{}.bin".format(
                result.raw_sha256
            )
            self._write_immutable(result_path, result.raw_bytes)
            metadata = {
                "transport": result.transport,
                "contentType": result.content_type,
                "outputAssetId": result.output_asset_id,
                "rawResultSha256": result.raw_sha256,
                "sizeBytes": len(result.raw_bytes),
                "retrievedAtUtc": utc_now(),
                "metadata": result.metadata,
            }
            self._write_immutable(
                self.root / "results" / "{}.json".format(result.raw_sha256),
                (canonical_json(metadata) + "\n").encode("utf-8"),
            )
        mapped = (
            "completed-result-retrieved"
            if outcome.state == "completed" and outcome.result is not None
            else outcome.state
        )
        attempt.update(
            {
                "state": (
                    "observed-terminal"
                    if outcome.terminal_observed_at_utc
                    else "polling-ended-locally"
                ),
                "outcome": mapped,
                "terminalObservedAtUtc": outcome.terminal_observed_at_utc,
                "safeDetail": outcome.detail,
                "rawResultSha256": (
                    outcome.result.raw_sha256 if outcome.result is not None else None
                ),
            }
        )
        self._save(payload)
        return result_path

    def submitted_job(self, request_sha256: str) -> SubmittedJob:
        payload = self.read()
        attempt = self._attempt(payload, request_sha256)
        if attempt.get("state") not in ("accepted", "polling-ended-locally"):
            raise ContractError("ledger", "selected job is not resumable")
        values = (
            attempt.get("jobId"),
            attempt.get("initialStatus"),
            attempt.get("submittedAt"),
        )
        if not all(isinstance(value, str) and value for value in values):
            raise ContractError("ledger", "accepted job identity is incomplete")
        return SubmittedJob(values[0], values[1], values[2])
