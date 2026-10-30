import { tw, type DefHandle } from '@proto.ui/core';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

// shadcn-ui/ui@3d98900e: apps/v4/registry/styles/style-*.css,
// .cn-accordion*, and the independent new-york-v4/ui/accordion.tsx.
// Nova is the existing projection's compatibility recipe, not a universal default.
export function setupAccordionStyle(def: DefHandle<ShadcnStyleProps>) {
  return setupShadcnStyleSelection(def, 'nova');
}

export function setupAccordionContentPaint(def: DefHandle<ShadcnStyleProps>) {
  const style = setupAccordionStyle(def);
  def.feedback.style.use(tw('min-w-0 break-words overflow-x-auto'));
  def.rule({
    when: (w) => w.any(w.state(style).eq('nova'), w.state(style).eq('lyra')),
    intent: (i) => i.feedback.style.use(tw('pb-2.5')),
  });
  def.rule({
    when: (w) => w.not(w.any(w.state(style).eq('nova'), w.state(style).eq('lyra'))),
    intent: (i) => i.feedback.style.use(tw('pb-4')),
  });
  def.rule({
    when: (w) => w.state(style).eq('lyra'),
    intent: (i) => i.feedback.style.use(tw('text-xs')),
  });
  def.rule({
    when: (w) => w.state(style).eq('mira'),
    intent: (i) => i.feedback.style.use(tw('px-2 text-xs leading-relaxed')),
  });
  def.rule({
    when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'))),
    intent: (i) => i.feedback.style.use(tw('text-sm')),
  });
  def.rule({
    when: (w) =>
      w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('rhea')),
    intent: (i) => i.feedback.style.use(tw('px-4')),
  });
  // Measured-height enter/leave animation is deliberately not fabricated over
  // Base's immediate L1 detach. Long content remains in normal, unclipped flow.
}
