// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createNativeCaseOwner, withinNativePhase } from './web-component-native-case-owner';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => (resolve = complete));
  return { promise, resolve };
}

describe('native browser case evidence ownership', () => {
  it('records completed assertions as observations, never a replacement for the runner verdict', () => {
    const owner = createNativeCaseOwner();
    expect(owner.complete()).toBe(true);
    owner.retire();
    expect(owner.observation('pass', [])).toMatchObject({
      outcome: 'OBSERVED',
      bodyCompletedBeforeRetirement: true,
      finalAcceptance: false,
      authoritativeReport: 'browser-vitest.json',
    });
    expect(owner.observation('fail', []).outcome).toBe('FAIL');
  });

  it('cannot turn a timed-out case into successful evidence when its body resolves late', async () => {
    const owner = createNativeCaseOwner();
    const body = deferred<void>();
    const completion = body.promise.then(() => owner.complete());
    await expect(
      withinNativePhase(
        'controlled body',
        5,
        () => completion,
        () => owner.retire()
      )
    ).rejects.toThrow('controlled body exceeded');
    body.resolve();
    expect(await completion).toBe(false);
    expect(owner.observation('fail', [])).toMatchObject({
      outcome: 'FAIL',
      bodyCompletedBeforeRetirement: false,
      finalAcceptance: false,
    });
  });

  it('closes a context acquired after setup retirement instead of handing it to another case', async () => {
    const owner = createNativeCaseOwner();
    const pending = deferred<{ close(): Promise<void> }>();
    const acquisition = owner.acquire(pending.promise);
    const rejected = expect(acquisition).rejects.toThrow('setup completed after its owner retired');
    owner.retire();
    await owner.close();
    let closed = 0;
    pending.resolve({
      async close() {
        closed++;
      },
    });
    await rejected;
    expect(closed).toBe(1);
    expect(() => owner.assertActive()).toThrow('owner has retired');
    expect(owner.observation('fail', []).outcome).toBe('FAIL');
  });

  it('keeps cleanup failure visible even when the body had completed', async () => {
    const owner = createNativeCaseOwner();
    await owner.acquire(
      Promise.resolve({
        async close() {
          throw new Error('context did not close');
        },
      })
    );
    owner.complete();
    await expect(owner.close()).rejects.toThrow('Native case cleanup failed');
    expect(owner.observation('pass', ['context did not close']).outcome).toBe('FAIL');
  });
});
