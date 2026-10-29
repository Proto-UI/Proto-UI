import { describe, expect, it } from 'vitest';
import {
  linkSurfaceLayout,
  linkSurfaceProps,
  linkTextProps,
  sidebarTextSurfaceStyle,
  readingTocTextSurfaceStyle,
} from './site-link-recipes';
const idle = { hovered: false, pressed: false, focusVisible: false, current: false, inView: false };
describe('consumer navigation density preserves native selection and family identity', () => {
  for (const family of ['shadcn', 'brutalist'] as const)
    for (const appearance of ['sidebar', 'toc'] as const) {
      it(`${family}/${appearance} shares the responsive geometry without changing its family paint`, () => {
        expect(linkSurfaceLayout(family, appearance, 'minimal')).toMatchObject({
          minHeight: 'var(--site-navigation-row-height, 2rem)',
          padding: appearance === 'sidebar' ? '0.375rem 0.5rem' : '0.25rem 0.5rem',
        });
        expect(linkTextProps(appearance, idle, family)).toMatchObject({
          size: 'sm',
          weight: family === 'shadcn' ? 'normal' : 'medium',
        });
        expect(linkTextProps(appearance, { ...idle, current: true }, family).weight).toBe(
          family === 'shadcn' ? 'medium' : 'semibold'
        );
        expect(
          linkSurfaceProps(family, appearance, 'minimal', { ...idle, current: true }).variant
        ).toBe(appearance === 'toc' ? 'transparent' : 'accent');
      });
    }
  it('uses only a quiet foreground cue for visible non-current TOC sections', () => {
    const visible = { ...idle, inView: true };
    expect(linkTextProps('toc', idle, 'shadcn').tone).toBe('muted');
    expect(linkTextProps('toc', visible, 'shadcn')).toMatchObject({
      tone: 'inherit',
      weight: 'normal',
    });
    expect(linkSurfaceProps('shadcn', 'toc', 'minimal', visible)).toMatchObject({
      variant: 'transparent',
      current: false,
    });
    expect(linkSurfaceProps('shadcn', 'toc', 'minimal', visible)).not.toHaveProperty('inView');
  });
});

for (const appearance of ['brand', 'nav'] as const) {
  it(`projects Brutalist ${appearance} through public Surface/Text while preserving quiet Shadcn`, () => {
    expect(linkSurfaceProps('brutalist', appearance, 'minimal')).toMatchObject({
      variant: 'secondary',
      border: 'all',
      elevation: 'raised',
      radius: 'default',
    });
    expect(linkSurfaceLayout('brutalist', appearance, 'minimal')).toMatchObject({
      padding: '0.5rem 0.75rem',
      marginRight: '0.25rem',
      marginBottom: '0.25rem',
    });
    const facts = { ...idle, hovered: true, pressed: true, focusVisible: true };
    expect(linkSurfaceProps('brutalist', appearance, 'minimal', facts)).toMatchObject({
      hovered: true,
      pressed: true,
      focusVisible: true,
    });
    expect(linkTextProps(appearance, facts, 'brutalist').decoration).toBe(
      appearance === 'nav' ? 'underline' : 'none'
    );
    expect(linkSurfaceProps('shadcn', appearance, 'minimal')).toMatchObject({
      variant: 'transparent',
      border: 'none',
      elevation: 'none',
    });
  });
}

it('keeps Brutalist navigation inset and size stable when a structural border appears', () => {
  for (const appearance of ['sidebar'] as const) {
    expect(linkSurfaceProps('brutalist', appearance, 'minimal', idle).border).toBe('none');
    for (const facts of [
      { ...idle, hovered: true },
      { ...idle, current: true },
    ]) {
      expect(linkSurfaceProps('brutalist', appearance, 'minimal', facts)).toMatchObject({
        border: 'all',
        elevation: 'none',
      });
      expect(linkSurfaceLayout('brutalist', appearance, 'minimal', facts)).toMatchObject({
        minHeight: 'var(--site-navigation-row-height, 2rem)',
        padding: 'calc(0.375rem - 2px) calc(0.5rem - 2px)',
      });
    }
  }
});

