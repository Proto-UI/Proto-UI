import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import { MESSAGE_LEADING_STYLE_TOKENS } from './styles';
import type { MessageLeadingExposes, MessageLeadingProps } from './types';

export const MessageLeading = definePrototype<MessageLeadingProps, MessageLeadingExposes>({
  name: 'chatui-message-leading',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'leading' });
    def.feedback.style.use(tw(MESSAGE_LEADING_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
