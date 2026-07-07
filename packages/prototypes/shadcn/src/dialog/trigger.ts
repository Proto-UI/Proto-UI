import { definePrototype, tw } from '@proto.ui/core';
import { asButton, asDialogTrigger } from '@proto.ui/prototypes-base';
import type { ShadcnDialogTriggerExposes, ShadcnDialogTriggerProps } from './types';

type ShadcnDialogTriggerVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

const BASE_TOKENS = [
  'group/button',
  'inline-flex',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-lg',
  'border',
  'bg-clip-padding',
  'text-sm',
  'font-medium',
  'whitespace-nowrap',
  'transition-all',
  'outline-none',
  'select-none',
  'h-8',
  'gap-1.5',
  'px-2.5',
].join(' ');

const VARIANT_TOKENS: Record<ShadcnDialogTriggerVariant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
  outline: 'border-border bg-background text-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  ghost: 'border-transparent bg-transparent text-foreground',
  link: 'border-transparent bg-transparent text-primary underline-offset-4',
};

const dialogTrigger = definePrototype<ShadcnDialogTriggerProps, ShadcnDialogTriggerExposes>({
  name: 'shadcn-dialog-trigger',
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({
      variant: 'default',
      disabled: false,
    });

    asDialogTrigger();
    const buttonState = asButton().stateHandles;
    if (!buttonState) {
      throw new Error('[shadcn-dialog-trigger] asButton must project Button state handles.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;
    const expanded = def.state.fromAccessibility('expanded');
    const invalid = def.state.fromAccessibility('invalid');

    def.feedback.style.use(tw(BASE_TOKENS));

    (Object.keys(VARIANT_TOKENS) as ShadcnDialogTriggerVariant[]).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(VARIANT_TOKENS[variant])),
      });
    });

    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });

    def.rule({
      when: (w) => w.all(w.state(focusVisible).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
    });

    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });

    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('secondary')),
      intent: (i) => i.feedback.style.use(tw('bg-secondary/80')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('ghost')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('link')),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });

    def.rule({
      when: (w) => w.all(w.state(expanded).eq(true), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(expanded).eq(true), w.prop('variant').eq('secondary')),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
    });

    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-3 ring-destructive/20')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

export default dialogTrigger;
