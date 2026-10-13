import { expect, it } from 'vitest';
import {
  tw,
  type PresentationOwnerFrame,
  type PresentationReceipt,
  type PresentationViewBinding,
  type PresentationOwnerWriter,
} from '@proto.ui/core';
import { createPresenceController } from '../src/presence/controller';
import type { PresencePresentationFrame, PresencePresentationSink } from '../src/presence/sink';
const zero = { px: 0, rootText: 0, ownBox: 0 };
function fixture() {
  const frames: PresencePresentationFrame[] = [];
  const results: PresentationReceipt[] = [];
  let onReceipt: (() => void) | null = null;
  let cancelCount = 0;
  let revision = 0;
  let onCancel: (() => void) | null = null;
  let onRelease: (() => void) | null = null;
  const fallbacks: unknown[] = [];
  const binding = Object.freeze({}) as PresentationViewBinding;
  const sink: PresencePresentationSink = {
    commit: (f) => {
      frames.push(f);
      f.bind(binding);
    },
    cancel: () => {
      cancelCount++;
      const cb = onCancel;
      onCancel = null;
      cb?.();
    },
    settle: () => true,
    release: () => {
      const cb = onRelease;
      onRelease = null;
      cb?.();
    },
  };
  const callbacks: Array<() => void> = [];
  const controller = createPresenceController({
    setup() {},
    runtime() {},
    invalidate() {},
    dispatch: (fn) => fn(),
    callbackContext: () => ({}),
    watch: (_source, cb) => {
      callbacks.push(cb);
      return () => {};
    },
    sink: () => sink,
    fallback(style) {
      fallbacks.push(style);
    },
  });
  const owner = controller.facade.owner();
  owner.onCompletionRequest((_run, { receipt }) => {
    if (controller.facade.isCurrent(owner.writer, receipt)) results.push(receipt);
    onReceipt?.();
  });
  const publish = (phase: PresentationOwnerFrame['phase'] = 'entering') => {
    controller.facade.publish(owner.writer, {
      owner: owner.ref,
      revision: ++revision,
      phase,
      attempt:
        phase === 'entering' || phase === 'leaving'
          ? { ownerEpoch: 1, phaseAttempt: revision }
          : null,
      completion: 'presentation',
      durationMs: 500,
      timeoutMs: 1000,
    });
  };
  const declare = () =>
    controller.declare({
      owner: owner.ref,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0.32, 0.72, 0, 1],
    });
  const commit = () => controller.commit(tw('bg-black/50'), 1, revision);
  return {
    controller,
    owner,
    publish,
    declare,
    commit,
    frames,
    results,
    binding,
    setReceipt: (callback: () => void) => {
      onReceipt = callback;
    },
    cancelCount: () => cancelCount,
    setCancel: (cb: () => void) => {
      onCancel = cb;
    },
    fallbacks,
    setRelease: (cb: () => void) => {
      onRelease = cb;
    },
  };
}
it('declared owner identities reject a matching-looking foreign object', () => {
  const f = fixture();
  expect(() =>
    f.controller.declare({
      owner: {} as any,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    })
  ).toThrow(/Unknown owner/);
  expect(() => f.controller.facade.publish({} as PresentationOwnerWriter, {} as any)).toThrow(
    /Unknown/
  );
});
it('receipts remain current until identity retirement after a real owner callback', () => {
  const f = fixture();
  f.declare();
  f.publish();
  f.commit();
  const frame = f.frames[0];
  frame.complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
  expect(f.controller.facade.isCurrent(f.owner.writer, f.results[0])).toBe(true);
  frame.complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
  f.publish('leaving');
  expect(f.controller.facade.isCurrent(f.owner.writer, f.results[0])).toBe(false);
});
it('older view/phase completion cannot consume a reopened owner', () => {
  const f = fixture();
  f.declare();
  f.publish('leaving');
  f.commit();
  const old = f.frames[0];
  f.publish('entering');
  f.commit();
  old.complete(f.binding, 'finished');
  expect(f.results).toHaveLength(0);
  f.frames[1].complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
});
it('only exact locally registered State sources may resolve selection', () => {
  const f = fixture();
  const source = { get: () => 'bottom' };
  const declaration = {
    owner: f.owner.ref,
    closed: { translate: { source, cases: { bottom: [zero, zero] } } },
    entered: { translate: [zero, zero] },
    easing: [0, 0, 1, 1],
  } as any;
  expect(() => f.controller.declare(declaration)).toThrow(/Unknown selection/);
  f.controller.facade.registerSource(source);
  expect(() => f.controller.declare(declaration)).not.toThrow();
});
it('missing selection mid-flight cancels stale projection before fallback', () => {
  const f = fixture();
  let value = 'bottom';
  const source = { get: () => value };
  f.controller.facade.registerSource(source);
  f.controller.declare({
    owner: f.owner.ref,
    closed: { translate: { source, cases: { bottom: [zero, { ...zero, ownBox: 1 }] } } },
    entered: { translate: [zero, zero] },
    easing: [0, 0, 1, 1],
  });
  f.publish();
  f.commit();
  value = 'invalid';
  f.controller.commit(tw('bg-background'), 1, 2);
  expect(f.cancelCount()).toBe(1);
  expect(f.results.at(-1)?.outcome).toBe('unresolved-input');
  f.frames[0].complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
});
it('release invalidates an otherwise current physical binding', () => {
  const f = fixture();
  f.declare();
  f.publish();
  f.commit();
  f.controller.release();
  f.frames[0].complete(f.binding, 'finished');
  expect(f.results).toHaveLength(0);
});

