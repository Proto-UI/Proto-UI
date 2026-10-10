import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import {
  admitPreviewBuild,
  listPreviewBuildArtifacts,
  resolvePreviewBuild,
} from './build-admission.mjs';
import { downloadVerifiedArtifact, materializeBoundedZip } from './extract-artifact.mjs';
import { sanitizePreviewTree } from './sanitize-tree.mjs';

const workflow = 'intranet-preview-build.yml';
const generationPattern = /^p[1-9][0-9]*-r[1-9][0-9]*-a[1-9][0-9]*$/;
const generationFor = (binding) => `p${binding.pr}-r${binding.run_id}-a${binding.run_attempt}`;

export function githubClient(token, signal) {
  if (!token || /[\r\n]/.test(token))
    throw new Error('A repository-scoped Actions-read token is required');
  const get = async (path, query = {}) => {
    const url = new URL(`https://api.github.com/repos/Proto-UI/Proto-UI${path ? `/${path}` : ''}`);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      signal: AbortSignal.any([AbortSignal.timeout(20_000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
    return { data: await response.json() };
  };
  // Only read endpoints exist here. The hosted builder is the only component
  // that executes a contributor checkout; this worker only handles data.
  return {
    rest: {
      repos: { get: () => get('') },
      pulls: {
        get: ({ pull_number }) => get(`pulls/${pull_number}`),
        list: ({ page }) => get('pulls', { state: 'open', per_page: 100, page }),
      },
      actions: {
        getWorkflow: ({ workflow_id }) =>
          get(`actions/workflows/${encodeURIComponent(workflow_id)}`),
        getWorkflowRun: ({ run_id }) => get(`actions/runs/${run_id}`),
        listWorkflowRunArtifacts: ({ run_id, page, per_page }) =>
          get(`actions/runs/${run_id}/artifacts`, { page, per_page }),
        listWorkflowRuns: ({ workflow_id, page, per_page, created, event, branch }) =>
          get(`actions/workflows/${encodeURIComponent(workflow_id)}/runs`, {
            page,
            per_page,
            created,
            event,
            branch,
          }),
      },
    },
  };
}

async function openPullRequests(github) {
  const result = [],
    seen = new Set();
  for (let page = 1; page <= 10; page++) {
    const { data } = await github.rest.pulls.list({ page });
    if (!Array.isArray(data)) throw new Error('Invalid open pull-request enumeration');
    for (const pr of data) {
      if (
        !Number.isSafeInteger(pr.number) ||
        pr.number < 1 ||
        seen.has(pr.number) ||
        pr.state !== 'open' ||
        !/^[0-9a-f]{40}$/.test(pr.head?.sha || '') ||
        pr.base?.repo?.full_name !== 'Proto-UI/Proto-UI'
      )
        throw new Error('Incomplete or changing open pull-request enumeration');
      seen.add(pr.number);
      result.push(pr);
    }
    if (data.length < 100) return result;
  }
  throw new Error('Open pull-request enumeration exceeded its bound');
}

async function workflowRuns(github, query) {
  const result = [],
    seen = new Set();
  let total;
  for (let page = 1; page <= 10; page++) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      workflow_id: workflow,
      per_page: 100,
      page,
      ...query,
    });
    if (
      !Array.isArray(data?.workflow_runs) ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count < 0 ||
      data.total_count >= 1000 ||
      (total !== undefined && data.total_count !== total)
    )
      throw new Error('Incomplete or changing build enumeration');
    total = data.total_count;
    for (const run of data.workflow_runs) {
      if (
        !Number.isSafeInteger(run.id) ||
        run.id < 1 ||
        !Number.isSafeInteger(run.run_number) ||
        !Number.isSafeInteger(run.run_attempt) ||
        run.run_attempt < 1 ||
        seen.has(run.id)
      )
        throw new Error('Invalid or repeated workflow run');
      seen.add(run.id);
      result.push(run);
    }
    if (result.length === total) return result.sort((a, b) => b.run_number - a.run_number);
    if (result.length > total || data.workflow_runs.length < 100) break;
  }
  throw new Error('Build enumeration exceeded its bound');
}

async function candidateRuns(github, prs) {
  const runs = new Map();
  // A rerun retains its original created_at. Discover all manual producers
  // and each live PR branch, without a time cutoff or an unbounded repository
  // history scan. Fork collisions are rejected by the shared admission guard.
  const queries = [
    { event: 'workflow_dispatch' },
    ...[...new Set(prs.map((pr) => pr.head.ref))].map((branch) => ({
      event: 'pull_request',
      branch,
    })),
  ];
  for (const query of queries) {
    for (const run of await workflowRuns(github, query)) {
      const previous = runs.get(run.id);
      if (
        previous &&
        ['run_number', 'run_attempt', 'status', 'conclusion'].some(
          (key) => previous[key] !== run[key]
        )
      )
        throw new Error('Build identity changed across discovery queries');
      runs.set(run.id, run);
    }
  }
  return [...runs.values()].sort((a, b) => b.run_number - a.run_number);
}

async function saveManifest(root, manifest) {
  const temporary = join(root, 'current.next.json');
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o644 });
  await rename(temporary, join(root, 'current.json'));
}

