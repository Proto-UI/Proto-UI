import type { CompilerDiagnostic } from '../diagnostics';

export const BROWSER_COMPILER_LIMITS = Object.freeze({
  inputBytes: 2 * 1024 * 1024,
  inputFiles: 1024,
  outputCharacters: 2 * 1024 * 1024,
  initializationMs: 10_000,
  compilationMs: 10_000,
  workerResponseMs: 15_000,
});

export interface BrowserCompileRequest {
  format: 2;
  revision: string;
  source: string;
  options: {
    target: string;
    fileName: string;
    files?: Readonly<Record<string, string>>;
    sourceImports?: Readonly<Record<string, string>>;
    exportName?: string;
    componentName?: string;
  };
  preview?: boolean;
}

export interface BrowserPreviewArtifact {
  format: 2;
  entry: string;
  modules: Record<string, string>;
  styles: string[];
  events: string[];
  execution: 'native-react';
}

export interface BrowserGeneratedModule {
  code: string;
  target: 'react';
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
          | 'worker-execution'
          | 'preview-policy'
          | 'disposed';
        message: string;
      };
    };

export interface BrowserCompilerBuild {
  format: 2;
  compilerSha256: string;
  typescriptVersion: string;
  execution: 'worker-js';
  targets: readonly ['react'];
  authoringSha256: string;
}

export interface BrowserAuthoringEnvironment {
  readonly files: Readonly<Record<string, string>>;
  readonly modules: Readonly<Record<string, string>>;
  readonly defaultLibFile: string;
  readonly typescriptVersion: string;
  readonly reactVersion: string;
}

export type CompilerWorkerRequest =
  | { type: 'initialize'; build: BrowserCompilerBuild }
  | { type: 'compile'; id: number; request: BrowserCompileRequest };

export interface CompilerWorkerResponse {
  type: 'compiled';
  id: number;
  requestSha256: string;
  result: BrowserCompileResult;
  build: BrowserCompilerBuild;
  elapsedMs: number;
}
