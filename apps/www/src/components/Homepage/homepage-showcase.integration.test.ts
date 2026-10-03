import { afterEach, describe, expect, it } from 'vitest';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageShowcase } from './homepage-showcase';

// Real website renderer, real PUI parts and real WC Adapter in Happy DOM.
// DOM keyboard/edit events are synthetic; paint and native-browser behavior
// remain covered by the separately executed browser suite.
type ProtoElement = HTMLElement & { getExposes(): { open: { get(): boolean } } };
let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
let stopErrorWatch: (() => void) | undefined;
afterEach(async () => {
  try {
    await rendered?.destroy();
  } finally {
    rendered = undefined;
    stopErrorWatch?.();
    stopErrorWatch = undefined;
    document.body.replaceChildren();
  }
});
function press(element: HTMLElement, key: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

for (const family of ['shadcn', 'brutalist'] as const) {
  describe(`${family} workspace real WC integration`, () => {
    it('lets Select own close/focus, preserves controlled IME, and saves/restores actual input', async () => {
      const errors: string[] = [];
      const onError = (event: ErrorEvent) => {
        errors.push(event.message);
      };
      window.addEventListener('error', onError);
      stopErrorWatch = () => window.removeEventListener('error', onError);
      const content = createHomepageShowcase(family, 'wc', 'zh-cn', () => true);
      await loadPrototypes([...content.recipe.prototypeIds]);
      const host = document.createElement('div');
      document.body.append(host);
      rendered = await renderDemo({ runtime: 'wc', demo: content.demo, host });
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
      const root = ref('settings-view') as ProtoElement;
      const trigger = ref('settings-view-trigger');
      const summary = ref('settings-summary');
      const save = ref('settings-save');
      const reset = ref('settings-reset');
      const feedback = ref('settings-feedback');
      const note = ref('settings-note').querySelector('textarea')!;
      const task = ref('settings');
      await expect.poll(() => trigger.textContent).toContain('邮件');
      trigger.focus();
      press(trigger, 'Enter');
      await expect.poll(() => root.getExposes().open.get()).toBe(true);
      const portal = document.getElementById(trigger.getAttribute('aria-controls')!)!;
      const board = [...portal.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (option) => option.textContent?.trim() === '推送'
      )!;
      expect(board).toBeTruthy();
      board.focus();
      press(board, 'Enter');
      await expect.poll(() => trigger.textContent).toContain('推送');
      await expect.poll(() => root.getExposes().open.get()).toBe(false);
      await expect.poll(() => document.activeElement === trigger).toBe(true);
      expect(task.dataset.dirty).toBe('true');

      summary.click();
      await expect.poll(() => summary.getAttribute('aria-checked')).toBe('true');
      note.focus();
      // Fill-shaped synthetic replacement inputs complement native .fill in CI.
      for (const replacement of [`${family} / renderer`, '多字符附加说明']) {
        note.value = replacement;
        note.setSelectionRange(replacement.length, replacement.length);
        note.dispatchEvent(
          new InputEvent('input', { bubbles: true, data: replacement, inputType: 'insertText' })
        );
        await expect.poll(() => note.value).toBe(replacement);
        await expect.poll(() => note.selectionStart).toBe(replacement.length);
        expect(note.selectionEnd).toBe(replacement.length);
        expect(errors).toEqual([]);
      }
      note.value = 'A';
      note.setSelectionRange(1, 1);
      note.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'A', inputType: 'insertText' })
      );
      await expect.poll(() => note.value).toBe('A');
      await expect.poll(() => note.selectionStart).toBe(1);
      expect(note.selectionEnd).toBe(1);
      note.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      note.value = 'A备';
      note.setSelectionRange(2, 2);
      note.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '备',
          isComposing: true,
          inputType: 'insertCompositionText',
        })
      );
      await expect.poll(() => save.getAttribute('aria-disabled')).toBe('true');
      expect(note.value).toBe('A备');
      expect(note.selectionStart).toBe(2);
      expect(note.selectionEnd).toBe(2);
      save.click();
      expect(task.dataset.dirty).toBe('true');
      expect(feedback.textContent).not.toContain('已保存到本页');
      note.value = 'A备注';
      note.setSelectionRange(3, 3);
      note.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '备注' }));
      await expect.poll(() => save.getAttribute('aria-disabled')).toBe('false');
      await expect.poll(() => note.selectionStart).toBe(3);
      expect(note.selectionEnd).toBe(3);
      save.click();
      await expect
        .poll(() => feedback.textContent)
        .toBe('已保存到本页 · 推送 · 显示每周摘要 · 备注 3 字');
      expect(note.value).toBe('A备注');
      expect(task.dataset.dirty).toBe('false');
      reset.click();
      await expect.poll(() => trigger.textContent).toContain('邮件');
      await expect.poll(() => summary.getAttribute('aria-checked')).toBe('false');
      await expect.poll(() => note.value).toBe('');
      expect(task.dataset.dirty).toBe('true');
      save.click();
      await expect
        .poll(() => feedback.textContent)
        .toBe('已保存到本页 · 邮件 · 隐藏每周摘要 · 备注 0 字');
      expect(task.dataset.dirty).toBe('false');
      ref('gallery-primary').click();
      await expect.poll(() => ref('gallery-controls-feedback').textContent).toContain('✓');
      const editorRoot = ref('editor-text');
      const editorText = (
        editorRoot.matches('textarea') ? editorRoot : editorRoot.querySelector('textarea')
      ) as HTMLTextAreaElement;
      editorText.value = '真实组合编辑';
      editorText.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: '真实组合编辑', inputType: 'insertText' })
      );
      await expect.poll(() => editorText.value).toBe('真实组合编辑');
      ref('editor-bold').click();
      await expect.poll(() => ref('editor-preview').textContent).toBe('真实组合编辑');
      await expect.poll(() => ref('editor-preview').style.fontWeight).toBe('700');
      ref('choice-product').click();
      ref('choice-apply').click();
      await expect.poll(() => ref('choice-feedback').textContent).toBe('已应用 1 项选择');
      await rendered.destroy();
      rendered = undefined;
      expect(errors).toEqual([]);
    });
  });
}
