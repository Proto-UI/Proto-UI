import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function git(rootDir, args) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error(`Cannot bind rehearsal source: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout;
}

/** Bind the actual checkout, including uncommitted source; never relabel it as HEAD. */
export function captureRehearsalSource(rootDir) {
  const paths = [
    ...new Set(
      git(rootDir, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
        .split('\0')
        .filter(Boolean)
    ),
  ].sort();
  const digest = createHash('sha256');
  for (const file of paths) {
    const absolute = join(rootDir, file);
    digest.update(file + '\0');
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) {
      digest.update('missing\0');
      continue;
    }
    digest.update(`${stat.mode & 0o777}\0`);
    if (stat.isSymbolicLink()) digest.update(`symlink\0${readlinkSync(absolute)}`);
    else if (stat.isFile()) digest.update(readFileSync(absolute));
    else throw new Error(`Unsupported rehearsal source entry: ${file}`);
    digest.update('\0');
  }
  const status = git(rootDir, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const version = readFileSync(join(rootDir, 'VERSION'), 'utf8').trim();
  const bomPath = `internal/releases/${version}/package-bom.json`;
  return {
    revision: git(rootDir, ['rev-parse', 'HEAD']).trim(),
    committedTree: git(rootDir, ['rev-parse', 'HEAD^{tree}']).trim(),
    indexSha256: sha256(git(rootDir, ['ls-files', '--stage', '-z'])),
    clean: status === '',
    worktreeStatus: status,
    sourceFiles: paths.length,
    sourceSha256: digest.digest('hex'),
    version,
    bom: { path: bomPath, sha256: sha256(readFileSync(join(rootDir, bomPath))) },
    lockSha256: sha256(readFileSync(join(rootDir, 'pnpm-lock.yaml'))),
  };
}

function saveReceipt(artifactDir, receipt) {
  const destination = join(artifactDir, 'rehearsal.json');
  const temporary = destination + '.tmp';
  writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n');
  renameSync(temporary, destination);
}

// Resolve existing ancestors as well: an outside symlink must not put evidence
// in the checkout, even when its final destination does not exist yet.
function canonicalPath(path) {
  let ancestor = resolve(path);
  const remaining = [];
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
    remaining.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  return resolve(realpathSync(ancestor), ...remaining);
}

function sameSource(expected, actual) {
  return (
    expected.revision === actual.revision &&
    expected.committedTree === actual.committedTree &&
    expected.indexSha256 === actual.indexSha256 &&
    expected.sourceSha256 === actual.sourceSha256 &&
    expected.worktreeStatus === actual.worktreeStatus
  );
}

const errorRecord = (error) => ({
  code: error.code ?? null,
  message: String(error.message ?? error),
});

/** All original gates remain mandatory. Failure stops execution and retains not-run rows. */
export function runRehearsal({ rootDir, artifactDir, steps, packageManager, stepTimeoutMs = 0 }) {
  const resolvedRoot = canonicalPath(rootDir);
  const resolvedArtifacts = canonicalPath(artifactDir);
  const child = relative(resolvedRoot, resolvedArtifacts);
  if (
    child === '' ||
    (!isAbsolute(child) && child !== '..' && !child.startsWith('../') && !child.startsWith('..\\'))
  ) {
    throw new Error('Rehearsal artifacts must be outside the source checkout.');
  }
  if (existsSync(resolvedArtifacts) && readdirSync(resolvedArtifacts).length > 0) {
    throw new Error('Rehearsal artifact directory must be empty; preserve earlier receipts.');
  }
  mkdirSync(resolvedArtifacts, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.release-rehearsal',
    scope: 'Non-publishing preparation; not registry publication or release acceptance.',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    source: null,
    sourceAfter: null,
    sourceUnchanged: null,
    qualifiesAsFrozenCandidate: false,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      packageManager,
    },
    steps: steps.map(([label, command, args], index) => ({
      id: `step-${String(index + 1).padStart(2, '0')}`,
      label,
      command,
      args,
      status: 'not-run',
      reason: 'Earlier required steps have not completed.',
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      signal: null,
      error: null,
      log: null,
      logSha256: null,
      sourceBefore: null,
      sourceAfter: null,
      sourceUnchanged: null,
      artifactErrors: [],
    })),
  };
  saveReceipt(resolvedArtifacts, receipt);
  let failure = null;
  let sourceDrifted = false;
  try {
    receipt.source = captureRehearsalSource(resolvedRoot);
  } catch (error) {
    failure = 'source binding';
    sourceDrifted = true;
    receipt.sourceError = String(error.message ?? error);
  }
  saveReceipt(resolvedArtifacts, receipt);
  for (const step of receipt.steps) {
    if (failure) {
      step.reason = `Blocked by ${failure}.`;
      continue;
    }
    step.status = 'running';
    step.reason = null;
    step.startedAt = new Date().toISOString();
    step.log = `${step.id}.log`;
    saveReceipt(resolvedArtifacts, receipt);
    console.log(`[release rehearsal] ${step.label} (log: ${join(resolvedArtifacts, step.log)})`);
    let fd;
    let logOwned = false;
    let result = { status: null, signal: null, error: null };
    try {
      step.sourceBefore = captureRehearsalSource(resolvedRoot);
      if (!sameSource(receipt.source, step.sourceBefore)) {
        throw new Error('Source changed before this required step; command was not run.');
      }
      fd = openSync(join(resolvedArtifacts, step.log), 'wx');
      logOwned = true;
      result = spawnSync(step.command, step.args, {
        cwd: resolvedRoot,
        env: process.env,
        stdio: ['ignore', fd, fd],
        shell: process.platform === 'win32',
        ...(stepTimeoutMs > 0 ? { timeout: stepTimeoutMs } : {}),
      });
    } catch (error) {
      result = { status: null, signal: null, error };
    } finally {
      if (fd !== undefined) {
        try {
          closeSync(fd);
        } catch (error) {
          step.artifactErrors.push(errorRecord(error));
        }
      }
    }
    step.finishedAt = new Date().toISOString();
    step.exitCode = result.status;
    step.signal = result.signal;
    step.error = result.error ? errorRecord(result.error) : null;
    // Never digest a pre-existing collision as if it were this process's log.
    if (logOwned) {
      try {
        step.logSha256 = sha256(readFileSync(join(resolvedArtifacts, step.log)));
      } catch (error) {
        step.artifactErrors.push(errorRecord(error));
      }
    }
    try {
      step.sourceAfter = captureRehearsalSource(resolvedRoot);
      step.sourceUnchanged =
        step.sourceBefore !== null &&
        sameSource(receipt.source, step.sourceBefore) &&
        sameSource(receipt.source, step.sourceAfter);
    } catch (error) {
      step.sourceUnchanged = false;
      step.sourceError = String(error.message ?? error);
    }
    sourceDrifted ||= !step.sourceUnchanged;
    step.status =
      !result.error &&
      result.status === 0 &&
      !result.signal &&
      step.artifactErrors.length === 0 &&
      step.sourceUnchanged
        ? 'passed'
        : 'failed';
    if (!step.sourceUnchanged) step.reason = 'Source drift invalidates this required step.';
    if (step.status === 'failed') failure = step.id;
    saveReceipt(resolvedArtifacts, receipt);
    console.log(`[release rehearsal] ${step.label}: ${step.status}`);
  }
  try {
    receipt.sourceAfter = captureRehearsalSource(resolvedRoot);
    receipt.sourceUnchanged =
      !sourceDrifted && receipt.source !== null && sameSource(receipt.source, receipt.sourceAfter);
  } catch (error) {
    receipt.sourceUnchanged = false;
    receipt.sourceError = String(error.message ?? error);
  }
  receipt.finishedAt = new Date().toISOString();
  receipt.status = !failure && receipt.sourceUnchanged ? 'passed' : 'failed';
  receipt.qualifiesAsFrozenCandidate =
    receipt.status === 'passed' && receipt.source.clean && receipt.sourceAfter.clean;
  saveReceipt(resolvedArtifacts, receipt);
  console.log(`[release rehearsal] ${receipt.status}; evidence retained at ${resolvedArtifacts}`);
  return receipt;
}
