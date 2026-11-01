import path from 'node:path';

import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { EVENT_TYPE_PAYLOAD_CASES } from '@proto.ui/spec-fixtures/event/type-payload';
import { describe, expect, it } from 'vitest';

describe('spec fixtures: event type and payload', () => {
  it('stays aligned with T-EVENT-0002 and covered contracts', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(path.resolve(process.cwd(), 'spec'));
    expect(workspace.issues).toEqual([]);

    const testSpec = workspace.entities.find((entity) => entity.id === 'T-EVENT-0002');
    expect(testSpec).toBeDefined();
    expect(testSpec?.type).toBe('test');

    const specCaseIds = new Set<string>(testSpec?.cases.map((testCase) => testCase.id));
    const fixtureSpecCases = new Set<string>(
      EVENT_TYPE_PAYLOAD_CASES.map((testCase) => testCase.specCase)
    );

    for (const testCase of EVENT_TYPE_PAYLOAD_CASES) {
      expect(
        specCaseIds.has(testCase.specCase),
        `${testCase.id} references ${testCase.specCase}`
      ).toBe(true);

      for (const criterionId of testCase.covers) {
        const contractId = criterionId.replace(/-[A-Z]$/, '');
        const contract = workspace.entities.find((entity) => entity.id === contractId);
        expect(contract, `${testCase.id} references ${contractId}`).toBeDefined();
        expect(
          contract?.criteria.some((criterion) => criterion.id === criterionId),
          `${testCase.id} covers ${criterionId}`
        ).toBe(true);
      }
    }

    expect(fixtureSpecCases).toEqual(specCaseIds);

    const fixtureImplementation = testSpec?.implementations.find(
      (implementation) => implementation.id === 'event-type-payload-fixture'
    );

    expect(fixtureImplementation?.status).toBe('active');
    expect(fixtureImplementation?.path).toBe('packages/spec/fixtures/src/event/type-payload.ts');
    expect(new Set(fixtureImplementation?.consumesCases ?? [])).toEqual(specCaseIds);
  });
});

// Keep the original whole-workspace gate above intact. This additional check
// makes the new mapping inspectable even when unrelated catalog debt is red.
describe('pointer facts: focused draft mapping (not whole-workspace acceptance)', () => {
  it('maps the six-pointer definition through real planned module and four-host source paths', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(path.resolve(process.cwd(), 'spec'));
    const spec = workspace.entities.find((entity) => entity.id === 'T-EVENT-0002');
    expect(spec?.status).toBe('draft');
    const fixture = EVENT_TYPE_PAYLOAD_CASES.find(
      (item) => item.expectation === 'pointer-sample-facts'
    );
    expect(fixture?.acceptedTypes).toEqual([
      'pointer.down',
      'pointer.move',
      'pointer.up',
      'pointer.cancel',
      'pointer.enter',
      'pointer.leave',
    ]);
    const testCase = spec?.cases.find((item) => item.id === fixture?.specCase);
    expect(new Set(testCase?.covers)).toEqual(new Set(fixture?.covers));
    for (const criterion of fixture?.covers ?? []) {
      const owner = workspace.entities.find(
        (entity) => entity.id === criterion.replace(/-[A-Z]$/, '')
      );
      expect(owner?.status).toBe('draft');
      expect(owner?.criteria.some((item) => item.id === criterion)).toBe(true);
    }
    for (const id of [
      'module-pointer-facts-contract',
      'web-pointer-router-contract',
      'web-component-pointer-author-callback',
      'react-pointer-author-callback',
      'vue-pointer-author-callback',
      'vue2-pointer-author-callback',
      'compiled-web-pointer-consumers',
    ]) {
      const implementation = spec?.implementations.find((item) => item.id === id);
      expect(implementation?.status).toBe('planned');
      expect(implementation?.consumesCases).toContain('T-EVENT-0002-CASE-POINTER-FACTS');
      expect(implementation?.path).toBeTruthy();
    }
  });
});
