import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import type { AdapterPrototype } from '@proto.ui/adapter-base';
import {
  AdaptToWebComponent,
  setElementProps,
  setElementAssociations,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import { checkboxRoot as baseCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { fieldRoot as baseFieldRoot } from '@proto.ui/prototypes-base/field';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import { styleContains } from '../../test-utils/style';
import { styleScope } from '../src/style-scope';
import {
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
} from '../src/accordion';
import { collapsibleRoot, collapsibleTrigger, collapsibleContent } from '../src/collapsible';
import {
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselPrevious,
  carouselNext,
} from '../src/carousel';
import { resizableRoot, resizablePanel, resizableHandle } from '../src/resizable';
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../src/scroll-area';
import {
  progressRoot,
  progressLabel,
  progressTrack,
  progressIndicator,
  progressValue,
} from '../src/progress';
import { meterRoot, meterLabel, meterTrack, meterIndicator, meterValue } from '../src/meter';
import { labelRoot } from '../src/label';
import separatorRoot from '../src/separator';
import {
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
} from '../src/message-scroller';
import { virtualListRoot, virtualListViewport, virtualListContent } from '../src/virtual-list';
import {
  sliderRoot,
  sliderLabel,
  sliderTrack,
  sliderIndicator,
  sliderThumb,
  sliderFieldThumb,
  sliderValue,
} from '../src/slider';

for (const prototype of [
  styleScope,
  baseCheckboxRoot,
  baseFieldRoot,
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
  collapsibleRoot,
  collapsibleTrigger,
  collapsibleContent,
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselPrevious,
  carouselNext,
  resizableRoot,
  resizablePanel,
  resizableHandle,
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
  progressRoot,
  progressLabel,
  progressTrack,
  progressIndicator,
  progressValue,
  meterRoot,
  meterLabel,
  meterTrack,
  meterIndicator,
  meterValue,
  labelRoot,
  separatorRoot,
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
  virtualListRoot,
  virtualListViewport,
  virtualListContent,
  sliderRoot,
  sliderLabel,
  sliderTrack,
  sliderIndicator,
  sliderThumb,
  sliderFieldThumb,
  sliderValue,
])
  AdaptToWebComponent(prototype);

const PROFILES = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
  'new-york-v4',
] as const;

function element<P extends AdapterPrototype>(prototype: P, props: Record<string, unknown> = {}) {
  const target = document.createElement(prototype.name) as WebComponentAdapterElement<P>;
  setElementProps(target, props);
  return target;
}
async function settle() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
  // Drain the real delay(0) paint scheduler used by the disclosure glyph.
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 12; index++) await Promise.resolve();
}
async function animationFrame() {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  await vi.advanceTimersByTimeAsync(16);
  await promise;
}
function scoped(child: HTMLElement, profile: string = 'vega') {
  const scope = element(styleScope, { styleProfile: profile });
  scope.append(child);
  document.body.append(scope);
  return scope;
}
function metrics(
  target: HTMLElement,
  width: number,
  height: number,
  extentWidth: number,
  extentHeight: number
) {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
    scrollWidth: { configurable: true, value: extentWidth },
    scrollHeight: { configurable: true, value: extentHeight },
    scrollLeft: { configurable: true, writable: true, value: 0 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
}
function paint(target: HTMLElement) {
  const body = (target.shadowRoot ?? target).querySelector('[data-pui-owned-decoration], div');
  if (!body) throw new Error(`Missing inert paint container for ${target.localName}`);
  return body;
}
function pointer(type: string, x: number, y = 50) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 91,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
}
function clickPointer(target: HTMLElement) {
  target.dispatchEvent(pointer('pointerdown', 0));
  target.dispatchEvent(pointer('pointerup', 0));
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.useRealTimers();
});

