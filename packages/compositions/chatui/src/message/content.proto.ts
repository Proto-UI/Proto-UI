import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import { MESSAGE_CONTENT_STYLE_TOKENS } from './styles';
import type { MessageContentExposes, MessageContentProps } from './types';

export const MessageContent = definePrototype<MessageContentProps, MessageContentExposes>({
  name: 'chatui-message-content',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'content' });
    def.feedback.style.use(tw(MESSAGE_CONTENT_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
