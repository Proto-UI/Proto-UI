// packages/core/src/template.ts
import type { Prototype } from '../prototype';
import { isTemplateStyleHandle, type TemplateStyleHandle } from './feedback/style';
import { ElementFactory, ReservedFactories } from '../handles';

/**
 * Template is the platform-agnostic render blueprint.
 * It must be serializable/debuggable and MUST NOT carry host instance values (HTMLElement/VNode/etc).
 *
 * Canonical empty value in authoring syntax: null.
 * - boolean child: illegal
 * - undefined child: illegal (use null or omit)
 */

export type TemplateType = string | PrototypeRef | ReservedType;

export type TemplateProps = {
  style?: TemplateStyleHandle;
};

export type SvgScalar = string | number;

export type SvgSharedProps = {
  fill?: SvgScalar;
  stroke?: SvgScalar;
  strokeWidth?: SvgScalar;
  strokeLinecap?: SvgScalar;
  strokeLinejoin?: SvgScalar;
  fillRule?: SvgScalar;
  clipRule?: SvgScalar;
  opacity?: SvgScalar;
};

export type SvgRootProps = SvgSharedProps & {
  viewBox: string;
  width?: SvgScalar;
  height?: SvgScalar;
  /**
   * A decorative glyph needs a way to stay out of the accessibility tree. The
   * root is where it belongs, because it hides the whole drawing, and every
   * adapter already passes svg props through verbatim.
   */
  'aria-hidden'?: SvgScalar;
};

export type SvgGroupProps = SvgSharedProps;

export type SvgPathProps = SvgSharedProps & {
  d: string;
};

export type SvgCircleProps = SvgSharedProps & {
  cx: SvgScalar;
  cy: SvgScalar;
  r: SvgScalar;
};

export type SvgRectProps = SvgSharedProps & {
  width: SvgScalar;
  height: SvgScalar;
  x?: SvgScalar;
  y?: SvgScalar;
  rx?: SvgScalar;
  ry?: SvgScalar;
};

export type SvgLineProps = SvgSharedProps & {
  x1: SvgScalar;
  y1: SvgScalar;
  x2: SvgScalar;
  y2: SvgScalar;
};

export type SvgPolylineProps = SvgSharedProps & {
  points: string;
};

