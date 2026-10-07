import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import {
  CloudReviewDryRun,
  collectCloudReviewInput,
  inspectCloudReceiptReadback,
} from '../cloud-review-dry-run.mjs';
import { LocalCloudReviewLedger } from '../local-cloud-review-ledger.mjs';
import { renderReviewBody } from '../review-runtime.mjs';
import { analysis } from './fixtures/cloud-review.mjs';

const policy = parse(
  readFileSync(
    new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url),
    'utf8'
  )
);
const assessment = {
  fresh: true,
  validated: true,
  capability: { band: 'C4', recommendedReviewClasses: ['review-governed-implementation-slice'] },
};
const actor = { id: 19223209, login: 'cyjin-yl' };
const other = { id: 123, login: 'contributor' };
const sha = (char) => char.repeat(40);
const connection = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
function transport() {
  const pr = {
    number: 487,
    base: { sha: sha('a'), repo: { full_name: 'Proto-UI/Proto-UI' } },
    head: { sha: sha('b') },
    user: other,
  };
  const commit = { sha: sha('b'), author: other, committer: other };
  const contexts = connection([
    {
      __typename: 'CheckRun',
      name: 'test',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      completedAt: '2026-10-03T00:00:00Z',
      detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
      checkSuite: {
        app: { slug: 'github-actions' },
        repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
        workflowRun: { file: { path: '.github/workflows/ci.yml' }, workflow: { name: 'CI' } },
      },
    },
  ]);
  contexts.nodes = policy.trustedCiEvidence.checkNames.map((name) => ({
    ...structuredClone(contexts.nodes[0]),
    name,
  }));
  contexts.nodes.push({
    __typename: 'CheckRun',
    name: 'DCO',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    completedAt: '2026-10-03T00:00:00Z',
    detailsUrl: 'https://probot.github.io/apps/dco/',
    checkSuite: {
      app: { slug: 'dco', id: 'MDM6QXBwMTg2MQ==' },
      repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
    },
  });
  const graph = {
    data: {
      viewer: actor,
      repository: {
        viewerPermission: 'WRITE',
        pullRequest: {
          state: 'OPEN',
          isDraft: false,
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          viewerCanMergeAsAdmin: false,
          changedFiles: 1,
          body: 'fixture',
          baseRefName: 'main',
          baseRefOid: sha('a'),
          headRefOid: sha('b'),
          author: other,
          commits: connection([
            {
              commit: {
                oid: sha('b'),
                message: 'fixture',
                author: { user: other, name: 'contributor', email: 'contributor@example.invalid' },
                committer: {
                  user: other,
                  name: 'contributor',
                  email: 'contributor@example.invalid',
                },
                statusCheckRollup: { contexts },
              },
            },
          ]),
          reviews: connection([]),
          comments: connection([]),
          reviewThreads: connection([]),
        },
      },
    },
  };
  const fixture = {
    pr,
    commit,
    graph,
    viewer: actor,
    permission: { user: actor, permission: 'write' },
    files: [[{ filename: 'packages/core/src/index.ts', status: 'modified' }]],
    calls: [],
  };
  fixture.runner = (command, args) => {
    assert.equal(command, 'gh');
    assert(
      !args.includes('POST') && !args.includes('PATCH') && !args.includes('PUT'),
      'read-only runner'
    );
    fixture.calls.push(args);
    const endpoint = args.at(-1);
    if (args[1] === 'graphql') return JSON.stringify(fixture.graph);
    if (endpoint === 'user') return JSON.stringify(fixture.viewer);
    if (endpoint.endsWith('/files?per_page=100')) return JSON.stringify(fixture.files);
    if (endpoint.endsWith('/commits?per_page=100')) return JSON.stringify([[fixture.commit]]);
    if (endpoint.endsWith('/permission')) return JSON.stringify(fixture.permission);
    if (endpoint.endsWith('/reviews/42')) return JSON.stringify(fixture.receipt);
    assert.equal(endpoint, 'repos/Proto-UI/Proto-UI/pulls/487');
    return JSON.stringify(fixture.pr);
  };
  return fixture;
}
function setup(t, mutate = () => {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-cloud-pipeline-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync('git', ['init', '--bare', directory], { stdio: 'pipe' });
  const genesis = LocalCloudReviewLedger.initialize(directory);
  const ledger = new LocalCloudReviewLedger(directory, genesis);
  ledger.apply(genesis, {
    type: 'enqueue',
    deliveryId: 'synthetic-event',
    pullRequest: 487,
    eventKind: 'synchronize',
    materialDigest: 'a'.repeat(64),
  });
  const fixture = transport();
  mutate(fixture);
  const dry = new CloudReviewDryRun(ledger, policy, { runner: fixture.runner });
  const { input } = dry.begin(487);
  const { packet } = analysis(input);
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  return { dry, fixture, packet, ledger, directory, genesis };
}
test('parent packet reaches canonical gates, durable intent and fake receipt readback with zero POSTs', (t) => {
  const { dry, fixture, packet, ledger, directory, genesis } = setup(t);
  const result = dry.prepare(packet, assessment);
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.simulatedGatesPassed, true);
  assert.equal(result.canonicalAuthorization.allowed, false);
  assert.equal(result.request.commit_id, packet.headSha);
  assert(result.request.body.includes('Publication disabled'));
  // Fake writer lives only in this test, never in the runtime implementation.
  const fakeWriter = (request) => ({
    id: 42,
    user: actor,
    commit_id: request.commit_id,
    state: 'APPROVED',
    body: request.body,
  });
  const response = fakeWriter(result.request);
  fixture.receipt = structuredClone(response);
  const readback = inspectCloudReceiptReadback(result.intent, response, { runner: fixture.runner });
  assert.equal(readback.readbackMatches, true);
  assert.equal(readback.authenticatedProducer, false);
  assert.equal(readback.clearsSlot, false);
  assert.equal(
    new LocalCloudReviewLedger(directory, genesis).read().state.slot.intent.status,
    'unknown'
  );
  assert.equal(ledger.read().state.analyses.length, 0);
  assert.throws(() => dry.prepare(packet, assessment), /single-use/);
  for (const field of ['id', 'commit_id', 'body', 'state', 'user']) {
    fixture.receipt = { ...response, [field]: field === 'user' ? other : 'wrong' };
    assert.equal(
      inspectCloudReceiptReadback(result.intent, response, { runner: fixture.runner })
        .readbackMatches,
      false,
      field
    );
  }
  assert.throws(
    () => inspectCloudReceiptReadback(result.intent, {}, { runner: fixture.runner }),
    /do not retry POST/
  );
});
test('live collector fails closed on absent pagination, excluded author/contributor and permission spoofing', () => {
  const mutations = [
    (f) => {
      delete f.graph.data.repository.pullRequest.reviews.pageInfo;
    },
    (f) => {
      f.graph.data.repository.pullRequest.comments.pageInfo.hasNextPage = true;
    },
    (f) => {
      f.pr.user = actor;
      f.graph.data.repository.pullRequest.author = actor;
    },
    (f) => {
      f.commit.committer = actor;
    },
    (f) => {
      f.commit.author = null;
    },
    (f) => {
      f.viewer = other;
    },
    (f) => {
      f.permission.permission = 'read';
    },
    (f) => {
      f.permission.user = other;
    },
    (f) => {
      f.pr.head.sha = sha('c');
    },
    (f) => {
      f.commit.sha = sha('c');
    },
  ];
  for (const mutate of mutations) {
    const f = transport();
    mutate(f);
    assert.throws(() => collectCloudReviewInput(487, { runner: f.runner }));
  }
});
test('same-head material drift and live revocation during parent judgment prevent intent', async (t) => {
  for (const [label, mutate] of [
    [
      'comment',
      (f) => {
        f.graph.data.repository.pullRequest.body += ' changed';
      },
    ],
    [
      'permission',
      (f) => {
        f.permission.permission = 'read';
      },
    ],
    [
      'contributor',
      (f) => {
        f.commit.author = actor;
      },
    ],
  ])
    await t.test(label, (t) => {
      const { dry, fixture, packet, ledger } = setup(t);
      mutate(fixture);
      assert.throws(() => dry.prepare(packet, assessment));
      assert.equal(ledger.read().state.slot.intent, null);
    });
});
test('canonical and stricter cloud gates retain debt, findings, human, CI and autonomous ceiling vetoes', async (t) => {
  for (const [label, mutate, level = assessment] of [
    [
      'debt',
      (p) => {
        p.agentEvidence.debt = [
          { kind: 'verification', missing: 'test', reason: 'unrun', nextAction: 'run' },
        ];
      },
    ],
    [
      'partial',
      (p) => {
        p.agentEvidence.disposition = 'partial';
      },
    ],
    [
      'human',
      (p) => {
        p.humanGates = ['unresolved-product-direction'];
      },
    ],
    [
      'no finding',
      (p) => {
        p.recommendedAction = 'REQUEST_CHANGES';
      },
    ],
    [
      'unknown',
      (p) => {
        p.unknowns = ['not reviewed'];
      },
    ],
    ['ceiling', () => {}, { ...assessment, fresh: false }],
  ])
    await t.test(label, (t) => {
      const { dry, packet, ledger } = setup(t);
      mutate(packet);
      assert.throws(() => dry.prepare(packet, level));
      assert.equal(ledger.read().state.slot.intent, null);
    });
  for (const [label, mutate] of [
    [
      'CI failure',
      (f) => {
        f.graph.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0].conclusion =
          'FAILURE';
      },
    ],
  ])
    await t.test(label, (t) => {
      const { dry, packet, ledger } = setup(t, mutate);
      assert.throws(() => dry.prepare(packet, assessment), /canonical dry-run gate rejected/);
      assert.equal(ledger.read().state.slot.intent, null);
    });
});
test('generation race blocks preparation without losing queued work', (t) => {
  const { dry, packet, ledger } = setup(t);
  ledger.apply(ledger.read().revision, {
    type: 'enqueue',
    deliveryId: 'new-material',
    pullRequest: 487,
    eventKind: 'human-review',
    materialDigest: 'c'.repeat(64),
  });
  assert.throws(() => dry.prepare(packet, assessment), /material generation changed/);
  assert.equal(ledger.read().state.slot.intent, null);
});
test('unavailable live GraphQL never falls back to caller snapshot or empty threads', () => {
  let calls = 0;
  assert.throws(
    () =>
      collectCloudReviewInput(487, {
        runner: () => {
          calls++;
          throw new Error('Forbidden');
        },
      }),
    /Forbidden/
  );
  assert.equal(calls, 1);
});

