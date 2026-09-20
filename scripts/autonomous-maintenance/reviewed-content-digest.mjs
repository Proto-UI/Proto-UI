import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import YAML from 'yaml';

const digestSentinel = `sha256:${'0'.repeat(64)}`;
const digestDomain = 'proto-ui-autonomous-maintenance-reviewed-content-v1';

function literalPathspecEnv(extra = {}) {
  return { ...process.env, ...extra, GIT_LITERAL_PATHSPECS: '1' };
}

function sentinelDigest(record) {
  if (record && typeof record === 'object' && Object.hasOwn(record, 'reviewedContentDigest')) {
    record.reviewedContentDigest = digestSentinel;
  }
}

function canonicalizeDigestFields(value) {
  const canonical = structuredClone(value);
  sentinelDigest(canonical.changeInventory);
  sentinelDigest(canonical.independentReview);
  if (Array.isArray(canonical.independentReview?.history)) {
    sentinelDigest(canonical.independentReview.history.at(-1));
  }
  if (Object.hasOwn(canonical, 'integrationEligibility')) {
    canonical.integrationEligibility = { status: digestSentinel };
  }
  return canonical;
}

export function canonicalizeReviewPacket(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/<!-- prettier-ignore -->\s*```yaml\n([\s\S]*?)\n```/);
  if (!match || match.index === undefined) {
    throw new Error('review packet is missing its prettier-ignored YAML metadata block');
  }

  const metadata = YAML.parse(match[1]);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('review packet metadata must be an object');
  }
  const canonicalMetadata = YAML.stringify(canonicalizeDigestFields(metadata)).trimEnd();
  const before = normalized.slice(0, match.index);
  const after = normalized.slice(match.index + match[0].length);
  return `${before}<!-- prettier-ignore -->\n\`\`\`yaml\n${canonicalMetadata}\n\`\`\`${after}`;
}

function readCommitPath(root, commit, repositoryPath) {
  try {
    return execFileSync('git', ['show', `${commit}:${repositoryPath}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function readCommitMode(root, commit, repositoryPath) {
  try {
    const output = execFileSync('git', ['ls-tree', commit, '--', repositoryPath], {
      cwd: root,
      encoding: 'utf8',
      env: literalPathspecEnv(),
    }).trim();
    return output ? output.split(/\s+/, 1)[0] : null;
  } catch {
    return null;
  }
}

function updateField(hash, label, value) {
  hash.update(`\0${label}\0`, 'utf8');
  hash.update(value, 'utf8');
}

function readWorktreePath(root, repositoryPath) {
  try {
    return readFileSync(resolve(root, repositoryPath), 'utf8');
  } catch {
    return null;
  }
}

// Stage the reviewed worktree paths on top of the reviewed head into a
// throwaway index, then diff the baseline against that index. The resulting
// patch stream is byte-identical to `git diff baseline <new head>` after the
// worktree content is committed, which keeps the pre-commit and post-commit
// digest over the same canonical stream (including untracked paths and
// deletions, interleaved in path order).
function readWorktreeDiff(root, baseline, head, reviewedPaths, diffOptions) {
  const tempDir = mkdtempSync(join(tmpdir(), 'proto-ui-reviewed-content-index-'));
  const env = literalPathspecEnv({ GIT_INDEX_FILE: join(tempDir, 'index') });
  try {
    execFileSync('git', ['read-tree', head], {
      cwd: root,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    // Stage only paths present in the worktree or in the reviewed head tree;
    // a path deleted before the head matches nothing and would fail the add,
    // while its baseline deletion is still captured by the cached diff below.
    const stagedPaths = reviewedPaths.filter(
      (reviewedPath) =>
        lstatSync(resolve(root, reviewedPath), { throwIfNoEntry: false }) !== undefined ||
        readCommitMode(root, head, reviewedPath) !== null
    );
    if (stagedPaths.length > 0) {
      execFileSync('git', ['add', '--force', '--', ...stagedPaths], {
        cwd: root,
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    }
    return execFileSync(
      'git',
      ['diff', '--cached', ...diffOptions, baseline, '--', ...reviewedPaths],
      { cwd: root, env, maxBuffer: 64 * 1024 * 1024 }
    );
  } finally {
    rmSync(dirname(env.GIT_INDEX_FILE), { recursive: true, force: true });
  }
}
function readWorktreeMode(root, repositoryPath) {
  try {
    const indexed = execFileSync('git', ['ls-files', '--stage', '--', repositoryPath], {
      cwd: root,
      encoding: 'utf8',
      env: literalPathspecEnv(),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (indexed) return indexed.split(/\s+/, 1)[0];
  } catch {
    // Fall through to the filesystem mode for an untracked path.
  }
  try {
    const stats = lstatSync(resolve(root, repositoryPath));
    if (stats.isSymbolicLink()) return '120000';
    return (stats.mode & 0o111) !== 0 ? '100755' : '100644';
  } catch {
    return null;
  }
}

export function computeReviewedContentDigest({
  root,
  baseline,
  head,
  exactPaths,
  reviewPath,
  headPacketContent,
  worktree = false,
}) {
  const normalizedPaths = [...exactPaths].sort();
  const reviewedPaths = normalizedPaths.filter((entry) => entry !== reviewPath);
  const diffOptions = [
    '--binary',
    '--full-index',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
  ];
  const patch = worktree
    ? readWorktreeDiff(root, baseline, head, reviewedPaths, diffOptions)
    : execFileSync('git', ['diff', ...diffOptions, baseline, head, '--', ...reviewedPaths], {
        cwd: root,
        env: literalPathspecEnv(),
        maxBuffer: 64 * 1024 * 1024,
      });

  const headPacket =
    headPacketContent ??
    (worktree ? readWorktreePath(root, reviewPath) : readCommitPath(root, head, reviewPath));
  if (headPacket === null) {
    throw new Error(`exact head does not contain review packet: ${reviewPath}`);
  }
  const baselinePacket = readCommitPath(root, baseline, reviewPath);
  const hash = createHash('sha256');
  hash.update(digestDomain, 'utf8');
  updateField(hash, 'exact-paths', normalizedPaths.join('\0'));
  hash.update('\0reviewed-path-diff\0', 'utf8');
  hash.update(patch);
  updateField(hash, 'review-packet-path', reviewPath);
  updateField(
    hash,
    'baseline-review-packet-mode',
    readCommitMode(root, baseline, reviewPath) ?? 'absent'
  );
  updateField(
    hash,
    'baseline-review-packet',
    baselinePacket === null ? 'absent' : canonicalizeReviewPacket(baselinePacket)
  );
  const headPacketMode = worktree
    ? (readWorktreeMode(root, reviewPath) ?? readCommitMode(root, head, reviewPath) ?? '100644')
    : (readCommitMode(root, head, reviewPath) ?? 'absent');
  updateField(hash, 'head-review-packet-mode', headPacketMode);
  updateField(hash, 'head-review-packet', canonicalizeReviewPacket(headPacket));
  return `sha256:${hash.digest('hex')}`;
}
