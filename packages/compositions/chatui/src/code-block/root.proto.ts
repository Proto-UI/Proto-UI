import { definePrototype, tw } from '@proto.ui/core';
import { CODE_BLOCK_FAMILY } from './shared';
import { CODE_BLOCK_STYLE_TOKENS } from './styles';
import type { CodeBlockRootExposes, CodeBlockRootProps } from './types';

export const CodeBlockRoot = definePrototype<CodeBlockRootProps, CodeBlockRootExposes>({
  name: 'chatui-code-block-root',
  setup(def) {
    def.anatomy.claim(CODE_BLOCK_FAMILY, { role: 'root' });
    def.feedback.style.use(tw(CODE_BLOCK_STYLE_TOKENS.root));
    return (renderer) => renderer.r.slot();
  },
});
