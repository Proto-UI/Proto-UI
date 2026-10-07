import type { Prototype } from '@proto.ui/core';
import type { FinalStyleSink } from '@proto.ui/module-feedback/internal/final-style-sink';
import type { OwnedVisualSurface } from '../visual-surface';
import type { OwnedTokenApplier } from '../feedback-style';

/** Private test/development admission; intentionally absent from package exports. */
export type ExperimentalVisualConsumer = (
  host: HTMLElement,
  style: OwnedTokenApplier,
  surface: OwnedVisualSurface
) => FinalStyleSink;
const consumers = new WeakMap<object, ExperimentalVisualConsumer>();
export function installExperimentalVisualConsumer(
  proto: Prototype<any, any>,
  factory: ExperimentalVisualConsumer
): () => void {
  if (consumers.has(proto)) throw new Error('Prototype already has a private visual consumer');
  consumers.set(proto, factory);
  return () => {
    if (consumers.get(proto) === factory) consumers.delete(proto);
  };
}
export function getExperimentalVisualConsumer(
  proto: Prototype<any, any>
): ExperimentalVisualConsumer | undefined {
  return consumers.get(proto);
}
