import type { VisualFeedbackFrame, VisualFeedbackSink } from './shared-sink';

/** One physical-view lease. Provider allocation starts only when Feedback commits.
 * The factory stays a host function, never part of portable material intent.
 * A null provider preserves ordinary style and makes no optical-support claim.
 */
export function createDeferredViewVisualSink(
  factory: () => VisualFeedbackSink | null,
  ordinaryStyle: (frame: VisualFeedbackFrame) => void
): VisualFeedbackSink {
  let acquired = false;
  let acquiring = false;
  let retired = false;
  let provider: VisualFeedbackSink | null = null;
  let current: VisualFeedbackFrame | null = null;
  let view: number | null = null;
  let revision = -1;
  let failed = false;
  return {
    commit(frame) {
      if (retired) return;
      if (
        !Number.isSafeInteger(frame.view) ||
        frame.view < 0 ||
        !Number.isSafeInteger(frame.revision) ||
        frame.revision < 0
      )
        throw new Error('Invalid visual frame identity');
      if (view !== null && frame.view !== view)
        throw new Error('Visual sink crossed its view lease');
      if (frame.revision < revision || (frame.revision === revision && !failed)) return;
      failed = false;
      view = frame.view;
      revision = frame.revision;
      current = frame;
      if (acquiring) return;
      if (!acquired) {
        acquiring = true;
        let next: VisualFeedbackSink | null;
        try {
          next = factory();
        } catch (error) {
          // The same final intent remains retryable after an allocation failure.
          failed = true;
          throw error;
        } finally {
          acquiring = false;
        }
        if (retired) {
          next?.release(frame.view);
          return;
        }
        provider = next;
        acquired = true;
      }
      if (!current || retired) return;
      try {
        if (provider) provider.commit(current);
        else ordinaryStyle(current);
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    release(releasedView) {
      if (retired) return;
      if (view !== null && releasedView !== view) return;
      retired = true;
      current = null;
      const previous = provider;
      provider = null;
      previous?.release(releasedView);
    },
  };
}
