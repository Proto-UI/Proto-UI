export const qtTopologySource = `// Current logical Anatomy/Collection and physical boundary/overlay resources.
const participants=new Map();
const regionStack=[];
const overlayStack=[];
const sampleOwners=new WeakMap();
function ancestry(host) {
  const result=[],seen=new Set();
  for(let node=host;node;node=node.logicalParent||node.parent){if(seen.has(node))throw new Error('Cyclic logical ownership');seen.add(node);result.push(node);}
  return result;
}
function targetNode(target) {if(target&&target.nativeRoot!==undefined)return target.nativeRoot;if(target&&target.qtPart){target.qtPart.alive();return target.qtPart.root();}return target;}
function descendant(host,parent) {return ancestry(host).indexOf(parent)>=0;}
export function compareLogicalOrder(a,b) {
  if(a===b)return 0;
  const left=ancestry(a).reverse(),right=ancestry(b).reverse();let i=0;
  while(i<left.length&&i<right.length&&left[i]===right[i])++i;
  if(i===left.length)return -1;if(i===right.length)return 1;if(!i)return 0;
  const children=left[i-1].children||[];
  let leftIndex=-1,rightIndex=-1;
  for(let index=0;index<children.length;++index){if(children[index]===left[i])leftIndex=index;if(children[index]===right[i])rightIndex=index;}
  return leftIndex>=0&&rightIndex>=0?leftIndex-rightIndex:0;
}
function publish() {
  for(const participant of participants.values())if(participant.ready())participant.notify();
}
export function createTopology(options) {
  const claims=new Map(),subscriptions=[],hookNames=new Set(),regionEntries=[],outsideListeners=[],hitEntries=[],orders=new Map(),partViews=new Map();
  let collectionConfig=null,itemConfig=null,itemSnapshot={index:-1,total:0,first:false,last:false};
  let boundaryActive=false,boundaryObserving=false,hitMode='participating',overlayDeclared=false,overlayOpen=false,keepMounted=false,presenceBinding=null;
  let overlayConfig={placement:'bottom',align:'start',sideOffset:0,alignOffset:0,strategy:'absolute',avoidCollisions:true,collisionBoundary:'viewport',collisionPadding:0,defaultOpen:false,closeOnEscape:true,closeOnOutsidePress:true,closeOnFocusOutside:false,closeOnAnchorPress:false,closeOnTriggerPress:false,excludeAnchorTranslation:false,anchored:true,entry:'first',restore:'previous',portal:false,modal:false,layerRole:'overlay',layerOffset:0};
  let trigger=null,anchor=null,content=null,previousFocus=null,positionConnection=null,positionSnapshot=null,offPresence=null;
  const overlayRegions={trigger:null,anchor:null,content:null},positionSignals=[];
  let portalRoot=null,portalParent=null,portalZ=0,overlayFocused=false,overlayViewActive=false;
  const governed=[];
  function observed(initial) {
    let value=initial;const subscribers=new Set(),watchers=new Set();
    const handle={get() {options.alive();return value;},watch(cb){options.setup();watchers.add(cb);return ()=>{options.alive();watchers.delete(cb);};},subscribe(cb) {options.alive();subscribers.add(cb);return ()=>{options.alive();subscribers.delete(cb);};},unsubscribe(off) {options.alive();off();},spec:{kind:typeof initial==='boolean'?'bool':typeof initial==='number'?'number.discrete':'string'}};
    const record={handle,set(next){if(Object.is(next,value))return;const prev=value;value=next;options.changed();const event={type:'next',prev,next,reason:'topology'};if(options.active()){for(const cb of Array.from(subscribers))options.invoke(cb,[event],false,'topology');for(const cb of Array.from(watchers))options.invoke(cb,[event],true,'state-watch');}},clear() {watchers.clear();let failure;for(const cb of Array.from(subscribers))try{cb({type:'disconnect',reason:'unmount'});}catch(error){if(failure===undefined)failure=error;}subscribers.clear();if(failure!==undefined)throw failure;}};
    governed.push(record);return record;
  }
  let count=null,index=null,total=null,first=null,last=null;
  const open=observed(false);
  const record={host:options.host,claims,exposes:options.exposes,hooks:hookNames,alive:options.alive,ready:options.ready,root:options.root,invoke:options.invoke,notify,collectionConfig:()=>collectionConfig,itemConfig:()=>itemConfig,updateItem(snapshot) {itemSnapshot=snapshot;index.set(snapshot.index);total.set(snapshot.total);first.set(snapshot.first);last.set(snapshot.last);}};
  participants.set(options.host,record);
  function scopeRoot(family,host=options.host) {
    for(const ancestor of ancestry(host)){const item=participants.get(ancestor);if(item&&item.claims.get(family)==='root')return item;}
    return null;
  }
  function part(item,role) {
    let roles=partViews.get(item);if(!roles){roles=new Map();partViews.set(item,roles);}
    if(!roles.has(role))roles.set(role,Object.freeze({role,qtPart:item,
      hasExpose(key) {options.alive();item.alive();return Object.prototype.hasOwnProperty.call(item.exposes(),key);},getExpose(key) {options.alive();item.alive();const values=item.exposes();return Object.prototype.hasOwnProperty.call(values,key)?values[key]:null;},hasHook(name) {options.alive();item.alive();return item.hooks.has(name);}}));
    return roles.get(role);
  }
  function parts(family,role,query) {
    options.alive();const root=scopeRoot(family);
    if(!root){if(query&&query.missing==='null')return null;if(query&&query.missing==='empty')return [];throw new Error('Anatomy family has no current logical root');}
    return Array.from(participants.values()).filter((item)=>item.ready()&&item.claims.has(family)&&scopeRoot(family,item.host)===root&&(!role||item.claims.get(family)===role)).sort((a,b)=>compareLogicalOrder(a.host,b.host)).map((item)=>part(item,item.claims.get(family)));
  }
  function order(family,query) {
    const values=parts(family,undefined,query);if(values===null)return null;
    const root=scopeRoot(family),current=orders.get(family);
    if(!current){orders.set(family,{root,values,version:0});return 0;}
    if(current.root!==root||current.values.length!==values.length||current.values.some((value,i)=>value!==values[i])){current.root=root;current.values=values;++current.version;}
    return current.version;
  }
  function claim(family,decl) {
    options.setup();if(!family||!decl||!decl.role)throw new Error('Invalid Anatomy claim');
    if(claims.has(family)&&claims.get(family)!==decl.role)throw new Error('Conflicting Anatomy claim');
    if(family.roles&&!family.roles[decl.role])throw new Error('Unknown Anatomy role');
    claims.set(family,decl.role);
  }
  function notify() {
    for(const subscription of subscriptions.slice()) {
      if(!subscription.active)continue;
      const next=parts(subscription.family,subscription.role,{missing:'empty'}),identities=next.map((p)=>p.qtPart);
      if(subscription.last&&subscription.last.length===identities.length&&identities.every((value,i)=>value===subscription.last[i]))continue;
      subscription.last=identities;options.invoke(subscription.callback,[next],true,'anatomy-watch');
    }
    if(collectionConfig) {
      const items=parts(collectionConfig.family,collectionConfig.itemRole||'item',{missing:'empty'});count.set(items.length);
      items.forEach((view,i)=>{
        const participant=view.qtPart,config=participant.itemConfig();if(!config)return;
        const meta=config.getMeta?participant.invoke(config.getMeta,[],true,'collection-meta'):{};
        participant.updateItem(Object.freeze(Object.assign({},meta,{index:i,total:items.length,first:i===0,last:i===items.length-1})));
      });
    }
    if(positionConnection)position();
  }
  const anatomy={claim,subscribeParts(family,role,callback) {options.setup();const subscription={family,role,callback,active:true,last:parts(family,role,{missing:'empty'}).map((p)=>p.qtPart)};subscriptions.push(subscription);return ()=>{options.setup();subscription.active=false;};},
    has:(family,role)=>parts(family,role).length>0,parts:(family,query)=>parts(family,undefined,query),partsOf:parts,order:{version:order,parts:(family,query)=>parts(family,undefined,query),partsOf:parts,indexOfSelf(family,role,query) {const values=parts(family,role,query);return values===null?null:values.findIndex((p)=>p.qtPart===record);},prevOfSelf(family,role,query) {const values=parts(family,role,query);if(values===null)return null;const i=values.findIndex((p)=>p.qtPart===record);return i>0?values[i-1]:null;},nextOfSelf(family,role,query) {const values=parts(family,role,query);if(values===null)return null;const i=values.findIndex((p)=>p.qtPart===record);return i>=0&&i<values.length-1?values[i+1]:null;}}};
  const collection={get count(){options.alive();return count.handle;},configure(patch) {
    options.setup();collectionConfig=Object.assign({},collectionConfig||{},patch);if(!collectionConfig.family)throw new Error('Collection requires an Anatomy family');
    const ownerRole=patch.ownerRole===undefined?patch.rootRole:patch.ownerRole;if(ownerRole)claim(patch.family,{role:ownerRole});
    options.expose(patch.exposeCountStateKey||'count',count.handle);options.expose(patch.exposeItemsMethodKey||'getCollectionItems',()=>collection.getItems());options.expose(patch.exposeCountMethodKey||'getCollectionCount',()=>collection.getCount());
  },getItems() {options.alive();if(!collectionConfig)throw new Error('Collection not configured');const key=collectionConfig.itemMetaExposeKey||'__collectionItem';return parts(collectionConfig.family,collectionConfig.itemRole||'item').map((p)=>{const metadata=p.getExpose(key);if(typeof metadata!=='function')throw new Error('Collection item metadata method missing');return metadata();});},getCount() {options.alive();return collection.getItems().length;}};
  const collectionItem={get collectionIndex(){options.alive();return index.handle;},get collectionTotal(){options.alive();return total.handle;},get collectionFirst(){options.alive();return first.handle;},get collectionLast(){options.alive();return last.handle;},configure(patch) {
    options.setup();itemConfig=Object.assign({},itemConfig||{},patch);claim(patch.family,{role:patch.role||'item'});
    options.expose(patch.exposeIndexStateKey||'collectionIndex',index.handle);options.expose(patch.exposeTotalStateKey||'collectionTotal',total.handle);options.expose(patch.exposeFirstStateKey||'collectionFirst',first.handle);options.expose(patch.exposeLastStateKey||'collectionLast',last.handle);
    options.expose(patch.exposeSnapshotMethodKey||'getCollectionItem',()=>collectionItem.getSnapshot());options.expose(patch.metaExposeKey||'__collectionItem',()=>collectionItem.getSnapshot());
  },getSnapshot() {options.alive();const meta=itemConfig&&itemConfig.getMeta&&options.ready()?options.invoke(itemConfig.getMeta,[],true,'collection-meta'):itemSnapshot;return Object.freeze(Object.assign({},meta,{index:itemSnapshot.index,total:itemSnapshot.total,first:itemSnapshot.first,last:itemSnapshot.last}));}};
  function region(target,settings) {const entry={target,settings:settings||{},active:true};regionEntries.push(entry);return ()=>{options.alive();entry.active=false;};}
  function inside(node,target,native) {
    if(!node)return false;
    if(target&&descendant(target,node))return true;
    if(native&&native.x!==undefined&&native.y!==undefined&&node.nativeWindow){const point=node.mapFromItem(node.nativeWindow.contentItem,native.x,native.y);return point.x>=0&&point.x<=node.width&&point.y>=0&&point.y<=node.height;}
    return false;
  }
  function classify(sample) {
    options.alive();if(!sample)return 'unknown';
    const target=targetNode(sample.target),native=sample.nativeEvent||sample;
    if(inside(options.root(),target,native))return 'inside';
    for(const entry of regionEntries)if(entry.active&&(entry.target===sample.target||inside(targetNode(entry.target),target,native)))return 'inside';
    return target||native.x!==undefined?'outside':'unknown';
  }
  const boundary={configure(patch) {options.setup();if(patch.debugLabel)record.boundaryLabel=patch.debugLabel;},observe(observation) {options.setup();if(observation!=='pointer.press')throw new Error('Unknown boundary observation');boundaryObserving=true;},setStackActive(next) {options.alive();boundaryActive=next;const index=regionStack.indexOf(record);if(index>=0)regionStack.splice(index,1);if(next)regionStack.push(record);},registerRegion(target,settings) {options.alive();return region(target,settings);},unregisterRegion(target) {options.alive();for(const entry of regionEntries)if(entry.target===target)entry.active=false;},classify,notify(sample) {options.alive();if(!options.ready())return 'unknown';const classification=classify(sample),native=sample&&sample.nativeEvent;let top=regionStack.slice().reverse().find((item)=>item.ready());if(native&&typeof native==='object'){let owners=sampleOwners.get(native);if(!owners){owners={boundary:top,overlay:overlayStack.slice().reverse().find((item)=>item.ready())};sampleOwners.set(native,owners);}top=owners.boundary;}if(classification==='outside'&&boundaryActive&&top&&top!==record)return 'unknown';if(classification==='outside')for(const entry of outsideListeners.slice())if(entry.active)options.invoke(entry.cb,[{classification,sample}],false,'boundary-outside');return classification;},subscribeOutside(cb) {options.alive();const entry={cb,active:true};outsideListeners.push(entry);return ()=>{options.alive();entry.active=false;};}};
  const hit={configure(patch) {options.setup();if(patch.mode!==undefined)hitMode=patch.mode;},registerRegion(target,settings) {options.alive();const entry={target,settings:settings||{},active:true,node:null,previous:null};hitEntries.push(entry);hitProjection();return ()=>{options.alive();entry.active=false;hitProjection();};},unregisterRegion(target) {options.alive();for(const entry of hitEntries)if(entry.target===target)entry.active=false;hitProjection();}};
  function hitProjection() {
    const root=options.root();if(root)root.hitMode=hitMode;
    for(const entry of hitEntries){const target=entry.active?targetNode(entry.target):null;if(entry.node&&entry.node!==target){entry.node.hitMode=entry.previous;entry.node=null;}if(target&&target.hitMode!==undefined){if(!entry.node){entry.node=target;entry.previous=target.hitMode;}target.hitMode=entry.settings.mode||hitMode;}else if(target)throw new Error('Hit region must resolve to a native control Root');}
  }
  function position() {
    if(!positionConnection)return;
    const config=positionConnection.config||{},a=targetNode(positionConnection.anchor),floating=targetNode(positionConnection.floating);
    if(!a||!floating||!a.nativeWindow||!floating.parent)return;
    const point=a.mapToItem(floating.parent,0,0),offset=config.sideOffset||0,alignOffset=config.alignOffset||0;
    let side=config.side||config.placement||'bottom',align=config.align||'start',x=point.x,y=point.y;
    function aligned(start,size,own){return start+(align==='center'?(size-own)/2:align==='end'?size-own:0)+alignOffset;}
    if(side==='top'||side==='bottom'){x=aligned(point.x,a.width,floating.width);y=side==='top'?point.y-floating.height-offset:point.y+a.height+offset;}
    else{y=aligned(point.y,a.height,floating.height);x=side==='left'?point.x-floating.width-offset:point.x+a.width+offset;}
    if(config.avoidCollisions!==false) {
      const viewport=a.nativeWindow.contentItem,padding=config.collisionPadding||0,origin=viewport.mapToItem(floating.parent,0,0);
      let left=origin.x+padding,top=origin.y+padding,right=origin.x+viewport.width-padding,bottom=origin.y+viewport.height-padding;
      if(config.collisionBoundary!=='viewport')for(const target of [a,floating])for(let node=target.parent;node;node=node.parent)if(node.clip){const clip=node.mapToItem(floating.parent,0,0);left=Math.max(left,clip.x+padding);top=Math.max(top,clip.y+padding);right=Math.min(right,clip.x+node.width-padding);bottom=Math.min(bottom,clip.y+node.height-padding);}
      if(side==='bottom'&&y+floating.height>bottom&&point.y-floating.height-offset>=top){side='top';y=point.y-floating.height-offset;}
      else if(side==='top'&&y<top&&point.y+a.height+offset+floating.height<=bottom){side='bottom';y=point.y+a.height+offset;}
      else if(side==='right'&&x+floating.width>right&&point.x-floating.width-offset>=left){side='left';x=point.x-floating.width-offset;}
      else if(side==='left'&&x<left&&point.x+a.width+offset+floating.width<=right){side='right';x=point.x+a.width+offset;}
      x=Math.max(left,Math.min(right-floating.width,x));y=Math.max(top,Math.min(bottom-floating.height,y));
    }
    floating.x=x;floating.y=y;const previous=positionSnapshot;positionSnapshot=Object.freeze({side,align,strategy:config.strategy||'absolute'});
    if(positionConnection.onResolved&&(!previous||previous.side!==side||previous.align!==align||previous.strategy!==positionSnapshot.strategy))options.invoke(positionConnection.onResolved,[positionSnapshot],false,'positioning');
  }
  function clearPositionSignals(){for(const entry of positionSignals)if(entry.node)entry.signal.disconnect(entry.callback);positionSignals.length=0;}
  function bindPositionSignals() {
    clearPositionSignals();if(!positionConnection||!options.ready())return;
    const seen=new Set(),floating=targetNode(positionConnection.floating);
    for(const target of [targetNode(positionConnection.anchor),floating])for(let node=target;node;node=node.parent){if(seen.has(node))continue;seen.add(node);for(const name of ['xChanged','yChanged','widthChanged','heightChanged','scaleChanged','rotationChanged','parentChanged']){if(node===floating&&(name==='xChanged'||name==='yChanged'))continue;const signal=node[name];if(signal&&signal.connect){const callback=()=>{if(options.ready())position();};signal.connect(callback);positionSignals.push({node,signal,callback});}}}
    position();
  }
  const positioning={connect(connection) {options.alive();positionConnection=Object.assign({},connection);positionSnapshot=null;bindPositionSignals();},update(config) {options.alive();if(!positionConnection)return;positionConnection=Object.assign({},positionConnection,{config});bindPositionSignals();},requestUpdate() {options.alive();position();},disconnect() {options.alive();clearPositionSignals();positionConnection=null;positionSnapshot=null;},getSnapshot() {options.alive();return positionSnapshot;}};
  function releasePortal() {if(portalRoot){portalRoot.parent=portalParent;portalRoot.z=portalZ;portalRoot=null;}portalParent=null;portalZ=0;}
  function overlayProjection() {
    const root=targetNode(content)||options.root();
    if(!overlayViewActive){clearPositionSignals();positionConnection=null;positionSnapshot=null;releasePortal();if(root)root.syncOverlay({open:false});return;}
    if(!root)return;
    if(overlayConfig.portal){if(!portalRoot){portalParent=root.parent;portalZ=root.z;}portalRoot=root;if(root.nativeWindow)root.parent=root.nativeWindow.contentItem;}
    else if(portalRoot)releasePortal();
    root.z=1000+(overlayConfig.layerOffset||0);
    root.syncOverlay(Object.assign({},overlayConfig,{open:true}));
    const anchored=overlayConfig.anchored&&(anchor||trigger);
    positionConnection=anchored?{anchor:anchor||trigger,floating:root,config:overlayConfig}:null;
    bindPositionSignals();
    if(overlayFocused)return;
    if(overlayConfig.entry==='manual')return;
    overlayFocused=true;
    if(root.nativeWindow){if(overlayConfig.entry==='content'||!root.focusDescendant({reason:'programmatic',selected:overlayConfig.entry==='selected'}))root.requestNativeFocus();}
  }
  function changeOverlay(next,reason) {
    options.runtime();if(overlayOpen===next)return;
    overlayOpen=next;open.set(next);
    const root=options.root();if(next&&root&&root.nativeWindow)previousFocus=root.nativeWindow.activeFocusItem;
    if(next)overlayStack.push(record);else{const index=overlayStack.lastIndexOf(record);if(index>=0)overlayStack.splice(index,1);}
    if(presenceBinding){if(next)presenceBinding.enter();else presenceBinding.leave();overlayViewActive=presenceBinding.present.get();}
    else{overlayViewActive=next;if(!keepMounted)options.setPresent(next);}
    if(!next){if(overlayFocused)overlayFocused=false;if(overlayConfig.restore!=='none'){const target=overlayConfig.restore==='trigger'?targetNode(trigger):previousFocus;if(target&&target.visible&&target.nativeWindow)target.forceActiveFocus();}}
    overlayProjection();
  }
  function releaseOverlay() {
    overlayFocused=false;
    const root=targetNode(content)||options.root();if(root)root.syncOverlay({open:false});
    clearPositionSignals();
    releasePortal();
    positionConnection=null;positionSnapshot=null;
  }
  const overlay={open:open.handle,configure(patch) {options.setup();Object.assign(overlayConfig,patch);if(patch.defaultOpen){overlayOpen=true;open.set(true);}},isOpen() {options.alive();return overlayOpen;},openOverlay(reason) {changeOverlay(true,reason);},close(reason) {changeOverlay(false,reason);},toggle(reason) {changeOverlay(!overlayOpen,reason);},updatePosition(patch) {options.alive();Object.assign(overlayConfig,patch);overlayProjection();},registerTrigger(target) {options.alive();if(overlayRegions.trigger)overlayRegions.trigger();trigger=target;overlayRegions.trigger=region(target,{role:'trigger'});overlayProjection();},registerAnchor(target) {options.alive();if(overlayRegions.anchor)overlayRegions.anchor();anchor=target;overlayRegions.anchor=region(target,{role:'anchor'});overlayProjection();},registerAnchorPart(part) {options.alive();if(overlayRegions.anchor)overlayRegions.anchor();anchor=part;overlayRegions.anchor=region(part,{role:'anchor'});overlayProjection();},registerContent(target) {options.alive();if(overlayRegions.content)overlayRegions.content();content=target;overlayRegions.content=region(target,{role:'content'});overlayProjection();},getPositionSnapshot:positioning.getSnapshot,keepMounted() {options.setup();if(presenceBinding)throw new Error('Overlay cannot keep mounted after Presence binding');keepMounted=true;},bindPresence(binding) {options.setup();if(keepMounted)throw new Error('Overlay cannot bind Presence after keepMounted');if(presenceBinding===binding)return;if(presenceBinding)throw new Error('Overlay presence is already bound');presenceBinding=binding;offPresence=binding.present.watch((_run,event) => {if(event.type!=='next')return;overlayViewActive=event.next;options.later(()=>{if(options.isAlive())overlayProjection();});});}};
  return {anatomy,positioning,recordHook(name){options.setup();hookNames.add(name);},claimEntries(){options.alive();return Array.from(claims);},
    hooks:{asBoundary() {options.setup();hookNames.add('asBoundary');return boundary;},asHitParticipation() {options.setup();hookNames.add('asHitParticipation');return hit;},asCollection() {options.setup();hookNames.add('asCollection');if(!count)count=options.ownedState('number.discrete','collectionCount',0);return collection;},asCollectionItem() {options.setup();hookNames.add('asCollectionItem');if(!index){index=options.ownedState('number.discrete','collectionIndex',-1);total=options.ownedState('number.discrete','collectionTotal',0);first=options.ownedState('bool','collectionFirst',false);last=options.ownedState('bool','collectionLast',false);}return collectionItem;},asOverlay() {options.setup();hookNames.add('asOverlay');overlayDeclared=true;return overlay;}},
    created() {if(!overlayDeclared)return;options.invoke(()=>{if(overlayOpen)overlayStack.push(record);if(presenceBinding){if(overlayOpen)presenceBinding.enter();else presenceBinding.leave();overlayViewActive=presenceBinding.present.get();}else{overlayViewActive=overlayOpen;options.setPresent(keepMounted||overlayOpen);}},[],false,'created');},
    mount() {publish();hitProjection();if(overlayDeclared){if(!content)content=options.host;overlayProjection();}else bindPositionSignals();},
    refresh() {publish();hitProjection();if(overlayDeclared)overlayProjection();},
    geometryChanged() {if(positionConnection)position();},
    nativeEvent(name,event) {
      if(!options.ready())return;
      let owners=sampleOwners.get(event);if(!owners){owners={boundary:regionStack.slice().reverse().find((item)=>item.ready()),overlay:overlayStack.slice().reverse().find((item)=>item.ready())};sampleOwners.set(event,owners);}
      if(name==='pointerdown'&&boundaryObserving)options.invoke(()=>boundary.notify({nativeEvent:event}),[],false,'event');
      if(overlayDeclared&&overlayOpen&&owners.overlay===record) {
        if(name==='keydown'&&event.key==='Escape'&&overlayConfig.closeOnEscape)options.invoke(()=>changeOverlay(false,'escape'),[],false,'event');
        if(name==='pointerdown'&&overlayConfig.closeOnOutsidePress&&classify({nativeEvent:event})==='outside')options.invoke(()=>changeOverlay(false,'outside.press'),[],false,'event');
        else if(name==='pointerdown'&&overlayConfig.closeOnTriggerPress&&inside(targetNode(trigger),null,event))options.invoke(()=>changeOverlay(false,'trigger.press'),[],false,'event');
        else if(name==='pointerdown'&&overlayConfig.closeOnAnchorPress&&inside(targetNode(anchor),null,event))options.invoke(()=>changeOverlay(false,'anchor.press'),[],false,'event');
        if(name==='focus'&&overlayConfig.closeOnFocusOutside){const root=options.root(),focused=root&&root.nativeWindow?root.nativeWindow.activeFocusItem:null;if(focused&&classify({target:focused})==='outside')options.invoke(()=>changeOverlay(false,'focus.outside'),[],false,'event');}
      }
    },
    bindScrollChrome(binding) {
      options.setup();const root=options.root();record.scrollBinding=binding;
      subscriptions.push({family:binding.anatomy,role:binding.scrollbarRole,active:true,last:null,callback(run,views){
        const surface=options.root();if(!surface)return;
        for(const view of views){const bar=view.qtPart.root();if(bar)bar.syncScrollChrome(surface,view.getExpose(binding.orientationExpose),binding.thumbRole);}
      }});
    },
    unmount() {clearPositionSignals();if(overlayDeclared)releaseOverlay();for(const entry of hitEntries)if(entry.node){entry.node.hitMode=entry.previous;entry.node=null;}publish();},
    dispose() {participants.delete(options.host);for(const stack of [regionStack,overlayStack]){const i=stack.indexOf(record);if(i>=0)stack.splice(i,1);}if(offPresence){offPresence();offPresence=null;}if(overlayDeclared)releaseOverlay();subscriptions.length=0;outsideListeners.length=0;regionEntries.length=0;hitEntries.length=0;partViews.clear();orders.clear();clearPositionSignals();let failure;for(const state of governed)try{state.clear();}catch(error){if(failure===undefined)failure=error;}try{publish();}catch(error){if(failure===undefined)failure=error;}if(failure!==undefined)throw failure;}
  };
}
`;
