import { afterEach, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
let id = 0;
afterEach(() => document.body.replaceChildren());
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function create() {
  let changed = false;
  let renders = 0;
  const proto = definePrototype<{ active: boolean }>({
    name: `owned-reuse-${++id}`,
    setup(def) {
      def.props.define({ active: { type: 'boolean', default: false } });
      const target = def.feedback.style.declareDecoration();
      def.feedback.style.to(target).use(tw('bg-black'));
      def.rule({
        when: (w) => w.prop('active').eq(true),
        intent: (i) => i.feedback.style.to(target).use(tw('bg-white')),
      });
      return (r) => {
        renders++;
        return [r.decoration(target), r.el(changed ? 'article' : 'section', r.slot())];
      };
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name) as HTMLElement & {
    update(): void;
    setProps(v: unknown): void;
  };
  const input = document.createElement('input');
  input.value = 'keep selection';
  host.append(input);
  document.body.append(host);
  return {
    host,
    input,
    change: () => {
      changed = true;
    },
    renders: () => renders,
  };
}
it('default own props and explicit equal render retain physical view and focus', async () => {
  const { host, input, renders } = create();
  await settle();
  const leaf = host.querySelector('[data-pui-owned-decoration]')!;
  const wrapper = input.parentNode;
  input.focus();
  input.setSelectionRange(2, 8, 'backward');
  for (const active of [true, false, true]) {
    host.setProps({ active });
    host.update();
    await settle();
    expect(host.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
    expect(input.parentNode).toBe(wrapper);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
      2,
      8,
      'backward',
    ]);
    expect(leaf.getAttribute('data-pui-style')).toBe(active ? 'bg-white' : 'bg-black');
  }
  expect(renders()).toBeGreaterThan(1);
});
it('changed wrapper rejects without moving the live caller', () => {
  const { host, input, change } = create();
  const nodes = [...host.childNodes];
  const parent = input.parentNode;
  change();
  expect(() => host.update()).toThrow('structural rebind');
  expect([...host.childNodes]).toEqual(nodes);
  expect(input.parentNode).toBe(parent);
});
it('author-replaced leaf rejects rather than repairing or rebinding', () => {
  const { host } = create();
  const leaf = host.querySelector('[data-pui-owned-decoration]')!;
  leaf.replaceWith(leaf.cloneNode());
  expect(() => host.update()).toThrow('physical blueprint changed');
});
it('caller A to B remains live through the original slot projector', async () => {
  const { host, input } = create();
  await settle();
  const parent = input.parentNode!;
  const replacement = document.createElement('button');
  replacement.textContent = 'B';
  input.replaceWith(replacement);
  await settle();
  host.update();
  await settle();
  expect(replacement.parentNode).toBe(parent);
  expect(host.contains(input)).toBe(false);
});
it('ordinary no-decoration template still accepts structure changes', () => {
  let changed = false;
  const proto = definePrototype({
    name: `ordinary-reuse-control-${++id}`,
    setup() {
      return (r) => r.el(changed ? 'article' : 'section', r.slot());
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name) as HTMLElement & { update(): void };
  document.body.append(host);
  changed = true;
  host.update();
  expect(host.querySelector('article')).not.toBeNull();
});
it('acknowledgment-triggered update reuses the committed record without duplicate binding', async () => {
  let updates = 0;
  const proto = definePrototype({
    name: `owned-reentrant-ack-${++id}`,
    setup(def) {
      const target = def.feedback.style.declareDecoration();
      def.lifecycle.onMounted((run) => run.update());
      def.lifecycle.onUpdated((run) => {
        if (++updates === 1) run.update();
      });
      return (r) => [r.decoration(target), r.slot()];
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name);
  document.body.append(host);
  await settle();
  expect(updates).toBe(2);
  expect(host.querySelectorAll('[data-pui-owned-decoration]')).toHaveLength(1);
});
it('snapshot getter removing the view cannot authorize stale equal reuse', () => {
  let remove = false;
  let host: HTMLElement & { update(): void };
  const proto = definePrototype({
    name: `owned-getter-retire-${++id}`,
    setup(def) {
      const target = def.feedback.style.declareDecoration();
      return (r) => [
        r.decoration(target),
        {
          type: 'section',
          get children() {
            if (remove) host.remove();
            return r.slot();
          },
        },
      ];
    },
  });
  AdaptToWebComponent(proto);
  host = document.createElement(proto.name) as typeof host;
  document.body.append(host);
  const leaf = host.querySelector('[data-pui-owned-decoration]');
  remove = true;
  expect(() => host.update()).toThrow();
  expect(host.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
});
it.each(['aria-hidden', 'inert', 'tabindex', 'contenteditable'] as const)(
  'rejects altered decorative invariant %s on reuse',
  (attribute) => {
    const { host } = create();
    const leaf = host.querySelector('[data-pui-owned-decoration]')!;
    if (attribute === 'inert') leaf.removeAttribute(attribute);
    else leaf.setAttribute(attribute, attribute === 'aria-hidden' ? 'false' : '0');
    expect(() => host.update()).toThrow('physical leaf changed');
  }
);
it('physical membership callback detachment cannot acknowledge a stale reuse', () => {
  const { host } = create();
  const original = host.contains.bind(host);
  let first = true;
  host.contains = ((node: Node | null) => {
    if (first) {
      first = false;
      host.remove();
    }
    return original(node);
  }) as typeof host.contains;
  expect(() => host.update()).toThrow('reuse superseded');
});
it('ordinary author whole-host reparent still executes the normal owner update, not a relocation shortcut', async () => {
  const { host, renders } = create();
  await settle();
  const before = renders();
  const other = document.createElement('aside');
  document.body.append(other);
  other.append(host);
  await settle();
  expect(renders()).toBe(before + 1);
  expect(host.parentNode).toBe(other);
  expect(host.querySelectorAll('[data-pui-owned-decoration]')).toHaveLength(1);
  // This is only the existing owner-update route, not a Context rescope guarantee.
});

it('internal template authority bridges are absent from author def and run', async () => {
  let mounted = false;
  const proto = definePrototype({
    name: `owned-private-bridge-${++id}`,
    setup(def) {
      for (const key of [
        'hasDecorationTargets',
        'captureDecorationLease',
        'validateDecorationTemplate',
      ])
        expect(key in def.feedback.style).toBe(false);
      const target = def.feedback.style.declareDecoration();
      def.lifecycle.onMounted((run) => {
        mounted = true;
        for (const key of [
          'hasDecorationTargets',
          'captureDecorationLease',
          'validateDecorationTemplate',
        ])
          expect(key in run.feedback.style).toBe(false);
      });
      return (r) => r.decoration(target);
    },
  });
  AdaptToWebComponent(proto);
  document.body.append(document.createElement(proto.name));
  await settle();
  expect(mounted).toBe(true);
});