export type SvgEllipseProps = SvgSharedProps & {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type SvgPolygonProps = SvgSharedProps & {
  points: string;
};

export type SvgTemplateTag =
  | 'svg'
  | 'g'
  | 'path'
  | 'circle'
  | 'rect'
  | 'line'
  | 'polyline'
  | 'ellipse'
  | 'polygon';

export type ReservedType = { kind: 'slot' };

export interface TemplateNode {
  type: TemplateType;
  style?: TemplateStyleHandle;
  children?: TemplateChildren;
}

interface SvgTemplateNodeBase<TTag extends SvgTemplateTag, TProps> {
  kind: 'svg-node';
  tag: TTag;
  props: Readonly<TProps>;
  children?: TemplateChildren;
}

export type SvgRootNode = SvgTemplateNodeBase<'svg', SvgRootProps>;
export type SvgGroupNode = SvgTemplateNodeBase<'g', SvgGroupProps>;
export type SvgPathNode = SvgTemplateNodeBase<'path', SvgPathProps>;
export type SvgCircleNode = SvgTemplateNodeBase<'circle', SvgCircleProps>;
export type SvgRectNode = SvgTemplateNodeBase<'rect', SvgRectProps>;
export type SvgLineNode = SvgTemplateNodeBase<'line', SvgLineProps>;
export type SvgPolylineNode = SvgTemplateNodeBase<'polyline', SvgPolylineProps>;
export type SvgEllipseNode = SvgTemplateNodeBase<'ellipse', SvgEllipseProps>;
export type SvgPolygonNode = SvgTemplateNodeBase<'polygon', SvgPolygonProps>;

export type SvgTemplateNode =
  | SvgRootNode
  | SvgGroupNode
  | SvgPathNode
  | SvgCircleNode
  | SvgRectNode
  | SvgLineNode
  | SvgPolylineNode
  | SvgEllipseNode
  | SvgPolygonNode;

// NOTE: undefined is intentionally excluded to keep authoring syntax portable.
export type TemplateChild = TemplateNode | SvgTemplateNode | string | number | null;
export type TemplateChildren = TemplateChild | TemplateChild[] | null;

export interface NormalizeOptions {
  flatten?: 'none' | 'shallow' | 'deep';
  /**
   * If true, keep null in output instead of filtering it out.
   * Default false: null is treated as empty and removed from template output.
   */
  keepNull?: boolean;
}

/**
 * Default normalize policy:
 * - deep flatten arrays
 * - null treated as empty and removed from output
 * - empty result becomes canonical null
 */
export const DEFAULT_NORMALIZE: Required<NormalizeOptions> = {
  flatten: 'deep',
  keepNull: false,
};

export function normalizeChildren(
  input: unknown,
  opt: NormalizeOptions = DEFAULT_NORMALIZE
): TemplateChildren {
  const cfg: Required<NormalizeOptions> = { ...DEFAULT_NORMALIZE, ...opt };

  // Canonicalize "no children" to null (author-visible empty value).
  if (input === undefined) return null;

  const out: TemplateChild[] = [];

  const push = (v: unknown) => {
    if (typeof v === 'boolean') {
      throw new Error(
        `[Template] boolean child is illegal. Use null for empty, or omit the child.`
      );
    }
    if (v === undefined) {
      // disallow in authoring syntax: portability
      throw new Error(
        `[Template] undefined child is illegal. Use null for empty, or omit the child.`
      );
    }
    if (v === null) {
      if (cfg.keepNull) out.push(null);
      return; // filtered by default
    }
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(v);
      return;
    }
    // object should be a TemplateNode (we keep validation minimal here; can tighten later)
    out.push(v as TemplateChild);
  };

  const walk = (v: unknown, depth: number) => {
    if (!Array.isArray(v)) {
      push(v);
      return;
    }

    if (cfg.flatten === 'none') {
      throw new Error(`[Template] array children is not allowed when flatten=none.`);
    }
    if (cfg.flatten === 'shallow' && depth >= 1) {
      throw new Error(`[Template] nested array children is not allowed when flatten=shallow.`);
    }

    for (const x of v) walk(x, depth + 1);
  };

  walk(input, 0);

  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return out;
}

function isTemplateProps(v: any): v is TemplateProps {
  if (!v || typeof v !== 'object') return false;
  // Only allowed key is "style"
  const keys = Object.keys(v);
  if (keys.length === 0) return true;
  if (keys.length === 1 && keys[0] === 'style') return true;
  return false;
}

function assertTemplateProps(v: any) {
  if (!isTemplateProps(v)) {
    throw new Error(
      `[Template] illegal template-props: only { style?: TemplateStyleHandle } is allowed.\n illegal template-props value: ${JSON.stringify(
        v
      )}`
    );
  }
  if (v?.style && !isTemplateStyleHandle(v.style)) {
    throw new Error(`[Template] style must be a TemplateStyleHandle.`);
  }
}

export interface RendererPrimitivesOptions {
  normalize?: NormalizeOptions;
}

export interface SvgFactories {
  root(props: SvgRootProps, children?: TemplateChildren): SvgRootNode;
  g(props?: SvgGroupProps, children?: TemplateChildren): SvgGroupNode;
  path(props: SvgPathProps): SvgPathNode;
  circle(props: SvgCircleProps): SvgCircleNode;
  rect(props: SvgRectProps): SvgRectNode;
  line(props: SvgLineProps): SvgLineNode;
  polyline(props: SvgPolylineProps): SvgPolylineNode;
  ellipse(props: SvgEllipseProps): SvgEllipseNode;
  polygon(props: SvgPolygonProps): SvgPolygonNode;
}

function isSvgNodeTag(tag: unknown): tag is SvgTemplateTag {
  return (
    tag === 'svg' ||
    tag === 'g' ||
    tag === 'path' ||
    tag === 'circle' ||
    tag === 'rect' ||
    tag === 'line' ||
    tag === 'polyline' ||
    tag === 'ellipse' ||
    tag === 'polygon'
  );
}

