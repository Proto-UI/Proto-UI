import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY = 'Proto-UI/Proto-UI';
const SNAPSHOT_PATH = 'internal/coverage-matrices/github-governance-snapshot.json';
const MATRIX_PATHS = [
  'internal/website/self-hosting-coverage-matrix.md',
  'internal/agent-harness/dogfood-coverage-matrix.md',
];

function parseMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = [];
  let current = '';
  const inner = trimmed.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === '\\' && inner[index + 1] === '|') {
      current += '|';
      index += 1;
    } else if (inner[index] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += inner[index];
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizedOwnerToken(value) {
  const owner = value.match(/\bowners?\s*:\s*([^;|]+)/iu)?.[1];
  return (
    owner
      ?.split(/[.!?。！？]/u, 1)[0]
      .trim()
      .toLowerCase() || null
  );
}

export function collectDependencyOwners(matrixContents) {
  const ownersByIssue = new Map();
  for (const content of matrixContents) {
    let dependencyIndex = -1;
    for (const line of content.split(/\r?\n/u)) {
      const cells = parseMarkdownRow(line);
      if (!cells) continue;
      if (cells.includes('Dependency and owner')) {
        dependencyIndex = cells.indexOf('Dependency and owner');
        continue;
      }
      if (dependencyIndex < 0 || cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) continue;
      const dependency = cells[dependencyIndex] ?? '';
      const owner = normalizedOwnerToken(dependency);
      if (!owner) continue;
      for (const match of dependency.matchAll(/#([1-9]\d*)\b/gu)) {
        const number = Number(match[1]);
        const owners = ownersByIssue.get(number) ?? new Set();
        owners.add(owner);
        ownersByIssue.set(number, owners);
      }
    }
  }
  return new Map(
    [...ownersByIssue]
      .sort(([left], [right]) => left - right)
      .map(([number, owners]) => [number, new Set([...owners].sort())])
  );
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function reconcileGovernanceSnapshot({
  currentSnapshot,
  dependencyOwners,
  liveIssues,
  livePullRequests,
}) {
  if (
    currentSnapshot?.schemaVersion !== 1 ||
    currentSnapshot.repository !== REPOSITORY ||
    !Array.isArray(currentSnapshot.issues) ||
    !Array.isArray(currentSnapshot.pullRequests)
  ) {
    throw new Error(
      'governance snapshot must use schemaVersion 1 and repository Proto-UI/Proto-UI'
    );
  }
  const currentIssues = new Map(currentSnapshot.issues.map((issue) => [issue.number, issue]));
  const referencedNumbers = [...dependencyOwners.keys()].sort((left, right) => left - right);
  const currentNumbers = [...currentIssues.keys()].sort((left, right) => left - right);
  if (!sameStrings(referencedNumbers, currentNumbers)) {
    throw new Error(
      'snapshot Issue numbers must exactly match matrix dependency bindings; add or remove seed entries explicitly before refresh'
    );
  }
  for (const [number, matrixOwners] of dependencyOwners) {
    const reviewedOwners = [...(currentIssues.get(number)?.owners ?? [])].sort();
    if (!sameStrings(reviewedOwners, [...matrixOwners])) {
      throw new Error(
        `reviewed owners for Issue #${number} do not match matrix owner tokens; edit owners explicitly instead of auto-guessing`
      );
    }
  }
  const liveIssueMap = new Map(liveIssues.map((issue) => [issue.number, issue]));
  const issues = referencedNumbers.map((number) => {
    const live = liveIssueMap.get(number);
    if (!live) throw new Error(`live Issue #${number} was not returned`);
    return { ...live, owners: [...dependencyOwners.get(number)] };
  });
  const currentPullRequestNumbers = currentSnapshot.pullRequests
    .map((pullRequest) => pullRequest.number)
    .sort((left, right) => left - right);
  const livePullRequestMap = new Map(
    livePullRequests.map((pullRequest) => [pullRequest.number, pullRequest])
  );
  const pullRequests = currentPullRequestNumbers.map((number) => {
    const live = livePullRequestMap.get(number);
    if (!live) throw new Error(`live pull request #${number} was not returned`);
    return live;
  });
  return { schemaVersion: 1, repository: REPOSITORY, issues, pullRequests };
}

function githubJson(endpoint) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return JSON.parse(
        execFileSync('gh', ['api', endpoint], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`GitHub API request failed after 3 attempts: ${endpoint}`, {
    cause: lastError,
  });
}

function liveIssue(number) {
  const issue = githubJson(`repos/${REPOSITORY}/issues/${number}`);
  return {
    number: issue.number,
    nodeId: issue.node_id,
    url: issue.html_url,
    title: issue.title,
    state: issue.state.toUpperCase(),
    stateReason: issue.state_reason?.toUpperCase() ?? null,
    updatedAt: issue.updated_at,
    labels: issue.labels.map((label) => label.name).sort(),
    assignees: issue.assignees.map((assignee) => assignee.login).sort(),
    milestone: issue.milestone?.title ?? null,
  };
}

function livePullRequest(number) {
  const pullRequest = githubJson(`repos/${REPOSITORY}/pulls/${number}`);
  return {
    number: pullRequest.number,
    nodeId: pullRequest.node_id,
    url: pullRequest.html_url,
    title: pullRequest.title,
    state: pullRequest.merged_at ? 'MERGED' : pullRequest.state.toUpperCase(),
    updatedAt: pullRequest.updated_at,
    headSha: pullRequest.head.sha,
    mergeCommit: pullRequest.merge_commit_sha,
  };
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isMainModule()) {
  const mode = process.argv[2];
  if (!['--check', '--write'].includes(mode) || process.argv.length !== 3) {
    throw new Error('usage: node sync-github-governance-snapshot.mjs --check|--write');
  }
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const absoluteSnapshotPath = path.join(rootDir, SNAPSHOT_PATH);
  const currentSnapshot = JSON.parse(fs.readFileSync(absoluteSnapshotPath, 'utf8'));
  const dependencyOwners = collectDependencyOwners(
    MATRIX_PATHS.map((matrixPath) => fs.readFileSync(path.join(rootDir, matrixPath), 'utf8'))
  );
  const liveIssues = [...dependencyOwners.keys()].map(liveIssue);
  const livePullRequests = currentSnapshot.pullRequests.map(({ number }) =>
    livePullRequest(number)
  );
  const reconciled = reconcileGovernanceSnapshot({
    currentSnapshot,
    dependencyOwners,
    liveIssues,
    livePullRequests,
  });
  const serialized = `${JSON.stringify(reconciled, null, 2)}\n`;
  if (mode === '--write') {
    fs.writeFileSync(absoluteSnapshotPath, serialized, 'utf8');
    console.log(`[coverage-governance] refreshed ${reconciled.issues.length} Issues`);
  } else if (fs.readFileSync(absoluteSnapshotPath, 'utf8') !== serialized) {
    throw new Error(
      `governance snapshot drifted from live ${REPOSITORY}; run the explicit --write refresh workflow`
    );
  } else {
    console.log(`[coverage-governance] OK (${reconciled.issues.length} Issues)`);
  }
}
