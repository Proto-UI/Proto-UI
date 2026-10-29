import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as alertDialog from '../src/alert-dialog';
import { styleContains } from '../../test-utils/style';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';

// Visual expectations come from shadcn-ui/ui 02cad611 New York alert-dialog.tsx and button.tsx.
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
    parts[role] = document.createElement(`shadcn-alert-dialog-${role}`);
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

describe('Shadcn New York AlertDialog source-aligned passive projection', () => {
  it('restores action/cancel selection affordance without suppressing dialog prose or acquiring Button ownership', async () => {
    const p = fixture();
    await flush();
    for (const role of ['action', 'cancel']) {
      expect(styleContains(p[role], 'select-none'), role).toBe(true);
      setElementProps(p[role], { disabled: true });
      await flush();
      expect(styleContains(p[role], 'select-none'), role + ' disabled').toBe(true);
    }
    for (const role of ['content', 'title', 'description', 'header', 'footer'])
      expect(styleContains(p[role], 'select-none'), role + ' remains content').toBe(false);
  });

  it('uses the pinned New York panel, title/body, and default/outline command paint', async () => {
    const p = fixture();
    await flush();
    for (const token of [
      'p-6',
      'rounded-lg',
      'border',
      'border-border',
      'bg-background',
      'text-foreground',
      'shadow-lg',
      'grid',
      'gap-4',
    ]) {
      expect(styleContains(p.content, token), token).toBe(true);
    }
    for (const token of ['p-4', 'shadow-md', 'bg-popover'])
      expect(styleContains(p.content, token)).toBe(false);
    for (const token of ['text-lg', 'font-semibold'])
      expect(styleContains(p.title, token)).toBe(true);
    for (const token of ['text-sm', 'text-muted-foreground'])
      expect(styleContains(p.description, token)).toBe(true);
    expect(styleContains(p.mask, 'bg-black/50')).toBe(true);
    for (const role of ['cancel', 'action']) {
      for (const token of [
        'h-9',
        'px-4',
        'py-2',
        'rounded-md',
        'text-sm',
        'font-medium',
        'whitespace-nowrap',
      ])
        expect(styleContains(p[role], token), role + token).toBe(true);
      for (const token of ['min-h-8', 'px-2.5', 'rounded-lg', 'translate-y-px'])
        expect(styleContains(p[role], token), role + token).toBe(false);
    }
    expect(styleContains(p.action, 'bg-primary')).toBe(true);
    expect(styleContains(p.action, 'border')).toBe(false);
    expect(styleContains(p.cancel, 'bg-background')).toBe(true);
    expect(styleContains(p.cancel, 'border')).toBe(true);
    expect(styleContains(p.cancel, 'shadow-xs')).toBe(true);
  });

  // T-SHADCN-ALERT-DIALOG-0001-CASE-1
  it('keeps optional Header/Footer passive and preserves their authored descendants', async () => {
    const p = fixture();
    await flush();
    for (const role of ['header', 'footer']) {
      expect(p[role].getExposes()).toEqual({});
      expect(p[role].getAttribute('role')).toBeNull();
      expect(p[role].tabIndex).toBe(-1);
    }
    expect(p.header.contains(p.title)).toBe(true);
    expect(p.header.contains(p.description)).toBe(true);
    expect(p.footer.contains(p.cancel)).toBe(true);
    expect(p.footer.contains(p.action)).toBe(true);
    expect(p.content.getAttribute('aria-labelledby')).toBe(p.title.id);
    expect(p.content.getAttribute('aria-describedby')).toBe(p.description.id);
  });

  // T-SHADCN-ALERT-DIALOG-0001-CASE-2
  it('keeps text and commands in separate reusable groups with source desktop gaps', async () => {
    const p = fixture();
    await flush();
    for (const token of ['grid', 'gap-1.5', 'text-left', 'min-w-0'])
      expect(styleContains(p.header, token)).toBe(true);
    for (const token of ['flex', 'flex-wrap-reverse', 'gap-2', 'justify-end', 'min-w-0'])
      expect(styleContains(p.footer, token)).toBe(true);
    // Intrinsic wrapping is not the source's 40rem full-width column-reverse switch.
    for (const role of ['header', 'footer'])
      expect(p[role].getAttribute('data-pui-style')).not.toContain('sm:');
  });

  it('includes every runtime-authored part token in the shared preset, including command state variants', async () => {
    const p = fixture();
    await flush();
    for (const [role, element] of Object.entries(p)) {
      const tokens = ((element as HTMLElement).getAttribute('data-pui-style') ?? '')
        .split(/\s+/)
        .filter(Boolean);
      for (const token of tokens) expect(SHADCN_STYLE_TOKENS, `${role}: ${token}`).toContain(token);
    }
    for (const [role, hover] of [
      ['action', 'bg-primary/80'],
      ['cancel', 'bg-accent'],
    ] as const) {
      p[role].dispatchEvent(new Event('pointerenter'));
      await flush();
      expect(p[role].getExposes().hovered.get()).toBe(true);
      expect(styleContains(p[role], `data-[hovered]:${hover}`)).toBe(true);
    }
  });

  it('keeps bounded long-label wrapping as an explicit reusable command option', async () => {
    const p = fixture();
    await flush();
    for (const role of ['action', 'cancel']) {
      setElementProps(p[role], { wrap: true });
      await flush();
      for (const token of [
        'min-h-9',
        'h-auto',
        'px-4',
        'py-1',
        'max-w-full',
        'min-w-0',
        'whitespace-normal',
        'wrap-anywhere',
      ])
        expect(styleContains(p[role], token), role + token).toBe(true);
      expect(styleContains(p[role], 'h-9')).toBe(false);
      setElementProps(p[role], {});
      await flush();
      expect(styleContains(p[role], 'h-9')).toBe(true);
      expect(styleContains(p[role], 'whitespace-normal')).toBe(false);
    }
  });

  // T-SHADCN-ALERT-DIALOG-0001-CASE-3
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
