import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { participantRequest } from './no-tools.mjs';
import { taskPackets } from './task-packets.mjs';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value));
export const TASKS = Object.freeze(['discovery', 'implementation']);
export const CONDITIONS = Object.freeze(['blind', 'knowledge-assisted']);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sourcePaths = [
  'scripts/benchmark/participant/no-tools.mjs',
  'scripts/benchmark/participant/http-transport.mjs',
  'scripts/benchmark/participant/response-stream.mjs',
  'scripts/benchmark/participant/task-packets.mjs',
  'scripts/benchmark/participant/batch-plan.mjs',
  'scripts/benchmark/participant/batch-runner.mjs',
  'scripts/benchmark/participant/batch-report.mjs',
  'scripts/benchmark/semantic/tabs-policy.mjs',
  'scripts/benchmark/semantic/tabs-oracle.mjs',
  'scripts/benchmark/semantic/tabs-worker.mjs',
  'scripts/benchmark/semantic/bounded-worker.mjs',
  'benchmarks/interaction/tasks/tabs-discovery.html',
  'benchmarks/interaction/cases/tabs-manual-activation.json',
  ...['', '-LIST', '-TRIGGER', '-CONTENT'].map((part) => `spec/prototypes/P-BASE-TABS${part}.yaml`),
];
function exactKeys(value, keys, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `Unknown/missing ${label} fields`);
}
function integer(value, min, max, label) {
  assert.ok(Number.isSafeInteger(value) && value >= min && value <= max, `Invalid ${label}`);
}

/** Candidate order, NOT admission or authorization. Three is deliberately odd:
 * AB/BA/AB for one task, BA/AB/BA for the other. Across both tasks there are equal
 * condition-first counts. Do not shuffle in response to earlier observations.
 */
export function schedule(stage) {
  assert.ok(['round0', 'repeated-development'].includes(stage), 'Unknown stage');
  const repetitions = stage === 'round0' ? 1 : 3;
  const runs = [];
  for (let ti = 0; ti < TASKS.length; ti++) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const order = (ti + repetition) % 2 ? CONDITIONS : CONDITIONS.toReversed();
      for (const condition of order)
        runs.push({
          id: `${TASKS[ti]}-${condition}-${repetition}`,
          task: TASKS[ti],
          condition,
          repetition,
        });
    }
  }
  return runs;
}

/** Exact immutable-byte candidate snapshot, not a frozen/admitted experiment.
 * No model invocation, credential lookup or tool dispatch. Independent review,
 * real Round0, billing controls and effective executor boundaries are external
 * requirements. A digest can bind a proposed schedule, not authenticate it.
 */
export async function prepareBatch({
  directory,
  model,
  stage = 'round0',
  maxOutputTokens = 8192,
  stream = false,
  wallMs = 180000,
  totalWallMs = 2400000,
  attemptCap,
}) {
  assert.ok(path.isAbsolute(directory));
  const order = schedule(stage);
  integer(wallMs, 1, 600000, 'per-request deadline');
  integer(totalWallMs, 1, 7200000, 'batch deadline');
  integer(attemptCap ?? order.length, 0, order.length, 'attempt cap');
  const packets = Object.fromEntries(
    await Promise.all(TASKS.map(async (task) => [task, (await taskPackets(task)).conditions]))
  );
  const requests = order.map((run) => {
    const body = participantRequest({
      packet: packets[run.task][run.condition],
      model,
      maxOutputTokens,
      stream,
    });
    return { ...run, requestSha256: sha256(jsonBytes(body)), request: body };
  });
  const sources = await Promise.all(
    sourcePaths.map(async (name) => {
      const bytes = await readFile(path.join(repo, name));
      return { path: name, bytes: bytes.length, sha256: sha256(bytes), content: bytes };
    })
  );
  await mkdir(directory); // Caller creates trusted parent; never overwrite a prior plan.
  const plan = {
    schemaVersion: 1,
    kind: 'proto-ui.noncompiler-batch-candidate',
    admission: 'not-admitted',
    split: 'public-development',
    stage,
    model,
    modelSnapshot: null,
    controls: {
      maxOutputTokens,
      stream,
      wallMs,
      totalWallMs,
      attemptCap: attemptCap ?? order.length,
      retry: 'none',
      context: 'fresh stateless no-tools request',
    },
    financialBudget: { status: 'unconfirmed', limit: null, currency: null, rate: null },
    semanticReview: 'pending',
    capabilityAdmission: 'pending',
    policyFreeze: 'pending-after-real-round0',
    sources: sources.map(({ content: _content, ...item }) => item),
    platformSourceBytes:
      'Referenced by candidate policy; independent admission must also retain and review them',
    packets,
    runs: requests.map(({ request: _request, ...run }) => run),
    limitations: [
      'One public hand-authored domain and one model; not held-out or general value evidence',
      'Task-major AB/BA alternation balances condition order, not every temporal/task/model confound',
      'Knowledge-assisted discovery is calibration; no matched-information or mature-library path',
      'Stateless requests do not prove provider-internal independence or absence of pretraining/cache exposure',
      'Client request/attempt/time caps do not prove an enforceable monetary ceiling',
      'Candidate oracle remains unreviewed; no formal Proto conformance or semantic-equivalence automation',
    ],
  };
  for (const source of sources) {
    const dest = path.join(directory, 'sources', source.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, source.content, { flag: 'wx' });
  }
  await mkdir(path.join(directory, 'requests'));
  for (const run of requests)
    await writeFile(path.join(directory, 'requests', `${run.id}.json`), jsonBytes(run.request), {
      flag: 'wx',
    });
  const bytes = jsonBytes(plan);
  await writeFile(path.join(directory, 'plan.json'), bytes, { flag: 'wx' });
  const digest = sha256(bytes);
  await writeFile(path.join(directory, 'plan.sha256'), digest + '\n', { flag: 'wx' });
  return { directory, planSha256: digest, runs: plan.runs.length, admission: plan.admission };
}

