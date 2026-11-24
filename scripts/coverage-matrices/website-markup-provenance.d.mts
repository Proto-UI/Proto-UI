export interface SourceBinding {
  revision: string;
  sources: Array<{ path: string; sha256: string }>;
}
export interface MarkupResponse {
  kind: 'navigation-response';
  navigationId: string;
  status: number;
  contentType: string;
  html: string;
}
export interface MarkupObservation {
  responseDigest: string | null;
  navigationId: string;
  previewerId: string | null;
  ownerPreviewerId: string | null;
  runtime: string | null;
  connected: boolean;
  receiverTag: string | null;
  receiverCount: number;
  highlightsAttribute: string;
  codeMapAttribute: string;
  contentHtml: string | null;
  codeScrollFocus?: {
    kind: 'public-scroll-area-viewport';
    ready: boolean;
    anatomyCount: number;
    anatomyTag: string | null;
    viewportCount: number;
    viewportTag: string | null;
    anatomyIsContainerChild: boolean;
    viewportIsAnatomyChild: boolean;
    receiverIsViewportChild: boolean;
    connected: boolean;
    ownerPreviewerId: string | null;
    tabindex: string | null;
    role: string | null;
    label: string | null;
    projection: string | null;
  } | null;
}
export interface MarkupComparison {
  matches: boolean;
  expectedDigest: string | null;
  observedDigest: string | null;
}
export interface OriginalCodePanel {
  id: string;
  demoId: string | null;
  initialRuntime: string;
  highlightsAttribute: string;
  codeMapAttribute: string;
  contentCount: number;
  contentHtml: string | null;
  sourceRange: [number, number] | null;
}
export interface MarkupReport {
  schemaVersion: 1;
  scope: 'issue:834';
  sourceAdmission: 'unverified';
  servedSource: 'unobservable';
  sourceReferenceRevision: string | null;
  captureRevision: string | null;
  originalHTML: { responseDigest: string | null; navigationId: string | null; receiver: OriginalCodePanel | null };
  nativeRuntime: {
    kind: 'native-runtime-output';
    observation: MarkupObservation;
    comparison: {
      producer: MarkupComparison;
      expected: MarkupComparison;
      transformation: 'code-scroll-viewport-focus-handover' | null;
    } | null;
  };
  matchesRecordedProducer: boolean;
  matchesExpectedNativeOutput: boolean;
  issues: string[];
  limits: string[];
}
export function markupDigest(bytes: string | Uint8Array): string;
export function markupComparison(expected: unknown, observed: unknown): MarkupComparison;
export function sourceBindingIssues(profile: unknown, binding: unknown): string[];
export function originalCodePanels(html: string): OriginalCodePanel[];
export function originalInstallCommands(html: string): Array<{
  id: string;
  activeManager: string;
  commands: Array<{ manager: string; text: string }>;
}>;
export function highlightedFragmentIssues(html: unknown, raw: unknown): string[];
export function analyzeMarkupObservation(input: {
  profile: SourceBinding;
  binding: SourceBinding;
  response: MarkupResponse;
  observation: MarkupObservation;
}): MarkupReport;
