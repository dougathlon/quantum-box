import type { ShippedArcadeCabinetId } from "../games/registry";
import { terminalTextWidth } from "../display/TerminalTypeface";
import { ARCADE_INSTRUCTIONS } from "./ArcadeInstructions";

/** Approved A compositions, measured on the 1280 × 720 reference screen. */
export interface ArcadeInstructionBlock {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export function arcadeInstructionLayout(id: ShippedArcadeCabinetId): {
  blocks: readonly ArcadeInstructionBlock[];
  divider: number;
} {
  const copy = ARCADE_INSTRUCTIONS[id];
  const blocks: ArcadeInstructionBlock[] = [];
  const paragraph = (text: string, x: number, y: number, width: number) => {
    let lines = 1,
      line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && terminalTextWidth(next, 3) > width) {
        lines++;
        line = word;
      } else line = next;
    }
    blocks.push({ text, x, y, width, height: (lines - 1) * 30 + 24 });
  };
  const labelled = (text: string, x: number, y: number, width: number) => {
    const colon = text.indexOf(":") + 1;
    paragraph(text.slice(0, colon), x, y, width);
    paragraph(text.slice(colon).trim(), x, y + 42, width);
  };
  const sentences = (text: string) =>
    text.match(/[^.!?]+[.!?]/g)!.map((s) => s.trim());
  let divider: number;
  switch (id) {
    case "qong":
      paragraph(copy[0]!, 66, 168, 1144);
      labelled(copy[1]!, 66, 220, 540);
      labelled(copy[2]!, 670, 220, 540);
      divider = 334;
      paragraph(copy[3]!, 66, 366, 540);
      paragraph(copy[4]!, 66, 420, 540);
      paragraph(copy[5]!, 670, 366, 540);
      paragraph(copy[6]!, 670, 442, 540);
      break;
    case "skipixl": {
      const objective = sentences(copy[0]!),
        movement = copy[1]!.split("\n"),
        timing = sentences(copy[2]!);
      paragraph(objective[0]!, 66, 168, 1144);
      paragraph(objective[1]!, 66, 216, 1144);
      divider = 278;
      paragraph(movement[0]!, 66, 326, 540);
      paragraph(movement[1]!, 66, 438, 540);
      paragraph(timing[0]!, 670, 326, 540);
      paragraph(timing[1]!, 670, 438, 540);
      break;
    }
    case "quantman":
      paragraph(copy[0]!, 66, 168, 1144);
      labelled(copy[1]!, 66, 226, 650);
      labelled(copy[2]!, 780, 226, 430);
      divider = 416;
      paragraph(copy[3]!, 66, 450, 1144);
      paragraph(copy[4]!, 66, 498, 1144);
      break;
    case "fluxball":
      paragraph(copy[0]!, 66, 168, 1144);
      labelled(copy[1]!, 66, 218, 344);
      labelled(copy[2]!, 466, 218, 344);
      labelled(copy[3]!, 866, 218, 344);
      divider = 364;
      paragraph(copy[4]!, 66, 392, 540);
      paragraph(copy[5]!, 670, 392, 540);
      paragraph(copy[6]!, 66, 458, 1144);
      paragraph(copy[7]!, 66, 502, 1144);
      break;
    case "quarry": {
      const technique = sentences(copy[1]!),
        movement = sentences(copy[2]!);
      paragraph(copy[0]!, 66, 168, 1144);
      paragraph(technique[0]!, 66, 248, 540);
      paragraph(technique[1]!, 66, 312, 540);
      paragraph(movement[0]!, 670, 248, 540);
      paragraph(movement[1]!, 670, 312, 540);
      divider = 392;
      paragraph(copy[3]!, 66, 430, 1144);
      paragraph(copy[4]!, 66, 492, 1144);
      break;
    }
  }
  return { blocks, divider };
}
