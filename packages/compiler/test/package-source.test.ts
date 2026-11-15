// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileFile, type Compilation } from '../src/compile';
import { compileProject, type ProjectCompileResult } from '../src/project';
import type { CompileResult } from '../src/ir';
import { FileSourceGraph } from '../src/source-loader';

const temporary: string[] = [];
const prototype = (name = 'subject') => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'${name}',setup(def){}});`;
const hook = (name = 'ordinary', initial = false) => `import {defineAsHook} from '@proto.ui/core';
export const behavior=defineAsHook({name:'${name}',setup(def){const ready=def.state.bool('ready',${initial});def.expose.state('ready',ready);}});`;
const use = (specifier: string) => `import {definePrototype} from '@proto.ui/core';
import {behavior as apply} from '${specifier}';
export default definePrototype({name:'caller',setup(def){apply();}});`;
async function directory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'proto-package-source-'));
  temporary.push(root);
  return root;
}
async function put(root: string, files: Record<string, string>): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  }
}
async function pkg(
  root: string,
  name: string,
  exports: unknown,
  files: Record<string, string>,
  at?: string
): Promise<string> {
  const location = at ?? path.join(root, 'node_modules', name);
  await put(location, {
    'package.json': JSON.stringify({ name, type: 'module', exports }),
    ...files,
  });
  return location;
}
function ok(result: CompileResult<Compilation>): Compilation {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function projectOk(result: ProjectCompileResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
afterEach(async () => {
  for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('explicit package authored source graph', () => {
  it('follows proto exports, authored aliases and re-exports without reading runtime implementations', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('ordinary-package') });
    await pkg(
      root,
      'ordinary-package',
      { '.': { import: './dist/index.js', default: './dist/index.js', proto: './src/index.ts' } },
      {
        'src/index.ts': `export {renamed as behavior} from './bridge';`,
        'src/bridge.ts': `import {behavior as local} from './logic.proto'; export {local as renamed};`,
        'src/logic.proto.ts': hook(),
        'dist/index.js': `throw new Error('The compiler must never execute or parse this runtime entry');`,
      }
    );
    const result = ok(await compileFile('entry.proto.ts', { root, profile: 'vue-source-v1' }));
    expect(result.ir.hooks).toMatchObject([{ name: 'ordinary' }]);
    expect(result.ir.sourceFiles.map((file) => file.file)).toEqual(
      expect.arrayContaining([
        'entry.proto.ts',
        'node_modules/ordinary-package/src/index.ts',
        'node_modules/ordinary-package/src/bridge.ts',
        'node_modules/ordinary-package/src/logic.proto.ts',
      ])
    );
    expect(result.ir.sourceFiles.some((file) => file.file.endsWith('.js'))).toBe(false);
    expect(result.output.provenance.sourceResolution).toMatchObject({
      version: 1,
      imports: { 'ordinary-package': 'node_modules/ordinary-package/src/index.ts' },
      packages: [
        {
          manifest: 'node_modules/ordinary-package/package.json',
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
    });
  });

  it('resolves direct proto files, wildcard subpaths, nested packages and package self references', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('@scope/outer/choice') });
    await pkg(
      root,
      '@scope/outer',
      {
        './choice': { proto: './src/choice.proto.ts' },
        './internal/*': { proto: './src/*.ts' },
      },
      {
        'src/choice.proto.ts': `export {behavior} from '@scope/outer/internal/bridge';`,
        'src/bridge.ts': `export {behavior} from 'inner-package';`,
      }
    );
    await pkg(root, 'inner-package', './logic.proto.ts', { 'logic.proto.ts': hook('nested') });
    const result = ok(await compileFile('entry.proto.ts', { root }));
    expect(result.ir.hooks).toMatchObject([{ name: 'nested' }]);
    expect(Object.keys(result.output.provenance.sourceResolution!.imports)).toEqual([
      '@scope/outer/choice',
      '@scope/outer/internal/bridge',
      'inner-package',
    ]);
  });

  it('uses one physical owner for package aliases outside the project and records exact watch dependencies', async () => {
    const root = await directory();
    const external = await directory();
    const packageRoot = await pkg(
      root,
      'actual-package',
      { '.': { proto: './src/logic.proto.ts' } },
      {
        'src/logic.proto.ts': hook('one-owner'),
      },
      external
    );
    await mkdir(path.join(root, 'node_modules'), { recursive: true });
    await symlink(packageRoot, path.join(root, 'node_modules', 'left-package'));
    await symlink(packageRoot, path.join(root, 'node_modules', 'right-package'));
    await put(root, {
      'entry.proto.ts': `import {definePrototype} from '@proto.ui/core';
