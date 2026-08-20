import { describe, expect, it } from 'vitest';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { BrutalistBadgeRoot } from '../src/badge';

const BrutalistBadgeElement = AdaptToWebComponent(BrutalistBadgeRoot);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
function updateProps(element: HTMLElement, next: Record<string, unknown>): void {
  setElementProps(element, next);
  (element as HTMLElement & { update?: () => void }).update?.();
}

describe('prototypes/brutalist: badge', () => {
  // T-BRUTALIST-BADGE-0001-CASE-1
  it('owns the passive styled-only prototype directly without a Base Badge hook', () => {
    const host: RuntimeHost<Record<string, never>> = {
      prototypeName: 'x-brutalist-badge-ownership',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    executeWithHost(BrutalistBadgeRoot, host);
    const asHooks = (BrutalistBadgeRoot as unknown as { __asHooks?: Array<{ name: string }> })
      .__asHooks;

    expect(BrutalistBadgeRoot.name).toBe('brutalist-badge-root');
    expect(asHooks ?? []).not.toContainEqual(expect.objectContaining({ name: 'as-badge-root' }));
  });

  // T-BRUTALIST-BADGE-0001-CASE-1
  it('is roleless and non-focusable with no interaction or status surface', async () => {
    const element = new BrutalistBadgeElement();
    document.body.appendChild(element);
    await flush();

    expect(element.hasAttribute('role')).toBe(false);
    expect(element.hasAttribute('aria-live')).toBe(false);
    expect(element.hasAttribute('aria-pressed')).toBe(false);
    expect(element.hasAttribute('aria-selected')).toBe(false);
    expect(element.tabIndex).toBe(-1);
    expect(element.getExposes()).toEqual({});

    element.remove();
  });

  // T-BRUTALIST-BADGE-0001-CASE-2
  it('pairs every native tone and restores accent after prop removal', async () => {
    const element = new BrutalistBadgeElement();
    document.body.appendChild(element);
    await flush();

    const pairs = {
      accent: ['bg-canary', 'text-canary-foreground'],
      info: ['bg-sky', 'text-sky-foreground'],
      danger: ['bg-coral', 'text-coral-foreground'],
    } as const;

    for (const [tone, tokens] of Object.entries(pairs)) {
      updateProps(element, { tone });
      await flush();
      for (const token of tokens) expect(styleContains(element, token)).toBe(true);
    }

    updateProps(element, {});
    await flush();
    expect(styleContains(element, 'bg-canary')).toBe(true);
    expect(styleContains(element, 'text-canary-foreground')).toBe(true);
    expect(styleContains(element, 'bg-coral')).toBe(false);

    element.remove();
  });

  // T-BRUTALIST-BADGE-0001-CASE-3
  it('uses outline as structural grammar rather than a public variant', async () => {
    const element = new BrutalistBadgeElement();
    document.body.appendChild(element);
    await flush();
    updateProps(element, { variant: 'outline' });
    await flush();

    expect(styleContains(element, 'rounded-none')).toBe(true);
    expect(styleContains(element, 'border-2')).toBe(true);
    expect(styleContains(element, 'border-foreground')).toBe(true);
    expect(styleContains(element, 'font-mono')).toBe(true);
    expect(styleContains(element, 'bg-background')).toBe(false);
    expect(styleContains(element, 'bg-canary')).toBe(true);

    element.remove();
  });
});
