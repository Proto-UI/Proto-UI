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
    def.props.define({value:{type:'string',default:'abcd'},present:{type:'boolean',default:true},accept:{type:'boolean',default:false},detachOnSelection:{type:'boolean',default:false}});
    const editor=asTextControl();
    const start=def.state.numberDiscrete('start',-1);
    const inputStart=def.state.numberDiscrete('inputStart',-1);
    const notifications=def.state.numberDiscrete('notifications',0);
    const afterSelection=def.state.numberDiscrete('afterSelection',0);
    def.expose.state('start',start);def.expose.state('inputStart',inputStart);
    def.expose.state('notifications',notifications);
    def.expose.state('afterSelection',afterSelection);
    def.expose.method('read',()=>editor.snapshot());
    def.expose.method('resyncOwner',()=>editor.sync({value:editor.snapshot()?.value ?? ''}));
    editor.on('selectionchange',(run,event)=>{
      start.set(event.selection?.start ?? -1);
      notifications.set(notifications.get()+1);
      editor.sync({placeholder:'hint',defaultValue:'later-default'});
      if(run.props.get().detachOnSelection)run.lifecycle.setPresent(false);
    });
    editor.on('selectionchange',()=>afterSelection.set(afterSelection.get()+1));
    editor.on('input',(run,event)=>{inputStart.set(event.selection?.start ?? -1);if(run.props.get().accept)editor.sync({value:event.value});});
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
        await owner.act(() => {
          target.value = 'unreported candidate';
          api.resyncOwner();
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
        expect(editor().value).toBe(controlled ? 'abcd' : 'changed');
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

    it('accepts explicit owner values, accepts uncontrolled change, and retires an in-flight selection callback', async () => {
      const owner = await mountNativeOwner(source(true), profile, { props: { accept: true } });
      cleanup.push(owner.dispose);
      await owner.flush();
      const api = owner.handle.getExposes();
      const editor = () =>
        (owner.host.firstElementChild?.shadowRoot ?? owner.host).querySelector('textarea')!;
      await owner.act(() => {
        editor().value = 'accepted';
        editor().setSelectionRange(3, 6, 'backward');
        editor().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      });
      expect(api.read()).toEqual({
        value: 'accepted',
        composing: false,
        selection: { start: 3, end: 6, direction: 'backward' },
      });
      await owner.setProps({ value: 'owner', accept: true });
      expect(editor().value).toBe('owner');
      expect(api.read().selection).toEqual({ start: 3, end: 5, direction: 'backward' });
      await owner.setProps({ value: 'owner', detachOnSelection: true });
      const after = api.afterSelection.get();
      const retired = editor();
      await owner.act(() => {
        retired.setSelectionRange(1, 1);
        retired.dispatchEvent(new Event('select'));
      });
      expect(api.afterSelection.get()).toBe(after);
      expect(api.read().selection).toBeNull();
      await owner.setProps({ value: 'owner', present: false });
      await owner.setProps({ value: 'owner', present: true });
      expect(editor().value).toBe('owner');
      const count = api.notifications.get();
      retired.dispatchEvent(new Event('selectionchange'));
      await owner.flush();
      expect(api.notifications.get()).toBe(count);
      await owner.dispose();

      const uncontrolled = await mountNativeOwner(source(false), profile);
      cleanup.push(uncontrolled.dispose);
      await uncontrolled.flush();
      const native = (
        uncontrolled.host.firstElementChild?.shadowRoot ?? uncontrolled.host
      ).querySelector('textarea')!;
      await uncontrolled.act(() => {
        native.value = 'change-only';
        native.setSelectionRange(2, 8, 'forward');
        native.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(uncontrolled.handle.getExposes().read()).toEqual({
        value: 'change-only',
        composing: false,
        selection: { start: 2, end: 8, direction: 'forward' },
      });
    }, 30_000);
  });