import {behavior as left} from 'left-package'; import {behavior as right} from 'right-package';
export default definePrototype({name:'caller',setup(def){left();right();}});`,
    });
    const result = projectOk(await compileProject({ root, entries: ['entry.proto.ts'] }));
    const compiled = result.entries[0].compilation;
    expect(compiled.ir.hooks).toHaveLength(1);
    const imports = compiled.output.provenance.sourceResolution!.imports;
    expect(imports['left-package']).toBe(imports['right-package']);
    expect(imports['left-package']).toMatch(
      /^\.proto-ui\/source-packages\/[a-f0-9]{24}\/src\/logic\.proto\.ts$/
    );
    expect(result.project.dependencyRoots).toEqual([external]);
    expect(result.dependencies).toContain(path.join(external, 'src/logic.proto.ts'));
    expect(result.project.resolutionFiles).toEqual(
      expect.arrayContaining([
        path.join(root, 'node_modules/left-package/package.json'),
        path.join(external, 'package.json'),
      ])
    );
  });

  it('reads required type sources without following executable imports from an erased dependency', async () => {
    const root = await directory();
    await put(root, {
      'entry.proto.ts': `import {definePrototype} from '@proto.ui/core';
import type {Payload} from 'types-package';
export default definePrototype({name:'types',setup(def){def.expose.method('label',(value:Payload)=>value.label);}});`,
    });
    await pkg(
      root,
      'types-package',
      { '.': { proto: './types.ts' } },
      {
        'types.ts': `import './missing-executable'; export interface Payload {label:string} throw new Error('erased code');`,
      }
    );
    const result = ok(await compileFile('entry.proto.ts', { root }));
    expect(result.ir.exposes).toMatchObject([
      {
        name: 'label',
        kind: 'method',
        parameters: [{ type: { kind: 'record', fields: [{ name: 'label', type: 'string' }] } }],
      },
    ]);
    expect(result.ir.sourceFiles.map((file) => file.file)).toContain(
      'node_modules/types-package/types.ts'
    );
  });

  it('keeps source effects under normal admission and never executes either runtime or source modules', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('effectful-package') });
    await pkg(
      root,
      'effectful-package',
      { '.': { proto: './logic.proto.ts', default: './dist.js' } },
      {
        'logic.proto.ts': `globalThis.__protoPackageExecuted=true; ${hook()}`,
        'dist.js': `globalThis.__protoPackageExecuted=true;`,
      }
    );
    const result = await compileFile('entry.proto.ts', { root });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    expect((globalThis as Record<string, unknown>).__protoPackageExecuted).toBeUndefined();
  });

  it('does not infer authored source from a runtime export or a similarly named src file', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('opaque-package') });
    await pkg(
      root,
      'opaque-package',
      {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
      },
      {
        'src/index.proto.ts': hook(),
        'dist/index.js': `export const behavior=()=>{};`,
      }
    );
    expect(await compileFile('entry.proto.ts', { root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003', message: expect.stringContaining('opaque-package') }],
    });
  });

  it.each([
    '../outside.proto.ts',
    '/outside.proto.ts',
    './src/../outside.proto.ts',
    './src/%2e%2e/outside.proto.ts',
    './src/code.js',
    ['./src/code.proto.ts'],
    { default: './src/code.proto.ts' },
  ])('rejects an unsafe or non-static proto target %j', async (target) => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('invalid-package') });
    await pkg(root, 'invalid-package', { '.': { proto: target } }, { 'src/code.proto.ts': hook() });
    expect(await compileFile('entry.proto.ts', { root })).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1003',
          message: expect.stringMatching(/static source path|inside its package/),
        },
      ],
    });
  });

  it('rejects source-export and transitive local symlink escape from a package boundary', async () => {
    const root = await directory();
    const outside = await directory();
    await put(outside, { 'logic.proto.ts': hook() });
    await put(root, { 'entry.proto.ts': use('escaping-package') });
    const packageRoot = await pkg(
      root,
      'escaping-package',
      { '.': { proto: './logic.proto.ts' } },
      {}
    );
    await symlink(path.join(outside, 'logic.proto.ts'), path.join(packageRoot, 'logic.proto.ts'));
    expect(await compileFile('entry.proto.ts', { root })).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('escapes its package') }],
    });
    await rm(path.join(packageRoot, 'logic.proto.ts'));
    await put(packageRoot, { 'logic.proto.ts': `export {behavior} from './outside';` });
    await symlink(path.join(outside, 'logic.proto.ts'), path.join(packageRoot, 'outside.ts'));
    expect(await compileFile('entry.proto.ts', { root })).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('escapes the declared project root') }],
    });
    expect(await readFile(path.join(outside, 'logic.proto.ts'), 'utf8')).toBe(hook());
  });

  it('rejects conflicting installed owners for one bare specifier instead of coalescing their bindings', async () => {
    const root = await directory();
    await put(root, {
      'entry.proto.ts': `import {definePrototype} from '@proto.ui/core';
