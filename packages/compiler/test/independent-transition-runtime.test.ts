// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRuntimeSession } from '@proto.ui/runtime';
import type { ExposePort } from '@proto.ui/module-expose';
import { createScopedExposesReader } from '../../adapters/base/src/host/exposes';
import prototype from './fixtures/independent-transition-owner.proto';
import { transitionJourneys, type TransitionOracleAPI } from './independent-transition-oracle';

describe('independent definition oracle: Runtime without Web globals', () => {
  for (const journey of transitionJourneys)
    it(journey.name, async () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');
      expect(typeof HTMLElement).toBe('undefined');
      let now = 0;
      const tasks: { at: number; run(): void; cancelled: boolean }[] = [];
      const session = createRuntimeSession(prototype, {
        prototypeName: prototype.name,
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_children, signal) => signal?.done(),
        scheduleDelay(duration, run) {
          const task = { at: now + duration, run, cancelled: false };
          tasks.push(task);
          return {
            cancel: () => {
              task.cancelled = true;
            },
          };
        },
      });
      // Use the same public callback boundary as actual Adapters. ExposePort is
      // the internal raw registry and does not itself wrap outward callables.
      const reader = createScopedExposesReader(() => session.invokeInCallbackScope);
      const api = reader.read(
        session.caps.getPort<ExposePort>('expose')!.getAll()
      ) as TransitionOracleAPI;
      const dispose = async () => {
        reader.invalidate();
        await session.dispose();
      };
      const act = async <T>(action: () => T): Promise<T> => {
        let value!: T;
        session.invokeInCallbackScope(() => {
          value = action();
        });
        await Promise.resolve();
        return value;
      };
      try {
        await session.mount();
        await journey.run({
          api,
          act,
          async advance(milliseconds) {
            const end = now + milliseconds;
            for (;;) {
              const due = tasks
                .filter((task) => !task.cancelled && task.at <= end)
                .sort((a, b) => a.at - b.at)[0];
              if (!due) break;
              now = due.at;
              due.cancelled = true;
              due.run();
              await Promise.resolve();
            }
            now = end;
            await Promise.resolve();
          },
          dispose,
        });
      } finally {
        await dispose();
      }
      expect(tasks.every((task) => task.cancelled)).toBe(true);
    });
});
