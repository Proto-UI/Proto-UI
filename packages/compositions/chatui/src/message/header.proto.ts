import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import { MESSAGE_HEADER_STYLE_TOKENS } from './styles';
import type { MessageHeaderExposes, MessageHeaderProps } from './types';

export const MessageHeader = definePrototype<MessageHeaderProps, MessageHeaderExposes>({
  name: 'chatui-message-header',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'header' });
    def.feedback.style.use(tw(MESSAGE_HEADER_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
