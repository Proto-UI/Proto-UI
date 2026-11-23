import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { definePrototype } from '@proto.ui/core';
import { datePickerRoot, datePickerDay } from '/workspace/scratch/44c416809288/Proto-UI/packages/prototypes/base/src/date-picker/index.ts';
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
  let actionCallback = (_name: string) => {};
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
            (name: string) => {
              actions.push(name);
              if (
                name === 'valueChange' ||
                name === 'rangeChange' ||
                name === 'execute' ||
                name === 'openChange' ||
                name === 'validationRequest'
              )
                actionCallback(name);
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
    setActionCallback(fn: (name: string) => void) {
      actionCallback = fn;
    },
  };
}



const results: unknown[] = [];
for (const mode of ['single','range'] as const) {
 const {make,actions}=runtimeHarness();
 const initial=mode==='single'?{defaultValue:'2026-10-10'}:{defaultRange:{from:'2026-10-10'}};
 const root=make(datePickerRoot,null,{...initial,mode,defaultMonth:'2026-10',defaultOpen:false});
 await root.session.mount();
 let observed=false;
 const state=mode==='single'?root.exposes.value:root.exposes.selectedCount;
 const off=state.subscribe((event:any)=>{
  if(event.type!=='next'||observed)return;
  observed=true;
  root.exposes.openPopover('state-subscriber');
 });
 try {
  const before=root.exposes.open.get();
  const request=root.session.invokeInCallbackScope(()=>root.exposes.requestValue('2026-10-15'));
  const after=root.exposes.open.get();
  results.push({mode,request,before,after,observed,actions:[...actions],expectedOpenAfter:true,pass:after===true});
 } finally {off();await root.session.dispose();}
}
const result={reviewedCommit:'3bd5bcf363ab0de87b926ea25540fd87509cf05c',scope:'Independent real Runtime source probe; public exposed State subscription opens a previously closed Picker synchronously before first Calendar request Context publication. No browser or physical-input claim.',ok:results.every((r:any)=>r.pass),results};
writeFileSync('/workspace/scratch/44c416809288/evidence/compiler-review-picker-request-start-green.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exitCode=1;
