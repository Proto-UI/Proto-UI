import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src/adapt';

const demoInline = definePrototype({
  name: 'vue-previewer-inline',
  setup(def) {
    def.props.define({
      label: { type: 'string', default: 'fallback' },
    });

    return (r) => [r.el('div', String(r.read.props.get().label))];
  },
});

const demo = {
  type: 'demo' as const,
  root: {
    kind: 'box' as const,
    children: [
      {
        kind: 'proto' as const,
        className: 'rounded bg-red-500',
        props: { label: 'Vue Button' },
      },
      {
        kind: 'proto' as const,
        className: 'rounded bg-red-500',
        props: { label: 'Hello' },
      },
    ],
  },
};

function renderDemoNodeVue(Vue: any, adapter: ReturnType<typeof createVueAdapter>, node: any): any {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return node.text;
  if (node.kind === 'box') {
    const kids = (node.children ?? []).map((child: any) => renderDemoNodeVue(Vue, adapter, child));
    return Vue.h('div', { class: node.className }, kids);
  }

  const Component = adapter(demoInline as any);
  const kids = (node.children ?? []).map((child: any) => renderDemoNodeVue(Vue, adapter, child));
  const props = { ...(node.props ?? {}) } as Record<string, unknown>;
  if (node.className) (props as any).hostClass = node.className;
  return Vue.h(Component, props, () => kids);
}

describe('adapter-vue: previewer demo integration', () => {
  it('renders demo-combo-like tree without leaking raw props to DOM', async () => {
    const adapter = createVueAdapter(VueAny);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = VueAny.createApp({
      setup() {
        return () => renderDemoNodeVue(VueAny, adapter, demo.root);
      },
    });

    app.mount(host);
    await flushVue();
    await flushVue();

    const inlineRoots = Array.from(host.querySelectorAll('.bg-red-500')) as HTMLElement[];
    expect(inlineRoots.length).toBeGreaterThanOrEqual(2);
    expect(inlineRoots[0]?.getAttribute('label')).toBe(null);
    expect(inlineRoots[0]?.textContent).toContain('Vue Button');
    expect(host.textContent).toContain('Hello');

    app.unmount();
    host.remove();
  });
});
