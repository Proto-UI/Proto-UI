// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  navbarLinkContext,
  navbarLinkTextStyle,
  linkSurfaceProps,
  linkSurfaceLayout,
  linkTextProps,
} from './site-link-recipes';

const facts = { hovered: true, pressed: false, focusVisible: true, current: false };
describe('blue Header navigation is a bounded family presentation', () => {
  it('selects only topbar brand and desktop navigation, not popup or page links', () => {
    const scope = document.createElement('div');
    scope.innerHTML = `<div data-site-header>
      <div class="site-header-brand"><a id="brand"></a></div>
      <nav data-site-header-desktop-navigation><a id="desktop"></a></nav>
      <div data-site-header-panel><nav data-site-header-navigation><a id="popup"></a></nav></div>
      <button id="control"></button>
    </div><a id="page"></a>`;
    for (const id of ['brand', 'desktop'])
      expect(navbarLinkContext(scope.querySelector(`#${id}`)!)).toBe('navbar');
    for (const id of ['popup', 'control', 'page'])
      expect(navbarLinkContext(scope.querySelector(`#${id}`)!)).toBe('default');
  });
  it('keeps default callers, popup links and both other families unchanged', () => {
    for (const family of ['shadcn', 'brutalist'] as const) {
      for (const appearance of ['brand', 'nav'] as const) {
        expect(linkSurfaceProps(family, appearance, 'minimal', facts, 'navbar')).toEqual(
          linkSurfaceProps(family, appearance, 'minimal', facts)
        );
      }
    }
    expect(linkSurfaceProps('bootstrap-2-3-2', 'nav', 'minimal', facts)).not.toHaveProperty(
      'colorContext'
    );
    expect(linkSurfaceProps('bootstrap-2-3-2', 'nav', 'minimal', facts, 'navbar')).toMatchObject({
      variant: 'transparent',
      colorContext: 'navbar',
      focusVisible: true,
      hovered: true,
    });
    expect(linkSurfaceProps('bootstrap-2-3-2', 'action', 'primary', facts, 'navbar')).toEqual(
      linkSurfaceProps('bootstrap-2-3-2', 'action', 'primary', facts)
    );
  });
  it('projects archived brand and navigation metrics without making the brand a selected tab', () => {
    expect(navbarLinkTextStyle('bootstrap-2-3-2', 'brand', 'navbar')).toEqual({
      fontSize: '20px',
      lineHeight: '20px',
      fontWeight: '200',
      letterSpacing: 'normal',
    });
    expect(navbarLinkTextStyle('bootstrap-2-3-2', 'nav', 'navbar')).toMatchObject({
      fontSize: '14px',
      fontWeight: '400',
    });
    expect(
      linkSurfaceLayout('bootstrap-2-3-2', 'nav', 'minimal', facts, false, 'navbar')
    ).toMatchObject({ padding: '10px 15px', boxSizing: 'border-box' });
    expect(
      linkTextProps(
        'nav',
        { ...facts, current: true },
        'bootstrap-2-3-2',
        undefined,
        false,
        'navbar'
      )
    ).toMatchObject({ weight: 'normal', decoration: 'none' });
    expect(
      linkSurfaceProps(
        'bootstrap-2-3-2',
        'brand',
        'minimal',
        {
          hovered: true,
          pressed: true,
          current: true,
          focusVisible: true,
        },
        'navbar'
      )
    ).toMatchObject({
      hovered: false,
      pressed: false,
      current: false,
      focusVisible: true,
    });
    for (const family of ['shadcn', 'brutalist'] as const)
      expect(navbarLinkTextStyle(family, 'brand', 'navbar')).toEqual({});
    expect(navbarLinkTextStyle('bootstrap-2-3-2', 'brand', 'default')).toEqual({});
  });
});
