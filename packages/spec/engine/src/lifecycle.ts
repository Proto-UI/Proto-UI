import {
  SPEC_RELATION_TARGET_TYPES,
  compareSpecVersions,
  isSpecEntityActiveAt,
  isSpecEntityAvailableAt,
  parseSpecBlockTarget,
  specLifecyclePlanSchema,
  specVersionSchema,
  type SpecEntity,
  type SpecLifecyclePlan,
  type SpecRelations,
} from '@proto.ui/spec-schema';
import { filterRelationsForVersion, type SpecWorkspace } from './index';

type SpecLocalizedText = NonNullable<SpecEntity['lifecycleRationale']>;

export type SpecLifecycleBlock = {
  sourceEntityId: string;
  questionId: string;
  target: string;
};

export type SpecLifecycleEvidence = {
  testId: string;
  implementationId: string;
  status: string;
  required: boolean;
  path?: string;
};

export type SpecLifecycleIssue = {
  code: string;
  entityId?: string;
  sliceId?: string;
  message: string;
};

export type SpecLifecycleRow = {
  entityId: string;
  type: SpecEntity['type'];
  status: SpecEntity['status'];
  draftAtVersion: boolean;
  rationale?: SpecLocalizedText;
  activeSince?: string;
  activationProvenanceMissing: boolean;
  stableAtVersion: boolean | null;
  activationBlockers: SpecLifecycleBlock[];
  targetedBlocks: SpecLifecycleBlock[];
  unclassifiedBlocks: SpecLifecycleBlock[];
  evidence: SpecLifecycleEvidence[];
  gaps: SpecLifecycleIssue[];
  disposition?: SpecLifecyclePlan['slices'][number];
};

export type SpecLifecycleReport = {
  schemaVersion: 1;
  basis: 'current-catalog';
  currentCatalogDigest?: string;
  version: string;
  scope: 'available-ordinary-entities';
  rows: SpecLifecycleRow[];
  dispositionSlices: SpecLifecyclePlan['slices'];
  issues: SpecLifecycleIssue[];
  unreviewedEntities: string[];
  summary: {
    entities: number;
    drafts: number;
    reviewedDrafts: number;
    legacyActive: number;
    unclassifiedBlocks: number;
  };
};

function relationIds(relations: SpecRelations, version: string): string[] {
  return Object.values(filterRelationsForVersion(relations, version) ?? {}).flatMap(
    (targets) => targets?.map((target) => target.id) ?? []
  );
}

function hasText(text: SpecLocalizedText | undefined): boolean {
  return (
    text !== undefined &&
    (typeof text === 'string' ? [text] : Object.values(text)).some((value) =>
      Boolean(value?.trim())
    )
  );
}

function rationaleContent(text: SpecLocalizedText | undefined): string {
  if (typeof text === 'string') return JSON.stringify([text.trim(), text.trim()]);
  const en = text?.en?.trim() ?? '';
  const zh = text?.['zh-CN']?.trim() ?? '';
  return JSON.stringify([en || zh, zh || en]);
}

function isRecordedPassing(implementation: SpecEntity['implementations'][number]): boolean {
  return implementation.status === 'passing' && hasText(implementation.path);
}

