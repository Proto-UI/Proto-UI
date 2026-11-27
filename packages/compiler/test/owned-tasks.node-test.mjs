import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { OwnedTaskGroup } from '@proto.ui/compiler/support/owned-tasks';
import {
  ActionFailure,
  FieldDraft,
  FieldStore,
  SignalQueue,
  dispatchAction,
  finishAction,
} from '../src/support/react/transaction.ts';

const source = Object.freeze({ file: 'await-trace.proto.ts', start: 41, end: 53 });
const sameCount = (left, right) => Object.is(left.count, right.count);
const sameFactor = (left, right) => Object.is(left.factor, right.factor);

// This handwritten native caller uses the same action, draft, publication and signal
// primitives available to an emitted function. Its input lease supplies the provider value.
function createOwner() {
  const fields = new FieldStore({ count: 1 });
  const provider = new FieldStore({ factor: 10 });
  let alive = true;
  const lease = { active: () => alive, read: provider.snapshot };

  function dispatch(enter) {
    return dispatchAction(lease, (inputs) =>
      enter((body) => {
        const draft = new FieldDraft(fields.snapshot());
        const signals = new SignalQueue();
        body({
          segment: Symbol(),
          get count() {
            return draft.current.count;
          },
          set count(value) {
            draft.edit().count = value;
          },
          get factor() {
            return inputs.factor;
          },
          get total() {
            return draft.current.count * inputs.factor;
          },
          afterCommit(effect) {
            signals.send(() => effect, undefined);
          },
        });
        return finishAction(lease, signals, fields, draft.current, sameCount);
      })
    );
  }

  return {
    dispatch,
    action: (body) => dispatch((commit) => commit(body)),
    snapshot() {
      const { count } = fields.snapshot();
      const { factor } = provider.snapshot();
      return [count, factor, count * factor];
    },
    publishFactor: (factor) =>
      dispatchAction(lease, () => finishAction(lease, undefined, provider, { factor }, sameFactor)),
    observe(listener) {
      fields.subscribe(listener);
      provider.subscribe(listener);
    },
    release() {
      alive = false;
    },
  };
}

function start(owner, group, segment) {
  let handle;
  const action = owner.action((view) => {
    group.start(view.afterCommit, segment, (invocation) => {
      handle = invocation;
    });
    assert.equal(handle, undefined, 'start is staged until this action commits');
  });
  assert.equal(action.status, 'committed');
  assert.equal(typeof handle.id, 'symbol');
  return handle;
}

for (const ready of [false, true]) {
  test(`CASE-AWAIT-TRACE with a ${ready ? 'ready' : 'pending'} result`, async () => {
    const owner = createOwner();
    const group = new OwnedTaskGroup('latest', owner.dispatch);
    const deferred = Promise.withResolvers();
    const result = ready ? Promise.resolve(5) : deferred.promise;
    const trace = [];
    owner.observe(() => trace.push(['published', ...owner.snapshot()]));

    function resume(capturedFactor, firstSegment, view, value) {
      assert.notEqual(view.segment, firstSegment);
      trace.push(['resumed', value, capturedFactor, view.count, view.factor, view.total]);
      view.count = value;
      trace.push(['working', view.total, ...owner.snapshot()]);
      view.afterCommit(() => trace.push(['failed resume effect']));
      throw new ActionFailure('resume failed', source);
    }

    const handle = start(owner, group, (view, task) => {
      const captured = view.factor;
      const firstSegment = view.segment;
      trace.push(['initial', view.count, captured, view.total]);
      view.count = 2;
      trace.push(['working', view.total, ...owner.snapshot()]);
      return task.await(
        () => {
          trace.push(['extern', ...owner.snapshot()]);
          return result;
        },
        (fresh, _task, value) => resume(captured, firstSegment, fresh, value)
      );
    });

    const firstCommit = [
      ['initial', 1, 10, 10],
      ['working', 20, 1, 10, 10],
      ['published', 2, 10, 20],
      ['extern', 2, 10, 20],
    ];
    assert.deepEqual(trace, firstCommit);
    assert.equal(owner.publishFactor(3).status, 'committed');
    if (!ready) deferred.resolve(5);
    assert.deepEqual(trace, [...firstCommit, ['published', 2, 3, 6]]);
    assert.deepEqual(await handle.completion, {
      status: 'failed',
      reason: 'resume failed',
      source,
    });
    assert.deepEqual(trace, [
      ...firstCommit,
      ['published', 2, 3, 6],
      ['resumed', 5, 10, 2, 3, 6],
      ['working', 15, 2, 3, 6],
    ]);
    assert.deepEqual(owner.snapshot(), [2, 3, 6]);
  });
}

