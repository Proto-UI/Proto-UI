import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { establishExecutionMode } from './skill-registry.mjs';
import {
  ownerAuthorizationFromArgs,
  ownerAuthorizationAllows,
  ownerCollaborationScope,
} from './owner-authorization.mjs';
import { MAX_LIVE_RESPONSE_BYTES, parseRepositoryId } from './collect-live-review-input.mjs';
import {
  loadModelTraceRecord,
  renderModelTraceDisclosure,
  assertModelTraceDisclosure,
  hasModelTraceDisclosure,
} from './modeltrace.mjs';
import {
  DOT_EXEMPTION,
  DOT_DISCLOSURE,
  isDotExemption,
  hasDotDisclosure,
  assertDotDisclosure,
} from './dot-exemption.mjs';

const COMMON = [
  '--record',
  '--context',
  '--mode',
  '--mode-source',
  '--authorization',
  '--repository',
];
const DOT_OPTIONS = ['--agent', '--dot-exemption'];
const OWNER_OPTIONS = ['--owner-authorization', '--owner-key', '--owner-grant'];
const OPTIONS = new Map([
  ['commit', [...COMMON, '--message-file', '--branch', '--expected-head', '--expected-tree']],
  ['issue create', [...COMMON, '--title', '--body-file']],
  ['pull-request create', [...COMMON, '--title', '--body-file', '--base', '--head']],
  ['comment', [...COMMON, '--number', '--body-file']],
  [
    'update-body',
    [...COMMON, '--number', '--body-file', '--target-updated-at', '--target-body-digest'],
  ],
]);
const VIEWER_QUERY = `query PublisherViewer($owner: String!, $name: String!) {
  viewer { login }
  repository(owner: $owner, name: $name) { nameWithOwner viewerPermission isArchived defaultBranchRef { name } }
}`;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const sameLogin = (a, b) =>
  typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export function parsePublishCli(argv) {
  const values = [...argv];
  if (values[0] === '--') values.shift();
  let command = values.shift();
  if (['issue', 'pull-request'].includes(command)) command += ` ${values.shift()}`;
  if (!OPTIONS.has(command))
    throw new Error(
      'supported commands: commit, issue create, pull-request create, comment, update-body'
    );
  if (values.length % 2 !== 0) throw new Error('each publisher option requires a value');
  const args = new Map();
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i];
    const value = values[i + 1];
    if (
      !OPTIONS.get(command).includes(key) &&
      !OWNER_OPTIONS.includes(key) &&
      !DOT_OPTIONS.includes(key)
    )
      throw new Error(`unexpected option: ${key}`);
    if (args.has(key)) throw new Error(`duplicate option: ${key}`);
    if (!value || value.startsWith('--')) throw new Error(`missing value: ${key}`);
    args.set(key, value);
  }
  // Declarations precede all artifact reads, git operations and network calls.
  for (const key of ['--mode', '--mode-source', '--authorization']) {
    if (!args.has(key)) throw new Error(`${key} is required`);
  }
  establishExecutionMode(args.get('--mode'), args.get('--mode-source'));
  const ownerOptions = OWNER_OPTIONS.filter((key) => args.has(key));
  if (ownerOptions.length !== 0 && ownerOptions.length !== OWNER_OPTIONS.length)
    throw new Error('all trusted owner launcher arguments are required');
  if (args.get('--authorization') === 'explicit-current-user') {
    if (args.get('--mode') !== 'human-assisted')
      throw new Error('autonomous execution cannot claim explicit-current-user authorization');
  } else if (
    ownerOptions.length !== OWNER_OPTIONS.length ||
    args.get('--authorization') !== args.get('--owner-grant')
  ) {
    throw new Error(
      'publisher requires explicit-current-user or verified owner delegation; generic standing scopes are not activated here'
    );
  }
  const dotExempt = isDotExemption(args);
  for (const key of OPTIONS.get(command)) {
    if (dotExempt && ['--record', '--context'].includes(key)) continue;
    if (!args.has(key)) throw new Error(`${key} is required`);
  }
  parseRepositoryId(args.get('--repository'));
  if (args.has('--number') && !/^[1-9][0-9]*$/.test(args.get('--number')))
    throw new Error('--number must be a positive integer');
  if (args.has('--number') && !Number.isSafeInteger(Number(args.get('--number'))))
    throw new Error('--number exceeds the safe integer range');
  if (command === 'update-body') {
    if (!/^[a-f0-9]{64}$/.test(args.get('--target-body-digest')))
      throw new Error('--target-body-digest must be a bare sha256 digest');
    if (!Number.isFinite(Date.parse(args.get('--target-updated-at'))))
      throw new Error('--target-updated-at must be an ISO timestamp');
  }
  if (command === 'commit' && !/^[a-f0-9]{40,64}$/.test(args.get('--expected-head')))
    throw new Error('--expected-head must be an exact commit SHA');
  if (command === 'commit' && !/^[a-f0-9]{40,64}$/.test(args.get('--expected-tree')))
    throw new Error('--expected-tree must be an exact authorized tree SHA');
  return { command, args };
}

