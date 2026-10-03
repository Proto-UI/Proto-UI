import { isPreviewCandidate, readPreviewSource } from './documentation-image-source';
import {
  makePreviewControl,
  previewFamily,
  registerPreviewControls,
  setPreviewProps,
  themePreviewControl,
  type PreviewControl,
  type PreviewFamily,
} from './documentation-image-controls';

type Enhancement = {
  trigger: PreviewControl;
  original: Element;
  label: HTMLElement;
  media: HTMLImageElement | SVGSVGElement;
};

/** Media selection/loading is application data. PUI owns modal presence,
 * dismissal, keyboard activation, focus scope/restoration and transition clocks.
 */
export function mountDocumentationImagePreview(host: HTMLElement): () => void {
  registerPreviewControls();
  const doc = host.ownerDocument;
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let renderAbort = new AbortController();
  let renderOptions = { signal: renderAbort.signal };
  let generation = 0;
  let mediaAbort = new AbortController();
  const zh = doc.documentElement.lang.toLowerCase().startsWith('zh');
  const labels = zh
    ? {
        title: '插图预览',
        open: '放大查看',
        original: '原尺寸',
        close: '关闭预览',
        error: '图片暂时无法加载',
        hint: '按 Escape 关闭；使用原尺寸查看细节',
      }
    : {
        title: 'Image preview',
        open: 'Enlarge image',
        original: 'Original size',
        close: 'Close preview',
        error: 'This image could not be loaded',
        hint: 'Press Escape to close; use original size for details',
      };
  let family: PreviewFamily = previewFamily(doc);
  let enhancements: Enhancement[] = [];
  let ownedUrl: string | null = null;
  let disposed = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let root: PreviewControl;
  let mask: PreviewControl;
  let content: PreviewControl;
  let title: PreviewControl;
  let description: PreviewControl;
  let zoom: PreviewControl;
  let image: HTMLImageElement;
  let scroll: HTMLElement;
  let status: HTMLElement;
  let caption: HTMLElement;

  const releaseSource = () => {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    ownedUrl = null;
  };
  const theme = () => {
    const dark = doc.documentElement.dataset.theme === 'dark';
    for (const control of [root, mask, content, ...enhancements.map((item) => item.trigger)])
      themePreviewControl(control, family, dark);
  };
  const motion = () => {
    setPreviewProps(mask, {
      enterDuration: reduced.matches ? 0 : 150,
      leaveDuration: reduced.matches ? 0 : 150,
    });
    setPreviewProps(content, {
      enterDuration: reduced.matches ? 0 : 200,
      leaveDuration: reduced.matches ? 0 : 200,
    });
  };
  const resetZoom = () => {
    content.removeAttribute('data-original-size');
    setPreviewProps(zoom, { active: false });
    scroll.scrollTop = scroll.scrollLeft = 0;
  };
  const createImage = () => {
    mediaAbort.abort();
    mediaAbort = new AbortController();
    const mediaOptions = { signal: mediaAbort.signal };
    const nextImage = doc.createElement('img');
    nextImage.className = 'docs-image-full';
    nextImage.alt = '';
    nextImage.addEventListener(
      'load',
      () => {
        if (nextImage !== image || !nextImage.hasAttribute('src')) return;
        status.hidden = true;
        nextImage.hidden = false;
        if (nextImage.naturalWidth)
          nextImage.style.setProperty('--docs-image-width', `${nextImage.naturalWidth}px`);
      },
      mediaOptions
    );
    nextImage.addEventListener(
      'error',
      () => {
        if (nextImage !== image || !nextImage.hasAttribute('src')) return;
        status.hidden = false;
        nextImage.hidden = true;
      },
      mediaOptions
    );
    return nextImage;
  };
  const createDialog = () => {
    const epoch = ++generation;
    root = makePreviewControl(family, 'dialogRoot', { a11yLabel: labels.title });
    root.dataset.docsImageDialog = '';
    mask = makePreviewControl(family, 'dialogMask');
    mask.dataset.docsImageMask = '';
    content = makePreviewControl(family, 'dialogContent');
    content.dataset.docsImageContent = '';
    const header = doc.createElement('header');
    header.className = 'docs-image-toolbar';
    const heading = doc.createElement('div');
    heading.className = 'docs-image-heading';
    title = makePreviewControl(family, 'dialogTitle');
    title.textContent = labels.title;
    description = makePreviewControl(family, 'dialogDescription');
    description.textContent = labels.hint;
    description.className = 'docs-image-hint';
    heading.append(title, description);
    zoom = makePreviewControl(family, 'toggle', { active: false, variant: 'outline', size: 'sm' });
    zoom.textContent = labels.original;
    zoom.dataset.docsImageZoom = '';
    const close = makePreviewControl(family, 'dialogClose');
    const closeButton = makePreviewControl(family, 'button', { variant: 'ghost', size: 'sm' });
    closeButton.textContent = labels.close;
    closeButton.dataset.docsImageClose = '';
    close.append(closeButton);
    header.append(heading, zoom, close);
    const scrollRoot = makePreviewControl(family, 'scrollAreaRoot');
    scrollRoot.className = 'docs-image-scroll-root';
    scroll = makePreviewControl(family, 'scrollAreaViewport');
    scroll.setAttribute('aria-label', labels.title);
    scroll.className = 'docs-image-viewport';
    // Browser scrolling/pinch zoom remain native document services.
    image = createImage();
    status = doc.createElement('p');
    status.className = 'docs-image-status';
    status.hidden = true;
    status.setAttribute('role', 'status');
    status.textContent = labels.error;
    caption = doc.createElement('p');
    caption.className = 'docs-image-caption';
    caption.hidden = true;
    scroll.append(image, status);
    scrollRoot.append(scroll);
    content.append(header, scrollRoot, caption);
    root.append(mask, content);
    host.append(root);
    motion();
    theme();
    zoom.addEventListener(
      'activeChange',
      (event) => {
        const active = (event as CustomEvent<{ active: boolean }>).detail?.active === true;
        setPreviewProps(zoom, { active });
        content.toggleAttribute('data-original-size', active);
        scroll.scrollTop = scroll.scrollLeft = 0;
      },
      renderOptions
    );
    content.addEventListener(
      'afterLeave',
      () => {
        if (epoch !== generation || root.getExposes?.().open?.get?.()) return;
        resetZoom();
        image.removeAttribute('src');
        releaseSource();
      },
      renderOptions
    );
  };
  const open = (item: Enhancement) => {
    const body = item.media.closest('[data-doc-flow]');
    if (!body || !isPreviewCandidate(item.media, body, item.trigger)) return;
    const source = readPreviewSource(item.media);
    if (!source) return;
    releaseSource();
    resetZoom();
    const previousImage = image;
    image = createImage();
    previousImage.replaceWith(image);
    status.hidden = true;
    image.hidden = false;
    image.alt = source.alt;
    image.dataset.sourceUrl = source.sourceUrl;
    image.style.setProperty('--docs-image-width', source.width > 0 ? `${source.width}px` : 'auto');
    caption.textContent = source.caption;
    caption.hidden = !source.caption;
    // Never innerHTML, object/embed, source-document navigation or SVG fetch.
    if (source.svgText)
      ownedUrl = URL.createObjectURL(new Blob([source.svgText], { type: 'image/svg+xml' }));
    // Preserve the source request's credentials/referrer policy before src can initiate a request.
    if (source.crossOrigin != null) image.crossOrigin = source.crossOrigin;
    if (source.referrerPolicy) image.referrerPolicy = source.referrerPolicy;
    image.src = ownedUrl ?? source.sourceUrl;
    root.getExposes?.().openDialog?.('image.preview');
  };
  const restoreTrigger = ({ trigger, original, label }: Enhancement) => {
    label.remove();
    if (original.localName === 'button') {
      original.append(...Array.from(trigger.childNodes));
      if (trigger.parentNode) trigger.replaceWith(original);
    } else if (trigger.parentNode) {
      // Preserve later-authored descendants (for example a newly added link).
      trigger.replaceWith(...Array.from(trigger.childNodes));
    }
  };
  const restoreTriggers = () => {
    enhancements.forEach(restoreTrigger);
    enhancements = [];
  };
  const scan = () => {
    if (disposed) return;
    enhancements = enhancements.filter((item) => {
      const body = item.media.closest('[data-doc-flow]');
      if (
        body &&
        isPreviewCandidate(item.media, body, item.trigger) &&
        readPreviewSource(item.media)
      )
        return true;
      restoreTrigger(item);
      return false;
    });
    for (const body of doc.querySelectorAll<HTMLElement>('[data-doc-flow]')) {
      for (const media of body.querySelectorAll<HTMLImageElement | SVGSVGElement>('img, svg')) {
        if (
          !(media instanceof HTMLImageElement || media instanceof SVGSVGElement) ||
          !isPreviewCandidate(media, body) ||
          !readPreviewSource(media)
        )
          continue;
        const legacy = media.closest('button[data-diagram-open]');
        const original = legacy ?? media.closest('picture') ?? media;
        // Only migrate the known one-image legacy trigger, never unrelated actions.
        if (
          legacy &&
          (legacy.querySelectorAll('img, svg').length !== 1 ||
            legacy.querySelector('a,button,input,select,textarea'))
        )
          continue;
        const trigger = makePreviewControl(family, 'button', { variant: 'ghost' });
        trigger.dataset.docsImageTrigger = '';
        const name = `${labels.open}: ${readPreviewSource(media)!.alt}`;
        trigger.title = name;
        // Button owns nameFromContent. Supply real label content instead of
        // writing an aria-label that its accessibility projection clears.
        const label = doc.createElement('span');
        label.className = 'docs-image-trigger-label';
        label.textContent = `${labels.open}: `;
        original.replaceWith(trigger);
        if (legacy) trigger.append(...Array.from(legacy.childNodes));
        else trigger.append(original);
        trigger.prepend(label);
        const item = { trigger, original, media, label };
        enhancements.push(item);
        themePreviewControl(trigger, family, doc.documentElement.dataset.theme === 'dark');
        trigger.addEventListener(
          'click',
          (event) => {
            if (event instanceof CustomEvent) open(item);
          },
          renderOptions
        );
      }
    }
  };
  createDialog();
  scan();
  const contentObserver = new MutationObserver(scan);
  for (const body of doc.querySelectorAll('[data-doc-flow]'))
    contentObserver.observe(body, { childList: true, subtree: true, attributes: true });
  const themeObserver = new MutationObserver(() => {
    const nextFamily = previewFamily(doc);
    if (nextFamily !== family) {
      // Close using the protocol before replacing actual family projections.
      root.getExposes?.().close?.('image.family-change');
      renderAbort.abort();
      mediaAbort.abort();
      renderAbort = new AbortController();
      renderOptions = { signal: renderAbort.signal };
      mask.remove();
      content.remove();
      root.remove();
      releaseSource();
      restoreTriggers();
      family = nextFamily;
      createDialog();
      scan();
    } else theme();
  });
  themeObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-site-library-family'],
  });
  reduced.addEventListener('change', motion, options);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    renderAbort.abort();
    mediaAbort.abort();
    contentObserver.disconnect();
    themeObserver.disconnect();
    abort.abort();
    root.getExposes?.().close?.('image.dispose');
    mask.remove();
    content.remove();
    root.remove();
    releaseSource();
    restoreTriggers();
  };
  doc.addEventListener('astro:before-swap', cleanup, options);
  return cleanup;
}
