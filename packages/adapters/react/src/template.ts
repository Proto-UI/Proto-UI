// packages/adapters/react/src/template.ts
import {
  mergeTwTokensV0,
  type TemplateChildren,
  type TemplateChild,
  type TemplateNode,
  type TemplateType,
  type ReservedType,
  type SvgTemplateNode,
  isSvgTemplateNode,
} from '@proto.ui/core';

export const ERR_TEMPLATE_PROTOTYPE_REF_V0 =
  '[Template] PrototypeRef is not allowed in Template v0.';

export type ReactRuntime = {
  createElement: (type: any, props: any, ...children: any[]) => any;
};

export type RenderTemplateOptions = {
  slot?: any;
};

function isTemplateNode(x: any): x is TemplateNode {
  return x && typeof x === 'object' && 'type' in x;
}

function toArray(children: TemplateChildren): TemplateChild[] {
  if (children === null) return [];
  return Array.isArray(children) ? (children as any[]) : [children as any];
}

function isReservedType(t: any): t is ReservedType {
  return t && typeof t === 'object' && t.kind === 'slot';
}

function isPrototypeRef(t: any): t is { kind: 'prototype'; name: string; ref?: any } {
  return t && typeof t === 'object' && t.kind === 'prototype' && typeof t.name === 'string';
}

function svgTagAllowsChildren(tag: SvgTemplateNode['tag']): boolean {
  return tag === 'svg' || tag === 'g';
}

function buildSvgProps(node: SvgTemplateNode): Record<string, unknown> {
  return { ...node.props };
}

function renderChild(
  runtime: ReactRuntime,
  child: TemplateChild,
  opt: RenderTemplateOptions,
  ctx: { slotUsed: boolean }
): any {
  if (child === null) return null;

  if (typeof child === 'string' || typeof child === 'number') {
    return child;
  }

  if (isSvgTemplateNode(child)) {
    const kids = toArray(child.children ?? null).map((k) => renderChild(runtime, k, opt, ctx));
    if (!svgTagAllowsChildren(child.tag) && kids.length > 0) {
      throw new Error(`[React Adapter] svg node <${child.tag}> must not have children.`);
    }
    return runtime.createElement(child.tag, buildSvgProps(child), ...kids);
  }

  if (!isTemplateNode(child)) {
    return String(child);
  }

  const t = child.type;

  if (isReservedType(t) && t.kind === 'slot') {
    if ((child as any).children != null) {
      throw new Error('[React Adapter] slot node must not have children in v0.');
    }
    if ((child as any).style != null) {
      throw new Error('[React Adapter] slot node must not have style in v0.');
    }
    if ((t as any).name) {
      throw new Error('[React Adapter] named slot is not supported in v0.');
    }
    if (ctx.slotUsed) {
      throw new Error('[React Adapter] multiple slot is not supported in v0.');
    }
    ctx.slotUsed = true;
    return opt.slot ?? null;
  }

  if (isPrototypeRef(t)) {
    throw new Error(ERR_TEMPLATE_PROTOTYPE_REF_V0);
  }

  if (typeof t !== 'string') return null;

  const kids = toArray(child.children ?? null).map((k) => renderChild(runtime, k, opt, ctx));

  let className: string | undefined;
  if (child.style && child.style.kind === 'tw') {
    const merged = mergeTwTokensV0(child.style.tokens).tokens;
    if (merged.length > 0) className = merged.join(' ');
  }

  const props: Record<string, any> = {};
  if (className) {
    props.className = className;
    // Only this newly materialized ordinary Template element owns the carrier.
    props['data-pui-style'] = className;
  }

  return runtime.createElement(t, props, ...kids);
}

export function renderTemplateToReact(
  runtime: ReactRuntime,
  children: TemplateChildren,
  opt: RenderTemplateOptions = {}
): any {
  const arr = toArray(children);
  const ctx = { slotUsed: false };
  const out = arr.map((c) => renderChild(runtime, c, opt, ctx));
  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return out;
}
