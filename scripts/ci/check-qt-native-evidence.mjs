import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const contract = JSON.parse(
  readFileSync(
    new URL(
      '../../packages/compiler/test/fixtures/qt-native-consumer/evidence-contract.json',
      import.meta.url
    ),
    'utf8'
  )
);
const sha = (data) => createHash('sha256').update(data).digest('hex');

function assertRelativeFile(file) {
  assert.equal(typeof file, 'string', 'evidence paths must be strings');
  assert.ok(
    file.length > 0 &&
      !file.includes('\\') &&
      !file.includes('\0') &&
      !file.includes(':') &&
      file.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
    `evidence paths must be canonical relative files: ${file}`
  );
}

assert.equal(contract.schemaVersion, 1);
assert.ok(contract.cases.length > 0);
assert.ok(contract.cases.every((name) => typeof name === 'string' && name.length > 0));
assert.equal(new Set(contract.cases).size, contract.cases.length);
for (const names of [contract.inputs, contract.artifacts]) {
  assert.ok(names.length > 0);
  names.forEach(assertRelativeFile);
  assert.equal(new Set(names).size, names.length);
}
for (const copied of contract.copiedInputs) {
  assert.ok(contract.inputs.includes(copied.source));
  assert.ok(contract.artifacts.includes(copied.artifact));
}

function assertInventory(entries, expected, kind) {
  assert.ok(Array.isArray(entries), `${kind} inventory must be an array`);
  const names = entries.map((entry) => {
    assertRelativeFile(entry.file);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/, `${kind} hash: ${entry.file}`);
    assert.ok(
      Number.isSafeInteger(entry.bytes) && entry.bytes >= 0,
      `${kind} byte count: ${entry.file}`
    );
    return entry.file;
  });
  assert.equal(new Set(names).size, names.length, `${kind} inventory contains duplicates`);
  assert.deepEqual([...names].sort(), [...expected].sort(), `${kind} inventory differs`);
}

function readContainedFile(root, relative) {
  assertRelativeFile(relative);
  let file = root;
  const parts = relative.split('/');
  parts.forEach((part, index) => {
    file = path.join(file, part);
    const stat = lstatSync(file);
    assert.equal(
      stat.isSymbolicLink(),
      false,
      `evidence symlink is not a source file: ${relative}`
    );
    assert.ok(
      index === parts.length - 1 ? stat.isFile() : stat.isDirectory(),
      `evidence file type differs: ${relative}`
    );
  });
  return readFileSync(file);
}

export function assertQtNativeReports({
  vitest,
  version,
  configure,
  build,
  consumer,
  drift,
  source,
}) {
  assert.equal(source.schemaVersion, contract.schemaVersion);
  assert.equal(source.qtVersion, contract.qtVersion);
  assert.deepEqual(source.expectedCases, contract.cases, 'native case inventory differs');
  assertInventory(source.inputs, contract.inputs, 'source input');
  assertInventory(source.files, contract.artifacts, 'generated artifact');
  assert.equal(vitest.success, true);
  assert.equal(vitest.numTotalTests, 1);
  assert.equal(vitest.numPassedTests, 1);
  assert.equal(vitest.numFailedTests, 0);
  assert.equal(vitest.numPendingTests, 0);
  assert.equal(vitest.testResults.length, 1);
  const suite = vitest.testResults[0];
  assert.ok(suite.name.endsWith('/packages/compiler/test/qt-native-consumer.native.test.ts'));
  assert.equal(suite.status, 'passed');
  assert.deepEqual(
    suite.assertionResults.map((entry) => entry.status),
    ['passed']
  );
  for (const result of [version, configure, build, consumer]) {
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
  }
  assert.equal(version.stdout.trim(), contract.qtVersion);
  assert.deepEqual(version.command.slice(1), ['-query', 'QT_VERSION']);
  assert.ok(configure.command.includes('-DCMAKE_BUILD_TYPE=Release'));
  assert.deepEqual(build.command.slice(1), ['--build', 'build', '--parallel', '2']);
  assert.equal(path.basename(consumer.command[0]), 'compiled-qt');
  assert.equal(path.basename(consumer.command[1]), 'Consumer.qml');
  const lines = `${consumer.stdout}\n${consumer.stderr}`
    .split('\n')
    .filter((line) => line.includes('PUI_QT_RESULT '));
  assert.equal(lines.length, 1);
  const actual = JSON.parse(lines[0].split('PUI_QT_RESULT ')[1]);
  assert.equal(actual.passed, contract.cases.length);
  assert.equal(actual.failed, 0);
  assert.deepEqual(
    actual.cases,
    contract.cases.map((name) => ({ name, status: 'passed' }))
  );
  assert.deepEqual(drift, []);
  return {
    wrapperPassed: 1,
    wrapperSkipped: 0,
    nativePassed: contract.cases.length,
    nativeFailed: 0,
  };
}

export function verifyQtNativeEvidence(directory, expectedSource) {
  const root = realpathSync(path.resolve(directory));
  const children = readdirSync(root, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith('proto-qt-native-')
  );
  assert.equal(children.length, 1);
  const child = path.join(root, children[0].name);
  const files = {
    vitest: path.join(root, 'vitest.json'),
    version: path.join(child, 'qt-version.json'),
    configure: path.join(child, 'configure.json'),
    build: path.join(child, 'build.json'),
    consumer: path.join(child, 'consumer.json'),
    drift: path.join(child, 'generated-drift.json'),
    source: path.join(child, 'source-receipt.json'),
  };
  const raw = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      readContainedFile(root, path.relative(root, file).split(path.sep).join('/')),
    ])
  );
  const reports = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, JSON.parse(value)])
  );
  const source = readContainedFile(root, 'source-sha.txt').toString('utf8').trim();
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(source, expectedSource);
  assert.equal(reports.source.head, source);
  const result = assertQtNativeReports(reports);
  for (const [entries, base] of [
    [reports.source.inputs, repositoryRoot],
    [reports.source.files, child],
  ])
    for (const entry of entries) {
      const bytes = readContainedFile(base, entry.file);
      assert.equal(entry.bytes, bytes.byteLength, `byte count differs: ${entry.file}`);
      assert.equal(entry.sha256, sha(bytes), `hash differs: ${entry.file}`);
    }
  for (const copied of contract.copiedInputs)
    assert.equal(
      sha(readContainedFile(child, copied.artifact)),
      sha(readContainedFile(repositoryRoot, copied.source)),
      `original consumer input differs: ${copied.artifact}`
    );
  const receipt = {
    source,
    ...result,
    qt: contract.qtVersion,
    mode: 'Actual Qt Quick offscreen/software; no physical GPU, hardware input or AT acceptance',
    publicQtProfileActivated: false,
    files: Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        { path: path.relative(root, files[key]), sha256: sha(value) },
      ])
    ),
  };
  writeFileSync(path.join(root, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: check-qt-native-evidence <directory>');
  console.log(JSON.stringify(verifyQtNativeEvidence(process.argv[2], process.env.GITHUB_SHA)));
}
