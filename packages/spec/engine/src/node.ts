import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from 'yaml';

import {
  SPEC_RELATION_KINDS,
  SPEC_RELATION_TARGET_TYPES as RELATION_TARGET_TYPES,
  compareSpecVersions,
  validateSpecEntity,
  parseSpecBlockTarget,
  specLifecyclePlanSchema,
  specVersionSchema,
  type SpecEntity,
  type SpecRelationKind,
  type SpecRelations,
  type SpecLifecyclePlan,
  type SpecValidationIssue,
} from '@proto.ui/spec-schema';

import { createSpecWorkspace, getSpecSnapshot, type SpecWorkspace } from './index';
import { getSpecLifecycleReport, type SpecLifecycleReport } from './lifecycle';

export type LoadedSpecEntity = {
  filePath: string;
  entity: SpecEntity;
};

export type LoadedSpecWorkspace = SpecWorkspace & {
  files: LoadedSpecEntity[];
  issues: SpecValidationIssue[];
};

export async function loadSpecLifecyclePlan(
  repoRoot: string,
  version: string
): Promise<SpecLifecyclePlan | undefined> {
  specVersionSchema.parse(version);
  const planPath = path.join(repoRoot, 'internal/releases', version, 'lifecycle-dispositions.json');
  let plan;
  try {
    plan = specLifecyclePlanSchema.parse(JSON.parse(await readFile(planPath, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const root = await realpath(repoRoot);
  for (const slice of plan?.slices ?? []) {
    for (const evidence of slice.evidence) {
      if (/^https?:\/\//.test(evidence)) continue;
      const target = path.resolve(root, evidence);
      if (path.isAbsolute(evidence) || path.relative(root, target).startsWith('..')) {
        throw new Error(
          `${slice.id}: lifecycle evidence must stay inside the repository: ${evidence}`
        );
      }
      const resolved = await realpath(target);
      if (path.relative(root, resolved).startsWith('..') || !(await stat(resolved)).isFile()) {
        throw new Error(
          `${slice.id}: lifecycle evidence must resolve to a repository file: ${evidence}`
        );
      }
    }
  }
  return plan;
}

export async function loadSpecLifecycleReport(
  repoRoot: string,
  version: string,
  workspace: SpecWorkspace
): Promise<SpecLifecycleReport> {
  const plan = await loadSpecLifecyclePlan(repoRoot, version);
  const report = getSpecLifecycleReport(workspace, version, plan);
  const snapshot = getSpecSnapshot(workspace, version);
  return {
    ...report,
    currentCatalogDigest: `sha256:${createHash('sha256')
      .update(JSON.stringify({ version, entities: snapshot.entities }))
      .digest('hex')}`,
  };
}

export async function loadSpecWorkspaceFromDirectory(
  specDir: string
): Promise<LoadedSpecWorkspace> {
  const files = await findSpecFiles(specDir);
  const loaded: LoadedSpecEntity[] = [];
  const issues: SpecValidationIssue[] = [];

  for (const filePath of files) {
    try {
      const source = await readFile(filePath, 'utf8');
      const input = parse(source);
      const entity = validateSpecEntity(input);
      loaded.push({ filePath, entity });
    } catch (error) {
      issues.push({
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const uniqueLoaded = collectUniqueLoadedEntities(loaded, issues);
  validateEntityTimelines(uniqueLoaded, issues);
  validateWorkspaceRelations(uniqueLoaded, issues);
  const workspace = createSpecWorkspace(uniqueLoaded.map((entry) => entry.entity));
  await validateNoteReferences(specDir, uniqueLoaded, issues);
  await validatePassingImplementationReferences(specDir, uniqueLoaded, issues);

  return {
    ...workspace,
    files: loaded,
    issues,
  };
}

async function findSpecFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findSpecFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function collectUniqueLoadedEntities(
  loaded: LoadedSpecEntity[],
  issues: SpecValidationIssue[]
): LoadedSpecEntity[] {
  const firstById = new Map<string, LoadedSpecEntity>();

  for (const entry of loaded) {
    const previous = firstById.get(entry.entity.id);

    if (previous) {
      issues.push({
        filePath: entry.filePath,
        message: `Duplicate spec entity ID ${entry.entity.id}; first declared in ${previous.filePath}.`,
      });
      continue;
    }

    firstById.set(entry.entity.id, entry);
  }

  return [...firstById.values()];
}

function validateEntityTimelines(loaded: LoadedSpecEntity[], issues: SpecValidationIssue[]): void {
  for (const entry of loaded) {
    const { entity } = entry;

    if (entity.deprecatedSince && compareSpecVersions(entity.deprecatedSince, entity.since) < 0) {
      issues.push({
        filePath: entry.filePath,
        message: `${entity.id} deprecatedSince must not be earlier than since.`,
      });
    }

    if (entity.removedSince && compareSpecVersions(entity.removedSince, entity.since) < 0) {
      issues.push({
        filePath: entry.filePath,
        message: `${entity.id} removedSince must not be earlier than since.`,
      });
    }

    if (
      entity.activeSince &&
      entity.deprecatedSince &&
      compareSpecVersions(entity.activeSince, entity.deprecatedSince) >= 0
    ) {
      issues.push({
        filePath: entry.filePath,
        message: `${entity.id} activeSince must precede deprecatedSince.`,
      });
    }

    if (
      entity.activeSince &&
      entity.removedSince &&
      compareSpecVersions(entity.activeSince, entity.removedSince) >= 0
    ) {
      issues.push({
        filePath: entry.filePath,
        message: `${entity.id} activeSince must precede removedSince.`,
      });
    }

    if (
      entity.deprecatedSince &&
      entity.removedSince &&
      compareSpecVersions(entity.removedSince, entity.deprecatedSince) < 0
    ) {
      issues.push({
        filePath: entry.filePath,
        message: `${entity.id} removedSince must not be earlier than deprecatedSince.`,
      });
    }

    for (const revision of entity.revisions) {
      if (compareSpecVersions(revision.version, entity.since) < 0) {
        issues.push({
          filePath: entry.filePath,
          message: `${entity.id} revision ${revision.version} must not be earlier than since ${entity.since}.`,
        });
      }
    }
  }
}

function validateWorkspaceRelations(
  loaded: LoadedSpecEntity[],
  issues: SpecValidationIssue[]
): void {
  const byId = new Map(loaded.map((entry) => [entry.entity.id, entry]));

  for (const entry of loaded) {
    validateReplacement(entry, byId, issues);
    for (const question of entry.entity.openQuestions) {
      for (const value of question.blocks) {
        const block = parseSpecBlockTarget(value);
        if (!block) continue;
        const target = byId.get(block.entityId)?.entity;
        let problem: string | undefined;
        if (!target) problem = `Unknown block target entity ${block.entityId}`;
        else if (target.type === 'version')
          problem = 'Version entities retain their publication-evidence lifecycle';
        else if (block.kind === 'activation' && target.status === 'active')
          problem = `Active entity ${target.id} retains an activation-blocking question`;
        else if (
          block.kind === 'criterion' &&
          !target.criteria.some((criterion) => criterion.id === block.targetId)
        )
          problem = `Unknown criterion ${block.targetId} on ${target.id}`;
        else if (
          block.kind === 'implementation' &&
          (target.type !== 'test' ||
            !target.implementations.some((implementation) => implementation.id === block.targetId))
        )
          problem = `Unknown test implementation ${block.targetId} on ${target.id}`;
        if (problem)
          issues.push({
            filePath: entry.filePath,
            message: `${question.id}: ${problem} (${value}).`,
          });
      }
    }

    for (const relationKind of SPEC_RELATION_KINDS) {
      validateRelationGroup(entry, byId, issues, relationKind, entry.entity[relationKind]);
    }

    for (const implementation of entry.entity.implementations) {
      for (const targetId of implementation.exercises) {
        const target = byId.get(targetId)?.entity;
        if (!target) {
          issues.push({
            filePath: entry.filePath,
            message: `${entry.entity.id} implementation ${implementation.id} exercises target does not exist: ${targetId}.`,
          });
        } else if (target.type === 'version') {
          issues.push({
            filePath: entry.filePath,
            message: `${entry.entity.id} implementation ${implementation.id} exercises target ${targetId} is version, expected ordinary entity.`,
          });
        }
      }
    }

    for (const criterion of entry.entity.criteria) {
      validateRelationGroup(entry, byId, issues, 'dependsOn', criterion.dependsOn, criterion.id, {
        validateAnchorsAsCriteria: true,
      });
      validateRelationGroup(entry, byId, issues, 'references', criterion.references, criterion.id, {
        validateAnchorsAsCriteria: true,
      });
    }
  }
}

function validateReplacement(
  entry: LoadedSpecEntity,
  byId: Map<string, LoadedSpecEntity>,
  issues: SpecValidationIssue[]
): void {
  const replacementId = entry.entity.replacedBy;
  if (!replacementId) return;

  const replacement = byId.get(replacementId);

  if (!replacement) {
    issues.push({
      filePath: entry.filePath,
      message: `${entry.entity.id} replacedBy target does not exist: ${replacementId}.`,
    });
    return;
  }

  if (replacement.entity.type !== entry.entity.type) {
    issues.push({
      filePath: entry.filePath,
      message: `${entry.entity.id} replacedBy target ${replacementId} is ${replacement.entity.type}, expected ${entry.entity.type}.`,
    });
  }
}

function validateRelationGroup(
  entry: LoadedSpecEntity,
  byId: Map<string, LoadedSpecEntity>,
  issues: SpecValidationIssue[],
  groupName: SpecRelationKind,
  relations: SpecRelations,
  sourceId = entry.entity.id,
  options: { validateAnchorsAsCriteria?: boolean } = {}
): void {
  if (!relations) return;

  for (const [relationKey, targets] of Object.entries(relations)) {
    const expectedType = RELATION_TARGET_TYPES[relationKey as keyof typeof RELATION_TARGET_TYPES];

    for (const target of targets ?? []) {
      if (target.since && target.until && compareSpecVersions(target.until, target.since) <= 0) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} relation to ${target.id} has until <= since.`,
        });
      }

      const targetEntry = byId.get(target.id);

      if (!targetEntry) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} target does not exist: ${target.id}.`,
        });
        continue;
      }

      if (targetEntry.entity.type !== expectedType) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} target ${target.id} is ${targetEntry.entity.type}, expected ${expectedType}.`,
        });
      }

      if (options.validateAnchorsAsCriteria) {
        validateCriterionAnchors(
          entry,
          issues,
          groupName,
          relationKey,
          sourceId,
          targetEntry,
          target
        );
      }

      const relationSince = target.since ?? entry.entity.since;

      if (compareSpecVersions(relationSince, entry.entity.since) < 0) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} relation to ${target.id} starts before the source entity exists.`,
        });
      }

      if (compareSpecVersions(relationSince, targetEntry.entity.since) < 0) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} relation to ${target.id} starts before the target entity exists.`,
        });
      }

      if (
        targetEntry.entity.removedSince &&
        (!target.until || compareSpecVersions(target.until, targetEntry.entity.removedSince) > 0)
      ) {
        issues.push({
          filePath: entry.filePath,
          message: `${sourceId} ${groupName}.${relationKey} relation to ${target.id} extends beyond the target removal version.`,
        });
      }
    }
  }
}

function validateCriterionAnchors(
  entry: LoadedSpecEntity,
  issues: SpecValidationIssue[],
  groupName: SpecRelationKind,
  relationKey: string,
  sourceId: string,
  targetEntry: LoadedSpecEntity,
  target: { id: string; anchors?: string[] }
): void {
  if (!target.anchors?.length) return;

  const targetCriteriaIds = new Set(targetEntry.entity.criteria.map((criterion) => criterion.id));

  for (const anchor of target.anchors) {
    if (targetCriteriaIds.has(anchor)) continue;

    issues.push({
      filePath: entry.filePath,
      message: `${sourceId} ${groupName}.${relationKey} relation to ${target.id} anchors unknown criterion ${anchor}.`,
    });
  }
}

async function validatePassingImplementationReferences(
  specDir: string,
  loaded: LoadedSpecEntity[],
  issues: SpecValidationIssue[]
): Promise<void> {
  const repoRoot = await realpath(path.resolve(specDir, '..'));
  const contained = (target: string) => {
    const relative = path.relative(repoRoot, target);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  for (const entry of loaded) {
    for (const implementation of entry.entity.implementations) {
      if (implementation.status !== 'passing') continue;
      const implementationPath = implementation.path;
      const label = `Passing implementation ${entry.entity.id}#${implementation.id}`;
      if (
        !implementationPath?.trim() ||
        /^[a-z][a-z0-9+.-]*:/i.test(implementationPath) ||
        path.isAbsolute(implementationPath) ||
        path.win32.isAbsolute(implementationPath)
      ) {
        issues.push({
          filePath: entry.filePath,
          message: `${label} must name a repository-relative file: ${implementationPath ?? '(no path)'}`,
        });
        continue;
      }
      const target = path.resolve(repoRoot, implementationPath);
      if (!contained(target)) {
        issues.push({
          filePath: entry.filePath,
          message: `${label} path must stay inside the repository: ${implementationPath}`,
        });
        continue;
      }
      try {
        const resolved = await realpath(target);
        if (!contained(resolved) || !(await stat(resolved)).isFile()) {
          issues.push({
            filePath: entry.filePath,
            message: `${label} must resolve to a repository file: ${implementationPath}`,
          });
        }
      } catch {
        issues.push({
          filePath: entry.filePath,
          message: `${label} file does not exist: ${implementationPath}`,
        });
      }
    }
  }
}

async function validateNoteReferences(
  specDir: string,
  loaded: LoadedSpecEntity[],
  issues: SpecValidationIssue[]
): Promise<void> {
  for (const entry of loaded) {
    const notes = entry.entity.notes;
    if (!notes) continue;

    const notePath = path.resolve(path.dirname(entry.filePath), notes);
    const relativeNotePath = path.relative(specDir, notePath);

    if (relativeNotePath.startsWith('..')) {
      issues.push({
        filePath: entry.filePath,
        message: `Notes path must stay inside the spec directory: ${notes}`,
      });
      continue;
    }

    try {
      const noteStat = await stat(notePath);
      if (!noteStat.isFile()) {
        issues.push({
          filePath: entry.filePath,
          message: `Notes path does not point to a file: ${notes}`,
        });
      }
    } catch {
      issues.push({
        filePath: entry.filePath,
        message: `Notes file does not exist: ${notes}`,
      });
    }
  }
}
