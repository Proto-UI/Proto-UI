import { afterEach, expect, it } from 'vitest';
import { definePrototype, type AsHookResult } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asCarouselPrevious, asCarouselNext } from '../src/carousel';
import { asTreeToggle } from '../src/tree';
import { asMessageScrollerJump } from '../src/message-scroller';
import { asDataTablePrevious, asDataTableNext } from '../src/data-table';
import { asDatePickerTrigger, asDatePickerDay } from '../src/date-picker';
import { calendarRoot } from '../src/calendar';
import { treeRoot } from '../src/tree';
import { messageScrollerRoot } from '../src/message-scroller';
import { dataTableRoot } from '../src/data-table';
import { carouselRoot, carouselViewport, carouselSlide } from '../src/carousel';
import { datePickerRoot } from '../src/date-picker';
for (const proto of [
  calendarRoot,
  treeRoot,
  messageScrollerRoot,
  dataTableRoot,
  carouselRoot,
  carouselViewport,
  carouselSlide,
  datePickerRoot,
])
  AdaptToWebComponent(proto, { registerAs: `frame-${proto.name}` });
const rows: Array<[string, () => AsHookResult<any, any>, string]> = [
  ['carousel-previous', asCarouselPrevious, 'as-button'],
  ['carousel-next', asCarouselNext, 'as-button'],
  ['tree-toggle', asTreeToggle, 'as-button'],
  ['message-scroller-jump', asMessageScrollerJump, 'as-button'],
  ['data-table-previous', asDataTablePrevious, 'as-button'],
  ['data-table-next', asDataTableNext, 'as-button'],
  ['date-picker-trigger', asDatePickerTrigger, 'as-popover-trigger'],
  ['date-picker-day', asDatePickerDay, 'as-calendar-day'],
];
const flush = async () => {
  for (let n = 0; n < 24; n++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const [name, use, child] of rows) {
  AdaptToWebComponent(
    definePrototype({
      name: `frame-${name}`,
      setup(def) {
        const inherited = use();
        def.expose.method('readCapture', () => inherited);
        return inherited.render;
      },
    })
  );
  it(`${name} keeps real inherited identity in ${child} and never flattens it`, async () => {
    const component = name.replace(/-(previous|next|toggle|jump|trigger|day)$/, '');
    const root = document.createElement(`frame-base-${component}-root`);
    setElementProps(root, { defaultMonth: '2026-10', newContentCount: 5 });
    const el = document.createElement(`frame-${name}`) as any;
    setElementProps(el, { disabled: true, date: '2026-10-12', nodeKey: 'a' });
    root.append(el);
    document.body.append(root);
    await flush();
    const captured = el.getExposes().readCapture();
    expect(captured.stateHandles?.disabled).toBeUndefined();
    expect(captured.stateHandles?.focusVisible).toBeUndefined();
    expect(captured.stateHandles?.pressed).toBeUndefined();
    const actual = captured.getAsHookHandle(child);
    for (const state of ['disabled', 'hovered', 'focused', 'focusVisible', 'pressed'])
      expect(typeof actual.stateHandles[state].get()).toBe('boolean');
    expect(actual.stateHandles.disabled.get()).toBe(true);
    if (name === 'message-scroller-jump') {
      expect(Object.keys(captured.stateHandles).sort()).toEqual(['atEnd', 'newContentCount']);
      expect(captured.stateHandles.newContentCount.get()).toBe(5);
    }
    if (name === 'date-picker-trigger') expect(actual.getAsHookHandle('as-button')).toBeUndefined();
    if (name === 'date-picker-day') expect(actual.stateHandles.date.get()).toBe('2026-10-12');
  });
}
