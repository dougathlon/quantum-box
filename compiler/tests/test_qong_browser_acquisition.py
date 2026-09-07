from __future__ import annotations

import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from compiler.quantum_box_moth.canonical import canonical_bytes
from compiler.quantum_box_moth.models import ContractError
from compiler.quantum_box_moth.qong_acquisition import QongAcquisitionLedger
from compiler.quantum_box_moth.qong_browser_acquisition import (
    MIXED_BACKEND_POLICY,
    STATUS_SCHEMA,
    accept_browser_job,
    adopt_prior_browser_reservation,
    browser_acquisition_report,
    capture_completed_browser_status,
    capture_failed_browser_status,
    import_prior_browser_capture,
    prepare_browser_preflight,
    reserve_next_browser_item,
    retry_failed_browser_item,
    validate_browser_preflight,
)


AUTHORIZATION_SHA256 = "a" * 64


def fixture_preflight():
    return prepare_browser_preflight(
        contract_observed_at_utc="2026-08-31T13:55:00Z",
        authorized_at_utc="2026-08-31T13:56:00Z",
        authorization_note_sha256=AUTHORIZATION_SHA256,
    )


def fixture_mixed_preflight():
    return prepare_browser_preflight(
        contract_observed_at_utc="2026-08-31T13:55:00Z",
        authorized_at_utc="2026-08-31T13:56:00Z",
        authorization_note_sha256=AUTHORIZATION_SHA256,
        backend_policy=MIXED_BACKEND_POLICY,
    )


def completed_status(job_id, backend="ibm_fixture", outcome="tails"):
    return {
        "$schema": STATUS_SCHEMA,
        "job_id": job_id,
        "engine_id": "coin-toss-v1",
        "status": "completed",
        "progress": {"detail": "Counting results", "step": "postprocess"},
        "steps": [
            {
                "extra": {
                    "backend_name": None,
                    "mode": "qpu",
                    "qpu_instance": None,
                    "qpu_token": None,
                    "shots": 1,
                },
                "name": "build",
                "output_type": "application/x-qasm",
                "status": "completed",
            },
            {
                "name": "submit",
                "output_type": "application/json",
                "status": "completed",
            },
            {
                "name": "collect",
                "output_type": "application/json",
                "status": "completed",
            },
            {
                "name": "format",
                "output_type": "application/json",
                "status": "completed",
            },
        ],
        "result": {
            "backend": backend,
            "heads": 1 if outcome == "heads" else 0,
            "ibm_job_id": "hardware-{}".format(job_id[:8]),
            "mode": "qpu",
            "output": outcome,
            "shots": 1,
            "tails": 1 if outcome == "tails" else 0,
        },
        "warnings": [],
        "submitted_at": "2026-08-31T14:00:00Z",
        "updated_at": "2026-08-31T14:00:02Z",
    }


def failed_status(job_id):
    status = completed_status(job_id)
    status["status"] = "failed"
    status.pop("result")
    status["error"] = {
        "code": "QPU_BACKEND_ERROR",
        "message": "The provider rejected the queued hardware execution.",
        "retryable": True,
    }
    return status


