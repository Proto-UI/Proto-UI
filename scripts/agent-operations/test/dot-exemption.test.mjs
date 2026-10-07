import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DOT_DISCLOSURE,
  DOT_EXEMPTION,
  isDotExemption,
  hasDotDisclosure,
  assertDotDisclosure,
} from '../dot-exemption.mjs';
import { parsePublishCli, runCommitMessageHook, runPublishCli } from '../agent-publish.mjs';

// Synthetic transport fixtures below test policy and receipts. They are never
// live publication evidence, and no test creates or scores a ModelTrace sample.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REPO = 'github.com:fixture-owner/fixture-repo';
const COMMON = [
  '--mode',
  'human-assisted',
  '--mode-source',
  'current-user',
  '--authorization',
  'explicit-current-user',
  '--repository',
  REPO,
];
const DOT = ['--agent', 'dot', '--dot-exemption', DOT_EXEMPTION];
const COMMENT = ['comment', ...COMMON, ...DOT, '--number', '7', '--body-file', '/unused'];
const environment = {
  PUI_AGENT: '1',
  PUI_AGENT_NAME: 'dot',
  PUI_DOT_MODELTRACE_EXEMPTION: DOT_EXEMPTION,
};

function files(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dot-exemption-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const body = path.join(directory, 'body.txt');
  fs.writeFileSync(body, 'Synthetic test content.\n');
  return { directory, body };
}

test('dot declaration is explicit and mutually exclusive with a measured record', () => {
  assert.equal(isDotExemption(new Map()), false);
  assert.equal(
    isDotExemption(
      new Map([
        ['--agent', 'dot'],
        ['--dot-exemption', DOT_EXEMPTION],
      ])
    ),
    true
  );
  assert.equal(parsePublishCli(COMMENT).args.get('--agent'), 'dot');
});

for (const [name, change] of [
  [
    'missing agent',
    (args) =>
      args.filter((_, i) => i !== args.indexOf('--agent') && i !== args.indexOf('--agent') + 1),
  ],
  [
    'missing exemption',
    (args) =>
      args.filter(
        (_, i) => i !== args.indexOf('--dot-exemption') && i !== args.indexOf('--dot-exemption') + 1
      ),
  ],
  ['unknown agent', (args) => args.map((x) => (x === 'dot' ? 'another-agent' : x))],
  ['unknown exemption', (args) => args.map((x) => (x === DOT_EXEMPTION ? 'unapproved' : x))],
  ['duplicate exemption', (args) => [...args, '--dot-exemption', DOT_EXEMPTION]],
  ['measured record', (args) => [...args, '--record', '/unused']],
  ['measured context', (args) => [...args, '--context', '/unused']],
  [
    'missing authorization',
    (args) =>
      args.filter(
        (_, i) => i !== args.indexOf('--authorization') && i !== args.indexOf('--authorization') + 1
      ),
  ],
  [
    'unapproved authorization',
    (args) => args.map((x) => (x === 'explicit-current-user' ? 'dot-authorizes-itself' : x)),
  ],
  ['wrong execution mode', (args) => args.map((x) => (x === 'human-assisted' ? 'autonomous' : x))],
])
  test(`rejects ${name} before any IO`, () =>
    assert.throws(() => parsePublishCli(change(COMMENT))));

test('non-dot callers still require record and context, never label fallback', () => {
  const args = COMMENT.filter(
    (_, i) => i < COMMENT.indexOf('--agent') || i > COMMENT.indexOf('--dot-exemption') + 1
  );
  assert.throws(() => parsePublishCli(args), /--record is required/);
  assert.throws(() => parsePublishCli([...args, '--record', '/unused']), /--context is required/);
  assert.equal(
    parsePublishCli([...args, '--record', '/unused', '--context', '/unused']).command,
    'comment'
  );
});

