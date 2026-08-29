import { describe, expect, expectTypeOf, it } from 'vitest';
import { definePrototype, type ImageViewStatusChange, type Prototype } from '@proto.ui/core';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import {
  IMAGE_VIEW_HOST_CAP,
  IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
  type ImageViewHost,
  type ImageViewHostConnection,
  type ImageViewHostUpdate,
} from '@proto.ui/module-image-view';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import imageRoot, {
  asImageRoot,
  imageRoot as namedImageRoot,
  type ImageRootExposes,
  type ImageRootProps,
} from '../src/image';

type HostRecord = {
  connection: ImageViewHostConnection;
  updates: ImageViewHostUpdate[];
  disposed: number;
};

function createImageHost(initialRaw: Record<string, unknown>) {
  let raw = { ...initialRaw };
  let exposes: Record<string, any> = {};
  const emitted: Array<{ key: string; payload: unknown }> = [];
  const records: HostRecord[] = [];
  let invokeInCallbackScope: ((callback: () => void) => void) | undefined;
  const imageHost: ImageViewHost = {
    attach(connection) {
      const record: HostRecord = { connection, updates: [], disposed: 0 };
      records.push(record);
      return {
        update(update) {
          record.updates.push(update);
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
    },
  };
  const host: RuntimeHost<any> = {
    prototypeName: 'base-image-root-test-host',
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('image-view', [
        [IMAGE_VIEW_HOST_CAP, imageHost],
        [
          IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
          (callback: () => void) => {
            if (invokeInCallbackScope) invokeInCallbackScope(callback);
            else callback();
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next)],
      ]);
      wiring.attach('expose-event', [
        [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => emitted.push({ key, payload })],
      ]);
    },
  };
  return {
    host,
    records,
    emitted,
    bindRuntime(callback: (task: () => void) => void) {
      invokeInCallbackScope = callback;
    },
    setRawProps(next: Record<string, unknown>) {
      raw = { ...next };
    },
    getExposes: () => exposes,
  };
}

describe('prototypes/base: image', () => {
  it('keeps the direct, named, and authored asHook entries aligned', () => {
    expectTypeOf<ImageRootProps>().toEqualTypeOf<{
      source?: string;
      a11yMode?: ImageRootProps['a11yMode'];
      alternativeText?: string;
      fit?: ImageRootProps['fit'];
    }>();
    expect(namedImageRoot).toBe(imageRoot);
    expect(imageRoot.modules).toEqual(asImageRoot.modules);
    expect(imageRoot.modules).toHaveLength(1);
    expect(imageRoot.modules?.[0]?.config).toMatchObject({
      source: '',
      alternativeText: '',
      a11yMode: 'informative',
      fit: 'contain',
    });
    expectTypeOf<ImageRootProps['fit']>().toEqualTypeOf<'contain' | 'cover' | 'fill' | undefined>();
    expectTypeOf<ImageRootExposes['loadingStatusChange']>().not.toBeNever();
  });

  it('synchronizes props through Image View and exposes canonical status transitions', () => {
    const ctx = createImageHost({
      source: 'image:hero',
      a11yMode: 'informative',
      alternativeText: 'Hero',
      fit: 'cover',
    } satisfies ImageRootProps);
    const result = executeWithHost(imageRoot as Prototype<any>, ctx.host);
    ctx.bindRuntime(result.invokeInCallbackScope);

    const record = ctx.records[0];
    expect(record.connection.patch).toMatchObject({
      source: 'image:hero',
      a11yMode: 'informative',
      alternativeText: 'Hero',
      fit: 'cover',
      loadingStatus: 'loading',
    });
    expect(result.children).toBeNull();
    expect(ctx.getExposes().source.get()).toBe('image:hero');
    expect(ctx.getExposes().fit.get()).toBe('cover');
    expect(ctx.getExposes().loadingStatus.get()).toBe('loading');

    record.connection.onStatusChange({
      generation: record.connection.generation,
      status: 'loaded',
    });

    expect(ctx.getExposes().loadingStatus.get()).toBe('loaded');
    expect(ctx.emitted.at(-1)).toEqual({
      key: 'loadingStatusChange',
      payload: {
        source: 'image:hero',
        previousStatus: 'loading',
        status: 'loaded',
      } satisfies ImageViewStatusChange,
    });
  });

  it('follows source updates when the initial source is controlled', () => {
    const ctx = createImageHost({
      source: 'image:controlled-a',
      a11yMode: 'informative',
      alternativeText: 'Controlled A',
      fit: 'contain',
    } satisfies ImageRootProps);
    const result = executeWithHost(imageRoot as Prototype<any>, ctx.host);
    ctx.bindRuntime(result.invokeInCallbackScope);
    const record = ctx.records[0];
    expect(record.connection.patch.source).toBe('image:controlled-a');

    ctx.setRawProps({
      source: 'image:controlled-b',
      a11yMode: 'informative',
      alternativeText: 'Controlled B',
      fit: 'cover',
    });
    result.controller.applyRawProps(ctx.host.getRawProps());

    expect(record.updates.at(-1)?.patch).toMatchObject({
      source: 'image:controlled-b',
      alternativeText: 'Controlled B',
      fit: 'cover',
      loadingStatus: 'loading',
    });
    expect(ctx.getExposes().source.get()).toBe('image:controlled-b');
  });

  it('can consume the same protocol through asImageRoot without anatomy materialization', () => {
    const Authored: Prototype<ImageRootProps> = definePrototype({
      name: 'x-authored-image-root',
      modules: asImageRoot.modules,
      setup() {
        asImageRoot();
        return () => null;
      },
    });
    const ctx = createImageHost({
      source: 'image:authored',
      a11yMode: 'informative',
      alternativeText: 'Authored',
    } satisfies ImageRootProps);
    const result = executeWithHost(Authored, ctx.host);
    ctx.bindRuntime(result.invokeInCallbackScope);

    expect(ctx.records).toHaveLength(1);
    expect(ctx.records[0].connection.patch.source).toBe('image:authored');
  });
});
