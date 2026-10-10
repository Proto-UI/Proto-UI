import { afterEach, expect, it } from 'vitest';
import { definePrototype, type DefHandle } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asCalendarRoot, asCalendarDay, asCalendarPrevious } from '../src/calendar';
import {
  asDatePickerRoot,
  asDatePickerDay,
  asDatePickerContent,
  asDatePickerValue,
} from '../src/date-picker';
const hooks = {
  calendarRoot: asCalendarRoot,
  calendarDay: asCalendarDay,
  calendarPrevious: asCalendarPrevious,
  datePickerRoot: asDatePickerRoot,
  datePickerDay: asDatePickerDay,
  datePickerContent: asDatePickerContent,
  datePickerValue: asDatePickerValue,
};
for (const [name, hook] of Object.entries(hooks))
  AdaptToWebComponent(
    definePrototype({
      name: `capture-${name.toLowerCase()}`,
      setup(def: DefHandle<any, any>) {
        const captured = hook();
        def.expose.method('readCapture', () => captured);
        return captured.render;
      },
    })
  );
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
});
const node = (name: keyof typeof hooks, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`capture-${name.toLowerCase()}`) as any;
  setElementProps(el, props);
  return el;
};
it('matches Calendar declared direct capture keys and nested Button handles to real setup artifacts', async () => {
  const root = node('calendarRoot', { defaultValue: '2026-10-10' });
  const day = node('calendarDay', { date: '2026-10-10' });
  const previous = node('calendarPrevious');
  root.append(day, previous);
  roots.push(root);
  document.body.append(root);
  await flush();
  const rootCapture = root.getExposes().readCapture();
  expect(Object.keys(rootCapture.stateHandles).sort()).toEqual([
    'a11yLabel',
    'collectionCount',
    'month',
    'value',
  ]);
  expect(rootCapture.stateHandles.collectionCount.get()).toBe(1);
  expect(rootCapture.stateHandles.value.get()).toBe('2026-10-10');
  const dayCapture = day.getExposes().readCapture();
  for (const name of ['date', 'selected', 'disabled', 'outside', 'focused', 'focusVisible'])
    expect(dayCapture.stateHandles[name]).toBeDefined();
  expect(dayCapture.stateHandles.date.get()).toBe('2026-10-10');
  const navigation = previous.getExposes().readCapture();
  expect(navigation.stateHandles).toBeUndefined();
  expect(navigation.getAsHookHandle('as-button').stateHandles.disabled.get()).toBe(false);
});
it('exposes Date Picker child handles through their real nested capture paths', async () => {
  const root = node('datePickerRoot', { defaultValue: '2026-10-10', defaultOpen: true });
  const day = node('datePickerDay', { date: '2026-10-10' });
  const content = node('datePickerContent', { enterDuration: 0, leaveDuration: 0 });
  const value = node('datePickerValue');
  content.append(day);
  root.append(content, value);
  roots.push(root);
  document.body.append(root);
  await flush();
  const rootCapture = root.getExposes().readCapture();
  expect(rootCapture.stateHandles).toBeUndefined();
  expect(rootCapture.getAsHookHandle('as-calendar-root').stateHandles.value.get()).toBe(
    '2026-10-10'
  );
  expect(
    rootCapture
      .getAsHookHandle('as-popover-root')
      .getAsHookHandle('useOpenState')
      .stateHandles.open.get()
  ).toBe(true);
  const dayCapture = day.getExposes().readCapture();
  expect(dayCapture.stateHandles).toBeUndefined();
  expect(dayCapture.getAsHookHandle('as-calendar-day').stateHandles.date.get()).toBe('2026-10-10');
  const contentCapture = content.getExposes().readCapture();
  expect(contentCapture.stateHandles).toBeUndefined();
  expect(contentCapture.getAsHookHandle('as-popover-content').asTransition.controls).toBeDefined();
  expect(value.getExposes().readCapture().stateHandles.displayValue.get()).toBe('2026-10-10');
});
