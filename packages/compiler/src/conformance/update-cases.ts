import { CaseRegistry, type CaseDefinition } from './registry';

export type UpdateAction =
  | {kind:'observe'}
  | {kind:'write';value:number}
  | {kind:'request'}
  | {kind:'presence';value:boolean}
  | {kind:'dispose'};
const steps: CaseDefinition<UpdateAction>['steps'] = [
  {id:'mount',action:{kind:'observe'},expected:{value:0,text:'0',updates:0,present:true,sameHandle:true},criteria:['C-LIFECYCLE-0003-D']},
  {id:'write-without-update',action:{kind:'write',value:1},expected:{value:1,text:'0',updates:0,sameHandle:true},criteria:['C-LIFECYCLE-0003-C']},
  {id:'explicit-update',action:{kind:'request'},expected:{value:1,text:'1',updates:1},criteria:['C-LIFECYCLE-0003-A','C-LIFECYCLE-0003-F']},
  {id:'detach',action:{kind:'presence',value:false},expected:{value:1,text:null,present:false,updates:1,sameHandle:true},criteria:['C-LIFECYCLE-0008-E']},
  {id:'write-detached',action:{kind:'write',value:9},expected:{value:9,text:null,present:false,updates:1,sameHandle:true},criteria:['C-LIFECYCLE-0003-I']},
  {id:'request-detached',action:{kind:'request'},expected:{value:9,text:null,present:false,updates:1},criteria:['C-LIFECYCLE-0003-I']},
  {id:'reattach',action:{kind:'presence',value:true},expected:{value:9,text:'9',present:true,updates:1,sameHandle:true},criteria:['C-LIFECYCLE-0003-I','C-LIFECYCLE-0008-E']},
  {id:'dispose',action:{kind:'dispose'},expected:{value:null,text:null,present:false,updates:1,invalid:true},criteria:['C-LIFECYCLE-0002-G','C-EXPOSE-STATE-0001-I']},
];
export const updateRegistry = new CaseRegistry<UpdateAction>([{
  id:'compiler.explicit-update',domain:'lifecycle',feature:'Explicit update separates state writes from actual host commits',
  source:'packages/compiler/test/fixtures/differential-browser/update-intent.proto.ts',
  profile:'shared-basic-update',styleFamily:'unstyled',steps,
  requiredCriteria:[...new Set(steps.flatMap((step) => step.criteria))],
}]);
