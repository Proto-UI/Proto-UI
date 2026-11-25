import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { isWebComponentPortaled } from '../../../adapters/web-component/src/portal-mount';
import { collectModalPresentationCss } from './modal-presentation-host';
import { dialogRoot, dialogContent, dialogMask } from '../src/dialog';
import { alertDialogRoot, alertDialogContent, alertDialogMask } from '../src/alert-dialog';

const families = [
  { name: 'Dialog', root: dialogRoot, content: dialogContent, mask: dialogMask },
  {
    name: 'AlertDialog',
    root: alertDialogRoot,
    content: alertDialogContent,
    mask: alertDialogMask,
  },
];
for (const family of families)
  for (const proto of [family.root, family.content, family.mask]) AdaptToWebComponent(proto);
type Host = HTMLElement & { getExposes(): Record<string, any> };
const roots: HTMLElement[] = [];
const stylesheets: HTMLStyleElement[] = [];
let tokenCss = '';
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
let now = 0,
  ticket = 0;
let preference: 'reduce' | 'no-preference' | 'unknown' = 'no-preference';
const frames = new Map<number, FrameRequestCallback>();
beforeAll(async () => {
  tokenCss = await collectModalPresentationCss();
}, 30_000);
function installStyles(target: Document | ShadowRoot) {
  const stylesheet = document.createElement('style');
  stylesheet.textContent = tokenCss;
  (target instanceof Document ? target.head : target).append(stylesheet);
  stylesheets.push(stylesheet);
}
beforeEach(() => {
  now = 0;
  frames.clear();
  preference = 'no-preference';
  installStyles(document);
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return preference !== 'unknown' && query.includes(': ' + preference + ')');
        },
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++ticket, callback);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
  for (const stylesheet of stylesheets.splice(0)) stylesheet.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  frames.clear();
});
async function step(time: number) {
  now = time;
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(time);
  await flush();
}
async function fixture(
  family: (typeof families)[number],
  scope: 'document' | 'shadow' = 'document'
) {
  const wrapper = document.createElement('div');
  document.body.append(wrapper);
  roots.push(wrapper);
  const parent = scope === 'shadow' ? wrapper.attachShadow({ mode: 'open' }) : wrapper;
  if (parent instanceof ShadowRoot) installStyles(parent);
  const root = document.createElement(family.root.name) as Host;
  const content = document.createElement(family.content.name) as Host;
  const mask = document.createElement(family.mask.name) as Host;
  // Portal projections can be physically outside the wrapper during teardown.
  roots.push(content, mask);
  content.textContent = 'Modal preferences';
  setElementProps(root, { open: false, a11yLabel: 'Modal preferences' });
  root.append(mask, content);
  parent.append(root);
  await flush();
  return {
    root,
    content,
    mask,
    async target(open: boolean) {
      setElementProps(root, { open, a11yLabel: 'Modal preferences' });
      await flush();
    },
    phase: () => content.getExposes().transitionState.get(),
    maskPhase: () => mask.getExposes().transitionState.get(),
  };
}
function expectRetainedClosedView(
  element: Host,
  owner: unknown,
  projectionParent: ParentNode | null
) {
  expect(element.getExposes().transitionState.get()).toBe('closed');
  expect(element.getExposes().isPresent.get()).toBe(false);
  expect(element.getExposes().getPresentationOwner()).toBe(owner);
  expect(element.hasAttribute('data-pui-view-detached')).toBe(true);
  expect(element.isConnected).toBe(true);
  expect(isWebComponentPortaled(element)).toBe(true);
  expect(element.parentNode).toBe(projectionParent);
  expect(element.hasAttribute('inert')).toBe(true);
  expect(element.style.getPropertyValue('visibility')).toBe('hidden');
  expect(element.style.getPropertyPriority('visibility')).toBe('important');
  expect(element.style.getPropertyValue('opacity')).toBe('0');
  expect(element.style.getPropertyPriority('opacity')).toBe('important');
  expect(getComputedStyle(element).display).toBe('none');
}
describe.each(families)('Bootstrap 2.3.2 $name authored modal motion', (family) => {
  // Fixed upstream b4c4072679943773a7582daa63f545ba818fa627:
  // less/modals.less top -.25 -> .10 of containing block, .3s ease-out;
  // opacity .3s linear, backdrop opacity .8 with .15s linear shared fade.
  it.each(['document', 'shadow'] as const)(
    'projects Content and Mask independently through real source in %s',
    async (scope) => {
      const f = await fixture(family, scope);
      await f.target(true);
      expect(f.phase()).toBe('entering');
      expect(f.maskPhase()).toBe('entering');
      expect(f.content.style.top).toBe('-250px');
      expect(f.content.style.opacity).toBe('0');
      expect(f.mask.style.opacity).toBe('0');
      await step(16);
      await step(91);
      expect(Number(f.content.style.opacity)).toBeCloseTo(0.25, 6);
      expect(Number(f.mask.style.opacity)).toBeCloseTo(0.4, 6);
      expect(Number.parseFloat(f.content.style.top)).toBeGreaterThan(-162.5);
      await step(166);
      expect(f.phase()).toBe('entering');
      expect(f.maskPhase()).toBe('entered');
      expect(Number(getComputedStyle(f.mask).opacity)).toBeCloseTo(0.8, 6);
      expect(Number.parseFloat(f.content.style.top)).toBeCloseTo(-250 + 350 * 0.684643187, 5);
      await step(316);
      expect(f.phase()).toBe('entered');
      expect(f.content.style.top).not.toBe('-250px');
      const owner = f.content.getExposes().getPresentationOwner();
      const contentProjectionParent = f.content.parentNode;
      const maskProjectionParent = f.mask.parentNode;
      expect(contentProjectionParent).not.toBe(f.root);
      expect(maskProjectionParent).not.toBe(f.root);
      await f.target(false);
      expect(f.phase()).toBe('leaving');
      expect(f.maskPhase()).toBe('leaving');
      expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
      expect(f.mask.hasAttribute('data-pui-view-detached')).toBe(false);
      await step(466);
      expect(f.maskPhase()).toBe('closed');
      expect(f.mask.hasAttribute('data-pui-view-detached')).toBe(true);
      expect(f.mask.parentNode).toBe(maskProjectionParent);
      expect(f.phase()).toBe('leaving');
      await step(616);
      expect(f.phase()).toBe('closed');
      // Not-present intent hides paint immediately. The original two-frame
      // barrier retains the owned DOM projection, not a visible layout surface.
      expectRetainedClosedView(f.content, owner, contentProjectionParent);
      await step(632);
      expectRetainedClosedView(f.content, owner, contentProjectionParent);
      await step(648);
      expect(f.content.hasAttribute('data-pui-view-detached')).toBe(true);
      expect(f.mask.hasAttribute('data-pui-view-detached')).toBe(true);
      expect(isWebComponentPortaled(f.content)).toBe(false);
      expect(isWebComponentPortaled(f.mask)).toBe(false);
      expect(f.content.parentNode).toBe(f.root);
      expect(f.mask.parentNode).toBe(f.root);
    }
  );
  it('reopens during the closed portal barrier without losing its presence lease', async () => {
    const f = await fixture(family);
    await f.target(true);
    await step(16);
    await step(316);
    const owner = f.content.getExposes().getPresentationOwner();
    const contentProjectionParent = f.content.parentNode;
    expect(contentProjectionParent).not.toBe(f.root);
    await f.target(false);
    await step(616);
    expectRetainedClosedView(f.content, owner, contentProjectionParent);
    await f.target(true);
    expect(f.phase()).toBe('entering');
    expect(f.content.getExposes().getPresentationOwner()).toBe(owner);
    expect(isWebComponentPortaled(f.content)).toBe(true);
    expect(f.content.parentNode).toBe(contentProjectionParent);
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(f.content.style.opacity).toBe('0');
    expect(f.content.hasAttribute('inert')).toBe(false);
    // This retained view has already presented: the new attempt starts at 616,
    // without the first-mount frame admission used by the initial open.
    await step(632);
    await step(766);
    expect(Number(f.content.style.opacity)).toBeCloseTo(0.5, 6);
    await step(916);
    expect(f.phase()).toBe('entered');
    expect(f.content.parentNode).toBe(contentProjectionParent);
  });

  it('controlled refusal leaves both accepted targets unchanged', async () => {
    const f = await fixture(family);
    await f.target(true);
    await step(16);
    await step(316);
    f.root.getExposes().close('controlled-refusal');
    await flush();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.phase()).toBe('entered');
    expect(f.maskPhase()).toBe('entered');
  });
  it.each(['content', 'mask'] as const)(
    'keeps closed %s invisible until the portal conceal barrier releases its view',
    async (part) => {
      const f = await fixture(family);
      await f.target(true);
      await step(16);
      await step(316);
      await f.target(false);
      await step(466);
      if (part === 'content') await step(616);
      expect(part === 'content' ? f.phase() : f.maskPhase()).toBe('closed');
      const element = f[part];
      const css = getComputedStyle(element);
      expect(
        !element.isConnected ||
          css.display === 'none' ||
          css.visibility === 'hidden' ||
          Number(css.opacity || '1') === 0,
        JSON.stringify({
          opacity: css.opacity,
          display: css.display,
          visibility: css.visibility,
          detached: element.hasAttribute('data-pui-view-detached'),
          inline: element.style.cssText,
        })
      ).toBe(true);
    }
  );
  it('reopens from actual acknowledged top/opacity and rejects stale close callbacks', async () => {
    const f = await fixture(family);
    await f.target(true);
    await step(16);
    await step(316);
    await f.target(false);
    await step(376);
    const top = f.content.style.top,
      opacity = f.content.style.opacity;
    const stale = [...frames.values()];
    await f.target(true);
    expect(f.content.style.top).toBe(top);
    expect(f.content.style.opacity).toBe(opacity);
    for (const callback of stale) callback(1000);
    await flush();
    expect(f.root.getExposes().open.get()).toBe(true);
    await step(676);
    expect(f.phase()).toBe('entered');
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
  });
  it.each(['reduce', 'unknown'] as const)(
    'settles %s through Base without a frame wait',
    async (mode) => {
      preference = mode;
      const f = await fixture(family);
      await f.target(true);
      expect(f.phase()).toBe('entered');
      expect(f.maskPhase()).toBe('entered');
      expect(Number(getComputedStyle(f.mask).opacity)).toBeCloseTo(0.8, 6);
      await f.target(false);
      expect(f.phase()).toBe('closed');
      expect(f.maskPhase()).toBe('closed');
    }
  );
});
