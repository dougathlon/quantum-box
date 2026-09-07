import { describe, expect, it } from "vitest";
import {
  STORY_V2_PRESENTATION_FLOWS,
  STORY_V2_STAGE_SEQUENCE,
  StoryV2PresentationMachine,
  parseStoryV2ResumeToken,
  storyV2SceneKind,
  storyV2SpritePlayback,
  type StoryV2PresentationCompletion,
  type StoryV2ResumeToken,
} from "../../src/story/v2";

function finish(
  machine: StoryV2PresentationMachine,
): StoryV2PresentationCompletion {
  for (;;) {
    const result = machine.dispatch("continue");
    if (result.completion) return result.completion;
  }
}

describe("Story v2 deterministic presentation machine", () => {
  it("provides one exact, non-empty presentation flow per qualified stage", () => {
    expect(Object.keys(STORY_V2_PRESENTATION_FLOWS)).toHaveLength(8);
    for (const stageId of STORY_V2_STAGE_SEQUENCE) {
      const machine = new StoryV2PresentationMachine(stageId);
      const snapshot = machine.snapshot();
      expect(snapshot.stageId).toBe(stageId);
      expect(snapshot.beatIndex).toBe(0);
      expect(snapshot.beatCount).toBeGreaterThan(0);
      expect(snapshot.beat).not.toBeNull();
      expect(snapshot.resumeToken?.beatId).toBe(snapshot.beat?.id);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.beat)).toBe(true);
    }
  });

  it("teaches Qong from request through stored result and play boundary in order", () => {
    const qong = STORY_V2_PRESENTATION_FLOWS["qong-den"];
    expect(
      qong.beats
        .filter((beat) => beat.kind === "terminal")
        .map((beat) => beat.terminalPageId),
    ).toEqual([
      "qong-input",
      "qong-zero",
      "qong-hadamard",
      "qong-measure",
      "qong-return",
      "qong-mapping",
      "qong-play",
    ]);
  });

  it("resumes at the exact pending beat instead of replaying the cleared game", () => {
    const original = new StoryV2PresentationMachine("qong");
    original.dispatch("continue");
    original.dispatch("continue");
    const pending = original.snapshot();
    expect(pending.beat?.id).toBe("qong-well-done");

    const resumed = new StoryV2PresentationMachine(
      "qong",
      pending.resumeToken,
    ).snapshot();
    expect(resumed.beat).toEqual(pending.beat);
    expect(resumed.beatIndex).toBe(pending.beatIndex);
  });

  it("rejects foreign, stale, or invented resume identity", () => {
    const valid = new StoryV2PresentationMachine("skipixl").snapshot()
      .resumeToken as StoryV2ResumeToken;
    expect(
      () => new StoryV2PresentationMachine("fluxball-four", valid),
    ).toThrow("resume token identity does not match");
    expect(
      () =>
        new StoryV2PresentationMachine("skipixl", {
          ...valid,
          beatId: "not-a-real-beat",
        }),
    ).toThrow("resume beat is not");
    expect(parseStoryV2ResumeToken(valid)).toEqual(valid);
    expect(() =>
      parseStoryV2ResumeToken({ ...valid, stageId: "quag" }),
    ).toThrow("unknown stage");
    expect(() =>
      parseStoryV2ResumeToken({ ...valid, beatId: "not-a-real-beat" }),
    ).toThrow("not valid for its stage");
  });

  it("launches paired stages directly and returns completed chapters to menu", () => {
    expect(finish(new StoryV2PresentationMachine("skipixl-medium"))).toEqual({
      kind: "launch-stage",
      completedStageId: "skipixl-medium",
      nextStageId: "skipixl",
    });
    expect(finish(new StoryV2PresentationMachine("fluxball-two"))).toEqual({
      kind: "launch-stage",
      completedStageId: "fluxball-two",
      nextStageId: "fluxball-four",
    });
    expect(
      finish(new StoryV2PresentationMachine("quantman-stabilize")),
    ).toEqual({
      kind: "launch-stage",
      completedStageId: "quantman-stabilize",
      nextStageId: "quantman",
    });
    expect(finish(new StoryV2PresentationMachine("fluxball-four"))).toEqual({
      kind: "return-to-menu",
      completedStageId: "fluxball-four",
      completedChapterId: "fluxball",
      workshopEngineId: "graph-v1",
    });
  });

  it("completes Quarry once and gates the external MOTH link behind the finale", () => {
    const machine = new StoryV2PresentationMachine("quarry");
    expect(finish(machine)).toEqual({
      kind: "complete-story",
      completedStageId: "quarry",
      completedChapterId: "quarry",
      workshopEngineId: "graph-v1",
      unlockExternalLinkId: "moth-platform",
    });
    const repeated = machine.dispatch("continue");
    expect(repeated.completion).toBeNull();
    expect(repeated.snapshot.completed).toBe(true);
    expect(repeated.snapshot.beat).toBeNull();
    expect(repeated.snapshot.resumeToken).toBeNull();
  });

  it("contains the specified physical transitions and restrained copy beats", () => {
    const serialized = JSON.stringify(STORY_V2_PRESENTATION_FLOWS);
    expect(serialized).toContain("I DID NOT BUILD MOTH OR ITS ENGINES");
    expect(serialized).toContain("OPAQUE KEY");
    expect(serialized).toContain(
      "IT MAY NOT HAVE WORKED OUT PARTICULARLY WELL",
    );
    expect(serialized).toContain("MOTH PLATFORM LINK READY");
    expect(serialized).not.toContain("ACCESS CODE");
    expect(serialized).not.toContain("CHANGES SHAPE");
    expect(serialized).not.toContain("GHOST C STOPS");
    expect(serialized).not.toContain("THE CRESTED D DUCK");
    for (const flow of Object.values(STORY_V2_PRESENTATION_FLOWS)) {
      for (const beat of flow.beats) {
        if (
          ["morph", "door", "dismount", "transport", "explore"].includes(
            beat.kind,
          )
        ) {
          expect(beat.lines, beat.id).toEqual([]);
        }
      }
    }
  });

  it("keeps each transition in its established world until the terminal takes over", () => {
    const expectedScenes = {
      "qong-well-done": "field",
      "qong-den-method": "den",
      "qong-terminal-qong-return": "den",
      "skipixl-hard-cabin-door": "slope",
      "skipixl-hard-enter-office": "office",
      "skipixl-terminal-skipixl-input": "office",
      "fluxball-four-designer-ball": "field",
      "fluxball-four-ball-touch": "field",
      "fluxball-four-enter-office": "office",
      "fluxball-terminal-fluxball-input": "office",
      "quantman-ghost-den-walk": "ghost-den",
      "quantman-ghost-den-office": "office",
      "quantman-terminal-quantman-input": "office",
      "quarry-designer-walk-offscreen": "workshop",
      "quarry-final-workshop": "workshop",
      "quarry-terminal-quarry-input": "workshop",
      "quarry-moth-link": "workshop",
    } as const;

    for (const [beatId, expectedScene] of Object.entries(expectedScenes)) {
      const flow = Object.values(STORY_V2_PRESENTATION_FLOWS).find(
        (candidate) => candidate.beats.some((beat) => beat.id === beatId),
      );
      const beat = flow?.beats.find((candidate) => candidate.id === beatId);
      expect(flow, beatId).toBeDefined();
      expect(beat, beatId).toBeDefined();
      expect(storyV2SceneKind(flow!.id, beat!), beatId).toBe(expectedScene);
    }
  });

  it("plays true morphs once while walk and talk strips retain their own cadence", () => {
    const beats = Object.values(STORY_V2_PRESENTATION_FLOWS).flatMap(
      (flow) => flow.beats,
    );
    expect(
      storyV2SpritePlayback(
        beats.find((beat) => beat.id === "qong-opponent-paddle-morph")!,
      ),
    ).toBe("morph-once");
    expect(
      storyV2SpritePlayback(
        beats.find((beat) => beat.id === "qong-walk-to-den")!,
      ),
    ).toBe("still");
    expect(
      storyV2SpritePlayback(
        beats.find((beat) => beat.id === "qong-well-done")!,
      ),
    ).toBe("talk-loop");
    expect(
      storyV2SpritePlayback(
        beats.find((beat) => beat.id === "qong-open-door")!,
      ),
    ).toBe("still");
  });
});
