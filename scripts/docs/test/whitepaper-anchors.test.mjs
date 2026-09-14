import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

// Use the site's actual Markdown renderer so punctuation, inline code, Unicode,
// and duplicate heading slugs are checked exactly as they are in Astro.
const siteRequire = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const astroRequire = createRequire(siteRequire.resolve('astro/package.json'));
const { createMarkdownProcessor } = await import(astroRequire.resolve('@astrojs/markdown-remark'));
const renderer = await createMarkdownProcessor({ syntaxHighlight: false });
const root = new URL('../../../apps/www/src/content/docs/', import.meta.url);
const config = await fs.readFile(
  new URL('../../../apps/www/astro.config.mjs', import.meta.url),
  'utf8'
);
const redirects = [
  ...config.matchAll(/'\/(en|zh-cn)\/whitepaper\/([^']+)': '\/\1\/whitepaper\/([^']+)\/'/g),
];
const cache = new Map();
async function render(locale, slug) {
  const key = `${locale}/whitepaper/${slug}`;
  if (!cache.has(key)) {
    const source = await fs.readFile(new URL(`${key}.md`, root), 'utf8');
    cache.set(key, await renderer.render(source.replace(/^---\n[\s\S]*?\n---\n/, '')));
  }
  return cache.get(key);
}

test('all 16 legacy whitepaper routes retain every section fragment', async () => {
  assert.equal(redirects.length, 16);
  for (const [, locale, oldSlug, newSlug] of redirects) {
    const oldPage = await render(locale, oldSlug);
    const page = await render(locale, newSlug);
    const ids = [...page.code.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${locale}/${newSlug}: duplicate IDs`);
    for (const heading of oldPage.metadata.headings) {
      assert.ok(
        ids.includes(heading.slug),
        `${locale}/${oldSlug}#${heading.slug} has no destination`
      );
    }
  }
});

test('moved-topic notices point to existing sections in the same locale', async () => {
  for (const [, locale, , newSlug] of redirects) {
    const page = await render(locale, newSlug);
    for (const [notice] of page.code.matchAll(
      /<p[^>]*class="whitepaper-legacy-topic"[\s\S]*?<\/p>/g
    )) {
      const link = notice.match(/href="\/([^/]+)\/whitepaper\/([^/]+)\/#([^"]+)"/);
      assert.ok(link, `Missing destination in ${notice}`);
      assert.equal(link[1], locale);
      const target = await render(locale, link[2]);
      assert.ok(
        target.metadata.headings.some((h) => h.slug === link[3]),
        `Missing target ${link[0]}`
      );
    }
  }
});

test('static redirects preserve query and fragment with a no-script fallback', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const { join } = await import('node:path');
  const { runInNewContext } = await import('node:vm');
  const { whitepaperRedirectFragments } =
    await import('../../../apps/www/src/utils/whitepaper-redirect-fragments.mjs');
  const temp = await mkdtemp(join(tmpdir(), 'whitepaper-redirects-'));
  try {
    const routes = {};
    for (const [, locale, oldSlug, newSlug] of redirects) {
      const source = `/${locale}/whitepaper/${oldSlug}`;
      const target = `/${locale}/whitepaper/${newSlug}/`;
      routes[source] = target;
      await mkdir(join(temp, source), { recursive: true });
      await writeFile(
        join(temp, source, 'index.html'),
        `<meta http-equiv="refresh" content="0;url=${target}"><a href="${target}">Continue</a>`
      );
    }
    await whitepaperRedirectFragments(routes).hooks['astro:build:done']({
      dir: pathToFileURL(`${temp}/`),
    });
    for (const [source, target] of Object.entries(routes)) {
      const html = await readFile(join(temp, source, 'index.html'), 'utf8');
      assert.match(html, /<noscript><meta http-equiv="refresh"[^>]*><\/noscript>/);
      const script = html.match(/<script>(.*?)<\/script>/)[1];
      for (const hash of [
        '',
        '#what-does-this-article-answer',
        '#%E8%AF%AD%E4%B9%89%E4%B8%80%E8%87%B4',
      ]) {
        let actual;
        runInNewContext(script, {
          location: {
            search: '?from=bookmark',
            hash,
            replace: (url) => {
              actual = url;
            },
          },
        });
        assert.equal(actual, `${target}?from=bookmark${hash}`);
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
