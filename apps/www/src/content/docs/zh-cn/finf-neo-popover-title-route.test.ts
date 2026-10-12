// @vitest-environment node
// Static route/source regression only; never imports or runs the browser suite.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const docsRoot = path.resolve('apps/www/src/content/docs');
const publicSource = path.join(docsRoot, 'en/ui-libraries/brutalist/components/popover.mdx');
const browserFile = path.join(docsRoot, 'zh-cn/finf-neo-popover-title.browser.test.ts');
const publicMdx = readFileSync(publicSource, 'utf8');
const suiteSource = ts.createSourceFile(
  browserFile,
  readFileSync(browserFile, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);

function declaredString(name: string) {
  for (const statement of suiteSource.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer &&
        ts.isStringLiteral(declaration.initializer)
      ) {
        return declaration.initializer.text;
      }
    }
  }
  throw new Error(`The dedicated browser suite must declare a static ${name}.`);
}

describe('Neo Popover Title evidence public-route binding', () => {
  it('navigates to the actual unaliased public MDX route, including components/', () => {
    const frontmatter = publicMdx.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    expect(frontmatter, 'The public route must remain an addressable docs entry.').not.toBeNull();
    expect(parse(frontmatter![1]).slug, 'A slug override requires an explicit route review.').toBe(
      undefined
    );
    const canonicalRoute = `/${path
      .relative(docsRoot, publicSource)
      .split(path.sep)
      .join('/')
      .replace(/\.mdx$/, '')}/`;
    expect(declaredString('route')).toBe(canonicalRoute);
    const resolvedSource = path.join(
      docsRoot,
      `${declaredString('route').replace(/^\/+|\/+$/g, '')}.mdx`
    );
    expect(readFileSync(resolvedSource, 'utf8')).toBe(publicMdx);
  });

  it('binds that public source to the dedicated suite demo and its existing fixture', () => {
    const demoId = declaredString('demoId');
    expect(demoId).toBe('demo-brutalist-popover');
    expect(publicMdx).toContain(`demoId="${demoId}"`);
    expect(publicMdx).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    const fixture = readFileSync(path.join(docsRoot, `${demoId}.demo.ts`), 'utf8');
    expect(fixture).toContain("'prototypeId': 'brutalist-popover-title'");
  });
});
