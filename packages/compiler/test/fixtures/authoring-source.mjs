import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProtoProgram } from '@proto.ui/compiler/frontend';
import { produceComponentIR } from '@proto.ui/compiler/producer';

const examples = new URL('../../../../internal/compiler/examples/', import.meta.url);
const root = fileURLToPath(new URL('../../../../', import.meta.url));

function compileSource(entry, publicName, exportName) {
  const file = fileURLToPath(entry);
  const config = fileURLToPath(new URL('tsconfig.json', entry));
  const program = createProtoProgram({
    rootNames: [file],
    currentDirectory: root,
    project: config,
  });
  return {
    ...produceComponentIR(program, { fileName: file, publicName, exportName }),
    sourceProject: {
      file: config,
      sha256: createHash('sha256').update(readFileSync(config)).digest('hex'),
    },
  };
}

export function authoredSource(fileName, publicName, exportName = 'default') {
  return compileSource(new URL(fileName, examples), publicName, exportName);
}

export function authoredContextSource() {
  return compileSource(new URL('./authoring-context/owner.proto.ts.txt', import.meta.url), 'LevelOwner', 'default');
}

export function authoredKeyedTaskSource() {
  return compileSource(new URL('./authoring-keyed-tasks/owner.proto.ts.txt', import.meta.url), 'KeyedTaskOwner', 'default');
}

export function authoredTaskPolicySource() {
  return compileSource(new URL('./authoring-task-policies/owner.proto.ts.txt', import.meta.url), 'PolicyReader', 'default');
}

export function authoredPairSource() {
  return compileSource(new URL('./authoring-pair/owner.proto.ts.txt', import.meta.url), 'PairReader', 'default');
}

export function authoredSyncRetirementSource() {
  return compileSource(new URL('./authoring-sync-retirement/owner.proto.ts.txt', import.meta.url), 'SyncTree', 'default');
}

export function authoredBadgeSource() {
  const result = authoredSource('readonly-badge.proto.ts.txt', 'AuthoringBadge');
  assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
  return result;
}
