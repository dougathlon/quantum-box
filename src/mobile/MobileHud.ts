export interface MobileHudContent {
  readonly title: string;
  readonly meta: string;
  readonly scores: readonly string[];
  readonly status?: string;
  readonly detail?: string;
}

/** Readable mobile mirror of the existing public HUD. It owns no game state. */
export class MobileHud {
  private readonly element: HTMLElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly scores: readonly HTMLElement[];
  private readonly status: HTMLElement;
  private readonly detail: HTMLElement;

  public constructor(root: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "qb-mobile-hud";
    // The original semantic HUD already provides the screen-reader content.
    this.element.setAttribute("aria-hidden", "true");
    this.element.innerHTML = `<div class="qb-mobile-hud-heading"><strong></strong><span></span></div><div class="qb-mobile-hud-scores">${"<span></span>".repeat(4)}</div><p class="qb-mobile-hud-status"></p><p class="qb-mobile-hud-detail"></p>`;
    this.title = this.element.querySelector("strong")!;
    this.meta = this.element.querySelector(".qb-mobile-hud-heading span")!;
    this.scores = [
      ...this.element.querySelectorAll<HTMLElement>(
        ".qb-mobile-hud-scores span",
      ),
    ];
    this.status = this.element.querySelector(".qb-mobile-hud-status")!;
    this.detail = this.element.querySelector(".qb-mobile-hud-detail")!;
    root.append(this.element);
  }

  public update(cabinet: string, content: MobileHudContent): void {
    this.element.dataset["cabinet"] = cabinet;
    setText(this.title, content.title);
    setText(this.meta, content.meta);
    this.scores.forEach((element, index) => {
      const score = content.scores[index];
      element.hidden = score === undefined;
      setText(element, score ?? "");
    });
    setText(this.status, content.status ?? "");
    setText(this.detail, content.detail ?? "");
  }
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
