import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPreviewBuild, resolvePreviewBuild } from './build-admission.mjs';

const sha = 'a'.repeat(40);
const base = { id: 1, full_name: 'Proto-UI/Proto-UI', default_branch: 'main' };
const context = { repo: { owner: 'Proto-UI', repo: 'Proto-UI' } };

function build(id = 100, overrides = {}) {
  return {
    id,
    run_number: id,
    run_attempt: 1,
    workflow_id: 7,
    created_at: '2026-10-05T12:00:00Z',
    status: 'completed',
    conclusion: 'success',
    event: 'pull_request',
    repository: base,
    head_repository: { id: 2 },
    head_branch: 'topic',
    head_sha: sha,
    pull_requests: [],
    ...overrides,
  };
}

function artifact(run, binding = false, pr = 596, head = sha) {
  return {
    id: run.id * 10 + (binding ? 1 : 2),
    name: `intranet-preview-${binding ? 'binding-' : ''}${pr}-${head}-${run.run_attempt}`,
    expired: false,
    size_in_bytes: binding ? 60 : 2048,
    workflow_run: {
      id: run.id,
      head_sha: run.head_sha,
      repository_id: run.repository.id,
      head_repository_id: run.head_repository.id,
    },
  };
}

function fixture(run = build()) {
  const state = {
    pr: {
      number: 596,
      state: 'open',
      head: { sha, ref: 'topic', repo: { id: 2 } },
      base: { repo: base },
      user: { login: 'contributor', id: 9 },
    },
    runs: new Map([[run.id, run]]),
    artifacts: new Map([[run.id, [artifact(run, true), artifact(run)]]]),
    listed: [run],
    published: [],
    fail: '',
    onList: null,
  };
  const response = (key, value) => {
    if (state.fail === key) throw new Error('GitHub lookup unavailable');
    return { data: structuredClone(value) };
  };
  const github = {
    rest: {
      repos: { get: async () => response('repository', base) },
      pulls: { get: async () => response('pull', state.pr) },
      actions: {
        getWorkflowRun: async ({ run_id }) => response('run', state.runs.get(run_id)),
        getWorkflow: async () =>
          response('workflow', { path: '.github/workflows/intranet-preview-build.yml' }),
        listWorkflowRunArtifacts: async ({ run_id, page, per_page }) => {
          const values = state.artifacts.get(run_id) || [];
          return response('artifacts', {
            artifacts: values.slice((page - 1) * per_page, page * per_page),
            total_count: values.length,
          });
        },
        listWorkflowRuns: async ({ page, per_page }) => {
          const result = response('recency', {
            workflow_runs: state.listed.slice((page - 1) * per_page, page * per_page),
            total_count: state.listed.length,
          });
          state.onList?.(page);
          return result;
        },
      },
    },
  };
  const options = {
    github,
    context,
    runId: run.id,
    kind: run.conclusion === 'success' ? 'success' : 'failed',
  };
  const resolve = async () => (await resolvePreviewBuild(options)).binding;
  const publish = async (expected, status = 'ready') => {
    const binding = await admitPreviewBuild({ ...options, expected });
    state.published.push({
      status,
      pr: binding.pr,
      sha: binding.head_sha,
      run: binding.run_id,
      attempt: binding.run_attempt,
    });
  };
  const add = (newer, artifacts = [artifact(newer, true), artifact(newer)]) => {
    state.runs.set(newer.id, newer);
    state.artifacts.set(newer.id, artifacts);
    state.listed.unshift(newer);
  };
  return { state, resolve, publish, add };
}

async function rejectsPublication(f, expected, status = 'ready') {
  await assert.rejects(() => f.publish(expected, status));
  assert.deepEqual(f.state.published, []);
}

