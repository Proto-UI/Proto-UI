import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import { calibrateHostCalls, observeHostCalls } from './host-cost-observer.mjs';

test('calibrates against real host effects and refuses a disabled observer', () => {
  const window = new Window();
  const observer = observeHostCalls(window, window.document.body);
  try {
    const calibrated = calibrateHostCalls(window, observer);
    assert.equal(calibrated.ok, true);
    assert.equal(calibrated.listenerInvocations, 1);
    assert.deepEqual(observer.snapshot().events, []);
    observer.restore();
    assert.throws(
      () => calibrateHostCalls(window, observer),
      /Listener add observation is missing/
    );
  } finally {
    observer.restore();
    window.close();
  }
});
