import {
  terminalGlyphRects,
  terminalTextWidth,
} from "../display/TerminalTypeface";
import fieldUrl from "../assets/brown-box/background-programs/current-four-state-v1/state-01.png";
import "./computerNotice.css";

export const PUBLIC_GAME_URL = "https://dougathlon.github.io/quantum-box/";

export function showComputerNotice(): void {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Quantum Box requires an #app root element.");
  document.documentElement.classList.add("qb-computer-notice");
  root.innerHTML = `<main aria-label="Quantum Box requires a computer">
    <canvas aria-hidden="true"></canvas>
    <h1 class="qb-notice-accessible">QUANTUM BOX</h1>
    <p class="qb-notice-accessible">PLEASE PLAY ON A COMPUTER.</p>
    <p class="qb-notice-accessible">QUANTUM BOX REQUIRES A DESKTOP OR LAPTOP WITH A KEYBOARD OR CONTROLLER.</p>
    <p class="qb-notice-accessible">OPEN THIS SAME LINK ON YOUR COMPUTER.</p>
    <button type="button" aria-label="Copy game link">COPY LINK</button>
    <p class="qb-notice-accessible" role="status"></p>
    <p class="qb-notice-link" hidden>${PUBLIC_GAME_URL}</p>
  </main>`;
  const surface = root.querySelector("main")!;
  const canvas = root.querySelector("canvas")!;
  const context = canvas.getContext("2d");
  const button = root.querySelector("button")!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const fallbackLink = root.querySelector<HTMLElement>(".qb-notice-link")!;
  const field = new Image();
  let copied = false;

  const draw = (): void => {
    if (!context) {
      surface.setAttribute("data-canvas-unavailable", "");
      canvas.hidden = true;
      return;
    }
    const width = Math.round(surface.clientWidth);
    const height = Math.round(surface.clientHeight);
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#2b1c14";
    context.fillRect(0, 0, width, height);
    if (field.complete && field.naturalWidth) {
      const pattern = context.createPattern(field, "repeat");
      if (pattern) {
        pattern.setTransform(new DOMMatrix().scale(2));
        context.fillStyle = pattern;
        context.fillRect(0, 0, width, height);
      }
    }
    const text = (value: string, y: number, size = 2): void => {
      const x = Math.round((width - terminalTextWidth(value) * size) / 2);
      context.fillStyle = "#d6bd8b";
      for (const rect of terminalGlyphRects(value))
        context.fillRect(
          x + rect.x * size,
          y + rect.y * size,
          rect.width * size,
          rect.height * size,
        );
    };
    context.strokeStyle = "#d6bd8b";
    context.lineWidth = 2;
    context.strokeRect(15, 15, width - 30, height - 30);
    text("QUANTUM BOX", 48, 3);
    context.fillStyle = "#d6bd8b";
    context.fillRect(36, 94, width - 72, 2);
    const y = Math.max(140, Math.round(height * 0.27));
    text("PLEASE PLAY ON", y, 3);
    text("A COMPUTER.", y + 32, 3);
    text("QUANTUM BOX REQUIRES", y + 106);
    text("A DESKTOP OR LAPTOP", y + 130);
    if (terminalTextWidth("WITH A KEYBOARD OR CONTROLLER.") * 2 <= width - 48) {
      text("WITH A KEYBOARD OR CONTROLLER.", y + 154);
    } else {
      text("WITH A KEYBOARD", y + 154);
      text("OR CONTROLLER.", y + 178);
    }
    text("OPEN THIS SAME LINK", y + 222);
    text("ON YOUR COMPUTER.", y + 246);
    context.fillStyle = "#d6bd8b";
    context.fillRect(36, height - 104, width - 72, 1);
    text(copied ? "LINK COPIED" : "COPY LINK", height - 73);
  };
  const observer = new ResizeObserver(draw);
  observer.observe(surface);
  field.onload = draw;
  field.src = fieldUrl;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_GAME_URL);
      copied = true;
      button.setAttribute("aria-label", "Link copied");
      status.textContent = "Link copied.";
      fallbackLink.hidden = true;
      draw();
    } catch {
      status.textContent =
        "Copy unavailable. Select and copy the address below.";
      fallbackLink.hidden = false;
    }
  });
  window.addEventListener("pagehide", () => observer.disconnect(), {
    once: true,
  });
  window.addEventListener("pageshow", () => observer.observe(surface));
  draw();
}
