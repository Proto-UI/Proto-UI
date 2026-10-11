import { mergeTwTokensV0, type EffectsPort, type StyleHandle } from '@proto.ui/core';

export function createReactEffectsPort(setHostTokens: (next: string[]) => void): EffectsPort {
  let latest: StyleHandle | null = null;
  let flushing = false;
  let revision = 0;

  const flush = () => {
    if (flushing) return;
    flushing = true;
    try {
      let committed: number;
      do {
        committed = revision;
        const handle = latest;
        if (!handle) return;
        if (handle.kind === 'tw') {
          const merged = mergeTwTokensV0(handle.tokens).tokens;
          setHostTokens(merged);
        }
        // A synchronous host write can re-enter Feedback. Commit its newest
        // replacement before returning instead of dropping the nested flush.
      } while (committed !== revision);
    } finally {
      flushing = false;
    }
  };

  return {
    queueStyle(handle) {
      latest = handle;
      revision++;
    },
    requestFlush() {
      flush();
    },
    flushNow() {
      flush();
    },
  };
}
