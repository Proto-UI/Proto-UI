/** Plain-Node CLI, ownership, watch and editable ordinary React consumer journey.
 * NATIVE_CONSUMER_COMPILER=/absolute/pinned/index.js node scripts/compiler/pinned-cli-smoke.mjs
 * The selected compiler must already have run its documented npm ci.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgram, copyInstalledClosure } from './native-consumer-smoke.mjs';

assert.ok(process.env.NATIVE_CONSUMER_COMPILER, 'Select the built pinned compiler');
const artifact = path.dirname(path.resolve(process.env.NATIVE_CONSUMER_COMPILER));
const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(artifact, 'cli.js');
const work = mkdtempSync(path.join(tmpdir(), 'proto-pinned-cli-'));
const source = path.join(work, 'source'),
  consumer = path.join(work, 'consumer');
mkdirSync(source);
mkdirSync(consumer);
const save = (name, value) =>
  writeFileSync(path.join(work, name), JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const summary = {
  compilerBuild: JSON.parse(readFileSync(path.join(artifact, 'compiler-build.json'), 'utf8')),
  evidence: work,
  commands: [],
  watch: [],
  ok: false,
};
console.log('PINNED_CLI_EVIDENCE', work);
const input = `import {definePrototype} from '@proto.ui/core';import {label} from './label';
export default definePrototype({name:'editable-consumer',setup(def){return r=>r.el('section',label);}});`;
writeFileSync(path.join(source, 'entry.proto.ts'), input);
writeFileSync(path.join(source, 'label.ts'), "export const label='first';\n");
const flags = ['entry.proto.ts', '--root', source, '--profile', 'react-dom-source-v1', '--json'];
function run(name, command, args, cwd, status = 0) {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(path.join(work, name + '.stdout.log'), result.stdout ?? '');
  writeFileSync(path.join(work, name + '.stderr.log'), result.stderr ?? '');
  summary.commands.push({
    name,
    command,
    args,
    cwd,
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    wallMs: performance.now() - start,
  });
  save('summary.json', summary);
  assert.equal(result.error, undefined, name);
  assert.equal(result.status, status, name + '\n' + result.stderr + '\n' + result.stdout);
  return result.stdout;
}
const invoke = (name, command, args = [], status = 0) =>
  JSON.parse(run(name, process.execPath, [cli, command, ...flags, ...args], source, status));
let watcher;
try {
  const missing = path.join(work, 'caller-parent', 'generated');
  const missingResult = invoke('missing-parent', 'compile', ['--output', missing], 1);
  assert.equal(missingResult.ok, false);
  assert.equal(existsSync(path.dirname(missing)), false);
  mkdirSync(path.dirname(missing));
  assert.equal(invoke('caller-created-parent', 'compile', ['--output', missing]).ok, true);
  const generated = path.join(consumer, 'generated');
  assert.equal(invoke('fresh', 'compile', ['--output', generated]).ok, true);
  const provenance = readFileSync(path.join(generated, 'provenance.json'));
  const historical = JSON.parse(provenance);
  assert.equal(historical.compilerBuild.revision, summary.compilerBuild.revision);
  assert.equal(invoke('unchanged-diff', 'diff', ['--output', generated]).ok, true);
  assert.equal(invoke('collision', 'compile', ['--output', generated], 1).ok, false);
  const dependencies = { react: '19.2.6', 'react-dom': '19.2.6' };
  const devDependencies = {
    typescript: '5.9.3',
    'happy-dom': '15.11.7',
    '@types/react': '19.2.14',
    '@types/react-dom': '19.2.3',
  };
  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'pinned-cli-consumer', private: true, type: 'module', dependencies, devDependencies },
      null,
      2
    )
  );
  summary.dependencies = copyInstalledClosure(consumer, dependencies, devDependencies, root);
  writeFileSync(path.join(consumer, 'build.mjs'), buildProgram);
  const runtime = `import assert from 'node:assert/strict';import {Window} from 'happy-dom';
const window=new Window({url:'http://ordinary.invalid'});
for(const key of ['window','self','document','navigator','Node','Element','HTMLElement','SVGElement','Text','Comment','Event','CustomEvent','MutationObserver'])Object.defineProperty(globalThis,key,{value:key==='window'||key==='self'?window:window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const React=await import('react');const {createRoot}=await import('react-dom/client');
const {CompiledComponent:Component}=await import('./dist/Component.js');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
try {await React.act(async()=>root.render(React.createElement(Component)));assert.equal(host.querySelector(process.argv[2]).textContent,'first');await React.act(async()=>root.unmount());assert.equal(host.childNodes.length,0);}finally{await window.happyDOM.abort();window.close();}
console.log('EDITABLE_CONSUMER_PASS',process.argv[2]);`;
  writeFileSync(path.join(consumer, 'runtime.mjs'), runtime);
  run('original-build', process.execPath, ['build.mjs'], consumer);
  run('original-runtime', process.execPath, ['runtime.mjs', 'section'], consumer);
  const component = path.join(generated, 'Component.tsx'),
    original = readFileSync(component, 'utf8');
  const edited = original.replace('"section"', '"article"');
  assert.notEqual(edited, original);
  writeFileSync(component, edited);
  const editedResult = invoke('edited-diff', 'diff', ['--output', generated], 1);
  assert.equal(editedResult.ok, true);
  assert.ok(
    editedResult.result.changes.some(
      (change) => change.path === 'Component.tsx' && change.consumerModified
    )
  );
  assert.equal(readFileSync(component, 'utf8'), edited);
  assert.deepEqual(readFileSync(path.join(generated, 'provenance.json')), provenance);
  run('edited-build', process.execPath, ['build.mjs'], consumer);
  run('edited-runtime', process.execPath, ['runtime.mjs', 'article'], consumer);
  const rebuiltMap = JSON.parse(readFileSync(path.join(consumer, 'dist/Component.js.map'), 'utf8'));
  assert.ok(rebuiltMap.sourcesContent.includes(edited));
  const historicalMap = JSON.parse(readFileSync(path.join(generated, 'Component.tsx.map'), 'utf8'));
  assert.ok(historicalMap.sourcesContent.includes(input));
  summary.ownership = {
    originalSha256: hash(original),
    editedSha256: hash(edited),
    historicalProvenanceSha256: hash(provenance),
    historicalMapsPreserved: true,
    ordinaryRebuild: true,
  };
  const output = path.join(work, 'watch');
  watcher = spawn(process.execPath, [cli, 'watch', ...flags, '--output', output], {
    cwd: source,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let pending = '',
    stderr = '';
  const waiting = [];
  watcher.stdout.on('data', (chunk) => {
    pending += chunk;
    for (;;) {
      const end = pending.indexOf('\n');
      if (end < 0) break;
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      if (line.trim()) {
        summary.watch.push(JSON.parse(line));
        save('summary.json', summary);
        for (const wake of waiting.splice(0)) wake();
      }
    }
  });
  watcher.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const next = async (after, predicate) => {
    const deadline = Date.now() + 20000;
    for (;;) {
      const found = summary.watch.find((row) => row.revision > after && predicate(row));
      if (found) return found;
      if (Date.now() > deadline) throw new Error('No matching watch revision; ' + stderr);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 100);
        waiting.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  };
  const first = await next(0, (row) => row.ok);
  const firstBytes = readFileSync(path.join(first.result.directory, 'Component.tsx'));
  writeFileSync(path.join(source, 'label.ts'), "export const label='second';\n");
  const second = await next(first.revision, (row) => row.ok);
  assert.notEqual(second.result.directory, first.result.directory);
  assert.notDeepEqual(
    readFileSync(path.join(second.result.directory, 'Component.tsx')),
    firstBytes
  );
  writeFileSync(path.join(source, 'entry.proto.ts'), 'export default ;');
  const failed = await next(second.revision, (row) => !row.ok);
  assert.equal(failed.lastSuccessful.directory, second.result.directory);
  assert.ok(failed.diagnostics.length);
  writeFileSync(path.join(source, 'entry.proto.ts'), input);
  const recovered = await next(failed.revision, (row) => row.ok);
  assert.notEqual(recovered.result.directory, second.result.directory);
  assert.deepEqual(readFileSync(path.join(first.result.directory, 'Component.tsx')), firstBytes);
  assert.equal(
    readFileSync(component, 'utf8'),
    edited,
    'Watch must preserve separately edited consumer output'
  );
  const ended = new Promise((resolve) =>
    watcher.once('close', (status, signal) => resolve({ status, signal }))
  );
  watcher.kill('SIGTERM');
  summary.watchExit = await ended;
  assert.deepEqual(summary.watchExit, { status: 143, signal: null });
  watcher = undefined;
  writeFileSync(path.join(work, 'watch.stderr.log'), stderr);
  summary.ok = true;
} catch (error) {
  summary.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
  console.error(error);
} finally {
  watcher?.kill('SIGTERM');
  save('summary.json', summary);
}