test('visible dot Markdown and exact commit declaration pass without a model receipt', () => {
  assertDotDisclosure(`${DOT_DISCLOSURE}\n\nBody.\n`);
  assertDotDisclosure(
    `Commit subject\n\n${DOT_DISCLOSURE}\n\nSigned-off-by: Test <test@example.invalid>\n`,
    'commit'
  );
});
for (const [name, text] of [
  ['missing', 'Plain body'],
  ['quoted', `> ${DOT_DISCLOSURE}`],
  ['code fence', `\`\`\`text\n${DOT_DISCLOSURE}\n\`\`\``],
  ['HTML comment', `<!--\n${DOT_DISCLOSURE}\n-->`],
  ['HTML hidden', `<div hidden>\n\n${DOT_DISCLOSURE}\n\n</div>`],
  ['duplicated', `${DOT_DISCLOSURE}\n\n${DOT_DISCLOSURE}`],
  ['wrong role', DOT_DISCLOSURE.replace('Agent: dot', 'Agent: other')],
  ['fake fingerprint', `${DOT_DISCLOSURE}\n\n## ModelTrace\n\n{"modelId":"fake"}`],
])
  test(`rejects ${name} disclosure`, () => assert.throws(() => assertDotDisclosure(text)));

test('commit hook validates dot declaration and rejects mixed/partial inputs', (t) => {
  const f = files(t);
  fs.writeFileSync(f.body, `Subject\n\n${DOT_DISCLOSURE}\n`);
  assert.equal(runCommitMessageHook(f.body, { env: environment }).agent, 'dot');
  assert.throws(
    () =>
      runCommitMessageHook(f.body, { env: { ...environment, PUI_MODELTRACE_RECORD: '/unused' } }),
    /must not be combined/
  );
  assert.throws(
    () => runCommitMessageHook(f.body, { env: { PUI_AGENT: '1', PUI_AGENT_NAME: 'dot' } }),
    /requires/
  );
  assert.throws(
    () => runCommitMessageHook(f.body, { env: { PUI_AGENT: '1' } }),
    /PUI_MODELTRACE_RECORD/
  );
  fs.writeFileSync(f.body, 'No declaration');
  assert.throws(() => runCommitMessageHook(f.body, { env: environment }), /missing/);
  assert.equal(runCommitMessageHook('/unused', { env: {} }).status, 'human-exempt');
});

for (const field of [' Agent: other', '\tAgent: other', ' ModelTrace: fake', '\tModelTrace: fake'])
  test(`commit disclosure and native hook reject indented field: ${JSON.stringify(field)}`, (t) => {
    const f = files(t);
    fs.writeFileSync(f.body, `Subject\n\n${DOT_DISCLOSURE}\n\n${field}\n`);
    assert.throws(() => assertDotDisclosure(fs.readFileSync(f.body, 'utf8'), 'commit'), /exact/);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          path.join(ROOT, 'scripts/agent-operations/agent-publish.mjs'),
          'check-commit-message',
          '--message-file',
          f.body,
        ],
        { env: { ...process.env, ...environment }, stdio: 'pipe' }
      )
    );
  });

test('native dot hook omits undefined measured env values and rejects actual string values', (t) => {
  const f = files(t);
  fs.writeFileSync(f.body, `Subject\n\n${DOT_DISCLOSURE}\n`);
  const argv = [
    path.join(ROOT, 'scripts/agent-operations/agent-publish.mjs'),
    'check-commit-message',
    '--message-file',
    f.body,
  ];
  const env = {
    ...process.env,
    ...environment,
    PUI_MODELTRACE_RECORD: undefined,
    PUI_MODELTRACE_CONTEXT: undefined,
  };
  execFileSync(process.execPath, argv, { env, stdio: 'pipe' });
  assert.throws(() =>
    execFileSync(process.execPath, argv, {
      env: { ...env, PUI_MODELTRACE_RECORD: 'undefined' },
      stdio: 'pipe',
    })
  );
});

