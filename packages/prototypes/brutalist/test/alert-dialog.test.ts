import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as alertDialog from '../src/alert-dialog';
import type {
  BrutalistAlertDialogHeaderProps,
  BrutalistAlertDialogHeaderExposes,
  BrutalistAlertDialogFooterProps,
  BrutalistAlertDialogFooterExposes,
} from '../src/alert-dialog';
import { styleContains } from '../../test-utils/style';

// Visual expectations come from neobrutalism-components 3306a802, alert-dialog.tsx.
// These are source/host-unit assertions, not rendered geometry or native-input evidence.
for (const prototype of Object.values(alertDialog)) {
  if (typeof prototype === 'object' && prototype && 'setup' in prototype) {
    if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
  }
}

const owned = new Set<HTMLElement>();
const flush = async () => {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
};

function fixture(props: Record<string, unknown> = { defaultOpen: true }) {
  const parts: Record<string, any> = {};
  for (const role of [
    'root',
    'trigger',
    'mask',
    'content',
    'header',
    'title',
    'description',
    'footer',
    'cancel',
    'action',
  ]) {
    parts[role] = document.createElement(`brutalist-alert-dialog-${role}`);
    owned.add(parts[role]);
  }
  setElementProps(parts.root, props);
  parts.trigger.textContent = 'Open AlertDialog';
  parts.title.textContent = 'Review these changes';
  parts.description.textContent = 'The application owns the final decision.';
  parts.cancel.textContent = 'Cancel';
  parts.action.textContent = 'Confirm';
  parts.header.append(parts.title, parts.description);
  parts.footer.append(parts.cancel, parts.action);
  parts.content.append(parts.header, parts.footer);
  parts.root.append(parts.trigger, parts.mask, parts.content);
  document.body.append(parts.root);
  return parts;
}

afterEach(async () => {
  for (const element of owned) element.remove();
  owned.clear();
  await flush();
});

