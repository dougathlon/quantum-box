"""Compile reviewed Quantman and Quarry captures into credential-free banks.

This module performs no network operation. It accepts only immutable captures
already validated by ``remaining_qpu_batch`` and preserves the provider's
returned distribution projection rather than inventing missing outcomes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
from typing import Any, Dict, Iterable, Mapping, Sequence

from .canonical import canonical_bytes, sha256_json
from .models import ContractError
from .remaining_qpu_batch import (
    CAPTURE_SCHEMA,
    QUANTMAN_CAMPAIGN,
    QUANTMAN_SERIAL_CAMPAIGN,
    QUANTMAN_SERIAL_MAP01_CAMPAIGN,
    QUANTMAN_SERIAL_MAP02_CAMPAIGN,
    QUANTMAN_SERIAL_MAP03_CAMPAIGN,
    QUANTMAN_SERIAL_MAP04_CAMPAIGN,
    QUANTMAN_SERIAL_MAP05_CAMPAIGN,
    QUANTMAN_SERIAL_MAP06_CAMPAIGN,
    QUARRY_BIT_ORDER,
    QUARRY_CAMPAIGN,
    QUARRY_CAMPAIGN_V2,
    QUARRY_RECIPES,
)


QUANTMAN_BANK_SCHEMA = "quantum-box-quantman-qpu-bank-v3"
QUANTMAN_TOPOLOGY_SCHEMA = "quantman-authored-maze-topology-v1"
QUANTMAN_SELECTION_METHOD = "topology-sequence-and-seeded-capture-v3"
QUANTMAN_AUTHORITY_SCHEMA = "quantman-qpu-fixture-authority-v1"
QUANTMAN_ADMISSIBILITY_SCHEMA = "quantman-admissibility-index-v1"
QUANTMAN_FILTER_ID = "quantman-demo-playability-v1"
QUANTMAN_ACCEPTED_CAMPAIGNS = (
    QUANTMAN_CAMPAIGN,
    QUANTMAN_SERIAL_CAMPAIGN,
    QUANTMAN_SERIAL_MAP01_CAMPAIGN,
    QUANTMAN_SERIAL_MAP02_CAMPAIGN,
    QUANTMAN_SERIAL_MAP03_CAMPAIGN,
    QUANTMAN_SERIAL_MAP04_CAMPAIGN,
    QUANTMAN_SERIAL_MAP05_CAMPAIGN,
    QUANTMAN_SERIAL_MAP06_CAMPAIGN,
)
QUANTMAN_PLAYER_START = 95
QUANTMAN_GHOST_RELEASE = 35
QUANTMAN_GHOST_HOME_ROOMS = (44, 45, 54, 55)
QUANTMAN_WALL_PASS_ROOMS = (0, 9, 90, 99)
QUANTMAN_MIN_PLAYER_COMPONENT = 12
QUANTMAN_MIN_GHOST_RELEASE_COMPONENT = 4
QUANTMAN_MAX_ISOLATED_PLAYABLE_ROOMS = 10
QUARRY_BANK_SCHEMA = "quantum-box-quarry-qpu-bank-v1"
QUARRY_CORPUS_SCHEMA = "quantum-box-quarry-qpu-bank-v2"
QGRAPH_PACK_SCHEMA = "quantum-box-qgraph-cabinet-pack-v1"
QGRAPH_FRAME_SCHEMA = "qgraph-whole-register-frame-v1"
QUARRY_PHASE_COUNT = 7
QUARRY_SELECTION_METHOD = "run-seed-uniform-24-pack-v2"
QUARRY_RECIPE_IDS = tuple(recipe_id for recipe_id, _relationships in QUARRY_RECIPES)


def compile_quantman(
    captures_dirs: Path | Sequence[Path],
    preserved_fixture_bank: Path | None = None,
) -> Dict[str, Any]:
    if isinstance(captures_dirs, Path):
        captures_dirs = (captures_dirs,)
    captures = []
    for captures_dir in captures_dirs:
        captures.extend(
            _load_captures_for_campaigns(
                captures_dir, QUANTMAN_ACCEPTED_CAMPAIGNS, "labyrinth-v1"
            )
        )
    _require_unique(captures, "targetId")
    _require_unique(captures, "mothJobId")
    _require_unique(captures, "hardwareJobId")
    _require_unique(captures, "rawResultSha256")
    preserved_fixtures = _load_preserved_quantman_fixtures(preserved_fixture_bank)
    fixtures = []
    fixture_authorities = []
    topology_groups: Dict[str, Dict[str, Any]] = {}
    for capture in captures:
        result = _mapping(capture.get("result"), "Quantman capture.result")
        measurements = _measurements(result, 100)
        _validate_quantman_result(capture, result, measurements)
        admissibility = _quantman_admissibility_index(measurements)
        fixture = _quantman_fixture(capture, result, measurements, preserved_fixtures)
        fixtures.append(fixture)
        authority_material = _quantman_fixture_authority(
            capture, result, fixture, admissibility
        )
        fixture_authorities.append(
            {
                **authority_material,
                "contentSha256": sha256_json(authority_material),
            }
        )
        topology = _quantman_authored_topology(capture)
        existing = topology_groups.get(topology["authoredTopologySha256"])
        if existing is None:
            topology_groups[topology["authoredTopologySha256"]] = {
                **topology,
                "captureFixtureIds": [fixture["fixtureId"]],
            }
        else:
            if (
                existing["topologyId"] != topology["topologyId"]
                or existing["couplingMap"] != topology["couplingMap"]
            ):
                raise ContractError(
                    "Quantman topology",
                    "one authored topology resolved to conflicting identities",
                )
            existing["captureFixtureIds"].append(fixture["fixtureId"])
    topologies = []
    for topology in sorted(
        topology_groups.values(), key=_quantman_topology_sort_key
    ):
        material = dict(topology)
        topologies.append({**material, "contentSha256": sha256_json(material)})
    bank_material = {
        "schemaVersion": QUANTMAN_BANK_SCHEMA,
        "bankId": "quantman-labyrinth-ibm-fez-bank-v3",
        "selectionMethod": QUANTMAN_SELECTION_METHOD,
        "topologies": topologies,
        "fixtures": fixtures,
        "fixtureAuthorities": fixture_authorities,
    }
    return {**bank_material, "contentSha256": sha256_json(bank_material)}


def _quantman_authored_topology(capture: Mapping[str, Any]) -> Dict[str, Any]:
    request = _mapping(capture.get("redactedRequest"), "Quantman request")
    params = _mapping(request.get("params"), "Quantman request.params")
    level = _mapping(params.get("level_data"), "Quantman request.params.level_data")
    raw_edges = level.get("coupling_map")
    if not isinstance(raw_edges, list):
        raise ContractError("Quantman authored topology", "has no coupling map")
    full_grid = {
        (room, room + 1)
        for room in range(100)
        if room % 10 < 9
    } | {
        (room, room + 10)
        for room in range(90)
    }
    edges = []
    for index, raw_edge in enumerate(raw_edges):
        if (
            not isinstance(raw_edge, list)
            or len(raw_edge) != 2
            or any(
                not isinstance(room, int) or isinstance(room, bool)
                for room in raw_edge
            )
        ):
            raise ContractError(
                f"Quantman authored topology edge {index}", "is invalid"
            )
        edge = tuple(sorted((raw_edge[0], raw_edge[1])))
        if edge not in full_grid:
            raise ContractError(
                f"Quantman authored topology edge {index}",
                "is not an orthogonal 10x10 grid edge",
            )
        edges.append(edge)
    normalized = tuple(sorted(set(edges)))
    if len(edges) != 99 or len(normalized) != 99:
        raise ContractError(
            "Quantman authored topology", "must contain 99 unique corridors"
        )
    adjacency = {room: set() for room in range(100)}
    for a, b in normalized:
        adjacency[a].add(b)
        adjacency[b].add(a)
    if len(_component(adjacency, 0)) != 100:
        raise ContractError("Quantman authored topology", "must span all 100 rooms")

    coupling_map = [list(edge) for edge in normalized]
    topology_sha = sha256_json(coupling_map)
    topology_id, label, course_order = _quantman_topology_identity(
        str(capture["targetId"]), topology_sha
    )
    return {
        "schemaVersion": QUANTMAN_TOPOLOGY_SCHEMA,
        "topologyId": topology_id,
        "label": label,
        "courseOrder": course_order,
        "gridSize": {"rows": 10, "cols": 10},
        "numQubits": 100,
        "corridorCount": 99,
        "couplingMap": coupling_map,
        "authoredTopologySha256": topology_sha,
    }


def _quantman_topology_identity(
    target_id: str, topology_sha: str
) -> tuple[str, str, int]:
    if topology_sha == (
        "0d63ffbd489385cebb77300a61b47b4ca6029a96260e826209bb0b322ae0faee"
    ):
        return "quantman-maze-original-v1", "ORIGINAL", 0
    match = re.fullmatch(r"quantman-map-(\d{2})-(?:serial-)?r\d+", target_id)
    if match:
        map_number = int(match.group(1))
        return (
            f"quantman-maze-{map_number:02d}-v1",
            f"MAP {map_number:02d}",
            map_number,
        )
    return (
        f"quantman-maze-{topology_sha[:12]}",
        f"MAZE {topology_sha[:4].upper()}",
        10_000,
    )


def _quantman_topology_sort_key(topology: Mapping[str, Any]) -> tuple[int, str]:
    return int(topology["courseOrder"]), str(topology["topologyId"])


def _quantman_fixture(
    capture: Mapping[str, Any],
    result: Mapping[str, Any],
    measurements: Sequence[Mapping[str, Any]],
    preserved_fixtures: Mapping[str, Mapping[str, Any]],
) -> Dict[str, Any]:
    preserved = preserved_fixtures.get(str(capture["mothJobId"]))
    if preserved is not None:
        if (
            preserved.get("records") != list(measurements)
            or preserved.get("width") != 10
            or preserved.get("height") != 10
            or preserved.get("bitOrder") != "row-major-room-index"
            or preserved.get("parityRule") != "equal-open-unequal-wall"
        ):
            raise ContractError(
                "preserved fixture",
                "does not match the intact provider-returned distribution",
            )
        provenance = _mapping(
            preserved.get("provenance"), "preserved fixture.provenance"
        )
        if (
            provenance.get("mothJobId") != capture["mothJobId"]
            or provenance.get("hardwareJobId") != capture["hardwareJobId"]
            or provenance.get("rawResultSha256") != capture["rawResultSha256"]
            or provenance.get("shots") != result["shots"]
        ):
            raise ContractError(
                "preserved fixture", "does not match the capture provenance"
            )
        return dict(preserved)

    provenance = {
        "sourceType": "qpu",
        "label": "RECORDED MOTH LABYRINTH IBM FEZ RETURN",
        "generatorOrProvider": "Moth labyrinth-v1 / IBM Quantum",
        "acquisitionOrGenerationDate": capture["submittedAt"],
        "engineId": "labyrinth-v1",
        "backend": result["backend"],
        "jobId": capture["hardwareJobId"],
        "mothJobId": capture["mothJobId"],
        "hardwareJobId": capture["hardwareJobId"],
        "rawResultSha256": capture["rawResultSha256"],
        "shots": result["shots"],
        "limits": [
            f"Moth job {capture['mothJobId']}; hardware job {capture['hardwareJobId']}.",
            "The submitted target maze is authored input; measured bitstrings are provider output.",
            "Runtime topology sampling is deterministic local decoding of this frozen distribution.",
        ],
    }
    material = {
        "schemaVersion": "labyrinth-measurement-bank-v1",
        "fixtureId": f"quantman-{capture['targetId']}-qpu-v1",
        "width": 10,
        "height": 10,
        "bitOrder": "row-major-room-index",
        "parityRule": "equal-open-unequal-wall",
        "provenance": provenance,
        "records": list(measurements),
    }
    return {**material, "contentSha256": sha256_json(material)}


def _quantman_fixture_authority(
    capture: Mapping[str, Any],
    result: Mapping[str, Any],
    fixture: Mapping[str, Any],
    admissibility: Mapping[str, Any],
) -> Dict[str, Any]:
    api_specification = _mapping(
        capture.get("apiSpecification"), "Quantman capture.apiSpecification"
    )
    redacted_request = _mapping(
        capture.get("redactedRequest"), "Quantman capture.redactedRequest"
    )
    request_params = _mapping(
        redacted_request.get("params"), "Quantman capture.redactedRequest.params"
    )
    return {
        "schemaVersion": QUANTMAN_AUTHORITY_SCHEMA,
        "fixtureId": fixture["fixtureId"],
        "fixtureContentSha256": fixture["contentSha256"],
        "campaignId": capture["campaignId"],
        "targetId": capture["targetId"],
        "engineId": capture["engineId"],
        "engineCanonicalSha256": capture["engineCanonicalSha256"],
        "engineUpdatedAt": capture["engineUpdatedAt"],
        "apiSpecification": api_specification,
        "mode": result["mode"],
        "numQubits": result["num_qubits"],
        "gridSize": result["grid_size"],
        "bitOrder": "row-major-room-index",
        "backend": result["backend"],
        "mothJobId": capture["mothJobId"],
        "hardwareJobId": capture["hardwareJobId"],
        "submittedAt": capture["submittedAt"],
        "retrievedAtUtc": capture["retrievedAtUtc"],
        "providerUpdatedAt": capture["providerUpdatedAt"],
        "requestedShots": request_params["shots"],
        "returnedShots": result["shots"],
        "redactedRequest": redacted_request,
        "redactedRequestSha256": capture["redactedRequestSha256"],
        "rawResultSha256": capture["rawResultSha256"],
        "captureContentSha256": capture["contentSha256"],
        "terminalObservedAtUtc": capture["terminalObservedAtUtc"],
        "terminalStatusSha256": capture["terminalStatusSha256"],
        "claimBoundary": capture["claimBoundary"],
        "admissibility": admissibility,
    }


def _load_preserved_quantman_fixtures(
    bank_path: Path | None,
) -> Dict[str, Mapping[str, Any]]:
    if bank_path is None:
        return {}
    bank = _mapping(_read_json(bank_path), str(bank_path))
    raw_fixtures = bank.get("fixtures")
    if not isinstance(raw_fixtures, list):
        raise ContractError(str(bank_path), "contains no preserved fixtures")
    fixtures: Dict[str, Mapping[str, Any]] = {}
    for index, raw_fixture in enumerate(raw_fixtures):
        fixture = _mapping(raw_fixture, f"{bank_path}.fixtures[{index}]")
        material = dict(fixture)
        content_sha = material.pop("contentSha256", None)
        if content_sha != sha256_json(material):
            raise ContractError(
                f"{bank_path}.fixtures[{index}]", "content hash does not match"
            )
        provenance = _mapping(
            fixture.get("provenance"), f"{bank_path}.fixtures[{index}].provenance"
        )
        moth_job_id = provenance.get("mothJobId")
        if not isinstance(moth_job_id, str) or not moth_job_id:
            raise ContractError(
                f"{bank_path}.fixtures[{index}]", "has no Moth job identity"
            )
        if moth_job_id in fixtures:
            raise ContractError(str(bank_path), "repeats a Moth job identity")
        fixtures[moth_job_id] = fixture
    return fixtures


def _quantman_admissibility_index(
    records: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    width = 10
    height = 10
    home = set(QUANTMAN_GHOST_HOME_ROOMS)
    playable_rooms = tuple(room for room in range(width * height) if room not in home)
    grid_edges = []
    for row in range(height):
        for column in range(width):
            room = row * width + column
            if column + 1 < width:
                grid_edges.append((room, room + 1))
            if row + 1 < height:
                grid_edges.append((room, room + width))
    playable_edges = tuple(
        edge for edge in grid_edges if edge[0] not in home and edge[1] not in home
    )
    admitted_indices = []
    admitted_open_edges = set()
    edge_values = [set() for _edge in playable_edges]

    for index, record in enumerate(records):
        bitstring = str(record["bitstring"])
        open_edges = {
            edge
            for edge in playable_edges
            if bitstring[edge[0]] == bitstring[edge[1]]
        }
        adjacency = _quantman_adjacency(playable_rooms, open_edges)
        player_component = _component(adjacency, QUANTMAN_PLAYER_START)
        release_component = _component(adjacency, QUANTMAN_GHOST_RELEASE)
        isolated_rooms = sum(1 for room in playable_rooms if not adjacency[room])
        if (
            len(player_component) < QUANTMAN_MIN_PLAYER_COMPONENT
            or not player_component.intersection(QUANTMAN_WALL_PASS_ROOMS)
            or len(release_component) < QUANTMAN_MIN_GHOST_RELEASE_COMPONENT
            or isolated_rooms > QUANTMAN_MAX_ISOLATED_PLAYABLE_ROOMS
            or not open_edges
            or len(open_edges) == len(playable_edges)
        ):
            continue
        admitted_indices.append(index)
        admitted_open_edges.update(open_edges)
        for edge_index, edge in enumerate(playable_edges):
            edge_values[edge_index].add(0 if edge in open_edges else 1)

    union_adjacency = _quantman_adjacency(playable_rooms, admitted_open_edges)
    ensemble_reachable_rooms = (
        len(_component(union_adjacency, QUANTMAN_PLAYER_START))
        if admitted_indices
        else 0
    )
    ensemble_variable_edges = sum(1 for values in edge_values if len(values) == 2)
    returned_weight = sum(int(record["weight"]) for record in records)
    admitted_weight = sum(int(records[index]["weight"]) for index in admitted_indices)
    runtime_eligible = (
        bool(admitted_indices)
        and ensemble_reachable_rooms == len(playable_rooms)
        and ensemble_variable_edges == len(playable_edges)
    )
    return {
        "schemaVersion": QUANTMAN_ADMISSIBILITY_SCHEMA,
        "filterId": QUANTMAN_FILTER_ID,
        "runtimeEligible": runtime_eligible,
        "criteria": {
            "playerStartRoom": QUANTMAN_PLAYER_START,
            "minimumPlayerComponentRooms": QUANTMAN_MIN_PLAYER_COMPONENT,
            "wallPassRooms": list(QUANTMAN_WALL_PASS_ROOMS),
            "ghostReleaseRoom": QUANTMAN_GHOST_RELEASE,
            "minimumGhostReleaseComponentRooms": QUANTMAN_MIN_GHOST_RELEASE_COMPONENT,
            "ghostHomeRooms": list(QUANTMAN_GHOST_HOME_ROOMS),
            "maximumIsolatedPlayableRooms": QUANTMAN_MAX_ISOLATED_PLAYABLE_ROOMS,
            "requireOpenAndClosedPlayableEdges": True,
            "requireFullEnsembleRoomCoverage": True,
            "requireEveryPlayableEdgeVariable": True,
        },
        "admittedRecordIndices": admitted_indices,
        "summary": {
            "returnedRecordCount": len(records),
            "returnedWeight": returned_weight,
            "admittedRecordCount": len(admitted_indices),
            "admittedWeight": admitted_weight,
            "excludedRecordCount": len(records) - len(admitted_indices),
            "excludedWeight": returned_weight - admitted_weight,
            "playableRoomCount": len(playable_rooms),
            "playableEdgeCount": len(playable_edges),
            "ensembleReachableRoomCount": ensemble_reachable_rooms,
            "ensembleVariableEdgeCount": ensemble_variable_edges,
        },
    }


def _validate_quantman_result(
    capture: Mapping[str, Any],
    result: Mapping[str, Any],
    measurements: Sequence[Mapping[str, Any]],
) -> None:
    grid_size = _mapping(result.get("grid_size"), "Quantman result.grid_size")
    redacted_request = _mapping(
        capture.get("redactedRequest"), "Quantman capture.redactedRequest"
    )
    request_params = _mapping(
        redacted_request.get("params"), "Quantman capture.redactedRequest.params"
    )
    shots = result.get("shots")
    if (
        result.get("backend") != "ibm_fez"
        or result.get("mode") != "qpu"
        or result.get("num_qubits") != 100
        or grid_size.get("rows") != 10
        or grid_size.get("cols") != 10
        or not isinstance(shots, int)
        or isinstance(shots, bool)
        or shots <= 0
        or request_params.get("shots") != shots
        or sum(int(record["weight"]) for record in measurements) != shots
    ):
        raise ContractError(
            "Quantman result",
            "must be a complete 10x10/100-qubit IBM Fez QPU distribution",
        )


def _quantman_adjacency(
    playable_rooms: Sequence[int], open_edges: Iterable[tuple[int, int]]
) -> Dict[int, set[int]]:
    adjacency = {room: set() for room in playable_rooms}
    for a, b in open_edges:
        adjacency[a].add(b)
        adjacency[b].add(a)
    # Quantman's side tunnel is fixed local game geometry, not a measured wall.
    adjacency[50].add(59)
    adjacency[59].add(50)
    return adjacency


def _component(adjacency: Mapping[int, set[int]], start: int) -> set[int]:
    visited = {start}
    pending = [start]
    while pending:
        room = pending.pop()
        for neighbour in adjacency[room]:
            if neighbour not in visited:
                visited.add(neighbour)
                pending.append(neighbour)
    return visited


def compile_quarry(
    captures_dir: Path, campaign_id: str = QUARRY_CAMPAIGN
) -> Dict[str, Any]:
    if campaign_id not in (QUARRY_CAMPAIGN, QUARRY_CAMPAIGN_V2):
        raise ContractError("campaign", f"unsupported Quarry campaign {campaign_id!r}")
    captures = _load_captures(captures_dir, campaign_id, "graph-v1")
    packs = _compile_quarry_packs(captures)
    bank_material = {
        "schemaVersion": QUARRY_BANK_SCHEMA,
        "bankId": _quarry_source_bank_id(campaign_id),
        "selectionMethod": "run-seed-modulo-pack-count-v1",
        "packs": packs,
    }
    return {**bank_material, "contentSha256": sha256_json(bank_material)}


def compile_quarry_corpus(
    v1_captures_dir: Path, v2_captures_dir: Path
) -> Dict[str, Any]:
    capture_sets = (
        (
            QUARRY_CAMPAIGN,
            "v1",
            _load_captures(v1_captures_dir, QUARRY_CAMPAIGN, "graph-v1"),
        ),
        (
            QUARRY_CAMPAIGN_V2,
            "v2",
            _load_captures(v2_captures_dir, QUARRY_CAMPAIGN_V2, "graph-v1"),
        ),
    )
    packs = []
    pack_index = []
    source_banks = []
    for campaign_id, source_version, captures in capture_sets:
        source_packs = _compile_quarry_packs(captures)
        source_bank_id = _quarry_source_bank_id(campaign_id)
        source_bank_material = {
            "schemaVersion": QUARRY_BANK_SCHEMA,
            "bankId": source_bank_id,
            "selectionMethod": "run-seed-modulo-pack-count-v1",
            "packs": source_packs,
        }
        packs.extend(source_packs)
        source_banks.append(
            {
                "bankId": source_bank_id,
                "campaignId": campaign_id,
                "sourceBankVersion": source_version,
                "captureCount": len(captures),
                "captureSetSha256": sha256_json(
                    [capture["contentSha256"] for capture in captures]
                ),
                "compiledBankContentSha256": sha256_json(source_bank_material),
            }
        )
        for capture, pack in zip(captures, source_packs):
            recipe_family, realization_id = _quarry_recipe_identity(
                capture["targetId"], campaign_id
            )
            pack_index.append(
                {
                    "packId": pack["packId"],
                    "packContentSha256": pack["contentSha256"],
                    "sourceCampaignId": campaign_id,
                    "sourceBankVersion": source_version,
                    "recipeFamily": recipe_family,
                    "realizationId": realization_id,
                    "redactedRequestSha256": capture["redactedRequestSha256"],
                    "captureContentSha256": capture["contentSha256"],
                }
            )
    _validate_quarry_corpus_shape(pack_index)
    bank_material = {
        "schemaVersion": QUARRY_CORPUS_SCHEMA,
        "bankId": "quarry-qgraph-ibm-fez-bank-v2",
        "selectionMethod": QUARRY_SELECTION_METHOD,
        "sourceBanks": source_banks,
        "packIndex": pack_index,
        "packs": packs,
    }
    return {**bank_material, "contentSha256": sha256_json(bank_material)}


def _compile_quarry_packs(
    captures: Sequence[Mapping[str, Any]],
) -> list[Dict[str, Any]]:
    packs = []
    for capture in captures:
        result = _mapping(capture.get("result"), "Quarry capture.result")
        measurements = _measurements(result, 12)
        if result.get("bit_order") != list(QUARRY_BIT_ORDER):
            raise ContractError("Quarry result.bit_order", "does not match runtime")
        provenance = {
            "kind": "qpu-record",
            "engineId": "graph-v1",
            "mothJobId": capture["mothJobId"],
            "hardwareJobId": capture["hardwareJobId"],
            "backendName": result["backend"],
            "rawResultSha256": capture["rawResultSha256"],
            "distributionProjection": "provider-returned-top-outcomes-v1",
            "requestedShots": result["shots"],
            "returnedShotCount": result["returned_shot_count"],
            "returnedProbabilityMass": result["returned_probability_mass"],
            "returnedMeasurementCount": result["returned_measurement_count"],
            "providerExecution": True,
        }
        material = {
            "schemaVersion": QGRAPH_PACK_SCHEMA,
            "packId": f"{capture['targetId']}-qpu-v1",
            "sourceClassification": "moth-qgraph-qpu",
            "provenance": provenance,
            "graphSchemaVersion": "graph-v1-measurement-distribution",
            "qubitCount": 12,
            "bitOrdering": ",".join(QUARRY_BIT_ORDER),
            "relationshipInterpretation": (
                "Each set bit is one directed hunting relation. The provider returned "
                "its top measured outcomes; local weighted sampling renormalizes only "
                "that preserved projection and never invents an unreturned outcome."
            ),
            "replay": {
                "algorithm": "mulberry32-v1",
                "seedNamespace": f"quarry-qpu:{capture['targetId']}",
                "wholeRegisterSampling": True,
            },
            "frames": [
                {
                    "schemaVersion": QGRAPH_FRAME_SCHEMA,
                    "frameId": f"{capture['targetId']}-phase-{phase + 1}",
                    "sequenceIndex": phase,
                    "measurements": measurements,
                }
                for phase in range(QUARRY_PHASE_COUNT)
            ],
        }
        packs.append({**material, "contentSha256": sha256_json(material)})
    return packs


def _quarry_source_bank_id(campaign_id: str) -> str:
    return (
        "quarry-qgraph-ibm-fez-bank-v1"
        if campaign_id == QUARRY_CAMPAIGN
        else "quarry-qgraph-ibm-fez-bank-v2-tranche"
    )


def _quarry_recipe_identity(target_id: str, campaign_id: str) -> tuple[str, str]:
    for sequence_index, recipe_id in enumerate(QUARRY_RECIPE_IDS, start=1):
        prefix = f"quarry-frame-{sequence_index}-{recipe_id}"
        if campaign_id == QUARRY_CAMPAIGN and target_id == prefix:
            return recipe_id, "r1"
        if campaign_id == QUARRY_CAMPAIGN_V2:
            for realization in (2, 3, 4):
                if target_id == f"{prefix}-r{realization}":
                    return recipe_id, f"r{realization}"
    raise ContractError("Quarry targetId", f"has unknown recipe identity {target_id!r}")


def _validate_quarry_corpus_shape(pack_index: Sequence[Mapping[str, Any]]) -> None:
    expected = {
        (recipe_id, f"r{realization}")
        for recipe_id in QUARRY_RECIPE_IDS
        for realization in (1, 2, 3, 4)
    }
    actual = {
        (record.get("recipeFamily"), record.get("realizationId"))
        for record in pack_index
    }
    if len(pack_index) != 24 or actual != expected:
        raise ContractError(
            "Quarry corpus",
            "must contain four hardware realizations for each of six recipes",
        )


def _load_captures(
    captures_dir: Path, campaign_id: str, engine_id: str
) -> list[Dict[str, Any]]:
    return _load_captures_for_campaigns(captures_dir, (campaign_id,), engine_id)


def _load_captures_for_campaigns(
    captures_dir: Path, campaign_ids: Sequence[str], engine_id: str
) -> list[Dict[str, Any]]:
    paths = sorted(
        path
        for path in captures_dir.glob("*.json")
        if not path.name.endswith(".rejected-result.json")
    )
    if not paths:
        raise ContractError(
            "captures", f"contains no {' or '.join(campaign_ids)} results"
        )
    captures = []
    for path in paths:
        capture = _mapping(_read_json(path), str(path))
        if (
            capture.get("schemaVersion") != CAPTURE_SCHEMA
            or capture.get("campaignId") not in campaign_ids
            or capture.get("engineId") != engine_id
        ):
            raise ContractError(str(path), "capture identity is invalid")
        material = dict(capture)
        content_sha = material.pop("contentSha256", None)
        if content_sha != sha256_json(material):
            raise ContractError(str(path), "capture content hash does not match")
        redacted_request = _mapping(
            capture.get("redactedRequest"), f"{path}.redactedRequest"
        )
        redacted_request_sha = capture.get("redactedRequestSha256")
        if (
            not isinstance(redacted_request_sha, str)
            or redacted_request_sha != sha256_json(redacted_request)
        ):
            raise ContractError(str(path), "redacted request hash does not match")
        if _contains_credential_field(capture):
            raise ContractError(str(path), "contains a credential-like field")
        captures.append(capture)
    _require_unique(captures, "targetId")
    _require_unique(captures, "mothJobId")
    _require_unique(captures, "hardwareJobId")
    _require_unique(captures, "rawResultSha256")
    return captures


def _measurements(result: Mapping[str, Any], bit_count: int) -> list[Dict[str, Any]]:
    raw = result.get("measurements")
    if not isinstance(raw, list) or not raw:
        raise ContractError("result.measurements", "is empty")
    output = []
    seen = set()
    for index, value in enumerate(raw):
        item = _mapping(value, f"result.measurements[{index}]")
        bitstring = item.get("bitstring")
        count = item.get("count")
        if (
            not isinstance(bitstring, str)
            or len(bitstring) != bit_count
            or set(bitstring).difference("01")
            or bitstring in seen
            or not isinstance(count, int)
            or isinstance(count, bool)
            or count <= 0
        ):
            raise ContractError(f"result.measurements[{index}]", "is invalid")
        seen.add(bitstring)
        output.append({"bitstring": bitstring, "weight": count})
    return output


def _require_unique(records: Iterable[Mapping[str, Any]], key: str) -> None:
    values = [record.get(key) for record in records]
    if any(not isinstance(value, str) or not value for value in values):
        raise ContractError(f"captures.{key}", "is missing")
    if len(set(values)) != len(values):
        raise ContractError(f"captures.{key}", "must be unique")


def _contains_credential_field(value: Any) -> bool:
    if isinstance(value, list):
        return any(_contains_credential_field(item) for item in value)
    if not isinstance(value, dict):
        return False
    for key, child in value.items():
        normalized = key.lower().replace("-", "_")
        if normalized in {
            "api_key",
            "access_token",
            "auth_token",
            "moth_api_key",
            "qpu_token",
            "qpu_instance",
        }:
            return True
        if _contains_credential_field(child):
            return True
    return False


def _mapping(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(label, "must be an object")
    return value


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError(str(path), "cannot be read as JSON") from error


def _write_json(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(dict(value)) + b"\n")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=("quantman", "quarry", "quarry-corpus"))
    parser.add_argument("--captures", type=Path, action="append")
    parser.add_argument("--campaign", choices=(QUARRY_CAMPAIGN, QUARRY_CAMPAIGN_V2))
    parser.add_argument("--v1-captures", type=Path)
    parser.add_argument("--v2-captures", type=Path)
    parser.add_argument("--preserved-fixture-bank", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.kind == "quarry-corpus":
        if (
            not args.v1_captures
            or not args.v2_captures
            or args.captures
            or args.preserved_fixture_bank
        ):
            raise ContractError(
                "arguments",
                "quarry-corpus requires --v1-captures and --v2-captures only",
            )
        bank = compile_quarry_corpus(args.v1_captures, args.v2_captures)
    else:
        if (
            not args.captures
            or args.v1_captures
            or args.v2_captures
            or (args.kind == "quarry" and args.preserved_fixture_bank)
        ):
            raise ContractError(
                "arguments",
                (
                    "quantman requires --captures and optionally "
                    "--preserved-fixture-bank"
                    if args.kind == "quantman"
                    else "quarry requires --captures only"
                ),
            )
        bank = (
            compile_quantman(args.captures, args.preserved_fixture_bank)
            if args.kind == "quantman"
            else compile_quarry(
                _single_capture_path(args.captures),
                args.campaign or QUARRY_CAMPAIGN,
            )
        )
    _write_json(args.output, bank)
    print(
        json.dumps(
            {
                "output": str(args.output),
                "contentSha256": bank["contentSha256"],
                "itemCount": len(bank.get("fixtures", bank.get("packs", []))),
                "networkMutation": False,
            },
            indent=2,
        )
    )
    return 0


def _single_capture_path(paths: Sequence[Path]) -> Path:
    if len(paths) != 1:
        raise ContractError("arguments", "quarry requires exactly one --captures path")
    return paths[0]


if __name__ == "__main__":
    raise SystemExit(main())
