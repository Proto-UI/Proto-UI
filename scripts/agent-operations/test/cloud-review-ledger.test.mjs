import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  emptyCloudReviewLedger,
  reduceCloudReviewLedger,
  inspectCloudReviewReceipt,
  LEDGER_REPOSITORY,
} from '../cloud-review-ledger.mjs';
import { LocalCloudReviewLedger, LOCAL_LEDGER_REF } from '../local-cloud-review-ledger.mjs';
import { computeReviewInputDigest, computeReviewPacketDigest } from '../review-runtime.mjs';
import { analysis } from './fixtures/cloud-review.mjs';

const sha = (value) => value.repeat(40);
const owner = '1'.repeat(32);
const event = (deliveryId = 'delivery-1', material = 'a', pullRequest = 487) => ({
  type: 'enqueue',
  deliveryId,
  pullRequest,
  eventKind: 'synchronize',
  materialDigest: material.repeat(64),
});

function claimed() {
  return reduceCloudReviewLedger(reduceCloudReviewLedger(emptyCloudReviewLedger(), event()), {
    type: 'claim',
    owner,
    pullRequest: 487,
  });
}
const step = (state, type, extra = {}) => reduceCloudReviewLedger(state, { type, owner, ...extra });
function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-inactive-ledger-'));
  const repo = path.join(directory, 'ledger.git');
  execFileSync('git', ['init', '--bare', repo], { stdio: 'pipe' });
  const genesis = LocalCloudReviewLedger.initialize(repo);
  const open = (options) => new LocalCloudReviewLedger(repo, genesis, options);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, repo, genesis, open };
}
function apply(store, command) {
  const result = store.apply(store.read().revision, command);
  assert.equal(result.status, 'applied');
  assert.equal(result.publicationAllowed, false);
  return result.revision;
}

test('deliveries deduplicate, conflicting replays reject, and events coalesce without losing generations', () => {
  let state = claimed();
  assert.deepEqual(reduceCloudReviewLedger(state, event()), state);
  assert.throws(() => reduceCloudReviewLedger(state, event('delivery-1', 'b')), /reused/);
  state = reduceCloudReviewLedger(state, event('delivery-2', 'b'));
  state = reduceCloudReviewLedger(state, event('delivery-3', 'b'));
  assert.equal(state.pending.length, 1);
  assert.equal(state.pending[0].generation, 2);
  assert.equal(state.deliveries.length, 3);
  assert.throws(() => step(state, 'finishAnalysis', analysis()), /generation changed/);
  state = step(state, 'abandon');
  assert.equal(state.pending[0].generation, 2);
  assert.throws(() => step(state, 'claim', { pullRequest: 487 }), /consumed/);
  for (const eventKind of ['ci', 'base-update', 'comment-edited', 'bot-comment']) {
    assert.throws(
      () => reduceCloudReviewLedger(state, { ...event('unsupported'), eventKind }),
      /unsupported wake-up/
    );
  }
});

test('canonical target, exact head/base/input, principal and event provenance bind candidate analysis', () => {
  const state = claimed();
  for (const change of [
    (a) => {
      a.liveInput.headSha = sha('c');
    },
    (a) => {
      a.liveInput.baseSha = sha('c');
    },
    (a) => {
      a.liveInput.pullRequestBody = 'changed on same head';
    },
    (a) => {
      a.liveInput.pullRequest = 488;
    },
    (a) => {
      a.observation.reviewerId = '999';
    },
    (a) => {
      a.observation.reviewerLogin = 'other';
    },
    (a) => {
      a.observation.authorId = '52768321';
    },
    (a) => {
      a.observation.authorLogin = 'GUANGLIANG2019';
    },
    (a) => {
      a.observation.authorId = '';
    },
    (a) => {
      a.observation.executionModeSource = 'schedule';
    },
    (a) => {
      a.observation.executionMode = 'human-assisted';
    },
  ]) {
    const a = analysis();
    change(a);
    assert.throws(() => step(state, 'stageIntent', a));
    assert.equal(state.slot.intent, null);
  }
  const staged = step(state, 'stageIntent', analysis());
  assert.equal(staged.slot.intent.headSha, sha('b'));
  assert.equal(staged.slot.intent.policyDigest, 'f'.repeat(64));
  assert.equal(staged.slot.intent.publicationAllowed, false);
});

