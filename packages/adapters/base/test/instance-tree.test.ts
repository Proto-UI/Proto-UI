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
  it.each([false, true])('rejects sibling trigger branches without replacing the accepted route (reverse=%s)', (reverse) => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/trigger-branch');
    const proto = { name: 'trigger', setup: () => undefined };
    const outer = tree.createLogicalInstance(proto);
    const children = [tree.createLogicalInstance(proto), tree.createLogicalInstance(proto)];
    if (reverse) children.reverse();
    const [first, second] = children;
    tree.bindLogicalParent(first, outer);
    tree.bindLogicalParent(second, outer);
    tree.mergeLogicalTriggerGroup(outer, outer);
    tree.mergeLogicalTriggerGroup(first, outer);
    const target = new EventTarget();
    const listener = vi.fn();
    tree.bindLogicalEventTarget(first, target);
    tree.getLogicalEventTarget(outer).addEventListener('press.commit', listener);

    expect(() => tree.mergeLogicalTriggerGroup(second, outer)).toThrow(/continuous chain/);
    expect(tree.getLogicalTriggerSurfaceOwner(outer)).toBe(first);
    expect(tree.getLogicalTriggerGroupAnchor(second)).toBe(second);
    target.dispatchEvent(new Event('press.commit'));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('rejects a late trigger parent before joining its two child groups', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/trigger-late-branch');
    const proto = { name: 'trigger', setup: () => undefined };
    const outer = tree.createLogicalInstance(proto);
    const left = tree.createLogicalInstance(proto);
    const right = tree.createLogicalInstance(proto);
    tree.bindLogicalParent(left, outer);
    tree.bindLogicalParent(right, outer);
    tree.mergeLogicalTriggerGroup(left, left);
    tree.mergeLogicalTriggerGroup(right, right);

    expect(() => tree.mergeLogicalTriggerGroup(outer, outer)).toThrow(/continuous chain/);
    expect(tree.getLogicalTriggerGroupAnchor(left)).toBe(left);
    expect(tree.getLogicalTriggerGroupAnchor(right)).toBe(right);
  });

  it('rejects reparenting before changing either chain', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/trigger-reparent-branch');
    const proto = { name: 'trigger', setup: () => undefined };
    const outer = tree.createLogicalInstance(proto);
    const left = tree.createLogicalInstance(proto);
    const other = tree.createLogicalInstance(proto);
    const right = tree.createLogicalInstance(proto);
    tree.bindLogicalParent(left, outer);
    tree.bindLogicalParent(right, other);
    for (const [token, anchor] of [[outer, outer], [left, outer], [other, other], [right, other]]) {
      tree.mergeLogicalTriggerGroup(token, anchor);
    }
    expect(() => tree.bindLogicalParent(right, outer)).toThrow(/continuous chain/);
    expect(tree.getLogicalParent(right)).toBe(other);
    expect(tree.getLogicalTriggerSurfaceOwner(other)).toBe(right);
    expect(tree.getLogicalTriggerSurfaceOwner(outer)).toBe(left);
  });

  it('allows replacement after the old surface is unbound', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/trigger-replace-branch');
    const proto = { name: 'trigger', setup: () => undefined };
    const outer = tree.createLogicalInstance(proto);
    const old = tree.createLogicalInstance(proto);
    const next = tree.createLogicalInstance(proto);
    tree.bindLogicalParent(old, outer);
    tree.markProtoInstance(document.createElement('button'), proto, old);
    tree.mergeLogicalTriggerGroup(outer, outer);
    tree.mergeLogicalTriggerGroup(old, outer);
    tree.unbindProtoInstance(old);
    tree.bindLogicalParent(next, outer);
    tree.mergeLogicalTriggerGroup(next, outer);
    tree.mergeLogicalTriggerGroup(outer, outer);
    expect(tree.getLogicalTriggerSurfaceOwner(outer)).toBe(next);
    expect(() => tree.markProtoInstance(document.createElement('button'), proto, old)).toThrow(/continuous chain/);
    expect(tree.getLogicalRoot(old)).toBeNull();
    expect(tree.getLogicalTriggerSurfaceOwner(outer)).toBe(next);
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
