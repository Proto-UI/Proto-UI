import path from 'node:path';

import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { CONTEXT_IDENTITY_SCOPE_CASES } from '@proto.ui/spec-fixtures/context/identity-scope';
import { CONTEXT_RUNTIME_SURFACE_CASES } from '@proto.ui/spec-fixtures/context/runtime-surface';
import { describe, expect, it } from 'vitest';

type FixtureCase = {
  id: string;
  specCase: string;
  covers: readonly string[];
};

function contractIdFromCriterion(criterionId: string) {
  return criterionId.replace(/-[A-Z]$/, '');
}

function assertFixtureAlignment(
  workspace: Awaited<ReturnType<typeof loadSpecWorkspaceFromDirectory>>,
  testId: string,
  fixtureId: string,
  fixturePath: string,
  cases: readonly FixtureCase[]
) {
  const testSpec = workspace.entities.find((entity) => entity.id === testId);
  expect(testSpec).toBeDefined();
  expect(testSpec?.type).toBe('test');

  const specCaseIds = new Set<string>(testSpec?.cases.map((testCase) => testCase.id));
  const fixtureSpecCases = new Set<string>(cases.map((testCase) => testCase.specCase));

  for (const testCase of cases) {
    expect(
      specCaseIds.has(testCase.specCase),
      `${testCase.id} references ${testCase.specCase}`
    ).toBe(true);

    for (const criterionId of testCase.covers) {
      const contractId = contractIdFromCriterion(criterionId);
      const contract = workspace.entities.find((entity) => entity.id === contractId);
      expect(contract, `${testCase.id} references ${contractId}`).toBeDefined();
      expect(
        contract?.criteria.some((criterion) => criterion.id === criterionId),
        `${testCase.id} covers ${criterionId}`
      ).toBe(true);
    }
  }

  const fixtureImplementation = testSpec?.implementations.find(
    (implementation) => implementation.id === fixtureId
  );

  expect(fixtureImplementation?.status).toBe('active');
  expect(fixtureImplementation?.path).toBe(fixturePath);
  // A Test may have several independently mapped implementations. This
  // fixture must cover exactly its own declaration, not another implementation's
  // cases (e.g. J1 reentrancy). Catalog integrity checks the full coverage union.
  expect(fixtureSpecCases).toEqual(new Set(fixtureImplementation?.consumesCases ?? []));
}

describe('spec fixtures: context', () => {
  it('keeps context identity and scope fixtures aligned with T-CONTEXT-0001', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(path.resolve(process.cwd(), 'spec'));
    expect(workspace.issues).toEqual([]);

    assertFixtureAlignment(
      workspace,
      'T-CONTEXT-0001',
      'context-identity-scope-fixture',
      'packages/spec/fixtures/src/context/identity-scope.ts',
      CONTEXT_IDENTITY_SCOPE_CASES
    );
  });

  it('keeps context runtime surface fixtures aligned with T-CONTEXT-0002', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(path.resolve(process.cwd(), 'spec'));
    expect(workspace.issues).toEqual([]);

    assertFixtureAlignment(
      workspace,
      'T-CONTEXT-0002',
      'context-runtime-surface-fixture',
      'packages/spec/fixtures/src/context/runtime-surface.ts',
      CONTEXT_RUNTIME_SURFACE_CASES
    );
    expect(() =>
      assertFixtureAlignment(
        workspace,
        'T-CONTEXT-0002',
        'context-runtime-surface-fixture',
        'packages/spec/fixtures/src/context/runtime-surface.ts',
        CONTEXT_RUNTIME_SURFACE_CASES.slice(1)
      )
    ).toThrow();
    expect(() =>
      assertFixtureAlignment(
        workspace,
        'T-CONTEXT-0002',
        'context-runtime-surface-fixture',
        'packages/spec/fixtures/src/context/runtime-surface.ts',
        [
          ...CONTEXT_RUNTIME_SURFACE_CASES,
          { id: 'not-owned', specCase: 'T-CONTEXT-0002-CASE-REENTRANCY', covers: [] },
        ]
      )
    ).toThrow();
  });
});
