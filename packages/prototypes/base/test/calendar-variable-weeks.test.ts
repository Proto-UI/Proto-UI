import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { calendarRoot, calendarRow, calendarDay, monthDays } from '../src/calendar';
import { calendarDay as shadcnDay, calendarRoot as shadcnRoot } from '../../shadcn/src/calendar';
for (const proto of [calendarRoot, calendarRow, calendarDay, shadcnRoot, shadcnDay])
  AdaptToWebComponent(proto, { registerAs: `extent-${proto.name}` });
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let n = 0; n < 24; n++) await Promise.resolve();
};
afterEach(async () => {
  vi.restoreAllMocks();
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (name: string, props = {}) => {
  const el = document.createElement(`extent-${name}`) as any;
  setElementProps(el, props);
  return el;
};
async function fixture(props: Record<string, unknown> = {}) {
  const root = node('base-calendar-root', { month: '2026-10', ...props });
  const rows = Array.from({ length: 6 }, (_, index) => node('base-calendar-row', { index }));
  const days = Array.from({ length: 42 }, (_, offset) => node('base-calendar-day', { offset }));
  rows.forEach((row, index) => {
    row.append(...days.slice(index * 7, index * 7 + 7));
    root.append(row);
  });
  roots.push(root);
  document.body.append(root);
  await flush();
  return { root, rows, days };
}
it.each([
  ['2026-10', 0, 35, '2026-09-27', '2026-10-31'],
  ['2026-11', 0, 35, '2026-11-01', '2026-12-05'],
  ['2026-02', 0, 28, '2026-02-01', '2026-02-28'],
  ['2026-05', 0, 42, '2026-04-26', '2026-06-06'],
  ['2026-11', 1, 42, '2026-10-26', '2026-12-06'],
  ['2024-02', 0, 35, '2024-01-28', '2024-03-02'],
] as const)('covers %s with week start %i in %i days', (month, start, count, first, last) => {
  const days = monthDays(month, start);
  expect(days).toHaveLength(count);
  expect(days[0]).toBe(first);
  expect(days.at(-1)).toBe(last);
});
it('retains explicit six-week mode and finite week-start normalization', () => {
  expect(monthDays('2026-02', 0, true)).toHaveLength(42);
  expect(monthDays('2026-02', NaN)).toEqual(monthDays('2026-02', 0));
  expect(monthDays('2026-11', 8)).toEqual(monthDays('2026-11', 1));
  expect(monthDays('invalid')).toEqual([]);
});
it('hides unused mounted row/day capacity and rejects their focus and selection', async () => {
  const f = await fixture({ value: '' });
  expect(f.root.getExposes().weekCount.get()).toBe(5);
  expect(f.rows.map((row) => row.getExposes().hidden.get())).toEqual([
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
  expect(f.rows[5].hasAttribute('hidden')).toBe(true);
  expect(f.rows[5].getAttribute('data-pui-style')).toContain('data-[hidden]:hidden');
  expect(f.days.filter((day) => !day.hasAttribute('hidden'))).toHaveLength(35);
  for (const day of f.days.slice(35)) {
    expect(day.getExposes().hidden.get()).toBe(true);
    expect(day.getAttribute('aria-hidden')).toBe('true');
    expect(day.getAttribute('data-pui-style')).toContain('data-[hidden]:hidden');
    expect(day.getExposes().disabled.get()).toBe(true);
    expect(day.getExposes().selected.get()).toBe(false);
    expect(day.tabIndex).toBe(-1);
    day.getExposes().focusSelf();
    day.click();
    expect(document.activeElement).not.toBe(day);
  }
  expect(f.root.getExposes().value.get()).toBe('');
  setElementProps(f.root, { month: '2026-02', fixedWeeks: true });
  await flush();
  expect(f.root.getExposes().weekCount.get()).toBe(6);
  expect(f.days.filter((day) => !day.hasAttribute('hidden'))).toHaveLength(42);
  setElementProps(f.root, { month: '2026-02', fixedWeeks: false });
  await flush();
  expect(f.root.getExposes().weekCount.get()).toBe(4);
  expect(f.rows.filter((row) => !row.hasAttribute('hidden'))).toHaveLength(4);
  expect(f.days.filter((day) => !day.hasAttribute('hidden'))).toHaveLength(28);
});
it.each(['synchronous', 'asynchronous', 'refused'] as const)(
  'keeps extent canonical during %s controlled requests',
  async (acceptance) => {
    const f = await fixture({ month: '2026-02', value: '2026-02-28' });
    const day = f.days[27];
    day.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    if (acceptance === 'synchronous')
      f.root.addEventListener('monthChange', (e: CustomEvent) =>
        setElementProps(f.root, { month: e.detail.month })
      );
    day.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    );
    await flush();
    if (acceptance !== 'synchronous') {
      expect(f.root.getExposes().weekCount.get()).toBe(4);
      expect(f.days.filter((cell) => cell.tabIndex === 0)).toEqual([day]);
      expect(document.activeElement).toBe(day);
    }
    if (acceptance === 'asynchronous') {
      setElementProps(f.root, { month: '2026-03' });
      await flush();
    }
    expect(f.root.getExposes().weekCount.get()).toBe(acceptance === 'refused' ? 4 : 5);
    if (acceptance !== 'refused')
      expect(document.activeElement).toBe(
        f.days.find((cell) => cell.getExposes().date.get() === '2026-03-28')
      );
  }
);
it('keeps explicit outside dates visible while applying availability and preserves unindexed authored rows', async () => {
  const root = node('base-calendar-root', { month: '2026-02', unavailable: ['2026-03-01'] });
  const row = node('base-calendar-row');
  const day = node('base-calendar-day', { date: '2026-03-01', offset: 40 });
  row.append(day);
  root.append(row);
  roots.push(root);
  document.body.append(root);
  await flush();
  expect(row.getExposes().hidden.get()).toBe(false);
  expect(day.getExposes().hidden.get()).toBe(false);
  expect(day.getExposes().outside.get()).toBe(true);
  expect(day.getExposes().disabled.get()).toBe(true);
});
it('declares a focused Shadcn ring independently of selected when the host reports non-visible focus', async () => {
  const root = node('shadcn-calendar-root', { month: '2026-11' });
  const day = node('shadcn-calendar-day', { date: '2026-11-07' });
  root.append(day);
  roots.push(root);
  document.body.append(root);
  await flush();
  // Happy DOM treats every focus as :focus-visible. Supply the explicit host
  // fact for this semantic test; real browser pointer focus remains a visual gate.
  const matches = day.matches.bind(day);
  vi.spyOn(day as HTMLElement, 'matches').mockImplementation((selector: string) =>
    selector === ':focus-visible' ? false : matches(selector)
  );
  day.getExposes().focusSelf({ reason: 'pointer' });
  await flush();
  expect(day.getExposes().focused.get()).toBe(true);
  expect(day.getExposes().focusVisible.get()).toBe(false);
  expect(day.getExposes().selected.get()).toBe(false);
  expect(day.getAttribute('data-pui-style')).toContain('data-[focused]:ring-3');
  day.click();
  await flush();
  expect(day.getExposes().selected.get()).toBe(true);
  expect(day.getExposes().focused.get()).toBe(true);
  expect(day.getAttribute('data-pui-style')).toContain('data-[selected]:bg-primary');
});
