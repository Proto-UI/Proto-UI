import { createWebOwnedDecorationPortalGate } from './web-owned-decoration-portal';
import {
  isSvgTemplateNode,
  type OwnedDecorationTarget,
  type TemplateChildren,
} from '@proto.ui/core';
import { createWebOwnedDecorationStage as createStage } from './web-owned-decoration-stage';

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

/** Adapter portal authority is injected into the shared physical-stage primitive. */
export function createWebOwnedDecorationStage(
  targets: readonly OwnedDecorationTarget[],
  validate: (targets: readonly OwnedDecorationTarget[]) => void,
  options: { portal?: boolean } = {}
) {
  return createStage(targets, validate, {
    createPortalGate: options.portal ? createWebOwnedDecorationPortalGate : undefined,
  });
}