export function isSvgTemplateNode(value: unknown): value is SvgTemplateNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as { kind?: unknown; tag?: unknown; props?: unknown };
  return node.kind === 'svg-node' && isSvgNodeTag(node.tag) && !!node.props;
}

const SVG_ALLOWED_KEYS: Record<SvgTemplateTag, ReadonlyArray<string>> = {
  svg: [
    'viewBox',
    'width',
    'height',
    'aria-hidden',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  g: [
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  path: [
    'd',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  circle: [
    'cx',
    'cy',
    'r',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  rect: [
    'x',
    'y',
    'width',
    'height',
    'rx',
    'ry',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  line: [
    'x1',
    'y1',
    'x2',
    'y2',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  polyline: [
    'points',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  ellipse: [
    'cx',
    'cy',
    'rx',
    'ry',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
  polygon: [
    'points',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'fillRule',
    'clipRule',
    'opacity',
  ],
};

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

function assertSvgProps(tag: SvgTemplateTag, props: unknown): void {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    throw new Error(`[Template][SVG] ${tag} props must be an object.`);
  }

  const allowed = new Set(SVG_ALLOWED_KEYS[tag]);
  const keys = Object.keys(props as Record<string, unknown>);
  for (const key of keys) {
    if (!allowed.has(key)) {
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

function createSvgNode<TTag extends SvgTemplateTag, TProps>(
  tag: TTag,
  props: TProps,
  children: TemplateChildren
): SvgTemplateNodeBase<TTag, TProps> {
  assertSvgProps(tag, props);
  return {
    kind: 'svg-node',
    tag,
    props: Object.freeze({ ...(props as any) }),
    children,
  };
}

/**
 * Create platform-agnostic renderer primitives used by runtime/adapters.
 * - `el` builds TemplateNode
 * - `r` builds reserved nodes (fragment/slot)
 * - children are normalized (boolean/undefined illegal, null treated as empty)
 */
export function createRendererPrimitives(opt: RendererPrimitivesOptions = {}) {
  const normOpt = opt.normalize ?? DEFAULT_NORMALIZE;

  const el: ElementFactory = function (type: any, a?: any, b?: any) {
    let props: TemplateProps | undefined;
    let childrenInput: any = null;

    if (arguments.length === 1) {
      childrenInput = null;
    } else if (arguments.length === 2) {
      if (isTemplateProps(a)) {
        assertTemplateProps(a);
        props = a;
        childrenInput = null;
      } else {
        childrenInput = a;
      }
    } else {
      assertTemplateProps(a);
      props = a;
      childrenInput = b;
    }

    return {
      type,
      style: props?.style,
      children: normalizeChildren(childrenInput, normOpt),
    };
  };

  const r: ReservedFactories = {
    slot() {
      if (arguments.length > 0) {
        const args = Array.from(arguments);
        throw new Error(
          `[Template] slot() takes no arguments.\n illegal slot arguments: ${JSON.stringify(args)}`
        );
      }
      return el({ kind: 'slot' });
    },
  };

  const slot = r.slot;
  const svg: SvgFactories = {
    root(props, children = null) {
      return createSvgNode('svg', props, normalizeChildren(children, normOpt));
    },
    g(props = {}, children = null) {
      return createSvgNode('g', props, normalizeChildren(children, normOpt));
    },
    path(props) {
      return createSvgNode('path', props, null);
    },
    circle(props) {
      return createSvgNode('circle', props, null);
    },
    rect(props) {
      return createSvgNode('rect', props, null);
    },
    line(props) {
      return createSvgNode('line', props, null);
    },
    polyline(props) {
      return createSvgNode('polyline', props, null);
    },
    ellipse(props) {
      return createSvgNode('ellipse', props, null);
    },
    polygon(props) {
      return createSvgNode('polygon', props, null);
    },
  };

  return { el, slot, r, svg };
}

export interface PrototypeRef {
  kind: 'prototype';
  name: string;
  ref?: unknown;
}

/**
 * Represent a Prototype as a TemplateType safely (debuggable/serializable).
 */
export function asPrototypeRef(proto: Prototype): PrototypeRef {
  return { kind: 'prototype', name: proto.name, ref: proto };
}
