import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCollaborationCli } from '../collaboration-packet.mjs';
import { fileURLToPath } from 'node:url';
import {
  authorizeCollaborationMutation,
  collaborationMarker,
  computeCollaborationRequestDigest,
  validateCollaborationReceipt,
} from '../collaboration-runtime.mjs';
import {
  applyGitHubCollaborationMutation,
  CollaborationMutationUnknown,
} from '../collect-live-collaboration-state.mjs';
import { writeModelTraceFixture } from './fixtures/modeltrace.mjs';
import { buildModelTraceRecord, computeModelTraceChallengeDigest } from '../modeltrace.mjs';

// These fixtures represent independently established launch context. Never
// construct launcher arguments by reading the task-authored handoff below.
const HUMAN_LAUNCH = Object.freeze({
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
});
const SCHEDULED_LAUNCH = Object.freeze({
  executionMode: 'autonomous',
  executionModeSource: 'schedule',
});
const HEAD = 'a'.repeat(40);
const UPDATED_AT = '2026-10-02T01:00:00.000Z';

function launchArgs(context) {
  return ['--mode', context.executionMode, '--mode-source', context.executionModeSource];
}

function fixture(
  t,
  evidence = [{ type: 'current-user-instruction', reference: 'fixture://user-request' }]
) {
  const directory = mkdtempSync(join(tmpdir(), 'collaboration-invocation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const identity = writeModelTraceFixture(directory);
  const expected = {
    title: 'Old title',
    body: 'Offline fixture',
    milestoneNumber: null,
    assignees: [],
    labels: [],
  };
  const request = {
    schemaVersion: 1,
    kind: 'proto-ui.collaboration-request',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    authorizationId: 'explicit-current-user',
    action: 'update-governed-issue-or-pull-request-metadata',
    requestedAt: '2026-10-02T01:01:00.000Z',
    requestDigest: '0'.repeat(64),
    target: { kind: 'pull-request', number: 509, updatedAt: UPDATED_AT, headSha: HEAD },
    expected,
    desired: { ...expected, title: 'New title' },
    evidence: [...evidence, identity.artifact],
    rationale: 'Apply the explicitly requested bounded title correction.',
    humanGates: [],
  };
  request.requestDigest = computeCollaborationRequestDigest(request);
  const handoff = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-pr',
    nextSkillId: 'pui-collaborate',
    artifacts: [
      identity.artifact,
      { type: 'pull-request-report', reference: 'fixture://report' },
      { type: 'review-input', reference: 'fixture://review' },
      { type: 'capability-envelope', reference: 'fixture://capability' },
      { type: 'github-snapshot', reference: 'fixture://snapshot' },
      { type: 'mutation-authorization', reference: 'explicit-current-user' },
      {
        type: 'collaboration-request',
        reference: 'fixture://request',
        digest: `sha256:${request.requestDigest}`,
      },
    ],
    humanGates: [],
    notes: [],
  };
  const live = {
    schemaVersion: 1,
    kind: 'proto-ui.live-collaboration-state',
    repositoryId: request.repositoryId,
    action: request.action,
    // Live collection happens after the fixture measurement, matching the
    // supported measuredAt <= verifiedAt receipt chronology boundary.
    observedAt: new Date(Date.parse(identity.modelTrace.measuredAt) + 1000).toISOString(),
    viewerLogin: 'fixture-maintainer',
    viewerPermission: 'WRITE',
    current: {
      kind: 'pull-request',
      number: 509,
      nodeId: 'PR_fixture',
      url: 'https://github.com/Proto-UI/Proto-UI/pull/509',
      state: 'OPEN',
      authorLogin: 'fixture-contributor',
      updatedAt: UPDATED_AT,
      headSha: HEAD,
      ...expected,
      desiredLabelsExist: true,
    },
  };
  const requestPath = join(directory, 'request.json');
  const handoffPath = join(directory, 'handoff.json');
  writeFileSync(requestPath, JSON.stringify(request));
  writeFileSync(handoffPath, JSON.stringify(handoff));
  return {
    ...identity,
    request,
    requestPath,
    handoff,
    handoffPath,
    live,
    args: [
      '--request',
      requestPath,
      '--handoff',
      handoffPath,
      '--record',
      identity.recordPath,
      '--context',
      identity.contextPath,
    ],
  };
}

function untouchedDependencies() {
  const calls = [];
  const dependencies = Object.fromEntries(
    ['loadPolicy', 'collectState', 'applyMutation', 'runner'].map((name) => [
      name,
      () => {
        calls.push(name);
        throw new Error(`unexpected external dependency: ${name}`);
      },
    ])
  );
  return { calls, dependencies };
}

for (const command of ['validate', 'apply']) {
  for (const scenario of [
    { name: 'both declarations missing', args: [], error: /--mode is required/ },
    { name: 'mode missing', args: ['--mode-source', 'current-user'], error: /--mode is required/ },
    {
      name: 'source missing',
      args: ['--mode', 'human-assisted'],
      error: /--mode-source is required/,
    },
    {
      name: 'unknown mode',
      args: ['--mode', 'interactive', '--mode-source', 'current-user'],
      error: /mode is invalid/,
    },
    {
      name: 'untrusted source',
      args: ['--mode', 'human-assisted', '--mode-source', 'repository-issue'],
      error: /cannot be established/,
    },
    {
      name: 'human mode with scheduled source',
      args: ['--mode', 'human-assisted', '--mode-source', 'schedule'],
      error: /cannot be established/,
    },
    {
      name: 'autonomous mode with human source',
      args: ['--mode', 'autonomous', '--mode-source', 'current-user'],
      error: /cannot be established/,
    },
    {
      name: 'duplicate mode',
      args: [...launchArgs(HUMAN_LAUNCH), '--mode', 'autonomous'],
      error: /Usage:/,
    },
    {
      name: 'duplicate source',
      args: [...launchArgs(HUMAN_LAUNCH), '--mode-source', 'schedule'],
      error: /Usage:/,
    },
  ]) {
    test(`${command} rejects ${scenario.name} before reading artifacts or external dependencies`, () => {
      const { calls, dependencies } = untouchedDependencies();
      assert.throws(
        () =>
          runCollaborationCli(
            [
              command,
              ...scenario.args,
              '--request',
              '/missing/request.json',
              '--handoff',
              '/missing/handoff.json',
            ],
            dependencies
          ),
        scenario.error
      );
      assert.deepEqual(calls, []);
    });
  }

  test(`${command} cannot let a human handoff switch an independent scheduled invocation`, (t) => {
    const f = fixture(t);
    const { calls, dependencies } = untouchedDependencies();
    assert.throws(
      () =>
        runCollaborationCli(
          [
            command,
            ...launchArgs(SCHEDULED_LAUNCH),
            ...f.args,
            '--assessment',
            '/missing/assessment.json',
          ],
          dependencies
        ),
      /handoff executionMode does not match the independent invocation/
    );
    assert.deepEqual(calls, []);
  });

  for (const changedFields of [
    { executionMode: 'autonomous', executionModeSource: 'schedule' },
    { executionModeSource: 'active-human-loop' },
    { executionModeSource: 'repository-issue' },
    { executionMode: null },
  ]) {
    test(`${command} rejects conflicting handoff ${JSON.stringify(changedFields)} before external reads`, (t) => {
      const f = fixture(t);
      writeFileSync(f.handoffPath, JSON.stringify({ ...f.handoff, ...changedFields }));
      const { calls, dependencies } = untouchedDependencies();
      assert.throws(
        () =>
          runCollaborationCli(
            [
              command,
              ...launchArgs(HUMAN_LAUNCH),
              ...f.args,
              '--assessment',
              '/missing/assessment.json',
            ],
            dependencies
          ),
        /does not match the independent invocation declaration/
      );
      assert.deepEqual(calls, []);
    });
  }

  for (const evidence of [
    [],
    [{ type: 'governed-outcome', reference: 'fixture://caller-outcome' }],
  ]) {
    test(`${command} requires current-user-instruction purpose evidence: ${evidence.length ? 'governed-only' : 'missing'}`, (t) => {
      const f = fixture(t, evidence);
      const { calls, dependencies } = untouchedDependencies();
      assert.throws(
        () =>
          runCollaborationCli([command, ...launchArgs(HUMAN_LAUNCH), ...f.args], {
            ...dependencies,
            loadPolicy: () => ({}),
          }),
        /requires current-user-instruction purpose evidence/
      );
      assert.deepEqual(calls, []);
      const decision = authorizeCollaborationMutation({
        request: f.request,
        liveState: f.live,
        ...HUMAN_LAUNCH,
        modelTrace: f.modelTrace,
        modelTraceContext: f.modelTraceContext,
      });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /requires current-user-instruction purpose evidence/);
    });
  }
}

