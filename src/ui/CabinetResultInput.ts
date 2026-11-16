/** Give the final outcome time to appear before accepting another action. */
export const CABINET_RESULT_SETTLE_MS = 600;

export class CabinetResultInput {
  private completedAt: number | null = null;

  public update(complete: boolean, now: number): void {
    if (!complete) this.completedAt = null;
    else if (this.completedAt === null) this.completedAt = now;
  }

  public isSettling(now: number): boolean {
    return (
      this.completedAt !== null &&
      now - this.completedAt < CABINET_RESULT_SETTLE_MS
    );
  }
}
