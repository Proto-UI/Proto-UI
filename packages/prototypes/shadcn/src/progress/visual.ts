import { tw, type DefHandle, type StyleHandle } from '@proto.ui/core';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

// shadcn-ui/ui@3d98900e, style-*.css .cn-progress*; independent
// new-york-v4/ui/progress.tsx. Existing h-3 compatibility paint is retained
// through Luma selection; this does not retroactively assign it provenance.
export function setupProgressStyle<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  return setupShadcnStyleSelection(def, 'luma');
}

const TRACK: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('h-1.5 rounded-full bg-muted'),
  nova: tw('h-1 rounded-full bg-muted'),
  maia: tw('h-3 rounded-[var(--pui-radius-4xl)] bg-muted'),
  lyra: tw('h-1 rounded-none bg-muted'),
  mira: tw('h-1 rounded-md bg-muted'),
  luma: tw('h-3 rounded-full bg-muted'),
  sera: tw('h-0.5 rounded-none bg-muted'),
  rhea: tw('h-2 rounded-[var(--pui-radius-2xl)] bg-muted'),
  'new-york-v4': tw('h-2 rounded-full bg-primary/20'),
};

export function setupProgressTrackPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const style = setupProgressStyle(def);
  def.feedback.style.use(tw('relative flex w-full items-center overflow-hidden'));
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(TRACK[profile]),
    });
  }
}

export function setupProgressLabelPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const style = setupProgressStyle(def);
  def.rule({
    when: (w) => w.state(style).eq('lyra'),
    intent: (i) => i.feedback.style.use(tw('text-xs')),
  });
  def.rule({
    when: (w) => w.state(style).eq('mira'),
    intent: (i) => i.feedback.style.use(tw('text-xs leading-relaxed font-medium')),
  });
  def.rule({
    when: (w) => w.state(style).eq('sera'),
    intent: (i) => i.feedback.style.use(tw('text-xs font-semibold tracking-wide uppercase')),
  });
  def.rule({
    when: (w) =>
      w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))),
    intent: (i) => i.feedback.style.use(tw('text-sm font-medium')),
  });
}

export function setupProgressValuePaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const style = setupProgressStyle(def);
  def.feedback.style.use(tw('ml-auto tabular-nums text-muted-foreground'));
  def.rule({
    when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('mira')),
    intent: (i) => i.feedback.style.use(tw('text-xs')),
  });
  def.rule({
    when: (w) => w.state(style).eq('mira'),
    intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
  });
  def.rule({
    when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'))),
    intent: (i) => i.feedback.style.use(tw('text-sm')),
  });
}
