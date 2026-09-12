import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import { MESSAGE_FOOTER_STYLE_TOKENS } from './styles';
import type { MessageFooterExposes, MessageFooterProps } from './types';

export const MessageFooter = definePrototype<MessageFooterProps, MessageFooterExposes>({
  name: 'chatui-message-footer',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'footer' });
    def.feedback.style.use(tw(MESSAGE_FOOTER_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
