// @vitest-environment happy-dom
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function transitionGraph() {
  const files: Record<string, string> = {};
  for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts'])
    files[`transition/${name}`] = await readFile(
      `packages/prototypes/base/src/transition/${name}`,
      'utf8'
    );
  return files;
}

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('runs the unchanged authored Transition through ordinary native imports and owner lifetimes', async () => {
      const files = await transitionGraph();
      const source = `import {definePrototype} from '@proto.ui/core';
import {asTransition as install} from './transition/as-transition.proto';
export default definePrototype({name:'ordinary-transition-owner',setup(def){
  const transition=install();
  transition.configure({enterDuration:10,leaveDuration:7});
  return r=>r.el('section',[transition.transitionState.get(),r.slot()]);
}});`;
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const owner = await mountNativeOwner(source, profile, {
        compile: { fileName: 'entry.proto.ts', files },
      });
      cleanups.push(owner.dispose);
      const exposed = owner.handle.getExposes();
      const renderedRoot = () =>
        (owner.host.firstElementChild?.shadowRoot ?? owner.host).querySelector('section');
      expect(exposed.transitionState.get()).toBe('closed');
      expect(exposed.isPresent.get()).toBe(false);
      expect(renderedRoot()).toBeNull();
      const phases: string[] = [];
      exposed.transitionState.subscribe((event: { type: string; next: string }) => {
        if (event.type === 'next') phases.push(event.next);
      });
      const controls = exposed.controls;
      const transitionState = exposed.transitionState;
      await owner.act(() => controls.enter());
      expect(exposed.transitionState.get()).toBe('entering');
      expect(exposed.isPresent.get()).toBe(true);
      expect(renderedRoot()).not.toBeNull();
      if (owner.host.firstElementChild?.shadowRoot)
        expect(renderedRoot()?.querySelector('slot')?.assignedNodes()[0]?.textContent).toBe(
          'native-child'
        );
      else expect(renderedRoot()?.querySelector('b')?.textContent).toBe('native-child');
      await owner.act(() => vi.advanceTimersByTime(9));
      expect(exposed.transitionState.get()).toBe('entering');
      await owner.act(() => vi.advanceTimersByTime(1));
      expect(exposed.transitionState.get()).toBe('entered');
      await owner.act(() => controls.leave());
      expect(exposed.transitionState.get()).toBe('leaving');
      expect(renderedRoot()).not.toBeNull();
      await owner.act(() => vi.advanceTimersByTime(7));
      expect(exposed.transitionState.get()).toBe('closed');
      expect(renderedRoot()).toBeNull();
      expect(phases).toEqual(['entering', 'entered', 'leaving', 'closed']);
      const firstOwner = exposed.getPresentationOwner();
      expect(exposed.getPresentationOwner()).toBe(firstOwner);
      expect(() => exposed.configurePresentation({ enterDuration: 12 })).toThrow();
      await owner.act(() => controls.enter());
      expect(renderedRoot()).not.toBeNull();
      await owner.dispose();
      expect(() => controls.enter()).toThrow(/dispos|alive|terminal/i);
      expect(() => transitionState.get()).toThrow(/dispos|alive|terminal/i);
      await vi.advanceTimersByTimeAsync(20);
    }, 30_000);

    it('preserves closure captures, record alias identity, lazy optional calls and default arguments', async () => {
      const owner = await mountNativeOwner(
        `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'ordinary-values',setup(def){
  const record={count:0}; const alias=record;
  const add=(amount:number=2)=>{alias.count=alias.count+amount;return record.count;};
  const later=()=>after;
  const after=41;
  const absent:((value:number)=>number)|null=null;
  def.expose.method('add',add);
  def.expose.method('readLater',later);
  def.expose.method('skip',()=>{absent?.(add(100));return record.count;});
  const actions={next:(amount:number)=>add(amount)};
  def.expose.value('actions',actions);
  return r=>r.el('output',[r.slot()]);
}});`,
        profile
      );
      cleanups.push(owner.dispose);
      const exposed = owner.handle.getExposes();
      expect(exposed.add()).toBe(2);
      expect(exposed.add(undefined)).toBe(4);
      expect(exposed.skip()).toBe(4);
      expect(exposed.actions.next(3)).toBe(7);
      expect(exposed.readLater()).toBe(41);
      const actions = exposed.actions;
      await owner.dispose();
      expect(() => actions.next(1)).toThrow(/dispos|alive|terminal/i);
    }, 30_000);
  });
