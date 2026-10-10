import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  calendarRoot,
  calendarDay,
  calendarNext,
  calendarHeading,
  addMonths,
  monthDays,
  dateAvailable,
  parseDate,
} from '../src/calendar';
for (const p of [calendarRoot, calendarDay, calendarNext, calendarHeading])
  AdaptToWebComponent(p, { registerAs: `test-${p.name}` });
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
describe('Calendar functional slice', () => {
  it('validates civil dates and clamps month arithmetic through leap years', () => {
    expect(parseDate('2025-02-29')).toBe(null);
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(monthDays('2026-10', 1)).toHaveLength(42);
    expect(monthDays('2026-10', 1)[0]).toBe('2026-09-28');
    expect(dateAvailable('2026-10-10', '', '', ['2026-10-10'])).toBe(false);
  });
  it('commits uncontrolled dates and month navigation using actual atoms', async () => {
    const root = document.createElement('test-base-calendar-root') as any;
    const day = document.createElement('test-base-calendar-day') as any;
    const next = document.createElement('test-base-calendar-next') as any;
    const heading = document.createElement('test-base-calendar-heading') as any;
    setElementProps(root, { defaultMonth: '2026-10' });
    setElementProps(day, { date: '2026-10-10' });
    root.append(day, next, heading);
    document.body.append(root);
    await flush();
    day.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('2026-10-10');
    next.click();
    await flush();
    expect(root.getExposes().month.get()).toBe('2026-11');
    expect(heading.getExposes().month.get()).toBe('2026-11');
    root.remove();
  });
  it('controlled values emit requests without mutation and readOnly blocks them', async () => {
    const root = document.createElement('test-base-calendar-root') as any;
    setElementProps(root, { value: '2026-10-01', defaultMonth: '2026-10' });
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (e: CustomEvent) => requests.push(e.detail));
    document.body.append(root);
    await flush();
    expect(root.getExposes().requestValue('2026-10-10')).toBe(true);
    expect(root.getExposes().value.get()).toBe('2026-10-01');
    expect(requests).toEqual([{ value: '2026-10-10' }]);
    setElementProps(root, { readOnly: true });
    await flush();
    expect(root.getExposes().requestValue('2026-10-11')).toBe(false);
    root.remove();
  });
});

import * as shadcn from '../../shadcn/src/calendar';
import * as brutalist from '../../brutalist/src/calendar';
import * as bootstrap from '../../bootstrap-2-3-2/src/calendar';
import * as liquid from '../../liquid-glass/src/calendar';
for (const family of [shadcn, brutalist, bootstrap, liquid]) {
  it(`${family.calendarRoot.name} inherits the real date behavior`, async () => {
    for (const p of [family.calendarRoot, family.calendarDay])
      AdaptToWebComponent(p, { registerAs: `test-${p.name}` });
    const root = document.createElement(`test-${family.calendarRoot.name}`) as any;
    const day = document.createElement(`test-${family.calendarDay.name}`) as any;
    setElementProps(root, { defaultMonth: '2026-10' });
    setElementProps(day, { offset: 13 });
    root.append(day);
    document.body.append(root);
    await flush();
    day.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('2026-10-10');
    expect(day.getExposes().selected.get()).toBe(true);
    root.remove();
  });
}
