const { compilePrototype } = await import(process.argv[2]);
const source = `import{definePrototype}from'@proto.ui/core';
export default definePrototype({name:'recursive-record-owner',setup(def){
 def.expose.event('report',{payload:'json'});
 def.event.on('press.commit',run=>{
  const make=(value:number):{value:number}=>({value});
  let current:{value:number}|null=null;
  const walk=(depth:number):void=>{
   current=make(depth);
   if(depth>0)walk(depth-1);
  };
  walk(2);
  if(current)run.expose.emit('report',current);
 });
 return r=>r.slot();
}});`;
const start = performance.now();
const r = compilePrototype(source, { profile: 'react-dom-source-v1' });
console.log(
  JSON.stringify(
    {
      elapsedMs: performance.now() - start,
      result: r.ok ? { ok: true } : { ok: false, diagnostics: r.diagnostics },
    },
    null,
    2
  )
);
