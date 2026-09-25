// Negative evidence for the protocol message fixture gate: a stale or missing
// fixture must fail the check, run through the CLI the repository runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = path.join(ROOT, 'scripts/gpui/generate-message-fixture.mts');
const FIXTURE = path.join(ROOT, 'native/gpui/fixtures/protocol-messages.json');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function runCheck(fixture = FIXTURE) {
  return spawnSync(TSX, [SCRIPT, '--check', '--fixture', fixture], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the committed fixture is current', () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /is current \(\d+ host-to-peer and \d+ peer-to-host kinds/);
});

test('a stale fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-message-fixture-'));
  const copy = path.join(dir, 'protocol-messages.json');
  copyFileSync(FIXTURE, copy);
  assert.equal(runCheck(copy).status, 0, 'an untouched copy must still pass');

  // Dropping one example is enough: the check compares the whole file.
  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  corrupted.peerToHost = corrupted.peerToHost.slice(1);
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(copy);
  assert.notEqual(result.status, 0, 'a stale fixture must fail');
  assert.match(result.stderr, /is stale; run `pnpm gpui:message-fixture`/);
});

test('a missing fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-message-fixture-'));
  const result = runCheck(path.join(dir, 'absent.json'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is missing/);
});