import {behavior} from 'dependency'; import {other} from 'outer-package';
export default definePrototype({name:'caller',setup(def){behavior();other();}});`,
    });
    await pkg(root, 'dependency', './logic.proto.ts', { 'logic.proto.ts': hook('root') });
    const outer = await pkg(root, 'outer-package', './index.proto.ts', {
      'index.proto.ts': `export {behavior as other} from 'dependency';`,
    });
    await pkg(outer, 'dependency', './logic.proto.ts', { 'logic.proto.ts': hook('nested') });
    expect(await compileFile('entry.proto.ts', { root })).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('different owners in one closed graph') }],
    });
  });

  it('invalidates only dependent entries for source and export changes and matches fresh compilation', async () => {
    const root = await directory();
    await put(root, {
      'entry.proto.ts': use('changing-package'),
      'independent.proto.ts': prototype('independent'),
    });
    const packageRoot = await pkg(
      root,
      'changing-package',
      { '.': { proto: './first.proto.ts' } },
      {
        'first.proto.ts': hook('first'),
        'second.proto.ts': hook('second'),
      }
    );
    const options = { root, entries: ['entry.proto.ts', 'independent.proto.ts'] };
    const first = projectOk(await compileProject(options));
    expect(
      projectOk(await compileProject(options, first.project)).entries.map((entry) => entry.cacheHit)
    ).toEqual([true, true]);
    await put(packageRoot, { 'first.proto.ts': hook('modified', true) });
    const modified = projectOk(await compileProject(options, first.project));
    expect(modified.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    await put(packageRoot, {
      'package.json': JSON.stringify({
        name: 'changing-package',
        exports: { '.': { proto: './second.proto.ts' } },
      }),
    });
    const changed = projectOk(await compileProject(options, first.project));
    const fresh = projectOk(await compileProject(options));
    expect(changed.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    expect(changed.entries[0].compilation.ir.hooks).toMatchObject([{ name: 'second' }]);
    expect(changed.entries.map((entry) => entry.compilation)).toEqual(
      fresh.entries.map((entry) => entry.compilation)
    );
    expect(changed.identity).toBe(fresh.identity);
  });

  it('retains missing package candidates on failure and recovers after a package becomes available', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('later-package') });
    const failed = await compileProject({ root, entries: ['entry.proto.ts'] });
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error('Expected missing package admission to fail');
    expect(failed.project.resolutionFiles).toContain(
      path.join(root, 'node_modules/later-package/package.json')
    );
    await pkg(root, 'later-package', './logic.proto.ts', { 'logic.proto.ts': hook('installed') });
    const recovered = projectOk(
      await compileProject({ root, entries: ['entry.proto.ts'] }, failed.project)
    );
    expect(recovered.entries[0].compilation.ir.hooks).toMatchObject([{ name: 'installed' }]);
  });

  it('compiles a closed snapshot without rereading its package or changing its bindings', async () => {
    const root = await directory();
    await put(root, { 'entry.proto.ts': use('frozen-package') });
    const packageRoot = await pkg(root, 'frozen-package', './logic.proto.ts', {
      'logic.proto.ts': hook('frozen'),
    });
    const graph = new FileSourceGraph(root);
    const snapshot = await graph.load(await graph.entry('entry.proto.ts'));
    expect(snapshot.failures).toEqual([]);
    await rm(packageRoot, { recursive: true });
    const result = ok(await compileFile('entry.proto.ts', { root, sourceSnapshot: snapshot }));
    expect(result.ir.hooks).toMatchObject([{ name: 'frozen' }]);
    expect(result.output.provenance.sourceResolution).toEqual(snapshot.sourceResolution);
  });
});
