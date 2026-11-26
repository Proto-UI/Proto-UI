import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repository = '/workspace/scratch/44c416809288/s2-compiler';
const require = createRequire(`${repository}/package.json`);
const ts = require('typescript');
const revisions = process.argv.slice(2);
if (!revisions.length) throw new Error('Supply the exact reviewed commit IDs.');
const url = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
for (const revision of revisions) {
  const source = execFileSync('git', ['show', `${revision}:packages/compiler/src/native-async.ts`], { cwd: repository, encoding: 'utf8' });
  const module = { exports: {} };
  new Function('exports', 'require', 'module', ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText)(module.exports, require, module);
  const artifacts = module.exports;
  let preference = artifacts.nativeRulePreferenceArtifact.contents;
  if (artifacts.nativeMetaSubscriptionArtifact) preference = preference.replace("'./subscription-v1'", JSON.stringify(url(artifacts.nativeMetaSubscriptionArtifact.contents)));
  const { subscribeNativeRulePreferences: subscribe, readNativeRulePreference: read } = await import(url(preference));
  const key = 'preference.reducedMotion';
  const records = [];
  const doc = { defaultView: { matchMedia(query) {
    const modern = new Set(), legacy = new Set();
    records.push({ modern, legacy });
    return { matches: query.includes(': reduce)'), addEventListener(_type, fn) { modern.add(fn); },
      addListener(fn) { legacy.add(fn); }, removeListener(fn) { legacy.delete(fn); } };
  } } };
  const release = subscribe(doc, [key], () => {});
  const counts = () => records.map(record => ({ modern: record.modern.size, legacy: record.legacy.size }));
  const acquired = counts();
  release();
  console.log(JSON.stringify({ revision, probe: 'complete-pair-with-partial-modern', acquired, released: counts(), readAfterRelease: read(doc, key) }));

  const definitions = {
    'preference.reducedMotion': ['prefers-reduced-motion', ['no-preference', 'reduce']],
    'preference.reducedTransparency': ['prefers-reduced-transparency', ['no-preference', 'reduce']],
    'preference.contrast': ['prefers-contrast', ['no-preference', 'less', 'more', 'custom']],
    'preference.forcedColors': ['forced-colors', ['none', 'active']],
  };
  const keys = Object.keys(definitions), values = new Map(), queries = new Map();
  for (const [feature, names] of Object.values(definitions)) values.set(`(${feature}: ${names[0]})`, true);
  const fullDoc = { defaultView: { matchMedia(query) {
    if (!queries.has(query)) {
      const callbacks = new Set();
      const mql = { get matches() { return values.get(query) ?? false; },
        addEventListener(_type, fn) { callbacks.add(fn); }, removeEventListener(_type, fn) { callbacks.delete(fn); } };
      queries.set(query, { callbacks, mql });
    }
    return queries.get(query).mql;
  } } };
  const live = () => [...queries.values()].reduce((sum, item) => sum + item.callbacks.size, 0);
  const snapshot = () => Object.fromEntries(keys.map(name => [name, read(fullDoc, name)]));
  assert.ok(Object.values(snapshot()).every(value => value === 'unknown'));
  let notified = 0;
  const releaseA = subscribe(fullDoc, keys, () => ++notified), releaseB = subscribe(fullDoc, keys, () => {});
  assert.equal(live(), 10);
  assert.deepEqual(Object.values(snapshot()), ['no-preference', 'no-preference', 'no-preference', 'none']);
  values.clear();
  for (const [feature, names] of Object.values(definitions)) values.set(`(${feature}: ${names.at(-1)})`, true);
  const stale = [...queries.values()].flatMap(item => [...item.callbacks]);
  stale.forEach(callback => callback());
  await flush();
  assert.deepEqual(Object.values(snapshot()), ['reduce', 'reduce', 'custom', 'active']);
  assert.equal(notified, 1);
  values.set('(prefers-contrast: more)', true);
  stale.forEach(callback => callback());
  await flush();
  assert.equal(read(fullDoc, 'preference.contrast'), 'unknown');
  releaseA(); assert.equal(live(), 10);
  releaseB(); assert.equal(live(), 0);
  const beforeLate = notified;
  stale.forEach(callback => callback());
  await flush();
  assert.equal(notified, beforeLate);
  assert.ok(Object.values(snapshot()).every(value => value === 'unknown'));
  console.log(JSON.stringify({ revision, probe: 'four-key-vocabulary-sharing-ambiguity-stale-cleanup', status: 'passed', acquiredListeners: 10, releasedListeners: live(), notifications: notified }));
}
