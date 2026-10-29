import { tw, type DefHandle, type StyleHandle } from '@proto.ui/core';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

// Meter is a Proto extension: there is no meter.tsx in the pinned upstream
// component inventory. Paint adapts .cn-progress* from shadcn-ui/ui@3d98900e;
// the distinct Base Meter still owns range, optimum and quality status.
export function setupMeterStyle(def: DefHandle<ShadcnStyleProps>) {
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
  rhea: tw('h-2 rounded-2xl bg-muted'),
  'new-york-v4': tw('h-2 rounded-full bg-primary/20'),
};

export function setupMeterTrackPaint(def: DefHandle<ShadcnStyleProps>) {
  const style = setupMeterStyle(def);
  def.feedback.style.use(tw('relative flex w-full items-center overflow-hidden'));
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(TRACK[profile]),
    });
  }
}

export function setupMeterLabelPaint(def: DefHandle<ShadcnStyleProps>) {
  const style = setupMeterStyle(def);
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

export function setupMeterValuePaint(def: DefHandle<ShadcnStyleProps>) {
  const style = setupMeterStyle(def);
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
