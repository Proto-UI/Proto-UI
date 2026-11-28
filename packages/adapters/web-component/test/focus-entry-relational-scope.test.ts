import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';
import { createWebComponentPortalMount } from '../src/portal-mount';

const disposals: Array<() => void> = [];
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

function entryFixture(css: string) {
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [sheet];
  const outer = document.createElement('section');
  const subject = document.createElement('article');
  subject.className = 'scope-owner';
  const outside = document.createElement('div');
  const target = document.createElement('div');
  target.className = 'relational-entry';
  const button = document.createElement('button');
  target.append(button);
  subject.append(target);
  outer.append(subject, outside);
  document.body.append(outer);
  let hidden: () => boolean = () => false;
  const nativeStyle = window.getComputedStyle.bind(window);
  const reads = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = nativeStyle(element, pseudo);
    if (element !== button) return style;
    return new Proxy(style, {
      get(style, property) {
        // Happy DOM does not evaluate every relational CSS form. Supply only
        // this computed-style platform fact; real DOM records, the actual
        // capability, dependency discovery and fallback writes stay native to
        // the host model. This is not a browser cascade/performance claim.
        if (property === 'visibility') return hidden() ? 'hidden' : 'visible';
        return Reflect.get(style, property, style);
      },
    });
  });
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
  const setEntry = modules.focus!({ prototypeName: 'entry-relational-scope' }).find(
    ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
  )![1] as (
    target: HTMLElement,
    config: { strategy: 'descendant-first'; fallback: 'self' },
    enabled: boolean
  ) => void;
  const config = { strategy: 'descendant-first', fallback: 'self' } as const;
  setEntry(target, config, true);
  disposals.push(() => setEntry(target, config, false));
  return {
    target,
    subject,
    outer,
    outside,
    button,
    sheet,
    reads,
    visibilityFrom(value: () => boolean) {
      hidden = value;
    },
  };
}

describe('WC entry relational selector observation domains', () => {
  it.each(['.scope-owner:has([data-hidden])', '.scope-owner:has(> [data-hidden])'])(
    'keeps a positive %s subject live without sampling an unrelated branch',
    async (selector) => {
      const fixture = entryFixture(`${selector} .relational-entry button { visibility: hidden; }`);
      fixture.visibilityFrom(() =>
        [...fixture.subject.children].some((child) => child.hasAttribute('data-hidden'))
      );
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
      fixture.reads.mockClear();
      fixture.outside.append(document.createElement('div'));
      fixture.outside.setAttribute('data-pui-style', 'unrelated-style-owner');
      await settle();
      expect(fixture.reads).not.toHaveBeenCalled();

      const flag = document.createElement('span');
      flag.setAttribute('data-hidden', '');
      fixture.subject.append(flag);
      await settle();
      expect(fixture.target.tabIndex).toBe(0);
      flag.remove();
      await settle();
      expect(fixture.target.hasAttribute('tabindex')).toBe(false);
    }
  );

  it('does not subscribe an unrelated static root rule, then discovers a newly matching entry child', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) .relational-entry button[data-region] { visibility: hidden; }'
    );
    fixture.visibilityFrom(
      () =>
        fixture.button.hasAttribute('data-region') &&
        fixture.outside.hasAttribute('data-hide-region')
    );
    await settle();
    fixture.reads.mockClear();
    fixture.outside.append(document.createElement('div'));
    fixture.outside.setAttribute('data-v-app', '');
    await settle();
    expect(fixture.reads).not.toHaveBeenCalled();

    // An arbitrary selector attribute must rebuild the local dependency graph,
    // even though it is not in the ordinary native-focus attribute allowlist.
    fixture.button.setAttribute('data-region', '');
    await settle();
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps a root selector which applies to an actual ancestor', async () => {
    const fixture = entryFixture('body:has([data-hide-region]) { visibility: hidden; }');
    document.body.append(fixture.outside);
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('retains a currently unmatched dynamic root selector', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) .relational-entry:hover button { visibility: hidden; }'
    );
    document.body.append(fixture.outside);
    let hovered = false;
    fixture.visibilityFrom(() => hovered && fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    hovered = true;
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('retains a positive has condition whose relative selector reaches siblings', async () => {
    const fixture = entryFixture(
      '.scope-owner:has(+ [data-hide-region]) .relational-entry button { visibility: hidden; }'
    );
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('discovers an updated live CSS selector on the same rule object', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) .unrelated-component button { visibility: hidden; }'
    );
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    const rule = fixture.sheet.cssRules[0] as CSSStyleRule;
    rule.selectorText = 'body:has([data-hide-region]) .relational-entry button';
    // The host model lacks the native CSSStyleRule selectorText notification;
    // request the same dependency refresh through a real local class record.
    fixture.target.classList.add('refresh-live-rule');
    await settle();
    expect(fixture.sheet.cssRules[0]).toBe(rule);
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
  });

  it('keeps a root part selector whose styled descendant is inside an open root', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) .relational-entry::part(control) { visibility: hidden; }'
    );
    document.body.append(fixture.outside);
    fixture.button.setAttribute('part', 'control');
    fixture.target.attachShadow({ mode: 'open' }).append(fixture.button);
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps the root watch when the native selector probe cannot resolve a CSSOM selector', async () => {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
      if (selector.includes('.foreign-probe'))
        throw new DOMException('Unresolved stylesheet selector context', 'SyntaxError');
      return Reflect.apply(matches, this, [selector]);
    });
    const fixture = entryFixture(
      'body:has([data-hide-region]) .relational-entry .foreign-probe { visibility: hidden; }'
    );
    document.body.append(fixture.outside);
    fixture.button.className = 'foreign-probe';
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('matches a root selector against the current owned portal projection', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) .owned-projection button { visibility: hidden; }'
    );
    document.body.append(fixture.outside);
    const projection = document.createElement('div');
    projection.className = 'owned-projection';
    projection.append(fixture.button);
    fixture.target.append(projection);
    const portal = createWebComponentPortalMount();
    portal.mount(projection);
    disposals.push(() => portal.unmount(projection));
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    expect(projection.parentElement).toBe(document.body);
    expect(fixture.target.contains(fixture.button)).toBe(false);
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });

  it('retains root dependencies of assigned candidates outside the physical entry subtree', async () => {
    const fixture = entryFixture(
      'body:has([data-hide-region]) button[data-assigned-control] { visibility: hidden; }'
    );
    document.body.append(fixture.outside);
    const host = document.createElement('div');
    const slot = document.createElement('slot');
    fixture.button.setAttribute('data-assigned-control', '');
    fixture.target.replaceWith(host);
    host.attachShadow({ mode: 'open' }).append(fixture.target);
    fixture.target.replaceChildren(slot);
    host.append(fixture.button);
    fixture.visibilityFrom(() => fixture.outside.hasAttribute('data-hide-region'));
    await settle();
    expect(slot.assignedElements()).toContain(fixture.button);
    expect(fixture.target.contains(fixture.button)).toBe(false);
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
    fixture.outside.setAttribute('data-hide-region', '');
    await settle();
    expect(fixture.target.tabIndex).toBe(0);
    fixture.outside.removeAttribute('data-hide-region');
    await settle();
    expect(fixture.target.hasAttribute('tabindex')).toBe(false);
  });
});
