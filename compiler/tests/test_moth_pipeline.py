from __future__ import annotations

import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

from compiler.quantum_box_moth.canonical import canonical_bytes, sha256_json
from compiler.quantum_box_moth.client import (
    ALLOWED_ORIGIN,
    HttpResponse,
    MothApiClient,
)
from compiler.quantum_box_moth.engine_contracts import ENGINE_CONTRACTS
from compiler.quantum_box_moth.ledger import JobLedger
from compiler.quantum_box_moth.lifecycle import resume_poll, submit_once
from compiler.quantum_box_moth.models import (
    AmbiguousMutationError,
    ContractError,
    MothApiError,
    MutationApproval,
    ResultGoneError,
    ResultNotReadyError,
    RetrievedResult,
    StatusSnapshot,
    UnsupportedStatusError,
)
from compiler.quantum_box_moth.polling import poll_job


ENGINE = ENGINE_CONTRACTS["blur-v1"]
REQUEST = {"params": {"strength": 0.5}, "input_files": {"image": "asset"}}


def approval(asset_sha256=None):
    return MutationApproval(
        engine_id=ENGINE.engine_id,
        engine_canonical_sha256=ENGINE.canonical_sha256,
        request_sha256=sha256_json(REQUEST),
        listed_credits=ENGINE.credits_per_run,
        approved_at_utc="2026-08-23T00:00:00Z",
        approval_note_sha256="a" * 64,
        asset_sha256=asset_sha256,
    )


class FakeTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def request(self, method, url, headers, body, timeout):
        self.requests.append((method, url, dict(headers), body, timeout))
        if not self.responses:
            raise AssertionError("unexpected transport request")
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


def response(status, value, headers=None):
    body = value if isinstance(value, bytes) else json.dumps(value).encode("utf-8")
    return HttpResponse(status, headers or {}, body)


