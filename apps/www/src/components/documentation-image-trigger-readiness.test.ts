import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it } from 'vitest';

// Execute the actual browser admission predicate without importing its hooks,
// starting a server, or replacing any native interaction assertion.
const path = `${process.cwd()}/apps/www/src/components/documentation-image-preview.browser.test.ts`;
const source = readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
let predicate: ts.Expression | undefined;
const visit = (node: ts.Node) => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'page.waitForFunction') {
    const candidate = node.arguments[0];
    if (candidate?.getText(ast).includes('docs-preview-${family}')) predicate = candidate;
  }
  ts.forEachChild(node, visit);
};
visit(ast);
if (!predicate) throw new Error('Missing exact image-trigger browser readiness predicate');
const evaluate = ts.transpileModule(`const ready = ${predicate.getText(ast)}; ready;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const ready = (family: string) => runInNewContext(evaluate, { document })(family) as boolean;
afterEach(() => document.body.replaceChildren());
it.each(['shadcn', 'brutalist'] as const)(
  'accepts actual %s private trigger identity and rejects obsolete, incomplete or wrong-family controls',
  (family) => {
    const triggers = Array.from({ length: 2 }, () => {
      const node = document.createElement(`docs-preview-${family}-image-trigger`);
      node.dataset.docsImageTrigger = '';
      node.dataset.docsPreviewFamily = family;
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      document.body.append(node);
      return node;
    });
    expect(ready(family)).toBe(true);
    for (const [attribute, value] of [
      ['data-docs-preview-family', 'wrong-family'],
      ['role', 'presentation'],
      ['tabindex', '-1'],
      ['aria-disabled', 'true'],
      ['hidden', ''],
      ['inert', ''],
    ]) {
      const previous = triggers[0].getAttribute(attribute);
      triggers[0].setAttribute(attribute, value);
      expect(ready(family), attribute).toBe(false);
      if (previous === null) triggers[0].removeAttribute(attribute);
      else triggers[0].setAttribute(attribute, previous);
    }
    const obsolete = document.createElement(`docs-preview-${family}-button`);
    for (const attribute of triggers[0].attributes)
      obsolete.setAttribute(attribute.name, attribute.value);
    triggers[0].replaceWith(obsolete);
    expect(ready(family), 'family Button is no longer the image trigger').toBe(false);
    obsolete.replaceWith(triggers[0]);
    triggers[1].remove();
    expect(ready(family), 'missing trigger').toBe(false);
  }
);
