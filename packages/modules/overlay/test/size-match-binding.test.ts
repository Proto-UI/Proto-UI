// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  createAnatomyFamily,
  type AnatomyPartView,
  type AnchoredPositionConnection,
  type TargetAlignmentStatus,
} from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { AnatomyModuleImpl } from '../../anatomy/src/impl';
import { createSysCaps, makeCaps } from '../../anatomy/test/utils/fake-caps';
import { OverlayModuleImpl } from '../src/impl';
import { OVERLAY_TARGET_HOST_CAP } from '../src/caps';

// The proposed safe interface is authored independently of its implementation.
// The old product lacks this entry. Optional invocation lets the real ordinary
// connection reach assertions instead of failing with a missing-method exception.
type SafeSizeBinding = Readonly<{
  family: ReturnType<typeof createAnatomyFamily>;
  surface: AnatomyPartView;
  reference: AnatomyPartView;
  targets: readonly AnatomyPartView[];
  onSizeMatch(status: TargetAlignmentStatus): void;
}>;

function fixture() {
  const family = createAnatomyFamily('safe-edge-size-test', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      content: { cardinality: { min: 0, max: '*' } },
      surface: { cardinality: { min: 0, max: '*' } },
      trigger: { cardinality: { min: 0, max: '*' } },
      row: { cardinality: { min: 0, max: '*' } },
    },
  });
  const parents = new Map<object, object | null>();
  const all: AnatomyModuleImpl[] = [];
  const add = (role: string, parent: object | null = null) => {
    const token = {};
    let target: object | null = { role };
    const sys = createSysCaps();
    parents.set(token, parent);
    const impl = new AnatomyModuleImpl(
      makeCaps({
        sys,
        instance: token,
        getParent: (instance) => parents.get(instance as object) ?? null,
        getPrototype: () => ({ name: role, setup() {} }),
        getRootTarget: () => target,
      }),
      role,
      { get: () => null, getAll: () => ({}), has: () => false, keys: () => [] } as any
    );
    impl.claim(family, { role });
    sys.__setExecPhase('callback');
    all.push(impl);
    return {
      token,
      impl,
      get target() {
        return target;
      },
      replace(next: object | null) {
        target = next;
      },
    };
  };
  const root = add('root');
  const owner = add('content', root.token);
  const surface = add('surface', owner.token);
  const row = add('row', surface.token);
  const trigger = add('trigger', root.token);
  const part = (item: ReturnType<typeof add>) => {
    const found = (owner.impl.parts(family) ?? []).find(
      (view) => owner.impl.port.resolvePartInstance(view) === item.token
    );
    if (!found) throw new Error('Missing real anatomy fixture part');
    return found;
  };
  const caps = new CapsVault();
  const tasks: Array<() => void> = [];
  caps.attachBase([
    [
      SYS_CAP,
      {
        ensureSetup() {},
        ensureRuntime() {},
        ensureCallback() {},
        deferAfterCallback(callback: () => void) {
          tasks.push(callback);
        },
      } as any,
    ],
  ]);
  const connections: AnchoredPositionConnection[] = [];
  const disconnect = vi.fn();
  const replaceImplicitRoot = vi.fn(() => vi.fn());
  const overlay = new OverlayModuleImpl(
    caps,
    'neutral-size-owner',
    {
      subscribeOutside: () => () => {},
      setStackActive() {},
      registerRegion: () => () => {},
    } as any,
    { replaceImplicitRoot } as any,
    {} as any,
    owner.impl.port,
    {
      connect(connection) {
        connections.push(connection);
      },
      disconnect,
      requestUpdate() {},
      update() {},
      getSnapshot: () => null,
    }
  );
  caps.attach([
    [
      OVERLAY_TARGET_HOST_CAP,
      {
        root: () => owner.target,
        resolve: (candidate: unknown) => (candidate === owner.target ? owner.target : null),
      },
    ],
  ]);
  const flush = () => {
    let remaining = 100;
    while (tasks.length) {
      if (--remaining === 0) throw new Error('Fixture callback queue did not quiesce');
      tasks.shift()!();
    }
  };
  const onSizeMatch = vi.fn();
  const binding: SafeSizeBinding = {
    family,
    surface: part(surface),
    reference: part(trigger),
    targets: [part(row)],
    onSizeMatch,
  };
  const register = (next: SafeSizeBinding | null) => {
    const handle = overlay.handle as typeof overlay.handle & {
      registerSizeMatch?: (binding: SafeSizeBinding | null) => void;
    };
    handle.registerSizeMatch?.(next);
    flush();
  };
  overlay.configure({
    defaultOpen: true,
    anchored: true,
    portal: false,
    modal: false,
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    placement: 'right',
    align: 'end',
    sideOffset: 7,
    alignOffset: 3,
  });
  overlay.registerTrigger(trigger.target);
  overlay.registerContent(owner.target);
  overlay.setViewActive(true);
  overlay.onMountPhase('mounted', 1);
  flush();
  return {
    root,
    owner,
    surface,
    row,
    trigger,
    add,
    part,
    binding,
    register,
    overlay,
    connections,
    onSizeMatch,
    disconnect,
    replaceImplicitRoot,
    flush,
    last() {
      const latest = connections.at(-1);
      if (!latest) throw new Error('Real Overlay did not produce an anchored connection');
      return latest;
    },
    dispose() {
      try {
        overlay.onProtoPhase('unmounted');
        flush();
      } finally {
        all.reverse().forEach((item) => item.dispose());
      }
    },
  };
}