describe('source-bound layout profiles preserve inherited owners', () => {
  it('withdraws Accordion recipes while controlled refusal, heading, relations and slots stay canonical', async () => {
    const root = element(accordionRoot, { openItems: [] });
    const item = element(accordionItem, { value: 'a' });
    const heading = element(accordionHeading, { level: 2 });
    const trigger = element(accordionTrigger);
    const content = element(accordionContent, { keepMounted: true, region: true });
    const label = document.createElement('span');
    const payload = document.createElement('button');
    label.textContent = 'A long authored disclosure label';
    payload.textContent = 'Retained action';
    trigger.append(label);
    content.append(payload);
    heading.append(trigger);
    item.append(heading, content);
    root.append(item);
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    const scope = scoped(root);
    await settle();
    const openCount = root.getExposes().openCount;
    const expanded = trigger.getExposes().expanded;
    for (const profile of PROFILES) {
      const before = requests.length;
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(requests).toHaveLength(before);
      expect(root.getExposes().openCount).toBe(openCount);
      expect(trigger.getExposes().expanded).toBe(expanded);
      expect(heading.getAttribute('aria-level')).toBe('2');
      expect(trigger.getAttribute('aria-controls')).toBe(content.id);
      expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
      expect(trigger.contains(label)).toBe(true);
      expect(content.contains(payload)).toBe(true);
      expect(expanded.get()).toBe(false);
      expect(styleContains(trigger, 'text-xs')).toBe(profile === 'lyra' || profile === 'mira');
      expect(styleContains(content, 'pb-2.5')).toBe(profile === 'nova' || profile === 'lyra');
      trigger.click();
      await settle();
      expect(requests).toHaveLength(before + 1);
      expect(root.getExposes().getOpenItems()).toEqual([]);
      expect(content.getExposes().hidden.get()).toBe(true);
    }
    setElementProps(root, { openItems: ['a'], disabled: true });
    await settle();
    expect(expanded.get()).toBe(true);
    expect(content.getExposes().hidden.get()).toBe(false);
    const count = requests.length;
    trigger.click();
    await settle();
    expect(requests).toHaveLength(count);
    expect(root.getExposes().getOpenItems()).toEqual(['a']);
  });

  it('derives Accordion final-item borders from real logical order, including withdrawal', async () => {
    const root = element(accordionRoot);
    const first = element(accordionItem, { value: 'first' });
    const second = element(accordionItem, { value: 'second' });
    for (const item of [first, second]) {
      const heading = element(accordionHeading);
      const trigger = element(accordionTrigger);
      trigger.textContent = 'Toggle';
      heading.append(trigger);
      item.append(heading, element(accordionContent));
    }
    root.append(first, second);
    document.body.append(root);
    await settle();
    expect(styleContains(first, 'border-b')).toBe(true);
    expect(styleContains(second, 'border-b')).toBe(false);
    second.remove();
    first.update();
    await settle();
    expect(styleContains(first, 'border-b')).toBe(false);
    expect(root.getExposes().getOpenItems()).toEqual([]);
  });

  it('keeps unstyled upstream Collapsible primitives on the same declared Proto frame and one disclosure owner', async () => {
    const root = element(collapsibleRoot, { open: false });
    const trigger = element(collapsibleTrigger);
    const content = element(collapsibleContent, { keepMounted: true });
    const payload = document.createElement('span');
    trigger.textContent = 'Details';
    payload.textContent = 'Caller content';
    content.append(payload);
    root.append(trigger, content);
    const scope = scoped(root);
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    await settle();
    const open = root.getExposes().open;
    for (const profile of PROFILES) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(root.getExposes().open).toBe(open);
      trigger.click();
      await settle();
      expect(open.get()).toBe(false);
      expect(content.getExposes().hidden.get()).toBe(true);
      expect(content.contains(payload)).toBe(true);
    }
    expect(requests).toHaveLength(PROFILES.length);
    setElementProps(root, { open: true, disabled: true });
    await settle();
    trigger.click();
    await settle();
    expect(open.get()).toBe(true);
    expect(requests).toHaveLength(PROFILES.length);
    expect(content.getAttribute('role')).toBeNull();
  });

  it('keeps Progress indeterminacy separate from Meter quality across all nine track recipes', async () => {
    const progress = element(progressRoot, { value: 25, valueText: 'One quarter' });
    const pLabel = element(progressLabel);
    const pTrack = element(progressTrack);
    const pIndicator = element(progressIndicator);
    const pValue = element(progressValue);
    pLabel.textContent = 'Transfer';
    pTrack.append(pIndicator);
    progress.append(pLabel, pTrack, pValue);
    const meter = element(meterRoot, {
      value: 90,
      low: 20,
      high: 60,
      optimum: 10,
      valueText: 'Critical storage',
    });
    const mLabel = element(meterLabel);
    const mTrack = element(meterTrack);
    const mIndicator = element(meterIndicator);
    const mValue = element(meterValue);
    mLabel.textContent = 'Storage';
    mTrack.append(mIndicator);
    meter.append(mLabel, mTrack, mValue);
    const scope = element(styleScope);
    scope.append(progress, meter);
    document.body.append(scope);
    await settle();
    const pPercentage = progress.getExposes().percentage;
    const mStatus = meter.getExposes().status;
    const tracks = [
      ['vega', 'h-1.5'],
      ['nova', 'h-1'],
      ['maia', 'h-3'],
      ['lyra', 'h-1'],
      ['mira', 'h-1'],
      ['luma', 'h-3'],
      ['sera', 'h-0.5'],
      ['rhea', 'h-2'],
      ['new-york-v4', 'h-2'],
    ] as const;
    let previous = '';
    for (const [profile, height] of tracks) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      for (const track of [pTrack, mTrack]) {
        expect(styleContains(track, height)).toBe(true);
        if (previous && previous !== height) expect(styleContains(track, previous)).toBe(false);
        expect(styleContains(track, 'bg-primary/20')).toBe(profile === 'new-york-v4');
      }
      previous = height;
      expect(progress.getExposes().percentage).toBe(pPercentage);
      expect(pPercentage.get()).toBe(25);
      expect(meter.getExposes().status).toBe(mStatus);
      expect(mStatus.get()).toBe('critical');
      expect(progress.getAttribute('role')).toBe('progressbar');
      expect(meter.getAttribute('role')).toBe('meter');
      expect(progress.getAttribute('aria-labelledby')).toBe(pLabel.id);
      expect(meter.getAttribute('aria-labelledby')).toBe(mLabel.id);
      expect(pValue.textContent).toBe('One quarter');
      expect(mValue.textContent).toBe('Critical storage');
    }
    setElementProps(progress, {});
    await settle();
    expect(progress.getExposes().indeterminate.get()).toBe(true);
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
    expect(pValue.textContent).toBe('');
    expect(meter.getExposes().indeterminate.get()).toBe(false);
    expect(mStatus.get()).toBe('critical');
  });

  it('preserves Label naming/activation leases while source typography changes and withdraws', async () => {
    const ref = createControlLabelRef();
    const label = element(labelRoot, { naming: true, activation: true });
    const control = element(baseCheckboxRoot);
    setElementAssociations(label, { controlLabel: ref });
    setElementAssociations(control, { controlLabel: ref });
    const text = document.createElement('span');
    text.textContent = 'Notifications';
    label.append(text);
    const scope = element(styleScope);
    scope.append(control, label);
    document.body.append(scope);
    await settle();
    const checked = control.getExposes().checked;
    for (const profile of PROFILES) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(control.getAttribute('aria-labelledby')).toBe(label.id);
      expect(label.firstChild).toBe(text);
      expect(label.hasAttribute('role')).toBe(false);
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(styleContains(label, 'uppercase')).toBe(profile === 'sera');
      expect(styleContains(label, 'text-xs')).toBe(['lyra', 'mira', 'sera'].includes(profile));
      expect(control.getExposes().checked).toBe(checked);
    }
    clickPointer(label);
    await settle();
    expect(checked.get()).toBe(true);
    setElementProps(label, { naming: true, activation: false });
    await settle();
    expect(styleContains(label, 'select-none')).toBe(false);
    clickPointer(label);
    await settle();
    expect(checked.get()).toBe(true);
    expect(control.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('keeps Separator contentless and passive while profile/orientation geometry is withdrawn', async () => {
    const separator = element(separatorRoot, { orientation: 'vertical', decorative: false });
    separator.textContent = 'Must not become Separator content';
    const scope = scoped(separator);
    await settle();
    const orientation = separator.getExposes().orientation;
    for (const profile of PROFILES) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(separator.getExposes().orientation).toBe(orientation);
      expect(separator.getAttribute('role')).toBe('separator');
      expect(separator.getAttribute('aria-orientation')).toBe('vertical');
      // These rules also depend on the unexposed profile, so runtime evaluates
      // the combined condition and publishes the active unprefixed geometry.
      expect(styleContains(separator, 'self-stretch')).toBe(profile !== 'new-york-v4');
      expect(styleContains(separator, 'h-full')).toBe(profile === 'new-york-v4');
      expect((separator.shadowRoot ?? separator).textContent).not.toContain('Must not become');
      expect(separator.tabIndex).toBe(-1);
    }
    setElementProps(separator, { orientation: 'horizontal', decorative: true });
    await settle();
    expect(separator.hasAttribute('role')).toBe(false);
    expect(separator.getAttribute('aria-hidden')).toBe('true');
    expect(orientation.get()).toBe('horizontal');
  });

  it('preserves the same composed Scroll Surface, slots and normalized facts across thumb profiles', async () => {
    const root = element(ShadcnScrollAreaRoot);
    const viewport = element(ShadcnScrollAreaViewport);
    const vertical = element(ShadcnScrollAreaScrollbar);
    const horizontal = element(ShadcnScrollAreaScrollbar, { orientation: 'horizontal' });
    const vThumb = element(ShadcnScrollAreaThumb);
    const hThumb = element(ShadcnScrollAreaThumb);
    const payload = document.createElement('span');
    payload.textContent = 'Long authored contents';
    viewport.append(payload);
    metrics(viewport, 100, 100, 400, 500);
    vertical.append(vThumb);
    horizontal.append(hThumb);
    root.append(viewport, vertical, horizontal);
    const scope = scoped(root);
    await settle();
    const y = viewport.getExposes().scrollYPosition;
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(y.get()).toBe(0.25);
    for (const profile of PROFILES) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(viewport.getExposes().scrollYPosition).toBe(y);
      expect(y.get()).toBe(0.25);
      expect(viewport.getExposes().scrollProjection.get()).toBe('composed');
      expect(viewport.firstChild).toBe(payload);
      expect(styleContains(viewport, 'rounded-[inherit]')).toBe(true);
      expect(styleContains(vertical, 'p-px')).toBe(true);
      expect(styleContains(vThumb, 'rounded-none')).toBe(profile === 'lyra' || profile === 'sera');
      expect(styleContains(hThumb, 'rounded-none')).toBe(profile === 'lyra' || profile === 'sera');
      expect(vThumb.hasAttribute('role')).toBe(false);
      expect(vThumb.tabIndex).toBe(-1);
    }
  });

  it('retains Carousel discrete controlled refusal, slide truth and control availability across source sizes', async () => {
    const root = element(carouselRoot, { index: 0 });
    const viewport = element(carouselViewport);
    const slides = [0, 1, 2].map((index) => element(carouselSlide, { index }));
    slides.forEach((slide, index) => {
      slide.textContent = `Slide ${index + 1}`;
    });
    viewport.append(...slides);
    const previous = element(carouselPrevious);
    const next = element(carouselNext);
    previous.textContent = 'Previous slide';
    next.textContent = 'Next slide';
    root.append(viewport, previous, next);
    const scope = scoped(root);
    const requests: number[] = [];
    root.addEventListener('indexChange', (event) =>
      requests.push((event as CustomEvent<{ index: number }>).detail.index)
    );
    await settle();
    const index = root.getExposes().index;
    const recipes = [
      ['vega', 'size-8'],
      ['nova', 'size-7'],
      ['maia', 'size-8'],
      ['lyra', 'size-7'],
      ['mira', 'size-6'],
      ['luma', 'size-8'],
      ['sera', 'size-9'],
      ['rhea', 'size-7'],
      ['new-york-v4', 'size-8'],
    ] as const;
    for (const [profile, size] of recipes) {
      const before = requests.length;
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(requests).toHaveLength(before);
      expect(styleContains(next, size)).toBe(true);
      expect(root.getExposes().index).toBe(index);
      expect(root.getExposes().slideCount.get()).toBe(3);
      expect(previous.getExposes().disabled.get()).toBe(true);
      expect(next.getExposes().disabled.get()).toBe(false);
      next.click();
      await settle();
      expect(requests).toHaveLength(before + 1);
      expect(requests.at(-1)).toBe(1);
      expect(index.get()).toBe(0);
      expect(slides.map((slide) => slide.getExposes().current.get())).toEqual([true, false, false]);
    }
    setElementProps(root, { index: 2, orientation: 'vertical', disabled: true });
    await settle();
    const count = requests.length;
    previous.click();
    next.click();
    await settle();
    expect(requests).toHaveLength(count);
    expect(index.get()).toBe(2);
    expect(slides[2].getExposes().hidden.get()).toBe(false);
  });

  it('retains Resizable complementary sizes, controlled proposal/commit and one focus owner with optional grip paint', async () => {
    const root = element(resizableRoot, { value: 50, min: 20, max: 80 });
    const first = element(resizablePanel, { index: 0 });
    const second = element(resizablePanel, { index: 1 });
    const handle = element(resizableHandle, { withHandle: true });
    first.textContent = 'First panel';
    second.textContent = 'Second panel';
    root.append(first, handle, second);
    const scope = scoped(root);
    const changes: number[] = [];
    const commits: number[] = [];
    root.addEventListener('valueChange', (event) =>
      changes.push((event as CustomEvent<{ value: number }>).detail.value)
    );
    root.addEventListener('valueCommit', (event) =>
      commits.push((event as CustomEvent<{ value: number }>).detail.value)
    );
    await settle();
    const value = root.getExposes().value;
    handle.focus();
    for (const profile of PROFILES) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(root.getExposes().value).toBe(value);
      expect(first.getExposes().size.get()).toBe(50);
      expect(second.getExposes().size.get()).toBe(50);
      expect(handle.getAttribute('role')).toBe('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(paint(handle).getAttribute('tabindex')).toBeNull();
      expect(paint(handle).getAttribute('role')).toBeNull();
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
      await settle();
      expect(changes.at(-1)).toBe(51);
      expect(commits.at(-1)).toBe(51);
      expect(value.get()).toBe(50);
    }
    expect(changes).toHaveLength(PROFILES.length);
    expect(commits).toHaveLength(PROFILES.length);
    setElementProps(root, { value: 70, orientation: 'vertical', readOnly: true });
    await settle();
    expect(first.getExposes().size.get()).toBe(70);
    expect(second.getExposes().size.get()).toBe(30);
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    await settle();
    expect(changes).toHaveLength(PROFILES.length);
    setElementProps(handle, { withHandle: false });
    await settle();
    expect((handle.shadowRoot ?? handle).querySelector('div')).toBeNull();
    expect(root.getExposes().value).toBe(value);
    expect(handle.getAttribute('role')).toBe('separator');
    expect(document.activeElement).toBe(handle);
    setElementProps(handle, { withHandle: true });
    await settle();
    expect(paint(handle).getAttribute('role')).toBeNull();
    expect(paint(handle).getAttribute('tabindex')).toBeNull();
    expect(root.getExposes().value).toBe(value);
    expect(first.getExposes().size.get()).toBe(70);
    expect(second.getExposes().size.get()).toBe(30);
    expect(document.activeElement).toBe(handle);
  });

  it('never rearms Message follow on appearance/count updates and routes Jump through the actual Scroll Surface', async () => {
    const root = element(messageScrollerRoot, { newContentCount: 4 });
    const viewport = element(messageScrollerViewport);
    const jump = element(messageScrollerJump);
    jump.textContent = 'Latest messages';
    metrics(viewport, 100, 100, 100, 500);
    viewport.textContent = 'Conversation';
    root.append(viewport, jump);
    const scope = scoped(root);
    await settle();
    await animationFrame();
    await settle();
    const following = viewport.getExposes().following;
    const status = viewport.getExposes().requestStatus;
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(following.get()).toBe('paused');
    const jumpSizes = [
      'size-8',
      'size-7',
      'size-8',
      'size-7',
      'size-6',
      'size-8',
      'size-9',
      'size-7',
      'size-8',
    ];
    for (const [index, profile] of PROFILES.entries()) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(viewport.getExposes().following).toBe(following);
      expect(viewport.getExposes().requestStatus).toBe(status);
      expect(following.get()).toBe('paused');
      expect(viewport.scrollTop).toBe(100);
      expect(jump.getExposes().newContentCount.get()).toBe(4);
      expect(styleContains(root, 'overflow-hidden')).toBe(true);
      expect(styleContains(viewport, 'overflow-y-auto')).toBe(true);
      expect(styleContains(jump, 'bottom-4')).toBe(true);
      expect(styleContains(jump, jumpSizes[index]!)).toBe(true);
    }
    setElementProps(root, { newContentCount: 7, a11yLabel: 'Team conversation' });
    viewport.append(document.createElement('span'));
    await settle();
    expect(viewport.getAttribute('aria-label')).toBe('Team conversation');
    expect(jump.getExposes().newContentCount.get()).toBe(7);
    expect(following.get()).toBe('paused');
    expect(viewport.scrollTop).toBe(100);
    jump.click();
    await animationFrame();
    await settle();
    expect(viewport.scrollTop).toBe(400);
    expect(following.get()).toBe('following');
    expect(status.get()).toBe('applied');
    expect(jump.getExposes().atEnd.get()).toBe(true);
  });

  it('preserves the actual bounded keyed Web realization and collection generation through Virtual List style updates', async () => {
    const keys = Array.from({ length: 100 }, (_, index) => `row-${index}`);
    const root = element(virtualListRoot, {
      itemKeys: keys,
      overscanItems: 1,
      maxMaterializedItems: 8,
    });
    const viewport = element(virtualListViewport);
    const content = element(virtualListContent);
    metrics(viewport, 100, 80, 100, 2000);
    viewport.append(content);
    root.append(viewport);
    const scope = scoped(root);
    await settle();
    const collection = root.getExposes().getCollection();
    // Existing public Base Web realization, not a new family virtualizer.
    const binding = attachWebVirtualList({
      viewport,
      content,
      collection,
      estimateSize: 20,
      renderItem(key) {
        const row = document.createElement('div');
        row.textContent = key;
        return row;
      },
    });
    try {
      const first = content.querySelector('[role=listitem]');
      const snapshot = root.getExposes().getWindow();
      expect(snapshot.status).toBe('committed');
      expect(content.querySelectorAll('[role=listitem]').length).toBeLessThanOrEqual(8);
      for (const profile of PROFILES) {
        setElementProps(scope, { styleProfile: profile });
        await settle();
        expect(root.getExposes().getCollection()).toBe(collection);
        expect(root.getExposes().logicalCount.get()).toBe(100);
        expect(root.getExposes().getWindow().generation).toBe(snapshot.generation);
        expect(content.querySelector('[role=listitem]')).toBe(first);
        expect(content.getAttribute('role')).toBe('list');
      }
      expect(binding.ensureVisible('row-90', 'start')).toBe(true);
      expect(root.getExposes().getWindow().materializedKeys).toContain('row-90');
      expect(content.querySelectorAll('[role=listitem]').length).toBeLessThanOrEqual(8);
    } finally {
      binding.dispose();
    }
  });
});

