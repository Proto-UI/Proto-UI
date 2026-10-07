import { isDeepStrictEqual } from 'node:util';

// Explicit resource limits, not permission to return a partial connection.
export const MAX_CONNECTION_PAGES = 100;
export const MAX_CONNECTION_ITEMS = 10_000;
const MAX_REST_FILES = 3_000;
const PAGE_INFO = 'totalCount pageInfo { hasNextPage endCursor }';
const PR_FIELDS = `
  id number updatedAt state isDraft mergeable mergeStateStatus viewerCanMergeAsAdmin
  changedFiles body baseRefName baseRefOid headRefOid author { login }
`;
const CHECK_FIELDS = `
  __typename
  ... on CheckRun {
    id name status conclusion completedAt detailsUrl
    checkSuite {
      app { id slug }
      repository { nameWithOwner }
      workflowRun { file { path } workflow { name } }
    }
  }
  ... on StatusContext { id context state targetUrl createdAt creator { login __typename } }
`;
const COMMENT_FIELDS = 'id databaseId author { login } body updatedAt';
const FIELDS = {
  commits: `commit {
    oid message author { name email user { login } } committer { name email user { login } }
    signature {
      __typename
      ... on GpgSignature { isValid wasSignedByGitHub }
      ... on SshSignature { isValid wasSignedByGitHub }
    }
    statusCheckRollup { contexts(first: 100) { nodes { ${CHECK_FIELDS} } ${PAGE_INFO} } }
  }`,
  reviews: 'id author { login } state commit { oid } submittedAt body',
  comments: 'id author { login } body updatedAt',
  reviewThreads: `id isResolved comments(first: 100) { nodes { ${COMMENT_FIELDS} } ${PAGE_INFO} }`,
};
function query(name, selection = '', variables = '', extra = '', repositoryExtra = '') {
  return `query ${name}($owner: String!, $name: String!, $number: Int!${variables}) {
    viewer { login }
    repository(owner: $owner, name: $name) {
      id nameWithOwner viewerPermission
      pullRequest(number: $number) { ${PR_FIELDS} ${selection} }
      ${repositoryExtra}
    }
    ${extra}
  }`;
}
export const QUERY = query(
  'ProtoUiReviewInput',
  Object.entries(FIELDS)
    .map(([field, fields]) => `${field}(first: 100) { nodes { ${fields} } ${PAGE_INFO} }`)
    .join('\n')
);
const STATE_QUERY = query('ProtoUiReviewState');
const PAGE_QUERIES = Object.fromEntries(
  Object.entries(FIELDS).map(([field, fields]) => [
    field,
    query(
      `ProtoUiReview${field[0].toUpperCase()}${field.slice(1)}`,
      `${field}(first: 100, after: $cursor) { nodes { ${fields} } ${PAGE_INFO} }`,
      ', $cursor: String!'
    ),
  ])
);
const THREAD_COMMENTS_QUERY = query(
  'ProtoUiReviewThreadComments',
  '',
  ', $id: ID!, $cursor: String!',
  `node(id: $id) { ... on PullRequestReviewThread {
    id comments(first: 100, after: $cursor) { nodes { ${COMMENT_FIELDS} } ${PAGE_INFO} }
  } }`
);
const CHECK_CONTEXTS_QUERY = query(
  'ProtoUiReviewCheckContexts',
  '',
  ', $oid: GitObjectID!, $cursor: String!',
  '',
  `object(oid: $oid) { ... on Commit {
    oid statusCheckRollup { contexts(first: 100, after: $cursor) { nodes { ${CHECK_FIELDS} } ${PAGE_INFO} } }
  } }`
);

