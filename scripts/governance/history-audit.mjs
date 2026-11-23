import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { readHistoryJSON, readHistorySnapshot } from './history-files.mjs';

export function digest(value) {
  const hash = createHash('sha256');
  // Match JSON.stringify bytes without allocating a second full copy of the
  // complete historical capture. Shared original commit objects stay shared.
  function append(item) {
    if (item === null || typeof item !== 'object') {
      hash.update(JSON.stringify(item ?? null));
    } else if (Array.isArray(item)) {
      hash.update('[');
      item.forEach((child, index) => {
        if (index) hash.update(',');
        append(child);
      });
      hash.update(']');
    } else {
      hash.update('{');
      let index = 0;
      for (const [key, child] of Object.entries(item)) {
        if (child === undefined) continue;
        if (index++) hash.update(',');
        hash.update(JSON.stringify(key));
        hash.update(':');
        append(child);
      }
      hash.update('}');
    }
  }
  if (typeof value === 'string') hash.update(value);
  else append(value);
  return hash.digest('hex');
}

function invariant(ok, message) {
  if (!ok) throw new Error(message);
}

export function readPages(pages, name) {
  invariant(Array.isArray(pages) && pages.length > 0, `${name}: pages are required`);
  const ordered = [...pages].sort((a, b) => a.page - b.page);
  const rows = [];
  for (let index = 0; index < ordered.length; index++) {
    const page = ordered[index];
    invariant(page.page === index + 1, `${name}: missing or duplicate page ${index + 1}`);
    invariant(Array.isArray(page.rows), `${name}: invalid rows at page ${page.page}`);
    invariant(page.rows.length <= 100, `${name}: oversized page ${page.page}`);
    invariant(
      page.sha256 === digest(page.rows),
      `${name}: source hash mismatch at page ${page.page}`
    );
    if (index === ordered.length - 1) {
      invariant(page.rows.length === 0, `${name}: empty terminal page is required`);
    } else {
      invariant(page.rows.length > 0, `${name}: rows after terminal page`);
      if (index < ordered.length - 2) {
        invariant(page.rows.length === 100, `${name}: early short page ${page.page}`);
      }
    }
    rows.push(...page.rows);
  }
  const ids = rows.map((row) => row.id);
  invariant(ids.every(Number.isSafeInteger), `${name}: missing stable IDs`);
  invariant(new Set(ids).size === ids.length, `${name}: duplicate stable ID`);
  return rows;
}

export function checkboxSources(text, sourceKey) {
  const result = [];
  let section = '';
  let fence = null;
  for (const [index, line] of (text ?? '').split(/\r?\n/).entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (fence === marker[1][0]) fence = null;
      continue;
    }
    if (fence) continue;
    if (/^#{1,6}\s/.test(line)) section = line;
    const checkbox = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)\[([ xX])\]\s+/);
    if (checkbox)
      result.push({
        key: `${sourceKey}:line:${index + 1}`,
        sourceLine: index + 1,
        section,
        original: line,
        checked: checkbox[1].toLowerCase() === 'x',
      });
  }
  return result;
}

function timestamp(value, label) {
  const time = Date.parse(value);
  invariant(Number.isFinite(time), `${label}: invalid timestamp`);
  return time;
}

export function evidenceIndex(source, sourceKey) {
  const lines = (source ?? '').split(/\r?\n/);
  const topics = {
    definition: /(?:\b[PTDM]-[A-Z][A-Z0-9-]+|spec\/|lifecycle|生命周期|draft|normative)/i,
    changeBoundary:
      /(?:non-goals?|out.of.scope|allowed changes|excluded|允许|排除|范围|不得|不能)/i,
    ownership: /(?:owner|\bown\b|claim|working on|take (?:care of )?this|接管|负责|认领|主权)/i,
    provenance: /(?:DCO|Signed-off-by|provenance|原始作者|原作者|贡献来源|native receipt)/i,
    validation:
      /(?:actions\/runs\/|\bCI\b|verification|验收|negative control|负控|测试|check run)/i,
    decision:
      /(?:merged|关闭|合入|拒绝|保留|后续|defer|blocked|not completed|pending|supersed|duplicate|不再|Resolved|DONE)/i,
  };
  return Object.fromEntries(
    Object.entries(topics).map(([topic, pattern]) => [
      topic,
      lines.flatMap((line, index) =>
        pattern.test(line) ? [{ sourceKey, line: index + 1, text: line }] : []
      ),
    ])
  );
}

