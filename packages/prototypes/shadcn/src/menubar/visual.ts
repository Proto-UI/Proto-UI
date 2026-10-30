import { tw, type DefHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupMenuStyle } from '../dropdown/visual';
import type { MenubarRootProps, MenubarTriggerProps } from './types';

/** .cn-menubar and .cn-menubar-trigger, retained 3d98900 style-*.css;
 * independent new-york-v4/ui/menubar.tsx at that pin. */
const PROFILES = {
  vega: {
    root: 'h-9 gap-1 rounded-md border p-1 shadow-xs',
    trigger: 'rounded-sm px-2 py-1 text-sm',
  },
  nova: {
    root: 'h-8 gap-0.5 rounded-lg border p-[3px]',
    trigger: 'rounded-sm px-1.5 py-[2px] text-sm',
  },
  maia: {
    root: 'h-9 rounded-[var(--pui-radius-4xl)] border p-1',
    trigger: 'rounded-[var(--pui-radius-xl)] px-2 py-0.75 text-sm',
  },
  lyra: {
    root: 'h-8 gap-0.5 rounded-none border p-1',
    trigger: 'rounded-none px-1.5 py-[0.2rem] text-xs',
  },
  mira: {
    root: 'h-9 rounded-lg border p-1',
    trigger: 'rounded-[calc(var(--radius-md)-2px)] px-2 py-[0.2125rem] text-xs leading-relaxed',
  },
  luma: {
    root: 'h-9 rounded-[var(--pui-radius-3xl)] border p-1',
    trigger: 'rounded-[var(--pui-radius-2xl)] px-2 py-0.75 text-sm',
  },
  sera: { root: 'h-10 rounded-none border p-1', trigger: 'rounded-none px-2 py-0.75 text-sm' },
  rhea: {
    root: 'h-8 rounded-[var(--pui-radius-2xl)] border p-[3px]',
    trigger: 'rounded-[var(--pui-radius-2xl)] px-1.5 py-[2px] text-sm',
  },
  'new-york-v4': {
    root: 'h-9 gap-1 rounded-md border bg-background p-1 shadow-xs',
    trigger: 'rounded-sm px-2 py-1 text-sm',
  },
} as const;

export function setupMenubarRootPaint(def: DefHandle<MenubarRootProps>) {
  const style = setupMenuStyle(def, 'new-york-v4', true);
  def.feedback.style.use(tw('flex min-w-0 items-center'));
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].root)),
    });
  }
}

export function setupMenubarTriggerPaint(
  def: DefHandle<MenubarTriggerProps>,
  states: {
    disabled: State<boolean>;
    focused: State<boolean>;
    expanded: State<boolean>;
  }
) {
  const style = setupMenuStyle(def);
  def.feedback.style.use(tw('flex min-w-0 items-center font-medium outline-none select-none'));
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(PROFILES[id].trigger)),
    });
  }
  def.rule({
    when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.state(states.expanded).eq(true)),
    intent: (i) => i.feedback.style.use(tw('bg-muted')),
  });
  // Base's focusable ownership supplies focused on actual pointer/keyboard
  // entry. A distinct hovered fact is not manufactured from DOM ancestry.
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.any(w.state(states.focused).eq(true), w.state(states.expanded).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
  });
  def.rule({
    when: (w) => w.state(states.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
}