test('prior findings survive durable analysis and cannot disappear from reconciliation', () => {
  const first = analysis();
  first.packet.findings = [
    {
      id: 'F-1',
      severity: 'P1',
      confidence: 'high',
      file: 'src/a.ts',
      line: 1,
      authority: 'fixture',
      observed: 'broken',
      expected: 'working',
      impact: 'regression',
      fix: 'repair',
    },
  ];
  first.packet.reconciliation.newFindingIds = ['F-1'];
  first.packet.recommendedAction = 'REQUEST_CHANGES';
  let state = step(claimed(), 'finishAnalysis', first);
  assert.equal(state.slot, null);
  assert.equal(state.pending.length, 0);
  state = reduceCloudReviewLedger(state, event('next', 'b'));
  const nextOwner = '2'.repeat(32);
  state = reduceCloudReviewLedger(state, { type: 'claim', owner: nextOwner, pullRequest: 487 });
  const next = analysis({ headSha: sha('c') });
  assert.throws(
    () => reduceCloudReviewLedger(state, { type: 'finishAnalysis', owner: nextOwner, ...next }),
    /prior packet digest/
  );
  next.packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(first.packet);
  next.packet.reconciliation.priorReviewedHeadSha = first.input.headSha;
  assert.throws(
    () => reduceCloudReviewLedger(state, { type: 'finishAnalysis', owner: nextOwner, ...next }),
    /cover every prior finding|incomplete/
  );
  next.packet.reconciliation.resolvedFindingIds = ['F-1'];
  state = reduceCloudReviewLedger(state, { type: 'finishAnalysis', owner: nextOwner, ...next });
  assert.equal(state.analyses[0].packet.headSha, sha('c'));
});

test('unknown intent blocks every release, later head and other PR; receipt matching never grants a write', () => {
  let state = step(claimed(), 'stageIntent', analysis());
  state = reduceCloudReviewLedger(state, event('other-pr', 'c', 488));
  for (const type of ['abandon', 'finishAnalysis', 'stageIntent', 'expire', 'takeover']) {
    assert.throws(() => step(state, type, type === 'finishAnalysis' ? analysis() : {}));
  }
  assert.throws(
    () =>
      reduceCloudReviewLedger(state, { type: 'claim', owner: '2'.repeat(32), pullRequest: 488 }),
    /occupied/
  );
  const intent = state.slot.intent;
  const receipt = {
    id: '100',
    repositoryId: LEDGER_REPOSITORY,
    pullRequest: 487,
    authorId: '52768321',
    authorLogin: 'guangliang2019',
    commitId: sha('b'),
    state: 'APPROVED',
    body: intent.body,
  };
  assert.deepEqual(inspectCloudReviewReceipt(intent, receipt), {
    matches: true,
    authenticated: false,
    publicationAllowed: false,
    clearsSlot: false,
  });
  for (const field of [
    'id',
    'repositoryId',
    'pullRequest',
    'authorId',
    'authorLogin',
    'commitId',
    'state',
    'body',
  ]) {
    assert.equal(
      inspectCloudReviewReceipt(intent, { ...receipt, [field]: 'wrong' }).matches,
      false,
      field
    );
  }
  assert.equal(state.slot.intent.status, 'unknown');
});

test('local Git persists full baseline and rejects stale CAS after reopen', (t) => {
  const { open, genesis } = fixture(t);
  const store = open();
  apply(store, event());
  const admitted = store.read().revision;
  apply(store, { type: 'claim', pullRequest: 487 });
  apply(store, { type: 'finishAnalysis', ...analysis() });
  const reopened = open();
  assert.equal(
    reopened.read().state.analyses[0].packet.reviewInputDigest,
    analysis().packet.reviewInputDigest
  );
  assert.equal(reopened.apply(admitted, event('stale', 'b')).status, 'conflict');
  assert.equal(reopened.apply(genesis, event('older', 'c')).status, 'conflict');
  assert.equal(reopened.read().state.deliveries.length, 1);
});

test('fresh process cannot impersonate or recover a persisted owner, even before intent', (t) => {
  const { open } = fixture(t);
  const store = open();
  apply(store, event());
  apply(store, { type: 'claim', pullRequest: 487 });
  const restarted = open();
  assert.throws(() => apply(restarted, { type: 'abandon' }), /does not own/);
  assert.throws(
    () => apply(restarted, { type: 'abandon', owner: store.read().state.slot.owner }),
    /cannot supply/
  );
  assert.throws(() => apply(restarted, { type: 'claim', pullRequest: 487 }), /occupied/);
  apply(store, { type: 'stageIntent', ...analysis() });
  assert.throws(() => apply(store, { type: 'abandon' }), /unknown intent/);
  assert.equal(open().read().state.slot.intent.status, 'unknown');
});

