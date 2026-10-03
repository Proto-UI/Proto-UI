import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LocalCloudReviewLedger, LOCAL_LEDGER_REF } from '../local-cloud-review-ledger.mjs';
import {
  RemoteCloudReviewLedger,
  REMOTE_LEDGER_REF,
  readOnlyGitLedgerTransport,
  ownerGitLedgerTransport,
} from '../remote-cloud-review-ledger.mjs';
import { analysis } from './fixtures/cloud-review.mjs';

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
const event = (id = 'event-1', pr = 487) => ({
  type: 'enqueue',
  deliveryId: id,
  pullRequest: pr,
  eventKind: 'synchronize',
  materialDigest: id === 'event-1' ? 'a'.repeat(64) : 'b'.repeat(64),
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'pui-remote-state-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  mkdirSync(remote);
  git(remote, 'init', '--bare');
  const genesis = LocalCloudReviewLedger.initialize(remote);
  git(remote, 'update-ref', REMOTE_LEDGER_REF, genesis);
  let sequence = 0;
  const open = (checkpoint = genesis, overrides = {}) => {
    const dir = path.join(root, `cache-${sequence++}.git`);
    mkdirSync(dir);
    git(dir, 'init', '--bare');
    const calls = { reads: 0, writes: 0 };
    const transport = {
      readInto(directory) {
        calls.reads++;
        // This is a local filesystem fixture, not a GitHub test.
        git(directory, 'fetch', '--no-tags', '--no-write-fetch-head', remote, REMOTE_LEDGER_REF);
        return git(remote, 'rev-parse', REMOTE_LEDGER_REF);
      },
      publish({ directory, ref, expectedRevision, revision }) {
        calls.writes++;
        assert.equal(ref, REMOTE_LEDGER_REF);
        return ownerGitLedgerTransport({
          runGit(directory, args) {
            // Exercise the production command; substitute only its fixed URL with
            // this local fixture. No real remote request is possible.
            return git(
              directory,
              ...args.map((arg) =>
                arg === 'https://github.com/Proto-UI/Proto-UI.git' ? remote : arg
              )
            );
          },
        }).publish({ directory, ref, expectedRevision, revision });
      },
    };
    const original = { ...transport };
    Object.assign(transport, overrides(original, calls));
    const ledger = new RemoteCloudReviewLedger(dir, genesis, { checkpoint, transport });
    return { ledger, calls, transport, directory: dir };
  };
  return {
    remote,
    genesis,
    open: (checkpoint, overrides = () => ({})) => open(checkpoint, overrides),
  };
}
const apply = (ledger, command) => ledger.apply(ledger.read().revision, command);

test('remote candidate round-trip persists baseline; fresh cache must supply checkpoint and cannot adopt owner', (t) => {
  const f = fixture(t);
  const a = f.open();
  assert.equal(apply(a.ledger, event()).status, 'applied');
  assert.equal(apply(a.ledger, { type: 'claim', pullRequest: 487 }).status, 'applied');
  const checkpoint = a.ledger.read().checkpoint;
  const restarted = f.open(checkpoint);
  assert.throws(() => apply(restarted.ledger, { type: 'abandon' }), /fresh or restarted/);
  assert.equal(apply(a.ledger, { type: 'finishAnalysis', ...analysis() }).status, 'applied');
  const reopened = f.open(a.ledger.read().checkpoint).ledger.read();
  assert.equal(reopened.state.analyses.length, 1);
  assert.equal(reopened.state.slot, null);
  assert.equal(reopened.publicationAllowed, false);
  assert.throws(
    () => new RemoteCloudReviewLedger(a.directory, f.genesis),
    /explicit trusted checkpoint/
  );
  assert.equal(typeof readOnlyGitLedgerTransport().publish, 'undefined');
});
test('a competing sibling wins remotely; loser stops and can only reconcile', (t) => {
  const f = fixture(t);
  const seed = f.open();
  apply(seed.ledger, event());
  const checkpoint = seed.ledger.read().checkpoint;
  const b = f.open(checkpoint);
  let bResult;
  const a = f.open(checkpoint, (original) => ({
    publish(args) {
      bResult = apply(b.ledger, { type: 'claim', pullRequest: 487 });
      return original.publish(args);
    },
  }));
  const result = apply(a.ledger, { type: 'claim', pullRequest: 487 });
  assert.equal(bResult.status, 'applied');
  assert.equal(result.status, 'unknown');
  assert.equal(a.calls.writes, 1);
  assert.equal(b.calls.writes, 1);
  assert.equal(a.ledger.read().revision, b.ledger.read().revision);
  assert.throws(() => apply(a.ledger, { type: 'claim', pullRequest: 487 }), /mutation is stopped/);
});
test('lost remote acknowledgement, accepted-but-stale readback and checkpoint rollback all fail closed', async (t) => {
  for (const [name, overrides] of [
    [
      'ack loss',
      (original) => ({
        publish(args) {
          original.publish(args);
          throw new Error('lost acknowledgement');
        },
      }),
    ],
    [
      'false acknowledgement',
      () => ({
        publish() {
          return { status: 'accepted' };
        },
      }),
    ],
  ])
    await t.test(name, (t) => {
      const f = fixture(t);
      const a = f.open(f.genesis, overrides);
      const result = apply(a.ledger, event());
      assert.equal(result.status, 'unknown');
      assert.throws(() => apply(a.ledger, event('retry')), /mutation is stopped/);
      assert.equal(a.ledger.read().publicationAllowed, false);
    });
  await t.test('rollback below externally supplied checkpoint', (t) => {
    const f = fixture(t);
    const a = f.open();
    apply(a.ledger, event());
    const checkpoint = a.ledger.read().checkpoint;
    git(f.remote, 'update-ref', REMOTE_LEDGER_REF, f.genesis); // hostile local fixture reset
    assert.throws(() => f.open(checkpoint), /reset or rewrite|not a valid|bad object/);
  });
});
test('no mutation provider means no local candidate, and missing remote never initializes', (t) => {
  const f = fixture(t);
  const a = f.open(f.genesis, () => ({ publish: undefined }));
  const before = a.ledger.read().revision;
  assert.throws(() => a.ledger.apply(before, event()), /writes are disabled/);
  assert.equal(git(a.directory, 'rev-parse', LOCAL_LEDGER_REF), before);
  git(f.remote, 'update-ref', '-d', REMOTE_LEDGER_REF); // local fixture only
  assert.throws(() => a.ledger.read());
});
test('remote unknown intent survives new cache and new queued PR without release', (t) => {
  const f = fixture(t);
  const a = f.open();
  apply(a.ledger, event());
  apply(a.ledger, { type: 'claim', pullRequest: 487 });
  apply(a.ledger, { type: 'stageIntent', ...analysis() });
  const b = f.open(a.ledger.read().checkpoint);
  apply(b.ledger, event('second', 488));
  const state = b.ledger.read().state;
  assert.equal(state.slot.intent.status, 'unknown');
  assert(state.pending.some((x) => x.pullRequest === 488));
  assert.throws(() => apply(b.ledger, { type: 'claim', pullRequest: 488 }), /global slot/);
  assert.throws(() => apply(a.ledger, { type: 'abandon' }), /unknown intent permanently/);
});

test('lost acknowledgement of simulated finalization preserves baseline and never repeats exchange', (t) => {
  const f = fixture(t);
  const a = f.open(f.genesis, (original) => ({
    publish(args) {
      const entry = JSON.parse(git(args.directory, 'show', `${args.revision}:entry.json`));
      const result = original.publish(args);
      if (entry.type === 'finalizeSimulation') throw new Error('finalizer acknowledgement lost');
      return result;
    },
  }));
  apply(a.ledger, event());
  apply(a.ledger, { type: 'claim', pullRequest: 487 });
  apply(a.ledger, { type: 'stageSimulationIntent', ...analysis() });
  const intent = a.ledger.read().state.slot.intent;
  a.ledger.consumeSimulationAttempt(intent.id);
  const receipt = {
    repositoryId: intent.repositoryId,
    pullRequest: intent.pullRequest,
    id: '81',
    authorId: intent.principalId,
    authorLogin: intent.principalLogin,
    commitId: intent.headSha,
    state: 'APPROVED',
    body: intent.body,
  };
  const result = apply(a.ledger, {
    type: 'finalizeSimulation',
    response: receipt,
    readback: receipt,
  });
  assert.equal(result.status, 'unknown');
  const state = a.ledger.read().state;
  assert.equal(state.slot, null);
  assert.equal(state.analyses[0].simulationReceipt.id, '81');
  const reopened = f.open(a.ledger.read().checkpoint).ledger;
  assert.equal(reopened.read().state.analyses[0].simulationReceipt.id, '81');
  assert.throws(() => reopened.consumeSimulationAttempt(intent.id), /fresh, stopped or restarted/);
  assert.throws(() => a.ledger.consumeSimulationAttempt(intent.id), /mutation is stopped/);
});

// Exercise the production push arguments against real disposable local remotes.
// The injected runner changes only the fixed GitHub URL; no network is used.
for (const race of ['unchanged', 'deleted', 'rolled-back'])
  test(`owner transport binds the exact remote tip: ${race}`, (t) => {
    const f = fixture(t);
    const seed = f.open();
    assert.equal(apply(seed.ledger, event()).status, 'applied');
    const expectedRevision = seed.ledger.read().revision;
    const local = new LocalCloudReviewLedger(seed.directory, f.genesis, {
      checkpoint: expectedRevision,
    });
    const candidate = local.apply(expectedRevision, event('event-2'));
    assert.equal(candidate.status, 'applied');
    let pushes = 0;
    const transport = ownerGitLedgerTransport({
      runGit(directory, args) {
        if (args[0] === 'push') {
          pushes++;
          if (race === 'deleted') git(f.remote, 'update-ref', '-d', REMOTE_LEDGER_REF);
          if (race === 'rolled-back') git(f.remote, 'update-ref', REMOTE_LEDGER_REF, f.genesis);
        }
        return git(
          directory,
          ...args.map((arg) =>
            arg === 'https://github.com/Proto-UI/Proto-UI.git' ? f.remote : arg
          )
        );
      },
    });
    const publish = () =>
      transport.publish({
        directory: seed.directory,
        ref: REMOTE_LEDGER_REF,
        expectedRevision,
        revision: candidate.revision,
      });
    if (race === 'unchanged') {
      assert.equal(publish().status, 'accepted');
      assert.equal(git(f.remote, 'rev-parse', REMOTE_LEDGER_REF), candidate.revision);
    } else {
      assert.throws(publish, /stale info|rejected|failed to push/);
      if (race === 'deleted') assert.throws(() => git(f.remote, 'rev-parse', REMOTE_LEDGER_REF));
      else assert.equal(git(f.remote, 'rev-parse', REMOTE_LEDGER_REF), f.genesis);
    }
    assert.equal(pushes, 1);
  });

test('remote expected-tip transaction rejects deletion, rollback and advance after snapshot', async (t) => {
  for (const mode of ['delete', 'rollback', 'advance', 'already-candidate', 'unchanged'])
    await t.test(mode, (t) => {
      const f = fixture(t);
      git(f.remote, 'config', 'receive.denyNonFastForwards', 'true');
      const seed = f.open();
      apply(seed.ledger, event());
      const expected = seed.ledger.read().revision;
      const competitor = f.open(expected);
      let observed = expected;
      const actor = f.open(expected, (original) => ({
        publish(args) {
          if (mode === 'delete') {
            git(f.remote, 'update-ref', '-d', REMOTE_LEDGER_REF);
            observed = null;
          }
          if (mode === 'rollback') {
            git(f.remote, 'update-ref', REMOTE_LEDGER_REF, f.genesis);
            observed = f.genesis;
          }
          if (mode === 'advance') {
            assert.equal(apply(competitor.ledger, event('competitor', 488)).status, 'applied');
            observed = competitor.ledger.read().revision;
          }
          if (mode === 'already-candidate') {
            git(args.directory, 'push', f.remote, `${args.revision}:${REMOTE_LEDGER_REF}`);
            observed = args.revision;
          }
          return original.publish(args);
        },
      }));
      const result = actor.ledger.apply(expected, { type: 'claim', pullRequest: 487 });
      assert.equal(result.status, mode === 'unchanged' ? 'applied' : 'unknown');
      assert.equal(actor.calls.writes, 1);
      if (mode === 'delete')
        assert.throws(() => git(f.remote, 'rev-parse', '--verify', REMOTE_LEDGER_REF));
      else
        assert.equal(
          git(f.remote, 'rev-parse', REMOTE_LEDGER_REF),
          mode === 'unchanged' ? result.attemptedRevision : observed
        );
      if (mode !== 'unchanged')
        assert.throws(() => actor.ledger.apply(expected, event('retry')), /mutation is stopped/);
    });
});

test('server transaction rejects deletion or rollback after ref advertisement', async (t) => {
  for (const mode of ['delete', 'rollback'])
    await t.test(mode, (t) => {
      const f = fixture(t);
      const seed = f.open();
      apply(seed.ledger, event());
      const expected = seed.ledger.read().revision;
      const actor = f.open(expected);
      const args =
        mode === 'delete'
          ? ['update-ref', '-d', REMOTE_LEDGER_REF]
          : ['update-ref', REMOTE_LEDGER_REF, f.genesis];
      // Git runs pre-push after receiving the remote advertisement. Mutate only
      // the isolated fixture here, so the server must reject its stale old-OID.
      const hook = path.join(actor.directory, 'hooks/pre-push');
      writeFileSync(
        hook,
        '#!/usr/bin/env node\n' +
          `const {execFileSync}=require('node:child_process');execFileSync('git',${JSON.stringify(['--git-dir', f.remote, ...args])},{stdio:'pipe'});\n`
      );
      chmodSync(hook, 0o755);
      const result = actor.ledger.apply(expected, { type: 'claim', pullRequest: 487 });
      assert.equal(result.status, 'unknown');
      assert.equal(actor.calls.writes, 1);
      if (mode === 'delete')
        assert.throws(() => git(f.remote, 'rev-parse', '--verify', REMOTE_LEDGER_REF));
      else assert.equal(git(f.remote, 'rev-parse', REMOTE_LEDGER_REF), f.genesis);
      assert.throws(() => actor.ledger.apply(expected, event('retry')), /mutation is stopped/);
    });
});

test('owner transport rejects invalid target, absent expected tip and non-child candidates before push', (t) => {
  const f = fixture(t);
  const actor = f.open();
  const first = apply(actor.ledger, event()).attemptedRevision;
  const second = apply(actor.ledger, { type: 'claim', pullRequest: 487 }).attemptedRevision;
  let pushes = 0;
  const transport = ownerGitLedgerTransport({
    runGit(dir, args) {
      if (args[0] === 'push') pushes++;
      return git(dir, ...args);
    },
  });
  for (const fields of [
    { ref: 'refs/heads/other', revision: second, expectedRevision: first },
    { ref: REMOTE_LEDGER_REF, revision: second, expectedRevision: '' },
    { ref: REMOTE_LEDGER_REF, revision: first, expectedRevision: second },
    { ref: REMOTE_LEDGER_REF, revision: second, expectedRevision: f.genesis },
    { ref: REMOTE_LEDGER_REF, revision: f.genesis, expectedRevision: second },
  ])
    assert.throws(
      () => transport.publish({ directory: actor.directory, ...fields }),
      /invalid state publication target|not one exact-parent child/
    );
  assert.equal(pushes, 0);
  assert.equal(git(f.remote, 'rev-parse', REMOTE_LEDGER_REF), second);
});

test('identical delivery replay consumes no commits or remote writes, including fresh runs', (t) => {
  const f = fixture(t);
  const first = f.open();
  const admitted = apply(first.ledger, event());
  const count = git(f.remote, 'rev-list', '--count', REMOTE_LEDGER_REF);
  for (let i = 0; i < 12; i++) {
    const replay = first.ledger.apply(admitted.revision, event());
    assert.equal(replay.noOp, true);
    assert.equal(replay.revision, admitted.revision);
  }
  assert.equal(first.calls.writes, 1);
  const fresh = f.open(admitted.revision);
  assert.equal(apply(fresh.ledger, event()).noOp, true);
  assert.equal(fresh.calls.writes, 0);
  assert.equal(git(f.remote, 'rev-list', '--count', REMOTE_LEDGER_REF), count);
  assert.throws(
    () => apply(fresh.ledger, { ...event(), materialDigest: 'c'.repeat(64) }),
    /reused with different evidence/
  );
  assert.equal(fresh.calls.writes, 0);
  assert.equal(apply(fresh.ledger, event('event-2')).status, 'applied');
  assert.equal(fresh.calls.writes, 1);
});