function stringId(value) {
  return typeof value === 'string' && value.length > 0;
}
function requireFields(value, fields, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    fields.some((field) => !Object.hasOwn(value, field) || value[field] === undefined)
  )
    throw new Error(`live ${label} record is malformed or incomplete`);
}
export function canonicalReplyId(comment) {
  requireFields(comment, ['databaseId'], 'thread comment');
  // Keep historical numeric IDs (and their canonical digests) unchanged. GitHub's
  // deprecated databaseId is nullable; only an explicit null uses the node ID.
  if (Number.isSafeInteger(comment.databaseId) && comment.databaseId > 0)
    return String(comment.databaseId);
  if (comment.databaseId === null && stringId(comment.id)) return comment.id;
  throw new Error('live thread comment identity is missing or malformed');
}
function actorFields(actor, label) {
  if (actor === null) return;
  requireFields(actor, ['name', 'email', 'user'], label);
  if (actor.user !== null) requireFields(actor.user, ['login'], label);
}
function platformActorFields(actor, label) {
  if (actor === null) return;
  requireFields(actor, ['login'], label);
  if (!stringId(actor.login)) throw new Error(`live ${label} login is malformed`);
}
function checkFields(node) {
  if (node?.__typename === 'CheckRun') {
    requireFields(
      node,
      ['id', 'name', 'status', 'conclusion', 'completedAt', 'detailsUrl', 'checkSuite'],
      'check run'
    );
    const suite = node.checkSuite;
    requireFields(suite, ['app', 'repository', 'workflowRun'], 'check suite');
    if (suite.app !== null) requireFields(suite.app, ['id', 'slug'], 'check app');
    requireFields(suite.repository, ['nameWithOwner'], 'check repository');
    if (suite.workflowRun !== null) {
      requireFields(suite.workflowRun, ['file', 'workflow'], 'check workflow run');
      if (suite.workflowRun.file !== null)
        requireFields(suite.workflowRun.file, ['path'], 'check workflow file');
      requireFields(suite.workflowRun.workflow, ['name'], 'check workflow');
    }
  } else if (node?.__typename === 'StatusContext') {
    requireFields(
      node,
      ['id', 'context', 'state', 'targetUrl', 'createdAt', 'creator'],
      'status context'
    );
    platformActorFields(node.creator, 'status creator');
    if (node.creator !== null) requireFields(node.creator, ['__typename'], 'status creator');
  } else return null;
  return node.id;
}
function nodeFields(field, node) {
  if (field === 'commits') {
    requireFields(node?.commit, ['oid', 'message', 'author', 'committer', 'signature'], 'commit');
    if (typeof node.commit.message !== 'string')
      throw new Error('live commit message is malformed');
    actorFields(node.commit.author, 'commit author');
    actorFields(node.commit.committer, 'commit committer');
    const signature = node.commit.signature;
    if (signature !== null) {
      requireFields(signature, ['__typename'], 'commit signature');
      if (['GpgSignature', 'SshSignature'].includes(signature.__typename))
        requireFields(signature, ['isValid', 'wasSignedByGitHub'], 'commit signature');
    }
    return node.commit.oid;
  }
  if (field === 'reviewThreads') requireFields(node, ['id', 'isResolved', 'comments'], field);
  else {
    const fields =
      field === 'reviews'
        ? ['id', 'author', 'body', 'state', 'commit', 'submittedAt']
        : ['id', 'author', 'body', 'updatedAt'];
    requireFields(node, fields, field);
    if (typeof node.body !== 'string') throw new Error(`live ${field} body is malformed`);
    platformActorFields(node.author, `${field} author`);
    if (field === 'reviews' && node.commit !== null)
      requireFields(node.commit, ['oid'], 'review commit');
  }
  return node.id;
}
function anchor(raw, owner, name, number) {
  const repository = raw?.data?.repository;
  const pr = repository?.pullRequest;
  if (
    !stringId(raw?.data?.viewer?.login) ||
    !stringId(repository?.id) ||
    repository.nameWithOwner?.toLowerCase() !== `${owner}/${name}`.toLowerCase() ||
    !['ADMIN', 'MAINTAIN', 'WRITE', 'TRIAGE', 'READ'].includes(repository.viewerPermission) ||
    !stringId(pr?.id) ||
    pr.number !== number ||
    !/^[a-f0-9]{40,64}$/.test(pr.baseRefOid ?? '') ||
    !/^[a-f0-9]{40,64}$/.test(pr.headRefOid ?? '') ||
    typeof pr.body !== 'string' ||
    typeof pr.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(pr.updatedAt))
  )
    throw new Error('live review repository, pull-request, or viewer binding is malformed');
  platformActorFields(pr.author, 'pull-request author');
  // Select queried fields only: unrelated mock/server extension fields do not
  // become trusted inputs or falsely imply a stronger canonical schema.
  const fields = [
    'id',
    'number',
    'updatedAt',
    'state',
    'isDraft',
    'mergeable',
    'mergeStateStatus',
    'viewerCanMergeAsAdmin',
    'changedFiles',
    'body',
    'baseRefName',
    'baseRefOid',
    'headRefOid',
    'author',
  ];
  return {
    repositoryId: repository.id,
    nameWithOwner: repository.nameWithOwner.toLowerCase(),
    viewer: raw.data.viewer.login,
    permission: repository.viewerPermission,
    state: Object.fromEntries(fields.map((field) => [field, pr[field]])),
  };
}

