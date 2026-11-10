import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';
import { contrastNativeJourneysPlugin } from './contrast-native-journeys-plugin.mjs';

// The controlled checks evaluate the exact self-contained source that the
// esbuild IIFE probe bundle transforms; the .mjs facade only re-exports it.
const fixturePath = new URL('./contrast-native-journeys.browser.ts', import.meta.url);
const { createHash } = await import('node:crypto');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function load(moduleURL) {
  const window = new Window();
  const document = window.document;
  window.globalThis = globalThis;
  globalThis.window = window;
  globalThis.document = document;
  globalThis.performance = window.performance;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.innerWidth = window.innerWidth;
  globalThis.innerHeight = window.innerHeight;
  const source = await readFile(moduleURL, 'utf8');
  // The browser probe bundle is a plain IIFE; the controlled check strips the
  // module-only export keyword and returns the same public observer names.
  const body = source.replace(/^export /gm, '');
  return new Function(`${body}
    ;return { CONTRAST_NATIVE_JOURNEY_STATES,
      bindContrastDialogOutside, readContrastDialogOutside,
      bindContrastHoverBridge, readContrastHoverBridge, contrastHoverLeavePoint,
      bindContrastButtonKeyboard, beginContrastButtonKey, readContrastButtonKey,
      readContrastDisabledButton, resetContrastButtonControlInputs };`)();
}

const subjectLease = { owner: 'owner-852', generation: '17' };
function subjectDOM(previewerId = 'selected', prototypes = ['brutalist-dialog-root']) {
  const previewer = document.createElement('div');
  previewer.dataset.previewerId = previewerId;
  previewer.dataset.demoId = 'audit-demo';
  previewer.dataset.runtimes = '["wc"]';
  previewer.dataset.projectionComponent = 'dialog';
  previewer.dataset.projectionFamily = 'brutalist';
  previewer.dataset.projectionState = 'ready';
  previewer.dataset.projectionRuntime = 'wc';
  const scope = document.createElement('div');
  scope.dataset.projectionScope = 'scoped';
  scope.dataset.projectionOwner = subjectLease.owner;
  scope.dataset.projectionGeneration = subjectLease.generation;
  scope.dataset.projectionFamily = 'brutalist';
  scope.dataset.projectionRuntime = 'wc';
  scope.dataset.projectionState = 'ready';
  const content = document.createElement('div');
  content.dataset.projectionContent = '';
  content.dataset.projectionOwner = subjectLease.owner;
  content.dataset.projectionGeneration = subjectLease.generation;
  content.dataset.projectionFamily = 'brutalist';
  content.dataset.projectionRuntime = 'wc';
  content.dataset.projectionId = 'content-recipe';
  content.dataset.projectionPrototype = prototypes[0];
  previewer.append(scope);
  scope.append(content);
  const mount = document.createElement('div');
  mount.dataset.demoRef = '__website_runtime_preview_surface__-mount';
  mount.dataset.projectionOwner = subjectLease.owner;
  mount.dataset.projectionGeneration = subjectLease.generation;
  mount.dataset.projectionFamily = 'brutalist';
  mount.dataset.projectionRuntime = 'wc';
  mount.setAttribute('data-passive-shell-mount', '');
  const host = document.createElement('div');
  const shell = document.createElement('div');
  shell.dataset.demoRef = '__website_runtime_preview_surface__';
  shell.dataset.projectionPrototype = 'website-runtime-preview-surface';
  shell.dataset.projectionFamily = 'brutalist';
  shell.dataset.projectionRuntime = 'wc';
  shell.dataset.projectionGeneration = '2';
  shell.setAttribute('data-pui-root', '');
  shell.classList.add('pui-runtime-preview-surface');
  const slot = document.createElement('div');
  slot.setAttribute('data-passive-shell-slot', '');
  const retained = document.createElement('div');
  retained.dataset.demoRef = '__website_runtime_preview_surface__-content';
  retained.dataset.projectionOwner = subjectLease.owner;
  retained.dataset.projectionGeneration = subjectLease.generation;
  retained.dataset.projectionFamily = 'brutalist';
  retained.dataset.projectionRuntime = 'wc';
  host.append(shell); shell.append(slot); slot.append(retained); mount.append(host); content.append(mount);
  document.body.append(previewer);
  return { previewer, retained };
}
function subject(previewer, family = 'dialog') {
  return {
    previewer,
    previewerId: 'selected',
    expected: {
      recipeId: 'audit-demo', contentRecipeId: 'content-recipe',
      shellPrototypeId: 'website-runtime-preview-surface', serializedRuntimes: '["wc"]',
      family, runtime: 'wc', rootPrototypeId: `brutalist-${family}-root`,
      prototypeIds: family === 'dialog'
        ? ['brutalist-dialog-root','brutalist-dialog-trigger','brutalist-dialog-mask','brutalist-dialog-content']
        : family === 'button'
          ? ['brutalist-button']
          : ['brutalist-hover-card-root','brutalist-hover-card-trigger','brutalist-hover-card-content'],
    },
  };
}
function rootElement(retained, prototype, attrs = {}) {
  const element = document.createElement(prototype === 'brutalist-button' ? 'button' : 'div');
  element.setAttribute('data-pui-root', '');
  element.dataset.projectionOwner = subjectLease.owner;
  element.dataset.projectionGeneration = subjectLease.generation;
  element.dataset.projectionPrototype = prototype;
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  retained.append(element);
  return element;
}
function pointProbe(api, painted = new WeakSet(), point = null) {
  globalThis.puiContrastProbe = {
    readContrastAuditSubject: (input) =>
      input.previewer.isConnected && input.previewer.dataset.previewerId === 'selected'
        ? { observation: { achieved: true }, owner: subjectLease.owner, generation: subjectLease.generation }
        : { observation: { achieved: false } },
    readContrastPaintedVisibility: (element) => ({
      visible: painted.has(element), classification: painted.has(element) ? 'source-model-visible' : 'invisible',
    }),
  };
  globalThis.puiContrastJourneys = api;
  window.document.elementFromPoint = (x, y) => point;
}
async function api() {
  return await load(fixturePath);
}
function event(window, type, init = {}) {
  const value = new window.Event(type, { bubbles: true, cancelable: true });
  for (const [key, next] of Object.entries(init)) Object.defineProperty(value, key, { value: next });
  return value;
}

