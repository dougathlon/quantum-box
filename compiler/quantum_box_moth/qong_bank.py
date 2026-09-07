"""Fail-closed Coin Toss preflight and Qong QPU-bank assembly."""

from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

from .canonical import canonical_json, sha256_bytes, sha256_json
from .models import API_SPECIFICATION_SHA256, API_VERSION, ContractError


PREFLIGHT_SCHEMA_VERSION = "quantum-box-qong-coin-preflight-v2"
CAPTURE_SCHEMA_VERSION = "quantum-box-qong-coin-capture-v2"
PLAY_PACK_SCHEMA_VERSION = "quantum-box-qong-play-pack-v1"
SELECTOR_PACK_SCHEMA_VERSION = "quantum-box-qong-selector-pack-v1"
BANK_SCHEMA_VERSION = "quantum-box-qong-story-bank-v1"
CANDIDATE_REPORT_SCHEMA_VERSION = (
    "quantum-box-qong-first-rally-candidate-report-v1"
)
PACK_SCHEMA_VERSION = "quantum-box-pack-v1"
QONG_RULES_VERSION = "qong-rules-v1"
ADAPTER_VERSION = "qong-coin-bank-adapter-v2"
BROWSER_ADAPTER_VERSION = "qong-coin-bank-adapter-v3"
BROWSER_ADAPTER_VERSION_V4 = "qong-coin-bank-adapter-v4"
BROWSER_ADAPTER_VERSION_V5 = "qong-coin-bank-adapter-v5"
BROWSER_PREFLIGHT_SCHEMA_VERSION = "quantum-box-qong-showcase-preflight-v1"
BROWSER_PREFLIGHT_SCHEMA_VERSION_V2 = "quantum-box-qong-showcase-preflight-v2"
BROWSER_CONTRACT_SOURCE = "authenticated-moth-showcase-v1"
MIXED_BACKEND_POLICY = "provider-selected-per-job-v1"
RESULT_CONTRACT = "single-formatted-outcome-per-job-v1"
POSTSELECTION_STRATEGY = "first-four-tails-in-32-candidate-pool-v1"
SELECTOR_COMPLETION_SCHEMA_VERSION = (
    "quantum-box-qong-selector-completion-v1"
)
SELECTOR_COMPLETION_STRATEGY = (
    "largest-even-prefix-before-nonretryable-provider-blocker-v1"
)
PLAY_PACK_COUNT = 4
RALLIES_PER_PACK = 7
FIRST_RALLY_CANDIDATE_COUNT = 32
REMAINING_RALLIES_PER_PACK = RALLIES_PER_PACK - 1
SELECTOR_BIT_COUNT = 64
MIN_SELECTOR_BIT_COUNT = 44
EXPECTED_JOB_COUNT = (
    FIRST_RALLY_CANDIDATE_COUNT
    + PLAY_PACK_COUNT * REMAINING_RALLIES_PER_PACK
    + SELECTOR_BIT_COUNT
)
REQUEST_BODY = {"params": {"mode": "qpu", "shots": 1}}
REQUEST_SHA256 = sha256_json(REQUEST_BODY)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
UTC_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"
)
RAW_RESULT_FIELDS = frozenset(
    ("backend", "heads", "ibm_job_id", "mode", "output", "shots", "tails")
)
CAPTURE_FIELDS = frozenset(
    (
        "schemaVersion",
        "itemId",
        "mothJobId",
        "submittedAt",
        "providerUpdatedAt",
        "terminalObservedAt",
        "retrievedAt",
        "requestSha256",
        "terminalStatusSha256",
        "rawResultSha256",
        "result",
        "contentSha256",
    )
)
UNAVAILABLE_BANK = {
    "schemaVersion": "quantum-box-qong-bank-unavailable-v1",
    "reason": (
        "No complete authenticated Coin Toss QPU bank has been promoted. "
        "Story Qong must fail closed rather than substitute its Arcade control."
    ),
}


def planned_items() -> Tuple[Dict[str, Any], ...]:
    items: List[Dict[str, Any]] = []
    for candidate_index in range(FIRST_RALLY_CANDIDATE_COUNT):
        items.append(
            {
                "itemId": "f{:03d}".format(candidate_index + 1),
                "publicItemId": None,
                "role": "first-rally-candidate",
                "packIndex": None,
                "candidateOrdinal": candidate_index,
                "request": REQUEST_BODY,
                "requestSha256": REQUEST_SHA256,
            }
        )
    for pack_index in range(PLAY_PACK_COUNT):
        for rally_index in range(1, RALLIES_PER_PACK):
            items.append(
                {
                    "itemId": "p{:02d}-r{:02d}".format(
                        pack_index + 1, rally_index + 1
                    ),
                    "publicItemId": "r{:02d}".format(rally_index + 1),
                    "role": "play-pack-rally",
                    "packIndex": pack_index,
                    "request": REQUEST_BODY,
                    "requestSha256": REQUEST_SHA256,
                }
            )
    for selector_index in range(SELECTOR_BIT_COUNT):
        items.append(
            {
                "itemId": "s{:03d}".format(selector_index + 1),
                "publicItemId": "s{:03d}".format(selector_index + 1),
                "role": "selector-bit",
                "packIndex": None,
                "request": REQUEST_BODY,
                "requestSha256": REQUEST_SHA256,
            }
        )
    return tuple(items)