describe('safe independent edge size binding', () => {
  it('preserves ordinary edge placement when no safe size binding is registered', () => {
    const f = fixture();
    try {
      const connection = f.last();
      expect(connection.anchor).toBe(f.trigger.target);
      expect(connection.floating).toBe(f.owner.target);
      expect(connection.config).toMatchObject({
        side: 'right',
        align: 'end',
        sideOffset: 7,
        alignOffset: 3,
      });
      expect(connection.sizeMatch).toBeUndefined();
      expect(connection.targetAlignment).toBeUndefined();
    } finally {
      f.dispose();
    }
  });

  it('delivers real safe parts to an edge connection without selecting target alignment', () => {
    const f = fixture();
    try {
      f.register(f.binding);
      const connection = f.last();
      expect(connection.sizeMatch).toEqual({
        reference: f.trigger.target,
        targets: [f.row.target],
      });
      expect(connection.floating).toBe(f.surface.target);
      expect(connection.anchor).toBe(f.trigger.target);
      expect(connection.targetAlignment).toBeUndefined();
      expect(connection.config).toMatchObject({
        side: 'right',
        align: 'end',
        sideOffset: 7,
        alignOffset: 3,
      });
      expect(f.onSizeMatch).not.toHaveBeenCalled();
      connection.onSizeMatch?.({ status: 'applied' });
      expect(f.onSizeMatch).toHaveBeenCalledTimes(1);
      expect(f.onSizeMatch).toHaveBeenCalledWith({ status: 'applied' });
      expect(f.replaceImplicitRoot).toHaveBeenCalledWith(f.surface.target);
    } finally {
      f.dispose();
    }
  });

  it('rejects stale and physically replaced delivery while allowing only the current binding', () => {
    const f = fixture();
    try {
      f.register(f.binding);
      const first = f.last();
      expect(first.sizeMatch?.targets).toEqual([f.row.target]);
      const successor = vi.fn();
      f.register({ ...f.binding, onSizeMatch: successor });
      const second = f.last();
      first.onSizeMatch?.({ status: 'applied' });
      expect(f.onSizeMatch).not.toHaveBeenCalled();
      expect(successor).not.toHaveBeenCalled();
      second.onSizeMatch?.({ status: 'applied' });
      expect(successor).toHaveBeenCalledTimes(1);
      expect(successor).toHaveBeenCalledWith({ status: 'applied' });
      successor.mockClear();
      f.row.replace({ replacement: true });
      second.onSizeMatch?.({ status: 'applied' });
      expect(successor).not.toHaveBeenCalled();
      f.register(null);
      second.onSizeMatch?.({ status: 'applied' });
      expect(successor).not.toHaveBeenCalled();
      expect(f.last().sizeMatch).toBeUndefined();
      expect(f.last().floating).toBe(f.owner.target);
    } finally {
      f.dispose();
    }
  });
});

it('refuses empty, duplicate and same-domain outside-surface target associations', () => {
  const f = fixture();
  try {
    for (const targets of [
      [],
      [f.binding.targets[0], f.binding.targets[0]],
      [f.binding.reference],
    ]) {
      f.onSizeMatch.mockClear();
      const before = f.connections.length;
      f.register({ ...f.binding, targets });
      expect(f.connections).toHaveLength(before);
      expect(f.onSizeMatch).toHaveBeenCalledWith({
        status: 'unavailable',
        reason: 'invalid-association',
      });
      expect(f.onSizeMatch).not.toHaveBeenCalledWith({ status: 'applied' });
    }
  } finally {
    f.dispose();
  }
});