test('each ready await starts a new segment, and a business Err completes as data', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('parallel', owner.dispatch);
  const businessError = Object.freeze({ kind: 'err', error: 'unavailable' });
  const published = [];
  const segments = new Set();
  owner.observe(() => published.push(owner.snapshot()[0]));
  const handle = start(owner, group, (view, task) => {
    segments.add(view.segment);
    view.count = 2;
    return task.await(
      () => 3,
      (fresh, current, count) => {
        segments.add(fresh.segment);
        fresh.count = count;
        return current.await(
          () => Promise.resolve(businessError),
          (last, control, result) => {
            segments.add(last.segment);
            if (result.kind === 'err') last.count = 4;
            return control.complete(result);
          }
        );
      }
    );
  });
  assert.deepEqual(published, [2]);
  await Promise.resolve();
  assert.deepEqual(published, [2, 3]);
  const outcome = await handle.completion;
  assert.equal(outcome.status, 'completed');
  assert.equal(outcome.value, businessError);
  assert.equal(segments.size, 3);
  assert.deepEqual(published, [2, 3, 4]);
});

// Each command is an independently resolvable native promise. It deliberately stays
// resolvable after its signal is aborted so late-result rejection is observable.
function command(label, events) {
  const { promise, resolve } = Promise.withResolvers();
  let signal;
  return {
    resolve,
    get signal() {
      return signal;
    },
    segment(_view, task) {
      return task.await(
        (issued) => {
          signal = issued;
          events.push(`start ${label}`);
          signal.addEventListener('abort', () => events.push(`abort ${label}`), { once: true });
          return promise;
        },
        (view, current, result) => {
          events.push(`resume ${label}`);
          view.count = result;
          return current.complete(result);
        }
      );
    },
  };
}

test('latest withdraws the old invocation and rejects its late result', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('latest', owner.dispatch);
  const events = [];
  const older = command('old', events);
  const newer = command('new', events);
  const oldHandle = start(owner, group, older.segment);
  const newHandle = start(owner, group, newer.segment);
  assert.notEqual(oldHandle.id, newHandle.id);
  assert.deepEqual(await oldHandle.completion, { status: 'superseded' });
  assert.ok(older.signal instanceof AbortSignal);
  assert.equal(older.signal.aborted, true);
  assert.equal(newer.signal.aborted, false);
  newer.resolve(7);
  assert.deepEqual(await newHandle.completion, { status: 'completed', value: 7 });
  older.resolve(99);
  await nextTurn();
  assert.deepEqual(events, ['start old', 'abort old', 'start new', 'resume new']);
  assert.equal(owner.snapshot()[0], 7);
});

test('parallel invocations both commit in completion order', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('parallel', owner.dispatch);
  const events = [];
  const a = command('A', events);
  const b = command('B', events);
  const first = start(owner, group, a.segment);
  const second = start(owner, group, b.segment);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(events, ['start A', 'start B']);
  b.resolve(12);
  assert.deepEqual(await second.completion, { status: 'completed', value: 12 });
  assert.equal(owner.snapshot()[0], 12);
  a.resolve(9);
  assert.deepEqual(await first.completion, { status: 'completed', value: 9 });
  assert.equal(owner.snapshot()[0], 9);
  assert.deepEqual(events, ['start A', 'start B', 'resume B', 'resume A']);
});

test('serial starts in order, skips cancelled queued work and advances on pending cancellation', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('serial', owner.dispatch);
  const events = [];
  const commands = ['A', 'B', 'C', 'D'].map((label) => command(label, events));
  const [a, b, c, d] = commands;
  const [first, skipped, interrupted, last] = commands.map((item) =>
    start(owner, group, item.segment)
  );
  assert.deepEqual(events, ['start A']);
  assert.equal(
    owner.action((view) => group.cancel(view.afterCommit, skipped.id)).status,
    'committed'
  );
  assert.deepEqual(await skipped.completion, { status: 'cancelled' });
  assert.equal(b.signal, undefined);
  a.resolve(2);
  assert.deepEqual(await first.completion, { status: 'completed', value: 2 });
  assert.deepEqual(events, ['start A', 'resume A', 'start C']);
  assert.equal(
    owner.action((view) => group.cancel(view.afterCommit, interrupted.id)).status,
    'committed'
  );
  assert.deepEqual(await interrupted.completion, { status: 'cancelled' });
  assert.equal(c.signal.aborted, true);
  assert.deepEqual(events.slice(-2), ['abort C', 'start D']);
  c.resolve(99);
  d.resolve(4);
  assert.deepEqual(await last.completion, { status: 'completed', value: 4 });
  assert.deepEqual(events, ['start A', 'resume A', 'start C', 'abort C', 'start D', 'resume D']);
  assert.equal(owner.snapshot()[0], 4);
});

test('discarded start and cancel requests have no externally visible effect', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('latest', owner.dispatch);
  const events = [];
  const pending = command('retained', events);
  const retained = start(owner, group, pending.segment);
  let issued = false;
  const result = owner.action((view) => {
    view.count = 31;
    group.cancel(view.afterCommit);
    group.start(view.afterCommit, command('discarded', events).segment, () => {
      issued = true;
    });
    throw new ActionFailure('discard caller', source);
  });
  assert.deepEqual(result, { status: 'failed', reason: 'discard caller', source });
  assert.equal(issued, false);
  assert.equal(owner.snapshot()[0], 1);
  assert.equal(pending.signal.aborted, false);
  pending.resolve(8);
  assert.deepEqual(await retained.completion, { status: 'completed', value: 8 });
  assert.deepEqual(events, ['start retained', 'resume retained']);
});

