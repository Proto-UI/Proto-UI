// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type Vue2 from '../../adapters/vue2/node_modules/vue';
import type { ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { runCompilerCli } from '../src/cli';
import type { ExclusiveOutputFile } from '../src/artifact-output';
import { nativeInteractionArtifact } from '../src/native-interaction';
import { nativeAdapterModulesArtifact } from '../src/native-adapter-modules';

// Two intentionally separate executions, with the same test leaf:
// A: the fixed old emitter, PUI_NATIVE_SUPPORT_MIGRATION_STAGE=capture-old,
//    PUI_NATIVE_SUPPORT_MIGRATION_CORPUS=<fresh absolute directory>.
// B: the new emitter/CLI, PUI_NATIVE_SUPPORT_MIGRATION_STAGE=verify,
//    the same corpus mounted read-only. No hand-written generated fixture is used.
// Without a corpus override, normal CI reads the committed compact fixture made
// from that exact capture. Only known helper bytes may be reconstructed after
// matching every old hash. Old component/map/provenance bytes are always retained
// original CLI bytes, never regenerated with the new emitter. Missing evidence fails.
// These are filesystem/HappyDOM composition tests, not browser or full-profile acceptance.
const stage = process.env.PUI_NATIVE_SUPPORT_MIGRATION_STAGE ?? 'verify';
const corpusDirectory = process.env.PUI_NATIVE_SUPPORT_MIGRATION_CORPUS;
const evidenceDirectory = process.env.PUI_NATIVE_SUPPORT_MIGRATION_EVIDENCE_DIR;
const temporary: string[] = [];
const require = createRequire(import.meta.url);
const legacyHashes = {
  '.proto-ui/interaction/native-v1.ts':
    'fa24714e204980f4d8a1d4f4999f85f7722e6bcc84406bfc733029286ccc6585',
  '.proto-ui/interaction/adapter-modules-v1.ts':
    'dcbc4d2e9f1c141d8961475f8b96598d7a8096e96a49fcf95c9db3dd9747e66a',
};
const oldEmitterSHA256 = '6129be966453ad8960c1736d1b2c88c052fc8c3ff4e915e017d099df1f226474';
const sourceFixtures = {
  trigger: `import {definePrototype} from '@proto.ui/core';
import {asTrigger} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-outer-trigger',setup(def){
 asTrigger();def.expose.event('activated',{payload:'json'});
 def.event.on('press.commit',run=>{run.expose.emit('activated','outer');});
 return r=>r.el('div',[r.slot()]);
}});`,
  text: `import {definePrototype} from '@proto.ui/core';
import {asTextControl} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'ordinary-inner-editor',
 modules:[declareTextControl({content:'plain-text',lineMode:'multiline',engine:'host'})],
 setup(def){
  def.props.define({present:{type:'boolean',default:true}});
  const control=asTextControl();
  def.lifecycle.onCreated(()=>control.sync({defaultValue:'',valueMode:'uncontrolled'}));
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present);});
  def.expose.method('read',()=>control.snapshot());return()=>null;
 }});`,
  boundary: overlaySource(false),
  modal: overlaySource(true),
};
type FixtureName = keyof typeof sourceFixtures;
const fixtureNames: FixtureName[] = ['trigger', 'text', 'boundary', 'modal'];
function overlaySource(modal: boolean): string {
  return `import {definePrototype} from '@proto.ui/core';import {asOverlay} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-overlay-owner',setup(def){
 const overlay=asOverlay();overlay.configure({portal:false,defaultOpen:false,anchored:false,modal:${modal},closeOnOutsidePress:true,closeOnEscape:false,entry:'manual',restore:'none'});
 def.expose.method('open',()=>overlay.openOverlay());def.expose.method('close',()=>overlay.close());
 def.expose.method('isOpen',()=>overlay.isOpen());return r=>r.el('div','Overlay ownership');
}});`;
}
const digest = (contents: string | Buffer) => createHash('sha256').update(contents).digest('hex');
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error('Expected object');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  return value;
}
type HistoricalSupportArtifact = { path: string; contents: string };
async function historicalSupportArtifacts(): Promise<{
  native: HistoricalSupportArtifact;
  adapter: HistoricalSupportArtifact;
}> {
  // The capture-old source tree predates this verifier's retained payload.
  // Resolve it only in the verification stage, including Vite import analysis.
  const filename = fileURLToPath(new NodeURL('../src/native-support-legacy.ts', import.meta.url));
  const loaded: unknown = await import(/* @vite-ignore */ filename);
  const exports = object(loaded);
  const native = object(exports.legacyNativeInteractionArtifact);
  const adapter = object(exports.legacyNativeAdapterModulesArtifact);
  return {
    native: { path: string(native.path), contents: string(native.contents) },
    adapter: { path: string(adapter.path), contents: string(adapter.contents) },
  };
}
interface ArtifactRecord {
  path: string;
  kind: string;
  sha256: string;
}
interface Manifest extends Record<string, unknown> {
  artifacts: ArtifactRecord[];
}
function artifactRecords(value: unknown): ArtifactRecord[] {
  if (!Array.isArray(value)) throw new Error('Missing artifact records');
  return value.map((item) => {
    const record = object(item);
    return { path: string(record.path), kind: string(record.kind), sha256: string(record.sha256) };
  });
}
async function manifest(directory: string): Promise<Manifest> {
  const value = object(JSON.parse(await readFile(path.join(directory, 'provenance.json'), 'utf8')));
  return { ...value, artifacts: artifactRecords(value.artifacts) };
}
async function plainFiles(directory: string, relative = ''): Promise<string[]> {
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink())
    throw new Error('Expected real fixture directory');
  const files: string[] = [];
  for (const entry of (await readdir(directory)).sort()) {
    const filename = path.join(directory, entry);
    const suffix = relative ? relative + '/' + entry : entry;
    const stat = await lstat(filename);
    if (stat.isSymbolicLink()) throw new Error('Evidence cannot contain symbolic links: ' + suffix);
    if (stat.isDirectory()) files.push(...(await plainFiles(filename, suffix)));
    else if (stat.isFile()) files.push(suffix);
    else throw new Error('Evidence cannot contain special files: ' + suffix);
  }
  return files;
}
async function inventory(directory: string): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const file of await plainFiles(directory))
    values[file] = digest(await readFile(path.join(directory, file)));
  return values;
}
async function owned(directory: string): Promise<Manifest> {
  const value = await manifest(directory);
  expect(value.profile).toBe('vue2-source-v1');
  expect(value.backend).toBe('vue2-source-v1');
  const names = value.artifacts.map((file) => file.path);
  expect(new Set(names).size).toBe(names.length);
  expect((await plainFiles(directory)).sort()).toEqual([...names, 'provenance.json'].sort());
  for (const file of value.artifacts)
    expect(digest(await readFile(path.join(directory, file.path)))).toBe(file.sha256);
  return value;
}
async function fresh(label: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-migration-' + label + '-'));
  temporary.push(directory);
  return directory;
}
async function invoke(cwd: string, args: string[]) {
  let stdout = '',
    stderr = '';
  const code = await runCompilerCli(args, {
    cwd,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}
async function compileCli(root: string, name: FixtureName, directory: string) {
  await mkdir(path.join(root, 'inputs'), { recursive: true });
  const input = path.join(root, 'inputs', name + '.proto.ts');
  await writeFile(input, sourceFixtures[name]);
  const result = await invoke(root, [
    'compile',
    path.relative(root, input),
    '--profile',
    'vue2-source-v1',
    '--output',
    path.relative(root, directory),
    '--json',
  ]);
  expect(result, 'Actual compiler CLI output').toMatchObject({ code: 0, stderr: '' });
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: true,
    command: 'compile',
    result: { directory },
  });
  await owned(directory);
  return result;
}
function requiredCorpus(): string {
  if (!corpusDirectory || !path.isAbsolute(corpusDirectory))
    throw new Error(
      'PUI_NATIVE_SUPPORT_MIGRATION_CORPUS must name the exact captured old CLI corpus'
    );
  return corpusDirectory;
}
function verifyCapturedCli(record: Record<string, unknown>) {
  const cli = object(record.cli);
  expect(cli).toMatchObject({ code: 0, stderr: '' });
  expect(JSON.parse(string(cli.stdout))).toMatchObject({ ok: true, command: 'compile' });
  // Published fixture metadata may normalize temporary absolute directories.
  // The retained component/map/provenance bytes may not be normalized.
}
async function corpusForVerification(): Promise<string> {
  if (corpusDirectory) return requiredCorpus();
  const { native: legacyNativeInteractionArtifact, adapter: legacyNativeAdapterModulesArtifact } =
    await historicalSupportArtifacts();
  const fixture = fileURLToPath(
    new NodeURL('./fixtures/native-support-migration-v1.json', import.meta.url)
  );
  // Deliberately a runtime read, not an imported fixture: Stage A must execute
  // before this historical evidence exists, and must never manufacture it.
  const capture = object(JSON.parse(await readFile(fixture, 'utf8')));
  expect(capture).toMatchObject({
    version: 1,
    origin: 'actual-old-compiler-cli',
    emitterSHA256: oldEmitterSHA256,
    legacyHashes,
  });
  const provenance = object(capture.captureProvenance);
  expect(string(provenance.sourceCaptureSHA256)).toMatch(/^[a-f0-9]{64}$/);
  if (
    !Array.isArray(provenance.metadataNormalization) ||
    provenance.metadataNormalization.length === 0
  )
    throw new Error('Compact fixture must disclose its metadata normalization');
  for (const note of provenance.metadataNormalization)
    expect(string(note).length).toBeGreaterThan(0);
  const records = object(capture.records),
    restoredRecords: Record<string, unknown> = {};
  expect(Object.keys(records).sort()).toEqual([...fixtureNames].sort());
  const corpus = await fresh('historical-corpus'),
    current = await fresh('context-reference');
  const observations: Record<string, unknown> = {};
  for (const name of fixtureNames) {
    const record = object(records[name]),
      files = object(record.files),
      retained = object(record.retainedFiles);
    verifyCapturedCli(record);
    expect(record.input).toBe(sourceFixtures[name]);
    expect(record.inputSHA256).toBe(digest(sourceFixtures[name]));
    expect(Object.keys(retained).sort()).toEqual(
      ['Component.js', 'Component.js.map', 'provenance.json'].sort()
    );
    const currentOutput = path.join(current, name),
      cli = await compileCli(current, name, currentOutput);
    const directory = path.join(corpus, name);
    await mkdir(directory);
    const restored: Record<string, { sha256: string; origin: string }> = {};
    for (const [filename, expected] of Object.entries(files)) {
      let contents: string, origin: string;
      if (
        filename === 'Component.js' ||
        filename === 'Component.js.map' ||
        filename === 'provenance.json'
      ) {
        contents = string(retained[filename]);
        origin = 'retained-exact-old-cli-bytes';
      } else if (filename === nativeInteractionArtifact.path) {
        contents = legacyNativeInteractionArtifact.contents;
        origin = 'retained-exact-legacy-native-literal';
      } else if (filename === nativeAdapterModulesArtifact.path) {
        contents = legacyNativeAdapterModulesArtifact.contents;
        origin = 'retained-exact-legacy-adapter-literal';
      } else if (/^\.proto-ui\/context\/(?:scope-v1|key-[a-f0-9]{64})\.ts$/.test(filename)) {
        contents = await readFile(path.join(currentOutput, filename), 'utf8');
        origin = 'same-input-context-helper-exact-old-sha';
      } else
        throw new Error('Compact old fixture cannot reconstruct an unknown helper: ' + filename);
      // Matching current helper names is insufficient: source bytes must equal
      // the exact prior capture before they enter the reconstructed old tree.
      expect(digest(contents), name + '/' + filename).toBe(string(expected));
      const target = path.join(directory, filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, { flag: 'wx' });
      restored[filename] = { sha256: digest(contents), origin };
    }
    expect(await inventory(directory)).toEqual(files);
    await owned(directory);
    expect(digest(await readFile(path.join(directory, 'provenance.json')))).toBe(
      record.provenanceSHA256
    );
    const historicalRecord = { ...record };
    delete historicalRecord.retainedFiles;
    restoredRecords[name] = historicalRecord;
    observations[name] = { cli, restored };
  }
  // This is reconstructed/normalized capture metadata, not a byte-for-byte
  // copy of capture.json. captureProvenance retains the original capture SHA.
  await writeFile(
    path.join(corpus, 'capture.json'),
    JSON.stringify({ ...capture, records: restoredRecords }, null, 2) + '\n',
    { flag: 'wx' }
  );
  await saveEvidence('compact-fixture-reconstruction', { fixture, observations });
  return corpus;
}
async function saveEvidence(label: string, value: unknown) {
  if (!evidenceDirectory) return;
  if (!path.isAbsolute(evidenceDirectory) || !/^[a-z0-9-]+$/.test(label))
    throw new Error('Invalid evidence destination');
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, label + '.json'),
    JSON.stringify(value, null, 2) + '\n',
    { flag: 'wx' }
  );
}
async function copyEvidence(label: string, source: string) {
  if (!evidenceDirectory) return;
  if (!path.isAbsolute(evidenceDirectory) || !/^[a-z0-9-]+$/.test(label))
    throw new Error('Invalid evidence destination');
  await plainFiles(source);
  await mkdir(evidenceDirectory, { recursive: true });
  await cp(source, path.join(evidenceDirectory, label), {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
}
afterAll(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe.runIf(stage === 'capture-old')('exact old CLI corpus capture', () => {
  it('captures actual Trigger Text Boundary and Modal output directories with complete provenance', async () => {
    const destination = requiredCorpus();
    const emitterSHA256 = digest(
      await readFile(fileURLToPath(new NodeURL('../src/vue2-source.ts', import.meta.url)))
    );
    expect(emitterSHA256).toBe(oldEmitterSHA256);
    // A fresh destination makes accidentally overwriting a prior capture impossible.
    await mkdir(destination);
    const root = await fresh('capture');
    const records: Record<string, unknown> = {};
    for (const name of fixtureNames) {
      const output = path.join(root, name);
      const cli = await compileCli(root, name, output);
      for (const [file, hash] of Object.entries(legacyHashes))
        expect(digest(await readFile(path.join(output, file)))).toBe(hash);
      await cp(output, path.join(destination, name), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      records[name] = {
        input: sourceFixtures[name],
        inputSHA256: digest(sourceFixtures[name]),
        cli,
        provenanceSHA256: digest(await readFile(path.join(output, 'provenance.json'))),
        files: await inventory(output),
      };
    }
    await writeFile(
      path.join(destination, 'capture.json'),
      JSON.stringify(
        {
          version: 1,
          origin: 'actual-old-compiler-cli',
          emitterSHA256,
          legacyHashes,
          records,
        },
        null,
        2
      ) + '\n',
      { flag: 'wx' }
    );
  });
});

interface PlanInput {
  id: string;
  directory: string;
  provenanceSHA256: string;
}
interface Plan {
  version: number;
  inputs: PlanInput[];
}
let root: string, migrated: string, verifiedCorpus: string, corpusBefore: Record<string, string>;
let inputs: PlanInput[] = [];
let sourcesBefore: Record<string, Record<string, string>> = {};
async function writePlan(directory: string, value: unknown): Promise<string> {
  const filename = path.join(directory, 'plan.json');
  await writeFile(filename, JSON.stringify(value, null, 2) + '\n');
  return filename;
}
async function migrate(
  planFile: string,
  output: string,
  openExclusive?: (filename: string) => Promise<ExclusiveOutputFile>
) {
  const { migrateNativeSupport } = await import('../src/native-support-migration');
  return migrateNativeSupport(planFile, output, openExclusive);
}
async function migrationCase(
  name = 'case'
): Promise<{ directory: string; plan: Plan; planFile: string; output: string }> {
  const directory = await fresh(name);
  // Put the invalid input last: no partial output may escape prior validation.
  for (const id of ['valid', 'subject'])
    await cp(path.join(root, 'old-trigger'), path.join(directory, id), { recursive: true });
  const plan = {
    version: 1,
    inputs: await Promise.all(
      ['valid', 'subject'].map(async (id) => ({
        id,
        directory: id,
        provenanceSHA256: digest(await readFile(path.join(directory, id, 'provenance.json'))),
      }))
    ),
  };
  return {
    directory,
    plan,
    planFile: await writePlan(directory, plan),
    output: path.join(directory, 'output'),
  };
}
async function reseal(test: Awaited<ReturnType<typeof migrationCase>>, value: Manifest) {
  const filename = path.join(test.directory, 'subject', 'provenance.json');
  await writeFile(filename, JSON.stringify(value, null, 2) + '\n');
  test.plan.inputs[1].provenanceSHA256 = digest(await readFile(filename));
  await writePlan(test.directory, test.plan);
}
async function rejectedBeforeWrite(test: Awaited<ReturnType<typeof migrationCase>>, label: string) {
  let opens = 0;
  const result = await migrate(test.planFile, test.output, async (filename) => {
    opens++;
    return open(filename, 'wx');
  });
  expect(result.ok).toBe(false);
  expect(opens).toBe(0);
  await expect(lstat(test.output)).rejects.toMatchObject({ code: 'ENOENT' });
  const cli = await invoke(test.directory, [
    'migrate-native-support',
    'plan.json',
    '--output',
    'output',
    '--json',
  ]);
  expect(cli.code).toBe(1);
  expect(cli.stderr).toBe('');
  expect(JSON.parse(cli.stdout)).toMatchObject({ ok: false });
  await expect(lstat(test.output)).rejects.toMatchObject({ code: 'ENOENT' });
  await saveEvidence('reject-' + label, { result, cli, opens });
}

interface Consumer {
  Vue: typeof Vue2;
  first: ComponentOptions<Vue2>;
  second: ComponentOptions<Vue2>;
}
function assertConsumer(value: unknown): asserts value is Consumer {
  const fields = object(value);
  if (typeof fields.Vue !== 'function' || Reflect.get(fields.Vue, 'version') !== '2.6.14')
    throw new Error('Wrong Vue consumer runtime');
  for (const name of ['first', 'second']) {
    const component = object(fields[name]);
    if (typeof component.render !== 'function' || typeof component.beforeCreate !== 'function')
      throw new Error('Not actual generated component options');
  }
}
async function consumer(directory: string, first: string, second: string, label: string) {
  const buildRoot = await fresh('bundle');
  const vueEntry = createRequire(
    fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url))
  ).resolve('vue');
  const floatingEntry = createRequire(
    fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
  ).resolve('@floating-ui/dom');
  const entry = path.join(buildRoot, 'consumer.ts');
  const outfile = path.join(buildRoot, 'consumer.cjs');
  await writeFile(
    entry,
    [
      `export { default as Vue } from ${JSON.stringify(vueEntry)};`,
      `export { default as first } from ${JSON.stringify(path.join(directory, first, 'Component.js'))};`,
      `export { default as second } from ${JSON.stringify(path.join(directory, second, 'Component.js'))};`,
    ].join('\n') + '\n'
  );
  // Real esbuild filesystem resolution, no source map loader, virtual-module
  // plugin, custom require or injected registry. Vue is the ordinary external
  // target dependency; all emitted support is bundled from its physical paths.
  expect(esbuildVersion).toBe('0.25.12');
  const result = await build({
    absWorkingDir: buildRoot,
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    metafile: true,
    sourcemap: 'external',
    write: true,
    alias: { vue: vueEntry, '@floating-ui/dom': floatingEntry },
    external: [vueEntry],
    logLevel: 'silent',
  });
  const loaded: unknown = require(outfile);
  assertConsumer(loaded);
  const files = Object.keys(result.metafile.inputs).map((file) => path.resolve(buildRoot, file));
  expect(files.some((file) => file === path.join(directory, first, 'Component.js'))).toBe(true);
  expect(files.some((file) => file === path.join(directory, second, 'Component.js'))).toBe(true);
  expect(
    files.filter((file) => /packages\/(?:core|runtime|hooks|adapters)\/(?:.+\/)?src\//.test(file))
  ).toEqual([]);
  await saveEvidence(label + '-bundle', {
    esbuildVersion,
    vueEntry,
    floatingEntry,
    metafile: result.metafile,
    files,
  });
  await copyEvidence(label + '-consumer', buildRoot);
  return { ...loaded, files };
}
function method(receiver: unknown, name: string, ...args: unknown[]): unknown {
  if (!receiver || (typeof receiver !== 'object' && typeof receiver !== 'function'))
    throw new Error('Missing receiver for ' + name);
  const fn = Reflect.get(receiver, name);
  if (typeof fn !== 'function') throw new Error('Missing method ' + name);
  return Reflect.apply(fn, receiver, args);
}
async function settle(Vue: typeof Vue2) {
  for (let index = 0; index < 6; index++) await Vue.nextTick();
}
async function routing(
  directory: string,
  first: string,
  second: string,
  label: string,
  broken = false
) {
  const loaded = await consumer(directory, first, second, label);
  const Vue = loaded.Vue,
    events: unknown[] = [],
    errors: unknown[] = [];
  const previousHandler = Vue.config.errorHandler;
  const state = Vue.observable({ present: true });
  const trace: Record<string, unknown> = { files: loaded.files, broken };
  let vm: Vue2 | undefined;
  const host = document.createElement('div');
  document.body.append(host);
  const failures: unknown[] = [];
  try {
    Vue.config.errorHandler = (error) => errors.push(error);
    vm = new Vue({
      render(h) {
        return h(loaded.first, {
          on: { activated: (payload: unknown) => events.push(payload) },
          scopedSlots: { default: () => [h(loaded.second, { props: { present: state.present } })] },
        });
      },
    });
    vm.$mount();
    host.append(vm.$el);
    await settle(Vue);
    const text = host.querySelector('textarea');
    if (!text) throw new Error('Actual compiled Text root missing');
    const instance = vm.$children[0].$children.find((child) => child.$el === text);
    if (!instance) throw new Error('Actual compiled Text owner missing');
    text.value = 'filesystem edit';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(method(method(instance, 'getExposes'), 'read')).toEqual({
      value: 'filesystem edit',
      composing: false,
    });
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    trace.afterTextClick = [...events];
    if (broken) expect(events).toEqual(['outer']);
    else {
      expect(events).toEqual([]);
      for (const key of [' ', 'Enter'])
        for (const type of ['keydown', 'keyup'])
          text.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, composed: true }));
      trace.afterKeyboard = [...events];
      expect(events).toEqual([]);
      state.present = false;
      await settle(Vue);
      expect(host.querySelector('textarea')).toBe(null);
      state.present = true;
      await settle(Vue);
      const next = host.querySelector('textarea');
      expect(next).not.toBe(text);
      if (!next) throw new Error('Text did not remount');
      next.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      expect(events).toEqual([]);
      vm.$el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      trace.afterOuterClick = [...events];
      expect(events).toEqual(['outer']);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      vm?.$destroy();
    } catch (error) {
      failures.push(error);
    }
    try {
      host.remove();
    } catch (error) {
      failures.push(error);
    }
    try {
      Vue.config.errorHandler = previousHandler;
    } catch (error) {
      failures.push(error);
    }
    try {
      trace.vueErrors = errors.map((error) => String(error));
      trace.failuresBeforeCapture = failures.map((error) => String(error));
      await saveEvidence(label + '-trace', trace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (errors.length)
    failures.push(new AggregateError(errors, 'Vue routing errors, including disposal'));
  if (failures.length) throw new AggregateError(failures, 'Filesystem routing observation failed');
}
async function overlays(
  directory: string,
  first: string,
  second: string,
  label: string,
  modal: boolean,
  split: false | 'shared-ownership' | 'independent-old' = false
) {
  const loaded = await consumer(directory, first, second, label);
  const Vue = loaded.Vue,
    errors: unknown[] = [],
    failures: unknown[] = [];
  const previousHandler = Vue.config.errorHandler,
    previousStyle = document.body.style.cssText;
  const trace: Record<string, unknown> = { files: loaded.files, modal, split };
  let vm: Vue2 | undefined;
  try {
    Vue.config.errorHandler = (error) => errors.push(error);
    document.body.style.setProperty('overflow', 'auto', 'important');
    document.body.style.setProperty('padding-right', '7px', 'important');
    vm = new Vue({
      render(h) {
        return h('main', [h(loaded.first, { ref: 'first' }), h(loaded.second, { ref: 'second' })]);
      },
    });
    vm.$mount();
    document.body.append(vm.$el);
    await settle(Vue);
    const api = [vm.$refs.first, vm.$refs.second].map((ref) => method(ref, 'getExposes'));
    const states = () =>
      api.map((value) => {
        const state = method(value, 'isOpen');
        if (typeof state !== 'boolean') throw new Error('Not boolean Overlay state');
        return state;
      });
    const call = async (index: number, name: string) => {
      method(api[index], name);
      await settle(Vue);
    };
    for (const order of [
      [0, 1],
      [1, 0],
    ]) {
      await call(order[0], 'open');
      await call(order[1], 'open');
      expect(states()).toEqual([true, true]);
      if (modal) {
        expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
        await call(order[0], 'close');
        const afterFirst = {
          states: states(),
          overflow: document.body.style.getPropertyValue('overflow'),
        };
        trace['firstClose' + order.join('')] = afterFirst;
        const expected = [true, true];
        expected[order[0]] = false;
        expect(afterFirst.states).toEqual(expected);
        if (split) expect(afterFirst.overflow).not.toBe('hidden');
        else expect(afterFirst.overflow).toBe('hidden');
        await call(order[1], 'close');
        expect(states()).toEqual([false, false]);
        trace['lastClose' + order.join('')] = document.body.style.cssText;
        if (!split) {
          expect(document.body.style.getPropertyValue('overflow')).toBe('auto');
          expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
          expect(document.body.style.getPropertyValue('padding-right')).toBe('7px');
          expect(document.body.style.getPropertyPriority('padding-right')).toBe('important');
        } else {
          // Only reset this test's CSS between the independent order samples.
          document.body.style.setProperty('overflow', 'auto', 'important');
          document.body.style.setProperty('padding-right', '7px', 'important');
        }
      } else {
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        await settle(Vue);
        trace['firstOutside' + order.join('')] = states();
        if (split) expect(states()).toEqual([false, false]);
        else {
          const expected = [true, true];
          expected[order[1]] = false;
          expect(states()).toEqual(expected);
          document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
          await settle(Vue);
          expect(states()).toEqual([false, false]);
        }
      }
    }
    if (split) {
      // Local native-v1 files are facades in a migration, not extra full
      // instances. Count the physical shared implementation files separately.
      const implementations =
        split === 'shared-ownership'
          ? loaded.files.filter((file) => file.includes('/.proto-ui/shared/interaction/'))
          : loaded.files;
      expect(
        implementations.filter((file) => /\/native-(?:v1|counterfactual)\.ts$/.test(file))
      ).toHaveLength(2);
      expect(
        implementations.filter((file) => /\/adapter-(?:modules-v1|counterfactual)\.ts$/.test(file))
      ).toHaveLength(2);
      expect(loaded.files.filter((file) => file.endsWith('/ownership-v1.ts'))).toHaveLength(
        split === 'shared-ownership' ? 1 : 0
      );
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      vm?.$destroy();
    } catch (error) {
      failures.push(error);
    }
    try {
      vm?.$el?.remove();
    } catch (error) {
      failures.push(error);
    }
    try {
      Vue.config.errorHandler = previousHandler;
    } catch (error) {
      failures.push(error);
    }
    try {
      document.body.style.cssText = previousStyle;
    } catch (error) {
      failures.push(error);
    }
    try {
      trace.vueErrors = errors.map((error) => String(error));
      trace.failuresBeforeCapture = failures.map((error) => String(error));
      await saveEvidence(label + '-trace', trace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (errors.length)
    failures.push(new AggregateError(errors, 'Vue Overlay errors, including disposal'));
  if (failures.length) throw new AggregateError(failures, 'Filesystem Overlay observation failed');
}

// Test-only baseline assembly, explicitly not untouched independent CLI dirs or
// the new migration product. Old component/map bytes and their paths are kept;
// ordinary static facades point byte-identical old helper files at one location.
async function sharedLegacyBaseline(): Promise<string> {
  const directory = await fresh('legacy-shared');
  const shared = path.join(directory, '.proto-ui/legacy-shared');
  const entries: Array<[string, FixtureName]> = [
    ['trigger', 'trigger'],
    ['text', 'text'],
    ['boundary-first', 'boundary'],
    ['boundary-second', 'boundary'],
    ['modal-first', 'modal'],
    ['modal-second', 'modal'],
  ];
  for (const [id, name] of entries) {
    const source = path.join(root, 'old-' + name),
      target = path.join(directory, id);
    await cp(source, target, { recursive: true });
    for (const file of (await manifest(source)).artifacts.filter((item) =>
      item.path.startsWith('.proto-ui/')
    )) {
      if (!file.path.endsWith('.ts'))
        throw new Error('Legacy test assembly supports only TypeScript helpers');
      const destination = path.join(shared, file.path.slice('.proto-ui/'.length));
      const original = await readFile(path.join(source, file.path));
      await mkdir(path.dirname(destination), { recursive: true });
      try {
        await writeFile(destination, original, { flag: 'wx' });
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
          throw error;
        expect(await readFile(destination)).toEqual(original);
      }
      const facade = path.join(target, file.path);
      let specifier = path
        .relative(path.dirname(facade), destination)
        .split(path.sep)
        .join('/')
        .replace(/\.ts$/, '');
      if (!specifier.startsWith('.')) specifier = './' + specifier;
      await writeFile(facade, `export * from ${JSON.stringify(specifier)};\n`);
    }
    for (const filename of ['Component.js', 'Component.js.map', 'provenance.json'])
      expect(await readFile(path.join(target, filename))).toEqual(
        await readFile(path.join(source, filename))
      );
  }
  await saveEvidence('legacy-shared-baseline-assembly', {
    origin: 'test-only-shared-legacy-support-assembly',
    entries,
    note: 'Exact old component/map/provenance bytes; local helper files are explicit test-only facades, so these are not untouched CLI output directories.',
    files: await inventory(directory),
  });
  await copyEvidence('legacy-shared-baseline', directory);
  return directory;
}
async function splitFullHelper(second: string): Promise<string> {
  const directory = await fresh('split-full');
  await cp(migrated, directory, { recursive: true });
  const originalInventory = await inventory(directory);
  const shared = path.join(directory, '.proto-ui/shared/interaction');
  const native = await readFile(path.join(shared, 'native-v1.ts'), 'utf8');
  const adapter = await readFile(path.join(shared, 'adapter-modules-v1.ts'), 'utf8');
  expect(native).toContain("'./adapter-modules-v1'");
  expect(native).toContain("'./ownership-v1'");
  await writeFile(
    path.join(shared, 'native-counterfactual.ts'),
    native.replaceAll("'./adapter-modules-v1'", "'./adapter-counterfactual'"),
    { flag: 'wx' }
  );
  await writeFile(path.join(shared, 'adapter-counterfactual.ts'), adapter, { flag: 'wx' });
  const facade = path.join(directory, second, '.proto-ui/interaction/native-v1.ts');
  const before = await readFile(facade, 'utf8');
  expect(before.split('native-v1')).toHaveLength(2);
  await writeFile(facade, before.replace('native-v1', 'native-counterfactual'));
  expect(await readFile(path.join(directory, second, 'Component.js'))).toEqual(
    await readFile(path.join(migrated, second, 'Component.js'))
  );
  const changedInventory = await inventory(directory);
  const changed = Object.keys(originalInventory)
    .filter((file) => originalInventory[file] !== changedInventory[file])
    .sort();
  const added = Object.keys(changedInventory)
    .filter((file) => !Object.hasOwn(originalInventory, file))
    .sort();
  expect(changed).toEqual([second + '/.proto-ui/interaction/native-v1.ts']);
  expect(added).toEqual([
    '.proto-ui/shared/interaction/adapter-counterfactual.ts',
    '.proto-ui/shared/interaction/native-counterfactual.ts',
  ]);
  await saveEvidence('counterfactual-' + second + '-delta', {
    changed,
    added,
    originalInventory,
    changedInventory,
  });
  await copyEvidence('counterfactual-' + second, directory);
  return directory;
}

describe.runIf(stage !== 'capture-old')('actual CLI native-support directory migration', () => {
  beforeAll(async () => {
    expect(stage).toBe('verify');
    const corpus = await corpusForVerification();
    verifiedCorpus = corpus;
    corpusBefore = await inventory(corpus);
    const capture = object(JSON.parse(await readFile(path.join(corpus, 'capture.json'), 'utf8')));
    expect(capture).toMatchObject({
      version: 1,
      origin: 'actual-old-compiler-cli',
      emitterSHA256: oldEmitterSHA256,
      legacyHashes,
    });
    const records = object(capture.records);
    root = await fresh('actual-cli');
    for (const name of fixtureNames) {
      const record = object(records[name]);
      verifyCapturedCli(record);
      expect(record.input).toBe(sourceFixtures[name]);
      expect(record.inputSHA256).toBe(digest(sourceFixtures[name]));
      const old = path.join(corpus, name);
      await owned(old);
      expect(await inventory(old)).toEqual(record.files);
      expect(digest(await readFile(path.join(old, 'provenance.json')))).toBe(
        record.provenanceSHA256
      );
      for (const [file, hash] of Object.entries(legacyHashes))
        expect(digest(await readFile(path.join(old, file)))).toBe(hash);
      await cp(old, path.join(root, 'old-' + name), { recursive: true });
      const cli = await compileCli(root, name, path.join(root, 'new-' + name));
      await saveEvidence('new-' + name + '-cli', cli);
    }
    for (const generation of ['old', 'new'])
      for (const name of fixtureNames) {
        const id = generation + '-' + name,
          directory = path.join(root, id);
        inputs.push({
          id,
          directory: id,
          provenanceSHA256: digest(await readFile(path.join(directory, 'provenance.json'))),
        });
        sourcesBefore[id] = await inventory(directory);
      }
    await writePlan(root, { version: 1, inputs });
    migrated = path.join(root, 'migrated');
    const cli = await invoke(root, [
      'migrate-native-support',
      'plan.json',
      '--output',
      'migrated',
      '--json',
    ]);
    await saveEvidence('migration-cli', cli);
    expect(cli).toMatchObject({ code: 0, stderr: '' });
    expect(JSON.parse(cli.stdout)).toMatchObject({
      ok: true,
      command: 'migrate-native-support',
      result: { directory: migrated },
    });
    await copyEvidence('actual-cli-inputs-and-migration', root);
  });
  afterAll(async () => {
    if (corpusBefore) expect(await inventory(verifiedCorpus)).toEqual(corpusBefore);
    if (root)
      for (const [id, before] of Object.entries(sourcesBefore))
        expect(await inventory(path.join(root, id))).toEqual(before);
  });

  it('keeps the captured helper immutable while migrating to the current support bytes', async () => {
    // These verification modules are absent at the original capture boundary;
    // static imports would make capture-old depend on its future verifier.
    const { native: legacyNativeInteractionArtifact, adapter: legacyNativeAdapterModulesArtifact } =
      await historicalSupportArtifacts();
    const { nativeInteractionArtifacts } = await import('../src/native-interaction');
    expect(digest(legacyNativeInteractionArtifact.contents)).toBe(
      legacyHashes['.proto-ui/interaction/native-v1.ts']
    );
    expect(digest(legacyNativeAdapterModulesArtifact.contents)).toBe(
      legacyHashes['.proto-ui/interaction/adapter-modules-v1.ts']
    );
    expect(legacyNativeAdapterModulesArtifact.contents).not.toBe(
      nativeAdapterModulesArtifact.contents
    );
    expect(legacyNativeInteractionArtifact.contents).not.toBe(nativeInteractionArtifact.contents);
    for (const name of fixtureNames) {
      expect(
        await readFile(path.join(root, 'old-' + name, legacyNativeInteractionArtifact.path), 'utf8')
      ).toBe(legacyNativeInteractionArtifact.contents);
      expect(
        await readFile(
          path.join(root, 'old-' + name, legacyNativeAdapterModulesArtifact.path),
          'utf8'
        )
      ).toBe(legacyNativeAdapterModulesArtifact.contents);
    }
    for (const file of nativeInteractionArtifacts('full')) {
      const filename = file.path.replace('.proto-ui/', '.proto-ui/shared/');
      expect(await readFile(path.join(migrated, filename), 'utf8')).toBe(file.contents);
    }
  });

  it('preserves every component and source map byte and records exact original manifests', async () => {
    const outputFiles = await plainFiles(migrated);
    const top = object(JSON.parse(await readFile(path.join(migrated, 'provenance.json'), 'utf8')));
    expect(top).toMatchObject({ kind: 'native-support-migration-v1', version: 1 });
    const rootRecords = artifactRecords(top.artifacts);
    expect(rootRecords.map((file) => file.path).sort()).toEqual(
      outputFiles.filter((file) => file !== 'provenance.json').sort()
    );
    for (const file of rootRecords)
      expect(digest(await readFile(path.join(migrated, file.path)))).toBe(file.sha256);
    if (!Array.isArray(top.inputs))
      throw new Error('Root migration provenance has no source inputs');
    const migratedInputs = top.inputs.map(object);
    expect(migratedInputs.map((input) => input.id).sort()).toEqual(
      inputs.map((input) => input.id).sort()
    );
    for (const input of inputs) {
      const original = path.join(root, input.directory),
        target = path.join(migrated, input.id);
      const previous = await manifest(original),
        next = await owned(target);
      expect(next.migration).toMatchObject({
        version: 1,
        sourceManifestSHA256: input.provenanceSHA256,
        sharedRoot: '../.proto-ui/shared',
      });
      const mapping = migratedInputs.find((item) => item.id === input.id);
      expect(mapping).toMatchObject({ sourceManifestSHA256: input.provenanceSHA256 });
      if (!mapping || !Array.isArray(mapping.artifacts))
        throw new Error('Missing original/new per-file mapping');
      for (const item of mapping.artifacts) {
        const record = object(item),
          filename = string(record.path);
        expect(record.sha256).toBe(digest(await readFile(path.join(target, filename))));
        expect(record.originalSha256).toBe(sourcesBefore[input.id][filename] ?? null);
      }
      expect(
        await readFile(path.join(migrated, '.proto-ui/migration-inputs', input.id + '.json'))
      ).toEqual(await readFile(path.join(original, 'provenance.json')));
      for (const file of previous.artifacts.filter((item) => !item.path.startsWith('.proto-ui/')))
        expect(await readFile(path.join(target, file.path))).toEqual(
          await readFile(path.join(original, file.path))
        );
      expect(await inventory(original)).toEqual(sourcesBefore[input.id]);
    }
    expect(
      outputFiles.filter((file) => file === '.proto-ui/shared/interaction/native-v1.ts')
    ).toHaveLength(1);
    expect(
      outputFiles.filter((file) => file === '.proto-ui/shared/interaction/adapter-modules-v1.ts')
    ).toHaveLength(1);
    expect(
      outputFiles.filter((file) => file === '.proto-ui/shared/interaction/ownership-v1.ts')
    ).toHaveLength(1);
  });
  it('retains a filesystem baseline with one byte-identical legacy support instance', async () => {
    const baseline = await sharedLegacyBaseline();
    await routing(baseline, 'trigger', 'text', 'legacy-routing');
    // Separate component files require both ordinary facade import chains to
    // reach the same old support instance; same-entry imports cannot prove that.
    await overlays(baseline, 'boundary-first', 'boundary-second', 'legacy-boundary', false);
    await overlays(baseline, 'modal-first', 'modal-second', 'legacy-modal', true);
  });
  it('retains the real unmigrated old-Trigger/new-Text routing counterexample', async () => {
    await routing(root, 'old-trigger', 'new-text', 'unmigrated-routing', true);
  });
  it('measures unchanged independently emitted old Trigger and Text directories', async () => {
    await routing(root, 'old-trigger', 'old-text', 'independent-old-routing', true);
  });
  it.each([
    ['old-trigger', 'new-text'],
    ['new-trigger', 'old-text'],
    ['old-trigger', 'old-text'],
    ['new-trigger', 'new-text'],
  ])('isolates actual filesystem Text input for %s and %s', async (first, second) => {
    await routing(migrated, first, second, first + '-' + second);
  });
  for (const family of ['boundary', 'modal']) {
    for (const order of [
      ['old', 'new'],
      ['new', 'old'],
      ['old', 'old'],
      ['new', 'new'],
    ])
      it(`shares ${family} state in both opening orders with ${order.join('/')}`, async () => {
        await overlays(
          migrated,
          order[0] + '-' + family,
          order[1] + '-' + family,
          order.join('-') + '-' + family,
          family === 'modal'
        );
      });
    it(`detects a second full ${family} helper instance even while ownership stays shared`, async () => {
      const split = await splitFullHelper('old-' + family);
      await overlays(
        split,
        'new-' + family,
        'old-' + family,
        'split-' + family,
        family === 'modal',
        'shared-ownership'
      );
    });
    it(`measures unchanged independent old ${family} directories in both opening orders`, async () => {
      const directory = await fresh('independent-old');
      for (const id of ['first', 'second'])
        await cp(path.join(root, 'old-' + family), path.join(directory, id), { recursive: true });
      const before = await inventory(directory);
      await overlays(
        directory,
        'first',
        'second',
        'independent-old-' + family,
        family === 'modal',
        'independent-old'
      );
      expect(await inventory(directory)).toEqual(before);
    });
  }

  it('resolves normal imports after creating a nested output and relocating the whole directory', async () => {
    const directory = await fresh('relocation'),
      original = path.join(directory, 'first/nested/output');
    await mkdir(path.dirname(original), { recursive: true });
    const cli = await invoke(root, [
      'migrate-native-support',
      'plan.json',
      '--output',
      original,
      '--json',
    ]);
    expect(cli).toMatchObject({ code: 0, stderr: '' });
    const before = await inventory(original),
      moved = path.join(directory, 'moved/deeper/consumer');
    await mkdir(path.dirname(moved), { recursive: true });
    await rename(original, moved);
    expect(await inventory(moved)).toEqual(before);
    await expect(lstat(original)).rejects.toMatchObject({ code: 'ENOENT' });
    await routing(moved, 'old-trigger', 'new-text', 'relocated-routing');
    await overlays(moved, 'old-boundary', 'new-boundary', 'relocated-boundary', false);
    await overlays(moved, 'old-modal', 'new-modal', 'relocated-modal', true);
    expect(await inventory(moved)).toEqual(before);
    await saveEvidence('relocation', { cli, before, after: await inventory(moved) });
    await copyEvidence('relocated-output', moved);
  });

  it('resolves input directories relative to the plan rather than the calling cwd', async () => {
    const test = await migrationCase('relative'),
      caller = await fresh('caller');
    const cli = await invoke(caller, [
      'migrate-native-support',
      test.planFile,
      '--output',
      test.output,
      '--json',
    ]);
    expect(cli).toMatchObject({ code: 0, stderr: '' });
    expect(await readFile(path.join(test.output, 'subject/Component.js'))).toEqual(
      await readFile(path.join(test.directory, 'subject/Component.js'))
    );
    await saveEvidence('plan-relative-cli', cli);
  });
  it('requires the exact trusted provenance SHA before any output open', async () => {
    const test = await migrationCase();
    test.plan.inputs[1].provenanceSHA256 = '0'.repeat(64);
    await writePlan(test.directory, test.plan);
    await rejectedBeforeWrite(test, 'anchor');
  });
  it.each(['invalid-json', 'array', 'version', 'empty-inputs', 'unknown-key', 'missing-anchor'])(
    'rejects the %s plan before any output open',
    async (variant) => {
      const test = await migrationCase();
      if (variant === 'invalid-json') await writeFile(test.planFile, '{');
      else if (variant === 'array') await writePlan(test.directory, []);
      else if (variant === 'version') await writePlan(test.directory, { ...test.plan, version: 2 });
      else if (variant === 'empty-inputs')
        await writePlan(test.directory, { version: 1, inputs: [] });
      else if (variant === 'unknown-key')
        await writePlan(test.directory, { ...test.plan, overwrite: true });
      else
        await writePlan(test.directory, {
          version: 1,
          inputs: [{ id: 'subject', directory: 'subject' }],
        });
      await rejectedBeforeWrite(test, 'plan-' + variant);
    }
  );
  it.each([
    { label: 'missing-output', args: ['migrate-native-support', 'plan.json', '--json'] },
    { label: 'missing-plan', args: ['migrate-native-support', '--output', 'output', '--json'] },
    {
      label: 'irrelevant-profile',
      args: [
        'migrate-native-support',
        'plan.json',
        '--output',
        'output',
        '--profile',
        'vue2-source-v1',
        '--json',
      ],
    },
  ])('rejects invalid migration CLI usage $label', async ({ label, args }) => {
    const test = await migrationCase();
    const result = await invoke(test.directory, args);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false });
    await expect(lstat(test.output)).rejects.toMatchObject({ code: 'ENOENT' });
    await saveEvidence('invalid-cli-' + label, result);
  });
  it.each([
    'Component.js',
    'Component.js.map',
    '.proto-ui/interaction/native-v1.ts',
    '.proto-ui/interaction/adapter-modules-v1.ts',
  ])('rejects changed bytes in %s before any output open', async (filename) => {
    const test = await migrationCase();
    const target = path.join(test.directory, 'subject', filename);
    await writeFile(target, Buffer.concat([await readFile(target), Buffer.from('\n// changed')]));
    await rejectedBeforeWrite(
      test,
      'changed-' + path.basename(filename).toLowerCase().replaceAll('.', '-')
    );
  });
  it('rejects missing recorded files', async () => {
    const test = await migrationCase();
    await rm(path.join(test.directory, 'subject/.proto-ui/interaction/native-v1.ts'));
    await rejectedBeforeWrite(test, 'missing');
  });
  it('rejects unlisted extra files rather than silently dropping them', async () => {
    const test = await migrationCase();
    await writeFile(path.join(test.directory, 'subject/consumer.txt'), 'consumer owned');
    await rejectedBeforeWrite(test, 'extra');
  });
  it('rejects extra empty input directories rather than silently dropping them', async () => {
    const test = await migrationCase();
    await mkdir(path.join(test.directory, 'subject/empty-consumer-directory'));
    await rejectedBeforeWrite(test, 'extra-directory');
  });
  it.each(['.proto-ui/interaction/native-v1.ts', '.proto-ui/interaction/adapter-modules-v1.ts'])(
    'rejects a modified %s even when its manifest and trusted SHA have been resealed',
    async (filename) => {
      const test = await migrationCase(),
        directory = path.join(test.directory, 'subject');
      const value = await manifest(directory);
      const bytes =
        (await readFile(path.join(directory, filename), 'utf8')) + '\n// unknown helper version\n';
      await writeFile(path.join(directory, filename), bytes);
      const record = value.artifacts.find((file) => file.path === filename);
      if (!record) throw new Error('Missing old helper');
      record.sha256 = digest(bytes);
      await reseal(test, value);
      await rejectedBeforeWrite(test, 'resealed-' + path.basename(filename).replaceAll('.', '-'));
    }
  );
  it('rejects an unknown helper with otherwise complete matching ownership', async () => {
    const test = await migrationCase(),
      directory = path.join(test.directory, 'subject'),
      value = await manifest(directory);
    const filename = '.proto-ui/interaction/unknown.ts',
      contents = 'export {};\n';
    await writeFile(path.join(directory, filename), contents);
    value.artifacts.push({ path: filename, kind: 'source', sha256: digest(contents) });
    await reseal(test, value);
    await rejectedBeforeWrite(test, 'unknown-helper');
  });
  it('rejects a resealed change to the known context scope helper', async () => {
    const test = await migrationCase(),
      directory = path.join(test.directory, 'subject'),
      value = await manifest(directory);
    const filename = '.proto-ui/context/scope-v1.ts',
      contents =
        (await readFile(path.join(directory, filename), 'utf8')) + '\n// unknown scope version\n';
    await writeFile(path.join(directory, filename), contents);
    const record = value.artifacts.find((file) => file.path === filename);
    if (!record) throw new Error('Missing context helper');
    record.sha256 = digest(contents);
    await reseal(test, value);
    await rejectedBeforeWrite(test, 'resealed-context');
  });
  it('rejects an unknown context helper with otherwise matching ownership', async () => {
    const test = await migrationCase(),
      directory = path.join(test.directory, 'subject'),
      value = await manifest(directory);
    const filename = '.proto-ui/context/unknown.ts',
      contents = 'export {};\n';
    await writeFile(path.join(directory, filename), contents);
    value.artifacts.push({ path: filename, kind: 'source', sha256: digest(contents) });
    await reseal(test, value);
    await rejectedBeforeWrite(test, 'unknown-context');
  });
  it('rejects a conflicting target dependency version rather than relabeling the consumer', async () => {
    const test = await migrationCase(),
      value = await manifest(path.join(test.directory, 'subject'));
    if (!Array.isArray(value.dependencies)) throw new Error('Missing original dependencies');
    const vue = value.dependencies.map(object).find((item) => item.name === 'vue');
    if (!vue) throw new Error('Missing Vue target');
    vue.version = '3.5.31';
    await reseal(test, value);
    await rejectedBeforeWrite(test, 'target-dependency');
  });
  it.each(['duplicate', 'case-collision', 'file-directory-collision', 'traversal'])(
    'rejects %s artifact records before writing',
    async (variant) => {
      const test = await migrationCase(),
        value = await manifest(path.join(test.directory, 'subject'));
      const original = value.artifacts.find((file) => file.path === 'Component.js');
      if (!original) throw new Error('Missing component record');
      const filename =
        variant === 'duplicate'
          ? original.path
          : variant === 'case-collision'
            ? 'component.js'
            : variant === 'file-directory-collision'
              ? 'Component.js/child.ts'
              : '../outside.ts';
      value.artifacts.push({ ...original, path: filename });
      await reseal(test, value);
      await rejectedBeforeWrite(test, variant);
    }
  );
  it.each(['duplicate-id', 'case-id', 'traversal-id', 'reserved-id'])(
    'rejects %s plan paths before writing',
    async (variant) => {
      const test = await migrationCase();
      test.plan.inputs[1].id =
        variant === 'duplicate-id'
          ? 'valid'
          : variant === 'case-id'
            ? 'VALID'
            : variant === 'traversal-id'
              ? '../escape'
              : 'CON';
      await writePlan(test.directory, test.plan);
      await rejectedBeforeWrite(test, variant);
    }
  );
  it('rejects the same input directory under a second id', async () => {
    const test = await migrationCase();
    test.plan.inputs[1].directory = test.plan.inputs[0].directory;
    await writePlan(test.directory, test.plan);
    await rejectedBeforeWrite(test, 'duplicate-directory');
  });
  it('rejects a symbolic-link plan file', async () => {
    const test = await migrationCase(),
      original = path.join(test.directory, 'original-plan.json');
    await rename(test.planFile, original);
    await symlink(original, test.planFile, 'file');
    await rejectedBeforeWrite(test, 'symlink-plan');
    expect((await lstat(test.planFile)).isSymbolicLink()).toBe(true);
  });
  it.each(['directory', 'parent', 'artifact', 'manifest'])(
    'rejects a symlink at the input %s boundary',
    async (kind) => {
      const test = await migrationCase();
      const relative =
        kind === 'directory'
          ? 'subject'
          : kind === 'parent'
            ? 'subject/.proto-ui'
            : kind === 'manifest'
              ? 'subject/provenance.json'
              : 'subject/.proto-ui/interaction/native-v1.ts';
      const target = path.join(test.directory, relative),
        original = path.join(test.directory, 'symlink-target');
      await rename(target, original);
      await symlink(original, target, kind === 'directory' || kind === 'parent' ? 'dir' : 'file');
      await rejectedBeforeWrite(test, 'symlink-' + kind);
      expect((await lstat(target)).isSymbolicLink()).toBe(true);
    }
  );
  it('refuses an existing output directory, including an original input directory', async () => {
    const test = await migrationCase();
    await mkdir(test.output);
    await writeFile(path.join(test.output, 'sentinel.txt'), 'consumer bytes');
    const before = await inventory(test.output);
    const cli = await invoke(test.directory, [
      'migrate-native-support',
      'plan.json',
      '--output',
      'output',
      '--json',
    ]);
    expect(cli.code).toBe(1);
    expect(JSON.parse(cli.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'output-conflict' }],
    });
    expect(await inventory(test.output)).toEqual(before);
    const original = path.join(test.directory, 'subject'),
      originalBefore = await inventory(original);
    expect((await migrate(test.planFile, original)).ok).toBe(false);
    expect(await inventory(original)).toEqual(originalBefore);
  });
  it('does not follow a pre-existing output symlink', async () => {
    const test = await migrationCase(),
      foreign = await fresh('foreign');
    await writeFile(path.join(foreign, 'sentinel.txt'), 'foreign bytes');
    await symlink(foreign, test.output, 'dir');
    expect((await migrate(test.planFile, test.output)).ok).toBe(false);
    expect((await lstat(test.output)).isSymbolicLink()).toBe(true);
    expect(await inventory(foreign)).toEqual({ 'sentinel.txt': digest('foreign bytes') });
    const foreignBefore = await inventory(foreign),
      linkedParent = path.join(test.directory, 'linked-parent');
    await symlink(foreign, linkedParent, 'dir');
    const nestedOutput = path.join(linkedParent, 'nested-output');
    let opens = 0;
    const api = await migrate(test.planFile, nestedOutput, async (filename) => {
      opens++;
      return open(filename, 'wx');
    });
    expect(api).toMatchObject({ ok: false, diagnostics: [{ category: 'output-conflict' }] });
    expect(opens).toBe(0);
    expect(await inventory(foreign)).toEqual(foreignBefore);
    const cli = await invoke(test.directory, [
      'migrate-native-support',
      'plan.json',
      '--output',
      'linked-parent/nested-output',
      '--json',
    ]);
    expect(cli).toMatchObject({ code: 1, stderr: '' });
    expect(JSON.parse(cli.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'output-conflict' }],
    });
    expect((await lstat(linkedParent)).isSymbolicLink()).toBe(true);
    await expect(lstat(path.join(foreign, 'nested-output'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await inventory(foreign)).toEqual(foreignBefore);
    await saveEvidence('output-parent-symlink', {
      api,
      cli,
      opens,
      foreignBefore,
      foreignAfter: await inventory(foreign),
    });
  });
  it('allows one of two concurrent create-only deliveries to win', async () => {
    const test = await migrationCase();
    const results = await Promise.all([
      migrate(test.planFile, test.output),
      migrate(test.planFile, test.output),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'output-conflict' }],
    });
    await owned(path.join(test.output, 'subject'));
  });
  it('rolls back completed and partial files and permits a clean retry', async () => {
    const test = await migrationCase();
    let writes = 0;
    const result = await migrate(test.planFile, test.output, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        close: () => handle.close(),
        async writeFile(contents) {
          if (++writes === 3) {
            await handle.writeFile(contents.slice(0, 8));
            throw Object.assign(new Error('Injected migration write failure'), { code: 'EIO' });
          }
          await handle.writeFile(contents);
        },
      };
    });
    expect(writes).toBe(3);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-write' }] });
    await expect(lstat(test.output)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await migrate(test.planFile, test.output)).ok).toBe(true);
    await owned(path.join(test.output, 'subject'));
    await saveEvidence('partial-write-rollback', {
      result,
      writes,
      retryInventory: await inventory(test.output),
    });
  });
  it('preserves a foreign replacement during ownership-aware rollback', async () => {
    const test = await migrationCase();
    let first: string | undefined,
      writes = 0;
    const result = await migrate(test.planFile, test.output, async (filename) => {
      first ??= filename;
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        close: () => handle.close(),
        async writeFile(contents) {
          await handle.writeFile(contents);
          if (++writes === 3) {
            const replacement = path.join(test.directory, 'replacement');
            await writeFile(replacement, 'foreign replacement');
            if (!first) throw new Error('No completed output');
            await rename(replacement, first);
            throw Object.assign(new Error('Injected ownership rollback failure'), { code: 'EIO' });
          }
        },
      };
    });
    expect(result.ok).toBe(false);
    if (!first) throw new Error('No completed output');
    expect(await readFile(first, 'utf8')).toBe('foreign replacement');
    expect(await plainFiles(test.output)).toEqual([
      path.relative(test.output, first).split(path.sep).join('/'),
    ]);
    await saveEvidence('foreign-replacement-rollback', {
      result,
      writes,
      preserved: path.relative(test.output, first),
    });
  });
});

