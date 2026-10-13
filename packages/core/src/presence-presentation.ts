/** Draft, presentation-only source declarations. Registry identity is validated by Feedback. */
import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from './handles';
import type { State } from './state';

export type PresencePhase = 'closed' | 'preparing' | 'entering' | 'entered' | 'leaving';
export type AffineLength = Readonly<{ px: number; rootText: number; ownBox: number }>;
export type Translation = readonly [AffineLength, AffineLength];
export type FiniteSelection<T> = Readonly<{
  source: Pick<State<string>, 'get'>;
  cases: Readonly<Record<string, T>>;
}>;
export type PresenceEndpoint = Readonly<{
  translate?: Translation | FiniteSelection<Translation>;
  opacity?: number;
}>;
export type PresentationChannel = 'translate' | 'opacity';
export type PresentationOutcome =
  | 'finished'
  | 'reduced-motion'
  | 'unknown-preference'
  | 'hidden'
  | 'missing-capability'
  | 'unsupported-endpoint'
  | 'unresolved-units'
  | 'unresolved-input'
  | 'projection-failed'
  | 'projection-ownership-lost'
  | 'deadline'
  | 'zero-duration'
  | 'invalid-policy'
  | 'scheduler-failed';
declare const ownerRefBrand: unique symbol;
declare const ownerWriterBrand: unique symbol;
declare const viewBindingBrand: unique symbol;
/** Instance-local symbolic identity. No public constructor or writer capability. */
export type PresentationOwnerRef = Readonly<{ readonly [ownerRefBrand]: true }>;
export type PresentationOwnerWriter = Readonly<{ readonly [ownerWriterBrand]: true }>;
export type PresentationViewBinding = Readonly<{ readonly [viewBindingBrand]: true }>;
export type AttemptToken = Readonly<{ ownerEpoch: number; phaseAttempt: number }>;
export type PresentationOwnerFrame = Readonly<{
  owner: PresentationOwnerRef;
  revision: number;
  phase: PresencePhase;
  attempt: AttemptToken | null;
  completion: 'timer' | 'presentation';
  durationMs: number;
  timeoutMs: number | null;
}>;
export type PresentationReceipt = Readonly<{
  owner: PresentationOwnerRef;
  attempt: AttemptToken;
  viewBinding: PresentationViewBinding;
  ownerRevision: number;
  targetRevision: number;
  channels: readonly PresentationChannel[];
  outcome: PresentationOutcome;
}>;
export type PresencePresentationDeclaration = Readonly<{
  owner: PresentationOwnerRef;
  closed: PresenceEndpoint;
  entered: PresenceEndpoint;
  easing: readonly [number, number, number, number];
}>;
export type PresentationCompletionConfig =
  | 'timer'
  | Readonly<{ kind: 'presentation'; timeoutMs: number }>;
export type CompletionRequest = Readonly<{ receipt: PresentationReceipt }>;
export interface PresenceOwnerDeclaration<Props extends PropsBaseType = PropsBaseType> {
  readonly ref: PresentationOwnerRef;
  readonly writer: PresentationOwnerWriter;
  onCompletionRequest(callback: (run: RunHandle<Props>, request: CompletionRequest) => void): void;
}
export interface PresenceOwnerRuntime {
  publish(writer: PresentationOwnerWriter, frame: PresentationOwnerFrame): void;
  isCurrent(writer: PresentationOwnerWriter, receipt: PresentationReceipt): boolean;
  settle(writer: PresentationOwnerWriter, outcome: PresentationOutcome): void;
}
/** Host implementation port, not author-supplied callbacks in a recipe. */
export interface PresentationOwnerPort {
  read(owner: PresentationOwnerRef): PresentationOwnerFrame;
  observe(
    owner: PresentationOwnerRef,
    consume: (frame: PresentationOwnerFrame) => void
  ): () => void;
  attach(
    owner: PresentationOwnerRef,
    attempt: AttemptToken,
    consumer: PresentationConsumerPort
  ): () => void;
  complete(receipt: PresentationReceipt): boolean;
}
export interface PresentationConsumerPort {
  settle(frame: PresentationOwnerFrame, reason: PresentationOutcome): boolean;
  retire(frame: PresentationOwnerFrame): void;
}

