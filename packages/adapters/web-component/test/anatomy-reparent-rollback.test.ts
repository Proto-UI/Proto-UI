import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  createContextKey,
  definePrototype,
  type RunHandle,
} from '@proto.ui/core';
import { AdaptToWebComponent } from '../src/adapt';
import { getLogicalParent, getLogicalRoot } from '../src/platform/instance-tree';
import type { LogicalInstanceToken } from '@proto.ui/adapter-base';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
let sequence = 0;
type ElementWithOwner = HTMLElement & {
  _instanceToken: LogicalInstanceToken;
  getExposes(): { hide(): void; read(): string | null; parts(): readonly string[] };
};

async function fixture() {
  const suffix = ++sequence;
  const family = createAnatomyFamily(`rollback-${suffix}`, {
    roles: { root: { cardinality: { min: 1, max: 1 } }, item: { cardinality: { min: 0, max: 1 } } },
  });
  const context = createContextKey<{ name: string }>(`rollback-context-${suffix}`);
  const placementError = new Error('the destination permits only one item');
  const make = (name: string, role: 'root' | 'item') => {
    let run!: RunHandle<Record<string, unknown>>;
    const proto = definePrototype({
      name: `x-reparent-${suffix}-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role });
        if (role === 'root') def.context.provide(context, { name });
        def.context.trySubscribe(context);
        if (role === 'root')
          def.anatomy.subscribeParts(family, 'item', (_run, parts) => {
            if (parts.length > 1) throw placementError;
          });
        def.expose.value('name', name);
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose.method('hide', () => run.lifecycle.setPresent(false));
        def.expose.method('read', () => run.context.tryRead(context)?.name ?? null);
        def.expose.method('parts', () =>
          run.anatomy.parts(family).map((part) => part.getExpose('name') as string)
        );
        return (r) => r.slot();
      },
    });
    AdaptToWebComponent(proto, { schedule: (task) => task() });
    return document.createElement(proto.name) as ElementWithOwner;
  };
  const original = make('original', 'root');
  const destination = make('destination', 'root');
  const child = make('child', 'item');
  const occupied = make('occupied', 'item');
  original.append(child);
  destination.append(occupied);
  document.body.append(original, destination);
  await flush();
  return { original, destination, child, occupied, placementError };
}

describe('WC rejected adoption preserves logical ownership', () => {
  it('accepts a valid move from a hidden retained owner without replacing the child', async () => {
    const { original, destination, child, occupied } = await fixture();
    const childToken = child._instanceToken;
    original.getExposes().hide();
    occupied.remove();
    await flush();
    destination.append(child);
    expect(child._instanceToken).toBe(childToken);
    expect(getLogicalParent(childToken)).toBe(destination._instanceToken);
    expect(child.getExposes().read()).toBe('destination');
    expect(new Set(child.getExposes().parts())).toEqual(new Set(['destination', 'child']));
  });
  it.each([false, true])(
    'restores the accepted domain when the old view is detached=%s',
    async (detached) => {
      const { original, destination, child, placementError } = await fixture();
      const originalToken = original._instanceToken;
      const childToken = child._instanceToken;
      expect(getLogicalParent(childToken)).toBe(originalToken);
      expect(child.getExposes().read()).toBe('original');
      if (detached) {
        original.getExposes().hide();
        await flush();
        expect(original.hasAttribute('data-pui-view-detached')).toBe(true);
        expect(getLogicalRoot(originalToken)).toBe(original);
        expect(getLogicalParent(childToken)).toBe(originalToken);
      }
      let caught: unknown;
      try {
        destination.append(child);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(placementError);
      expect(child._instanceToken).toBe(childToken);
      expect(getLogicalParent(childToken)).toBe(originalToken);
      expect(child.getExposes().read()).toBe('original');
      expect(new Set(child.getExposes().parts())).toEqual(new Set(['original', 'child']));
    }
  );
});
