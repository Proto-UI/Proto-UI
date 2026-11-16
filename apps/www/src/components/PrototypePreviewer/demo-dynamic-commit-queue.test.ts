import { describe, expect, it, vi } from 'vitest';
import { createDynamicChildrenModel } from './demo-dynamic-children';
import { createDynamicCommitQueue } from './demo-dynamic-commit-queue';
import type { DemoKeyedChild, DemoSpec } from './demo-types';
const model = () =>
  createDynamicChildrenModel({
    type: 'demo',
    root: {
      kind: 'box',
      children: [
        { kind: 'box', ref: 'one', dynamicChildren: { prototypeIds: [] } },
        { kind: 'box', ref: 'two', dynamicChildren: { prototypeIds: [] } },
      ],
    },
  } satisfies DemoSpec);
const rows = (ref: string): DemoKeyedChild[] => [{ key: ref, node: { kind: 'box', ref } }];
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('dynamic host commit serialization', () => {
  it('coalesces queued requests but invalid incoming data cannot supersede valid pending work', async () => {
    const state = model(),
      commit = vi.fn(async () => {});
    const queue = createDynamicCommitQueue(state, () => true, commit);
    const first = queue.setChildren('one', rows('a'));
    const second = queue.setChildren('one', rows('b'));
    const invalid = queue.setChildren('one', [rows('b')[0], rows('b')[0]]);
    await expect(invalid).rejects.toThrow(/duplicate key/);
    await expect(first).resolves.toBe('superseded');
    await expect(second).resolves.toBe('committed');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(state.getCommitted('one')[0].key).toBe('b');
    queue.dispose();
  });
  it('does not interrupt an already started host commit and rechecks cross-slot refs when queued work starts', async () => {
    const state = model(),
      blocked = gate(),
      started = gate();
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async () => {
        started.resolve();
        await blocked.promise;
      }
    );
    const first = queue.setChildren('one', rows('same'));
    // Both requests can pass initial admission before either has reserved refs.
    const other = queue.setChildren('two', rows('same'));
    const rejected = expect(other).rejects.toThrow(/collides with slot/);
    await started.promise;
    const newer = queue.setChildren('one', rows('new'));
    blocked.resolve();
    await expect(first).resolves.toBe('committed');
    await rejected;
    await expect(newer).resolves.toBe('committed');
    expect(state.getCommitted('one')[0].key).toBe('new');
    queue.dispose();
  });
  it('copies caller data on enqueue, invokes reconciliation after model commit, and suppresses publication on disposal', async () => {
    const state = model(),
      blocked = gate(),
      started = gate();
    let live = true;
    const published: string[] = [];
    const after = vi.fn(() => expect(state.getCommitted('one')[0].key).toBe('old'));
    const queue = createDynamicCommitQueue(
      state,
      () => live,
      async (tx, current) => {
        started.resolve();
        await blocked.promise;
        if (current()) published.push(tx.entries[0].key);
      },
      after
    );
    const input = rows('old');
    const active = queue.setChildren('one', input);
    input[0] = rows('mutated')[0];
    await started.promise;
    live = false;
    queue.dispose();
    blocked.resolve();
    await expect(active).resolves.toBe('disposed');
    expect(published).toEqual([]);
    expect(after).not.toHaveBeenCalled();
  });
  it('rejects a host failure rather than acknowledging a partial commit', async () => {
    const state = model();
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async () => {
        throw new Error('host failed');
      }
    );
    await expect(queue.setChildren('one', rows('x'))).rejects.toThrow('host failed');
    expect(state.getCommitted('one')).toEqual([]);
    queue.dispose();
  });
  it('calls postcommit only after the model acknowledges the host commit', async () => {
    const state = model();
    const after = vi.fn(() => expect(state.getCommitted('one')[0].key).toBe('x'));
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async () => {},
      after
    );
    await expect(queue.setChildren('one', rows('x'))).resolves.toBe('committed');
    expect(after).toHaveBeenCalledTimes(1);
    queue.dispose();
  });

  it('invalidates the committed model if postcommit resource reconciliation fails', async () => {
    const state = model();
    let live = true;
    const cleanup = vi.fn(() => {
      live = false;
    });
    const queue = createDynamicCommitQueue(
      state,
      () => live,
      async () => {},
      () => {
        expect(state.getCommitted('one')[0].key).toBe('x');
        cleanup(); // All actual host callbacks revoke their render lease on failure.
        throw new Error('postcommit failed');
      }
    );
    const first = queue.setChildren('one', rows('x'));
    const later = queue.setChildren('two', rows('y'));
    await expect(first).rejects.toThrow('postcommit failed');
    await expect(later).resolves.toBe('disposed');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(state.getCommitted('one')).toEqual([]);
    expect(state.getCommitted('two')).toEqual([]);
    await expect(queue.setChildren('one', rows('retry'))).resolves.toBe('disposed');
  });

  it('does not run the next host update after a partial host mutation throws', async () => {
    const state = model();
    const hostState: string[] = [];
    const host = vi.fn(async () => {
      hostState.push('partial');
      // Actual renderers release their complete lease, including portals, here.
      hostState.length = 0;
      throw new Error('partial host failure');
    });
    const queue = createDynamicCommitQueue(state, () => true, host);
    const first = queue.setChildren('one', rows('x'));
    const later = queue.setChildren('two', rows('y'));
    await expect(first).rejects.toThrow('partial host failure');
    await expect(later).resolves.toBe('disposed');
    expect(host).toHaveBeenCalledTimes(1);
    expect(hostState).toEqual([]);
    expect(state.getCommitted('one')).toEqual([]);
    await expect(queue.setChildren('one', rows('retry'))).resolves.toBe('disposed');
  });
});

