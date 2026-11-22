// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

function source(controlled: boolean) {
  return `import {definePrototype} from '@proto.ui/core';
import {asTextControl} from '@proto.ui/hooks';
import {declareTextControl} from '@proto.ui/module-text-control';
export default definePrototype({name:'selection-consumer',
  modules:[declareTextControl({content:'plain-text',lineMode:'multiline',engine:'host'})],
  setup(def){
    def.props.define({value:{type:'string',default:'abcd'},present:{type:'boolean',default:true}});
    const editor=asTextControl();
    const start=def.state.numberDiscrete('start',-1);
    const inputStart=def.state.numberDiscrete('inputStart',-1);
    const notifications=def.state.numberDiscrete('notifications',0);
    def.expose.state('start',start);def.expose.state('inputStart',inputStart);
    def.expose.state('notifications',notifications);
    def.expose.method('read',()=>editor.snapshot());
    editor.on('selectionchange',(run,event)=>{
      start.set(event.selection?.start ?? -1);
      notifications.set(notifications.get()+1);
    });
    editor.on('input',(run,event)=>{inputStart.set(event.selection?.start ?? -1);});
    def.lifecycle.onCreated(run=>editor.sync({valueMode:'${controlled ? 'controlled' : 'uncontrolled'}',${controlled ? 'value' : 'defaultValue'}:run.props.get().value}));
    def.props.watch(['value'],(run,next)=>editor.sync({value:next.value}));
    def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present));
    return()=>null;
  }
});`;
}

// C-TEXT-CONTROL-SELECTION-0001: independent generated host realization.
// These are actual framework consumers in Happy DOM, not OS IME or browser paint evidence.
for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    for (const controlled of [false, true])
      it(`observes selection independently of ${controlled ? 'controlled' : 'uncontrolled'} value and retires its lease`, async () => {
        const owner = await mountNativeOwner(source(controlled), profile);
        cleanup.push(owner.dispose);
        await owner.flush();
        const editor = () =>
          (owner.host.firstElementChild?.shadowRoot ?? owner.host).querySelector('textarea')!;
        const target = editor();
        const api = owner.handle.getExposes();
        await owner.act(() => {
          target.focus();
          target.setSelectionRange(1, 3, 'backward');
          target.dispatchEvent(new Event('select'));
        });
        expect(api.read()).toEqual({
          value: 'abcd',
          composing: false,
          selection: { start: 1, end: 3, direction: 'backward' },
        });
        expect(api.start.get()).toBe(1);
        expect(Object.isFrozen(api.read().selection)).toBe(true);
        const count = api.notifications.get();
        await owner.act(() => target.dispatchEvent(new Event('selectionchange')));
        expect(api.notifications.get()).toBe(count);

        await owner.act(() => {
          target.value = 'changed';
          target.setSelectionRange(2, 5, 'forward');
          // The physical edit has not been accepted into the owner value.
          expect(api.read().selection).toBeNull();
          target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        });
        expect(api.inputStart.get()).toBe(2);
        expect(api.read()).toEqual({
          value: controlled ? 'abcd' : 'changed',
          composing: false,
          selection: { start: 2, end: controlled ? 4 : 5, direction: 'forward' },
        });
        expect(target.value).toBe(controlled ? 'abcd' : 'changed');

        const beforeDetach = api.notifications.get();
        await owner.setProps({ value: 'abcd', present: false });
        expect(api.read().selection).toBeNull();
        target.dispatchEvent(new Event('select'));
        document.dispatchEvent(new Event('selectionchange'));
        await owner.flush();
        expect(api.notifications.get()).toBe(beforeDetach);
        await owner.setProps({ value: 'abcd', present: true });
        await owner.act(() => {
          editor().setSelectionRange(0, 0, 'none');
          editor().dispatchEvent(new Event('select'));
        });
        expect(api.start.get()).toBe(0);
        expect(api.read().selection).toEqual({ start: 0, end: 0, direction: 'none' });

        // Unsupported host facts do not turn into a plausible end caret.
        Object.defineProperty(editor(), 'selectionStart', {
          configurable: true,
          get() {
            throw new Error('unsupported selection');
          },
        });
        expect(api.read().selection).toBeNull();
        await owner.act(() => editor().dispatchEvent(new Event('select')));
        expect(api.start.get()).toBe(-1);
        await owner.dispose();
        expect(() => api.read()).toThrow(/disposed|alive|terminal/i);
      }, 30_000);
  });
