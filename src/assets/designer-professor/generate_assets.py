#!/usr/bin/env python3
"""Build the deterministic Designer Professor v1 sprite and morph package."""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "src/assets/designer-professor"
ASSETS = PACKAGE / "assets"
MANIFESTS = PACKAGE / "manifests"
PROFESSOR_ORIGINAL_LOCATOR = (
    "drafts/visual-development/quantum-box/core-asset-language-v1/"
    "assets/designer-candidate-professor-20x20.png"
)
PROFESSOR_ORIGINAL_SOURCE = ROOT.parent.parent / PROFESSOR_ORIGINAL_LOCATOR
PROFESSOR_SOURCE_COPY = ASSETS / "professor-source-locked-20x20.png"
QONG_PADDLE = (
    ROOT
    / "src/assets/canonical-runtime-assets-v2/assets/qong/"
    "qong-paddle-canonical-20x20.png"
)
PLAYER_C = (
    ROOT
    / "src/assets/canonical-runtime-assets-v2/assets/player/"
    "player-c-source-locked-16x20.png"
)
QUANTMAN_GHOST_C = (
    ROOT
    / "src/assets/canonical-runtime-assets-v2/assets/quantman/"
    "quantman-ghost-c-neutral-16x16.png"
)
QUARRY_DUCK_STRIP = (
    ROOT
    / "src/assets/qgraph-cabinet-assets-v1/assets/quag/"
    "quag-players-directional-strip-10x10.png"
)
QUARRY_RUNTIME_HANDOFF = (
    ROOT
    / "src/assets/qgraph-cabinet-assets-v1/manifests/shipped-runtime-handoff.json"
)
QUARRY_DUCK_FILE_ID = "quag-player-directional-strip"
QUARRY_DUCK_FRAME_ID = "d-right-idle"

