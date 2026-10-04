// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/memory';

export const styledSource = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'styled-toggle',setup(def){
  def.props.define({active:{type:'boolean'},label:{type:'string'}});
  def.props.setDefaults({active:false,label:'Toggle'});
  const base=tw('bg-white','opacity-100');
  const accent=tw('bg-black','opacity-40');
  def.feedback.style.use(base);
  def.rule({when:(w)=>w.prop('active').eq(true),intent:(i)=>i.feedback.style.use(accent)});
  return (r)=>r.el('span',r.read.props.get().label);
}});`;

describe('compiled declarative presentation', () => {
  it('compiles reversible Rule/style intent and readonly render input', () => {
    const compiled = compilePrototype(styledSource);
    expect(compiled.ok, compiled.ok ? undefined : JSON.stringify(compiled.diagnostics)).toBe(true);
  });
});
