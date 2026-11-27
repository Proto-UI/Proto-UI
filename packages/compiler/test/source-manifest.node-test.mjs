import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { analyzeProtoFiles, PROTO_TARGETS } from '../src/frontend/index.ts';
import {
  createSourceManifest,
  directorySourceSnapshot,
  parseSourceManifest,
  sourceManifestDigest,
  verifySourceManifest,
} from '../src/source-manifest.ts';

const REVISION = 'a'.repeat(40);

function fixture(t, input = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'proto-manifest-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const contents = {
    'entry.proto.ts': 'import { label } from "./helper.proto.ts"; export const component = label;',
    'helper.proto.ts': 'export const label = "A🙂";',
    'consumer.json': '{"mode":"adapter"}\r\n',
    'tsconfig.json': '{"files":["entry.proto.ts"]}\n',
    ...input,
  };
  for (const [file, source] of Object.entries(contents))
    writeFileSync(path.join(directory, file), source);
  const snapshot = directorySourceSnapshot({
    repositoryId: 'consumer',
    revision: REVISION,
    directory,
  });
  const analyze = () =>
    analyzeProtoFiles({ rootNames: ['entry.proto.ts'], currentDirectory: directory });
  const analysis = analyze();
  const configuration = {
    languageVersion: analysis.languageVersion,
    ruleSetVersion: analysis.ruleSetVersion,
    compilerVersion: analysis.compilerVersion,
    requiredTargets: [...PROTO_TARGETS],
    frontendConfigurationHash: analysis.sourceClosure.configurationHash,
    settings: { paths: {}, bindings: {} },
  };
  const request = {
    consumerId: 'fixture',
    repositories: [{ id: 'consumer', name: 'example/consumer', revision: REVISION }],
    files: [
      { repositoryId: 'consumer', path: 'entry.proto.ts', role: 'entrypoint' },
      { repositoryId: 'consumer', path: 'helper.proto.ts', role: 'dependency' },
      { repositoryId: 'consumer', path: 'consumer.json', role: 'configuration' },
      { repositoryId: 'consumer', path: 'tsconfig.json', role: 'configuration' },
    ],
    entrypoints: [
      {
        id: 'component',
        repositoryId: 'consumer',
        path: 'entry.proto.ts',
        exportName: 'component',
      },
    ],
    configuration,
    sourceState: 'unmigrated',
    inventory: { complete: true, missing: [], reportedCounts: [] },
  };
  const manifest = createSourceManifest(request, { snapshots: [snapshot] });
  const verify = (options = {}, selectedManifest = manifest) =>
    verifySourceManifest(selectedManifest, {
      snapshots: [snapshot],
      configuration,
      analysis,
      ...options,
    });
  return { directory, snapshot, analyze, analysis, configuration, request, manifest, verify };
}

test('a matched exact input set distinguishes entrypoints, helper files and compilation', (t) => {
  const f = fixture(t);
  const report = f.verify();
  assert.equal(report.status, 'matched');
  assert.equal(report.counts.declaredFiles, 4);
  assert.equal(report.counts.declaredSourceFiles, 2);
  assert.equal(report.counts.declaredDependencyFiles, 1);
  assert.equal(report.counts.declaredEntrypoints, 1);
  assert.equal(report.counts.entrypointsWithMatchedSourceBytes, 1);
  assert.equal(report.sourceValid, null);
  assert.equal(report.compilationVerified, false);
  assert.equal(report.conformanceVerified, false);
  assert.equal(f.manifest.sourceState, 'unmigrated');
  const repeated = f.verify({ previousEvidence: { inputDigest: report.inputDigest } });
  assert.equal(repeated.previousInputEvidenceMatches, true);
  assert.equal(repeated.priorInputEvidenceReusable, true);
});

