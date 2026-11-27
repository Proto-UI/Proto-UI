import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeProtoProgram, createProtoProgram, PROTO_TARGETS } from '@proto.ui/compiler/frontend';
import {
  createSourceManifest,
  directorySourceSnapshot,
  verifySourceManifest,
} from '@proto.ui/compiler/source-manifest';

const entry = 'app/views/entry.proto.ts';
const selected = 'app/tsconfig.json';
const inherited = 'shared/base.json';
const nearer = 'app/views/tsconfig.json';
const specifier = '@fixture/helper';
const revision = 'a'.repeat(40);
const selectedBytes = Buffer.from(
  '\uFEFF{\r\n  "extends": "../shared/base.json",\r\n  "files": ["views/entry.proto.ts"]\r\n}\r\n',
  'utf8'
);

function inheritedBytes(helper, note) {
  return Buffer.from(
    `\uFEFF{\r\n  // ${note}\r\n  "compilerOptions": { "paths": { "${specifier}": ["../helpers/${helper}.ts"] } }\r\n}\r\n`,
    'utf16le'
  );
}

function observe(directory) {
  const program = createProtoProgram({ currentDirectory: directory, rootNames: [entry] });
  const analysis = analyzeProtoProgram(program);
  assert.equal(analysis.sourceClosure.complete, true, JSON.stringify(analysis.sourceClosure.missing));
  const entryPath = path.join(directory, entry);
  const checker = program.getTypeChecker();
  const module = checker.getSymbolAtLocation(program.getSourceFile(entryPath));
  const exported = checker.getExportsOfModule(module).find(symbol => symbol.name === 'selected');
  assert.ok(exported, 'The entry must re-export the helper binding');
  const declaration = checker.getAliasedSymbol(exported).valueDeclaration;
  assert.ok(declaration, 'The checker must resolve the helper to a value declaration');
  const helper = declaration.getSourceFile().fileName;
  const edge = analysis.sourceClosure.resolutions.find(item => item.from === entryPath && item.specifier === specifier);
  assert.equal(edge?.resolvedPath, helper);
  return { analysis, helper: path.relative(directory, helper) };
}

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'proto-project-closure-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const originals = [
    [entry, 'entrypoint', `export { label as selected } from '${specifier}';\n`],
    ['helpers/a.ts', 'dependency', 'export const label = "A";\n'],
    ['helpers/b.ts', 'dependency', 'export const label = "B";\n'],
    [selected, 'configuration', selectedBytes],
    [inherited, 'configuration', inheritedBytes('a', '甲')],
    ['package.json', 'configuration', '{"type":"module"}\n'],
  ];
  for (const [name, , bytes] of originals) {
    const file = path.join(directory, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  const repositoryId = 'consumer';
  const snapshots = [directorySourceSnapshot({ directory, repositoryId, revision })];
  function bind(analysis) {
    return createSourceManifest({
      consumerId: 'project-closure',
      repositories: [{ id: repositoryId, name: 'example/consumer', revision }],
      files: originals.map(([path, role]) => ({ repositoryId, path, role })),
      entrypoints: [{ id: 'selected', repositoryId, path: entry, exportName: 'selected' }],
      configuration: {
        languageVersion: analysis.languageVersion,
        ruleSetVersion: analysis.ruleSetVersion,
        compilerVersion: analysis.compilerVersion,
        requiredTargets: [...PROTO_TARGETS],
        frontendConfigurationHash: analysis.sourceClosure.configurationHash,
        settings: {},
      },
      sourceState: 'unmigrated',
      inventory: { complete: true, missing: [], reportedCounts: [] },
    }, { snapshots });
  }
  function verify(manifest, analysis, previousEvidence) {
    return verifySourceManifest(manifest, { snapshots, configuration: manifest.configuration, analysis, previousEvidence });
  }
  const saved = observe(directory);
  assert.equal(saved.helper, 'helpers/a.ts');
  const manifest = bind(saved.analysis);
  const initial = verify(manifest, saved.analysis);
  assert.equal(initial.status, 'matched', JSON.stringify(initial.issues));
  assert.equal(initial.sharedAnalysis.boundToManifest, true);
  const previous = { inputDigest: initial.inputDigest };
  assert.equal(verify(manifest, saved.analysis, previous).priorInputEvidenceReusable, true);
  return { directory, saved, manifest, initial, previous, bind, verify };
}

test('creating only a nearer tsconfig invalidates saved evidence while all registered bytes still match', t => {
  const { directory, saved, manifest, initial, previous, verify } = fixture(t);
  const newProject = path.join(directory, nearer);
  writeFileSync(newProject, JSON.stringify({
    compilerOptions: { paths: { [specifier]: ['../../helpers/b.ts'] } },
    files: ['entry.proto.ts'],
  }), { flag: 'wx' });

  // Revalidate the original intake, analysis and configuration before building another Program.
  const cached = verify(manifest, saved.analysis, previous);
  const fresh = observe(directory);
  const probe = cached.resolutionProbes.find(item => item.path === newProject && item.kind === 'file');
  t.diagnostic(JSON.stringify({
    beforeHelper: saved.helper, freshHelper: fresh.helper, registeredFilesMatch: cached.files.every(file => file.status === 'matched'),
    savedInput: previous.inputDigest, recheckedInput: cached.inputDigest, priorReusable: cached.priorInputEvidenceReusable,
    nearerProbe: probe ? [probe.expectedExists, probe.actualExists] : null,
  }));
  assert.equal(fresh.helper, 'helpers/b.ts');
  assert.deepEqual(cached.files, initial.files);
  assert.equal(cached.manifestDigest, initial.manifestDigest);
  assert.equal(cached.configurationDigest, initial.configurationDigest);
  assert.equal(cached.priorInputEvidenceReusable, false, 'The newly present nearer project invalidates the saved analysis');
  assert.equal(cached.previousInputEvidenceMatches, false);
  assert.notEqual(cached.inputDigest, previous.inputDigest);
  assert.equal(cached.status, 'mismatch');
  assert.equal(cached.sharedAnalysis.boundToManifest, false);
  assert.ok(cached.issues.some(issue => issue.code === 'RESOLUTION_PROBE_CHANGED'));
  assert.ok(probe);
  assert.equal(probe.expectedExists, false);
  assert.equal(probe.actualExists, true);
});

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function configRecord(analysis, directory, name) {
  return analysis.sourceClosure.resolutionFiles.find(file => file.path === path.join(directory, name));
}
function assertOriginal(record, bytes, encoding) {
  assert.ok(record, 'The configuration must be present in resolutionFiles');
  assert.equal(record.sourceKind, 'disk');
  assert.equal(record.encoding, encoding);
  assert.equal(record.byteLength, bytes.byteLength);
  assert.equal(record.sha256, sha256(bytes));
}

for (const [description, helper, note] of [
  ['only a comment changes', 'a', '乙'],
  ['the inherited path selects the other helper', 'b', '甲'],
]) {
  test(`selected and inherited configuration bind their original BOM and CRLF bytes when ${description}`, t => {
    const { directory, saved, manifest, initial, previous, bind, verify } = fixture(t);
    const oldBytes = inheritedBytes('a', '甲');
    const newBytes = inheritedBytes(helper, note);
    assert.equal(oldBytes.byteLength, newBytes.byteLength);
    assert.notEqual(sha256(oldBytes), sha256(newBytes));
    writeFileSync(path.join(directory, inherited), newBytes);

    const originalIntake = verify(manifest, saved.analysis, previous);
    // Rebind only the listed bytes, retaining the saved frontend configuration and analysis.
    const rebound = bind(saved.analysis);
    const stale = verify(rebound, saved.analysis, previous);
    const fresh = observe(directory);
    const freshManifest = bind(fresh.analysis);
    const current = verify(freshManifest, fresh.analysis, previous);
    const selectedRecord = configRecord(saved.analysis, directory, selected);
    const oldRecord = configRecord(saved.analysis, directory, inherited);
    const newRecord = configRecord(fresh.analysis, directory, inherited);
    t.diagnostic(JSON.stringify({
      selectedSha256: selectedRecord?.sha256 ?? null, inheritedBefore: oldRecord?.sha256 ?? null,
      inheritedAfter: newRecord?.sha256 ?? null, freshHelper: fresh.helper, originalIntake: originalIntake.status,
      reboundWithSavedAnalysis: stale.status, reboundIssues: stale.issues.map(issue => [issue.code, issue.path]),
      freshStatus: current.status,
    }));

    assert.equal(fresh.helper, `helpers/${helper}.ts`);
    assert.equal(originalIntake.status, 'mismatch');
    assert.ok(originalIntake.issues.some(issue => issue.code === 'FILE_CHANGED' && issue.path === inherited));
    assert.equal(originalIntake.priorInputEvidenceReusable, false);
    assert.ok(stale.files.every(file => file.status === 'matched'));
    assert.deepEqual(rebound.files, freshManifest.files);
    assert.equal(stale.configurationDigest, initial.configurationDigest);
    assert.equal(stale.status, 'mismatch', 'Rebinding the manifest bytes cannot update a saved Program snapshot');
    assert.ok(stale.issues.some(issue => issue.code === 'ANALYSIS_SOURCE_CHANGED' && issue.path === inherited));
    assert.equal(stale.sharedAnalysis.boundToManifest, false);
    assert.equal(stale.priorInputEvidenceReusable, false);
    assertOriginal(selectedRecord, selectedBytes, 'utf-8');
    assertOriginal(configRecord(fresh.analysis, directory, selected), selectedBytes, 'utf-8');
    assertOriginal(oldRecord, oldBytes, 'utf-16le');
    assertOriginal(newRecord, newBytes, 'utf-16le');
    assert.notEqual(saved.analysis.sourceClosure.digest, fresh.analysis.sourceClosure.digest);
    assert.equal(current.status, 'matched', JSON.stringify(current.issues));
    assert.equal(current.previousInputEvidenceMatches, false);
    assert.equal(current.priorInputEvidenceReusable, false);
    assert.equal(verify(freshManifest, fresh.analysis, { inputDigest: current.inputDigest }).priorInputEvidenceReusable, true);
  });
}
