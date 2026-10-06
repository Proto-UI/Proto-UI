import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebControlLabelHost, isTrustedNonPointerLabelActivation } from '../src/web';
const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture(parent: HTMLElement | ShadowRoot = document.body) {
  const el = document.createElement('div');
  el.textContent = 'Label';
  parent.append(el);
  const activate = vi.fn();
  const change = vi.fn();
  const lease = createWebControlLabelHost(() => el).attach({
    kind: 'label',
    activation: true,
    onActivate: activate,
    onViewChange: change,
  });
  cleanups.push(() => lease.dispose());
  return { el, activate, change, lease };
}
async function gesture(
  el: HTMLElement,
  options: { move?: boolean; cancel?: boolean; ctrlKey?: boolean } = {}
) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
      ctrlKey: options.ctrlKey,
    })
  );
  if (options.move)
    el.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        composed: true,
        pointerId: 1,
        clientX: 30,
        clientY: 10,
      })
    );
  if (options.cancel)
    el.dispatchEvent(
      new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: 1 })
    );
  el.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
  );
  el.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
      cancelable: true,
      button: 0,
      detail: 1,
    })
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
const mutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
describe('Control Label Web intent bridge', () => {
  it('accepts only the current Module-declared activation and cannot revive a retired lease', async () => {
    const f = fixture();
    f.lease.setActivation(false);
    await gesture(f.el);
    expect(f.activate).not.toHaveBeenCalled();
    f.lease.setActivation(true);
    await gesture(f.el);
    expect(f.activate).toHaveBeenCalledOnce();
    f.lease.setActivation(false);
    await gesture(f.el);
    expect(f.activate).toHaveBeenCalledOnce();
    f.lease.dispose();
    f.lease.setActivation(true);
    await gesture(f.el);
    expect(f.activate).toHaveBeenCalledOnce();
  });
  it('forwards one primary pointer sequence and exposes only host-private scope facts', async () => {
    const f = fixture();
    await gesture(f.el);
    expect(f.activate).toHaveBeenCalledOnce();
    expect(f.activate).toHaveBeenCalledWith('pointer');
    expect(f.lease.view()).toEqual({ identity: f.el, scope: document });
  });
  it.each([{ move: true }, { cancel: true }, { ctrlKey: true }])(
    'rejects cancelled/modified/dragged gesture %j',
    async (options) => {
      const f = fixture();
      await gesture(f.el, options);
      expect(f.activate).not.toHaveBeenCalled();
    }
  );
  it.each(['button', 'a', 'input'])(
    'does not turn a nested %s into control activation',
    async (tag) => {
      const f = fixture();
      const inner = document.createElement(tag);
      if (tag === 'a') inner.setAttribute('href', '#section');
      f.el.append(inner);
      await gesture(inner);
      expect(f.activate).not.toHaveBeenCalled();
    }
  );
  it.each([
    '<audio controls></audio>',
    '<video controls></video>',
    '<span role="slider" aria-readonly="true"><b>value</b></span>',
    '<span role="spinbutton" tabindex="-1"><b>value</b></span>',
    '<span role="option"><b>choice</b></span>',
    '<span role="menuitemcheckbox" aria-disabled="true"><b>choice</b></span>',
    '<span role="menuitemradio"><b>choice</b></span>',
    '<span role="searchbox"><b>query</b></span>',
    '<span role="treeitem"><b>entry</b></span>',
    '<span role="scrollbar"><b>thumb</b></span>',
  ])('keeps nested control input owned by its descendant: %s', async (markup) => {
    const f = fixture();
    f.el.innerHTML = markup;
    const child = f.el.firstElementChild as HTMLElement;
    const click = vi.fn((event: Event) => expect(event.defaultPrevented).toBe(false));
    child.addEventListener('click', click);
    await gesture((child.firstElementChild ?? child) as HTMLElement);
    expect(click).toHaveBeenCalledOnce();
    expect(f.activate).not.toHaveBeenCalled();
  });
  it.each([
    '<span><b>ordinary caption</b></span>',
    '<span role="progressbar"><b>progress</b></span>',
    '<span role="meter"><b>value</b></span>',
    '<span role="separator"><b>decoration</b></span>',
    '<span role="tabpanel"><b>description</b></span>',
    '<video></video>',
    '<audio></audio>',
  ])('retains label activation through passive content: %s', async (markup) => {
    const f = fixture();
    f.el.innerHTML = markup;
    const child = f.el.firstElementChild as HTMLElement;
    await gesture((child.firstElementChild ?? child) as HTMLElement);
    expect(f.activate).toHaveBeenCalledOnce();
  });
  it('does not invent keyboard or untrusted click-only activation', async () => {
    const f = fixture();
    f.el.click();
    f.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(f.activate).not.toHaveBeenCalled();
  });
  it('distinguishes trusted accessibility-style click facts from synthetic click-only facts', () => {
    // Pure host-fact classification, not a fabricated trusted DOM event or AT run.
    expect(isTrustedNonPointerLabelActivation({ trusted: true, detail: 0 })).toBe(true);
    expect(isTrustedNonPointerLabelActivation({ trusted: false, detail: 0 })).toBe(false);
    expect(isTrustedNonPointerLabelActivation({ trusted: true, detail: 1 })).toBe(false);
    expect(
      isTrustedNonPointerLabelActivation({
        trusted: true,
        detail: 0,
        pointerId: -1,
        pointerType: '',
      })
    ).toBe(true);
    expect(
      isTrustedNonPointerLabelActivation({
        trusted: true,
        detail: 0,
        pointerId: 1,
        pointerType: 'mouse',
      })
    ).toBe(false);
  });
  it('honors click cancellation already observed at the host listener', async () => {
    const f = fixture();
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('click', prevent, true);
    try {
      await gesture(f.el);
      expect(f.activate).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('click', prevent, true);
    }
  });
  it('does not treat a cancelled pointerup as cancellation of the subsequent click', async () => {
    const f = fixture();
    f.el.addEventListener('pointerup', (event) => event.preventDefault());
    await gesture(f.el);
    expect(f.activate).toHaveBeenCalledOnce();
  });
  it('commits within the originating click turn; a later listener cannot roll back the operation', async () => {
    const f = fixture();
    let synchronous = false;
    f.el.addEventListener('click', (event) => {
      synchronous = f.activate.mock.calls.length === 1;
      event.preventDefault();
    });
    await gesture(f.el);
    expect(synchronous).toBe(true);
    expect(f.activate).toHaveBeenCalledOnce();
  });
  it('retired and detached views cannot send retained gestures', async () => {
    const f = fixture();
    f.lease.dispose();
    await gesture(f.el);
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.lease.view()).toBeNull();
  });
  it('leaves pointerdown defaults and selection alone', () => {
    const f = fixture();
    const event = new PointerEvent('pointerdown', {
      button: 0,
      pointerId: 1,
      bubbles: true,
      cancelable: true,
    });
    expect(f.el.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
  it.each(['open', 'closed'] as const)(
    'observes %s ShadowRoot removal and reinsertion without a document scan',
    async (mode) => {
      const host = document.createElement('div');
      document.body.append(host);
      const root = host.attachShadow({ mode });
      const f = fixture(root);
      f.change.mockClear();
      f.el.remove();
      await mutations();
      expect(f.change).toHaveBeenCalled();
      expect(f.lease.view()).toBeNull();
      f.change.mockClear();
      root.append(f.el);
      await mutations();
      expect(f.change).toHaveBeenCalled();
      expect(f.lease.view()?.scope).toBe(root);
      await gesture(f.el);
      expect(f.activate).toHaveBeenCalledOnce();
    }
  );
  it('shares a scope observer across many labels and ignores unrelated mutations', async () => {
    const observe = vi.spyOn(window.MutationObserver.prototype, 'observe');
    const labels = Array.from({ length: 30 }, () => fixture());
    expect(observe).toHaveBeenCalledTimes(1);
    await mutations();
    for (const f of labels) f.change.mockClear();
    document.body.append(document.createElement('aside'));
    await mutations();
    expect(labels.every((f) => f.change.mock.calls.length === 0)).toBe(true);
    labels[0]!.el.remove();
    await mutations();
    expect(labels[0]!.change).toHaveBeenCalledOnce();
    expect(labels.slice(1).every((f) => f.change.mock.calls.length === 0)).toBe(true);
  });
});
