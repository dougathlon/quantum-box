import { normalizePixelText } from "./PixelText";
import { terminalTextWidth } from "./TerminalTypeface";

/** Presentation-only pages; the Story graph and authored source stay intact. */
export function readingPages(
  blocks: readonly string[],
  width = 282,
  height = 90,
): readonly (readonly string[])[] {
  const pages: string[][] = [[]];
  let used = 0;
  for (const block of blocks) {
    const lines: string[] = [];
    for (const authored of block.split("\n")) {
      let line = "";
      for (const word of authored.split(/\s+/).filter(Boolean)) {
        if (terminalTextWidth(normalizePixelText(word)) > width)
          throw new Error(`Reading word exceeds measure: ${word}`);
        const next = line ? `${line} ${word}` : word;
        if (line && terminalTextWidth(normalizePixelText(next)) > width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    let pending: string[] = [];
    const flush = () => {
      if (pending.length) {
        pages[pages.length - 1]!.push(pending.join("\n"));
        pending = [];
      }
    };
    if (
      used &&
      lines.length * 10 <= height &&
      used + 8 + lines.length * 10 > height
    ) {
      pages.push([]);
      used = 0;
    }
    if (used) used += 8;
    for (const line of lines) {
      if (used + 10 > height) {
        flush();
        pages.push([]);
        used = 0;
      }
      pending.push(line);
      used += 10;
    }
    flush();
  }
  return pages;
}
