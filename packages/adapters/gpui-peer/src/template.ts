import type { TemplateChild, TemplateChildren, TemplateNode } from '@proto.ui/core';
import { isSvgTemplateNode } from '@proto.ui/core';
import type { WireValue } from '@proto.ui/host-protocol';

/**
 * Serializes Template v0 into bounded wire data. Structural nodes carry no
 * durable identity; the reserved slot marker is the only place host-owned
 * content enters the view (record section G).
 */

export type TemplateSerialization = {
  readonly template: WireValue;
  readonly slots: readonly string[];
};

export const ERR_TEMPLATE_PROTOTYPE_REF = '[gpui-peer] PrototypeRef is not allowed in Template v0.';
export const ERR_TEMPLATE_MULTIPLE_SLOTS = '[gpui-peer] multiple slots are not supported in v0.';

const DEFAULT_SLOT_REF = 'slot-default';

function isTemplateNode(value: unknown): value is TemplateNode {
  return !!value && typeof value === 'object' && 'type' in (value as object);
}

function toArray(children: TemplateChildren | undefined): TemplateChild[] {
  if (children === null || children === undefined) return [];
  return Array.isArray(children) ? [...children] : [children];
}

export function serializeTemplate(children: TemplateChildren): TemplateSerialization {
  const slots: string[] = [];

  const visitChildren = (input: TemplateChildren | undefined): WireValue[] =>
    toArray(input).flatMap((child) => {
      const node = visit(child);
      return node === null ? [] : [node];
    });

  const visit = (child: TemplateChild): WireValue | null => {
    if (child === null) return null;
    if (typeof child === 'string' || typeof child === 'number') {
      return { kind: 'text', value: String(child) };
    }
    if (isSvgTemplateNode(child)) {
      return {
        kind: 'svg',
        tag: child.tag,
        props: Object.fromEntries(
          Object.entries(child.props).map(([key, value]) => [key, value as WireValue])
        ),
        children: visitChildren(child.children),
      };
    }
    if (!isTemplateNode(child)) {
      return { kind: 'text', value: String(child) };
    }

    const type = child.type;
    if (typeof type === 'string') {
      const node: Record<string, WireValue> = {
        kind: 'element',
        type,
        children: visitChildren(child.children),
      };
      if (child.style?.kind === 'tw') node.style = { kind: 'tw', tokens: [...child.style.tokens] };
      return node;
    }
    if (type && typeof type === 'object' && (type as { kind?: string }).kind === 'slot') {
      if (slots.length > 0) throw new Error(ERR_TEMPLATE_MULTIPLE_SLOTS);
      slots.push(DEFAULT_SLOT_REF);
      return { kind: 'slot', ref: DEFAULT_SLOT_REF };
    }
    if (type && typeof type === 'object' && (type as { kind?: string }).kind === 'prototype') {
      throw new Error(ERR_TEMPLATE_PROTOTYPE_REF);
    }
    return null;
  };

  return { template: { kind: 'root', children: visitChildren(children) }, slots };
}
