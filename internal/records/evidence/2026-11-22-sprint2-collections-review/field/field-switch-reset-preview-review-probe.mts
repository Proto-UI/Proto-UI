import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { definePrototype } from '@proto.ui/core';
import {checkboxRoot} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/checkbox/index.ts';
import {radioGroupRoot} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/radio-group/index.ts';
import {fieldCheckbox,fieldRadioGroup,fieldSwitch} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/field/index.ts';
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




const results:any[]=[];
for (const changeOwner of [false,true]) {
 const h=runtimeHarness();const control=h.make(fieldSwitch,null,{checked:false});
 const signals:any[]=[];let fired=false;
 await control.session.mount();
 h.setActionCallback((event,payload)=>{signals.push({event,payload});if(event==='checkedChange')control.setProps({checked:payload.checked});});
 control.session.invokeInCallbackScope(()=>control.target.dispatchEvent(new Event('pointer.down')));
 const before=control.exposes.pressed.get();
 const off=control.exposes.pressed.subscribe((event:any)=>{
  if(event.next!==false||fired)return;fired=true;
  if(changeOwner)control.setProps({checked:true});
 });
 let thrown:any,result:any;
 try {
  try {result=control.session.invokeInCallbackScope(()=>control.exposes.resetValue());}catch(error){thrown=String(error);}
  results.push({changeOwner,before,observerFired:fired,result,signals,checked:control.exposes.checked.get(),expected:changeOwner?'new checked=true owner survives older reset preview teardown':'ordinary controlled reset keeps baseline false',passed:!thrown&&before&&fired&&control.exposes.checked.get()===changeOwner&&(!changeOwner||signals.length===0),thrown});
 } finally {off();await control.session.dispose();}
}
const out={ok:results.every(r=>r.passed),cases:results,boundary:'Independent real FieldSwitch Runtime source probe; public pressed state observer; portable synthetic host.'};
writeFileSync('/workspace/scratch/44c416809288/evidence/field-switch-reset-preview-review-probe.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
