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
