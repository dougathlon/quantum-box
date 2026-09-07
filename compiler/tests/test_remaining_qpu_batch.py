import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from compiler.quantum_box_moth.canonical import sha256_json
from compiler.quantum_box_moth.models import (
    API_SPECIFICATION_SHA256,
    API_VERSION,
    AmbiguousMutationError,
    ContractError,
    MothApiError,
)
from compiler.quantum_box_moth.remaining_qpu_batch import (
    BACKEND_NAME,
    GRAPH_ENGINE_ID,
    LABYRINTH_ENGINE_ID,
    QUANTMAN_CAMPAIGN,
    QUANTMAN_SERIAL_CAMPAIGN,
    QUANTMAN_SERIAL_MAP01_CAMPAIGN,
    QUANTMAN_SERIAL_MAP02_CAMPAIGN,
    QUANTMAN_SERIAL_MAP03_CAMPAIGN,
    QUANTMAN_SERIAL_MAP04_CAMPAIGN,
    QUANTMAN_SERIAL_MAP05_CAMPAIGN,
    QUANTMAN_SERIAL_MAP06_CAMPAIGN,
    QUANTMAN_TARGET_COUPLING_SHA256,
    QUARRY_BIT_ORDER,
    QUARRY_CAMPAIGN,
    QUARRY_RECIPROCAL_PAIRS,
    SHOTS,
    MANIFEST_SCHEMA,
    _validate_connected,
    _validate_live_engine,
    build_targets,
    full_grid_edges,
    normalize_labyrinth_result,
    normalize_quarry_result,
    quantman_coupling_map,
    submit_campaign,
)


