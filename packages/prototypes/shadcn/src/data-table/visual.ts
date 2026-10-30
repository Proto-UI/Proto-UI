import { tw, type DefHandle } from '@proto.ui/core';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

/** MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7:
 * bases/base/ui/table.tsx, all eight style-*.css .cn-table* recipes and the
 * independent new-york-v4/ui/table.tsx. DataTable's sorting/paging/selection
 * protocol is Proto-owned, not TanStack or an upstream DataTable API.
 * No descendant checkbox/expanded selector or last-body-row fact is inferred.
 */
export function setupDataTableText(def: DefHandle<ShadcnStyleProps>) {
  const style = setupShadcnStyleSelection(def, 'nova');
  def.rule({
    when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('mira')),
    intent: (i) => i.feedback.style.use(tw('text-xs')),
  });
  def.rule({
    when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'))),
    intent: (i) => i.feedback.style.use(tw('text-sm')),
  });
  return style;
}

export function setupDataTableCell(def: DefHandle<ShadcnStyleProps>, header = false) {
  const style = setupDataTableText(def);
  def.feedback.style.use(tw('table-cell text-left align-middle whitespace-nowrap'));
  if (header) {
    def.feedback.style.use(tw('font-medium'));
    def.rule({
      when: (w) =>
        w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('h-12 px-3')),
    });
    def.rule({
      when: (w) =>
        w.not(
          w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('h-10 px-2')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) =>
        i.feedback.style.use(tw('text-muted-foreground text-xs uppercase tracking-wider')),
    });
  } else {
    def.rule({
      when: (w) =>
        w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('p-3')),
    });
    def.rule({
      when: (w) =>
        w.not(
          w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('p-2')),
    });
  }
  return style;
}
