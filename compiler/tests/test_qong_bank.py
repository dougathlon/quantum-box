from __future__ import annotations

import copy
import json
from pathlib import Path
import tempfile
import unittest

from compiler.quantum_box_moth.canonical import canonical_bytes, sha256_json
from compiler.quantum_box_moth.models import ContractError
from compiler.quantum_box_moth.models import (
    AmbiguousMutationError,
    ResultGoneError,
    RetrievedResult,
    StatusSnapshot,
    SubmittedJob,
)
from compiler.quantum_box_moth.qong_acquisition import (
    QongAcquisitionLedger,
    acquire_qong_bank,
    create_approval,
    validate_approval,
)
from compiler.quantum_box_moth.qong_browser_acquisition import (
    MIXED_BACKEND_POLICY,
    prepare_browser_preflight,
)
from compiler.quantum_box_moth.qong_bank import (
    EXPECTED_JOB_COUNT,
    REQUEST_BODY,
    assemble_bank,
    capture_from_result,
    coin_engine_report,
    inspect_first_rally_candidates,
    planned_items,
    prepare_preflight,
    promote_bank,
    validate_capture,
    validate_preflight,
)


def engine_record():
    fields = "backend heads ibm_job_id mode output shots tails"
    return {
        "engine_id": "coin-toss-v1",
        "name": "Coin Toss",
        "updated_at": "2026-08-27T01:00:00Z",
        "credits_per_run": 2,
        "is_multipart": False,
        "input_files": [],
        "output_type": "application/json",
        "is_async": True,
        "queue": "quantum",
        "run_policy": "queued",
        "params_schema": {
            "properties": {
                "shots": {"type": "integer", "minimum": 1, "maximum": 32768},
                "mode": {"type": "string", "enum": ["emu", "qpu"]},
            }
        },
        "code_samples": [{"source": fields}],
        "description": "Hardware-derived coin toss.",
        "description_md": fields,
    }


def fixture_preflight():
    inspection = coin_engine_report(engine_record())
    return prepare_preflight(
        inspection, inspection["canonicalEngineRecordSha256"]
    )


def fixture_mixed_browser_preflight():
    return prepare_browser_preflight(
        contract_observed_at_utc="2026-08-31T15:56:01Z",
        authorized_at_utc="2026-08-31T15:56:01Z",
        authorization_note_sha256=(
            "ffb5f01c6559c39eaf3f4dbad32c698999089e88232b65906c741a0dad1fff35"
        ),
        backend_policy=MIXED_BACKEND_POLICY,
    )


def fixture_captures():
    captures = []
    for index, item in enumerate(planned_items()):
        is_selected_candidate = index in (1, 3, 5, 7)
        outcome = (
            "tails"
            if is_selected_candidate
            else "heads"
            if index % 2 == 0
            else "tails"
        )
        result = {
            "backend": "ibm_fixture",
            "heads": 1 if outcome == "heads" else 0,
            "ibm_job_id": "hardware-{:03d}".format(index),
            "mode": "qpu",
            "output": outcome,
            "shots": 1,
            "tails": 1 if outcome == "tails" else 0,
        }
        captures.append(
            capture_from_result(
                item_id=item["itemId"],
                moth_job_id="moth-{:03d}".format(index),
                **capture_provenance(index),
                raw_result=canonical_bytes(result),
            )
        )
    return captures


def capture_provenance(index):
    minute = index % 60
    return {
        "submitted_at": "2026-08-31T16:{:02d}:00Z".format(minute),
        "provider_updated_at": "2026-08-31T16:{:02d}:15Z".format(minute),
        "terminal_observed_at": "2026-08-31T16:{:02d}:30Z".format(minute),
        "retrieved_at": "2026-08-31T16:{:02d}:45Z".format(minute),
        "terminal_status_sha256": sha256_json(
            {"item": index, "status": "completed"}
        ),
    }


