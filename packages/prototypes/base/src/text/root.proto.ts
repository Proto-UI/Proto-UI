import { defineAsHook, definePrototype } from '@proto.ui/core';
import type { DefHandle, RenderFn } from '@proto.ui/core';
import type { TextRootExposes, TextRootProps } from './types';

function setupTextRoot(def: DefHandle<TextRootProps, TextRootExposes>): RenderFn {
  // P-BASE-TEXT-INPUTS: one reusable vocabulary, independent of document roles and pages.
  def.props.define({
    size: {
      type: 'enum',
      empty: 'fallback',
      options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'],
    },
    tone: { type: 'enum', empty: 'fallback', options: ['default', 'muted', 'inherit'] },
    weight: { type: 'enum', empty: 'fallback', options: ['normal', 'medium', 'semibold', 'bold'] },
    font: { type: 'enum', empty: 'fallback', options: ['body', 'heading', 'mono'] },
    leading: {
      type: 'enum',
      empty: 'fallback',
      options: ['size', 'tighter', 'tight', 'snug', 'normal', 'relaxed'],
    },
    tracking: { type: 'enum', empty: 'fallback', options: ['normal', 'tight', 'tighter'] },
    emphasis: { type: 'enum', empty: 'fallback', options: ['normal', 'italic'] },
    decoration: { type: 'enum', empty: 'fallback', options: ['none', 'underline', 'line-through'] },
  });
  def.props.setDefaults({
    size: 'base',
    tone: 'default',
    weight: 'normal',
    font: 'body',
    leading: 'normal',
    tracking: 'normal',
    emphasis: 'normal',
    decoration: 'none',
  });
  // P-BASE-TEXT-CONTENT, P-BASE-TEXT-PASSIVE: preserve content; never synthesize host semantics.
  return (renderer) => [renderer.r.slot()];
}

export const asTextRoot = defineAsHook<TextRootProps, TextRootExposes>({
  name: 'as-text-root',
  setup: setupTextRoot,
});

const textRoot = definePrototype<TextRootProps, TextRootExposes>({
  name: 'base-text-root',
  setup: setupTextRoot,
});
export default textRoot;