for (const scenario of [
  'missing record',
  'missing context',
  'unbound request',
  'wrong handoff record',
  'changed route',
  'expired measurement',
]) {
  test(`apply cannot reach external dependencies with ${scenario}`, (t) => {
    const f = fixture(t);
    let args = [...f.args];
    if (scenario === 'missing record' || scenario === 'missing context') {
      const option = scenario === 'missing record' ? '--record' : '--context';
      const index = args.indexOf(option);
      args.splice(index, 2);
    } else if (scenario === 'unbound request') {
      f.request.evidence = f.request.evidence.filter((item) => item.type !== 'modeltrace-record');
      f.request.requestDigest = computeCollaborationRequestDigest(f.request);
      f.handoff.artifacts.find((item) => item.type === 'collaboration-request').digest =
        `sha256:${f.request.requestDigest}`;
      writeFileSync(f.requestPath, JSON.stringify(f.request));
      writeFileSync(f.handoffPath, JSON.stringify(f.handoff));
    } else if (scenario === 'wrong handoff record') {
      f.handoff.artifacts.find((item) => item.type === 'modeltrace-record').digest =
        `sha256:${'f'.repeat(64)}`;
      writeFileSync(f.handoffPath, JSON.stringify(f.handoff));
    } else if (scenario === 'changed route') {
      writeFileSync(
        f.contextPath,
        JSON.stringify({ ...f.modelTraceContext, routeDigest: 'c'.repeat(64) })
      );
    } else {
      // Keep the failed probes synthetic and valid, but issue them in the past.
      const challenge = {
        ...f.record.challenge,
        issuedAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2020-01-01T00:10:00.000Z',
      };
      const response = {
        ...f.record.response,
        challengeDigest: computeModelTraceChallengeDigest(challenge),
        startedAt: challenge.issuedAt,
        completedAt: challenge.issuedAt,
      };
      writeFileSync(f.recordPath, JSON.stringify(buildModelTraceRecord(challenge, response)));
    }
    const { calls, dependencies } = untouchedDependencies();
    assert.throws(
      () =>
        runCollaborationCli(['apply', ...launchArgs(HUMAN_LAUNCH), ...args], {
          ...dependencies,
          loadPolicy: () => ({}),
        }),
      /record|context|route changed|measurement expired/
    );
    assert.deepEqual(calls, []);
  });
}

