import type { InitialPaintManifestBinding } from '../../packages/adapters/base/src/material/initial-paint-receipt.js';

/** Render only the exact artifact accepted by the existing receipt verifier. */
export function renderInitialPaintPage(
  serialized: string,
  binding: InitialPaintManifestBinding
): Promise<string>;
