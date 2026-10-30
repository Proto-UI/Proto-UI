import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsRoot, tabsList, tabsTrigger, tabsContent, tabsIndicator } from '../src/tabs';
import { styleScope, type ShadcnStyleId } from '../src/style-scope';
import { styleContains } from '../../test-utils/style';

const Scope = AdaptToWebComponent(styleScope);
const Root = AdaptToWebComponent(tabsRoot);
const List = AdaptToWebComponent(tabsList);
const Trigger = AdaptToWebComponent(tabsTrigger);
const Content = AdaptToWebComponent(tabsContent);
const Indicator = AdaptToWebComponent(tabsIndicator);

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
function make(
  style: ShadcnStyleId = 'nova',
  options: {
    orientation?: 'horizontal' | 'vertical';
    variant?: 'default' | 'line';
    value?: string;
  } = {}
) {
  const scope = new Scope();
  const root = new Root();
  const list = new List();
  const a = new Trigger();
  const b = new Trigger();
  const content = new Content();
  const indicator = new Indicator();
  setElementProps(scope, { styleProfile: style });
  setElementProps(root, {
    defaultValue: 'a',
    orientation: options.orientation ?? 'horizontal',
    activationMode: 'manual',
    ...(options.value === undefined ? {} : { value: options.value }),
  });
  setElementProps(list, { variant: options.variant ?? 'default' });
  setElementProps(a, { value: 'a' });
  setElementProps(b, { value: 'b' });
  setElementProps(content, { value: 'a', keepMounted: true });
  a.textContent = 'Account';
  b.textContent = 'Password';
  content.textContent = 'Panel';
  list.append(a, b);
  root.append(list, indicator, content);
  scope.append(root);
  document.body.append(scope);
  return { scope, root, list, a, b, content, indicator };
}

// The adapter's owned leaf is a test observation, never queried by the Prototype.
function decoration(host: HTMLElement) {
  const leaf = host.querySelector<HTMLElement>('[data-pui-owned-decoration]');
  if (!leaf) throw new Error('Tabs Trigger did not bind its owned decoration');
  return leaf;
}

afterEach(async () => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  await flush();
});

