import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '../src/style-scope';
import * as dialog from '../src/dialog';
import * as alert from '../src/alert-dialog';
import * as drawer from '../src/drawer';
import * as hover from '../src/hover-card';
import * as popover from '../src/popover';
import * as tooltip from '../src/tooltip';
import * as toast from '../src/toast';

const prototypes = [
  styleScope,
  dialog.dialogRoot,
  dialog.dialogTrigger,
  dialog.dialogContent,
  dialog.dialogTitle,
  dialog.dialogDescription,
  dialog.dialogClose,
  dialog.dialogCloseIcon,
  alert.alertDialogRoot,
  alert.alertDialogMask,
  alert.alertDialogContent,
  alert.alertDialogTitle,
  alert.alertDialogDescription,
  alert.alertDialogCancel,
  alert.alertDialogAction,
  drawer.drawerRoot,
  drawer.drawerContent,
  drawer.drawerHeader,
  drawer.drawerTitle,
  drawer.drawerHandle,
  drawer.drawerTrigger,
  drawer.drawerClose,
  hover.hoverCardRoot,
  hover.hoverCardTrigger,
  hover.hoverCardContent,
  popover.popoverRoot,
  popover.popoverTrigger,
  popover.popoverContent,
  popover.popoverTitle,
  popover.popoverClose,
  tooltip.ShadcnTooltipGroup,
  tooltip.ShadcnTooltipRoot,
  tooltip.ShadcnTooltipTrigger,
  tooltip.ShadcnTooltipContent,
  toast.toastViewport,
  toast.toastRoot,
  toast.toastTitle,
  toast.toastDescription,
  toast.toastAction,
];
for (const prototype of prototypes) {
  if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
}
// All queried owners in this fixture expose the same read-only Boolean open
// handle; the consumer tests do not acquire an internal State writer.
type LiveElement = HTMLElement & { getExposes(): { open: { get(): boolean } } };
const owned = new Set<HTMLElement>();
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
const element = (name: string, props: Record<string, unknown> = {}) => {
  const node = document.createElement(name) as LiveElement;
  setElementProps(node, props);
  owned.add(node);
  return node;
};
const tokens = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await flush();
});

// Expected tokens are directly bound to the immutable 3d98900e9b73 style CSS;
// New York is the separately pinned f31ed819 Dialog source. This is a source
// host/Rule test, not a native-paint or upstream runtime comparison.
const dialogCases = [
  ['vega', 'rounded-xl', 'p-6', 'gap-6'],
  ['nova', 'rounded-xl', 'p-4', 'gap-4'],
  ['maia', 'rounded-[var(--pui-radius-4xl)]', 'p-6', 'ring-foreground/5'],
  ['lyra', 'rounded-none', 'p-4', 'text-xs'],
  ['mira', 'rounded-xl', 'p-4', 'text-xs'],
  ['luma', 'rounded-[var(--pui-radius-4xl)]', 'p-6', 'shadow-xl'],
  ['sera', 'rounded-none', 'p-6', 'shadow-md'],
  ['rhea', 'rounded-[min(var(--pui-radius-4xl),24px)]', 'p-6', 'shadow-xl'],
  ['new-york-v4', 'rounded-lg', 'p-6', 'bg-background'],
] as const;
const popoverCases = [
  ['vega', 'rounded-md', 'p-4', 'gap-4'],
  ['nova', 'rounded-lg', 'p-2.5', 'gap-2.5'],
  ['maia', 'rounded-[var(--pui-radius-2xl)]', 'p-4', 'shadow-2xl'],
  ['lyra', 'rounded-none', 'p-2.5', 'text-xs'],
  ['mira', 'rounded-lg', 'p-2.5', 'text-xs'],
  ['luma', 'rounded-[var(--pui-radius-3xl)]', 'p-4', 'shadow-lg'],
  ['sera', 'rounded-none', 'p-4', 'gap-4'],
  ['rhea', 'rounded-[var(--pui-radius-3xl)]', 'p-4', 'shadow-lg'],
  ['new-york-v4', 'rounded-md', 'p-4', 'border-border'],
] as const;

