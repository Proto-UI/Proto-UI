/** Compile the actual public recipes' consumer utility classes with the site's
 * installed Tailwind compiler and stylesheet. Prototype token CSS is separate. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const consumers = [
  'apps/www/src/content/docs/form-validation-demo.shared.ts',
  'apps/www/src/content/docs/select-input-demo.shared.ts',
  'apps/www/src/content/docs/field-choices-demo.shared.ts',
  'apps/www/src/content/docs/shadcn-demo-style.ts',
];
export async function readFormSelectRecipeCss() {
  const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
  const { compile } = require('tailwindcss');
  const stylesheet = 'apps/www/src/styles/tailwindcss.css';
  const raw = await readFile(stylesheet, 'utf8');
  const fonts = {};
  let input = raw;
  // A setContent consumer has no website asset server. Embed the exact local
  // font bytes referenced by the ordinary stylesheet instead of a substitute.
  for (const match of raw.matchAll(/url\((['"]?)(\.\/assets\/[^)'"\s]+)\1\)/g)) {
    const file = path.join(path.dirname(stylesheet), match[2]);
    const bytes = await readFile(file);
    fonts[file] = digest(bytes);
    input = input.replace(match[0], `url("data:font/ttf;base64,${bytes.toString('base64')}")`);
  }
  const sourceDigests = {};
  const candidates = new Set();
  for (const file of consumers) {
    const source = await readFile(file, 'utf8');
    sourceDigests[file] = digest(source);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node))
        for (const candidate of node.text.split(/\s+/).filter(Boolean)) candidates.add(candidate);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const imported = {};
  const compiled = await compile(input, {
    base: path.resolve(path.dirname(stylesheet)),
    from: path.resolve(stylesheet),
    async loadStylesheet(id, base) {
      const file =
        id === 'tailwindcss'
          ? require.resolve('tailwindcss/index.css')
          : id.startsWith('.')
            ? path.resolve(base, id)
            : require.resolve(id);
      const content = await readFile(file, 'utf8');
      imported[path.relative(process.cwd(), file)] = digest(content);
      return { path: file, base: path.dirname(file), content };
    },
  });
  const css = compiled.build([...candidates].sort());
  return {
    css,
    receipt: {
      compiler: `tailwindcss@${require('tailwindcss/package.json').version}`,
      stylesheet,
      stylesheetSha256: digest(raw),
      consumerSources: sourceDigests,
      candidateCount: candidates.size,
      importedStyles: imported,
      fonts,
      cssSha256: digest(css),
    },
  };
}
