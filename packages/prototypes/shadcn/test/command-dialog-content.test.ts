import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '../src/style-scope';
import { dialogRoot, dialogTrigger, dialogTitle, dialogDescription } from '../src/dialog';
import {
  commandDialogContent,
  commandRoot,
  commandInput,
  commandContent,
  commandItem,
  type CommandDialogContentProps,
  type CommandDialogContentExposes,
} from '../src/command';

for (const prototype of [
  styleScope,
  dialogRoot,
  dialogTrigger,
  dialogTitle,
  dialogDescription,
  commandDialogContent,
  commandRoot,
  commandInput,
  commandContent,
  commandItem,
])
  AdaptToWebComponent(prototype as any);
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const element = (name: string, props: Record<string, unknown> = {}) => {
  const node = document.createElement(name) as HTMLElement & { getExposes(): any };
  setElementProps(node, props);
  return node;
};
const tokens = (node: Element) => (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});
async function fixture(controlled = false, profile: 'rhea' | 'new-york-v4' = 'rhea') {
  const root = element(dialogRoot.name, controlled ? { open: true } : {});
  const trigger = element(dialogTrigger.name);
  trigger.textContent = 'Search';
  const scope = element(styleScope.name, { styleProfile: profile });
  const duration = profile === 'rhea' ? 100 : 200;
  const content = element(commandDialogContent.name, {
    enterDuration: duration,
    leaveDuration: duration,
  });
  const title = element(dialogTitle.name);
  title.textContent = 'Search documentation';
  const description = element(dialogDescription.name);
  description.textContent = 'Choose a result';
  const command = element(commandRoot.name, { filter: false });
  const input = element(commandInput.name, { a11yLabel: 'Query' });
  const list = element(commandContent.name);
  const item = element(commandItem.name, { value: 'guide', textValue: 'Guide' });
  item.textContent = 'Guide';
  list.append(item);
  command.append(input, list);
  content.append(title, description, command);
  root.append(trigger, content);
  scope.append(root);
  document.body.append(scope);
  await flush();
  return { scope, root, trigger, content, title, description, command, input };
}
describe('Shadcn public CommandDialog content', () => {
  it('keeps its narrowed public surface and direct entry', () => {
    expectTypeOf<CommandDialogContentProps['enterDuration']>().toEqualTypeOf<number>();
    expectTypeOf<CommandDialogContentProps['leaveDuration']>().toEqualTypeOf<number>();
    expectTypeOf<keyof CommandDialogContentExposes>().toEqualTypeOf<
      'open' | 'transitionState' | 'isPresent'
    >();
    expect(commandDialogContent.name).toBe('shadcn-command-dialog-content');
  });
  it('uses one Dialog owner and original command editor through close and reentry', async () => {
    const f = await fixture();
    const editor = f.input.querySelector('input');
    expect(editor).not.toBeNull();
    f.trigger.focus();
    f.trigger.click();
    await flush();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getAttribute('role')).toBe('dialog');
    expect(f.content.getAttribute('aria-labelledby')).toContain(f.title.id);
    expect(f.content.getAttribute('aria-describedby')).toContain(f.description.id);
    expect(f.title.id).not.toBe('');
    expect(f.description.id).not.toBe('');
    expect(f.content.contains(document.activeElement)).toBe(true);
    const styles = tokens(f.content);
    expect(styles).toContain('p-0');
    expect(styles).not.toContain('p-6');
    expect(styles).toContain('rounded-[var(--pui-radius-3xl)]');
    expect(styles).toContain('shadow-xl');
    expect(styles).not.toContain('rounded-lg');
    expect(styles).toContain(
      'max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]'
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(f.root.getExposes().open.get()).toBe(false);
    await vi.waitFor(() => expect(f.content.getExposes().isPresent.get()).toBe(false));
    await vi.waitFor(() => expect(document.activeElement).toBe(f.trigger));
    f.trigger.click();
    await flush();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.input.querySelector('input')).toBe(editor);
  });
  it('does not override a controlled owner refusing dismissal', async () => {
    const f = await fixture(true);
    const requests: unknown[] = [];
    f.root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(requests).toEqual([expect.objectContaining({ open: false, reason: 'escape' })]);
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getExposes().isPresent.get()).toBe(true);
  });
  it('reverses an interrupted close without replacing the content or editor', async () => {
    const f = await fixture(true);
    const editor = f.input.querySelector('input');
    expect(editor).not.toBeNull();
    setElementProps(f.root, { open: false });
    await flush();
    setElementProps(f.root, { open: true });
    await flush();
    await vi.waitFor(() => expect(f.content.getExposes().transitionState.get()).toBe('entered'));
    expect(f.content.getExposes().isPresent.get()).toBe(true);
    expect(f.input.querySelector('input')).toBe(editor);
  });
  it('does not add CSS motion with a reduced-motion preference', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          onchange: null,
          dispatchEvent: () => true,
        }) as MediaQueryList
    );
    const f = await fixture(true);
    expect(tokens(f.content)).not.toContain('animate-in');
    expect(tokens(f.content)).not.toContain('zoom-in-95');
    setElementProps(f.root, { open: false });
    await flush();
    expect(tokens(f.content)).not.toContain('animate-out');
    await vi.waitFor(() => expect(f.content.getExposes().isPresent.get()).toBe(false));
  });
  it('explicit Content profile overrides the outer scope, not an inner CommandRoot', async () => {
    const f = await fixture(true, 'new-york-v4');
    setElementProps(f.content, { styleProfile: 'rhea', enterDuration: 100, leaveDuration: 100 });
    setElementProps(f.command, { styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(f.content)).toContain('rounded-[var(--pui-radius-3xl)]');
    expect(tokens(f.content)).not.toContain('rounded-lg');
    expect(tokens(f.command)).not.toContain('rounded-[var(--pui-radius-3xl)]');
  });

  it('updates profile and required duration props from one selection without replacing owners', async () => {
    vi.useFakeTimers();
    try {
      const f = await fixture(false, 'new-york-v4');
      const editor = f.input.querySelector('input');
      expect(editor).not.toBeNull();
      // Consumer-owned profile projection: bind the public timings before open.
      setElementProps(f.scope, { styleProfile: 'rhea' });
      setElementProps(f.content, { enterDuration: 100, leaveDuration: 100 });
      await flush();
      f.trigger.click();
      await flush();
      expect(tokens(f.content)).toContain('duration-100');
      expect(tokens(f.content)).not.toContain('duration-200');
      await vi.advanceTimersByTimeAsync(99);
      expect(f.content.getExposes().transitionState.get()).toBe('entering');
      await vi.advanceTimersByTimeAsync(1);
      expect(f.content.getExposes().transitionState.get()).toBe('entered');
      setElementProps(f.scope, { styleProfile: 'new-york-v4' });
      setElementProps(f.content, { enterDuration: 200, leaveDuration: 200 });
      await flush();
      expect(tokens(f.content)).toContain('duration-200');
      expect(tokens(f.content)).not.toContain('duration-100');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      await vi.advanceTimersByTimeAsync(199);
      expect(f.content.getExposes().transitionState.get()).toBe('leaving');
      await vi.advanceTimersByTimeAsync(1);
      expect(f.content.getExposes().isPresent.get()).toBe(false);
      expect(f.input.querySelector('input')).toBe(editor);
    } finally {
      vi.useRealTimers();
    }
  });
});
