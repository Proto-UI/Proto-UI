// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { SourceGraph } from '../src/parser-module';

const buttonSource = readFileSync(
  fileURLToPath(new URL('../../prototypes/base/src/button/button.proto.ts', import.meta.url)),
  'utf8'
);
const simple = `import { definePrototype } from '@proto.ui/core';\nexport default definePrototype({ name: 'simple', setup(def) {} });`;

describe('restricted TypeScript frontend', () => {
  it('analyzes actual Base Button and changes IR when a callback result changes', () => {
    const original = parsePrototype(buttonSource, { fileName: 'button.proto.ts' });
    const mutant = parsePrototype(
      buttonSource.replace(
        "hovered.set(true, 'reason: button pointer.enter => hovered')",
        "hovered.set(false, 'reason: button pointer.enter => hovered')"
      ),
      { fileName: 'button.proto.ts' }
    );
    expect(original.ok).toBe(true);
    expect(mutant.ok).toBe(true);
    if (!original.ok || !mutant.ok) throw new Error(JSON.stringify([original, mutant]));
    expect(original.value.exposes.map((entry) => entry.name)).toEqual([
      'disabled',
      'hovered',
      'focused',
      'focusVisible',
      'focusSelf',
      'pressed',
      'click',
    ]);
    expect(mutant.value.setup).not.toEqual(original.value.setup);
    expect(mutant.value.source.sha256).not.toBe(original.value.source.sha256);
    expect(JSON.parse(JSON.stringify(original.value))).toEqual(original.value);
    expect(parsePrototype(buttonSource, { fileName: 'button.proto.ts' })).toEqual(original);
  });

  it('keeps valid __default lexical binding distinct from an inline default export', () => {
    const source = `import { definePrototype } from '@proto.ui/core';
const __default = definePrototype({name:'original',setup(def){}});
export default definePrototype({name:'replacement',setup(def){}});
export { __default as named };`;
    const graph = new SourceGraph(source, { fileName: 'exports.proto.ts' });
    const module = graph.load('exports.proto.ts');
    const named = graph.definition(module, 'named');
    const direct = graph.definition(module, 'default');
    expect(graph.descriptor(named.module, named.node).name).toBe('original');
    expect(graph.descriptor(direct.module, direct.node).name).toBe('replacement');
    const parsedNamed = parsePrototype(source, { exportName: 'named' });
    const parsedDefault = parsePrototype(source);
    expect(parsedNamed.ok && parsedNamed.value.name).toBe('original');
    expect(parsedDefault.ok && parsedDefault.value.name).toBe('replacement');
  });

  it('rejects duplicate default and named exports instead of last-write-wins resolution', () => {
    for (const suffix of [
      "export default definePrototype({name:'second',setup(def){}});",
      "const a = definePrototype({name:'a',setup(def){}}); export {a as same}; export {a as same};",
    ]) {
      const result = parsePrototype(`${simple}\n${suffix}`);
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1002', category: 'invalid-input' }],
      });
    }
  });

  it('rejects absolute and colliding graph identities without replacing a module', () => {
    for (const fileName of [
      '/left/value.proto.ts',
      '/right/value.proto.ts',
      'C:\\left\\value.proto.ts',
      '\\\\host\\share\\value.proto.ts',
    ]) {
      expect(parsePrototype(simple, { fileName })).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1003', category: 'invalid-input' }],
      });
    }
    expect(
      parsePrototype(simple, { files: { './value.proto.ts': simple, 'value.proto.ts': simple } })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1003' }] });
    expect(
      parsePrototype(simple, {
        fileName: 'entry.proto.ts',
        files: { 'entry.proto.ts': simple.replace('simple', 'different') },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1003' }] });
    const distinct = new SourceGraph(simple, {
      fileName: 'entry.proto.ts',
      files: {
        'left/value.proto.ts': simple,
        'right/value.proto.ts': simple.replace('simple', 'right'),
      },
    });
    expect(distinct.load('left/value.proto.ts').file.text).not.toBe(
      distinct.load('right/value.proto.ts').file.text
    );
  });

  it('rejects async and generator setup forms through the integrated frontend', () => {
    const definitions = [
      "function* setup(def) {}\nexport default definePrototype({name:'x',setup:setup});",
      "async function setup(def) {}\nexport default definePrototype({name:'x',setup:setup});",
      "export default definePrototype({name:'x',*setup(def){}});",
      "export default definePrototype({name:'x',async setup(def){}});",
      "export default definePrototype({name:'x',setup: async (def)=>{}});",
      "export default definePrototype({name:'x',setup: function*(def){}});",
    ];
    for (const definition of definitions) {
      expect(
        parsePrototype(`import {definePrototype} from '@proto.ui/core';\n${definition}`)
      ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    }
  });

  it('analyzes one static authored-hook call into the caller source graph', () => {
    const caller = `import {definePrototype} from '@proto.ui/core';
import {asButton as applyButton} from './button.proto';
export default definePrototype({name:'caller',setup(def){applyButton();}});`;
    const result = parsePrototype(caller, {
      fileName: 'caller.proto.ts',
      files: { 'button.proto.ts': buttonSource },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.name).toBe('caller');
    expect(result.value.hooks.map((hook) => hook.name)).toEqual(['as-button']);
    expect(result.value.exposes.some((entry) => entry.name === 'click')).toBe(true);
    expect(result.value.setup.body[0]).toMatchObject({
      kind: 'effect',
      expression: { kind: 'authored-hook' },
    });
    expect(parsePrototype(buttonSource, { exportName: 'asButton' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002' }],
    });
  });

  it('rejects unknown effects and captures with original source positions, without executing input', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'x',setup(def){
  fetch('https://example.invalid');
}});`;
    expect(parsePrototype(source, { fileName: 'bad.proto.ts' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1004', span: { file: 'bad.proto.ts', line: 3, column: 3 } }],
    });
    expect(
      parsePrototype(simple.replace('setup(def) {}', 'setup(def) { const value = window; }'))
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1005' }] });
    expect(
      parsePrototype(
        simple.replace(
          'setup(def) {}',
          "setup(def) { const state=def.state.bool('flag',false); state.set(true); }"
        )
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
  });

  it('rejects effects in unused imported modules and unsupported module requirements', () => {
    const source = `import {definePrototype} from '@proto.ui/core';\nimport {unused} from './effect';\nexport default definePrototype({name:'x',setup(def){}});`;
    expect(
      parsePrototype(source, { files: { 'effect.ts': 'globalThis.changed = true;' } })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    expect(
      parsePrototype(simple.replace('setup(def) {}', 'modules: [], setup(def) {}'))
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('rejects a missing module reached only through an unselected re-export', () => {
    const source = `${simple}\nexport { unused } from './missing';`;
    expect(parsePrototype(source, { fileName: 'entry.proto.ts' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003', category: 'unsupported-input' }],
    });
  });

  it('rejects unsupported effects in an unselected re-export dependency', () => {
    const source = `${simple}\nexport { unused } from './dependency';`;
    expect(
      parsePrototype(source, {
        fileName: 'entry.proto.ts',
        files: { 'dependency.ts': 'globalThis.changed = true;' },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
  });

  it('rejects effectful direct default calls even when another export is selected', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
export const selected = definePrototype({name:'selected',setup(def){}});
export default globalThis.sideEffect();`;
    expect(parsePrototype(source, { exportName: 'selected' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002' }],
    });
  });

  it('accepts a valid static direct default when another export is selected', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
export const selected = definePrototype({name:'selected',setup(def){}});
export default definePrototype({name:'unused',setup(def){}});`;
    expect(parsePrototype(source, { exportName: 'selected' })).toMatchObject({
      ok: true,
      value: { name: 'selected' },
    });
  });

  it('validates unselected direct default calls reached through a re-export', () => {
    const source = `${simple}\nexport { unused } from './dependency';`;
    const dependency = `import {definePrototype} from '@proto.ui/core';
export const unused = definePrototype({name:'unused',setup(def){}});
export default definePrototype(globalThis.sideEffect());`;
    expect(
      parsePrototype(source, {
        fileName: 'entry.proto.ts',
        files: { 'dependency.ts': dependency },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('rejects a missing binding from an otherwise present unused local import', () => {
    const source = `import {definePrototype} from '@proto.ui/core';
import {missing} from './dependency';
export default definePrototype({name:'entry',setup(def){}});`;
    expect(
      parsePrototype(source, {
        fileName: 'entry.proto.ts',
        files: { 'dependency.ts': 'export interface OnlyAType {}' },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1002' }] });
  });

  it('includes a valid unselected re-export in provenance and validates its target name', () => {
    const source = `${simple}\nexport { unused } from './dependency';`;
    const dependency = (name: string) =>
      `import {definePrototype} from '@proto.ui/core'; export const unused = definePrototype({name:'${name}',setup(def){}});`;
    const options = (text: string) => ({
      fileName: 'entry.proto.ts',
      files: { 'dependency.ts': text },
    });
    const first = parsePrototype(source, options(dependency('first')));
    const second = parsePrototype(source, options(dependency('second')));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected both static source graphs to compile');
    expect(first.value.source.sha256).not.toBe(second.value.source.sha256);
    expect(parsePrototype(source, options('export interface OnlyAType {}'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1002' }],
    });
  });

  it('accepts independent primitive/control-flow prototypes without matching Button identity', () => {
    const source = `import {definePrototype as prototype} from '@proto.ui/core';
export default prototype({name:'counter',setup(def){
 const count=def.state.numberDiscrete('count',0);
 def.expose.state('count',count);
 def.event.on('press.commit',()=>{if(count.get()<4){count.set(count.get()+1);}});
}});`;
    const result = parsePrototype(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.exposes).toMatchObject([{ name: 'count', kind: 'state', type: 'number' }]);
    expect(result.value.name).toBe('counter');
  });
  it('rejects non-boolean, wrong-arity and setup-time view-presence requests', () => {
    for (const [body, code] of [
      ["def.lifecycle.onCreated((run)=>run.lifecycle.setPresent('false'));", 'PUI1006'],
      ['def.lifecycle.onCreated((run)=>run.lifecycle.setPresent());', 'PUI1006'],
      ['def.lifecycle.setPresent(false);', 'PUI1004'],
      ['def.lifecycle.onCreated((run)=>run.lifecycle.dispose());', 'PUI1004'],
    ]) {
      expect(
        parsePrototype(simple.replace('setup(def) {}', `setup(def) { ${body} }`))
      ).toMatchObject({ ok: false, diagnostics: [{ code }] });
    }
  });
});
