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
// Static anatomy guard, not native hit-testing evidence. Only the passive,
// hidden search glyph may suppress pointer events; controls and their wrappers may not.
function pointerSuppressionIsDecorative(source: string) {
  const root = ts.createSourceFile('composition.ts', source, ts.ScriptTarget.Latest, true);
  const diagnostics = (root as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics.length) return false;
  const prop = (node: ts.ObjectLiteralExpression, name: string) =>
    node.properties.find(
      (entry): entry is ts.PropertyAssignment =>
        ts.isPropertyAssignment(entry) &&
        (ts.isIdentifier(entry.name) || ts.isStringLiteralLike(entry.name)) &&
        entry.name.text === name
    )?.initializer;
  const text = (node: ts.Node | undefined) =>
    node && ts.isStringLiteralLike(node) ? node.text : undefined;
  let valid = true;
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && node.text.split(/\s+/).includes('pointer-events-none')) {
      const property = node.parent;
      const box = property?.parent;
      if (
        !property ||
        !ts.isPropertyAssignment(property) ||
        !box ||
        !ts.isObjectLiteralExpression(box) ||
        prop(box, 'className') !== node ||
        text(prop(box, 'kind')) !== 'box' ||
        text(prop(box, 'tag')) !== 'span' ||
        text(prop(box, 'ref')) !== 'query-decoration'
      )
        valid = false;
      else {
        const allowedKeys = new Set(['kind', 'tag', 'ref', 'attrs', 'className', 'children']);
        if (
          !box.properties.every(
            (entry) =>
              ts.isPropertyAssignment(entry) &&
              (ts.isIdentifier(entry.name) || ts.isStringLiteralLike(entry.name)) &&
              allowedKeys.has(entry.name.text)
          )
        )
          valid = false;
        const attrs = prop(box, 'attrs');
        const children = prop(box, 'children');
        const child =
          children && ts.isArrayLiteralExpression(children) && children.elements.length === 1
            ? children.elements[0]
            : undefined;
        if (
          !attrs ||
          !ts.isObjectLiteralExpression(attrs) ||
          attrs.properties.length !== 1 ||
          text(prop(attrs, 'aria-hidden')) !== 'true' ||
          !child ||
          !ts.isObjectLiteralExpression(child) ||
          text(prop(child, 'kind')) !== 'proto' ||
          text(prop(child, 'prototypeId')) !== 'lucide-search-icon'
        )
          valid = false;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return valid;
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
    expect(pointerSuppressionIsDecorative(composition)).toBe(true);
    expect(pointerSuppressionIsDecorative(composition + '\nconst malformed = {')).toBe(false);
    for (const interactive of [
      'onClick: () => {},',
      'tabIndex: 0,',
      "role: 'button',",
      '...interactiveProps,',
    ]) {
      expect(
        pointerSuppressionIsDecorative(
          composition.replace("ref: 'query-decoration',", `ref: 'query-decoration', ${interactive}`)
        )
      ).toBe(false);
    }
    // The former whole-file ban rejected the hidden passive glyph. Retain the
    // actual control boundary with mutation controls rather than dropping it.
    expect(
      pointerSuppressionIsDecorative(composition.replace("ref: 'query-decoration'", "ref: 'query'"))
    ).toBe(false);
    expect(
      pointerSuppressionIsDecorative(
        composition.replace("'aria-hidden': 'true'", "'aria-hidden': 'false'")
      )
    ).toBe(false);
    // Match this exact author box across formatter line breaks; a no-op mutation
    // must fail the fixture instead of certifying an untested negative control.
    const decorationTag = /tag:\s*'span',\s*ref:\s*'query-decoration'/g;
    expect([...composition.matchAll(decorationTag)]).toHaveLength(1);
    const interactiveDecoration = composition.replace(
      decorationTag,
      "tag: 'button', ref: 'query-decoration'"
    );
    expect(interactiveDecoration).not.toBe(composition);
    expect(pointerSuppressionIsDecorative(interactiveDecoration)).toBe(false);
    expect(
      pointerSuppressionIsDecorative(
        composition +
          "\nconst badInput = {kind:'proto', prototypeId:'shadcn-command-input', className:'pointer-events-none'};"
      )
    ).toBe(false);
    expect(
      pointerSuppressionIsDecorative(
        composition +
          "\nconst badItem = {kind:'proto', prototypeId:'shadcn-command-item', className:'pointer-events-none'};"
      )
    ).toBe(false);
    expect(
      pointerSuppressionIsDecorative(
        composition +
          "\nconst blockedAncestor = {kind:'box', tag:'div', className:'pointer-events-none', children:[{kind:'proto', prototypeId:'shadcn-command-input'}]};"
      )
    ).toBe(false);
  });
});
