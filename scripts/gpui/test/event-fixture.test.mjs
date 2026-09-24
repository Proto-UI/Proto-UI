// Negative evidence for the event fixture gate. Two claims are under test:
// a stale fixture must fail the check, and the drift guard on the module's
// private copy of the vocabulary must actually fire. Both are run through the
// CLI the repository runs, so neither can pass while the gate is broken.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = path.join(ROOT, 'scripts/gpui/generate-event-fixture.mts');
const FIXTURE = path.join(ROOT, 'native/gpui/fixtures/event-types.json');
const IMPL = path.join(ROOT, 'packages/modules/event/src/impl.ts');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function runCheck(fixture = FIXTURE, impl = IMPL) {
  return spawnSync(TSX, [SCRIPT, '--check', '--fixture', fixture, '--impl', impl], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the committed fixture is current', () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /is current \(\d+ core, \d+ optional\)/);
});

test('a stale fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-event-fixture-'));
  const copy = path.join(dir, 'event-types.json');
  copyFileSync(FIXTURE, copy);
  assert.equal(runCheck(copy).status, 0, 'an untouched copy must still pass');

  // Dropping one type is enough: the check compares the whole file.
  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  corrupted.optional = corrupted.optional.slice(1);
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(copy);
  assert.notEqual(result.status, 0, 'a stale fixture must fail');
  assert.match(result.stderr, /is stale; run `pnpm gpui:event-fixture`/);
});

test('a missing fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-event-fixture-'));
  const result = runCheck(path.join(dir, 'absent.json'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is missing/);
});

test('a drifted copy of the vocabulary fails before anything is written', () => {
  // The module keeps its own literal copy of the two arrays. If that copy
  // ever disagrees with the exported authority, generating a Rust mirror from
  // the authority would hide the disagreement rather than surface it.
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-event-impl-'));
  const copy = path.join(dir, 'impl.ts');
  const source = readFileSync(IMPL, 'utf8');
  assert.equal(runCheck(FIXTURE, IMPL).status, 0, 'the real copy must agree');

  writeFileSync(copy, source.replace("'press.commit',", "'press.committed',"));
  const result = runCheck(FIXTURE, copy);
  assert.notEqual(result.status, 0, 'a drifted copy must fail');
  assert.match(result.stderr, /CORE_EVENT_TYPES in .* has drifted/);
});
