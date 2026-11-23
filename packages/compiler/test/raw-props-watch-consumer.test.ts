// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { mountNativeOwner, type NativeOwnerHandle } from './native-owner-consumer';

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

type RawPolicyElement = HTMLElement &
  NativeOwnerHandle & {
    setProps(props: Record<string, unknown>): void;
    dispose(): void;
    readonly logicalOwner: symbol | null;
  };
const propsPolicies = ['explicit', 'host'] as const;
let rawPolicySequence = 0;

async function mountWebRawOwner(
  prototypeSource: string,
  policy: (typeof propsPolicies)[number],
  props: Record<string, unknown>
) {
  const profile = 'web-component-source-v1';
  const compiled = compilePrototype(prototypeSource, {
    profile: { profile, propsUpdatePolicy: policy },
  });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(directory, { recursive: true });
  const temporary = await mkdtemp(path.join(directory, 'raw-policy-'));
  const host = document.createElement('div');
  const elements: RawPolicyElement[] = [];
  cleanups.push(async () => {
    try {
      for (const element of elements) element.dispose();
    } finally {
      host.remove();
      await rm(temporary, { recursive: true, force: true });
    }
  });
  const output = path.join(temporary, 'output');
  const written = await writeCompilation(compiled.value, output);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const generated = await import(
    /* @vite-ignore */ path.join(output, generatedSourcePath(profile))
  );
  const tag = 'x-raw-policy-owner-' + ++rawPolicySequence;
  generated.register(tag);
  document.body.append(host);
  const create = (next: Record<string, unknown>) => {
    const element = document.createElement(tag) as RawPolicyElement;
    elements.push(element);
    element.setProps(next);
    host.append(element);
    return element;
  };
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  const element = create(props);
  await flush();
  return {
    host,
    element,
    create,
    flush,
    async setProps(next: Record<string, unknown>) {
      element.setProps(next);
      await flush();
    },
  };
}

