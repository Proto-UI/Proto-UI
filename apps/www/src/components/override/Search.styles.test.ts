import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
const search = readFileSync('apps/www/src/components/override/Search.astro', 'utf8');
const website = readFileSync('apps/www/src/styles/search-trigger.css', 'utf8');
const mask = readFileSync('packages/prototypes/shadcn/src/command/dialog-mask.proto.ts', 'utf8');
const composition = readFileSync('apps/www/src/components/site-search-composition.ts', 'utf8');
function publicMask(source: string) {
  const root = ts.createSourceFile('mask.ts', source, ts.ScriptTarget.Latest, true);
  let base = 0;
  const tokens: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'asDialogMask') base++;
      if (node.expression.text === 'tw')
        for (const arg of node.arguments)
          if (ts.isStringLiteralLike(arg)) tokens.push(...arg.text.split(/\s+/));
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return (
    base === 1 &&
    ['fixed', 'inset-0', 'bg-transparent'].every((token) => tokens.includes(token)) &&
    !tokens.some((token) => /^(?:bg-black|backdrop-blur)/.test(token))
  );
}
function layoutOnly(css: string) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return (
    !/pagefind-ui|::backdrop|dialog-frame|search-failure|search-toolbar/.test(code) &&
    !/(?:^|[;{])\s*(?:background(?:-color)?|color|border(?:-color|-width|-radius)?|box-shadow|outline)\s*:/m.test(
      code
    ) &&
    !/@apply\s+[^;]*(?:bg-|shadow|border|rounded|text-)/.test(code)
  );
}
function ownerContentFlow(css: string) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const selector =
    'site-search [data-search-composition-mount] ' +
    '> :is([data-search-command-mount], [data-search-dialog-mount]) ' +
    '> .pui-projection-generation > .pui-projection-scope > .pui-projection-content';
  const start = code.indexOf(`${selector} {`);
  if (start < 0) return false;
  const body = code.slice(start + selector.length + 2).split('}')[0];
  const declarations = Object.fromEntries(
    body
      .split(';')
      .map((declaration) => declaration.split(':').map((part) => part.trim()))
      .filter(([property, value]) => property && value)
  );
  return (
    declarations.display === 'flex' &&
    declarations['align-items'] === 'center' &&
    Object.keys(declarations).every((property) => ['display', 'align-items'].includes(property))
  );
}
describe('Search public presentation boundary', () => {
  it('has no default-ui/native-modal page skin while retaining startup/trigger layout', () => {
    expect(search).not.toContain('@pagefind/default-ui');
    expect(layoutOnly(website)).toBe(true);
    expect(layoutOnly(`${website}\nsite-search { background: red; }`)).toBe(false);
    expect(layoutOnly(`${website}\n.pagefind-ui__result-link::after { content: ''; }`)).toBe(false);
    expect(website).toContain('--site-search-trigger-width');
    expect(website).toContain('data-search-startup-button');
    expect(website).toContain('data-search-view');
    expect(website).toContain('@layer components');
  });
  it('lays out both direct Search owner roots without inline struts or hiding the Dialog', () => {
    expect(ownerContentFlow(website)).toBe(true);
    expect(ownerContentFlow(website.replace('display: flex;', 'display: block;'))).toBe(false);
    expect(
      ownerContentFlow(website.replace('align-items: center;', 'align-items: baseline;'))
    ).toBe(false);
    expect(
      ownerContentFlow(website.replace('[data-search-dialog-mount]', '[data-other-dialog-mount]'))
    ).toBe(false);
    expect(ownerContentFlow(website.replace('display: flex;', 'display: flex; height: 0;'))).toBe(
      false
    );
  });
  it('keeps a transparent public semantic Mask, not no blocker or a CSS-only backdrop', () => {
    expect(publicMask(mask)).toBe(true);
    expect(publicMask(mask.replace(/asDialogMask\s*\(\s*\)/, 'undefined'))).toBe(false);
    expect(publicMask(mask.replace('bg-transparent', 'bg-black'))).toBe(false);
    expect(composition).toContain('command-dialog-mask');
    expect(composition).toContain('dialog-mask');
    expect(composition).toContain('enterDuration: duration');
    expect(composition).toContain('leaveDuration: duration');
  });
  it('keeps actual public result activation instead of disabling hit targets', () => {
    const root = ts.createSourceFile('composition.ts', composition, ts.ScriptTarget.Latest, true);
    let item = false;
    let execute = false;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'proto' &&
          node.arguments[0] &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          node.arguments[0].text === 'command-item'
        )
          item = true;
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'execute'
        )
          execute = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    expect(item && execute).toBe(true);
    expect(composition).toContain('data-search-result-url');
    expect(composition).not.toContain('pointer-events-none');
  });
});
