import { expect, it, vi } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import { EXPOSE_STATE_EXTERNAL_HANDLE } from '@proto.ui/module-expose-state';
import { ExposeStateWebModuleImpl } from '../src/impl';
import {
  HOST_ELEMENT_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
  EXPOSE_STATE_WEB_MAP_CAP,
} from '../src/caps';

function state(initial: any = 1, kind = 'number.discrete') {
  let value = initial;
  const listeners = new Set<(e: any) => void>();
  const history: Array<(e: any) => void> = [];
  const hooks = { subscribe: () => {}, unsubscribe: () => {} };
  const handle = {
    [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
    __stateId: 'count',
    __stateSemantic: 'count',
    spec: { kind },
    get: () => value,
    subscribe(cb: (e: any) => void) {
      listeners.add(cb);
      history.push(cb);
      hooks.subscribe();
      return () => {
        listeners.delete(cb);
        hooks.unsubscribe();
      };
    },
    unsubscribe(off: () => void) {
      off();
    },
  };
  const set = (next: any) => {
    value = next;
    for (const cb of [...listeners]) cb({ type: 'change', next });
  };
  return { handle, set, listeners, history, hooks };
}
function fixture(states = [state()]) {
  const caps = new CapsVault();
  const host = document.createElement('div');
  const impl = new ExposeStateWebModuleImpl(caps, {
    requirePort: () => ({
      getAll: () => Object.fromEntries(states.map((s, i) => [`s${i}`, s.handle])),
    }),
  } as any);
  impl.onMountPhase('mounted', 1);
  const bind = (target = host, mirrors: HTMLElement[] = []) =>
    caps.attach([
      [HOST_ELEMENT_CAP, target],
      [EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP, () => mirrors],
      [EXPOSE_STATE_WEB_MAP_CAP, () => ({ dataAttr: 'data-count', cssVar: '--count' })],
    ]);
  return { caps, host, impl, bind, state: states[0] };
}

it('restores each original attribute and CSS priority across repeated binds and duplicate mirrors', () => {
  const f = fixture();
  const mirror = document.createElement('span');
  f.host.setAttribute('data-count', 'host baseline');
  f.host.style.setProperty('--count', '12', 'important');
  mirror.style.setProperty('--count', '24');
  f.bind(f.host, [f.host, mirror, mirror]);
  f.impl.afterRenderCommit();
  f.impl.afterRenderCommit();
  f.state.set(7);
  expect(f.state.listeners.size).toBe(1);
  expect(mirror.getAttribute('data-count')).toBe('7');
  f.impl.dispose();
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('host baseline');
  expect(f.host.style.getPropertyValue('--count')).toBe('12');
  expect(f.host.style.getPropertyPriority('--count')).toBe('important');
  expect(mirror.hasAttribute('data-count')).toBe(false);
  expect(mirror.style.getPropertyValue('--count')).toBe('24');
  expect(f.state.listeners.size).toBe(0);
});

it('does not overwrite consumer changes made after the last module write, including priority-only changes', () => {
  const f = fixture();
  f.bind();
  f.host.setAttribute('data-count', 'consumer');
  f.host.style.setProperty('--count', '1', 'important');
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('consumer');
  expect(f.host.style.getPropertyValue('--count')).toBe('1');
  expect(f.host.style.getPropertyPriority('--count')).toBe('important');
});

it('restores the newer consumer baseline when subsequent state projection overwrites it', () => {
  const f = fixture();
  f.bind();
  f.host.setAttribute('data-count', 'consumer');
  f.host.style.setProperty('--count', '88', 'important');
  f.state.set(2);
  expect(f.host.style.getPropertyValue('--count')).toBe('2');
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('consumer');
  expect(f.host.style.getPropertyValue('--count')).toBe('88');
  expect(f.host.style.getPropertyPriority('--count')).toBe('important');
});

it('keeps reconnectable snapshots but invalidates stale callbacks across mount epochs and terminal disposal', () => {
  const f = fixture();
  f.bind();
  const stale = f.state.history[0];
  f.impl.onMountPhase('unmounting', 1);
  f.impl.onMountPhase('detached', 1);
  f.state.set(2);
  stale({ type: 'change', next: 3 });
  expect(f.host.getAttribute('data-count')).toBe('1');
  f.impl.onMountPhase('mounted', 2);
  f.impl.afterRenderCommit();
  expect(f.host.getAttribute('data-count')).toBe('2');
  stale({ type: 'change', next: 4 });
  expect(f.host.getAttribute('data-count')).toBe('2');
  f.impl.dispose();
  f.impl.afterRenderCommit();
  stale({ type: 'change', next: 5 });
  expect(f.host.hasAttribute('data-count')).toBe(false);
  expect(f.host.style.getPropertyValue('--count')).toBe('');
  expect(f.impl.port.isActive()).toBe(false);
});

it('retains former target snapshots until terminal release and cleans all owned targets even without a host cap', () => {
  const f = fixture();
  const mirror = document.createElement('span');
  const replacement = document.createElement('div');
  f.host.setAttribute('data-count', 'first');
  replacement.setAttribute('data-count', 'second');
  f.bind(f.host, [mirror]);
  f.caps.resetAttached();
  expect(f.host.getAttribute('data-count')).toBe('1');
  f.bind(replacement);
  f.state.set(2);
  f.caps.resetAttached();
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('first');
  expect(replacement.getAttribute('data-count')).toBe('second');
  expect(mirror.hasAttribute('data-count')).toBe(false);
  expect(mirror.style.getPropertyValue('--count')).toBe('');
});

it('uses one artifact baseline when separate expose entries map to the same name', () => {
  const a = state(1),
    b = state(2),
    f = fixture([a, b]);
  f.host.setAttribute('data-count', 'baseline');
  f.bind();
  f.impl.afterRenderCommit();
  a.set(3);
  b.set(4);
  expect(f.host.getAttribute('data-count')).toBe('4');
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('baseline');
  expect(f.host.style.getPropertyValue('--count')).toBe('');
  expect(a.listeners.size + b.listeners.size).toBe(0);
});

it('restores an attribute deleted by boolean false projection', () => {
  const f = fixture([state(false, 'bool')]);
  f.host.setAttribute('data-count', 'baseline');
  f.bind();
  expect(f.host.hasAttribute('data-count')).toBe(false);
  f.impl.dispose();
  expect(f.host.getAttribute('data-count')).toBe('baseline');
});

it('can dispose reentrantly during a host attribute write without later mirror or CSS writes', () => {
  const f = fixture();
  const mirror = document.createElement('span');
  const original = f.host.setAttribute.bind(f.host);
  vi.spyOn(f.host, 'setAttribute').mockImplementation((name, value) => {
    original(name, value);
    f.impl.dispose();
  });
  f.bind(f.host, [mirror]);
  expect(f.host.hasAttribute('data-count')).toBe(false);
  expect(f.host.style.getPropertyValue('--count')).toBe('');
  expect(mirror.hasAttribute('data-count')).toBe(false);
  expect(f.state.listeners.size).toBe(0);
});

it('unsubscribes the just-created subscription when subscribe synchronously disposes', () => {
  const f = fixture();
  f.state.hooks.subscribe = () => f.impl.dispose();
  f.bind();
  expect(f.state.listeners.size).toBe(0);
  expect(f.host.hasAttribute('data-count')).toBe(false);
  expect(f.host.style.getPropertyValue('--count')).toBe('');
});

it('preserves the current subscription when unsubscribe reenters refresh', () => {
  const f = fixture();
  f.bind();
  f.state.hooks.unsubscribe = () => {
    f.state.hooks.unsubscribe = () => {};
    f.impl.afterRenderCommit();
  };
  f.impl.afterRenderCommit();
  expect(f.state.listeners.size).toBe(1);
  f.state.set(6);
  expect(f.host.getAttribute('data-count')).toBe('6');
  f.impl.dispose();
  expect(f.state.listeners.size).toBe(0);
  expect(f.host.hasAttribute('data-count')).toBe(false);
});
