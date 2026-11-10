import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { json, readJson, safeFile, sealEvidence, sha256, verifyEvidence, writeNew } from './evidence.mjs';
import { timestampValue } from './schemas.mjs';
import { discoveryCategories, discoveryDimensions, discoverySchemas, validateDiscovery } from './discovery-schema.mjs';

const defaultManifestPath = 'benchmarks/interaction/discovery/study.json';
const harnessPaths = [
  'scripts/benchmark/discovery-study.mjs', 'scripts/benchmark/discovery-schema.mjs',
  'scripts/benchmark/evidence.mjs', 'scripts/benchmark/schemas.mjs',
  'scripts/benchmark/test/discovery-study.test.mjs', 'benchmarks/interaction/discovery/README.md',
];
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const unique = (values, label) => {
  requireFact(new Set(values).size === values.length, `Duplicate ${label}`);
  return new Set(values);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sameSet = (left, right) => same([...left].sort(), [...right].sort());
function bytesAt(root, relative) {
  const file = safeFile(root, relative);
  requireFact(fs.statSync(file).isFile(), `Not a regular evidence file: ${relative}`);
  return fs.readFileSync(file);
}
function boundBytes(root, ref) {
  const bytes = bytesAt(root, ref.path);
  requireFact(sha256(bytes) === ref.sha256, `Digest mismatch: ${ref.path}`);
  return bytes;
}
function boundDocument(root, ref, kind) {
  return validateDiscovery(kind, JSON.parse(boundBytes(root, ref).toString('utf8')));
}
function newDirectory(out) {
  fs.mkdirSync(out, { recursive: false });
}
function validateManifest(manifest) {
  validateDiscovery('manifest', manifest);
  unique(manifest.sourceFiles.map((file) => file.path), 'source file');
  unique(manifest.participantPrompts.map((file) => file.path), 'participant prompt');
  unique(manifest.referenceDocuments.map((file) => file.path), 'reference document');
  unique(manifest.primitives.map((item) => item.caseId), 'primitive case');
  const sources = new Map(manifest.sourceFiles.map((file) => [file.path, file]));
  for (const primitive of manifest.primitives) {
    unique(primitive.references.map((ref) => ref.id), `reference in ${primitive.caseId}`);
    requireFact(manifest.participantPrompts.some((file) => file.path === primitive.prompt.path && file.sha256 === primitive.prompt.sha256), `Participant prompt digest differs: ${primitive.caseId}`);
    for (const ref of primitive.references) {
      requireFact(sources.get(ref.path)?.role === 'catalog', `Reference lacks catalog snapshot: ${ref.id}`);
      requireFact(ref.id === `${ref.entityId}#${ref.criterionId}`, `Unbound reference anchor: ${ref.id}`);
    }
    requireFact(sources.get(primitive.parentCase.path)?.sha256 === primitive.parentCase.sha256, 'Parent case is not source-bound');
  }
  requireFact(sameSet(manifest.participantPrompts.map((file) => file.path), manifest.primitives.map((item) => item.prompt.path)), 'Participant prompts must match selected primitives');
  for (const prompt of manifest.participantPrompts) requireFact(!sources.has(prompt.path), 'Participant prompts are not withheld evaluator source files');
  requireFact(sameSet([...new Set(manifest.primitives.flatMap((item) => item.references.map((ref) => ref.path)))], manifest.referenceDocuments.map((file) => file.path)), 'Reference documents must match selected catalog files');
  for (const file of manifest.referenceDocuments) requireFact(sources.get(file.path)?.sha256 === file.sha256, `Reference digest is not source-bound: ${file.path}`);
  return manifest;
}

/** Freeze only explicit public source bytes. This never launches a participant or evaluator. */
export function freezeDiscovery({ root, out, manifest = defaultManifestPath }) {
  const studyBytes = bytesAt(root, manifest);
  const study = validateManifest(JSON.parse(studyBytes.toString('utf8')));
  const captures = new Map();
  for (const source of study.sourceFiles) captures.set(`sources/${source.path}`, boundBytes(root, source));
  const dataset = JSON.parse(captures.get('sources/benchmarks/interaction/dataset.json').toString('utf8'));
  const scoring = JSON.parse(captures.get('sources/benchmarks/interaction/scoring.json').toString('utf8'));
  requireFact(dataset.id === study.datasetId && dataset.version === study.datasetVersion, 'Dataset identity differs from frozen selection');
  requireFact(scoring.version === study.scoringVersion && same(scoring.discoveryCategories, discoveryCategories), 'Discovery vocabulary differs from benchmark scoring');
  for (const primitive of study.primitives) {
    const parent = JSON.parse(boundBytes(root, primitive.parentCase).toString('utf8'));
    requireFact(parent.id === primitive.caseId && parent.datasetId === study.datasetId && parent.split === 'development', 'Parent case identity/split differs');
    captures.set(`participant/${primitive.caseId}/prompt.txt`, boundBytes(root, primitive.prompt));
    const promptText = captures.get(`participant/${primitive.caseId}/prompt.txt`).toString('utf8');
    for (const prohibited of [primitive.rootEntity, 'P-BASE-', 'T-BASE-', 'spec/', 'oracleRef', 'criteriaId'])
      requireFact(!promptText.includes(prohibited), `Participant prompt leaks evaluator identity: ${prohibited}`);
    for (const ref of primitive.references) {
      const sourceText = captures.get(`sources/${ref.path}`).toString('utf8');
      requireFact(sourceText.includes(`id: ${ref.criterionId}`), `Missing declared criterion anchor: ${ref.id}`);
    }
  }
  for (const file of harnessPaths) captures.set(`harness/${file}`, bytesAt(root, file));
  newDirectory(out);
  writeNew(out, 'study.json', studyBytes);
  for (const [name, bytes] of captures) writeNew(out, name, bytes);
  const inventorySha256 = sealEvidence(out);
  return {
    studyId: study.id, frozenStudySha256: sha256(studyBytes), inventorySha256,
    cases: study.primitives.map((item) => item.caseId),
    status: 'source-frozen-no-runs', formalExecution: 'disabled',
    warning: 'Evaluator archive contains reference answers. Export only one participant/<case>/prompt.txt to a fresh subject; this projection is not isolation.',
  };
}

function citationText(citation, inputRoot, archive, study) {
  const root = citation.origin === 'input' ? inputRoot : path.join(archive, 'sources');
  if (citation.origin === 'frozen-source')
    requireFact(study.sourceFiles.some((file) => file.path === citation.file.path && file.sha256 === citation.file.sha256), 'Citation is outside frozen source membership');
  const lines = boundBytes(root, citation.file).toString('utf8').split('\n');
  requireFact(citation.endLine >= citation.startLine && citation.endLine <= lines.length, `Citation line range is outside ${citation.file.path}`);
  return lines.slice(citation.startLine - 1, citation.endLine).join('\n');
}
function reviewRun({ run, proposals, primitive, observations, inputRoot, archive, study }) {
  if (run.review === null) return { eligible: [], rows: [], pending: proposals.map((item) => item.id), reason: 'Independent semantic review is unavailable' };
  const review = boundDocument(inputRoot, run.review, 'review');
  requireFact(review.runId === run.id, 'Review run identity differs');
  requireFact(review.reviewerId !== observations.coordinatorId && !observations.runs.some((item) => item.participantId === review.reviewerId), 'Semantic reviewer must be distinct from coordinator and every participant');
  boundBytes(inputRoot, review.independenceEvidence);
  boundBytes(inputRoot, review.extractionCompleteness);
  const referenceIds = unique(primitive.references.map((item) => item.id), 'reference');
  unique(review.referenceEligibility.map((item) => item.referenceId), 'reference eligibility');
  requireFact(sameSet(referenceIds, review.referenceEligibility.map((item) => item.referenceId)), 'Eligibility must account for every selected reference criterion');
  const eligible = review.referenceEligibility.filter((item) => item.eligible).map((item) => item.referenceId);
  const proposalIds = new Set(proposals.map((item) => item.id));
  const usedProposals = [], usedReferences = [];
  unique(review.rows.map((item) => item.id), 'crosswalk row');
  for (const row of review.rows) {
    unique(row.proposalIds, 'proposal within row'); unique(row.referenceIds, 'reference within row'); unique(row.dimensions, 'dimension within row');
    requireFact(row.proposalIds.length + row.referenceIds.length > 0, 'Empty semantic comparison row');
    requireFact(row.proposalIds.every((id) => proposalIds.has(id)), 'Crosswalk cites an unknown proposal');
    requireFact(row.referenceIds.every((id) => eligible.includes(id)), 'Crosswalk cites an excluded/unknown reference');
    const paired = ['both', 'semantically-equivalent'].includes(row.category);
    const novel = ['agent-only-valid', 'missing-from-proto'].includes(row.category);
    if (paired) requireFact(row.proposalIds.length > 0 && row.referenceIds.length > 0, 'Shared/equivalent category requires both sides');
    if (novel) requireFact(row.proposalIds.length > 0 && row.referenceIds.length === 0 && row.feedback !== null, 'Valid unique findings require Agent-only claims and a candidate feedback artifact');
    if (row.category === 'proto-only') requireFact(row.proposalIds.length === 0 && row.referenceIds.length > 0, 'Proto-only category cannot contain Agent proposals');
    if (row.category === 'unsupported-false') requireFact(row.proposalIds.length > 0 && row.referenceIds.length === 0, 'Unsupported requirements are a separate Agent-only disposition');
    if (row.category === 'missing-from-proto') requireFact(row.missingSearch !== null, 'A genuine missing claim requires a scoped reference-search receipt');
    for (const citation of row.citations) citationText(citation, inputRoot, archive, study);
    for (const id of row.referenceIds) {
      const ref = primitive.references.find((item) => item.id === id);
      requireFact(row.citations.some((citation) => citation.origin === 'frozen-source' && citation.file.path === ref.path && citationText(citation, inputRoot, archive, study).includes(`id: ${ref.criterionId}`)), `Reference lacks exact source/anchor citation: ${id}`);
    }
    if (row.feedback !== null) boundBytes(inputRoot, row.feedback);
    if (row.missingSearch !== null) boundBytes(inputRoot, row.missingSearch);
    usedProposals.push(...row.proposalIds); usedReferences.push(...row.referenceIds);
  }
  unique(usedProposals, 'proposal disposition'); unique(usedReferences, 'reference disposition');
  requireFact(sameSet(usedProposals, proposalIds), 'Every proposed property/test needs exactly one semantic disposition');
  requireFact(sameSet(usedReferences, eligible), 'Every eligible reference needs exactly one semantic disposition');
  return { eligible, rows: review.rows, pending: [], reviewerId: review.reviewerId, limitations: review.limitations, reason: null };
}
const costSummary = (values) => {
  const known = values.filter((value) => value !== null);
  return { observations: values.length, measured: known.length, unavailable: values.length - known.length,
    total: known.length ? known.reduce((sum, value) => sum + value, 0) : null,
    mean: known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null };
};
function agreement(runs) {
  const pairs = [];
  for (let left = 0; left < runs.length; left++) for (let right = left + 1; right < runs.length; right++) {
    const a = runs[left], b = runs[right];
    if (!sameSet(a.review.eligible, b.review.eligible)) {
      pairs.push({ runs: [a.id, b.id], jaccard: null, reason: 'Reference eligibility differs' });
      continue;
    }
    const union = new Set([...a.discovered, ...b.discovered]);
    const intersection = a.discovered.filter((id) => b.discovered.includes(id));
    pairs.push({ runs: [a.id, b.id], intersection: intersection.length, union: union.size,
      jaccard: union.size ? intersection.length / union.size : null,
      reason: union.size ? null : 'Neither run has an adjudicated shared reference; empty union is not perfect agreement' });
  }
  return pairs;
}

/** Read-only analysis of supplied public-development observations, never a model executor. */
export function analyzeDiscovery({ archive, input }) {
  const frozen = verifyEvidence(archive);
  const studyBytes = bytesAt(archive, 'study.json');
  const study = validateManifest(JSON.parse(studyBytes.toString('utf8')));
  for (const source of study.sourceFiles) boundBytes(path.join(archive, 'sources'), source);
  for (const primitive of study.primitives) boundBytes(path.join(archive, `participant/${primitive.caseId}`), { path: 'prompt.txt', sha256: primitive.prompt.sha256 });
  const inputRoot = path.dirname(path.resolve(input));
  const observationBytes = bytesAt(inputRoot, path.basename(input));
  const observations = validateDiscovery('observations', JSON.parse(observationBytes.toString('utf8')));
  requireFact(observations.studyId === study.id && observations.frozenStudySha256 === sha256(studyBytes), 'Observations are not bound to this frozen study');
  const inventory = boundDocument(inputRoot, observations.runInventory, 'inventory');
  const plan = boundDocument(inputRoot, observations.registeredPlan, 'plan');
  const registeredAt = timestampValue(plan.registeredAt, 'Plan registeredAt');
  unique(inventory.runIds, 'available run inventory');
  unique(observations.runs.map((run) => run.id), 'run identity');
  requireFact(sameSet(inventory.runIds, observations.runs.map((run) => run.id)), 'Supplied runs differ from complete available-run inventory');
  unique(plan.cells.map((cell) => cell.id), 'planned cell');
  unique(plan.cells.map((cell) => [cell.caseId, cell.setupId, cell.condition, cell.repeat].join(':')), 'planned repeat');
  unique(observations.setups.map((setup) => setup.id), 'model setup');
  for (const setup of observations.setups) boundBytes(inputRoot, setup.harness);
  for (const cell of plan.cells) {
    requireFact(study.primitives.some((item) => item.caseId === cell.caseId) && observations.setups.some((item) => item.id === cell.setupId), 'Plan has unknown case/setup');
    requireFact(observations.runs.some((run) => run.cell.id === cell.id), `Planned cell has no retained run/unstarted record: ${cell.id}`);
    requireFact(observations.runs.filter((run) => run.cell.id === cell.id).length === 1, `Planned cell must have exactly one retained attempt record: ${cell.id}`);
  }
  const measured = [];
  for (const run of observations.runs) {
    const primitive = study.primitives.find((item) => item.caseId === run.cell.caseId);
    const setup = observations.setups.find((item) => item.id === run.cell.setupId);
    requireFact(primitive && setup, 'Run has unknown case/setup');
    const planned = plan.cells.find((item) => item.id === run.cell.id);
    if (planned) requireFact(same(planned, run.cell), 'Run differs from its fixed planned cell');
    else requireFact(['deviating', 'excluded'].includes(run.status) && run.reason !== null, 'Unplanned attempts must retain a deviation/exclusion reason');
    if (run.status !== 'completed') requireFact(run.reason !== null, 'Non-completed attempt needs a reason');
    if (run.status === 'deviating') requireFact(run.deviations.length > 0, 'Deviating attempt needs explicit deviations');
    if (run.status === 'unstarted') requireFact(run.startedAt === null && run.finishedAt === null && run.transcript === null && run.submission === null && run.exposure === null && run.review === null && Object.values(run.costs).every((cost) => cost.value === null), 'Unstarted cells cannot claim execution/cost evidence');
    requireFact(run.startedAt !== null || run.finishedAt === null, 'Finish exists without a start');
    const started = run.startedAt === null ? null : timestampValue(run.startedAt, 'Run startedAt');
    const finished = run.finishedAt === null ? null : timestampValue(run.finishedAt, 'Run finishedAt');
    if (started !== null) requireFact(started >= registeredAt, 'Attempt timestamp predates registered plan');
    if (started !== null && finished !== null) requireFact(finished >= started, 'Run clock goes backwards');
    if (run.status === 'completed') requireFact(started !== null && finished !== null && run.transcript !== null && run.submission !== null && run.exposure !== null, 'Completed discovery needs actual times/transcript/submission/exposure');
    if (run.status === 'completed' || run.status === 'deviating') requireFact(run.transcript !== null && run.submission !== null && run.exposure !== null, 'Completed/deviating attempts need actual transcript/submission/exposure records');
    if (run.transcript !== null) boundBytes(inputRoot, run.transcript);
    const submission = run.submission === null ? { proposals: [] } : boundDocument(inputRoot, run.submission, 'submission');
    unique(submission.proposals.map((item) => item.id), 'raw proposal identity');
    for (const proposal of submission.proposals) if (proposal.source !== null) citationText(proposal.source, inputRoot, archive, study);
    const issues = [];
    if (!planned) issues.push('Unplanned attempt');
    if (run.status !== 'completed') issues.push(`Retained ${run.status} attempt`);
    if (run.deviations.length) issues.push(...run.deviations);
    if (observations.runs.filter((item) => item.cell.id === run.cell.id && item.status === 'completed').length > 1) issues.push('Multiple completed attempts for one planned repeat');
    if (run.exposure !== null) {
      const exposure = boundDocument(inputRoot, run.exposure, 'exposure');
      requireFact(exposure.runId === run.id, 'Exposure run identity differs');
      boundBytes(inputRoot, exposure.contextEvidence);
      unique(exposure.delivered.map((file) => file.path), 'delivered file');
      for (const ref of [...exposure.delivered, ...exposure.accessed]) boundBytes(inputRoot, ref);
      if (!exposure.freshContext || exposure.priorOutputAccess) issues.push('Context freshness/prior-output boundary deviated');
      const promptCopies = exposure.delivered.filter((ref) => ref.sha256 === primitive.prompt.sha256);
      requireFact(promptCopies.length === 1, 'Exposure lacks the exact frozen ordinary prompt');
      const allowed = new Set(exposure.delivered.map((ref) => ref.sha256));
      if (run.cell.condition === 'blind' && exposure.delivered.length !== 1) issues.push('Blind packet contains undeclared extra material');
      if (run.cell.condition === 'knowledge-visible' && exposure.delivered.length < 2) issues.push('Knowledge-visible calibration has no additional knowledge material');
      if (exposure.accessed.some((ref) => !allowed.has(ref.sha256))) issues.push('Access outside declared delivered material');
      issues.push(...exposure.leakageObservations);
    }
    if (run.cell.condition === 'knowledge-visible') {
      issues.push('Knowledge-visible calibration is outside blind-discovery estimates');
      const blind = observations.runs.filter((item) => item.cell.caseId === run.cell.caseId && item.cell.condition === 'blind');
      if (started === null || blind.some((item) => item.finishedAt === null || item.startedAt === null || timestampValue(item.finishedAt) > started)) issues.push('Knowledge-visible calibration did not follow every blind attempt');
      if (blind.length === 0) issues.push('Knowledge-visible calibration has no blind comparator');
    }
    const review = reviewRun({ run, proposals: submission.proposals, primitive, observations, inputRoot, archive, study });
    if (review.reason !== null) issues.push(review.reason);
    const counts = Object.fromEntries(discoveryCategories.map((category) => [category, review.rows.filter((row) => row.category === category).length]));
    measured.push({ id: run.id, cell: run.cell, participantId: run.participantId, status: run.status, reason: run.reason,
      usableForBlindDiscovery: issues.length === 0 && run.cell.condition === 'blind', limits: issues,
      elapsedSeconds: started !== null && finished !== null ? (finished - started) / 1000 : null,
      costs: run.costs, proposalCounts: { property: submission.proposals.filter((item) => item.kind === 'property').length, test: submission.proposals.filter((item) => item.kind === 'test').length },
      categories: counts, review,
      discovered: review.rows.filter((row) => ['both', 'semantically-equivalent'].includes(row.category)).flatMap((row) => row.referenceIds),
    });
  }
  // Declared fresh contexts are not independently attested. Reusing an identity still cannot count as independent repetition.
  const participantCounts = new Map();
  for (const run of measured) participantCounts.set(run.participantId, (participantCounts.get(run.participantId) ?? 0) + 1);
  for (const run of measured) if (participantCounts.get(run.participantId) > 1) {
    run.usableForBlindDiscovery = false; run.limits.push('Participant/context identity reused across attempts');
  }
  const groups = [];
  for (const primitive of study.primitives) for (const setup of observations.setups) {
    const all = measured.filter((run) => run.cell.caseId === primitive.caseId && run.cell.setupId === setup.id);
    const usable = all.filter((run) => run.usableForBlindDiscovery);
    const omissions = primitive.references.map((ref) => {
      const applicable = usable.filter((run) => run.review.eligible.includes(ref.id));
      const omitted = applicable.filter((run) => run.review.rows.some((row) => row.category === 'proto-only' && row.referenceIds.includes(ref.id)));
      const unresolved = applicable.filter((run) => run.review.rows.some((row) => row.category === 'ambiguous-disputed' && row.referenceIds.includes(ref.id)));
      const discovered = applicable.filter((run) => run.discovered.includes(ref.id));
      return { referenceId: ref.id, eligibleRuns: applicable.length, discoveredRuns: discovered.length,
        omittedRuns: omitted.length, unresolvedRuns: unresolved.length,
        omissionFrequency: applicable.length ? omitted.length / applicable.length : null,
        discoveredEvidence: discovered.map((run) => ({ runId: run.id, ...run.review.rows.find((row) => row.referenceIds.includes(ref.id)) })),
        consequences: omitted.map((run) => ({ runId: run.id, ...run.review.rows.find((row) => row.referenceIds.includes(ref.id)) })) };
    });
    groups.push({ caseId: primitive.caseId, setupId: setup.id, modelClass: setup.modelClass,
      recordedRuns: all.length, eligibleBlindRuns: usable.length, minimumIndependentRepeats: study.minimumIndependentRepeats,
      repeatTargetMetByDeclarations: usable.length >= study.minimumIndependentRepeats,
      agreement: agreement(usable), omissions });
  }
  if (observations.assessment !== null) {
    requireFact(observations.assessment.reviewerId !== observations.coordinatorId && !observations.runs.some((run) => run.participantId === observations.assessment.reviewerId), 'Summary reviewer must be independent of coordinator/participants');
    for (const citation of observations.assessment.evidence) citationText(citation, inputRoot, archive, study);
    if (!measured.some((run) => run.usableForBlindDiscovery)) requireFact(observations.assessment.classification === 'inconclusive', 'No usable blind runs cannot support/weaken/falsify the hypothesis');
  }
  const eligibleCount = measured.filter((run) => run.usableForBlindDiscovery).length;
  return {
    schemaVersion: 1, studyId: study.id, sourceRevision: study.sourceRevision,
    frozenStudySha256: sha256(studyBytes), frozenInventorySha256: frozen.inventorySha256,
    observationsSha256: sha256(observationBytes), evidenceKind: observations.evidenceKind,
    formalExecution: 'disabled', resultScope: 'Public development, participant/reviewer independence is declared rather than attested; no formal benchmark or product conformance result',
    classification: observations.evidenceKind === 'injected-control' || eligibleCount === 0 ? 'inconclusive' : observations.assessment?.classification ?? 'inconclusive',
    recordedAssessment: observations.assessment,
    collection: inventory, plannedCells: plan.cells.length, availableRuns: measured.length,
    eligibleBlindRuns: eligibleCount, runs: measured, groups,
    costsAllRetainedAttempts: {
      elapsedSeconds: costSummary(measured.map((run) => run.elapsedSeconds)),
      ...Object.fromEntries(['inputTokens', 'outputTokens', 'computeSeconds', 'iterations'].map((key) => [key, costSummary(measured.map((run) => run.costs[key].value))])),
    },
    modelLadderCoverage: study.primitives.map((primitive) => ({ caseId: primitive.caseId,
      classesWithDeclaredEligibleBlindRuns: [...new Set(groups.filter((group) => group.caseId === primitive.caseId && group.eligibleBlindRuns > 0).map((group) => group.modelClass))],
      missingClasses: ['frontier', 'mainstream', 'lower-cost-fast'].filter((modelClass) => !groups.some((group) => group.caseId === primitive.caseId && group.modelClass === modelClass && group.eligibleBlindRuns > 0)) })),
    uniqueFeedback: measured.flatMap((run) => run.review.rows.filter((row) => ['agent-only-valid', 'missing-from-proto'].includes(row.category)).map((row) => ({ runId: run.id, usableForBlindDiscovery: run.usableForBlindDiscovery, ...row }))),
    limitations: [...study.limitations, ...observations.limitations, inventory.completenessLimit,
      'Hashes and recorded inventory do not independently establish that all real attempts were supplied.',
      'Citation/partition validation cannot determine semantic truth, reviewer independence, leakage completeness or exhaustive extraction from natural-language transcripts.',
      'Reference coverage agreement uses adjudicated criterion identities only; semantic equivalence of novel claims across repeats is not inferred.',
      'Public development cases cannot become held-out or strict blind evaluation. No component, browser, assistive-technology or business-workflow behavior was executed by this analysis.'],
    dimensions: discoveryDimensions,
  };
}

export function summarizeDiscovery({ archive, input, out }) {
  const report = analyzeDiscovery({ archive, input });
  newDirectory(out);
  writeNew(out, 'report.json', json(report));
  return { ...report, reportPath: path.join(out, 'report.json') };
}
function argumentsFor(argv) {
  const [command, ...args] = argv;
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    requireFact(['--root', '--manifest', '--out', '--archive', '--input'].includes(args[index]) && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('--'), 'Expected documented option/value pairs');
    const key = args[index].slice(2); requireFact(!Object.hasOwn(options, key), `Duplicate option ${key}`); options[key] = args[index + 1];
  }
  return { command, options };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { command, options } = argumentsFor(process.argv.slice(2));
    if (command === 'schemas') {
      requireFact(Object.keys(options).length === 0, 'schemas accepts no options');
      console.log(json(discoverySchemas));
    } else if (command === 'freeze') {
      requireFact(options.out && !options.archive && !options.input, 'freeze requires --out and accepts --root/--manifest only');
      console.log(json(freezeDiscovery({ root: options.root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out: options.out, manifest: options.manifest })));
    } else if (command === 'summarize') {
      requireFact(options.archive && options.input && options.out && !options.root && !options.manifest, 'summarize requires --archive --input --out');
      const result = summarizeDiscovery(options);
      console.log(json({ reportPath: result.reportPath, availableRuns: result.availableRuns, eligibleBlindRuns: result.eligibleBlindRuns, classification: result.classification, formalExecution: result.formalExecution }));
    } else throw new Error('Usage: discovery-study.mjs schemas | freeze --out NEW [--root REPO] [--manifest RELATIVE] | summarize --archive FROZEN --input OBSERVATIONS_JSON --out NEW');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
