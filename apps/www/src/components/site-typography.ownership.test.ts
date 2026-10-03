import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteTypographyParticipant } from './site-typography';
import { initDocumentationTypography } from './site-typography-client';
import { createProjectionScopeController } from './PrototypePreviewer/projection-scope';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
const preparation = vi.hoisted(() => ({
  hold: null as null | { reached(): void; gate: Promise<void> },
}));
vi.mock('./site-typography', async (original) => {
  const actual = await original<typeof import('./site-typography')>();
  return {
    ...actual,
    siteTypographyParticipant(...args: Parameters<typeof actual.siteTypographyParticipant>) {
      const participant = actual.siteTypographyParticipant(...args);
      return {
        ...participant,
        async materialize(request: Parameters<typeof participant.materialize>[0]) {
          const candidate = await participant.materialize(request);
          const held = preparation.hold;
          if (held) {
            preparation.hold = null;
            held.reached();
            await held.gate;
          }
          return candidate;
        },
      };
    },
  };
});
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/projection-theme', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-theme')>();
  return {
    resolveProjectionThemeSurfaceStyle: () => ({
      '--pui-background': '#fff',
      '--pui-foreground': '#111',
    }),
    applyProjectionThemeSurfaceStyle: actual.applyProjectionThemeSurfaceStyle,
    watchProjectionThemeSurfaceStyle: (
      _family: unknown,
      _root: unknown,
      callback: (value: Record<string, string>) => void
    ) => {
      callback({ '--pui-background': '#fff', '--pui-foreground': '#111' });
      return () => {};
    },
  };
});

const handles: Array<{ destroy(): Promise<void> }> = [];
const candidates: MaterializedProjectionCandidate[] = [];
afterEach(async () => {
  for (const h of handles.splice(0)) await h.destroy();
  for (const c of candidates.splice(0)) await c.dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 5));
};
const fixture = () => {
  document.body.innerHTML =
    '<main data-site-family-scope><div data-doc-flow><p id="body">Alpha <em>Beta</em> Gamma</p></div></main>';
  return document.querySelector<HTMLElement>('main')!;
};
const request = (runtime: 'wc' | 'react' | 'vue' | 'vue2', generation = 1) => ({
  generation,
  selection: { runtimeId: runtime, projectionFamilyId: 'shadcn' },
});

describe('independent typography owner review', () => {
  it('disposes when the documentation owner is detached, then admits the next owner', async () => {
    const root = fixture();
    const h = initDocumentationTypography(document)!;
    handles.push(h);
    await h.ready;
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
    await settle();
    root.remove();
    await settle();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    document.body.innerHTML =
      '<main data-site-family-scope><div data-doc-flow><p>Next route</p></div></main>';
    const next = initDocumentationTypography(document)!;
    handles.push(next);
    await next.ready;
    expect(next).not.toBe(h);
    expect(document.querySelector('p')!.getAttribute('data-typography-owner')).toBe(
      'documentation-typography'
    );
  });
  it('projects newly appended native source under the current typography owner', async () => {
    const root = fixture();
    const h = initDocumentationTypography(document)!;
    handles.push(h);
    await h.ready;
    const p = root.querySelector('p')!;
    const source = document.createTextNode(' Fresh appended source');
    p.append(source);
    await settle();
    expect(p.textContent).toBe('Alpha Beta Gamma Fresh appended source');
    expect(source.parentElement?.closest('[data-site-typography-slot]')).not.toBeNull();
  });
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${runtime}: preserves a collapsed caret before the same inline child`, async () => {
      const root = fixture();
      const p = root.querySelector('p')!;
      const em = p.querySelector('em')!;
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(p, 1, p, 1);
      expect(selection.anchorNode).toBe(p);
      expect(selection.anchorOffset).toBe(1);
      const c = await siteTypographyParticipant(root).materialize(request(runtime));
      candidates.push(c);
      c.activate();
      expect(em.isConnected).toBe(true);
      expect(selection.anchorNode).toBe(p.querySelector('[data-site-typography-slot]'));
      expect(selection.anchorOffset).toBe(1);
    });
});

describe('independent lifecycle positive controls', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: interrupted preparation leaves original source and no batch`, async () => {
      const root = fixture();
      const original = root.innerHTML;
      const participant = siteTypographyParticipant(root);
      const pending = participant.materialize(request(runtime));
      participant.destroy();
      await expect(pending).rejects.toThrow('disposed during preparation');
      expect(root.innerHTML).toBe(original);
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    });
    it(`${runtime}: stale prepared work cannot retire the new source owner`, async () => {
      const root = fixture();
      const original = root.innerHTML;
      const p = root.querySelector('p')!;
      const source = p.firstChild;
      const participant = siteTypographyParticipant(root);
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      const controller = createProjectionScopeController({
        initialSelection: { runtimeId: runtime, projectionFamilyId: 'shadcn' },
        async materialize(req) {
          if (req.generation === 2) await held;
          return participant.materialize(req);
        },
      });
      handles.push(controller);
      await controller.start();
      const stale = controller.request({ projectionFamilyId: 'brutalist' });
      const current = controller.request({ projectionFamilyId: 'shadcn' }, { force: true });
      await current;
      expect(p.dataset.typographyGeneration).toBe('3');
      release();
      await stale;
      expect(p.dataset.typographyGeneration).toBe('3');
      expect(p.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
      await controller.destroy();
      expect(root.innerHTML).toBe(original);
    });
  }
  it('explicit destroy permits clean documentation re-init', async () => {
    const root = fixture();
    const source = root.querySelector('p')!.firstChild;
    const h = initDocumentationTypography(document)!;
    handles.push(h);
    await h.ready;
    await h.destroy();
    const next = initDocumentationTypography(document)!;
    handles.push(next);
    await next.ready;
    expect(next).not.toBe(h);
    expect(root.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
  });
});

