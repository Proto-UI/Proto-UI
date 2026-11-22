import type { ChildProcess } from 'node:child_process';
export interface LocalBrowserServiceConfiguration {
  root: string;
  cwd: string;
  executable: string;
  host: string;
  port: number;
  url: string;
  command: string[];
}
export function localBrowserServiceConfiguration(
  environment: Record<string, string | undefined>,
  root: string,
  executable: string
): LocalBrowserServiceConfiguration;
export function assertLoopbackPortAvailable(port: number): Promise<void>;
export function observedAstroLocalURL(log: string, expectedURL: string): string | undefined;
export function childIsAlive(child: ChildProcess | undefined): boolean;
export function verifyOwnedBrowserService(service: unknown): void;
