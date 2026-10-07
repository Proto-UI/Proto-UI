import assert from 'node:assert/strict';
import test from 'node:test';
import { collectLiveReviewInput } from '../collect-live-review-input.mjs';
import { computeReviewInputDigest, validateReviewInputSnapshot } from '../review-runtime.mjs';
import { paginationFixture, repositoryId, oid } from './fixtures/review-pagination.mjs';

test('canonical collection exhausts >100 commits and every required nested connection', () => {
  const fixture = paginationFixture();
  const live = collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
  validateReviewInputSnapshot(live.input);
  assert.equal(live.input.schemaVersion, 5);
  assert.equal(live.input.commits.length, 116);
  assert.equal(live.input.headSha, oid(116));
  assert.equal(live.input.reviews.length, 105);
  assert.equal(live.input.comments.length, 103);
  assert.equal(live.input.threads.length, 102);
  assert.equal(live.input.replies.length, 202);
  assert.equal(live.input.checks.length, 102);
  assert.equal(live.input.changedFiles.length, 101);
  assert.equal(live.input.reviewerPermissions[0].login, 'independent');
  assert.ok(
    live.input.commits.every(
      (commit) =>
        commit.message.includes('Body kept on every page') &&
        commit.author.login === 'author' &&
        commit.committer.platform.kind === 'github-web-flow'
    )
  );
  assert.ok(
    live.input.checks.every(
      (check) =>
        check.source === 'github-actions' && check.workflowPath === '.github/workflows/ci.yml'
    )
  );
  assert.match(computeReviewInputDigest(live.input), /^[a-f0-9]{64}$/);
});

test('one-page and empty optional connections retain canonical v5 behavior', () => {
  const fixture = paginationFixture({ large: false });
  fixture.data.reviews.length = 0;
  fixture.data.comments.length = 0;
  fixture.data.reviewThreads.length = 0;
  const live = collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
  assert.equal(live.input.commits.length, 1);
  assert.deepEqual(live.input.reviews, []);
  assert.deepEqual(live.input.comments, []);
  assert.deepEqual(live.input.threads, []);
  assert.deepEqual(live.input.reviewerPermissions, []);
  assert.equal(fixture.calls.filter((call) => call.operation === 'ProtoUiReviewInput').length, 2);
  assert.equal(fixture.calls.filter((call) => call.operation === 'ProtoUiReviewState').length, 2);
});

const connections = {
  commits: (pr) => pr.commits,
  reviews: (pr) => pr.reviews,
  comments: (pr) => pr.comments,
  threads: (pr) => pr.reviewThreads,
  replies: (pr) => pr.reviewThreads.nodes[0].comments,
  checks: (pr) => pr.commits.nodes.at(-1).commit.statusCheckRollup.contexts,
};
for (const [field, select] of Object.entries(connections)) {
  for (const [name, change, message] of [
    [
      'missing total',
      (c) => {
        delete c.totalCount;
      },
      /malformed/,
    ],
    [
      'missing page flag',
      (c) => {
        delete c.pageInfo.hasNextPage;
      },
      /malformed/,
    ],
    [
      'missing cursor',
      (c) => {
        delete c.pageInfo.endCursor;
      },
      /cursor/,
    ],
    [
      'missing item ID',
      (c) => {
        if (field === 'commits') delete c.nodes[0].commit.oid;
        else if (field === 'replies') delete c.nodes[0].databaseId;
        else delete c.nodes[0].id;
      },
      /identity|head commit|record is malformed/,
    ],
    [
      'duplicate item',
      (c) => {
        c.nodes.push(structuredClone(c.nodes[0]));
        c.totalCount += 1;
      },
      /duplicates/,
    ],
    [
      'omitted item',
      (c) => {
        c.totalCount += 1;
      },
      /count/,
    ],
    [
      'excess item',
      (c) => {
        c.totalCount = 0;
      },
      /count/,
    ],
    [
      'unbounded item count',
      (c) => {
        c.totalCount = 10001;
      },
      /bound/,
    ],
  ]) {
    test(`${field} fails closed on ${name}`, () => {
      const fixture = paginationFixture({
        large: false,
        mutate({ response, operation }) {
          if (operation === 'ProtoUiReviewInput')
            change(select(response.data.repository.pullRequest));
        },
      });
      assert.throws(
        () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
        message
      );
    });
  }
}

