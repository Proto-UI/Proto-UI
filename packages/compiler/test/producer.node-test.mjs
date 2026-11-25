import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createProtoProgram } from '@proto.ui/compiler/frontend';
import { AUTHORING_DECLARATIONS, produceComponentIR } from '@proto.ui/compiler/producer';
import { emitReact } from '@proto.ui/compiler/targets/react';

const require = createRequire(import.meta.url);
const compiler = fileURLToPath(new URL('../', import.meta.url));

async function project(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-source-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  await mkdir(path.join(root, 'node_modules/@proto.ui'), { recursive: true });
  await symlink(compiler, path.join(root, 'node_modules/@proto.ui/compiler'), 'dir');
  for (const name of ['react', 'react-dom']) {
    await symlink(
      path.dirname(require.resolve(`${name}/package.json`)),
      path.join(root, 'node_modules', name),
      'dir'
    );
  }
  return {
    write: (name, text) => writeFile(path.join(root, name), text),
    produce() {
      const program = createProtoProgram({
        currentDirectory: root,
        rootNames: ['entry.ts'],
        compilerOptions: { paths: { '@proto.ui/core/authoring': [AUTHORING_DECLARATIONS] } },
      });
      return produceComponentIR(program, { fileName: 'entry.ts', publicName: 'Panel' });
    },
    async render(result, name, value) {
      assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
      const target = path.join(root, name);
      await writeFile(target, emitReact(result.component));
      const { Panel } = await import(pathToFileURL(target).href);
      return renderToStaticMarkup(createElement(Panel, { value }));
    },
  };
}

test('re-exported prototype and imported helper follow the actual source across revisions', async (t) => {
  const p = await project(t);
  await p.write('entry.ts', `export { View as default } from './widget.ts';`);
  await p.write('api.ts', `export { definePrototype as build } from '@proto.ui/core/authoring';`);
  await p.write(
    'widget.ts',
    `import * as proto from './api.ts'; import { decorate as draw } from './helper.ts';
    export const View = proto.build({ name: 'unrelated-name', setup(owner) {
      const inputs = owner.props.define({ value: { type: 'string', default: '' } });
      return view => view.el('span', {}, [draw(view.get(inputs.value))]);
    } });`
  );
  await p.write('helper.ts', `export function decorate(text: string) { return 'first ' + text; }`);
  const first = p.produce();
  assert.equal(await p.render(first, 'first.ts', 'α'), '<span>first α</span>');
  await p.write('helper.ts', `export function decorate(text: string) { return text + ' 🙂'; }`);
  const next = p.produce();
  assert.equal(await p.render(next, 'next.ts', 'β'), '<span>β 🙂</span>');
  assert.equal(first.sourceClosure.configurationHash, next.sourceClosure.configurationHash);
  assert.notEqual(first.sourceClosure.digest, next.sourceClosure.digest);
  assert.ok(next.component.behaviors.some((fn) => fn.binding.source.file === 'helper.ts'));
});

test('one immutable helper reads each bound handle independently', async (t) => {
  const p = await project(t);
  await p.write(
    'entry.ts',
    `import { definePrototype, type PropHandle, type ReadContext } from '@proto.ui/core/authoring';
    const select = (prefix: string, handle: PropHandle<string>, read: ReadContext) => prefix + read.get(handle);
    export default definePrototype({ name: 'two-reads', setup(owner) {
      const fields = owner.props.define({ value: { type: 'string', default: '' }, second: { type: 'string', default: 'right' } });
      const second = fields.second;
      const firstLabel = owner.derive('first', read => select('1:', fields.value, read));
      const secondLabel = owner.derive('second', read => select('2:', second, read));
      return view => view.el('span', {}, [view.get(firstLabel), '|', view.get(secondLabel)]);
    } });`
  );
  const compiled = p.produce();
  assert.equal(await p.render(compiled, 'pair.ts', 'left'), '<span>1:left|2:right</span>');
  assert.equal(await p.render(compiled, 'updated.ts', 'changed'), '<span>1:changed|2:right</span>');
});

test('an eager imported constant must be initialized when the module reads it', async (t) => {
  const p = await project(t);
  await p.write(
    'entry.ts',
    `import './a.ts'; import { definePrototype } from '@proto.ui/core/authoring';
    export default definePrototype({ name:'cyclic', setup(){ return r => r.el('span',{},['visible']); } });`
  );
  await p.write('a.ts', `import { b } from './b.ts'; export const a: number = b;`);
  await p.write('b.ts', `import { a } from './a.ts'; export const b: number = a;`);
  const cyclic = p.produce();
  assert.equal(cyclic.status, 'unavailable');
  assert.ok(
    cyclic.diagnostics.some(
      (d) =>
        d.capabilityKey === 'producer/module-initialization-order' &&
        d.location.file.endsWith('b.ts')
    )
  );
  await p.write('b.ts', `import './a.ts'; export const b = 1;`);
  assert.equal(await p.render(p.produce(), 'acyclic-read.ts'), '<span>visible</span>');
});
