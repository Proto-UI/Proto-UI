// Negative evidence for the session fixture gate. The check runs the real
// peer again and compares every whole recording, so a stale or missing
// fixture must fail it through the CLI the repository runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = path.join(ROOT, 'scripts/gpui/generate-session-fixtures.mts');
const FIXTURES = path.join(ROOT, 'native/gpui/fixtures');
const FILES = ['base-button-session.json', 'base-toggle-session.json', 'base-switch-session.json'];
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function runCheck(dir = FIXTURES) {
  return spawnSync(TSX, [SCRIPT, '--check', '--dir', dir], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

/** Copies of the committed recordings, in a directory of their own. */
function copies() {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-sessions-'));
  for (const file of FILES) copyFileSync(path.join(FIXTURES, file), path.join(dir, file));
  return dir;
}

test('the committed recordings are current', () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    /base-button-session\.json is current \(enabled: \d+ messages, disabled: \d+ messages\)/
  );
  assert.match(
    result.stdout,
    /base-toggle-session\.json is current \(inactive: \d+ messages, active: \d+ messages, disabled: \d+ messages\)/
  );
  assert.match(
    result.stdout,
    /base-switch-session\.json is current \(root: \d+ messages, thumb: \d+ messages, checked: \d+ messages, checkedThumb: \d+ messages\)/
  );
});

test('a recording that no longer matches the peer fails the check', () => {
  const dir = copies();
  assert.equal(runCheck(dir).status, 0, 'untouched copies must still pass');

  // One registration dropped from a recorded projection is enough.
  const copy = path.join(dir, 'base-button-session.json');
  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  const install = corrupted.sessions.enabled.find((m) => m.kind === 'projection.install');
  install.transaction.events.registrations.pop();
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(dir);
  assert.notEqual(result.status, 0, 'a stale recording must fail');
  assert.match(
    result.stderr,
    /base-button-session\.json is stale; run `pnpm gpui:session-fixtures`/
  );
});

test('a missing recording fails the check', () => {
  const dir = copies();
  rmSync(path.join(dir, 'base-toggle-session.json'));
  const result = runCheck(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /base-toggle-session\.json is missing/);
});
