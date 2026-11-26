// Run from the repository root with: node --import tsx <this-file>
// Deliberately reentrant hosts isolate ownership; this is not native-browser evidence.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { Window } from 'happy-dom';

const repository = process.cwd();
const read = (file) => fs.readFileSync(path.join(repository, file), 'utf8');
const sourceFiles = [
  'packages/modules/feedback/src/presence/projector.ts',
  'packages/compiler/src/react-source.ts',
  'packages/compiler/src/native-rule-meta.ts',
];
console.log(
  JSON.stringify({
    kind: 'source-binding',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    sources: Object.fromEntries(
      sourceFiles.map((file) => [file, createHash('sha256').update(read(file)).digest('hex')])
    ),
  })
);

function evaluate(source, imports = {}, fileName = 'source.ts') {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const require =
    typeof imports === 'function'
      ? imports
      : (name) => {
          if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
          return imports[name];
        };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

const { createPresencePresentationProjector } = evaluate(read(sourceFiles[0]), {
  '../motion/sampler': {
    createResidentMotionSampler() {
      throw new Error('Reduced-motion probe must not construct a sampler');
    },
  },
});
for (const limit of [1, 5, 100]) {
  const outcomes = [];
  let notify = () => {},
    releases = 0,
    paints = 0,
    notifications = 0;
  const sink = createPresencePresentationProjector({
    binding: {},
    now: () => 0,
    environment: () => ({
      preference: 'reduce',
      visible: true,
      width: 120,
      height: 80,
      rootFontPx: 16,
      intrinsicBlockSize: 80,
      supported: ['blockSize'],
    }),
    subscribe(callback) {
      notify = callback;
      return () => {};
    },
    requestFrame() {
      throw new Error('Unexpected RAF');
    },
    cancelFrame() {},
    project() {
      paints++;
      return true;
    },
    release() {
      releases++;
      if (notifications < limit) {
        notifications++;
        notify();
      }
    },
  });
  sink.commit({
    view: 1,
    revision: 1,
    targetRevision: 1,
    style: {},
    owner: {
      owner: {},
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 350,
      timeoutMs: 1000,
    },
    closed: { blockSize: 0 },
    entered: { blockSize: 'intrinsic' },
    easing: [0, 0, 1, 1],
    bind() {},
    complete(_binding, outcome) {
      outcomes.push(outcome);
    },
  });
  console.log(
    JSON.stringify({
      kind: 'presence-release-notification',
      limit,
      releases,
      paints,
      notifications,
      outcomes,
    })
  );
}

const imported = (file) => import(pathToFileURL(path.join(repository, file)).href);
const { parsePrototype } = await imported('packages/compiler/src/parser.ts');
const { emitReactSource } = await imported('packages/compiler/src/react-source.ts');
const { nativeMetaArtifact, nativeMetaSubscriptionArtifact } = await imported(
  'packages/compiler/src/native-async.ts'
);
const { nativeRuleMetaArtifact } = await imported('packages/compiler/src/native-rule-meta.ts');
const win = new Window();
globalThis.window = win;
globalThis.document = win.document;
const parsed = parsePrototype(
  `import {definePrototype,delay,tw} from '@proto.ui/core';
export default definePrototype({name:'reentrant-root-review',setup(def){
  def.feedback.style.use(tw('block'));
  const owner=def.feedback.presence.owner();
  def.feedback.style.presence({owner:owner.ref,closed:{opacity:0},entered:{opacity:1},easing:[0,0,1,1]});
  def.lifecycle.onMounted(()=>{delay(10000,()=>{});});
  return r=>r.el('div','review');
}});`,
  { fileName: 'reentrant-root-review.proto.ts' }
);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
const emitted = emitReactSource(parsed.value);
if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
const files = new Map([
  ['Component.tsx', emitted.value.code + '\nexport {__puiCreateOwner as observeGeneratedOwner};'],
  ...(emitted.value.supportingFiles ?? [])
    .filter((file) => file.kind === 'source')
    .map((file) => [file.path, file.contents]),
]);
const external = createRequire(path.join(repository, 'packages/compiler/package.json'));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = evaluate(
    files.get(file),
    (name) => {
      if (!name.startsWith('.')) return external(name);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
      const found = [base, base + '.ts', base + '.tsx', base + '/index.ts'].find((candidate) =>
        files.has(candidate)
      );
      if (!found) throw new Error(`Missing artifact ${file} -> ${name}`);
      return load(found);
    },
    file
  );
  cache.set(file, exports);
  return exports;
}
const { observeGeneratedOwner } = load('Component.tsx');
const frames = [],
  owner = observeGeneratedOwner(
    {},
    (frame) => frames.push(frame),
    () => null,
    () => {}
  );
const old = win.document.createElement('div'),
  superseded = win.document.createElement('div'),
  replacement = win.document.createElement('div');
win.document.body.append(old, superseded, replacement);
owner.start();
await Promise.resolve();
owner.bindRoot(old);
owner.accept(frames.at(-1));
const before = old.getAttribute('data-pui-style');
const nativeClear = globalThis.clearTimeout;
let reentered = false,
  nestedStyle;
globalThis.clearTimeout = (ticket) => {
  nativeClear(ticket);
  if (!reentered) {
    reentered = true;
    owner.bindRoot(replacement);
    nestedStyle = replacement.getAttribute('data-pui-style');
  }
};
try {
  owner.bindRoot(superseded);
} finally {
  globalThis.clearTimeout = nativeClear;
}
console.log(
  JSON.stringify({
    kind: 'react-root-replacement',
    before,
    nestedStyle,
    reentered,
    old: old.getAttribute('data-pui-style'),
    superseded: superseded.getAttribute('data-pui-style'),
    replacement: replacement.getAttribute('data-pui-style'),
  })
);
owner.disconnect();
await Promise.resolve();

const { createNativeRuleMeta } = evaluate(nativeRuleMetaArtifact.contents, {
  './web-snapshot-v1': evaluate(nativeMetaArtifact.contents),
  './subscription-v1': evaluate(nativeMetaSubscriptionArtifact.contents),
});
function environment(width) {
  const listeners = new Set();
  const view = {
    innerWidth: width,
    addEventListener(_type, callback) {
      listeners.add(callback);
    },
    removeEventListener(_type, callback) {
      listeners.delete(callback);
      view.onRemove?.();
    },
  };
  return {
    doc: {
      defaultView: view,
      documentElement: { dataset: {}, classList: { contains: () => false } },
    },
    view,
    listeners,
  };
}
const first = environment(900),
  obsolete = environment(700),
  current = environment(500);
let doc = first.doc,
  nestedWidth;
const reader = createNativeRuleMeta(() => doc, ['viewport.width']);
const off = reader.subscribe(() => {}, ['viewport.width']);
first.view.onRemove = () => {
  first.view.onRemove = undefined;
  doc = current.doc;
  nestedWidth = reader.read('viewport.width');
};
doc = obsolete.doc;
const returnedWidth = reader.read('viewport.width');
console.log(
  JSON.stringify({
    kind: 'rule-meta-reentrant-adoption',
    nestedWidth,
    returnedWidth,
    currentWidth: doc.defaultView.innerWidth,
    obsoleteListeners: obsolete.listeners.size,
    currentListeners: current.listeners.size,
  })
);
off();