def coin_engine_report(record: Mapping[str, Any]) -> Dict[str, Any]:
    if record.get("engine_id") != "coin-toss-v1":
        raise ContractError("coin-toss-v1.engine_id", "does not match coin-toss-v1")
    properties = record.get("params_schema", {}).get("properties", {})
    if not isinstance(properties, dict):
        raise ContractError(
            "coin-toss-v1.params_schema.properties", "must be an object"
        )
    shots = properties.get("shots")
    mode = properties.get("mode")
    if not isinstance(shots, dict) or not isinstance(mode, dict):
        raise ContractError(
            "coin-toss-v1.params_schema", "must expose shots and mode"
        )
    inputs = record.get("input_files")
    if not isinstance(inputs, list):
        raise ContractError("coin-toss-v1.input_files", "must be an array")
    input_names = [
        item.get("name") for item in inputs if isinstance(item, dict)
    ]
    source_text = "\n".join(
        sample.get("source", "")
        for sample in record.get("code_samples", [])
        if isinstance(sample, dict) and isinstance(sample.get("source"), str)
    )
    description_text = "\n".join(
        value
        for value in (record.get("description"), record.get("description_md"))
        if isinstance(value, str)
    )
    contract_text = "{}\n{}".format(source_text, description_text).lower()
    result_markers = {
        name: name in contract_text
        for name in sorted(RAW_RESULT_FIELDS)
    }
    mode_values = mode.get("enum")
    supports_qpu = isinstance(mode_values, list) and "qpu" in mode_values
    shots_minimum = shots.get("minimum")
    if shots_minimum is None:
        shots_minimum = shots.get("exclusiveMinimum")
        shots_one_allowed = shots_minimum in (None, 0)
    else:
        shots_one_allowed = isinstance(shots_minimum, (int, float)) and shots_minimum <= 1
    shots_maximum = shots.get("maximum")
    if isinstance(shots_maximum, (int, float)) and shots_maximum < 1:
        shots_one_allowed = False
    credits = record.get("credits_per_run")
    canonical_sha256 = sha256_json(dict(record))
    output_type = record.get("output_type")
    safe = all(
        (
            supports_qpu,
            shots_one_allowed,
            isinstance(credits, int) and credits > 0,
            record.get("is_multipart") is False,
            input_names == [],
            output_type == "application/json",
            all(result_markers.values()),
            isinstance(record.get("updated_at"), str),
            record.get("is_async") is True,
        )
    )
    return {
        "schemaVersion": "quantum-box-coin-toss-inspection-v1",
        "requestMode": "authenticated-read-only",
        "networkMutation": False,
        "engineId": "coin-toss-v1",
        "name": record.get("name"),
        "updatedAt": record.get("updated_at"),
        "canonicalEngineRecordSha256": canonical_sha256,
        "listedCreditsPerRun": credits,
        "isMultipart": record.get("is_multipart"),
        "inputFiles": input_names,
        "outputType": output_type,
        "params": {
            "mode": {
                "default": mode.get("default"),
                "enum": mode_values,
            },
            "shots": {
                key: shots.get(key)
                for key in (
                    "type",
                    "default",
                    "minimum",
                    "exclusiveMinimum",
                    "maximum",
                )
                if key in shots
            },
        },
        "qpuSurface": {
            "supportsQpuMode": supports_qpu,
            "shotsOneAllowed": shots_one_allowed,
            "backendParameter": "backend_name" in properties,
            "backendPolicy": (
                "caller-selected"
                if "backend_name" in properties
                else "provider-selected; require backend identity in every result"
            ),
        },
        "jobLifecycle": {
            "isAsync": record.get("is_async"),
            "queue": record.get("queue"),
            "runPolicy": record.get("run_policy"),
            "processResponse": "202 with job_id/status/submitted_at",
            "statusVocabulary": ["queued", "processing", "completed", "failed", "cancelled"],
            "resultEndpoint": "authenticated GET after completed status",
        },
        "resultContract": {
            "requiredFields": sorted(RAW_RESULT_FIELDS),
            "markersFoundInLiveDefinition": result_markers,
            "normalization": "single-formatted-outcome-per-job-v1",
        },
        "exactRequest": REQUEST_BODY,
        "exactRequestSha256": REQUEST_SHA256,
        "expectedJobCount": EXPECTED_JOB_COUNT,
        "maximumListedCredits": (
            credits * EXPECTED_JOB_COUNT
            if isinstance(credits, int) and credits > 0
            else None
        ),
        "safeToPrepareBank": safe,
        "submissionAuthorized": False,
    }


def prepare_preflight(
    inspection: Mapping[str, Any], accepted_engine_sha256: str
) -> Dict[str, Any]:
    if inspection.get("schemaVersion") != "quantum-box-coin-toss-inspection-v1":
        raise ContractError("inspection", "has an unknown schema")
    if inspection.get("safeToPrepareBank") is not True:
        raise ContractError(
            "inspection.safeToPrepareBank", "live contract remains incomplete"
        )
    observed_sha256 = _sha256(
        inspection.get("canonicalEngineRecordSha256"),
        "inspection.canonicalEngineRecordSha256",
    )
    if accepted_engine_sha256 != observed_sha256:
        raise ContractError(
            "accepted engine hash", "does not match the live inspected record"
        )
    credits = inspection.get("listedCreditsPerRun")
    if not isinstance(credits, int) or credits <= 0:
        raise ContractError("inspection.listedCreditsPerRun", "must be positive")
    updated_at = _utc(inspection.get("updatedAt"), "inspection.updatedAt")
    material = {
        "schemaVersion": PREFLIGHT_SCHEMA_VERSION,
        "engine": {
            "engineId": "coin-toss-v1",
            "updatedAt": updated_at,
            "canonicalEngineRecordSha256": observed_sha256,
            "apiSpecificationVersion": API_VERSION,
            "apiSpecificationCanonicalSha256": API_SPECIFICATION_SHA256,
            "listedCreditsPerRun": credits,
            "outputType": "application/json",
            "backendPolicy": inspection.get("qpuSurface", {}).get(
                "backendPolicy"
            ),
            "resultContract": RESULT_CONTRACT,
        },
        "plan": {
            "playPackCount": PLAY_PACK_COUNT,
            "ralliesPerPlayPack": RALLIES_PER_PACK,
            "firstRallyCandidateCount": FIRST_RALLY_CANDIDATE_COUNT,
            "minimumFirstRallyTails": PLAY_PACK_COUNT,
            "postselectionStrategy": POSTSELECTION_STRATEGY,
            "selectorBitCount": SELECTOR_BIT_COUNT,
            "expectedJobCount": EXPECTED_JOB_COUNT,
            "maximumListedCredits": credits * EXPECTED_JOB_COUNT,
            "jobs": list(planned_items()),
        },
        "runtimeBoundary": {
            "providerCallsDuringPlay": 0,
            "assemblySelection": (
                "first four recorded tails from the ordered bounded candidate pool"
            ),
            "runtimeSelection": "two recorded selector bits decoded locally",
            "syntheticStoryFallback": False,
        },
    }
    return {
        **material,
        "contentSha256": sha256_json(material),
        "submissionAuthorized": False,
    }


