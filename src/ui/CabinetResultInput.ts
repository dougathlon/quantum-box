/** Give the final outcome time to appear before accepting another action. */
export const CABINET_RESULT_SETTLE_MS = 600;

export class CabinetResultInput {
  private completedAt: number | null = null;
  private settleMs = CABINET_RESULT_SETTLE_MS;

  public update(
    complete: boolean,
    now: number,
    settleMs = CABINET_RESULT_SETTLE_MS,
  ): void {
    this.settleMs = settleMs;
    if (!complete) this.completedAt = null;
    else if (this.completedAt === null) this.completedAt = now;
  }

  public isSettling(now: number): boolean {
    return this.completedAt !== null && now - this.completedAt < this.settleMs;
  }
}
