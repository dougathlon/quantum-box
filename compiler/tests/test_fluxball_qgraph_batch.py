import json
import unittest

from compiler.quantum_box_moth.fluxball_qgraph_batch import (
    BANK_ID,
    CAPTURE_SCHEMA_VERSION,
    EQUAL,
    EXISTING_JOBS,
    OPPOSED,
    build_capture,
    build_targets,
    manifest,
    normalize_qgraph_result,
    redacted_request,
    request_body,
)
from compiler.quantum_box_moth.models import ContractError


class FluxballQGraphBatchTests(unittest.TestCase):
    def test_target_matrix_contains_forty_unique_records_and_thirty_eight_missing(self):
        targets = build_targets()
        self.assertEqual(len(targets), 40)
        self.assertEqual(len({target.target_id for target in targets}), 40)
        self.assertEqual(sum(target.existing_job_id is None for target in targets), 38)
        self.assertEqual(
            {target.target_id: target.existing_job_id for target in targets if target.existing_job_id},
            EXISTING_JOBS,
        )

    def test_matrix_covers_every_four_player_pairing_and_relationship_combination_twice(self):
        four_player = [target for target in build_targets() if target.competitor_count == 4]
        observed = {}
        for target in four_player:
            key = (target.player_order, target.relationships)
            observed[key] = observed.get(key, 0) + 1
        self.assertEqual(len(observed), 12)
        self.assertEqual(set(observed.values()), {2})

    def test_request_uses_only_proven_couplings_and_keeps_secrets_out_of_manifest(self):
        target = next(
            item for item in build_targets() if item.target_id == "4p-ac-bd-equal-opposed-r1"
        )
        request = request_body(target, "SECRET_TOKEN", "SECRET_INSTANCE")
        self.assertEqual(request["params"]["coupling_map"], [[0, 1], [2, 3]])
        self.assertEqual(request["params"]["operations"][0]["paulis"], EQUAL)
        self.assertEqual(request["params"]["operations"][1]["paulis"], OPPOSED)
        redacted = redacted_request(target)
        self.assertNotIn("qpu_token", redacted["params"])
        self.assertNotIn("qpu_instance", redacted["params"])
        rendered = str(manifest(build_targets()))
        self.assertNotIn("SECRET_TOKEN", rendered)
        self.assertNotIn("SECRET_INSTANCE", rendered)

    def test_normalizes_completed_four_player_qpu_result(self):
        target = next(
            item
            for item in build_targets()
            if item.target_id == "4p-ac-bd-equal-opposed-r1"
        )
        normalized = normalize_qgraph_result(
            self._raw_result(target.competitor_count, 4096), target
        )
        self.assertEqual(normalized["backend"], "ibm_fez")
        self.assertEqual(normalized["num_qubits"], 4)
        self.assertEqual(normalized["shots"], 4096)
        self.assertEqual(normalized["measurements"][0]["count"], 4096)

    def test_allows_the_proven_legacy_two_player_1024_shot_result_only_for_r1(self):
        legacy = next(
            item for item in build_targets() if item.target_id == "2p-equal-r1"
        )
        current = next(
            item for item in build_targets() if item.target_id == "2p-equal-r2"
        )
        normalized = normalize_qgraph_result(self._raw_result(2, 1024), legacy)
        self.assertEqual(normalized["shots"], 1024)
        with self.assertRaisesRegex(ContractError, "acquired target"):
            normalize_qgraph_result(self._raw_result(2, 1024), current)

    def test_rejects_non_qpu_or_incomplete_measurements(self):
        target = next(
            item for item in build_targets() if item.target_id == "2p-opposed-r1"
        )
        wrong_mode = json.loads(self._raw_result(2, 4096).decode("utf-8"))
        wrong_mode["output"]["mode"] = "emu"
        with self.assertRaisesRegex(ContractError, "must be qpu"):
            normalize_qgraph_result(json.dumps(wrong_mode).encode("utf-8"), target)
        wrong_total = json.loads(self._raw_result(2, 4096).decode("utf-8"))
        wrong_total["output"]["measurements"][0]["count"] = 4095
        with self.assertRaisesRegex(ContractError, "probability"):
            normalize_qgraph_result(json.dumps(wrong_total).encode("utf-8"), target)

    def test_capture_is_provenance_labelled_and_content_addressed(self):
        target = next(
            item for item in build_targets() if item.target_id == "2p-opposed-r1"
        )
        capture = build_capture(
            target=target,
            moth_job_id="moth-job",
            submitted_at="2026-09-02T04:00:00Z",
            provider_updated_at="2026-09-02T04:01:00Z",
            terminal_status_sha256="a" * 64,
            terminal_observed_at="2026-09-02T04:01:01Z",
            retrieved_at="2026-09-02T04:01:02Z",
            raw_result=self._raw_result(2, 4096),
        )
        self.assertEqual(capture["schemaVersion"], CAPTURE_SCHEMA_VERSION)
        self.assertEqual(capture["bankId"], BANK_ID)
        self.assertEqual(capture["result"]["mode"], "qpu")
        self.assertEqual(len(capture["rawResultSha256"]), 64)
        self.assertEqual(len(capture["contentSha256"]), 64)

    @staticmethod
    def _raw_result(num_qubits: int, shots: int) -> bytes:
        bitstring = "0" * num_qubits
        coupling_map = [[0, 1]] if num_qubits == 2 else [[0, 1], [2, 3]]
        return json.dumps(
            {
                "output": {
                    "backend": "ibm_fez",
                    "coupling_map": coupling_map,
                    "dominant_bitstring": bitstring,
                    "edge_agreement_score": 1,
                    "ibm_job_id": "ibm-job",
                    "measurements": [
                        {
                            "bitstring": bitstring,
                            "count": shots,
                            "probability": 1.0,
                        }
                    ],
                    "mode": "qpu",
                    "num_qubits": num_qubits,
                    "seed": None,
                    "shots": shots,
                    "tomography": {"bloch": {}, "relationships": {}},
                }
            }
        ).encode("utf-8")


if __name__ == "__main__":
    unittest.main()
