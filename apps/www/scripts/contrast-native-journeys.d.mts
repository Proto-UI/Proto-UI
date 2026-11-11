import type { ContrastAuditSubject } from './contrast-probe.browser';
import type { DemoPublicInstance, DemoSetupContext } from '../src/components/PrototypePreviewer/demo-types';

export type NativeJourneySubject = ContrastAuditSubject;
export interface NativeJourneyObservation {
  achieved: boolean;
  [key: string]: unknown;
}
export interface ButtonCommandSource {
  schemaVersion: number;
  source: string;
  originalSHA: string;
  helperSHA: string;
  kind: string;
}
export interface InputRecord {
  event: Event;
  type: string;
}
export interface PointerInputRecord extends InputRecord {
  event: PointerEvent;
  button: number;
  x: number;
  y: number;
}
export interface PointerJournalRecord extends PointerInputRecord {
  target: string;
  at: number;
  exactTarget: boolean;
  hitIsTarget: boolean;
}
export interface ButtonKeyRecord extends InputRecord {
  event: KeyboardEvent;
  key: string;
  at: number;
  exactTarget: boolean;
}
export interface DisabledButtonPointerRecord extends PointerInputRecord {
  hitDisabled: boolean;
}
export interface NativeJourneyBinding {
  subject: NativeJourneySubject;
  owner: string;
  generation: string;
  dispose(): void;
}
export interface NativePoint { x: number; y: number; side?: string }
export interface DialogOutsideBinding extends NativeJourneyBinding {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  mask: HTMLElement;
  contentId: string;
  point: { side: string; x: number; y: number } | null;
  beforeAccepted: boolean;
  inputs: { records: PointerJournalRecord[]; dispose(): void };
}
export interface HoverBridgeBinding extends NativeJourneyBinding {
  root: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  activeElement: Element | null;
  point: NativePoint;
  beforeAccepted: boolean;
  retainedAccepted: boolean;
  inputs: { records: PointerJournalRecord[]; dispose(): void };
}
export interface ButtonCommandSession {
  ref: string;
  active: boolean;
  count: number;
  deliveries: Array<{ index: number; at: number; payload: unknown }>;
  sourceBinding: ButtonCommandSource;
  ctx: DemoSetupContext & {
    api: DemoSetupContext['api'] & Required<Pick<DemoSetupContext['api'], 'getPublicInstance'>>;
  };
}
export interface ButtonCommandBinding {
  session: ButtonCommandSession;
  instance: DemoPublicInstance;
  element: HTMLElement;
}
export interface ButtonKeyboardBinding extends NativeJourneyBinding {
  button: HTMLElement;
  disabled: HTMLElement[];
  commands: ButtonCommandBinding;
  disabledCommands: ButtonCommandBinding[];
  inputs: ButtonKeyRecord[];
  tabVisits: Array<{ disabledFocused: boolean; buttonFocused: boolean }>;
  disabledPointer: DisabledButtonPointerRecord[];
  disabledPoint: NativePoint | null;
  tabExited: boolean;
}
export interface ButtonKeyStep {
  key: string;
  inputIndex: number;
  count: number;
  disabledCounts: number[];
  scroll: Array<{ element: Element; left: number; top: number }>;
  before: NativeJourneyObservation;
}
export const CONTRAST_NATIVE_JOURNEY_STATES: Record<string, string[]>;
export function withContrastButtonCommands<T>(demo: T, sourceBinding: ButtonCommandSource): T;
export function bindContrastDialogOutside(input: {
  subject: NativeJourneySubject; root: HTMLElement; trigger: HTMLElement;
  content: HTMLElement; mask: HTMLElement;
}): DialogOutsideBinding;
export function readContrastDialogOutside(binding: DialogOutsideBinding, phase: string): NativeJourneyObservation;
export function bindContrastHoverBridge(input: {
  subject: NativeJourneySubject; root: HTMLElement; trigger: HTMLElement; content: HTMLElement;
}): HoverBridgeBinding;
export function readContrastHoverBridge(binding: HoverBridgeBinding, phase: string): NativeJourneyObservation;
export function contrastHoverLeavePoint(binding: HoverBridgeBinding): NativePoint | null;
export function bindContrastButtonKeyboard(input: {
  subject: NativeJourneySubject; button: HTMLElement; disabled: HTMLElement[];
}): ButtonKeyboardBinding;
export function beginContrastButtonKey(binding: ButtonKeyboardBinding, key: string): ButtonKeyStep;
export function readContrastButtonKey(input: {
  binding: ButtonKeyboardBinding; step: ButtonKeyStep;
}): NativeJourneyObservation;
export function readContrastDisabledButton(binding: ButtonKeyboardBinding, phase: string): NativeJourneyObservation;
export function resetContrastButtonControlInputs(binding: ButtonKeyboardBinding): void;
