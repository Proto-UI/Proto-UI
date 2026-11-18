// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

// Draft C-EXPOSE-0007-F / C-LIFECYCLE-0002-G and compiler observable lifetime:
// a host-retained authored argument is the same owned public capability as a
// returned callable. Internal calls retain their actual caller phase/identity.
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

function source(body: string, module = ''): string {
  return `import{definePrototype}from'@proto.ui/core';${module}
    export default definePrototype({name:'external-callback-owner',setup(def){
      ${body}return r=>r.el('output',[r.slot()]);
    }});`;
}

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('enters the originating callback scope for a host-retained State writer', async () => {
      const owner = await mountNativeOwner(
        source(`
        const count=def.state.numberDiscrete('count',0);
        const step=()=>{count.set(count.get()+1);return count.get();};
        def.expose.method('send',(accept:(step:()=>number)=>void)=>accept(step));
      `),
        profile
      );
      cleanup.push(owner.dispose);
      let retained!: () => number;
      owner.handle.getExposes().send((step: () => number) => {
        retained = step;
      });
      expect(retained()).toBe(1);
      expect(retained()).toBe(2);
      await owner.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
    });

    it('preserves nested aliases across repeated transfers and invalidates pure lexical closures', async () => {
      const owner = await mountNativeOwner(
        source(`
        let count=0;const step=()=>++count;
        const record={nested:{step}};
        def.expose.method('send',(accept:(value:{nested:{step:()=>number}})=>void)=>accept(record));
        def.expose.method('read',()=>record);
      `),
        profile
      );
      cleanup.push(owner.dispose);
      type RecordValue = { nested: { step(): number } };
      const seen: RecordValue[] = [];
      const publicValues = owner.handle.getExposes();
      publicValues.send((value: RecordValue) => {
        seen.push(value);
      });
      publicValues.send((value: RecordValue) => {
        seen.push(value);
      });
      expect(seen[0]).toBe(seen[1]);
      expect(seen[0]).toBe(publicValues.read());
      expect(seen[0].nested.step()).toBe(1);
      await owner.dispose();
      expect(() => seen[0].nested.step()).toThrow(/dispos|alive|terminal/i);
    });

    it('keeps internal setup calls raw when a shared helper also forwards to a host callback', async () => {
      const owner = await mountNativeOwner(
        source(
          `
        const forward=deliver;
        let same=false;
        const initialize=()=>{def.state.numberDiscrete('setup-proof',0);return 10;};
        const localAccept=(step:()=>number)=>{same=step===initialize;step();};
        forward(localAccept,initialize);
        const count=def.state.numberDiscrete('count',0);
        const step=()=>{count.set(count.get()+1);return count.get();};
        def.expose.value('same',same);
        def.expose.method('send',(accept:(step:()=>number)=>void)=>forward(accept,step));
      `,
          `const deliver=(accept:(step:()=>number)=>void,step:()=>number)=>accept(step);`
        ),
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().same).toBe(true);
      let retained!: () => number;
      owner.handle.getExposes().send((step: () => number) => {
        retained = step;
      });
      expect(retained()).toBe(1);
    });

    it('preserves an external member receiver and optional-call argument evaluation', async () => {
      const owner = await mountNativeOwner(
        source(`
        let evaluations=0;
        const make=()=>{evaluations++;return ()=>evaluations;};
        def.expose.method('optional',(accept?:(step:()=>number)=>void)=>accept?.(make()));
        def.expose.method('member',(sink:{accept:(step:()=>number)=>void})=>sink.accept(make()));
        def.expose.method('evaluations',()=>evaluations);
      `),
        profile
      );
      cleanup.push(owner.dispose);
      const publicValues = owner.handle.getExposes();
      publicValues.optional();
      expect(publicValues.evaluations()).toBe(0);
      const retained: (() => number)[] = [];
      publicValues.optional((step: () => number) => {
        retained.push(step);
      });
      expect(publicValues.evaluations()).toBe(1);
      const sink = {
        accept(this: unknown, step: () => number) {
          expect(this).toBe(sink);
          retained.push(step);
        },
      };
      publicValues.member(sink);
      expect(publicValues.evaluations()).toBe(2);
      expect(retained[0]()).toBe(2);
      expect(retained[1]()).toBe(2);
      await owner.dispose();
      expect(() => retained[0]()).toThrow(/dispos|alive|terminal/i);
      expect(() => retained[1]()).toThrow(/dispos|alive|terminal/i);
    });

    it('projects a record only after all original arguments finish evaluating', async () => {
      const owner = await mountNativeOwner(
        source(`
        const record={step:()=>1};const replacement=()=>2;
        def.expose.method('send',(accept:(value:{step:()=>number},step:()=>number)=>void)=>
          accept(record,record.step=replacement));
      `),
        profile
      );
      cleanup.push(owner.dispose);
      let retained!: { step(): number };
      owner.handle.getExposes().send((value: { step(): number }, step: () => number) => {
        retained = value;
        expect(value.step()).toBe(2);
        expect(step()).toBe(2);
      });
      await owner.dispose();
      expect(() => retained.step()).toThrow(/dispos|alive|terminal/i);
    });

    it('preserves the exact external thrown value and a usable owner after failure', async () => {
      const owner = await mountNativeOwner(
        source(`
        const count=def.state.numberDiscrete('count',0);
        const step=()=>{count.set(count.get()+1);return count.get();};
        def.expose.method('send',(accept:(step:()=>number)=>void)=>accept(step));
      `),
        profile
      );
      cleanup.push(owner.dispose);
      let retained!: () => number;
      for (const marker of [undefined, null, false, 0, '', { reason: 'external' }]) {
        let caught = false;
        try {
          owner.handle.getExposes().send((step: () => number) => {
            retained = step;
            throw marker;
          });
        } catch (error) {
          caught = true;
          expect(error).toBe(marker);
        }
        expect(caught).toBe(true);
      }
      expect(retained()).toBe(1);
    });

    it('preserves the identity and ownership of a callback returned by its external recipient', async () => {
      const owner = await mountNativeOwner(
        source(`
        let count=0;const step=()=>++count;
        def.expose.method('send',(accept:(step:()=>number)=>()=>number)=>accept(step));
      `),
        profile
      );
      cleanup.push(owner.dispose);
      let retained!: () => number;
      const returned = owner.handle.getExposes().send((step: () => number) => {
        retained = step;
        return step;
      });
      expect(returned).toBe(retained);
      expect(returned()).toBe(1);
      await owner.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
    });

    it('owns an external callback call in a module default and skips that default when supplied', async () => {
      const owner = await mountNativeOwner(
        source(
          `
        const forward=deliver;
        const count=def.state.numberDiscrete('count',0);
        const step=()=>{count.set(count.get()+1);return count.get();};
        def.expose.method('send',(accept:(step:()=>number)=>number)=>forward(accept,step));
        def.expose.method('skip',(accept:(step:()=>number)=>number)=>forward(accept,step,42));
      `,
          `const deliver=(accept:(step:()=>number)=>number,step:()=>number,result=accept(step))=>result;`
        ),
        profile
      );
      cleanup.push(owner.dispose);
      let retained!: () => number;
      const publicValues = owner.handle.getExposes();
      expect(
        publicValues.skip(() => {
          throw new Error('default must not execute');
        })
      ).toBe(42);
      expect(
        publicValues.send((step: () => number) => {
          retained = step;
          return 17;
        })
      ).toBe(17);
      expect(retained()).toBe(1);
      await owner.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
    });

    it.each(['operation', 'helper dependency'] as const)(
      'owns a module parameter default containing an %s',
      async (kind) => {
        const create = `definition.state.numberDiscrete('default-state',5)`;
        const module = `import type {DefHandle} from '@proto.ui/core';
          ${kind === 'helper dependency' ? `const create=(definition:DefHandle)=>${create};` : ''}
          const register=(definition:DefHandle,created=${kind === 'helper dependency' ? 'create(definition)' : create})=>created;`;
        const owner = await mountNativeOwner(
          source(
            `
          const first=register(def);
          const supplied=def.state.numberDiscrete('supplied-state',9);
          const second=register(def,supplied);
          def.expose.value('first',first.get());
          def.expose.value('second',second.get());
          def.expose.value('same',second===supplied);
        `,
            module
          ),
          profile
        );
        cleanup.push(owner.dispose);
        expect(owner.handle.getExposes()).toMatchObject({ first: 5, second: 9, same: true });
      }
    );

    it('retains both owners when another instance forwards a public callable', async () => {
      const input = source(`
        let count=0;const step=()=>++count;
        def.expose.method('read',()=>step);
        def.expose.method('send',(step:()=>number,accept:(step:()=>number)=>void)=>accept(step));
      `);
      const origin = await mountNativeOwner(input, profile);
      const forwarder = await mountNativeOwner(input, profile);
      const remaining = await mountNativeOwner(input, profile);
      cleanup.push(origin.dispose, forwarder.dispose, remaining.dispose);
      const original = origin.handle.getExposes().read();
      const received: (() => number)[] = [];
      const take = (step: () => number) => {
        received.push(step);
      };
      forwarder.handle.getExposes().send(original, take);
      forwarder.handle.getExposes().send(received[0], take);
      remaining.handle.getExposes().send(original, take);
      expect(received[0]).not.toBe(original);
      expect(received[0]).toBe(received[1]);
      expect(received[0]()).toBe(1);
      await forwarder.dispose();
      expect(() => received[0]()).toThrow(/dispos|alive|terminal/i);
      expect(original()).toBe(2);
      await origin.dispose();
      expect(() => received[2]()).toThrow(/dispos|alive|terminal/i);
    });
  });
