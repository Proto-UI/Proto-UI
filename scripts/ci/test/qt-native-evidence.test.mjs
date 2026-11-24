import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { assertQtNativeReports, verifyQtNativeEvidence } from '../check-qt-native-evidence.mjs';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const contract = JSON.parse(
  readFileSync(
    new URL(
      '../../../packages/compiler/test/fixtures/qt-native-consumer/evidence-contract.json',
      import.meta.url
    ),
    'utf8'
  )
);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const source = 'a'.repeat(40);
const fileReceipt = (file, value) => ({ file, bytes: value.byteLength, sha256: sha(value) });

// These are deliberately synthetic checker controls, not actual Qt execution evidence.
function reports() {
  const success = (command, stdout = '') => ({
    command,
    stdout,
    stderr: '',
    status: 0,
    signal: null,
  });
  return {
    vitest: {
      success: true,
      numTotalTests: 1,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [
        {
          name: '/checkout/packages/compiler/test/qt-native-consumer.native.test.ts',
          status: 'passed',
          assertionResults: [{ status: 'passed' }],
        },
      ],
    },
    version: success(['/pinned/bin/qmake', '-query', 'QT_VERSION'], contract.qtVersion + '\n'),
    configure: success(['cmake', '-DCMAKE_BUILD_TYPE=Release']),
    build: success(['cmake', '--build', 'build', '--parallel', '2']),
    consumer: success(
      ['/generated/build/compiled-qt', '/generated/Consumer.qml'],
      'qml: PUI_QT_RESULT ' +
        JSON.stringify({
          passed: contract.cases.length,
          failed: 0,
          cases: contract.cases.map((name) => ({ name, status: 'passed' })),
        })
    ),
    source: {
      schemaVersion: contract.schemaVersion,
      head: source,
      qtVersion: contract.qtVersion,
      expectedCases: [...contract.cases],
      inputs: contract.inputs.map((file) =>
        fileReceipt(file, readFileSync(path.join(repositoryRoot, file)))
      ),
      files: contract.artifacts.map((file) => fileReceipt(file, artifactBytes(file))),
    },
    drift: [],
  };
}

function artifactBytes(file) {
  const copied = contract.copiedInputs.find((entry) => entry.artifact === file);
  return copied
    ? readFileSync(path.join(repositoryRoot, copied.source))
    : Buffer.from('synthetic ' + file + '\n');
}
function consumerResult(copy, mutate) {
  const value = JSON.parse(copy.consumer.stdout.split('PUI_QT_RESULT ')[1]);
  mutate(value);
  copy.consumer.stdout = 'qml: PUI_QT_RESULT ' + JSON.stringify(value);
}
function writeReports(root, child, value) {
  const files = {
    vitest: path.join(root, 'vitest.json'),
    version: path.join(child, 'qt-version.json'),
    configure: path.join(child, 'configure.json'),
    build: path.join(child, 'build.json'),
    consumer: path.join(child, 'consumer.json'),
    drift: path.join(child, 'generated-drift.json'),
    source: path.join(child, 'source-receipt.json'),
  };
  for (const [key, file] of Object.entries(files)) writeFileSync(file, JSON.stringify(value[key]));
}
function withEvidence(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'proto-qt-checker-control-'));
  const child = path.join(root, 'proto-qt-native-synthetic');
  mkdirSync(child);
  const value = reports();
  for (const file of contract.artifacts) {
    const location = path.join(child, file);
    mkdirSync(path.dirname(location), { recursive: true });
    writeFileSync(location, artifactBytes(file));
  }
  writeFileSync(path.join(root, 'source-sha.txt'), source + '\n');
  writeReports(root, child, value);
  try {
    return run({ root, child, value, save: () => writeReports(root, child, value) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the trusted inputs cover the producer static runtime source closure', () => {
  const visited = new Set();
  const visit = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const relative = path.relative(repositoryRoot, file).split(path.sep).join('/');
    assert.ok(contract.inputs.includes(relative), `undeclared producer input: ${relative}`);
    if (!file.endsWith('.ts')) return;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      if (
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.every((item) => item.isTypeOnly)) ||
        (ts.isExportDeclaration(node) && node.isTypeOnly)
      )
        continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const name = node.moduleSpecifier.text;
      if (!name.startsWith('.')) {
        assert.ok(name.startsWith('node:') || name === 'typescript', `unbound dependency: ${name}`);
        continue;
      }
      const base = path.resolve(path.dirname(file), name);
      const dependency = [
        base,
        ...['.ts', '.tsx', '.mjs', '.js', '/index.ts'].map((ext) => base + ext),
      ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(dependency, `missing producer dependency: ${relative} -> ${name}`);
      visit(dependency);
    }
  };
  visit(path.join(repositoryRoot, 'packages/compiler/test/fixtures/qt-native-consumer/prepare.ts'));
});

