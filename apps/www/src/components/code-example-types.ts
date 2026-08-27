import type { CodeLang } from './PrototypePreviewer/code-highlight';
import type { PublicRuntimeId } from './PrototypePreviewer/runtimes/registry';

export type CodeExampleFile = Readonly<{
  name: string;
  lang: CodeLang;
  code: string;
}>;

export type CodeExamplesByHost = Partial<Record<PublicRuntimeId, readonly CodeExampleFile[]>>;

export interface CodeExampleProps {
  files: CodeExamplesByHost;
  initialHost?: PublicRuntimeId;
  label?: string;
  class?: string;
}
