import * as library0 from '@proto.ui/prototypes-base/calendar';
import * as library1 from '@proto.ui/prototypes-base/select';
import * as library2 from '@proto.ui/prototypes-shadcn/calendar';
import * as library3 from '@proto.ui/prototypes-shadcn/select';
import * as library4 from '@proto.ui/prototypes-brutalist/calendar';
import * as library5 from '@proto.ui/prototypes-brutalist/select';
import * as library6 from '@proto.ui/prototypes-bootstrap-2-3-2/calendar';
import * as library7 from '@proto.ui/prototypes-bootstrap-2-3-2/select';
import * as library8 from '@proto.ui/prototypes-liquid-glass/calendar';
import * as library9 from '@proto.ui/prototypes-liquid-glass/select';
import * as library10 from '@proto.ui/prototypes-lucide/icons/chevron-left';
import * as library11 from '@proto.ui/prototypes-lucide/icons/chevron-right';
import * as library12 from '@proto.ui/prototypes-lucide/icons/chevron-down';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import {
  createCalendarDemo,
  setupCalendarCaptionDemo,
} from '../../content/docs/zh-cn/calendar-demo.shared';
import type { DemoRuntimeApi } from './demo-types';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';

// Replace only CDN acquisition with the installed framework versions. These
// tests exercise actual adapters and prototypes, not browser visual fidelity.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});

for (const module of [
  library0,
  library1,
  library2,
  library3,
  library4,
  library5,
  library6,
  library7,
  library8,
  library9,
  library10,
  library11,
  library12,
]) {
  for (const exported of Object.values(module)) {
    if (exported && typeof exported === 'object' && 'name' in exported && 'setup' in exported) {
      const prototype = exported as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }
  }
}

const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.useRealTimers();
  document.body.replaceChildren();
});
const civilDate = (date: Date) =>
  `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('Real family Calendar caption demos', () => {
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${family}/${runtime}: synchronizes actual controlled Selects and Calendar in both directions`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const demo = createCalendarDemo(family);
        let api!: DemoRuntimeApi;
        const view = await renderDemo({
          runtime,
          host,
          demo: {
            ...demo,
            setup(context) {
              api = context.api;
              return demo.setup?.(context);
            },
          },
        });
        cleanup.push(() => view.destroy());
        const read = (ref: string, name = 'value') =>
          (api.getExposes(ref)?.[name] as { get(): string }).get();
        const today = civilDate(new Date());
        await vi.waitFor(() => {
          expect(read('calendar', 'month')).toBe(today.slice(0, 7));
          expect(read('month-select')).toBe(String(Number(today.slice(5, 7))));
          expect(read('year-select')).toBe(today.slice(0, 4));
        });
        expect(host.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
        expect(host.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
        expect(host.querySelector('[aria-label="Previous month"]')).not.toBeNull();
        expect(host.querySelector('[aria-label="Next month"]')).not.toBeNull();
        await vi.waitFor(() => {
          expect(
            host.querySelector('[data-demo-ref="month-trigger"]')?.getAttribute('aria-label')
          ).toBe('Month');
          expect(
            host.querySelector('[data-demo-ref="year-trigger"]')?.getAttribute('aria-label')
          ).toBe('Year');
        });
        expect(host.querySelectorAll('select')).toHaveLength(0);

        const nextMonth = today.slice(5, 7) === '03' ? '4' : '3';
        api.call('month-select', 'requestValue', {
          value: nextMonth,
          textValue: nextMonth === '3' ? 'Mar' : 'Apr',
          reason: 'pointer',
        });
        await vi.waitFor(() =>
          expect(read('calendar', 'month')).toBe(`${today.slice(0, 4)}-0${nextMonth}`)
        );
        const nextYear = today.slice(0, 4) === '2030' ? '2031' : '2030';
        api.call('year-select', 'requestValue', {
          value: nextYear,
          textValue: nextYear,
          reason: 'keyboard',
        });
        await vi.waitFor(() => {
          expect(read('calendar', 'month')).toBe(`${nextYear}-0${nextMonth}`);
          expect(read('year-select')).toBe(nextYear);
        });

        api.call('calendar', 'requestValue', '2028-11-09');
        await vi.waitFor(() => {
          expect(read('calendar')).toBe('2028-11-09');
          expect(read('calendar', 'month')).toBe('2028-11');
          expect(read('month-select')).toBe('11');
          expect(read('year-select')).toBe('2028');
        });
        host
          .querySelector('[data-demo-ref="month-trigger"]')
          ?.dispatchEvent(
            new CustomEvent('valueChange', { bubbles: true, detail: { value: '7' } })
          );
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        expect(read('calendar', 'month')).toBe('2028-11');

        // The demo's bounded options do not constrain Calendar navigation.
        // SelectValue's public fallback displays the canonical unmatched year.
        api.call('calendar', 'requestMonth', '1800-01');
        await vi.waitFor(() => {
          expect(read('calendar', 'month')).toBe('1800-01');
          expect(read('year-select')).toBe('1800');
          expect(host.querySelector('[data-demo-ref="year-trigger"]')?.textContent).toContain(
            '1800'
          );
        });
      }, 20_000);
    }
  }
});

