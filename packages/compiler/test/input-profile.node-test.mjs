import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzeProtoDocument } from '@proto.ui/compiler/editor';
import { createProtoProgram } from '@proto.ui/compiler/frontend';
import { produceComponentIR } from '@proto.ui/compiler/producer';
import { emitReact } from '@proto.ui/compiler/targets/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const cli = fileURLToPath(new URL('../src/cli-entry.mjs', import.meta.url));
const declarations = fileURLToPath(new URL('../prelude/authoring.d.ts', import.meta.url));
const authoring = '@proto.ui/core/authoring';
const helper = '@profile/caption';
const types = 'profile-label-types';
const entry = 'app/views/label.proto.ts.txt';
const neighbor = 'app/other/neighbor.proto.ts';
const outsider = 'other/entry.proto.ts';
const common = 'configs/common.json';
const candidates = ['./preferred.ts', './caption.ts'];

const componentSource = `import { definePrototype } from '${authoring}';
import { caption } from '${helper}';
export default definePrototype({ name: 'profile-label', setup(owner) {
  const props = owner.props.define({ label: { type: 'string', default: 'default' } });
  return view => view.el('span', {}, [caption(view.get(props.label))]);
} });
`;

function helperSource(prefix) {
  return `import type { Label } from '${types}';
export function caption(label: Label): string { return ${JSON.stringify(prefix + ' ')} + label; }
`;
}

function fixture(t) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-input-profile-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  function write(name, contents) {
    const file = path.join(cwd, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  const config = (name, value) => write(name, JSON.stringify(value));
  write(entry, componentSource);
  for (const name of [neighbor, outsider]) {
    write(
      name,
      `import { caption } from '${helper}';\nexport function label() { return caption('peer'); }\n`
    );
  }
  for (const profile of ['nearest', 'shared']) {
    config(`profiles/${profile}/base.json`, {
      compilerOptions: { paths: { [helper]: candidates } },
    });
    write(`profiles/${profile}/caption.ts`, helperSource(profile));
  }
  config('app/tsconfig.json', { extends: '../profiles/nearest/base.json' });
  config('other/tsconfig.json', { extends: '../profiles/shared/base.json' });
  config(common, { extends: '../profiles/shared/base.json' });

  // All three incorrect bases have a usable helper, so its rendered value identifies the winner.
  for (const name of ['caption.ts', 'app/caption.ts', 'configs/caption.ts']) {
    write(name, helperSource(name));
  }
  write('shadow.d.ts', readFileSync(declarations));
  for (const [name, pattern] of [
    ['tsconfig.json', authoring],
    ['wildcard.json', '@proto.ui/*'],
  ]) {
    config(name, {
      compilerOptions: { paths: { [helper]: ['./caption.ts'], [pattern]: ['./shadow.d.ts'] } },
    });
  }

  config(`node_modules/${types}/package.json`, {
    name: types,
    version: '1.0.0',
    exports: { '.': { types: './index.d.ts' } },
  });
  write(`node_modules/${types}/index.d.ts`, 'export type Label = string;\n');
  const modules = path.join(cwd, 'node_modules');
  const require = createRequire(import.meta.url);
  mkdirSync(path.join(modules, '@proto.ui'));
  symlinkSync(
    fileURLToPath(new URL('../', import.meta.url)),
    path.join(modules, '@proto.ui/compiler'),
    'dir'
  );
  symlinkSync(
    path.dirname(require.resolve('react/package.json')),
    path.join(modules, 'react'),
    'dir'
  );
  return cwd;
}

function invoke(cwd, args, status) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, status, `${args.join(' ')}\n${result.stderr || result.stdout}`);
  return result;
}

const projectArgs = (project) => (project === undefined ? [] : ['--project', project]);

function lint(cwd, roots, project) {
  const result = invoke(
    cwd,
    ['lint', ...roots, '--target', 'react', '--json', ...projectArgs(project)],
    2
  );
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.analysisComplete, false);
  assert.equal(report.sourceValid, null);
  assert.equal(report.selectedTarget, 'react');
  return report;
}

