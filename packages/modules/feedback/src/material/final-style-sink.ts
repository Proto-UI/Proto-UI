import { cap, type StyleHandle } from '@proto.ui/core';
import type { OwnedMaterialFrame } from './owned-slot';

/** Private draft seam. A final style input is not an admitted material frame. */
export type FinalStyleFrame = Readonly<{
  view: number;
  revision: number;
  style: Readonly<{ kind: 'tw'; tokens: readonly string[] }>;
  material: OwnedMaterialFrame | null;
}>;

/**
 * One host consumer owns the entire visual projection when installed. It must
 * resolve material, provenance, geometry and fallback before publishing paint.
 * Feedback never also sends the same frame through the legacy style sink.
 * This capability is intentionally absent from the package's public exports.
 */
export interface FinalStyleSink {
  commit(frame: FinalStyleFrame): void;
  release(view: number): void;
}

export const FINAL_STYLE_SINK_CAP = cap<FinalStyleSink>(
  '@proto.ui/feedback/experimental-final-style-sink'
);

export function finalStyleFrame(
  style: StyleHandle,
  view: number,
  revision: number,
  material: OwnedMaterialFrame | null = null
): FinalStyleFrame {
  return Object.freeze({
    view,
    revision,
    material,
    style: Object.freeze({ kind: 'tw' as const, tokens: Object.freeze([...style.tokens]) }),
  });
}
