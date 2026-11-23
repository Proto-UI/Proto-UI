// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('places the no-JS hidden override in Tailwind base without changing scripted visibility', () => {
  const source = readFileSync('apps/www/src/components/CodeExample.astro', 'utf8');
  const fallback = source.match(/<noscript\s+set:html=\{'([\s\S]*?)'\}\s*\/>/)?.[1];
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
  expect(browser).toContain(
    '@layer base { [data-code-file-browser] [data-code-file-panel][hidden] { display:block!important; } }'
  );
});

it('keeps the actual InstallCommandCard alternatives available without JavaScript', () => {
  const source = readFileSync('apps/www/src/components/InstallCommandCard.astro', 'utf8');
  const fallback = source.match(/<noscript\s+set:html=\{'([\s\S]*?)'\}\s*\/>/)?.[1];
  expect(fallback).toContain('@layer base {');
  expect(fallback).toContain('[data-install-command-card] [data-command-panel][hidden]');
  expect(fallback).toContain('display:block!important;');
  expect(source).toContain(
    "document.addEventListener('astro:page-load', () => initInstallCommandCards(document))"
  );
});

it('renders source expanded before hydration and localizes the disclosure name', () => {
  const source = readFileSync('apps/www/src/components/PrototypePreviewer/CodePanel.astro', 'utf8');
  expect(source.match(/data-code-expanded="true"/g)).toHaveLength(2);
  expect(source).toMatch(/data-code-toggle\s+hidden\s+aria-expanded="false"/);
  expect(source).toContain("expandLabel = isChinese ? '展开代码' : 'View code'");
  expect(source).toContain('aria-label={expandLabel}');
});