TRANSPARENT = (0, 0, 0, 0)
DARK = (43, 28, 20, 255)
TAN = (86, 67, 48, 255)
CREAM = (214, 189, 139, 255)
ALLOWED = {TRANSPARENT, DARK, TAN, CREAM}
FRAME_SIZE = (20, 20)
MORPH_FRAME_COUNT = 7


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repo_locator(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def resolve_repo_locator(locator: str) -> Path:
    path = (ROOT / locator).resolve()
    path.relative_to(ROOT.resolve())
    return path


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def normalize(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = result.getpixel((x, y))
            if alpha == 0:
                result.putpixel((x, y), TRANSPARENT)
            elif alpha != 255:
                raise ValueError(f"Non-binary alpha at {(x, y)}: {alpha}")
            elif (red, green, blue, alpha) not in ALLOWED:
                raise ValueError(
                    f"Off-palette pixel at {(x, y)}: {(red, green, blue, alpha)}"
                )
    return result


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized = normalize(image)
    normalized.save(path, format="PNG", optimize=False, compress_level=9)


def source_record(
    source_id: str,
    role: str,
    authority: str,
    path: Path,
    *,
    crop: dict[str, object] | None = None,
) -> dict[str, object]:
    image = rgba(path)
    record: dict[str, object] = {
        "sourceId": source_id,
        "role": role,
        "authority": authority,
        "path": repo_locator(path),
        "sha256": sha256(path),
        "dimensions": {"width": image.width, "height": image.height},
        "mode": Image.open(path).mode,
    }
    if crop is not None:
        record["selectedFrame"] = crop
    return record


def frame_record(
    frame_id: str,
    order: int,
    x: int,
    method: str,
    parents: list[str],
) -> dict[str, object]:
    return {
        "frameId": frame_id,
        "order": order,
        "rect": {"x": x, "y": 0, "width": 20, "height": 20},
        "anchor": {
            "x": 10,
            "y": 20,
            "convention": "frame-local-integer",
        },
        "derivationMethod": method,
        "parents": parents,
    }


def runtime_record(
    file_id: str,
    relative_path: str,
    kind: str,
    frames: list[dict[str, object]],
) -> dict[str, object]:
    path = PACKAGE / relative_path
    image = rgba(path)
    return {
        "fileId": file_id,
        "relativePath": relative_path,
        "sha256": sha256(path),
        "dimensions": {"width": image.width, "height": image.height},
        "kind": kind,
        "frames": frames,
    }


def professor_actions(source: Image.Image) -> list[tuple[str, Image.Image, str]]:
    source = normalize(source)
    idle = source.copy()

    # Small spectacles and a bent pipe preserve the approved professor body.
    for point in ((8, 3), (10, 3)):
        idle.putpixel(point, DARK)
    for point in ((12, 5), (13, 5), (14, 6), (15, 6)):
        idle.putpixel(point, TAN)
    for point in ((16, 6), (17, 6), (16, 7), (17, 7)):
        idle.putpixel(point, CREAM)
    idle.putpixel((16, 6), DARK)

    walk_a = idle.copy()
    clear_legs(walk_a)
    paint(walk_a, ((5, 15), (6, 15), (7, 15), (5, 16), (6, 16), (5, 17), (4, 18), (5, 18)))
    paint(walk_a, ((12, 15), (13, 15), (13, 16), (14, 16), (14, 17), (14, 18), (15, 18)))

    walk_b = idle.copy()
    clear_legs(walk_b)
    paint(walk_b, ((6, 15), (7, 15), (6, 16), (5, 16), (5, 17), (4, 18), (5, 18)))
    paint(walk_b, ((11, 15), (12, 15), (13, 15), (13, 16), (13, 17), (13, 18), (14, 18), (15, 18)))

    talk_a = idle.copy()
    talk_a.putpixel((11, 5), DARK)
    talk_a.putpixel((12, 5), CREAM)
    talk_a.putpixel((13, 6), TAN)

    talk_b = idle.copy()
    talk_b.putpixel((10, 5), DARK)
    talk_b.putpixel((11, 5), DARK)
    talk_b.putpixel((12, 5), CREAM)
    talk_b.putpixel((13, 4), TAN)
    talk_b.putpixel((14, 5), TAN)
    talk_b.putpixel((17, 5), CREAM)

    point = idle.copy()
    for point_pixel in ((14, 9), (15, 9), (16, 9), (17, 9), (18, 9), (19, 9)):
        point.putpixel(point_pixel, CREAM)

    open_door = idle.copy()
    for point_pixel in ((14, 9), (15, 8), (16, 7), (17, 6), (18, 5), (19, 5)):
        open_door.putpixel(point_pixel, CREAM)

    return [
        ("idle", idle, "professor-source-plus-spectacles-and-pipe-v1"),
        ("walk-a", walk_a, "professor-alternating-step-left-v1"),
        ("walk-b", walk_b, "professor-alternating-step-right-v1"),
        ("talk-a", talk_a, "professor-pipe-mouth-aperture-small-v1"),
        ("talk-b", talk_b, "professor-pipe-mouth-aperture-open-v1"),
        ("point", point, "professor-right-arm-extension-v1"),
        ("open-door", open_door, "professor-raised-right-arm-v1"),
    ]


def clear_legs(image: Image.Image) -> None:
    for y in range(15, 19):
        for x in range(3, 17):
            image.putpixel((x, y), TRANSPARENT)


def paint(image: Image.Image, points: tuple[tuple[int, int], ...]) -> None:
    for point in points:
        image.putpixel(point, CREAM)


def alpha_mask(image: Image.Image) -> set[tuple[int, int]]:
    return {
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if image.getpixel((x, y))[3] == 255
    }


def signed_manhattan(
    mask: set[tuple[int, int]], width: int, height: int
) -> list[list[int]]:
    foreground = list(mask)
    background = [
        (x, y) for y in range(height) for x in range(width) if (x, y) not in mask
    ]
    if not foreground or not background:
        raise ValueError("Morph endpoint must have foreground and background pixels")
    field: list[list[int]] = []
    for y in range(height):
        row: list[int] = []
        for x in range(width):
            pool = background if (x, y) in mask else foreground
            distance = min(abs(x - px) + abs(y - py) for px, py in pool)
            row.append(-distance if (x, y) in mask else distance)
        field.append(row)
    return field


def nearest_opaque_colour(
    image: Image.Image, x: int, y: int
) -> tuple[int, int, int, int]:
    candidates: list[tuple[int, int, int, tuple[int, int, int, int]]] = []
    for py in range(image.height):
        for px in range(image.width):
            colour = image.getpixel((px, py))
            if colour[3] == 255:
                candidates.append((abs(px - x) + abs(py - y), py, px, colour))
    return min(candidates, key=lambda item: (item[0], item[1], item[2]))[3]


def morph_frames(
    start: Image.Image, end: Image.Image, frame_count: int = MORPH_FRAME_COUNT
) -> list[Image.Image]:
    start = normalize(start)
    end = normalize(end)
    if start.size != FRAME_SIZE or end.size != FRAME_SIZE:
        raise ValueError("Professor morph endpoints must be 20x20")
    start_field = signed_manhattan(alpha_mask(start), 20, 20)
    end_field = signed_manhattan(alpha_mask(end), 20, 20)
    frames: list[Image.Image] = []
    for index in range(frame_count):
        if index == 0:
            frames.append(start.copy())
            continue
        if index == frame_count - 1:
            frames.append(end.copy())
            continue
        frame = Image.new("RGBA", FRAME_SIZE, TRANSPARENT)
        for y in range(20):
            for x in range(20):
                score = (
                    start_field[y][x] * (frame_count - 1 - index)
                    + end_field[y][x] * index
                )
                if score <= 0:
                    colour_source = start if index * 2 < frame_count - 1 else end
                    frame.putpixel(
                        (x, y), nearest_opaque_colour(colour_source, x, y)
                    )
        frames.append(frame)
    return frames


def strip(frames: list[Image.Image]) -> Image.Image:
    result = Image.new("RGBA", (20 * len(frames), 20), TRANSPARENT)
    for index, frame in enumerate(frames):
        result.alpha_composite(normalize(frame), (index * 20, 0))
    return result


def embed(image: Image.Image, x: int, y: int) -> Image.Image:
    result = Image.new("RGBA", FRAME_SIZE, TRANSPARENT)
    result.alpha_composite(normalize(image), (x, y))
    return result


def manifested_quarry_duck_frame() -> tuple[Image.Image, dict[str, object]]:
    handoff = json.loads(QUARRY_RUNTIME_HANDOFF.read_text())
    runtime_file = next(
        (
            record
            for record in handoff["runtimeFiles"]
            if record["fileId"] == QUARRY_DUCK_FILE_ID
        ),
        None,
    )
    if runtime_file is None:
        raise ValueError(f"Missing Quarry runtime file {QUARRY_DUCK_FILE_ID}")
    expected_relative_path = "assets/quag/quag-players-directional-strip-10x10.png"
    if runtime_file["relativePath"] != expected_relative_path:
        raise ValueError("Quarry duck strip path drifted")
    frame = next(
        (
            record
            for record in runtime_file["frames"]
            if record["frameId"] == QUARRY_DUCK_FRAME_ID
        ),
        None,
    )
    if frame is None:
        raise ValueError(f"Missing Quarry frame {QUARRY_DUCK_FRAME_ID}")
    rect = frame["rect"]
    if rect["width"] != 20 or rect["height"] != 20:
        raise ValueError("Quarry Designer morph endpoint must be 20x20")
    image = normalize(
        rgba(QUARRY_DUCK_STRIP).crop(
            (
                rect["x"],
                rect["y"],
                rect["x"] + rect["width"],
                rect["y"] + rect["height"],
            )
        )
    )
    selected_frame = {
        "frameId": QUARRY_DUCK_FRAME_ID,
        "x": rect["x"],
        "y": rect["y"],
        "width": rect["width"],
        "height": rect["height"],
    }
    return image, selected_frame


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def build() -> None:
    for path in (
        QONG_PADDLE,
        PLAYER_C,
        QUANTMAN_GHOST_C,
        QUARRY_DUCK_STRIP,
        QUARRY_RUNTIME_HANDOFF,
    ):
        if not path.is_file():
            raise FileNotFoundError(path)

    ASSETS.mkdir(parents=True, exist_ok=True)
    MANIFESTS.mkdir(parents=True, exist_ok=True)

    if PROFESSOR_ORIGINAL_SOURCE.is_file():
        shutil.copyfile(PROFESSOR_ORIGINAL_SOURCE, PROFESSOR_SOURCE_COPY)
    elif not PROFESSOR_SOURCE_COPY.is_file():
        raise FileNotFoundError(
            "The approved professor source and its repository copy are both missing."
        )
    source = normalize(rgba(PROFESSOR_SOURCE_COPY))
    actions = professor_actions(source)

    records: list[dict[str, object]] = []
    for name, image, method in actions:
        path = ASSETS / f"professor-pipe-{name}-20x20.png"
        save(image, path)
        records.append(
            runtime_record(
                f"professor-{name}",
                f"assets/{path.name}",
                "single-frame-runtime-sprite",
                [frame_record(name, 0, 0, method, ["designer-professor-source"])],
            )
        )

    action_strip_path = ASSETS / "professor-pipe-action-strip-20x20.png"
    save(strip([image for _, image, _ in actions]), action_strip_path)
    records.append(
        runtime_record(
            "professor-action-strip",
            f"assets/{action_strip_path.name}",
            "runtime-sprite-strip",
            [
                frame_record(
                    name,
                    index,
                    index * 20,
                    method,
                    ["designer-professor-source"],
                )
                for index, (name, _, method) in enumerate(actions)
            ],
        )
    )

    professor = actions[0][1]
    player_c = embed(rgba(PLAYER_C), 2, 0)
    ghost_c = embed(rgba(QUANTMAN_GHOST_C), 2, 4)
    quarry_d, quarry_d_rect = manifested_quarry_duck_frame()
    morph_inputs = [
        (
            "qong-paddle-to-professor",
            normalize(rgba(QONG_PADDLE)),
            professor,
            ["qong-paddle", "designer-professor-source"],
            "exact-qong-paddle-endpoint",
            "exact-professor-pipe-idle-endpoint",
        ),
        (
            "qong-paddle-to-player-c",
            normalize(rgba(QONG_PADDLE)),
            player_c,
            ["qong-paddle", "player-c-source"],
            "exact-qong-paddle-endpoint",
            "source-locked-16x20-center-bottom-embed:x=2:y=0",
        ),
        (
            "quantman-ghost-c-to-professor",
            ghost_c,
            professor,
            ["quantman-ghost-c", "designer-professor-source"],
            "source-locked-16x16-center-bottom-embed:x=2:y=4",
            "exact-professor-pipe-idle-endpoint",
        ),
        (
            "quarry-duck-d-to-professor",
            quarry_d,
            professor,
            ["quarry-duck-d-right-idle", "designer-professor-source"],
            "exact-manifested-d-right-idle-frame",
            "exact-professor-pipe-idle-endpoint",
        ),
    ]
    morph_descriptors: list[dict[str, object]] = []
    for morph_id, start, end, parents, start_method, end_method in morph_inputs:
        frames = morph_frames(start, end)
        path = ASSETS / f"{morph_id}-strip-20x20.png"
        save(strip(frames), path)
        methods = [
            start_method,
            *("manhattan-signed-distance-threshold-morph-v1" for _ in range(5)),
            end_method,
        ]
        records.append(
            runtime_record(
                morph_id,
                f"assets/{path.name}",
                "runtime-morph-strip",
                [
                    frame_record(
                        f"morph-{index}",
                        index,
                        index * 20,
                        methods[index],
                        parents,
                    )
                    for index in range(MORPH_FRAME_COUNT)
                ],
            )
        )
        morph_descriptors.append(
            {
                "morphId": morph_id,
                "outputFileId": morph_id,
                "frameCount": MORPH_FRAME_COUNT,
                "frameDurationMs": 100,
                "method": "manhattan-signed-distance-threshold-morph-v1",
                "parents": parents,
                "startEndpointMethod": start_method,
                "endEndpointMethod": end_method,
            }
        )

    source_manifest = {
        "schemaVersion": "quantum-box-designer-professor-source-manifest-v1",
        "date": "2026-09-05",
        "sourceMutation": "prohibited",
        "authoringMethod": (
            "Deterministic local pixel operations over exact approved sources; "
            "no image generation, QPixl, QPU, QuantumBlur, or network operation."
        ),
        "selectionAuthority": {
            "path": repo_locator(QUARRY_RUNTIME_HANDOFF),
            "sha256": sha256(QUARRY_RUNTIME_HANDOFF),
            "fileId": QUARRY_DUCK_FILE_ID,
            "frameId": QUARRY_DUCK_FRAME_ID,
        },
        "sources": [
            {
                **source_record(
                    "designer-professor-source",
                    "User-selected Designer Professor base frame",
                    "user-selected-source",
                    PROFESSOR_SOURCE_COPY,
                ),
                "originalProjectLocator": PROFESSOR_ORIGINAL_LOCATOR,
            },
            source_record(
                "qong-paddle",
                "Canonical Qong paddle morph endpoint",
                "existing-runtime-source",
                QONG_PADDLE,
            ),
            source_record(
                "player-c-source",
                "Canonical walking-player morph endpoint",
                "existing-runtime-source",
                PLAYER_C,
            ),
            source_record(
                "quantman-ghost-c",
                "Canonical Quantman Ghost C morph endpoint",
                "existing-runtime-source",
                QUANTMAN_GHOST_C,
            ),
            source_record(
                "quarry-duck-d-right-idle",
                "Current crested Quarry Duck D right-idle morph endpoint",
                "existing-runtime-source",
                QUARRY_DUCK_STRIP,
                crop=quarry_d_rect,
            ),
        ],
    }
    write_json(MANIFESTS / "source-manifest.json", source_manifest)

    morph_manifest = {
        "schemaVersion": "quantum-box-designer-professor-morph-descriptors-v1",
        "date": "2026-09-05",
        "endpointContract": "exact-source-and-target-frame-lock",
        "alphaContract": "binary-only-0-or-255",
        "scalingContract": "integer-nearest-neighbour-only",
        "descriptors": morph_descriptors,
    }
    write_json(MANIFESTS / "morph-descriptors-v1.json", morph_manifest)

    runtime_manifest = {
        "schemaVersion": "quantum-box-designer-professor-runtime-handoff-v1",
        "date": "2026-09-05",
        "status": "deterministic-local-runtime-handoff",
        "logicalResolution": {"width": 320, "height": 180},
        "palette": {
            "darkTobacco": "#2B1C14",
            "mutedTan": "#564330",
            "warmCream": "#D6BD8B",
        },
        "alphaContract": "binary-only-0-or-255",
        "scalingContract": "integer-nearest-neighbour-only",
        "sourceManifest": {
            "relativePath": "manifests/source-manifest.json",
            "sha256": sha256(MANIFESTS / "source-manifest.json"),
        },
        "morphDescriptors": {
            "relativePath": "manifests/morph-descriptors-v1.json",
            "sha256": sha256(MANIFESTS / "morph-descriptors-v1.json"),
        },
        "runtimeFiles": records,
    }
    write_json(MANIFESTS / "runtime-handoff.json", runtime_manifest)


def audit() -> None:
    runtime = json.loads((MANIFESTS / "runtime-handoff.json").read_text())
    sources = json.loads((MANIFESTS / "source-manifest.json").read_text())
    selection_authority = sources["selectionAuthority"]
    if (
        selection_authority["fileId"] != QUARRY_DUCK_FILE_ID
        or selection_authority["frameId"] != QUARRY_DUCK_FRAME_ID
        or selection_authority["path"] != repo_locator(QUARRY_RUNTIME_HANDOFF)
        or selection_authority["sha256"] != sha256(QUARRY_RUNTIME_HANDOFF)
    ):
        raise ValueError("Quarry morph selection authority drifted")
    for source in sources["sources"]:
        path = resolve_repo_locator(source["path"])
        if not path.is_file() or sha256(path) != source["sha256"]:
            raise ValueError(f"Professor source drifted: {source['sourceId']}")
    if sha256(MANIFESTS / "source-manifest.json") != runtime["sourceManifest"]["sha256"]:
        raise ValueError("Professor source manifest hash drifted")
    if (
        sha256(MANIFESTS / "morph-descriptors-v1.json")
        != runtime["morphDescriptors"]["sha256"]
    ):
        raise ValueError("Professor morph descriptor hash drifted")
    if runtime["palette"] != {
        "darkTobacco": "#2B1C14",
        "mutedTan": "#564330",
        "warmCream": "#D6BD8B",
    }:
        raise ValueError("Professor palette contract drifted")
    for record in runtime["runtimeFiles"]:
        path = PACKAGE / record["relativePath"]
        if sha256(path) != record["sha256"]:
            raise ValueError(f"Professor asset hash drifted: {record['fileId']}")
        image = normalize(rgba(path))
        if [image.width, image.height] != [
            record["dimensions"]["width"],
            record["dimensions"]["height"],
        ]:
            raise ValueError(f"Professor asset dimensions drifted: {record['fileId']}")
        for frame in record["frames"]:
            rect = frame["rect"]
            if rect["y"] != 0 or rect["width"] != 20 or rect["height"] != 20:
                raise ValueError(f"Professor frame geometry drifted: {frame['frameId']}")
            if rect["x"] + 20 > image.width:
                raise ValueError(f"Professor frame exceeds strip: {frame['frameId']}")

    if (
        PROFESSOR_ORIGINAL_SOURCE.is_file()
        and PROFESSOR_SOURCE_COPY.read_bytes()
        != PROFESSOR_ORIGINAL_SOURCE.read_bytes()
    ):
        raise ValueError("Professor approved source copy drifted")

    professor = rgba(ASSETS / "professor-pipe-idle-20x20.png")
    expected_endpoints = {
        "qong-paddle-to-professor": (
            normalize(rgba(QONG_PADDLE)),
            professor,
        ),
        "qong-paddle-to-player-c": (
            normalize(rgba(QONG_PADDLE)),
            embed(rgba(PLAYER_C), 2, 0),
        ),
        "quantman-ghost-c-to-professor": (
            embed(rgba(QUANTMAN_GHOST_C), 2, 4),
            professor,
        ),
        "quarry-duck-d-to-professor": (
            manifested_quarry_duck_frame()[0],
            professor,
        ),
    }
    morphs = json.loads((MANIFESTS / "morph-descriptors-v1.json").read_text())
    for descriptor in morphs["descriptors"]:
        strip_image = rgba(ASSETS / f"{descriptor['morphId']}-strip-20x20.png")
        if strip_image.size != (140, 20):
            raise ValueError(f"Morph strip geometry drifted: {descriptor['morphId']}")
        expected_start, expected_end = expected_endpoints[descriptor["morphId"]]
        if list(strip_image.crop((0, 0, 20, 20)).getdata()) != list(
            expected_start.getdata()
        ):
            raise ValueError(f"Morph start endpoint drifted: {descriptor['morphId']}")
        if list(strip_image.crop((120, 0, 140, 20)).getdata()) != list(
            expected_end.getdata()
        ):
            raise ValueError(f"Morph end endpoint drifted: {descriptor['morphId']}")


if __name__ == "__main__":
    if sys.argv[1:] not in ([], ["--audit-only"]):
        raise SystemExit("usage: generate_assets.py [--audit-only]")
    if "--audit-only" not in sys.argv:
        build()
    audit()
    print("Designer Professor assets: PASS")