for (const field of [false, true]) {
  it(`maps every scalar Slider recipe without replacing value, Field/input owner or slots; field=${field}`, async () => {
    const root = element(sliderRoot, { value: 25, step: 5 });
    const track = element(sliderTrack);
    const thumb = field ? element(sliderFieldThumb) : element(sliderThumb);
    const indicator = element(sliderIndicator);
    const label = element(sliderLabel);
    const output = element(sliderValue);
    const slot = document.createElement('span');
    label.textContent = 'Volume';
    slot.textContent = 'Caller Thumb content';
    thumb.append(slot);
    track.append(indicator, thumb);
    root.append(label, track, output);
    const owner = field ? element(baseFieldRoot) : null;
    if (owner) owner.append(root);
    const scope = scoped(owner ?? root, 'nova');
    await settle();
    const value = root.getExposes().value;
    const body = paint(thumb);
    const changes: number[] = [];
    root.addEventListener('valueChange', (event) =>
      changes.push((event as CustomEvent<{ value: number }>).detail.value)
    );
    const recipes = [
      ['vega', 'h-1.5', 'size-4', 'ring-4'],
      ['nova', 'h-1', 'size-3', 'ring-3'],
      ['maia', 'h-3', 'size-4', 'ring-4'],
      ['lyra', 'h-1', 'size-3', 'ring-1'],
      ['mira', 'h-1', 'size-3', 'ring-2'],
      ['luma', 'h-2', 'w-6', 'ring-4'],
      ['sera', 'h-0.5', 'size-3', 'ring-2'],
      ['rhea', 'h-1', 'size-4', 'ring-4'],
      ['new-york-v4', 'h-1.5', 'size-4', 'ring-4'],
    ] as const;
    for (const [profile, rail, size, ring] of recipes) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(root.getExposes().value).toBe(value);
      expect(value.get()).toBe(25);
      expect(paint(thumb)).toBe(body);
      expect(styleContains(paint(track), rail)).toBe(true);
      expect(styleContains(body, size)).toBe(true);
      expect(thumb.getAttribute('role')).toBe('slider');
      expect(thumb.getAttribute('aria-valuenow')).toBe('25');
      expect(body.getAttribute('role')).toBeNull();
      expect(body.getAttribute('tabindex')).toBeNull();
      expect(body.hasAttribute('data-pui-owned-decoration')).toBe(true);
      expect(body.getAttribute('aria-hidden')).toBe('true');
      expect(thumb.contains(slot)).toBe(true);
      expect((output.shadowRoot ?? output).textContent).toContain('25');
      thumb.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
      await settle();
      expect(styleContains(body, ring)).toBe(true);
      thumb.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
      await settle();
    }
    expect(changes).toEqual([]);
    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    thumb.getExposes().focusSelf();
    await settle();
    expect(thumb.getExposes().focusVisible.get()).toBe(true);
    for (const [profile, , , ring] of recipes) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(paint(thumb)).toBe(body);
      expect(styleContains(body, ring)).toBe(true);
      expect(styleContains(body, 'forced-colors-focus-outline')).toBe(true);
      expect(root.getExposes().value).toBe(value);
    }
    setElementProps(root, { value: 25, step: 5, orientation: 'vertical', styleProfile: 'luma' });
    await settle();
    expect(styleContains(paint(track), 'w-2')).toBe(true);
    expect(styleContains(body, 'h-6')).toBe(true);
    expect(styleContains(body, 'w-4')).toBe(true);
    expect(styleContains(body, 'w-6')).toBe(false);
    // Removing the local choice restores the still-current New York scope.
    setElementProps(root, { value: 25, step: 5, orientation: 'vertical' });
    await settle();
    expect(styleContains(paint(track), 'w-1.5')).toBe(true);
    expect(styleContains(body, 'size-4')).toBe(true);
    expect(styleContains(body, 'h-6')).toBe(false);
    expect(root.getExposes().value).toBe(value);
    thumb.getExposes().focusSelf();
    thumb.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    );
    await settle();
    expect(changes).toEqual([30]);
    expect(value.get()).toBe(25);
    if (owner) {
      setElementProps(owner, { disabled: true });
      await settle();
      expect(thumb.getAttribute('aria-disabled')).toBe('true');
      expect(root.getExposes().requestValue(50)).toBe(false);
      setElementProps(owner, { readOnly: true });
      await settle();
      expect(thumb.getAttribute('aria-readonly')).toBe('true');
      expect(root.getExposes().requestValue(50)).toBe(false);
    }
    root.remove();
    await settle();
    expect(slot.isConnected).toBe(false);
  });
}

