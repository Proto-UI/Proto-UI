import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

const digestSentinel = `sha256:${'0'.repeat(64)}`;
const digestDomain = 'proto-ui-autonomous-maintenance-reviewed-content-v1';

function canonicalizeDigestFields(value) {
  if (Array.isArray(value)) return value.map(canonicalizeDigestFields);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === 'reviewedContentDigest' ? digestSentinel : canonicalizeDigestFields(entry),
    ])
  );
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

export function computeReviewedContentDigest({ root, baseline, head, exactPaths, reviewPath }) {
  const normalizedPaths = [...exactPaths].sort();
  const reviewedPaths = normalizedPaths.filter((entry) => entry !== reviewPath);
  const patch = execFileSync(
    'git',
    [
      'diff',
      '--binary',
      '--full-index',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      baseline,
      head,
      '--',
      ...reviewedPaths,
    ],
    { cwd: root, maxBuffer: 64 * 1024 * 1024 }
  );

  const headPacket = readCommitPath(root, head, reviewPath);
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
  updateField(hash, 'head-review-packet-mode', readCommitMode(root, head, reviewPath) ?? 'absent');
  updateField(hash, 'head-review-packet', canonicalizeReviewPacket(headPacket));
  return `sha256:${hash.digest('hex')}`;
}
