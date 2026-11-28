import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDocumentationImagePreview } from './documentation-image-preview';
import { setPreviewSurfaceDuration, type PreviewControl } from './documentation-image-controls';
import {
  sharedImageHitPoint,
  imageSpringMotionFailures,
  type ImageMotionFrame,
} from './documentation-image-preview.test-utils';
import { getElementProps } from '@proto.ui/adapter-web-component';
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
describe('documentation image native hit probe', () => {
  it('uses the shared interior even when the source center is below the contained image', () => {
    const source = { x: 45, y: 449.984375, width: 300, height: 200 };
    const preview = { x: 16, y: 302.65625, width: 358, height: 238.65625 };
    expect(source.y + source.height / 2).toBeGreaterThan(preview.y + preview.height);
    const point = sharedImageHitPoint(source, preview)!;
    for (const rect of [source, preview]) {
      expect(point.x).toBeGreaterThan(rect.x);
      expect(point.x).toBeLessThan(rect.x + rect.width);
      expect(point.y).toBeGreaterThan(rect.y);
      expect(point.y).toBeLessThan(rect.y + rect.height);
    }
  });
  it('rejects disjoint rectangles and edge-only contact instead of inventing a hit', () => {
    const source = { x: 10, y: 10, width: 100, height: 100 };
    expect(sharedImageHitPoint(source, { ...source, y: 200 })).toBeNull();
    expect(sharedImageHitPoint(source, { ...source, x: 110 })).toBeNull();
  });
  it('rejects missing or invalid painted area', () => {
    const source = { x: 10, y: 10, width: 100, height: 100 };
    expect(sharedImageHitPoint(source, { ...source, width: 0 })).toBeNull();
    expect(sharedImageHitPoint(source, { ...source, y: Number.NaN })).toBeNull();
  });
});
describe('documentation image spring observation controls', () => {
  const origin = { x: 20, y: 500, width: 200, height: 100 };
  const target = { x: 80, y: 40, width: 800, height: 400 };
  // A separate finite trajectory exercises the observer's accepted domain. It
  // is not the CSS stop list and is not native evidence of the actual viewer.
  const spring = [0, 0.22, 0.57, 0.83, 0.976, 1.028, 1.034, 1.023, 1.013, 1.005, 1, 1];
  const model = (
    direction: 'opening' | 'closing',
    end = target,
    trajectory = spring
  ): ImageMotionFrame[] =>
    trajectory.map((progress, index) => {
      const clock = Math.min(index / 10, 1);
      const geometric = direction === 'opening' ? progress : 1 - progress;
      return {
        time: index * 42,
        phase: index < 10 ? (direction === 'opening' ? 'entering' : 'leaving') : 'entered',
        opacity: direction === 'opening' ? clock : 1 - clock,
        sourceOpacity: 0,
        ...Object.fromEntries(
          Object.keys(origin).map((key) => [
            key,
            origin[key as keyof typeof origin] +
              (end[key as keyof typeof end] - origin[key as keyof typeof origin]) * geometric,
          ])
        ),
      } as ImageMotionFrame;
    });
  for (const direction of ['opening', 'closing'] as const) {
    it(`${direction}: admits a bounded spring with a separate linear scrim clock`, () => {
      expect(imageSpringMotionFailures(model(direction), origin, target, direction)).toEqual([]);
    });
    it(`${direction}: rejects the old linear image trajectory`, () => {
      const linear = spring.map((_, index) => Math.min(index / 10, 1));
      expect(
        imageSpringMotionFailures(model(direction, target, linear), origin, target, direction)
      ).toContain('The image must exhibit a measurable spring overshoot');
    });
  }
  it('rejects excess overshoot, axis drift, exposed sources, wrong clocks and unsettled endpoints', () => {
    const excessive = model(
      'opening',
      target,
      spring.map((value, index) => (index === 6 ? 1.08 : value))
    );
    expect(imageSpringMotionFailures(excessive, origin, target, 'opening')).toContain(
      'The spring exceeded its bounded five-percent overshoot'
    );
    const drift = model('opening');
    drift[4].y += 5;
    expect(imageSpringMotionFailures(drift, origin, target, 'opening')).toContain(
      'y left the measured source-to-target path'
    );
    const exposed = model('opening');
    exposed[4].sourceOpacity = 1;
    expect(imageSpringMotionFailures(exposed, origin, target, 'opening')).toContain(
      'The source must stay hidden throughout the image flight'
    );
    const slow = model('opening').map((frame) => ({ ...frame, time: frame.time * 2 }));
    expect(imageSpringMotionFailures(slow, origin, target, 'opening')).toContain(
      'The scrim must retain its independent 420ms linear clock'
    );
    const unsettled = model('opening');
    unsettled.at(-1)!.width += 10;
    expect(imageSpringMotionFailures(unsettled, origin, target, 'opening')).toContain(
      'The spring must settle at the measured endpoint'
    );
  });
  it('uses another measured axis for equal widths and rejects absent or nonfinite motion', () => {
    const sameWidth = { ...target, width: origin.width };
    expect(
      imageSpringMotionFailures(model('opening', sameWidth), origin, sameWidth, 'opening')
    ).toEqual([]);
    expect(
      imageSpringMotionFailures(model('opening', origin), origin, origin, 'opening')
    ).toContain('Motion requires a measurable source-to-target path');
    const invalid = model('opening');
    invalid[4].height = Number.NaN;
    expect(imageSpringMotionFailures(invalid, origin, target, 'opening')).toContain(
      'Motion samples must be finite'
    );
  });
});

