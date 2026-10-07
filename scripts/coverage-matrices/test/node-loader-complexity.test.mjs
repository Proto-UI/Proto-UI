import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the production lexical inventory and loader resolver in isolation.
// Other source consumers have separate traversal costs; neither their work nor
// module startup should hide a regression in this resolver's completed cache.
const checker = fs.readFileSync(new URL('../check-coverage-matrices.mjs', import.meta.url), 'utf8');
const checkerAst = ts.createSourceFile('checker.mjs', checker, ts.ScriptTarget.Latest, true);
const helper = (name) => {
  const declaration = checkerAst.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  assert.ok(declaration, `production helper ${name}`);
  return declaration.getText(checkerAst);
};
const section = (start, end) => {
  const first = checker.indexOf(start);
  const last = checker.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return checker.slice(first, last);
};
const inventory = section(
  '  const wasmBindings = new Map();',
  '  const wasmMethods = new Set('
).replace(
  'const wasmBindingAt = (name, at) => {',
  `const wasmBindingAt = (name, at) => {
    if (++lookups > 20000) throw Error('Node loader exceeded lexical lookup budget');`
);
const resolver = section(
  '  const nodeModuleImports = new Map();',
  '  const inspectNavigationValue ='
);

function probe(source, exercise = 'return [...nodeLoaderValue(target.expression, target)];') {
  const context = { ts, source, lookups: 0 };
  const values = runInNewContext(
    `
    ${helper('unwrapTypeScriptExpression')}
    ${helper('staticMemberAccess')}
    (() => {
      const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true);
      ${inventory}
      ${resolver}
      const target = sourceFile.statements.at(-1).expression;
      ${exercise}
    })();`,
    context,
    { timeout: 2000 }
  );
  return { values: JSON.parse(JSON.stringify(values)), lookups: context.lookups };
}

for (const native of [false, true]) {
  test(`Node loader complexity: repeated ${native ? 'native' : 'business'} assignments reuse completed states`, (t) => {
    const source = `import {createRequire} from 'node:module';let load=${native ? 'createRequire(import.meta.url)' : 'business'};${'load=load;'.repeat(32)}load('@proto.ui/runtime');`;
    const { values, lookups } = probe(source);
    assert.deepEqual(values, native ? ['opaque'] : []);
    // The old depth-only resolver exceeds 20,000 lookups at only 16 writes.
    // This fixed input admits quadratic inventory checks, not exponential work.
    assert.ok(lookups < 5000, `${lookups} lexical lookups for 32 writes`);
    t.diagnostic(`${lookups} lexical lookups for 32 writes`);
  });
}

test('Node loader complexity: completed shallow results cannot bypass deep or cyclic callers', () => {
  const source =
    "import {createRequire} from 'node:module';const make=createRequire;const load=make(import.meta.url);load('@proto.ui/runtime');";
  const { values } = probe(
    source,
    `
    const shallow = [...nodeLoaderValue(target.expression, target)];
    const deep = [...nodeLoaderValue(target.expression, target, new Set(Array.from({length:63}, (_, i) => 'ancestor-' + i)))];
    const binding = wasmBindingAt('load', target)[0];
    const cycle = [...nodeLoaderValue(target.expression, target, new Set(['node-loader:' + binding.position + ':load:' + target.getStart(sourceFile)]))];
    return [shallow, deep, cycle, [...nodeLoaderValue(target.expression, target)]];
  `
  );
  assert.deepEqual(values, [['loader'], ['opaque'], ['opaque'], ['loader']]);
});

test('Node loader complexity: incomplete deep results do not poison later shallow calls', () => {
  const source =
    "import {createRequire} from 'node:module';const make=createRequire;const load=make(import.meta.url);load('@proto.ui/runtime');";
  const { values } = probe(
    source,
    `
    const deep = [...nodeLoaderValue(target.expression, target, new Set(Array.from({length:63}, (_, i) => 'ancestor-' + i)))];
    return [deep, [...nodeLoaderValue(target.expression, target)]];
  `
  );
  assert.deepEqual(values, [['opaque'], ['loader']]);
});

for (const native of [false, true]) {
  test(`Node loader complexity: captured ${native ? 'native' : 'business'} cycles retain provenance`, () => {
    const source = `import {createRequire} from 'node:module';let load=${native ? 'createRequire(import.meta.url)' : 'business'};function run(){load=load;load('@proto.ui/runtime');}run();`;
    const { values } = probe(
      source,
      `
      const calls=[];
      const visit=(node)=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='load')calls.push(node);ts.forEachChild(node,visit);};
      visit(sourceFile);
      return calls.map(call=>[...nodeLoaderValue(call.expression,call)]);
    `
    );
    assert.deepEqual(values, [native ? ['opaque'] : []]);
  });
}
