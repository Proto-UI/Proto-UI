// @ts-expect-error 0.3 removes the former public type as well as the def property.
import type { A11yDefAPI } from '@proto.ui/core';
import { expect, it } from 'vitest';
import { defineAsHook, definePrototype, type AccessibleHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import type { A11yPort } from '@proto.ui/module-a11y';
import { executeWithHost } from '../../src';

// T-A11Y-0001-CASE-ACCESSIBLE-HANDLE
it('shares one setup handle, composes declarations and rejects retained runtime declarations', () => {
  let accessible!: AccessibleHandle;
  let oldEntry: unknown;
  const P = definePrototype({
    name: 'accessible-handle',
    setup(def) {
      oldEntry = (def as unknown as Record<string, unknown>).a11y;
      // @ts-expect-error The removed def.a11y entry has no compatibility alias.
      void def.a11y;
      accessible = asAccessible();
      expect(asAccessible()).toBe(accessible);
      expect('dispose' in accessible).toBe(false);
      accessible.role('button');
      asAccessible().role('checkbox');
      accessible.name('First');
      asAccessible().name('Final');
      accessible.state('checked', def.state.bool('first', false));
      asAccessible().state('checked', def.state.bool('final', true));
      accessible.action('activate', { event: 'first' });
      asAccessible().action('activate', { event: 'final' });
      accessible.relation('controls', { target: 'first' });
      asAccessible().relation('controls', { target: 'final' });
      accessible.tree({ hidden: true });
      asAccessible().tree({ mergeChildren: true });
    },
  });
  const host = {
    prototypeName: P.name,
    getRawProps: () => ({}),
    commit: (_children: unknown, signal?: { done(): void }) => signal?.done(),
    schedule: (task: () => void) => task(),
  };
  const first = executeWithHost(P, host);
  const firstHandle = accessible;
  const port = first.caps.getPort<A11yPort>('a11y')!;
  expect(oldEntry).toBeUndefined();
  expect(port.getSnapshot()).toMatchObject({
    role: 'checkbox',
    name: { kind: 'text', value: 'Final' },
    states: { checked: true },
    actions: { activate: { event: 'final' } },
    relations: { controls: 'final' },
    tree: { hidden: true, mergeChildren: true },
  });
  const before = port.getSnapshot();
  const mutations = [
    () => firstHandle.id('late'),
    () => firstHandle.role('heading'),
    () => firstHandle.name('late'),
    () => firstHandle.nameFromContent(),
    () => firstHandle.description('late'),
    () => firstHandle.state('checked', {} as any),
    () => firstHandle.action('activate'),
    () => firstHandle.relation('controls', { target: 'late' }),
    () => firstHandle.tree({ hidden: false }),
    () => firstHandle.level(2),
  ];
  for (const mutate of mutations) expect(mutate).toThrow();
  expect(port.getSnapshot()).toEqual(before);
  expect(() => asAccessible()).toThrow();
  executeWithHost(P, host);
  expect(accessible).not.toBe(firstHandle);
  expect(port.getSnapshot()).toEqual(before);
});

it.each(['authored-first', 'privileged-first'] as const)(
  'rejects a privileged/authored name collision before reuse (%s)',
  (order) => {
    let authoredRuns = 0;
    let returned!: AccessibleHandle;
    const authored = defineAsHook({
      name: 'asAccessible',
      setup() {
        authoredRuns += 1;
      },
    });
    const P = definePrototype({
      name: `accessible-collision-${order}`,
      setup() {
        if (order === 'authored-first') {
          authored();
          returned = asAccessible();
        } else {
          returned = asAccessible();
          authored();
        }
      },
    });
    expect(() =>
      executeWithHost(P, {
        prototypeName: P.name,
        getRawProps: () => ({}),
        commit: (_children, signal) => signal?.done(),
        schedule: (task) => task(),
      })
    ).toThrow(/asHook.*asAccessible.*privileged.*authored/i);
    expect(authoredRuns).toBe(order === 'authored-first' ? 1 : 0);
    if (order === 'authored-first') expect(returned).toBeUndefined();
    else expect(typeof returned.role).toBe('function');
  }
);
