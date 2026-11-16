import { defineAsHook, definePrototype } from '@proto.ui/core';

const shadow = defineAsHook({
  name: 'outer',
  setup(def) {
    def.expose.value('loser', true);
  },
});
const child = defineAsHook({
  name: 'child',
  setup(def) {
    def.expose.value('childInstalled', true);
  },
});
const outer = defineAsHook({
  name: 'outer',
  setup(def) {
    const x = shadow();
    const y = shadow();
    const a = child();
    const b = child();
    def.expose.value('initialDistinct', x !== y);
    def.expose.value('initialTruthy', !!x);
    def.expose.value('nestedSame', a === b);
  },
});
export default definePrototype({
  name: 'native-pending-once',
  setup(def) {
    const a = outer();
    const b = outer();
    const c = shadow();
    const d = shadow();
    def.expose.value('completeSame', a === b);
    def.expose.value('postShadowSame', c === d);
    def.expose.value('postShadowWinner', a === c);
    return (r) => r.el('div', []);
  },
});

const failed = defineAsHook({
  name: 'failed',
  setup(def) {
    def.expose.value('attempted', true);
    throw 'setup failure';
  },
});
export const Failed = definePrototype({
  name: 'native-failed-once',
  setup(def) {
    let caught = false;
    try {
      failed();
    } catch (error) {
      caught = error === 'setup failure';
    }
    const a = failed();
    const b = failed();
    def.expose.value('caught', caught);
    def.expose.value('freshFallback', a !== b);
    def.expose.value('truthyFallback', !!a);
    return (r) => r.el('div', []);
  },
});

const undefinedProjection = defineAsHook({
  name: 'undefined-projection',
  setup() {},
  projectHandle() {
    return undefined;
  },
});
export const UndefinedProjection = definePrototype({
  name: 'native-undefined-projection',
  setup(def) {
    const first = undefinedProjection();
    const second = undefinedProjection();
    def.expose.value('undefinedFirst', first === undefined);
    def.expose.value('undefinedAgain', second === undefined);
    return (r) => r.el('div', []);
  },
});

const failedProjection = defineAsHook({
  name: 'failed-projection',
  setup() {},
  projectHandle(): { read: () => number } {
    throw 0;
  },
});
export const FailedProjection = definePrototype({
  name: 'native-failed-projection',
  setup(def) {
    let caught = false;
    try {
      failedProjection();
    } catch (error) {
      caught = error === 0;
    }
    const first = failedProjection();
    const second = failedProjection();
    def.expose.value('caught', caught);
    def.expose.value('retainedRawCapture', first === second);
    def.expose.value('truthyCapture', !!first);
    return (r) => r.el('div', []);
  },
});