test('Qt reports require the trusted case identity and complete source/artifact inventory', () => {
  assert.deepEqual(assertQtNativeReports(reports()), {
    wrapperPassed: 1,
    wrapperSkipped: 0,
    nativePassed: contract.cases.length,
    nativeFailed: 0,
  });
});

for (const [name, mutate, reason] of [
  [
    'empty input and artifact inventories',
    (copy) => {
      copy.source.inputs = [];
      copy.source.files = [];
    },
    /source input inventory differs/,
  ],
  [
    'omitted generated artifacts',
    (copy) => {
      copy.source.files = [];
    },
    /generated artifact inventory differs/,
  ],
  [
    'foreign cases agreed by receipt and output',
    (copy) => {
      copy.source.expectedCases = contract.cases.map((_, index) => 'foreign ' + index);
      consumerResult(copy, (value) => {
        value.cases = copy.source.expectedCases.map((name) => ({ name, status: 'passed' }));
      });
    },
    /native case inventory differs/,
  ],
  [
    'one omitted source input',
    (copy) => {
      copy.source.inputs.pop();
    },
    /source input inventory differs/,
  ],
  [
    'one omitted artifact',
    (copy) => {
      copy.source.files.pop();
    },
    /generated artifact inventory differs/,
  ],
  [
    'duplicate source input',
    (copy) => {
      copy.source.inputs.push(copy.source.inputs[0]);
    },
    /source input inventory contains duplicates/,
  ],
  [
    'duplicate artifact',
    (copy) => {
      copy.source.files.push(copy.source.files[0]);
    },
    /generated artifact inventory contains duplicates/,
  ],
  [
    'unlisted source input',
    (copy) => {
      copy.source.inputs[0].file = 'unexpected.ts';
    },
    /source input inventory differs/,
  ],
  [
    'unlisted artifact',
    (copy) => {
      copy.source.files[0].file = 'unexpected.qml';
    },
    /generated artifact inventory differs/,
  ],
  [
    'parent traversal source path',
    (copy) => {
      copy.source.inputs[0].file = '../outside';
    },
    /canonical relative/,
  ],
  [
    'parent traversal artifact path',
    (copy) => {
      copy.source.files[0].file = '../outside';
    },
    /canonical relative/,
  ],
  [
    'absolute source path',
    (copy) => {
      copy.source.inputs[0].file = '/outside';
    },
    /canonical relative/,
  ],
  [
    'Windows absolute artifact path',
    (copy) => {
      copy.source.files[0].file = 'C:/outside';
    },
    /canonical relative/,
  ],
  [
    'Windows traversal artifact path',
    (copy) => {
      copy.source.files[0].file = '..\\outside';
    },
    /canonical relative/,
  ],
  [
    'dot segment artifact path',
    (copy) => {
      copy.source.files[0].file = './Consumer.qml';
    },
    /canonical relative/,
  ],
  [
    'empty artifact path',
    (copy) => {
      copy.source.files[0].file = '';
    },
    /canonical relative/,
  ],
  [
    'missing artifact hash',
    (copy) => {
      delete copy.source.files[0].sha256;
    },
  ],
  [
    'invalid input bytes',
    (copy) => {
      copy.source.inputs[0].bytes = -1;
    },
    /source input byte count/,
  ],
  [
    'skipped wrapper',
    (copy) => {
      copy.vitest.numPassedTests = 0;
      copy.vitest.numPendingTests = 1;
    },
  ],
  [
    'failed native process',
    (copy) => {
      copy.consumer.status = 1;
    },
  ],
  [
    'missing native result',
    (copy) => {
      copy.consumer.stdout = '';
    },
  ],
  [
    'duplicate native result',
    (copy) => {
      copy.consumer.stdout += '\n' + copy.consumer.stdout;
    },
  ],
  [
    'one missing native pass',
    (copy) => {
      consumerResult(copy, (value) => {
        value.passed--;
      });
    },
  ],
  [
    'wrong actual native case',
    (copy) => {
      consumerResult(copy, (value) => {
        value.cases[0].name = 'other';
      });
    },
  ],
  [
    'duplicate expected case',
    (copy) => {
      copy.source.expectedCases[0] = copy.source.expectedCases[1];
    },
    /native case inventory differs/,
  ],
  [
    'wrong SDK version',
    (copy) => {
      copy.version.stdout = '6.5.0';
    },
  ],
  [
    'killed native build',
    (copy) => {
      copy.build.signal = 'SIGKILL';
    },
  ],
  [
    'generated drift',
    (copy) => {
      copy.drift.push({ file: 'generated.qml' });
    },
  ],
]) {
  test('Qt evidence rejects ' + name, () => {
    const copy = reports();
    mutate(copy);
    assert.throws(() => assertQtNativeReports(copy), reason);
  });
}

