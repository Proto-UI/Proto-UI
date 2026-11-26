import { expect, it } from 'vitest';
import { PUI_VIEW_DETACHED_ATTR } from '@proto.ui/adapter-base';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createVueAdapter } from '../src/adapt';
import { flushVue, VueAny } from './utils/vue';

const families = [
  ['base', base],
  ['shadcn', shadcn],
] as const;

async function withMonthSelect(
  projection: (typeof families)[number][1],
  run: (fixture: {
    trigger: HTMLElement;
    option: (value: string) => HTMLElement;
    itemOwner: (value: string) => object | undefined;
    outside: HTMLButtonElement;
    selected: () => string;
  }) => Promise<void>
) {
  const adapter = createVueAdapter(VueAny);
  const Root = adapter(projection.selectRoot);
  const Trigger = adapter(projection.selectTrigger);
  const Value = adapter(projection.selectValue);
  const Content = adapter(projection.selectContent);
  const Surface = adapter(projection.selectSurface);
  const Viewport = adapter(projection.selectViewport);
  const Item = adapter(projection.selectItem);
  const ItemText = adapter(projection.selectItemText);
  const value = VueAny.ref('10');
  const owners = new Map<string, object>();
  const host = document.createElement('div');
  const outside = document.createElement('button');
  outside.textContent = 'Outside the Select';
  document.body.append(host, outside);
  const app = VueAny.createApp({
    setup() {
      return () =>
        VueAny.h(
          Root,
          {
            value: value.value,
            onValueChange: (detail: unknown) => {
              if (
                detail &&
                typeof detail === 'object' &&
                'value' in detail &&
                typeof detail.value === 'string'
              )
                value.value = detail.value;
            },
          },
          () => [
            VueAny.h(
              Trigger,
              {
                accessibleLabel: 'Month',
                'data-demo-ref': 'entry-month-trigger',
              },
              () => VueAny.h(Value)
            ),
            VueAny.h(Content, { position: 'popper' }, () =>
              VueAny.h(Surface, null, () =>
                VueAny.h(Viewport, null, () =>
                  Array.from({ length: 12 }, (_, index) => {
                    const month = String(index + 1);
                    return VueAny.h(
                      Item,
                      {
                        key: month,
                        value: month,
                        textValue: `${month}月`,
                        'data-demo-ref': `entry-month-${month}`,
                        ref: (owner: object | null) => {
                          if (owner) owners.set(month, owner);
                          else owners.delete(month);
                        },
                      },
                      () => VueAny.h(ItemText, null, () => `${month}月`)
                    );
                  })
                )
              )
            ),
          ]
        );
    },
  });
  const option = (month: string) => {
    const element = document.querySelector<HTMLElement>(`[data-demo-ref="entry-month-${month}"]`);
    if (!element) throw new Error(`Missing month option ${month}`);
    return element;
  };
  try {
    app.mount(host);
    await expect.poll(() => host.querySelector('[role="combobox"]')?.textContent).toBe('10月');
    // A detached view intentionally withdraws its ARIA projection. Its DOM
    // and logical Item owner remain present for the first opening.
    await expect
      .poll(() => document.querySelector('[data-demo-ref="entry-month-10"]')?.isConnected)
      .toBe(true);
    await expect.poll(() => owners.has('10')).toBe(true);
    const trigger = host.querySelector<HTMLElement>('[data-demo-ref="entry-month-trigger"]');
    if (!trigger) throw new Error('Missing month trigger');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await run({
      trigger,
      option,
      itemOwner: (month) => owners.get(month),
      outside,
      selected: () => value.value,
    });
  } finally {
    app.unmount();
    host.remove();
    outside.remove();
  }
}

const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

it.each(families)(
  '%s keeps the retained Item and its Vue owner across a closed-to-open Teleport',
  async (_family, projection) => {
    await withMonthSelect(projection, async ({ trigger, option, itemOwner }) => {
      const retained = option('10');
      const owner = itemOwner('10');
      expect(owner).toBeDefined();
      expect(retained.closest(`[${PUI_VIEW_DETACHED_ATTR}]`)).not.toBeNull();
      trigger.focus();
      press(trigger, 'ArrowDown');
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
      await expect.poll(() => option('10').closest(`[${PUI_VIEW_DETACHED_ATTR}]`)).toBeNull();
      await expect.poll(() => option('10').getAttribute('aria-selected')).toBe('true');
      await flushVue();
      expect(option('10') === retained).toBe(true);
      expect(itemOwner('10') === owner).toBe(true);
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(12);
    });
  }
);

it.each(families)(
  '%s delivers keyboard entry to the selected month and retires it on close',
  async (_family, projection) => {
    await withMonthSelect(projection, async ({ trigger, option, outside, selected }) => {
      trigger.focus();
      press(trigger, 'ArrowDown');
      await expect.poll(() => option('10').getAttribute('aria-selected')).toBe('true');
      // This is the same selected-item obligation and 1,000 ms budget as the
      // real four-runtime Calendar caption journey; no replacement focus call.
      await expect
        .poll(() => document.activeElement === option('10'), { timeout: 1_000 })
        .toBe(true);
      press(option('10'), 'ArrowDown');
      await expect
        .poll(() => document.activeElement === option('11'), { timeout: 1_000 })
        .toBe(true);
      press(option('11'), 'Enter');
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      await expect.poll(() => document.activeElement === trigger, { timeout: 1_000 }).toBe(true);
      await expect.poll(selected).toBe('11');
      await expect.poll(() => trigger.textContent).toBe('11月');
      outside.focus();
      await flushVue();
      expect(document.activeElement).toBe(outside);
      // Semantic close precedes transition-driven view retirement.
      await expect
        .poll(() => option('11').closest(`[${PUI_VIEW_DETACHED_ATTR}]`), { timeout: 1_000 })
        .not.toBeNull();

      trigger.focus();
      press(trigger, 'ArrowDown');
      await expect
        .poll(() => document.activeElement === option('11'), { timeout: 1_000 })
        .toBe(true);
      press(option('11'), 'Escape');
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      await expect.poll(() => document.activeElement === trigger, { timeout: 1_000 }).toBe(true);
      outside.focus();
      await flushVue();
      expect(document.activeElement).toBe(outside);
    });
  }
);
