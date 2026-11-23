import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const frozenHashes = {
  'object-rest.proto.ts': '0620abf1a520182de62e4951f7f299bc2a4437e6411a02a9f021731102bbfaa1',
  'object-rest-observer.ts': '01c37a7f4ffbdada283c0080550c8c67b6e4d3cf0f986ad2d00919ffd7048e66',
};

/** Add an explicit widened data annotation; leave every executable source node unchanged. */
export function annotateFrozenLiteral(program, file) {
  const checker = program.getTypeChecker(),
    candidates = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      !node.type &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      ts.isIdentifier(node.initializer.expression.expression) &&
      node.initializer.expression.expression.text === 'Object' &&
      node.initializer.expression.name.text === 'freeze' &&
      node.initializer.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.initializer.arguments[0])
    )
      candidates.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(
    candidates.length,
    1,
    'Expected one frozen literal declaration in the original graph.'
  );
  const declaration = candidates[0];
  const fields = declaration.initializer.arguments[0].properties.map((property) => {
    assert(
      ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)),
      'The control annotates ordinary data properties only.'
    );
    const actual = checker.getTypeAtLocation(property.initializer);
    const widened = checker.getBaseTypeOfLiteralType(actual);
    return `${JSON.stringify(property.name.text)}: ${checker.typeToString(widened, property, ts.TypeFormatFlags.NoTruncation)};`;
  });
  const annotation = `: Readonly<{ ${fields.join(' ')} }>`;
  return {
    source:
      file.text.slice(0, declaration.name.end) + annotation + file.text.slice(declaration.name.end),
    edit: { start: declaration.name.end, end: declaration.name.end, annotation },
  };
}

function options() {
  const config = ts.readConfigFile(path.join(repository, 'tsconfig.json'), ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config.config, ts.sys, repository).options;
}

function checkGraph(directory) {
  const roots = Object.keys(frozenHashes).map((name) => path.join(directory, name));
  const program = ts.createProgram(roots, { ...options(), strict: true, noEmit: true });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const position =
      diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;
    return {
      code: diagnostic.code,
      category: ts.DiagnosticCategory[diagnostic.category],
      file: diagnostic.file
        ? roots.includes(diagnostic.file.fileName)
          ? path.basename(diagnostic.file.fileName)
          : path.relative(repository, diagnostic.file.fileName)
        : undefined,
      graph: !!diagnostic.file && roots.includes(diagnostic.file.fileName),
      line: position ? position.line + 1 : undefined,
      column: position ? position.character + 1 : undefined,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    };
  });
  return { program, diagnostics };
}

