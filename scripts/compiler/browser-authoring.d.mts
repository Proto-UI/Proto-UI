import type { BrowserAuthoringEnvironment } from '../../packages/compiler/src/browser/protocol';
export function createBrowserAuthoringEnvironment(): Promise<{
  environment: BrowserAuthoringEnvironment;
  inputFiles: Record<string, string>;
}>;