for (const [name, mutate, message] of [
  [
    'repeated terminal cursor',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewCommits')
        response.data.repository.pullRequest.commits.pageInfo.endCursor = '100';
    },
    /repeated.*cursor/,
  ],
  [
    'cross-page duplicate commit',
    ({ response, operation, data }) => {
      if (operation === 'ProtoUiReviewCommits')
        response.data.repository.pullRequest.commits.nodes[0] = structuredClone(data.commits[0]);
    },
    /duplicates/,
  ],
  [
    'changing total count',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewReviews')
        response.data.repository.pullRequest.reviews.totalCount += 1;
    },
    /count changed/,
  ],
  [
    'lost final page item',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewReviews')
        response.data.repository.pullRequest.reviews.nodes.pop();
    },
    /count/,
  ],
  [
    'empty continuing page',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewCommits')
        response.data.repository.pullRequest.commits.nodes = [];
    },
    /cursor.*malformed/,
  ],
  [
    'GraphQL partial-data failure',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewReviewThreads')
        response.errors = [{ message: 'partial upstream failure' }];
    },
    /partial upstream failure/,
  ],
  [
    'request failure',
    ({ operation }) => {
      if (operation === 'ProtoUiReviewComments') throw new Error('HTTP 503');
    },
    /503/,
  ],
  [
    'malformed continuation response',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewReviews') delete response.data.repository.pullRequest.reviews;
    },
    /malformed/,
  ],
  [
    'wrong nested thread',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewThreadComments') response.data.node.id = 'other-thread';
    },
    /thread.*binding/,
  ],
  [
    'wrong check commit',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewCheckContexts')
        response.data.repository.object.oid = oid(999);
    },
    /check.*binding/,
  ],
  [
    'cross-page nested reply duplicate',
    ({ response, operation, data }) => {
      if (operation === 'ProtoUiReviewThreadComments')
        response.data.node.comments.nodes[0] = structuredClone(data.replies.get('PRRT_0')[0]);
    },
    /duplicates/,
  ],
  [
    'duplicate changed-file path',
    ({ response, args, data }) => {
      if (args.some((arg) => arg.includes('/files?') && arg.endsWith('page=2')))
        response[0] = structuredClone(data.files[0]);
    },
    /duplicate paths/,
  ],
  [
    'missing changed-file page',
    ({ response, args }) => {
      if (args.some((arg) => arg.includes('/files?') && arg.endsWith('page=2')))
        response.length = 0;
    },
    /incomplete/,
  ],
]) {
  test(`multi-page collection rejects ${name}`, () => {
    const fixture = paginationFixture({ mutate });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      message
    );
  });
}

for (const field of [
  'headRefOid',
  'baseRefOid',
  'baseRefName',
  'body',
  'state',
  'isDraft',
  'updatedAt',
]) {
  test(`page boundaries reject drift in ${field}`, () => {
    const fixture = paginationFixture({
      mutate({ response, operation }) {
        if (operation !== 'ProtoUiReviewCommits') return;
        response.data.repository.pullRequest[field] = {
          headRefOid: oid(999),
          baseRefOid: oid(999),
          baseRefName: 'other',
          body: 'changed',
          state: 'CLOSED',
          isDraft: true,
          updatedAt: '2026-10-04T19:00:00Z',
        }[field];
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /changed during collection/
    );
  });
}
for (const [name, change] of [
  [
    'repository identity',
    (r) => {
      r.data.repository.id = 'REPO_2';
    },
  ],
  [
    'repository name',
    (r) => {
      r.data.repository.nameWithOwner = 'other/Proto-UI';
    },
  ],
  [
    'PR identity',
    (r) => {
      r.data.repository.pullRequest.id = 'PR_other';
    },
  ],
  [
    'PR number',
    (r) => {
      r.data.repository.pullRequest.number = 488;
    },
  ],
  [
    'viewer identity',
    (r) => {
      r.data.viewer.login = 'other';
    },
  ],
  [
    'viewer permission',
    (r) => {
      r.data.repository.viewerPermission = 'READ';
    },
  ],
]) {
  test(`collection rechecks ${name} after files and permissions`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewState') change(response);
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /binding.*malformed|changed during collection/
    );
  });
}

