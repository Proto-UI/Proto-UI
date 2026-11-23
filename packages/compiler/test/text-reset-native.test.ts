// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanups.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
function source(controlled: boolean, reentrant = false) {
  return `import{definePrototype}from'@proto.ui/core';
import{asTextControl}from'@proto.ui/hooks';import{declareTextControl}from'@proto.ui/module-text-control';
export default definePrototype({name:'reset-editor-consumer',modules:[declareTextControl({content:'plain-text',lineMode:'single',engine:'host'})],setup(def){
 const text=asTextControl();const calls=def.state.numberDiscrete('calls',0);
 def.lifecycle.onCreated(()=>text.sync({valueMode:'${controlled ? 'controlled' : 'uncontrolled'}',value:'owner',defaultValue:'seed'}));
 def.expose.state('calls',calls);def.expose.method('reset',(value?:string)=>text.resetValue(value));
 def.expose.method('snapshot',()=>text.snapshot());
 text.on('input',()=>{${reentrant ? "text.resetValue('reset-in-callback');" : ''}});
 text.on('input',()=>calls.set(calls.get()+1));
 return()=>null;
}});`;
}
for (const profile of nativeOwnerProfiles) {
  it(`${profile}: resets uncontrolled value/composition and emits no input/change`, async () => {
    const owner = await mountNativeOwner(source(false), profile);
    cleanups.push(owner.dispose);
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    expect(input).toBeTruthy();
    const api = owner.handle.getExposes();
    await owner.act(() => input.dispatchEvent(new Event('compositionstart', { bubbles: true })));
    expect(api.snapshot().composing).toBe(true);
    let accepted = false;
    await owner.act(() => {
      input.setSelectionRange(1, 4, 'backward');
      accepted = api.reset('a\r\nb😀');
    });
    expect(accepted).toBe(true);
    expect(input.value).toBe('ab😀');
    expect(api.snapshot()).toEqual({
      value: 'ab😀',
      composing: false,
      selection: { start: 1, end: 4, direction: 'backward' },
    });
    expect(api.calls.get()).toBe(0);
    await owner.act(() => api.reset());
    expect(input.value).toBe('seed');
  });
  it(`${profile}: controlled reset retires composition without taking canonical authority`, async () => {
    const owner = await mountNativeOwner(source(true), profile);
    cleanups.push(owner.dispose);
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    const api = owner.handle.getExposes();
    await owner.act(() => input.dispatchEvent(new Event('compositionstart', { bubbles: true })));
    let accepted = true;
    await owner.act(() => {
      input.setSelectionRange(1, 4, 'forward');
      accepted = api.reset('forged');
    });
    expect(accepted).toBe(false);
    expect(input.value).toBe('owner');
    expect(api.snapshot()).toEqual({
      value: 'owner',
      composing: false,
      selection: { start: 1, end: 4, direction: 'forward' },
    });
  });
  it(`${profile}: reentrant reset retires the current input callback lease`, async () => {
    const owner = await mountNativeOwner(source(false, true), profile);
    cleanups.push(owner.dispose);
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    await owner.act(() => {
      input.value = 'candidate';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const api = owner.handle.getExposes();
    expect(api.snapshot().value).toBe('reset-in-callback');
    expect(api.calls.get()).toBe(0);
  });
  it(`${profile}: change without input advances uncontrolled canonical text`, async () => {
    const owner = await mountNativeOwner(source(false), profile);
    cleanups.push(owner.dispose);
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    await owner.act(() => {
      input.value = 'changed😀';
      input.setSelectionRange(2, 9, 'backward');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(owner.handle.getExposes().snapshot()).toEqual({
      value: 'changed😀',
      composing: false,
      selection: { start: 2, end: 9, direction: 'backward' },
    });
    expect(owner.handle.getExposes().calls.get()).toBe(0);
  });
  it(`${profile}: change without input cannot replace controlled authority`, async () => {
    const owner = await mountNativeOwner(source(true), profile);
    cleanups.push(owner.dispose);
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    await owner.act(() => {
      input.value = 'rejected';
      input.setSelectionRange(2, 8, 'forward');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(owner.handle.getExposes().snapshot()).toEqual({
      value: 'owner',
      composing: false,
      selection: { start: 2, end: 5, direction: 'forward' },
    });
    expect(input.value).toBe('owner');
  });
  it(`${profile}: reentrant reset retires the selection callback and its queued observation`, async () => {
    const owner = await mountNativeOwner(
      `
import {definePrototype} from '@proto.ui/core';
import {asTextControl} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'reset-selection-lease-consumer',
  modules:[declareTextControl({content:'plain-text',lineMode:'single',engine:'host'})],
  setup(def){
    const text=asTextControl();
    const armed=def.state.numberDiscrete('armed',0);
    const selections=def.state.numberDiscrete('selections',0);
    const last=def.state.string('last','');
    def.lifecycle.onCreated(()=>text.sync({valueMode:'uncontrolled',defaultValue:'seed'}));
    def.expose.state('selections',selections);def.expose.state('last',last);
    def.expose.method('snapshot',()=>text.snapshot());
    def.expose.method('queueAndArm',()=>{text.sync({placeholder:'queued'});armed.set(1);});
    text.on('selectionchange',()=>{
      if(armed.get()===1){armed.set(0);text.resetValue('reset-owner');}
    });
    text.on('selectionchange',(run,event)=>{
      selections.set(selections.get()+1);last.set(event.value);
    });
    return()=>null;
  }
});`,
      profile
    );
    cleanups.push(owner.dispose);
    await owner.flush();
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    expect(input).toBeTruthy();
    const api = owner.handle.getExposes();
    const before = api.selections.get();
    await owner.act(() => {
      // Queue the old attachment's observation without yielding to a microtask.
      api.queueAndArm();
      input.value = 'candidate';
      input.setSelectionRange(2, 5, 'none');
      input.dispatchEvent(new Event('select'));
    });
    await owner.flush();
    // Only the replacement lease's initial observation can reach listener two.
    expect(api.selections.get()).toBe(before + 1);
    expect(api.last.get()).toBe('reset-owner');
    expect(input.value).toBe('reset-owner');
    expect(api.snapshot()).toEqual({
      value: 'reset-owner',
      composing: false,
      selection: { start: 2, end: 5, direction: 'none' },
    });
    await owner.act(() => {
      input.setSelectionRange(1, 1, 'none');
      input.dispatchEvent(new Event('select'));
    });
    expect(api.selections.get()).toBe(before + 2);
    expect(api.snapshot().selection).toEqual({ start: 1, end: 1, direction: 'none' });
  });
}