// Image extends the explicit directory migration contract. The historical
// old/old and old/new Text/Overlay controls above stay unchanged. No historical
// Image capture is invented: this input is made by the current actual CLI.
const imageMigrationSource = `import {definePrototype} from '@proto.ui/core';
import {asImageView as usePicture} from '@proto.ui/hooks';
import {declareImageView} from '@proto.ui/module-image-view';
export default definePrototype({name:'ordinary-inner-picture',
 modules:[declareImageView({source:'',alternativeText:'Image',a11yMode:'informative',fit:'cover'})],
 setup(def){
  def.props.define({source:{type:'string',default:'image:a'},present:{type:'boolean',default:true}});
  const image=usePicture();def.expose.event('status',{payload:'json'});
  image.on('loadingStatusChange',(run,event)=>run.expose.emit('status',event));
  def.lifecycle.onCreated(run=>image.sync({source:run.props.get().source}));
  def.props.watch(['source'],(run,next)=>image.sync({source:next.source}));
  def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present));
  def.expose.method('read',()=>image.snapshot());return()=>null;
 }});`;
type ImageDirectoryMode = 'independent' | 'migrated' | 'split';
async function imageDirectoryConsumer(directory: string, label: string, mode: ImageDirectoryMode) {
  const buildRoot = await fresh('image-bundle');
  const vueEntry = createRequire(
    fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url))
  ).resolve('vue');
  const floatingEntry = createRequire(
    fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
  ).resolve('@floating-ui/dom');
  const entry = path.join(buildRoot, 'consumer.ts'),
    outfile = path.join(buildRoot, 'consumer.cjs');
  const lines = [
    `export { default as Vue } from ${JSON.stringify(vueEntry)};`,
    `export { default as first } from ${JSON.stringify(path.join(directory, 'old-trigger/Component.js'))};`,
    `export { default as second } from ${JSON.stringify(path.join(directory, 'new-image/Component.js'))};`,
    `export * as imageOwnership from ${JSON.stringify(path.join(directory, 'new-image/.proto-ui/interaction/ownership-v1.ts'))};`,
  ];
  if (mode !== 'independent')
    lines.push(
      `export * as outerOwnership from ${JSON.stringify(path.join(directory, 'old-trigger/.proto-ui/interaction/ownership-v1.ts'))};`
    );
  await writeFile(entry, lines.join('\n') + '\n');
  expect(esbuildVersion).toBe('0.25.12');
  // Only target dependencies are resolved explicitly. All generated components,
  // facades and support modules use their actual ordinary filesystem imports.
  const result = await build({
    absWorkingDir: buildRoot,
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    metafile: true,
    sourcemap: 'external',
    write: true,
    alias: { vue: vueEntry, '@floating-ui/dom': floatingEntry },
    external: [vueEntry],
    logLevel: 'silent',
  });
  const files = Object.keys(result.metafile.inputs).map((file) => path.resolve(buildRoot, file));
  await saveEvidence(label + '-bundle', {
    mode,
    esbuildVersion,
    vueEntry,
    floatingEntry,
    files,
    metafile: result.metafile,
  });
  await copyEvidence(label + '-consumer', buildRoot);
  const loaded: unknown = require(outfile);
  assertConsumer(loaded);
  const namespaces = object(loaded);
  const imageOwnership = object(namespaces.imageOwnership);
  const outerOwnership = mode === 'independent' ? undefined : object(namespaces.outerOwnership);
  for (const id of ['old-trigger', 'new-image'])
    expect(files).toContain(path.join(directory, id, 'Component.js'));
  expect(
    files.filter((file) => /packages\/(?:core|runtime|hooks|adapters)\/(?:.+\/)?src\//.test(file))
  ).toEqual([]);
  expect(
    files.filter(
      (file) =>
        /\/ownership-(?:v1|counterfactual)\.ts$/.test(file) &&
        (mode === 'independent' || file.includes('/.proto-ui/shared/interaction/'))
    )
  ).toHaveLength(mode === 'split' ? 2 : 1);
  return { ...loaded, imageOwnership, outerOwnership, files };
}
async function imageDirectoryJourney(directory: string, label: string, mode: ImageDirectoryMode) {
  const trace: Record<string, unknown> = {
    mode,
    hostEvidence:
      'Controlled HappyDOM decode promises and synthetic load/error/click events; not browser network, cache or native event-bubbling proof.',
  };
  const failures: unknown[] = [],
    vueErrors: unknown[] = [];
  const requests: Array<{
    resolve(): void;
    reject(): void;
    target: HTMLImageElement;
    source: string | null;
  }> = [];
  const events: unknown[] = [],
    activated: unknown[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
  let vm: Vue2 | undefined,
    Vue: typeof Vue2 | undefined,
    restoreErrorHandler: (() => void) | undefined;
  let host: HTMLDivElement | undefined,
    patched = false,
    handlerPatched = false,
    destroyed = false;
  let nativeEvents = 0,
    bubbledClicks = 0;
  try {
    const loaded = await imageDirectoryConsumer(directory, label, mode);
    trace.files = loaded.files;
    Vue = loaded.Vue;
    const previousHandler = loaded.Vue.config.errorHandler;
    restoreErrorHandler = () => {
      loaded.Vue.config.errorHandler = previousHandler;
    };
    Vue.config.errorHandler = (error) => vueErrors.push(error);
    handlerPatched = true;
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: function (this: HTMLImageElement) {
        const target = this;
        return new Promise<void>((resolve, reject) =>
          requests.push({
            resolve,
            reject: () => reject(new Error('Controlled image decode failure')),
            target,
            source: target.getAttribute('src'),
          })
        );
      },
    });
    patched = true;
    const flush = async () => {
      await Promise.resolve();
      await settle(loaded.Vue);
    };
    const state = Vue.observable({ source: 'image:a', present: true });
    vm = new Vue({
      render(h) {
        return h(loaded.first, {
          on: { activated: (value: unknown) => activated.push(value) },
          scopedSlots: {
            default: () => [
              h(loaded.second, {
                props: { source: state.source, present: state.present },
                on: { status: (value: unknown) => events.push(value) },
              }),
            ],
          },
        });
      },
    });
    host = document.createElement('div');
    document.body.append(host);
    host.addEventListener('load', () => ++nativeEvents);
    host.addEventListener('error', () => ++nativeEvents);
    host.addEventListener('click', () => ++bubbledClicks);
    vm.$mount();
    host.append(vm.$el);
    await flush();
    const image = host.querySelector('img');
    if (!image) throw new Error('Actual CLI Image root missing');
    const instance = vm.$children[0].$children.find((child) => child.$el === image);
    if (!instance) throw new Error('Actual CLI Image owner missing');
    const read = () => method(method(instance, 'getExposes'), 'read');
    const physical = loaded.imageOwnership.rootOwners,
      logical = loaded.imageOwnership.logicalOwners;
    const modules = loaded.imageOwnership.owners;
    const identity = object(method(physical, 'get', image)).identity;
    const owner = method(modules, 'get', identity);
    trace.identity = {
      imageRegistered: method(physical, 'has', image),
      outerVisibleToImage: method(physical, 'has', vm.$el),
      sharedRegistry: loaded.outerOwnership ? loaded.outerOwnership.rootOwners === physical : false,
    };
    expect(trace.identity).toEqual({
      imageRegistered: true,
      outerVisibleToImage: mode === 'migrated',
      sharedRegistry: mode === 'migrated',
    });
    expect(method(logical, 'has', identity)).toBe(true);
    expect(owner).toBeDefined();
    if (loaded.outerOwnership) {
      const outerIdentity = object(
        method(loaded.outerOwnership.rootOwners, 'get', vm.$el)
      ).identity;
      expect(identity).not.toBe(outerIdentity);
      expect(method(owner, 'parent')).toBe(outerIdentity);
      for (const key of ['rootOwners', 'logicalOwners', 'owners']) {
        if (mode === 'migrated')
          expect(loaded.imageOwnership[key]).toBe(loaded.outerOwnership[key]);
        else expect(loaded.imageOwnership[key]).not.toBe(loaded.outerOwnership[key]);
      }
    }
    trace.initial = {
      source: image.getAttribute('src'),
      alt: image.alt,
      fit: image.style.objectFit,
      snapshot: read(),
      requests: requests.length,
    };
    expect(trace.initial).toEqual({
      source: 'image:a',
      alt: 'Image',
      fit: 'cover',
      snapshot: { source: 'image:a', loadingStatus: 'loading', fit: 'cover' },
      requests: 1,
    });
    image.dispatchEvent(new Event('load', { bubbles: true }));
    image.dispatchEvent(new Event('error', { bubbles: true }));
    trace.syntheticBoundary = { propagated: nativeEvents, snapshot: read() };
    expect(trace.syntheticBoundary).toEqual({
      propagated: 0,
      snapshot: { source: 'image:a', loadingStatus: 'loading', fit: 'cover' },
    });
    image.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    trace.afterImageClick = { activated: [...activated], bubbledClicks };
    expect(trace.afterImageClick).toEqual({
      activated: mode === 'migrated' ? [] : ['outer'],
      bubbledClicks: 1,
    });
    // Click still reaches this ordinary parent observer. Ownership, not an
    // Image stopPropagation workaround, must isolate the outer Trigger.
    vm.$el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(activated).toEqual(mode === 'migrated' ? ['outer'] : ['outer', 'outer']);
    expect(bubbledClicks).toBe(2);
    state.source = 'image:b';
    await flush();
    expect(requests).toHaveLength(2);
    requests[0].resolve();
    await flush();
    trace.afterStale = read();
    expect(trace.afterStale).toEqual({ source: 'image:b', loadingStatus: 'loading', fit: 'cover' });
    requests[1].resolve();
    await flush();
    trace.afterCurrent = read();
    expect(trace.afterCurrent).toEqual({
      source: 'image:b',
      loadingStatus: 'loaded',
      fit: 'cover',
    });
    const terminalCount = events.length;
    image.dispatchEvent(new Event('load', { bubbles: true }));
    image.dispatchEvent(new Event('error', { bubbles: true }));
    await flush();
    expect(events).toHaveLength(terminalCount);
    state.present = false;
    await flush();
    trace.detached = {
      physical: method(physical, 'has', image),
      logical: method(logical, 'has', identity),
      module: method(modules, 'get', identity) === owner,
      target: method(owner, 'target'),
    };
    expect(trace.detached).toEqual({ physical: false, logical: false, module: true, target: null });
    state.present = true;
    await flush();
    const next = host.querySelector('img');
    if (!next) throw new Error('Actual CLI Image did not remount');
    trace.remounted = {
      differentTarget: next !== image,
      sameIdentity: object(method(physical, 'get', next)).identity === identity,
      snapshot: read(),
      requests: requests.length,
    };
    expect(trace.remounted).toEqual({
      differentTarget: true,
      sameIdentity: true,
      snapshot: { source: 'image:b', loadingStatus: 'loading', fit: 'cover' },
      requests: 3,
    });
    requests[2].reject();
    await flush();
    trace.afterError = read();
    expect(trace.afterError).toEqual({ source: 'image:b', loadingStatus: 'error', fit: 'cover' });
    state.source = '';
    await flush();
    expect(read()).toEqual({ source: '', loadingStatus: 'idle', fit: 'cover' });
    expect(next.getAttribute('src')).toBe(null);
    state.source = 'image:c';
    await flush();
    expect(requests).toHaveLength(4);
    const beforeDispose = events.length;
    vm.$destroy();
    destroyed = true;
    requests[3].resolve();
    await flush();
    trace.disposed = {
      physical: method(physical, 'has', next),
      logical: method(logical, 'has', identity),
      module: method(modules, 'has', identity),
      lateEvents: events.length - beforeDispose,
    };
    expect(trace.disposed).toEqual({
      physical: false,
      logical: false,
      module: false,
      lateEvents: 0,
    });
    expect(Reflect.get(modules as object, 'size')).toBe(0);
    if (loaded.outerOwnership)
      expect(Reflect.get(loaded.outerOwnership.owners as object, 'size')).toBe(0);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (!destroyed) vm?.$destroy();
    } catch (error) {
      failures.push(error);
    }
    try {
      host?.remove();
    } catch (error) {
      failures.push(error);
    }
    try {
      if (handlerPatched) restoreErrorHandler?.();
    } catch (error) {
      failures.push(error);
    }
    try {
      if (patched) {
        if (descriptor) Object.defineProperty(HTMLImageElement.prototype, 'decode', descriptor);
        else if (!Reflect.deleteProperty(HTMLImageElement.prototype, 'decode'))
          throw new Error('Could not restore image decode');
      }
    } catch (error) {
      failures.push(error);
    }
    trace.events = events;
    trace.requests = requests.map((request) => ({ source: request.source }));
    trace.vueErrors = vueErrors.map(String);
    trace.failuresBeforeCapture = failures.map(String);
    try {
      await saveEvidence(label + '-trace', trace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (vueErrors.length)
    failures.push(new AggregateError(vueErrors, 'Vue Image errors, including disposal'));
  if (failures.length) throw new AggregateError(failures, 'Filesystem Image observation failed');
}

describe.runIf(stage !== 'capture-old')(
  'actual CLI Image native-support directory migration',
  () => {
    let directory: string, cohort: string, planFile: string, corpus: string;
    let before: Record<string, string>, capturedBefore: Record<string, string>;
    beforeAll(async () => {
      expect(stage).toBe('verify');
      corpus = verifiedCorpus ?? (await corpusForVerification());
      capturedBefore = await inventory(corpus);
      const capture = object(JSON.parse(await readFile(path.join(corpus, 'capture.json'), 'utf8')));
      expect(capture).toMatchObject({
        version: 1,
        origin: 'actual-old-compiler-cli',
        emitterSHA256: oldEmitterSHA256,
        legacyHashes,
      });
      const record = object(object(capture.records).trigger);
      verifyCapturedCli(record);
      expect(record.input).toBe(sourceFixtures.trigger);
      expect(record.inputSHA256).toBe(digest(sourceFixtures.trigger));
      expect(await inventory(path.join(corpus, 'trigger'))).toEqual(record.files);
      directory = await fresh('image-cli');
      await cp(path.join(corpus, 'trigger'), path.join(directory, 'old-trigger'), {
        recursive: true,
      });
      await owned(path.join(directory, 'old-trigger'));
      expect(digest(await readFile(path.join(directory, 'old-trigger/provenance.json')))).toBe(
        record.provenanceSHA256
      );
      for (const [file, expected] of Object.entries(legacyHashes))
        expect(digest(await readFile(path.join(directory, 'old-trigger', file)))).toBe(expected);
      await mkdir(path.join(directory, 'inputs'));
      await writeFile(path.join(directory, 'inputs/picture.proto.ts'), imageMigrationSource);
      const compile = await invoke(directory, [
        'compile',
        'inputs/picture.proto.ts',
        '--profile',
        'vue2-source-v1',
        '--output',
        'new-image',
        '--json',
      ]);
      await saveEvidence('image-directory-compile', {
        input: imageMigrationSource,
        inputSHA256: digest(imageMigrationSource),
        cli: compile,
      });
      expect(compile).toMatchObject({ code: 0, stderr: '' });
      expect(JSON.parse(compile.stdout)).toMatchObject({
        ok: true,
        command: 'compile',
        result: { directory: path.join(directory, 'new-image') },
      });
      const image = await owned(path.join(directory, 'new-image'));
      expect(
        image.artifacts
          .filter((file) => file.path.startsWith('.proto-ui/interaction/'))
          .map((file) => file.path)
          .sort()
      ).toEqual(['.proto-ui/interaction/image-v1.ts', '.proto-ui/interaction/ownership-v1.ts']);
      const inputs = await Promise.all(
        ['old-trigger', 'new-image'].map(async (id) => ({
          id,
          directory: id,
          provenanceSHA256: digest(await readFile(path.join(directory, id, 'provenance.json'))),
        }))
      );
      planFile = await writePlan(directory, { version: 1, inputs });
      before = await inventory(directory);
      cohort = path.join(await fresh('image-cohort'), 'output');
      const cli = await invoke(directory, [
        'migrate-native-support',
        planFile,
        '--output',
        cohort,
        '--json',
      ]);
      await saveEvidence('image-directory-migration', { cli, inputs, before });
      expect(cli).toMatchObject({ code: 0, stderr: '' });
      expect(JSON.parse(cli.stdout)).toMatchObject({
        ok: true,
        command: 'migrate-native-support',
        result: { directory: cohort },
      });
      await copyEvidence('image-directory-inputs', directory);
      await copyEvidence('image-directory-output', cohort);
    });
    afterAll(async () => {
      if (before) expect(await inventory(directory)).toEqual(before);
      if (capturedBefore) expect(await inventory(corpus)).toEqual(capturedBefore);
    });

    it('migrates actual old Trigger and new Image directories with preserved bytes and relocated identity', async () => {
      await imageDirectoryJourney(directory, 'image-unmigrated', 'independent');
      const top = object(JSON.parse(await readFile(path.join(cohort, 'provenance.json'), 'utf8')));
      expect(top).toMatchObject({ kind: 'native-support-migration-v1', version: 1 });
      const records = artifactRecords(top.artifacts);
      expect(records.map((file) => file.path).sort()).toEqual(
        (await plainFiles(cohort)).filter((file) => file !== 'provenance.json').sort()
      );
      for (const file of records)
        expect(digest(await readFile(path.join(cohort, file.path)))).toBe(file.sha256);
      for (const id of ['old-trigger', 'new-image']) {
        const original = path.join(directory, id),
          target = path.join(cohort, id);
        const next = await owned(target);
        expect(next.migration).toMatchObject({
          version: 1,
          sourceManifestSHA256: digest(await readFile(path.join(original, 'provenance.json'))),
          sharedRoot: '../.proto-ui/shared',
        });
        for (const filename of ['Component.js', 'Component.js.map'])
          expect(await readFile(path.join(target, filename))).toEqual(
            await readFile(path.join(original, filename))
          );
        expect(
          await readFile(path.join(cohort, '.proto-ui/migration-inputs', id + '.json'))
        ).toEqual(await readFile(path.join(original, 'provenance.json')));
      }
      const relocation = await fresh('image-relocation'),
        original = path.join(relocation, 'first/nested/output');
      await mkdir(path.dirname(original), { recursive: true });
      const cli = await invoke(directory, [
        'migrate-native-support',
        planFile,
        '--output',
        original,
        '--json',
      ]);
      await saveEvidence('image-relocation-cli', cli);
      expect(cli).toMatchObject({ code: 0, stderr: '' });
      const prior = await inventory(original),
        moved = path.join(relocation, 'moved/deeper/consumer');
      await mkdir(path.dirname(moved), { recursive: true });
      await rename(original, moved);
      await expect(lstat(original)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await inventory(moved)).toEqual(prior);
      await copyEvidence('image-relocated-output', moved);
      await imageDirectoryJourney(moved, 'image-migrated-relocated', 'migrated');
      expect(await inventory(moved)).toEqual(prior);
      expect(await inventory(directory)).toEqual(before);
      await saveEvidence('image-relocation', { before: prior, after: await inventory(moved) });
    });

    it('detects split physical Image ownership while ordinary imports and request cleanup still work', async () => {
      const split = path.join(await fresh('image-split'), 'output');
      await cp(cohort, split, { recursive: true });
      const prior = await inventory(split),
        shared = path.join(split, '.proto-ui/shared/interaction');
      const image = await readFile(path.join(shared, 'image-v1.ts'), 'utf8');
      expect(image.split("'./ownership-v1'")).toHaveLength(2);
      await writeFile(
        path.join(shared, 'image-counterfactual.ts'),
        image.replace("'./ownership-v1'", "'./ownership-counterfactual'"),
        { flag: 'wx' }
      );
      await cp(
        path.join(shared, 'ownership-v1.ts'),
        path.join(shared, 'ownership-counterfactual.ts'),
        { force: false, errorOnExist: true }
      );
      for (const name of ['image', 'ownership']) {
        const filename = path.join(split, 'new-image/.proto-ui/interaction', name + '-v1.ts');
        const facade = await readFile(filename, 'utf8');
        expect(facade.split(name + '-v1')).toHaveLength(2);
        await writeFile(filename, facade.replace(name + '-v1', name + '-counterfactual'));
      }
      const after = await inventory(split);
      expect(
        Object.keys(after)
          .filter((file) => prior[file] !== after[file])
          .sort()
      ).toEqual([
        '.proto-ui/shared/interaction/image-counterfactual.ts',
        '.proto-ui/shared/interaction/ownership-counterfactual.ts',
        'new-image/.proto-ui/interaction/image-v1.ts',
        'new-image/.proto-ui/interaction/ownership-v1.ts',
      ]);
      // A test mutation, never resealed or represented as valid migration output.
      await saveEvidence('image-split-delta', { before: prior, after });
      await copyEvidence('image-split-output', split);
      await imageDirectoryJourney(split, 'image-split', 'split');
      expect(await inventory(split)).toEqual(after);
    });

    it('rejects a resealed modified Image helper before opening or leaving any output', async () => {
      const test = await fresh('image-reject');
      for (const id of ['old-trigger', 'new-image'])
        await cp(path.join(directory, id), path.join(test, id), { recursive: true });
      const target = path.join(test, 'new-image'),
        filename = '.proto-ui/interaction/image-v1.ts';
      const value = await manifest(target),
        bytes = (await readFile(path.join(target, filename), 'utf8')) + '\n// unknown image ABI\n';
      await writeFile(path.join(target, filename), bytes);
      const record = value.artifacts.find((file) => file.path === filename);
      if (!record) throw new Error('Missing actual CLI Image helper');
      record.sha256 = digest(bytes);
      await writeFile(path.join(target, 'provenance.json'), JSON.stringify(value, null, 2) + '\n');
      const inputs = await Promise.all(
        ['old-trigger', 'new-image'].map(async (id) => ({
          id,
          directory: id,
          provenanceSHA256: digest(await readFile(path.join(test, id, 'provenance.json'))),
        }))
      );
      const plan = await writePlan(test, { version: 1, inputs }),
        output = path.join(test, 'output');
      const prior = await inventory(test);
      let opens = 0;
      const result = await migrate(plan, output, async (filename) => {
        ++opens;
        return open(filename, 'wx');
      });
      const cli = await invoke(test, [
        'migrate-native-support',
        plan,
        '--output',
        output,
        '--json',
      ]);
      await saveEvidence('image-resealed-rejection', { result, cli, opens, inputs });
      await copyEvidence('image-resealed-inputs', test);
      expect(result.ok).toBe(false);
      expect(opens).toBe(0);
      expect(JSON.stringify(result)).toContain('Unknown or modified native support ABI');
      expect(cli).toMatchObject({ code: 1, stderr: '' });
      expect(JSON.parse(cli.stdout)).toMatchObject({ ok: false });
      await expect(lstat(output)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await inventory(test)).toEqual(prior);
    });
  }
);
