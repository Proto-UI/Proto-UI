import { expect, it } from 'vitest';
import {
  headerButtonProps,
  headerSelectControlProps,
  headerResponsiveButtonFeedback,
} from './site-header-control-recipes';
import { linkSurfaceProps, linkSurfaceLayout, linkTextProps } from './site-link-recipes';

const idle = { hovered: false, focusVisible: false, pressed: false, current: false };
it('selects native Rhea Button and Select recipes without redefining a library default', () => {
  expect(headerButtonProps('shadcn')).toEqual({
    styleProfile: 'rhea',
    variant: 'secondary',
    size: 'icon',
  });
  expect(headerSelectControlProps()).toMatchObject({
    shadcnStyleProfile: 'rhea',
    triggerAppearance: 'default',
    compactTriggerAppearance: 'default',
    labelPresentation: 'accessible',
    wrapValue: true,
    minHeight: 'var(--site-control-height, 2.75rem)',
  });
  expect(headerButtonProps('brutalist')).toEqual({ variant: 'surface', size: 'icon' });
});
it('uses public ghost feedback for navigation, not text-link underline', () => {
  for (const facts of [
    idle,
    { ...idle, hovered: true },
    { ...idle, current: true },
    { ...idle, focusVisible: true },
    { ...idle, pressed: true },
  ]) {
    expect(linkTextProps('nav', facts, 'shadcn').decoration).toBe('none');
    expect(linkSurfaceProps('shadcn', 'nav', 'minimal', facts)).toMatchObject({
      actionProfile: 'rhea',
      hovered: facts.hovered || facts.current,
      focusVisible: facts.focusVisible,
      pressed: facts.pressed,
    });
    expect(linkSurfaceLayout('shadcn', 'nav', 'minimal', facts)).toMatchObject({
      minHeight: 'var(--site-control-height, 2.75rem)',
      pointerEvents: 'none',
    });
  }
  expect(linkTextProps('text', { ...idle, hovered: true }, 'shadcn').decoration).toBe('underline');
  expect(linkTextProps('nav', { ...idle, current: true }, 'shadcn').weight).toBe('semibold');
});

it('keeps responsive geometry discrete while retaining family feedback transitions', () => {
  const layout = headerResponsiveButtonFeedback();
  expect(layout).toEqual({
    transitionProperty:
      'color, background-color, border-color, outline-color, box-shadow, opacity, transform, translate, scale',
  });
  const properties = layout.transitionProperty.split(',').map((value) => value.trim());
  for (const geometry of ['all', 'width', 'height', 'padding', 'padding-inline', 'font-size'])
    expect(properties).not.toContain(geometry);
  expect(layout).not.toHaveProperty('transitionDuration');
  expect(layout).not.toHaveProperty('transitionTimingFunction');
});
