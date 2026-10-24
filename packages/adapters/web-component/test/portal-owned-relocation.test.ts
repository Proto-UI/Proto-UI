import { afterEach, expect, it, vi } from 'vitest';
import {
  createWebComponentPortalMount,
  isWebComponentPortalRelocating,
  isWebComponentPortaled,
} from '../src/portal-mount';
import {
  getWebPortalMaterialEpochSnapshot,
  registerWebPortalDestination,
  subscribeWebPortalMaterialSuspension,
} from '@proto.ui/adapter-base';
let id = 0;
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('direct body no-op owns one material epoch without moving or marking a projection', () => {
  const host = document.createElement('input');
  document.body.append(host);
  host.focus();
  const move = vi.spyOn(document.body, 'appendChild');
  const mount = createWebComponentPortalMount();
  mount.mount(host);
  const first = getWebPortalMaterialEpochSnapshot(host);
  expect(first.owner).not.toBeNull();
  expect(first.suspended).toBe(false);
  expect(isWebComponentPortaled(host)).toBe(false);
  mount.mount(host);
  expect(getWebPortalMaterialEpochSnapshot(host).owner).toBe(first.owner);
  expect(move).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(host);
  mount.unmount(host);
  expect(getWebPortalMaterialEpochSnapshot(host).owner).toBeNull();
  expect(host.parentNode).toBe(document.body);
  mount.mount(host);
  expect(getWebPortalMaterialEpochSnapshot(host).owner).not.toBe(first.owner);
  mount.unmount(host);
});
it('private relocation window is exception-safe and ordinary reconnect is not marked', () => {
  const origin = document.createElement('div'),
    host = document.createElement('div');
  origin.append(host);
  document.body.append(origin);
  const mount = createWebComponentPortalMount(),
    append = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      expect(isWebComponentPortalRelocating(host)).toBe(false);
      throw new Error('failed physical move');
    });
  expect(() => mount.mount(host)).toThrow('failed physical move');
  expect(isWebComponentPortalRelocating(host)).toBe(false);
  expect(host.parentNode).toBe(origin);
  append.mockRestore();
  host.setAttribute('data-pui-portal-relocating', 'true');
  expect(isWebComponentPortalRelocating(host)).toBe(false);
  mount.mount(host);
  expect(isWebComponentPortalRelocating(host)).toBe(false);
  mount.unmount(host);
  expect(isWebComponentPortalRelocating(host)).toBe(false);
});
it('nested authoritative moves retain their own synchronous guards', () => {
  const origin = document.createElement('div');
  document.body.append(origin);
  const second = document.createElement('div');
  origin.append(second);
  const nested = createWebComponentPortalMount(),
    seen: boolean[] = [];
  class Probe extends HTMLElement {
    connectedCallback() {
      if (!isWebComponentPortalRelocating(this)) return;
      seen.push(true);
      nested.mount(second);
      seen.push(isWebComponentPortalRelocating(this));
    }
  }
  const name = `portal-relocation-${++id}`;
  customElements.define(name, Probe);
  const first = document.createElement(name);
  origin.append(first);
  const mount = createWebComponentPortalMount();
  mount.mount(first);
  expect(seen).toEqual([true, true]);
  expect(isWebComponentPortalRelocating(first)).toBe(false);
  expect(isWebComponentPortalRelocating(second)).toBe(false);
  mount.unmount(first);
  nested.unmount(second);
});
it('retirement during connected move cannot leave a stale lease or guard', () => {
  const origin = document.createElement('div');
  document.body.append(origin);
  const mount = createWebComponentPortalMount();
  class Probe extends HTMLElement {
    connectedCallback() {
      if (isWebComponentPortalRelocating(this)) mount.unmount(this);
    }
  }
  const name = `portal-retire-${++id}`;
  customElements.define(name, Probe);
  const host = document.createElement(name);
  origin.append(host);
  mount.mount(host);
  expect(isWebComponentPortalRelocating(host)).toBe(false);
  expect(isWebComponentPortaled(host)).toBe(false);
  expect(getWebPortalMaterialEpochSnapshot(host).owner).toBeNull();
  expect(host.parentNode).toBe(origin);
});

it('no-op acquisition cannot commit after a begin notification changes destination policy', () => {
  const host = document.createElement('div'),
    destination = document.createElement('div');
  document.body.append(host, destination);
  let changed = false,
    remove = () => {};
  const off = subscribeWebPortalMaterialSuspension(host, () => {
    if (!changed) {
      changed = true;
      remove = registerWebPortalDestination(document.body, destination);
    }
  });
  const mount = createWebComponentPortalMount();
  try {
    mount.mount(host);
    expect(getWebPortalMaterialEpochSnapshot(host).suspended).toBe(true);
    expect(host.parentNode).toBe(document.body);
    expect(isWebComponentPortaled(host)).toBe(false);
  } finally {
    off();
    mount.unmount(host);
    remove();
  }
});
it('same-document relocation authority does not survive reentrant foreign adoption', async () => {
  const foreign = document.implementation.createHTMLDocument();
  const origin = document.createElement('div');
  document.body.append(origin);
  const observations: boolean[] = [];
  class Probe extends HTMLElement {
    connectedCallback() {
      if (!isWebComponentPortalRelocating(this)) return;
      foreign.adoptNode(this);
      observations.push(isWebComponentPortalRelocating(this));
    }
  }
  const name = `portal-document-${++id}`;
  customElements.define(name, Probe);
  const host = document.createElement(name);
  origin.append(host);
  const mount = createWebComponentPortalMount();
  mount.mount(host);
  expect(observations).toEqual([false]);
  await new Promise((r) => setTimeout(r, 0));
  expect(isWebComponentPortalRelocating(host)).toBe(false);
  mount.unmount(host);
});
