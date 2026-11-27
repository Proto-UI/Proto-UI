import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const cli = fileURLToPath(new URL('../src/cli-entry.mjs', import.meta.url));
const original = new URL('../../../internal/compiler/examples/context-owned-async-tabs.proto.ts.txt', import.meta.url);
const entry = 'app/tabs.proto.ts.txt';
const bindingsFile = 'host settings/bindings.json';
const loader = 'authoring.load-tab';
const host = {
  react: { [loader]: { module: './tabs-loader', export: 'loadTab' } },
  gpui: { [loader]: { path: 'crate::tabs_loader::load_panel_tab' } },
};

function fixture(t, source = readFileSync(original), exportName = 'AsyncTabPanel') {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-cli-externs-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const directory of ['app/host settings', 'host settings', 'out']) {
    mkdirSync(path.join(cwd, directory), { recursive: true });
  }
  writeFileSync(path.join(cwd, entry), source);
  writeFileSync(path.join(cwd, 'app/tsconfig.json'), JSON.stringify({ files: ['tabs.proto.ts.txt'] }));
  // A source-relative lookup would also compile, but would publish the wrong host import.
  writeFileSync(path.join(cwd, 'app', bindingsFile), JSON.stringify({
    react: { [loader]: { module: './source-shadow', export: 'sourceShadow' } },
    gpui: { [loader]: { path: 'crate::source_shadow::source_shadow' } },
  }));
  function compile(target, output, ...args) {
    const result = spawnSync(process.execPath, [
      cli, 'compile', entry, '--export', exportName, '--target', target, '--out', output, ...args,
    ], { cwd, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    return result;
  }
  return { cwd, bindingsPath: path.join(cwd, bindingsFile), compile, sourceText: source.toString() };
}

function assertReactBinding(source) {
  const module = ts.createSourceFile('AsyncTabPanel.ts', source, ts.ScriptTarget.ESNext, true);
  const imports = module.statements.filter(ts.isImportDeclaration);
  assert.ok(!imports.some(item => item.moduleSpecifier.text === './source-shadow'));
  const declaration = imports.find(item => item.moduleSpecifier.text === './tabs-loader');
  assert.ok(declaration && !declaration.importClause?.isTypeOnly, 'expected the application loader module');
  const bindings = declaration.importClause?.namedBindings;
  assert.ok(bindings, 'expected a value import for the loader');
  if (ts.isNamedImports(bindings)) {
    assert.ok(bindings.elements.some(item => !item.isTypeOnly && (item.propertyName ?? item.name).text === 'loadTab'));
    return;
  }
  function usesLoader(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === bindings.name.text && node.name.text === 'loadTab') return true;
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && ts.isStringLiteral(node.argumentExpression)) {
      if (node.expression.text === bindings.name.text && node.argumentExpression.text === 'loadTab') return true;
    }
    return ts.forEachChild(node, usesLoader);
  }
  assert.ok(usesLoader(module), 'expected a namespace read of the registered export');
}

function assertUnbound(result, target, name, sourceText, awaitExpression) {
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /extern-unbound/);
  assert.ok(result.stderr.includes(name), result.stderr);
  assert.ok(result.stderr.includes(target), result.stderr);
  const span = /tabs\.proto\.ts\.txt:(\d+)-(\d+):/.exec(result.stderr);
  assert.ok(span, result.stderr);
  assert.equal(sourceText.slice(Number(span[1]), Number(span[2])), awaitExpression);
  assert.match(result.stderr, /^[ \t]+\S[^\r\n]* -> \S[^\r\n]* -> \S/m);
}

