import type { SvgTemplateTag } from './template';

// One closed tag schema is shared by ordinary factories and owned snapshots.
// Geometry and shared presentation fields stay separate so validation does
// not allocate and populate another Set for every glyph.
const SVG_TAG_KEYS: Record<SvgTemplateTag, ReadonlyArray<string>> = {
  svg: ['viewBox', 'width', 'height', 'aria-hidden'],
  g: [],
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  polygon: ['points'],
};

export function isSvgNodeTag(tag: unknown): tag is SvgTemplateTag {
  return typeof tag === 'string' && Object.prototype.hasOwnProperty.call(SVG_TAG_KEYS, tag);
}

const SVG_SHARED_KEYS = new Set([
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'fillRule',
  'clipRule',
  'opacity',
]);

const SVG_REQUIRED_KEYS: Partial<Record<SvgTemplateTag, ReadonlyArray<string>>> = {
  svg: ['viewBox'],
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['width', 'height'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  polygon: ['points'],
};

export function assertSvgProps(tag: SvgTemplateTag, props: unknown): void {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    throw new Error(`[Template][SVG] ${tag} props must be an object.`);
  }

  const allowed = SVG_TAG_KEYS[tag];
  const keys = Object.keys(props as Record<string, unknown>);
  for (const key of keys) {
    if (!SVG_SHARED_KEYS.has(key) && !allowed.includes(key)) {
      throw new Error(`[Template][SVG] ${tag} does not support prop '${key}'.`);
    }
  }

  const required = SVG_REQUIRED_KEYS[tag] ?? [];
  for (const key of required) {
    const value = (props as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === '') {
      throw new Error(`[Template][SVG] ${tag} requires non-empty prop '${key}'.`);
    }
  }
}