for (const scenario of [
  'in-checkout record',
  'in-checkout context',
  'in-checkout alias',
  'raw record reused as handoff',
  'raw context reused as owner key',
]) {
  test(`apply rejects ${scenario} before raw JSON reading or external dependencies`, (t) => {
    const f = fixture(t);
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    const insideDir = mkdtempSync(join(root, '.modeltrace-inside-fixture-'));
    t.after(() => rmSync(insideDir, { recursive: true, force: true }));
    const insideRecord = join(insideDir, 'record.json');
    const insideContext = join(insideDir, 'context.json');
    writeFileSync(insideRecord, JSON.stringify(f.record));
    writeFileSync(insideContext, JSON.stringify(f.modelTraceContext));
    let args = [...f.args];
    if (scenario === 'in-checkout record') {
      const idx = args.indexOf('--record');
      args[idx + 1] = insideRecord;
    } else if (scenario === 'in-checkout context') {
      const idx = args.indexOf('--context');
      args[idx + 1] = insideContext;
    } else if (scenario === 'raw record reused as handoff') {
      args[args.indexOf('--record') + 1] = insideRecord;
      args[args.indexOf('--handoff') + 1] = insideRecord;
    } else if (scenario === 'raw context reused as owner key') {
      args[args.indexOf('--context') + 1] = insideContext;
      args.push(
        '--owner-authorization',
        f.recordPath,
        '--owner-key',
        insideContext,
        '--owner-grant',
        'synthetic-invocation-control'
      );
    } else {
      // A directory alias outside checkout still reaches stageable raw inputs.
      const aliasDir = mkdtempSync(join(tmpdir(), 'collab-alias-'));
      t.after(() => rmSync(aliasDir, { recursive: true, force: true }));
      const aliasRoot = join(aliasDir, 'checkout-inputs');
      symlinkSync(insideDir, aliasRoot, 'dir');
      const aliasRecord = join(aliasRoot, 'record.json');
      const aliasContext = join(aliasRoot, 'context.json');
      const recIdx = args.indexOf('--record');
      args[recIdx + 1] = aliasRecord;
      const ctxIdx = args.indexOf('--context');
      args[ctxIdx + 1] = aliasContext;
    }
    const rawPaths = new Set([
      f.recordPath,
      f.contextPath,
      insideRecord,
      insideContext,
      args[args.indexOf('--record') + 1],
      args[args.indexOf('--context') + 1],
    ]);
    const opened = [];
    const openSync = fs.openSync;
    const readFileSync = fs.readFileSync;
    fs.openSync = (file, ...options) => {
      if (rawPaths.has(String(file))) opened.push(String(file));
      return openSync(file, ...options);
    };
    fs.readFileSync = (file, ...options) => {
      if (rawPaths.has(String(file))) opened.push(String(file));
      return readFileSync(file, ...options);
    };
    t.after(() => {
      fs.openSync = openSync;
      fs.readFileSync = readFileSync;
    });
    const { calls, dependencies } = untouchedDependencies();
    let failure;
    try {
      runCollaborationCli(['apply', ...launchArgs(HUMAN_LAUNCH), ...args], {
        ...dependencies,
        loadPolicy: () => ({}),
      });
    } catch (error) {
      failure = error;
    }
    assert.deepEqual(calls, []);
    assert.deepEqual(opened, []);
    assert.match(failure?.message ?? '', /outside the checkout/);
  });
}

