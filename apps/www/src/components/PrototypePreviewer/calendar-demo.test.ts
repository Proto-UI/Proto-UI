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
import type { DemoNode, DemoRuntimeApi } from './demo-types';
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

const visibleGridCells = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="gridcell"]')).filter(
    (cell) => !cell.closest('[hidden], [aria-hidden="true"]')
  );
const visibleWeekRows = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="row"]')).filter(
    (row) =>
      row.querySelector('[role="gridcell"]') && !row.closest('[hidden], [aria-hidden="true"]')
  );
const monthCellCount = (year: number, month: number) =>
  Math.ceil((new Date(year, month, 1).getDay() + new Date(year, month + 1, 0).getDate()) / 7) * 7;
const protoNodes = (node: DemoNode): Extract<DemoNode, { kind: 'proto' }>[] => [
  ...(node.kind === 'proto' ? [node] : []),
  ...('children' in node
    ? (node.children ?? []).flatMap((child) => (typeof child === 'string' ? [] : protoNodes(child)))
    : []),
];

it('formats caption month options with explicit or default host Intl locale independently of weekdays', () => {
  for (const captionLocale of ['zh-CN', 'en-US', undefined]) {
    const demo = createCalendarDemo('shadcn', { captionLocale });
    const nodes = protoNodes(demo.root);
    const month = nodes.find((node) => node.ref === 'month-select')!;
    const items = protoNodes(month).filter((node) => node.prototypeId === 'shadcn-select-item');
    const expected = Array.from({ length: 12 }, (_, index) =>
      new Date(Date.UTC(2000, index, 1)).toLocaleString(captionLocale, {
        month: 'short',
        timeZone: 'UTC',
      })
    );
    expect(items.map((item) => item.children?.[0])).toEqual(expected);
    expect(items.map((item) => item.props?.textValue)).toEqual(expected);
    expect(items.map((item) => item.props?.value)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1))
    );
    expect(nodes.find((node) => node.ref === 'calendar')?.props).toMatchObject({
      locale: 'en-US',
      fixedWeeks: false,
    });
    expect(
      nodes
        .filter((node) => node.prototypeId === 'shadcn-calendar-row')
        .map((node) => node.props?.index)
    ).toEqual([0, 1, 2, 3, 4, 5]);
  }
});

