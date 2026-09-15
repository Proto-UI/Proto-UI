import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

const digestSentinel = `sha256:${'0'.repeat(64)}`;
const digestDomain = 'proto-ui-autonomous-maintenance-reviewed-content-v1';

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

function isUntrackedWorktreePath(root, repositoryPath) {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '--', repositoryPath],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}
function readUntrackedDiff(root, repositoryPath) {
  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--binary',
      '--full-index',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--',
      '/dev/null',
      repositoryPath,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `could not read untracked diff for ${repositoryPath}`);
  }
  return result.stdout;
}
function readWorktreeMode(root, repositoryPath) {
  try {
    const indexed = execFileSync('git', ['ls-files', '--stage', '--', repositoryPath], {
      cwd: root,
      encoding: 'utf8',
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
  const diffArgs = [
    'diff',
    '--binary',
    '--full-index',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
    baseline,
  ];
  if (!worktree) diffArgs.push(head);
  diffArgs.push('--', ...reviewedPaths);
  const patch = execFileSync('git', diffArgs, { cwd: root, maxBuffer: 64 * 1024 * 1024 });

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
  if (worktree) {
    for (const reviewedPath of reviewedPaths) {
      if (isUntrackedWorktreePath(root, reviewedPath)) {
        updateField(
          hash,
          `worktree-untracked-diff:${reviewedPath}`,
          readUntrackedDiff(root, reviewedPath)
        );
      }
    }
  }
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
