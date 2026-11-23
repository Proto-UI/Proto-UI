#!/usr/bin/env node
// node --import tsx scripts/gpui/audit-source-lowering.mjs GENERATED OUTPUT.json
// Inventory, not conformance certification. Native test/link/OS results remain separate.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { OPERATION_RULES } from '../../packages/compiler/src/operations.ts';
import { TARGET_PROFILES, checkTargetOperations } from '../../packages/compiler/src/targets.ts';
import { validateIR } from '../../packages/compiler/src/ir-validation.ts';
import { gpuiNativeSdkIdentity } from '../../packages/compiler/src/gpui-native-sdk.ts';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [generated, output] = process.argv.slice(2);
if (!generated || !output || process.argv.length !== 4)
  throw new Error(
    'Usage: node --import tsx scripts/gpui/audit-source-lowering.mjs GENERATED OUTPUT.json'
  );
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const receiptBytes = readFileSync(path.join(generated, 'source-receipt.json'));
const receipt = JSON.parse(receiptBytes);
if (
  sha256(readFileSync(path.join(generated, 'transition/Cargo.toml'))) !==
  receipt.consumerManifestSha256
)
  throw new Error('The consumer manifest changed after its producer receipt.');
const emitterPath = 'packages/compiler/src/gpui-source.ts';
const emitter = readFileSync(path.join(repository, emitterPath), 'utf8');
const ast = ts.createSourceFile(emitterPath, emitter, ts.ScriptTarget.Latest, true);
const cases = new Map();
function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}
walk(ast, (node) => {
  if (!ts.isCaseClause(node) || !ts.isStringLiteral(node.expression)) return;
  const parent = node.parent.parent;
  if (!ts.isSwitchStatement(parent) || parent.expression.getText(ast) !== 'node.operation') return;
  cases.set(node.expression.text, ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
});
const moduleFacts = receipt.modules.map((module) => {
  for (const file of module.files) {
    const contents = readFileSync(
      path.join(
        generated,
        module.name,
        file.path === 'Cargo.toml' ? 'Cargo.toml.generated' : file.path
      )
    );
    if (sha256(contents) !== file.sha256)
      throw new Error(
        `Generated artifact changed after producer receipt: ${module.name}/${file.path}`
      );
  }
  const ir = JSON.parse(readFileSync(path.join(generated, module.name, 'checked-ir.json')));
  const validated = validateIR(ir);
  if (!validated.ok) throw new Error(`${module.name}: ${JSON.stringify(validated.diagnostics)}`);
  const demand = checkTargetOperations(validated.value, TARGET_PROFILES['gpui-source-v1']);
  if (!demand.ok) throw new Error(`${module.name}: ${JSON.stringify(demand.diagnostics)}`);
  const code = readFileSync(path.join(generated, module.name, 'Component.rs'), 'utf8');
  const imports = [
    ...new Set(code.split('\n').filter((line) => /^\s*(pub\s+)?use\s/.test(line))),
  ].sort();
  const expressionKinds = new Set();
  const statementKinds = new Set();
  const intrinsics = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind && node.span) {
      if ('type' in node) expressionKinds.add(node.kind);
      else statementKinds.add(node.kind);
    }
    if (node.kind === 'intrinsic') intrinsics.add(node.name);
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'sourceFiles'].includes(key)) visit(child);
  };
  // This is authored IR presence, distinct from the reached operation/function proof.
  visit(ir);
  return {
    name: module.name,
    sourceSha256: module.sourceSha256,
    generatedComponentSha256: sha256(code),
    generatedComponentBytes: Buffer.byteLength(code),
    imports,
    reachedOperations: [...demand.value.operations].sort(),
    reachedFunctionCount: demand.value.functions.length,
    reachedAuthoredHooks: [...demand.value.authoredHooks].sort(),
    expressionKinds: [...expressionKinds].sort(),
    statementKinds: [...statementKinds].sort(),
    intrinsics: [...intrinsics].sort(),
  };
});

