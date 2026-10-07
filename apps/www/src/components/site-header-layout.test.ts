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

it('reflows enlarged desktop reading columns and Header by container space, preserving original owners', () => {
  const columns = readFileSync('apps/www/src/components/override/TwoColumnContent.astro', 'utf8');
  const header = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  expect(frame).toContain('container: docs-canvas / inline-size');
  expect(frame).toContain('lg:[--sidebar-width:15rem]');
  expect(columns).toContain('@container docs-canvas (max-width: 72rem)');
  expect(columns).toContain('class="docs-reading-columns lg:sl-flex"');
  expect(columns).toMatch(/\.right-sidebar-container[\s\S]*width: 100%/);
  expect(columns).toMatch(
    /:global\(\.right-sidebar-panel \.sl-container\)\s*\{[^}]*max-width: none/
  );
  expect(header).toContain('@container docs-page (max-width: 68.749rem)');
  expect(header).toContain('@container docs-page (max-width: 42rem)');
});

describe('reading reflow query boundaries (source arithmetic, not browser paint)', () => {
  const columns = readFileSync('apps/www/src/components/override/TwoColumnContent.astro', 'utf8');
  const query = columns.match(
    /@media \(min-width: ([\d.]+)rem\)\s*\{\s*@container docs-canvas \(max-width: ([\d.]+)rem\)/
  );
  // Media rem uses the initial font; container rem follows the root font. Read
  // the actual owner thresholds so restoring the inclusive 80/80 defect fails.
  const reflows = (viewport: number, contentWidth: number, root: number) => {
    expect(query).not.toBeNull();
    return viewport >= Number(query![1]) * 16 && contentWidth <= Number(query![2]) * root;
  };

  it('keeps the ordinary desktop TOC lateral through the padded overlap and its neighbours', () => {
    for (const viewport of [1279, 1280, 1281, 1296, 1312, 1313, 1327, 1328, 1360, 1361, 1440])
      for (const scrollbar of [0, 15]) {
        // PageFrame caps the border box at 85rem; global.css pads each side by
        // 1rem. The 15px case is a modelled classic scrollbar, not a capture.
        const contentWidth = Math.min(viewport - scrollbar, 85 * 16) - 2 * 16;
        expect(reflows(viewport, contentWidth, 16), `${viewport}px, scrollbar ${scrollbar}`).toBe(
          false
        );
      }
  });

  it('retains root-relative enlarged reflow at the existing column budget and viewport gate', () => {
    const columnBudget = Number(columns.match(/@media \(min-width: ([\d.]+)rem\)/)![1]);
    expect(Number(query![2])).toBe(columnBudget);
    expect(reflows(1440, 1440 - 2 * 32, 32)).toBe(true);
    expect(reflows(1279, 1279 - 2 * 32, 32)).toBe(false);
    for (const root of [20, 24, 32]) {
      const boundary = columnBudget * root;
      const viewport = boundary + 2 * root;
      expect(reflows(viewport - 1, boundary - 1, root)).toBe(true);
      expect(reflows(viewport, boundary, root)).toBe(true);
      expect(reflows(viewport + 1, boundary + 1, root)).toBe(false);
    }
  });
});

describe('Docs header offset targets the actual MarkdownContent wrapper', () => {
  it('matches the real heading with the owned scroll-margin selector', () => {
    const heading = actualMarkdownFixture();
    const match = frame.match(/:global\(([^{}]*?)\)\s*\{\s*scroll-margin-top:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const selector = match![1]!.replace(/\s+/g, ' ').trim();
    expect([...document.querySelectorAll(selector)]).toContain(heading);
    expect(match![2]).toBe('calc(var(--header-height) + 1rem)');
  });

  it('removes the upstream root offset only when our measured docs Header owns clearance', () => {
    expect(frame).toMatch(
      /:global\(html:has\(\.site-page-frame \[data-docs-site-header\]\)\)\s*\{\s*scroll-padding-top: 0;/
    );
    expect(frame).toContain('scroll-margin-top: calc(var(--header-height) + 1rem)');
  });

  it('preserves native clearance for the actual PageTitle and non-heading bookmarks', () => {
    actualMarkdownFixture(
      '<h2 id="actual-doc-heading">Section</h2><span id="legacy-bookmark">Legacy anchor</span>'
    );
    const titleSource = readFileSync('apps/www/src/components/override/PageTitle.astro', 'utf8');
    expect(titleSource).toContain('id={PAGE_TITLE_ID}');
    const title = document.createElement('h1');
    title.id = '_top';
    document.querySelector('main')!.prepend(title);
    expect(title.closest('[data-doc-flow]')).toBeNull();
    const match = frame.match(/:global\(([^{}]*?)\)\s*\{\s*scroll-margin-top:/)!;
    const targets = [...document.querySelectorAll(match[1]!.replace(/\s+/g, ' ').trim())];
    expect(targets).toContain(title);
    expect(targets).toContain(document.querySelector('#legacy-bookmark'));
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
    it(`${path} provides one movable preference owner with an explicit native startup location`, () => {
      const source = readFileSync(`apps/www/src/components/${path}`, 'utf8');
      expect(source.match(/data-site-header-preferences/g)).toHaveLength(1);
      expect(source.match(/data-site-header-compact-context/g)).toHaveLength(1);
      expect(source.indexOf('data-site-header-compact-context')).toBeGreaterThan(
        source.indexOf('data-site-header-panel-content')
      );
      if (path === 'override/Header.astro') {
        expect(source).toContain('data-site-header-wide-preferences');
        expect(source.indexOf('data-site-header-preferences')).toBeGreaterThan(
          source.indexOf('data-site-header-compact-context')
        );
        expect(source.indexOf('data-site-header-preferences')).toBeLessThan(
          source.indexOf('data-site-header-context')
        );
      } else {
        expect(source.indexOf('data-site-header-preferences')).toBeGreaterThan(
          source.indexOf('data-site-header-context')
        );
      }
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

it('keeps one Header close toggle and lets short compact menus shrink to their content', () => {
  for (const path of ['Homepage/HomepageRuntime.astro', 'override/Header.astro']) {
    const source = readFileSync(`apps/www/src/components/${path}`, 'utf8');
    expect(source).not.toContain('data-site-menu-close');
    expect(source).not.toContain('closeMenuButton');
    expect(source).not.toContain('site-header-panel-heading');
  }
  const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  expect(css).not.toMatch(/(?:^|[;\n])\s*height:\s*var\(--site-header-panel-max-height/);
  expect(css).toContain('max-height: var(--site-header-panel-max-height');
  expect(css).toContain("[data-site-menu-open='true'] .site-header-menu-icon::before");
});

it('spaces unframed text separately from framed controls without changing compact navigation', () => {
  const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  const nav = css.match(/\.site-header-navigation\s*\{([^}]+)\}/)![1];
  expect(nav).toContain('gap: var(--site-header-navigation-gap)');
  expect(nav).toContain('calc(var(--site-header-brand-navigation-gap) - 0.25rem)');
  expect(css).toContain('--site-header-navigation-gap: 1.5rem');
  const framed = css.match(
    /\[data-site-library-family='brutalist'\] \.site-header\s*\{([^}]+)\}/
  )![1];
  expect(framed).toContain('--site-header-navigation-gap: 0.75rem');
  expect(framed).toContain('--site-header-brand-navigation-gap: 0.75rem');
});

it('keeps the compact docs header offset identical before and after enhancement', () => {
  const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
  expect(frame).toMatch(/@media \(max-width: 47\.999rem\)[\s\S]*?--header-height: 3\.5rem;/);
  expect(css).toMatch(
    /\.site-header\[data-docs-site-header\] \{\s*grid-template-areas: 'brand search theme menu';/
  );
  expect(css).toContain('.site-header[data-docs-site-header]:has(.site-header-docs-navigation)');
});
