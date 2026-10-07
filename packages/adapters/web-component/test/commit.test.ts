// packages/adapters/web-component/test/commit.test.ts
import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';

describe('adapter-web-component v0', () => {
  it('renders basic string element and text', () => {
    const P: Prototype = {
      name: 'x-basic',
      setup(def) {
        return (r) => [r.el('div', 'hello')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-basic') as any;
    document.body.appendChild(el);

    const root = el.shadowRoot ?? el;
    expect(root.innerHTML).toBe('<div>hello</div>');
    expect(el.shadowRoot).toBeNull();
    expect(el.hasAttribute('data-pui-color-scheme')).toBe(false);
  });

  it('supports array expansion', () => {
    const P: Prototype = {
      name: 'x-array',
      setup() {
        return (r) => [r.el('span', 'a'), r.el('span', 'b')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-array') as any;
    document.body.appendChild(el);

    const root = el.shadowRoot ?? el;
    expect(root.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  it('supports slot node', () => {
    const P: Prototype = {
      name: 'x-slot',
      setup() {
        return (r) => [r.slot()];
      },
    };

    AdaptToWebComponent(P, { shadow: true }); // ✅ 强制 shadow

    const el = document.createElement('x-slot') as any;
    document.body.appendChild(el);

    const root = el.shadowRoot ?? el;
    expect(root.innerHTML).toBe('<slot></slot>');
    expect(el.shadowRoot).not.toBeNull();
    expect(el.hasAttribute('data-pui-color-scheme')).toBe(false);
    expect(root.querySelector('[data-pui-shadow-stylesheet]')).toBeNull();
  });

  it('renders svg nodes from renderer.svg namespace', () => {
    const P: Prototype = {
      name: 'x-svg',
      setup() {
        return (r) => [
          r.svg.root(
            { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            [r.svg.path({ d: 'M6 9l6 6 6-6' })]
          ),
        ];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-svg') as any;
    document.body.appendChild(el);

    const root = el.shadowRoot ?? el;
    const svg = root.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('stroke-width')).toBe('2');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe('M6 9l6 6 6-6');
  });

  it('lifecycle created/mounted ordering: created before mounted', async () => {
    const calls: string[] = [];

    const P: Prototype = {
      name: 'x-life',
      setup(def) {
        def.lifecycle.onCreated(() => calls.push('created'));
        def.lifecycle.onMounted(() => calls.push('mounted'));
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-life') as any;
    document.body.appendChild(el);

    // mounted is scheduled via microtask by default
    await Promise.resolve();

    expect(calls[0]).toBe('created');
    expect(calls[1]).toBe('mounted');
  });
});
