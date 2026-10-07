export const qtPresentationSource = `// Native table structure and perceptual presence. Ordinary checked control flow.
import {projectNativeTable} from './QtTableProjection.mjs';
import {compareLogicalOrder} from './QtTopology.mjs';
const tables=new Map();
function ancestors(host) {const list=[],seen=new Set();for(let node=host;node;node=node.logicalParent||node.parent){if(seen.has(node))throw new Error('Cyclic table ancestry');seen.add(node);list.push(node);}return list;}
export function createPresentation(options) {
  const resources=[];
  function observed(initial) {
    let value=initial;const listeners=new Set(),watchers=new Set();
    const publicState={get(){options.alive();return value;},spec:{kind:typeof initial==='boolean'?'bool':typeof initial==='number'?'number.discrete':'string'},subscribe(cb){options.alive();listeners.add(cb);return ()=>{options.alive();listeners.delete(cb);};},unsubscribe(off){options.alive();off();}};
    const state={handle:Object.assign({external:publicState,watch(cb){options.setup();watchers.add(cb);return ()=>{options.alive();watchers.delete(cb);};}},publicState),set(next){if(Object.is(value,next))return;const prev=value;value=next;options.changed();if(options.active()){const event={type:'next',prev,next,reason:'presentation'};for(const cb of Array.from(listeners))options.invoke(cb,[event],false,'presentation');for(const cb of Array.from(watchers))options.invoke(cb,[event],true,'state-watch');}},clear(){watchers.clear();let failure;for(const cb of Array.from(listeners))try{cb({type:'disconnect',reason:'unmount'});}catch(error){if(failure===undefined)failure=error;}listeners.clear();if(failure!==undefined)throw failure;}};
    resources.push(state);return state;
  }
  let tableRole=null,tableConfig={},tableSnapshot=null,tableRelations={};
  const tableStates={a11yRole:options.ownedState('string','tableA11yRole',''),rowCount:options.ownedState('number.discrete','tableRowCount',0),columnCount:options.ownedState('number.discrete','tableColumnCount',0),row:options.ownedState('number.discrete','tableRow',-1),column:options.ownedState('number.discrete','tableColumn',-1),rowSpan:options.ownedState('number.discrete','tableRowSpan',0),columnSpan:options.ownedState('number.discrete','tableColumnSpan',0)};
  const tableRef=Object.freeze({nativeOwner:options.host});
  const record={host:options.host,ref:tableRef,role:()=>tableRole,config:()=>tableConfig,states:tableStates,ready:options.ready,claims:options.claimEntries,family(){return options.claimEntries().find(([family])=>(options.tableFamilies||[]).indexOf(family)>=0)?.[0]||null;},snapshot(snapshot){tableSnapshot=snapshot;},relations(next){tableRelations=next;},refresh:options.refreshFacts,facts:()=>({role:tableStates.a11yRole.handle.get(),rowCount:tableStates.rowCount.handle.get(),columnCount:tableStates.columnCount.handle.get(),rowIndex:tableStates.row.handle.get(),columnIndex:tableStates.column.handle.get(),rowSpan:tableStates.rowSpan.handle.get(),columnSpan:tableStates.columnSpan.handle.get(),tableRelations})};
  function tableRoot() {
    const family=record.family();if(!family)return null;
    for(const host of ancestors(options.host)){const candidate=tables.get(host);if(candidate&&candidate.role()==='root'&&candidate.family()===family)return candidate;}
    return null;
  }
  function rebuildTable() {
    const root=tableRoot();if(!root)return;
    const family=root.family(),members=Array.from(tables.values()).filter((item)=>item.ready()&&item.family()===family&&ancestors(item.host).find((host)=>tables.has(host)&&tables.get(host).role()==='root'&&tables.get(host).family()===family)===root.host).sort((a,b)=>compareLogicalOrder(a.host,b.host));
    const mismatches=members.filter((item)=>item.claims().find(([claimed])=>claimed===family)?.[1]!==item.role());
    const validMembers=members.filter((item)=>mismatches.indexOf(item)<0),rowRecords=validMembers.filter((item)=>item.role()==='row'),rows=rowRecords.map((row)=>({ref:row.ref,cells:[]})),unmatchedCells=[];
    for(const item of validMembers)if(item.role()==='headerCell'||item.role()==='cell') {
      const rowHost=ancestors(item.host).slice(1).find((host)=>tables.has(host)&&tables.get(host).role()==='row'&&tables.get(host).family()===family),row=rowRecords.findIndex((candidate)=>candidate.host===rowHost);
      if(row<0){unmatchedCells.push(item.ref);continue;}
      rows[row].cells.push(Object.assign({ref:item.ref,kind:item.role(),headers:[]},item.config()));
    }
    const snapshot=projectNativeTable({root:root.ref,captions:validMembers.filter((item)=>item.role()==='caption').map((item)=>item.ref),rows,unmatchedCells,roleMismatches:mismatches.map((item)=>item.ref)});
    const byRef=new Map(members.map((item)=>[item.ref,item]));
    for(const member of members){member.states.rowCount.set(member===root&&snapshot.valid?snapshot.rowCount:0);member.states.columnCount.set(member===root&&snapshot.valid?snapshot.columnCount:0);member.states.a11yRole.set('');member.states.row.set(0);member.states.column.set(0);member.states.rowSpan.set(0);member.states.columnSpan.set(0);member.relations({});}
    root.snapshot(snapshot);
    if(snapshot.valid){root.states.a11yRole.set('table');root.relations({caption:snapshot.caption?[snapshot.caption]:[],labelledBy:snapshot.caption?[snapshot.caption]:[]});if(snapshot.caption)byRef.get(snapshot.caption).states.a11yRole.set('caption');
      for(const row of snapshot.rows){const rowRecord=byRef.get(row.ref);rowRecord.states.a11yRole.set('row');rowRecord.states.row.set(row.index+1);for(const cell of row.cells){const item=byRef.get(cell.ref);item.states.a11yRole.set(cell.kind==='cell'?'cell':cell.kind==='row-header'?'rowheader':'columnheader');item.states.row.set(cell.row+1);item.states.column.set(cell.column+1);item.states.rowSpan.set(cell.rowSpan);item.states.columnSpan.set(cell.columnSpan);item.relations({columnHeaders:cell.columnHeaders,rowHeaders:cell.rowHeaders,labelledBy:cell.orderedHeaders.length?cell.orderedHeaders.concat([cell.ref]):[]});}}
    }
    for(const member of members)member.refresh();
  }
  function refreshTables(){for(const item of tables.values())if(item.role()==='root'&&item.ready())item.rebuild();}
  record.rebuild=rebuildTable;
  const table={role:tableRole,states:{},configure(patch){options.alive();tableConfig=Object.assign({},tableConfig,patch);if(patch.headers)tableConfig.headers=patch.headers.slice();refreshTables();},getObjectRef(){options.alive();return tableRef;},getSnapshot(){options.alive();return tableSnapshot;}};
  for(const key of Object.keys(tableStates))table.states[key]=tableStates[key].handle;
  let transitionDeclared=false,targetOpen=false,queuedIntent=null,generation=0,mounted=false;
  const transitionState=observed('closed'),isPresent=observed(false),transitionConfig={appear:false,enterDuration:300,leaveDuration:200,interrupt:'reverse'};
  let transitionHost=null;
  function props() {const result=Object.assign({},transitionConfig),snapshot=options.getProps();for(const key of Object.keys(snapshot))if(options.isProvided(key)||key==='defaultOpen')result[key]=snapshot[key];return result;}
  function emit(name) {options.emit(name);}
  function view(next) {options.setPresent(next);}
  function invalidateCompletion() {++generation;if(transitionHost)transitionHost.cancelTransition();}
  function armCompletion(state) {
    invalidateCompletion();
    const config=props(),duration=Math.max(0,state==='entering'?config.enterDuration:config.leaveDuration);
    transitionHost.startTransition(duration,generation);
  }
  function setState(state) {transitionState.set(state);isPresent.set(state!=='closed');}
  function completeCurrent(consumeQueue=true) {
    const state=transitionState.handle.get();if(state!=='entering'&&state!=='leaving')return;
    invalidateCompletion();
    if(state==='entering'){setState('entered');emit('afterEnter');}
    else{setState('closed');emit('afterLeave');view(false);}
    if(consumeQueue&&queuedIntent!==null){const intent=queuedIntent;queuedIntent=null;if(intent==='enter')enter();else leave();}
  }
  function beginEnter() {
    view(true);if(!mounted)return;
    queuedIntent=null;emit('beforeEnter');setState('entering');armCompletion('entering');
  }
  function beginLeave() {
    queuedIntent=null;emit('beforeLeave');setState('leaving');armCompletion('leaving');
  }
  function enter() {
    options.runtime();targetOpen=true;const state=transitionState.handle.get();
    if(state==='entered')return;
    if(state==='closed'){beginEnter();return;}
    if(state==='entering'){if(props().interrupt==='wait')queuedIntent=null;return;}
    const interrupt=props().interrupt;
    if(interrupt==='wait')queuedIntent='enter';
    else if(interrupt==='immediate'){completeCurrent(false);beginEnter();}
    else{invalidateCompletion();beginEnter();}
  }
  function leave() {
    options.runtime();targetOpen=false;const state=transitionState.handle.get();
    if(state==='closed'){view(false);return;}
    if(state==='leaving'){if(props().interrupt==='wait')queuedIntent=null;return;}
    if(state==='entered'){beginLeave();return;}
    const interrupt=props().interrupt;
    if(interrupt==='wait')queuedIntent='leave';
    else if(interrupt==='immediate'){completeCurrent(false);beginLeave();}
    else{invalidateCompletion();beginLeave();}
  }
  function setTarget(next) {
    if(next===targetOpen)return;if(next)enter();else leave();
  }
  const controls={enter,leave,complete(){options.runtime();completeCurrent();}};
  const transition={transitionState:transitionState.handle,isPresent:isPresent.handle,controls,configure(patch){options.setup();if(patch.appear!==undefined)transitionConfig.appear=patch.appear;if(patch.enterDuration!==undefined){if(!Number.isFinite(patch.enterDuration)||patch.enterDuration<0)throw new Error('Transition enterDuration must be a finite non-negative number');transitionConfig.enterDuration=patch.enterDuration;}if(patch.leaveDuration!==undefined){if(!Number.isFinite(patch.leaveDuration)||patch.leaveDuration<0)throw new Error('Transition leaveDuration must be a finite non-negative number');transitionConfig.leaveDuration=patch.leaveDuration;}if(patch.interrupt!==undefined){if(['reverse','wait','immediate'].indexOf(patch.interrupt)<0)throw new Error('Transition interrupt policy is invalid');transitionConfig.interrupt=patch.interrupt;}}};
  return {hooks:{asTableStructure(role){options.setup();if(tableRole&&tableRole!==role)throw new Error('Conflicting table role');tableRole=role;table.role=role;const roles={root:'table',row:'row',headerCell:'columnheader',cell:'cell',caption:'caption'};if(!roles[role])throw new Error('Unknown table role');tableStates.a11yRole.set(roles[role]);tables.set(options.host,record);return table;},asTransition(){options.setup();if(transitionDeclared)return transition;transitionDeclared=true;options.declareTransition();options.expose('transitionState',transitionState.handle.external);options.expose('isPresent',isPresent.handle.external);options.expose('controls',controls);for(const key of ['enter','leave','complete'])options.expose(key,controls[key]);return transition;}},
    created(){if(!transitionDeclared)return;const config=props();targetOpen=options.isProvided('open')?!!config.open:!!config.defaultOpen;options.invoke(()=>{setState('closed');view(targetOpen);if(targetOpen&&!config.appear)setState('entered');},[],false,'created');},
    mounted(){mounted=true;transitionHost=options.root();refreshTables();if(transitionDeclared&&targetOpen&&transitionState.handle.get()==='closed')options.invoke(()=>{beginEnter();},[],false,'mounted');},
    refresh(){refreshTables();},propsApplied(){if(transitionDeclared&&options.isProvided('open'))options.invoke(()=>setTarget(!!props().open),[],false,'props-watch');},
    transitionComplete(ticket){if(!transitionDeclared||ticket!==generation||!options.ready())return;options.invoke(()=>completeCurrent(),[],false,'transition-complete');},
    facts(){return tableRole?record.facts():{};},unmount(){mounted=false;if(transitionDeclared){invalidateCompletion();queuedIntent=null;transitionHost=null;if(transitionState.handle.get()!=='closed')setState('closed');}refreshTables();},
    dispose(){tables.delete(options.host);refreshTables();if(transitionDeclared)invalidateCompletion();let failure;for(const resource of resources)try{resource.clear();}catch(error){if(failure===undefined)failure=error;}if(failure!==undefined)throw failure;}
  };
}
`;