describe('Neo-Brutalist AlertDialog source-aligned passive projection', () => {
  it('owns the rounded padded panel, source heading/body roles and theme scrim', async () => {
    const p = fixture();
    await flush();
    for (const token of [
      'rounded-base',
      'p-6',
      'border-2',
      'border-border',
      'shadow-[4px_4px_0_0_#000]',
      'grid',
      'gap-4',
      'outline-none',
    ])
      expect(styleContains(p.content, token), token).toBe(true);
    for (const token of [
      'rounded-none',
      'p-4',
      'border-foreground',
      'shadow-[4px_4px_0_0_var(--pui-foreground)]',
    ]) {
      expect(styleContains(p.content, token), token).toBe(false);
    }
    for (const token of ['font-heading', 'font-bold', 'text-lg', 'text-foreground']) {
      expect(styleContains(p.title, token), token).toBe(true);
    }
    for (const token of ['text-xl', 'font-black', 'leading-none', 'tracking-tight']) {
      expect(styleContains(p.title, token), token).toBe(false);
    }
    for (const token of ['font-sans', 'font-medium', 'text-sm', 'text-foreground']) {
      expect(styleContains(p.description, token), token).toBe(true);
    }
    expect(styleContains(p.mask, 'bg-overlay')).toBe(true);
    expect(styleContains(p.mask, 'bg-black/50')).toBe(false);
  });

  // T-BRUTALIST-ALERT-DIALOG-0001-CASE-1
  it('exports optional passive Header/Footer and preserves their authored descendants', async () => {
    expectTypeOf<keyof BrutalistAlertDialogHeaderProps>().toEqualTypeOf<never>();
    expectTypeOf<keyof BrutalistAlertDialogHeaderExposes>().toEqualTypeOf<never>();
    expectTypeOf<keyof BrutalistAlertDialogFooterProps>().toEqualTypeOf<never>();
    expectTypeOf<keyof BrutalistAlertDialogFooterExposes>().toEqualTypeOf<never>();
    expect(alertDialog).toHaveProperty('alertDialogHeader');
    expect(alertDialog).toHaveProperty('alertDialogFooter');
    const p = fixture();
    await flush();
    for (const role of ['header', 'footer']) {
      expect(p[role].getExposes()).toEqual({});
      expect(p[role].getAttribute('role')).toBeNull();
      expect(p[role].tabIndex).toBe(-1);
      const source = readFileSync(
        path.resolve(`packages/prototypes/brutalist/src/alert-dialog/${role}.proto.ts`),
        'utf8'
      );
      expect(source).toContain(`def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: '${role}' })`);
      expect(source).not.toMatch(
        /def\.(?:state|event|context|lifecycle)|asButton|asTrigger|window\.|document\./
      );
      expect(source).toContain('renderer.r.slot()');
    }
    expect(p.header.contains(p.title)).toBe(true);
    expect(p.header.contains(p.description)).toBe(true);
    expect(p.footer.contains(p.cancel)).toBe(true);
    expect(p.footer.contains(p.action)).toBe(true);
    expect(p.content.getAttribute('aria-labelledby')).toBe(p.title.id);
    expect(p.content.getAttribute('aria-describedby')).toBe(p.description.id);
  });

  // T-BRUTALIST-ALERT-DIALOG-0001-CASE-2
  it('groups 8px-spaced text and intrinsic right-aligned 12px-spaced actions with reverse wrapping', async () => {
    const p = fixture();
    await flush();
    for (const token of ['flex', 'min-w-0', 'flex-col', 'gap-2', 'text-left']) {
      expect(styleContains(p.header, token), token).toBe(true);
    }
    for (const token of [
      'flex',
      'min-w-0',
      'flex-wrap-reverse',
      'gap-3',
      'items-center',
      'justify-end',
    ]) {
      expect(styleContains(p.footer, token), token).toBe(true);
    }
    expect(styleContains(p.footer, 'flex-col-reverse')).toBe(false);
    for (const role of ['cancel', 'action']) {
      expect(styleContains(p[role], 'inline-flex')).toBe(true);
      expect(styleContains(p[role], 'w-full')).toBe(false);
      for (const token of ['min-w-0', 'max-w-full', 'whitespace-normal', 'wrap-anywhere']) {
        expect(styleContains(p[role], token), token).toBe(true);
      }
    }
    // The current grammar deliberately does not claim upstream's 640px switch.
    for (const role of ['header', 'footer']) {
      expect(p[role].getAttribute('data-pui-style')).not.toContain('sm:');
    }
  });

  it('uses the default elevated Button paint on Trigger through its original command states', async () => {
    const p = fixture({});
    await flush();
    for (const token of [
      'rounded-base',
      'border-2',
      'border-black',
      'shadow-[4px_4px_0_0_#000]',
      'bg-main',
      'text-main-foreground',
      'font-sans',
      'font-medium',
      'min-h-10',
      'px-4',
    ]) {
      expect(styleContains(p.trigger, token), token).toBe(true);
    }
    p.trigger.dispatchEvent(new Event('pointerenter'));
    await flush();
    expect(p.trigger.getExposes().hovered.get()).toBe(true);
    expect(styleContains(p.trigger, 'data-[hovered]:translate-x-1')).toBe(true);
    expect(styleContains(p.trigger, 'data-[hovered]:shadow-none')).toBe(true);
    p.trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(p.trigger.getExposes().pressed.get()).toBe(true);
    expect(styleContains(p.trigger, 'data-[pressed]:shadow-none')).toBe(true);
    p.trigger.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await flush();
    expect(p.trigger.getExposes().pressed.get()).toBe(false);
    expect(p.root.getExposes().open.get()).toBe(false);
    const requests: unknown[] = [];
    p.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
    // Synthetic click has no native focus default; establish the real entry focus explicitly.
    p.trigger.focus();
    await flush();
    expect(document.activeElement).toBe(p.trigger);
    p.trigger.click();
    await flush();
    expect(requests).toHaveLength(1);
    expect(p.root.getExposes().open.get()).toBe(true);
    p.cancel.click();
    await flush();
    expect(requests).toHaveLength(2);
    expect(p.root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(p.trigger);
    setElementProps(p.trigger, { disabled: true });
    await flush();
    p.trigger.click();
    await flush();
    expect(requests).toHaveLength(2);
    expect(p.root.getExposes().open.get()).toBe(false);
    const source = readFileSync(
      path.resolve('packages/prototypes/brutalist/src/alert-dialog/trigger.proto.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/asButton|def\.state|def\.event\.on/);
  });

  // T-BRUTALIST-ALERT-DIALOG-0001-CASE-3
  it('keeps Cancel focus, outside dismissal guard and one controlled Action request across grouping', async () => {
    const p = fixture({ open: true });
    await flush();
    expect(document.activeElement).toBe(p.cancel);
    expect(p.content.getAttribute('role')).toBe('alertdialog');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    const requests: unknown[] = [];
    const actions: unknown[] = [];
    p.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
    p.action.addEventListener('action', (event: CustomEvent) => actions.push(event.detail));
    p.action.click();
    await flush();
    expect(actions).toEqual([{ reason: 'action.press' }]);
    expect(requests).toEqual([expect.objectContaining({ open: false, reason: 'action.press' })]);
    expect(p.root.getExposes().open.get()).toBe(true);
    setElementProps(p.root, { open: false });
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
    setElementProps(p.root, { open: true });
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(p.cancel);
    p.cancel.click();
    await flush();
    expect(actions).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ open: false, reason: 'cancel.press' });
  });
});
