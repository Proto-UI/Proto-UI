import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';

import { AdaptToWebComponent, type WebComponentAdapterElement } from '../../src/adapt';

async function flushWebComponentAdapter() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('contract: adapter-web-component / lifecycle events (v1)', () => {
  it('exposes the structured instance, mount, update, and disposal event trace', async () => {
    const trace: RuntimeLifecycleEvent[] = [];
    const proto: Prototype = {
      name: 'x-wc-lifecycle-events',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };

    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: proto.name,
      diagnostics: {
        onLifecycleEvent: (event) => trace.push(event),
      },
    });
    if (!customElements.get(proto.name)) customElements.define(proto.name, Ctor);

    const el = document.createElement(proto.name) as WebComponentAdapterElement;
    document.body.appendChild(el);
    await flushWebComponentAdapter();

    expect(trace).toEqual([
      { type: 'instance.setup.exit' },
      { type: 'instance.phase', phase: 'alive' },
      { type: 'instance.created' },
      { type: 'mount.phase', phase: 'mounting', epoch: 1 },
      { type: 'mount.render', epoch: 1 },
      { type: 'mount.commit.start', epoch: 1 },
      { type: 'mount.commit.done', epoch: 1 },
      { type: 'mount.phase', phase: 'mounted', epoch: 1 },
      { type: 'mount.mounted', epoch: 1 },
    ]);

    trace.length = 0;
    el.update();
    expect(trace).toEqual([
      { type: 'update.render', epoch: 1, revision: 1 },
      { type: 'update.commit.done', epoch: 1, revision: 1 },
      { type: 'update.updated', epoch: 1, revision: 1 },
    ]);

    trace.length = 0;
    el.remove();
    await flushWebComponentAdapter();

    expect(trace).toEqual([
      { type: 'instance.phase', phase: 'disposing' },
      { type: 'instance.dispose.begin' },
      { type: 'mount.phase', phase: 'unmounting', epoch: 1 },
      { type: 'unmount.begin', epoch: 1 },
      { type: 'mount.phase', phase: 'detached', epoch: 1 },
      { type: 'unmount.done', epoch: 1 },
      { type: 'instance.phase', phase: 'disposed' },
      { type: 'instance.dispose.done' },
    ]);
  });
});