describe('documentation image viewer PUI integration', () => {
  it('composes a public Base Button thumbnail without family variants or moving hover feedback', async () => {
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    const { trigger, root } = await fixture();
    expect(getElementProps(trigger)).not.toHaveProperty('variant');
    expect(
      trigger.querySelector('[data-docs-image-trigger-surface]')?.getAttribute('data-pui-style')
    ).toContain('bg-transparent');
    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle();
    expect(trigger.getExposes?.().hovered.get()).toBe(true);
    expect(trigger.getExposes?.().pressed.get()).toBe(true);
    expect(
      trigger.querySelector('[data-docs-image-trigger-surface]')?.getAttribute('data-pui-style')
    ).not.toMatch(/translate-|scale-|shadow-/);

    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    trigger.getExposes?.().focusSelf({ reason: 'keyboard' });
    expect(trigger.getExposes?.().focusVisible.get()).toBe(true);
    expect(trigger.getAttribute('data-focus-visible')).not.toBeNull();
    await settle();
    expect(
      trigger.querySelector('[data-docs-image-trigger-surface]')?.getAttribute('data-pui-style')
    ).toContain('ring-2');
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes?.().open.get()).toBe(true);
  });
  it('supplies a supported Brutalist close variant rather than ghost falling back to solid', async () => {
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    await fixture();
    const close = document.querySelector<HTMLElement>('[data-docs-image-close]')!;
    expect(getElementProps(close)?.variant).toBe('surface');
    expect(close.getAttribute('data-pui-style')).toContain('bg-secondary-background');
    expect(close.getAttribute('data-pui-style')).not.toContain('bg-main');
  });
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
  it('uses one native media source read when admitting an image', async () => {
    const source = vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get');
    await fixture();
    expect(document.querySelector('[data-docs-image-trigger]')?.getAttribute('title')).toBe(
      'Enlarge image: Example diagram'
    );
    expect(source).toHaveBeenCalledOnce();
  });
  it('waits for the browser-selected source before opening an unselected image', async () => {
    const { trigger, root } = await fixture();
    const media = trigger.querySelector('img')!;
    let selected = '';
    let ready!: () => void;
    const decoded = new Promise<void>((resolve) => {
      ready = resolve;
    });
    vi.spyOn(media, 'currentSrc', 'get').mockImplementation(() => selected);
    Object.defineProperty(media, 'decode', { configurable: true, value: () => decoded });

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes?.().open.get()).toBe(false);
    selected = 'https://example.com/mobile-diagram.svg';
    ready();
    await settle();
    expect(root.getExposes?.().open.get()).toBe(true);
    expect(document.querySelector<HTMLImageElement>('.docs-image-full')?.dataset.sourceUrl).toBe(
      selected
    );
  });

  it.each(['source replacement', 'disposal'] as const)(
    'does not open a retired pending image after %s',
    async (retirement) => {
      const { trigger, root } = await fixture();
      const media = trigger.querySelector('img')!;
      let ready!: () => void;
      const decoded = new Promise<void>((resolve) => {
        ready = resolve;
      });
      vi.spyOn(media, 'currentSrc', 'get').mockReturnValue('');
      Object.defineProperty(media, 'decode', { configurable: true, value: () => decoded });

      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(root.getExposes?.().open.get()).toBe(false);
      if (retirement === 'disposal') dispose?.();
      else media.src = 'https://example.com/replacement.svg';
      ready();
      await settle();
      expect(
        document.querySelector('[data-docs-image-content][data-transition-state="entering"]')
      ).toBeNull();
      if (retirement === 'disposal') expect(root.isConnected).toBe(false);
      else expect(root.getExposes?.().open.get()).toBe(false);
    }
  );

  it('a newer activation owns the preview when an earlier image decode finishes late', async () => {
    const { trigger, root } = await fixture();
    const media = trigger.querySelector('img')!;
    let selected = '';
    let ready!: () => void;
    const decoded = new Promise<void>((resolve) => {
      ready = resolve;
    });
    vi.spyOn(media, 'currentSrc', 'get').mockImplementation(() => selected);
    Object.defineProperty(media, 'decode', { configurable: true, value: () => decoded });

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    selected = 'https://example.com/current-diagram.svg';
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    const currentImage = document.querySelector<HTMLImageElement>('.docs-image-full')!;
    expect(root.getExposes?.().open.get()).toBe(true);
    expect(currentImage.dataset.sourceUrl).toBe(selected);
    ready();
    await settle();
    expect(document.querySelector('.docs-image-full')).toBe(currentImage);
    expect(currentImage.dataset.sourceUrl).toBe(selected);
  });

  it('retires a pending request when the picture node changes but its old markup is preserved', async () => {
    const { trigger, root } = await fixture();
    const idleImage = document.querySelector<HTMLImageElement>('.docs-image-full')!;
    expect(idleImage).not.toBeNull();
    const idleMarkup = idleImage.outerHTML;
    const media = trigger.querySelector('img')!;
    const declaration = document.createElement('picture');
    media.replaceWith(declaration);
    declaration.append(media);
    await settle();
    let ready!: () => void;
    const decoded = new Promise<void>((resolve) => {
      ready = resolve;
    });
    vi.spyOn(media, 'currentSrc', 'get').mockReturnValue('');
    Object.defineProperty(media, 'decode', { configurable: true, value: () => decoded });

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes?.().open.get()).toBe(false);
    const requestedMarkup = declaration.outerHTML;
    const preservedMedia = media.cloneNode(true);
    const replacement = document.createElement('picture');
    declaration.replaceWith(replacement);
    replacement.append(media);
    declaration.append(preservedMedia);
    expect(declaration.outerHTML).toBe(requestedMarkup);
    expect(trigger.contains(media)).toBe(true);
    expect(media.closest('picture')).toBe(replacement);

    ready();
    await settle();
    expect(root.getExposes?.().open.get()).toBe(false);
    expect(document.querySelector('.docs-image-full')).toBe(idleImage);
    expect(idleImage.outerHTML).toBe(idleMarkup);
  });

  it('keeps HTML style changes out of the media inventory scan', async () => {
    const { trigger } = await fixture();
    await (
      window as unknown as {
        happyDOM: { waitUntilComplete(): Promise<void> };
      }
    ).happyDOM.waitUntilComplete();
    const figure = document.querySelector('figure')!;
    const queries = vi.spyOn(document, 'querySelectorAll');
    const delivered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(figure, { attributes: true, attributeFilter: ['style'] });
    });
    figure.setAttribute('style', 'margin-block: 2rem');
    await delivered;
    await settle();
    expect(queries).not.toHaveBeenCalledWith('[data-doc-flow]');
    expect(figure.querySelector('[data-docs-image-trigger]')).toBe(trigger);
  });
  it('skips inventory reads for unrelated content and still responds to admission changes', async () => {
    const { trigger } = await fixture();
    const flow = document.querySelector('[data-doc-flow]')!;
    const articleControl = document.createElement('div');
    flow.append(articleControl);
    await (
      window as unknown as {
        happyDOM: { waitUntilComplete(): Promise<void> };
      }
    ).happyDOM.waitUntilComplete();
    const queries = vi.spyOn(document, 'querySelectorAll');
    const delivered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(flow, { attributes: true, childList: true, subtree: true });
    });
    articleControl.append(document.createElement('button'));
    articleControl.setAttribute('data-projection-state', 'ready');
    trigger.closest('figure')!.setAttribute('data-projection-state', 'ready');
    await delivered;
    await settle();
    expect(queries).not.toHaveBeenCalledWith('[data-doc-flow]');

    const figure = trigger.closest('figure')!;
    figure.setAttribute('aria-hidden', 'true');
    await vi.waitFor(() => expect(figure.querySelector('[data-docs-image-trigger]')).toBeNull());
    figure.removeAttribute('aria-hidden');
    await vi.waitFor(() =>
      expect(figure.querySelector('[data-docs-image-trigger]')).not.toBeNull()
    );
  });
  it('revalidates SVG admission when a descendant gains inline style', async () => {
    await fixture();
    const diagram = document.createElement('figure');
    diagram.innerHTML =
      '<svg viewBox="0 0 20 20" aria-label="Diagram"><path d="M0 0L20 20"/></svg>';
    document.querySelector('[data-doc-flow]')!.append(diagram);
    await vi.waitFor(() =>
      expect(diagram.querySelector('[data-docs-image-trigger]')).not.toBeNull()
    );
    const path = diagram.querySelector('path')!;
    path.setAttribute('style', 'stroke: red');
    await vi.waitFor(() => expect(diagram.querySelector('[data-docs-image-trigger]')).toBeNull());
    expect(diagram.querySelector('path')).toBe(path);
  });
  it('leaves previewer SVG updates out of the article inventory until its owner marker is removed', async () => {
    await fixture();
    const flow = document.querySelector('[data-doc-flow]')!;
    const preview = document.createElement('div');
    preview.setAttribute('data-previewer-id', 'interactive-example');
    preview.innerHTML =
      '<svg viewBox="0 0 20 20" aria-label="Example"><path d="M0 0L20 20"/></svg>';
    flow.append(preview);
    await (
      window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
    ).happyDOM.waitUntilComplete();
    const queries = vi.spyOn(document, 'querySelectorAll');
    const delivered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(preview, { attributes: true, childList: true, subtree: true });
    });
    preview.querySelector('path')!.setAttribute('d', 'M0 0L15 15');
    await delivered;
    await settle();
    expect(queries).not.toHaveBeenCalledWith('[data-doc-flow]');
    expect(preview.querySelector('[data-docs-image-trigger]')).toBeNull();

    preview.removeAttribute('data-previewer-id');
    await vi.waitFor(() =>
      expect(preview.querySelector('[data-docs-image-trigger]')).not.toBeNull()
    );
  });
  it('reconciles an article scope that is added or removed inside a previewer', async () => {
    await fixture();
    const preview = document.createElement('div');
    preview.setAttribute('data-prototype-previewer', '');
    const article = document.createElement('article');
    article.innerHTML = '<img src="/diagram.png" alt="Article diagram">';
    preview.append(article);
    document.querySelector('[data-doc-flow]')!.append(preview);
    await settle();
    expect(article.querySelector('[data-docs-image-trigger]')).toBeNull();

    article.setAttribute('data-doc-flow', '');
    await vi.waitFor(() =>
      expect(article.querySelector('[data-docs-image-trigger]')).not.toBeNull()
    );
    article.querySelector('img')!.setAttribute('alt', '');
    await vi.waitFor(() => expect(article.querySelector('[data-docs-image-trigger]')).toBeNull());
    article.querySelector('img')!.setAttribute('alt', 'Updated article diagram');
    await vi.waitFor(() =>
      expect(article.querySelector('[data-docs-image-trigger]')).not.toBeNull()
    );
    article.removeAttribute('data-doc-flow');
    await vi.waitFor(() => expect(article.querySelector('[data-docs-image-trigger]')).toBeNull());
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
    expect(css).not.toMatch(/\[data-docs-image-trigger\]\s*\{[^}]*box-shadow\s*:/);
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
    expect(trigger.localName).toBe('docs-preview-brutalist-image-trigger');
    expect(
      trigger.querySelector('[data-docs-image-trigger-surface]')?.getAttribute('data-pui-style')
    ).toContain('bg-transparent');
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

it('validates the controlled public Surface duration instead of accepting arbitrary CSS', () => {
  const surface = document.createElement('div');
  setPreviewSurfaceDuration(surface, 220);
  expect(surface.style.getPropertyValue('--pui-surface-transition-duration')).toBe('220ms');
  for (const invalid of [-1, NaN, Infinity])
    expect(() => setPreviewSurfaceDuration(surface, invalid)).toThrow('Invalid Surface duration');
  expect(surface.style.getPropertyValue('--pui-surface-transition-duration')).toBe('220ms');
  setPreviewSurfaceDuration(surface, 0);
  expect(surface.style.getPropertyValue('--pui-surface-transition-duration')).toBe('0ms');
});

describe('public Text error presentation with native live semantics', () => {
  for (const family of ['shadcn', 'brutalist'])
    it(`${family}: mounts the real Text atom inside the original status paragraph`, async () => {
      document.documentElement.dataset.siteLibraryFamily = family;
      const { trigger } = await fixture();
      trigger.click();
      await settle();
      const image = document.querySelector<HTMLImageElement>('.docs-image-full')!;
      const status = document.querySelector<HTMLElement>('.docs-image-status')!;
      image.dispatchEvent(new Event('error'));
      await settle();
      expect(status.localName).toBe('p');
      expect(status.getAttribute('role')).toBe('status');
      expect(status.hidden).toBe(false);
      expect(status.textContent).toBe('This image could not be loaded');
      const text = status.querySelector<HTMLElement>('[data-docs-image-status-text]')!;
      expect(text.dataset.docsPreviewPrototype).toBe(`${family}-text-root`);
      expect(text.hasAttribute('data-pui-root')).toBe(true);
      expect(text.getAttribute('data-pui-style')).toContain('text-base');
      expect(text.getAttribute('data-pui-style')).toContain('font-sans');
      expect(text.getAttribute('role')).toBeNull();
      expect(text.getAttribute('tabindex')).toBeNull();
      image.dispatchEvent(new Event('load'));
      await settle();
      expect(status.hidden).toBe(true);
      expect(status.querySelector('[data-docs-image-status-text]')).toBe(text);
      expect(image.hidden).toBe(false);
    });
});