/** Fail before transport construction if schedule, packet or current source drifts.
 * expectedSha256 comes from the trusted coordinator, not plan.sha256 alone.
 * Current source checks are coordination guards, not hostile-host TOCTOU proof.
 */
export async function inspectBatch({ directory, expectedSha256 }) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/, 'Coordinator digest required');
  const bytes = await readFile(path.join(directory, 'plan.json'));
  assert.equal(sha256(bytes), expectedSha256, 'Plan differs from coordinator digest');
  const plan = JSON.parse(bytes);
  exactKeys(
    plan,
    [
      'schemaVersion',
      'kind',
      'admission',
      'split',
      'stage',
      'model',
      'modelSnapshot',
      'controls',
      'financialBudget',
      'semanticReview',
      'capabilityAdmission',
      'policyFreeze',
      'sources',
      'platformSourceBytes',
      'packets',
      'runs',
      'limitations',
    ],
    'plan'
  );
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.modelSnapshot, null);
  assert.equal(plan.semanticReview, 'pending');
  assert.equal(plan.capabilityAdmission, 'pending');
  assert.equal(plan.policyFreeze, 'pending-after-real-round0');
  assert.deepEqual(plan.financialBudget, {
    status: 'unconfirmed',
    limit: null,
    currency: null,
    rate: null,
  });
  exactKeys(
    plan.controls,
    ['maxOutputTokens', 'stream', 'wallMs', 'totalWallMs', 'attemptCap', 'retry', 'context'],
    'controls'
  );
  assert.equal(typeof plan.controls.stream, 'boolean', 'Invalid stream mode');
  assert.equal(plan.controls.context, 'fresh stateless no-tools request');
  assert.ok(
    Array.isArray(plan.limitations) &&
      plan.limitations.length &&
      plan.limitations.every((v) => typeof v === 'string' && v.length)
  );
  assert.equal(
    plan.platformSourceBytes,
    'Referenced by candidate policy; independent admission must also retain and review them'
  );
  exactKeys(plan.packets, TASKS, 'tasks');
  const currentPackets = Object.fromEntries(
    await Promise.all(TASKS.map(async (task) => [task, (await taskPackets(task)).conditions]))
  );
  assert.deepEqual(plan.packets, currentPackets, 'Task packet differs from current source');
  assert.equal(plan.kind, 'proto-ui.noncompiler-batch-candidate');
  assert.equal(plan.admission, 'not-admitted');
  assert.equal(plan.split, 'public-development');
  assert.equal(plan.controls.retry, 'none');
  integer(plan.controls.wallMs, 1, 600000, 'request deadline');
  integer(plan.controls.totalWallMs, 1, 7200000, 'batch deadline');
  const expected = schedule(plan.stage);
  integer(plan.controls.attemptCap, 0, expected.length, 'attempt cap');
  assert.equal(plan.runs.length, expected.length, 'Wrong run count');
  assert.deepEqual(
    plan.sources.map((s) => s.path),
    sourcePaths,
    'Source inventory changed'
  );
  for (const source of plan.sources) {
    exactKeys(source, ['path', 'bytes', 'sha256'], 'source');
    integer(source.bytes, 0, 10_000_000, 'source bytes');
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    for (const location of [
      path.join(directory, 'sources', source.path),
      path.join(repo, source.path),
    ]) {
      const bytes = await readFile(location);
      assert.equal(bytes.length, source.bytes, 'Source size changed');
      assert.equal(sha256(bytes), source.sha256, 'Source bytes changed');
    }
  }
  for (let i = 0; i < expected.length; i++) {
    const run = plan.runs[i];
    exactKeys(run, ['id', 'task', 'condition', 'repetition', 'requestSha256'], 'run');
    assert.match(run.requestSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      { id: run.id, task: run.task, condition: run.condition, repetition: run.repetition },
      expected[i],
      'Schedule changed'
    );
    const request = participantRequest({
      packet: plan.packets[run.task][run.condition],
      model: plan.model,
      maxOutputTokens: plan.controls.maxOutputTokens,
      stream: plan.controls.stream,
    });
    const actual = await readFile(path.join(directory, 'requests', `${run.id}.json`));
    assert.equal(sha256(actual), run.requestSha256, 'Request file changed');
    assert.deepEqual(actual, jsonBytes(request), 'Request and approved packet differ');
  }
  return plan;
}
