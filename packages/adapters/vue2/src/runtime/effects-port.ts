import { mergeTwTokensV0, type EffectsPort, type StyleHandle } from '@proto.ui/core';

export function createVue2EffectsPort(setHostTokens: (next: string[]) => void): EffectsPort {
  let latest: StyleHandle | null = null;
  let flushing = false;

  const flush = () => {
    if (flushing) return;
    flushing = true;
    try {
      const handle = latest;
      if (!handle) return;
      if (handle.kind === 'tw') {
        const merged = mergeTwTokensV0(handle.tokens).tokens;
        setHostTokens(merged);
      }
    } finally {
      flushing = false;
    }
  };

  return {
    queueStyle(handle) {
      latest = handle;
    },
    requestFlush() {
      flush();
    },
    flushNow() {
      flush();
    },
  };
}
