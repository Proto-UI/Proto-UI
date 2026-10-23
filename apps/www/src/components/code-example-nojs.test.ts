// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('places the no-JS hidden override in Tailwind base without changing scripted visibility', () => {
  const source = readFileSync('apps/www/src/components/CodeExample.astro', 'utf8');
  const fallback = source.match(/<noscript set:html=\{'([\s\S]*?)'\} \/>/)?.[1];
  // Important declarations reverse layer precedence: an unlayered !important
  // cannot override Tailwind's base-layer [hidden] !important. Within base,
  // these scoped selectors are more specific than Tailwind's single attribute.
  expect(fallback).toMatch(/^<style>@layer base \{/);
  expect(fallback).toContain('[data-code-example] [data-code-host-panel][hidden]');
  expect(fallback).toContain('[data-code-example] [data-code-file-panel][hidden]');
  expect(fallback).toContain('display:block!important;');
  expect(fallback).toContain('display:block!important; } } [data-code-example]');
  expect(fallback).toContain('margin-block:1.5rem; }</style>');
  expect(source).toContain('hidden={!hostSelected}');
  const browser = readFileSync('apps/www/src/components/CodeFileBrowser.astro', 'utf8');
  expect(source).toContain('<CodeFileBrowser');
  expect(browser).toContain('hidden={index !== active}');
  expect(browser).toContain('@layer base { [data-code-file-browser] [data-code-file-panel][hidden] { display:block!important; } }');
});
