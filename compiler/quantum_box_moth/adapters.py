"""Four separate result validators and local game-pack decoders."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import struct
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
import zlib

from .canonical import canonical_bytes, sha256_bytes, sha256_json
from .engine_contracts import ENGINE_CONTRACTS
from .models import ContractError


@dataclass(frozen=True)
class SequencedResult:
    item_id: str
    raw_bytes: bytes


@dataclass(frozen=True)
class LabyrinthMockNormalization:
    bit_order: str
    room_mapping: str
    measurement_order: str
    measurements_complete: bool


def _pack(
    *,
    pack_id: str,
    game_id: str,
    engine_id: str,
    rules_version: str,
    payload: Dict[str, Any],
    warnings: Sequence[str],
) -> Dict[str, Any]:
    return {
        "schemaVersion": "quantum-box-pack-v1",
        "packId": pack_id,
        "gameId": game_id,
        "engineId": engine_id,
        "source": "contract-mock",
        "contentSha256": sha256_json(payload),
        "rulesVersion": rules_version,
        "warnings": list(warnings),
        "mothEvidence": None,
        "payload": payload,
    }


def _decision(
    engine_id: str,
    status: str,
    *,
    blockers: Iterable[str],
    raw_hashes: Iterable[str],
    candidate: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    contract = ENGINE_CONTRACTS[engine_id]
    payload = {
        "schemaVersion": "quantum-box-promotion-decision-v1",
        "engineId": engine_id,
        "engineCanonicalSha256": contract.canonical_sha256,
        "engineUpdatedAt": contract.updated_at,
        "status": status,
        "blockers": list(blockers),
        "rawEvidenceSha256": list(raw_hashes),
        "candidate": candidate,
    }
    payload["decisionSha256"] = sha256_json(payload)
    return payload


def decode_qong_contract_mock(
    results: Sequence[SequencedResult],
) -> Dict[str, Any]:
    expected_ids = ["r{:02d}".format(index) for index in range(1, 8)]
    observed_ids = [result.item_id for result in results]
    if observed_ids != expected_ids:
        raise ContractError(
            "qong.results",
            "must preserve exact stable order {}".format(", ".join(expected_ids)),
        )
    polarities: List[str] = []
    raw_hashes: List[str] = []
    for result in results:
        raw_hashes.append(sha256_bytes(result.raw_bytes))
        try:
            value = json.loads(result.raw_bytes.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise ContractError(
                "qong.result.{}".format(result.item_id), "must be UTF-8 JSON"
            ) from None
        if not isinstance(value, dict) or set(value) != {"output"}:
            raise ContractError(
                "qong.result.{}".format(result.item_id),
                "must contain only the code-sample output field",
            )
        outcome = value["output"]
        if outcome not in ("heads", "tails"):
            raise ContractError(
                "qong.result.{}.output".format(result.item_id),
                "must be heads or tails",
            )
        polarities.append("direct" if outcome == "heads" else "invert")
    payload = {
        "directProbability": polarities.count("direct") / 7,
        "rallyPolarities": polarities,
    }
    aggregate = sha256_json(
        [
            {"rallyId": item_id, "rawResultSha256": digest}
            for item_id, digest in zip(expected_ids, raw_hashes)
        ]
    )
    candidate = _pack(
        pack_id="qong-coin-contract-mock-{}".format(aggregate[:12]),
        game_id="qong",
        engine_id="coin-toss-v1",
        rules_version="qong-rules-v1",
        payload=payload,
        warnings=(
            "Contract mock only: no Moth jobs were submitted.",
            "Heads maps to Direct and tails maps to Invert in stable rally-ID order.",
            "Promotion remains blocked until the formatted result contract and seven-job acquisition plan are reviewed.",
        ),
    )
    return _decision(
        "coin-toss-v1",
        "contract-mock-generated",
        blockers=ENGINE_CONTRACTS["coin-toss-v1"].unresolved_gaps,
        raw_hashes=raw_hashes,
        candidate=candidate,
    )


def _paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    left_distance = abs(estimate - left)
    above_distance = abs(estimate - above)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= above_distance and left_distance <= upper_left_distance:
        return left
    if above_distance <= upper_left_distance:
        return above
    return upper_left


def decode_png_rgb(data: bytes) -> Tuple[int, int, Tuple[Tuple[int, int, int], ...]]:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ContractError("blur.asset", "must be a PNG file")
    offset = 8
    width = height = color_type = bit_depth = interlace = None
    compressed = bytearray()
    saw_end = False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ContractError("blur.asset", "contains a truncated PNG chunk")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        start = offset + 8
        end = start + length
        if end + 4 > len(data):
            raise ContractError("blur.asset", "contains a truncated PNG payload")
        payload = data[start:end]
        expected_crc = struct.unpack(">I", data[end : end + 4])[0]
        if zlib.crc32(chunk_type + payload) & 0xFFFFFFFF != expected_crc:
            raise ContractError("blur.asset", "contains a PNG CRC mismatch")
        offset = end + 4
        if chunk_type == b"IHDR":
            if width is not None or len(payload) != 13:
                raise ContractError("blur.asset", "contains an invalid IHDR")
            width, height, bit_depth, color_type, compression, filtering, interlace = (
                struct.unpack(">IIBBBBB", payload)
            )
            if not (1 <= width <= 1024 and 1 <= height <= 1024):
                raise ContractError("blur.asset", "dimensions exceed the decoder bound")
            if (
                bit_depth != 8
                or color_type not in (2, 6)
                or compression != 0
                or filtering != 0
                or interlace != 0
            ):
                raise ContractError(
                    "blur.asset",
                    "requires non-interlaced eight-bit RGB or RGBA PNG data",
                )
        elif chunk_type == b"IDAT":
            compressed.extend(payload)
        elif chunk_type == b"IEND":
            saw_end = True
            break
    if width is None or height is None or color_type is None or not compressed or not saw_end:
        raise ContractError("blur.asset", "is missing required PNG chunks")
    channels = 3 if color_type == 2 else 4
    stride = width * channels
    try:
        inflated = zlib.decompress(bytes(compressed))
    except zlib.error:
        raise ContractError("blur.asset", "contains invalid compressed pixels") from None
    if len(inflated) != height * (stride + 1):
        raise ContractError("blur.asset", "decompressed pixel length is invalid")
    rows: List[bytearray] = []
    for row_index in range(height):
        row_start = row_index * (stride + 1)
        filter_type = inflated[row_start]
        encoded = inflated[row_start + 1 : row_start + 1 + stride]
        if filter_type > 4:
            raise ContractError("blur.asset", "contains an unknown PNG filter")
        prior = rows[-1] if rows else bytearray(stride)
        decoded = bytearray(stride)
        for index, byte in enumerate(encoded):
            left = decoded[index - channels] if index >= channels else 0
            above = prior[index]
            upper_left = prior[index - channels] if index >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            else:
                predictor = _paeth(left, above, upper_left)
            decoded[index] = (byte + predictor) & 0xFF
        rows.append(decoded)
    pixels: List[Tuple[int, int, int]] = []
    for row in rows:
        for index in range(0, len(row), channels):
            pixels.append((row[index], row[index + 1], row[index + 2]))
    return width, height, tuple(pixels)



def evaluate_graph_result(raw_bytes: bytes) -> Dict[str, Any]:
    raw_hash = sha256_bytes(raw_bytes)
    blockers = list(ENGINE_CONTRACTS["graph-v1"].unresolved_gaps)
    try:
        value = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        blockers.insert(0, "The supplied result is not UTF-8 JSON.")
    else:
        output = value.get("output") if isinstance(value, dict) else None
        if not isinstance(output, dict):
            blockers.insert(0, "The supplied result lacks the documented output object.")
        else:
            for key in ("mode", "dominant_bitstring", "edge_agreement_score"):
                if key not in output:
                    blockers.insert(0, "The supplied output lacks {}.".format(key))
    return _decision(
        "graph-v1",
        "promotion-blocked",
        blockers=blockers,
        raw_hashes=(raw_hash,),
        candidate=None,
    )


def evaluate_labyrinth_result(
    raw_bytes: bytes,
    *,
    template_path: Optional[Path] = None,
    mock_normalization: Optional[LabyrinthMockNormalization] = None,
) -> Dict[str, Any]:
    raw_hash = sha256_bytes(raw_bytes)
    blockers = list(ENGINE_CONTRACTS["labyrinth-v1"].unresolved_gaps)
    try:
        value = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        blockers.insert(0, "The supplied result is not UTF-8 JSON.")
        return _decision(
            "labyrinth-v1",
            "promotion-blocked",
            blockers=blockers,
            raw_hashes=(raw_hash,),
            candidate=None,
        )
    output = value.get("output") if isinstance(value, dict) else None
    results = output.get("results") if isinstance(output, dict) else None
    measurements = results.get("measurements") if isinstance(results, dict) else None
    if not isinstance(measurements, list) or not measurements:
        blockers.insert(0, "The supplied output has no non-empty measurements list.")
        return _decision(
            "labyrinth-v1",
            "promotion-blocked",
            blockers=blockers,
            raw_hashes=(raw_hash,),
            candidate=None,
        )
    if mock_normalization is None or template_path is None:
        return _decision(
            "labyrinth-v1",
            "promotion-blocked",
            blockers=blockers,
            raw_hashes=(raw_hash,),
            candidate=None,
        )
    expected = LabyrinthMockNormalization(
        bit_order="leftmost-character-maps-to-q0",
        room_mapping="q0-maps-to-row-major-room-0",
        measurement_order="descending-probability",
        measurements_complete=True,
    )
    if mock_normalization != expected:
        raise ContractError(
            "labyrinth.mockNormalization",
            "does not match the explicit contract-mock convention",
        )
    first = measurements[0]
    bit_string = first.get("bitstring") if isinstance(first, dict) else None
    if not isinstance(bit_string, str) or len(bit_string) != 16 or set(bit_string) - {"0", "1"}:
        raise ContractError(
            "labyrinth.measurements[0].bitstring",
            "must contain sixteen binary characters",
        )
    try:
        template = json.loads(template_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ContractError("labyrinth.template", "is unreadable") from error
    if not isinstance(template, dict):
        raise ContractError("labyrinth.template", "must be an object")
    template = json.loads(json.dumps(template))
    state = template.get("syntheticState")
    fields = template.get("roomFields")
    if not isinstance(state, dict) or not isinstance(fields, list):
        raise ContractError("labyrinth.template", "lacks state or room fields")
    state["kind"] = "contract-mock-labyrinth-measurement-v1"
    state["bitString"] = bit_string
    state["bitOrder"] = "leftmost character maps to row-major room 0"
    for field in fields:
        indices = field.get("sourceRoomIndices") if isinstance(field, dict) else None
        if not isinstance(indices, list) or len(indices) != 4:
            raise ContractError("labyrinth.template.roomFields", "is invalid")
        parity = 0
        for room in indices:
            parity ^= int(bit_string[room])
        field["state"] = parity
        field["effect"] = "mask" if parity == 0 else "beacon"
        field["tone"] = "blue" if parity == 0 else "avocado"
    template["visualSeed"] = int(raw_hash[:8], 16)
    candidate = _pack(
        pack_id="quantman-labyrinth-contract-mock-{}".format(raw_hash[:12]),
        game_id="quantman",
        engine_id="labyrinth-v1",
        rules_version="quantman-rules-v1",
        payload=template,
        warnings=(
            "Contract mock only: no Moth Labyrinth acquisition is claimed.",
            "The bit and room order used here is an explicit mock convention, not a retrieved engine guarantee.",
            "The authored maze remains local; only the mocked sixteen-bit room state is decoded.",
        ),
    )
    return _decision(
        "labyrinth-v1",
        "contract-mock-generated",
        blockers=blockers,
        raw_hashes=(raw_hash,),
        candidate=candidate,
    )


def candidate_bytes(decision: Dict[str, Any]) -> bytes:
    candidate = decision.get("candidate")
    if not isinstance(candidate, dict):
        raise ContractError("promotion decision", "contains no candidate pack")
    return canonical_bytes(candidate) + b"\n"
