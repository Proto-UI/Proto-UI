import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  expectedConsumers,
  validatePreparedConsumers,
  runNative,
  assertBodyPortal,
  assertOldCliCounterfactual,
  assertServedArtifacts,
  assertSelectCommit,
} from './verify-native.mjs';

const candidate = 'a'.repeat(40);
function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'installed-public-preflight-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const consumers = join(root, 'tooltip');
  const repository = join(root, 'repository');
  mkdirSync(consumers);
  mkdirSync(repository);
  const execution = {
    schemaVersion: 2,
    group: 'tooltip',
    status: 'passed',
    rows: expectedConsumers('tooltip').map((row) => ({ ...row, status: 'passed' })),
    ...overrides,
  };
  writeFileSync(join(consumers, 'execution.json'), JSON.stringify(execution));
  return { root, consumers, repository, execution };
}

test('failed aggregate cannot run twelve apparently passed rows or start a browser', async (t) => {
  const f = fixture(t, { status: 'failed' });
  const output = join(f.root, 'native');
  assert.equal(await runNative(f.consumers, f.repository, output, 'tooltip', candidate), 1);
  const report = JSON.parse(readFileSync(join(output, 'native.json'), 'utf8'));
  assert.equal(report.status, 'failed');
  assert.match(report.setupFailure, /preparation aggregate must have passed/);
  assert.equal(report.browserStarted, false);
  assert.equal(report.serverClosed, true);
  assert.equal(report.rows.length, 12);
  assert(report.rows.every((row) => row.status === 'not-run'));
});

test('a Tooltip preparation cannot stand in for the four installed Select Apps', (t) => {
  const f = fixture(t);
  assert.throws(
    () => validatePreparedConsumers(f.consumers, f.repository, 'select', candidate),
    /preparation group differs/
  );
});

test('missing or repeated host/family rows cannot preserve a twelve-row denominator', (t) => {
  for (const repeated of [false, true]) {
    const f = fixture(t);
    f.execution.rows.pop();
    if (repeated) f.execution.rows.push(f.execution.rows[0]);
    writeFileSync(join(f.consumers, 'execution.json'), JSON.stringify(f.execution));
    assert.throws(
      () => validatePreparedConsumers(f.consumers, f.repository, 'tooltip', candidate),
      /prepared set differs/
    );
  }
});

test('a passed preparation aggregate cannot hide a failed individual App', (t) => {
  const f = fixture(t);
  f.execution.rows[0].status = 'failed';
  writeFileSync(join(f.consumers, 'execution.json'), JSON.stringify(f.execution));
  assert.throws(
    () => validatePreparedConsumers(f.consumers, f.repository, 'tooltip', candidate),
    /every prepared row/
  );
});

test('unknown group cannot silently select the original twelve consumers', () => {
  assert.throws(() => expectedConsumers('all'), /Unknown installed public consumer group/);
});

test('old CLI control accepts only the original ownership failure after a real description', () => {
  const inline = { contentConnected: true, inBody: true, insideApp: true };
  const described = { ignored: false, description: 'View account settings and profile details.' };
  assert.deepEqual(assertOldCliCounterfactual(inline, described), {
    assertion: 'body-portal-outside-authored-app',
    observedProductOutcome: 'rejected',
    expected: true,
  });
  assert.throws(() =>
    assertOldCliCounterfactual({ ...inline, contentConnected: false }, described)
  );
  assert.throws(() => assertOldCliCounterfactual({ ...inline, inBody: false }, described));
  assert.throws(() => assertOldCliCounterfactual(inline, { ...described, description: '' }));
  assert.throws(
    () => assertOldCliCounterfactual({ ...inline, insideApp: false }, described),
    /must exhibit/
  );
  assert.doesNotThrow(() => assertBodyPortal({ ...inline, insideApp: false }));
});

test('terminal served-output proof cannot be empty, failed or detached from prepared bytes', () => {
  const outputs = ['index.html', 'app.js', 'app.css'].map((name, index) => ({
    path: 'dist/' + name,
    sha256: String(index + 1).repeat(64),
    bytes: 100 + index,
  }));
  const execution = { rows: [{ family: 'base', host: 'react', outputs }] };
  const responses = outputs.map((item) => ({
    path: '/base-react/' + item.path,
    sha256: item.sha256,
    bytes: item.bytes,
  }));
  assert.doesNotThrow(() => assertServedArtifacts(responses, execution));
  assert.throws(() => assertServedArtifacts([], execution), /missing actual served output/);
  assert.throws(
    () => assertServedArtifacts(responses.slice(0, 2), execution),
    /missing actual served output/
  );
  assert.throws(
    () =>
      assertServedArtifacts(
        [...responses, { path: '/base-react/dist/app.js', failure: 'source drift' }],
        execution
      ),
    /failed response/
  );
  assert.throws(
    () =>
      assertServedArtifacts(
        [{ ...responses[0], sha256: 'f'.repeat(64) }, ...responses.slice(1)],
        execution
      ),
    /hash differs/
  );
  assert.throws(
    () =>
      assertServedArtifacts([...responses, { ...responses[0], path: '/unknown.js' }], execution),
    /unknown artifact/
  );
});

function committedSelect(attributes = {}) {
  const state = {
    'data-value': 'vue',
    'data-text-value': 'Vue',
    ...attributes,
  };
  return { state, root: { getAttribute: async (name) => state[name] } };
}

test('a real committed Select may finish its leaf render after its root attributes', async () => {
  const { root } = committedSelect();
  let reads = 0;
  await assertSelectCommit(root, {
    textContent: async () => (++reads === 1 ? 'Pick a framework' : 'Vue'),
  });
  assert(reads >= 2, 'the displayed leaf must actually be observed after it commits');
});

test('a permanently stale Select display still fails the original bounded observer', async () => {
  const { root } = committedSelect();
  await assert.rejects(
    assertSelectCommit(root, { textContent: async () => 'Pick a framework' }),
    (error) =>
      error instanceof assert.AssertionError &&
      error.actual === 'Pick a framework' &&
      error.expected === 'Vue'
  );
});

test('a Vue leaf cannot conceal inconsistent committed Select text metadata', async () => {
  const { root } = committedSelect({ 'data-text-value': 'React' });
  await assert.rejects(
    assertSelectCommit(root, { textContent: async () => 'Vue' }),
    (error) =>
      error instanceof assert.AssertionError && error.actual === 'React' && error.expected === 'Vue'
  );
});

test('a leaf completion cannot accept a different root value acquired while waiting', async () => {
  const { state, root } = committedSelect();
  await assert.rejects(
    assertSelectCommit(root, {
      textContent: async () => {
        state['data-value'] = 'react';
        return 'Vue';
      },
    }),
    (error) =>
      error instanceof assert.AssertionError && error.actual === 'react' && error.expected === 'vue'
  );
});
