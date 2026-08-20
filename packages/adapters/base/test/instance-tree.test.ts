import { describe, expect, it, vi } from 'vitest';
import { createInstanceTreeMarkers, releaseWebTriggerSurface } from '../src';

describe('adapter-base: logical instance tree', () => {
  it('binds owner-level parent identity before either token has a host view', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/logical-instance-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });

    tree.bindLogicalParent(child, parent);

    expect(tree.getLogicalParent(child)).toBe(parent);
    expect(tree.getLogicalRoot(child)).toBeNull();

    tree.bindLogicalParent(child, null);
    expect(tree.getLogicalParent(child)).toBeNull();
  });

  it('clears a host projection without clearing logical ownership', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/logical-projection-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const parentRoot = document.createElement('div');
    const childRoot = document.createElement('div');

    tree.markProtoInstance(parentRoot, { name: 'parent', setup: () => undefined }, parent);
    tree.markProtoInstance(childRoot, { name: 'child', setup: () => undefined }, child);
    tree.bindLogicalParent(child, parent);
    tree.setProtoParent(childRoot, parentRoot);

    tree.clearProtoParentProjection(childRoot);

    expect(tree.getProtoParent(childRoot)).toBeNull();
    expect(tree.getLogicalParent(child)).toBe(parent);
  });

  it('moves route listeners across late and repeatable view targets', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/logical-event-route-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const firstTarget = new EventTarget();
    const secondTarget = new EventTarget();
    const listener = vi.fn();

    tree.mergeLogicalTriggerGroup(parent, parent);
    tree.mergeLogicalTriggerGroup(child, parent);
    const routeTarget = tree.getLogicalEventTarget(parent);
    routeTarget.addEventListener('press.commit', listener);

    firstTarget.dispatchEvent(new Event('press.commit'));
    expect(listener).not.toHaveBeenCalled();

    tree.bindLogicalEventTarget(child, firstTarget);
    firstTarget.dispatchEvent(new Event('press.commit'));
    expect(listener).toHaveBeenCalledOnce();

    tree.bindLogicalEventTarget(child, secondTarget);
    firstTarget.dispatchEvent(new Event('press.commit'));
    secondTarget.dispatchEvent(new Event('press.commit'));
    expect(listener).toHaveBeenCalledTimes(2);

    tree.unbindLogicalEventTarget(child, secondTarget);
    secondTarget.dispatchEvent(new Event('press.commit'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('projects the logical route owner token onto an attached trigger root', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/logical-route-owner-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const childRoot = document.createElement('div') as unknown as HTMLElement &
      Record<symbol, unknown>;
    const ownerMark = Symbol.for('@proto.ui/as-trigger/confirm-owner');

    tree.mergeLogicalTriggerGroup(child, parent);
    tree.markProtoInstance(childRoot, { name: 'child', setup: () => undefined }, child);

    expect(childRoot[ownerMark]).toBe(parent);
    expect(tree.getLogicalTriggerGroupAnchor(child)).toBe(parent);
  });

  it('keeps the deepest continuous trigger as the shared host surface regardless of setup order', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/logical-trigger-surface-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const parentRoot = document.createElement('div');
    const childRoot = document.createElement('button');
    const listener = vi.fn();

    tree.bindLogicalParent(child, parent);
    tree.markProtoInstance(parentRoot, { name: 'parent', setup: () => undefined }, parent);
    tree.markProtoInstance(childRoot, { name: 'child', setup: () => undefined }, child);
    tree.subscribeLogicalTriggerSurface(parent, listener);

    tree.mergeLogicalTriggerGroup(child, parent);
    tree.mergeLogicalTriggerGroup(parent, parent);

    expect(tree.getLogicalTriggerSurfaceOwner(parent)).toBe(child);
    expect(tree.getLogicalTriggerSurfaceRoot(parent)).toBe(childRoot);
    expect(listener).toHaveBeenCalled();
  });

  it('reconciles a child trigger when its parent host materializes later', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/late-trigger-parent-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const parentRoot = document.createElement('div');
    const childRoot = document.createElement('button') as unknown as HTMLElement &
      Record<symbol, unknown>;
    const childLabel = document.createTextNode('Open');
    const ownerMark = Symbol.for('@proto.ui/as-trigger/confirm-owner');

    childRoot.appendChild(childLabel);
    parentRoot.appendChild(childRoot);
    tree.markProtoInstance(childRoot, { name: 'child', setup: () => undefined }, child);
    tree.mergeLogicalTriggerGroup(child, child);
    tree.markProtoInstance(parentRoot, { name: 'parent', setup: () => undefined }, parent);
    tree.mergeLogicalTriggerGroup(parent, parent);

    expect(tree.getLogicalParent(child)).toBe(parent);
    expect(tree.getLogicalTriggerGroupAnchor(child)).toBe(parent);
    expect(tree.getLogicalEventRouteSurfaceForTarget(childRoot)).toBe(child);
    expect(tree.getLogicalEventRouteSurfaceForTarget(childLabel)).toBe(child);
    expect(tree.getLogicalTriggerSurfaceOwner(parent)).toBe(child);
    expect(childRoot[ownerMark]).toBe(parent);
  });

  it('admits semantic activation only from the current trigger-group surface', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/trigger-hit-origin-tree');
    const parent = tree.createLogicalInstance({ name: 'parent', setup: () => undefined });
    const child = tree.createLogicalInstance({ name: 'child', setup: () => undefined });
    const parentRoot = document.createElement('div');
    const childRoot = document.createElement('button');
    const childLabel = document.createTextNode('Close');

    childRoot.appendChild(childLabel);
    parentRoot.appendChild(childRoot);
    tree.bindLogicalParent(child, parent);
    tree.markProtoInstance(parentRoot, { name: 'parent', setup: () => undefined }, parent);
    tree.markProtoInstance(childRoot, { name: 'child', setup: () => undefined }, child);
    tree.mergeLogicalTriggerGroup(parent, parent);
    tree.mergeLogicalTriggerGroup(child, parent);

    expect(tree.resolveLogicalTriggerEventRouteForTarget(parentRoot)).toEqual({
      matched: true,
      accepted: false,
      surface: child,
    });
    expect(tree.resolveLogicalTriggerEventRouteForTarget(childLabel)).toEqual({
      matched: true,
      accepted: true,
      surface: child,
    });
  });
  it('releases a div trigger surface without leaving a click-focusable tabindex', () => {
    const root = document.createElement('div');
    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'button');
    root.setAttribute('aria-disabled', 'false');
    root.setAttribute('data-pui-a11y-actions', 'activate');
    const removeAttribute = vi.spyOn(root, 'removeAttribute');

    releaseWebTriggerSurface(root);

    expect(root.tabIndex).toBe(-1);
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(removeAttribute).toHaveBeenCalledWith('tabindex');
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.hasAttribute('aria-disabled')).toBe(false);
    expect(root.hasAttribute('data-pui-a11y-actions')).toBe(false);
  });
});
