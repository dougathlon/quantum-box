import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync("src/game/ScreenScene.ts", "utf8");
const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const appSource = readFileSync("src/app/QuantumBoxApp.ts", "utf8");
const recoverySource = readFileSync("src/tutorials/recovery.ts", "utf8");
const legacyLessonSource = readFileSync(
  "src/story/QongDesignerLesson.ts",
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

  it("keeps a no-save-mutation Story v2 presentation QA route", () => {
    expect(appSource).toContain('route?.startsWith("story-v2-")');
    expect(appSource).toContain("openStoryV2PresentationForQa(");
    const qaMethod = appSource.slice(
      appSource.indexOf("private async openStoryV2PresentationForQa("),
      appSource.indexOf("private handleCabinetAction("),
    );
    expect(qaMethod).toContain("new StoryV2PresentationMachine(");
    expect(qaMethod).toContain("stageId, null, evidence");
    expect(qaMethod).toContain("this.shell.showStoryPresentation(");
    expect(qaMethod).not.toContain("saveRepository");
  });

  it("retains historical recovery and legacy lesson source for migration", () => {
    expect(recoverySource).toContain("TUTORIAL_RECOVERY_SCHEMA_VERSION");
    expect(recoverySource).toContain("validateTutorialRecoveryRecord");
    expect(legacyLessonSource).toContain("export class QongDesignerLesson");
  });
});
