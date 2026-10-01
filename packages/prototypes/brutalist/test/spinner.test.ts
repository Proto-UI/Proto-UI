import { describe, expect, it } from 'vitest';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { BrutalistSpinnerRoot } from '../src/spinner';

const BrutalistSpinnerElement = AdaptToWebComponent(BrutalistSpinnerRoot);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
function updateProps(element: HTMLElement, next: Record<string, unknown>): void {
  setElementProps(element, next);
  (element as HTMLElement & { update?: () => void }).update?.();
}

describe('prototypes/brutalist: spinner', () => {
  // T-BRUTALIST-SPINNER-0001-CASE-DIRECT-OWNERSHIP
  it('owns the visual-only prototype directly without a Base Spinner hook', () => {
    const host: RuntimeHost<Record<string, never>> = {
      prototypeName: 'x-brutalist-spinner-ownership',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    executeWithHost(BrutalistSpinnerRoot, host);
    const asHooks = (BrutalistSpinnerRoot as unknown as { __asHooks?: Array<{ name: string }> })
      .__asHooks;

    expect(BrutalistSpinnerRoot.name).toBe('brutalist-spinner-root');
    expect(asHooks ?? []).not.toContainEqual(expect.objectContaining({ name: 'as-spinner' }));
  });

  // T-BRUTALIST-SPINNER-0001-CASE-SEMANTIC-ABSENCE
  it('is aria-hidden, roleless, non-focusable, and contentless', async () => {
    const element = new BrutalistSpinnerElement();
    element.append('Loading');
    document.body.appendChild(element);
    await flush();

    expect(element.hasAttribute('role')).toBe(false);
    expect(element.hasAttribute('aria-live')).toBe(false);
    expect(element.hasAttribute('aria-busy')).toBe(false);
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.tabIndex).toBe(-1);
    expect(element.getExposes()).toEqual({});

    element.remove();
  });

  // T-BRUTALIST-SPINNER-0001-CASE-SIZE
  it('pairs every size and restores md after prop removal', async () => {
    const element = new BrutalistSpinnerElement();
    document.body.appendChild(element);
    await flush();

    const sizes = {
      sm: ['h-4', 'w-4'],
      md: ['h-6', 'w-6'],
      lg: ['h-8', 'w-8'],
    } as const;

    for (const [size, tokens] of Object.entries(sizes)) {
      updateProps(element, { size });
      await flush();
      for (const token of tokens) expect(styleContains(element, token)).toBe(true);
    }

    updateProps(element, {});
    await flush();
    expect(styleContains(element, 'h-6')).toBe(true);
    expect(styleContains(element, 'w-6')).toBe(true);
    expect(styleContains(element, 'h-8')).toBe(false);

    element.remove();
  });

  // T-BRUTALIST-SPINNER-0001-CASE-VISUAL
  it('projects the square open-edge ring grammar without fill or soft effects', async () => {
    const element = new BrutalistSpinnerElement();
    document.body.appendChild(element);
    await flush();

    expect(styleContains(element, 'rounded-none')).toBe(true);
    expect(styleContains(element, 'border-2')).toBe(true);
    expect(
      styleContains(element, 'border-[transparent_currentColor_currentColor_currentColor]')
    ).toBe(true);
    expect(styleContains(element, 'bg-transparent')).toBe(true);
    expect(styleContains(element, 'animate-spin')).toBe(true);
    expect(styleContains(element, 'rounded-full')).toBe(false);
    expect(styleContains(element, 'shadow-')).toBe(false);
    expect(styleContains(element, 'blur')).toBe(false);

    element.remove();
  });

  // T-BRUTALIST-SPINNER-0001-CASE-REDUCED-MOTION
  it('keeps the open edge as the reduced-motion fallback while motion is allowed by default', async () => {
    const element = new BrutalistSpinnerElement();
    document.body.appendChild(element);
    await flush();

    // Rotation stays on by default; the open edge is structural, not conditional.
    expect(styleContains(element, 'animate-spin')).toBe(true);
    expect(
      styleContains(element, 'border-[transparent_currentColor_currentColor_currentColor]')
    ).toBe(true);

    element.remove();
  });
});
