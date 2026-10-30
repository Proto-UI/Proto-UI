import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { AdaptToWebComponent } from '../../src/adapt';
import { withWebComponentOwnedRelocation } from '../../src/owned-relocation';

let sequence = 0;
afterEach(async () => {
  document.body.replaceChildren();
  await Promise.resolve();
});

function fixture() {
  let run!: RunHandle<any>;
  let disposed = 0;
  const proto = definePrototype({
    name: `view-operation-source-${++sequence}`,
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.lifecycle.onBeforeDispose(() => {
        disposed += 1;
      });
      def.expose('capture', () => run.lifecycle.captureViewOperation());
      return (renderer) => renderer.el('span', 'source');
    },
  });
  AdaptToWebComponent(proto, { schedule: (task) => task() });
  const source = document.createElement(proto.name) as HTMLElement & {
    getExposes(): { capture(): ViewOperation | null };
  };
  const root = document.createElement('section');
  root.append(source);
  document.body.append(root);
  const capture = () => source.getExposes().capture();
  return { source, root, capture, disposed: () => disposed };
}

describe('WC source-view withdrawal versus owned transport', () => {
  for (const removal of ['root', 'source'] as const) {
    it(`invalidates ${removal} removal before deferred terminal retirement`, () => {
      const f = fixture();
      const operation = f.capture()!;
      expect(operation.isCurrent()).toBe(true);
      (removal === 'root' ? f.root : f.source).remove();
      expect(f.disposed()).toBe(0);
      expect(operation.isCurrent()).toBe(false);
    });
  }

  it('does not revive after an unrelated same-turn remove/reinsert', () => {
    const f = fixture();
    const operation = f.capture()!;
    f.source.remove();
    f.root.append(f.source);
    expect(f.source.isConnected).toBe(true);
    expect(f.disposed()).toBe(0);
    expect(operation.isCurrent()).toBe(false);
    expect(f.capture()?.isCurrent()).toBe(true);
  });

  it('does not revive across actual terminal owner replacement on the same element without intermediate queries', async () => {
    const f = fixture();
    const operation = f.capture()!;
    f.source.remove();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    expect(f.disposed()).toBe(1);
    f.root.append(f.source);
    expect(operation.isCurrent()).toBe(false);
    expect(f.capture()?.isCurrent()).toBe(true);
  });

  it('preserves the exact same-owner adapter transport without advancing lifecycle', () => {
    const f = fixture();
    const operation = f.capture()!;
    const destination = document.createElement('aside');
    document.body.append(destination);
    withWebComponentOwnedRelocation([f.source], destination, () => destination.append(f.source));
    expect(f.source.parentElement).toBe(destination);
    expect(f.disposed()).toBe(0);
    expect(operation.isCurrent()).toBe(true);
  });

  it('does not revive after author removal nested inside a valid transport or its finally', () => {
    const f = fixture();
    const operation = f.capture()!;
    const destination = document.createElement('aside');
    document.body.append(destination);
    withWebComponentOwnedRelocation([f.source], destination, () => {
      destination.append(f.source);
      expect(operation.isCurrent()).toBe(true);
      f.source.remove();
      destination.append(f.source);
    });
    expect(f.source.parentElement).toBe(destination);
    expect(operation.isCurrent()).toBe(false);
    expect(f.disposed()).toBe(0);
  });

  it('invalidates a rejected second reconnect claim even when both moves end at the authorized path', () => {
    const f = fixture();
    const operation = f.capture()!;
    const destination = document.createElement('aside');
    document.body.append(destination);
    withWebComponentOwnedRelocation([f.source], destination, () => {
      destination.append(f.source);
      destination.append(f.source);
    });
    expect(f.source.parentElement).toBe(destination);
    expect(operation.isCurrent()).toBe(false);
    expect(f.disposed()).toBe(0);
  });

  it('keeps a valid operation across a transport exception that leaves its view untouched', () => {
    const f = fixture();
    const operation = f.capture()!;
    const failure = new Error('move aborted before mutation');
    expect(() =>
      withWebComponentOwnedRelocation([f.source], document.body, () => {
        throw failure;
      })
    ).toThrow(failure);
    expect(f.source.parentElement).toBe(f.root);
    expect(operation.isCurrent()).toBe(true);
  });
});
