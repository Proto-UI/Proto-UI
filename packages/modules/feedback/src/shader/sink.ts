import { cap, type ShaderPresentationDeclaration } from '@proto.ui/core';
import type { FinalStyleSnapshot } from '../material/final-style-sink';

/** A complete immutable input; receiving it does not prove shader paint support. */
export type ShaderPresentationFrame = Readonly<{
  /** Monotonic owner-local physical binding generation, including capability replacement. */
  view: number;
  revision: number;
  style: FinalStyleSnapshot;
  declaration: ShaderPresentationDeclaration;
}>;

/** The host owns GPU resources and physical publication, never author State. */
export interface ShaderPresentationSink {
  commit(frame: ShaderPresentationFrame): void;
  /** Terminal for this binding; a reacquired capability receives a newer generation. */
  release(view: number): void;
  diagnostics?(): readonly string[];
}

export const SHADER_PRESENTATION_SINK_CAP = cap<ShaderPresentationSink>(
  '@proto.ui/feedback/shader-presentation-v1'
);
