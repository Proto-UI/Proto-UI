// @vitest-environment node
import { readFileSync } from 'node:fs';
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
