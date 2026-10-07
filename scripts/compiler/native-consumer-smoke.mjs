/**
 * Real native-profile consumers, deliberately one-sided (no Adapter parity/speed claim).
 * Run: node --import tsx scripts/compiler/native-consumer-smoke.mjs
 * Default: copy complete already-installed package closures, without source-tree links.
 * NATIVE_CONSUMER_DEPENDENCIES=registry instead installs exact versions in each consumer.
 * NATIVE_CONSUMER_PACKAGE_ROOT selects an installed tree for offline copies.
 * NATIVE_CONSUMER_PROFILES is a comma-separated subset of the four implemented profiles.
 * Every consumer, compiler input, command stream, failure, trace and measurement is retained.
 * Happy DOM exercises real framework/custom-element mounts; this is not browser/layout proof.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
<<<<<<< HEAD
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
=======
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync,
  readFileSync, realpathSync, statSync, writeFileSync,
>>>>>>> origin/main
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
<<<<<<< HEAD
  compileFile,
  compileProject,
  compilationArtifacts,
  writeArtifactSet,
  TARGET_PROFILES,
  verifyConsumerClosure,
=======
  compileFile, compileProject, compilationArtifacts, writeArtifactSet, TARGET_PROFILES, verifyConsumerClosure,
>>>>>>> origin/main
} from '../../packages/compiler/src/index.ts';

const repoRoot = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const script = fileURLToPath(import.meta.url);
<<<<<<< HEAD
const supported = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
];
=======
const supported = ['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'];
>>>>>>> origin/main
const toolVersions = { typescript: '5.9.3', 'happy-dom': '15.11.7' };
const reactTypeVersions = { '@types/react': '19.2.14', '@types/react-dom': '19.2.3' };
const numericSource = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'native-consumer-counter',setup(def){
  def.props.define({seed:{type:'number',default:2},visible:{type:'boolean',default:true},active:{type:'boolean',default:false},patch:{type:'number',default:0}});
  const count=def.state.numberDiscrete('consumerCount',0,{min:0,max:100,step:1});
  const base=tw('bg-white','opacity-100');
  const counted=tw('bg-red');const active=tw('bg-black','opacity-40');const patched=tw('bg-blue');
  const template=tw('text-white');
  def.feedback.style.use(base);
  def.rule({when:w=>w.state(count).eq(7),intent:i=>i.feedback.style.use(counted)});
  def.rule({when:w=>w.prop('active').eq(true),intent:i=>i.feedback.style.use(active)});
  def.props.watch(['patch'],(run,next)=>{
    if(next.patch===1){run.feedback.style.patch(patched);}
    if(next.patch===2){run.feedback.style.suppress(patched);}
    if(next.patch===0){run.feedback.style.clearPatch();}
  });
  def.expose.state('count',count);
  def.expose.method('write',(next:number)=>{count.set(next,'consumer-write');});
  def.expose.method('read',()=>count.get());
  def.expose.event('phase',{payload:'json'});
  def.props.watch(['seed'],(run,next)=>{count.set(next.seed ?? 0);run.update();});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible ?? false);});
  def.lifecycle.onCreated((run)=>{
    count.set(run.props.get().seed ?? 0);
    run.lifecycle.setPresent(run.props.get().visible ?? false);
    run.expose.emit('phase','created');
  });
  def.lifecycle.onMounted((run)=>{run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated((run)=>{run.expose.emit('phase','updated');});
  def.lifecycle.onUnmounted((run)=>{run.expose.emit('phase','unmounted');});
  def.lifecycle.onBeforeDispose((run)=>{run.expose.emit('phase','disposed');});
  return (render)=>render.el('section',{style:template},count.get());
}});`;
const contextKeysSource = `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('consumer-shared-name');
export const OTHER=createContextKey<{value:number}>('consumer-shared-name');`;
const providerSource = `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'native-consumer-provider',setup(def){
  def.props.define({seed:{type:'number',default:31}});
  def.context.provide(KEY,{value:31});
  def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed ?? 31});});
  return render=>render.el('section',{},render.slot());
}});`;
const contextConsumerSource = `import {definePrototype} from '@proto.ui/core';import {KEY,OTHER} from './keys';
export default definePrototype({name:'native-consumer-context',setup(def){
  const value=def.state.numberDiscrete('value',0);
  const missing=def.state.bool('missing',false);
  def.expose.state('value',value);def.expose.state('missing',missing);
  def.context.subscribe(KEY,(run,next)=>{value.set(next.value);run.update();});
  def.context.trySubscribe(OTHER);
  def.lifecycle.onCreated(run=>{value.set(run.context.read(KEY).value);missing.set(run.context.tryRead(OTHER)===null);});
  return render=>render.el('output',{},render.read.context.read(KEY).value);
}});`;
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
const save = (filename, value) => writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const sha = (value) => createHash('sha256').update(value).digest('hex');
function within(root, filename) {
  const relative = path.relative(root, filename);
<<<<<<< HEAD
  return (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  );
}
function packageName(name) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name))
    throw new Error(`Unsafe package name: ${name}`);
=======
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}
function packageName(name) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) throw new Error(`Unsafe package name: ${name}`);
>>>>>>> origin/main
  if (name.startsWith('@proto.ui/')) throw new Error(`Native consumer dependency leak: ${name}`);
  return name;
}
function filesUnder(directory, skipModules = false) {
  const files = [];
  function visit(current) {
<<<<<<< HEAD
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (skipModules && entry.name === 'node_modules') continue;
      const filename = path.join(current, entry.name);
      const canonical = realpathSync(filename);
      if (!within(directory, canonical))
        throw new Error(`Escaping consumer file: ${filename} -> ${canonical}`);
      if (statSync(filename).isDirectory()) {
        if (entry.isSymbolicLink())
          throw new Error(`Directory symlink is not accepted in consumer inventory: ${filename}`);
=======
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skipModules && entry.name === 'node_modules') continue;
      const filename = path.join(current, entry.name);
      const canonical = realpathSync(filename);
      if (!within(directory, canonical)) throw new Error(`Escaping consumer file: ${filename} -> ${canonical}`);
      if (statSync(filename).isDirectory()) {
        if (entry.isSymbolicLink()) throw new Error(`Directory symlink is not accepted in consumer inventory: ${filename}`);
>>>>>>> origin/main
        visit(filename);
      } else if (statSync(filename).isFile()) files.push(filename);
      else throw new Error(`Non-regular consumer artifact: ${filename}`);
    }
  }
  visit(directory);
  return files;
}
function payload(directory) {
  const files = filesUnder(directory, true);
  const digest = createHash('sha256');
  let bytes = 0;
  for (const filename of files) {
    const content = readFileSync(filename);
    bytes += content.length;
<<<<<<< HEAD
    digest.update(
      JSON.stringify([
        path.relative(directory, filename).split(path.sep).join('/'),
        content.length,
        sha(content),
      ])
    );
=======
    digest.update(JSON.stringify([path.relative(directory, filename).split(path.sep).join('/'), content.length, sha(content)]));
>>>>>>> origin/main
  }
  return { files: files.length, bytes, treeSha256: digest.digest('hex') };
}
function installedPackages(consumer, lock) {
  const result = [];
  function visitModules(directory) {
    if (!existsSync(directory)) return;
    function inspect(packageDirectory, expectedName) {
      const location = path.relative(consumer, packageDirectory).split(path.sep).join('/');
      const manifest = json(path.join(packageDirectory, 'package.json'));
      assert.equal(manifest.name, expectedName, `Installed package identity mismatch: ${location}`);
      packageName(manifest.name);
<<<<<<< HEAD
      assert.equal(
        lock.packages[location]?.version,
        manifest.version,
        `Physical installed package has no matching inventory/lock record: ${location}`
      );
      result.push({
        name: manifest.name,
        version: manifest.version,
        location,
        ...payload(packageDirectory),
      });
=======
      assert.equal(lock.packages[location]?.version, manifest.version, `Physical installed package has no matching inventory/lock record: ${location}`);
      result.push({ name: manifest.name, version: manifest.version, location, ...payload(packageDirectory) });
>>>>>>> origin/main
      visitModules(path.join(packageDirectory, 'node_modules'));
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const candidate = path.join(directory, entry.name);
<<<<<<< HEAD
      assert.ok(
        statSync(candidate).isDirectory(),
        `Unexpected node_modules artifact: ${candidate}`
      );
      if (entry.name.startsWith('@')) {
        for (const child of readdirSync(candidate))
          inspect(path.join(candidate, child), `${entry.name}/${child}`);
=======
      assert.ok(statSync(candidate).isDirectory(), `Unexpected node_modules artifact: ${candidate}`);
      if (entry.name.startsWith('@')) {
        for (const child of readdirSync(candidate)) inspect(path.join(candidate, child), `${entry.name}/${child}`);
>>>>>>> origin/main
      } else inspect(candidate, entry.name);
    }
  }
  visitModules(path.join(consumer, 'node_modules'));
  return result.sort((left, right) => left.location.localeCompare(right.location));
}
function recordCommand(evidence, name, command, args, cwd, env = {}, expectFailure = false) {
  const start = performance.now();
  const cleanEnv = { ...process.env, NODE_PATH: '', NODE_OPTIONS: '', ...env };
  delete cleanEnv.TSX_TSCONFIG_PATH;
<<<<<<< HEAD
  const result = spawnSync(command, args, {
    cwd,
    env: cleanEnv,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  writeFileSync(path.join(evidence, `${name}.stdout.log`), result.stdout ?? '');
  writeFileSync(path.join(evidence, `${name}.stderr.log`), result.stderr ?? '');
  save(path.join(evidence, `${name}.result.json`), {
    command,
    args,
    cwd,
    wallMs: performance.now() - start,
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
=======
  const result = spawnSync(command, args, { cwd, env: cleanEnv, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(path.join(evidence, `${name}.stdout.log`), result.stdout ?? '');
  writeFileSync(path.join(evidence, `${name}.stderr.log`), result.stderr ?? '');
  save(path.join(evidence, `${name}.result.json`), {
    command, args, cwd, wallMs: performance.now() - start,
    status: result.status, signal: result.signal, error: result.error?.message ?? null,
>>>>>>> origin/main
    environment: { NODE_PATH: '', NODE_OPTIONS: '', TSX_TSCONFIG_PATH: null },
  });
  if (name !== 'installed-tree') {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  if (expectFailure) {
<<<<<<< HEAD
    assert.equal(
      result.error,
      undefined,
      `${name} failed to start instead of reporting a source diagnostic`
    );
    assert.equal(
      result.signal,
      null,
      `${name} was killed instead of reporting a source diagnostic`
    );
    assert.ok(result.status !== null && result.status !== 0, `${name} unexpectedly succeeded`);
  } else if (result.error || result.status !== 0)
    throw new Error(
      `${name} failed: ${result.error?.message ?? `exit ${result.status}, signal ${result.signal}`}; see ${evidence}`
    );
=======
    assert.equal(result.error, undefined, `${name} failed to start instead of reporting a source diagnostic`);
    assert.equal(result.signal, null, `${name} was killed instead of reporting a source diagnostic`);
    assert.ok(result.status !== null && result.status !== 0, `${name} unexpectedly succeeded`);
  } else if (result.error || result.status !== 0) throw new Error(`${name} failed: ${result.error?.message ?? `exit ${result.status}, signal ${result.signal}`}; see ${evidence}`);
>>>>>>> origin/main
  return result;
}
function runNpm(evidence, name, args, consumer) {
  const npmCli = [path.dirname(process.execPath), ...(process.env.PATH ?? '').split(path.delimiter)]
<<<<<<< HEAD
    .filter(Boolean)
    .map((directory) => path.join(directory, 'node_modules/npm/bin/npm-cli.js'))
    .find(existsSync);
  if (process.platform === 'win32' && !npmCli) throw new Error('Cannot locate npm CLI on Windows');
  return recordCommand(
    evidence,
    name,
    npmCli ? process.execPath : 'npm',
    npmCli ? [npmCli, ...args] : args,
    consumer
  );
=======
    .filter(Boolean).map((directory) => path.join(directory, 'node_modules/npm/bin/npm-cli.js'))
    .find(existsSync);
  if (process.platform === 'win32' && !npmCli) throw new Error('Cannot locate npm CLI on Windows');
  return recordCommand(evidence, name, npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, consumer);
>>>>>>> origin/main
}

/** Copy real package payloads and reproduce Node's reachable dependency/peer graph. */
function copyInstalledClosure(consumer, dependencies, devDependencies, installedRoot) {
<<<<<<< HEAD
  const roots = [
    installedRoot,
    path.join(installedRoot, 'packages/compiler'),
    path.join(installedRoot, 'packages/adapters/react'),
  ];
=======
  const roots = [installedRoot, path.join(installedRoot, 'packages/compiler'), path.join(installedRoot, 'packages/adapters/react')];
>>>>>>> origin/main
  const store = path.join(installedRoot, 'node_modules/.pnpm');
  const storeEntries = existsSync(store) ? readdirSync(store).sort() : [];
  const records = new Map();
  const queue = [];
  const absentOptional = [];
  function manifestAt(directory, name) {
    if (!existsSync(path.join(directory, 'package.json'))) return undefined;
    const canonical = realpathSync(directory);
    const manifest = json(path.join(canonical, 'package.json'));
    if (manifest.name !== name) throw new Error(`Package identity mismatch: ${directory}`);
<<<<<<< HEAD
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version))
      throw new Error(`Non-exact package version: ${directory}`);