test('compile reads cwd-relative JSON for each target and preserves its previous module when the extern is unbound', t => {
  const { cwd, bindingsPath, compile, sourceText } = fixture(t);
  const suspension = 'await task.await(loadTab, requested)';
  for (const [target, otherTarget, output] of [
    ['react', 'gpui', 'out/AsyncTabPanel.ts'],
    ['gpui', 'react', 'out/async_tab_panel.rs'],
  ]) {
    writeFileSync(bindingsPath, JSON.stringify(host));
    const outputPath = path.join(cwd, output);
    const omitted = compile(target, output);
    assertUnbound(omitted, target, loader, sourceText, suspension);
    assert.equal(existsSync(outputPath), false);

    const accepted = compile(target, output, '--bindings', bindingsFile);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(accepted.stderr, '');
    assert.equal(accepted.stdout, '');
    const published = readFileSync(outputPath);
    const source = published.toString('utf8');
    if (target === 'react') {
      assertReactBinding(source);
    } else {
      assert.match(source, /\bcrate\s*::\s*tabs_loader\s*::\s*load_panel_tab\b/);
      assert.doesNotMatch(source, /\bsource_shadow\b/);
    }

    // The other target registers the right public key. This target has only the author's local spelling.
    writeFileSync(bindingsPath, JSON.stringify({
      [otherTarget]: host[otherTarget], [target]: { loadTab: host[target][loader] },
    }));
    const missing = compile(target, output, '--bindings', bindingsFile);
    assertUnbound(missing, target, loader, sourceText, suspension);
    assert.deepEqual(readFileSync(outputPath), published);
  }
});

test('a registered host binding still requires the target declared by the reached extern', t => {
  const source = `import { declareExtern, definePrototype } from '@proto.ui/core/authoring';
const readLabel = declareExtern<[key: string], string>({
  name: 'labels.browser', effect: 'after-state-commit', lifetime: 'task', async: true, targets: ['react'],
});
export const Label = definePrototype({ name: 'label', setup(def) {
  const label = def.state.define<string>('label', { initialize: () => '' });
  const load = def.task('load', { policy: 'latest' }, async task => {
    const value = await task.await(readLabel, 'main');
    task.set(label, value);
  });
  const refresh = def.action('refresh', run => { run.start(load); });
  def.lifecycle.onCreated(refresh);
  return view => view.el('span', {}, [view.get(label)]);
} });\n`;
  const { cwd, bindingsPath, compile } = fixture(t, source, 'Label');
  writeFileSync(bindingsPath, JSON.stringify({
    react: { 'labels.browser': { module: './browser-labels', export: 'readLabel' } },
    gpui: { 'labels.browser': { path: 'crate::labels::read_label' } },
  }));
  const output = 'out/label';
  const accepted = compile('react', output, '--bindings', bindingsFile);
  assert.equal(accepted.status, 0, accepted.stderr);
  const previous = readFileSync(path.join(cwd, output));
  const imports = ts.preProcessFile(previous.toString('utf8')).importedFiles;
  assert.ok(imports.some(item => item.fileName === './browser-labels'));

  const unadmitted = compile('gpui', output, '--bindings', bindingsFile);
  assertUnbound(unadmitted, 'gpui', 'labels.browser', source, "await task.await(readLabel, 'main')");
  assert.deepEqual(readFileSync(path.join(cwd, output)), previous);
});

test('malformed binding files and invocations report usage and preserve the output bytes', t => {
  const { cwd, bindingsPath, compile } = fixture(t);
  const output = 'out/previous';
  const outputPath = path.join(cwd, output);
  const previous = Buffer.from([0xff, 0x00, 0x0d, 0x0a]);
  writeFileSync(outputPath, previous);
  const cases = [
    ['react', '{', ['--bindings', bindingsFile]],
    ['react', JSON.stringify({ unknown: {} }), ['--bindings', bindingsFile]],
    ['react', JSON.stringify({ react: [] }), ['--bindings', bindingsFile]],
    ['react', JSON.stringify({ react: { [loader]: { module: './tabs-loader' } } }), ['--bindings', bindingsFile]],
    ['gpui', JSON.stringify({ gpui: { [loader]: { path: 7 } } }), ['--bindings', bindingsFile]],
    ['react', '{}', ['--bindings', 'absent.json']],
    ['react', '{}', ['--bindings']],
    ['gpui', '{}', ['--bindings', bindingsFile, '--bindings', bindingsFile]],
  ];
  for (const [target, contents, args] of cases) {
    writeFileSync(bindingsPath, contents);
    const rejected = compile(target, output, ...args);
    assert.equal(rejected.status, 64, `${target} ${JSON.stringify(args)} ${contents}\n${rejected.stderr}`);
    assert.equal(rejected.stdout, '');
    assert.match(rejected.stderr, /Usage: proto-compiler compile/);
    assert.match(rejected.stderr.split('Usage:')[0], /binding/i);
    assert.deepEqual(readFileSync(outputPath), previous);
  }
});
