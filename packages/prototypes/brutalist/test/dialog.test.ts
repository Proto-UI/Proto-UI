import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  dialogClose,
  dialogCloseIcon,
  dialogContent,
  dialogDescription,
  dialogFooter,
  dialogHeader,
  dialogMask,
  dialogRoot,
  dialogTitle,
  dialogTrigger,
} from '../src/dialog';
import { brutalistButton } from '../src/button';
import type {
  BrutalistDialogContentExposes,
  BrutalistDialogContentProps,
  BrutalistDialogMaskExposes,
  BrutalistDialogMaskProps,
} from '../src/dialog';

type DialogRootElement = WebComponentAdapterElement<typeof dialogRoot>;
type DialogTriggerElement = WebComponentAdapterElement<typeof dialogTrigger>;
type DialogMaskElement = WebComponentAdapterElement<typeof dialogMask> & {
  setProps(next: Record<string, unknown>): void;
};
type DialogContentElement = WebComponentAdapterElement<typeof dialogContent>;
type DialogTitleElement = WebComponentAdapterElement<typeof dialogTitle>;
type DialogDescriptionElement = WebComponentAdapterElement<typeof dialogDescription>;
type DialogCloseElement = WebComponentAdapterElement<typeof dialogClose>;
type DialogCloseIconElement = WebComponentAdapterElement<typeof dialogCloseIcon>;
type DialogHeaderElement = WebComponentAdapterElement<typeof dialogHeader>;
type DialogFooterElement = WebComponentAdapterElement<typeof dialogFooter>;

for (const prototype of [
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  dialogCloseIcon,
  dialogHeader,
  dialogFooter,
]) {
  AdaptToWebComponent(prototype);
}
AdaptToWebComponent(brutalistButton);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function createDialog(options?: {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  mask?: Record<string, unknown>;
  close?: Record<string, unknown>;
  closeIcon?: Record<string, unknown>;
}) {
  const root = document.createElement(dialogRoot.name) as DialogRootElement;
  const trigger = document.createElement(dialogTrigger.name) as DialogTriggerElement;
  const mask = document.createElement(dialogMask.name) as DialogMaskElement;
  const content = document.createElement(dialogContent.name) as DialogContentElement;
  const title = document.createElement(dialogTitle.name) as DialogTitleElement;
  const description = document.createElement(dialogDescription.name) as DialogDescriptionElement;
  const close = document.createElement(dialogClose.name) as DialogCloseElement;
  const closeIcon = document.createElement(dialogCloseIcon.name) as DialogCloseIconElement;
  const header = document.createElement(dialogHeader.name) as DialogHeaderElement;
  const footer = document.createElement(dialogFooter.name) as DialogFooterElement;

  setElementProps(root, options?.root ?? {});
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(mask, options?.mask ?? {});
  setElementProps(close, options?.close ?? {});
  setElementProps(closeIcon, options?.closeIcon ?? {});
  trigger.textContent = 'Open dialog';
  title.textContent = 'Settings';
  description.textContent = 'Manage your preferences.';
  close.textContent = 'Cancel';
  header.append(title, description);
  footer.appendChild(close);
  content.append(header, footer, closeIcon);
  root.append(trigger, mask, content);
  document.body.appendChild(root);

  return {
    root,
    trigger,
    mask,
    content,
    title,
    description,
    close,
    closeIcon,
    header,
    footer,
  };
}

afterEach(async () => {
  document.body.replaceChildren();
  document.body.style.overflow = '';
  await flush();
  vi.useRealTimers();
});

