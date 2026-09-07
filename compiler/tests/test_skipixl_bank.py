from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

from compiler.quantum_box_moth.canonical import canonical_json


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = PROJECT_ROOT / "src/games/skipixl/data/qpixl-b3-segments-v1.json"
GENERATOR_PATH = PROJECT_ROOT / "scripts/generate_skipixl_bank.py"


def load_generator():
    spec = importlib.util.spec_from_file_location(
        "quantum_box_skipixl_generator", GENERATOR_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the SkiPixl bank generator.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class SkiPixlBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = load_generator()
        cls.bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))

    def test_bank_core_and_every_scheduled_payload_are_content_addressed(self):
        bank_core = {
            key: value
            for key, value in self.bank.items()
            if key not in ("bankContentSha256", "schedules")
        }
        bank_hash = digest(canonical_json(bank_core).encode("utf-8"))
        self.assertEqual(bank_hash, self.bank["bankContentSha256"])
        self.assertEqual(len(self.bank["segments"]), 20)
        self.assertEqual(len(self.bank["schedules"]), 20)

        for schedule in self.bank["schedules"]:
            indexes = schedule["segmentIndexes"]
            self.assertEqual(len(indexes), 3)
            self.assertEqual(len(set(indexes)), 3)
            payload = self.generator.payload_for(
                schedule["scheduleId"],
                [self.bank["segments"][index] for index in indexes],
                bank_hash,
            )
            self.assertEqual(
                digest(canonical_json(payload).encode("utf-8")),
                schedule["contentSha256"],
            )

    def test_runtime_segments_match_the_preserved_sources_and_provider_captures(self):
        if not self.generator.MANIFEST_PATH.is_file():
            # The public source snapshot intentionally omits the adjacent private
            # visual-development archive. The promoted bank still carries enough
            # immutable material to verify its submitted pixels and exact returned
            # value arrays without fabricating or normalizing either sequence.
            for segment in self.bank["segments"]:
                self.assertEqual(len(segment["sourcePixels"]), 400)
                self.assertEqual(len(segment["returnedValues"]), 400)
                self.assertEqual(
                    digest(bytes(segment["sourcePixels"])),
                    segment["sourcePixelSha256"],
                )
                self.assertEqual(
                    digest(
                        canonical_json(segment["returnedValues"]).encode("utf-8")
                    ),
                    segment["returnedValuesSha256"],
                )
                for field in (
                    "sourceSha256",
                    "resultArtifactSha256",
                    "mothJobId",
                    "ibmJobId",
                ):
                    self.assertTrue(segment[field])
            return

        manifest = json.loads(
            self.generator.MANIFEST_PATH.read_text(encoding="utf-8")
        )
        jobs = sorted(
            (job for job in manifest["jobs"] if job["runId"].endswith("-b3")),
            key=lambda job: int(job["bankSlot"][2:]),
        )
        self.assertEqual(len(jobs), len(self.bank["segments"]))

        for job, segment in zip(jobs, self.bank["segments"]):
            source_path = self.generator.quantum_culture_path(job["sourcePath"])
            self.assertEqual(digest(source_path.read_bytes()), job["sourceSha256"])
            self.assertEqual(
                self.generator.source_pixels(source_path), segment["sourcePixels"]
            )
            artifact, result = self.generator.result_record(job)
            self.assertEqual(job["runId"], segment["segmentId"])
            self.assertEqual(job["mothJobId"], segment["mothJobId"])
            self.assertEqual(result["ibm_job_id"], segment["ibmJobId"])
            self.assertEqual(artifact["sha256"], segment["resultArtifactSha256"])
            self.assertEqual(result["output"], segment["returnedValues"])


if __name__ == "__main__":
    unittest.main()
