// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  mountNativeOwner,
  nativeOwnerProfiles,
  type NativeOwnerProfile,
} from './native-owner-consumer';

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

const source = `import {definePrototype,type RunHandle} from '@proto.ui/core';
import {asScrollSurface} from '@proto.ui/hooks';
export default definePrototype({name:'scroll-position-consumer',setup(def){
  const scroll=asScrollSurface();
  scroll.configure({axes:'vertical',projection:'system'});
  let current:RunHandle<{}>|null=null;
  def.lifecycle.onCreated(run=>{current=run;});
  def.expose.method('to',(position:number)=>scroll.request({kind:'to',axis:'vertical',position}));
  def.expose.method('by',(delta:number)=>scroll.request({kind:'by',axis:'vertical',delta}));
  def.expose.method('read',()=>scroll.getSnapshot());
  def.expose.method('hide',()=>current?.lifecycle.setPresent(false));
  def.expose.method('show',()=>current?.lifecycle.setPresent(true));
  return r=>r.el('section',r.slot());
}});`;

/** Explicit model geometry, including replacement roots; no browser layout claim. */
function geometry() {
  const prototype = HTMLElement.prototype;
  for (const [name, extent] of Object.entries({
    clientHeight: 200,
    scrollHeight: 1000,
    clientWidth: 200,
    scrollWidth: 500,
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, {
      configurable: true,
      get() {
        return extent;
      },
    });
    cleanup.push(() => {
      if (descriptor) Object.defineProperty(prototype, name, descriptor);
      else delete (prototype as unknown as Record<string, unknown>)[name];
    });
  }
}

function physicalRoot(host: HTMLElement, profile: NativeOwnerProfile): HTMLElement {
  const surface =
    profile === 'web-component-source-v1'
      ? host.firstElementChild
      : host.querySelector('[data-pui-root]');
  if (!(surface instanceof HTMLElement)) throw new Error('missing ordinary native physical root');
  return surface;
}

for (const profile of nativeOwnerProfiles)
  describe(`C-SCROLL-0001 ordinary ${profile} consumer`, () => {
    it('returns a dispatched record for a delivered request and reports observed facts', async () => {
      geometry();
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const surface = physicalRoot(owner.host, profile);
      const exposed = owner.handle.getExposes();
      const outcome = await owner.act(() => exposed.by(80));
      expect(surface.scrollTop).toBe(80);
      expect(outcome).toEqual({ kind: 'dispatched' });
      expect(exposed.read().vertical.position).toBe(0.1);
    });

    it('treats to as a normalized ratio, clamps it, and preserves the horizontal offset', async () => {
      geometry();
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const surface = physicalRoot(owner.host, profile);
      surface.scrollLeft = 17;
      const exposed = owner.handle.getExposes();
      await owner.act(() => exposed.to(0.5));
      expect(surface.scrollTop).toBe(400);
      await owner.act(() => exposed.to(2));
      expect(surface.scrollTop).toBe(800);
      await owner.act(() => exposed.to(-1));
      expect(surface.scrollTop).toBe(0);
      expect(surface.scrollLeft).toBe(17);
    });

    it('rejects a detached request and does not replay it into a replacement view', async () => {
      geometry();
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const exposed = owner.handle.getExposes();
      const previous = owner.host.querySelector('section')!;
      await owner.act(() => exposed.hide());
      expect(owner.host.querySelector('section')).toBeNull();
      const outcome = await owner.act(() => exposed.to(0.75));
      await owner.act(() => exposed.show());
      expect(owner.host.querySelector('section')).not.toBe(previous);
      const replacement = physicalRoot(owner.host, profile);
      expect(replacement.scrollTop).toBe(0);
      expect(outcome).toEqual({ kind: 'rejected', reason: 'not-mounted' });
      expect(await owner.act(() => exposed.to(0.25))).toEqual({ kind: 'dispatched' });
      expect(replacement.scrollTop).toBe(200);
    });
  });
