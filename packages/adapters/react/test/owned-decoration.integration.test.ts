import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { definePrototype, tw } from '@proto.ui/core';
import { createReactAdapter } from '../src';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const settle = async (action: () => void) =>
  act(async () => {
    action();
    await new Promise((r) => setTimeout(r, 0));
  });
describe('draft React owner-lived decorative targets', () => {
  for (const strict of [false, true])
    it(`paints real targets without rerender or caller reset (StrictMode=${strict})`, async () => {
      let setup = 0,
        renders = 0;
      const proto = definePrototype({
        name: 'react-owned-leaf-' + strict,
        setup(def) {
          setup++;
          const leaf = def.feedback.style.declareDecoration();
          const active = def.state.bool('active', false);
          def.feedback.style.to(leaf).use(tw('bg-black opacity-50'));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.to(leaf).use(tw('bg-white opacity-100')),
          });
          def.event.on('key.down', (_run, event) => {
            if (event.key === 'F2') active.set(!active.get());
          });
          return (r) => {
            renders++;
            return [r.decoration(leaf), r.slot()];
          };
        },
      });
      const Component = createReactAdapter(React)(proto, { autoUpdateOnPropsChange: false });
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      const component = React.createElement(
        Component,
        {},
        React.createElement('input', { defaultValue: 'retain selection', 'aria-label': 'caller' })
      );
      try {
        await settle(() =>
          root.render(strict ? React.createElement(React.StrictMode, {}, component) : component)
        );
        const leaf = container.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
        const input = container.querySelector('input')!;
        expect(leaf).not.toBeNull();
        expect(leaf.getAttribute('data-pui-style')).toContain('bg-black');
        expect(setup).toBe(1);
        const beforeRenders = renders;
        input.focus();
        input.setSelectionRange(2, 7, 'backward');
        await settle(() =>
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
        );
        expect(leaf.getAttribute('data-pui-style')).toContain('bg-white');
        expect(container.querySelector('input')).toBe(input);
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
          2,
          7,
          'backward',
        ]);
        expect(input.value).toBe('retain selection');
        expect(renders).toBe(beforeRenders);
        expect(leaf.getAttribute('aria-hidden')).toBe('true');
        expect(leaf.hasAttribute('inert')).toBe(true);
        expect(leaf.tabIndex).toBe(-1);
        await settle(() =>
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
        );
        expect(leaf.getAttribute('data-pui-style')).toContain('bg-black');
      } finally {
        await settle(() => root.unmount());
        container.remove();
      }
    });
});

describe('React real Activity view generations', () => {
  it('retains one logical owner across same-turn hide/show after successful binding', async () => {
    let setups = 0;
    let setMode!: (v: 'visible' | 'hidden') => void;
    const identities: unknown[] = [];
    const proto = definePrototype({
      name: 'react-owned-leaf-activity',
      setup(def) {
        setups++;
        const target = def.feedback.style.declareDecoration();
        identities.push(target);
        const active = def.state.bool('active', false);
        def.feedback.style.to(target).use(tw('bg-black'));
        def.rule({
          when: (w) => w.state(active).eq(true),
          intent: (i) => i.feedback.style.to(target).use(tw('bg-white')),
        });
        def.event.on('host:click', () => active.set(!active.get()));
        return (r) => [r.decoration(target), r.slot()];
      },
    });
    const Component = createReactAdapter(React)(proto, { autoUpdateOnPropsChange: false });
    function App() {
      const [mode, change] = React.useState<'visible' | 'hidden'>('visible');
      setMode = change;
      return React.createElement(React.Activity, {
        mode,
        children: React.createElement(Component, {}, React.createElement('button', {}, 'toggle')),
      });
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await settle(() =>
        root.render(React.createElement(React.StrictMode, {}, React.createElement(App)))
      );
      const first = container.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
      expect(first.getAttribute('data-pui-style')).toContain('bg-black');
      await settle(() => container.querySelector('button')!.click());
      expect(first.getAttribute('data-pui-style')).toContain('bg-white');
      act(() => {
        flushSync(() => setMode('hidden'));
        const detachedTokens = first.getAttribute('data-pui-style');
        container.querySelector('button')!.click();
        expect(first.getAttribute('data-pui-style')).toBe(detachedTokens);
        flushSync(() => setMode('visible'));
      });
      await settle(() => {});
      const next = container.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
      expect(next.getAttribute('data-pui-style')).toContain('bg-white');
      expect(setups).toBe(1);
      expect(identities).toHaveLength(1);
      await settle(() => container.querySelector('button')!.click());
      expect(next.getAttribute('data-pui-style')).toContain('bg-black');
    } finally {
      await settle(() => root.unmount());
      container.remove();
    }
  });
});

it('react real same-document portal retains Rule paint through reopen', async () => {
  const { asOverlay } = await import('@proto.ui/hooks');
  let setups = 0,
    renders = 0,
    actions!: { open: () => void; close: () => void };
  const proto = definePrototype({
    name: 'react-portal-owned-leaf',
    setup(def) {
      setups++;
      const overlay = asOverlay();
      overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
      def.expose('portalActions', {
        open: () => overlay.openOverlay(),
        close: () => overlay.close(),
      });
      const target = def.feedback.style.declareDecoration(),
        active = def.state.bool('active', false);
      def.feedback.style.to(target).use(tw('bg-black'));
      def.rule({
        when: (w) => w.state(active).eq(true),
        intent: (i) => i.feedback.style.to(target).use(tw('bg-white')),
      });
      def.event.on('key.down', (_run, e) => {
        if (e.key === 'F2') active.set(!active.get());
      });
      return (r) => {
        renders++;
        return [r.decoration(target), r.slot()];
      };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const { createPortal } = await import('react-dom');
  const Component = createReactAdapter({ ...React, createPortal })(proto, {
    autoUpdateOnPropsChange: false,
  });
  const root = createRoot(container),
    portalRef = React.createRef<any>();
  try {
    await settle(() =>
      root.render(
        React.createElement(
          Component,
          { ref: portalRef },
          React.createElement('input', {
            'data-portal-probe': 'react',
            defaultValue: 'retain caller',
          })
        )
      )
    );

    const input = document.querySelector<HTMLInputElement>('input[data-portal-probe="react"]')!;
    const host = input.parentElement!,
      leaf = host.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
    expect(container.contains(host)).toBe(false);
    expect(host.isConnected).toBe(true);
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-black');
    input.focus();
    input.setSelectionRange(1, 4, 'backward');
    const before = renders;
    await settle(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
    );
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-white');
    expect(renders).toBe(before);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    actions = portalRef.current.getExposes().portalActions;
    for (let i = 0; i < 3; i++) {
      await settle(actions.close);
      await settle(actions.open);
    }
    const current = document.querySelector<HTMLInputElement>('input[data-portal-probe="react"]')!;
    expect(setups).toBe(1);
    expect(current.value).toBe('retain caller');
    expect(
      current
        .parentElement!.querySelector('[data-pui-owned-decoration]')!
        .getAttribute('data-pui-style')
    ).toBe('bg-white');
  } finally {
    await settle(() => root.unmount());
    container.remove();
  }
});
