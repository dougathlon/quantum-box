import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESIGNER_PROFESSOR_MANIFEST_HASHES,
  DESIGNER_PROFESSOR_RUNTIME_ASSETS,
  requireDesignerProfessorFrame,
  resolveStoryV2AssetCue,
} from "../../src/assets/designer-professor/DesignerProfessorAssets";
import {
  STORY_TERMINALS,
  STORY_V2_PRESENTATION_FLOWS,
  storyTerminalPage,
} from "../../src/story/v2";

const packageRoot = resolve("src/assets/designer-professor");
const sourceManifestPath = resolve(
  packageRoot,
  "manifests/source-manifest.json",
);
const morphManifestPath = resolve(
  packageRoot,
  "manifests/morph-descriptors-v1.json",
);
const runtimeManifestPath = resolve(
  packageRoot,
  "manifests/runtime-handoff.json",
);
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("Story v2 terminal source boundaries", () => {
  it("keeps every Story terminal provider-free during active play", () => {
    for (const terminal of Object.values(STORY_TERMINALS)) {
      expect(terminal.pages.map((page) => page.heading)).toEqual(
        expect.arrayContaining(["INPUT", "RETURN", "GAME MAPPING"]),
      );
      for (const page of terminal.pages) {
        expect(page.activePlayNetwork).toBe("none");
        expect(storyTerminalPage(page.id)).toBe(page);
      }
    }
  });

  it("identifies Quantman gameplay as an installed IBM Fez Labyrinth return", () => {
    expect(STORY_TERMINALS.quantman.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "quantman-input",
          sourceStatus: "recorded-moth-qpu",
          gameplayAuthority: true,
        }),
        expect.objectContaining({
          id: "quantman-return",
          sourceStatus: "recorded-moth-qpu",
          gameplayAuthority: true,
        }),
        expect.objectContaining({
          id: "quantman-source",
          sourceStatus: "recorded-moth-qpu",
          evidenceBinding: "quantman-qpu-mode-receipt",
          gameplayAuthority: true,
        }),
      ]),
    );
    expect(JSON.stringify(STORY_TERMINALS.quantman)).toContain("IBM FEZ");
    expect(JSON.stringify(STORY_TERMINALS.quantman)).toContain(
      "TWO INDEPENDENT IBM FEZ EXECUTIONS",
    );
    expect(JSON.stringify(STORY_TERMINALS.quantman)).toContain(
      "NEVER REPAIRS OR FABRICATES A BIT OR WALL",
    );
  });

  it("identifies Quarry and Fluxball as separate recorded QGraph banks", () => {
    expect(STORY_TERMINALS.quarry.pages.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ heading: "INPUT", gameplayAuthority: true }),
        expect.objectContaining({ heading: "RETURN", gameplayAuthority: true }),
        expect.objectContaining({
          heading: "GAME MAPPING",
          gameplayAuthority: true,
        }),
      ]),
    );
    expect(STORY_TERMINALS.quarry.pages[3]).toEqual(
      expect.objectContaining({
        id: "quarry-contrast",
        sourceStatus: "recorded-moth-qpu",
        evidenceBinding: "quarry-qpu-schedule-receipt",
        gameplayAuthority: true,
      }),
    );
    expect(
      STORY_TERMINALS.fluxball.pages.every(
        (page) => page.sourceStatus === "recorded-moth-qpu",
      ),
    ).toBe(true);
    expect(JSON.stringify(STORY_TERMINALS.quarry)).toContain(
      "QUARRY USES ITS OWN 24 12-QUBIT RETURNS",
    );
    expect(JSON.stringify(STORY_TERMINALS.quarry)).toContain(
      "EACH 12-SECOND PHASE",
    );
    expect(JSON.stringify(STORY_TERMINALS.quarry)).not.toContain("15-SECOND");
  });
});

describe("Designer Professor v1 assets", () => {
  it("locks source, morph, and runtime manifests to exact hashes", () => {
    expect(sha256(sourceManifestPath)).toBe(
      DESIGNER_PROFESSOR_MANIFEST_HASHES.sourceManifest,
    );
    expect(sha256(morphManifestPath)).toBe(
      DESIGNER_PROFESSOR_MANIFEST_HASHES.morphDescriptors,
    );
    expect(sha256(runtimeManifestPath)).toBe(
      DESIGNER_PROFESSOR_MANIFEST_HASHES.runtimeHandoff,
    );
  });

  it("passes the deterministic palette, alpha, geometry, and endpoint audit without rebuilding", () => {
    expect(
      execFileSync(
        "python3",
        [resolve(packageRoot, "generate_assets.py"), "--audit-only"],
        { encoding: "utf8" },
      ),
    ).toContain("Designer Professor assets: PASS");
  }, 20_000);

  it("ships the professor action family and four true-morph strips", () => {
    expect(DESIGNER_PROFESSOR_RUNTIME_ASSETS).toHaveLength(12);
    expect(
      requireDesignerProfessorFrame("professor-action-strip", "walk-a"),
    ).toBeTruthy();
    expect(
      requireDesignerProfessorFrame("professor-action-strip", "talk-b"),
    ).toBeTruthy();
    expect(
      requireDesignerProfessorFrame("qong-paddle-to-professor", "morph-6"),
    ).toBeTruthy();
    expect(
      requireDesignerProfessorFrame("quarry-duck-d-to-professor", "morph-0"),
    ).toBeTruthy();
  });

  it("resolves every presentation cue without guessing asset identity", () => {
    expect(resolveStoryV2AssetCue("professor-walk")).toEqual({
      source: "designer-professor-v1",
      fileId: "professor-action-strip",
      frameIds: ["walk-a", "walk-b"],
    });
    expect(resolveStoryV2AssetCue("player-c-front-idle")).toEqual({
      source: "canonical-runtime-v2",
      fileId: "player-c-four-direction-walk-strip",
      frameIds: ["front-idle"],
    });
    for (const flow of Object.values(STORY_V2_PRESENTATION_FLOWS)) {
      for (const beat of flow.beats) {
        if (beat.assetCue) {
          expect(
            resolveStoryV2AssetCue(beat.assetCue).frameIds.length,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