test('Dialog outside press requires one verified native Mask press, complete withdrawal and exact Trigger focus', async () => {
  const api = await api();
  const { previewer, retained } = subjectDOM();
  const root = rootElement(retained, 'brutalist-dialog-root', { 'data-open': '' });
  const trigger = rootElement(retained, 'brutalist-dialog-trigger');
  const mask = rootElement(retained, 'brutalist-dialog-mask');
  const content = rootElement(retained, 'brutalist-dialog-content', { role: 'dialog', 'aria-modal': 'true', id: 'dialog-content' });
  trigger.setAttribute('aria-controls', 'dialog-content');
  // happy-dom returns zero geometry; outsidePoint needs a painted rect so its
  // candidate points have usable positive coordinates.
  content.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 300, bottom: 200, width: 200, height: 100, x: 100, y: 100 });
  const painted = new WeakSet([trigger, mask, content]);
  pointProbe(api, painted, mask);
  const binding = api.bindContrastDialogOutside({ subject: subject(previewer), root, trigger, content, mask });
  assert.ok(binding.point, 'a verified exterior point exists on the owned Mask');
  assert.equal(api.readContrastDialogOutside(binding, 'before').achieved, true);
  const press = event(window, 'pointerdown', { clientX: binding.point.x, clientY: binding.point.y, button: 0 });
  // The authored Mask requests default-action prevention on pointer.down; the
  // journey requires that authored default action to be observable.
  press.preventDefault();
  Object.defineProperty(press, 'isTrusted', { value: true });
  mask.dispatchEvent(press);
  const release = event(window, 'pointerup', { clientX: binding.point.x, clientY: binding.point.y, button: 0 });
  Object.defineProperty(release, 'isTrusted', { value: true });
  document.dispatchEvent(release);
  assert.equal(api.readContrastDialogOutside(binding, 'closed').achieved, false, 'unaccepted press cannot earn closure');
  binding.beforeAccepted = true;
  root.removeAttribute('data-open'); content.setAttribute('data-pui-view-detached',''); painted.delete(content); mask.remove(); trigger.focus();
  assert.equal(api.readContrastDialogOutside(binding, 'closed').achieved, true);
  painted.add(content); content.removeAttribute('data-pui-view-detached');
  assert.equal(api.readContrastDialogOutside(binding, 'closed').achieved, false, 'opacity-like retained Content is not complete withdrawal');
  painted.delete(content); content.setAttribute('data-pui-view-detached', '');
  document.body.focus();
  assert.equal(api.readContrastDialogOutside(binding, 'closed').achieved, false, 'another focused element cannot satisfy pointer-reason restoration');
  trigger.focus();
  const duplicate = mask.cloneNode();
  retained.append(duplicate);
  assert.equal(api.readContrastDialogOutside(binding, 'closed').achieved, false, 'a duplicate owned Mask cannot replace the original identity');
  duplicate.remove();
  painted.add(mask);
  binding.dispose();
});

