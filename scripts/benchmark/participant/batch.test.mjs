import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareBatch, inspectBatch, schedule, sha256 } from './batch-plan.mjs';
import { executeCandidateBatch, inspectInterruptedBatch } from './batch-runner.mjs';
import { batchReport } from './batch-report.mjs';

async function setup(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'proto-candidate-batch-'));
  const directory = path.join(root, 'plan');
  const ready = await prepareBatch({ directory, model: 'synthetic-not-a-model', ...options });
  const plan = await inspectBatch({ directory, expectedSha256: ready.planSha256 });
  return {
    root,
    ready,
    plan,
    args: {
      planDir: directory,
      expectedSha256: ready.planSha256,
      directory: path.join(root, 'execution'),
    },
  };
}
const response = (text) => ({
  status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
});
const proposal = JSON.stringify({
  properties: [
    {
      id: 'p1',
      claim: 'One section is selected',
      basis: 'observed',
      testProposal: 'Inspect selection after activation',
      limitations: 'Synthetic proposal, not a semantic verdict',
    },
  ],
});

test('predeclared order has exactly three requests per repeated cell, with identical fresh bodies', async () => {
  assert.equal(schedule('round0').length, 4);
  const { ready, plan } = await setup({ stage: 'repeated-development' });
  assert.equal(ready.runs, 12);
  for (const task of ['discovery', 'implementation'])
    for (const condition of ['blind', 'knowledge-assisted']) {
      const rows = plan.runs.filter((r) => r.task === task && r.condition === condition);
      assert.equal(rows.length, 3);
      assert.equal(new Set(rows.map((r) => r.requestSha256)).size, 1);
    }
  assert.equal(
    plan.runs.filter((_, i) => i % 2 === 0).filter((r) => r.condition === 'blind').length,
    3
  );
  assert.equal(plan.admission, 'not-admitted');
  assert.equal(plan.financialBudget.limit, null);
  await assert.rejects(prepareBatch({ directory: ready.directory, model: 'synthetic' }), /EEXIST/);
});

test('request and captured source drift reject before constructing any transport', async () => {
  for (const kind of ['request', 'source', 'plan']) {
    const { args, plan } = await setup();
    const target =
      kind === 'request'
        ? path.join(args.planDir, 'requests', `${plan.runs[0].id}.json`)
        : kind === 'source'
          ? path.join(args.planDir, 'sources', plan.sources[0].path)
          : path.join(args.planDir, 'plan.json');
    await writeFile(target, 'altered');
    let calls = 0;
    await assert.rejects(
      executeCandidateBatch({
        ...args,
        transportFactory: () => {
          calls++;
          return async () => response(proposal);
        },
      })
    );
    assert.equal(calls, 0);
  }
});

test('zero cap retains all planned slots without calls or invented semantic scores', async () => {
  const { args } = await setup({ attemptCap: 0 });
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () => {
      throw new Error('must not run');
    },
  });
  assert.equal(report.attemptsReserved, 0);
  assert.equal(report.realModelRuns, 0);
  for (const cell of report.cells) {
    assert.equal(cell.outcomes['not-executed'], 1);
    assert.equal(cell.layers, null);
    assert.equal(cell.cost.amount, null);
    assert.equal(cell.tokens.input, null);
  }
});

test('constructor failure consumes a reservation but never becomes a participant attempt', async () => {
  const { args } = await setup({ attemptCap: 1 });
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () => {
      throw new Error('constructor failed');
    },
  });
  assert.equal(report.attemptsReserved, 1);
  assert.equal(report.participantInvocations, 0);
  const execution = JSON.parse(await readFile(path.join(args.directory, 'execution.json')));
  assert.equal(execution.results[0].participantInvoked, false);
  assert.equal(execution.results[0].participantOutcome, 'coordinator-failed');
  assert.ok(execution.results.slice(1).every((r) => r.participantOutcome === 'not-executed'));
});

