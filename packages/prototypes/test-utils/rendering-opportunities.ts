import { vi } from 'vitest';

/** Explicit happy-dom frame delivery; it does not advance the semantic timer clock. */
export function installRenderingOpportunities() {
  let serial = 0;
  let timestamp = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++serial, callback);
    return serial;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  const restore = () => {
    request.mockRestore();
    cancel.mockRestore();
    callbacks.clear();
  };
  const frame = async () => {
    const current = [...callbacks.entries()];
    let delivered = 0;
    timestamp += 1000 / 60;
    for (const [id, callback] of current) {
      if (callbacks.get(id) !== callback) continue;
      callbacks.delete(id);
      callback(timestamp);
      ++delivered;
    }
    for (let i = 0; i < 8; ++i) await Promise.resolve();
    return delivered;
  };
  return Object.assign(frame, { restore });
}