def validate_preflight(value: Mapping[str, Any]) -> Dict[str, Any]:
    if value.get("schemaVersion") != PREFLIGHT_SCHEMA_VERSION:
        raise ContractError("preflight", "has an unknown schema")
    if value.get("submissionAuthorized") is not False:
        raise ContractError("preflight", "must not embed submission authority")
    material = {key: item for key, item in value.items() if key not in ("contentSha256", "submissionAuthorized")}
    expected_hash = sha256_json(material)
    if value.get("contentSha256") != expected_hash:
        raise ContractError("preflight.contentSha256", "does not match the plan")
    engine = value.get("engine")
    plan = value.get("plan")
    if not isinstance(engine, dict) or not isinstance(plan, dict):
        raise ContractError("preflight", "engine or plan is absent")
    _sha256(engine.get("canonicalEngineRecordSha256"), "preflight engine hash")
    _sha256(
        engine.get("apiSpecificationCanonicalSha256"),
        "preflight API specification hash",
    )
    jobs = plan.get("jobs")
    if not isinstance(jobs, list) or jobs != list(planned_items()):
        raise ContractError("preflight.plan.jobs", "is not the exact 120-job plan")
    credits = engine.get("listedCreditsPerRun")
    if (
        not isinstance(credits, int)
        or credits <= 0
        or plan.get("playPackCount") != PLAY_PACK_COUNT
        or plan.get("ralliesPerPlayPack") != RALLIES_PER_PACK
        or plan.get("firstRallyCandidateCount")
        != FIRST_RALLY_CANDIDATE_COUNT
        or plan.get("minimumFirstRallyTails") != PLAY_PACK_COUNT
        or plan.get("postselectionStrategy") != POSTSELECTION_STRATEGY
        or plan.get("selectorBitCount") != SELECTOR_BIT_COUNT
        or plan.get("expectedJobCount") != EXPECTED_JOB_COUNT
        or plan.get("maximumListedCredits") != credits * EXPECTED_JOB_COUNT
    ):
        raise ContractError("preflight.plan", "cost or job count is inconsistent")
    return dict(value)


def validate_bank_preflight(value: Mapping[str, Any]) -> Dict[str, Any]:
    """Accept API-definition or authenticated-showcase acquisition plans."""

    if value.get("schemaVersion") == PREFLIGHT_SCHEMA_VERSION:
        return validate_preflight(value)
    schema_version = value.get("schemaVersion")
    if schema_version not in (
        BROWSER_PREFLIGHT_SCHEMA_VERSION,
        BROWSER_PREFLIGHT_SCHEMA_VERSION_V2,
    ):
        raise ContractError("preflight", "has an unknown schema")
    if value.get("submissionAuthorized") is not False:
        raise ContractError("preflight", "must not embed submission authority")
    expected_keys = {
        "schemaVersion",
        "contract",
        "access",
        "plan",
        "runtimeBoundary",
        "contentSha256",
        "submissionAuthorized",
    }
    if schema_version == BROWSER_PREFLIGHT_SCHEMA_VERSION_V2:
        expected_keys.add("backendPolicy")
    if set(value) != expected_keys:
        raise ContractError("preflight", "contains absent or unexpected fields")
    material = {
        key: item
        for key, item in value.items()
        if key not in ("contentSha256", "submissionAuthorized")
    }
    if value.get("contentSha256") != sha256_json(material):
        raise ContractError("preflight.contentSha256", "does not match the plan")
    contract = value.get("contract")
    access = value.get("access")
    plan = value.get("plan")
    if not all(isinstance(item, dict) for item in (contract, access, plan)):
        raise ContractError("preflight", "contract, access, or plan is absent")
    contract_keys = {
        "source",
        "showcaseUrl",
        "processEndpoint",
        "engineId",
        "contractObservedAtUtc",
        "priceDisplay",
        "requestBody",
        "requestBodySha256",
        "terminalStatusSchema",
        "terminalStatusFields",
        "resultFields",
        "apiSpecificationVersion",
        "apiSpecificationCanonicalSha256",
        "canonicalContractRecordSha256",
    }
    if set(contract) != contract_keys:
        raise ContractError("preflight.contract", "has an unknown shape")
    contract_material = {
        key: item
        for key, item in contract.items()
        if key != "canonicalContractRecordSha256"
    }
    if (
        contract.get("source") != BROWSER_CONTRACT_SOURCE
        or contract.get("showcaseUrl")
        != "https://platform.mothquantum.com/engines/showcase/coin-toss"
        or contract.get("processEndpoint")
        != "https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process"
        or contract.get("engineId") != "coin-toss-v1"
        or contract.get("priceDisplay") != "not-displayed"
        or contract.get("requestBody") != REQUEST_BODY
        or contract.get("requestBodySha256") != REQUEST_SHA256
        or contract.get("terminalStatusSchema")
        != "https://api.mothquantum.com/schemas/JobStatusOutputBody.json"
        or contract.get("terminalStatusFields")
        != sorted(
            (
                "$schema",
                "job_id",
                "engine_id",
                "status",
                "progress",
                "steps",
                "result",
                "warnings",
                "submitted_at",
                "updated_at",
            )
        )
        or contract.get("resultFields") != sorted(RAW_RESULT_FIELDS)
        or contract.get("apiSpecificationVersion") != API_VERSION
        or contract.get("apiSpecificationCanonicalSha256")
        != API_SPECIFICATION_SHA256
        or contract.get("canonicalContractRecordSha256")
        != sha256_json(contract_material)
    ):
        raise ContractError("preflight.contract", "does not match Coin Toss")
    observed_at = _utc(
        contract.get("contractObservedAtUtc"),
        "preflight.contract.contractObservedAtUtc",
    )
    _sha256(
        contract.get("canonicalContractRecordSha256"),
        "preflight contract hash",
    )
    if set(access) != {
        "basis",
        "listedCreditsPerRun",
        "maximumListedCredits",
        "authorizedAtUtc",
        "authorizationNoteSha256",
    } or (
        access.get("basis") != "user-confirmed-free-access"
        or access.get("listedCreditsPerRun") is not None
        or access.get("maximumListedCredits") is not None
    ):
        raise ContractError("preflight.access", "does not match free access")
    authorized_at = _utc(
        access.get("authorizedAtUtc"), "preflight.access.authorizedAtUtc"
    )
    if datetime.fromisoformat(observed_at.replace("Z", "+00:00")) > (
        datetime.fromisoformat(authorized_at.replace("Z", "+00:00"))
    ):
        raise ContractError(
            "preflight.access.authorizedAtUtc",
            "must not precede the contract observation",
        )
    _sha256(
        access.get("authorizationNoteSha256"),
        "preflight.access.authorizationNoteSha256",
    )
    if set(plan) != {
        "playPackCount",
        "ralliesPerPlayPack",
        "firstRallyCandidateCount",
        "minimumFirstRallyTails",
        "postselectionStrategy",
        "selectorBitCount",
        "expectedJobCount",
        "jobs",
    } or (
        plan.get("jobs") != list(planned_items())
        or plan.get("playPackCount") != PLAY_PACK_COUNT
        or plan.get("ralliesPerPlayPack") != RALLIES_PER_PACK
        or plan.get("firstRallyCandidateCount") != FIRST_RALLY_CANDIDATE_COUNT
        or plan.get("minimumFirstRallyTails") != PLAY_PACK_COUNT
        or plan.get("postselectionStrategy") != POSTSELECTION_STRATEGY
        or plan.get("selectorBitCount") != SELECTOR_BIT_COUNT
        or plan.get("expectedJobCount") != EXPECTED_JOB_COUNT
    ):
        raise ContractError("preflight.plan", "is not the exact 120-job plan")
    if value.get("runtimeBoundary") != {
        "providerCallsDuringPlay": 0,
        "assemblySelection": (
            "first four recorded tails from the ordered bounded candidate pool"
        ),
        "runtimeSelection": "two recorded selector bits decoded locally",
        "syntheticStoryFallback": False,
    }:
        raise ContractError("preflight.runtimeBoundary", "does not fail closed")
    if (
        schema_version == BROWSER_PREFLIGHT_SCHEMA_VERSION_V2
        and value.get("backendPolicy") != MIXED_BACKEND_POLICY
    ):
        raise ContractError(
            "preflight.backendPolicy", "does not permit provider selection"
        )
    return dict(value)


