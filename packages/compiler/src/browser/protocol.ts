import type { CompilerDiagnostic, GeneratedModule, PrototypeIR } from '../ir';
import type { CompileOptions } from '../memory';

export const BROWSER_COMPILER_LIMITS = Object.freeze({
  inputBytes: 256 * 1024,
  outputCharacters: 8 * 1024 * 1024,
  memoryBytes: 128 * 1024 * 1024,
  stackBytes: 2 * 1024 * 1024,
  initializationMs: 30_000,
  compilationMs: 5_000,
  workerResponseMs: 10_000,
});

export interface BrowserCompileRequest {
  format: 1;
  revision: string;
  source: string;
  /** Closed virtual graph and an explicit versioned target; no host filesystem options. */
  options: Omit<CompileOptions, 'nativeSdkPath' | 'profile' | 'fileName'> & {
    profile: NonNullable<CompileOptions['profile']>;
    fileName: string;
  };
}

export type BrowserCompileResult =
  | { ok: true; revision: string; source: PrototypeIR['source']; output: GeneratedModule }
  | { ok: false; revision: string; phase: 'compile'; diagnostics: CompilerDiagnostic[] }
  | {
      ok: false;
      revision: string;
      phase: 'host';
      error: {
        code: 'invalid-request' | 'input-limit' | 'execution-limit' | 'wasm-execution' | 'disposed';
        message: string;
      };
    };

export interface BrowserCompilerBuild {
  format: 1;
  /** Bundle/manifest consistency digest, not an authentication root; distinct from source identity. */
  compilerSha256: string;
  typescriptVersion: string;
  execution: 'quickjs-wasm';
}

export interface CompilerWorkerRequest {
  type: 'compile';
  id: number;
  request: BrowserCompileRequest;
}

export interface CompilerWorkerResponse {
  type: 'compiled';
  id: number;
  result: BrowserCompileResult;
  build: BrowserCompilerBuild;
  elapsedMs: number;
}

export type CompilerWorkerInput =
  | CompilerWorkerRequest
  | {
      type: 'initialize';
      bundle: string;
      build: BrowserCompilerBuild;
    };

export type CompilerWorkerOutput =
  | CompilerWorkerResponse
  | { type: 'ready'; build: BrowserCompilerBuild }
  | { type: 'initialization-error'; message: string };