it('supplies local today at setup, refreshes at midnight, preserves controlled records, and cancels its clock', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2033, 3, 5, 23, 59, 59));
  const host = document.createElement('div');
  const refs = Object.fromEntries(
    ['calendar', 'month-select', 'year-select', 'month-trigger', 'year-trigger'].map((ref) => {
      const node = document.createElement('div');
      host.append(node);
      return [ref, node];
    })
  );
  const listeners = new Set<() => void>();
  let month = '1970-01';
  const records = new Map<string, Record<string, unknown>>();
  const api: DemoRuntimeApi = {
    call: vi.fn(),
    getExposes: () => ({
      month: {
        get: () => month,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      disabled: { get: () => false, subscribe: () => () => {} },
    }),
    setProps(ref, next) {
      records.set(ref, { ...next });
      if (ref === 'calendar' && month !== next.month) {
        month = next.month as string;
        for (const listener of listeners) listener();
      }
    },
  };
  const dispose = setupCalendarCaptionDemo({ host, refs, api });
  cleanup.push(dispose);
  await Promise.resolve();
  expect(records.get('calendar')).toMatchObject({
    today: '2033-04-05',
    month: '2033-04',
    value: '2033-04-05',
    locale: 'en-US',
  });
  expect(records.get('calendar')?.onValueChange).toEqual(expect.any(Function));
  expect(records.get('calendar')?.onMonthChange).toEqual(expect.any(Function));
  expect(records.get('month-select')).toMatchObject({
    value: '4',
    disabled: false,
    onValueChange: expect.any(Function),
  });
  expect(records.get('year-select')).toMatchObject({
    value: '2033',
    disabled: false,
    onValueChange: expect.any(Function),
  });
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1_000);
  expect(records.get('calendar')).toMatchObject({
    today: '2033-04-06',
    month: '2033-04',
    value: '2033-04-05',
    onValueChange: expect.any(Function),
    onMonthChange: expect.any(Function),
  });
  expect(vi.getTimerCount()).toBe(1);
  // A suspended page also catches up from its actual host clock on resumption.
  vi.setSystemTime(new Date(2033, 3, 8, 10));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(records.get('calendar')?.today).toBe('2033-04-08');
  dispose();
  expect(vi.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
  (records.get('month-select')?.onValueChange as (detail: unknown) => void)({ value: '8' });
  expect(api.call).not.toHaveBeenCalled();
});

it('opens the actual Shadcn year menu from the keyboard, selects a year and restores trigger focus', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const demo = createCalendarDemo('shadcn');
  let api!: DemoRuntimeApi;
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      ...demo,
      setup(context) {
        api = context.api;
        return demo.setup?.(context);
      },
    },
  });
  cleanup.push(() => view.destroy());
  const year = String(new Date().getFullYear());
  const nextYear = String(Number(year) + 1);
  const readMonth = () => (api.getExposes('calendar')?.month as { get(): string }).get();
  await vi.waitFor(() => expect(readMonth().slice(0, 4)).toBe(year));
  const trigger = host.querySelector<HTMLElement>('[data-demo-ref="year-trigger"]')!;
  api.call('year-trigger', 'focusSelf', { reason: 'keyboard' });
  trigger.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => {
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    expect(document.activeElement?.textContent?.trim()).toBe(year);
  });
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe(nextYear));
  const option = document.activeElement!;
  option.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  option.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => {
    expect(readMonth().slice(0, 4)).toBe(nextYear);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });
});