test('apply accepts outside-checkout ModelTrace record/context as control', (t) => {
  const f = fixture(t);
  // Default fixture paths live in tmpdir (outside checkout); the apply path
  // must proceed past the containment check to reach live collection.
  let liveReads = 0;
  const liveBoundary = new Error('controlled live collection boundary');
  assert.throws(
    () =>
      runCollaborationCli(['apply', ...launchArgs(HUMAN_LAUNCH), ...f.args], {
        loadPolicy: () => ({}),
        collectState() {
          liveReads += 1;
          throw liveBoundary;
        },
      }),
    (error) => error === liveBoundary
  );
  assert.equal(liveReads, 1);
});

for (const scenario of [
  'missing --record and --context flags',
  'unavailable referenced measurement files',
  'expired record',
]) {
  test(`validate succeeds with ${scenario} without reading ModelTrace files`, (t) => {
    const f = fixture(t);
    let args = [...f.args];
    if (scenario === 'missing --record and --context flags') {
      for (const option of ['--record', '--context']) {
        const index = args.indexOf(option);
        args.splice(index, 2);
      }
    } else if (scenario === 'unavailable referenced measurement files') {
      // Point to non-existent paths while keeping the flags present.
      const recordIndex = args.indexOf('--record');
      args[recordIndex + 1] = '/nonexistent/modeltrace-record.json';
      const contextIndex = args.indexOf('--context');
      args[contextIndex + 1] = '/nonexistent/modeltrace-context.json';
    } else {
      // Expired record: issue probes in the past.
      const challenge = {
        ...f.record.challenge,
        issuedAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2020-01-01T00:10:00.000Z',
      };
      const response = {
        ...f.record.response,
        challengeDigest: computeModelTraceChallengeDigest(challenge),
        startedAt: challenge.issuedAt,
        completedAt: challenge.issuedAt,
      };
      writeFileSync(f.recordPath, JSON.stringify(buildModelTraceRecord(challenge, response)));
    }
    const { calls, dependencies } = untouchedDependencies();
    const result = runCollaborationCli(['validate', ...launchArgs(HUMAN_LAUNCH), ...args], {
      ...dependencies,
      loadPolicy: () => ({}),
    });
    assert.equal(result.valid, true);
    assert.equal(result.requestDigest, f.request.requestDigest);
    assert.equal(result.action, f.request.action);
    assert.equal(result.executionMode, 'human-assisted');
    assert.equal(result.executionModeSource, 'current-user');
    assert.ok(result.eligibility);
    // No external dependency was called.
    assert.deepEqual(calls, []);
  });
}

