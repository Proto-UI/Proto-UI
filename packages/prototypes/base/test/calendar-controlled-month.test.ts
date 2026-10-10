import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { calendarRoot, calendarDay, calendarPrevious, calendarNext } from '../src/calendar';
for (const p of [calendarRoot, calendarDay, calendarPrevious, calendarNext])
  AdaptToWebComponent(p, { registerAs: `controlled-${p.name}` });
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let n = 0; n < 24; n++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
});
async function fixture(props: Record<string, unknown> = {}) {
  const root = document.createElement('controlled-base-calendar-root') as any;
  setElementProps(root, { month: '2026-10', value: '2026-10-31', ...props });
  const days = Array.from({ length: 42 }, (_, offset) => {
    const day = document.createElement('controlled-base-calendar-day') as any;
    setElementProps(day, { offset });
    root.append(day);
    return day;
  });
  roots.push(root);
  document.body.append(root);
  await flush();
  const byDate = (date: string) => days.find((day) => day.getExposes().date.get() === date);
  const tabs = () =>
    days.filter((day) => day.tabIndex === 0).map((day) => day.getExposes().date.get());
  const focus = (date: string) => byDate(date).getExposes().focusSelf({ reason: 'keyboard' });
  const key = (date: string, key: string) =>
    byDate(date).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
  const requests: Array<{ month: string }> = [];
  root.addEventListener('monthChange', (e: CustomEvent) => requests.push(e.detail));
  focus('2026-10-31');
  await flush();
  return { root, days, byDate, tabs, key, focus, requests };
}
it('keeps the current valid active day and focus when the owner refuses a month request', async () => {
  const f = await fixture();
  f.key('2026-10-31', 'PageDown');
  await flush();
  expect(f.requests).toEqual([{ month: '2026-11' }]);
  expect(f.root.getExposes().month.get()).toBe('2026-10');
  expect(f.tabs()).toEqual(['2026-10-31']);
  expect(document.activeElement).toBe(f.byDate('2026-10-31'));
});
it.each(['synchronous', 'asynchronous'] as const)(
  'materializes and focuses the accepted navigation target after %s owner acceptance',
  async (acceptance) => {
    const f = await fixture();
    if (acceptance === 'synchronous')
      f.root.addEventListener('monthChange', (e: CustomEvent) =>
        setElementProps(f.root, { month: e.detail.month })
      );
    f.key('2026-10-31', 'PageDown');
    await flush();
    if (acceptance === 'asynchronous') {
      expect(f.tabs()).toEqual(['2026-10-31']);
      setElementProps(f.root, { month: '2026-11' });
      await flush();
    }
    expect(f.root.getExposes().month.get()).toBe('2026-11');
    expect(f.tabs()).toEqual(['2026-11-30']);
    expect(document.activeElement).toBe(f.byDate('2026-11-30'));
    expect(f.byDate('2026-11-30').textContent).toBe('30');
    expect(f.root.getExposes().value.get()).toBe('2026-10-31');
    expect(f.requests).toEqual([{ month: '2026-11' }]);
  }
);
it('does not commit a refused outside-day target even when that date is already rendered', async () => {
  const f = await fixture({ fixedWeeks: true });
  f.key('2026-10-31', 'ArrowRight');
  await flush();
  expect(f.requests).toEqual([{ month: '2026-11' }]);
  expect(f.byDate('2026-11-01')).toBeDefined();
  expect(f.tabs()).toEqual(['2026-10-31']);
  expect(document.activeElement).toBe(f.byDate('2026-10-31'));
});
it('skips unavailable targets and preserves focus when constraints forbid crossing the boundary', async () => {
  const f = await fixture({ unavailable: ['2026-11-30'] });
  f.root.addEventListener('monthChange', (e: CustomEvent) =>
    setElementProps(f.root, { month: e.detail.month })
  );
  f.key('2026-10-31', 'PageDown');
  await flush();
  expect(f.requests).toEqual([{ month: '2026-12' }]);
  expect(f.tabs()).toEqual(['2026-12-01']);
  expect(document.activeElement).toBe(f.byDate('2026-12-01'));
  const g = await fixture({ max: '2026-10-31' });
  g.key('2026-10-31', 'ArrowRight');
  await flush();
  expect(g.requests).toEqual([]);
  expect(g.tabs()).toEqual(['2026-10-31']);
});
it('revalidates a pending target against constraints at asynchronous acceptance', async () => {
  const f = await fixture();
  f.key('2026-10-31', 'PageDown');
  await flush();
  setElementProps(f.root, { month: '2026-11', unavailable: ['2026-11-30'] });
  await flush();
  expect(f.tabs()).toEqual(['2026-11-01']);
  expect(document.activeElement).toBe(f.byDate('2026-11-01'));
  expect(f.byDate('2026-11-30').getExposes().disabled.get()).toBe(true);
});
it('supersedes pending cross-month intent when a newer in-month navigation is committed', async () => {
  const f = await fixture();
  f.key('2026-10-31', 'PageDown');
  await flush();
  f.key('2026-10-31', 'ArrowLeft');
  await flush();
  expect(f.tabs()).toEqual(['2026-10-30']);
  setElementProps(f.root, { month: '2026-11' });
  await flush();
  expect(f.tabs()).toEqual(['2026-11-01']);
  expect(document.activeElement).not.toBe(f.byDate('2026-11-30'));
});
it('updates the tab entry after acceptance without stealing focus that has left the Calendar', async () => {
  const f = await fixture();
  f.key('2026-10-31', 'PageDown');
  await flush();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await flush();
  try {
    setElementProps(f.root, { month: '2026-11' });
    await flush();
    expect(f.tabs()).toEqual(['2026-11-30']);
    expect(document.activeElement).toBe(outside);
  } finally {
    outside.remove();
  }
});
it.each([
  [calendarPrevious, '2026-09'],
  [calendarNext, '2026-11'],
] as const)(
  'combines Root and local disabled policy for %s through prop updates',
  async (prototype, nextMonth) => {
    const root = document.createElement('controlled-base-calendar-root') as any;
    const control = document.createElement(`controlled-${prototype.name}`) as any;
    setElementProps(root, { month: '2026-10', disabled: true });
    root.append(control);
    roots.push(root);
    document.body.append(root);
    await flush();
    const requests: any[] = [];
    root.addEventListener('monthChange', (event: CustomEvent) => requests.push(event.detail));
    const expectDisabled = () => {
      expect(control.getExposes().disabled.get()).toBe(true);
      expect(control.tabIndex).toBe(-1);
      expect(control.getAttribute('aria-disabled')).toBe('true');
    };
    expectDisabled();
    control.getExposes().focusSelf({ reason: 'keyboard' });
    control.click();
    await flush();
    expect(document.activeElement).not.toBe(control);
    expect(requests).toEqual([]);
    setElementProps(control, { disabled: false });
    await flush();
    expectDisabled();
    setElementProps(root, { disabled: false });
    await flush();
    expect(control.getExposes().disabled.get()).toBe(false);
    expect(control.tabIndex).toBe(0);
    expect(control.getAttribute('aria-disabled')).toBe('false');
    control.click();
    await flush();
    expect(requests).toEqual([{ month: nextMonth }]);
    setElementProps(control, { disabled: true });
    await flush();
    setElementProps(root, { disabled: true });
    await flush();
    setElementProps(root, { disabled: false });
    await flush();
    expectDisabled();
    control.click();
    await flush();
    expect(requests).toHaveLength(1);
  }
);
