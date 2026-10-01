import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import YAML from 'yaml';
import { parseGitPathNames } from './git-paths.mjs';

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

// Overlay the real index entries for reviewed paths on the reviewed head in a
// throwaway index, then stage their worktree state with Git's core.filemode
// semantics. The real index matters for explicit staged modes when filemode is
// false; HEAD alone and filesystem executable bits are not equivalent sources.
// Read both the packet mode and the reviewed patch from this one index. The resulting
// patch stream is byte-identical to `git diff baseline <new head>` after the
// worktree content is committed, which keeps the pre-commit and post-commit
// digest over the same canonical stream (including untracked paths and
// deletions, interleaved in path order).
function readWorktreeSnapshot(root, baseline, head, reviewedPaths, reviewPath, diffOptions) {
  const tempDir = mkdtempSync(join(tmpdir(), 'proto-ui-reviewed-content-index-'));
  const env = literalPathspecEnv({ GIT_INDEX_FILE: join(tempDir, 'index') });
  try {
    execFileSync('git', ['read-tree', head], {
      cwd: root,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const exactPaths = [...reviewedPaths, reviewPath];
    const indexEntries = execFileSync('git', ['ls-files', '--stage', '-z', '--', ...exactPaths], {
      cwd: root,
      env: literalPathspecEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });
    execFileSync('git', ['update-index', '--force-remove', '-z', '--stdin'], {
      cwd: root,
      env,
      input: `${exactPaths.join('\0')}\0`,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    execFileSync('git', ['update-index', '-z', '--index-info'], {
      cwd: root,
      env,
      input: indexEntries,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const indexedPaths = new Set(
      parseGitPathNames(
        execFileSync('git', ['ls-files', '-z', '--', ...exactPaths], {
          cwd: root,
          env,
          maxBuffer: 64 * 1024 * 1024,
        })
      )
    );
    // A path absent from both index and worktree is already deleted. Its
    // baseline deletion remains in the cached diff without an invalid git add.
    const stagedPaths = exactPaths.filter(
      (reviewedPath) =>
        lstatSync(resolve(root, reviewedPath), { throwIfNoEntry: false }) !== undefined ||
        indexedPaths.has(reviewedPath)
    );
    if (stagedPaths.length > 0) {
      execFileSync('git', ['add', '--force', '--', ...stagedPaths], {
        cwd: root,
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    }
    const patch = execFileSync(
      'git',
      ['diff', '--cached', ...diffOptions, baseline, '--', ...reviewedPaths],
      { cwd: root, env, maxBuffer: 64 * 1024 * 1024 }
    );
    const packetEntry = execFileSync('git', ['ls-files', '--stage', '-z', '--', reviewPath], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
    return { patch, packetMode: packetEntry ? packetEntry.split(' ', 1)[0] : 'absent' };
  } finally {
    rmSync(dirname(env.GIT_INDEX_FILE), { recursive: true, force: true });
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
  const worktreeSnapshot = worktree
    ? readWorktreeSnapshot(root, baseline, head, reviewedPaths, reviewPath, diffOptions)
    : null;
  const patch = worktreeSnapshot
    ? worktreeSnapshot.patch
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
  const headPacketMode = worktreeSnapshot
    ? worktreeSnapshot.packetMode
    : (readCommitMode(root, head, reviewPath) ?? 'absent');
  updateField(hash, 'head-review-packet-mode', headPacketMode);
  updateField(hash, 'head-review-packet', canonicalizeReviewPacket(headPacket));
  return `sha256:${hash.digest('hex')}`;
}