for (const source of ['current-user', 'active-human-loop']) {
  test(`explicit human invocation validates and retains ${source} through final writer admission`, (t) => {
    const f = fixture(t);
    const launchContext = Object.freeze({
      executionMode: 'human-assisted',
      executionModeSource: source,
    });
    f.handoff.executionModeSource = source;
    writeFileSync(f.handoffPath, JSON.stringify(f.handoff));
    const args = [...launchArgs(launchContext), ...f.args];
    const validated = runCollaborationCli(['validate', ...args], { loadPolicy: () => ({}) });
    assert.equal(validated.valid, true);
    assert.equal(validated.executionMode, launchContext.executionMode);
    assert.equal(validated.executionModeSource, source);
    let reads = 0;
    let writes = 0;
    let writerCalls = 0;
    const result = runCollaborationCli(['apply', ...args], {
      loadPolicy: () => ({}),
      collectState() {
        reads += 1;
        // Task content changing after initial binding cannot become the
        // authorization context used for subsequent admission or the writer.
        writeFileSync(f.handoffPath, JSON.stringify({ ...f.handoff, ...SCHEDULED_LAUNCH }));
        if (reads < 3) return structuredClone(f.live);
        return { ...f.live, current: { ...f.live.current, title: 'New title' } };
      },
      applyMutation(request, preState, options) {
        writerCalls += 1;
        assert.equal(options.authorizationContext.executionMode, launchContext.executionMode);
        assert.equal(options.authorizationContext.executionModeSource, source);
        return applyGitHubCollaborationMutation(request, preState, options);
      },
      runner(command, argv, options) {
        writes += 1;
        assert.equal(command, 'gh');
        assert.ok(argv.includes('PATCH'));
        assert.ok(argv.includes('repos/Proto-UI/Proto-UI/issues/509'));
        assert.deepEqual(JSON.parse(options.input), { title: 'New title' });
        return JSON.stringify({ id: 509, node_id: 'PR_fixture' });
      },
    });
    validateCollaborationReceipt(result, f.request);
    assert.equal(result.outcome, 'applied');
    assert.equal(result.mutationCount, 1);
    assert.equal(reads, 3);
    assert.equal(writes, 1);
    assert.equal(writerCalls, 1);
  });
}

function commentFixture(t) {
  const f = fixture(t);
  f.request.action = 'post-bounded-reconciliation-comment';
  f.request.expected = { markerAbsent: true };
  f.request.desired = { body: `The exact requested reconciliation.\n\n${f.disclosure}` };
  f.request.requestDigest = computeCollaborationRequestDigest(f.request);
  f.handoff.artifacts.find((item) => item.type === 'collaboration-request').digest =
    `sha256:${f.request.requestDigest}`;
  f.live.action = f.request.action;
  f.live.current.markerComment = null;
  writeFileSync(f.requestPath, JSON.stringify(f.request));
  writeFileSync(f.handoffPath, JSON.stringify(f.handoff));
  f.response = {
    id: 271,
    node_id: 'IC_271',
    body: `${f.request.desired.body}\n\n${collaborationMarker(f.request)}`,
    user: { login: f.live.viewerLogin },
    // The server clock trails both local request and collector clocks.
    created_at: '2026-10-02T01:00:30.000Z',
  };
  f.post = {
    ...f.live,
    current: {
      ...f.live.current,
      markerComment: {
        id: '271',
        nodeId: 'IC_271',
        body: f.response.body,
        authorLogin: f.response.user.login,
        createdAt: f.response.created_at,
      },
    },
  };
  return f;
}

