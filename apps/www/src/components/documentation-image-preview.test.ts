import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDocumentationImagePreview } from './documentation-image-preview';
import type { PreviewControl } from './documentation-image-controls';
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
  dispose = undefined;
  document.body.innerHTML = '';
  delete document.documentElement.dataset.siteLibraryFamily;
});
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
async function fixture() {
  const wrapper = readFileSync('apps/www/src/components/override/MarkdownContent.astro', 'utf8');
  document.body.innerHTML =
    wrapper.replace(
      '<slot />',
      '<figure><img src="https://example.com/diagram.svg" alt="Example diagram"/><figcaption>Caption</figcaption></figure><p><a href="/destination"><img src="/linked.png" alt="Linked"/></a><img src="/decorative.png" alt=""/></p>'
    ) + '<div id="viewer"></div>';
  dispose = mountDocumentationImagePreview(document.querySelector('#viewer')! as HTMLElement);
  await settle();
  return {
    trigger: document.querySelector('[data-docs-image-trigger]')! as PreviewControl,
    root: document.querySelector('[data-docs-image-dialog]')! as PreviewControl,
  };
}
describe('documentation image viewer PUI integration', () => {
  it('enhances eligible images only and restores authored structure on disposal', async () => {
    await fixture();
    expect(document.querySelectorAll('[data-docs-image-trigger]')).toHaveLength(1);
    expect(document.querySelector('a > img')).not.toBeNull();
    expect(document.querySelector('figcaption')?.textContent).toBe('Caption');
    dispose?.();
    await settle();
    expect(document.querySelector('figure > img')).not.toBeNull();
    expect(document.querySelector('[data-docs-image-trigger]')).toBeNull();
  });
  it('provides the preview action name through PUI-owned content naming', async () => {
    const { trigger } = await fixture();
    expect(trigger.textContent).toContain('Enlarge image:');
    expect(trigger.getAttribute('aria-label')).toBeNull();
    dispose?.();
    await settle();
    expect(document.querySelector('[data-doc-flow]')!.textContent).not.toContain('Enlarge image:');
  });
  it('does not erase the prototype-owned focus-ring shadow with unlayered thumbnail CSS', () => {
    const css = readFileSync('apps/www/src/styles/documentation-image-preview.css', 'utf8');
    const thumbnailRule = css.match(/\[data-docs-image-trigger\]\s*\{([^}]+)\}/)![1];
    expect(thumbnailRule).not.toMatch(/box-shadow\s*:/);
  });
  it('opens through Button semantic activation, closes through Dialog, restores focus and reopens the contain presentation', async () => {
    const { trigger, root } = await fixture();
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes?.().open.get()).toBe(true);
    const content = document.querySelector('[data-docs-image-content]')! as PreviewControl;
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector<HTMLImageElement>('.docs-image-full')!.alt).toBe(
      'Example diagram'
    );
    expect(document.querySelector('[data-docs-image-zoom]')).toBeNull();
    root.getExposes?.().close('test.close');
    await settle();
    content.getExposes?.().complete();
    await settle();
    expect(root.getExposes?.().open.get()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(content.hasAttribute('data-original-size')).toBe(false);
  });
  it('ignores stale image events after a newer source and cleans up repeated remounts', async () => {
    const { trigger, root } = await fixture();
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    const oldImage = document.querySelector<HTMLImageElement>('.docs-image-full')!;
    root.getExposes?.().close('test.close');
    await settle();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    const current = document.querySelector<HTMLImageElement>('.docs-image-full')!;
    expect(current).not.toBe(oldImage);
    oldImage.dispatchEvent(new Event('error'));
    expect((document.querySelector('.docs-image-status') as HTMLElement).hidden).toBe(true);
    current.dispatchEvent(new Event('error'));
    expect((document.querySelector('.docs-image-status') as HTMLElement).hidden).toBe(false);
    current.dispatchEvent(new Event('load'));
    expect((document.querySelector('.docs-image-status') as HTMLElement).hidden).toBe(true);
    dispose?.();
    await settle();
    dispose = mountDocumentationImagePreview(document.querySelector('#viewer')! as HTMLElement);
    await settle();
    expect(document.querySelectorAll('[data-docs-image-trigger]')).toHaveLength(1);
  });
  it('sets CORS/referrer policy before the new source request starts', async () => {
    const { trigger } = await fixture();
    const original = trigger.querySelector('img')!;
    original.crossOrigin = 'anonymous';
    original.referrerPolicy = 'no-referrer';
    const srcSetter = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!.set!;
    const requests: object[] = [];
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
      this: HTMLImageElement,
      value: string
    ) {
      requests.push({
        src: value,
        crossOrigin: this.crossOrigin,
        referrerPolicy: this.referrerPolicy,
      });
      srcSetter.call(this, value);
    });
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(requests).toContainEqual({
      src: original.src,
      crossOrigin: 'anonymous',
      referrerPolicy: 'no-referrer',
    });
  });
  it('revalidates new owner boundaries before activation and removes stale controls without losing new links', async () => {
    const { trigger, root } = await fixture();
    const original = trigger.querySelector('img')!;
    const link = document.createElement('a');
    link.href = '/new-destination';
    original.replaceWith(link);
    link.append(original);
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes?.().open.get()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.querySelector('[data-docs-image-trigger]')).toBeNull();
    expect(document.querySelector('figure > a > img')).toBe(original);
  });
  it.each(['hidden', 'inert', 'contenteditable'])(
    'removes a trigger when the original becomes %s',
    async (attribute) => {
      const { trigger, root } = await fixture();
      trigger
        .querySelector('img')!
        .setAttribute(attribute, attribute === 'contenteditable' ? 'true' : '');
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(root.getExposes?.().open.get()).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(document.querySelector('[data-docs-image-trigger]')).toBeNull();
    }
  );
  it('replaces actual family facades after a family change and removes portals on navigation', async () => {
    await fixture();
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    await new Promise((resolve) => setTimeout(resolve, 10));
    await settle();
    const trigger = document.querySelector('[data-docs-image-trigger]')! as PreviewControl;
    expect(trigger.localName).toBe('docs-preview-brutalist-button');
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.querySelector('[data-docs-image-content]')!.localName).toBe(
      'docs-preview-brutalist-dialog-content'
    );
    document.dispatchEvent(new Event('astro:before-swap'));
    await settle();
    expect(document.querySelector('[data-docs-image-content]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