class QongBrowserAcquisitionTests(unittest.TestCase):
    def test_preflight_binds_visible_contract_authorization_and_exact_plan(self):
        preflight = fixture_preflight()
        validate_browser_preflight(preflight)
        self.assertEqual(preflight["access"]["basis"], "user-confirmed-free-access")
        self.assertIsNone(preflight["access"]["listedCreditsPerRun"])
        self.assertEqual(preflight["plan"]["expectedJobCount"], 120)
        self.assertEqual(preflight["plan"]["jobs"][0]["itemId"], "f001")
        self.assertEqual(preflight["plan"]["jobs"][-1]["itemId"], "s064")
        tampered = copy.deepcopy(preflight)
        tampered["contract"]["priceDisplay"] = "invented"
        with self.assertRaises(ContractError):
            validate_browser_preflight(tampered)
        with self.assertRaisesRegex(ContractError, "chronological"):
            prepare_browser_preflight(
                contract_observed_at_utc="2026-08-31T13:57:00Z",
                authorized_at_utc="2026-08-31T13:56:00Z",
                authorization_note_sha256=AUTHORIZATION_SHA256,
            )

    def test_reserve_accept_capture_is_one_job_and_resumable(self):
        preflight = fixture_preflight()
        job_id = "11111111-1111-1111-1111-111111111111"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reservation = reserve_next_browser_item(
                preflight_value=preflight, cache_root=cache
            )
            self.assertEqual(reservation["itemId"], "f001")
            with self.assertRaisesRegex(ContractError, "ambiguous"):
                reserve_next_browser_item(
                    preflight_value=preflight, cache_root=cache
                )
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            capture = capture_completed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:03Z",
                raw_status=canonical_bytes(completed_status(job_id)),
            )
            self.assertEqual(capture["state"], "captured")
            self.assertEqual(capture["backendName"], "ibm_fixture")
            adopted = adopt_prior_browser_reservation(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                reserved_at_utc="2026-08-31T13:59:59Z",
                reservation_receipt_sha256="b" * 64,
                adopted_at_utc="2026-08-31T14:00:04Z",
            )
            self.assertEqual(adopted["reservedAtUtc"], "2026-08-31T13:59:59Z")
            report = browser_acquisition_report(
                preflight_value=preflight, cache_root=cache
            )
            self.assertEqual(report["captured"], 1)
            self.assertEqual(report["remaining"], 119)
            self.assertEqual(len(report["ledgerPayloadSha256"]), 64)
            self.assertEqual(len(report["ledgerByteSha256"]), 64)
            second = reserve_next_browser_item(
                preflight_value=preflight, cache_root=cache
            )
            self.assertEqual(second["itemId"], "f002")

    def test_non_null_credential_like_status_is_rejected_before_storage(self):
        preflight = fixture_preflight()
        job_id = "22222222-2222-2222-2222-222222222222"
        status = completed_status(job_id)
        status["steps"][0]["extra"]["qpu_token"] = "must-not-be-stored"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            with self.assertRaisesRegex(ContractError, "credential-like"):
                capture_completed_browser_status(
                    preflight_value=preflight,
                    cache_root=cache,
                    item_id="f001",
                    terminal_observed_at_utc="2026-08-31T14:00:03Z",
                    raw_status=canonical_bytes(status),
                )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            self.assertEqual(ledger.read()["attempts"]["f001"]["state"], "accepted")
            self.assertFalse((ledger.capture_dir / "f001.json").exists())

    def test_backend_mismatch_is_durably_captured_and_terminal(self):
        preflight = fixture_preflight()
        first_job = "33333333-3333-3333-3333-333333333333"
        second_job = "44444444-4444-4444-4444-444444444444"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=first_job,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            capture_completed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:03Z",
                raw_status=canonical_bytes(
                    completed_status(first_job, backend="ibm_first")
                ),
            )
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f002",
                job_id=second_job,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            with self.assertRaisesRegex(ContractError, "canary-established"):
                capture_completed_browser_status(
                    preflight_value=preflight,
                    cache_root=cache,
                    item_id="f002",
                    terminal_observed_at_utc="2026-08-31T14:00:03Z",
                    raw_status=canonical_bytes(
                        completed_status(second_job, backend="ibm_second")
                    ),
                )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            self.assertEqual(
                ledger.read()["attempts"]["f002"]["state"], "backend-mismatch"
            )
            self.assertTrue((ledger.capture_dir / "f002.json").is_file())
            report = browser_acquisition_report(
                preflight_value=preflight, cache_root=cache
            )
            self.assertTrue(report["blocked"])
            self.assertEqual(report["terminalFailures"], 1)
            self.assertEqual(report["unattempted"], 118)
            with self.assertRaisesRegex(ContractError, "terminal"):
                reserve_next_browser_item(
                    preflight_value=preflight, cache_root=cache
                )

    def test_mixed_backend_preflight_records_each_provider_selected_backend(self):
        preflight = fixture_mixed_preflight()
        self.assertEqual(
            preflight["schemaVersion"], "quantum-box-qong-showcase-preflight-v2"
        )
        self.assertEqual(preflight["backendPolicy"], MIXED_BACKEND_POLICY)
        validate_browser_preflight(preflight)
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            for item_id, digit, backend in (
                ("f001", "5", "ibm_first"),
                ("f002", "6", "ibm_second"),
            ):
                job_id = "{0}{0}{0}{0}{0}{0}{0}{0}-{0}{0}{0}{0}-{0}{0}{0}{0}-{0}{0}{0}{0}-{0}{0}{0}{0}{0}{0}{0}{0}{0}{0}{0}{0}".format(digit)
                reservation = reserve_next_browser_item(
                    preflight_value=preflight, cache_root=cache
                )
                self.assertEqual(reservation["itemId"], item_id)
                accept_browser_job(
                    preflight_value=preflight,
                    cache_root=cache,
                    item_id=item_id,
                    job_id=job_id,
                    accepted_observed_at_utc="2026-08-31T14:00:01Z",
                )
                result = capture_completed_browser_status(
                    preflight_value=preflight,
                    cache_root=cache,
                    item_id=item_id,
                    terminal_observed_at_utc="2026-08-31T14:00:03Z",
                    raw_status=canonical_bytes(
                        completed_status(job_id, backend=backend)
                    ),
                )
                self.assertEqual(result["state"], "captured")
            report = browser_acquisition_report(
                preflight_value=preflight, cache_root=cache
            )
            self.assertFalse(report["blocked"])
            self.assertEqual(report["backendNames"], ["ibm_first", "ibm_second"])
            self.assertIsNone(report["backendName"])

    def test_bounded_pending_window_reserves_distinct_ordered_items(self):
        preflight = fixture_mixed_preflight()
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            with self.assertRaisesRegex(ContractError, "1 through 16"):
                reserve_next_browser_item(
                    preflight_value=preflight,
                    cache_root=cache,
                    max_pending=17,
                )
            reservations = [
                reserve_next_browser_item(
                    preflight_value=preflight,
                    cache_root=cache,
                    max_pending=3,
                )
                for _ in range(3)
            ]
            self.assertEqual(
                [reservation["itemId"] for reservation in reservations],
                ["f001", "f002", "f003"],
            )
            with self.assertRaisesRegex(ContractError, "maximum pending"):
                reserve_next_browser_item(
                    preflight_value=preflight,
                    cache_root=cache,
                    max_pending=3,
                )

    def test_import_preserves_retired_capture_and_status_hashes(self):
        strict = fixture_preflight()
        mixed = fixture_mixed_preflight()
        job_id = "77777777-7777-7777-7777-777777777777"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=strict, cache_root=cache)
            accept_browser_job(
                preflight_value=strict,
                cache_root=cache,
                item_id="f001",
                job_id=job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            original = capture_completed_browser_status(
                preflight_value=strict,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:03Z",
                raw_status=canonical_bytes(completed_status(job_id)),
            )
            imported = import_prior_browser_capture(
                preflight_value=mixed,
                cache_root=cache,
                source_preflight_sha256=strict["contentSha256"],
                item_id="f001",
                imported_at_utc="2099-01-01T00:00:00Z",
            )
            self.assertEqual(
                imported["captureContentSha256"],
                original["captureContentSha256"],
            )
            mixed_ledger = QongAcquisitionLedger(cache, mixed["contentSha256"])
            attempt = mixed_ledger.read()["attempts"]["f001"]
            self.assertEqual(attempt["backendPolicy"], MIXED_BACKEND_POLICY)
            self.assertEqual(
                attempt["importedFromPreflightContentSha256"],
                strict["contentSha256"],
            )
            self.assertEqual(
                (mixed_ledger.capture_dir / "f001.json").read_bytes(),
                (QongAcquisitionLedger(cache, strict["contentSha256"]).capture_dir / "f001.json").read_bytes(),
            )

    def test_capture_retry_reuses_immutable_files_after_ledger_update_crash(self):
        preflight = fixture_mixed_preflight()
        job_id = "88888888-8888-8888-8888-888888888888"
        raw_status = canonical_bytes(completed_status(job_id))
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            with patch(
                "compiler.quantum_box_moth.qong_browser_acquisition._established_backend_name",
                side_effect=ContractError("fixture", "crash after immutable write"),
            ):
                with self.assertRaisesRegex(ContractError, "immutable write"):
                    capture_completed_browser_status(
                        preflight_value=preflight,
                        cache_root=cache,
                        item_id="f001",
                        terminal_observed_at_utc="2026-08-31T14:00:03Z",
                        raw_status=raw_status,
                    )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            immutable_bytes = (ledger.capture_dir / "f001.json").read_bytes()
            retry = capture_completed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:04Z",
                raw_status=raw_status,
            )
            self.assertEqual(retry["state"], "captured")
            self.assertEqual(
                (ledger.capture_dir / "f001.json").read_bytes(), immutable_bytes
            )

    def test_terminal_provider_failure_is_preserved_without_a_gameplay_capture(self):
        preflight = fixture_mixed_preflight()
        job_id = "99999999-9999-9999-9999-999999999999"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            failure = capture_failed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:03Z",
                raw_status=canonical_bytes(failed_status(job_id)),
            )
            self.assertEqual(failure["state"], "failed")
            self.assertEqual(
                failure["providerError"]["code"], "QPU_BACKEND_ERROR"
            )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            self.assertFalse((ledger.capture_dir / "f001.json").exists())
            self.assertTrue((ledger.root / "statuses" / "f001.json").is_file())
            report = browser_acquisition_report(
                preflight_value=preflight, cache_root=cache
            )
            self.assertTrue(report["blocked"])
            self.assertEqual(report["terminalFailures"], 1)

    def test_retryable_failure_uses_distinct_attempt_status_and_preserves_history(self):
        preflight = fixture_mixed_preflight()
        failed_job_id = "99999999-9999-9999-9999-999999999999"
        retry_job_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            reserve_next_browser_item(preflight_value=preflight, cache_root=cache)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=failed_job_id,
                accepted_observed_at_utc="2026-08-31T14:00:01Z",
            )
            capture_failed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:03Z",
                raw_status=canonical_bytes(failed_status(failed_job_id)),
            )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            first_status_path = ledger.root / "statuses" / "f001.json"
            first_status_bytes = first_status_path.read_bytes()
            with patch(
                "compiler.quantum_box_moth.qong_browser_acquisition.utc_now",
                return_value="2026-08-31T14:00:05Z",
            ):
                retry = retry_failed_browser_item(
                    preflight_value=preflight,
                    cache_root=cache,
                    item_id="f001",
                    retry_authorized_at_utc="2026-08-31T14:00:04Z",
                )
            self.assertEqual(retry["attemptNumber"], 2)
            accept_browser_job(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                job_id=retry_job_id,
                accepted_observed_at_utc="2026-08-31T14:00:06Z",
            )
            completed = completed_status(retry_job_id)
            completed["submitted_at"] = "2026-08-31T14:00:06Z"
            completed["updated_at"] = "2026-08-31T14:00:07Z"
            result = capture_completed_browser_status(
                preflight_value=preflight,
                cache_root=cache,
                item_id="f001",
                terminal_observed_at_utc="2026-08-31T14:00:08Z",
                raw_status=canonical_bytes(completed),
            )
            self.assertEqual(result["state"], "captured")
            self.assertEqual(first_status_path.read_bytes(), first_status_bytes)
            self.assertTrue(
                (ledger.root / "statuses" / "f001-attempt-2.json").is_file()
            )
            attempt = ledger.read()["attempts"]["f001"]
            self.assertEqual(attempt["attemptNumber"], 2)
            self.assertEqual(attempt["priorAttempts"][0]["state"], "failed")
            self.assertEqual(
                attempt["priorAttempts"][0]["jobId"], failed_job_id
            )
            report = browser_acquisition_report(
                preflight_value=preflight, cache_root=cache
            )
            self.assertEqual(report["providerAttemptCount"], 2)
            self.assertEqual(report["historicalStates"], {"failed": 1})
            self.assertEqual(report["historicalTerminalFailures"], 1)
            self.assertEqual(report["terminalFailures"], 0)


if __name__ == "__main__":
    unittest.main()
