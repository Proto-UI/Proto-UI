import { definePrototype, tw } from '@proto.ui/core';
import { MESSAGE_FAMILY } from './shared';
import { MESSAGE_ACTIONS_STYLE_TOKENS } from './styles';
import type { MessageActionsExposes, MessageActionsProps } from './types';

export const MessageActions = definePrototype<MessageActionsProps, MessageActionsExposes>({
  name: 'chatui-message-actions',
  setup(def) {
    def.anatomy.claim(MESSAGE_FAMILY, { role: 'actions' });
    def.feedback.style.use(tw(MESSAGE_ACTIONS_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