for (const [name, change] of [
  [
    'late-page review body',
    (d) => {
      d.reviews[101].body = 'edited at same timestamp';
    },
  ],
  [
    'late-page comment body',
    (d) => {
      d.comments[101].body = 'edited at same timestamp';
    },
  ],
  [
    'late-page thread resolution',
    (d) => {
      d.reviewThreads[101].isResolved = false;
    },
  ],
  [
    'nested late-page reply',
    (d) => {
      d.replies.get('PRRT_0')[100].body = 'edited at same timestamp';
    },
  ],
  [
    'late-page check provenance',
    (d) => {
      d.checks[101].checkSuite.app.slug = 'other-app';
    },
  ],
  [
    'late-page commit message',
    (d) => {
      d.commits[101].commit.message += '\nAdditional message';
    },
  ],
  [
    'late-page contributor binding',
    (d) => {
      d.commits[101].commit.author.user.login = 'other';
    },
  ],
  [
    'same-count changed files',
    (d) => {
      d.files[0].filename = 'src/replaced.mjs';
    },
  ],
]) {
  test(`complete second scan detects ${name} drift with unchanged counts/head`, () => {
    let scans = 0;
    const fixture = paginationFixture({
      mutate({ data, operation }) {
        if (operation === 'ProtoUiReviewInput' && ++scans === 2) change(data);
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /material state changed between complete/
    );
  });
}

test('complete second scan detects current reviewer permission drift', () => {
  let permissions = 0;
  const fixture = paginationFixture({
    large: false,
    mutate({ response, args }) {
      if (args.some((arg) => arg.endsWith('/permission')) && ++permissions === 2)
        response.permission = 'read';
    },
  });
  assert.throws(
    () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
    /material state changed between complete/
  );
});

test('GraphQL and REST reads are bounded and never become writes', () => {
  const fixture = paginationFixture({ large: false });
  collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
  for (const { args } of fixture.calls) {
    assert.equal(args[0], 'api');
    assert.ok(!args.includes('--paginate'));
    assert.ok(!args.includes('POST') && !args.includes('PUT') && !args.includes('PATCH'));
    assert.ok(!args.some((arg) => /\bmutation\b/.test(arg)));
  }
});

test('connection pagination has a finite page budget even when unique cursors continue', async () => {
  const { collectConnection, MAX_CONNECTION_PAGES } = await import('../review-pagination.mjs');
  const page = (index) => ({
    totalCount: MAX_CONNECTION_PAGES + 1,
    nodes: [{ id: `item-${index}` }],
    pageInfo: { hasNextPage: true, endCursor: String(index) },
  });
  let reads = 1;
  assert.throws(
    () =>
      collectConnection(page(1), {
        label: 'test',
        id: (node) => node.id,
        next() {
          reads += 1;
          return page(reads);
        },
      }),
    /100-page collection bound/
  );
  assert.equal(reads, MAX_CONNECTION_PAGES);
});

test('oversized GraphQL page fails instead of accepting a fixed larger page', async () => {
  const { collectConnection } = await import('../review-pagination.mjs');
  assert.throws(
    () =>
      collectConnection(
        {
          totalCount: 101,
          nodes: Array.from({ length: 101 }, (_, i) => ({ id: String(i) })),
          pageInfo: { hasNextPage: false, endCursor: '101' },
        },
        {
          label: 'test',
          id: (node) => node.id,
          next() {
            assert.fail('no extra read');
          },
        }
      ),
    /malformed/
  );
});

for (const [name, change] of [
  [
    'full commit message',
    (p) => {
      delete p.commits.nodes[0].commit.message;
    },
  ],
  [
    'commit author platform binding',
    (p) => {
      delete p.commits.nodes[0].commit.author.user;
    },
  ],
  [
    'commit committer platform binding',
    (p) => {
      delete p.commits.nodes[0].commit.committer.user;
    },
  ],
  [
    'commit signature attestation',
    (p) => {
      delete p.commits.nodes[0].commit.signature.isValid;
    },
  ],
  [
    'review body',
    (p) => {
      delete p.reviews.nodes[0].body;
    },
  ],
  [
    'conversation body',
    (p) => {
      delete p.comments.nodes[0].body;
    },
  ],
  [
    'nested reply body',
    (p) => {
      delete p.reviewThreads.nodes[0].comments.nodes[0].body;
    },
  ],
]) {
  test(`malformed transport cannot silently replace missing ${name} with a default`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewInput') change(response.data.repository.pullRequest);
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /malformed|incomplete/
    );
  });
}

test('the invocation request budget includes all current reviewer permission reads', async () => {
  const { MAX_LIVE_COLLECTION_REQUESTS } = await import('../collect-live-review-input.mjs');
  const fixture = paginationFixture({
    large: false,
    mutate({ response, args }) {
      const endpoint = args.find((arg) => arg.endsWith('/permission'));
      if (endpoint) response.user.login = endpoint.split('/').at(-2);
    },
  });
  const review = fixture.data.reviews[0];
  fixture.data.reviews.splice(
    0,
    1,
    ...Array.from({ length: 1000 }, (_, index) => ({
      ...structuredClone(review),
      id: `approval-${index}`,
      author: { login: `reviewer-${index}` },
    }))
  );
  assert.throws(
    () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
    /1000-request bound/
  );
  assert.equal(fixture.calls.length, MAX_LIVE_COLLECTION_REQUESTS);
  assert.ok(fixture.calls.at(-1).args.some((arg) => arg.endsWith('/permission')));
});

