import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { LocalCloudReviewLedger } from '../local-cloud-review-ledger.mjs';
import { REMOTE_LEDGER_REF } from '../remote-cloud-review-ledger.mjs';
import {
  CONNECTOR_AUTHORIZATION,
  INITIAL_SWEEP_AUTHORIZATION,
} from '../connector-review-session.mjs';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const git = (directory, ...args) =>
  execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();

test('actual worker startup accepts either active scope and rejects neither, without production access', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'pui-worker-scopes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['scripts/agent-operations', 'internal/agent-operations'])
    cpSync(path.join(repository, directory), path.join(root, directory), { recursive: true });
  symlinkSync(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const remote = path.join(root, 'remote.git');
  mkdirSync(remote);
  git(remote, 'init', '--bare');
  const genesis = LocalCloudReviewLedger.initialize(remote, { publicationEnabled: true });
  git(remote, 'update-ref', REMOTE_LEDGER_REF, genesis);
  const original = parse(
    readFileSync(path.join(repository, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
  );
  for (const eventActive of [false, true])
    for (const sweepActive of [false, true])
      await t.test(`event=${eventActive}, sweep=${sweepActive}`, () => {
        const policy = structuredClone(original);
        policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
          eventActive ? 'active' : 'inactive';
        policy.reviewSubmissionAuthorizations.find(
          (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
        ).status = sweepActive ? 'active' : 'inactive';
        writeFileSync(
          path.join(root, 'internal/agent-operations/capability-policy.yaml'),
          JSON.stringify(policy)
        );
        const cache = path.join(root, `cache-${eventActive}-${sweepActive}.git`);
        mkdirSync(cache);
        git(cache, 'init', '--bare');
        const worker = path.join(root, 'scripts/agent-operations/connector-review-worker.mjs');
        const env = {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: `url.${remote}.insteadOf`,
          GIT_CONFIG_VALUE_0: 'https://github.com/Proto-UI/Proto-UI.git',
          GIT_ALLOW_PROTOCOL: 'file',
        };
        const result = spawnSync(
          process.execPath,
          [worker, '--ledger-dir', cache, '--genesis', genesis, '--checkpoint', genesis],
          { env, input: '{"kind":"exit"}\n', encoding: 'utf8' }
        );
        if (eventActive || sweepActive) {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(JSON.parse(result.stdout.trim()).mode, 'parent-publication');
        } else {
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, /active admitted review scope/);
        }
        assert.equal(git(remote, 'rev-parse', REMOTE_LEDGER_REF), genesis);
        const readonly = spawnSync(process.execPath, [worker], {
          env,
          input: '{"kind":"exit"}\n',
          encoding: 'utf8',
        });
        assert.equal(readonly.status, 0, readonly.stderr);
        assert.equal(JSON.parse(readonly.stdout.trim()).mode, 'read-only');
      });
});
