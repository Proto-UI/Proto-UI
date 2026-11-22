import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { definePrototype } from '@proto.ui/core';
import {checkboxRoot} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/checkbox/index.ts';
import {radioGroupRoot} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/radio-group/index.ts';
import {fieldCheckbox,fieldRadioGroup} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/field/index.ts';
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



const results: unknown[]=[];
for (const [name,proto] of [['ordinary-radio',radioGroupRoot],['field-radio',fieldRadioGroup],['ordinary-checkbox',checkboxRoot],['field-checkbox',fieldCheckbox]] as const) {
 const {make}=runtimeHarness();const radio=name.includes('radio');const root=make(proto,null,radio?{value:'a'}:{checked:false});
 try {
  await root.session.mount();const before=radio?root.exposes.value.get():root.exposes.checked.get();
  await root.session.unmount();root.setProps(radio?{value:'b'}:{checked:true});await root.session.mount();
  const actual=radio?root.exposes.value.get():root.exposes.checked.get();
  results.push({name,scenario:'controlled-owner-updates-while-unmounted',before,expected:radio?'b':true,actual,passed:actual===(radio?'b':true)});
 } finally {await root.session.dispose();}
}
for (const [name,proto] of [['ordinary-checkbox',checkboxRoot],['field-checkbox',fieldCheckbox]] as const) {
 const {make,actions,setActionCallback}=runtimeHarness();const root=make(proto,null,{checked:false,indeterminate:true});
 const signals: any[]=[];await root.session.mount();setActionCallback((event,payload)=>{ signals.push({event,payload});if(event==='indeterminateChange')root.setProps({checked:true,indeterminate:false});else if(event==='checkedChange')root.setProps({checked:payload.checked,indeterminate:false});});
 try {
  root.target.dispatchEvent(new Event('press.commit'));
  results.push({name,scenario:'new-canonical-owner-in-mixed-callback',actions:[...actions],signals,checked:root.exposes.checked.get(),mixed:root.exposes.indeterminate.get(),expected:'new canonical checked=true remains authoritative; no stale checked=false inversion',passed:root.exposes.checked.get()===true&&!signals.some(s=>s.event==='checkedChange'&&s.payload.checked===false)});
 } finally {await root.session.dispose();}
}
const result={ok:results.every((r:any)=>r.passed),cases:results,boundary:'Independent real Runtime/choice Root source probe; no native browser.'};
writeFileSync('/workspace/scratch/44c416809288/evidence/field-choice-owner-payload-review-probe-fixed.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