test('a transitive helper byte change invalidates old input evidence without dropping a component', (t) => {
  const f = fixture(t);
  const previous = f.verify();
  writeFileSync(path.join(f.directory, 'helper.proto.ts'), 'export const label = "changed";');
  const report = f.verify({ previousEvidence: { inputDigest: previous.inputDigest } });
  assert.equal(report.status, 'mismatch');
  assert.ok(
    report.issues.some((issue) => issue.code === 'FILE_CHANGED' && issue.path === 'helper.proto.ts')
  );
  assert.equal(report.previousInputEvidenceMatches, false);
  assert.equal(report.priorInputEvidenceReusable, false);
  assert.equal(report.counts.declaredEntrypoints, 1);
  assert.equal(report.counts.declaredSourceFiles, 2);
});

test('a missing dependency remains in the explicit denominator', (t) => {
  const f = fixture(t);
  rmSync(path.join(f.directory, 'helper.proto.ts'));
  const report = f.verify();
  assert.ok(
    report.issues.some((issue) => issue.code === 'FILE_MISSING' && issue.path === 'helper.proto.ts')
  );
  assert.equal(report.counts.declaredDependencyFiles, 1);
  assert.equal(report.counts.declaredSourceFiles, 2);
  assert.equal(report.counts.matchedSourceFiles, 1);
  assert.equal(report.priorInputEvidenceReusable, false);
});

test('language, rule and binding configuration changes invalidate prior evidence', (t) => {
  const f = fixture(t);
  const prior = f.verify();
  for (const configuration of [
    { ...f.configuration, languageVersion: '0.5' },
    { ...f.configuration, ruleSetVersion: '0.4.0-draft.2' },
    { ...f.configuration, settings: { paths: {}, bindings: { window: 'different-host' } } },
  ]) {
    const report = f.verify({
      configuration,
      previousEvidence: { inputDigest: prior.inputDigest },
    });
    assert.equal(report.status, 'mismatch');
    assert.ok(report.issues.some((issue) => issue.code === 'CONFIGURATION_CHANGED'));
    assert.equal(report.previousInputEvidenceMatches, false);
  }
});

test('a signed-zero binding configuration change invalidates input evidence without normalizing it', (t) => {
  const f = fixture(t);
  const configuration = { ...f.configuration, settings: { bindings: { scale: 0 } } };
  const request = { ...f.request, configuration };
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  const previous = f.verify({ configuration }, manifest);
  assert.equal(previous.status, 'matched');
  const changed = { ...configuration, settings: { bindings: { scale: -0 } } };
  const report = f.verify({ configuration: changed, previousEvidence: previous }, manifest);
  assert.equal(report.status, 'mismatch');
  assert.ok(report.issues.some((item) => item.code === 'CONFIGURATION_CHANGED'));
  assert.notEqual(report.configurationDigest, previous.configurationDigest);
  assert.equal(report.previousInputEvidenceMatches, false);
  assert.equal(report.priorInputEvidenceReusable, false);
  const negative = createSourceManifest(
    { ...request, configuration: changed },
    { snapshots: [f.snapshot] }
  );
  assert.equal(Object.is(negative.configuration.settings.bindings.scale, -0), true);
  assert.notEqual(sourceManifestDigest(negative), sourceManifestDigest(manifest));
});

test('a new higher-priority helper invalidates an old closure even when listed bytes are unchanged', (t) => {
  const f = fixture(t, {
    'entry.proto.ts': 'import { label } from "./candidate"; export const component = label;',
    'candidate.d.ts': 'export declare const label: string;',
  });
  const request = structuredClone(f.request);
  request.files.push({ repositoryId: 'consumer', path: 'candidate.d.ts', role: 'dependency' });
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  const previous = f.verify({}, manifest);
  assert.equal(previous.status, 'matched');
  writeFileSync(path.join(f.directory, 'candidate.ts'), 'export const label = 1;');
  const report = f.verify({ previousEvidence: previous }, manifest);
  assert.ok(report.files.every((file) => file.status === 'matched'));
  assert.equal(report.status, 'mismatch');
  assert.ok(report.issues.some((item) => item.code === 'RESOLUTION_PROBE_CHANGED'));
  assert.equal(report.previousInputEvidenceMatches, false);
  assert.equal(report.priorInputEvidenceReusable, false);
  assert.ok(
    report.resolutionProbes.some(
      (item) =>
        item.path === path.join(f.directory, 'candidate.ts') &&
        item.expectedExists === false &&
        item.actualExists === true
    )
  );
});

