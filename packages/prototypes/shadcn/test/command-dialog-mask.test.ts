import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogMask } from '../src/dialog';
import { commandDialogMask, type CommandDialogMaskProps } from '../src/command';
for (const prototype of [dialogRoot, dialogMask, commandDialogMask])
  AdaptToWebComponent(prototype as any);
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

it('keeps dedicated transparent paint separate from ordinary DialogMask', async () => {
  expectTypeOf<CommandDialogMaskProps['enterDuration']>().toEqualTypeOf<number>();
  expectTypeOf<CommandDialogMaskProps['leaveDuration']>().toEqualTypeOf<number>();
  const root = document.createElement(dialogRoot.name) as HTMLElement & { getExposes(): any };
  setElementProps(root, { open: true });
  const mask = document.createElement(commandDialogMask.name) as HTMLElement & {
    getExposes(): any;
  };
  setElementProps(mask, { enterDuration: 0, leaveDuration: 0 });
  root.append(mask);
  document.body.append(root);
  await flush();
  const tokens = (mask.getAttribute('data-pui-style') ?? '').split(/\s+/);
  expect(tokens).toEqual(expect.arrayContaining(['fixed', 'inset-0', 'bg-transparent']));
  expect(tokens).not.toContain('bg-background');
  expect(tokens).not.toContain('bg-black/50');
  expect(tokens).not.toContain('backdrop-blur-xs');
  expect(mask.getExposes().isPresent.get()).toBe(true);
  // The mask does not invent a dismiss/open owner. Content owns outside close.
  expect(mask.getExposes().close).toBeUndefined();
  setElementProps(root, { open: false });
  await vi.waitFor(() => expect(mask.getExposes().isPresent.get()).toBe(false));
  expect(dialogMask.name).toBe('shadcn-dialog-mask');
});

it('uses explicit 100ms and updated 0ms host props instead of the 200ms setup fallback', async () => {
  vi.useFakeTimers();
  try {
    const root = document.createElement(dialogRoot.name) as HTMLElement & { getExposes(): any };
    const mask = document.createElement(commandDialogMask.name) as HTMLElement & {
      getExposes(): any;
    };
    setElementProps(root, { open: false });
    setElementProps(mask, { enterDuration: 100, leaveDuration: 100 });
    root.append(mask);
    document.body.append(root);
    await flush();
    setElementProps(root, { open: true });
    await flush();
    await vi.advanceTimersByTimeAsync(99);
    expect(mask.getExposes().transitionState.get()).toBe('entering');
    await vi.advanceTimersByTimeAsync(1);
    expect(mask.getExposes().transitionState.get()).toBe('entered');
    setElementProps(root, { open: false });
    await flush();
    await vi.advanceTimersByTimeAsync(99);
    expect(mask.getExposes().transitionState.get()).toBe('leaving');
    expect(mask.getExposes().isPresent.get()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(mask.getExposes().isPresent.get()).toBe(false);
    // Same retained instance, new public durations; no setup/configure command at runtime.
    setElementProps(mask, { enterDuration: 0, leaveDuration: 0 });
    setElementProps(root, { open: true });
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(mask.getExposes().transitionState.get()).toBe('entered');
    setElementProps(root, { open: false });
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(mask.getExposes().isPresent.get()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