test('an empty-association fork build can publish only its verified current tuple', async () => {
  const f = fixture();
  await f.publish(await f.resolve());
  assert.deepEqual(f.state.published, [
    { status: 'ready', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('a failed cancelled build remains eligible to revoke when it is the latest build', async () => {
  const f = fixture(build(100, { conclusion: 'cancelled' }));
  await f.publish(await f.resolve(), 'failed');
  assert.deepEqual(f.state.published, [
    { status: 'failed', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('a skipped build uses its immutable binding even without a site artifact', async () => {
  const run = build(100, { conclusion: 'skipped' });
  const f = fixture(run);
  f.state.artifacts.set(run.id, [artifact(run, true)]);
  await f.publish(await f.resolve(), 'failed');
  assert.deepEqual(f.state.published, [
    { status: 'failed', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('post-lock admission rejects a PR that closed while the sender waited', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.state.pr.state = 'closed';
  await rejectsPublication(f, expected);
});

test('post-lock admission rejects a changed head without revoking the new head', async () => {
  const f = fixture(build(100, { conclusion: 'failure' }));
  const expected = await f.resolve();
  f.state.pr.head.sha = 'b'.repeat(40);
  await rejectsPublication(f, expected, 'failed');
});

test('a delayed cancelled build cannot revoke a newer successful same-head build', async () => {
  const f = fixture(build(100, { conclusion: 'cancelled' }));
  const expected = await f.resolve();
  f.add(build(101));
  await rejectsPublication(f, expected, 'failed');
});

test('a newer failed build prevents an older successful run from restoring Ready', async () => {
  const f = fixture();
  const expected = await f.resolve();
  const failed = build(101, { conclusion: 'failure' });
  f.add(failed, [artifact(failed, true)]);
  await rejectsPublication(f, expected);
});

test('a newer queued same-head build supersedes an older publication', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.add(build(101, { status: 'queued', conclusion: null }), []);
  await rejectsPublication(f, expected);
});

test('Ready admission rejects a build superseded after its initial post-lock admission', async () => {
  const f = fixture();
  const expected = await f.resolve();
  await f.publish(expected, 'building');
  f.add(build(101));
  await assert.rejects(() => f.publish(expected));
  assert.deepEqual(f.state.published, [
    { status: 'building', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('a rerun with the same run ID rejects the previously resolved attempt', async () => {
  const f = fixture();
  const expected = await f.resolve();
  const rerun = build(100, { run_attempt: 2 });
  f.state.runs.set(rerun.id, rerun);
  f.state.artifacts.set(rerun.id, [artifact(rerun, true), artifact(rerun)]);
  await rejectsPublication(f, expected);
  await f.publish(await f.resolve());
  assert.deepEqual(f.state.published, [
    { status: 'ready', pr: '596', sha, run: '100', attempt: '2' },
  ]);
});

test('an attempt changed during the recency lookup cannot authorize a lifecycle write', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.state.onList = () =>
    f.state.runs.set(100, build(100, { run_attempt: 2, status: 'in_progress', conclusion: null }));
  await rejectsPublication(f, expected);
});

test('manual builds with empty associations use the verified marker rather than the default-branch SHA', async () => {
  const manual = build(100, {
    event: 'workflow_dispatch',
    head_repository: base,
    head_branch: 'main',
    head_sha: 'b'.repeat(40),
  });
  const f = fixture(manual);
  await f.publish(await f.resolve());
  assert.deepEqual(f.state.published, [
    { status: 'ready', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('a manual producer outside the default branch cannot authorize preview publication', async () => {
  const f = fixture(
    build(100, {
      event: 'workflow_dispatch',
      head_repository: base,
      head_branch: 'untrusted-workflow',
    })
  );
  await assert.rejects(f.resolve);
  assert.deepEqual(f.state.published, []);
});

test('a verified PR association can bind the head when the workflow API records a merge SHA', async () => {
  const f = fixture(
    build(100, {
      head_sha: 'b'.repeat(40),
      pull_requests: [{ number: 596, head: { sha, repo: { id: 2 } } }],
    })
  );
  await f.publish(await f.resolve());
  assert.deepEqual(f.state.published, [
    { status: 'ready', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('a newer manual build for the same PR supersedes its older PR build', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.add(
    build(101, {
      event: 'workflow_dispatch',
      head_repository: base,
      head_branch: 'main',
      head_sha: 'b'.repeat(40),
    })
  );
  await rejectsPublication(f, expected);
});

test('a newer manual build for another PR does not supersede the verified candidate', async () => {
  const f = fixture();
  const expected = await f.resolve();
  const manual = build(101, {
    event: 'workflow_dispatch',
    head_repository: base,
    head_branch: 'main',
  });
  f.add(manual, [artifact(manual, true, 597), artifact(manual, false, 597)]);
  await f.publish(expected);
  assert.deepEqual(f.state.published, [
    { status: 'ready', pr: '596', sha, run: '100', attempt: '1' },
  ]);
});

test('an unbound newer manual build fails closed instead of being assumed unrelated', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.add(build(101, { event: 'workflow_dispatch', head_repository: base, head_branch: 'main' }), []);
  await rejectsPublication(f, expected);
});

test('site artifacts cannot substitute another PR for the trusted manual build marker', async () => {
  const manual = build(100, {
    event: 'workflow_dispatch',
    head_repository: base,
    head_branch: 'main',
  });
  const f = fixture(manual);
  f.state.artifacts.set(100, [artifact(manual, true, 597), artifact(manual)]);
  await assert.rejects(f.resolve);
  assert.deepEqual(f.state.published, []);
});

test('artifact ownership is required even when the name claims the expected tuple', async () => {
  const f = fixture();
  const expected = await f.resolve();
  f.state.artifacts.get(100)[0].workflow_run.id = 99;
  await rejectsPublication(f, expected);
});

test('an empty-association fork run cannot borrow another head repository or unverifiable SHA', async () => {
  for (const mutation of [{ head_repository: { id: 3 } }, { head_sha: 'b'.repeat(40) }]) {
    const f = fixture();
    const expected = await f.resolve();
    Object.assign(f.state.runs.get(100), mutation);
    await rejectsPublication(f, expected);
  }
});

test('nonempty associations must identify this PR and its actual head repository', async () => {
  const f = fixture(
    build(100, {
      pull_requests: [{ number: 597, head: { sha, repo: { id: 2 } } }],
    })
  );
  await assert.rejects(f.resolve);
  assert.deepEqual(f.state.published, []);
});

test('failed GitHub lookups never authorize preview publication', async () => {
  for (const endpoint of ['pull', 'run', 'workflow', 'repository', 'artifacts', 'recency']) {
    const f = fixture();
    const expected = await f.resolve();
    f.state.fail = endpoint;
    await rejectsPublication(f, expected);
  }
});

test('recency enumeration includes a newer relevant build beyond the first page', async () => {
  const f = fixture();
  const expected = await f.resolve();
  for (let id = 101; id <= 200; id++)
    f.add(build(id, { head_repository: { id: 3 }, head_branch: 'other' }));
  const newer = build(201);
  f.state.runs.set(201, newer);
  f.state.listed.push(newer);
  await rejectsPublication(f, expected);
});

test('a search-cap or changing run enumeration fails closed rather than truncating recency', async () => {
  const oversized = fixture();
  const expected = await oversized.resolve();
  oversized.state.listed = Array.from({ length: 1000 }, (_, index) => build(index + 100));
  await rejectsPublication(oversized, expected);

  const changing = fixture();
  const bound = await changing.resolve();
  for (let id = 101; id <= 200; id++)
    changing.add(build(id, { head_repository: { id: 3 }, head_branch: 'other' }));
  changing.state.onList = (page) => {
    if (page === 1) changing.add(build(201, { head_repository: { id: 3 }, head_branch: 'other' }));
  };
  await rejectsPublication(changing, bound);
});
