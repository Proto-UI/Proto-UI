import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteTextRecipe } from '../components/site-text-recipes';

const css = readFileSync('apps/www/src/styles/site-note-surface.css', 'utf8');
const sheet = new CSSStyleSheet();
sheet.replaceSync(css);
const rules = Array.from(sheet.cssRules) as CSSStyleRule[];
const normalizedSelector = (rule?: CSSStyleRule) => rule?.selectorText.replace(/\s+/g, ' ').trim();
const declaration = (selector: string, property: string) =>
  rules
    .find((rule) => rule.selectorText === selector)
    ?.style.getPropertyValue(property)
    .trim();

// Source/CSSOM evidence only. The native browser suite owns computed paint,
// text metrics and frame-to-frame geometry; Happy DOM cannot prove those.
function familyInputs(family: string, projectionFamily?: string) {
  const scope = document.createElement('div');
  scope.dataset.siteLibraryFamily = family;
  if (projectionFamily) scope.dataset.projectionFamily = projectionFamily;
  const inputs: Record<string, string> = {};
  for (const rule of rules) {
    if (!scope.matches(rule.selectorText)) continue;
    for (const property of Array.from(rule.style))
      if (property.startsWith('--site-note-'))
        inputs[property] = rule.style.getPropertyValue(property).trim();
  }
  return inputs;
}

describe('native Note first-frame source contract', () => {
  it('starts with the same flow box as the passive projection, without a readiness gate', () => {
    expect(declaration('.starlight-aside--note', 'border')).toBe('0px');
    expect(declaration('.starlight-aside--note', 'background-image')).toBe('none');
    expect(declaration('.starlight-aside--note', 'position')).toBe('relative');
    expect(css).not.toMatch(/(?:visibility:\s*hidden|opacity:\s*0|content-visibility)/);
  });

  it('paints the native fallback in the same non-flow plane as the public Surface', () => {
    const selector = '.starlight-aside--note::before';
    expect(declaration(selector, 'content')).toBe("''");
    expect(declaration(selector, 'position')).toBe('absolute');
    expect(declaration(selector, 'inset')).toBe('0');
    expect(declaration(selector, 'box-sizing')).toBe('border-box');
    // Happy DOM drops unresolved variables from the border shorthand. Retain
    // the authored declaration as source evidence rather than inventing paint.
    const fallback = css.match(/\.starlight-aside--note::before\s*\{([^}]*)\}/)?.[1];
    expect(fallback).toContain(
      'border: var(--site-note-border-width) solid var(--site-note-border);'
    );
    expect(declaration(selector, 'border-radius')).toBe('var(--site-note-radius)');
    expect(declaration(selector, 'background')).toBe('var(--site-note-background)');
    expect(declaration(selector, 'pointer-events')).toBe('none');
  });

  it('uses existing family theme inputs for outline/all/lg versus outline/all/default', () => {
    expect(familyInputs('shadcn')).toMatchObject({
      '--site-note-background': 'var(--pui-background)',
      '--site-note-foreground': 'var(--pui-foreground)',
      '--site-note-border': 'var(--pui-border)',
      '--site-note-border-width': '1px',
      '--site-note-radius': 'var(--pui-radius-lg)',
    });
    expect(familyInputs('brutalist')).toMatchObject({
      '--site-note-background': 'var(--site-brutalist-background)',
      '--site-note-foreground': 'var(--site-brutalist-foreground)',
      '--site-note-border': '#000',
      '--site-note-border-width': '2px',
      '--site-note-radius': 'var(--site-brutalist-radius)',
    });
  });

  it('keeps local family overrides equivalent to runtimePreviewFamily precedence', () => {
    expect(familyInputs('brutalist', 'shadcn')).toEqual(familyInputs('shadcn'));
    expect(familyInputs('shadcn', 'brutalist')).toEqual(familyInputs('brutalist'));
    const native = document.createElement('div');
    native.className = 'brutalist-demo-frame';
    expect(
      rules.some(
        (rule) =>
          native.matches(rule.selectorText) &&
          rule.style.getPropertyValue('--site-note-radius') === 'var(--site-brutalist-radius)'
      )
    ).toBe(true);
  });

  it('retires only fallback decoration after a successful or retained real projection', () => {
    const retirement = rules.filter((rule) => rule.style.getPropertyValue('content') === 'none');
    expect(retirement).toHaveLength(1);
    expect(normalizedSelector(retirement[0])).toBe(
      ".starlight-aside--note[data-note-surface-view='ready']::before, .starlight-aside--note[data-note-surface-view='retained']::before"
    );
    expect(retirement[0]?.selectorText).not.toContain('unavailable');
    expect(declaration('.starlight-aside--note > :not(.site-note-surface-mount)', 'z-index')).toBe(
      '1'
    );
  });

  it('matches the public label recipe before the actual Text wraps the original title', () => {
    for (const family of ['shadcn', 'brutalist'] as const)
      expect(siteTextRecipe('label', family)).toMatchObject({
        size: 'sm',
        weight: 'medium',
        leading: 'normal',
      });
    const selector = '.starlight-aside--note .starlight-aside__title';
    expect(declaration(selector, 'font-size')).toBe('0.875rem');
    expect(declaration(selector, 'font-weight')).toBe('500');
    expect(declaration(selector, 'line-height')).toBe('1.5');
    expect(declaration(selector, 'color')).toBe('var(--site-note-foreground)');
    const wrapperRule = rules.find((rule) =>
      rule.selectorText.includes('[data-site-typography-carrier]')
    );
    expect(normalizedSelector(wrapperRule)).toContain(
      '.starlight-aside--note .starlight-aside__title'
    );
    expect(wrapperRule?.selectorText).toContain('[data-typography-prototype]');
    expect(wrapperRule?.selectorText).toContain('[data-site-typography-slot]');
    expect(wrapperRule?.style.display).toBe('inline-flex');
    expect(wrapperRule?.style.alignItems).toBe('center');
  });

  it('matches native body typography and ink to each family without gating it on startup', () => {
    for (const family of ['shadcn', 'brutalist'] as const) {
      expect(siteTextRecipe('body', family)).toMatchObject({
        size: 'base',
        weight: family === 'shadcn' ? 'normal' : 'medium',
        leading: 'relaxed',
      });
      expect(familyInputs(family)['--site-note-body-weight']).toBe(
        family === 'shadcn' ? '400' : '500'
      );
    }
    expect(declaration('.starlight-aside--note', 'font-size')).toBe('1rem');
    expect(declaration('.starlight-aside--note', 'line-height')).toBe('1.625');
    expect(declaration('.starlight-aside--note', 'font-family')).toBe('var(--site-note-font)');
    // siteTypographyParticipant copies the canonical website font into the
    // Shadcn Text theme; it is not present in WEBSITE_SHADCN_THEME_TOKENS.
    expect(familyInputs('shadcn')['--site-note-font']).toBe(
      'var(--font-sans, ui-sans-serif, system-ui, sans-serif)'
    );
    expect(declaration('.starlight-aside--note', 'color')).toBe('var(--site-note-foreground)');
  });

  it('keeps the original SVG and native links independent of client startup', () => {
    expect(declaration('.starlight-aside--note .starlight-aside__icon', 'flex')).toBe('0 0 auto');
    expect(declaration('.starlight-aside--note .starlight-aside__icon', 'font-size')).toBe(
      '1.333em'
    );
    expect(declaration('.starlight-aside--note .starlight-aside__content a', 'color')).toBe(
      'inherit'
    );
  });
});