/** Records catalog facts and authored dispositions; it never changes entity lifecycle. */
export function getSpecLifecycleReport(
  workspace: SpecWorkspace,
  version: string,
  planInput?: unknown
): SpecLifecycleReport {
  specVersionSchema.parse(version);
  const entities = workspace.entities
    .filter((entity) => entity.type !== 'version' && isSpecEntityAvailableAt(entity, version))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const hasPrototypeContract = (prototype: SpecEntity, visited = new Set<string>()): boolean => {
    if (visited.has(prototype.id)) return false;
    visited.add(prototype.id);
    const dependencies = [prototype.dependsOn, ...prototype.criteria.map((item) => item.dependsOn)];
    if (
      [...dependencies, prototype.satisfies].some((relations) =>
        filterRelationsForVersion(relations, version)?.contracts?.some((target) =>
          entities.some((candidate) => candidate.id === target.id && candidate.type === 'contract')
        )
      )
    )
      return true;
    return [...dependencies, prototype.inherits].some((relations) =>
      filterRelationsForVersion(relations, version)?.prototypes?.some((target) => {
        const parent = entities.find(
          (candidate) => candidate.id === target.id && candidate.type === 'prototype'
        );
        return parent !== undefined && hasPrototypeContract(parent, visited);
      })
    );
  };
  const tests = entities.filter((entity) => entity.type === 'test');
  const plan = planInput === undefined ? undefined : specLifecyclePlanSchema.parse(planInput);
  const issues: SpecLifecycleIssue[] = [];
  if (plan && plan.version !== version) {
    issues.push({
      code: 'plan-version-mismatch',
      message: `Disposition version ${plan.version} does not match ${version}.`,
    });
  }
  const dispositions = new Map<string, SpecLifecyclePlan['slices'][number]>();
  const conflictedEntities = new Set<string>();
  const sliceIds = new Set<string>();
  const duplicateSliceIds = new Set<string>();
  for (const slice of plan?.slices ?? []) {
    if (sliceIds.has(slice.id)) {
      duplicateSliceIds.add(slice.id);
      issues.push({
        code: 'duplicate-slice',
        sliceId: slice.id,
        message: `Duplicate slice ${slice.id}.`,
      });
    }
    sliceIds.add(slice.id);
    for (const id of slice.entities) {
      if (!entities.some((entity) => entity.id === id)) {
        issues.push({
          code: 'unknown-disposition-entity',
          entityId: id,
          sliceId: slice.id,
          message: `${id} is not an ordinary entity available at ${version}.`,
        });
      }
      if (dispositions.has(id)) {
        conflictedEntities.add(id);
        issues.push({
          code: 'duplicate-disposition',
          entityId: id,
          sliceId: slice.id,
          message: `${id} occurs in more than one disposition entry.`,
        });
      }
      dispositions.set(id, slice);
    }
  }
  for (const [id, slice] of dispositions) {
    if (conflictedEntities.has(id) || duplicateSliceIds.has(slice.id)) dispositions.delete(id);
  }
  const blocks = entities.flatMap((entity) =>
    entity.openQuestions.flatMap((question) =>
      question.blocks.map((target) => ({
        sourceEntityId: entity.id,
        questionId: question.id,
        target,
        parsed: parseSpecBlockTarget(target),
      }))
    )
  );
  const rows = entities.map((entity): SpecLifecycleRow => {
    const draftAtVersion =
      entity.status === 'draft' ||
      (entity.activeSince !== undefined && compareSpecVersions(version, entity.activeSince) < 0);
    const verifyingTests = tests.filter(
      (test) =>
        test.id === entity.id ||
        relationIds(test.verifies, version).includes(entity.id) ||
        relationIds(entity.verifies, version).includes(test.id)
    );
    const evidenceTests = tests.filter(
      (test) =>
        verifyingTests.includes(test) ||
        relationIds(test.exercises, version).includes(entity.id) ||
        test.implementations.some((implementation) => implementation.exercises.includes(entity.id))
    );
    const evidence = evidenceTests
      .flatMap((test) =>
        test.implementations
          .filter(
            (implementation) =>
              test.id === entity.id ||
              implementation.exercises.includes(entity.id) ||
              test.cases.some(
                (testCase) =>
                  implementation.consumesCases.includes(testCase.id) &&
                  entity.criteria.some((criterion) => testCase.covers.includes(criterion.id))
              )
          )
          .map((implementation) => ({
            testId: test.id,
            implementationId: implementation.id,
            status: implementation.status,
            required: implementation.required,
            ...(implementation.path ? { path: implementation.path } : {}),
          }))
      )
      .sort((a, b) =>
        `${a.testId}/${a.implementationId}`.localeCompare(`${b.testId}/${b.implementationId}`)
      );
    const cleanBlock = ({
      sourceEntityId,
      questionId,
      target,
    }: SpecLifecycleBlock): SpecLifecycleBlock => ({ sourceEntityId, questionId, target });
    const activationBlockers = blocks
      .filter((block) => block.parsed?.kind === 'activation' && block.parsed.entityId === entity.id)
      .map(cleanBlock);
    const targetedBlocks = blocks
      .filter(
        (block) =>
          block.parsed && block.parsed.kind !== 'activation' && block.parsed.entityId === entity.id
      )
      .map(cleanBlock);
    const unclassifiedBlocks = blocks
      .filter((block) => !block.parsed && block.sourceEntityId === entity.id)
      .map(cleanBlock);
    const gaps: SpecLifecycleIssue[] = [];
    const gap = (code: string, message: string) =>
      gaps.push({ code, entityId: entity.id, message });
    if (!hasText(entity.lifecycleRationale))
      gap('missing-lifecycle-rationale', 'Lifecycle rationale is not recorded.');
    const activationProvenanceMissing = entity.status !== 'draft' && !entity.activeSince;
    const pastDeprecation =
      entity.deprecatedSince !== undefined &&
      compareSpecVersions(version, entity.deprecatedSince) >= 0;
    if (activationProvenanceMissing)
      gap(
        'legacy-activation-provenance',
        'Lifecycle history has no recorded activation version; do not infer activeSince from since.'
      );
    if (activationBlockers.length)
      gap('activation-blocked', 'An open question explicitly blocks activation.');
    if (unclassifiedBlocks.length)
      gap(
        'unclassified-block',
        'Legacy block text has no canonical target; its activation impact is unknown.'
      );
    if (entity.type === 'test') {
      if (!entity.cases.length) gap('missing-cases', 'No conformance cases are recorded.');
      if (!entity.implementations.length)
        gap('missing-evidence', 'No executable implementation is recorded.');
      const governedTargets = [
        ...relationIds(entity.verifies, version),
        ...relationIds(entity.exercises, version),
        ...entities
          .filter((target) => relationIds(target.verifies, version).includes(entity.id))
          .map((target) => target.id),
      ];
      for (const testCase of entity.cases) {
        const targets = new Set([
          ...governedTargets,
          ...entity.implementations
            .filter((implementation) => implementation.consumesCases.includes(testCase.id))
            .flatMap((implementation) => implementation.exercises),
        ]);
        const criteria = new Set(
          entities
            .filter((target) => targets.has(target.id))
            .flatMap((target) => target.criteria.map((criterion) => criterion.id))
        );
        if (!testCase.covers.length)
          gap('case-needs-criteria', `${testCase.id} has no criterion mapping.`);
        for (const criterion of testCase.covers) {
          if (!criteria.has(criterion))
            gap(
              'case-invalid-criterion',
              `${testCase.id} covers ${criterion}, which is not a criterion on an available governed target.`
            );
        }
        if (
          !entity.implementations.some(
            (implementation) =>
              isRecordedPassing(implementation) &&
              implementation.consumesCases.includes(testCase.id)
          )
        ) {
          gap('case-needs-evidence', `${testCase.id} has no implementation declared passing.`);
        }
      }
    } else {
      if (entity.type === 'prototype' && !entity.anatomy)
        gap('missing-anatomy', 'No governed Prototype anatomy is recorded.');
      if (entity.type === 'prototype' && !hasPrototypeContract(entity))
        gap(
          'missing-contract-evidence',
          'No applicable semantic relation traces an available Contract.'
        );
      if (
        entity.type === 'adapter' &&
        ![entity.supports, entity.omits].some((relations) =>
          filterRelationsForVersion(relations, version)?.modules?.some((target) =>
            entities.some((candidate) => candidate.id === target.id && candidate.type === 'module')
          )
        )
      )
        gap('missing-module-scope', 'No applicable support or omission names an available Module.');
      if (
        entity.type === 'adapter' &&
        !filterRelationsForVersion(entity.provides, version)?.hostCaps?.some((target) =>
          entities.some((candidate) => candidate.id === target.id && candidate.type === 'host-cap')
        )
      )
        gap(
          'missing-provided-capability',
          'No applicable provision names an available Host Capability.'
        );
      if (entity.type === 'module') {
        const ownership = filterRelationsForVersion(entity.owns, version);
        if (
          !Object.entries(ownership ?? {}).some(([kind, targets]) =>
            targets?.some((target) =>
              entities.some(
                (candidate) =>
                  candidate.id === target.id &&
                  candidate.type ===
                    SPEC_RELATION_TARGET_TYPES[kind as keyof NonNullable<SpecRelations>]
              )
            )
          )
        )
          gap('missing-ownership', 'No explicit ownership relation names an available target.');
        if (
          !filterRelationsForVersion(entity.satisfies, version)?.contracts?.some((target) =>
            entities.some(
              (candidate) => candidate.id === target.id && candidate.type === 'contract'
            )
          )
        )
          gap(
            'missing-contract-satisfaction',
            'No applicable satisfaction declaration names an available Contract.'
          );
        if (
          !entities.some(
            (adapter) =>
              adapter.type === 'adapter' &&
              filterRelationsForVersion(adapter.supports, version)?.modules?.some(
                (target) => target.id === entity.id
              )
          )
        )
          gap('missing-adapter-support', 'No available Adapter declares support for this Module.');
      }
      if (
        entity.type === 'host-cap' &&
        !entities.some(
          (provider) =>
            provider.type === 'adapter' &&
            filterRelationsForVersion(provider.provides, version)?.hostCaps?.some(
              (target) => target.id === entity.id
            )
        )
      )
        gap('missing-provider', 'No available Adapter declares this Host Capability as provided.');
      if (!hasText(entity.statement))
        gap('missing-statement', 'No reviewable statement is recorded.');
      if (!entity.criteria.length) gap('missing-criteria', 'No admission criteria are recorded.');
      if (!['decision', 'knowledge'].includes(entity.type)) {
        for (const criterion of entity.criteria) {
          if (
            !verifyingTests.some((test) =>
              test.cases.some(
                (testCase) =>
                  testCase.covers.includes(criterion.id) &&
                  test.implementations.some(
                    (implementation) =>
                      isRecordedPassing(implementation) &&
                      implementation.consumesCases.includes(testCase.id)
                  )
              )
            )
          ) {
            gap(
              'criterion-needs-evidence',
              `${criterion.id} has no mapped implementation declared passing.`
            );
          }
        }
      }
    }
    for (const implementation of evidence.filter(
      (item) => item.status === 'passing' && !hasText(item.path)
    )) {
      gap(
        'evidence-needs-path',
        `${implementation.testId}#${implementation.implementationId} has no executable path.`
      );
    }
    for (const implementation of evidence.filter(
      (item) => item.required && item.status !== 'passing'
    )) {
      gap(
        'required-evidence-incomplete',
        `${implementation.testId}#${implementation.implementationId} is ${implementation.status}.`
      );
    }
    const disposition = plan?.version === version ? dispositions.get(entity.id) : undefined;
    if (disposition?.disposition === 'remain-draft' && !draftAtVersion) {
      issues.push({
        code: 'disposition-status-mismatch',
        entityId: entity.id,
        sliceId: disposition.id,
        message: 'remain-draft applies only to a known draft at the selected version.',
      });
    }
    if (disposition?.disposition === 'promote') {
      if (!draftAtVersion)
        issues.push({
          code: 'disposition-status-mismatch',
          entityId: entity.id,
          sliceId: disposition.id,
          message:
            'promote is a review proposal for a known draft at the selected version, not a lifecycle mutation.',
        });
      if (gaps.length)
        issues.push({
          code: 'promotion-evidence-incomplete',
          entityId: entity.id,
          sliceId: disposition.id,
          message: 'Promotion proposal retains unresolved catalog gaps.',
        });
    }
    return {
      entityId: entity.id,
      type: entity.type,
      status: entity.status,
      draftAtVersion,
      ...(entity.lifecycleRationale ? { rationale: entity.lifecycleRationale } : {}),
      ...(entity.activeSince ? { activeSince: entity.activeSince } : {}),
      activationProvenanceMissing,
      stableAtVersion:
        activationProvenanceMissing && !pastDeprecation
          ? null
          : isSpecEntityActiveAt(entity, version),
      activationBlockers,
      targetedBlocks,
      unclassifiedBlocks,
      evidence,
      gaps,
      ...(disposition ? { disposition } : {}),
    };
  });
  return {
    schemaVersion: 1,
    basis: 'current-catalog',
    version,
    scope: 'available-ordinary-entities',
    rows,
    dispositionSlices: plan?.version === version ? plan.slices : [],
    issues,
    unreviewedEntities: rows
      .filter((row) => row.draftAtVersion && !row.disposition)
      .map((row) => row.entityId),
    summary: {
      entities: rows.length,
      drafts: rows.filter((row) => row.draftAtVersion).length,
      reviewedDrafts: rows.filter((row) => row.draftAtVersion && row.disposition).length,
      legacyActive: rows.filter((row) => row.activationProvenanceMissing).length,
      unclassifiedBlocks: rows.reduce((sum, row) => sum + row.unclassifiedBlocks.length, 0),
    },
  };
}

