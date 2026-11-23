import { afterEach, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '../src';
import { withWebComponentOwnedRelocation } from '../src/owned-relocation';

let sequence = 0;
const settle = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};
afterEach(() => document.body.replaceChildren());

for (const update of ['unchanged', 'replacement', 'empty'] as const) {
  it(`retains the last live feedback snapshot across a disconnected queued connect (${update})`, async () => {
    // Explicit controlled CE reaction delivery: the DOM moves are real, while
    // callback scheduling is injected. Native provenance remains a separate gate.
    const reactions: (() => void)[] = [];
    const proto = definePrototype({
      name: `slot-feedback-queued-${++sequence}`,
      setup(def) {
        def.feedback.style.use(tw('relative h-full w-full rounded-full bg-black'));
        return (r) => r.slot();
      },
    });
    const Base = AdaptToWebComponent(proto, { register: false });
    const lifecycle = Base.prototype as typeof Base.prototype & {
      connectedCallback(): void;
      disconnectedCallback(): void;
    };
    class Queued extends Base {
      connectedCallback() {
        reactions.push(() => lifecycle.connectedCallback.call(this));
      }
      disconnectedCallback() {
        reactions.push(() => lifecycle.disconnectedCallback.call(this));
      }
    }
    customElements.define(proto.name, Queued);
    const flushReactions = () => {
      while (reactions.length) reactions.shift()!();
    };
    const child = document.createElement(proto.name);
    document.body.append(child);
    flushReactions();
    await settle();
    const original = child.getAttribute('data-pui-style');
    expect(original).toContain('bg-black');
    child.remove();
    document.body.append(child);
    child.remove();
    flushReactions();
    expect(child.hasAttribute('data-pui-style')).toBe(false);
    // Inject a new committed style-port result, including an intentional empty
    // frame. A later transport restore must not replace it with the older cache.
    const replacement = update === 'replacement' ? ['relative', 'bg-white'] : [];
    if (update !== 'unchanged')
      (child as unknown as { _applier: { apply(tokens: string[]): void } })._applier.apply(
        replacement
      );
    withWebComponentOwnedRelocation([child], document.body, () => {
      document.body.append(child);
      flushReactions();
    });
    await settle();
    expect(child.getAttribute('data-pui-style')).toBe(
      update === 'unchanged' ? original : replacement.join(' ') || null
    );
  });
}

it('retires a disconnected snapshot before a fresh owner is acquired', async () => {
  let setups = 0;
  let unmounts = 0;
  const proto = definePrototype({
    name: `slot-feedback-terminal-${++sequence}`,
    setup(def) {
      setups++;
      def.feedback.style.use(tw(setups === 1 ? 'bg-black' : 'bg-white'));
      def.lifecycle.onUnmounted(() => {
        unmounts++;
      });
      return (r) => r.slot();
    },
  });
  AdaptToWebComponent(proto);
  const child = document.createElement(proto.name);
  document.body.append(child);
  await settle();
  expect(child.getAttribute('data-pui-style')).toBe('bg-black');
  child.remove();
  await settle();
  expect(unmounts).toBe(1);
  expect(child.hasAttribute('data-pui-style')).toBe(false);
  document.body.append(child);
  await settle();
  expect(setups).toBe(2);
  expect(child.getAttribute('data-pui-style')).toBe('bg-white');
});

for (const shape of ['slot', 'sibling', 'wrapper'] as const) {
  it(`retains caller feedback through ${shape} template commits`, async () => {
    let setups = 0;
    const child = definePrototype({
      name: `slot-feedback-child-${++sequence}`,
      setup(def) {
        setups++;
        def.feedback.style.use(tw('relative h-full w-full rounded-full bg-black'));
        return (r) => [r.slot()];
      },
    });
    const parent = definePrototype({
      name: `slot-feedback-parent-${++sequence}`,
      setup() {
        return (r) =>
          shape === 'sibling'
            ? [r.slot(), r.el('span', { style: tw('pointer-events-none') })]
            : shape === 'wrapper'
              ? r.el('section', r.slot())
              : [r.slot()];
      },
    });
    AdaptToWebComponent(child);
    AdaptToWebComponent(parent);
    const host = document.createElement(parent.name) as HTMLElement & { update(): void };
    const nested = document.createElement(child.name);
    host.append(nested);
    document.body.append(host);
    await settle();
    const expected = new Set(['relative', 'h-full', 'w-full', 'rounded-full', 'bg-black']);
    const tokens = () => new Set((nested.getAttribute('data-pui-style') ?? '').split(/\s+/));
    expect(tokens()).toEqual(expected);
    for (let index = 0; index < 3; index++) {
      host.update();
      await settle();
      expect(tokens()).toEqual(expected);
    }
    expect(setups).toBe(1);
    expect(host.contains(nested)).toBe(true);
  });
}

it('retains both actual Brutalist Thumb styles through horizontal corner projection', async () => {
  const {
    BrutalistScrollAreaRoot,
    BrutalistScrollAreaViewport,
    BrutalistScrollAreaScrollbar,
    BrutalistScrollAreaThumb,
  } = await import('@proto.ui/prototypes-brutalist/scroll-area');
  for (const proto of [
    BrutalistScrollAreaRoot,
    BrutalistScrollAreaViewport,
    BrutalistScrollAreaScrollbar,
    BrutalistScrollAreaThumb,
  ])
    if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
  const root = document.createElement(BrutalistScrollAreaRoot.name);
  const viewport = document.createElement(BrutalistScrollAreaViewport.name);
  const thumbs = [];
  root.append(viewport);
  for (const orientation of ['vertical', 'horizontal'] as const) {
    const track = document.createElement(BrutalistScrollAreaScrollbar.name);
    setElementProps(track, { orientation });
    const thumb = document.createElement(BrutalistScrollAreaThumb.name);
    thumb.dataset.orientation = orientation;
    track.append(thumb);
    root.append(track);
    thumbs.push(thumb);
  }
  document.body.append(root);
  await settle();
  const expected = new Set([
    'relative',
    'h-full',
    'w-full',
    'rounded-full',
    'bg-lavender-foreground',
  ]);
  for (const thumb of thumbs)
    expect(
      new Set((thumb.getAttribute('data-pui-style') ?? '').split(/\s+/)),
      thumb.dataset.orientation
    ).toEqual(expected);
});
