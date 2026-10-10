/** Diagnostic snapshots only; never suppress, classify or recover from a page error. */
export type SliderPageErrorContext = {
  /** Requested journey runtime, not proof that it has mounted yet. */
  runtime: string;
  /** Synchronous harness progress, without querying or delaying the page. */
  runtimePhase: string;
  url: string;
  stage: string;
  lastInteraction: { sequence: number; action: string; target: string; detail?: string } | null;
};
export type SliderPageErrorReceipt = SliderPageErrorContext & {
  errorSequence: number;
  receivedAt: string;
  error: string;
  name: string;
  message: string;
  stack: string | null;
};
export function appendSliderPageError(
  errors: string[],
  details: SliderPageErrorReceipt[],
  error: Error,
  context: SliderPageErrorContext
) {
  // Keep the original error string list and its strict assertion unchanged.
  const original = String(error);
  errors.push(original);
  details.push({
    errorSequence: details.length + 1,
    receivedAt: new Date().toISOString(),
    error: original,
    name: error.name,
    message: error.message,
    stack: error.stack ?? null,
    ...context,
    lastInteraction: context.lastInteraction ? { ...context.lastInteraction } : null,
  });
}