test('acknowledgement loss after successful CAS remains unknown, with no retry or ownership adoption', (t) => {
  const { open } = fixture(t);
  const store = open();
  apply(store, event());
  let updates = 0;
  const uncertain = open({
    runner: (command, args, options) => {
      const result = execFileSync(command, args, options);
      if (args.includes('update-ref')) {
        updates += 1;
        throw new Error('lost acknowledgement');
      }
      return result;
    },
  });
  const result = uncertain.apply(uncertain.read().revision, { type: 'claim', pullRequest: 487 });
  assert.equal(result.status, 'unknown');
  assert.equal(updates, 1);
  assert.ok(open().read().state.slot);
  assert.throws(
    () => uncertain.apply(result.attemptedRevision, { type: 'abandon' }),
    /uncertain update/
  );
  assert.throws(() => apply(open(), { type: 'abandon' }), /does not own/);
});

test('separate Node processes contend for one Git CAS slot; at most one wins', async (t) => {
  const { directory, repo, genesis, open } = fixture(t);
  const store = open();
  apply(store, event());
  const expected = store.read().revision;
  const worker = path.join(directory, 'worker.mjs');
  const moduleUrl = new URL('../local-cloud-review-ledger.mjs', import.meta.url).href;
  writeFileSync(
    worker,
    `import { LocalCloudReviewLedger } from ${JSON.stringify(moduleUrl)};
import { execFileSync } from 'node:child_process';
import { readSync } from 'node:fs';
const runner=(cmd,args,opts)=>{if(args.includes('update-ref')){process.stdout.write('ready\\n'); readSync(0,Buffer.alloc(1),0,1,null);} return execFileSync(cmd,args,opts);};
const s=new LocalCloudReviewLedger(process.argv[2],process.argv[3],{runner});
console.log(JSON.stringify(s.apply(process.argv[4],{type:'claim',pullRequest:487})));
`
  );
  const children = [];
  let ready = 0;
  const run = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [worker, repo, genesis, expected]);
      children.push(child);
      let out = '',
        err = '',
        announced = false;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('CAS barrier timed out'));
      }, 10000);
      child.stdout.on('data', (chunk) => {
        out += chunk;
        if (!announced && out.includes('ready\n')) {
          announced = true;
          ready += 1;
          if (ready === 2) children.forEach((process) => process.stdin.end('x'));
        }
      });
      child.stderr.on('data', (chunk) => (err += chunk));
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve(JSON.parse(out.trim().split('\n').at(-1))) : reject(new Error(err));
      });
    });
  const results = await Promise.all([run(), run()]);
  assert.equal(ready, 2);
  assert.equal(results.filter((result) => result.status === 'applied').length, 1);
  // Both processes reached the expected-tip update. The losing Git CAS rejects;
  // the adapter conservatively classifies any lost/rejected update as unknown.
  assert.equal(results.filter((result) => result.status === 'unknown').length, 1);
  assert.equal(open().read().state.owners.length, 1);
});

test('pinned checkpoint detects reset and remote-configured stores are refused', (t) => {
  const { repo, genesis, open } = fixture(t);
  const store = open();
  const tip = apply(store, event());
  execFileSync('git', ['-C', repo, 'update-ref', LOCAL_LEDGER_REF, genesis, tip]);
  assert.throws(() => store.read(), /reset or rewrite/);
  assert.throws(() => open({ checkpoint: tip }), /reset or rewrite/);
  // A fresh reader pinned only to genesis cannot detect an administrator's
  // ancestor rollback. That same-account trust limitation is explicit.
  assert.equal(open().read().revision, genesis);
  execFileSync('git', ['-C', repo, 'update-ref', LOCAL_LEDGER_REF, tip, genesis]);
  execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', 'https://example.invalid/not-used']);
  assert.throws(() => open(), /remote-configured/);
  assert.throws(() => LocalCloudReviewLedger.initialize(repo), /without remotes/);
});

test('unknown intent survives restart after either a lost intent acknowledgement or a later simulated transport loss', (t) => {
  for (const loseAck of [false, true]) {
    const { open } = fixture(t);
    let armed = false,
      updates = 0;
    const store = open({
      runner: (command, args, options) => {
        const result = execFileSync(command, args, options);
        if (armed && args.includes('update-ref')) {
          updates += 1;
          if (loseAck) throw new Error('intent stored; acknowledgement lost');
        }
        return result;
      },
    });
    apply(store, event());
    apply(store, { type: 'claim', pullRequest: 487 });
    armed = true;
    const result = store.apply(store.read().revision, { type: 'stageIntent', ...analysis() });
    assert.equal(result.status, loseAck ? 'unknown' : 'applied');
    assert.equal(updates, 1);
    // No POST is made: ending this instance models the controller disappearing
    // at the unknown boundary, regardless of what a future transport observed.
    const restarted = open();
    assert.equal(restarted.read().state.slot.intent.status, 'unknown');
    assert.throws(() => apply(restarted, { type: 'claim', pullRequest: 487 }), /occupied/);
    assert.throws(() => apply(restarted, { type: 'abandon' }), /does not own/);
  }
});

