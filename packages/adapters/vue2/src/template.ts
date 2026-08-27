import {
  mergeTwTokensV0,
  type TemplateChildren,
  type TemplateChild,
  type TemplateNode,
  type ReservedType,
  type SvgTemplateNode,
  isSvgTemplateNode,
} from '@proto.ui/core';

export const ERR_TEMPLATE_PROTOTYPE_REF_V0 =
  '[Template] PrototypeRef is not allowed in Template v0.';

export type Vue2TemplateRuntime = {
  h: (type: any, props?: any, children?: any) => any;
};

export type RenderVue2TemplateOptions = {
  slot?: any;
};

function isTemplateNode(x: any): x is TemplateNode {
  return x && typeof x === 'object' && 'type' in x;
}

function toArray(children: TemplateChildren): TemplateChild[] {
  if (children === null) return [];
  return Array.isArray(children) ? (children as any[]) : [children as any];
}

function pushRendered(out: any[], rendered: any) {
  if (rendered == null) return;
  if (Array.isArray(rendered)) {
    out.push(...rendered);
    return;
  }
  out.push(rendered);
}

function isReservedType(t: any): t is ReservedType {
  return t && typeof t === 'object' && t.kind === 'slot';
}

function isPrototypeRef(t: any): t is { kind: 'prototype'; name: string; ref?: any } {
  return t && typeof t === 'object' && t.kind === 'prototype' && typeof t.name === 'string';
}

const SVG_ATTR_NAMES: Record<string, string> = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
};

function svgTagAllowsChildren(tag: SvgTemplateNode['tag']): boolean {
  return tag === 'svg' || tag === 'g';
}

function buildSvgProps(node: SvgTemplateNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    out[SVG_ATTR_NAMES[key] ?? key] = value;
  }
  return out;
}

function renderChild(
  runtime: Vue2TemplateRuntime,
  child: TemplateChild,
  opt: RenderVue2TemplateOptions,
  ctx: { slotUsed: boolean }
): any {
  if (child === null) return null;

  if (typeof child === 'string' || typeof child === 'number') {
    return child;
  }

  if (isSvgTemplateNode(child)) {
    const kids = toArray(child.children ?? null).map((k) => renderChild(runtime, k, opt, ctx));
    if (!svgTagAllowsChildren(child.tag) && kids.length > 0) {
      throw new Error(`[Vue2 Adapter] svg node <${child.tag}> must not have children.`);
    }
    return runtime.h(child.tag, { attrs: buildSvgProps(child) }, kids as any);
  }

  if (!isTemplateNode(child)) {
    return String(child);
  }

  const t = child.type;

  if (isReservedType(t) && t.kind === 'slot') {
    if ((child as any).children != null) {
      throw new Error('[Vue2 Adapter] slot node must not have children in v0.');
    }
    if ((child as any).style != null) {
      throw new Error('[Vue2 Adapter] slot node must not have style in v0.');
    }
    if ((t as any).name) {
      throw new Error('[Vue2 Adapter] named slot is not supported in v0.');
    }
    if (ctx.slotUsed) {
      throw new Error('[Vue2 Adapter] multiple slot is not supported in v0.');
    }
    ctx.slotUsed = true;
    return opt.slot ?? null;
  }

  if (isPrototypeRef(t)) {
    throw new Error(ERR_TEMPLATE_PROTOTYPE_REF_V0);
  }

  if (typeof t !== 'string') return null;

  const kids: any[] = [];
  for (const k of toArray(child.children ?? null)) {
    pushRendered(kids, renderChild(runtime, k, opt, ctx));
  }

  let className: string | undefined;
  if (child.style && child.style.kind === 'tw') {
    const merged = mergeTwTokensV0(child.style.tokens).tokens;
    if (merged.length > 0) className = merged.join(' ');
  }

  const props: Record<string, any> = {};
  if (className) props.class = className;

  return runtime.h(t, props, kids as any);
}

export function renderTemplateToVue2(
  runtime: Vue2TemplateRuntime,
  children: TemplateChildren,
  opt: RenderVue2TemplateOptions = {}
): any {
  const arr = toArray(children);
  const ctx = { slotUsed: false };
  const out: any[] = [];
  for (const c of arr) {
    pushRendered(out, renderChild(runtime, c, opt, ctx));
  }
  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return out;
}