it('does not adopt another overlay owners surface or another anatomy domain', () => {
  const f = fixture();
  try {
    const otherOwner = f.add('content', f.root.token);
    const otherSurface = f.add('surface', otherOwner.token);
    const otherRow = f.add('row', otherSurface.token);
    f.register({ ...f.binding, surface: f.part(otherSurface), targets: [f.part(otherRow)] });
    expect(f.onSizeMatch).toHaveBeenCalledWith({
      status: 'unavailable',
      reason: 'invalid-association',
    });
    expect(f.replaceImplicitRoot).not.toHaveBeenCalledWith(otherSurface.target);
    const foreignRoot = f.add('root');
    const foreignRow = f.add('row', foreignRoot.token);
    const foreignPart = foreignRow.impl.partsOf(f.binding.family, 'row')?.[0];
    expect(foreignPart).toBeDefined();
    if (!foreignPart) throw new Error('Missing foreign-domain fixture');
    f.onSizeMatch.mockClear();
    f.register({ ...f.binding, targets: [foreignPart] });
    expect(f.onSizeMatch).toHaveBeenCalledWith({
      status: 'unavailable',
      reason: 'invalid-association',
    });
    expect(f.onSizeMatch).not.toHaveBeenCalledWith({ status: 'applied' });
  } finally {
    f.dispose();
  }
});

it('requires the safe reference to be the actual current anchor and fences anchor replacement', () => {
  const f = fixture();
  try {
    f.overlay.registerAnchor({ unrelatedAnchor: true });
    f.flush();
    const before = f.connections.length;
    f.register(f.binding);
    expect(f.connections).toHaveLength(before);
    expect(f.onSizeMatch).toHaveBeenCalledWith({
      status: 'unavailable',
      reason: 'invalid-association',
    });
    f.overlay.registerAnchor(f.trigger.target);
    f.flush();
    const current = f.last();
    expect(current.sizeMatch?.reference).toBe(f.trigger.target);
    f.onSizeMatch.mockClear();
    // Do not flush: old delivery must be fenced even before deferred reconciliation.
    f.overlay.registerAnchor({ successorAnchor: true });
    current.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
  } finally {
    f.dispose();
  }
});

it('keeps missing physical surfaces pending and resumes only through a new current resolution', () => {
  const f = fixture();
  try {
    const surface = f.surface.target;
    f.surface.replace(null);
    const before = f.connections.length;
    f.register(f.binding);
    expect(f.connections).toHaveLength(before);
    expect(f.onSizeMatch).toHaveBeenCalledWith({
      status: 'pending-target',
      reason: 'missing-target',
    });
    expect(f.onSizeMatch).not.toHaveBeenCalledWith({
      status: 'unavailable',
      reason: 'invalid-association',
    });
    f.surface.replace(surface);
    f.overlay.reconcileViewResourcesAfterCallback();
    f.flush();
    f.onSizeMatch.mockClear();
    const ready = f.last();
    expect(ready.floating).toBe(surface);
    ready.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).toHaveBeenCalledTimes(1);
    expect(f.onSizeMatch).toHaveBeenCalledWith({ status: 'applied' });
  } finally {
    f.dispose();
  }
});

it('freezes caller target lists and revalidates retired membership at delivery', () => {
  const f = fixture();
  try {
    const targets = [f.binding.targets[0]];
    f.register({ ...f.binding, targets });
    const current = f.last();
    targets.splice(0, 1, f.binding.reference);
    expect(current.sizeMatch?.targets).toEqual([f.row.target]);
    expect(Object.isFrozen(current.sizeMatch)).toBe(true);
    expect(Object.isFrozen(current.sizeMatch?.targets)).toBe(true);
    f.row.impl.dispose();
    current.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalledWith({ status: 'applied' });
  } finally {
    f.dispose();
  }
});

it('invalidates closed and unmounted deliveries without reopening or acquiring focus', () => {
  const f = fixture();
  try {
    f.register(f.binding);
    const first = f.last();
    f.overlay.close('programmatic');
    first.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
    expect(f.overlay.isOpen()).toBe(false);
    f.overlay.open('programmatic');
    first.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
    f.overlay.setViewActive(true);
    // A retained view still needs the same explicit resource pass requested by its consumer.
    f.overlay.reconcileViewResourcesAfterCallback();
    f.flush();
    const reopened = f.last();
    expect(reopened).not.toBe(first);
    f.overlay.onProtoPhase('unmounted');
    reopened.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
  } finally {
    f.dispose();
  }
});

