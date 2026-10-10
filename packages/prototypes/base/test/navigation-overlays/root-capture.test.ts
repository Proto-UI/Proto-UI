import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asPopoverRoot } from '../../src/popover';
import { asAlertDialogRoot } from '../../src/alert-dialog';
import { asDrawerRoot } from '../../src/drawer';
import { asContextMenuRoot } from '../../src/context-menu';

const roots = [asPopoverRoot, asAlertDialogRoot, asDrawerRoot, asContextMenuRoot];
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  await flush();
});

describe.each(roots.map((hook, index) => [index, hook] as const))(
  'nested open owner %s',
  (index, hook) => {
    it('captures the real helper without flattening and observes controlled owner transitions', async () => {
      let result: ReturnType<typeof hook> | undefined;
      const observed: boolean[] = [];
      const P = definePrototype({
        name: `test-finf-root-capture-${index}`,
        setup(def) {
          result = hook();
          const child = result.getAsHookHandle?.('useOpenState');
          const open = child?.getState?.('open');
          if (!open) throw new Error('Expected real useOpenState child capture');
          open.watch((_run, event) => {
            if (event.type === 'next') observed.push(event.next);
          });
          def.expose.method('readCapturedOpen', () => open.get());
        },
      });
      AdaptToWebComponent(P);
      const element = document.createElement(P.name) as HTMLElement & {
        getExposes(): { readCapturedOpen(): boolean; close(): void; open: { get(): boolean } };
      };
      owned.push(element);
      setElementProps(element, { open: true });
      document.body.append(element);
      await flush();
      expect(Object.keys(result?.stateHandles ?? {})).toEqual(
        index === 3 ? ['collectionCount'] : []
      );
      const child = result?.getAsHookHandle?.('useOpenState');
      expect(child).toBe(result?.getAsHook?.('useOpenState')?.handle);
      expect(child?.stateHandles?.open).toBe(child?.getState?.('open'));
      expect(child?.stateHandles?.open.get()).toBe(true);
      expect(element.getExposes().readCapturedOpen()).toBe(true);
      const previous = observed.length;
      element.getExposes().close();
      await flush();
      expect(element.getExposes().open.get()).toBe(true);
      expect(child?.stateHandles?.open.get()).toBe(true);
      expect(observed).toHaveLength(previous);
      setElementProps(element, { open: false });
      await flush();
      expect(child?.stateHandles?.open.get()).toBe(false);
      expect(observed.at(-1)).toBe(false);
      setElementProps(element, { open: true });
      await flush();
      expect(child?.stateHandles?.open.get()).toBe(true);
      expect(observed.at(-1)).toBe(true);
    });
  }
);

// Compile-time negative controls accompany the actual runtime captures above.
function disallowFlattenedOpen(result: ReturnType<typeof asPopoverRoot>) {
  // @ts-expect-error Open belongs to getAsHookHandle('useOpenState'), not Root.
  result.stateHandles?.open;
  // @ts-expect-error Root has no owned open state key.
  result.getState?.('open');
  const child = result.getAsHookHandle?.('useOpenState');
  child?.getState?.('open')?.watch(() => {});
}
void disallowFlattenedOpen;