for (const family of ['shadcn', 'brutalist'] as const) {
  it(`${family} TOC reserves background for the shared range without losing current text or focus`, () => {
    for (const current of [false, true])
      for (const hovered of [false, true])
        for (const focusVisible of [false, true]) {
          const facts = { ...idle, current, hovered, focusVisible, pressed: true, inView: true };
          expect(linkSurfaceProps(family, 'toc', 'minimal', facts)).toMatchObject({
            variant: 'transparent',
            border: 'none',
            elevation: 'none',
            current: false,
            hovered: false,
            focusVisible,
            pressed: true,
          });
          expect(linkSurfaceLayout(family, 'toc', 'minimal', facts)).toEqual(
            linkSurfaceLayout(family, 'toc', 'minimal', idle)
          );
          expect(linkTextProps('toc', facts, family)).toMatchObject({
            tone: 'inherit',
            weight:
              family === 'shadcn'
                ? current
                  ? 'medium'
                  : 'normal'
                : current
                  ? 'semibold'
                  : 'medium',
          });
        }
    // Suppressing the TOC row fill must not change Sidebar selection.
    expect(
      linkSurfaceProps(family, 'sidebar', 'minimal', { ...idle, current: true })
    ).toMatchObject({
      variant: 'accent',
      current: true,
    });
  });
}

it('keeps the native Sidebar typography contract finite and distinct from TOC', () => {
  expect(sidebarTextSurfaceStyle('row')).toEqual({ fontSize: '0.8125rem', lineHeight: '1.25rem' });
  expect(sidebarTextSurfaceStyle('nested-group')).toEqual(sidebarTextSurfaceStyle('row'));
  expect(sidebarTextSurfaceStyle('top-group')).toEqual({
    fontSize: '0.75rem',
    lineHeight: '1.25rem',
  });
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const appearance of ['sidebar', 'nav-group'] as const) {
      expect(linkSurfaceLayout(family, appearance, 'minimal', idle)).toMatchObject({
        minHeight: 'var(--site-navigation-row-height, 2rem)',
        marginBottom: '0',
      });
      expect(linkTextProps(appearance, idle, family).leading).toBe('size');
    }
    expect(linkTextProps('nav-group', idle, family, 'top-group').tone).toBe('muted');
    expect(linkTextProps('nav-group', idle, family, 'nested-group').tone).toBe('inherit');
    expect(linkSurfaceLayout(family, 'toc', 'minimal', idle).padding).toBe('0.25rem 0.5rem');
    expect(linkSurfaceLayout(family, 'toc', 'minimal', idle).marginBottom).toBe('1px');
  }
});

it('matches ordinary reading TOC geometry without shrinking mobile variants or Sidebar targets', () => {
  expect(readingTocTextSurfaceStyle()).toEqual({
    fontSize: '0.8rem',
    lineHeight: '1rem',
    fontFamily: 'inherit',
    letterSpacing: 'inherit',
  });
  for (const family of ['shadcn', 'brutalist'] as const) {
    const layout = linkSurfaceLayout(family, 'toc', 'minimal', idle, true);
    expect(layout).toMatchObject({
      minHeight: '1.5rem',
      marginBottom: '0',
      padding: '0.25rem 0.5rem',
      paddingInlineStart: 'calc(1rem * var(--depth, 0) + 0.5rem)',
    });
    expect(layout).not.toHaveProperty('height');
    expect(linkSurfaceLayout(family, 'toc', 'minimal', idle).minHeight).toBe(
      'var(--site-navigation-row-height, 2rem)'
    );
    expect(linkSurfaceLayout(family, 'sidebar', 'minimal', idle).minHeight).toBe(
      'var(--site-navigation-row-height, 2rem)'
    );
    expect(linkTextProps('toc', idle, family, undefined, true).leading).toBe('size');
  }
});
