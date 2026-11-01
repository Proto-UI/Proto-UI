import { tw, type DefHandle } from '@proto.ui/core';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

// shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7:
// apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css
// (.cn-table*) and the independent apps/v4/registry/new-york-v4/ui/table.tsx.
// The finite rules below map each retained profile, not aliases to another style.
export function setupTableStyle<Props extends ShadcnStyleProps, Exposes = Record<string, unknown>>(
  def: DefHandle<Props, Exposes>
) {
  return setupShadcnStyleSelection(def, 'new-york-v4');
}

export function setupTableText<Props extends ShadcnStyleProps, Exposes = Record<string, unknown>>(
  def: DefHandle<Props, Exposes>
) {
  const style = setupTableStyle(def);
  def.rule({
    when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('mira')),
    intent: (i) => i.feedback.style.use(tw('text-xs')),
  });
  def.rule({
    when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'))),
    intent: (i) => i.feedback.style.use(tw('text-sm')),
  });
}

export function setupTableHeaderCellPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const style = setupTableStyle(def);
  def.feedback.style.use(tw('table-cell text-left align-middle font-medium whitespace-nowrap'));
  def.rule({
    when: (w) =>
      w.any(
        w.state(style).eq('vega'),
        w.state(style).eq('nova'),
        w.state(style).eq('lyra'),
        w.state(style).eq('mira'),
        w.state(style).eq('rhea'),
        w.state(style).eq('new-york-v4')
      ),
    intent: (i) => i.feedback.style.use(tw('h-10 px-2 text-foreground')),
  });
  def.rule({
    when: (w) => w.any(w.state(style).eq('maia'), w.state(style).eq('luma')),
    intent: (i) => i.feedback.style.use(tw('h-12 px-3 text-foreground')),
  });
  def.rule({
    when: (w) => w.state(style).eq('sera'),
    intent: (i) =>
      i.feedback.style.use(tw('h-12 px-3 text-muted-foreground text-xs uppercase tracking-wider')),
  });
}

export function setupTableCellPaint<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const style = setupTableStyle(def);
  def.feedback.style.use(tw('table-cell align-middle whitespace-nowrap'));
  def.rule({
    when: (w) =>
      w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera')),
    intent: (i) => i.feedback.style.use(tw('p-3')),
  });
  def.rule({
    when: (w) =>
      w.not(w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera'))),
    intent: (i) => i.feedback.style.use(tw('p-2')),
  });
}
