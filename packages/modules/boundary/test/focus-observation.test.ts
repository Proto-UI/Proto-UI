import { describe, expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { BoundaryModuleImpl } from '../src/impl';
import { BOUNDARY_HOST_BRIDGE_CAP, type BoundaryHostBridge } from '../src/caps';

function fixture(
  bridge: BoundaryHostBridge = {
    classify: () => 'outside',
    sampleFocus: (event) => ({ type: 'focusin', target: {}, nativeEvent: event }),
  }
) {
  const caps = new CapsVault();
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const scope = {};
  caps.attachBase([[SYS_CAP, { ensureSetup() {} } as any]]);
  caps.attach([[BOUNDARY_HOST_BRIDGE_CAP, bridge]]);
  const event = {
    getGlobalInputScope: () => scope,
    onGlobal(type: string, cb: (event: unknown) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), cb]);
      return {};
    },
  };
  const boundary = new BoundaryModuleImpl(caps, 'boundary-focus-test', event as any);
  const outside = vi.fn();
  boundary.observe('pointer.press');
  boundary.observe('focus.move');
  boundary.observe('focus.move');
  boundary.subscribeOutside(outside);
  boundary.onMountPhase('mounted', 1);
  const emit = (type: string, event = {}) => listeners.get(type)?.forEach((cb) => cb(event));
  return { caps, boundary, outside, emit, listeners };
}

describe('Boundary focus observation lifetime', () => {
  it('T-BOUNDARY-0002-CASE-FOCUS-LIFETIME: observations are idempotent and unsupported hosts fail closed', () => {
    const f = fixture({ classify: () => 'outside' });
    try {
      expect(f.listeners.get('host:focusin')).toHaveLength(1);
      expect(f.listeners.get('host:pointerdown')).toHaveLength(1);
      f.emit('host:focusin');
      expect(f.outside).not.toHaveBeenCalled();
      expect(f.boundary.getWarnings()).toContain(
        '[Boundary] current focus observation unavailable on this host'
      );
      f.emit('host:pointerdown');
      expect(f.outside.mock.calls[0][0].observation).toBe('pointer.press');
    } finally {
      f.boundary.onProtoPhase('unmounted');
    }
  });

  it('T-BOUNDARY-0002-CASE-FOCUS-LIFETIME: detach clears the last scope lease; reconnect starts a fresh observation and terminal cleanup stops it', () => {
    const f = fixture();
    f.emit('host:pointerdown');
    f.emit('host:focusin');
    expect(f.outside).toHaveBeenCalledTimes(1);
    f.boundary.onMountPhase('detached', 1);
    f.emit('host:focusin');
    expect(f.outside).toHaveBeenCalledTimes(1);
    f.boundary.onMountPhase('mounted', 2);
    f.emit('host:focusin');
    expect(f.outside).toHaveBeenCalledTimes(2);
    expect(f.outside.mock.calls[1][0].observation).toBe('focus.move');
    f.boundary.onProtoPhase('unmounted');
    f.emit('host:focusin');
    f.emit('host:pointerdown');
    expect(f.outside).toHaveBeenCalledTimes(2);
  });

  it.each(['host:pointerup', 'host:pointercancel', 'host:keydown', 'host:blur'])(
    'T-BOUNDARY-0002-CASE-FOCUS-LIFETIME: %s ends pointer suppression',
    (end) => {
      const f = fixture();
      try {
        f.emit('host:pointerdown');
        f.emit('host:focusin');
        f.emit(end);
        f.emit('host:focusin');
        expect(f.outside).toHaveBeenCalledTimes(2);
        expect(f.outside.mock.calls[1][0].observation).toBe('focus.move');
      } finally {
        f.boundary.onProtoPhase('unmounted');
      }
    }
  );

  it('T-BOUNDARY-0002-CASE-FOCUS-LIFETIME: reentrant provider replacement invalidates the old focus sample', () => {
    const bridge = {
      classify: () => 'outside' as const,
      sampleFocus: vi.fn(() => ({ target: {} })),
    };
    const f = fixture(bridge);
    try {
      bridge.sampleFocus.mockImplementationOnce(() => {
        f.caps.attach([[BOUNDARY_HOST_BRIDGE_CAP, { classify: () => 'outside' }]]);
        return { target: {} };
      });
      f.emit('host:focusin');
      expect(f.outside).not.toHaveBeenCalled();
    } finally {
      f.boundary.onProtoPhase('unmounted');
    }
  });

  it('T-BOUNDARY-0002-CASE-FOCUS-LIFETIME: reentrant classification detach cannot publish stale outside', () => {
    const classify = vi.fn(() => 'outside' as const);
    const f = fixture({ classify, sampleFocus: () => ({ target: {} }) });
    classify.mockImplementationOnce(() => {
      f.boundary.onMountPhase('detached', 1);
      return 'outside';
    });
    f.emit('host:focusin');
    expect(f.outside).not.toHaveBeenCalled();
    f.boundary.onProtoPhase('unmounted');
  });
});
