import { afterEach, expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { HOST_ELEMENT_CAP } from '@proto.ui/core';
import { OverlayModuleImpl } from '../src/impl';
import { OVERLAY_TARGET_HOST_CAP, OVERLAY_GLOBAL_MOUNT_CAP } from '../src/caps';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture(mounted = true) {
  const tasks: Array<() => void> = [];
  let phase = 'callback';
  const caps = new CapsVault();
  caps.attachBase([
    [
      SYS_CAP,
      {
        ensureSetup() {},
        ensureCallback() {
          if (phase !== 'callback') throw new Error('outside callback');
        },
        deferAfterCallback(fn: () => void) {
          tasks.push(fn);
        },
      } as any,
    ],
  ]);
  const host = document.createElement('div');
  document.body.append(host);
  const provider = { mount: vi.fn(), unmount: vi.fn() };
  const module = new OverlayModuleImpl(
    caps,
    'barrier-test',
    {
      subscribeOutside: () => () => {},
      setStackActive() {},
      registerRegion: () => () => {},
    } as any,
    {} as any,
    {} as any,
    {} as any,
    { disconnect() {} } as any
  );
  module.setCallbackDispatcher((fn) => {
    const previous = phase;
    phase = 'callback';
    try {
      fn();
    } finally {
      phase = previous;
    }
  });
  const install = (next = provider, target: HTMLElement | null = host) =>
    caps.attach([
      [HOST_ELEMENT_CAP, target],
      [OVERLAY_GLOBAL_MOUNT_CAP, next],
    ]);
  install();
  module.configure({ defaultOpen: true, portal: true, anchored: false });
  module.setViewActive(true);
  if (mounted) module.onMountPhase('mounted', 1);
  const flush = () => {
    const previous = phase;
    phase = 'unknown';
    try {
      while (tasks.length) tasks.shift()!();
    } finally {
      phase = previous;
    }
  };
  flush();
  return { module, caps, provider, host, install, flush, getPhase: () => phase };
}

it('registers asynchronously relative to the callback, after resource acquisition in a legal callback scope', () => {
  const f = fixture(false),
    calls: string[] = [];
  f.provider.mount.mockImplementation(() => {
    calls.push('mount');
  });
  f.module.afterViewReconciled(() => {
    expect(f.getPhase()).toBe('callback');
    calls.push('notify');
  });
  expect(calls).toEqual([]);
  f.module.onMountPhase('mounted', 1);
  expect(calls).toEqual(['mount', 'notify']);
  f.flush();
  expect(calls).toEqual(['mount', 'notify']);
});
it('already reconciled registration waits for a fresh pass and is cancellable exactly once', () => {
  const f = fixture(),
    first = vi.fn(),
    second = vi.fn();
  const off = f.module.afterViewReconciled(first);
  expect(first).not.toHaveBeenCalled();
  off();
  off();
  f.module.afterViewReconciled(second);
  off();
  f.flush();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  f.module.registerAnchor(null);
  f.flush();
  expect(second).toHaveBeenCalledTimes(1);
});
for (const boundary of ['close', 'detach', 'terminal', 'provider', 'target'] as const) {
  it(`cancels a bound request at ${boundary}, without revival on a later view`, () => {
    const f = fixture(),
      callback = vi.fn();
    f.module.afterViewReconciled(callback);
    if (boundary === 'close') f.module.close('author');
    if (boundary === 'detach') f.module.onMountPhase('detached', 1);
    if (boundary === 'terminal') f.module.onProtoPhase('unmounted');
    if (boundary === 'provider') f.install({ mount: vi.fn(), unmount: vi.fn() });
    if (boundary === 'target') {
      f.module.registerContent(f.host);
      f.module.registerContent(document.createElement('div'));
    }
    f.flush();
    if (boundary !== 'terminal') {
      f.module.open('new');
      f.module.setViewActive(true);
      f.module.onMountPhase('mounted', 2);
      f.flush();
    }
    expect(callback).not.toHaveBeenCalled();
  });
}
it('does not notify after a throwing acquisition, preserving its original failure', () => {
  const f = fixture(false),
    callback = vi.fn(),
    original = new Error('mount failed');
  f.provider.mount.mockImplementation(() => {
    throw original;
  });
  f.module.afterViewReconciled(callback);
  expect(() => f.module.onMountPhase('mounted', 1)).toThrow(original);
  f.provider.mount.mockReset();
  f.module.registerAnchor(null);
  f.flush();
  expect(callback).not.toHaveBeenCalled();
});
it('reentrant close during provider acquisition cancels notification', () => {
  const f = fixture(false),
    callback = vi.fn();
  f.provider.mount.mockImplementation(() => f.module.close('author'));
  f.module.afterViewReconciled(callback);
  f.module.onMountPhase('mounted', 1);
  f.flush();
  expect(callback).not.toHaveBeenCalled();
});
it('callback reentry sees a finished transaction, retires its own request before invocation and preserves cleanup', () => {
  const f = fixture(),
    first = vi.fn(),
    second = vi.fn();
  f.module.afterViewReconciled(() => {
    first();
    f.module.close('callback');
  });
  f.module.afterViewReconciled(second);
  f.flush();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  f.module.onMountPhase('detached', 1);
  expect(f.provider.unmount).toHaveBeenCalledTimes(1);
});
it('a throwing callback does not hide its error or prevent independent queued callbacks', () => {
  const f = fixture(),
    original = new Error('callback failed'),
    second = vi.fn();
  f.module.afterViewReconciled(() => {
    throw original;
  });
  f.module.afterViewReconciled(second);
  expect(f.flush).toThrow(original);
  expect(second).toHaveBeenCalledTimes(1);
  f.module.onMountPhase('detached', 1);
  expect(f.provider.unmount).toHaveBeenCalledTimes(1);
});
it('missing target cancels the attempt instead of reviving it after target installation', () => {
  const f = fixture(),
    callback = vi.fn();
  f.install(f.provider, null);
  f.module.afterViewReconciled(callback);
  f.flush();
  f.install(f.provider, f.host);
  f.flush();
  expect(callback).not.toHaveBeenCalled();
});
it('an initial detached request canceled by close does not attach to a later reopened view', () => {
  const f = fixture(false),
    old = vi.fn(),
    fresh = vi.fn();
  f.module.afterViewReconciled(old);
  f.module.close('cancel');
  f.module.open('new');
  f.module.afterViewReconciled(fresh);
  f.module.onMountPhase('mounted', 1);
  f.flush();
  expect(old).not.toHaveBeenCalled();
  expect(fresh).toHaveBeenCalledTimes(1);
});
it('provider replacement reentered during acquisition cannot fulfill the old bound request', () => {
  const f = fixture(false),
    callback = vi.fn();
  const replacement = { mount: vi.fn(), unmount: vi.fn() };
  f.provider.mount.mockImplementation(() => f.install(replacement));
  f.module.afterViewReconciled(callback);
  f.module.onMountPhase('mounted', 1);
  f.flush();
  expect(replacement.mount).toHaveBeenCalledTimes(1);
  expect(callback).not.toHaveBeenCalled();
});

it('same-capability resolver target replacement cancels the exact request', () => {
  const f = fixture(),
    a = {},
    b = {},
    callback = vi.fn();
  let resolved = a;
  f.caps.attach([
    [OVERLAY_TARGET_HOST_CAP, { root: () => a, resolve: () => resolved }],
    [OVERLAY_GLOBAL_MOUNT_CAP, f.provider],
  ]);
  f.flush();
  const epoch = f.caps.epoch;
  f.module.afterViewReconciled(callback);
  resolved = b;
  f.flush();
  expect(f.caps.epoch).toBe(epoch);
  expect(callback).not.toHaveBeenCalled();
  resolved = a;
  f.module.registerAnchor(null);
  f.flush();
  expect(callback).not.toHaveBeenCalled();
});
for (const change of ['anchor', 'position'] as const) {
  it(`does not report an obsolete pass when ${change} changes inside callback preparation`, () => {
    const f = fixture(),
      callback = vi.fn();
    let changed = false;
    f.module.setCallbackDispatcher((fn) => {
      if (!changed) {
        changed = true;
        if (change === 'anchor') f.module.registerAnchor(document.createElement('button'));
        else f.module.updatePosition({ sideOffset: 7 });
      }
      fn();
    });
    f.module.afterViewReconciled(callback);
    f.flush();
    expect(changed).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    f.module.afterViewReconciled(callback);
    f.flush();
    expect(callback).toHaveBeenCalledTimes(1);
  });
}

it('exact disposal during synchronous callback preparation still cancels the consumed queue entry', () => {
  const f = fixture(),
    callback = vi.fn();
  const off = f.module.afterViewReconciled(callback);
  f.module.setCallbackDispatcher((fn) => {
    off();
    fn();
  });
  f.flush();
  expect(callback).not.toHaveBeenCalled();
});
