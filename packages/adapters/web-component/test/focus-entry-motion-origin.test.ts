import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';
import { createWebComponentPortalMount } from '../src/portal-mount';

const settle = async () => {
  await Promise.resolve();
  await (
    window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
  ).happyDOM.waitUntilComplete();
};
const disposals: Array<() => void> = [];
afterEach(async () => {
  for (const dispose of disposals.splice(0)) dispose();
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});
function entry() {
  const target = document.createElement('div');
  const ancestor = document.createElement('div');
  ancestor.append(target);
  document.body.append(ancestor);
  const modules = createWebComponentModules({
    el: target,
    surfaceProjection: createHostSurfaceProjection(target),
    instanceToken: {} as never,
    router: { rootTarget: target, globalTarget: window },
    rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
    effectsPort: {} as never,
    textControlTarget: null,
    imageViewTarget: null,
    getMeta: () => undefined,
    setExposes() {},
    runInCallbackScope: (fn) => fn(),
    isViewReady: () => true,
    isEntryAcquisitionReady: () => true,
    subscribeTargetReady: () => () => {},
    retryTargetReady() {},
  });
  const set = modules.focus!({ prototypeName: 'entry-motion-origin' }).find(
    ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
  )![1] as (
    target: HTMLElement,
    config: { strategy: 'descendant-first'; fallback: 'self' },
    enabled: boolean
  ) => void;
  const configure = (enabled: boolean) =>
    set(target, { strategy: 'descendant-first', fallback: 'self' }, enabled);
  configure(true);
  disposals.push(() => configure(false));
  return { target, ancestor, configure };
}
function transition(target: Element, trusted = true) {
  const event = new Event('transitionend', { bubbles: true, composed: true });
  Object.defineProperty(event, 'propertyName', { value: 'visibility' });
  // The emulator has no native CSS transitions; the real browser control
  // independently exercises trusted dispatch. This flag selects that branch.
  if (trusted) Object.defineProperty(event, 'isTrusted', { get: () => true });
  target.dispatchEvent(event);
  return event;
}

describe('WC entry native transition origin', () => {
  it('does not resample an ordinary entry for an unrelated transition', async () => {
    const fixture = entry();
    const outside = document.createElement('div');
    document.body.append(outside);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    transition(outside);

    expect(reads.mock.calls.filter(([node]) => node === fixture.target)).toHaveLength(0);
  });

  it('keeps a descendant transition and its current eligibility', async () => {
    const fixture = entry();
    const button = document.createElement('button');
    button.style.visibility = 'hidden';
    fixture.target.append(button);
    await settle();
    expect(fixture.target.tabIndex).toBe(0);

    button.style.visibility = 'visible';
    transition(button);

    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('uses a current ancestor after the delegated region moves', async () => {
    const fixture = entry();
    fixture.target.append(document.createElement('button'));
    const next = document.createElement('div');
    next.style.visibility = 'hidden';
    document.body.append(next);
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);

    next.append(fixture.target);
    transition(next);

    expect(fixture.target.tabIndex).toBe(0);
  });

  it('keeps a transition in the composed ancestor of a slotted region', async () => {
    const fixture = entry();
    const carrier = document.createElement('div');
    const root = carrier.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    const slot = document.createElement('slot');
    wrapper.append(slot);
    root.append(wrapper);
    carrier.append(fixture.target);
    // Happy DOM does not project assignedSlot; supply only that host fact.
    Object.defineProperty(fixture.target, 'assignedSlot', { configurable: true, value: slot });
    document.body.append(carrier);
    fixture.configure(true);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    transition(wrapper);

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(true);
  });

  it('keeps a newly projected logical Portal before observation refresh', () => {
    const fixture = entry();
    const projection = document.createElement('div');
    projection.append(document.createElement('button'));
    fixture.target.append(projection);
    const portal = createWebComponentPortalMount();
    portal.mount(projection);
    disposals.push(() => portal.unmount(projection));
    expect(fixture.target.contains(projection)).toBe(false);

    transition(projection.firstElementChild!);

    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps an external checked radio peer transition', async () => {
    const fixture = entry();
    const inside = document.createElement('input');
    const peer = document.createElement('input');
    for (const radio of [inside, peer]) {
      radio.type = 'radio';
      radio.name = 'entry-motion-peer';
      radio.tabIndex = 0;
    }
    peer.checked = true;
    fixture.target.append(inside);
    document.body.append(peer);
    await settle();
    expect(fixture.target.tabIndex).toBe(0);

    peer.style.display = 'none';
    transition(peer);

    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps repeated synthetic transition notifications', async () => {
    const fixture = entry();
    const button = document.createElement('button');
    fixture.target.append(button);
    const outside = document.createElement('div');
    document.body.append(outside);
    await settle();
    const event = transition(outside, false);

    button.style.visibility = 'hidden';
    outside.dispatchEvent(event);
    expect(fixture.target.tabIndex).toBe(0);
    button.style.visibility = 'visible';
    outside.dispatchEvent(event);
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });
});
