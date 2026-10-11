import { expect, it } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import { EXPOSE_STATE_EXTERNAL_HANDLE } from '@proto.ui/module-expose-state';
import { ExposeStateWebModuleImpl } from '../src/impl';
import {
  HOST_ELEMENT_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
  EXPOSE_STATE_WEB_MODE_CAP,
  EXPOSE_STATE_WEB_MAP_CAP,
} from '../src/caps';
import { createExposeStateWebNameMap } from '../src/utils';

function fixture() {
  const caps = new CapsVault();
  const listeners = new Set<(e: any) => void>();
  const history: Array<(e: any) => void> = [];
  let value = 1;
  const handle = {
    [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
    __stateId: 'count',
    __stateSemantic: 'list.count',
    spec: { kind: 'number.discrete' },
    get: () => value,
    subscribe(cb: (e: any) => void) {
      listeners.add(cb);
      history.push(cb);
      return () => listeners.delete(cb);
    },
    unsubscribe(off: () => void) {
      off();
    },
  };
  const impl = new ExposeStateWebModuleImpl(caps, {
    requirePort: () => ({ getAll: () => ({ count: handle, ignored: 42 }) }),
  } as any);
  const host = document.createElement('div');
  const set = (next: number) => {
    value = next;
    for (const cb of listeners) cb({ type: 'change', next });
  };
  return { caps, impl, host, listeners, history, set };
}

it('T-EXPOSE-STATE-WEB-0001-CASE-ACTIVE: reports active projection and one subscription after repeated commits', () => {
  const { caps, impl, host, listeners } = fixture();
  caps.attach([[HOST_ELEMENT_CAP, host]]);
  expect(impl.port.isActive()).toBe(false);
  impl.onMountPhase('mounted', 1);
  impl.afterRenderCommit();
  impl.afterRenderCommit();
  expect(impl.port.isActive()).toBe(true);
  expect(listeners.size).toBe(1);
  expect(host.getAttribute('data-list-count')).toBe('1');
  expect(impl.port.getExposedStateMap().get('count')?.attr).toBe('data-list-count');
  impl.dispose();
});

it('T-EXPOSE-STATE-WEB-0001-CASE-REBIND: revokes missing or replaced host bindings including queued callbacks', () => {
  const { caps, impl, host, listeners, history, set } = fixture();
  impl.onMountPhase('mounted', 1);
  caps.attach([[HOST_ELEMENT_CAP, host]]);
  const stale = history[0];
  caps.resetAttached();
  expect(listeners.size).toBe(0);
  set(2);
  stale({ type: 'change', next: 3 });
  expect(host.getAttribute('data-list-count')).toBe('1');
  expect(impl.port.isActive()).toBe(false);
  expect(impl.port.getExposedStateMap().size).toBe(0);
  const replacement = document.createElement('div');
  caps.attach([[HOST_ELEMENT_CAP, replacement]]);
  expect(replacement.getAttribute('data-list-count')).toBe('2');
  stale({ type: 'change', next: 9 });
  expect(host.getAttribute('data-list-count')).toBe('1');
  expect(listeners.size).toBe(1);
  caps.attach([[HOST_ELEMENT_CAP, null as any]]);
  expect(listeners.size).toBe(0);
  set(4);
  expect(replacement.getAttribute('data-list-count')).toBe('2');
  impl.dispose();
});

it('T-EXPOSE-STATE-WEB-0001-CASE-LIFETIME: suspends on unmounting, replays on remount and cannot reactivate after disposal', () => {
  const { caps, impl, host, listeners, set } = fixture();
  impl.onMountPhase('mounted', 1);
  caps.attach([[HOST_ELEMENT_CAP, host]]);
  impl.onMountPhase('unmounting', 1);
  set(2);
  expect(host.getAttribute('data-list-count')).toBe('1');
  expect(listeners.size).toBe(0);
  impl.onMountPhase('detached', 1);
  impl.afterRenderCommit();
  impl.onMountPhase('mounting', 2);
  impl.afterRenderCommit();
  expect(host.getAttribute('data-list-count')).toBe('2');
  expect(listeners.size).toBe(1);
  impl.dispose();
  set(3);
  impl.afterRenderCommit();
  expect(host.getAttribute('data-list-count')).toBe(null);
  expect(host.style.getPropertyValue('--pui-list-count')).toBe('');
  expect(listeners.size).toBe(0);
  expect(impl.port.getExposedStateMap().size).toBe(0);
});

it('T-EXPOSE-STATE-WEB-0001-CASE-MAPPING: applies custom names and mirrors without granting identity or ARIA', () => {
  const { caps, impl, host, set } = fixture();
  const mirror = document.createElement('textarea');
  host.dataset.puiRoot = 'owner';
  impl.onMountPhase('mounted', 1);
  caps.attach([
    [HOST_ELEMENT_CAP, host],
    [EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP, () => [host, mirror, mirror, null]],
    [EXPOSE_STATE_WEB_MODE_CAP, {}],
    [EXPOSE_STATE_WEB_MAP_CAP, () => ({ dataAttr: 'data-custom', cssVar: '--custom' })],
  ]);
  set(5);
  for (const el of [host, mirror]) {
    expect(el.getAttribute('data-custom')).toBe('5');
    expect(el.style.getPropertyValue('--custom')).toBe('5');
    expect(el.hasAttribute('aria-valuenow')).toBe(false);
  }
  expect(mirror.hasAttribute('data-pui-root')).toBe(false);
  expect(createExposeStateWebNameMap(' Btn.someValue! ')).toEqual({
    dataAttr: 'data-btn-some-value',
    cssVar: '--pui-btn-some-value',
  });
  expect(createExposeStateWebNameMap('@focus/focusVisible').dataAttr).toBe('data-focus-visible');
  expect(createExposeStateWebNameMap('constructor').dataAttr).toBe('data-constructor');
  impl.dispose();
});

it('number.list remains externally readable and subscribed without scalar host mapping, even with custom permissive mapping', () => {
  const caps = new CapsVault();
  const listeners = new Set<(event: any) => void>();
  let value: readonly number[] = Object.freeze([1, 9]);
  const handle = {
    [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
    __stateId: 1,
    __stateSemantic: 'coordinates',
    spec: Object.freeze({ kind: 'number.list' }),
    get: () => value,
    subscribe(cb: (event: any) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    unsubscribe(off: () => void) {
      off();
    },
  };
  const impl = new ExposeStateWebModuleImpl(caps, {
    requirePort: () => ({ getAll: () => ({ coordinates: handle }) }),
  } as any);
  const host = document.createElement('div');
  impl.onMountPhase('mounted', 1);
  caps.attach([
    [HOST_ELEMENT_CAP, host],
    [EXPOSE_STATE_WEB_MODE_CAP, { allowContinuousAttr: true, allowStringVar: true }],
    [EXPOSE_STATE_WEB_MAP_CAP, () => ({ dataAttr: 'data-custom', cssVar: '--custom' })],
  ]);
  impl.afterRenderCommit();
  expect(listeners.size).toBe(1);
  expect(handle.get()).toBe(value);
  expect(impl.port.getExposedStateMap().get('1')).toMatchObject({
    kind: 'number.list',
    attr: undefined,
    cssVar: undefined,
  });
  value = Object.freeze([2, 8]);
  for (const callback of listeners) callback({ type: 'next', prev: [1, 9], next: value });
  expect(handle.get()).toEqual([2, 8]);
  expect(host.hasAttribute('data-custom')).toBe(false);
  expect(host.style.getPropertyValue('--custom')).toBe('');
  expect(host.hasAttribute('data-coordinates')).toBe(false);
  expect(host.style.getPropertyValue('--pui-coordinates')).toBe('');
  impl.dispose();
  expect(listeners.size).toBe(0);
});