for (const existingDirectory of [false, true]) {
  test(`a new resolution ${existingDirectory ? 'package.json' : 'directory'} invalidates a cached paths fallback`, (t) => {
    const f = fixture(t, {
      'entry.proto.ts': 'import { label } from "@candidate"; export const component = label;',
    });
    const candidate = path.join(f.directory, 'candidate');
    if (existingDirectory) mkdirSync(candidate);
    const analysis = analyzeProtoFiles({
      rootNames: ['entry.proto.ts'],
      currentDirectory: f.directory,
      compilerOptions: { paths: { '@candidate': ['./candidate', './helper.proto.ts'] } },
    });
    const configuration = {
      ...f.configuration,
      frontendConfigurationHash: analysis.sourceClosure.configurationHash,
    };
    const manifest = createSourceManifest(
      { ...f.request, configuration },
      { snapshots: [f.snapshot] }
    );
    const previous = f.verify({ configuration, analysis }, manifest);
    assert.equal(previous.status, 'matched');
    mkdirSync(candidate, { recursive: true });
    writeFileSync(path.join(candidate, 'package.json'), JSON.stringify({ types: './entry.d.ts' }));
    writeFileSync(path.join(candidate, 'entry.d.ts'), 'export declare const label: number;');
    const report = f.verify({ configuration, analysis, previousEvidence: previous }, manifest);
    assert.ok(report.files.every((file) => file.status === 'matched'));
    assert.equal(report.status, 'mismatch');
    assert.ok(report.issues.some((item) => item.code === 'RESOLUTION_PROBE_CHANGED'));
    assert.equal(report.previousInputEvidenceMatches, false);
    assert.equal(report.priorInputEvidenceReusable, false);
    assert.ok(
      report.resolutionProbes.some(
        (item) =>
          item.path === (existingDirectory ? path.join(candidate, 'package.json') : candidate) &&
          item.kind === (existingDirectory ? 'file' : 'directory') &&
          item.expectedExists === false &&
          item.actualExists === true
      )
    );
  });
}

test('a custom byte reader without required existence proof remains incomplete', (t) => {
  const f = fixture(t);
  const previous = f.verify();
  const { probePath: _probePath, ...byteReader } = f.snapshot;
  const report = f.verify({ snapshots: [byteReader], previousEvidence: previous });
  assert.ok(report.files.every((file) => file.status === 'matched'));
  assert.equal(report.status, 'incomplete');
  assert.ok(report.issues.some((item) => item.code === 'RESOLUTION_PROBE_UNAVAILABLE'));
  assert.equal(report.sharedAnalysis.boundToManifest, false);
  assert.equal(report.priorInputEvidenceReusable, false);
});

test('a different repository revision is rejected even when its bytes could be identical', (t) => {
  const f = fixture(t);
  let reads = 0;
  const changed = {
    ...f.snapshot,
    revision: 'b'.repeat(40),
    readFile() {
      reads++;
      throw new Error('wrong snapshot must not be read');
    },
  };
  const report = f.verify({ snapshots: [changed] });
  assert.equal(report.status, 'mismatch');
  assert.equal(reads, 0);
  assert.ok(report.issues.some((issue) => issue.code === 'REVISION_CHANGED'));
  assert.ok(report.files.every((file) => file.status === 'revision-mismatch'));
});

test('files absent during intake stay unbound when they later appear', (t) => {
  const f = fixture(t);
  const request = structuredClone(f.request);
  request.files.push({ repositoryId: 'consumer', path: 'not-yet-provided.ts', role: 'dependency' });
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  assert.equal(manifest.inventory.complete, false);
  assert.equal(manifest.files.find((file) => file.path === 'not-yet-provided.ts').sha256, null);
  writeFileSync(path.join(f.directory, 'not-yet-provided.ts'), 'export const value = 1;');
  const report = f.verify({}, manifest);
  assert.equal(report.status, 'incomplete');
  assert.ok(report.issues.some((issue) => issue.code === 'FILE_DIGEST_UNBOUND'));
  assert.equal(report.counts.declaredSourceFiles, 3);
});

