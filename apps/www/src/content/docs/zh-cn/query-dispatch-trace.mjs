import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 32 * 1024 * 1024;
const categories = [
  'devtools',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-v8.compile',
];

function bounded(promise, label, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: observation budget expired`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function errorReason(error) {
  try {
    return String(error);
  } catch {
    return 'Diagnostic error could not be serialized';
  }
}

// Observe one original query. No Runtime/Debugger evaluation, sourceURL, warmup
// or replacement query is sent. Browser dispatch is not the pipe receipt time.
export function createQueryDispatchTrace(page, directory) {
  const browser = page.context().browser();
  const report = {
    kind: 'original-query-dispatch-trace-v1',
    categories,
    browserVersion: browser?.version(),
    rows: [],
    errors: [],
    droppedRows: 0,
    droppedErrors: 0,
    trace: { complete: false, bytes: 0, dataLossOccurred: null },
    cleanup: { originalContextClosed: false, streamClosed: false, sessionDetached: false },
  };
  let session, acquirePromise, startPromise, endPromise, stream, tail;
  let startState = 'not-started',
    ownedDirectory = false,
    finishing = false,
    finished = false,
    setupRejected = false;
  let cleaning = false,
    completeEvent,
    resolveComplete;
  const complete = new Promise((resolve) => {
    resolveComplete = resolve;
  });
  const note = (stage) => {
    if (report.rows.length < 128)
      report.rows.push({
        stage,
        nodeMs: performance.now(),
        nodeTimeOrigin: performance.timeOrigin,
      });
    else report.droppedRows++;
  };
  const fail = (stage, error) => {
    const reason = errorReason(error);
    if (report.errors.length < 32) report.errors.push({ stage, reason });
    else report.droppedErrors++;
  };
  const send = (method, args = {}) => {
    note(`${method}.send`);
    return session.send(method, args).then((value) => {
      note(`${method}.return`);
      return value;
    });
  };
  const end = () => {
    if (startState !== 'fulfilled' || endPromise) return endPromise;
    endPromise = send('Tracing.end');
    // A timed-out observation does not cancel the protocol operation.
    endPromise.catch((error) => fail('trace-end', error));
    return endPromise;
  };
  const lateCleanup = async () => {
    if (!finished || !session || cleaning || startState === 'pending') return;
    if (startState === 'fulfilled' && !completeEvent) {
      end();
      return;
    }
    cleaning = true;
    const result = { streamClosed: false, sessionDetached: false, errors: [] };
    try {
      if (stream && !report.cleanup.streamClosed) {
        await bounded(send('IO.close', { handle: stream }), 'late stream close', 1000);
        result.streamClosed = true;
      }
    } catch (error) {
      result.errors.push(errorReason(error));
    }
    try {
      await bounded(session.detach(), 'late session detach', 1000);
      result.sessionDetached = true;
    } catch (error) {
      result.errors.push(errorReason(error));
    }
    session.off('Tracing.tracingComplete', onComplete);
    if (ownedDirectory)
      await writeFile(path.join(directory, 'late-cleanup.json'), JSON.stringify(result, null, 2));
    cleaning = false;
  };
  const onComplete = (event) => {
    completeEvent = event;
    stream = event.stream;
    resolveComplete(event);
    if (finished) void lateCleanup().catch((error) => fail('late-cleanup', error));
  };
  return {
    async prepare() {
      try {
        await mkdir(path.dirname(directory), { recursive: true });
        await mkdir(directory);
        ownedDirectory = true;
        acquirePromise = browser
          .newBrowserCDPSession()
          .then((acquired) => {
            session = acquired;
            if (finished) {
              void lateCleanup().catch((error) => fail('late-acquire-cleanup', error));
              return;
            }
            session.on('Tracing.tracingComplete', onComplete);
            startState = 'pending';
            startPromise = send('Tracing.start', {
              transferMode: 'ReturnAsStream',
              streamFormat: 'json',
              streamCompression: 'none',
              traceConfig: {
                recordMode: 'recordUntilFull',
                traceBufferSizeInKb: MAX_BYTES / 1024,
                includedCategories: categories,
                enableSampling: false,
              },
            }).then(
              () => {
                startState = 'fulfilled';
                if (finished)
                  void lateCleanup().catch((error) => fail('late-start-cleanup', error));
              },
              (error) => {
                startState = 'rejected';
                if (finished)
                  void lateCleanup().catch((lateError) => fail('late-start-cleanup', lateError));
                throw error;
              }
            );
            return startPromise;
          })
          .catch((error) => {
            setupRejected = true;
            throw error;
          });
        await bounded(acquirePromise, 'trace setup', 8000);
      } catch (error) {
        fail('prepare', error);
      }
    },
    markVerdict(observation) {
      report.originalVerdict = observation?.verdict;
      note('original-verdict-already-frozen');
      if (startState === 'fulfilled') {
        const syncId = 'proto-ui-docs-original-verdict';
        report.clockSync = { syncId, sentNodeMs: performance.now() };
        send('Tracing.recordClockSyncMarker', { syncId }).then(
          () => {
            report.clockSync.returnedNodeMs = performance.now();
          },
          (error) => fail('clock-sync', error)
        );
      }
      if (observation?.verdict?.passed) end();
      else tail = setTimeout(end, 2100);
    },
    beforeContextClose() {
      clearTimeout(tail);
      note('original-context-close');
      end();
    },
    async finish(contextClosed, observation) {
      if (finishing) return;
      finishing = true;
      clearTimeout(tail);
      report.cleanup.originalContextClosed = contextClosed;
      report.originalObservation = observation;
      const chunks = [];
      const deadline = performance.now() + 8000;
      let startSettled = false;
      try {
        if (acquirePromise) await bounded(acquirePromise, 'pending trace setup', 2000);
        startSettled = true;
        if (startState !== 'fulfilled') throw new Error('Trace start was not acknowledged');
        await bounded(end(), 'trace end', 2000);
        const event = await bounded(complete, 'trace complete', 2000);
        report.trace.dataLossOccurred = event.dataLossOccurred;
        if (!stream) throw new Error('Trace completed without a stream');
        let eof = false;
        while (!eof && performance.now() < deadline) {
          const remaining = MAX_BYTES - report.trace.bytes;
          const result = await bounded(
            send('IO.read', {
              handle: stream,
              size: Math.min(262144, remaining + 1),
            }),
            'trace read',
            Math.max(1, deadline - performance.now())
          );
          const bytes = Buffer.from(result.data, result.base64Encoded ? 'base64' : 'utf8');
          chunks.push(bytes.subarray(0, remaining));
          report.trace.bytes += Math.min(bytes.length, remaining);
          if (bytes.length > remaining)
            throw new Error('Trace exceeds 32MiB; retained prefix is incomplete');
          eof = result.eof;
        }
        report.trace.complete = eof;
        if (!eof) throw new Error('Trace read did not reach EOF');
      } catch (error) {
        fail('capture', error);
      } finally {
        if (stream) {
          try {
            await bounded(send('IO.close', { handle: stream }), 'stream close', 1000);
            report.cleanup.streamClosed = true;
          } catch (error) {
            fail('stream-close', error);
          }
        }
        report.cleanup.unresolvedTraceOwnership =
          (!startSettled && !setupRejected) || (startState === 'fulfilled' && !completeEvent);
        if (session && !report.cleanup.unresolvedTraceOwnership) {
          session.off('Tracing.tracingComplete', onComplete);
          try {
            await bounded(session.detach(), 'session detach', 1000);
            report.cleanup.sessionDetached = true;
          } catch (error) {
            fail('session-detach', error);
          }
        }
        const bytes = Buffer.concat(chunks);
        report.trace.sha256 = createHash('sha256').update(bytes).digest('hex');
        try {
          if (ownedDirectory) {
            if (bytes.length) await writeFile(path.join(directory, 'trace.json'), bytes);
            await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
          }
        } finally {
          finished = true;
          if (report.cleanup.unresolvedTraceOwnership)
            void lateCleanup().catch((error) => fail('late-cleanup', error));
        }
      }
    },
  };
}
