import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../src';

// Happy DOM delivers MutationObserver through its task manager, not solely
// Promise microtasks. Await completion instead of a platform-dependent delay.
const settle = async () => {
  await Promise.resolve();
  await (
    window as unknown as {
      happyDOM: { waitUntilComplete(): Promise<void> };
    }
  ).happyDOM.waitUntilComplete();
};
let serial = 0;
function panel(composed: boolean) {
  const C = AdaptToWebComponent(
    definePrototype({
      name: `entry-observer-${++serial}`,
      setup() {
        asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
        return (r) => r.slot();
      },
    }),
    { shadow: composed }
  );
  const host = new C();
  document.body.append(host);
  return host;
}
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});

describe('WC live focus-entry resolver inputs', () => {
  it('resamples when an observed descendant upgrades and attaches an open root', async () => {
    // attachShadow() produces no light-tree MutationObserver record; the
    // bounded upgrade watch must revoke the host fallback once a late-open
    // root exposes a tabbable descendant.
    const name = `entry-late-shadow-${++serial}`;
    const host = panel(true);
    const late = document.createElement(name);
    host.append(late);
    await settle();
    expect(host.tabIndex).toBe(0);

    class LateShadow extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          const root = this.attachShadow({ mode: 'open' });
          const button = document.createElement('button');
          button.tabIndex = 0;
          root.append(button);
        }
      }
    }
    customElements.define(name, LateShadow);
    await settle();
    await customElements.whenDefined(name);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    // happy-dom upgrades replace the element instance; re-query before removal.
    host.querySelector(name)!.remove();
    await settle();
    expect(host.tabIndex).toBe(0);
  });

  it('resamples when an already-upgraded descendant attaches a late open root', async () => {
    // attachShadow() from a later method call produces neither a light-tree
    // mutation nor an upgrade signal; the bounded late-attach watch must still
    // revoke the host fallback once the new root exposes a tabbable control.
    const name = `entry-late-method-shadow-${++serial}`;
    class LateMethodShadow extends HTMLElement {
      attachLater() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        button.tabIndex = 0;
        root.append(button);
      }
    }
    customElements.define(name, LateMethodShadow);
    const host = panel(true);
    const late = document.createElement(name) as LateMethodShadow;
    host.append(late);
    await settle();
    expect(host.tabIndex).toBe(0);

    late.attachLater();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('resamples when a second-generation late root lands inside an observed late root', async () => {
    // The late-attach watch is installed once; it must consult the currently
    // observed region, not the first scan. A first late root containing an
    // already-upgraded rootless element is observed on resample, and a second
    // open root attached inside it must still revoke the host fallback.
    const nameOuter = `entry-late-outer-${++serial}`;
    const nameInner = `entry-late-inner-${++serial}`;
    class Inner extends HTMLElement {
      attachLater() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        button.tabIndex = 0;
        root.append(button);
      }
    }
    customElements.define(nameInner, Inner);
    class Outer extends HTMLElement {
      attachLater() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: 'open' });
        root.append(document.createElement(nameInner));
      }
    }
    customElements.define(nameOuter, Outer);
    const host = panel(true);
    const outer = document.createElement(nameOuter) as Outer;
    host.append(outer);
    await settle();
    expect(host.tabIndex).toBe(0);

    outer.attachLater();
    await settle();
    // The inner element is still rootless and exposes no tabbable control.
    expect(host.tabIndex).toBe(0);

    const inner = outer.shadowRoot!.querySelector(nameInner) as Inner;
    inner.attachLater();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('never clobbers a third-party attachShadow patch installed after ours', async () => {
    // The window-level watch is reference-counted; teardown must restore the
    // intrinsic only when our wrapper is still top-most. A later page/library
    // patch stays installed and functional after Proto observers go away.
    const original = Element.prototype.attachShadow;
    const host = panel(true);
    await settle();
    const protoWrapper = Element.prototype.attachShadow;
    expect(protoWrapper).not.toBe(original);

    let thirdPartyCalls = 0;
    const thirdParty = function (this: Element, init: ShadowRootInit): ShadowRoot {
      thirdPartyCalls += 1;
      return protoWrapper.call(this, init);
    };
    Element.prototype.attachShadow = thirdParty as typeof original;
    try {
      host.remove();
      await settle();
      expect(Element.prototype.attachShadow).toBe(thirdParty);

      const probe = document.createElement('div');
      const root = probe.attachShadow({ mode: 'open' });
      expect(root.mode).toBe('open');
      expect(thirdPartyCalls).toBe(1);
    } finally {
      if (Element.prototype.attachShadow === thirdParty) {
        Element.prototype.attachShadow = original;
      }
    }
  });

  it('restores the intrinsic when our wrapper is still top-most at teardown', async () => {
    const original = Element.prototype.attachShadow;
    const host = panel(true);
    await settle();
    expect(Element.prototype.attachShadow).not.toBe(original);
    host.remove();
    await settle();
    expect(Element.prototype.attachShadow).toBe(original);
  });

  it('restores stylesheet invalidation methods when its last entry observer tears down', async () => {
    const original = CSSStyleSheet.prototype.insertRule;
    const host = panel(true);
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).not.toBe(original);
    host.remove();
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).toBe(original);
  });

  it('never clobbers a third-party stylesheet patch installed after ours', async () => {
    const original = CSSStyleSheet.prototype.insertRule;
    const host = panel(true);
    await settle();
    const protoWrapper = CSSStyleSheet.prototype.insertRule;
    expect(protoWrapper).not.toBe(original);
    const thirdParty = function (this: CSSStyleSheet, rule: string, index?: number) {
      return protoWrapper.call(this, rule, index);
    };
    CSSStyleSheet.prototype.insertRule = thirdParty;
    try {
      host.remove();
      await settle();
      expect(CSSStyleSheet.prototype.insertRule).toBe(thirdParty);
    } finally {
      if (CSSStyleSheet.prototype.insertRule === thirdParty) {
        CSSStyleSheet.prototype.insertRule = original;
      }
    }
  });

  it.each([
    [false, true],
    [true, true],
    [false, false],
    [true, false],
  ])('reprojects input type (composed: %s, initially hidden: %s)', async (composed, hidden) => {
    const host = panel(composed);
    const input = document.createElement('input');
    input.type = hidden ? 'hidden' : 'text';
    host.append(input);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(hidden);
    input.type = hidden ? 'text' : 'hidden';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(!hidden);
    input.type = hidden ? 'hidden' : 'text';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(hidden);
  });

  it.each([false, true])(
    'reprojects details without a focusable summary (initially open: %s)',
    async (open) => {
      const host = panel(true);
      const details = document.createElement('details');
      details.open = open;
      const input = document.createElement('input');
      details.append(input);
      host.append(details);
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(!open);
      details.open = !open;
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(open);
      details.open = open;
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(!open);
    }
  );

  it.each([false, true])(
    'tracks image-map associations outside the region (composed: %s)',
    async (composed) => {
      const host = panel(composed);
      const map = document.createElement('map');
      map.name = 'entry-map';
      const area = document.createElement('area');
      area.href = '#destination';
      area.tabIndex = 0;
      map.append(area);
      host.append(map);
      const image = document.createElement('img');
      image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      document.body.append(image);
      await settle();
      expect(host.tabIndex).toBe(0);
      image.useMap = '#entry-map';
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);
      image.useMap = '#another-map';
      await settle();
      expect(host.tabIndex).toBe(0);
      image.useMap = '#entry-map';
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);
      if (composed) {
        image.removeAttribute('src');
        await settle();
        expect(host.tabIndex).toBe(0);
        image.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        await settle();
        expect(host.hasAttribute('tabindex')).toBe(false);
      }
      image.remove();
      await settle();
      expect(host.tabIndex).toBe(0);
      document.body.append(image);
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);
      map.name = 'renamed';
      await settle();
      expect(host.tabIndex).toBe(0);
      map.name = 'entry-map';
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);
      if (!composed) {
        image.hidden = true;
        await settle();
        expect(host.tabIndex).toBe(0);
        image.hidden = false;
        await settle();
        expect(host.hasAttribute('tabindex')).toBe(false);
      }
      host.remove();
      await settle();
      const project = vi.spyOn(host, 'setAttribute');
      image.useMap = '#removed-owner';
      await settle();
      expect(project).not.toHaveBeenCalled();
    }
  );

  it('reprojects external image-map eligibility after image and ancestor CSS changes', async () => {
    const host = panel(true);
    const map = document.createElement('map');
    map.name = 'css-entry-map';
    const area = document.createElement('area');
    area.href = '#destination';
    area.tabIndex = 0;
    map.append(area);
    host.append(map);

    const style = document.createElement('style');
    style.textContent = `
      .entry-map-image-hidden { display: none; }
      .entry-map-ancestor-hidden { visibility: hidden; }
      .entry-map-ancestor-skipped { content-visibility: hidden; }
    `;
    const wrapper = document.createElement('div');
    const image = document.createElement('img');
    image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    image.useMap = '#css-entry-map';
    wrapper.append(image);
    document.body.append(style, wrapper);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    image.classList.add('entry-map-image-hidden');
    await settle();
    expect(host.tabIndex).toBe(0);
    image.classList.remove('entry-map-image-hidden');
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.classList.add('entry-map-ancestor-hidden');
    await settle();
    expect(host.tabIndex).toBe(0);
    wrapper.classList.remove('entry-map-ancestor-hidden');
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.classList.add('entry-map-ancestor-skipped');
    await settle();
    expect(host.tabIndex).toBe(0);
    wrapper.classList.remove('entry-map-ancestor-skipped');
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    image.style.display = 'none';
    await settle();
    expect(host.tabIndex).toBe(0);
    image.style.display = '';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.style.visibility = 'hidden';
    await settle();
    expect(host.tabIndex).toBe(0);
    wrapper.style.visibility = '';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('only observes document image bindings while the region contains areas', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const host = panel(false);
    await settle();
    expect(observe.mock.calls.some(([target]) => target === document)).toBe(false);
    const area = document.createElement('area');
    host.append(area);
    await settle();
    expect(observe.mock.calls.some(([target]) => target === document)).toBe(true);
    area.remove();
    await settle();
    const project = vi.spyOn(host, 'setAttribute');
    document.body.append(document.createElement('img'));
    await settle();
    expect(project).not.toHaveBeenCalled();
  });
});
