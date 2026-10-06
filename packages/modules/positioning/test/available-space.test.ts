import { afterEach, expect, it, vi } from 'vitest';
import type { AvailableSpaceRect } from '@proto.ui/core';
import { CapsVault } from '@proto.ui/module-base';
import { AVAILABLE_SPACE_HOST_CAP } from '../src/caps';
import { PositioningModuleImpl } from '../src/impl';
import { createWebAvailableSpaceHost } from '../src/web/available-space-host';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const key = '--proto-ui-available-region-width';
it('keeps a declaration without a host, replaces old leases, and cannot revive after unmount', () => {
  const caps = new CapsVault(),
    module = new PositioningModuleImpl(caps);
  const handle = module.availableHandle,
    target = {};
  const disposes = [vi.fn(), vi.fn()],
    updates = [vi.fn(), vi.fn()];
  const attach = vi.fn((request) => ({
    dispose: disposes[attach.mock.calls.length - 1]!,
    requestUpdate: updates[attach.mock.calls.length - 1]!,
  }));
  handle.connect({ target, boundary: 'root-content' });
  caps.attach([[AVAILABLE_SPACE_HOST_CAP, { attach }]]);
  expect(attach).toHaveBeenCalledTimes(1);
  const firstEpoch = attach.mock.calls[0]![0].viewEpoch;
  handle.connect({ target, boundary: 'root-content' });
  expect(updates[0]).toHaveBeenCalledTimes(1);
  caps.resetAttached();
  expect(disposes[0]).toHaveBeenCalledTimes(1);
  caps.attach([[AVAILABLE_SPACE_HOST_CAP, { attach }]]);
  expect(attach.mock.calls[1]![0].viewEpoch).toBeGreaterThan(firstEpoch);
  module.onProtoPhase('unmounted');
  handle.connect({ target, boundary: 'root-content' });
  handle.requestUpdate();
  handle.disconnect();
  expect(disposes[1]).toHaveBeenCalledTimes(1);
  expect(attach).toHaveBeenCalledTimes(2);
});

it('projects one consistent rect, follows size and origin changes, withdraws unknown facts, and restores exact styles', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  target.style.setProperty(key, '81px', 'important');
  let rect: AvailableSpaceRect | null = { x: 12, y: 20, width: 366, height: 780 };
  const host = createWebAvailableSpaceHost({ readRegion: () => rect });
  const lease = host.attach({ target, boundary: 'root-content', viewEpoch: 7 });
  expect(lease.getFrame?.()).toMatchObject({ viewEpoch: 7, rect });
  expect(target.style.getPropertyValue(key)).toBe('366px');
  expect(target.style.getPropertyPriority(key)).toBe('important');
  expect(target.style.getPropertyValue('--proto-ui-available-region-center-x')).toBe('195px');
  rect = { x: 45, y: 90, width: 300, height: 400 };
  window.dispatchEvent(new Event('resize'));
  expect(target.style.getPropertyValue('--proto-ui-available-region-center-y')).toBe('290px');
  expect(lease.getFrame?.()?.revision).toBeGreaterThan(1);
  const changes: MutationRecord[] = [];
  const observer = new MutationObserver((records) => changes.push(...records));
  observer.observe(target, { attributes: true });
  lease.requestUpdate();
  await Promise.resolve();
  expect(changes).toHaveLength(0);
  rect = null;
  lease.requestUpdate();
  expect(lease.getFrame?.()?.rect).toBeNull();
  expect(target.style.getPropertyValue(key)).toBe('81px');
  expect(target.style.getPropertyPriority(key)).toBe('important');
  await Promise.resolve();
  changes.length = 0;
  lease.requestUpdate();
  await Promise.resolve();
  expect(changes).toHaveLength(0);
  rect = { x: 0, y: 0, width: 390, height: 900 };
  lease.requestUpdate();
  lease.dispose();
  lease.dispose();
  window.dispatchEvent(new Event('resize'));
  lease.requestUpdate();
  expect(target.style.getPropertyValue(key)).toBe('81px');
  expect(target.style.getPropertyValue('--proto-ui-available-region-height')).toBe('');
  expect(lease.getFrame?.()).toBeNull();
  observer.disconnect();
});

