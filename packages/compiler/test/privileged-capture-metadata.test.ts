// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = `import{definePrototype,defineAsHook}from'@proto.ui/core';
import{asFocusable,asTrigger}from'@proto.ui/hooks';
const after=defineAsHook({name:'after',setup(){}});
const outer=defineAsHook({name:'outer',setup(){asFocusable();after();asFocusable();asTrigger();}});
export default definePrototype({name:'privileged-capture',setup(def){
  const original=asFocusable();const result=outer();
  const child=result.getAsHook?.('asFocusable');
  if(!child)throw new Error('missing child');
  const handle=result.getAsHookHandle?.('asFocusable');
  def.expose.value('same',child.result===original&&child.handle===original&&handle===original);
  def.expose.value('privileged',child.privileged);
  def.expose.value('order',child.order);
  def.expose.value('focused',child.result.focused.get());
  return r=>r.el('div',[]);
}});`;

it('proves privileged children and their raw facade types without flattening them into owned State', () => {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const outer = parsed.value.hooks.find(hook => hook.name === 'outer')!;
  expect(outer.capture?.children.map(child => child.name)).toEqual(['asFocusable','after','asTrigger']);
  expect(outer.capture?.states).toEqual([]);
  expect(validateIR(parsed.value).ok).toBe(true);
});

it('rejects portable metadata that removes a privileged child', () => {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const forged = structuredClone(parsed.value);
  forged.hooks.find(hook => hook.name === 'outer')!.capture!.children = [];
  expect(validateIR(forged).ok).toBe(false);
});

export const privilegedCaptureSource = source;
