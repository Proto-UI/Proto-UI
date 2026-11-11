import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { homepageGhostThemeCss } from './homepage-ghost-theme';
import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';
import { THEME as BOOTSTRAP_THEME } from '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme';

const host = readFileSync(new URL('../PrototypePreviewer/HomeDemoPreviewer.astro', import.meta.url), 'utf8');
const card = readFileSync(new URL('./HomepageGhostCard.astro', import.meta.url), 'utf8');

describe('passive homepage gallery continuation', () => {
  it('shares the live gallery track and gaps instead of a second fixed grid', () => {
    expect(host).toContain('repeat(var(--homepage-gallery-wide-columns), minmax(0, 1fr))');
    expect(host).toContain('width: calc((100% - (var(--homepage-gallery-wide-columns) - 1) * var(--homepage-gallery-column-gap)) / var(--homepage-gallery-wide-columns))');
    expect(host).toContain('gap: var(--homepage-gallery-row-gap)');
    expect(host).toContain('inset-inline-end: calc(100% + var(--homepage-gallery-column-gap))');
    expect(host).toContain('inset-inline-start: calc(100% + var(--homepage-gallery-column-gap))');
    const rail = host.match(/\.home-demo-previewer__rail \{([^}]+)\}/)?.[1];
    expect(rail).toContain('top: 0');
    expect(rail).toContain('mask-image: linear-gradient(to bottom, black, black 65%, transparent)');
    const backdrop = host.match(/\.home-demo-previewer__backdrop \{([^}]+)\}/)?.[1];
    expect(backdrop).toBeDefined();
    expect(backdrop).not.toContain('mask-image:');
    expect(rail).not.toMatch(/width:\s*18rem|top:\s*1\.5rem/);
    expect(host).not.toContain('viewBox="0 0 288 248"');
  });

  it('uses the live card public family recipes rather than hardcoded round SVG paint', () => {
    expect(card).toContain("from '../LibraryCardPart.astro'");
    expect(card).toContain("['shadcn', 'brutalist', 'bootstrap-2-3-2']");
    for (const part of ['shadcn-card', 'shadcn-header', 'shadcn-content']) {
      expect(card).toContain(`part="${part}" props={{ styleProfile: 'rhea' }}`);
    }
    expect(card).toContain('part={`${family}-surface`}');
    expect(card).toContain("props={panelSurfaceProps('card')}");
    expect(card).toContain("...panelSurfaceLayout, padding: '1.25rem'");
    expect(card).not.toMatch(/border-radius:|rx="|box-shadow:|#[0-9a-f]{3,8}\b/i);
  });

  it('binds the actual family theme banks locally in both color modes', () => {
    const css = homepageGhostThemeCss();
    expect(card).toContain('data-home-ghost-theme={family}');
    expect(card).toContain('set:html={homepageGhostThemeCss()}');
    for (const [family, theme] of Object.entries({ brutalist: BRUTALIST_THEME, 'bootstrap-2-3-2': BOOTSTRAP_THEME })) {
      const host = `[data-home-ghost-theme="${family}"]`;
      const declarations = (mode: Record<string, string>) => Object.entries(mode).map(([name, value]) => `--pui-${name}:${value};`).join('');
      expect(css).toContain(`${host}{${declarations(theme.light)}}`);
      expect(css).toContain(`html.dark ${host},html[data-theme="dark"] ${host}{${declarations(theme.dark)}}`);
      expect(css).toContain(`html:not(.light):not(.dark):not([data-theme="light"]):not([data-theme="dark"]) ${host}{${declarations(theme.dark)}}`);
    }
    expect(css).toContain('@media(prefers-color-scheme:dark)');
    expect(css).not.toMatch(/:root\s*\{|html\s*\{/);
  });

  it('selects only the committed family and leaves decorations outside interactive ownership', () => {
    expect(host).toContain('class="home-demo-previewer__backdrop" aria-hidden="true" inert');
    expect(host).toContain('<HomepageGhostCard tall={index === 1} />');
    expect(host).toContain('@media (min-width: 116rem)');
    for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2']) {
      expect(card).toContain(`html[data-site-library-family='${family}']`);
      expect(card).toContain(`.ghost-card__family[data-ghost-family='${family}']`);
    }
    expect(card).not.toMatch(/<(?:button|input|a|script)\b|tabindex=|\bid=|data-gallery-demo=/i);
    expect(host).toContain('clip-path: inset(0 calc((100% - 100vw + 2rem) / 2))');
  });
});
