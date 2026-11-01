import { tw, type DefHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import { setupCommandInputMode, setupCommandMenuInputMode } from '../command/visual';
import type { InputShellProps, InputShellControlProps } from './types';

/** MIT shadcn-ui/ui@3d98900 style-*.css .cn-input-group and
 * .cn-command-input-group, plus independent new-york-v4/ui/input-group.tsx.
 * Only the public bounded one-editor shell is projected, not InputGroup API. */
const SHELL_PROFILES = {
  vega: {
    shell: 'h-9 rounded-md border-input shadow-xs transition-[color,box-shadow]',
    focus: 'border-ring ring-3 ring-ring/50',
    command: 'h-8 rounded-lg border-input/30 bg-input/30 shadow-none',
  },
  nova: {
    shell: 'h-8 rounded-lg border-input transition-colors',
    focus: 'border-ring ring-3 ring-ring/50',
    command: 'h-8 rounded-lg border-input/30 bg-input/30 shadow-none',
  },
  maia: {
    shell: 'h-9 rounded-[var(--pui-radius-4xl)] border-input bg-input/30 transition-colors',
    focus: 'border-ring ring-3 ring-ring/50',
    command: 'h-9 rounded-[var(--pui-radius-4xl)] border-input bg-input/30 transition-colors',
  },
  lyra: {
    shell: 'h-8 rounded-none border-input transition-colors',
    focus: 'border-ring ring-1 ring-ring/50',
    command: 'h-8 rounded-none border-0 border-input/30 bg-input/30 shadow-none',
  },
  mira: {
    shell: 'h-7 rounded-md border-input bg-input/20 transition-colors',
    focus: 'border-ring ring-2 ring-ring/30',
    command: 'h-8 rounded-md border-input bg-input/20 transition-colors',
  },
  luma: {
    shell:
      'h-9 rounded-[var(--pui-radius-4xl)] border-transparent bg-input/50 transition-[color,box-shadow,background-color]',
    focus: 'border-ring ring-3 ring-ring/30',
    command:
      'h-9 rounded-[var(--pui-radius-4xl)] border-transparent bg-input/50 transition-[color,box-shadow,background-color]',
  },
  sera: {
    shell:
      'h-10 rounded-none border-transparent border-b-input bg-transparent transition-[color,border-color]',
    focus: 'border-b-ring',
    command:
      'h-10 rounded-none border-transparent border-b-input bg-transparent px-3 transition-[color,border-color]',
  },
  rhea: {
    shell:
      'h-8 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 transition-[color,box-shadow] duration-200',
    focus: 'border-ring ring-3 ring-ring/30',
    command:
      'h-8 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 transition-[color,box-shadow] duration-200',
  },
  'new-york-v4': {
    shell: 'h-9 rounded-md border-input shadow-xs transition-[color,box-shadow]',
    focus: 'border-ring ring-3 ring-ring/50',
    command: 'h-auto rounded-none border-0 bg-transparent shadow-none',
  },
} as const;

export function setupInputShellPaint(def: DefHandle<InputShellProps>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  const command = setupCommandInputMode(def);
  const menu = setupCommandMenuInputMode(def);
  def.feedback.style.use(tw('relative flex w-full min-w-0 items-center outline-none'));
  for (const id of SHADCN_STYLE_IDS) {
    const profile = SHELL_PROFILES[id];
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.state(command).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border', profile.shell)),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.state(command).eq(true), w.state(menu).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(id === 'lyra' || id === 'new-york-v4' ? '' : 'border', profile.command)
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(id),
          w.state(command).eq(false),
          w.prop('focusVisible').eq(true),
          w.prop('focusIndicator').eq('ring')
        ),
      intent: (i) => i.feedback.style.use(tw(profile.focus)),
    });
  }
  // Border/inset belong to the opted-in Command wrapper. This still wraps
  // exactly one editor; no addon or additional focus/interaction owner.
  def.rule({
    when: (w) => w.state(menu).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('h-9 flex-1 rounded-none border-0 bg-transparent shadow-none')),
  });
  for (const id of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq(id), w.state(command).eq(false), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('mira'),
        w.state(command).eq(true),
        w.state(menu).eq(false),
        w.meta('colorScheme').eq('dark')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  // The actual editor remains the sole opacity/disabled/focus owner.
  for (const id of ['nova', 'lyra'] as const) {
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq(id), w.state(command).eq(false), w.prop('disabled').eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(id),
          w.state(command).eq(false),
          w.prop('disabled').eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });
  }
  return style;
}

const CONTROL_PROFILES = {
  vega: 'h-9 px-2.5 py-1 text-base',
  nova: 'h-8 px-2.5 py-1 text-base',
  maia: 'h-9 px-3 py-1 text-base',
  lyra: 'h-8 px-2.5 py-1 text-xs',
  mira: 'h-7 px-2 py-0.5 text-sm',
  luma: 'h-9 px-3 py-1 text-base',
  sera: 'h-10 px-0 py-1 text-base',
  rhea: 'h-8 px-2.5 py-1 text-base',
  'new-york-v4': 'h-9 px-3 py-1 text-base',
} as const;

export function setupInputShellControlPaint(
  def: DefHandle<InputShellControlProps>,
  disabled: State<boolean>
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'min-w-0 w-full grow rounded-none border-0 bg-transparent shadow-none outline-none ring-0 text-foreground selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground'
    )
  );
  for (const id of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(id),
      intent: (i) => i.feedback.style.use(tw(CONTROL_PROFILES[id])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(id), w.meta('viewport.width').gte(768)),
      intent: (i) =>
        i.feedback.style.use(
          tw(id === 'lyra' ? 'text-xs' : id === 'mira' ? 'text-xs leading-relaxed' : 'text-sm')
        ),
    });
  }
  def.rule({
    when: (w) => w.state(disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
}