function tools(options) {
  const runner = options.runner ?? execFileSync;
  const cwd = options.cwd ?? process.cwd();
  function run(binary, args, extra = {}) {
    const result = runner(binary, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_LIVE_RESPONSE_BYTES,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...extra,
    });
    return typeof result === 'string' ? result : result.toString('utf8');
  }
  function api(endpoint, { method, input, paginate = false } = {}) {
    const args = ['api'];
    if (method) args.push('--method', method);
    // Older supported gh clients lack --slurp. One compact JSON value per
    // page preserves literal body newlines and complete pagination portably.
    if (paginate) args.push('--paginate', '--jq', '. | @json');
    args.push(endpoint);
    if (input !== undefined) args.push('--input', '-');
    const text = run('gh', args, input === undefined ? {} : { input: JSON.stringify(input) });
    if (paginate) {
      if (!text.trim()) throw new Error('GitHub pagination returned no page evidence');
      const pages = text
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      if (paginate === 'pages') {
        if (!pages.every((page) => page && typeof page === 'object' && !Array.isArray(page)))
          throw new Error('GitHub pagination returned an invalid page shape');
        return pages;
      }
      if (!pages.every(Array.isArray))
        throw new Error('GitHub pagination returned an invalid shape');
      return pages.flat();
    }
    const payload = JSON.parse(text);
    if (payload?.errors?.length) throw new Error('GitHub returned GraphQL errors');
    return payload;
  }
  return { run, api, cwd };
}

function liveViewer(io, repositoryId) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const payload = io.api('graphql', {
    method: 'POST',
    input: { query: VIEWER_QUERY, variables: { owner, name } },
  });
  const repository = payload?.data?.repository;
  const login = payload?.data?.viewer?.login;
  if (!login || repository?.nameWithOwner?.toLowerCase() !== `${owner}/${name}`.toLowerCase())
    throw new Error('live repository or credential identity unavailable');
  if (
    !['READ', 'TRIAGE', 'WRITE', 'MAINTAIN', 'ADMIN'].includes(repository.viewerPermission) ||
    repository.isArchived
  )
    throw new Error('live repository access and credential identity required');
  if (!repository.defaultBranchRef?.name)
    throw new Error('repository default branch is unavailable');
  return {
    login,
    permission: repository.viewerPermission,
    defaultBranch: repository.defaultBranchRef.name,
  };
}

function assertSameViewer(first, latest) {
  if (
    !sameLogin(first.login, latest.login) ||
    first.permission !== latest.permission ||
    first.defaultBranch !== latest.defaultBranch
  ) {
    throw new Error('live credential, permission or repository binding changed before write');
  }
}

function checkoutRepository(io) {
  const remote = io
    .run('git', ['config', '--get', 'remote.origin.url'])
    .trim()
    .replace(/\.git$/, '');
  const match =
    remote.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/i) ??
    remote.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+\/[^/]+)$/i);
  if (!match) throw new Error('checkout requires an explicit github.com origin');
  return `github.com:${match[1]}`;
}

