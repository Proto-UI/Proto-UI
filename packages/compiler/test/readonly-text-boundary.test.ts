// @vitest-environment node
import { expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'readonly-text-boundary',setup(def){
 def.props.define({text:{type:'string',default:'歌😀'}});
 def.expose.event('changed',{payload:'json'});
 def.lifecycle.onCreated(run=>{
  const text=run.props.get().text;
  const detail:Readonly<{text:string;length:number}>=Object.freeze({text,length:text.length});
  run.expose.emit('changed',detail);
 });
 return r=>r.slot();
}});`;
it.each([
  'gpui-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
])('publishes frozen readonly data through a copying JSON boundary in %s', (profile) => {
  const result = compilePrototype(source, { profile });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});
it('retains readonly member-write protection within authored code', () => {
  expect(
    parsePrototype(
      source.replace(
        "run.expose.emit('changed',detail);",
        "detail.text='overwrite';run.expose.emit('changed',detail);"
      )
    ).ok
  ).toBe(false);
});
it('does not erase a hidden nominal capability at the outward boundary', () => {
  const invalid = source
    .replace('import {definePrototype}', 'import {definePrototype,type State}')
    .replace(
      'def.lifecycle.onCreated',
      'const state=def.state.bool("flag",false);def.lifecycle.onCreated'
    )
    .replace(
      'Readonly<{text:string;length:number}>',
      'Readonly<{text:string;length:number;state:State<boolean>}>'
    )
    .replace(
      'Object.freeze({text,length:text.length})',
      'Object.freeze({text,length:text.length,state})'
    );
  expect(compilePrototype(invalid, { profile: 'gpui-source-v1' })).toMatchObject({
    ok: false,
    diagnostics: [{ message: 'Outward payload does not match its declared data boundary.' }],
  });
});
it('independently rechecks a serialized readonly event payload', () => {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const roundtrip = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  expect(roundtrip.ok, JSON.stringify(roundtrip.ok ? {} : roundtrip.diagnostics)).toBe(true);
});
it.each(['(42).length', 'true.length', '({value:1}).length'])(
  'does not admit unrelated primitive or record length %s',
  (expression) => {
    expect(
      compilePrototype(source.replace('text.length', expression), { profile: 'gpui-source-v1' }).ok
    ).toBe(false);
  }
);
