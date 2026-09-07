import json
from pathlib import Path
import tempfile
import unittest

from compiler.quantum_box_moth.canonical import sha256_json
from compiler.quantum_box_moth.models import ContractError
from compiler.quantum_box_moth.remaining_qpu_batch import (
    CAPTURE_SCHEMA,
    QUANTMAN_CAMPAIGN,
    QUANTMAN_SERIAL_CAMPAIGN,
    QUANTMAN_SERIAL_MAP01_CAMPAIGN,
    QUANTMAN_SERIAL_MAP02_CAMPAIGN,
    QUARRY_BIT_ORDER,
    QUARRY_CAMPAIGN,
    QUARRY_CAMPAIGN_V2,
    QUARRY_RECIPES,
    build_targets,
)
from compiler.quantum_box_moth.remaining_qpu_compile import (
    QUARRY_PHASE_COUNT,
    QUANTMAN_FILTER_ID,
    _quantman_topology_identity,
    compile_quantman,
    compile_quarry,
    compile_quarry_corpus,
)


class RemainingQpuCompileTests(unittest.TestCase):
    def test_future_quantman_topology_gets_a_stable_fallback_identity(self):
        self.assertEqual(
            _quantman_topology_identity(
                "future-authored-topology-r1", "1234567890abcdef" * 4
            ),
            ("quantman-maze-1234567890ab", "MAZE 1234", 10_000),
        )

    def test_compiles_quarry_projection_into_seven_deterministic_phases(self):
        with tempfile.TemporaryDirectory() as temporary:
            captures = Path(temporary)
            self._write_capture(
                captures / "quarry-a.json",
                QUARRY_CAMPAIGN,
                "graph-v1",
                "quarry-a",
                {
                    "backend": "ibm_fez",
                    "bit_order": list(QUARRY_BIT_ORDER),
                    "measurements": [
                        {"bitstring": "0" * 12, "count": 100, "probability": 0.1},
                        {"bitstring": "1" * 12, "count": 50, "probability": 0.05},
                    ],
                    "shots": 1000,
                    "returned_shot_count": 150,
                    "returned_probability_mass": 0.15,
                    "returned_measurement_count": 2,
                },
            )
            (captures / "quarry-a.rejected-result.json").write_text(
                "{}", encoding="utf-8"
            )

            bank = compile_quarry(captures)

        self.assertEqual(len(bank["packs"]), 1)
        self.assertEqual(bank["bankId"], "quarry-qgraph-ibm-fez-bank-v1")
        pack = bank["packs"][0]
        self.assertEqual(len(pack["frames"]), QUARRY_PHASE_COUNT)
        self.assertEqual(
            [frame["sequenceIndex"] for frame in pack["frames"]],
            list(range(QUARRY_PHASE_COUNT)),
        )
        self.assertEqual(
            pack["provenance"]["distributionProjection"],
            "provider-returned-top-outcomes-v1",
        )
        self.assertEqual(pack["provenance"]["returnedShotCount"], 150)
        self.assertEqual(pack["frames"][0]["measurements"][0]["weight"], 100)

    def test_compiles_complete_quantman_measurement_fixture(self):
        with tempfile.TemporaryDirectory() as temporary:
            captures = Path(temporary)
            self._write_capture(
                captures / "quantman.json",
                QUANTMAN_CAMPAIGN,
                "labyrinth-v1",
                "quantman",
                self._quantman_result(self._quantman_admissible_measurements()),
            )

            bank = compile_quantman(captures)

        self.assertEqual(len(bank["fixtures"]), 1)
        self.assertEqual(bank["schemaVersion"], "quantum-box-quantman-qpu-bank-v3")
        self.assertEqual(len(bank["topologies"]), 1)
        self.assertEqual(bank["topologies"][0]["captureFixtureIds"], [bank["fixtures"][0]["fixtureId"]])
        fixture = bank["fixtures"][0]
        self.assertEqual(fixture["width"], 10)
        self.assertEqual(fixture["height"], 10)
        self.assertEqual(sum(item["weight"] for item in fixture["records"]), 94)
        self.assertEqual(fixture["provenance"]["sourceType"], "qpu")
        self.assertEqual(fixture["provenance"]["engineId"], "labyrinth-v1")
        self.assertEqual(fixture["provenance"]["mothJobId"], "moth-quantman")
        self.assertEqual(fixture["provenance"]["hardwareJobId"], "ibm-quantman")
        self.assertEqual(
            fixture["provenance"]["rawResultSha256"],
            sha256_json({"rawResult": "quantman"}),
        )
        authority = bank["fixtureAuthorities"][0]
        self.assertEqual(authority["fixtureId"], fixture["fixtureId"])
        self.assertEqual(authority["fixtureContentSha256"], fixture["contentSha256"])
        self.assertEqual(
            authority["admissibility"]["filterId"], QUANTMAN_FILTER_ID
        )
        self.assertTrue(authority["admissibility"]["runtimeEligible"])
        self.assertEqual(
            authority["admissibility"]["summary"]["admittedRecordCount"], 94
        )
        self.assertEqual(
            authority["admissibility"]["summary"]["ensembleReachableRoomCount"],
            96,
        )
        self.assertEqual(
            authority["admissibility"]["summary"]["ensembleVariableEdgeCount"],
            168,
        )

    def test_compiles_independent_quantman_campaigns_into_one_extensible_bank(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            original = root / "original"
            serial = root / "serial"
            original.mkdir()
            serial.mkdir()
            measurements = self._quantman_admissible_measurements()
            self._write_capture(
                original / "original.json",
                QUANTMAN_CAMPAIGN,
                "labyrinth-v1",
                "quantman-original",
                self._quantman_result(measurements),
            )
            self._write_capture(
                serial / "serial.json",
                QUANTMAN_SERIAL_CAMPAIGN,
                "labyrinth-v1",
                "quantman-serial",
                self._quantman_result(list(reversed(measurements))),
            )

            bank = compile_quantman((original, serial))

        self.assertEqual(bank["schemaVersion"], "quantum-box-quantman-qpu-bank-v3")
        self.assertEqual(len(bank["fixtures"]), 2)
        self.assertEqual(len(bank["topologies"]), 1)
        self.assertEqual(len(bank["topologies"][0]["captureFixtureIds"]), 2)
        self.assertEqual(
            [
                authority["campaignId"]
                for authority in bank["fixtureAuthorities"]
            ],
            [QUANTMAN_CAMPAIGN, QUANTMAN_SERIAL_CAMPAIGN],
        )
        self.assertEqual(
            len({fixture["contentSha256"] for fixture in bank["fixtures"]}), 2
        )
        self.assertTrue(
            all(
                authority["admissibility"]["runtimeEligible"]
                for authority in bank["fixtureAuthorities"]
            )
        )

    def test_groups_distinct_serial_maze_topologies_without_flattening_captures(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            original = root / "original"
            map01 = root / "map01"
            map02 = root / "map02"
            original.mkdir()
            map01.mkdir()
            map02.mkdir()
            measurements = self._quantman_admissible_measurements()
            for destination, campaign_id, target_id in (
                (original, QUANTMAN_CAMPAIGN, "quantman-10x10-r1"),
                (map01, QUANTMAN_SERIAL_MAP01_CAMPAIGN, "quantman-map-01-serial-r1"),
                (map02, QUANTMAN_SERIAL_MAP02_CAMPAIGN, "quantman-map-02-serial-r1"),
            ):
                self._write_capture(
                    destination / f"{target_id}.json",
                    campaign_id,
                    "labyrinth-v1",
                    target_id,
                    self._quantman_result(measurements),
                )

            bank = compile_quantman((original, map01, map02))

        self.assertEqual(len(bank["fixtures"]), 3)
        self.assertEqual(len(bank["topologies"]), 3)
        self.assertEqual(
            [topology["topologyId"] for topology in bank["topologies"]],
            [
                "quantman-maze-original-v1",
                "quantman-maze-01-v1",
                "quantman-maze-02-v1",
            ],
        )
        self.assertTrue(
            all(len(topology["captureFixtureIds"]) == 1 for topology in bank["topologies"])
        )

    def test_preserves_an_existing_quantman_fixture_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            captures = root / "captures"
            captures.mkdir()
            self._write_capture(
                captures / "quantman.json",
                QUANTMAN_CAMPAIGN,
                "labyrinth-v1",
                "quantman",
                self._quantman_result(self._quantman_admissible_measurements()),
            )
            initial = compile_quantman(captures)
            legacy_bank = root / "legacy.json"
            legacy_bank.write_text(
                json.dumps({"fixtures": initial["fixtures"]}), encoding="utf-8"
            )

            extended = compile_quantman(captures, legacy_bank)

        self.assertEqual(extended["fixtures"][0], initial["fixtures"][0])
        self.assertEqual(
            extended["fixtures"][0]["contentSha256"],
            initial["fixtures"][0]["contentSha256"],
        )

    def test_rejects_incomplete_or_non_hardware_quantman_results(self):
        mutations = {
            "simulator backend": lambda result: result.update(backend="aer"),
            "emulator mode": lambda result: result.update(mode="emu"),
            "wrong qubit count": lambda result: result.update(num_qubits=99),
            "wrong grid": lambda result: result.update(
                grid_size={"rows": 5, "cols": 20}
            ),
            "incomplete shots": lambda result: result.update(
                shots=result["shots"] + 1
            ),
        }
        for label, mutate in mutations.items():
            with (
                self.subTest(label=label),
                tempfile.TemporaryDirectory() as temporary,
            ):
                captures = Path(temporary)
                result = self._quantman_result(
                    self._quantman_admissible_measurements()
                )
                mutate(result)
                self._write_capture(
                    captures / "quantman.json",
                    QUANTMAN_CAMPAIGN,
                    "labyrinth-v1",
                    "quantman",
                    result,
                )

                with self.assertRaisesRegex(
                    ContractError,
                    "complete 10x10/100-qubit IBM Fez QPU distribution",
                ):
                    compile_quantman(captures)

    def test_compiles_twenty_four_record_quarry_corpus_without_duplication(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            v1 = root / "v1"
            v2 = root / "v2"
            v1.mkdir()
            v2.mkdir()
            for sequence_index, (recipe_id, _relationships) in enumerate(
                QUARRY_RECIPES, start=1
            ):
                for realization in (1, 2, 3, 4):
                    target_id = f"quarry-frame-{sequence_index}-{recipe_id}"
                    campaign_id = QUARRY_CAMPAIGN
                    destination = v1
                    if realization > 1:
                        target_id = f"{target_id}-r{realization}"
                        campaign_id = QUARRY_CAMPAIGN_V2
                        destination = v2
                    self._write_capture(
                        destination / f"{target_id}.json",
                        campaign_id,
                        "graph-v1",
                        target_id,
                        {
                            "backend": "ibm_fez",
                            "bit_order": list(QUARRY_BIT_ORDER),
                            "measurements": [
                                {
                                    "bitstring": format(
                                        sequence_index * realization, "012b"
                                    ),
                                    "count": 100 + realization,
                                }
                            ],
                            "shots": 4096,
                            "returned_shot_count": 100 + realization,
                            "returned_probability_mass": (100 + realization)
                            / 4096,
                            "returned_measurement_count": 1,
                        },
                    )

            bank = compile_quarry_corpus(v1, v2)

        self.assertEqual(bank["schemaVersion"], "quantum-box-quarry-qpu-bank-v2")
        self.assertEqual(len(bank["packs"]), 24)
        self.assertEqual(len(bank["packIndex"]), 24)
        self.assertEqual(
            [source["captureCount"] for source in bank["sourceBanks"]], [6, 18]
        )
        self.assertEqual(
            [source["bankId"] for source in bank["sourceBanks"]],
            [
                "quarry-qgraph-ibm-fez-bank-v1",
                "quarry-qgraph-ibm-fez-bank-v2-tranche",
            ],
        )
        self.assertEqual(
            {
                recipe: sorted(
                    record["realizationId"]
                    for record in bank["packIndex"]
                    if record["recipeFamily"] == recipe
                )
                for recipe, _relationships in QUARRY_RECIPES
            },
            {
                recipe: ["r1", "r2", "r3", "r4"]
                for recipe, _relationships in QUARRY_RECIPES
            },
        )
        self.assertEqual(
            len({record["packId"] for record in bank["packIndex"]}), 24
        )

    @staticmethod
    def _quantman_result(measurements: list[dict]) -> dict:
        return {
            "backend": "ibm_fez",
            "mode": "qpu",
            "num_qubits": 100,
            "grid_size": {"rows": 10, "cols": 10},
            "measurements": measurements,
            "shots": sum(item["count"] for item in measurements),
        }

    @staticmethod
    def _quantman_admissible_measurements() -> list[dict]:
        # Each intact state flips one playable room in an otherwise equal field.
        # Omitting the player start and ghost release keeps both locally viable;
        # the ensemble still varies every playable edge and covers every room.
        excluded_rooms = {35, 44, 45, 54, 55, 95}
        return [
            {
                "bitstring": "".join(
                    "1" if index == room else "0" for index in range(100)
                ),
                "count": 1,
            }
            for room in range(100)
            if room not in excluded_rooms
        ]

    @staticmethod
    def _write_capture(
        path: Path,
        campaign_id: str,
        engine_id: str,
        target_id: str,
        result: dict,
    ) -> None:
        if engine_id == "labyrinth-v1":
            authored_target = build_targets(campaign_id)[0]
            level_data = authored_target.params_without_secrets["level_data"]
            redacted_request = {
                "params": {
                    "level_data": level_data,
                    "shots": result["shots"],
                    "top_n": -1,
                    "mode": "qpu",
                    "backend_name": "ibm_fez",
                }
            }
        else:
            redacted_request = {"params": {"target": target_id, "shots": result["shots"]}}
        material = {
            "schemaVersion": CAPTURE_SCHEMA,
            "campaignId": campaign_id,
            "targetId": target_id,
            "engineId": engine_id,
            "mothJobId": f"moth-{target_id}",
            "hardwareJobId": f"ibm-{target_id}",
            "submittedAt": "2026-09-06T00:00:00Z",
            "retrievedAtUtc": "2026-09-06T00:01:00Z",
            "providerUpdatedAt": "2026-09-06T00:00:30Z",
            "terminalObservedAtUtc": "2026-09-06T00:01:00Z",
            "terminalStatusSha256": sha256_json({"status": target_id}),
            "apiSpecification": {
                "version": "0.1.0",
                "canonicalSha256": sha256_json({"api": "0.1.0"}),
            },
            "engineCanonicalSha256": sha256_json({"engine": engine_id}),
            "engineUpdatedAt": "2026-07-23T16:09:42Z",
            "claimBoundary": "Recorded provider return; local gameplay decoding.",
            "rawResultSha256": sha256_json({"rawResult": target_id}),
            "redactedRequest": redacted_request,
            "redactedRequestSha256": sha256_json(redacted_request),
            "result": result,
        }
        payload = {**material, "contentSha256": sha256_json(material)}
        path.write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
