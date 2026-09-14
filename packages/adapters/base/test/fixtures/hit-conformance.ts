import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype, type HitParticipationHandle } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
export type HitTree = { proto: Prototype; children?: HitTree[] };
export type HitMount = { host: HTMLElement; flush(): Promise<void>; unmount(): Promise<void> };
export function hitAdapterConformance(name: string, mount: (tree: HitTree[]) => Promise<HitMount>) {
  describe(`${name}: Hit Participation ownership`, () => {
    it('T-HIT-PARTICIPATION-0001-CASE-ADAPTER: shares claims, rejects conflicts without poisoning the Module and restores after cleanup', async () => {
      const target = document.createElement('div');
      target.style.pointerEvents = 'auto';
      document.body.append(target);
      const handles: HitParticipationHandle[] = [];
      const release: Array<() => void> = [];
      const protos = [0, 1].map((index) =>
        definePrototype({
          name: `hit-${name}-catalog-${index}`,
          setup() {
            const hit = (handles[index] = asHitParticipation({ mode: 'disabled' }));
            release[index] = hit.registerRegion(target, { mode: 'disabled' });
            return (r) => r.el('span', 'disabled region');
          },
        })
      );
      try {
        for (let epoch = 0; epoch < 2; epoch++) {
          const mounted = await mount(protos.map((proto) => ({ proto })));
          try {
            await mounted.flush();
            const roots = mounted.host.querySelectorAll<HTMLElement>('[data-pui-root]');
            expect(roots).toHaveLength(2);
            for (const root of roots) expect(root.style.pointerEvents).toBe('none');
            expect(() => handles[1].registerRegion(target, { mode: 'passthrough' })).toThrow(
              /conflicting.*mode/i
            );
            const unrelated = document.createElement('div');
            const dispose = handles[1].registerRegion(unrelated, { mode: 'passthrough' });
            expect(unrelated.style.pointerEvents).toBe('none');
            dispose();
            expect(unrelated.style.pointerEvents).toBe('');
            release[epoch]();
            expect(target.style.pointerEvents).toBe('none');
          } finally {
            await mounted.unmount();
          }
          expect(target.style.pointerEvents).toBe('auto');
        }
      } finally {
        target.remove();
      }
    });
    it('T-HIT-PARTICIPATION-0001-CASE-RELEASE-CONFLICT: a rejected release retains its original claim', async () => {
      const target = document.createElement('div');
      target.style.pointerEvents = 'auto';
      let first!: HitParticipationHandle;
      let removeOverride!: () => void;
      let removeSecond!: () => void;
      const a = definePrototype({
        name: `hit-release-${name}-first`,
        setup() {
          first = asHitParticipation();
          first.registerRegion(target, { mode: 'participating' });
          removeOverride = first.registerRegion(target, { mode: 'disabled' });
          return (r) => r.el('span', 'first');
        },
      });
      const b = definePrototype({
        name: `hit-release-${name}-second`,
        setup() {
          removeSecond = asHitParticipation().registerRegion(target, { mode: 'disabled' });
          return (r) => r.el('span', 'second');
        },
      });
      const mounted = await mount([{ proto: a }, { proto: b }]);
      try {
        await mounted.flush();
        expect(() => removeOverride()).toThrow(/conflicting.*mode/i);
        expect(target.style.pointerEvents).toBe('none');
        const cancel = first.registerRegion(document.createElement('div'));
        cancel();
        removeSecond();
        expect(target.style.pointerEvents).toBe('none');
        removeOverride();
        expect(target.style.pointerEvents).toBe('auto');
      } finally {
        await mounted.unmount();
      }
    });
  });
}
