import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { selectContent, selectItem, selectRoot, selectTrigger, selectValue } from '../src/select';

AdaptToWebComponent(selectRoot as any);
AdaptToWebComponent(selectTrigger as any);
AdaptToWebComponent(selectValue as any);
AdaptToWebComponent(selectContent as any);
AdaptToWebComponent(selectItem as any);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

function createSelect(options?: {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  content?: Record<string, unknown>;
}) {
  const root = document.createElement('shadcn-select-root') as any;
  const trigger = document.createElement('shadcn-select-trigger') as any;
  const value = document.createElement('shadcn-select-value') as any;
  const content = document.createElement('shadcn-select-content') as any;
  const alpha = document.createElement('shadcn-select-item') as any;
  const beta = document.createElement('shadcn-select-item') as any;
  setElementProps(root, options?.root ?? {});
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(value, { placeholder: 'Select a framework' });
  setElementProps(content, options?.content ?? {});
  setElementProps(alpha, { value: 'alpha', textValue: 'Alpha' });
  setElementProps(beta, { value: 'beta', textValue: 'Beta' });
  alpha.textContent = 'Alpha';
  beta.textContent = 'Beta';
  trigger.appendChild(value);
  content.append(alpha, beta);
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, value, content, alpha, beta };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/shadcn: select', () => {
  it('keeps every Select anatomy part as a named direct entry', () => {
    expect(selectRoot.name).toBe('shadcn-select-root');
    expect(selectTrigger.name).toBe('shadcn-select-trigger');
    expect(selectValue.name).toBe('shadcn-select-value');
    expect(selectContent.name).toBe('shadcn-select-content');
    expect(selectItem.name).toBe('shadcn-select-item');
  });

  it('composes the official five-part API with shadcn Trigger, Content, and Item styling', async () => {
    vi.useFakeTimers();
    const { trigger, value, content, alpha } = createSelect();
    await settle();

    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.querySelector('svg')?.querySelector('path')?.getAttribute('d')).toBe(
      'm6 9 6 6 6-6'
    );
    expect(styleContains(trigger, 'rounded-md')).toBe(true);
    expect(styleContains(trigger, 'border-input')).toBe(true);
    expect(styleContains(trigger, 'h-9')).toBe(true);
    expect(styleContains(trigger, 'justify-between')).toBe(true);
    expect(trigger.hasAttribute('data-placeholder')).toBe(true);
    expect(value.textContent).toBe('Select a framework');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    trigger.click();
    await settle();
    expect(styleContains(content, 'bg-popover')).toBe(true);
    expect(styleContains(content, 'rounded-md')).toBe(true);
    expect(styleContains(content, 'w-[var(--proto-ui-anchor-width)]')).toBe(true);
    expect(styleContains(content, 'min-w-[var(--proto-ui-anchor-width)]')).toBe(true);
    expect(styleContains(alpha, 'rounded-sm')).toBe(true);
    expect(styleContains(alpha, 'justify-between')).toBe(true);
    expect(alpha.querySelector('svg')).toBeNull();
    expect(alpha.lastElementChild?.tagName).toBe('SPAN');
  });

  it('projects one-pixel press feedback from inherited state through the Adapter', async () => {
    vi.useFakeTimers();
    const { trigger } = createSelect();
    await settle();

    expect(trigger.getExposes().pressed.get()).toBe(false);
    expect(styleContains(trigger, 'data-[pressed]:translate-y-px')).toBe(true);
    expect(styleContains(trigger, 'translate-y-px')).toBe(false);

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().pressed.get()).toBe(true);
    expect(trigger.hasAttribute('data-pressed')).toBe(true);

    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().pressed.get()).toBe(false);
    expect(trigger.hasAttribute('data-pressed')).toBe(false);
  });

  it('inherits keyboard selection behavior and selected indicator facts from Base', async () => {
    vi.useFakeTimers();
    const { root, trigger, value, content, alpha, beta } = createSelect({
      root: { defaultValue: 'alpha' },
      content: { position: 'popper' },
    });
    await settle();
    expect(alpha.hasAttribute('data-selected')).toBe(true);
    expect(alpha.querySelector('svg')).not.toBeNull();
    expect(alpha.lastElementChild?.querySelector('svg')).not.toBeNull();
    expect(alpha.querySelector('svg')?.querySelector('path')?.getAttribute('d')).toBe(
      'm20 6-11 11-5-5'
    );
    expect(beta.querySelector('svg')).toBeNull();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(styleContains(content, 'w-[var(--proto-ui-anchor-width)]')).toBe(true);
    expect(document.activeElement).toBe(alpha);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(beta);
    beta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(value.textContent).toBe('Beta');
    expect(beta.hasAttribute('data-selected')).toBe(true);
    expect(beta.querySelector('svg')).not.toBeNull();
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('accepts official size and position props while retaining shadcn transition presence', async () => {
    vi.useFakeTimers();
    const { root, trigger, content, alpha } = createSelect({
      trigger: { size: 'sm' },
      content: { position: 'item-aligned' },
    });
    await settle();
    expect(styleContains(trigger, 'h-8')).toBe(true);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.parentElement).toBe(document.body);
    expect(styleContains(content, 'w-[var(--proto-ui-anchor-width)]')).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(styleContains(content, 'animate-in')).toBe(true);
    content.getExposes().controls.complete();
    await flush();

    alpha.click();
    await settle();
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(styleContains(content, 'animate-out')).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });
});
