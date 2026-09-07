"""Generate the deterministic QPixl 8x8 signal-field input study."""

from __future__ import annotations

import json
from pathlib import Path
import struct
from typing import Any, Dict, Iterable, Sequence, Tuple
import zlib

from .canonical import canonical_json, sha256_bytes


STUDY_ID = "quantum-box-qpixl-signal-field-v1"
WIDTH = 8
HEIGHT = 8
VALUES: Tuple[float, ...] = (
    0.00, 0.00, 0.00, 0.00, 0.15, 0.00, 0.00, 0.65,
    0.00, 1.00, 0.00, 0.00, 0.15, 0.00, 0.00, 0.00,
    0.00, 0.80, 0.80, 0.00, 0.30, 0.00, 0.00, 0.00,
    0.00, 0.00, 0.60, 0.00, 0.45, 0.45, 0.00, 0.00,
    0.20, 0.00, 0.00, 0.50, 0.00, 0.45, 0.00, 0.10,
    0.00, 0.00, 0.00, 0.00, 0.35, 0.35, 0.35, 0.00,
    0.00, 0.00, 0.25, 0.00, 0.00, 0.00, 0.85, 0.00,
    0.55, 0.00, 0.00, 0.00, 0.10, 0.00, 0.00, 0.00,
)
PALETTE: Tuple[Tuple[int, int, int], ...] = (
    (0x09, 0x0A, 0x08),
    (0x17, 0x18, 0x12),
    (0x1F, 0x5F, 0x93),
    (0x5B, 0x85, 0x0F),
    (0xD4, 0x9A, 0x00),
    (0xD9, 0x56, 0x0D),
    (0xF0, 0xDF, 0xB6),
)


def _chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def _png(width: int, height: int, rows: Iterable[bytes]) -> bytes:
    raw = b"".join(b"\x00" + row for row in rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(raw, 9))
        + _chunk(b"IEND", b"")
    )


def _grayscale_source() -> bytes:
    rows = []
    for row in range(HEIGHT):
        pixels = bytearray()
        for value in VALUES[row * WIDTH : (row + 1) * WIDTH]:
            channel = round(value * 255)
            pixels.extend((channel, channel, channel))
        rows.append(bytes(pixels))
    return _png(WIDTH, HEIGHT, rows)


def _palette_color(value: float) -> Tuple[int, int, int]:
    if value == 0:
        return PALETTE[0]
    index = min(len(PALETTE) - 1, 1 + int(value * (len(PALETTE) - 1)))
    return PALETTE[index]


def _palette_preview(scale: int = 64) -> bytes:
    rows = []
    for row in range(HEIGHT):
        expanded = bytearray()
        for value in VALUES[row * WIDTH : (row + 1) * WIDTH]:
            expanded.extend(_palette_color(value) * scale)
        for _ in range(scale):
            rows.append(bytes(expanded))
    return _png(WIDTH * scale, HEIGHT * scale, rows)


def _request(mode: str) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "allow_high_shots": False,
        "discretize": 0,
        "dynamic_range": "none",
        "mode": mode,
        "shots": 4096,
        "values": list(VALUES),
    }
    if mode == "emu":
        params["machine"] = "aer"
    else:
        params["backend_name"] = "ibm_fez"
    return {"params": params}


def generate(output: Path) -> Dict[str, Any]:
    output.mkdir(parents=True, exist_ok=True)
    source = _grayscale_source()
    preview = _palette_preview()
    values = {
        "schemaVersion": "quantum-box-qpixl-values-v1",
        "studyId": STUDY_ID,
        "width": WIDTH,
        "height": HEIGHT,
        "ordering": "row-major-left-to-right-top-to-bottom",
        "range": [0, 1],
        "values": list(VALUES),
    }
    aer_request = _request("emu")
    qpu_request = _request("qpu")
    files = {
        "source-8x8.png": source,
        "palette-preview-512.png": preview,
        "values-row-major.json": (canonical_json(values) + "\n").encode("utf-8"),
        "request-aer-review.json": (canonical_json(aer_request) + "\n").encode("utf-8"),
        "request-qpu-ibm-fez-blocked.json": (canonical_json(qpu_request) + "\n").encode("utf-8"),
    }
    for name, data in files.items():
        (output / name).write_bytes(data)
    manifest = {
        "schemaVersion": "quantum-box-qpixl-study-manifest-v1",
        "studyId": STUDY_ID,
        "sourceClass": "locally-authored-deterministic-input-no-moth-result",
        "networkCalls": 0,
        "creditsSpent": 0,
        "files": {
            name: {"sha256": sha256_bytes(data), "sizeBytes": len(data)}
            for name, data in sorted(files.items())
        },
        "requests": {
            "aer": {
                "bodySha256": sha256_bytes(canonical_json(aer_request).encode("utf-8")),
                "listedCredits": 1,
                "status": "review-only-not-authorized",
            },
            "qpu": {
                "bodySha256": sha256_bytes(canonical_json(qpu_request).encode("utf-8")),
                "listedCredits": 1,
                "status": "blocked-not-authorized",
                "blockers": [
                    "backend_name ibm_fez is observed in the showcase but is not constrained by the API schema",
                    "formal returned-value schema and ordering are not pinned",
                    "QPU capacity, provenance, retention, and redistribution terms are not pinned",
                ],
            },
        },
        "warnings": [
            "The palette preview is a local visualization and is not submitted to QPixl.",
            "The request files are review artifacts, not approval receipts.",
            "No QPixl output, QPU result, or Moth provenance is claimed.",
        ],
    }
    manifest_bytes = (canonical_json(manifest) + "\n").encode("utf-8")
    (output / "manifest.json").write_bytes(manifest_bytes)
    return manifest