test('finding-backed Request Changes is simulated; helper never substitutes its judgment', (t) => {
  const { dry, packet } = setup(t);
  packet.recommendedAction = 'REQUEST_CHANGES';
  packet.findings = [
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
  packet.reconciliation.newFindingIds = ['F-1'];
  const result = dry.prepare(packet, assessment);
  assert.equal(result.request.event, 'REQUEST_CHANGES');
  assert.equal(result.publicationAllowed, false);
});
test('a governed historical disposition requires reconciliation before any new intent', (t) => {
  const { dry, packet, ledger } = setup(t, (f) => {
    const input = collectCloudReviewInput(487, { runner: f.runner }).input;
    const { packet } = analysis(input);
    packet.agentEvidence.disposition = 'complete';
    packet.agentEvidence.debt = [];
    f.graph.data.repository.pullRequest.reviews.nodes.push({
      id: 'PRR_duplicate',
      author: actor,
      state: 'APPROVED',
      commit: { oid: sha('b') },
      submittedAt: '2026-10-03T00:01:00Z',
      body: renderReviewBody(packet),
    });
  });
  assert.throws(
    () => dry.prepare(packet, assessment),
    /must reconcile the latest governed prior review/
  );
  assert.equal(ledger.read().state.slot.intent, null);
});

test('one fake exchange finalizes only simulation and preserves a newer queued generation', (t) => {
  const { dry, packet, ledger, directory, genesis } = setup(t);
  let submits = 0;
  let response;
  const result = dry.simulate(packet, assessment, {
    submitOnce(request) {
      submits++;
      ledger.apply(ledger.read().revision, {
        type: 'enqueue',
        deliveryId: 'during-exchange',
        pullRequest: 487,
        eventKind: 'human-comment',
        materialDigest: 'e'.repeat(64),
      });
      response = {
        id: 81,
        user: actor,
        commit_id: request.commit_id,
        state: 'APPROVED',
        body: request.body,
      };
      return response;
    },
    readReview(id) {
      assert.equal(id, '81');
      return response;
    },
  });
  assert.equal(result.status, 'simulated');
  assert.equal(result.publicationAllowed, false);
  const state = new LocalCloudReviewLedger(directory, genesis).read().state;
  assert.equal(state.slot, null);
  assert.equal(state.analyses.length, 1);
  assert.equal(state.analyses[0].simulationReceipt.id, '81');
  assert.equal(state.pending[0].generation, 2);
  assert.equal(submits, 1);
  assert.throws(() => dry.simulate(packet, assessment, {}), /single-use/);
});
test('lost fake response and forged/readback mismatches leave unknown intent and never retry', async (t) => {
  for (const kind of ['lost-response', 'wrong-actor', 'readback-mismatch', 'readback-error'])
    await t.test(kind, (t) => {
      const { dry, packet, ledger, directory, genesis } = setup(t);
      let submits = 0;
      let reads = 0;
      let response;
      const result = dry.simulate(packet, assessment, {
        submitOnce(request) {
          submits++;
          response = {
            id: 82,
            user: actor,
            commit_id: request.commit_id,
            state: 'APPROVED',
            body: request.body,
          };
          if (kind === 'lost-response') throw new Error('response lost after fake acceptance');
          return kind === 'wrong-actor' ? { ...response, user: other } : response;
        },
        readReview() {
          reads++;
          if (kind === 'readback-error') throw new Error('unavailable');
          return { ...response, body: 'copied unrelated body' };
        },
      });
      assert.equal(result.status, 'unknown');
      assert.equal(result.retryAllowed, false);
      assert.equal(submits, 1);
      assert.equal(reads, ['lost-response', 'wrong-actor'].includes(kind) ? 0 : 1);
      const intent = ledger.read().state.slot.intent;
      assert.equal(intent.status, 'unknown');
      assert.throws(() => ledger.consumeSimulationAttempt(intent.id), /already consumed/);
      const fresh = new LocalCloudReviewLedger(directory, genesis);
      assert.throws(() => fresh.consumeSimulationAttempt(intent.id), /fresh, stopped or restarted/);
    });
});
test('ordinary unknown intent cannot be finalized as a simulation by matching copied receipts', (t) => {
  const { dry, packet, ledger } = setup(t);
  const result = dry.prepare(packet, assessment);
  const receipt = {
    repositoryId: result.intent.repositoryId,
    pullRequest: 487,
    id: '9',
    authorId: String(actor.id),
    authorLogin: actor.login,
    commitId: packet.headSha,
    state: 'APPROVED',
    body: result.intent.body,
  };
  assert.throws(
    () =>
      ledger.apply(ledger.read().revision, {
        type: 'finalizeSimulation',
        response: receipt,
        readback: receipt,
      }),
    /only a simulation/
  );
  assert.equal(ledger.read().state.slot.intent.status, 'unknown');
});

test('final read after durable intent catches revocation before the fake submit', (t) => {
  const { dry, packet, fixture, ledger } = setup(t);
  // begin has already collected once. Revoke only at the third collection,
  // after prepare persisted the intent but before the exchange could submit.
  const original = fixture.graph.data.repository.viewerPermission;
  let reads = 0;
  Object.defineProperty(fixture.graph.data.repository, 'viewerPermission', {
    get() {
      reads++;
      return reads >= 2 ? 'READ' : original;
    },
  });
  let submits = 0;
  const result = dry.simulate(packet, assessment, {
    submitOnce() {
      submits++;
    },
    readReview() {},
  });
  assert.equal(result.status, 'unknown');
  assert.equal(submits, 0);
  assert.equal(ledger.read().state.slot.intent.status, 'unknown');
});
