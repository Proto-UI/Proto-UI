import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  asHoverCardContent,
  hoverCardContent,
  hoverCardRoot,
  hoverCardTrigger,
} from '../src/hover-card';
import { createHoverCardInteractionIdAllocator } from '../src/hover-card/interaction-id';
import {
  HOVER_CARD_CONTEXT,
  HOVER_CARD_FAMILY,
  createHoverCardInteraction,
} from '../src/hover-card/shared';

for (const prototype of [hoverCardContent, hoverCardRoot, hoverCardTrigger])
  AdaptToWebComponent(prototype as any);

// The authored entry exercises the same protocol through real Overlay/Transition
// L1 epochs; the independent removal regression does not call Root.close().
AdaptToWebComponent(
  definePrototype({
    name: 'test-hover-card-retained-content',
    setup(def) {
      asHoverCardContent();
    },
  })
);
AdaptToWebComponent(
  definePrototype({
    name: 'test-hover-card-intent-probe',
    setup(def) {
      def.context.subscribe(HOVER_CARD_CONTEXT);
      let run: RunHandle<any>;
      def.lifecycle.onCreated((current) => (run = current));
      def.expose.method('snapshot', () => run.context.read(HOVER_CARD_CONTEXT));
      def.expose.method('borrowRelease', () =>
        run.anatomy.partsOf(HOVER_CARD_FAMILY, 'root')[0]?.getExpose('releaseInteraction')
      );
    },
  })
);

