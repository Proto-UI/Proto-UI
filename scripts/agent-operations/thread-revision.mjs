import { createHash } from 'node:crypto';
import { latestThreadUpdate } from './collect-live-review-input.mjs';

// This digest detects changes to the complete, bounded comment set returned by
// GitHub. It is neither identity/authorization evidence nor an atomic snapshot.
export function collectThreadRevision(thread) {
  if (typeof thread?.id !== 'string' || !thread.id.trim() || thread.id.length > 200) {
    throw new Error('live review thread carries an invalid thread ID');
  }
  // Keep the collector's one-page bound and reject absent/incomplete pagination,
  // empty threads, and invalid timestamps instead of hashing a partial revision.
  latestThreadUpdate(thread);
  const ids = new Set();
  const comments = thread.comments.nodes.map((comment) => {
    if (
      !comment ||
      !Number.isSafeInteger(comment.databaseId) ||
      comment.databaseId <= 0 ||
      ids.has(comment.databaseId)
    ) {
      throw new Error('live review thread carries missing, invalid, or duplicate comment IDs');
    }
    ids.add(comment.databaseId);
    if (
      typeof comment.body !== 'string' ||
      (comment.author !== null &&
        (typeof comment.author?.login !== 'string' || !comment.author.login.trim()))
    ) {
      throw new Error('live review thread carries malformed comment body or author');
    }
    return {
      databaseId: comment.databaseId,
      authorLogin: comment.author === null ? null : comment.author.login,
      body: comment.body,
      updatedAt: comment.updatedAt,
    };
  });
  comments.sort((left, right) => left.databaseId - right.databaseId);
  const threadUpdatedAt = latestThreadUpdate({
    ...thread,
    comments: { nodes: comments, pageInfo: thread.comments.pageInfo },
  });
  const revision = {
    kind: 'proto-ui.review-thread-comment-revision',
    schemaVersion: 1,
    threadId: thread.id,
    comments,
  };
  return {
    threadUpdatedAt,
    threadRevisionDigest: `sha256:${createHash('sha256').update(JSON.stringify(revision)).digest('hex')}`,
  };
}
