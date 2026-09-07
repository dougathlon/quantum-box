from __future__ import annotations

import copy
import json
from pathlib import Path
import unittest

from compiler.quantum_box_moth.adapters import (
    LabyrinthMockNormalization,
    SequencedResult,
    decode_qong_contract_mock,
    evaluate_graph_result,
    evaluate_labyrinth_result,
)
from compiler.quantum_box_moth.canonical import canonical_json, sha256_json
from compiler.quantum_box_moth.models import ContractError


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_ROOT = (
    PROJECT_ROOT / "compiler/quantum_box_moth/schemas"
)


def qong_results():
    return tuple(
        SequencedResult(
            "r{:02d}".format(index),
            canonical_json(
                {"output": "heads" if index in (1, 3, 4, 7) else "tails"}
            ).encode("utf-8"),
        )
        for index in range(1, 8)
    )


class QongAdapterTests(unittest.TestCase):
    def test_exact_seven_result_order_generates_an_auditable_pack(self):
        decision = decode_qong_contract_mock(qong_results())
        candidate = decision["candidate"]
        self.assertEqual(decision["status"], "contract-mock-generated")
        self.assertEqual(
            candidate["payload"]["rallyPolarities"],
            ["direct", "invert", "direct", "direct", "invert", "invert", "direct"],
        )
        self.assertEqual(candidate["source"], "contract-mock")
        self.assertIsNone(candidate["mothEvidence"])
        self.assertEqual(
            candidate["contentSha256"], sha256_json(candidate["payload"])
        )
        self.assertEqual(len(decision["rawEvidenceSha256"]), 7)

    def test_missing_duplicate_reordered_and_unknown_results_are_rejected(self):
        with self.assertRaises(ContractError):
            decode_qong_contract_mock(qong_results()[:-1])
        duplicate = list(qong_results())
        duplicate[1] = SequencedResult("r01", duplicate[1].raw_bytes)
        with self.assertRaises(ContractError):
            decode_qong_contract_mock(duplicate)
        reordered = list(qong_results())
        reordered[0], reordered[1] = reordered[1], reordered[0]
        with self.assertRaises(ContractError):
            decode_qong_contract_mock(reordered)
        unknown = list(qong_results())
        unknown[0] = SequencedResult("r01", b'{"output":"edge"}')
        with self.assertRaises(ContractError):
            decode_qong_contract_mock(unknown)


class BlockedContractTests(unittest.TestCase):
    def test_graph_sample_fields_do_not_fake_fluxball_distributions(self):
        decision = evaluate_graph_result(
            canonical_json(
                {
                    "output": {
                        "mode": "emu",
                        "dominant_bitstring": "0011",
                        "edge_agreement_score": 0.5,
                    }
                }
            ).encode("utf-8")
        )
        self.assertEqual(decision["status"], "promotion-blocked")
        self.assertIsNone(decision["candidate"])
        self.assertIn("full-register", " ".join(decision["blockers"]))

    def test_labyrinth_requires_an_explicit_order_contract(self):
        raw = canonical_json(
            {
                "output": {
                    "results": {
                        "measurements": [
                            {"bitstring": "1010010110100101", "probability": 0.25}
                        ]
                    }
                }
            }
        ).encode("utf-8")
        blocked = evaluate_labyrinth_result(raw)
        self.assertEqual(blocked["status"], "promotion-blocked")
        self.assertIsNone(blocked["candidate"])

        mock = evaluate_labyrinth_result(
            raw,
            template_path=PROJECT_ROOT
            / "compiler/quantum_box_moth/fixtures/labyrinth-contract-mock-template.json",
            mock_normalization=LabyrinthMockNormalization(
                bit_order="leftmost-character-maps-to-q0",
                room_mapping="q0-maps-to-row-major-room-0",
                measurement_order="descending-probability",
                measurements_complete=True,
            ),
        )
        self.assertEqual(mock["status"], "contract-mock-generated")
        candidate = mock["candidate"]
        self.assertEqual(candidate["source"], "contract-mock")
        self.assertEqual(
            candidate["payload"]["syntheticState"]["kind"],
            "contract-mock-labyrinth-measurement-v1",
        )
        self.assertEqual(
            candidate["contentSha256"], sha256_json(candidate["payload"])
        )

    def test_candidate_content_hash_detects_semantic_tampering(self):
        decision = decode_qong_contract_mock(qong_results())
        candidate = copy.deepcopy(decision["candidate"])
        candidate["payload"]["rallyPolarities"][0] = "invert"
        self.assertNotEqual(
            candidate["contentSha256"], sha256_json(candidate["payload"])
        )


class SchemaTests(unittest.TestCase):
    def test_strict_schema_artifacts_are_parseable_and_versioned(self):
        expected = {
            "pack-candidate-v1.schema.json": "quantum-box-pack-v1",
            "promotion-decision-v1.schema.json": "quantum-box-promotion-decision-v1",
            "job-ledger-v1.schema.json": "quantum-box-moth-job-ledger-v1",
        }
        for filename, schema_id in expected.items():
            schema = json.loads((SCHEMA_ROOT / filename).read_text(encoding="utf-8"))
            self.assertEqual(schema["$id"], schema_id)
            self.assertEqual(schema["type"], "object")
            self.assertFalse(schema["additionalProperties"])

    def test_persisted_schemas_expose_no_secret_or_signed_url_fields(self):
        for path in SCHEMA_ROOT.glob("*.schema.json"):
            value = json.loads(path.read_text(encoding="utf-8"))
            fields = []

            def visit(node):
                if isinstance(node, dict):
                    properties = node.get("properties")
                    if isinstance(properties, dict):
                        fields.extend(properties)
                    for child in node.values():
                        visit(child)
                elif isinstance(node, list):
                    for child in node:
                        visit(child)

            visit(value)
            rendered = " ".join(fields).lower()
            for forbidden in (
                "authorization",
                "cookie",
                "credential",
                "password",
                "presigned",
                "secret",
                "signedurl",
                "token",
                "url",
            ):
                self.assertNotIn(forbidden, rendered)


if __name__ == "__main__":
    unittest.main()
