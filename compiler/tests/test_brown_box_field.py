from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = PROJECT_ROOT / "src" / "assets" / "brown-box"
PROGRAMME_PATH = ASSET_ROOT / "qrt-four-state-programme-v1.json"


class BrownBoxFieldTests(unittest.TestCase):
    def setUp(self) -> None:
        self.programme = json.loads(PROGRAMME_PATH.read_text(encoding="utf-8"))

    def test_endpoint_integrity_dimensions_and_palette(self) -> None:
        self.assertEqual(self.programme["loopDurationMs"], 22_800)
        self.assertEqual(self.programme["loopFrameCount"], 228)
        self.assertEqual(len(self.programme["states"]), 4)
        expected_palette = {(43, 28, 20), (86, 67, 48)}
        for state in self.programme["states"]:
            path = ASSET_ROOT / state["fileName"]
            self.assertTrue(path.is_file(), state["fileName"])
            self.assertEqual(
                hashlib.sha256(path.read_bytes()).hexdigest(), state["sha256"]
            )
            with Image.open(path) as opened:
                image = opened.convert("RGB")
            self.assertEqual(image.size, (320, 180))
            self.assertEqual(set(image.getdata()), expected_palette)

    def test_all_discrete_runtime_transition_frames_remain_two_colour(self) -> None:
        images = []
        for state in self.programme["states"]:
            with Image.open(ASSET_ROOT / state["fileName"]) as opened:
                images.append(opened.convert("RGB").copy())
        expected_palette = {(43, 28, 20), (86, 67, 48)}
        hold = self.programme["holdFrameCount"]
        sweep_steps = self.programme["sweepStepCount"]
        logical_frames = []
        for index, current in enumerate(images):
            following = images[(index + 1) % len(images)]
            logical_frames.extend(current.copy() for _ in range(hold))
            for step in range(sweep_steps + 1):
                boundary = round(step * current.width / sweep_steps)
                frame = current.copy()
                if boundary:
                    frame.paste(
                        following.crop((0, 0, boundary, current.height)),
                        (0, 0),
                    )
                self.assertEqual(set(frame.getdata()), expected_palette)
                if boundary:
                    self.assertEqual(
                        list(frame.crop((0, 0, boundary, frame.height)).getdata()),
                        list(
                            following.crop(
                                (0, 0, boundary, frame.height)
                            ).getdata()
                        ),
                    )
                if boundary < frame.width:
                    self.assertEqual(
                        list(
                            frame.crop(
                                (boundary, 0, frame.width, frame.height)
                            ).getdata()
                        ),
                        list(
                            current.crop(
                                (boundary, 0, frame.width, frame.height)
                            ).getdata()
                        ),
                    )
                logical_frames.append(frame)
        self.assertEqual(len(logical_frames), self.programme["loopFrameCount"])


if __name__ == "__main__":
    unittest.main()
