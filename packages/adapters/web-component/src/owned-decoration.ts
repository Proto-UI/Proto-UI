import { applyTemplateStyle } from './style';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import type { OwnedDecorationTarget } from '@proto.ui/core';

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
  const binding: OwnedDecorationBinding = {
    target,
    sink: (value) => {
      node.removeAttribute('data-pui-style');
      node.removeAttribute('style');
      applyTemplateStyle(node, { kind: 'tw', tokens: [...value.tokens] });
      invariant();
    },
  };
  return { node, binding };
}
