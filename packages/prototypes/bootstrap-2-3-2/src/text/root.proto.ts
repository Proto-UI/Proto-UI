import { definePrototype, tw } from '@proto.ui/core';
import {
  asTextRoot,
  type TextRootProps,
  type TextRootExposes,
} from '@proto.ui/prototypes-base/text';

export default definePrototype<TextRootProps, TextRootExposes>({
  name: 'bootstrap-2-3-2-text-root',
  setup(def) {
    // Base owns the eight finite presentation inputs, defaults and untouched slot.
    // No selection override: document text is selectable, control text inherits
    // its actual owner's selection policy, including inside portaled controls.
    asTextRoot();
    def.rule({
      when: (w) => w.prop('size').eq('xs'),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('base'),
      intent: (i) => i.feedback.style.use(tw('text-base')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('lg'),
      intent: (i) => i.feedback.style.use(tw('text-lg')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('xl'),
      intent: (i) => i.feedback.style.use(tw('text-xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('2xl'),
      intent: (i) => i.feedback.style.use(tw('text-2xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('3xl'),
      intent: (i) => i.feedback.style.use(tw('text-3xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('4xl'),
      intent: (i) => i.feedback.style.use(tw('text-4xl')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('5xl'),
      intent: (i) => i.feedback.style.use(tw('text-5xl')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('default'),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('muted'),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('inherit'),
      intent: (i) => i.feedback.style.use(tw('text-inherit')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('font-normal')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('medium'),
      intent: (i) => i.feedback.style.use(tw('font-medium')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('semibold'),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    def.rule({
      when: (w) => w.prop('weight').eq('bold'),
      intent: (i) => i.feedback.style.use(tw('font-bold')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('body'),
      intent: (i) => i.feedback.style.use(tw('font-sans')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('heading'),
      intent: (i) => i.feedback.style.use(tw('font-heading')),
    });
    def.rule({
      when: (w) => w.prop('font').eq('mono'),
      intent: (i) => i.feedback.style.use(tw('font-mono')),
    });
    def.rule({
      when: (w) => w.prop('leading').eq('tight'),
      intent: (i) => i.feedback.style.use(tw('leading-tight')),
    });
    def.rule({
      when: (w) => w.prop('leading').eq('snug'),
      intent: (i) => i.feedback.style.use(tw('leading-snug')),
    });
    def.rule({
      when: (w) => w.prop('leading').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('leading-normal')),
    });
    def.rule({
      when: (w) => w.prop('leading').eq('relaxed'),
      intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
    });
    def.rule({
      when: (w) => w.prop('tracking').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('tracking-normal')),
    });
    def.rule({
      when: (w) => w.prop('tracking').eq('tight'),
      intent: (i) => i.feedback.style.use(tw('tracking-tight')),
    });
    def.rule({
      when: (w) => w.prop('emphasis').eq('normal'),
      intent: (i) => i.feedback.style.use(tw('not-italic')),
    });
    def.rule({
      when: (w) => w.prop('emphasis').eq('italic'),
      intent: (i) => i.feedback.style.use(tw('italic')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('none'),
      intent: (i) => i.feedback.style.use(tw('no-underline')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('underline'),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.prop('decoration').eq('line-through'),
      intent: (i) => i.feedback.style.use(tw('line-through')),
    });
  },
});