class RemainingQpuBatchTests(unittest.TestCase):
    def test_quantman_target_is_a_deterministic_perfect_maze(self):
        first = quantman_coupling_map()
        second = quantman_coupling_map()
        self.assertEqual(first, second)
        self.assertEqual(len(first), 99)
        self.assertEqual(len(set(first)), 99)
        self.assertTrue(set(first).issubset(set(full_grid_edges(10, 10))))
        self.assertEqual(
            sha256_json([list(edge) for edge in first]),
            QUANTMAN_TARGET_COUPLING_SHA256,
        )
        _validate_connected(first, 100)

    def test_quantman_campaign_is_one_complete_100_qubit_qpu_request(self):
        targets = build_targets(QUANTMAN_CAMPAIGN)
        self.assertEqual(len(targets), 1)
        params = targets[0].params_without_secrets
        self.assertEqual(params["level_data"]["grid_size"], {"rows": 10, "cols": 10})
        self.assertEqual(params["level_data"]["num_qubits"], 100)
        self.assertEqual(len(params["level_data"]["coupling_map"]), 99)
        self.assertEqual(params["shots"], SHOTS)
        self.assertEqual(params["top_n"], -1)
        self.assertEqual(params["mode"], "qpu")
        self.assertEqual(params["backend_name"], BACKEND_NAME)
        self.assertNotIn("qpu_token", params)
        self.assertNotIn("qpu_instance", params)

    def test_serial_quantman_campaigns_are_one_distinct_hardware_request_each(self):
        campaigns = (
            QUANTMAN_SERIAL_CAMPAIGN,
            QUANTMAN_SERIAL_MAP01_CAMPAIGN,
            QUANTMAN_SERIAL_MAP02_CAMPAIGN,
            QUANTMAN_SERIAL_MAP03_CAMPAIGN,
            QUANTMAN_SERIAL_MAP04_CAMPAIGN,
            QUANTMAN_SERIAL_MAP05_CAMPAIGN,
            QUANTMAN_SERIAL_MAP06_CAMPAIGN,
        )
        targets = [build_targets(campaign)[0] for campaign in campaigns]
        self.assertTrue(all(len(build_targets(campaign)) == 1 for campaign in campaigns))
        self.assertEqual(
            targets[0].params_without_secrets["level_data"]["coupling_map"],
            [list(edge) for edge in quantman_coupling_map()],
        )
        authored_maps = {
            tuple(
                tuple(edge)
                for edge in target.params_without_secrets["level_data"]["coupling_map"]
            )
            for target in targets
        }
        self.assertEqual(len(authored_maps), 7)
        self.assertTrue(
            all(
                target.params_without_secrets["mode"] == "qpu"
                and target.params_without_secrets["backend_name"] == BACKEND_NAME
                for target in targets
            )
        )

    def test_quarry_campaign_covers_six_12_bit_relationship_recipes(self):
        targets = build_targets(QUARRY_CAMPAIGN)
        self.assertEqual(len(targets), 6)
        self.assertEqual(len({target.target_id for target in targets}), 6)
        for target in targets:
            params = target.params_without_secrets
            self.assertEqual(params["num_qubits"], 12)
            self.assertEqual(
                params["coupling_map"],
                [list(pair) for pair in QUARRY_RECIPROCAL_PAIRS],
            )
            self.assertEqual(len(params["operations"]), 6)
            self.assertEqual(params["shots"], SHOTS)
            self.assertEqual(params["mode"], "qpu")
            self.assertNotIn("qpu_token", params)
            self.assertNotIn("qpu_instance", params)
        self.assertEqual(
            QUARRY_BIT_ORDER,
            (
                "A>B",
                "A>C",
                "A>D",
                "B>A",
                "B>C",
                "B>D",
                "C>A",
                "C>B",
                "C>D",
                "D>A",
                "D>B",
                "D>C",
            ),
        )

    def test_credentials_enter_only_the_transient_request_body(self):
        target = build_targets(QUARRY_CAMPAIGN)[0]
        request = target.request_body("SECRET_TOKEN", "SECRET_INSTANCE")
        self.assertEqual(request["params"]["qpu_token"], "SECRET_TOKEN")
        self.assertEqual(request["params"]["qpu_instance"], "SECRET_INSTANCE")
        redacted = target.redacted_request()
        self.assertNotIn("qpu_token", redacted["params"])
        self.assertNotIn("qpu_instance", redacted["params"])
        self.assertNotIn("SECRET", json.dumps(redacted))

    def test_live_contract_validation_requires_qpu_credentials_and_complete_output(self):
        labyrinth = self._engine_record(LABYRINTH_ENGINE_ID)
        graph = self._engine_record(GRAPH_ENGINE_ID)
        self.assertEqual(
            _validate_live_engine(labyrinth, LABYRINTH_ENGINE_ID).credits_per_run,
            5,
        )
        self.assertEqual(
            _validate_live_engine(graph, GRAPH_ENGINE_ID).credits_per_run,
            5,
        )

        del labyrinth["params_schema"]["properties"]["qpu_instance"]
        with self.assertRaisesRegex(ContractError, "qpu_instance"):
            _validate_live_engine(labyrinth, LABYRINTH_ENGINE_ID)

        graph["params_schema"]["properties"]["mode"]["enum"] = ["emu"]
        with self.assertRaisesRegex(ContractError, "does not accept qpu"):
            _validate_live_engine(graph, GRAPH_ENGINE_ID)

    def test_normalizes_complete_quantman_qpu_result(self):
        target = build_targets(QUANTMAN_CAMPAIGN)[0]
        normalized = normalize_labyrinth_result(
            self._labyrinth_result(target), target
        )
        self.assertEqual(normalized["num_qubits"], 100)
        self.assertEqual(normalized["mode"], "qpu")
        self.assertEqual(normalized["backend"], BACKEND_NAME)
        self.assertEqual(normalized["hardware_job_id"], "ibm-labyrinth-job")
        self.assertEqual(sum(item["count"] for item in normalized["measurements"]), SHOTS)

    def test_normalizes_map01_corridors_without_requiring_submission_order(self):
        target = build_targets(QUANTMAN_SERIAL_MAP01_CAMPAIGN)[0]
        submitted = target.params_without_secrets["level_data"]["coupling_map"]
        normalized_order = sorted(
            [sorted(edge) for edge in submitted], key=lambda edge: (edge[0], edge[1])
        )
        self.assertNotEqual(submitted, normalized_order)
        normalized = normalize_labyrinth_result(
            self._labyrinth_result(target), target
        )
        self.assertEqual(normalized["hardware_job_id"], "ibm-labyrinth-job")
        self.assertEqual(normalized["num_qubits"], 100)

    def test_rejects_quantman_simulator_result(self):
        target = build_targets(QUANTMAN_CAMPAIGN)[0]
        payload = json.loads(self._labyrinth_result(target).decode("utf-8"))
        payload["output"]["metrics"]["mode"] = "emu"
        payload["output"]["metrics"]["backend"] = "aer"
        payload["output"]["metrics"]["ibm_job_id"] = None
        with self.assertRaisesRegex(ContractError, "IBM Fez QPU"):
            normalize_labyrinth_result(json.dumps(payload).encode("utf-8"), target)

    def test_normalizes_quarry_qpu_result_and_rejects_false_dominant_state(self):
        target = build_targets(QUARRY_CAMPAIGN)[0]
        payload = self._quarry_result()
        normalized = normalize_quarry_result(json.dumps(payload).encode("utf-8"), target)
        self.assertEqual(normalized["bit_order"], list(QUARRY_BIT_ORDER))
        self.assertEqual(normalized["hardware_job_id"], "ibm-quarry-job")
        self.assertFalse(normalized["distribution_truncated"])
        self.assertEqual(normalized["returned_shot_count"], SHOTS)

        payload["output"]["dominant_bitstring"] = "1" * 12
        with self.assertRaisesRegex(ContractError, "maximum-count"):
            normalize_quarry_result(json.dumps(payload).encode("utf-8"), target)

    def test_accepts_qgraph_top_measurement_projection_with_exact_mass(self):
        target = build_targets(QUARRY_CAMPAIGN)[0]
        payload = self._quarry_result()
        payload["output"]["measurements"] = payload["output"]["measurements"][:1]
        normalized = normalize_quarry_result(
            json.dumps(payload).encode("utf-8"), target
        )
        self.assertTrue(normalized["distribution_truncated"])
        self.assertEqual(normalized["returned_measurement_count"], 1)
        self.assertEqual(normalized["returned_shot_count"], 3072)
        self.assertAlmostEqual(normalized["returned_probability_mass"], 0.75)

    def test_ambiguous_post_stays_guarded_but_http_rejection_clears_guard(self):
        engine_record = self._engine_record(GRAPH_ENGINE_ID)
        engine_sha = sha256_json(engine_record)

        class AmbiguousClient:
            def __init__(self, *_args, **_kwargs):
                pass

            def engine(self, _engine_id):
                return engine_record

            def submit(self, *_args, **_kwargs):
                raise AmbiguousMutationError(None, "Ambiguous", "network")

        class RejectedClient(AmbiguousClient):
            def submit(self, *_args, **_kwargs):
                raise MothApiError(422, "Rejected", "schema")

        for client_type, expect_guard in (
            (AmbiguousClient, True),
            (RejectedClient, False),
        ):
            with self.subTest(
                client=client_type.__name__
            ), tempfile.TemporaryDirectory() as temporary:
                campaign_dir = Path(temporary)
                self._write_manifest(campaign_dir, engine_record, engine_sha)
                with (
                    patch(
                        "compiler.quantum_box_moth.remaining_qpu_batch._campaign_dir",
                        return_value=campaign_dir,
                    ),
                    patch(
                        "compiler.quantum_box_moth.remaining_qpu_batch._required_environment",
                        return_value={
                            "MOTH_API_KEY": "moth-secret",
                            "IBM_QPU_TOKEN": "ibm-secret",
                            "IBM_QPU_INSTANCE": "crn-secret",
                        },
                    ),
                    patch(
                        "compiler.quantum_box_moth.remaining_qpu_batch.MothApiClient",
                        client_type,
                    ),
                    patch("builtins.print"),
                ):
                    self.assertEqual(
                        submit_campaign(QUARRY_CAMPAIGN, engine_sha, 0), 1
                    )
                state = json.loads(
                    (campaign_dir / "submission-state-v1.json").read_text(
                        encoding="utf-8"
                    )
                )
                self.assertEqual(state["inFlight"] is not None, expect_guard)

    @staticmethod
    def _engine_record(engine_id):
        common = {
            "mode": {"enum": ["emu", "qpu"]},
            "shots": {"maximum": 10000},
            "backend_name": {"type": ["string", "null"]},
            "qpu_token": {"type": ["string", "null"]},
            "qpu_instance": {"type": ["string", "null"]},
        }
        if engine_id == LABYRINTH_ENGINE_ID:
            specific = {
                "level_data": {"$ref": "#/$defs/LevelData"},
                "top_n": {"minimum": -1},
            }
            definitions = {
                "LevelData": {
                    "properties": {
                        "grid_size": {"type": "object"},
                        "num_qubits": {"minimum": 2},
                        "coupling_map": {"type": "array"},
                    }
                }
            }
        else:
            specific = {
                "num_qubits": {"minimum": 2, "maximum": 20},
                "coupling_map": {"type": "array"},
                "operations": {"type": "array"},
            }
            definitions = {
                "RelationshipOperation": {
                    "properties": {
                        "type": {"const": "relationship"},
                        "qubits": {"type": "array"},
                        "paulis": {"type": "object"},
                    }
                }
            }
        return {
            "engine_id": engine_id,
            "updated_at": "2026-09-06T00:00:00Z",
            "credits_per_run": 5,
            "output_type": "application/json",
            "params_schema": {
                "$defs": definitions,
                "properties": {**common, **specific},
            },
        }

    @staticmethod
    def _write_manifest(campaign_dir, engine_record, engine_sha):
        targets = build_targets(QUARRY_CAMPAIGN)
        campaign_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "schemaVersion": MANIFEST_SCHEMA,
            "campaignId": QUARRY_CAMPAIGN,
            "engineId": GRAPH_ENGINE_ID,
            "apiSpecification": {
                "version": API_VERSION,
                "canonicalSha256": API_SPECIFICATION_SHA256,
            },
            "acceptedEngineCanonicalSha256": engine_sha,
            "engineUpdatedAt": engine_record["updated_at"],
            "listedCreditsPerRun": engine_record["credits_per_run"],
            "targetCount": len(targets),
            "maximumListedCredits": len(targets)
            * engine_record["credits_per_run"],
            "networkMutation": False,
            "targets": [
                {
                    "targetId": target.target_id,
                    "redactedRequest": target.redacted_request(),
                    "redactedRequestSha256": sha256_json(
                        target.redacted_request()
                    ),
                    "claimBoundary": target.claim_boundary,
                }
                for target in targets
            ],
        }
        (campaign_dir / "manifest-v1.json").write_text(
            json.dumps(manifest), encoding="utf-8"
        )

    @staticmethod
    def _labyrinth_result(target):
        corridors = {
            tuple(sorted(edge))
            for edge in target.params_without_secrets["level_data"]["coupling_map"]
        }
        all_edges = full_grid_edges(10, 10)
        output = {
            "coupling_map": [list(edge) for edge in all_edges],
            "grid_size": {"rows": 10, "cols": 10},
            "initial_states": {
                str(index): {"X": 0, "Y": 0, "Z": 0, "radiating": False}
                for index in range(100)
            },
            "metrics": {
                "backend": BACKEND_NAME,
                "mode": "qpu",
                "shots": SHOTS,
                "num_shots": SHOTS,
                "ibm_job_id": "ibm-labyrinth-job",
                "fraction": 1 / 3,
                "k": 3,
                "steps": 3,
            },
            "name": target.params_without_secrets["level_data"]["name"],
            "num_qubits": 100,
            "relationships": [],
            "results": {
                "measurements": [
                    {"bitstring": "0" * 100, "probability": 0.5},
                    {"bitstring": "1" * 100, "probability": 0.5},
                ],
                "z_expectations": [0] * 100,
                "zz_couplings": [
                    {"qubits": list(edge), "value": 0} for edge in all_edges
                ],
            },
            "target": {
                "convention": "sign=+1 corridor/door (ZZ=+1), sign=-1 wall (ZZ=-1)",
                "edge_signs": [
                    {
                        "qubits": list(edge),
                        "sign": 1 if edge in corridors else -1,
                    }
                    for edge in all_edges
                ],
                "n_corridor": len(corridors),
                "n_barrier": len(all_edges) - len(corridors),
            },
        }
        return json.dumps({"output": output}).encode("utf-8")

    @staticmethod
    def _quarry_result():
        zero_paulis = {
            product: 0
            for product in ("XX", "XY", "XZ", "YX", "YY", "YZ", "ZX", "ZY", "ZZ")
        }
        return {
            "output": {
                "backend": BACKEND_NAME,
                "coupling_map": [list(pair) for pair in QUARRY_RECIPROCAL_PAIRS],
                "dominant_bitstring": "0" * 12,
                "edge_agreement_score": 1,
                "ibm_job_id": "ibm-quarry-job",
                "measurements": [
                    {
                        "bitstring": "0" * 12,
                        "count": 3072,
                        "probability": 0.75,
                    },
                    {
                        "bitstring": "1" * 12,
                        "count": 1024,
                        "probability": 0.25,
                    },
                ],
                "mode": "qpu",
                "num_qubits": 12,
                "seed": None,
                "shots": SHOTS,
                "tomography": {
                    "bloch": {
                        str(index): {"X": 0, "Y": 0, "Z": 0}
                        for index in range(12)
                    },
                    "relationships": {
                        f"{first},{second}": dict(zero_paulis)
                        for first, second in QUARRY_RECIPROCAL_PAIRS
                    },
                },
            }
        }


if __name__ == "__main__":
    unittest.main()