function syntheticCommentServer({ drift = false, unknown = false, actorDrift = false } = {}) {
  let targetReads = 0;
  let viewerReads = 0;
  const comments = [];
  let writes = 0;
  const target = {
    number: 7,
    node_id: 'I_synthetic',
    body: 'Original',
    state: 'open',
    locked: false,
    updated_at: '2026-10-06T00:00:00Z',
    user: { login: 'synthetic-user' },
  };
  const runner = (binary, args, options = {}) => {
    assert.equal(binary, 'gh');
    const endpoint = args.find((arg) => arg === 'graphql' || arg.startsWith('repos/'));
    const method = args.includes('--method') ? args[args.indexOf('--method') + 1] : 'GET';
    if (endpoint === 'graphql')
      return JSON.stringify({
        data: {
          viewer: { login: actorDrift && ++viewerReads > 1 ? 'different-user' : 'synthetic-user' },
          repository: {
            nameWithOwner: 'fixture-owner/fixture-repo',
            viewerPermission: 'WRITE',
            isArchived: false,
            defaultBranchRef: { name: 'main' },
          },
        },
      });
    if (method === 'POST') {
      writes++;
      const item = {
        id: 91,
        body: JSON.parse(options.input).body,
        user: { login: 'synthetic-user' },
        html_url: 'fixture://comment/91',
      };
      comments.push(item);
      if (unknown) throw new Error('synthetic lost acknowledgement');
      return JSON.stringify(item);
    }
    if (endpoint.endsWith('/issues/7'))
      return JSON.stringify({
        ...target,
        body: drift && ++targetReads > 1 ? 'Changed' : 'Original',
      });
    if (endpoint.includes('/comments?')) return JSON.stringify(comments);
    if (endpoint.endsWith('/issues/comments/91')) return JSON.stringify(comments[0]);
    throw new Error(`Unimplemented synthetic endpoint ${endpoint}`);
  };
  return { runner, comments, writes: () => writes };
}

test('dot publication keeps actual preflight order, one write, readback and idempotency', (t) => {
  const f = files(t),
    server = syntheticCommentServer();
  const args = COMMENT.map((x) => (x === '/unused' ? f.body : x));
  assert.equal(runPublishCli(args, { runner: server.runner }).status, 'published');
  assert.equal(server.writes(), 1);
  assertDotDisclosure(server.comments[0].body);
  assert.equal(runPublishCli(args, { runner: server.runner }).status, 'already-published');
  assert.equal(server.writes(), 1);
});
for (const change of [{ drift: true }, { actorDrift: true }])
  test(`dot exception does not bypass live drift: ${JSON.stringify(change)}`, (t) => {
    const f = files(t),
      server = syntheticCommentServer(change);
    assert.throws(
      () =>
        runPublishCli(
          COMMENT.map((x) => (x === '/unused' ? f.body : x)),
          { runner: server.runner }
        ),
      /changed/
    );
    assert.equal(server.writes(), 0);
  });
test('dot exception never retries uncertain writes', (t) => {
  const f = files(t),
    server = syntheticCommentServer({ unknown: true });
  assert.throws(
    () =>
      runPublishCli(
        COMMENT.map((x) => (x === '/unused' ? f.body : x)),
        { runner: server.runner }
      ),
    /no retry/
  );
  assert.equal(server.writes(), 1);
});

