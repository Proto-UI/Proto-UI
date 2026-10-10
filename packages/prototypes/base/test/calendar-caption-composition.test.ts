import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { calendarRoot } from '../src/calendar';
import {
  bindCalendarCaption,
  type CalendarCaptionBinding,
  type CalendarCaptionState,
} from '../src/calendar/caption-composition';
import { selectRoot, selectTrigger, selectValue, selectContent, selectItem } from '../src/select';

function state<Value>(initial: Value) {
  let value = initial;
  const listeners = new Set<() => void>();
  const historicalListeners: Array<() => void> = [];
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      historicalListeners.push(listener);
      return () => listeners.delete(listener);
    },
    set(next: Value) {
      value = next;
      for (const listener of listeners) listener();
    },
    listeners,
    historicalListeners,
  } satisfies CalendarCaptionState<Value> & Record<string, unknown>;
}

function fixture(request?: (month: string) => boolean) {
  const month = state('2024-02');
  const disabled = state(false);
  const requestMonth = vi.fn(
    request ??
      ((next: string) => {
        month.set(next);
        return true;
      })
  );
  const monthControl = { setValue: vi.fn(), setDisabled: vi.fn() };
  const yearControl = { setValue: vi.fn(), setDisabled: vi.fn() };
  const source = { month, disabled, requestMonth };
  const binding = bindCalendarCaption(source, { month: monthControl, year: yearControl });
  const current = () => ({
    month: monthControl.setValue.mock.lastCall?.[0],
    year: yearControl.setValue.mock.lastCall?.[0],
    monthDisabled: monthControl.setDisabled.mock.lastCall?.[0],
    yearDisabled: yearControl.setDisabled.mock.lastCall?.[0],
  });
  return { source, binding, monthControl, yearControl, current };
}

