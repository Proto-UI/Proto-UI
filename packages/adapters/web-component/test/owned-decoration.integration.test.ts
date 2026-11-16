import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { createRuntimeSession } from '@proto.ui/runtime';
import type { PropsBaseType } from '@proto.ui/types';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

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
    expect(() => host.update()).not.toThrow();
    expect(renders).toBe(2);
    expect([...host.childNodes]).toEqual(original);
    expect(input.parentNode).toBe(inputParent);
    host.remove();
    await settle();
    host.click();
    await settle();
    expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-red-500 opacity-50');
  });
  it('keeps the split surface, owned leaf and native slot stable until a view detaches', async () => {
    let run!: RunHandle<PropsBaseType>;
    let renders = 0;
    const proto = definePrototype({
      name: `owned-decoration-split-${++id}`,
      setup(def) {
        const decoration = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', false);
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose.method('present', (present: boolean) => run.lifecycle.setPresent(present));
        def.expose.method('activate', () => active.set(true));
        def.feedback.style.to(decoration).use(tw('opacity-50'));
        def.rule({
          when: (w) => w.state(active).eq(true),
          intent: (i) => i.feedback.style.to(decoration).use(tw('opacity-100')),
        });
        return (r) => {
          renders++;
          return [r.decoration(decoration), r.slot()];
        };
      },
    });
    const C = AdaptToWebComponent(proto, {
      shadow: {
        mode: 'open',
        presentation: 'split',
        styleArtifact: renderProtoShadowSplitStyleArtifact(['opacity-50', 'opacity-100']),
      },
    });
    const host = new C();
    const input = document.createElement('input');
    input.value = 'caller input';
    host.append(input);
    document.body.append(host);
    await settle();
    const surface = host.shadowRoot!.querySelector('[part="surface"]')!;
    const leaf = surface.querySelector('[data-pui-owned-decoration]')!;
    const slot = surface.querySelector('slot')!;
    expect(slot.assignedNodes()).toEqual([input]);
    expect(leaf.getAttribute('data-pui-style')).toBe('opacity-50');
    expect(leaf.getAttribute('aria-hidden')).toBe('true');
    expect(leaf.hasAttribute('inert')).toBe(true);
    expect(leaf.hasAttribute('tabindex')).toBe(false);
    const exposes = host.getExposes() as { activate(): void; present(value: boolean): void };
    input.focus();
    input.setSelectionRange(1, 5, 'backward');
    exposes.activate();
    await settle();
    expect(leaf.getAttribute('data-pui-style')).toBe('opacity-100');
    expect(renders).toBe(1);
    host.update();
    await settle();
    expect(renders).toBe(2);
    expect([...surface.children]).toEqual([leaf, slot]);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
      1,
      5,
      'backward',
    ]);
    exposes.present(false);
    await settle();
    expect(surface.isConnected).toBe(true);
    expect(surface.childNodes).toHaveLength(0);
    expect(input.parentNode).toBe(host);
    exposes.present(true);
    await vi.waitFor(() =>
      expect(surface.querySelector('[data-pui-owned-decoration]')).not.toBeNull()
    );
    const replacement = surface.querySelector('[data-pui-owned-decoration]')!;
    expect(replacement).not.toBe(leaf);
    expect(replacement.getAttribute('data-pui-style')).toBe('opacity-100');
    expect(surface.querySelector('slot')!.assignedNodes()).toEqual([input]);
    expect(input.value).toBe('caller input');
    host.remove();
    await settle();
    expect(host.shadowRoot!.childNodes).toHaveLength(0);
  });

  it.each([
    'move surface',
    'remove text',
    'edit text',
    'rename slot',
    'reorder slot',
    'remove paint tokens',
    'add inline paint',
    'hide surface',
    'inert surface',
    'retag surface',
    'conceal surface with display',
    'conceal surface with visibility',
    'conceal surface with zero opacity',
    'conceal surface with variable opacity',
    'conceal surface with variable display',
    'conceal surface with variable visibility',
    'conceal surface with variable content-visibility',
    'conceal surface with stylesheet display',
    'remove split marker',
  ] as const)('rejects invalid split decoration reuse after %s', (mutation) => {
    const C = AdaptToWebComponent(
      definePrototype({
        name: `owned-decoration-split-reuse-${++id}`,
        setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('opacity-50'));
          return (r) => [r.decoration(target), 'Template text', r.slot()];
        },
      }),
      {
        shadow: {
          mode: 'open',
          presentation: 'split',
          styleArtifact: renderProtoShadowSplitStyleArtifact(['opacity-50']),
        },
      }
    );
    const host = new C();
    const caller = document.createTextNode('Caller text');
    host.append(caller);
    document.body.append(host);
    const surface = host.shadowRoot!.querySelector('[part="surface"]')!;
    const text = Array.from(surface.childNodes).find((node) => node.nodeType === 3)! as Text;
    const leaf = surface.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
    expect(leaf.getAttribute('data-pui-style')).toBe('opacity-50');
    expect(text.data).toBe('Template text');
    caller.data = 'Updated caller text';
    expect(() => host.update()).not.toThrow();
    expect(surface.contains(text)).toBe(true);
    const slot = surface.querySelector('slot')!;
    expect(slot.assignedNodes()).toEqual([caller]);
    expect(surface.contains(leaf)).toBe(true);
    const destination = document.createElement('div');
    document.body.append(destination);
    if (mutation === 'move surface') destination.append(surface);
    if (mutation === 'remove text') text.remove();
    if (mutation === 'edit text') text.data = 'External edit';
    if (mutation === 'rename slot') slot.name = 'elsewhere';
    if (mutation === 'reorder slot') surface.prepend(slot);
    if (mutation === 'remove paint tokens') leaf.removeAttribute('data-pui-style');
    if (mutation === 'add inline paint') leaf.style.setProperty('opacity', '1');
    if (mutation === 'hide surface') surface.setAttribute('aria-hidden', 'true');
    if (mutation === 'inert surface') surface.setAttribute('inert', '');
    if (mutation === 'retag surface') surface.setAttribute('part', 'other');
    if (mutation === 'conceal surface with display')
      (surface as HTMLElement).style.setProperty('display', 'none', 'important');
    if (mutation === 'conceal surface with visibility')
      (surface as HTMLElement).style.visibility = 'hidden';
    if (mutation === 'conceal surface with zero opacity')
      (surface as HTMLElement).style.opacity = '0';
    if (mutation === 'remove split marker') {
      expect(surface.hasAttribute('data-pui-split-surface')).toBe(true);
      surface.removeAttribute('data-pui-split-surface');
    }
    const expected =
      mutation === 'move surface'
        ? 'stale decoration blueprint lease'
        : mutation === 'remove paint tokens' || mutation === 'add inline paint'
          ? 'decoration physical leaf changed'
          : 'decoration physical blueprint changed';
    if (mutation.startsWith('conceal surface with variable ')) {
      const property = mutation.slice('conceal surface with variable '.length);
      const value = property === 'opacity' ? '0' : property === 'display' ? 'none' : 'hidden';
      const { style } = surface as HTMLElement;
      style.setProperty('--split-concealment', value);
      style.setProperty(property, 'var(--split-concealment)');
      // The DOM test environment exposes the declaration without resolving var().
      const window = host.ownerDocument.defaultView!;
      const computed = {
        opacity: property === 'opacity' ? value : '',
        getPropertyValue: (name: string) => (name === property ? value : ''),
      } as CSSStyleDeclaration;
      const readStyle = vi.spyOn(window, 'getComputedStyle').mockReturnValueOnce(computed);
      try {
        expect(() => host.update()).toThrow(expected);
      } finally {
        readStyle.mockRestore();
      }
    } else if (mutation === 'conceal surface with stylesheet display') {
      const stylesheet = document.createElement('style');
      stylesheet.textContent = '[part="surface"] { display: none }';
      host.shadowRoot!.append(stylesheet);
      expect((surface as HTMLElement).style.display).toBe('');
      const window = host.ownerDocument.defaultView!;
      const readStyle = vi.spyOn(window, 'getComputedStyle').mockReturnValueOnce({
        getPropertyValue: (name: string) => (name === 'display' ? 'none' : ''),
      } as CSSStyleDeclaration);
      try {
        expect(() => host.update()).toThrow(expected);
      } finally {
        readStyle.mockRestore();
      }
    } else {
      expect(() => host.update()).toThrow(expected);
    }
    expect(surface.contains(leaf)).toBe(true);
    expect(caller.data).toBe('Updated caller text');
  });

  it.each(['slot', 'section'] as const)(
    'rejects equal split reuse when a stylesheet hides the caller path through %s',
    (selector) => {
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-hidden-slot-${++id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.decoration(target), r.el('section', r.slot())];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      const host = new C();
      const caller = document.createTextNode('Caller text');
      host.append(caller);
      document.body.append(host);
      const shadow = host.shadowRoot!;
      const hidden = shadow.querySelector(selector)!;
      const slot = shadow.querySelector('slot')!;
      expect(() => host.update()).not.toThrow();
      expect(slot.assignedNodes()).toEqual([caller]);
      const style = document.createElement('style');
      style.textContent = `${selector} { display: none }`;
      shadow.append(style);
      // Provide the exact resolved style for the styled node in happy-dom.
      const window = host.ownerDocument.defaultView!;
      const original = window.getComputedStyle.bind(window);
      const readStyle = vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
        target === hidden
          ? ({
              getPropertyValue: (name: string) => (name === 'display' ? 'none' : ''),
            } as CSSStyleDeclaration)
          : original(target)
      );
      try {
        expect(() => host.update()).toThrow('decoration physical blueprint changed');
      } finally {
        readStyle.mockRestore();
      }
      expect(caller.parentNode).toBe(host);
      expect(slot.assignedNodes()).toEqual([caller]);
    }
  );

  it.each(['[data-pui-owned-decoration]', 'section'] as const)(
    'rejects stylesheet layout hiding of a split decoration through %s',
    (selector) => {
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-hidden-leaf-${++id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.el('section', r.decoration(target)), r.slot()];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      const host = new C();
      const caller = document.createTextNode('Caller text');
      host.append(caller);
      document.body.append(host);
      expect(() => host.update()).not.toThrow();
      const shadow = host.shadowRoot!;
      const hidden = shadow.querySelector(selector)!;
      const style = document.createElement('style');
      style.textContent = `${selector} { display: none }`;
      shadow.append(style);
      const window = host.ownerDocument.defaultView!;
      const original = window.getComputedStyle.bind(window);
      const readStyle = vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
        if (target !== hidden) return original(target);
        return {
          getPropertyValue: (name: string) => (name === 'display' ? 'none' : ''),
        } as CSSStyleDeclaration;
      });
      try {
        expect(() => host.update()).toThrow('decoration physical leaf changed');
      } finally {
        readStyle.mockRestore();
      }
      expect(caller.parentNode).toBe(host);
      expect(shadow.querySelector('slot')!.assignedNodes()).toEqual([caller]);
    }
  );

  it('allows owned Root opacity-0 and preserves later caller replacement on reuse', () => {
    const C = AdaptToWebComponent(
      definePrototype({
        name: `owned-root-zero-opacity-${++id}`,
        setup(def) {
          def.feedback.style.use(tw('opacity-0'));
          const target = def.feedback.style.declareDecoration();
          return (r) => [r.decoration(target), r.slot()];
        },
      }),
      {
        shadow: {
          mode: 'open',
          presentation: 'split',
          styleArtifact: renderProtoShadowSplitStyleArtifact(['opacity-0']),
        },
      }
    );
    const host = new C();
    const callerA = document.createTextNode('Caller A');
    host.append(callerA);
    document.body.append(host);
    const surface = host.shadowRoot!.querySelector('[part="surface"]')!;
    const slot = surface.querySelector('slot')!;
    expect(surface.getAttribute('data-pui-style')).toBe('opacity-0');
    const window = host.ownerDocument.defaultView!;
    const original = window.getComputedStyle.bind(window);
    const readStyle = vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
      if (node !== surface) return original(node);
      return {
        getPropertyValue: (name: string) => (name === 'opacity' ? '0' : ''),
      } as CSSStyleDeclaration;
    });
    try {
      expect(() => host.update()).not.toThrow();
      expect(slot.assignedNodes()).toEqual([callerA]);
      const callerB = document.createTextNode('Caller B');
      callerA.replaceWith(callerB);
      expect(() => host.update()).not.toThrow();
      expect(slot.assignedNodes()).toEqual([callerB]);
    } finally {
      readStyle.mockRestore();
    }
  });

  it.each(['remove', 'replace'] as const)(
    'rejects a split connection reaction that can %s a caller before acknowledgement',
    (mutation) => {
      const name = `pui-decoration-caller-reaction-${++id}`;
      let changed = false;
      customElements.define(
        name,
        class extends HTMLElement {
          connectedCallback() {
            const hosted = (this.getRootNode() as ShadowRoot).host;
            const caller = hosted?.firstChild;
            if (!caller) return;
            changed = true;
            if (mutation === 'remove') caller.remove();
            else caller.replaceWith(hosted.ownerDocument.createTextNode('Replacement'));
          }
        }
      );
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-caller-boundary-${id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.decoration(target), r.slot(), r.el(name, {})];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      const host = new C();
      host.append(document.createTextNode('Original'));
      expect(() => document.body.append(host)).toThrow('decoration caller projection changed');
      expect(changed).toBe(true);
    }
  );

  it.each(['remove decoration', 'reorder slot'] as const)(
    'rejects a connection reaction that can %s before split acknowledgement',
    (mutation) => {
      const mutator = `pui-decoration-reaction-${++id}`;
      let reacted = false;
      customElements.define(
        mutator,
        class extends HTMLElement {
          connectedCallback() {
            reacted = true;
            const surface = this.parentElement!;
            if (mutation === 'remove decoration')
              surface.querySelector('[data-pui-owned-decoration]')!.remove();
            else surface.prepend(surface.querySelector('slot')!);
          }
        }
      );
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-split-reaction-${id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.decoration(target), r.slot(), r.el(mutator, {})];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      const host = new C();
      const caller = document.createTextNode('Caller text');
      host.append(caller);
      expect(() => document.body.append(host)).toThrow('decoration physical blueprint changed');
      expect(reacted).toBe(true);
      expect(caller.parentNode).toBe(host);
    }
  );

  it.each(['inert', 'aria-hidden', 'part'] as const)(
    'rejects a detached child constructor changing the live split surface %s',
    (attribute) => {
      const mutator = `pui-decoration-constructor-${++id}`;
      let host: HTMLElement;
      let constructed = false;
      customElements.define(
        mutator,
        class extends HTMLElement {
          constructor() {
            super();
            constructed = true;
            const surface = host.shadowRoot!.querySelector('[part="surface"]')!;
            surface.setAttribute(attribute, attribute === 'part' ? 'changed' : 'true');
          }
        }
      );
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-split-constructor-${id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.decoration(target), r.slot(), r.el(mutator, {})];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      host = new C();
      const caller = document.createTextNode('Caller text');
      host.append(caller);
      expect(() => document.body.append(host)).toThrow('decoration physical blueprint changed');
      expect(constructed).toBe(true);
      expect(caller.parentNode).toBe(host);
    }
  );

  it.each(['remove', 'retag'] as const)(
    'rejects a later constructor that can %s an earlier staged sibling',
    (mutation) => {
      const earlier = `pui-decoration-staged-earlier-${++id}`;
      const later = `pui-decoration-staged-later-${id}`;
      let staged: HTMLElement | undefined;
      let changed = false;
      customElements.define(
        earlier,
        class extends HTMLElement {
          constructor() {
            super();
            staged = this;
          }
        }
      );
      customElements.define(
        later,
        class extends HTMLElement {
          constructor() {
            super();
            if (!staged || !staged.parentNode) return;
            changed = true;
            if (mutation === 'remove') staged.remove();
            else staged.setAttribute('title', 'rewritten');
          }
        }
      );
      const C = AdaptToWebComponent(
        definePrototype({
          name: `owned-decoration-staged-constructor-${id}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            return (r) => [r.el(earlier, {}), r.el(later, {}), r.decoration(target), r.slot()];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
          },
        }
      );
      const host = new C();
      const caller = document.createTextNode('Caller text');
      host.append(caller);
      expect(() => document.body.append(host)).toThrow('decoration physical blueprint changed');
      expect(changed).toBe(true);
      expect(caller.parentNode).toBe(host);
      expect(host.shadowRoot?.querySelector('[part="surface"]')?.childNodes.length ?? 0).toBe(0);
    }
  );

  it('rejects a duplicate split decoration before publishing the new view', () => {
    const C = AdaptToWebComponent(
      definePrototype({
        name: `owned-decoration-invalid-split-${++id}`,
        setup(def) {
          const target = def.feedback.style.declareDecoration();
          return (r) => [r.slot(), r.decoration(target), r.decoration(target)];
        },
      }),
      {
        shadow: {
          mode: 'open',
          presentation: 'split',
          styleArtifact: renderProtoShadowSplitStyleArtifact([]),
        },
      }
    );
    const host = new C();
    const child = document.createElement('input');
    host.append(child);
    expect(() => document.body.append(host)).toThrow(/duplicate decoration binding/);
    expect(child.parentNode).toBe(host);
    expect(host.shadowRoot?.querySelector('[data-pui-owned-decoration]')).toBeNull();
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

it.each([
  { split: false, directBody: false },
  { split: false, directBody: true },
  { split: true, directBody: false },
  { split: true, directBody: true },
])(
  'paints a same-document portal and replays on reopen (split=$split, directBody=$directBody)',
  async ({ split, directBody }) => {
    const { asOverlay } = await import('@proto.ui/hooks');
    let setups = 0,
      renders = 0;
    const proto = definePrototype({
      name: `owned-decoration-portal-${++id}`,
      setup(def) {
        setups++;
        const overlay = asOverlay();
        overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
        def.expose('open', () => overlay.openOverlay());
        def.expose('close', () => overlay.close());
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', false);
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
    AdaptToWebComponent(
      proto,
      split
        ? {
            shadow: {
              mode: 'open',
              presentation: 'split',
              styleArtifact: renderProtoShadowSplitStyleArtifact(['bg-black', 'bg-white']),
            },
          }
        : undefined
    );
    const origin = directBody ? document.body : document.createElement('div');
    if (!directBody) document.body.append(origin);
    const host = document.createElement(proto.name) as HTMLElement & { getExposes(): any };
    const input = document.createElement('input');
    input.value = 'unchanged';
    host.append(input);
    origin.append(host);
    const flush = async () => {
      for (let i = 0; i < 30; i++) await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    };
    await flush();
    const view = host.shadowRoot ?? host;
    const leaf = view.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
    expect(host.parentNode).toBe(document.body);
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-black');
    const before = renders;
    input.focus();
    input.setSelectionRange(1, 4, 'backward');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    await flush();
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-white');
    expect(renders).toBe(before);
    expect(host.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    for (let i = 0; i < 3; i++) {
      host.getExposes().close();
      await flush();
      host.getExposes().open();
      await flush();
    }
    expect(setups).toBe(1);
    const reopened = view.querySelector('[data-pui-owned-decoration]')!;
    expect(reopened.getAttribute('data-pui-style')).toBe('bg-white');
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('unchanged');
  }
);
