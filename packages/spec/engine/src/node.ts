import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import {
  SPEC_RELATION_KINDS,
  compareSpecVersions,
  validateSpecEntity,
  type SpecEntity,
  type SpecEntityType,
  type SpecRelationKind,
  type SpecRelations,
  type SpecValidationIssue,
} from '@proto.ui/spec-schema';

import { createSpecWorkspace, type SpecWorkspace } from './index';

export type LoadedSpecEntity = {
  filePath: string;
  entity: SpecEntity;
};

export type LoadedSpecWorkspace = SpecWorkspace & {
  files: LoadedSpecEntity[];
  issues: SpecValidationIssue[];
};

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

const RELATION_TARGET_TYPES = {
  contracts: 'contract',
  prototypes: 'prototype',
  modules: 'module',
  adapters: 'adapter',
  decisions: 'decision',
  hostCaps: 'host-cap',
  tests: 'test',
  knowledge: 'knowledge',
} as const satisfies Record<keyof NonNullable<SpecRelations>, SpecEntityType>;

function validateWorkspaceRelations(
  loaded: LoadedSpecEntity[],
  issues: SpecValidationIssue[]
): void {
  const byId = new Map(loaded.map((entry) => [entry.entity.id, entry]));

  for (const entry of loaded) {
    validateReplacement(entry, byId, issues);

    for (const relationKind of SPEC_RELATION_KINDS) {
      validateRelationGroup(entry, byId, issues, relationKind, entry.entity[relationKind]);
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