// A terminal page is accepted only after unique IDs exhaust the stable reported
// count. Repeated cursors (including on the final page) never establish progress.
export function collectConnection(first, { label, id, next }) {
  const nodes = [];
  const ids = new Set();
  const cursors = new Set();
  let expected;
  let page = first;
  for (let pageNumber = 1; pageNumber <= MAX_CONNECTION_PAGES; pageNumber += 1) {
    if (
      !Array.isArray(page?.nodes) ||
      page.nodes.length > 100 ||
      !Number.isSafeInteger(page.totalCount) ||
      page.totalCount < 0 ||
      typeof page.pageInfo?.hasNextPage !== 'boolean'
    )
      throw new Error(`live ${label} connection payload is malformed`);
    if (page.totalCount > MAX_CONNECTION_ITEMS)
      throw new Error(`live ${label} exceeds the ${MAX_CONNECTION_ITEMS}-item collection bound`);
    expected ??= page.totalCount;
    if (page.totalCount !== expected)
      throw new Error(`live ${label} total count changed during pagination`);
    const cursor = page.pageInfo.endCursor;
    if (
      (page.nodes.length > 0 && !stringId(cursor)) ||
      (page.nodes.length === 0 && (cursor !== null || page.pageInfo.hasNextPage))
    )
      throw new Error(`live ${label} pagination cursor is missing or malformed`);
    if (cursor !== null) {
      if (cursors.has(cursor)) throw new Error(`live ${label} pagination repeated a cursor`);
      cursors.add(cursor);
    }
    for (const node of page.nodes) {
      const key = id(node);
      if (!stringId(key)) throw new Error(`live ${label} item identity is missing or malformed`);
      if (ids.has(key)) throw new Error(`live ${label} collection duplicates an item identity`);
      ids.add(key);
      nodes.push(node);
    }
    if (nodes.length > expected) throw new Error(`live ${label} unique count exceeds total count`);
    if (!page.pageInfo.hasNextPage) {
      if (nodes.length !== expected)
        throw new Error(`live ${label} unique count does not match total count`);
      return { nodes, totalCount: expected, pageInfo: page.pageInfo };
    }
    if (nodes.length >= expected)
      throw new Error(`live ${label} pagination exceeds reported total count`);
    if (pageNumber === MAX_CONNECTION_PAGES)
      throw new Error(`live ${label} exceeds the ${MAX_CONNECTION_PAGES}-page collection bound`);
    page = next(cursor);
  }
}

