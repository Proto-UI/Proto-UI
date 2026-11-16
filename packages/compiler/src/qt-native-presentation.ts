export const qtPresentationSource = `// Native table structure projection. Business hooks compile from authored source.
import {projectNativeTable} from './QtTableProjection.mjs';
import {compareLogicalOrder} from './QtTopology.mjs';
const tables=new Map();
function ancestors(host) {const list=[],seen=new Set();for(let node=host;node;node=node.logicalParent||node.parent){if(seen.has(node))throw new Error('Cyclic table ancestry');seen.add(node);list.push(node);}return list;}
export function createPresentation(options) {
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
  return {hooks:{asTableStructure(role){options.setup();if(tableRole&&tableRole!==role)throw new Error('Conflicting table role');tableRole=role;table.role=role;const roles={root:'table',row:'row',headerCell:'columnheader',cell:'cell',caption:'caption'};if(!roles[role])throw new Error('Unknown table role');tableStates.a11yRole.set(roles[role]);tables.set(options.host,record);return table;}},
    mounted:refreshTables,refresh:refreshTables,
    facts(){return tableRole?record.facts():{};},unmount:refreshTables,
    dispose(){tables.delete(options.host);refreshTables();}
  };
}
`;
