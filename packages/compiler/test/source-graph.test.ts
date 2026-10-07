// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { SourceGraph } from '../src/parser-module';
import { CompilerRejection } from '../src/diagnostics';
import { localSourceBase, resolveLocalSource } from '../src/source-resolution';

const prototype = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'subject',setup(def){
  const enabled=def.state.bool('enabled',true);
  def.expose.state('enabled',enabled);
}});`;
const named = (name: string) => `import {definePrototype} from '@proto.ui/core';
export const Choice=definePrototype({name:'${name}',setup(def){}});`;

// These exercise the public frontend, not generated-source text or resolver wiring.
describe('static local source graph', () => {
  it('resolves a default import alias through explicit default forwarding', () => {
    const result = parsePrototype(`import Renamed from './bridge'; export {Renamed as default};`, {
      fileName: 'entry.proto.ts',
      files: {
        'bridge.ts': `export {default} from './subject';`,
        'subject.ts': prototype,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { name: 'subject', exposes: [{ name: 'enabled', kind: 'state', type: 'boolean' }] },
    });
  });

  it('expands an authored hook imported by a local default alias', () => {
    const result = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';
import apply from './bridge';
export default definePrototype({name:'caller',setup(def){apply();}});`,
      {
        fileName: 'entry.proto.ts',
        files: {
          'bridge.ts': `export {default} from './hook';`,
          'hook.ts': `import {defineAsHook} from '@proto.ui/core';
export default defineAsHook({name:'logic',setup(def){
  const ready=def.state.bool('ready',false);
  def.expose.state('ready',ready);
}});`,
        },
      }
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        name: 'caller',
        hooks: [{ name: 'logic' }],
        exposes: [{ name: 'ready', kind: 'state' }],
      },
    });
  });

  it('does not forward default through a star export', () => {
    const result = parsePrototype(`export * from './subject';`, {
      fileName: 'entry.proto.ts',
      files: { 'subject.ts': prototype },
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1002' }] });
  });

  it('lets explicit exports shadow conflicting star bindings', () => {
    const result = parsePrototype(
      `export * from './left'; export * from './right';
export {Choice, Choice as default} from './left';`,
      {
        fileName: 'entry.proto.ts',
        files: { 'left.ts': named('left'), 'right.ts': named('right') },
      }
    );
    expect(result).toMatchObject({ ok: true, value: { name: 'left' } });
  });

  it('accepts a diamond when both stars reach the same original binding', () => {
    const result = parsePrototype(`export * from './left'; export * from './right';`, {
      fileName: 'entry.proto.ts',
      exportName: 'Alias',
      files: {
        'left.ts': `export {Choice as Alias} from './subject';`,
        'right.ts': `import {Choice as Local} from './subject'; export {Local as Alias};`,
        'subject.ts': named('original'),
      },
    });
    expect(result).toMatchObject({ ok: true, value: { name: 'original' } });
  });

  it('rejects different bindings with the same star export name deterministically', () => {
    const source = `export * from './left';\nexport * from './right';`;
    const files = { 'left.ts': named('left'), 'right.ts': named('right') };
    const result = parsePrototype(source, {
      fileName: 'entry.proto.ts',
      exportName: 'Choice',
      files,
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002', span: { file: 'entry.proto.ts', line: 2 } }],
    });
    expect(
      parsePrototype(source, {
        fileName: 'entry.proto.ts',
        exportName: 'Choice',
        files: { 'right.ts': files['right.ts'], 'left.ts': files['left.ts'] },
      })
    ).toEqual(result);
  });

  it('rejects a missing explicit forwarded name outside the selected entry', () => {
    const result = parsePrototype(`${prototype}\nexport {Absent} from './dependency';`, {
      fileName: 'entry.proto.ts',
      files: { 'dependency.ts': named('dependency') },
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002', span: { file: 'entry.proto.ts', line: 6 } }],
    });
  });

  it('links an unused default alias and rejects a missing default export', () => {
    const result = parsePrototype(`import Unused from './dependency';\n${prototype}`, {
      fileName: 'entry.proto.ts',
      files: { 'dependency.ts': named('dependency') },
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002', span: { file: 'entry.proto.ts', line: 1 } }],
    });
  });

  it('rejects runtime import cycles even when none of the imported values is used', () => {
    const result = parsePrototype(
      `${prototype}\nimport {Choice} from './cycle'; export const Entry=definePrototype({name:'entry',setup(def){}});`,
      {
        fileName: 'entry.proto.ts',
        files: {
          'cycle.ts': `import {Entry} from './entry.proto'; ${named('cycle')}`,
        },
      }
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1008', span: { file: 'cycle.ts' } }],
    });
  });

  it('rejects cyclic star graphs rather than manufacturing an absent export', () => {
    const result = parsePrototype(`export * from './cycle';`, {
      fileName: 'entry.proto.ts',
      exportName: 'Choice',
      files: { 'cycle.ts': `export * from './entry.proto'; ${named('cycle')}` },
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1008' }] });
  });

  it('does not load missing or effectful type-only dependencies', () => {
    const result = parsePrototype(
      `import type MissingDefault from './missing';
import {type OnlyType} from './effects';
export type * from './missing-star';
export {type Forwarded} from './effects';
${prototype}`,
      { fileName: 'entry.proto.ts', files: { 'effects.ts': 'globalThis.changed=true;' } }
    );
    expect(result).toMatchObject({ ok: true, value: { name: 'subject' } });
  });

  it('keeps a default import as a runtime edge beside type-only named imports', () => {
    const result = parsePrototype(
      `import Subject, {type OnlyType} from './effects'; ${prototype}`,
      { fileName: 'entry.proto.ts', files: { 'effects.ts': 'globalThis.changed=true;' } }
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
  });

  it('checks runtime effects reached only through a star or empty forwarding list', () => {
    for (const edge of [
      `export * from './effects';`,
      `export {} from './effects';`,
      `import {} from './effects';`,
    ]) {
      const result = parsePrototype(`${prototype}\n${edge}`, {
        fileName: 'entry.proto.ts',
        files: { 'effects.ts': `throw new Error('Input code must never execute');` },
      });
      expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    }
  });

  it('rejects a default-export read before const initialization', () => {
    const result = parsePrototype(`import {definePrototype} from '@proto.ui/core';
export default Later;
const Later=definePrototype({name:'late',setup(def){}});`);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1008', span: { line: 2 } }],
    });
  });

  it('admits a forward ESM export binding and a hoisted setup function/import', () => {
    const result = parsePrototype(`export {Later as default};
const Later=definePrototype({name:'forward',setup});
function setup(def) { const ready=def.state.bool('ready',true); def.expose.state('ready',ready); }
import {definePrototype} from '@proto.ui/core';`);
    expect(result).toMatchObject({
      ok: true,
      value: { name: 'forward', exposes: [{ name: 'ready' }] },
    });
  });

  it('rejects arbitrary package defaults and indirect core factory calls', () => {
    expect(parsePrototype(`import Factory from 'unknown-package'; ${prototype}`)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003' }],
    });
    expect(
      parsePrototype(
        `import {factory} from './bridge'; export default factory({name:'x',setup(def){}});`,
        {
          files: {
            'bridge.ts': `import {definePrototype as factory} from '@proto.ui/core'; export {factory};`,
          },
        }
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1002' }] });
  });

  it('rejects lexical root traversal even if a similarly named source is supplied', () => {
    const result = parsePrototype(`export {default} from '../outside';`, {
      fileName: 'entry.proto.ts',
      files: { 'outside.ts': prototype },
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003', category: 'invalid-input' }],
    });
  });

  it('preserves type edges and canonical declarations for consumers of an alias', () => {
    const source = `import Subject, {type OnlyType} from './bridge'; export {Subject as default};`;
    const graph = new SourceGraph(source, {
      fileName: 'entry.proto.ts',
      files: {
        'bridge.ts': `export {Choice as default, type OnlyType} from './subject';`,
        'subject.ts': named('canonical'),
      },
    });
    const module = graph.load('entry.proto.ts');
    graph.validateExports();
    const binding = graph.resolveBinding(module, 'Subject');
    expect(binding.module?.file.fileName).toBe('subject.ts');
    expect(binding.name).toBe('Choice');
    expect(module.typeEdges.map((edge) => edge.specifier)).toEqual(['./bridge']);
  });

  it('resolves trusted static style declarations through an imported alias', () => {
    const graph = new SourceGraph(`import {STYLE as Local} from './styles'; export {Local};`, {
      fileName: 'entry.proto.ts',
      files: {
        'styles.ts': `import {tw as style} from '@proto.ui/core'; export const STYLE=style('hidden','opacity-0');`,
      },
    });
    const module = graph.load('entry.proto.ts');
    graph.validateExports();
    const binding = graph.resolveBinding(module, 'Local');
    expect(binding.module?.file.fileName).toBe('styles.ts');
    expect(binding.name).toBe('STYLE');
    expect(() => graph.definition(module, 'Local')).toThrow(CompilerRejection);
  });

  it('rejects top-level style computation rather than evaluating its arguments', () => {
    const source = `import {tw} from '@proto.ui/core'; export const STYLE=tw(globalThis.readStyle());`;
    const graph = new SourceGraph(source, { fileName: 'styles.ts' });
    expect(() => graph.load('styles.ts')).toThrow(CompilerRejection);
    expect(parsePrototype(`${source}\n${prototype}`, { fileName: 'entry.proto.ts' })).toMatchObject(
      {
        ok: false,
        diagnostics: [{ code: 'PUI1004' }],
      }
    );
  });
});

describe('root-relative file resolution', () => {
  it('uses the same extension/index candidate order for disk and explicit source graphs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pui-source-graph-'));
    try {
      await mkdir(path.join(root, 'dep'));
      await writeFile(path.join(root, 'dep.ts'), named('typescript'));
      await writeFile(path.join(root, 'dep.proto.ts'), named('prototype'));
      await writeFile(path.join(root, 'dep', 'index.ts'), named('index'));
      expect(await resolveLocalSource(root, 'entry.proto.ts', './dep')).toBe('dep.ts');
      const result = parsePrototype(`export {Choice as default} from './dep';`, {
        fileName: 'entry.proto.ts',
        files: {
          'dep.ts': named('typescript'),
          'dep.proto.ts': named('prototype'),
          'dep/index.ts': named('index'),
        },
      });
      expect(result).toMatchObject({ ok: true, value: { name: 'typescript' } });
      await rm(path.join(root, 'dep.ts'));
      await rm(path.join(root, 'dep.proto.ts'));
      expect(await resolveLocalSource(root, 'entry.proto.ts', './dep')).toBe('dep/index.ts');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolves a root directory index and reports a missing local source', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pui-source-index-'));
    try {
      await writeFile(path.join(root, 'index.ts'), prototype);
      expect(await resolveLocalSource(root, 'entry.proto.ts', './')).toBe('index.ts');
      await expect(resolveLocalSource(root, 'entry.proto.ts', './missing')).rejects.toThrow(Error);
      expect(localSourceBase('nested/entry.proto.ts', '../index')).toBe('index');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a symlink that leaves the declared root', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'pui-source-symlink-'));
    const root = path.join(workspace, 'root');
    try {
      await mkdir(root);
      await writeFile(path.join(workspace, 'outside.ts'), prototype);
      await symlink(path.join(workspace, 'outside.ts'), path.join(root, 'escaped.ts'));
      await expect(resolveLocalSource(root, 'entry.proto.ts', './escaped')).rejects.toThrow(Error);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
