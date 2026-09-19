import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const siteRequire = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const astroRequire = createRequire(siteRequire.resolve('astro/package.json'));
const { createMarkdownProcessor } = await import(
  pathToFileURL(astroRequire.resolve('@astrojs/markdown-remark')).href
);
const { default: remarkDirective } = await import(
  pathToFileURL(siteRequire.resolve('remark-directive')).href
);
const { remarkConceptDirective } = await tsImport(
  '../../../apps/www/src/utils/remark-concept-directive.js',
  import.meta.url
);
const { rehypeEnhancedImage } = await tsImport(
  '../../../apps/www/src/utils/rehype-enhanced-image.ts',
  import.meta.url
);
const renderer = await createMarkdownProcessor({
  syntaxHighlight: false,
  remarkPlugins: [remarkDirective, remarkConceptDirective],
  rehypePlugins: [rehypeEnhancedImage],
});

for (const newline of ['\n', '\r\n']) {
  test(`the configured Markdown pipeline preserves bilingual diagram buttons and authored captions (${JSON.stringify(newline)})`, async () => {
    for (const locale of ['en', 'zh-cn']) {
      const dir = new URL(
        `../../../apps/www/src/content/docs/${locale}/whitepaper/`,
        import.meta.url
      );
      let count = 0;
      for (const name of await fs.readdir(dir)) {
        if (!/^[3-7]-.*\.md$/.test(name)) continue;
        const source = await fs.readFile(new URL(name, dir), 'utf8');
        const fixture = source.replace(/\r?\n/g, newline);
        const { code } = await renderer.render(
          fixture.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
        );
        const buttons = [
          ...code.matchAll(/<button\b[^>]*data-diagram-open[^>]*>([\s\S]*?)<\/button>/g),
        ];
        assert.equal(buttons.length, [...source.matchAll(/data-diagram-open/g)].length, name);
        for (const [, content] of buttons) {
          assert.doesNotMatch(content, /<(?:figure|figcaption|div)\b/, `${locale}/${name}`);
          assert.match(content, /<img\b[^>]*alt="[^"]+"/);
          count++;
        }
        assert.equal(
          [...code.matchAll(/<figcaption\b/g)].length,
          [...source.matchAll(/<figcaption\b/g)].length,
          name
        );
      }
      assert.equal(count, 7, locale);
    }
  });
}

test('the image enhancer skips parsed diagram-button subtrees and still enhances ordinary images', () => {
  const image = {
    type: 'element',
    tagName: 'img',
    properties: { src: '/diagram.svg', alt: 'Diagram' },
    children: [],
  };
  const button = {
    type: 'element',
    tagName: 'button',
    properties: { dataDiagramOpen: '' },
    children: [
      { type: 'element', tagName: 'span', properties: {}, children: [structuredClone(image)] },
    ],
  };
  const tree = { type: 'root', children: [button, structuredClone(image)] };
  const original = structuredClone(button);
  rehypeEnhancedImage()(tree);
  assert.deepEqual(tree.children[0], original, 'the viewer owns image layout and captions');
  assert.equal(tree.children[1].tagName, 'figure', 'ordinary image enhancement remains enabled');
  assert.equal(tree.children[1].children.at(-1).tagName, 'figcaption');
});