// Real timer tasks, not mocked time or Promise-only flushing. These prove an
// opportunity for unrelated host work; they do not simulate native user input.
const hostTask = <T>(read: () => T): Promise<T> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(read());
      } catch (error) {
        reject(error);
      }
    }, 0);
  });

describe('dynamic host commit task boundaries', () => {
  it('lets an independent host task observe a complete acknowledgement before the next queued commit', async () => {
    const state = model();
    const commits: string[] = [];
    let acknowledged = false;
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.slotRef);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first')).then((outcome) => {
        acknowledged = outcome === 'committed';
        return outcome;
      });
      const second = queue.setChildren('two', rows('second'));
      const observed = hostTask(() => ({
        acknowledged,
        commits: [...commits],
        one: state.getCommitted('one').map((entry) => entry.key),
        two: state.getCommitted('two').map((entry) => entry.key),
      }));
      const [firstOutcome, secondOutcome, observation] = await Promise.all([
        first,
        second,
        observed,
      ]);
      expect(observation).toEqual({
        acknowledged: true,
        commits: ['one'],
        one: ['first'],
        two: [],
      });
      expect([firstOutcome, secondOutcome]).toEqual(['committed', 'committed']);
      expect(commits).toEqual(['one', 'two']);
    } finally {
      queue.dispose();
    }
  });

  it('keeps work queued so a host task can supersede it without interrupting the committed slot', async () => {
    const state = model();
    const commits: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.entries[0].key);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first'));
      const pending = queue.setChildren('two', rows('old'));
      const { latest } = await hostTask(() => ({
        latest: queue.setChildren('two', rows('latest')),
      }));
      expect(await Promise.all([first, pending, latest])).toEqual([
        'committed',
        'superseded',
        'committed',
      ]);
      expect(commits).toEqual(['first', 'latest']);
      expect(state.getCommitted('one')[0].key).toBe('first');
      expect(state.getCommitted('two')[0].key).toBe('latest');
    } finally {
      queue.dispose();
    }
  });

  it('retires queued work from a host task without starting another host mutation', async () => {
    const state = model();
    const commits: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.slotRef);
      }
    );
    const first = queue.setChildren('one', rows('first'));
    const pending = queue.setChildren('two', rows('second'));
    await hostTask(() => queue.dispose());
    expect(await Promise.all([first, pending])).toEqual(['committed', 'disposed']);
    expect(commits).toEqual(['one']);
    expect(state.getCommitted('one')).toEqual([]);
    expect(state.getCommitted('two')).toEqual([]);
    await expect(queue.setChildren('two', rows('retry'))).resolves.toBe('disposed');
  });

  it('rechecks the live lease after a host task before admitting another queued slot', async () => {
    const state = model();
    let live = true;
    const commit = vi.fn(async () => {});
    const queue = createDynamicCommitQueue(state, () => live, commit);
    try {
      const first = queue.setChildren('one', rows('first'));
      const pending = queue.setChildren('two', rows('second'));
      await hostTask(() => {
        live = false;
      });
      expect(await Promise.all([first, pending])).toEqual(['committed', 'disposed']);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(state.getCommitted('one')).toEqual([]);
      expect(state.getCommitted('two')).toEqual([]);
    } finally {
      queue.dispose();
    }
  });

  it('finishes an isolated commit without adding a host-task delay to its acknowledgement', async () => {
    const state = model();
    const order: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async () => {
        order.push('host');
      }
    );
    try {
      const committed = queue.setChildren('one', rows('first')).then((outcome) => {
        order.push('ack');
        return outcome;
      });
      const task = hostTask(() => order.push('task'));
      expect(await committed).toBe('committed');
      await task;
      expect(order).toEqual(['host', 'ack', 'task']);
    } finally {
      queue.dispose();
    }
  });

  it('does not acknowledge or replace a started host commit while that commit is pending', async () => {
    const state = model();
    const blocked = gate();
    const started = gate();
    const commits: string[] = [];
    let firstAcknowledged = false;
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.entries[0].key);
        if (commits.length === 1) {
          started.resolve();
          await blocked.promise;
        }
      }
    );
    try {
      const first = queue.setChildren('one', rows('first')).then((outcome) => {
        firstAcknowledged = true;
        return outcome;
      });
      await started.promise;
      const pending = queue.setChildren('two', rows('second'));
      const observation = await hostTask(() => ({
        firstAcknowledged,
        commits: [...commits],
        one: state.getCommitted('one'),
        two: state.getCommitted('two'),
      }));
      blocked.resolve();
      expect(await Promise.all([first, pending])).toEqual(['committed', 'committed']);
      expect(observation).toEqual({
        firstAcknowledged: false,
        commits: ['first'],
        one: [],
        two: [],
      });
    } finally {
      blocked.resolve();
      queue.dispose();
    }
  });

  it('rejects invalid task-originated data without discarding the valid queued request', async () => {
    const state = model();
    const commits: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.entries[0].key);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first'));
      const pending = queue.setChildren('two', rows('valid'));
      const { invalid } = await hostTask(() => ({
        invalid: queue
          .setChildren('two', [rows('duplicate')[0], rows('duplicate')[0]])
          .catch((error: unknown) => error),
      }));
      expect(await invalid).toMatchObject({ message: expect.stringContaining('duplicate key') });
      expect(await Promise.all([first, pending])).toEqual(['committed', 'committed']);
      expect(commits).toEqual(['first', 'valid']);
      expect(state.getCommitted('two')[0].key).toBe('valid');
    } finally {
      queue.dispose();
    }
  });
});

