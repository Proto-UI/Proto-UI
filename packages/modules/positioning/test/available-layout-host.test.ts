import { afterEach, expect, it, vi } from 'vitest';
import type { AvailableLayoutSnapshot, AvailableSpaceRect } from '@proto.ui/core';
import { createWebAvailableSpaceHost } from '../src/web/available-space-host';
const layout = (patch: Partial<AvailableLayoutSnapshot> = {}): AvailableLayoutSnapshot => ({
  edge: 'bottom',
  extent: 'intrinsic',
  fraction: 1,
  minimum: { unit: 'logical', value: 0 },
  maximum: { unit: 'available-minus-root-text', value: 6 },
  displacement: 0,
  ...patch,
});
const leases: { dispose(): void }[] = [];
afterEach(() => {
  leases.splice(0).forEach((x) => x.dispose());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('font-size');
});
function fixture(value = layout()) {
  document.documentElement.style.fontSize = '16px';
  const target = document.createElement('div');
  document.body.append(target);
  let region: AvailableSpaceRect | null = { x: 10, y: 20, width: 400, height: 1000 };
  const host = createWebAvailableSpaceHost({ readRegion: () => region });
  const lease = host.attach({
    target,
    boundary: 'root-content',
    viewEpoch: 1,
    layout: { status: 'ready', value },
  });
  leases.push(lease);
  return {
    host,
    target,
    lease,
    setRegion: (next: AvailableSpaceRect | null) => {
      region = next;
      lease.requestUpdate();
    },
  };
}
it('lowers intrinsic size and exact six-root-text cap while attaching its own edge', () => {
  const { target, lease } = fixture();
  expect(target.style.height).toBe('auto');
  expect(target.style.maxHeight).toBe('904px');
  expect(target.style.top).toBe('1020px');
  expect(target.style.getPropertyValue('translate')).toBe('0px -100%');
  document.documentElement.style.fontSize = '32px';
  lease.requestUpdate();
  expect(target.style.maxHeight).toBe('808px');
});
it('keeps min below cap and fraction mode independent of that minimum', () => {
  const { target, lease } = fixture(layout({ minimum: { unit: 'logical', value: 2000 } }));
  expect(target.style.minHeight).toBe('904px');
  lease.updateLayout?.({
    status: 'ready',
    value: layout({ extent: 'fraction', fraction: 0.5, minimum: { unit: 'logical', value: 2000 } }),
  });
  expect(target.style.height).toBe('452px');
  expect(target.style.minHeight).toBe('0px');
});
it.each(['top', 'bottom', 'left', 'right'] as const)(
  'places neutral %s edge and changes only displacement',
  (edge) => {
    const { target, lease } = fixture(layout({ edge, maximum: { unit: 'available', value: 1 } }));
    const before = {
      width: target.style.width,
      height: target.style.height,
      maxHeight: target.style.maxHeight,
      maxWidth: target.style.maxWidth,
    };
    const translate = target.style.getPropertyValue('translate');
    lease.updateLayout?.({
      status: 'ready',
      value: layout({ edge, maximum: { unit: 'available', value: 1 }, displacement: 0.5 }),
    });
    expect(target.style.getPropertyValue('translate')).not.toBe(translate);
    expect({
      width: target.style.width,
      height: target.style.height,
      maxHeight: target.style.maxHeight,
      maxWidth: target.style.maxWidth,
    }).toEqual(before);
  }
);
it('fails closed for unknown region without changing other hidden/inert owners, then restores', () => {
  const { target, setRegion, lease } = fixture();
  target.hidden = true;
  target.inert = true;
  setRegion(null);
  expect(target.style.display).toBe('none');
  setRegion({ x: 0, y: 0, width: 400, height: 900 });
  expect(target.style.display).toBe('');
  expect(target.hidden).toBe(true);
  expect(target.inert).toBe(true);
  setRegion(null);
  target.setAttribute('hidden', 'other-owner');
  target.inert = false;
  lease.dispose();
  expect(target.getAttribute('hidden')).toBe('other-owner');
  expect(target.inert).toBe(false);
});
it('retains a later translate writer through state refresh and cleanup', () => {
  const { target, lease } = fixture();
  target.style.setProperty('translate', '7px 9px');
  lease.updateLayout?.({ status: 'ready', value: layout({ displacement: 0.5 }) });
  expect(target.style.getPropertyValue('translate')).toBe('7px 9px');
  lease.requestUpdate();
  expect(target.style.getPropertyValue('translate')).toBe('7px 9px');
  lease.dispose();
  expect(target.style.getPropertyValue('translate')).toBe('7px 9px');
});
it('rejects infeasible chrome and invalid runtime input without publishing NaN dimensions', () => {
  const { target, lease, setRegion } = fixture();
  target.style.padding = '30px';
  setRegion({ x: 0, y: 0, width: 400, height: 120 });
  expect(target.style.display).toBe('none');
  setRegion({ x: 0, y: 0, width: 400, height: 1000 });
  expect(target.style.display).toBe('');
  lease.updateLayout?.({ status: 'invalid' });
  expect(target.style.display).toBe('none');
  expect(target.style.cssText).not.toMatch(/NaN|Infinity/);
  lease.updateLayout?.({ status: 'ready', value: layout() });
  expect(target.style.display).toBe('');
});
it('preserves a later display writer, including its priority, across invalid and recovered frames', () => {
  const { target, lease, setRegion } = fixture();
  setRegion(null);
  target.style.setProperty('display', 'grid', 'important');
  lease.updateLayout?.({ status: 'invalid' });
  expect(target.style.display).toBe('grid');
  expect(lease.getLayoutStatus?.()).toBe('ownership-lost');
  setRegion({ x: 0, y: 0, width: 400, height: 900 });
  setRegion(null);
  expect(target.style.display).toBe('grid');
  expect(target.style.getPropertyPriority('display')).toBe('important');
  lease.dispose();
  expect(target.style.display).toBe('grid');
});
it('restores an original display owner exactly without changing hidden or inert', () => {
  const target = document.createElement('div');
  document.body.append(target);
  target.style.setProperty('display', 'flex', 'important');
  target.hidden = true;
  target.inert = true;
  let region: AvailableSpaceRect | null = null;
  const lease = createWebAvailableSpaceHost({ readRegion: () => region }).attach({
    target,
    boundary: 'root-content',
    viewEpoch: 1,
    layout: { status: 'ready', value: layout() },
  });
  leases.push(lease);
  expect(target.style.display).toBe('none');
  document.documentElement.style.fontSize = '16px';
  region = { x: 0, y: 0, width: 400, height: 900 };
  lease.requestUpdate();
  expect(target.style.display).toBe('flex');
  expect(target.style.getPropertyPriority('display')).toBe('important');
  expect(target.hidden).toBe(true);
  expect(target.inert).toBe(true);
});
it.each(['rotate', 'scale', 'transform'])(
  'rejects unsupported target %s on each apply',
  (property) => {
    const { target, lease } = fixture();
    target.style.setProperty(
      property,
      property === 'rotate' ? '20deg' : property === 'scale' ? '2' : 'translateX(2px)'
    );
    lease.requestUpdate();
    expect(lease.getLayoutStatus?.()).toBe('unsupported-transform');
    expect(target.style.display).toBe('none');
  }
);
it('rejects a transformed composed ancestor including a shadow host', () => {
  const { target, lease } = fixture();
  const wrapper = document.createElement('section');
  document.body.append(wrapper);
  wrapper.attachShadow({ mode: 'open' }).append(target);
  wrapper.style.transform = 'scale(2)';
  lease.requestUpdate();
  expect(lease.getLayoutStatus?.()).toBe('unsupported-transform');
  wrapper.style.removeProperty('transform');
  lease.requestUpdate();
  expect(lease.getLayoutStatus?.()).toBe('ready');
});
it('observes target chrome and root metric with lease-owned resize observations', () => {
  const records: { target?: Element; fire(): void; stopped: boolean }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      record: (typeof records)[number];
      constructor(cb: () => void) {
        this.record = { fire: cb, stopped: false };
        records.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      disconnect() {
        this.record.stopped = true;
      }
      unobserve() {}
    }
  );
  const { target, lease, setRegion } = fixture();
  setRegion({ x: 0, y: 0, width: 400, height: 120 });
  const targetRecord = records.find((record) => record.target === target)!;
  expect(targetRecord).toBeDefined();
  target.style.padding = '30px';
  targetRecord.fire();
  expect(lease.getLayoutStatus?.()).toBe('infeasible');
  target.style.padding = '0px';
  targetRecord.fire();
  expect(lease.getLayoutStatus?.()).toBe('ready');
  const metric = records.find((record) =>
    record.target?.hasAttribute('data-pui-available-space-probe')
  )!;
  document.documentElement.style.fontSize = '32px';
  metric.fire();
  expect(lease.getLayoutStatus?.()).toBe('infeasible');
  lease.dispose();
  expect(targetRecord.stopped).toBe(true);
  expect(metric.stopped).toBe(true);
  targetRecord.fire();
  expect(lease.getLayoutStatus?.()).toBe('disposed');
});