function compareSources(cwd, project, roots = [entry]) {
  const report = lint(cwd, roots, project);
  const options = { rootNames: roots, currentDirectory: cwd, project };
  const produced = produceComponentIR(createProtoProgram(options), {
    fileName: entry,
    publicName: 'ProfileLabel',
  });
  const file = path.join(cwd, entry);
  const { analysis } = analyzeProtoDocument({
    ...options,
    fileName: entry,
    text: readFileSync(file, 'utf8'),
    target: 'react',
  });
  const disk = report.sourceClosure;
  assert.deepEqual(produced.sourceClosure, disk);
  assert.equal(disk.complete, true);
  assert.deepEqual(disk.missing, []);
  assert.match(disk.configurationHash, /^[\da-f]{64}$/);
  assert.match(disk.digest, /^[\da-f]{64}$/);
  assert.deepEqual(disk.rootNames, roots.map((name) => path.join(cwd, name)).sort());
  assertDiskFile(disk.files, file);
  // Only the open document has override provenance. Its identical bytes must retain the disk digest.
  assert.deepEqual(analysis.sourceClosure, {
    ...disk,
    files: disk.files.map((item) =>
      item.path === file ? { ...item, sourceKind: 'override' } : item
    ),
  });
  assert.deepEqual(analysis.diagnostics, report.diagnostics);
  assert.equal(analysis.selectedTarget, report.selectedTarget);
  assert.equal(analysis.analysisConfigurationHash, report.analysisConfigurationHash);
  return produced;
}

function assertDiskFile(records, file) {
  const record = records.find((item) => item.path === file);
  assert.ok(record, `Missing snapshot of ${file}`);
  const bytes = readFileSync(file);
  assert.equal(record.sourceKind, 'disk');
  assert.equal(record.byteLength, bytes.length);
  assert.equal(record.sha256, createHash('sha256').update(bytes).digest('hex'));
}

function assertResolution(closure, from, specifier, resolvedPath) {
  const edges = closure.resolutions.filter(
    (edge) => edge.from === from && edge.specifier === specifier
  );
  assert.deepEqual(
    edges.map((edge) => edge.resolvedPath),
    [resolvedPath],
    `${from} imports ${specifier}`
  );
}

function assertProfile(cwd, closure, profile, preferred) {
  const base = path.join(cwd, 'profiles', profile);
  const candidate = path.join(base, 'preferred.ts');
  const dependency = path.join(base, preferred ? 'preferred.ts' : 'caption.ts');
  const packageDirectory = path.join(cwd, 'node_modules', types);
  assert.equal(closure.compilerOptions.allowNonTsExtensions, true);
  assert.equal(closure.compilerOptions.pathsBasePath, base);
  assert.deepEqual(closure.compilerOptions.paths[helper], candidates);
  assertResolution(closure, path.join(cwd, entry), authoring, declarations);
  assertResolution(closure, path.join(cwd, entry), helper, dependency);
  assertResolution(closure, dependency, types, path.join(packageDirectory, 'index.d.ts'));
  for (const file of [declarations, dependency, path.join(packageDirectory, 'index.d.ts')]) {
    assertDiskFile(closure.files, file);
  }
  assertDiskFile(closure.resolutionFiles, path.join(packageDirectory, 'package.json'));
  assert.ok(
    closure.resolutionProbes.some(
      (probe) => probe.path === candidate && probe.kind === 'file' && probe.exists === preferred
    ),
    `The resolver must observe whether ${candidate} exists`
  );
  for (const name of ['shadow.d.ts', 'caption.ts', 'app/caption.ts', 'configs/caption.ts']) {
    assert.ok(
      !closure.files.some((item) => item.path === path.join(cwd, name)),
      `Unexpected input ${name}`
    );
  }
}

async function compileAndRender(cwd, project, produced, expectedPrefix) {
  assert.equal(produced.status, 'produced', JSON.stringify(produced.diagnostics));
  const result = invoke(
    cwd,
    ['compile', entry, '--target', 'react', '--name', 'ProfileLabel', ...projectArgs(project)],
    0
  );
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, emitReact(produced.component));
  const module = path.join(cwd, `generated-${expectedPrefix}.mts`);
  writeFileSync(module, result.stdout);
  const { ProfileLabel } = await import(pathToFileURL(module).href);
  assert.equal(
    renderToStaticMarkup(createElement(ProfileLabel)),
    `<span>${expectedPrefix} default</span>`
  );
  assert.equal(
    renderToStaticMarkup(createElement(ProfileLabel, { label: 'A&B' })),
    `<span>${expectedPrefix} A&amp;B</span>`
  );
}