=======
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) throw new Error(`Non-exact package version: ${directory}`);
>>>>>>> origin/main
    return { source: canonical, manifest };
  }
  function rootPackage(name, version) {
    packageName(name);
    for (const root of roots) {
      const record = manifestAt(path.join(root, 'node_modules', name), name);
      if (record?.manifest.version === version) return record;
    }
    for (const entry of storeEntries) {
      const record = manifestAt(path.join(store, entry, 'node_modules', name), name);
      if (record?.manifest.version === version) return record;
    }
<<<<<<< HEAD
    throw new Error(
      `Offline package ${name}@${version} is not installed beneath ${installedRoot}; select registry mode or a complete installed package root`
    );
=======
    throw new Error(`Offline package ${name}@${version} is not installed beneath ${installedRoot}; select registry mode or a complete installed package root`);
>>>>>>> origin/main
  }
  function sourceDependency(name, importer) {
    packageName(name);
    let current = importer;
    while (within(installedRoot, current)) {
      if (path.basename(current) !== 'node_modules') {
        const record = manifestAt(path.join(current, 'node_modules', name), name);
        if (record) return record;
      }
      if (current === installedRoot) break;
      current = path.dirname(current);
    }
    return undefined;
  }
  function destinationDependency(name, importer) {
    let current = importer;
    while (within(consumer, current)) {
      const candidate = path.join(current, 'node_modules', name);
      if (records.has(candidate)) return records.get(candidate);
      if (current === consumer) break;
      current = path.dirname(current);
    }
    return undefined;
  }
  function copyPayload(source, destination) {
    mkdirSync(destination, { recursive: true });
    function copy(current, target, active = new Set()) {
      const canonical = realpathSync(current);
<<<<<<< HEAD
      if (!within(source, canonical))
        throw new Error(`Installed package payload escapes package root: ${current}`);
      if (active.has(canonical))
        throw new Error(`Cyclic installed package payload link: ${current}`);
=======
      if (!within(source, canonical)) throw new Error(`Installed package payload escapes package root: ${current}`);
      if (active.has(canonical)) throw new Error(`Cyclic installed package payload link: ${current}`);
>>>>>>> origin/main
      const info = statSync(current);
      if (info.isDirectory()) {
        mkdirSync(target, { recursive: true });
        const next = new Set(active).add(canonical);
        for (const entry of readdirSync(current, { withFileTypes: true })) {
          if (entry.name === 'node_modules') continue;
          copy(path.join(current, entry.name), path.join(target, entry.name), next);
        }
      } else if (info.isFile()) copyFileSync(current, target);
      else throw new Error(`Unsupported package payload: ${current}`);
    }
    copy(source, destination);
  }
  function add(record, destination, by) {
    const existing = records.get(destination);
    if (existing) {
<<<<<<< HEAD
      if (existing.source !== record.source)
        throw new Error(`Conflicting copied dependency at ${destination}`);
=======
      if (existing.source !== record.source) throw new Error(`Conflicting copied dependency at ${destination}`);
>>>>>>> origin/main
      existing.requiredBy.push(by);
      return existing;
    }
    copyPayload(record.source, destination);
    const result = { ...record, destination, requiredBy: [by] };
    records.set(destination, result);
    queue.push(result);
    return result;
  }
  for (const [name, version] of Object.entries({ ...dependencies, ...devDependencies })) {
    add(rootPackage(name, version), path.join(consumer, 'node_modules', name), '<consumer-root>');
  }
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index];
    const manifest = parent.manifest;
    const required = manifest.dependencies ?? {};
    const optional = manifest.optionalDependencies ?? {};
    const peers = manifest.peerDependencies ?? {};
<<<<<<< HEAD
    for (const name of new Set([
      ...Object.keys(required),
      ...Object.keys(optional),
      ...Object.keys(peers),
    ])) {
      packageName(name);
      const specifications = [optional[name] ?? required[name], peers[name]].filter(Boolean);
      if (specifications.some((specifier) => /^(?:workspace:|link:|file:)/.test(specifier)))
        throw new Error(`Unpacked local/workspace dependency: ${manifest.name} -> ${name}`);
      const source = sourceDependency(name, parent.source);
      const mayBeAbsent =
        Object.hasOwn(optional, name) ||
        (Object.hasOwn(peers, name) &&
          manifest.peerDependenciesMeta?.[name]?.optional === true &&
          !Object.hasOwn(required, name));
      if (!source) {
        if (!mayBeAbsent)
          throw new Error(
            `Incomplete offline closure: ${manifest.name}@${manifest.version} requires ${name}`
          );
=======
    for (const name of new Set([...Object.keys(required), ...Object.keys(optional), ...Object.keys(peers)])) {
      packageName(name);
      const specifications = [optional[name] ?? required[name], peers[name]].filter(Boolean);
      if (specifications.some((specifier) => /^(?:workspace:|link:|file:)/.test(specifier))) throw new Error(`Unpacked local/workspace dependency: ${manifest.name} -> ${name}`);
      const source = sourceDependency(name, parent.source);
      const mayBeAbsent = Object.hasOwn(optional, name) || (Object.hasOwn(peers, name) && manifest.peerDependenciesMeta?.[name]?.optional === true && !Object.hasOwn(required, name));
      if (!source) {
        if (!mayBeAbsent) throw new Error(`Incomplete offline closure: ${manifest.name}@${manifest.version} requires ${name}`);
>>>>>>> origin/main
        absentOptional.push({ importer: manifest.name, name, specifications });
        continue;
      }
      for (const specification of specifications) {
<<<<<<< HEAD
        if (
          /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(specification) &&
          specification !== source.manifest.version
        )
          throw new Error(
            `Installed edge version mismatch: ${manifest.name} requires ${name}@${specification}`
          );
      }
      const resolved = destinationDependency(name, parent.destination);
      if (resolved?.source === source.source) {
        resolved.requiredBy.push(`${manifest.name}@${manifest.version}`);
        continue;
      }
      const rootDestination = path.join(consumer, 'node_modules', name);
      const destination = !records.has(rootDestination)
        ? rootDestination
        : path.join(parent.destination, 'node_modules', name);
=======
        if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(specification) && specification !== source.manifest.version) throw new Error(`Installed edge version mismatch: ${manifest.name} requires ${name}@${specification}`);
      }
      const resolved = destinationDependency(name, parent.destination);
      if (resolved?.source === source.source) { resolved.requiredBy.push(`${manifest.name}@${manifest.version}`); continue; }
      const rootDestination = path.join(consumer, 'node_modules', name);
      const destination = !records.has(rootDestination) ? rootDestination : path.join(parent.destination, 'node_modules', name);
>>>>>>> origin/main
      add(source, destination, `${manifest.name}@${manifest.version}`);
    }
  }
  // Explicitly an inventory in npm-lock schema for the existing offline verifier, NOT an
  // npm-generated lock or registry/tarball integrity attestation. Real byte digests are below.
  const manifest = json(path.join(consumer, 'package.json'));
<<<<<<< HEAD
  const packages = {
    '': { name: manifest.name, version: manifest.version, dependencies, devDependencies },
  };
  const copied = [];
  for (const record of records.values()) {
    const location = path.relative(consumer, record.destination).split(path.sep).join('/');
    packages[location] = Object.fromEntries(
      [
        'name',
        'version',
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
        'os',
        'cpu',
      ]
        .filter((field) => record.manifest[field] !== undefined)
        .map((field) => [field, record.manifest[field]])
    );
    const original = payload(record.source);
    const delivered = payload(record.destination);
    assert.deepEqual(delivered, original, `Offline copy differs from package payload: ${location}`);
    copied.push({
      name: record.manifest.name,
      version: record.manifest.version,
      location,
      copiedFrom: record.source,
      requiredBy: [...new Set(record.requiredBy)].sort(),
      ...delivered,
    });
  }
  save(path.join(consumer, 'package-lock.json'), {
    name: manifest.name,
    version: manifest.version,
    lockfileVersion: 3,
    requires: true,
    _nativeSmokeOrigin: 'copied-closure-inventory-not-npm-install',
    packages,
  });
  return {
    mode: 'offline-payload-copy',
    provenance: 'Original installed payload bytes matched; no registry/tarball authenticity claim',
    packages: copied,
    absentOptional,
  };
}

