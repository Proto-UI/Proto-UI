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
const rawWatchDomProfiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'web-component-source-v1',
] as const;
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it.each(rawWatchDomProfiles)(
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
    expect(warning).toHaveBeenCalledWith(
      '[Props] raw watchers are an adapter-snapshot escape hatch; avoid in official prototypes.'
    );
    expect(exposed.aligned()).toBe(true);
    expect(exposed.provided()).toBe(true);
    expect(exposed.resolvedCalls()).toBe(0);
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
    // Preserve React's existing disposer-phase boundary. Cross-target runtime
    // cleanup is the separate draft C-CORE-SYNTAX-0007 question, not a raw-diff
    // guarantee established by C-PROPS-0012.
    if (profile === 'react-dom-source-v1') expect(() => exposed.cancel()).toThrow(/phase|setup/i);
    await owner.setProps({ value: 2, other: 1, extra: 3 });
    expect(exposed.calls()).toBe(6);
    await owner.setProps({ other: 1, extra: 3 });
    expect(exposed.calls()).toBe(7);
    expect(exposed.provided()).toBe(false);
    expect(exposed.resolvedCalls()).toBe(2);
    expect(exposed.cancelledCalls()).toBe(0);
    await owner.dispose();
    expect(() => exposed.calls()).toThrow(/dispos|alive|terminal/i);
  },
  30_000
);

it('stops the raw and resolved batch when a Web Component raw notification disposes its owner', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const terminal = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'raw-watch-terminal',setup(def){
      def.props.define({value:{type:'number',default:0}});
      def.expose.event('rawTick',{payload:'void'});
      def.expose.event('keyedTick',{payload:'void'});
      def.expose.event('resolvedTick',{payload:'void'});
      def.expose.method('value',()=>1);
      def.props.watch(['value'],(run)=>{run.expose.emit('resolvedTick');});
      def.props.watchRaw(['value'],(run)=>{run.expose.emit('keyedTick');});
      def.props.watchRawAll((run)=>{run.expose.emit('rawTick');});
      return r=>r.el('output','terminal');
    }});`;
  const owner = await mountNativeOwner(terminal, 'web-component-source-v1', {
    props: { value: 1 },
  });
  cleanups.push(owner.dispose);
  const element = owner.handle as typeof owner.handle & HTMLElement & { dispose(): void };
  const exposed = owner.handle.getExposes();
  const events: string[] = [];
  element.addEventListener('rawTick', () => {
    events.push('raw');
    element.dispose();
  });
  element.addEventListener('keyedTick', () => events.push('keyed'));
  element.addEventListener('resolvedTick', () => events.push('resolved'));
  await expect(owner.setProps({ value: 2 })).resolves.toBeUndefined();
  expect(events).toEqual(['raw']);
  expect(() => exposed.value()).toThrow(/dispos|alive|terminal/i);
}, 30_000);

// C-PROPS-0012-F..K governs the observer semantics. Target admission remains
// explicit: Vue2 still defers raw observers; the other native profiles admit
// both forms. Admission alone is separate from the executed DOM owners above.
it.each([...rawWatchDomProfiles, 'gpui-source-v1'] as const)(
  'admits keyed and all-key raw watches for %s',
  (profile) => {
    // String(array) is an independent GPUI subset boundary. Keep this probe
    // about observer registration rather than conflating those two operations.
    const registration = source.replace(
      'matched=String(info.changedKeysMatched);all=String(info.changedKeysAll);',
      "matched='';all='';"
    );
    expect(compilePrototype(registration, { profile })).toMatchObject({ ok: true });
    expect(
      compilePrototype(
        registration.replace(
          "def.props.watchRaw(['value','extra'],()=>{cancelledCalls++;})",
          'def.props.watchRawAll(()=>{cancelledCalls++;})'
        ),
        { profile }
      )
    ).toMatchObject({ ok: true });
  }
);

it('keeps the GPUI scalar String conversion boundary independent from raw-watch admission', () => {
  expect(compilePrototype(source, { profile: 'gpui-source-v1' })).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: 'PUI4003',
        message: 'GPUI String conversion requires a checked scalar operand.',
      }),
    ]),
  });
});

it.each(["def.props.watchRaw(['value','extra'],()=>{})", 'def.props.watchRawAll(()=>{})'])(
  'retains Vue2 deferred admission for %s',
  (registration) => {
    const deferred = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'raw-deferred',setup(def){
      ${registration}; return r=>r.el('output','raw');
    }});`;
    expect(compilePrototype(deferred, { profile: 'vue2-source-v1' })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'PUI4003' })]),
    });
  }
);

it.each([...rawWatchDomProfiles, 'gpui-source-v1'] as const)(
  'rejects an empty raw watch key list for %s',
  (profile) => {
    const registration = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'raw-key-boundary',setup(def){
        def.props.watchRaw(['value'],()=>{}); return r=>r.el('output','raw');
      }});`;
    expect(compilePrototype(registration, { profile })).toMatchObject({ ok: true });
    expect(compilePrototype(registration.replace("['value']", '[]'), { profile })).toMatchObject({
      ok: false,
    });
  }
);

it.each(rawWatchDomProfiles)(
  'orders raw-all, keyed and resolved diffs in a real generated %s owner',
  async (profile) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ordered = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'raw-watch-order',setup(def){
      def.props.define({value:{type:'number',default:0}});
      let order=''; let matched=''; let changed='';
      def.props.watch(['value'],()=>{order+='D';});
      def.props.watchRaw(['value'],()=>{order+='K';});
      def.props.watchRawAll((run,next,previous,info)=>{
        order+='A'; matched=String(info.changedKeysMatched); changed=String(info.changedKeysAll);
      });
      def.expose.method('order',()=>order);
      def.expose.method('matched',()=>matched);
      def.expose.method('changed',()=>changed);
      return r=>r.el('output','ordered');
    }});`;
    const owner = await mountNativeOwner(ordered, profile, { props: { value: 1 } });
    cleanups.push(owner.dispose);
    const exposed = owner.handle.getExposes();
    expect(exposed.order()).toBe('');
    await owner.setProps({ value: 1 });
    expect(exposed.order()).toBe('');
    await owner.setProps({ value: 1, extra: 'new' });
    expect(exposed.order()).toBe('A');
    expect(exposed.matched()).toBe('extra');
    expect(exposed.changed()).toBe('extra');
    await owner.setProps({ value: 2, extra: 'new' });
    expect(exposed.order()).toBe('AAKD');
    expect(exposed.matched()).toBe('value');
    expect(exposed.changed()).toBe('value');
    await owner.setProps({ value: 2 });
    expect(exposed.order()).toBe('AAKDA');
    expect(exposed.matched()).toBe('extra');
    expect(exposed.changed()).toBe('extra');
  },
  30_000
);
