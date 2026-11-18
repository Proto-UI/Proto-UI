import {definePrototype} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';
export default definePrototype({name:'scroll-return-consumer',setup(def){
  const scroll=asScrollSurface();
  scroll.configure({axes:'vertical',endFollow:{mode:'while-at-end',axis:'vertical'}});
  let createdKind='';
  def.lifecycle.onCreated(()=>{createdKind=scroll.request({kind:'to',axis:'vertical',position:0.5}).kind;});
  def.expose.method('createdOutcome',()=>createdKind);
  def.expose.method('toKind',()=>scroll.request({kind:'to',axis:'vertical',position:0.5}).kind);
  def.expose.method('byKind',()=>scroll.request({kind:'by',axis:'vertical',delta:10}).kind);
  def.expose.method('pageKind',()=>scroll.request({kind:'page',axis:'vertical',direction:'after'}).kind);
  def.expose.method('dragKind',()=>scroll.request({kind:'control-drag',axis:'vertical',position:0.25}).kind);
  def.expose.method('endKind',()=>scroll.request({kind:'to-end',axis:'vertical'}).kind);
  def.expose.method('wrongAxisKind',()=>scroll.request({kind:'to',axis:'horizontal',position:0.5}).kind);
  def.expose.method('wrongAxisOutcome',()=>scroll.request({kind:'to',axis:'horizontal',position:0.5}));
  return r=>r.el('div',r.slot());
}});
