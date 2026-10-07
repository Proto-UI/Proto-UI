// @vitest-environment node
import { mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileProject, type ProjectCompilation, type ProjectCompileResult } from './project';

const temporary: string[] = [];
const prototype = (name: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'${name}',setup(def){const flag=def.state.bool('flag',false);def.expose.state('flag',flag);}});`;

function success(result: ProjectCompileResult): ProjectCompilation {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-project-'));
  temporary.push(root);
  await writeFile(path.join(root, 'a.proto.ts'), "export {default} from './barrel';");
  await writeFile(path.join(root, 'barrel.ts'), "export {default} from './leaf';");
  await writeFile(path.join(root, 'leaf.ts'), prototype('first'));
  await writeFile(path.join(root, 'b.proto.ts'), prototype('independent'));
  return { root, entries: ['a.proto.ts', 'b.proto.ts'] };
}

afterEach(async () => {
  for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('root-owned incremental multi-entry compiler', () => {
  it('reuses the same successful IR/output while matching a fresh full compilation', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    const second = success(await compileProject(options, first.project));
    const full = success(await compileProject(options));
    expect(second.entries.map((entry) => entry.cacheHit)).toEqual([true, true]);
    for (let index = 0; index < second.entries.length; index++) {
      expect(second.entries[index].compilation).toBe(first.entries[index].compilation);
      expect(second.entries[index].compilation).toEqual(full.entries[index].compilation);
    }
    expect(second.identity).toBe(full.identity);
    expect(second.project.graph.get('barrel.ts')).toEqual(['leaf.ts']);
  });

  it('invalidates only transitive dependents when a re-exported source changes', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    await writeFile(path.join(options.root, 'leaf.ts'), prototype('changed'));
    const changed = success(await compileProject(options, first.project));
    const full = success(await compileProject(options));
    expect(changed.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    expect(changed.entries[0].compilation.ir.name).toBe('changed');
    expect(changed.entries[0].compilation.output).not.toEqual(first.entries[0].compilation.output);
    expect(changed.entries[1].compilation).toBe(first.entries[1].compilation);
    expect(changed.entries.map((entry) => entry.compilation)).toEqual(full.entries.map((entry) => entry.compilation));
    expect(changed.identity).toBe(full.identity);
  });

  it('does not publish or cache partial success and distinguishes the failed attempt', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    const generation = first.project.lastSuccessful;
    await writeFile(path.join(options.root, 'leaf.ts'), prototype('changed'));
    await writeFile(path.join(options.root, 'b.proto.ts'), `${prototype('independent')}\nglobalThis.executed = true;`);
    const failed = await compileProject(options, first.project);
    expect(failed.ok).toBe(false);
    expect('value' in failed).toBe(false);
    expect(first.project.lastSuccessful).toBe(generation);
    expect(first.project.lastAttempt?.ok).toBe(false);
    await writeFile(path.join(options.root, 'b.proto.ts'), prototype('independent'));
    const recovered = success(await compileProject(options, first.project));
    expect(recovered.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    expect(recovered.entries[0].compilation.ir.name).toBe('changed');
    expect(first.project.lastSuccessful?.identity).toBe(recovered.identity);
  });

  it('tracks missing candidates after deletion and recovers from a renamed re-export', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    await rename(path.join(options.root, 'leaf.ts'), path.join(options.root, 'renamed.ts'));
    const failed = await compileProject(options, first.project);
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error('Missing transitive source must fail the generation.');
    expect(failed.dependencies).toContain('leaf.ts');
    expect(failed.dependencies).toContain('leaf.proto.ts');
    expect(failed.dependencies).toContain('leaf/index.ts');
    expect(failed.project.lastSuccessful?.identity).toBe(first.identity);
    await writeFile(path.join(options.root, 'barrel.ts'), "export {default} from './renamed';");
    const repaired = success(await compileProject(options, failed.project));
    expect(repaired.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    expect(repaired.project.graph.get('barrel.ts')).toEqual(['renamed.ts']);
    expect(repaired.dependencies).not.toContain('leaf.ts');
    const full = success(await compileProject(options));
    expect(repaired.entries.map((entry) => entry.compilation)).toEqual(full.entries.map((entry) => entry.compilation));
  });

  it('retains resolved sibling closure and all missing candidates on a failed graph', async () => {
    const options = await fixture();
    await writeFile(path.join(options.root, 'a.proto.ts'), "export {missing} from './absent';\nexport {default} from './barrel';");
    const result = await compileProject(options);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Missing source must fail the whole project.');
    expect(result.dependencies).toEqual(expect.arrayContaining(['absent.ts', 'barrel.ts', 'leaf.ts', 'b.proto.ts']));
    expect(result.project.lastSuccessful).toBeUndefined();
    await writeFile(path.join(options.root, 'absent.ts'), `import {definePrototype} from '@proto.ui/core'; export const missing=definePrototype({name:'unused',setup(def){}});`);
    const repaired = success(await compileProject(options, result.project));
    expect(repaired.entries[0].compilation.ir.name).toBe('first');
  });

  it('invalidates on explicit config/profile changes without serving stale success', async () => {
    const options = await fixture();
    await writeFile(path.join(options.root, 'compiler.json'), '{"consumer":"one"}');
    const configured = { ...options, configFiles: ['compiler.json'] };
    const first = success(await compileProject(configured));
    await writeFile(path.join(options.root, 'compiler.json'), '{"consumer":"two"}');
    const changed = success(await compileProject(configured, first.project));
    expect(changed.entries.map((entry) => entry.cacheHit)).toEqual([false, false]);
    expect(changed.identity).not.toBe(first.identity);
    expect(changed.entries.map((entry) => entry.compilation)).toEqual(first.entries.map((entry) => entry.compilation));
    const rejected = await compileProject({ ...configured, profile: 'not-a-profile' }, first.project);
    expect(rejected.ok).toBe(false);
    expect(first.project.lastSuccessful?.identity).toBe(changed.identity);
    await unlink(path.join(options.root, 'compiler.json'));
    const missing = await compileProject(configured, first.project);
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('Missing explicit configuration input must fail.');
    expect(missing.dependencies).toEqual(expect.arrayContaining(['compiler.json', 'leaf.ts']));
    expect(first.project.lastSuccessful?.identity).toBe(changed.identity);
  });

  it('keeps cache identity local to the root and drops entries no longer requested', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    const reduced = success(await compileProject({ ...options, entries: ['b.proto.ts'] }, first.project));
    expect(reduced.entries[0].compilation).toBe(first.entries[1].compilation);
    expect(reduced.dependencies).not.toContain('leaf.ts');
    const restored = success(await compileProject(options, reduced.project));
    expect(restored.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    const other = await fixture();
    const separate = success(await compileProject(other, first.project));
    expect(separate.project).not.toBe(first.project);
    expect(separate.entries.map((entry) => entry.cacheHit)).toEqual([false, false]);
  });

  it('uses resolver candidate precedence rather than trusting unchanged import text', async () => {
    const options = await fixture();
    const first = success(await compileProject(options));
    await writeFile(path.join(options.root, 'leaf'), prototype('higher-priority'));
    const changed = success(await compileProject(options, first.project));
    expect(changed.entries.map((entry) => entry.cacheHit)).toEqual([false, true]);
    expect(changed.entries[0].compilation.ir.name).toBe('higher-priority');
    expect(changed.project.graph.get('barrel.ts')).toEqual(['leaf']);
  });

  it('rejects lexical and symlink escape without changing the outside source', async () => {
    const options = await fixture();
    const outside = await mkdtemp(path.join(tmpdir(), 'proto-outside-'));
    temporary.push(outside);
    const filename = path.join(outside, 'outside.ts');
    const bytes = prototype('outside');
    await writeFile(filename, bytes);
    await symlink(filename, path.join(options.root, 'escape.ts'));
    expect((await compileProject({ ...options, entries: [filename] })).ok).toBe(false);
    expect((await compileProject({ ...options, entries: ['escape.ts'] })).ok).toBe(false);
    expect(await readFile(filename, 'utf8')).toBe(bytes);
  });
});
