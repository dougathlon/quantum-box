import json
import unittest

from compiler.quantum_box_moth.fluxball_qgraph_batch import (
    SHOTS,
    build_capture,
    build_targets,
)
from compiler.quantum_box_moth.fluxball_qgraph_compile import (
    RUNTIME_BANK_ID,
    build_runtime_bank,
    eligible_round,
)


class FluxballQGraphCompileTests(unittest.TestCase):
    def test_round_mapping_gives_two_2p_and_three_4p_records_per_round(self):
        captures = {target.target_id: self._capture(target) for target in build_targets()}
        bank = build_runtime_bank(captures)
        self.assertEqual(bank["bankId"], RUNTIME_BANK_ID)
        self.assertEqual(len(bank["records"]), 40)
        for round_number in range(1, 9):
            two_player = [
                record
                for record in bank["records"]
                if record["competitorCount"] == 2
                and record["eligibleRounds"] == [round_number]
            ]
            four_player = [
                record
                for record in bank["records"]
                if record["competitorCount"] == 4
                and record["eligibleRounds"] == [round_number]
            ]
            self.assertEqual(len(two_player), 2)
            self.assertEqual(len(four_player), 3)

    def test_four_player_records_preserve_physical_player_order(self):
        captures = {target.target_id: self._capture(target) for target in build_targets()}
        bank = build_runtime_bank(captures)
        record = next(
            item
            for item in bank["records"]
            if "4p-ac-bd-equal-opposed-r1" in item["recordId"]
        )
        self.assertEqual(record["playerOrder"], ["A", "C", "B", "D"])
        self.assertEqual(record["eligibleRounds"], [3])

    def test_four_player_relationship_combinations_map_to_all_eight_rounds(self):
        rounds = {
            eligible_round(target)
            for target in build_targets()
            if target.competitor_count == 4
        }
        self.assertEqual(rounds, set(range(1, 9)))

    @staticmethod
    def _capture(target):
        shots = 1024 if target.target_id == "2p-equal-r1" else SHOTS
        bitstring = "0" * target.competitor_count
        coupling_map = (
            [[0, 1]]
            if target.competitor_count == 2
            else [[0, 1], [2, 3]]
        )
        raw = json.dumps(
            {
                "output": {
                    "backend": "ibm_fez",
                    "coupling_map": coupling_map,
                    "dominant_bitstring": bitstring,
                    "edge_agreement_score": 1,
                    "ibm_job_id": f"ibm-{target.target_id}",
                    "measurements": [
                        {
                            "bitstring": bitstring,
                            "count": shots,
                            "probability": 1.0,
                        }
                    ],
                    "mode": "qpu",
                    "num_qubits": target.competitor_count,
                    "seed": None,
                    "shots": shots,
                    "tomography": {"bloch": {}, "relationships": {}},
                }
            }
        ).encode("utf-8")
        return build_capture(
            target=target,
            moth_job_id=f"moth-{target.target_id}",
            submitted_at="2026-09-02T04:00:00Z",
            provider_updated_at="2026-09-02T04:01:00Z",
            terminal_status_sha256="a" * 64,
            terminal_observed_at="2026-09-02T04:01:01Z",
            retrieved_at="2026-09-02T04:01:02Z",
            raw_result=raw,
        )


if __name__ == "__main__":
    unittest.main()
