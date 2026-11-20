import {
  createContextKey,
  defineAsHook,
  definePrototype,
  delay,
  type DelayTask,
  type OwnedStateHandle,
} from '@proto.ui/core';

const CHANNEL_A = createContextKey<{ value: number }>('native-channel-a');
const CHANNEL_B = createContextKey<{ value: number }>('native-channel-b');

const asWatched = defineAsHook<
  {},
  { write: (value: number) => void },
  { state: { n: OwnedStateHandle<number> } }
>({
  name: 'native-notification-source',
  setup(def) {
    const n = def.state.numberDiscrete('n', 0);
    def.expose.method('write', (value: number) => n.set(value));
  },
});

let sharedCount = 0;
let registerData = false;
function decide(first: number = 7, last: number): number {
  return first + last;
}
function makeCounter(seed: number) {
  const value = { count: seed };
  const alias = value;
  return {
    increment: () => {
      value.count = value.count + 1;
      return value.count;
    },
    read: () => alias.count,
    same: () => alias === value,
  };
}

export default definePrototype({
  name: 'native-ordinary-values',
  setup(def) {
    def.expose.method('decide', decide);
    registerData = !registerData;
    def.expose.value('dataRegistered', registerData);
    if (registerData) def.expose.method('conditionalDecide', decide);
    const capture = asWatched();
    const watched = capture.getState?.('n')!;
    const write = capture.getMethod?.('write') as (value: number) => void;
    let watchTrace = '';
    watched.watch((_run, event) => {
      if (event.type === 'next') {
        watchTrace = watchTrace + 'a' + event.next + ',';
        if (event.next === 1) {
          write(2);
          throw 0;
        }
      }
    });
    watched.watch((_run, event) => {
      if (event.type === 'next') watchTrace = watchTrace + 'b' + event.next + ',';
    });
    def.expose.state('watched', watched);
    def.expose.method('watchTrace', () => watchTrace);
    def.context.provide(CHANNEL_A, { value: 0 });
    def.context.provide(CHANNEL_B, { value: 0 });
    let contextTrace = '';
    def.context.subscribe(CHANNEL_A, (run, next) => {
      contextTrace = contextTrace + 'a' + next.value + ',';
      if (next.value === 1) {
        run.context.update(CHANNEL_B, { value: 1 });
        run.context.update(CHANNEL_A, { value: 2 });
        throw 0;
      }
      if (next.value === 3) cancelSecond();
      if (next.value === 5) throw 0;
    });
    const cancelSecond = def.context.subscribe(CHANNEL_A, (_run, next) => {
      contextTrace = contextTrace + 'b' + next.value + ',';
      if (next.value === 5) throw false;
    });
    def.context.subscribe(CHANNEL_B, (_run, next) => {
      contextTrace = contextTrace + 'x' + next.value + ',';
    });
    def.expose.method('contextTrace', () => contextTrace);
    def.props.define({
      contextWrite: { type: 'number', default: 0 },
      present: { type: 'boolean', default: true },
      rearmOnUnmount: { type: 'boolean', default: false },
      throwUnmount: { type: 'boolean', default: false },
      failDispose: { type: 'boolean', default: false },
    });
    def.props.watch(['contextWrite'], (run, next) =>
      run.context.update(CHANNEL_A, { value: next.contextWrite })
    );
    def.props.watch(['present'], (run, next) => run.lifecycle.setPresent(next.present));
    const counter = makeCounter(0);
    const forward = () => later();
    const later = () => 'later';
    const even = (n: number): boolean => (n === 0 ? true : odd(n - 1));
    const odd = (n: number): boolean => (n === 0 ? false : even(n - 1));
    let sequence = 0;
    const defaults = (first: number = ++sequence, second: number = first + 1) =>
      first * 10 + second;
    const defaultClosure = (read = () => later, later = 7) => read();
    let task: DelayTask | null = null;
    let completed = 0;
    const lifecycle = { first: 0, second: 0, delayed: 0 };
    def.lifecycle.onUnmounted((run) => {
      if (run.props.get().rearmOnUnmount) {
        delay(1, () => {
          lifecycle.delayed = lifecycle.delayed + 1;
        });
        if (run.props.get().throwUnmount) throw 0;
      }
    });
    def.lifecycle.onBeforeDispose((run) => {
      lifecycle.first = lifecycle.first + 1;
      if (run.props.get().failDispose) throw 0;
    });
    def.lifecycle.onBeforeDispose(() => {
      lifecycle.second = lifecycle.second + 1;
    });
    def.expose.value('lifecycle', lifecycle);
    def.expose.method('increment', () => counter.increment());
    def.expose.method('read', () => counter.read());
    def.expose.method('same', () => counter.same());
    def.expose.method('forward', forward);
    def.expose.method('even', even);
    def.expose.method('defaults', () => defaults());
    def.expose.method('explicitDefault', (value: number) => defaults(value));
    def.expose.method('defaultCapture', () => defaultClosure());
    def.expose.method('shared', () => ++sharedCount);
    def.expose.method('freezeAlias', () => {
      const value = { count: 1 };
      const alias = value;
      const frozen = Object.freeze(value);
      if (frozen !== value) return false;
      try {
        alias.count = 2;
      } catch {
        return alias.count === 1;
      }
      return false;
    });
    def.expose.method('caughtIdentity', () => {
      const expected = { name: 'example' };
      try {
        throw expected;
      } catch (error) {
        return error === expected;
      }
    });
    def.expose.method('optional', (missing: boolean) => {
      let calls = 0;
      const argument = () => {
        calls++;
        return 42;
      };
      const callback = missing ? undefined : (value: number) => value;
      const value = callback?.(argument());
      return { calls, value: value ?? -1 };
    });
    def.expose.method('spread', () => {
      const source = { first: 1, second: 2 };
      const copy = { ...source, first: 3 };
      source.second = 8;
      return {
        independent: copy.second === 2,
        overwrite: copy.first === 3,
        own: Object.hasOwn(copy, 'second'),
        finite: [1, 2, 3].every((value) => Number.isFinite(value)),
      };
    });
    def.expose.method('schedule', (duration: number) => {
      task = delay(duration, () => {
        completed++;
      });
    });
    def.expose.method('cancel', () => {
      task?.cancel();
    });
    def.expose.method('completed', () => completed);
    const publicCount = def.state.numberDiscrete('publicCount', 0);
    const controls = { increment: () => counter.increment(), read: () => counter.read() };
    const returned: { value: number; increment: () => number; pure: () => number } = {
      value: 0,
      increment: () => {
        publicCount.set(publicCount.get() + 1);
        returned.value = publicCount.get();
        return publicCount.get();
      },
      pure: () => 42,
    };
    def.expose.value('controls', controls);
    def.expose.value('controlsAlias', controls);
    def.expose.method('returnControls', () => returned);
    def.expose.method('returnFunction', () => returned.increment);
    def.expose.method('returnPure', () => returned.pure);
    return (renderer) => renderer.el('div', 'ordinary');
  },
});