function localCommitBinding(io, args) {
  const repositoryId = args.get('--repository');
  if (checkoutRepository(io).toLowerCase() !== repositoryId.toLowerCase())
    throw new Error('commit repository differs from checkout origin');
  const { owner, name } = parseRepositoryId(repositoryId);
  const repository = io.api(`repos/${owner}/${name}`);
  if (
    typeof repository?.full_name !== 'string' ||
    repository.full_name.toLowerCase() !== `${owner}/${name}`.toLowerCase() ||
    typeof repository?.default_branch !== 'string' ||
    !repository.default_branch ||
    repository.default_branch.includes('@{')
  )
    throw new Error('live commit repository or default branch is unavailable');
  const defaultBranch = repository.default_branch;
  // --branch expands checkout shorthands; metadata must name a literal branch.
  io.run('git', ['check-ref-format', '--branch', defaultBranch]);
  const branch = io.run('git', ['symbolic-ref', '--short', 'HEAD']).trim();
  const head = io.run('git', ['rev-parse', 'HEAD']).trim();
  if (branch !== args.get('--branch') || head !== args.get('--expected-head'))
    throw new Error('local branch or exact HEAD binding changed');
  const tree = io.run('git', ['write-tree']).trim();
  if (tree !== args.get('--expected-tree'))
    throw new Error('staged index differs from the exact authorized tree');
  if (branch === defaultBranch)
    throw new Error(
      'commit requires the explicitly authorized contributor branch, not a default branch'
    );
  io.run('git', ['check-ref-format', '--branch', branch]);
  // Creating a local commit grants no GitHub privilege. The operator authorizes
  // this exact branch/head/tree; the configured signer still owns DCO responsibility.
  // Existing contributor history and protected push rules are not model identity.
  return { branch, head, tree, defaultBranch };
}

function assertPrivateCommitInputs(io, recordPath, contextPath) {
  const checkout = fs.realpathSync(io.run('git', ['rev-parse', '--show-toplevel']).trim());
  for (const input of [recordPath, contextPath]) {
    const relative = path.relative(checkout, fs.realpathSync(input));
    if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
      throw new Error('private ModelTrace record/context inputs must remain outside the checkout');
  }
}

function pullBinding(io, args, viewer) {
  const { owner, name } = parseRepositoryId(args.get('--repository'));
  const base = args.get('--base');
  const head = args.get('--head');
  const parts = head.split(':');
  if (parts.length > 2 || parts.some((part) => !part)) throw new Error('invalid PR source head');
  const branch = parts.at(-1);
  io.run('git', ['check-ref-format', '--branch', branch]);
  io.run('git', ['check-ref-format', '--branch', base]);
  const sourceOwner = parts.length === 2 ? parts[0] : owner;
  const sourceRepository = checkoutRepository(io);
  const source = parseRepositoryId(sourceRepository);
  if (!sameLogin(source.owner, sourceOwner))
    throw new Error('PR source repository differs from checkout origin');
  const liveSource = io.api(`repos/${source.owner}/${source.name}`);
  if (
    liveSource?.full_name?.toLowerCase() !==
    sourceRepository.slice('github.com:'.length).toLowerCase()
  )
    throw new Error('live PR source repository differs from checkout origin');
  if (
    liveSource.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase() &&
    (branch === base || branch === viewer.defaultBranch)
  )
    throw new Error('PR requires a distinct contributor head branch');
  if (io.run('git', ['symbolic-ref', '--short', 'HEAD']).trim() !== branch)
    throw new Error('PR head branch differs from checkout branch');
  const localSha = io.run('git', ['rev-parse', 'HEAD']).trim();
  const liveBranch = io.api(
    `repos/${source.owner}/${source.name}/branches/${encodeURIComponent(branch)}`
  );
  const baseBranch = io.api(`repos/${owner}/${name}/branches/${encodeURIComponent(base)}`);
  if (liveBranch?.commit?.sha !== localSha || !baseBranch?.commit?.sha)
    throw new Error('PR source must be pushed and bound to exact local HEAD/base');
  const comparisons = io.api(
    `repos/${owner}/${name}/compare/${baseBranch.commit.sha}...${localSha}?per_page=100`,
    { paginate: 'pages' }
  );
  const total = comparisons[0]?.total_commits;
  if (!Number.isSafeInteger(total) || total <= 0)
    throw new Error('complete PR contributor commit attribution is unavailable');
  const commits = new Set();
  let lastSha;
  for (const comparison of comparisons) {
    if (
      comparison.total_commits !== total ||
      !Array.isArray(comparison.commits) ||
      comparison.commits.length === 0 ||
      comparison.commits.length > 100
    )
      throw new Error('complete PR contributor commit attribution is unavailable');
    for (const commit of comparison.commits) {
      if (!/^[a-f0-9]{40,64}$/.test(commit?.sha ?? '') || commits.has(commit.sha))
        throw new Error('complete PR contributor commit attribution is unavailable');
      commits.add(commit.sha);
      lastSha = commit.sha;
    }
    if (commits.size > total)
      throw new Error('complete PR contributor commit attribution is unavailable');
  }
  if (commits.size !== total || lastSha !== localSha)
    throw new Error('complete PR contributor commit attribution is unavailable');
  return {
    headSha: localSha,
    baseSha: baseBranch.commit.sha,
    sourceRepository: liveSource.full_name.toLowerCase(),
  };
}

