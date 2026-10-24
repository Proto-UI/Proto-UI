import type { CodeLang } from './PrototypePreviewer/code-highlight';
import type { PublicRuntimeId } from './PrototypePreviewer/runtimes/ids';

export type CodeExampleFile = Readonly<{
  name: string;
  lang: CodeLang;
  code: string;
}>;

export type CodeExamplesByHost = Partial<Record<PublicRuntimeId, readonly CodeExampleFile[]>>;

export type CodeExampleHostId = PublicRuntimeId | 'gpui' | 'qt' | 'flutter';

export interface CodeExampleProps {
  files: CodeExamplesByHost;
  /** Commands run in a terminal, never filenames or generated shell scripts. */
  commands?: Partial<Record<PublicRuntimeId, Readonly<{ label: string; code: string }>>>;
  /** Explicit non-runnable entries. No command/file is invented for these hosts. */
  pendingHosts?: readonly Readonly<{ id: CodeExampleHostId; label: string; message: string }>[];
  /** Host-specific integration guidance, shown beside that host’s usage. */
  guidance?: Partial<Record<PublicRuntimeId, string>>;
  labels?: Readonly<{ install: string; usage: string; copy: string; pending: string; overflow: string; files?: string }>;
  initialHost?: CodeExampleHostId;
  label?: string;
  class?: string;
}

