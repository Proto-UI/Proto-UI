import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/popover';
import * as shadcn from '../../../shadcn/src/popover';
import * as brutalist from '../../../brutalist/src/popover';
import * as bootstrap from '../../../bootstrap-2-3-2/src/popover';
import * as liquid from '../../../liquid-glass/src/popover';
import * as datePicker from '../../src/date-picker';

// Independent oracle: base-popover-entry-focus-scroll.v0.md. These source-host
// tests run the real Runtime/Focus/WC option projection in HappyDOM; they do not
// prove browser scrolling, layout, native pointer delivery, or other Adapters.
const families = [base, shadcn, brutalist, bootstrap, liquid];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const family of families)
  for (const proto of [
    family.popoverRoot,
    family.popoverTrigger,
    family.popoverContent,
    family.popoverTitle,
    family.popoverClose,
  ])
    AdaptToWebComponent(proto, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  vi.restoreAllMocks();
});
type Parts = Pick<
  typeof base,
  'popoverRoot' | 'popoverTrigger' | 'popoverContent' | 'popoverTitle' | 'popoverClose'
>;
function fixture(
  family: Parts = base,
  rootProps: Record<string, unknown> = {},
  initiallyAttach = true
) {
  function element(name: string, props: Record<string, unknown> = {}) {
    const node = document.createElement(name);
    setElementProps(node, props);
    owned.add(node);
    return node;
  }
  const root = element(family.popoverRoot.name, rootProps),
    trigger = element(family.popoverTrigger.name),
    content = element(family.popoverContent.name, { enterDuration: 0, leaveDuration: 0 }),
    title = element(family.popoverTitle.name),
    close = element(family.popoverClose.name),
    outside = element('button');
  title.textContent = 'Settings';
  close.textContent = 'Close';
  trigger.textContent = 'Open';
  content.append(title, close);
  root.append(trigger, content);
  // Spy before first mount, forwarding to the real HTMLElement focus effect.
  const focusObservations: Array<{ options: FocusOptions | undefined; alreadyActive: boolean }> =
    [];
  const nativeFocus = close.focus.bind(close);
  const closeFocus = vi.spyOn(close, 'focus').mockImplementation((options) => {
      focusObservations.push({ options, alreadyActive: document.activeElement === close });
      nativeFocus(options);
    }),
    triggerFocus = vi.spyOn(trigger, 'focus');
  const requests: unknown[] = [];
  root.addEventListener('openChange', (e) => requests.push((e as CustomEvent).detail));
  if (initiallyAttach) document.body.append(root, outside);
  return {
    root,
    trigger,
    content,
    close,
    outside,
    closeFocus,
    triggerFocus,
    requests,
    focusObservations,
  };
}
function expectEntry(p: ReturnType<typeof fixture>) {
  expect(p.closeFocus).toHaveBeenCalled();
  expect(p.focusObservations[0]).toEqual({
    options: { preventScroll: true },
    alreadyActive: false,
  });
  // Existing Focus readiness can re-project an already acquired owner with its
  // own native policy. Any actual acquisition in this opening window must be
  // scroll-preserving; undefined is allowed only while this same target is active.
  for (const call of p.focusObservations)
    if (!call.alreadyActive) expect(call.options).toEqual({ preventScroll: true });
  expect(document.activeElement).toBe(p.close);
  expect(p.trigger.getAttribute('aria-expanded')).toBe('true');
}
describe.each(families.map((family) => [family.popoverRoot.name, family] as const))(
  '%s opening entry policy',
  (_name, family) => {
    it('projects scroll-preserving focus on first open and reopen through the real host', async () => {
      const p = fixture(family);
      await flush();
      expect(p.closeFocus).not.toHaveBeenCalled();
      p.trigger.click();
      await flush();
      expectEntry(p);
      expect(p.requests).toEqual([{ open: true, reason: 'trigger.press', focusReason: 'pointer' }]);
      p.close.click();
      await flush();
      expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(p.trigger);
      expect(p.triggerFocus).toHaveBeenCalledWith(undefined); // restoration policy stays unchanged
      p.closeFocus.mockClear();
      p.focusObservations.length = 0;
      p.trigger.click();
      await flush();
      expectEntry(p);
      expect(p.requests).toEqual([
        { open: true, reason: 'trigger.press', focusReason: 'pointer' },
        { open: false, reason: 'close.press', focusReason: 'pointer' },
        { open: true, reason: 'trigger.press', focusReason: 'pointer' },
      ]);
    });
  }
);
it('applies the same entry option to default-open mounted acquisition', async () => {
  const p = fixture(base, { defaultOpen: true });
  await flush();
  expectEntry(p);
  expect(p.requests).toEqual([]);
});
it('does not focus on a refused controlled open and preserves later owner acceptance', async () => {
  const p = fixture(base, { open: false });
  await flush();
  p.trigger.click();
  await flush();
  expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
  expect(p.closeFocus).not.toHaveBeenCalled();
  expect(p.requests).toEqual([{ open: true, reason: 'trigger.press', focusReason: 'pointer' }]);
  setElementProps(p.root, { open: true });
  await flush();
  expectEntry(p);
});
it('does not reacquire entry for unchanged accepted-open updates', async () => {
  const p = fixture(base, { open: true });
  await flush();
  expectEntry(p);
  p.closeFocus.mockClear();
  setElementProps(p.root, { open: true, a11yLabel: 'Updated settings' });
  await flush();
  expect(p.closeFocus).not.toHaveBeenCalled();
  expect(p.requests).toEqual([]);
});
it('does not rewrite explicit target focus options as a global default', async () => {
  const p = fixture(base, { defaultOpen: true });
  await flush();
  expectEntry(p);
  p.closeFocus.mockClear();
  (p.close as any).getExposes().focusSelf({ reason: 'programmatic' });
  (p.close as any).getExposes().focusSelf({ reason: 'programmatic', preventScroll: false });
  expect(p.closeFocus.mock.calls).toEqual([[undefined], [{ preventScroll: false }]]);
  expect(document.activeElement).toBe(p.close);
});

