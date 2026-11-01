import { afterEach, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  getElementProps,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import {
  SELECT_CONTEXT,
  selectContent,
  selectItem,
  selectRoot,
  selectTrigger,
  type SelectContextValue,
} from '../src/select';

// Source Runtime/real WC router evidence only. Synthetic host events are not
// trusted browser input, native UA heuristics, CSS paint or compiled consumers.
const Root = AdaptToWebComponent(selectRoot, { register: false });
const Content = AdaptToWebComponent(selectContent, { register: false });
const Trigger = AdaptToWebComponent(selectTrigger, { register: false });
const Item = AdaptToWebComponent(selectItem, { register: false });
customElements.define('select-pointer-owner-root', Root);
customElements.define('select-pointer-owner-content', Content);
customElements.define('select-pointer-owner-trigger', Trigger);
customElements.define('select-pointer-owner-item', Item);

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const pointer = (type: string, pointerType = 'mouse', buttons = 0) =>
  new PointerEvent(type, { bubbles: true, composed: true, pointerType, buttons });

let contextObserverSequence = 0;

async function fixture(onContextChange?: (next: SelectContextValue) => void) {
  vi.useFakeTimers();
  const root = new Root();
  const content = new Content();
  const trigger = new Trigger();
  let observer: HTMLElement | null = null;
  const observe = onContextChange;
  if (observe) {
    const name = `select-pointer-owner-observer-${++contextObserverSequence}`;
    const Observer = AdaptToWebComponent(
      definePrototype({
        name,
        setup(def) {
          def.context.subscribe(SELECT_CONTEXT, (_run, next) => observe(next));
        },
      }),
      { register: false }
    );
    customElements.define(name, Observer);
    observer = new Observer();
    expect(observer).toBeInstanceOf(Observer);
  }
  const items = ['alpha', 'beta', 'gamma'].map((value) => {
    const item = new Item();
    setElementProps(item, { value, textValue: value });
    item.textContent = value;
    content.append(item);
    return item;
  });
  setElementProps(root, { defaultOpen: true, defaultValue: 'alpha' });
  // The public context observer is created and attached before Item subscribers.
  // Each new case must prove the intended pre-cache-update window, or fail.
  root.append(trigger, ...(observer ? [observer] : []), content);
  const requests: Array<{ event: string; detail: unknown }> = [];
  for (const event of ['openChange', 'valueChange', 'select']) {
    root.addEventListener(event, (value) =>
      requests.push({ event, detail: (value as CustomEvent<unknown>).detail })
    );
  }
  document.body.append(root);
  await settle();
  expect(root).toBeInstanceOf(Root);
  expect(content).toBeInstanceOf(Content);
  expect(trigger).toBeInstanceOf(Trigger);
  for (const item of items) {
    expect(item).toBeInstanceOf(Item);
    expect(item.getExposes()).toHaveProperty('active');
    expect(item.getExposes()).toHaveProperty('focusSelf');
  }
  expect(document.activeElement).toBe(items[0]);
  requests.length = 0;
  const states = () => ({
    active: items.map((item) => item.getExposes().active.get()),
    focused: items.map((item) => item.getExposes().focused.get()),
    selected: items.map((item) => item.getExposes().selected.get()),
    value: root.getExposes().value.get(),
    open: root.getExposes().open.get(),
  });
  const unchangedSelection = () => {
    expect(states()).toMatchObject({
      selected: [true, false, false],
      value: 'alpha',
      open: true,
    });
    expect(requests).toEqual([]);
  };
  const move = async (index: number) => {
    items[index].dispatchEvent(pointer('pointerenter'));
    items[index].dispatchEvent(pointer('pointermove'));
    await settle();
  };
  return { root, content, trigger, items, requests, states, unchangedSelection, move };
}

afterEach(async () => {
  document.body.replaceChildren();
  await Promise.resolve();
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('hands A to B through Focus instead of publishing two active items', async () => {
  // T-BASE-SELECT-ITEM-0001-CASE-MOUSE-FOCUS-HANDOFF
  const f = await fixture();
  f.items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await settle();
  expect(f.states().active).toEqual([true, false, false]);
  await f.move(1);
  expect(f.states()).toMatchObject({ active: [false, true, false], focused: [false, true, false] });
  expect(document.activeElement).toBe(f.items[1]);
  f.unchangedSelection();
});

it('hands pointer navigation back to keyboard and back to another mouse item', async () => {
  const f = await fixture();
  await f.move(1);
  f.items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
  expect(f.states().active).toEqual([false, false, true]);
  expect(document.activeElement).toBe(f.items[2]);
  await f.move(0);
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  f.unchangedSelection();
});

it('keeps same-item requests in Focus rather than a local focused early return', async () => {
  const f = await fixture();
  await f.move(1);
  const hostFocus = vi.spyOn(f.items[1], 'focus');
  for (let i = 0; i < 3; i++) f.items[1].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(hostFocus).toHaveBeenCalledTimes(3);
  for (const [options] of hostFocus.mock.calls) expect(options?.preventScroll).toBe(true);
  expect(f.states().active).toEqual([false, true, false]);
  f.unchangedSelection();
});

it('resamples same-item visibility without forcing a supported UA true result off', async () => {
  const f = await fixture();
  await f.move(1);
  const item = f.items[1];
  const originalMatches = item.matches.bind(item);
  let nativeVisible = true;
  // This one-element query seam controls UA evidence; it is not native paint proof.
  vi.spyOn(item, 'matches').mockImplementation((selector) =>
    selector === ':focus-visible' ? nativeVisible : originalMatches(selector)
  );
  item.getExposes().focusSelf({ reason: 'keyboard', preventScroll: true });
  await settle();
  expect(item.getExposes().focusVisible.get()).toBe(true);
  item.dispatchEvent(pointer('pointermove'));
  await settle();
  expect(item.getExposes().focusVisible.get()).toBe(true);
  nativeVisible = false;
  item.dispatchEvent(pointer('pointermove'));
  await settle();
  expect(item.getExposes().focusVisible.get()).toBe(false);
  nativeVisible = true;
  item.getExposes().focusSelf({ reason: 'keyboard', preventScroll: true });
  await settle();
  expect(item.getExposes().focusVisible.get()).toBe(true);
  expect(f.states().active).toEqual([false, true, false]);
  f.unchangedSelection();
});

it('does not prepublish B when its host focus effect is refused', async () => {
  const f = await fixture();
  const refused = vi.spyOn(f.items[1], 'focus').mockImplementation(() => {});
  await f.move(1);
  expect(refused).toHaveBeenCalled();
  expect(f.states()).toMatchObject({ active: [true, false, false], focused: [true, false, false] });
  expect(document.activeElement).toBe(f.items[0]);
  f.unchangedSelection();
  refused.mockRestore();
  // A new admitted request supersedes the failed effect; no synthetic host:focus.
  f.items[1].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(f.states().active).toEqual([false, true, false]);
  expect(document.activeElement).toBe(f.items[1]);
  f.unchangedSelection();
});

it('does not transfer navigation during a synthetic native-source press-move sequence', async () => {
  const f = await fixture();
  f.items[0].dispatchEvent(pointer('pointerdown', 'mouse', 1));
  f.items[1].dispatchEvent(pointer('pointerenter', 'mouse', 1));
  f.items[1].dispatchEvent(pointer('pointermove', 'mouse', 1));
  await settle();
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  // Cancel instead of release activation so this negative does not commit selection.
  f.items[0].dispatchEvent(pointer('pointercancel', 'mouse', 0));
  await settle();
  f.unchangedSelection();
});

it('does not turn pointer enter alone into navigation', async () => {
  const f = await fixture();
  f.items[1].dispatchEvent(pointer('pointerenter'));
  await settle();
  expect(f.items[1].getExposes().hovered.get()).toBe(true);
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  f.items[1].dispatchEvent(pointer('pointerleave'));
  await settle();
  expect(f.items[1].getExposes().hovered.get()).toBe(false);
  expect(f.states().active).toEqual([true, false, false]);
  f.unchangedSelection();
});

it.each([
  ['touch', 'touch', 0],
  ['pen', 'pen', 0],
  ['unknown pointer', 'unknown', 0],
  ['primary-held', 'mouse', 1],
  ['secondary-held', 'mouse', 2],
  ['other-held', 'mouse', 32],
] as const)('rejects %s movement without prepublishing active', async (_name, type, buttons) => {
  // T-BASE-SELECT-ITEM-0001-CASE-MOUSE-HANDOFF-NEGATIVE
  const f = await fixture();
  f.items[1].dispatchEvent(pointer('pointerenter', type, buttons));
  f.items[1].dispatchEvent(pointer('pointermove', type, buttons));
  await settle();
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  f.unchangedSelection();
});

it.each(['missing', 'throwing'] as const)(
  'does not normalize %s native button evidence to none',
  async (mode) => {
    const f = await fixture();
    const event = pointer('pointermove');
    // Controlled native-source getter boundary, not an injected portable fact.
    Object.defineProperty(event, 'buttons', {
      get:
        mode === 'missing'
          ? () => undefined
          : () => {
              throw new Error('unavailable buttons');
            },
    });
    f.items[1].dispatchEvent(event);
    await settle();
    expect(f.states().active).toEqual([true, false, false]);
    expect(document.activeElement).toBe(f.items[0]);
    f.unchangedSelection();
  }
);

it('rejects a disabled Item', async () => {
  const f = await fixture();
  setElementProps(f.items[1], { disabled: true });
  await settle();
  await f.move(1);
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  f.unchangedSelection();
});

it('rejects Root disabled dynamically after opening without selecting or reopening', async () => {
  const f = await fixture();
  expect(f.states().open).toBe(true);
  expect(f.items.map((item) => item.getExposes().disabled.get())).toEqual([false, false, false]);
  setElementProps(f.root, { disabled: true });
  await settle();
  // Canonical Item disabled includes its Root context, not just own props.
  expect(f.items.map((item) => item.getExposes().disabled.get())).toEqual([true, true, true]);
  const before = f.states();
  const hostFocus = vi.spyOn(f.items[1], 'focus');
  f.requests.length = 0;
  await f.move(1);
  expect(hostFocus).not.toHaveBeenCalled();
  expect(f.states()).toEqual(before);
  expect(f.requests).toEqual([]);
});

it.each(['Root', 'Item'] as const)(
  'rejects canonical %s disabled during an earlier public Context callback',
  async (owner) => {
    let armed = false;
    let inject = (_next: SelectContextValue) => {};
    const witnessed: Array<{
      rootDisabled: boolean;
      ownDisabled: unknown;
      cachedDisabled: boolean;
    }> = [];
    const f = await fixture((next) => {
      if (!armed) return;
      armed = false;
      inject(next);
    });
    const item = f.items[1];
    const hostFocus = vi.spyOn(item, 'focus');
    inject = (next) => {
      // Public Item collection metadata reads the same canonical props as the
      // real metadata notification; no internal command state is altered here.
      const ownDisabled = item.getExposes().getCollectionItem().disabled;
      const cachedDisabled = item.getExposes().disabled.get();
      witnessed.push({ rootDisabled: next.disabled, ownDisabled, cachedDisabled });
      expect(owner === 'Root' ? next.disabled : ownDisabled).toBe(true);
      expect(cachedDisabled).toBe(false);
      // This real WC router dispatch is synchronous inside the Context callback,
      // not after a settled disabled projection and not an injected semantic fact.
      const before = f.states();
      const requestsBefore = [...f.requests];
      item.dispatchEvent(pointer('pointermove'));
      expect(f.states()).toMatchObject({
        selected: before.selected,
        value: before.value,
        open: before.open,
      });
      expect(f.requests).toEqual(requestsBefore);
    };
    const target = owner === 'Root' ? f.root : item;
    armed = true;
    setElementProps(target, { ...getElementProps(target), disabled: true });
    await settle();
    expect(witnessed).toHaveLength(1);
    expect(hostFocus).not.toHaveBeenCalled();
    expect(item.getExposes().disabled.get()).toBe(true);
    expect(f.root.getExposes().value.get()).toBe('alpha');
    expect(f.states().selected).toEqual([true, false, false]);
  }
);

it('rejects movement after popup close', async () => {
  const f = await fixture();
  f.root.getExposes().close('test close');
  await settle();
  expect(f.states().open).toBe(false);
  f.requests.length = 0;
  await f.move(1);
  expect(f.states()).toMatchObject({ active: [false, false, false], value: 'alpha', open: false });
  expect(f.requests).toEqual([]);
});

it('retains focused B on pointer leave instead of restoring selected A', async () => {
  const f = await fixture();
  await f.move(1);
  f.items[1].dispatchEvent(pointer('pointerleave'));
  await settle();
  expect(f.items[1].getExposes().hovered.get()).toBe(false);
  expect(f.states()).toMatchObject({ active: [false, true, false], focused: [false, true, false] });
  expect(document.activeElement).toBe(f.items[1]);
  f.unchangedSelection();
});

it('does not replay detached view input into the next open epoch', async () => {
  const f = await fixture();
  await f.move(1);
  f.root.getExposes().close('test close');
  await settle();
  f.items[2].dispatchEvent(pointer('pointermove'));
  f.trigger.click();
  await settle();
  expect(f.states().active).toEqual([true, false, false]);
  expect(document.activeElement).toBe(f.items[0]);
  expect(f.states().selected).toEqual([true, false, false]);
});

it('keeps selection commit separate from mouse navigation', async () => {
  const f = await fixture();
  await f.move(1);
  f.unchangedSelection();
  f.items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  expect(f.root.getExposes().value.get()).toBe('beta');
  expect(f.root.getExposes().open.get()).toBe(false);
  expect(f.items.map((item) => item.getExposes().selected.get())).toEqual([false, true, false]);
  expect(f.requests.filter((row) => row.event === 'valueChange')).toHaveLength(1);
});
