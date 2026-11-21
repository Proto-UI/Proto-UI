import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/calendar';
import * as basePicker from '../src/date-picker';
import * as shadcn from '../../shadcn/src/calendar';
import * as shadcnPicker from '../../shadcn/src/date-picker';
import * as brutalist from '../../brutalist/src/calendar';
import * as brutalistPicker from '../../brutalist/src/date-picker';
import * as bootstrap from '../../bootstrap-2-3-2/src/calendar';
import * as bootstrapPicker from '../../bootstrap-2-3-2/src/date-picker';
import * as liquid from '../../liquid-glass/src/calendar';
import * as liquidPicker from '../../liquid-glass/src/date-picker';
import { calendarRangeNights, isCalendarRange, isCalendarValues } from '../src/calendar/selection';

const families = [
  { name: 'base', calendar: base, picker: basePicker },
  { name: 'shadcn', calendar: shadcn, picker: shadcnPicker },
  { name: 'brutalist', calendar: brutalist, picker: brutalistPicker },
  { name: 'bootstrap-2-3-2', calendar: bootstrap, picker: bootstrapPicker },
  { name: 'liquid-glass', calendar: liquid, picker: liquidPicker },
];
for (const family of families) {
  for (const proto of [
    family.calendar.calendarRoot,
    family.calendar.calendarGrid,
    family.calendar.calendarDay,
    family.picker.datePickerRoot,
    family.picker.datePickerDay,
    family.picker.datePickerValue,
  ])
    AdaptToWebComponent(proto, { registerAs: `selection-${proto.name}` });
}
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
});
async function fixture(props: Record<string, unknown> = {}, family = families[0], picker = false) {
  const create = (name: string, properties: Record<string, unknown> = {}) => {
    const el = document.createElement(`selection-${family.name}-${name}`) as any;
    setElementProps(el, properties);
    return el;
  };
  const root = create(picker ? 'date-picker-root' : 'calendar-root', {
    defaultMonth: '2026-10',
    ...props,
  });
  const grid = create('calendar-grid');
  const dates = [
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-10',
  ];
  const days = dates.map((date) => create(picker ? 'date-picker-day' : 'calendar-day', { date }));
  grid.append(...days);
  root.append(grid);
  const display = picker ? create('date-picker-value', { placeholder: 'Choose dates' }) : null;
  if (display) root.append(display);
  roots.push(root);
  document.body.append(root);
  await flush();
  return {
    root,
    grid,
    days,
    display,
    api: root.getExposes(),
    day: (date: string) => days[dates.indexOf(date)],
  };
}
const read = (day: any) => {
  const api = day.getExposes();
  return Object.fromEntries(
    ['selected', 'rangeStart', 'rangeEnd', 'rangeMiddle', 'rangePending'].map((key) => [
      key,
      api[key].get(),
    ])
  );
};

