import { describe, expect, it, vi } from 'vitest';
import type { ImageViewStatusChange, RunHandle } from '@proto.ui/core';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import {
  IMAGE_VIEW_HOST_CAP,
  type ImageViewHost,
  type ImageViewHostCompletion,
  type ImageViewHostConnection,
  type ImageViewHostLease,
  type ImageViewHostUpdate,
} from '../src/caps';
import { createImageViewModule } from '../src/create';
import { declareImageView, IMAGE_VIEW_DECLARATION } from '../src/declaration';

type TestSystemCaps = SystemCaps & {
  phase: 'setup' | 'callback';
};

function createSystemCaps(): TestSystemCaps {
  let phase: 'setup' | 'callback' = 'setup';
  const run = { update() {} } as RunHandle<Record<string, unknown>>;
  return {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'mounted',
    instancePhase: () => 'alive',
    mountPhase: () => 'mounted',
    isDisposed: () => false,
    ensureNotDisposed() {},
    ensureExecPhase(_op, expected) {
      const values = Array.isArray(expected) ? expected : [expected];
      if (!values.includes(phase)) throw new Error('illegal phase');
    },
    ensureSetup() {
      if (phase !== 'setup') throw new Error('illegal phase');
    },
    ensureRuntime() {
      if (phase === 'setup') throw new Error('illegal phase');
    },
    ensureCallback() {
      if (phase !== 'callback') throw new Error('illegal phase');
    },
    getCallbackCtx: () => (phase === 'callback' ? run : undefined),
    deferAfterCallback() {},
    set phase(value: 'setup' | 'callback') {
      phase = value;
    },
  } as TestSystemCaps;
}

type HostRecord = {
  connection: ImageViewHostConnection;
  updates: ImageViewHostUpdate[];
  disposed: number;
  visualSource: string;
};

function createFakeHost(
  onUpdate?: (record: HostRecord, update: ImageViewHostUpdate) => void,
  onAttach?: (record: HostRecord) => void
) {
  const records: HostRecord[] = [];
  const host: ImageViewHost = {
    attach(connection) {
      const record: HostRecord = {
        connection,
        updates: [],
        disposed: 0,
        visualSource:
          connection.patch.loadingStatus === 'loaded' ? (connection.patch.source ?? '') : '',
      };
      records.push(record);
      onAttach?.(record);
      const lease: ImageViewHostLease = {
        update(update) {
          record.updates.push(update);
          const source = update.patch.source ?? connection.patch.source ?? '';
          if (!source || update.patch.loadingStatus === 'idle') record.visualSource = '';
          if (update.patch.loadingStatus === 'loading' && source !== record.visualSource) {
            record.visualSource = '';
          }
          if (update.patch.loadingStatus === 'loaded') record.visualSource = source;
          onUpdate?.(record, update);
        },
        snapshot: () => ({
          source: record.updates.at(-1)?.patch.source ?? connection.patch.source ?? '',
          loadingStatus:
            record.updates.at(-1)?.patch.loadingStatus ?? connection.patch.loadingStatus ?? 'idle',
          fit: record.updates.at(-1)?.patch.fit ?? connection.patch.fit ?? 'contain',
        }),
        dispose() {
          record.disposed += 1;
        },
      };
      return lease;
    },
  };
  return { host, records };
}

function complete(
  record: HostRecord,
  status: ImageViewHostCompletion['status'],
  generation = record.updates.at(-1)?.generation ?? record.connection.generation
): void {
  record.connection.onStatusChange({ generation, status });
}