test('Dialog outside accepts only the hit-tested owned Mask and rejects wrong focus/replacement', async () => {
  const api = await api();
  const { previewer, retained } = subjectDOM();
  const root = rootElement(retained, 'brutalist-dialog-root', { 'data-open': '' });
  const trigger = rootElement(retained, 'brutalist-dialog-trigger');
  const mask = rootElement(retained, 'brutalist-dialog-mask');
  const content = rootElement(retained, 'brutalist-dialog-content', { role: 'dialog', 'aria-modal': 'true', id: 'dialog-content' });
  trigger.setAttribute('aria-controls', 'dialog-content');
  const painted = new WeakSet([trigger, mask, content]);
  pointProbe(api, painted, content);
  const binding = api.bindContrastDialogOutside({ subject: subject(previewer), root, trigger, content, mask });
  assert.equal(binding.point, null, 'Content hit cannot be an exterior point');
  assert.equal(api.readContrastDialogOutside(binding, 'before').achieved, false);
  binding.dispose();
});

test('Hover bridge requires exact trusted Trigger leave to same owned Content enter, then retained and leave closure', async () => {
  const api = await api();
  const { previewer, retained } = subjectDOM();
  const root = rootElement(retained, 'brutalist-hover-card-root', { 'data-open': '' });
  const trigger = rootElement(root, 'brutalist-hover-card-trigger');
  const content = rootElement(document.body, 'brutalist-hover-card-content');
  content.getBoundingClientRect = () =>
    ({ left: 50, top: 50, right: 150, bottom: 100, width: 100, height: 50, x: 50, y: 50 });
  const painted = new WeakSet([trigger, content]);
  pointProbe(api, painted, content);
  trigger._hovered = true;
  trigger.matches = (selector) => selector === ':hover' && trigger._hovered === true;
  content.matches = (selector) => selector === ':hover' && content._hovered === true;
  const binding = api.bindContrastHoverBridge({ subject: subject(previewer, 'hover-card'), root, trigger, content });
  const before = api.readContrastHoverBridge(binding, 'before');
  assert.equal(before.achieved, true);
  binding.beforeAccepted = true;
  trigger._hovered = false;
  const leave = event(window, 'pointerleave', { clientX: 100, clientY: 75 });
  Object.defineProperty(leave, 'isTrusted', { value: true });
  trigger.dispatchEvent(leave);
  const enter = event(window, 'pointerenter', { clientX: 100, clientY: 75 });
  Object.defineProperty(enter, 'isTrusted', { value: true });
  content.dispatchEvent(enter);
  content._hovered = true;
  assert.equal(api.readContrastHoverBridge(binding, 'retained').achieved, true);
  content._hovered = false;
  const contentLeave = event(window, 'pointerleave', { clientX: 100, clientY: 75 });
  Object.defineProperty(contentLeave, 'isTrusted', { value: true });
  content.dispatchEvent(contentLeave);
  root.removeAttribute('data-open'); painted.delete(content); content.remove();
  binding.retainedAccepted = true;
  assert.equal(api.readContrastHoverBridge(binding, 'closed').achieved, true);
  const replacement = rootElement(document.body, 'brutalist-hover-card-content');
  assert.equal(api.readContrastHoverBridge(binding, 'closed').achieved, false, 'replacement cannot inherit original bridge identity');
  replacement.remove();
  const foreign = rootElement(document.body, 'brutalist-hover-card-content');
  foreign.dataset.projectionOwner = 'foreign';
  assert.equal(api.readContrastHoverBridge(binding, 'closed').achieved, false, 'foreign or duplicate leased content cannot be borrowed');
  foreign.remove();
  painted.add(content); root.setAttribute('data-open', '');
  assert.equal(api.readContrastHoverBridge(binding, 'closed').achieved, false, 'a later open cannot relabel the closed original view');
  binding.dispose();
});

