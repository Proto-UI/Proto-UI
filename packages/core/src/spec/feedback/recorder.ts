// packages/core/src/spec/feedback/recorder.ts

import type { StyleHandle } from './style';
import { getSemanticGroupKeyV0 } from './semantic-merge';
import { assertTwTokenV0 } from './tokens';
import {
  createRootStyleEffect,
  mergeRootStyleEntries,
  readRootStyleEntries,
  resolveRootStyleEntry,
  type RootStyleEffect,
  type RootStyleEntry,
  type RootStyleOrigin,
} from './root-effect';

export type UnUse = () => void;

type Chunk = {
  id: number;
  entries: readonly RootStyleEntry[];
  removed: boolean;
};

type PatchEntry =
  | {
      kind: 'patch';
      entry: RootStyleEntry;
    }
  | {
      kind: 'suppress';
    };

export class FeedbackStyleRecorder {
  private nextId = 1;
  private chunks: Chunk[] = [];
  private runtimePatch = new Map<string, PatchEntry>();

  /**
   * setup-only: record style intent tokens (tw handles only)
   */
  use(...handles: StyleHandle[]): UnUse {
    return this.recordAuthorHandles(handles, 'setup');
  }

  /** Internal Rule contribution; replay keeps this origin rather than reclassifying. */
  useRuntime(...handles: StyleHandle[]): UnUse {
    return this.recordAuthorHandles(handles, 'rule');
  }

  private recordAuthorHandles(handles: StyleHandle[], origin: RootStyleOrigin): UnUse {
    // flatten & validate
    const flattened: string[] = [];
    for (const h of handles) {
      if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens)) {
        throw new Error(`[feedback] unsupported style handle in v0`);
      }
      for (const t of h.tokens) {
        assertTwTokenV0(t, 'feedback.style.use');
        flattened.push(t);
      }
    }

    const chunk: Chunk = {
      id: this.nextId++,
      entries: flattened.map((t) => resolveRootStyleEntry(t, origin)),
      removed: false,
    };

    this.chunks.push(chunk);

    const unUse: UnUse = () => {
      chunk.removed = true;
    };

    return unUse;
  }

  /**
   * internal: record style tokens without v0 tw validation.
   * Used by rule extensions that generate selector-based tokens.
   */
  useUnsafe(...handles: StyleHandle[]): UnUse {
    const flattened: RootStyleEntry[] = [];
    for (const h of handles) {
      if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens)) {
        throw new Error(`[feedback] unsupported style handle in v0`);
      }
      for (const t of h.tokens) {
        if (typeof t !== 'string' || !t) {
          throw new Error(`[feedback] invalid tw token (unsafe): empty`);
        }
      }
      flattened.push(...readRootStyleEntries(h, 'rule'));
    }

    const chunk: Chunk = {
      id: this.nextId++,
      entries: createRootStyleEffect(flattened).entries,
      removed: false,
    };

    this.chunks.push(chunk);

    const unUse: UnUse = () => {
      chunk.removed = true;
    };

    return unUse;
  }

  /**
   * runtime-only: write positive style patches over the current base result.
   */
  patch(...handles: StyleHandle[]): void {
    for (const token of this.flattenRuntimePatchHandles(handles, 'run.feedback.style.patch')) {
      this.runtimePatch.set(getSemanticGroupKeyV0(token), {
        kind: 'patch',
        entry: resolveRootStyleEntry(token, 'runtime'),
      });
    }
  }

  /**
   * runtime-only: suppress semantic groups from the current base result.
   */
  suppress(...handles: StyleHandle[]): void {
    for (const token of this.flattenRuntimePatchHandles(handles, 'run.feedback.style.suppress')) {
      this.runtimePatch.set(getSemanticGroupKeyV0(token), { kind: 'suppress' });
    }
  }

  /**
   * runtime-only: remove every style patch entry for the current instance.
   */
  clearPatch(): void {
    this.runtimePatch.clear();
  }

  /**
   * Export a semantic snapshot of merged tokens.
   *
   * v0 recommendation: export is allowed in any phase (pure snapshot).
   */
  export(): { tokens: string[] } {
    return this.exportWithAdditional();
  }

  /**
   * Export a semantic snapshot after appending additional base style handles,
   * then applying the runtime patch layer.
   *
   * Additional handles are used by rule/runtime internals: they are still part of
   * the pre-patch base semantic result, not host translation artifacts.
   */
  exportWithAdditional(...handles: StyleHandle[]): { tokens: string[] } {
    return { tokens: this.exportRootEffect(...handles).tokens };
  }

  exportBase(): { tokens: string[] } {
    return { tokens: this.exportBaseEntries().map((entry) => entry.token) };
  }

  /** Internal Root-only effect snapshot. Public export retains its token-only shape. */
  exportRootEffect(...handles: StyleHandle[]): RootStyleEffect {
    return createRootStyleEffect(this.applyPatchLayer(this.exportBaseEntries(handles)));
  }

  private exportBaseEntries(additionalHandles: StyleHandle[] = []): RootStyleEntry[] {
    const inputs: RootStyleEntry[] = [];
    for (const c of this.chunks) {
      if (c.removed) continue;
      inputs.push(...c.entries);
    }
    for (const h of additionalHandles) {
      if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens)) {
        throw new Error(`[feedback] unsupported style handle in v0`);
      }
      inputs.push(...readRootStyleEntries(h, 'rule'));
    }
    return mergeRootStyleEntries(inputs);
  }

  private applyPatchLayer(baseEntries: RootStyleEntry[]): RootStyleEntry[] {
    if (this.runtimePatch.size === 0) return baseEntries;

    const patchEntries: RootStyleEntry[] = [];
    const baseAfterSuppress: RootStyleEntry[] = [];

    for (const entry of baseEntries) {
      if (this.runtimePatch.has(getSemanticGroupKeyV0(entry.token))) continue;
      baseAfterSuppress.push(entry);
    }

    for (const entry of this.runtimePatch.values()) {
      if (entry.kind === 'patch') patchEntries.push(entry.entry);
    }

    return mergeRootStyleEntries([...baseAfterSuppress, ...patchEntries]);
  }

  private flattenRuntimePatchHandles(handles: StyleHandle[], op: string): string[] {
    const flattened: string[] = [];
    for (const h of handles) {
      if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens)) {
        throw new Error(`[feedback] unsupported style handle in v0`);
      }
      for (const t of h.tokens) {
        assertTwTokenV0(t, op);
        if (t === 'data-pui-style') {
          throw new Error(`[feedback] invalid tw token (${op}): host style artifact is forbidden`);
        }
        flattened.push(t);
      }
    }
    return flattened;
  }
}
