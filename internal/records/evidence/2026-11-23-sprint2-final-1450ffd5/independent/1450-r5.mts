import { definePrototype } from '@proto.ui/core';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import checkboxRoot from '<S2_REPAIR_CHECKOUT>/packages/prototypes/base/src/checkbox/root.proto.ts';
import fieldCheckbox from '<S2_REPAIR_CHECKOUT>/packages/prototypes/base/src/field/checkbox.proto.ts';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

function runtimeHarness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  let actionCallback = (_name: string, _payload?: any) => {};
  const actions: string[] = [];
  function make(proto: any, parent: any = null, props: any = {}) {
    const listeners = new Map<string, Set<any>>();
    const target = {
      addEventListener(type: string, fn: any) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: any) {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: Event) {
        for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
        return true;
      },
    } as unknown as EventTarget;
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: any) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: any) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: any) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: any) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (x: any) => {
              exposes = x;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: any) => {
              actions.push(name);
              actionCallback(name, payload);
            },
          ],
        ]);
      },
    });
    return {
      session,
      target,
      setProps(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
      get exposes() {
        return exposes;
      },
    };
  }

  return {
    make,
    actions,
    setActionCallback(fn: (name: string, payload?: any) => void) {
      actionCallback = fn;
    },
  };
}



const expectedHead = '1450ffd549bce8da636f2ccd45044aff5121e6ad';
const expectedTree = '15e67863a668e5e7a09af69731fd9c4c668ff9f1';
const git = (...args: string[]) => execFileSync('git', ['-C', '<S2_REPAIR_CHECKOUT>', ...args], {encoding: 'utf8'}).trim();
assert.equal(git('rev-parse', 'HEAD'), expectedHead, 'exact final HEAD before execution');
assert.equal(git('rev-parse', 'HEAD^{tree}'), expectedTree, 'exact reviewed tree');
assert.equal(git('status', '--porcelain'), '', 'final tree must be clean');
const sourceFiles = ['packages/prototypes/base/src/checkbox/root.proto.ts', 'packages/prototypes/base/test/notification-retirement-lifecycle.test.ts', 'packages/compiler/test/text-reset-native.test.ts'];
const hashSources = () => Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync('<S2_REPAIR_CHECKOUT>/' + path)).digest('hex')]));
const beforeSources = hashSources();

const results:any[]=[];
for(const [name,proto] of [['ordinary-checkbox',checkboxRoot],['field-checkbox',fieldCheckbox]] as const){
 for(const scenario of ['ordinary-reset','mixed-only-confirmation','new-owner-in-reset-mixed-callback','aba-owner-in-reset-mixed-callback']){
  const {make,setActionCallback}=runtimeHarness();let reset=()=>false;let accepted:boolean|undefined;const subject=definePrototype({...proto,name:'review-'+proto.name,setup(def){const renderer=proto.setup(def);def.event.on('key.down',()=>{accepted=reset();});return renderer;}});const root=make(subject,null,{checked:false,indeterminate:true});reset=()=>root.exposes.resetValue();
  const signals:any[]=[],ownerReads:any[]=[];await root.session.mount();if(scenario==='mixed-only-confirmation')root.setProps({checked:true,indeterminate:false});
  setActionCallback((event,payload)=>{
   signals.push({event,payload});
   if(event==='indeterminateChange'&&scenario==='mixed-only-confirmation'){root.setProps({checked:true,indeterminate:payload.indeterminate});ownerReads.push({phase:'mixed-only-ack',checked:root.exposes.checked.get(),mixed:root.exposes.indeterminate.get()});}else if(event==='indeterminateChange'&&scenario!=='ordinary-reset'){
    root.setProps({checked:true,indeterminate:payload.indeterminate});ownerReads.push({phase:'new-owner-after-apply',checked:root.exposes.checked.get()});
    if(scenario.startsWith('aba-')){root.setProps({checked:false,indeterminate:payload.indeterminate});ownerReads.push({phase:'aba-owner-after-apply',checked:root.exposes.checked.get()});}
   }else if(event==='checkedChange')root.setProps({checked:payload.checked,indeterminate:true});
  });
  try{
   root.target.dispatchEvent(new Event('key.down'));assert.notEqual(accepted,undefined,'reset must execute inside the real Event callback');
   const trailing=signals.filter(s=>s.event==='checkedChange');
   results.push({name,scenario,accepted,signals,ownerReads,checked:root.exposes.checked.get(),mixed:root.exposes.indeterminate.get(),passed:['ordinary-reset','mixed-only-confirmation'].includes(scenario)?trailing.length===1&&root.exposes.checked.get()===false:trailing.length===0});
  }finally{await root.session.dispose();}
 }
}
assert.equal(git('rev-parse', 'HEAD'), expectedHead, 'exact final HEAD after execution');
assert.equal(git('status', '--porcelain'), '', 'final tree still clean');
assert.deepEqual(hashSources(), beforeSources, 'reviewed sources unchanged during execution');
const result={tree:git('rev-parse','HEAD^{tree}'),sourceFiles:beforeSources,head:execFileSync('git',['-C','<S2_REPAIR_CHECKOUT>','rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['-C','<S2_REPAIR_CHECKOUT>','status','--porcelain'],{encoding:'utf8'}),sourceSha256:createHash('sha256').update(readFileSync('<S2_REPAIR_CHECKOUT>/packages/prototypes/base/src/checkbox/root.proto.ts')).digest('hex'),observedAt:new Date().toISOString(),ok:results.every(x=>x.passed),cases:results,boundary:'Independent actual Runtime with synthetic host; exact current source, no native browser'};
writeFileSync('<REVIEW_EVIDENCE_DIR>/independent-checkbox-reset-1450ffd5-r5.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));