for (const scenario of [
  'lost response',
  'lost response and read failure',
  'invalid response JSON',
  'empty response',
  'null response',
  'malformed response',
  'read failure',
  'invalid receipt',
]) {
  test(`comment CLI library caller can discriminate unknown: ${scenario}`, (t) => {
    const f = commentFixture(t);
    if (scenario === 'invalid receipt') f.response.node_id = { private: 'secret upstream stderr' };
    let reads = 0;
    let writes = 0;
    assert.throws(
      () =>
        runCollaborationCli(['apply', ...launchArgs(HUMAN_LAUNCH), ...f.args], {
          loadPolicy: () => ({}),
          collectState() {
            reads += 1;
            if (writes === 0) return f.live;
            if (scenario.includes('read failure')) throw new Error('secret upstream stderr');
            return f.post;
          },
          runner() {
            writes += 1;
            if (scenario.startsWith('lost response')) throw new Error('secret upstream stderr');
            if (scenario === 'invalid response JSON') return 'secret upstream stderr';
            if (scenario === 'empty response') return '';
            if (scenario === 'null response') return 'null';
            if (scenario === 'malformed response') return '{}';
            return JSON.stringify(f.response);
          },
        }),
      (error) => {
        assert.ok(error instanceof CollaborationMutationUnknown);
        assert.equal(error.result.kind, 'proto-ui.collaboration-unknown');
        assert.equal(error.result.outcome, 'unknown');
        assert.equal(error.result.writeAttempts, 1);
        assert.equal(error.result.reconciliationReadAttempts, 1);
        assert.equal(
          error.result.acknowledgementReceived,
          ![
            'lost response',
            'lost response and read failure',
            'invalid response JSON',
            'empty response',
            'null response',
          ].includes(scenario)
        );
        assert.equal(error.result.requestDigest, f.request.requestDigest);
        assert.deepEqual(error.result.target, f.request.target);
        assert.doesNotMatch(JSON.stringify(error.result), /secret upstream/);
        assert.throws(() => validateCollaborationReceipt(error.result, f.request));
        return true;
      }
    );
    assert.equal(writes, 1);
    assert.equal(reads, 3);
  });
}

test('comment command emits safe unknown JSON and exits unsuccessfully after one POST', (t) => {
  const f = commentFixture(t);
  const moduleUrl = new URL('../collaboration-packet.mjs', import.meta.url).href;
  const program = `
    import { readFileSync } from 'node:fs';
    import { executeCollaborationCli } from ${JSON.stringify(moduleUrl)};
    const f = JSON.parse(readFileSync(0, 'utf8'));
    let writes = 0;
    let reads = 0;
    process.exitCode = executeCollaborationCli(f.args, {
      loadPolicy: () => ({}),
      collectState() {
        reads += 1;
        if (writes === 0) return f.live;
        throw new Error('secret upstream stderr');
      },
      runner() { writes += 1; return JSON.stringify(f.response); },
    });
    if (writes !== 1 || reads !== 3) throw new Error('unexpected mutation/read count');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
    encoding: 'utf8',
    input: JSON.stringify({
      args: ['apply', ...launchArgs(HUMAN_LAUNCH), ...f.args],
      live: f.live,
      response: f.response,
    }),
  });
  assert.equal(result.status, 1);
  const unknown = JSON.parse(result.stdout);
  assert.equal(unknown.kind, 'proto-ui.collaboration-unknown');
  assert.equal(unknown.outcome, 'unknown');
  assert.equal(unknown.reason, 'comment-post-readback-unavailable');
  assert.equal(unknown.writeAttempts, 1);
  assert.equal(unknown.reconciliationReadAttempts, 1);
  assert.match(result.stderr, /unknown; do not retry blindly/);
  assert.doesNotMatch(result.stdout + result.stderr, /secret upstream/);
  assert.throws(() => validateCollaborationReceipt(unknown, f.request));
});
