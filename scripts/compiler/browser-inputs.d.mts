import type { Metafile } from 'esbuild';
export const browserRepositoryRoot: string;
export const browserRepositoryInputPaths: string[];
export function digest(bytes: string | Uint8Array): string;
export function relativeInputPath(file: string, root?: string): string;
export function hashInputFiles(files: string[], root?: string): Promise<Record<string, string>>;
export function hashMetafileInputs(
  metafile: Metafile,
  root?: string
): Promise<Record<string, string>>;
export function snapshotBrowserRepositoryInputs(root?: string): Promise<Record<string, string>>;
export function assertSameInputFiles(
  recorded: Record<string, string>,
  current: Record<string, string>
): void;
export function mergeInputFiles(...inventories: Record<string, string>[]): Record<string, string>;
export function assertSameBrowserEvidence(recorded: unknown, current: unknown): void;
