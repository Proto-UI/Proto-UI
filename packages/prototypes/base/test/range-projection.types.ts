/** Compile-only source-consumer fixture. Run with tsconfig.range-projection.json. */
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { Prototype, ExposeOf } from '@proto.ui/core';
import type { ProgressRootProps, ProgressRootExposes, ProgressPartExposes } from '../src/progress';
import type { MeterRootProps, MeterRootExposes, MeterPartExposes } from '../src/meter';
type PropsOf<T> = T extends Prototype<infer P, any> ? P : never;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
import * as f0Progress from '../../shadcn/src/progress';
type f0ProgressRootProps = Assert<
  Equal<PropsOf<typeof f0Progress.progressRoot>, ProgressRootProps>
>;
const f0ProgressGood: PropsOf<typeof f0Progress.progressRoot> = { value: 25, min: 0, max: 100 };
void f0ProgressGood;
// @ts-expect-error numerical range props reject strings
const f0ProgressBad: PropsOf<typeof f0Progress.progressRoot> = { value: 'wrong' };
void f0ProgressBad;
type f0ProgressRootExposes = Assert<
  Equal<ExposeOf<typeof f0Progress.progressRoot>, ProgressRootExposes>
>;
type f0ProgressLabelExposes = Assert<
  Equal<ExposeOf<typeof f0Progress.progressLabel>, ProgressPartExposes>
>;
type f0ProgressTrackExposes = Assert<
  Equal<ExposeOf<typeof f0Progress.progressTrack>, ProgressPartExposes>
>;
type f0ProgressIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f0Progress.progressIndicator>, ProgressPartExposes>
>;
type f0ProgressValueExposes = Assert<
  Equal<ExposeOf<typeof f0Progress.progressValue>, ProgressPartExposes>
