import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import {
  getWebPortalMaterialEpochSnapshot,
  subscribeWebPortalMaterialSuspension,
} from './portal-destination';

type Sink = OwnedDecorationBinding['sink'];
type Paint = Parameters<Sink>[0];
type Entry = { write: Sink; latest?: Paint; published?: string; revision: number };

/**
 * Private transport gate for one same-document physical view. It stores only
 * latest already-merged paint; logical contribution ownership stays in Feedback.
 */
export function createWebOwnedDecorationPortalGate(host: HTMLElement, isCurrent: () => boolean) {
  const document = host.ownerDocument;
  const entries = new Set<Entry>();
  let owner: object | null = null;
  let phase: 'waiting' | 'active' | 'retired' | 'disposed' = 'waiting';
  let reason: string | null = null;
  let generation = 0;
  let writing = false;
  const retiredOwners = new WeakSet<object>();
  let off = () => {};
  const live = () => phase === 'waiting' || phase === 'active';
  const retire = (why: string, clear: boolean) => {
    if (!live()) return;
    phase = 'retired';
    reason = why;
    generation++;
    off();
    // A replacement portal epoch may already own this host: never clear it.
    for (const entry of entries) {
      const current = getWebPortalMaterialEpochSnapshot(host);
      if (
        !clear ||
        !isCurrent() ||
        host.ownerDocument !== document ||
        !host.isConnected ||
        (current.owner !== null && current.owner !== owner)
      )
        break;
      if (entry.published !== undefined) entry.write({ kind: 'tw', tokens: [] });
    }
  };
  const flush = () => {
    const turn = generation;
    for (const entry of entries) {
      if (phase !== 'active' || turn !== generation || !isCurrent()) return;
      const current = getWebPortalMaterialEpochSnapshot(host);
      if (host.ownerDocument !== document || !host.isConnected) {
        retire('physical-view-unavailable', false);
        return;
      }
      if (current.owner !== owner || current.suspended) {
        retire('portal-epoch-retired', current.owner === owner);
        return;
      }
      if (!entry.latest) continue;
      const value = entry.latest,
        key = JSON.stringify(value.tokens);
      if (entry.published === key) continue;
      const previous = entry.published,
        revision = ++entry.revision;
      entry.published = key;
      try {
        writing = true;
        entry.write(value);
      } catch (error) {
        if (turn === generation && entry.revision === revision) entry.published = previous;
        throw error;
      } finally {
        writing = false;
      }
      if (getWebPortalMaterialEpochSnapshot(host).owner !== owner) {
        retire('reentrant-portal-replacement', false);
        return;
      }
    }
  };
  const reconcile = () => {
    if (!live()) return;
    if (!isCurrent() || host.ownerDocument !== document || !host.isConnected) {
      retire('physical-view-unavailable', false);
      return;
    }
    const current = getWebPortalMaterialEpochSnapshot(host);
    if (owner && current.owner !== owner) {
      if (writing) {
        retire('reentrant-portal-replacement', false);
        return;
      }
      retiredOwners.add(owner);
      generation++;
      const releasingGeneration = generation;
      // A released lease may clear only its own view. A replacement already
      // owns the host and must never receive an old lease's withdrawal.
      if (current.owner === null) {
        for (const entry of entries) {
          if (
            !live() ||
            !isCurrent() ||
            host.ownerDocument !== document ||
            getWebPortalMaterialEpochSnapshot(host).owner !== null
          )
            return;
          if (entry.published !== undefined) {
            entry.published = undefined;
            try {
              writing = true;
              entry.write({ kind: 'tw', tokens: [] });
            } finally {
              writing = false;
            }
            if (getWebPortalMaterialEpochSnapshot(host).owner !== current.owner) {
              retire('reentrant-portal-replacement', false);
              return;
            }
          }
        }
      }
      if (!live() || generation !== releasingGeneration) return;
      owner = null;
      phase = 'waiting';
      for (const entry of entries) entry.published = undefined;
    }
    if (!owner) {
      if (!current.owner) return;
      if (retiredOwners.has(current.owner)) {
        retire('retired-portal-owner', false);
        return;
      }
      owner = current.owner;
    }
    if (current.suspended) {
      if (phase === 'active') {
        phase = 'waiting';
        generation++;
        for (const entry of entries) {
          const now = getWebPortalMaterialEpochSnapshot(host);
          if (!live() || !isCurrent() || now.owner !== owner || !now.suspended) return;
          if (entry.published !== undefined) {
            entry.published = undefined;
            try {
              writing = true;
              entry.write({ kind: 'tw', tokens: [] });
            } finally {
              writing = false;
            }
            if (getWebPortalMaterialEpochSnapshot(host).owner !== current.owner) {
              retire('reentrant-portal-replacement', false);
              return;
            }
          }
        }
      }
      return;
    }
    phase = 'active';
    flush();
  };
  off = subscribeWebPortalMaterialSuspension(host, reconcile);
  return {
    wrap(write: Sink): Sink {
      if (!live()) throw new Error('[owned-decoration] retired portal gate');
      const entry: Entry = { write, revision: 0 };
      entries.add(entry);
      return (value) => {
        if (!live()) return;
        entry.latest = { kind: 'tw', tokens: [...value.tokens] };
        entry.revision++;
        reconcile();
      };
    },
    assertReusable() {
      const current = getWebPortalMaterialEpochSnapshot(host);
      if (
        phase !== 'active' ||
        !isCurrent() ||
        host.ownerDocument !== document ||
        !host.isConnected ||
        !owner ||
        current.owner !== owner ||
        current.suspended
      )
        throw new Error('[owned-decoration] unavailable portal reuse epoch');
    },
    status() {
      return { phase, reason };
    },
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed';
      generation++;
      off();
      entries.clear();
    },
  };
}