describe('source-bound overlay style owners', () => {
  it.each(dialogCases)(
    '%s paints a live Dialog and withdraws its old profile without replacing the owner',
    async (profile, radius, padding, distinctive) => {
      const scope = element(styleScope.name, { styleProfile: profile });
      const root = element(dialog.dialogRoot.name, { open: true });
      const trigger = element(dialog.dialogTrigger.name);
      const content = element(dialog.dialogContent.name);
      const title = element(dialog.dialogTitle.name);
      const description = element(dialog.dialogDescription.name);
      const close = element(dialog.dialogClose.name);
      title.textContent = 'Review';
      description.textContent = 'The owner decides';
      trigger.textContent = 'Open';
      close.textContent = 'Close';
      content.append(title, description, close);
      root.append(trigger, content);
      scope.append(root);
      document.body.append(scope);
      await flush();

      const open = root.getExposes().open;
      const contentState = content.getExposes().open;
      expect(open.get()).toBe(true);
      expect(content.getAttribute('role')).toBe('dialog');
      expect(content.getAttribute('aria-labelledby')).toBe(title.id);
      expect(content.getAttribute('aria-describedby')).toBe(description.id);
      expect(tokens(content)).toEqual(expect.arrayContaining([radius, padding, distinctive]));
      expect(trigger.getAttribute('data-pui-style')).toBeNull();
      expect(close.getAttribute('data-pui-style')).toBeNull();

      setElementProps(scope, { styleProfile: 'lyra' });
      await flush();
      expect(root.getExposes().open).toBe(open);
      expect(content.getExposes().open).toBe(contentState);
      expect(open.get()).toBe(true);
      expect(content.getAttribute('aria-labelledby')).toBe(title.id);
      expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-none', 'p-4', 'text-xs']));
      if (radius !== 'rounded-none') expect(tokens(content)).not.toContain(radius);
      if (padding !== 'p-4') expect(tokens(content)).not.toContain(padding);
    }
  );

  it('retains controlled Dialog refusal and a single close request across profile change', async () => {
    const scope = element(styleScope.name, { styleProfile: 'nova' });
    const root = element(dialog.dialogRoot.name, { open: true });
    const content = element(dialog.dialogContent.name);
    const title = element(dialog.dialogTitle.name);
    const description = element(dialog.dialogDescription.name);
    const close = element(dialog.dialogCloseIcon.name);
    title.textContent = 'Controlled';
    description.textContent = 'Refusal';
    content.append(title, description, close);
    root.append(content);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    const requests: Array<{ open: boolean }> = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    const icon = close.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(tokens(close)).toContain('size-7');
    setElementProps(scope, { styleProfile: 'sera' });
    await flush();
    expect(close.querySelector('svg')).toBe(icon);
    expect(tokens(close)).toEqual(expect.arrayContaining(['size-9', 'top-5', 'rounded-none']));
    expect(tokens(close)).not.toContain('size-7');
    close.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].open).toBe(false);
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
    setElementProps(root, { open: true, disabled: true });
    await flush();
    close.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(open.get()).toBe(true);
  });

  it('preserves AlertDialog command ownership and independently withdrawn action paint', async () => {
    const scope = element(styleScope.name, { styleProfile: 'maia' });
    const root = element(alert.alertDialogRoot.name, { open: true });
    const mask = element(alert.alertDialogMask.name);
    const content = element(alert.alertDialogContent.name);
    const title = element(alert.alertDialogTitle.name);
    const description = element(alert.alertDialogDescription.name);
    const cancel = element(alert.alertDialogCancel.name);
    const action = element(alert.alertDialogAction.name);
    title.textContent = 'Confirm';
    description.textContent = 'A controlled request';
    cancel.textContent = 'Cancel';
    action.textContent = 'Continue';
    content.append(title, description, cancel, action);
    root.append(mask, content);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    const requests: Array<{ open: boolean }> = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    expect(tokens(content)).toContain('rounded-[var(--pui-radius-4xl)]');
    expect(tokens(mask)).toContain('bg-black/80');
    expect(tokens(action)).toEqual(expect.arrayContaining(['bg-primary', 'h-9', 'px-3']));
    expect(tokens(cancel)).toContain('bg-input/30');
    setElementProps(scope, { styleProfile: 'new-york' });
    await flush();
    expect(tokens(content)).toContain('rounded-lg');
    expect(tokens(content)).not.toContain('rounded-[var(--pui-radius-4xl)]');
    expect(tokens(mask)).toContain('bg-black/50');
    expect(tokens(mask)).not.toContain('bg-black/80');
    expect(tokens(action)).toEqual(expect.arrayContaining(['h-9', 'px-4', 'py-2']));
    expect(tokens(action)).not.toContain('px-3');
    action.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].open).toBe(false);
    expect(open.get()).toBe(true);
    setElementProps(cancel, { disabled: true });
    await flush();
    cancel.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(root.getExposes().open).toBe(open);
  });

  it('keeps Drawer accepted-side observation, owned decoration and authored slots distinct', async () => {
    const scope = element(styleScope.name, { styleProfile: 'maia' });
    const root = element(drawer.drawerRoot.name, { defaultOpen: true });
    const content = element(drawer.drawerContent.name, {
      side: 'bottom',
      enterDuration: 0,
      leaveDuration: 0,
    });
    const header = element(drawer.drawerHeader.name);
    const title = element(drawer.drawerTitle.name);
    const handle = element(drawer.drawerHandle.name);
    title.textContent = 'Drawer title';
    header.append(title);
    content.append(handle, header);
    root.append(content);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    const leaf = content.querySelector<HTMLElement>('[data-pui-owned-decoration]');
    expect(leaf).not.toBeNull();
    expect(leaf!.getAttribute('aria-hidden')).toBe('true');
    expect(leaf!.hasAttribute('inert')).toBe(true);
    expect(tokens(leaf!)).toContain('rounded-[var(--pui-radius-4xl)]');
    expect(tokens(header)).toContain('text-center');
    expect(tokens(handle)).toContain('h-1.5');
    expect(header.contains(title)).toBe(true);
    setElementProps(scope, { styleProfile: 'lyra' });
    await flush();
    expect(content.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
    expect(tokens(leaf!)).not.toContain('rounded-[var(--pui-radius-4xl)]');
    expect(tokens(content)).toContain('rounded-none');
    expect(tokens(handle)).toEqual(expect.arrayContaining(['h-1', 'rounded-none']));
    expect(tokens(handle)).not.toContain('h-1.5');
    expect(root.getExposes().open).toBe(open);
    expect(header.contains(title)).toBe(true);
    setElementProps(content, { side: 'diagonal', enterDuration: 0, leaveDuration: 0 });
    await flush();
    expect(tokens(header)).toContain('text-center');
    expect(tokens(handle)).toContain('w-[100px]');
    setElementProps(content, { side: 'left', enterDuration: 0, leaveDuration: 0 });
    await flush();
    expect(tokens(header)).not.toContain('text-center');
    expect(tokens(handle)).not.toContain('w-[100px]');
    expect(root.getExposes().open).toBe(open);
  });

  it('keeps Popover Nova default and New York explicit typography while retaining its controlled owner', async () => {
    const scope = element(styleScope.name);
    const root = element(popover.popoverRoot.name, { open: true });
    const trigger = element(popover.popoverTrigger.name);
    const content = element(popover.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
    const title = element(popover.popoverTitle.name);
    const close = element(popover.popoverClose.name);
    trigger.textContent = 'Open';
    title.textContent = 'Preferences';
    close.textContent = 'Close';
    content.append(title, close);
    root.append(trigger, content);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    const requests: Array<{ open: boolean }> = [];
    root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
    expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-lg', 'p-2.5', 'text-sm']));
    expect(tokens(trigger)).toEqual(expect.arrayContaining(['h-8', 'px-2.5']));
    expect(tokens(title)).toContain('font-medium');
    expect(tokens(title)).not.toContain('text-sm');
    setElementProps(scope, { styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-md', 'p-4', 'border-border']));
    expect(tokens(content)).not.toContain('p-2.5');
    expect(tokens(title)).not.toContain('text-sm');
    close.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].open).toBe(false);
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
  });

  it.each(popoverCases)(
    '%s applies the pinned Popover surface without replacing its open owner',
    async (profile, radius, padding, distinctive) => {
      const scope = element(styleScope.name, { styleProfile: profile });
      const root = element(popover.popoverRoot.name, { open: true });
      const trigger = element(popover.popoverTrigger.name);
      const content = element(popover.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
      const title = element(popover.popoverTitle.name);
      title.textContent = 'Settings';
      content.append(title);
      root.append(trigger, content);
      scope.append(root);
      document.body.append(scope);
      await flush();
      const open = root.getExposes().open;
      expect(tokens(content)).toEqual(expect.arrayContaining([radius, padding, distinctive]));
      expect(content.getAttribute('aria-labelledby')).toBe(title.id);
      setElementProps(scope, { styleProfile: 'lyra' });
      await flush();
      expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-none', 'p-2.5', 'text-xs']));
      if (radius !== 'rounded-none') expect(tokens(content)).not.toContain(radius);
      if (padding !== 'p-2.5') expect(tokens(content)).not.toContain(padding);
      expect(content.getAttribute('aria-labelledby')).toBe(title.id);
      expect(root.getExposes().open).toBe(open);
      expect(open.get()).toBe(true);
    }
  );

  it('retains HoverCard preview ownership while explicit style withdrawal restores the inherited New York typography', async () => {
    const scope = element(styleScope.name, { styleProfile: 'lyra' });
    const root = element(hover.hoverCardRoot.name, { open: true });
    const trigger = element(hover.hoverCardTrigger.name);
    const content = element(hover.hoverCardContent.name, { side: 'right' });
    trigger.textContent = 'Preview';
    content.textContent = 'Supplementary content';
    root.append(trigger, content);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    expect(trigger.getAttribute('role')).not.toBe('button');
    expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-none', 'p-2.5', 'text-xs']));
    setElementProps(content, { side: 'right', styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(content)).toEqual(expect.arrayContaining(['rounded-md', 'p-4', 'w-64']));
    expect(tokens(content)).not.toContain('text-xs');
    expect(tokens(content)).not.toContain('text-sm');
    setElementProps(content, { side: 'right' });
    await flush();
    expect(tokens(content)).toContain('rounded-none');
    expect(tokens(content)).not.toContain('rounded-md');
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
  });

  it('keeps Tooltip default Nova provenance and Root semantics when selecting New York', async () => {
    const scope = element(styleScope.name);
    const group = element(tooltip.ShadcnTooltipGroup.name);
    const root = element(tooltip.ShadcnTooltipRoot.name, { open: true });
    const trigger = element(tooltip.ShadcnTooltipTrigger.name);
    const content = element(tooltip.ShadcnTooltipContent.name);
    trigger.textContent = 'Help';
    content.textContent = 'An explanation';
    root.append(trigger, content);
    group.append(root);
    scope.append(group);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(tokens(content)).toEqual(expect.arrayContaining(['max-w-80', 'inline-flex', 'gap-1.5']));
    setElementProps(scope, { styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(content)).toContain('text-balance');
    expect(tokens(content)).not.toContain('max-w-80');
    expect(tokens(content)).not.toContain('gap-1.5');
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.querySelector('svg')).toBeNull();
  });

  it('keeps Toast action order, controlled refusal and timer state across its radius switch', async () => {
    const scope = element(styleScope.name, { styleProfile: 'lyra' });
    const viewport = element(toast.toastViewport.name);
    const root = element(toast.toastRoot.name, { open: true, duration: 0 });
    const title = element(toast.toastTitle.name);
    const description = element(toast.toastDescription.name);
    const action = element(toast.toastAction.name);
    title.textContent = 'Saved';
    description.textContent = 'Your work is saved';
    action.textContent = 'Undo';
    root.append(title, description, action);
    viewport.append(root);
    scope.append(viewport);
    document.body.append(scope);
    await flush();
    const open = root.getExposes().open;
    const order: string[] = [];
    action.addEventListener('action', () => order.push('action'));
    root.addEventListener('openChange', () => order.push('openChange'));
    expect(root.getAttribute('role')).toBe('status');
    expect(tokens(root)).toEqual(expect.arrayContaining(['rounded-none', 'bg-popover']));
    setElementProps(scope, { styleProfile: 'rhea' });
    await flush();
    expect(tokens(root)).toContain('rounded-[var(--pui-radius-2xl)]');
    expect(tokens(root)).not.toContain('rounded-none');
    action.click();
    await flush();
    expect(order).toEqual(['action', 'openChange']);
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
    expect(root.getAttribute('role')).toBe('status');
    setElementProps(scope, {});
    await flush();
    expect(tokens(root)).toEqual(
      expect.arrayContaining(['rounded-md', 'bg-background', 'text-foreground'])
    );
    expect(tokens(root)).not.toContain('rounded-[var(--pui-radius-2xl)]');
    expect(tokens(root)).not.toContain('bg-popover');
    setElementProps(scope, { styleProfile: 'new-york-v4' });
    await flush();
    expect(tokens(root)).toEqual(
      expect.arrayContaining(['rounded-base', 'bg-popover', 'text-popover-foreground'])
    );
    expect(tokens(root)).not.toContain('rounded-md');
    expect(root.getExposes().open).toBe(open);
    expect(order).toEqual(['action', 'openChange']);
  });
});
