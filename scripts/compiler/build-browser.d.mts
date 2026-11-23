import type { BrowserCompilerBuild } from '../../packages/compiler/src/browser/protocol';

export function buildBrowserCompiler(destination?: string): Promise<
  BrowserCompilerBuild & {
    destination: string;
    bytes: number;
    inputFiles: Record<string, string>;
  }
>;
