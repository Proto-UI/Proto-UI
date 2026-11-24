import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { digest } from './history-audit.mjs';
import { readHistoryJSON, readHistorySnapshot } from './history-files.mjs';

function same(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
}

function pageRows(pages, label) {
  const result = [];
  for (const [index, page] of pages.entries()) {
    same(page.page, index + 1, `${label}: page sequence`);
    same(page.sha256, digest(page.rows), `${label}: page content`);
    result.push(...page.rows);
  }
  same(pages.at(-1).rows.length, 0, `${label}: terminal empty page`);
  return result;
}

function currentConditions(sources) {
  const rows = [];
  for (const [sourceKey, body] of sources) {
    let fence;
    const lines = body.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const fenceStart = /^\s*(```+|~~~+)/.exec(line);
      if (fenceStart) {
        if (!fence) fence = fenceStart[1][0];
        else if (fence === fenceStart[1][0]) fence = undefined;
      } else if (!fence) {
        const box = /^\s*(?:[-+*]|\d+[.)])\s+\[([xX ])\]\s+/.exec(line);
        if (box)
          rows.push({
            sourceKey: `${sourceKey}:line:${index + 1}`,
            originalSha256: digest(line),
            historicalChecked: box[1] !== ' ',
          });
      }
    }
  }
  return rows;
}

export function verifyPullRequestFacts(object, capture, decision) {
  const pr = capture.pullRequest;
  const facts = decision.pullRequestFacts;
  const label = `PR #${object.number}`;
  for (const connection of ['commits', 'files', 'reviews']) {
    same(pr[connection].nodes.length, pr[connection].totalCount, `${label}: full ${connection}`);
    same(pr[connection].pageInfo.hasNextPage, false, `${label}: ${connection} terminal`);
  }
  same(
    object.pull_request.merged_at ?? null,
    pr.mergedAt ?? null,
    `${label}: independent REST/GraphQL merge observation`
  );
  const terminal = pr.mergedAt ? 'MERGED' : object.state === 'open' ? 'OPEN' : 'CLOSED_UNMERGED';
  for (const [field, expected] of Object.entries({
    head: pr.headRefOid,
    base: pr.baseRefOid,
    merge: pr.mergeCommit?.oid ?? null,
    terminalState: terminal,
    mergedAt: pr.mergedAt,
    mergedBy: pr.mergedBy?.login ?? null,
    filePaths: pr.files.nodes.map((row) => row.path),
    reviewIds: pr.reviews.nodes.map((row) => row.databaseId),
    observedExactHeadApprovalIds: pr.reviews.nodes.flatMap((row) =>
      row.state === 'APPROVED' && row.commit?.oid === pr.headRefOid ? [row.databaseId] : []
    ),
    observedChangesRequestedIds: pr.reviews.nodes.flatMap((row) =>
      row.state === 'CHANGES_REQUESTED' ? [row.databaseId] : []
    ),
  }))
    same(facts[field], expected, `${label}: ${field}`);
  const rollup = pr.head.nodes[0]?.commit.statusCheckRollup;
  const contexts = rollup?.contexts.nodes ?? [];
  if (rollup)
    same(rollup.contexts.pageInfo.hasNextPage, false, `${label}: complete check contexts`);
  const counts = {};
  const nativeDco = [];
  for (const context of contexts) {
    const status = context.conclusion ?? context.state ?? context.status ?? 'UNKNOWN';
    counts[status] = (counts[status] ?? 0) + 1;
    const name = context.name ?? context.context ?? '';
    if (/\bDCO\b|developer certificate/i.test(name))
      nativeDco.push({
        name,
        state: context.conclusion ?? context.state ?? context.status,
        url: context.detailsUrl ?? context.targetUrl,
      });
  }
  same(facts.observedHeadRollup, rollup?.state ?? 'UNAVAILABLE', `${label}: rollup`);
  same(
    facts.observedContextCounts,
    counts,
    `${label}: exact SUCCESS/FAILURE/SKIPPED/other observations`
  );
  same(facts.contextCount, contexts.length, `${label}: context count`);
  same(facts.contextPaginationComplete, true, `${label}: complete captured contexts`);
  same(facts.nativeDco, nativeDco, `${label}: native DCO observations`);
  const trailers = {
    authorMatched: 0,
    presentButNotAuthorMatched: 0,
    absent: 0,
    total: pr.commits.totalCount,
  };
  for (const { commit } of pr.commits.nodes) {
    const signers = commit.message.split('\n').flatMap((line) => {
      const match = /^signed-off-by:\s*(.*?)\s*<([^<>]+)>\s*$/i.exec(line);
      return match
        ? [{ name: match[1].trim().toLowerCase(), email: match[2].trim().toLowerCase() }]
        : [];
    });
    const matches = signers.some(
      (signer) =>
        signer.name === commit.author.name?.trim().toLowerCase() &&
        signer.email === commit.author.email?.trim().toLowerCase()
    );
    trailers[
      matches ? 'authorMatched' : signers.length ? 'presentButNotAuthorMatched' : 'absent'
    ]++;
  }
  same(facts.originalCommitTrailers, trailers, `${label}: literal original author/signoff matches`);
  const group =
    terminal === 'MERGED'
      ? pr.reviews.nodes.length && contexts.length && nativeDco.length
        ? 'merged-with-preserved-native-evidence'
        : 'merged-with-explicit-evidence-gaps'
      : terminal === 'OPEN'
        ? 'open-pull-request'
        : 'closed-without-merge';
  same(decision.group, group, `${label}: historical disposition group`);
}

export function verifyFrozenFacts(snapshot, decisions, manualReadings) {
  const all = pageRows(snapshot.issuePages, 'objects');
  const objects = all.filter((row) => row.created_at <= snapshot.membershipCutoff);
  const comments = pageRows(snapshot.commentPages, 'comments').filter(
    (row) => row.created_at <= snapshot.membershipCutoff
  );
  same(new Set(objects.map((row) => row.number)).size, objects.length, 'unique source objects');
  same(new Set(decisions.map((row) => row.number)).size, decisions.length, 'unique decisions');
  same(
    decisions.map((row) => row.number).sort((a, b) => a - b),
    objects.map((row) => row.number).sort((a, b) => a - b),
    'exact membership'
  );
  const byNumber = new Map(decisions.map((row) => [row.number, row]));
  const native = new Map(snapshot.pullRequests.map((row) => [row.pullRequest.number, row]));
  const timeline = new Map(snapshot.issueTimeline.map((row) => [row.issue.number, row]));
  const inline = pageRows(snapshot.inlinePages, 'inline comments');
  const read = new Map(manualReadings.map((row) => [row.number, row]));
  const results = [];
  for (const object of objects) {
    const number = object.number;
    const decision = byNumber.get(number);
    const discussion = comments
      .filter((row) => Number(row.issue_url.split('/').at(-1)) === number)
      .sort((a, b) => a.id - b.id);
    const label = `#${number}`;
    same(decision.bodySha256, digest(object.body ?? ''), `${label}: exact body`);
    same(decision.discussionSha256, digest(discussion), `${label}: complete frozen discussion`);
    same(decision.state, 'reconciled', `${label}: disposition state`);
    same(
      decision.technicalAcceptance,
      'No new product acceptance, spec lifecycle promotion, approval, merge or author certification',
      `${label}: no technical upgrade`
    );
    same(
      decision.sourceConstraints.observedAssignees,
      object.assignees.map((row) => row.login),
      `${label}: observed assignees`
    );
    const kind = object.pull_request ? 'pr' : 'issue';
    const sources = new Map([
      [`github.${kind}.${number}.body@${digest(object.body ?? '')}`, object.body ?? ''],
    ]);
    for (const comment of discussion)
      sources.set(`github.comment.${comment.id}@${digest(comment.body ?? '')}`, comment.body ?? '');
    if (object.pull_request) {
      const capture = native.get(number);
      assert.ok(capture, `${label}: native metadata exists`);
      verifyPullRequestFacts(object, capture, decision);
      assert.ok(
        decision.sources.includes(`github.pr.${number}.metadata@${digest(capture)}`),
        `${label}: exact native metadata binding`
      );
      for (const review of capture.pullRequest.reviews.nodes)
        sources.set(
          `github.review.${review.databaseId}@${digest(review.body ?? '')}`,
          review.body ?? ''
        );
      for (const comment of inline.filter((row) => row.pull_request_url?.endsWith(`/${number}`)))
        sources.set(
          `github.review-comment.${comment.id}@${digest(comment.body ?? '')}`,
          comment.body ?? ''
        );
    } else {
      const capture = timeline.get(number);
      assert.ok(capture, `${label}: native timeline exists`);
      const connection = capture.issue.timelineItems;
      same(connection.nodes.length, connection.totalCount, `${label}: complete selected timeline`);
      same(connection.pageInfo.hasNextPage, false, `${label}: timeline terminal`);
      const events = connection.nodes.filter((row) => row.createdAt <= snapshot.membershipCutoff);
      const closes = events.filter((row) => row.__typename === 'ClosedEvent');
      const reopens = events.filter((row) => row.__typename === 'ReopenedEvent');
      const closing = closes.at(-1);
      const preceding = discussion
        .filter((row) => row.created_at <= (closing?.createdAt ?? snapshot.membershipCutoff))
        .at(-1);
      same(
        decision.issueFacts,
        {
          timelineSource: `github.issue.${number}.timeline@${digest(capture)}`,
          closingSources: closes.map((row) => ({
            at: row.createdAt,
            actor: row.actor?.login ?? null,
            closer: row.closer,
          })),
          reopenEvents: reopens,
          lastPreCloseComment: preceding
            ? { id: preceding.id, url: preceding.html_url, sha256: digest(preceding.body ?? '') }
            : null,
        },
        `${label}: native closing, reopening and pre-close discussion facts`
      );
      if (!read.has(number))
        same(
          decision.group,
          object.state === 'open'
            ? 'open-original-conditions-routed'
            : closing?.closer
              ? 'closed-with-native-closing-source'
              : 'closed-with-explicit-evidence-gap',
          `${label}: source disposition group`
        );
    }
    const current = currentConditions(sources);
    const original = snapshot.originalSources.filter((row) => row.number === number);
    for (const row of original) {
      same(
        row.originalSha256,
        digest(row.original),
        `${label}: original source text hash ${row.key}`
      );
      sources.set(row.key, row.original);
    }
    same(
      decision.retainedCurrentCriterionKeys,
      current.map((row) => row.sourceKey),
      `${label}: all current source criteria retained`
    );
    same(
      decision.retainedOriginalCriterionKeys,
      original.map((row) => row.key),
      `${label}: all original source criteria retained`
    );
    const expectedConditions = current.concat(
      original.map((row) => ({
        sourceKey: row.key,
        originalSha256: row.originalSha256,
        historicalChecked: row.historicalChecked ?? null,
      }))
    );
    same(
      decision.conditionDispositions.length,
      expectedConditions.length,
      `${label}: no missing or added criterion`
    );
    for (const [index, condition] of decision.conditionDispositions.entries()) {
      const expected = expectedConditions[index];
      for (const key of Object.keys(expected))
        same(condition[key], expected[key], `${label}: retained ${key}`);
      same(
        condition.targetIssue,
        object.state === 'open' ? number : 1147,
        `${label}: own execution or historical-evidence owner`
      );
      same(
        condition.disposition,
        object.state === 'open'
          ? 'retain-complete-condition-in-existing-issue'
          : 'retain-historical-condition-and-its-evidence-limit',
        `${label}: no criterion promoted to pass`
      );
      assert.ok(condition.owner.includes(`#${condition.targetIssue}`), `${label}: owner binding`);
    }
    for (const field of [
      'specAndLifecycle',
      'originalChangeBoundaries',
      'currentAndHistoricalClaimSources',
    ]) {
      for (const excerpt of decision.sourceConstraints[field]) {
        assert.ok(sources.has(excerpt.sourceKey), `${label}: source excerpt exists`);
        same(
          excerpt.text,
          sources.get(excerpt.sourceKey).split(/\r?\n/)[excerpt.line - 1],
          `${label}: exact source excerpt`
        );
      }
    }
    const gap = decision.remaining.filter((row) => row.disposition === 'historical-source-gap');
    same(gap.length, 1, `${label}: one explicit unavailable-source disposition`);
    same(gap[0].targetIssue, 1147, `${label}: historical-source owner`);
    const own = decision.remaining.filter(
      (row) => row.targetIssue === number && row.disposition === 'existing-execution-issue'
    );
    same(
      own.length,
      object.state === 'open' ? 1 : 0,
      `${label}: open scope remains with its original issue`
    );
    const manual = read.get(number);
    if (manual) {
      same(manual.bodySha256, decision.bodySha256, `${label}: full reading body binding`);
      same(
        manual.discussionSha256,
        decision.discussionSha256,
        `${label}: full reading discussion binding`
      );
      assert.ok(manual.conclusion?.trim(), `${label}: explicit manual conclusion`);
    }
    results.push({
      number,
      kind,
      state: object.state,
      group: decision.group,
      bodySha256: decision.bodySha256,
      discussionSha256: decision.discussionSha256,
      nativeSource: object.pull_request
        ? `github.pr.${number}.metadata@${digest(native.get(number))}`
        : decision.issueFacts.timelineSource,
      currentSourceConditions: current.length,
      originalSourceConditions: original.length,
      acceptedScope: manual
        ? 'Complete frozen body/discussion historical disposition, native source facts, source-condition preservation and evidence limitations.'
        : 'Recorded native/source metadata disposition, exact retained source conditions, literal source excerpts, assignees and explicit evidence limits. No manual implementation review claimed.',
      fullBodyDiscussionReading: manual ?? null,
      technicalAcceptance: false,
    });
  }
  same(
    read.size,
    results.filter((row) => row.fullBodyDiscussionReading).length,
    'manual reading population'
  );
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [snapshotPath, decisionsPath, readingsPath, output] = process.argv.slice(2);
  assert.ok(
    snapshotPath && decisionsPath && readingsPath && output,
    'Usage: review-history-facts.mjs SNAPSHOT.json.gz DECISIONS.json.gz MANUAL_READINGS.json OUTPUT.json.gz'
  );
  const snapshot = await readHistorySnapshot(snapshotPath);
  const decisions = await readHistoryJSON(decisionsPath);
  const readings = JSON.parse(await readFile(readingsPath, 'utf8'));
  const objects = verifyFrozenFacts(snapshot, decisions, readings);
  const result = {
    schemaVersion: 1,
    reviewer: 'Codex /root/history_acceptance',
    membershipCutoff: snapshot.membershipCutoff,
    snapshotSha256: digest(snapshot),
    decisionSetSha256: digest(decisions),
    method:
      'Independent source-to-fact comparisons against the decoded original REST and GraphQL captures; no invocation of the decision producer or buildAudit as oracle. Manual conclusions are separately source-bound. Successor polarity/scope is independently read and recorded in the 496-reference review, not inferred by this verifier.',
    scope:
      'Historical synchronization only: metadata and explicit dispositions must match their sources, all original conditions stay intact, and missing historical proof remains missing. Recorded review submissions/signoff strings are observations, not present approval, authenticated authorship or product acceptance.',
    captureLimit:
      'The cutoff fixes object membership, not an atomic historical snapshot of every body or PR field. Current captured body versions and selected native event types retain the original capture limitations. Original-at-creation text, unarchived edits and absent native receipts are not reconstructed.',
    counts: {
      objects: objects.length,
      pullRequests: objects.filter((row) => row.kind === 'pr').length,
      issues: objects.filter((row) => row.kind === 'issue').length,
      fullBodyDiscussionReadings: readings.length,
      currentSourceConditions: objects.reduce((n, row) => n + row.currentSourceConditions, 0),
      originalSourceConditions: objects.reduce((n, row) => n + row.originalSourceConditions, 0),
      newTechnicalAcceptances: 0,
    },
    objects,
  };
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  await writeFile(output, output.endsWith('.gz') ? gzipSync(serialized, { level: 9 }) : serialized);
  console.log(JSON.stringify(result.counts, null, 2));
}
