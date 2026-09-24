import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry } from '@proto.ui/hooks';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { AdaptToWebComponent } from '../src';
import {
  bindLogicalParent,
  createLogicalInstance,
  getLogicalTriggerSurfaceRoot,
  markProtoInstance,
  mergeLogicalTriggerGroup,
  unbindProtoInstance,
} from '../src/platform/instance-tree';
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

  it('resamples non-composed visibility transitions inside a descendant open root', async () => {
    const host = panel(true);
    const carrier = document.createElement('span');
    const root = carrier.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    root.append(button);
    host.append(carrier);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    let hidden = false;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return hidden ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    hidden = true;
    const transition = new TransitionEvent('transitionend', {
      bubbles: true,
      composed: false,
    });
    Object.defineProperty(transition, 'propertyName', { value: 'visibility' });
    button.dispatchEvent(transition);
    expect(host.tabIndex).toBe(0);
  });

  it('resamples external sibling focus-visible eligibility on keyboard modality input', async () => {
    const sibling = document.createElement('button');
    document.body.append(sibling);
    const host = panel(false);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    let keyboardModality = false;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return keyboardModality ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    sibling.focus();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    keyboardModality = true;
    sibling.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true })
    );
    expect(host.tabIndex).toBe(0);
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
    const originalDisplay = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      'display'
    );
    const originalContentVisibility = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      'contentVisibility'
    );
    const originalDocumentSheets = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'adoptedStyleSheets'
    );
    const originalShadowSheets = Object.getOwnPropertyDescriptor(
      ShadowRoot.prototype,
      'adoptedStyleSheets'
    );
    const originalSelectorText = Object.getOwnPropertyDescriptor(
      CSSStyleRule.prototype,
      'selectorText'
    );
    const MediaListCtor = (window as unknown as { MediaList?: typeof MediaList }).MediaList;
    const originalMediaText = MediaListCtor
      ? Object.getOwnPropertyDescriptor(MediaListCtor.prototype, 'mediaText')
      : undefined;
    const originalAppendMedium = MediaListCtor?.prototype.appendMedium;
    const originalDeleteMedium = MediaListCtor?.prototype.deleteMedium;
    const originalSetCustomValidity = HTMLInputElement.prototype.setCustomValidity;
    const originalStepUp = HTMLInputElement.prototype.stepUp;
    const originalStepDown = HTMLInputElement.prototype.stepDown;
    const formSetters = [
      [HTMLInputElement.prototype, 'checked'],
      [HTMLInputElement.prototype, 'indeterminate'],
      [HTMLInputElement.prototype, 'value'],
      [HTMLTextAreaElement.prototype, 'value'],
      [HTMLOptionElement.prototype, 'selected'],
      [HTMLSelectElement.prototype, 'selectedIndex'],
    ] as const;
    const originalFormSetters = formSetters.map(([prototype, key]) =>
      Object.getOwnPropertyDescriptor(prototype, key)
    );
    const host = panel(true);
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).not.toBe(original);
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')?.set).not.toBe(
      originalCssText?.set
    );
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'display')?.set).not.toBe(
      originalDisplay?.set
    );
    expect(
      Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'contentVisibility')?.set
    ).not.toBe(originalContentVisibility?.set);
    if (originalDocumentSheets?.set)
      expect(
        Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')?.set
      ).not.toBe(originalDocumentSheets.set);
    if (originalShadowSheets?.set)
      expect(
        Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')?.set
      ).not.toBe(originalShadowSheets.set);
    if (originalSelectorText?.set)
      expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'selectorText')?.set).not.toBe(
        originalSelectorText.set
      );
    if (originalMediaText?.set && MediaListCtor)
      expect(Object.getOwnPropertyDescriptor(MediaListCtor.prototype, 'mediaText')?.set).not.toBe(
        originalMediaText.set
      );
    if (originalAppendMedium && MediaListCtor)
      expect(MediaListCtor.prototype.appendMedium).not.toBe(originalAppendMedium);
    if (originalDeleteMedium && MediaListCtor)
      expect(MediaListCtor.prototype.deleteMedium).not.toBe(originalDeleteMedium);
    expect(HTMLInputElement.prototype.setCustomValidity).not.toBe(originalSetCustomValidity);
    expect(HTMLInputElement.prototype.stepUp).not.toBe(originalStepUp);
    expect(HTMLInputElement.prototype.stepDown).not.toBe(originalStepDown);
    for (const [index, [prototype, key]] of formSetters.entries()) {
      if (originalFormSetters[index]?.set)
        expect(Object.getOwnPropertyDescriptor(prototype, key)?.set).not.toBe(
          originalFormSetters[index]?.set
        );
    }
    host.remove();
    await settle();
    expect(CSSStyleSheet.prototype.insertRule).toBe(original);
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText')).toEqual(
      originalCssText
    );
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'display')).toEqual(
      originalDisplay
    );
    expect(
      Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'contentVisibility')
    ).toEqual(originalContentVisibility);
    if (originalDocumentSheets?.set)
      expect(Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')).toEqual(
        originalDocumentSheets
      );
    if (originalShadowSheets?.set)
      expect(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')).toEqual(
        originalShadowSheets
      );
    if (originalSelectorText?.set)
      expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'selectorText')).toEqual(
        originalSelectorText
      );
    if (originalMediaText?.set && MediaListCtor)
      expect(Object.getOwnPropertyDescriptor(MediaListCtor.prototype, 'mediaText')).toEqual(
        originalMediaText
      );
    if (originalAppendMedium && MediaListCtor)
      expect(MediaListCtor.prototype.appendMedium).toBe(originalAppendMedium);
    if (originalDeleteMedium && MediaListCtor)
      expect(MediaListCtor.prototype.deleteMedium).toBe(originalDeleteMedium);
    expect(HTMLInputElement.prototype.setCustomValidity).toBe(originalSetCustomValidity);
    expect(HTMLInputElement.prototype.stepUp).toBe(originalStepUp);
    expect(HTMLInputElement.prototype.stepDown).toBe(originalStepDown);
    for (const [index, [prototype, key]] of formSetters.entries())
      expect(Object.getOwnPropertyDescriptor(prototype, key)).toEqual(originalFormSetters[index]);
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

  it('reprojects when setCustomValidity changes selector-driven descendant eligibility', async () => {
    const host = panel(true);
    const input = document.createElement('input');
    host.before(input);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return input.validity.valid ? 'visible' : 'hidden';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    input.setCustomValidity('invalid');
    await settle();
    expect(host.tabIndex).toBe(0);

    input.setCustomValidity('');
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it.each([
    ['stepUp', -1, 0],
    ['stepDown', 11, 10],
  ] as const)(
    'reprojects when input.%s() crosses a range boundary without an event',
    async (method, initial, expected) => {
      const host = panel(true);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '10';
      input.step = '1';
      input.value = String(initial);
      host.before(input);
      const button = document.createElement('button');
      host.append(button);
      const nativeGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
        const computed = nativeGetComputedStyle(element, pseudoElement);
        if (element !== button) return computed;
        return new Proxy(computed, {
          get(target, property) {
            if (property === 'visibility')
              return input.validity.rangeOverflow || input.validity.rangeUnderflow
                ? 'hidden'
                : 'visible';
            return Reflect.get(target, property, target);
          },
        });
      });
      await settle();
      expect(host.tabIndex).toBe(0);

      input[method]();
      await settle();
      expect(input.valueAsNumber).toBe(expected);
      expect(host.hasAttribute('tabindex')).toBe(false);
    }
  );

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

  it('reprojects after a non-whitelisted author attribute changes an external selector', async () => {
    const style = document.createElement('style');
    style.textContent = `.entry-author-state[data-state='closed'] button { visibility: hidden; }`;
    const wrapper = document.createElement('div');
    wrapper.className = 'entry-author-state';
    document.body.append(style, wrapper);
    const host = panel(true);
    wrapper.append(host);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility')
            return wrapper.dataset.state === 'closed' ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);

    wrapper.dataset.state = 'closed';
    await settle();
    expect(host.tabIndex).toBe(0);

    wrapper.dataset.state = 'open';
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('reprojects an externally changed delegated nested trigger surface without looping', async () => {
    const outer = document.createElement('div');
    const inner = document.createElement('button');
    outer.append(inner);
    document.body.append(outer);
    const proto = { name: `entry-observer-delegated-${++serial}`, setup() {} } as never;
    const outerToken = createLogicalInstance(proto);
    const innerToken = createLogicalInstance(proto);
    markProtoInstance(outer, proto, outerToken);
    markProtoInstance(inner, proto, innerToken);
    bindLogicalParent(innerToken, outerToken);
    mergeLogicalTriggerGroup(outerToken, outerToken);
    mergeLogicalTriggerGroup(innerToken, outerToken);
    await settle();
    expect(getLogicalTriggerSurfaceRoot(outerToken)).toBe(inner);

    const modules = createWebComponentModules({
      el: outer,
      instanceToken: outerToken,
      router: { rootTarget: outer, globalTarget: window },
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
    const setEntry = modules.focus!({ prototypeName: 'entry-observer-delegated-test' }).find(
      ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
    )![1] as (
      target: HTMLElement,
      config: { strategy: 'descendant-first'; fallback: 'self' },
      enabled: boolean
    ) => void;
    const config = { strategy: 'descendant-first', fallback: 'self' } as const;
    try {
      setEntry(getLogicalTriggerSurfaceRoot(outerToken)!, config, true);
      expect(inner.tabIndex).toBe(0);

      const setAttribute = vi.spyOn(inner, 'setAttribute');
      inner.setAttribute('tabindex', '-1');
      await settle();
      expect(inner.tabIndex).toBe(0);
      const adapterRestores = setAttribute.mock.calls.filter(
        ([name, value]) => name === 'tabindex' && value === '0'
      );
      expect(adapterRestores).toHaveLength(1);

      await settle();
      expect(adapterRestores).toHaveLength(1);
    } finally {
      setEntry(inner, config, false);
      unbindProtoInstance(innerToken, inner);
      unbindProtoInstance(outerToken, outer);
      outer.remove();
    }
  });

  it('observes external subtrees only while an author relational selector can reach the entry', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const style = document.createElement('style');
    style.textContent =
      '.unrelated:has(.flag) .outside, :where(:is(.unrelated)):has(.flag) .outside { visibility: hidden; }';
    const nestedStyle = document.createElement('style');
    const wrapper = document.createElement('div');
    wrapper.className = 'entry-relational-boundary';
    document.body.append(style, nestedStyle, wrapper);
    Object.defineProperty(nestedStyle.sheet!, 'cssRules', {
      configurable: true,
      value: [
        {
          type: 1,
          selectorText: '&:has(> svg)',
          parentRule: { type: 1, selectorText: '.nested-unrelated' },
        },
      ],
    });
    const host = panel(true);
    wrapper.append(host);
    host.append(document.createElement('button'));
    await settle();

    const observesWrapperSubtree = () =>
      observe.mock.calls.some(
        ([node, options]) => node === wrapper && options?.childList && options?.subtree
      );
    expect(observesWrapperSubtree()).toBe(false);
    expect(
      observe.mock.calls.some(
        ([node, options]) =>
          node === wrapper && options?.attributes && !options?.attributeFilter && !options?.subtree
      )
    ).toBe(true);

    const relevantStyle = document.createElement('style');
    relevantStyle.textContent =
      ':where(body :is(.entry-relational-reachable)):has(.flag) button { visibility: hidden; }';
    const relevantWrapper = document.createElement('div');
    relevantWrapper.className = 'entry-relational-reachable';
    document.body.append(relevantStyle, relevantWrapper);
    const relevantHost = panel(true);
    relevantWrapper.append(relevantHost);
    relevantHost.append(document.createElement('button'));
    await settle();
    expect(
      observe.mock.calls.some(
        ([node, options]) => node === relevantWrapper && options?.childList && options?.subtree
      )
    ).toBe(true);
  });

  it('reprojects for a body-level relational selector without observing unrelated selectors', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const style = document.createElement('style');
    style.textContent =
      'body:has(> .entry-body-flag) .entry-body-relational button { visibility: hidden; }';
    const wrapper = document.createElement('div');
    wrapper.className = 'entry-body-relational';
    document.body.append(style, wrapper);
    const host = panel(true);
    wrapper.append(host);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility')
            return document.body.querySelector('.entry-body-flag') ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(
      observe.mock.calls.some(
        ([node, options]) =>
          node === document.documentElement && options?.childList && options?.subtree
      )
    ).toBe(true);

    const flag = document.createElement('span');
    flag.className = 'entry-body-flag';
    document.body.append(flag);
    await settle();
    expect(host.tabIndex).toBe(0);

    flag.remove();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('reprojects for a wrapped body-level relational selector', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const style = document.createElement('style');
    style.textContent =
      ':where(body):has(> .entry-wrapped-body-flag) .entry-wrapped-body-relational button { visibility: hidden; }';
    const wrapper = document.createElement('div');
    wrapper.className = 'entry-wrapped-body-relational';
    document.body.append(style, wrapper);
    const host = panel(true);
    wrapper.append(host);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility')
            return document.body.querySelector('.entry-wrapped-body-flag') ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(
      observe.mock.calls.some(
        ([node, options]) =>
          node === document.documentElement && options?.childList && options?.subtree
      )
    ).toBe(true);

    const flag = document.createElement('span');
    flag.className = 'entry-wrapped-body-flag';
    document.body.append(flag);
    await settle();
    expect(host.tabIndex).toBe(0);

    flag.remove();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('reprojects for a recursively wrapped body-level relational selector', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const style = document.createElement('style');
    style.textContent =
      ':where(:is(body)):has(> .entry-nested-body-flag) .entry-nested-body-relational button { visibility: hidden; }';
    const wrapper = document.createElement('div');
    wrapper.className = 'entry-nested-body-relational';
    document.body.append(style, wrapper);
    const host = panel(true);
    wrapper.append(host);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility')
            return document.body.querySelector('.entry-nested-body-flag') ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(
      observe.mock.calls.some(
        ([node, options]) =>
          node === document.documentElement && options?.childList && options?.subtree
      )
    ).toBe(true);

    const flag = document.createElement('span');
    flag.className = 'entry-nested-body-flag';
    document.body.append(flag);
    await settle();
    expect(host.tabIndex).toBe(0);

    flag.remove();
    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('reprojects when an external container ancestor alone crosses a query threshold', async () => {
    const originalResizeObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    const observers: ControlledResizeObserver[] = [];
    class ControlledResizeObserver {
      readonly observed = new Set<Element>();
      constructor(private readonly callback: ResizeObserverCallback) {
        observers.push(this);
      }
      observe(target: Element) {
        this.observed.add(target);
      }
      unobserve(target: Element) {
        this.observed.delete(target);
      }
      disconnect() {
        this.observed.clear();
      }
      trigger(target: Element) {
        if (!this.observed.has(target)) return false;
        this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
        return true;
      }
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ControlledResizeObserver,
    });

    const style = document.createElement('style');
    style.textContent = `
      .entry-container-query { container-type: inline-size; }
      @container (width < 20rem) {
        .entry-container-query button { visibility: hidden; }
      }
    `;
    const container = document.createElement('div');
    container.className = 'entry-container-query';
    document.body.append(style, container);
    const host = panel(true);
    container.append(host);
    const button = document.createElement('button');
    host.append(button);
    let belowThreshold = false;
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return belowThreshold ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });

    try {
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);

      belowThreshold = true;
      expect(observers.some((observer) => observer.trigger(container))).toBe(true);
      await settle();
      expect(host.tabIndex).toBe(0);
    } finally {
      if (originalResizeObserver)
        Object.defineProperty(window, 'ResizeObserver', originalResizeObserver);
      else delete (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    }
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

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    root.append(link);
    await settle();
    removeAttribute.mockClear();
    link.dispatchEvent(new Event('load'));
    await settle();
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');

    host.remove();
    await settle();
    removeAttribute.mockClear();
    link.dispatchEvent(new Event('load'));
    await settle();
    expect(removeAttribute).not.toHaveBeenCalled();
  });

  it('reprojects when a style element changes stylesheet eligibility', async () => {
    const style = document.createElement('style');
    style.type = 'text/plain';
    document.head.append(style);
    const host = panel(false);
    const button = document.createElement('button');
    host.append(button);
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return style.type === 'text/css' ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });

    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    style.type = 'text/css';
    await settle();
    expect(host.tabIndex).toBe(0);
  });

  it('reprojects on URL target changes and removes the listener at teardown', async () => {
    const host = panel(false);
    const button = document.createElement('button');
    host.append(button);
    let targetMatched = false;
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return targetMatched ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });

    await settle();
    expect(host.hasAttribute('tabindex')).toBe(false);
    targetMatched = true;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await settle();
    expect(host.tabIndex).toBe(0);

    host.remove();
    await settle();
    const setAttribute = vi.spyOn(host, 'setAttribute');
    targetMatched = false;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await settle();
    expect(setAttribute).not.toHaveBeenCalled();
  });

  it('rebuilds imported media listeners when an external Shadow stylesheet loads', async () => {
    const query = '(prefers-contrast: more)';
    const media = Object.assign(new EventTarget(), {
      media: query,
      matches: false,
      onchange: null,
      addListener() {},
      removeListener() {},
    }) as MediaQueryList;
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((value) =>
      value === query
        ? media
        : (Object.assign(new EventTarget(), {
            media: value,
            matches: false,
            onchange: null,
            addListener() {},
            removeListener() {},
          }) as MediaQueryList)
    );
    const carrier = document.createElement('div');
    const root = carrier.attachShadow({ mode: 'open' });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    root.append(link);
    document.body.append(carrier);
    const host = panel(true);
    root.append(host);
    const button = document.createElement('button');
    host.append(button);
    let hidden = false;
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const computed = nativeGetComputedStyle(element, pseudoElement);
      if (element !== button) return computed;
      return new Proxy(computed, {
        get(target, property) {
          if (property === 'visibility') return hidden ? 'hidden' : 'visible';
          return Reflect.get(target, property, target);
        },
      });
    });
    await settle();
    expect(matchMedia).not.toHaveBeenCalledWith(query);

    Object.defineProperty(root, 'styleSheets', {
      configurable: true,
      value: [
        {
          media: { mediaText: '' },
          cssRules: [
            {
              type: 3,
              media: { mediaText: query },
              styleSheet: { media: { mediaText: '' }, cssRules: [] },
            },
          ],
        },
      ],
    });
    link.dispatchEvent(new Event('load'));
    await settle();
    expect(matchMedia).toHaveBeenCalledWith(query);

    hidden = true;
    media.dispatchEvent(new Event('change'));
    await settle();
    expect(host.tabIndex).toBe(0);
  });

  it('reprojects on accessible imported stylesheet media changes without looping on cycles', async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const importedMedia = new EventTarget() as MediaQueryList;
    Object.defineProperties(importedMedia, {
      media: { value: '(width >= 40rem)' },
      matches: { value: false },
      onchange: { value: null, writable: true },
    });
    const matchMedia = vi.fn((query: string) => {
      if (query === importedMedia.media) return importedMedia;
      return Object.assign(new EventTarget(), {
        media: query,
        matches: false,
        onchange: null,
      }) as MediaQueryList;
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });

    const importedSheet = { cssRules: [] as unknown as CSSRuleList };
    const cyclicImport = {
      type: 3,
      media: { mediaText: '(orientation: landscape)' },
      styleSheet: importedSheet,
    } as unknown as CSSImportRule;
    const opaqueImport = {
      type: 3,
      media: { mediaText: '(prefers-contrast: more)' },
      styleSheet: {
        media: { mediaText: '' },
        get cssRules(): CSSRuleList {
          throw new DOMException('opaque', 'SecurityError');
        },
      },
    } as unknown as CSSImportRule;
    importedSheet.cssRules = [
      { type: 4, media: { mediaText: '(prefers-reduced-motion: reduce)' }, cssRules: [] },
      cyclicImport,
    ] as unknown as CSSRuleList;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [
        {
          media: { mediaText: '' },
          cssRules: [
            {
              type: 3,
              media: { mediaText: importedMedia.media },
              styleSheet: importedSheet,
            },
            opaqueImport,
          ],
        } as unknown as CSSStyleSheet,
      ] as unknown as StyleSheetList,
    });

    let host: HTMLElement | null = null;
    try {
      host = panel(false);
      host.append(document.createElement('button'));
      await settle();
      expect(host.hasAttribute('tabindex')).toBe(false);
      expect(matchMedia).toHaveBeenCalledWith(importedMedia.media);
      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(matchMedia).toHaveBeenCalledWith('(orientation: landscape)');
      expect(matchMedia).toHaveBeenCalledWith('(prefers-contrast: more)');

      const removeAttribute = vi.spyOn(host, 'removeAttribute');
      importedMedia.dispatchEvent(new Event('change'));
      await settle();
      expect(removeAttribute).toHaveBeenCalledWith('tabindex');
    } finally {
      host?.remove();
      if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
      else delete (document as unknown as Record<string, unknown>).styleSheets;
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      else delete (window as unknown as Record<string, unknown>).matchMedia;
      await settle();
    }
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
