import { definePrototype, tw } from '@proto.ui/core';
import { CODE_BLOCK_FAMILY } from './shared';
import { CODE_BLOCK_HEADER_STYLE_TOKENS } from './styles';
import type { CodeBlockHeaderExposes, CodeBlockHeaderProps } from './types';

export const CodeBlockHeader = definePrototype<CodeBlockHeaderProps, CodeBlockHeaderExposes>({
  name: 'chatui-code-block-header',
  setup(def) {
    def.anatomy.claim(CODE_BLOCK_FAMILY, { role: 'header' });
    def.feedback.style.use(tw(CODE_BLOCK_HEADER_STYLE_TOKENS));
    return (renderer) => renderer.r.slot();
  },
});
