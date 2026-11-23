/**
 * Ordinary build and execution of the full authored 0.3 Button sources.
 * node --import tsx scripts/compiler/release-family-smoke.mjs
 * NATIVE_CONSUMER_COMPILER may select the supported source-pinned index.js.
 * Exact installed payloads are copied into isolated consumers, never symlinked.
 * The runtime surface is Happy DOM; browser geometry/trusted input is separate.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyInstalledClosure, buildProgram } from './native-consumer-smoke.mjs';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const compiler = await import(
  process.env.NATIVE_CONSUMER_COMPILER
    ? pathToFileURL(path.resolve(process.env.NATIVE_CONSUMER_COMPILER)).href
    : new URL('../../packages/compiler/src/index.ts', import.meta.url).href
);
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
];
const families = ['base', 'shadcn', 'brutalist'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const work = mkdtempSync(path.join(tmpdir(), 'proto-release-families-'));
const summary = {
  compilerBuild: compiler.compilerBuildIdentity,
  sourceRoot: root,
  surface:
    'Isolated ordinary TypeScript build and real framework mounts in Happy DOM; not native-browser evidence',
  evidence: work,
  results: [],
};
console.log('RELEASE_FAMILY_EVIDENCE', work);
for (const profile of profiles) {
  const consumer = path.join(work, profile);
  mkdirSync(consumer);
  const row = { profile, consumer, families: [], ok: false };
  summary.results.push(row);
  try {
    const artifacts = new Map(),
      dependencies = new Map();
    for (const family of families) {
      const entry = 'packages/prototypes/' + family + '/src/button/button.proto.ts';
      const componentName = family[0].toUpperCase() + family.slice(1) + 'Button';
      const result = await compiler.compileFile(entry, { root, profile, componentName });
      if (!result.ok) throw new Error(JSON.stringify({ entry, diagnostics: result.diagnostics }));
      const extension =
        profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
      const sourcePath = componentName + extension;
      for (const dependency of result.value.output.dependencies) {
        assert.notEqual(
          dependency.name,
          '@floating-ui/dom',
          'Buttons cannot introduce a geometry dependency'
        );
        const previous = dependencies.get(dependency.name);
        if (previous) assert.equal(previous, dependency.version);
        dependencies.set(dependency.name, dependency.version);
      }
      for (const artifact of compiler.compilationArtifacts(result.value, {
        sourcePath,
        manifestPath: componentName + '.provenance.json',
      })) {
        const previous = artifacts.get(artifact.path);
        if (previous)
          assert.equal(
            previous.contents,
            artifact.contents,
            'Shared helper differs: ' + artifact.path
          );
        else artifacts.set(artifact.path, artifact);
      }
      row.families.push({
        family,
        entry,
        sourcePath,
        componentName,
        sourceGraphSha256: result.value.ir.source.sha256,
        sourceFiles: result.value.ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 })),
      });
    }
    const generated = path.join(consumer, 'generated');
    const written = await compiler.writeArtifactSet([...artifacts.values()], generated);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    save(path.join(generated, 'provenance.json'), {
      compilerBuild: compiler.compilerBuildIdentity,
      profile,
      artifacts: [...artifacts.values()].map((file) => ({
        path: file.path,
        kind: file.kind,
        sha256: hash(file.contents),
      })),
      dependencies: [...dependencies].map(([name, version]) => ({ name, version, role: 'target' })),
      assembly:
        'Three unchanged authored family Buttons; each original compiler provenance retained',
    });
    const runtimeDependencies = Object.fromEntries(dependencies);
    const devDependencies = {
      typescript: '5.9.3',
      'happy-dom': '15.11.7',
      ...(profile === 'react-dom-source-v1'
        ? { '@types/react': '19.2.14', '@types/react-dom': '19.2.3' }
        : {}),
    };
    save(path.join(consumer, 'package.json'), {
      name: 'release-family-consumer',
      version: '1.0.0',
      type: 'module',
      private: true,
      dependencies: runtimeDependencies,
      devDependencies,
    });
    row.dependencies = copyInstalledClosure(
      consumer,
      runtimeDependencies,
      devDependencies,
      realpathSync(process.env.NATIVE_CONSUMER_PACKAGE_ROOT ?? root)
    );
    writeFileSync(path.join(consumer, 'build.mjs'), buildProgram);
    save(path.join(consumer, 'release-families.json'), row.families);
    copyFileSync(
      new URL('./release-family-runtime.mjs', import.meta.url),
      path.join(consumer, 'runtime.mjs')
    );
    for (const [name, args] of [
      ['build', ['build.mjs']],
      ['runtime', ['runtime.mjs', profile]],
    ]) {
      const start = performance.now();
      const result = spawnSync(process.execPath, args, {
        cwd: consumer,
        env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      });
      writeFileSync(path.join(consumer, name + '.stdout.log'), result.stdout ?? '');
      writeFileSync(path.join(consumer, name + '.stderr.log'), result.stderr ?? '');
      save(path.join(consumer, name + '.result.json'), {
        args,
        status: result.status,
        signal: result.signal,
        error: result.error?.message ?? null,
        wallMs: performance.now() - start,
      });
      if (result.error || result.status !== 0)
        throw new Error(
          name +
            ' failed: ' +
            (result.error?.message ?? result.status) +
            '; retained logs in ' +
            consumer
        );
    }
    row.ok = true;
    console.log('RELEASE_FAMILY_PASS', profile, row.families.length);
  } catch (error) {
    row.failure = { message: error.message, stack: error.stack };
    console.error('RELEASE_FAMILY_FAIL', profile, error.message);
  }
  save(path.join(work, 'summary.json'), summary);
}
summary.ok = summary.results.every((row) => row.ok);
save(path.join(work, 'summary.json'), summary);
if (!summary.ok) process.exitCode = 1;
