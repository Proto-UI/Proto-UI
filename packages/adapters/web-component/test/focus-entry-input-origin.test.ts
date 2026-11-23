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
  const set = modules.focus!({ prototypeName: 'entry-input-origin' }).find(
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

function inputEvent(target: Element, type: 'input' | 'change', trusted = true) {
  const event = new Event(type, { bubbles: true, composed: true });
  // Happy DOM cannot create native user input. Select the trusted-event branch
  // explicitly; these are host-model controls, not browser timing evidence.
  if (trusted) Object.defineProperty(event, 'isTrusted', { get: () => true });
  target.dispatchEvent(event);
}

function visibleWhen(button: HTMLElement, visible: () => boolean) {
  const original = window.getComputedStyle.bind(window);
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
    const computed = original(element, pseudoElement);
    if (element !== button) return computed;
    // Happy DOM does not implement the complete native form-state cascade.
    // Model only its visibility result; entry traversal and projection are real.
    return new Proxy(computed, {
      get(target, property) {
        if (property === 'visibility') return visible() ? 'visible' : 'hidden';
        return Reflect.get(target, property, target);
      },
    });
  });
}

describe('WC entry native input origin', () => {
  it.each(['input', 'change'] as const)(
    'does not sample unrelated entries for a native editor %s',
    async (type) => {
      const entries = Array.from({ length: 8 }, () => entry());
      const editor = document.createElement('textarea');
      document.body.append(editor);
      await settle();
      const reads = vi.spyOn(window, 'getComputedStyle');

      inputEvent(editor, type);

      expect(
        entries.map(({ target }) => reads.mock.calls.filter(([node]) => node === target).length)
      ).toEqual(Array(entries.length).fill(0));
    }
  );

  it('keeps unrelated editor input local with attribute, structural and focus styling', async () => {
    const style = document.createElement('style');
    style.textContent = `
      :where(.entry-local):has(> button) button:not([disabled]):focus-visible { outline: 2px solid; }
      .entry-local:nth-child(2) > button::before { content: attr(data-hint); }
      [data-hint=":invalid"] { --entry-label: ':checked'; }
    `;
    document.body.append(style);
    const fixture = entry();
    fixture.ancestor.className = 'entry-local';
    const outside = document.createElement('textarea');
    document.body.append(outside);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    inputEvent(outside, 'input');

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(false);
  });

  it.each(['input', 'change'] as const)(
    'keeps related descendant %s and current eligibility',
    async (type) => {
      const fixture = entry();
      const input = document.createElement('input');
      input.setAttribute('tabindex', '-1');
      const button = document.createElement('button');
      fixture.target.append(input, button);
      visibleWhen(button, () => input.value === 'ready');
      await settle();
      expect(fixture.target.tabIndex).toBe(0);

      input.value = 'ready';
      inputEvent(input, type);
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);

      input.value = '';
      inputEvent(input, type);
      expect(fixture.target.tabIndex).toBe(0);
    }
  );

  it('keeps a newly projected nested Portal before observation refresh', () => {
    const fixture = entry();
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const input = document.createElement('input');
    inner.append(input);
    outer.append(inner);
    fixture.target.append(outer);
    const outerPortal = createWebComponentPortalMount();
    const innerPortal = createWebComponentPortalMount();
    outerPortal.mount(outer);
    innerPortal.mount(inner);
    disposals.push(
      () => innerPortal.unmount(inner),
      () => outerPortal.unmount(outer)
    );
    expect(fixture.target.contains(input)).toBe(false);
    expect(fixture.target.tabIndex).toBe(0);

    inputEvent(input, 'input');

    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps input from the live composed ancestor of a slotted entry', async () => {
    const fixture = entry();
    const carrier = document.createElement('div');
    const root = carrier.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
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

    inputEvent(wrapper, 'input');

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(true);
  });

  it.each([
    'body:has(.entry-peer:checked) .entry-subject button',
    '.entry-peer:checked + .entry-subject button',
    '.entry-peer:checked + .entry-subject:nth-child(2 of :has(button)) button',
    'body:has(.entry-peer:future-input-state) .entry-subject button',
  ])('keeps an external input-state dependency: %s', async (selector) => {
    const style = document.createElement('style');
    style.textContent = `${selector} { visibility: hidden; }`;
    const peer = document.createElement('input');
    peer.type = 'checkbox';
    peer.className = 'entry-peer';
    document.body.append(style, peer);
    const fixture = entry();
    fixture.ancestor.className = 'entry-subject';
    const button = document.createElement('button');
    fixture.target.append(button);
    visibleWhen(button, () => !peer.checked);
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);

    peer.checked = true;
    inputEvent(peer, 'change');
    expect(fixture.target.tabIndex).toBe(0);

    peer.checked = false;
    inputEvent(peer, 'input');
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps aggregate form validity from a control outside the form tree', async () => {
    const style = document.createElement('style');
    style.textContent = 'form:invalid .entry-form-subject button { visibility: hidden; }';
    const form = document.createElement('form');
    form.id = 'entry-input-origin-form';
    const input = document.createElement('input');
    input.required = true;
    input.setAttribute('form', form.id);
    document.body.append(style, form, input);
    const fixture = entry();
    fixture.ancestor.className = 'entry-form-subject';
    form.append(fixture.ancestor);
    const button = document.createElement('button');
    fixture.target.append(button);
    visibleWhen(button, () => input.validity.valid);
    await settle();
    expect(fixture.target.tabIndex).toBe(0);

    input.value = 'valid';
    inputEvent(input, 'input');

    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it.each(['input', 'textarea'] as const)(
    'keeps native value-dependent :dir on an external %s with dir=auto',
    async (tag) => {
      const style = document.createElement('style');
      style.textContent = `body:has(${tag}:dir(rtl)) .entry-direction button { visibility: hidden; }`;
      const editor = document.createElement(tag);
      editor.dir = 'auto';
      editor.value = 'Latin';
      document.body.append(style, editor);
      const fixture = entry();
      fixture.ancestor.className = 'entry-direction';
      const button = document.createElement('button');
      fixture.target.append(button);
      // Model the two known directionality results; native :dir matching is
      // separately covered in shadow-closeout.browser.test.ts.
      visibleWhen(button, () => editor.value === 'Latin');
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);

      editor.value = 'עברית';
      inputEvent(editor, 'input');
      expect(fixture.target.tabIndex).toBe(0);

      editor.value = 'Latin';
      inputEvent(editor, 'input');
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
      expect(editor.dir).toBe('auto');
    }
  );

  it('keeps opaque stylesheet dependencies conservative', async () => {
    const opaque = new CSSStyleSheet();
    Object.defineProperty(opaque, 'cssRules', {
      configurable: true,
      get() {
        throw new DOMException('opaque stylesheet', 'SecurityError');
      },
    });
    // Preserve Happy DOM's normal computed-style path while supplying the
    // browser's inaccessible-sheet fact to dependency discovery.
    const descriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    Object.defineProperty(document, 'styleSheets', { configurable: true, value: [opaque] });
    disposals.push(() => {
      if (descriptor) Object.defineProperty(document, 'styleSheets', descriptor);
      else Reflect.deleteProperty(document, 'styleSheets');
    });
    const fixture = entry();
    const outside = document.createElement('input');
    document.body.append(outside);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    inputEvent(outside, 'input');

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(true);
  });

  it('updates constructed stylesheet input dependencies after CSSOM changes', async () => {
    const fixture = entry();
    // Happy DOM's HTMLStyleElement.sheet uses a different constructor from
    // window.CSSStyleSheet. A constructed sheet uses the actual observed
    // CSSOM interface, as native sheets do; do not manually refresh the entry.
    const sheet = new window.CSSStyleSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    disposals.push(() => {
      document.adoptedStyleSheets = originalSheets;
    });
    const outside = document.createElement('input');
    document.body.append(outside);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');
    const sampled = () => reads.mock.calls.some(([node]) => node === fixture.target);

    inputEvent(outside, 'input');
    expect(sampled()).toBe(false);

    sheet.replaceSync('body:has(input:checked) { visibility: hidden; }');
    await settle();
    reads.mockClear();
    inputEvent(outside, 'input');
    expect(sampled()).toBe(true);

    // Happy DOM deleteRule leaves an undefined array slot, which correctly
    // remains an opaque dependency. replaceSync supplies a real empty graph.
    sheet.replaceSync('');
    await settle();
    reads.mockClear();
    inputEvent(outside, 'input');
    expect(sampled()).toBe(false);
  });

  it.each(['input', 'change'] as const)('preserves synthetic %s notifications', async (type) => {
    const fixture = entry();
    const outside = document.createElement('input');
    document.body.append(outside);
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    inputEvent(outside, type, false);

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(true);
  });
});

