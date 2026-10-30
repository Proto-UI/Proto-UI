import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';

/** Pinned .cn-field gap/invalid paint; Base alone owns validation and relationships. */
export function setupFieldRootVisual(def: DefHandle<ShadcnStyleProps>, invalid: State<boolean>) {
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(tw('flex w-full min-w-0 flex-col text-foreground'));
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(profile === 'nova' || profile === 'lyra' || profile === 'mira' ? 'gap-2' : 'gap-3')
        ),
    });
  }
  def.rule({
    when: (w) => w.state(invalid).eq(true),
    intent: (i) => i.feedback.style.use(tw('text-destructive')),
  });
  return style;
}

const FIELD_LABEL = {
  vega: 'text-sm font-medium leading-snug',
  nova: 'text-sm font-medium leading-snug',
  maia: 'text-sm font-medium leading-snug',
  lyra: 'text-xs leading-snug',
  mira: 'text-xs font-medium leading-relaxed',
  luma: 'text-sm font-medium leading-snug',
  sera: 'text-xs font-semibold uppercase tracking-wide leading-relaxed',
  rhea: 'text-sm font-medium leading-snug',
  'new-york-v4': 'text-sm font-medium leading-snug',
} as const;

/** .cn-field-label + .cn-label, .cn-field-description/error. No selector-based anatomy inference. */
export function setupFieldTextVisual(
  def: DefHandle<ShadcnStyleProps>,
  part: 'label' | 'description' | 'error' | 'validity',
  disabled?: State<boolean>
) {
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(tw('break-words'));
  if (part === 'label') {
    def.feedback.style.use(tw('flex w-fit items-center gap-2'));
  } else {
    def.feedback.style.use(tw('block'));
    def.feedback.style.use(
      tw(
        part === 'error'
          ? 'font-normal leading-normal text-destructive'
          : 'text-left font-normal leading-normal text-muted-foreground'
      )
    );
  }
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            part === 'label'
              ? FIELD_LABEL[profile]
              : profile === 'mira'
                ? 'text-xs leading-relaxed'
                : profile === 'lyra'
                  ? 'text-xs'
                  : 'text-sm'
          )
        ),
    });
  }
  if (disabled) {
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
  }
  return style;
}
