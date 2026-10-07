import { expect, it, vi } from 'vitest';
import { defineModule } from '@proto.ui/module-base';
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
