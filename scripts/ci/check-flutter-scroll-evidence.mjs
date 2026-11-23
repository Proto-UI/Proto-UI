import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertFlutterScrollReports({ vitest, pubGet, widgets }, expectedDartTests) {
  assert.ok(Number.isSafeInteger(expectedDartTests) && expectedDartTests > 0);
  assert.equal(vitest.success, true);
  assert.equal(vitest.numTotalTests, 1);
  assert.equal(vitest.numPassedTests, 1);
  assert.equal(vitest.numFailedTests, 0);
  assert.equal(vitest.numPendingTests, 0);
  assert.equal(vitest.testResults.length, 1);
  const [suite] = vitest.testResults;
  assert.ok(suite.name.endsWith('/packages/compiler/test/flutter-scroll-outcomes.native.test.ts'));
  assert.equal(suite.status, 'passed');
  assert.equal(suite.assertionResults.length, 1);
  assert.equal(suite.assertionResults[0].status, 'passed');
  assert.equal(pubGet.command[0], widgets.command[0]);
  for (const [result, argv] of [
    [pubGet, ['pub', 'get', '--offline']],
    [widgets, ['test', '--no-pub', '--reporter', 'expanded', 'test/consumer_test.dart']],
  ]) {
    assert.deepEqual(result.command.slice(1), argv);
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
    assert.equal(typeof result.stdout, 'string');
  }
  const completed = [...widgets.stdout.matchAll(/\+(\d+): All tests passed!/g)];
  assert.equal(completed.length, 1, 'one actual complete Dart test run is required');
  assert.equal(Number(completed[0][1]), expectedDartTests);
  return { wrapperPassed: 1, wrapperSkipped: 0, dartPassed: expectedDartTests };
}

export function verifyFlutterScrollEvidence(directory, expectedDartTests) {
  const root = path.resolve(directory);
  const children = readdirSync(root, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith('proto-flutter-scroll-')
  );
  assert.equal(children.length, 1, 'one source-bound emitted Flutter consumer is required');
  const child = path.join(root, children[0].name);
  const files = {
    vitest: path.join(root, 'vitest.json'),
    pubGet: path.join(child, 'pub-get.json'),
    widgets: path.join(child, 'widgets.json'),
  };
  const raw = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, readFileSync(file)])
  );
  const reports = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, JSON.parse(value.toString('utf8'))])
  );
  const result = assertFlutterScrollReports(reports, expectedDartTests);
  const source = readFileSync(path.join(root, 'source-sha.txt'), 'utf8').trim();
  assert.match(source, /^[0-9a-f]{40}$/);
  const receipt = {
    source,
    ...result,
    publicFlutterProfileActivated: false,
    files: Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        {
          path: path.relative(root, files[key]),
          sha256: createHash('sha256').update(value).digest('hex'),
        },
      ])
    ),
  };
  writeFileSync(path.join(root, 'acceptance.json'), `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
  });
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    4,
    'usage: check-flutter-scroll-evidence <directory> <Dart count>'
  );
  console.log(
    JSON.stringify(verifyFlutterScrollEvidence(process.argv[2], Number(process.argv[3])))
  );
}
