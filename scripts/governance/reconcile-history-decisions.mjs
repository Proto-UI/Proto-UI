import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import {
  digest,
  readPages,
  checkboxSources,
  evidenceIndex,
  pullRequestDisposition,
} from './history-audit.mjs';
import { readHistoryJSON, readHistorySnapshot } from './history-files.mjs';
import { bindManualReadings } from './history-source-bindings.mjs';

const [snapshotPath, manualPath, output] = process.argv.slice(2);
if (!snapshotPath || !manualPath || !output)
  throw new Error(
    'Usage: reconcile-history-decisions.mjs SNAPSHOT.json.gz MANUAL_DECISIONS.json OUTPUT.json'
  );
const snapshot = await readHistorySnapshot(snapshotPath);
const objects = readPages(snapshot.issuePages, 'issues').filter(
  (row) => row.created_at <= snapshot.membershipCutoff
);
const byNumber = new Map(objects.map((row) => [row.number, row]));
const comments = new Map(objects.map((row) => [row.number, []]));
for (const comment of readPages(snapshot.commentPages, 'comments')) {
  if (comment.created_at <= snapshot.membershipCutoff)
    comments.get(Number(comment.issue_url.split('/').at(-1)))?.push(comment);
}
for (const rows of comments.values()) rows.sort((a, b) => a.id - b.id);
const manual = bindManualReadings(await readHistoryJSON(manualPath), objects, comments);
const metadata = new Map(snapshot.pullRequests.map((row) => [row.pullRequest.number, row]));
const timelines = new Map(snapshot.issueTimeline.map((row) => [row.issue.number, row]));
const inlineComments = snapshot.inlinePages?.length
  ? readPages(snapshot.inlinePages, 'inline comments')
  : [];
const sprintMap = new Map();
for (const [sprint, numbers] of [
  [1, [1178, 848, 1488, 1098, 1453, 1156, 1457]],
  [2, [1458, 1145, 1055, 1061, 733, 732, 1160, 1099, 1096, 1094, 793, 523, 522, 1154, 1132]],
  [3, [1455, 1018, 1164, 1153, 1142, 1087, 1086, 1085, 1084, 1042, 1141, 1175, 1165, 782]],
  [4, [1143, 1089, 892, 893, 894, 891, 913, 914, 915]],
  [5, [1144, 1056, 687, 828, 1169, 1170, 1171, 1172, 895, 896]],
  [6, [1467, 1149, 1148, 1053, 1050, 1049, 799]],
  [7, [1151, 1150, 1147, 746, 745, 757, 754, 751, 750, 749, 734]],
])
  for (const number of numbers) sprintMap.set(number, sprint);
const parents = new Set([1673, 1323, 1100, 1093, 1092, 1091, 1090, 1088, 902, 890, 817, 792]);
function owner(number) {
  return sprintMap.has(number)
    ? `#${number}: existing Sprint ${sprintMap.get(number)} execution owner under the current user’s portfolio; GitHub assignees and historical claims remain authoritative facts separately`
    : parents.has(number)
      ? `#${number}: existing cross-Sprint tracking owner under the current user’s portfolio`
      : `#${number}: original source owner/claim retained; #1147 owns only the historical routing record`;
}

