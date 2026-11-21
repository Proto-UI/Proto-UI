import * as React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { expect, it, vi } from 'vitest';
import { Vue2Any } from '../../adapters/vue2/test/utils/vue2';
import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../../../apps/www/src/components/PrototypePreviewer/registry';
import type {
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import * as calendar from '../../prototypes/base/src/calendar';
import * as picker from '../../prototypes/base/src/date-picker';

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/react-runtime', () => ({
  loadReact: vi.fn(async () => ({ React, ReactDOM: { createPortal, createRoot, flushSync } })),
}));
vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => Vue),
}));
vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime', async () => {
  const actual = await vi.importActual<
    typeof import('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
  >('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
  return { ...actual, loadVue2: vi.fn(async () => Vue2Any) };
});
for (const proto of [
  calendar.calendarRoot,
  calendar.calendarGrid,
  calendar.calendarRow,
  calendar.calendarDay,
  picker.datePickerRoot,
  picker.datePickerTrigger,
  picker.datePickerContent,
  picker.datePickerDay,
  picker.datePickerValue,
])
  registerPrototype(proto.name, proto);

const settle = async () => {
  for (let index = 0; index < 3; index++) {
    await Vue.nextTick();
    await Vue2Any.nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

it.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s projects controlled range completion and multiple toggles through the actual rendered atoms',
  async (runtime) => {
    const host = document.createElement('div');
    document.body.append(host);
    let api!: DemoRuntimeApi;
    let accept = false;
    let range: calendar.CalendarRange = { from: '2026-10-01' };
    const proposals: calendar.CalendarRange[] = [];
    const rangeProps = () => ({
      mode: 'range',
      range,
      defaultMonth: '2026-10',
      defaultOpen: true,
      onRangeChange,
    });
    function onRangeChange(detail: unknown) {
      if (!detail || typeof detail !== 'object' || !('range' in detail)) return;
      const proposal = (detail as { range: calendar.CalendarRange }).range;
      proposals.push({ ...proposal });
      if (accept) {
        range = { ...proposal };
        api.setProps('range', rangeProps());
      }
    }
    const grid = (mode: 'range' | 'multiple'): DemoNode => ({
      kind: 'proto',
      prototypeId: 'base-calendar-grid',
      ref: `${mode}-grid`,
      children: [
        {
          kind: 'proto',
          prototypeId: 'base-calendar-row',
          children: [1, 2, 3].map((day) => ({
            kind: 'proto' as const,
            prototypeId: mode === 'range' ? 'base-date-picker-day' : 'base-calendar-day',
            ref: `${mode}-day-${day}`,
            props: { date: `2026-10-0${day}` },
          })),
        },
      ],
    });
    const demo: DemoSpec = {
      type: 'demo',
      root: {
        kind: 'box',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-date-picker-root',
            ref: 'range',
            props: { mode: 'range', range, defaultMonth: '2026-10', defaultOpen: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-date-picker-trigger',
                ref: 'range-trigger',
                children: [
                  { kind: 'proto', prototypeId: 'base-date-picker-value', ref: 'range-value' },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'base-date-picker-content',
                ref: 'range-content',
                children: [grid('range')],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-calendar-root',
            ref: 'multiple',
            props: {
              mode: 'multiple',
              defaultValues: ['2026-10-01'],
              maxSelected: 2,
              defaultMonth: '2026-10',
            },
            children: [grid('multiple')],
          },
        ],
      },
      setup(ctx) {
        api = ctx.api;
        api.setProps('range', rangeProps());
      },
    };
    const session = await renderDemo({ runtime, demo, host });
    const ref = (name: string) => document.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
    const state = (name: string, key: string) =>
      (api.getExposes(name)?.[key] as { get(): unknown }).get();
    try {
      await settle();
      expect(ref('range-grid').getAttribute('aria-multiselectable')).toBe('true');
      expect(ref('range-value').textContent).toBe('2026-10-01 …');
      ref('range-day-3').click();
      await settle();
      expect(proposals).toEqual([{ from: '2026-10-01', to: '2026-10-03' }]);
      expect(api.call('range', 'getRange')).toEqual({ from: '2026-10-01' });
      expect(ref('range-day-2').getAttribute('aria-selected')).toBe('false');
      expect(state('range', 'open')).toBe(true);
      accept = true;
      ref('range-day-3').click();
      await settle();
      expect(api.call('range', 'getRange')).toEqual({ from: '2026-10-01', to: '2026-10-03' });
      expect(state('range-day-2', 'rangeMiddle')).toBe(true);
      expect(ref('range-day-2').getAttribute('aria-selected')).toBe('true');
      expect(ref('range-value').textContent).toBe('2026-10-01 – 2026-10-03');
      expect(state('range', 'open')).toBe(false);

      ref('multiple-day-3').click();
      await settle();
      expect(api.call('multiple', 'getValues')).toEqual(['2026-10-01', '2026-10-03']);
      ref('multiple-day-2').click();
      await settle();
      expect(api.call('multiple', 'getValues')).toEqual(['2026-10-01', '2026-10-03']);
      ref('multiple-day-1').click();
      await settle();
      expect(api.call('multiple', 'getValues')).toEqual(['2026-10-03']);
      expect(ref('multiple-day-1').getAttribute('aria-selected')).toBe('false');
      expect(ref('multiple-day-3').getAttribute('aria-selected')).toBe('true');
      api.setProps('multiple', { readOnly: true });
      await settle();
      ref('multiple-day-2').click();
      await settle();
      expect(api.call('multiple', 'getValues')).toEqual(['2026-10-03']);
    } finally {
      await session.destroy();
      host.remove();
    }
  }
);