it('keeps scalar pointer display preview distinct from controlled truth through an in-flight profile change', async () => {
  const root = element(sliderRoot, { value: 25, step: 5 });
  const track = element(sliderTrack);
  const thumb = element(sliderThumb);
  track.append(element(sliderIndicator), thumb);
  root.append(track);
  const scope = scoped(root, 'nova');
  await settle();
  // Fixture geometry drives the actual public AxisInput -> Track -> Root path.
  track.getBoundingClientRect = () => ({
    left: 10,
    top: 0,
    right: 210,
    bottom: 100,
    width: 200,
    height: 100,
    x: 10,
    y: 0,
    toJSON() {
      return {};
    },
  });
  const proposals: number[] = [];
  root.addEventListener('valueChange', (event) =>
    proposals.push((event as CustomEvent<{ value: number }>).detail.value)
  );
  thumb.dispatchEvent(pointer('pointerdown', 60));
  track.dispatchEvent(pointer('pointermove', 170));
  await settle();
  expect(root.getExposes().dragging.get()).toBe(true);
  expect(root.getExposes().value.get()).toBe(25);
  expect(root.getExposes().displayPercentage.get()).toBe(80);
  setElementProps(scope, { styleProfile: 'mira' });
  await settle();
  expect(root.getExposes().dragging.get()).toBe(true);
  expect(root.getExposes().value.get()).toBe(25);
  expect(thumb.getExposes().displayPercentage.get()).toBe(80);
  expect(thumb.getAttribute('aria-valuenow')).toBe('25');
  track.dispatchEvent(pointer('pointerup', 170));
  await settle();
  expect(proposals).toContain(80);
  expect(root.getExposes().dragging.get()).toBe(false);
  expect(root.getExposes().value.get()).toBe(25);
  expect(root.getExposes().displayPercentage.get()).toBe(25);
});
