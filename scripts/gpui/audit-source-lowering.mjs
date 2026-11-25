#!/usr/bin/env node
/** Current HIR/admission/artifact inventory; no inherited legacy operation certificate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompiler, extractModuleIR } from '../../packages/compiler/src/index.ts';
import { GPUI_V2_DEPENDENCY } from '../../packages/compiler/src/targets/gpui.ts';
import { programSourceBinding, verifyProgramSourceBinding } from '../compiler/current-api.mjs';
import { classifyResult } from '../compiler/library-profile-inventory.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const encode = (_key, value) => {
  if (typeof value === 'bigint') return { $bigint: String(value) };
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))
    return { $number: Object.is(value, -0) ? '-0' : String(value) };
  return value;
};
const json = (value) => JSON.stringify(value, encode, 2) + '\n';

function implementationInputs() {
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(path.join(repository, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) files.push(name);
      else throw new Error('Compiler implementation input is not a regular file: ' + name);
    }
  };
  walk('packages/compiler/src');
  walk('packages/compiler/native/rust-builder/src');
  files.push(
    'packages/compiler/native/rust-builder/Cargo.toml',
    'packages/compiler/native/rust-builder/Cargo.lock',
    'scripts/gpui/audit-source-lowering.mjs',
    'scripts/compiler/current-api.mjs',
    'scripts/compiler/library-profile-inventory.mjs'
  );
  return files.sort().map((file) => {
    const bytes = readFileSync(path.join(repository, file));
    return { file, bytes: bytes.length, sha256: hash(bytes) };
  });
}

function kinds(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (typeof value.kind === 'string') found.add(value.kind);
  for (const [key, child] of Object.entries(value)) if (key !== 'span') kinds(child, found);
  return found;
}

export function auditGpuiSource(entryFile, { rootDir = repository } = {}) {
  const entry = path.resolve(rootDir, entryFile);
  const inputs = implementationInputs();
  const compiler = createCompiler({ rootDir });
  const program = compiler.session.ensureFiles([entry]);
  const sourceInputs = programSourceBinding(program);
  const extracted = extractModuleIR(program, entry);
  const result = compiler.compileFile(entry, { target: 'gpui', allowHookOnly: true });
  const classification = classifyResult(result);
  const artifacts = result.ok
    ? result.value.gpuiPrototypes.flatMap((item) => [
        { path: item.gpui.componentName + '/src/lib.rs', kind: 'source', contents: item.gpui.code },
        {
          path: item.gpui.componentName + '/Cargo.toml',
          kind: 'manifest',
          contents: item.gpui.cargoToml,
        },
      ])
    : [];
  const nativeEmitted = result.ok ? result.value.gpuiPrototypes.length : 0;
  if (result.ok && extracted.ir.prototypes.length === 0) {
    assert.ok(
      extracted.ir.authoredHooks.length > 0,
      'An empty result cannot become native emission'
    );
    classification.status = 'ANALYZED';
  } else if (result.ok) {
    assert.equal(nativeEmitted, extracted.ir.prototypes.length);
    assert.ok(nativeEmitted > 0);
  }
  verifyProgramSourceBinding(sourceInputs);
  assert.deepEqual(implementationInputs(), inputs, 'Compiler implementation changed during audit');
  return {
    schemaVersion: 2,
    kind: 'gpui-semantic-source-admission',
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repository,
      encoding: 'utf8',
    }).trim(),
    worktreeStatus: execFileSync('git', ['status', '--porcelain'], {
      cwd: repository,
      encoding: 'utf8',
    }),
    entry,
    target: 'gpui',
    defaultDependency: GPUI_V2_DEPENDENCY,
    implementationInputs: inputs,
    sourceInputs,
    status: classification.status,
    failureKind: classification.failureKind,
    diagnostics: result.diagnostics,
    semanticIR: extracted.ir,
    semanticKindsPresent: [...kinds(extracted.ir)].sort(),
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      bytes: Buffer.byteLength(artifact.contents),
      sha256: hash(artifact.contents),
    })),
    totals: {
      prototypeDeclarations: extracted.ir.prototypes.length,
      authoredHookDeclarations: extracted.ir.authoredHooks.length,
      nativeEmittedPrototypes: nativeEmitted,
      executionVerifiedPrototypes: 0,
    },
    evidenceBoundary:
      'Current source/type input, semantic HIR, target admission and actual generated artifact bytes only. HIR kind presence is not per-operation execution proof. No legacy operation/SDK certificate, Cargo target build, native window, pixel, accessibility, or real application migration is inferred.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [entry, output] = process.argv.slice(2);
  assert.ok(
    entry && output && process.argv.length === 4,
    'Usage: node --import tsx scripts/gpui/audit-source-lowering.mjs ENTRY.proto.ts NEW-REPORT.json'
  );
  const report = auditGpuiSource(entry);
  writeFileSync(output, json(report), { flag: 'wx' });
  console.log(
    JSON.stringify({ output: path.resolve(output), status: report.status, totals: report.totals })
  );
  if (report.status === 'FAIL') process.exitCode = 1;
  else if (report.status === 'UNSUPPORTED') process.exitCode = 2;
}
