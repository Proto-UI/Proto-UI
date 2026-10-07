import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLiveReviewInput, collectLiveReviewInput } from '../collect-live-review-input.mjs';
import { computeReviewInputDigest, validateReviewInputSnapshot } from '../review-runtime.mjs';
import { paginationFixture, repositoryId } from './fixtures/review-pagination.mjs';

// GitHub's PullRequestReviewComment schema: databaseId: Int (nullable,
// deprecated), id: ID! https://docs.github.com/en/graphql/reference/pulls#pullrequestreviewcomment
const replyPages = {
  first: [
    'ProtoUiReviewInput',
    (r) => r.data.repository.pullRequest.reviewThreads.nodes[0].comments,
  ],
  late: ['ProtoUiReviewThreadComments', (r) => r.data.node.comments],
  'late thread': [
    'ProtoUiReviewReviewThreads',
    (r) => r.data.repository.pullRequest.reviewThreads.nodes[0].comments,
  ],
};

for (const [page, [operation, comments]] of Object.entries(replyPages)) {
  test(`nullable reply databaseId on ${page} page retains complete canonical facts`, () => {
    const fixture = paginationFixture({
      mutate({ response, operation: current }) {
        if (current !== operation) return;
        const reply = comments(response).nodes[0];
        reply.databaseId = null;
        reply.body = 'Full nullable reply\n\nUnicode 内容';
        reply.updatedAt = '2026-10-04T19:00:00Z';
      },
    });
    const live = collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
    for (const call of fixture.calls.filter((call) => call.operation === operation))
      assert.match(
        call.args.find((arg) => arg.startsWith('query=')),
        /\bid databaseId author/
      );
    validateReviewInputSnapshot(live.input);
    const expected =
      page === 'first'
        ? ['PRRC_0_0', 'PRRT_0']
        : page === 'late'
          ? ['PRRC_0_100', 'PRRT_0']
          : ['PRRC_100_0', 'PRRT_100'];
    assert.deepEqual(
      live.input.replies.find((reply) => reply.id === expected[0]),
      {
        id: expected[0],
        threadId: expected[1],
        author: 'independent',
        body: 'Full nullable reply\n\nUnicode 内容',
        updatedAt: '2026-10-04T19:00:00Z',
      }
    );
    assert.equal(
      live.input.threads.find((thread) => thread.id === expected[1]).updatedAt,
      '2026-10-04T19:00:00Z'
    );
    assert.equal(live.input.threads.length, 102);
    assert.equal(live.input.replies.length, 202);
    assert.ok(
      live.input.commits.every((commit) => commit.committer.platform.kind === 'github-web-flow')
    );
    assert.ok(
      live.input.checks.every((check) => check.workflowPath === '.github/workflows/ci.yml')
    );
  });
}

function builderFixture() {
  const fixture = paginationFixture({ large: false });
  const raw = JSON.parse(
    fixture.runner('gh', ['api', 'graphql', 'query=query ProtoUiReviewInput'])
  );
  return {
    reply: raw.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes[0],
    build: () => buildLiveReviewInput(raw, repositoryId, 487, [], fixture.data.files).input,
  };
}

test('numeric canonical reply identity and pre-repair digest remain unchanged', () => {
  const fixture = paginationFixture({ large: false });
  const live = collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner });
  assert.equal(live.input.replies[0].id, '1');
  assert.equal(
    computeReviewInputDigest(live.input),
    '39f55e798b04f9cf19638955822d202903c2cc9a944a564308cc68d846b9273a'
  );
  const direct = builderFixture();
  const before = computeReviewInputDigest(direct.build());
  delete direct.reply.id;
  assert.equal(direct.build().replies[0].id, '1');
  assert.equal(computeReviewInputDigest(direct.build()), before);
});

test('direct builder uses the node ID only for an explicit null databaseId', () => {
  const fixture = builderFixture();
  fixture.reply.databaseId = null;
  assert.equal(fixture.build().replies[0].id, 'PRRC_0_0');
});

for (const databaseId of [undefined, '', '1', 0, -1, 1.5, false, {}, Number.MAX_SAFE_INTEGER + 1]) {
  test(`direct builder rejects malformed databaseId ${JSON.stringify(databaseId)}`, () => {
    const fixture = builderFixture();
    fixture.reply.databaseId = databaseId;
    assert.throws(fixture.build, /identity|malformed/);
  });
}
for (const id of [undefined, null, '', 1, false, {}]) {
  test(`direct builder rejects nullable reply with malformed node ID ${JSON.stringify(id)}`, () => {
    const fixture = builderFixture();
    fixture.reply.databaseId = null;
    fixture.reply.id = id;
    assert.throws(fixture.build, /identity|malformed/);
  });
}

for (const [page, [operation, comments]] of Object.entries(replyPages)) {
  for (const [field, value] of [
    ['id', undefined],
    ['id', null],
    ['id', ''],
    ['id', 1],
    ['databaseId', undefined],
    ['databaseId', '1'],
    ['databaseId', 0],
    ['databaseId', -1],
    ['databaseId', 1.5],
    ['databaseId', Number.MAX_SAFE_INTEGER + 1],
  ]) {
    test(`${page} reply rejects malformed ${field}: ${JSON.stringify(value)}`, () => {
      const fixture = paginationFixture({
        mutate({ response, operation: current }) {
          if (current === operation) comments(response).nodes[0][field] = value;
        },
      });
      assert.throws(
        () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
        /identity|malformed/
      );
    });
  }
}

for (const [name, mutate] of [
  [
    'same-page node identity with different databaseId',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewInput') {
        const nodes = response.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes;
        nodes[1].id = nodes[0].id;
      }
    },
  ],
  [
    'cross-page mixed numeric/null node identity',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewThreadComments') {
        Object.assign(response.data.node.comments.nodes[0], { id: 'PRRC_0_0', databaseId: null });
      }
    },
  ],
  [
    'cross-thread node identity with different databaseId',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewReviewThreads') {
        response.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes[0].id =
          'PRRC_0_0';
      }
    },
  ],
  [
    'distinct node identities with duplicate numeric ID',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewThreadComments')
        response.data.node.comments.nodes[0].databaseId = 1;
    },
  ],
  [
    'mixed canonical node/numeric ID collision',
    ({ response, operation }) => {
      if (operation === 'ProtoUiReviewThreadComments') {
        Object.assign(response.data.node.comments.nodes[0], { id: '1', databaseId: null });
      }
    },
  ],
]) {
  test(`reply collection rejects ${name}`, () => {
    const fixture = paginationFixture({ mutate });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /duplicates/
    );
  });
}

for (const direction of ['numeric to null', 'null to numeric']) {
  test(`stable recollection rejects late reply ${direction} identity drift`, () => {
    let scans = 0;
    const fixture = paginationFixture({
      mutate({ response, operation }) {
        if (operation === 'ProtoUiReviewInput') scans += 1;
        if (
          operation === 'ProtoUiReviewThreadComments' &&
          (direction === 'numeric to null' ? scans === 2 : scans === 1)
        ) {
          response.data.node.comments.nodes[0].databaseId = null;
        }
      },
    });
    assert.throws(
      () => collectLiveReviewInput(repositoryId, 487, { runner: fixture.runner }),
      /material state changed between complete collection scans/
    );
    assert.equal(scans, 2);
  });
}