test('a material event between intent preparation and CAS wins without admitting a stale intent', (t) => {
  const { open } = fixture(t);
  let armed = false;
  const store = open({
    runner: (command, args, options) => {
      if (armed && args.includes('update-ref')) {
        armed = false;
        apply(open(), event('race-event', 'b'));
      }
      return execFileSync(command, args, options);
    },
  });
  apply(store, event());
  apply(store, { type: 'claim', pullRequest: 487 });
  armed = true;
  assert.equal(
    store.apply(store.read().revision, { type: 'stageIntent', ...analysis() }).status,
    'unknown'
  );
  const state = open().read().state;
  assert.equal(state.slot.intent, null);
  assert.equal(state.pending[0].generation, 2);
  assert.throws(() => apply(store, { type: 'stageIntent', ...analysis() }), /uncertain update/);
});

test('corrupt and nonlinear journal histories fail closed without creating a new ledger', (t) => {
  const { repo, genesis, open } = fixture(t);
  const git = (args, input) =>
    execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      input,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
    }).trim();
  const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify({ type: 'enablePublication' }));
  const tree = git(['mktree'], `100644 blob ${blob}\tentry.json\n`);
  const invalid = git(['commit-tree', tree, '-p', genesis], 'corrupt fixture\n');
  git(['update-ref', LOCAL_LEDGER_REF, invalid, genesis]);
  assert.throws(() => open(), /unsupported ledger transition/);
  assert.equal(git(['rev-parse', LOCAL_LEDGER_REF]), invalid);
  const fork = git(['commit-tree', tree, '-p', genesis, '-p', invalid], 'merge fixture\n');
  git(['update-ref', LOCAL_LEDGER_REF, fork, invalid]);
  assert.throws(() => open(), /linear/);
});

test('recording a blocked packet cannot activate or bypass the canonical publication gate', () => {
  const evidence = analysis();
  evidence.packet.humanGates = ['unresolved-product-direction'];
  evidence.packet.unknowns = ['unverified external evidence'];
  const state = step(claimed(), 'stageIntent', evidence);
  assert.equal(state.publicationEnabled, false);
  assert.equal(state.slot.intent.publicationAllowed, false);
  assert.deepEqual(state.slot.intent.analysis.packet.humanGates, ['unresolved-product-direction']);
  assert.throws(() => reduceCloudReviewLedger(state, { type: 'publish' }), /unsupported/);
  assert.throws(() => step(claimed(), 'stagePublicationIntent', analysis()), /not enabled/);
  assert.throws(
    () => reduceCloudReviewLedger(claimed(), { ...event('extra'), publicationEnabled: true }),
    /unexpected command fields/
  );
});

test('publication intent atomically reserves its generation and defers only changed target material', () => {
  let state = reduceCloudReviewLedger(
    emptyCloudReviewLedger({ publicationEnabled: true }),
    event()
  );
  state = step(state, 'claim', { pullRequest: 487 });
  assert.throws(
    () =>
      reduceCloudReviewLedger(state, {
        type: 'stagePublicationIntent',
        owner: '2'.repeat(32),
        ...analysis(),
      }),
    /current process owner/
  );
  assert.throws(
    () =>
      step(
        reduceCloudReviewLedger(state, event('late', 'b')),
        'stagePublicationIntent',
        analysis()
      ),
    /generation changed/
  );
  state = step(state, 'stagePublicationIntent', analysis());
  assert.equal(state.slot.intent.dispatchFenced, true);
  state = reduceCloudReviewLedger(state, event('same-material'));
  assert.equal(state.deferred.length, 0);
  state = reduceCloudReviewLedger(state, event('later-material', 'b'));
  assert.equal(state.generation, 1);
  assert.equal(state.deferred.length, 1);
  assert.deepEqual(reduceCloudReviewLedger(state, event('later-material', 'b')), state);
  state = reduceCloudReviewLedger(state, event('other-pr', 'c', 488));
  assert.equal(state.pending.find((x) => x.pullRequest === 487).generation, 1);
  assert.equal(state.pending.find((x) => x.pullRequest === 488).generation, 2);
});