describe('Shadcn Tabs draft source projection', () => {
  it('keeps Indicator passive while exposing accepted selection, active focus and orientation', async () => {
    const { root, a, b, indicator } = make('nova', { orientation: 'vertical' });
    await flush();
    const exposes = indicator.getExposes();
    const selected = exposes.value;
    expect(selected.get()).toBe('a');
    expect(exposes.orientation.get()).toBe('vertical');
    expect(indicator.getAttribute('role')).toBeNull();
    expect(Object.hasOwn(exposes, 'focusSelf')).toBe(false);
    expect(Object.hasOwn(exposes, 'valueChange')).toBe(false);

    a.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(b);
    expect(root.getExposes().value.get()).toBe('a');
    expect(selected.get()).toBe('a');
    expect(exposes.activeValue.get()).toBe('b');
    b.click();
    await flush();
    expect(indicator.getExposes().value).toBe(selected);
    expect(selected.get()).toBe('b');
  });

  for (const orientation of ['horizontal', 'vertical'] as const)
    it(`updates the owned line indication without replacing leaves or caller content (${orientation})`, async () => {
      const { list, a, b } = make('nova', { orientation });
      await flush();
      const first = decoration(a);
      const second = decoration(b);
      const text = b.firstChild;
      expect(styleContains(first, 'opacity-0')).toBe(true);

      setElementProps(list, { variant: 'line' });
      await flush();
      expect(styleContains(list, 'bg-transparent')).toBe(true);
      expect(styleContains(list, 'gap-1')).toBe(true);
      expect(styleContains(a, 'bg-transparent')).toBe(true);
      expect(styleContains(a, 'bg-background')).toBe(false);
      expect(styleContains(a, 'shadow-sm')).toBe(false);
      expect(styleContains(first, 'opacity-100')).toBe(true);
      expect(styleContains(second, 'opacity-0')).toBe(true);
      expect(styleContains(first, orientation === 'horizontal' ? 'h-0.5' : 'w-0.5')).toBe(true);
      expect(
        styleContains(first, orientation === 'horizontal' ? 'bottom-[-5px]' : '-right-1')
      ).toBe(true);
      expect(first.getAttribute('aria-hidden')).toBe('true');

      b.click();
      await flush();
      expect(decoration(a)).toBe(first);
      expect(decoration(b)).toBe(second);
      expect(b.firstChild).toBe(text);
      expect(styleContains(first, 'opacity-100')).toBe(false);
      expect(styleContains(second, 'opacity-100')).toBe(true);

      setElementProps(list, { variant: 'default' });
      await flush();
      expect(styleContains(second, 'opacity-100')).toBe(false);
      expect(styleContains(second, 'opacity-0')).toBe(true);
      expect(styleContains(b, 'bg-background')).toBe(true);
      expect(styleContains(b, 'bg-transparent')).toBe(false);
      expect(styleContains(b, 'shadow-sm')).toBe(true);
    });

  it('withdraws dark active fills in line mode and restores them in default mode', async () => {
    document.documentElement.dataset.theme = 'dark';
    const { list, a } = make('nova');
    await flush();
    expect(styleContains(a, 'bg-input/30')).toBe(true);
    setElementProps(list, { variant: 'line' });
    await flush();
    expect(styleContains(a, 'bg-input/30')).toBe(false);
    expect(styleContains(a, 'bg-transparent')).toBe(true);
    expect(styleContains(a, 'border-transparent')).toBe(true);
    setElementProps(list, { variant: 'default' });
    await flush();
    expect(styleContains(a, 'bg-input/30')).toBe(true);
    expect(styleContains(a, 'border-input')).toBe(true);
  });

  // Independent distinctions from the fixed style-*.css / New York sources.
  // Each choice runs through the real style scope and Base selection protocol.
  const recipes = [
    ['vega', 'h-9', 'px-2', 'text-sm', true],
    ['nova', 'h-8', 'px-1.5', 'text-sm', true],
    ['maia', 'h-9', 'rounded-xl', 'text-sm', false],
    ['lyra', 'h-8', 'rounded-none', 'leading-relaxed', false],
    ['mira', 'h-8', 'text-xs', 'leading-relaxed', false],
    ['luma', 'h-9', 'rounded-full', 'text-sm', false],
    ['sera', 'h-10', 'tracking-wider', 'text-sm', false],
    ['rhea', 'h-8', 'rounded-2xl', 'text-sm', false],
    ['new-york-v4', 'h-9', 'px-2', null, true],
  ] as const;
  for (const [id, height, triggerToken, contentToken, shadow] of recipes)
    it(`retains the source-distinct default and line paint and Base state for ${id}`, async () => {
      const { scope, root, list, a, b, content, indicator } = make(id);
      await flush();
      expect(styleContains(list, height)).toBe(true);
      expect(styleContains(a, triggerToken)).toBe(true);
      expect(styleContains(a, 'shadow-sm')).toBe(shadow);
      if (contentToken) expect(styleContains(content, contentToken)).toBe(true);
      expect(styleContains(list, 'rounded-lg')).toBe(
        id === 'vega' || id === 'nova' || id === 'mira' || id === 'new-york-v4'
      );
      b.click();
      b.focus();
      await flush();
      const value = root.getExposes().value;
      const selected = b.getExposes().selected;
      const indicatorValue = indicator.getExposes().value;
      const firstChild = b.firstChild;
      const text = Array.from(b.childNodes).find(
        (node): node is Text => node.nodeType === Node.TEXT_NODE && node.textContent === 'Password'
      );
      const leaf = decoration(b);
      const input = document.createElement('input');
      input.value = 'retained';
      content.append(input);
      input.setSelectionRange(1, 5);
      const range = document.createRange();
      if (!text) throw new Error('Missing caller text');
      range.setStart(text, 1);
      range.setEnd(text, 4);
      const selection = document.getSelection();
      if (!selection) throw new Error('Missing document selection');
      selection.removeAllRanges();
      selection.addRange(range);

      setElementProps(scope, { styleProfile: id === 'nova' ? 'sera' : 'nova' });
      setElementProps(list, { variant: 'line' });
      await flush();
      expect(root.getExposes().value).toBe(value);
      expect(value.get()).toBe('b');
      expect(b.getExposes().selected).toBe(selected);
      expect(selected.get()).toBe(true);
      expect(indicator.getExposes().value).toBe(indicatorValue);
      expect(indicatorValue.get()).toBe('b');
      expect(document.activeElement).toBe(b);
      expect(b.firstChild).toBe(firstChild);
      expect(text.parentNode).toBe(b);
      expect(decoration(b)).toBe(leaf);
      expect(input.value).toBe('retained');
      expect(input.selectionStart).toBe(1);
      expect(input.selectionEnd).toBe(5);
      expect(selection.anchorNode).toBe(text);
      expect(selection.getRangeAt(0).startOffset).toBe(1);
      expect(selection.getRangeAt(0).endOffset).toBe(4);
      expect(styleContains(leaf, 'opacity-100')).toBe(true);
    });

  it('keeps controlled refusal and disabled requests out of line selection paint', async () => {
    const { root, a, b, indicator } = make('maia', { variant: 'line', value: 'a' });
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(root.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().activeValue.get()).toBe('b');
    expect(styleContains(decoration(a), 'opacity-100')).toBe(true);
    expect(styleContains(decoration(b), 'opacity-100')).toBe(false);
    setElementProps(b, { value: 'b', disabled: true });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(root.getExposes().value.get()).toBe('a');
    expect(styleContains(decoration(a), 'opacity-100')).toBe(true);
  });

  it('resets private List variant at a nested Root instead of leaking outer line paint', async () => {
    const outer = make('nova', { variant: 'line' });
    await flush();
    const nested = new Root();
    const trigger = new Trigger();
    setElementProps(nested, { defaultValue: 'nested' });
    setElementProps(trigger, { value: 'nested' });
    trigger.textContent = 'Nested';
    nested.append(trigger);
    outer.list.append(nested);
    await flush();
    expect(outer.root.getExposes().value.get()).toBe('a');
    expect(nested.getExposes().value.get()).toBe('nested');
    expect(styleContains(decoration(outer.a), 'opacity-100')).toBe(true);
    expect(styleContains(decoration(trigger), 'opacity-100')).toBe(false);
  });

  it('keeps Proto underline separate and rejects unknown raw styles rather than falling back', async () => {
    const { list, a } = make('new-york-v4');
    await flush();
    setElementProps(list, { appearance: 'underline' });
    setElementProps(a, { value: 'a', appearance: 'underline' });
    await flush();
    expect(styleContains(list, 'gap-6')).toBe(true);
    expect(styleContains(a, 'border-b-2')).toBe(true);
    expect(styleContains(decoration(a), 'opacity-100')).toBe(false);
    expect(() => setElementProps(a, { value: 'a', styleProfile: 'future' })).toThrow(
      'Unknown style'
    );
  });
});
