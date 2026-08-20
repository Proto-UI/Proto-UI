import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  BrutalistTooltipContent,
  BrutalistTooltipRoot,
  BrutalistTooltipTrigger,
} from '../src/tooltip';

const TooltipRootElement = AdaptToWebComponent(BrutalistTooltipRoot);
const TooltipTriggerElement = AdaptToWebComponent(BrutalistTooltipTrigger);
const TooltipContentElement = AdaptToWebComponent(BrutalistTooltipContent);

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('prototypes/brutalist: tooltip', () => {
  it('inherits the current Base interaction and accessibility protocol with a visual-only delta', async () => {
    vi.useFakeTimers();
    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    const content = new TooltipContentElement();
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    expect(root.getExposes().open.get()).toBe(false);

    trigger.dispatchEvent(new Event('pointerenter'));
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(styleContains(content, 'rounded-none')).toBe(true);
    expect(styleContains(content, 'border-2')).toBe(true);
    expect(styleContains(content, 'bg-foreground')).toBe(true);
    expect(styleContains(content, 'font-mono')).toBe(true);
    expect(styleContains(content, 'shadow-[4px_4px_0_0_var(--pui-foreground)]')).toBe(true);

    trigger.dispatchEvent(new Event('pointerleave'));
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });
});
