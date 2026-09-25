// Negative evidence for the Base Button session fixture gate. The check runs
// the real peer again and compares the whole recording, so a stale or missing
// fixture must fail it through the CLI the repository runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = path.join(ROOT, 'scripts/gpui/generate-button-session-fixture.mts');
const FIXTURE = path.join(ROOT, 'native/gpui/fixtures/base-button-session.json');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function runCheck(fixture = FIXTURE) {
  return spawnSync(TSX, [SCRIPT, '--check', '--fixture', fixture], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the committed recording is current', () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /is current \(enabled: \d+ messages, disabled: \d+ messages\)/);
});

test('a recording that no longer matches the peer fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-button-session-'));
  const copy = path.join(dir, 'base-button-session.json');
  copyFileSync(FIXTURE, copy);
  assert.equal(runCheck(copy).status, 0, 'an untouched copy must still pass');

  // One registration dropped from the recorded projection is enough.
  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  const install = corrupted.sessions.enabled.find((m) => m.kind === 'projection.install');
  install.transaction.events.registrations.pop();
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(copy);
  assert.notEqual(result.status, 0, 'a stale recording must fail');
  assert.match(result.stderr, /is stale; run `pnpm gpui:button-session-fixture`/);
});

test('a missing recording fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-button-session-'));
  const result = runCheck(path.join(dir, 'absent.json'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is missing/);
});
