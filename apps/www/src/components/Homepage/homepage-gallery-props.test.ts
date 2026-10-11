import { afterEach, expect, it } from 'vitest';
import { getElementProps } from '@proto.ui/adapter-web-component';
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
      for (const name of ['settings-save', 'settings-reset', 'editor-reset']) {
        expect(ref(name).style.maxWidth).toBe('100%');
        expect(ref(name).style.whiteSpace).toBe('normal');
        expect(ref(name).style.height).toBe('auto');
        expect(ref(name).style.minHeight).toBe(family === 'brutalist' ? '2.5rem' : '2rem');
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
    expect(host.querySelectorAll('[data-home-text]')).toHaveLength(24);
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
