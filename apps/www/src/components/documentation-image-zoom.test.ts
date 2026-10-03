import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDocumentationImagePreview } from './documentation-image-preview';
import type { PreviewControl } from './documentation-image-controls';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
async function fixture() {
  document.body.innerHTML =
    '<div data-doc-flow><figure><img src="/image.png" width="400" height="200" alt="Diagram"><figcaption>Diagram caption</figcaption></figure></div><div id="viewer"></div>';
  dispose = mountDocumentationImagePreview(document.querySelector('#viewer')!);
  await settle();
  const trigger = document.querySelector<PreviewControl>('[data-docs-image-trigger]')!;
  trigger.focus();
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await settle();
  return {
    trigger,
    root: document.querySelector<PreviewControl>('[data-docs-image-dialog]')!,
    content: document.querySelector<PreviewControl>('[data-docs-image-content]')!,
  };
}

describe('borderless image presentation / maintainer request #796', () => {
  it('uses a private Base Dialog projection without an original-size toolbar', async () => {
    const { content } = await fixture();
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-docs-image-zoom]')).toBeNull();
    expect(content.querySelector('header')).toBeNull();
    expect(content.getAttribute('data-pui-style')).toContain('docs-image-zoom-content');
    expect(content.querySelector('[data-docs-image-close]')).not.toBeNull();
    expect(content.querySelector('.docs-image-accessible-description')?.textContent).toContain(
      'Diagram caption'
    );
  });
  it('keeps the source in place but suppresses its duplicate while present, then restores it', async () => {
    const { trigger, root, content } = await fixture();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
    root.getExposes?.().close('test.close');
    await settle();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
    content.getExposes?.().complete();
    await settle();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
  it('retains the current source through interrupted close/reopen and restores it on route cleanup', async () => {
    const { trigger, root, content } = await fixture();
    root.getExposes?.().close('test.interrupt');
    await settle();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    content.dispatchEvent(new CustomEvent('afterLeave'));
    expect(root.getExposes?.().open.get()).toBe(true);
    expect(document.querySelector<HTMLImageElement>('.docs-image-full')!.src).toContain(
      '/image.png'
    );
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
    document.dispatchEvent(new Event('astro:before-swap'));
    await settle();
    expect(document.querySelector('[data-docs-image-origin-hidden]')).toBeNull();
    expect(document.querySelector('figure > img')).not.toBeNull();
  });
  it('uses the safe fade fallback when the source is removed before closing', async () => {
    const { trigger, root, content } = await fixture();
    trigger.remove();
    root.getExposes?.().close('test.removed');
    await settle();
    expect(content.dataset.docsImageReturn).toBe('fade');
    expect(content.style.getPropertyValue('--docs-image-origin-transform')).toBe('none');
    expect(content.style.getPropertyValue('--docs-image-closed-opacity')).toBe('0');
  });
  it('does not recover an invalid return rectangle merely because focus scrolls the source back', async () => {
    let sourceTop = 40;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(20, sourceTop, 400, 200)
    );
    const { trigger, root, content } = await fixture();
    expect(content.dataset.docsImageReturn).toBe('origin');
    sourceTop = 4000;
    trigger.style.transform = 'translateY(4000px)';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(content.dataset.docsImageReturn).toBe('fade');
    // Test-injected geometry models a subsequent native focus-restoration scroll.
    sourceTop = 40;
    root.getExposes?.().close('test.focus-return');
    await settle();
    expect(content.dataset.docsImageReturn).toBe('fade');
  });
});
