import type { StyleHandle } from './style';
import {
  classifyTwTokenApplicationRoleV0,
  type TwTokenApplicationRoleResolution,
} from './application-role';
import { mergeTwTokensV0 } from './semantic-merge';

export type RootStyleOrigin = 'setup' | 'rule' | 'runtime';

/** Internal effect information, never an author role qualifier or Template handle. */
export type RootStyleEntry = TwTokenApplicationRoleResolution &
  Readonly<{
    authorToken: string;
    origin: RootStyleOrigin;
  }>;

export type RootStyleEffect = StyleHandle & {
  readonly entries: readonly RootStyleEntry[];
};

export function resolveRootStyleEntry(token: string, origin: RootStyleOrigin): RootStyleEntry {
  // Legacy unsafe inputs may lack the author token. Do not guess from a selector.
  const resolution = token.includes(':')
    ? { token, role: 'unresolved' as const, roleSource: 'unresolved' as const }
    : classifyTwTokenApplicationRoleV0(token);
  return Object.freeze({ ...resolution, authorToken: token, origin });
}

export function createRootStyleEffect(entries: readonly RootStyleEntry[]): RootStyleEffect {
  const snapshot = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
  return { kind: 'tw', tokens: snapshot.map((entry) => entry.token), entries: snapshot };
}

/** Read internal effects while accepting legacy token-only effects for collapsed consumers. */
export function readRootStyleEntries(
  handle: StyleHandle,
  origin: RootStyleOrigin
): readonly RootStyleEntry[] {
  if (!('entries' in handle)) return handle.tokens.map((t) => resolveRootStyleEntry(t, origin));
  const entries = (handle as RootStyleEffect).entries;
  if (
    !Array.isArray(entries) ||
    entries.length !== handle.tokens.length ||
    entries.some((entry, index) => !entry || entry.token !== handle.tokens[index])
  ) {
    throw new Error('[feedback] Root style effect token/provenance mismatch');
  }
  return entries;
}

/** Existing physical-token group semantics; only the winning entry gains transport. */
export function mergeRootStyleEntries(entries: readonly RootStyleEntry[]): RootStyleEntry[] {
  const byToken = new Map(entries.map((entry) => [entry.token, entry]));
  return mergeTwTokensV0(entries.map((entry) => entry.token)).tokens.map(
    (token) => byToken.get(token)!
  );
}

/** Resolve author roles before Web selector lowering, retaining exact physical output. */
export function lowerRootStyleTokens(tokens: readonly string[], prefix: string): RootStyleEffect {
  return createRootStyleEffect(
    tokens.map((token) => ({
      ...resolveRootStyleEntry(token, 'rule'),
      token: `${prefix}:${token}`,
    }))
  );
}
