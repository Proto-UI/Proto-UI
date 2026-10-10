import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { synchronizePreviews } from './publish.mjs';

// A real stored ZIP, not a materializer mock: extraction and sanitation stay
// part of the publication boundary exercised by every transition below.
const archive = Buffer.from(
  'UEsDBBQAAAAIAGiKSV1ye59HGgAAABkAAAAKAAAAaW5kZXguaHRtbLPJMLRzTMnNLClJTVEoKEoty0wtt9EHCgIAUEsDBBQAAAAIAGiKSV2Z8S8JGQAAABcAAAAGAAAAYXBwLmpzS8/JT0rMCcnILNbLyU9MSU2xLSkqTbUGAFBLAQIUAxQAAAAIAGiKSV1ye59HGgAAABkAAAAKAAAAAAAAAAAAAACAAQAAAABpbmRleC5odG1sUEsBAhQDFAAAAAgAaIpJXZnxLwkZAAAAFwAAAAYAAAAAAAAAAAAAAIABQgAAAGFwcC5qc1BLBQYAAAAAAgACAGwAAAB/AAAAAAA=',
  'base64'
);

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'intranet-preview-publish-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = { id: 1, full_name: 'Proto-UI/Proto-UI', default_branch: 'main' };
  const pr = {
    number: 596,
    state: 'open',
    head: { sha: 'a'.repeat(40), ref: 'topic', repo: { id: 2 } },
    base: { repo: base },
    user: { login: 'author', id: 9 },
  };
  const run = {
    id: 100,
    run_number: 100,
    run_attempt: 1,
    workflow_id: 7,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    repository: base,
    head_repository: { id: 2 },
    head_branch: 'topic',
    head_sha: pr.head.sha,
    pull_requests: [],
  };
  const state = { open: true, fail: false, runs: [run], downloads: 0, onDownload: null };
  const response = (value) => {
    if (state.fail) throw new Error('GitHub unavailable');
    return { data: structuredClone(value) };
  };
  const github = {
    rest: {
      repos: { get: async () => response(base) },
      pulls: {
        list: async () => response(state.open ? [pr] : []),
        get: async () => response({ ...pr, state: state.open ? 'open' : 'closed' }),
      },
      actions: {
        getWorkflow: async () => response({ path: '.github/workflows/intranet-preview-build.yml' }),
        getWorkflowRun: async ({ run_id }) =>
          response(state.runs.find((item) => item.id === run_id)),
        listWorkflowRuns: async ({ created, event, branch }) => {
          const values = state.runs.filter(
            (item) =>
              (!created || Date.parse(item.created_at) >= Date.parse(created.slice(2))) &&
              (!event || item.event === event) &&
              (!branch || item.head_branch === branch)
          );
          return response({ total_count: values.length, workflow_runs: values });
        },
        listWorkflowRunArtifacts: async ({ run_id }) => {
          const current = state.runs.find((item) => item.id === run_id);
          return response({
            total_count: 2,
            artifacts: [true, false].map((marker) => ({
              id: current.id * 10 + (marker ? 1 : 2),
              name: `intranet-preview-${marker ? 'binding-' : ''}${pr.number}-${pr.head.sha}-${current.run_attempt}`,
              expired: false,
              size_in_bytes: marker ? 60 : archive.length,
              workflow_run: {
                id: current.id,
                head_sha: current.head_sha,
                repository_id: base.id,
                head_repository_id: pr.head.repo.id,
              },
            })),
          });
        },
      },
    },
  };
  const download = async () => {
    state.downloads++;
    await state.onDownload?.();
    return archive;
  };
  const sync = () => synchronizePreviews({ root, github, token: 'test-identity', download });
  const manifest = async () => JSON.parse(await readFile(join(root, 'current.json'), 'utf8'));
  return { root, pr, run, state, sync, manifest };
}

test('publishes sanitized bytes once and does not execute or replace a retained generation', async (t) => {
  const f = await fixture(t);
  const first = await f.sync();
  assert.equal(first.previews[0].status, 'ready');
  assert.equal(
    await readFile(join(f.root, 'sites', first.previews[0].generation, 'index.html'), 'utf8'),
    '<h1>Admitted preview</h1>'
  );
  await f.sync();
  assert.equal(f.state.downloads, 1);
});

test('never advertises a head that changed after download and staging', async (t) => {
  const f = await fixture(t);
  f.state.onDownload = () => {
    f.pr.head.sha = 'b'.repeat(40);
  };
  await f.sync();
  assert.deepEqual((await f.manifest()).previews, []);
});

test('closed PRs and newer failed runs revoke a previously Ready generation', async (t) => {
  const f = await fixture(t);
  await f.sync();
  f.state.runs.unshift({ ...f.run, id: 101, run_number: 101, conclusion: 'failure' });
  await f.sync();
  assert.equal((await f.manifest()).previews[0].status, 'failed');
  f.state.open = false;
  await f.sync();
  assert.deepEqual((await f.manifest()).previews, []);
});

test('an API failure invalidates the serving catalog rather than renewing stale Ready', async (t) => {
  const f = await fixture(t);
  await f.sync();
  f.state.fail = true;
  await assert.rejects(f.sync, /GitHub unavailable/);
  assert.deepEqual((await f.manifest()).previews, []);
  assert.equal((await f.manifest()).error, 'Synchronization failed');
});

test('a same-ID rerun receives a distinct origin and cannot reuse the old artifact', async (t) => {
  const f = await fixture(t);
  const first = await f.sync();
  f.run.run_attempt = 2;
  const second = await f.sync();
  assert.notEqual(second.previews[0].generation, first.previews[0].generation);
  assert.equal(second.previews[0].status, 'ready');
  assert.equal(f.state.downloads, 2);
});

test('a fresh rerun of an older run can publish its new attempt', async (t) => {
  const f = await fixture(t);
  f.run.created_at = new Date(Date.now() - 4 * 24 * 3600_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  f.run.run_attempt = 2;
  const result = await f.sync();
  assert.equal(result.previews[0].status, 'ready');
  assert.equal(result.previews[0].binding.run_attempt, '2');
});
