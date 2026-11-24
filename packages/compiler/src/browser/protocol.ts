import type { CompilerDiagnostic } from '../diagnostics';

export const BROWSER_COMPILER_LIMITS = Object.freeze({
  inputBytes: 256 * 1024,
  outputCharacters: 2 * 1024 * 1024,
  initializationMs: 10_000,
  compilationMs: 10_000,
  workerResponseMs: 15_000,
});

export interface BrowserCompileRequest {
  format: 1;
  revision: string;
  source: string;
  options: {
    profile: string | { profile?: string; [key: string]: unknown };
    fileName: string;
    files?: Readonly<Record<string, string>>;
    sourceImports?: Readonly<Record<string, string>>;
    exportName?: string;
    componentName?: string;
  };
  preview?: boolean;
}

export interface BrowserPreviewArtifact {
  format: 1;
  entry: string;
  modules: Record<string, string>;
  styles: string[];
  events: string[];
  executionBudget: '100000-checkpoints-per-task-v1';
}

export interface BrowserGeneratedModule {
  code: string;
  profile: string;
  supportingFiles?: readonly {
    path: string;
    contents: string;
    kind: 'source' | 'style' | 'declaration';
  }[];
  dependencies: readonly { name: string; version: string; role: string }[];
}

export type BrowserCompileResult =
  | {
      ok: true;
      revision: string;
      requestSha256: string;
      source: { file: string; exportName: string; sha256: string };
      output: BrowserGeneratedModule;
      preview?: BrowserPreviewArtifact;
    }
  | {
      ok: false;
      revision: string;
      requestSha256: string;
      phase: 'compile';
      diagnostics: readonly CompilerDiagnostic[];
    }
  | {
      ok: false;
      revision: string;
      phase: 'host';
      requestSha256?: string;
      error: {
        code:
          | 'invalid-request'
          | 'input-limit'
          | 'execution-limit'
          | 'wasm-execution'
          | 'preview-policy'
          | 'disposed';
        message: string;
      };
    };

export interface BrowserCompilerBuild {
  format: 1;
  compilerSha256: string;
  typescriptVersion: string;
  execution: 'worker-js' | 'quickjs-wasm';
}

export interface CompilerWorkerResponse {
  type: 'compiled';
  id: number;
  requestSha256: string;
  result: BrowserCompileResult;
  build: BrowserCompilerBuild;
  elapsedMs: number;
}
