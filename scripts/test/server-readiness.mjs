function describeError(error) {
  let result = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (error?.cause) result += `; cause=${String(error.cause)}`;
  return result;
}

// A transport must honor the signal; racing it also bounds a stalled response
// cleanup. Always remove our listener when either side settles.
function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted);
      reject(signal.reason);
    };
    promise.then(
      (value) => {
        signal.removeEventListener('abort', aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', aborted);
        reject(error);
      }
    );
    if (signal.aborted) aborted();
    else signal.addEventListener('abort', aborted, { once: true });
  });
}

function retryDelay(delay, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
    };
    const aborted = () => {
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delay);
    if (signal.aborted) aborted();
    else signal.addEventListener('abort', aborted, { once: true });
  });
}

/** One deadline covers requests, body release, and retry delays. */
export async function waitForServerReadiness(
  url,
  { timeoutMs, server = null, readOutput = () => '', report = console.log }
) {
  const started = Date.now();
  const deadline = started + timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException('Documentation readiness deadline reached', 'TimeoutError')
      ),
    Math.max(0, timeoutMs)
  );
  let earlyExit = null;
  const serverFailed = (detail) => {
    earlyExit = new Error(`Documentation dev server exited early: ${detail}.\n${readOutput()}`);
    controller.abort(earlyExit);
  };
  const onExit = (code, signal) => serverFailed(`exitCode=${code}; signal=${signal}`);
  const onError = (error) => serverFailed(describeError(error));
  server?.once('exit', onExit);
  server?.once('error', onError);
  let lastResult = 'no response received';
  let attempt = 0;

  try {
    if (server && (server.exitCode !== null || server.signalCode !== null)) {
      serverFailed(`exitCode=${server.exitCode}; signal=${server.signalCode}`);
    }
    while (Date.now() < deadline && !controller.signal.aborted) {
      const attemptStarted = Date.now();
      attempt += 1;
      let ready = false;
      try {
        // A slow successful page is still readiness evidence. The original
        // 120s/180s total budget, not a repeating 2s abort, bounds the request.
        const response = await withAbort(
          fetch(url, { signal: controller.signal }),
          controller.signal
        );
        lastResult = `HTTP ${response.status} ${response.statusText}`.trim();
        await withAbort(response.body?.cancel() ?? Promise.resolve(), controller.signal);
        ready = response.ok;
      } catch (error) {
        lastResult = describeError(error);
      }
      report(
        `[server-readiness] ${new Date().toISOString()} ${url} attempt=${attempt} ` +
          `requestMs=${Date.now() - attemptStarted} totalMs=${Date.now() - started} ${lastResult}`
      );
      if (earlyExit) throw earlyExit;
      if (controller.signal.aborted || Date.now() >= deadline) break;
      if (ready) return;
      try {
        await retryDelay(Math.min(250, deadline - Date.now()), controller.signal);
      } catch {
        // Deadline or child exit owns this cancellation; preserve the last
        // HTTP/error result rather than replacing it with a sleep error.
        break;
      }
    }
    if (earlyExit) throw earlyExit;
    throw new Error(
      `Timed out waiting for ${url}. Last readiness result: ${lastResult}.\n${readOutput()}`
    );
  } finally {
    clearTimeout(timeout);
    server?.off('exit', onExit);
    server?.off('error', onError);
  }
}
