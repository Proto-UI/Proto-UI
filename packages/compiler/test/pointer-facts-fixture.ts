export const POINTER_TYPES = ['pointer.down', 'pointer.move', 'pointer.up', 'pointer.cancel', 'pointer.enter', 'pointer.leave'] as const;
export const WEB_TARGETS = ['wc', 'react', 'vue', 'vue2'] as const;
export type PointerWebTarget = (typeof WEB_TARGETS)[number];

/** Independent atomic definition consumer, not a Select business-protocol copy. */
export function pointerFactsSource(scope: 'root' | 'global') {
  const register = scope === 'root' ? 'on' : 'onGlobal';
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'pointer-facts-native-probe',setup(def){
  const kind=def.state.string('pointer.kind','initial');
  const buttons=def.state.string('pointer.buttons','initial');
  const lastType=def.state.string('pointer.type','initial');
  const key=def.state.string('pointer.key','initial');
  const calls=def.state.numberDiscrete('pointer.calls',0);
  const hover=def.state.numberDiscrete('pointer.hover',0);
  const commits=def.state.numberDiscrete('pointer.commits',0);
  const enabled=def.state.bool('pointer.enabled',true);
  const present=def.state.bool('pointer.present',true);
  const prevent=def.state.bool('pointer.prevent',false);
  const preventionCalls=def.state.numberDiscrete('pointer.preventions',0);
  const identity=def.state.string('pointer.identity','initial');
  def.expose.event('sample',{payload:'json'});
  def.expose.method('kind',()=>kind.get());
  def.expose.method('buttons',()=>buttons.get());
  def.expose.method('type',()=>lastType.get());
  def.expose.method('key',()=>key.get());
  def.expose.method('calls',()=>calls.get());
  def.expose.method('hover',()=>hover.get());
  def.expose.method('commits',()=>commits.get());
  def.expose.method('enabled',(next:boolean)=>{enabled.set(next);});
  def.expose.method('present',(next:boolean)=>{present.set(next);});
  def.expose.method('prevent',(next:boolean)=>{prevent.set(next);});
  def.expose.method('preventions',()=>preventionCalls.get());
  def.expose.method('identity',()=>identity.get());
  present.watch((run,event)=>{if(event.type==='next')run.lifecycle.setPresent(event.next);});
${POINTER_TYPES.map((type) => `  def.event.${register}('${type}',(run,event)=>{
    kind.set(event.pointerType ?? 'absent');buttons.set(event.pointerButtons ?? 'absent');lastType.set(event.type);calls.set(calls.get()+1);
    if(event.type==='pointer.move' && event.pointerType==='mouse' && event.pointerButtons==='none' && enabled.get())hover.set(hover.get()+1);
    run.expose.emit('sample',{type:event.type,kind:event.pointerType ?? 'absent',buttons:event.pointerButtons ?? 'absent'});
    run.update();
  });`).join('\n')}
  def.event.${register}('pointer.move',(run,event)=>{
    const control=event.control;
    const choose=(payload:boolean)=>{if(payload)return event;return control;};
    const mixed=choose(event.pointerButtons==='none');
    if(mixed===event)identity.set(mixed.pointerType ?? 'absent');else identity.set('control');
    if(prevent.get()){
      event.control.requestDefaultActionPrevention();
      control.requestDefaultActionPrevention();
      preventionCalls.set(preventionCalls.get()+2);
    }
    run.update();
  });
  def.event.${register}('pointer.move',(run,event)=>{
    if(prevent.get()){event.control.requestDefaultActionPrevention();preventionCalls.set(preventionCalls.get()+1);run.update();}
  });
  def.event.${register}('key.down',(run,event)=>{kind.set(event.pointerType ?? 'absent');buttons.set(event.pointerButtons ?? 'absent');key.set(event.key ?? 'absent');lastType.set(event.type);calls.set(calls.get()+1);run.update();});
  def.event.on('press.commit',(run)=>{commits.set(commits.get()+1);run.update();});
  return r=>r.el('button',[r.el('span',kind.get()),r.el('span',buttons.get()),r.el('span',hover.get()),r.el('span',commits.get())]);
}});`;
}
