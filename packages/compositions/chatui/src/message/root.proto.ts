import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import {
  MESSAGE_ALIGNMENT_STYLE_TOKENS,
  MESSAGE_ROOT_STYLE_TOKENS,
  MESSAGE_SPACING_STYLE_TOKENS,
  MESSAGE_TONE_STYLE_TOKENS,
} from './styles';
import type {
  MessageAlignment,
  MessageRootExposes,
  MessageRootProps,
  MessageSpacing,
  MessageTone,
} from './types';

export const MessageRoot = definePrototype<MessageRootProps, MessageRootExposes>({
  name: 'chatui-message-root',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'root' });
    def.props.define({
      alignment: { type: 'enum', empty: 'fallback', options: ['start', 'end', 'stretch'] },
      tone: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'user', 'assistant', 'system'],
      },
      spacing: { type: 'enum', empty: 'fallback', options: ['default', 'compact'] },
    });
    def.props.setDefaults({ alignment: 'start', tone: 'default', spacing: 'default' });
    def.feedback.style.use(tw(MESSAGE_ROOT_STYLE_TOKENS));

    (Object.keys(MESSAGE_ALIGNMENT_STYLE_TOKENS) as MessageAlignment[]).forEach((alignment) => {
      def.rule({
        when: (when) => when.prop('alignment').eq(alignment),
        intent: (intent) =>
          intent.feedback.style.use(tw(MESSAGE_ALIGNMENT_STYLE_TOKENS[alignment])),
      });
    });
    (Object.keys(MESSAGE_TONE_STYLE_TOKENS) as MessageTone[]).forEach((tone) => {
      def.rule({
        when: (when) => when.prop('tone').eq(tone),
        intent: (intent) => intent.feedback.style.use(tw(MESSAGE_TONE_STYLE_TOKENS[tone])),
      });
    });
    (Object.keys(MESSAGE_SPACING_STYLE_TOKENS) as MessageSpacing[]).forEach((spacing) => {
      def.rule({
        when: (when) => when.prop('spacing').eq(spacing),
        intent: (intent) => intent.feedback.style.use(tw(MESSAGE_SPACING_STYLE_TOKENS[spacing])),
      });
    });

    return (renderer) => renderer.r.slot();
  },
});
