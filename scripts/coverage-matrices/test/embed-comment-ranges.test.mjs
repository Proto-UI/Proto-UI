import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parse as parseHtml } from 'parse5';
import { parse as parseAstro } from '@astrojs/compiler/sync';

const source = fs.readFileSync(new URL('../check-coverage-matrices.mjs', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('checker.mjs', source, ts.ScriptTarget.Latest, true);
const declaration = parsed.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'maskAuthoredMarkupComments'
);
assert.ok(declaration, 'exercise the actual production comment masking helper');
const mask = runInNewContext(`${declaration.getText(parsed)}\nmaskAuthoredMarkupComments;`, {
  Buffer,
  parseHtml,
  parseAstro,
});

for (const extension of ['html', 'astro']) {
  for (const prefix of ['', '😀', '中é', 'prefix\r\n']) {
    for (const body of ['plain', 'é', '中文', '😀', 'réel 😀\r\n<iframe/>', 'e\u0301']) {
      test(`comment exact span: ${extension} ${JSON.stringify(prefix)} ${JSON.stringify(body)}`, () => {
        const comment = `<!-- ${body} -->`;
        const suffix = '<iframe src="/real"></iframe>';
        const input = prefix + comment + suffix;
        const actual = mask(input, `surface.${extension}`);
        assert.equal(actual.length, input.length, 'preserve JavaScript code-unit length');
        assert.equal(actual, prefix + comment.replace(/[^\r\n]/g, ' ') + suffix);
        assert.equal(actual.slice(-suffix.length), suffix, 'never erase an active suffix');
      });
    }
  }
  test(`comment exact span: ${extension} quoted markers remain data`, () => {
    const input = '<div title="<!-- é 😀"></div><iframe src="/real"></iframe><span title="-->"/>';
    assert.equal(mask(input, `surface.${extension}`), input);
  });
}

for (const extension of ['html', 'astro']) {
  for (const text of ['ASCII', 'é', '中', '😀', 'é中😀\r\n'])
    test(`script exact span: ${extension} ${JSON.stringify(text)}`, () => {
      const prefix = '😀';
      const script = `<script>const sample=${JSON.stringify(text)};</script>`;
      const suffix = '<iframe src="/real"></iframe>';
      assert.equal(
        mask(prefix + script + suffix, `surface.${extension}`, { includeScripts: true }),
        prefix + script.replace(/[^\r\n]/g, ' ') + suffix
      );
    });
  test(`script exact span: ${extension} quoted markers retain active suffix`, () => {
    const input =
      '<div title="<script>"></div><iframe src="/real"></iframe><div title="</script>"></div>';
    assert.equal(mask(input, `surface.${extension}`, { includeScripts: true }), input);
  });
}