def fixture_selector_completion():
    blocked = []
    for index in range(46, 50):
        blocked.append(
            {
                "itemId": "s{:03d}".format(index),
                "mothJobId": "blocked-moth-{:03d}".format(index),
                "terminalStatusSha256": "{:064x}".format(4000 + index),
                "providerErrorSha256": "{:064x}".format(5000 + index),
                "errorType": "unavailable",
                "errorRetryable": False,
            }
        )
    material = {
        "schemaVersion": "quantum-box-qong-selector-completion-v1",
        "strategy": (
            "largest-even-prefix-before-nonretryable-provider-blocker-v1"
        ),
        "authorizedSelectorBitCount": 64,
        "installedSelectorBitCount": 44,
        "lastIncludedItemId": "s044",
        "unpairedCaptureItemId": "s045",
        "unpairedCaptureContentSha256": "6" * 64,
        "blockedItems": blocked,
        "unattemptedItemIds": [
            "s{:03d}".format(index) for index in range(50, 65)
        ],
        "ledgerPayloadSha256": "7" * 64,
        "ledgerByteSha256": "8" * 64,
        "stoppedMutationAtUtc": "2026-08-31T18:49:18.116Z",
    }
    return {**material, "contentSha256": sha256_json(material)}


class QongBankTests(unittest.TestCase):
    def test_showcase_preflight_assembles_truthful_adapter_v3_provenance(self):
        preflight = prepare_browser_preflight(
            contract_observed_at_utc="2026-08-31T13:55:00Z",
            authorized_at_utc="2026-08-31T13:56:00Z",
            authorization_note_sha256="a" * 64,
        )
        bank = assemble_bank(preflight, fixture_captures())
        provenance = bank["playPacks"][0]["qpuProvenance"]
        self.assertEqual(
            provenance["adapterVersion"], "qong-coin-bank-adapter-v3"
        )
        self.assertEqual(
            provenance["contractSource"], "authenticated-moth-showcase-v1"
        )
        self.assertEqual(
            provenance["contractObservedAt"], "2026-08-31T13:55:00Z"
        )
        self.assertEqual(
            provenance["canonicalEngineRecordSha256"],
            provenance["canonicalContractRecordSha256"],
        )
        self.assertNotIn("engineUpdatedAt", provenance)
        self.assertEqual(
            bank["selectorPack"]["qpuProvenance"]["adapterVersion"],
            "qong-coin-bank-adapter-v3",
        )

    def test_mixed_showcase_preflight_assembles_adapter_v4_per_job_backends(self):
        preflight = prepare_browser_preflight(
            contract_observed_at_utc="2026-08-31T13:55:00Z",
            authorized_at_utc="2026-08-31T13:56:00Z",
            authorization_note_sha256="a" * 64,
            backend_policy=MIXED_BACKEND_POLICY,
        )
        captures = fixture_captures()
        captures[1]["result"]["backend"] = "ibm_other"
        captures[1]["contentSha256"] = sha256_json(
            {
                key: value
                for key, value in captures[1].items()
                if key != "contentSha256"
            }
        )
        bank = assemble_bank(preflight, captures)
        provenance = bank["playPacks"][0]["qpuProvenance"]
        self.assertEqual(
            provenance["adapterVersion"], "qong-coin-bank-adapter-v5"
        )
        self.assertEqual(provenance["backendPolicy"], MIXED_BACKEND_POLICY)
        self.assertEqual(
            provenance["preflightContentSha256"], preflight["contentSha256"]
        )
        self.assertEqual(
            provenance["processEndpoint"],
            preflight["contract"]["processEndpoint"],
        )
        self.assertIsNone(provenance["selectorCompletion"])
        self.assertEqual(
            {job["backendName"] for job in provenance["jobs"]},
            {"ibm_fixture", "ibm_other"},
        )
        tampered = copy.deepcopy(preflight)
        tampered["backendPolicy"] = "silently-mixed"
        with self.assertRaisesRegex(ContractError, "contentSha256"):
            assemble_bank(tampered, captures)

    def test_live_report_and_preflight_bind_exact_cost_and_jobs(self):
        inspection = coin_engine_report(engine_record())
        self.assertTrue(inspection["safeToPrepareBank"])
        self.assertEqual(inspection["exactRequest"], REQUEST_BODY)
        self.assertEqual(inspection["expectedJobCount"], EXPECTED_JOB_COUNT)
        preflight = prepare_preflight(
            inspection, inspection["canonicalEngineRecordSha256"]
        )
        self.assertEqual(preflight["plan"]["expectedJobCount"], 120)
        self.assertEqual(preflight["plan"]["maximumListedCredits"], 240)
        self.assertEqual(preflight["plan"]["firstRallyCandidateCount"], 32)
        self.assertEqual(preflight["plan"]["minimumFirstRallyTails"], 4)
        self.assertEqual(
            preflight["plan"]["jobs"][0]["itemId"], "f001"
        )
        self.assertEqual(preflight["plan"]["jobs"][31]["itemId"], "f032")
        self.assertEqual(preflight["plan"]["jobs"][32]["itemId"], "p01-r02")
        self.assertEqual(preflight["plan"]["jobs"][55]["itemId"], "p04-r07")
        self.assertEqual(preflight["plan"]["jobs"][56]["itemId"], "s001")
        self.assertEqual(preflight["plan"]["jobs"][-1]["itemId"], "s064")
        validate_preflight(preflight)

    def test_preflight_rejects_unreviewed_or_incomplete_live_contract(self):
        inspection = coin_engine_report(engine_record())
        with self.assertRaises(ContractError):
            prepare_preflight(inspection, "0" * 64)
        incomplete = engine_record()
        incomplete["description_md"] = "no formal returned fields"
        incomplete["code_samples"] = []
        report = coin_engine_report(incomplete)
        self.assertFalse(report["safeToPrepareBank"])
        with self.assertRaises(ContractError):
            prepare_preflight(report, report["canonicalEngineRecordSha256"])
        synchronous = engine_record()
        synchronous["is_async"] = False
        self.assertFalse(coin_engine_report(synchronous)["safeToPrepareBank"])

    def test_capture_rejects_non_qpu_counts_and_tampering(self):
        captures = fixture_captures()
        validate_capture(captures[0], "f001")
        tampered = copy.deepcopy(captures[0])
        tampered["result"]["mode"] = "emu"
        with self.assertRaises(ContractError):
            validate_capture(tampered, "f001")
        with self.assertRaises(ContractError):
            capture_from_result(
                item_id="f001",
                moth_job_id="moth-bad",
                **capture_provenance(0),
                raw_result=json.dumps(
                    {
                        "backend": "ibm_fixture",
                        "heads": 1,
                        "ibm_job_id": "hardware-bad",
                        "mode": "emu",
                        "output": "heads",
                        "shots": 1,
                        "tails": 0,
                    }
                ).encode("utf-8"),
            )
        two_shot = copy.deepcopy(captures[0])
        two_shot_result = {
            "backend": "ibm_fixture",
            "heads": 2,
            "ibm_job_id": "hardware-two-shot",
            "mode": "qpu",
            "output": "heads",
            "shots": 2,
            "tails": 0,
        }
        with self.assertRaises(ContractError):
            capture_from_result(
                item_id="f001",
                moth_job_id="moth-two-shot",
                **capture_provenance(0),
                raw_result=canonical_bytes(two_shot_result),
            )
        reversed_times = copy.deepcopy(captures[0])
        reversed_times["providerUpdatedAt"] = "2026-08-27T01:01:00Z"
        reversed_times["terminalObservedAt"] = "2026-08-27T01:00:30Z"
        reversed_times["contentSha256"] = sha256_json(
            {
                key: value
                for key, value in reversed_times.items()
                if key != "contentSha256"
            }
        )
        with self.assertRaisesRegex(ContractError, "chronologically ordered"):
            validate_capture(reversed_times, "f001")

    def test_assembly_produces_four_ordered_packs_and_64_selector_bits(self):
        bank = assemble_bank(fixture_preflight(), fixture_captures())
        self.assertEqual(len(bank["playPacks"]), 4)
        self.assertEqual(len(bank["selectorPack"]["bits"]), 64)
        self.assertEqual(
            [job["itemId"] for job in bank["playPacks"][0]["qpuProvenance"]["jobs"]],
            ["r01", "r02", "r03", "r04", "r05", "r06", "r07"],
        )
        self.assertEqual(
            bank["playPacks"][0]["payload"]["rallyPolarities"],
            ["invert", "direct", "invert", "direct", "invert", "direct", "invert"],
        )
        self.assertEqual(bank["selectorPack"]["bits"][:4], [0, 1, 0, 1])
        self.assertEqual(
            bank["playPacks"][0]["qpuProvenance"]["jobs"][0]["mothJobId"],
            "moth-001",
        )
        provenance = bank["playPacks"][0]["qpuProvenance"]
        self.assertEqual(provenance["requestBody"], REQUEST_BODY)
        self.assertEqual(provenance["requestBodySha256"], sha256_json(REQUEST_BODY))
        first_job = provenance["jobs"][0]
        self.assertEqual(first_job["sequenceOrdinal"], 0)
        self.assertEqual(first_job["submittedAt"], "2026-08-31T16:01:00Z")
        self.assertEqual(len(first_job["providerRecordSha256"]), 64)
        postselection = bank["playPacks"][0]["qpuProvenance"]["postselection"]
        self.assertEqual(postselection["selectedCandidateItemId"], "f002")
        self.assertEqual(postselection["selectedCandidateOrdinal"], 1)
        self.assertEqual(postselection["selectedTailRank"], 0)
        self.assertEqual(postselection["candidatePoolSize"], 32)
        self.assertEqual(
            postselection["preflightContentSha256"],
            fixture_preflight()["contentSha256"],
        )
        self.assertIsNone(
            bank["selectorPack"]["qpuProvenance"]["postselection"]
        )

    def test_blocked_assembly_uses_only_one_sealed_even_selector_prefix(self):
        captures = fixture_captures()[:100]
        completion = fixture_selector_completion()
        bank = assemble_bank(
            fixture_mixed_browser_preflight(),
            captures,
            selector_bit_count=44,
            selector_completion=completion,
        )
        self.assertEqual(len(bank["selectorPack"]["bits"]), 44)
        provenance = bank["selectorPack"]["qpuProvenance"]
        self.assertEqual(
            provenance["adapterVersion"], "qong-coin-bank-adapter-v5"
        )
        self.assertEqual(provenance["selectorCompletion"], completion)
        with self.assertRaisesRegex(ContractError, "selector completion"):
            assemble_bank(
                fixture_mixed_browser_preflight(),
                captures,
                selector_bit_count=44,
            )
        tampered = copy.deepcopy(completion)
        tampered["blockedItems"][0]["errorRetryable"] = True
        tampered["contentSha256"] = sha256_json(
            {
                key: value
                for key, value in tampered.items()
                if key != "contentSha256"
            }
        )
        with self.assertRaisesRegex(ContractError, "provider stop"):
            assemble_bank(
                fixture_mixed_browser_preflight(),
                captures,
                selector_bit_count=44,
                selector_completion=tampered,
            )

    def test_candidate_report_gates_remaining_acquisition_without_network(self):
        report = inspect_first_rally_candidates(
            fixture_preflight(), fixture_captures()[:32]
        )
        self.assertTrue(report["eligibleForRemainingAcquisition"])
        self.assertEqual(report["candidateCount"], 32)
        self.assertEqual(report["tailsCount"], 16)
        self.assertEqual(
            [item["selectedCandidateItemId"] for item in report["selected"]],
            ["f002", "f004", "f006", "f008"],
        )
        self.assertEqual(report["networkCalls"], 0)

    def test_assembly_rejects_missing_duplicate_and_reordered_identity(self):
        preflight = fixture_preflight()
        captures = fixture_captures()
        with self.assertRaises(ContractError):
            assemble_bank(preflight, captures[:-1])
        duplicate = copy.deepcopy(captures)
        duplicate[1]["mothJobId"] = duplicate[0]["mothJobId"]
        duplicate[1]["contentSha256"] = __import__(
            "compiler.quantum_box_moth.canonical", fromlist=["sha256_json"]
        ).sha256_json(
            {
                key: value
                for key, value in duplicate[1].items()
                if key != "contentSha256"
            }
        )
        with self.assertRaises(ContractError):
            assemble_bank(preflight, duplicate)
        wrong_id = copy.deepcopy(captures)
        wrong_id[0]["itemId"] = "s999"
        with self.assertRaises(ContractError):
            assemble_bank(preflight, wrong_id)
        mixed_backend = copy.deepcopy(captures)
        mixed_backend[1]["result"]["backend"] = "ibm_other"
        mixed_backend[1]["contentSha256"] = sha256_json(
            {
                key: value
                for key, value in mixed_backend[1].items()
                if key != "contentSha256"
            }
        )
        with self.assertRaisesRegex(ContractError, "canary-established backend"):
            assemble_bank(preflight, mixed_backend)

    def test_assembly_rejects_fewer_than_four_tails_in_candidate_pool(self):
        captures = fixture_captures()
        for index, item in enumerate(planned_items()[:32]):
            outcome = "tails" if index < 3 else "heads"
            result = {
                "backend": "ibm_fixture",
                "heads": 1 if outcome == "heads" else 0,
                "ibm_job_id": "hardware-candidate-{:03d}".format(index),
                "mode": "qpu",
                "output": outcome,
                "shots": 1,
                "tails": 1 if outcome == "tails" else 0,
            }
            captures[index] = capture_from_result(
                item_id=item["itemId"],
                moth_job_id="moth-candidate-{:03d}".format(index),
                **capture_provenance(index),
                raw_result=canonical_bytes(result),
            )
        with self.assertRaisesRegex(ContractError, "at least four recorded tails"):
            assemble_bank(fixture_preflight(), captures)

    def test_promotion_replaces_only_the_exact_placeholder_and_exact_hash(self):
        bank = assemble_bank(fixture_preflight(), fixture_captures())
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "qong-bank.json"
            output.write_text(
                json.dumps(
                    {
                        "schemaVersion": "quantum-box-qong-bank-unavailable-v1",
                        "reason": (
                            "No complete authenticated Coin Toss QPU bank has been "
                            "promoted. Story Qong must fail closed rather than "
                            "substitute its Arcade control."
                        ),
                    }
                ),
                encoding="utf-8",
            )
            promote_bank(output, bank, bank["contentSha256"])
            installed = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(installed["contentSha256"], bank["contentSha256"])
            promote_bank(output, bank, bank["contentSha256"])
            output.write_text('{"user":"owned"}', encoding="utf-8")
            with self.assertRaises(ContractError):
                promote_bank(output, bank, bank["contentSha256"])
            with self.assertRaises(ContractError):
                promote_bank(output, bank, "0" * 64)

    def test_approval_and_acquisition_are_resumable_per_planned_item(self):
        preflight = fixture_preflight()
        approval = create_approval(
            preflight,
            approved_at_utc="2026-08-27T03:00:00Z",
            note=b"Explicit fixture approval for one exact preflight.",
        )
        validate_approval(approval, preflight)
        client = FakeQongClient()
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            first = acquire_qong_bank(
                client=client,
                preflight_value=preflight,
                approval_value=approval,
                cache_root=cache,
                max_new_jobs=1,
                timeout_seconds=1,
            )
            self.assertEqual(first["totalCaptured"], 1)
            self.assertEqual(client.submit_count, 1)
            second = acquire_qong_bank(
                client=client,
                preflight_value=preflight,
                approval_value=approval,
                cache_root=cache,
                max_new_jobs=1,
                timeout_seconds=1,
            )
            self.assertEqual(second["totalCaptured"], 2)
            self.assertEqual(client.submit_count, 2)
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            self.assertEqual(ledger.read()["attempts"]["f001"]["state"], "captured")
            self.assertTrue((ledger.capture_dir / "f001.json").is_file())

    def test_ambiguous_post_is_durable_and_never_retried(self):
        preflight = fixture_preflight()
        approval = create_approval(
            preflight,
            approved_at_utc="2026-08-27T03:00:00Z",
            note=b"Explicit fixture approval.",
        )
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            client = AmbiguousQongClient()
            with self.assertRaises(AmbiguousMutationError):
                acquire_qong_bank(
                    client=client,
                    preflight_value=preflight,
                    approval_value=approval,
                    cache_root=cache,
                    max_new_jobs=1,
                    timeout_seconds=1,
                )
            with self.assertRaises(ContractError):
                acquire_qong_bank(
                    client=client,
                    preflight_value=preflight,
                    approval_value=approval,
                    cache_root=cache,
                    max_new_jobs=1,
                    timeout_seconds=1,
                )
            self.assertEqual(client.submit_count, 1)

    def test_backend_mismatch_is_captured_and_stops_further_mutation(self):
        preflight = fixture_preflight()
        approval = create_approval(
            preflight,
            approved_at_utc="2026-08-27T03:00:00Z",
            note=b"Explicit fixture approval.",
        )
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            client = BackendMismatchQongClient()
            first = acquire_qong_bank(
                client=client,
                preflight_value=preflight,
                approval_value=approval,
                cache_root=cache,
                max_new_jobs=1,
                timeout_seconds=1,
            )
            self.assertEqual(first["backendName"], "ibm_fixture")
            with self.assertRaisesRegex(
                ContractError, "canary-established backend ibm_fixture"
            ):
                acquire_qong_bank(
                    client=client,
                    preflight_value=preflight,
                    approval_value=approval,
                    cache_root=cache,
                    max_new_jobs=1,
                    timeout_seconds=1,
                )
            ledger = QongAcquisitionLedger(cache, preflight["contentSha256"])
            self.assertEqual(
                ledger.read()["attempts"]["f002"]["state"],
                "backend-mismatch",
            )
            self.assertTrue((ledger.capture_dir / "f002.json").is_file())
            self.assertEqual(client.submit_count, 2)

    def test_result_gone_is_terminal_and_never_resubmitted(self):
        preflight = fixture_preflight()
        approval = create_approval(
            preflight,
            approved_at_utc="2026-08-27T03:00:00Z",
            note=b"Explicit fixture approval.",
        )
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            client = GoneQongClient()
            with self.assertRaises(ContractError):
                acquire_qong_bank(
                    client=client,
                    preflight_value=preflight,
                    approval_value=approval,
                    cache_root=cache,
                    max_new_jobs=1,
                    timeout_seconds=1,
                )
            with self.assertRaises(ContractError):
                acquire_qong_bank(
                    client=client,
                    preflight_value=preflight,
                    approval_value=approval,
                    cache_root=cache,
                    max_new_jobs=1,
                    timeout_seconds=1,
                )
            self.assertEqual(client.submit_count, 1)


