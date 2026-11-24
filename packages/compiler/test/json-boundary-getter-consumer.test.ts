// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

// The ordinary source keeps an unsafe backing record local, copies only its
// safe scalar field, and then performs real getter reads before publication.
const source = `import {definePrototype,type RunHandle} from '@proto.ui/core';
export default definePrototype({name:'json-getter-owner',setup(def){
  const backing={value:'safe',hidden:undefined};
  const view:Readonly<{value:string}>=backing;
  let current:RunHandle|null=null;
  let reads=0;
  let order='';
  def.expose.event('changed',{payload:'json'});
  def.lifecycle.onMounted(run=>{current=run;});
  def.lifecycle.onBeforeDispose(()=>{current=null;});
  def.expose.method('reads',()=>reads);
  def.expose.method('order',()=>order);
  def.expose.method('publish',()=>{
    const run=current;
    if(!run)throw new Error('owner is not mounted');
    const input={
      get second(){reads++;order=order+'b';return view.value;},
      get '1'(){reads++;order=order+'1';return 1;},
    };
    const copied={...input,second:'override'};
    const assigned=Object.assign({}, {get label(){reads++;order=order+'a';return view.value;}});
    const snapshot={...copied,...assigned};
    run.expose.emit('changed',snapshot);
    return snapshot;
  });
  return r=>r.el('output','finite getter snapshot');
}});`;

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

it.each(nativeOwnerProfiles)(
  '%s publishes the real finite getter copy without transporting its backing record',
  async (profile) => {
    const events: unknown[] = [];
    const observe = (value: unknown) => events.push(value);
    const owner = await mountNativeOwner(source, profile, {
      ...(profile === 'react-dom-source-v1' || profile === 'vue-source-v1'
        ? { props: { onChanged: observe } }
        : {}),
    });
    cleanup.push(owner.dispose);
    if (profile === 'vue2-source-v1')
      (
        owner.handle as typeof owner.handle & { $on(name: string, listener: typeof observe): void }
      ).$on('changed', observe);
    if (profile === 'web-component-source-v1')
      owner.host.firstElementChild!.addEventListener('changed', (event) =>
        observe((event as CustomEvent).detail)
      );

    const api = owner.handle.getExposes();
    expect(api.reads()).toBe(0);
    const expected = { '1': 1, second: 'override', label: 'safe' };
    expect(await owner.act(() => api.publish())).toEqual(expected);
    expect(api.reads()).toBe(3);
    expect(api.order()).toBe('1ba');
    expect(events).toEqual([expected]);
    expect(Object.keys(events[0] as object)).toEqual(['1', 'second', 'label']);
    expect(await owner.act(() => api.publish())).toEqual(expected);
    expect(api.reads()).toBe(6);
    expect(api.order()).toBe('1ba1ba');
    expect(events).toEqual([expected, expected]);
    const retained = api.publish;
    await owner.dispose();
    expect(() => retained()).toThrow(/dispos|alive|terminal/i);
    expect(events).toHaveLength(2);
  }
);
