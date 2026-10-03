/** A deliberately small static-inline-SVG admission profile, not a sanitizer.
 * Unsupported markup is left unchanged in the document and is never cloned into
 * the preview. SVG files already displayed through img remain in image mode.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
]);
const SVG_ATTRIBUTES = new Set([
  'id',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'dx',
  'dy',
  'rotate',
  'preserveAspectRatio',
  'vector-effect',
  'color',
  'role',
  'aria-label',
  'aria-hidden',
]);
const INTERACTIVE =
  'a, button, input, select, textarea, summary, [role], [tabindex], [contenteditable]:not([contenteditable="false"]), [data-image-preview="off"], [data-previewer-id], [data-prototype-previewer], pre, code';

export type PreviewSource = {
  sourceUrl: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  svgText?: string;
  crossOrigin?: string | null;
  referrerPolicy?: string;
};

export function staticSvgText(svg: SVGSVGElement): string | null {
  const nodes = [svg, ...svg.querySelectorAll('*')];
  if (nodes.length > 1000 || svg.outerHTML.length > 250_000) return null;
  for (const node of nodes) {
    if (node.namespaceURI !== SVG_NS || !SVG_ELEMENTS.has(node.localName)) return null;
    if (node !== svg && node.localName === 'svg') return null;
    for (const attr of Array.from(node.attributes)) {
      if (
        attr.namespaceURI === XMLNS_NS &&
        node === svg &&
        attr.name === 'xmlns' &&
        attr.value === SVG_NS
      )
        continue;
      // Reject namespaces, style/class, all href/use/defs and local references too.
      // No CSS parsing, URL decoding or graph traversal is guessed here.
      if (attr.namespaceURI || !SVG_ATTRIBUTES.has(attr.name)) return null;
      if (
        /[\\\u0000-\u001f\u007f]/u.test(attr.value) ||
        /(?:url\s*\(|@|:|;|&|<|>|%)/iu.test(attr.value)
      )
        return null;
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1 && child.nodeType !== 3) return null;
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

export function readPreviewSource(media: HTMLImageElement | SVGSVGElement): PreviewSource | null {
  if (
    media.closest(
      '[data-image-preview="off"], [aria-hidden="true"], [hidden], [inert], [contenteditable]:not([contenteditable="false"])'
    )
  )
    return null;
  if (media.hasAttribute('usemap') || media.hasAttribute('controls')) return null;
  if (media.getAttribute('role') === 'presentation' || media.getAttribute('role') === 'none')
    return null;
  const caption = media.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '';
  const alt =
    media instanceof HTMLImageElement
      ? media.alt
      : media.getAttribute('aria-label') || media.querySelector('title')?.textContent || '';
  // Empty alt is an explicit decorative opt-out; a caption does not overwrite it.
  if (!alt.trim()) return null;
  if (media instanceof HTMLImageElement) {
    const sourceUrl = media.currentSrc || media.src;
    if (!sourceUrl) return null;
    let url: URL;
    try {
      url = new URL(sourceUrl, media.ownerDocument.baseURI);
    } catch {
      return null;
    }
    if (
      !['http:', 'https:', 'blob:'].includes(url.protocol) &&
      !/^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i.test(sourceUrl)
    )
      return null;
    return {
      sourceUrl,
      crossOrigin: media.crossOrigin,
      referrerPolicy: media.referrerPolicy,
      alt,
      caption,
      width: media.naturalWidth || media.width,
      height: media.naturalHeight || media.height,
    };
  }
  const svgText = staticSvgText(media);
  if (!svgText) return null;
  const viewBox = media
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  return {
    sourceUrl: '',
    svgText,
    alt,
    caption,
    width: Number(media.getAttribute('width')) || viewBox?.[2] || 0,
    height: Number(media.getAttribute('height')) || viewBox?.[3] || 0,
  };
}

export function isPreviewCandidate(
  media: Element,
  content: Element,
  existingTrigger?: Element
): boolean {
  if (!content.contains(media)) return false;
  if (
    media.closest('[hidden], [inert], [contenteditable]:not([contenteditable="false"])') ||
    media.hasAttribute('usemap') ||
    media.hasAttribute('controls')
  )
    return false;
  const trigger = media.closest('[data-docs-image-trigger]');
  if (trigger && trigger !== existingTrigger) return false;
  const hasHandler = (node: Element) =>
    Array.from(node.attributes).some((attr) => /^on/i.test(attr.name));
  if (hasHandler(media)) return false;
  const legacy = media.closest('button[data-diagram-open]');
  for (
    let parent = media.parentElement;
    parent && parent !== content;
    parent = parent.parentElement
  ) {
    if (parent === existingTrigger) continue;
    if (hasHandler(parent)) return false;
    if (parent === legacy) continue;
    if (parent.matches(INTERACTIVE) || parent.localName.includes('-')) return false;
  }
  // SVG role=img describes media, not a separate interactive owner.
  if (
    media.hasAttribute('tabindex') ||
    (media.hasAttribute('role') && media.getAttribute('role') !== 'img')
  )
    return false;
  return true;
}
