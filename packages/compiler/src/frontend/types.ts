import type ts from 'typescript';

export const PROTO_TARGETS = ['react', 'gpui', 'vue2', 'vue3', 'web-components'] as const;
export type ProtoTarget = (typeof PROTO_TARGETS)[number];
export type ProtoDiagnosticCategory =
  | 'source-invalid'
  | 'compiler-missing'
  | 'backend-missing'
  | 'extern-unbound'
  | 'host-unavailable';

/** Positions are one-based; offsets and lengths use TypeScript's UTF-16 units. */
export interface ProtoSourceLocation {
  file: string;
  line: number;
  column: number;
  length: number;
}

export interface ProtoDiagnostic {
  code: string;
  ruleId: string;
  criterion: string[];
  category: ProtoDiagnosticCategory;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: ProtoSourceLocation;
  relatedLocations?: ProtoSourceLocation[];
  callChain?: string[];
  capabilityKey?: string;
  trackingRef?: string | null;
  targetProfile?: ProtoTarget;
}

export interface ProtoProgramOptions {
  rootNames: readonly string[];
  currentDirectory?: string;
  /** Relative to currentDirectory. Otherwise all entries must share their nearest project. */
  project?: string;
  compilerOptions?: ts.CompilerOptions;
  /** Unsaved editor snapshots; keys must be absolute file paths. */
  sourceOverrides?: Readonly<Record<string, string>>;
}

export interface ProtoAnalysisOptions {
  target?: ProtoTarget;
}

export interface ProtoFileAnalysisOptions extends ProtoProgramOptions, ProtoAnalysisOptions {}

export interface ProtoClosureFile {
  path: string;
  sha256: string;
  byteLength: number;
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be';
  sourceKind: 'disk' | 'override';
  role: 'source' | 'prelude';
}

export interface ProtoMissingSource {
  reason: string;
  path?: string;
  from?: string;
  specifier?: string;
}

export interface ProtoResolutionProbe {
  path: string;
  kind: 'file' | 'directory';
  /** Effective existence in the analyzed snapshot, including editor overrides. */
  exists: boolean;
}

export interface ProtoSourceClosure {
  algorithm: 'sha256';
  /** Hash of the versioned configuration, source bytes and resolution decisions. */
  digest: string;
  configurationHash: string;
  complete: boolean;
  rootNames: string[];
  /** The selected configuration path, or null for standalone inputs. */
  projectFile: string | null;
  files: ProtoClosureFile[];
  /** Original bytes of project configurations and package metadata read by TypeScript. */
  resolutionFiles: Omit<ProtoClosureFile, 'role'>[];
  /** Positive and negative lookups used in project discovery or resolution. */
  resolutionProbes: ProtoResolutionProbe[];
  resolutions: {
    from: string;
    specifier: string;
    /** null means a path reference or resolution with no import/require distinction. */
    resolutionMode: 'import' | 'require' | null;
    resolvedPath: string | null;
  }[];
  missing: ProtoMissingSource[];
  compilerOptions: Record<string, unknown>;
  configuration: Record<string, unknown>;
}

export interface ProtoTargetAnalysis {
  compilable: false;
  reason: 'backend-missing';
}

export interface ProtoAnalysis {
  schemaVersion: 1;
  /** Includes the selected target in addition to the common source configuration. */
  analysisConfigurationHash: string;
  languageVersion: '0.4';
  ruleSetVersion: string;
  compilerVersion: string;
  analysisComplete: false;
  sourceValid: false | null;
  selectedTarget?: ProtoTarget;
  diagnostics: ProtoDiagnostic[];
  sourceClosure: ProtoSourceClosure;
  targets: Record<ProtoTarget, ProtoTargetAnalysis>;
}
