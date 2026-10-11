import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../src/tabs';

type TabsRootElement = WebComponentAdapterElement<typeof tabsRoot>;
type TabsListElement = WebComponentAdapterElement<typeof tabsList>;
type TabsTriggerElement = WebComponentAdapterElement<typeof tabsTrigger>;
type TabsContentElement = WebComponentAdapterElement<typeof tabsContent>;

AdaptToWebComponent(tabsRoot);
AdaptToWebComponent(tabsList);
AdaptToWebComponent(tabsTrigger);
AdaptToWebComponent(tabsContent);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function createTabs(contentAFocusTarget?: HTMLElement) {
  const root = document.createElement(tabsRoot.name) as TabsRootElement;
  const list = document.createElement(tabsList.name) as TabsListElement;
  const triggerA = document.createElement(tabsTrigger.name) as TabsTriggerElement;
  const triggerB = document.createElement(tabsTrigger.name) as TabsTriggerElement;
  const contentA = document.createElement(tabsContent.name) as TabsContentElement;
  const contentB = document.createElement(tabsContent.name) as TabsContentElement;

  setElementProps(root, { defaultValue: 'a' });
  setElementProps(list, { a11yLabel: 'Sections' });
  setElementProps(triggerA, { value: 'a' });
  setElementProps(triggerB, { value: 'b' });
  setElementProps(contentA, { value: 'a', keepMounted: true });
  setElementProps(contentB, { value: 'b', keepMounted: true });
  triggerA.textContent = 'Alpha';
  triggerB.textContent = 'Beta';
  if (contentAFocusTarget) {
    contentA.appendChild(contentAFocusTarget);
  } else {
    contentA.textContent = 'Alpha panel';
  }
  contentB.textContent = 'Beta panel';

  list.append(triggerA, triggerB);
  root.append(list, contentA, contentB);
  document.body.appendChild(root);
  return { root, list, triggerA, triggerB, contentA, contentB };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/brutalist: tabs', () => {
  it('projects Root and List behavior with a square ruled strip', async () => {
    // T-BRUTALIST-TABS-0001-CASE-1
    const { root, list, triggerA, triggerB } = createTabs();
    await flush();

    expect(tabsRoot.name).toBe('brutalist-tabs-root');
    expect(tabsList.name).toBe('brutalist-tabs-list');
    expect(root.getExposes().value.get()).toBe('a');
    expect(list.getAttribute('role')).toBe('tablist');
    expect(list.getAttribute('aria-label')).toBe('Sections');
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    for (const token of ['flex', 'flex-col', 'gap-3', 'text-foreground']) {
      expect(styleContains(root, token)).toBe(true);
    }
    for (const token of [
      'inline-flex',
      'h-12',
      'items-center',
      'rounded-base',
      'border-2',
      'border-black',
      'bg-background',
      'p-1',
      'text-foreground',
    ]) {
      expect(styleContains(list, token)).toBe(true);
    }

    triggerA.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flush();
    expect(document.activeElement).toBe(triggerB);
    expect(root.getExposes().value.get()).toBe('b');
  });

  it('moves the selected color pair and border with selection', async () => {
    // T-BRUTALIST-TABS-0001-CASE-2
    const { root, triggerA, triggerB } = createTabs();
    await flush();

    expect(tabsTrigger.name).toBe('brutalist-tabs-trigger');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerA.hasAttribute('data-selected')).toBe(true);
    expect(triggerA.getAttribute('aria-selected')).toBe('true');
    for (const token of ['bg-main', 'text-main-foreground', 'border-black']) {
      expect(styleContains(triggerA, token)).toBe(true);
    }

    triggerB.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerA.getExposes().selected.get()).toBe(false);
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(triggerB.hasAttribute('data-selected')).toBe(true);
    expect(triggerB.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(triggerB, 'bg-main')).toBe(true);
    expect(styleContains(triggerA, 'bg-main')).toBe(false);
    expect(styleContains(triggerA, 'text-main-foreground')).toBe(false);
  });

  it('activates non-selected hover, press, focus-visible, and disabled rules', async () => {
    // T-BRUTALIST-TABS-0001-CASE-3
    const { root, triggerB } = createTabs();
    await flush();

    for (const token of [
      'rounded-base',
      'border-2',
      'border-transparent',
      'font-bold',
      'text-foreground',
    ]) {
      expect(styleContains(triggerB, token)).toBe(true);
    }

    triggerB.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(triggerB.getExposes().hovered.get()).toBe(true);
    expect(triggerB.hasAttribute('data-hovered')).toBe(true);
    // appearance + state uses legal default runtime evaluation. Independent
    // lowering-order tests still cover state-only selector generation.
    for (const token of ['bg-secondary-background', 'border-black']) {
      expect(styleContains(triggerB, token)).toBe(true);
    }

    triggerB.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(triggerB.getExposes().pressed.get()).toBe(true);
    expect(styleContains(triggerB, 'border-black')).toBe(true);
    expect(styleContains(triggerB, 'bg-secondary-background')).toBe(false);
    triggerB.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(triggerB, 'matches').mockReturnValue(true);
    triggerB.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(triggerB.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(triggerB, 'ring-2')).toBe(true);
    expect(styleContains(triggerB, 'ring-ring')).toBe(true);
    matchesSpy.mockRestore();

    setElementProps(triggerB, { value: 'b', disabled: true });
    await flush();
    triggerB.click();
    await flush();
    expect(triggerB.getExposes().disabled.get()).toBe(true);
    expect(triggerB.getAttribute('aria-disabled')).toBe('true');
    expect(root.getExposes().value.get()).toBe('a');
    expect(styleContains(triggerB, 'pointer-events-none')).toBe(true);
    expect(styleContains(triggerB, 'opacity-50')).toBe(true);
  });

  it('inverts current/hidden state across square retained panels', async () => {
    // T-BRUTALIST-TABS-0001-CASE-4
    const { triggerB, contentA, contentB } = createTabs();
    await flush();

    expect(tabsContent.name).toBe('brutalist-tabs-content');
    for (const token of ['block', 'w-full', 'min-h-28', 'p-4', 'text-sm', 'text-foreground']) {
      expect(styleContains(contentA, token)).toBe(true);
    }
    expect(styleContains(contentB, 'data-[hidden]:hidden')).toBe(true);
    expect(contentA.getExposes().current.get()).toBe(true);
    expect(contentA.getExposes().hidden.get()).toBe(false);
    expect(contentB.getExposes().current.get()).toBe(false);
    expect(contentB.getExposes().hidden.get()).toBe(true);
    expect(contentB.hasAttribute('hidden')).toBe(true);

    triggerB.click();
    await flush();
    expect(contentA.getExposes().current.get()).toBe(false);
    expect(contentA.getExposes().hidden.get()).toBe(true);
    expect(contentA.hasAttribute('hidden')).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(true);
    expect(contentB.getExposes().hidden.get()).toBe(false);
    expect(contentB.hasAttribute('hidden')).toBe(false);
    expect(contentB.textContent).toBe('Beta panel');
  });

  it('preserves the selected flat color pair and frame through press and release', async () => {
    // T-BRUTALIST-TABS-0001-CASE-5
    const { triggerA } = createTabs();
    await flush();

    triggerA.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerA.getExposes().pressed.get()).toBe(true);
    expect(triggerA.hasAttribute('data-selected')).toBe(true);
    expect(triggerA.hasAttribute('data-pressed')).toBe(true);
    expect(styleContains(triggerA, 'border-black')).toBe(true);
    expect(styleContains(triggerA, 'bg-main')).toBe(true);

    triggerA.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(triggerA.getExposes().pressed.get()).toBe(false);
    expect(triggerA.hasAttribute('data-selected')).toBe(true);
  });

  it('preserves native fallback-self focus indication and delegates descendant-first entry', async () => {
    // T-BRUTALIST-TABS-0001-CASE-6
    const fallbackTabs = createTabs();
    await flush();

    expect(fallbackTabs.contentA.tabIndex).toBe(0);
    expect('focusVisible' in fallbackTabs.contentA.getExposes()).toBe(false);
    expect(styleContains(fallbackTabs.contentA, 'outline-none')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fallbackTabs.contentA.focus();
    await flush();
    expect(document.activeElement).toBe(fallbackTabs.contentA);
    expect(fallbackTabs.contentA.hasAttribute('data-focus-visible')).toBe(false);
    expect(styleContains(fallbackTabs.contentA, 'outline-none')).toBe(false);

    fallbackTabs.root.remove();
    await flush();

    const descendant = document.createElement('button');
    descendant.textContent = 'Panel action';
    const delegatedTabs = createTabs(descendant);
    await flush();

    expect(delegatedTabs.contentA.tabIndex).toBe(-1);
    expect(styleContains(delegatedTabs.contentA, 'outline-none')).toBe(false);
    descendant.focus();
    await flush();
    expect(document.activeElement).toBe(descendant);
    expect(delegatedTabs.contentA.hasAttribute('data-focus-visible')).toBe(false);
  });
});