test('Button Space/Enter observe outward callback exactly once, while unrelated key and disabled commands remain zero', async () => {
  const api = await api();
  const { previewer, retained } = subjectDOM();
  const button = rootElement(retained, 'brutalist-button', { 'data-demo-ref': 'solidMain' });
  const disabledA = rootElement(retained, 'brutalist-button', { 'data-demo-ref': 'disabledSolid', 'aria-disabled': 'true' });
  const disabledB = rootElement(retained, 'brutalist-button', { 'data-demo-ref': 'disabledSurface', 'aria-disabled': 'true' });
  const painted = new WeakSet([button, disabledA, disabledB]);
  pointProbe(api, painted);
  const session = { ref: 'solidMain', active: true, count: 0, deliveries: [], sourceBinding: { source: 'source', originalSHA: 'a', helperSHA: 'b' }, ctx: {
    refs: { solidMain: button }, api: { getPublicInstance: (ref) => (ref === 'solidMain' ? {} : undefined) },
  } };
  globalThis[Symbol.for('proto-ui.contrast-button-commands.v1')] = new Set([session,
    { ref: 'disabledSolid', active: true, count: 0, deliveries: [], ctx: { refs: { disabledSolid: disabledA }, api: { getPublicInstance: () => ({}) } }, sourceBinding: session.sourceBinding },
    { ref: 'disabledSurface', active: true, count: 0, deliveries: [], ctx: { refs: { disabledSurface: disabledB }, api: { getPublicInstance: () => ({}) } }, sourceBinding: session.sourceBinding },
  ]);
  const binding = api.bindContrastButtonKeyboard({ subject: subject(previewer, 'button'), button, disabled: [disabledA, disabledB] });
  button.focus();
  for (const [key, expected] of [[' ', 1], ['Enter', 2], ['a', 2]]) {
    const step = api.beginContrastButtonKey(binding, key);
    assert.equal(step.before.achieved, true);
    const down = event(window, 'keydown', { key });
    Object.defineProperty(down, 'isTrusted', { value: true });
    if (key === ' ') down.preventDefault();
    const up = event(window, 'keyup', { key }); Object.defineProperty(up, 'isTrusted', { value: true });
    button.dispatchEvent(down); button.dispatchEvent(up);
    if (key !== 'a') session.count++;
    const result = api.readContrastButtonKey({ binding, step });
    assert.equal(result.commandDelta, key === 'a' ? 0 : 1);
    assert.equal(binding.commands.session.count, expected);
    assert.equal(result.achieved, true);
  }
  const forged = api.beginContrastButtonKey(binding, 'a');
  const fakeDown = event(window, 'keydown', { key: 'a' });
  const fakeUp = event(window, 'keyup', { key: 'a' });
  button.dispatchEvent(fakeDown); button.dispatchEvent(fakeUp);
  assert.equal(api.readContrastButtonKey({ binding, step: forged }).achieved, false, 'untrusted synthetic key is not evidence');
  const domClick = api.beginContrastButtonKey(binding, 'a');
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(api.readContrastButtonKey({ binding, step: domClick }).achieved, false, 'DOM click cannot substitute for the outward command');
  binding.dispose();
  delete globalThis[Symbol.for('proto-ui.contrast-button-commands.v1')];
});

test('Opt-in Button consumer transform retains literal original and installs only public observer callbacks', async () => {
  const original = `export default {\n  type: 'demo',\n  root: {\n    kind: 'proto', prototypeId: 'brutalist-button', ref: 'solidMain', children: [\n      { kind: 'proto', prototypeId: 'brutalist-button', ref: 'disabledSolid', props: { disabled: true } },\n      { kind: 'proto', prototypeId: 'brutalist-button', ref: 'disabledSurface', props: { disabled: true } },\n    ],\n  },\n};\n`;
  const dir = '/tmp/pui852-transform-control';
  const mkdir = (await import('node:fs/promises')).mkdir;
  const write = (await import('node:fs/promises')).writeFile;
  await mkdir(`${dir}/apps/www/src/content/docs/zh-cn`, { recursive: true });
  await mkdir(`${dir}/apps/www/scripts`, { recursive: true });
  await write(`${dir}/apps/www/src/content/docs/zh-cn/demo-brutalist-button.demo.ts`, original);
  await write(`${dir}/apps/www/scripts/contrast-native-journeys.mjs`,
    await readFile(new URL('./contrast-native-journeys.mjs', import.meta.url), 'utf8'));
  const priorFlag = process.env.PROTO_UI_CONTRAST_AUDIT;
  process.env.PROTO_UI_CONTRAST_AUDIT = '1';
  try {
  const plugin = contrastNativeJourneysPlugin(dir);
  assert.ok(plugin);
  const result = plugin.transform(original, `${dir}/apps/www/src/content/docs/zh-cn/demo-brutalist-button.demo.ts`);
  assert.equal(plugin.name, 'proto-ui-contrast-native-journeys');
  assert.match(result.code, /withContrastButtonCommands/);
  assert.match(result.code, /withContrastButtonCommands\(contrastObservedButtonDemo/);
  assert.match(result.code, /originalSHA/);
  assert.equal(result.code.includes('export default {'), false);
  assert.equal((await sha(original)).length, 64);
  assert.match(result.code, new RegExp(await sha(original)));
  } finally {
    if (priorFlag === undefined) delete process.env.PROTO_UI_CONTRAST_AUDIT;
    else process.env.PROTO_UI_CONTRAST_AUDIT = priorFlag;
  }
});
