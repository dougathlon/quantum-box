from __future__ import annotations

import argparse
from pathlib import Path
import tempfile
import unittest

from compiler.quantum_box_moth.cli import (
    _blur_engine_report,
    _blur_study_report,
    _mock_png,
    _qpixl_engine_report,
    _recursive_changes,
)
from compiler.quantum_box_moth.models import ContractError
from compiler.quantum_box_moth.generate_qpixl_study import VALUES, generate


def blur_record():
    return {
        "engine_id": "blur-v1",
        "name": "Quantum Blur",
        "updated_at": "2026-08-04T12:08:45Z",
        "credits_per_run": 1,
        "is_multipart": True,
        "output_type": "application/octet-stream",
        "input_files": [{"name": "image"}, {"name": "mask"}],
        "params_schema": {
            "properties": {
                "strength": {"default": 0.5, "minimum": 0, "maximum": 1},
                "style": {"default": "rx", "enum": ["rx", "ry"]},
                "reach": {"default": 0, "minimum": 0, "maximum": 1},
                "size": {"default": 1024, "minimum": 8, "maximum": 1024},
                "downscale": {"default": True},
            }
        },
        "code_samples": [{"source": "data={'non_locality': 0.0}"}],
    }


def qpixl_record():
    return {
        "engine_id": "qpixl-v1",
        "name": "Qpixl",
        "updated_at": "2026-08-26T00:00:00Z",
        "credits_per_run": 1,
        "is_multipart": False,
        "output_type": "application/json",
        "params_schema": {
            "properties": {
                "values": {"type": "array", "default": [0.1, 0.9]},
                "mode": {"type": "string", "enum": ["aer", "qpu"]},
                "backend_name": {"type": "string", "default": "ibm_fez"},
                "shots": {"type": "integer", "default": 4096},
            }
        },
        "code_samples": [{"source": "params={'mode': 'qpu'}"}],
    }


class BlurStudyCliTests(unittest.TestCase):
    def test_live_report_surfaces_schema_and_sample_conflict(self):
        report = _blur_engine_report(blur_record())
        self.assertEqual(report["engineId"], "blur-v1")
        self.assertEqual(report["inputFiles"], ["image", "mask"])
        self.assertIn("non_locality", report["contractWarning"])
        self.assertTrue(report["operationalComparison"]["materialChanges"])
        self.assertFalse(report["submissionAuthorized"])

    def test_recursive_comparison_reports_exact_nested_paths(self):
        changes = _recursive_changes(
            {"params": {"reach": {"default": 0}}, "updated_at": "old"},
            {"params": {"reach": {"default": 0.5}}, "updated_at": "new"},
        )
        self.assertEqual(
            [change["path"] for change in changes],
            ["$.params.reach.default", "$.updated_at"],
        )

    def test_qpixl_inspection_surfaces_current_qpu_contract_without_authorizing(self):
        report = _qpixl_engine_report(qpixl_record())
        self.assertEqual(report["engineId"], "qpixl-v1")
        self.assertEqual(report["qpuSurface"]["modeValues"], ["aer", "qpu"])
        self.assertTrue(report["qpuSurface"]["backendNameParameter"])
        self.assertTrue(report["qpuSurface"]["codeSampleMentionsQpu"])
        self.assertFalse(report["submissionAuthorized"])

    def test_qpixl_study_is_deterministic_and_keeps_qpu_request_blocked(self):
        self.assertEqual(len(VALUES), 64)
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_manifest = generate(Path(first))
            second_manifest = generate(Path(second))
            self.assertEqual(first_manifest, second_manifest)
            self.assertEqual(first_manifest["networkCalls"], 0)
            self.assertEqual(first_manifest["requests"]["qpu"]["status"], "blocked-not-authorized")
            for name, metadata in first_manifest["files"].items():
                self.assertEqual(
                    metadata["sha256"],
                    __import__("hashlib").sha256((Path(first) / name).read_bytes()).hexdigest(),
                )

    def test_local_study_hashes_exact_matching_pngs_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "image.png"
            mask = root / "mask.png"
            image.write_bytes(_mock_png())
            mask.write_bytes(_mock_png())
            args = argparse.Namespace(
                image=image,
                mask=mask,
                strength=0.16,
                style="rx",
                reach=0.0,
                size=256,
                downscale=True,
            )
            report = _blur_study_report(args)
            self.assertEqual(report["networkCalls"], 0)
            self.assertEqual(report["creditSpend"], 0)
            self.assertEqual(report["studySpec"]["image"]["width"], 8)
            self.assertEqual(report["studySpec"]["params"]["size"], 256)
            self.assertEqual(len(report["studySpecSha256"]), 64)

    def test_study_rejects_invalid_params_before_any_submission(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.png"
            path.write_bytes(_mock_png())
            args = argparse.Namespace(
                image=path,
                mask=path,
                strength=1.1,
                style="rx",
                reach=0.0,
                size=256,
                downscale=True,
            )
            with self.assertRaises(ContractError):
                _blur_study_report(args)


if __name__ == "__main__":
    unittest.main()
