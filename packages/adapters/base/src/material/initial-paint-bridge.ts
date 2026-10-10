import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import type { OpticalFrame } from './program';

/** Internal experiment bridge. Ordinary providers register nothing. No DOM
 * attribute, image URL or receipt string can create a lease through this file. */
export type InitialPaintLease = {
  permitsInline(name: string, value: readonly [string, string]): boolean;
  matches(visual: VisualFeedbackFrame, optical: OpticalFrame): boolean;
  matchesOutput(image: string): boolean;
  claim(): ReadonlyArray<readonly [string, string]> | null;
  finishClaim(): void;
  retire(): void;
};
const leases = new WeakMap<HTMLElement, InitialPaintLease>();
const captures = new WeakMap<
  HTMLElement,
  (visual: VisualFeedbackFrame, optical: OpticalFrame, image: string) => void
>();
export function registerInternalInitialPaintLease(host: HTMLElement, lease: InitialPaintLease) {
  if (leases.has(host)) throw new Error('initial-paint-already-registered');
  leases.set(host, lease);
  return () => {
    if (leases.get(host) === lease) leases.delete(host);
  };
}
export const readInternalInitialPaintLease = (host: HTMLElement) => leases.get(host) ?? null;
export function registerInternalInitialPaintCapture(
  host: HTMLElement,
  capture: (visual: VisualFeedbackFrame, optical: OpticalFrame, image: string) => void
) {
  if (captures.has(host)) throw new Error('initial-paint-capture-already-registered');
  captures.set(host, capture);
  return () => {
    if (captures.get(host) === capture) captures.delete(host);
  };
}
export function recordInternalInitialPaint(
  host: HTMLElement,
  visual: VisualFeedbackFrame,
  optical: OpticalFrame,
  image: string
) {
  // Diagnostic/export failure cannot alter a successfully admitted live frame.
  try {
    captures.get(host)?.(visual, optical, image);
  } catch {
    /* export reports its own failure */
  }
}
