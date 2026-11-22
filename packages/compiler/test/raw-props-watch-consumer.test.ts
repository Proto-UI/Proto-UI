// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner } from './native-owner-consumer';

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

it('dispatches keyed raw snapshot diffs through a real generated React owner', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const owner = await mountNativeOwner(source, 'react-dom-source-v1', { props: { value: 1 } });
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
  expect(() => exposed.cancel()).toThrow(/phase|setup/i);
  await owner.setProps({ value: 2, other: 1, extra: 3 });
  expect(exposed.calls()).toBe(6);
  await owner.setProps({ other: 1, extra: 3 });
  expect(exposed.calls()).toBe(7);
  expect(exposed.provided()).toBe(false);
  expect(exposed.cancelledCalls()).toBe(0);
  await owner.dispose();
  expect(() => exposed.calls()).toThrow(/dispos|alive|terminal/i);
}, 30_000);

it('checks the implemented raw-watch targets and retains source admission boundaries', () => {
  for (const profile of [
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'gpui-source-v1',
  ]) {
    const compiled = compilePrototype(source, { profile });
    // These are source-admission checks. The generated React owner above
    // separately exercises runtime ordering, cancellation, and disposal.
    if (profile === 'vue-source-v1' || profile === 'web-component-source-v1') {
      expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.diagnostics)).toBe(true);
    } else {
      expect(compiled).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'PUI4003' })]),
      });
    }
  }
  expect(
    compilePrototype(
      source.replace(
        "def.props.watchRaw(['value','extra'],()=>{cancelledCalls++;})",
        'def.props.watchRawAll(()=>{cancelledCalls++;})'
      ),
      { profile: 'react-dom-source-v1' }
    )
  ).toMatchObject({ ok: true });
  expect(
    compilePrototype(source.replace("['value','extra']", '[]'), { profile: 'react-dom-source-v1' })
  ).toMatchObject({ ok: false });
});
