import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/select';
import * as shadcn from '../../shadcn/src/select';
import * as brutalist from '../../brutalist/src/select';

const families = [
  { name: 'base', prototypes: base },
  { name: 'shadcn', prototypes: shadcn },
  { name: 'brutalist', prototypes: brutalist },
] as const;

for (const { prototypes } of families) {
  for (const proto of [
    prototypes.selectRoot,
    prototypes.selectTrigger,
    prototypes.selectValue,
    prototypes.selectContent,
    prototypes.selectItem,
  ]) {
    AdaptToWebComponent(proto as any);
  }
}
for (const proto of [base.selectSurface, base.selectViewport, base.selectItemText]) {
  AdaptToWebComponent(proto);
}

async function settle() {
  await vi.advanceTimersByTimeAsync(200);
  await Promise.resolve();
  await Promise.resolve();
}

function createSelect(
  family: (typeof families)[number],
  full: boolean,
  selected: string,
  position: 'popper' | 'item-aligned' = 'popper'
) {
  const element = (role: string) => document.createElement(`${family.name}-select-${role}`) as any;
  const root = element('root');
  const trigger = element('trigger');
  const content = element('content');
  const items = ['alpha', 'disabled', 'beta', 'gamma'].map((value) => {
    const item = element('item');
    setElementProps(item, { value, textValue: value, disabled: value === 'disabled' });
    if (full) {
      const text = document.createElement('base-select-item-text');
      text.textContent = value;
      item.append(text);
    } else item.textContent = value;
    return item;
  });
  setElementProps(root, { defaultValue: selected });
  setElementProps(content, { position });
  trigger.append(element('value'));
  if (full) {
    const surface = document.createElement('base-select-surface');
    const viewport = document.createElement('base-select-viewport');
    viewport.append(...items);
    surface.append(viewport);
    content.append(surface);
  } else content.append(...items);
  root.append(trigger, content);
  document.body.append(root);
  return { root, trigger, content, items };
}

