import { describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../src/tabs';

AdaptToWebComponent(tabsRoot as any);
AdaptToWebComponent(tabsList as any);
AdaptToWebComponent(tabsTrigger as any);
AdaptToWebComponent(tabsContent as any);

describe('prototypes/shadcn: tabs', () => {
  it('runs as a compound tabs family with trigger selection and content switching', async () => {
    const root = document.createElement('shadcn-tabs-root') as any;
    const list = document.createElement('shadcn-tabs-list') as any;
    const triggerA = document.createElement('shadcn-tabs-trigger') as any;
    const triggerB = document.createElement('shadcn-tabs-trigger') as any;
    const contentA = document.createElement('shadcn-tabs-content') as any;
    const contentB = document.createElement('shadcn-tabs-content') as any;

    setElementProps(root, { defaultValue: 'a' });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });
    setElementProps(contentA, { value: 'a' });
    setElementProps(contentB, { value: 'b' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    root.appendChild(list);
    root.appendChild(contentA);
    root.appendChild(contentB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(contentA.getExposes().current.get()).toBe(true);
    expect(triggerA.hasAttribute('data-selected')).toBe(true);
    expect(triggerA.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(triggerA, 'data-[selected]:bg-background')).toBe(true);
    expect(styleContains(contentA, 'block')).toBe(true);
    expect(contentB.hasAttribute('hidden')).toBe(true);

    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(true);
    expect(triggerB.hasAttribute('data-selected')).toBe(true);
    expect(triggerB.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(triggerB, 'data-[selected]:bg-background')).toBe(true);
    expect(contentA.hasAttribute('hidden')).toBe(true);

    triggerA.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(contentA.getExposes().current.get()).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(false);
    expect(contentA.getExposes().hidden.get()).toBe(false);
    expect(contentB.getExposes().hidden.get()).toBe(true);
    expect(contentA.hasAttribute('hidden')).toBe(false);
    expect(contentB.hasAttribute('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('applies focus-visible ring styles while keeping trigger shadow tokens', async () => {
    const root = document.createElement('shadcn-tabs-root') as any;
    const list = document.createElement('shadcn-tabs-list') as any;
    const trigger = document.createElement('shadcn-tabs-trigger') as any;

    setElementProps(root, { defaultValue: 'a' });
    setElementProps(trigger, { value: 'a' });

    list.appendChild(trigger);
    root.appendChild(list);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(trigger, 'ring-3')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await Promise.resolve();

    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-3')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-ring/50')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:shadow-xs')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('does not leave a trigger pressed after pointer activity outside the tabs trigger', async () => {
    const root = document.createElement('shadcn-tabs-root') as any;
    const list = document.createElement('shadcn-tabs-list') as any;
    const triggerA = document.createElement('shadcn-tabs-trigger') as any;
    const triggerB = document.createElement('shadcn-tabs-trigger') as any;
    const outside = document.createElement('button');

    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'horizontal',
      activationMode: 'manual',
    });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    root.appendChild(list);
    document.body.append(root, outside);

    await Promise.resolve();
    await Promise.resolve();

    triggerA.focus();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    outside.focus();
    outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(triggerA.getExposes().pressed.get()).toBe(false);
    expect(triggerA.hasAttribute('data-pressed')).toBe(false);

    triggerA.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(triggerB);
    expect(triggerA.getExposes().pressed.get()).toBe(false);
    expect(triggerB.getExposes().pressed.get()).toBe(false);

    root.remove();
    outside.remove();
    await Promise.resolve();
  });
});
