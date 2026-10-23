import {
  isSvgTemplateNode,
  type OwnedDecorationTarget,
  type TemplateChildren,
} from '@proto.ui/core';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';

/** Internal adapter bridge. This does not expose physical nodes to prototype authors. */
export function collectWebOwnedDecorationTargets(
  children: TemplateChildren
): OwnedDecorationTarget[] {
  const targets: OwnedDecorationTarget[] = [];
  const seen = new Set<OwnedDecorationTarget>();
  const visit = (value: any): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const type = value.type;
    if (type && typeof type === 'object' && type.kind === 'decoration') {
      if (
        Object.keys(value).some((key) => key !== 'type') ||
        Object.keys(type).some((key) => key !== 'kind' && key !== 'target')
      )
        throw new Error('[owned-decoration] expected empty owned leaf');
      const target = type.target as OwnedDecorationTarget;
      if (seen.has(target)) throw new Error('[owned-decoration] duplicate target');
      seen.add(target);
      targets.push(target);
      return;
    }
    if (isSvgTemplateNode(value) || 'type' in value) visit(value.children);
  };
  visit(children);
  return targets;
}

export type WebOwnedDecorationStage = ReturnType<typeof createWebOwnedDecorationStage>;

/** One physical first view only; no registry recreation or framework state updates on paint. */
export function createWebOwnedDecorationStage(
  targets: readonly OwnedDecorationTarget[],
  validate: (targets: readonly OwnedDecorationTarget[]) => void
) {
  const identities = [...targets];
  if (new Set(identities).size !== identities.length)
    throw new Error('[owned-decoration] duplicate target');
  validate(identities);
  let phase: 'staging' | 'binding' | 'bound' | 'retired' | 'failed' = 'staging';
  const refs = new Map<
    OwnedDecorationTarget,
    {
      node: HTMLElement | null;
      active: boolean;
      ref: (node: Element | null) => void;
    }
  >();
  const invariant = (node: HTMLElement) => {
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('inert', '');
    node.style.setProperty('pointer-events', 'none', 'important');
  };
  const checkLeaf = (value: Element): HTMLElement => {
    if (
      value.nodeType !== 1 ||
      value.localName !== 'span' ||
      value.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      value.childNodes.length ||
      value.hasAttribute('tabindex') ||
      value.hasAttribute('contenteditable')
    )
      throw new Error('[owned-decoration] invalid physical leaf');
    return value as HTMLElement;
  };
  for (const target of identities) {
    const entry = {
      node: null as HTMLElement | null,
      active: false,
      ref: (_node: Element | null) => {},
    };
    entry.ref = (value) => {
      if (value === null) {
        entry.active = false;
        return;
      }
      // Frameworks may deliver a stale ref during effect replay. It must do
      // nothing, not revive the old lease or mutate a newly supplied element.
      if (phase === 'retired' || phase === 'failed') return;
      const node = checkLeaf(value);
      if (entry.node && entry.node !== node)
        throw new Error('[owned-decoration] physical rebind unsupported');
      entry.node = node;
      entry.active = true;
      invariant(node);
    };
    refs.set(target, entry);
  }
  return {
    ref(target: OwnedDecorationTarget) {
      const entry = refs.get(target);
      if (!entry) throw new Error('[owned-decoration] foreign target');
      return entry.ref;
    },
    bind(host: Element, bindAll: (bindings: readonly OwnedDecorationBinding[]) => void) {
      if (phase !== 'staging') throw new Error('[owned-decoration] repeated binding');
      const physical = new Set<Element>();
      const bindings = identities.map((target): OwnedDecorationBinding => {
        const entry = refs.get(target)!;
        if (!entry.active || !entry.node || !host.contains(entry.node) || entry.node === host)
          throw new Error('[owned-decoration] missing owned physical leaf');
        const node = checkLeaf(entry.node);
        if (physical.has(node)) throw new Error('[owned-decoration] duplicate physical leaf');
        physical.add(node);
        return {
          target,
          sink(value) {
            if ((phase !== 'binding' && phase !== 'bound') || !entry.active || entry.node !== node)
              throw new Error('[owned-decoration] inactive physical leaf');
            checkLeaf(node);
            if (!host.contains(node)) throw new Error('[owned-decoration] physical scope changed');
            node.removeAttribute('data-pui-style');
            if (value.tokens.length) node.setAttribute('data-pui-style', value.tokens.join(' '));
            invariant(node);
          },
        };
      });
      phase = 'binding';
      try {
        bindAll(bindings);
        if (phase !== 'binding') throw new Error('[owned-decoration] view retired during binding');
        phase = 'bound';
      } catch (error) {
        phase = 'failed';
        throw error;
      }
    },
    retire() {
      phase = 'retired';
      for (const entry of refs.values()) entry.active = false;
    },
  };
}
