import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { createRuntimeSession } from '@proto.ui/runtime';

let id = 0;
afterEach(() => document.body.replaceChildren());
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('draft owned decoration through actual WC / Rule / feedback', () => {
  it('merges and withdraws independent leaf paint without rerender or caller reset', async () => {
    let renders = 0;
    const proto = definePrototype({
      name: `owned-decoration-live-${++id}`,
      setup(def) {
        const first = def.feedback.style.declareDecoration();
        const second = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', false);
        def.feedback.style.use(tw('p-4'));
        def.feedback.style.to(first).use(tw('bg-red-500 opacity-50'));
        def.feedback.style.to(second).use(tw('bg-green-500'));
        def.rule({
          when: (w) => w.state(active).eq(true),
          intent: (i) => i.feedback.style.to(first).use(tw('bg-blue-500 opacity-100')),
        });
        def.event.on('host:click', () => active.set(!active.get()));
        return (r) => {
          renders++;
          return [r.decoration(first), r.el('section', r.slot()), r.decoration(second)];
        };
      },
    });
    AdaptToWebComponent(proto);
    const host = document.createElement(proto.name) as HTMLElement & { update(): void };
    const input = document.createElement('input');
    input.value = 'preserve';
    host.append(input);
    document.body.append(host);
    await settle();
    const leaves = [...host.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
    expect(leaves).toHaveLength(2);
    const original = [...host.childNodes];
    const inputParent = input.parentNode;
    expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-red-500 opacity-50');
    expect(leaves[1].getAttribute('data-pui-style')).toBe('bg-green-500');
    for (const leaf of leaves) {
      expect(leaf.getAttribute('aria-hidden')).toBe('true');
      expect(leaf.hasAttribute('inert')).toBe(true);
      expect(leaf.hasAttribute('tabindex')).toBe(false);
      expect(leaf.childNodes).toHaveLength(0);
      expect(leaf.style.getPropertyValue('pointer-events')).toBe('none');
    }
    input.focus();
    input.setSelectionRange(1, 5, 'backward');
    host.click();
    await settle();
    expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-blue-500 opacity-100');
    expect(leaves[1].getAttribute('data-pui-style')).toBe('bg-green-500');
    expect(host.getAttribute('data-pui-style')).toBe('p-4');
    host.click();
    await settle();
    expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-red-500 opacity-50');
    expect(renders).toBe(1);
    expect([...host.childNodes]).toEqual(original);
    expect(input.parentNode).toBe(inputParent);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe('backward');
    expect(() => host.update()).toThrow('structural rebind unsupported');
    expect([...host.childNodes]).toEqual(original);
    expect(input.parentNode).toBe(inputParent);
    host.remove();
    await settle();
    host.click();
    await settle();
    expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-red-500 opacity-50');
  });
  it('rejects declaration on a runtime without the physical capability', () => {
    expect(() =>
      createRuntimeSession(
        definePrototype({
          name: `owned-decoration-unsupported-${++id}`,
          setup(def) {
            def.feedback.style.declareDecoration();
          },
        }),
        {
          prototypeName: 'unsupported-runtime',
          getRawProps: () => ({}),
          commit: () => {},
          schedule: (task) => task(),
          scheduleDelay: () => ({ cancel() {} }),
        }
      )
    ).toThrow('owned-decoration unsupported');
  });
  it.each(['duplicate', 'foreign', 'missing', 'children', 'style', 'props'] as const)(
    'rejects %s decoration blueprint before moving caller nodes',
    async (kind) => {
      const proto = definePrototype({
        name: `owned-decoration-reject-${++id}`,
        setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('bg-red-500'));
          return (r) => {
            const leaf = r.decoration(target);
            const bad =
              kind === 'duplicate'
                ? [leaf, leaf]
                : kind === 'foreign'
                  ? [r.decoration({} as any)]
                  : kind === 'missing'
                    ? []
                    : [{ ...leaf, [kind]: kind === 'children' ? 'forbidden' : {} }];
            return [r.slot(), ...bad] as any;
          };
        },
      });
      AdaptToWebComponent(proto);
      const host = document.createElement(proto.name);
      const input = document.createElement('input');
      input.value = 'untouched';
      const tail = document.createTextNode('tail');
      host.append(input, tail);
      const original = [...host.childNodes];
      expect(() => document.body.append(host)).toThrow();
      expect([...host.childNodes]).toEqual(original);
      expect(input.parentNode).toBe(host);
      expect(input.value).toBe('untouched');
      expect(host.querySelector('[data-pui-owned-decoration]')).toBeNull();
      await settle();
    }
  );

  it('rejects the unsupported Shadow profile without installing leaf paint', () => {
    const proto = definePrototype({
      name: `owned-decoration-shadow-${++id}`,
      setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('bg-red-500'));
        return (r) => r.decoration(target);
      },
    });
    AdaptToWebComponent(proto, { shadow: true });
    const host = document.createElement(proto.name);
    expect(() => document.body.append(host)).toThrow('owned-decoration unsupported');
    expect(host.shadowRoot?.querySelector('[data-pui-owned-decoration]')).toBeNull();
  });
});

it('rejects unimplemented portal decoration before moving caller slot nodes', async () => {
  const { asOverlay } = await import('@proto.ui/hooks');
  const proto = definePrototype({
    name: `owned-decoration-portal-${++id}`,
    setup(def) {
      asOverlay().configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
      const target = def.feedback.style.declareDecoration();
      def.feedback.style.to(target).use(tw('bg-black'));
      return (r) => [r.el('section', r.slot()), r.decoration(target)];
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name),
    input = document.createElement('input');
  input.value = 'unchanged';
  host.append(input);
  expect(() => document.body.append(host)).toThrow('owned-decoration portal unsupported');
  expect(input.parentNode).toBe(host);
  expect(input.value).toBe('unchanged');
  expect(host.querySelector('[data-pui-owned-decoration]')).toBeNull();
});