function checkFacts(pr) {
  const rollup = pr.head.nodes[0]?.commit.statusCheckRollup;
  const contexts = rollup?.contexts.nodes ?? [];
  const nativeDco = contexts.filter((row) =>
    /\bDCO\b|developer certificate/i.test(row.name ?? row.context ?? '')
  );
  let matched = 0,
    unbound = 0,
    absent = 0;
  for (const { commit } of pr.commits.nodes) {
    const trailers = [...commit.message.matchAll(/^Signed-off-by:\s*(.*?)\s*<([^<>]+)>\s*$/gim)];
    if (
      trailers.some(
        (row) =>
          row[1].trim().toLowerCase() === commit.author.name?.trim().toLowerCase() &&
          row[2].trim().toLowerCase() === commit.author.email?.trim().toLowerCase()
      )
    )
      matched++;
    else if (trailers.length) unbound++;
    else absent++;
  }
  const counts = {};
  for (const context of contexts) {
    const status = context.conclusion ?? context.state ?? context.status ?? 'UNKNOWN';
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return {
    observedHeadRollup: rollup?.state ?? 'UNAVAILABLE',
    observedContextCounts: counts,
    contextCount: contexts.length,
    contextPaginationComplete: !rollup || !rollup.contexts.pageInfo.hasNextPage,
    nativeDco: nativeDco.map((row) => ({
      name: row.name ?? row.context,
      state: row.conclusion ?? row.state ?? row.status,
      url: row.detailsUrl ?? row.targetUrl,
    })),
    originalCommitTrailers: {
      authorMatched: matched,
      presentButNotAuthorMatched: unbound,
      absent,
      total: pr.commits.totalCount,
    },
    interpretation:
      'Captured native states and original author trailers only; no new DCO certification, historical identity authentication, or technical acceptance is inferred.',
  };
}

function sourceReferences(object, discussion) {
  return [
    {
      key: `github.${object.pull_request ? 'pr' : 'issue'}.${object.number}.body@${digest(object.body ?? '')}`,
      url: object.html_url,
      body: object.body ?? '',
    },
    ...discussion.map((row) => ({
      key: `github.comment.${row.id}@${digest(row.body ?? '')}`,
      url: row.html_url,
      body: row.body ?? '',
    })),
  ];
}

function successors(sources, own) {
  const result = [];
  for (const source of sources) {
    for (const [line, text] of source.body.split(/\r?\n/).entries()) {
      if (
        !/follow[- ]?up|remaining|tracked|tracking|后续|剩余|承接|转(?:入|到)|跟踪|继续/.test(
          text.toLowerCase()
        )
      )
        continue;
      const numbers = new Set(
        [...text.matchAll(/(?:#|github\.com\/Proto-UI\/Proto-UI\/(?:issues|pull)\/)(\d+)/g)].map(
          (match) => Number(match[1])
        )
      );
      for (const target of numbers) {
        if (
          target !== own &&
          byNumber.get(target)?.state === 'open' &&
          (sprintMap.has(target) || parents.has(target))
        ) {
          result.push({
            targetIssue: target,
            source: source.url ?? source.key,
            line: line + 1,
            original: text,
            owner: owner(target),
            interpretation:
              'Explicitly mentioned live successor/tracker; the complete original condition remains retained and is not declared satisfied by this reference.',
          });
        }
      }
    }
  }
  return result;
}

const decisions = [];
for (const object of objects.sort((a, b) => a.number - b.number)) {
  const discussion = comments.get(object.number);
  const original = snapshot.originalSources.filter((row) => row.number === object.number);
  const sources = sourceReferences(object, discussion);
  const capturedPr = metadata.get(object.number);
  for (const review of capturedPr?.pullRequest.reviews.nodes ?? [])
    sources.push({
      key: `github.review.${review.databaseId}@${digest(review.body ?? '')}`,
      body: review.body ?? '',
    });
  for (const comment of inlineComments.filter((row) =>
    row.pull_request_url?.endsWith(`/${object.number}`)
  ))
    sources.push({
      key: `github.review-comment.${comment.id}@${digest(comment.body ?? '')}`,
      body: comment.body ?? '',
    });
  const refs = sources.map((row) => row.url ?? row.key).concat(original.map((row) => row.key));
  const currentCriteria = sources.flatMap((source) => checkboxSources(source.body, source.key));
  const sourceFacts = [
    ...sources,
    ...original.map((row) => ({ key: row.key, body: row.original })),
  ].map((source) => evidenceIndex(source.body, source.key));
  const links = successors(sources, object.number);
  const remaining = [
    {
      condition: `Preserve unavailable original-at-creation body/edit history and any unbound original review/CI/DCO/native receipt for #${object.number}; current captures cannot replace those historical facts.`,
      disposition: 'historical-source-gap',
      source: object.html_url,
      owner: '#1147 historical-source reconciliation owner (current user’s Sprint 7 assignment)',
      targetIssue: 1147,
      nextAction: `Keep #${object.number}’s exact archived source keys, current-body hash, original criteria and evidence limitations in #1147; reuse an original receipt only when its exact source/head is recovered. No product reacceptance is claimed.`,
    },
  ];
  if (object.state === 'open')
    remaining.push({
      condition: `All retained current and original conditions of #${object.number}: ${object.title}`,
      disposition: 'existing-execution-issue',
      source: object.html_url,
      targetIssue: object.number,
      owner: owner(object.number),
      nextAction: `Continue the source-bound acceptance conditions in #${object.number}; this historical synchronization neither closes the issue nor transfers its implementation ownership.`,
    });
  for (const link of links)
    remaining.push({
      condition: `Retain the complete source condition associated with this explicit successor reference: ${link.original}`,
      disposition: 'existing-execution-issue',
      source: link.source,
      targetIssue: link.targetIssue,
      owner: link.owner,
      nextAction: `Reconcile the applicable source condition in #${link.targetIssue}; a reference is not itself implementation or acceptance.`,
    });
  const base = {
    number: object.number,
    state: 'reconciled',
    reviewer: 'Codex /root/governance',
    sourceReading: manual.has(object.number)
      ? 'manual-full-body-and-discussion'
      : 'complete-inventory-and-native-metadata-reconciliation',
    reviewMethod:
      'Deterministic per-object historical reconciliation of the complete frozen source inventory, original criterion references and native metadata. Independent acceptance and its actual sampling scope are recorded separately; this does not claim a fresh manual implementation review.',
    bodySha256: digest(object.body ?? ''),
    discussionSha256: digest(discussion),
    sources: refs,
    retainedCurrentCriterionKeys: currentCriteria.map((row) => row.key),
    retainedOriginalCriterionKeys: original.map((row) => row.key),
    conditionDispositions: [
      ...currentCriteria.map((row) => ({
        sourceKey: row.key,
        originalSha256: digest(row.original),
        historicalChecked: row.checked,
      })),
      ...original.map((row) => ({
        sourceKey: row.key,
        originalSha256: row.originalSha256,
        historicalChecked: row.historicalChecked ?? null,
      })),
    ].map((condition) => ({
      ...condition,
      disposition:
        object.state === 'open'
          ? 'retain-complete-condition-in-existing-issue'
          : 'retain-historical-condition-and-its-evidence-limit',
      targetIssue: object.state === 'open' ? object.number : 1147,
      owner:
        object.state === 'open'
          ? owner(object.number)
          : '#1147 historical-source reconciliation owner',
      interpretation:
        'The complete source text remains authoritative. Neither a checked historical box, closure, merge nor this routing entry establishes current technical acceptance.',
    })),
    sourceConstraints: {
      specAndLifecycle: sourceFacts.flatMap((row) => row.definition),
      originalChangeBoundaries: sourceFacts.flatMap((row) => row.changeBoundary),
      currentAndHistoricalClaimSources: sourceFacts.flatMap((row) => row.ownership),
      observedAssignees: object.assignees.map((row) => row.login),
      absenceDisposition:
        'When a binding or claim is absent from these exact retained sources, record it as unavailable under #1147; do not invent a definition, promote lifecycle or revoke an owner.',
      allowedThisReconciliation:
        'Preserve and reconcile historical states, source keys, full conditions and explicit successor references.',
      excludedThisReconciliation:
        'Implementation changes, spec/lifecycle promotion, new CI claims, re-certifying original authors, ownership takeover and technical acceptance.',
    },
    sourceSuccessors: links,
    technicalAcceptance:
      'No new product acceptance, spec lifecycle promotion, approval, merge or author certification',
    remaining,
  };
  if (object.pull_request) {
    const capture = metadata.get(object.number);
    if (!capture) throw new Error(`PR ${object.number}: missing native metadata`);
    const pr = capture.pullRequest;
    if ((object.pull_request.merged_at ?? null) !== (pr.mergedAt ?? null))
      throw new Error(`PR ${object.number}: merge state changed between captures`);
    for (const key of ['reviews', 'commits', 'files']) {
      if (pr[key].nodes.length !== pr[key].totalCount || pr[key].pageInfo.hasNextPage)
        throw new Error(`PR ${object.number}: incomplete ${key}`);
    }
    const evidence = checkFacts(pr);
    if (!evidence.contextPaginationComplete)
      throw new Error(`PR ${object.number}: incomplete head checks`);
    const reviews = pr.reviews.nodes;
    const headApprovals = reviews.filter(
      (row) => row.commit?.oid === pr.headRefOid && row.state === 'APPROVED'
    );
    const requestedChanges = reviews.filter((row) => row.state === 'CHANGES_REQUESTED');
    const terminal = pullRequestDisposition({
      ...pr,
      state: pr.state ?? object.state.toUpperCase(),
    });
    base.sources.push(`github.pr.${object.number}.metadata@${digest(capture)}`);
    base.group =
      pr.mergedAt && reviews.length && evidence.contextCount && evidence.nativeDco.length
        ? 'merged-with-preserved-native-evidence'
        : pr.mergedAt
          ? 'merged-with-explicit-evidence-gaps'
          : terminal.group;
    base.rationale = `#${object.number} “${object.title}”: retain the actual ${terminal.description}. Source head ${pr.headRefOid}; ${pr.commits.totalCount} original commits and ${pr.files.totalCount} changed paths are fully archived. Preserve ${currentCriteria.length} current-source checkbox clauses, ${original.length} original source versions, ${discussion.length} top-level comments and ${reviews.length} native review submissions. There are ${headApprovals.length} observed APPROVED submissions bound to this source head and ${requestedChanges.length} observed CHANGES_REQUESTED submissions; these native observations do not assert current reviewer independence or resolve prior findings. Head check evidence: ${evidence.contextCount} contexts (${JSON.stringify(evidence.observedContextCounts)}); native DCO contexts: ${evidence.nativeDco.length}. Original author-matched signoff trailers: ${evidence.originalCommitTrailers.authorMatched}/${pr.commits.totalCount}. Missing receipts and original conditions remain explicitly retained under #1147 or the source-linked execution issues.`;
    base.pullRequestFacts = {
      head: pr.headRefOid,
      base: pr.baseRefOid,
      merge: pr.mergeCommit?.oid ?? null,
      terminalState: terminal.state,
      mergedAt: pr.mergedAt,
      mergedBy: pr.mergedBy?.login ?? null,
      filePaths: pr.files.nodes.map((row) => row.path),
      reviewIds: reviews.map((row) => row.databaseId),
      observedExactHeadApprovalIds: headApprovals.map((row) => row.databaseId),
      observedChangesRequestedIds: requestedChanges.map((row) => row.databaseId),
      ...evidence,
    };
  } else {
    const capture = timelines.get(object.number);
    if (!capture)
      throw new Error(`Issue ${object.number}: closure/cross-reference timeline is missing`);
    const timeline = capture.issue.timelineItems;
    if (timeline.nodes.length !== timeline.totalCount || timeline.pageInfo.hasNextPage)
      throw new Error(`Issue ${object.number}: incomplete timeline`);
    const historical = timeline.nodes.filter((row) => row.createdAt <= snapshot.membershipCutoff);
    const closures = historical.filter((row) => row.__typename === 'ClosedEvent');
    const reopened = historical.filter((row) => row.__typename === 'ReopenedEvent');
    const last = closures.at(-1);
    const closestComment = discussion
      .filter((row) => row.created_at <= (last?.createdAt ?? snapshot.membershipCutoff))
      .at(-1);
    base.sources.push(`github.issue.${object.number}.timeline@${digest(capture)}`);
    base.group =
      object.state === 'open'
        ? 'open-original-conditions-routed'
        : last?.closer
          ? 'closed-with-native-closing-source'
          : 'closed-with-explicit-evidence-gap';
    const reason = last?.closer
      ? `native closing source ${last.closer.url} (${last.closer.headRefOid ?? last.closer.oid})`
      : 'no native closing PR/commit was retained in the captured closure event';
    base.rationale = `#${object.number} “${object.title}”: retain observed ${object.state.toUpperCase()} / state_reason=${object.state_reason ?? 'unavailable'}. The frozen selected timeline has ${closures.length} close and ${reopened.length} reopen events; ${reason}${last ? `, closed by ${last.actor?.login ?? 'unavailable actor'} at ${last.createdAt}` : ''}. Preserve ${currentCriteria.length} current-source checkbox clauses, ${original.length} original source versions and all ${discussion.length} top-level comments. ${closestComment ? `The last available pre-close/cutoff comment is ${closestComment.html_url}; its complete text is retained, not silently promoted to a closing rationale.` : 'No pre-close/cutoff discussion supplies a more specific rationale.'} ${object.state === 'open' ? `Its full original conditions stay with ${owner(object.number)}.` : 'This synchronizes the historical terminal state and provenance; closure alone is not technical acceptance.'}`;
    base.issueFacts = {
      timelineSource: `github.issue.${object.number}.timeline@${digest(capture)}`,
      closingSources: closures.map((row) => ({
        at: row.createdAt,
        actor: row.actor?.login ?? null,
        closer: row.closer,
      })),
      reopenEvents: reopened,
      lastPreCloseComment: closestComment
        ? {
            id: closestComment.id,
            url: closestComment.html_url,
            sha256: digest(closestComment.body ?? ''),
          }
        : null,
    };
    if (manual.has(object.number)) {
      const old = manual.get(object.number);
      base.reviewMethod = old.reviewMethod;
      base.group = old.group;
      base.rationale = `${old.rationale} Native timeline reconciliation: ${reason}${last ? `; actor ${last.actor?.login ?? 'unknown'}, ${last.createdAt}` : ''}.`;
    }
  }
  decisions.push(base);
}
const serialized = `${JSON.stringify(decisions, null, 2)}\n`;
await writeFile(output, output.endsWith('.gz') ? gzipSync(serialized, { level: 9 }) : serialized);
const groups = {};
for (const decision of decisions) groups[decision.group] = (groups[decision.group] ?? 0) + 1;
console.log(
  JSON.stringify(
    { objects: decisions.length, manuallyReadIssueDiscussions: manual.size, groups },
    null,
    2
  )
);
