import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

const markdown = readFileSync('apps/www/src/components/override/MarkdownContent.astro', 'utf8');
const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
const browser = readFileSync(
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  'utf8'
);

function actualMarkdownFixture(section = '<h2 id="actual-doc-heading">Installation</h2>') {
  // Materialize the checked-in wrapper itself. Never invent a legacy class to
  // make a Website selector pass when the real MarkdownContent does not have it.
  const body = markdown
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace('<SiteCopyBootstrap />', '')
    .replace('<slot />', section);
  document.body.innerHTML = `<div class="site-page-frame"><header data-docs-site-header></header><main>${body}</main></div>`;
  const heading = document.querySelector<HTMLHeadingElement>('#actual-doc-heading')!;
  if (heading) expect(heading.closest('[data-doc-flow]')).not.toBeNull();
  expect(document.querySelector('.sl-markdown-content')).toBeNull();
  return heading;
}
afterEach(() => document.body.replaceChildren());

describe('Docs header offset targets the actual MarkdownContent wrapper', () => {
  it('matches the real heading with the owned scroll-margin selector', () => {
    const heading = actualMarkdownFixture();
    const match = frame.match(/:global\(([^{}]*?)\)\s*\{\s*scroll-margin-top:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const selector = match![1]!.replace(/\s+/g, ' ').trim();
    expect([...document.querySelectorAll(selector)]).toContain(heading);
    expect(match![2]).toBe('calc(var(--header-height) + 1rem)');
  });

  it('uses a browser heading locator that exists in the real wrapper', () => {
    const heading = actualMarkdownFixture();
    const selector = browser.match(/const heading = page\.locator\('([^']+)'\)\.first\(\)/)?.[1];
    expect(selector).toBeTruthy();
    expect(document.querySelector(selector!)).toBe(heading);
  });
});

for (const family of ['shadcn', 'brutalist']) {
  it(`covers an authored ${family} section heading on the actual browser route`, () => {
    const route =
      family === 'brutalist'
        ? (browser.match(
            /family === 'brutalist'\s*\? '(\/zh-cn\/ui-libraries\/brutalist\/components\/[^']+)'\s*:\s*searchRoute/
          )?.[1] ?? '/zh-cn/ui-libraries/brutalist/components/button/')
        : '/zh-cn/ui-libraries/shadcn/button/';
    const page = readFileSync(`apps/www/src/content/docs${route.replace(/\/$/, '')}.mdx`, 'utf8');
    const section = page.match(/^## (.+)$/m)?.[1];
    actualMarkdownFixture(
      section
        ? `<h2 id="actual-doc-heading">${section}</h2>`
        : '<p>No section in this authored page</p>'
    );
    const selector = browser.match(/const heading = page\.locator\('([^']+)'\)\.first\(\)/)?.[1];
    expect(document.querySelector(selector!)).not.toBeNull();
    expect(document.querySelector(selector!)?.textContent).toBe(section);
  });
}

describe('shared compact Header ownership and layout', () => {
  for (const path of ['Homepage/HomepageRuntime.astro', 'override/Header.astro']) {
    it(`${path} provides one movable preference owner and one empty compact destination`, () => {
      const source = readFileSync(`apps/www/src/components/${path}`, 'utf8');
      expect(source.match(/data-site-header-preferences/g)).toHaveLength(1);
      expect(source.match(/data-site-header-compact-context/g)).toHaveLength(1);
      expect(source.indexOf('data-site-header-compact-context')).toBeGreaterThan(
        source.indexOf('data-site-header-panel-content')
      );
      expect(source.indexOf('data-site-header-preferences')).toBeGreaterThan(
        source.indexOf('data-site-header-context')
      );
      expect(source).not.toMatch(/role=["'](?:menu|dialog)["']/);
    });
  }
  it('fills only the direct Header surface projection and never assigns its layout to nested controls', () => {
    const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
    expect(css).toContain(
      '[data-site-header-surface-mount] > .pui-projection-generation > .pui-projection-scope'
    );
    expect(css).toMatch(
      /\.site-header\[data-site-menu-ready\] \.site-header-panel \{[^}]*grid-area: auto;/
    );
    expect(css).toContain('top: var(--site-header-panel-top, 100%)');
    expect(css).toContain('left: var(--site-header-panel-left, 0)');
    expect(css).toContain('.site-header[data-site-menu-ready] > .site-header-context');
    expect(css).toContain("grid-template-areas: 'brand contents search theme menu'");
  });
});

it('reserves the existing public focus ring inside only the native popup scroll slot', () => {
  const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  const slot =
    css.match(
      /\.site-header\[data-site-menu-ready\] \.site-header-native-slot\s*\{([^}]+)\}/
    )?.[1] ?? '';
  expect(slot).toContain('margin: -4px');
  expect(slot).toContain('padding: 4px');
  expect(slot).toContain('scroll-padding: 4px');
  expect(slot).toContain('overflow-y: auto');
  expect(slot).not.toMatch(/(?:box-shadow|outline|border-radius)\s*:/);
});

it('lets enhanced social anchors enclose the Prototype motion extent without fixed 44px clipping', () => {
  const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  const block = css.match(/\.site-header-setting \[aria-label='GitHub'\][\s\S]*?\{([^}]+)\}/)?.[1];
  expect(block).toBeTruthy();
  expect(block).toMatch(/min-width:\s*2\.75rem/);
  expect(block).toMatch(/min-height:\s*2\.75rem/);
  expect(block).toMatch(/(?:^|[;\n])\s*width:\s*auto/);
  expect(block).toMatch(/(?:^|[;\n])\s*height:\s*auto/);
  expect(block).not.toMatch(/(?:^|[;\n])\s*(?:width|height):\s*2\.75rem/);
});
