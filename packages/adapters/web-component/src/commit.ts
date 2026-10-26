import {
  captureWebComponentCallerFocus,
  isWebComponentOwnedRelocating,
  withWebComponentOwnedRelocation,
} from './owned-relocation';
// packages/adapters/web-component/src/commit.ts

import { applyTemplateStyle } from './style';
import { stageOwnedDecoration } from './owned-decoration';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import type {
  TemplateChildren,
  TemplateChild,
  TemplateNode,
  TemplateType,
  ReservedType,
  SvgTemplateNode,
} from '@proto.ui/core';
import { isSvgTemplateNode } from '@proto.ui/core';

export type CommitOptions = {
  mode?: 'light' | 'shadow';
  bindDecorations?: (bindings: readonly OwnedDecorationBinding[]) => void;
  slotPool?: Node[];
  owned?: WeakSet<Node>; // 收集“模板创建的节点”，用于区分外部节点
};

export type CommitResult = {
  hasSlot: boolean;
  slotStart?: Text; // light mode only
  slotEnd?: Text; // light mode only
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

export const ERR_TEMPLATE_PROTOTYPE_REF_V0 = `[Template] PrototypeRef is not allowed in Template v0.`;
const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_ATTR_NAMES: Record<string, string> = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
};

function createElementForType(type: TemplateType, doc: Document): Node | null {
  if (typeof type === 'string') return doc.createElement(type);

  if (isReservedType(type)) return null; // slot handled elsewhere

  if (isPrototypeRef(type)) {
    // ✅ v0 contract: adapters MUST reject prototype-level composition
    throw new Error(ERR_TEMPLATE_PROTOTYPE_REF_V0);
  }

  return null;
}

function appendCommittedChild(
  parent: Node,
  child: TemplateChild,
  doc: Document,
  opt: Required<CommitOptions>,
  ctx: {
    slotUsed: boolean;
    slotStart?: Text;
    slotEnd?: Text;
    decorations: OwnedDecorationBinding[];
  }
) {
  if (child === null) return;

  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(doc.createTextNode(String(child)));
    return;
  }

  if (isSvgTemplateNode(child)) {
    appendSvgChild(parent, child, doc, opt, ctx);
    return;
  }

  if (!isTemplateNode(child)) {
    parent.appendChild(doc.createTextNode(String(child)));
    return;
  }

  const t = child.type;
  if (t && typeof t === 'object' && t.kind === 'decoration') {
    if (
      Object.keys(child).some((k) => k !== 'type') ||
      Object.keys(t).some((k) => k !== 'kind' && k !== 'target')
    )
      throw new Error('[Template] decoration must be an empty owned leaf');
    const staged = stageOwnedDecoration(doc, t.target);
    opt.owned.add(staged.node);
    ctx.decorations.push(staged.binding);
    parent.appendChild(staged.node);
    return;
  }

  if (isReservedType(t) && t.kind === 'slot') {
    if ((child as any).children != null) {
      throw new Error('slot:children');
    }
    if ((child as any).style != null) {
      throw new Error('slot:style');
    }
    // v0: 核心语法层已禁止具名，这里仍防御
    if ((t as any).name) {
      throw new Error('slot:named');
    }
    if (ctx.slotUsed) {
      throw new Error('slot:multiple');
    }
    ctx.slotUsed = true;

    if (opt.mode === 'shadow') {
      const el = doc.createElement('slot');
      opt.owned?.add(el);
      parent.appendChild(el);
      return;
    }

    // light mode: 不产生 <slot>，用空 Text 作为锚点
    const start = doc.createTextNode('');
    const end = doc.createTextNode('');
    opt.owned?.add(start);
    opt.owned?.add(end);

    ctx.slotStart = start;
    ctx.slotEnd = end;

    parent.appendChild(start);
    parent.appendChild(end);
    return;
  }

  // normal element / prototype
  const node = createElementForType(t, doc);
  if (!node) return;

  opt.owned?.add(node);

  if ((node as any).nodeType === 1) {
    const el = node as Element;

    applyTemplateStyle(el, child.style);

    const kids = toArray(child.children ?? null);
    for (const k of kids) appendCommittedChild(el, k, doc, opt, ctx);
  }

  parent.appendChild(node);
}

function svgTagAllowsChildren(tag: SvgTemplateNode['tag']): boolean {
  return tag === 'svg' || tag === 'g';
}

function setSvgAttribute(el: Element, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  const name = SVG_ATTR_NAMES[key] ?? key;
  el.setAttribute(name, String(value));
}

function appendSvgChild(
  parent: Node,
  child: SvgTemplateNode,
  doc: Document,
  opt: Required<CommitOptions>,
  ctx: {
    slotUsed: boolean;
    slotStart?: Text;
    slotEnd?: Text;
    decorations: OwnedDecorationBinding[];
  }
): void {
  const el = doc.createElementNS(SVG_NS, child.tag);
  opt.owned?.add(el);

  for (const [key, value] of Object.entries(child.props as Record<string, unknown>)) {
    setSvgAttribute(el, key, value);
  }

  const kids = toArray(child.children ?? null);
  if (!svgTagAllowsChildren(child.tag) && kids.length > 0) {
    throw new Error(`svg <${child.tag}>:children unsupported`);
  }

  for (const kid of kids) {
    appendCommittedChild(el, kid, doc, opt, ctx);
  }

  parent.appendChild(el);
}

export function commitChildren(
  hostRoot: Element | DocumentFragment,
  children: TemplateChildren,
  opt: CommitOptions = {}
): CommitResult {
  const doc = hostRoot.ownerDocument ?? document;
  const container = doc.createDocumentFragment();

  const cfg: Required<CommitOptions> = {
    mode: opt.mode ?? 'light',
    slotPool: opt.slotPool ?? [],
    owned: opt.owned ?? new WeakSet<Node>(),
    bindDecorations:
      opt.bindDecorations ??
      ((bindings) => {
        if (bindings.length) throw new Error('[Template] owned-decoration unsupported');
      }),
  };

  const ctx: {
    slotUsed: boolean;
    slotStart?: Text;
    slotEnd?: Text;
    decorations: OwnedDecorationBinding[];
  } = {
    slotUsed: false,
    decorations: [],
  };

  const arr = toArray(children);
  for (const c of arr) appendCommittedChild(container, c, doc, cfg, ctx);

  cfg.bindDecorations(ctx.decorations);

  // Stage and validate the WHOLE blueprint before moving any caller-owned
  // slot content. A later invalid node must not detach children from the live
  // tree just because an earlier slot was encountered in the traversal.
  const focus = captureWebComponentCallerFocus(cfg.slotPool);
  try {
    if (cfg.mode === 'light' && ctx.slotEnd) {
      const slotParent = ctx.slotEnd.parentNode!;
      for (const node of cfg.slotPool) slotParent.insertBefore(node, ctx.slotEnd);
    }
    withWebComponentOwnedRelocation(
      cfg.slotPool,
      hostRoot,
      () => {
        (hostRoot as any).replaceChildren(...Array.from(container.childNodes));
        focus.restore(isWebComponentOwnedRelocating);
      },
      container
    );
  } finally {
    focus.dispose();
  }

  return {
    hasSlot: ctx.slotUsed,
    slotStart: ctx.slotStart,
    slotEnd: ctx.slotEnd,
  };
}
