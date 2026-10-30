import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
const read = (name: string) => readFileSync(`apps/www/src/components/${name}`, 'utf8');
const astro = read('override/Search.astro');
const commands = read('site-search-commands.ts');
const composition = read('site-search-composition.ts');
const session = read('site-search-session.ts');
function ast(source: string) {
  return ts.createSourceFile('contract.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function calls(source: string, method: string) {
  const root = ast(source);
  const found: ts.CallExpression[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      let expression: ts.Expression = node.expression;
      while (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression))
        expression = expression.expression;
      if (
        (ts.isPropertyAccessExpression(expression) && expression.name.text === method) ||
        (ts.isIdentifier(expression) && expression.text === method)
      )
        found.push(node);
    }
    ts.forEachChild(node, walk);
  };
  walk(root);
  return found;
}
function textArg(node: ts.CallExpression, index = 0) {
  const arg = node.arguments[index];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
}
function clientScript(source: string) {
  const start = source.indexOf('<script>');
  const end = source.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('Missing Search client script');
  return source.slice(start + '<script>'.length, end);
}
const script = clientScript(astro);
function publicBoundary(source: string) {
  const imported: string[] = [];
  const root = ast(source);
  for (const node of root.statements)
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      imported.push(node.moduleSpecifier.text);
  return (
    !imported.some((name) => name.includes('@pagefind/default-ui')) &&
    calls(source, 'showModal').length === 0 &&
    calls(source, 'querySelector').every((call) => !textArg(call)?.includes('dialog'))
  );
}
describe('Search public ownership and startup contract', () => {
  it('has one disabled SSR button, a noJS link, and only public runtime ownership', () => {
    expect(astro.match(/<button\b/g)).toHaveLength(1);
    expect(astro).toMatch(/<button\b[^>]*\bdisabled\b[^>]*aria-disabled="true"/s);
    expect(astro).toContain('data-search-startup-button');
    expect(astro).toContain('data-search-dialog-mount');
    expect(astro).toMatch(/<noscript\b[\s\S]*?<a\s+href=\{documentationUrl\}/);
    expect(astro).not.toMatch(/<dialog\b/);
    expect(publicBoundary(script)).toBe(true);
    expect(publicBoundary(`${script}\ndialog.showModal();`)).toBe(false);
    expect(publicBoundary(`import '@pagefind/default-ui';\n${script}`)).toBe(false);
  });
  it('keeps Search within the page transaction and selects a real Dialog manifest', () => {
    const home = read('Homepage/homepage-runtime-client.ts');
    expect(
      calls(home, 'materialize').some((call) => call.expression.getText().startsWith('search'))
    ).toBe(true);
    expect(
      calls(home, 'rollback').some((call) =>
        call.expression.getText().includes('searchPublication')
      )
    ).toBe(true);
    expect(commands).toContain('Homepage Search must use its page transaction');
    const materialize = calls(commands, 'materializeProjectionCandidate');
    expect(
      materialize.some((call) => {
        const options = call.arguments[1];
        return (
          options &&
          ts.isObjectLiteralExpression(options) &&
          options.properties.some(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              prop.name.getText() === 'componentId' &&
              ts.isStringLiteral(prop.initializer) &&
              prop.initializer.text === 'dialog'
          )
        );
      })
    ).toBe(true);
    expect(calls(composition, 'proto').some((call) => textArg(call) === 'dialog-root')).toBe(true);
    expect(
      calls(composition, 'proto').some((call) => textArg(call) === 'command-dialog-content')
    ).toBe(true);
    expect(calls(composition, 'proto').some((call) => textArg(call) === 'command-root')).toBe(true);
  });
  it('prepares from public intent, queues activation, and retains public instance binding', () => {
    expect(calls(commands, 'getExposes').some((call) => textArg(call) === 'search-command')).toBe(
      true
    );
    const arrays: string[][] = [];
    const scan = (node: ts.Node) => {
      if (ts.isArrayLiteralExpression(node))
        arrays.push(node.elements.filter(ts.isStringLiteralLike).map((value) => value.text));
      ts.forEachChild(node, scan);
    };
    scan(ast(commands));
    expect(
      arrays.some(
        (values) =>
          values.length === 2 && values.includes('hovered') && values.includes('focusVisible')
      )
    ).toBe(true);
    expect(calls(commands, 'subscribe').length).toBeGreaterThan(0);
    expect(calls(commands, 'queueMicrotask').length).toBeGreaterThan(0);
    expect(
      calls(commands, 'addEventListener').some(
        (call) =>
          ['pointerenter', 'mouseenter', 'focus', 'focusin'].includes(textArg(call) ?? '') &&
          call.expression.getText().startsWith('button.')
      )
    ).toBe(false);
    expect(calls(composition, 'subscribePublicInstances')).toHaveLength(1);
    expect(calls(composition, 'bindInputShellControl')).toHaveLength(1);
    expect(calls(composition, 'setChildren').some((call) => textArg(call) === 'results')).toBe(
      true
    );
    expect(
      calls(composition, 'call').some(
        (call) => textArg(call) === 'query' && textArg(call, 1) === 'focusSelf'
      )
    ).toBe(true);
    expect(script).not.toMatch(/requestIdleCallback|DOMContentLoaded/);
  });
  it('keeps modifier guards, public toggle, cancellation and disposal explicit', () => {
    expect(script).toContain('event.defaultPrevented');
    expect(script).toContain('event.isComposing');
    expect(script).toContain('event.altKey');
    expect(calls(script, 'toggle')).toHaveLength(1);
    expect(
      calls(script, 'addEventListener').some((call) => textArg(call) === 'astro:before-swap')
    ).toBe(true);
    expect(calls(script, 'removeEventListener').some((call) => textArg(call) === 'keydown')).toBe(
      true
    );
    expect(
      calls(script, 'removeEventListener').some((call) => textArg(call) === 'astro:before-swap')
    ).toBe(true);
    expect(calls(session, 'cancel')).toHaveLength(1);
    expect(calls(session, 'prepare').length).toBeGreaterThan(0);
    expect(calls(session, 'dispose')).toHaveLength(1);
    const evidence = readFileSync(
      'apps/www/src/content/docs/zh-cn/site-search-evidence.ts',
      'utf8'
    );
    const root = ast(evidence);
    let budget: number | undefined;
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText() === 'SEARCH_READINESS_BUDGET_MS' &&
        node.initializer &&
        ts.isNumericLiteral(node.initializer)
      )
        budget = Number(node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(root);
    expect(budget).toBe(1000);
  });
});
