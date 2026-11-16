// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each([
      `let count=0;const ignore=(callback:()=>void)=>{count+=1;};
     ignore(()=>{asOverlay();});def.expose.value('result',count);`,
      `const box={tag:1,unused:()=>asOverlay()};def.expose.value('result',box.tag);`,
    ])(
      'preserves observed ordinary effects without reaching an uncalled callback: %s',
      async (body) => {
        const owner = await mountNativeOwner(
          `import{definePrototype}from'@proto.ui/core';
      import{asOverlay}from'@proto.ui/hooks';
      export default definePrototype({name:'observed-unused-closure',setup(def){
        ${body}
        return r=>r.el('div',[]);
      }});`,
          profile
        );
        cleanup.push(owner.dispose);
        expect(owner.handle.getExposes().result).toBe(1);
        expect(owner.compiled.output.dependencies.map((item) => item.name)).not.toContain(
          '@floating-ui/dom'
        );
        expect(
          owner.compiled.output.supportingFiles?.filter((file) =>
            file.path.includes('/interaction/')
          )
        ).toEqual([]);
      }
    );
  });
