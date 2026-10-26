// @vitest-environment node
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/www/src/content/docs/zh-cn/docs-query-timing.mjs', 'utf8');
const helper = (name: string, next: string) => {
  const start = source.indexOf(`const ${name} = `);
  const end = source.indexOf(`\n  const ${next} = `, start);
  if (start < 0 || end < 0) throw new Error(`Missing diagnostic helper ${name}`);
  return source
    .slice(start + `const ${name} = `.length, end)
    .trim()
    .replace(/;$/, '');
};

function observe(original: () => unknown, facts?: () => unknown, tracked = true) {
  const rows: string[] = [];
  const errors: string[] = [];
  const context = {
    storage: { getStore: () => (tracked ? { callId: 'call@1' } : undefined) },
    requests: new Map([['call@1', {}]]),
    record: (stage: string) => rows.push(stage),
    diagnosticError: (stage: string) => errors.push(stage),
    replace: (object: any, key: string, create: (fn: any) => unknown) => {
      object[key] = create(object[key]);
    },
    tap: undefined as unknown,
  };
  context.tap = runInNewContext(`(${helper('tap', 'replace')})`, context);
  const install = runInNewContext(`(${helper('observeWait', 'patchContext')})`, context);
  const object = { read: original };
  install(object, 'read', 'wait', facts);
  return { object, rows, errors };
}

describe('Docs SDK wait observation boundary', () => {
  it('returns the original Promise and invokes the tracked operation once', async () => {
    const promise = Promise.resolve('combobox');
    let calls = 0;
    const { object, rows, errors } = observe(() => {
      calls++;
      return promise;
    });
    expect(object.read()).toBe(promise);
    expect(await promise).toBe('combobox');
    expect(calls).toBe(1);
    expect(rows).toEqual(['wait.enter', 'wait.fulfilled']);
    expect(errors).toEqual([]);
  });

  it('retains the original synchronous thrown value when serialization itself throws', () => {
    const thrown = Object.create(null);
    const { object, errors } = observe(() => {
      throw thrown;
    });
    let observed;
    try {
      object.read();
    } catch (error) {
      observed = error;
    }
    expect(observed).toBe(thrown);
    expect(errors).toEqual(['wait.throw-observation']);
  });

  it('does not let diagnostic facts prevent the original call', async () => {
    const promise = Promise.resolve('combobox');
    let calls = 0;
    const { object, errors } = observe(
      () => {
        calls++;
        return promise;
      },
      () => {
        throw new Error('facts');
      }
    );
    expect(object.read()).toBe(promise);
    expect(await promise).toBe('combobox');
    expect(calls).toBe(1);
    expect(errors).toEqual(['wait.facts']);
  });

  it('passes unrelated operations through without installing reactions or facts', async () => {
    const promise = Promise.resolve('other');
    const { object, rows, errors } = observe(
      () => promise,
      () => {
        throw new Error('untracked');
      },
      false
    );
    expect(object.read()).toBe(promise);
    expect(await promise).toBe('other');
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });
});