test('cancel at commit revokes an already dispatched first segment and all serial waiters', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('serial', owner.dispatch);
  const entered = [];
  const handles = [];
  const action = owner.action((view) => {
    for (const value of [2, 3]) {
      group.start(
        view.afterCommit,
        (fresh, task) => {
          entered.push(value);
          fresh.count = value;
          return task.complete(value);
        },
        (handle) => handles.push(handle)
      );
    }
    group.cancel(view.afterCommit);
  });
  assert.equal(action.status, 'committed');
  assert.equal(handles.length, 2);
  assert.deepEqual(await Promise.all(handles.map((handle) => handle.completion)), [
    { status: 'cancelled' },
    { status: 'cancelled' },
  ]);
  assert.deepEqual(entered, []);
  assert.equal(owner.snapshot()[0], 1);
});

test('disposing the owner aborts cancellable work and detaches a late uncancellable result', async () => {
  const owner = createOwner();
  const replacement = createOwner();
  let submissions = 0;
  const group = new OwnedTaskGroup('parallel', (enter) => {
    submissions++;
    return owner.dispatch(enter);
  });
  const events = [];
  const cancellable = start(owner, group, (_view, task) =>
    task.await(
      (signal) => {
        const { promise, reject } = Promise.withResolvers();
        signal.addEventListener(
          'abort',
          () => {
            events.push('cancel extern');
            reject(signal.reason);
          },
          { once: true }
        );
        return promise;
      },
      () => assert.fail('cancelled command resumed')
    )
  );
  const late = Promise.withResolvers();
  const uncancellable = start(owner, group, (_view, task) =>
    task.await(
      () => late.promise,
      (view, current, result) => {
        events.push('late resume');
        view.count = result;
        return current.complete(result);
      }
    )
  );
  assert.equal(submissions, 2);
  group.dispose();
  owner.release();
  const freshGroup = new OwnedTaskGroup('parallel', replacement.dispatch);
  const fresh = start(replacement, freshGroup, (view, task) => {
    view.count = 4;
    return task.complete(4);
  });
  const outcomes = await Promise.all([
    cancellable.completion,
    uncancellable.completion,
    fresh.completion,
  ]);
  assert.deepEqual(outcomes, [
    { status: 'owner-ended' },
    { status: 'owner-ended' },
    { status: 'completed', value: 4 },
  ]);
  const retired = start(replacement, group, () =>
    assert.fail('retired group reused a replacement owner')
  );
  assert.deepEqual(await retired.completion, { status: 'owner-ended' });
  late.resolve(99);
  await nextTurn();
  assert.equal(
    submissions,
    2,
    'no late action was even submitted to the retired native dispatcher'
  );
  assert.deepEqual(events, ['cancel extern']);
  assert.equal(owner.snapshot()[0], 1);
  assert.equal(replacement.snapshot()[0], 4);
});

test('post-commit delivery failure preserves publication, and a rejected native defect keeps its identity', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('serial', owner.dispatch);
  const error = new Error('host listener failed');
  const failedEffect = start(owner, group, (view, task) => {
    view.count = 6;
    view.afterCommit(() => {
      throw error;
    });
    return task.complete(6);
  });
  assert.deepEqual(await failedEffect.completion, { status: 'effect-failed', errors: [error] });
  assert.equal(owner.snapshot()[0], 6);
  const defect = new Error('unexpected native rejection');
  const rejected = start(owner, group, (_view, task) =>
    task.await(
      () => Promise.reject(defect),
      () => assert.fail('unexpected resume')
    )
  );
  await assert.rejects(rejected.completion, (error) => error === defect);
  const next = start(owner, group, (_view, task) => task.complete(8));
  assert.deepEqual(await next.completion, { status: 'completed', value: 8 });
});

test('a synchronous extern failure releases work acquired during issue and preserves the committed segment', async () => {
  const owner = createOwner();
  const group = new OwnedTaskGroup('serial', owner.dispatch);
  const issueFailure = new Error('command failed after acquisition');
  const aborts = [];
  const handle = start(owner, group, (view, task) => {
    view.count = 8;
    return task.await(
      (signal) => {
        signal.addEventListener('abort', () => aborts.push(signal.reason), { once: true });
        throw issueFailure;
      },
      () => assert.fail('a failed command delivered a value')
    );
  });
  await assert.rejects(handle.completion, (error) => error === issueFailure);
  assert.deepEqual(aborts, [issueFailure]);
  assert.equal(owner.snapshot()[0], 8);
  group.dispose();
  assert.equal(aborts.length, 1);
});
