import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '../../shadcn/src/calendar';
import * as brutalist from '../../brutalist/src/calendar';
import * as bootstrap from '../../bootstrap-2-3-2/src/calendar';
import * as liquid from '../../liquid-glass/src/calendar';
const families = { shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
for (const [family, atoms] of Object.entries(families)) {
  for (const proto of new Set(Object.values(atoms)))
    if (proto && typeof proto === 'object' && 'setup' in proto)
      AdaptToWebComponent(proto, { registerAs: `recipe-${proto.name}` });
  it(`${family} renders all ten inherited atoms and its own static recipe`, async () => {
    const create = (part: string, props = {}) => {
      const el = document.createElement(`recipe-${family}-calendar-${part}`) as any;
      setElementProps(el, props);
      return el;
    };
    const root = create('root', {
      defaultMonth: '2026-10',
      defaultValue: '2026-10-10',
      today: '2026-10-10',
      weekStartsOn: 1,
      locale: 'fr-FR',
      direction: 'rtl',
    });
    const caption = create('caption'),
      previous = create('previous'),
      heading = create('heading'),
      next = create('next');
    previous.textContent = '‹';
    next.textContent = '›';
    caption.append(previous, heading, next);
    const grid = create('grid'),
      weekdays = create('weekdays'),
      row = create('row'),
      weekday = create('weekday', { offset: 0 });
    weekdays.append(weekday);
    const day = create('day', { date: '2026-10-10' });
    row.append(day);
    grid.append(weekdays, row);
    root.append(caption, grid);
    roots.push(root);
    document.body.append(root);
    await flush();
    expect(heading.textContent).toBe('octobre 2026');
    expect(weekday.textContent).toBe('lun.');
    expect(day.textContent).toBe('10');
    expect(day.getAttribute('aria-label')).toBe('samedi 10 octobre 2026');
    expect(caption.contains(heading)).toBe(true);
    expect(weekdays.contains(weekday)).toBe(true);
    expect(root.getExposes().direction.get()).toBe('rtl');
    expect(day.getExposes().today.get()).toBe(true);
    expect(day.getExposes().selected.get()).toBe(true);
    expect(previous.getAttribute('aria-label')).toBe('Previous month');
    const tokens = (el: HTMLElement) =>
      new Set((el.getAttribute('data-pui-style') ?? '').split(/\s+/));
    if (family === 'shadcn') {
      for (const token of ['p-2', 'w-fit', 'bg-background'])
        expect(tokens(root).has(token)).toBe(true);
      for (const token of [
        'w-7',
        'h-7',
        'p-0',
        'data-[selected]:bg-primary',
        'data-[focus-visible]:ring-3',
      ])
        expect(tokens(day).has(token)).toBe(true);
      for (const token of ['w-7', 'h-7']) expect(tokens(previous).has(token)).toBe(true);
      expect(tokens(root).has('border')).toBe(false);
    }
    if (family === 'brutalist') {
      for (const token of ['p-3', 'border-2', 'shadow-[4px_4px_0_0_#000]'])
        expect(tokens(root).has(token)).toBe(true);
      for (const token of ['w-9', 'h-9', 'border-2', 'data-[selected]:bg-main'])
        expect(tokens(day).has(token)).toBe(true);
      for (const token of ['w-7', 'h-7']) expect(tokens(previous).has(token)).toBe(true);
    }
    setElementProps(root, { defaultMonth: '2026-10', disabled: true });
    await flush();
    for (const el of [day, previous, next]) {
      expect(el.getAttribute('aria-disabled')).toBe('true');
      expect(el.tabIndex).toBe(-1);
    }
  });
}
