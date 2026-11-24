import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { calendarRoot, calendarDay } from '../src/calendar';
import { datePickerRoot, datePickerDay, datePickerValue } from '../src/date-picker';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

for (const prototype of [calendarRoot, calendarDay, datePickerRoot, datePickerDay, datePickerValue])
  AdaptToWebComponent(prototype);
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

async function fixture(kind: 'calendar' | 'date-picker') {
  const root = document.createElement(`base-${kind}-root`) as any;
  setElementProps(root, { value: '2026-10-01', month: '2026-10', open: true });
  const days = ['2026-10-03', '2026-10-04', '2026-10-05'].map((date) => {
    const day = document.createElement(`base-${kind}-day`) as any;
    setElementProps(day, { date });
    root.append(day);
    return day;
  });
  const display = kind === 'date-picker' ? document.createElement('base-date-picker-value') : null;
  if (display) root.append(display);
  document.body.append(root);
  await flush();
  return { root, days, display, api: root.getExposes() };
}

describe.each(['calendar', 'date-picker'] as const)('%s owner replacement', (kind) => {
  it.each(['month', 'disabled'] as const)(
    'keeps the newer policy and direction after a synchronous %s observer',
    async (observed) => {
      const f = await fixture(kind);
      let replaced = false;
      const off = f.api[observed].subscribe((event: any) => {
        if (event.type !== 'next' || replaced) return;
        replaced = true;
        setElementProps(f.root, {
          mode: 'range',
          range: { from: '2026-10-03', to: '2026-10-05' },
          month: '2026-10',
          disabled: false,
          direction: 'rtl',
          a11yLabel: 'Current range',
          open: true,
        });
      });
      try {
        setElementProps(f.root, {
          month: observed === 'month' ? '2026-11' : '2026-10',
          disabled: true,
          direction: 'ltr',
          a11yLabel: 'Interrupted snapshot',
          open: true,
        });
        await flush();
        expect(replaced).toBe(true);
        expect(f.api.month.get()).toBe('2026-10');
        expect(f.api.disabled.get()).toBe(false);
        expect(f.api.direction.get()).toBe('rtl');
        expect(f.root.getAttribute('aria-label')).toBe('Current range');
        expect(f.api.getRange()).toEqual({ from: '2026-10-03', to: '2026-10-05' });
        expect(f.days[1].getExposes().rangeMiddle.get()).toBe(true);
        if (kind === 'date-picker') expect(f.api.open.get()).toBe(true);
      } finally {
        off();
      }
    }
  );
  it.each(['multiple', 'range'] as const)(
    'retains the new %s selection when a value observer replaces the controlled mode',
    async (mode) => {
      // C-CALENDAR-SELECTION-0001-MODES / CONTROLLED: the supplied prop for
      // the new mode owns its selection; the interrupted old snapshot cannot erase it.
      const f = await fixture(kind);
      let replaced = false;
      const off = f.api.value.subscribe((event: any) => {
        if (event.type !== 'next' || replaced) return;
        replaced = true;
        setElementProps(f.root, {
          mode,
          month: '2026-10',
          open: true,
          ...(mode === 'multiple'
            ? { values: ['2026-10-03', '2026-10-05'] }
            : { range: { from: '2026-10-03', to: '2026-10-05' } }),
        });
      });
      try {
        setElementProps(f.root, { value: '2026-10-02', month: '2026-10', open: true });
        await flush();
        expect(replaced).toBe(true);
        expect(f.api.mode.get()).toBe(mode);
        if (mode === 'multiple') {
          expect(f.api.getValues()).toEqual(['2026-10-03', '2026-10-05']);
          expect(f.api.selectedCount.get()).toBe(2);
          expect(f.days.map((day) => day.getExposes().selected.get())).toEqual([true, false, true]);
        } else {
          expect(f.api.getRange()).toEqual({ from: '2026-10-03', to: '2026-10-05' });
          expect(f.api.rangeComplete.get()).toBe(true);
          expect(f.days.map((day) => day.getExposes().selected.get())).toEqual([true, true, true]);
          expect(f.days[1].getExposes().rangeMiddle.get()).toBe(true);
        }
        if (kind === 'date-picker') {
          expect(f.api.open.get()).toBe(true);
          expect(f.display?.textContent).toBe(
            mode === 'multiple' ? '2026-10-03, 2026-10-05' : '2026-10-03 – 2026-10-05'
          );
        }
        // Retirement of one old sync must leave later updates on this same
        // connected owner usable, including a new incomplete range.
        setElementProps(f.root, {
          mode,
          month: '2026-10',
          open: true,
          ...(mode === 'multiple' ? { values: ['2026-10-04'] } : { range: { from: '2026-10-04' } }),
        });
        await flush();
        expect(f.root.isConnected).toBe(true);
        expect(f.api.selectedCount.get()).toBe(1);
        expect(f.days.map((day) => day.getExposes().selected.get())).toEqual([false, true, false]);
        if (mode === 'multiple') expect(f.api.getValues()).toEqual(['2026-10-04']);
        else {
          expect(f.api.getRange()).toEqual({ from: '2026-10-04' });
          expect(f.api.rangeComplete.get()).toBe(false);
          expect(f.days[1].getExposes().rangePending.get()).toBe(true);
        }
        if (kind === 'date-picker') {
          expect(f.api.open.get()).toBe(true);
          expect(f.display?.textContent).toBe(mode === 'multiple' ? '2026-10-04' : '2026-10-04 …');
        }
      } finally {
        off();
      }
    }
  );
});

it.each(['unmount', 'dispose'] as const)(
  'Calendar stops the interrupted Props sync after a public value observer requests %s',
  async (operation) => {
    // Use the public Runtime boundary so retirement is synchronous at the
    // observer; a DOM disconnect may defer its teardown until a microtask.
    const target = new EventTarget();
    let props: Record<string, unknown> = {
      value: '2026-10-01',
      month: '2026-10',
      disabled: false,
      direction: 'ltr',
    };
    let api: any;
    const session = createRuntimeSession(calendarRoot, {
      prototypeName: calendarRoot.name,
      getRawProps: () => props,
      schedule: (task) => task(),
      commit: (_children, state) => state?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, () => null],
          [ANATOMY_GET_PROTO_CAP, () => calendarRoot],
          [ANATOMY_ROOT_TARGET_CAP, (instance: EventTarget) => instance],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (exposes: unknown) => {
              api = exposes;
            },
          ],
        ]);
      },
    });
    await session.mount();
    const laterWrites: string[] = [];
    let retired = false;
    let retirement: Promise<void> | undefined;
    const off = [
      ...['month', 'disabled', 'direction'].map((key) =>
        api[key].subscribe((event: any) => {
          if (event.type === 'next') laterWrites.push(key);
        })
      ),
      api.value.subscribe((event: any) => {
        if (event.type !== 'next' || retired) return;
        retired = true;
        retirement = session[operation]();
      }),
    ];
    try {
      props = { value: '2026-10-02', month: '2026-11', disabled: true, direction: 'rtl' };
      expect(() => session.controller.applyRawProps(props)).not.toThrow();
      await retirement;
      expect(retired).toBe(true);
      expect(laterWrites).toEqual([]);
    } finally {
      for (const unsubscribe of off) unsubscribe();
      await retirement;
      await session.dispose();
    }
  }
);
