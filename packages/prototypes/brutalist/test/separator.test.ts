import { describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { BrutalistSeparatorRoot } from '../src/separator';

AdaptToWebComponent(BrutalistSeparatorRoot);

describe('prototypes/brutalist: separator', () => {
  it('inherits decorative defaults and projects horizontal Brutalist geometry', async () => {
    // T-BRUTALIST-SEPARATOR-0001-CASE-DEFAULTS
    const el = document.createElement('brutalist-separator-root');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.getAttribute('data-orientation')).toBe('horizontal');
    for (const token of [
      'block',
      'shrink-0',
      'bg-foreground',
      'data-[orientation=horizontal]:h-0.5',
      'data-[orientation=horizontal]:w-full',
      'data-[orientation=vertical]:h-full',
      'data-[orientation=vertical]:w-0.5',
    ]) {
      expect(styleContains(el, token)).toBe(true);
    }
    for (const token of ['h-0.5', 'w-full', 'h-full', 'h-12', 'w-0.5']) {
      expect(styleContains(el, token)).toBe(false);
    }
    el.remove();
  });

  it('inherits dynamic semantic state and switches to vertical geometry', async () => {
    // T-BRUTALIST-SEPARATOR-0001-CASE-DYNAMIC-SEMANTICS
    const el = document.createElement('brutalist-separator-root');
    document.body.appendChild(el);
    await Promise.resolve();

    setElementProps(el, { decorative: false, orientation: 'vertical' });
    await Promise.resolve();
    await Promise.resolve();
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.getAttribute('data-orientation')).toBe('vertical');
    for (const token of [
      'data-[orientation=horizontal]:h-0.5',
      'data-[orientation=horizontal]:w-full',
      'data-[orientation=vertical]:h-full',
      'data-[orientation=vertical]:w-0.5',
    ]) {
      expect(styleContains(el, token)).toBe(true);
    }
    for (const token of ['h-0.5', 'w-full', 'h-full', 'h-12', 'w-0.5']) {
      expect(styleContains(el, token)).toBe(false);
    }
    el.remove();
  });
});