test('the shared frontend detects an omitted helper; this module does not resolve modules itself', (t) => {
  const f = fixture(t);
  const request = structuredClone(f.request);
  request.files = request.files.filter((file) => file.path !== 'helper.proto.ts');
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  const report = f.verify({}, manifest);
  assert.equal(report.status, 'incomplete');
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === 'DEPENDENCY_NOT_REGISTERED' && issue.message.includes('helper.proto.ts')
    )
  );
  assert.equal(report.sharedAnalysis.boundToManifest, false);
});

test('matching listed bytes without a shared closure remains incomplete', (t) => {
  const f = fixture(t);
  const report = f.verify({ analysis: undefined });
  assert.equal(report.status, 'incomplete');
  assert.ok(report.files.every((file) => file.status === 'matched'));
  assert.ok(report.issues.some((issue) => issue.code === 'SHARED_ANALYSIS_MISSING'));
  assert.equal(report.compilationVerified, false);
});

test('a stale analysis is rejected after explicitly regenerating changed source digests', (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.directory, 'helper.proto.ts'), 'export const label = "new revision";');
  const freshManifest = createSourceManifest(f.request, { snapshots: [f.snapshot] });
  const report = f.verify({}, freshManifest);
  assert.ok(report.files.every((file) => file.status === 'matched'));
  assert.ok(report.issues.some((issue) => issue.code === 'ANALYSIS_SOURCE_CHANGED'));
  assert.equal(report.status, 'mismatch');
  assert.equal(report.sourceValid, null);
});

test('reported source counts never become verified component counts or hide partial scope', (t) => {
  const f = fixture(t);
  const request = structuredClone(f.request);
  request.inventory = {
    complete: false,
    missing: ['Upstream per-path list has not been supplied.'],
    reportedCounts: [
      {
        scope: 'upstream',
        unit: 'files',
        count: 204,
        source: 'https://example.test/comment',
        revision: '67fd94f5',
      },
      {
        scope: 'consumer',
        unit: 'prototype-declarations',
        count: 2,
        source: 'https://example.test/comment',
      },
    ],
  };
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  const report = f.verify({}, manifest);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.counts.declaredEntrypoints, 1);
  assert.equal(report.counts.declaredSourceFiles, 2);
  assert.equal(report.counts.reported[0].count, 204);
  assert.ok(report.issues.some((issue) => issue.code === 'INVENTORY_INCOMPLETE'));
});

test('raw bytes, including line endings and non-text content, are hashed without normalization', (t) => {
  const f = fixture(t, { 'consumer.json': Buffer.from([0xef, 0xbb, 0xbf, 0x0d, 0x0a, 0xff]) });
  const expected = createHash('sha256')
    .update(readFileSync(path.join(f.directory, 'consumer.json')))
    .digest('hex');
  assert.equal(f.manifest.files.find((file) => file.path === 'consumer.json').sha256, expected);
  writeFileSync(
    path.join(f.directory, 'consumer.json'),
    Buffer.from([0xef, 0xbb, 0xbf, 0x0a, 0xff])
  );
  assert.ok(
    f
      .verify()
      .issues.some((issue) => issue.code === 'FILE_CHANGED' && issue.path === 'consumer.json')
  );
});

