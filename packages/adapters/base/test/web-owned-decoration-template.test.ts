// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { OwnedDecorationTarget } from '@proto.ui/core';
import { createWebOwnedDecorationStage } from '../src/platform/web-owned-decoration';
import { renderTemplateToReact } from '../../react/src/template';
import { renderTemplateToVue } from '../../vue/src/template';
import { renderTemplateToVue2 } from '../../vue2/src/template';
const renderers = [
  [
    'react',
    (create: any, children: any, options: any) =>
      renderTemplateToReact({ createElement: create }, children, options),
  ],
  [
    'vue',
    (create: any, children: any, options: any) =>
      renderTemplateToVue({ h: create }, children, options),
  ],
  [
    'vue2',
    (create: any, children: any, options: any) =>
      renderTemplateToVue2({ h: create }, children, options),
  ],
] as const;
describe.each(renderers)('%s owned decoration VNode materialization', (name, render) => {
  it('rejects unsupported targets rather than silently returning null', () => {
    const t = Object.freeze({}) as OwnedDecorationTarget;
    expect(() => render(vi.fn(), { type: { kind: 'decoration', target: t } }, {})).toThrow(
      'unsupported'
    );
  });
  it('preflights duplicate and nonempty targets before creating any VNode', () => {
    const t = Object.freeze({}) as OwnedDecorationTarget;
    const node = { type: { kind: 'decoration', target: t } };
    const create = vi.fn();
    expect(() => render(create, [{ type: 'div' }, node, node], {})).toThrow('duplicate');
    expect(() => render(create, [{ type: 'div' }, { ...node, children: null }], {})).toThrow(
      'empty'
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('uses exact adapter-owned empty span and framework-native ref shape', () => {
    const t = Object.freeze({}) as OwnedDecorationTarget;
    const stage = createWebOwnedDecorationStage([t], vi.fn());
    const create = vi.fn((type, props, ...children) => ({ type, props, children }));
    const out = render(create, { type: { kind: 'decoration', target: t } }, { decoration: stage });
    expect(out.type).toBe('span');
    const attrs = name === 'vue2' ? out.props.attrs : out.props;
    expect(attrs['aria-hidden']).toBe('true');
    expect(attrs.inert).toBe(name === 'react' ? true : '');
    expect(attrs.tabindex).toBeUndefined();
    const host = document.createElement('div');
    const leaf = document.createElement('span');
    host.append(leaf);
    if (name === 'vue2') out.props.hook.insert({ elm: leaf });
    else out.props.ref(leaf);
    stage.bind(host, (b) => b[0].sink({ kind: 'tw', tokens: ['bg-black'] }));
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-black');
    expect(leaf.childNodes.length).toBe(0);
  });
});
