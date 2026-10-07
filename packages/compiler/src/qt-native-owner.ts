export const qtOwnerSource = `// Ordinary Qt Quick owner resources. No Proto package or serialized semantic program.
import * as Context from './context/QtContextScope.mjs';
import {createStyle} from './QtStyle.mjs';
import {createInteraction} from './QtInteraction.mjs';
import {createControls} from './QtControls.mjs';
import {createTopology} from './QtTopology.mjs';
import {createPresentation} from './QtPresentation.mjs';

export function createOwner(host, options) {
  let alive=true, disposing=false, setup=true, callbackDepth=0, callbackKind='', epoch=0;
  let present=true, view=false, dirty=false, queued=false, ticket=0, hydrated=false, render;
  let raw=Object.freeze({}), resolved=Object.freeze({});
  const specs=Object.create(null), previous=Object.create(null), defaults=[], watchers=[], states=[], stateNames=new Set();
  const exposes=Object.create(null), events=new Set(), work=[];
  const life={created:[],mounted:[],updated:[],unmounted:[],beforeDispose:[]};
  let draining=false, root=null, cached=null;
  let scope=null,style=null,interaction=null,controls=null,topology=null,presentation=null,def=null,owner=null;
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  function ensure() { if(!alive)throw new Error('Qt logical owner is disposed'); }
  function external() {ensure();if(disposing)throw new Error('Qt logical owner is disposing');}
  function ensureSetup() {ensure();if(!setup)throw new Error('Setup capability is closed');}
  function runtime() {ensure();if(setup||!callbackDepth)throw new Error('Write requires a live callback scope');}
  function callbackRun(check) {
    const read={get() {check();return resolved;},getRaw() {check();return raw;},isProvided(key) {check();return own(raw,key);}};
    const anatomy={has(family,role){check();return topology.anatomy.has(family,role);},parts(family,query){check();return topology.anatomy.parts(family,query);},partsOf(family,role,query){check();return topology.anatomy.partsOf(family,role,query);},order:{version(family,query){check();return topology.anatomy.order.version(family,query);},parts(family,query){check();return topology.anatomy.order.parts(family,query);},partsOf(family,role,query){check();return topology.anatomy.order.partsOf(family,role,query);},indexOfSelf(family,role,query){check();return topology.anatomy.order.indexOfSelf(family,role,query);},prevOfSelf(family,role,query){check();return topology.anatomy.order.prevOfSelf(family,role,query);},nextOfSelf(family,role,query){check();return topology.anatomy.order.nextOfSelf(family,role,query);}}};
    return {props:read,host:{get(){check();return view?host:null;}},context:{read(key) {check();return scope.api.read(key);},tryRead(key) {check();return scope.api.tryRead(key);},update(key,next) {check();runtime();scope.api.update(key,next);},tryUpdate(key,next) {check();runtime();return scope.api.tryUpdate(key,next);}},
      update() {check();if(!disposing)schedule(true);},feedback:{style:{patch(){check();return style.patch.apply(undefined,arguments);},suppress(){check();return style.suppress.apply(undefined,arguments);},clearPatch(){check();style.clearPatch();}}},anatomy,positioning:topology.positioning,
      lifecycle:{setPresent(next) {check();runtime();present=next;if(!disposing)schedule(false);}},
      expose:{emit(key,payload,settings) {check();emit(key,payload,settings);}}};
  }
  function invoke(fn,args,withRun=true,kind='callback') {
    ensure();let active=true;const captured=epoch;
    const check=()=>{ensure();if(!active||captured!==epoch)throw new Error('Qt callback handle is stale');};
    const prevKind=callbackKind;callbackKind=kind;++callbackDepth;
    try {return fn.apply(undefined,withRun?[callbackRun(check)].concat(args||[]):args||[]);}
    finally {active=false;--callbackDepth;callbackKind=prevKind;}
  }
  function drain() {
    if(draining)return;draining=true;let failure;
    try {while(work.length&&alive){const task=work.shift();try{task();}catch(error){if(failure===undefined)failure=error;}}}
    finally {draining=false;}
    if(failure!==undefined)throw failure;
  }
  function fire(name) {
    let failure;
    for(const fn of life[name].slice())try{invoke(fn,[],true,name);}catch(error){if(failure===undefined)failure=error;}
    if(failure!==undefined)throw failure;
  }
  scope=Context.createContextScope({getParent:()=>Context.contextParent(host,(node)=>{
    const parent=node.logicalParent || node.parent;
    if(parent&&typeof parent.ensureOwner==='function')parent.ensureOwner();
    return parent;
  }),isAlive:()=>alive,invoke:(fn)=>invoke(fn,[],false,'context-watch'),validate:options.contextCheck});
  Context.registerOwnerScope(host,scope.scope);
  style=createStyle({setup:ensureSetup,runtime,project(properties){if(root)root.projection=Object.assign({},cached&&cached.style?style.properties(cached.style.tokens):{},properties);}},options.styleTable);
  interaction=createInteraction({host,alive:ensure,active:()=>alive&&!setup&&!disposing,setup:ensureSetup,runtime,later:options.later,event(){runtime();if(callbackKind!=='event')throw new Error('Default action requires current native event callback');},
    ready:()=>alive&&!setup&&!disposing&&view&&!!root,root:()=>view?root:null,invoke,controlFacts:()=>controls.facts(),physicalFacts:()=>presentation.facts(),refreshStyle:()=>{options.changed();style.refresh();},emit});
  controls=createControls({declarations:options.declarations,alive:ensure,active:()=>alive&&!setup&&!disposing,setup:ensureSetup,runtime,ready:()=>alive&&!setup&&!disposing&&view&&!!root,root:()=>view?root:null,invoke,changed:()=>{options.changed();style.refresh();},refreshFacts:()=>interaction.refresh(),
    bindScrollChrome(binding){if(!binding||!binding.anatomy)throw new Error('Composed scroll chrome requires an Anatomy family');topology.bindScrollChrome(binding);}});
  topology=createTopology({host,alive:ensure,isAlive:()=>alive&&!disposing,active:()=>alive&&!setup&&!disposing,setup:ensureSetup,runtime,ready:()=>alive&&!setup&&!disposing&&view&&!!root,root:()=>view?root:null,invoke,changed:()=>{options.changed();style.refresh();},exposes:()=>exposes,ownedState:moduleState,later:options.later,
    expose(key,value){expose(key,typeof value==='function'?function(){external();return invoke(value,Array.from(arguments),false,'expose-method');}:value.external||value);},
    setPresent(next){runtime();present=next;if(!disposing)schedule(false);}});
  presentation=createPresentation({host,alive:ensure,active:()=>alive&&!setup&&!disposing,setup:ensureSetup,runtime,ready:()=>alive&&!setup&&!disposing&&view&&!!root,root:()=>view?root:null,invoke,changed:()=>{options.changed();style.refresh();},getProps:()=>resolved,isProvided:(key)=>own(raw,key),emit,ownedState:moduleState,refreshFacts:()=>interaction.refresh(),
    claimEntries:()=>topology.claimEntries(),tableFamilies:options.tableFamilies,
    expose(key,value){expose(key,publicValue(value));},
    setPresent(next){runtime();present=next;if(!disposing)schedule(false);},
    declareTransition(){
      def.props.define({open:{type:'boolean',empty:'fallback'},defaultOpen:{type:'boolean',empty:'fallback'},appear:{type:'boolean',empty:'fallback'},enterDuration:{type:'number',empty:'fallback'},leaveDuration:{type:'number',empty:'fallback'},interrupt:{type:'enum',empty:'fallback',options:['reverse','wait','immediate']}});
      def.props.setDefaults({defaultOpen:false,appear:false,enterDuration:300,leaveDuration:200,interrupt:'reverse'});
      def.props.watch(['open','interrupt','enterDuration','leaveDuration'],()=>presentation.propsApplied());
      def.expose.event('beforeEnter');def.expose.event('afterEnter');def.expose.event('beforeLeave');def.expose.event('afterLeave');
    }});
  Object.assign(interaction,controls.hooks);
  Object.assign(interaction,topology.hooks,presentation.hooks);
  for(const name of Object.keys(interaction))if(name.startsWith('as')){const acquire=interaction[name];interaction[name]=function(){topology.recordHook(name);return acquire.apply(undefined,arguments);};}
  function emit(key,payload,settings) {
    runtime();if(!events.has(key))throw new Error('Undeclared outward event: '+key);
    const check=options.eventChecks[key];if(check&&!check(payload))throw new TypeError('Invalid Expose event payload: '+key);
    options.emit(key,payload,settings);
  }
  function valid(spec,value,key) {
    const check=options.propChecks[key];
    return !!check&&check(value)&&(!spec.options||spec.options.indexOf(value)>=0)&&(!spec.range||typeof value==='number'&&(spec.range.min===undefined||value>=spec.range.min)&&(spec.range.max===undefined||value<=spec.range.max));
  }
  function resolve(strict) {
    const next=Object.create(null);
    for(const key of Object.keys(specs)) {
      const spec=specs[key],provided=own(raw,key),value=raw[key],requireValue=strict&&spec.empty==='error';
      if(provided&&value!=null&&valid(spec,value,key)){next[key]=value;previous[key]=value;continue;}
      if(provided&&value==null&&spec.empty==='accept'){next[key]=null;continue;}
      let candidate;
      if(provided&&own(previous,key)&&valid(spec,previous[key],key))candidate=previous[key];
      if(candidate===undefined)for(const layer of defaults){if(!own(layer,key))continue;const v=layer[key];if(v===null&&!requireValue||v!=null&&valid(spec,v,key)){candidate=v;break;}}
      if(candidate===undefined&&own(spec,'default')){const v=spec.default;if(v===null&&!requireValue||v!=null&&valid(spec,v,key))candidate=v;}
      if(candidate===undefined){if(requireValue)throw new Error('Prop has no valid fallback: '+key);candidate=null;}
      next[key]=candidate;if(provided&&candidate!=null)previous[key]=candidate;
    }
    return Object.freeze(next);
  }
  function hydrate(input) {
    external();const prevRaw=raw,prev=resolved;
    raw=Object.freeze(Object.assign({},input));resolved=resolve(true);style.refresh();interaction.refresh();
    if(!hydrated){hydrated=true;return;}
    const nextRaw=raw,next=resolved;
    const rawChanged=Array.from(new Set(Object.keys(prevRaw).concat(Object.keys(nextRaw)))).filter((key)=>own(prevRaw,key)!==own(nextRaw,key)||!Object.is(prevRaw[key],nextRaw[key]));
    const changed=Object.keys(specs).filter((key)=>!Object.is(prev[key],next[key]));
    const ordered=watchers.filter((w)=>w.raw&&w.keys===null).concat(watchers.filter((w)=>w.raw&&w.keys!==null),watchers.filter((w)=>!w.raw));
    for(const w of ordered) {
      const all=w.raw?rawChanged:changed,matched=w.keys===null?all:all.filter((key)=>w.keys.indexOf(key)>=0);
      if(!w.active||!matched.length)continue;
      work.push(()=>{if(w.active)invoke(w.fn,[w.raw?nextRaw:next,w.raw?prevRaw:prev,{changedKeysAll:all,changedKeysMatched:matched}],true,'props-watch');});
    }
    drain();
  }
  function watch(keys,fn,isRaw) {
    ensureSetup();const entry={keys:keys===null?null:keys.slice(),fn,raw:isRaw,active:true};watchers.push(entry);
    return ()=>{ensureSetup();entry.active=false;};
  }
  function moduleState(kind,name,initial) {
    const handle=state(kind,name,initial);
    return {handle,set(next){if(Object.is(handle.get(),next))return;if(setup)handle.setDefault(next);else invoke(()=>handle.set(next,'module-projection'),[],false,'module-projection');}};
  }
  function state(kind,name,initial,settings) {
    ensureSetup();settings=settings||{};
    if(typeof name!=='string'||!name.length||stateNames.has(name))throw new Error('State name must be nonempty and unique');
    stateNames.add(name);
    function normalize(value) {return kind==='number.range'&&settings.clamp?Math.max(settings.min,Math.min(settings.max,value)):value;}
    function validate(value) {
      const type=kind==='bool'?'boolean':kind==='string'||kind==='enum'?'string':'number';
      if(typeof value!==type||type==='number'&&!Number.isFinite(value))throw new TypeError('Invalid owned State value');
      if(settings.options&&settings.options.length&&settings.options.indexOf(value)<0)throw new RangeError('State value outside options');
      if(type==='number'&&(!settings.options||!settings.options.length)) {
        if(settings.min!==undefined&&value<settings.min||settings.max!==undefined&&value>settings.max)throw new RangeError('State value outside range');
        if(settings.step&&kind==='number.discrete'&&!Number.isInteger((value-(settings.min||0))/settings.step))throw new RangeError('State value violates step');
      }
    }
    let value=normalize(initial);validate(value);const subscribers=new Set();
    const publicHandle=Object.freeze({get() {external();return value;},spec:Object.freeze(Object.assign({kind},settings)),subscribe(fn) {external();subscribers.add(fn);return ()=>{external();subscribers.delete(fn);};},unsubscribe(off) {external();off();}});
    const handle={external:publicHandle,get() {ensure();return value;},setDefault(next){ensureSetup();next=normalize(next);validate(next);value=next;},set(next,reason) {
      runtime();next=normalize(next);validate(next);if(Object.is(value,next))return;
      const prev=value;value=next;options.changed();style.refresh();interaction.refresh();
      work.push(()=>{for(const fn of Array.from(subscribers))if(subscribers.has(fn)&&!disposing)invoke(fn,[{type:'next',prev,next,reason}],false,'state-watch');});drain();
    }};
    states.push({handle,disconnect(){let failure;for(const callback of Array.from(subscribers))try{callback({type:'disconnect',reason:'unmount'});}catch(error){if(failure===undefined)failure=error;}subscribers.clear();if(failure!==undefined)throw failure;},clear:()=>subscribers.clear()});return handle;
  }
  function element(tag,a,b) {
    if(typeof tag!=='string'||!tag.length)throw new TypeError('Template requires a native tag');
    const props=arguments.length>2?a:a&&typeof a==='object'&&!Array.isArray(a)&&!a.qtTemplate?a:null;
    const children=arguments.length>2?b:props?null:a===undefined?null:a;
    return {qtTemplate:true,tag,style:props&&props.style,children};
  }
  function flatten(children,result) {
    if(children===null||children===undefined)return;
    if(Array.isArray(children)){for(const child of children)flatten(child,result);return;}
    if(typeof children==='string'||typeof children==='number'){result.push({qtTemplate:true,tag:'Text',text:String(children),children:null});return;}
    if(children&&children.qtTemplate){result.push(children);return;}
    throw new TypeError('Invalid native template child');
  }
  function destroyNode(node) {
    if(!node)return;
    if(node===options.slot){node.parent=host;return;}
    for(const child of node.authoredChildren||[])destroyNode(child);
    node.authoredChildren=[];node.destroy();
  }
  function applyNode(node,descriptor,isRoot) {
    const adapterDeclaration=isRoot&&(options.declarations||[]).find((entry)=>entry.id==='@proto.ui/adapter-modules/declaration');
    node.owner=owner;node.rootNode=isRoot;node.tag=adapterDeclaration&&adapterDeclaration.config.rootTag||descriptor.tag;node.contentText=descriptor.text||'';
    node.projection=descriptor.style?style.properties(descriptor.style.tokens):{};
    const previousChildren=node.authoredChildren||[],next=[],flat=[];
    flatten(descriptor.children,flat);
    for(let i=0;i<flat.length;++i) {
      const desc=flat[i];let child=previousChildren[i];
      if(desc.slot) {
        if(child&&child!==options.slot)destroyNode(child);
        child=options.slot;child.parent=node;
      } else {
        if(child===options.slot){child.parent=host;child=null;}
        if(!child)child=options.createNode(node.childParent);
        else child.parent=node.childParent;
        applyNode(child,desc,false);
      }
      next.push(child);
    }
    for(let i=flat.length;i<previousChildren.length;++i)destroyNode(previousChildren[i]);
    node.authoredChildren=next;node.layoutChildren();
  }
  function renderTemplate() {
    let active=true,slotUsed=false;
    const read={get() {if(!active)throw new Error('Render frame expired');return resolved;},getRaw() {if(!active)throw new Error('Render frame expired');return raw;},isProvided(key) {if(!active)throw new Error('Render frame expired');return own(raw,key);}};
    const frame={el() {if(!active)throw new Error('Render frame expired');return element.apply(undefined,arguments);},slot() {if(!active)throw new Error('Render frame expired');if(slotUsed)throw new Error('Only one anonymous slot is allowed');slotUsed=true;return {qtTemplate:true,slot:true,tag:'slot',children:null};},props:read,read:{props:read,context:{read(key) {if(!active)throw new Error('Render frame expired');return scope.api.read(key);},tryRead(key) {if(!active)throw new Error('Render frame expired');return scope.api.tryRead(key);}}}};
    let output;
    try {output=typeof render==='function'?render(frame):null;}finally{active=false;}
    const roots=[];flatten(output,roots);
    if(roots.length>1)throw new Error('Native Template requires a single Root');
    cached=roots[0]||{qtTemplate:true,tag:'Item',children:null};
    if(cached.slot)throw new Error('Anonymous slot cannot replace the single Root');
    if(!root)root=options.createNode(options.content);
    applyNode(root,cached,true);options.rootChanged(root);
  }
  function detach() {
    if(!view)return;view=false;++epoch;options.epochChanged(epoch,false);
    let failure;
    try{for(const suspend of [()=>interaction.unmount(),()=>controls.unmount(),()=>presentation.unmount(),()=>topology.unmount(),()=>style.unmount(),()=>fire('unmounted')])try{suspend();}catch(error){if(failure===undefined)failure=error;}}
    finally{destroyNode(root);root=null;options.rootChanged(null);}
    if(failure!==undefined)throw failure;
  }
  function reconcile() {
    if(!alive||disposing)return;
    if(!options.connected()){detach();return;}
    if(!present){detach();return;}
    const update=dirty;dirty=false;
    if(!view){++epoch;renderTemplate();view=true;options.epochChanged(epoch,true);style.mount();controls.mount();topology.mount();presentation.mounted();interaction.mount();fire('mounted');}
    else if(update){renderTemplate();style.refresh();controls.mount();topology.refresh();presentation.refresh();interaction.refresh();fire('updated');}
  }
  function schedule(update) {
    ensure();dirty=dirty||update;if(queued||disposing)return;queued=true;const current=++ticket;
    options.later(()=>{if(current!==ticket)return;queued=false;if(alive&&!disposing)reconcile();});
  }
  function expose(key,value) {ensureSetup();if(own(exposes,key)||events.has(key))throw new Error('Duplicate Expose: '+key);exposes[key]=value;}
  function publicValue(value) {
    if(typeof value==='function')return function(){external();return invoke(value,Array.from(arguments),false,'expose-method');};
    if(!value||typeof value!=='object')return value;
    if(!Object.keys(value).some((key)=>typeof value[key]==='function'))return value;
    const result={};for(const key of Object.keys(value))result[key]=publicValue(value[key]);return Object.freeze(result);
  }
  def={props:{
    define(input) {
      ensureSetup();const merged=Object.assign(Object.create(null),specs);
      for(const key of Object.keys(input)) {
        const next=input[key],prev=specs[key];if(!options.propChecks[key])throw new Error('Undeclared Prop: '+key);
        if(next.empty!==undefined&&['accept','fallback','error'].indexOf(next.empty)<0)throw new Error('Invalid empty policy');
        if(prev&&JSON.stringify(prev.type)!==JSON.stringify(next.type))throw new Error('Conflicting prop type: '+key);
        if(prev&&prev.range&&next.range&&(next.range.min!==undefined&&next.range.min>(prev.range.min===undefined?-Infinity:prev.range.min)||next.range.max!==undefined&&next.range.max<(prev.range.max===undefined?Infinity:prev.range.max)))throw new Error('Conflicting narrowed Prop range: '+key);
        const rank={accept:0,fallback:1,error:2};if(prev&&next.empty!==undefined&&rank[next.empty]>rank[prev.empty||'fallback'])throw new Error('Conflicting empty policy');
        merged[key]=Object.assign({},prev||{},next,{empty:prev?prev.empty:next.empty||'fallback',range:next.range||prev&&prev.range});
        if(prev&&own(prev,'default'))merged[key].default=prev.default;
      }
      Object.assign(specs,merged);resolved=resolve(false);
    },setDefaults(input) {ensureSetup();for(const key of Object.keys(input))if(!own(specs,key))throw new Error('Undeclared default: '+key);defaults.unshift(Object.assign({},input));resolved=resolve(false);},
    watch:(keys,fn)=>watch(keys,fn,false),watchAll:(fn)=>watch(null,fn,false),watchRaw:(keys,fn)=>watch(keys,fn,true),watchRawAll:(fn)=>watch(null,fn,true)},
    state:{bool:(name,value)=>state('bool',name,value),enum:(name,value,spec)=>state('enum',name,value,spec),string:(name,value,spec)=>state('string',name,value,spec),numberDiscrete:(name,value,spec)=>state('number.discrete',name,value,spec),numberRange:(name,value,spec)=>state('number.range',name,value,spec)},
    expose:{value(key,value){expose(key,publicValue(value));},state(key,handle) {expose(key,handle.external||handle);},event(key) {ensureSetup();if(own(exposes,key)||events.has(key))throw new Error('Duplicate Expose');events.add(key);},method(key,fn) {expose(key,function(){external();const args=Array.from(arguments),checks=options.methodChecks[key];if(checks&&!checks.args(args))throw new TypeError('Invalid public method arguments: '+key);const result=invoke(fn,args,false,'expose-method');if(checks&&!checks.result(result))throw new TypeError('Invalid public method return: '+key);return result;});}},
    lifecycle:{onCreated(fn) {ensureSetup();life.created.push(fn);},onMounted(fn) {ensureSetup();life.mounted.push(fn);},onUpdated(fn) {ensureSetup();life.updated.push(fn);},onUnmounted(fn) {ensureSetup();life.unmounted.push(fn);},onBeforeDispose(fn) {ensureSetup();life.beforeDispose.push(fn);}},
    context:{provide(key,value) {ensureSetup();scope.api.provide(key,value);},subscribe(key,fn) {ensureSetup();return scope.api.subscribe(key,'required',fn?(next,prev)=>invoke(fn,[next,prev],true,'context-watch'):undefined);},trySubscribe(key,fn) {ensureSetup();return scope.api.subscribe(key,'optional',fn?(next,prev)=>invoke(fn,[next,prev],true,'context-watch'):undefined);}},
    feedback:{style},event:interaction.event,anatomy:topology.anatomy,positioning:topology.positioning};
  owner={def,style,interaction,exposes,scope,identity:{},
    getNativeRoot(){ensure();return root;},getHost(){ensure();return host;},parentNativeRoot(){ensure();const seen=new Set();for(let node=host.logicalParent||host.parent;node;node=node.logicalParent||node.parent){if(seen.has(node))throw new Error('Cyclic native AX ancestry');seen.add(node);if(node.nativeRoot)return node.nativeRoot;if(node.owner&&node.owner!==owner&&node.owner.getNativeRoot)return node.owner.getNativeRoot();}return null;},
    setRender(fn) {ensureSetup();render=fn;},getProps() {ensure();return resolved;},hydrate,created() {ensureSetup();Object.freeze(exposes);setup=false;presentation.created();topology.created();fire('created');},update() {external();schedule(true);},reconcile,
    getExposes() {external();return exposes;},nativeEvent:(name,event)=>interaction.nativeEvent(name,event,false),globalNativeEvent(name,event){interaction.nativeEvent(name,event,true);topology.nativeEvent(name,event);},
    focusChanged:(next)=>interaction.focusChanged(next),textFocusChanged:(next)=>interaction.textFocusChanged(next),accessibleAction:(key)=>interaction.action(key),
    textEdited(text,preedit) {controls.textEvent('input',text,preedit);interaction.nativeEvent('input',{accepted:false,text,preedit},false);},textCommitted(text) {controls.textEvent('change',text,null);interaction.nativeEvent('change',{accepted:false,text},false);},compositionChanged(preedit,text) {controls.composition(preedit,text);},
    imageStatus(status,generation) {controls.imageStatus(status,generation);},scrollFacts(snapshot) {controls.scrollFacts(snapshot);},transitionComplete(ticket){presentation.transitionComplete(ticket);},geometryChanged(){if(view)topology.geometryChanged();},topologyChanged(){scope.api.rebind();if(view){topology.refresh();presentation.refresh();}schedule(false);},
    dispose() {
      if(!alive||disposing)return;disposing=true;++ticket;queued=false;let failure;
      try{detach();}catch(error){failure=error;}
      try{fire('beforeDispose');}catch(error){if(failure===undefined)failure=error;}
      finally{
        ++epoch;
        const cleanup=[()=>Context.unregisterOwnerScope(host),()=>scope.api.dispose(),()=>interaction.dispose(),()=>controls.dispose(),()=>topology.dispose(),()=>presentation.dispose(),()=>style.dispose()];
        for(const close of cleanup)try{close();}catch(error){if(failure===undefined)failure=error;}
        alive=false;for(const state of states)try{state.disconnect();}catch(error){if(failure===undefined)failure=error;}
        watchers.length=0;work.length=0;for(const key of Object.keys(life))life[key].length=0;options.epochChanged(epoch,false);
      }
      if(failure!==undefined)throw failure;
    }
  };
  return owner;
}
`;