export function pullRequestDisposition(pr) {
  if (pr.mergedAt)
    return {
      state: 'MERGED',
      group: 'merged',
      description: `MERGED at ${pr.mergedAt} by ${pr.mergedBy?.login ?? 'unavailable actor'}, merge ${pr.mergeCommit?.oid ?? 'unavailable'}`,
    };
  if (pr.state === 'OPEN')
    return {
      state: 'OPEN',
      group: 'open-pull-request',
      description: 'OPEN; no merge or closure is inferred',
    };
  invariant(
    pr.state === 'CLOSED',
    `PR ${pr.number ?? 'unknown'}: unsupported native state ${pr.state}`
  );
  return {
    state: 'CLOSED_UNMERGED',
    group: 'closed-without-merge',
    description: `CLOSED WITHOUT MERGE at ${pr.closedAt}; no implementation completion is inferred`,
  };
}

export function buildAudit(snapshot, decisions = [], acceptance = null) {
  invariant(snapshot.schemaVersion === 1, 'unsupported snapshot schema');
  const cutoff = timestamp(snapshot.membershipCutoff, 'membership cutoff');
  const allObjects = readPages(snapshot.issuePages, 'issues');
  const allComments = readPages(snapshot.commentPages, 'comments');
  const objects = allObjects.filter(
    (row) => timestamp(row.created_at, `object ${row.number}`) <= cutoff
  );
  const numbers = new Set(objects.map((row) => row.number));
  invariant(numbers.size === objects.length, 'duplicate object number');
  const comments = allComments.filter(
    (row) => timestamp(row.created_at, `comment ${row.id}`) <= cutoff
  );
  const inline = snapshot.inlinePages?.length
    ? readPages(snapshot.inlinePages, 'inline comments')
    : [];
  const byObject = new Map(objects.map((row) => [row.number, []]));
  for (const comment of comments) {
    const number = Number(comment.issue_url.split('/').at(-1));
    invariant(numbers.has(number), `comment ${comment.id}: missing parent ${number}`);
    byObject.get(number).push(comment);
  }
  const decisionMap = new Map();
  for (const decision of decisions) {
    invariant(numbers.has(decision.number), `decision for out-of-scope object ${decision.number}`);
    invariant(!decisionMap.has(decision.number), `duplicate decision ${decision.number}`);
    invariant(
      decision.state === 'reconciled',
      `decision ${decision.number}: an explicit historical reconciliation is required`
    );
    invariant(
      decision.rationale?.trim() && decision.reviewer?.trim(),
      `decision ${decision.number}: missing rationale or reviewer`
    );
    invariant(
      Array.isArray(decision.sources) && decision.sources.length > 0,
      `decision ${decision.number}: source-bound rationale required`
    );
    invariant(
      Array.isArray(decision.remaining) &&
        decision.remaining.every((row) => row.condition && row.owner && row.nextAction),
      `decision ${decision.number}: every remaining condition needs an owner and next action`
    );
    decisionMap.set(decision.number, decision);
  }
  const accepted = new Set();
  if (acceptance) {
    invariant(
      acceptance.schemaVersion === 1 && acceptance.state === 'accepted',
      'independent decision acceptance is invalid'
    );
    invariant(
      acceptance.snapshotSha256 === digest(snapshot),
      'independent acceptance is bound to a different snapshot'
    );
    invariant(
      acceptance.decisionSetSha256 === digest(decisions),
      'independent acceptance is bound to different decisions'
    );
    invariant(
      acceptance.reviewer?.trim() && acceptance.reviewScope?.trim() && acceptance.sources?.length,
      'independent acceptance needs its reviewer, actual scope and review sources'
    );
    invariant(
      Array.isArray(acceptance.acceptedNumbers) && Array.isArray(acceptance.sampledNumbers),
      'independent acceptance must enumerate accepted and sampled objects separately'
    );
    for (const number of acceptance.acceptedNumbers) {
      invariant(
        decisionMap.has(number) && !accepted.has(number),
        `invalid or duplicated accepted object ${number}`
      );
      invariant(
        decisionMap.get(number).reviewer !== acceptance.reviewer,
        `object ${number}: author cannot independently accept their own reconciliation`
      );
      accepted.add(number);
    }
    invariant(
      acceptance.sampledNumbers.every((number) => accepted.has(number)),
      'sampled object is outside the accepted decision set'
    );
  }
  const originalSources = snapshot.originalSources ?? [];
  invariant(
    snapshot.originalSourcesSha256 === digest(originalSources),
    'original criterion inventory changed'
  );
  invariant(
    new Set(originalSources.map((row) => row.key)).size === originalSources.length,
    'duplicate original source key'
  );
  for (const source of originalSources) {
    invariant(numbers.has(source.number), `original source ${source.key}: missing object`);
    invariant(
      source.originalSha256 === digest(source.original),
      `original source ${source.key}: text hash mismatch`
    );
  }
  const rows = objects
    .sort((a, b) => a.number - b.number)
    .map((object) => {
      const discussion = byObject.get(object.number).sort((a, b) => a.id - b.id);
      invariant(
        discussion.length === object.comments,
        `object ${object.number}: comment count ${discussion.length} != observed ${object.comments}; recapture or record the concurrent edit explicitly`
      );
      const bodyHash = digest(object.body ?? '');
      const bodyKey = `github.${object.pull_request ? 'pr' : 'issue'}.${object.number}.body@${bodyHash}`;
      const texts = [
        { key: bodyKey, body: object.body ?? '', url: object.html_url },
        ...discussion.map((comment) => ({
          key: `github.comment.${comment.id}@${digest(comment.body ?? '')}`,
          body: comment.body ?? '',
          url: comment.html_url,
        })),
      ];
      const known = new Set(texts.flatMap((source) => [source.key, source.url]));
      const original = originalSources.filter((source) => source.number === object.number);
      for (const source of original) known.add(source.key);
      const pr = snapshot.pullRequests?.find((item) => item.pullRequest.number === object.number);
      const timeline = snapshot.issueTimeline?.find((item) => item.issue.number === object.number);
      if (timeline) {
        const connection = timeline.issue.timelineItems;
        invariant(
          !connection.pageInfo.hasNextPage && connection.nodes.length === connection.totalCount,
          `Issue ${object.number}: timeline pagination is incomplete`
        );
        known.add(`github.issue.${object.number}.timeline@${digest(timeline)}`);
      }
      if (pr) {
        for (const name of ['reviews', 'commits', 'files']) {
          const connection = pr.pullRequest[name];
          invariant(
            !connection.pageInfo.hasNextPage && connection.nodes.length === connection.totalCount,
            `PR ${object.number}: ${name} pagination is incomplete`
          );
        }
        for (const review of pr.pullRequest.reviews.nodes) {
          texts.push({
            key: `github.review.${review.databaseId}@${digest(review.body ?? '')}`,
            body: review.body ?? '',
          });
        }
      }
      const inlineForObject = inline.filter((comment) =>
        comment.pull_request_url?.endsWith(`/${object.number}`)
      );
      for (const comment of inlineForObject)
        texts.push({
          key: `github.review-comment.${comment.id}@${digest(comment.body ?? '')}`,
          body: comment.body ?? '',
        });
      for (const text of texts) known.add(text.key);
      const decision = decisionMap.get(object.number);
      if (decision) {
        for (const source of original) {
          invariant(
            decision.sources.includes(source.key),
            `decision ${object.number}: omitted original criterion ${source.key}`
          );
        }
        for (const source of decision.sources) {
          invariant(
            known.has(source) ||
              (pr && source === `github.pr.${object.number}.metadata@${digest(pr)}`),
            `decision ${object.number}: unknown source ${source}`
          );
        }
        if (decision.bodySha256)
          invariant(
            decision.bodySha256 === bodyHash,
            `decision ${object.number}: reviewed body changed`
          );
        invariant(
          decision.discussionSha256 === digest(discussion),
          `decision ${object.number}: reviewed discussion changed`
        );
        const conditions = new Map([
          ...texts
            .flatMap((source) => checkboxSources(source.body, source.key))
            .map((condition) => [condition.key, digest(condition.original)]),
          ...original.map((source) => [source.key, source.originalSha256]),
        ]);
        invariant(
          Array.isArray(decision.conditionDispositions) &&
            decision.conditionDispositions.length === conditions.size,
          `decision ${object.number}: incomplete per-condition disposition`
        );
        const disposed = new Set();
        for (const condition of decision.conditionDispositions) {
          invariant(
            conditions.get(condition.sourceKey) === condition.originalSha256 &&
              !disposed.has(condition.sourceKey),
            `decision ${object.number}: changed, duplicated or unknown condition ${condition.sourceKey}`
          );
          invariant(
            condition.owner && condition.targetIssue && condition.disposition,
            `decision ${object.number}: condition ${condition.sourceKey} lacks explicit routing`
          );
          disposed.add(condition.sourceKey);
        }
      }
      return {
        number: object.number,
        kind: object.pull_request ? 'pull-request' : 'issue',
        title: object.title,
        url: object.html_url,
        createdAt: object.created_at,
        observed: {
          state: object.state,
          stateReason: object.state_reason,
          updatedAt: object.updated_at,
          closedAt: object.closed_at,
          mergedAt: object.pull_request?.merged_at ?? null,
          author: object.user.login,
          assignees: object.assignees.map((assignee) => assignee.login),
        },
        body: {
          sourceKey: bodyKey,
          sha256: bodyHash,
          objectUpdatedAfterCutoff: timestamp(object.updated_at, 'object updated') > cutoff,
          originalEditHistory:
            'Unavailable unless separately retained in an original source archive; object.updated_at is not a body-edit timestamp.',
        },
        discussion: {
          count: discussion.length,
          sha256: digest(discussion),
          ids: discussion.map((comment) => comment.id),
          editedAfterCutoff: discussion
            .filter((comment) => timestamp(comment.updated_at, 'comment updated') > cutoff)
            .map((comment) => comment.id),
        },
        originalSources: original,
        currentCheckboxes: texts.flatMap((source) => checkboxSources(source.body, source.key)),
        evidenceIndex: [
          ...texts,
          ...original.map((source) => ({ key: source.key, body: source.original })),
        ].map((source) => ({ sourceKey: source.key, ...evidenceIndex(source.body, source.key) })),
        pullRequestEvidence: pr
          ? {
              sourceKey: `github.pr.${object.number}.metadata@${digest(pr)}`,
              head: pr.pullRequest.headRefOid,
              merge: pr.pullRequest.mergeCommit?.oid ?? null,
              reviewCount: pr.pullRequest.reviews.totalCount,
              commitCount: pr.pullRequest.commits.totalCount,
              changedFileCount: pr.pullRequest.files.totalCount,
              capturedAt: pr.completedAt,
            }
          : null,
        issueTimelineEvidence: timeline
          ? {
              sourceKey: `github.issue.${object.number}.timeline@${digest(timeline)}`,
              selectedEventCount: timeline.issue.timelineItems.totalCount,
              capturedAt: timeline.capturedAt,
            }
          : null,
        inlineReviewEvidence: {
          count: inlineForObject.length,
          ids: inlineForObject.map((comment) => comment.id),
          sha256: digest(inlineForObject),
        },
        decisionAcceptance: accepted.has(object.number)
          ? {
              state: 'accepted',
              reviewer: acceptance.reviewer,
              reviewScope: acceptance.reviewScope,
              sampled: acceptance.sampledNumbers.includes(object.number),
            }
          : { state: 'awaiting-independent-acceptance' },
        decision: decision ?? {
          state: 'awaiting-reconciliation',
          remaining: [
            {
              condition:
                'Reconcile this object’s complete frozen sources and preserve every original condition.',
              owner: '#1147 historical-source reconciliation owner',
              nextAction: `Reconcile #${object.number} (${object.title}) against its body, ${discussion.length} comments and applicable original-source records.`,
            },
          ],
        },
      };
    });
  return {
    schemaVersion: 1,
    repository: snapshot.repository,
    membershipCutoff: snapshot.membershipCutoff,
    snapshotSha256: digest(snapshot),
    scope:
      'Accessible issues and pull requests created at or before the membership cutoff, including closed and merged objects; current bodies are not reconstructed original bodies.',
    counts: {
      objects: rows.length,
      issues: rows.filter((row) => row.kind === 'issue').length,
      pullRequests: rows.filter((row) => row.kind === 'pull-request').length,
      comments: comments.length,
      excludedLaterObjects: allObjects.length - objects.length,
      inlineReviewComments: inline.length,
      reconciled: decisionMap.size,
      awaitingReconciliation: rows.length - decisionMap.size,
      manualFullSourceReadings: decisions.filter(
        (row) => row.sourceReading === 'manual-full-body-and-discussion'
      ).length,
      decisionAccepted: accepted.size,
      awaitingDecisionAcceptance: rows.length - accepted.size,
      independentlySampled: acceptance?.sampledNumbers.length ?? 0,
      withRemainingConditions: rows.filter((row) => row.decision.remaining.length > 0).length,
    },
    missingNumbers: Array.from({ length: Math.max(...numbers) }, (_, index) => index + 1).filter(
      (number) => !numbers.has(number)
    ),
    rows,
  };
}

