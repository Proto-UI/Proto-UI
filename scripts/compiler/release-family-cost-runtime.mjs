/** Copied unchanged into the isolated consumer; each module count uses a fresh process. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { calibrateHostCalls, observeHostCalls } from './host-cost-observer.mjs';

const count = Number(process.argv[2]);
assert.ok([0, 1, 3].includes(count));
const report = {
  ok: false,
  componentModules: count,
  surface: 'Production React in Happy DOM; fresh process and window per module count',
  observationScope:
    'Successful host API calls during module import, mount and cleanup; includes framework work and observation overhead. DOM creation calls are not all heap allocations. Listener calls are not unique live registrations. No browser latency, memory-leak or accepted budget claim.',
};
const file = `production-owner-${count}-observations.json`;
const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
const window = new Window({ url: 'http://production-observation.invalid' });
for (const key of [
  'window',
  'self',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Text',
  'Comment',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
  'DOMParser',
]) {
  Object.defineProperty(globalThis, key, {
    value: key === 'window' || key === 'self' ? window : window[key],
    configurable: true,
  });
}
const host = document.createElement('div');
document.body.append(host);
const observer = observeHostCalls(window, host);
const settle = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};
save();
try {
  report.calibration = calibrateHostCalls(window, observer);
  observer.phase('module-import');
  let start = performance.now();
  const { mount } = await import(`./production-owner-${count}.js`);
  report.moduleImportMs = performance.now() - start;
  observer.phase('mount');
  start = performance.now();
  const owner = mount(host);
  await settle();
  const deadline = performance.now() + 20000;
  while (host.querySelectorAll('[data-pui-root]').length !== count) {
    if (performance.now() >= deadline)
      throw new Error('Production owner did not commit within 20 seconds');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  report.initializationMs = performance.now() - start;
  assert.equal(owner.handles.length, count);
  for (const handle of owner.handles) assert.equal(handle.disabled.get(), false);
  report.mountedOwnerCount = count;
  report.hostCalls = observer.snapshot();
  save();
  observer.phase('cleanup');
  start = performance.now();
  owner.dispose();
  await settle();
  report.cleanupMs = performance.now() - start;
  assert.equal(host.childNodes.length, 0);
  for (const handle of owner.handles) assert.throws(() => handle.disabled.get());
  report.rootNodesAfterCleanup = host.childNodes.length;
  report.disposedHandlesRejected = count;
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  report.hostCalls = observer.snapshot();
  save();
  observer.restore();
  await window.happyDOM.abort();
  window.close();
}
