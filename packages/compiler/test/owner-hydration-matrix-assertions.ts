import { expect } from 'vitest';
import type { OwnerMatrixFixture, OwnerMatrixJourney } from './owner-hydration-matrix-fixture';

export function assertServerOwnership(fixture: OwnerMatrixFixture, journey: OwnerMatrixJourney) {
  const owners =
    journey === 'ownership' || journey === 'failure' || journey === 'commit'
      ? ['root', 'child', 'nested', 'nested-child']
      : ['root'];
  for (const name of owners) {
    expect(fixture.serverPhases.filter((phase) => phase === `${name}:created`)).toHaveLength(1);
    expect(fixture.serverPhases.filter((phase) => phase === `${name}:disposed`)).toHaveLength(1);
  }
  expect(fixture.serverPhases).toHaveLength(owners.length * 2);
  if (journey === 'absent') {
    expect(fixture.html).toBe('<!---->');
    expect(Object.keys((fixture.carrier as any).records)).toEqual(['0']);
    expect((fixture.carrier as any).records['0'].present).toBe(false);
  }
}

export function assertOwnerMatrix(journey: OwnerMatrixJourney, observed: any, final: any) {
  if (journey === 'commit') {
    expect(observed.commit).toMatchObject({
      rejected: false,
      sameDom: true,
      values: [8, 8, 11, 11],
      sharedContext: true,
      distinctContext: true,
      distinctStates: true,
      allCreatedBeforeCommit: true,
      transport: { closed: false, pending: 0, initial: 0, commits: 0, props: 0 },
    });
    expect(observed.updated).toEqual({
      values: [9, 9, 11, 11],
      sameState: true,
      sharedContext: true,
    });
    expect(observed.commit.phases.filter((phase: string) => phase === 'root:updated')).toHaveLength(
      1
    );
    expect(final.transport).toMatchObject({
      closed: true,
      owners: 0,
      pending: 0,
      initial: 0,
      commits: 0,
      props: 0,
    });
    expect(final.states).toHaveLength(4);
    expect(final.callbacks).toHaveLength(4);
    for (const result of [...final.states, ...final.callbacks])
      expect(result).toMatchObject({ refused: true });
    for (const name of ['root', 'child', 'nested', 'nested-child']) {
      for (const phase of ['created', 'mounted', 'unmounted', 'disposed'])
        expect(final.phases.filter((value: string) => value === `${name}:${phase}`)).toHaveLength(
          1
        );
    }
    return;
  }
  if (journey === 'absent' || journey === 'failure') {
    if (journey === 'failure') {
      expect(observed.failed).toMatchObject({
        rejected: true,
        rejection: 'false',
        initialRootValue: 3,
        state: { refused: true },
        transport: { closed: true, owners: 0, pending: 0, failure: false },
      });
      expect(
        observed.failed.phases.filter((phase: string) => phase === 'root:created')
      ).toHaveLength(1);
      expect(
        observed.failed.phases.filter((phase: string) => phase === 'root:disposed')
      ).toHaveLength(1);
      expect(
        observed.failed.phases.filter((phase: string) => phase === 'child:disposed')
      ).toHaveLength(1);
      expect(final.oldState).toMatchObject({ refused: true });
    }
    expect(observed.fresh).toMatchObject({
      rejected: false,
      values: [9, 9, 11, 11],
      ownContext: true,
      nestedContext: true,
      distinctContexts: true,
      distinctStates: true,
      newState: true,
      transport: { closed: false, pending: 0 },
    });
    expect(final.transport).toMatchObject({
      closed: true,
      owners: 0,
      pending: 0,
    });
    for (const state of [observed.failed?.transport, observed.fresh.transport, final.transport]) {
      if (!state) continue;
      for (const key of ['initial', 'commits', 'props'])
        if (state[key] !== null) expect(state[key]).toBe(0);
    }
    for (const result of [...final.states, ...final.callbacks])
      expect(result).toMatchObject({ refused: true });
    expect(final.states).toHaveLength(4);
    expect(final.callbacks).toHaveLength(4);
    for (const name of ['root', 'child', 'nested', 'nested-child']) {
      expect(final.phases.filter((phase: string) => phase === `${name}:created`)).toHaveLength(1);
      expect(final.phases.filter((phase: string) => phase === `${name}:disposed`)).toHaveLength(1);
    }
    return;
  }
  if (journey === 'rejection') {
    expect(observed).toMatchObject({
      rejected: true,
      oldWorkIgnored: true,
      retiredAudit: { active: 0, mounted: 1, retired: 1, events: 0 },
      fresh: {
        sameDom: true,
        value: 9,
        context: 9,
        output: '9',
        button: 'server',
        audit: { active: 1, mounted: 1, retired: 0 },
      },
    });
    expect(observed.rejection).toMatch(/hydration|mismatch/i);
    const phases: string[] = observed.rejectedPhases;
    expect(phases.filter((item) => item === 'root:created').length).toBe(
      phases.filter((item) => item === 'root:disposed').length
    );
    expect(phases.filter((item) => item === 'root:mounted').length).toBe(
      phases.filter((item) => item === 'root:unmounted').length
    );
    expect(final.audit).toMatchObject({ active: 0, mounted: 1, retired: 1 });
    expect(final.rejectedAudit).toMatchObject({ active: 0, mounted: 1, retired: 1, events: 0 });
    expect(final.phases).toEqual([
      'root:created',
      'root:mounted',
      'root:unmounted',
      'root:disposed',
    ]);
    return;
  }
  expect(observed.initial).toEqual({
    sameDom: true,
    values: [3, 3, 11, 11],
    ownContext: true,
    nestedContext: true,
    distinctContexts: true,
    distinctStates: true,
  });
  expect(observed.updated).toEqual({
    values: [7, 7, 11, 11],
    sameState: true,
    sharedContext: true,
    newContextValue: true,
    nestedUnaffected: true,
  });
  expect(observed.hidden).toMatchObject({
    outputCount: 0,
    sameRootState: true,
    sameRootContext: true,
    childRetired: { refused: true },
    rootValue: 7,
  });
  expect(observed.lateCallback).toMatchObject({ refused: true });
  expect(observed.rebound).toEqual({
    sameRootState: true,
    sameRootContext: true,
    newChildState: true,
    childContext: true,
    newNestedContext: true,
    values: [7, 7, 11],
    rootCreated: 1,
  });
  expect(observed.terminal).toMatchObject({
    state: { refused: true },
    callback: { refused: true },
  });
  const oldPhases: string[] = observed.terminal.phases;
  for (const [name, count] of [
    ['root', 1],
    ['child', 2],
    ['nested', 2],
    ['nested-child', 2],
  ] as const) {
    expect(oldPhases.filter((item) => item === `${name}:created`)).toHaveLength(count);
    expect(oldPhases.filter((item) => item === `${name}:disposed`)).toHaveLength(count);
  }
  expect(observed.fresh).toMatchObject({
    sameDom: true,
    newState: true,
    newContext: true,
    sharedContext: true,
    values: [9, 9, 11],
    oldStateStillRetired: { refused: true },
  });
  expect(final.states).toHaveLength(4);
  expect(final.callbacks).toHaveLength(4);
  for (const result of [...final.states, ...final.callbacks])
    expect(result).toMatchObject({ refused: true });
  for (const name of ['root', 'child', 'nested', 'nested-child']) {
    expect(final.phases.filter((item: string) => item === `${name}:created`)).toHaveLength(1);
    expect(final.phases.filter((item: string) => item === `${name}:disposed`)).toHaveLength(1);
  }
}
