import type { MessageAlignment, MessageSpacing, MessageTone } from './types';

export const MESSAGE_ROOT_STYLE_TOKENS =
  'flex min-w-0 max-w-full flex-col rounded-lg border border-border';
export const MESSAGE_LEADING_STYLE_TOKENS = 'flex items-center gap-2 text-sm';
export const MESSAGE_HEADER_STYLE_TOKENS =
  'flex min-w-0 items-center justify-between gap-2 text-sm font-medium';
export const MESSAGE_CONTENT_STYLE_TOKENS =
  'block min-w-0 whitespace-pre-wrap wrap-anywhere text-sm leading-6';
export const MESSAGE_FOOTER_STYLE_TOKENS =
  'flex min-w-0 items-center gap-2 text-xs text-muted-foreground';
export const MESSAGE_ACTIONS_STYLE_TOKENS = 'flex min-w-0 flex-wrap items-center gap-2';

export const MESSAGE_ALIGNMENT_STYLE_TOKENS: Record<MessageAlignment, string> = {
  start: 'w-fit me-auto',
  end: 'w-fit ms-auto',
  stretch: 'w-full',
};
export const MESSAGE_TONE_STYLE_TOKENS: Record<MessageTone, string> = {
  default: 'bg-muted/30 text-foreground',
  user: 'bg-primary/10 text-foreground',
  assistant: 'bg-background text-foreground',
  system: 'bg-transparent text-muted-foreground',
};
export const MESSAGE_SPACING_STYLE_TOKENS: Record<MessageSpacing, string> = {
  default: 'gap-3 p-4',
  compact: 'gap-2 p-2',
};