export function checkSpecActiveTestMappings(report: SpecLifecycleReport): SpecLifecycleIssue[] {
  return report.rows.flatMap((row) =>
    row.type === 'test' && !row.draftAtVersion && row.stableAtVersion !== false
      ? row.gaps.filter((gap) =>
          ['missing-cases', 'case-needs-criteria', 'case-invalid-criterion'].includes(gap.code)
        )
      : []
  );
}

/** Completeness of dispositions in an explicit scope is separate from semantic approval. */
export function checkSpecLifecycleDispositions(
  report: SpecLifecycleReport,
  entityIds?: readonly string[]
): SpecLifecycleIssue[] {
  const selected = new Set(entityIds ?? report.rows.map((row) => row.entityId));
  const dispositions = report.dispositionSlices.filter((slice) =>
    slice.entities.some((id) => selected.has(id))
  );
  const selectedSlices = new Set(dispositions.map((slice) => slice.id));
  const selectedSliceEntities = new Set(dispositions.flatMap((slice) => slice.entities));
  const issues = report.issues.filter(
    (issue) =>
      !entityIds ||
      (!issue.entityId && !issue.sliceId) ||
      (issue.entityId !== undefined &&
        (selected.has(issue.entityId) || selectedSliceEntities.has(issue.entityId))) ||
      (issue.sliceId !== undefined && selectedSlices.has(issue.sliceId))
  );
  for (const id of [...selected].sort()) {
    const row = report.rows.find((candidate) => candidate.entityId === id);
    if (!row)
      issues.push({
        code: 'unknown-scope-entity',
        entityId: id,
        message: `${id} is outside the report scope.`,
      });
    else if (row.draftAtVersion && !row.disposition)
      issues.push({
        code: 'missing-disposition',
        entityId: id,
        message: 'Draft entity has no authored release disposition.',
      });
  }
  return issues;
}

