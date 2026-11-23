/** Independently authored getter oracle; no historical/private candidate bytes. */
export const recordGetterFixture = `import {definePrototype} from '@proto.ui/core';
let moduleReads=0;
const shared={get value(){moduleReads++;return moduleReads;}};
export default definePrototype({name:'record-getter-native-owner',setup(def){
  let reads=0;
  let order='';
  const record={
    get value(){reads++;return reads;},
    get broken():number{reads++;throw 37;},
  };
  const ordered={
    get second(){order=order+'b';return 2;},
    get '3'(){order=order+'3';return 3;},
    get first(){order=order+'a';return 1;},
    get '1'(){order=order+'1';return 1;},
  };
  def.expose.method('reads',()=>reads);
  def.expose.method('read',()=>record.value);
  def.expose.method('dynamic',(key:string)=>{const used=record[key];return reads;});
  def.expose.method('copy',()=>{
    const copied={...{get value(){reads++;return reads;}}};
    const first=copied.value;
    const second=copied.value;
    copied.value=91;
    return {first,second,changed:copied.value,reads};
  });
  def.expose.method('spreadOverride',()=>{
    const copied={...{get value(){reads++;return reads;}},value:91};
    return {value:copied.value,reads};
  });
  def.expose.method('inlineGetter',()=>{
    const value={...{ordinary:4},get next(){reads++;return reads;}};
    const before=reads;
    return {before,first:value.next,second:value.next};
  });
  def.expose.method('assign',()=>{
    const copied=Object.assign({}, {get value(){reads++;return reads;}});
    return {first:copied.value,second:copied.value,reads};
  });
  def.expose.method('optionalSpread',(present:boolean)=>{
    const maybe:{value?:number}=present?{value:73}:{};
    const copy={get value(){reads++;return reads;},...maybe,call:()=>0};
    return {value:copy.value,reads};
  });
  def.expose.method('broken',()=>record.broken);
  def.expose.method('abruptSpread',()=>{
    try{const unused={...record};return 0;}catch(error){return reads;}
  });
  def.expose.method('ordered',()=>{const copy={...ordered};return order;});
  def.expose.method('moduleRead',()=>shared.value);
  def.expose.method('moduleReads',()=>moduleReads);
  return r=>r.el('output',['getter owner']);
}});`;
