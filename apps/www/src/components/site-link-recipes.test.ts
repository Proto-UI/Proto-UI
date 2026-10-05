import { describe, expect, it } from 'vitest';
import { linkSurfaceLayout, linkSurfaceProps, linkTextProps } from './site-link-recipes';
const idle = { hovered: false, pressed: false, focusVisible: false, current: false, inView: false };
describe('consumer navigation density preserves native selection and family identity', () => {
  for (const family of ['shadcn', 'brutalist'] as const)
    for (const appearance of ['sidebar', 'toc'] as const) {
      it(`${family}/${appearance} shares the responsive geometry without changing its family paint`, () => {
        expect(linkSurfaceLayout(family, appearance, 'minimal')).toMatchObject({
          minHeight: 'var(--site-navigation-row-height, 2rem)',
          padding: '0.25rem 0.5rem',
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
        ).toBe('accent');
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
  for (const appearance of ['sidebar', 'toc'] as const) {
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
        padding: '0.125rem 0.375rem',
      });
    }
  }
});