export function checkSpecLifecycleAuthoring(
  before: SpecEntity | undefined,
  after: SpecEntity | undefined,
  workspace?: SpecWorkspace,
  currentVersion?: string
): string[] {
  if (!after)
    return before && before.type !== 'version'
      ? [`${before.id}: retain the entity and record removal through its lifecycle history.`]
      : [];
  if (after.type === 'version') return [];
  const isNewIdentity = !before || before.id !== after.id;
  const isPromotion = !isNewIdentity && before?.status !== 'active' && after.status === 'active';
  const issues: string[] = [];
  for (const question of after.openQuestions) {
    const previousQuestion = !isNewIdentity
      ? before?.openQuestions.find((item) => item.id === question.id)
      : undefined;
    for (const block of question.blocks) {
      if (parseSpecBlockTarget(block) === null && !previousQuestion?.blocks.includes(block))
        issues.push(
          `${question.id}: new or edited unclassified blocker ${JSON.stringify(block)} requires a canonical target.`
        );
    }
  }
  if (!isNewIdentity && before?.status === 'removed' && after.status !== 'removed')
    return [
      ...issues,
      `${after.id}: removed is terminal and cannot transition to ${after.status}.`,
    ];
  const changed =
    isNewIdentity ||
    ['status', 'since', 'activeSince', 'deprecatedSince', 'removedSince'].some(
      (key) => before?.[key as keyof SpecEntity] !== after[key as keyof SpecEntity]
    );
  if (!changed) {
    if (hasText(before?.lifecycleRationale) && !hasText(after.lifecycleRationale))
      issues.push(`${after.id}: authoring must retain recorded lifecycleRationale.`);
    return issues;
  }
  if (!isNewIdentity && before?.activeSince && !after.activeSince)
    issues.push(`${after.id}: lifecycle changes must retain recorded activeSince.`);
  if (!hasText(after.lifecycleRationale))
    issues.push(`${after.id}: new or lifecycle-changing authoring requires lifecycleRationale.`);
  else if (
    !isNewIdentity &&
    before &&
    rationaleContent(before.lifecycleRationale) === rationaleContent(after.lifecycleRationale)
  )
    issues.push(`${after.id}: changed lifecycle requires updated lifecycleRationale.`);
  if (after.status === 'active' && (isNewIdentity || isPromotion) && !after.activeSince)
    issues.push(
      `${after.id}: newly admitted active status requires activation provenance in activeSince.`
    );
  if (before && !isNewIdentity) {
    const revisionKey = (revision: SpecEntity['revisions'][number]) =>
      JSON.stringify([revision.version, revision.change, revision.summary, revision.breaking]);
    const previousRevisions = before.revisions.map(revisionKey);
    const currentRevisions = after.revisions.map(revisionKey);
    const historyPreserved = previousRevisions.every(
      (revision, index) => currentRevisions[index] === revision
    );
    if (!historyPreserved)
      issues.push(`${after.id}: lifecycle changes must preserve prior revisions.`);
    if (
      isPromotion &&
      (!historyPreserved ||
        !after.revisions
          .slice(before.revisions.length)
          .some(
            (revision) =>
              revision.version === after.activeSince &&
              hasText(revision.summary) &&
              !previousRevisions.includes(revisionKey(revision))
          ))
    )
      issues.push(
        `${after.id}: promotion must preserve prior revisions and append a new admission revision with a summary at activeSince.`
      );
  }
  const activationChanged = isNewIdentity || before?.activeSince !== after.activeSince;
  if (after.activeSince && (isPromotion || activationChanged)) {
    if (!workspace)
      issues.push(
        `${after.id}: active admission requires the current workspace for evidence checks.`
      );
    else if (!currentVersion)
      issues.push(`${after.id}: active admission requires the current release train.`);
    else if (
      compareSpecVersions(after.activeSince, specVersionSchema.parse(currentVersion)) < 0 ||
      (!isNewIdentity &&
        activationChanged &&
        before?.activeSince !== undefined &&
        compareSpecVersions(before.activeSince, currentVersion) < 0)
    )
      issues.push(
        `${after.id}: historical activation requires a separately reviewed provenance mechanism; current-catalog evidence cannot add or revise activation history before ${currentVersion}.`
      );
    else {
      const report = getSpecLifecycleReport(
        { entities: [...workspace.entities.filter((entity) => entity.id !== after.id), after] },
        after.activeSince
      );
      const row = report.rows.find((candidate) => candidate.entityId === after.id);
      if (!row)
        issues.push(`${after.id}: active admission is outside its activation version scope.`);
      else
        issues.push(...row.gaps.map((gap) => `${after.id}: admission ${gap.code}: ${gap.message}`));
    }
  }
  return issues;
}
