import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { LEDGER_PRINCIPAL, LEDGER_REPOSITORY, INITIAL_SWEEP_ID } from '../cloud-review-ledger.mjs';
import { LocalCloudReviewLedger, LOCAL_LEDGER_REF } from '../local-cloud-review-ledger.mjs';
import { RemoteCloudReviewLedger, REMOTE_LEDGER_REF } from '../remote-cloud-review-ledger.mjs';
import { ConnectorReviewTransport } from '../connector-review-transport.mjs';
const cyjin = { id: '19223209', login: 'cyjin-yl' };
const git = (dir, args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
test('selected cloud policy, principal, sweep epoch and state ref are cyjin-bound', () => {
  assert.deepEqual(LEDGER_PRINCIPAL, cyjin);
  assert.equal(REMOTE_LEDGER_REF, 'refs/heads/proto-ui-review-ledger-cyjin-yl');
  assert.equal(INITIAL_SWEEP_ID, 'cyjin-yl-owner-requested-open-pr-sweep-2026-10-04');
  const policy = YAML.parse(
    readFileSync(
      new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url),
      'utf8'
    )
  );
  for (const id of ['proto-ui-cloud-owner-review-v1', 'proto-ui-cloud-owner-initial-sweep-v1']) {
    const scope = policy.reviewSubmissionAuthorizations.find((a) => a.id === id);
    assert.equal(scope.principalId, cyjin.id);
    assert.equal(scope.principalLogin, cyjin.login);
  }
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'pui-cyjin-genesis-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  mkdirSync(remote);
  git(remote, ['init', '--bare']);
  let count = 0;
  return {
    remote,
    open(genesis) {
      const cache = path.join(root, 'cache-' + count++ + '.git');
      mkdirSync(cache);
      git(cache, ['init', '--bare']);
      return new RemoteCloudReviewLedger(cache, genesis, {
        checkpoint: genesis,
        transport: {
          readInto(directory) {
            git(directory, [
              'fetch',
              '--no-tags',
              '--no-write-fetch-head',
              remote,
              LOCAL_LEDGER_REF,
            ]);
            return git(remote, ['rev-parse', LOCAL_LEDGER_REF]);
          },
        },
      });
    },
  };
}
test('new genesis embeds principal/repository; legacy and foreign owner roots cannot be adopted', async (t) => {
  for (const principal of [cyjin, { id: '52768321', login: 'guangliang2019' }, null])
    await t.test(principal?.login ?? 'legacy unbound', (t) => {
      const f = fixture(t),
        genesis = LocalCloudReviewLedger.initialize(f.remote, {
          publicationEnabled: true,
          principal,
        });
      const payload = JSON.parse(git(f.remote, ['show', genesis + ':entry.json']));
      if (principal === cyjin) {
        assert.equal(payload.schemaVersion, 2);
        assert.deepEqual(payload.principal, cyjin);
        assert.equal(payload.repositoryId, LEDGER_REPOSITORY);
        assert.equal(f.open(genesis).read().state.pending.length, 0);
      } else assert.throws(() => f.open(genesis), /owner principal|principal.*genesis/);
    });
});
test('supported get_user_login identity is used directly and another account is rejected', async () => {
  for (const principal of [cyjin, { id: '52768321', login: 'guangliang2019' }]) {
    const calls = [];
    const transport = new ConnectorReviewTransport(async (operation, args) => {
      calls.push(operation);
      if (operation === 'get_user_login')
        return { structuredContent: { login: principal.login, id: Number(principal.id) } };
      if (operation === 'get_repo_collaborator_permission') {
        assert.equal(args.username, 'cyjin-yl');
        return { structuredContent: { permission: 'maintain' } };
      }
      if (operation === 'fetch') return { structuredContent: { content: '[]' } };
      throw Error('Unexpected connector operation ' + operation);
    });
    if (principal === cyjin) {
      assert.deepEqual(await transport.collectInitialSweep(), []);
      assert.equal(calls.filter((x) => x === 'get_user_login').length, 1);
      assert.equal(calls.includes('get_profile'), false);
    } else await assert.rejects(() => transport.collectInitialSweep(), /delegated owner/);
  }
});
