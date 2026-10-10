// Compile-only public consumer assertions; never executed.
import type { ProtoAdapterProps, ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { ButtonExposes } from '../src/button';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type ExactEmpty<T> =
  IsAny<T> extends true
    ? false
    : [T] extends [Record<string, never>]
      ? [Record<string, never>] extends [T]
        ? true
        : false
      : false;
import * as base from '../../base/src/data-table';
type baseProps = ProtoAdapterProps<typeof base.dataTableHeaderRow>;
type baseExposes = ProtoAdapterExposes<typeof base.dataTableHeaderRow>;
type baseExactProps = Assert<ExactEmpty<baseProps>>;
type baseExactExposes = Assert<ExactEmpty<baseExposes>>;
const baseValid: baseProps = {};
// @ts-expect-error HeaderRow is a static structural identity, not the legacy header prop.
const baseHeader: baseProps = { header: true };
// @ts-expect-error HeaderRow never identifies a data slot.
const baseIndex: baseProps = { index: 0 };
declare const baseExposed: baseExposes;
// @ts-expect-error An empty exposes surface cannot be used as an interactive state.
baseExposed.selected.get();
import * as shadcn from '../../shadcn/src/data-table';
type shadcnProps = ProtoAdapterProps<typeof shadcn.dataTableHeaderRow>;
type shadcnExposes = ProtoAdapterExposes<typeof shadcn.dataTableHeaderRow>;
type shadcnExactProps = Assert<ExactEmpty<shadcnProps>>;
type shadcnExactExposes = Assert<ExactEmpty<shadcnExposes>>;
const shadcnValid: shadcnProps = {};
// @ts-expect-error HeaderRow is a static structural identity, not the legacy header prop.
const shadcnHeader: shadcnProps = { header: true };
// @ts-expect-error HeaderRow never identifies a data slot.
const shadcnIndex: shadcnProps = { index: 0 };
declare const shadcnExposed: shadcnExposes;
// @ts-expect-error An empty exposes surface cannot be used as an interactive state.
shadcnExposed.selected.get();
import * as brutalist from '../../brutalist/src/data-table';
type brutalistProps = ProtoAdapterProps<typeof brutalist.dataTableHeaderRow>;
type brutalistExposes = ProtoAdapterExposes<typeof brutalist.dataTableHeaderRow>;
type brutalistExactProps = Assert<ExactEmpty<brutalistProps>>;
type brutalistExactExposes = Assert<ExactEmpty<brutalistExposes>>;
const brutalistValid: brutalistProps = {};
// @ts-expect-error HeaderRow is a static structural identity, not the legacy header prop.
const brutalistHeader: brutalistProps = { header: true };
// @ts-expect-error HeaderRow never identifies a data slot.
const brutalistIndex: brutalistProps = { index: 0 };
declare const brutalistExposed: brutalistExposes;
// @ts-expect-error An empty exposes surface cannot be used as an interactive state.
brutalistExposed.selected.get();
import * as bootstrap232 from '../../bootstrap-2-3-2/src/data-table';
type bootstrap232Props = ProtoAdapterProps<typeof bootstrap232.dataTableHeaderRow>;
type bootstrap232Exposes = ProtoAdapterExposes<typeof bootstrap232.dataTableHeaderRow>;
type bootstrap232ExactProps = Assert<ExactEmpty<bootstrap232Props>>;
type bootstrap232ExactExposes = Assert<ExactEmpty<bootstrap232Exposes>>;
const bootstrap232Valid: bootstrap232Props = {};
// @ts-expect-error HeaderRow is a static structural identity, not the legacy header prop.
const bootstrap232Header: bootstrap232Props = { header: true };
// @ts-expect-error HeaderRow never identifies a data slot.
const bootstrap232Index: bootstrap232Props = { index: 0 };
declare const bootstrap232Exposed: bootstrap232Exposes;
// @ts-expect-error An empty exposes surface cannot be used as an interactive state.
bootstrap232Exposed.selected.get();
import * as liquidglass from '../../liquid-glass/src/data-table';
type liquidglassProps = ProtoAdapterProps<typeof liquidglass.dataTableHeaderRow>;
type liquidglassExposes = ProtoAdapterExposes<typeof liquidglass.dataTableHeaderRow>;
type liquidglassExactProps = Assert<ExactEmpty<liquidglassProps>>;
type liquidglassExactExposes = Assert<ExactEmpty<liquidglassExposes>>;
const liquidglassValid: liquidglassProps = {};
// @ts-expect-error HeaderRow is a static structural identity, not the legacy header prop.
const liquidglassHeader: liquidglassProps = { header: true };
// @ts-expect-error HeaderRow never identifies a data slot.
const liquidglassIndex: liquidglassProps = { index: 0 };
declare const liquidglassExposed: liquidglassExposes;
// @ts-expect-error An empty exposes surface cannot be used as an interactive state.
liquidglassExposed.selected.get();
declare const handle: ReturnType<typeof base.asDataTableHeaderRow>;
// @ts-expect-error There is no authored selection state handle.
handle.stateHandles.selected.get();
const unknownChild: unknown = handle.getAsHookHandle?.('as-button');
// @ts-expect-error Unknown fallback is not a captured Button handle.
const button: ButtonExposes = unknownChild;
// @ts-expect-error Unknown fallback provides no readable child state handles.
handle.getAsHookHandle?.('as-button').stateHandles.disabled.get();
