// Bounded diagnostic for the pinned Playwright 1.58.2 in-process SDK.
// No browser, filesystem, or protocol operation is started by importing this file.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance as nodePerformance } from 'node:perf_hooks';
import { join } from 'node:path';

const ownerSlot = Symbol.for('proto-ui.private.docs-call-timing-owner.v1');
const css = '[data-docs-site-header] [data-adapter-select] [data-site-select-trigger]';
const expectedSelector = `${css} >> nth=0`;
const sha = (value) => createHash('sha256').update(value).digest('hex');

/** Self-contained init observation; deliveries are not synchronous DOM creation or paint times.
 * @param {{ selector: string, marker: string, ownerToken: string, cap?: number }} options */
export function installDocsTargetArrival({ selector, marker, ownerToken, cap = 32 }) {
  const observations = [];
  const identities = new WeakMap();
  let nextIdentity = 0;
  let firstTarget = null;
  let firstRole = null;
  let lastState = '';
  let queries = 0;
  let changed = 0;
  let dropped = 0;
  let errors = 0;
  let stopped = false;
  let terminalPublished = false;
  let observer;
  const publish = (reason, rows, terminal = false) => {
    try {
      globalThis.console.debug(
        marker +
          JSON.stringify({
            kind: 'target-arrival',
            ownerToken,
            selector,
            reason,
            terminal,
            observations: rows,
            firstTarget,
            firstRole,
            queries,
            changed,
            dropped,
            errors,
          })
      );
    } catch {
      errors++;
    }
  };
  const finish = (reason) => {
    if (terminalPublished) return;
    terminalPublished = true;
    stopped = true;
    try {
      observer?.disconnect();
    } catch {
      errors++;
    }
    publish(reason, observations, true);
  };
  const sample = (reason) => {
    if (stopped) return;
    queries++;
    try {
      const selectorStartedAt = globalThis.performance.now();
      const targets = globalThis.document.querySelectorAll(selector);
      const selectorResolvedAt = globalThis.performance.now();
      const target = targets[0];
      const readStartedAt = target ? globalThis.performance.now() : null;
      if (target && !identities.has(target)) identities.set(target, ++nextIdentity);
      const host = target?.closest('[data-projection-generation-host]');
      const scope = target?.closest('[data-projection-owner]');
      const facts = {
        count: targets.length,
        target: target ? identities.get(target) : null,
        connected: target?.isConnected ?? null,
        role: target?.getAttribute('role') ?? null,
        disabled: target?.getAttribute('aria-disabled') ?? null,
        inert: target ? !!target.closest('[inert]') : null,
        pending: target?.hasAttribute('data-pui-view-pending') ?? null,
        owner: host?.getAttribute('data-projection-owner-host') ?? null,
        generation: host?.getAttribute('data-projection-generation-host') ?? null,
        scopeOwner: scope?.getAttribute('data-projection-owner') ?? null,
        scopeGeneration: scope?.getAttribute('data-projection-generation') ?? null,
      };
      const readSettledAt = target ? globalThis.performance.now() : null;
      const key = JSON.stringify(facts);
      if (key === lastState) return;
      lastState = key;
      const observation = {
        pageMs: globalThis.performance.now(),
        timeOrigin: globalThis.performance.timeOrigin,
        dateNow: Date.now(),
        reason,
        selectorStartedAt,
        selectorResolvedAt,
        readStartedAt,
        readSettledAt,
        ...facts,
      };
      const firstTargetNow = !firstTarget && !!target;
      if (firstTargetNow) firstTarget = observation;
      if (!firstRole && facts.role === 'combobox') firstRole = observation;
      changed++;
      const retained = observations.length < cap;
      if (retained) observations.push(observation);
      else dropped++;
      // The two first observations survive a full journal; one terminal batch
      // preserves a late role without treating it as the original poll verdict.
      if (firstRole) finish('first-role');
      else if (retained || firstTargetNow) publish(reason, retained ? [observation] : []);
    } catch {
      errors++;
    }
  };
  try {
    observer = new globalThis.MutationObserver(() => sample('mutation-delivery'));
    observer.observe(globalThis.document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'role',
        'aria-disabled',
        'inert',
        'data-pui-view-pending',
        'data-projection-generation-state',
        'data-projection-generation-host',
        'data-projection-owner-host',
        'data-projection-owner',
        'data-projection-generation',
      ],
    });
    globalThis.addEventListener('pagehide', () => finish('pagehide'), { once: true });
    sample('installed');
  } catch {
    errors++;
    finish('unavailable');
  }
}

