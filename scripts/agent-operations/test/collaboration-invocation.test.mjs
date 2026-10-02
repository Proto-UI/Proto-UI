import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCollaborationCli } from '../collaboration-packet.mjs';
import {
  authorizeCollaborationMutation,
  computeCollaborationRequestDigest,
  validateCollaborationReceipt,
} from '../collaboration-runtime.mjs';
import { applyGitHubCollaborationMutation } from '../collect-live-collaboration-state.mjs';

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
    evidence,
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
    observedAt: '2026-10-02T01:02:00.000Z',
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
    request,
    handoff,
    handoffPath,
    live,
    args: ['--request', requestPath, '--handoff', handoffPath],
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
      });
      assert.equal(decision.allowed, false);
      assert.match(decision.reason, /requires current-user-instruction purpose evidence/);
    });
  }
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