describe('dynamic host commits enqueued by acknowledgement continuations', () => {
  it('gives a host task an opportunity before work appended by an acknowledgement continuation', async () => {
    const state = model();
    const commits: string[] = [];
    let acknowledged = false;
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.slotRef);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first'));
      const second = first.then(() => {
        acknowledged = true;
        return queue.setChildren('two', []);
      });
      const observed = hostTask(() => ({ acknowledged, commits: [...commits] }));
      const [firstOutcome, secondOutcome, observation] = await Promise.all([
        first,
        second,
        observed,
      ]);
      expect(observation).toEqual({ acknowledged: true, commits: ['one'] });
      expect([firstOutcome, secondOutcome]).toEqual(['committed', 'committed']);
      expect(commits).toEqual(['one', 'two']);
    } finally {
      queue.dispose();
    }
  });

  it('allows a host task to retire work appended after the first acknowledgement', async () => {
    const state = model();
    const commits: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.slotRef);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first'));
      const second = first.then(() => queue.setChildren('two', rows('second')));
      await hostTask(() => queue.dispose());
      expect(await Promise.all([first, second])).toEqual(['committed', 'disposed']);
      expect(commits).toEqual(['one']);
      expect(state.getCommitted('one')).toEqual([]);
      expect(state.getCommitted('two')).toEqual([]);
    } finally {
      queue.dispose();
    }
  });

  it('coalesces continuation work with a newer task request while preserving the acknowledged commit', async () => {
    const state = model();
    const commits: string[] = [];
    const queue = createDynamicCommitQueue(
      state,
      () => true,
      async (tx) => {
        commits.push(tx.entries[0].key);
      }
    );
    try {
      const first = queue.setChildren('one', rows('first'));
      const continuation = first.then(() => queue.setChildren('one', rows('older')));
      const { latest } = await hostTask(() => ({
        latest: queue.setChildren('one', rows('latest')),
      }));
      expect(await Promise.all([first, continuation, latest])).toEqual([
        'committed',
        'superseded',
        'committed',
      ]);
      expect(commits).toEqual(['first', 'latest']);
      expect(state.getCommitted('one')[0].key).toBe('latest');
    } finally {
      queue.dispose();
    }
  });

  it('releases an idle continuation timer when its queue is disposed after acknowledgement', async () => {
    const state = model();
    // Observe real timer allocation/retirement; do not replace the scheduler or
    // move its callback ahead of the acknowledgement microtask.
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const cancel = vi.spyOn(globalThis, 'clearTimeout');
    const commit = vi.fn(async () => {});
    const queue = createDynamicCommitQueue(state, () => true, commit);
    try {
      expect(await queue.setChildren('one', rows('first'))).toBe('committed');
      expect(schedule).toHaveBeenCalledTimes(1);
      const timer = schedule.mock.results[0].value;
      queue.dispose();
      expect(cancel).toHaveBeenCalledWith(timer);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(state.getCommitted('one')).toEqual([]);
      await expect(queue.setChildren('two', rows('later'))).resolves.toBe('disposed');
    } finally {
      queue.dispose();
      schedule.mockRestore();
      cancel.mockRestore();
    }
  });
});
