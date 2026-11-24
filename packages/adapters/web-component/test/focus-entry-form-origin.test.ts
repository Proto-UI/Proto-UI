import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';

const settle = async () => {
  await Promise.resolve();
  await (
    window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
  ).happyDOM.waitUntilComplete();
};
const disposals: Array<() => void> = [];
const restorations: Array<() => void> = [];
// Native browser editing changes internal form state without invoking an
// author's patched JavaScript property setter. Keep the emulator's original
// setter to model that notification boundary, not a MutationObserver signal.
const nativeInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
const nativeInputChecked = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'checked'
)!.set!;
const nativeTextareaValue = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value'
)!.set!;

afterEach(async () => {
  for (const dispose of disposals.splice(0)) dispose();
  for (const restore of restorations.splice(0)) restore();
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
  const set = modules.focus!({ prototypeName: 'entry-form-origin' }).find(
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

function notifyFormState(target: Element, type: 'input' | 'change', trusted = true) {
  const event =
    type === 'input'
      ? new InputEvent('input', {
          bubbles: true,
          composed: true,
          inputType: 'insertText',
          data: 'text',
        })
      : new Event('change', { bubbles: true, composed: true });
  // Happy DOM cannot produce native editing. This selects the trusted-event
  // branch only; these are host-model controls, not new native-input evidence.
  if (trusted) Object.defineProperty(event, 'isTrusted', { get: () => true });
  target.dispatchEvent(event);
  return event;
}

function styleRule(text: string) {
  const style = document.createElement('style');
  style.textContent = text;
  document.body.prepend(style);
  return style;
}

function liveVisibility(button: HTMLElement, visible: () => boolean) {
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
    const computed = nativeGetComputedStyle(element, pseudoElement);
    if (element !== button) return computed;
    // CSS selector evaluation is not complete in the emulator. Declare the
    // real selector to the dependency collector and inject only its live
    // visibility result, derived from current control state, at this boundary.
    return new Proxy(computed, {
      get(target, property) {
        if (property === 'visibility') return visible() ? 'visible' : 'hidden';
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
}

function slottedRadioEntry(checked: 'assigned' | 'peer') {
  const fixture = entry();
  const carrier = document.createElement('div');
  const root = carrier.attachShadow({ mode: 'open' });
  const slot = document.createElement('slot');
  slot.name = 'content';
  const assigned = document.createElement('input');
  const peer = document.createElement('input');
  for (const radio of [assigned, peer]) {
    radio.type = 'radio';
    radio.name = 'entry-slotted-radio';
    radio.setAttribute('tabindex', '0');
  }
  assigned.slot = 'content';
  fixture.target.append(slot);
  root.append(fixture.target);
  carrier.append(assigned);
  fixture.ancestor.append(carrier, peer);
  nativeInputChecked.call(assigned, checked === 'assigned');
  nativeInputChecked.call(peer, checked === 'peer');
  fixture.configure(true);
  return { ...fixture, root, slot, assigned, peer };
}

describe('WC entry form-state event origin', () => {
  it('does not sample an unrelated entry for 331 trusted external editor input notifications', async () => {
    const fixture = entry();
    const editor = document.createElement('textarea');
    document.body.append(editor);
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    const reads = vi.spyOn(window, 'getComputedStyle');
    const events = new Set<Event>();

    for (let index = 0; index < 331; index += 1) {
      nativeTextareaValue.call(editor, `source line ${index}`);
      events.add(notifyFormState(editor, 'input'));
    }
    await settle();

    expect(events.size).toBe(331);
    expect(fixture.target.tabIndex).toBe(0);
    const samples = reads.mock.calls.filter(([node]) => node === fixture.target).length;
    expect(samples, '331 independent input events; one unrelated Entry owner').toBe(0);
  });

  it.each(['input', 'change'] as const)(
    'does not fan out unrelated trusted %s into 21 independent Entry owners',
    async (type) => {
      const fixtures = Array.from({ length: 21 }, () => entry());
      const targets = new Set(fixtures.map(({ target }) => target));
      const editor = document.createElement('textarea');
      document.body.append(editor);
      await settle();
      const reads = vi.spyOn(window, 'getComputedStyle');

      for (let index = 0; index < 3; index += 1) {
        nativeTextareaValue.call(editor, `source line ${index}`);
        notifyFormState(editor, type);
      }
      await settle();

      expect(fixtures.every(({ target }) => target.tabIndex === 0)).toBe(true);
      const samples = reads.mock.calls.filter(([node]) =>
        targets.has(node as HTMLDivElement)
      ).length;
      expect(samples, '3 events; fixture deliberately owns 21 separate Entry regions').toBe(0);
    }
  );

  it.each(['input', 'change'] as const)(
    'keeps a trusted internal %s that changes descendant eligibility without a DOM mutation',
    async (type) => {
      const fixture = entry();
      fixture.target.className = 'entry-internal-validity';
      const input = document.createElement('input');
      input.required = true;
      input.setAttribute('tabindex', '-1');
      const button = document.createElement('button');
      fixture.target.append(input, button);
      styleRule('.entry-internal-validity input:invalid + button { visibility: hidden; }');
      liveVisibility(button, () => input.validity.valid);
      await settle();
      expect(fixture.target.tabIndex).toBe(0);
      const attributes = input.outerHTML;

      nativeInputValue.call(input, 'ready');
      expect(input.outerHTML).toBe(attributes);
      expect(fixture.target.tabIndex).toBe(0);
      notifyFormState(input, type);
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);

      nativeInputValue.call(input, '');
      notifyFormState(input, type);
      await settle();
      expect(fixture.target.tabIndex).toBe(0);
    }
  );

  it.each(['input', 'change'] as const)(
    'keeps trusted %s from a radio assigned to a slot inside the Entry wrapper',
    async (type) => {
      const fixture = slottedRadioEntry('peer');
      await settle();
      expect(fixture.slot.assignedNodes()).toEqual([fixture.assigned]);
      expect(fixture.target.contains(fixture.assigned)).toBe(false);
      expect(fixture.root.querySelector('input')).toBeNull();
      expect(fixture.assigned.getRootNode()).toBe(document);
      expect(fixture.peer.form).toBe(fixture.assigned.form);
      expect(fixture.target.tabIndex).toBe(0);
      const attributes = [fixture.assigned.outerHTML, fixture.peer.outerHTML];

      // No stylesheet or visibility injection is needed: the real resolver
      // chooses the checked native radio in this same-document group.
      nativeInputChecked.call(fixture.assigned, true);
      nativeInputChecked.call(fixture.peer, false);
      expect([fixture.assigned.outerHTML, fixture.peer.outerHTML]).toEqual(attributes);
      expect(fixture.target.tabIndex).toBe(0);
      notifyFormState(fixture.assigned, type);
      await settle();

      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
    }
  );

  it('keeps external radio-peer input and change for the assigned Entry descendant', async () => {
    const fixture = slottedRadioEntry('assigned');
    await settle();
    expect(fixture.slot.assignedNodes()).toEqual([fixture.assigned]);
    expect(fixture.target.contains(fixture.peer)).toBe(false);
    expect(fixture.root.querySelector('input')).toBeNull();
    expect(fixture.peer.getRootNode()).toBe(document);
    expect(fixture.peer.form).toBe(fixture.assigned.form);
    const attributes = [fixture.assigned.outerHTML, fixture.peer.outerHTML];
    const fallbackAfterEvent: Array<string | null> = [];

    for (const type of ['input', 'change'] as const) {
      nativeInputChecked.call(fixture.assigned, true);
      nativeInputChecked.call(fixture.peer, false);
      fixture.configure(true);
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);

      nativeInputChecked.call(fixture.peer, true);
      nativeInputChecked.call(fixture.assigned, false);
      expect([fixture.assigned.outerHTML, fixture.peer.outerHTML]).toEqual(attributes);
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
      notifyFormState(fixture.peer, type);
      await settle();
      fallbackAfterEvent.push(fixture.target.getAttribute('tabindex'));
    }

    expect(fallbackAfterEvent).toEqual(['0', '0']);
  });

  it.each([
    ['sibling-validity', 'input'],
    ['ancestor-form-validity', 'input'],
    ['associated-form-validity', 'input'],
    ['escaped-associated-form-validity', 'input'],
    ['document-has-checked', 'change'],
    ['local-has-checked', 'change'],
    ['filtered-position-checked', 'change'],
    ['opaque-stylesheet-validity', 'input'],
  ] as const)(
    'retains external %s eligibility through a trusted %s notification',
    async (dependency, type) => {
      const fixture = entry();
      fixture.target.className = 'entry-external-form-state';
      fixture.ancestor.className = 'entry-form-state-ancestor';
      const button = document.createElement('button');
      const input = document.createElement('input');
      input.id = 'entry-form-state-control';
      input.type = dependency.includes('checked') ? 'checkbox' : 'text';
      if (input.type === 'text') input.required = true;
      fixture.target.append(button);
      document.body.append(input);
      let form: HTMLFormElement | undefined;

      if (dependency === 'sibling-validity') {
        fixture.target.before(input);
        styleRule(
          '#entry-form-state-control:invalid + .entry-external-form-state button { visibility: hidden; }'
        );
      } else if (
        dependency === 'ancestor-form-validity' ||
        dependency === 'associated-form-validity' ||
        dependency === 'escaped-associated-form-validity'
      ) {
        form = document.createElement('form');
        form.id = 'entry-form-state-owner';
        form.append(fixture.ancestor);
        document.body.append(form);
        if (dependency !== 'ancestor-form-validity') {
          input.setAttribute('form', form.id);
          expect(form.contains(input)).toBe(false);
        } else form.prepend(input);
        expect(input.form).toBe(form);
        expect(Array.from(form.elements)).toContain(input);
        // Neither selector contains :has nor a sibling combinator. A control
        // outside the Entry (or outside its form tree) still changes the
        // ancestor form's aggregate selector state.
        if (dependency === 'escaped-associated-form-validity') {
          // Do not also declare an unescaped state pseudo: it would hide a
          // dependency scanner that accidentally overlooks the escaped token.
          const style = styleRule(
            String.raw`form:v\61 lid .entry-external-form-state button { visibility: visible; }`
          );
          expect((style.sheet!.cssRules[0] as CSSStyleRule).selectorText).toContain(
            String.raw`:v\61 lid`
          );
        } else {
          styleRule(`
            form:invalid .entry-external-form-state button { visibility: hidden; }
            form:valid .entry-external-form-state button { visibility: visible; }
          `);
        }
      } else if (dependency === 'document-has-checked') {
        styleRule(
          'body:has(#entry-form-state-control:not(:checked)) .entry-external-form-state button { visibility: hidden; }'
        );
      } else if (dependency === 'local-has-checked') {
        fixture.ancestor.prepend(input);
        styleRule(
          '.entry-form-state-ancestor:has(#entry-form-state-control:not(:checked)) .entry-external-form-state button { visibility: hidden; }'
        );
      } else if (dependency === 'filtered-position-checked') {
        fixture.target.before(input);
        styleRule(
          '.entry-external-form-state:not(:has(.flag)):nth-child(1 of :checked, .entry-external-form-state) button { visibility: hidden; }'
        );
      } else {
        const opaque = new CSSStyleSheet();
        Object.defineProperty(opaque, 'cssRules', {
          get() {
            throw new DOMException('Cross-origin stylesheet', 'SecurityError');
          },
        });
        const sheets = [...document.styleSheets, opaque];
        const ownDescriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
        Object.defineProperty(document, 'styleSheets', {
          configurable: true,
          get: () => sheets,
        });
        restorations.push(() => {
          if (ownDescriptor) Object.defineProperty(document, 'styleSheets', ownDescriptor);
          else Reflect.deleteProperty(document, 'styleSheets');
        });
      }

      const visible = () => (input.type === 'checkbox' ? input.checked : input.validity.valid);
      liveVisibility(button, visible);
      fixture.configure(true);
      await settle();
      expect(fixture.target.contains(input)).toBe(false);
      expect(visible()).toBe(false);
      expect(fixture.target.tabIndex).toBe(0);
      const attributes = input.outerHTML;
      const changeControl = (next: boolean) => {
        if (input.type === 'checkbox') nativeInputChecked.call(input, next);
        else nativeInputValue.call(input, next ? 'ready' : '');
      };

      changeControl(true);
      expect(input.outerHTML).toBe(attributes);
      expect(fixture.target.tabIndex).toBe(0);
      notifyFormState(input, type);
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);

      changeControl(false);
      notifyFormState(input, type);
      await settle();
      expect(fixture.target.tabIndex).toBe(0);
    }
  );

  it('retains a repeated synthetic external input as a conservative author notification', async () => {
    const fixture = entry();
    const button = document.createElement('button');
    const editor = document.createElement('textarea');
    fixture.target.append(button);
    document.body.append(editor);
    let visible = true;
    liveVisibility(button, () => visible);
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);

    visible = false;
    const event = notifyFormState(editor, 'input', false);
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    visible = true;
    editor.dispatchEvent(event);
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });
});
