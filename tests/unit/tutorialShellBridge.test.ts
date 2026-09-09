import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync("src/game/ScreenScene.ts", "utf8");
const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const appSource = readFileSync("src/app/QuantumBoxApp.ts", "utf8");
const recoverySource = readFileSync("src/tutorials/recovery.ts", "utf8");
const legacyEvidenceSource = readFileSync(
  "src/tutorials/legacyQongDesignerEvidence.ts",
  "utf8",
);

describe("legacy tutorial production boundary", () => {
  it("does not expose the spatial tutorial through the production scene", () => {
    expect(sceneSource).not.toContain("TutorialWorldView");
    expect(sceneSource).not.toContain("AnyTutorialRuntimeSnapshot");
    expect(sceneSource).not.toContain("showTutorialWorld");
  });

  it("does not mount legacy tutorial or Qong lesson markup in the shell", () => {
    for (const legacySurface of [
      "QongDesignerLesson",
      "AnyTutorialRuntimeSnapshot",
      'data-cabinet="tutorial-world"',
      "data-tutorial",
      'data-tutorial="designer-action"',
      "replay-tutorial",
      "dev-open-tutorial",
      'data-page="designer"',
    ]) {
      expect(shellSource).not.toContain(legacySurface);
    }
  });

  it("does not instantiate or navigate to legacy runtime surfaces in the app", () => {
    for (const legacyRuntime of [
      "QongDesignerLesson",
      "startTutorial(",
      "startTutorialReplay(",
      "beginTutorial(",
      "updateTutorial(",
      "openTutorialReplayForQa",
      "openDesignerLesson",
      "designer-skipixl",
      "designer-fluxball",
      "designer-quantman",
    ]) {
      expect(appSource).not.toContain(legacyRuntime);
    }
  });

  it("removes the obsolete Story v2 presentation route in favour of the terminal graph", () => {
    expect(appSource).not.toContain('route?.startsWith("story-v2-")');
    expect(appSource).not.toContain("openStoryV2PresentationForQa(");
    expect(appSource).toContain("presentCurrentStoryNode(");
    expect(shellSource).toContain('data-action="story-terminal-action"');
    expect(shellSource).toContain(
      'data-terminal-page="${escapeHtml(page.id)}"',
    );
  });

  it("retains historical recovery evidence without requiring the retired scene", () => {
    expect(recoverySource).toContain("TUTORIAL_RECOVERY_SCHEMA_VERSION");
    expect(recoverySource).toContain("validateTutorialRecoveryRecord");
    expect(legacyEvidenceSource).toContain("interface QongDesignerState");
    expect(legacyEvidenceSource).not.toContain("class QongDesignerLesson");
  });
});