describe('Calendar multiple selection', () => {
  it('grows from empty toward minSelected while guarding removals and complete replacements', async () => {
    const f = await fixture({ mode: 'multiple', minSelected: 2, maxSelected: 3 });
    f.day('2026-10-01').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01']);
    expect(f.day('2026-10-01').getAttribute('aria-selected')).toBe('true');
    expect(f.api.requestValue('2026-10-01')).toBe(false);
    expect(f.api.requestValues(['2026-10-02'])).toBe(false);
    f.day('2026-10-02').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-02']);
    expect(f.api.requestValue('2026-10-01')).toBe(false);
    expect(f.api.requestValue('2026-10-03')).toBe(true);
    expect(f.api.requestValue('2026-10-04')).toBe(false);
    expect(f.api.requestValue('2026-10-01')).toBe(true);
    expect(f.api.getValues()).toEqual(['2026-10-02', '2026-10-03']);
    expect(f.api.requestValue('2026-10-02')).toBe(false);
  });
  it('keeps progressive minimum additions controlled until accepted and leaves the picker open', async () => {
    const p = { mode: 'multiple', values: [] as string[], minSelected: 2, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    const proposals: string[][] = [];
    f.root.addEventListener('valuesChange', (event: CustomEvent) =>
      proposals.push(event.detail.values)
    );
    f.day('2026-10-01').click();
    await flush();
    expect(proposals).toEqual([['2026-10-01']]);
    expect(f.api.getValues()).toEqual([]);
    expect(f.day('2026-10-01').getAttribute('aria-selected')).toBe('false');
    setElementProps(f.root, { ...p, values: proposals[0] });
    await flush();
    f.day('2026-10-02').click();
    await flush();
    expect(proposals[1]).toEqual(['2026-10-01', '2026-10-02']);
    expect(f.api.getValues()).toEqual(['2026-10-01']);
    setElementProps(f.root, { ...p, values: proposals[1] });
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-02']);
    expect(f.api.open.get()).toBe(true);
  });
  it('toggles ordered unique dates, protects copies, and does not change legacy single value', async () => {
    const f = await fixture({
      mode: 'multiple',
      defaultValues: ['2026-10-03', '2026-10-01', '2026-10-03'],
      defaultValue: '2020-02-29',
    });
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-03']);
    expect(f.api.selectedCount.get()).toBe(2);
    expect(f.grid.getAttribute('aria-multiselectable')).toBe('true');
    const copy = f.api.getValues();
    copy.push('2026-10-05');
    const events: unknown[] = [];
    f.root.addEventListener('valuesChange', (event: CustomEvent) => {
      events.push([...event.detail.values]);
      event.detail.values.push('2026-10-10');
    });
    f.day('2026-10-02').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    f.day('2026-10-01').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-02', '2026-10-03']);
    expect(f.day('2026-10-01').getAttribute('aria-selected')).toBe('false');
    expect(f.day('2026-10-02').getAttribute('aria-selected')).toBe('true');
    expect(f.api.value.get()).toBe('2020-02-29');
    expect(events).toHaveLength(2);
    expect(f.api.requestValues(['2026-10-03', '2026-10-02', '2026-10-03'])).toBe(false);
    expect(f.api.requestRange({ from: '2026-10-01' })).toBe(false);
  });
  it('enforces cardinality, dates and disabled/readOnly while preserving existing owner data', async () => {
    const p = {
      mode: 'multiple',
      values: ['2026-10-01'],
      minSelected: 1,
      maxSelected: 2,
      min: '2026-10-01',
      max: '2026-10-05',
      unavailable: ['2026-10-04'],
    };
    const f = await fixture(p);
    for (const next of [
      [],
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      ['2026-09-30'],
      ['2026-10-04'],
      ['2026-10-10'],
      ['bad'],
    ])
      expect(f.api.requestValues(next)).toBe(false);
    expect(f.api.requestValue('2026-10-01')).toBe(false);
    expect(f.api.requestValues(['2026-10-01', '2026-10-02'])).toBe(true);
    expect(f.api.getValues()).toEqual(['2026-10-01']);
    for (const flag of ['readOnly', 'disabled']) {
      setElementProps(f.root, { ...p, [flag]: true });
      await flush();
      expect(f.api.requestValue('2026-10-02')).toBe(false);
      expect(f.api.requestValues(['2026-10-02'])).toBe(false);
    }
    setElementProps(f.root, { ...p, unavailable: ['2026-10-01'] });
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01']);
    expect(f.day('2026-10-01').getExposes().selected.get()).toBe(true);
  });
  it('keeps refusal canonical, handles synchronous and delayed owner acceptance, and ignores later defaults', async () => {
    const p = { mode: 'multiple', values: ['2026-10-01'], defaultMonth: '2026-10' };
    const f = await fixture(p);
    const requests: string[][] = [];
    f.root.addEventListener('valuesChange', (event: CustomEvent) =>
      requests.push(event.detail.values)
    );
    f.day('2026-10-03').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01']);
    expect(f.day('2026-10-03').getExposes().selected.get()).toBe(false);
    setElementProps(f.root, { ...p, values: requests[0] });
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-03']);
    f.root.addEventListener('valuesChange', (event: CustomEvent) =>
      setElementProps(f.root, { ...p, values: event.detail.values })
    );
    f.day('2026-10-02').click();
    await flush();
    expect(f.api.getValues()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    const uncontrolled = await fixture({ mode: 'multiple', defaultValues: ['2026-10-01'] });
    setElementProps(uncontrolled.root, { mode: 'multiple', defaultValues: ['2026-10-05'] });
    await flush();
    expect(uncontrolled.api.getValues()).toEqual(['2026-10-01']);
  });
});

describe('Calendar inclusive range selection', () => {
  it('starts incomplete, normalizes reversed endpoints, marks middle days and restarts after completion', async () => {
    const f = await fixture({ mode: 'range' });
    f.day('2026-10-04').click();
    await flush();
    expect(f.api.getRange()).toEqual({ from: '2026-10-04' });
    expect(read(f.day('2026-10-04'))).toEqual({
      selected: true,
      rangeStart: true,
      rangeEnd: false,
      rangeMiddle: false,
      rangePending: true,
    });
    expect(f.api.rangeComplete.get()).toBe(false);
    f.day('2026-10-01').click();
    await flush();
    expect(f.api.getRange()).toEqual({ from: '2026-10-01', to: '2026-10-04' });
    expect(f.api.selectedCount.get()).toBe(4);
    expect(read(f.day('2026-10-01'))).toEqual({
      selected: true,
      rangeStart: true,
      rangeEnd: false,
      rangeMiddle: false,
      rangePending: false,
    });
    expect(read(f.day('2026-10-02'))).toEqual({
      selected: true,
      rangeStart: false,
      rangeEnd: false,
      rangeMiddle: true,
      rangePending: false,
    });
    expect(read(f.day('2026-10-04'))).toEqual({
      selected: true,
      rangeStart: false,
      rangeEnd: true,
      rangeMiddle: false,
      rangePending: false,
    });
    expect(f.day('2026-10-03').getAttribute('aria-selected')).toBe('true');
    expect(f.day('2026-10-05').getAttribute('aria-selected')).toBe('false');
    f.day('2026-10-05').click();
    await flush();
    expect(f.api.getRange()).toEqual({ from: '2026-10-05' });
    expect(f.day('2026-10-02').getExposes().rangeMiddle.get()).toBe(false);
    f.day('2026-10-05').click();
    await flush();
    expect(read(f.day('2026-10-05'))).toEqual({
      selected: true,
      rangeStart: true,
      rangeEnd: true,
      rangeMiddle: false,
      rangePending: false,
    });
    expect(f.api.selectedCount.get()).toBe(1);
  });
  it('rejects a blocked interior date, date bounds and too-short/long ranges without losing the anchor', async () => {
    const f = await fixture({
      mode: 'range',
      min: '2026-10-01',
      max: '2026-10-10',
      minNights: 2,
      maxNights: 5,
      unavailable: ['2026-10-04'],
    });
    expect(f.api.requestValue('2026-10-01')).toBe(true);
    for (const next of ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-10', '2026-09-30']) {
      expect(f.api.requestValue(next)).toBe(false);
      expect(f.api.getRange()).toEqual({ from: '2026-10-01' });
    }
    expect(f.api.requestValue('2026-10-03')).toBe(true);
    expect(f.api.getRange()).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(f.api.requestRange({ from: '2026-10-03', to: '2026-10-05' })).toBe(false);
    expect(f.api.requestRange({})).toBe(true);
    expect(f.api.getRange()).toEqual({});
  });
  it('copies programmatic ranges and uses civil-day arithmetic across DST, leap days and month boundaries', async () => {
    expect(calendarRangeNights({ from: '2024-02-28', to: '2024-03-01' })).toBe(2);
    expect(calendarRangeNights({ from: '2026-03-07', to: '2026-03-09' })).toBe(2);
    const f = await fixture({ mode: 'range' });
    const input = { from: '2026-10-02', to: '2026-09-30' };
    f.root.addEventListener('rangeChange', (event: CustomEvent) => {
      event.detail.range.from = '2000-01-01';
    });
    expect(f.api.requestRange(input)).toBe(true);
    input.from = '1999-01-01';
    const output = f.api.getRange();
    output.from = '2001-01-01';
    expect(f.api.getRange()).toEqual({ from: '2026-09-30', to: '2026-10-02' });
    expect(f.api.selectedCount.get()).toBe(3);
    expect(f.day('2026-09-30').getExposes().rangeStart.get()).toBe(true);
    expect(f.day('2026-10-01').getExposes().rangeMiddle.get()).toBe(true);
  });
  it('preserves controlled rejection and switches modes without reinterpreting stored owners', async () => {
    const p = {
      defaultMonth: '2026-10',
      mode: 'range',
      range: { from: '2026-10-01' },
      values: ['2026-10-05'],
      value: '2026-10-10',
    };
    const f = await fixture(p);
    f.day('2026-10-03').click();
    await flush();
    expect(f.api.getRange()).toEqual(p.range);
    expect(f.day('2026-10-02').getExposes().selected.get()).toBe(false);
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.day('2026-10-02').getExposes().rangeMiddle.get()).toBe(true);
    setElementProps(f.root, { ...p, mode: 'multiple' });
    await flush();
    expect(f.day('2026-10-05').getExposes().selected.get()).toBe(true);
    expect(
      f.days.every(
        (day) => !day.getExposes().rangeStart.get() && !day.getExposes().rangeMiddle.get()
      )
    ).toBe(true);
    setElementProps(f.root, { ...p, mode: 'single' });
    await flush();
    expect(f.grid.getAttribute('aria-multiselectable')).toBe('false');
    expect(f.day('2026-10-10').getExposes().selected.get()).toBe(true);
  });
  it('selects range endpoints with actual Enter/Space keyboard activation under RTL', async () => {
    const f = await fixture({ mode: 'range', direction: 'rtl' });
    for (const [date, key] of [
      ['2026-10-04', 'Enter'],
      ['2026-10-02', ' '],
    ]) {
      const day = f.day(date);
      day.getExposes().focusSelf({ reason: 'keyboard' });
      await flush();
      day.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      day.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      await flush();
    }
    expect(f.api.getRange()).toEqual({ from: '2026-10-02', to: '2026-10-04' });
    expect(f.day('2026-10-03').getExposes().rangeMiddle.get()).toBe(true);
  });
  it('rejects malformed modes of direct input instead of coercing arbitrary records', async () => {
    for (const value of [null, {}, ['bad'], ['2026-02-30'], Array(2), [23]])
      expect(isCalendarValues(value)).toBe(false);
    for (const value of [
      null,
      [],
      new Date(),
      '2026-10-01',
      { start: '2026-10-01' },
      { to: '2026-10-01' },
      { from: 'bad' },
      { from: 12 },
    ])
      expect(isCalendarRange(value)).toBe(false);
    const f = await fixture({ mode: 'range' });
    expect(f.api.requestRange({ from: 'bad' })).toBe(false);
    expect(f.api.requestRange({ to: '2026-10-01' })).toBe(false);
    expect(f.api.requestValues(['2026-10-01'])).toBe(false);
    expect(f.api.getRange()).toEqual({});
  });
});

describe('Date Picker accepted completion', () => {
  it('retains accepted completion through a synchronous selected-count subscriber update', async () => {
    const p = { mode: 'range', range: { from: '2026-10-01' }, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    const accepted = { ...p, range: { from: '2026-10-01', to: '2026-10-03' } };
    f.api.requestValue('2026-10-03');
    const unsubscribe = f.api.selectedCount.subscribe(() => {
      setElementProps(f.root, { ...accepted, a11yLabel: 'Accepted range' });
    });
    setElementProps(f.root, accepted);
    await flush();
    unsubscribe();
    expect(f.api.getRange()).toEqual(accepted.range);
    expect(f.api.open.get()).toBe(false);
  });
  it('keeps incomplete ranges open, closes a complete range once and formats both endpoints', async () => {
    const f = await fixture({ mode: 'range', defaultOpen: true }, families[0], true);
    f.day('2026-10-01').click();
    await flush();
    expect(f.api.open.get()).toBe(true);
    expect(f.display.textContent).toBe('2026-10-01 …');
    f.day('2026-10-03').click();
    await flush();
    expect(f.api.open.get()).toBe(false);
    expect(f.display.textContent).toBe('2026-10-01 – 2026-10-03');
    f.api.openPopover('programmatic');
    await flush();
    expect(f.api.open.get()).toBe(true);
  });
  it('leaves multiple toggles open and uses empty placeholder after removing the final date', async () => {
    const f = await fixture({ mode: 'multiple', defaultOpen: true }, families[0], true);
    f.day('2026-10-02').click();
    f.day('2026-10-01').click();
    await flush();
    expect(f.api.open.get()).toBe(true);
    expect(f.display.textContent).toBe('2026-10-01, 2026-10-02');
    expect(f.api.requestValues([])).toBe(true);
    await flush();
    expect(f.display.textContent).toBe('Choose dates');
  });
  it.each(['single', 'range'])(
    'does not close controlled %s proposals and closes matching delayed acceptance',
    async (mode) => {
      const initial =
        mode === 'single' ? { value: '2026-10-01' } : { range: { from: '2026-10-01' } };
      const p = { mode, defaultOpen: true, defaultMonth: '2026-10', ...initial };
      const f = await fixture(p, families[0], true);
      f.day('2026-10-03').click();
      await flush();
      expect(f.api.open.get()).toBe(true);
      expect(f.day('2026-10-03').getExposes().selected.get()).toBe(false);
      setElementProps(f.root, {
        ...p,
        ...(mode === 'single'
          ? { value: '2026-10-03' }
          : { range: { from: '2026-10-01', to: '2026-10-03' } }),
      });
      await flush();
      expect(f.api.open.get()).toBe(false);
    }
  );
  it('does not close for external replacement or after disabling invalidates a pending selection', async () => {
    const p = { mode: 'range', range: { from: '2026-10-01' }, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    f.day('2026-10-03').click();
    await flush();
    setElementProps(f.root, { ...p, range: { from: '2026-10-04', to: '2026-10-05' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
    setElementProps(f.root, p);
    await flush();
    f.day('2026-10-03').click();
    await flush();
    setElementProps(f.root, { ...p, disabled: true });
    await flush();
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
  });
  it('retires pending completion across unmount/reentry', async () => {
    const p = { mode: 'range', range: { from: '2026-10-01' }, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    f.day('2026-10-03').click();
    await flush();
    f.root.remove();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.body.append(f.root);
    await flush();
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.root.getExposes().open.get()).toBe(true);
  });
  it('respects controlled open refusal after an accepted range', async () => {
    const f = await fixture({ mode: 'range', open: true }, families[0], true);
    const requests: unknown[] = [];
    f.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
    f.day('2026-10-01').click();
    f.day('2026-10-03').click();
    await flush();
    expect(f.api.open.get()).toBe(true);
    expect(f.api.getRange()).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(requests).toHaveLength(1);
  });
  it('does not close a reopened popup for an earlier or closed-session controlled request', async () => {
    const p = { mode: 'range', range: { from: '2026-10-01' }, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    f.day('2026-10-03').click();
    await flush();
    f.api.close('programmatic');
    await flush();
    f.api.openPopover('programmatic');
    await flush();
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
    setElementProps(f.root, p);
    await flush();
    f.api.close('programmatic');
    await flush();
    f.api.requestValue('2026-10-03');
    await flush();
    f.api.openPopover('programmatic');
    await flush();
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
  });
  it('retires superseded proposals and pending completion when readOnly or mode changes', async () => {
    const p = { mode: 'range', range: { from: '2026-10-01' }, defaultOpen: true };
    const f = await fixture(p, families[0], true);
    f.api.requestValue('2026-10-03');
    f.api.requestValue('2026-10-05');
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
    setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-05' } });
    await flush();
    expect(f.api.open.get()).toBe(true);
    for (const retirement of [{ readOnly: true }, { mode: 'multiple' }]) {
      setElementProps(f.root, p);
      await flush();
      f.api.requestValue('2026-10-03');
      setElementProps(f.root, { ...p, ...retirement });
      await flush();
      setElementProps(f.root, { ...p, range: { from: '2026-10-01', to: '2026-10-03' } });
      await flush();
      expect(f.api.open.get()).toBe(true);
    }
  });
});

for (const family of families.slice(1)) {
  it(`${family.name} Calendar and Date Picker inherit range facts and visibly distinguish middle segments`, async () => {
    for (const picker of [false, true]) {
      const f = await fixture(
        { mode: 'range', defaultRange: { from: '2026-10-01', to: '2026-10-03' } },
        family,
        picker
      );
      expect(f.day('2026-10-01').getExposes().rangeStart.get()).toBe(true);
      expect(f.day('2026-10-02').getExposes().rangeMiddle.get()).toBe(true);
      expect(f.day('2026-10-03').getExposes().rangeEnd.get()).toBe(true);
      expect(f.day('2026-10-02').getAttribute('data-pui-style')).toContain(
        'data-[range-middle]:rounded-none'
      );
      expect(f.day('2026-10-02').getAttribute('data-range-middle')).not.toBeNull();
      expect(f.day('2026-10-01').hasAttribute('data-range-middle')).toBe(false);
      f.root.getExposes().requestValue('2026-10-05');
      await flush();
      expect(f.day('2026-10-02').getExposes().selected.get()).toBe(false);
    }
  });
}
