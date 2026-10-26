// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { OwnedDecorationTarget } from '@proto.ui/core';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import {
  collectWebOwnedDecorationTargets,
  createWebOwnedDecorationStage,
} from '../src/platform/web-owned-decoration';
const target = () => Object.freeze({}) as OwnedDecorationTarget;
function fixture(count = 2) {
  const targets = Array.from({ length: count }, target);
  const stage = createWebOwnedDecorationStage(targets, vi.fn());
  const host = document.createElement('div');
  const nodes = targets.map((t) => {
    const n = document.createElement('span');
    host.append(n);
    stage.ref(t)(n);
    return n;
  });
  return { targets, stage, host, nodes };
}
describe('draft owned decoration physical staging', () => {
  it('collects exact empty leaves and rejects duplicates and author content', () => {
    const t = target();
    const node = { type: { kind: 'decoration' as const, target: t } };
    expect(collectWebOwnedDecorationTargets([{ type: 'div', children: node }])).toEqual([t]);
    expect(() => collectWebOwnedDecorationTargets([node, node])).toThrow('duplicate');
    expect(() => collectWebOwnedDecorationTargets({ ...node, children: null })).toThrow('empty');
    expect(() =>
      collectWebOwnedDecorationTargets({ ...node, props: { tabindex: 0 } } as any)
    ).toThrow('empty');
  });
  it('validates identities before producing refs', () => {
    const fail = vi.fn(() => {
      throw new Error('foreign identity');
    });
    expect(() => createWebOwnedDecorationStage([target()], fail)).toThrow('foreign identity');
    const t = target();
    expect(() => createWebOwnedDecorationStage([t, t], fail)).toThrow('duplicate');
  });
  it('binds a complete set once and applies paint without replacing nodes', () => {
    const f = fixture();
    let bindings: readonly OwnedDecorationBinding[] = [];
    f.stage.bind(f.host, (b) => {
      bindings = b;
      b[0].sink({ kind: 'tw', tokens: ['bg-black'] });
    });
    expect(f.nodes[0].getAttribute('data-pui-style')).toBe('bg-black');
    bindings[0].sink({ kind: 'tw', tokens: [] });
    expect(f.nodes[0].hasAttribute('data-pui-style')).toBe(false);
    expect([...f.host.children]).toEqual(f.nodes);
    for (const n of f.nodes) {
      expect(n.getAttribute('aria-hidden')).toBe('true');
      expect(n.hasAttribute('inert')).toBe(true);
      expect(n.tabIndex).toBe(-1);
      expect(n.style.getPropertyPriority('pointer-events')).toBe('important');
    }
    expect(() => f.stage.bind(f.host, vi.fn())).toThrow('repeated');
    expect(() => f.stage.ref(target())).toThrow('foreign');
  });
  it('rejects incomplete, duplicate physical, and foreign-scope leaves before bind callback', () => {
    for (const mode of ['missing', 'duplicate', 'foreign']) {
      const f = fixture();
      const bind = vi.fn();
      if (mode === 'missing') f.stage.ref(f.targets[1])(null);
      if (mode === 'foreign') f.nodes[1].remove();
      if (mode === 'duplicate') {
        const ids = [target(), target()];
        const s = createWebOwnedDecorationStage(ids, vi.fn());
        ids.forEach((id) => s.ref(id)(f.nodes[0]));
        expect(() => s.bind(f.host, bind)).toThrow('duplicate physical');
      } else expect(() => f.stage.bind(f.host, bind)).toThrow('missing');
      expect(bind).not.toHaveBeenCalled();
    }
  });
  it('rejects nonempty/focusable nodes and physical replacement', () => {
    const f = fixture(1);
    expect(() => f.stage.ref(f.targets[0])(document.createElement('span'))).toThrow('rebind');
    f.nodes[0].tabIndex = 0;
    expect(() => f.stage.bind(f.host, vi.fn())).toThrow('invalid physical');
  });
  it('keeps refs stable across same-node callback churn but blocks detached paint', () => {
    const f = fixture(1);
    let b!: OwnedDecorationBinding;
    f.stage.bind(f.host, (bs) => {
      b = bs[0];
    });
    const ref = f.stage.ref(f.targets[0]);
    expect(f.stage.ref(f.targets[0])).toBe(ref);
    ref(null);
    expect(() => b.sink({ kind: 'tw', tokens: ['bg-white'] })).toThrow('inactive');
    ref(f.nodes[0]);
    b.sink({ kind: 'tw', tokens: ['bg-black'] });
    f.nodes[0].remove();
    expect(() => b.sink({ kind: 'tw', tokens: ['bg-white'] })).toThrow('scope changed');
    expect(f.nodes[0].getAttribute('data-pui-style')).toBe('bg-black');
  });
  it('terminal retirement blocks old sinks and reattachment without painting', () => {
    const f = fixture(1);
    let b!: OwnedDecorationBinding;
    f.stage.bind(f.host, (bs) => {
      b = bs[0];
    });
    f.stage.retire();
    expect(() => b.sink({ kind: 'tw', tokens: ['bg-white'] })).toThrow('inactive');
    const stale = document.createElement('span');
    f.stage.ref(f.targets[0])(stale);
    expect(stale.attributes.length).toBe(0);
    expect(f.nodes[0].hasAttribute('data-pui-style')).toBe(false);
  });
  it('cannot revive a stage retired synchronously by bind callback', () => {
    const f = fixture(1);
    expect(() => f.stage.bind(f.host, () => f.stage.retire())).toThrow('retired during binding');
    const stale = document.createElement('span');
    f.stage.ref(f.targets[0])(stale);
    expect(stale.attributes.length).toBe(0);
  });
});

it('reuse validates committed phase, exact physical ancestry and permanent retirement', () => {
  const f = fixture(1);
  document.body.append(f.host);
  expect(() => f.stage.assertReusable(f.host)).toThrow('stale');
  f.stage.bind(f.host, () => {});
  expect(() => f.stage.assertReusable(f.host)).not.toThrow();
  const wrapper = document.createElement('section');
  f.host.append(wrapper);
  wrapper.append(f.nodes[0]);
  expect(() => f.stage.assertReusable(f.host)).toThrow('ancestry');
  f.host.append(f.nodes[0]);
  expect(() => f.stage.assertReusable(f.host)).not.toThrow();
  f.stage.retire();
  expect(() => f.stage.assertReusable(f.host)).toThrow('stale');
  f.host.remove();
});
it('detached or foreign-document physical view is not reusable', () => {
  const f = fixture(1);
  document.body.append(f.host);
  f.stage.bind(f.host, () => {});
  f.host.remove();
  expect(() => f.stage.assertReusable(f.host)).toThrow('stale');
  const other = document.implementation.createHTMLDocument();
  other.body.append(other.adoptNode(f.host));
  expect(() => f.stage.assertReusable(f.host)).toThrow('stale');
});
