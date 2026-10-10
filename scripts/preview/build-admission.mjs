const buildWorkflow = '.github/workflows/intranet-preview-build.yml';
const shaPattern = /^[0-9a-f]{40}$/;
const bindingPattern = /^intranet-preview-binding-([1-9][0-9]*)-([0-9a-f]{40})-([1-9][0-9]*)$/;
const sitePattern = /^intranet-preview-([1-9][0-9]*)-([0-9a-f]{40})-([1-9][0-9]*)$/;
const failedConclusions = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'neutral',
  'skipped',
  'stale',
]);
const maxRunPages = 10;
const maxArtifactPages = 4;

function positive(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${label}`);
  return value;
}

function verifyRun(run, repo, workflowId) {
  positive(run?.id, 'build run ID');
  positive(run.run_number, 'build run number');
  positive(run.run_attempt, 'build run attempt');
  positive(run.workflow_id, 'build workflow ID');
  positive(run.repository?.id, 'build base repository ID');
  positive(run.head_repository?.id, 'build head repository ID');
  if (
    run.repository?.full_name !== `${repo.owner}/${repo.repo}` ||
    !['pull_request', 'workflow_dispatch'].includes(run.event) ||
    (workflowId !== undefined && run.workflow_id !== workflowId) ||
    !shaPattern.test(run.head_sha || '') ||
    typeof run.head_branch !== 'string' ||
    run.head_branch.length === 0 ||
    !Array.isArray(run.pull_requests)
  ) {
    throw new Error('Build run metadata is not bound to the expected repository and workflow');
  }
}

export async function listPreviewBuildArtifacts(github, repo, run) {
  const artifacts = [];
  const seen = new Set();
  let total;
  for (let page = 1; page <= maxArtifactPages; page++) {
    const { data } = await github.rest.actions.listWorkflowRunArtifacts({
      ...repo,
      run_id: run.id,
      per_page: 100,
      page,
    });
    if (
      !Array.isArray(data?.artifacts) ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count < 0 ||
      data.total_count > maxArtifactPages * 100 ||
      (total !== undefined && total !== data.total_count)
    ) {
      throw new Error('Artifact lookup is incomplete or exceeds the admission bound');
    }
    total = data.total_count;
    for (const artifact of data.artifacts) {
      positive(artifact?.id, 'listed artifact ID');
      if (seen.has(artifact.id)) throw new Error('Artifact lookup repeated an artifact');
      seen.add(artifact.id);
    }
    artifacts.push(...data.artifacts);
    if (artifacts.length === data.total_count) return artifacts;
    if (artifacts.length > data.total_count || data.artifacts.length < 100) break;
  }
  throw new Error('Artifact lookup did not enumerate every artifact');
}

function artifactBinding(artifacts, run, pattern) {
  const matches = [];
  for (const artifact of artifacts) {
    const match = pattern.exec(artifact.name || '');
    if (!match || artifact.expired || Number(match[3]) !== run.run_attempt) continue;
    positive(artifact.id, 'artifact ID');
    positive(artifact.size_in_bytes, 'artifact size');
    if (
      artifact.workflow_run?.id !== run.id ||
      artifact.workflow_run?.head_sha !== run.head_sha ||
      artifact.workflow_run?.repository_id !== run.repository.id ||
      artifact.workflow_run?.head_repository_id !== run.head_repository?.id
    ) {
      throw new Error('Artifact does not belong to the verified build run');
    }
    matches.push({ artifact, pr: positive(Number(match[1]), 'artifact PR'), sha: match[2] });
  }
  if (matches.length !== 1)
    throw new Error('Build run has no unique current-attempt artifact binding');
  return matches[0];
}

function verifyPullRequest(pr, repo, number, sha) {
  if (
    pr?.number !== number ||
    pr.state !== 'open' ||
    pr.head?.sha !== sha ||
    !shaPattern.test(sha) ||
    !Number.isSafeInteger(pr.head.repo?.id) ||
    pr.base?.repo?.full_name !== `${repo.owner}/${repo.repo}`
  ) {
    throw new Error('Build no longer targets the live open pull request head');
  }
}

function pullRequestRunMatches(run, pr) {
  if (run.head_repository?.id !== pr.head.repo.id || run.head_branch !== pr.head.ref) return false;
  if (run.pull_requests.length === 0) {
    // Fork runs may omit associations. In that case the API's actual head SHA,
    // repository and branch must agree; a display title is never evidence.
    if (run.head_sha !== pr.head.sha)
      throw new Error('Unassociated PR run has no verifiable live head binding');
    return true;
  }
  const associated = run.pull_requests.find((item) => item.number === pr.number);
  if (
    associated &&
    (!shaPattern.test(associated.head?.sha || '') ||
      !Number.isSafeInteger(associated.head?.repo?.id))
  ) {
    throw new Error('PR run association has incomplete head metadata');
  }
  return associated?.head?.sha === pr.head.sha && associated.head.repo?.id === pr.head.repo.id;
}

function trustedManualRun(run, repository) {
  return (
    run.head_repository?.id === repository.id &&
    run.repository.id === repository.id &&
    run.head_branch === repository.default_branch
  );
}

function verifyExpected(binding, expected) {
  if (!expected) return;
  for (const key of ['pr', 'head_sha', 'run_id', 'run_attempt']) {
    if (String(binding[key]) !== String(expected[key]))
      throw new Error('Build tuple was superseded before admission');
  }
  if (
    expected.artifact_id !== undefined &&
    String(binding.artifact_id) !== String(expected.artifact_id)
  ) {
    throw new Error('Build artifact changed before admission');
  }
}

export async function resolvePreviewBuild({ github, context, runId, kind, expected }) {
  positive(runId, 'requested build run ID');
  if (!['success', 'failed'].includes(kind)) throw new Error('Invalid build admission kind');
  const repo = context.repo;
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: runId });
  verifyRun(run, repo);
  if (
    run.id !== runId ||
    run.status !== 'completed' ||
    (kind === 'success' ? run.conclusion !== 'success' : !failedConclusions.has(run.conclusion))
  ) {
    throw new Error('Build run has no eligible completed conclusion');
  }
  const { data: workflow } = await github.rest.actions.getWorkflow({
    ...repo,
    workflow_id: run.workflow_id,
  });
  if (workflow?.path !== buildWorkflow)
    throw new Error('Build run came from an unexpected workflow');
  const { data: repository } = await github.rest.repos.get(repo);
  if (
    repository?.full_name !== `${repo.owner}/${repo.repo}` ||
    !Number.isSafeInteger(repository.id) ||
    run.repository.id !== repository.id
  ) {
    throw new Error('Base repository lookup is invalid');
  }
  if (run.event === 'workflow_dispatch' && !trustedManualRun(run, repository)) {
    throw new Error('Manual build did not execute from the trusted default branch');
  }
  const artifacts = await listPreviewBuildArtifacts(github, repo, run);
  // On a manual run the default-branch definition uploads this marker before
  // PR code runs. Site names alone cannot identify the PR it actually built.
  const marker = artifactBinding(artifacts, run, bindingPattern);
  const candidate = kind === 'success' ? artifactBinding(artifacts, run, sitePattern) : marker;
  if (candidate.pr !== marker.pr || candidate.sha !== marker.sha) {
    throw new Error('Site artifact disagrees with the immutable build binding');
  }
  if (kind === 'success' && candidate.artifact.size_in_bytes > 500 * 1024 * 1024) {
    throw new Error('Build artifact exceeds the 500 MiB safety limit');
  }
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: marker.pr });
  verifyPullRequest(pr, repo, marker.pr, marker.sha);
  if (run.event === 'pull_request' && !pullRequestRunMatches(run, pr)) {
    throw new Error('Build run is not bound to the live PR head repository, branch and SHA');
  }
  const binding = {
    pr: String(pr.number),
    head_sha: pr.head.sha,
    previewId: `pr-${pr.number}`,
    artifact_id: String(candidate.artifact.id),
    artifact_size: String(candidate.artifact.size_in_bytes),
    run_id: String(run.id),
    run_attempt: String(run.run_attempt),
    author_login: pr.user.login,
    author_id: String(positive(pr.user.id, 'PR author ID')),
  };
  verifyExpected(binding, expected);
  return { binding, run, pr, repository };
}

export async function admitPreviewBuild(options) {
  const { github, context, expected } = options;
  if (!expected) throw new Error('Post-lock admission requires the resolved build tuple');
  const resolved = await resolvePreviewBuild(options);
  const { binding, run, pr, repository } = resolved;
  if (
    typeof run.created_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(run.created_at) ||
    !Number.isFinite(Date.parse(run.created_at))
  )
    throw new Error('Build creation time is unavailable');
  const seen = new Set();
  let total;
  let complete = false;
  for (let page = 1; page <= maxRunPages; page++) {
    // No head_sha/event/branch filter: manual builds execute at the default
    // branch SHA and fork runs may have empty pull_requests. Creation time
    // includes this run and every later workflow run number, including queued
    // builds; a rerun of this run is checked separately by run_attempt.
    const { data } = await github.rest.actions.listWorkflowRuns({
      ...context.repo,
      workflow_id: run.workflow_id,
      created: `>=${run.created_at}`,
      per_page: 100,
      page,
    });
    if (
      !Array.isArray(data?.workflow_runs) ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count < 1 ||
      data.total_count >= maxRunPages * 100 ||
      (total !== undefined && total !== data.total_count)
    ) {
      throw new Error(
        'Build recency lookup is incomplete, changing or exceeds the admission bound'
      );
    }
    total = data.total_count;
    for (const item of data.workflow_runs) {
      positive(item?.id, 'listed build run ID');
      positive(item.run_number, 'listed build run number');
      if (seen.has(item.id)) throw new Error('Build recency lookup repeated a run');
      seen.add(item.id);
      if (item.id === run.id) {
        if (item.run_number !== run.run_number)
          throw new Error('Candidate build run number changed identity');
        continue;
      }
      if (item.run_number < run.run_number) continue;
      if (item.run_number === run.run_number)
        throw new Error('Build run number has ambiguous ownership');
      if (!['pull_request', 'workflow_dispatch'].includes(item.event)) continue;
      const { data: newer } = await github.rest.actions.getWorkflowRun({
        ...context.repo,
        run_id: item.id,
      });
      verifyRun(newer, context.repo, run.workflow_id);
      if (newer.id !== item.id || newer.run_number !== item.run_number)
        throw new Error('Listed build run changed identity');
      let relevant;
      if (newer.event === 'pull_request') {
        relevant = pullRequestRunMatches(newer, pr);
      } else if (!trustedManualRun(newer, repository)) {
        relevant = false;
      } else {
        const marker = artifactBinding(
          await listPreviewBuildArtifacts(github, context.repo, newer),
          newer,
          bindingPattern
        );
        relevant = marker.pr === pr.number && marker.sha === pr.head.sha;
      }
      if (relevant) throw new Error('A newer eligible build superseded this run');
    }
    if (seen.size === total) {
      complete = true;
      break;
    }
    if (seen.size > total || data.workflow_runs.length < 100) break;
  }
  if (!complete || !seen.has(run.id))
    throw new Error('Build recency lookup did not enumerate the candidate and all newer runs');
  // Reread after enumeration: a rerun can retain its run ID/number while its
  // attempt changes. This is an admission guard, not atomic publication ordering.
  const { data: current } = await github.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: run.id,
  });
  verifyRun(current, context.repo, run.workflow_id);
  if (
    current.run_attempt !== run.run_attempt ||
    current.status !== 'completed' ||
    current.conclusion !== run.conclusion
  ) {
    throw new Error('Build attempt changed during admission');
  }
  const { data: live } = await github.rest.pulls.get({ ...context.repo, pull_number: pr.number });
  verifyPullRequest(live, context.repo, pr.number, pr.head.sha);
  return binding;
}