>;
function f0ProgressExposed(e: ProtoAdapterExposes<typeof f0Progress.progressRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f0ProgressExposed;
import * as f0Meter from '../../shadcn/src/meter';
type f0MeterRootProps = Assert<Equal<PropsOf<typeof f0Meter.meterRoot>, MeterRootProps>>;
const f0MeterGood: PropsOf<typeof f0Meter.meterRoot> = { value: 25, min: 0, max: 100 };
void f0MeterGood;
// @ts-expect-error numerical range props reject strings
const f0MeterBad: PropsOf<typeof f0Meter.meterRoot> = { value: 'wrong' };
void f0MeterBad;
type f0MeterRootExposes = Assert<Equal<ExposeOf<typeof f0Meter.meterRoot>, MeterRootExposes>>;
type f0MeterLabelExposes = Assert<Equal<ExposeOf<typeof f0Meter.meterLabel>, MeterPartExposes>>;
type f0MeterTrackExposes = Assert<Equal<ExposeOf<typeof f0Meter.meterTrack>, MeterPartExposes>>;
type f0MeterIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f0Meter.meterIndicator>, MeterPartExposes>
>;
type f0MeterValueExposes = Assert<Equal<ExposeOf<typeof f0Meter.meterValue>, MeterPartExposes>>;
function f0MeterExposed(e: ProtoAdapterExposes<typeof f0Meter.meterRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f0MeterExposed;
import * as f1Progress from '../../brutalist/src/progress';
type f1ProgressRootProps = Assert<
  Equal<PropsOf<typeof f1Progress.progressRoot>, ProgressRootProps>
>;
const f1ProgressGood: PropsOf<typeof f1Progress.progressRoot> = { value: 25, min: 0, max: 100 };
void f1ProgressGood;
// @ts-expect-error numerical range props reject strings
const f1ProgressBad: PropsOf<typeof f1Progress.progressRoot> = { value: 'wrong' };
void f1ProgressBad;
type f1ProgressRootExposes = Assert<
  Equal<ExposeOf<typeof f1Progress.progressRoot>, ProgressRootExposes>
>;
type f1ProgressLabelExposes = Assert<
  Equal<ExposeOf<typeof f1Progress.progressLabel>, ProgressPartExposes>
>;
type f1ProgressTrackExposes = Assert<
  Equal<ExposeOf<typeof f1Progress.progressTrack>, ProgressPartExposes>
>;
type f1ProgressIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f1Progress.progressIndicator>, ProgressPartExposes>
>;
type f1ProgressValueExposes = Assert<
  Equal<ExposeOf<typeof f1Progress.progressValue>, ProgressPartExposes>
>;
function f1ProgressExposed(e: ProtoAdapterExposes<typeof f1Progress.progressRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f1ProgressExposed;
import * as f1Meter from '../../brutalist/src/meter';
type f1MeterRootProps = Assert<Equal<PropsOf<typeof f1Meter.meterRoot>, MeterRootProps>>;
const f1MeterGood: PropsOf<typeof f1Meter.meterRoot> = { value: 25, min: 0, max: 100 };
void f1MeterGood;
// @ts-expect-error numerical range props reject strings
const f1MeterBad: PropsOf<typeof f1Meter.meterRoot> = { value: 'wrong' };
void f1MeterBad;
type f1MeterRootExposes = Assert<Equal<ExposeOf<typeof f1Meter.meterRoot>, MeterRootExposes>>;
type f1MeterLabelExposes = Assert<Equal<ExposeOf<typeof f1Meter.meterLabel>, MeterPartExposes>>;
type f1MeterTrackExposes = Assert<Equal<ExposeOf<typeof f1Meter.meterTrack>, MeterPartExposes>>;
type f1MeterIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f1Meter.meterIndicator>, MeterPartExposes>
>;
type f1MeterValueExposes = Assert<Equal<ExposeOf<typeof f1Meter.meterValue>, MeterPartExposes>>;
function f1MeterExposed(e: ProtoAdapterExposes<typeof f1Meter.meterRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f1MeterExposed;
import * as f2Progress from '../../bootstrap-2-3-2/src/progress';
type f2ProgressRootProps = Assert<
  Equal<PropsOf<typeof f2Progress.progressRoot>, ProgressRootProps>
>;
const f2ProgressGood: PropsOf<typeof f2Progress.progressRoot> = { value: 25, min: 0, max: 100 };
void f2ProgressGood;
// @ts-expect-error numerical range props reject strings
const f2ProgressBad: PropsOf<typeof f2Progress.progressRoot> = { value: 'wrong' };
void f2ProgressBad;
type f2ProgressRootExposes = Assert<
  Equal<ExposeOf<typeof f2Progress.progressRoot>, ProgressRootExposes>
>;
type f2ProgressLabelExposes = Assert<
  Equal<ExposeOf<typeof f2Progress.progressLabel>, ProgressPartExposes>
>;
type f2ProgressTrackExposes = Assert<
  Equal<ExposeOf<typeof f2Progress.progressTrack>, ProgressPartExposes>
>;
type f2ProgressIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f2Progress.progressIndicator>, ProgressPartExposes>
>;
type f2ProgressValueExposes = Assert<
  Equal<ExposeOf<typeof f2Progress.progressValue>, ProgressPartExposes>
>;
function f2ProgressExposed(e: ProtoAdapterExposes<typeof f2Progress.progressRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f2ProgressExposed;
import * as f2Meter from '../../bootstrap-2-3-2/src/meter';
type f2MeterRootProps = Assert<Equal<PropsOf<typeof f2Meter.meterRoot>, MeterRootProps>>;
const f2MeterGood: PropsOf<typeof f2Meter.meterRoot> = { value: 25, min: 0, max: 100 };
void f2MeterGood;
// @ts-expect-error numerical range props reject strings
const f2MeterBad: PropsOf<typeof f2Meter.meterRoot> = { value: 'wrong' };
void f2MeterBad;
type f2MeterRootExposes = Assert<Equal<ExposeOf<typeof f2Meter.meterRoot>, MeterRootExposes>>;
type f2MeterLabelExposes = Assert<Equal<ExposeOf<typeof f2Meter.meterLabel>, MeterPartExposes>>;
type f2MeterTrackExposes = Assert<Equal<ExposeOf<typeof f2Meter.meterTrack>, MeterPartExposes>>;
type f2MeterIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f2Meter.meterIndicator>, MeterPartExposes>
>;
type f2MeterValueExposes = Assert<Equal<ExposeOf<typeof f2Meter.meterValue>, MeterPartExposes>>;
function f2MeterExposed(e: ProtoAdapterExposes<typeof f2Meter.meterRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f2MeterExposed;
import * as f3Progress from '../../liquid-glass/src/progress';
type f3ProgressRootProps = Assert<
  Equal<PropsOf<typeof f3Progress.progressRoot>, ProgressRootProps>
>;
const f3ProgressGood: PropsOf<typeof f3Progress.progressRoot> = { value: 25, min: 0, max: 100 };
void f3ProgressGood;
// @ts-expect-error numerical range props reject strings
const f3ProgressBad: PropsOf<typeof f3Progress.progressRoot> = { value: 'wrong' };
void f3ProgressBad;
type f3ProgressRootExposes = Assert<
  Equal<ExposeOf<typeof f3Progress.progressRoot>, ProgressRootExposes>
>;
type f3ProgressLabelExposes = Assert<
  Equal<ExposeOf<typeof f3Progress.progressLabel>, ProgressPartExposes>
>;
type f3ProgressTrackExposes = Assert<
  Equal<ExposeOf<typeof f3Progress.progressTrack>, ProgressPartExposes>
>;
type f3ProgressIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f3Progress.progressIndicator>, ProgressPartExposes>
>;
type f3ProgressValueExposes = Assert<
  Equal<ExposeOf<typeof f3Progress.progressValue>, ProgressPartExposes>
>;
function f3ProgressExposed(e: ProtoAdapterExposes<typeof f3Progress.progressRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f3ProgressExposed;
import * as f3Meter from '../../liquid-glass/src/meter';
type f3MeterRootProps = Assert<Equal<PropsOf<typeof f3Meter.meterRoot>, MeterRootProps>>;
const f3MeterGood: PropsOf<typeof f3Meter.meterRoot> = { value: 25, min: 0, max: 100 };
void f3MeterGood;
// @ts-expect-error numerical range props reject strings
const f3MeterBad: PropsOf<typeof f3Meter.meterRoot> = { value: 'wrong' };
void f3MeterBad;
type f3MeterRootExposes = Assert<Equal<ExposeOf<typeof f3Meter.meterRoot>, MeterRootExposes>>;
type f3MeterLabelExposes = Assert<Equal<ExposeOf<typeof f3Meter.meterLabel>, MeterPartExposes>>;
type f3MeterTrackExposes = Assert<Equal<ExposeOf<typeof f3Meter.meterTrack>, MeterPartExposes>>;
type f3MeterIndicatorExposes = Assert<
  Equal<ExposeOf<typeof f3Meter.meterIndicator>, MeterPartExposes>
>;
type f3MeterValueExposes = Assert<Equal<ExposeOf<typeof f3Meter.meterValue>, MeterPartExposes>>;
function f3MeterExposed(e: ProtoAdapterExposes<typeof f3Meter.meterRoot>) {
  const numeric: number = e.value.get();
  const state: string = e.status.get();
  // @ts-expect-error value state is numeric
  const invalid: string = e.value.get();
  // @ts-expect-error arbitrary state is not exposed
  e.invented.get();
  return [numeric, state, invalid];
}
void f3MeterExposed;