class ClientTests(unittest.TestCase):
    def test_read_only_auth_is_origin_bound(self):
        transport = FakeTransport(
            [response(200, {"id": "user", "role": "authenticated"})]
        )
        client = MothApiClient(ALLOWED_ORIGIN, "moth_test_secret", transport)
        self.assertEqual(client.me()["id"], "user")
        self.assertEqual(
            transport.requests[0][2]["Authorization"], "Bearer moth_test_secret"
        )
        with self.assertRaises(ContractError):
            MothApiClient("https://example.invalid", "secret", transport)

    def test_all_documented_failures_are_typed_and_redacted(self):
        for status in (401, 404, 422, 429, 500, 502, 503):
            transport = FakeTransport(
                [
                    response(
                        status,
                        {
                            "title": "bad moth_test_secret",
                            "detail": "https://signed.invalid/result?token=x",
                        },
                    )
                ]
            )
            client = MothApiClient(ALLOWED_ORIGIN, "moth_test_secret", transport)
            with self.assertRaises(MothApiError) as caught:
                client.me()
            rendered = str(caught.exception)
            self.assertNotIn("moth_test_secret", rendered)
            self.assertNotIn("signed.invalid", rendered)

    def test_submit_requires_exact_approval_and_captures_202(self):
        accepted = FakeTransport(
            [
                response(
                    202,
                    {
                        "job_id": "00000000-0000-0000-0000-000000000001",
                        "status": "queued",
                        "submitted_at": "2026-08-23T00:00:00Z",
                    },
                )
            ]
        )
        client = MothApiClient(ALLOWED_ORIGIN, "secret", accepted)
        job = client.submit(ENGINE, REQUEST, approval())
        self.assertEqual(job.status, "queued")
        self.assertEqual(len(accepted.requests), 1)
        wrong = MutationApproval(
            **{**approval().__dict__, "request_sha256": "0" * 64}
        )
        with self.assertRaises(ContractError):
            client.submit(ENGINE, REQUEST, wrong)

    def test_ambiguous_post_is_not_retried(self):
        transport = FakeTransport(
            [
                TimeoutError(
                    "authorization Bearer secret https://signed.invalid/?token=x"
                )
            ]
        )
        client = MothApiClient(ALLOWED_ORIGIN, "secret", transport)
        with self.assertRaises(AmbiguousMutationError) as caught:
            client.submit(ENGINE, REQUEST, approval())
        self.assertEqual(len(transport.requests), 1)
        self.assertNotIn("secret", str(caught.exception))
        self.assertNotIn("signed.invalid", str(caught.exception))

    def test_malformed_accepted_submission_is_ambiguous(self):
        for accepted in (
            response(202, b"not-json"),
            response(202, {"status": "queued"}),
        ):
            with self.subTest(body=accepted.body[:20]):
                transport = FakeTransport([accepted])
                client = MothApiClient(ALLOWED_ORIGIN, "secret", transport)
                with self.assertRaises(AmbiguousMutationError):
                    client.submit(ENGINE, REQUEST, approval())
                self.assertEqual(len(transport.requests), 1)

    def test_submit_distinguishes_server_uncertainty_from_client_rejection(self):
        server_failure = MothApiClient(
            ALLOWED_ORIGIN,
            "secret",
            FakeTransport([response(503, {"title": "Unavailable"})]),
        )
        with self.assertRaises(AmbiguousMutationError):
            server_failure.submit(ENGINE, REQUEST, approval())

        client_rejection = MothApiClient(
            ALLOWED_ORIGIN,
            "secret",
            FakeTransport([response(422, {"title": "Invalid request"})]),
        )
        with self.assertRaises(MothApiError) as caught:
            client_rejection.submit(ENGINE, REQUEST, approval())
        self.assertNotIsInstance(caught.exception, AmbiguousMutationError)

    def test_oversized_submission_response_is_ambiguous(self):
        client = MothApiClient(
            ALLOWED_ORIGIN,
            "secret",
            FakeTransport([response(202, b"accepted-but-unreadable")]),
        )
        with patch("compiler.quantum_box_moth.client.MAX_RESPONSE_BYTES", 8):
            with self.assertRaises(AmbiguousMutationError):
                client.submit(ENGINE, REQUEST, approval())

    def test_result_409_and_410_are_distinct(self):
        not_ready = MothApiClient(
            ALLOWED_ORIGIN,
            "secret",
            FakeTransport([response(409, {"title": "Conflict"})]),
        )
        with self.assertRaises(ResultNotReadyError):
            not_ready.result("job")
        gone = MothApiClient(
            ALLOWED_ORIGIN,
            "secret",
            FakeTransport([response(410, {"title": "Gone"})]),
        )
        with self.assertRaises(ResultGoneError):
            gone.result("job")

    def test_inline_and_output_assets_preserve_bytes_without_auth_leak(self):
        inline_value = {"output": "heads"}
        inline_transport = FakeTransport([response(200, {"result": inline_value})])
        inline = MothApiClient(ALLOWED_ORIGIN, "secret", inline_transport).result(
            "job"
        )
        self.assertEqual(inline.raw_bytes, canonical_bytes(inline_value))

        asset_bytes = b"opaque-output-bytes"
        asset_transport = FakeTransport(
            [
                response(
                    200,
                    {
                        "url": "https://storage.example/result?signature=hidden",
                        "output_asset_id": "asset",
                        "content_type": "application/octet-stream",
                        "filename": "result.png",
                    },
                ),
                response(200, asset_bytes),
            ]
        )
        asset = MothApiClient(ALLOWED_ORIGIN, "secret", asset_transport).result(
            "job"
        )
        self.assertEqual(asset.raw_bytes, asset_bytes)
        self.assertNotIn("Authorization", asset_transport.requests[1][2])
        self.assertNotIn("storage.example", json.dumps(asset.metadata))

    def test_asset_upload_uses_exact_presigned_headers_without_bearer(self):
        data = b"png-bytes"
        created = {
            "asset_id": "asset-1",
            "upload": {
                "url": "https://storage.example/upload?signature=hidden",
                "method": "PUT",
                "headers": {"Content-Type": "image/png", "X-Exact": "yes"},
                "expires_at": "2026-08-23T00:05:00Z",
            },
        }
        completed = {
            "asset_id": "asset-1",
            "status": "uploaded",
            "content_type": "image/png",
            "size_bytes": len(data),
        }
        transport = FakeTransport(
            [response(201, created), response(200, b""), response(200, completed)]
        )
        client = MothApiClient(ALLOWED_ORIGIN, "secret", transport)
        result = client.upload_asset(
            ENGINE,
            REQUEST,
            approval(asset_sha256=__import__("hashlib").sha256(data).hexdigest()),
            filename="input.png",
            content_type="image/png",
            data=data,
        )
        self.assertEqual(result.asset_id, "asset-1")
        put = transport.requests[1]
        self.assertEqual(put[0], "PUT")
        self.assertEqual(put[2], {"Content-Type": "image/png", "X-Exact": "yes"})
        self.assertNotIn("Authorization", put[2])


