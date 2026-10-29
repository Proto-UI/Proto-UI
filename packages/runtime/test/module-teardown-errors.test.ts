import { expect, it, vi } from 'vitest';
import { cap, type CapsVaultView } from '@proto.ui/core';
import { defineModule, SYS_CAP } from '@proto.ui/module-base';
import { RuntimeModuleOrchestrator } from '../src/orchestrator/module-orchestrator';

it('finishes every phase/dispose hook before reporting the first failure', () => {
  const first = new Error('first teardown failure');
  const later = vi.fn();
  const phase = vi.fn();
  const hub = new RuntimeModuleOrchestrator(
    { prototypeName: 'teardown-errors', getPhase: () => 'setup' },
    [
      defineModule({
        name: 'a',
        resourceOwnership: 'instance',
        create: () => ({
          name: 'a',
          scope: 'instance',
          facade: {},
          hooks: {
            onMountPhase() {
              throw first;
            },
            dispose() {
              throw first;
            },
          },
        }),
      }),
      defineModule({
        name: 'b',
        deps: ['a'],
        resourceOwnership: 'instance',
        create: () => ({
          name: 'b',
          scope: 'instance',
          facade: {},
          hooks: { onMountPhase: phase, dispose: later },
        }),
      }),
    ]
  );
  expect(() => hub.setMountPhase('unmounting', 1)).toThrow(first);
  expect(phase).toHaveBeenCalledWith('unmounting', 1);
  expect(() => hub.dispose()).toThrow(first);
  expect(later).toHaveBeenCalledOnce();
  expect(() => hub.dispose()).not.toThrow();
  expect(later).toHaveBeenCalledOnce();
});

function createResetFixture(failures: Partial<Record<'a' | 'b' | 'c', unknown>>) {
  const tokens = {
    a: cap<string>('test:bulk-reset:a'),
    b: cap<string>('test:bulk-reset:b'),
    c: cap<string>('test:bulk-reset:c'),
  };
  const views = new Map<keyof typeof tokens, CapsVaultView>();
  const calls: string[] = [];
  const module = (name: keyof typeof tokens, deps: Array<keyof typeof tokens>) =>
    defineModule({
      name,
      deps,
      resourceOwnership: 'instance',
      create: ({ caps }) => {
        views.set(name, caps);
        caps.onChange(() => {
          if (caps.has(tokens[name])) return;
          calls.push(`${name}:first`);
          if (Object.hasOwn(failures, name)) throw failures[name];
        });
        if (name === 'a') {
          caps.onChange(() => {
            if (!caps.has(tokens.a)) calls.push('a:second');
          });
        }
        return { name, scope: 'instance', facade: {}, hooks: {} };
      },
    });
  const hub = new RuntimeModuleOrchestrator(
    { prototypeName: 'bulk-reset-errors', getPhase: () => 'setup' },
    [module('a', []), module('b', ['a']), module('c', ['b'])]
  );
  const wiring = hub.getWiring();
  for (const name of ['a', 'b', 'c'] as const) wiring.attach(name, [[tokens[name], 'attached']]);
  return { hub, wiring, views, calls, tokens };
}

it.each([
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['zero', 0],
  ['empty string', ''],
  ['Error', new Error('first reset failure')],
])('bulk reset preserves the first %s failure while attempting later modules', (_label, first) => {
  const later = new Error('later reset failure');
  const { hub, wiring, views, calls, tokens } = createResetFixture({ a: first, b: later });
  const systems = new Map([...views].map(([name, view]) => [name, view.get(SYS_CAP)]));
  let didThrow = false;
  let thrown: unknown;
  try {
    wiring.reset();
  } catch (error) {
    didThrow = true;
    thrown = error;
  }

  expect(didThrow).toBe(true);
  expect(thrown).toBe(first);
  expect(calls).toEqual(['a:first', 'b:first', 'c:first']);
  for (const [name, view] of views) {
    expect(view.has(tokens[name])).toBe(false);
    expect(view.get(SYS_CAP)).toBe(systems.get(name));
  }
  expect(() => wiring.reset()).not.toThrow();
  expect(calls).toEqual(['a:first', 'b:first', 'c:first']);
  hub.dispose();
});

it('keeps healthy bulk reset and named reset behavior distinct', () => {
  const healthy = createResetFixture({});
  expect(() => healthy.wiring.reset()).not.toThrow();
  expect(healthy.calls).toEqual(['a:first', 'a:second', 'b:first', 'c:first']);
  healthy.hub.dispose();

  const failure = new Error('named reset failure');
  const named = createResetFixture({ a: failure });
  expect(() => named.wiring.reset('a')).toThrow(failure);
  expect(named.calls).toEqual(['a:first']);
  expect(named.views.get('a')!.has(named.tokens.a)).toBe(false);
  expect(named.views.get('b')!.has(named.tokens.b)).toBe(true);
  expect(named.views.get('c')!.has(named.tokens.c)).toBe(true);
  named.hub.dispose();
});
