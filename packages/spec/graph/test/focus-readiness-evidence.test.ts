import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';

let workspace: Awaited<ReturnType<typeof loadSpecWorkspaceFromDirectory>>;

beforeAll(async () => {
  workspace = await loadSpecWorkspaceFromDirectory(path.join(process.cwd(), 'spec'));
  expect(workspace.issues).toEqual([]);
});

describe('Focus readiness evidence boundaries', () => {
  it.each([
    [
      'react-focus-acquisition-readiness',
      'T-FOCUS-0002-CASE-ACQUISITION-READINESS',
      ['HC-FOCUS-TARGET-0001-D'],
    ],
    [
      'react-focus-updated-entry-replay',
      'T-FOCUS-0002-CASE-UPDATED-ENTRY',
      [
        'C-AS-FOCUS-ENTRY-0001-G',
        'C-AS-FOCUS-ENTRY-0001-H',
        'C-AS-FOCUSABLE-0001-G',
        'HC-FOCUS-TARGET-0001-D',
      ],
    ],
    [
      'react-focus-updated-native-blur',
      'T-FOCUS-0002-CASE-UPDATED-BLUR',
      ['HC-FOCUS-TARGET-0001-B', 'HC-FOCUS-TARGET-0001-D'],
    ],
  ])('keeps %s scoped to its exercised host boundary', (implementationId, caseId, covers) => {
    const entity = workspace.entities.find((candidate) => candidate.id === 'T-FOCUS-0002');
    const implementation = entity?.implementations.find(
      (candidate) => candidate.id === implementationId
    );

    expect(implementation?.consumesCases).toEqual([caseId]);
    expect(entity?.cases.find((candidate) => candidate.id === caseId)?.covers).toEqual(covers);
  });

  it.each(['react', 'vue', 'vue2', 'web-component'])(
    'keeps %s retry evidence independent of full-profile and roving claims',
    (adapter) => {
      const entity = workspace.entities.find((candidate) => candidate.id === 'T-FOCUS-0001');
      const implementation = entity?.implementations.find(
        (candidate) => candidate.id === `adapter-${adapter}-focus-intent-retry-bound`
      );
      expect(implementation?.consumesCases).toEqual([
        'T-FOCUS-0001-CASE-INTENT-RETRY-BOUND',
        'T-FOCUS-0001-CASE-RETAINED-INTENT-BUDGET',
        'T-FOCUS-0001-CASE-CURRENT-INTENT-ACCOUNTING',
      ]);
      expect(
        entity?.cases.find((candidate) => candidate.id === 'T-FOCUS-0001-CASE-INTENT-RETRY-BOUND')
          ?.covers
      ).toEqual(['C-AS-FOCUSABLE-0001-G', 'C-AS-FOCUS-ENTRY-0001-H', 'HC-FOCUS-TARGET-0001-C']);
      expect(
        entity?.cases.find(
          (candidate) => candidate.id === 'T-FOCUS-0001-CASE-RETAINED-INTENT-BUDGET'
        )?.covers
      ).toEqual(['C-AS-FOCUSABLE-0001-G', 'C-AS-FOCUS-ENTRY-0001-H', 'HC-FOCUS-TARGET-0001-C']);
      expect(
        entity?.cases.find(
          (candidate) => candidate.id === 'T-FOCUS-0001-CASE-CURRENT-INTENT-ACCOUNTING'
        )?.covers
      ).toEqual(['HC-FOCUS-TARGET-0001-C']);
    }
  );

  it.each([
    ['M-FOCUS-0001', 'M-FOCUS-0001-G'],
    ['HC-FOCUS-TARGET-0001', 'HC-FOCUS-TARGET-0001-D'],
  ])('traces %s retained entry realization to its governing contract', (entityId, criterionId) => {
    const criterion = workspace.entities
      .find((candidate) => candidate.id === entityId)
      ?.criteria.find((candidate) => candidate.id === criterionId);
    const reference = criterion?.references?.contracts?.find(
      (candidate) => candidate.id === 'C-AS-FOCUS-ENTRY-0001'
    );

    expect(reference?.anchors).toContain('C-AS-FOCUS-ENTRY-0001-H');
  });
});
