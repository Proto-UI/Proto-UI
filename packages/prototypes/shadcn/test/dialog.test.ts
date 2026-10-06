import { describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import {
  dialogClose,
  dialogCloseIcon,
  dialogContent,
  dialogDescription,
  dialogMask,
  dialogRoot,
  dialogTitle,
  dialogTrigger,
  dialogHeader,
  dialogFooter,
} from '../src/dialog';

AdaptToWebComponent(dialogRoot as any);
AdaptToWebComponent(dialogTrigger as any);
AdaptToWebComponent(dialogMask as any);
AdaptToWebComponent(dialogContent as any);
AdaptToWebComponent(dialogTitle as any);
AdaptToWebComponent(dialogDescription as any);
AdaptToWebComponent(dialogClose as any);
AdaptToWebComponent(dialogCloseIcon as any);
AdaptToWebComponent(dialogHeader as any);
AdaptToWebComponent(dialogFooter as any);

async function completeTransitions(...elements: any[]): Promise<void> {
  for (const element of elements) {
    const exposes = element?.getExposes?.();
    const state = exposes?.transitionState?.get?.();
    if (state === 'entering' || state === 'leaving') exposes.controls.complete();
  }
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('prototypes/shadcn: dialog', () => {
  it('keeps every Dialog anatomy part as a named direct entry', () => {
    expect(dialogRoot.name).toBe('shadcn-dialog-root');
    expect(dialogTrigger.name).toBe('shadcn-dialog-trigger');
    expect(dialogMask.name).toBe('shadcn-dialog-mask');
    expect(dialogContent.name).toBe('shadcn-dialog-content');
    expect(dialogTitle.name).toBe('shadcn-dialog-title');
    expect(dialogDescription.name).toBe('shadcn-dialog-description');
    expect(dialogClose.name).toBe('shadcn-dialog-close');
    expect(dialogCloseIcon.name).toBe('shadcn-dialog-close-icon');
    expect(dialogHeader.name).toBe('shadcn-dialog-header');
    expect(dialogFooter.name).toBe('shadcn-dialog-footer');
  });

  it('styles and opens a dialog compound prototype', async () => {
    const root = document.createElement('shadcn-dialog-root') as any;
    const trigger = document.createElement('shadcn-dialog-trigger') as any;
    const mask = document.createElement('shadcn-dialog-mask') as any;
    const content = document.createElement('shadcn-dialog-content') as any;
    const title = document.createElement('shadcn-dialog-title') as any;
    const description = document.createElement('shadcn-dialog-description') as any;
    const close = document.createElement('shadcn-dialog-close') as any;
    const closeIcon = document.createElement('shadcn-dialog-close-icon') as any;
    const header = document.createElement('shadcn-dialog-header') as any;
    const footer = document.createElement('shadcn-dialog-footer') as any;

    header.appendChild(title);
    header.appendChild(description);
    footer.appendChild(close);
    content.appendChild(header);
    content.appendChild(footer);
    content.appendChild(closeIcon);
    root.appendChild(trigger);
    root.appendChild(mask);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(trigger.getAttribute('data-pui-style')).toBeNull();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(mask.getExposes().transitionState.get()).toBe('entering');
    expect(styleContains(content, 'hidden')).toBe(false);
    expect(styleContains(mask, 'hidden')).toBe(false);
    expect(
      styleContains(
        content,
        'max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]'
      )
    ).toBe(true);
    expect(styleContains(content, 'rounded-lg')).toBe(true);
    expect(styleContains(content, 'shadow-lg')).toBe(true);
    expect(styleContains(content, 'data-[open]:animate-in')).toBe(true);
    expect(styleContains(content, 'data-[open]:fade-in-0')).toBe(true);
    expect(styleContains(content, 'data-[open]:zoom-in-95')).toBe(true);
    expect(styleContains(content, 'duration-200')).toBe(true);
    // This Happy DOM fixture supplies no affirmative preference/support facts.
    // The safe fallback is opaque; the live material suite covers enhancement.
    expect(styleContains(mask, 'bg-background')).toBe(true);
    expect(styleContains(mask, 'backdrop-blur-xs')).toBe(false);
    expect(styleContains(mask, 'animate-in')).toBe(true);
    expect(styleContains(mask, 'fade-in-0')).toBe(true);
    expect(styleContains(title, 'text-lg')).toBe(true);
    expect(styleContains(description, 'text-muted-foreground')).toBe(true);
    expect(styleContains(header, 'flex-col')).toBe(true);
    expect(styleContains(footer, 'items-center')).toBe(true);
    expect(styleContains(close, 'rounded-lg')).toBe(false);
    expect(styleContains(close, 'bg-primary')).toBe(false);
    expect(styleContains(closeIcon, 'absolute')).toBe(true);
    expect(closeIcon.querySelector('svg')).not.toBeNull();
    expect(closeIcon.getAttribute('aria-label')).toBe('Close');
    expect(styleContains(closeIcon, 'right-4')).toBe(true);
    expect(styleContains(closeIcon, 'top-4')).toBe(true);
    expect(styleContains(closeIcon, 'opacity-70')).toBe(true);
    expect(styleContains(closeIcon, 'size-8')).toBe(false);
    expect(document.activeElement).toBe(close);

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(styleContains(content, 'animate-out')).toBe(true);
    expect(styleContains(content, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'zoom-out-95')).toBe(true);
    expect(styleContains(mask, 'animate-out')).toBe(true);
    expect(styleContains(mask, 'fade-out-0')).toBe(true);
    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);

    root.remove();
    await Promise.resolve();
  });
});