export function assertReady(audit) {
  invariant(
    audit.counts.awaitingReconciliation === 0,
    `${audit.counts.awaitingReconciliation} historical objects still await source reconciliation`
  );
  const unresolved = audit.rows.filter((row) =>
    row.decision.remaining.some(
      (condition) =>
        !['existing-execution-issue', 'historical-source-gap'].includes(condition.disposition) ||
        !condition.source ||
        (condition.disposition === 'existing-execution-issue' && !condition.targetIssue)
    )
  );
  invariant(
    unresolved.length === 0,
    `${unresolved.length} objects retain unresolved conditions without a source-bound disposition`
  );
  invariant(
    audit.rows.every((row) => row.kind !== 'pull-request' || row.pullRequestEvidence),
    'PR provenance/review/CI source capture is incomplete'
  );
  invariant(
    audit.rows.every((row) => row.kind !== 'issue' || row.issueTimelineEvidence),
    'Issue closure/successor source capture is incomplete'
  );
  invariant(
    audit.counts.awaitingDecisionAcceptance === 0,
    `${audit.counts.awaitingDecisionAcceptance} reconciled objects still await independent decision acceptance; source reconciliation is not manual code review`
  );
}

export function selectIdleObjects(audit, currentUserScope, at = audit.membershipCutoff) {
  const cutoff = timestamp(at, 'idle selection timestamp');
  return audit.rows
    .filter((row) => row.observed.state === 'open')
    .map((row) => ({
      number: row.number,
      updatedAt: row.observed.updatedAt,
      threeHoursSinceObjectUpdate:
        cutoff - timestamp(row.observed.updatedAt, 'idle object updated') >= 3 * 60 * 60 * 1000,
      selected: currentUserScope.includes(row.number),
      authorization: currentUserScope.includes(row.number)
        ? 'Current user’s explicit Sprint 7 portfolio'
        : null,
      ownerEvidence: {
        assignees: row.observed.assignees,
        claimSources: row.evidenceIndex.flatMap((source) => source.ownership),
      },
      limitation:
        'Elapsed update time and empty assignees do not prove abandonment, revoke claims, or grant takeover permission.',
    }));
}

async function main() {
  const [command, snapshotPath, decisionsPath, output, acceptancePath] = process.argv.slice(2);
  invariant(
    ['build', 'check', 'ready'].includes(command) && snapshotPath && decisionsPath,
    'Usage: history-audit.mjs build|check|ready SNAPSHOT.json.gz DECISIONS.json [OUTPUT.json|-] [INDEPENDENT_ACCEPTANCE.json]'
  );
  const snapshot = await readHistorySnapshot(snapshotPath);
  const decisions = await readHistoryJSON(decisionsPath);
  const acceptance = acceptancePath ? JSON.parse(await readFile(acceptancePath, 'utf8')) : null;
  const audit = buildAudit(snapshot, decisions, acceptance);
  if (command === 'ready') assertReady(audit);
  if (command === 'build') {
    invariant(output, 'build requires an output path');
    const content = `${JSON.stringify(audit, null, 2)}\n`;
    await writeFile(output, output.endsWith('.gz') ? gzipSync(content) : content);
  }
  console.log(JSON.stringify(audit.counts, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
