import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import {
  asAccordionRoot,
  asAccordionItem,
  asAccordionHeading,
  asAccordionTrigger,
  asAccordionContent,
  type AccordionOpenRequest,
} from '../../../../prototypes/base/src/accordion';
import * as shadcn from '../../../../prototypes/shadcn/src/accordion';
import * as brutalist from '../../../../prototypes/brutalist/src/accordion';
import * as bootstrap from '../../../../prototypes/bootstrap-2-3-2/src/accordion';
import * as liquid from '../../../../prototypes/liquid-glass/src/accordion';
const families = [
  { name: 'base', prototypes: null },
  { name: 'shadcn', prototypes: shadcn },
  { name: 'brutalist', prototypes: brutalist },
  { name: 'bootstrap-2-3-2', prototypes: bootstrap },
  { name: 'liquid-glass', prototypes: liquid },
];
export type AccordionTree = {
  key: string;
  proto: Prototype<any>;
  props: Record<string, unknown>;
  children?: AccordionTree[];
  onOpenChange?: (request: AccordionOpenRequest) => void;
};
export type AccordionMount = {
  host: HTMLElement;
  exposes(key: string): Record<string, any>;
  flush(action?: () => void): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
let counter = 0;
const hooks = {
  root: asAccordionRoot,
  item: asAccordionItem,
  heading: asAccordionHeading,
  trigger: asAccordionTrigger,
  content: asAccordionContent,
};
function recipe(props: Record<string, unknown> = {}, keepMounted = false, family = families[0]) {
  const prefix = `accordion-test-${++counter}`,
    requests: AccordionOpenRequest[] = [];
  const make = (
    role: keyof typeof hooks,
    key: string,
    props: Record<string, unknown> = {},
    children: AccordionTree[] = []
  ): AccordionTree => ({
    key,
    props,
    children,
    proto: definePrototype({
      name: `${key}-${role}`,
      setup(def) {
        const partName = `accordion${role[0].toUpperCase()}${role.slice(1)}`;
        const proto = family.prototypes
          ? (family.prototypes as Record<string, any>)[partName]
          : null;
        const render = proto ? proto.setup(def) : (hooks[role](), null);
        return (r) => [r.el('span', key), render ? render(r) : r.slot()];
      },
    }),
  });
  const items = ['a', 'b', 'c'].map((value) => {
    const trigger = make('trigger', `${prefix}-${value}-trigger`),
      content = make('content', `${prefix}-${value}-content`, { keepMounted, region: true }),
      heading = make('heading', `${prefix}-${value}-heading`, { level: 2 }, [trigger]),
      item = make('item', `${prefix}-${value}-item`, { value }, [heading, content]);
    return { item, heading, trigger, content };
  });
  const root = make(
    'root',
    `${prefix}-root`,
    props,
    items.map((i) => i.item)
  );
  root.onOpenChange = (request) => requests.push(request);
  return { root, items, requests };
}
function el(view: AccordionMount, key: string) {
  const marker = [...view.host.querySelectorAll('span')].find((n) => n.textContent === key);
  return marker?.closest<HTMLElement>('[data-pui-root]') ?? null;
}
async function until(view: AccordionMount, predicate: () => boolean) {
  for (let i = 0; i < 30; i++) {
    await view.flush();
    if (predicate()) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw Error('Accordion adapter did not settle.');
}
export function accordionAdapterConformance(
  name: string,
  mount: (tree: AccordionTree[]) => Promise<AccordionMount>
) {
  for (const family of families)
    describe(`Accordion ${name} ${family.name} contract`, () => {
      it('single selection, heading relationships and repeatable L1 epochs', async () => {
        const f = recipe({ defaultOpenItems: ['c'] }, false, family),
          view = await mount([f.root]);
        try {
          await until(
            view,
            () => el(view, f.items[2].trigger.key)?.getAttribute('aria-expanded') === 'true'
          );
          expect(view.exposes(f.root.key).getOpenItems()).toEqual(['c']);
          expect(f.requests).toEqual([]);
          expect(el(view, f.items[0].heading.key)?.getAttribute('aria-level')).toBe('2');
          expect(el(view, f.items[0].content.key)).toBeNull();
          await view.click(el(view, f.items[0].trigger.key)!);
          await until(view, () => !!el(view, f.items[0].content.key));
          const panel = el(view, f.items[0].content.key)!;
          const id = panel.id;
          expect(el(view, f.items[0].trigger.key)?.getAttribute('aria-controls')).toBe(id);
          expect(panel.getAttribute('aria-labelledby')).toBe(el(view, f.items[0].trigger.key)!.id);
          expect(el(view, f.items[2].content.key)).toBeNull();
          await view.click(el(view, f.items[0].trigger.key)!);
          await until(view, () => el(view, f.items[0].content.key) === null);
          expect(el(view, f.items[0].trigger.key)?.hasAttribute('aria-controls')).toBe(false);
          await view.click(el(view, f.items[0].trigger.key)!);
          await until(view, () => el(view, f.items[0].content.key)?.id === id);
          expect(view.exposes(f.root.key).getOpenItems()).toEqual(['a']);
        } finally {
          await view.unmount();
        }
      });
      it('controlled rejection/acceptance and retained hidden content do not produce phantom events', async () => {
        const f = recipe({ mode: 'multiple', openItems: [] }, true, family),
          view = await mount([f.root]);
        try {
          await until(view, () => !!el(view, f.items[0].content.key));
          await view.click(el(view, f.items[0].trigger.key)!);
          await view.flush();
          expect(view.exposes(f.root.key).getOpenItems()).toEqual([]);
          expect(f.requests).toHaveLength(1);
          await view.flush(() => {
            f.root.props = { mode: 'multiple', openItems: f.requests[0].openItems };
          });
          expect(el(view, f.items[0].trigger.key)?.getAttribute('aria-expanded')).toBe('true');
          expect(f.requests).toHaveLength(1);
          await view.click(el(view, f.items[1].trigger.key)!);
          await view.flush();
          expect(f.requests[1].openItems).toEqual(['a', 'b']);
          expect(view.exposes(f.root.key).getOpenItems()).toEqual(['a']);
          await view.flush(() => {
            f.root.props = { mode: 'multiple', openItems: [] };
          });
          expect(el(view, f.items[0].content.key)?.getAttribute('aria-hidden')).toBe('true');
          expect(el(view, f.items[0].trigger.key)?.getAttribute('aria-controls')).toBe(
            el(view, f.items[0].content.key)!.id
          );
        } finally {
          await view.unmount();
        }
      });
      it('required final header remains tabbable and disabled requests are suppressed', async () => {
        const f = recipe({ allowEmpty: false }, false, family),
          view = await mount([f.root]);
        try {
          await until(view, () => view.exposes(f.root.key).openCount.get() === 1);
          expect(el(view, f.items[0].trigger.key)?.tabIndex).toBe(0);
          expect(el(view, f.items[0].trigger.key)?.getAttribute('aria-disabled')).toBe('true');
          await view.click(el(view, f.items[0].trigger.key)!);
          await view.flush();
          expect(f.requests).toEqual([]);
          await view.flush(() => {
            f.items[1].item.props = { value: 'b', disabled: true };
          });
          expect(el(view, f.items[1].trigger.key)?.tabIndex).toBe(-1);
          await view.click(el(view, f.items[1].trigger.key)!);
          await view.flush();
          expect(f.requests).toEqual([]);
          await view.click(el(view, f.items[2].trigger.key)!);
          await view.flush();
          expect(view.exposes(f.root.key).getOpenItems()).toEqual(['c']);
        } finally {
          await view.unmount();
        }
      });
      it('all headers keep Tab participation; keyboard navigation does not select and RTL reverses horizontal arrows', async () => {
        const f = recipe({ orientation: 'horizontal', direction: 'rtl' }, false, family),
          view = await mount([f.root]);
        try {
          await until(view, () => el(view, f.items[0].trigger.key)?.tabIndex === 0);
          expect(f.items.map((i) => el(view, i.trigger.key)?.tabIndex)).toEqual([0, 0, 0]);
          await view.flush(() => el(view, f.items[0].trigger.key)!.focus());
          await view.flush(() =>
            el(view, f.items[0].trigger.key)!.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
            )
          );
          expect(document.activeElement).toBe(el(view, f.items[1].trigger.key));
          await view.flush(() =>
            el(view, f.items[1].trigger.key)!.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
            )
          );
          expect(document.activeElement).toBe(el(view, f.items[2].trigger.key));
          expect(f.requests).toEqual([]);
        } finally {
          await view.unmount();
        }
      });
    });
}
