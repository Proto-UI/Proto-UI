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
    for (const tile of host.querySelectorAll('[data-gallery-demo]')) {
      const surface = tile.querySelector('[data-pui-root]')!;
      const appearance =
        family === 'brutalist' && tile.getAttribute('data-gallery-demo') === 'editor'
          ? 'canvas'
          : 'card';
      expect(getElementProps(surface as HTMLElement)).toMatchObject({ family, appearance });
      expect(surface.getAttribute('data-pui-style')?.includes('shadow-')).toBe(
        appearance === 'card'
      );
    }
    if (family === 'brutalist') {
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
