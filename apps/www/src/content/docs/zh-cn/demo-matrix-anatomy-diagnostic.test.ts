import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../../../../../../packages/modules/anatomy/src/impl';
import { makeCaps } from '../../../../../../packages/modules/anatomy/test/utils/fake-caps';
import {
  createMatrixAnatomyConsoleJournal,
  installMatrixAnatomyNotificationDiagnostic,
} from './demo-matrix-anatomy-diagnostic';

const key = '__puiMatrixAnatomyNotificationDiagnostic';
const prefix = '[matrix-anatomy-notification] ';
const original = Object.getOwnPropertyDescriptor(globalThis, key);
const disposers: Array<() => void> = [];
const cancellations: Array<() => void> = [];
const owners: AnatomyModuleImpl[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  if (original) Object.defineProperty(globalThis, key, original);
  else Reflect.deleteProperty(globalThis, key);
  for (const cancel of cancellations.splice(0).reverse()) cancel();
  for (const owner of owners.splice(0).reverse()) owner.dispose();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function hook() {
  return Object.getOwnPropertyDescriptor(globalThis, key)!.value as {
    begin(family: object, indexed: number): unknown;
    finish(ticket: unknown, visited: number, completed: boolean): void;
  };
}
function observation() {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const output = vi.spyOn(console, 'info').mockImplementation(() => {});
  disposers.push(installMatrixAnatomyNotificationDiagnostic({ enabled: true }));
  return {
    clock,
    output,
    time(value: number) {
      now = value;
    },
    advance(value: number) {
      now += value;
    },
    rows: () => output.mock.calls.map(([line]) => JSON.parse(String(line).slice(prefix.length))),
  };
}
function fixture() {
  const family = createAnatomyFamily('matrix-notification-fixture', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root = {};
  const getParent = (instance: unknown) => (instance === root ? null : root);
  const make = (role?: 'root' | 'item') => {
    const instance = role === 'root' ? root : {};
    const owner = new AnatomyModuleImpl(
      makeCaps({
        instance,
        getParent,
        getPrototype: () => ({ name: 'matrix-diagnostic-owner', setup() {} }),
      }),
      'matrix-diagnostic-owner',
      {
        get: () => undefined,
        getAll: () => ({}),
        has: () => false,
        keys: () => [],
      }
    );
    owners.push(owner);
    if (role) owner.claim(family, { role });
    return owner;
  };
  const rootOwner = make('root');
  make('item');
  return {
    family,
    add: () => make('item'),
    notify: () => rootOwner.port.syncStructure(),
    subscribe(callback: () => void) {
      cancellations.push(make().port.subscribeOrder(family, callback));
    },
  };
}

describe('bounded diagnostic-only Anatomy notification observation', () => {
  it('leaves the original flag-off notification path clock-free', () => {
    const f = fixture();
    const listener = vi.fn();
    f.subscribe(listener);
    const clock = vi.spyOn(performance, 'now');
    const output = vi.spyOn(console, 'info');
    installMatrixAnatomyNotificationDiagnostic({ enabled: false })();
    f.add();
    f.notify();
    expect(listener).toHaveBeenCalledOnce();
    expect(clock).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(globalThis, key)).toBeUndefined();
  });

  it('serializes without module-private dependencies and observes existing family data', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {});
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const dispose = new Function(
      `return (${installMatrixAnatomyNotificationDiagnostic.toString()})({enabled:true})`
    )();
    disposers.push(dispose);
    const family = Object.freeze({ debugName: 'shadcn-calendar' });
    const ticket = hook().begin(family, 12);
    now = 40;
    hook().finish(ticket, 9, true);
    const row = JSON.parse(String(output.mock.calls[0]![0]).slice(prefix.length));
    expect(row.currentFamily).toMatchObject({
      key: 'family-1',
      name: 'shadcn-calendar',
      notifications: 1,
      indexedSubscribers: 12,
      visitedSubscribers: 9,
      inclusiveMs: 40,
      maxNotificationMs: 40,
    });
  });

  it('counts actual visited recipients without enumerating them a second time', () => {
    const f = fixture();
    const o = observation();
    f.subscribe(() => o.advance(20));
    f.subscribe(() => o.advance(35));
    f.add();
    o.time(10);
    f.notify();
    expect(o.rows().at(-1)?.totals).toMatchObject({
      notifications: 1,
      indexedSubscribers: 2,
      visitedSubscribers: 2,
      inclusiveMs: 55,
      maxNotificationMs: 55,
      maxDepth: 1,
      aborted: 0,
    });
  });

  for (const fault of ['begin', 'finish'] as const) {
    it(`preserves an original throw of undefined when diagnostic ${fault} also throws`, () => {
      const f = fixture();
      const later = vi.fn();
      f.subscribe(() => {
        throw undefined;
      });
      f.subscribe(later);
      const finish = vi.fn(() => {
        if (fault === 'finish') throw new Error('observation failure');
      });
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: {
          enabled: true,
          begin() {
            if (fault === 'begin') throw new Error('observation failure');
            return {};
          },
          finish,
        },
      });
      f.add();
      let caught = false;
      let failure: unknown = 'not-thrown';
      try {
        f.notify();
      } catch (error) {
        caught = true;
        failure = error;
      }
      expect(caught).toBe(true);
      expect(failure).toBeUndefined();
      expect(later).not.toHaveBeenCalled();
      if (fault === 'finish') expect(finish).toHaveBeenCalledWith(expect.any(Object), 1, false);
      else expect(finish).not.toHaveBeenCalled();
    });
  }

  it('records aborted notifications and suppresses a failing console sink', () => {
    const f = fixture();
    const o = observation();
    const failure = new Error('author failure');
    f.subscribe(() => {
      o.advance(25);
      throw failure;
    });
    f.add();
    expect(() => f.notify()).toThrow(failure);
    expect(o.rows().at(-1)?.totals).toMatchObject({
      notifications: 1,
      aborted: 1,
      visitedSubscribers: 1,
      inclusiveMs: 25,
    });
    o.output.mockImplementation(() => {
      throw new Error('console unavailable');
    });
    f.add();
    o.time(3000);
    expect(() => f.notify()).toThrow(failure);
  });

  it('keeps nested finally observations distinct and labels inclusive duration', () => {
    const f = fixture();
    const o = observation();
    let nested = false;
    f.subscribe(() => {
      if (nested) {
        o.advance(11);
        return;
      }
      nested = true;
      o.advance(5);
      f.add();
      f.notify();
      o.advance(7);
    });
    f.subscribe(() => o.advance(13));
    f.add();
    f.notify();
    expect(o.rows()[0]?.totals).toMatchObject({ notifications: 1, maxDepth: 2, inclusiveMs: 24 });
    o.time(2001);
    f.notify();
    expect(o.rows().at(-1)?.totals).toMatchObject({
      notifications: 3,
      visitedSubscribers: 6,
      maxDepth: 2,
      inclusiveMs: 60,
      maxNotificationMs: 36,
    });
    expect(o.rows().at(-1)?.meaning).toContain('nested durations are inclusive');
  });

  it('retains time buckets across the whole original window without timers or early exhaustion', () => {
    const o = observation();
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const interval = vi.spyOn(globalThis, 'setInterval');
    const family = { debugName: 'calendar' };
    for (let at = 0; at < 180_000; at += 1000) {
      o.time(at);
      const ticket = hook().begin(family, 300);
      o.advance(0.25);
      hook().finish(ticket, 300, true);
    }
    const rows = o.rows();
    expect(rows).toHaveLength(22);
    expect(rows.at(-1)).toMatchObject({ bucket: 21, limits: { windowMs: 180_000, maxEvents: 32 } });
    expect(rows.at(-1).elapsedMs).toBeGreaterThanOrEqual(170_000);
    o.time(180_000);
    expect(hook().begin(family, 300)).toBeUndefined();
    expect(o.rows()).toHaveLength(22);
    expect(timer).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });

  it('bounds family storage and leaders without sorting or iterating the family map per bucket', () => {
    const o = observation();
    const families = Array.from({ length: 150 }, (_, index) => ({ debugName: `family-${index}` }));
    const sorts = vi.spyOn(Array.prototype, 'sort');
    const values = vi.spyOn(Map.prototype, 'values');
    const entries = vi.spyOn(Map.prototype, 'entries');
    const iterator = vi.spyOn(Map.prototype, Symbol.iterator);
    for (let index = 0; index < families.length; index++) {
      o.time(index * 10);
      const ticket = hook().begin(families[index]!, index);
      o.advance(1);
      hook().finish(ticket, index, true);
    }
    o.time(2001);
    hook().finish(hook().begin(families[0]!, 1), 1, true);
    expect(sorts).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
    expect(entries).not.toHaveBeenCalled();
    expect(iterator).not.toHaveBeenCalled();
    const row = o.rows().at(-1);
    expect(row.trackedFamilies).toBe(128);
    expect(row.overflowNotifications).toBe(22);
    expect(row.leaders).toHaveLength(8);
    expect(row.totals.notifications).toBe(151);
    for (const [line] of o.output.mock.calls)
      expect(Buffer.byteLength(String(line))).toBeLessThan(16_384);
  });

  it('does not invoke family-name getters or overwrite a successor diagnostic owner', () => {
    const o = observation();
    const get = vi.fn(() => {
      throw new Error('user getter');
    });
    const family = Object.defineProperty({}, 'debugName', { get });
    hook().finish(hook().begin(family, 0), 0, true);
    expect(get).not.toHaveBeenCalled();
    expect(o.rows()[0].currentFamily.name).toBe('[non-data-or-noncanonical-name]');
    const successor = {};
    Object.defineProperty(globalThis, key, { configurable: true, value: successor });
    disposers.at(-1)!();
    expect(Object.getOwnPropertyDescriptor(globalThis, key)?.value).toBe(successor);
  });

  it('does not let initial clock failure create a page error or install a partial owner', () => {
    vi.spyOn(performance, 'now').mockImplementation(() => {
      throw new Error('clock unavailable');
    });
    expect(() => installMatrixAnatomyNotificationDiagnostic({ enabled: true })()).not.toThrow();
    expect(Object.getOwnPropertyDescriptor(globalThis, key)).toBeUndefined();
  });

  it('persists each accepted console record synchronously in Node with exact source and phase', () => {
    const directory = mkdtempSync(join(tmpdir(), 'matrix-anatomy-journal-'));
    directories.push(directory);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let phase = 'route-open';
    const journal = createMatrixAnatomyConsoleJournal({
      directory,
      sourceSha: 'exact-source',
      caseName: 'original / representative',
      phase: () => phase,
    });
    const text =
      prefix + JSON.stringify({ kind: 'anatomy-notification', diagnosticOnly: true, sequence: 1 });
    journal(text);
    const outputDirectory = join(directory, 'demo-matrix', 'anatomy-notifications');
    const path = join(outputDirectory, readdirSync(outputDirectory)[0]!);
    expect(JSON.parse(readFileSync(path, 'utf8').trim())).toMatchObject({
      sourceSha: 'exact-source',
      phase: 'route-open',
    });
    phase = 'inited-count';
    for (let index = 0; index < 50; index++) journal(text);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(32);
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({
      sourceSha: 'exact-source',
      phase: 'inited-count',
    });
    journal(prefix + 'x'.repeat(20_000));
    expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(32);
  });

  it('does not overwrite an existing journal and keeps observation write failures nonfatal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'matrix-anatomy-journal-'));
    directories.push(directory);
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('stdout unavailable');
    });
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('stderr unavailable');
    });
    const options = {
      directory,
      sourceSha: 'exact-source',
      caseName: 'original',
      phase: () => 'inited-count',
    };
    const first = createMatrixAnatomyConsoleJournal(options);
    const text = prefix + JSON.stringify({ kind: 'anatomy-notification', diagnosticOnly: true });
    expect(() => first(text)).not.toThrow();
    const path = join(directory, 'demo-matrix', 'anatomy-notifications', 'original.ndjson');
    const retained = readFileSync(path, 'utf8');
    const second = createMatrixAnatomyConsoleJournal(options);
    expect(() => second(text)).not.toThrow();
    expect(readFileSync(path, 'utf8')).toBe(retained);
    expect(warning).toHaveBeenCalledTimes(2);
  });
});
