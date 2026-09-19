import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry } from '@proto.ui/hooks';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { AdaptToWebComponent } from '../src';
import { createWebComponentModules } from '../src/runtime/modules';

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
  it('uses current rendered eligibility for a Light DOM descendant entry', async () => {
    const host = panel(false);
    const button = document.createElement('button');
    host.append(button);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    button.style.visibility = 'hidden';
    await settle();
    expect(host.tabIndex).toBe(0);

    button.style.visibility = '';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

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

  it('registers one pending upgrade continuation per unresolved tag name', async () => {
    const unresolved = `entry-pending-${++serial}`;
    const original = customElements.whenDefined.bind(customElements);
    const whenDefined = vi
      .spyOn(customElements, 'whenDefined')
      .mockImplementation((name) => original(name));
    const host = panel(true);
    const late = document.createElement(unresolved);
    host.append(late);
    await settle();

    late.className = 'one';
    await settle();
    late.className = 'two';
    await settle();

    expect(whenDefined.mock.calls.filter(([name]) => name === unresolved)).toHaveLength(1);
  });

  it('keeps a replacement entry observer after a superseded upgrade continuation resolves', async () => {
    const unresolved = `entry-superseded-${++serial}`;
    const original = customElements.whenDefined.bind(customElements);
    let resolveUpgrade!: (ctor: CustomElementConstructor) => void;
    vi.spyOn(customElements, 'whenDefined').mockImplementation((name) =>
      name === unresolved
        ? new Promise<CustomElementConstructor>((resolve) => {
            resolveUpgrade = resolve;
          })
        : original(name)
    );
    const owner = document.createElement('div');
    const modules = createWebComponentModules({
      el: owner,
      instanceToken: {} as never,
      router: { rootTarget: owner, globalTarget: window },
      rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
      effectsPort: {} as never,
      textControlTarget: null,
      imageViewTarget: null,
      getMeta: () => undefined,
      setExposes() {},
      runInCallbackScope: (fn) => fn(),
      isViewReady: () => true,
      subscribeTargetReady: () => () => {},
      retryTargetReady() {},
    });
    const setEntry = modules.focus!({ prototypeName: 'entry-observer-generation-test' }).find(
      ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
    )![1] as (
      target: HTMLElement,
      config: { strategy: 'descendant-first'; fallback: 'self' },
      enabled: boolean
    ) => void;
    const config = { strategy: 'descendant-first', fallback: 'self' } as const;
    const targetA = document.createElement('div');
    targetA.append(document.createElement(unresolved));
    const targetB = document.createElement('div');
    document.body.append(targetA, targetB);
    try {
      setEntry(targetA, config, true);
      expect(targetA.tabIndex).toBe(0);

      setEntry(targetB, config, true);
      expect(targetB.tabIndex).toBe(0);
      resolveUpgrade(class extends HTMLElement {});
      await settle();

      targetB.append(document.createElement('button'));
      await settle();
      expect(targetB.hasAttribute('tabindex')).toBe(false);
    } finally {
      setEntry(targetB, config, false);
      targetA.remove();
      targetB.remove();
    }
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
    const originalCssText = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      'cssText'
    );
    const originalDocumentSheets = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'adoptedStyleSheets'
    );
    const originalShadowSheets = Object.getOwnPropertyDescriptor(
      ShadowRoot.prototype,
      'adoptedStyleSheets'
    );
    const host = panel(true);
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).not.toBe(original);
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')?.set).not.toBe(
      originalCssText?.set
    );
    if (originalDocumentSheets?.set)
      expect(
        Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')?.set
      ).not.toBe(originalDocumentSheets.set);
    if (originalShadowSheets?.set)
      expect(
        Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')?.set
      ).not.toBe(originalShadowSheets.set);
    host.remove();
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).toBe(original);
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')).toEqual(
      originalCssText
    );
    if (originalDocumentSheets?.set)
      expect(Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')).toEqual(
        originalDocumentSheets
      );
    if (originalShadowSheets?.set)
      expect(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')).toEqual(
        originalShadowSheets
      );
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

  it('never clobbers a third-party cssText setter installed after ours', async () => {
    const original = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')!;
    const host = panel(true);
    await settle();
    const protoDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      'cssText'
    )!;
    expect(protoDescriptor.set).not.toBe(original.set);
    const thirdParty = function (this: CSSStyleDeclaration, value: string) {
      protoDescriptor.set!.call(this, value);
    };
    Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
      ...protoDescriptor,
      set: thirdParty,
    });
    try {
      host.remove();
      await settle();
      expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')?.set).toBe(
        thirdParty
      );
    } finally {
      if (
        Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')?.set ===
        thirdParty
      ) {
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', original);
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

  it('reprojects when an external details ancestor opens and closes', async () => {
    const details = document.createElement('details');
    details.open = true;
    document.body.append(details);
    const host = panel(true);
    const input = document.createElement('input');
    host.append(input);
    details.append(host);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    details.open = false;
    await settle();
    expect(host.tabIndex).toBe(0);

    details.open = true;
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('reprojects when an external fieldset ancestor changes disabledness', async () => {
    const fieldset = document.createElement('fieldset');
    document.body.append(fieldset);
    const host = panel(true);
    const input = document.createElement('input');
    host.append(input);
    fieldset.append(host);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    const removeAttribute = vi.spyOn(host, 'removeAttribute');

    fieldset.disabled = true;
    await settle();
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');

    removeAttribute.mockClear();
    fieldset.disabled = false;
    await settle();
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');
  });

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

  it('reprojects external image-map eligibility when its details ancestor opens', async () => {
    const host = panel(true);
    const map = document.createElement('map');
    map.name = 'details-entry-map';
    const area = document.createElement('area');
    area.href = '#destination';
    area.tabIndex = 0;
    map.append(area);
    host.append(map);

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const image = document.createElement('img');
    image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    image.useMap = '#details-entry-map';
    details.append(summary, image);
    document.body.append(details);
    await settle();
    expect(host.tabIndex).toBe(0);

    details.open = true;
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    details.open = false;
    await settle();
    expect(host.tabIndex).toBe(0);
  });

  it('reprojects after selector state changes on composed ancestors outside the entry region', async () => {
    const style = document.createElement('style');
    style.textContent = '.entry-outer-hidden { visibility: hidden; }';
    const wrapper = document.createElement('div');
    document.body.append(style, wrapper);
    const host = panel(true);
    wrapper.append(host);
    const button = document.createElement('button');
    host.append(button);
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.classList.add('entry-outer-hidden');
    await settle();
    expect(host.tabIndex).toBe(0);
    wrapper.classList.remove('entry-outer-hidden');
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.style.visibility = 'hidden';
    await settle();
    expect(host.tabIndex).toBe(0);
    wrapper.style.visibility = '';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('observes stylesheet DOM changes in an external composed ShadowRoot', async () => {
    const carrier = document.createElement('div');
    const root = carrier.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    root.append(style);
    document.body.append(carrier);
    const host = panel(true);
    root.append(host);
    host.append(document.createElement('button'));
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    const removeAttribute = vi.spyOn(host, 'removeAttribute');
    style.textContent = '::slotted(*) { visibility: visible; }';
    await settle();
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');

    removeAttribute.mockClear();
    const replacement = document.createElement('style');
    replacement.textContent = '::slotted(*) { visibility: inherit; }';
    style.replaceWith(replacement);
    await settle();
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');
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
