/** Capture cancellation is terminal; it is not a request to close only Chrome. */
export function createMobileCaptureOwner({
  closeBrowser,
  stopServer,
  save,
  record = (_signal) => {},
  signals = process,
  setExitCode = (code) => {
    process.exitCode = code;
  },
}) {
  let interrupted = null;
  let interruptionCleanup;
  const interruptionErrors = [];
  const checkpoint = () => {
    if (interrupted) throw new Error(`Mobile capture interrupted by ${interrupted}`);
  };
  const interrupt = (signal) => {
    if (interrupted) return;
    interrupted = signal;
    setExitCode({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal]);
    try {
      record(signal);
    } catch (error) {
      interruptionErrors.push(error);
    }
    // Interrupt an active page operation or pending generator. The final owner
    // cleanup repeats these idempotent closes for resources acquired in flight.
    interruptionCleanup = Promise.allSettled([
      Promise.resolve().then(closeBrowser),
      Promise.resolve().then(stopServer),
    ]);
  };
  const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
    signal,
    () => interrupt(signal),
  ]);
  for (const [signal, handler] of handlers) signals.on(signal, handler);
  return {
    checkpoint,
    get interrupted() {
      return interrupted;
    },
    async run(work) {
      let failed = false;
      let failure;
      try {
        checkpoint();
        await work();
        checkpoint();
      } catch (error) {
        failed = true;
        failure = error;
      }
      const cleanupErrors = [];
      // Browser acquisition and browser.close() failure both still reach the
      // server close. Keep the original failure first, including thrown undefined.
      for (const close of [closeBrowser, stopServer, save]) {
        try {
          await close();
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      // A signal may arrive during the final closes, after work has completed.
      // Await that newly started cancellation cleanup before releasing ownership.
      const interruptedCleanupErrors = [...interruptionErrors];
      for (const result of (await interruptionCleanup) ?? [])
        if (result.status === 'rejected') interruptedCleanupErrors.push(result.reason);
      cleanupErrors.unshift(...interruptedCleanupErrors);
      for (const [signal, handler] of handlers) signals.off(signal, handler);
      if (failed) {
        if (cleanupErrors.length)
          throw new AggregateError(
            [failure, ...cleanupErrors],
            'Mobile capture and cleanup failed'
          );
        throw failure;
      }
      if (cleanupErrors.length)
        throw new AggregateError(cleanupErrors, 'Mobile capture cleanup failed');
      checkpoint();
    },
  };
}