for (const [name, body] of [
  ['missing', undefined],
  ['null', null],
  ['number', 42],
  ['boolean', false],
  ['array', []],
  ['object', {}],
]) {
  test(`PR body rejects ${name} instead of inventing empty content`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, args }) {
        if (!args.includes('graphql')) return;
        const pr = response.data.repository.pullRequest;
        if (body === undefined) delete pr.body;
        else pr.body = body;
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /malformed|incomplete|invalid/
    );
  });
}
for (const body of ['', '完整 PR 正文\n\nBody preserved exactly.']) {
  test(`PR body preserves explicit ${JSON.stringify(body)}`, () => {
    const fixture = paginationFixture({ large: false });
    fixture.state.body = body;
    assert.equal(
      collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }).input.pullRequestBody,
      body
    );
  });
}
for (const [name, select] of [
  ['PR author', (p) => p.author],
  ['review author', (p) => p.reviews.nodes[0].author],
  ['conversation author', (p) => p.comments.nodes[0].author],
  ['reply author', (p) => p.reviewThreads.nodes[0].comments.nodes[0].author],
]) {
  test(`missing ${name} login cannot become a deleted actor`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewInput')
          delete select(response.data.repository.pullRequest).login;
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /malformed|incomplete/
    );
  });
}
for (const [name, select, field] of [
  ['suite', (n) => n, 'checkSuite'],
  ['app', (n) => n.checkSuite, 'app'],
  ['app slug', (n) => n.checkSuite.app, 'slug'],
  ['app id', (n) => n.checkSuite.app, 'id'],
  ['repository', (n) => n.checkSuite, 'repository'],
  ['repository name', (n) => n.checkSuite.repository, 'nameWithOwner'],
  ['workflow run', (n) => n.checkSuite, 'workflowRun'],
  ['workflow file', (n) => n.checkSuite.workflowRun, 'file'],
  ['workflow path', (n) => n.checkSuite.workflowRun.file, 'path'],
  ['workflow', (n) => n.checkSuite.workflowRun, 'workflow'],
  ['workflow name', (n) => n.checkSuite.workflowRun.workflow, 'name'],
]) {
  test(`missing check ${name} cannot silently lose provenance`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewInput')
          delete select(
            response.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts
              .nodes[0]
          )[field];
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /malformed|incomplete/
    );
  });
}
test('explicit nullable actors and provenance preserve the existing canonical meaning', () => {
  const fixture = paginationFixture({
    large: false,
    mutate({ response, operation }) {
      if (operation === 'ProtoUiReviewInput')
        response.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0].checkSuite =
          { app: null, repository: { nameWithOwner: 'Proto-UI/Proto-UI' }, workflowRun: null };
    },
  });
  fixture.data.reviews[0].author = null;
  fixture.data.comments[0].author = null;
  fixture.data.replies.get('PRRT_0')[0].author = null;
  const live = collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
  assert.equal(live.input.reviews[0].author, null);
  assert.equal(live.input.checks[0].source, 'unknown-check-run');
  assert.deepEqual(live.input.reviewerPermissions, []);
});

test('non-null review commit requires the queried oid', () => {
  const fixture = paginationFixture({
    large: false,
    mutate({ response, operation }) {
      if (operation === 'ProtoUiReviewInput')
        delete response.data.repository.pullRequest.reviews.nodes[0].commit.oid;
    },
  });
  assert.throws(
    () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
    /malformed|incomplete/
  );
});
test('a non-nullable check suite cannot be replaced by null', () => {
  const fixture = paginationFixture({
    large: false,
    mutate({ response, operation }) {
      if (operation === 'ProtoUiReviewInput')
        response.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0].checkSuite =
          null;
    },
  });
  assert.throws(
    () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
    /malformed|incomplete/
  );
});

for (const [name, change] of [
  [
    'repository',
    (suite) => {
      suite.repository = null;
    },
  ],
  [
    'workflow',
    (suite) => {
      suite.workflowRun.workflow = null;
    },
  ],
]) {
  test(`non-nullable check ${name} rejects null`, () => {
    const fixture = paginationFixture({
      large: false,
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewInput')
          change(
            response.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts
              .nodes[0].checkSuite
          );
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /malformed|incomplete/
    );
  });
}

test('REST file ceiling admits 3000 and rejects 3001 before any file listing', () => {
  const makeFixture = (total) => {
    const fixture = paginationFixture({ large: false });
    fixture.data.files.length = 0;
    for (let index = 0; index < total; index++)
      fixture.data.files.push({ filename: `synthetic/file-${index}.mjs`, status: 'modified' });
    fixture.state.changedFiles = total;
    return fixture;
  };
  const supported = makeFixture(3000);
  const live = collectLiveReviewInput(repositoryId, 487, { runner: supported.runner });
  validateReviewInputSnapshot(live.input);
  assert.equal(live.input.changedFiles.length, 3000);

  const impossible = makeFixture(3001);
  assert.throws(() => collectLiveReviewInput(repositoryId, 487, { runner: impossible.runner }));
  assert.equal(
    impossible.calls.filter((call) => call.args.some((arg) => arg.includes('/files?'))).length,
    0
  );
});
