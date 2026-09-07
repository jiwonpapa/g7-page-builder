/** A selection owns one request. Cancelled/overlapping results cannot reach its UI. */
export class NativeMediaRequest {
  private active: AbortController | null = null;
  cancel(): void { this.active?.abort(); this.active = null; }
  async run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    this.cancel();
    const controller = new AbortController();
    this.active = controller;
    try {
      const result = await action(controller.signal);
      return this.active === controller && !controller.signal.aborted ? result : null;
    } finally { if (this.active === controller) this.active = null; }
  }
}
