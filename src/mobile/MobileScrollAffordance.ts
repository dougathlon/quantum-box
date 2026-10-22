/** The same visible scroll cues serve menus, settings and terminal reading. */
export class MobileScrollAffordance {
  private readonly controls: HTMLElement;
  private readonly track: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly up: HTMLButtonElement;
  private readonly down: HTMLButtonElement;
  private readonly contentObserver: MutationObserver;
  private readonly modeObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private target: HTMLElement | null = null;
  private frameId = 0;
  private mobile = document.documentElement.dataset["mobile"] === "true";
  private disposed = false;

  public constructor(
    private readonly shell: HTMLElement,
    private readonly frame: HTMLElement,
    private readonly page: HTMLElement,
  ) {
    this.controls = document.createElement("nav");
    this.controls.className = "qb-mobile-scroll-controls";
    this.controls.setAttribute("aria-label", "Scroll content");
    this.controls.hidden = true;
    this.controls.innerHTML = `<button type="button" aria-label="Scroll up">↑</button><button type="button" aria-label="Scroll down to see more">MORE ↓</button>`;
    [this.up, this.down] = [
      this.controls.querySelectorAll("button")[0]!,
      this.controls.querySelectorAll("button")[1]!,
    ];
    this.track = document.createElement("div");
    this.track.className = "qb-mobile-scroll-track";
    this.track.setAttribute("aria-hidden", "true");
    this.track.hidden = true;
    this.thumb = document.createElement("i");
    this.track.append(this.thumb);
    frame.append(this.track, this.controls);
    this.up.addEventListener("click", () => this.scroll(-1));
    this.down.addEventListener("click", () => this.scroll(1));
    frame.addEventListener("scroll", this.schedule, true);
    this.contentObserver = new MutationObserver(this.schedule);
    this.contentObserver.observe(page, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.contentObserver.observe(shell, {
      attributes: true,
      attributeFilter: ["data-view", "data-page", "data-surface"],
    });
    this.modeObserver = new MutationObserver(() => {
      const mobile = document.documentElement.dataset["mobile"] === "true";
      if (mobile === this.mobile) return;
      this.mobile = mobile;
      this.schedule();
    });
    this.modeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mobile"],
    });
    this.resizeObserver = new ResizeObserver(this.schedule);
    this.resizeObserver.observe(frame);
    this.resizeObserver.observe(page);
    void document.fonts.ready.then(this.schedule);
    this.schedule();
  }

  private readonly schedule = (): void => {
    if (!this.disposed && !this.frameId)
      this.frameId = requestAnimationFrame(this.update);
  };

  private readonly update = (): void => {
    this.frameId = 0;
    const candidates = [
      ...this.page.querySelectorAll<HTMLElement>(
        ".qb-terminal-body, .qb-settings-scroll, .qb-arcade-tutorial, [data-scroll-list]",
      ),
      this.page,
    ];
    const target =
      this.mobile &&
      this.shell.dataset["surface"] === "internal" &&
      this.shell.dataset["view"] !== "cabinet"
        ? (candidates.find(
            (element) =>
              element.clientHeight > 0 &&
              element.scrollHeight > element.clientHeight + 2 &&
              /auto|scroll/.test(getComputedStyle(element).overflowY),
          ) ?? null)
        : null;
    if (target !== this.target) {
      if (this.target && this.target !== this.page)
        this.resizeObserver.unobserve(this.target);
      this.target = target;
      if (target) this.resizeObserver.observe(target);
    }
    this.controls.hidden = !target;
    this.track.hidden = !target;
    if (!target) return;
    const maximum = target.scrollHeight - target.clientHeight;
    const position = Math.max(0, Math.min(maximum, target.scrollTop));
    this.up.hidden = position < 2;
    this.down.hidden = maximum - position < 2;
    const frameRect = this.frame.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const height = target.clientHeight;
    const thumbHeight = Math.min(
      height,
      Math.max(16, (height / target.scrollHeight) * height),
    );
    this.track.style.top = `${rect.top - frameRect.top}px`;
    this.track.style.left = `${Math.min(frameRect.width - 12, rect.right - frameRect.left - 6)}px`;
    this.track.style.height = `${height}px`;
    this.thumb.style.height = `${thumbHeight}px`;
    this.thumb.style.top = `${(position / maximum) * (height - thumbHeight)}px`;
  };

  private scroll(direction: -1 | 1): void {
    if (!this.target) return;
    const maximum = this.target.scrollHeight - this.target.clientHeight;
    let next =
      this.target.scrollTop +
      direction * Math.max(44, this.target.clientHeight * 0.8);
    // Avoid an extra tap just to expose the last few pixels of a row.
    if (direction > 0 && maximum - next < 24) next = maximum;
    if (direction < 0 && next < 24) next = 0;
    this.target.scrollTo({
      top: next,
      behavior: "instant",
    });
    this.schedule();
  }

  public destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.contentObserver.disconnect();
    this.modeObserver.disconnect();
    this.resizeObserver.disconnect();
    this.frame.removeEventListener("scroll", this.schedule, true);
    this.controls.remove();
    this.track.remove();
  }
}
