/**
 * Count successful host API calls without replacing callbacks or host return values.
 * These are registration/creation calls, not unique live resources or heap allocations.
 * In particular duplicate listener calls and automatic once/signal cleanup stay distinct
 * from an explicit removeEventListener call. Retained observations are not a leak test.
 */
import assert from 'node:assert/strict';

export function observeHostCalls(window, consumerRoot) {
  let phase = 'harness';
  let events = [];
  const restorers = [];
  const coverage = [];
  const identities = new WeakMap();
  let nextIdentity = 0;
  function target(value) {
    if (!identities.has(value)) identities.set(value, ++nextIdentity);
    return {
      id: identities.get(value),
      kind:
        value === window
          ? 'window'
          : value === window.document
            ? 'document'
            : value === consumerRoot
              ? 'consumer-root'
              : value.nodeName
                ? `node:${value.nodeName}`
                : (value.constructor?.name ?? 'object'),
    };
  }
  function wrap(owner, name, operation, details = () => ({})) {
    // Happy DOM exposes window-bound subclasses; Web APIs may live on an ancestor.
    while (owner && !Object.hasOwn(owner, name)) owner = Object.getPrototypeOf(owner);
    const original = owner && Object.getOwnPropertyDescriptor(owner, name);
    if (typeof original?.value !== 'function') {
      coverage.push({ operation, available: false });
      return;
    }
    Object.defineProperty(owner, name, {
      ...original,
      value: function (...args) {
        const result = Reflect.apply(original.value, this, args);
        events.push({ phase, operation, target: target(this), ...details(args) });
        return result;
      },
    });
    coverage.push({ operation, available: true });
    restorers.push(() => Object.defineProperty(owner, name, original));
  }
  for (const name of ['addEventListener', 'removeEventListener']) {
    wrap(window.EventTarget?.prototype, name, `EventTarget.${name}`, ([type]) => ({
      eventType: typeof type === 'string' ? type : null,
    }));
  }
  for (const name of [
    'createElement',
    'createElementNS',
    'createTextNode',
    'createComment',
    'createDocumentFragment',
  ]) {
    wrap(window.Document?.prototype, name, `Document.${name}`);
  }
  for (const name of ['MutationObserver', 'ResizeObserver', 'IntersectionObserver']) {
    for (const method of ['observe', 'unobserve', 'disconnect']) {
      // unobserve is not part of MutationObserver; missing APIs remain explicit.
      if (name === 'MutationObserver' && method === 'unobserve') continue;
      wrap(window[name]?.prototype, method, `${name}.${method}`);
    }
  }
  for (const name of ['insertRule', 'deleteRule', 'replaceSync']) {
    wrap(window.CSSStyleSheet?.prototype, name, `CSSStyleSheet.${name}`);
  }
  return {
    phase(value) {
      phase = value;
    },
    reset() {
      events = [];
    },
    snapshot() {
      const counts = {};
      for (const event of events) {
        counts[event.phase] ??= {};
        counts[event.phase][event.operation] = (counts[event.phase][event.operation] ?? 0) + 1;
      }
      return { coverage: [...coverage], counts, events: [...events] };
    },
    restore() {
      for (const restore of restorers.splice(0).reverse()) restore();
    },
  };
}

/** Real host calibration: two duplicate add calls cause only one invocation. */
export function calibrateHostCalls(window, observer) {
  observer.phase('calibration');
  const target = new window.EventTarget();
  let invocations = 0;
  const listener = () => {
    invocations += 1;
  };
  target.addEventListener('proto-cost-calibration', listener);
  target.addEventListener('proto-cost-calibration', listener);
  target.dispatchEvent(new window.Event('proto-cost-calibration'));
  target.removeEventListener('proto-cost-calibration', listener);
  target.dispatchEvent(new window.Event('proto-cost-calibration'));
  assert.equal(invocations, 1, 'Observation must preserve real host listener identity');
  const element = window.document.createElement('div');
  const mutation = new window.MutationObserver(() => {});
  mutation.observe(element, { childList: true });
  mutation.disconnect();
  const result = observer.snapshot();
  const calls = (operation) =>
    result.events.filter(
      (event) => event.operation === operation && event.eventType === 'proto-cost-calibration'
    ).length;
  assert.equal(calls('EventTarget.addEventListener'), 2, 'Listener add observation is missing');
  assert.equal(
    calls('EventTarget.removeEventListener'),
    1,
    'Listener remove observation is missing'
  );
  assert.equal(result.counts.calibration['Document.createElement'], 1);
  assert.equal(result.counts.calibration['MutationObserver.observe'], 1);
  assert.equal(result.counts.calibration['MutationObserver.disconnect'], 1);
  observer.reset();
  observer.phase('harness');
  return { ok: true, listenerInvocations: invocations, ...result };
}
