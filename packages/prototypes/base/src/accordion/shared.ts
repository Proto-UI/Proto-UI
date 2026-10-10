import {
  createAnatomyFamily,
  createContextKey,
  type AnatomyPartView,
  type RunHandle,
} from '@proto.ui/core';
import type { AccordionReason } from './types';

export const ACCORDION_FAMILY = createAnatomyFamily('base-accordion', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    item: { cardinality: { min: 0, max: '*' } },
    trigger: { cardinality: { min: 0, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'item' },
    { kind: 'contains', parent: 'item', child: 'trigger' },
  ],
});
export const ACCORDION_ITEM_FAMILY = createAnatomyFamily('base-accordion-item', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    heading: { cardinality: { min: 1, max: 1 } },
    trigger: { cardinality: { min: 1, max: 1 } },
    content: { cardinality: { min: 1, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'heading' },
    { kind: 'contains', parent: 'heading', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
  ],
});
export type AccordionContext = {
  openItems: string[];
  disabled: boolean;
  allowEmpty: boolean;
  orientation: 'vertical' | 'horizontal';
  direction: 'ltr' | 'rtl';
  loop: boolean;
  validationVersion: number;
};
export type AccordionItemContext = {
  value: string;
  open: boolean;
  disabled: boolean;
  collapseBlocked: boolean;
};
export const ACCORDION_CONTEXT = createContextKey<AccordionContext>('base-accordion');
export const ACCORDION_ITEM_CONTEXT = createContextKey<AccordionItemContext>('base-accordion-item');
export function requestAccordionOpen(
  run: RunHandle<any>,
  value: string,
  open: boolean,
  reason: AccordionReason
): boolean {
  const request = run.anatomy.partsOf(ACCORDION_FAMILY, 'root')[0]?.getExpose('requestOpen');
  return typeof request === 'function' ? request(value, open, reason) : false;
}
export function notifyAccordionItemsChanged(run: RunHandle<any>): void {
  run.context.update(ACCORDION_CONTEXT, (previous) => ({
    ...previous,
    validationVersion: previous.validationVersion + 1,
  }));
}
export function readAccordionState<T>(part: AnatomyPartView, key: string): T | undefined {
  const state = part.getExpose(key) as { get?(): T } | null;
  return state?.get?.();
}
export function accordionItems(run: RunHandle<any>) {
  const items = run.anatomy.order
    .partsOf(ACCORDION_FAMILY, 'item')
    .map((part) => {
      const readMeta = part.getExpose('__collectionItem');
      const meta = typeof readMeta === 'function' ? readMeta() : null;
      return {
        value: readAccordionState<string>(part, 'value') ?? '',
        // Collection metadata owns the local item policy. An old Root-disabled
        // projection cannot veto the owner's same-callback re-enable request.
        disabled:
          typeof meta?.disabled === 'boolean'
            ? meta.disabled
            : (readAccordionState<boolean>(part, 'disabled') ?? false),
      };
    })
    .filter((item) => !!item.value);
  const values = new Set<string>();
  for (const item of items) {
    if (values.has(item.value))
      throw Object.assign(new Error('Accordion Item values must be unique within a Root.'), {
        code: 'ACCORDION_DUPLICATE_VALUE',
      });
    values.add(item.value);
  }
  return items;
}
export function rejectAccordionDuplicatePart(
  run: RunHandle<any>,
  role: 'heading' | 'trigger' | 'content'
) {
  if (run.anatomy.partsOf(ACCORDION_ITEM_FAMILY, role).length > 1)
    throw Object.assign(new Error(`Accordion Item permits one ${role}.`), {
      code: 'ACCORDION_DUPLICATE_PART',
    });
}