const transpile = (source) =>
  ts.transpileModule(source, {
    fileName: 'object-rest-observer.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;

export async function verifyObjectRestControls(input, output) {
  assert.notEqual(
    path.resolve(input),
    path.resolve(output),
    'The additive control must not overwrite original sources.'
  );
  assert.equal(
    ts.version,
    '5.9.3',
    'The original strict-TypeScript comparison is pinned to 5.9.3.'
  );
  const originals = {};
  for (const [name, expected] of Object.entries(frozenHashes)) {
    originals[name] = await readFile(
      path.join(input, 'inputs/object-rest-complete-owner', name),
      'utf8'
    );
    assert.equal(sha256(originals[name]), expected, `Frozen input hash mismatch: ${name}`);
  }
  const referenceBytes = await readFile(
    path.join(input, 'evidence/005-node-reference.json'),
    'utf8'
  );
  assert.equal(
    sha256(referenceBytes),
    'dcb8a1dd19cad2ca77e83377e827c01d872c8d1767b9b9c28554854a84688d76'
  );
  const reference = JSON.parse(referenceBytes).results;
  const originalDirectory = path.join(output, 'original'),
    lawfulDirectory = path.join(output, 'lawful-annotation-control');
  await mkdir(originalDirectory, { recursive: true });
  await mkdir(lawfulDirectory, { recursive: true });
  for (const [name, source] of Object.entries(originals))
    await writeFile(path.join(originalDirectory, name), source);
  const original = checkGraph(originalDirectory);
  const control = annotateFrozenLiteral(
    original.program,
    original.program.getSourceFile(path.join(originalDirectory, 'object-rest-observer.ts'))
  );
  const lawful = { ...originals, 'object-rest-observer.ts': control.source };
  for (const [name, source] of Object.entries(lawful))
    await writeFile(path.join(lawfulDirectory, name), source);
  const checked = checkGraph(lawfulDirectory);
  const originalJavaScript = transpile(originals['object-rest-observer.ts']);
  const lawfulJavaScript = transpile(control.source);
  assert.equal(
    lawfulJavaScript,
    originalJavaScript,
    'The lawful annotation must preserve the exact emitted helper JavaScript.'
  );
  const modulePath = path.join(output, 'ordinary-helper.mjs');
  await writeFile(modulePath, lawfulJavaScript);
  const helper = await import(pathToFileURL(modulePath).href);
  const observed = {
    rest: [helper.observeObjectRest(), helper.observeObjectRest()],
    cells: helper.observePatternCells(),
    abrupt: helper.observeAbruptRest(),
    primitives: Object.fromEntries(
      ['symbol', 'bigint', 'boolean', 'number', 'string'].map((kind) => [
        kind,
        helper.observePrimitiveKeys(kind),
      ])
    ),
  };
  assert.deepEqual(
    observed,
    reference,
    'All archived whole-helper expected values remain unchanged.'
  );
  const { parsePrototype } = await import('../../packages/compiler/src/parser.ts');
  const parse = (files) =>
    parsePrototype(files['object-rest.proto.ts'], {
      fileName: 'object-rest.proto.ts',
      files: { 'object-rest-observer.ts': files['object-rest-observer.ts'] },
    });
  const receipt = {
    schemaVersion: 1,
    typescript: ts.version,
    node: process.version,
    privateSourceAcceptance: false,
    original: {
      sourceHashes: frozenHashes,
      diagnostics: original.diagnostics,
      currentPublicCompiler: parse(originals),
    },
    additiveLawfulControl: {
      name: 'lawful-annotation-control',
      sourceHashes: Object.fromEntries(
        Object.entries(lawful).map(([name, source]) => [name, sha256(source)])
      ),
      edit: control.edit,
      diagnostics: checked.diagnostics,
      currentPublicCompiler: parse(lawful),
    },
    runtime: {
      identicalHelperJavaScript: true,
      sha256: sha256(lawfulJavaScript),
      archivedExpectedValuesMatched: true,
      observed,
      wholePrototypeExecuted: false,
      compilerGeneratedNativeExecuted: false,
      edgeOnlyFixturesExecuted: false,
    },
  };
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  const red = original.diagnostics.filter((item) => item.graph);
  assert.equal(
    red.length,
    1,
    'The original graph must retain its sole authored strict-TypeScript error.'
  );
  assert.equal(red[0].code, 2322);
  assert.equal(red[0].message, "Type '13' is not assignable to type '3'.");
  assert.equal(
    original.diagnostics.filter((item) => !item.graph).length,
    0,
    'Dependency diagnostics must not be hidden.'
  );
  assert.equal(
    checked.diagnostics.length,
    0,
    'The complete additive graph must be strict-TypeScript lawful.'
  );
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      'Usage: node --import tsx scripts/compiler/verify-object-rest-controls.mjs <recovered-private-material> <private-output>'
    );
  const receipt = await verifyObjectRestControls(path.resolve(input), path.resolve(output));
  console.log(
    JSON.stringify(
      {
        originalDiagnostics: receipt.original.diagnostics,
        lawfulDiagnostics: receipt.additiveLawfulControl.diagnostics,
        identicalHelperJavaScript: receipt.runtime.identicalHelperJavaScript,
        archivedExpectedValuesMatched: receipt.runtime.archivedExpectedValuesMatched,
        originalPublicParse: receipt.original.currentPublicCompiler.ok,
        lawfulPublicParse: receipt.additiveLawfulControl.currentPublicCompiler.ok,
      },
      null,
      2
    )
  );
}
