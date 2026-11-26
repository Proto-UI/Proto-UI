import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import ts from 'typescript';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { authoredKeyedTaskSource, authoredTaskPolicySource } from './fixtures/authoring-source.mjs';
import { openTabsServer } from './consumers/react/tabs-server.mjs';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function openConsumer(t, produce, client, record) {
  const retained = process.env.PROTO_UI_REACT_CONSUMER_DIR;
  if (retained) await mkdir(retained, { recursive: true });
  const directory = await mkdtemp(path.join(retained || tmpdir(), 'proto-keyed-task-react-'));
  if (!retained) t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  await mkdir(path.join(modules, '@types'), { recursive: true });
  await symlink(compiler, path.join(modules, '@proto.ui/compiler'), 'dir');
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    await symlink(path.dirname(require.resolve(`${name}/package.json`)), path.join(modules, name), 'dir');
  }
  const source = produce();
  assert.equal(source.status, 'produced', JSON.stringify(source.diagnostics));
  if (retained) await writeFile(path.join(directory, record), JSON.stringify(source));
  const bindings = { 'fixture.load-keyed-item': { module: './keyed-loader', export: 'loadKeyedItem' } };
  await writeFile(path.join(directory, `${source.component.name}.ts`), emitReact(source.component, { bindings }));
  for (const name of ['keyed-loader.ts', client]) {
    await copyFile(new URL(`./consumers/react/${name}.in`, import.meta.url), path.join(directory, name));
  }
  const app = path.join(directory, client);
  const options = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, types: [], allowImportingTsExtensions: true, strict: true, noEmit: true,
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([app], options));
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => directory, getNewLine: () => '\n',
  }));
  const bundle = await build({
    entryPoints: [app], bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  });
  if (retained) t.diagnostic(`Generated ${source.component.name} React consumer: ${directory}`);
  const server = await openTabsServer(t);
  const browser = await chromium.launch({ executablePath: process.env.PUI_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.origin);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return { server, page, errors, evidence: retained ? directory : null };
}

async function enqueue(page, key, resource, cancellable = true) {
  await page.evaluate(({ key, path, cancellable }) => window.keyedLifetime.enqueue(key, path, cancellable), {
    key, path: resource.path, cancellable,
  });
}

async function expectRows(page, texts, { connected = true, visible = true } = {}) {
  const observed = await page.waitForFunction(({ texts, connected, visible }) => {
    const view = window.keyedLifetime.snapshot();
    return view.rows.length === texts.length && view.rows.every((row, i) =>
      row.text === texts[i] && row.connected === connected && row.visible === visible) && view;
  }, { texts, connected, visible });
  try {
    const view = await observed.jsonValue();
    assert.deepEqual(view.rows.map(row => row.tag), texts.map(() => 'span'));
    return view;
  } finally { await observed.dispose(); }
}

async function history(page) {
  const { unexpected, requests } = await page.evaluate(() => window.keyedLifetime.history());
  assert.deepEqual(unexpected, []);
  const byPath = new Map(requests.map(request => [request.path, request]));
  assert.equal(byPath.size, requests.length, 'each scheduled resource has one load');
  return byPath;
}

