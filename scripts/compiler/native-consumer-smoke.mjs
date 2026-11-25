/** Current source -> React AST -> strict TS -> ordinary React consumer. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { observeHostCalls, calibrateHostCalls } from './host-cost-observer.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));

/** Copy actual installed packages, without source-worktree links or invented versions. */
export function copyConsumerPackages(consumer, names, from) {
  const copied = new Map();
  const copy = (name, owner) => {
    const require = createRequire(owner);
    let directory;
    try {
      directory = path.dirname(realpathSync(require.resolve(name + '/package.json')));
    } catch {
      directory = path.dirname(realpathSync(require.resolve(name)));
    }
    while (
      !existsSync(path.join(directory, 'package.json')) ||
      json(path.join(directory, 'package.json')).name !== name
    ) {
      const parent = path.dirname(directory);
      assert.notEqual(parent, directory, 'Cannot locate installed package: ' + name);
      directory = parent;
    }
    const manifest = json(path.join(directory, 'package.json'));
    if (copied.has(name)) {
      assert.equal(copied.get(name), manifest.version, 'Conflicting consumer package versions');
      return;
    }
    copied.set(name, manifest.version);
    cpSync(directory, path.join(consumer, 'node_modules', name), {
      recursive: true,
      dereference: true,
      filter: (filename) => path.basename(filename) !== 'node_modules',
    });
    for (const dependency of Object.keys(manifest.dependencies ?? {}))
      copy(dependency, path.join(directory, 'package.json'));
  };
  for (const name of names) copy(name, from);
  return Object.fromEntries(copied);
}

export const nativeConsumerSource = `import { definePrototype, tw } from '@proto.ui/core';
export default definePrototype<{ seed: number; label: string; active: boolean }>({
  name: 'ordinary-counter',
  setup(def) {
    def.props.define({seed:{type:'number',default:2},label:{type:'string',default:'Count:'},active:{type:'boolean',default:false}});
    const count = def.state.numberDiscrete('count', 0, {min:0,max:100,step:1});
    def.feedback.style.use(tw('bg-white','opacity-100'));
    def.rule({when: w => w.prop('active').eq(true), intent: i => i.feedback.style.use(tw('bg-black'))});
    def.lifecycle.onCreated(run => { count.set(run.props.get().seed ?? 0); });
    def.props.watch(['seed'], (run, next) => { count.set(next.seed ?? 0); run.update(); });
    def.event.on('host:click', () => { count.set(count.get() + 1); });
    def.event.on('host:keydown', run => { run.update(); });
    return render => render.el('button', [render.read.props.get().label, count.get()]);
  }
});`;