test('real local commit preserves exact tree/head, runs the hook and adds own DCO', (t) => {
  const f = files(t),
    checkout = path.join(f.directory, 'repo');
  fs.mkdirSync(checkout);
  const git = (...args) =>
    execFileSync('git', args, { cwd: checkout, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'work');
  git('config', 'user.name', 'Synthetic Contributor');
  git('config', 'user.email', 'synthetic@example.invalid');
  git('remote', 'add', 'origin', 'https://github.com/fixture-owner/fixture-repo.git');
  fs.writeFileSync(path.join(checkout, 'file.txt'), 'before\n');
  git('add', 'file.txt');
  git('commit', '-m', 'Synthetic baseline');
  const head = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(checkout, 'file.txt'), 'after\n');
  git('add', 'file.txt');
  const tree = git('write-tree');
  fs.symlinkSync(path.join(ROOT, 'scripts'), path.join(checkout, 'scripts'), 'dir');
  const hooks = path.join(checkout, '.test-hooks');
  fs.mkdirSync(hooks);
  fs.copyFileSync(path.join(ROOT, '.husky/commit-msg'), path.join(hooks, 'commit-msg'));
  fs.chmodSync(path.join(hooks, 'commit-msg'), 0o755);
  git('config', 'core.hooksPath', hooks);
  let commitAttempts = 0;
  const runner = (binary, args, options) => {
    if (binary === 'gh')
      return JSON.stringify({ full_name: 'fixture-owner/fixture-repo', default_branch: 'main' });
    if (args[0] === 'commit') {
      commitAttempts++;
      const child = execFileSync(
        process.execPath,
        [
          '-e',
          "console.log(JSON.stringify({agent:process.env.PUI_AGENT_NAME,record:Object.hasOwn(process.env,'PUI_MODELTRACE_RECORD'),context:Object.hasOwn(process.env,'PUI_MODELTRACE_CONTEXT')}))",
        ],
        { env: options.env, encoding: 'utf8' }
      );
      assert.deepEqual(JSON.parse(child), { agent: 'dot', record: false, context: false });
    }
    return execFileSync(binary, args, { ...options, cwd: checkout });
  };
  const args = [
    'commit',
    ...COMMON,
    ...DOT,
    '--message-file',
    f.body,
    '--branch',
    'work',
    '--expected-head',
    head,
    '--expected-tree',
    tree,
  ];
  for (const field of [
    ' Agent: other',
    '\tAgent: other',
    ' ModelTrace: fake',
    '\tModelTrace: fake',
  ]) {
    fs.writeFileSync(f.body, `Subject\n\n${field}\n`);
    assert.throws(() => runPublishCli(args, { cwd: checkout, runner }), /prepared commit message/);
    assert.equal(commitAttempts, 0);
    assert.equal(git('rev-parse', 'HEAD'), head);
  }
  fs.writeFileSync(f.body, 'Subject\n\n  Ordinary indented body.\n');
  const result = runPublishCli(args, { cwd: checkout, runner });
  assert.equal(result.status, 'published');
  assert.equal(commitAttempts, 1);
  assert.equal(git('rev-parse', 'HEAD^1'), head);
  assert.equal(git('rev-parse', 'HEAD^{tree}'), tree);
  const message = git('log', '-1', '--format=%B');
  assertDotDisclosure(message, 'commit');
  assert.match(message, /Signed-off-by: Synthetic Contributor <synthetic@example.invalid>/);
  assert.throws(() => runPublishCli(args, { cwd: checkout, runner }), /HEAD binding changed/);
});

test('only visible standalone disclosure blocks identify dot in Markdown', () => {
  for (const body of [
    'Agent: browser',
    `\`\`\`text\n${DOT_DISCLOSURE}\n\`\`\``,
    `> ${DOT_DISCLOSURE.replaceAll('\n', '\n> ')}`,
    `<pre>\n${DOT_DISCLOSURE}\n</pre>`,
    `<!--\n${DOT_DISCLOSURE}\n-->`,
    `<div hidden>\n\n${DOT_DISCLOSURE}\n\n</div>`,
  ]) {
    assert.equal(hasDotDisclosure(body), false);
    assertDotDisclosure(`${DOT_DISCLOSURE}\n\n${body}`);
  }
  assertDotDisclosure(`Approved body.\n\n${DOT_DISCLOSURE}`);
  assert.throws(() =>
    assertDotDisclosure(`${DOT_DISCLOSURE}\n\n ${DOT_DISCLOSURE.replaceAll('\n', '\n ')}`)
  );
});

for (const evidence of [
  'Agent: browser',
  `\`\`\`text\n${DOT_DISCLOSURE}\n\`\`\``,
  `<pre>\n${DOT_DISCLOSURE}\n</pre>`,
])
  test(`publisher preserves ordinary or quoted evidence: ${evidence.slice(0, 20)}`, (t) => {
    const f = files(t),
      server = syntheticCommentServer();
    fs.writeFileSync(f.body, evidence);
    const args = COMMENT.map((x) => (x === '/unused' ? f.body : x));
    assert.equal(runPublishCli(args, { runner: server.runner }).status, 'published');
    assert.equal(server.writes(), 1);
    assert(server.comments[0].body.includes(evidence));
    assertDotDisclosure(server.comments[0].body);
  });

