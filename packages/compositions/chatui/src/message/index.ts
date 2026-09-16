import { MessageActions } from './actions.proto';
import { MessageContent } from './content.proto';
import { MessageFooter } from './footer.proto';
import { MessageHeader } from './header.proto';
import { MessageLeading } from './leading.proto';
import { MessageRoot } from './root.proto';

export type {
  MessageActionsExposes,
  MessageActionsProps,
  MessageAlignment,
  MessageContentExposes,
  MessageContentProps,
  MessageFooterExposes,
  MessageFooterProps,
  MessageHeaderExposes,
  MessageHeaderProps,
  MessageLeadingExposes,
  MessageLeadingProps,
  MessageRootExposes,
  MessageRootProps,
  MessageSpacing,
  MessageTone,
} from './types';

export const Message = {
  Root: MessageRoot,
  Leading: MessageLeading,
  Header: MessageHeader,
  Content: MessageContent,
  Footer: MessageFooter,
  Actions: MessageActions,
} as const;
