/** Declaration-only model of the existing socket-free inventory and plan module. */
export const READY_ROUTES: readonly string[];
export const BROWSER_SUITES: readonly string[];
export const PRODUCTION_BROWSER_SUITES: readonly string[];
export const PRODUCTION_BROWSER_OWNERS: Readonly<Record<string, string>>;
export const BROWSER_SHARD_COUNT: 8;
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
