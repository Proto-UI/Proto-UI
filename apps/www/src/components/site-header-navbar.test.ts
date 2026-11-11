// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { navbarLinkContext, linkSurfaceProps } from './site-link-recipes';

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
    for (const id of ['brand', 'desktop']) expect(navbarLinkContext(scope.querySelector(`#${id}`)!)).toBe('navbar');
    for (const id of ['popup', 'control', 'page']) expect(navbarLinkContext(scope.querySelector(`#${id}`)!)).toBe('default');
  });
  it('keeps default callers, popup links and both other families unchanged', () => {
    for (const family of ['shadcn', 'brutalist'] as const) {
      for (const appearance of ['brand', 'nav'] as const) {
        expect(linkSurfaceProps(family, appearance, 'minimal', facts, 'navbar'))
          .toEqual(linkSurfaceProps(family, appearance, 'minimal', facts));
      }
    }
    expect(linkSurfaceProps('bootstrap-2-3-2', 'nav', 'minimal', facts)).not.toHaveProperty('colorContext');
    expect(linkSurfaceProps('bootstrap-2-3-2', 'nav', 'minimal', facts, 'navbar')).toMatchObject({
      variant: 'transparent', colorContext: 'navbar', focusVisible: true, hovered: true,
    });
    expect(linkSurfaceProps('bootstrap-2-3-2', 'action', 'primary', facts, 'navbar'))
      .toEqual(linkSurfaceProps('bootstrap-2-3-2', 'action', 'primary', facts));
  });
});
