import { describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../../src/events/web-event-router';
import { createInstanceTreeMarkers } from '../../src/platform/instance-tree';

const marker = Symbol.for('@proto.ui/adapter-web-component/__proto_instance');
function owner(instanceMarker = marker) {
  const element = document.createElement('div');
  Object.defineProperty(element, instanceMarker, { value: true });
  return element;
}

describe('C-EVENT-0003-E: root pointer.down belongs to one interaction owner', () => {
  it('does not deliver a descendant-owned pointer to an ancestor root or suppress native propagation', () => {
    const parent = owner();
    const child = owner();
    const input = document.createElement('input');
    child.append(input);
    parent.append(child);
    document.body.append(parent);
    const ancestor = createWebProtoEventRouter({ rootEl: parent, isEnabled: () => true });
    const descendant = createWebProtoEventRouter({ rootEl: child, isEnabled: () => true });
    const parentDown = vi.fn();
    const childDown = vi.fn();
    const nativeDown = vi.fn();
    ancestor.rootTarget.addEventListener('pointer.down', parentDown);
    descendant.rootTarget.addEventListener('pointer.down', childDown);
    parent.addEventListener('pointerdown', nativeDown);
    try {
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(childDown).toHaveBeenCalledOnce();
      expect(parentDown).not.toHaveBeenCalled();
      expect(nativeDown).toHaveBeenCalledOnce();
      parent.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(parentDown).toHaveBeenCalledOnce();
      expect(childDown).toHaveBeenCalledOnce();
    } finally {
      descendant.dispose();
      ancestor.dispose();
      parent.remove();
    }
  });

  it('keeps an unowned native descendant attributed to its enclosing root rather than promising bare-target filtering', () => {
    const parent = owner();
    const input = document.createElement('input');
    parent.append(input);
    document.body.append(parent);
    const router = createWebProtoEventRouter({ rootEl: parent, isEnabled: () => true });
    const down = vi.fn();
    router.rootTarget.addEventListener('pointer.down', down);
    try {
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(down).toHaveBeenCalledOnce();
    } finally {
      router.dispose();
      parent.remove();
    }
  });

  it.each(
    ['web-component', 'react', 'vue', 'vue2'].flatMap((adapter) =>
      ['physical', 'logical'].map((ancestry) => ({ adapter, ancestry }))
    )
  )('keeps $adapter input with its owner across $ancestry ancestry', ({ adapter, ancestry }) => {
    const symbolName = `@proto.ui/adapter-${adapter}/__proto_instance`;
    const tree = createInstanceTreeMarkers(symbolName);
    const parent = owner();
    const child = owner(Symbol.for(symbolName));
    const input = document.createElement('input');
    child.append(input);
    if (ancestry === 'physical') parent.append(child);
    else tree.setProtoParent(child, parent);
    document.body.append(parent);
    if (ancestry === 'logical') document.body.append(child);
    const ancestor = createWebProtoEventRouter({ rootEl: parent, isEnabled: () => true });
    const descendant = createWebProtoEventRouter({ rootEl: child, isEnabled: () => true });
    const parentDown = vi.fn();
    const childDown = vi.fn();
    const nativeDown = vi.fn();
    ancestor.rootTarget.addEventListener('pointer.down', parentDown);
    descendant.rootTarget.addEventListener('pointer.down', childDown);
    document.addEventListener('pointerdown', nativeDown);
    try {
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect({
        child: childDown.mock.calls.length,
        parent: parentDown.mock.calls.length,
        native: nativeDown.mock.calls.length,
      }).toEqual({ child: 1, parent: 0, native: 1 });
      parent.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(parentDown).toHaveBeenCalledOnce();
      expect(childDown).toHaveBeenCalledOnce();
      expect(nativeDown).toHaveBeenCalledTimes(2);
    } finally {
      document.removeEventListener('pointerdown', nativeDown);
      descendant.dispose();
      ancestor.dispose();
      tree.setProtoParent(child, null);
      child.remove();
      parent.remove();
    }
  });
});
