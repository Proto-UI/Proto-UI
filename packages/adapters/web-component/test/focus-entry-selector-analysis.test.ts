import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import { createWebComponentModules } from '../src/runtime/modules';

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

function entry() {
  const target = document.createElement('div');
  target.className = 'selector-analysis-entry';
  const button = document.createElement('button');
  target.append(button);
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
  const setEntry = modules.focus!({ prototypeName: 'selector-analysis-entry' }).find(
    ([key]) => key === FOCUS_SET_ENTRY_FOCUSABLE_CAP
  )![1] as (
    target: HTMLElement,
    config: { strategy: 'descendant-first'; fallback: 'self' },
    enabled: boolean
  ) => void;
  const config = { strategy: 'descendant-first', fallback: 'self' } as const;
  setEntry(target, config, true);
  disposals.push(() => setEntry(target, config, false));
  return { target, button };
}

describe('WC entry selector analysis work', () => {
  it('does not repeat immutable selector parsing for another entry or DOM-only rebuild', async () => {
    const sheet = new window.CSSStyleSheet();
    sheet.replaceSync(
      '.selector-analysis-entry:where(:not([hidden])) button { visibility: visible; }'
    );
    document.adoptedStyleSheets = [sheet];
    const nativeTest = RegExp.prototype.test;
    let classifications = 0;
    vi.spyOn(RegExp.prototype, 'test').mockImplementation(function (this: RegExp, value: string) {
      // Count the existing input-state classifier's lexical work, not elapsed
      // time, CSS matching or private cache fields. The real focus capability
      // still reads CSSOM, builds its dependency graph and projects each entry.
      if (this.source.startsWith('^(?:is|where|not|has|nth')) classifications++;
      return Reflect.apply(nativeTest, this, [value]);
    });
    const first = entry();
    await settle();
    const initial = classifications;
    expect(initial).toBeGreaterThan(0);
    const others = Array.from({ length: 8 }, () => entry());
    await settle();
    first.target.setAttribute('data-consumer-state', 'changed');
    first.button.className = 'changed';
    await settle();
    expect([first, ...others].every(({ target }) => !target.hasAttribute('tabindex'))).toBe(true);
    expect(classifications).toBe(initial);
  });

  it('reads changed selectors from the same live CSS rule and preserves external input dependency', async () => {
    const sheet = new window.CSSStyleSheet();
    sheet.replaceSync('.selector-analysis-entry button { visibility: visible; }');
    document.adoptedStyleSheets = [sheet];
    const outside = document.createElement('input');
    outside.type = 'checkbox';
    document.body.append(outside);
    const { target } = entry();
    await settle();
    const rule = sheet.cssRules[0] as CSSStyleRule;
    const reads = vi.spyOn(window, 'getComputedStyle');
    const notify = () => {
      const event = new Event('input', { bubbles: true, composed: true });
      // The host model cannot create trusted input. Only select that branch;
      // this control does not stand in for the unchanged native Matrix gate.
      Object.defineProperty(event, 'isTrusted', { get: () => true });
      outside.dispatchEvent(event);
      return reads.mock.calls.some(([element]) => element === target);
    };
    expect(notify()).toBe(false);
    rule.selectorText = 'body:has(input:checked) .selector-analysis-entry button';
    // Happy DOM does not implement this CSSStyleRule prototype's native setter
    // notification. A real observed DOM change requests dependency discovery;
    // the same CSS rule object must now supply its current selector text.
    target.classList.add('rebuild-current-cssom');
    await settle();
    reads.mockClear();
    expect(sheet.cssRules[0]).toBe(rule);
    expect(notify()).toBe(true);
    rule.selectorText = '.selector-analysis-entry button';
    target.classList.remove('rebuild-current-cssom');
    await settle();
    reads.mockClear();
    expect(notify()).toBe(false);
  });
});