export function collectReviewSnapshot({ owner, name, pullRequest, read }) {
  const variables = { owner, name, number: pullRequest };
  function graphql(queryText, extra = {}) {
    const result = read([
      'api',
      'graphql',
      '-f',
      `query=${queryText}`,
      ...Object.entries({ ...variables, ...extra }).flatMap(([key, value]) => [
        '-F',
        `${key}=${value}`,
      ]),
    ]);
    if (result?.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length))
      throw new Error(
        `live review-input GraphQL collection failed: ${result.errors?.[0]?.message ?? 'malformed errors'}`
      );
    return result;
  }
  const raw = graphql(QUERY);
  const initial = anchor(raw, owner, name, pullRequest);
  function boundQuery(queryText, extra) {
    const result = graphql(queryText, extra);
    if (!isDeepStrictEqual(anchor(result, owner, name, pullRequest), initial))
      throw new Error('live review-input target or material state changed during collection');
    return result;
  }
  const pr = raw.data.repository.pullRequest;
  const count = pr.changedFiles;
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_REST_FILES)
    throw new Error(
      `live changed-file count is malformed or exceeds the ${MAX_REST_FILES}-file REST ceiling`
    );
  for (const field of Object.keys(FIELDS)) {
    pr[field] = collectConnection(pr[field], {
      label: field,
      id: (node) => nodeFields(field, node),
      next: (cursor) =>
        boundQuery(PAGE_QUERIES[field], { cursor }).data.repository.pullRequest[field],
    });
  }
  const replyNodeIds = new Set();
  for (const thread of pr.reviewThreads.nodes) {
    thread.comments = collectConnection(thread.comments, {
      label: `thread ${thread.id} comments`,
      id(node) {
        requireFields(node, ['id', 'databaseId', 'author', 'body', 'updatedAt'], 'thread comment');
        if (typeof node.body !== 'string') throw new Error('live thread comment body is malformed');
        platformActorFields(node.author, 'thread comment author');
        canonicalReplyId(node);
        if (!stringId(node.id)) throw new Error('live thread comment node identity is malformed');
        // A repeated node cannot evade completeness checks by changing between
        // numeric and null database IDs, or by appearing in another thread.
        if (replyNodeIds.has(node.id))
          throw new Error('live thread comment collection duplicates a node identity');
        replyNodeIds.add(node.id);
        return node.id;
      },
      next(cursor) {
        const node = boundQuery(THREAD_COMMENTS_QUERY, { id: thread.id, cursor }).data.node;
        if (node?.id !== thread.id) throw new Error('live thread comment target binding changed');
        return node.comments;
      },
    });
  }
  const head = pr.commits.nodes.at(-1)?.commit;
  if (head?.oid !== pr.headRefOid)
    throw new Error('live head commit collection does not match the pull-request head');
  const contexts = collectConnection(head.statusCheckRollup?.contexts, {
    label: 'check contexts',
    id: checkFields,
    next(cursor) {
      const commit = boundQuery(CHECK_CONTEXTS_QUERY, { oid: head.oid, cursor }).data.repository
        .object;
      if (commit?.oid !== head.oid) throw new Error('live check context head binding changed');
      return commit.statusCheckRollup?.contexts;
    },
  });
  head.statusCheckRollup.contexts = contexts;

  const files = [];
  const paths = new Set();
  for (let page = 1; files.length < count && page <= MAX_CONNECTION_PAGES; page += 1) {
    const batch = read([
      'api',
      `repos/${owner}/${name}/pulls/${pullRequest}/files?per_page=100&page=${page}`,
    ]);
    if (!Array.isArray(batch) || batch.length === 0 || batch.length > 100)
      throw new Error('live changed-file collection is malformed or incomplete');
    for (const file of batch) {
      if (!stringId(file?.filename) || paths.has(file.filename))
        throw new Error('live changed-file collection has missing or duplicate paths');
      paths.add(file.filename);
      files.push(file);
    }
    if (files.length > count || (batch.length < 100 && files.length !== count))
      throw new Error('live changed-file collection does not match reported total count');
  }
  if (files.length !== count) throw new Error('live changed-file collection is incomplete');
  return { raw, files, anchor: initial, verifyState: () => boundQuery(STATE_QUERY) };
}
