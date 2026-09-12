export type MessageAlignment = 'start' | 'end' | 'stretch';
export type MessageTone = 'default' | 'user' | 'assistant' | 'system';
export type MessageSpacing = 'default' | 'compact';

export type MessageRootProps = {
  alignment?: MessageAlignment;
  tone?: MessageTone;
  spacing?: MessageSpacing;
};
export type MessageRootExposes = Record<never, never>;

export type MessageLeadingProps = Record<never, never>;
export type MessageLeadingExposes = Record<never, never>;

export type MessageHeaderProps = Record<never, never>;
export type MessageHeaderExposes = Record<never, never>;

export type MessageContentProps = Record<never, never>;
export type MessageContentExposes = Record<never, never>;

export type MessageFooterProps = Record<never, never>;
export type MessageFooterExposes = Record<never, never>;

export type MessageActionsProps = Record<never, never>;
export type MessageActionsExposes = Record<never, never>;
