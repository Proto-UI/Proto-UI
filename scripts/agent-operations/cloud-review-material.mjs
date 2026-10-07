// Versioned scheduling projection only; canonical review input is never filtered.
import { createHash } from 'node:crypto';
import { validateReviewInputSnapshot } from './review-runtime.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const keys = (value, fields) => {
  assert(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === fields.length &&
      fields.every((field) => Object.hasOwn(value, field)),
    'unexpected review material fields'
  );
};
const numeric = (value) => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);

export function validateCloudReviewMaterial(projection, repositoryId, pullRequest) {
  keys(projection, ['version', 'input', 'reviewIdentities']);
  assert(projection.version === 1, 'unsupported review material version');
  validateReviewInputSnapshot(projection.input);
  const { input, reviewIdentities } = projection;
  assert(
    input.repositoryId === repositoryId && input.pullRequest === pullRequest,
    'review material target mismatch'
  );
  assert(
    Array.isArray(reviewIdentities) && reviewIdentities.length === input.reviews.length,
    'review material identity coverage mismatch'
  );
  const ids = new Set();
  reviewIdentities.forEach((identity, index) => {
    keys(identity, ['nodeId', 'id', 'authorId']);
    assert(
      identity.nodeId === input.reviews[index].id &&
        (identity.id === null || numeric(identity.id)) &&
        (identity.authorId === null || numeric(identity.authorId)),
      'review material identity mismatch'
    );
    if (identity.id !== null) {
      assert(!ids.has(identity.id), 'duplicate review material identity');
      ids.add(identity.id);
    }
  });
}

export function matchesCloudReviewMaterialReceipt(projection, index, receipt) {
  const review = projection.input.reviews[index];
  const identity = projection.reviewIdentities[index];
  return Boolean(
    receipt &&
    numeric(identity.id) &&
    numeric(identity.authorId) &&
    receipt.repositoryId === projection.input.repositoryId &&
    receipt.pullRequest === projection.input.pullRequest &&
    receipt.id === identity.id &&
    receipt.nodeId === identity.nodeId &&
    receipt.authorId === identity.authorId &&
    receipt.authorLogin === review.author &&
    receipt.commitId === review.commitSha &&
    receipt.state === review.state &&
    receipt.body === review.body
  );
}

export function cloudReviewMaterialDigest(projection, receipts = []) {
  const { input, reviewIdentities } = projection;
  const material = {
    headSha: input.headSha,
    baseSha: input.baseSha,
    baseRefName: input.baseRefName,
    state: input.pullRequestState,
    draft: input.isDraft,
    body: input.pullRequestBody,
    commits: input.commits,
    files: input.changedFiles,
    reviews: input.reviews.flatMap((review, index) =>
      receipts.some((receipt) => matchesCloudReviewMaterialReceipt(projection, index, receipt))
        ? []
        : [{ ...review, identity: reviewIdentities[index] }]
    ),
    comments: input.comments,
    replies: input.replies,
    threads: input.threads,
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

// Only receipts finalized from versioned intents carry this exact binding.
// Historical records stay opaque; reading them is not a migration or repair.
export function cloudReviewMaterialReceipts(state) {
  return state.publicationReceipts.flatMap((receipt) => (receipt.review ? [receipt.review] : []));
}
