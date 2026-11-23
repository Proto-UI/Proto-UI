import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Window } from '/workspace/scratch/44c416809288/s2-input/node_modules/happy-dom/lib/index.js';
import { CapsVault, SYS_CAP } from '/workspace/scratch/44c416809288/s2-input/packages/modules/base/src/index.ts';
import { declareTextControl } from '/workspace/scratch/44c416809288/s2-input/packages/modules/text-control/src/declaration.ts';
import { createWebTextControlHost } from '/workspace/scratch/44c416809288/s2-input/packages/modules/text-control/src/web.ts';
import { TEXT_CONTROL_HOST_CAP } from '/workspace/scratch/44c416809288/s2-input/packages/modules/text-control/src/caps.ts';

const sourceCommit = process.env.PUI_REVIEW_TEXT_CONTROL_REVISION ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: '/workspace/scratch/44c416809288/s2-input', encoding: 'utf8' }).trim();
const implementation = process.env.PUI_REVIEW_TEXT_CONTROL_IMPL ?? '/workspace/scratch/44c416809288/s2-input/packages/modules/text-control/src/impl.ts';
const { TextControlModuleImpl } = await import(pathToFileURL(implementation).href);
console.log('TEXT_CONTROL_REVIEW_SOURCE', sourceCommit, implementation);

const window = new Window({ url: 'http://text-control-review.invalid' });
const results = [];
function mount(type, callback) {
  let phase = 'setup';
  const run = {};
  const sys = {
    execPhase: () => phase, domain: () => phase === 'setup' ? 'setup' : 'runtime',
    protoPhase: () => 'mounted', instancePhase: () => 'alive', mountPhase: () => 'mounted',
    isDisposed: () => false, ensureNotDisposed() {},
    ensureExecPhase() {}, ensureRuntime() {},
    ensureSetup() { assert.equal(phase, 'setup'); },
    ensureCallback() { assert.equal(phase, 'callback'); },
    getCallbackCtx: () => phase === 'callback' ? run : undefined,
  };
  const vault = new CapsVault();
  vault.attachBase([[SYS_CAP, sys]]);
  const editor = window.document.createElement('input');
  window.document.body.append(editor);
  let connection;
  const host = createWebTextControlHost(() => editor);
  vault.attach([[TEXT_CONTROL_HOST_CAP, { attach(next) { connection = next; return host.attach(next); } }]]);
  const module = new TextControlModuleImpl(vault, 'review-input', [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })]);
  const control = module.declare();
  control.on(type, (_run, event) => callback({ control, editor, module, event }));
  module.onMountPhase('mounted', 1);
  phase = 'callback';
  control.sync({ valueMode: 'controlled', value: '1234' });
  return { control, editor, module, send() {
    editor.value = '56'; editor.setSelectionRange(2, 2);
    connection.onEvent({ type, value: editor.value, composing: false, data: null, inputType: null, selection: { start: 2, end: 2, direction: 'none' } });
  }, dispose() { module.dispose(); editor.remove(); } };
}
for (const type of ['input', 'change', 'compositionend']) {
  for (const mode of ['same-owner', 'accept', 'new-owner', 'change-back', 'throw-then-recover', 'replace-lease']) {
    const during = [];
    const m = mount(type, ({ control, editor, module, event }) => {
      control.sync({ value: '1234', readOnly: false });
      during.push({ stage: 'unchanged', value: editor.value, caret: editor.selectionStart });
      if (mode === 'accept') control.sync({ value: event.value });
      if (mode === 'new-owner' || mode === 'change-back') {
        control.sync({ value: '90' });
        during.push({ stage: 'new owner', value: editor.value, canonical: control.snapshot().value });
      }
      if (mode === 'change-back') {
        control.sync({ value: '1234' });
        during.push({ stage: 'return to original owner', value: editor.value, canonical: control.snapshot().value });
      }
      if (mode === 'replace-lease') {
        module.onMountPhase('detached', 1); module.onMountPhase('mounted', 2);
        control.sync({ value: 'replacement' });
      }
      if (mode === 'throw-then-recover') throw new Error('authored callback failed');
    });
    try {
      if (mode === 'throw-then-recover') {
        assert.throws(() => m.send(), /authored callback failed/);
        m.control.sync({ value: 'recovery' });
      } else m.send();
      assert.deepEqual(during[0], { stage: 'unchanged', value: '56', caret: 2 });
      if (mode === 'new-owner' || mode === 'change-back')
        assert.deepEqual(during[1], { stage: 'new owner', value: '90', canonical: '90' });
      if (mode === 'change-back')
        assert.deepEqual(during[2], { stage: 'return to original owner', value: '1234', canonical: '1234' });
      await Promise.resolve(); await Promise.resolve();
      const expected = mode === 'accept' ? '56' : mode === 'new-owner' ? '90' : mode === 'throw-then-recover' ? 'recovery' : mode === 'replace-lease' ? 'replacement' : '1234';
      assert.equal(m.editor.value, expected);
      assert.equal(m.control.snapshot().value, expected);
      if (mode === 'accept') assert.equal(m.editor.selectionStart, 2);
      results.push({ type, mode, during, final: { value: m.editor.value, caret: m.editor.selectionStart }, ok: true });
    } finally { m.dispose(); }
  }
}
await window.happyDOM.abort(); window.close();
const report = { ok: true, sourceCommit, surface: 'Real TextControl module and Web host on Happy DOM; manually delivered portable events, not trusted browser input', results };
writeFileSync('/workspace/scratch/44c416809288/evidence/text-control-candidate-review-probe.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: report.ok, cases: results.length, immediateChangeBack: results.filter(row => row.mode === 'change-back').map(({ type, during, final }) => ({ type, during, final })) }, null, 2));