def capture_from_result(
    *,
    item_id: str,
    moth_job_id: str,
    submitted_at: str,
    provider_updated_at: str,
    terminal_observed_at: str,
    retrieved_at: str,
    terminal_status_sha256: str,
    raw_result: bytes,
) -> Dict[str, Any]:
    expected = {item["itemId"] for item in planned_items()}
    if item_id not in expected:
        raise ContractError("capture.itemId", "is not in the Qong preflight")
    if not moth_job_id:
        raise ContractError("capture.mothJobId", "must be non-empty")
    _validate_capture_timestamps(
        submitted_at,
        provider_updated_at,
        terminal_observed_at,
        retrieved_at,
    )
    _sha256(terminal_status_sha256, "capture.terminalStatusSha256")
    try:
        result = json.loads(raw_result.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ContractError("capture.result", "must be a UTF-8 JSON object") from error
    normalized = normalize_result(result)
    material = {
        "schemaVersion": CAPTURE_SCHEMA_VERSION,
        "itemId": item_id,
        "mothJobId": moth_job_id,
        "submittedAt": submitted_at,
        "providerUpdatedAt": provider_updated_at,
        "terminalObservedAt": terminal_observed_at,
        "retrievedAt": retrieved_at,
        "requestSha256": REQUEST_SHA256,
        "terminalStatusSha256": terminal_status_sha256,
        "rawResultSha256": sha256_bytes(raw_result),
        "result": normalized,
    }
    return {**material, "contentSha256": sha256_json(material)}


def normalize_result(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict) or set(value) != RAW_RESULT_FIELDS:
        raise ContractError(
            "Coin Toss result", "must contain exactly the reviewed result fields"
        )
    backend = _text(value.get("backend"), "Coin Toss result.backend")
    hardware_job_id = _text(
        value.get("ibm_job_id"), "Coin Toss result.ibm_job_id"
    )
    if value.get("mode") != "qpu":
        raise ContractError("Coin Toss result.mode", "must be qpu")
    shots = _positive_int(value.get("shots"), "Coin Toss result.shots")
    if shots != 1:
        raise ContractError(
            "Coin Toss result.shots",
            "must be exactly one for an independently identified bank bit",
        )
    heads = _nonnegative_int(value.get("heads"), "Coin Toss result.heads")
    tails = _nonnegative_int(value.get("tails"), "Coin Toss result.tails")
    output = value.get("output")
    if heads + tails != shots or heads == tails:
        raise ContractError(
            "Coin Toss result counts", "must identify one strict majority outcome"
        )
    if output not in ("heads", "tails"):
        raise ContractError("Coin Toss result.output", "must be heads or tails")
    if (output == "heads") != (heads > tails):
        raise ContractError(
            "Coin Toss result.output", "does not match the returned counts"
        )
    return {
        "backend": backend,
        "heads": heads,
        "ibm_job_id": hardware_job_id,
        "mode": "qpu",
        "output": output,
        "shots": shots,
        "tails": tails,
    }


def validate_capture(value: Mapping[str, Any], item_id: str) -> Dict[str, Any]:
    if value.get("schemaVersion") != CAPTURE_SCHEMA_VERSION:
        raise ContractError("capture", "has an unknown schema")
    if set(value) != CAPTURE_FIELDS:
        raise ContractError("capture", "contains absent or unexpected fields")
    if value.get("itemId") != item_id:
        raise ContractError("capture.itemId", "does not match its planned item")
    material = {key: item for key, item in value.items() if key != "contentSha256"}
    if value.get("contentSha256") != sha256_json(material):
        raise ContractError("capture.contentSha256", "does not match the capture")
    if value.get("requestSha256") != REQUEST_SHA256:
        raise ContractError("capture.requestSha256", "does not match the exact request")
    _sha256(value.get("rawResultSha256"), "capture.rawResultSha256")
    _sha256(
        value.get("terminalStatusSha256"), "capture.terminalStatusSha256"
    )
    _validate_capture_timestamps(
        value.get("submittedAt"),
        value.get("providerUpdatedAt"),
        value.get("terminalObservedAt"),
        value.get("retrievedAt"),
    )
    _text(value.get("mothJobId"), "capture.mothJobId")
    normalize_result(value.get("result"))
    return dict(value)


def assemble_bank(
    preflight_value: Mapping[str, Any],
    capture_values: Sequence[Mapping[str, Any]],
    *,
    selector_bit_count: int = SELECTOR_BIT_COUNT,
    selector_completion: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    preflight = validate_bank_preflight(preflight_value)
    if (
        type(selector_bit_count) is not int
        or selector_bit_count < MIN_SELECTOR_BIT_COUNT
        or selector_bit_count > SELECTOR_BIT_COUNT
        or selector_bit_count % 2 != 0
    ):
        raise ContractError(
            "selector_bit_count",
            "must be an even integer from {} through {}".format(
                MIN_SELECTOR_BIT_COUNT, SELECTOR_BIT_COUNT
            ),
        )
    expected_capture_count = (
        FIRST_RALLY_CANDIDATE_COUNT
        + PLAY_PACK_COUNT * REMAINING_RALLIES_PER_PACK
        + selector_bit_count
    )
    if len(capture_values) != expected_capture_count:
        raise ContractError(
            "captures", "requires exactly {} results".format(expected_capture_count)
        )
    if selector_bit_count == SELECTOR_BIT_COUNT:
        if selector_completion is not None:
            raise ContractError(
                "selector completion",
                "must be absent when all authorized selector bits were captured",
            )
    elif not _allows_mixed_browser_backends(preflight):
        raise ContractError(
            "selector completion",
            "requires the exact provider-selected browser preflight",
        )
    elif not isinstance(selector_completion, Mapping):
        raise ContractError(
            "selector completion",
            "is required for a bounded selector prefix",
        )
    normalized_selector_completion = (
        validate_selector_completion(
            selector_completion,
            selector_bit_count=selector_bit_count,
        )
        if selector_completion is not None
        else None
    )
    by_id: Dict[str, Dict[str, Any]] = {}
    for capture in capture_values:
        item_id = capture.get("itemId")
        if not isinstance(item_id, str) or item_id in by_id:
            raise ContractError("captures", "contains an absent or duplicate item ID")
        by_id[item_id] = validate_capture(capture, item_id)
    expected_ids = [
        item["itemId"] for item in planned_items()[:expected_capture_count]
    ]
    if set(by_id) != set(expected_ids):
        raise ContractError("captures", "does not match the exact preflight item set")
    ordered = [by_id[item_id] for item_id in expected_ids]
    _unique((item["mothJobId"] for item in ordered), "Moth job IDs")
    _unique(
        (item["result"]["ibm_job_id"] for item in ordered), "hardware job IDs"
    )
    _unique((item["rawResultSha256"] for item in ordered), "raw result hashes")
    backend_names = {item["result"]["backend"] for item in ordered}
    if len(backend_names) != 1 and not _allows_mixed_browser_backends(preflight):
        raise ContractError(
            "capture result backends",
            "do not share one canary-established backend",
        )
    candidate_captures = ordered[:FIRST_RALLY_CANDIDATE_COUNT]
    selected_candidates = [
        (ordinal, capture)
        for ordinal, capture in enumerate(candidate_captures)
        if capture["result"]["output"] == "tails"
    ][:PLAY_PACK_COUNT]
    if len(selected_candidates) != PLAY_PACK_COUNT:
        raise ContractError(
            "captures.first-rally-candidates",
            "requires at least four recorded tails in the fixed 32-result pool",
        )
    candidate_pool_capture_set_sha256 = sha256_json(candidate_captures)
    remaining_start = FIRST_RALLY_CANDIDATE_COUNT
    selector_start = (
        remaining_start + PLAY_PACK_COUNT * REMAINING_RALLIES_PER_PACK
    )
    play_packs = []
    for pack_index in range(PLAY_PACK_COUNT):
        candidate_ordinal, first_capture = selected_candidates[pack_index]
        start = remaining_start + pack_index * REMAINING_RALLIES_PER_PACK
        captures = [
            first_capture,
            *ordered[start : start + REMAINING_RALLIES_PER_PACK],
        ]
        jobs = [
            _public_job(
                capture,
                "r{:02d}".format(index + 1),
                sequence_ordinal=index,
            )
            for index, capture in enumerate(captures)
        ]
        outcomes = [job["outcome"] for job in jobs]
        postselection = {
            "strategy": POSTSELECTION_STRATEGY,
            "candidatePoolSize": FIRST_RALLY_CANDIDATE_COUNT,
            "selectedCandidateItemId": first_capture["itemId"],
            "selectedCandidateOrdinal": candidate_ordinal,
            "selectedTailRank": pack_index,
            "preflightContentSha256": preflight["contentSha256"],
            "candidatePoolCaptureSetSha256": candidate_pool_capture_set_sha256,
        }
        provenance = _provenance(
            preflight,
            captures,
            jobs,
            postselection=postselection,
            selector_completion=None,
        )
        hash_material = {
            "schemaVersion": PACK_SCHEMA_VERSION,
            "packSchemaVersion": PLAY_PACK_SCHEMA_VERSION,
            "packId": "qong-moth-qpu-play-{:02d}-{}".format(
                pack_index + 1, preflight["contentSha256"][:12]
            ),
            "gameId": "qong",
            "engineId": "coin-toss-v1",
            "source": "moth-api-qpu",
            "rulesVersion": QONG_RULES_VERSION,
            "warnings": [
                "Pre-acquired Moth Coin Toss QPU results; no provider call occurs during play.",
                (
                    "The opening tails result was transparently selected from "
                    "a fixed 32-result candidate pool bound to preflight {}. "
                    "Unselected captures remain private acquisition evidence."
                ).format(preflight["contentSha256"]),
                "Coin Toss is classically simulable; this pack does not claim quantum advantage.",
            ],
            "payload": {
                "directProbability": outcomes.count("heads") / RALLIES_PER_PACK,
                "rallyPolarities": [
                    "direct" if outcome == "heads" else "invert"
                    for outcome in outcomes
                ],
            },
            "qpuProvenance": provenance,
        }
        play_packs.append(
            {
                **hash_material,
                "contentSha256": sha256_json(hash_material),
                "mothEvidence": None,
            }
        )
    selector_captures = ordered[selector_start:]
    selector_jobs = [
        _public_job(
            capture,
            "s{:03d}".format(index + 1),
            sequence_ordinal=index,
        )
        for index, capture in enumerate(selector_captures)
    ]
    selector_hash_material = {
        "schemaVersion": SELECTOR_PACK_SCHEMA_VERSION,
        "packId": "qong-moth-qpu-selector-{}".format(
            preflight["contentSha256"][:12]
        ),
        "engineId": "coin-toss-v1",
        "source": "moth-api-qpu",
        "acquisitionClass": "moth-acquired",
        "mapping": "heads-0-tails-1-v1",
        "bits": [
            0 if job["outcome"] == "heads" else 1 for job in selector_jobs
        ],
        "qpuProvenance": _provenance(
            preflight,
            selector_captures,
            selector_jobs,
            postselection=None,
            selector_completion=(
                normalized_selector_completion
                if normalized_selector_completion is not None
                else None
            ),
        ),
    }
    selector_pack = {
        **selector_hash_material,
        "contentSha256": sha256_json(selector_hash_material),
    }
    bank_hash_material = {
        "schemaVersion": BANK_SCHEMA_VERSION,
        "bankId": "qong-moth-qpu-bank-{}".format(preflight["contentSha256"][:12]),
        "selectionMethod": "two-recorded-bits-to-four-pack-index-v1",
        "playPackContentSha256": [
            pack["contentSha256"] for pack in play_packs
        ],
        "selectorPackContentSha256": selector_pack["contentSha256"],
    }
    return {
        "schemaVersion": BANK_SCHEMA_VERSION,
        "bankId": bank_hash_material["bankId"],
        "contentSha256": sha256_json(bank_hash_material),
        "selectionMethod": bank_hash_material["selectionMethod"],
        "playPacks": play_packs,
        "selectorPack": selector_pack,
    }


def validate_selector_completion(
    value: Mapping[str, Any], *, selector_bit_count: int
) -> Dict[str, Any]:
    fields = {
        "schemaVersion",
        "strategy",
        "authorizedSelectorBitCount",
        "installedSelectorBitCount",
        "lastIncludedItemId",
        "unpairedCaptureItemId",
        "unpairedCaptureContentSha256",
        "blockedItems",
        "unattemptedItemIds",
        "ledgerPayloadSha256",
        "ledgerByteSha256",
        "stoppedMutationAtUtc",
        "contentSha256",
    }
    if set(value) != fields:
        raise ContractError(
            "selector completion", "contains absent or unexpected fields"
        )
    material = {
        key: item for key, item in value.items() if key != "contentSha256"
    }
    if value.get("contentSha256") != sha256_json(material):
        raise ContractError(
            "selector completion.contentSha256", "does not match the seal"
        )
    if (
        value.get("schemaVersion") != SELECTOR_COMPLETION_SCHEMA_VERSION
        or value.get("strategy") != SELECTOR_COMPLETION_STRATEGY
        or value.get("authorizedSelectorBitCount") != SELECTOR_BIT_COUNT
        or value.get("installedSelectorBitCount") != selector_bit_count
    ):
        raise ContractError(
            "selector completion", "does not describe the installed prefix"
        )
    last_included = "s{:03d}".format(selector_bit_count)
    unpaired = "s{:03d}".format(selector_bit_count + 1)
    if (
        value.get("lastIncludedItemId") != last_included
        or value.get("unpairedCaptureItemId") != unpaired
    ):
        raise ContractError(
            "selector completion", "does not preserve the exact prefix boundary"
        )
    require_sha = (
        ("unpairedCaptureContentSha256", "unpaired capture content hash"),
        ("ledgerPayloadSha256", "selector completion ledger payload hash"),
        ("ledgerByteSha256", "selector completion ledger byte hash"),
    )
    for field, label in require_sha:
        _sha256(value.get(field), label)
    _utc(value.get("stoppedMutationAtUtc"), "selector completion stop time")
    blocked = value.get("blockedItems")
    if not isinstance(blocked, list) or not blocked:
        raise ContractError(
            "selector completion.blockedItems", "must preserve provider blockers"
        )
    expected_blocked_ids = [
        "s{:03d}".format(index)
        for index in range(selector_bit_count + 2, selector_bit_count + 2 + len(blocked))
    ]
    normalized_blocked = []
    for index, item in enumerate(blocked):
        if not isinstance(item, dict) or set(item) != {
            "itemId",
            "mothJobId",
            "terminalStatusSha256",
            "providerErrorSha256",
            "errorType",
            "errorRetryable",
        }:
            raise ContractError(
                "selector completion.blockedItems", "has an unknown record"
            )
        if (
            item.get("itemId") != expected_blocked_ids[index]
            or not isinstance(item.get("mothJobId"), str)
            or not item["mothJobId"]
            or item.get("errorType") != "unavailable"
            or item.get("errorRetryable") is not False
        ):
            raise ContractError(
                "selector completion.blockedItems", "does not match the provider stop"
            )
        _sha256(
            item.get("terminalStatusSha256"),
            "selector completion terminal status hash",
        )
        _sha256(
            item.get("providerErrorSha256"),
            "selector completion provider error hash",
        )
        normalized_blocked.append(dict(item))
    unattempted = value.get("unattemptedItemIds")
    expected_unattempted = [
        "s{:03d}".format(index)
        for index in range(
            selector_bit_count + 2 + len(normalized_blocked),
            SELECTOR_BIT_COUNT + 1,
        )
    ]
    if unattempted != expected_unattempted:
        raise ContractError(
            "selector completion.unattemptedItemIds",
            "does not preserve the unused authorized suffix",
        )
    return {
        **material,
        "blockedItems": normalized_blocked,
        "unattemptedItemIds": list(unattempted),
        "contentSha256": value["contentSha256"],
    }


def inspect_first_rally_candidates(
    preflight_value: Mapping[str, Any],
    capture_values: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    preflight = validate_bank_preflight(preflight_value)
    if len(capture_values) != FIRST_RALLY_CANDIDATE_COUNT:
        raise ContractError(
            "first-rally captures",
            "requires exactly {} results".format(FIRST_RALLY_CANDIDATE_COUNT),
        )
    expected_items = list(planned_items()[:FIRST_RALLY_CANDIDATE_COUNT])
    validated = [
        validate_capture(capture, item["itemId"])
        for capture, item in zip(capture_values, expected_items)
    ]
    _unique((item["mothJobId"] for item in validated), "candidate Moth job IDs")
    _unique(
        (item["result"]["ibm_job_id"] for item in validated),
        "candidate hardware job IDs",
    )
    _unique(
        (item["rawResultSha256"] for item in validated),
        "candidate raw result hashes",
    )
    tails = [
        (ordinal, capture)
        for ordinal, capture in enumerate(validated)
        if capture["result"]["output"] == "tails"
    ]
    candidate_pool_capture_set_sha256 = sha256_json(validated)
    selected = [
        {
            "selectedTailRank": rank,
            "selectedCandidateOrdinal": ordinal,
            "selectedCandidateItemId": capture["itemId"],
            "mothJobId": capture["mothJobId"],
            "hardwareJobId": capture["result"]["ibm_job_id"],
            "rawResultSha256": capture["rawResultSha256"],
        }
        for rank, (ordinal, capture) in enumerate(tails[:PLAY_PACK_COUNT])
    ]
    return {
        "schemaVersion": CANDIDATE_REPORT_SCHEMA_VERSION,
        "preflightContentSha256": preflight["contentSha256"],
        "strategy": POSTSELECTION_STRATEGY,
        "candidatePoolCaptureSetSha256": candidate_pool_capture_set_sha256,
        "candidateCount": FIRST_RALLY_CANDIDATE_COUNT,
        "tailsCount": len(tails),
        "headsCount": FIRST_RALLY_CANDIDATE_COUNT - len(tails),
        "minimumRequiredTails": PLAY_PACK_COUNT,
        "eligibleForRemainingAcquisition": len(tails) >= PLAY_PACK_COUNT,
        "selected": selected,
        "networkCalls": 0,
    }


def load_first_rally_candidate_directory(path: Path) -> List[Dict[str, Any]]:
    captures = []
    for item in planned_items()[:FIRST_RALLY_CANDIDATE_COUNT]:
        capture_path = path / "{}.json".format(item["itemId"])
        try:
            value = json.loads(capture_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(capture_path), "is absent or invalid") from error
        if not isinstance(value, dict):
            raise ContractError(str(capture_path), "must contain a JSON object")
        captures.append(value)
    return captures


def load_capture_directory(path: Path) -> List[Dict[str, Any]]:
    captures = []
    for item in planned_items():
        capture_path = path / "{}.json".format(item["itemId"])
        try:
            value = json.loads(capture_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(str(capture_path), "is absent or invalid") from error
        if not isinstance(value, dict):
            raise ContractError(str(capture_path), "must contain a JSON object")
        captures.append(value)
    return captures


def _public_job(
    capture: Mapping[str, Any],
    public_item_id: str,
    *,
    sequence_ordinal: int,
) -> Dict[str, Any]:
    result = capture["result"]
    material = {
        "itemId": public_item_id,
        "sequenceOrdinal": sequence_ordinal,
        "mothJobId": capture["mothJobId"],
        "hardwareJobId": result["ibm_job_id"],
        "backendName": result["backend"],
        "executionMode": "qpu",
        "submittedAt": capture["submittedAt"],
        "providerUpdatedAt": capture["providerUpdatedAt"],
        "terminalObservedAt": capture["terminalObservedAt"],
        "retrievedAt": capture["retrievedAt"],
        "shots": result["shots"],
        "heads": result["heads"],
        "tails": result["tails"],
        "outcome": result["output"],
        "requestSha256": capture["requestSha256"],
        "terminalStatusSha256": capture["terminalStatusSha256"],
        "rawResultSha256": capture["rawResultSha256"],
    }
    return {**material, "providerRecordSha256": sha256_json(material)}


def _provenance(
    preflight: Mapping[str, Any],
    captures: Sequence[Mapping[str, Any]],
    jobs: Sequence[Mapping[str, Any]],
    *,
    postselection: Mapping[str, Any] | None,
    selector_completion: Mapping[str, Any] | None,
) -> Dict[str, Any]:
    latest_capture = max(
        captures,
        key=lambda capture: datetime.fromisoformat(
            str(capture["retrievedAt"]).replace("Z", "+00:00")
        ),
    )
    acquired_at = str(latest_capture["retrievedAt"])
    common = {
        "acquisitionClass": "moth-acquired",
        "requestBody": REQUEST_BODY,
        "requestBodySha256": REQUEST_SHA256,
        "acquiredAt": acquired_at,
        "resultContract": RESULT_CONTRACT,
        "postselection": dict(postselection) if postselection is not None else None,
        "jobs": list(jobs),
    }
    if preflight.get("schemaVersion") in (
        BROWSER_PREFLIGHT_SCHEMA_VERSION,
        BROWSER_PREFLIGHT_SCHEMA_VERSION_V2,
    ):
        contract = preflight["contract"]
        provenance = {
            **common,
            "contractSource": contract["source"],
            "contractObservedAt": contract["contractObservedAtUtc"],
            "canonicalEngineRecordSha256": contract[
                "canonicalContractRecordSha256"
            ],
            "canonicalContractRecordSha256": contract[
                "canonicalContractRecordSha256"
            ],
            "apiSpecificationCanonicalSha256": contract[
                "apiSpecificationCanonicalSha256"
            ],
            "adapterVersion": (
                BROWSER_ADAPTER_VERSION_V5
                if _allows_mixed_browser_backends(preflight)
                else BROWSER_ADAPTER_VERSION
            ),
        }
        if _allows_mixed_browser_backends(preflight):
            provenance.update(
                {
                    "preflightSchemaVersion": preflight["schemaVersion"],
                    "preflightContentSha256": preflight["contentSha256"],
                    "backendPolicy": MIXED_BACKEND_POLICY,
                    "showcaseUrl": contract["showcaseUrl"],
                    "processEndpoint": contract["processEndpoint"],
                    "terminalStatusSchema": contract["terminalStatusSchema"],
                    "priceDisplay": contract["priceDisplay"],
                    "selectorCompletion": (
                        dict(selector_completion)
                        if selector_completion is not None
                        else None
                    ),
                }
            )
        return provenance
    engine = preflight["engine"]
    return {
        **common,
        "engineUpdatedAt": engine["updatedAt"],
        "canonicalEngineRecordSha256": engine[
            "canonicalEngineRecordSha256"
        ],
        "apiSpecificationCanonicalSha256": engine[
            "apiSpecificationCanonicalSha256"
        ],
        "adapterVersion": ADAPTER_VERSION,
    }


def _allows_mixed_browser_backends(preflight: Mapping[str, Any]) -> bool:
    return (
        preflight.get("schemaVersion") == BROWSER_PREFLIGHT_SCHEMA_VERSION_V2
        and preflight.get("backendPolicy") == MIXED_BACKEND_POLICY
    )


def _text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(label, "must be a non-empty string")
    return value


def _sha256(value: Any, label: str) -> str:
    text = _text(value, label)
    if SHA256_PATTERN.fullmatch(text) is None:
        raise ContractError(label, "must be a lowercase SHA-256 digest")
    return text


def _utc(value: Any, label: str) -> str:
    text = _text(value, label)
    if UTC_PATTERN.fullmatch(text) is None:
        raise ContractError(label, "must be an ISO UTC timestamp")
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractError(label, "is not a valid UTC timestamp") from error
    return text


def _validate_capture_timestamps(
    submitted_at: Any,
    provider_updated_at: Any,
    terminal_observed_at: Any,
    retrieved_at: Any,
) -> None:
    values = (
        _utc(submitted_at, "capture.submittedAt"),
        _utc(provider_updated_at, "capture.providerUpdatedAt"),
        _utc(terminal_observed_at, "capture.terminalObservedAt"),
        _utc(retrieved_at, "capture.retrievedAt"),
    )
    instants = tuple(
        datetime.fromisoformat(value.replace("Z", "+00:00")) for value in values
    )
    if any(left > right for left, right in zip(instants, instants[1:])):
        raise ContractError("capture timestamps", "must be chronologically ordered")


def _nonnegative_int(value: Any, label: str) -> int:
    if type(value) is not int or value < 0:
        raise ContractError(label, "must be a non-negative integer")
    return value


def _positive_int(value: Any, label: str) -> int:
    number = _nonnegative_int(value, label)
    if number == 0:
        raise ContractError(label, "must be positive")
    return number


def _unique(values: Iterable[Any], label: str) -> None:
    items = list(values)
    if len(set(items)) != len(items):
        raise ContractError(label, "must be unique")


def immutable_json(path: Path, value: Mapping[str, Any]) -> Path:
    data = (canonical_json(dict(value)) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise ContractError(str(path), "immutable JSON bytes changed")
        return path
    path.write_bytes(data)
    return path


def promote_bank(
    path: Path, value: Mapping[str, Any], accepted_bank_sha256: str
) -> Path:
    accepted = _sha256(accepted_bank_sha256, "accepted bank hash")
    if value.get("schemaVersion") != BANK_SCHEMA_VERSION:
        raise ContractError("bank", "has an unknown schema")
    if value.get("contentSha256") != accepted:
        raise ContractError(
            "accepted bank hash", "does not match the assembled public bank"
        )
    data = (canonical_json(dict(value)) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() == data:
            return path
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError) as error:
            raise ContractError(
                str(path), "is neither the exact placeholder nor the accepted bank"
            ) from error
        if current != UNAVAILABLE_BANK:
            raise ContractError(
                str(path), "refuses to overwrite a non-placeholder bank artifact"
            )
    descriptor, temporary = tempfile.mkstemp(
        prefix="qong-bank.", dir=str(path.parent)
    )
    try:
        os.fchmod(descriptor, 0o644)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return path