// Constructed from the original SDK function text at runtime, so Vite cannot
// rewrite a browser global into a captured Node import. The original evaluator's
// selector expression, callbackText, return object, and error are retained.
function decorateEvaluation(originalText, marker) {
  const signature =
    '(injected, { info, callbackText: callbackText2, taskData: taskData2, callId, root }) => {';
  const query =
    'const element = injected.querySelector(info.parsed, root || document, info.strict);';
  const value = 'value: callback(injected, element, taskData2)';
  if (
    !originalText.startsWith(signature) ||
    originalText.split(query).length !== 2 ||
    originalText.split(value).length !== 2
  )
    throw new Error('Pinned _callOnElementOnceMatches evaluator shape changed');
  const header = `
    const __rows = [];
    let __errors = 0;
    const __record = (stage, facts) => {
      try {
        if (__rows.length < 64) __rows.push({ stage, pageMs: globalThis.performance.now(), timeOrigin: globalThis.performance.timeOrigin, dateNow: Date.now(), ...facts });
      } catch { ++__errors; }
    };
    const __flush = () => {
      try { globalThis.console.debug(${JSON.stringify(marker)} + JSON.stringify({ ...__puiTiming, callId, rows: __rows, diagnosticErrors: __errors })); } catch {}
    };
    try {
  `;
  let text = originalText.replace(
    signature,
    signature.replace(' root }', ' root, __puiTiming }') + header
  );
  text = text.replace(
    query,
    `const element = (() => {
      __record('selector.enter');
      try {
        const selected = injected.querySelector(info.parsed, root || document, info.strict);
        __record('selector.exit', { found: !!selected });
        return selected;
      } catch (error) {
        __record('selector.throw');
        throw error;
      }
    })();`
  );
  text = text.replace(
    value,
    `value: (() => {
      // The pinned callback is exactly element.getAttribute(data.name). This
      // brackets that original invocation, not an instrumented C++ engine entry.
      let getterNative = null;
      try { getterNative = /\\[native code\\]/.test(Function.prototype.toString.call(element.getAttribute)); } catch { ++__errors; }
      __record('getter.enter', { getterNative });
      try {
        const result = callback(injected, element, taskData2);
        __record('getter.exit', { value: result });
        return result;
      } catch (error) {
        __record('getter.throw');
        throw error;
      }
    })()`
  );
  const end = text.lastIndexOf('}');
  text = text.slice(0, end) + '\n    } finally { __flush(); }\n' + text.slice(end);
  return { source: text, fn: Function(`return (${text});`)() };
}

