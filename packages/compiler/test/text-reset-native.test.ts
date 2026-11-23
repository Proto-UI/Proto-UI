// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanups.splice(0).reverse()) await dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
// C-TEXT-CONTROL-SELECTION-0001 binds snapshots to the physical editor.
// Compare the observed host facts, never an inferred end caret.
function hostSelection(input: HTMLInputElement) {
  return {
    start: input.selectionStart,
    end: input.selectionEnd,
    direction: input.selectionDirection,
  };
}
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
function selectionResetSource(controlled: boolean) {
  return `import{definePrototype}from'@proto.ui/core';
import{asTextControl}from'@proto.ui/hooks';import{declareTextControl}from'@proto.ui/module-text-control';
export default definePrototype({name:'selection-reset-consumer',modules:[declareTextControl({content:'plain-text',lineMode:'single',engine:'host'})],setup(def){
 const text=asTextControl();const selections=def.state.numberDiscrete('selections',0);
 const afterSelection=def.state.numberDiscrete('afterSelection',0);const armed=def.state.bool('armed',false);
 def.lifecycle.onCreated(()=>text.sync({valueMode:'${controlled ? 'controlled' : 'uncontrolled'}',value:'owner',defaultValue:'seed'}));
 def.expose.state('selections',selections);def.expose.state('afterSelection',afterSelection);
 def.expose.method('reset',(value?:string)=>text.resetValue(value));
 def.expose.method('snapshot',()=>text.snapshot());
 def.expose.method('refresh',()=>text.sync({placeholder:'refreshed'}));
 def.expose.method('arm',()=>armed.set(true));
 text.on('selectionchange',()=>{
  selections.set(selections.get()+1);
  if(armed.get()){armed.set(false);text.resetValue('reset-from-selection');text.sync({value:text.snapshot()?.value??''});}
 });
 text.on('selectionchange',()=>afterSelection.set(afterSelection.get()+1));
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
    expect(api.snapshot().selection).toEqual(hostSelection(input));
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
    expect(api.snapshot().selection).toEqual(hostSelection(input));
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
    expect(owner.handle.getExposes().snapshot().selection).toEqual(hostSelection(input));
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
    expect(owner.handle.getExposes().snapshot().selection).toEqual(hostSelection(input));
    expect(input.value).toBe('owner');
  });
  // C-TEXT-CONTROL-SELECTION-0001-LIFETIME: reset also retires selection work.
  // These are generated framework consumers with synthetic DOM events, not OS input evidence.
  it(`${profile}: reset retires queued selection and removes the previous host listeners`, async () => {
    const owner = await mountNativeOwner(selectionResetSource(false), profile);
    cleanups.push(owner.dispose);
    await owner.flush();
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    const api = owner.handle.getExposes();
    const live = new Map<
      EventListenerOrEventListenerObject,
      { target: EventTarget; type: string }
    >();
    for (const target of [input, input.ownerDocument]) {
      const add = target.addEventListener.bind(target),
        remove = target.removeEventListener.bind(target);
      vi.spyOn(target, 'addEventListener').mockImplementation(
        (type, listener, options?: boolean | AddEventListenerOptions) => {
          if (listener) live.set(listener, { target, type });
          add(type, listener, options);
        }
      );
      vi.spyOn(target, 'removeEventListener').mockImplementation(
        (type, listener, options?: boolean | EventListenerOptions) => {
          if (listener) live.delete(listener);
          remove(type, listener, options);
        }
      );
    }
    const beforeReset = api.selections.get();
    await owner.act(() => {
      api.refresh();
      api.reset('first');
    });
    expect(api.selections.get()).toBe(beforeReset + 1);
    const registrations = live.size;
    expect(registrations).toBeGreaterThan(0);
    const retained = [...live];
    for (const value of ['second', 'third']) {
      const before = api.selections.get();
      await owner.act(() => api.reset(value));
      expect(api.selections.get()).toBe(before + 1);
      expect(live.size).toBe(registrations);
      expect(owner.host.querySelector('input') ?? host.shadowRoot?.querySelector('input')).toBe(
        input
      );
    }
    const beforeRetired = api.selections.get();
    await owner.act(() => {
      for (const [listener, registration] of retained) {
        const event = new Event(registration.type);
        if (typeof listener === 'function') listener.call(registration.target, event);
        else listener.handleEvent(event);
      }
    });
    expect(api.selections.get()).toBe(beforeRetired);
    expect(api.snapshot()).toEqual({
      value: 'third',
      composing: false,
      selection: hostSelection(input),
    });
    await owner.act(() => input.focus());
    const beforeCurrent = api.selections.get();
    await owner.act(() => {
      input.setSelectionRange(1, 3, 'backward');
      input.dispatchEvent(new Event('select'));
      input.ownerDocument.dispatchEvent(new Event('selectionchange'));
    });
    expect(api.selections.get()).toBe(beforeCurrent + 1);
    expect(api.snapshot().selection).toEqual({ start: 1, end: 3, direction: 'backward' });
    await owner.dispose();
    expect(live.size).toBe(0);
  }, 30_000);
  it(`${profile}: reentrant reset retires a selection callback without accepting its candidate`, async () => {
    const owner = await mountNativeOwner(selectionResetSource(true), profile);
    cleanups.push(owner.dispose);
    await owner.flush();
    const host = owner.handle as unknown as HTMLElement;
    const input = (owner.host.querySelector('input') ??
      host.shadowRoot?.querySelector('input')) as HTMLInputElement;
    const api = owner.handle.getExposes();
    const before = api.afterSelection.get();
    await owner.act(() => {
      api.arm();
      input.value = 'unaccepted candidate';
      // Happy DOM setSelectionRange itself dispatches select synchronously.
      // Dispatch exactly one observation here so a second fresh-lease event
      // cannot be mistaken for continuation of the retired callback chain.
      input.dispatchEvent(new Event('select'));
      expect(api.afterSelection.get()).toBe(before);
      expect(input.value).toBe('owner');
      expect(api.snapshot()).toEqual({
        value: 'owner',
        composing: false,
        selection: hostSelection(input),
      });
    });
    // Only the fresh reset lease may deliver its initial selection observation.
    expect(api.afterSelection.get()).toBe(before + 1);
  }, 30_000);
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