describe('Calendar public caption composition', () => {
  it('initializes controlled values and requests from the latest canonical month', () => {
    const f = fixture();
    expect(f.current()).toEqual({
      month: '2',
      year: '2024',
      monthDisabled: false,
      yearDisabled: false,
    });
    expect(f.binding.requestMonth('12')).toBe(true);
    expect(f.source.requestMonth).toHaveBeenLastCalledWith('2024-12');
    expect(f.current().month).toBe('12');
    f.source.month.set('2030-07');
    expect(f.binding.requestYear('2028')).toBe(true);
    expect(f.source.requestMonth).toHaveBeenLastCalledWith('2028-07');
    expect(f.current()).toMatchObject({ month: '7', year: '2028' });
    f.binding.dispose();
  });

  it.each([true, false])(
    'resynchronizes a refused owner even when requestMonth reports %s',
    (result) => {
      const f = fixture(() => result);
      expect(f.binding.requestMonth('3')).toBe(result);
      expect(f.current()).toMatchObject({ month: '2', year: '2024' });
      expect(f.binding.requestYear('2025')).toBe(result);
      expect(f.source.requestMonth).toHaveBeenLastCalledWith('2025-02');
      expect(f.current()).toMatchObject({ month: '2', year: '2024' });
      f.binding.dispose();
    }
  );

  it('does not display asynchronous proposals before owner acceptance', async () => {
    const f = fixture(() => true);
    f.binding.requestMonth('11');
    f.binding.requestYear('2040');
    expect(f.source.requestMonth.mock.calls).toEqual([['2024-11'], ['2040-02']]);
    expect(f.current()).toMatchObject({ month: '2', year: '2024' });
    await Promise.resolve();
    f.source.month.set('2040-02');
    expect(f.current()).toMatchObject({ month: '2', year: '2040' });
    f.binding.dispose();
  });

  it('follows a synchronous owner redirect instead of the requested value', () => {
    const f = fixture();
    f.source.requestMonth.mockImplementation(() => {
      f.source.month.set('2035-09');
      return true;
    });
    f.binding.requestMonth('4');
    expect(f.current()).toMatchObject({ month: '9', year: '2035' });
    f.binding.dispose();
  });

  it('keeps pending decisions canonical across disable/re-enable', () => {
    const f = fixture(() => true);
    f.binding.requestYear('2040');
    f.source.disabled.set(true);
    expect(f.current()).toMatchObject({
      month: '2',
      year: '2024',
      monthDisabled: true,
      yearDisabled: true,
    });
    expect(f.binding.requestMonth('8')).toBe(false);
    expect(f.source.requestMonth).toHaveBeenCalledTimes(1);
    f.source.month.set('2040-02');
    f.source.disabled.set(false);
    expect(f.current()).toMatchObject({ year: '2040', monthDisabled: false, yearDisabled: false });
    f.binding.dispose();
  });

  it.each(['', '0', '13', '-1', '2.5', ' 2', '002', 'NaN'])(
    'rejects invalid month option %j',
    (value) => {
      const f = fixture();
      expect(f.binding.requestMonth(value)).toBe(false);
      expect(f.source.requestMonth).not.toHaveBeenCalled();
      expect(f.current()).toMatchObject({ month: '2', year: '2024' });
      f.binding.dispose();
    }
  );

  it.each(['', '24', '10000', '-001', '20e3', ' 2024', '2024 '])(
    'rejects invalid year option %j',
    (value) => {
      const f = fixture();
      expect(f.binding.requestYear(value)).toBe(false);
      expect(f.source.requestMonth).not.toHaveBeenCalled();
      f.binding.dispose();
    }
  );

  it('accepts padded months and ancient civil years without numeric year coercion', () => {
    const f = fixture();
    f.binding.requestMonth('09');
    f.binding.requestYear('0099');
    expect(f.source.requestMonth).toHaveBeenLastCalledWith('0099-09');
    expect(f.current()).toMatchObject({ month: '9', year: '0099' });
    expect(f.binding.requestMonth('9')).toBe(false);
    expect(f.source.requestMonth).toHaveBeenCalledTimes(2);
    f.binding.dispose();
  });

  it('rejects setter echoes and recursive requests while synchronizing', () => {
    const f = fixture();
    f.monthControl.setValue.mockImplementation((value) => f.binding.requestMonth(value));
    f.yearControl.setValue.mockImplementation((value) => {
      f.binding.sync();
      f.binding.requestYear(value);
    });
    f.source.requestMonth.mockImplementation((next) => {
      expect(f.binding.requestYear('2050')).toBe(false);
      f.source.month.set(next);
      return true;
    });
    expect(f.binding.requestMonth('6')).toBe(true);
    expect(f.source.requestMonth).toHaveBeenCalledTimes(1);
    expect(f.current()).toMatchObject({ month: '6', year: '2024' });
    f.binding.dispose();
  });

  it('re-reads a source changed by target setters during synchronization', () => {
    const f = fixture();
    f.monthControl.setValue.mockImplementationOnce(() => f.source.month.set('2060-05'));
    f.binding.sync();
    expect(f.current()).toMatchObject({ month: '5', year: '2060' });
    f.binding.dispose();
  });

  it('disables and clears controls for a malformed source without inventing a month', () => {
    const f = fixture();
    f.source.month.set('invalid');
    expect(f.current()).toEqual({ month: '', year: '', monthDisabled: true, yearDisabled: true });
    expect(f.binding.requestYear('2024')).toBe(false);
    expect(f.source.requestMonth).not.toHaveBeenCalled();
    f.source.month.set('2030-01');
    expect(f.current()).toMatchObject({ month: '1', year: '2030', monthDisabled: false });
    f.binding.dispose();
  });

  it('restores canonical controls before propagating an owner exception', () => {
    const f = fixture(() => {
      throw new Error('Owner rejected');
    });
    expect(() => f.binding.requestMonth('6')).toThrow('Owner rejected');
    expect(f.current()).toMatchObject({ month: '2', year: '2024' });
    f.binding.dispose();
  });

  it('unsubscribes both sources, makes queued callbacks inert, and disposes idempotently', () => {
    const f = fixture();
    f.binding.dispose();
    f.binding.dispose();
    expect(f.source.month.listeners.size).toBe(0);
    expect(f.source.disabled.listeners.size).toBe(0);
    f.monthControl.setValue.mockClear();
    f.yearControl.setValue.mockClear();
    f.source.month.set('2030-01');
    f.source.disabled.set(true);
    for (const callback of [
      ...f.source.month.historicalListeners,
      ...f.source.disabled.historicalListeners,
    ])
      callback();
    f.binding.sync();
    expect(f.binding.requestMonth('4')).toBe(false);
    expect(f.binding.requestYear('2040')).toBe(false);
    expect(f.monthControl.setValue).not.toHaveBeenCalled();
    expect(f.yearControl.setValue).not.toHaveBeenCalled();
    expect(f.source.requestMonth).not.toHaveBeenCalled();
  });
});