async function afterDelivery(page, resource, state) {
  await page.waitForFunction(({ path, state }) =>
    window.keyedLifetime.history().requests.some(request => request.path === path && request.state === state),
  { path: resource.path, state });
  // Let the fetch promise's reactions and the following native frame run before sampling the view.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

function nodes(view) { return view.rows.map(row => row.node); }

function expectPending(byPath, resource) {
  const request = byPath.get(resource.path);
  assert.ok(request, resource.path);
  assert.deepEqual([request.state, request.aborted, request.reason], ['pending', false, null]);
}

test('authored keyed children retain tasks through reorder and host moves and reject a retired incarnation’s response', async t => {
  const { server, page, errors, evidence } = await openConsumer(t, authoredKeyedTaskSource, 'keyed-task-client.tsx', 'keyed-task-owner-source.json');

  const oldA = server.resource('A', 'obsolete A');
  const b = server.resource('B', 'B file');
  const c = server.resource('C', 'withdrawn C');
  const newA = server.resource('A', 'fresh A');
  const aLeft = 'A:left/left/pending';
  const bLeft = 'B:left/left/pending';
  const cLeft = 'C:left/left/pending';
  const bReady = 'B:left/right/B file@left>right';
  const aReady = 'A:right/right/fresh A@right>right';
  const detached = { connected: false, visible: false };
  const ended = { status: 'owner-ended' };

  // The first A ignores abort and will deliver its real body after its successor has committed.
  await enqueue(page, 'A', oldA, false);
  await enqueue(page, 'B', b);
  await page.evaluate(() => window.keyedLifetime.mount());
  assert.deepEqual(await Promise.all([oldA.requested(), b.requested()]), ['A', 'B']);
  const initial = await expectRows(page, [aLeft, bLeft]);
  const [oldANode, bNode] = nodes(initial);
  assert.notEqual(oldANode, bNode);
  assert.equal(initial.physicalSlot, 'physical-left');
  assert.equal(initial.activeZone, 'original');
  await page.evaluate(() => window.keyedLifetime.order('B', 'A'));
  const reordered = await expectRows(page, [bLeft, aLeft]);
  assert.deepEqual(nodes(reordered), [bNode, oldANode]);
  const bothPending = await history(page);
  assert.equal(bothPending.size, 2);
  expectPending(bothPending, b);
  expectPending(bothPending, oldA);

  await enqueue(page, 'C', c);
  await page.evaluate(() => window.keyedLifetime.order('B', 'C'));
  assert.equal(await c.requested(), 'C');
  const retired = await expectRows(page, [bLeft, cLeft]);
  const cNode = retired.rows[1].node;
  assert.equal(retired.rows[0].node, bNode);
  assert.ok(![oldANode, bNode].includes(cNode));
  assert.deepEqual(await page.evaluate(id => window.keyedLifetime.location(id), oldANode), { connected: false, inTarget: false });
  const removedA = await history(page);
  assert.deepEqual(removedA.get(oldA.path).reason, ended);
  assert.equal(removedA.get(oldA.path).state, 'pending');
  expectPending(removedA, b);
  expectPending(removedA, c);

  await page.evaluate(() => window.keyedLifetime.hide(true));
  const hidden = await expectRows(page, [bLeft, cLeft], { visible: false });
  await page.evaluate(() => window.keyedLifetime.hide(false));
  const shown = await expectRows(page, [bLeft, cLeft]);
  await page.evaluate(() => window.keyedLifetime.detach());
  const offscreen = await expectRows(page, [bLeft, cLeft], detached);
  assert.equal(offscreen.physicalSlot, null);
  for (const view of [hidden, shown, offscreen]) assert.deepEqual(nodes(view), [bNode, cNode]);
  const held = await history(page);
  assert.equal(held.size, 3);
  expectPending(held, b);
  expectPending(held, c);

  // Rebind equal-valued cells, then positively observe each independent publication in the host.
  await page.evaluate(() => window.keyedLifetime.replaceZone());
  await page.evaluate(() => window.keyedLifetime.publish('original', 'old-cell-only'));
  await page.waitForFunction(() => window.keyedLifetime.snapshot().originalZone === 'old-cell-only');
  const switched = await expectRows(page, [bLeft, cLeft], detached);
  assert.equal(switched.activeZone, 'replacement');
  assert.equal(switched.replacementZone, 'left');
  await page.evaluate(() => window.keyedLifetime.publish('replacement', 'right'));
  const rebound = await expectRows(page, ['B:left/right/pending', 'C:left/right/pending'], detached);
  assert.deepEqual(nodes(rebound), [bNode, cNode]);
  assert.equal(rebound.originalZone, 'old-cell-only');
  assert.equal(rebound.replacementZone, 'right');
  b.release();
  const detachedCommit = await expectRows(page, [bReady, 'C:left/right/pending'], detached);
  assert.deepEqual(nodes(detachedCommit), [bNode, cNode]);
  await page.evaluate(() => window.keyedLifetime.attachOnRight());
  const moved = await expectRows(page, [bReady, 'C:left/right/pending']);
  assert.deepEqual(nodes(moved), [bNode, cNode]);
  assert.equal(moved.physicalSlot, 'physical-right');
  assert.ok(moved.rows[0].top > initial.rows[1].top, 'the retained B span moved to the second physical slot');

  await enqueue(page, 'A', newA);
  await page.evaluate(() => window.keyedLifetime.order('A', 'B'));
  assert.equal(await newA.requested(), 'A');
  const replacement = await expectRows(page, ['A:right/right/pending', bReady]);
  const newANode = replacement.rows[0].node;
  assert.ok(![oldANode, bNode, cNode].includes(newANode));
  assert.equal(replacement.rows[1].node, bNode);
  assert.deepEqual(await page.evaluate(id => window.keyedLifetime.location(id), cNode), { connected: false, inTarget: false });
  assert.deepEqual(await c.closed(), { finished: false });
  await afterDelivery(page, c, 'rejected');
  newA.release();
  const freshCommit = await expectRows(page, [aReady, bReady]);
  oldA.release();
  await afterDelivery(page, oldA, 'returned');
  const lateCommit = await expectRows(page, [aReady, bReady]);
  assert.deepEqual(nodes(freshCommit), [newANode, bNode]);
  assert.deepEqual(nodes(lateCommit), [newANode, bNode]);

  // A subsequent publication rereads both fields from the two surviving native instances.
  await page.evaluate(() => window.keyedLifetime.publish('replacement', 'after'));
  const final = await expectRows(page, ['A:right/after/fresh A@right>right', 'B:left/after/B file@left>right']);
  assert.deepEqual(nodes(final), [newANode, bNode]);
  const views = { initial, reordered, retired, hidden, shown, offscreen, switched, rebound, detachedCommit, moved, replacement, freshCommit, lateCommit, final };
  for (const view of Object.values(views)) assert.equal(view.owner, initial.owner);
  const network = await history(page);
  assert.equal(network.size, 4);
  for (const [resource, key, state, value, reason] of [
    [oldA, 'A', 'returned', 'obsolete A', ended], [b, 'B', 'returned', 'B file', null],
    [c, 'C', 'rejected', null, ended], [newA, 'A', 'returned', 'fresh A', null],
  ]) {
    assert.equal(resource.requests, 1);
    assert.deepEqual(network.get(resource.path), { key, path: resource.path, state, value, aborted: reason !== null, reason });
  }
  assert.deepEqual(errors, []);
  if (evidence) await writeFile(path.join(evidence, 'keyed-react-native.json'), JSON.stringify({ views, requests: [...network.values()], errors }));
});

async function expectPolicyView(page, ordered, parallel) {
  const label = `${ordered} | ${parallel}`.trim();
  const result = await page.waitForFunction(expected => {
    const view = window.policyTrace.snapshot();
    return view.visible && view.ordered === expected.ordered && view.parallel === expected.parallel && view.label === expected.label && view;
  }, { ordered, parallel, label });
  try { return await result.jsonValue(); } finally { await result.dispose(); }
}

test('authored serial and parallel tasks read Context on entry and resumption and retire with their keyed owner', async t => {
  const { server, page, errors, evidence } = await openConsumer(t, authoredTaskPolicySource, 'task-policies-client.tsx', 'task-policy-source.json');
  const orderedA = server.resource('A', 'Obsolete amber record');
  const orderedB = server.resource('B', 'Blue retained file');
  const parallelC = server.resource('C', 'Temporary chart');
  const parallelA = server.resource('A', 'Apricot replacement');
  const initial = await page.evaluate(paths => {
    const host = window.policyTrace;
    host.mount();
    for (const [id, path] of paths) host.enqueue(id, path, false);
    return [host.queue('A'), host.queue('B'), host.submit('C'), host.submit('A')];
  }, [['A', orderedA.path], ['B', orderedB.path], ['C', parallelC.path], ['A', parallelA.path]]);
  assert.deepEqual(initial, Array(4).fill('committed'));
  assert.deepEqual(await Promise.all([orderedA.requested(), parallelC.requested(), parallelA.requested()]), ['A', 'C', 'A']);
  const issued = await page.evaluate(() => window.policyTrace.history());
  assert.deepEqual(issued.requests.map(r => r.path).sort(), [orderedA.path, parallelC.path, parallelA.path].sort());
  assert.equal(orderedB.requests, 0);
  const views = [await expectPolicyView(page, '', '')];

  await page.evaluate(() => window.policyTrace.publish('right'));
  parallelA.release();
  const p1 = 'A@left>right=Apricot replacement;';
  views.push(await expectPolicyView(page, '', p1));
  assert.equal(orderedB.requests, 0);
  orderedA.release();
  assert.equal(await orderedB.requested(), 'B');
  const s1 = 'A@left>right=Obsolete amber record;';
  views.push(await expectPolicyView(page, s1, p1));
  await page.evaluate(() => window.policyTrace.publish('last'));
  parallelC.release();
  const p2 = p1 + 'C@left>last=Temporary chart;';
  views.push(await expectPolicyView(page, s1, p2));
  orderedB.release();
  const s2 = s1 + 'B@right>last=Blue retained file;';
  const completed = await expectPolicyView(page, s2, p2);
  views.push(completed);

  const ending = server.resource('D', 'old serial');
  const queued = server.resource('E', 'old queued');
  const late = server.resource('F', 'old parallel');
  assert.deepEqual(await page.evaluate(([ending, queued, late]) => {
    const host = window.policyTrace;
    host.replaceOnReturn('D', ending, 'replacement');
    host.enqueue('E', queued, false);
    host.enqueue('F', late, false);
    return [host.queue('D'), host.queue('E'), host.submit('F')];
  }, [ending.path, queued.path, late.path]), Array(3).fill('committed'));
  assert.deepEqual(await Promise.all([ending.requested(), late.requested()]), ['D', 'F']);
  ending.release();
  await page.waitForFunction(() => window.policyTrace.retirement() !== null);
  const retired = await page.evaluate(() => window.policyTrace.retirement());
  assert.equal(retired.value, 'old serial');
  assert.deepEqual(retired.before, completed);
  assert.equal(retired.originalConnected, false);
  assert.equal(retired.oldAction, 'disposed');
  assert.deepEqual(retired.after, await expectPolicyView(page, '', ''));
  for (const [resource, state, value] of [[ending, 'returned', 'old serial'], [late, 'pending', null]]) {
    const request = retired.requests.requests.find(row => row.path === resource.path);
    assert.ok(request);
    assert.deepEqual([request.state, request.value, request.aborted, request.reason], [state, value, true, { status: 'owner-ended' }]);
  }

  const freshD = server.resource('D', 'new serial');
  const freshF = server.resource('F', 'new parallel');
  assert.deepEqual(await page.evaluate(([d, f]) => {
    const host = window.policyTrace;
    host.enqueue('D', d, false);
    host.enqueue('F', f, false);
    return [host.queue('D'), host.submit('F')];
  }, [freshD.path, freshF.path]), ['committed', 'committed']);
  assert.deepEqual(await Promise.all([freshD.requested(), freshF.requested()]), ['D', 'F']);
  freshD.release();
  const freshOrdered = 'D@replacement>replacement=new serial;';
  views.push(await expectPolicyView(page, freshOrdered, ''));
  late.release();
  await page.waitForFunction(path => window.policyTrace.history().requests.some(r => r.path === path && r.state === 'returned'), late.path);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  views.push(await expectPolicyView(page, freshOrdered, ''));
  freshF.release();
  views.push(await expectPolicyView(page, freshOrdered, 'F@replacement>replacement=new parallel;'));

  const network = await page.evaluate(() => window.policyTrace.history());
  const started = [orderedA, orderedB, parallelC, parallelA, ending, late, freshD, freshF];
  assert.deepEqual(network.requests.map(r => r.path).sort(), started.map(r => r.path).sort());
  assert.ok(started.every(r => r.requests === 1));
  assert.equal(queued.requests, 0);
  assert.deepEqual(network.unexpected, []);
  assert.deepEqual(errors, []);
  if (evidence) await writeFile(path.join(evidence, 'task-policies-react-native.json'), JSON.stringify({ views, issued, retired, network, errors }));
});

test('replacing the whole keyed parent retires a returned response and a pending sibling before either can publish', async t => {
  const { server, page, errors, evidence } = await openConsumer(t, authoredKeyedTaskSource, 'keyed-task-client.tsx', 'keyed-parent-source.json');
  const oldA = server.resource('A', 'Obsolete amber record');
  const oldB = server.resource('B', 'Blue retained file');
  const freshA = server.resource('A', 'Apricot replacement');
  const freshB = server.resource('B', 'Fresh blue file');
  const left = ['A:left/left/pending', 'B:left/left/pending'];
  const right = ['A:right/right/pending', 'B:right/right/pending'];
  const aReady = 'A:right/right/Apricot replacement@right>right';
  const bReady = 'B:right/right/Fresh blue file@right>right';

  await page.evaluate(path => window.keyedLifetime.replaceParentAfterReturn('A', path), oldA.path);
  await enqueue(page, 'B', oldB, false);
  await page.evaluate(() => window.keyedLifetime.mount());
  assert.deepEqual(await Promise.all([oldA.requested(), oldB.requested()]), ['A', 'B']);
  const initial = await expectRows(page, left);
  const oldNodes = nodes(initial);
  await page.evaluate(() => window.keyedLifetime.detach());
  const detached = await expectRows(page, left, { connected: false, visible: false });
  assert.equal(detached.owner, initial.owner);
  assert.deepEqual(nodes(detached), oldNodes);
  const pending = await history(page);
  expectPending(pending, oldA);
  expectPending(pending, oldB);
  await page.evaluate(() => {
    window.keyedLifetime.publish('replacement', 'right');
    window.keyedLifetime.attachOnRight();
  });
  await page.waitForFunction(() => window.keyedLifetime.snapshot().replacementZone === 'right');
  assert.deepEqual(nodes(await expectRows(page, left)), oldNodes);
  await enqueue(page, 'A', freshA);
  await enqueue(page, 'B', freshB);
  oldA.release();
  assert.deepEqual(await Promise.all([freshA.requested(), freshB.requested()]), ['A', 'B']);
  const replacement = await page.evaluate(() => window.keyedLifetime.replacement());
  assert.equal(replacement.value, 'Obsolete amber record');
  const { before, after } = replacement;
  assert.equal(before.view.owner, initial.owner);
  assert.deepEqual(nodes(before.view), oldNodes);
  assert.deepEqual(before.view.rows.map(row => row.text), left);
  assert.equal(before.view.activeZone, 'original');
  assert.equal(after.view.activeZone, 'replacement');
  assert.notEqual(after.view.owner, initial.owner);
  assert.deepEqual(after.view.rows.map(row => row.text), right);
  const freshNodes = nodes(after.view);
  assert.equal(new Set([...oldNodes, ...freshNodes]).size, 4);
  for (const [sample, aborted] of [[before, false], [after, true]]) {
    const reason = aborted ? { status: 'owner-ended' } : null;
    for (const [resource, state, value] of [[oldA, 'returned', 'Obsolete amber record'], [oldB, 'pending', null]]) {
      const request = sample.network.requests.find(row => row.path === resource.path);
      assert.deepEqual([request.state, request.value, request.aborted, request.reason], [state, value, aborted, reason]);
    }
  }

  freshA.release();
  assert.deepEqual(nodes(await expectRows(page, [aReady, right[1]])), freshNodes);
  oldB.release();
  await afterDelivery(page, oldB, 'returned');
  const afterLateB = await expectRows(page, [aReady, right[1]]);
  assert.deepEqual(nodes(afterLateB), freshNodes);
  const afterLateRequests = await history(page);
  assert.deepEqual(afterLateRequests.get(oldB.path), { key: 'B', path: oldB.path, state: 'returned', value: 'Blue retained file', aborted: true, reason: { status: 'owner-ended' } });
  expectPending(afterLateRequests, freshB);
  freshB.release();
  const completed = await expectRows(page, [aReady, bReady]);
  assert.deepEqual(nodes(completed), freshNodes);
  const retained = await page.evaluate(ids => ids.map(id => ({ ...window.keyedLifetime.location(id), text: window.keyedLifetime.retainedText(id) })), oldNodes);
  assert.deepEqual(retained, left.map(text => ({ connected: false, inTarget: false, text })));
  const network = await history(page);
  assert.equal(network.size, 4);
  assert.ok([oldA, oldB, freshA, freshB].every(resource => resource.requests === 1));
  assert.deepEqual(errors, []);
  if (evidence) await writeFile(path.join(evidence, 'keyed-parent-react-native.json'), JSON.stringify({ initial, detached, replacement, afterLateB, completed, retained, requests: [...network.values()], errors }));
});