describe('source sibling order and immediate owner replacement', () => {
  it('reconciles a source addition whose observer ran during empty-scope preparation', async () => {
    document.body.innerHTML = '<main data-site-family-scope><div data-doc-flow></div></main>';
    const root = document.querySelector('main')!;
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prepared = new Promise<void>((resolve) => {
      reached = resolve;
    });
    preparation.hold = { gate, reached };
    const handle = initDocumentationTypography(document)!;
    handles.push(handle);
    try {
      await prepared;
      const source = document.createElement('p');
      source.textContent = 'Arrived during preparation';
      root.querySelector('[data-doc-flow]')!.append(source);
      await settle();
      expect(source.querySelector('[data-site-typography-slot]')).toBeNull();
      release();
      await handle.ready;
      await vi.waitFor(() => expect(source.getAttribute('data-typography-runtime')).toBe('wc'));
      expect(source.textContent).toBe('Arrived during preparation');
    } finally {
      release();
      preparation.hold = null;
    }
  });
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${runtime}: absorbs appended/prepended/inserted source exactly once in native order`, async () => {
      localStorage.setItem(PREFERRED_ADAPTER_KEY, runtime);
      const root = fixture();
      const p = root.querySelector('p')!;
      const originals = Array.from(p.childNodes);
      const h = initDocumentationTypography(document)!;
      handles.push(h);
      await h.ready;
      const carrier = p.firstChild!;
      const prefix = document.createTextNode('Prefix ');
      const inserted = document.createElement('strong');
      inserted.textContent = 'Inserted ';
      const suffix = document.createTextNode(' Suffix');
      p.append(suffix);
      p.prepend(prefix);
      p.insertBefore(inserted, carrier);
      const expected = [prefix, inserted, ...originals, suffix];
      await vi.waitFor(() =>
        expect(Array.from(p.querySelector('[data-site-typography-slot]')!.childNodes)).toEqual(
          expected
        )
      );
      expect(p.childNodes).toHaveLength(1);
      expect(p.textContent).toBe('Prefix Inserted Alpha Beta Gamma Suffix');
      expect(document.querySelectorAll('#body')).toHaveLength(1);
      // A later replacement is a new source, never an invitation to reinsert
      // retired original nodes. It is projected using the same selected runtime.
      p.textContent = 'Completely replaced source';
      const replacement = p.firstChild!;
      await vi.waitFor(() =>
        expect(p.querySelector('[data-site-typography-slot]')?.firstChild).toBe(replacement)
      );
      expect(p.dataset.typographyRuntime).toBe(runtime);
      await h.destroy();
      expect(Array.from(p.childNodes)).toEqual([replacement]);
      expect(originals.every((node) => !node.isConnected)).toBe(true);
    });
  it('admits a replacement before observer delivery and stale teardown cannot revoke it', async () => {
    const root = fixture();
    const old = initDocumentationTypography(document)!;
    handles.push(old);
    await old.ready;
    root.remove();
    const nextRoot = document.createElement('main');
    nextRoot.dataset.siteFamilyScope = '';
    nextRoot.innerHTML = '<div data-doc-flow><p>Immediate new owner</p></div>';
    document.body.append(nextRoot);
    const source = nextRoot.querySelector('p')!.firstChild;
    const next = initDocumentationTypography(document)!;
    handles.push(next);
    expect(next).not.toBe(old);
    const oldDisposal = old.destroy();
    expect(old.destroy()).toBe(oldDisposal);
    await Promise.all([next.ready, oldDisposal]);
    await settle();
    expect(initDocumentationTypography(document)).toBe(next);
    expect(nextRoot.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() =>
      expect(nextRoot.querySelector('p')!.dataset.typographyRuntime).toBe('react')
    );
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
  });
  it('revokes a scope when its entire containing subtree is removed', async () => {
    const root = fixture();
    const parent = document.createElement('section');
    root.replaceWith(parent);
    parent.append(root);
    const h = initDocumentationTypography(document)!;
    handles.push(h);
    await h.ready;
    parent.remove();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0)
    );
    expect(root.querySelector('[data-site-typography-carrier]')).toBeNull();
  });
});

describe('element selection boundaries across the complete source lease', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: maps start/interior/end boundaries through replace, rollback and teardown`, async () => {
      for (const offset of [0, 1, 2, 3]) {
        const root = fixture();
        const p = root.querySelector('p')!;
        const original = Array.from(p.childNodes);
        const selection = document.getSelection()!;
        selection.setBaseAndExtent(p, offset, p, offset);
        const participant = siteTypographyParticipant(root);
        let fail = false;
        const controller = createProjectionScopeController({
          initialSelection: { runtimeId: runtime, projectionFamilyId: 'shadcn' },
          materialize: participant.materialize,
          prepareCommit: () => ({
            publish() {
              if (fail) throw new Error('publication rejected');
            },
            rollback() {},
          }),
        });
        handles.push(controller);
        await controller.start();
        const assertBoundary = (owner: Node) => {
          expect(selection.anchorNode).toBe(owner);
          expect(selection.anchorOffset).toBe(offset);
          expect(selection.focusNode).toBe(owner);
          expect(selection.focusOffset).toBe(offset);
        };
        assertBoundary(p.querySelector('[data-site-typography-slot]')!);
        await controller.request({ projectionFamilyId: 'brutalist' });
        const retained = p.querySelector('[data-site-typography-slot]')!;
        assertBoundary(retained);
        fail = true;
        await expect(controller.request({ projectionFamilyId: 'shadcn' })).rejects.toThrow(
          'publication rejected'
        );
        expect(p.querySelector('[data-site-typography-slot]')).toBe(retained);
        assertBoundary(retained);
        await controller.destroy();
        assertBoundary(p);
        expect(Array.from(p.childNodes)).toEqual(original);
      }
    }, 15000);
    it(`${runtime}: maps a caret after the carrier to the source end and preserves an empty slot caret`, async () => {
      const root = fixture();
      const p = root.querySelector('p')!;
      const participant = siteTypographyParticipant(root);
      const controller = createProjectionScopeController({
        initialSelection: { runtimeId: runtime, projectionFamilyId: 'shadcn' },
        materialize: participant.materialize,
      });
      handles.push(controller);
      await controller.start();
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(p, 1, p, 1);
      await controller.request({ projectionFamilyId: 'brutalist' });
      let slot = p.querySelector('[data-site-typography-slot]')!;
      expect(selection.anchorNode).toBe(slot);
      expect(selection.anchorOffset).toBe(3);
      slot.replaceChildren();
      selection.setBaseAndExtent(slot, 0, slot, 0);
      await controller.request({ projectionFamilyId: 'shadcn' });
      slot = p.querySelector('[data-site-typography-slot]')!;
      expect(selection.anchorNode).toBe(slot);
      expect(selection.anchorOffset).toBe(0);
      await controller.destroy();
      expect(selection.anchorNode).toBe(p);
      expect(selection.anchorOffset).toBe(0);
      expect(p.childNodes).toHaveLength(0);
    });
  }
  for (const [anchor, focus] of [
    [1, 2],
    [2, 1],
  ])
    it(`maps directional endpoint pair ${anchor} → ${focus} with an explicit HappyDOM getter fixture`, async () => {
      const root = fixture();
      const p = root.querySelector('p')!;
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(p, anchor!, p, focus!);
      // HappyDOM 15 aliases focusOffset to anchorOffset. Supply only that known
      // missing getter to test endpoint forwarding; real browser range behavior
      // and backward selection remain a separate required acceptance check.
      vi.spyOn(selection, 'focusOffset', 'get').mockReturnValue(focus!);
      const restore = vi.spyOn(selection, 'setBaseAndExtent');
      const participant = siteTypographyParticipant(root);
      const first = await participant.materialize(request('react', 1));
      candidates.push(first);
      first.activate();
      let slot = p.querySelector('[data-site-typography-slot]')!;
      expect(restore).toHaveBeenLastCalledWith(slot, anchor, slot, focus);
      const next = await participant.materialize(request('vue', 2));
      candidates.push(next);
      next.activate();
      slot = p.querySelector('[data-site-typography-slot]')!;
      expect(restore).toHaveBeenLastCalledWith(slot, anchor, slot, focus);
      first.activate(); // Same retained-candidate operation used by scope rollback.
      slot = p.querySelector('[data-site-typography-slot]')!;
      expect(restore).toHaveBeenLastCalledWith(slot, anchor, slot, focus);
      await next.dispose();
      const newText = document.createTextNode('New ');
      const newEmphasis = document.createElement('em');
      newEmphasis.textContent = 'source';
      const newEnd = document.createTextNode(' only');
      p.replaceChildren(newText, newEmphasis, newEnd);
      selection.setBaseAndExtent(p, anchor!, p, focus!);
      const replacement = await participant.materialize(request('wc', 3));
      candidates.push(replacement);
      replacement.activate();
      slot = p.querySelector('[data-site-typography-slot]')!;
      expect(Array.from(slot.childNodes)).toEqual([newText, newEmphasis, newEnd]);
      expect(restore).toHaveBeenLastCalledWith(slot, anchor, slot, focus);
      await first.dispose();
      await replacement.dispose();
      expect(Array.from(p.childNodes)).toEqual([newText, newEmphasis, newEnd]);
      expect(restore).toHaveBeenLastCalledWith(p, anchor, p, focus);
    });
});
