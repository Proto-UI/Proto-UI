import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('uses the same public header recipe for theme SSR paint and runtime props', () => {
  const theme = readFileSync('apps/www/src/components/override/ThemeToggle.astro', 'utf8');
  expect(theme).toContain('const buttonProps = headerButtonProps(family)');
  expect(theme).toContain('snapshotStartupStyle(`${family}-button`, buttonProps)');
  expect(theme).toContain('data-variant={buttonProps.variant}');
  expect(theme).toContain('data-size={buttonProps.size}');
  expect(theme).toContain("data-pui-style={startupTokens.join(' ')}");
  expect(theme).toContain('aria-pressed="false"');
  expect(theme).toContain('event instanceof CustomEvent');
});

it('seeds connected site Button props before custom element upgrade', () => {
  const source = readFileSync('apps/www/src/components/site-shadcn-controls.ts', 'utf8');
  const registration = source.slice(
    source.indexOf('export function registerSiteControls()'),
    source.indexOf('export function selectValue')
  );
  expect(registration.indexOf('.forEach(initializeButton)')).toBeGreaterThan(-1);
  expect(registration.indexOf('.forEach(initializeButton)')).toBeLessThan(
    registration.indexOf('customElements.define(')
  );
});

it('shares theme target geometry before and after both homepage and docs enhancement', () => {
  const theme = readFileSync('apps/www/src/components/override/ThemeToggle.astro', 'utf8');
  const fallback = readFileSync('apps/www/src/components/Homepage/HomeActions.astro', 'utf8');
  const client = readFileSync(
    'apps/www/src/components/Homepage/homepage-runtime-client.ts',
    'utf8'
  );
  expect(theme).toContain('style={headerIconButtonLayout()}');
  expect(fallback).toContain('style={headerIconButtonLayout()}');
  expect(fallback).toContain('snapshotStartupStyle(`${initialFamily}-button`, headerButtonProps(');
  expect(fallback).toContain("data-pui-style={themeTokens.join(' ')}");
  expect(client).toContain('surfaceStyle: headerIconButtonLayout()');
});
