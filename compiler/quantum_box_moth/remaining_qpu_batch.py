"""Acquire Quantman Labyrinth and Quarry QGraph QPU evidence safely.

This module deliberately separates authenticated contract inspection, immutable
request preparation, mutation, collection, and later game-pack promotion.  It
never writes credentials, never retries a POST, and never promotes a result.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import time
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

from .canonical import canonical_bytes, sha256_bytes, sha256_json
from .client import ALLOWED_ORIGIN, MothApiClient
from .models import (
    API_SPECIFICATION_SHA256,
    API_VERSION,
    AmbiguousMutationError,
    ContractError,
    EngineContract,
    INTERMEDIATE_STATUSES,
    MothApiError,
    MutationApproval,
    ResultGoneError,
    ResultNotReadyError,
)


CACHE_ROOT = Path(".moth-cache/remaining-game-qpu-v1")
INSPECTION_SCHEMA = "quantum-box-remaining-qpu-inspection-v1"
MANIFEST_SCHEMA = "quantum-box-remaining-qpu-manifest-v1"
SUBMISSION_SCHEMA = "quantum-box-remaining-qpu-submission-v1"
COLLECTION_SCHEMA = "quantum-box-remaining-qpu-collection-v1"
CAPTURE_SCHEMA = "quantum-box-remaining-qpu-capture-v1"
SHOTS = 4096
BACKEND_NAME = "ibm_fez"
LABYRINTH_TARGET_CONVENTION = (
    "sign=+1 corridor/door (ZZ=+1), sign=-1 wall (ZZ=-1)"
)

LABYRINTH_ENGINE_ID = "labyrinth-v1"
GRAPH_ENGINE_ID = "graph-v1"
QUANTMAN_CAMPAIGN = "quantman-labyrinth-qpu-bank-v1"
QUANTMAN_SERIAL_CAMPAIGN = "quantman-labyrinth-qpu-serial-test-v1"
QUANTMAN_SERIAL_MAP01_CAMPAIGN = "quantman-labyrinth-map01-serial-v1"
QUANTMAN_SERIAL_MAP02_CAMPAIGN = "quantman-labyrinth-map02-serial-v1"
QUANTMAN_SERIAL_MAP03_CAMPAIGN = "quantman-labyrinth-map03-serial-v1"
QUANTMAN_SERIAL_MAP04_CAMPAIGN = "quantman-labyrinth-map04-serial-v1"
QUANTMAN_SERIAL_MAP05_CAMPAIGN = "quantman-labyrinth-map05-serial-v1"
QUANTMAN_SERIAL_MAP06_CAMPAIGN = "quantman-labyrinth-map06-serial-v1"
QUARRY_CAMPAIGN = "quarry-qgraph-qpu-bank-v1"

# Second acquisition tranche. These campaigns are deliberately separate from
# the completed v1 ledgers so no existing submission can be resubmitted.
QUANTMAN_CAMPAIGN_V2 = "quantman-labyrinth-qpu-bank-v2"
QUARRY_CAMPAIGN_V2 = "quarry-qgraph-qpu-bank-v2"

CAMPAIGN_IDS = (
    QUANTMAN_CAMPAIGN,
    QUANTMAN_SERIAL_CAMPAIGN,
    QUANTMAN_SERIAL_MAP01_CAMPAIGN,
    QUANTMAN_SERIAL_MAP02_CAMPAIGN,
    QUANTMAN_SERIAL_MAP03_CAMPAIGN,
    QUANTMAN_SERIAL_MAP04_CAMPAIGN,
    QUANTMAN_SERIAL_MAP05_CAMPAIGN,
    QUANTMAN_SERIAL_MAP06_CAMPAIGN,
    QUARRY_CAMPAIGN,
    QUANTMAN_CAMPAIGN_V2,
    QUARRY_CAMPAIGN_V2,
)
QUANTMAN_TARGET_COUPLING_SHA256 = (
    "0d63ffbd489385cebb77300a61b47b4ca6029a96260e826209bb0b322ae0faee"
)

EQUAL = {"XX": 1.0, "YY": -1.0, "ZZ": 1.0}
OPPOSED = {"XX": 1.0, "YY": 1.0, "ZZ": -1.0}
RELATIONSHIP_PAULIS = {"equal": EQUAL, "opposed": OPPOSED}

# Each qubit represents one directed relationship in the order used by Quarry.
QUARRY_BIT_ORDER = (
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
)
# Reciprocal directed edges are coupled. Equal permits mutual/absent pursuit;
# opposed produces exactly one directed pursuit for that player pair.
QUARRY_RECIPROCAL_PAIRS = ((0, 3), (1, 6), (2, 9), (4, 7), (5, 10), (8, 11))
QUARRY_RECIPES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("all-opposed", ("opposed",) * 6),
    ("all-equal", ("equal",) * 6),
    (
        "front-opposed-back-equal",
        ("opposed", "opposed", "opposed", "equal", "equal", "equal"),
    ),
    (
        "front-equal-back-opposed",
        ("equal", "equal", "equal", "opposed", "opposed", "opposed"),
    ),
    (
        "alternating-a",
        ("opposed", "equal", "opposed", "equal", "opposed", "equal"),
    ),
    (
        "alternating-b",
        ("equal", "opposed", "equal", "opposed", "equal", "opposed"),
    ),
)


@dataclass(frozen=True)
class Target:
    target_id: str
    engine_id: str
    params_without_secrets: Mapping[str, Any]
    claim_boundary: str

    def request_body(self, qpu_token: str, qpu_instance: str) -> Dict[str, Any]:
        params = json.loads(json.dumps(self.params_without_secrets))
        params["qpu_token"] = qpu_token
        params["qpu_instance"] = qpu_instance
        return {"params": params}

    def redacted_request(self) -> Dict[str, Any]:
        return {"params": json.loads(json.dumps(self.params_without_secrets))}


def full_grid_edges(rows: int, columns: int) -> Tuple[Tuple[int, int], ...]:
    edges: List[Tuple[int, int]] = []
    for row in range(rows):
        for column in range(columns):
            room = row * columns + column
            if column + 1 < columns:
                edges.append((room, room + 1))
            if row + 1 < rows:
                edges.append((room, room + columns))
    return tuple(edges)


def quantman_coupling_map() -> Tuple[Tuple[int, int], ...]:
    """Return a deterministic perfect-maze target over all 100 rooms.

    Labyrinth treats the submitted coupling map as the desired open corridors,
    while every omitted orthogonal edge is a desired wall.  A depth-first
    spanning tree is therefore a complete, connected maze specification rather
    than an arbitrary graph or a copy of a sampled result.
    """

    rows = columns = 10
    generator_state = 0x51424F58  # "QBOX"; fixed authored-input provenance.

    def next_value() -> int:
        nonlocal generator_state
        generator_state ^= (generator_state << 13) & 0xFFFFFFFF
        generator_state ^= generator_state >> 17
        generator_state ^= (generator_state << 5) & 0xFFFFFFFF
        generator_state &= 0xFFFFFFFF
        return generator_state

    def room(row: int, column: int) -> int:
        return row * columns + column

    visited = {0}
    stack = [0]
    edges: List[Tuple[int, int]] = []
    while stack:
        current = stack[-1]
        row, column = divmod(current, columns)
        candidates = [
            room(next_row, next_column)
            for next_row, next_column in (
                (row - 1, column),
                (row, column + 1),
                (row + 1, column),
                (row, column - 1),
            )
            if 0 <= next_row < rows
            and 0 <= next_column < columns
            and room(next_row, next_column) not in visited
        ]
        if not candidates:
            stack.pop()
            continue
        chosen = candidates[next_value() % len(candidates)]
        edges.append((min(current, chosen), max(current, chosen)))
        visited.add(chosen)
        stack.append(chosen)

    result = tuple(sorted(edges))
    if len(result) != rows * columns - 1:
        raise AssertionError("Quantman target must be a 99-edge spanning tree")
    _validate_grid_edges(result, rows, columns)
    _validate_connected(result, rows * columns)
    if sha256_json([list(edge) for edge in result]) != QUANTMAN_TARGET_COUPLING_SHA256:
        raise AssertionError("Quantman target coupling map changed without review")
    return result



# Six deterministic seeds for six distinct 10x10 perfect-maze targets.
# Each maze is a spanning tree over all 100 rooms: 99 corridor edges,
# fully connected and cycle-free.
QUANTMAN_V2_MAZE_SEEDS = (
    104729,
    130363,
    155921,
    196613,
    262147,
    314573,
)


def quantman_v2_coupling_map(seed: int) -> Tuple[Tuple[int, int], ...]:
    """Generate a deterministic 10x10 perfect-maze coupling map."""

    rows = 10
    columns = 10
    state = seed & 0x7FFFFFFF

    def choose(count: int) -> int:
        nonlocal state
        # Deterministic local PRNG. This is only authoring the target maze;
        # it is not being presented as quantum randomness.
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        return state % count

    visited = {0}
    stack = [0]
    edges: List[Tuple[int, int]] = []

    while stack:
        room = stack[-1]
        row, column = divmod(room, columns)

        candidates: List[int] = []

        if row > 0:
            neighbour = room - columns
            if neighbour not in visited:
                candidates.append(neighbour)

        if column + 1 < columns:
            neighbour = room + 1
            if neighbour not in visited:
                candidates.append(neighbour)

        if row + 1 < rows:
            neighbour = room + columns
            if neighbour not in visited:
                candidates.append(neighbour)

        if column > 0:
            neighbour = room - 1
            if neighbour not in visited:
                candidates.append(neighbour)

        if not candidates:
            stack.pop()
            continue

        neighbour = candidates[choose(len(candidates))]
        edges.append((room, neighbour))
        visited.add(neighbour)
        stack.append(neighbour)

    if len(visited) != rows * columns:
        raise AssertionError("Quantman v2 maze does not span all 100 rooms")

    if len(edges) != rows * columns - 1:
        raise AssertionError("Quantman v2 maze is not a 99-edge perfect maze")

    return tuple(edges)


def build_targets(campaign_id: str) -> Tuple[Target, ...]:
    if campaign_id == QUANTMAN_CAMPAIGN:
        coupling_map = quantman_coupling_map()
        return (
            Target(
                target_id="quantman-10x10-r1",
                engine_id=LABYRINTH_ENGINE_ID,
                params_without_secrets={
                    "level_data": {
                        "name": "Quantum Box Quantman 10x10 v1",
                        "grid_size": {"rows": 10, "cols": 10},
                        "num_qubits": 100,
                        "coupling_map": [list(edge) for edge in coupling_map],
                    },
                    "shots": SHOTS,
                    "top_n": -1,
                    "mode": "qpu",
                    "backend_name": BACKEND_NAME,
                    "fraction": 1 / 3,
                    "k": 3,
                    "steps": 3,
                },
                claim_boundary=(
                    "A completed Moth labyrinth-v1 IBM Fez return acquired before play. "
                    "No gameplay authority is claimed until the exact result passes the "
                    "Quantman decoder, provenance audit, and deterministic play checks."
                ),
            ),
        )
    if campaign_id == QUANTMAN_SERIAL_CAMPAIGN:
        return (
            _quantman_serial_target(
                target_id="quantman-known-good-serial-r1",
                name="Quantum Box Quantman known-good serial control",
                coupling_map=quantman_coupling_map(),
                claim_boundary=(
                    "Single isolated IBM Fez Labyrinth execution using the "
                    "previously successful Quantman v1 coupling map, submitted "
                    "as a control after the v2 bulk campaign failed."
                ),
            ),
        )
    serial_map_campaigns = {
        QUANTMAN_SERIAL_MAP01_CAMPAIGN: 1,
        QUANTMAN_SERIAL_MAP02_CAMPAIGN: 2,
        QUANTMAN_SERIAL_MAP03_CAMPAIGN: 3,
        QUANTMAN_SERIAL_MAP04_CAMPAIGN: 4,
        QUANTMAN_SERIAL_MAP05_CAMPAIGN: 5,
        QUANTMAN_SERIAL_MAP06_CAMPAIGN: 6,
    }
    if campaign_id in serial_map_campaigns:
        map_index = serial_map_campaigns[campaign_id]
        return (
            _quantman_serial_target(
                target_id=f"quantman-map-{map_index:02d}-serial-r1",
                name=f"Quantum Box Quantman v2 map {map_index:02d} serial",
                coupling_map=quantman_v2_coupling_map(
                    QUANTMAN_V2_MAZE_SEEDS[map_index - 1]
                ),
                claim_boundary=(
                    "Single isolated IBM Fez Labyrinth execution of "
                    f"Quantman v2 authored maze {map_index:02d}."
                ),
            ),
        )
    if campaign_id == QUANTMAN_CAMPAIGN_V2:
        targets: List[Target] = []

        for map_index, seed in enumerate(QUANTMAN_V2_MAZE_SEEDS, start=1):
            coupling_map = quantman_v2_coupling_map(seed)

            # Two independent QPU executions of the same authored target.
            for repetition in (1, 2):
                targets.append(
                    Target(
                        target_id=f"quantman-map-{map_index:02d}-r{repetition}",
                        engine_id=LABYRINTH_ENGINE_ID,
                        params_without_secrets={
                            "level_data": {
                                "name": (
                                    f"Quantum Box Quantman 10x10 v2 "
                                    f"map {map_index:02d}"
                                ),
                                "grid_size": {"rows": 10, "cols": 10},
                                "num_qubits": 100,
                                "coupling_map": [
                                    list(edge) for edge in coupling_map
                                ],
                            },
                            "shots": SHOTS,
                            "top_n": -1,
                            "mode": "qpu",
                            "backend_name": BACKEND_NAME,
                            "fraction": 1 / 3,
                            "k": 3,
                            "steps": 3,
                        },
                        claim_boundary=(
                            "A completed Moth labyrinth-v1 IBM Fez return acquired "
                            "before play. No gameplay authority is claimed until the "
                            "exact result passes the Quantman decoder, provenance "
                            "audit, and deterministic play checks."
                        ),
                    )
                )

        return tuple(targets)

    if campaign_id == QUARRY_CAMPAIGN:
        targets: List[Target] = []
        for sequence_index, (recipe_id, relationships) in enumerate(
            QUARRY_RECIPES, start=1
        ):
            operations = [
                {
                    "type": "relationship",
                    "qubits": list(pair),
                    "paulis": dict(RELATIONSHIP_PAULIS[relationship]),
                    "update": True,
                }
                for pair, relationship in zip(
                    QUARRY_RECIPROCAL_PAIRS, relationships
                )
            ]
            targets.append(
                Target(
                    target_id=f"quarry-frame-{sequence_index}-{recipe_id}",
                    engine_id=GRAPH_ENGINE_ID,
                    params_without_secrets={
                        "num_qubits": 12,
                        "coupling_map": [
                            list(pair) for pair in QUARRY_RECIPROCAL_PAIRS
                        ],
                        "operations": operations,
                        "shots": SHOTS,
                        "mode": "qpu",
                        "backend_name": BACKEND_NAME,
                    },
                    claim_boundary=(
                        "A completed Moth graph-v1 IBM Fez distribution acquired before "
                        "play. Its twelve measured bits map in the recorded order to "
                        "Quarry's twelve directed pursuit relations; scheduling and "
                        "sampling during play remain local and deterministic."
                    ),
                )
            )
        return tuple(targets)

    if campaign_id == QUARRY_CAMPAIGN_V2:
        targets: List[Target] = []

        for sequence_index, (recipe_id, relationships) in enumerate(
            QUARRY_RECIPES, start=1
        ):
            operations = [
                {
                    "type": "relationship",
                    "qubits": list(pair),
                    "paulis": dict(RELATIONSHIP_PAULIS[relationship]),
                    "update": True,
                }
                for pair, relationship in zip(
                    QUARRY_RECIPROCAL_PAIRS, relationships
                )
            ]

            # Three additional independent QPU executions per recipe.
            # r1 is the already-completed v1 acquisition, so the new
            # executions are labelled r2-r4.
            for repetition in (2, 3, 4):
                targets.append(
                    Target(
                        target_id=(
                            f"quarry-frame-{sequence_index}-{recipe_id}"
                            f"-r{repetition}"
                        ),
                        engine_id=GRAPH_ENGINE_ID,
                        params_without_secrets={
                            "num_qubits": 12,
                            "coupling_map": [
                                list(pair)
                                for pair in QUARRY_RECIPROCAL_PAIRS
                            ],
                            "operations": operations,
                            "shots": SHOTS,
                            "mode": "qpu",
                            "backend_name": BACKEND_NAME,
                        },
                        claim_boundary=(
                            "A completed Moth graph-v1 IBM Fez distribution "
                            "acquired before play. Its twelve measured bits map "
                            "in the recorded order to Quarry's twelve directed "
                            "pursuit relations; scheduling and sampling during "
                            "play remain local and deterministic."
                        ),
                    )
                )

        return tuple(targets)

    raise ContractError("campaign", f"unsupported campaign {campaign_id!r}")


def _quantman_serial_target(
    target_id: str,
    name: str,
    coupling_map: Sequence[Tuple[int, int]],
    claim_boundary: str,
) -> Target:
    return Target(
        target_id=target_id,
        engine_id=LABYRINTH_ENGINE_ID,
        params_without_secrets={
            "level_data": {
                "name": name,
                "grid_size": {"rows": 10, "cols": 10},
                "num_qubits": 100,
                "coupling_map": [list(edge) for edge in coupling_map],
            },
            "shots": SHOTS,
            "top_n": -1,
            "mode": "qpu",
            "backend_name": BACKEND_NAME,
            "fraction": 1 / 3,
            "k": 3,
            "steps": 3,
        },
        claim_boundary=claim_boundary,
    )


def inspect_contracts() -> int:
    api_key = _required_environment(("MOTH_API_KEY",))["MOTH_API_KEY"]
    client = MothApiClient(ALLOWED_ORIGIN, api_key)
    engines: List[Dict[str, Any]] = []
    for engine_id in (LABYRINTH_ENGINE_ID, GRAPH_ENGINE_ID):
        record = client.engine(engine_id)
        contract = _validate_live_engine(record, engine_id)
        params = _parameter_properties(record)
        engines.append(
            {
                "engineId": engine_id,
                "name": record.get("name"),
                "owner": record.get("owner"),
                "updatedAt": contract.updated_at,
                "canonicalSha256": contract.canonical_sha256,
                "listedCreditsPerRun": contract.credits_per_run,
                "outputType": contract.output_type,
                "qpuSurface": {
                    "modeValues": params.get("mode", {}).get("enum"),
                    "backendNameParameter": "backend_name" in params,
                    "qpuTokenParameter": "qpu_token" in params,
                    "qpuInstanceParameter": "qpu_instance" in params,
                    "shotsMaximum": params.get("shots", {}).get("maximum"),
                    "topNMinimum": params.get("top_n", {}).get("minimum"),
                },
            }
        )
    payload = {
        "schemaVersion": INSPECTION_SCHEMA,
        "inspectedAtUtc": _utc_now(),
        "apiOrigin": ALLOWED_ORIGIN,
        "apiSpecification": {
            "version": API_VERSION,
            "canonicalSha256": API_SPECIFICATION_SHA256,
        },
        "networkMutation": False,
        "engines": engines,
    }
    path = _project_root() / CACHE_ROOT / "contract-inspection-v1.json"
    _write_json_atomic(path, payload, 0o600)
    print(
        json.dumps(
            {
                "inspectionPath": str(path.relative_to(_project_root())),
                "networkMutation": False,
                "engines": [
                    {
                        "engineId": item["engineId"],
                        "canonicalSha256": item["canonicalSha256"],
                        "updatedAt": item["updatedAt"],
                        "listedCreditsPerRun": item["listedCreditsPerRun"],
                    }
                    for item in engines
                ],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def prepare_campaign(campaign_id: str, accept_engine_sha: str) -> int:
    targets = build_targets(campaign_id)
    inspection = _load_inspection()
    engine_id = targets[0].engine_id
    engine = next(
        (
            item
            for item in inspection["engines"]
            if item.get("engineId") == engine_id
        ),
        None,
    )
    if not isinstance(engine, dict):
        raise ContractError("inspection", f"contains no {engine_id} record")
    if engine.get("canonicalSha256") != accept_engine_sha:
        raise ContractError(
            "accepted engine SHA-256",
            "does not match the authenticated inspection",
        )
    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "campaignId": campaign_id,
        "engineId": engine_id,
        "apiSpecification": inspection.get("apiSpecification"),
        "acceptedEngineCanonicalSha256": accept_engine_sha,
        "engineUpdatedAt": engine.get("updatedAt"),
        "listedCreditsPerRun": engine.get("listedCreditsPerRun"),
        "targetCount": len(targets),
        "maximumListedCredits": len(targets)
        * int(engine.get("listedCreditsPerRun", 0)),
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
    path = _campaign_dir(campaign_id) / "manifest-v1.json"
    _write_or_verify(path, manifest, 0o600)
    print(
        json.dumps(
            {
                "campaignId": campaign_id,
                "manifestPath": str(path.relative_to(_project_root())),
                "targetCount": len(targets),
                "maximumListedCredits": manifest["maximumListedCredits"],
                "networkMutation": False,
                "submissionAuthorized": False,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def submit_campaign(
    campaign_id: str, accept_engine_sha: str, delay_seconds: float
) -> int:
    if delay_seconds < 0:
        raise ContractError("delay seconds", "must not be negative")
    secrets = _required_environment(
        ("MOTH_API_KEY", "IBM_QPU_TOKEN", "IBM_QPU_INSTANCE")
    )
    targets = build_targets(campaign_id)
    manifest = _load_manifest(campaign_id, accept_engine_sha, targets)
    engine_id = targets[0].engine_id
    client = MothApiClient(ALLOWED_ORIGIN, secrets["MOTH_API_KEY"])
    live_record = client.engine(engine_id)
    engine = _validate_live_engine(live_record, engine_id)
    if engine.canonical_sha256 != accept_engine_sha:
        raise ContractError(
            "live engine SHA-256",
            "changed after inspection; inspect and prepare again",
        )
    if engine.credits_per_run != manifest["listedCreditsPerRun"]:
        raise ContractError(
            "live engine credits", "changed after campaign preparation"
        )

    state_path = _campaign_dir(campaign_id) / "submission-state-v1.json"
    events_path = _campaign_dir(campaign_id) / "submission-events-v1.jsonl"
    state = _load_submission_state(state_path, campaign_id, targets)
    if state["inFlight"] is not None:
        raise ContractError(
            "submission state",
            "contains an unresolved POST; reconcile it before resuming",
        )
    pending = [
        target
        for target in targets
        if target.target_id not in state["submittedJobs"]
    ]
    if not pending:
        print(f"{campaign_id} submission is already complete.")
        return 0
    print(
        f"Submitting {len(pending)} {engine_id} QPU job(s) sequentially; "
        "POST requests are never retried."
    )
    for index, target in enumerate(pending, start=1):
        body = target.request_body(
            secrets["IBM_QPU_TOKEN"], secrets["IBM_QPU_INSTANCE"]
        )
        approval = MutationApproval(
            engine_id=engine_id,
            engine_canonical_sha256=engine.canonical_sha256,
            request_sha256=sha256_json(body),
            listed_credits=engine.credits_per_run,
            approved_at_utc=_utc_now(),
            approval_note_sha256=sha256_bytes(
                b"Doug authorized remaining-game QPU acquisition on 2026-09-06."
            ),
        )
        state["inFlight"] = {
            "targetId": target.target_id,
            "attemptedAtUtc": _utc_now(),
            "redactedRequestSha256": sha256_json(target.redacted_request()),
        }
        state["updatedAtUtc"] = _utc_now()
        _write_json_atomic(state_path, state, 0o600)
        _append_event(events_path, {"event": "submission-attempted", **state["inFlight"]})
        print(f"[{index}/{len(pending)}] {target.target_id}")
        try:
            submitted = client.submit(engine, body, approval)
        except AmbiguousMutationError as error:
            # Transport uncertainty can mean that a provider job exists without
            # a trustworthy receipt. Keep the in-flight guard so a later
            # invocation cannot duplicate the POST.
            safe_error = _redact(str(error), secrets.values())
            _append_event(
                events_path,
                {
                    "event": "submission-stopped",
                    "targetId": target.target_id,
                    "observedAtUtc": _utc_now(),
                    "error": safe_error,
                },
            )
            print(f"Stopped safely at {target.target_id}: {safe_error}")
            return 1
        except (MothApiError, ContractError) as error:
            # The client converts malformed success responses and server-side
            # failures into AmbiguousMutationError. What remains is either a
            # definite client rejection or a local preflight failure, so no job
            # was accepted. Clear the guard, but do not retry during this run.
            state["inFlight"] = None
            state["updatedAtUtc"] = _utc_now()
            _write_json_atomic(state_path, state, 0o600)
            safe_error = _redact(str(error), secrets.values())
            _append_event(
                events_path,
                {
                    "event": "submission-rejected",
                    "targetId": target.target_id,
                    "observedAtUtc": _utc_now(),
                    "error": safe_error,
                },
            )
            print(f"Rejected at {target.target_id}: {safe_error}")
            return 1
        receipt = {
            "targetId": target.target_id,
            "mothJobId": submitted.job_id,
            "status": submitted.status,
            "submittedAt": submitted.submitted_at,
            "redactedRequestSha256": sha256_json(target.redacted_request()),
        }
        state["submittedJobs"][target.target_id] = receipt
        state["inFlight"] = None
        state["updatedAtUtc"] = _utc_now()
        _write_json_atomic(state_path, state, 0o600)
        _append_event(events_path, {"event": "submitted", **receipt})
        print(f"  queued as {submitted.job_id}")
        if index < len(pending) and delay_seconds:
            time.sleep(delay_seconds)
    return 0


def collect_campaign(campaign_id: str, delay_seconds: float) -> int:
    if delay_seconds < 0:
        raise ContractError("delay seconds", "must not be negative")
    api_key = _required_environment(("MOTH_API_KEY",))["MOTH_API_KEY"]
    targets = build_targets(campaign_id)
    target_by_id = {target.target_id: target for target in targets}
    manifest = _load_campaign_manifest(campaign_id, targets)
    submission_path = _campaign_dir(campaign_id) / "submission-state-v1.json"
    if not submission_path.exists():
        raise ContractError("submission state", "does not exist")
    submission = _load_submission_state(submission_path, campaign_id, targets)
    submitted_jobs = submission.get("submittedJobs")
    if not isinstance(submitted_jobs, dict):
        raise ContractError("submission state", "submittedJobs is invalid")
    unexpected = set(submitted_jobs).difference(target_by_id)
    if unexpected:
        raise ContractError(
            "submission state",
            "contains unexpected targets: " + ", ".join(sorted(unexpected)),
        )
    if not submitted_jobs:
        raise ContractError("submission state", "contains no submitted jobs")

    submitted_targets = [
        target for target in targets if target.target_id in submitted_jobs
    ]

    collection_path = _campaign_dir(campaign_id) / "collection-state-v1.json"
    events_path = _campaign_dir(campaign_id) / "collection-events-v1.jsonl"
    captures_dir = _campaign_dir(campaign_id) / "captures-v1"
    state = _load_collection_state(collection_path, campaign_id)
    client = MothApiClient(ALLOWED_ORIGIN, api_key)
    captured_now = 0
    pending = 0
    failures = 0
    for index, target in enumerate(submitted_targets, start=1):
        if state["jobs"].get(target.target_id, {}).get("state") == "captured":
            continue
        receipt = submitted_jobs[target.target_id]
        job_id = receipt.get("mothJobId") if isinstance(receipt, dict) else None
        if not isinstance(job_id, str) or not job_id:
            raise ContractError(
                f"submission state.{target.target_id}", "job ID is missing"
            )
        print(f"[{index}/{len(submitted_targets)}] {target.target_id}")
        try:
            snapshot = client.status(job_id)
            if snapshot.engine_id != target.engine_id:
                raise ContractError("job status.engine_id", "does not match target")
            if snapshot.submitted_at != receipt.get("submittedAt"):
                raise ContractError("job status.submitted_at", "does not match receipt")
            observation = {
                "targetId": target.target_id,
                "mothJobId": job_id,
                "state": snapshot.status,
                "providerUpdatedAt": snapshot.updated_at,
                "observedAtUtc": _utc_now(),
                "terminalStatusSha256": sha256_json(snapshot.raw),
            }
            if snapshot.status in INTERMEDIATE_STATUSES:
                pending += 1
            elif snapshot.status in ("failed", "cancelled"):
                failures += 1
            elif snapshot.status == "completed":
                try:
                    result = client.result(job_id)
                except ResultNotReadyError:
                    observation["state"] = "completed-result-not-ready"
                    pending += 1
                except ResultGoneError:
                    observation["state"] = "result-gone"
                    failures += 1
                else:
                    try:
                        normalized = _normalize_result(target, result.raw_bytes)
                    except ContractError as validation_error:
                        # Preserve the exact rejected bytes privately so schema
                        # drift can be diagnosed without another provider job.
                        rejected_path = (
                            captures_dir / f"{target.target_id}.rejected-result.json"
                        )
                        _write_bytes_atomic(rejected_path, result.raw_bytes, 0o600)
                        observation.update(
                            {
                                "state": "validation-rejected",
                                "rejectedResultPath": str(
                                    rejected_path.relative_to(_project_root())
                                ),
                                "rawResultSha256": result.raw_sha256,
                                "validationError": str(validation_error),
                            }
                        )
                        failures += 1
                    else:
                        material = {
                            "schemaVersion": CAPTURE_SCHEMA,
                            "campaignId": campaign_id,
                            "targetId": target.target_id,
                            "engineId": target.engine_id,
                            "engineCanonicalSha256": manifest[
                                "acceptedEngineCanonicalSha256"
                            ],
                            "engineUpdatedAt": manifest["engineUpdatedAt"],
                            "apiSpecification": manifest["apiSpecification"],
                            "listedCreditsPerRun": manifest["listedCreditsPerRun"],
                            "mothJobId": job_id,
                            "hardwareJobId": _hardware_job_id(target, normalized),
                            "submittedAt": snapshot.submitted_at,
                            "providerUpdatedAt": snapshot.updated_at,
                            "terminalObservedAtUtc": _utc_now(),
                            "retrievedAtUtc": _utc_now(),
                            "terminalStatusSha256": observation[
                                "terminalStatusSha256"
                            ],
                            "rawResultSha256": result.raw_sha256,
                            "redactedRequest": target.redacted_request(),
                            "redactedRequestSha256": sha256_json(
                                target.redacted_request()
                            ),
                            "result": normalized,
                            "claimBoundary": target.claim_boundary,
                        }
                        capture = {
                            **material,
                            "contentSha256": sha256_json(material),
                        }
                        capture_path = captures_dir / f"{target.target_id}.json"
                        _write_json_atomic(capture_path, capture, 0o600)
                        observation.update(
                            {
                                "state": "captured",
                                "capturePath": str(
                                    capture_path.relative_to(_project_root())
                                ),
                                "captureContentSha256": capture["contentSha256"],
                                "rawResultSha256": result.raw_sha256,
                            }
                        )
                        captured_now += 1
            else:
                raise ContractError(
                    "job status", f"unsupported value {snapshot.status!r}"
                )
            state["jobs"][target.target_id] = observation
            _append_event(events_path, observation)
            print(f"  {observation['state']}")
        except (MothApiError, ContractError) as error:
            failures += 1
            safe_error = _redact(str(error), (api_key,))
            observation = {
                "targetId": target.target_id,
                "mothJobId": job_id,
                "state": "safe-get-failure",
                "observedAtUtc": _utc_now(),
                "safeError": safe_error,
            }
            state["jobs"][target.target_id] = observation
            _append_event(events_path, observation)
            print(f"  safe GET failed: {safe_error}")
        finally:
            state["updatedAtUtc"] = _utc_now()
            _write_json_atomic(collection_path, state, 0o600)
        if index < len(submitted_targets) and delay_seconds:
            time.sleep(delay_seconds)
    print(
        f"Collection sweep: {captured_now} new, {pending} pending, "
        f"{failures} failures."
    )
    return 0 if failures == 0 else 1


def normalize_labyrinth_result(raw_bytes: bytes, target: Target) -> Dict[str, Any]:
    document = _decode_result(raw_bytes, "Labyrinth result")
    output = document.get("output", document)
    if not isinstance(output, dict):
        raise ContractError("Labyrinth result.output", "must be an object")
    params = target.params_without_secrets
    level = params["level_data"]
    if output.get("name") != level["name"]:
        raise ContractError("Labyrinth output.name", "does not match request")
    if output.get("grid_size") != {"rows": 10, "cols": 10}:
        raise ContractError("Labyrinth output.grid_size", "is not 10x10")
    if output.get("num_qubits") != 100:
        raise ContractError("Labyrinth output.num_qubits", "is not 100")
    expected_full_grid = full_grid_edges(10, 10)
    observed_grid = _normalized_edges(
        output.get("coupling_map"), 100, "Labyrinth output.coupling_map"
    )
    if observed_grid != expected_full_grid:
        raise ContractError(
            "Labyrinth output.coupling_map",
            "does not enumerate the full 10x10 grid",
        )
    target_record = output.get("target")
    if not isinstance(target_record, dict):
        raise ContractError("Labyrinth output.target", "must be an object")
    if target_record.get("convention") != LABYRINTH_TARGET_CONVENTION:
        raise ContractError("Labyrinth output.target.convention", "is unsupported")
    signs_input = target_record.get("edge_signs")
    if not isinstance(signs_input, list):
        raise ContractError("Labyrinth output.target.edge_signs", "must be a list")
    signs: Dict[Tuple[int, int], int] = {}
    for index, item in enumerate(signs_input):
        if not isinstance(item, dict) or item.get("sign") not in (-1, 1):
            raise ContractError(
                f"Labyrinth output.target.edge_signs[{index}]", "is invalid"
            )
        edge = _normalized_edge(
            item.get("qubits"), 100, f"Labyrinth output.target.edge_signs[{index}]"
        )
        if edge in signs:
            raise ContractError("Labyrinth output.target.edge_signs", "has duplicates")
        signs[edge] = item["sign"]
    if tuple(sorted(signs)) != expected_full_grid:
        raise ContractError(
            "Labyrinth output.target.edge_signs", "does not cover the full grid"
        )
    # Target authoring order is not semantic. Labyrinth returns its target
    # signs in full-grid order, so compare normalized undirected edges.
    expected_corridors = _normalized_edges(
        level["coupling_map"],
        100,
        "Labyrinth request.level_data.coupling_map",
    )
    if tuple(edge for edge in expected_full_grid if signs[edge] == 1) != expected_corridors:
        raise ContractError(
            "Labyrinth output.target.edge_signs",
            "does not reproduce the submitted target corridors",
        )
    if (
        target_record.get("n_corridor") != len(expected_corridors)
        or target_record.get("n_barrier")
        != len(expected_full_grid) - len(expected_corridors)
    ):
        raise ContractError("Labyrinth output.target", "edge totals are inconsistent")
    if output.get("relationships") != []:
        raise ContractError(
            "Labyrinth output.relationships", "must match the empty request"
        )
    results = output.get("results")
    if not isinstance(results, dict):
        raise ContractError("Labyrinth output.results", "must be an object")
    measurements = _normalize_probability_measurements(
        results.get("measurements"), 100, SHOTS, "Labyrinth output.results.measurements"
    )
    expectations = results.get("z_expectations")
    if (
        not isinstance(expectations, list)
        or len(expectations) != 100
        or any(
            not _finite_number(value) or not -1 <= float(value) <= 1
            for value in expectations
        )
    ):
        raise ContractError(
            "Labyrinth output.results.z_expectations",
            "must contain one finite value per qubit",
        )
    initial_states = output.get("initial_states")
    if not isinstance(initial_states, dict) or set(initial_states) != {
        str(index) for index in range(100)
    }:
        raise ContractError(
            "Labyrinth output.initial_states", "must cover every row-major qubit"
        )
    for index in range(100):
        initial = initial_states[str(index)]
        if (
            not isinstance(initial, dict)
            or any(
                not _finite_number(initial.get(axis))
                or not -1 <= float(initial[axis]) <= 1
                for axis in ("X", "Y", "Z")
            )
            or not isinstance(initial.get("radiating"), bool)
            or not math.isclose(
                float(initial["Z"]), float(expectations[index]), abs_tol=1e-12
            )
        ):
            raise ContractError(
                f"Labyrinth output.initial_states.{index}", "is invalid"
            )
    zz_input = results.get("zz_couplings")
    if not isinstance(zz_input, list):
        raise ContractError(
            "Labyrinth output.results.zz_couplings", "must be a list"
        )
    zz_edges: Dict[Tuple[int, int], float] = {}
    for index, item in enumerate(zz_input):
        if not isinstance(item, dict):
            raise ContractError(
                f"Labyrinth output.results.zz_couplings[{index}]",
                "must be an object",
            )
        edge = _normalized_edge(
            item.get("qubits"),
            100,
            f"Labyrinth output.results.zz_couplings[{index}].qubits",
        )
        value = item.get("value")
        if edge in zz_edges or not _finite_number(value) or not -1 <= float(value) <= 1:
            raise ContractError(
                f"Labyrinth output.results.zz_couplings[{index}]", "is invalid"
            )
        zz_edges[edge] = float(value)
    if tuple(sorted(zz_edges)) != expected_full_grid:
        raise ContractError(
            "Labyrinth output.results.zz_couplings",
            "does not cover the full grid",
        )
    metrics = output.get("metrics")
    if not isinstance(metrics, dict):
        raise ContractError("Labyrinth output.metrics", "must be an object")
    if metrics.get("mode") != "qpu" or metrics.get("backend") != BACKEND_NAME:
        raise ContractError(
            "Labyrinth output.metrics", "does not identify IBM Fez QPU execution"
        )
    if metrics.get("shots") != SHOTS or metrics.get("num_shots") != SHOTS:
        raise ContractError("Labyrinth output.metrics.shots", "does not match request")
    fraction = metrics.get("fraction")
    if (
        not _finite_number(fraction)
        or not math.isclose(float(fraction), 1 / 3, abs_tol=1e-12)
        or metrics.get("k") != 3
        or metrics.get("steps") != 3
    ):
        raise ContractError(
            "Labyrinth output.metrics", "preparation settings do not match request"
        )
    hardware_job_id = metrics.get("ibm_job_id")
    if not isinstance(hardware_job_id, str) or not hardware_job_id:
        raise ContractError("Labyrinth output.metrics.ibm_job_id", "is missing")
    return {
        "name": output["name"],
        "grid_size": output["grid_size"],
        "num_qubits": 100,
        "coupling_map": [list(edge) for edge in expected_full_grid],
        "target": target_record,
        "measurements": measurements,
        "z_expectations": [float(value) for value in expectations],
        "zz_couplings": [
            {"qubits": list(edge), "value": zz_edges[edge]}
            for edge in expected_full_grid
        ],
        "mode": "qpu",
        "backend": BACKEND_NAME,
        "hardware_job_id": hardware_job_id,
        "shots": SHOTS,
        "metrics": metrics,
    }


def normalize_quarry_result(raw_bytes: bytes, target: Target) -> Dict[str, Any]:
    document = _decode_result(raw_bytes, "QGraph result")
    output = document.get("output", document)
    if not isinstance(output, dict):
        raise ContractError("QGraph result.output", "must be an object")
    if output.get("mode") != "qpu" or output.get("backend") != BACKEND_NAME:
        raise ContractError("QGraph result", "does not identify IBM Fez QPU execution")
    if output.get("num_qubits") != 12 or output.get("shots") != SHOTS:
        raise ContractError("QGraph result", "does not match the 12-qubit request")
    expected_coupling = [list(pair) for pair in QUARRY_RECIPROCAL_PAIRS]
    if output.get("coupling_map") != expected_coupling:
        raise ContractError("QGraph result.coupling_map", "does not match request")
    measurements = _normalize_count_measurements(
        output.get("measurements"),
        12,
        SHOTS,
        "QGraph result.measurements",
        require_complete=False,
    )
    observed_shots = sum(item["count"] for item in measurements)
    observed_probability_mass = sum(item["probability"] for item in measurements)
    if any(
        earlier["count"] < later["count"]
        for earlier, later in zip(measurements, measurements[1:])
    ):
        raise ContractError(
            "QGraph result.measurements", "is not ordered by descending count"
        )
    dominant = output.get("dominant_bitstring")
    if not _valid_bitstring(dominant, 12):
        raise ContractError("QGraph result.dominant_bitstring", "is invalid")
    maximum_count = max(item["count"] for item in measurements)
    if not any(
        item["bitstring"] == dominant and item["count"] == maximum_count
        for item in measurements
    ):
        raise ContractError(
            "QGraph result.dominant_bitstring",
            "does not identify a maximum-count measurement",
        )
    hardware_job_id = output.get("ibm_job_id")
    if not isinstance(hardware_job_id, str) or not hardware_job_id:
        raise ContractError("QGraph result.ibm_job_id", "is missing")
    if not isinstance(output.get("tomography"), dict):
        raise ContractError("QGraph result.tomography", "must be an object")
    if output.get("seed") is not None:
        raise ContractError("QGraph result.seed", "must be null for explicit operations")
    agreement = output.get("edge_agreement_score")
    if not _finite_number(agreement) or not -1 <= float(agreement) <= 1:
        raise ContractError("QGraph result.edge_agreement_score", "is invalid")
    tomography = output["tomography"]
    bloch = tomography.get("bloch")
    if not isinstance(bloch, dict) or set(bloch) != {
        str(index) for index in range(12)
    }:
        raise ContractError(
            "QGraph result.tomography.bloch", "must cover all twelve qubits"
        )
    for index in range(12):
        vector = bloch[str(index)]
        if not isinstance(vector, dict) or any(
            not _finite_number(vector.get(axis))
            or not -1 <= float(vector[axis]) <= 1
            for axis in ("X", "Y", "Z")
        ):
            raise ContractError(
                f"QGraph result.tomography.bloch.{index}", "is invalid"
            )
    relationships = tomography.get("relationships")
    expected_relationship_keys = {
        f"{first},{second}" for first, second in QUARRY_RECIPROCAL_PAIRS
    }
    if not isinstance(relationships, dict) or set(relationships) != expected_relationship_keys:
        raise ContractError(
            "QGraph result.tomography.relationships",
            "does not match the six reciprocal pairs",
        )
    pauli_products = ("XX", "XY", "XZ", "YX", "YY", "YZ", "ZX", "ZY", "ZZ")
    for pair, values in relationships.items():
        if not isinstance(values, dict) or set(values) != set(pauli_products):
            raise ContractError(
                f"QGraph result.tomography.relationships.{pair}",
                "has an incomplete Pauli product record",
            )
        if any(
            not _finite_number(values[product])
            or not -1 <= float(values[product]) <= 1
            for product in pauli_products
        ):
            raise ContractError(
                f"QGraph result.tomography.relationships.{pair}",
                "contains an invalid expectation value",
            )
    return {
        "backend": BACKEND_NAME,
        "coupling_map": expected_coupling,
        "dominant_bitstring": dominant,
        "edge_agreement_score": float(agreement),
        "hardware_job_id": hardware_job_id,
        "measurements": measurements,
        "returned_measurement_count": len(measurements),
        "returned_shot_count": observed_shots,
        "returned_probability_mass": observed_probability_mass,
        "distribution_truncated": observed_shots < SHOTS,
        "mode": "qpu",
        "num_qubits": 12,
        "seed": None,
        "shots": SHOTS,
        "tomography": tomography,
        "bit_order": list(QUARRY_BIT_ORDER),
    }


def _normalize_result(target: Target, raw_bytes: bytes) -> Dict[str, Any]:
    return (
        normalize_labyrinth_result(raw_bytes, target)
        if target.engine_id == LABYRINTH_ENGINE_ID
        else normalize_quarry_result(raw_bytes, target)
    )


def _hardware_job_id(target: Target, normalized: Mapping[str, Any]) -> str:
    value = normalized.get("hardware_job_id")
    if not isinstance(value, str) or not value:
        raise ContractError(f"{target.engine_id} result", "hardware job ID is missing")
    return value


def _normalize_probability_measurements(
    value: Any, bit_count: int, shots: int, location: str
) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ContractError(location, "must be a non-empty list")
    normalized: List[Dict[str, Any]] = []
    seen: set[str] = set()
    total = 0
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ContractError(f"{location}[{index}]", "must be an object")
        bitstring = item.get("bitstring")
        probability = item.get("probability")
        if not _valid_bitstring(bitstring, bit_count) or bitstring in seen:
            raise ContractError(f"{location}[{index}].bitstring", "is invalid or duplicated")
        if not _finite_number(probability) or not 0 < float(probability) <= 1:
            raise ContractError(f"{location}[{index}].probability", "is invalid")
        count_value = float(probability) * shots
        count = round(count_value)
        if count <= 0 or not math.isclose(count_value, count, abs_tol=1e-9):
            raise ContractError(
                f"{location}[{index}].probability", "does not map to an integer count"
            )
        seen.add(bitstring)
        total += count
        normalized.append(
            {"bitstring": bitstring, "count": count, "probability": float(probability)}
        )
    if total != shots:
        raise ContractError(location, "counts do not sum to requested shots")
    return normalized


def _normalize_count_measurements(
    value: Any,
    bit_count: int,
    shots: int,
    location: str,
    *,
    require_complete: bool = True,
) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ContractError(location, "must be a non-empty list")
    normalized: List[Dict[str, Any]] = []
    seen: set[str] = set()
    total = 0
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ContractError(f"{location}[{index}]", "must be an object")
        bitstring = item.get("bitstring")
        count = item.get("count")
        probability = item.get("probability")
        if not _valid_bitstring(bitstring, bit_count) or bitstring in seen:
            raise ContractError(f"{location}[{index}].bitstring", "is invalid or duplicated")
        if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
            raise ContractError(f"{location}[{index}].count", "is invalid")
        if not _finite_number(probability) or not math.isclose(
            float(probability), count / shots, abs_tol=1e-12
        ):
            raise ContractError(f"{location}[{index}].probability", "does not match count")
        seen.add(bitstring)
        total += count
        normalized.append(
            {"bitstring": bitstring, "count": count, "probability": float(probability)}
        )
    if total > shots:
        raise ContractError(location, "counts exceed requested shots")
    if require_complete and total != shots:
        raise ContractError(location, "counts do not sum to requested shots")
    return normalized


def reconcile_preserved_results(campaign_id: str) -> int:
    """Revalidate exact locally preserved provider bytes without a new GET.

    Collection preserves a response when a strict local validator rejects it.
    If a reviewed validator correction later accepts those same bytes, this
    command produces the ordinary immutable capture while retaining the prior
    rejection and its error in the collection ledger.
    """

    targets = build_targets(campaign_id)
    target_by_id = {target.target_id: target for target in targets}
    manifest = _load_campaign_manifest(campaign_id, targets)
    campaign_dir = _campaign_dir(campaign_id)
    submission = _load_submission_state(
        campaign_dir / "submission-state-v1.json", campaign_id, targets
    )
    collection_path = campaign_dir / "collection-state-v1.json"
    collection = _read_json_object(collection_path, "collection state")
    jobs = collection.get("jobs")
    if not isinstance(jobs, dict):
        raise ContractError("collection state.jobs", "must be an object")
    reconciled = 0
    failures = 0
    for target_id, observation in jobs.items():
        target = target_by_id.get(target_id)
        if target is None or not isinstance(observation, dict):
            raise ContractError("collection state.jobs", "contains an unknown target")
        if observation.get("state") != "validation-rejected":
            continue
        rejected_relative = observation.get("rejectedResultPath")
        raw_sha = observation.get("rawResultSha256")
        if not isinstance(rejected_relative, str) or not isinstance(raw_sha, str):
            raise ContractError(target_id, "rejected-result evidence is incomplete")
        rejected_path = _project_root() / rejected_relative
        raw_bytes = rejected_path.read_bytes()
        if sha256_bytes(raw_bytes) != raw_sha:
            raise ContractError(target_id, "preserved rejected-result hash changed")
        try:
            normalized = _normalize_result(target, raw_bytes)
        except ContractError as error:
            print(f"{target_id}: still rejected: {error}")
            failures += 1
            continue
        receipt = submission["submittedJobs"].get(target_id)
        if not isinstance(receipt, dict):
            raise ContractError(target_id, "submission receipt is missing")
        prior_error = observation.get("validationError")
        material = {
            "schemaVersion": CAPTURE_SCHEMA,
            "campaignId": campaign_id,
            "targetId": target_id,
            "engineId": target.engine_id,
            "engineCanonicalSha256": manifest["acceptedEngineCanonicalSha256"],
            "engineUpdatedAt": manifest["engineUpdatedAt"],
            "apiSpecification": manifest["apiSpecification"],
            "listedCreditsPerRun": manifest["listedCreditsPerRun"],
            "mothJobId": receipt["mothJobId"],
            "hardwareJobId": _hardware_job_id(target, normalized),
            "submittedAt": receipt["submittedAt"],
            "providerUpdatedAt": observation["providerUpdatedAt"],
            "terminalObservedAtUtc": observation["observedAtUtc"],
            "retrievedAtUtc": observation["observedAtUtc"],
            "terminalStatusSha256": observation["terminalStatusSha256"],
            "rawResultSha256": raw_sha,
            "redactedRequest": target.redacted_request(),
            "redactedRequestSha256": sha256_json(target.redacted_request()),
            "result": normalized,
            "claimBoundary": target.claim_boundary,
        }
        capture = {**material, "contentSha256": sha256_json(material)}
        capture_path = campaign_dir / "captures-v1" / f"{target_id}.json"
        _write_or_verify(capture_path, capture, 0o600)
        jobs[target_id] = {
            "targetId": target_id,
            "mothJobId": receipt["mothJobId"],
            "state": "captured",
            "providerUpdatedAt": observation["providerUpdatedAt"],
            "observedAtUtc": _utc_now(),
            "terminalStatusSha256": observation["terminalStatusSha256"],
            "capturePath": str(capture_path.relative_to(_project_root())),
            "captureContentSha256": capture["contentSha256"],
            "rawResultSha256": raw_sha,
            "reconciledFromValidationRejected": True,
            "priorValidationError": prior_error,
            "preservedRejectedResultPath": rejected_relative,
        }
        reconciled += 1
        print(f"{target_id}: reconciled from preserved provider bytes")
    collection["updatedAtUtc"] = _utc_now()
    _write_json_atomic(collection_path, collection, 0o600)
    print(f"Reconciliation: {reconciled} captured, {failures} still rejected.")
    return 0 if failures == 0 else 1


def _validate_live_engine(record: Mapping[str, Any], engine_id: str) -> EngineContract:
    if record.get("engine_id") != engine_id:
        raise ContractError("engine.engine_id", f"does not match {engine_id}")
    params = _parameter_properties(record)
    common = {"mode", "shots", "backend_name", "qpu_token", "qpu_instance"}
    specific = (
        {"level_data", "top_n"}
        if engine_id == LABYRINTH_ENGINE_ID
        else {"num_qubits", "coupling_map", "operations"}
    )
    missing = sorted((common | specific).difference(params))
    if missing:
        raise ContractError("engine params", "missing " + ", ".join(missing))
    mode_schema = params.get("mode")
    if not isinstance(mode_schema, dict) or "qpu" not in mode_schema.get("enum", []):
        raise ContractError("engine params.mode", "does not accept qpu")
    shots_schema = params.get("shots")
    if not isinstance(shots_schema, dict):
        raise ContractError("engine params.shots", "schema is unavailable")
    maximum = shots_schema.get("maximum")
    if isinstance(maximum, int) and maximum < SHOTS:
        raise ContractError("engine params.shots", "maximum is below 4096")
    if engine_id == LABYRINTH_ENGINE_ID:
        top_n_schema = params.get("top_n")
        if not isinstance(top_n_schema, dict) or top_n_schema.get("minimum") != -1:
            raise ContractError("engine params.top_n", "does not support complete output")
        params_schema = record.get("params_schema")
        defs = params_schema.get("$defs", {}) if isinstance(params_schema, dict) else {}
        level = defs.get("LevelData") if isinstance(defs, dict) else None
        level_props = level.get("properties") if isinstance(level, dict) else None
        if (
            not isinstance(level_props, dict)
            or level_props.get("num_qubits", {}).get("minimum") != 2
        ):
            raise ContractError("engine params.level_data", "schema is incomplete")
        for required_level_field in ("grid_size", "num_qubits", "coupling_map"):
            if required_level_field not in level_props:
                raise ContractError(
                    "engine params.level_data",
                    f"does not expose {required_level_field}",
                )
    else:
        qubit_schema = params.get("num_qubits")
        maximum_qubits = (
            qubit_schema.get("maximum") if isinstance(qubit_schema, dict) else None
        )
        if not isinstance(maximum_qubits, int) or maximum_qubits < 12:
            raise ContractError(
                "engine params.num_qubits", "does not support Quarry's 12 qubits"
            )
        params_schema = record.get("params_schema")
        definitions = (
            params_schema.get("$defs", {})
            if isinstance(params_schema, dict)
            else {}
        )
        relationship = (
            definitions.get("RelationshipOperation")
            if isinstance(definitions, dict)
            else None
        )
        relationship_props = (
            relationship.get("properties")
            if isinstance(relationship, dict)
            else None
        )
        if not isinstance(relationship_props, dict) or not {
            "type",
            "qubits",
            "paulis",
        }.issubset(relationship_props):
            raise ContractError(
                "engine params.operations",
                "relationship-operation schema is incomplete",
            )
    credits = record.get("credits_per_run")
    if not isinstance(credits, int) or isinstance(credits, bool) or credits < 0:
        raise ContractError("engine.credits_per_run", "is unavailable")
    updated_at = record.get("updated_at")
    output_type = record.get("output_type")
    if not isinstance(updated_at, str) or not updated_at:
        raise ContractError("engine.updated_at", "is unavailable")
    if output_type != "application/json":
        raise ContractError("engine.output_type", "is not application/json")
    digest = sha256_json(dict(record))
    return EngineContract(
        engine_id=engine_id,
        canonical_sha256=digest,
        redacted_sha256=digest,
        updated_at=updated_at,
        credits_per_run=credits,
        input_slots=(),
        output_type=output_type,
        result_contract_state="fresh-authenticated-qpu-preflight",
        unresolved_gaps=(
            "Consumer bit ordering remains result-validated rather than provider-guaranteed.",
        ),
    )


def _parameter_properties(record: Mapping[str, Any]) -> Mapping[str, Any]:
    params = record.get("params")
    if isinstance(params, dict):
        return params
    schema = record.get("params_schema")
    properties = schema.get("properties") if isinstance(schema, dict) else None
    if not isinstance(properties, dict):
        raise ContractError("engine params", "parameter schema is unavailable")
    return properties


def _validate_grid_edges(
    edges: Iterable[Tuple[int, int]], rows: int, columns: int
) -> None:
    seen: set[Tuple[int, int]] = set()
    for index, edge in enumerate(edges):
        normalized = _normalized_edge(list(edge), rows * columns, f"edges[{index}]")
        first_row, first_column = divmod(normalized[0], columns)
        second_row, second_column = divmod(normalized[1], columns)
        if abs(first_row - second_row) + abs(first_column - second_column) != 1:
            raise ContractError(f"edges[{index}]", "is not an orthogonal grid edge")
        if normalized in seen:
            raise ContractError("edges", "contains a duplicate")
        seen.add(normalized)


def _validate_connected(edges: Iterable[Tuple[int, int]], room_count: int) -> None:
    neighbours = {room: set() for room in range(room_count)}
    for first, second in edges:
        neighbours[first].add(second)
        neighbours[second].add(first)
    seen = {0}
    pending = [0]
    while pending:
        room = pending.pop()
        for neighbour in neighbours[room]:
            if neighbour not in seen:
                seen.add(neighbour)
                pending.append(neighbour)
    if len(seen) != room_count:
        raise ContractError("Quantman coupling map", "does not connect all rooms")


def _normalized_edges(value: Any, qubits: int, location: str) -> Tuple[Tuple[int, int], ...]:
    if not isinstance(value, list):
        raise ContractError(location, "must be a list")
    edges = tuple(
        _normalized_edge(item, qubits, f"{location}[{index}]")
        for index, item in enumerate(value)
    )
    if len(set(edges)) != len(edges):
        raise ContractError(location, "contains duplicates")
    return tuple(sorted(edges))


def _normalized_edge(value: Any, qubits: int, location: str) -> Tuple[int, int]:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or any(not isinstance(item, int) or isinstance(item, bool) for item in value)
    ):
        raise ContractError(location, "must contain two integer qubits")
    first, second = sorted(value)
    if first < 0 or second >= qubits or first == second:
        raise ContractError(location, "contains out-of-range or repeated qubits")
    return first, second


def _decode_result(raw_bytes: bytes, location: str) -> Dict[str, Any]:
    try:
        value = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ContractError(location, "must be UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ContractError(location, "must be a JSON object")
    return value


def _valid_bitstring(value: Any, length: int) -> bool:
    return (
        isinstance(value, str)
        and len(value) == length
        and not set(value).difference("01")
    )


def _finite_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
    )


def _required_environment(names: Sequence[str]) -> Dict[str, str]:
    values = {name: os.environ.get(name, "") for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ContractError("environment", "missing " + ", ".join(missing))
    return values


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _campaign_dir(campaign_id: str) -> Path:
    if campaign_id not in CAMPAIGN_IDS:
        raise ContractError("campaign", f"unsupported campaign {campaign_id!r}")
    return _project_root() / CACHE_ROOT / campaign_id


def _load_inspection() -> Dict[str, Any]:
    path = _project_root() / CACHE_ROOT / "contract-inspection-v1.json"
    value = _read_json_object(path, "contract inspection")
    if (
        value.get("schemaVersion") != INSPECTION_SCHEMA
        or value.get("apiSpecification")
        != {
            "version": API_VERSION,
            "canonicalSha256": API_SPECIFICATION_SHA256,
        }
        or not isinstance(value.get("engines"), list)
        or not all(isinstance(item, dict) for item in value.get("engines", []))
    ):
        raise ContractError("contract inspection", "is invalid")
    return value


def _load_manifest(
    campaign_id: str, accept_engine_sha: str, targets: Sequence[Target]
) -> Dict[str, Any]:
    path = _campaign_dir(campaign_id) / "manifest-v1.json"
    value = _read_json_object(path, "campaign manifest")
    manifest_targets = value.get("targets")
    if not isinstance(manifest_targets, list) or not all(
        isinstance(item, dict) for item in manifest_targets
    ):
        raise ContractError("campaign manifest", "targets are invalid")
    if (
        value.get("schemaVersion") != MANIFEST_SCHEMA
        or value.get("campaignId") != campaign_id
        or value.get("apiSpecification")
        != {
            "version": API_VERSION,
            "canonicalSha256": API_SPECIFICATION_SHA256,
        }
        or value.get("acceptedEngineCanonicalSha256") != accept_engine_sha
        or [item.get("targetId") for item in manifest_targets]
        != [target.target_id for target in targets]
    ):
        raise ContractError("campaign manifest", "does not match this campaign")
    for item, target in zip(manifest_targets, targets):
        if (
            item.get("redactedRequest") != target.redacted_request()
            or item.get("redactedRequestSha256")
            != sha256_json(target.redacted_request())
        ):
            raise ContractError("campaign manifest", "request material changed")
    return value


def _load_campaign_manifest(
    campaign_id: str, targets: Sequence[Target]
) -> Dict[str, Any]:
    path = _campaign_dir(campaign_id) / "manifest-v1.json"
    value = _read_json_object(path, "campaign manifest")
    accepted_sha = value.get("acceptedEngineCanonicalSha256")
    if not isinstance(accepted_sha, str) or len(accepted_sha) != 64:
        raise ContractError("campaign manifest", "accepted engine SHA-256 is invalid")
    return _load_manifest(campaign_id, accepted_sha, targets)


def _load_submission_state(
    path: Path, campaign_id: str, targets: Sequence[Target]
) -> Dict[str, Any]:
    if path.exists():
        value = _read_json_object(path, "submission state")
        submitted_jobs = value.get("submittedJobs")
        in_flight = value.get("inFlight")
        if (
            value.get("schemaVersion") != SUBMISSION_SCHEMA
            or value.get("campaignId") != campaign_id
            or not isinstance(submitted_jobs, dict)
            or (in_flight is not None and not isinstance(in_flight, dict))
        ):
            raise ContractError("submission state", "is invalid")
        expected_ids = {target.target_id for target in targets}
        unexpected = set(submitted_jobs).difference(expected_ids)
        if unexpected:
            raise ContractError(
                "submission state",
                "contains unexpected targets: " + ", ".join(sorted(unexpected)),
            )
        if (
            isinstance(in_flight, dict)
            and in_flight.get("targetId") not in expected_ids
        ):
            raise ContractError("submission state.inFlight", "target is invalid")
        target_by_id = {target.target_id: target for target in targets}
        for target_id, receipt in submitted_jobs.items():
            target = target_by_id[target_id]
            if (
                not isinstance(receipt, dict)
                or not isinstance(receipt.get("mothJobId"), str)
                or not receipt["mothJobId"]
                or not isinstance(receipt.get("submittedAt"), str)
                or not receipt["submittedAt"]
                or receipt.get("redactedRequestSha256")
                != sha256_json(target.redacted_request())
            ):
                raise ContractError(
                    f"submission state.submittedJobs.{target_id}",
                    "receipt is invalid",
                )
        return value
    value = {
        "schemaVersion": SUBMISSION_SCHEMA,
        "campaignId": campaign_id,
        "createdAtUtc": _utc_now(),
        "updatedAtUtc": _utc_now(),
        "inFlight": None,
        "submittedJobs": {},
    }
    _write_json_atomic(path, value, 0o600)
    return value


def _load_collection_state(path: Path, campaign_id: str) -> Dict[str, Any]:
    if path.exists():
        value = _read_json_object(path, "collection state")
        if (
            value.get("schemaVersion") != COLLECTION_SCHEMA
            or value.get("campaignId") != campaign_id
            or not isinstance(value.get("jobs"), dict)
        ):
            raise ContractError("collection state", "is invalid")
        return value
    value = {
        "schemaVersion": COLLECTION_SCHEMA,
        "campaignId": campaign_id,
        "createdAtUtc": _utc_now(),
        "updatedAtUtc": _utc_now(),
        "jobs": {},
    }
    _write_json_atomic(path, value, 0o600)
    return value


def _read_json_object(path: Path, label: str) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError(label, f"cannot read {path}") from error
    if not isinstance(value, dict):
        raise ContractError(label, "must be a JSON object")
    return value


def _write_or_verify(path: Path, value: Dict[str, Any], mode: int) -> None:
    if path.exists():
        if _read_json_object(path, "existing manifest") != value:
            raise ContractError(str(path), "already exists with different content")
        return
    _write_json_atomic(path, value, mode)


def _write_json_atomic(path: Path, value: Dict[str, Any], mode: int) -> None:
    _write_bytes_atomic(path, canonical_bytes(value) + b"\n", mode)


def _write_bytes_atomic(path: Path, value: bytes, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path.parent, 0o700)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(value)
    os.chmod(temporary, mode)
    temporary.replace(path)
    os.chmod(path, mode)


def _append_event(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(descriptor, "ab") as handle:
        handle.write(canonical_bytes(value) + b"\n")


def _redact(value: str, secrets: Iterable[str]) -> str:
    safe = value
    for secret in secrets:
        if secret:
            safe = safe.replace(secret, "[REDACTED]")
    return safe[:1000]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("inspect", help="authenticated read-only engine inspection")
    prepare = subparsers.add_parser(
        "prepare", help="write an immutable no-secret campaign manifest"
    )
    prepare.add_argument("--campaign", choices=CAMPAIGN_IDS, required=True)
    prepare.add_argument("--accept-engine-sha", required=True)
    submit = subparsers.add_parser(
        "submit", help="perform the explicitly authorized QPU POSTs once"
    )
    submit.add_argument("--campaign", choices=CAMPAIGN_IDS, required=True)
    submit.add_argument("--accept-engine-sha", required=True)
    submit.add_argument("--execute-authorized-batch", action="store_true", required=True)
    submit.add_argument("--delay-seconds", type=float, default=0.25)
    collect = subparsers.add_parser("collect", help="run one safe-GET collection sweep")
    collect.add_argument("--campaign", choices=CAMPAIGN_IDS, required=True)
    collect.add_argument("--collect-available", action="store_true", required=True)
    collect.add_argument("--delay-seconds", type=float, default=0.25)
    reconcile = subparsers.add_parser(
        "reconcile", help="revalidate locally preserved rejected result bytes"
    )
    reconcile.add_argument("--campaign", choices=CAMPAIGN_IDS, required=True)
    reconcile.add_argument(
        "--reconcile-preserved-results", action="store_true", required=True
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "inspect":
            return inspect_contracts()
        if args.command == "prepare":
            return prepare_campaign(args.campaign, args.accept_engine_sha)
        if args.command == "submit":
            return submit_campaign(
                args.campaign, args.accept_engine_sha, args.delay_seconds
            )
        if args.command == "collect":
            return collect_campaign(args.campaign, args.delay_seconds)
        if args.command == "reconcile":
            return reconcile_preserved_results(args.campaign)
    except (ContractError, MothApiError) as error:
        print(str(error))
        return 1
    raise AssertionError("unreachable command")


if __name__ == "__main__":
    raise SystemExit(main())
