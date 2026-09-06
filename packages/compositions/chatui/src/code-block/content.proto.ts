import { definePrototype, tw } from '@proto.ui/core';
import { CODE_BLOCK_FAMILY } from './shared';
import { CODE_BLOCK_CONTENT_STYLE_TOKENS } from './styles';
import type { CodeBlockContentExposes, CodeBlockContentProps } from './types';

export const CodeBlockContent = definePrototype<CodeBlockContentProps, CodeBlockContentExposes>({
  name: 'chatui-code-block-content',
  setup(def) {
    def.anatomy.claim(CODE_BLOCK_FAMILY, { role: 'content' });
    def.feedback.style.use(tw(CODE_BLOCK_CONTENT_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
