import { describe, expect, it } from 'vitest';
import { runAllSteps } from '../src/internal';

describe('internal synchronous cleanup completion', () => {
  it.each([undefined, null, false, 0, '', Symbol('failure'), new Error('first')])(
    'preserves the first thrown value %s after attempting every later callback',
    (failure) => {
      const calls: string[] = [];
      let caught: { value: unknown } | undefined;
      try {
        runAllSteps([
          () => {
            calls.push('before');
          },
          () => {
            calls.push('first');
            throw failure;
          },
          () => {
            calls.push('second');
            throw new Error('secondary');
          },
          () => {
            calls.push('after');
          },
        ]);
      } catch (value) {
        caught = { value };
      }
      expect(caught).toEqual({ value: failure });
      expect(caught).toHaveProperty('value');
      expect(caught!.value).toBe(failure);
      expect(calls).toEqual(['before', 'first', 'second', 'after']);
    }
  );

  it('keeps a reentrant completion independent and resumes the outer callbacks', () => {
    const calls: string[] = [];
    const failure = new Error('nested');
    expect(() =>
      runAllSteps([
        () => {
          calls.push('outer');
          runAllSteps([
            () => {
              calls.push('inner-first');
              throw failure;
            },
            () => {
              calls.push('inner-last');
            },
          ]);
        },
        () => {
          calls.push('outer-last');
        },
      ])
    ).toThrow(failure);
    expect(calls).toEqual(['outer', 'inner-first', 'inner-last', 'outer-last']);
  });

  it('retains synchronous completion without awaiting returned promises', async () => {
    const calls: string[] = [];
    runAllSteps([
      () =>
        Promise.resolve().then(() => {
          calls.push('microtask');
        }),
      () => {
        calls.push('sync');
      },
    ]);
    expect(calls).toEqual(['sync']);
    await Promise.resolve();
    expect(calls).toEqual(['sync', 'microtask']);
  });

  it('retains the current array iterator when a callback adds a later step', () => {
    const calls: string[] = [];
    const steps = [
      () => {
        calls.push('first');
        steps.push(() => {
          calls.push('added');
        });
      },
      () => {
        calls.push('second');
      },
    ];
    runAllSteps(steps);
    expect(calls).toEqual(['first', 'second', 'added']);
  });
});
