/** Declaration-only model of the existing socket-free inventory and plan module. */
export const READY_ROUTES: readonly string[];
export const BROWSER_SUITES: readonly string[];
export const PRODUCTION_BROWSER_SUITES: readonly string[];
export const PRODUCTION_BROWSER_OWNERS: Readonly<Record<string, string>>;
export const BROWSER_SHARD_COUNT: 18;
export const BROWSER_EXECUTION_BUDGET_SECONDS: 900;
export const BROWSER_SETUP_RESERVE_SECONDS: 180;
export const BROWSER_MAX_ESTIMATED_SECONDS: number;
export const DEFAULT_BROWSER_SUITE_WEIGHT_SECONDS: 120;
export const BROWSER_SUITE_WEIGHT_SECONDS: Readonly<Record<string, number>>;
export interface BrowserCostEvidence {
  schemaVersion: 1;
  runId: number;
  headSha: string;
  observations: Array<{
    suite: string;
    durationMs: number;
    jobId: number;
    jobUrl: string;
    logSha256: string;
    fileOutcome: 'passed' | 'failed';
  }>;
}
export interface BrowserShardCost {
  estimatedSeconds: number;
  setupReserveSeconds: number;
  executionBudgetSeconds: number;
}
export function validateBrowserCostEvidence(evidence: unknown): BrowserCostEvidence;
export function browserSuiteWeightSeconds(suite: string): number;
export function browserShardCosts(shards?: readonly (readonly string[])[]): BrowserShardCost[];
export function assertBrowserShardCapacity(shards?: readonly (readonly string[])[]): void;
export function corepackInvocation(platform?: string): {
  executable: 'corepack' | 'corepack.cmd';
  shell: boolean;
};
export function discoverBrowserSuites(root?: string): string[];
export function assertBrowserInventory(
  discovered?: readonly string[],
  development?: readonly string[],
  production?: readonly string[]
): void;
export function browserShards(suites?: readonly string[], count?: number): string[][];
export function selectBrowserShard(shard?: string): string[];
export function createRuntimeTestPlan(
  rawArgs: string[],
  options?: { phase?: string; shard?: string }
): Array<{ needsServer: boolean; args: string[] }>;
