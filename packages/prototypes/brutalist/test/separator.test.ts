import { afterEach, describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { BrutalistSeparatorRoot } from '../src/separator';

AdaptToWebComponent(BrutalistSeparatorRoot);

async function settle() {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

afterEach(() => document.body.replaceChildren());

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

  it.each([true, false])(
    'discards authored interactive descendants in decorative=%s mode',
    async (decorative) => {
      // P-BASE-SEPARATOR-CONTENTLESS, P-BASE-SEPARATOR-NO-INTERACTION
      const el = document.createElement('brutalist-separator-root');
      const child = document.createElement('button');
      child.textContent = 'Must not become hidden interactive content';
      setElementProps(el, { decorative });
      el.appendChild(child);
      document.body.appendChild(el);
      await settle();

      expect(el.childNodes).toHaveLength(0);
      expect(child.isConnected).toBe(false);
      expect(el.contains(child)).toBe(false);
      expect(el.getAttribute('aria-hidden')).toBe(String(decorative));
      expect(el.hasAttribute('tabindex')).toBe(false);
      expect(el.hasAttribute('data-pui-a11y-actions')).toBe(false);

      // Neither live mode changes nor reconnecting the same author-supplied
      // button may restore a hidden descendant or a second interaction owner.
      for (const nextDecorative of [!decorative, decorative]) {
        setElementProps(el, { decorative: nextDecorative, orientation: 'vertical' });
        await settle();
        expect(el.childNodes).toHaveLength(0);
        expect(el.getAttribute('aria-hidden')).toBe(String(nextDecorative));
        expect(el.getAttribute('role')).toBe(nextDecorative ? null : 'separator');
        expect(el.getAttribute('aria-orientation')).toBe(nextDecorative ? null : 'vertical');
      }

      for (let cycle = 0; cycle < 2; cycle += 1) {
        el.remove();
        await settle();
        el.appendChild(child);
        document.body.appendChild(el);
        await settle();
        expect(el.childNodes).toHaveLength(0);
        expect(child.isConnected).toBe(false);
        expect(el.hasAttribute('tabindex')).toBe(false);
      }
    }
  );
});