for (const body of [
  'Agent: dot',
  DOT_DISCLOSURE.split('\n')[1],
  'Agent: dot\n\n' + DOT_DISCLOSURE.split('\n').slice(1).join('\n'),
  'Agent: dot\nModelTrace: unknown',
  '<div><h2>ModelTrace</h2><p>Claimed fingerprint</p></div>',
  '<section><div><p>' + DOT_DISCLOSURE.replaceAll('\n', '<br>') + '</p></div></section>',
  '<div>' + DOT_DISCLOSURE.replaceAll('\n', '<br>') + '</div>',
  '</div>\nAgent: dot<br>ModelTrace: fake',
  '</div>\nAgent: <em>dot</em><br>ModelTrace: fake',
  '</div>\n<p>Ordinary content</p>Agent: dot',
  '| Agent: dot |\n| --- |\n| ModelTrace: fake |',
  '| Ordinary header |\n| --- |\n| ModelTrace: fake |',
  '| Ordinary | Agent: dot |\n| --- | --- |\n| Value | Other |',
  'Claim[^1]\n\n[^1]: Agent: dot',
  'Claim[^1]\n\n[^1]: ModelTrace: fake',
  'Claim[^1]\n\n[^1]: ## ModelTrace',
  '![ModelTrace: fake](missing.png)',
  '![Agent: dot](missing.png)',
  '<img src="missing.png" alt="Agent: dot">',
  '<img src="missing.png" alt="ModelTrace: fake">',
  '# ModelTrace\n\nClaimed fingerprint',
  '### ModelTrace\n\nClaimed fingerprint',
  '## modeltrace\n\nClaimed fingerprint',
])
  test(`partial or nested visible identity is rejected: ${body.slice(0, 32)}`, (t) => {
    const f = files(t),
      server = syntheticCommentServer();
    fs.writeFileSync(f.body, body);
    const args = COMMENT.map((x) => (x === '/unused' ? f.body : x));
    assert.throws(() => runPublishCli(args, { runner: server.runner }), /disclosure|receipt/);
    assert.equal(server.writes(), 0);
    assert.throws(() => assertDotDisclosure(`${DOT_DISCLOSURE}\n\n${body}`));
  });

test('nested explicit examples are retained without becoming a second identity', () => {
  for (const body of [
    '<div><pre>' + DOT_DISCLOSURE + '</pre></div>',
    '<div><blockquote><h2>ModelTrace</h2><p>Example</p></blockquote></div>',
    '<div hidden><h2>ModelTrace</h2><p>Hidden example</p></div>',
    '<div><code>' + DOT_DISCLOSURE + '</code></div>',
  ]) {
    assert.equal(hasDotDisclosure(body), false);
    assertDotDisclosure(`${DOT_DISCLOSURE}\n\n${body}`);
  }
});

test('GFM tables and raw-root ordinary fields remain evidence without attribution', (t) => {
  for (const body of [
    '| Task | Value |\n| --- | --- |\n| Agent: browser | Ready |',
    '| Code example |\n| --- |\n| `Agent: dot` |\n| `ModelTrace: fake` |',
    '> | Agent: dot |\n> | --- |\n> | ModelTrace: fake |',
    '</div>\nAgent: browser<br>Ordinary content',
    'Claim[^1]\n\n[^1]: Agent: browser',
    'Claim[^1]\n\n[^1]: `Agent: dot`',
    '![Ordinary screenshot](missing.png)',
    '> ![ModelTrace: fake](missing.png)',
    '`![ModelTrace: fake](missing.png)`',
    '<div hidden><img alt="Agent: dot" src="missing.png"></div>',
    '## ModelTrace usage notes\n\nDocumentation topic.',
  ]) {
    assert.equal(hasDotDisclosure(body), false);
    const f = files(t),
      server = syntheticCommentServer();
    fs.writeFileSync(f.body, body);
    const args = COMMENT.map((x) => (x === '/unused' ? f.body : x));
    assert.equal(runPublishCli(args, { runner: server.runner }).status, 'published');
    assert.equal(server.writes(), 1);
    assert(server.comments[0].body.includes(body));
    assertDotDisclosure(server.comments[0].body);
  }
});

test('all Markdown and HTML heading levels reserve the case-insensitive receipt title', () => {
  for (let level = 1; level <= 6; level++) {
    for (const title of ['ModelTrace', 'modeltrace', 'MODELTRACE']) {
      for (const heading of [`${'#'.repeat(level)} ${title}`, `<h${level}>${title}</h${level}>`]) {
        assert.throws(() => assertDotDisclosure(`${DOT_DISCLOSURE}\n\n${heading}`), /receipt/);
        assertDotDisclosure(`${DOT_DISCLOSURE}\n\n> ${heading}`);
      }
    }
  }
});