const policySource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'raw-policy-lifecycle',setup(def){
  def.props.define({value:{type:'number',default:0}});
  const value=def.state.numberDiscrete('value',0);let updates=0;
  def.expose.event('rawTick',{payload:'void'});
  def.expose.event('keyedTick',{payload:'void'});
  def.expose.event('resolvedTick',{payload:'void'});
  def.expose.method('value',()=>value.get());
  def.expose.method('updates',()=>updates);
  def.lifecycle.onCreated(run=>{value.set(run.props.get().value ?? 0);});
  def.lifecycle.onUpdated(()=>{updates++;});
  def.props.watch(['value'],(run,next)=>{
    value.set(next.value ?? 0);run.expose.emit('resolvedTick');
  });
  def.props.watchRaw(['value'],run=>{run.expose.emit('keyedTick');});
  def.props.watchRawAll(run=>{run.expose.emit('rawTick');});
  return r=>r.el('output',String(value.get()));
}});`;

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

it.each(nativeOwnerProfiles)(
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
    expect(exposed.aligned()).toBe(true);
    expect(exposed.provided()).toBe(true);
    expect(exposed.resolvedCalls()).toBe(0);
    expect(warning).toHaveBeenCalled();
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
    expect(exposed.cancelledCalls()).toBe(0);
    // Props watcher disposers are ordinary void callables, not setup authorities.
    // Preserve the original runtime call as a stronger cancellation assertion.
    exposed.cancel();
    exposed.cancel();
    await owner.setProps({ value: 3, extra: 4 });
    expect(exposed.calls()).toBe(7);
    expect(exposed.resolvedCalls()).toBeGreaterThan(1);
    expect(exposed.resolvedCalls()).toBe(2);
    expect(exposed.cancelledCalls()).toBe(0);
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
it.each(propsPolicies)(
  'stops the raw and resolved batch when a %s Web Component raw notification disposes its owner',
  async (policy) => {
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
    const owner = await mountWebRawOwner(terminal, policy, { value: 1 });
    const element = owner.element;
    const exposed = element.getExposes();
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
  },
  30_000
);

it.each(propsPolicies)(
  'preserves normal %s Web Component props updates after raw delivery',
  async (policy) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountWebRawOwner(policySource, policy, { value: 1 });
    const exposed = owner.element.getExposes();
    const events: string[] = [];
    owner.element.addEventListener('rawTick', () => events.push('raw'));
    owner.element.addEventListener('keyedTick', () => events.push('keyed'));
    owner.element.addEventListener('resolvedTick', () => events.push('resolved'));
    expect((owner.element.shadowRoot ?? owner.element).querySelector('output')?.textContent).toBe(
      '1'
    );
    expect(exposed.updates()).toBe(0);
    await owner.setProps({ value: 2 });
    expect(events).toEqual(['raw', 'keyed', 'resolved']);
    expect(exposed.value()).toBe(2);
    expect((owner.element.shadowRoot ?? owner.element).querySelector('output')?.textContent).toBe(
      policy === 'host' ? '2' : '1'
    );
    expect(exposed.updates()).toBe(policy === 'host' ? 1 : 0);
    if (policy === 'explicit') {
      owner.element.update();
      await owner.flush();
    }
    expect((owner.element.shadowRoot ?? owner.element).querySelector('output')?.textContent).toBe(
      '2'
    );
    expect(exposed.updates()).toBe(1);
    await owner.setProps({ value: 2 });
    expect(exposed.updates()).toBe(1);
  },
  30_000
);

it.each(propsPolicies)(
  'keeps a synchronously retired %s owner closed while a replacement mounts',
  async (policy) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountWebRawOwner(policySource, policy, { value: 1 });
    const retired = owner.element.getExposes();
    const identity = owner.element.logicalOwner;
    const replacements: RawPolicyElement[] = [];
    owner.element.addEventListener(
      'rawTick',
      () => {
        owner.element.dispose();
        owner.element.remove();
        owner.host.append(owner.element);
        replacements.push(owner.create({ value: 7 }));
      },
      { once: true }
    );
    await expect(owner.setProps({ value: 2 })).resolves.toBeUndefined();
    expect(owner.element.logicalOwner).toBeNull();
    expect(owner.element.getExposes()).toEqual({});
    expect(() => retired.value()).toThrow(/dispos|alive|terminal/i);
    expect(() => owner.element.setProps({ value: 3 })).toThrow(/dispos/i);
    expect(replacements).toHaveLength(1);
    const replacement = replacements[0]!;
    expect(replacement.logicalOwner).not.toBeNull();
    expect(replacement.logicalOwner).not.toBe(identity);
    const exposed = replacement.getExposes();
    expect(exposed.value()).toBe(7);
    expect(exposed.updates()).toBe(0);
    expect((replacement.shadowRoot ?? replacement).querySelector('output')?.textContent).toBe('7');
    replacement.setProps({ value: 8 });
    await owner.flush();
    expect(exposed.value()).toBe(8);
    expect(exposed.updates()).toBe(policy === 'host' ? 1 : 0);
    expect((replacement.shadowRoot ?? replacement).querySelector('output')?.textContent).toBe(
      policy === 'host' ? '8' : '7'
    );
  },
  30_000
);

it.each(propsPolicies)(
  'binds later %s props updates to the new owner after settled reconnection',
  async (policy) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountWebRawOwner(policySource, policy, { value: 1 });
    const retired = owner.element.getExposes();
    const identity = owner.element.logicalOwner;
    owner.element.remove();
    await owner.flush();
    expect(owner.element.logicalOwner).toBeNull();
    expect(() => retired.value()).toThrow(/dispos|alive|terminal/i);
    owner.host.append(owner.element);
    await owner.flush();
    expect(owner.element.logicalOwner).not.toBeNull();
    expect(owner.element.logicalOwner).not.toBe(identity);
    const exposed = owner.element.getExposes();
    expect(exposed.value()).toBe(1);
    expect(exposed.updates()).toBe(0);
    await owner.setProps({ value: 2 });
    expect(exposed.value()).toBe(2);
    expect((owner.element.shadowRoot ?? owner.element).querySelector('output')?.textContent).toBe(
      policy === 'host' ? '2' : '1'
    );
    expect(exposed.updates()).toBe(policy === 'host' ? 1 : 0);
  },
  30_000
);

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
  expect(
    compilePrototype(
      source.replace(
        "def.props.watchRaw(['value','extra'],()=>{cancelledCalls++;})",
        'def.props.watchRawAll(()=>{cancelledCalls++;})'
      ),
      { profile: 'vue2-source-v1' }
    )
  ).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'PUI4003' })]),
  });
  expect(
    compilePrototype(source.replace("['value','extra']", '[]'), { profile: 'react-dom-source-v1' })
  ).toMatchObject({ ok: false });
});
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
