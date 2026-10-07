import { nativeAccessibleStateKeys } from './native-interaction';

export const qtInteractionSource = `// Qt Quick input/focus/AX intent. Physical dispatch is synchronous from Qt events.
import {compareLogicalOrder} from './QtTopology.mjs';
const accessibleStateKeys = new Set(${JSON.stringify(nativeAccessibleStateKeys)});
const ownerInteractions = new Map();
const activeScopes=[];
function ancestorOf(parent, child) {
  const visited=new Set();
  for(let node=child;node;node=node.logicalParent||node.parent) {
    if(visited.has(node))throw new Error('Cyclic logical focus ancestry');
    visited.add(node);if(node===parent)return true;
  }
  return false;
}
export function createInteraction(options) {
  let trigger = false, declared = false, disabled = false, autoFocus = false, nav = 'auto', keyboard = false;
  let pending = false, contentName = false, role, name, description, identity, tree={},level;
  const rootPress={key:null,pointer:false},globalPress={key:null,pointer:false};
  let scopeConfig=null,rovingConfig=null,entryConfig={strategy:'self',fallback:'self',disabled:false},scopeKey,groupKey;
  let previousFocus=null,rovingSelected=false,rovingActive=false,focus=null,pendingRoving=null;
  const relations=new Map();
  const registrations = [], states = new Map(), actions = new Map();
  let sequence = 0;
  function observed(initial) {
    let value = initial;
    const subscribers = new Set(),watchers=new Set();
    const handle = {get() { options.alive(); return value; }, spec: {kind:'bool'}, watch(callback){options.setup();watchers.add(callback);return ()=>{options.alive();watchers.delete(callback);};},subscribe(callback) { options.alive(); subscribers.add(callback); return () => {options.alive();subscribers.delete(callback);}; }, unsubscribe(off) { options.alive(); off(); }};
    function set(next) {
      if (value === next) return;
      const prev=value; value=next;
      options.refreshStyle();
      if (options.active()){const event={type:'next',prev,next,reason:'native-focus'};for (const cb of Array.from(subscribers)) options.invoke(cb,[event],false);for(const cb of Array.from(watchers))options.invoke(cb,[event],true,'state-watch');}
    }
    return {handle,set,clear() {watchers.clear();let failure;for(const callback of Array.from(subscribers))try{callback({type:'disconnect',reason:'unmount'});}catch(error){if(failure===undefined)failure=error;}subscribers.clear();if(failure!==undefined)throw failure;}};
  }
  const focused=observed(false), focusVisible=observed(false), focusable=observed(false);
  const active=observed(false),hasFocused=observed(false);
  const entry={host:options.host,root:()=>options.root(),enabled:()=>declared&&!disabled,selected:()=>rovingSelected,active:()=>rovingActive,scopeKey:()=>scopeKey,groupKey:()=>groupKey,
    focus(request){options.invoke(()=>focus.focusSelf(request),[],false,'focus-navigation');},setFocused(next){hasFocused.set(next);if(rovingConfig)active.set(next);},scope:()=>scopeConfig,roving:()=>rovingConfig,trigger:()=>trigger,send:(name,event)=>nativeEvent(name,event,false,true),refresh,fulfill(){if(pendingRoving&&options.ready()){const request=pendingRoving;options.invoke(()=>focusMember(request.which,request.request,request.config),[],false,'focus-navigation');}}};
  ownerInteractions.set(options.host,entry);
  function read(value) { return value && typeof value.get === 'function' ? value.get() : value; }
  function refresh() {
    const root=options.root();
    if (!root) return;
    const projectedRelations={};
    for(const [key,specs] of relations){let targets=[];for(const spec of specs){const target=read(spec.target),next=Array.isArray(target)?target:typeof target==='string'?target.split(/\\s+/).filter(Boolean):target?[target]:[];targets=spec.mode==='append'?targets.concat(next):next;}projectedRelations[key]={target:targets,mode:'replace'};}
    let participation=nav;
    if(groupKey) {
      const members=Array.from(ownerInteractions.values()).filter((item)=>item.enabled()&&item.root()&&item.groupKey()===groupKey).sort((a,b)=>compareLogicalOrder(a.host,b.host));
      const selected=members.find((item)=>item.root().nativeFocused)||members.find((item)=>item.selected())||members[0];
      if(selected&&selected!==entry)participation='none';
    }
    const facts={focusable:declared&&!disabled,disabled,navParticipation:participation,nameFromContent:contentName,actions:Array.from(actions.keys()),relations:projectedRelations,mergeChildren:read(tree.mergeChildren),hidden:read(tree.hidden)};
    if(options.controlFacts)Object.assign(facts,options.controlFacts());
    if (role !== undefined) facts.role=read(role);
    if(name!==undefined)facts.name=read(name);if(description!==undefined)facts.description=read(description);if(identity!==undefined)facts.id=read(identity);if(level!==undefined)facts.level=read(level);
    for (const [key,state] of states) if(accessibleStateKeys.has(key))facts[key]=read(state);
    if(options.physicalFacts)Object.assign(facts,options.physicalFacts());
    root.facts=facts;
  }
  function register(kind,type,callback,settings) {
    options.setup();
    const entry={kind,type,callback,settings:settings||{},active:true}; registrations.push(entry);
    const token={id:'ev_'+ ++sequence,meta:{kind,type,options:settings},desc(text) { options.setup(); token.meta.label=text; return token; }};
    return token;
  }
  function dispatch(type,native,kind) {
    if (!options.ready()) return false;
    let prevented=false;
    for (const entry of registrations.slice()) {
      if (!entry.active || entry.type !== type || kind && entry.kind !== kind) continue;
      let live=true;
      const payload=Object.freeze({type,key:native.key,ctrlKey:!!(native.modifiers&0x04000000),shiftKey:!!(native.modifiers&0x02000000),altKey:!!(native.modifiers&0x08000000),metaKey:!!(native.modifiers&0x10000000),repeat:!!native.isAutoRepeat,
        control:Object.freeze({requestDefaultActionPrevention() { options.event(); if (!live) throw new Error('Default-action control has expired'); prevented=true;native.accepted=true; }})});
      try { options.invoke(entry.callback,[type.startsWith('host:')?native:payload],true,'event'); }
      finally {live=false;}
      if (entry.settings.once) entry.active=false;
    }
    return prevented;
  }
  function keyName(native) {
    if (typeof native.key === 'string') return native.key;
    const names={16777220:'Enter',16777221:'Enter',32:' ',16777216:'Escape',16777217:'Tab',16777234:'ArrowLeft',16777235:'ArrowUp',16777236:'ArrowRight',16777237:'ArrowDown',16777219:'Backspace',16777223:'Delete'};
    return names[native.key] || native.text || '';
  }
  function members(config) {
    return Array.from(ownerInteractions.values()).filter((item)=>item!==entry&&item.enabled()&&item.root()&&item.root().visible&&
      (config.key ? item.groupKey()===config.key||item.scopeKey()===config.key : ancestorOf(options.host,item.host))).sort((a,b)=>compareLogicalOrder(a.host,b.host));
  }
  function focusMember(which,request,config) {
    options.runtime();config=config||scopeConfig||rovingConfig||{};
    const list=members(config);if(!list.length){if(request&&request.defer){pendingRoving={which,request,config};return;}if(scopeConfig&&scopeConfig.emptyPolicy!=='none'){const root=options.root();if(root)root.requestNativeFocus(request);}return;}
    pendingRoving=null;
    const index=list.findIndex((item)=>item.root().nativeFocused);
    let next=which==='last'?list.length-1:which==='selected'?list.findIndex((item)=>item.selected()):which==='active'?list.findIndex((item)=>item.active()):which==='next'?index+1:which==='prev'?(index<0?list.length-1:index-1):0;
    if(next<0&&(which==='selected'||which==='active'))next=0;
    if(next<0||next>=list.length){if(config.loop)next=(next+list.length)%list.length;else next=Math.max(0,Math.min(list.length-1,next));}
    list[next].focus(request||{reason:'keyboard'});
  }
  function focusNavigation(event) {
    for(let host=options.host;host;host=host.logicalParent||host.parent) {
      const parent=ownerInteractions.get(host),config=parent&&(parent.scope()||parent.roving());
      if(!config)continue;
      const tab=event.key==='Tab',vertical=event.key==='ArrowDown'||event.key==='ArrowUp',horizontal=event.key==='ArrowRight'||event.key==='ArrowLeft';
      if(config.navigation==='none'||tab&&config.navigation==='arrow'||!tab&&config.navigation==='tab'||vertical&&config.orientation==='horizontal'||horizontal&&config.orientation==='vertical')continue;
      if(!tab&&!vertical&&!horizontal)continue;
      const list=Array.from(ownerInteractions.values()).filter((item)=>item!==parent&&item.enabled()&&item.root()&&item.root().visible&&(config.key?item.groupKey()===config.key||item.scopeKey()===config.key:ancestorOf(host,item.host))).sort((a,b)=>compareLogicalOrder(a.host,b.host));
      const index=list.indexOf(entry),direction=event.key==='ArrowUp'||event.key==='ArrowLeft'||tab&&(event.modifiers&0x02000000)?-1:1;
      let next=index+direction;
      if(next<0||next>=list.length){if(!config.loop&&!config.trap)return false;next=(next+list.length)%list.length;}
      if(!list.length)return false;
      options.invoke(()=>list[next].focus({reason:'keyboard'}),[],false,'event');event.accepted=true;return true;
    }
    return false;
  }
  function nativeEvent(name,event,global,routed=false) {
    if (!options.ready()) return;

    if (name === 'keydown' || name === 'keyup') {
      const original=event;
      const input={key:keyName(event),modifiers:event.modifiers||0,isAutoRepeat:event.isAutoRepeat||false};
      Object.defineProperty(input,'accepted',{get() {return original.accepted;},set(value) {original.accepted=value;}});
      event=input;
    }
    const kind=global?'global':'root';
    const press=global?globalPress:rootPress;
    const names={pointerdown:'pointer.down',pointerup:'pointer.up',pointermove:'pointer.move',pointercancel:'pointer.cancel',pointerenter:'pointer.enter',pointerleave:'pointer.leave',keydown:'key.down',keyup:'key.up',contextmenu:'context.menu',input:'input',change:'change',focus:'nav.focus',blur:'nav.blur',textfocus:'text.focus',textblur:'text.blur'};
    let prevented=dispatch('host:'+name,event,kind);
    if (names[name]) prevented=dispatch(names[name],event,kind)||prevented;
    if (name==='pointerdown') {
      keyboard=false;
      if ((global||!disabled) && (event.button===undefined || event.button===1)) {press.pointer=true;prevented=dispatch('press.start',event,kind)||prevented;if(!global&&declared&&!prevented){const root=options.root();if(root)root.requestNativeFocus();}}
    } else if (name==='pointerup' && press.pointer) {press.pointer=false;dispatch('press.end',event,kind);}
    else if ((name==='pointercancel'||name==='pointerleave') && press.pointer) {press.pointer=false;dispatch('press.cancel',event,kind);}
    else if (name==='click' && (global||!disabled) && (event.button===undefined||event.button===1)) dispatch('press.commit',event,kind);
    else if (name==='keydown') {
      keyboard=true;
      if(!global&&focusNavigation(event))return;
      if ((global||!disabled)&&(event.key==='Enter'||event.key===' ')) {
        if (press.key===null) {press.key=event.key;dispatch('press.start',event,kind);}
        dispatch('press.commit',event,kind);
      }
    } else if (name==='keyup' && press.key===event.key) {press.key=null;dispatch('press.end',event,kind);}
    if(!global&&!routed&&trigger)for(let host=options.host.logicalParent||options.host.parent;host;host=host.logicalParent||host.parent) {
      const parent=ownerInteractions.get(host);if(!parent)continue;if(!parent.trigger())break;parent.send(name,event);
    }
  }
  focus={focused:focused.handle,focusVisible:focusVisible.handle,focusable:focusable.handle,
    configure(patch) {options.setup();if(patch.disabled!==undefined)disabled=patch.disabled;if(patch.autoFocus!==undefined)autoFocus=patch.autoFocus;if(patch.navParticipation!==undefined)nav=patch.navParticipation;if(patch.scopeKey!==undefined)scopeKey=patch.scopeKey;if(patch.groupKey!==undefined)groupKey=patch.groupKey;focusable.set(!disabled);refresh();},
    setDisabled(next) {options.runtime();disabled=next;focusable.set(!next);if(next){pending=false;const root=options.root();if(root)root.clearNativeFocus();focused.set(false);focusVisible.set(false);}refresh();},
    focusSelf(request) {options.runtime();if(!declared||disabled)return;const gate=activeScopes.slice().reverse().find((item)=>item.root()&&item.scope()&&item.scope().trap);if(gate&&gate!==entry&&!ancestorOf(gate.host,options.host))return;if(request&&request.reason)keyboard=request.reason==='keyboard';const root=options.root();if(!root){pending=request||{};return;}pending=false;root.requestNativeFocus(request||{});},
    focus(request) {focus.focusSelf(request);},blur() {options.runtime();const root=options.root();if(root)root.clearNativeFocus();},isFocused() {options.alive();return focused.handle.get();},
    setNavParticipation(next) {options.runtime();nav=next;refresh();},setRovingStatus(status) {options.runtime();if(status.selected!==undefined)rovingSelected=status.selected;if(status.active!==undefined)rovingActive=status.active;refresh();}
  };
  const focusEntry={configure(patch) {options.setup();Object.assign(entryConfig,patch);},setDisabled(next) {options.runtime();entryConfig.disabled=next;},focus(request) {options.runtime();if(entryConfig.disabled)return;const root=options.root();if(!root)return;if(entryConfig.strategy==='descendant-first'){const list=members({});if(list.length){list[0].focus(request);return;}if(root.focusDescendant(request||{}))return;}if(entryConfig.fallback!=='none'||entryConfig.strategy==='self')root.requestNativeFocus(request||{});}};
  const roving={active:active.handle,hasFocused:hasFocused.handle,configure(patch) {options.setup();rovingConfig=Object.assign({loop:true,navigation:'arrow',orientation:'both',entry:'first',selectOnFocus:false},rovingConfig||{},patch);},
    focusFirst(request) {focusMember('first',request,rovingConfig);},focusLast(request) {focusMember('last',request,rovingConfig);},focusNext() {focusMember('next',undefined,rovingConfig);},focusPrev() {focusMember('prev',undefined,rovingConfig);},focusSelected(request) {focusMember('selected',request,rovingConfig);},setLoop(next) {options.runtime();rovingConfig.loop=next;},setOrientation(next) {options.runtime();rovingConfig.orientation=next;}};
  const scope={active:active.handle,hasFocused:hasFocused.handle,configure(patch) {options.setup();scopeConfig=Object.assign({trap:false,loop:true,navigation:'tab',orientation:'both',entry:'first',restore:'previous',emptyPolicy:'container'},scopeConfig||{},patch);if(patch.group)roving.configure(typeof patch.group==='object'?patch.group:{});},
    focusFirst() {focusMember('first');},focusLast() {focusMember('last');},focusNext() {focusMember('next');},focusPrev() {focusMember('prev');},focusSelected() {focusMember('selected');},
    activate(request) {options.runtime();const root=options.root();previousFocus=root&&root.nativeWindow?root.nativeWindow.activeFocusItem:null;const index=activeScopes.indexOf(entry);if(index>=0)activeScopes.splice(index,1);activeScopes.push(entry);active.set(true);if(scopeConfig.entry==='container'){if(root)root.requestNativeFocus(request||{});}else if(scopeConfig.entry!=='manual')focusMember(scopeConfig.entry==='selected'?'selected':scopeConfig.entry==='active'?'active':'first',request);},
    deactivate(request) {options.runtime();const index=activeScopes.indexOf(entry);if(index>=0)activeScopes.splice(index,1);active.set(false);if(scopeConfig.restore!=='none'&&previousFocus&&previousFocus.visible)previousFocus.forceActiveFocus();},restoreFocus() {options.runtime();if(previousFocus&&previousFocus.visible)previousFocus.forceActiveFocus();},isActive() {options.alive();return active.handle.get();},getRoving() {options.alive();if(!rovingConfig)rovingConfig={loop:true,navigation:'arrow',orientation:'both',entry:'first'};return roving;}};
  const accessible={state(key,state) {options.setup();states.set(key,state);refresh();},action(key,spec) {options.setup();actions.set(key,spec||{});},role(value) {options.setup();role=value;refresh();},nameFromContent() {options.setup();contentName=true;refresh();},
    id(value) {options.setup();identity=value;},name(value) {options.setup();name=value;contentName=false;},description(value) {options.setup();description=value;},relation(key,spec) {options.setup();const previous=relations.get(key)||[];relations.set(key,spec.mode==='append'?previous.concat([spec]):[spec]);},tree(patch) {options.setup();Object.assign(tree,patch);},level(value) {options.setup();level=value;}};
  return {event:{on:(type,cb,settings)=>register('root',type,cb,settings),onGlobal:(type,cb,settings)=>register('global',type,cb,settings)},
    asTrigger() {options.setup();trigger=true;},asFocusable() {options.setup();declared=true;focusable.set(!disabled);return focus;},asAccessible() {options.setup();return accessible;},asFocusEntry() {options.setup();return focusEntry;},asFocusScope() {options.setup();if(!scopeConfig)scopeConfig={loop:true,navigation:'tab',orientation:'both',entry:'first',restore:'previous',emptyPolicy:'container'};return scope;},asFocusRoving() {options.setup();if(!rovingConfig)rovingConfig={loop:true,navigation:'arrow',orientation:'both',entry:'first'};return roving;},
    refresh,nativeEvent,
    focusChanged(next) {if(!options.ready())return;focused.set(next);focusVisible.set(next&&keyboard);for(const participant of ownerInteractions.values()){if(ancestorOf(participant.host,options.host)){const current=Array.from(ownerInteractions.values()).some((child)=>child.root()&&child.root().nativeFocused&&ancestorOf(participant.host,child.host));participant.setFocused(current);}participant.refresh();}dispatch(next?'nav.focus':'nav.blur',{accepted:false},'root');if(!next&&rootPress.key!==null){rootPress.key=null;dispatch('press.cancel',{accepted:false},'root');}},
    textFocusChanged(next) {if(options.ready())dispatch(next?'text.focus':'text.blur',{accepted:false},'root');},
    action(key) {if(!options.ready())return;const spec=actions.get(key);if(spec&&spec.event)options.invoke(()=>options.emit(spec.event),[],false,'event');else if(key==='press')dispatch('press.commit',{accepted:false},'root');},
    mount() {refresh();const root=options.root();if(declared&&!disabled&&(autoFocus||pending)&&root){const request=pending||{};pending=false;root.requestNativeFocus(request);}for(const participant of ownerInteractions.values())participant.fulfill();},
    unmount() {rootPress.pointer=false;rootPress.key=null;globalPress.pointer=false;globalPress.key=null;focused.set(false);focusVisible.set(false);},
    dispose() {ownerInteractions.delete(options.host);const index=activeScopes.indexOf(entry);if(index>=0)activeScopes.splice(index,1);pendingRoving=null;registrations.length=0;states.clear();actions.clear();relations.clear();let failure;for(const fact of [focused,focusVisible,focusable,active,hasFocused])try{fact.clear();}catch(error){if(failure===undefined)failure=error;}if(failure!==undefined)throw failure;},
    globalTypes() {return registrations.filter((entry)=>entry.kind==='global').map((entry)=>entry.type);},
    isTrigger() {return trigger;}
  };
}
`;
