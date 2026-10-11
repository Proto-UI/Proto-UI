import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  calendarRoot,
  calendarCaption,
  calendarGrid,
  calendarWeekdays,
  calendarWeekday,
  calendarRow,
  calendarDay,
  calendarHeading,
  calendarPrevious,
  calendarNext,
  calendarDateLabel,
  calendarWeekdayInfo,
} from '../src/calendar';
const parts = {
  root: calendarRoot,
  caption: calendarCaption,
  grid: calendarGrid,
  weekdays: calendarWeekdays,
  weekday: calendarWeekday,
  row: calendarRow,
  day: calendarDay,
  heading: calendarHeading,
  previous: calendarPrevious,
  next: calendarNext,
};
for (const proto of Object.values(parts))
  AdaptToWebComponent(proto, { registerAs: `semantics-${proto.name}` });
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let n = 0; n < 24; n++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (part: keyof typeof parts, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`semantics-${parts[part].name}`) as any;
  setElementProps(el, props);
  return el;
};
async function fixture(props: Record<string, unknown> = {}) {
  const root = node('root', { defaultMonth: '2026-10', ...props });
  const caption = node('caption'),
    previous = node('previous'),
    next = node('next'),
    heading = node('heading');
  caption.append(previous, heading, next);
  const grid = node('grid'),
    weekdays = node('weekdays');
  const headers = Array.from({ length: 7 }, (_, offset) => node('weekday', { offset }));
  weekdays.append(...headers);
  grid.append(weekdays);
  const days = Array.from({ length: 42 }, (_, offset) => node('day', { offset }));
  for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
    const row = node('row');
    row.append(...days.slice(rowIndex * 7, rowIndex * 7 + 7));
    grid.append(row);
  }
  root.append(caption, grid);
  roots.push(root);
  document.body.append(root);
  await flush();
  const byDate = (date: string) => days.find((day) => day.getExposes().date.get() === date);
  return { root, caption, grid, weekdays, headers, heading, previous, next, days, byDate };
}
it('labels a real seven-column weekday row, tracks locale/weekStartsOn, and names whole dates', async () => {
  const f = await fixture({ weekStartsOn: 1, today: '2026-10-10' });
  expect(f.weekdays.getAttribute('role')).toBe('row');
  expect(f.headers.map((h) => h.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  expect(f.headers.map((h) => h.getAttribute('role'))).toEqual(Array(7).fill('columnheader'));
  expect(f.headers[0].getAttribute('aria-label')).toBe('Monday');
  expect(f.heading.textContent).toBe('October 2026');
  expect(f.byDate('2026-10-10').getAttribute('aria-label')).toBe('Saturday, October 10, 2026');
  setElementProps(f.root, {
    defaultMonth: '2026-10',
    locale: 'zh-CN',
    weekStartsOn: 0,
    today: '2026-10-10',
  });
  await flush();
  expect(f.headers.map((h) => h.textContent)).toEqual([
    '周日',
    '周一',
    '周二',
    '周三',
    '周四',
    '周五',
    '周六',
  ]);
  expect(f.headers[0].getAttribute('aria-label')).toBe('星期日');
  expect(f.heading.textContent).toBe('2026年10月');
  expect(f.byDate('2026-10-10').getAttribute('aria-label')).toBe('2026年10月10日星期六');
  expect(f.days[0].getExposes().date.get()).toBe('2026-09-27');
});
it('marks only the explicit host civil date as current, separately from selection and availability', async () => {
  const f = await fixture({
    today: '2026-10-10',
    value: '2026-10-11',
    unavailable: ['2026-10-10'],
  });
  const today = f.byDate('2026-10-10'),
    selected = f.byDate('2026-10-11');
  expect(today.getExposes().today.get()).toBe(true);
  expect(today.getAttribute('aria-current')).toBe('date');
  expect(today.getAttribute('aria-selected')).toBe('false');
  expect(today.getAttribute('aria-disabled')).toBe('true');
  expect(selected.getAttribute('aria-current')).toBe('false');
  expect(selected.getAttribute('aria-selected')).toBe('true');
  setElementProps(f.root, { defaultMonth: '2026-10', today: '2026-10-11', value: '2026-10-11' });
  await flush();
  expect(today.getAttribute('aria-current')).toBe('false');
  expect(selected.getAttribute('aria-current')).toBe('date');
  setElementProps(f.root, { defaultMonth: '2026-10', today: '', value: '2026-10-11' });
  await flush();
  expect(f.days.every((day) => !day.getExposes().today.get())).toBe(true);
});
it('derives an empty initial month from today but does not silently navigate as the host clock advances', async () => {
  const root = node('root', { today: '2040-02-29' });
  roots.push(root);
  document.body.append(root);
  await flush();
  expect(root.getExposes().month.get()).toBe('2040-02');
  setElementProps(root, { today: '2040-03-01' });
  await flush();
  expect(root.getExposes().month.get()).toBe('2040-02');
  const noClock = node('root');
  roots.push(noClock);
  document.body.append(noClock);
  await flush();
  expect(noClock.getExposes().month.get()).toBe('1970-01');
});
it('preserves controlled/default/selected month precedence above the explicit host clock', async () => {
  for (const [props, expected] of [
    [{ month: '2020-05', defaultMonth: '2021-01', defaultValue: '2022-03-05' }, '2020-05'],
    [{ defaultMonth: '2021-01', defaultValue: '2022-03-05' }, '2021-01'],
    [{ defaultValue: '2022-03-05' }, '2022-03'],
  ] as const) {
    const root = node('root', { today: '2040-02-29', ...props });
    roots.push(root);
    document.body.append(root);
    await flush();
    expect(root.getExposes().month.get()).toBe(expected);
  }
});
it('keeps invalid locale/today inputs safe and rejects an impossible today date', async () => {
  expect(calendarDateLabel('2026-10-10', 'not_a_locale')).toBe('Saturday, October 10, 2026');
  expect(calendarDateLabel('bad')).toBe('');
  expect(calendarWeekdayInfo(0, 1, 'en-GB')).toEqual({
    weekday: 1,
    label: 'Mo',
    description: 'Monday',
  });
  const f = await fixture({ today: '2026-10-10' });
  setElementProps(f.root, { defaultMonth: '2026-10', today: '2026-02-30' });
  await flush();
  expect(f.byDate('2026-10-10').getExposes().today.get()).toBe(true);
});
it('mirrors horizontal keyboard travel in RTL while preserving vertical and week-edge semantics', async () => {
  const f = await fixture({ defaultValue: '2026-10-10', direction: 'rtl', weekStartsOn: 1 });
  const move = async (from: string, key: string, to: string) => {
    f.byDate(from).getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    f.byDate(from).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
    await flush();
    expect(document.activeElement).toBe(f.byDate(to));
    expect(f.days.filter((d) => d.tabIndex === 0).map((d) => d.getExposes().date.get())).toEqual([
      to,
    ]);
  };
  await move('2026-10-10', 'ArrowRight', '2026-10-09');
  await move('2026-10-10', 'ArrowLeft', '2026-10-11');
  await move('2026-10-10', 'ArrowUp', '2026-10-03');
  await move('2026-10-10', 'ArrowDown', '2026-10-17');
  await move('2026-10-10', 'Home', '2026-10-05');
  await move('2026-10-10', 'End', '2026-10-11');
  setElementProps(f.root, { defaultMonth: '2026-10', direction: 'ltr', weekStartsOn: 1 });
  await flush();
  await move('2026-10-10', 'ArrowRight', '2026-10-11');
});
it('names icon-only navigation and caption without inheriting decorative icon text', async () => {
  const f = await fixture();
  expect(f.previous.getAttribute('aria-label')).toBe('Previous month');
  expect(f.next.getAttribute('aria-label')).toBe('Next month');
  expect(f.caption.getAttribute('role')).toBe('group');
  expect(f.caption.getAttribute('aria-label')).toBe('Calendar navigation');
  setElementProps(f.previous, { a11yLabel: '上个月' });
  setElementProps(f.caption, { a11yLabel: '日历导航' });
  await flush();
  expect(f.previous.getAttribute('aria-label')).toBe('上个月');
  expect(f.caption.getAttribute('aria-label')).toBe('日历导航');
});
it('resets day hover/press when a date is disabled, reassigned, canceled, or detached', async () => {
  const f = await fixture();
  const day = f.byDate('2026-10-10');
  const interact = () => {
    day.dispatchEvent(new Event('pointerenter'));
    day.dispatchEvent(new Event('pointerdown'));
  };
  interact();
  await flush();
  expect(day.getExposes().hovered.get()).toBe(true);
  expect(day.getExposes().pressed.get()).toBe(true);
  setElementProps(f.root, { defaultMonth: '2026-10', disabled: true });
  await flush();
  expect(day.getExposes().hovered.get()).toBe(false);
  expect(day.getExposes().pressed.get()).toBe(false);
  interact();
  await flush();
  expect(day.getExposes().hovered.get()).toBe(false);
  setElementProps(f.root, { defaultMonth: '2026-10' });
  await flush();
  interact();
  day.dispatchEvent(new Event('pointercancel'));
  await flush();
  expect(day.getExposes().pressed.get()).toBe(false);
  interact();
  f.root.getExposes().requestMonth('2026-11');
  await flush();
  expect(day.getExposes().hovered.get()).toBe(false);
  expect(day.getExposes().pressed.get()).toBe(false);
  interact();
  day.remove();
  await flush();
  f.grid.append(day);
  await flush();
  expect(day.getExposes().hovered.get()).toBe(false);
  expect(day.getExposes().pressed.get()).toBe(false);
});

it('selects by Enter and Space while suppressing Space scroll only for the focused enabled day', async () => {
  const f = await fixture();
  const space = f.byDate('2026-10-10');
  space.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  space.dispatchEvent(down);
  space.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
  await flush();
  expect(down.defaultPrevented).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('2026-10-10');
  const enter = f.byDate('2026-10-11');
  enter.getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  enter.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  enter.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
  await flush();
  expect(f.root.getExposes().value.get()).toBe('2026-10-11');
  setElementProps(f.root, { defaultMonth: '2026-10', disabled: true });
  await flush();
  const blocked = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  enter.dispatchEvent(blocked);
  enter.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
  await flush();
  expect(blocked.defaultPrevented).toBe(false);
  expect(f.root.getExposes().value.get()).toBe('2026-10-11');
  setElementProps(f.root, { defaultMonth: '2026-10' });
  await flush();
  const unfocused = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  space.dispatchEvent(unfocused);
  expect(unfocused.defaultPrevented).toBe(false);
});