export async function synchronizePreviews({
  root,
  github,
  token,
  download = downloadVerifiedArtifact,
  now = Date.now,
}) {
  root = resolve(root);
  await mkdir(root, { recursive: true, mode: 0o755 });
  // The CLI owns a native flock for this entire operation. Embedded callers
  // must provide the same serialization; a directory is not a lifetime lock.
  const startedAt = now();
  const context = { repo: { owner: 'Proto-UI', repo: 'Proto-UI' } };
  let staging;
  let expiredManualAttempts = new Set();
  try {
    let previous;
    try {
      previous = JSON.parse(await readFile(join(root, 'current.json'), 'utf8'));
    } catch {
      previous = { previews: [] };
    }
    const prs = await openPullRequests(github);
    if (prs.some((pr) => typeof pr.head.ref !== 'string' || !pr.head.ref))
      throw new Error('Open pull-request branch metadata is unavailable');
    const runs = await candidateRuns(github, prs);
    const manualKeys = new Set(
      runs
        .filter((run) => run.event === 'workflow_dispatch')
        .map((run) => `${run.id}:${run.run_attempt}`)
    );
    expiredManualAttempts = new Set(
      (previous.expiredManualAttempts || []).filter((key) => manualKeys.has(key))
    );
    const previews = prs.map((pr) => ({
      pr: String(pr.number),
      head_sha: pr.head.sha,
      status: 'unavailable',
    }));
    // Immediately revoke known obsolete heads/runs without extending any old
    // lease. Still-current content remains usable while replacement bytes are
    // staged; the final catalog contains only newly admitted Ready rows.
    const manifest = {
      checkedAt: new Date(startedAt).toISOString(),
      previews,
      expiredManualAttempts: [...expiredManualAttempts],
    };
    const heads = new Map(prs.map((pr) => [String(pr.number), pr.head.sha]));
    const retainedDuringScan = (previous.previews || []).filter((row) => {
      if (row.status !== 'ready' || heads.get(row.pr) !== row.head_sha) return false;
      const own = runs.find((run) => String(run.id) === row.binding?.run_id);
      if (
        !own ||
        String(own.run_attempt) !== row.binding.run_attempt ||
        own.status !== 'completed' ||
        own.conclusion !== 'success'
      )
        return false;
      return !runs.some(
        (run) =>
          run.run_number > own.run_number &&
          (run.event === 'workflow_dispatch' ||
            run.pull_requests?.some((pr) => String(pr.number) === row.pr) ||
            run.head_sha === row.head_sha)
      );
    });
    await saveManifest(root, {
      checkedAt: previous.checkedAt || manifest.checkedAt,
      previews: retainedDuringScan,
      expiredManualAttempts: [...expiredManualAttempts],
    });
    await mkdir(join(root, 'sites'), { recursive: true, mode: 0o755 });
    staging = join(root, '.staging');
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { mode: 0o700 });
    const manual = new Map();
    for (const run of prs.length
      ? runs.filter(
          (item) =>
            item.event === 'workflow_dispatch' &&
            item.status === 'completed' &&
            item.conclusion === 'success'
        )
      : []) {
      if (now() - startedAt > 240_000)
        throw new Error('Publication scan exceeded its freshness window');
      const key = `${run.id}:${run.run_attempt}`;
      if (expiredManualAttempts.has(key)) continue;
      try {
        const artifacts = await listPreviewBuildArtifacts(github, context.repo, run);
        if (artifacts.length > 0 && artifacts.every((artifact) => artifact.expired === true)) {
          // Expiration is terminal for an immutable completed attempt. Cache
          // only this negative discovery fact, never an authorization. A fresh
          // rerun changes its attempt key and must inspect its new artifacts.
          expiredManualAttempts.add(key);
          continue;
        }
        const resolved = await resolvePreviewBuild({
          github,
          context,
          runId: run.id,
          kind: 'success',
        });
        if (!manual.has(resolved.binding.pr)) manual.set(resolved.binding.pr, resolved);
      } catch {
        /* Not an admissible current-head producer; never publish it. */
      }
    }
    for (let index = 0; index < prs.length; index++) {
      if (now() - startedAt > 240_000)
        throw new Error('Publication scan exceeded its freshness window');
      const pr = prs[index],
        row = previews[index];
      const associated = runs.find(
        (run) =>
          run.event === 'pull_request' &&
          (run.pull_requests?.some(
            (item) => item.number === pr.number && item.head?.sha === pr.head.sha
          ) ||
            (run.pull_requests?.length === 0 &&
              run.head_sha === pr.head.sha &&
              run.head_repository?.id === pr.head.repo?.id &&
              run.head_branch === pr.head.ref))
      );
      const manualResolved = manual.get(row.pr);
      const run =
        manualResolved && (!associated || manualResolved.run.run_number > associated.run_number)
          ? manualResolved.run
          : associated;
      if (!run) continue;
      if (run.status !== 'completed') {
        row.status = 'building';
        continue;
      }
      if (run.conclusion !== 'success') {
        row.status = 'failed';
        continue;
      }
      try {
        const old = previous.previews?.find(
          (item) =>
            item.pr === row.pr &&
            item.head_sha === row.head_sha &&
            item.status === 'ready' &&
            item.binding?.run_id === String(run.id) &&
            item.binding?.run_attempt === String(run.run_attempt)
        );
        const binding =
          old?.binding ||
          (run === manualResolved?.run
            ? manualResolved.binding
            : (await resolvePreviewBuild({ github, context, runId: run.id, kind: 'success' }))
                .binding);
        const generation = generationFor(binding);
        if (!generationPattern.test(generation)) throw new Error('Invalid preview generation');
        const destination = join(root, 'sites', generation);
        let exists = false;
        if (old) {
          try {
            exists = (await stat(join(destination, 'index.html'))).isFile();
          } catch {
            /* Rebuild missing owned data. */
          }
        }
        if (!exists) {
          const bytes = await download({
            token,
            repository: 'Proto-UI/Proto-UI',
            artifactId: Number(binding.artifact_id),
            runId: Number(binding.run_id),
          });
          const extracted = join(staging, 'extracted'),
            clean = join(staging, generation);
          await materializeBoundedZip(bytes, extracted);
          await sanitizePreviewTree({ source: extracted, output: clean });
          const entrypoint = await stat(join(clean, 'index.html'));
          if (!entrypoint.isFile() || entrypoint.size === 0)
            throw new Error('Preview has no static entrypoint');
          await rm(extracted, { recursive: true, force: true });
          // An existing generation is never overwritten with different bytes.
          // A missing entrypoint in one is corruption, not permission to replace.
          try {
            await stat(destination);
            throw new Error('Existing generation is incomplete');
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          await rename(clean, destination);
        }
        // Every retained and newly staged generation passes the same final
        // guard under the global publication lock. GitHub can still change
        // after a read; serving is bounded by the original scan's lease.
        await admitPreviewBuild({
          github,
          context,
          runId: run.id,
          kind: 'success',
          expected: binding,
        });
        if (now() - startedAt > 240_000)
          throw new Error('Publication scan exceeded its freshness window');
        Object.assign(row, { status: 'ready', generation, binding });
      } catch (error) {
        row.status = 'unavailable';
        console.error(`PR #${row.pr} preview withheld: ${error.message}`);
      }
    }
    // Re-read the live open-head set before renewing the catalog lease. A
    // closed PR or changed head cannot be reintroduced from the first scan.
    const live = new Map(
      (await openPullRequests(github)).map((pr) => [String(pr.number), pr.head.sha])
    );
    manifest.previews = previews.filter((row) => live.get(row.pr) === row.head_sha);
    manifest.expiredManualAttempts = [...expiredManualAttempts];
    await saveManifest(root, manifest);
    const retained = new Set(
      manifest.previews.filter((row) => row.status === 'ready').map((row) => row.generation)
    );
    for (const entry of await readdir(join(root, 'sites'), { withFileTypes: true })) {
      if (generationPattern.test(entry.name) && !retained.has(entry.name))
        await rm(join(root, 'sites', entry.name), { recursive: true, force: true });
    }
    return manifest;
  } catch (error) {
    // API/authentication/pagination failures explicitly invalidate serving;
    // process death independently expires the last catalog within five minutes.
    await saveManifest(root, {
      checkedAt: new Date(startedAt).toISOString(),
      previews: [],
      expiredManualAttempts: [...expiredManualAttempts],
      error: 'Synchronization failed',
    }).catch(() => {});
    throw error;
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (process.argv[3] !== '--locked') {
    await mkdir(resolve(config.root), { recursive: true, mode: 0o750 });
    const child = spawn(
      'flock',
      [
        '--nonblock',
        '--no-fork',
        join(resolve(config.root), '.publish.lock'),
        process.execPath,
        process.argv[1],
        process.argv[2],
        '--locked',
      ],
      { stdio: 'inherit' }
    );
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    const [code, signal] = await once(child, 'exit');
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143);
  } else {
    if (Boolean(config.tokenFile) === Boolean(config.ghPath))
      throw new Error('Select one protected token file or the existing trusted-seat gh identity');
    const token = (
      config.tokenFile
        ? await readFile(config.tokenFile, 'utf8')
        : (
            await promisify(execFile)(
              config.ghPath,
              ['auth', 'token', '--hostname', 'github.com'],
              { timeout: 20_000, maxBuffer: 16_384 }
            )
          ).stdout
    ).trim();
    const signal = AbortSignal.timeout(240_000);
    const result = await synchronizePreviews({
      root: config.root,
      github: githubClient(token, signal),
      token,
      download: (options) =>
        downloadVerifiedArtifact({
          ...options,
          fetchImpl: (url, init) =>
            fetch(url, {
              ...init,
              signal: AbortSignal.any([signal, ...(init.signal ? [init.signal] : [])]),
            }),
        }),
    });
    console.log(
      JSON.stringify({
        checkedAt: result.checkedAt,
        previews: result.previews.map(({ pr, head_sha, status, generation }) => ({
          pr,
          head_sha,
          status,
          generation,
        })),
      })
    );
  }
}
