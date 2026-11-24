import { isPreviewCandidate, readPreviewSource } from './documentation-image-source';
import { imageContainRect, imageOriginTransform } from './documentation-image-geometry';
import {
  IMAGE_ZOOM_DURATION,
  bindPreviewSurface,
  setPreviewSurfaceDuration,
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
  surface: PreviewControl;
  mediaSurface: PreviewControl;
  dispose: () => void;
  label: HTMLElement;
  media: HTMLImageElement | SVGSVGElement;
};

const PREVIEW_MEDIA = 'img, svg';
const PREVIEW_SOURCE = 'img, svg, picture, source, figcaption';
const INVENTORY_OWNER = '[data-doc-flow], [data-docs-image-trigger]';
const PREVIEW_BOUNDARY = '[data-doc-flow], [data-previewer-id], [data-prototype-previewer]';
const PREVIEW_ADMISSION_ATTRIBUTES = new Set([
  'aria-hidden',
  'hidden',
  'inert',
  'contenteditable',
  'role',
  'tabindex',
  'data-doc-flow',
  'data-image-preview',
  'data-docs-image-trigger',
  'data-diagram-open',
  'data-previewer-id',
  'data-prototype-previewer',
]);

function affectsPreviewInventory(record: MutationRecord): boolean {
  const target = record.target as Element;
  if (target.closest('svg')) return true;
  if (record.type === 'childList') {
    return (
      !!target.closest('picture, figcaption, button[data-diagram-open]') ||
      [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          node.nodeType === 1 &&
          ((node as Element).matches(PREVIEW_SOURCE) ||
            !!(node as Element).querySelector(PREVIEW_SOURCE))
      )
    );
  }
  const attribute = record.attributeName;
  // HTML inline paint can change active geometry without changing admission.
  if (!attribute || attribute === 'style') return false;
  return (
    target.matches(PREVIEW_SOURCE) ||
    ((PREVIEW_ADMISSION_ATTRIBUTES.has(attribute) || /^on/i.test(attribute)) &&
      !!target.querySelector(PREVIEW_MEDIA))
  );
}

