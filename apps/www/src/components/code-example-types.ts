import type { CodeLang } from './PrototypePreviewer/code-highlight';
import type { RuntimeId } from './PrototypePreviewer/runtimes/registry';

export type CodeExampleFile = Readonly<{
  name: string;
  lang: CodeLang;
  code: string;
}>;

export type CodeExamplesByHost = Partial<Record<RuntimeId, readonly CodeExampleFile[]>>;

export interface CodeExampleProps {
  files: CodeExamplesByHost;
  initialHost?: RuntimeId;
  label?: string;
  class?: string;
}
