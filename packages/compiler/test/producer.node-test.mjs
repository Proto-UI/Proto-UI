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
    async render(result, name, props) {
      assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
      const target = path.join(root, name);
      await writeFile(target, emitReact(result.component));
      const { Panel } = await import(pathToFileURL(target).href);
      return renderToStaticMarkup(createElement(Panel, props));
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
  assert.equal(await p.render(first, 'first.ts', { value: 'α' }), '<span>first α</span>');
  await p.write('helper.ts', `export function decorate(text: string) { return text + ' 🙂'; }`);
  const next = p.produce();
  assert.equal(await p.render(next, 'next.ts', { value: 'β' }), '<span>β 🙂</span>');
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
  assert.equal(await p.render(compiled, 'pair.ts', { value: 'left' }), '<span>1:left|2:right</span>');
  assert.equal(await p.render(compiled, 'updated.ts', { value: 'changed' }), '<span>1:changed|2:right</span>');
});

test('immutable discriminator aliases retain the payload of each matched argument', async (t) => {
  const p = await project(t);
  await p.write('entry.ts', `
    import { definePrototype } from '@proto.ui/core/authoring';
    type Result = { kind: 'ok'; value: string } | { kind: 'err'; error: string };

    function describe(first: Result, second: Result): string {
      const tag = first.kind;
      if (tag === 'err') {
        const other = second.kind;
        switch (other) {
          case 'ok': return first.error + second.value;
          case 'err': return first.error + second.error;
        }
      }
      return first.value;
    }

    export default definePrototype({ name: 'result-pair', setup(def) {
      const flags = def.props.define({
        left: { type: 'boolean', default: false },
        right: { type: 'boolean', default: false },
      });
      const first = def.state.define<Result>('first', { initialize: read => read.get(flags.left)
        ? { kind: 'ok', value: 'left-ok' } : { kind: 'err', error: 'left-error/' } });
      const second = def.state.define<Result>('second', { initialize: read => read.get(flags.right)
        ? { kind: 'ok', value: 'right-ok' } : { kind: 'err', error: 'right-error' } });
      const label = def.derive('label', read => describe(read.get(first), read.get(second)));
      return view => view.el('span', {}, [view.get(label)]);
    } });`);
  const compiled = p.produce();
  for (const [left, right, expected] of [
    [false, true, 'left-error/right-ok'],
    [false, false, 'left-error/right-error'],
    [true, false, 'left-ok'],
    [true, true, 'left-ok'],
  ]) {
    const markup = await p.render(compiled, 'result-pair.ts', { left, right });
    assert.equal(markup, `<span>${expected}</span>`);
  }
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


const restrictedDomains = [
  ['a numeric singleton', '1', '1'],
  ['a numeric union alias', '1 | 2', '1'],
  ['a signed numeric singleton', '-1', '-1'],
  ['the true singleton', 'true', 'true'],
  ['the false singleton', 'false', 'false'],
  ['a readonly numeric record field', '{ readonly mode: 1 | 2 }', '{ mode: 1 }'],
  ['a readonly boolean record field', '{ readonly active: true }', '{ active: true }'],
  ['a Presence payload', 'Presence<1 | 2>', "{ kind: 'present', value: 1 }"],
  ['a tagged payload', "{ kind: 'active'; mode: 1 | 2 } | { kind: 'idle' }", "{ kind: 'active', mode: 1 }"],
];

for (const [description, domain, initial] of restrictedDomains) {
  for (const surface of ['state', 'action']) {
    test(`declared ${surface} preserves ${description} as a missing exact-domain capability`, async (t) => {
      const p = await project(t);
      const declaration = surface === 'state'
        ? `const value = def.state.define<Domain>('value', { initialize: () => (${initial}) });
           def.expose.state('value', value);`
        : `const change = def.action<[mode: Domain], void>('change', (_run, mode) => {});
           def.expose.action('change', change);`;
      await p.write('entry.ts', `
        import { definePrototype, type Presence } from '@proto.ui/core/authoring';
        type Domain = ${domain};
        export default definePrototype({ name: 'restricted-domain', setup(def) {
          ${declaration}
          return view => view.el('span', {}, ['visible']);
        } });`);
      const result = p.produce();
      assert.equal(result.status, 'unavailable', 'A valid restricted source domain must not become an unrestricted public scalar.');
      assert.equal(result.component, undefined);
      const diagnostic = result.diagnostics.find(item => item.capabilityKey === 'producer/value-type');
      assert.ok(diagnostic, JSON.stringify(result.diagnostics));
      assert.equal(diagnostic.category, 'compiler-missing');
      assert.equal(diagnostic.severity, 'info');
      assert.ok(diagnostic.criterion.length);
      assert.ok(diagnostic.trackingRef);
      assert.ok(!result.diagnostics.some(item => item.capabilityKey?.startsWith('frontend/')));
    });
  }
}

test('an exposed restricted state and its action are never emitted as an unrestricted host number API', async (t) => {
  const p = await project(t);
  await p.write('entry.ts', `
    import { definePrototype } from '@proto.ui/core/authoring';
    export default definePrototype({ name: 'restricted-action', setup(def) {
      const mode = def.state.define<1 | 2>('mode', { initialize: () => 1 });
      const change = def.action<[mode: 1 | 2], void>('change', (run, value) => run.set(mode, value));
      def.expose.state('mode', mode);
      def.expose.action('change', change);
      return view => view.el('span', {}, ['visible']);
    } });`);
  const result = p.produce();
  assert.equal(result.status, 'unavailable');
  assert.equal(result.component, undefined);
  assert.ok(result.diagnostics.some(item => item.capabilityKey === 'producer/value-type' &&
    item.category === 'compiler-missing' && item.severity === 'info'));
});

for (const [description, domain, initial, lowered] of [
  ['positive number', 'number', '1', 'number'],
  ['negative number', 'number', '-1', 'number'],
  ['true boolean', 'boolean', 'true', 'bool'],
  ['false boolean', 'boolean', 'false', 'bool'],
  ['the complete boolean union', 'true | false', 'false', 'bool'],
]) {
  test(`ordinary ${description} keeps its complete public scalar domain`, async (t) => {
    const p = await project(t);
    await p.write('entry.ts', `
      import { definePrototype } from '@proto.ui/core/authoring';
      type Domain = ${domain};
      export default definePrototype({ name: 'complete-domain', setup(def) {
        const value = def.state.define<Domain>('value', { initialize: () => (${initial}) });
        const change = def.action<[next: Domain], void>('change', (run, next) => run.set(value, next));
        def.expose.state('value', value);
        def.expose.action('change', change);
        return view => view.el('span', {}, ['visible']);
      } });`);
    const result = p.produce();
    assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
    assert.equal(result.component.fields.find(field => field.kind === 'state').binding.type, lowered);
    const action = result.component.actions.find(item => item.name === 'change');
    const behavior = result.component.behaviors.find(item => item.binding.id === action.fn);
    assert.deepEqual(behavior.params.map(item => item.type), [lowered]);
    assert.equal(await p.render(result, 'complete-domain.ts'), '<span>visible</span>');
  });
}

test('ordinary signed and boolean setup constants retain primitive contextual uses', async (t) => {
  const p = await project(t);
  await p.write('entry.ts', `
    import { definePrototype } from '@proto.ui/core/authoring';
    export default definePrototype({ name: 'ordinary-constants', setup() {
      const amount = (-1);
      const enabled = true;
      const disabled = false;
      const negated = !false;
      const plainAlias = enabled;
      const copy: number = amount;
      const alias: boolean = enabled;
      return view => view.el('span', {}, [amount + copy === -2 ? 'matched' : 'wrong', enabled ? 'on' : 'off', disabled ? 'on' : 'off', alias ? 'on' : 'off', negated ? 'on' : 'off', plainAlias ? 'on' : 'off']);
    } });`);
  assert.equal(await p.render(p.produce(), 'ordinary-constants.ts'), '<span>matchedonoffononon</span>');
});


for (const annotation of ['', ': number']) {
  test(`ordinary conditional numeric expressions preserve ${annotation ? 'a number context' : 'inferred values'}`, async (t) => {
    const p = await project(t);
    await p.write('entry.ts', `
      import { definePrototype } from '@proto.ui/core/authoring';
      export default definePrototype({ name: 'ordinary-conditional', setup() {
        const flag: boolean = true;
        const value${annotation} = flag ? 1 : 2;
        return view => view.el('span', {}, [value === 1 ? 'first' : 'second']);
      } });`);
    assert.equal(await p.render(p.produce(), 'ordinary-conditional.ts'), '<span>first</span>');
  });
}
