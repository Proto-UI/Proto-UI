import { createRuntimeSession } from '../../../../packages/runtime/src';
import { EFFECTS_CAP } from '../../../../packages/modules/feedback/src';
import type { StyleHandle } from '@proto.ui/core';
import { libraryCardPrototypes, type LibraryPart } from './library-card-prototypes';

/** Execute the real passive Prototype through the real Runtime during Astro
 * rendering. This is a first-frame projection, not a second handwritten skin.
 * No material provider is installed: optical Surface intent keeps its honest
 * opaque fallback on both server and client. */
export async function snapshotLibraryPart(part: LibraryPart, props: Record<string, unknown>) {
  let tokens: string[] = [];
  const prototype = libraryCardPrototypes[part];
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => props,
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('feedback', [
        [
          EFFECTS_CAP,
          {
            queueStyle(style: StyleHandle) {
              tokens = [...style.tokens];
            },
            requestFlush() {},
          },
        ],
      ]);
    },
  });
  try {
    await session.mount();
    return tokens;
  } finally {
    await session.dispose();
  }
}
