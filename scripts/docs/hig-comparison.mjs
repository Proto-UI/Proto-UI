import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RECONCILIATION = 'internal/records/2026-11-10-apple-hig-source-reconciliation.json';
export const APPLE_PLATFORMS = ['iOS', 'iPadOS', 'macOS', 'tvOS', 'visionOS', 'watchOS'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const valueDigest = (value) => sha256(JSON.stringify(value));
const topicKey = (row) => `hig:${new URL(row.url).pathname.split('/').at(-1)}`;

function indexBy(values, key, label) {
  const index = new Map();
  for (const value of values) {
    const identity = key(value);
    assert.ok(!index.has(identity), `Duplicate ${label}: ${identity}`);
    index.set(identity, value);
  }
  return index;
}

function validatePlatforms(values, label) {
  assert.ok(Array.isArray(values), `${label} must be an array`);
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
  for (const value of values) assert.ok(APPLE_PLATFORMS.includes(value), `${label}: ${value}`);
}

export function createHigComparison({ review, carrier, issue, reconciliation, view = 'reconciled' }) {
  assert.ok(['historical', 'reconciled'].includes(view), `Unknown comparison view: ${view}`);
  const rows = indexBy(review.rows, topicKey, 'HIG topic');
  const topicRecords = carrier.originalDebtSnapshot.records.filter((record) => record.kind === 'hig-topic');
  const parents = indexBy(topicRecords, (record) => record.key, 'parent topic');
  const bindings = indexBy(reconciliation.topics, (record) => record.sourceKey, 'topic binding');
  const corrections = indexBy(reconciliation.platformCorrections, (record) => record.sourceKey, 'platform correction');
  assert.equal(rows.size, 158, 'The original 158-topic inventory must remain complete');
  assert.equal(parents.size, rows.size, 'Every original parent topic must remain accounted for');
  assert.equal(bindings.size, rows.size, 'Every topic needs its original source binding');
  assert.equal(topicRecords.filter((record) => record.requiresFollowupCheckbox).length, 82);
  assert.equal(issue.number, 864);
  assert.equal(issue.criteria.length, 163, 'Keep all five completion conditions and 158 topic conditions');
  const criteria = indexBy(issue.criteria, (criterion) => criterion.key, 'Issue criterion');
  const usedCriteria = new Set();
  for (const key of corrections.keys()) assert.ok(rows.has(key), `Unknown corrected topic: ${key}`);

  const comparisonRows = [...rows].map(([sourceKey, original]) => {
    const parent = parents.get(sourceKey);
    const binding = bindings.get(sourceKey);
    assert.ok(parent && binding, `Missing original source binding: ${sourceKey}`);
    assert.equal(parent.sourceUrl, original.url, `Parent URL mismatch: ${sourceKey}`);
    assert.deepEqual(parent.completeOriginalStructuredRow, original, `Parent row differs: ${sourceKey}`);
    assert.equal(binding.sourceRowSha256, valueDigest(original), `Changed original row: ${sourceKey}`);
    assert.equal(binding.parentRecordSha256, valueDigest(parent), `Changed parent condition: ${sourceKey}`);
    const criterion = criteria.get(binding.issueCriterionKey);
    assert.ok(criterion?.original.includes(`](${original.url})`), `Issue criterion mismatch: ${sourceKey}`);
    assert.ok(!usedCriteria.has(criterion.key), `Reused Issue topic condition: ${criterion.key}`);
    usedCriteria.add(criterion.key);

    const correction = corrections.get(sourceKey);
    if (correction) {
      assert.equal(correction.sourceField, 'source.platformScopeSummary');
      assert.equal(correction.sourceSummary, original.source.platformScopeSummary, `Changed platform summary: ${sourceKey}`);
      assert.equal(correction.articleBodySha256, original.source.bodySha256, `Changed article binding: ${sourceKey}`);
      validatePlatforms(correction.affirmedPlatforms, `${sourceKey} affirmations`);
      validatePlatforms(correction.excludedPlatforms, `${sourceKey} exclusions`);
      for (const platform of correction.affirmedPlatforms) {
        assert.ok(!correction.excludedPlatforms.includes(platform), `Conflicting article scope: ${sourceKey}/${platform}`);
      }
      for (const field of ['affirmedPlatforms', 'excludedPlatforms']) {
        for (const platform of original.applePlatformScope[field]) {
          assert.ok(correction[field].includes(platform), `Lost original ${field}: ${sourceKey}/${platform}`);
        }
      }
      for (const qualification of correction.qualifiedPlatforms) {
        assert.ok(APPLE_PLATFORMS.includes(qualification.platform), `Unknown qualified platform: ${sourceKey}`);
        assert.ok(qualification.scope.length > 0, `Missing platform qualification: ${sourceKey}`);
      }
    }
    const parentCondition = { ...parent };
    delete parentCondition.completeOriginalStructuredRow;
    return {
      sourceKey,
      issueCriterion: criterion,
      parentCondition,
      original,
      appleArticleScope: view === 'reconciled' && correction ? {
        ...original.applePlatformScope,
        affirmedPlatforms: correction.affirmedPlatforms,
        excludedPlatforms: correction.excludedPlatforms,
        qualifiedPlatforms: correction.qualifiedPlatforms,
        basis: 'retained-source-summary-reconciliation',
      } : { ...original.applePlatformScope, qualifiedPlatforms: [] },
      platformReconciliation: view === 'reconciled' ? correction ?? null : null,
      currentRuntimeResult: 'not-run',
    };
  });
  assert.equal(usedCriteria.size, 158, 'Every topic must keep a distinct Issue criterion');
  const completionCriteria = issue.criteria.filter((criterion) => !usedCriteria.has(criterion.key));
  assert.equal(completionCriteria.length, 5, 'No original completion condition may disappear');
  return {
    schemaVersion: 1,
    kind: 'apple-hig-source-comparison',
    view,
    sourceInputs: reconciliation.inputs,
    sourceAccessDate: review.accessDate,
    sourceBaseline: review.baseline,
    sourceBoundaries: review.boundaries,
    originalCoverage: review.coverage,
    originalEvidenceCatalog: review.evidenceCatalog,
    sourceDriftObservations: review.sourceDriftObservations,
    priorityFindings: review.priorityFindings,
    issueDisposition: { release: issue.release, reason: issue.reason, nextAction: issue.nextAction },
    originalCompletionCriteria: completionCriteria,
    parentCrossCuttingCriteria: carrier.originalDebtSnapshot.higCrossCuttingCriteria,
    parentCoordinationCriteria: carrier.originalDebtSnapshot.coordinationCriteria,
    parentDiscussionConditions: [
      ...carrier.originalDebtSnapshot.records.filter(
        (record) => (record.pr === 869 && record.kind !== 'hig-topic') || record.kind === 'historical-source-drift'
      ),
      ...carrier.firstRefreshRecords.filter((record) => record.pr === 869),
      ...carrier.finalPostmergeRecords.filter((record) => record.pr === 869),
    ],
    currentEvidence: {
      result: 'not-run',
      completeArticleRuntimeVerified: 0,
      officialArticlesReaccessed: 0,
      appleNativeOrAssistiveTechnologyCertification: false,
      limitation: 'This is source comparison and platform triage. Historical judgments are retained; source readback and article applicability establish no Proto support or current runtime acceptance.',
    },
    rows: comparisonRows,
  };
}

// Classify the Apple article, including unknowns; never classify Proto platform support.
export function classifyArticlePlatform(row, platform) {
  assert.ok(APPLE_PLATFORMS.includes(platform), `Unknown Apple platform: ${platform}`);
  const scope = row.appleArticleScope;
  const qualifications = scope.qualifiedPlatforms.filter((entry) => entry.platform === platform);
  const affirmed = scope.affirmedPlatforms.includes(platform);
  const excluded = scope.excludedPlatforms.includes(platform);
  const mentioned = scope.platformSectionMentions.includes(platform);
  return {
    sourceKey: row.sourceKey,
    issueCriterionKey: row.issueCriterion.key,
    platform,
    disposition: excluded ? 'excluded' : affirmed ? 'affirmed' : qualifications.length ? 'qualified' : mentioned ? 'mentioned-only' : 'unknown',
    affirmed,
    excluded,
    mentioned,
    qualifications,
    protoSupport: 'not-established',
    currentRuntimeResult: row.currentRuntimeResult,
  };
}

async function loadPinned(root, pin) {
  const bytes = execFileSync('git', ['show', `${pin.revision}:${pin.path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(sha256(bytes), pin.sha256, `Historical input changed: ${pin.path}`);
  return bytes;
}

function findIssue(ledger) {
  return ledger.issueSnapshot.issues.find((issue) => issue.number === 864);
}

async function readSources(root, rows) {
  const sources = [];
  for (const sourcePath of [...new Set(rows.flatMap((row) => row.original.proto.sourcePaths))].sort()) {
    let bytes;
    try {
      bytes = await readFile(path.join(root, sourcePath));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      sources.push({ path: sourcePath, state: 'missing', sha256: null, entity: null });
      continue;
    }
    let entity = null;
    if (sourcePath.endsWith('.yaml')) {
      const parsed = parseYaml(bytes.toString('utf8'));
      const relations = {};
      for (const key of ['relates', 'dependsOn', 'inherits', 'references', 'refines', 'satisfies', 'verifies', 'explains', 'exercises', 'requires', 'owns', 'supports', 'provides', 'omits']) {
        if (parsed[key] !== undefined) relations[key] = parsed[key];
      }
      entity = {
        id: parsed.id,
        status: parsed.status,
        since: parsed.since,
        activeSince: parsed.activeSince ?? null,
        lifecycleRationale: parsed.lifecycleRationale ?? null,
        criterionIds: (parsed.criteria ?? []).map((criterion) => criterion.id),
        relations,
      };
    }
    sources.push({ path: sourcePath, state: 'present', sha256: sha256(bytes), entity });
  }
  return sources;
}

export async function loadHigComparison({ root = ROOT, view = 'reconciled' } = {}) {
  const reconciliationBytes = await readFile(path.join(root, RECONCILIATION));
  const reconciliation = JSON.parse(reconciliationBytes);
  const inputs = {};
  for (const [name, pin] of Object.entries(reconciliation.inputs)) inputs[name] = await loadPinned(root, pin);
  const report = createHigComparison({
    review: JSON.parse(inputs.review),
    carrier: JSON.parse(inputs.carrier),
    issue: findIssue(JSON.parse(inputs.issueLedger)),
    reconciliation,
    view,
  });
  report.readback = {
    headContext: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceKind: 'worktree-file-bytes; head is context, not a claim of a clean tree',
    reconciliationSha256: sha256(reconciliationBytes),
    sources: await readSources(root, report.rows),
    limitation: 'Only source bytes and catalog metadata were read. Presence, lifecycle and declared relations are not executed conformance evidence.',
  };
  return report;
}

function cell(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

export function renderHigComparison(report) {
  const currentSources = new Map((report.readback?.sources ?? []).map((source) => [source.path, source]));
  const lines = [
    '# Apple HIG × Proto UI：源比较与归属续接',
    '',
    `文章访问日期：${report.sourceAccessDate}；原始源码基线：\`${report.sourceBaseline}\`。view：\`${report.view}\`。`,
    '',
    '全部历史行、Issue 条件和父级条件保留。相容性、owner 与采纳理由属于原始比较，不新增规范或变更生命周期。Apple 文章适用范围不代表 Proto UI 支持。',
    '',
    `历史：${report.originalCoverage.uniqueLeafArticles} 篇入册，${report.originalCoverage.articleBodiesRead} 篇正文已读，${report.originalCoverage.rowsSourceMapped} 篇源映射，${report.originalCoverage.completeArticleRuntimeVerified} 篇整体运行认证，最终未读 ${report.originalCoverage.finalUnreadArticles}。本次产品运行结果：not-run；重新访问文章：0。`,
    '',
    '## 原始完成条件',
    '',
  ];
  for (const criterion of report.originalCompletionCriteria) lines.push(`- \`${criterion.key}\` — ${cell(criterion.original)}；当前执行未验收。`);
  lines.push('', '## 父级条件', '');
  for (const criterion of report.parentCrossCuttingCriteria) lines.push(`- ${cell(criterion)}`);
  lines.push('', cell(report.parentCoordinationCriteria), '');
  for (const condition of report.parentDiscussionConditions) {
    lines.push(`- [${condition.key}](${condition.sourceUrl}) — ${cell(condition.explicitCriteria?.join('；') || condition.caption || condition.interpretation)}；原始 disposition：${cell(condition.disposition ?? condition.classification)}。完整正文/回复和历史 flags 保留在 JSON 报告。`);
  }
  let group;
  for (const row of report.rows) {
    const original = row.original;
    if (group !== original.group) {
      group = original.group;
      lines.push('', `## ${cell(group)}`, '', '| 文章 / 源条件 | 理念相容性 / 理由 | 抽象归属 / 采纳 | Apple 文章平台范围 | 历史状态 / 未完验收 | 源证据 |', '| --- | --- | --- | --- | --- | --- |');
    }
    const scope = row.appleArticleScope;
    const platformText = `原范围说明：${original.appleApplicablePlatforms}；肯定：${scope.affirmedPlatforms.join('、') || '未知'}；排除：${scope.excludedPlatforms.join('、') || '未记录'}；仅平台节提及：${scope.platformSectionMentions.join('、') || '无'}；限定：${scope.qualifiedPlatforms.map((entry) => `${entry.platform}：${entry.scope}`).join('；') || '无新增限定'}；${scope.limitation}`;
    const originalSources = original.proto.sourcePaths.map((sourcePath) => `[${sourcePath}](https://github.com/Proto-UI/Proto-UI/blob/${original.proto.baseline}/${sourcePath})`).join('<br>');
    const entities = original.proto.entities.map((entity) => {
      const current = currentSources.get(entity.path);
      return `${entity.id}（原 ${entity.status}；当前 ${current?.entity?.status ?? '未读回'}）`;
    }).join('；');
    const sourceSummary = row.platformReconciliation ? `平台纠错依据：${row.platformReconciliation.sourceSummary}（原正文 hash ${row.platformReconciliation.articleBodySha256}；未重新访问）` : '平台字段沿用原记录，未知保留';
    const columns = [
      `[${cell(original.item)}](${original.url})<br>\`${row.sourceKey}\` / \`${row.issueCriterion.key}\`<br>${original.accessDate}`,
      `${cell(original.philosophyCompatibility)}<br>${cell(original.decisionReason)}`,
      `${cell(original.abstractionOwnership)}<br>${cell(original.adoptionDecision)}`,
      `${cell(platformText)}<br>${cell(sourceSummary)}`,
      `${cell(original.status)} / ${original.priority}；当前 not-run<br>${cell(row.parentCondition.explicitCriteria?.join('；') || row.parentCondition.caption)}<br>${cell(original.nextStep)}<br>${cell(original.verificationLimit)}<br>原关联：${original.existingIssueCandidates.map((number) => `#${number}`).join('、')}`,
      `${cell(original.evidence)}<br>${cell(entities)}<br>${originalSources}`,
    ];
    lines.push(`| ${columns.join(' | ')} |`);
  }
  if (report.readback) {
    lines.push('', '## 当前源字节与生命周期读回', '', `HEAD 上下文：\`${report.readback.headContext}\`；${cell(report.readback.sourceKind)}。`, '', cell(report.readback.limitation), '', '| 路径 | 状态 | SHA-256 | 实体 / 生命周期 |', '| --- | --- | --- | --- |');
    for (const source of report.readback.sources) lines.push(`| ${cell(source.path)} | ${source.state} | ${source.sha256 ?? '未知'} | ${source.entity ? `${source.entity.id} / ${source.entity.status} / since ${source.entity.since} / activeSince ${source.entity.activeSince ?? '未知'}` : '非实体或缺失'} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { view: 'reconciled', format: 'json' };
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    assert.ok(['--view', '--format', '--platform'].includes(key), `Unknown argument: ${key}`);
    const value = process.argv[index + 1];
    assert.ok(value && !value.startsWith('--'), `Missing value for ${key}`);
    options[key.slice(2)] = value;
  }
  assert.ok(['json', 'markdown'].includes(options.format), `Unknown output format: ${options.format}`);
  assert.ok(options.platform === undefined || options.format === 'json', 'Platform triage uses JSON so unknowns and qualifications remain structured');
  const report = await loadHigComparison({ view: options.view });
  if (options.platform !== undefined) report.platformTriage = report.rows.map((row) => classifyArticlePlatform(row, options.platform));
  process.stdout.write(options.format === 'markdown' ? renderHigComparison(report) : `${JSON.stringify(report, null, 2)}\n`);
}
