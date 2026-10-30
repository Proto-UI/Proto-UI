/** Existing CI planning/validation exports. Unknown receipt inputs are validated at runtime. */
export interface RuntimeCiPlan {
  checkoutSha: string;
  general: string[];
  browser: string[][];
  productionExcluded: string[];
}
export interface RuntimeSelection {
  checkoutSha: string;
  phase: string;
  shard: string | null;
  suites: string[];
}
export interface RuntimeCiContext {
  runId: string;
  attempt: number;
  eventSha: string;
  checkoutSha: string;
}
export interface RuntimeSlotReceipt extends RuntimeCiContext {
  schemaVersion: 1;
  slot: string;
  outcome: 'success';
  payload: unknown;
}
export const runtimeRoot: string;
export const runtimeSlots: string[];
export function checkoutSha(root?: string): string;
export function createCiPlan(sha?: string): RuntimeCiPlan;
export function runtimeSelection(
  phase: string,
  shard?: string,
  plan?: RuntimeCiPlan
): RuntimeSelection;
/** Throws for missing, failed, skipped browser or inconsistent report data; no type predicate. */
export function assertVitestReport(report: unknown, selection: unknown, root?: string): void;
export function assertRuntimeGate(
  needs: unknown,
  plan: unknown,
  receipts: unknown,
  sha?: string
): void;
export function ciContext(
  env?: Record<string, string | undefined>,
  actualSha?: string
): RuntimeCiContext;
export function artifactName(input: { runId: string; attempt: number; slot: string }): string;
export function latestSlotReceipts(
  artifacts: unknown,
  context: RuntimeCiContext
): RuntimeSlotReceipt[];
export function assertCiGate(needs: unknown, artifacts: unknown, context?: RuntimeCiContext): void;
export function finishCiSlot(
  directory: string,
  slot: string,
  outcome: string,
  context?: RuntimeCiContext
): void;
export function writeJson(file: string, value: unknown): void;
