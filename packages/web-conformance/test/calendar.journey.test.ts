import * as React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { expect, it, vi } from 'vitest';
import { Vue2Any } from '../../adapters/vue2/test/utils/vue2';
import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { registerPrototype } from '../../../apps/www/src/components/PrototypePreviewer/registry';
import type {
  DemoRuntimeApi,
  DemoSpec,
} from '../../../apps/www/src/components/PrototypePreviewer/demo-types';
import * as calendar from '../../prototypes/base/src/calendar';
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
  calendar.calendarCaption,
  calendar.calendarGrid,
  calendar.calendarHeading,
  calendar.calendarWeekdays,
  calendar.calendarWeekday,
  calendar.calendarRow,
  calendar.calendarDay,
  calendar.calendarNext,
  calendar.calendarPrevious,
])
  registerPrototype(proto.name, proto);
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
    await Vue.nextTick();
    await Vue2Any.nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};
it.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s preserves controlled month ownership, disabled navigation, and date semantics on the actual host',
  async (runtime) => {
    const host = document.createElement('div');
    document.body.append(host);
    let api!: DemoRuntimeApi;
    let accept = false;
    let month = '2026-10';
    let disabled = false;
    const requests: string[] = [];
    const rootProps = () => ({
      month,
      value: '2026-10-31',
      today: '2026-10-31',
      locale: 'en-US',
      weekStartsOn: 1,
      disabled,
      onMonthChange,
    });
    function onMonthChange(detail: unknown) {
      if (!detail || typeof detail !== 'object' || typeof (detail as any).month !== 'string')
        return;
      requests.push((detail as any).month);
      if (accept) {
        month = (detail as any).month;
        api.setProps('root', rootProps());
      }
    }
    const demo: DemoSpec = {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'base-calendar-root',
        ref: 'root',
        props: { month, value: '2026-10-31', today: '2026-10-31', weekStartsOn: 1 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-calendar-caption',
            children: [
              { kind: 'proto', prototypeId: 'base-calendar-previous', ref: 'previous' },
              { kind: 'proto', prototypeId: 'base-calendar-heading', ref: 'heading' },
              { kind: 'proto', prototypeId: 'base-calendar-next', ref: 'next' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-calendar-grid',
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-calendar-weekdays',
                children: Array.from({ length: 7 }, (_, offset) => ({
                  kind: 'proto' as const,
                  prototypeId: 'base-calendar-weekday',
                  ref: `weekday-${offset}`,
                  props: { offset },
                })),
              },
              ...Array.from({ length: 6 }, (_, row) => ({
                kind: 'proto' as const,
                prototypeId: 'base-calendar-row',
                children: Array.from({ length: 7 }, (_, col) => ({
                  kind: 'proto' as const,
                  prototypeId: 'base-calendar-day',
                  ref: `day-${row * 7 + col}`,
                  props: { offset: row * 7 + col },
                })),
              })),
            ],
          },
        ],
      },
      setup(ctx) {
        api = ctx.api;
        api.setProps('root', rootProps());
        const listener = (e: Event) => {
          if (
            e instanceof CustomEvent &&
            (e.target as HTMLElement)?.getAttribute('data-demo-ref') === 'root'
          )
            onMonthChange(e.detail);
        };
        host.addEventListener('monthChange', listener);
        return () => host.removeEventListener('monthChange', listener);
      },
    };
    const session = await renderDemo({ runtime, demo, host });
    const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
    const byDate = (date: string) =>
      Array.from({ length: 42 }, (_, n) => `day-${n}`).find(
        (name) => (api.getExposes(name)?.date as any)?.get() === date
      )!;
    const tabDates = () =>
      Array.from({ length: 42 }, (_, n) => `day-${n}`)
        .filter((name) => ref(name).tabIndex === 0)
        .map((name) => (api.getExposes(name)?.date as any).get());
    try {
      await settle();
      expect(ref('weekday-0').textContent).toBe('Mo');
      expect(ref('weekday-0').getAttribute('aria-label')).toBe('Monday');
      expect(ref('heading').textContent).toBe('October 2026');
      const october = byDate('2026-10-31');
      expect(ref(october).getAttribute('aria-current')).toBe('date');
      expect(ref(october).getAttribute('aria-label')).toBe('Saturday, October 31, 2026');
      api.call(october, 'focusSelf', { reason: 'keyboard' });
      await settle();
      const pageDown = () =>
        ref(byDate('2026-10-31')).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
        );
      pageDown();
      await settle();
      expect(requests).toEqual(['2026-11']);
      expect((api.getExposes('root')?.month as any).get()).toBe('2026-10');
      expect(tabDates()).toEqual(['2026-10-31']);
      expect(document.activeElement).toBe(ref(october));
      accept = true;
      pageDown();
      await settle();
      expect((api.getExposes('root')?.month as any).get()).toBe('2026-11');
      expect(tabDates()).toEqual(['2026-11-30']);
      expect(document.activeElement).toBe(ref(byDate('2026-11-30')));
      expect(ref('heading').textContent).toBe('November 2026');
      disabled = true;
      api.setProps('root', rootProps());
      await settle();
      for (const name of ['previous', 'next']) {
        expect((api.getExposes(name)?.disabled as any).get()).toBe(true);
        expect(ref(name).getAttribute('aria-disabled')).toBe('true');
        expect(ref(name).tabIndex).toBe(-1);
      }
      expect(tabDates()).toEqual([]);
      disabled = false;
      api.setProps('root', rootProps());
      await settle();
      expect(tabDates()).toEqual(['2026-11-30']);
    } finally {
      await session.destroy();
      host.remove();
    }
  }
);
