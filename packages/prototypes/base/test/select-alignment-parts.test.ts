import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
import {
  SELECT_FAMILY,
  selectSurface,
  selectViewport,
  selectItemText,
  asSelectSurface,
  asSelectViewport,
  asSelectItemText,
} from '../src/select';

async function fixture() {
  const parents = new Map<object, object | null>();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  const readers: any[] = [];
  const claim = (role: string, profile?: string) =>
    definePrototype({
      name: `test-select-${role}`,
      setup(def) {
        def.anatomy.claim(SELECT_FAMILY, { role, ...(profile ? { profile } : {}) });
        def.lifecycle.onMounted((run) => readers.push(run.anatomy));
        return (r) => {
          readers.push(r.read.anatomy);
          return [r.r.slot()];
        };
      },
    });
  const add = async (proto: Prototype<any>, parent: object | null = null) => {
    const token = {};
    parents.set(token, parent);
    const commits: any[] = [];
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (t) => t(),
      commit: (c, signal) => {
        commits.push(c);
        signal?.done();
      },
      onRuntimeReady: (w) =>
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (i: unknown) => parents.get(i as object) ?? null],
          [ANATOMY_GET_PROTO_CAP, () => proto],
        ]),
    });
    sessions.push(session);
    await session.mount();
    return { token, session, commits, port: session.caps.getPort<AnatomyPort>('anatomy')! };
  };
  return {
    add,
    claim,
    readers,
    dispose: async () => {
      for (const s of sessions.reverse()) await s.dispose();
    },
  };
}

describe('Select alignment structural parts', () => {
  it('registers real scoped parts through runtime and render readers while preserving slots', async () => {
    const f = await fixture();
    try {
      const root = await f.add(f.claim('root', 'item-aligned'));
      const trigger = await f.add(f.claim('trigger'), root.token);
      await f.add(f.claim('value'), trigger.token);
      const content = await f.add(f.claim('content'), root.token);
      const surface = await f.add(selectSurface, content.token);
      const viewport = await f.add(selectViewport, surface.token);
      const row = await f.add(f.claim('item'), viewport.token);
      const text = await f.add(selectItemText, row.token);
      const row2 = await f.add(f.claim('item'), viewport.token);
      await f.add(selectItemText, row2.token);
      expect(root.port.getDiagnostics()).toEqual([]);
      const [item] = root.port.parts(SELECT_FAMILY).filter((p) => p.role === 'item');
      for (const reader of f.readers) {
        const scoped = reader.descendantsOf(SELECT_FAMILY, item!, 'item-text');
        expect(scoped).toHaveLength(1);
        expect(scoped[0].role).toBe('item-text');
      }
      for (const part of [surface, viewport, text]) {
        expect(JSON.stringify(part.commits)).toContain('slot');
        expect(part.session.caps.getPort<AnatomyPort>('anatomy')!.getDiagnostics()).toEqual([]);
      }
    } finally {
      await f.dispose();
    }
  });

  it('preserves existing edge compositions without mandatory new parts', async () => {
    const f = await fixture();
    try {
      const root = await f.add(f.claim('root'));
      const content = await f.add(f.claim('content'), root.token);
      await f.add(f.claim('item'), content.token);
      expect(root.port.getDiagnostics()).toEqual([]);
    } finally {
      await f.dispose();
    }
  });

  it('reports missing aligned profile parts without silently replacing positioning', async () => {
    const f = await fixture();
    try {
      const root = await f.add(f.claim('root', 'item-aligned'));
      expect(
        root.port
          .getDiagnostics()
          .filter((d) => d.scope === 'profile')
          .map((d) => d.role)
          .sort()
      ).toEqual(['content', 'surface', 'trigger', 'value', 'viewport']);
    } finally {
      await f.dispose();
    }
  });

  it('keeps asHook structural entries equivalent to direct prototypes', async () => {
    const f = await fixture();
    try {
      const root = await f.add(f.claim('root'));
      const content = await f.add(f.claim('content'), root.token);
      const wrapped = (name: string, hook: () => any) =>
        definePrototype({
          name,
          setup() {
            hook();
            return (r) => [r.r.slot()];
          },
        });
      const surface = await f.add(wrapped('styled-surface', asSelectSurface), content.token);
      const viewport = await f.add(wrapped('styled-viewport', asSelectViewport), surface.token);
      const item = await f.add(f.claim('item'), viewport.token);
      await f.add(wrapped('styled-text', asSelectItemText), item.token);
      expect(root.port.getDiagnostics()).toEqual([]);
      expect(root.port.parts(SELECT_FAMILY).map((p) => p.role)).toEqual([
        'root',
        'content',
        'surface',
        'viewport',
        'item',
        'item-text',
      ]);
    } finally {
      await f.dispose();
    }
  });
});
