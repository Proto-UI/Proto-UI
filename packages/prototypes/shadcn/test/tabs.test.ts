import { describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../src/tabs';

AdaptToWebComponent(tabsRoot as any);
AdaptToWebComponent(tabsList as any);
AdaptToWebComponent(tabsTrigger as any);
AdaptToWebComponent(tabsContent as any);

describe('prototypes/shadcn: tabs', () => {
  it('keeps every Tabs anatomy part as a named direct entry', () => {
    expect(tabsRoot.name).toBe('shadcn-tabs-root');
    expect(tabsList.name).toBe('shadcn-tabs-list');
    expect(tabsTrigger.name).toBe('shadcn-tabs-trigger');
    expect(tabsContent.name).toBe('shadcn-tabs-content');
  });

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

    expect(styleContains(root, 'flex')).toBe(true);
    expect(styleContains(root, 'flex-col')).toBe(true);
    expect(styleContains(root, 'gap-2')).toBe(true);
    expect(styleContains(root, 'gap-3')).toBe(false);
    expect(styleContains(root, 'text-foreground')).toBe(false);

    expect(styleContains(list, 'inline-flex')).toBe(true);
    expect(styleContains(list, 'w-fit')).toBe(true);
    expect(styleContains(list, 'h-9')).toBe(true);
    expect(styleContains(list, 'justify-center')).toBe(true);
    expect(styleContains(list, 'rounded-lg')).toBe(true);
    expect(styleContains(list, 'p-[3px]')).toBe(true);
    expect(styleContains(list, 'bg-muted')).toBe(true);
    expect(styleContains(list, 'border')).toBe(false);
    expect(styleContains(list, 'shadow-xs')).toBe(false);

    expect(styleContains(triggerA, 'relative')).toBe(true);
    expect(styleContains(triggerA, 'h-[calc(100%_-_1px)]')).toBe(true);
    expect(styleContains(triggerA, 'flex-1')).toBe(true);
    expect(styleContains(triggerA, 'gap-1.5')).toBe(true);
    expect(styleContains(triggerA, 'rounded-md')).toBe(true);
    expect(styleContains(triggerA, 'px-2')).toBe(true);
    expect(styleContains(triggerA, 'py-1')).toBe(true);
    expect(styleContains(triggerA, 'text-foreground/60')).toBe(true);
    expect(styleContains(triggerA, 'data-[selected]:bg-background')).toBe(true);
    expect(styleContains(triggerA, 'data-[selected]:text-foreground')).toBe(true);
    expect(styleContains(triggerA, 'data-[selected]:shadow-sm')).toBe(true);

    expect(styleContains(contentA, 'flex-1')).toBe(true);
    expect(styleContains(contentA, 'outline-none')).toBe(true);
    expect(styleContains(contentA, 'min-h-28')).toBe(false);
    expect(styleContains(contentA, 'border')).toBe(false);
    expect(styleContains(contentA, 'p-4')).toBe(false);
    expect(styleContains(contentA, 'shadow-xs')).toBe(false);

    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(contentA.getExposes().current.get()).toBe(true);
    expect(triggerA.hasAttribute('data-selected')).toBe(true);
    expect(triggerA.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(triggerA, 'data-[selected]:bg-background')).toBe(true);
    expect(styleContains(contentA, 'flex-1')).toBe(true);
    expect(styleContains(contentB, 'data-[hidden]:hidden')).toBe(false);
    expect(contentB.hasAttribute('hidden')).toBe(false);

    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(true);
    expect(triggerB.hasAttribute('data-selected')).toBe(true);
    expect(triggerB.getAttribute('aria-selected')).toBe('true');
    expect(styleContains(triggerB, 'data-[selected]:bg-background')).toBe(true);
    expect(styleContains(contentB, 'flex-1')).toBe(true);
    expect(styleContains(contentA, 'data-[hidden]:hidden')).toBe(false);
    expect(contentA.hasAttribute('hidden')).toBe(true);

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
    const matchesSpy = vi.spyOn(trigger, 'matches').mockReturnValue(true);
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await Promise.resolve();

    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-3')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-ring/50')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:border-ring')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:outline-1')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:outline-ring')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-2')).toBe(false);
    expect(styleContains(trigger, 'data-[focus-visible]:shadow-xs')).toBe(false);

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
