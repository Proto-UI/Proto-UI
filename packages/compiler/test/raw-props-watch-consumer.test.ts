// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'raw-watch-owner',setup(def){
  def.props.define({value:{type:'number',default:0}});
  let calls=0;let cancelledCalls=0;let resolvedCalls=0;
  let order='';let matched='';let all='';let aligned=false;let provided=false;
  def.props.watch(['value'],()=>{resolvedCalls++;order+='D';});
  const cancelled=def.props.watchRaw(['value','extra'],()=>{cancelledCalls++;});
  cancelled();
  const stop=def.props.watchRaw(['value','extra'],(run,next,previous,info)=>{
    calls++;order+='R';
    matched=String(info.changedKeysMatched);all=String(info.changedKeysAll);
    aligned=run.props.getRaw()===next;provided=run.props.isProvided('value');
  });
  def.expose.method('calls',()=>calls);
  def.expose.method('cancelledCalls',()=>cancelledCalls);
  def.expose.method('resolvedCalls',()=>resolvedCalls);
  def.expose.method('order',()=>order);
  def.expose.method('matched',()=>matched);
  def.expose.method('all',()=>all);
  def.expose.method('aligned',()=>aligned);
  def.expose.method('provided',()=>provided);
  def.expose.method('cancel',()=>stop());
  return r=>r.el('output','raw');
}});`;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it.each(nativeOwnerProfiles)(
  'dispatches keyed raw snapshot diffs through a real generated %s owner',
  async (profile) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountNativeOwner(source, profile, { props: { value: 1 } });
    cleanups.push(owner.dispose);
    const exposed = owner.handle.getExposes();
    expect(exposed.calls()).toBe(0);
    await owner.setProps({ value: 1, other: 1 });
    await owner.setProps({ value: 1, other: 1, extra: undefined });
    await owner.setProps({ value: 1, other: 1 });
    expect(exposed.calls()).toBe(0);
    await owner.setProps({ value: 1, other: 1, extra: NaN });
    expect(exposed.calls()).toBe(1);
    expect(exposed.matched()).toBe('extra');
    expect(exposed.all()).toBe('extra');
    expect(exposed.aligned()).toBe(true);
    expect(exposed.provided()).toBe(true);
    expect(exposed.resolvedCalls()).toBe(0);
    expect(warning).toHaveBeenCalled();
    await owner.setProps({ value: 1, other: 1, extra: NaN });
    expect(exposed.calls()).toBe(1);
    await owner.setProps({ value: 1, other: 1, extra: -0 });
    await owner.setProps({ value: 1, other: 1, extra: 0 });
    expect(exposed.calls()).toBe(3);
    await owner.setProps({ value: 2, other: 1, extra: 0 });
    expect(exposed.calls()).toBe(4);
    expect(exposed.resolvedCalls()).toBe(1);
    expect(exposed.order()).toBe('RRRRD');
    await owner.setProps({ value: 2, other: 1 });
    expect(exposed.calls()).toBe(5);
    expect(exposed.provided()).toBe(true);
    await owner.setProps({ value: 2, other: 1, extra: 3 });
    expect(exposed.calls()).toBe(6);
    await owner.setProps({ other: 1, extra: 3 });
    expect(exposed.calls()).toBe(7);
    expect(exposed.provided()).toBe(false);
    expect(exposed.cancelledCalls()).toBe(0);
    // Props watcher disposers are ordinary void callables, not setup authorities.
    // Preserve the original runtime call as a stronger cancellation assertion.
    exposed.cancel();
    exposed.cancel();
    await owner.setProps({ value: 3, extra: 4 });
    expect(exposed.calls()).toBe(7);
    expect(exposed.resolvedCalls()).toBeGreaterThan(1);
    await owner.dispose();
    expect(() => exposed.calls()).toThrow(/dispos|alive|terminal/i);
  },
  30_000
);

it('retains target and source admission boundaries outside the accepted keyed raw-watch consumers', () => {
  // This complete fixture still needs String coercion, unsupported by GPUI.
  // The old Vue/WC negative rows predated their actual keyed-raw admission;
  // their behavior is now exercised above instead of treating acceptance as failure.
  for (const profile of ['gpui-source-v1']) {
    expect(compilePrototype(source, { profile })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'PUI4003' })]),
    });
  }
  expect(
    compilePrototype(
      source.replace(
        "def.props.watchRaw(['value','extra'],()=>{cancelledCalls++;})",
        'def.props.watchRawAll(()=>{cancelledCalls++;})'
      ),
      { profile: 'vue2-source-v1' }
    )
  ).toMatchObject({ ok: true });
  expect(
    compilePrototype(source.replace("['value','extra']", '[]'), { profile: 'react-dom-source-v1' })
  ).toMatchObject({ ok: false });
});
