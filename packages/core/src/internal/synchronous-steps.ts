// Finish every step while preserving the first synchronous failure, including falsy values.
export function runAllSteps(steps: readonly (() => void)[]): void {
  let failure: { error: unknown } | undefined;
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}