for (const prototype of [
  calendarRoot,
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
]) {
  AdaptToWebComponent(prototype, { registerAs: `caption-test-${prototype.name}` });
}
const mounted: HTMLElement[] = [];
const bindings: CalendarCaptionBinding[] = [];
const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};
afterEach(async () => {
  for (const binding of bindings.splice(0)) binding.dispose();
  for (const root of mounted.splice(0)) root.remove();
  await flush();
});

it('composes real Calendar and Select public exposes, with no hidden Select context in Calendar', async () => {
  const create = (part: string, props: Record<string, unknown> = {}) => {
    const element = document.createElement(`caption-test-base-${part}`) as HTMLElement & {
      getExposes(): any;
      update(): void;
    };
    setElementProps(element, props);
    return element;
  };
  const calendar = create('calendar-root', { month: '2024-02' });
  const month = create('select-root', { value: '2' });
  const year = create('select-root', { value: '2024' });
  for (const [root, options] of [
    [month, ['2', '3']],
    [year, ['2024', '2030']],
  ] as const) {
    const trigger = create('select-trigger');
    trigger.append(create('select-value'));
    const content = create('select-content');
    for (const value of options) {
      const item = create('select-item', { value, textValue: value });
      item.textContent = value;
      content.append(item);
    }
    root.append(trigger, content);
  }
  calendar.append(month, year);
  document.body.append(calendar);
  mounted.push(calendar);
  await flush();
  const target = (root: typeof month) => {
    const props = { value: root.getExposes().value.get(), disabled: false };
    const publish = () => {
      setElementProps(root, { ...props });
      root.update();
    };
    return {
      setValue(value: string) {
        props.value = value;
        publish();
      },
      setDisabled(disabled: boolean) {
        props.disabled = disabled;
        publish();
      },
    };
  };
  const binding = bindCalendarCaption(calendar.getExposes(), {
    month: target(month),
    year: target(year),
  });
  bindings.push(binding);
  month.addEventListener('valueChange', (event) =>
    binding.requestMonth((event as CustomEvent).detail.value)
  );
  year.addEventListener('valueChange', (event) =>
    binding.requestYear((event as CustomEvent).detail.value)
  );

  // Root is controlled and refuses by leaving its props unchanged.
  month.getExposes().requestValue({ value: '3', textValue: '3', reason: 'pointer' });
  await flush();
  expect(calendar.getExposes().month.get()).toBe('2024-02');
  expect(month.getExposes().value.get()).toBe('2');
  expect(year.getExposes().value.get()).toBe('2024');
  // Owner later accepts an externally chosen month; both real Selects follow.
  setElementProps(calendar, { month: '2030-03', disabled: true });
  calendar.update();
  await flush();
  expect(month.getExposes().value.get()).toBe('3');
  expect(year.getExposes().value.get()).toBe('2030');
  expect(month.querySelector('[role="combobox"]')?.getAttribute('aria-disabled')).toBe('true');
  expect(year.querySelector('[role="combobox"]')?.getAttribute('aria-disabled')).toBe('true');
});
