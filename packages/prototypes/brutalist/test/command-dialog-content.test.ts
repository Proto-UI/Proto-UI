import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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
async function fixture(controlled = false) {
  const root = element(dialogRoot.name, controlled ? { open: true } : {});
  const trigger = element(dialogTrigger.name);
  trigger.textContent = 'Search';
  const content = element(commandDialogContent.name);
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
  document.body.append(root);
  await flush();
  return { root, trigger, content, title, description, command, input, list };
}
describe('Brutalist public CommandDialog content', () => {
  it('keeps its narrowed public surface and direct entry', () => {
    expectTypeOf<keyof CommandDialogContentProps>().toEqualTypeOf<never>();
    expectTypeOf<keyof CommandDialogContentExposes>().toEqualTypeOf<
      'open' | 'transitionState' | 'isPresent'
    >();
    expect(commandDialogContent.name).toBe('brutalist-command-dialog-content');
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
    expect(styles).toContain('border-0');
    expect(styles).not.toContain('border-2');
    expect(styles).toContain('rounded-none');
    expect(styles).toContain('shadow-[4px_4px_0_0_#000]');
    expect(styles).toContain(
      'max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]'
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
});

it('places the sole two-pixel border on the column shell, not a second list panel', async () => {
  const f = await fixture(true);
  const rootTokens = tokens(f.command);
  expect(rootTokens).toEqual(
    expect.arrayContaining(['flex-col', 'h-full', 'min-h-0', 'border-2', 'border-border'])
  );
  for (const token of ['flex-wrap', 'gap-2', 'max-w-md']) expect(rootTokens).not.toContain(token);
  const listTokens = tokens(f.list);
  expect(listTokens).toEqual(
    expect.arrayContaining(['min-h-0', 'max-h-[18.75rem]', 'scroll-py-1', 'overflow-y-auto'])
  );
  expect(listTokens.some((token) => token.startsWith('border') || token.startsWith('shadow'))).toBe(
    false
  );
  expect(listTokens).not.toContain('p-1');
  expect(f.list.id).not.toBe('');
  expect(f.list.getAttribute('role')).toBe('listbox');
  expect(f.input.querySelector('input')!.getAttribute('aria-controls')).toBe(f.list.id);
});