class FakePollingClient:
    def __init__(self, statuses, result=None):
        self.statuses = list(statuses)
        self.retrieved = result

    def status(self, job_id):
        item = self.statuses.pop(0)
        if isinstance(item, BaseException):
            raise item
        return StatusSnapshot(
            job_id,
            ENGINE.engine_id,
            item,
            "submitted",
            "updated",
            {
                "job_id": job_id,
                "engine_id": ENGINE.engine_id,
                "status": item,
            },
        )

    def result(self, job_id):
        if isinstance(self.retrieved, list):
            item = self.retrieved.pop(0)
            if isinstance(item, BaseException):
                raise item
            return item
        if isinstance(self.retrieved, BaseException):
            raise self.retrieved
        return self.retrieved


class PollingTests(unittest.TestCase):
    def test_completed_failed_cancelled_unknown_timeout_and_retry_after(self):
        raw = b"{}"
        result = RetrievedResult(
            "inline",
            raw,
            __import__("hashlib").sha256(raw).hexdigest(),
            "application/json",
            None,
            {},
        )
        clock = [0.0]
        sleeps = []
        client = FakePollingClient(
            [MothApiError(429, "rate", "later", 2.5), "queued", "completed"],
            result,
        )
        outcome = poll_job(
            client,
            "job",
            timeout_seconds=20,
            sleep=lambda value: (
                sleeps.append(value),
                clock.__setitem__(0, clock[0] + value),
            ),
            monotonic=lambda: clock[0],
            jitter=random.Random(1),
        )
        self.assertEqual(outcome.state, "completed")
        self.assertEqual(sleeps[0], 2.5)
        for status in ("failed", "cancelled"):
            outcome = poll_job(
                FakePollingClient([status]),
                "job",
                timeout_seconds=1,
                sleep=lambda _: None,
                monotonic=lambda: 0,
            )
            self.assertEqual(outcome.state, status)
        with self.assertRaises(UnsupportedStatusError):
            poll_job(
                FakePollingClient(["mystery"]),
                "job",
                timeout_seconds=1,
                sleep=lambda _: None,
                monotonic=lambda: 0,
            )
        clock = [0.0]
        outcome = poll_job(
            FakePollingClient(["queued"] * 5),
            "job",
            timeout_seconds=0.1,
            initial_delay=0.2,
            sleep=lambda value: clock.__setitem__(0, clock[0] + value),
            monotonic=lambda: clock[0],
            jitter=random.Random(1),
        )
        self.assertEqual(outcome.state, "pending-unknown")


class LedgerTests(unittest.TestCase):
    def test_accepted_job_is_durable_and_resume_never_posts(self):
        accepted_response = response(
            202,
            {
                "job_id": "job-1",
                "status": "queued",
                "submitted_at": "submitted",
            },
        )
        with tempfile.TemporaryDirectory() as directory:
            ledger = JobLedger(Path(directory))
            transport = FakeTransport([accepted_response])
            client = MothApiClient(ALLOWED_ORIGIN, "secret", transport)
            submit_once(client, ledger, ENGINE, REQUEST, approval())
            stored = ledger.submitted_job(sha256_json(REQUEST))
            self.assertEqual(stored.job_id, "job-1")
            self.assertEqual(len(transport.requests), 1)

            raw = b"{}"
            result = RetrievedResult(
                "inline",
                raw,
                __import__("hashlib").sha256(raw).hexdigest(),
                "application/json",
                None,
                {},
            )
            polling_client = FakePollingClient(["completed"], result)
            resume_poll(
                polling_client,
                ledger,
                ENGINE,
                sha256_json(REQUEST),
                timeout_seconds=1,
                sleep=lambda _: None,
                monotonic=lambda: 0,
            )
            self.assertEqual(
                ledger.read()["attempts"][0]["outcome"],
                "completed-result-retrieved",
            )

    def test_ambiguous_submission_is_durable_and_cannot_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = JobLedger(Path(directory))
            client = MothApiClient(
                ALLOWED_ORIGIN, "secret", FakeTransport([TimeoutError("timeout")])
            )
            with self.assertRaises(AmbiguousMutationError):
                submit_once(client, ledger, ENGINE, REQUEST, approval())
            self.assertEqual(
                ledger.read()["attempts"][0]["state"], "ambiguous-no-retry"
            )
            with self.assertRaises(ContractError):
                ledger.reserve_submission(ENGINE, REQUEST, approval())

    def test_hash_and_semantic_tampering_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = JobLedger(Path(directory))
            ledger.reserve_submission(ENGINE, REQUEST, approval())
            value = json.loads(ledger.path.read_text(encoding="utf-8"))
            value["payload"]["attempts"][0]["listedCreditsReserved"] = 99
            ledger.path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaises(ContractError):
                ledger.read()

            value["payloadSha256"] = sha256_json(value["payload"])
            ledger.path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaises(ContractError):
                ledger.read()


if __name__ == "__main__":
    unittest.main()