it('reentrant valid commit during invalid-selection cancellation wins', () => {
  const f = fixture();
  let value = 'bottom';
  const source = { get: () => value };
  f.controller.facade.registerSource(source);
  f.controller.declare({
    owner: f.owner.ref,
    closed: { translate: { source, cases: { bottom: [zero, { ...zero, ownBox: 1 }] } } },
    entered: { translate: [zero, zero] },
    easing: [0, 0, 1, 1],
  });
  f.publish();
  f.commit();
  value = 'invalid';
  f.setCancel(() => {
    value = 'bottom';
    f.publish();
    f.commit();
  });
  f.controller.commit(tw('bg-background'), 1, 2);
  expect(f.fallbacks).toEqual([]);
  expect(f.results).toEqual([]);
  f.frames.at(-1)!.complete(f.binding, 'finished');
  expect(f.results.at(-1)?.outcome).toBe('finished');
});

it('view retirement disposal prevents an outer epoch commit', () => {
  const f = fixture();
  f.declare();
  f.publish();
  f.commit();
  f.setRelease(() => f.controller.dispose());
  expect(() => f.controller.commit(tw('bg-background'), 2, 2)).not.toThrow();
  expect(f.frames).toHaveLength(1);
});
it('nested newer epoch wins during old view retirement', () => {
  const f = fixture();
  f.declare();
  f.publish();
  f.commit();
  f.setRelease(() => f.controller.commit(tw('bg-background'), 3, 3));
  f.controller.commit(tw('bg-background'), 2, 2);
  expect(f.frames.map((frame) => frame.view)).toEqual([1, 3]);
  f.frames.at(-1)!.complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
});

it('same endpoint style commits preserve the live receipt through phase publication', () => {
  const f = fixture();
  f.declare();
  f.publish();
  f.commit();
  f.setReceipt(() => f.controller.commit(tw('text-foreground'), 1, 99));
  f.frames[0].complete(f.binding, 'finished');
  const receipt = f.results[0];
  expect(f.controller.facade.isCurrent(f.owner.writer, receipt)).toBe(true);
  f.frames.at(-1)!.complete(f.binding, 'finished');
  expect(f.results).toHaveLength(1);
  f.controller.release();
  expect(f.controller.facade.isCurrent(f.owner.writer, receipt)).toBe(false);
});
it('changed resolved endpoint retires receipt even without a new phase', () => {
  const f = fixture();
  let side = 'bottom';
  const source = { get: () => side };
  f.controller.facade.registerSource(source);
  f.controller.declare({
    owner: f.owner.ref,
    closed: {
      translate: {
        source,
        cases: { bottom: [zero, { ...zero, ownBox: 1 }], top: [zero, { ...zero, ownBox: -1 }] },
      },
    },
    entered: { translate: [zero, zero] },
    easing: [0, 0, 1, 1],
  });
  f.publish();
  f.commit();
  f.frames[0].complete(f.binding, 'finished');
  const receipt = f.results[0];
  side = 'top';
  f.controller.commit(tw('bg-background'), 1, 1);
  expect(f.controller.facade.isCurrent(f.owner.writer, receipt)).toBe(false);
});

it('a changed endpoint during synchronous completion obtains a new current receipt', async () => {
  const { createPresencePresentationProjector } = await import('../src/presence/projector');
  const binding = Object.freeze({}) as PresentationViewBinding;
  const sink = createPresencePresentationProjector({
    binding,
    now: () => 0,
    environment: () => ({
      preference: 'unknown',
      visible: true,
      width: 320,
      height: 200,
      rootFontPx: 16,
      supported: ['translate'],
    }),
    subscribe: () => () => {},
    requestFrame: () => {
      throw Error('unexpected frame');
    },
    cancelFrame() {},
    project: (_style, _sample, current) => current(),
    release() {},
  });
  const controller = createPresenceController({
    setup() {},
    runtime() {},
    invalidate() {},
    dispatch: (fn) => fn(),
    callbackContext: () => ({}),
    watch: () => () => {},
    sink: () => sink,
    fallback() {},
  });
  const owner = controller.facade.owner();
  let side = 'bottom';
  const source = { get: () => side };
  const receipts: PresentationReceipt[] = [];
  controller.facade.registerSource(source);
  controller.declare({
    owner: owner.ref,
    closed: {
      translate: {
        source,
        cases: { bottom: [zero, { ...zero, ownBox: 1 }], top: [zero, { ...zero, ownBox: -1 }] },
      },
    },
    entered: { translate: [zero, zero] },
    easing: [0, 0, 1, 1],
  });
  owner.onCompletionRequest((_run, { receipt }) => {
    receipts.push(receipt);
    if (receipts.length === 1) {
      side = 'top';
      controller.commit(tw('bg-background'), 1, 2);
    }
  });
  controller.facade.publish(owner.writer, {
    owner: owner.ref,
    revision: 1,
    phase: 'entering',
    attempt: { ownerEpoch: 1, phaseAttempt: 1 },
    completion: 'presentation',
    durationMs: 500,
    timeoutMs: 1000,
  });
  controller.commit(tw('bg-background'), 1, 1);
  expect(receipts).toHaveLength(2);
  expect(controller.facade.isCurrent(owner.writer, receipts[0])).toBe(false);
  expect(controller.facade.isCurrent(owner.writer, receipts[1])).toBe(true);
  controller.dispose();
});
