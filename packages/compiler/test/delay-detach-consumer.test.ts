// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.useRealTimers();
  document.body.replaceChildren();
});
const source = `import{definePrototype,delay}from'@proto.ui/core';import type{RunHandle}from'@proto.ui/core';
export default definePrototype({name:'review-delay-detach',setup(def){
  let current:RunHandle<{}>|null=null;
  const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);
  def.lifecycle.onCreated(run=>{current=run});
  def.lifecycle.onUnmounted(()=>{delay(1,()=>count.set(count.get()+1));});
  def.expose.method('hide',()=>current?.lifecycle.setPresent(false));
  def.expose.method('show',()=>current?.lifecycle.setPresent(true));
  return r=>r.el('output',[r.slot()]);
}});`;
for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('retires work scheduled by the unmounted callback before detach completes', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const exposed = owner.handle.getExposes();
      expect(owner.host.querySelector('output')).not.toBeNull();
      await owner.act(() => exposed.hide());
      await owner.flush();
      expect(owner.host.querySelector('output')).toBeNull();
      await owner.act(() => vi.advanceTimersByTime(2));
      expect(exposed.count.get()).toBe(0);
      await owner.act(() => exposed.show());
      expect(owner.host.querySelector('output')).not.toBeNull();
    });
  });
