import { afterEach, expect, it, vi } from 'vitest';
import { registerWebPortalDestination, subscribeWebPortalProjection } from '@proto.ui/adapter-base';
import { createVue2OverlayGlobalMount } from '../src/runtime/modules';
import { registerPortalViewReadiness } from '../src/platform/portal-readiness';
import {
  bindLogicalParent,
  createLogicalInstance,
  getProtoParent,
  markProtoInstance,
} from '../src/platform/instance-tree';

const releases: Array<() => void> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const release of releases.splice(0).reverse()) release();
  document.body.replaceChildren();
});
const retain = (release: () => void) => {
  releases.push(release);
  return release;
};
function fixture() {
  const scene = document.createElement('section');
  const owner = document.createElement('div');
  const target = document.createElement('div');
  const destination = document.createElement('div');
  const replacement = document.createElement('div');
  owner.append(target);
  scene.append(owner, destination, replacement);
  document.body.append(scene);
  const proto = { name: 'vue2-destination-reentry', setup: () => undefined };
  const parent = createLogicalInstance(proto);
  const token = createLogicalInstance(proto);
  bindLogicalParent(token, parent);
  markProtoInstance(owner, proto, parent);
  markProtoInstance(target, proto, token);
  const initialRelease = retain(registerWebPortalDestination(scene, destination));
  return { scene, owner, target, destination, replacement, token, initialRelease };
}

it('Vue2 retired direction cleanup cannot erase a replacement destination lease acquired reentrantly', () => {
  const f = fixture();
  const oldMount = createVue2OverlayGlobalMount(f.token);
  const newMount = createVue2OverlayGlobalMount(f.token);
  retain(() => oldMount.unmount(f.target));
  retain(() => newMount.unmount(f.target));
  oldMount.mount(f.target);
  expect(f.target.parentNode).toBe(f.destination);
  const remove = f.target.removeAttribute.bind(f.target);
  let replaced = false;
  // A deterministic synchronous author reaction at the real direction-release
  // write. This is a lifetime test, not a claim about native browser callback order.
  vi.spyOn(f.target, 'removeAttribute').mockImplementation((name) => {
    remove(name);
    if (name !== 'dir' || replaced) return;
    replaced = true;
    f.owner.append(f.target);
    retain(registerWebPortalDestination(f.scene, f.replacement));
    newMount.mount(f.target);
  });
  oldMount.unmount(f.target);
  expect(replaced).toBe(true);
  expect(f.target.parentNode).toBe(f.replacement);
  expect(getProtoParent(f.target)).toBe(f.owner);
  f.initialRelease();
  oldMount.unmount(f.target);
  expect(f.target.parentNode).toBe(f.replacement);
  retain(registerWebPortalDestination(f.scene, f.destination));
  // The newer live view retains its selected destination until release.
  expect(f.target.parentNode).toBe(f.replacement);
  newMount.unmount(f.target);
  expect(f.target.parentNode).toBe(f.owner);
  expect(f.owner.childNodes).toHaveLength(1);
});

it('Vue2 terminal release from a projection callback leaves no destination subscriber or origin marker', () => {
  const f = fixture();
  const mount = createVue2OverlayGlobalMount(f.token);
  retain(() => mount.unmount(f.target));
  let retired = false;
  retain(
    subscribeWebPortalProjection(f.target, () => {
      if (retired) return;
      retired = true;
      mount.unmount(f.target);
    })
  );
  mount.mount(f.target);
  expect(retired).toBe(true);
  expect(f.target.parentNode).toBe(f.owner);
  expect(f.owner.childNodes).toHaveLength(1);
  retain(registerWebPortalDestination(f.scene, f.replacement));
  expect(f.target.parentNode).toBe(f.owner);
  mount.unmount(f.target);
  expect(f.owner.childNodes).toHaveLength(1);
});

it('Vue2 release before the first mount acquires no destination or projection lease', () => {
  const f = fixture();
  const mount = createVue2OverlayGlobalMount(f.token);
  const projected = vi.fn();
  retain(subscribeWebPortalProjection(f.target, projected));
  mount.unmount(f.target);
  retain(registerWebPortalDestination(f.scene, f.replacement));
  expect(f.target.parentNode).toBe(f.owner);
  expect(f.owner.childNodes).toHaveLength(1);
  expect(projected).not.toHaveBeenCalled();
});

it('Vue2 reconnect publishes current descendant readiness and excludes released views', () => {
  const f = fixture();
  const child = document.createElement('div');
  f.target.append(child);
  const mount = createVue2OverlayGlobalMount(f.token);
  retain(() => mount.unmount(f.target));
  const retired = vi.fn();
  const releaseOldView = retain(registerPortalViewReadiness(child, retired));
  const current = vi.fn(() =>
    expect(child.isConnected && f.destination.contains(child)).toBe(true)
  );
  retain(registerPortalViewReadiness(child, current));
  releaseOldView();
  mount.mount(f.target);
  expect(current).toHaveBeenCalledOnce();
  expect(retired).not.toHaveBeenCalled();
});

it('Vue2 readiness reentry cannot publish remaining children from a retired Portal epoch', () => {
  const f = fixture();
  const first = document.createElement('div');
  const second = document.createElement('div');
  f.target.append(first, second);
  const mount = createVue2OverlayGlobalMount(f.token);
  retain(() => mount.unmount(f.target));
  const remaining = vi.fn();
  const projected = vi.fn();
  retain(registerPortalViewReadiness(first, () => mount.unmount(f.target)));
  retain(registerPortalViewReadiness(second, remaining));
  retain(subscribeWebPortalProjection(f.target, projected));
  mount.mount(f.target);
  expect(f.target.parentNode).toBe(f.owner);
  expect(f.owner.childNodes).toHaveLength(1);
  expect(remaining).not.toHaveBeenCalled();
  // The only public notification is the actual release, not stale mount success.
  expect(projected).toHaveBeenCalledOnce();
});
