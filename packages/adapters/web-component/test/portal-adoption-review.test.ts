import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWebComponentPortalMount,
  adoptWebComponentPortalProjections,
  isWebComponentPortaled,
} from '../src/portal-mount';
import {
  markProtoInstance,
  mergeLogicalTriggerGroup,
  subscribeLogicalTriggerSurface,
} from '../src/platform/instance-tree';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe('independent adoption reentry ownership review', () => {
  it.each(['unmount', 'external-parent'] as const)(
    'does not reacquire projection after adoptNode invokes %s',
    (mode) => {
      const owner = document.createElement('section');
      const el = document.createElement('div');
      owner.append(el);
      document.body.append(owner);
      markProtoInstance(owner, { name: `adoption-review-${mode}`, setup: () => undefined });
      const mount = createWebComponentPortalMount();
      mount.mount(el);
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      const other = iframe.contentDocument!;
      other.adoptNode(owner);
      other.body.append(owner);
      const external = other.createElement('article');
      other.body.append(external);
      const adopt = other.adoptNode.bind(other);
      // Deterministic host reaction seam: actual adoptNode completes its physical
      // detach/adoption, then invokes the synchronous user reaction before returning.
      vi.spyOn(other, 'adoptNode').mockImplementation((node) => {
        const result = adopt(node);
        if (node === el) {
          if (mode === 'unmount') mount.unmount(el);
          else external.append(el);
        }
        return result;
      });
      adoptWebComponentPortalProjections(owner, other);
      expect(el.parentNode).toBe(mode === 'unmount' ? null : external);
      mount.unmount(el);
      expect(el.parentNode).toBe(mode === 'unmount' ? null : external);
      expect(isWebComponentPortaled(el)).toBe(false);
    }
  );
});

it('restore does not reclaim a target reparented by synchronous logical-surface notification', () => {
  const owner = document.createElement('section'),
    el = document.createElement('div');
  const external = document.createElement('article');
  owner.append(el);
  document.body.append(owner, external);
  const proto = { name: 'restore-reentry-review', setup: () => undefined };
  const ownerToken = markProtoInstance(owner, proto),
    token = markProtoInstance(el, proto);
  mergeLogicalTriggerGroup(ownerToken, ownerToken);
  mergeLogicalTriggerGroup(token, ownerToken);
  const mount = createWebComponentPortalMount();
  mount.mount(el);
  const moved = vi.fn(() => external.append(el));
  const off = subscribeLogicalTriggerSurface(token, moved);
  try {
    mount.unmount(el);
    expect(moved).toHaveBeenCalled();
    expect(el.parentNode).toBe(external);
    expect(isWebComponentPortaled(el)).toBe(false);
  } finally {
    off();
  }
});