function createHarness(
  host: ImageViewHost | null = createFakeHost().host,
  declaration = declareImageView({
    source: '',
    alternativeText: '',
    a11yMode: 'informative',
    fit: 'contain',
  })
) {
  const sys = createSystemCaps();
  const vault = new CapsVault();
  vault.attachBase([[SYS_CAP, sys]]);
  if (host) vault.attach([[IMAGE_VIEW_HOST_CAP, host]]);
  const module = createImageViewModule({
    init: {
      prototypeName: 'x-image',
      declarations: [declaration],
    },
    caps: vault,
    deps: {
      requireFacade: () => {
        throw new Error('unused');
      },
      requirePort: () => {
        throw new Error('unused');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  return { sys, vault, module };
}

describe('module-image-view', () => {
  it('declares one host-neutral image-view requirement', () => {
    const declaration = declareImageView({
      source: '',
      alternativeText: '',
      a11yMode: 'informative',
      fit: 'contain',
    });
    expect(declaration).toMatchObject({
      id: IMAGE_VIEW_DECLARATION.id,
      config: {
        source: '',
        alternativeText: '',
        a11yMode: 'informative',
        fit: 'contain',
      },
    });
    expect(JSON.stringify(declaration)).not.toMatch(/HTML|img|Web/);
  });

  it('starts a valid non-empty declared source as a loading generation', () => {
    const fake = createFakeHost();
    const harness = createHarness(
      fake.host,
      declareImageView({
        source: 'image:declared',
        alternativeText: 'Declared image',
        a11yMode: 'informative',
        fit: 'cover',
      })
    );
    const image = harness.module.facade.declare();

    harness.module.hooks.onMountPhase?.('mounted', 1);

    expect(fake.records[0].connection).toMatchObject({
      generation: 1,
      patch: {
        source: 'image:declared',
        loadingStatus: 'loading',
        alternativeText: 'Declared image',
        fit: 'cover',
      },
    });
    expect(image.snapshot()).toEqual({
      source: 'image:declared',
      loadingStatus: 'loading',
      fit: 'cover',
    });
  });

  it('establishes loading before host work and accepts synchronous completion', () => {
    const events: ImageViewStatusChange[] = [];
    const fake = createFakeHost((_record, update) => {
      if (update.patch.source === 'image:a') {
        _record.connection.onStatusChange({
          generation: update.generation,
          status: 'loaded',
        });
      }
    });
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    image.on('loadingStatusChange', (_run, event) => events.push(event));
    harness.module.hooks.onMountPhase?.('mounted', 1);

    harness.sys.phase = 'callback';
    image.sync({
      source: 'image:a',
      a11yMode: 'informative',
      alternativeText: 'A',
      fit: 'cover',
    });

    const update = fake.records[0].updates.find(
      (candidate) => candidate.patch.loadingStatus === 'loading'
    );
    expect(update?.patch).toMatchObject({
      source: 'image:a',
      loadingStatus: 'loading',
      a11yMode: 'informative',
      alternativeText: 'A',
      fit: 'cover',
    });
    expect(events.map(({ previousStatus, status }) => [previousStatus, status])).toEqual([
      ['idle', 'loading'],
      ['loading', 'loaded'],
    ]);
    expect(image.snapshot()).toEqual({
      source: 'image:a',
      loadingStatus: 'loaded',
      fit: 'cover',
    });
  });

  it('installs the completion callback before a synchronous attach result', () => {
    const events: ImageViewStatusChange[] = [];
    const fake = createFakeHost(undefined, (record) => {
      expect(record.connection.patch.loadingStatus).toBe('loading');
      record.connection.onStatusChange({
        generation: record.connection.generation,
        status: 'loaded',
      });
    });
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    image.on('loadingStatusChange', (_run, event) => events.push(event));
    harness.sys.phase = 'callback';
    image.sync({ source: 'image:cached', a11yMode: 'informative', alternativeText: 'Cached' });

    harness.module.hooks.onMountPhase?.('mounted', 1);

    expect(image.snapshot()).toMatchObject({
      source: 'image:cached',
      loadingStatus: 'loaded',
    });
    expect(events.map((event) => event.status)).toEqual(['loading', 'loaded']);
  });

  it('does not restart an equivalent source and rejects A to B to A stale completion', () => {
    const events: ImageViewStatusChange[] = [];
    const fake = createFakeHost();
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    image.on('loadingStatusChange', (_run, event) => events.push(event));
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';

    image.sync({ source: 'image:a', a11yMode: 'informative', alternativeText: 'A' });
    const firstA = fake.records[0].updates.at(-1)!;
    complete(fake.records[0], 'loaded', firstA.generation);
    image.sync({ source: 'image:a' });
    expect(image.snapshot()?.loadingStatus).toBe('loaded');

    image.sync({ source: 'image:b', alternativeText: 'B' });
    const b = fake.records[0].updates.at(-1)!;
    image.sync({ source: 'image:a', alternativeText: 'A again' });
    const secondA = fake.records[0].updates.at(-1)!;

    expect(new Set([firstA.generation, b.generation, secondA.generation]).size).toBe(3);
    complete(fake.records[0], 'error', firstA.generation);
    expect(image.snapshot()).toMatchObject({ source: 'image:a', loadingStatus: 'loading' });
    complete(fake.records[0], 'loaded', secondA.generation);
    expect(image.snapshot()?.loadingStatus).toBe('loaded');
    expect(events.filter((event) => event.status === 'error')).toEqual([]);
  });

  it('clears a retained completed visual immediately when replacing its source', () => {
    const fake = createFakeHost();
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';

    image.sync({ source: 'image:a', a11yMode: 'informative', alternativeText: 'A' });
    complete(fake.records[0], 'loaded');
    expect(fake.records[0].visualSource).toBe('image:a');

    image.sync({ source: 'image:b', alternativeText: 'B' });

    expect(fake.records[0].updates.at(-1)?.patch).toMatchObject({
      source: 'image:b',
      loadingStatus: 'loading',
    });
    expect(fake.records[0].visualSource).toBe('');
  });

  it('fails clearly instead of dropping listeners when async completion lacks callback scope', () => {
    const fake = createFakeHost();
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    image.on('loadingStatusChange', () => {});
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    image.sync({ source: 'image:a', a11yMode: 'informative', alternativeText: 'A' });
    harness.sys.phase = 'setup';

    expect(() => complete(fake.records[0], 'loaded')).toThrowError(
      /IMAGE_VIEW_RUN_IN_CALLBACK_CAP/
    );
    expect(image.snapshot()?.loadingStatus).toBe('loading');
  });

  it('fails closed for invalid a11y input and projects decorative input explicitly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = createFakeHost();
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';

    image.sync({
      source: 'image:missing-name',
      a11yMode: 'informative',
      alternativeText: '',
    });
    expect(image.snapshot()).toEqual({ source: '', loadingStatus: 'idle', fit: 'contain' });
    expect(fake.records[0].updates.at(-1)?.patch).toMatchObject({
      source: '',
      loadingStatus: 'idle',
    });

    image.sync({ alternativeText: 'Named image' });
    expect(image.snapshot()).toMatchObject({
      source: 'image:missing-name',
      loadingStatus: 'loading',
    });

    image.sync({ a11yMode: 'decorative', alternativeText: 'contradiction' });
    expect(image.snapshot()).toMatchObject({ source: '', loadingStatus: 'idle' });

    image.sync({ alternativeText: '' });
    expect(image.snapshot()).toMatchObject({
      source: 'image:missing-name',
      loadingStatus: 'loading',
    });
    expect(fake.records[0].updates.at(-1)?.patch).toMatchObject({
      a11yMode: 'decorative',
      alternativeText: '',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed closed to idle'));
    warn.mockRestore();
  });

  it('accepts one terminal completion and keeps listener dispatch stable under unsubscribe', () => {
    const fake = createFakeHost();
    const harness = createHarness(fake.host);
    const image = harness.module.facade.declare();
    const calls: string[] = [];
    let offFirst = () => {};
    offFirst = image.on('loadingStatusChange', (_run, event) => {
      if (event.status === 'loaded') {
        calls.push('first');
        offFirst();
      }
    });
    image.on('loadingStatusChange', (_run, event) => {
      if (event.status === 'loaded') calls.push('second');
    });
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    image.sync({ source: 'image:a', a11yMode: 'informative', alternativeText: 'A' });
    const generation = fake.records[0].updates.at(-1)!.generation;

    complete(fake.records[0], 'loaded', generation);
    complete(fake.records[0], 'error', generation);
    complete(fake.records[0], 'loaded', generation);

    expect(calls).toEqual(['first', 'second']);
    expect(image.snapshot()?.loadingStatus).toBe('loaded');
  });

  it('rebinds only while mounted and invalidates removed, replaced, detached, and disposed leases', () => {
    const first = createFakeHost();
    const second = createFakeHost();
    const harness = createHarness(first.host);
    const image = harness.module.facade.declare();

    harness.vault.attach([[IMAGE_VIEW_HOST_CAP, second.host]]);
    expect(first.records).toHaveLength(0);
    expect(second.records).toHaveLength(0);

    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    image.sync({ source: 'image:a', a11yMode: 'informative', alternativeText: 'A' });
    expect(second.records).toHaveLength(1);
    const oldConnection = second.records[0];

    harness.vault.resetAttached();
    expect(oldConnection.disposed).toBe(1);
    complete(oldConnection, 'loaded');
    expect(image.snapshot()?.loadingStatus).toBe('loading');

    harness.vault.attach([[IMAGE_VIEW_HOST_CAP, first.host]]);
    expect(first.records).toHaveLength(1);
    const rebound = first.records[0];
    expect(rebound.connection.generation).not.toBe(oldConnection.connection.generation);

    harness.module.hooks.onMountPhase?.('detached', 1);
    expect(rebound.disposed).toBe(1);
    complete(rebound, 'loaded');
    expect(image.snapshot()?.loadingStatus).toBe('loading');

    harness.module.hooks.onMountPhase?.('mounted', 2);
    const remounted = first.records.at(-1)!;
    harness.module.hooks.dispose?.();
    expect(remounted.disposed).toBe(1);
    complete(remounted, 'loaded');
    expect(image.snapshot()).toBeNull();
  });
});
