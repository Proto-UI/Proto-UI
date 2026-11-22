/** Identity of the supported source-pinned build, not a published profile admission. */
export interface CompilerBuildIdentity {
  readonly schema: 'proto-ui.compiler-build.v1';
  readonly revision: string;
  readonly lockSha256: string;
  readonly profilesSha256: string;
  readonly node: string;
  readonly typescript: string;
  readonly esbuild: string;
}

// The pinned builder replaces this module from its verified checkout inputs.
// Unbundled development execution deliberately has no pinned-build identity.
export const compilerBuildIdentity: CompilerBuildIdentity | null = null;
