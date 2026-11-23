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
// C-TEXT-CONTROL-SELECTION-0001 binds snapshot selection to the physical editor.
// Reset does not grant a second caret owner or permit inferring offsets from length.
function physicalSelection(input: HTMLInputElement) {
  return {
    start: input.selectionStart,
    end: input.selectionEnd,
    direction: input.selectionDirection,
  };
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
      accepted = api.reset('a\r\nb😀');
    });
    expect(accepted).toBe(true);
    expect(input.value).toBe('ab😀');
    expect(api.snapshot()).toEqual({
      value: 'ab😀',
      composing: false,
      selection: physicalSelection(input),
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
      accepted = api.reset('forged');
    });
    expect(accepted).toBe(false);
    expect(input.value).toBe('owner');
    expect(api.snapshot()).toEqual({
      value: 'owner',
      composing: false,
      selection: physicalSelection(input),
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
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(owner.handle.getExposes().snapshot()).toEqual({
      value: 'changed😀',
      composing: false,
      selection: physicalSelection(input),
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
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(owner.handle.getExposes().snapshot()).toEqual({
      value: 'owner',
      composing: false,
      selection: physicalSelection(input),
    });
    expect(input.value).toBe('owner');
  });
}
