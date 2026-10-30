// Neutral content projection: a readable plain table, not an optical surface.
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import {
  tableRoot,
  type TableRootProps,
  type TableRootExposes,
} from '@proto.ui/prototypes-base/table';

// The public helper owns setup, once-policy, trace and capture over the exact
// Base Table Root prototype. base tableRoot.setup is never invoked directly.
const asLiquidGlassTableRoot = defineAsHook<TableRootProps, TableRootExposes, {}>({
  ...tableRoot,
  name: 'as-liquid-glass-table-root',
});

export const liquidGlassTableRoot = definePrototype<TableRootProps, TableRootExposes>({
  name: 'liquid-glass-table-root',
  modules: asLiquidGlassTableRoot.modules,
  setup(def) {
    const behavior = asLiquidGlassTableRoot();
    // Base owns the Table Structure domain, the anonymous descendant slot and
    // getStructure; it synthesizes no Head/Body/RowGroup parts and exposes no
    // sorting, selection, focus or styling channel. The family adds only
    // neutral readable content layout. CSS table layout does not realize
    // native rowspan/colspan; an outer consumer owns overflow scrolling.
    def.feedback.style.use(
      tw('table border-collapse border-spacing-0 min-w-0 max-w-full w-full text-foreground text-sm')
    );
    return behavior.render;
  },
});

export default liquidGlassTableRoot;
