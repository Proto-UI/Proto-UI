/** Types for the existing data validators; no declaration constitutes native evidence. */
export const VIEW_OPERATION_CASES: readonly [
  'remove-root',
  'remove-source',
  'unrelated-reinsert',
  'terminal-replacement',
  'owned-transport',
  'nested-author-remove',
  'second-reconnect',
  'aborted-transport',
];
export function expectedReactionPhases(name: string): string[];
export function expectedChecks(name: string): Record<string, string | number | boolean>;
/** Untrusted observations may throw; successful validation does not narrow arbitrary caller data. */
export function assertViewOperationCase(result: unknown, name: string): void;
export function assertViewOperationReceipt(
  receipt: unknown,
  source: unknown,
  expected: { revision: string; tree: string }
): void;