function target(io, endpoint, number) {
  const item = io.api(`${endpoint}/issues/${number}`);
  if (
    item?.number !== number ||
    !item.node_id ||
    typeof item.updated_at !== 'string' ||
    (item.body !== null && typeof item.body !== 'string')
  )
    throw new Error('live target binding is incomplete');
  return item;
}

function assertTarget(first, latest) {
  for (const key of ['node_id', 'updated_at', 'body', 'state', 'locked']) {
    if (first[key] !== latest[key]) throw new Error(`target ${key} changed before write`);
  }
  if (!sameLogin(first.user?.login, latest.user?.login))
    throw new Error('target author changed before write');
}

function exactPublished(item, body, viewer, expected = {}) {
  if (!sameLogin(item?.user?.login, viewer.login) || item.body !== body)
    throw new Error(
      'published marker exists but full body or author does not match; refusing duplicate publication'
    );
  for (const [key, value] of Object.entries(expected))
    if (item[key] !== value) throw new Error(`published ${key} does not match`);
  return item;
}

export class PublicationUnknown extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicationUnknown';
  }
}

export function runCommitMessageHook(messagePath, options = {}) {
  const environment = options.env ?? process.env;
  if (environment.PUI_AGENT !== '1') return { status: 'human-exempt' };
  if (
    environment.PUI_AGENT_NAME !== undefined ||
    environment.PUI_DOT_MODELTRACE_EXEMPTION !== undefined
  ) {
    const declarations = new Map([
      ['--agent', environment.PUI_AGENT_NAME],
      ['--dot-exemption', environment.PUI_DOT_MODELTRACE_EXEMPTION],
    ]);
    if (environment.PUI_MODELTRACE_RECORD)
      declarations.set('--record', environment.PUI_MODELTRACE_RECORD);
    if (environment.PUI_MODELTRACE_CONTEXT)
      declarations.set('--context', environment.PUI_MODELTRACE_CONTEXT);
    isDotExemption(declarations);
    assertDotDisclosure(fs.readFileSync(messagePath, 'utf8'), 'commit');
    return {
      status: 'validated',
      agent: 'dot',
      modelTrace: 'not-measured',
      exemption: DOT_EXEMPTION,
    };
  }
  if (!environment.PUI_MODELTRACE_RECORD || !environment.PUI_MODELTRACE_CONTEXT)
    throw new Error('Agent commit requires PUI_MODELTRACE_RECORD and PUI_MODELTRACE_CONTEXT');
  const io = tools(options);
  const repositoryId = checkoutRepository(io);
  const receipt = loadModelTraceRecord({
    recordPath: environment.PUI_MODELTRACE_RECORD,
    contextPath: environment.PUI_MODELTRACE_CONTEXT,
    repositoryId,
    now: options.now ?? new Date(),
  });
  const message = fs.readFileSync(messagePath, 'utf8');
  const trailers = message.split(/\r?\n/).filter((line) => line.startsWith('ModelTrace:'));
  if (trailers.length !== 1)
    throw new Error('Agent commit requires exactly one ModelTrace trailer');
  if (trailers[0] !== renderModelTraceDisclosure(receipt, 'commit'))
    throw new Error('Agent commit ModelTrace trailer is not the exact current disclosure');
  assertModelTraceDisclosure(message, receipt, 'commit');
  return { status: 'validated' };
}

