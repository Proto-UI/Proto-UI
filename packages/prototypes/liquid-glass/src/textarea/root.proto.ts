import { definePrototype } from '@proto.ui/core';
import { asTextareaRoot, type TextareaRootExposes } from '@proto.ui/prototypes-base/textarea';
import { setupLiquidTextareaVisual, type LiquidGlassTextareaMaterialProps } from './visual';

export type LiquidGlassTextareaRootProps = LiquidGlassTextareaMaterialProps;

export default definePrototype<LiquidGlassTextareaRootProps, TextareaRootExposes>({
  name: 'liquid-glass-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const inherited = asTextareaRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-textarea-root] Base Textarea states are required.');
    setupLiquidTextareaVisual(def, state);
    // Preserve Base's null render and one multiline host-owned editor.
    return inherited.render;
  },
});
