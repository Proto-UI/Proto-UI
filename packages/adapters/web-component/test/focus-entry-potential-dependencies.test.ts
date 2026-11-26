import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';
import { createWebComponentPortalMount } from '../src/portal-mount';

const disposals: Array<() => void> = [];
let serial = 0;
const settle = async () => {
  await Promise.resolve();
  await (
    window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
  ).happyDOM.waitUntilComplete();
};

afterEach(async () => {
  for (const dispose of disposals.splice(0)) dispose();
  document.body.replaceChildren();
  document.adoptedStyleSheets = [];
  await settle();
  vi.restoreAllMocks();
});

function entry(populate: (target: HTMLElement) => void = () => {}) {
  const target = document.createElement('div');
  target.className = 'potential-dependencies';
  populate(target);
  document.body.append(target);
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
  const set = modules.focus!({ prototypeName: 'potential-dependencies' }).find(
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
  return { target, configure };
}

function stylesheet(css: string) {
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [sheet];
  return sheet;
}

function countRules(sheet: CSSStyleSheet) {
  const rules = sheet.cssRules;
  const reads = vi.fn(() => rules);
  Object.defineProperty(sheet, 'cssRules', { configurable: true, get: reads });
  return { rules, reads };
}

function modelVisibility(candidate: () => Element | null, visible: () => boolean) {
  const original = window.getComputedStyle.bind(window);
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
    const computed = original(element, pseudoElement);
    if (element !== candidate()) return computed;
    // Happy DOM lacks a live media/input cascade. Only model that final CSS
    // fact; registration, DOM notifications and entry projection stay real.
    return new Proxy(computed, {
      get(target, key) {
        if (key === 'visibility') return visible() ? 'visible' : 'hidden';
        return Reflect.get(target, key, target);
      },
    });
  });
}

function mediaVisibility(candidate: () => Element | null) {
  const query = '(min-width: 987px)';
  let visible = true;
  const media = Object.assign(new EventTarget(), {
    media: query,
    matches: true,
    onchange: null,
    addListener() {},
    removeListener() {},
  });
  const original = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((value) =>
    value === query ? media : original(value)
  );
  stylesheet(`@media ${query} { .potential-dependencies button { visibility: visible; } }`);
  const reads = modelVisibility(candidate, () => visible);
  return {
    reads,
    change(next: boolean) {
      visible = next;
      media.matches = next;
      media.dispatchEvent(new Event('change'));
    },
  };
}

function nativeInput(target: Element) {
  const event = new Event('input', { bubbles: true, composed: true });
  // Select the trusted-event branch in the host model. Original native tests
  // separately retain actual browser input and unchanged time budgets.
  Object.defineProperty(event, 'isTrusted', { get: () => true });
  target.dispatchEvent(event);
}