describe('prototypes/brutalist: dialog', () => {
  it('projects Root ownership and Trigger pair/interactions without inventing Root command state', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-1
    // T-BRUTALIST-DIALOG-0001-CASE-2
    vi.useFakeTimers();
    const { root, trigger } = createDialog();
    await flush();

    expect(dialogRoot.name).toBe('brutalist-dialog-root');
    expect(root.getExposes().open.get()).toBe(false);
    expect(root.getExposes()).not.toHaveProperty('value');
    for (const token of ['relative', 'inline-flex', 'items-start']) {
      expect(styleContains(root, token)).toBe(true);
    }
    expect(styleContains(root, 'border-2')).toBe(false);
    expect(styleContains(root, 'shadow-[3px_3px_0_0_#000]')).toBe(false);

    expect(dialogTrigger.name).toBe('brutalist-dialog-trigger');
    expect(trigger.getAttribute('role')).toBe('button');
    for (const token of [
      'rounded-none',
      'border-2',
      'border-black',
      'bg-sky',
      'text-sky-foreground',
      'font-bold',
      'uppercase',
      'h-10',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(trigger, token)).toBe(true);
    }
    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().hovered.get()).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:-translate-x-px')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().pressed.get()).toBe(true);
    expect(styleContains(trigger, 'data-[pressed]:shadow-none')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(trigger, 'matches').mockReturnValue(true);
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-2')).toBe(true);

    setElementProps(trigger, { disabled: true });
    await flush();
    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(trigger.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().open.get()).toBe(false);
    expect(styleContains(trigger, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(trigger, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(trigger, 'bg-sky')).toBe(true);
    expect(styleContains(trigger, 'text-sky-foreground')).toBe(true);
  });

  it('keeps Mask and Content present through their configured fade transitions', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-3
    // T-BRUTALIST-DIALOG-0001-CASE-4
    vi.useFakeTimers();
    const { root, trigger, mask, content } = createDialog({ mask: { passthrough: true } });
    await flush();

    expectTypeOf<BrutalistDialogMaskProps>().toEqualTypeOf<{ passthrough?: boolean }>();
    expectTypeOf<keyof BrutalistDialogMaskExposes>().toEqualTypeOf<
      'transitionState' | 'isPresent'
    >();
    expectTypeOf<keyof BrutalistDialogContentProps>().toEqualTypeOf<never>();
    expectTypeOf<keyof BrutalistDialogContentExposes>().toEqualTypeOf<
      'open' | 'transitionState' | 'isPresent'
    >();
    expect(root.getExposes().open.get()).toBe(false);
    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().transitionState.get()).toBe('closed');

    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    expect(mask.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(mask.getExposes().isPresent.get()).toBe(true);
    expect(content.getExposes().isPresent.get()).toBe(true);
    expect(mask.style.pointerEvents).toBe('none');
    for (const token of ['fixed', 'inset-0', 'bg-overlay', 'animate-in', 'fade-in-0']) {
      expect(styleContains(mask, token)).toBe(true);
    }
    for (const forbidden of ['backdrop-blur', 'zoom-in-95', 'border-2', 'shadow-lg']) {
      expect(styleContains(mask, forbidden)).toBe(false);
    }
    for (const token of [
      'fixed',
      'left-1/2',
      'top-1/2',
      'grid',
      'max-w-lg',
      'p-6',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-secondary-background',
      'text-foreground',
      'shadow-[3px_3px_0_0_#000]',
      'data-[open]:animate-in',
      'data-[open]:fade-in-0',
      'data-[open]:zoom-in-95',
    ]) {
      expect(
        styleContains(content, token),
        `${token} :: ${content.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    await vi.advanceTimersByTimeAsync(149);
    await flush();
    expect(mask.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().transitionState.get()).toBe('entering');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(mask.getExposes().transitionState.get()).toBe('entered');
    expect(content.getExposes().transitionState.get()).toBe('entering');
    await vi.advanceTimersByTimeAsync(50);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('entered');

    mask.setProps({ passthrough: false });
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    expect(mask.style.pointerEvents).toBe('');
    root.getExposes().close('test.close');
    await flush();
    expect(mask.getExposes().transitionState.get()).toBe('leaving');
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(styleContains(mask, 'animate-out')).toBe(true);
    expect(styleContains(mask, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'animate-out')).toBe(true);
    expect(styleContains(content, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'zoom-out-95')).toBe(true);
    await vi.advanceTimersByTimeAsync(149);
    await flush();
    expect(mask.getExposes().transitionState.get()).toBe('leaving');
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(mask.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await vi.advanceTimersByTimeAsync(50);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('projects live Title/Description relations and a functional bare Close', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-5
    // T-BRUTALIST-DIALOG-0001-CASE-6
    // T-BRUTALIST-DIALOG-0001-CASE-7
    vi.useFakeTimers();
    const { root, trigger, content, title, description, close } = createDialog({
      root: { a11yLabel: 'Settings dialog' },
    });
    await flush();

    for (const token of ['font-bold', 'uppercase', 'tracking-tight', 'text-foreground']) {
      expect(styleContains(title, token)).toBe(true);
    }
    for (const token of ['font-mono', 'text-sm', 'text-foreground']) {
      expect(styleContains(description, token)).toBe(true);
    }

    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(description.id);
    expect(content.hasAttribute('aria-label')).toBe(false);

    expect(dialogClose.name).toBe('brutalist-dialog-close');
    expect(close.getAttribute('role')).toBe('button');
    expect(close.textContent).toBe('Cancel');
    expect(close.hasAttribute('data-pui-style')).toBe(false);
    close.click();
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
  });

  it('renders a named canary Close Icon that closes and respects disabled state', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-8
    vi.useFakeTimers();
    const { root, trigger, closeIcon } = createDialog();
    await flush();

    expect(dialogCloseIcon.name).toBe('brutalist-dialog-close-icon');
    expect(closeIcon.getAttribute('role')).toBe('button');
    expect(closeIcon.getAttribute('aria-label')).toBe('Close');
    for (const token of [
      'absolute',
      'right-4',
      'top-4',
      'size-9',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-canary',
      'text-canary-foreground',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(closeIcon, token)).toBe(true);
    }
    // Canary is a fixed accent, so the glyph takes its paired foreground; the
    // theme-global one flips to near-white and disappears on the yellow square.
    expect(styleContains(closeIcon, 'text-foreground')).toBe(false);
    expect(
      Array.from(closeIcon.querySelectorAll('path')).map((path) => path.getAttribute('d'))
    ).toEqual(['M18 6 6 18', 'm6 6 12 12']);
    closeIcon.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(closeIcon.getExposes().hovered.get()).toBe(true);
    expect(styleContains(closeIcon, 'data-[hovered]:bg-coral')).toBe(true);
    expect(styleContains(closeIcon, 'data-[hovered]:text-coral-foreground')).toBe(true);
    expect(styleContains(closeIcon, 'data-[hovered]:shadow-[4px_4px_0_0_#000]')).toBe(true);

    setElementProps(closeIcon, { disabled: true });
    await flush();
    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    closeIcon.click();
    await flush();
    expect(closeIcon.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(closeIcon, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(closeIcon, 'data-[disabled]:opacity-50')).toBe(true);

    setElementProps(closeIcon, { disabled: false });
    await flush();
    closeIcon.click();
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('retains Header and Footer slot content on their ruled anatomy surfaces', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-9
    // T-BRUTALIST-DIALOG-0001-CASE-10
    vi.useFakeTimers();
    const { trigger, header, footer, title, description, close } = createDialog();
    await flush();
    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();

    expect(dialogHeader.name).toBe('brutalist-dialog-header');
    expect(header.contains(title)).toBe(true);
    expect(header.contains(description)).toBe(true);
    for (const token of ['grid', 'gap-1', 'border-b-2', 'border-foreground', 'pb-3', 'text-left']) {
      expect(
        styleContains(header, token),
        `${token} :: ${header.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    expect(styleContains(header, 'border-black')).toBe(false);
    // Section separators resolve the theme foreground, so a theme change
    // repaints them with the panel instead of leaving fixed black.
    expect(styleContains(header, 'brutalist-border-bottom-black')).toBe(false);

    expect(dialogFooter.name).toBe('brutalist-dialog-footer');
    expect(footer.contains(close)).toBe(true);
    for (const token of [
      'flex',
      'flex-col-reverse',
      'gap-2',
      'border-t-2',
      'border-foreground',
      'pt-3',
      'justify-end',
    ]) {
      expect(styleContains(footer, token)).toBe(true);
    }
    expect(styleContains(footer, 'border-black')).toBe(false);
    expect(styleContains(footer, 'brutalist-border-top-black')).toBe(false);
  });

  it('gives a composed footer Close one control surface and one dismissal', async () => {
    // T-BRUTALIST-DIALOG-0001-CASE-7
    vi.useFakeTimers();
    const { root, trigger, close } = createDialog();
    const button = document.createElement(brutalistButton.name) as HTMLElement;
    button.textContent = 'Close';
    close.replaceChildren(button);
    await flush();
    trigger.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();

    // The Close keeps dismissal ownership but stays off the tab ring; the Button
    // is the only control surface, so there is one stop and one command.
    expect(close.getAttribute('role')).toBeNull();
    expect(close.tabIndex).toBe(-1);
    expect(button.getAttribute('role')).toBe('button');
    expect(button.tabIndex).toBe(0);
    for (const token of ['border-2', 'shadow-[3px_3px_0_0_#000]', 'data-[focus-visible]:ring-2']) {
      expect(styleContains(button, token)).toBe(true);
    }

    expect(root.getExposes().open.get()).toBe(true);
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });
});
