// Neutral content projection: restrained caption typography only.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableCaption,
  type TableCaptionProps,
  type TableCaptionExposes,
} from '@proto.ui/prototypes-base/table';

const asLiquidGlassTableCaption = defineAsHook<TableCaptionProps, TableCaptionExposes, {}>({
  ...tableCaption,
  name: 'as-liquid-glass-table-caption',
});

export const liquidGlassTableCaption = definePrototype<TableCaptionProps, TableCaptionExposes>({
  name: 'liquid-glass-table-caption',
  modules: asLiquidGlassTableCaption.modules,
  setup(def) {
    const behavior = asLiquidGlassTableCaption();
    // Base owns the caption role within the nearest Table domain and the
    // authored slot. The family adds only secondary caption typography.
    def.feedback.style.use(tw('min-w-0 max-w-full text-left text-sm text-muted-foreground'));
    return behavior.render;
  },
});

export default liquidGlassTableCaption;