async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}
function create(props: Record<string, unknown> = {}, retained = false) {
  const root = document.createElement('base-hover-card-root') as any;
  const trigger = document.createElement('base-hover-card-trigger') as any;
  const content = document.createElement(
    retained ? 'test-hover-card-retained-content' : 'base-hover-card-content'
  ) as any;
  const probe = document.createElement('test-hover-card-intent-probe') as any;
  const requests: any[] = [];
  root.addEventListener(
    'openChange',
    (event: Event) => event.target === root && requests.push((event as CustomEvent).detail)
  );
  setElementProps(root, { openDelay: 0, closeDelay: 20, ...props });
  root.append(trigger, content, probe);
  document.body.append(root);
  return { root, trigger, content, probe, requests };
}
async function enterContent(card: ReturnType<typeof create>) {
  card.trigger.dispatchEvent(new Event('pointerenter'));
  await advance(0);
  card.content.getExposes().controls.complete();
  await flush();
  card.content.dispatchEvent(new Event('pointerenter'));
  card.trigger.dispatchEvent(new Event('pointerleave'));
  await advance(30);
  expect(card.root.getExposes().open.get()).toBe(true);
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('HoverCard transient intent lifecycle', () => {
  it('a removed hovered Content requests close at the original closeDelay boundary', async () => {
    // T-BASE-HOVER-CARD-CONTENT-0001-CASE-LIFECYCLE
    vi.useFakeTimers();
    const card = create();
    await flush();
    await enterContent(card);
    card.content.remove();
    await flush();
    await advance(19);
    expect(card.root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(card.root.getExposes().open.get()).toBe(false);
    expect(card.requests.filter((request) => !request.open)).toEqual([
      { open: false, reason: 'content.pointerleave' },
    ]);
  });

  it.each(['hover', 'focus'])(
    'withdraws a removed Trigger %s through the Root close delay',
    async (input) => {
      // T-BASE-HOVER-CARD-TRIGGER-0001-CASE-LIFECYCLE
      vi.useFakeTimers();
      const { root, trigger, requests } = create();
      await flush();
      if (input === 'hover') trigger.dispatchEvent(new Event('pointerenter'));
      else trigger.focus();
      await advance(0);
      expect(root.getExposes().open.get()).toBe(true);
      trigger.remove();
      await flush();
      await advance(19);
      expect(root.getExposes().open.get()).toBe(true);
      await advance(1);
      expect(root.getExposes().open.get()).toBe(false);
      expect(requests.filter((request) => !request.open)).toHaveLength(1);
    }
  );

  it('removing either part preserves the other current contribution', async () => {
    vi.useFakeTimers();
    const first = create();
    await flush();
    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    first.content.getExposes().controls.complete();
    first.content.dispatchEvent(new Event('pointerenter'));
    first.content.remove();
    await advance(100);
    expect(first.root.getExposes().open.get()).toBe(true);
    first.trigger.remove();
    await advance(20);
    expect(first.root.getExposes().open.get()).toBe(false);

    const second = create();
    await flush();
    await enterContent(second);
    second.trigger.remove();
    await advance(100);
    expect(second.root.getExposes().open.get()).toBe(true);
    second.content.remove();
    await advance(20);
    expect(second.root.getExposes().open.get()).toBe(false);
  });

  it('withdraws once when a controlled owner refuses to close and never retries on duplicate release', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-LIFECYCLE-OWNERSHIP
    vi.useFakeTimers();
    const card = create({ open: true });
    await flush();
    await enterContent(card);
    const owner = card.probe.getExposes().snapshot().contentInteractionOwner;
    card.content.remove();
    await advance(20);
    expect(card.root.getExposes().open.get()).toBe(true);
    expect(card.requests).toEqual([{ open: false, reason: 'content.pointerleave' }]);
    card.root.getExposes().releaseInteraction('content', owner);
    await advance(100);
    expect(card.requests).toHaveLength(1);
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(false);
  });

  it('retained Content reacquires a new view generation without replaying old hover or release', async () => {
    // T-BASE-HOVER-CARD-CONTENT-0001-CASE-LIFECYCLE
    vi.useFakeTimers();
    const card = create({}, true);
    await flush();
    await enterContent(card);
    const oldOwner = card.probe.getExposes().snapshot().contentInteractionOwner;
    const oldExposes = card.content.getExposes();
    card.root.getExposes().close('test.owner-close');
    await flush();
    expect(oldExposes.transitionState.get()).toBe('leaving');
    oldExposes.controls.complete();
    await flush();
    expect(card.content.hasAttribute('data-pui-view-detached')).toBe(true);
    // The WC Portal intentionally waits two host rendering opportunities before
    // actual unmount. Its early hidden attribute alone is not lifecycle evidence.
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    );
    await flush();
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(false);
    await advance(20);
    expect(card.requests.filter((request) => !request.open)).toEqual([
      { open: false, reason: 'test.owner-close' },
    ]);

    card.root.getExposes().openHoverCard('test.owner-open');
    await flush();
    expect(card.content.getExposes().open).toBe(oldExposes.open);
    oldExposes.controls.complete();
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(false);
    card.content.dispatchEvent(new Event('pointerenter'));
    const currentOwner = card.probe.getExposes().snapshot().contentInteractionOwner;
    expect(currentOwner).not.toBe(oldOwner);
    card.root.getExposes().releaseInteraction('content', oldOwner);
    await advance(100);
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(true);
    expect(card.requests.filter((request) => !request.open)).toHaveLength(1);
    card.content.dispatchEvent(new Event('pointerleave'));
    await advance(20);
    expect(card.requests.filter((request) => !request.open)).toHaveLength(2);
  });

  it('terminal remount does not carry old hover or let stale release clear the replacement', async () => {
    vi.useFakeTimers();
    const card = create();
    await flush();
    await enterContent(card);
    const oldOwner = card.probe.getExposes().snapshot().contentInteractionOwner;
    card.content.remove();
    await advance(10);
    card.root.append(card.content);
    await flush();
    card.content.getExposes().controls.complete();
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(false);
    card.content.dispatchEvent(new Event('pointerenter'));
    const newOwner = card.probe.getExposes().snapshot().contentInteractionOwner;
    expect(newOwner).not.toBe(oldOwner);
    card.root.getExposes().releaseInteraction('content', oldOwner);
    await advance(100);
    expect(card.root.getExposes().open.get()).toBe(true);
    expect(card.requests.filter((request) => !request.open)).toHaveLength(0);
    card.content.remove();
    await advance(20);
    expect(card.root.getExposes().open.get()).toBe(false);
  });

  it('a removed Trigger pending open cannot open its replacement generation early', async () => {
    vi.useFakeTimers();
    const card = create({ openDelay: 100 });
    await flush();
    card.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(50);
    card.trigger.remove();
    await flush();
    card.root.append(card.trigger);
    await flush();
    card.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(50);
    expect(card.root.getExposes().open.get()).toBe(false);
    expect(card.requests).toHaveLength(0);
    await advance(49);
    expect(card.root.getExposes().open.get()).toBe(false);
    await advance(1);
    expect(card.root.getExposes().open.get()).toBe(true);
    expect(card.requests).toHaveLength(1);
  });

  it('late teardown of a nested Root never withdraws from the outer Root', async () => {
    vi.useFakeTimers();
    const outer = create();
    await flush();
    outer.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    const inner = create();
    outer.root.append(inner.root);
    await flush();
    await enterContent(inner);
    inner.root.remove();
    await advance(100);
    expect(outer.root.getExposes().open.get()).toBe(true);
    expect(outer.requests).toEqual([{ open: true, reason: 'trigger.pointerenter' }]);
  });

  it.each(['trigger', 'content'] as const)(
    'preserves a first %s leave request for defaultOpen',
    async (part) => {
      vi.useFakeTimers();
      const card = create({ defaultOpen: true });
      await flush();
      card[part].dispatchEvent(new Event('pointerleave'));
      await advance(20);
      expect(card.root.getExposes().open.get()).toBe(false);
      expect(card.requests.filter((request) => !request.open)).toHaveLength(1);
    }
  );

  it('does not restart the close deadline when retiring an already-false source', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-FALSE-RETIREMENT
    vi.useFakeTimers();
    const card = create();
    await flush();
    await enterContent(card);
    card.content.dispatchEvent(new Event('pointerleave'));
    await advance(10);
    card.content.remove();
    await flush();
    await advance(9);
    expect(card.root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(card.root.getExposes().open.get()).toBe(false);
    expect(card.requests.filter((request) => !request.open)).toHaveLength(1);
  });

  it('invalid and repeated identities leave Context and requests untouched', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-RELEASE-NOOP
    vi.useFakeTimers();
    const card = create({ open: true });
    await flush();
    await enterContent(card);
    const release = card.root.getExposes().releaseInteraction;
    const before = card.probe.getExposes().snapshot();
    for (const [part, id] of [
      ['other', before.contentInteractionOwner],
      ['content', -1],
      ['content', 0],
      ['content', 0.5],
      ['content', NaN],
      ['content', Infinity],
      ['content', Number.MAX_SAFE_INTEGER + 1],
      ['content', Number.MAX_SAFE_INTEGER],
    ])
      expect(release(part, id)).toBe(false);
    expect(card.probe.getExposes().snapshot()).toBe(before);
    await advance(100);
    expect(card.requests).toHaveLength(0);
    expect(release('content', before.contentInteractionOwner)).toBe(true);
    const released = card.probe.getExposes().snapshot();
    expect(release('content', before.contentInteractionOwner)).toBe(false);
    expect(card.probe.getExposes().snapshot()).toBe(released);
    await advance(20);
    expect(card.requests).toHaveLength(1);
  });

  it('an old live publisher cannot withdraw the newer same-role contribution', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-STALE-CONTRIBUTION
    // Deliberately invalid overlapping anatomy is a stale-cleanup negative,
    // not a claim that multiple live Content parts are supported.
    vi.useFakeTimers();
    const card = create();
    await flush();
    await enterContent(card);
    const oldId = card.probe.getExposes().snapshot().contentInteractionOwner;
    const replacement = document.createElement('base-hover-card-content') as any;
    card.root.append(replacement);
    await flush();
    replacement.getExposes().controls.complete();
    replacement.dispatchEvent(new Event('pointerenter'));
    const newId = card.probe.getExposes().snapshot().contentInteractionOwner;
    expect(newId).not.toBe(oldId);
    card.content.dispatchEvent(new Event('pointerleave'));
    card.content.remove();
    await advance(100);
    expect(card.probe.getExposes().snapshot().contentInteractionOwner).toBe(newId);
    expect(card.probe.getExposes().snapshot().contentHovered).toBe(true);
    expect(card.root.getExposes().open.get()).toBe(true);
    replacement.remove();
    await advance(20);
    expect(card.root.getExposes().open.get()).toBe(false);
  });

  it('a borrowed operation returns false after Root shutdown and cannot affect a rebuilt Root', async () => {
    vi.useFakeTimers();
    const old = create();
    await flush();
    await enterContent(old);
    const id = old.probe.getExposes().snapshot().contentInteractionOwner;
    const release = old.probe.getExposes().borrowRelease();
    old.root.remove();
    await flush();
    const replacement = create();
    await flush();
    await enterContent(replacement);
    const current = replacement.probe.getExposes().snapshot();
    expect(current.contentInteractionOwner).not.toBe(id);
    expect(release('content', id)).toBe(false);
    expect(replacement.probe.getExposes().snapshot()).toBe(current);
    await advance(100);
    expect(replacement.root.getExposes().open.get()).toBe(true);
  });

  it('retires the borrowed reference before same-owner reentrant acquisition', () => {
    // Artificial callback reentry tests the small publisher helper directly.
    const binding = createHoverCardInteraction('content');
    const updates: any[] = [];
    let snapshot: any = { contentInteractionOwner: null, interactionVersion: 0 };
    const run: any = {
      context: {
        read: () => snapshot,
        update: (_key: unknown, update: (value: any) => any) => {
          snapshot = update(snapshot);
          updates.push(snapshot);
        },
      },
      anatomy: { partsOf: () => [{ getExpose: () => release }] },
    };
    const released: number[] = [];
    const release = (_part: string, id: number) => {
      released.push(id);
      if (released.length === 1) {
        binding.mount(run);
        binding.update(run, { contentHovered: true }, 'content.pointerenter');
      }
      return true;
    };
    binding.mount(run);
    binding.update(run, { contentHovered: true }, 'content.pointerenter');
    const first = snapshot.contentInteractionOwner;
    binding.release();
    const second = snapshot.contentInteractionOwner;
    expect(second).not.toBe(first);
    binding.release();
    binding.release();
    expect(released).toEqual([first, second]);
    expect(updates).toHaveLength(2);
  });

  it('fails closed at identity exhaustion instead of wrapping or reusing', () => {
    // T-BASE-HOVER-CARD-0001-CASE-IDENTITY-EXHAUSTION
    const allocate = createHoverCardInteractionIdAllocator(Number.MAX_SAFE_INTEGER - 1);
    expect(allocate()).toBe(Number.MAX_SAFE_INTEGER);
    expect(allocate).toThrow('interaction identity allocation exhausted');
    expect(allocate).toThrow('interaction identity allocation exhausted');
    for (const seed of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => createHoverCardInteractionIdAllocator(seed)).toThrow(
        'invalid interaction identity'
      );
  });

  it.each(['open', 'close'])(
    'Root destruction cancels a pending %s without affecting a new Root',
    async (direction) => {
      vi.useFakeTimers();
      const old = create({ openDelay: direction === 'open' ? 100 : 0, closeDelay: 100 });
      await flush();
      old.trigger.dispatchEvent(new Event('pointerenter'));
      if (direction === 'close') {
        await advance(0);
        old.trigger.dispatchEvent(new Event('pointerleave'));
      }
      await advance(50);
      const count = old.requests.length;
      old.root.remove();
      await flush();
      const replacement = create();
      await flush();
      await advance(150);
      expect(old.requests).toHaveLength(count);
      expect(replacement.root.getExposes().open.get()).toBe(false);
      expect(replacement.requests).toHaveLength(0);
    }
  );
});