afterEach(async () => {
  document.body.replaceChildren();
  await Promise.resolve();
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe.each(families)('$name Select popper host focus scroll policy', (family) => {
  describe.each([false, true])('complete structural parts = %s', (full) => {
    it.each([
      { value: 'gamma', entry: 'selected-or-first', target: 3 },
      { value: '', entry: 'selected-or-last', target: 3 },
      { value: 'disabled', entry: 'selected-or-first', target: 0 },
    ] as const)(
      'reveals the eligible entry for $value / $entry',
      async ({ value, entry, target }) => {
        // P-BASE-SELECT-CONTENT-A11Y. Actual native scrolling is covered by the
        // Calendar/Select browser journeys; this test observes the owning policy
        // reaching the real Adapter host focus method, without simulating layout.
        vi.useFakeTimers();
        const f = createSelect(family, full, value);
        await settle();
        const focus = vi.spyOn(f.items[target] as HTMLElement, 'focus');
        f.trigger.focus();
        f.root.getExposes().requestOpen({
          open: true,
          reason: 'scroll-entry-regression',
          focusReason: 'keyboard',
          entry,
        });
        await settle();

        expect(document.activeElement).toBe(f.items[target]);
        expect(focus).toHaveBeenCalled();
        expect(focus).toHaveBeenCalledWith({ preventScroll: false });
        for (const [options] of focus.mock.calls) expect(options?.preventScroll).not.toBe(true);
        expect(f.root.getExposes().value.get()).toBe(value);
        expect(f.items[1].getAttribute('aria-disabled')).toBe('true');

        // The next genuine open cycle has the same reveal policy, rather than
        // inheriting a stale request from the previous portal/view epoch.
        f.items[target].dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        await settle();
        expect(f.root.getExposes().open.get()).toBe(false);
        focus.mockClear();
        f.root.getExposes().requestOpen({
          open: true,
          reason: 'scroll-reopen-regression',
          focusReason: 'pointer',
          entry,
        });
        await settle();
        expect(document.activeElement).toBe(f.items[target]);
        expect(focus).toHaveBeenCalled();
        expect(focus).toHaveBeenCalledWith({ preventScroll: false });
        for (const [options] of focus.mock.calls) expect(options?.preventScroll).not.toBe(true);
        expect(f.root.getExposes().value.get()).toBe(value);
      }
    );

    it('reveals a keyboard typeahead match without committing selection', async () => {
      // P-BASE-SELECT-CONTENT-KEYBOARD. Typeahead and Arrow navigation must not
      // disagree about whether a newly focused popper option can be revealed.
      vi.useFakeTimers();
      const f = createSelect(family, full, 'alpha');
      await settle();
      f.trigger.click();
      await settle();
      expect(document.activeElement).toBe(f.items[0]);
      const focus = vi.spyOn(f.items[3] as HTMLElement, 'focus');
      f.items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
      await settle();
      expect(document.activeElement).toBe(f.items[3]);
      expect(focus).toHaveBeenCalled();
      expect(focus).toHaveBeenCalledWith({ preventScroll: false });
      for (const [options] of focus.mock.calls) expect(options?.preventScroll).not.toBe(true);
      expect(f.root.getExposes().value.get()).toBe('alpha');
    });
  });

  it.each([
    { owner: 'item', controlled: false },
    { owner: 'external', controlled: false },
    { owner: 'item', controlled: true },
    { owner: 'external', controlled: true },
  ] as const)(
    'preserves a newer $owner focus owner from openChange (controlled: $controlled)',
    async ({ owner, controlled }) => {
      vi.useFakeTimers();
      const f = createSelect(family, true, 'alpha');
      const external = document.createElement('button');
      document.body.append(external);
      if (controlled) setElementProps(f.root, { open: false });
      await settle();
      f.trigger.focus();
      const selected = vi.spyOn(f.items[0] as HTMLElement, 'focus');
      const target = owner === 'item' ? f.items[2] : external;
      const opened = vi.fn(() => {
        if (controlled) setElementProps(f.root, { open: true });
        target.focus();
      });
      f.root.addEventListener('openChange', opened, { once: true });
      f.root.getExposes().requestOpen({
        open: true,
        reason: 'popper-owner-handoff',
        focusReason: 'programmatic',
      });
      expect(opened).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(target);
      expect(f.root.getExposes().open.get()).toBe(true);
      const earlierCalls = selected.mock.calls.length;

      await settle();

      expect(document.activeElement).toBe(target);
      expect(selected).toHaveBeenCalledTimes(earlierCalls);
      expect(f.root.getExposes().open.get()).toBe(true);
      expect(f.root.getExposes().value.get()).toBe('alpha');

      if (owner === 'item') {
        setElementProps(f.root, { value: 'gamma' });
        await settle();
        expect(document.activeElement).toBe(f.items[3]);
        return;
      }

      if (controlled) setElementProps(f.root, { open: false });
      else
        f.root.getExposes().requestOpen({
          open: false,
          reason: 'popper-owner-handoff-close',
          focusReason: 'programmatic',
        });
      await settle();
      expect(f.root.getExposes().open.get()).toBe(false);
      f.trigger.focus();
      if (controlled) setElementProps(f.root, { open: true });
      else
        f.root.getExposes().requestOpen({
          open: true,
          reason: 'popper-owner-handoff-reopen',
          focusReason: 'programmatic',
        });
      await settle();
      expect(document.activeElement).toBe(f.items[0]);
    }
  );

  it('keeps the existing item-aligned legacy focus scroll policy', async () => {
    vi.useFakeTimers();
    const f = createSelect(family, false, 'gamma', 'item-aligned');
    await settle();
    const focus = vi.spyOn(f.items[3] as HTMLElement, 'focus');
    f.trigger.click();
    await settle();
    expect(document.activeElement).toBe(f.items[3]);
    expect(focus).toHaveBeenCalled();
    for (const [options] of focus.mock.calls) expect(options?.preventScroll).toBe(true);
    expect(f.root.getExposes().value.get()).toBe('gamma');
  });
});