test('hung async factory is bounded, late constructor is never dispatched', async () => {
  const { args } = await setup({ wallMs: 30, totalWallMs: 1000, attemptCap: 1 });
  let calls = 0;
  let finish;
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  assert.equal(report.participantInvocations, 0);
  finish(async () => {
    calls++;
    return response(proposal);
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls, 0);
  const row = JSON.parse(
    await readFile(path.join(args.directory, schedule('round0')[0].id, 'result.json'))
  );
  assert.match(row.reason, /construction deadline/);
});

test('report keeps unknown layers unavailable rather than silently filling zeroes', async () => {
  const { plan, ready } = await setup();
  const rows = plan.runs.map((r) => ({
    ...r,
    participantOutcome: 'not-executed',
    participantInvoked: false,
    reservation: null,
  }));
  rows[2].participantOutcome = 'completed';
  rows[2].participantInvoked = true;
  rows[2].reservation = 1;
  rows[2].assessment = { status: 'candidate-observations', layers: { platform: { pass: 4 } } };
  const report = batchReport({
    plan,
    execution: {
      kind: 'proto-ui.noncompiler-candidate-execution',
      results: rows,
      attemptsReserved: 1,
      executionClass: 'synthetic-controls',
      planSha256: ready.planSha256,
    },
  });
  const cell = report.cells.find(
    (c) => c.task === rows[2].task && c.condition === rows[2].condition
  );
  assert.equal(cell.layers, null);
  assert.equal(cell.assessmentCoverage.incompleteBrowserSummaries, 1);
});

test('even a rebound candidate digest cannot add authorization, review or unknown controls', async () => {
  for (const mutation of [
    (p) => {
      p.authorization = true;
    },
    (p) => {
      p.semanticReview = 'approved';
    },
    (p) => {
      p.controls.resume = true;
    },
    (p) => {
      p.runs[0].tool = 'filesystem';
    },
    (p) => {
      p.packets.discovery.blind.prompt = 'Read the oracle';
    },
  ]) {
    const { args, plan } = await setup();
    mutation(plan);
    const bytes = Buffer.from(JSON.stringify(plan));
    await writeFile(path.join(args.planDir, 'plan.json'), bytes);
    await assert.rejects(inspectBatch({ directory: args.planDir, expectedSha256: sha256(bytes) }));
  }
});

test('all raw response failures remain in their slots; no retry, unknown usage/cost stay null', async () => {
  const { args } = await setup();
  const payloads = [
    response(proposal),
    { status: 'completed', output: [{ type: 'function_call', name: 'read_oracle' }] },
    { status: 'incomplete', output: [] },
    {
      status: 'completed',
      output: [
        { type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] },
      ],
    },
  ];
  let factories = 0,
    calls = 0;
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () => {
      const payload = payloads[factories++];
      return async (body) => {
        calls++;
        assert.ok(Object.isFrozen(body));
        assert.ok(Object.isFrozen(body.input));
        assert.equal(body.tools.length, 0);
        assert.ok(!('previous_response_id' in body));
        return payload;
      };
    },
  });
  assert.equal(calls, 4);
  assert.equal(report.participantInvocations, 4);
  assert.equal(report.cells[0].assessmentCoverage.validProposalStructures, 1);
  const rows = JSON.parse(await readFile(path.join(args.directory, 'execution.json'))).results;
  assert.deepEqual(
    rows.map((r) => r.participantOutcome),
    ['completed', 'failed', 'failed', 'failed']
  );
  for (let i = 0; i < rows.length; i++) assert.deepEqual(rows[i].receipt.response, payloads[i]);
  assert.ok(report.cells.every((c) => c.cost.amount === null && c.tokens.input === null));
});

test('participant timeout preserves abort, ignores late result, and retains later slots', async () => {
  const { args } = await setup({ attemptCap: 1, wallMs: 30 });
  let finish;
  let signal;
  await executeCandidateBatch({
    ...args,
    transportFactory: () => (_body, abort) => {
      signal = abort;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  assert.equal(signal.aborted, true);
  const filename = path.join(args.directory, 'execution.json');
  const before = await readFile(filename);
  const rows = JSON.parse(before).results;
  assert.equal(rows[0].participantOutcome, 'aborted');
  assert.equal(rows[0].receipt.response, null);
  assert.ok(rows.slice(1).every((r) => r.participantOutcome === 'not-executed'));
  finish(response(proposal));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(await readFile(filename), before);
});

test('batch deadline does not dispatch a late factory result or omit slots', async () => {
  const { args } = await setup({ wallMs: 1000, totalWallMs: 30 });
  let calls = 0;
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return async () => {
        calls++;
        return response(proposal);
      };
    },
  });
  assert.equal(calls, 0);
  assert.equal(report.plannedRuns, 4);
  assert.equal(report.participantInvocations, 0);
  const rows = JSON.parse(await readFile(path.join(args.directory, 'execution.json'))).results;
  assert.ok(rows.slice(1).every((r) => r.reason === 'batch-deadline-exhausted'));
});

