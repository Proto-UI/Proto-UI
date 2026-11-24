import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWcNativeIsolation, inspectWcNativeIsolation } from './wc-native-isolation.mjs';

export const SHADER_BROWSER_SUITE = 'packages/compiler/test/shader-presentation.browser.test.ts';
export const SHADER_BROWSER_CASES = 37;

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const selectionBytes = readFileSync(new URL('./shader-browser-selection.json', import.meta.url));
export const SHADER_BROWSER_SELECTION = JSON.parse(selectionBytes);
const expectedNames = [
  ...SHADER_BROWSER_SELECTION.originalJourneys,
  ...SHADER_BROWSER_SELECTION.sceneJourneys,
];
assert.equal(SHADER_BROWSER_SELECTION.suite, SHADER_BROWSER_SUITE);
assert.equal(SHADER_BROWSER_SELECTION.originalJourneys.length, 28);
assert.equal(SHADER_BROWSER_SELECTION.sceneJourneys.length, 9);
assert.equal(new Set(expectedNames).size, SHADER_BROWSER_CASES);

/** A successful process with absent, skipped, or partial assertions is not acceptance. */
export function verifyShaderBrowserReport(report) {
  assert.equal(report.success, true, 'The original browser suite must succeed.');
  assert.equal(
    report.numTotalTests,
    SHADER_BROWSER_CASES,
    'The complete selected denominator must run.'
  );
  assert.equal(report.numPassedTests, SHADER_BROWSER_CASES);
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests ?? 0, 0);
  assert.equal(report.testResults.length, 1);
  const suite = report.testResults[0];
  assert.equal(path.resolve(suite.name), path.join(root, SHADER_BROWSER_SUITE));
  assert.equal(suite.status, 'passed');
  assert.equal(suite.assertionResults.length, SHADER_BROWSER_CASES);
  const names = new Set();
  for (const result of suite.assertionResults) {
    assert.equal(result.status, 'passed');
    assert.ok(
      result.fullName && !names.has(result.fullName),
      'Every selected journey needs a distinct result.'
    );
    names.add(result.fullName);
  }
  assert.deepEqual(
    [...names].sort(),
    [...expectedNames].sort(),
    'Every original and added journey must retain its own result.'
  );
}

export function verifyShaderBrowserBuilds(directory, candidateSha) {
  const builds = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && entry.name === 'build.json') builds.push(filename);
    }
  };
  visit(directory);
  assert.equal(
    builds.length,
    3,
    'All three independently named source fixtures must retain their actual builds.'
  );
  const entries = [];
  for (const file of builds) {
    const build = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(build.candidate.head, candidateSha);
    assert.equal(build.candidate.dirty, false, 'The browser must consume the committed candidate.');
    assert.deepEqual(
      build.compilations
        .map(({ target, profile }) => ({ target, profile }))
        .sort((a, b) => a.target.localeCompare(b.target)),
      [
        { target: 'react', profile: 'react-dom-source-v1' },
        { target: 'vue', profile: 'vue-source-v1' },
        { target: 'vue2', profile: 'vue2-source-v1' },
        { target: 'wc', profile: 'web-component-source-v1' },
      ],
      'Every target must retain its actual admitted profile.'
    );
    assert.ok(build.sourceGenerator.files.length > 0);
    assert.ok(Object.keys(build.inputs).length > 0);
    const fixtureEntries = [...new Set(build.compilations.map((item) => item.entry))];
    assert.equal(fixtureEntries.length, 1, 'Every target must compile the same authored source.');
    entries.push(fixtureEntries[0]);
  }
  assert.deepEqual(
    entries.sort(),
    [...SHADER_BROWSER_SELECTION.fixtures].sort(),
    'A repeated or substitute fixture cannot replace an original source.'
  );
  return builds.map((file) => path.relative(directory, file));
}

export function runShaderBrowserEvidence({
  phase,
  directory,
  candidateSha,
  userNamespace,
  networkNamespace,
}) {
  assert.ok(directory && path.isAbsolute(directory), 'An absolute evidence directory is required.');
  assert.match(candidateSha ?? '', /^[a-f0-9]{40}$/, 'An exact candidate SHA is required.');
  assert.ok(phase === 'prepare' || phase === 'run', 'Unknown shader evidence phase.');
  mkdirSync(directory, { recursive: true });
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(git(['rev-parse', 'HEAD']), candidateSha);
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const source = {
    candidateSha,
    tree,
    suite: SHADER_BROWSER_SUITE,
    expectedCases: SHADER_BROWSER_CASES,
    selectionSha256: createHash('sha256').update(selectionBytes).digest('hex'),
  };
  json(path.join(directory, `source-${phase}.json`), source);
  const isolation =
    phase === 'prepare'
      ? checkWcNativeIsolation()
      : inspectWcNativeIsolation({
          expectedUserNamespace: userNamespace,
          expectedNetworkNamespace: networkNamespace,
        });
  json(path.join(directory, `isolation-${phase}.json`), { ...isolation, ...source });
  assert.equal(
    isolation.outcome,
    'ready',
    `Shader browser ${phase} requires isolated loopback with the browser sandbox retained: ${isolation.error ?? isolation.stderr ?? isolation.reason}`
  );
  if (phase === 'prepare') return;

  const output = path.join(directory, 'browser-vitest.json');
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      SHADER_BROWSER_SUITE,
      '--maxWorkers=1',
      '--minWorkers=1',
      '--reporter=default',
      '--reporter=json',
      `--outputFile=${output}`,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, PROTO_UI_RUNTIME_EVIDENCE_DIR: path.join(directory, 'browser') },
      timeout: 12 * 60 * 1000,
    }
  );
  const receipt = {
    ...source,
    exitCode: result.status,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    outcome: 'failed',
  };
  try {
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    verifyShaderBrowserReport(JSON.parse(readFileSync(output, 'utf8')));
    receipt.builds = verifyShaderBrowserBuilds(path.join(directory, 'browser'), candidateSha);
    receipt.outcome = 'passed';
  } catch (error) {
    receipt.verificationFailure = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    json(path.join(directory, 'receipt.json'), receipt);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runShaderBrowserEvidence({
    phase: process.argv[2],
    directory: process.argv[3],
    candidateSha: process.env.CANDIDATE_SHA,
    userNamespace: process.argv[4],
    networkNamespace: process.argv[5],
  });
}
