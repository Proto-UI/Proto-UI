import { afterEach, expect, it } from 'vitest';
import { getElementProps, setElementProps } from '@proto.ui/adapter-web-component';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageShowcase } from './homepage-showcase';
let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
afterEach(async () => {
  await rendered?.destroy();
  rendered = undefined;
  document.body.replaceChildren();
});
for (const family of ['shadcn', 'brutalist'] as const) {
  it(`${family} retains full editor and preferences props through edits and resets`, async () => {
    const content = createHomepageShowcase(family, 'wc', 'en', () => true);
    await loadPrototypes([...content.recipe.prototypeIds]);
    const host = document.createElement('div');
    document.body.append(host);
    rendered = await renderDemo({ runtime: 'wc', demo: content.demo, host });
    const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
    const input = (name: string) => ref(name).querySelector<HTMLTextAreaElement>('textarea')!;
    const settle = async () => {
      for (let i = 0; i < 16; i++) await Promise.resolve();
    };
    const verify = () => {
      if (family === 'shadcn') {
        for (const name of ['settings-note', 'editor-text']) {
          const tokens = input(name).getAttribute('data-pui-style')?.split(/\s+/) ?? [];
          expect(tokens).toContain('rounded-[var(--pui-radius-2xl)]');
          expect(tokens).toContain('resize-none');
          expect(tokens).toContain('bg-input/50');
          expect(tokens).not.toContain('resize-y');
          expect(tokens).not.toContain('shadow-xs');
          expect(getElementProps(ref(name))).not.toHaveProperty('styleProfile');
        }
        const tabsList = host.querySelector<HTMLElement>('wc-shadcn-tabs-list')!;
        expect(tabsList.getAttribute('data-pui-style')?.split(/\s+/)).toContain('rounded-2xl');
        expect(getElementProps(tabsList)).not.toHaveProperty('styleProfile');
      }
      for (const name of ['settings-save', 'settings-reset', 'editor-reset']) {
        // Family-owned wrapping replaces homepage numeric height overrides.
        expect(getElementProps(ref(name))).toMatchObject({ wrap: true });
        for (const property of ['height', 'minHeight', 'whiteSpace', 'overflowWrap'] as const)
          expect(ref(name).style[property]).toBe('');
        const tokens = (ref(name).getAttribute('data-pui-style') ?? '').split(/\s+/);
        expect(tokens).toContain('h-auto');
        expect(tokens).toContain('whitespace-normal');
        expect(tokens).not.toContain('whitespace-nowrap');
        expect(tokens).toContain(family === 'brutalist' ? 'min-h-10' : 'min-h-8');
      }
      expect(Number(input('editor-text').rows)).toBe(4);
      expect(input('editor-text').getAttribute('aria-label')).toBe('Edit example text');
      expect(Number(input('settings-note').rows)).toBe(3);
      expect(Number(input('settings-note').maxLength)).toBe(240);
      expect(input('settings-note').placeholder).toBe('Add a note for this example');
      expect(input('settings-note').getAttribute('aria-label')).toBe('Additional note');
      expect(getElementProps(ref('settings-view'))).toMatchObject({ closeOnSelect: true });
      expect(getElementProps(ref('settings-reset'))).toMatchObject({
        variant: family === 'shadcn' ? 'outline' : 'surface',
      });
    };
    await settle();
    verify();
    const assertTextOwners = (owners: Element[]) => {
      // Direct WC rendering retains authored boxes inside detached content hosts.
      expect(owners).toHaveLength(35);
      expect(new Set(owners).size).toBe(35);
      expect(
        owners.filter((owner) => !owner.closest('[data-gallery-demo^="workspace-"]'))
      ).toHaveLength(24);
      const scenes = {
        'workspace-command': [
          'What comes next?',
          'Find a step to update the plan on this page.',
          'Page-only demo. No external actions.',
        ],
        'workspace-progress': [
          'Make room for an idea',
          'Drag or use arrow keys to adjust your plan.',
          'Plan progress: 40%',
        ],
        'workspace-help': [
          'A little help along the way',
          'Open a question and keep exploring.',
          'Choose a result in the step finder, or adjust the progress. Both scenes use the same page-local plan.',
          'Use Tab to move focus, arrows and Enter to choose search results, and arrows to adjust the slider.',
          'This is an interactive example on the current page. Nothing is uploaded, published or saved to an account. Reloading restores the defaults.',
        ],
      };
      for (const [id, texts] of Object.entries(scenes)) {
        const actual = owners.filter((owner) => owner.closest(`[data-gallery-demo="${id}"]`));
        expect(actual.map((owner) => owner.textContent?.trim())).toEqual(texts);
      }
    };
    const textOwners = Array.from(host.querySelectorAll('[data-home-text]'));
    assertTextOwners(textOwners);
    expect(() => assertTextOwners(textOwners.slice(1))).toThrow();
    expect(() => assertTextOwners([...textOwners, textOwners[0]!])).toThrow();
    expect(() => assertTextOwners([textOwners[0]!, ...textOwners.slice(0, -1)])).toThrow();
    for (const owner of host.querySelectorAll('[data-home-text]')) {
      const text = owner.querySelector('[data-pui-root]')!;
      expect(text).not.toBeNull();
      expect(text.getAttribute('data-pui-style')).toContain('font-');
      expect(owner.querySelectorAll('[data-pui-root]')).toHaveLength(1);
    }
    // Four formerly passive Text slots are now real Label prototypes. Keep
    // their own identity and exact one-control naming edges in the inventory.
    const labels = Array.from(host.querySelectorAll<HTMLElement>(`wc-${family}-label-root`));
    const expectedLabels = [
      ['gallery-checkbox', 'Select'],
      ['choice-product', 'Product updates'],
      ['choice-components', 'New components'],
      ['choice-events', 'Community events'],
    ] as const;
    const verifyLabels = () => {
      expect(labels).toHaveLength(4);
      const ids = labels.map((label) => label.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids.every(Boolean)).toBe(true);
      for (const [name, text] of expectedLabels) {
        const control = ref(name);
        const label = labels.find((label) => label.textContent?.trim() === text)!;
        expect(label, text).toBeDefined();
        expect(label.hasAttribute('data-pui-root')).toBe(true);
        expect(label.closest('[data-home-text]')).toBeNull();
        expect(label.getAttribute('data-pui-style')).toContain('font-');
        expect(control.getAttribute('role')).toBe('checkbox');
        expect(control.getAttribute('aria-labelledby')?.split(/\s+/)).toEqual([label.id]);
        for (const other of labels.filter((other) => other !== label)) {
          expect(control.getAttribute('aria-labelledby')?.split(/\s+/)).not.toContain(other.id);
        }
      }
    };
    verifyLabels();
    // Bounded observer negative controls: a missing or cross-wired relation
    // must not become a pass merely because the total owner count is 28.
    const labelledControl = ref('gallery-checkbox');
    const originalRelation = labelledControl.getAttribute('aria-labelledby')!;
    labelledControl.removeAttribute('aria-labelledby');
    expect(verifyLabels).toThrow();
    labelledControl.setAttribute(
      'aria-labelledby',
      labels.find((label) => label.textContent?.trim() === 'Product updates')!.id
    );
    expect(verifyLabels).toThrow();
    labelledControl.setAttribute('aria-labelledby', originalRelation);
    verifyLabels();
    for (const tile of host.querySelectorAll('[data-gallery-demo]')) {
      const surface = tile.querySelector('[data-pui-root]')!;
      if (family === 'shadcn') {
        expect(surface.localName).toBe('wc-shadcn-card-root');
        expect(getElementProps(surface as HTMLElement)).toEqual({ styleProfile: 'rhea' });
        expect(tile.querySelectorAll('wc-shadcn-card-header')).toHaveLength(1);
        expect(tile.querySelectorAll('wc-shadcn-card-content')).toHaveLength(1);
        const tokens = surface.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
        expect(tokens).toContain('rounded-[min(var(--pui-radius-4xl),24px)]');
        expect(tokens).toContain('py-5');
        expect(tokens).toContain('shadow-sm');
        for (const property of ['padding', 'borderRadius', 'background', 'boxShadow'] as const)
          expect((surface as HTMLElement).style[property]).toBe('');
      } else {
        const appearance =
          family === 'brutalist' && tile.getAttribute('data-gallery-demo') === 'editor'
            ? 'canvas'
            : 'card';
        expect(getElementProps(surface as HTMLElement)).toMatchObject({
          variant: 'outline',
          elevation: appearance === 'card' ? 'raised' : 'none',
        });
        expect(surface.getAttribute('data-pui-style')?.includes('shadow-')).toBe(
          appearance === 'card'
        );
      }
    }
    if (family === 'brutalist') {
      const tabsList = host.querySelector<HTMLElement>('[role="tablist"]')!;
      expect(tabsList).not.toBeNull();
      expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(tabsList.style.flexWrap).toBe('wrap');
      expect(tabsList.style.height).toBe('auto');
      expect(tabsList.style.minHeight).toBe('3rem');
      for (const trigger of host.querySelectorAll<HTMLElement>('[role="tab"]')) {
        expect(trigger.style.whiteSpace).toBe('normal');
        expect(trigger.style.maxWidth).toBe('100%');
      }
      const authored = content.demo.root;
      const visit = (node: unknown): any[] => {
        if (!node || typeof node !== 'object') return [];
        const value = node as { prototypeId?: string; children?: unknown[] };
        return [
          ...(value.prototypeId === 'brutalist-dialog-trigger' ? [value] : []),
          ...(value.children ?? []).flatMap(visit),
        ];
      };
      expect(visit(authored)[0].children).toEqual(['Open dialog']);
    }
    for (const name of ['editor-text', 'settings-note']) {
      const node = input(name);
      node.value = 'A meaningful edit';
      node.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: node.value, inputType: 'insertText' })
      );
      await settle();
      expect(node.value).toBe('A meaningful edit');
      verify();
    }
    if (family === 'shadcn') {
      const editor = input('editor-text');
      const card = ref('editor-text').closest<HTMLElement>('wc-shadcn-card-root')!;
      const tabsList = card.querySelector<HTMLElement>('wc-shadcn-tabs-list')!;
      for (const styleProfile of ['new-york-v4', 'rhea'] as const) {
        setElementProps(card, { styleProfile });
        await settle();
        expect(input('editor-text')).toBe(editor);
        expect(editor.value).toBe('A meaningful edit');
        const tokens = editor.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
        expect(tokens).toContain(styleProfile === 'rhea' ? 'resize-none' : 'resize-y');
        expect(tokens).not.toContain(styleProfile === 'rhea' ? 'resize-y' : 'resize-none');
        expect(tabsList.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          styleProfile === 'rhea' ? 'rounded-2xl' : 'rounded-lg'
        );
        expect(getElementProps(ref('editor-text'))).not.toHaveProperty('styleProfile');
        expect(getElementProps(tabsList)).not.toHaveProperty('styleProfile');
      }
      const select = ref('settings-view');
      const trigger = ref('settings-view-trigger');
      const settingsCard = select.closest<HTMLElement>('wc-shadcn-card-root')!;
      const note = input('settings-note');
      for (const styleProfile of ['new-york-v4', 'rhea'] as const) {
        setElementProps(settingsCard, { styleProfile });
        await settle();
        expect(ref('settings-view')).toBe(select);
        expect(ref('settings-view-trigger')).toBe(trigger);
        expect(input('settings-note')).toBe(note);
        expect(note.value).toBe('A meaningful edit');
        expect(getElementProps(select)).not.toHaveProperty('styleProfile');
        expect(getElementProps(trigger)).not.toHaveProperty('styleProfile');
        expect(trigger.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          styleProfile === 'rhea' ? 'rounded-[var(--pui-radius-2xl)]' : 'rounded-md'
        );
        expect(trigger.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          styleProfile === 'rhea' ? 'h-8' : 'h-9'
        );
      }
      verify();
    }
    ref('editor-reset').click();
    await settle();
    expect(input('editor-text').value).toBe('Compose your interface from the same prototypes.');
    verify();
    ref('settings-reset').click();
    await settle();
    expect(input('settings-note').value).toBe('');
    verify();
  }, 20000);
}
