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
import {
  cloudReviewMaterialDigest,
  cloudReviewMaterialReceipts,
} from '../cloud-review-material.mjs';
import { LocalCloudReviewLedger } from '../local-cloud-review-ledger.mjs';
import {
  RemoteCloudReviewLedger,
  REMOTE_LEDGER_REF,
  ownerGitLedgerTransport,
} from '../remote-cloud-review-ledger.mjs';
import { computeSelfAssessmentResultDigest } from '../assessment-runtime.mjs';
import {
  authorizePullRequestMerge,
  computeReviewPacketDigest,
  computeReviewInputDigest,
  renderReviewBody,
} from '../review-runtime.mjs';
import {
  assessment,
  assessmentSnapshot,
  createConnectorAssessment,
} from './fixtures/connector-assessment.mjs';
import { analysis } from './fixtures/cloud-review.mjs';
import { modelTraceFixture } from './fixtures/modeltrace.mjs';
import { computeModelTraceReceiptDigest } from '../modeltrace.mjs';
import { reduceCloudReviewLedger } from '../cloud-review-ledger.mjs';
import { publishReview, refreshPacket, reviewSnapshot } from './fixtures/review-publication.mjs';

const sha = (c) => c.repeat(40);
const owner = { login: 'cyjin-yl', id: 19223209, type: 'User' };
const author = { login: 'contributor', id: 123, type: 'User' };
const rootPolicy = parse(
  readFileSync(
    new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url),
    'utf8'
  )
);
// Readers are trusted constructor seams, never parent command fields.
class ConnectorReviewSession extends NativeConnectorReviewSession {
  publishParentPacket(packet, assessment, reconciliation = null, measured = modelTraceFixture()) {
    return super.publishParentPacket(packet, assessment, reconciliation, measured);
  }
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
    if (operation === 'get_user_login') return result({ id: owner.id, login: owner.login });
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
      assert.equal(args.commit_id, f.expectedReviewHead ?? sha('b'));
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
  packet.agentEvidence.source =
    'AI-executed review by ChatGPT; parent-owned test judgment' +
    '\n\n' +
    modelTraceFixture().disclosure;
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
for (const count of [2, 101]) {
  test(`file pagination collects ${count} distinct paths sharing a blob SHA`, async () => {
    const f = fixture();
    f.files = Array.from({ length: count }, (_, i) => ({
      filename: `packages/core/src/file-${i}.ts`,
      status: 'modified',
      sha: (i + 1).toString(16).padStart(40, '0'),
    }));
    f.files.at(-1).sha = f.files[0].sha;
    f.pr.changed_files = count;
    const live = await new ConnectorReviewTransport(f.call).collect(487);
    assert.deepEqual(
      live.input.changedFiles.map((file) => file.path),
      f.files.map((file) => file.filename)
    );
    assert.deepEqual(
      f.calls
        .filter((call) => call.args.url?.includes('/files?'))
        .map((call) => Number(new URL(call.args.url).searchParams.get('page'))),
      Array.from({ length: Math.ceil(count / 100) + 1 }, (_, i) => i + 1)
    );
  });
  test(`file pagination rejects repeated paths among ${count} distinct blob SHAs`, async () => {
    const f = fixture();
    f.files = Array.from({ length: count }, (_, i) => ({
      filename: `packages/core/src/file-${i}.ts`,
      status: 'modified',
      sha: (i + 1).toString(16).padStart(40, '0'),
    }));
    f.files.at(-1).filename = f.files[0].filename;
    f.pr.changed_files = count;
    await assert.rejects(
      new ConnectorReviewTransport(f.call).collect(487),
      /duplicate\/repeated pagination item/
    );
  });
}
test('non-file pagination retains ID and commit SHA duplicate checks across pages', async () => {
  for (const endpoint of [
    '/pulls',
    '/pulls/487/commits',
    '/pulls/487/reviews',
    '/issues/487/comments',
    '/pulls/487/comments',
    '/actions/runs',
    '/commits/head/check-runs',
    '/commits/head/statuses',
  ]) {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      ...(endpoint.endsWith('/commits') ? {} : { id: i + 1 }),
      sha: (i + 1).toString(16).padStart(40, '0'),
      filename: `distinct-path-${i}.ts`,
    }));
    const key = endpoint.endsWith('/commits') ? 'sha' : 'id';
    rows.at(-1)[key] = rows[0][key];
    const transport = new ConnectorReviewTransport(async (operation, args) => {
      assert.equal(operation, 'fetch');
      const start = (Number(new URL(args.url).searchParams.get('page')) - 1) * 100;
      return result({ content: JSON.stringify(rows.slice(start, start + 100)) });
    });
    await assert.rejects(transport.pages(endpoint), /duplicate\/repeated pagination item/);
  }
});
test('pagination still rejects changed totals, incomplete inventories and exhausted page budgets', async () => {
  for (const [response, expected] of [
    [
      (page) => ({ total_count: page === 1 ? 1 : 2, workflow_runs: page === 1 ? [{ id: 1 }] : [] }),
      /pagination total changed/,
    ],
    [
      (page) => ({ total_count: 2, workflow_runs: page === 1 ? [{ id: 1 }] : [] }),
      /pagination inventory incomplete/,
    ],
    [(page) => ({ workflow_runs: [{ id: page }] }), /pagination budget exceeded/],
  ]) {
    const pages = [];
    const transport = new ConnectorReviewTransport(async (operation, args) => {
      assert.equal(operation, 'fetch');
      const page = Number(new URL(args.url).searchParams.get('page'));
      pages.push(page);
      return result({ content: JSON.stringify(response(page)) });
    });
    await assert.rejects(transport.pages('/actions/runs', 'workflow_runs'), expected);
    assert(pages.length <= 30);
  }
});
test('file pagination still requires filenames and the live PR file count', async () => {
  for (const [mutate, expected] of [
    [
      (f) => {
        delete f.files[0].filename;
        f.files[0].sha = sha('c');
      },
      /duplicate\/repeated pagination item/,
    ],
    [(f) => f.pr.changed_files++, /file\/commit inventory does not bind the live PR/],
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(new ConnectorReviewTransport(f.call).collect(487), expected);
  }
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
  const done = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(done.status, 'published');
  assert.equal(done.receipt.id, '99');
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
  assert(!done.receipt.body.includes('Publication disabled'));
  const state = new LocalCloudReviewLedger(dir, genesis).read().state;
  assert.equal(state.slot, null);
  assert.equal(state.analyses[0].publicationReceipt.id, '99');
  assert.equal(state.publicationReceipts[0].nodeId, 'PRR_99');
  await assert.rejects(
    s.publishParentPacket(packet, createConnectorAssessment()),
    /one publication attempt/
  );
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
      const done = await s.publishParentPacket(packet, createConnectorAssessment());
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
      await assert.rejects(s.publishParentPacket(packet, createConnectorAssessment()));
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
  const result = await s.publishParentPacket(packet, createConnectorAssessment());
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
  assert.equal(
    (await otherSession.publishParentPacket(otherPacket, createConnectorAssessment())).status,
    'unknown'
  );
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
});

test('permission revoked after durable intent prevents the connector request and cancels before attempt', async (t) => {
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
  const done = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(done.status, 'cancelled');
  assert.match(done.reason, /permission unavailable/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(store.read().state.slot, null);
  assert.equal(store.read().state.pending.length, 1);
});

test('fresh session suppresses its proven own-review wakeup using durable receipt', async (t) => {
  const { f, s, dir, genesis, transport } = await session(t);
  const packet = await parentPacket(s);
  assert.equal(
    (await s.publishParentPacket(packet, createConnectorAssessment())).status,
    'published'
  );
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

for (const [observed, canonical, canApprove] of [
  ['admin', 'admin', true],
  ['maintain', 'write', true],
  ['write', 'write', true],
  ['triage', 'read', false],
  ['read', 'read', false],
  ['none', 'none', false],
]) {
  test(`connector reviewer permission ${observed} preserves canonical ${canonical} approval eligibility`, async () => {
    const f = fixture();
    const published = publishReview(reviewSnapshot({ reviews: [], threads: [] }));
    const reviewer = published.input.reviews[0];
    f.reviews = [
      {
        id: 5,
        node_id: reviewer.id,
        user: { login: reviewer.author, id: 456, type: 'User' },
        state: reviewer.state,
        commit_id: reviewer.commitSha,
        body: reviewer.body,
        submitted_at: reviewer.submittedAt,
      },
    ];
    const call = f.call;
    f.call = (operation, args) =>
      operation === 'get_repo_collaborator_permission' && args.username === reviewer.author
        ? result({ permission: observed, role_name: 'admin' })
        : call(operation, args);
    const live = await new ConnectorReviewTransport(f.call).collect(487);
    assert.deepEqual(live.input.reviewerPermissions, [
      {
        login: reviewer.author,
        permission: canonical,
        source: 'github-rest-collaborator-permission',
        endpoint: `repos/Proto-UI/Proto-UI/collaborators/${reviewer.author}/permission`,
        repositoryId: published.input.repositoryId,
        headSha: published.input.headSha,
      },
    ]);
    // Exercise the unchanged canonical merge gate using the collected permission,
    // with a genuine fixture publication receipt and all other facts held fixed.
    published.input.reviewerPermissions = live.input.reviewerPermissions;
    const decision = authorizePullRequestMerge({
      ...modelTraceFixture(),
      ...published,
      packet: refreshPacket(published.publishedPacket, published.input),
      liveInput: structuredClone(published.input),
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      authorizationId: 'explicit-current-user',
      policy: {},
      credentialCanMerge: true,
      credentialPermission: 'WRITE',
      credentialCanBypass: false,
      actor: 'contributor',
      ciConclusion: 'success',
      dcoConclusion: 'success',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
    });
    assert.equal(decision.allowed, canApprove);
    if (!canApprove) assert.match(decision.reason, /verified current repository write permission/);
    assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  });
}

test('connector rejects unknown reviewer permissions without upgrading role metadata', async () => {
  for (const permission of [undefined, null, '', 'custom-role', 'MAINTAIN', 'TRIAGE']) {
    const f = fixture();
    f.reviews = [
      {
        id: 5,
        node_id: 'R5',
        user: { login: 'independent-reviewer', id: 456, type: 'User' },
        state: 'APPROVED',
        commit_id: sha('b'),
        body: '',
        submitted_at: '2026-10-03T00:01:00Z',
      },
    ];
    const call = f.call;
    f.call = (operation, args) =>
      operation === 'get_repo_collaborator_permission' && args.username === 'independent-reviewer'
        ? result({ permission, role_name: 'admin' })
        : call(operation, args);
    await assert.rejects(
      new ConnectorReviewTransport(f.call).collect(487),
      /approval reviewer permission unavailable/
    );
    assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  }
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
        s.publishParentPacket(packet, createConnectorAssessment()),
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
  packet.agentEvidence.source =
    'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  await assert.rejects(
    s.publishParentPacket(packet, createConnectorAssessment()),
    /contributor identity/
  );
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('initial sweep and later event cumulatively reconcile findings with exact canonical bodies', async (t) => {
  const { f, s, dir, genesis, transport } = await session(t);
  await s.captureInitialSweep();
  const request0 = await s.beginInitialSweep(487);
  assert.equal(request0.executionModeSource, 'delegated-owner-initial-sweep');
  const { packet: first } = analysis(request0.input);
  first.agentEvidence.source =
    'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
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
  const done = await s.publishParentPacket(first, createConnectorAssessment());
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
  packet.agentEvidence.source =
    'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  packet.reconciliation.priorReviewedHeadSha = first.headSha;
  packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(first);
  packet.reconciliation.resolvedFindingIds = ['F1'];
  const second = await next.publishParentPacket(packet, createConnectorAssessment());
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
      const done = await s.publishParentPacket(first, createConnectorAssessment());
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
      packet.agentEvidence.source =
        'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
      packet.agentEvidence.disposition = 'complete';
      packet.agentEvidence.debt = [];
      packet.reconciliation.priorReviewedHeadSha = first.headSha;
      packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(first);
      packet.reconciliation.resolvedFindingIds = ['F1'];
      if (mode === 'cleared-pointer') {
        packet.reconciliation.priorReviewedHeadSha = null;
        packet.reconciliation.priorPacketDigest = null;
      } else packet.reconciliation.resolvedFindingIds = [];
      await assert.rejects(
        next.publishParentPacket(packet, createConnectorAssessment()),
        /prior|reconciliation/i
      );
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
      assert.equal(new LocalCloudReviewLedger(dir, genesis).read().state.slot, null);
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
  // A wrong source now rejects before spending journal budget. The existing
  // owner remains unchanged; a separately valid session still checks replay.
  const beforeWrongScope = store.read();
  await assert.rejects(bad.beginInitialSweep(487), /separately admitted exact scope/);
  assert.deepEqual(store.read(), beforeWrongScope);
  f.comments.push({
    id: 7,
    node_id: 'C7',
    user: author,
    body: 'new discussion',
    updated_at: '2026-10-03T00:04:00Z',
  });
  const validReplay = new ConnectorReviewSession({ transport, ledger: store, policy: rootPolicy });
  await assert.rejects(
    validReplay.beginInitialSweep(487),
    /delivery id reused with different evidence/
  );
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
        packet.agentEvidence.source =
          'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
        packet.agentEvidence.disposition = 'complete';
        packet.agentEvidence.debt = [];
        packet.recommendedAction = 'COMMENT';
        assert.equal((await s.finishParentAnalysis(packet)).status, 'applied');
      }
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('initial sweep cannot borrow webhook source before capture or claim', async (t) => {
  const { f, transport, store } = await session(t);
  const policy = structuredClone(rootPolicy);
  policy.reviewSubmissionAuthorizations.find(
    (x) => x.id === INITIAL_SWEEP_AUTHORIZATION
  ).executionModeSource = 'delegated-owner-event';
  const s = new ConnectorReviewSession({ transport, ledger: store, policy });
  const before = store.read();
  await assert.rejects(s.captureInitialSweep(), /separately admitted exact scope/);
  await assert.rejects(s.beginInitialSweep(487), /separately admitted exact scope/);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(store.read(), before);
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
              packet.agentEvidence.source =
                'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
              packet.agentEvidence.disposition = 'complete';
              packet.agentEvidence.debt = [];
              assert.equal(
                (await s.publishParentPacket(packet, createConnectorAssessment())).status,
                'published'
              );
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
      let candidate = structuredClone(createConnectorAssessment());
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
      assert.equal(store.read().state.slot, null);
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
        await assert.rejects(
          s.publishParentPacket(packet, createConnectorAssessment()),
          /policy changed|revoked/
        );
        assert.equal(store.read().state.slot, null);
      } else {
        const apply = store.apply.bind(store);
        store.apply = (...args) => {
          const result = apply(...args);
          if (args[1].type === 'stagePublicationIntent') revoke();
          return result;
        };
        const done = await s.publishParentPacket(packet, createConnectorAssessment());
        assert.equal(done.status, 'cancelled');
        assert.match(done.reason, /policy changed|revoked/);
        assert.equal(store.read().state.slot, null);
        assert.equal(store.read().state.pending.length, 1);
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
  assert.equal(
    (await s.publishParentPacket(packet, createConnectorAssessment())).status,
    'cancelled'
  );
  assert.equal(store.read().state.slot, null);
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
      assert.equal(
        (await s.publishParentPacket(packet, createConnectorAssessment())).status,
        'published'
      );
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
      await assert.rejects(
        s.publishParentPacket(packet, createConnectorAssessment()),
        /intent acknowledgement/
      );
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      assert.equal(
        store.read().state.slot?.intent?.status ?? null,
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
  const result = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(result.status, 'cancelled');
  assert.match(result.reason, /deferred before publication/);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(store.read().state.slot, null);
  assert.equal(store.read().state.deferred.length, 0);
  assert.equal(store.read().state.pending[0].generation, 2);
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
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
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
  const result = await s.publishParentPacket(packet, createConnectorAssessment());
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
  assert.equal(
    (await s.publishParentPacket(packet, createConnectorAssessment())).status,
    'unknown'
  );
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
      packet.agentEvidence.source =
        'AI-executed review by ChatGPT' + '\n\n' + modelTraceFixture().disclosure;
      packet.agentEvidence.disposition = 'complete';
      packet.agentEvidence.debt = [];
      transport.observeHead = async () => {
        if (mode === 'unavailable') throw Error('observation unavailable');
        return sha('c');
      };
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
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
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
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
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
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

test('definitive final-input drift cancels an undispatched intent and preserves queued work', async (t) => {
  for (const change of ['head', 'checks', 'body'])
    await t.test(change, async (t) => {
      const { f, s, store, dir, genesis } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      store.apply = (revision, command) => {
        const result = apply(revision, command);
        if (command.type === 'stagePublicationIntent') {
          if (change === 'head') f.pr.head.sha = sha('c');
          if (change === 'checks') f.checks[0].conclusion = 'failure';
          if (change === 'body') f.pr.body = 'changed after intent';
          apply(store.read().revision, {
            type: 'enqueue',
            deliveryId: 'pre-submit-other-pr',
            pullRequest: 488,
            eventKind: 'synchronize',
            materialDigest: 'd'.repeat(64),
          });
        }
        return result;
      };
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
      assert.equal(result.status, 'cancelled');
      assert.equal(result.retryAllowed, false);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      const fresh = new LocalCloudReviewLedger(dir, genesis);
      const state = fresh.read().state;
      assert.equal(state.slot, null);
      assert.deepEqual(
        state.pending.map((x) => x.pullRequest),
        [487, 488]
      );
      assert.equal(state.analyses.length, 0);
      assert.equal(state.publicationReceipts.length, 0);
      assert.equal(
        fresh.apply(fresh.read().revision, { type: 'claim', pullRequest: 488 }).status,
        'applied'
      );
      await assert.rejects(
        s.publishParentPacket(packet, createConnectorAssessment()),
        /one publication attempt/
      );
    });
});

test('unchanged event analysis durably completes only its captured initial-sweep member', async (t) => {
  const { f, s, store, transport, dir, genesis } = await session(t);
  f.inventory = [
    { ...f.pr, id: 487, number: 487 },
    { ...f.pr, id: 488, number: 488 },
  ];
  await s.captureInitialSweep();
  const packet = await parentPacket(s);
  await s.finishParentAnalysis(packet);
  const sweep = new ConnectorReviewSession({
    policy: rootPolicy,
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
  });
  assert.equal((await sweep.beginInitialSweep(487)).skipped, true);
  const state = new LocalCloudReviewLedger(dir, genesis).read().state;
  assert.deepEqual(state.initialSweep.completed, [487]);
  assert.equal(state.pending.length, 0);
  assert.equal(state.slot, null);
  assert.equal(state.analyses.length, 1);
  assert.equal(state.analyses[0].observation.executionModeSource, 'delegated-owner-event');
  assert.equal(state.deliveries.at(-1).deliveryId, `${INITIAL_SWEEP_ID}:487`);
  f.pr.head.sha = sha('c');
  const fresh = new ConnectorReviewSession({
    policy: rootPolicy,
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
  });
  assert.equal((await fresh.beginInitialSweep(487)).reason, 'initial sweep item already completed');
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('pre-attempt cancellation retries only definitive no-write conflicts', async (t) => {
  for (const mode of [
    'conflict',
    'unknown',
    'lost-applied-ack',
    'persistent-conflict',
    'intent-drift',
  ])
    await t.test(mode, async (t) => {
      const { f, s, store } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      const read = store.read.bind(store);
      let attempts = 0;
      store.apply = (revision, command) => {
        if (command.type === 'stagePublicationIntent') {
          const result = apply(revision, command);
          f.pr.body = 'pre-submit drift';
          return result;
        }
        if (command.type !== 'cancelPublicationIntent') return apply(revision, command);
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
        if (mode === 'persistent-conflict' || attempts === 1)
          apply(revision, {
            type: 'enqueue',
            deliveryId: `cancel-contention-${attempts}`,
            pullRequest: 488,
            eventKind: 'human-comment',
            materialDigest: String(attempts).repeat(64),
          });
        return apply(revision, command);
      };
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
      assert.equal(result.status, mode === 'conflict' ? 'cancelled' : 'unknown');
      assert.equal(attempts, mode === 'conflict' ? 2 : mode === 'persistent-conflict' ? 3 : 1);
      assert.equal(result.retryAllowed, false);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      store.read = read;
      assert.equal(
        store.read().state.slot === null,
        ['conflict', 'lost-applied-ack'].includes(mode)
      );
    });
});

test('consumed attempt, even with no observed POST, cannot use cancellation or transfer ownership', async (t) => {
  for (const mode of ['consumed-then-thrown', 'revoked-after-consume', 'lost-post'])
    await t.test(mode, async (t) => {
      const { f, transport, store, dir, genesis } = await session(t);
      const policy = structuredClone(rootPolicy);
      const s = new ConnectorReviewSession({ policy, transport, ledger: store });
      const packet = await parentPacket(s);
      const consume = store.consumePublicationAttempt.bind(store);
      store.consumePublicationAttempt = (id) => {
        consume(id);
        if (mode === 'consumed-then-thrown') throw new Error('consumption acknowledgement lost');
        if (mode === 'revoked-after-consume')
          policy.reviewSubmissionAuthorizations[0].status = 'paused';
      };
      if (mode === 'lost-post') f.writeBehavior = 'lost';
      const result = await s.publishParentPacket(packet, createConnectorAssessment());
      assert.equal(result.status, 'unknown');
      const intentId = store.read().state.slot.intent.id;
      assert.throws(
        () => store.apply(store.read().revision, { type: 'cancelPublicationIntent', intentId }),
        /attempt already consumed/
      );
      const fresh = new LocalCloudReviewLedger(dir, genesis);
      assert.throws(
        () => fresh.apply(fresh.read().revision, { type: 'cancelPublicationIntent', intentId }),
        /does not own/
      );
      assert.equal(
        f.calls.filter((c) => c.operation === 'add_review_to_pr').length,
        mode === 'lost-post' ? 1 : 0
      );
    });
});

test('captured sweep material is not complete while event analysis is in flight or abandoned', async (t) => {
  for (const completion of ['finish', 'abandon'])
    await t.test(completion, async (t) => {
      const { s, transport, store, dir, genesis } = await session(t);
      await s.captureInitialSweep();
      const packet = await parentPacket(s);
      const sweep = new ConnectorReviewSession({
        policy: rootPolicy,
        transport,
        ledger: new LocalCloudReviewLedger(dir, genesis),
      });
      assert.equal((await sweep.beginInitialSweep(487)).queued, true);
      assert.deepEqual(store.read().state.initialSweep.completed, []);
      if (completion === 'finish') await s.finishParentAnalysis(packet);
      else await s.abandonBeforeIntent();
      const state = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.deepEqual(state.initialSweep.completed, completion === 'finish' ? [487] : []);
      assert.equal(state.pending.length, completion === 'finish' ? 0 : 1);
    });
});

test('sweep completion and its delivery are atomic with competing cross-scope admission', async (t) => {
  const { s, transport, store, dir, genesis } = await session(t);
  await s.captureInitialSweep();
  const packet = await parentPacket(s);
  await s.finishParentAnalysis(packet);
  const sweepStore = new LocalCloudReviewLedger(dir, genesis);
  const sweep = new ConnectorReviewSession({ policy: rootPolicy, transport, ledger: sweepStore });
  const apply = sweepStore.apply.bind(sweepStore);
  sweepStore.apply = (revision, command) => {
    store.apply(store.read().revision, {
      type: 'enqueue',
      deliveryId: 'competing-event-scope',
      pullRequest: 488,
      eventKind: 'synchronize',
      materialDigest: 'd'.repeat(64),
    });
    return apply(revision, command);
  };
  await assert.rejects(sweep.beginInitialSweep(487), /enqueue not confirmed/);
  assert.deepEqual(store.read().state.initialSweep.completed, []);
  assert.equal(
    store.read().state.deliveries.some((x) => x.eventKind === 'initial-sweep'),
    false
  );
  sweepStore.apply = apply;
  assert.equal((await sweep.beginInitialSweep(487)).skipped, true);
  const state = new LocalCloudReviewLedger(dir, genesis).read().state;
  assert.deepEqual(state.initialSweep.completed, [487]);
  assert.deepEqual(
    state.pending.map((x) => x.pullRequest),
    [488]
  );
});

// A newly started trusted policy reader may load changed bindings. Active ID alone
// must not spend journal budget or acquire the old hard-coded principal slot.
const intakeBindingMutations = [
  ['repositoryId', 'github.com:other/repository'],
  ['executionMode', 'human-assisted'],
  ['executionModeSource', 'schedule'],
  ['mutationClass', 'metadata'],
  ['principalId', '52768321'],
  ['principalLogin', 'guangliang2019'],
];
for (const operation of ['event', 'capture', 'initial-begin'])
  for (const [field, wrong] of intakeBindingMutations)
    for (const mutation of ['replace', 'missing'])
      test(
        'complete scope prevents journal effects: ' + operation + '/' + field + '/' + mutation,
        async (t) => {
          const { f, transport, store, s } = await session(t);
          if (operation === 'initial-begin') await s.captureInitialSweep();
          const before = store.read();
          f.calls.length = 0;
          const policy = structuredClone(rootPolicy);
          const authorization =
            operation === 'event' ? CONNECTOR_AUTHORIZATION : INITIAL_SWEEP_AUTHORIZATION;
          const scope = policy.reviewSubmissionAuthorizations.find((x) => x.id === authorization);
          if (mutation === 'missing') delete scope[field];
          else scope[field] = wrong;
          const candidate = new ConnectorReviewSession({ transport, ledger: store, policy });
          let rejected = false;
          try {
            if (operation === 'event')
              await candidate.begin(487, { kind: 'opened', deliveryId: 'wrong-complete-scope' });
            else if (operation === 'capture') await candidate.captureInitialSweep();
            else await candidate.beginInitialSweep(487);
          } catch {
            rejected = true;
          }
          const after = store.read();
          assert.equal(after.revision, before.revision, 'invalid scope wrote the journal');
          assert.deepEqual(after.state, before.state, 'invalid scope changed slot or pending work');
          assert.equal(f.calls.length, 0, 'invalid scope dispatched connector collection');
          assert.equal(rejected, true, 'invalid complete scope was not rejected');
        }
      );

test('confirmed review receipt survives a real remote stale-lease race without repeating POST', async (t) => {
  // Connector responses are fixtures; journal CAS executes actual local Git.
  // The production URL is substituted only with an isolated bare repository.
  const { f, transport, dir, genesis } = await session(t);
  const git = (directory, ...args) =>
    execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(dir, 'update-ref', REMOTE_LEDGER_REF, genesis);
  let peer;
  let raced = false;
  let receiptPushes = 0;
  function open(racing) {
    const cache = mkdtempSync(path.join(tmpdir(), 'pui-real-receipt-cache-'));
    t.after(() => rmSync(cache, { recursive: true, force: true }));
    git(cache, 'init', '--bare');
    const journalTransport = {
      readInto(directory) {
        git(directory, 'fetch', '--no-tags', '--no-write-fetch-head', dir, REMOTE_LEDGER_REF);
        return git(dir, 'rev-parse', REMOTE_LEDGER_REF);
      },
      publish(args) {
        const entry = JSON.parse(git(args.directory, 'show', args.revision + ':entry.json'));
        if (racing && entry.type === 'finalizePublication') {
          receiptPushes++;
          if (!raced) {
            raced = true;
            const snapshot = peer.read();
            const queued = peer.apply(snapshot.revision, {
              type: 'enqueue',
              pullRequest: 488,
              deliveryId: 'receipt-race-peer',
              eventKind: 'synchronize',
              materialDigest: 'f'.repeat(64),
            });
            assert.equal(queued.status, 'applied');
          }
        }
        return ownerGitLedgerTransport({
          runGit(directory, command) {
            return git(
              directory,
              ...command.map((arg) =>
                arg === 'https://github.com/Proto-UI/Proto-UI.git' ? dir : arg
              )
            );
          },
        }).publish(args);
      },
    };
    return new RemoteCloudReviewLedger(cache, genesis, {
      checkpoint: genesis,
      transport: journalTransport,
    });
  }
  peer = open(false);
  const store = open(true);
  const s = new ConnectorReviewSession({ transport, ledger: store, policy: rootPolicy });
  const packet = await parentPacket(s);
  const published = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(published.status, 'published');
  assert.equal(receiptPushes, 2);
  assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
  const state = store.read().state;
  assert.equal(state.publicationReceipts.length, 1);
  assert.equal(state.slot, null);
  assert(state.pending.some((item) => item.pullRequest === 488));
});

function completePacket(input, prior = null, ids = []) {
  const { packet } = analysis(input);
  packet.agentEvidence.source =
    'AI-executed review by ChatGPT; parent-owned test judgment' +
    '\n\n' +
    modelTraceFixture().disclosure;
  packet.agentEvidence.disposition = 'complete';
  packet.agentEvidence.debt = [];
  packet.findings = ids.map((id) => ({
    id,
    severity: 'P1',
    confidence: 'high',
    file: 'packages/core/src/index.ts',
    line: 1,
    authority: 'fixture',
    observed: id,
    expected: 'working',
    impact: 'regression',
    fix: 'repair',
  }));
  packet.recommendedAction = ids.length ? 'REQUEST_CHANGES' : 'APPROVE';
  packet.reconciliation = reconcilePacket(prior, ids);
  return packet;
}
function reconcilePacket(prior, ids) {
  const previous = prior?.findings.map((finding) => finding.id) ?? [];
  return {
    priorReviewedHeadSha: prior?.headSha ?? null,
    priorPacketDigest: prior ? computeReviewPacketDigest(prior) : null,
    resolvedFindingIds: previous.filter((id) => !ids.includes(id)),
    openFindingIds: previous.filter((id) => ids.includes(id)),
    newFindingIds: ids.filter((id) => !previous.includes(id)),
  };
}
function freshSession({ transport, dir, genesis }, policy = rootPolicy) {
  return new ConnectorReviewSession({
    transport,
    ledger: new LocalCloudReviewLedger(dir, genesis),
    policy,
  });
}

test('definitive staging conflict releases the original intent-free claim for fresh recovery', async (t) => {
  const context = await session(t);
  const { f, s, store, dir, genesis } = context;
  const packet = await parentPacket(s);
  const apply = store.apply.bind(store);
  store.apply = (revision, command) => {
    if (command.type === 'stagePublicationIntent')
      apply(revision, {
        type: 'enqueue',
        deliveryId: 'winner-before-intent',
        pullRequest: 487,
        eventKind: 'synchronize',
        materialDigest: 'd'.repeat(64),
      });
    return apply(revision, command);
  };
  await assert.rejects(
    s.publishParentPacket(packet, createConnectorAssessment()),
    /intent acknowledgement/
  );
  const fresh = new LocalCloudReviewLedger(dir, genesis);
  assert.equal(fresh.read().state.slot, null);
  assert.equal(fresh.read().state.pending[0].generation, 2);
  assert.equal(
    fresh.apply(fresh.read().revision, { type: 'claim', pullRequest: 487 }).status,
    'applied'
  );
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('base-only material changes cannot inherit event coverage in the initial sweep', async (t) => {
  for (const field of ['sha', 'ref'])
    await t.test(field, async (t) => {
      const context = await session(t);
      const { f, s, store } = context;
      await s.captureInitialSweep();
      await s.finishParentAnalysis(await parentPacket(s));
      f.pr.base[field] = field === 'sha' ? sha('c') : 'release';
      const next = freshSession(context);
      const request = await next.beginInitialSweep(487);
      assert.equal(request.kind, 'proto-ui.parent-review-request');
      const state = store.read().state;
      assert.deepEqual(state.initialSweep.completed, []);
      assert.equal(state.pending[0].generation, 2);
      assert.equal(request.input.baseSha, f.pr.base.sha);
      assert.equal(request.input.baseRefName, f.pr.base.ref);
      const packet = completePacket(request.input, request.priorAnalysis.packet);
      assert.equal((await next.finishParentAnalysis(packet)).status, 'applied');
      assert.deepEqual(store.read().state.initialSweep.completed, [487]);
    });
});

test('closed to reopened uses its own durable event identity and a new analysis', async (t) => {
  const context = await session(t, {
    modify: (f) => {
      f.pr.state = 'closed';
    },
  });
  const { f, s, store } = context;
  const closed = await s.begin(487, { kind: 'closed', deliveryId: 'closed-event' });
  const first = completePacket(closed.input);
  first.recommendedAction = 'ABSTAIN';
  await s.finishParentAnalysis(first);
  f.pr.state = 'open';
  const reopened = freshSession(context);
  const request = await reopened.begin(487, { kind: 'reopened', deliveryId: 'reopened-event' });
  assert.equal(request.input.pullRequestState, 'OPEN');
  assert.equal(store.read().state.deliveries.at(-1).eventKind, 'reopened');
  const recorded = store.read().state.deliveries.at(-1);
  assert.throws(
    () => store.apply(store.read().revision, { ...recorded, eventKind: 'opened' }),
    /reused/
  );
  assert.equal(store.read().state.pending[0].generation, 2);
  assert.equal(
    (
      await reopened.publishParentPacket(
        completePacket(request.input, first),
        createConnectorAssessment()
      )
    ).status,
    'published'
  );
});

test('published A survives finish-only B and restart before publication C', async (t) => {
  const context = await session(t);
  const { f, s, store } = context;
  const requestA = await s.begin(487, { kind: 'opened', deliveryId: 'sequence-a' });
  const a = completePacket(requestA.input, null, ['A1', 'A2']);
  assert.equal((await s.publishParentPacket(a, createConnectorAssessment())).status, 'published');
  f.pr.body = 'B material';
  const nextB = freshSession(context);
  const requestB = await nextB.begin(487, { kind: 'human-comment', deliveryId: 'sequence-b' });
  const b = completePacket(requestB.input, a, ['A1', 'B1']);
  assert.equal((await nextB.finishParentAnalysis(b)).status, 'applied');
  f.pr.body = 'C material';
  const nextC = freshSession(context);
  const requestC = await nextC.begin(487, { kind: 'human-comment', deliveryId: 'sequence-c' });
  const c = completePacket(requestC.input, a, ['B1', 'C1']);
  const outcome = await nextC.publishParentPacket(
    c,
    createConnectorAssessment(),
    reconcilePacket(b, ['B1', 'C1'])
  );
  assert.equal(outcome.status, 'published');
  assert.deepEqual(requestC.priorAnalysis.packet, b);
  assert.deepEqual(requestC.priorPublishedAnalysis.packet, a);
  const state = store.read().state;
  assert.deepEqual(state.analyses[0].packet, c);
  assert.deepEqual(state.publishedAnalyses[0].packet, c);
  assert.equal(state.publicationReceipts.length, 2);
  assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 2);
});

test('pre-staging failures release only the unchanged original claim and preserve pending work', async (t) => {
  for (const phase of ['collect', 'authorize', 'snapshot', 'policy', 'ledger-read', 'generation'])
    await t.test(phase, async (t) => {
      const context = await session(t);
      const { f, store, transport, dir, genesis } = context;
      const policy = structuredClone(rootPolicy);
      let snapshotUnavailable = false;
      const s = new ConnectorReviewSession({
        policy,
        transport,
        ledger: store,
        readSnapshot: () => {
          if (snapshotUnavailable) throw Error('snapshot unavailable');
          return assessmentSnapshot;
        },
      });
      const packet = await parentPacket(s);
      const read = store.read.bind(store);
      const collect = transport.collect.bind(transport);
      if (phase === 'collect')
        transport.collect = async () => {
          throw Error('collection unavailable');
        };
      if (phase === 'authorize') f.permission = 'read';
      if (phase === 'snapshot') snapshotUnavailable = true;
      if (phase === 'policy') policy.reviewSubmissionAuthorizations[0].status = 'paused';
      if (phase === 'ledger-read') {
        let once = true;
        store.read = () => {
          if (once) {
            once = false;
            throw Error('read unavailable');
          }
          return read();
        };
      }
      if (phase === 'generation')
        store.apply(store.read().revision, {
          type: 'enqueue',
          deliveryId: 'generation-before-stage',
          pullRequest: 487,
          eventKind: 'synchronize',
          materialDigest: 'd'.repeat(64),
        });
      await assert.rejects(s.publishParentPacket(packet, createConnectorAssessment()));
      const state = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.equal(state.slot, null);
      assert.equal(state.pending.length, 1);
      assert.equal(state.analyses.length, 0);
      assert.equal(state.publicationReceipts.length, 0);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      transport.collect = collect;
      f.permission = 'admin';
      // A new session can consume unchanged material because abandonment kept it pending.
      assert.equal(
        (
          await freshSession(context).begin(487, {
            kind: 'synchronize',
            deliveryId: `recover-${phase}`,
          })
        ).kind,
        'proto-ui.parent-review-request'
      );
    });
});

test('unstaged claim release retries only proven CAS conflicts and never adopts another claim', async (t) => {
  for (const mode of [
    'conflict',
    'persistent-conflict',
    'unknown',
    'lost-release-ack',
    'owner-drift',
    'intent-appeared',
    'unreadable',
  ])
    await t.test(mode, async (t) => {
      const { f, s, store, transport } = await session(t);
      const packet = await parentPacket(s);
      const read = store.read.bind(store);
      const apply = store.apply.bind(store);
      let attempts = 0;
      transport.collect = async () => {
        throw Error('collection unavailable');
      };
      store.read = () => {
        if (mode === 'unreadable') throw Error('read unavailable');
        const snapshot = read();
        if (mode === 'owner-drift') snapshot.state.slot.owner = 'e'.repeat(32);
        if (mode === 'intent-appeared') snapshot.state.slot.intent = { id: 'f'.repeat(64) };
        return snapshot;
      };
      store.apply = (revision, command) => {
        if (command.type !== 'abandon') return apply(revision, command);
        attempts++;
        if (mode === 'unknown') return { status: 'unknown' };
        if (mode === 'lost-release-ack') {
          apply(revision, command);
          return { status: 'unknown' };
        }
        if (mode === 'persistent-conflict' || (mode === 'conflict' && attempts === 1))
          apply(revision, {
            type: 'enqueue',
            deliveryId: `release-winner-${attempts}`,
            pullRequest: 488,
            eventKind: 'human-comment',
            materialDigest: String(attempts).repeat(64),
          });
        return apply(revision, command);
      };
      await assert.rejects(
        s.publishParentPacket(packet, createConnectorAssessment()),
        mode === 'conflict' ? /collection unavailable$/ : /claim release unknown/
      );
      store.read = read;
      assert.equal(
        attempts,
        mode === 'conflict'
          ? 2
          : mode === 'persistent-conflict'
            ? 3
            : ['unknown', 'lost-release-ack'].includes(mode)
              ? 1
              : 0
      );
      assert.equal(
        store.read().state.slot === null,
        ['conflict', 'lost-release-ack'].includes(mode)
      );
      assert.equal(
        store.read().state.pending.some((item) => item.pullRequest === 487),
        true
      );
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('ambiguous staging and failed acknowledged-intent readback never release an intent-free-looking slot', async (t) => {
  for (const mode of ['unknown-without-write', 'throw-without-write', 'lost-stage-ack', 'readback'])
    await t.test(mode, async (t) => {
      const { f, s, store } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      const read = store.read.bind(store);
      let releases = 0;
      store.apply = (revision, command) => {
        if (command.type === 'abandon') releases++;
        if (command.type !== 'stagePublicationIntent') return apply(revision, command);
        if (mode === 'unknown-without-write') return { status: 'unknown' };
        if (mode === 'throw-without-write') throw Error('stage result unavailable');
        const result = apply(revision, command);
        if (mode === 'lost-stage-ack') return { status: 'unknown' };
        store.read = () => {
          throw Error('readback unavailable');
        };
        return result;
      };
      await assert.rejects(s.publishParentPacket(packet, createConnectorAssessment()));
      store.read = read;
      assert.equal(releases, 0);
      assert.notEqual(store.read().state.slot, null);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('multiple unpublished analyses remain independently reconciled across source head and base changes', async (t) => {
  for (const mode of ['no-publication', 'event-to-sweep', 'sweep-to-event', 'head-and-base'])
    await t.test(mode, async (t) => {
      const context = await session(t);
      const { f, s, store } = context;
      await s.captureInitialSweep();
      const initial =
        mode === 'sweep-to-event'
          ? await s.beginInitialSweep(487)
          : await s.begin(487, { kind: 'opened', deliveryId: 'multi-a' });
      const a = completePacket(initial.input, null, ['A1', 'A2']);
      if (mode === 'no-publication') await s.finishParentAnalysis(a);
      else
        assert.equal(
          (await s.publishParentPacket(a, createConnectorAssessment())).status,
          'published'
        );
      let prior = a;
      for (const [index, ids] of [
        ['b', ['A1', 'B1']],
        ['c', ['B1', 'C1']],
      ]) {
        f.pr.body = `analysis ${index}`;
        const next = freshSession(context);
        const request = await next.begin(487, {
          kind: 'human-comment',
          deliveryId: `multi-${index}`,
        });
        const packet = completePacket(request.input, prior, ids);
        await next.finishParentAnalysis(packet);
        prior = packet;
      }
      f.pr.body = 'final publication';
      if (mode === 'head-and-base') {
        f.pr.base.sha = sha('d');
        f.pr.base.ref = 'release';
        f.pr.head.sha = sha('c');
        f.expectedReviewHead = sha('c');
        f.commits[0].sha = sha('c');
        for (const check of f.checks) check.head_sha = sha('c');
        for (const run of f.runs) run.head_sha = sha('c');
      }
      const final = freshSession(context);
      const request =
        mode === 'event-to-sweep'
          ? await final.beginInitialSweep(487)
          : await final.begin(487, { kind: 'synchronize', deliveryId: 'multi-final' });
      const primary = mode === 'no-publication' ? prior : a;
      const packet = completePacket(request.input, primary, ['C1', 'D1']);
      assert.equal(
        (
          await final.publishParentPacket(
            packet,
            createConnectorAssessment(),
            mode === 'no-publication' ? null : reconcilePacket(prior, ['C1', 'D1'])
          )
        ).status,
        'published'
      );
      const state = store.read().state;
      assert.deepEqual(request.priorAnalysis.packet, prior);
      assert.equal(request.priorPublishedAnalysis === null, mode === 'no-publication');
      assert.deepEqual(state.publishedAnalyses[0].packet, packet);
      assert.equal(state.publicationReceipts.length, mode === 'no-publication' ? 1 : 2);
      assert.equal(state.slot, null);
    });
});

test('a publication cannot omit or forge either durable reconciliation baseline', async (t) => {
  for (const mode of [
    'missing',
    'wrong-digest',
    'wrong-head',
    'omitted-finding',
    'hidden-open',
    'string',
    'primary-latest',
  ])
    await t.test(mode, async (t) => {
      const context = await session(t);
      const { f, s, store } = context;
      const a = completePacket(
        (await s.begin(487, { kind: 'opened', deliveryId: 'neg-a' })).input,
        null,
        ['A1']
      );
      await s.publishParentPacket(a, createConnectorAssessment());
      f.pr.body = 'B material';
      const next = freshSession(context);
      const b = completePacket(
        (await next.begin(487, { kind: 'human-comment', deliveryId: 'neg-b' })).input,
        a,
        ['B1']
      );
      await next.finishParentAnalysis(b);
      f.pr.body = 'C material';
      const final = freshSession(context);
      const request = await final.begin(487, { kind: 'human-comment', deliveryId: 'neg-c' });
      const c = completePacket(request.input, mode === 'primary-latest' ? b : a, ['B1']);
      let secondary = reconcilePacket(b, ['B1']);
      if (mode === 'missing') secondary = null;
      if (mode === 'wrong-digest') secondary.priorPacketDigest = computeReviewPacketDigest(a);
      if (mode === 'wrong-head') secondary.priorReviewedHeadSha = sha('f');
      if (mode === 'omitted-finding') {
        secondary.openFindingIds = [];
        secondary.newFindingIds = ['B1'];
      }
      if (mode === 'hidden-open') {
        secondary.openFindingIds = [];
        secondary.resolvedFindingIds = ['B1'];
      }
      if (mode === 'string') secondary = computeReviewPacketDigest(b);
      await assert.rejects(
        final.publishParentPacket(c, createConnectorAssessment(), secondary),
        /prior|reconciliation|finding/
      );
      assert.equal(store.read().state.slot, null);
      assert.deepEqual(store.read().state.analyses[0].packet, b);
      assert.deepEqual(store.read().state.publishedAnalyses[0].packet, a);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 1);
    });
});

test('historical field-less journal replays without rewriting and can continue with dual baselines', async (t) => {
  const context = await session(t);
  const { f, s, store, dir, genesis } = context;
  const apply = store.apply.bind(store);
  store.apply = (revision, command) => {
    const legacy = structuredClone(command);
    delete legacy.analysisReconciliation;
    return apply(revision, legacy);
  };
  const a = completePacket(
    (await s.begin(487, { kind: 'opened', deliveryId: 'legacy-a' })).input,
    null,
    ['A1']
  );
  await s.publishParentPacket(a, createConnectorAssessment());
  let prior = a;
  for (const id of ['B1', 'C1']) {
    f.pr.body = id;
    const next = freshSession(context);
    const request = await next.begin(487, { kind: 'human-comment', deliveryId: `legacy-${id}` });
    const packet = completePacket(request.input, prior, [id]);
    await next.finishParentAnalysis(packet);
    prior = packet;
  }
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  const checkpoint = store.read().revision;
  const prefix = git('rev-list', '--reverse', checkpoint);
  const entries = prefix.split('\n').map((revision) => git('show', `${revision}:entry.json`));
  assert(entries.every((entry) => !Object.hasOwn(JSON.parse(entry), 'analysisReconciliation')));
  const restarted = new LocalCloudReviewLedger(dir, genesis, { checkpoint });
  assert.deepEqual(restarted.read().state.publishedAnalyses[0].packet, a);
  assert.deepEqual(restarted.read().state.analyses[0].packet, prior);
  f.pr.body = 'new protocol';
  const final = freshSession(context);
  const request = await final.begin(487, { kind: 'human-comment', deliveryId: 'modern-d' });
  const packet = completePacket(request.input, a, ['C1']);
  assert.equal(
    (
      await final.publishParentPacket(
        packet,
        createConnectorAssessment(),
        reconcilePacket(prior, ['C1'])
      )
    ).status,
    'published'
  );
  assert.equal(git('rev-list', '--reverse', checkpoint), prefix);
  assert.deepEqual(
    prefix.split('\n').map((revision) => git('show', `${revision}:entry.json`)),
    entries
  );
  assert.equal(git('merge-base', '--is-ancestor', checkpoint, store.read().revision), '');
});

test('a real stale-lease staging conflict releases only the original intent-free owner', async (t) => {
  const { f, transport, dir, genesis } = await session(t);
  const git = (directory, ...args) =>
    execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(dir, 'update-ref', REMOTE_LEDGER_REF, genesis);
  let peer;
  let races = 0;
  function open(racing) {
    const cache = mkdtempSync(path.join(tmpdir(), 'pui-stage-race-'));
    t.after(() => rmSync(cache, { recursive: true, force: true }));
    git(cache, 'init', '--bare');
    return new RemoteCloudReviewLedger(cache, genesis, {
      checkpoint: genesis,
      transport: {
        readInto(directory) {
          git(directory, 'fetch', '--no-tags', '--no-write-fetch-head', dir, REMOTE_LEDGER_REF);
          return git(dir, 'rev-parse', REMOTE_LEDGER_REF);
        },
        publish(args) {
          const entry = JSON.parse(git(args.directory, 'show', args.revision + ':entry.json'));
          if (racing && ['stagePublicationIntent', 'abandon'].includes(entry.type) && races < 2) {
            races++;
            assert.equal(
              peer.apply(peer.read().revision, {
                type: 'enqueue',
                pullRequest: races === 1 ? 487 : 488,
                deliveryId: `real-stage-race-${races}`,
                eventKind: 'synchronize',
                materialDigest: String(races).repeat(64),
              }).status,
              'applied'
            );
          }
          return ownerGitLedgerTransport({
            runGit(directory, command) {
              return git(
                directory,
                ...command.map((arg) =>
                  arg === 'https://github.com/Proto-UI/Proto-UI.git' ? dir : arg
                )
              );
            },
          }).publish(args);
        },
      },
    });
  }
  peer = open(false);
  const store = open(true);
  const s = new ConnectorReviewSession({ transport, ledger: store, policy: rootPolicy });
  const packet = await parentPacket(s);
  await assert.rejects(
    s.publishParentPacket(packet, createConnectorAssessment()),
    /intent acknowledgement/
  );
  const fresh = open(false);
  const state = fresh.read().state;
  assert.equal(state.slot, null);
  assert.deepEqual(
    state.pending.map((item) => item.pullRequest),
    [487, 488]
  );
  assert.equal(state.publicationReceipts.length, 0);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
  assert.equal(races, 2);
  assert.equal(
    fresh.apply(fresh.read().revision, { type: 'claim', pullRequest: 487 }).status,
    'applied'
  );
});

test('finish preflight failures release the original claim without completing its analysis', async (t) => {
  for (const phase of [
    'collect',
    'identity',
    'policy',
    'ledger-read',
    'packet',
    'live-input',
    'generation',
  ])
    await t.test(phase, async (t) => {
      const context = await session(t);
      const { f, store, transport, dir, genesis } = context;
      const policy = structuredClone(rootPolicy);
      const s = new ConnectorReviewSession({ policy, transport, ledger: store });
      const packet = await parentPacket(s);
      const read = store.read.bind(store);
      const collect = transport.collect.bind(transport);
      const original = read().state;
      if (phase === 'collect')
        transport.collect = async () => {
          throw Error('collection unavailable');
        };
      if (phase === 'identity') f.permission = 'read';
      if (phase === 'policy') policy.reviewSubmissionAuthorizations[0].status = 'paused';
      if (phase === 'ledger-read') {
        let once = true;
        store.read = () => {
          if (once) {
            once = false;
            throw Error('read unavailable');
          }
          return read();
        };
      }
      if (phase === 'packet') packet.reconciliation.priorPacketDigest = 'f'.repeat(64);
      if (phase === 'live-input') f.pr.body = 'changed after parent analysis';
      if (phase === 'generation')
        store.apply(read().revision, {
          type: 'enqueue',
          deliveryId: 'generation-before-finish',
          pullRequest: 487,
          eventKind: 'synchronize',
          materialDigest: 'd'.repeat(64),
        });
      await assert.rejects(s.finishParentAnalysis(packet));
      const state = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.equal(state.slot, null);
      assert.equal(state.pending.length, 1);
      assert.deepEqual(state.analyses, original.analyses);
      assert.deepEqual(state.publishedAnalyses, original.publishedAnalyses);
      assert.deepEqual(state.publicationReceipts, original.publicationReceipts);
      assert.deepEqual(state.deferred, original.deferred);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      await assert.rejects(s.finishParentAnalysis(packet), /lifecycle already consumed/);
      transport.collect = collect;
      f.permission = 'admin';
      const next = freshSession(context);
      const request = await next.begin(487, {
        kind: 'synchronize',
        deliveryId: `finish-recover-${phase}`,
      });
      assert.equal(request.kind, 'proto-ui.parent-review-request');
      assert.equal(
        (await next.finishParentAnalysis(completePacket(request.input))).status,
        'applied'
      );
      assert.equal(read().state.pending.length, 0);
    });
});

test('real stale-lease finish and abandon conflicts release only the original owner and preserve queued work', async (t) => {
  for (const terminal of ['finish', 'abandon'])
    for (const pullRequest of [487, 488])
      await t.test(`${terminal}: PR ${pullRequest} wins`, async (t) => {
        const { f, transport, dir, genesis } = await session(t);
        const git = (directory, ...args) =>
          execFileSync('git', ['-C', directory, ...args], {
            encoding: 'utf8',
            stdio: 'pipe',
          }).trim();
        git(dir, 'update-ref', REMOTE_LEDGER_REF, genesis);
        let peer;
        let races = 0;
        let finishes = 0;
        let releases = 0;
        let rejectedRevision;
        function open(racing) {
          const cache = mkdtempSync(path.join(tmpdir(), 'pui-terminal-race-'));
          t.after(() => rmSync(cache, { recursive: true, force: true }));
          git(cache, 'init', '--bare');
          return new RemoteCloudReviewLedger(cache, genesis, {
            checkpoint: genesis,
            transport: {
              readInto(directory) {
                git(
                  directory,
                  'fetch',
                  '--no-tags',
                  '--no-write-fetch-head',
                  dir,
                  REMOTE_LEDGER_REF
                );
                return git(dir, 'rev-parse', REMOTE_LEDGER_REF);
              },
              publish(args) {
                const entry = JSON.parse(
                  git(args.directory, 'show', args.revision + ':entry.json')
                );
                if (racing && ['finishAnalysis', 'abandon'].includes(entry.type)) {
                  if (entry.type === 'finishAnalysis') finishes++;
                  else releases++;
                  if (races < 2) {
                    races++;
                    if (races === 1) rejectedRevision = args.revision;
                    assert.equal(
                      peer.apply(peer.read().revision, {
                        type: 'enqueue',
                        pullRequest: races === 1 ? pullRequest : 489,
                        deliveryId: `terminal-race-${races}`,
                        eventKind: 'synchronize',
                        materialDigest: String(races).repeat(64),
                      }).status,
                      'applied'
                    );
                  }
                }
                return ownerGitLedgerTransport({
                  runGit(directory, command) {
                    return git(
                      directory,
                      ...command.map((arg) =>
                        arg === 'https://github.com/Proto-UI/Proto-UI.git' ? dir : arg
                      )
                    );
                  },
                }).publish(args);
              },
            },
          });
        }
        peer = open(false);
        const store = open(true);
        const s = new ConnectorReviewSession({ transport, ledger: store, policy: rootPolicy });
        const packet = await parentPacket(s);
        if (terminal === 'finish')
          await assert.rejects(s.finishParentAnalysis(packet), /analysis acknowledgement/);
        else assert.equal((await s.abandonBeforeIntent()).status, 'applied');
        const fresh = open(false);
        const state = fresh.read().state;
        assert.equal(state.slot, null);
        assert.deepEqual(
          state.pending.map((item) => item.pullRequest),
          pullRequest === 487 ? [487, 489] : [487, 488, 489]
        );
        assert.deepEqual(state.analyses, []);
        assert.deepEqual(state.publishedAnalyses, []);
        assert.deepEqual(state.publicationReceipts, []);
        assert.deepEqual(state.deferred, []);
        assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
        assert.equal(races, 2);
        assert.equal(finishes, terminal === 'finish' ? 1 : 0);
        assert.equal(releases, terminal === 'finish' ? 2 : 3);
        assert.equal(
          git(dir, 'rev-list', REMOTE_LEDGER_REF).split('\n').includes(rejectedRevision),
          false
        );
        await assert.rejects(s.abandonBeforeIntent(), /cannot abandon/);
        const next = new ConnectorReviewSession({ transport, ledger: fresh, policy: rootPolicy });
        const request = await next.begin(487, {
          kind: 'synchronize',
          deliveryId: 'after-terminal-race',
        });
        assert.equal(request.kind, 'proto-ui.parent-review-request');
        assert.equal(
          (await next.finishParentAnalysis(completePacket(request.input))).status,
          'applied'
        );
        assert.equal(
          fresh.read().state.pending.some((item) => item.pullRequest === 489),
          true
        );
      });
});

test('consumed sessions can still explicitly release after proven unwritten cleanup failures', async (t) => {
  for (const terminal of ['finish', 'publish', 'abandon'])
    for (const failure of ['read', 'contention'])
      await t.test(`${terminal}: ${failure}`, async (t) => {
        const { f, s, store, transport } = await session(t);
        const packet = await parentPacket(s);
        const read = store.read.bind(store);
        const apply = store.apply.bind(store);
        let blocked = true;
        let releases = 0;
        transport.collect = async () => {
          throw Error('collection unavailable');
        };
        store.read = () => {
          if (blocked && failure === 'read') throw Error('cleanup read unavailable');
          return read();
        };
        store.apply = (revision, command) => {
          if (command.type === 'abandon') {
            releases++;
            if (blocked && failure === 'contention')
              apply(revision, {
                type: 'enqueue',
                deliveryId: `terminal-cleanup-race-${releases}`,
                pullRequest: 488,
                eventKind: 'human-comment',
                materialDigest: String(releases).repeat(64),
              });
          }
          return apply(revision, command);
        };
        await assert.rejects(
          terminal === 'finish'
            ? s.finishParentAnalysis(packet)
            : terminal === 'publish'
              ? s.publishParentPacket(packet, createConnectorAssessment())
              : s.abandonBeforeIntent(),
          /read unavailable|contention budget/
        );
        assert.notEqual(read().state.slot, null);
        assert.equal(releases, failure === 'contention' ? 3 : 0);
        blocked = false;
        // #used prevents another finish/publication, not original-owner cleanup.
        const released = await s.abandonBeforeIntent();
        assert.equal(released.status, 'applied');
        assert.equal(released.revision, read().revision);
        assert.equal(read().state.slot, null);
        assert.equal(
          read().state.pending.some((item) => item.pullRequest === 487),
          true
        );
        assert.equal(
          read().state.pending.some((item) => item.pullRequest === 488),
          failure === 'contention'
        );
        assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      });
});

test('unknown or thrown finish writes never trigger release or an analysis retry', async (t) => {
  for (const mode of [
    'unknown-without-write',
    'throw-without-write',
    'lost-finish-ack',
    'throw-after-write',
  ])
    await t.test(mode, async (t) => {
      const { f, s, store } = await session(t);
      const packet = await parentPacket(s);
      const apply = store.apply.bind(store);
      let finishes = 0;
      let releases = 0;
      store.apply = (revision, command) => {
        if (command.type === 'abandon') releases++;
        if (command.type !== 'finishAnalysis') return apply(revision, command);
        finishes++;
        if (mode === 'throw-without-write') throw Error('finish result unavailable');
        if (mode === 'unknown-without-write') return { status: 'unknown' };
        apply(revision, command);
        if (mode === 'throw-after-write') throw Error('finish result unavailable after write');
        return { status: 'unknown' };
      };
      await assert.rejects(
        s.finishParentAnalysis(packet),
        /analysis acknowledgement|finish result unavailable/
      );
      await assert.rejects(s.finishParentAnalysis(packet), /lifecycle already consumed/);
      assert.equal(finishes, 1);
      assert.equal(releases, 0);
      const written = ['lost-finish-ack', 'throw-after-write'].includes(mode);
      assert.equal(store.read().state.slot === null, written);
      assert.equal(store.read().state.analyses.length, written ? 1 : 0);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('uncertain terminal Git acknowledgements stop the adapter and cannot be explicitly abandoned', async (t) => {
  for (const terminal of ['finish', 'abandon'])
    for (const written of [false, true])
      await t.test(
        `${terminal}: ${written ? 'lost applied acknowledgement' : 'unwritten unknown'}`,
        async (t) => {
          const { f, transport, dir, genesis } = await session(t);
          let armed = false;
          let updates = 0;
          const store = new LocalCloudReviewLedger(dir, genesis, {
            runner(command, args, options) {
              if (armed && args.includes('update-ref')) {
                updates++;
                if (written) execFileSync(command, args, options);
                throw Error('terminal Git acknowledgement unavailable');
              }
              return execFileSync(command, args, options);
            },
          });
          const s = new ConnectorReviewSession({ policy: rootPolicy, transport, ledger: store });
          const packet = await parentPacket(s);
          armed = true;
          await assert.rejects(
            terminal === 'finish' ? s.finishParentAnalysis(packet) : s.abandonBeforeIntent(),
            /acknowledgement|release uncertain/
          );
          const before = store.read();
          assert.equal(updates, 1);
          assert.equal(before.state.slot === null, written);
          assert.equal(before.state.analyses.length, terminal === 'finish' && written ? 1 : 0);
          await assert.rejects(
            s.abandonBeforeIntent(),
            written ? /cannot abandon/ : /uncertain update/
          );
          assert.deepEqual(store.read(), before);
          assert.equal(updates, 1);
          const restarted = new LocalCloudReviewLedger(dir, genesis);
          if (!written)
            assert.throws(
              () => restarted.apply(restarted.read().revision, { type: 'abandon' }),
              /does not own/
            );
          assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
        }
      );
});

test('finish cleanup and explicit abandon reject changed ownership or a newly persisted intent', async (t) => {
  for (const terminal of ['finish', 'abandon'])
    for (const drift of ['owner', 'intent'])
      await t.test(`${terminal}: ${drift}`, async (t) => {
        const { f, s, store, transport } = await session(t);
        const packet = await parentPacket(s);
        const read = store.read.bind(store);
        const apply = store.apply.bind(store);
        const before = read();
        let releases = 0;
        transport.collect = async () => {
          throw Error('collection unavailable');
        };
        store.read = () => {
          const snapshot = read();
          if (drift === 'owner') snapshot.state.slot.owner = 'e'.repeat(32);
          else snapshot.state.slot.intent = { id: 'f'.repeat(64) };
          return snapshot;
        };
        store.apply = (revision, command) => {
          if (command.type === 'abandon') releases++;
          return apply(revision, command);
        };
        await assert.rejects(
          terminal === 'finish' ? s.finishParentAnalysis(packet) : s.abandonBeforeIntent(),
          /original intent-free claim changed/
        );
        assert.equal(releases, 0);
        assert.deepEqual(read(), before);
        assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      });
});

test('finish conflict and abandonment preserve the separate durable analysis and publication baselines', async (t) => {
  for (const terminal of ['finish', 'abandon'])
    await t.test(terminal, async (t) => {
      const context = await session(t);
      const { f, s, store } = context;
      const a = completePacket(
        (await s.begin(487, { kind: 'opened', deliveryId: 'terminal-a' })).input,
        null,
        ['A1']
      );
      assert.equal(
        (await s.publishParentPacket(a, createConnectorAssessment())).status,
        'published'
      );
      f.pr.body = 'unpublished B';
      const second = freshSession(context);
      const b = completePacket(
        (await second.begin(487, { kind: 'human-comment', deliveryId: 'terminal-b' })).input,
        a,
        ['B1']
      );
      assert.equal((await second.finishParentAnalysis(b)).status, 'applied');
      f.pr.body = 'rejected C';
      const terminalStore = new LocalCloudReviewLedger(context.dir, context.genesis);
      const last = new ConnectorReviewSession({
        policy: rootPolicy,
        transport: context.transport,
        ledger: terminalStore,
      });
      const request = await last.begin(487, { kind: 'human-comment', deliveryId: 'terminal-c' });
      const c = completePacket(request.input, b, ['C1']);
      const baseline = store.read().state;
      const apply = terminalStore.apply.bind(terminalStore);
      let raced = false;
      terminalStore.apply = (revision, command) => {
        if (!raced && command.type === (terminal === 'finish' ? 'finishAnalysis' : 'abandon')) {
          raced = true;
          apply(revision, {
            type: 'enqueue',
            deliveryId: 'terminal-d',
            pullRequest: 487,
            eventKind: 'synchronize',
            materialDigest: 'd'.repeat(64),
          });
        }
        return apply(revision, command);
      };
      if (terminal === 'finish')
        await assert.rejects(last.finishParentAnalysis(c), /analysis acknowledgement/);
      else assert.equal((await last.abandonBeforeIntent()).status, 'applied');
      const state = store.read().state;
      assert.equal(state.slot, null);
      assert.deepEqual(state.analyses, baseline.analyses);
      assert.deepEqual(state.publishedAnalyses, baseline.publishedAnalyses);
      assert.deepEqual(state.publicationReceipts, baseline.publicationReceipts);
      assert.deepEqual(state.deferred, baseline.deferred);
      assert.deepEqual(state.analyses[0].packet, b);
      assert.deepEqual(state.publishedAnalyses[0].packet, a);
      assert.equal(state.pending[0].generation > baseline.slot.generation, true);
      assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
    });
});

test('a completed later event generation closes its superseded captured sweep member', async (t) => {
  for (const terminal of ['finish', 'publish'])
    await t.test(terminal, async (t) => {
      const context = await session(t);
      const { f, s, store, dir, genesis } = context;
      f.inventory = [
        { ...f.pr, id: 487, number: 487 },
        { ...f.pr, id: 488, number: 488 },
      ];
      await s.captureInitialSweep();
      const initial = await s.beginInitialSweep(487);
      const a = completePacket(initial.input);
      const sweepDelivery = structuredClone(store.read().state.deliveries[0]);
      const apply = store.apply.bind(store);
      let raced = false;
      store.apply = async (revision, command) => {
        if (!raced && command.type === 'finishAnalysis') {
          raced = true;
          f.pr.body = 'new event material B';
          assert.equal(
            (
              await freshSession(context).begin(487, {
                kind: 'human-comment',
                deliveryId: 'superseding-event-B',
              })
            ).queued,
            true
          );
        }
        return apply(revision, command);
      };
      await assert.rejects(s.finishParentAnalysis(a), /analysis acknowledgement/);
      assert.equal(store.read().state.slot, null);
      assert.deepEqual(store.read().state.initialSweep.completed, []);
      const next = freshSession(context);
      const request = await next.begin(487, {
        kind: 'human-comment',
        deliveryId: 'superseding-event-B',
      });
      const b = completePacket(request.input);
      assert.deepEqual(store.read().state.initialSweep.completed, []);
      const completed =
        terminal === 'finish'
          ? await next.finishParentAnalysis(b)
          : await next.publishParentPacket(b, createConnectorAssessment());
      assert.equal(completed.status, terminal === 'finish' ? 'applied' : 'published');
      const state = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.deepEqual(state.initialSweep.completed, [487]);
      assert.equal(state.slot, null);
      assert.deepEqual(state.pending, []);
      assert.deepEqual(state.deliveries[0], sweepDelivery);
      assert.equal(state.analyses[0].observation.executionModeSource, 'delegated-owner-event');
      assert.deepEqual(state.analyses[0].packet, b);
      assert.equal(state.analyses[0].sweepCoverageVersion, 1);
      const beforeSkip = store.read();
      assert.equal(
        (await freshSession(context).beginInitialSweep(487)).reason,
        'initial sweep item already completed'
      );
      assert.deepEqual(store.read(), beforeSkip);
      assert.throws(
        () => apply(store.read().revision, { ...sweepDelivery, materialDigest: 'f'.repeat(64) }),
        /delivery id reused with different evidence/
      );
      assert.equal(
        f.calls.filter((call) => call.operation === 'add_review_to_pr').length,
        terminal === 'publish' ? 1 : 0
      );
    });
});

test('older fenced analysis cannot complete a later deferred sweep generation, including ABA', async (t) => {
  for (const sequence of ['A-to-C', 'A-to-C-to-A', 'A-to-C-to-C', 'A-to-C-to-D'])
    await t.test(sequence, async (t) => {
      const context = await session(t);
      const { f, s, store, transport, dir, genesis } = context;
      await s.captureInitialSweep();
      const a = await parentPacket(s);
      const originalBody = f.pr.body;
      const submit = transport.submit.bind(transport);
      let sweepDelivery;
      transport.submit = async (...args) => {
        f.pr.body = 'material C after dispatch';
        if (sequence === 'A-to-C-to-A' || sequence === 'A-to-C-to-C')
          assert.equal(
            (
              await freshSession(context).begin(487, {
                kind: 'human-comment',
                deliveryId: 'deferred-event-C',
              })
            ).queued,
            true
          );
        if (sequence === 'A-to-C-to-A') f.pr.body = originalBody;
        assert.equal((await freshSession(context).beginInitialSweep(487)).queued, true);
        sweepDelivery = structuredClone(
          store.read().state.deliveries.find((delivery) => delivery.eventKind === 'initial-sweep')
        );
        if (sequence === 'A-to-C-to-D') {
          f.pr.body = 'newer material D after sweep';
          assert.equal(
            (
              await freshSession(context).begin(487, {
                kind: 'human-comment',
                deliveryId: 'deferred-event-D',
              })
            ).queued,
            true
          );
        }
        assert.deepEqual(store.read().state.initialSweep.completed, []);
        return submit(...args);
      };
      assert.equal(
        (await s.publishParentPacket(a, createConnectorAssessment())).status,
        'published'
      );
      const afterOld = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.equal(afterOld.slot, null);
      assert.equal(afterOld.pending.length, 1);
      assert.deepEqual(afterOld.initialSweep.completed, []);
      assert.deepEqual(
        afterOld.deliveries.find((delivery) => delivery.eventKind === 'initial-sweep'),
        sweepDelivery
      );
      const next = freshSession(context);
      const request = await next.begin(487, {
        kind: 'human-comment',
        deliveryId: 'complete-deferred-material',
      });
      assert.deepEqual(store.read().state.initialSweep.completed, []);
      assert.equal(
        (await next.finishParentAnalysis(completePacket(request.input, a))).status,
        'applied'
      );
      const state = new LocalCloudReviewLedger(dir, genesis).read().state;
      assert.deepEqual(state.initialSweep.completed, [487]);
      assert.deepEqual(state.pending, []);
      assert.deepEqual(
        state.deliveries.find((delivery) => delivery.eventKind === 'initial-sweep'),
        sweepDelivery
      );
      assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
    });
});

test('superseding sweep work stays incomplete while in flight, abandoned, cancelled or unknown', async (t) => {
  for (const terminal of ['inflight', 'abandon', 'cancelled', 'unknown'])
    await t.test(terminal, async (t) => {
      const context = await session(t);
      const { f, s, store, transport } = context;
      await s.captureInitialSweep();
      const initial = await s.beginInitialSweep(487);
      const sweepDelivery = structuredClone(store.read().state.deliveries[0]);
      f.pr.body = 'superseding event B';
      assert.equal(
        (
          await freshSession(context).begin(487, {
            kind: 'human-comment',
            deliveryId: 'unfinished-B',
          })
        ).queued,
        true
      );
      await assert.rejects(s.finishParentAnalysis(completePacket(initial.input)));
      assert.equal(store.read().state.slot, null);
      const next = freshSession(context);
      const request = await next.begin(487, { kind: 'human-comment', deliveryId: 'unfinished-B' });
      const b = completePacket(request.input);
      if (terminal === 'abandon')
        assert.equal((await next.abandonBeforeIntent()).status, 'applied');
      if (terminal === 'cancelled') {
        const collect = transport.collect.bind(transport);
        let collections = 0;
        transport.collect = async (...args) => {
          if (++collections === 2) f.pr.body = 'changed before dispatch';
          return collect(...args);
        };
        assert.equal(
          (await next.publishParentPacket(b, createConnectorAssessment())).status,
          'cancelled'
        );
      }
      if (terminal === 'unknown') {
        f.writeBehavior = 'lost';
        assert.equal(
          (await next.publishParentPacket(b, createConnectorAssessment())).status,
          'unknown'
        );
      }
      const state = store.read().state;
      assert.deepEqual(state.initialSweep.completed, []);
      assert.equal(
        state.pending.some((item) => item.pullRequest === 487),
        true
      );
      assert.deepEqual(state.analyses, []);
      assert.deepEqual(state.publicationReceipts, []);
      assert.deepEqual(state.deliveries[0], sweepDelivery);
      if (terminal === 'unknown') assert.equal(state.slot.intent.status, 'unknown');
      assert.equal(
        f.calls.filter((call) => call.operation === 'add_review_to_pr').length,
        terminal === 'unknown' ? 1 : 0
      );
    });
});

test('an event completed before sweep capture covers identical material without changing journal commands', async (t) => {
  const context = await session(t);
  const { s, store, dir, genesis } = context;
  await s.finishParentAnalysis(await parentPacket(s));
  const before = store.read();
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  const revisions = git('rev-list', '--reverse', before.revision).split('\n');
  const entries = revisions.map((revision) => git('show', `${revision}:entry.json`));
  const sweep = freshSession(context);
  await sweep.captureInitialSweep();
  assert.equal((await sweep.beginInitialSweep(487)).reason, 'unchanged material');
  const state = new LocalCloudReviewLedger(dir, genesis).read().state;
  assert.deepEqual(state.initialSweep.completed, [487]);
  assert.deepEqual(state.analyses, before.state.analyses);
  assert.equal(state.analyses[0].observation.executionModeSource, 'delegated-owner-event');
  assert.equal(state.analyses[0].materialDeliveryId, 'event-1');
  assert.equal(state.analyses[0].materialGeneration, 1);
  assert.deepEqual(
    revisions.map((revision) => git('show', `${revision}:entry.json`)),
    entries
  );
  assert(
    entries.every(
      (entry) => !entry.includes('materialDeliveryId') && !entry.includes('materialGeneration')
    )
  );
  assert.equal(
    (await freshSession(context).beginInitialSweep(487)).reason,
    'initial sweep item already completed'
  );
});

test('fenced completion covers unchanged sweep material but never an uncaptured delivery', async (t) => {
  for (const sweepDelivery of [false, true])
    await t.test(sweepDelivery ? 'same fenced material' : 'no sweep delivery', async (t) => {
      const context = await session(t);
      const { s, store, transport } = context;
      await s.captureInitialSweep();
      const packet = await parentPacket(s);
      const submit = transport.submit.bind(transport);
      transport.submit = async (...args) => {
        if (sweepDelivery)
          assert.equal((await freshSession(context).beginInitialSweep(487)).queued, true);
        assert.deepEqual(store.read().state.deferred, []);
        assert.deepEqual(store.read().state.initialSweep.completed, []);
        return submit(...args);
      };
      assert.equal(
        (await s.publishParentPacket(packet, createConnectorAssessment())).status,
        'published'
      );
      assert.deepEqual(store.read().state.initialSweep.completed, sweepDelivery ? [487] : []);
      assert.deepEqual(store.read().state.pending, []);
    });
});

test('historical sweep ABA journals replay unchanged while marked later completion forbids reopening', async (t) => {
  for (const marked of [false, true])
    await t.test(marked ? 'version one' : 'field-less historical commands', (t) => {
      const { store, dir, genesis } = ledger(t);
      const apply = (ledger, command) => {
        const result = ledger.apply(ledger.read().revision, command);
        assert.equal(result.status, 'applied');
        return result;
      };
      const material = (deliveryId, digest, eventKind = 'human-comment') => ({
        type: 'enqueue',
        deliveryId,
        pullRequest: 487,
        eventKind,
        materialDigest: digest.repeat(64),
      });
      const sweep = material(`${INITIAL_SWEEP_ID}:487`, 'a', 'initial-sweep');
      apply(store, { type: 'captureInitialSweep', sweepId: INITIAL_SWEEP_ID, pullRequests: [487] });
      apply(store, sweep);
      apply(store, { type: 'claim', pullRequest: 487 });
      apply(store, { type: 'abandon' });
      const eventB = new LocalCloudReviewLedger(dir, genesis);
      apply(eventB, material('historical-event-B', 'b'));
      apply(eventB, { type: 'claim', pullRequest: 487 });
      const b = analysis({ pullRequestBody: 'B' });
      apply(eventB, {
        type: 'finishAnalysis',
        ...b,
        ...(marked ? { sweepCoverageVersion: 1 } : {}),
      });
      assert.deepEqual(eventB.read().state.initialSweep.completed, marked ? [487] : []);
      const later = new LocalCloudReviewLedger(dir, genesis);
      apply(later, material('historical-event-A-recurs', 'a'));
      assert.equal(apply(later, sweep).noOp, true);
      apply(later, { type: 'claim', pullRequest: 487 });
      const a = analysis({ pullRequestBody: 'A' });
      a.observation.executionModeSource = 'delegated-owner-initial-sweep';
      a.packet.reconciliation.priorPacketDigest = computeReviewPacketDigest(b.packet);
      a.packet.reconciliation.priorReviewedHeadSha = b.packet.headSha;
      if (marked)
        assert.throws(
          () => apply(later, { type: 'finishAnalysis', ...a }),
          /initial sweep inventory is absent or completed/
        );
      else apply(later, { type: 'finishAnalysis', ...a });
      const before = later.read();
      const git = (...args) =>
        execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
      const revisions = git('rev-list', '--reverse', before.revision).split('\n');
      const entries = revisions.map((revision) => git('show', `${revision}:entry.json`));
      const reopened = new LocalCloudReviewLedger(dir, genesis, {
        checkpoint: before.revision,
      }).read();
      assert.deepEqual(reopened, before);
      assert.deepEqual(reopened.state.initialSweep.completed, [487]);
      assert.deepEqual(
        revisions.map((revision) => git('show', `${revision}:entry.json`)),
        entries
      );
      assert.equal(
        entries.some((entry) => Object.hasOwn(JSON.parse(entry), 'sweepCoverageVersion')),
        marked
      );
    });
});

test('probe own-review arriving before receipt leaves no undrainable pending', async (t) => {
  const { f, s, store, transport, dir, genesis } = await session(t);
  const packet = await parentPacket(s);
  const submit = transport.submit.bind(transport);
  let wake;
  transport.submit = async (...args) => {
    const receipt = await submit(...args);
    const lateStore = new LocalCloudReviewLedger(dir, genesis);
    const late = new ConnectorReviewSession({ transport, ledger: lateStore, policy: rootPolicy });
    wake = await late.begin(487, {
      kind: 'human-review',
      deliveryId: 'probe-own-before-finalize',
      reviewId: receipt.id,
    });
    assert.equal(lateStore.read().state.deferred.length, 1);
    return receipt;
  };
  const published = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(published.status, 'published');
  assert.equal(wake.queued, true);
  const before = store.read();
  const freshStore = new LocalCloudReviewLedger(dir, genesis);
  const fresh = new ConnectorReviewSession({ transport, ledger: freshStore, policy: rootPolicy });
  const replay = await fresh.begin(487, {
    kind: 'human-review',
    deliveryId: 'probe-own-before-finalize',
    reviewId: '99',
  });
  const after = store.read();
  assert.equal(published.followUpQueued, false);
  assert.equal(published.followUpRequired, false);
  assert.equal(replay.skipped, true);
  assert.equal(before.revision, after.revision);
  assert.deepEqual(after.state.pending, []);
});

// Exact production journal transport, with only its URL replaced by a local bare
// Git fixture. Connector read/write responses remain deterministic test data.
async function ownWakeContext(t, remote = false) {
  const context = await session(t);
  if (!remote) {
    context.openLedger = () => new LocalCloudReviewLedger(context.dir, context.genesis);
    return context;
  }
  const git = (directory, ...args) =>
    execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  git(context.dir, 'update-ref', REMOTE_LEDGER_REF, context.genesis);
  context.openLedger = () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'pui-own-wake-cache-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    git(directory, 'init', '--bare');
    return new RemoteCloudReviewLedger(directory, context.genesis, {
      checkpoint: context.genesis,
      transport: {
        readInto(cache) {
          git(cache, 'fetch', '--no-tags', '--no-write-fetch-head', context.dir, REMOTE_LEDGER_REF);
          return git(context.dir, 'rev-parse', REMOTE_LEDGER_REF);
        },
        publish(args) {
          return ownerGitLedgerTransport({
            runGit(cache, argv) {
              return git(
                cache,
                ...argv.map((arg) =>
                  arg === 'https://github.com/Proto-UI/Proto-UI.git' ? context.dir : arg
                )
              );
            },
          }).publish(args);
        },
      },
    });
  };
  context.store = context.openLedger();
  context.s = ownWakeSession(context, context.store);
  return context;
}
function ownWakeSession(context, store = context.openLedger()) {
  return new ConnectorReviewSession({
    transport: context.transport,
    ledger: store,
    policy: rootPolicy,
  });
}
const ownWakeEvent = (deliveryId = 'own-before-receipt', reviewId = '99') => ({
  kind: 'human-review',
  deliveryId,
  reviewId,
});
function addOtherReview(f) {
  f.reviews.push({
    id: 700,
    node_id: 'PRR_700',
    user: author,
    commit_id: f.pr.head.sha,
    state: 'COMMENTED',
    body: 'Independent human observation',
    submitted_at: '2026-10-03T00:05:00Z',
  });
}
const ownWakeChanges = {
  body: (f) => {
    f.pr.body = 'Concurrent body change';
  },
  head: (f) => {
    f.pr.head.sha = sha('c');
    f.commits[0].sha = sha('c');
    for (const check of f.checks) check.head_sha = sha('c');
    for (const run of f.runs) run.head_sha = sha('c');
  },
  base: (f) => {
    f.pr.base.sha = sha('c');
  },
  'base-ref': (f) => {
    f.pr.base.ref = 'release';
  },
  'human-review': addOtherReview,
  'human-comment': (f) => {
    f.comments.push({
      id: 7,
      node_id: 'C7',
      user: author,
      body: 'Human comment',
      updated_at: '2026-10-03T00:04:00Z',
    });
  },
};

test('own receipt normalization handles both event orders and fresh journal replay', async (t) => {
  for (const remote of [false, true])
    for (const ordering of ['before-receipt', 'after-receipt'])
      await t.test(`${remote ? 'production-local-Git' : 'local'}/${ordering}`, async (t) => {
        const context = await ownWakeContext(t, remote);
        const { s, store, transport, f } = context;
        const packet = await parentPacket(s);
        const initial = store.read().state.material[0];
        const submit = transport.submit.bind(transport);
        if (ordering === 'before-receipt')
          transport.submit = async (...args) => {
            const receipt = await submit(...args);
            assert.equal((await ownWakeSession(context).begin(487, ownWakeEvent())).queued, true);
            const during = store.read().state;
            assert.equal(during.deferred.length, 1);
            assert.equal(during.publicationReceipts.length, 0);
            assert.equal(during.slot.generation, initial.generation);
            assert.equal(during.material[0].digest, initial.digest);
            return receipt;
          };
        const published = await s.publishParentPacket(packet, createConnectorAssessment());
        assert.equal(published.status, 'published');
        assert.equal(published.followUpQueued, false);
        assert.equal(published.followUpRequired, false);
        const before = store.read();
        const restart = context.openLedger();
        assert.deepEqual(restart.read().state, before.state);
        const replay = await ownWakeSession(context, restart).begin(487, ownWakeEvent());
        assert.equal(replay.skipped, true);
        assert.equal(store.read().revision, before.revision);
        assert.deepEqual(before.state.pending, []);
        assert.deepEqual(before.state.deferred, []);
        assert.equal(before.state.generation, initial.generation);
        assert.deepEqual(before.state.analyses[0].input.reviews, []);
        assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
        if (ordering === 'before-receipt') {
          const delivery = before.state.deliveries.at(-1);
          assert.equal(delivery.reviewMaterial.input.reviews.length, 1);
          assert.notEqual(delivery.materialDigest, initial.digest);
          assert.equal(
            cloudReviewMaterialDigest(
              delivery.reviewMaterial,
              cloudReviewMaterialReceipts(before.state)
            ),
            initial.digest
          );
        }
      });
});

test('own review hints retain concurrent non-own material before and after receipt', async (t) => {
  for (const remote of [false, true])
    for (const ordering of ['before-receipt', 'after-receipt'])
      for (const [change, mutate] of Object.entries(ownWakeChanges))
        await t.test(
          `${remote ? 'production-local-Git' : 'local'}/${ordering}/${change}`,
          async (t) => {
            const context = await ownWakeContext(t, remote);
            const { s, store, transport, f } = context;
            const packet = await parentPacket(s);
            const submit = transport.submit.bind(transport);
            if (ordering === 'before-receipt')
              transport.submit = async (...args) => {
                const receipt = await submit(...args);
                mutate(f);
                assert.equal(
                  (await ownWakeSession(context).begin(487, ownWakeEvent())).queued,
                  true
                );
                return receipt;
              };
            const published = await s.publishParentPacket(packet, createConnectorAssessment());
            assert.equal(published.status, 'published');
            if (ordering === 'after-receipt') mutate(f);
            else {
              assert.equal(published.followUpQueued, true);
              assert.equal(published.followUpRequired, true);
            }
            const next = ownWakeSession(context);
            const request = await next.begin(487, ownWakeEvent());
            assert.equal(request.kind, 'proto-ui.parent-review-request');
            assert(
              request.input.reviews.some((review) => review.id === 'PRR_99'),
              'canonical reviewer input must retain the published review'
            );
            assert(store.read().state.slot.generation > 1);
            await next.finishParentAnalysis(completePacket(request.input, packet));
            assert.deepEqual(context.openLedger().read().state.pending, []);
            assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
          }
        );
});

test('deferred own event preserves non-own ABA and sweep causal generations', async (t) => {
  for (const remote of [false, true])
    for (const sweepAfterChange of [false, true])
      await t.test(
        `${remote ? 'production-local-Git' : 'local'}/sweep-after-C=${sweepAfterChange}`,
        async (t) => {
          const context = await ownWakeContext(t, remote);
          const { s, store, transport, f } = context;
          await s.captureInitialSweep();
          const packet = await parentPacket(s);
          if (!sweepAfterChange) await ownWakeSession(context).beginInitialSweep(487);
          const submit = transport.submit.bind(transport);
          transport.submit = async (...args) => {
            const receipt = await submit(...args);
            await ownWakeSession(context).begin(487, ownWakeEvent());
            f.pr.body = 'C';
            await ownWakeSession(context).begin(487, {
              kind: 'human-comment',
              deliveryId: 'non-own-C',
            });
            f.pr.body = 'fixture';
            if (sweepAfterChange) await ownWakeSession(context).beginInitialSweep(487);
            else
              await ownWakeSession(context).begin(487, {
                kind: 'human-comment',
                deliveryId: 'non-own-A',
              });
            assert.equal(store.read().state.deferred.length, 3);
            return receipt;
          };
          assert.equal(
            (await s.publishParentPacket(packet, createConnectorAssessment())).followUpQueued,
            true
          );
          const after = context.openLedger().read().state;
          assert.equal(after.generation, 3);
          assert.equal(after.pending[0].generation, 3);
          assert.deepEqual(after.initialSweep.completed, sweepAfterChange ? [] : [487]);
          const next = ownWakeSession(context);
          const request = await next.begin(487, ownWakeEvent());
          assert.equal(request.kind, 'proto-ui.parent-review-request');
          await next.finishParentAnalysis(completePacket(request.input, packet));
          assert.deepEqual(context.openLedger().read().state.initialSweep.completed, [487]);
          assert.deepEqual(context.openLedger().read().state.pending, []);
        }
      );
});

test('unconfirmed own-looking reviews remain deferred and unknown owners cannot be adopted', async (t) => {
  for (const remote of [false, true])
    await t.test(remote ? 'production-local-Git' : 'local', async (t) => {
      const context = await ownWakeContext(t, remote);
      const { s, store, transport, f } = context;
      const packet = await parentPacket(s);
      const submit = transport.submit.bind(transport);
      transport.submit = async (...args) => {
        await submit(...args);
        await ownWakeSession(context).begin(487, ownWakeEvent());
        throw new Error('receipt acknowledgement unavailable');
      };
      assert.equal(
        (await s.publishParentPacket(packet, createConnectorAssessment())).status,
        'unknown'
      );
      const before = store.read();
      const restarted = context.openLedger();
      assert.equal(
        (await ownWakeSession(context, restarted).begin(487, ownWakeEvent())).queued,
        true
      );
      assert.equal(store.read().revision, before.revision);
      assert.equal(before.state.deferred.length, 1);
      assert.equal(before.state.publicationReceipts.length, 0);
      assert.equal(before.state.slot.intent.status, 'unknown');
      assert.throws(
        () => restarted.consumePublicationAttempt(before.state.slot.intent.id),
        /fresh, stopped or restarted/
      );
      assert.throws(
        () =>
          restarted.apply(restarted.read().revision, {
            type: 'finalizePublication',
            response: {},
            readback: {},
          }),
        /does not own/
      );
      assert.throws(
        () => store.consumePublicationAttempt(before.state.slot.intent.id),
        /deferred|already consumed/
      );
      assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
    });
});

test('an own review ID never discards a live object with a mismatched receipt binding', async (t) => {
  const changes = {
    id: (review) => {
      review.id = 100;
    },
    node: (review) => {
      review.node_id = 'PRR_100';
    },
    'actor-id': (review) => {
      review.user = { ...owner, id: 123 };
    },
    'actor-login': (review) => {
      review.user = { ...owner, login: 'other-human' };
    },
    'unknown-actor': (review) => {
      review.user = null;
    },
    head: (review) => {
      review.commit_id = sha('c');
    },
    state: (review) => {
      review.state = 'DISMISSED';
    },
    body: (review) => {
      review.body += ' edited';
    },
  };
  for (const [name, mutate] of Object.entries(changes))
    await t.test(name, async (t) => {
      const context = await ownWakeContext(t);
      const { s, store, transport, f } = context;
      const packet = await parentPacket(s);
      const submit = transport.submit.bind(transport);
      transport.submit = async (...args) => {
        const receipt = await submit(...args);
        mutate(f.reviews[0]);
        assert.equal((await ownWakeSession(context).begin(487, ownWakeEvent())).queued, true);
        return receipt;
      };
      const published = await s.publishParentPacket(packet, createConnectorAssessment());
      assert.equal(published.status, 'published');
      assert.equal(published.followUpQueued, true);
      assert.equal(store.read().state.pending[0].generation, 2);
      const next = ownWakeSession(context);
      const request = await next.begin(487, ownWakeEvent());
      assert.equal(request.kind, 'proto-ui.parent-review-request');
      assert.equal(request.input.reviews.length, 1);
      assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
    });
});

test('same own delivery cannot rewrite evidence, while a distinct eligible event drains real changes', async (t) => {
  const context = await ownWakeContext(t);
  const { s, store, transport, f } = context;
  const packet = await parentPacket(s);
  const submit = transport.submit.bind(transport);
  transport.submit = async (...args) => {
    const receipt = await submit(...args);
    await ownWakeSession(context).begin(487, ownWakeEvent());
    return receipt;
  };
  await s.publishParentPacket(packet, createConnectorAssessment());
  const prefix = store.read();
  const original = structuredClone(prefix.state.deliveries.at(-1));
  f.pr.body = 'Real material after receipt';
  await assert.rejects(
    ownWakeSession(context).begin(487, ownWakeEvent()),
    /delivery id reused with different evidence/
  );
  assert.equal(store.read().revision, prefix.revision);
  const next = ownWakeSession(context);
  const request = await next.begin(487, {
    kind: 'human-comment',
    deliveryId: 'new-material-event',
  });
  assert.equal(request.kind, 'proto-ui.parent-review-request');
  await next.finishParentAnalysis(completePacket(request.input, packet));
  assert.deepEqual(store.read().state.pending, []);
  assert.deepEqual(
    store.read().state.deliveries.find((d) => d.deliveryId === original.deliveryId),
    original
  );
  // A later own-ID hint cannot bypass the earlier delivery's immutable evidence,
  // even when the latest material has already completed and would otherwise skip.
  const finished = store.read();
  await assert.rejects(
    ownWakeSession(context).begin(487, ownWakeEvent()),
    /delivery id reused with different evidence/
  );
  assert.equal(store.read().revision, finished.revision);
});

test('confirmed transport receipt without durable finalization cannot suppress the own wakeup', async (t) => {
  const context = await ownWakeContext(t);
  const { s, store, transport } = context;
  const packet = await parentPacket(s);
  const submit = transport.submit.bind(transport);
  transport.submit = async (...args) => {
    const receipt = await submit(...args);
    await ownWakeSession(context).begin(487, ownWakeEvent());
    return receipt;
  };
  const apply = store.apply.bind(store);
  store.apply = (revision, command) =>
    command.type === 'finalizePublication' ? { status: 'unknown' } : apply(revision, command);
  const published = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(published.status, 'unknown');
  assert.equal(published.publicationConfirmed, true);
  const before = store.read();
  assert.equal(before.state.publicationReceipts.length, 0);
  assert.equal(before.state.deferred.length, 1);
  assert.equal((await ownWakeSession(context).begin(487, ownWakeEvent())).queued, true);
  assert.equal(store.read().revision, before.revision);
});

test('field-less own-event history stays unchanged rather than being silently migrated', async (t) => {
  const { store, dir, genesis } = ledger(t);
  const apply = (command) => store.apply(store.read().revision, command);
  const first = {
    type: 'enqueue',
    deliveryId: 'legacy-before',
    pullRequest: 487,
    eventKind: 'synchronize',
    materialDigest: 'a'.repeat(64),
  };
  apply(first);
  apply({ type: 'claim', pullRequest: 487 });
  apply({ type: 'stagePublicationIntent', ...analysis() });
  const intent = store.read().state.slot.intent;
  store.consumePublicationAttempt(intent.id);
  const own = {
    ...first,
    deliveryId: 'legacy-own-before-receipt',
    eventKind: 'human-review',
    materialDigest: 'b'.repeat(64),
  };
  apply(own);
  const receipt = {
    repositoryId: intent.repositoryId,
    pullRequest: 487,
    id: '99',
    nodeId: 'PRR_99',
    authorId: intent.principalId,
    authorLogin: intent.principalLogin,
    commitId: intent.headSha,
    state: 'APPROVED',
    body: intent.body,
  };
  apply({ type: 'finalizePublication', response: receipt, readback: receipt });
  const before = store.read();
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  const revisions = git('rev-list', '--reverse', before.revision).split('\n');
  const entries = revisions.map((revision) => git('show', `${revision}:entry.json`));
  const reopened = new LocalCloudReviewLedger(dir, genesis, { checkpoint: before.revision });
  assert.deepEqual(reopened.read(), before);
  assert.equal(before.state.pending[0].generation, 2);
  assert.equal(before.state.material[0].digest, own.materialDigest);
  assert.deepEqual(cloudReviewMaterialReceipts(before.state), []);
  assert.equal(Object.hasOwn(before.state.publicationReceipts[0], 'review'), false);
  assert.equal(reopened.apply(before.revision, own).noOp, true);
  assert.deepEqual(reopened.read(), before);
  assert(entries.every((entry) => !Object.hasOwn(JSON.parse(entry), 'reviewMaterial')));
  assert.deepEqual(
    revisions.map((revision) => git('show', `${revision}:entry.json`)),
    entries
  );
});

test('versioned finalization requires exact node identity while old receipts retain their old semantics', async (t) => {
  for (const versioned of [false, true])
    for (const node of ['missing', 'mismatch'])
      await t.test(`${versioned ? 'versioned' : 'field-less'}/${node}`, async (t) => {
        const { store } = ledger(t);
        const input = analysis().input;
        const reviewMaterial = { version: 1, input, reviewIdentities: [] };
        const apply = (c) => store.apply(store.read().revision, c);
        apply({
          type: 'enqueue',
          pullRequest: 487,
          deliveryId: 'node-binding',
          eventKind: 'opened',
          materialDigest: versioned ? cloudReviewMaterialDigest(reviewMaterial) : 'a'.repeat(64),
          ...(versioned ? { reviewMaterial } : {}),
        });
        apply({ type: 'claim', pullRequest: 487 });
        apply({
          type: 'stagePublicationIntent',
          ...analysis(),
          ...(versioned ? { receiptNormalizationVersion: 1 } : {}),
        });
        const intent = store.read().state.slot.intent;
        store.consumePublicationAttempt(intent.id);
        const receipt = {
          repositoryId: intent.repositoryId,
          pullRequest: 487,
          id: '99',
          authorId: intent.principalId,
          authorLogin: intent.principalLogin,
          commitId: intent.headSha,
          state: 'APPROVED',
          body: intent.body,
          ...(node === 'mismatch' ? { nodeId: 'PRR_99' } : {}),
        };
        const before = store.read();
        const command = {
          type: 'finalizePublication',
          response: receipt,
          readback: { ...receipt, ...(node === 'mismatch' ? { nodeId: 'PRR_OTHER' } : {}) },
        };
        if (versioned) {
          assert.throws(() => apply(command), /versioned receipt node identity/);
          assert.deepEqual(store.read(), before);
        } else {
          assert.equal(apply(command).status, 'applied');
          assert.equal(store.read().state.slot, null);
        }
      });
});

test('new publication after coalescing a legacy pending material uses new receipt normalization', async (t) => {
  const context = await ownWakeContext(t);
  const { s, store, transport } = context;
  const live = await transport.collect(487);
  const raw = { version: 1, input: live.input, reviewIdentities: live.reviewIdentities };
  store.apply(store.read().revision, {
    type: 'enqueue',
    deliveryId: 'legacy-pending-before-upgrade',
    pullRequest: 487,
    eventKind: 'opened',
    materialDigest: cloudReviewMaterialDigest(raw),
  });
  const packet = await parentPacket(s);
  assert.equal(store.read().state.material[0].deliveryId, 'legacy-pending-before-upgrade');
  const submit = transport.submit.bind(transport);
  transport.submit = async (...args) => {
    const receipt = await submit(...args);
    await ownWakeSession(context).begin(487, ownWakeEvent());
    return receipt;
  };
  const published = await s.publishParentPacket(packet, createConnectorAssessment());
  assert.equal(published.status, 'published');
  assert.deepEqual(store.read().state.pending, []);
});

test('explicit POST node identity echoes bind raw readback before an own wakeup can be normalized', async (t) => {
  for (const field of ['node_id', 'nodeId'])
    for (const mode of ['matching', 'omitted', 'contradictory', 'null'])
      await t.test(`${field}/${mode}`, async (t) => {
        const context = await ownWakeContext(t);
        const { store, f } = context;
        context.transport = new ConnectorReviewTransport(async (operation, args) => {
          const response = await f.call(operation, args);
          if (operation !== 'add_review_to_pr') return response;
          // The API created the object; its event arrives before transport GET
          // readback/normalization. Neither the intent nor the hint proves it.
          assert.equal((await ownWakeSession(context).begin(487, ownWakeEvent())).queued, true);
          assert.equal(store.read().state.deferred.length, 1);
          return result({
            id: 99,
            ...(mode === 'omitted'
              ? {}
              : {
                  [field]: mode === 'matching' ? 'PRR_99' : mode === 'null' ? null : 'PRR_WRONG',
                }),
            state: 'APPROVED',
          });
        });
        const s = ownWakeSession(context, store);
        const packet = await parentPacket(s);
        const published = await s.publishParentPacket(packet, createConnectorAssessment());
        const before = store.read();
        if (mode === 'matching' || mode === 'omitted') {
          assert.equal(published.status, 'published');
          assert.equal(published.followUpQueued, false);
          assert.equal(before.state.publicationReceipts.length, 1);
          assert.deepEqual(before.state.pending, []);
          assert.deepEqual(before.state.deferred, []);
          assert.equal(before.state.slot, null);
          assert.equal((await ownWakeSession(context).begin(487, ownWakeEvent())).skipped, true);
        } else {
          assert.equal(published.status, 'unknown');
          assert.match(published.reason, /review response node-id contradiction/);
          assert.equal(published.publicationConfirmed, false);
          assert.equal(published.retryAllowed, false);
          assert.equal(before.state.publicationReceipts.length, 0);
          assert.equal(before.state.slot.intent.status, 'unknown');
          assert.equal(before.state.deferred.length, 1);
          assert.equal(before.state.pending[0].generation, 1);
          const restarted = context.openLedger();
          assert.equal(
            (await ownWakeSession(context, restarted).begin(487, ownWakeEvent())).queued,
            true
          );
          assert.throws(
            () => restarted.consumePublicationAttempt(before.state.slot.intent.id),
            /fresh, stopped or restarted/
          );
          assert.throws(
            () =>
              store.apply(store.read().revision, {
                type: 'cancelPublicationIntent',
                intentId: before.state.slot.intent.id,
              }),
            /already consumed/
          );
          await assert.rejects(
            s.publishParentPacket(packet, createConnectorAssessment()),
            /one publication attempt/
          );
        }
        assert.equal(store.read().revision, before.revision);
        assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 1);
      });
});

test('draft publication remains analysis-only before any intent or POST', async (t) => {
  for (const sweep of [false, true])
    for (const findings of [[], ['DRAFT1']])
      await t.test(
        (sweep ? 'sweep' : 'event') + '/' + (findings.length ? 'REQUEST_CHANGES' : 'APPROVE'),
        async (t) => {
          const context = await session(t, {
            modify: (f) => {
              f.pr.draft = true;
            },
          });
          const { s, f, store } = context;
          if (sweep) await s.captureInitialSweep();
          const request = sweep
            ? await s.beginInitialSweep(487)
            : await s.begin(487, { kind: 'opened', deliveryId: 'draft-publish' });
          const packet = completePacket(request.input, null, findings);
          await assert.rejects(
            s.publishParentPacket(packet, createConnectorAssessment()),
            /draft.*analysis-only/
          );
          assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
          assert.equal(store.read().state.slot, null);
          assert.equal(store.read().state.publicationReceipts.length, 0);
        }
      );
});

test('canonical duplicate publication completes durably without replacing prior analysis or POST', async (t) => {
  for (const ids of [[], ['DUP1']])
    await t.test(ids.length ? 'REQUEST_CHANGES' : 'APPROVE', async (t) => {
      const context = await session(t);
      const { s, f, store } = context;
      const initial = await s.begin(487, {
        kind: 'opened',
        deliveryId: 'before-external-publication',
      });
      const original = completePacket(initial.input, null, ids);
      await s.finishParentAnalysis(original);
      f.reviews.push({
        id: 199,
        node_id: 'PRR_199',
        user: owner,
        commit_id: original.headSha,
        state: ids.length ? 'CHANGES_REQUESTED' : 'APPROVED',
        body: renderReviewBody(original),
        submitted_at: '2026-10-03T00:03:00Z',
      });
      const next = freshSession(context);
      const request = await next.begin(487, {
        kind: 'human-review',
        deliveryId: 'external-governed-review',
      });
      assert.equal(request.kind, 'proto-ui.parent-review-request');
      const packet = {
        ...structuredClone(original),
        reviewInputDigest: computeReviewInputDigest(request.input),
        observedAt: '2026-10-03T00:04:00Z',
      };
      const done = await next.publishParentPacket(packet, createConnectorAssessment());
      assert.equal(done.status, 'duplicate');
      assert.equal(done.submitted, false);
      const state = store.read().state;
      assert.equal(state.slot, null);
      assert.deepEqual(state.pending, []);
      assert.equal(
        computeReviewPacketDigest(state.analyses[0].packet),
        computeReviewPacketDigest(original)
      );
      assert.equal(state.publicationReceipts.length, 0);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
      const later = freshSession(context);
      assert.equal(
        (await later.begin(487, { kind: 'human-review', deliveryId: 'same-disposition-again' }))
          .skipped,
        true
      );
    });
});

test('review instructions distinguish the governed CLI and exact owner-plugin writer', () => {
  const skill = readFileSync(
    new URL('../../../.agents/skills/pui-review/SKILL.md', import.meta.url),
    'utf8'
  );
  assert(skill.includes('pnpm agent:review -- submit-review'));
  assert(skill.includes('only supported review mutation path'));
  assert(skill.includes('re-collects the whole canonical review input live from GitHub with `gh`'));
  assert(skill.includes('governed tokenless owner-plugin writer'));
  assert(skill.includes('proto-ui-cloud-owner-review-v1'));
  assert(skill.includes('not an independent alternate writer'));
  assert(skill.includes('pending-runtime-identity'));
});

test('converted-to-draft preserves its own lifecycle and still permits only analysis', async (t) => {
  const context = await session(t);
  const { s, f, store } = context;
  const initial = await s.begin(487, { kind: 'opened', deliveryId: 'open-before-draft' });
  const original = completePacket(initial.input);
  await s.finishParentAnalysis(original);
  f.pr.draft = true;
  const next = freshSession(context);
  const request = await next.begin(487, {
    kind: 'converted_to_draft',
    deliveryId: 'real-draft-transition',
  });
  assert.equal(request.input.isDraft, true);
  const packet = completePacket(request.input, request.priorAnalysis.packet);
  packet.recommendedAction = 'COMMENT';
  await next.finishParentAnalysis(packet);
  assert.equal(store.read().state.deliveries.at(-1).eventKind, 'converted_to_draft');
  assert.equal(store.read().state.slot, null);
  assert.deepEqual(store.read().state.pending, []);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('first initial-sweep capture returns the confirmed inventory without a second capture', async (t) => {
  const { s, f, store } = await session(t);
  const first = await s.captureInitialSweep();
  assert.equal(first.status, 'applied');
  assert.deepEqual(first.inventory, store.read().state.initialSweep);
  assert.deepEqual(first.inventory.pullRequests, [487]);
  const generation = store.read().revision;
  const repeated = await s.captureInitialSweep();
  assert.deepEqual(repeated.inventory, first.inventory);
  assert.equal(store.read().revision, generation);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

test('cloud ledger validation runbook uses the actual Node 24 baseline', () => {
  const guide = readFileSync(
    new URL('../../../internal/agent-operations/cloud-review-ledger-candidate.md', import.meta.url),
    'utf8'
  );
  assert.match(guide, /Node(?:\.js)?\s+24/);
  assert.doesNotMatch(guide, /Node(?:\.js)?\s+22/);
});

test('duplicate completion version and exact review binding fail closed before a journal write', async (t) => {
  for (const mode of [
    'version-zero',
    'version-two',
    'version-null',
    'wrong-state',
    'wrong-body',
    'wrong-author',
  ])
    await t.test(mode, async (t) => {
      const context = await session(t);
      const { s, f, store } = context;
      const initial = await s.begin(487, {
        kind: 'opened',
        deliveryId: 'prior-duplicate-negative',
      });
      const original = completePacket(initial.input);
      await s.finishParentAnalysis(original);
      f.reviews.push({
        id: 299,
        node_id: 'PRR_299',
        user: owner,
        commit_id: original.headSha,
        state: 'APPROVED',
        body: renderReviewBody(original),
        submitted_at: '2026-10-03T00:03:00Z',
      });
      const activeStore = new LocalCloudReviewLedger(context.dir, context.genesis);
      const next = new ConnectorReviewSession({
        transport: context.transport,
        ledger: activeStore,
        policy: structuredClone(rootPolicy),
      });
      const request = await next.begin(487, {
        kind: 'human-review',
        deliveryId: 'duplicate-negative',
      });
      const packet = {
        ...structuredClone(original),
        reviewInputDigest: computeReviewInputDigest(request.input),
        observedAt: '2026-10-03T00:04:00Z',
      };
      const apply = activeStore.apply.bind(activeStore);
      let finishAttempts = 0;
      activeStore.apply = (revision, command) => {
        if (command.type === 'finishAnalysis') {
          finishAttempts += 1;
          const altered = structuredClone(command);
          if (mode.startsWith('version-'))
            altered.duplicateReviewCompletionVersion =
              mode === 'version-zero' ? 0 : mode === 'version-two' ? 2 : null;
          if (mode === 'wrong-state') altered.liveInput.reviews[0].state = 'COMMENTED';
          if (mode === 'wrong-body') altered.liveInput.reviews[0].body += ' changed';
          if (mode === 'wrong-author') altered.liveInput.reviews[0].author = 'different-owner';
          const before = store.read().state;
          assert.throws(
            () => reduceCloudReviewLedger(before, { ...altered, owner: before.slot.owner }),
            /duplicate completion version|input.*changed|review input|exact governed duplicate|stale|reviewer permission has no exact-head approval subject/i
          );
          assert.deepEqual(store.read().state, before);
          return apply(revision, command);
        }
        return apply(revision, command);
      };
      assert.equal(
        (await next.publishParentPacket(packet, createConnectorAssessment())).status,
        'duplicate'
      );
      assert.equal(finishAttempts, 1);
      assert.equal(store.read().state.slot, null);
      assert.equal(store.read().state.pending.length, 0);
      assert.equal(
        computeReviewPacketDigest(store.read().state.analyses[0].packet),
        computeReviewPacketDigest(original)
      );
      assert.equal(store.read().state.publicationReceipts.length, 0);
      assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
    });
});

test('unknown duplicate-completion acknowledgement never releases or transfers its owned slot', async (t) => {
  const context = await session(t);
  const { s, f, store } = context;
  const first = await s.begin(487, { kind: 'opened', deliveryId: 'unknown-duplicate-prior' });
  const original = completePacket(first.input);
  await s.finishParentAnalysis(original);
  f.reviews.push({
    id: 399,
    node_id: 'PRR_399',
    user: owner,
    commit_id: original.headSha,
    state: 'APPROVED',
    body: renderReviewBody(original),
    submitted_at: '2026-10-03T00:03:00Z',
  });
  const activeStore = new LocalCloudReviewLedger(context.dir, context.genesis);
  const next = new ConnectorReviewSession({
    transport: context.transport,
    ledger: activeStore,
    policy: structuredClone(rootPolicy),
  });
  const request = await next.begin(487, {
    kind: 'human-review',
    deliveryId: 'unknown-duplicate-current',
  });
  const packet = {
    ...structuredClone(original),
    reviewInputDigest: computeReviewInputDigest(request.input),
    observedAt: '2026-10-03T00:04:00Z',
  };
  const before = structuredClone(store.read().state.slot);
  const apply = activeStore.apply.bind(activeStore);
  activeStore.apply = (revision, command) =>
    command.type === 'finishAnalysis' ? { status: 'unknown' } : apply(revision, command);
  await assert.rejects(
    next.publishParentPacket(packet, createConnectorAssessment()),
    /analysis acknowledgement unavailable/
  );
  assert.deepEqual(store.read().state.slot, before);
  assert.equal(store.read().state.pending.length, 1);
  assert.equal(store.read().state.publicationReceipts.length, 0);
  assert.equal(f.calls.filter((c) => c.operation === 'add_review_to_pr').length, 0);
});

for (const kind of [
  'missing',
  'missing-context',
  'expired',
  'mismatched-context',
  'missing-disclosure',
]) {
  test(`connector publication rejects ${kind} measured input before transport write`, async (t) => {
    const { s, f } = await session(t);
    const packet = await parentPacket(s);
    const measured = structuredClone(modelTraceFixture());
    if (kind === 'missing') delete measured.modelTrace;
    if (kind === 'missing-context') delete measured.modelTraceContext;
    if (kind === 'expired') {
      const ttl =
        Date.parse(measured.modelTrace.expiresAt) - Date.parse(measured.modelTrace.measuredAt);
      const fixedPast = Date.parse('2000-01-01T00:00:00.000Z');
      measured.modelTrace.measuredAt = new Date(fixedPast).toISOString();
      measured.modelTrace.expiresAt = new Date(fixedPast + ttl).toISOString();
      measured.modelTrace.id = `sha256:${computeModelTraceReceiptDigest(measured.modelTrace)}`;
    }
    if (kind === 'mismatched-context') measured.modelTraceContext.contextDigest = 'd'.repeat(64);
    if (kind === 'missing-disclosure')
      packet.agentEvidence.source = 'AI-executed review by ChatGPT';
    await assert.rejects(
      () => s.publishParentPacket(packet, assessment, null, measured),
      kind === 'expired' ? /measurement expired/ : /ModelTrace:/
    );
    assert.equal(f.calls.filter((call) => call.operation === 'add_review_to_pr').length, 0);
    assert.equal(f.reviews.length, 0);
  });
}