export function runPublishCli(argv, options = {}) {
  const { command, args } = parsePublishCli(argv);
  const repositoryId = args.get('--repository');
  const ownerAuthorization = ownerAuthorizationFromArgs(args);
  const authorize = (scopeId, actor) => {
    if (args.get('--authorization') === 'explicit-current-user') return;
    if (
      !ownerAuthorizationAllows(ownerAuthorization, {
        repositoryId,
        scopeId,
        action: command === 'commit' ? 'implement' : 'collaborate',
        actor,
        authorizationId: args.get('--authorization'),
        executionMode: args.get('--mode'),
        executionModeSource: args.get('--mode-source'),
      })
    )
      throw new Error('publisher owner delegation does not authorize this exact operation');
  };
  const dotExempt = isDotExemption(args);
  const recordPath = dotExempt ? null : path.resolve(args.get('--record'));
  const contextPath = dotExempt ? null : path.resolve(args.get('--context'));
  const renderDisclosure = (receipt, format) =>
    dotExempt ? DOT_DISCLOSURE : renderModelTraceDisclosure(receipt, format);
  const hasDisclosure = (text, receipt, format) =>
    dotExempt ? hasDotDisclosure(text, format) : hasModelTraceDisclosure(text, receipt, format);
  const assertDisclosure = (text, receipt, format) =>
    dotExempt
      ? assertDotDisclosure(text, format)
      : assertModelTraceDisclosure(text, receipt, format);
  // Recompute the private raw samples. Never substitute a system/harness model.
  const measure = (fresh = true) =>
    dotExempt
      ? null
      : loadModelTraceRecord({
          recordPath,
          contextPath,
          repositoryId,
          now: options.now ?? new Date(),
          fresh,
        });
  // GitHub reconciliation is read-only and must retain the original disclosure
  // after expiry. Commits have no historical reconciliation and stay fresh.
  const receipt = measure(command === 'commit');
  const io = tools(options);
  if (command === 'commit') {
    if (!dotExempt) assertPrivateCommitInputs(io, recordPath, contextPath);
    const binding = localCommitBinding(io, args);
    // Local commits and new GitHub objects have no existing numbered target.
    // Owner delegation must explicitly grant the repository portfolio for them.
    authorize();
    const prepared = fs.readFileSync(args.get('--message-file'), 'utf8');
    if (
      !prepared.trim() ||
      /^ModelTrace:/m.test(prepared) ||
      (dotExempt && /^[\t ]*(?:Agent|ModelTrace):/im.test(prepared))
    )
      throw new Error(
        'prepared commit message must be nonempty and have no existing ModelTrace trailer'
      );
    const message = `${prepared.trimEnd()}\n\n${renderDisclosure(receipt, 'commit')}\n`;
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'pui-agent-commit-'));
    try {
      const messagePath = path.join(directory, 'message');
      fs.writeFileSync(messagePath, message, { mode: 0o600 });
      const commitEnvironment = {
        ...process.env,
        GIT_INDEX_FILE: path.join(directory, 'index'),
        PUI_AGENT: '1',
        PUI_AGENT_NAME: dotExempt ? 'dot' : undefined,
        PUI_DOT_MODELTRACE_EXEMPTION: dotExempt ? DOT_EXEMPTION : undefined,
        PUI_MODELTRACE_RECORD: recordPath ?? undefined,
        PUI_MODELTRACE_CONTEXT: contextPath ?? undefined,
      };
      io.run('git', ['read-tree', binding.tree], { env: commitEnvironment });
      assertDisclosure(message, measure(), 'commit');
      if (JSON.stringify(localCommitBinding(io, args)) !== JSON.stringify(binding))
        throw new Error(
          'commit branch, HEAD, staged tree or repository default changed before write'
        );
      if (!dotExempt) assertPrivateCommitInputs(io, recordPath, contextPath);
      authorize();
      let output;
      try {
        output = io.run(
          'git',
          ['commit', '--signoff', '--cleanup=verbatim', '--file', messagePath],
          {
            env: commitEnvironment,
          }
        );
      } catch {
        throw new PublicationUnknown(
          'git commit failed or outcome is unknown; inspect local HEAD before any retry'
        );
      }
      let head;
      try {
        head = io.run('git', ['rev-parse', 'HEAD']).trim();
        if (io.run('git', ['rev-parse', `${head}^1`]).trim() !== binding.head)
          throw new PublicationUnknown(
            'committed first parent differs from the exact authorized HEAD; inspect local history before any retry'
          );
        const commitObject = io.run('git', ['cat-file', 'commit', head]);
        const messageStart = commitObject.indexOf('\n\n');
        const committer = commitObject
          .slice(0, messageStart)
          .match(/^committer (.+) -?\d+ [+-]\d{4}$/m)?.[1];
        if (messageStart < 0 || !committer)
          throw new Error('committed object body or committer is unavailable');
        // Git starts a trailer block after dot's plain-language limitation line.
        const expectedCommitted = `${message}${dotExempt ? '\n' : ''}Signed-off-by: ${committer}\n`;
        if (commitObject.slice(messageStart + 2) !== expectedCommitted)
          throw new PublicationUnknown(
            'committed message differs from the authorized preparation plus sign-off; inspect local HEAD before any retry'
          );
        if (io.run('git', ['rev-parse', `${head}^{tree}`]).trim() !== binding.tree)
          throw new PublicationUnknown(
            'committed tree differs from authorization; inspect local HEAD and index before any retry'
          );
      } catch (error) {
        if (error instanceof PublicationUnknown) throw error;
        throw new PublicationUnknown(
          'git commit completed but exact commit readback is unknown; inspect local HEAD before any retry'
        );
      }
      return {
        status: 'published',
        command,
        output,
        head,
      };
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  const viewer = liveViewer(io, repositoryId);
  const { owner, name } = parseRepositoryId(repositoryId);
  const endpoint = `repos/${owner}/${name}`;
  const prepared = fs.readFileSync(args.get('--body-file'), 'utf8');
  if (!prepared.trim()) throw new Error('prepared body must be nonempty');
  const exactPrepared = hasDisclosure(prepared, receipt);
  if (!exactPrepared && /<!-- proto-ui-agent-publication:/i.test(prepared))
    throw new Error('undisclosed prepared body must not forge a publication marker');
  const number = args.has('--number') ? Number(args.get('--number')) : null;
  let before = number === null ? null : target(io, endpoint, number);
  const branch = command === 'pull-request create' ? pullBinding(io, args, viewer) : null;
  const scopeId = before
    ? ownerCollaborationScope({
        target: { kind: before.pull_request ? 'pull-request' : 'issue', number },
      })
    : undefined;
  authorize(scopeId, viewer.login);
  const publicationDigest = sha256(
    JSON.stringify({
      repositoryId: repositoryId.toLowerCase(),
      command,
      number,
      title: args.get('--title') ?? null,
      base: args.get('--base') ?? null,
      head: args.get('--head') ?? null,
      ...(branch ?? {}),
      prepared,
    })
  );
  const marker = exactPrepared ? null : `<!-- proto-ui-agent-publication:${publicationDigest} -->`;
  // Evidence-publication approval binds exact bytes. Already disclosed prepared
  // bodies must not be silently reformatted or gain another marker/disclosure.
  const body = exactPrepared
    ? prepared
    : dotExempt
      ? `${renderDisclosure(receipt, 'markdown')}\n\n${prepared}${prepared.endsWith('\n') ? '\n' : '\n\n'}${marker}\n`
      : `${prepared}${prepared.endsWith('\n') ? '\n' : '\n\n'}${renderDisclosure(receipt, 'markdown')}\n\n${marker}\n`;
  if (before?.locked) throw new Error('target is locked');
  if (command === 'update-body' && !sameLogin(before.user?.login, viewer.login))
    throw new Error('body replacement requires a credential-owned Issue or PR');
  function samePullBinding(pull) {
    return (
      pull.base?.ref === args.get('--base') &&
      pull.base?.sha === branch.baseSha &&
      pull.head?.ref === args.get('--head').split(':').at(-1) &&
      pull.head?.sha === branch.headSha &&
      pull.head?.repo?.full_name?.toLowerCase() === branch.sourceRepository
    );
  }
  function findPublished() {
    if (command === 'update-body') {
      const current = target(io, endpoint, number);
      return (marker === null ? current.body === body : current.body?.includes(marker))
        ? exactPublished(current, body, viewer)
        : null;
    }
    const route =
      command === 'comment'
        ? `${endpoint}/issues/${number}/comments?per_page=100`
        : `${endpoint}/issues?state=all&creator=${encodeURIComponent(viewer.login)}&per_page=100`;
    let items = io
      .api(route, { paginate: true })
      .filter(
        (item) =>
          typeof item.body === 'string' &&
          (marker === null ? item.body === body : item.body.includes(marker))
      );
    // An approved immutable body has no added marker. Bind those matches to
    // actual PR revisions rather than borrowing an older closed PR's bytes.
    if (marker === null && branch)
      items = items.filter(
        (item) => item.pull_request && samePullBinding(io.api(`${endpoint}/pulls/${item.number}`))
      );
    if (marker === null && command === 'issue create')
      items = items.filter((item) => !item.pull_request && item.title === args.get('--title'));
    if (items.length > 1)
      throw new Error('multiple publication markers exist; refusing duplicate publication');
    if (!items.length) return null;
    const item =
      command === 'comment'
        ? io.api(`${endpoint}/issues/comments/${items[0].id}`)
        : target(io, endpoint, items[0].number);
    exactPublished(
      item,
      body,
      viewer,
      command.endsWith(' create') ? { title: args.get('--title') } : {}
    );
    if (command === 'issue create' && item.pull_request)
      throw new Error('publication marker belongs to a PR, not an Issue');
    if (command === 'pull-request create') {
      if (!item.pull_request) throw new Error('publication marker belongs to an Issue, not a PR');
      const pull = io.api(`${endpoint}/pulls/${item.number}`);
      if (!samePullBinding(pull)) throw new Error('existing PR head/base binding changed');
      // PR and backing Issue IDs are different GitHub platform objects.
      // Match a PR creation acknowledgement to the re-read PR, not its Issue.
      return exactPublished(pull, body, viewer, {
        number: item.number,
        title: args.get('--title'),
      });
    }
    return item;
  }
  const existing = findPublished();
  if (existing)
    return { status: 'already-published', command, publicationDigest, url: existing.html_url };
  if (
    command === 'update-body' &&
    (before.updated_at !== args.get('--target-updated-at') ||
      sha256(before.body ?? '') !== args.get('--target-body-digest'))
  )
    throw new Error('prepared body replacement does not match exact current target');
  assertSameViewer(viewer, liveViewer(io, repositoryId));
  if (before) {
    const latest = target(io, endpoint, number);
    assertTarget(before, latest);
    before = latest;
  }
  if (branch && JSON.stringify(pullBinding(io, args, viewer)) !== JSON.stringify(branch))
    throw new Error('PR head/base changed before write');
  if (findPublished())
    throw new Error('publication appeared during preflight; rerun read-only reconciliation');
  authorize(scopeId, viewer.login);
  let route;
  let method = 'POST';
  let input = { body };
  if (command === 'issue create') {
    route = `${endpoint}/issues`;
    input.title = args.get('--title');
  }
  if (command === 'pull-request create') {
    route = `${endpoint}/pulls`;
    input = {
      ...input,
      title: args.get('--title'),
      base: args.get('--base'),
      head: args.get('--head'),
    };
    if (branch.sourceRepository !== `${owner}/${name}`.toLowerCase())
      input.head_repo = branch.sourceRepository.split('/')[1];
  }
  if (command === 'comment') route = `${endpoint}/issues/${number}/comments`;
  if (command === 'update-body') {
    route = `${endpoint}/issues/${number}`;
    method = 'PATCH';
  }
  // Historical admission never authorizes a write. Re-read the original record
  // with current freshness immediately before the single mutation attempt.
  assertDisclosure(body, measure(), 'markdown');
  let acknowledged;
  try {
    // Exactly one mutation. Transport/JSON failure may mean it succeeded.
    acknowledged = io.api(route, { method, input });
  } catch {
    let observed = null;
    try {
      observed = findPublished();
    } catch {
      /* The write remains unknown; never retry a mutation. */
    }
    throw new PublicationUnknown(
      observed
        ? `An exact matching publication is observed at ${observed.html_url}, but the lost acknowledgement cannot attribute it to this invocation; no retry was attempted`
        : 'GitHub publication outcome is unknown; reconcile the digest marker and exact full body before any new write'
    );
  }
  try {
    if (!acknowledged?.id) throw new Error('mutation acknowledgement is incomplete');
    const published = findPublished();
    if (!published || published.id !== acknowledged.id)
      throw new Error('publication readback does not match acknowledgement');
    return { status: 'published', command, publicationDigest, url: published.html_url };
  } catch {
    throw new PublicationUnknown(
      'GitHub acknowledged publication but exact full-body readback is unknown; no retry was attempted'
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    const result =
      argv[0] === 'check-commit-message'
        ? argv.length === 3 && argv[1] === '--message-file'
          ? runCommitMessageHook(argv[2])
          : (() => {
              throw new Error('check-commit-message requires only --message-file');
            })()
        : runPublishCli(argv);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
