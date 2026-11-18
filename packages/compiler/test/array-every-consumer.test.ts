// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  const results = await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((dispose) => dispose())
  );
  document.body.replaceChildren();
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Array.every consumer cleanup failed');
});

function source(body: string) {
  return `import{definePrototype}from'@proto.ui/core';
    import{asFocusable}from'@proto.ui/hooks';
    export default definePrototype({name:'every-ordinary-consumer',setup(def){
      ${body}return r=>r.el('button','ordinary every consumer');
    }});`;
}

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each([
      ['optional index', '(value:number,index?:number)=>{if(index)asFocusable();return true;}'],
      [
        'optional array',
        '(value:number,index?:number,items?:number[])=>{if(items&&index)asFocusable();return true;}',
      ],
    ])('retains the focus support reached through %s', async (_name, callback) => {
      const owner = await mountNativeOwner(source(`[1,2].every(${callback});`), profile);
      cleanups.push(owner.dispose);
      const root =
        profile === 'web-component-source-v1'
          ? owner.host.firstElementChild
          : owner.host.querySelector('[data-pui-root]');
      expect(root).not.toBeNull();
      expect(root!.getAttribute('tabindex')).toBe('0');
      await owner.dispose();
      expect(root!.isConnected).toBe(false);
    });

    it('passes checked indices and the same array while preserving short circuit and fewer formals', async () => {
      const owner = await mountNativeOwner(
        source(`
        const values=[4,5,6];let calls=0;let total=0;let same=true;
        const all=values.every((value,index,items)=>{calls++;total+=value+index;same=same&&items===values;return index<1;});
        let noFormalCalls=0;const allWithoutFormals=values.every(()=>{noFormalCalls++;return true;});
        def.expose.value('result',{calls,total,same,all,noFormalCalls,allWithoutFormals});
      `),
        profile
      );
      cleanups.push(owner.dispose);
      expect(owner.handle.getExposes().result).toEqual({
        calls: 2,
        total: 10,
        same: true,
        all: false,
        noFormalCalls: 3,
        allWithoutFormals: true,
      });
    });

    it('keeps the unsupplied fourth default and skips the supplied index default', async () => {
      const owner = await mountNativeOwner(
        source(`
        let indexDefaults=0;let fourthDefaults=0;let total=0;
        const indexFallback=()=>{indexDefaults++;return 9;};
        const fourthFallback=()=>{fourthDefaults++;return 7;};
        [4,5].every((value:number,index:number=indexFallback(),items:number[],extra:number=fourthFallback())=>{
          total+=value+index+items.length+extra;return true;
        });
        def.expose.value('result',{indexDefaults,fourthDefaults,total});
      `),
        profile
      );
      cleanups.push(owner.dispose);
      expect(owner.handle.getExposes().result).toEqual({
        indexDefaults: 0,
        fourthDefaults: 2,
        total: 28,
      });
    });
  });