for (const proto of [
  datePicker.datePickerRoot,
  datePicker.datePickerTrigger,
  datePicker.datePickerContent,
  datePicker.datePickerDay,
  datePicker.datePickerValue,
])
  AdaptToWebComponent(proto, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
it('Date Picker Content inherits entry preservation and Day selection still closes', async () => {
  function make(name: string, props: Record<string, unknown> = {}) {
    const node = document.createElement(name);
    setElementProps(node, props);
    owned.add(node);
    return node;
  }
  const root = make(datePicker.datePickerRoot.name, { defaultValue: '2026-10-01' }),
    trigger = make(datePicker.datePickerTrigger.name),
    content = make(datePicker.datePickerContent.name, { enterDuration: 0, leaveDuration: 0 }),
    day = make(datePicker.datePickerDay.name, { date: '2026-10-12' }),
    value = make(datePicker.datePickerValue.name),
    command = make(base.popoverClose.name);
  command.textContent = 'Close';
  const observations: Array<{ options: FocusOptions | undefined; alreadyActive: boolean }> = [];
  const native = command.focus.bind(command);
  vi.spyOn(command, 'focus').mockImplementation((options) => {
    observations.push({ options, alreadyActive: document.activeElement === command });
    native(options);
  });
  const changes: unknown[] = [];
  root.addEventListener('openChange', (e) => changes.push((e as CustomEvent).detail));
  content.append(command, day);
  root.append(trigger, content, value);
  document.body.append(root);
  await flush();
  trigger.click();
  await flush();
  expect(observations[0]).toEqual({ options: { preventScroll: true }, alreadyActive: false });
  for (const call of observations)
    if (!call.alreadyActive) expect(call.options).toEqual({ preventScroll: true });
  expect(document.activeElement).toBe(command);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  day.click();
  await flush();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  expect((value as any).getExposes().displayValue.get()).toBe('2026-10-12');
  expect(changes).toEqual([
    { open: true, reason: 'trigger.press', focusReason: 'pointer' },
    { open: false, reason: 'date-selection', focusReason: 'pointer' },
  ]);
});