function isExcludedPreviewMutation(record: MutationRecord): boolean {
  const attribute = record.attributeName;
  if (
    attribute === 'data-doc-flow' ||
    attribute === 'data-docs-image-trigger' ||
    attribute === 'data-previewer-id' ||
    attribute === 'data-prototype-previewer'
  )
    return false;
  const target = record.target as Element;
  const boundary = target.closest(PREVIEW_BOUNDARY);
  if (!boundary || boundary.hasAttribute('data-doc-flow')) return false;

  // A nested article may still admit its own images. Retain scans for it and
  // for owned triggers that may need cleanup after removal or relocation.
  if (target.matches(INVENTORY_OWNER) || target.querySelector(INVENTORY_OWNER)) return false;
  for (const node of record.removedNodes) {
    if (
      node.nodeType === 1 &&
      ((node as Element).matches(INVENTORY_OWNER) ||
        (node as Element).querySelector(INVENTORY_OWNER))
    )
      return false;
  }
  return true;
}

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
  let openRequest = 0;
  let mediaAbort = new AbortController();
  const zh = doc.documentElement.lang.toLowerCase().startsWith('zh');
  const labels = zh
    ? {
        title: '插图预览',
        open: '放大查看',
        close: '关闭预览',
        error: '图片暂时无法加载',
        hint: '按 Escape 或点击图片外的背景关闭',
        read: '放大阅读',
        fit: '适应窗口',
        larger: '放大',
        smaller: '缩小',
        viewport: '插图，可横向和纵向滚动',
        panHint: '放大后可滚动查看插图；也可以切换到适应窗口查看全图',
      }
    : {
        title: 'Image preview',
        open: 'Enlarge image',
        close: 'Close preview',
        error: 'This image could not be loaded',
        hint: 'Press Escape or press the background outside the image to close',
        read: 'Reading size',
        fit: 'Fit to window',
        larger: 'Zoom in',
        smaller: 'Zoom out',
        viewport: 'Illustration, scroll horizontally and vertically',
        panHint:
          'Scroll to read the enlarged illustration, or fit it to the window for an overview',
      };
  let family: PreviewFamily = previewFamily(doc);
  let enhancements: Enhancement[] = [];
  let ownedUrl: string | null = null;
  let disposed = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let root: PreviewControl;
  let mask: PreviewControl;
  let content: PreviewControl;
  let maskSurface: PreviewControl;
  let contentSurface: PreviewControl;
  let title: PreviewControl;
  let description: PreviewControl;
  let image: HTMLImageElement;
  let status: HTMLElement;
  let activeItem: Enhancement | null = null;
  let sourceSize = { width: 0, height: 0 };
  let originWasUnavailable = false;
  let diagramFrame: HTMLDivElement | null = null;
  let diagramRoot: PreviewControl | null = null;
  let diagramViewport: PreviewControl | null = null;
  let zoomToolbar: HTMLDivElement | null = null;
  let zoomButton: PreviewControl | null = null;
  let zoomInButton: PreviewControl | null = null;
  let zoomOutButton: PreviewControl | null = null;
  let diagramAbort: AbortController | null = null;
  let diagramReadingSize = false;
  let diagramScale = 1;

  const releaseSource = () => {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    ownedUrl = null;
  };
  const theme = () => {
    const dark = doc.documentElement.dataset.theme === 'dark';
    for (const control of [
      root,
      mask,
      content,
      maskSurface,
      contentSurface,
      ...(diagramRoot ? [diagramRoot] : []),
      ...(diagramViewport ? [diagramViewport] : []),
      ...(zoomButton ? [zoomButton] : []),
      ...(zoomInButton ? [zoomInButton] : []),
      ...(zoomOutButton ? [zoomOutButton] : []),
      ...enhancements.map((item) => item.surface),
    ])
      themePreviewControl(control, family, dark);
  };
  const motion = () => {
    const duration = reduced.matches ? 0 : IMAGE_ZOOM_DURATION;
    for (const control of [mask, content]) {
      setPreviewProps(control, {
        enterDuration: duration,
        leaveDuration: duration,
        interrupt: 'reverse',
      });
      control.style.setProperty('--docs-image-duration', `${duration}ms`);
    }
    for (const surface of [maskSurface, contentSurface])
      setPreviewSurfaceDuration(surface, duration);
  };
  const restoreOrigin = () => {
    if (!activeItem) return;
    activeItem.trigger.removeAttribute('data-docs-image-origin-hidden');
    setPreviewProps(activeItem.mediaSurface, { fade: false, transitionState: 'entered' });
    // Commit the visible endpoint while source transitions are disabled, then
    // restore the author's rules. No timeout or secondary modal clock is used.
    const sourceSurface = activeItem.media.closest('picture') ?? activeItem.media;
    void doc.defaultView?.getComputedStyle(sourceSurface).opacity;
    activeItem.trigger.removeAttribute('data-docs-image-source-instant');
  };
  const geometry = () => {
    if (!activeItem) return;
    const visual = window.visualViewport;
    const viewport = {
      x: visual?.offsetLeft ?? 0,
      y: visual?.offsetTop ?? 0,
      width: visual?.width ?? window.innerWidth,
      height: visual?.height ?? window.innerHeight,
    };
    const target = imageContainRect(
      image.naturalWidth || sourceSize.width,
      image.naturalHeight || sourceSize.height,
      viewport
    );
    if (diagramViewport && diagramRoot && diagramFrame) {
      // Keep tools and the focus outline inside Dialog Content's real clip.
      // The inner public ScrollArea owns the only reading scroll surface.
      const inset = Math.min(16, viewport.width / 20, viewport.height / 20);
      target.x = viewport.x + inset;
      target.y = viewport.y + inset;
      target.width = Math.max(1, viewport.width - inset * 2);
      target.height = Math.max(1, viewport.height - inset * 2);
      const gutter = 6;
      const toolsHeight = Math.min(40, target.height / 4);
      diagramFrame.style.setProperty('--docs-image-tools-height', `${toolsHeight}px`);
      diagramFrame.style.setProperty('--docs-image-reading-gutter', `${gutter}px`);
      const readingSpace = {
        x: target.x + gutter,
        y: target.y + toolsHeight + gutter * 2,
        width: Math.max(1, target.width - gutter * 2),
        height: Math.max(1, target.height - toolsHeight - gutter * 3),
      };
      const fitting = imageContainRect(
        image.naturalWidth || sourceSize.width,
        image.naturalHeight || sourceSize.height,
        readingSpace
      );
      const rootWidth = `${diagramReadingSize ? readingSpace.width : fitting.width}px`;
      const rootHeight = `${diagramReadingSize ? readingSpace.height : fitting.height}px`;
      // Only a changed measurement may touch the layout. Rewriting the same
      // values invalidates the reading viewport's own scroll content.
      if (diagramRoot.style.width !== rootWidth) diagramRoot.style.width = rootWidth;
      if (diagramRoot.style.height !== rootHeight) diagramRoot.style.height = rootHeight;
      diagramViewport.dataset.docsImageScale = diagramReadingSize ? 'reading' : 'fit';
      if (diagramReadingSize) {
        const width = image.naturalWidth || sourceSize.width;
        const height = image.naturalHeight || sourceSize.height;
        // A viewBox-only SVG may report a 300px default intrinsic width. Honor
        // the authored dimensions only for that same selected source, never a
        // desktop fallback's dimensions when <picture> selects a mobile asset.
        const authoredWidth =
          activeItem.media instanceof HTMLImageElement &&
          activeItem.media.currentSrc === activeItem.media.src
            ? Number(activeItem.media.getAttribute('width'))
            : 0;
        const readingWidth =
          diagramScale *
          Math.max(
            640,
            width,
            Number.isFinite(authoredWidth) && authoredWidth > 0 ? authoredWidth : 0
          );
        if (width > 0 && height > 0) {
          const imageWidth = `${readingWidth}px`;
          const imageHeight = `${(readingWidth * height) / width}px`;
          if (image.style.width !== imageWidth) image.style.width = imageWidth;
          if (image.style.height !== imageHeight) image.style.height = imageHeight;
        }
      } else {
        image.style.removeProperty('width');
        image.style.removeProperty('height');
      }
    }
    const origin =
      activeItem.media.isConnected && activeItem.trigger.contains(activeItem.media)
        ? activeItem.media.getBoundingClientRect()
        : null;
    const measuredTransform = imageOriginTransform(origin, target, viewport);
    // A later focus-restoration scroll must not silently revive a destination
    // that disappeared while this image was presented. Reset for the next open.
    if (!measuredTransform) originWasUnavailable = true;
    // The diagram frame includes controls and a scrollport, so it has no single
    // source-image return rectangle. Its existing Surface fades in both modes;
    // ordinary contained media keeps its original measured image flight.
    const transform = originWasUnavailable || diagramViewport ? null : measuredTransform;
    const values = {
      '--docs-image-left': `${target.x}px`,
      '--docs-image-top': `${target.y}px`,
      '--docs-image-width': `${target.width}px`,
      '--docs-image-height': `${target.height}px`,
      '--docs-image-origin-transform': transform ?? 'none',
    };
    for (const [name, value] of Object.entries(values))
      if (content.style.getPropertyValue(name) !== value) content.style.setProperty(name, value);
    setPreviewProps(contentSurface, { fade: !transform });
    content.dataset.docsImageReturn = transform ? 'origin' : 'fade';
  };
  const syncZoomControls = () => {
    const unavailable = !image.complete || !image.naturalWidth || !status.hidden;
    if (zoomButton) {
      zoomButton.textContent = diagramReadingSize ? labels.fit : labels.read;
      setPreviewProps(zoomButton, { disabled: unavailable });
    }
    if (zoomInButton)
      setPreviewProps(zoomInButton, {
        disabled: unavailable || (diagramReadingSize && diagramScale >= 4),
      });
    if (zoomOutButton)
      setPreviewProps(zoomOutButton, { disabled: unavailable || !diagramReadingSize });
  };
  const setDiagramScale = (reading: boolean, scale: number) => {
    if (!diagramViewport || !image.complete || !image.naturalWidth || !status.hidden) return;
    const previous = image.getBoundingClientRect();
    const center = {
      x: diagramViewport.scrollLeft + diagramViewport.clientWidth / 2,
      y: diagramViewport.scrollTop + diagramViewport.clientHeight / 2,
    };
    const preserveCenter = reading && diagramReadingSize;
    diagramReadingSize = reading;
    diagramScale = scale;
    geometry();
    if (preserveCenter && previous.width > 0 && previous.height > 0) {
      const next = image.getBoundingClientRect();
      diagramViewport.scrollTo(
        (center.x * next.width) / previous.width - diagramViewport.clientWidth / 2,
        (center.y * next.height) / previous.height - diagramViewport.clientHeight / 2
      );
    } else diagramViewport.scrollTo(0, 0);
    syncZoomControls();
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
        syncZoomControls();
        geometry();
      },
      mediaOptions
    );
    nextImage.addEventListener(
      'error',
      () => {
        if (nextImage !== image || !nextImage.hasAttribute('src')) return;
        status.hidden = false;
        nextImage.hidden = true;
        syncZoomControls();
      },
      mediaOptions
    );
    return nextImage;
  };
  const clearDiagramControls = () => {
    diagramAbort?.abort();
    diagramAbort = null;
    if (diagramFrame) diagramFrame.replaceWith(image);
    diagramFrame = null;
    diagramRoot = null;
    diagramViewport = null;
    zoomToolbar = null;
    zoomButton = null;
    zoomInButton = null;
    zoomOutButton = null;
    diagramReadingSize = false;
    diagramScale = 1;
    image.style.removeProperty('width');
    image.style.removeProperty('height');
  };
  const installDiagramControls = () => {
    diagramAbort?.abort();
    const controlsAbort = new AbortController();
    diagramAbort = controlsAbort;
    diagramReadingSize = true;
    diagramScale = 1;
    diagramFrame = doc.createElement('div');
    diagramFrame.className = 'docs-image-reading-layout';
    diagramRoot = makePreviewControl(family, 'readingRoot');
    diagramRoot.dataset.docsImageReadingRoot = '';
    diagramViewport = makePreviewControl(family, 'readingViewport', {
      a11yLabel: labels.viewport,
    });
    diagramViewport.dataset.docsImageViewport = '';
    image.replaceWith(diagramFrame);
    diagramRoot.append(diagramViewport);
    diagramViewport.append(image);
    const ownedImage = image;
    const ownedViewport = diagramViewport;
    const ownedRoot = root;
    zoomToolbar = doc.createElement('div');
    zoomToolbar.className = 'docs-image-toolbar';
    const action = (label: string, invoke: () => void) => {
      const button = makePreviewControl(family, 'button', {
        variant: family === 'brutalist' ? 'surface' : 'secondary',
        size: 'sm',
        disabled: true,
      });
      button.textContent = label;
      button.addEventListener(
        'click',
        (event) => {
          if (
            event instanceof CustomEvent &&
            !controlsAbort.signal.aborted &&
            button.isConnected &&
            ownedViewport.isConnected &&
            image === ownedImage &&
            diagramViewport === ownedViewport &&
            root === ownedRoot &&
            ownedRoot.getExposes?.().open?.get?.() === true
          )
            invoke();
        },
        { signal: controlsAbort.signal }
      );
      return button;
    };
    zoomButton = action(labels.fit, () => setDiagramScale(!diagramReadingSize, 1));
    zoomButton.dataset.docsImageZoom = '';
    zoomInButton = action(labels.larger, () =>
      setDiagramScale(true, diagramReadingSize ? Math.min(4, diagramScale * 2) : 1)
    );
    zoomInButton.dataset.docsImageZoomIn = '';
    zoomOutButton = action(labels.smaller, () =>
      setDiagramScale(diagramScale > 1, Math.max(1, diagramScale / 2))
    );
    zoomOutButton.dataset.docsImageZoomOut = '';
    zoomToolbar.append(zoomOutButton, zoomButton, zoomInButton);
    diagramFrame.append(zoomToolbar, diagramRoot);
    theme();
  };
  const createDialog = () => {
    diagramAbort?.abort();
    diagramAbort = null;
    diagramFrame = null;
    diagramRoot = null;
    diagramViewport = null;
    zoomToolbar = null;
    zoomButton = null;
    zoomInButton = null;
    zoomOutButton = null;
    diagramReadingSize = false;
    diagramScale = 1;
    const epoch = ++generation;
    root = makePreviewControl(family, 'dialogRoot', { a11yLabel: labels.title });
    root.dataset.docsImageDialog = '';
    mask = makePreviewControl(family, 'dialogMask');
    mask.dataset.docsImageMask = '';
    content = makePreviewControl(family, 'dialogContent');
    content.dataset.docsImageContent = '';
    maskSurface = makePreviewControl(family, 'surface', {
      variant: 'scrim',
      radius: 'none',
      border: 'none',
      fade: true,
      transitionState: 'closed',
    });
    maskSurface.dataset.docsImageScrim = '';
    maskSurface.style.pointerEvents = 'none';
    mask.append(maskSurface);
    contentSurface = makePreviewControl(family, 'surface', {
      variant: 'outline',
      radius: 'none',
      border: 'none',
      fade: false,
      transitionState: 'closed',
    });
    contentSurface.dataset.docsImageCanvas = '';
    content.append(contentSurface);
    title = makePreviewControl(family, 'dialogTitle');
    title.textContent = labels.title;
    title.className = 'docs-image-accessible';
    description = makePreviewControl(family, 'dialogDescription');
    description.textContent = labels.hint;
    description.className = 'docs-image-accessible docs-image-accessible-description';
    const close = makePreviewControl(family, 'dialogClose');
    const closeButton = makePreviewControl(family, 'button', {
      variant: family === 'brutalist' ? 'surface' : 'ghost',
      size: 'sm',
    });
    closeButton.textContent = labels.close;
    closeButton.dataset.docsImageClose = '';
    closeButton.className = 'docs-image-keyboard-close';
    close.append(closeButton);
    image = createImage();
    status = doc.createElement('p');
    status.className = 'docs-image-status';
    status.hidden = true;
    status.setAttribute('role', 'status');
    const statusText = makePreviewControl(family, 'text', { size: 'base', tone: 'inherit' });
    statusText.dataset.docsImageStatusText = '';
    statusText.textContent = labels.error;
    status.append(statusText);
    contentSurface.append(title, description, image, status, close);
    root.append(mask, content);
    host.append(root);
    bindPreviewSurface(mask, maskSurface, 'transitionState', renderOptions.signal);
    bindPreviewSurface(content, contentSurface, 'transitionState', renderOptions.signal);
    motion();
    theme();
    content.addEventListener(
      'beforeLeave',
      () => {
        openRequest++;
        geometry();
      },
      renderOptions
    );
    content.addEventListener(
      'afterLeave',
      () => {
        if (epoch !== generation || root.getExposes?.().open?.get?.()) return;
        restoreOrigin();
        clearDiagramControls();
        activeItem = null;
        image.removeAttribute('src');
        releaseSource();
      },
      renderOptions
    );
  };
  const open = async (item: Enhancement) => {
    const request = ++openRequest;
    const epoch = generation;
    const isCurrent = () => {
      const body = item.media.closest('[data-doc-flow]');
      return (
        !disposed &&
        request === openRequest &&
        epoch === generation &&
        item.trigger.isConnected &&
        item.trigger.contains(item.media) &&
        enhancements.includes(item) &&
        !!body &&
        isPreviewCandidate(item.media, body, item.trigger, [item.surface, item.mediaSurface])
      );
    };
    if (!isCurrent()) return;
    if (item.media instanceof HTMLImageElement && !item.media.currentSrc) {
      // A lazy <picture> may be activated before the browser selects its source.
      // Let the image request settle; never substitute the desktop src fallback
      // for an as-yet unselected responsive candidate or parse srcset ourselves.
      const declaration = item.media.closest('picture') ?? item.media;
      const requestedDeclaration = declaration.outerHTML;
      try {
        await item.media.decode();
      } catch {
        // Failed media still uses the existing img error presentation.
      }
      if (
        (item.media.closest('picture') ?? item.media) !== declaration ||
        declaration.outerHTML !== requestedDeclaration
      )
        return;
    }
    if (!isCurrent()) return;
    const source = readPreviewSource(item.media);
    if (!source) return;
    releaseSource();
    restoreOrigin();
    clearDiagramControls();
    activeItem = item;
    sourceSize = { width: source.width, height: source.height };
    originWasUnavailable = false;
    const previousImage = image;
    image = createImage();
    previousImage.replaceWith(image);
    status.hidden = true;
    image.hidden = false;
    image.alt = source.alt;
    image.dataset.sourceUrl = source.sourceUrl;
    const diagram = item.media.classList.contains('whitepaper-diagram');
    if (diagram) installDiagramControls();
    description.textContent = [labels.hint, diagram ? labels.panHint : '', source.caption]
      .filter(Boolean)
      .join('. ');
    geometry();
    item.trigger.setAttribute('data-docs-image-source-instant', '');
    item.trigger.setAttribute('data-docs-image-origin-hidden', '');
    setPreviewProps(item.mediaSurface, { fade: true, transitionState: 'closed' });
    // Never innerHTML, object/embed, source-document navigation or SVG fetch.
    if (source.svgText)
      ownedUrl = URL.createObjectURL(new Blob([source.svgText], { type: 'image/svg+xml' }));
    // Preserve the source request's credentials/referrer policy before src can initiate a request.
    if (source.crossOrigin != null) image.crossOrigin = source.crossOrigin;
    if (source.referrerPolicy) image.referrerPolicy = source.referrerPolicy;
    image.src = ownedUrl ?? source.sourceUrl;
    root.getExposes?.().openDialog?.('image.preview');
  };
  const restoreTrigger = ({
    trigger,
    original,
    label,
    surface,
    mediaSurface,
    dispose,
  }: Enhancement) => {
    dispose();
    mediaSurface.replaceWith(...Array.from(mediaSurface.childNodes));
    surface.replaceWith(...Array.from(surface.childNodes));
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
        isPreviewCandidate(item.media, body, item.trigger, [item.surface, item.mediaSurface]) &&
        readPreviewSource(item.media)
      )
        return true;
      restoreTrigger(item);
      return false;
    });
    for (const body of doc.querySelectorAll<HTMLElement>('[data-doc-flow]')) {
      for (const media of body.querySelectorAll<HTMLImageElement | SVGSVGElement>(PREVIEW_MEDIA)) {
        if (
          !(media instanceof HTMLImageElement || media instanceof SVGSVGElement) ||
          !isPreviewCandidate(media, body)
        )
          continue;
        const source = readPreviewSource(media);
        if (!source) continue;
        const legacy = media.closest('button[data-diagram-open]');
        const original = legacy ?? media.closest('picture') ?? media;
        // Only migrate the known one-image legacy trigger, never unrelated actions.
        if (
          legacy &&
          (legacy.querySelectorAll('img, svg').length !== 1 ||
            legacy.querySelector('a,button,input,select,textarea'))
        )
          continue;
        const trigger = makePreviewControl(family, 'imageTrigger');
        const surface = makePreviewControl(family, 'surface', {
          variant: 'transparent',
          radius: 'sm',
          border: 'none',
        });
        const mediaSurface = makePreviewControl(family, 'surface', {
          variant: 'transparent',
          radius: 'none',
          border: 'none',
        });
        mediaSurface.dataset.docsImageSourceSurface = '';
        surface.dataset.docsImageTriggerSurface = '';
        surface.style.pointerEvents = 'none';
        const binding = new AbortController();
        trigger.dataset.docsImageTrigger = '';
        const name = `${labels.open}: ${source.alt}`;
        trigger.title = name;
        // Button owns nameFromContent. Supply real label content instead of
        // writing an aria-label that its accessibility projection clears.
        const label = doc.createElement('span');
        label.className = 'docs-image-trigger-label';
        label.textContent = `${labels.open}: `;
        original.replaceWith(trigger);
        if (legacy) mediaSurface.append(...Array.from(legacy.childNodes));
        else mediaSurface.append(original);
        surface.append(mediaSurface);
        trigger.append(label, surface);
        bindPreviewSurface(trigger, surface, 'focusVisible', binding.signal);
        const item = {
          trigger,
          original,
          media,
          label,
          surface,
          mediaSurface,
          dispose: () => binding.abort(),
        };
        enhancements.push(item);
        themePreviewControl(trigger, family, doc.documentElement.dataset.theme === 'dark');
        trigger.addEventListener(
          'click',
          (event) => {
            if (event instanceof CustomEvent) void open(item);
          },
          renderOptions
        );
      }
    }
  };
  createDialog();
  scan();
  const contentObserver = new MutationObserver((records) => {
    if (
      records.some(
        (record) => affectsPreviewInventory(record) && !isExcludedPreviewMutation(record)
      )
    )
      scan();
    geometry();
  });
  for (const body of doc.querySelectorAll('[data-doc-flow]'))
    contentObserver.observe(body, { childList: true, subtree: true, attributes: true });
  const themeObserver = new MutationObserver(() => {
    const nextFamily = previewFamily(doc);
    if (nextFamily !== family) {
      // Close using the protocol before replacing actual family projections.
      root.getExposes?.().close?.('image.family-change');
      restoreOrigin();
      activeItem = null;
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
  window.addEventListener('resize', geometry, options);
  window.visualViewport?.addEventListener('resize', geometry, options);
  window.visualViewport?.addEventListener('scroll', geometry, options);
  // The reading viewport is this application's own scroll surface. Re-running
  // the geometry inside its scroll event would re-lay out the very zoomed
  // image the user is scrolling, so the native wheel displacement is replaced
  // by the application's own write instead of moving the reading viewport.
  // The application's geometry follows the window viewport, not its own
  // reading scroll.
  const onDocumentScroll = (event: Event) => {
    const target = event.target;
    if (
      target instanceof Node &&
      diagramViewport &&
      (target === diagramViewport || diagramViewport.contains(target))
    )
      return;
    geometry();
  };
  doc.addEventListener('scroll', onDocumentScroll, { ...options, capture: true });
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    renderAbort.abort();
    mediaAbort.abort();
    diagramAbort?.abort();
    diagramAbort = null;
    contentObserver.disconnect();
    themeObserver.disconnect();
    abort.abort();
    restoreOrigin();
    activeItem = null;
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