async function compilerWorker(inputRoot, outputRoot, profile, evidence) {
  const timing = {
    scope:
      'No performance threshold or Adapter comparison. firstCompileFileMs excludes module loading; coldProcessStartToCompilationMs includes fresh-process initialization/imports. Project timings include source reads and semantic lowering/cache lookup in that already-loaded process. Command wall time includes the entire benchmark worker, not just its first compilation.',
    profile,
    node: process.version,
    typescript: ts.version,
  };
  timing.memory = {
    platform: process.platform,
    snapshotUnit: 'bytes',
    scope:
      'Whole compiler worker process, including module imports, retained compilations and evidence bookkeeping. Coarse process.memoryUsage snapshots; no forced GC, allocation count, per-component attribution or reclamation proof. arrayBuffers is included in external.',
    snapshots: [],
  };
  const memorySnapshot = (stage) =>
    timing.memory.snapshots.push({ stage, ...process.memoryUsage() });
  memorySnapshot('worker-initialized-after-module-imports');
  const entry = path.join(inputRoot, 'entry.proto.ts');
  try {
    const start = performance.now();
    const first = await compileFile(entry, { root: inputRoot, profile });
    timing.firstCompileFileMs = performance.now() - start;
    timing.coldProcessStartToCompilationMs = performance.now();
    memorySnapshot('first-compile-completed');
    save(
      path.join(evidence, 'compile-result.json'),
      first.ok ? { ok: true, profile: first.value.output.profile } : first
    );
    if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
    const artifacts = new Map(
      compilationArtifacts(first.value).map((artifact) => [artifact.path, artifact])
    );
    // Publish independent native components into one module closure. Shared key/style/scope
    // modules must be byte-identical and are delivered once, not copied per component.
    const provenance = JSON.parse(artifacts.get('provenance.json').contents);
    save(path.join(evidence, 'Component-compiler-provenance.json'), provenance);
    for (const [filename, componentName] of [
      ['provider.proto.ts', 'Provider'],
      ['context.proto.ts', 'ContextConsumer'],
    ]) {
      const compiled = await compileFile(path.join(inputRoot, filename), {
        root: inputRoot,
        profile,
        componentName,
      });
      save(
        path.join(evidence, `${componentName}-compile-result.json`),
        compiled.ok ? { ok: true } : compiled
      );
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const output = compiled.value.output;
      save(path.join(evidence, `${componentName}-compiler-provenance.json`), {
        ...output.provenance,
        profile: output.profile,
        dependencies: output.dependencies,
        sourceFiles: compiled.value.ir.sourceFiles.map((file) => ({
          file: file.file,
          sha256: file.sha256,
        })),
      });
      const extension = provenance.artifacts
        .find((file) => file.kind === 'source')
        .path.match(/\.[^.]+$/)[0];
      const sourcePath = componentName + extension;
      const candidates = compilationArtifacts(compiled.value, {
        sourcePath,
        manifestPath: `${componentName}.provenance.json`,
      });
      for (const artifact of candidates) {
        const previous = artifacts.get(artifact.path);
        if (previous)
          assert.equal(
            previous.contents,
            artifact.contents,
            `Incompatible shared artifact: ${artifact.path}`
          );
        else artifacts.set(artifact.path, artifact);
      }
      for (const file of compiled.value.ir.sourceFiles) {
        const previous = provenance.sourceFiles.find((item) => item.file === file.file);
        if (previous) assert.equal(previous.sha256, file.sha256);
        else provenance.sourceFiles.push({ file: file.file, sha256: file.sha256 });
      }
    }
    provenance.consumerAssembly =
      'Three separately compiled prototypes; deduplicated byte-identical supporting modules';
    provenance.artifacts = [...artifacts.values()]
      .filter((file) => file.path !== 'provenance.json')
      .map((file) => ({ path: file.path, kind: file.kind, sha256: sha(file.contents) }));
    artifacts.set('provenance.json', {
      path: 'provenance.json',
      kind: 'manifest',
      contents: JSON.stringify(provenance, null, 2) + '\n',
    });
    const written = await writeArtifactSet([...artifacts.values()], outputRoot);
    save(path.join(evidence, 'write-result.json'), written);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    memorySnapshot('three-component-artifacts-written');
    const options = { root: inputRoot, entries: ['entry.proto.ts'], profile };
    const coldStart = performance.now();
    let generation = await compileProject(options);
    timing.newProjectMs = performance.now() - coldStart;
    if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
    memorySnapshot('new-project-completed');
    timing.unchangedProject = [];
    for (let index = 0; index < 5; index++) {
      const sample = performance.now();
      generation = await compileProject(options, generation.value.project);
      if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
      timing.unchangedProject.push({
        ms: performance.now() - sample,
        cacheHit: generation.value.entries[0].cacheHit,
      });
    }
    memorySnapshot('five-unchanged-project-compilations-completed');
    const original = readFileSync(entry, 'utf8');
    try {
      writeFileSync(entry, original.replace('max:100', 'max:101'));
      const editedStart = performance.now();
      generation = await compileProject(options, generation.value.project);
      timing.editedProjectMs = performance.now() - editedStart;
      if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
      memorySnapshot('changed-project-completed');
      timing.editedCacheHit = generation.value.entries[0].cacheHit;
      timing.edit =
        'Numeric state upper bound changed from 100 to 101; generated consumer uses original bound';
      timing.originalGeneratedSha256 = sha(first.value.output.code);
      timing.editedGeneratedSha256 = sha(generation.value.entries[0].compilation.output.code);
      assert.equal(timing.editedCacheHit, false, 'Semantic input edit reused an old compilation');
      assert.notEqual(
        timing.originalGeneratedSha256,
        timing.editedGeneratedSha256,
        'Semantic input edit did not alter emitted output'
      );
    } finally {
      writeFileSync(entry, original);
    }
    // The same valid input is rejected only when the real host denies style projection.
    const rejection = await compileFile(entry, {
      root: inputRoot,
      profile: {
        profile,
        hostCapabilities: TARGET_PROFILES[profile].hostCapabilities.filter(
          (capability) => capability !== 'style-projection'
        ),
      },
    });
    save(path.join(evidence, 'unsupported-result.json'), rejection.ok ? { ok: true } : rejection);
    assert.equal(
      rejection.ok,
      false,
      'Capability-restricted host silently admitted style projection'
    );
    assert.ok(
      rejection.diagnostics.some(
        (diagnostic) => diagnostic.category === 'unsupported-input' && diagnostic.code === 'PUI4004'
      ),
      'Restricted control must fail host capability admission, not input syntax'
    );
  } finally {
    memorySnapshot('worker-finally');
    timing.memory.peakResidentSet = {
      value: process.resourceUsage().maxRSS,
      unit: 'KiB (1024 bytes)',
      platform: process.platform,
      scope:
        'Node process.resourceUsage().maxRSS: whole-process resident-set high-water mark through worker finally, including initialization/imports, all compilations and evidence bookkeeping; not sampled heap or per-compilation memory.',
=======
  const packages = { '': { name: manifest.name, version: manifest.version, dependencies, devDependencies } };
  const copied = [];
  for (const record of records.values()) {
    const location = path.relative(consumer, record.destination).split(path.sep).join('/');
    packages[location] = Object.fromEntries(['name', 'version', 'dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'os', 'cpu'].filter((field) => record.manifest[field] !== undefined).map((field) => [field, record.manifest[field]]));
    const original = payload(record.source);
    const delivered = payload(record.destination);
    assert.deepEqual(delivered, original, `Offline copy differs from package payload: ${location}`);
    copied.push({ name: record.manifest.name, version: record.manifest.version, location, copiedFrom: record.source, requiredBy: [...new Set(record.requiredBy)].sort(), ...delivered });
  }
  save(path.join(consumer, 'package-lock.json'), { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, _nativeSmokeOrigin: 'copied-closure-inventory-not-npm-install', packages });
  return { mode: 'offline-payload-copy', provenance: 'Original installed payload bytes matched; no registry/tarball authenticity claim', packages: copied, absentOptional };
}

async function compilerWorker(inputRoot, outputRoot, profile, evidence) {
  const timing = { scope: 'No performance threshold or Adapter comparison. firstCompileFileMs excludes module loading; coldProcessStartToCompilationMs includes fresh-process initialization/imports. Project timings include source reads and semantic lowering/cache lookup in that already-loaded process. Command wall time includes the entire benchmark worker, not just its first compilation.', profile, node: process.version, typescript: ts.version };
  timing.memory = {
    platform: process.platform, snapshotUnit: 'bytes',
    scope: 'Whole compiler worker process, including module imports, retained compilations and evidence bookkeeping. Coarse process.memoryUsage snapshots; no forced GC, allocation count, per-component attribution or reclamation proof. arrayBuffers is included in external.',
    snapshots: [],
  };
  const memorySnapshot = (stage) => timing.memory.snapshots.push({ stage, ...process.memoryUsage() });
  memorySnapshot('worker-initialized-after-module-imports');
  const entry = path.join(inputRoot, 'entry.proto.ts');
  try {
  const start = performance.now();
  const first = await compileFile(entry, { root: inputRoot, profile });
  timing.firstCompileFileMs = performance.now() - start;
  timing.coldProcessStartToCompilationMs = performance.now();
  memorySnapshot('first-compile-completed');
  save(path.join(evidence, 'compile-result.json'), first.ok ? { ok: true, profile: first.value.output.profile } : first);
  if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
  const artifacts = new Map(compilationArtifacts(first.value).map(artifact => [artifact.path, artifact]));
  // Publish independent native components into one module closure. Shared key/style/scope
  // modules must be byte-identical and are delivered once, not copied per component.
  const provenance = JSON.parse(artifacts.get('provenance.json').contents);
  save(path.join(evidence, 'Component-compiler-provenance.json'), provenance);
  for (const [filename, componentName] of [['provider.proto.ts', 'Provider'], ['context.proto.ts', 'ContextConsumer']]) {
    const compiled = await compileFile(path.join(inputRoot, filename), { root: inputRoot, profile, componentName });
    save(path.join(evidence, `${componentName}-compile-result.json`), compiled.ok ? { ok: true } : compiled);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const output = compiled.value.output;
    save(path.join(evidence, `${componentName}-compiler-provenance.json`), {
      ...output.provenance, profile: output.profile, dependencies: output.dependencies,
      sourceFiles: compiled.value.ir.sourceFiles.map(file => ({ file: file.file, sha256: file.sha256 })),
    });
    const extension = provenance.artifacts.find(file => file.kind === 'source').path.match(/\.[^.]+$/)[0];
    const sourcePath = componentName + extension;
    const candidates = compilationArtifacts(compiled.value, { sourcePath, manifestPath: `${componentName}.provenance.json` });
    for (const artifact of candidates) {
      const previous = artifacts.get(artifact.path);
      if (previous) assert.equal(previous.contents, artifact.contents, `Incompatible shared artifact: ${artifact.path}`);
      else artifacts.set(artifact.path, artifact);
    }
    for (const file of compiled.value.ir.sourceFiles) {
      const previous = provenance.sourceFiles.find(item => item.file === file.file);
      if (previous) assert.equal(previous.sha256, file.sha256);
      else provenance.sourceFiles.push({ file: file.file, sha256: file.sha256 });
    }
  }
  provenance.consumerAssembly = 'Three separately compiled prototypes; deduplicated byte-identical supporting modules';
  provenance.artifacts = [...artifacts.values()].filter(file => file.path !== 'provenance.json')
    .map(file => ({ path: file.path, kind: file.kind, sha256: sha(file.contents) }));
  artifacts.set('provenance.json', { path: 'provenance.json', kind: 'manifest', contents: JSON.stringify(provenance, null, 2) + '\n' });
  const written = await writeArtifactSet([...artifacts.values()], outputRoot);
  save(path.join(evidence, 'write-result.json'), written);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  memorySnapshot('three-component-artifacts-written');
  const options = { root: inputRoot, entries: ['entry.proto.ts'], profile };
  const coldStart = performance.now();
  let generation = await compileProject(options);
  timing.newProjectMs = performance.now() - coldStart;
  if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
  memorySnapshot('new-project-completed');
  timing.unchangedProject = [];
  for (let index = 0; index < 5; index++) {
    const sample = performance.now();
    generation = await compileProject(options, generation.value.project);
    if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
    timing.unchangedProject.push({ ms: performance.now() - sample, cacheHit: generation.value.entries[0].cacheHit });
  }
  memorySnapshot('five-unchanged-project-compilations-completed');
  const original = readFileSync(entry, 'utf8');
  try {
    writeFileSync(entry, original.replace('max:100', 'max:101'));
    const editedStart = performance.now();
    generation = await compileProject(options, generation.value.project);
    timing.editedProjectMs = performance.now() - editedStart;
    if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
    memorySnapshot('changed-project-completed');
    timing.editedCacheHit = generation.value.entries[0].cacheHit;
    timing.edit = 'Numeric state upper bound changed from 100 to 101; generated consumer uses original bound';
    timing.originalGeneratedSha256 = sha(first.value.output.code);
    timing.editedGeneratedSha256 = sha(generation.value.entries[0].compilation.output.code);
    assert.equal(timing.editedCacheHit, false, 'Semantic input edit reused an old compilation');
    assert.notEqual(timing.originalGeneratedSha256, timing.editedGeneratedSha256, 'Semantic input edit did not alter emitted output');
  } finally { writeFileSync(entry, original); }
  // The same valid input is rejected only when the real host denies style projection.
  const rejection = await compileFile(entry, { root: inputRoot, profile: {
    profile, hostCapabilities: TARGET_PROFILES[profile].hostCapabilities.filter(capability => capability !== 'style-projection'),
  } });
  save(path.join(evidence, 'unsupported-result.json'), rejection.ok ? { ok: true } : rejection);
  assert.equal(rejection.ok, false, 'Capability-restricted host silently admitted style projection');
  assert.ok(rejection.diagnostics.some((diagnostic) => diagnostic.category === 'unsupported-input' && diagnostic.code === 'PUI4004'), 'Restricted control must fail host capability admission, not input syntax');
  } finally {
    memorySnapshot('worker-finally');
    timing.memory.peakResidentSet = {
      value: process.resourceUsage().maxRSS, unit: 'KiB (1024 bytes)', platform: process.platform,
      scope: 'Node process.resourceUsage().maxRSS: whole-process resident-set high-water mark through worker finally, including initialization/imports, all compilations and evidence bookkeeping; not sampled heap or per-compilation memory.',
>>>>>>> origin/main
    };
    save(path.join(evidence, 'timing.json'), timing);
  }
}

const buildProgram = `import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const provenance=JSON.parse(readFileSync('generated/provenance.json','utf8'));
const sources=provenance.artifacts.filter(file=>file.kind==='source');
const checked=ts.createProgram(sources.map(file=>path.join('generated',file.path)),{
  noEmit:true,strict:true,skipLibCheck:true,allowJs:true,checkJs:false,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,
});
const typeErrors=ts.getPreEmitDiagnostics(checked).filter(item=>item.category===ts.DiagnosticCategory.Error);
writeFileSync('typecheck-diagnostics.json',JSON.stringify(typeErrors.map(item=>({file:item.file?.fileName,start:item.start,length:item.length,code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\\n')})),null,2)+'\\n');
if(typeErrors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(typeErrors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\\n'}));
const built=[];
const sourcePaths=new Set(sources.map(file=>file.path));
for(const file of sources){
  if(!/\\.(?:[cm]?tsx?|jsx?)$/.test(file.path))throw new Error('Unbuildable generated source '+file.path);
  const source=readFileSync(path.join('generated',file.path),'utf8');
  const executableImports=context=>{
    const visit=node=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)&&/^\\.\\.?\\//.test(node.moduleSpecifier.text)){
        const target=path.posix.normalize(path.posix.join(path.posix.dirname(file.path),node.moduleSpecifier.text));
        const resolved=sourcePaths.has(target)?target:['.ts','.tsx','.js','.jsx'].map(extension=>target+extension).find(candidate=>sourcePaths.has(candidate));
        if(!resolved)throw new Error('Generated helper import is not in the delivered artifact closure: '+file.path+' -> '+node.moduleSpecifier.text);
        let specifier=path.posix.relative(path.posix.dirname(file.path),resolved.replace(/\\.(?:[cm]?tsx?|jsx?)$/,'.js'));
        if(!specifier.startsWith('./')&&!specifier.startsWith('../'))specifier='./'+specifier;
        const literal=ts.setTextRange(ts.factory.createStringLiteral(specifier),node.moduleSpecifier);
        return ts.isImportDeclaration(node)?ts.factory.updateImportDeclaration(node,node.modifiers,node.importClause,literal,node.attributes):ts.factory.updateExportDeclaration(node,node.modifiers,node.isTypeOnly,node.exportClause,literal,node.attributes);
      }
      return ts.visitEachChild(node,visit,context);
    };
    return tree=>ts.visitNode(tree,visit);
  };
  const result=ts.transpileModule(source,{fileName:file.path,reportDiagnostics:true,transformers:{before:[executableImports]},compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,
    rewriteRelativeImportExtensions:true,sourceMap:true,inlineSources:true,removeComments:false,
  }});
  const errors=(result.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
  writeFileSync('build-diagnostics.json',JSON.stringify({source:file.path,diagnostics:(result.diagnostics??[]).map(item=>({code:item.code,category:item.category,start:item.start,length:item.length,message:ts.flattenDiagnosticMessageText(item.messageText,'\\n')}))},null,2)+'\\n');
  if(errors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\\n'}));
  const output=path.join('dist',file.path.replace(/\\.(?:[cm]?tsx?|jsx?)$/,'.js'));
  mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,result.outputText);
  if(!result.sourceMapText)throw new Error('Missing executable source map '+file.path);
  const map=JSON.parse(result.sourceMapText);
  if(!map.mappings||!map.sourcesContent?.includes(source))throw new Error('Executable map lost generated source '+file.path);
  writeFileSync(output+'.map',result.sourceMapText);
  built.push({source:file.path,output,bytes:Buffer.byteLength(result.outputText),map:output+'.map',mapBytes:Buffer.byteLength(result.sourceMapText)});
}
writeFileSync('build-report.json',JSON.stringify({typescript:ts.version,mode:'Strict target/helper TypeScript check followed by executable ESM emission; JavaScript component bodies are not checkJs-validated',typecheck:{errors:typeErrors.length,checkJs:false},files:built},null,2)+'\\n');
console.log('NATIVE_BUILD_OK',JSON.stringify(built));`;

const runtimeProgram = `import assert from 'node:assert/strict';
import {writeFileSync,realpathSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const profile=process.argv[2];
const templateTag=process.argv[3]==='edited'?'article':'section';
const trace={profile,sourceOwnership:process.argv[3]??'original',surface:'Real framework/custom-element mount in Happy DOM, not a native browser',comparison:'native-only / one-sided',steps:[],phases:[],transitions:[],resolutions:[],errors:[],measurements:{scope:'Single performance.now observations including target scheduling/Happy DOM; not browser latency, throughput or a speed comparison. Memory is separately scoped whole-process sampling, not per-operation allocations.',updates:[]}};
trace.measurements.memory={platform:process.platform,snapshotUnit:'bytes',scope:'Coarse process.memoryUsage snapshots for this isolated Node runtime, including framework imports, Happy DOM and evidence bookkeeping. No forced GC, exact heap allocation counts, per-component attribution, reclamation or native-browser/layout claim. Held owner/state/method/DOM references are intentionally retained by the harness; arrayBuffers is included in external.',snapshots:[]};
const save=()=>writeFileSync('runtime-trace.json',JSON.stringify(trace,null,2)+'\\n');
const memorySnapshot=stage=>trace.measurements.memory.snapshots.push({stage,...process.memoryUsage()});
memorySnapshot('runtime-initialized-before-happy-dom-import');save();
const root=realpathSync(process.cwd());
const inside=file=>{const rel=path.relative(root,realpathSync(file));return !path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);};
function resolution(name){const resolved=require.resolve(name);assert.ok(inside(resolved),'Runtime import escaped isolated consumer: '+name);trace.resolutions.push({name,resolved});return resolved;}
resolution('happy-dom');
const {Window}=await import('happy-dom');
const window=new Window({url:'http://native-consumer.invalid/'});
for(const key of ['window','self','document','navigator','Node','Element','HTMLElement','SVGElement','ShadowRoot','Text','Comment','Event','CustomEvent','MouseEvent','MutationObserver','DOMParser','customElements']){
  Object.defineProperty(globalThis,key,{value:key==='window'||key==='self'?window:window[key],configurable:true,writable:true});
}
for(const key of ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])globalThis[key]=window[key].bind(window);
window.addEventListener('error',event=>{trace.errors.push(String(event.error??event.message));save();});
let driver;
let module;
let state;
const microtasks=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const recordPhase=kind=>{trace.phases.push({kind,text:driver?.query()?.textContent??null});save();};
const outer=document.createElement('div');document.body.append(outer);
try{
  memorySnapshot('happy-dom-initialized-before-component-import');
  const initializationStart=performance.now();
  module=await import('./dist/Component.js');
  const Generated=module.CompiledComponent??module.default;
  const initial={seed:2,visible:true};
  if(profile==='react-dom-source-v1'){
    resolution('react');resolution('react-dom/client');
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const React=await import('react');const {createRoot}=await import('react-dom/client');
    const ref=React.createRef();const root=createRoot(outer);
    const transact=async callback=>React.act(async()=>{callback();await microtasks();});
    driver={query:()=>outer.querySelector('section'),handle:()=>ref.current,transact,
      change:props=>transact(()=>root.render(React.createElement(Generated,{...props,ref,onPhase:recordPhase}))),
      destroy:()=>root.unmount()};
    await driver.change(initial);
  }else if(profile==='vue-source-v1'){
    resolution('vue');const Vue=await import('vue');
    const input=Vue.shallowRef(initial);const ref=Vue.shallowRef();
    const transact=async callback=>{callback();await microtasks();await Vue.nextTick();await microtasks();await Vue.nextTick();};
    const app=Vue.createApp({setup(){return()=>Vue.h(Generated,{...input.value,ref,onPhase:recordPhase});}});
    app.config.errorHandler=error=>{trace.errors.push(String(error));save();};
    driver={query:()=>outer.querySelector('section'),handle:()=>ref.value,transact,
      change:props=>transact(()=>{input.value=props;}),destroy:()=>app.unmount()};
    app.mount(outer);await transact(()=>{});
  }else if(profile==='vue2-source-v1'){
    resolution('vue');const Vue=(await import('vue')).default;Vue.config.productionTip=false;Vue.config.devtools=false;
    Vue.config.errorHandler=error=>{trace.errors.push(String(error));save();};
    const mount=document.createElement('div');outer.append(mount);
    const vm=new Vue({data(){return{input:initial};},render(h){return h(Generated,{ref:'generated',props:this.input,on:{phase:recordPhase}});}});
    const transact=async callback=>{callback();await microtasks();await Vue.nextTick();await microtasks();await Vue.nextTick();};
    driver={query:()=>outer.querySelector('section'),handle:()=>vm.$refs.generated,transact,
      change:props=>transact(()=>{vm.input=props;}),destroy:()=>{vm.$destroy();vm.$el.remove();}};
    vm.$mount(mount);await transact(()=>{});
  }else if(profile==='web-component-source-v1'){
    module.register('native-consumer-counter');
    const element=document.createElement('native-consumer-counter');
    element.addEventListener('phase',event=>recordPhase(event.detail));
    const transact=async callback=>{callback();await microtasks();};
    driver={query:()=>element.shadowRoot?.querySelector('section')??null,handle:()=>element,
      transact,
      change:props=>transact(()=>element.setProps(props)),
      destroy:()=>{element.dispose();element.remove();},
      move:()=>transact(()=>{const other=document.createElement('div');document.body.append(other);other.append(element);})};
    element.setProps(initial);outer.append(element);await microtasks();
  }else throw new Error('Unsupported runtime profile '+profile);
  trace.measurements.initializationMs=performance.now()-initializationStart;
  driver.query=()=>profile==='web-component-source-v1'?driver.handle().shadowRoot?.querySelector(templateTag)??null:outer.querySelector(templateTag);
  driver.host=()=>profile==='web-component-source-v1'?driver.handle():outer.querySelector('[data-pui-root]');
  const transact=driver.transact;
  driver.transact=async callback=>{const start=performance.now();await transact(callback);trace.measurements.updates.push({operation:'owner transaction (including framework flush)',ms:performance.now()-start});};
  const change=driver.change;
  driver.change=async props=>{const start=performance.now();await change(props);trace.measurements.updates.push({operation:'raw props change (including framework flush)',ms:performance.now()-start});};
  const owner=driver.handle();assert.ok(owner,'Mount did not publish its public owner');
  const exposed=owner.getExposes();state=exposed.count;const write=exposed.write;
  const initialRoot=driver.host();const observedRoots=new Set();
  trace.resources={scope:'Numeric component only: observed public owner/held-handle identities, DOM Root connectivity and authored lifecycle callbacks. Framework Root means [data-pui-root] wrapper; custom-element Root means its host, which can remain connected while its view is detached. Live Root counts cover observed nodes that remain connected, not all process resources. The reattach replacement count compares the final reattached Root with the mounted Root; transient unobserved replacements are unavailable. Distinct observed Root identities are not allocation counts; retained disconnected DOM references are not live Roots or GC evidence. Published handle absence is not owner disposal; held-handle identities are reported separately. Epoch/instance counts derive from mounted/unmounted/created/disposed callbacks, not internal instrumentation. Context components are not included.',observations:[]};
  const observeResources=(step,terminal=false)=>{
    const currentRoot=driver.host();if(currentRoot)observedRoots.add(currentRoot);
    if(profile!=='web-component-source-v1')for(const node of outer.querySelectorAll('[data-pui-root]'))observedRoots.add(node);
    const observation={step,liveRootCount:[...observedRoots].filter(node=>node.isConnected).length,distinctObservedRootCount:observedRoots.size,initialRootConnected:initialRoot?.isConnected??false,viewPresent:driver.query()!==null};
    if(!terminal){const published=driver.handle();observation.ownerIdentity={publishedHandleAvailable:published!=null,publishedHandleMatchesMountedOwner:published===owner,heldStateMatchesMountedState:owner.getExposes().count===state,heldMethodMatchesMountedMethod:owner.getExposes().write===write};}
    trace.resources.lifecycle={createdInstanceCount:trace.phases.filter(item=>item.kind==='created').length,mountedEpochCount:trace.phases.filter(item=>item.kind==='mounted').length,unmountedEpochCount:trace.phases.filter(item=>item.kind==='unmounted').length,disposedInstanceCount:trace.phases.filter(item=>item.kind==='disposed').length,updatedCallbackCount:trace.phases.filter(item=>item.kind==='updated').length};
    if(step==='rebind-view')trace.resources.replacementRootCountAcrossReattach=currentRoot===null?null:Number(currentRoot!==initialRoot);
    if(terminal)trace.resources.terminalLiveRootCount=observation.liveRootCount;
    trace.resources.observations.push(observation);
  };
  const tokens=()=>driver.host()?.getAttribute('data-pui-style')?.split(' ').filter(Boolean)??[];
  const styled=expected=>assert.deepEqual([...tokens()].sort(),[...expected].sort());
  const observe=step=>{const measurement=trace.measurements.updates.at(-1);if(measurement)measurement.step=step;trace.steps.push({step,text:driver.query()?.textContent??null,value:state.get(),style:tokens(),phases:trace.phases.map(item=>item.kind)});memorySnapshot(step);observeResources(step);save();};
  const visible=(text)=>assert.equal(driver.query()?.textContent,text);
  observe('mount');visible('2');assert.equal(state.get(),2);
  styled(['bg-white','opacity-100']);assert.equal(driver.query().getAttribute('data-pui-style'),'text-white');
  assert.equal(driver.query().parentElement,profile==='web-component-source-v1'?null:driver.host(),'Template must be inside the single Root');
  assert.deepEqual(trace.phases.map(item=>item.kind),['created','mounted']);
  const off=state.subscribe(event=>{trace.transitions.push({prev:event.prev,next:event.next,reason:event.reason??null});save();});
  const stableRoot=driver.host();
  await driver.transact(()=>{write(7);styled(['bg-red','opacity-100']);});observe('write-without-update');visible('2');assert.equal(state.get(),7);assert.equal(exposed.read(),7);
  assert.equal(driver.host(),stableRoot);assert.deepEqual(trace.phases.map(item=>item.kind),['created','mounted']);
  assert.deepEqual(trace.transitions.map(item=>[item.prev,item.next]),[[2,7]]);
  const styleUpdates=trace.phases.filter(item=>item.kind==='updated').length;
  const hostPropsUpdate=profile==='vue2-source-v1'||profile==='web-component-source-v1';
  trace.hostPropsPolicy=hostPropsUpdate?'Host props replacement explicitly requests semantic update':'Only authored run.update requests semantic update';
  const propsText=hostPropsUpdate?'7':'2';
  await driver.change({seed:2,visible:true,active:true});observe('later-rule-wins');styled(['bg-black','opacity-40']);visible(propsText);
  await driver.change({seed:2,visible:true,active:true,patch:1});observe('patch-over-rule');styled(['bg-blue','opacity-40']);
  await driver.change({seed:2,visible:true,active:true,patch:2});observe('suppress-group');styled(['opacity-40']);
  await driver.change({seed:2,visible:true,active:true,patch:0});observe('clear-patch-restores-rule');styled(['bg-black','opacity-40']);
  await driver.change({seed:2,visible:true,active:false});observe('withdraw-later-rule');styled(['bg-red','opacity-100']);visible(propsText);
  assert.equal(trace.phases.filter(item=>item.kind==='updated').length-styleUpdates,hostPropsUpdate?5:0,'Host props update policy produced the wrong completed update count');assert.equal(driver.host(),stableRoot);
  await driver.transact(()=>owner.update());observe('explicit-update');visible('7');assert.equal(trace.phases.at(-1).kind,'updated');
  await driver.change({seed:2,visible:false,active:true,patch:1});observe('detach-view');assert.equal(driver.query(),null);
  assert.equal(owner.getExposes().count,state);assert.equal(trace.phases.at(-1).kind,'unmounted');
  await driver.transact(()=>{write(9);owner.update();});observe('write-and-update-while-detached');assert.equal(driver.query(),null);assert.equal(state.get(),9);
  assert.deepEqual(trace.transitions.map(item=>[item.prev,item.next]),[[2,7],[7,9]]);
  await driver.change({seed:2,visible:true,active:true,patch:1});observe('rebind-view');visible('9');
  styled(['bg-blue','opacity-40']);assert.equal(driver.query().getAttribute('data-pui-style'),'text-white');
  assert.equal(owner.getExposes().count,state);assert.equal(owner.getExposes().write,write);assert.equal(trace.phases.at(-1).kind,'mounted');
  await driver.change({seed:2,visible:true,active:true,patch:0});observe('replayed-patch-clear');styled(['bg-black','opacity-40']);
  await driver.change({seed:2,visible:true,active:false,patch:0});observe('replayed-rule-withdraw');styled(['bg-white','opacity-100']);
  if(driver.move){await driver.move();observe('synchronous-native-dom-move');visible('9');assert.equal(driver.handle().getExposes().count,state);}
  off();await driver.transact(()=>write(11));observe('unsubscribed-write');visible('9');assert.equal(trace.transitions.length,2);
  await driver.transact(()=>owner.update());observe('second-explicit-update');visible('11');
  await driver.change({seed:6,visible:true});observe('props-watch-update');visible('6');assert.equal(state.get(),6);
  await driver.change({visible:true});observe('withdraw-prop-to-default');visible('2');assert.equal(state.get(),2);
  const updatesBeforeDisposal=trace.phases.filter(item=>item.kind==='updated').length;
  const terminalRoot=driver.host();const teardownStart=performance.now();
  // A queued update cannot outlive terminal disposal, regardless of target scheduling.
  await transact(()=>{write(12);owner.update();driver.destroy();});await microtasks();
  trace.measurements.teardownMs=performance.now()-teardownStart;
  memorySnapshot('terminal-dispose');observeResources('terminal-dispose',true);save();
  assert.equal(terminalRoot.hasAttribute('data-pui-style'),false,'Disposal left helper-owned projection');
  assert.equal(driver.query(),null);
  assert.equal(trace.phases.filter(item=>item.kind==='updated').length,updatesBeforeDisposal,'Queued update committed after disposal');
  assert.throws(()=>write(1));assert.throws(()=>state.get());assert.throws(()=>state.subscribe(()=>{}));
  trace.steps.push({step:'terminal-dispose',text:null,heldMethodInvalid:true,heldStateInvalid:true,heldSubscriptionInvalid:true});save();
  assert.equal(trace.phases.filter(item=>item.kind==='created').length,1);
  assert.equal(trace.phases.filter(item=>item.kind==='mounted').length,2);
  assert.equal(trace.phases.filter(item=>item.kind==='unmounted').length,2);
  assert.equal(trace.phases.filter(item=>item.kind==='disposed').length,1);
  // Framework composition is authored here in the clean consumer, not encoded as
  // a PrototypeRef or evaluated portable source. Both modules import the same key.
  const providerModule=await import('./dist/Provider.js');
  const consumerModule=await import('./dist/ContextConsumer.js');
  const Provider=providerModule.Provider??providerModule.default;
  const Consumer=consumerModule.ContextConsumer??consumerModule.default;
  const contextHost=document.createElement('div');document.body.append(contextHost);
  let contextDriver;
  const contextStart=performance.now();
  if(profile==='react-dom-source-v1'){
    const React=await import('react');const {createRoot}=await import('react-dom/client');
    const ref=React.createRef();const contextRoot=createRoot(contextHost);
    const change=seed=>React.act(async()=>{contextRoot.render(React.createElement(Provider,{seed},React.createElement(Consumer,{ref})));await microtasks();});
    contextDriver={change,handle:()=>ref.current,query:()=>contextHost.querySelector('output'),destroy:()=>React.act(async()=>{contextRoot.unmount();await microtasks();})};
    await change(31);
  }else if(profile==='vue-source-v1'){
    const Vue=await import('vue');const seed=Vue.shallowRef(31);const ref=Vue.shallowRef();
    const app=Vue.createApp({setup(){return()=>Vue.h(Provider,{seed:seed.value},{default:()=>Vue.h(Consumer,{ref})});}});
    app.config.errorHandler=error=>{trace.errors.push(String(error));save();};
    const flush=async()=>{await microtasks();await Vue.nextTick();await microtasks();await Vue.nextTick();};
    contextDriver={change:async next=>{seed.value=next;await flush();},handle:()=>ref.value,query:()=>contextHost.querySelector('output'),destroy:async()=>{app.unmount();await flush();}};
    app.mount(contextHost);await flush();
  }else if(profile==='vue2-source-v1'){
    const Vue=(await import('vue')).default;
    const mount=document.createElement('div');contextHost.append(mount);
    const vm=new Vue({data(){return{seed:31};},render(h){return h(Provider,{props:{seed:this.seed}},[h(Consumer,{ref:'context'})]);}});
    const flush=async()=>{await microtasks();await Vue.nextTick();await microtasks();await Vue.nextTick();};
    contextDriver={change:async next=>{vm.seed=next;await flush();},handle:()=>vm.$refs.context,query:()=>contextHost.querySelector('output'),destroy:async()=>{vm.$destroy();vm.$el.remove();await flush();}};
    vm.$mount(mount);await flush();
  }else{
    providerModule.register('native-consumer-provider');consumerModule.register('native-consumer-context');
    const parent=document.createElement('native-consumer-provider');const child=document.createElement('native-consumer-context');
    parent.setProps({seed:31});parent.append(child);contextHost.append(parent);await microtasks();
    contextDriver={change:async next=>{parent.setProps({seed:next});await microtasks();},handle:()=>child,query:()=>child.shadowRoot?.querySelector('output'),destroy:async()=>{child.dispose();parent.dispose();parent.remove();await microtasks();}};
  }
  trace.context={initializationMs:performance.now()-contextStart,steps:[]};
  memorySnapshot('context-mount');
  const contextOwner=contextDriver.handle();assert.ok(contextOwner);
  const heldValue=contextOwner.getExposes().value;const heldMissing=contextOwner.getExposes().missing;
  const contextObserve=step=>{const value=heldValue.get();const missing=heldMissing.get();const text=contextDriver.query()?.textContent;trace.context.steps.push({step,value,missing,text});save();return{value,missing,text};};
  assert.deepEqual(contextObserve('shared-key-mount'),{value:31,missing:true,text:'31'});
  const contextUpdateStart=performance.now();await contextDriver.change(47);
  trace.context.updateMs=performance.now()-contextUpdateStart;
  memorySnapshot('context-provider-update');
  assert.deepEqual(contextObserve('provider-update-crosses-module-boundary'),{value:47,missing:true,text:'47'});
  assert.equal(contextDriver.handle(),contextOwner);assert.equal(contextOwner.getExposes().value,heldValue);
  const contextTeardownStart=performance.now();await contextDriver.destroy();trace.context.teardownMs=performance.now()-contextTeardownStart;
  memorySnapshot('context-dispose');
  assert.equal(contextDriver.query(),null);assert.throws(()=>heldValue.get());assert.throws(()=>heldMissing.get());
  assert.equal(trace.errors.length,0,'Framework/DOM reported runtime errors');
  trace.queuedDisposal={updatesBeforeDisposal,updatesAfterDisposal:trace.phases.filter(item=>item.kind==='updated').length};
  trace.ok=true;save();console.log('NATIVE_RUNTIME_OK',profile,JSON.stringify(trace.steps));
}catch(error){trace.ok=false;trace.failure={message:error.message,stack:error.stack};memorySnapshot('runtime-failure');save();throw error;}
finally{await window.happyDOM.abort();window.close();memorySnapshot('happy-dom-disposed');save();}`;

function declarationCosts(filename) {
  const code = readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const declarations = [];
  for (const node of source.statements) {
<<<<<<< HEAD
    if (
      !(
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isVariableStatement(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
      )
    )
      continue;
    const exported = node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    const names = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map((item) => item.name.getText(source))
      : [node.name?.text ?? '<anonymous>'];
    const start = node.getStart(source);
    declarations.push({
      names,
      exported: !!exported,
      erasedType: ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node),
      start,
      end: node.end,
      bytes: Buffer.byteLength(code.slice(start, node.end)),
    });
=======
    if (!(ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableStatement(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))) continue;
    const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    const names = ts.isVariableStatement(node) ? node.declarationList.declarations.map((item) => item.name.getText(source)) : [node.name?.text ?? '<anonymous>'];
    const start = node.getStart(source);
    declarations.push({ names, exported: !!exported, erasedType: ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node), start, end: node.end, bytes: Buffer.byteLength(code.slice(start, node.end)) });
>>>>>>> origin/main
  }
  return declarations;
}
function importCosts(filename) {
  const code = readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
<<<<<<< HEAD
  return source.statements
    .filter(
      (node) =>
        ts.isImportDeclaration(node) ||
        ts.isImportEqualsDeclaration(node) ||
        (ts.isExportDeclaration(node) && node.moduleSpecifier)
    )
    .map((node) => ({
      start: node.getStart(source),
      end: node.end,
      bytes: Buffer.byteLength(code.slice(node.getStart(source), node.end)),
    }));
=======
  return source.statements.filter((node) => ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier))
    .map((node) => ({ start: node.getStart(source), end: node.end, bytes: Buffer.byteLength(code.slice(node.getStart(source), node.end)) }));
>>>>>>> origin/main
}
async function checkAndMeasure(consumer, evidence, profile, delivery) {
  // Audit the entire physical installation, including smoke tooling, not just its lock.
  filesUnder(path.join(consumer, 'node_modules'));
  const provenance = json(path.join(consumer, 'generated/provenance.json'));
  assert.equal(provenance.profile, profile.id);
  assert.deepEqual(provenance.dependencies, profile.dependencies);
<<<<<<< HEAD
  for (const dependency of provenance.dependencies)
    assert.equal(
      dependency.role,
      'target',
      `Native output retained a ${dependency.role} dependency`
    );
  for (const helper of provenance.helpers ?? profile.helpers) {
    assert.equal(
      helper.classification,
      'native-lowering',
      `Native output retained unsupported helper ${helper.name}`
    );
=======
  for (const dependency of provenance.dependencies) assert.equal(dependency.role, 'target', `Native output retained a ${dependency.role} dependency`);
  for (const helper of provenance.helpers ?? profile.helpers) {
    assert.equal(helper.classification, 'native-lowering', `Native output retained unsupported helper ${helper.name}`);
>>>>>>> origin/main
    assert.notEqual(helper.delivery, 'dependency', `Native helper dependency leak: ${helper.name}`);
  }
  const sourceFiles = provenance.artifacts.filter((file) => file.kind === 'source');
  assert.ok(sourceFiles.length, 'Compiler produced no source artifacts');
<<<<<<< HEAD
  assert.equal(
    sourceFiles.filter((file) => file.path === '.proto-ui/style/native-v1.ts').length,
    1,
    'Shared native style artifact must be delivered exactly once'
  );
  assert.equal(
    sourceFiles.filter((file) => file.path === '.proto-ui/context/scope-v1.ts').length,
    1,
    'Shared Context scope must be delivered exactly once'
  );
  assert.equal(
    sourceFiles.filter((file) => /^\.proto-ui\/context\/key-/.test(file.path)).length,
    2,
    'Distinct declarations with the same debug name need distinct reference artifacts'
  );
  for (const artifact of provenance.artifacts) {
    assert.ok(
      ['source', 'source-map', 'declaration', 'manifest'].includes(artifact.kind),
      `Unsupported generated artifact kind: ${artifact.kind}`
    );
    const filename = path.resolve(consumer, 'generated', artifact.path);
    assert.ok(
      within(path.join(consumer, 'generated'), filename),
      'Compiler artifact escaped output directory'
    );
    assert.equal(
      sha(readFileSync(filename)),
      artifact.sha256,
      `Artifact digest mismatch: ${artifact.path}`
    );
    if (artifact.kind === 'source-map') {
      const map = json(filename);
      assert.equal(map.version, 3);
      assert.ok(
        map.mappings && map.sources.length && map.sourcesContent?.length === map.sources.length,
        `Original portable-to-generated source map is incomplete: ${artifact.path}`
      );
=======
  assert.equal(sourceFiles.filter(file => file.path === '.proto-ui/style/native-v1.ts').length, 1, 'Shared native style artifact must be delivered exactly once');
  assert.equal(sourceFiles.filter(file => file.path === '.proto-ui/context/scope-v1.ts').length, 1, 'Shared Context scope must be delivered exactly once');
  assert.equal(sourceFiles.filter(file => /^\.proto-ui\/context\/key-/.test(file.path)).length, 2, 'Distinct declarations with the same debug name need distinct reference artifacts');
  for (const artifact of provenance.artifacts) {
    assert.ok(['source', 'source-map', 'declaration', 'manifest'].includes(artifact.kind), `Unsupported generated artifact kind: ${artifact.kind}`);
    const filename = path.resolve(consumer, 'generated', artifact.path);
    assert.ok(within(path.join(consumer, 'generated'), filename), 'Compiler artifact escaped output directory');
    assert.equal(sha(readFileSync(filename)), artifact.sha256, `Artifact digest mismatch: ${artifact.path}`);
    if (artifact.kind === 'source-map') {
      const map = json(filename);
      assert.equal(map.version, 3);
      assert.ok(map.mappings && map.sources.length && map.sourcesContent?.length === map.sources.length, `Original portable-to-generated source map is incomplete: ${artifact.path}`);
>>>>>>> origin/main
    }
  }
  // Keep compiler provenance untouched. This explicitly dependency-only projection lets
  // the existing verifier inspect imports/packages while concrete helper bytes are measured
  // below (profile helper labels are not the emitter's collision-safe declaration names).
  const dependencyProvenance = { ...provenance };
  delete dependencyProvenance.helpers;
  save(path.join(consumer, 'dependency-provenance.json'), dependencyProvenance);
<<<<<<< HEAD
  const expected = {
    profile: profile.id,
    dependencies: profile.dependencies,
    generatedFiles: sourceFiles.map((file) => `generated/${file.path}`),
    provenanceFile: 'dependency-provenance.json',
  };
  const closure = await verifyConsumerClosure(consumer, expected);
  save(path.join(evidence, 'closure-result.json'), closure);
  if (!closure.ok) throw new Error(JSON.stringify(closure.failures));
  assert.equal(
    closure.value.internal.length,
    0,
    'Native output reaches an internal Proto-UI package'
  );
  mkdirSync(path.join(consumer, 'negative-controls'));
  const negativeSource = path.join(consumer, 'negative-controls/import.ts');
  writeFileSync(negativeSource, "import '@proto.ui/runtime';\n");
  const importNegative = await verifyConsumerClosure(consumer, {
    ...expected,
    generatedFiles: [...expected.generatedFiles, 'negative-controls/import.ts'],
  });
  assert.equal(importNegative.ok, false, 'Closure accepted a hidden Runtime import');
  assert.ok(importNegative.failures.some((failure) => failure.code === 'undeclared-import'));
  const helperNegative = await verifyConsumerClosure(consumer, {
    ...expected,
    helpers: [
      {
        name: '__missingNativeHelperNegativeControl',
        version: '1',
        classification: 'native-lowering',
        delivery: 'inline',
      },
    ],
  });
  assert.equal(helperNegative.ok, false, 'Closure accepted an absent helper');
  assert.ok(helperNegative.failures.some((failure) => failure.code === 'missing-helper'));
  save(path.join(evidence, 'closure-negative-controls.json'), {
    importLeak: importNegative,
    absentHelper: helperNegative,
  });
  const sources = sourceFiles.map((file) => {
    const filename = path.join(consumer, 'generated', file.path);
    return {
      path: file.path,
      bytes: statSync(filename).size,
      sha256: sha(readFileSync(filename)),
      declarations: declarationCosts(filename),
      importStatements: importCosts(filename),
    };
  });
  const packages = [...closure.value.external].map((record) => ({
    name: record.name,
    version: record.version,
    location: record.lockPath,
    roles: record.roles,
    ...payload(record.realPath),
  }));
  const lock = json(path.join(consumer, 'package-lock.json'));
  const allPackages = installedPackages(consumer, lock);
  for (const [name, version] of Object.entries(toolVersions))
    assert.equal(
      allPackages.find((record) => record.location === `node_modules/${name}`)?.version,
      version,
      `Smoke tooling version mismatch: ${name}`
    );
  const costs = {
    profile: profile.id,
    targetVersion: profile.version,
    dependencyDelivery: delivery.mode,
    comparison: {
      mode: 'native-only / one-sided',
      reference: null,
      claim:
        'No independently installed packed Adapter closure is exercised; no faster or parity claim',
    },
    measurement:
      'Size fields are actual uncompressed UTF-8/source and installed regular-file payload bytes; no gzip, tree-shaking or shared amortization claim. Compiler memory and runtime observations have separate whole-process/DOM scopes; no exact allocation, native-browser/layout or Adapter comparison claim.',
    compilerMemory: json(path.join(evidence, 'timing.json')).memory,
    unavailableMeasurements: {
      exactHeapAllocationCounts:
        'No allocation instrumentation; memoryUsage snapshots and maxRSS are not allocation counts.',
      nativeBrowserLayoutPerformance:
        'Happy DOM is not a native browser and supplies no layout-performance oracle.',
      adapterRelativePerformance:
        'No independently installed packed Adapter baseline is exercised.',
    },
    compilerProvenanceBytes: statSync(path.join(consumer, 'generated/provenance.json')).size,
    emittedSourceBytes: sources.reduce((sum, file) => sum + file.bytes, 0),
    emittedSupportingSourceBytes: sources
      .filter((file) => file.path.startsWith('.proto-ui/'))
      .reduce((sum, file) => sum + file.bytes, 0),
    emittedSourceMapBytes: provenance.artifacts
      .filter((file) => file.kind === 'source-map')
      .reduce((sum, file) => sum + statSync(path.join(consumer, 'generated', file.path)).size, 0),
    imports: closure.value.imports,
    importCount: closure.value.imports.length,
    staticImportStatementBytes: sources.reduce(
      (sum, file) =>
        sum + file.importStatements.reduce((total, statement) => total + statement.bytes, 0),
      0
    ),
    declaredHelperMetadata: provenance.helpers ?? profile.helpers,
    helperMeasurement:
      'Exact top-level declaration spans; unexported executable declarations are an inline-lowering footprint, not a one-to-one attestation of metadata helper names. Supporting modules are additionally reported whole, without subtracting their imports/types/comments.',
    inlineExecutableDeclarationBytes: sources.reduce(
      (sum, file) =>
        sum +
        file.declarations
          .filter((item) => !item.exported && !item.erasedType)
          .reduce((total, item) => total + item.bytes, 0),
      0
    ),
    sources,
    outputDependencyPackages: packages,
    outputDependencyPayloadBytes: packages.reduce((sum, record) => sum + record.bytes, 0),
    allInstalledPackagesIncludingSmokeTooling: allPackages,
    allInstalledPayloadBytesIncludingSmokeTooling: allPackages.reduce(
      (sum, record) => sum + record.bytes,
      0
    ),
=======
  const expected = { profile: profile.id, dependencies: profile.dependencies, generatedFiles: sourceFiles.map((file) => `generated/${file.path}`), provenanceFile: 'dependency-provenance.json' };
  const closure = await verifyConsumerClosure(consumer, expected);
  save(path.join(evidence, 'closure-result.json'), closure);
  if (!closure.ok) throw new Error(JSON.stringify(closure.failures));
  assert.equal(closure.value.internal.length, 0, 'Native output reaches an internal Proto-UI package');
  mkdirSync(path.join(consumer, 'negative-controls'));
  const negativeSource = path.join(consumer, 'negative-controls/import.ts');
  writeFileSync(negativeSource, "import '@proto.ui/runtime';\n");
  const importNegative = await verifyConsumerClosure(consumer, { ...expected, generatedFiles: [...expected.generatedFiles, 'negative-controls/import.ts'] });
  assert.equal(importNegative.ok, false, 'Closure accepted a hidden Runtime import');
  assert.ok(importNegative.failures.some((failure) => failure.code === 'undeclared-import'));
  const helperNegative = await verifyConsumerClosure(consumer, { ...expected, helpers: [{ name: '__missingNativeHelperNegativeControl', version: '1', classification: 'native-lowering', delivery: 'inline' }] });
  assert.equal(helperNegative.ok, false, 'Closure accepted an absent helper');
  assert.ok(helperNegative.failures.some((failure) => failure.code === 'missing-helper'));
  save(path.join(evidence, 'closure-negative-controls.json'), { importLeak: importNegative, absentHelper: helperNegative });
  const sources = sourceFiles.map((file) => {
    const filename = path.join(consumer, 'generated', file.path);
    return { path: file.path, bytes: statSync(filename).size, sha256: sha(readFileSync(filename)), declarations: declarationCosts(filename), importStatements: importCosts(filename) };
  });
  const packages = [...closure.value.external].map((record) => ({ name: record.name, version: record.version, location: record.lockPath, roles: record.roles, ...payload(record.realPath) }));
  const lock = json(path.join(consumer, 'package-lock.json'));
  const allPackages = installedPackages(consumer, lock);
  for (const [name, version] of Object.entries(toolVersions)) assert.equal(allPackages.find((record) => record.location === `node_modules/${name}`)?.version, version, `Smoke tooling version mismatch: ${name}`);
  const costs = {
    profile: profile.id, targetVersion: profile.version, dependencyDelivery: delivery.mode,
    comparison: { mode: 'native-only / one-sided', reference: null, claim: 'No independently installed packed Adapter closure is exercised; no faster or parity claim' },
    measurement: 'Size fields are actual uncompressed UTF-8/source and installed regular-file payload bytes; no gzip, tree-shaking or shared amortization claim. Compiler memory and runtime observations have separate whole-process/DOM scopes; no exact allocation, native-browser/layout or Adapter comparison claim.',
    compilerMemory: json(path.join(evidence, 'timing.json')).memory,
    unavailableMeasurements: {
      exactHeapAllocationCounts: 'No allocation instrumentation; memoryUsage snapshots and maxRSS are not allocation counts.',
      nativeBrowserLayoutPerformance: 'Happy DOM is not a native browser and supplies no layout-performance oracle.',
      adapterRelativePerformance: 'No independently installed packed Adapter baseline is exercised.',
    },
    compilerProvenanceBytes: statSync(path.join(consumer, 'generated/provenance.json')).size,
    emittedSourceBytes: sources.reduce((sum, file) => sum + file.bytes, 0),
    emittedSupportingSourceBytes: sources.filter(file => file.path.startsWith('.proto-ui/')).reduce((sum, file) => sum + file.bytes, 0),
    emittedSourceMapBytes: provenance.artifacts.filter((file) => file.kind === 'source-map').reduce((sum, file) => sum + statSync(path.join(consumer, 'generated', file.path)).size, 0),
    imports: closure.value.imports,
    importCount: closure.value.imports.length,
    staticImportStatementBytes: sources.reduce((sum, file) => sum + file.importStatements.reduce((total, statement) => total + statement.bytes, 0), 0),
    declaredHelperMetadata: provenance.helpers ?? profile.helpers,
    helperMeasurement: 'Exact top-level declaration spans; unexported executable declarations are an inline-lowering footprint, not a one-to-one attestation of metadata helper names. Supporting modules are additionally reported whole, without subtracting their imports/types/comments.',
    inlineExecutableDeclarationBytes: sources.reduce((sum, file) => sum + file.declarations.filter((item) => !item.exported && !item.erasedType).reduce((total, item) => total + item.bytes, 0), 0),
    sources, outputDependencyPackages: packages,
    outputDependencyPayloadBytes: packages.reduce((sum, record) => sum + record.bytes, 0),
    allInstalledPackagesIncludingSmokeTooling: allPackages,
    allInstalledPayloadBytesIncludingSmokeTooling: allPackages.reduce((sum, record) => sum + record.bytes, 0),
>>>>>>> origin/main
    smokeTooling: toolVersions,
  };
  save(path.join(evidence, 'costs.json'), costs);
  return costs;
}

function editConsumerSource(consumer, evidence) {
  const provenance = json(path.join(consumer, 'generated/provenance.json'));
<<<<<<< HEAD
  const sourcePath = provenance.artifacts.find(
    (file) => /^Component\.[^.]+$/.test(file.path) && file.kind === 'source'
  ).path;
=======
  const sourcePath = provenance.artifacts.find(file => /^Component\.[^.]+$/.test(file.path) && file.kind === 'source').path;
>>>>>>> origin/main
  const filename = path.join(consumer, 'generated', sourcePath);
  const original = readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(sourcePath, original, ts.ScriptTarget.Latest, true);
  const candidates = [];
  function visit(node) {
    if (ts.isStringLiteral(node) && node.text === 'section') candidates.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
<<<<<<< HEAD
  assert.equal(
    candidates.length,
    1,
    'Generated template section edit must have exactly one ownership boundary'
  );
  const node = candidates[0];
  const edited =
    original.slice(0, node.getStart(source)) + JSON.stringify('article') + original.slice(node.end);
=======
  assert.equal(candidates.length, 1, 'Generated template section edit must have exactly one ownership boundary');
  const node = candidates[0];
  const edited = original.slice(0, node.getStart(source)) + JSON.stringify('article') + original.slice(node.end);
>>>>>>> origin/main
  copyFileSync(filename, path.join(evidence, 'Component.before-edit.txt'));
  writeFileSync(filename, edited);
  copyFileSync(filename, path.join(evidence, 'Component.after-edit.txt'));
  const ownership = {
<<<<<<< HEAD
    source: sourcePath,
    edit: 'Consumer-owned generated template element changed from section to article without invoking compiler',
    beforeSha256: sha(original),
    afterSha256: sha(edited),
    beforeBytes: Buffer.byteLength(original),
    afterBytes: Buffer.byteLength(edited),
=======
    source: sourcePath, edit: 'Consumer-owned generated template element changed from section to article without invoking compiler',
    beforeSha256: sha(original), afterSha256: sha(edited), beforeBytes: Buffer.byteLength(original), afterBytes: Buffer.byteLength(edited),
>>>>>>> origin/main
    maps: 'Compiler portable-to-generated map/provenance remain immutable historical evidence and are stale after this local edit. Rebuild creates current executable-to-edited-generated-source maps with embedded sources.',
  };
  save(path.join(evidence, 'source-ownership.json'), ownership);
  // A genuine syntax error must reach the consumer build diagnostic path. Restore the
  // real editable payload afterwards, retaining the failing input and command logs.
  try {
    const invalid = edited + '\nconst = ;\n';
    writeFileSync(filename, invalid);
    writeFileSync(path.join(evidence, 'Component.invalid-edit.txt'), invalid);
<<<<<<< HEAD
    recordCommand(
      evidence,
      'edited-source-diagnostic',
      process.execPath,
      ['build.mjs'],
      consumer,
      {},
      true
    );
    const diagnostic = json(path.join(consumer, 'typecheck-diagnostics.json'));
    assert.ok(
      diagnostic.some(
        (item) =>
          item.file?.split(path.sep).join('/') === `generated/${sourcePath}` &&
          item.start >= edited.length
      ),
      'Consumer build must locate the introduced syntax error in generated source'
    );
    save(path.join(evidence, 'edited-source-diagnostic.json'), diagnostic);
  } finally {
    writeFileSync(filename, edited);
  }
=======
    recordCommand(evidence, 'edited-source-diagnostic', process.execPath, ['build.mjs'], consumer, {}, true);
    const diagnostic = json(path.join(consumer, 'typecheck-diagnostics.json'));
    assert.ok(diagnostic.some(item => item.file?.split(path.sep).join('/') === `generated/${sourcePath}` && item.start >= edited.length), 'Consumer build must locate the introduced syntax error in generated source');
    save(path.join(evidence, 'edited-source-diagnostic.json'), diagnostic);
  } finally { writeFileSync(filename, edited); }
>>>>>>> origin/main
  return ownership;
}

async function main() {
<<<<<<< HEAD
  const selected =
    process.env.NATIVE_CONSUMER_PROFILES?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? supported;
  assert.ok(
    selected.length && new Set(selected).size === selected.length,
    'Choose a non-empty unique profile list'
  );
  for (const id of selected) assert.ok(supported.includes(id), `Unsupported smoke profile: ${id}`);
  const mode = process.env.NATIVE_CONSUMER_DEPENDENCIES ?? 'copy';
  assert.ok(
    ['copy', 'registry'].includes(mode),
    'NATIVE_CONSUMER_DEPENDENCIES must be copy or registry'
  );
=======
  const selected = process.env.NATIVE_CONSUMER_PROFILES?.split(',').map((value) => value.trim()).filter(Boolean) ?? supported;
  assert.ok(selected.length && new Set(selected).size === selected.length, 'Choose a non-empty unique profile list');
  for (const id of selected) assert.ok(supported.includes(id), `Unsupported smoke profile: ${id}`);
  const mode = process.env.NATIVE_CONSUMER_DEPENDENCIES ?? 'copy';
  assert.ok(['copy', 'registry'].includes(mode), 'NATIVE_CONSUMER_DEPENDENCIES must be copy or registry');
>>>>>>> origin/main
  const installedRoot = realpathSync(process.env.NATIVE_CONSUMER_PACKAGE_ROOT ?? repoRoot);
  const work = mkdtempSync(path.join(tmpdir(), 'proto-native-consumers-'));
  assert.ok(!within(repoRoot, work), 'Consumer evidence must be outside the source repository');
  console.log(`NATIVE_CONSUMER_EVIDENCE: ${work}`);
<<<<<<< HEAD
  const summary = {
    evidence: work,
    node: process.version,
    dependencyMode: mode,
    oneSided: true,
    surface: 'Happy DOM real framework mounts; no native-browser/layout evidence',
    results: [],
  };
=======
  const summary = { evidence: work, node: process.version, dependencyMode: mode, oneSided: true, surface: 'Happy DOM real framework mounts; no native-browser/layout evidence', results: [] };
>>>>>>> origin/main
  for (const id of selected) {
    const evidence = path.join(work, id);
    const consumer = path.join(evidence, 'consumer');
    const inputs = path.join(evidence, 'compiler-input');
<<<<<<< HEAD
    mkdirSync(consumer, { recursive: true });
    mkdirSync(inputs);
=======
    mkdirSync(consumer, { recursive: true });mkdirSync(inputs);
>>>>>>> origin/main
    writeFileSync(path.join(inputs, 'entry.proto.ts'), numericSource);
    writeFileSync(path.join(inputs, 'keys.ts'), contextKeysSource);
    writeFileSync(path.join(inputs, 'provider.proto.ts'), providerSource);
    writeFileSync(path.join(inputs, 'context.proto.ts'), contextConsumerSource);
    const profile = TARGET_PROFILES[id];
    try {
<<<<<<< HEAD
      assert.ok(
        profile?.implemented && profile.mode === 'source',
        `Native profile not implemented: ${id}`
      );
      recordCommand(
        evidence,
        'cold-compiler-process',
        process.execPath,
        [
          ...process.execArgv,
          script,
          '--compiler-worker',
          inputs,
          path.join(consumer, 'generated'),
          id,
          evidence,
        ],
        repoRoot
      );
      const dependencies = Object.fromEntries(
        profile.dependencies.map((dependency) => [dependency.name, dependency.version])
      );
      for (const name of Object.keys(dependencies)) packageName(name);
      const devDependencies = {
        ...toolVersions,
        ...(id === 'react-dom-source-v1' ? reactTypeVersions : {}),
      };
      save(path.join(consumer, 'package.json'), {
        name: `native-consumer-${id}`,
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies,
        devDependencies,
      });
      let delivery;
      if (mode === 'copy')
        delivery = copyInstalledClosure(consumer, dependencies, devDependencies, installedRoot);
      else {
        writeFileSync(
          path.join(consumer, '.npmrc'),
          'registry=https://registry.npmjs.org/\naudit=false\nfund=false\n'
        );
        runNpm(
          evidence,
          'install',
          [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--cache',
            path.join(consumer, '.npm-cache'),
            '--userconfig',
            path.join(consumer, '.npmrc'),
          ],
          consumer
        );
        runNpm(evidence, 'installed-tree', ['ls', '--all', '--json'], consumer);
        delivery = {
          mode: 'exact-registry-install',
          registry: 'https://registry.npmjs.org/',
          direct: dependencies,
          tooling: toolVersions,
          installScripts: false,
        };
=======
      assert.ok(profile?.implemented && profile.mode === 'source', `Native profile not implemented: ${id}`);
      recordCommand(evidence, 'cold-compiler-process', process.execPath, [...process.execArgv, script, '--compiler-worker', inputs, path.join(consumer, 'generated'), id, evidence], repoRoot);
      const dependencies = Object.fromEntries(profile.dependencies.map((dependency) => [dependency.name, dependency.version]));
      for (const name of Object.keys(dependencies)) packageName(name);
      const devDependencies = { ...toolVersions, ...(id === 'react-dom-source-v1' ? reactTypeVersions : {}) };
      save(path.join(consumer, 'package.json'), { name: `native-consumer-${id}`, version: '1.0.0', private: true, type: 'module', dependencies, devDependencies });
      let delivery;
      if (mode === 'copy') delivery = copyInstalledClosure(consumer, dependencies, devDependencies, installedRoot);
      else {
        writeFileSync(path.join(consumer, '.npmrc'), 'registry=https://registry.npmjs.org/\naudit=false\nfund=false\n');
        runNpm(evidence, 'install', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(consumer, '.npm-cache'), '--userconfig', path.join(consumer, '.npmrc')], consumer);
        runNpm(evidence, 'installed-tree', ['ls', '--all', '--json'], consumer);
        delivery = { mode: 'exact-registry-install', registry: 'https://registry.npmjs.org/', direct: dependencies, tooling: toolVersions, installScripts: false };
>>>>>>> origin/main
      }
      save(path.join(evidence, 'dependency-delivery.json'), delivery);
      const costs = await checkAndMeasure(consumer, evidence, profile, delivery);
      writeFileSync(path.join(consumer, 'build.mjs'), buildProgram);
      writeFileSync(path.join(consumer, 'smoke.mjs'), runtimeProgram);
      recordCommand(evidence, 'build', process.execPath, ['build.mjs'], consumer);
      const build = json(path.join(consumer, 'build-report.json'));
      costs.executableOutputBytes = build.files.reduce((sum, file) => sum + file.bytes, 0);
      costs.executableSourceMapBytes = build.files.reduce((sum, file) => sum + file.mapBytes, 0);
      costs.executableFiles = build.files;
      save(path.join(evidence, 'costs.json'), costs);
      recordCommand(evidence, 'runtime', process.execPath, ['smoke.mjs', id], consumer);
      const originalTrace = json(path.join(consumer, 'runtime-trace.json'));
      assert.equal(originalTrace.ok, true);
      costs.runtimeObservations = {
<<<<<<< HEAD
        scope:
          'Separate isolated runtime processes for original and consumer-edited source. Process snapshots include framework/Happy DOM/evidence overhead and deliberately held references; resource observations cover the numeric component only. No GC is forced and no allocation, browser layout, throughput or relative speed is inferred.',
        original: { measurements: originalTrace.measurements, resources: originalTrace.resources },
      };
      save(path.join(evidence, 'costs.json'), costs);
      copyFileSync(
        path.join(consumer, 'runtime-trace.json'),
        path.join(evidence, 'runtime-original.json')
      );
      copyFileSync(
        path.join(consumer, 'build-report.json'),
        path.join(evidence, 'build-original.json')
      );
      const ownership = editConsumerSource(consumer, evidence);
      recordCommand(evidence, 'edited-build', process.execPath, ['build.mjs'], consumer);
      recordCommand(
        evidence,
        'edited-runtime',
        process.execPath,
        ['smoke.mjs', id, 'edited'],
        consumer
      );
      const editedTrace = json(path.join(consumer, 'runtime-trace.json'));
      assert.equal(editedTrace.ok, true);
      assert.equal(editedTrace.sourceOwnership, 'edited');
      const editedBuild = json(path.join(consumer, 'build-report.json'));
      costs.editedConsumer = {
        generatedEntryBytes: ownership.afterBytes,
        executableOutputBytes: editedBuild.files.reduce((sum, file) => sum + file.bytes, 0),
        executableSourceMapBytes: editedBuild.files.reduce((sum, file) => sum + file.mapBytes, 0),
      };
      costs.runtimeObservations.edited = {
        measurements: editedTrace.measurements,
        resources: editedTrace.resources,
      };
      save(path.join(evidence, 'costs.json'), costs);
      copyFileSync(
        path.join(consumer, 'runtime-trace.json'),
        path.join(evidence, 'runtime-edited.json')
      );
      copyFileSync(
        path.join(consumer, 'build-report.json'),
        path.join(evidence, 'build-edited.json')
      );
      filesUnder(path.join(consumer, 'node_modules'));
      const afterPackages = installedPackages(
        consumer,
        json(path.join(consumer, 'package-lock.json'))
      );
      assert.deepEqual(
        afterPackages,
        costs.allInstalledPackagesIncludingSmokeTooling,
        'Build/edit/runtime mutated the physical installed dependency tree'
      );
      save(path.join(evidence, 'installed-tree-integrity.json'), {
        before: costs.allInstalledPackagesIncludingSmokeTooling,
        after: afterPackages,
        equal: true,
      });
      summary.results.push({
        profile: id,
        ok: true,
        targetVersion: profile.version,
        consumer,
        ownership,
        costs: path.join(evidence, 'costs.json'),
        compilerTiming: path.join(evidence, 'timing.json'),
        originalRuntime: path.join(evidence, 'runtime-original.json'),
        editedRuntime: path.join(evidence, 'runtime-edited.json'),
        installedTreeIntegrity: path.join(evidence, 'installed-tree-integrity.json'),
      });
      console.log(
        'NATIVE_CONSUMER_PASS',
        id,
        JSON.stringify({
          emittedBytes: costs.emittedSourceBytes,
          executableBytes: costs.executableOutputBytes,
          dependencyPayloadBytes: costs.outputDependencyPayloadBytes,
        })
      );
    } catch (error) {
      const failure = { message: error.message, stack: error.stack };
      save(path.join(evidence, 'failure.json'), failure);
      summary.results.push({
        profile: id,
        ok: false,
        consumer,
        failure: path.join(evidence, 'failure.json'),
      });
=======
        scope: 'Separate isolated runtime processes for original and consumer-edited source. Process snapshots include framework/Happy DOM/evidence overhead and deliberately held references; resource observations cover the numeric component only. No GC is forced and no allocation, browser layout, throughput or relative speed is inferred.',
        original: { measurements: originalTrace.measurements, resources: originalTrace.resources },
      };
      save(path.join(evidence, 'costs.json'), costs);
      copyFileSync(path.join(consumer, 'runtime-trace.json'), path.join(evidence, 'runtime-original.json'));
      copyFileSync(path.join(consumer, 'build-report.json'), path.join(evidence, 'build-original.json'));
      const ownership = editConsumerSource(consumer, evidence);
      recordCommand(evidence, 'edited-build', process.execPath, ['build.mjs'], consumer);
      recordCommand(evidence, 'edited-runtime', process.execPath, ['smoke.mjs', id, 'edited'], consumer);
      const editedTrace = json(path.join(consumer, 'runtime-trace.json'));
      assert.equal(editedTrace.ok, true);assert.equal(editedTrace.sourceOwnership, 'edited');
      const editedBuild = json(path.join(consumer, 'build-report.json'));
      costs.editedConsumer = { generatedEntryBytes: ownership.afterBytes, executableOutputBytes: editedBuild.files.reduce((sum, file) => sum + file.bytes, 0), executableSourceMapBytes: editedBuild.files.reduce((sum, file) => sum + file.mapBytes, 0) };
      costs.runtimeObservations.edited = { measurements: editedTrace.measurements, resources: editedTrace.resources };
      save(path.join(evidence, 'costs.json'), costs);
      copyFileSync(path.join(consumer, 'runtime-trace.json'), path.join(evidence, 'runtime-edited.json'));
      copyFileSync(path.join(consumer, 'build-report.json'), path.join(evidence, 'build-edited.json'));
      filesUnder(path.join(consumer, 'node_modules'));
      const afterPackages = installedPackages(consumer, json(path.join(consumer, 'package-lock.json')));
      assert.deepEqual(afterPackages, costs.allInstalledPackagesIncludingSmokeTooling, 'Build/edit/runtime mutated the physical installed dependency tree');
      save(path.join(evidence, 'installed-tree-integrity.json'), { before: costs.allInstalledPackagesIncludingSmokeTooling, after: afterPackages, equal: true });
      summary.results.push({ profile: id, ok: true, targetVersion: profile.version, consumer, ownership, costs: path.join(evidence, 'costs.json'), compilerTiming: path.join(evidence, 'timing.json'), originalRuntime: path.join(evidence, 'runtime-original.json'), editedRuntime: path.join(evidence, 'runtime-edited.json'), installedTreeIntegrity: path.join(evidence, 'installed-tree-integrity.json') });
      console.log('NATIVE_CONSUMER_PASS', id, JSON.stringify({ emittedBytes: costs.emittedSourceBytes, executableBytes: costs.executableOutputBytes, dependencyPayloadBytes: costs.outputDependencyPayloadBytes }));
    } catch (error) {
      const failure = { message: error.message, stack: error.stack };
      save(path.join(evidence, 'failure.json'), failure);
      summary.results.push({ profile: id, ok: false, consumer, failure: path.join(evidence, 'failure.json') });
>>>>>>> origin/main
      console.error('NATIVE_CONSUMER_FAIL', id, error.message);
    }
    save(path.join(work, 'summary.json'), summary);
  }
  summary.ok = summary.results.every((result) => result.ok);
  save(path.join(work, 'summary.json'), summary);
  console.log('NATIVE_CONSUMER_SUMMARY', JSON.stringify(summary));
  if (!summary.ok) process.exitCode = 1;
}

try {
  if (process.argv[2] === '--compiler-worker') await compilerWorker(...process.argv.slice(3));
  else await main();
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
}
