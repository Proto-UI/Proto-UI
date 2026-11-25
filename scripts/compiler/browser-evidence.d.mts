import type { BrowserCompilerBuild } from '../../packages/compiler/src/browser/protocol';
export interface BrowserBuildEvidence {
  format: 2;
  kind: 'canonical-browser-build-inputs-v2';
  sourcePolicy: 'workspace-superset-and-esbuild-inputs-v1';
  compilerBuild: BrowserCompilerBuild;
  targetModulesSha256: Record<string, string>;
  inputGroups: {
    compiler: string[];
    targets: Record<string, string[]>;
    delivery: string[];
  };
  assets: Record<string, string>;
  sourceFiles: Record<string, string>;
}
export function captureCurrentBrowserEvidence(): Promise<BrowserBuildEvidence>;
export function browserEvidenceRecord(manifest: BrowserBuildEvidence): {
  sourceFiles: Record<string, string>;
  buildManifest: Omit<BrowserBuildEvidence, 'sourceFiles'>;
};
export function verifyRecordedBrowserEvidence(
  receipt: unknown,
  current: BrowserBuildEvidence
): void;
