export class DeveloperAudit {
  private readonly panel: HTMLPreElement;

  public constructor(root: HTMLElement) {
    this.panel = document.createElement("pre");
    this.panel.className = "qb-developer-audit";
    this.panel.dataset["ui"] = "developer-belief-audit";
    this.panel.setAttribute("aria-hidden", "true");
    this.panel.inert = true;
    root.append(this.panel);
  }

  public update(label: string, evidence: unknown): void {
    this.panel.hidden = false;
    this.panel.textContent = `DEVELOPER BELIEF AUDIT · ${label}\n${JSON.stringify(evidence, null, 2)}`;
  }

  public clear(): void {
    this.panel.hidden = true;
    this.panel.textContent = "";
  }

  public destroy(): void {
    this.panel.remove();
  }
}