const fail = (): never => {
  throw new Error('[feedback.presence] Invalid declaration');
};
function object(value: unknown): object {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value;
}
function field(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) return fail();
  return descriptor.value;
}
function shape(value: unknown, allowed: readonly string[], required = allowed): object {
  const result = object(value);
  if (Reflect.ownKeys(result).some((key) => typeof key !== 'string' || !allowed.includes(key)))
    return fail();
  for (const key of required) field(result, key);
  return result;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
  return value;
}
function nonnegative(value: unknown): number {
  const n = finite(value);
  if (n < 0) return fail();
  return n;
}
function integer(value: unknown): number {
  const n = nonnegative(value);
  if (!Number.isSafeInteger(n)) return fail();
  return n;
}
function dense(value: unknown, length: number): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length !== length ||
    Reflect.ownKeys(value).some(
      (key) =>
        key !== 'length' && !Array.from({ length }, (_, i) => String(i)).includes(key as string)
    )
  )
    return fail();
  return Array.from({ length }, (_, i) => field(value, String(i)));
}
function affine(value: unknown): AffineLength {
  const v = shape(value, ['px', 'rootText', 'ownBox']);
  return Object.freeze({
    px: finite(field(v, 'px')),
    rootText: finite(field(v, 'rootText')),
    ownBox: finite(field(v, 'ownBox')),
  });
}
function translation(value: unknown): Translation {
  const pair = dense(value, 2);
  return Object.freeze([affine(pair[0]), affine(pair[1])]);
}
function selectedTranslation(value: unknown): Translation | FiniteSelection<Translation> {
  if (Array.isArray(value)) return translation(value);
  const v = shape(value, ['source', 'cases']);
  // Never invoke author functions or traverse symbolic reference internals here.
  // The installing module validates this exact handle against its State registry.
  const source = object(field(v, 'source')) as Pick<State<string>, 'get'>;
  const input = object(field(v, 'cases'));
  const keys = Reflect.ownKeys(input);
  if (!keys.length || keys.some((key) => typeof key !== 'string')) return fail();
  const cases: Record<string, Translation> = Object.create(null);
  for (const key of keys as string[]) cases[key] = translation(field(input, key));
  return Object.freeze({ source, cases: Object.freeze(cases) });
}
function endpoint(value: unknown): PresenceEndpoint {
  const v = shape(value, ['translate', 'opacity'], []);
  const keys = Reflect.ownKeys(v);
  if (!keys.length) return fail();
  const result: { translate?: Translation | FiniteSelection<Translation>; opacity?: number } = {};
  if (keys.includes('translate')) result.translate = selectedTranslation(field(v, 'translate'));
  if (keys.includes('opacity')) {
    const opacity = finite(field(v, 'opacity'));
    if (opacity < 0 || opacity > 1) return fail();
    result.opacity = opacity;
  }
  return Object.freeze(result);
}
export function snapshotPresencePresentation(
  value: PresencePresentationDeclaration
): PresencePresentationDeclaration {
  const v = shape(value, ['owner', 'closed', 'entered', 'easing']);
  const owner = object(field(v, 'owner')) as PresentationOwnerRef;
  const closed = endpoint(field(v, 'closed'));
  const entered = endpoint(field(v, 'entered'));
  if (
    Object.keys(closed).some((key) => !Object.hasOwn(entered, key)) ||
    Object.keys(closed).length !== Object.keys(entered).length
  )
    return fail();
  const easing = dense(field(v, 'easing'), 4).map(finite);
  if (easing[0] < 0 || easing[0] > 1 || easing[2] < 0 || easing[2] > 1) return fail();
  return Object.freeze({
    owner,
    closed,
    entered,
    easing: Object.freeze(easing) as unknown as PresencePresentationDeclaration['easing'],
  });
}
export function snapshotPresentationCompletionConfig(
  value: PresentationCompletionConfig
): PresentationCompletionConfig {
  if (value === 'timer') return value;
  const v = shape(value, ['kind', 'timeoutMs']);
  const timeoutMs = finite(field(v, 'timeoutMs'));
  if (field(v, 'kind') !== 'presentation' || timeoutMs <= 0) return fail();
  return Object.freeze({ kind: 'presentation', timeoutMs });
}
export function snapshotPresentationOwnerFrame(
  value: PresentationOwnerFrame
): PresentationOwnerFrame {
  const v = shape(value, [
    'owner',
    'revision',
    'phase',
    'attempt',
    'completion',
    'durationMs',
    'timeoutMs',
  ]);
  const owner = object(field(v, 'owner')) as PresentationOwnerRef;
  const revision = integer(field(v, 'revision'));
  const phase = field(v, 'phase') as PresencePhase;
  if (!['closed', 'preparing', 'entering', 'entered', 'leaving'].includes(phase)) return fail();
  const completion = field(v, 'completion');
  if (completion !== 'timer' && completion !== 'presentation') return fail();
  const durationMs = nonnegative(field(v, 'durationMs'));
  const timeout = field(v, 'timeoutMs');
  const timeoutMs = timeout === null ? null : finite(timeout);
  if (
    (completion === 'timer' && timeoutMs !== null) ||
    (completion === 'presentation' && (timeoutMs === null || timeoutMs <= 0))
  )
    return fail();
  const rawAttempt = field(v, 'attempt');
  let attempt: AttemptToken | null = null;
  if (rawAttempt !== null) {
    const a = shape(rawAttempt, ['ownerEpoch', 'phaseAttempt']);
    attempt = Object.freeze({
      ownerEpoch: integer(field(a, 'ownerEpoch')),
      phaseAttempt: integer(field(a, 'phaseAttempt')),
    });
  }
  if ((phase === 'entering' || phase === 'leaving') !== (attempt !== null)) return fail();
  // A later duration >= timeout is a runtime invalid-policy settlement, not a lost frame.
  return Object.freeze({ owner, revision, phase, attempt, completion, durationMs, timeoutMs });
}