/** @param {{ sdkRoot: string, cap?: number, selector?: string, attribute?: string }} options */
export function installDocsCallTimingObserver(
  page,
  { sdkRoot, cap = 512, selector = expectedSelector, attribute = 'role' }
) {
  const targetSelector = selector;
  const rows = [];
  const browserBatches = [];
  const arrivalBatches = [];
  const cdpRequests = new Map();
  const cdpSessions = new WeakSet();
  const cdpConnections = new WeakSet();
  const pipeObservers = new WeakMap();
  const pipeStates = [];
  const expressionSources = new Map();
  const expressionDigests = new Map();
  const errors = [];
  const restorers = [];
  const requests = new Map();
  const handles = new WeakSet();
  const contexts = new WeakSet();
  const storage = new AsyncLocalStorage();
  const ownerToken = randomUUID();
  const marker = `PUI_DOCS_CALL_TIMING:${ownerToken}:`;
  let dropped = 0;
  let browserDropped = 0;
  let arrivalDropped = 0;
  let cdpDropped = 0;
  let available = false;
  let disposed = false;
  let verdict = null;
  let evaluatorGuardPasses = 0;
  let evaluatorGuardFailures = 0;
  let serverContext;
  let onConsole;
  let connection;
  let expectedEvaluatorSha;
  const sourceBindings = [];
  const clock = () => ({
    nodeMs: nodePerformance.now(),
    nodeTimeOrigin: nodePerformance.timeOrigin,
    nodeDateNow: Date.now(),
  });
  const record = (stage, facts = {}) => {
    try {
      if (rows.length < cap) rows.push({ stage, ...clock(), ...facts });
      else ++dropped;
    } catch {}
  };
  const diagnosticError = (stage, error) => {
    try {
      if (errors.length < 16) errors.push({ stage, message: String(error), ...clock() });
      else ++dropped;
    } catch {}
  };
  const tap = (promise, fulfilled, rejected) => {
    // Observe, but return the exact original Promise. No await is inserted into
    // the caller's original chain. Each tap does add one Promise reaction.
    try {
      promise.then(
        (value) => {
          try {
            fulfilled(value);
          } catch (error) {
            diagnosticError('tap', error);
          }
        },
        (error) => {
          try {
            rejected?.(error);
          } catch (other) {
            diagnosticError('tap-rejection', other);
          }
        }
      );
    } catch (error) {
      diagnosticError('tap-install', error);
    }
    return promise;
  };
  const replace = (object, key, create) => {
    const own = Object.getOwnPropertyDescriptor(object, key);
    const original = object[key];
    if (typeof original !== 'function') throw new Error(`Missing pinned method: ${key}`);
    const replacement = create(original);
    Object.defineProperty(
      object,
      key,
      own
        ? { ...own, value: replacement }
        : { configurable: true, writable: true, value: replacement }
    );
    restorers.push(() => {
      if (object[key] !== replacement) {
        diagnosticError('restore-ownership', key);
        return;
      }
      if (own) Object.defineProperty(object, key, own);
      else delete object[key];
    });
  };
  const target = (selector, name) => selector === targetSelector && name === attribute;
  const patchPipeTransport = (transport) => {
    if (pipeObservers.has(transport)) return pipeObservers.get(transport);
    const state = {
      available: false,
      reason: null,
      closed: false,
      outgoing: null,
      ingress: null,
      frame: null,
      reads: 0,
      frames: 0,
      writes: 0,
      responses: 0,
      response: /** @type {((observed: any) => void) | null} */ (null),
      drains: 0,
      errors: 0,
      dropped: 0,
      backpressure: new Set(),
    };
    pipeObservers.set(transport, state);
    pipeStates.push(state);
    const writer = transport?._pipeWrite;
    const capture = (read) => {
      try {
        return read();
      } catch {
        state.errors++;
        return null;
      }
    };
    state.response = (observed) => {
      if (!state.available || state.closed) return;
      capture(() => {
        const frame = state.frame;
        if (!frame?.ingress || !frame.queued || !frame.entered) {
          state.errors++;
          return;
        }
        state.responses++;
        const facts = {
          callId: observed.callId,
          query: observed.query,
          attempt: observed.attempt,
          id: observed.id,
          sessionId: observed.sessionId,
          readOrdinal: frame.readOrdinal,
          frameOrdinal: frame.ordinal,
          recordedOnMatchingResponse: true,
        };
        record('cdp.pipe.read-dispatch.enter', { ...facts, ...frame.ingress });
        record('cdp.pipe.frame.queued', { ...facts, ...frame.queued });
        record('cdp.pipe.frame.callback.enter', { ...facts, ...frame.entered });
      });
    };
    const start = restorers.length;
    try {
      if (
        !writer ||
        typeof writer.write !== 'function' ||
        typeof writer.on !== 'function' ||
        typeof writer.off !== 'function' ||
        typeof transport._dispatch !== 'function' ||
        typeof transport._waitForNextTask !== 'function'
      )
        throw new Error('Pinned pipe methods unavailable');
      replace(
        writer,
        'write',
        (original) =>
          function () {
            const observed = state.outgoing;
            if (!state.available || state.closed || !observed)
              return Reflect.apply(original, this, arguments);
            const ordinal = ++observed.pipeWriteOrdinal;
            state.writes++;
            let result;
            try {
              result = Reflect.apply(original, this, arguments);
            } catch (error) {
              capture(() =>
                record('cdp.pipe.write.throw', {
                  id: observed.id,
                  sessionId: observed.sessionId,
                  callId: observed.callId,
                  ordinal,
                })
              );
              throw error;
            }
            capture(() => {
              if (result === false) {
                const key = `${observed.sessionId}:${observed.id}`;
                if (state.backpressure.has(key) || state.backpressure.size < 128)
                  state.backpressure.add(key);
                else state.dropped++;
              }
              record('cdp.pipe.write.return', {
                id: observed.id,
                sessionId: observed.sessionId,
                callId: observed.callId,
                ordinal,
                returned: result,
                writableLength: writer.writableLength ?? null,
                writableNeedDrain: writer.writableNeedDrain ?? null,
              });
            });
            return result;
          }
      );
      replace(
        transport,
        '_dispatch',
        (original) =>
          function () {
            const previous = state.ingress;
            state.ingress = state.closed
              ? null
              : capture(() => ({ ordinal: ++state.reads, ...clock() }));
            try {
              return Reflect.apply(original, this, arguments);
            } finally {
              state.ingress = previous;
            }
          }
      );
      replace(
        transport,
        '_waitForNextTask',
        (original) =>
          function (callback) {
            if (
              !state.available ||
              state.closed ||
              !state.ingress ||
              typeof callback !== 'function'
            )
              return Reflect.apply(original, this, arguments);
            const frame = capture(() => ({
              ordinal: ++state.frames,
              readOrdinal: state.ingress.ordinal,
              ingress: state.ingress,
              queued: clock(),
              entered: null,
            }));
            if (!frame) return Reflect.apply(original, this, arguments);
            const args = [...arguments];
            args[0] = function () {
              if (state.closed) return Reflect.apply(callback, this, arguments);
              const previous = state.frame;
              state.frame = frame;
              frame.entered = capture(clock);
              try {
                return Reflect.apply(callback, this, arguments);
              } finally {
                state.frame = previous;
              }
            };
            return Reflect.apply(original, this, args);
          }
      );
      const onDrain = () => {
        if (state.closed || !state.backpressure.size) return;
        capture(() => {
          state.drains++;
          record('cdp.pipe.drain', {
            scope: 'whole writable stream; not a per-message acknowledgement',
            pendingMessageKeys: [...state.backpressure],
            writableLength: writer.writableLength ?? null,
            writableNeedDrain: writer.writableNeedDrain ?? null,
          });
        });
        state.backpressure.clear();
      };
      writer.on('drain', onDrain);
      restorers.push(() => {
        state.closed = true;
        writer.off('drain', onDrain);
      });
      state.available = true;
    } catch {
      state.reason = 'Pinned pipe observation could not be installed';
      state.errors++;
      state.closed = true;
      for (const restore of restorers.splice(start).reverse()) {
        try {
          restore();
        } catch {
          state.errors++;
        }
      }
    }
    return state;
  };
  const collectExpressionBindings = () => {
    if (!verdict) return [];
    for (const [key, entry] of expressionSources) {
      try {
        expressionDigests.set(key, {
          ...entry.identity,
          characters: entry.value.length,
          sha256: sha(entry.value),
          hashedAfterVerdict: true,
        });
      } catch {
        diagnosticError('expression-digest', 'Expression digest could not be recorded');
      }
    }
    expressionSources.clear();
    return [...expressionDigests.values()];
  };
  const patchCDP = (session) => {
    if (!session || cdpSessions.has(session)) return;
    cdpSessions.add(session);
    const cdpConnection = session._connection;
    const transport = cdpConnection?._transport;
    if (!transport || typeof session._sessionId !== 'string')
      throw new Error('Missing pinned Chromium session transport');
    const pipe = patchPipeTransport(transport);
    replace(
      session,
      'send',
      (original) =>
        function (method) {
          const request = storage.getStore();
          if (
            !request?.callId ||
            !requests.has(request.callId) ||
            !['Runtime.evaluate', 'Runtime.callFunctionOn'].includes(method)
          )
            return Reflect.apply(original, this, arguments);
          const facts = {
            callId: request.callId,
            attempt: request.attempt ?? null,
            method,
            sessionId: this._sessionId,
          };
          record('cdp.session.send.enter', facts);
          let promise;
          try {
            promise = Reflect.apply(original, this, arguments);
          } catch (error) {
            record('cdp.session.send.throw', facts);
            throw error;
          }
          return tap(
            promise,
            () => record('cdp.session.send.fulfilled', facts),
            () => record('cdp.session.send.reject', facts)
          );
        }
    );
    replace(
      session,
      '_onMessage',
      (original) =>
        function (message) {
          try {
            const observed = cdpRequests.get(`${this._sessionId}:${message.id}`);
            if (observed) {
              pipe?.response(observed);
              observed.responseObserved = true;
              record('cdp.response.received', { ...observed, hasError: !!message.error });
            }
          } catch (error) {
            diagnosticError('cdp.response-observation', error);
          }
          return Reflect.apply(original, this, arguments);
        }
    );
    if (cdpConnections.has(cdpConnection)) return;
    cdpConnections.add(cdpConnection);
    replace(
      transport,
      'send',
      (original) =>
        function (message) {
          let observed;
          try {
            const request = storage.getStore();
            const actualSession = cdpConnection._sessions.get(message.sessionId || '');
            if (
              request?.callId &&
              requests.has(request.callId) &&
              cdpSessions.has(actualSession) &&
              ['Runtime.evaluate', 'Runtime.callFunctionOn'].includes(message.method)
            ) {
              observed = {
                callId: request.callId,
                query: request.query,
                attempt: request.attempt ?? null,
                id: message.id,
                sessionId: message.sessionId || '',
                method: message.method,
                contextId: message.params?.contextId ?? null,
                responseObserved: false,
              };
              if (cdpRequests.size < 128)
                cdpRequests.set(`${observed.sessionId}:${observed.id}`, observed);
              else cdpDropped++;
              const key = `${observed.sessionId}:${observed.id}`;
              const expression = Object.getOwnPropertyDescriptor(
                message.params ?? {},
                'expression'
              )?.value;
              if (cdpRequests.has(key) && typeof expression === 'string')
                expressionSources.set(key, {
                  identity: {
                    callId: observed.callId,
                    query: observed.query,
                    attempt: observed.attempt,
                    id: observed.id,
                    sessionId: observed.sessionId,
                    contextId: observed.contextId,
                  },
                  value: expression,
                });
              record('cdp.transport.send.before', { ...observed });
            }
          } catch (error) {
            diagnosticError('cdp.send-observation', error);
          }
          const previous = pipe?.outgoing;
          if (pipe) pipe.outgoing = observed ? { ...observed, pipeWriteOrdinal: 0 } : null;
          let result;
          try {
            result = Reflect.apply(original, this, arguments);
          } catch (error) {
            if (observed) record('cdp.transport.send.throw', { ...observed });
            throw error;
          } finally {
            if (pipe) pipe.outgoing = previous;
          }
          // This is the Node transport method returning, not browser receipt.
          if (observed) record('cdp.transport.send.return', { ...observed });
          return result;
        }
    );
  };
  const observeWait = (object, key, stage, facts, fulfilled) => {
    replace(
      object,
      key,
      (original) =>
        function () {
          const request = storage.getStore();
          if (!request?.callId || !requests.has(request.callId))
            return Reflect.apply(original, this, arguments);
          try {
            record(`${stage}.enter`, { callId: request.callId, ...facts?.(this, arguments) });
          } catch {
            diagnosticError(`${stage}.facts`, 'Diagnostic facts could not be recorded');
          }
          let promise;
          try {
            promise = Reflect.apply(original, this, arguments);
          } catch (error) {
            try {
              record(`${stage}.throw`, { callId: request.callId, error: String(error) });
            } catch {
              diagnosticError(`${stage}.throw-observation`, 'Thrown value could not be recorded');
            }
            throw error;
          }
          return tap(
            promise,
            (value) => {
              // This is the observed original Promise settlement, before any diagnostic
              // patching. A caller continuation can still run later on the same clock.
              record(`${stage}.fulfilled`, { callId: request.callId });
              if (fulfilled) {
                record(`${stage}.observer.enter`, { callId: request.callId });
                fulfilled(value);
                record(`${stage}.observer.exit`, { callId: request.callId });
              }
            },
            (error) => record(`${stage}.reject`, { callId: request.callId, error: String(error) })
          );
        }
    );
  };
  const patchContext = (context) => {
    if (!context || contexts.has(context)) return;
    contexts.add(context);
    patchCDP(context.delegate?._client);
    observeWait(context, 'utilityScript', 'driver.context.utility-script', (context) => ({
      cachedAtEntry: !!context._utilityScriptPromise,
    }));
    observeWait(context.delegate, 'rawEvaluateHandle', 'driver.delegate.raw-evaluate-handle');
    observeWait(
      context.delegate,
      'evaluateWithArguments',
      'driver.delegate.evaluate-with-arguments'
    );
    observeWait(
      context,
      'rawEvaluateHandle',
      'driver.context.raw-evaluate-handle',
      (_context, args) => ({
        expressionCharacters: typeof args[0] === 'string' ? args[0].length : null,
      })
    );
    observeWait(context, 'injectedScript', 'driver.context.injected-script', (context) => ({
      world: context.world,
      cachedAtEntry: !!context._injectedScriptPromise,
    }));
  };
  const patchHandle = (handle) => {
    if (!handle || handles.has(handle)) return;
    handles.add(handle);
    replace(
      handle,
      'evaluate',
      (original) =>
        function (fn, arg) {
          const request = requests.get(arg?.callId);
          if (!request || typeof fn !== 'function' || arg?.taskData?.name !== attribute)
            return Reflect.apply(original, this, arguments);
          let decorated;
          try {
            const text = Function.prototype.toString.call(fn);
            if (sha(text) !== expectedEvaluatorSha)
              throw new Error('Evaluator bytes do not match the pinned source');
            const callback = String(arg.callbackText).replace(/\s+/g, ' ').trim();
            if (callback !== '(injected, element, data) => element.getAttribute(data.name)')
              throw new Error('Unexpected original getAttribute callback');
            decorated = decorateEvaluation(text, marker);
            ++evaluatorGuardPasses;
          } catch (error) {
            ++evaluatorGuardFailures;
            diagnosticError('evaluate-unavailable', error);
            return Reflect.apply(original, this, arguments);
          }
          const attempt = ++request.attempts;
          record('utility.evaluate.dispatch', {
            callId: arg.callId,
            attempt,
            contextId: this._context?.delegate?._contextId ?? null,
            evaluatorSha256: sha(decorated.source),
          });
          const promise = storage.run({ ...request, attempt }, () =>
            Reflect.apply(original, this, [
              decorated.fn,
              { ...arg, __puiTiming: { ownerToken, attempt } },
            ])
          );
          return tap(
            promise,
            (result) =>
              record('utility.evaluate.return', {
                callId: arg.callId,
                attempt,
                success: result?.success,
                value: result?.value,
              }),
            (error) =>
              record('utility.evaluate.reject', {
                callId: arg.callId,
                attempt,
                error: String(error),
              })
          );
        }
    );
  };

  try {
    if (JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8')).version !== '1.58.2')
      throw new Error('Playwright version mismatch');
    for (const path of [
      'lib/inProcessFactory.js',
      'lib/client/connection.js',
      'lib/server/dispatchers/dispatcher.js',
      'lib/server/frames.js',
      'lib/server/frameSelectors.js',
      'lib/server/javascript.js',
      'lib/server/dom.js',
      'lib/server/chromium/crExecutionContext.js',
      'lib/server/chromium/crConnection.js',
      'lib/server/pipeTransport.js',
    ]) {
      const bytes = readFileSync(join(sdkRoot, path));
      sourceBindings.push({ path, sha256: sha(bytes) });
    }
    const framesSource = readFileSync(join(sdkRoot, 'lib/server/frames.js'), 'utf8');
    const start = framesSource.indexOf(
      '(injected, { info, callbackText: callbackText2, taskData: taskData2, callId, root }) => {'
    );
    const end = framesSource.indexOf(
      '}, { info: resolved.info, callbackText, taskData, callId:',
      start
    );
    if (start < 0 || end < 0) throw new Error('Pinned evaluator source not found');
    expectedEvaluatorSha = sha(framesSource.slice(start, end + 1));
    const clientFrame = page.mainFrame();
    connection = clientFrame._connection;
    if (connection[ownerSlot]) throw new Error('This connection already has a timing observer');
    const dispatcher = connection.toImpl?.(connection);
    const frame = connection.toImpl?.(clientFrame);
    if (!dispatcher || !frame?.selectors)
      throw new Error('Not the pinned in-process Playwright connection');
    connection[ownerSlot] = ownerToken;
    serverContext = frame._page.browserContext;
    onConsole = (message) => {
      try {
        if (message.page() !== frame._page) return;
        const text = message.text();
        if (!text.startsWith(marker)) return;
        const data = JSON.parse(text.slice(marker.length));
        if (data.ownerToken !== ownerToken) return;
        if (data.kind === 'target-arrival') {
          if (data.selector !== css) return;
          if (arrivalBatches.length < 34) arrivalBatches.push({ ...data, received: clock() });
          else arrivalDropped++;
          return;
        }
        if (!requests.has(data.callId)) return;
        if (browserBatches.length < 64) browserBatches.push({ ...data, received: clock() });
        else ++browserDropped;
      } catch (error) {
        diagnosticError('console-transport', error);
      }
    };
    // The existing server-side ConsoleMessage is used. No page subscription,
    // CDP session, binding, evaluate, or new execution context is requested.
    serverContext.on('console', onConsole);
    replace(
      clientFrame,
      'getAttribute',
      (original) =>
        function (selector, name) {
          const scope = storage.getStore();
          if (!scope?.original || !target(selector, name))
            return Reflect.apply(original, this, arguments);
          const query = scope.query;
          const args = arguments;
          record('node.frame.getAttribute.enter', { query, selector, name });
          return tap(
            Reflect.apply(original, this, args),
            (value) => record('node.frame.getAttribute.return', { query, value }),
            (error) => record('node.frame.getAttribute.reject', { query, error: String(error) })
          );
        }
    );
    replace(
      connection,
      'onmessage',
      (original) =>
        function (message) {
          const scope = storage.getStore();
          if (
            scope?.original &&
            message.guid === clientFrame._guid &&
            message.method === 'getAttribute' &&
            target(message.params?.selector, message.params?.name)
          ) {
            const callId = `call@${message.id}`;
            const request = {
              callId,
              id: message.id,
              query: scope.query ?? null,
              attempts: 0,
              settled: false,
            };
            if (requests.size < 64) requests.set(callId, request);
            else ++dropped;
            record('node.protocol.send', { ...request });
          }
          return Reflect.apply(original, this, arguments);
        }
    );
    replace(
      dispatcher,
      'dispatch',
      (original) =>
        function (message) {
          const callId = `call@${message.id}`;
          const request = requests.get(callId);
          if (!request) return Reflect.apply(original, this, arguments);
          record('driver.receive', { callId, query: request.query });
          const args = arguments;
          return storage.run(request, () => Reflect.apply(original, this, args));
        }
    );
    replace(
      dispatcher,
      'onmessage',
      (original) =>
        function (message) {
          const request = requests.get(`call@${message.id}`);
          if (request)
            record('driver.response.send', {
              callId: request.callId,
              error: message.error ?? null,
            });
          return Reflect.apply(original, this, arguments);
        }
    );
    replace(
      connection,
      'dispatch',
      (original) =>
        function (message) {
          const request = requests.get(`call@${message.id}`);
          if (request) {
            request.settled = true;
            record('node.protocol.response', {
              callId: request.callId,
              error: message.error ?? null,
            });
          }
          return Reflect.apply(original, this, arguments);
        }
    );
    replace(
      frame,
      'getAttribute',
      (original) =>
        function (progress, selector, name) {
          if (!target(selector, name)) return Reflect.apply(original, this, arguments);
          const request = requests.get(progress.metadata.id);
          if (!request) return Reflect.apply(original, this, arguments);
          record('driver.getAttribute.enter', { callId: request.callId, frameId: frame._id });
          const args = arguments;
          return storage.run(request, () =>
            tap(
              Reflect.apply(original, this, args),
              (value) => record('driver.getAttribute.return', { callId: request.callId, value }),
              (error) =>
                record('driver.getAttribute.reject', {
                  callId: request.callId,
                  error: String(error),
                })
            )
          );
        }
    );
    replace(
      frame.selectors,
      '_parseSelector',
      (original) =>
        function () {
          const request = storage.getStore();
          if (!request?.callId || !requests.has(request.callId))
            return Reflect.apply(original, this, arguments);
          record('driver.selector.parse.enter', { callId: request.callId });
          try {
            const result = Reflect.apply(original, this, arguments);
            record('driver.selector.parse.exit', { callId: request.callId, world: result?.world });
            return result;
          } catch (error) {
            record('driver.selector.parse.throw', { callId: request.callId });
            throw error;
          }
        }
    );
    observeWait(frame.selectors, 'resolveFrameForSelector', 'driver.selector.frame');
    observeWait(
      frame,
      '_context',
      'driver.context',
      (_frame, args) => ({ world: args[0] }),
      patchContext
    );
    replace(
      frame.selectors,
      'resolveInjectedForSelector',
      (original) =>
        function () {
          const request = storage.getStore();
          if (!request?.callId || !requests.has(request.callId))
            return Reflect.apply(original, this, arguments);
          record('driver.selector.resolve.enter', { callId: request.callId });
          return tap(
            Reflect.apply(original, this, arguments),
            (resolved) => {
              record('driver.selector.resolve.fulfilled', { callId: request.callId });
              record('driver.selector.patch-handle.enter', { callId: request.callId });
              patchHandle(resolved?.injected);
              record('driver.selector.patch-handle.exit', { callId: request.callId });
              record('driver.selector.resolve.exit', {
                callId: request.callId,
                found: !!resolved,
                world: resolved?.info?.world,
              });
            },
            (error) =>
              record('driver.selector.resolve.reject', {
                callId: request.callId,
                error: String(error),
              })
          );
        }
    );
    available = true;
  } catch (error) {
    diagnosticError('install', error);
    for (const restore of restorers.reverse()) {
      try {
        restore();
      } catch (other) {
        diagnosticError('install-rollback', other);
      }
    }
    restorers.length = 0;
    if (onConsole && serverContext) serverContext.off('console', onConsole);
    if (connection?.[ownerSlot] === ownerToken) delete connection[ownerSlot];
  }
  return {
    available,
    targetObserver: installDocsTargetArrival,
    initOptions: { selector: css, ownerToken, marker },
    runOriginalQuery(call, read) {
      record('node.original-query', { query: call });
      return storage.run({ query: call, original: true }, read);
    },
    freezeVerdict(passed) {
      verdict = {
        passed,
        ...clock(),
        pendingCallIds: [...requests.values()].filter((r) => !r.settled).map((r) => r.callId),
      };
    },
    markContextCloseStart() {
      record('node.context-close.before-call');
    },
    disposeAfterContextClosed(contextClosed) {
      if (!contextClosed) {
        diagnosticError('cleanup-deferred', 'Original context close was not confirmed');
        return false;
      }
      if (disposed) return true;
      disposed = true;
      for (const restore of restorers.reverse()) {
        try {
          restore();
        } catch (error) {
          diagnosticError('restore', error);
        }
      }
      if (onConsole && serverContext) serverContext.off('console', onConsole);
      if (connection?.[ownerSlot] === ownerToken) delete connection[ownerSlot];
      record('node.cleanup-after-context-close');
      return true;
    },
    snapshot() {
      const captured = [...requests.values()].map((r) => ({ ...r }));
      const keys = browserBatches.map((batch) => `${batch.callId}:${batch.attempt}`);
      const mapped = browserBatches.every((batch) => {
        const request = requests.get(batch.callId);
        return (
          request?.query != null &&
          Number.isInteger(batch.attempt) &&
          batch.attempt > 0 &&
          batch.attempt <= request.attempts
        );
      });
      const mappingCompleteAtSnapshot =
        available &&
        captured.length > 0 &&
        captured.every((r) => r.query != null && r.attempts > 0) &&
        mapped &&
        new Set(keys).size === keys.length &&
        browserBatches.length === captured.reduce((n, r) => n + r.attempts, 0) &&
        !errors.length &&
        !dropped &&
        !browserDropped &&
        !evaluatorGuardFailures &&
        browserBatches.every((batch) => batch.diagnosticErrors === 0);
      return {
        kind: 'private-playwright-call-timing-v1',
        available,
        ownerToken,
        sourceBindings,
        expectedEvaluatorSha,
        selector: targetSelector,
        attribute,
        verdict,
        rows: [...rows],
        browserBatches: [...browserBatches],
        arrivalBatches: [...arrivalBatches],
        arrivalDropped,
        cdpRequests: [...cdpRequests.values()].map((request) => ({ ...request })),
        cdpDropped,
        pipeObservations: pipeStates.map((state) => ({
          available: state.available,
          reason: state.reason,
          closed: state.closed,
          reads: state.reads,
          frames: state.frames,
          writes: state.writes,
          responses: state.responses,
          drains: state.drains,
          errors: state.errors,
          dropped: state.dropped,
          pendingBackpressureMessages: state.backpressure.size,
        })),
        expressionBindings: collectExpressionBindings(),
        expressionDigestBoundary:
          'Original immutable expression references; hashed only in a post-verdict snapshot.',
        pipeBoundary:
          'Node write/backpressure and NUL-frame dispatch only; no write callback, extra parse/RPC, browser receipt or engine timestamp.',
        requests: captured,
        errors: [...errors],
        dropped,
        browserDropped,
        disposed,
        capturedOriginalRequests: captured.length,
        pendingCapturedRequests: captured.filter((r) => !r.settled).length,
        evaluatorGuardPasses,
        evaluatorGuardFailures,
        mappingCompleteAtSnapshot,
        requestMapping:
          'actual protocol id -> call@id -> existing evaluator callId + per-call attempt',
        publicApi: false,
        promiseStrategy:
          'tap returns the original Promise; identity is a source property, with extra observation reactions',
        extraQueryOrRPC: false,
        extraQueryOrRPCScope:
          'Original SDK request only; the optional target init observer is separate.',
        targetArrivalSetup:
          'Caller may install the separate init observer before navigation; one setup RPC and native DOM observations, not an original query or readiness verdict.',
        cdpBoundary:
          'Actual session/id at the Node transport send and response callback; send return is not browser receipt or an engine execution timestamp.',
        prototypeHook: false,
        transportComplete: false,
        clockTickLengthMeasured: false,
      };
    },
  };
}
