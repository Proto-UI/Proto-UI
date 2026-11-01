import { createContextKey, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
import type { CommandPresentationProps } from './types';
export const COMMAND_PROJECTED_STYLES = SHADCN_STYLE_IDS;
/** Private owned composition fact; never inferred from wrapped editor DOM. */
export const COMMAND_INPUT_PAINT = createContextKey<{
  command: boolean;
  presentation?: 'default' | 'menu';
}>('shadcn-command-input-paint');

/** MIT source-only mapping, shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * style-*.css .cn-command*, base/ui/command.tsx and independent
 * new-york-v4/ui/command.tsx. No cmdk runtime/API parity is implied. */
export const COMMAND_PROFILES = {
  vega: {
    root: 'rounded-xl p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-sm',
    item: 'gap-2 rounded-sm px-2 py-1.5 text-sm',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  nova: {
    root: 'rounded-xl p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-sm',
    item: 'gap-2 rounded-sm px-2 py-1.5 text-sm',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  maia: {
    root: 'rounded-[var(--pui-radius-4xl)] p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-sm',
    item: 'gap-2 rounded-lg px-3 py-2 text-sm',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  lyra: {
    root: 'rounded-none',
    wrapper: 'border-b pb-0',
    input: 'text-xs',
    item: 'gap-2 rounded-none px-2 py-2 text-xs',
    empty: 'text-xs',
    list: 'max-h-72 scroll-py-0 outline-none',
  },
  mira: {
    root: 'rounded-xl p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-xs leading-relaxed',
    item: 'min-h-7 gap-2 rounded-md px-2.5 py-1.5 text-xs leading-relaxed',
    empty: 'text-xs leading-relaxed',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  luma: {
    root: 'rounded-[var(--pui-radius-4xl)] p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-sm',
    item: 'gap-2 rounded-[var(--pui-radius-2xl)] px-3 py-2 text-sm font-medium',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  sera: {
    root: '',
    wrapper: 'p-1',
    input: 'text-sm px-2',
    item: 'gap-2 rounded-none px-3 py-2 text-sm',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  rhea: {
    root: 'rounded-[var(--pui-radius-3xl)] p-1',
    wrapper: 'p-1 pb-0',
    input: 'text-sm',
    item: 'gap-2 min-h-7 rounded-[var(--pui-radius-xl)] px-2 py-1.5 text-sm',
    empty: 'text-sm',
    list: 'max-h-72 scroll-py-1 outline-none',
  },
  'new-york-v4': {
    root: 'rounded-md',
    wrapper: 'flex h-9 items-center gap-2 border-b px-3',
    input: 'flex h-10 py-3 text-sm',
    item: 'gap-2 rounded-sm px-2 py-1.5 text-sm',
    empty: 'text-sm',
    list: 'max-h-[18.75rem] scroll-py-1',
  },
} as const;

export function setupCommandStyle<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, root = false) {
  if (root) setupShadcnStyleScope(def);
  return setupShadcnStyleSelection(def, 'new-york-v4');
}

export function setupCommandInputMode<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const command = def.state.bool('commandInputPaint', false);
  const sync = (run: RunHandle<Props>) => {
    command.set(
      run.context.tryRead(COMMAND_INPUT_PAINT)?.command === true,
      'reason: owned Command input wrapper'
    );
  };
  def.context.trySubscribe(COMMAND_INPUT_PAINT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return command;
}

export function setupCommandPresentation<
  Props extends ShadcnStyleProps & CommandPresentationProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const cdef = def as unknown as DefHandle<ShadcnStyleProps & CommandPresentationProps>;
  cdef.props.define({
    presentation: { type: 'enum', options: ['default', 'menu'], empty: 'fallback' },
  });
  cdef.props.setDefaults({ presentation: 'default' });
}

/** Private wrapper-owned presentation, never optional prefix/Anatomy presence. */
export function setupCommandMenuInputMode(def: DefHandle<ShadcnStyleProps>) {
  const menu = def.state.bool('commandMenuInputPaint', false);
  const sync = (run: RunHandle<ShadcnStyleProps>) => {
    const paint = run.context.tryRead(COMMAND_INPUT_PAINT);
    menu.set(
      paint?.command === true && paint.presentation === 'menu',
      'reason: explicit Command wrapper menu presentation'
    );
  };
  def.context.trySubscribe(COMMAND_INPUT_PAINT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return menu;
}

/** MIT website CommandMenu@24a1642, not the ordinary registry recipe. */
const COMMAND_MENU_PARTS = {
  root: 'rounded-none p-0 bg-transparent',
  wrapper: 'flex h-9 shrink-0 items-center gap-2 rounded-md border border-input bg-input/50 px-3',
  input: 'h-9 px-0 py-0 text-sm',
  item: 'min-h-9 gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium',
  empty: 'py-12 text-center text-sm text-muted-foreground',
  list: 'min-h-0 max-h-[none] flex-1 scroll-pt-2 scroll-pb-1.5 outline-none',
} as const;

export function setupCommandPartPaint<
  Props extends ShadcnStyleProps & { presentation?: 'default' | 'menu' },
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  part: 'root' | 'wrapper' | 'input' | 'item' | 'empty' | 'list',
  root = false
) {
  const style = setupCommandStyle(def, root);
  setupCommandPresentation(def);
  const cdef = def as unknown as DefHandle<
    ShadcnStyleProps & { presentation?: 'default' | 'menu' }
  >;
  cdef.rule({
    when: (w) => w.prop('presentation').eq('menu'),
    intent: (i) => i.feedback.style.use(tw(COMMAND_MENU_PARTS[part])),
  });
  for (const id of SHADCN_STYLE_IDS) {
    const tokens = COMMAND_PROFILES[id][part];
    if (tokens)
      cdef.rule({
        when: (w) => w.all(w.state(style).eq(id), w.prop('presentation').eq('default')),
        intent: (i) => i.feedback.style.use(tw(tokens)),
      });
  }
  return style;
}
