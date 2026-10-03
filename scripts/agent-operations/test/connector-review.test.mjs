import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { ConnectorReviewTransport } from '../connector-review-transport.mjs';
import {
  ConnectorReviewSession as NativeConnectorReviewSession,
  CONNECTOR_AUTHORIZATION,
  INITIAL_SWEEP_AUTHORIZATION,
  INITIAL_SWEEP_ID,
} from '../connector-review-session.mjs';
import { LocalCloudReviewLedger } from '../local-cloud-review-ledger.mjs';
import { computeSelfAssessmentResultDigest } from '../assessment-runtime.mjs';
import { computeReviewPacketDigest, renderReviewBody } from '../review-runtime.mjs';
import { assessment, assessmentSnapshot } from './fixtures/connector-assessment.mjs';
import { analysis } from './fixtures/cloud-review.mjs';

const sha = (c) => c.repeat(40);
const owner = { login: 'guangliang2019', id: 52768321, type: 'User' };
const author = { login: 'contributor', id: 123, type: 'User' };
const rootPolicy = parse(
  readFileSync(
    new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url),
    'utf8'
  )
);
// Readers are trusted constructor seams, never parent command fields.
class ConnectorReviewSession extends NativeConnectorReviewSession {
  constructor({ policy, ...options }) {
    super({
      readPolicy: () => structuredClone(policy),
      readSnapshot: () => assessmentSnapshot,
      ...options,
    });
  }
}
const result = (structuredContent) => ({ isError: false, structuredContent });
function fixture() {
  const f = {
    calls: [],
    reviews: [],
    inline: [],
    threads: [],
    comments: [],
    permission: 'admin',
    pr: {
      number: 487,
      state: 'open',
      merged: false,
      draft: false,
      body: 'fixture',
      updated_at: '2026-10-03T00:00:00Z',
      user: author,
      head: { sha: sha('b') },
      base: { sha: sha('a'), ref: 'main', repo: { full_name: 'Proto-UI/Proto-UI' } },
      commits: 1,
      changed_files: 1,
    },
    commits: [{ sha: sha('b'), author, committer: author, commit: { message: 'fixture' } }],
    files: [{ filename: 'packages/core/src/index.ts', status: 'modified' }],
    checks: [
      {
        id: 2,
        head_sha: sha('b'),
        name: 'test',
        status: 'completed',
        conclusion: 'success',
        completed_at: '2026-10-03T00:00:00Z',
        details_url: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1/job/2',
        app: { slug: 'github-actions' },
        check_suite: { id: 3 },
      },
    ],
    runs: [
      {
        id: 1,
        head_sha: sha('b'),
        check_suite_id: 3,
        repository: { full_name: 'Proto-UI/Proto-UI' },
        name: 'CI',
        path: '.github/workflows/ci.yml',
      },
    ],
    statuses: [],
    writeBehavior: 'success',
  };
  f.checks = rootPolicy.trustedCiEvidence.checkNames.map((name, i) => ({
    ...f.checks[0],
    id: 20 + i,
    name,
  }));
  f.checks.push({
    id: 70,
    head_sha: sha('b'),
    name: 'DCO',
    status: 'completed',
    conclusion: 'success',
    completed_at: '2026-10-03T00:00:00Z',
    details_url: 'https://probot.github.io/apps/dco/',
    app: { id: 1861, node_id: 'MDM6QXBwMTg2MQ==', slug: 'dco' },
    check_suite: { id: 71 },
  });
  f.call = async (operation, args) => {
    f.calls.push({ operation, args });
    if (operation === 'get_profile') return result({ id: String(owner.id), nickname: owner.login });
    if (operation === 'get_repo_collaborator_permission') {
      assert.equal(args.repository_full_name, 'Proto-UI/Proto-UI');
      assert.equal(typeof args.username, 'string');
      return result({ permission: f.permission }); // no redundant identity echo
    }
    if (operation === 'list_pull_request_review_threads')
      return result({ review_threads: f.threads });
    if (operation === 'add_review_to_pr') {
      assert.equal(args.repo_full_name, 'Proto-UI/Proto-UI');
      assert.equal(args.pr_number, 487);
      assert.equal(args.commit_id, sha('b'));
      const review = {
        id: 99 + f.reviews.length,
        node_id: `PRR_${99 + f.reviews.length}`,
        user: owner,
        commit_id: args.commit_id,
        body: args.review,
        state: args.action === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED',
        submitted_at: `2026-10-03T00:${String(2 + f.reviews.length).padStart(2, '0')}:00Z`,
      };
      f.reviews.push(review);
      if (f.writeBehavior === 'lost') throw new Error('lost response');
      if (f.writeBehavior === 'wrong-actor') review.user = author;
      if (f.writeBehavior === 'no-id') return result({ success: true });
      return result({ id: review.node_id, state: review.state }); // head/body supplied by exact readback
    }
    assert.equal(operation, 'fetch');
    const url = new URL(args.url);
    const p = url.pathname.replace('/repos/Proto-UI/Proto-UI', '');
    let data;
    let field;
    if (p === '/pulls') data = f.inventory ?? [{ ...f.pr, id: 487, number: 487 }];
    else if (p === '/pulls/487') data = f.pr;
    else if (p === '/pulls/487/files') data = f.files;
    else if (p === '/pulls/487/commits') data = f.commits;
    else if (p === '/pulls/487/reviews') data = f.reviews;
    else if (p === '/pulls/487/comments') data = f.inline;
    else if (p === '/issues/487/comments') data = f.comments;
    else if (p === '/actions/runs') {
      data = f.runs;
      field = 'workflow_runs';
    } else if (p.endsWith('/check-runs')) {
      data = f.checks;
      field = 'check_runs';
    } else if (p.endsWith('/statuses')) data = f.statuses;
    else throw new Error(`unexpected endpoint ${p}`);
    if (Array.isArray(data)) {
      const start = (Number(url.searchParams.get('page')) - 1) * 100;
      data = field
        ? { total_count: data.length, [field]: data.slice(start, start + 100) }
        : data.slice(start, start + 100);
    }
    return result({ content: JSON.stringify(data) });
  };
  return f;
}
function ledger(t, enabled = true) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pui-plugin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync('git', ['init', '--bare', dir], { stdio: 'pipe' });
  const genesis = LocalCloudReviewLedger.initialize(dir, { publicationEnabled: enabled });
  return { store: new LocalCloudReviewLedger(dir, genesis), dir, genesis };
}
async function session(t, { active = true, enabled = true, modify = () => {} } = {}) {
  const f = fixture();
  modify(f);
  const transport = new ConnectorReviewTransport(f.call);
  const l = ledger(t, enabled);
  const policy = structuredClone(rootPolicy);
  if (!active)
    policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
      'inactive';
  const s = new ConnectorReviewSession({ transport, ledger: l.store, policy });
  return { f, s, transport, ...l };
}
async function parentPacket(s) {
  const request = await s.begin(487, { kind: 'synchronize', deliveryId: 'event-1' });
  const { packet } = analysis(request.input);
  packet.agentEvidence.source = 'AI-executed review by ChatGPT; parent-owned test judgment';
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  return packet;
}
test('connector arguments bind permission, paginated inventory and Bot identities map canonically', async () => {
  const f = fixture();
  for (let i = 0; i < 101; i++)
    f.inline.push({
      id: i + 1,
      node_id: `C${i}`,
      user: { login: 'example[bot]', type: 'Bot' },
      body: 'note',
      updated_at: '2026-10-03T00:00:00Z',
    });
  f.threads = [
    {
      id: 'T1',
      is_resolved: false,
      comments: f.inline.map((c) => ({
        id: c.node_id,
        database_id: c.id,
        body: c.body,
        updated_at: c.updated_at,
        author: { login: 'example' },
      })),
    },
  ];
  const live = await new ConnectorReviewTransport(f.call).collect(487);
  assert.equal(live.coverage.reviewComments, 101);
  assert.equal(live.input.replies[0].author, 'example');
  assert.equal(live.permissionEvidence.arguments.username, owner.login);
  assert.equal(live.input.checks[0].workflowPath, '.github/workflows/ci.yml');
  assert(f.calls.some((c) => c.args.url?.includes('/comments?per_page=100&page=3')));
});
test('coverage gaps, duplicate pages, workflow ambiguity and owner PR fail closed', async () => {
  for (const mutate of [
    (f) => {
      f.inline = [{ id: 1, node_id: 'C', body: 'missing' }];
    },
    (f) => {
      f.files.push(f.files[0]);
      f.pr.changed_files++;
    },
    (f) => {
      f.runs.push({ ...f.runs[0], id: 22 });
    },
    (f) => {
      f.pr.user = owner;
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(new ConnectorReviewTransport(f.call).collect(487));
  }
});
test('shipped active scope uses parent packet, exact connector request and durable attributable receipt once', async (t) => {
  const { f, s, store, dir, genesis } = await session(t);
  const packet = await parentPacket(s);
  const done = await s.publishParentPacket(packet, assessment);
  assert.equal(done.status, 'published');
  assert.equal(done.receipt.id, '99');
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
  assert(!done.receipt.body.includes('Publication disabled'));
  const state = new LocalCloudReviewLedger(dir, genesis).read().state;
  assert.equal(state.slot, null);
  assert.equal(state.analyses[0].publicationReceipt.id, '99');
  assert.equal(state.publicationReceipts[0].nodeId, 'PRR_99');
  await assert.rejects(s.publishParentPacket(packet, assessment), /one publication attempt/);
  assert.equal(store.read().state.publicationEnabled, true);
});
test('disabled scope and inactive genesis cannot authorize a tool review', async (t) => {
  const a = await session(t, { active: false });
  await assert.rejects(parentPacket(a.s), /event scope is not active/);
  assert.equal(a.f.calls.length, 0);
  assert.equal(a.store.read().state.slot, null);
  const b = await session(t, { enabled: false });
  await assert.rejects(parentPacket(b.s), /explicitly provisioned/);
});
test('lost result, absent returned object ID and wrong receipt actor stay unknown without retry or takeover', async (t) => {
  for (const behavior of ['lost', 'no-id', 'wrong-actor'])
    await t.test(behavior, async (t) => {
      const { f, s, store, dir, genesis } = await session(t);
      const packet = await parentPacket(s);
      f.writeBehavior = behavior;
      const done = await s.publishParentPacket(packet, assessment);
      assert.equal(done.status, 'unknown');
      assert.equal(done.retryAllowed, false);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
      assert.equal(store.read().state.slot.intent.status, 'unknown');
      await assert.rejects(s.abandonBeforeIntent(), /cannot abandon/);
      const fresh = new LocalCloudReviewLedger(dir, genesis);
      assert.throws(
        () => fresh.consumePublicationAttempt(store.read().state.slot.intent.id),
        /fresh, stopped or restarted/
      );
    });
});
test('canonical debt/human/findings/identity/CI gates remain before connector mutation', async (t) => {
  for (const [name, mutate] of [
    [
      'human',
      (f, p) => {
        p.humanGates = ['maintainer'];
      },
    ],
    [
      'attribution',
      (f, p) => {
        p.agentEvidence.source = 'human reviewer';
      },
    ],
    [
      'no finding',
      (f, p) => {
        p.recommendedAction = 'REQUEST_CHANGES';
      },
    ],
    [
      'revoked permission',
      (f) => {
        f.permission = 'read';
      },
    ],
    [
      'same-head drift',
      (f) => {
        f.pr.body = 'changed';
      },
    ],
    [
      'self contribution',
      (f) => {
        f.commits[0].author = owner;
      },
    ],
  ])
    await t.test(name, async (t) => {
      const { f, s } = await session(t);
      const packet = await parentPacket(s);
      mutate(f, packet);
      await assert.rejects(s.publishParentPacket(packet, assessment));
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('finding-backed Request Changes publishes through the same guarded connector route', async (t) => {
  const { f, s } = await session(t);
  const packet = await parentPacket(s);
  packet.recommendedAction = 'REQUEST_CHANGES';
  packet.findings = [
    {
      id: 'F1',
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
  packet.reconciliation.newFindingIds = ['F1'];
  const result = await s.publishParentPacket(packet, assessment);
  assert.equal(result.status, 'published');
  assert.equal(result.receipt.state, 'CHANGES_REQUESTED');
  assert.equal(
    f.calls.find((c) => c.operation === 'add_review_to_pr').args.action,
    'REQUEST_CHANGES'
  );
});
test('same-account receipt contradiction is rejected even when object readback matches', async (t) => {
  const { f, s } = await session(t);
  const packet = await parentPacket(s);
  // A new transport retains the same collected fixture; the contradictory
  // normalized author is supplied by its own invocation, not a PR body.
  const original = f.call;
  const transport = new ConnectorReviewTransport(async (op, args) => {
    const value = await original(op, args);
    if (op === 'add_review_to_pr') value.structuredContent.author = { login: 'other' };
    return value;
  });
  const l = ledger(t);
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
    'active';
  const otherSession = new ConnectorReviewSession({ transport, ledger: l.store, policy });
  const otherPacket = await parentPacket(otherSession);
  assert.equal((await otherSession.publishParentPacket(otherPacket, assessment)).status, 'unknown');
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
});

test('permission revoked after durable intent prevents the connector request and keeps unknown slot', async (t) => {
  const { f, s, store } = await session(t);
  // The transport retains its dispatcher; change the fixture when its durable
  // intent becomes visible, before the third live permission response.
  const packet = await parentPacket(s);
  const apply = store.apply.bind(store);
  store.apply = (...args) => {
    const applied = apply(...args);
    if (args[1].type === 'stagePublicationIntent') f.permission = 'read';
    return applied;
  };
  const done = await s.publishParentPacket(packet, assessment);
  assert.equal(done.status, 'unknown');
  assert.match(done.reason, /permission unavailable/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(store.read().state.slot.intent.status, 'unknown');
});

test('fresh session suppresses its proven own-review wakeup using durable receipt', async (t) => {
  const { f, s, dir, genesis, transport } = await session(t);
  const packet = await parentPacket(s);
  assert.equal((await s.publishParentPacket(packet, assessment)).status, 'published');
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
    'active';
  const store = new LocalCloudReviewLedger(dir, genesis);
  const before = store.read().revision;
  const fresh = new ConnectorReviewSession({ transport, ledger: store, policy });
  const wakeup = await fresh.begin(487, {
    kind: 'human-review',
    deliveryId: 'own-review',
    reviewId: '99',
  });
  assert.equal(wakeup.skipped, true);
  assert.equal(store.read().revision, before);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
});

test('default bridge refuses publication and replayed tool results without remote calls', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/agent-operations/connector-review-worker.mjs'],
    {
      input:
        JSON.stringify({ kind: 'publish', output: '/tmp/unused-review-result.json' }) +
        '\n' +
        JSON.stringify({ kind: 'tool-result', id: 'unissued', result: {} }) +
        '\n',
      encoding: 'utf8',
    }
  );
  const frames = output.trim().split('\n').map(JSON.parse);
  assert.equal(frames[0].mode, 'read-only');
  assert.match(frames[1].message, /read-only/);
  assert.match(frames[2].message, /unknown or replayed/);
  assert(!frames.some((f) => f.kind === 'tool-call'));
});

test('v5 keeps full messages, unknown review authors and fresh bound approval permissions', async () => {
  const f = fixture();
  f.commits[0].commit.message = 'subject\n\nfull body';
  f.reviews = [
    {
      id: 5,
      node_id: 'R5',
      user: owner,
      state: 'APPROVED',
      commit_id: sha('b'),
      body: '',
      submitted_at: '2026-10-03T00:01:00Z',
    },
    {
      id: 6,
      node_id: 'R6',
      user: null,
      state: 'CHANGES_REQUESTED',
      commit_id: sha('a'),
      body: '',
      submitted_at: '2026-10-03T00:02:00Z',
    },
  ];
  const live = await new ConnectorReviewTransport(f.call).collect(487);
  assert.equal(live.input.schemaVersion, 5);
  assert.equal(live.input.commits[0].message, 'subject\n\nfull body');
  assert.equal(live.input.commits[0].author.login, 'contributor');
  assert.equal(live.input.reviews[1].author, null);
  assert.deepEqual(live.input.reviewerPermissions, [
    {
      login: owner.login,
      permission: 'admin',
      source: 'github-rest-collaborator-permission',
      endpoint: `repos/Proto-UI/Proto-UI/collaborators/${owner.login}/permission`,
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      headSha: sha('b'),
    },
  ]);
  assert.equal(f.calls.filter((c) => c.operation === 'get_repo_collaborator_permission').length, 2);
});

test('missing, failed or counterfeit DCO and incomplete trusted CI cannot authorize approval', async (t) => {
  for (const mode of ['missing', 'failed', 'counterfeit', 'incomplete-ci'])
    await t.test(mode, async (t) => {
      const { f, s } = await session(t, {
        modify(f) {
          if (mode === 'missing') f.checks = f.checks.filter((c) => c.name !== 'DCO');
          if (mode === 'failed') f.checks.at(-1).conclusion = 'failure';
          if (mode === 'counterfeit') f.checks.at(-1).app.node_id = 'untrusted-app';
          if (mode === 'incomplete-ci')
            f.checks = f.checks.filter((c) => c.name !== 'release-scan');
        },
      });
      const packet = await parentPacket(s);
      await assert.rejects(
        s.publishParentPacket(packet, assessment),
        /trusted DCO|successful live checks/
      );
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('REST validity does not invent a GitHub platform identity for an unknown contributor', async (t) => {
  const { f, s } = await session(t, {
    modify(f) {
      f.commits[0].committer = null;
      f.commits[0].commit.committer = { name: 'GitHub', email: 'noreply@github.com' };
      f.commits[0].commit.verification = { verified: true, reason: 'valid' };
    },
  });
  const request = await s.begin(487, { kind: 'synchronize', deliveryId: 'unknown-platform' });
  assert.equal(request.input.commits[0].committer.platform, null);
  const { packet } = analysis(request.input);
  packet.agentEvidence.source = 'AI-executed review by ChatGPT';
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  await assert.rejects(s.publishParentPacket(packet, assessment), /contributor identity/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('initial sweep and later event cumulatively reconcile findings with exact canonical bodies', async (t) => {
  const { f, s, dir, genesis, transport } = await session(t);
  await s.captureInitialSweep();
  const request0 = await s.beginInitialSweep(487);
  assert.equal(request0.executionModeSource, 'delegated-owner-initial-sweep');
  const { packet: first } = analysis(request0.input);
  first.agentEvidence.source = 'AI-executed review by ChatGPT';
  first.agentEvidence.disposition = 'complete';
  first.agentEvidence.debt = [];
  first.recommendedAction = 'REQUEST_CHANGES';
  first.findings = [
    {
      id: 'F1',
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
  first.reconciliation.newFindingIds = ['F1'];
  const done = await s.publishParentPacket(first, assessment);
  assert.equal(done.status, 'published');
  assert.equal(done.receipt.body, renderReviewBody(first));
  const repeated = new ConnectorReviewSession({
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
    policy: rootPolicy,
  });
  assert.equal((await repeated.beginInitialSweep(487)).skipped, true);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
  f.comments.push({
    id: 5,
    node_id: 'C5',
    user: author,
    body: 'new material',
    updated_at: '2026-10-03T00:03:00Z',
  });
  const next = new ConnectorReviewSession({
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
    policy: rootPolicy,
  });
  const request = await next.begin(487, { kind: 'human-comment', deliveryId: 'event-2' });
  const { packet } = analysis(request.input);
  packet.agentEvidence.source = 'AI-executed review by ChatGPT';
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  packet.reconciliation.priorReviewedHeadSha = first.headSha;
  packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(first);
  packet.reconciliation.resolvedFindingIds = ['F1'];
  const second = await next.publishParentPacket(packet, assessment);
  assert.equal(second.status, 'published');
  assert.equal(second.receipt.body, renderReviewBody(packet));
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 2);
});

test('fresh run rejects a cleared prior pointer or omitted prior finding before intent', async (t) => {
  for (const mode of ['cleared-pointer', 'omitted-finding'])
    await t.test(mode, async (t) => {
      const { f, s, dir, genesis, transport } = await session(t);
      const first = await parentPacket(s);
      first.recommendedAction = 'REQUEST_CHANGES';
      first.findings = [
        {
          id: 'F1',
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
      first.reconciliation.newFindingIds = ['F1'];
      const done = await s.publishParentPacket(first, assessment);
      assert.equal(done.status, 'published');
      assert.equal(done.receipt.body, renderReviewBody(first));
      f.comments.push({
        id: 5,
        node_id: 'C5',
        user: author,
        body: 'new material',
        updated_at: '2026-10-03T00:03:00Z',
      });
      const next = new ConnectorReviewSession({
        transport,
        ledger: new LocalCloudReviewLedger(dir, genesis),
        policy: rootPolicy,
      });
      const request = await next.begin(487, { kind: 'human-comment', deliveryId: 'event-2' });
      const { packet } = analysis(request.input);
      packet.agentEvidence.source = 'AI-executed review by ChatGPT';
      packet.agentEvidence.disposition = 'complete';
      packet.agentEvidence.debt = [];
      packet.reconciliation.priorReviewedHeadSha = first.headSha;
      packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(first);
      packet.reconciliation.resolvedFindingIds = ['F1'];
      if (mode === 'cleared-pointer') {
        packet.reconciliation.priorReviewedHeadSha = null;
        packet.reconciliation.priorPacketDigest = null;
      } else packet.reconciliation.resolvedFindingIds = [];
      await assert.rejects(next.publishParentPacket(packet, assessment), /prior|reconciliation/i);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
      assert.equal(new LocalCloudReviewLedger(dir, genesis).read().state.slot.intent, null);
    });
});

test('initial sweep uses its exact admitted scope and cannot masquerade as webhook intake', async (t) => {
  const { s, f, transport, store } = await session(t);
  await assert.rejects(
    s.begin(487, { kind: 'initial-sweep', deliveryId: 'fake-webhook' }),
    /unsupported event/
  );
  for (const mutation of ['missing', 'inactive', 'wrong-id']) {
    const policy = structuredClone(rootPolicy);
    const scope = policy.reviewSubmissionAuthorizations.find(
      (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
    );
    if (mutation === 'missing')
      policy.reviewSubmissionAuthorizations = policy.reviewSubmissionAuthorizations.filter(
        (x) => x !== scope
      );
    if (mutation === 'inactive') scope.status = 'inactive';
    if (mutation === 'wrong-id') scope.initialSweepId = 'arbitrary-workflow';
    const candidate = new ConnectorReviewSession({ transport, ledger: store, policy });
    await assert.rejects(candidate.beginInitialSweep(487), /separately admitted exact scope/);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(store.read().state.deliveries.length, 0);
});

test('initial sweep and webhook sessions share one global slot and replay boundary', async (t) => {
  const { s, f, transport, store, dir, genesis } = await session(t);
  await s.captureInitialSweep();
  const request = await s.beginInitialSweep(487);
  assert.equal(request.executionModeSource, 'delegated-owner-initial-sweep');
  assert.equal(store.read().state.deliveries[0].deliveryId, `${INITIAL_SWEEP_ID}:487`);
  assert.equal(store.read().state.deliveries[0].eventKind, 'initial-sweep');
  const next = new ConnectorReviewSession({
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
    policy: rootPolicy,
  });
  assert.equal(
    (await next.begin(487, { kind: 'human-comment', deliveryId: 'actual-event' })).queued,
    true
  );
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find(
    (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
  ).executionModeSource = 'delegated-owner-event';
  const bad = new ConnectorReviewSession({ transport, ledger: store, policy });
  // The existing owner cannot be displaced, regardless of another scope declaration.
  assert.equal((await bad.beginInitialSweep(487)).queued, true);
  f.comments.push({
    id: 7,
    node_id: 'C7',
    user: author,
    body: 'new discussion',
    updated_at: '2026-10-03T00:04:00Z',
  });
  await assert.rejects(bad.beginInitialSweep(487), /delivery id reused with different evidence/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('initial sweep includes draft analysis and rejects closed inventory races', async (t) => {
  for (const mode of ['draft', 'closed'])
    await t.test(mode, async (t) => {
      const { s, f } = await session(t, {
        modify(f) {
          if (mode === 'draft') f.pr.draft = true;
          // Close only after the durable inventory has been captured.
        },
      });
      await s.captureInitialSweep();
      if (mode === 'closed') {
        f.pr.state = 'closed';
        await assert.rejects(s.beginInitialSweep(487), /currently open/);
      } else {
        await s.captureInitialSweep();
        const request = await s.beginInitialSweep(487);
        const { packet } = analysis(request.input);
        packet.agentEvidence.source = 'AI-executed review by ChatGPT';
        packet.agentEvidence.disposition = 'complete';
        packet.agentEvidence.debt = [];
        packet.recommendedAction = 'COMMENT';
        assert.equal((await s.finishParentAnalysis(packet)).status, 'applied');
      }
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('initial sweep cannot borrow webhook standing authorization at publication', async (t) => {
  const { f, transport, store } = await session(t);
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find(
    (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
  ).executionModeSource = 'delegated-owner-event';
  const s = new ConnectorReviewSession({ transport, ledger: store, policy });
  await s.captureInitialSweep();
  const request = await s.beginInitialSweep(487);
  const { packet } = analysis(request.input);
  packet.agentEvidence.source = 'AI-executed review by ChatGPT';
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  await assert.rejects(s.publishParentPacket(packet, assessment), /authorization is unavailable/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(store.read().state.slot.intent, null);
});

test('default read-only worker refuses the initial sweep without any connector dispatch', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/agent-operations/connector-review-worker.mjs'],
    {
      input:
        JSON.stringify({
          kind: 'begin-initial-sweep',
          pullRequest: 487,
          output: '/tmp/unused-initial-sweep.json',
        }) + '\n',
      encoding: 'utf8',
    }
  );
  const frames = output.trim().split('\n').map(JSON.parse);
  assert.equal(frames[0].mode, 'read-only');
  assert.match(frames[1].message, /read-only/);
  assert(!frames.some((f) => f.kind === 'tool-call'));
});

test('worker permits initial-sweep-only startup without enabling event intake', async (t) => {
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
    'inactive';
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-startup-scope-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const preload = path.join(directory, 'policy.mjs');
  // Substitute only the policy dependency; execute the unchanged worker. The
  // nonexistent local cache stops construction before any remote read or write.
  writeFileSync(
    preload,
    `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const read = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  return String(file).endsWith('/internal/agent-operations/capability-policy.yaml')
    ? ${JSON.stringify(JSON.stringify(policy))} : read.call(this, file, ...args);
};
syncBuiltinESMExports();`
  );
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      preload,
      'scripts/agent-operations/connector-review-worker.mjs',
      '--ledger-dir',
      path.join(directory, 'missing-cache'),
      '--genesis',
      sha('a'),
      '--checkpoint',
      sha('a'),
    ],
    { encoding: 'utf8' }
  );
  assert.equal(child.status, 1);
  assert.doesNotMatch(child.stderr, /publication worker needs exact ledger pins/);
  assert.match(child.stderr, /missing-cache/);
  assert.doesNotMatch(child.stdout, /tool-call/);
  const { f, transport, store } = await session(t);
  const scoped = new ConnectorReviewSession({ transport, ledger: store, policy });
  await assert.rejects(
    scoped.begin(487, { kind: 'opened', deliveryId: 'paused-event' }),
    /event scope/
  );
  assert.equal(f.calls.length, 0);
  assert.equal(store.read().state.deliveries.length, 0);
  await scoped.captureInitialSweep();
  assert.equal(
    (await scoped.beginInitialSweep(487)).executionModeSource,
    'delegated-owner-initial-sweep'
  );
});

test('each intake command enforces only its own scope across all active/paused combinations', async (t) => {
  for (const eventActive of [false, true])
    for (const sweepActive of [false, true])
      for (const command of ['event', 'sweep'])
        await t.test(
          `event=${eventActive}, sweep=${sweepActive}, command=${command}`,
          async (t) => {
            const { f, transport, store } = await session(t);
            const policy = structuredClone(rootPolicy);
            policy.reviewSubmissionAuthorizations.find(
              (x) => x.id === CONNECTOR_AUTHORIZATION
            ).status = eventActive ? 'active' : 'inactive';
            policy.reviewSubmissionAuthorizations.find(
              (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
            ).status = sweepActive ? 'active' : 'inactive';
            const s = new ConnectorReviewSession({ transport, ledger: store, policy });
            const begin = () =>
              command === 'event'
                ? s.begin(487, { kind: 'synchronize', deliveryId: 'matrix-event' })
                : s.beginInitialSweep(487);
            if (command === 'event' ? eventActive : sweepActive) {
              if (command === 'sweep') await s.captureInitialSweep();
              const request = await begin();
              const { packet } = analysis(request.input);
              packet.agentEvidence.source = 'AI-executed review by ChatGPT';
              packet.agentEvidence.disposition = 'complete';
              packet.agentEvidence.debt = [];
              assert.equal((await s.publishParentPacket(packet, assessment)).status, 'published');
              assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
            } else {
              await assert.rejects(begin(), /event scope|separately admitted exact scope/);
              assert.equal(f.calls.length, 0);
              assert.equal(store.read().state.deliveries.length, 0);
              assert.equal(store.read().state.slot, null);
            }
          }
        );
});

test('parent assessment artifact is validated, derived and bound before any intent', async (t) => {
  for (const mode of [
    'flags',
    'digest',
    'band',
    'expired',
    'repository',
    'snapshot',
    'worktree',
    'policy',
  ])
    await t.test(mode, async (t) => {
      const { f, transport, store } = await session(t);
      const policy = structuredClone(rootPolicy);
      if (mode === 'policy') Object.defineProperty(policy, '__digest', { value: '0'.repeat(64) });
      const snapshot = structuredClone(assessmentSnapshot);
      if (mode === 'snapshot') snapshot.treeSha = '0'.repeat(40);
      if (mode === 'worktree') snapshot.worktreeDigest = '0'.repeat(64);
      const s = new ConnectorReviewSession({
        policy,
        transport,
        ledger: store,
        readPolicy: () => policy,
        readSnapshot: () => snapshot,
      });
      const packet = await parentPacket(s);
      let candidate = structuredClone(assessment);
      if (mode === 'flags')
        candidate = { fresh: true, validated: true, capability: assessment.capability };
      if (mode === 'digest') candidate.resultDigest = '0'.repeat(64);
      if (mode === 'band') {
        candidate.capability.band = 'C1';
        candidate.resultDigest = computeSelfAssessmentResultDigest(candidate);
      }
      if (mode === 'expired') {
        candidate.validity.expiresAt = new Date(Date.now() - 1000).toISOString();
        candidate.resultDigest = computeSelfAssessmentResultDigest(candidate);
      }
      if (mode === 'repository') {
        candidate.scope.repositoryId = 'github.com:other/repository';
        candidate.resultDigest = computeSelfAssessmentResultDigest(candidate);
      }
      await assert.rejects(s.publishParentPacket(packet, candidate), /self result|self assessment/);
      assert.equal(store.read().state.slot.intent, null);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('live policy revocation at either publication preflight prevents POST', async (t) => {
  for (const when of ['before-intent', 'after-intent'])
    await t.test(when, async (t) => {
      const { f, transport, store } = await session(t);
      const policy = structuredClone(rootPolicy);
      const s = new ConnectorReviewSession({ policy, transport, ledger: store });
      const packet = await parentPacket(s);
      const revoke = () => {
        policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
          'paused';
      };
      if (when === 'before-intent') {
        revoke();
        await assert.rejects(s.publishParentPacket(packet, assessment), /policy changed|revoked/);
        assert.equal(store.read().state.slot.intent, null);
      } else {
        const apply = store.apply.bind(store);
        store.apply = (...args) => {
          const result = apply(...args);
          if (args[1].type === 'stagePublicationIntent') revoke();
          return result;
        };
        const done = await s.publishParentPacket(packet, assessment);
        assert.equal(done.status, 'unknown');
        assert.match(done.reason, /policy changed|revoked/);
        assert.equal(store.read().state.slot.intent.status, 'unknown');
      }
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('snapshot changes after intent also fail closed without POST', async (t) => {
  const { f, transport, store } = await session(t);
  const snapshot = structuredClone(assessmentSnapshot);
  const s = new ConnectorReviewSession({
    policy: rootPolicy,
    transport,
    ledger: store,
    readSnapshot: () => snapshot,
  });
  const packet = await parentPacket(s);
  const apply = store.apply.bind(store);
  store.apply = (...args) => {
    const result = apply(...args);
    if (args[1].type === 'stagePublicationIntent') snapshot.catalogDigest = '0'.repeat(64);
    return result;
  };
  assert.equal((await s.publishParentPacket(packet, assessment)).status, 'unknown');
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('durable sweep inventory cannot expand, restart or replay a completed item', async (t) => {
  const { f, s, transport, store, dir, genesis } = await session(t);
  await assert.rejects(s.beginInitialSweep(487), /captured initial sweep/);
  assert.equal(f.calls.length, 0);
  await s.captureInitialSweep();
  const captured = store.read().revision;
  f.inventory = [{ ...f.pr, id: 488, number: 488 }];
  assert.equal((await s.captureInitialSweep()).status, 'captured');
  assert.equal(store.read().revision, captured);
  await assert.rejects(s.beginInitialSweep(488), /captured initial sweep/);
  assert.throws(
    () =>
      store.apply(captured, {
        type: 'captureInitialSweep',
        sweepId: INITIAL_SWEEP_ID,
        pullRequests: [487, 488],
      }),
    /already captured/
  );
  assert.throws(
    () =>
      store.apply(captured, {
        type: 'enqueue',
        deliveryId: `${INITIAL_SWEEP_ID}:488`,
        pullRequest: 488,
        eventKind: 'initial-sweep',
        materialDigest: 'a'.repeat(64),
      }),
    /inventory/
  );
  const request = await s.beginInitialSweep(487);
  const { packet } = analysis(request.input);
  packet.recommendedAction = 'COMMENT';
  await s.finishParentAnalysis(packet);
  const fresh = new ConnectorReviewSession({
    policy: rootPolicy,
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
  });
  f.pr.head.sha = 'c'.repeat(40);
  assert.equal((await fresh.beginInitialSweep(487)).skipped, true);
  assert.deepEqual(store.read().state.initialSweep.completed, [487]);
});

test('initial inventory collector excludes owner, includes drafts and rejects changing membership', async (t) => {
  const { f, s, store } = await session(t);
  f.inventory = [
    { ...f.pr, id: 487, number: 487, draft: true },
    { ...f.pr, id: 488, number: 488, user: owner },
  ];
  await s.captureInitialSweep();
  assert.deepEqual(store.read().state.initialSweep.pullRequests, [487]);
  const g = await session(t);
  const call = g.f.call;
  let reads = 0;
  const transport = new ConnectorReviewTransport(async (op, args) => {
    if (
      op === 'fetch' &&
      args.url.includes('/pulls?') &&
      args.url.endsWith('page=1') &&
      ++reads === 2
    )
      g.f.inventory = [];
    return call(op, args);
  });
  const candidate = new ConnectorReviewSession({ policy: rootPolicy, transport, ledger: g.store });
  await assert.rejects(candidate.captureInitialSweep(), /changed during capture/);
  assert.equal(g.store.read().state.initialSweep, null);
});

test('owner route retains canonical spec, discussion and finding-backed change-request boundaries', async (t) => {
  for (const mode of ['current-spec', 'previous-spec', 'discussion', 'failed-dco-change-request'])
    await t.test(mode, async (t) => {
      const { f, s } = await session(t, {
        modify(f) {
          if (mode === 'current-spec') f.files[0].filename = 'spec/contracts/C-EXAMPLE-0001.yaml';
          if (mode === 'previous-spec') {
            f.files[0].status = 'renamed';
            f.files[0].previous_filename = 'spec/contracts/C-EXAMPLE-0001.yaml';
          }
          if (mode === 'discussion') {
            const comment = {
              id: 7,
              node_id: 'C7',
              user: author,
              body: 'Mechanical question considered by parent',
              updated_at: '2026-10-03T00:00:00Z',
            };
            f.inline = [comment];
            f.threads = [
              {
                id: 'T1',
                is_resolved: false,
                comments: [
                  {
                    id: comment.node_id,
                    database_id: comment.id,
                    author,
                    body: comment.body,
                    updated_at: comment.updated_at,
                  },
                ],
              },
            ];
          }
          if (mode === 'failed-dco-change-request')
            f.checks.find((x) => x.name === 'DCO').conclusion = 'failure';
        },
      });
      const packet = await parentPacket(s);
      if (mode === 'failed-dco-change-request') {
        packet.recommendedAction = 'REQUEST_CHANGES';
        packet.findings = [
          {
            id: 'F1',
            severity: 'P1',
            confidence: 'high',
            file: 'packages/core/src/index.ts',
            line: 1,
            authority: 'DCO evidence',
            observed: 'DCO failed',
            expected: 'Valid contribution provenance',
            impact: 'Contribution cannot be accepted',
            fix: 'Repair DCO evidence',
          },
        ];
        packet.reconciliation.newFindingIds = ['F1'];
      }
      assert.equal((await s.publishParentPacket(packet, assessment)).status, 'published');
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
    });
});

test('a generation winner or uncertain acknowledgement before the dispatch fence prevents POST', async (t) => {
  for (const mode of ['generation-winner', 'lost-fence-ack'])
    await t.test(mode, async (t) => {
      const { f, s, store } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      store.apply = (revision, command) => {
        if (command.type === 'stagePublicationIntent') {
          if (mode === 'generation-winner')
            apply(revision, {
              type: 'enqueue',
              deliveryId: 'fence-race',
              pullRequest: 487,
              eventKind: 'synchronize',
              materialDigest: 'd'.repeat(64),
            });
          else {
            apply(revision, command);
            return { status: 'unknown' };
          }
        }
        return apply(revision, command);
      };
      await assert.rejects(s.publishParentPacket(packet, assessment), /intent acknowledgement/);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      assert.equal(
        store.read().state.slot.intent?.status ?? null,
        mode === 'lost-fence-ack' ? 'unknown' : null
      );
    });
});

test('material arriving during final collection is persisted but prevents dispatch', async (t) => {
  const { f, s, store, transport } = await session(t);
  const packet = await parentPacket(s);
  const collect = transport.collect.bind(transport);
  transport.collect = async (...args) => {
    const live = await collect(...args);
    const state = store.read();
    if (state.state.slot?.intent?.dispatchFenced)
      store.apply(state.revision, {
        type: 'enqueue',
        deliveryId: 'during-final-collection',
        pullRequest: 487,
        eventKind: 'human-comment',
        materialDigest: 'd'.repeat(64),
      });
    return live;
  };
  const result = await s.publishParentPacket(packet, assessment);
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /deferred before publication/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(store.read().state.deferred.length, 1);
});

test('late wake-up is serialized after dispatch and survives a fresh run without advancing the fenced generation', async (t) => {
  for (const kind of ['synchronize', 'human-comment'])
    await t.test(kind, async (t) => {
      const { f, s, store, transport, dir, genesis } = await session(t);
      const packet = await parentPacket(s);
      const submit = transport.submit.bind(transport);
      transport.submit = async (...args) => {
        const before = store.read();
        assert.equal(before.state.slot.intent.dispatchFenced, true);
        store.apply(before.revision, {
          type: 'enqueue',
          deliveryId: `late-${kind}`,
          pullRequest: 487,
          eventKind: kind,
          materialDigest: 'd'.repeat(64),
        });
        const during = new LocalCloudReviewLedger(dir, genesis).read().state;
        assert.equal(during.pending[0].generation, before.state.slot.generation);
        assert.equal(during.deferred.length, 1);
        if (kind === 'synchronize') f.pr.head.sha = sha('c');
        return submit(...args);
      };
      const result = await s.publishParentPacket(packet, assessment);
      assert.equal(result.status, 'published');
      assert.equal(result.reviewedHeadSha, sha('b'));
      assert.equal(result.observedHeadSha, kind === 'synchronize' ? sha('c') : sha('b'));
      assert.equal(result.followUpRequired, true);
      assert.equal(result.followUpQueued, true);
      const after = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.equal(after.slot, null);
      assert.equal(after.deferred.length, 0);
      assert(after.pending[0].generation > 1);
      assert.equal(after.publicationReceipts[0].headSha, sha('b'));
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
    });
});

test('external head change without an admitted event queues a read-observed follow-up, never new-head approval', async (t) => {
  const { f, s, store, transport } = await session(t);
  const packet = await parentPacket(s);
  const submit = transport.submit.bind(transport);
  transport.submit = async (...args) => {
    f.pr.head.sha = sha('c');
    return submit(...args);
  };
  const result = await s.publishParentPacket(packet, assessment);
  assert.equal(result.reviewedHeadSha, sha('b'));
  assert.equal(result.observedHeadSha, sha('c'));
  assert.equal(result.followUpQueued, true);
  assert.equal(store.read().state.pending.length, 1);
  assert.match(store.read().state.deliveries.at(-1).deliveryId, /^post-review:/);
  assert.equal(f.calls.find((c) => c.operation === 'add_review_to_pr').args.commit_id, sha('b'));
});

test('fenced unknown outcome retains deferred work and cannot be adopted after restart', async (t) => {
  const { f, s, store, transport, dir, genesis } = await session(t);
  const packet = await parentPacket(s);
  const submit = transport.submit.bind(transport);
  transport.submit = async (...args) => {
    store.apply(store.read().revision, {
      type: 'enqueue',
      deliveryId: 'unknown-late-event',
      pullRequest: 487,
      eventKind: 'synchronize',
      materialDigest: 'd'.repeat(64),
    });
    f.writeBehavior = 'lost';
    return submit(...args);
  };
  assert.equal((await s.publishParentPacket(packet, assessment)).status, 'unknown');
  const fresh = new LocalCloudReviewLedger(dir, genesis);
  const state = fresh.read().state;
  assert.equal(state.slot.intent.dispatchFenced, true);
  assert.equal(state.deferred.length, 1);
  assert.throws(
    () => fresh.consumePublicationAttempt(state.slot.intent.id),
    /fresh, stopped or restarted/
  );
  assert.throws(() => fresh.apply(fresh.read().revision, { type: 'abandon' }), /does not own/);
});

test('post-publication observation or paused event scope cannot cause dismissal, retry or scope borrowing', async (t) => {
  for (const mode of ['unavailable', 'event-paused'])
    await t.test(mode, async (t) => {
      const { f, transport, store } = await session(t);
      const policy = structuredClone(rootPolicy);
      if (mode === 'event-paused')
        policy.reviewSubmissionAuthorizations.find((x) => x.id === CONNECTOR_AUTHORIZATION).status =
          'inactive';
      const s = new ConnectorReviewSession({ policy, transport, ledger: store });
      await s.captureInitialSweep();
      const request = await s.beginInitialSweep(487);
      const { packet } = analysis(request.input);
      packet.agentEvidence.source = 'AI-executed review by ChatGPT';
      packet.agentEvidence.disposition = 'complete';
      packet.agentEvidence.debt = [];
      transport.observeHead = async () => {
        if (mode === 'unavailable') throw Error('observation unavailable');
        return sha('c');
      };
      const result = await s.publishParentPacket(packet, assessment);
      assert.equal(result.status, 'published');
      assert.equal(result.followUpRequired, true);
      assert.equal(result.followUpQueued, false);
      assert.match(result.followUpError, /unavailable|active event scope/);
      assert.equal(result.reviewedHeadSha, sha('b'));
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
      assert.equal(store.read().state.pending.length, 0);
    });
});

test('known receipt survives a definitive finalize conflict without a second POST', async (t) => {
  for (const pullRequest of [487, 488])
    await t.test(`enqueue PR ${pullRequest}`, async (t) => {
      const { f, s, store, dir, genesis } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      let attempts = 0;
      store.apply = (revision, command) => {
        if (command.type === 'finalizePublication' && ++attempts === 1) {
          const other = new LocalCloudReviewLedger(dir, genesis);
          other.apply(other.read().revision, {
            type: 'enqueue',
            deliveryId: 'receipt-race',
            pullRequest,
            eventKind: 'human-comment',
            materialDigest: 'e'.repeat(64),
          });
        }
        return apply(revision, command);
      };
      const result = await s.publishParentPacket(packet, assessment);
      assert.equal(result.status, 'published');
      assert.equal(attempts, 2);
      assert.equal(result.followUpQueued, pullRequest === 487);
      assert.equal(store.read().state.slot, null);
      assert.equal(store.read().state.publicationReceipts.length, 1);
      assert.equal(store.read().state.pending[0].pullRequest, pullRequest);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
    });
});

test('receipt persistence stops on uncertainty or bounded contention without repeating publication', async (t) => {
  for (const mode of ['unknown', 'lost-applied-ack', 'persistent-conflict', 'intent-drift'])
    await t.test(mode, async (t) => {
      const { f, s, store } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      const read = store.read.bind(store);
      let attempts = 0;
      store.apply = (revision, command) => {
        if (command.type !== 'finalizePublication') return apply(revision, command);
        attempts++;
        if (mode === 'lost-applied-ack') {
          apply(revision, command);
          return { status: 'unknown' };
        }
        if (mode === 'unknown') return { status: 'unknown' };
        if (mode === 'intent-drift') {
          store.read = () => {
            const snapshot = read();
            snapshot.state.slot.intent.id = '0'.repeat(64);
            return snapshot;
          };
          return { status: 'conflict' };
        }
        apply(revision, {
          type: 'enqueue',
          deliveryId: `receipt-contention-${attempts}`,
          pullRequest: 488,
          eventKind: 'human-comment',
          materialDigest: String(attempts).repeat(64),
        });
        return apply(revision, command);
      };
      const result = await s.publishParentPacket(packet, assessment);
      assert.equal(result.status, 'unknown');
      assert.equal(result.publicationConfirmed, true);
      assert.equal(result.receipt.commitId, sha('b'));
      assert.equal(attempts, mode === 'persistent-conflict' ? 3 : 1);
      assert.equal(result.retryAllowed, false);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
      if (mode === 'intent-drift') assert.match(result.reason, /fenced publication intent changed/);
      store.read = read;
    });
});