const nativeInputPartRules = [
  ['[data-site-header-fallback-summary]::-webkit-details-marker', 'display: none;'],
  ['::file-selector-button', 'box-sizing: border-box; border: 0 solid; margin: 0; padding: 0;'],
  ['::-webkit-search-decoration', '-webkit-appearance: none;'],
  ['::-webkit-date-and-time-value', 'min-height: 1lh; text-align: inherit;'],
  ['::-webkit-datetime-edit', 'display: inline-flex;'],
  ['::-webkit-datetime-edit-fields-wrapper', 'padding: 0;'],
  ['::-webkit-datetime-edit-year-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-month-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-day-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-hour-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-minute-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-second-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-millisecond-field', 'padding-block: 0;'],
  ['::-webkit-datetime-edit-meridiem-field', 'padding-block: 0;'],
  ['::-webkit-calendar-picker-indicator', 'line-height: 1;'],
  ['::-webkit-inner-spin-button', 'height: auto;'],
  ['::-webkit-outer-spin-button', 'height: auto;'],
] as const;

describe('WC entry native input with native-part stylesheet rules', () => {
  it.each(
    nativeInputPartRules.flatMap(([selector, declarations]) =>
      (['input', 'change'] as const).map((type) => ({ selector, declarations, type }))
    )
  )(
    'does not resample an unrelated entry for $type with $selector',
    async ({ selector, declarations, type }) => {
      // These declarations come from the actual production page's loaded CSS.
      // The host model selects the trusted branch; native timing stays a separate gate.
      const style = document.createElement('style');
      style.textContent = `${selector} { ${declarations} }`;
      const outside = document.createElement('textarea');
      document.body.append(style, outside);
      expect((style.sheet!.cssRules[0] as CSSStyleRule).selectorText).toBe(selector);
      const fixture = entry();
      await settle();
      const reads = vi.spyOn(window, 'getComputedStyle');

      inputEvent(outside, type);

      expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(false);
    }
  );

  it.each([
    'input:valid::file-selector-button',
    'input:invalid::file-selector-button',
    'input:dir(rtl)::file-selector-button',
    'input:checked::file-selector-button',
    'input:placeholder-shown::file-selector-button',
    '::file-selector-button:future-input-state',
    '::-webkit-future-input-part',
    String.raw`::file-selector-button\2d unknown`,
  ])('keeps input-state or unresolved native-part selector conservative: %s', async (selector) => {
    const style = document.createElement('style');
    style.textContent = `${selector} { visibility: hidden; }`;
    const outside = document.createElement('input');
    document.body.append(style, outside);
    expect((style.sheet!.cssRules[0] as CSSStyleRule).selectorText).toBe(selector);
    const fixture = entry();
    await settle();
    const reads = vi.spyOn(window, 'getComputedStyle');

    inputEvent(outside, 'input');

    expect(reads.mock.calls.some(([node]) => node === fixture.target)).toBe(true);
  });
});