const irSource = ts.createSourceFile(
  'ir.ts',
  readFileSync(path.join(repository, 'packages/compiler/src/ir.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
function literalProperties(alias, property) {
  const values = new Set();
  const declaration = irSource.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === alias
  );
  if (!declaration) throw new Error(`Missing IR alias ${alias}`);
  walk(declaration.type, (node) => {
    if (!ts.isPropertySignature(node) || node.name.getText(irSource) !== property || !node.type)
      return;
    walk(node.type, (value) => {
      if (ts.isLiteralTypeNode(value) && ts.isStringLiteral(value.literal))
        values.add(value.literal.text);
    });
  });
  return [...values].sort();
}
const profileOperations = new Set(TARGET_PROFILES['gpui-source-v1'].operations);
const operationInventory = Object.entries(OPERATION_RULES).map(([operation, rule]) => ({
  operation,
  declaredByGpuiProfile: profileOperations.has(operation),
  emitterCaseLine: cases.get(operation) ?? null,
  specialLowering:
    operation === 'render.el' || operation === 'render.slot'
      ? 'nativeElement/snapshotExpression'
      : operation === 'style.tw'
        ? 'compile-time style-handle'
        : operation === 'rule.declare'
          ? 'checked rule expression'
          : null,
  requiredCapabilities: rule.requiredCapabilities,
  resultType: rule.result,
  effects: rule.effects,
  generatedConsumers: moduleFacts
    .filter((module) => module.reachedOperations.includes(operation))
    .map((module) => module.name),
}));
const sourcePaths = [
  emitterPath,
  'packages/compiler/src/gpui-scalar-lowering.ts',
  'packages/compiler/src/gpui-native-owner.ts',
  'packages/compiler/src/gpui-native-sdk.ts',
  'packages/compiler/src/targets.ts',
  'packages/compiler/src/operations.ts',
  'packages/compiler/src/ir.ts',
];
const result = {
  schemaVersion: 1,
  kind: 'gpui-source-lowering-inventory',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8',
  }).trim(),
  sourceFiles: sourcePaths.map((file) => ({
    file,
    sha256: sha256(readFileSync(path.join(repository, file))),
  })),
  producerReceiptSha256: sha256(receiptBytes),
  sdk: gpuiNativeSdkIdentity(),
  evidenceBoundary:
    'Static checked-source demand and generated artifacts only. Generated consumers are not individual operation runtime passes. Retained optimized link bytes, initialization traces, OS input and accessibility require their own results.',
  representation: {
    numericAndBooleanLocals: 'f64/bool; mutable cells Rc<RefCell<f64/bool>>',
    provenDataCallables:
      'typed Rc<dyn Fn>; one stable Value callable bridge at dynamic/public boundaries',
    templates: 'NativeSnapshot and native GPUI factories; no Value::Template paint interpreter',
    strings: 'lossless Value boundary; UTF-16 comparisons include caught code units',
    ordinaryRecordsAndArrays:
      'identity-preserving Value storage remains; complete per-field native lowering is not established',
    support:
      'shared content-bound SDK source; reached operation/callback pruning controls call sites and capability initialization; full helper source selection and optimized link cost are not certified',
  },
  expressionInventory: literalProperties('ExpressionIR', 'kind')
    .filter((kind) => !['entry', 'spread'].includes(kind))
    .map((kind) => ({
      kind,
      generatedConsumers: moduleFacts
        .filter((module) => module.expressionKinds.includes(kind))
        .map((module) => module.name),
    })),
  statementInventory: literalProperties('StatementIR', 'kind').map((kind) => ({
    kind,
    generatedConsumers: moduleFacts
      .filter((module) => module.statementKinds.includes(kind))
      .map((module) => module.name),
  })),
  intrinsicInventory: literalProperties('ExpressionIR', 'name')
    .filter((name) => name.includes('.') || ['string', 'typeof', 'error'].includes(name))
    .map((name) => ({
      name,
      generatedConsumers: moduleFacts
        .filter((module) => module.intrinsics.includes(name))
        .map((module) => module.name),
    })),
  operationInventory,
  modules: moduleFacts,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    operations: operationInventory.length,
    admitted: operationInventory.filter((row) => row.declaredByGpuiProfile).length,
    generatedModules: moduleFacts.length,
    admittedWithoutGeneratedConsumer: operationInventory
      .filter((row) => row.declaredByGpuiProfile && !row.generatedConsumers.length)
      .map((row) => row.operation),
  })
);