test('terminal report write failure retains rows and is diagnosed incomplete, never resumed', async () => {
  const { args } = await setup({ attemptCap: 1 });
  await assert.rejects(
    executeCandidateBatch({
      ...args,
      transportFactory: async () => {
        await mkdir(path.join(args.directory, 'report.json'));
        return async () => response(proposal);
      },
    }),
    /EEXIST|EISDIR/
  );
  const recovered = await inspectInterruptedBatch(args);
  assert.equal(recovered.status, 'incomplete');
  assert.equal(recovered.automaticResume, false);
  assert.ok(recovered.artifactErrors.some((e) => e.name === 'report.json'));
  assert.equal(recovered.slots.length, 4);
  assert.equal(recovered.slots[0].result.participantOutcome, 'completed');
  assert.equal(recovered.slots[0].actualInvocation, true);
});

test('missing result after dispatch remains unresolved, not a zero or an automatic retry', async () => {
  const { args } = await setup({ attemptCap: 1 });
  await executeCandidateBatch({ ...args, transportFactory: () => async () => response(proposal) });
  for (const file of ['execution.json', 'report.json', `${schedule('round0')[0].id}/result.json`])
    await rm(path.join(args.directory, file));
  const recovered = await inspectInterruptedBatch(args);
  assert.equal(recovered.status, 'incomplete');
  assert.equal(recovered.slots[0].status, 'unresolved');
  assert.equal(recovered.slots[0].actualInvocation, null);
  assert.ok(recovered.slots[0].dispatchIntent);
  assert.equal(recovered.automaticResume, false);
});

test('mid-batch captured-source drift preserves first response and prevents later transport construction', async () => {
  const { args, plan } = await setup();
  let factories = 0;
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () => {
      factories++;
      return async () => {
        await writeFile(path.join(args.planDir, 'sources', plan.sources[0].path), 'changed');
        return response(proposal);
      };
    },
  });
  assert.equal(factories, 1);
  assert.equal(report.attemptsReserved, 1);
  assert.equal(report.participantInvocations, 1);
  const rows = JSON.parse(await readFile(path.join(args.directory, 'execution.json'))).results;
  assert.equal(rows[0].participantOutcome, 'completed');
  assert.ok(
    rows
      .slice(1)
      .every((r) => r.participantOutcome === 'coordinator-failed' && r.participantInvoked === false)
  );
});

test('stream mode is bound across plan, stored request and dispatched exchange', async () => {
  const { ready, plan, args } = await setup({ stream: true, attemptCap: 1 });
  assert.equal(plan.controls.stream, true);
  const request = JSON.parse(
    await readFile(path.join(ready.directory, 'requests', plan.runs[0].id + '.json'))
  );
  assert.equal(request.stream, true);
  let dispatched;
  const { report } = await executeCandidateBatch({
    ...args,
    transportFactory: () => async (body) => {
      dispatched = body;
      return response(proposal);
    },
  });
  assert.equal(dispatched.stream, true);
  assert.equal(report.attemptsReserved, 1);
});
test('stream controls cannot drift even with a rebound plan digest', async () => {
  const { plan, ready } = await setup({ stream: true });
  plan.controls.stream = false;
  const bytes = Buffer.from(JSON.stringify(plan));
  await writeFile(path.join(ready.directory, 'plan.json'), bytes);
  await assert.rejects(
    inspectBatch({ directory: ready.directory, expectedSha256: sha256(bytes) }),
    /Request and approved packet differ/
  );
});

test('strict stream decoder is frozen and snapshot tampering rejects before transport', async () => {
  const { args, plan } = await setup();
  const parserPath = 'scripts/benchmark/participant/response-stream.mjs';
  assert.ok(
    plan.sources.some((s) => s.path === parserPath),
    'Receiver dependency must be in source inventory'
  );
  await writeFile(path.join(args.planDir, 'sources', parserPath), 'tampered decoder');
  let constructed = 0;
  await assert.rejects(
    executeCandidateBatch({
      ...args,
      transportFactory: () => {
        constructed++;
        return async () => response(proposal);
      },
    })
  );
  assert.equal(constructed, 0);
});