class FakeQongClient:
    def __init__(self):
        self.submit_count = 0

    def submit(self, engine, request, approval):
        approval.validate(engine, request)
        index = self.submit_count
        self.submit_count += 1
        return SubmittedJob(
            "moth-job-{:03d}".format(index),
            "queued",
            "2026-08-27T03:{:02d}:00Z".format(index % 60),
        )

    def status(self, job_id):
        index = int(job_id.rsplit("-", 1)[1])
        submitted = "2026-08-27T03:{:02d}:00Z".format(index % 60)
        return StatusSnapshot(
            job_id,
            "coin-toss-v1",
            "completed",
            submitted,
            "2026-08-27T04:{:02d}:00Z".format(index % 60),
            {
                "job_id": job_id,
                "engine_id": "coin-toss-v1",
                "status": "completed",
                "submitted_at": submitted,
                "updated_at": "2026-08-27T04:{:02d}:00Z".format(index % 60),
            },
        )

    def result(self, job_id):
        index = int(job_id.rsplit("-", 1)[1])
        outcome = "heads" if index % 2 == 0 else "tails"
        raw = canonical_bytes(
            {
                "backend": "ibm_fixture",
                "heads": 1 if outcome == "heads" else 0,
                "ibm_job_id": "hardware-job-{:03d}".format(index),
                "mode": "qpu",
                "output": outcome,
                "shots": 1,
                "tails": 1 if outcome == "tails" else 0,
            }
        )
        return RetrievedResult(
            "inline",
            raw,
            __import__("hashlib").sha256(raw).hexdigest(),
            "application/json",
            None,
            {},
        )


class AmbiguousQongClient(FakeQongClient):
    def submit(self, engine, request, approval):
        self.submit_count += 1
        raise AmbiguousMutationError(None, "Ambiguous mutation", "fixture timeout")


class BackendMismatchQongClient(FakeQongClient):
    def result(self, job_id):
        result = super().result(job_id)
        index = int(job_id.rsplit("-", 1)[1])
        if index == 0:
            return result
        value = json.loads(result.raw_bytes.decode("utf-8"))
        value["backend"] = "ibm_other"
        raw = canonical_bytes(value)
        return RetrievedResult(
            result.transport,
            raw,
            __import__("hashlib").sha256(raw).hexdigest(),
            result.content_type,
            result.output_asset_id,
            result.metadata,
        )


class GoneQongClient(FakeQongClient):
    def result(self, job_id):
        raise ResultGoneError(410, "Gone", "fixture result expired")


if __name__ == "__main__":
    unittest.main()
