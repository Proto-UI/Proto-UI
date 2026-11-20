import { applyTemplateStyle } from './style';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import type { OwnedDecorationTarget } from '@proto.ui/core';

const ownedPaint = new WeakMap<HTMLElement, { tokens: string | null; style: string | null }>();

function rememberPaint(node: HTMLElement) {
  ownedPaint.set(node, {
    tokens: node.getAttribute('data-pui-style'),
    style: node.getAttribute('style'),
  });
}

export function hasCurrentOwnedDecorationPaint(node: HTMLElement): boolean {
  const paint = ownedPaint.get(node);
  return (
    !!paint &&
    node.getAttribute('data-pui-style') === paint.tokens &&
    node.getAttribute('style') === paint.style
  );
}

/** Adapter-created empty leaf only; neither node nor sink is returned to authors. */
export function stageOwnedDecoration(doc: Document, target: OwnedDecorationTarget) {
  const node = doc.createElement('span');
  node.setAttribute('data-pui-owned-decoration', '');
  const invariant = () => {
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('inert', '');
    node.style.setProperty('pointer-events', 'none', 'important');
  };
  invariant();
  rememberPaint(node);
  const binding: OwnedDecorationBinding = {
    target,
    sink: (value) => {
      node.removeAttribute('data-pui-style');
      node.removeAttribute('style');
      applyTemplateStyle(node, { kind: 'tw', tokens: [...value.tokens] });
      invariant();
      rememberPaint(node);
    },
  };
  return { node, binding };
}
