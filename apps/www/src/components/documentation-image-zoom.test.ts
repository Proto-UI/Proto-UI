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
async function fixture(mediaClass = '') {
  document.body.innerHTML = `<div data-doc-flow><figure><img class="${mediaClass}" src="/image.png" width="400" height="200" alt="Diagram"><figcaption>Diagram caption</figcaption></figure></div><div id="viewer"></div>`;
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
  it.each(['shadcn', 'brutalist'] as const)(
    'places initial and repeated %s image focus on Content while retaining keyboard Close',
    async (family) => {
      const previousFamily = document.documentElement.dataset.siteLibraryFamily;
      document.documentElement.dataset.siteLibraryFamily = family;
      try {
        const { trigger, root, content } = await fixture('whitepaper-diagram');
        const close = content.querySelector<PreviewControl>('[data-docs-image-close]')!;
        expect(root.getExposes?.().open.get()).toBe(true);
        expect(document.activeElement).toBe(content);
        expect(content.tabIndex).toBe(-1);
        expect(close.getExposes?.().focused.get()).toBe(false);
        expect(close.getExposes?.().focusVisible.get()).toBe(false);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        await settle();
        expect(document.activeElement).toBe(close);
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
        );
        await settle();
        expect(document.activeElement).toBe(close);
        close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await settle();
        expect(root.getExposes?.().open.get()).toBe(false);
        content.getExposes?.().complete();
        await settle();
        expect(document.activeElement).toBe(trigger);

        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await settle();
        expect(document.activeElement).toBe(content);
        expect(close.getExposes?.().focused.get()).toBe(false);
        expect(close.getExposes?.().focusVisible.get()).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
        expect(root.getExposes?.().open.get()).toBe(false);
        content.getExposes?.().complete();
        await settle();
        expect(document.activeElement).toBe(trigger);
      } finally {
        if (previousFamily === undefined) delete document.documentElement.dataset.siteLibraryFamily;
        else document.documentElement.dataset.siteLibraryFamily = previousFamily;
      }
    }
  );
  it('prevents mask pointer defaults while Content remains the outside-close owner', async () => {
    const { trigger, root } = await fixture();
    const requests: any[] = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    const mask = document.querySelector<HTMLElement>('[data-docs-image-mask]')!;
    const pointer = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    mask.dispatchEvent(pointer);
    await settle();
    expect(pointer.defaultPrevented).toBe(true);
    expect(root.getExposes?.().open.get()).toBe(false);
    expect(requests.at(-1)).toMatchObject({ reason: 'outside.press', focusReason: 'pointer' });
    expect(document.activeElement).toBe(trigger);
  });
  it('composes public Base Dialog and Surface without an original-size toolbar', async () => {
    const { content } = await fixture();
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-docs-image-zoom]')).toBeNull();
    expect(content.querySelector('header')).toBeNull();
    expect(
      content.querySelector('[data-docs-image-canvas]')?.getAttribute('data-pui-style')
    ).toContain('bg-background');
    expect(content.querySelector('[data-docs-image-close]')).not.toBeNull();
    expect(content.querySelector('.docs-image-accessible-description')?.textContent).toContain(
      'Diagram caption'
    );
  });
  it('keeps whitepaper images in the same source-to-contain presentation without a toolbar', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(20, 40, 400, 200)
    );
    const ordinary = await fixture();
    const geometry = (content: HTMLElement) =>
      Object.fromEntries(
        ['left', 'top', 'width', 'height', 'origin-transform'].map((name) => [
          name,
          content.style.getPropertyValue(`--docs-image-${name}`),
        ])
      );
    const ordinaryGeometry = geometry(ordinary.content);
    expect(ordinary.content.dataset.docsImageReturn).toBe('origin');
    dispose?.();
    dispose = undefined;

    // #796 applies to the actual whitepaper marker as well as ordinary media.
    // The source dimensions and rectangle are identical, so presentation must
    // not acquire a toolbar, a separate scroll frame or a fade-only exception.
    const { trigger, content } = await fixture('whitepaper-diagram');
    expect(
      content.querySelector(
        '.docs-image-toolbar, [data-docs-image-zoom], [data-docs-image-zoom-in], [data-docs-image-zoom-out]'
      )
    ).toBeNull();
    expect(content.querySelector('[data-docs-image-viewport]')).toBeNull();
    expect(content.dataset.docsImageReturn).toBe('origin');
    expect(geometry(content)).toEqual(ordinaryGeometry);
    expect(content.querySelector('[data-docs-image-close]')).not.toBeNull();
    expect(content.querySelector<HTMLImageElement>('.docs-image-full')?.alt).toBe('Diagram');
    expect(content.querySelector('.docs-image-accessible-description')?.textContent).toContain(
      'Diagram caption'
    );
    expect(trigger.querySelector('img.whitepaper-diagram')).not.toBeNull();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
  });
  it('keeps the source in place but suppresses its duplicate while present, then restores it', async () => {
    const { trigger, root, content } = await fixture();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
    expect(trigger.hasAttribute('data-docs-image-source-instant')).toBe(true);
    root.getExposes?.().close('test.close');
    await settle();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(true);
    content.getExposes?.().complete();
    await settle();
    expect(trigger.hasAttribute('data-docs-image-origin-hidden')).toBe(false);
    expect(trigger.hasAttribute('data-docs-image-source-instant')).toBe(false);
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
    expect(document.querySelector('[data-docs-image-source-instant]')).toBeNull();
    expect(trigger.hasAttribute('data-docs-image-source-instant')).toBe(false);
    expect(document.querySelector('figure > img')).not.toBeNull();
  });
  it('uses the safe fade fallback when the source is removed before closing', async () => {
    const { trigger, root, content } = await fixture();
    trigger.remove();
    root.getExposes?.().close('test.removed');
    await settle();
    expect(content.dataset.docsImageReturn).toBe('fade');
    expect(content.style.getPropertyValue('--docs-image-origin-transform')).toBe('none');
    expect(
      content.querySelector('[data-docs-image-canvas]')?.getAttribute('data-pui-style')
    ).toContain('opacity-0');
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
