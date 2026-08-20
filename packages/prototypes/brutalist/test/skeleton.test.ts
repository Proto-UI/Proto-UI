import { describe, expect, it } from 'vitest';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { BrutalistSkeletonRoot } from '../src/skeleton';

const BrutalistSkeletonElement = AdaptToWebComponent(BrutalistSkeletonRoot);

describe('prototypes/brutalist: skeleton', () => {
  it('owns the styled-only prototype directly without a Base Skeleton hook', () => {
    // T-BRUTALIST-SKELETON-0001-CASE-DIRECT-OWNERSHIP
    const host: RuntimeHost<Record<string, never>> = {
      prototypeName: 'x-brutalist-skeleton-ownership',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    executeWithHost(BrutalistSkeletonRoot, host);
    const asHooks = (BrutalistSkeletonRoot as unknown as { __asHooks?: Array<{ name: string }> })
      .__asHooks;

    expect(BrutalistSkeletonRoot.name).toBe('brutalist-skeleton-root');
    expect(asHooks ?? []).not.toContainEqual(expect.objectContaining({ name: 'as-skeleton-root' }));
  });

  it('inherits visual-only semantics without claiming consumer-owned size', async () => {
    // T-BRUTALIST-SKELETON-0001-CASE-VISUAL-ONLY
    const el = new BrutalistSkeletonElement();
    const interactiveChild = document.createElement('button');
    interactiveChild.textContent = 'must not project';
    el.appendChild(interactiveChild);
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.tabIndex).toBe(-1);
    expect(el.getExposes()).toEqual({});
    expect(el.childNodes).toHaveLength(0);
    for (const token of [
      'block',
      'rounded-none',
      'border-2',
      'border-foreground',
      'bg-lavender',
      'shadow-[2px_2px_0_0_var(--pui-foreground)]',
    ]) {
      expect(styleContains(el, token)).toBe(true);
    }
    const tokens = (el.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    expect(tokens.some((token) => /^(?:w|h|min-w|min-h|max-w|max-h)-/.test(token))).toBe(false);
    expect(tokens.some((token) => /(?:animate|motion|pulse|spin|bounce)/.test(token))).toBe(false);
    el.remove();
  });
});
