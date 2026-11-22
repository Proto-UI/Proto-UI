// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { compilePrototype } from '../src/compile';
import { nativeRulePreferenceArtifact } from '../src/native-async';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
});

function media() {
  const values = new Map<string, boolean>();
  const records = new Map<string, { listeners: Set<EventListener>; query: MediaQueryList }>();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    let record = records.get(query);
    if (!record) {
      const listeners = new Set<EventListener>();
      const result = {
        media: query,
        get matches() {
          return values.get(query) ?? false;
        },
        addEventListener(_type: string, listener: EventListener) {
          listeners.add(listener);
        },
        removeEventListener(_type: string, listener: EventListener) {
          listeners.delete(listener);
        },
      } as unknown as MediaQueryList;
      record = { listeners, query: result };
      records.set(query, record);
    }
    return record.query;
  });
  return {
    change(next: Record<string, boolean>) {
      for (const [key, value] of Object.entries(next)) values.set(key, value);
      for (const [key] of Object.entries(next))
        for (const listener of [...(records.get(key)?.listeners ?? [])])
          listener(new Event('change'));
    },
    live: () => [...records.values()].reduce((sum, item) => sum + item.listeners.size, 0),
    callbacks: () => [...records.values()].flatMap((record) => [...record.listeners]),
  };
}
const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'environment-rule-consumer',setup(def){
  def.props.define({present:{type:'boolean',default:true},active:{type:'boolean',default:false}});
  const updates=def.state.numberDiscrete('updates',0),watches=def.state.numberDiscrete('watches',0);
  def.expose.state('updates',updates);def.expose.state('watches',watches);
  def.lifecycle.onUpdated(()=>updates.set(updates.get()+1));
  def.props.watch(['active','present'],()=>watches.set(watches.get()+1));
  def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present));
  def.feedback.style.use(tw('bg-white','transition-none'));
  def.rule({when:w=>w.meta('colorScheme').eq('dark'),intent:i=>i.feedback.style.use(tw('bg-black'))});
  def.rule({when:w=>w.prop('active').eq(true),intent:i=>i.feedback.style.use(tw('bg-red'))});
  def.rule({when:w=>w.meta('preference.reducedMotion').eq('no-preference'),intent:i=>i.feedback.style.use(tw('transition-all'))});
  return r=>r.el('span','stable');
}});`;

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('refreshes only the style owner from live theme/preference facts and retires every lease', async () => {
      const host = media();
      document.documentElement.dataset.theme = 'light';
      host.change({ '(prefers-reduced-motion: no-preference)': true });
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const root = () =>
        (profile === 'web-component-source-v1'
          ? owner.host.firstElementChild
          : owner.host.querySelector('[data-pui-root]'))!;
      const tokens = () => new Set(root().getAttribute('data-pui-style')?.split(' '));
      await owner.flush();
      expect(tokens()).toEqual(new Set(['bg-white', 'transition-all']));
      expect(host.live()).toBe(3); // exactly one color-scheme query and the reached two-value preference.
      const element = root(),
        api = owner.handle.getExposes();
      const counters = [api.updates.get(), api.watches.get()];
      document.documentElement.dataset.theme = 'dark';
      await window.happyDOM.whenAsyncComplete();
      await owner.flush();
      expect(tokens()).toEqual(new Set(['bg-black', 'transition-all']));
      expect(root()).toBe(element);
      expect([api.updates.get(), api.watches.get()]).toEqual(counters);
      await owner.setProps({ active: true });
      document.documentElement.dataset.theme = 'light';
      await window.happyDOM.whenAsyncComplete();
      await owner.flush();
      expect(tokens().has('bg-red')).toBe(true);
      host.change({
        '(prefers-reduced-motion: no-preference)': false,
        '(prefers-reduced-motion: reduce)': true,
      });
      await owner.flush();
      await owner.flush();
      expect(tokens().has('transition-none')).toBe(true);
      const stale = host.callbacks();
      await owner.setProps({ present: false });
      expect(host.live()).toBe(0);
      for (const callback of stale) callback(new Event('change'));
      await owner.flush();
      host.change({ '(prefers-reduced-motion: reduce)': false });
      await owner.setProps({ present: true });
      expect(tokens().has('transition-none')).toBe(true); // unknown never enables motion.
      expect(host.live()).toBe(3);
      await owner.dispose();
      expect(host.live()).toBe(0);
    });
  });

it('requires an active getter/source pair and shares only successfully acquired preference leases', async () => {
  const js = ts.transpileModule(nativeRulePreferenceArtifact.contents, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const { readNativeRulePreference: read, subscribeNativeRulePreferences: subscribe } =
    await import(
      /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
    );
  const key = 'preference.reducedMotion';
  const host = media();
  host.change({ '(prefers-reduced-motion: no-preference)': true });
  expect(read(document, key)).toBe('unknown');
  const first = vi.fn(),
    second = vi.fn();
  const releaseA = subscribe(document, [key], first),
    releaseB = subscribe(document, [key], second);
  expect(host.live()).toBe(2);
  expect(read(document, key)).toBe('no-preference');
  host.change({
    '(prefers-reduced-motion: no-preference)': false,
    '(prefers-reduced-motion: reduce)': true,
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  releaseA();
  expect(host.live()).toBe(2);
  releaseB();
  expect(host.live()).toBe(0);
  expect(read(document, key)).toBe('unknown');
  const getter = window.matchMedia;
  vi.mocked(window.matchMedia).mockImplementation(
    (query) => ({ matches: query.includes('no-preference') }) as MediaQueryList
  );
  const missing = subscribe(document, [key], first);
  expect(read(document, key)).toBe('unknown');
  missing();
  // A source without a paired notification/release API cannot enable presentation.
  expect(host.live()).toBe(0);
  expect(window.matchMedia).toBe(getter);
});

it('retains explicit unsupported keys/targets and omits all environment observers when not reached', () => {
  const noMeta = compilePrototype(
    `import {definePrototype,tw} from '@proto.ui/core';export default definePrototype({name:'plain',setup(def){def.feedback.style.use(tw('bg-white'));}});`,
    { profile: 'react-dom-source-v1' }
  );
  expect(noMeta.ok).toBe(true);
  if (noMeta.ok)
    expect(noMeta.value.output.supportingFiles?.some((file) => file.path.includes('/meta/'))).toBe(
      false
    );
  expect(
    compilePrototype(source.replace("'colorScheme'", "'unreviewedEnvironment'"), {
      profile: 'react-dom-source-v1',
    })
  ).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ code: 'PUI1024' })] });
  for (const profile of [
    'gpui-source-v1',
    'qt-source-v1',
    'flutter-source-v1',
    'react-dom-ssr-v1',
  ]) {
    const result = compilePrototype(source, { profile });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok)
      expect(
        result.diagnostics.some(
          (item) => item.message.includes('Rule Meta') || item.code === 'PUI4001'
        )
      ).toBe(true);
  }
});