describe('WC entry stylesheet discovery after descendant potential', () => {
  it('defers CSSOM discovery for decorative-only entries across DOM and stylesheet changes', async () => {
    const sheet = stylesheet('.potential-dependencies { color: black; }');
    const { rules, reads } = countRules(sheet);
    const { target } = entry((target) => {
      target.innerHTML = '<span>Text</span><svg><path></path></svg>';
    });
    await settle();
    expect(target.tabIndex).toBe(0);
    expect(reads).not.toHaveBeenCalled();
    target.classList.add('consumer-change');
    target.append(document.createElement('span'));
    (rules[0] as CSSStyleRule).style.setProperty('color', 'red');
    await settle();
    expect(target.tabIndex).toBe(0);
    expect(reads).not.toHaveBeenCalled();
  });

  it('restores live media dependencies when a native candidate is appended and reappears', async () => {
    let button: HTMLButtonElement | null = null;
    const media = mediaVisibility(() => button);
    const { target } = entry();
    await settle();
    expect(target.tabIndex).toBe(0);
    button = document.createElement('button');
    target.append(button);
    await settle();
    expect(target.hasAttribute('tabindex')).toBe(false);
    media.change(false);
    expect(target.tabIndex).toBe(0);
    media.change(true);
    expect(target.hasAttribute('tabindex')).toBe(false);
    button.remove();
    await settle();
    expect(target.tabIndex).toBe(0);
    media.change(false);
    target.append(button);
    await settle();
    expect(target.tabIndex).toBe(0);
    media.change(true);
    expect(target.hasAttribute('tabindex')).toBe(false);
  });

  it.each(['tabindex', 'href'] as const)(
    'restores the external input-state graph after a %s mutation creates a candidate',
    async (attribute) => {
      stylesheet('body:has(input:checked) .potential-dependencies > * { visibility: hidden; }');
      const outside = document.createElement('input');
      outside.type = 'checkbox';
      document.body.append(outside);
      const leaf = document.createElement(attribute === 'href' ? 'a' : 'span');
      let visible = true;
      modelVisibility(
        () => leaf,
        () => visible
      );
      const { target } = entry((target) => target.append(leaf));
      await settle();
      expect(target.tabIndex).toBe(0);
      leaf.setAttribute(attribute, attribute === 'href' ? '#destination' : '0');
      await settle();
      expect(target.hasAttribute('tabindex')).toBe(false);
      visible = false;
      nativeInput(outside);
      expect(target.tabIndex).toBe(0);
      visible = true;
      nativeInput(outside);
      expect(target.hasAttribute('tabindex')).toBe(false);
      leaf.removeAttribute(attribute);
      await settle();
      expect(target.tabIndex).toBe(0);
    }
  );

  it('restores the current CSS graph after an unresolved descendant upgrades with an open root', async () => {
    let button: HTMLButtonElement | null = null;
    const media = mediaVisibility(() => button);
    const name = `potential-upgrade-${++serial}`;
    const { target } = entry((target) => target.append(document.createElement(name)));
    await settle();
    expect(target.tabIndex).toBe(0);
    customElements.define(
      name,
      class extends HTMLElement {
        constructor() {
          super();
          button = document.createElement('button');
          this.attachShadow({ mode: 'open' }).append(button);
        }
      }
    );
    await settle();
    expect(target.hasAttribute('tabindex')).toBe(false);
    media.change(false);
    expect(target.tabIndex).toBe(0);
    media.change(true);
    expect(target.hasAttribute('tabindex')).toBe(false);
  });

  it('restores the current CSS graph after an already-defined descendant attaches a late open root', async () => {
    let button: HTMLButtonElement | null = null;
    const media = mediaVisibility(() => button);
    const name = `potential-late-root-${++serial}`;
    class LateRoot extends HTMLElement {
      attachLater() {
        button = document.createElement('button');
        this.attachShadow({ mode: 'open' }).append(button);
      }
    }
    customElements.define(name, LateRoot);
    const descendant = document.createElement(name) as LateRoot;
    const { target } = entry((target) => target.append(descendant));
    await settle();
    expect(target.tabIndex).toBe(0);
    descendant.attachLater();
    await settle();
    expect(target.hasAttribute('tabindex')).toBe(false);
    media.change(false);
    expect(target.tabIndex).toBe(0);
    media.change(true);
    expect(target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps stylesheet discovery for actual slots before and after native assignment', async () => {
    const sheet = stylesheet('.potential-dependencies button { visibility: visible; }');
    const { reads } = countRules(sheet);
    let slot: HTMLSlotElement | undefined;
    const { target } = entry((target) => {
      slot = document.createElement('slot');
      target.attachShadow({ mode: 'open' }).append(slot);
    });
    await settle();
    expect(target.tabIndex).toBe(0);
    expect(reads).toHaveBeenCalled();
    const button = document.createElement('button');
    target.append(button);
    await settle();
    expect(slot!.assignedNodes()).toEqual([button]);
    expect(target.hasAttribute('tabindex')).toBe(false);
    button.style.visibility = 'hidden';
    await settle();
    expect(target.tabIndex).toBe(0);
  });

  it.each(['area', 'named radio'] as const)(
    'keeps external dependency discovery for a currently unavailable %s',
    async (kind) => {
      const sheet = stylesheet('.potential-dependencies { color: black; }');
      const { reads } = countRules(sheet);
      const { target } = entry((target) => {
        if (kind === 'area') target.append(document.createElement('area'));
        else {
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'potential-radio';
          radio.setAttribute('tabindex', '-1');
          target.append(radio);
        }
      });
      await settle();
      expect(target.tabIndex).toBe(0);
      expect(reads).toHaveBeenCalled();
    }
  );

  it('restores media dependencies when a candidate appears inside an owned portal', async () => {
    let button: HTMLButtonElement | null = null;
    const media = mediaVisibility(() => button);
    const projection = document.createElement('div');
    const { target } = entry((target) => target.append(projection));
    const portal = createWebComponentPortalMount();
    portal.mount(projection);
    disposals.push(() => portal.unmount(projection));
    await settle();
    expect(target.tabIndex).toBe(0);
    button = document.createElement('button');
    projection.append(button);
    await settle();
    expect(target.hasAttribute('tabindex')).toBe(false);
    media.change(false);
    expect(target.tabIndex).toBe(0);
    media.change(true);
    expect(target.hasAttribute('tabindex')).toBe(false);
  });

  it('cannot revive a disposed empty entry when later DOM and CSS changes add a candidate', async () => {
    let button: HTMLButtonElement | null = null;
    const media = mediaVisibility(() => button);
    const { target, configure } = entry();
    await settle();
    expect(target.tabIndex).toBe(0);
    configure(false);
    button = document.createElement('button');
    target.append(button);
    media.change(false);
    await settle();
    expect(target.hasAttribute('tabindex')).toBe(false);
    media.reads.mockClear();
    media.change(true);
    expect(media.reads).not.toHaveBeenCalled();
  });
});
