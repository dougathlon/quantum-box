#!/usr/bin/env python3
"""Cut the approved lead-free backing to its authored eight-bar loop.

The input WAV is already the manifest-verified bass/inner/drum render. This
script does not remix or repair it: it verifies the source identity and copies
the exact PCM frames covering quarter beats 8 through 40 at 112 BPM.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import wave


BPM = 112
START_QUARTER_BEAT = 8
END_QUARTER_BEAT = 40
EXPECTED_ROLES = ["bass", "inner", "drum"]
EXPECTED_REMOVED_ROLES = ["lead"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("source_manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("provenance", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = json.loads(args.source_manifest.read_text(encoding="utf-8"))
    source_hash = sha256(args.source)
    if source_hash != manifest["outputSha256"]:
        raise RuntimeError("Backing source hash does not match its manifest.")
    if manifest["keptRoles"] != EXPECTED_ROLES:
        raise RuntimeError("Backing manifest does not contain the approved roles.")
    if manifest["removedRoles"] != EXPECTED_REMOVED_ROLES:
        raise RuntimeError("Backing manifest does not exclude the lead role.")

    with wave.open(str(args.source), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        sample_rate = source.getframerate()
        if channels != 2 or sample_width != 2 or sample_rate != 44_100:
            raise RuntimeError("Expected stereo PCM16 at 44.1 kHz.")
        start_frame = round(START_QUARTER_BEAT * 60 * sample_rate / BPM)
        frame_count = round(
            (END_QUARTER_BEAT - START_QUARTER_BEAT) * 60 * sample_rate / BPM
        )
        source.setpos(start_frame)
        frames = source.readframes(frame_count)
        if len(frames) != frame_count * channels * sample_width:
            raise RuntimeError("Source ended before the requested loop boundary.")
        first_frame = frames[: channels * sample_width]
        final_frame = frames[-channels * sample_width :]
        if first_frame != bytes(len(first_frame)) or final_frame != bytes(
            len(final_frame)
        ):
            raise RuntimeError("Authored loop boundaries are not zero-valued PCM frames.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(frames)

    record = {
        "schemaVersion": "quantum-box-audio-derivative-v1",
        "cueId": "key-is-opaque",
        "title": "The Key Is Opaque — backing only — eight-bar runtime loop",
        "sourceFilename": args.source.name,
        "sourceSha256": source_hash,
        "sourceManifestFilename": args.source_manifest.name,
        "sourceManifestSha256": sha256(args.source_manifest),
        "keptRoles": EXPECTED_ROLES,
        "removedRoles": EXPECTED_REMOVED_ROLES,
        "eventFiltering": "Source is the manifest-verified role-filtered render; no additional events were added or removed during this frame-exact cut.",
        "masterGain": manifest["masterGainUnchanged"],
        "bpm": BPM,
        "startQuarterBeat": START_QUARTER_BEAT,
        "endQuarterBeatExclusive": END_QUARTER_BEAT,
        "sampleRate": sample_rate,
        "channels": channels,
        "sampleWidthBytes": sample_width,
        "startFrame": start_frame,
        "frameCount": frame_count,
        "durationSeconds": frame_count / sample_rate,
        "boundaryFramesAreZero": True,
        "outputFilename": args.output.name,
        "outputSha256": sha256(args.output),
        "providerCalls": 0,
        "classification": "Local frame-exact derivative of an approved locally authored backing render; not provider output.",
    }
    args.provenance.parent.mkdir(parents=True, exist_ok=True)
    args.provenance.write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(record, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
