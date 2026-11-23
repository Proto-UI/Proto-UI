import { createRequire } from 'node:module';
import { setImmediate as nextTask } from 'node:timers/promises';
const require = createRequire('/workspace/scratch/44c416809288/Proto-UI/package.json');
const { Window } = require('happy-dom');
const { retainHappyDomMutationCallbacks } = await import('/workspace/scratch/44c416809288/Proto-UI/scripts/test/happy-dom-mutation-keepalive.mjs');
for (const retain of [false, true]) {
  const view = new Window();
  const keeper = retain ? retainHappyDomMutationCallbacks(view) : null;
  const node = view.document.createElement('a');
  view.document.body.append(node);
  const observations = [];
  const observer = new view.MutationObserver((records) => observations.push(...records.map((r) => r.attributeName)));
  observer.observe(node, { attributes: true, attributeFilter: ['aria-current'] });
  node.setAttribute('aria-current', 'page');
  await view.happyDOM.whenAsyncComplete();
  for (let i = 0; i < 4; i++) { await nextTask(); global.gc(); }
  node.removeAttribute('aria-current');
  await view.happyDOM.whenAsyncComplete();
  console.log(JSON.stringify({ version: require('happy-dom/package.json').version, retain, observations }));
  observer.disconnect(); keeper?.restore(); await view.happyDOM.close();
}