test('lint, editor, producer and emitted React select the entry project and the cwd-relative explicit project', async (t) => {
  const cwd = fixture(t);
  const nearest = compareSources(cwd, undefined);
  assertProfile(cwd, nearest.sourceClosure, 'nearest', false);
  await compileAndRender(cwd, undefined, nearest, 'nearest');

  const shared = compareSources(cwd, common);
  assertProfile(cwd, shared.sourceClosure, 'shared', false);
  await compileAndRender(cwd, common, shared, 'shared');
  assert.notEqual(nearest.sourceClosure.configurationHash, shared.sourceClosure.configurationHash);
  assert.notEqual(nearest.sourceClosure.digest, shared.sourceClosure.digest);

  // Fill the previously absent first candidate without changing the entry or either project.
  writeFileSync(path.join(cwd, 'profiles/nearest/preferred.ts'), helperSource('preferred'));
  const changed = compareSources(cwd, undefined);
  assertProfile(cwd, changed.sourceClosure, 'nearest', true);
  assert.equal(changed.sourceClosure.configurationHash, nearest.sourceClosure.configurationHash);
  assert.notEqual(changed.sourceClosure.digest, nearest.sourceClosure.digest);
  await compileAndRender(cwd, undefined, changed, 'preferred');
  for (const [profile, result] of [
    ['nearest', nearest],
    ['explicit', shared],
    ['preferred', changed],
  ]) {
    const { configurationHash, digest, files, resolutions } = result.sourceClosure;
    t.diagnostic(
      JSON.stringify({
        profile,
        configurationHash,
        digest,
        helper: resolutions.find((edge) => edge.specifier === helper).resolvedPath,
        declaration: files.find((file) => file.path === declarations),
      })
    );
  }
});

test('exact and wildcard project mappings retain their declaration identity across clients', (t) => {
  const cwd = fixture(t);
  const shadow = path.join(cwd, 'shadow.d.ts');
  for (const project of ['tsconfig.json', 'wildcard.json']) {
    const result = compareSources(cwd, project);
    assertResolution(result.sourceClosure, path.join(cwd, entry), authoring, shadow);
    assertDiskFile(result.sourceClosure.files, shadow);
    assert.ok(!result.sourceClosure.files.some((file) => file.path === declarations));
    assert.equal(result.status, 'unavailable');
    assert.ok(result.diagnostics.some((d) => d.capabilityKey === 'producer/authoring-origin'));
    const rejected = invoke(cwd, ['compile', entry, '--target', 'react', '--project', project], 2);
    assert.equal(rejected.stdout, '');
    assert.match(rejected.stderr, /producer\/authoring-origin/);
  }
});

test('multi-entry lint requires one discovered project or an explicit project in either entry order', (t) => {
  const cwd = fixture(t);
  const together = compareSources(cwd, undefined, [entry, neighbor]);
  assert.equal(together.status, 'produced', JSON.stringify(together.diagnostics));
  for (const file of [entry, neighbor]) {
    assertResolution(
      together.sourceClosure,
      path.join(cwd, file),
      helper,
      path.join(cwd, 'profiles/nearest/caption.ts')
    );
  }

  const forward = [entry, outsider];
  const reverse = [outsider, entry];
  for (const order of [forward, reverse]) {
    const rejected = invoke(cwd, ['lint', ...order, '--target', 'react', '--json'], 64);
    assert.equal(rejected.stdout, '');
    assert.match(rejected.stderr.split('Usage:')[0], /--project/);
  }
  const shared = compareSources(cwd, common, forward);
  assert.equal(shared.status, 'produced', JSON.stringify(shared.diagnostics));
  assert.deepEqual(lint(cwd, reverse, common).sourceClosure, shared.sourceClosure);
  for (const file of forward) {
    assertResolution(
      shared.sourceClosure,
      path.join(cwd, file),
      helper,
      path.join(cwd, 'profiles/shared/caption.ts')
    );
  }
});
