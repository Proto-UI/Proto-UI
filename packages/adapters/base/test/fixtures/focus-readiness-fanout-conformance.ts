import { expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';

type Mounted = {
  root: HTMLElement;
  getExposes(): any;
  act(callback: () => void): Promise<void>;
  unmount(): Promise<void>;
};

// Real adapter notification reached through a controlled layout retry. Only the
// host focus rejection and frame clock are controlled; registry subscriptions
// use the same source bridge as cross-owner native/entry consumers.
export function focusReadinessFanoutConformance(
  adapter: string,
  tree: {
    getLogicalEventRouteSurfaceForTarget(target: HTMLElement): any;
    subscribeFocusSurfaceReady(token: any, listener: () => void, includeSelf?: boolean): () => void;
  },
  mount: (proto: Prototype<any, any>) => Promise<Mounted>
) {
  it.each(['error', 'undefined'] as const)(
    `${adapter} readiness completes fan-out after first %s throw`,
    async (kind) => {
      const proto = definePrototype({
        name: `fanout-${adapter}-${kind}`,
        setup(def) {
          const target = asFocusable();
          def.expose.method('request', () => target.focusSelf());
          return () => 'Readiness target';
        },
      });
      const mounted = await mount(proto);
      const frames: FrameRequestCallback[] = [];
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      const focus = vi.spyOn(mounted.root, 'focus').mockImplementation(() => {});
      const firstError = kind === 'error' ? new Error('first readiness observer') : undefined;
      const calls: string[] = [];
      const off: Array<() => void> = [];
      try {
        mounted.getExposes().request();
        const token = tree.getLogicalEventRouteSurfaceForTarget(mounted.root)!;
        off.push(
          tree.subscribeFocusSurfaceReady(
            token,
            () => {
              calls.push('first');
              throw firstError;
            },
            true
          )
        );
        off.push(
          tree.subscribeFocusSurfaceReady(
            token,
            () => {
              calls.push('second');
              throw new Error('second readiness observer');
            },
            true
          )
        );
        off.push(tree.subscribeFocusSurfaceReady(token, () => calls.push('last'), true));
        expect(frames.length).toBeGreaterThan(0);
        let caught = false;
        let error: unknown;
        for (let frame = 0; frame < 12 && frames.length && !caught; frame++) {
          try {
            frames.shift()!(performance.now());
          } catch (value) {
            caught = true;
            error = value;
          }
        }
        expect(caught).toBe(true);
        expect(error).toBe(firstError);
        expect(calls).toEqual(['first', 'second', 'last']);
      } finally {
        off.forEach((release) => release());
        focus.mockRestore();
        raf.mockRestore();
        await mounted.unmount();
      }
    }
  );
}
