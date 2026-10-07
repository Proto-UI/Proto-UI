import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asOverlay } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../src';
import * as tree from '../src/platform/instance-tree';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

it.each(
  (['external-remove', 'close-then-move'] as const).flatMap((mode) =>
    (['native', 'prior-own', 'replacement'] as const).map((property) => ({ mode, property }))
  )
)(
  'releases portal parent projection before later ownership: $mode / $property',
  async ({ mode, property }) => {
    let setups = 0;
    let disposed = 0;
    const parentProto = definePrototype({
      name: `wc-portal-parent-release-host-${mode}-${property}`,
      setup() {
        return (r) => r.slot();
      },
    });
    const contentProto = definePrototype({
      name: `wc-portal-parent-release-content-${mode}-${property}`,
      setup(def) {
        setups++;
        const focusable = asFocusable();
        const overlay = asOverlay();
        overlay.configure({ portal: true, entry: 'manual', restore: 'none' });
        def.expose('actions', {
          open: () => overlay.openOverlay(),
          close: () => overlay.close(),
          focus: () => focusable.focusSelf(),
        });
        def.lifecycle.onBeforeDispose(() => disposed++);
        return () => 'Portal content';
      },
    });
    const Parent = AdaptToWebComponent(parentProto);
    const Content = AdaptToWebComponent(contentProto);
    const originalParent: any = new Parent();
    const newParent: any = new Parent();
    const content: any = new Content();
    originalParent.append(content);
    document.body.append(originalParent, newParent);
    await flush();
    const oldToken = content._instanceToken;
    // Supplemental property-ownership controls delegate to the native getter.
    // They must survive either acquisition or replacement of the Adapter shim.
    const nativeParentGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'parentNode')!.get!;
    const hostDescriptor = {
      get(this: Node) {
        return nativeParentGetter.call(this);
      },
      configurable: true,
      enumerable: true,
    };
    if (property === 'prior-own') Object.defineProperty(content, 'parentNode', hostDescriptor);
    let expectedDescriptor = Object.getOwnPropertyDescriptor(content, 'parentNode');
    try {
      content.getExposes().actions.open();
      await flush();
      expect(Array.from(document.body.children)).toContain(content);
      expect(content.parentNode).toBe(originalParent);
      expect(tree.getLogicalParent(oldToken)).toBe(originalParent._instanceToken);
      if (property === 'replacement') {
        Object.defineProperty(content, 'parentNode', hostDescriptor);
        expectedDescriptor = Object.getOwnPropertyDescriptor(content, 'parentNode');
      }

      if (mode === 'external-remove') content.remove();
      else content.getExposes().actions.close();
      await flush();
      const releasedDescriptor = Object.getOwnPropertyDescriptor(content, 'parentNode');
      const releasedParent = content.parentNode;
      const releasedConnected = content.isConnected;
      const resurrected = Array.from(originalParent.children).includes(content);
      newParent.append(content);
      await flush();
      const reconnectedParent = content.parentNode;
      const reconnectedLogicalParent = tree.getLogicalParent(content._instanceToken);

      // Native DOM removal/move and the real Adapter connection path must not
      // inherit the old portal provider's parent projection.
      expect({
        releasedParentIsCurrent:
          releasedParent === (mode === 'external-remove' ? null : originalParent),
        reconnectedParentIsCurrent: reconnectedParent === newParent,
        reconnectedLogicalParentIsCurrent: reconnectedLogicalParent === newParent._instanceToken,
      }).toEqual({
        releasedParentIsCurrent: true,
        reconnectedParentIsCurrent: true,
        reconnectedLogicalParentIsCurrent: true,
      });
      expect(releasedDescriptor).toEqual(expectedDescriptor);
      expect(releasedConnected).toBe(mode === 'close-then-move');
      expect(resurrected).toBe(mode === 'close-then-move');
      expect(setups).toBe(mode === 'external-remove' ? 2 : 1);
      expect(disposed).toBe(mode === 'external-remove' ? 1 : 0);
      expect(content._instanceToken === oldToken).toBe(mode === 'close-then-move');

      content.getExposes().actions.open();
      await flush();
      expect(content.parentNode).toBe(newParent);
      expect(Array.from(document.body.children)).toContain(content);
      content.getExposes().actions.focus();
      expect(document.activeElement).toBe(content);
      content.getExposes().actions.close();
      await flush();
      expect(content.parentNode).toBe(newParent);
      expect(Array.from(newParent.children)).toContain(content);
      expect(Object.getOwnPropertyDescriptor(content, 'parentNode')).toEqual(expectedDescriptor);
    } finally {
      content.remove();
      originalParent.remove();
      newParent.remove();
      await flush();
    }
  }
);