it('retains only the latest registration when author notification synchronously replaces it', () => {
  const f = fixture();
  try {
    const next = vi.fn();
    const first = vi.fn(() => f.register({ ...f.binding, onSizeMatch: next }));
    f.register({ ...f.binding, onSizeMatch: first });
    const previous = f.last();
    previous.onSizeMatch?.({ status: 'applied' });
    expect(first).toHaveBeenCalledTimes(1);
    const current = f.last();
    expect(current).not.toBe(previous);
    previous.onSizeMatch?.({ status: 'applied' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    current.onSizeMatch?.({ status: 'applied' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ status: 'applied' });
  } finally {
    f.dispose();
  }
});

it('withdraws an otherwise current live connection without relying on physical replacement', () => {
  const f = fixture();
  try {
    f.register(f.binding);
    const live = f.last();
    live.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).toHaveBeenCalledTimes(1);
    f.onSizeMatch.mockClear();
    // No part or physical target changed: withdrawal alone must revoke delivery.
    f.register(null);
    live.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
    expect(f.last().sizeMatch).toBeUndefined();
    expect(f.last().floating).toBe(f.owner.target);
  } finally {
    f.dispose();
  }
});

it('makes edge sizing and target alignment alternative intents with independent stale callbacks', () => {
  const f = fixture();
  try {
    const target = f.add('row', f.row.token);
    const aligned = vi.fn();
    f.register(f.binding);
    const sized = f.last();
    f.overlay.registerTargetAlignment({
      family: f.binding.family,
      surface: f.binding.surface,
      scrollport: f.binding.targets[0],
      blockReference: f.binding.reference,
      inlineReference: f.binding.reference,
      blockTarget: f.part(target),
      inlineTarget: f.part(target),
      atStart: true,
      atEnd: true,
      constraints: {
        boundary: 'layout-viewport',
        margin: 10,
        minimumTargetSpanCount: 5,
        inlineOverflow: 'preserve-start',
        expandOnScroll: true,
      },
      onAlignment: aligned,
    });
    f.flush();
    const alignment = f.last();
    expect(alignment.sizeMatch).toBeUndefined();
    expect(alignment.targetAlignment?.blockTarget).toBe(target.target);
    sized.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
    alignment.onAlignment?.({ status: 'applied' });
    expect(aligned).toHaveBeenCalledTimes(1);
    aligned.mockClear();
    f.register(f.binding);
    alignment.onAlignment?.({ status: 'applied' });
    expect(aligned).not.toHaveBeenCalled();
    expect(f.last().targetAlignment).toBeUndefined();
    expect(f.last().sizeMatch?.targets).toEqual([f.row.target]);
  } finally {
    f.dispose();
  }
});

it('exposes and forwards live registration and withdrawal through the real asOverlay consumer handle', async () => {
  const { definePrototype } = await import('@proto.ui/core');
  const { asOverlay } = await import('@proto.ui/hooks');
  const { createRuntimeSession } = await import('../../../runtime/src');
  const f = fixture();
  const delegated = vi.spyOn(OverlayModuleImpl.prototype, 'registerSizeMatch');
  let consumer: import('@proto.ui/core').OverlayHandle | undefined;
  const prototype = definePrototype({
    name: 'safe-edge-hook-consumer',
    setup() {
      consumer = asOverlay();
      return (run) => run.el('div');
    },
  });
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  });
  try {
    await session.mount();
    expect(typeof consumer?.registerSizeMatch).toBe('function');
    session.invokeInCallbackScope(() => consumer!.registerSizeMatch(f.binding));
    session.invokeInCallbackScope(() => consumer!.registerSizeMatch(null));
    expect(delegated).toHaveBeenCalledTimes(2);
    expect(delegated.mock.calls[0][0]).toBe(f.binding);
    expect(delegated.mock.calls[1][0]).toBeNull();
  } finally {
    try {
      await session.dispose();
    } finally {
      delegated.mockRestore();
      f.dispose();
    }
  }
});

it('rejects a previous open cycle on the same physical targets while admitting the reopened owner', () => {
  const f = fixture();
  try {
    f.register(f.binding);
    const old = f.last();
    const targets = old.sizeMatch?.targets;
    f.overlay.close('programmatic');
    f.overlay.open('programmatic');
    old.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).not.toHaveBeenCalled();
    f.register(f.binding);
    const current = f.last();
    expect(current).not.toBe(old);
    expect(current.sizeMatch?.targets).toEqual(targets);
    expect(current.anchor).toBe(old.anchor);
    current.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).toHaveBeenCalledTimes(1);
    expect(f.onSizeMatch).toHaveBeenCalledWith({ status: 'applied' });
    old.onSizeMatch?.({ status: 'applied' });
    expect(f.onSizeMatch).toHaveBeenCalledTimes(1);
  } finally {
    f.dispose();
  }
});