test('Qt on-disk verification resolves source paths from its repository and writes a bound acceptance', () => {
  withEvidence(({ root }) => {
    const previous = process.cwd();
    try {
      process.chdir(root);
      const result = verifyQtNativeEvidence(root, source);
      assert.equal(result.nativePassed, contract.cases.length);
      assert.equal(result.publicQtProfileActivated, false);
      assert.equal(result.source, source);
      assert.deepEqual(
        JSON.parse(readFileSync(path.join(root, 'acceptance.json'), 'utf8')),
        result
      );
      assert.throws(() => verifyQtNativeEvidence(root, source), /EEXIST/);
    } finally {
      process.chdir(previous);
    }
  });
});

for (const [name, mutate, reason] of [
  [
    'source hash drift',
    ({ value }) => {
      value.source.inputs[0].sha256 = '0'.repeat(64);
    },
    /hash differs/,
  ],
  [
    'artifact content drift',
    ({ child }) => {
      writeFileSync(path.join(child, 'Component.qml'), 'changed');
    },
    /byte count differs|hash differs/,
  ],
  [
    'forged artifact byte count',
    ({ value }) => {
      value.source.files[0].bytes++;
    },
    /byte count differs/,
  ],
  [
    'original prototype replacement with a matching receipt hash',
    ({ child, value }) => {
      const file = 'inputs/scroll.proto.ts',
        bytes = Buffer.from('replaced original source');
      writeFileSync(path.join(child, file), bytes);
      Object.assign(
        value.source.files.find((entry) => entry.file === file),
        fileReceipt(file, bytes)
      );
    },
    /original consumer input differs/,
  ],
  [
    'original Consumer replacement with a matching receipt hash',
    ({ child, value }) => {
      const file = 'Consumer.qml',
        bytes = Buffer.from('replaced actual consumer');
      writeFileSync(path.join(child, file), bytes);
      Object.assign(
        value.source.files.find((entry) => entry.file === file),
        fileReceipt(file, bytes)
      );
    },
    /original consumer input differs/,
  ],
  [
    'artifact symlink',
    ({ root, child }) => {
      const original = path.join(child, 'Component.qml'),
        other = path.join(root, 'other.qml');
      writeFileSync(other, readFileSync(original));
      rmSync(original);
      symlinkSync(other, original);
    },
    /evidence symlink/,
  ],
  [
    'artifact parent symlink',
    ({ root, child }) => {
      const original = path.join(child, 'ir'),
        other = path.join(root, 'other-ir');
      mkdirSync(other);
      for (const name of ['scroll', 'default', 'siblings', 'empty'])
        writeFileSync(
          path.join(other, name + '.json'),
          readFileSync(path.join(original, name + '.json'))
        );
      rmSync(original, { recursive: true });
      symlinkSync(other, original);
    },
    /evidence symlink/,
  ],
  [
    'source receipt head drift',
    ({ value }) => {
      value.source.head = 'b'.repeat(40);
    },
  ],
]) {
  test('Qt on-disk verification rejects ' + name, () => {
    withEvidence((fixture) => {
      mutate(fixture);
      fixture.save();
      assert.throws(() => verifyQtNativeEvidence(fixture.root, source), reason);
      assert.throws(() => readFileSync(path.join(fixture.root, 'acceptance.json')), /ENOENT/);
    });
  });
}