function observeCDP({
  tracked = true,
  thrown,
  brokenClock = false,
}: {
  tracked?: boolean;
  thrown?: unknown;
  brokenClock?: boolean;
} = {}) {
  const promise = Promise.resolve('original');
  const messages: unknown[] = [];
  const replies: unknown[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  const cdpRequests = new Map();
  const transport = {
    send(message: unknown) {
      messages.push(message);
      if (thrown !== undefined) throw thrown;
      return 'original-send';
    },
  };
  const connection = { _transport: transport, _sessions: new Map() };
  const session = {
    _connection: connection,
    _sessionId: 'session:actual',
    send(method: string, params: unknown) {
      transport.send({ id: 37, sessionId: this._sessionId, method, params });
      return promise;
    },
    _onMessage(message: unknown) {
      replies.push(message);
      return 'original-receive';
    },
  };
  connection._sessions.set(session._sessionId, session);
  const context: any = {
    cap: 512,
    dropped: 0,
    cdpDropped: 0,
    rows,
    cdpRequests,
    cdpSessions: new WeakSet(),
    cdpConnections: new WeakSet(),
    patchPipeTransport: () => null,
    expressionSources: new Map(),
    requests: new Map([['call@1', {}]]),
    storage: { getStore: () => (tracked ? { callId: 'call@1', query: 1, attempt: 1 } : undefined) },
    clock: () => {
      if (brokenClock) throw new Error('diagnostic clock');
      return { nodeMs: 1 };
    },
    diagnosticError: (stage: string) => errors.push(stage),
    replace: (object: any, key: string, create: (fn: any) => unknown) => {
      object[key] = create(object[key]);
    },
  };
  context.record = runInNewContext(`(${helper('record', 'diagnosticError')})`, context);
  context.tap = runInNewContext(`(${helper('tap', 'replace')})`, context);
  const install = runInNewContext(`(${helper('patchCDP', 'observeWait')})`, context);
  install(session);
  return { session, promise, messages, replies, rows, errors, cdpRequests };
}

describe('Docs original CDP command observation', () => {
  it('keeps the original Promise, arguments and actual protocol identity', async () => {
    const observed = observeCDP();
    const params = { expression: 'original expression' };
    expect(observed.session.send('Runtime.evaluate', params)).toBe(observed.promise);
    expect(observed.messages).toHaveLength(1);
    expect((observed.messages[0] as any).params).toBe(params);
    const response = { id: 37, result: { value: 'original' } };
    expect(observed.session._onMessage(response)).toBe('original-receive');
    expect(observed.replies).toEqual([response]);
    expect(observed.replies[0]).toBe(response);
    expect(await observed.promise).toBe('original');
    expect([...observed.cdpRequests.values()]).toEqual([
      expect.objectContaining({
        id: 37,
        sessionId: 'session:actual',
        callId: 'call@1',
        query: 1,
        attempt: 1,
        responseObserved: true,
      }),
    ]);
    expect(observed.rows.map((row) => row.stage)).toEqual([
      'cdp.session.send.enter',
      'cdp.transport.send.before',
      'cdp.transport.send.return',
      'cdp.response.received',
      'cdp.session.send.fulfilled',
    ]);
    expect(observed.errors).toEqual([]);
  });

  it('passes an unrelated command through with no timing rows or requests', async () => {
    const observed = observeCDP({ tracked: false });
    expect(observed.session.send('Runtime.evaluate', {})).toBe(observed.promise);
    expect(await observed.promise).toBe('original');
    expect(observed.messages).toHaveLength(1);
    expect(observed.rows).toEqual([]);
    expect(observed.cdpRequests.size).toBe(0);
  });

  it('preserves a native thrown value even when the diagnostic clock throws', () => {
    const observed = observeCDP({ thrown: 0, brokenClock: true });
    let thrown: unknown = 'not thrown';
    try {
      observed.session.send('Runtime.evaluate', {});
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(0);
    expect(observed.messages).toHaveLength(1);
  });
});

function observeArrival({
  cap = 32,
  setupThrows = false,
}: { cap?: number; setupThrows?: boolean } = {}) {
  const batches: any[] = [];
  let targets: any[] = [];
  let deliver = () => {};
  let pagehide = () => {};
  let clock = 0;
  let disconnected = 0;
  const selectors: string[] = [];
  const context = {
    console: { debug: (text: string) => batches.push(JSON.parse(text.slice('marker:'.length))) },
    performance: { now: () => ++clock, timeOrigin: 1000 },
    document: {
      querySelectorAll: (selector: string) => {
        selectors.push(selector);
        return targets;
      },
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        deliver = callback;
      }
      observe() {
        if (setupThrows) throw new Error('observer setup');
      }
      disconnect() {
        disconnected++;
      }
    },
    addEventListener: (_name: string, callback: () => void) => {
      pagehide = callback;
    },
  };
  const start = source.indexOf('export function installDocsTargetArrival');
  const end = source.indexOf('\n// Constructed from', start);
  if (start < 0 || end < 0) throw new Error('Missing target init observer');
  const install = runInNewContext(
    `(${source.slice(start, end).replace('export ', '').trim()})`,
    context
  );
  install({ selector: 'exact target', ownerToken: 'owner', marker: 'marker:', cap });
  return {
    batches,
    selectors,
    setTargets(next: any[]) {
      targets = next;
      deliver();
    },
    hide() {
      pagehide();
    },
    get disconnected() {
      return disconnected;
    },
  };
}

describe('Docs target arrival journal', () => {
  it('keeps first target and first combobox observations after the journal cap', () => {
    const observed = observeArrival({ cap: 1 });
    let role = 'button';
    const target = {
      isConnected: true,
      closest: () => null,
      getAttribute: (name: string) => (name === 'role' ? role : null),
      hasAttribute: () => false,
    };
    observed.setTargets([target]);
    role = 'combobox';
    observed.setTargets([target]);
    observed.hide();
    const final = observed.batches.at(-1);
    expect(final.terminal).toBe(true);
    expect(final.observations).toHaveLength(1);
    expect(final.observations[0].count).toBe(0);
    expect(final.observations[0].readStartedAt).toBeNull();
    expect(final.firstTarget.role).toBe('button');
    expect(final.firstRole.role).toBe('combobox');
    expect(final.firstTarget.target).toBe(final.firstRole.target);
    expect(final.dropped).toBe(2);
    expect(final.errors).toBe(0);
    expect(observed.batches.filter((batch) => batch.terminal)).toHaveLength(1);
    expect(observed.selectors).toEqual(['exact target', 'exact target', 'exact target']);
    expect(observed.disconnected).toBe(1);
  });

  it('records observer setup failure without throwing into the page', () => {
    const observed = observeArrival({ setupThrows: true });
    expect(observed.batches).toHaveLength(1);
    expect(observed.batches[0]).toMatchObject({ terminal: true, reason: 'unavailable', errors: 1 });
    expect(observed.selectors).toEqual([]);
  });
});

function observePipe({
  thrown,
  brokenClock = false,
  missingScheduler = false,
}: {
  thrown?: unknown;
  brokenClock?: boolean;
  missingScheduler?: boolean;
} = {}) {
  const sdk = readFileSync(
    'node_modules/.pnpm/playwright-core@1.58.2/node_modules/playwright-core/lib/server/pipeTransport.js',
    'utf8'
  );
  const start = sdk.indexOf('class PipeTransport {');
  const end = sdk.indexOf('// Annotate', start);
  if (start < 0 || end < 0) throw new Error('Missing pinned PipeTransport');
  const queued: Array<() => unknown> = [];
  const writes: Array<{ receiver: unknown; args: unknown[] }> = [];
  const replies: unknown[] = [];
  const rows: any[] = [];
  const errors: string[] = [];
  const restorers: Array<() => void> = [];
  let ticks = 0;
  let parseCalls = 0;
  let writeResult = false;
  const writer = new EventEmitter() as any;
  writer.writableLength = 17;
  writer.writableNeedDrain = true;
  writer.write = function (...args: unknown[]) {
    writes.push({ receiver: this, args });
    if (thrown !== undefined) throw thrown;
    return writeResult;
  };
  const reader = new EventEmitter();
  const Transport = runInNewContext(`(${sdk.slice(start, end)})`, {
    Buffer,
    JSON: {
      stringify: JSON.stringify,
      parse(value: string) {
        parseCalls++;
        return JSON.parse(value);
      },
    },
    import_utils: {
      makeWaitForNextTask: () => (callback: () => unknown) => {
        queued.push(callback);
        return 'original-scheduler-return';
      },
    },
    import_debugLogger: { debugLogger: { log() {} } },
  });
  const transport = new Transport(writer, reader);
  if (missingScheduler) transport._waitForNextTask = undefined;
  const originals = {
    write: writer.write,
    dispatch: transport._dispatch,
    schedule: transport._waitForNextTask,
  };
  const promise = Promise.resolve('original');
  const connection = { _transport: transport, _sessions: new Map() };
  const session = {
    _connection: connection,
    _sessionId: 'pipe-session',
    send(method: string, params: unknown) {
      transport.send({ id: 37, sessionId: this._sessionId, method, params });
      return promise;
    },
    _onMessage(message: unknown) {
      replies.push(message);
      return 'original-response';
    },
  };
  connection._sessions.set(session._sessionId, session);
  transport.onmessage = (message: any) =>
    connection._sessions.get(message.sessionId)?._onMessage(message);
  const context: any = {
    Buffer,
    cap: 512,
    dropped: 0,
    cdpDropped: 0,
    rows,
    restorers,
    cdpRequests: new Map(),
    cdpSessions: new WeakSet(),
    cdpConnections: new WeakSet(),
    pipeObservers: new WeakMap(),
    pipeStates: [],
    expressionSources: new Map(),
    requests: new Map([['call@1', {}]]),
    storage: { getStore: () => ({ callId: 'call@1', query: 1, attempt: 1 }) },
    clock: () => {
      if (brokenClock) throw new Error('clock');
      return { nodeMs: ++ticks };
    },
    diagnosticError: (stage: string) => errors.push(stage),
  };
  context.record = runInNewContext(`(${helper('record', 'diagnosticError')})`, context);
  context.tap = runInNewContext(`(${helper('tap', 'replace')})`, context);
  context.replace = runInNewContext(`(${helper('replace', 'target')})`, context);
  context.patchPipeTransport = runInNewContext(
    `(${helper('patchPipeTransport', 'collectExpressionBindings')})`,
    context
  );
  const install = runInNewContext(`(${helper('patchCDP', 'observeWait')})`, context);
  install(session);
  return {
    writer,
    reader,
    transport,
    session,
    promise,
    originals,
    queued,
    writes,
    rows,
    errors,
    replies,
    state: context.pipeStates[0],
    get parseCalls() {
      return parseCalls;
    },
    setWriteResult(value: boolean) {
      writeResult = value;
    },
    dispose() {
      for (const restore of restorers.reverse()) restore();
    },
  };
}

describe('Docs pinned pipe observation boundary', () => {
  it('keeps both original writes, arguments and Promise without waiting for backpressure', async () => {
    const observed = observePipe();
    const params = { expression: 'unchanged expression' };
    expect(observed.session.send('Runtime.evaluate', params)).toBe(observed.promise);
    expect(observed.writes).toHaveLength(2);
    expect(observed.writes.every((entry) => entry.receiver === observed.writer)).toBe(true);
    expect(observed.writes.map((entry) => entry.args)).toEqual([
      [JSON.stringify({ id: 37, sessionId: 'pipe-session', method: 'Runtime.evaluate', params })],
      ['\0'],
    ]);
    expect(
      observed.rows
        .filter((row) => row.stage === 'cdp.pipe.write.return')
        .map((row) => row.returned)
    ).toEqual([false, false]);
    expect(observed.queued).toEqual([]);
    observed.writer.emit('drain');
    const drain = observed.rows.find((row) => row.stage === 'cdp.pipe.drain');
    expect(drain.scope).toBe('whole writable stream; not a per-message acknowledgement');
    expect(drain.pendingMessageKeys).toEqual(['pipe-session:37']);
    expect(await observed.promise).toBe('original');
  });

  it('uses the original framing, parsing and callback queue and records only matching replies', () => {
    const observed = observePipe();
    observed.session.send('Runtime.evaluate', {});
    const response = JSON.stringify({ id: 37, sessionId: 'pipe-session', result: {} });
    const other = JSON.stringify({ id: 99, sessionId: 'pipe-session', result: {} });
    observed.reader.emit('data', Buffer.from(response.slice(0, 7)));
    expect(observed.queued).toHaveLength(0);
    observed.reader.emit('data', Buffer.from(response.slice(7) + '\0' + other + '\0'));
    expect(observed.queued).toHaveLength(2);
    expect(observed.parseCalls).toBe(0);
    expect(observed.rows.some((row) => row.stage === 'cdp.pipe.frame.queued')).toBe(false);
    observed.queued.shift()!();
    observed.queued.shift()!();
    expect(observed.parseCalls).toBe(2);
    expect(observed.replies).toEqual([JSON.parse(response), JSON.parse(other)]);
    const frame = observed.rows.filter(
      (row) => row.stage.startsWith('cdp.pipe.') && row.frameOrdinal
    );
    expect(frame.map((row) => row.stage)).toEqual([
      'cdp.pipe.read-dispatch.enter',
      'cdp.pipe.frame.queued',
      'cdp.pipe.frame.callback.enter',
    ]);
    expect(
      frame.every((row) => row.id === 37 && row.readOrdinal === 2 && row.frameOrdinal === 1)
    ).toBe(true);
    expect(frame[0].nodeMs).toBeLessThan(frame[1].nodeMs);
    expect(frame[1].nodeMs).toBeLessThan(frame[2].nodeMs);
    expect(observed.state.responses).toBe(1);
  });

  it('preserves original synchronous throw even when observer clocks fail', () => {
    const observed = observePipe({ thrown: 0, brokenClock: true });
    let thrown: unknown = 'missing';
    try {
      observed.session.send('Runtime.evaluate', {});
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(0);
    expect(observed.writes).toHaveLength(1);
    expect(observed.queued).toEqual([]);
  });

  it('restores owned methods and lets an already queued original callback finish after disposal', () => {
    const observed = observePipe();
    observed.session.send('Runtime.evaluate', {});
    observed.reader.emit('data', Buffer.from('{"id":37,"sessionId":"pipe-session","result":{}}\0'));
    const callback = observed.queued.shift()!;
    observed.dispose();
    expect(observed.writer.write).toBe(observed.originals.write);
    expect(observed.transport._dispatch).toBe(observed.originals.dispatch);
    expect(observed.transport._waitForNextTask).toBe(observed.originals.schedule);
    expect(observed.writer.listenerCount('drain')).toBe(0);
    callback();
    expect(observed.parseCalls).toBe(1);
    expect(observed.replies).toHaveLength(1);
    expect(observed.state.responses).toBe(0);
  });

  it('does not overwrite another writer owner or remove its drain listener', () => {
    const observed = observePipe();
    const foreignWrite = () => true;
    const foreignDrain = () => {};
    observed.writer.write = foreignWrite;
    observed.writer.on('drain', foreignDrain);
    observed.dispose();
    expect(observed.writer.write).toBe(foreignWrite);
    expect(observed.writer.listeners('drain')).toEqual([foreignDrain]);
    expect(observed.errors).toContain('restore-ownership');
  });

  it('reports unavailable pipe shape without preventing the original command', async () => {
    const observed = observePipe({ missingScheduler: true });
    expect(observed.state.available).toBe(false);
    expect(observed.state.reason).toBe('Pinned pipe observation could not be installed');
    expect(observed.session.send('Runtime.evaluate', {})).toBe(observed.promise);
    expect(await observed.promise).toBe('original');
    expect(observed.writes).toHaveLength(2);
    expect(observed.writer.write).toBe(observed.originals.write);
  });
});

it('hashes retained expression references only after the original verdict', () => {
  let hashes = 0;
  const context: any = {
    verdict: null,
    expressionSources: new Map([
      ['s:1', { identity: { sessionId: 's', id: 1 }, value: 'exact expression' }],
    ]),
    expressionDigests: new Map(),
    sha: (value: string) => {
      hashes++;
      return `digest:${value}`;
    },
    diagnosticError() {},
  };
  const collect = runInNewContext(`(${helper('collectExpressionBindings', 'patchCDP')})`, context);
  expect(collect()).toEqual([]);
  expect(hashes).toBe(0);
  expect(context.expressionSources.size).toBe(1);
  context.verdict = { passed: false };
  expect(collect()).toEqual([
    {
      sessionId: 's',
      id: 1,
      characters: 16,
      sha256: 'digest:exact expression',
      hashedAfterVerdict: true,
    },
  ]);
  expect(hashes).toBe(1);
  expect(context.expressionSources.size).toBe(0);
  collect();
  expect(hashes).toBe(1);
});