it('preserves the full Shadcn reference year range and identifies the other families as app-defined samples', () => {
  const year = new Date().getFullYear();
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    const demo = createCalendarDemo(family);
    const yearSelect = protoNodes(demo.root).find((node) => node.ref === 'year-select')!;
    const values = protoNodes(yearSelect)
      .filter((node) => node.prototypeId === `${family}-select-item`)
      .map((node) => node.props?.value);
    expect(values).toHaveLength(family === 'shadcn' ? 101 : 21);
    expect(values[0]).toBe(String(year - (family === 'shadcn' ? 100 : 10)));
    expect(values.at(-1)).toBe(String(year + (family === 'shadcn' ? 0 : 10)));
  }
});

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
        const current = new Date();
        const expectedCells = monthCellCount(current.getFullYear(), current.getMonth());
        expect(visibleGridCells(host)).toHaveLength(expectedCells);
        expect(visibleWeekRows(host)).toHaveLength(expectedCells / 7);
        expect(host.querySelector('[aria-label="Previous month"]')).not.toBeNull();
        expect(host.querySelector('[aria-label="Next month"]')).not.toBeNull();
        await vi.waitFor(() => {
          expect(host.querySelector('[data-demo-ref="month-trigger"]')?.textContent).toMatch(
            /^Month\s+\S/
          );
          expect(host.querySelector('[data-demo-ref="year-trigger"]')?.textContent?.trim()).toBe(
            `Year ${today.slice(0, 4)}`
          );
        });
        // Content is a naming input, not proof of the real browser's computed
        // combobox name. That accessibility-tree check remains a separate gate.
        expect(host.querySelectorAll('select')).toHaveLength(0);

        // The semantic hidden contract removes unused capacity from both the
        // grid and tab order; it is not a CSS-only last-row concealment.
        for (const [month, count] of [
          ['2026-10', 35],
          ['2026-11', 35],
          ['2026-02', 28],
          ['2026-08', 42],
        ] as const) {
          api.call('calendar', 'requestMonth', month);
          await vi.waitFor(() => {
            expect(read('calendar', 'month')).toBe(month);
            expect(visibleGridCells(host)).toHaveLength(count);
            expect(visibleWeekRows(host)).toHaveLength(count / 7);
            for (const cell of host.querySelectorAll<HTMLElement>('[role="gridcell"]')) {
              if (cell.closest('[hidden], [aria-hidden="true"]')) expect(cell.tabIndex).toBe(-1);
            }
          });
        }
        api.call('calendar', 'requestMonth', today.slice(0, 7));
        await vi.waitFor(() => expect(read('calendar', 'month')).toBe(today.slice(0, 7)));

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
          expect(host.querySelector('[data-demo-ref="year-trigger"]')?.textContent?.trim()).toBe(
            'Year 1800'
          );
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
  const monthAttributes = vi.spyOn(refs['month-trigger'], 'setAttribute');
  const yearAttributes = vi.spyOn(refs['year-trigger'], 'setAttribute');
  const dispose = setupCalendarCaptionDemo({ host, refs, api });
  cleanup.push(dispose);
  await Promise.resolve();
  expect(records.get('calendar')).toMatchObject({
    today: '2033-04-05',
    month: '2033-04',
    value: '2033-04-05',
    locale: 'en-US',
    fixedWeeks: false,
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
  expect(monthAttributes).not.toHaveBeenCalledWith('aria-label', expect.anything());
  expect(yearAttributes).not.toHaveBeenCalledWith('aria-label', expect.anything());
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

it('mounts all 101 Shadcn year options, opens from the keyboard, selects a year and restores trigger focus', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const demo = createCalendarDemo('shadcn', { captionLocale: 'zh-CN' });
  const started = performance.now();
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
  const previousYear = String(Number(year) - 1);
  const readMonth = () => (api.getExposes('calendar')?.month as { get(): string }).get();
  await vi.waitFor(() => expect(readMonth().slice(0, 4)).toBe(year));
  const mountMs = performance.now() - started;
  const yearOptions = Array.from(
    host.querySelectorAll<HTMLElement>('[data-demo-ref="year-select"] [role="option"]')
  );
  expect(yearOptions).toHaveLength(101);
  expect(yearOptions[0].textContent?.trim()).toBe(String(Number(year) - 100));
  expect(yearOptions.at(-1)?.textContent?.trim()).toBe(year);
  if (Number(year) >= 2007 && Number(year) <= 2107)
    expect(yearOptions.some((option) => option.textContent?.trim() === '2007')).toBe(true);
  expect(host.querySelector('[data-demo-ref="month-trigger"]')?.textContent?.trim()).toBe(
    `Month ${new Date().getMonth() + 1}月`
  );
  expect(
    Array.from(host.querySelectorAll('[role="columnheader"]')).map((node) =>
      node.textContent?.trim()
    )
  ).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
  const trigger = host.querySelector<HTMLElement>('[data-demo-ref="year-trigger"]')!;
  const openStarted = performance.now();
  api.call('year-trigger', 'focusSelf', { reason: 'keyboard' });
  trigger.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => {
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    expect(document.activeElement?.textContent?.trim()).toBe(year);
  });
  const openMs = performance.now() - openStarted;
  const selectionStarted = performance.now();
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe(previousYear));
  const option = document.activeElement!;
  option.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  option.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
  await vi.waitFor(() => {
    expect(readMonth().slice(0, 4)).toBe(previousYear);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });
  // A measured adapter/Happy DOM probe, not a native-browser latency budget.
  // Preserve the full collection even when these timings expose a gap.
  console.info(
    '[calendar-caption 101-item WC]',
    JSON.stringify({
      mountMs: Math.round(mountMs),
      openMs: Math.round(openMs),
      selectAndRestoreMs: Math.round(performance.now() - selectionStarted),
    })
  );
}, 30_000);
