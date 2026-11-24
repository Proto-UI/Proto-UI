// packages/core/src/template.ts
import type { Prototype } from '../prototype';
import type { OwnedDecorationTarget } from './feedback/style';
import type { MaterialPaintReservation } from '../material-paint-reservation';
import { isTemplateStyleHandle, type TemplateStyleHandle } from './feedback/style';
import { ElementFactory, ReservedFactories } from '../handles';
import { assertSvgProps, isSvgNodeTag } from './svg-tags';

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

export type ReservedType =
  | { kind: 'slot' }
  | { kind: 'decoration'; target: OwnedDecorationTarget }
  | { kind: 'paint-reservation'; target: MaterialPaintReservation };

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
// Canonical factory output stays flat. Authoring arrays are normalized at the
// el / SVG factory boundary; they must not widen TemplateNode.children.
export type TemplateChildren = TemplateChild | TemplateChild[] | null;

/** Nested authoring input for factories that normalize children (C-TEMPLATE-0004). */
export type TemplateChildrenInput = TemplateChild | readonly TemplateChildrenInput[];

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
  root(props: SvgRootProps, children?: TemplateChildrenInput): SvgRootNode;
  g(props?: SvgGroupProps, children?: TemplateChildrenInput): SvgGroupNode;
  path(props: SvgPathProps): SvgPathNode;
  circle(props: SvgCircleProps): SvgCircleNode;
  rect(props: SvgRectProps): SvgRectNode;
  line(props: SvgLineProps): SvgLineNode;
  polyline(props: SvgPolylineProps): SvgPolylineNode;
  ellipse(props: SvgEllipseProps): SvgEllipseNode;
  polygon(props: SvgPolygonProps): SvgPolygonNode;
}

export function isSvgTemplateNode(value: unknown): value is SvgTemplateNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as { kind?: unknown; tag?: unknown; props?: unknown };
  return node.kind === 'svg-node' && isSvgNodeTag(node.tag) && !!node.props;
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

  const decoration = (target: OwnedDecorationTarget): TemplateNode => {
    if (!target || typeof target !== 'object')
      throw new Error('[Template] invalid decoration target');
    return Object.freeze({ type: Object.freeze({ kind: 'decoration' as const, target }) });
  };
  const paintReservation = (
    target: MaterialPaintReservation,
    children: TemplateChildrenInput
  ): TemplateNode => {
    if (!target || typeof target !== 'object')
      throw new Error('[Template] invalid material paint reservation');
    return Object.freeze({
      type: Object.freeze({ kind: 'paint-reservation' as const, target }),
      children: normalizeChildren(children, normOpt),
    });
  };
  return { el, slot, r, svg, decoration, paintReservation };
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