it('shares observation only across active leases and releases the last document probe', () => {
  const a = document.createElement('div'),
    b = document.createElement('div');
  document.body.append(a, b);
  const read = () => ({ x: 0, y: 0, width: 400, height: 600 });
  const add = vi.spyOn(window, 'addEventListener'),
    remove = vi.spyOn(window, 'removeEventListener');
  const first = createWebAvailableSpaceHost({ readRegion: read }).attach({
    target: a,
    boundary: 'root-content',
    viewEpoch: 1,
  });
  const second = createWebAvailableSpaceHost({ readRegion: read }).attach({
    target: b,
    boundary: 'root-content',
    viewEpoch: 2,
  });
  expect(document.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(1);
  expect(add.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
  first.dispose();
  expect(document.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(1);
  second.dispose();
  expect(document.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(0);
  expect(remove.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
});

it('rejects invalid targets and nonfinite facts without projecting a fabricated zero region', () => {
  const host = createWebAvailableSpaceHost({
    readRegion: () => ({ x: 0, y: 0, width: NaN, height: 20 }),
  });
  host.attach({ target: {}, boundary: 'root-content', viewEpoch: 1 }).dispose();
  expect(document.querySelector('[data-pui-available-space-probe]')).toBeNull();
  const target = document.createElement('div');
  document.body.append(target);
  const lease = host.attach({ target, boundary: 'root-content', viewEpoch: 2 });
  expect(lease.getFrame?.()?.rect).toBeNull();
  expect(target.style.getPropertyValue(key)).toBe('');
  lease.dispose();
});

it('supersedes same-target leases and preserves later external writes including priority', () => {
  const target = document.createElement('div');
  target.style.setProperty(key, '81px');
  document.body.append(target);
  const a = createWebAvailableSpaceHost({
    readRegion: () => ({ x: 0, y: 0, width: 390, height: 800 }),
  }).attach({ target, boundary: 'root-content', viewEpoch: 1 });
  const b = createWebAvailableSpaceHost({
    readRegion: () => ({ x: 0, y: 0, width: 430, height: 800 }),
  }).attach({ target, boundary: 'root-content', viewEpoch: 2 });
  a.dispose();
  a.requestUpdate();
  expect(target.style.getPropertyValue(key)).toBe('430px');
  expect(a.getFrame?.()).toBeNull();
  target.style.setProperty(key, '99px', 'important');
  b.requestUpdate();
  b.dispose();
  expect(target.style.getPropertyValue(key)).toBe('99px');
  expect(target.style.getPropertyPriority(key)).toBe('important');
});

it('does not write a stale frame after a reader replaces its lease', () => {
  const target = document.createElement('div');
  document.body.append(target);
  let replace = false;
  let replacement: ReturnType<ReturnType<typeof createWebAvailableSpaceHost>['attach']> | undefined;
  const next = createWebAvailableSpaceHost({
    readRegion: () => ({ x: 0, y: 0, width: 430, height: 800 }),
  });
  const host = createWebAvailableSpaceHost({
    readRegion: () => {
      if (replace) {
        replace = false;
        replacement = next.attach({ target, boundary: 'root-content', viewEpoch: 2 });
      }
      return { x: 0, y: 0, width: 390, height: 800 };
    },
  });
  const lease = host.attach({ target, boundary: 'root-content', viewEpoch: 1 });
  replace = true;
  lease.requestUpdate();
  expect(target.style.getPropertyValue(key)).toBe('430px');
  expect(lease.getFrame?.()).toBeNull();
  replacement?.dispose();
  expect(target.style.getPropertyValue(key)).toBe('');
});

it('keeps the newer measurement when its reader synchronously requests another update', () => {
  const target = document.createElement('div');
  document.body.append(target);
  let reenter = false;
  let lease: ReturnType<ReturnType<typeof createWebAvailableSpaceHost>['attach']>;
  const host = createWebAvailableSpaceHost({
    readRegion: () => {
      if (reenter) {
        reenter = false;
        lease.requestUpdate();
        return { x: 0, y: 0, width: 10, height: 20 };
      }
      return { x: 10, y: 20, width: 400, height: 600 };
    },
  });
  lease = host.attach({ target, boundary: 'root-content', viewEpoch: 1 });
  reenter = true;
  lease.requestUpdate();
  expect(target.style.getPropertyValue(key)).toBe('400px');
  expect(lease.getFrame?.()?.rect?.width).toBe(400);
  lease.dispose();
});

it('revokes on throwing readers and cannot republish after disposal during a read', () => {
  const target = document.createElement('div');
  document.body.append(target);
  let mode: 'normal' | 'throw' | 'dispose' = 'normal';
  let lease: ReturnType<ReturnType<typeof createWebAvailableSpaceHost>['attach']>;
  const host = createWebAvailableSpaceHost({
    readRegion: () => {
      if (mode === 'throw') throw new Error('unknown geometry');
      if (mode === 'dispose') lease.dispose();
      return { x: 0, y: 0, width: 390, height: 900 };
    },
  });
  lease = host.attach({ target, boundary: 'root-content', viewEpoch: 1 });
  mode = 'throw';
  lease.requestUpdate();
  expect(lease.getFrame?.()?.rect).toBeNull();
  expect(target.style.getPropertyValue(key)).toBe('');
  mode = 'normal';
  lease.requestUpdate();
  expect(target.style.getPropertyValue(key)).toBe('390px');
  mode = 'dispose';
  lease.requestUpdate();
  expect(lease.getFrame?.()).toBeNull();
  expect(target.style.getPropertyValue(key)).toBe('');
  expect(document.querySelector('[data-pui-available-space-probe]')).toBeNull();
});

it('rebinds the observation when a live target migrates to another document', () => {
  const target = document.createElement('div');
  document.body.append(target);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const other = frame.contentDocument!;
  const host = createWebAvailableSpaceHost({
    readRegion: (d) => ({ x: 0, y: 0, width: d === document ? 390 : 430, height: 800 }),
  });
  const lease = host.attach({ target, boundary: 'root-content', viewEpoch: 1 });
  other.body.append(other.adoptNode(target));
  lease.requestUpdate();
  expect(document.querySelector('[data-pui-available-space-probe]')).toBeNull();
  expect(other.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(1);
  expect(target.style.getPropertyValue(key)).toBe('430px');
  lease.dispose();
  expect(other.querySelector('[data-pui-available-space-probe]')).toBeNull();
  expect(target.style.getPropertyValue(key)).toBe('');
});
