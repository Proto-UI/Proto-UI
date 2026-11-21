// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const source = `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
import type {RunHandle} from '@proto.ui/core';import {asAccessible} from '@proto.ui/hooks';
const FAMILY=createAnatomyFamily('renamed-self-family',{roles:{root:{cardinality:{min:1,max:1}}}});
export default definePrototype({name:'ordinary-native-part-owner',setup(def){
  def.anatomy.claim(FAMILY,{role:'root'});
  const targetKey=def.state.string('target-key','match');
  const sourceKey=def.state.string('source-key','match');
  const accessible=asAccessible();accessible.part(FAMILY,{key:targetKey});
  accessible.relation('controls',{target:{kind:'part',family:FAMILY,role:'root',key:sourceKey}});
  let current:RunHandle<{}>|null=null;
  def.lifecycle.onCreated(run=>{current=run;});
  def.expose.method('targetKey',(key:string)=>targetKey.set(key));
  def.expose.method('sourceKey',(key:string)=>sourceKey.set(key));
  def.expose.method('hide',()=>current?.lifecycle.setPresent(false));
  def.expose.method('show',()=>current?.lifecycle.setPresent(true));
  return r=>r.el('section','native relationship');
}});`;

// Public compiler/writer -> ordinary framework import -> rendered native DOM.
// These assertions exercise generated output, rather than importing its host service directly.
for (const profile of nativeOwnerProfiles) describe(profile, () => {
  it('resolves exact State keys, withdraws on detach and retains identity across remount', async () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountNativeOwner(source, profile);
    cleanup.push(owner.dispose);
    const api = owner.handle.getExposes();
    const initial = owner.host.querySelector('section')!;
    const id = initial.id;
    expect(id).toMatch(/^pui-part-/);
    expect(initial.getAttribute('aria-controls')).toBe(id);
    await owner.act(() => api.targetKey('other'));
    expect(initial.hasAttribute('aria-controls')).toBe(false);
    await owner.act(() => api.targetKey('other'));
    expect(warnings.mock.calls.filter(call => String(call[0]).includes('missing-target'))).toHaveLength(1);
    await owner.act(() => api.sourceKey('other'));
    expect(initial.getAttribute('aria-controls')).toBe(id);
    await owner.act(() => api.hide());
    await owner.flush();
    expect(initial.hasAttribute('aria-controls')).toBe(false);
    expect(initial.hasAttribute('id')).toBe(false);
    expect(owner.host.querySelector('section')).toBeNull();
    await owner.act(() => api.show());
    await owner.flush();
    const remounted = owner.host.querySelector('section')!;
    expect(remounted.id).toBe(id);
    expect(remounted.getAttribute('aria-controls')).toBe(id);
    await owner.dispose();
    expect(remounted.hasAttribute('aria-controls')).toBe(false);
    expect(remounted.hasAttribute('id')).toBe(false);
  });

  it('preserves authored identity and identical pre-existing IDREF tokens on release', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const owner = await mountNativeOwner(source, profile);
    cleanup.push(owner.dispose);
    const api = owner.handle.getExposes();
    const view = owner.host.querySelector('section')!;
    await owner.act(() => api.sourceKey('missing'));
    view.id = 'host-authored-id';
    view.setAttribute('aria-controls', 'host-token host-authored-id');
    await owner.act(() => api.sourceKey('match'));
    expect(view.id).toBe('host-authored-id');
    expect(view.getAttribute('aria-controls')).toBe('host-token host-authored-id');
    await owner.act(() => api.sourceKey('missing'));
    expect(view.getAttribute('aria-controls')).toBe('host-token host-authored-id');
    await owner.dispose();
    expect(view.id).toBe('host-authored-id');
    expect(view.getAttribute('aria-controls')).toBe('host-token host-authored-id');
  });

  it('fails closed on host collisions and reconciles a live host identity edit', async () => {
    const owner = await mountNativeOwner(source, profile);
    cleanup.push(owner.dispose);
    const view = owner.host.querySelector('section')!;
    const reserved = view.id;
    const collision = document.createElement('div'); collision.id = reserved; document.body.append(collision);
    await vi.waitFor(() => expect(view.hasAttribute('aria-controls')).toBe(false));
    expect(view.id).toBe(reserved);
    collision.remove();
    await vi.waitFor(() => expect(view.getAttribute('aria-controls')).toBe(reserved));
    view.id = 'host-live-replacement';
    await vi.waitFor(() => expect(view.getAttribute('aria-controls')).toBe('host-live-replacement'));
    await owner.dispose();
    expect(view.id).toBe('host-live-replacement');
    expect(view.hasAttribute('aria-controls')).toBe(false);
  });
});
