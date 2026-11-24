export const READINESS_FAILURE_MARKER = '[browser-harness] readiness failed';

export function runtimeServerSnapshot(server, reason, output) {
  return (
    `[test:runtime] shared documentation server snapshot: ${reason}; ` +
    `pid=${server.pid ?? null}; exitCode=${server.exitCode ?? null}; signal=${server.signalCode ?? null}\n` +
    `Recent server output (at most 20,000 characters):\n${output.slice(-20_000)}`
  );
}

/** Recognize split output chunks without replacing or buffering Vitest output. */
export function observeReadinessFailures(report) {
  let tail = '';
  let reported = false;
  return (chunk) => {
    const text = tail + chunk.toString();
    tail = text.slice(-(READINESS_FAILURE_MARKER.length - 1));
    if (reported || !text.includes(READINESS_FAILURE_MARKER)) return;
    reported = true;
    report();
  };
}

/** Report a shared server failure without interrupting the browser test output. */
export function observeRuntimeServer(server, { isShuttingDown, readOutput, report }) {
  let reported = false;
  const unexpected = (detail) => {
    if (reported || isShuttingDown()) return;
    reported = true;
    report(
      `[test:runtime] shared documentation server failed after readiness: ${detail}\n` +
        `Recent server output (at most 20,000 characters):\n${readOutput().slice(-20_000)}`
    );
  };
  const onError = (error) =>
    unexpected(
      `exitCode=${server.exitCode ?? null}; signal=${server.signalCode ?? null}; error=${error.message}`
    );
  const onExit = (code, signal) => unexpected(`exitCode=${code}; signal=${signal}`);
  server.on('error', onError);
  server.once('exit', onExit);
  return () => {
    server.off('error', onError);
    server.off('exit', onExit);
  };
}