export async function runNativeConsumer({
  compilerEntry = process.env.NATIVE_CONSUMER_COMPILER,
  sourceRoot = repository,
} = {}) {
  const work = mkdtempSync(path.join(tmpdir(), 'proto-native-ast-consumer-'));
  const save = (name, value) =>
    writeFileSync(
      path.join(work, name),
      JSON.stringify(
        value,
        (_key, item) => (typeof item === 'bigint' ? { $bigint: String(item) } : item),
        2
      ) + '\n'
    );
  const consumer = path.join(work, 'consumer');
  mkdirSync(consumer);
  const report = {
    schema: 'proto-ui.native-ast-consumer.v1',
    evidence: work,
    target: 'react',
    scope:
      'Actual generated React component in an independent package copy and Happy DOM. No native browser, pixel, accessibility-tree, other backend or full application claim.',
    checks: [],
    ok: false,
  };
  const restorers = [];
  let window, observer;
  try {
    const api = await import(
      compilerEntry
        ? pathToFileURL(path.resolve(compilerEntry)).href
        : new URL('../../packages/compiler/src/index.ts', import.meta.url).href
    );
    assert.equal(typeof api.createCompiler, 'function');
    report.compiler = compilerEntry
      ? {
          entry: path.resolve(compilerEntry),
          build: json(path.join(path.dirname(path.resolve(compilerEntry)), 'compiler-build.json')),
        }
      : { entry: 'packages/compiler/src/index.ts', mode: 'current-worktree-source' };
    const entry = path.join(work, 'entry.proto.ts');
    writeFileSync(entry, nativeConsumerSource);
    const compiler = api.createCompiler({ rootDir: sourceRoot });
    const result = compiler.compileFile(entry, {
      target: 'react',
      componentName: 'OrdinaryCounter',
    });
    save('compilation.json', result);
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const artifact = result.value.primary.react;
    assert.deepEqual(artifact.dependencies, ['react']);
    assert.equal(result.value.llvm.emitted, false);
    report.sourceSha256 = hash(nativeConsumerSource);
    report.generatedSha256 = hash(artifact.code);
    const filename = path.join(consumer, 'OrdinaryCounter.tsx');
    writeFileSync(filename, artifact.code);
    const module = ts.createSourceFile(
      filename,
      artifact.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    assert.deepEqual(
      module.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text),
      ['react']
    );
    const owner = path.join(sourceRoot, 'packages/compiler/package.json');
    report.installedPackages = copyConsumerPackages(
      consumer,
      ['react', 'react-dom', '@types/react', '@types/react-dom'],
      owner
    );
    writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify(
        { private: true, type: 'module', dependencies: report.installedPackages },
        null,
        2
      ) + '\n'
    );
    const program = ts.createProgram([filename], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
    assert.deepEqual(diagnostics, []);
    const emit = (code, name) => {
      const compiled = ts.transpileModule(code, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        reportDiagnostics: true,
      });
      assert.deepEqual(compiled.diagnostics, []);
      const file = path.join(consumer, name + '.mjs');
      writeFileSync(file, compiled.outputText);
      return file;
    };
    const compiled = emit(artifact.code, 'OrdinaryCounter');
    report.checks.push(
      'Authored source compiled to a React-only artifact and passed strict target TypeScript checking'
    );

    const require = createRequire(path.join(sourceRoot, 'package.json'));
    const { Window } = await import(pathToFileURL(require.resolve('happy-dom')).href);
    window = new Window({ url: 'http://localhost/' });
    for (const key of [
      'window',
      'document',
      'navigator',
      'HTMLElement',
      'Element',
      'Node',
      'Event',
      'MouseEvent',
      'MutationObserver',
    ]) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
      restorers.push(() =>
        descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]
      );
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: key === 'window' ? window : window[key],
      });
    }
    const reactRequire = createRequire(path.join(consumer, 'package.json'));
    const React = reactRequire('react');
    const { createRoot } = reactRequire('react-dom/client');
    const { flushSync } = reactRequire('react-dom');
    const Component = (await import(pathToFileURL(compiled).href)).default;
    const host = window.document.createElement('div');
    window.document.body.append(host);
    observer = observeHostCalls(window, host);
    report.calibration = calibrateHostCalls(window, observer);
    const root = createRoot(host);
    const render = (props) =>
      flushSync(() =>
        root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement('aside', { key: 'native' }, 'ordinary native sibling'),
            React.createElement(Component, { key: 'first', ...props }),
            React.createElement(Component, { key: 'second', seed: 10, label: 'Other:' })
          )
        )
      );
    observer.phase('mount');
    render({});
    const buttons = () => [...host.querySelectorAll('button')];
    assert.deepEqual(
      buttons().map((item) => item.textContent),
      ['Count:2', 'Other:10']
    );
    const firstRoot = buttons()[0].parentElement;
    assert.ok(host.textContent.includes('ordinary native sibling'));
    observer.phase('interaction');
    flushSync(() => buttons()[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    assert.deepEqual(
      buttons().map((item) => item.textContent),
      ['Count:2', 'Other:10'],
      'A state write alone does not request a view update'
    );
    flushSync(() =>
      buttons()[0].dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    );
    assert.deepEqual(
      buttons().map((item) => item.textContent),
      ['Count:3', 'Other:10'],
      'An authored update publishes the latest state'
    );
    render({ seed: 7, label: 'Next:', active: true });
    assert.equal(buttons()[0].textContent, 'Next:7');
    assert.equal(buttons()[0].parentElement, firstRoot);
    assert.deepEqual(firstRoot.className.split(' ').filter(Boolean).sort(), [
      'bg-black',
      'opacity-100',
    ]);
    render({ seed: null, label: null });
    assert.equal(buttons()[0].textContent, 'Next:7');
    render({});
    assert.equal(buttons()[0].textContent, 'Count:2');
    render({ seed: undefined, label: undefined });
    assert.equal(buttons()[0].textContent, 'Next:7');
    report.checks.push(
      'Created-before-first-render, instance isolation, native click state followed by explicit keyboard update, props watch, previous-valid fallback, missing default and stable root'
    );
    report.checks.push('Authored static/rule style composition and ordinary native React sibling');
    const nativeListenerTargets = observer
      .snapshot()
      .events.filter(
        (item) =>
          item.phase === 'mount' &&
          item.operation === 'EventTarget.addEventListener' &&
          item.eventType === 'click'
      )
      .map((item) => item.target.id);
    assert.ok(
      nativeListenerTargets.length >= 2,
      'Both compiled instances installed their reached native listener'
    );
    observer.phase('dispose');
    flushSync(() => root.unmount());
    assert.equal(host.childNodes.length, 0);
    const removed = observer
      .snapshot()
      .events.filter(
        (item) =>
          item.phase === 'dispose' &&
          item.operation === 'EventTarget.removeEventListener' &&
          item.eventType === 'click'
      )
      .map((item) => item.target.id);
    for (const target of nativeListenerTargets)
      assert.ok(removed.includes(target), 'Compiled native listener survived terminal unmount');
    report.checks.push('Terminal native listener cleanup and host detachment');

    const transform = ts.transform(module, [
      (context) => (source) =>
        ts.visitNode(source, function visit(node) {
          return ts.isStringLiteral(node) && node.text === 'button'
            ? ts.factory.createStringLiteral('article')
            : ts.visitEachChild(node, visit, context);
        }),
    ]);
    const edited = ts.createPrinter().printFile(transform.transformed[0]);
    transform.dispose();
    assert.notEqual(edited, artifact.code);
    writeFileSync(path.join(consumer, 'OrdinaryCounter.edited.tsx'), edited);
    const Edited = (await import(pathToFileURL(emit(edited, 'OrdinaryCounter.edited')).href))
      .default;
    const editedRoot = createRoot(host);
    flushSync(() => editedRoot.render(React.createElement(Edited)));
    assert.equal(host.querySelector('article').textContent, 'Count:2');
    flushSync(() => editedRoot.unmount());
    assert.equal(readFileSync(entry, 'utf8'), nativeConsumerSource);
    assert.equal(readFileSync(filename, 'utf8'), artifact.code);
    report.checks.push(
      'Ordinary generated source can be edited and rebuilt; original authored and generated evidence stays unchanged'
    );
    report.hostCalls = observer.snapshot();
    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.stack : String(error);
  } finally {
    observer?.restore();
    if (window) {
      await window.happyDOM.abort();
      window.close();
    }
    for (const restore of restorers.reverse()) restore();
    save('summary.json', report);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runNativeConsumer();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