test('invalid paths, shortened revisions, duplicated files and target omissions are rejected before reads', (t) => {
  const f = fixture(t);
  const change = (mutate) => {
    const manifest = structuredClone(f.manifest);
    mutate(manifest);
    return manifest;
  };
  for (const manifest of [
    change((value) => {
      value.files[0].path = '../escape.ts';
    }),
    change((value) => {
      value.repositories[0].revision = 'a'.repeat(8);
    }),
    change((value) => {
      value.files.push(value.files[0]);
    }),
    change((value) => {
      value.entrypoints.push(value.entrypoints[0]);
    }),
    change((value) => {
      value.configuration.requiredTargets = ['react'];
    }),
    change((value) => {
      value.files[0].sha256 = 'incorrect';
    }),
    change((value) => {
      value.files[0].byteLength = -1;
    }),
    change((value) => {
      value.entrypoints[0].path = 'helper.proto.ts';
    }),
  ])
    assert.throws(() => parseSourceManifest(manifest), TypeError);
  const cyclic = structuredClone(f.manifest);
  cyclic.provenance = { cycle: cyclic };
  assert.throws(() => parseSourceManifest(cyclic), /acyclic/);
});

test('a directory reader refuses a symlink escaping the selected source snapshot', (t) => {
  const f = fixture(t);
  const outside = mkdtempSync(path.join(tmpdir(), 'proto-manifest-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(outside, 'outside.ts'), 'outside snapshot');
  symlinkSync(path.join(outside, 'outside.ts'), path.join(f.directory, 'escaped.ts'));
  assert.throws(() => f.snapshot.readFile('escaped.ts'), /escapes/);
});

test('an independently supplied Git blob mismatch leaves the intake missing', (t) => {
  const f = fixture(t);
  const request = structuredClone(f.request);
  request.files[0].gitBlob = '0'.repeat(40);
  const manifest = createSourceManifest(request, { snapshots: [f.snapshot] });
  assert.equal(manifest.inventory.complete, false);
  assert.equal(manifest.files.find((file) => file.path === request.files[0].path).sha256, null);
  assert.ok(
    manifest.inventory.missing.some((reason) => reason.includes('Git blob identity mismatch'))
  );
});

test('intake reads source without executing top-level author code or rewriting its input', (t) => {
  const f = fixture(t, {
    'helper.proto.ts': 'throw new Error("must not execute"); export const label = "read-only";',
  });
  const before = readFileSync(path.join(f.directory, 'helper.proto.ts'));
  const report = f.verify();
  assert.equal(report.status, 'matched');
  assert.deepEqual(readFileSync(path.join(f.directory, 'helper.proto.ts')), before);
  assert.equal(report.compilationVerified, false);
});

test('canonical manifest identity ignores object insertion and file ordering without mutating input', (t) => {
  const f = fixture(t);
  const reordered = structuredClone(f.manifest);
  reordered.files.reverse();
  reordered.configuration.requiredTargets.reverse();
  const original = JSON.stringify(reordered);
  assert.equal(sourceManifestDigest(reordered), sourceManifestDigest(f.manifest));
  assert.equal(JSON.stringify(reordered), original);
});

test('the real Shenko intake keeps reported counts, observed declarations and selected revisions separate', () => {
  const manifest = parseSourceManifest(
    JSON.parse(
      readFileSync(
        new URL(
          '../../../internal/compiler/consumers/shenko-73d091ff.intake.json',
          import.meta.url
        ),
        'utf8'
      )
    )
  );
  assert.equal(manifest.inventory.complete, false);
  assert.equal(manifest.sourceState, 'unmigrated');
  assert.equal(manifest.configuration.frontendConfigurationHash, null);
  assert.equal(
    manifest.repositories.find((repository) => repository.id === 'shenko').revision,
    '73d091ff581debe486b4bc809c3d001fbbdd3cb0'
  );
  assert.equal(
    manifest.repositories.find((repository) => repository.id === 'proto-ui').revision,
    '710a90df2ea57d9f93d7d09e43ebfb2b7b8e5057'
  );
  assert.equal(manifest.entrypoints.length, 2);
  assert.equal(manifest.files.filter((file) => file.role === 'dependency').length, 0);
  assert.equal(manifest.provenance.additionalUnregisteredDeclarations.length, 4);
  assert.ok(
    manifest.inventory.reportedCounts.some(
      (count) => count.count === 204 && count.unit === 'files' && count.revision === '67fd94f5'
    )
  );
  assert.equal(manifest.provenance.separateMainObservation.selectedForThisIntake, false);
});

test('Unicode key insertion order preserves configuration identity without merging distinct keys', (t) => {
  const f = fixture(t);
  const settings = { bindings: { '\u00e9': 1, 'e\u0301': 2 } };
  const configuration = { ...f.configuration, settings };
  const manifest = createSourceManifest(
    { ...f.request, configuration },
    { snapshots: [f.snapshot] }
  );
  const previous = f.verify({ configuration }, manifest);
  assert.equal(previous.status, 'matched');
  const reordered = { ...configuration, settings: { bindings: { 'e\u0301': 2, '\u00e9': 1 } } };
  const current = f.verify({ configuration: reordered, previousEvidence: previous }, manifest);
  assert.equal(current.status, 'matched');
  assert.equal(current.configurationDigest, previous.configurationDigest);
  assert.equal(current.previousInputEvidenceMatches, true);
  assert.equal(current.priorInputEvidenceReusable, true);
  assert.equal(
    sourceManifestDigest(
      createSourceManifest({ ...f.request, configuration: reordered }, { snapshots: [f.snapshot] })
    ),
    sourceManifestDigest(manifest)
  );
  const changed = { ...configuration, settings: { bindings: { 'e\u0301': 1, '\u00e9': 2 } } };
  const mismatch = f.verify({ configuration: changed, previousEvidence: previous }, manifest);
  assert.ok(mismatch.issues.some((item) => item.code === 'CONFIGURATION_CHANGED'));
  assert.notEqual(mismatch.configurationDigest, previous.configurationDigest);
});

test('frontend closure and manifest identities stay equal across default locales', (t) => {
  const f = fixture(t, {
    'entry.proto.ts':
      'import { a } from "./ä.proto.ts"; import { z } from "./z.proto.ts"; export const component = a + z;',
    'ä.proto.ts': 'export const a = 1;',
    'z.proto.ts': 'export const z = 2;',
  });
  const programUrl = new URL('../src/frontend/program.ts', import.meta.url).href;
  const manifestUrl = new URL('../src/source-manifest.ts', import.meta.url).href;
  const script = `
    import { createProtoProgram, getProtoSourceClosure, canonicalJson } from ${JSON.stringify(programUrl)};
    import { createSourceManifest, directorySourceSnapshot, sourceManifestDigest } from ${JSON.stringify(manifestUrl)};
    const directory = ${JSON.stringify(f.directory)};
    const closure = getProtoSourceClosure(createProtoProgram({ rootNames: ['entry.proto.ts'], currentDirectory: directory }));
    const snapshot = directorySourceSnapshot({ repositoryId: 'consumer', revision: ${JSON.stringify(REVISION)}, directory });
    const request = ${JSON.stringify(f.request)};
    request.configuration.settings = { bindings: { 'ä': 1, z: 2 } };
    request.files.push(...['ä.proto.ts', 'z.proto.ts'].map(path => ({ repositoryId: 'consumer', path, role: 'dependency' })));
    request.entrypoints.push(...['ä', 'z'].map(id => ({ id, repositoryId: 'consumer', path: 'entry.proto.ts', exportName: id })));
    const manifest = createSourceManifest(request, { snapshots: [snapshot] });
    console.log(JSON.stringify({ locale: Intl.Collator().resolvedOptions().locale, canonical: canonicalJson(request.configuration.settings), configuration: closure.configurationHash, closure: closure.digest, manifest: sourceManifestDigest(manifest) }));
  `;
  const run = (locale) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, LANG: locale, LC_ALL: locale },
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const english = run('en_US.UTF-8');
  const swedish = run('sv_SE.UTF-8');
  assert.equal(english.locale, 'en-US');
  assert.equal(swedish.locale, 'sv-SE');
  const { locale: _en, ...enIdentity } = english;
  const { locale: _sv, ...svIdentity } = swedish;
  assert.deepEqual(enIdentity, svIdentity);
});
