import type { BinaryLike } from 'node:crypto';
import type { Buffer } from 'node:buffer';

export const FIXTURE_ASSETS: readonly ['app.js', 'fixture.css', 'index.html', 'tokens.css'];
export const FIXTURE_GENERATORS: readonly string[];
export type FixtureFileBinding = Readonly<{ file: string; sha256: string }>;
export type FixtureBinding = Readonly<{
  bindingVersion: 1;
  sourceSha: string;
  tree: string;
  dirty: boolean;
  assets: FixtureFileBinding[];
  sources: FixtureFileBinding[];
}>;
export function sha256(bytes: BinaryLike): string;
export function createFixtureBinding(
  repoRoot: string,
  bundleRoot: string,
  sourceInputs: readonly string[]
): Promise<FixtureBinding>;
export function verifyFixtureBinding(
  manifest: unknown,
  repoRoot: string,
  bundleRoot: string
): Promise<Map<string, string>>;
export function readBoundFixtureFile(
  root: string,
  file: string,
  bindings: ReadonlyMap<string, string>
): Promise<Buffer>;
