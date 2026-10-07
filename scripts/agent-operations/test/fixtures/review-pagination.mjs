// Transport fixture: every connection has independently reported counts and IDs.
// Canonical assertions exercise the public collector, not a hand-assembled packet.
export const repositoryId = 'github.com:Proto-UI/Proto-UI';
export const oid = (index) => index.toString(16).padStart(40, '0');
const updatedAt = '2026-10-04T18:00:00Z';

export function paginationFixture({ large = true, mutate = () => {} } = {}) {
  const n = (big) => (large ? big : 1);
  const checks = Array.from({ length: n(102) }, (_, i) => ({
    id: `CR_${i}`,
    __typename: 'CheckRun',
    name: `check-${i}`,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    completedAt: updatedAt,
    detailsUrl: `https://github.com/Proto-UI/Proto-UI/actions/runs/${i + 1}`,
    checkSuite: {
      app: { id: 'APP_github_actions', slug: 'github-actions' },
      repository: { nameWithOwner: 'Proto-UI/Proto-UI' },
      workflowRun: { file: { path: '.github/workflows/ci.yml' }, workflow: { name: 'CI' } },
    },
  }));
  function page(nodes, cursor = null) {
    const start = cursor === null ? 0 : Number(cursor);
    const end = Math.min(start + 100, nodes.length);
    return {
      totalCount: nodes.length,
      nodes: structuredClone(nodes.slice(start, end)),
      pageInfo: { hasNextPage: end < nodes.length, endCursor: end ? String(end) : null },
    };
  }
  const commits = Array.from({ length: n(116) }, (_, i) => ({
    commit: {
      oid: oid(i + 1),
      message: `Full commit ${i}\n\nBody kept on every page\n\nSigned-off-by: Author <author@example.com>`,
      author: { name: 'Author', email: 'author@example.com', user: { login: 'author' } },
      committer: { name: 'GitHub', email: 'noreply@github.com', user: null },
      signature: { __typename: 'GpgSignature', isValid: true, wasSignedByGitHub: true },
      statusCheckRollup: { contexts: page(checks) },
    },
  }));
  const reviews = Array.from({ length: n(105) }, (_, i) => ({
    id: `PRR_${i}`,
    author: { login: 'independent' },
    state: i === n(105) - 1 ? 'APPROVED' : 'COMMENTED',
    commit: { oid: commits.at(-1).commit.oid },
    submittedAt: updatedAt,
    body: `Review ${i}`,
  }));
  const comments = Array.from({ length: n(103) }, (_, i) => ({
    id: `IC_${i}`,
    author: { login: 'author' },
    body: `Comment ${i}`,
    updatedAt,
  }));
  const replies = new Map();
  const reviewThreads = Array.from({ length: n(102) }, (_, i) => {
    const id = `PRRT_${i}`;
    const nodes = Array.from({ length: i === 0 ? n(101) : 1 }, (_, j) => ({
      id: `PRRC_${i}_${j}`,
      databaseId: i * 1000 + j + 1,
      author: { login: 'independent' },
      body: `Reply ${i}/${j}`,
      updatedAt,
    }));
    replies.set(id, nodes);
    return { id, isResolved: true, comments: page(nodes) };
  });
  const files = Array.from({ length: n(101) }, (_, i) => ({
    filename: `src/file-${i}.mjs`,
    status: 'modified',
  }));
  const data = { commits, reviews, comments, reviewThreads, checks, replies, files };
  const state = {
    id: 'PR_487',
    number: 487,
    updatedAt,
    state: 'OPEN',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    viewerCanMergeAsAdmin: false,
    changedFiles: files.length,
    body: 'Bounded pagination',
    baseRefName: 'main',
    baseRefOid: oid(1000),
    headRefOid: commits.at(-1).commit.oid,
    author: { login: 'author' },
  };
  function root() {
    return {
      data: {
        viewer: { login: 'reviewer' },
        repository: {
          id: 'REPO_1',
          nameWithOwner: 'Proto-UI/Proto-UI',
          viewerPermission: 'WRITE',
          pullRequest: {
            ...state,
            ...Object.fromEntries(
              ['commits', 'reviews', 'comments', 'reviewThreads'].map((key) => [
                key,
                page(data[key]),
              ])
            ),
          },
        },
      },
    };
  }
  const calls = [];
  const runner = (_command, args) => {
    const query = args.find((arg) => arg.startsWith('query=')) ?? '';
    const operation = /query (\w+)/.exec(query)?.[1] ?? 'initial';
    const variable = (name) =>
      args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
    const cursor = variable('cursor');
    let response;
    if (args.includes('graphql')) {
      response = root();
      const field = ['commits', 'reviews', 'comments', 'reviewThreads'].find((name) =>
        query.includes(`${name}(first: 100, after: $cursor)`)
      );
      if (field) response.data.repository.pullRequest[field] = page(data[field], cursor);
      if (operation === 'ProtoUiReviewThreadComments') {
        const id = variable('id');
        response.data.node = { id, comments: page(replies.get(id), cursor) };
      }
      if (operation === 'ProtoUiReviewCheckContexts') {
        response.data.repository.object = {
          oid: state.headRefOid,
          statusCheckRollup: { contexts: page(checks, cursor) },
        };
      }
    } else if (args.some((arg) => arg.endsWith('/permission'))) {
      response = { user: { login: 'independent' }, permission: 'write' };
    } else {
      const endpoint = args.find((arg) => arg.includes('/files?'));
      const number = Number(/(?:[?&])page=(\d+)/.exec(endpoint)?.[1] ?? 1);
      response = args.includes('--slurp')
        ? [files.slice(0, 100), files.slice(100)]
        : files.slice((number - 1) * 100, number * 100);
    }
    calls.push({ args, operation, cursor });
    const changed = mutate({ response, data, state, operation, cursor, args, calls });
    return JSON.stringify(changed === undefined ? response : changed);
  };
  return { runner, calls, data, state };
}

// Legacy one-page fixtures specify canonical facts. Add the separately asserted
// GraphQL transport envelope when those fixtures exercise actual collection.
export function withReviewTransportMetadata(value) {
  const raw = structuredClone(value);
  const repository = raw.data.repository;
  repository.id ??= 'REPO_1';
  repository.nameWithOwner ??= 'Proto-UI/Proto-UI';
  const pr = repository.pullRequest;
  pr.id ??= 'PR_487';
  pr.number ??= 487;
  pr.updatedAt ??= '2026-10-04T18:00:00Z';
  function connection(value) {
    value.totalCount ??= value.nodes.length;
    value.pageInfo.endCursor ??= value.nodes.length ? String(value.nodes.length) : null;
  }
  for (const key of ['commits', 'reviews', 'comments', 'reviewThreads']) connection(pr[key]);
  for (const thread of pr.reviewThreads.nodes) {
    connection(thread.comments);
    for (const comment of thread.comments.nodes)
      comment.id ??= `fixture-reply-${comment.databaseId}`;
  }
  for (const node of pr.commits.nodes) {
    node.commit.signature ??= null;
    const contexts = node.commit.statusCheckRollup?.contexts;
    if (!contexts) continue;
    connection(contexts);
    contexts.nodes.forEach((check, index) => {
      check.id ??= `fixture-check-${index}`;
    });
  }
  return raw;
}
