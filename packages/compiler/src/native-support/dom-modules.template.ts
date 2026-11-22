import { emitRecordedNotification } from '../notification-plan';
import { NATIVE_SCROLL_REVEAL_SOURCE } from '../native-scroll-reveal';
import { NATIVE_PART_RELATIONSHIPS_SOURCE } from './part-relationships.template';
/** Compiler-owned DOM capability implementation. Specialization consumes its TypeScript AST. */
export const DOM_MODULE_TEMPLATE = String.raw`// Standalone full DOM capability lowering. No Proto Runtime/Adapter or semantic-IR interpreter.
import { autoUpdate, computePosition, offset, flip, shift, size, type Middleware, type Placement } from '@floating-ui/dom';
import { createWebAxisInputHost } from '../host-web/axis-input-v1';
import { createWebAvailableSpaceHost } from '../host-web/available-space-v1';
import { availableLayoutStates, readAvailableLayout } from '../host-web/available-layout-model-v1';
import { OverlayTargetAlignment } from '../target-alignment/overlay-binding-v1';
import { createTargetAlignmentLease } from '../target-alignment/host-v1';
import type { OverlayTargetAlignmentBinding, AnchoredPositionConnection } from '../target-alignment/declarations-v1';
export type NativeConfig = Readonly<Record<string, unknown>>;
export type NativeStateEvent<T> = { type: 'next'; prev: T; next: T; reason?: unknown } | { type: 'disconnect'; reason: 'unmount' };
export type NativeObserved<T> = { get(): T; watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void): () => void; subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void): () => void };
export type NativeOwnedState<T> = { get(): T; set(value: T, reason?: unknown): void; setDefault(value: T): void };
export type NativeOwnedStateSpec = { kind: 'bool' | 'string' | 'enum' | 'number.discrete'; options?: readonly string[] };
type NativeStateCell<T> = { handle: NativeOwnedState<T>; set(value: T): void };
export type NativeFocusRequest = { reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean; defer?: boolean };
export type NativeFocusScopeActivation = NativeFocusRequest & { entry?: 'configured' | 'manual' };
export type NativeFocusBase = { focused: NativeObserved<boolean>; focusVisible: NativeObserved<boolean>; focusable: NativeObserved<boolean>; configure(config: NativeConfig): void; setDisabled(value: boolean): void; focusSelf(options?: NativeFocusRequest): void };
export interface NativeFocusEntry { configure(config: NativeConfig): void; setDisabled(value: boolean): void; focus(options?: NativeFocusRequest): void }
export interface NativeFocusRoving {
  active: NativeObserved<boolean>; hasFocused: NativeObserved<boolean>;
  configure(config: NativeConfig): void; setLoop(value: boolean): void; setOrientation(value: string): void;
  focusFirst(options?: NativeFocusRequest): void; focusLast(options?: NativeFocusRequest): void; focusSelected(options?: NativeFocusRequest): void; focusNext(): void; focusPrev(): void;
}
export interface NativeFocusScope { active: NativeObserved<boolean>; hasFocused: NativeObserved<boolean>; configure(config: NativeConfig): void; focusFirst(): void; focusLast(): void; focusNext(): void; focusPrev(): void; focusSelected(): void; activate(options?: NativeFocusScopeActivation): void; deactivate(options?: NativeFocusRequest): void; restoreFocus(): void; isActive(): boolean; getRoving(): NativeFocusRoving | null }
export type NativeAnatomyFamily = { debugName: string; roles: Readonly<Record<string, { cardinality: { min: number; max: number | '*' }; requires?: readonly { kind: string; name: string }[] }>>; relations?: readonly unknown[]; profiles?: Readonly<Record<string, unknown>> };
export interface NativeAnatomyPart { readonly role: string; hasExpose(key: string): boolean; getExpose(key: string): unknown | null; hasHook(name: string): boolean }
export interface NativeAnatomyOrder {
  version(family: NativeAnatomyFamily): number; parts(family: NativeAnatomyFamily): readonly NativeAnatomyPart[]; partsOf(family: NativeAnatomyFamily, role: string): readonly NativeAnatomyPart[];
  indexOfSelf(family: NativeAnatomyFamily, role: string): number; prevOfSelf(family: NativeAnatomyFamily, role: string): NativeAnatomyPart | null; nextOfSelf(family: NativeAnatomyFamily, role: string): NativeAnatomyPart | null;
}
export interface NativeAnatomy<Run = unknown> extends NativeAnatomyOrder { claim(family: NativeAnatomyFamily, declaration: { role: string; profile?: string }): void; has(family: NativeAnatomyFamily, role: string): boolean; descendantsOf(family: NativeAnatomyFamily, ancestor: NativeAnatomyPart, role: string): readonly NativeAnatomyPart[]; subscribeParts(family: NativeAnatomyFamily, role: string, callback: (run: Run, parts: readonly NativeAnatomyPart[]) => void): () => void; readonly order: NativeAnatomyOrder }
export type NativeCollectionSnapshot = Readonly<Record<string, unknown> & {index: number; total: number; first: boolean; last: boolean}>;
export interface NativeCollection { readonly count: NativeOwnedState<number>; configure(config: NativeConfig): void; getItems(): readonly NativeCollectionSnapshot[]; getCount(): number }
export interface NativeCollectionItem { readonly collectionIndex: NativeOwnedState<number>; readonly collectionTotal: NativeOwnedState<number>; readonly collectionFirst: NativeOwnedState<boolean>; readonly collectionLast: NativeOwnedState<boolean>; configure(config: NativeConfig): void; getSnapshot(): NativeCollectionSnapshot }
export interface NativeBoundary<Run = unknown> { configure(config: NativeConfig): void; observe(type: string): void; setStackActive(active: boolean): void; registerRegion(target: unknown, options?: NativeConfig): () => void; unregisterRegion(target: unknown): void; classify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown'; notify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown'; subscribeOutside(callback: (event: NativeConfig) => void): () => void }
export interface NativeHitParticipation { configure(config: NativeConfig): void; registerSelfRegion(options?: NativeConfig): () => void; registerRegion(target: unknown, options?: NativeConfig): () => void; unregisterRegion(target: unknown): void }
export type NativePositionSnapshot = Readonly<{side: string; align: string; strategy: string}>;
export interface NativePositioning { connect(connection: NativeConfig): void; update(config: NativeConfig): void; requestUpdate(): void; disconnect(): void; getSnapshot(): NativePositionSnapshot | null }
export interface NativeOverlay { readonly open: NativeObserved<boolean>; configure(config: NativeConfig): void; isOpen(): boolean; openOverlay(reason?: string): void; close(reason?: string): void; toggle(reason?: string): void; updatePosition(config: NativeConfig): void; registerTrigger(target: unknown): void; registerAnchor(target: unknown): void; registerAnchorPart(part: NativeAnatomyPart | null): void; registerContent(target: unknown): void; registerTargetAlignment(binding: OverlayTargetAlignmentBinding | null): void; getPositionSnapshot(): NativePositionSnapshot | null; keepMounted(): void; bindPresence(binding: NativeConfig): void }
export interface NativeScrollAxis { position: NativeObserved<number>; visibleRatio: NativeObserved<number>; canScrollBefore: NativeObserved<boolean>; canScrollAfter: NativeObserved<boolean>; atEnd: NativeObserved<boolean> }
export type NativeScrollAxisSnapshot = Readonly<{position: number; visibleRatio: number; canScrollBefore: boolean; canScrollAfter: boolean; atEnd: boolean}>;
export type NativeScrollSnapshot = Readonly<{axes: string; horizontal: NativeScrollAxisSnapshot; vertical: NativeScrollAxisSnapshot; scrolling: boolean; projection: string; endFollow: Readonly<{state: string; requestStatus: string}>}>;
export type NativeScrollPositionRequest = {kind:'by';axis:'horizontal'|'vertical';delta:number}|{kind:'to'|'control-drag';axis:'horizontal'|'vertical';position:number}|{kind:'page';axis:'horizontal'|'vertical';direction:'before'|'after'}|{kind:'to-end';axis:'horizontal'|'vertical'};
export type NativeScrollRequest = NativeScrollPositionRequest | {kind:'reveal';axis:'vertical';family:NativeAnatomyFamily;part:NativeAnatomyPart};
export type NativeScrollRequestOutcome = {kind:'dispatched'}|{kind:'queued'}|{kind:'rejected';reason:'not-mounted'|'not-declared'|'unavailable'};
export interface NativeScroll { axes: NativeObserved<string>; horizontal: NativeScrollAxis; vertical: NativeScrollAxis; scrolling: NativeObserved<boolean>; projection: NativeObserved<string>; endFollow: { state: NativeObserved<string>; requestStatus: NativeObserved<string> }; configure(config: NativeConfig): void; bindComposedChrome(binding: NativeConfig): void; request(request: NativeScrollRequest): NativeScrollRequestOutcome; pauseFollowing(): NativeScrollRequestOutcome; getSnapshot(): NativeScrollSnapshot }
export type NativeTextEvent = Readonly<{type: string; value: string; composing: boolean; data: string | null; inputType: string | null}>;
export type NativeImageEvent = Readonly<{status: string; previousStatus: string; source: string}>;
export interface NativeTextControl<Run = unknown> { on(type: string, callback: (run: Run, event: NativeTextEvent) => void): () => void; sync(patch: NativeConfig): void; resetValue(value?: string): boolean; snapshot(): { value: string; composing: boolean } | null }
export interface NativeImageView<Run = unknown> { on(type: string, callback: (run: Run, event: NativeImageEvent) => void): () => void; sync(patch: NativeConfig): void; snapshot(): { source: string; loadingStatus: string; fit: string } | null }
export interface NativeTableStructure {
  readonly role: string;
  readonly states: { a11yRole: NativeOwnedState<string>; rowCount: NativeOwnedState<number>; columnCount: NativeOwnedState<number>; row: NativeOwnedState<number>; column: NativeOwnedState<number>; rowSpan: NativeOwnedState<number>; columnSpan: NativeOwnedState<number> };
  configure(patch: NativeConfig): void; getObjectRef(): object; getSnapshot(): NativeTableSnapshot | null;
}
export type NativeTableCell = Readonly<{ ref: object; kind: 'column-header' | 'row-header' | 'cell'; row: number; column: number; rowSpan: number; columnSpan: number; columnHeaders: readonly object[]; rowHeaders: readonly object[]; orderedHeaders: readonly object[] }>;
export type NativeTableRow = Readonly<{ ref: object; index: number; cells: readonly NativeTableCell[] }>;
export type NativeTableDiagnostic = Readonly<{ code: string; ref?: object; row?: number; headerKey?: string }>;
export type NativeTableSnapshot = Readonly<{ root: object; caption: object | undefined; rowCount: number; columnCount: number; rows: readonly NativeTableRow[]; valid: boolean; diagnostics: readonly NativeTableDiagnostic[] }>;
export interface NativeAccessibleExtension { readonly objectRef: object; part(family: NativeAnatomyFamily, declaration: { key: string | { get(): unknown } }): void; id(value: string | { get(): string | null | undefined }): void; name(value: string | { get(): string | null | undefined }): void; description(value: string | { get(): string | null | undefined }): void; relation(kind: string, target: NativeConfig): void; tree(config: NativeConfig): void; level(value: number | { get(): number }): void }
export type NativeControlLabelAnatomyPair = Readonly<{ family: NativeAnatomyFamily; labelRole: string; targetRole: string }>;
export type NativeControlLabelRequest = Readonly<{ source: 'pointer' | 'accessibility'; isCurrent(): boolean }>;
export type NativeControlLabelHandle = Readonly<{ sync(options: Readonly<{ naming: boolean; activation: boolean }>): void }>;
export type NativeControlLabel<Run = unknown> = Readonly<{ label(pair?: NativeControlLabelAnatomyPair): NativeControlLabelHandle; target(activate: (run: Run, request: NativeControlLabelRequest) => void, pair?: NativeControlLabelAnatomyPair): NativeControlLabelHandle }>;
export type NativeLinkSnapshot = Readonly<{ href: string; target: string; rel: string; disabled: boolean }>;
export type NativeLinkEvent = Readonly<{ href: string; target: string; rel: string; modified: boolean }>;
export type NativeLink<Run> = { sync(config: NativeConfig): void; snapshot(): NativeLinkSnapshot | null; on(type: string, callback: (run: Run, event: NativeLinkEvent) => void): () => void };
export type NativeAxisInputCancelReason = 'host-cancel' | 'lost-ownership' | 'target-detached' | 'target-replaced' | 'disposed' | 'disabled' | 'configuration-changed' | 'invalid-geometry' | 'basis-changed';
export type NativeAxisInputSample = Readonly<{phase: 'start' | 'move' | 'end'; position: number; delta: number; totalDelta: number}> | Readonly<{phase: 'cancel'; reason: NativeAxisInputCancelReason}>;
export type NativeAxisInputBinding = Readonly<{anatomy: NativeAnatomyFamily; inputRole: string; geometryRole: string; travelRole?: string; deltaBasisRole?: string}>;
export interface NativeAxisInput<Run = unknown> { configure(binding: NativeAxisInputBinding): void; on(callback: (run: Run, sample: NativeAxisInputSample) => void): void; sync(patch: NativeConfig): void }
export type NativeModuleCapability<Kind extends string, Run = unknown> = Kind extends 'control-label' ? NativeControlLabel<Run> : Kind extends 'control-label-handle' ? NativeControlLabelHandle : Kind extends 'control-label-request' ? NativeControlLabelRequest : Kind extends 'binding-disposer' ? () => void : Kind extends 'collection-snapshot' ? NativeConfig : Kind extends 'collection-snapshot-list' ? readonly NativeConfig[] : Kind extends 'focus-entry' ? NativeFocusEntry : Kind extends 'focus-roving' ? NativeFocusRoving : Kind extends 'focus-scope' ? NativeFocusScope : Kind extends 'anatomy-family' ? NativeAnatomyFamily : Kind extends 'anatomy-part' ? NativeAnatomyPart : Kind extends 'anatomy-parts' ? readonly NativeAnatomyPart[] : Kind extends 'anatomy-order' ? NativeAnatomyOrder : Kind extends 'collection' ? NativeCollection : Kind extends 'collection-item' ? NativeCollectionItem : Kind extends 'boundary' ? NativeBoundary<Run> : Kind extends 'hit-participation' ? NativeHitParticipation : Kind extends 'positioning' ? NativePositioning : Kind extends 'overlay' ? NativeOverlay : Kind extends 'scroll' ? NativeScroll : Kind extends 'scroll-axis' ? NativeScrollAxis : Kind extends 'scroll-follow' ? NativeScroll['endFollow'] : Kind extends 'text-control' ? NativeTextControl<Run> : Kind extends 'image-view' ? NativeImageView<Run> : Kind extends 'native-link' ? NativeLink<Run> : Kind extends 'axis-input' ? NativeAxisInput<Run> : Kind extends 'table-structure' ? NativeTableStructure : Kind extends 'table-states' ? NativeTableStructure['states'] : Kind extends 'table-snapshot' ? NativeTableSnapshot : Kind extends 'table-row' ? NativeTableRow : Kind extends 'table-cell' ? NativeTableCell : Kind extends 'table-diagnostic' ? NativeTableDiagnostic : Kind extends 'table-row-list' ? readonly NativeTableRow[] : Kind extends 'table-cell-list' ? readonly NativeTableCell[] : Kind extends 'table-diagnostic-list' ? readonly NativeTableDiagnostic[] : Kind extends 'a11y-ref-list' ? readonly object[] : Kind extends 'subscription-disposer' ? () => void : Kind extends 'host-target' ? Element : Kind extends 'focus-scope-key' | 'focus-roving-key' | 'a11y-ref' ? object : NativeConfig;
export interface NativeModuleCapabilities<Run = unknown> {
  hasAuthoredControlLabelName?(): boolean;
  beginControlLabelName?(): () => void;
  controlLabelAnatomyScope?(pair: NativeControlLabelAnatomyPair, kind: 'label' | 'target'): object | null;
  subscribeControlLabelAnatomy?(callback: () => void): () => void;
  anatomy: NativeAnatomy<Run>; accessible: NativeAccessibleExtension; positioning: NativePositioning;
  asFocusEntry(): NativeFocusEntry; asFocusRoving(): NativeFocusRoving; asFocusScope(): NativeFocusScope; asCollection(): NativeCollection; asCollectionItem(): NativeCollectionItem;
  asBoundary(): NativeBoundary<Run>; asHitParticipation(config?: NativeConfig): NativeHitParticipation; asOverlay(): NativeOverlay; asScrollSurface(): NativeScroll; asTextControl(): NativeTextControl<Run>; asImageView(): NativeImageView<Run>; asTableStructure(role: string): NativeTableStructure;
  asNativeLink(): NativeLink<Run>;
  asAxisInput(): NativeAxisInput<Run>;
  configureFocusable(config: NativeConfig): void; setFocusDisabled(value: boolean): void; setNavParticipation(value: string): void; setRovingStatus(status: NativeConfig): void; canFocus(): boolean; focus(options?: NativeFocusRequest): void; blur(): void;
  rootTag(): string | null; rootProperties(): Readonly<Record<string, string | number | boolean | null>>; projectAttributes(): Readonly<Record<string, string | null>>; portalTarget(): HTMLElement | null;
  adoptControlState(): void; commitHost(): void; mount(): void; unmount(): void; refresh(): void; dispose(): void;
}
export interface NativeAdapterModuleOptions<Run> {
  ensureSetup(operation: string): void; ensureRuntime(operation: string): void; ensureEvent(operation: string): void;
  isAlive(): boolean; isSetupComplete?(): boolean; isReady?(): boolean; invoke<T>(callback: () => T): T; getRun(): Run; getResolvedProps(): Readonly<Record<string, unknown>>; getRoot(): HTMLElement | null; getHost?(): HTMLElement | null;
  declarations: readonly { id: string; config: NativeConfig }[]; getLogicalParent(): object | null; identity: object;
  registerObservedState?<T extends boolean | string | number>(state: NativeObserved<T>): void;
  getExposes?(): Readonly<Record<string, unknown>>; setPresent?(value: boolean): void; requestHostUpdate?(): void; baseFocus?(): NativeFocusBase; getAccessibleRole?(): string | null;
  /** Internal focus bridge cleanup; never blurs the physical target. */
  cancelPendingFocus?(): void;
  emit?(key: string): void;
  createOwnedState?<T extends boolean | string | number>(name: string, initial: T, spec?: NativeOwnedStateSpec): NativeOwnedState<T>;
  watchState?<T>(state: { get(): T }, callback: (run: Run, event: NativeStateEvent<T>) => void): () => void;
  isPropProvided?(key: string): boolean;
  getMeta?(key: string): unknown;
  registerExpose?(key: string, value: unknown): void;
  tableFamily?: NativeAnatomyFamily;
  requestAttributeRefresh?(): void;
  getAttributeBaseline?(name: string): string | null;
  subscribeState?(state: { get(): unknown }, callback: () => void): () => void;
}
type Claim = { family: NativeAnatomyFamily; role: string; profile?: string; part: NativeAnatomyPart };
type Owner = { identity: object; parent(): object | null; target(): HTMLElement | null; host(): HTMLElement | null; alive(): boolean; hooks: Set<string>; claims: Map<object, Claim>; exposes(): Readonly<Record<string, unknown>>; focusConfig: Record<string, unknown>; scopeConfig: Record<string, unknown>; rovingConfig: Record<string, unknown>; selected: boolean; active: boolean; scopeDeclared: boolean; rovingDeclared: boolean; focusDeclared: boolean; entryDeclared: boolean; scopeActive: boolean; focus(request?: NativeFocusRequest): void; cancelPendingFocus(): void; changed(): void };
type NativeTableRecord = { role: string; config: NativeConfig; snapshot: NativeTableSnapshot | null; family?: NativeAnatomyFamily; ready(): boolean; refresh(logical: boolean): void; clear(): void; apply(role: string, row?: number, cell?: NativeTableCell, snapshot?: NativeTableSnapshot): void };
const tableRecords = new WeakMap<Owner, NativeTableRecord>();
const owners = new Map<object, Owner>();
const activeScopes: Owner[] = [];
let scopeRevision = 0;
let focusRequestEpoch = 0;
type ScopeEntryIntent = { cancel(): void };
let scopeEntryIntent: ScopeEntryIntent | undefined;
/** Internal request bookkeeping shared with the native-only Focus bridge. */
export function noteNativeFocusRequest(owner?: ScopeEntryIntent): boolean {
  const epoch = ++focusRequestEpoch, previous = scopeEntryIntent;
  scopeEntryIntent = owner;
  if (previous !== owner) previous?.cancel();
  return epoch === focusRequestEpoch && scopeEntryIntent === owner;
}
const parts = new WeakMap<NativeAnatomyPart, Owner>();
const targets = new WeakMap<HTMLElement, Owner>();
const boundaryStacks = new WeakMap<Document, Owner[]>();
const boundarySampleOwners = new WeakMap<object, Owner | null>();
type NativeBoundaryPointerSequence = { members: Set<Owner>; sample?: NativeConfig; outside: Set<Owner>; dispatches: number };
const boundaryPointerScopes = new WeakMap<Document, NativeBoundaryPointerSequence>();
function nativeBoundaryOwner(document: Document, sample?: NativeConfig): Owner | null {
  const native = sample?.nativeEvent;
  const identity = native && (typeof native === 'object' || typeof native === 'function') ? native as object : sample;
  if (identity && boundarySampleOwners.has(identity)) return boundarySampleOwners.get(identity) ?? null;
  const stack = boundaryStacks.get(document) ?? [];
  let selected: Owner | null = null;
  for (let index = stack.length - 1; index >= 0; index--) {
    const participant = stack[index], target = participant.target();
    if (participant.alive() && target?.isConnected && target.ownerDocument === document) { selected = participant; break; }
  }
  if (identity) boundarySampleOwners.set(identity, selected);
  return selected;
}
const modalLocks = new WeakMap<HTMLElement, { owners: Set<object>; overflow: string; overflowPriority: string; padding: string; paddingPriority: string }>();
const hitClaims = new WeakMap<HTMLElement, { owners: Map<object, string>; value: string; priority: string; projectedValue?: string; projectedPriority?: string }>();
const hostIds = new WeakMap<object, string>();
let nextHostId = 1;
type NativeTableCellInput = { ref: object; kind: 'headerCell' | 'cell'; headerKey?: string; headerKind?: unknown; headers: readonly string[]; rowSpan?: number; columnSpan?: number };
type NativeTableInput = { root: object; captions: readonly object[]; rows: readonly { ref: object; cells: readonly NativeTableCellInput[] }[]; unmatchedCells: readonly object[]; roleMismatches: readonly object[] };
/** Direct standalone lowering of module-table-structure's authoritative pure projection. */
function projectNativeTable(input: NativeTableInput): NativeTableSnapshot {
  const diagnostics: { code: string; ref?: object; row?: number; headerKey?: string }[] = [];
  if (input.captions.length > 1) diagnostics.push({ code: 'multiple-captions' });
  if (!input.rows.length) diagnostics.push({ code: 'missing-row' });
  for (const ref of input.unmatchedCells) diagnostics.push({ code: 'missing-row-parent', ref });
  for (const ref of input.roleMismatches) diagnostics.push({ code: 'role-mismatch', ref });
  let headerCount = 0, cellCount = 0;
  const dimensions = new Map<NativeTableCellInput, { rowSpan: number; columnSpan: number } | null>();
  for (let row = 0; row < input.rows.length; row++) {
    const current = input.rows[row];
    if (!current.cells.length) diagnostics.push({ code: 'empty-row', ref: current.ref, row });
    for (const cell of current.cells) {
      if (cell.kind === 'headerCell') {
        ++headerCount;
        if (!cell.headerKey) diagnostics.push({ code: 'missing-header-key', ref: cell.ref, row });
        if (cell.headerKind !== 'column' && cell.headerKind !== 'row') diagnostics.push({ code: 'missing-header-kind', ref: cell.ref, row });
      } else ++cellCount;
      const rowSpan = cell.rowSpan ?? 1, columnSpan = cell.columnSpan ?? 1;
      if (!Number.isSafeInteger(rowSpan) || rowSpan <= 0 || !Number.isSafeInteger(columnSpan) || columnSpan <= 0) {
        diagnostics.push({ code: 'invalid-span', ref: cell.ref }); dimensions.set(cell, null);
      } else dimensions.set(cell, { rowSpan, columnSpan });
    }
  }
  if (!headerCount) diagnostics.push({ code: 'missing-header-cell' });
  if (!cellCount) diagnostics.push({ code: 'missing-cell' });
  type MutableCell = { ref: object; kind: 'column-header' | 'row-header' | 'cell'; row: number; column: number; rowSpan: number; columnSpan: number; columnHeaders: object[]; rowHeaders: object[]; orderedHeaders: object[] };
  const occupied = new Map<number, { start: number; end: number }[]>(), placed = new Map<NativeTableCellInput, MutableCell>();
  const rows: { ref: object; index: number; cells: MutableCell[] }[] = [];
  let columnCount = 0;
  for (let row = 0; row < input.rows.length; row++) {
    const rowInput = input.rows[row], cells: MutableCell[] = [];
    let cursor = 0;
    for (const cell of rowInput.cells) {
      const dimensionsForCell = dimensions.get(cell);
      if (!dimensionsForCell) continue;
      const { rowSpan, columnSpan } = dimensionsForCell;
      if (row + rowSpan > input.rows.length) { diagnostics.push({ code: 'row-span-out-of-range', ref: cell.ref, row }); continue; }
      let column = cursor, columnValid = true;
      for (;;) {
        const end = column + columnSpan;
        if (!Number.isSafeInteger(end)) { columnValid = false; break; }
        let next = column;
        for (let offset = 0; offset < rowSpan; offset++) for (const interval of occupied.get(row + offset) ?? []) {
          if (interval.end <= column) continue;
          if (interval.start >= end) break;
          next = Math.max(next, interval.end); break;
        }
        if (next === column) break;
        column = next;
      }
      if (!columnValid) { diagnostics.push({ code: 'column-range-out-of-range', ref: cell.ref, row }); continue; }
      const end = column + columnSpan;
      for (let offset = 0; offset < rowSpan; offset++) {
        const rowIndex = row + offset, intervals = occupied.get(rowIndex) ?? [];
        let at = 0, start = column, mergedEnd = end;
        while (at < intervals.length && intervals[at].end < column) ++at;
        while (at < intervals.length && intervals[at].start <= mergedEnd) {
          start = Math.min(start, intervals[at].start); mergedEnd = Math.max(mergedEnd, intervals[at].end); intervals.splice(at, 1);
        }
        intervals.splice(at, 0, { start, end: mergedEnd }); occupied.set(rowIndex, intervals);
      }
      cursor = end; columnCount = Math.max(columnCount, cursor);
      const projected: MutableCell = { ref: cell.ref, kind: cell.kind === 'cell' ? 'cell' : cell.headerKind === 'row' ? 'row-header' : 'column-header', row, column, rowSpan, columnSpan, columnHeaders: [], rowHeaders: [], orderedHeaders: [] };
      cells.push(projected); placed.set(cell, projected);
    }
    rows.push({ ref: rowInput.ref, index: row, cells });
  }
  const headersByKey = new Map<string, NativeTableCellInput[]>();
  for (const row of input.rows) for (const cell of row.cells) if (cell.kind === 'headerCell' && cell.headerKey) {
    const matches = headersByKey.get(cell.headerKey);
    if (matches) matches.push(cell); else headersByKey.set(cell.headerKey, [cell]);
  }
  for (const [headerKey, matches] of headersByKey) if (matches.length > 1) diagnostics.push({ code: 'duplicate-header-key', ref: matches[0].ref, headerKey });
  for (let row = 0; row < input.rows.length; row++) for (const cell of input.rows[row].cells) {
    if (cell.kind === 'cell' && !cell.headers.length) diagnostics.push({ code: 'missing-cell-headers', ref: cell.ref, row });
    const source = placed.get(cell), seen = new Set<string>();
    for (const headerKey of cell.headers) {
      if (!headerKey) { diagnostics.push({ code: 'empty-header-reference', ref: cell.ref, row }); continue; }
      if (seen.has(headerKey)) { diagnostics.push({ code: 'duplicate-header-reference', ref: cell.ref, row, headerKey }); continue; }
      seen.add(headerKey);
      const matches = headersByKey.get(headerKey);
      if (!matches) { diagnostics.push({ code: 'missing-header-target', ref: cell.ref, row, headerKey }); continue; }
      if (matches.length !== 1) { diagnostics.push({ code: 'ambiguous-header-target', ref: cell.ref, row, headerKey }); continue; }
      const targetInput = matches[0], target = placed.get(targetInput);
      if (!target) { diagnostics.push({ code: 'unprojectable-header-target', ref: cell.ref, row, headerKey }); continue; }
      if (cell.kind === 'headerCell' && source && (target.row > source.row || target.row === source.row && target.column >= source.column)) {
        diagnostics.push({ code: 'non-upstream-header-target', ref: cell.ref, row, headerKey }); continue;
      }
      if (!source) continue;
      source.orderedHeaders.push(targetInput.ref);
      if (targetInput.headerKind === 'row') source.rowHeaders.push(targetInput.ref); else source.columnHeaders.push(targetInput.ref);
    }
  }
  return Object.freeze({ root: input.root, caption: input.captions.length === 1 ? input.captions[0] : undefined, rowCount: input.rows.length, columnCount,
    rows: Object.freeze(rows.map(row => Object.freeze({ ...row, cells: Object.freeze(row.cells.map(cell => Object.freeze({ ...cell,
      columnHeaders: Object.freeze(cell.columnHeaders), rowHeaders: Object.freeze(cell.rowHeaders), orderedHeaders: Object.freeze(cell.orderedHeaders) }))) }))),
    valid: !diagnostics.length, diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic))) });
}
${NATIVE_SCROLL_REVEAL_SOURCE}
${NATIVE_PART_RELATIONSHIPS_SOURCE}

function logicalRoot(owner: Owner): Owner {
  let current = owner;
  const visited = new Set<object>();
  while (!visited.has(current.identity)) {
    visited.add(current.identity);
    const parent = current.parent(), candidate = parent ? owners.get(parent) : undefined;
    if (!candidate) return current;
    current = candidate;
  }
  throw new Error('[Modules] cyclic logical ancestry.');
}
function ancestor(owner: Owner, predicate: (candidate: Owner) => boolean): Owner | null {
  let current: Owner | undefined = owner;
  const visited = new Set<object>();
  while (current) {
    if (visited.has(current.identity)) throw new Error('[Modules] cyclic logical ancestry.');
    visited.add(current.identity);
    if (!current.alive()) return null;
    if (predicate(current)) return current;
    const parent = current.parent(); current = parent ? owners.get(parent) : undefined;
  }
  return null;
}
function descends(owner: Owner, parent: Owner): boolean { return !!ancestor(owner, candidate => candidate === parent); }
function hostOrder(a: Owner, b: Owner): number {
  const left = a.host(), right = b.host();
  if (!left || !right || left === right) return 0;
  const order = left.compareDocumentPosition(right);
  if (order & 1) return 0;
  return order & 4 ? -1 : order & 2 ? 1 : 0;
}
function isElement(value: unknown): value is HTMLElement { return !!value && typeof value === 'object' && typeof (value as HTMLElement).getBoundingClientRect === 'function' && (value as HTMLElement).nodeType === 1; }
function targetOf(value: unknown): HTMLElement | null { return isElement(value) ? value : value && typeof value === 'object' ? parts.get(value as NativeAnatomyPart)?.target() ?? null : null; }
function contains(container: Node, target: Node): boolean {
  const visited = new Set<Node>();
  let current: Node | null = target;
  while (current && !visited.has(current)) {
    if (current === container) return true;
    visited.add(current);
    const logical: Owner | undefined = isElement(current) ? targets.get(current) : undefined;
    const parent: object | null | undefined = logical?.parent();
    current = parent && owners.get(parent)?.target() || (current as ShadowRoot).host || current.parentNode;
  }
  return false;
}
export function createNativeAdapterModules<Run>(options: NativeAdapterModuleOptions<Run>): NativeModuleCapabilities<Run> {
  let disposed = false, root: HTMLElement | null = null, generation = 0;
  let hostProperties: Readonly<Record<string, string | number | boolean | null>> | null = null, hostPortal: HTMLElement | null = null;
  const cleanups: (() => void)[] = [], terminalCleanups: (() => void)[] = [];
  const propertyBaselines = new Map<string, { value: string; projected: string }>();
  const hooks = new Set<string>(), claims = new Map<object, Claim>();
  const topologySubscribers = new Set<() => void>();
  let entryConfig: Record<string, unknown> = { strategy: 'self', fallback: 'self', disabled: false };
  const focusConfig: Record<string, unknown> = { disabled: false, navParticipation: 'auto' };
  const scopeConfig: Record<string, unknown> = { trap: false, loop: false, navigation: 'tab', orientation: 'both', entry: 'first', entryFallback: 'none', restore: 'previous', emptyPolicy: 'container' };
  const rovingConfig: Record<string, unknown> = { loop: false, navigation: 'arrow', orientation: 'both', entry: 'active', selectOnFocus: false };
  let pendingFocus: NativeFocusRequest | null = null, pendingNavigation: { operation: string; options?: NativeFocusRequest } | null = null;
  let restoreTarget: HTMLElement | null = null;
  let restoreOwner: Owner | undefined;
  let scopeActivation = 0;
  let ownedEntry: (ScopeEntryIntent & { activation: number; request: NativeFocusRequest; applying: boolean }) | undefined;
  let entryRootLease: HTMLElement | null = null;
  const nativeNotifications: (() => void)[] = [];
  let nativeNotifying = false;
  const observed = <T extends boolean | string | number>(initial: T, retained = false) => {
    let value = initial;
    const listeners = new Set<(event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void>();
    const handle: NativeObserved<T> = Object.freeze({
      get() { alive(); return value; },
      watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void) { setup('state.watch'); const listener = (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => callback(options.getRun() as unknown as R, event); listeners.add(listener); return () => { listeners.delete(listener); }; },
      subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void) { alive(); const registration = (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => callback(event); listeners.add(registration); return () => listeners.delete(registration); },
    });
    terminalCleanups.push(() => listeners.clear());
    return { handle, set(next: T, reason: unknown = 'native-module') {
      if (Object.is(value, next)) return;
      const prev = value; value = next; const epoch = generation, viewRoot = root;
      if (!(options.isSetupComplete?.() ?? true)) return;
      const event = { type: 'next' as const, prev, next, reason };
      ${emitRecordedNotification({ queue: 'nativeNotifications', draining: 'nativeNotifying', subscribers: 'listeners', alive: '!disposed && options.isAlive()', deliver: 'if (retained || viewRoot !== null && viewRoot === root && epoch === generation && ready() && (options.isReady?.() ?? true)) options.invoke(() => subscriber(event))' })}
    } };
  };
  const scopeActive = observed<boolean>(false), hasFocused = observed<boolean>(false), rovingActive = observed<boolean>(false), rovingHasFocused = observed<boolean>(false);
  const owner: Owner = { identity: options.identity, parent: options.getLogicalParent, target: () => root, host: () => root ? options.getHost?.() ?? root : null, alive: () => !disposed && options.isAlive(), hooks, claims, exposes: () => options.getExposes?.() ?? {}, focusConfig, scopeConfig, rovingConfig, selected: false, active: false, scopeDeclared: false, rovingDeclared: false, focusDeclared: false, entryDeclared: false, scopeActive: false, focus: __nativeFeature('focus') ? request => requestFocus(request) : () => { throw new Error('[Focus] owner does not declare focus.'); }, cancelPendingFocus() { if (__nativeFeature('focus')) { pendingFocus = null; options.cancelPendingFocus?.(); } }, changed: () => { const epoch = generation; for (const callback of [...topologySubscribers]) { if (epoch !== generation || !ready() || !(options.isReady?.() ?? true)) break; if (topologySubscribers.has(callback)) options.invoke(callback); } refresh(); } };
  if (owners.has(options.identity)) throw new Error('[Modules] duplicate live owner identity.');
  function alive() { if (disposed || !options.isAlive()) throw new Error('[Modules] owner is terminally disposed.'); }
  function setup(operation: string) { alive(); options.ensureSetup(operation); }
  function runtime(operation: string) { alive(); options.ensureRuntime(operation); }
  function requestPresentation() {
    if (disposed || !options.isAlive() || !(options.isReady?.() ?? true)) return;
    const next = rootProperties(), portal = portalTarget();
    const changed = !hostProperties || portal !== hostPortal || Object.keys(next).length !== Object.keys(hostProperties).length || Object.keys(next).some(key => next[key] !== hostProperties![key]);
    hostProperties = next; hostPortal = portal;
    if (changed) options.requestHostUpdate?.();
  }
  function ready() { return !disposed && options.isAlive() && !!root && root === options.getRoot() && root.isConnected; }
  function announceTopology(rootOwner = logicalRoot(owner)) { for (const participant of [...owners.values()]) if (participant.alive() && logicalRoot(participant) === rootOwner) participant.changed(); }
  function declare(name: string) { setup('hook.' + name); hooks.add(name); }
  function listen(target: EventTarget, type: string, callback: (event: Event) => void, listenerOptions?: AddEventListenerOptions) {
    const epoch = generation;
    let live = true;
    const guarded = (event: Event) => { if (live && epoch === generation && ready() && (options.isReady?.() ?? true)) callback(event); };
    const release = () => { if (!live) return; live = false; target.removeEventListener(type, guarded, listenerOptions); const index = cleanups.indexOf(release); if (index >= 0) cleanups.splice(index, 1); };
    target.addEventListener(type, guarded, listenerOptions); cleanups.push(release);
    return release;
  }
  function styleProperty(target: HTMLElement, name: string, value: string) {
    const current = target.style.getPropertyValue(name);
    const key = name;
    let record = propertyBaselines.get(key);
    if (!record) { record = { value: current, projected: current }; propertyBaselines.set(key, record); }
    else if (current !== record.projected) record.value = current;
    if (current !== value) { if (value) target.style.setProperty(name, value); else target.style.removeProperty(name); }
    record.projected = value;
  }
  function focusCandidates(roving: boolean, logical = false): Owner[] {
    const found: Owner[] = [];
    for (const candidate of owners.values()) {
      if (candidate === owner || !candidate.alive() || !candidate.focusDeclared || candidate.focusConfig.disabled || (!(logical && roving) && candidate.focusConfig.navParticipation === 'none')) continue;
      const target = candidate.target();
      if (!logical && (!target?.isConnected || target.closest('[hidden],[inert],[data-pui-view-detached]'))) continue;
      if (roving) {
        const key = candidate.focusConfig.groupKey;
        const provider = ancestor(candidate, participant => participant !== candidate && participant.rovingDeclared && (!key || participant.rovingConfig.key === key));
        if (provider !== owner) continue;
      } else if (!descends(candidate, owner) || candidate.focusConfig.scopeKey && candidate.focusConfig.scopeKey !== scopeConfig.key) continue;
      const duplicate = target ? found.findIndex(entry => entry.target() === target) : -1;
      if (duplicate < 0) found.push(candidate);
      else if (descends(candidate, found[duplicate])) found[duplicate] = candidate;
    }
    return found.sort(hostOrder);
  }
  function requestFocus(request?: NativeFocusRequest) {
    alive();
    if (focusConfig.disabled || !canFocus()) return;
    if (!ready() || root!.closest('[hidden],[inert],[data-pui-view-detached]')) { if (noteNativeFocusRequest()) pendingFocus = request ?? {}; return; }
    if (options.baseFocus) options.invoke(() => options.baseFocus!().focusSelf(request));
    else if (noteNativeFocusRequest()) root!.focus({ preventScroll: request?.preventScroll });
  }
  function canFocus(): boolean {
    alive();
    for (let index = activeScopes.length - 1; index >= 0; index--) {
      const scope = activeScopes[index];
      if (!scope.alive()) { activeScopes.splice(index, 1); continue; }
      if (scope.target()?.isConnected) return descends(owner, scope);
    }
    return true;
  }
  function navigate(operation: string, request?: NativeFocusRequest, roving = owner.rovingDeclared) {
    const members = focusCandidates(roving);
    if (!members.length) {
      if (request?.defer && roving && ['first','last','selected'].includes(operation)) pendingNavigation = { operation, options: request };
      else if (!roving && scopeConfig.emptyPolicy === 'container' && owner.focusDeclared) requestFocus(request);
      return;
    }
    const activeElement = root?.ownerDocument.activeElement;
    let index = members.findIndex(member => member.target() === activeElement);
    if (index < 0) index = members.findIndex(member => member.active);
    let next = operation === 'first' ? 0 : operation === 'last' ? members.length - 1 : operation === 'selected' ? Math.max(0, members.findIndex(member => member.selected)) : index < 0 ? operation === 'prev' ? members.length - 1 : 0 : index + (operation === 'prev' ? -1 : 1);
    if ((roving ? rovingConfig : scopeConfig).loop) next = (next + members.length) % members.length;
    if (next < 0 || next >= members.length) return;
    pendingNavigation = null;
    for (const member of members) member.active = member === members[next];
    members[next].focus({ reason: request?.reason ?? 'keyboard', preventScroll: request?.preventScroll });
    for (const member of members) member.changed();
  }
  function entryTarget(): HTMLElement | null {
    if (!ready() || !canFocus()) return null;
    if (entryConfig.strategy === 'descendant-first') {
      const candidates = root!.querySelectorAll<HTMLElement>('a[href],area[href],button,input,select,textarea,summary,iframe,audio[controls],video[controls],[contenteditable],[tabindex]');
      for (const candidate of candidates) {
        if (candidate.closest('[hidden],[inert],[aria-hidden="true"],[data-pui-view-detached]') || candidate.hasAttribute('disabled') || candidate.getAttribute('aria-disabled') === 'true' || candidate.tabIndex < 0) continue;
        if (candidate.localName === 'input' && (candidate as HTMLInputElement).type === 'hidden') continue;
        return candidate;
      }
    }
    return entryConfig.fallback === 'self' ? root : null;
  }
  function cancelOwnedEntry(intent = ownedEntry) {
    if (!intent) return;
    if (ownedEntry === intent) ownedEntry = undefined;
    if (scopeEntryIntent === intent) scopeEntryIntent = undefined;
  }
  function releaseEntryRoot() {
    const target = entryRootLease; entryRootLease = null;
    if (target?.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
  }
  function focusEntryTarget(target: HTMLElement, request?: NativeFocusRequest) {
    // Entry may focus its Root without adding it to sequential navigation or
    // declaring the portable Focusable role. Preserve authored tabindex values.
    if (target === root && target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
      entryRootLease = target; target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: request?.preventScroll });
  }
  function fulfillOwnedEntry() {
    const intent = ownedEntry;
    if (!intent || intent.applying || intent.activation !== scopeActivation || entryConfig.disabled) return;
    const target = entryTarget();
    if (!target || ownedEntry !== intent) return;
    intent.applying = true;
    try {
      focusEntryTarget(target, intent.request);
      if (ownedEntry === intent && (target.getRootNode() as Document | ShadowRoot).activeElement === target) cancelOwnedEntry(intent);
    } finally { intent.applying = false; }
  }
  const entry: NativeFocusEntry = {
    configure(config) { setup('focusEntry.configure'); entryConfig = { ...entryConfig, ...config }; },
    setDisabled(value) { runtime('focusEntry.setDisabled'); entryConfig.disabled = value; if (value) { ++scopeActivation; cancelOwnedEntry(); releaseEntryRoot(); } },
    focus(request) {
      runtime('focusEntry.focus'); if (entryConfig.disabled) return;
      const target = entryTarget();
      if (target && noteNativeFocusRequest()) focusEntryTarget(target, request);
    },
  };
  const roving: NativeFocusRoving = {
    active: rovingActive.handle, hasFocused: rovingHasFocused.handle,
    configure(config) { setup('focusRoving.configure'); Object.assign(rovingConfig, config); if (config.orientation && !['vertical','horizontal','both'].includes(String(config.orientation))) throw new Error('[Focus] invalid orientation.'); },
    setLoop(value) { runtime('focusRoving.setLoop'); rovingConfig.loop = value; },
    setOrientation(value) { runtime('focusRoving.setOrientation'); if (!['vertical','horizontal','both'].includes(value)) throw new Error('[Focus] invalid orientation.'); rovingConfig.orientation = value; },
    focusFirst(request) { runtime('focusRoving.focusFirst'); navigate('first', request, true); },
    focusLast(request) { runtime('focusRoving.focusLast'); navigate('last', request, true); },
    focusSelected(request) { runtime('focusRoving.focusSelected'); navigate('selected', request, true); },
    focusNext() { runtime('focusRoving.focusNext'); navigate('next', undefined, true); },
    focusPrev() { runtime('focusRoving.focusPrev'); navigate('prev', undefined, true); },
  };
  const scope: NativeFocusScope = {
    active: scopeActive.handle, hasFocused: hasFocused.handle,
    configure(config) { setup('focusScope.configure'); Object.assign(scopeConfig, config); if (config.group) { owner.rovingDeclared = true; if (typeof config.group === 'object') Object.assign(rovingConfig, config.group); } },
    focusFirst() { runtime('focusScope.focusFirst'); navigate('first', undefined, false); },
    focusLast() { runtime('focusScope.focusLast'); navigate('last', undefined, false); },
    focusSelected() { runtime('focusScope.focusSelected'); navigate('selected', undefined, false); },
    focusNext() { runtime('focusScope.focusNext'); navigate('next', undefined, false); },
    focusPrev() { runtime('focusScope.focusPrev'); navigate('prev', undefined, false); },
    activate(request) {
      runtime('focusScope.activate');
      const activation = ++scopeActivation, epoch = generation;
      const useEntry = scopeConfig.entryFallback === 'entry';
      const requestEpoch = focusRequestEpoch;
      if (useEntry) { cancelOwnedEntry(); request = { ...(request ?? { reason: 'programmatic' as const }) }; if (activation !== scopeActivation || requestEpoch !== focusRequestEpoch) return; }
      restoreTarget = null; restoreOwner = undefined;
      if (ready()) { const current = root!.ownerDocument.activeElement; if (current && !contains(root!, current)) { restoreTarget = current as HTMLElement; restoreOwner = targets.get(restoreTarget); } }
      const index = activeScopes.indexOf(owner); if (index >= 0) activeScopes.splice(index, 1); activeScopes.push(owner);
      let revision = ++scopeRevision;
      owner.scopeActive = true; scopeActive.set(true);
      if (activation !== scopeActivation || epoch !== generation || !owner.alive() || !owner.scopeActive) return;
      if (request?.entry !== 'manual' && scopeConfig.entry !== 'manual') {
        const candidates = focusCandidates(owner.rovingDeclared, useEntry);
        if (activation !== scopeActivation || epoch !== generation || !owner.alive() || !owner.scopeActive) return;
        // Strip only activation policy; omitted requests retain the old default.
        let focusRequest: NativeFocusRequest = request ?? { reason: 'programmatic' };
        if (request && Object.hasOwn(request, 'entry')) { const { entry: _entry, ...nativeRequest } = request; focusRequest = nativeRequest; }
        if (candidates.length) { if (revision === scopeRevision && (!useEntry || requestEpoch === focusRequestEpoch)) candidates[0].focus(focusRequest); }
        else {
          if (scopeConfig.emptyPolicy !== 'container') { const current = activeScopes.indexOf(owner); if (current >= 0) { activeScopes.splice(current, 1); revision = ++scopeRevision; } owner.scopeActive = false; scopeActive.set(false); }
          if (useEntry && owner.entryDeclared && !entryConfig.disabled && activation === scopeActivation && revision === scopeRevision && requestEpoch === focusRequestEpoch && owner.alive()) {
            const intent = { activation, request: focusRequest, applying: false, cancel: () => cancelOwnedEntry(intent) };
            ownedEntry = intent;
            if (noteNativeFocusRequest(intent)) fulfillOwnedEntry();
          }
        }
      }
    },
    deactivate(request) {
      runtime('focusScope.deactivate');
      const requestEpoch = focusRequestEpoch, activation = ++scopeActivation;
      cancelOwnedEntry();
      const index = activeScopes.indexOf(owner);
      if (index < 0) return;
      const target = restoreTarget, previous = restoreOwner, epoch = generation;
      const doc = root?.ownerDocument, focused = doc?.activeElement;
      activeScopes.splice(index, 1); const revision = ++scopeRevision; owner.scopeActive = false;
      // Retire old queued requests before active-state observers can remount a
      // child or create new work. Logical membership survives view detachment.
      for (const participant of owners.values()) {
        if (activation !== scopeActivation || requestEpoch !== focusRequestEpoch) break;
        if (participant === owner || descends(participant, owner)) participant.cancelPendingFocus();
      }
      if (activation !== scopeActivation || epoch !== generation || !owner.alive()) return;
      scopeActive.set(false);
      // A newer pending request owns the next transfer even without a DOM focus change.
      if (activation !== scopeActivation || epoch !== generation || !owner.alive() || revision !== scopeRevision || requestEpoch !== focusRequestEpoch || doc?.activeElement !== focused) return;
      if (scopeConfig.restore !== 'none' && ready() && target?.isConnected && (!previous || previous.alive() && previous.target() === target) && !target.closest('[hidden],[inert],[data-pui-view-detached]')) target.focus({ preventScroll: request?.preventScroll });
    },
    restoreFocus() { runtime('focusScope.restoreFocus'); if (ready() && restoreTarget?.isConnected && (!restoreOwner || restoreOwner.alive() && restoreOwner.target() === restoreTarget)) restoreTarget.focus(); },
    isActive() { alive(); return owner.scopeActive; },
    getRoving() { alive(); owner.rovingDeclared = true; registerFacts(roving.active); registerFacts(roving.hasFocused); return roving; },
  };
  function domain(family: NativeAnatomyFamily, required = true): Owner | null {
    const found = ancestor(owner, participant => participant.claims.get(family)?.role === 'root');
    if (!found && required) throw new Error('[Anatomy] current owner has no root domain for ' + family.debugName);
    return found;
  }
  function anatomyOwners(family: NativeAnatomyFamily, role?: string, ordered = false): Owner[] {
    const rootOwner = domain(family);
    const found: Owner[] = [];
    for (const participant of owners.values()) if (participant.alive() && participant.claims.has(family) && (!role || participant.claims.get(family)!.role === role)
      && ancestor(participant, current => current.claims.get(family)?.role === 'root') === rootOwner) found.push(participant);
    return ordered ? found.sort(hostOrder) : found;
  }
  function currentAnatomyPart(family: NativeAnatomyFamily, part: NativeAnatomyPart): Owner | null {
    const participant = parts.get(part), rootOwner = domain(family, false);
    return rootOwner && participant?.alive() && participant.claims.get(family)?.part === part &&
      ancestor(participant, candidate => candidate.claims.get(family)?.role === 'root') === rootOwner ? participant : null;
  }
  function anatomyDescendants(family: NativeAnatomyFamily, part: NativeAnatomyPart, role: string): readonly NativeAnatomyPart[] {
    const participant = currentAnatomyPart(family, part);
    if (!participant) return [];
    return anatomyOwners(family, role, true).filter((candidate) => candidate !== participant && descends(candidate, participant)).map((candidate) => candidate.claims.get(family)!.part);
  }
  const anatomyVersions = new Map<object, { members: readonly Owner[]; version: number }>();
  const anatomyOrder: NativeAnatomyOrder = {
    version(family) { alive(); const members = anatomyOwners(family, undefined, true); const previous = anatomyVersions.get(family); if (!previous) { anatomyVersions.set(family, { members, version: 0 }); return 0; } if (members.length !== previous.members.length || members.some((member, index) => member !== previous.members[index])) { previous.members = members; ++previous.version; } return previous.version; },
    parts(family) { alive(); return anatomyOwners(family, undefined, true).map(participant => participant.claims.get(family)!.part); },
    partsOf(family, role) { alive(); return anatomyOwners(family, role, true).map(participant => participant.claims.get(family)!.part); },
    indexOfSelf(family, role) { alive(); return anatomyOwners(family, role, true).indexOf(owner); },
    prevOfSelf(family, role) { const members = anatomyOwners(family, role, true); const index = members.indexOf(owner); return index > 0 ? members[index - 1].claims.get(family)!.part : null; },
    nextOfSelf(family, role) { const members = anatomyOwners(family, role, true); const index = members.indexOf(owner); return index >= 0 && index + 1 < members.length ? members[index + 1].claims.get(family)!.part : null; },
  };
  const anatomy: NativeAnatomy<Run> = {
    ...anatomyOrder, order: anatomyOrder,
    claim(family, declaration) {
      setup('anatomy.claim');
      if (!family?.roles[declaration.role] || claims.has(family)) throw new Error('[Anatomy] invalid/duplicate family role claim.');
      if (declaration.profile && (declaration.role !== 'root' || !family.profiles?.[declaration.profile])) throw new Error('[Anatomy] invalid root profile.');
      const part: NativeAnatomyPart = Object.freeze({ role: declaration.role, hasExpose(key: string) { return Object.hasOwn(owner.exposes(), key); }, getExpose(key: string) { return owner.exposes()[key] ?? null; }, hasHook(name: string) { return hooks.has(name); } });
      claims.set(family, { family, ...declaration, part }); parts.set(part, owner);
    },
    has(family, role) { alive(); return domain(family, false) !== null && anatomyOwners(family, role).length > 0; },
    parts(family) { alive(); return anatomyOwners(family).map(participant => participant.claims.get(family)!.part); },
    partsOf(family, role) { alive(); return anatomyOwners(family, role).map(participant => participant.claims.get(family)!.part); },
    descendantsOf(family, part, role) {
      alive();
      if (options.isSetupComplete?.() === false) throw new Error('[Anatomy] descendantsOf is runtime-only.');
      return anatomyDescendants(family, part, role);
    },
    subscribeParts(family, role, callback) {
      setup('anatomy.subscribeParts');
      let previous: readonly NativeAnatomyPart[] = [];
      const changed = () => { if (!domain(family, false)) return; const next = anatomyOrder.partsOf(family, role); if (next.length === previous.length && next.every((part, index) => part === previous[index])) return; previous = next; callback(options.getRun(), next); };
      topologySubscribers.add(changed); return () => { setup('anatomy.subscribeParts.off'); topologySubscribers.delete(changed); };
    },
  };
  // Axis samples are host facts. Domain quantization, preview, commit and keyboard
  // policy continue to execute in the authored source that registered this input.
  type AxisHost = ReturnType<typeof createWebAxisInputHost>;
  type AxisConfig = Parameters<AxisHost['attach']>[0]['config'];
  type AxisTargets = { domain: Owner; input: HTMLElement; geometry: HTMLElement; travel?: HTMLElement;
    deltaBasis?: readonly HTMLElement[]; owners: readonly Owner[]; parts: readonly NativeAnatomyPart[] };
  let axisDeclared = false, axisBinding: NativeAxisInputBinding | null = null;
  let axisConfig: AxisConfig = {axis:'horizontal',direction:'ltr',disabled:true,readOnly:false,reverse:false,contactBasis:'preserve-start',activation:'immediate'};
  let axisHost: AxisHost | null = null, axisLease: ReturnType<AxisHost['attach']> | null = null;
  let axisTargets: AxisTargets | null = null, axisEpoch = 0, axisDelivery = 0, axisActive = false;
  const axisListeners: ((run: Run, sample: NativeAxisInputSample) => void)[] = [];
  function axisAncestor(participant: Owner, family: NativeAnatomyFamily, role: string, rootOwner: Owner): Owner | null {
    const visited = new Set<Owner>();
    let current: Owner | undefined = participant;
    while (current && !visited.has(current)) {
      visited.add(current);
      if (current.claims.get(family)?.role === role) return current;
      if (current === rootOwner) return null;
      const parent = current.parent(); current = parent ? owners.get(parent) : undefined;
    }
    return null;
  }
  function resolveAxisTargets(): AxisTargets | null {
    const binding = axisBinding;
    if (!binding || !ready() || claims.get(binding.anatomy)?.role !== binding.inputRole) return null;
    const rootOwner = domain(binding.anatomy, false);
    if (!rootOwner) return null;
    const geometryOwner = axisAncestor(owner, binding.anatomy, binding.geometryRole, rootOwner);
    const input = owner.target(), geometry = geometryOwner?.target();
    if (!geometryOwner || !input?.isConnected || !geometry?.isConnected || input.ownerDocument !== geometry.ownerDocument) return null;
    const participants = [owner, geometryOwner];
    let travel: HTMLElement | undefined, deltaBasis: HTMLElement[] | undefined;
    if (binding.travelRole !== undefined) {
      const candidates = anatomyOwners(binding.anatomy, binding.travelRole, true).filter(participant => axisAncestor(participant, binding.anatomy, binding.geometryRole, rootOwner) === geometryOwner);
      if (candidates.length !== 1) return null;
      const target = candidates[0].target();
      if (!target?.isConnected || target.ownerDocument !== input.ownerDocument) return null;
      participants.push(candidates[0]); travel = target;
    }
    if (binding.deltaBasisRole !== undefined) {
      const candidates = anatomyOwners(binding.anatomy, binding.deltaBasisRole, true).filter(participant => axisAncestor(participant, binding.anatomy, binding.geometryRole, rootOwner) === geometryOwner);
      if (!candidates.length) return null;
      const targets = candidates.map(participant => participant.target());
      if (targets.some(target => !target?.isConnected || target.ownerDocument !== input.ownerDocument)) return null;
      participants.push(...candidates); deltaBasis = targets as HTMLElement[];
    }
    return {domain:rootOwner,input,geometry,travel,deltaBasis,owners:participants,parts:participants.map(participant => participant.claims.get(binding.anatomy)!.part)};
  }
  function sameAxisTargets(next: AxisTargets | null): boolean {
    return !!next && !!axisTargets && next.domain === axisTargets.domain && next.input === axisTargets.input && next.geometry === axisTargets.geometry && next.travel === axisTargets.travel &&
      next.owners.length === axisTargets.owners.length && next.owners.every((participant,index) => participant === axisTargets!.owners[index] && next.parts[index] === axisTargets!.parts[index]) &&
      (next.deltaBasis?.length ?? 0) === (axisTargets.deltaBasis?.length ?? 0) && (next.deltaBasis?.every((target,index) => target === axisTargets!.deltaBasis?.[index]) ?? true);
  }
  function dispatchAxis(sample: NativeAxisInputSample) {
    if (disposed || !options.isAlive() || !axisListeners.length) return;
    const delivery = ++axisDelivery, epoch = axisEpoch;
    options.invoke(() => { for (const listener of [...axisListeners]) {
      if (delivery !== axisDelivery || epoch !== axisEpoch || disposed || !options.isAlive()) break;
      listener(options.getRun(), sample);
    } });
  }
  function disconnectAxis(reason: NativeAxisInputCancelReason): number {
    const epoch = ++axisEpoch, lease = axisLease, active = axisActive;
    axisLease = null; axisTargets = null; axisActive = false;
    lease?.dispose();
    if (active) dispatchAxis(Object.freeze({phase:'cancel',reason}));
    return epoch;
  }
  function receiveAxis(epoch: number) {
    return (sample: NativeAxisInputSample) => {
      if (epoch !== axisEpoch || !ready() || !(options.isReady?.() ?? true)) return;
      if (!sameAxisTargets(resolveAxisTargets())) { refreshAxis(); return; }
      if (sample.phase === 'start') { if (axisActive || axisConfig.disabled || axisConfig.readOnly) return; axisActive = true; }
      else { if (!axisActive) return; if (sample.phase === 'end' || sample.phase === 'cancel') axisActive = false; }
      dispatchAxis(sample);
    };
  }
  function refreshAxis() {
    if (!axisDeclared || disposed) return;
    const targets = resolveAxisTargets();
    const binding = targets && {inputTarget:targets.input,geometryTarget:targets.geometry,travelTarget:targets.travel,deltaBasisTargets:targets.deltaBasis,config:axisConfig,onSample:receiveAxis(axisEpoch)};
    if (axisLease && binding && sameAxisTargets(targets)) { axisLease.update(binding); return; }
    const epoch = disconnectAxis(targets ? 'target-replaced' : root ? 'target-detached' : 'disposed');
    if (!targets || !binding || epoch !== axisEpoch || !ready()) return;
    axisTargets = targets;
    axisHost ??= createWebAxisInputHost();
    const lease = axisHost.attach({...binding,onSample:receiveAxis(epoch)});
    if (epoch !== axisEpoch || !ready()) lease.dispose(); else axisLease = lease;
  }
  const axisInput: NativeAxisInput<Run> = {
    configure(binding) {
      setup('axisInput.configure');
      if (axisBinding) throw new Error('[AxisInput] Input anatomy may be configured only once.');
      for (const role of [binding.inputRole,binding.geometryRole,binding.travelRole,binding.deltaBasisRole])
        if (role !== undefined && !binding.anatomy.roles[role]) throw new Error('[AxisInput] Input and geometry roles must belong to the anatomy family.');
      axisBinding = Object.freeze({...binding});
      topologySubscribers.add(refreshAxis);
    },
    on(listener) { setup('axisInput.on'); axisListeners.push(listener); },
    sync(patch) {
      runtime('axisInput.sync');
      for (const key of ['disabled','readOnly','reverse']) if (patch[key] !== undefined && typeof patch[key] !== 'boolean') throw new TypeError('[AxisInput] Invalid boolean input policy.');
      if (patch.axis !== undefined && patch.axis !== 'horizontal' && patch.axis !== 'vertical' || patch.direction !== undefined && patch.direction !== 'ltr' && patch.direction !== 'rtl' ||
        patch.activation !== undefined && patch.activation !== 'immediate' && patch.activation !== 'directional' || patch.contactBasis !== undefined && patch.contactBasis !== 'preserve-start' && patch.contactBasis !== 'cancel-on-extent-change') throw new TypeError('[AxisInput] Invalid input policy.');
      const next = {...axisConfig};
      for (const key of Object.keys(next) as (keyof AxisConfig)[]) if (patch[key] !== undefined) (next as Record<string,unknown>)[key] = patch[key];
      if ((Object.keys(next) as (keyof AxisConfig)[]).every(key => next[key] === axisConfig[key])) return;
      axisConfig = Object.freeze(next); refreshAxis();
    },
  };
  let collectionConfig: NativeConfig | null = null, itemConfig: NativeConfig | null = null;
  let collection: NativeCollection | null = null, collectionItem: NativeCollectionItem | null = null;
  let itemSnapshot: NativeCollectionSnapshot = Object.freeze({ index: -1, total: 0, first: false, last: false });
  function owned<T extends boolean | string | number>(name: string, initial: T, spec?: NativeOwnedStateSpec): NativeOwnedState<T> {
    if (!options.createOwnedState) throw new Error('[Modules] owned State creation requires the owner State facility.');
    return options.createOwnedState(name, initial, spec);
  }
  function expose(key: string, value: unknown) {
    if (!options.registerExpose) throw new Error('[Collection] hook exposes require the owner Expose facility.');
    options.registerExpose(key, value);
  }
  function writeOwned<T>(state: NativeOwnedState<T>, value: T, reason: string) {
    if (disposed || !options.isAlive() || Object.is(state.get(), value)) return;
    options.invoke(() => state.set(value, reason));
  }
  function collectionMembers(config: NativeConfig | null, roleKey: string): Owner[] {
    const family = config?.family as NativeAnatomyFamily | undefined;
    return family && domain(family, false) ? anatomyOwners(family, String(config![roleKey]), true) : [];
  }
  function readCollectionItems(): readonly NativeCollectionSnapshot[] {
    alive();
    const members = collectionMembers(collectionConfig, 'itemRole'), total = members.length;
    return members.map((participant, index) => {
      const metadata = participant.exposes()[String(collectionConfig!.itemMetaExposeKey)];
      const resolved = typeof metadata === 'function' ? metadata() : metadata;
      return Object.freeze({ ...(resolved && typeof resolved === 'object' ? resolved as NativeConfig : {}), index, total, first: index === 0, last: index === total - 1 });
    });
  }
  function readItemSnapshot(): NativeCollectionSnapshot {
    alive();
    const members = collectionMembers(itemConfig, 'role'), index = members.indexOf(owner), total = members.length;
    const position = index < 0 && total === 0 ? { index: itemSnapshot.index, total: itemSnapshot.total, first: itemSnapshot.first, last: itemSnapshot.last }
      : { index, total, first: index === 0 && total > 0, last: index >= 0 && index === total - 1 };
    const { index: _index, total: _total, first: _first, last: _last, ...previousMeta } = itemSnapshot;
    const getMeta = itemConfig?.getMeta;
    const meta = ready() && typeof getMeta === 'function' ? options.invoke(() => getMeta(options.getRun())) : previousMeta;
    return Object.freeze({ ...meta, ...position });
  }
  function syncCollection() {
    if (!ready() || !(options.isReady?.() ?? true)) return;
    if (collection && collectionConfig) writeOwned(collection.count, collectionMembers(collectionConfig, 'itemRole').length, 'collection.sync');
    if (collectionItem && itemConfig) {
      const snapshot = readItemSnapshot(); itemSnapshot = snapshot;
      writeOwned(collectionItem.collectionIndex, Number(snapshot.index), 'collection.sync');
      writeOwned(collectionItem.collectionTotal, Number(snapshot.total), 'collection.sync');
      writeOwned(collectionItem.collectionFirst, Boolean(snapshot.first), 'collection.sync');
      writeOwned(collectionItem.collectionLast, Boolean(snapshot.last), 'collection.sync');
    }
  }
  function declareCollection(): NativeCollection {
    if (collection) return collection;
    const count = owned('collectionCount', 0);
    collection = {
      count,
      configure(config) {
        setup('collection.configure');
        if (!config.family) throw new Error('[Collection] configure requires an Anatomy family.');
        collectionConfig = { ...config, itemRole: config.itemRole ?? 'item', itemMetaExposeKey: config.itemMetaExposeKey ?? '__collectionItem' };
        const role = config.ownerRole ?? config.rootRole ?? false;
        if (role) anatomy.claim(config.family as NativeAnatomyFamily, { role: String(role) });
        expose(String(config.exposeCountStateKey ?? 'count'), count);
        expose(String(config.exposeItemsMethodKey ?? 'getCollectionItems'), readCollectionItems);
        expose(String(config.exposeCountMethodKey ?? 'getCollectionCount'), () => collection!.getCount());
      },
      getItems: readCollectionItems,
      getCount() { alive(); return collectionMembers(collectionConfig, 'itemRole').length; },
    };
    topologySubscribers.add(syncCollection);
    return collection;
  }
  function declareCollectionItem(): NativeCollectionItem {
    if (collectionItem) return collectionItem;
    const collectionIndex = owned('collectionIndex', -1), collectionTotal = owned('collectionTotal', 0), collectionFirst = owned('collectionFirst', false), collectionLast = owned('collectionLast', false);
    collectionItem = {
      collectionIndex, collectionTotal, collectionFirst, collectionLast,
      configure(config) {
        setup('collectionItem.configure');
        if (!config.family) throw new Error('[Collection] item configure requires an Anatomy family.');
        itemConfig = { ...config, role: config.role ?? 'item' };
        anatomy.claim(config.family as NativeAnatomyFamily, { role: String(itemConfig.role) });
        expose(String(config.exposeIndexStateKey ?? 'collectionIndex'), collectionIndex);
        expose(String(config.exposeTotalStateKey ?? 'collectionTotal'), collectionTotal);
        expose(String(config.exposeFirstStateKey ?? 'collectionFirst'), collectionFirst);
        expose(String(config.exposeLastStateKey ?? 'collectionLast'), collectionLast);
        expose(String(config.exposeSnapshotMethodKey ?? 'getCollectionItem'), readItemSnapshot);
        expose(String(config.metaExposeKey ?? '__collectionItem'), readItemSnapshot);
      },
      getSnapshot: readItemSnapshot,
    };
    topologySubscribers.add(syncCollection);
    return collectionItem;
  }
  let boundaryObserved = false, boundaryFocusObserved = false, stackActive = false, boundaryRevision = 0;
  let boundaryStackDocument: Document | null = null;
  let boundaryPointerScope: Document | null = null, boundaryPointerSequence: NativeBoundaryPointerSequence | null = null;
  let boundaryConfig: NativeConfig = {};
  const boundaryRegions = new Map<object, { target: unknown; config: NativeConfig }>();
  let boundaryRootReplacement: { target: unknown } | null = null;
  let hitRegions = new Map<object, { target: unknown; config: NativeConfig }>();
  const hitSelfTarget = Object.freeze({});
  let hitRetired = false;
  const outsideListeners = new Set<(event: NativeConfig) => void>();
  let hitConfig: NativeConfig = { mode: 'participating' };
  const hitApplied = new Set<HTMLElement>();
  function classify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown' {
    const sampleTarget = sample?.target ?? (sample?.nativeEvent as Event | undefined)?.target;
    if ([...boundaryRegions.values()].some(region => Object.is(region.target, sampleTarget))) return 'inside';
    if (!sampleTarget || typeof sampleTarget !== 'object' || typeof (sampleTarget as Node).nodeType !== 'number') return 'unknown';
    const boundaryRoot = boundaryRootReplacement ? targetOf(boundaryRootReplacement.target) : options.getHost?.() ?? root;
    let count = boundaryRoot ? 1 : 0, allKnown = true;
    if (boundaryRoot && contains(boundaryRoot, sampleTarget as Node)) return 'inside';
    for (const region of boundaryRegions.values()) {
      count++;
      const target = targetOf(region.target);
      if (!target) { allKnown = false; continue; }
      if (contains(target, sampleTarget as Node)) return 'inside';
    }
    return count > 0 && allKnown ? 'outside' : 'unknown';
  }
  function notifyOutside(sample?: NativeConfig, observation?: 'pointer.press' | 'focus.move', ownerSample = sample) {
    if (!ready() || !(options.isReady?.() ?? true)) return 'unknown';
    const epoch = generation, revision = boundaryRevision;
    const selected = stackActive ? nativeBoundaryOwner(root!.ownerDocument, ownerSample) : null;
    const classification = classify(sample);
    if (epoch !== generation || revision !== boundaryRevision || !ready() || !(options.isReady?.() ?? true)) return 'unknown';
    if (classification !== 'outside') return classification;
    if (stackActive && selected && selected !== owner) return 'unknown';
    // Claim this press before an outside subscriber can synchronously focus or
    // close/reopen another owner in the same input scope.
    if (observation === 'pointer.press') boundaryPointerSequence?.outside.add(owner);
    const event = Object.freeze({ classification, ...(observation ? { observation } : {}), sample });
    for (const callback of [...outsideListeners]) { if (epoch !== generation || revision !== boundaryRevision || !ready() || !(options.isReady?.() ?? true)) break; if (outsideListeners.has(callback)) options.invoke(() => callback(event)); }
    return classification;
  }
  function leaveBoundaryPointerScope() {
    const scope = boundaryPointerScope, sequence = boundaryPointerSequence;
    boundaryPointerScope = null; boundaryPointerSequence = null;
    if (!scope || !sequence) return;
    sequence.members.delete(owner);
    if (!sequence.members.size && !sequence.dispatches && boundaryPointerScopes.get(scope) === sequence) boundaryPointerScopes.delete(scope);
  }
  function enterBoundaryPointerScope(document: Document) {
    leaveBoundaryPointerScope();
    let sequence = boundaryPointerScopes.get(document);
    if (!sequence) { sequence = { members: new Set(), outside: new Set(), dispatches: 0 }; boundaryPointerScopes.set(document, sequence); }
    boundaryPointerScope = document; boundaryPointerSequence = sequence; sequence.members.add(owner);
  }
  function withBoundaryPointerScope(callback: (sequence: NativeBoundaryPointerSequence) => void) {
    const scope = boundaryPointerScope, sequence = boundaryPointerSequence;
    if (!scope || !sequence || !ready()) return;
    sequence.dispatches++;
    try { callback(sequence); }
    finally { sequence.dispatches--; if (!sequence.members.size && !sequence.dispatches && boundaryPointerScopes.get(scope) === sequence) boundaryPointerScopes.delete(scope); }
  }
  function sampleBoundaryFocus(native: Event, document: Document): NativeConfig | null {
    const FocusEventType = document.defaultView?.FocusEvent;
    if (!FocusEventType || !(native instanceof FocusEventType) || native.type !== 'focusin') return null;
    const target = native.composedPath()[0] ?? native.target;
    if (!isElement(target) || target.ownerDocument !== document) return null;
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!active || (active !== target && !contains(target, active))) return null;
    return Object.freeze({ type: 'focusin', target: active, nativeEvent: native });
  }
  function retireBoundaryStack() {
    const document = boundaryStackDocument; boundaryStackDocument = null;
    if (!document) return;
    const stack = boundaryStacks.get(document), index = stack?.indexOf(owner) ?? -1;
    if (index >= 0) stack!.splice(index, 1);
  }
  function reconcileStack() {
    const document = root?.ownerDocument ?? boundaryStackDocument;
    if (boundaryStackDocument && (boundaryStackDocument !== document || !stackActive)) retireBoundaryStack();
    if (!document || !stackActive) return;
    const stack = boundaryStacks.get(document) ?? [];
    if (!stack.includes(owner)) stack.push(owner);
    boundaryStacks.set(document, stack); boundaryStackDocument = document;
  }
  const boundary: NativeBoundary<Run> = {
    configure(config) { setup('boundary.configure'); if (config.meta && typeof config.meta !== 'object') throw new TypeError('[Boundary] metadata must be a record.'); boundaryConfig = { ...boundaryConfig, ...config }; },
    observe(type) { setup('boundary.observe'); if (type === 'pointer.press') boundaryObserved = true; else if (type === 'focus.move') boundaryFocusObserved = true; else throw new Error('[Boundary] unsupported observation.'); },
    setStackActive(value) { alive(); if (value) retireBoundaryStack(); stackActive = value; reconcileStack(); },
    registerRegion(target, config = {}) { alive(); const token = {}; boundaryRegions.set(token, { target, config }); boundaryRevision++; return () => { if (boundaryRegions.delete(token)) boundaryRevision++; }; },
    unregisterRegion(target) { alive(); for (const [token, region] of boundaryRegions) if (Object.is(region.target, target)) { boundaryRegions.delete(token); boundaryRevision++; } },
    classify(sample) { alive(); return classify(sample); },
    notify(sample) { alive(); return notifyOutside(sample); },
    subscribeOutside(callback) { alive(); outsideListeners.add(callback); return () => { outsideListeners.delete(callback); }; },
  };
  function releaseHit(target: HTMLElement) {
    const claims = hitClaims.get(target);
    if (!claims) return;
    claims.owners.delete(options.identity);
    if (!claims.owners.size) {
      restoreHit(target, claims);
      hitClaims.delete(target); target.removeAttribute('data-pui-hit-participation');
    }
    hitApplied.delete(target);
  }
  function restoreHit(target: HTMLElement, claims: { value: string; priority: string; projectedValue?: string; projectedPriority?: string }) {
    if (claims.projectedValue === undefined || target.style.getPropertyValue('pointer-events') !== claims.projectedValue || target.style.getPropertyPriority('pointer-events') !== claims.projectedPriority) return;
    if (claims.value) target.style.setProperty('pointer-events', claims.value, claims.priority); else target.style.removeProperty('pointer-events');
    claims.projectedValue = undefined; claims.projectedPriority = undefined;
  }
  function projectHit() {
    if (!ready()) return;
    const next = new Map<HTMLElement, string>();
    if (hooks.has('asHitParticipation')) next.set(root!, String(hitConfig.mode));
    for (const region of hitRegions.values()) { const target = region.target === hitSelfTarget ? root : targetOf(region.target); if (target) next.set(target, String(region.config.mode)); }
    for (const [target, mode] of next) for (const [identity, other] of hitClaims.get(target)?.owners ?? [])
      if (identity !== options.identity && other !== mode) throw new Error('[HitParticipation] conflicting modes on a shared target.');
    for (const target of [...hitApplied]) if (!next.has(target)) releaseHit(target);
    for (const [target, mode] of next) {
      let claims = hitClaims.get(target);
      if (!claims) { claims = { owners: new Map(), value: target.style.getPropertyValue('pointer-events'), priority: target.style.getPropertyPriority('pointer-events') }; hitClaims.set(target, claims); }
      claims.owners.set(options.identity, mode); hitApplied.add(target);
      target.setAttribute('data-pui-hit-participation', mode);
      if (mode === 'participating') restoreHit(target, claims);
      else {
        const value = target.style.getPropertyValue('pointer-events'), priority = target.style.getPropertyPriority('pointer-events');
        if (claims.projectedValue !== undefined && (value !== claims.projectedValue || priority !== claims.projectedPriority)) { claims.value = value; claims.priority = priority; }
        target.style.setProperty('pointer-events', 'none'); claims.projectedValue = 'none'; claims.projectedPriority = '';
      }
    }
  }
  function selfHitMode(): string {
    let mode = String(hitConfig.mode);
    for (const region of hitRegions.values()) if (region.target === hitSelfTarget || root && targetOf(region.target) === root) mode = String(region.config.mode);
    return mode;
  }
  function replaceHitRegions(next: Map<object, { target: unknown; config: NativeConfig }>) {
    const previous = hitRegions; hitRegions = next;
    try { projectHit(); }
    catch (error) { hitRegions = previous; throw error; }
  }
  function registerHitRegion(target: unknown, config: NativeConfig = {}) {
    alive();
    if (hitRetired) throw new Error('[HitParticipation] self region owner is disposed.');
    // Snapshot caller fields once before choosing the current declarations: a
    // getter may acquire another lease or retire this owner synchronously.
    const role = config.role, mode = config.mode, inset = config.staticHitInset, meta = config.meta;
    alive();
    if (hitRetired) throw new Error('[HitParticipation] self region owner is disposed.');
    if (mode !== undefined && !['participating','disabled','passthrough'].includes(String(mode))) throw new Error('[HitParticipation] invalid mode.');
    if (inset != null) throw new Error('[HitParticipation] native source v1 does not support staticHitInset.');
    const token = {}, snapshot = Object.freeze({ role, mode: mode ?? hitConfig.mode, meta });
    const next = new Map(hitRegions); next.set(token, { target, config: snapshot });
    replaceHitRegions(next);
    return () => {
      if (!hitRegions.has(token)) return;
      const next = new Map(hitRegions); next.delete(token);
      replaceHitRegions(next);
    };
  }
  const hit: NativeHitParticipation = {
    configure(config) { setup('hitParticipation.configure'); const mode = config.mode, inset = config.staticHitInset, debugLabel = config.debugLabel, meta = config.meta; if (mode !== undefined && !['participating','disabled','passthrough'].includes(String(mode))) throw new Error('[HitParticipation] invalid mode.'); if (inset != null) throw new Error('[HitParticipation] native source v1 does not support staticHitInset.'); hitConfig = Object.freeze({ mode: mode ?? hitConfig.mode, debugLabel: debugLabel ?? hitConfig.debugLabel, meta: meta ? Object.freeze({ ...(hitConfig.meta as Record<string, unknown> | undefined), ...(meta as Record<string, unknown>) }) : hitConfig.meta }); },
    registerSelfRegion(config) { return registerHitRegion(hitSelfTarget, config); },
    registerRegion: registerHitRegion,
    unregisterRegion(target) { alive(); const next = new Map(hitRegions); for (const [token, region] of next) if (Object.is(region.target, target)) next.delete(token); replaceHitRegions(next); },
  };
  let explicitId: string | { get(): string | null | undefined } | undefined, accessibleName: string | { get(): string | null | undefined } | undefined, accessibleDescription: string | { get(): string | null | undefined } | undefined, accessibleLevel: number | { get(): number } | undefined;
  let accessibleTree: NativeConfig = {};
  let controlLabelProjection: object | null = null;
  const accessibleSubscriptions = new Map<string, () => void>();
  const relations = new Map<string, NativeConfig>();
  let partRelationships: NativePartRelationships | null = null;
  function relationshipOwner(): NativePartRelationships {
    if (!partRelationships) partRelationships = createNativePartRelationships(owner, () => generation, (state, callback) => options.subscribeState ? options.subscribeState(state, callback) : 'subscribe' in state && typeof state.subscribe === 'function' ? state.subscribe(callback) : undefined);
    return partRelationships;
  }
  const relationAttributes: Record<string, string> = { labelledBy: 'aria-labelledby', describedBy: 'aria-describedby', controls: 'aria-controls', owns: 'aria-owns', activeDescendant: 'aria-activedescendant', details: 'aria-details', errorMessage: 'aria-errormessage', flowTo: 'aria-flowto' };
  const readValue = (value: unknown): unknown => value && typeof value === 'object' && 'get' in value && typeof value.get === 'function' ? value.get() : value;
  function watchAccessible(key: string, value: unknown) {
    accessibleSubscriptions.get(key)?.(); accessibleSubscriptions.delete(key);
    if (!value || typeof value !== 'object' || !('get' in value) || typeof value.get !== 'function') return;
    const state = value as { get(): unknown; subscribe?(callback: () => void): () => void };
    const off = options.subscribeState ? options.subscribeState(state, refresh) : state.subscribe?.(refresh);
    if (off) accessibleSubscriptions.set(key, off);
  }
  function hostId(identity: object) {
    const participant = owners.get(identity);
    const existing = participant?.target()?.id;
    if (existing) { hostIds.set(identity, existing); return existing; }
    let id = hostIds.get(identity);
    if (!id) { id = 'pui-object-' + nextHostId++; hostIds.set(identity, id); }
    return id;
  }
  function relationValue(config: NativeConfig): string | null {
    const value = readValue(config.target);
    if (typeof value === 'string') return value || null;
    const references = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
    const ids: string[] = [];
    for (const reference of references) {
      const related = parts.get(reference as NativeAnatomyPart) ?? owners.get(reference as object);
      if (!related?.alive()) continue;
      const relatedTarget = related.target();
      if (root && (!relatedTarget?.isConnected || relatedTarget.ownerDocument !== root.ownerDocument)) continue;
      const id = hostId(related.identity);
      if (!ids.includes(id)) ids.push(id);
    }
    return ids.length ? ids.join(' ') : null;
  }
  const accessible: NativeAccessibleExtension = {
    objectRef: options.identity,
    part(family, declaration) {
      setup('accessible.part');
      if (__nativeFeature('part-relationships')) {
        if (!family?.roles || !declaration || typeof declaration.key !== 'string' && !(declaration.key && typeof declaration.key.get === 'function')) throw new TypeError('[A11y] part requires an Anatomy family and string or State key.');
        relationshipOwner().part(family, declaration.key);
      }
    },
    id(value) { setup('accessible.id'); explicitId = value; watchAccessible('id', value); const current = readValue(value); if (typeof current === 'string' && current) hostIds.set(options.identity, current); },
    name(value) { setup('accessible.name'); accessibleName = value; watchAccessible('name', value); },
    description(value) { setup('accessible.description'); accessibleDescription = value; watchAccessible('description', value); },
    relation(kind, spec) {
      setup('accessible.relation');
      if (!Object.hasOwn(relationAttributes, kind)) throw new Error('[A11y] invalid relationship kind.');
      const mode = String(spec.mode ?? 'replace');
      if (mode !== 'replace' && mode !== 'append') throw new Error('[A11y] relation mode must be replace or append.');
      if (__nativeFeature('part-relationships')) {
        const target = spec.target;
        if (target && typeof target === 'object' && 'kind' in target && target.kind === 'part') {
          const part = target as NativePartTarget;
          if (!part.family?.roles || typeof part.role !== 'string' || typeof part.key !== 'string' && !(part.key && typeof part.key.get === 'function')) throw new TypeError('[A11y] invalid structured part target.');
          accessibleSubscriptions.get('relation:' + kind)?.(); accessibleSubscriptions.delete('relation:' + kind);
          relations.delete(kind);
          relationshipOwner().relation(kind, part, relationAttributes[kind]);
          return;
        }
      }
      if (__nativeFeature('part-relationships')) partRelationships?.removeRelation(kind);
      relations.set(kind, { ...spec, mode }); watchAccessible('relation:' + kind, spec.target);
    },
    tree(config) { setup('accessible.tree'); accessibleTree = { ...accessibleTree, ...config }; for (const key of Object.keys(config)) watchAccessible('tree:' + key, config[key]); },
    level(value) { setup('accessible.level'); const current = readValue(value); if (typeof current !== 'number' || !Number.isInteger(current) || current < 1 || current > 6) throw new Error('[A11y] heading level must be an integer in range 1-6.'); accessibleLevel = value; watchAccessible('level', value); },
  };
  function tableCell<T extends string | number>(name: string, initial: T): NativeStateCell<T> {
    const handle = owned(name, initial);
    return { handle, set(value: T) { writeOwned(handle, value, 'table.structure'); } };
  }
  let tableState: { a11yRole: NativeStateCell<string>; rowCount: NativeStateCell<number>; columnCount: NativeStateCell<number>; row: NativeStateCell<number>; column: NativeStateCell<number>; rowSpan: NativeStateCell<number>; columnSpan: NativeStateCell<number> };
  let table: NativeTableRecord | null = null, tableComputing = false;
  let tableSignature: { logical: boolean; entries: { owner: Owner; config: NativeConfig; role: string }[] } | null = null;
  function clearTable() {
    if (!tableState) return;
    tableState.a11yRole.set(''); tableState.row.set(0); tableState.column.set(0); tableState.rowSpan.set(0); tableState.columnSpan.set(0);
    if (table?.role === 'root') { tableState.rowCount.set(0); tableState.columnCount.set(0); }
    relations.set('labelledBy', { target: [] });
  }
  function applyTable(role: string, row?: number, cell?: NativeTableCell, snapshot?: NativeTableSnapshot) {
    tableState.a11yRole.set(role);
    if (snapshot) { tableState.rowCount.set(snapshot.valid ? snapshot.rowCount : 0); tableState.columnCount.set(snapshot.valid ? snapshot.columnCount : 0); relations.set('labelledBy', { target: snapshot.valid && snapshot.caption ? [snapshot.caption] : [] }); }
    if (row !== undefined) tableState.row.set(row + 1);
    if (cell) { tableState.row.set(cell.row + 1); tableState.column.set(cell.column + 1); tableState.rowSpan.set(cell.rowSpan); tableState.columnSpan.set(cell.columnSpan); relations.set('labelledBy', { target: cell.orderedHeaders.length ? [...cell.orderedHeaders, cell.ref] : [] }); }
  }
  function refreshTable(logical: boolean) {
    if (!table || tableComputing || !table.family) return;
    const family = table.family, domainOwner = ancestor(owner, candidate => candidate.claims.get(family)?.role === 'root');
    if (!domainOwner) { if (tableSignature) { tableSignature = null; clearTable(); } return; }
    const rootTable = tableRecords.get(domainOwner);
    if (!rootTable || rootTable.role !== 'root' || rootTable.family !== family) { if (tableSignature) { tableSignature = null; clearTable(); } return; }
    if (domainOwner !== owner) { rootTable.refresh(logical); return; }
    if (!logical && !ready()) return;
    const entries = [...owners.values()].filter(candidate => {
      const record = tableRecords.get(candidate);
      return candidate.alive() && record?.family === family && (logical || record.ready()) && candidate.claims.has(family)
        && ancestor(candidate, current => current.claims.get(family)?.role === 'root') === owner;
    }).sort(hostOrder).map(candidate => ({ owner: candidate, config: tableRecords.get(candidate)!.config, role: candidate.claims.get(family)!.role }));
    if (tableSignature?.logical === logical && entries.length === tableSignature.entries.length && entries.every((entry, index) => {
      const previous = tableSignature!.entries[index]; return entry.owner === previous.owner && entry.config === previous.config && entry.role === previous.role;
    })) return;
    tableSignature = { logical, entries }; tableComputing = true;
    try {
      const mismatches = entries.filter(entry => entry.role !== tableRecords.get(entry.owner)!.role), records = entries.filter(entry => entry.role === tableRecords.get(entry.owner)!.role);
      const captions = records.filter(entry => entry.role === 'caption'), rowRecords = records.filter(entry => entry.role === 'row');
      const rowIndex = new Map(rowRecords.map((entry, index) => [entry.owner, index]));
      const rows = rowRecords.map(entry => ({ ref: entry.owner.identity, cells: [] as NativeTableCellInput[] }));
      const unmatchedCells: object[] = [];
      for (const entry of records) if (entry.role === 'cell' || entry.role === 'headerCell') {
        const rowOwner = ancestor(entry.owner, candidate => candidate !== entry.owner && candidate.claims.get(family)?.role === 'row'), index = rowOwner ? rowIndex.get(rowOwner) : undefined;
        if (index === undefined) { unmatchedCells.push(entry.owner.identity); continue; }
        const config = entry.config;
        rows[index].cells.push({ ref: entry.owner.identity, kind: entry.role, headerKey: config.headerKey as string | undefined, headerKind: config.headerKind,
          headers: config.headers as readonly string[] ?? [], rowSpan: config.rowSpan as number | undefined, columnSpan: config.columnSpan as number | undefined });
      }
      const snapshot = projectNativeTable({ root: options.identity, captions: captions.map(entry => entry.owner.identity), rows, unmatchedCells, roleMismatches: mismatches.map(entry => entry.owner.identity) });
      for (const entry of entries) tableRecords.get(entry.owner)!.clear();
      table.snapshot = snapshot; applyTable(snapshot.valid ? 'table' : '', undefined, undefined, snapshot);
      if (!snapshot.valid) return;
      const byRef = new Map(records.map(entry => [entry.owner.identity, tableRecords.get(entry.owner)!]));
      if (snapshot.caption) byRef.get(snapshot.caption)?.apply('caption');
      for (const row of snapshot.rows) { byRef.get(row.ref)?.apply('row', row.index); for (const cell of row.cells) byRef.get(cell.ref)?.apply(cell.kind === 'cell' ? 'cell' : cell.kind === 'column-header' ? 'columnheader' : 'rowheader', undefined, cell); }
    } finally { tableComputing = false; }
  }
  function declareTable(role: string): NativeTableStructure {
    if (!['root','caption','row','headerCell','cell'].includes(role)) throw new Error('[TableStructure] invalid part role.');
    if (table && table.role !== role) throw new Error('[TableStructure] part role already declared as ' + table.role + '; received ' + role + '.');
    if (!options.tableFamily) throw new Error('[TableStructure] exact TABLE_STRUCTURE_FAMILY static identity is required.');
    if (!table) {
      tableState = { a11yRole: tableCell('tableA11yRole', '' as string), rowCount: tableCell('tableRowCount', 0 as number), columnCount: tableCell('tableColumnCount', 0 as number), row: tableCell('tableRow', -1 as number), column: tableCell('tableColumn', -1 as number), rowSpan: tableCell('tableRowSpan', 0 as number), columnSpan: tableCell('tableColumnSpan', 0 as number) };
      table = { role, family: options.tableFamily, config: {}, snapshot: null, ready, refresh: refreshTable, clear: clearTable, apply: applyTable }; tableRecords.set(owner, table);
    }
    return Object.freeze({ role, states: Object.freeze({ a11yRole: tableState.a11yRole.handle, rowCount: tableState.rowCount.handle, columnCount: tableState.columnCount.handle, row: tableState.row.handle, column: tableState.column.handle, rowSpan: tableState.rowSpan.handle, columnSpan: tableState.columnSpan.handle }),
      configure(patch: NativeConfig) { alive(); table!.config = Object.freeze({ ...table!.config, ...patch, ...(patch.headers ? { headers: Object.freeze([...(patch.headers as readonly string[])]) } : {}) }); refreshTable(false); },
      getObjectRef() { alive(); return options.identity; }, getSnapshot() { alive(); return table!.snapshot; } });
  }
  const textDeclaration = options.declarations.find(declaration => declaration.id === 'text-control' || declaration.id === '@proto.ui/text-control/declaration');
  const imageDeclaration = options.declarations.find(declaration => declaration.id === 'image-view' || declaration.id === '@proto.ui/image-view/declaration');
  const nativeLinkDeclaration = options.declarations.find(declaration => declaration.id === '@proto.ui/native-link/declaration');
  if (__nativeFeature('text') && __nativeFeature('image') && textDeclaration && imageDeclaration) throw new Error('[Modules] one physical Root cannot be both a text control and an image.');
  if (__nativeFeature('native-link') && nativeLinkDeclaration && (__nativeFeature('text') && textDeclaration || __nativeFeature('image') && imageDeclaration)) throw new Error('[NativeLink] one physical Root cannot combine native navigation with text or image control.');
  if (__nativeFeature('text') && textDeclaration && (textDeclaration.config.content !== 'plain-text' || textDeclaration.config.engine !== 'host' || !['single','multiline'].includes(String(textDeclaration.config.lineMode))))
    throw new Error('[TextControl] unsupported physical declaration.');
  const textListeners = new Map<string, Set<(run: Run, event: NativeTextEvent) => void>>();
  let nativeLinkDeclared = false;
  let nativeLinkConfig: NativeLinkSnapshot = Object.freeze({ href: '', target: '', rel: '', disabled: false });
  const nativeLinkListeners = new Set<(run: Run, event: NativeLinkEvent) => void>();
  const nativeLinkTasks = new Set<ReturnType<typeof setTimeout>>();
  function normalizeNativeLink(config: NativeConfig): NativeLinkSnapshot {
    let href = typeof config.href === 'string' ? config.href.trim() : '';
    if (/[\u0000-\u001f\u007f]/.test(href)) href = '';
    const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href)?.[1].toLowerCase();
    if (scheme && !['http', 'https', 'mailto', 'tel', 'sms', 'ftp', 'ftps'].includes(scheme)) href = '';
    let target = typeof config.target === 'string' ? config.target : '';
    if (/[\u0000-\u0020\u007f<>]/.test(target)) target = '';
    const rel = (typeof config.rel === 'string' ? config.rel : '').split(/\s+/).filter(Boolean);
    if (target.toLowerCase() === '_blank' && !rel.some(token => token.toLowerCase() === 'noopener')) rel.push('noopener');
    return Object.freeze({ href, target, rel: rel.join(' '), disabled: config.disabled === true });
  }
  const nativeLink: NativeLink<Run> = {
    sync(config) {
      runtime('nativeLink.sync');
      const next = normalizeNativeLink(config);
      if (next.href !== nativeLinkConfig.href || next.target !== nativeLinkConfig.target || next.rel !== nativeLinkConfig.rel || next.disabled !== nativeLinkConfig.disabled) nativeLinkConfig = next;
      projectModuleAttributes(); requestPresentation();
    },
    snapshot() { alive(); return nativeLinkDeclared ? nativeLinkConfig : null; },
    on(type, callback) {
      setup('nativeLink.on');
      if (type !== 'navigate') throw new Error('[NativeLink] only navigate observations are supported.');
      nativeLinkListeners.add(callback);
      return () => { setup('nativeLink.off'); nativeLinkListeners.delete(callback); };
    },
  };
  function attachNativeLink() {
    if (!nativeLinkDeclared || !root) return;
    const anchor = root, epoch = generation;
    if (anchor.localName !== 'a') throw new Error('[NativeLink] renderer did not bind the required anchor Root.');
    const current = () => epoch === generation && root === anchor && targets.get(anchor) === owner && ready();
    const activate = (native: Event) => {
      const event = native as MouseEvent;
      if (!current()) return;
      const nearest = event.composedPath().find(node => (node as Element)?.localName === 'a');
      if (nearest && nearest !== anchor) return;
      if (nativeLinkConfig.disabled || !nativeLinkConfig.href) { event.preventDefault(); return; }
      if (event.defaultPrevented || (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return;
      const config = nativeLinkConfig;
      const observation = Object.freeze({ href: config.href, target: config.target, rel: config.rel, modified: event.button === 1 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey });
      const task = setTimeout(() => {
        nativeLinkTasks.delete(task);
        if (!current() || event.defaultPrevented || nativeLinkConfig !== config) return;
        options.invoke(() => {
          for (const listener of [...nativeLinkListeners]) {
            if (!current()) break;
            if (nativeLinkListeners.has(listener)) listener(options.getRun(), observation);
          }
        });
      }, 0);
      nativeLinkTasks.add(task);
    };
    listen(anchor, 'click', activate);
    listen(anchor, 'auxclick', activate);
  }
  let textDeclared = false, textInitialized = false, textValue = '', textComposing = false, textMode = 'uncontrolled';
  let textEventGeneration = 0;
  let textLeaseEpoch = 0;
  const textCleanups: (() => void)[] = [];
  let textCallbackPrelude: { epoch: number } | null = null;
  let textPatch: NativeConfig = {};
  const canonicalText = (value: string) => { const normalized = value.replace(/\r\n?/g, '\n'); return textDeclaration?.config.lineMode === 'single' ? normalized.replace(/\n/g, '') : normalized; };
  function restoreTextValue(target: HTMLInputElement | HTMLTextAreaElement, initialize = false) {
    if ((!initialize && target.value === textValue) || textComposing || textCallbackPrelude?.epoch === generation) return;
    const start = target.selectionStart, end = target.selectionEnd, direction = target.selectionDirection;
    const top = target.scrollTop, left = target.scrollLeft;
    target.value = textValue;
    if (start !== null && end !== null) target.setSelectionRange(Math.min(start, textValue.length), Math.min(end, textValue.length), direction ?? 'none');
    target.scrollTop = top; target.scrollLeft = left;
  }
  function applyText(initialize = false) {
    if (!ready() || !textDeclared) return;
    if (root!.localName !== 'input' && root!.localName !== 'textarea') throw new Error('[TextControl] renderer did not bind the required physical Root.');
    const target = root as HTMLInputElement | HTMLTextAreaElement;
    if (target.localName === 'input' && !['text','search','tel','password'].includes((target as HTMLInputElement).type)) throw new Error('[TextControl] incompatible input sanitization.');
    for (const [key, value] of Object.entries(textPatch)) {
      if (['value','valueMode','defaultValue'].includes(key)) continue;
      if (['disabled','readOnly','required'].includes(key) && typeof value === 'boolean') { Reflect.set(target, key, value); continue; }
      if (key === 'rows' && target.localName === 'textarea' && typeof value === 'number' && Number.isFinite(value)) { Reflect.set(target, key, Math.max(1, Math.trunc(value))); continue; }
      if ((key === 'minLength' || key === 'maxLength') && typeof value === 'number' && Number.isFinite(value)) { if (value < 0) target.removeAttribute(key.toLowerCase()); else Reflect.set(target, key, Math.trunc(value)); continue; }
      if (['placeholder','name','autoComplete','inputMode','enterKeyHint','wrap'].includes(key) && typeof value === 'string') { if (value === '') target.removeAttribute(key.toLowerCase()); else target.setAttribute(key.toLowerCase(), value); }
    }
    if (typeof textPatch.defaultValue === 'string') target.defaultValue = canonicalText(textPatch.defaultValue);
    restoreTextValue(target, initialize);
  }
  const textControl: NativeTextControl<Run> = {
    on(type, callback) {
      setup('textControl.on');
      if (!['input','change','compositionstart','compositionupdate','compositionend'].includes(type)) throw new Error('[TextControl] invalid event type.');
      let listeners = textListeners.get(type); if (!listeners) { listeners = new Set(); textListeners.set(type, listeners); }
      listeners.add(callback); return () => { setup('textControl.off'); listeners!.delete(callback); };
    },
    sync(patch) {
      runtime('textControl.sync');
      if (textDeclaration?.config.lineMode === 'single' && (patch.rows !== undefined || patch.wrap !== undefined)) throw new Error('[TextControl] rows/wrap require multiline declaration.');
      if (!textInitialized) { textMode = String(patch.valueMode ?? 'uncontrolled'); if (!['controlled','uncontrolled'].includes(textMode)) throw new Error('[TextControl] invalid value mode.'); textValue = canonicalText(String(textMode === 'controlled' ? patch.value ?? '' : patch.defaultValue ?? '')); textInitialized = true; }
      textPatch = { ...textPatch, ...patch, valueMode: textMode,
        value: typeof patch.value === 'string' ? canonicalText(patch.value) : textPatch.value,
        defaultValue: typeof patch.defaultValue === 'string' ? canonicalText(patch.defaultValue) : textPatch.defaultValue };
      if (textMode === 'controlled') textValue = String(textPatch.value ?? '');
      applyText(); requestPresentation();
    },
    resetValue(value) {
      runtime('textControl.resetValue');
      if (!textDeclared || !textInitialized || !ready() || !(options.isReady?.() ?? true)) return false;
      if (value !== undefined && typeof value !== 'string') return false;
      const controlled = textMode === 'controlled';
      const next = controlled ? textValue : canonicalText(value ?? String(textPatch.defaultValue ?? ''));
      // Retire old composition, callbacks and queued restoration before rebinding.
      ++textEventGeneration; textCallbackPrelude = null; textValue = next; textComposing = false;
      attachText();
      return !controlled;
    },
    snapshot() { alive(); return textDeclared ? Object.freeze({ value: textValue, composing: textComposing }) : null; },
  };
  function detachText() {
    ++textLeaseEpoch;
    for (const cleanup of textCleanups.splice(0)) cleanup();
  }
  function attachText() {
    detachText();
    if (!textDeclared || !ready()) return;
    // Establish native value ownership even for an initially empty control.
    // Framework defaultValue reconciliation must not become a second value writer.
    applyText(true);
    const target = root as HTMLInputElement | HTMLTextAreaElement, epoch = generation, leaseEpoch = textLeaseEpoch;
    for (const type of ['input','change','compositionstart','compositionupdate','compositionend']) textCleanups.push(listen(target, type, native => {
      const editing = native as InputEvent;
      const eventGeneration = ++textEventGeneration;
      if (type === 'compositionstart' || type === 'input' && editing.isComposing) textComposing = true;
      if (type === 'compositionend') textComposing = false;
      const value = canonicalText(target.value);
      if (textMode === 'uncontrolled' && (type === 'input' || type === 'change')) textValue = value;
      const event = Object.freeze({ type, value, composing: textComposing, data: typeof editing.data === 'string' ? canonicalText(editing.data) : null, inputType: type === 'input' && typeof editing.inputType === 'string' ? editing.inputType : null });
      const current = () => epoch === generation && leaseEpoch === textLeaseEpoch && eventGeneration === textEventGeneration && ready() && (options.isReady?.() ?? true);
      const inCurrentCallback = (callback: () => void) => {
        const previous = textCallbackPrelude, prelude = { epoch };
        // A callback boundary can reconcile pending owner Props before it invokes
        // the listener. Preserve the native edit candidate during that prelude.
        if (type !== 'change') textCallbackPrelude = prelude;
        const release = () => { if (textCallbackPrelude === prelude) textCallbackPrelude = previous; };
        try { options.invoke(() => { release(); if (current()) callback(); }); }
        finally { release(); }
      };
      try {
        inCurrentCallback(() => {
          for (const callback of [...textListeners.get(type) ?? []]) {
            if (!current()) break;
            if (textListeners.get(type)?.has(callback)) callback(options.getRun(), event);
          }
        });
        if (textMode === 'controlled' && (type === 'compositionend' || (type === 'input' || type === 'change') && !event.composing)) queueMicrotask(() => {
          if (current()) inCurrentCallback(() => applyText());
        });
      } finally {
        // A nested newer event or a replaced physical lease owns its own facts.
        if (epoch === generation && leaseEpoch === textLeaseEpoch && eventGeneration === textEventGeneration) textComposing = event.composing;
      }
    }));
  }
  const imageListeners = new Set<(run: Run, event: NativeImageEvent) => void>();
  let imageDeclared = false, imageFit = String(imageDeclaration?.config.fit ?? 'contain'), imageGeneration = 0;
  let imagePatch: NativeConfig = imageDeclaration?.config ?? {};
  let imageDiagnostic = '', lastHostedImageGeneration: number | null = null;
  type ImageRequest = { target: HTMLImageElement; request: number; attachment: number; terminal: boolean };
  let imageRequest: ImageRequest | null = null;
  function validatedImageSource(): string {
    const source = String(imagePatch.source ?? '');
    if (!source) { imageDiagnostic = ''; return ''; }
    const hasAlternative = String(imagePatch.alternativeText ?? '').trim().length > 0;
    if (imagePatch.a11yMode === 'informative' && hasAlternative || imagePatch.a11yMode === 'decorative' && !hasAlternative) { imageDiagnostic = ''; return source; }
    const diagnostic = JSON.stringify([source, imagePatch.a11yMode, imagePatch.alternativeText]);
    if (diagnostic !== imageDiagnostic) { imageDiagnostic = diagnostic; console.warn('[ImageView] contradictory or missing accessibility input; source failed closed to idle.'); }
    return '';
  }
  let imageSource = validatedImageSource(), imageStatus = imageSource ? 'loading' : 'idle';
  function imageTransition(status: string) {
    if (imageStatus === status) return;
    const previousStatus = imageStatus; imageStatus = status;
    const event = Object.freeze({ status, previousStatus, source: imageSource }), epoch = generation, request = imageGeneration;
    for (const callback of [...imageListeners]) {
      if (disposed || !options.isAlive() || epoch !== generation || request !== imageGeneration) break;
      if (imageListeners.has(callback)) options.invoke(() => callback(options.getRun(), event));
    }
  }
  function completeImage(current: ImageRequest, status: string) {
    if (imageRequest !== current || current.terminal || !ready() || !(options.isReady?.() ?? true) || current.request !== imageGeneration || current.attachment !== generation || root !== current.target || imageStatus !== 'loading' || !imageSource) return;
    current.terminal = true;
    imageTransition(status);
  }
  function applyImage() {
    if (!ready() || !imageDeclared) return;
    if (root!.localName !== 'img') throw new Error('[ImageView] renderer did not bind the required img Root.');
    const target = root as HTMLImageElement;
    target.alt = imagePatch.a11yMode === 'decorative' ? '' : String(imagePatch.alternativeText ?? '');
    styleProperty(target, 'object-fit', imageFit);
    if (!imageSource) { imageRequest = null; target.removeAttribute('src'); return; }
    if (imageRequest && imageRequest.target === target && imageRequest.request === imageGeneration && imageRequest.attachment === generation) return;
    imageRequest = null;
    if (target.getAttribute('src') !== imageSource) { target.removeAttribute('src'); target.src = imageSource; }
    if (imageStatus !== 'loading') return;
    const current: ImageRequest = { target, request: imageGeneration, attachment: generation, terminal: false };
    imageRequest = current; lastHostedImageGeneration = imageGeneration;
    if (target.complete && target.naturalWidth > 0) { completeImage(current, 'loaded'); return; }
    if (typeof target.decode !== 'function') throw new Error('[ImageView] the concrete browser must support request-bound image.decode().');
    void target.decode().then(() => completeImage(current, 'loaded'), () => completeImage(current, 'error'));
  }
  function attachImage() {
    if (!ready() || !imageDeclared) return;
    if (root!.localName !== 'img') throw new Error('[ImageView] renderer did not bind the required img Root.');
    for (const name of ['load', 'error']) listen(root!, name, event => event.stopPropagation());
    if (imageSource && lastHostedImageGeneration === imageGeneration) { ++imageGeneration; imageTransition('loading'); }
    lastHostedImageGeneration = imageGeneration;
    applyImage();
  }
  const imageView: NativeImageView<Run> = {
    on(type, callback) { setup('imageView.on'); if (type !== 'loadingStatusChange') throw new Error('[ImageView] invalid event type.'); const registration = (run: Run, event: NativeImageEvent) => callback(run, event); imageListeners.add(registration); return () => { setup('imageView.off'); imageListeners.delete(registration); }; },
    sync(patch) {
      runtime('imageView.sync');
      const previousSource = imageSource;
      if (patch.fit !== undefined && !['contain','cover','fill'].includes(String(patch.fit))) throw new Error('[ImageView] invalid fit.');
      if (patch.a11yMode !== undefined && !['informative','decorative'].includes(String(patch.a11yMode))) throw new Error('[ImageView] invalid accessibility mode.');
      imagePatch = {
        source: typeof patch.source === 'string' ? patch.source : imagePatch.source,
        alternativeText: typeof patch.alternativeText === 'string' ? patch.alternativeText : imagePatch.alternativeText,
        a11yMode: patch.a11yMode ?? imagePatch.a11yMode, fit: patch.fit ?? imagePatch.fit,
      };
      imageSource = validatedImageSource(); imageFit = String(imagePatch.fit ?? 'contain');
      if (imageSource !== previousSource) { imageRequest = null; ++imageGeneration; imageTransition(imageSource ? 'loading' : 'idle'); }
      applyImage(); requestPresentation();
    },
    snapshot() { alive(); return imageDeclared ? Object.freeze({ source: imageSource, loadingStatus: imageStatus, fit: imageFit }) : null; },
  };
  const scrollAxes = observed<string>('vertical'), scrollProjection = observed<string>('unresolved'), scrolling = observed<boolean>(false);
  const followState = observed<string>('off'), followRequest = observed<string>('idle');
  let scrollRequestStatusVersion = 0;
  function setScrollRequestStatus(next: string) {
    ++scrollRequestStatusVersion;
    followRequest.set(next);
  }
  function axisFacts(): { handle: NativeScrollAxis; update(position: number, viewport: number, extent: number, current: () => boolean): void } {
    const position = observed<number>(0), ratio = observed<number>(1), before = observed<boolean>(false), after = observed<boolean>(false), end = observed<boolean>(true);
    return { handle: { position: position.handle, visibleRatio: ratio.handle, canScrollBefore: before.handle, canScrollAfter: after.handle, atEnd: end.handle },
      update(offsetValue, viewport, extent, current) {
        const range = Math.max(0, extent - viewport), clamped = Math.min(range, Math.max(0, offsetValue));
        position.set(range > 0 ? clamped / range : 0); if (!current()) return;
        ratio.set(extent > 0 ? Math.max(0, Math.min(1, viewport / extent)) : 1); if (!current()) return;
        before.set(clamped > 0); if (!current()) return;
        after.set(clamped < range); if (!current()) return;
        end.set(range - clamped <= 1);
      },
    };
  }
  const horizontal = axisFacts(), vertical = axisFacts();
  let scrollConfig: NativeConfig = { axes: 'vertical', projection: 'auto', endFollow: { mode: 'off' } };
  let scrollChrome: NativeConfig | null = null, readerContacts = 0, scrollTimer: number | undefined;
  type ScrollBinding = { surface: HTMLElement; epoch: number };
  type ScrollEndWork = { binding: ScrollBinding; axis: 'horizontal' | 'vertical'; frame: number | null };
  let scrollBinding: ScrollBinding | null = null;
  let scrollAttachment: { binding: ScrollBinding; requests: NativeConfig[] } | null = null;
  let scrollEndWork: ScrollEndWork | null = null;
  let readerIntent = 0, readerArrivalUntil = 0;
  const readerPoints = new Map<number, { x: number; y: number }>(), readerArrivals = new Set<number>();
  let explicitlyPaused = false, scrollCommandVersion = 0;
  let lastScrollGeometry: { left: number; top: number; width: number; height: number; scrollWidth: number; scrollHeight: number } | null = null;
  const chromeCleanups: (() => void)[] = [];
  const chromeTargets = new Map<HTMLElement, { width: string; height: string; transform: string; display: string; size: string; offset: string }>();
  function currentScrollBinding(binding: ScrollBinding): boolean {
    return scrollBinding === binding && generation === binding.epoch && root === binding.surface && ready();
  }
  function scrollFacts(resumeEndAxis?: 'horizontal' | 'vertical', version = scrollCommandVersion, readerArrival: false | 'observed' | 'command' = false) {
    const binding = scrollBinding;
    if (!binding || !currentScrollBinding(binding)) return;
    const current = () => currentScrollBinding(binding) && scrollCommandVersion === version, surface = binding.surface;
    const left = surface.scrollLeft, width = surface.clientWidth, scrollWidth = surface.scrollWidth;
    const top = surface.scrollTop, height = surface.clientHeight, scrollHeight = surface.scrollHeight;
    if (!current()) return;
    const follow = scrollConfig.endFollow as NativeConfig;
    const followAxis = follow?.axis === 'horizontal' ? 'horizontal' : 'vertical';
    const previous = lastScrollGeometry;
    const moved = previous && (followAxis === 'horizontal' ? left !== previous.left && width === previous.width && scrollWidth === previous.scrollWidth : top !== previous.top && height === previous.height && scrollHeight === previous.scrollHeight);
    const arrivedAtEnd = followAxis === 'horizontal' ? Math.max(0, scrollWidth - width) - left <= 1 : Math.max(0, scrollHeight - height) - top <= 1;
    lastScrollGeometry = { left, top, width, height, scrollWidth, scrollHeight };
    if (readerArrival && moved && arrivedAtEnd && (readerArrival === 'command' || readerArrivals.size > 0 || Date.now() < readerArrivalUntil)) explicitlyPaused = false;
    horizontal.update(left, width, scrollWidth, current); if (!current()) return;
    vertical.update(top, height, scrollHeight, current); if (!current()) return;
    if (follow?.mode === 'while-at-end') {
      const atEnd = (followAxis === 'horizontal' ? horizontal.handle : vertical.handle).atEnd.get();
      if (resumeEndAxis === followAxis && atEnd) { explicitlyPaused = false; followState.set('following'); }
      else if (explicitlyPaused) followState.set('paused');
      else if (readerContacts || !atEnd && Date.now() < readerIntent) followState.set('paused');
      else if (atEnd) followState.set('following');
    }
    if (current()) projectChrome();
  }
  function cancelScrollEnd(binding: ScrollBinding, axis: 'horizontal' | 'vertical') {
    const work = scrollEndWork;
    if (!work || work.binding !== binding || work.axis !== axis) return;
    scrollEndWork = null;
    if (work.frame !== null) binding.surface.ownerDocument.defaultView?.cancelAnimationFrame(work.frame);
    if (currentScrollBinding(binding)) setScrollRequestStatus('rejected');
  }
  function revealScroll(request: NativeConfig, binding: ScrollBinding): NativeScrollRequestOutcome {
    let version = scrollCommandVersion;
    const rejected = { kind: 'rejected', reason: 'unavailable' } as const;
    if (request.axis !== 'vertical' || scrollConfig.axes === 'horizontal' || scrollAttachment) return rejected;
    const family = request.family as NativeAnatomyFamily, part = request.part as NativeAnatomyPart;
    const participant = part && typeof part === 'object' ? parts.get(part) : undefined;
    const role = claims.get(family)?.role, familyRoot = role ? domain(family, false) : null;
    if (!participant || participant === owner || !role || !familyRoot) return rejected;
    const currentPart = () => currentScrollBinding(binding) && scrollCommandVersion === version && !scrollAttachment &&
      claims.get(family)?.role === role && domain(family, false) === familyRoot &&
      participant.alive() && participant.claims.get(family)?.part === part &&
      ancestor(participant, candidate => candidate.claims.get(family)?.role === 'root') === familyRoot &&
      ancestor(participant, candidate => candidate !== participant && candidate.claims.get(family)?.role === role) === owner;
    if (!currentPart()) return rejected;
    const target = participant.target();
    if (!target) return rejected;
    const currentTarget = () => currentPart() && participant.target() === target && targets.get(target) === participant && currentPart();
    if (!revealNativeScrollTarget(binding.surface, target, currentTarget, () => {
      // Advance intent only after geometry admission. A refused nested reveal
      // must not retire a valid command already in progress.
      version = ++scrollCommandVersion;
      cancelScrollEnd(binding, 'vertical');
    }) || !currentTarget()) return rejected;
    scrollFacts();
    if (!currentTarget()) return rejected;
    const follow = scrollConfig.endFollow as NativeConfig;
    if (follow?.mode === 'while-at-end' && (follow.axis ?? 'vertical') === 'vertical' && !explicitlyPaused) followState.set(vertical.handle.atEnd.get() ? 'following' : 'paused');
    return currentTarget() ? { kind: 'dispatched' } : rejected;
  }
  function applyScroll(request: NativeConfig, draining = false, readerRequest = false): NativeScrollRequestOutcome {
    if (!hooks.has('asScrollSurface')) return {kind:'rejected',reason:'not-declared'};
    if (!root) return {kind:'rejected',reason:'not-mounted'};
    const surface = root, epoch = generation;
    const currentView = () => epoch === generation && root === surface && ready();
    if (!currentView()) return {kind:'rejected',reason:'unavailable'};
    if (request.axis !== 'horizontal' && request.axis !== 'vertical') throw new Error('[Scroll] request axis must be horizontal or vertical.');
    const binding = scrollBinding;
    if (request.kind === 'reveal') {
      if (!binding || !currentScrollBinding(binding) || scrollAttachment) return {kind:'rejected',reason:'unavailable'};
      return revealScroll(request, binding);
    }
    if (!['by', 'to', 'control-drag', 'page', 'to-end'].includes(String(request.kind))) throw new Error('[Scroll] invalid request kind.');
    const attachment = scrollAttachment;
    if (!draining && attachment && attachment.binding.surface === surface && attachment.binding.epoch === epoch) {
      const queued = { ...request };
      if (!currentView() || scrollAttachment !== attachment) return {kind:'rejected',reason:'unavailable'};
      attachment.requests.push(queued);
      return {kind:'queued'};
    }
    if (!binding || !currentScrollBinding(binding)) return {kind:'rejected',reason:'unavailable'};
    const version = ++scrollCommandVersion;
    const horizontalAxis = request.axis === 'horizontal';
    const viewport = horizontalAxis ? surface.clientWidth : surface.clientHeight, extent = horizontalAxis ? surface.scrollWidth : surface.scrollHeight;
    const current = horizontalAxis ? surface.scrollLeft : surface.scrollTop, range = Math.max(0, extent - viewport);
    let next: number;
    if (request.kind === 'by') next = current + Number(request.delta);
    else if (request.kind === 'to' || request.kind === 'control-drag') next = Math.max(0, Math.min(1, Number(request.position))) * range;
    else if (request.kind === 'page') next = current + (request.direction === 'before' ? -viewport : viewport);
    else if (request.kind === 'to-end') next = range;
    else throw new Error('[Scroll] invalid request kind.');
    if (!Number.isFinite(next)) throw new Error('[Scroll] request coordinate must be finite.');
    if (!currentView()) return {kind:'rejected',reason:'unavailable'};
    const statusVersion = scrollRequestStatusVersion;
    if (horizontalAxis) surface.scrollLeft = Math.max(0, Math.min(range, next)); else surface.scrollTop = Math.max(0, Math.min(range, next));
    if (!currentView()) return {kind:'rejected',reason:'unavailable'};
    // A composed control delivers the reader's movement synchronously. Its
    // later native scroll event may have no remaining delta to attribute.
    const follow = scrollConfig.endFollow as NativeConfig;
    scrollFacts(request.kind === 'to-end' ? horizontalAxis ? 'horizontal' : 'vertical' : undefined, version, readerRequest && request.axis === (follow?.axis ?? 'vertical') ? 'command' : false);
    if (!currentView()) return {kind:'rejected',reason:'unavailable'};
    if (request.kind === 'to-end' && statusVersion === scrollRequestStatusVersion) setScrollRequestStatus('applied');
    return {kind:'dispatched'};
  }
  function pauseScrollFollowing(draining = false): NativeScrollRequestOutcome {
    if (!hooks.has('asScrollSurface')) return {kind:'rejected',reason:'not-declared'};
    if (!root) return {kind:'rejected',reason:'not-mounted'};
    const follow = scrollConfig.endFollow as NativeConfig;
    const axis = follow?.axis === 'horizontal' ? 'horizontal' : 'vertical';
    if (!ready() || follow?.mode !== 'while-at-end' || scrollConfig.axes !== 'both' && scrollConfig.axes !== axis) return {kind:'rejected',reason:'unavailable'};
    const attachment = scrollAttachment;
    if (!draining && attachment && attachment.binding.surface === root && attachment.binding.epoch === generation) {
      attachment.requests.push({kind:'pause-following'});
      return {kind:'queued'};
    }
    const binding = scrollBinding;
    if (!binding || !currentScrollBinding(binding)) return {kind:'rejected',reason:'unavailable'};
    const version = ++scrollCommandVersion;
    explicitlyPaused = true;
    readerIntent = 0; readerArrivalUntil = 0; readerArrivals.clear();
    cancelScrollEnd(binding, axis);
    if (!currentScrollBinding(binding)) return {kind:'rejected',reason:'unavailable'};
    // A subscriber may issue a newer command while cancellation is published.
    if (scrollCommandVersion !== version) return {kind:'dispatched'};
    followState.set('paused');
    if (!currentScrollBinding(binding)) return {kind:'rejected',reason:'unavailable'};
    if (scrollCommandVersion === version) scrollFacts();
    return currentScrollBinding(binding) ? {kind:'dispatched'} : {kind:'rejected',reason:'unavailable'};
  }
  function endFollowContentChanged() {
    const binding = scrollBinding;
    if (!binding || !currentScrollBinding(binding) || scrollAttachment) return;
    const follow = scrollConfig.endFollow as NativeConfig;
    if (follow?.mode !== 'while-at-end' || explicitlyPaused || followState.handle.get() !== 'following' || readerContacts || Date.now() < readerIntent) { scrollFacts(); return; }
    const view = binding.surface.ownerDocument.defaultView;
    if (!view || scrollEndWork) return;
    const axis = follow.axis === 'horizontal' ? 'horizontal' : 'vertical';
    const work: ScrollEndWork = { binding, axis, frame: null };
    scrollEndWork = work;
    setScrollRequestStatus('pending');
    if (scrollEndWork !== work || !currentScrollBinding(binding)) return;
    work.frame = view.requestAnimationFrame(() => {
      if (scrollEndWork !== work) return;
      scrollEndWork = null;
      if (!currentScrollBinding(binding)) return;
      if (readerContacts || Date.now() < readerIntent || followState.handle.get() !== 'following') { setScrollRequestStatus('rejected'); return; }
      options.invoke(() => applyScroll({ kind: 'to-end', axis }));
    });
  }
  function chromeParts(): { track: HTMLElement; thumb: HTMLElement; axis: string }[] {
    if (!scrollChrome) return [];
    const family = scrollChrome.anatomy as NativeAnatomyFamily;
    if (!family || !domain(family, false)) return [];
    const thumbs = anatomyOwners(family, String(scrollChrome.thumbRole), true);
    return anatomyOwners(family, String(scrollChrome.scrollbarRole), true).flatMap(track => {
      const target = track.target(); if (!target) return [];
      const thumb = thumbs.find(candidate => descends(candidate, track));
      const thumbTarget = thumb?.target(); if (!thumbTarget) return [];
      const exposed = track.exposes()[String(scrollChrome!.orientationExpose)];
      const axis = readValue(exposed);
      if (axis !== 'horizontal' && axis !== 'vertical') throw new Error('[Scroll] composed chrome orientation expose must resolve to a portable axis.');
      return [{ track: target, thumb: thumbTarget, axis }];
    });
  }
  function projectChrome() {
    if (!ready()) return;
    for (const control of chromeParts()) {
      const { thumb, track, axis } = control;
      let baseline = chromeTargets.get(thumb);
      if (!baseline) { baseline = { width: thumb.style.width, height: thumb.style.height, transform: thumb.style.transform, display: thumb.style.display, size: thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size'), offset: thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset') }; chromeTargets.set(thumb, baseline); }
      const facts = axis === 'horizontal' ? horizontal.handle : vertical.handle;
      const length = axis === 'horizontal' ? track.clientWidth : track.clientHeight;
      const sizeValue = Math.min(length, Math.max(18, length * facts.visibleRatio.get()));
      const offsetValue = Math.max(0, length - sizeValue) * facts.position.get();
      thumb.style.setProperty('--proto-ui-scroll-thumb-size', sizeValue + 'px'); thumb.style.setProperty('--proto-ui-scroll-thumb-offset', offsetValue + 'px');
      if (axis === 'horizontal') { thumb.style.width = sizeValue + 'px'; thumb.style.transform = 'translateX(' + offsetValue + 'px)'; }
      else { thumb.style.height = sizeValue + 'px'; thumb.style.transform = 'translateY(' + offsetValue + 'px)'; }
      thumb.style.display = scrollProjection.handle.get() === 'composed' && facts.visibleRatio.get() < 1 ? baseline.display : 'none';
    }
  }
  function attachChrome() {
    for (const remove of chromeCleanups.splice(0)) remove();
    for (const control of chromeParts()) {
      const { track, thumb, axis } = control;
      let drag: { id: number; start: number; offset: number } | null = null;
      const down = (native: Event) => {
        if (!ready() || scrollProjection.handle.get() !== 'composed') return;
        const event = native as PointerEvent; if (event.button !== 0) return;
        const coordinate = axis === 'horizontal' ? event.clientX : event.clientY;
        if (event.target === thumb || thumb.contains(event.target as Node)) {
          drag = { id: event.pointerId, start: coordinate, offset: (axis === 'horizontal' ? horizontal.handle : vertical.handle).position.get() };
          readerContacts++; readerIntent = Date.now() + 250; followState.set('paused'); thumb.setPointerCapture(event.pointerId); event.preventDefault();
        } else {
          const rect = thumb.getBoundingClientRect(); const before = coordinate < (axis === 'horizontal' ? rect.left : rect.top);
          options.invoke(() => applyScroll({ kind: 'page', axis, direction: before ? 'before' : 'after' }, false, true)); event.preventDefault();
        }
      };
      const move = (native: Event) => {
        const event = native as PointerEvent; if (!drag || event.pointerId !== drag.id || !ready()) return;
        const travel = (axis === 'horizontal' ? track.clientWidth - thumb.getBoundingClientRect().width : track.clientHeight - thumb.getBoundingClientRect().height);
        if (travel <= 0) return;
        const coordinate = axis === 'horizontal' ? event.clientX : event.clientY;
        options.invoke(() => applyScroll({ kind: 'control-drag', axis, position: drag!.offset + (coordinate - drag!.start) / travel }, false, true)); event.preventDefault();
      };
      const end = (native: Event) => { const event = native as PointerEvent; if (!drag || event.pointerId !== drag.id) return; if (thumb.hasPointerCapture(drag.id)) thumb.releasePointerCapture(drag.id); drag = null; readerContacts = Math.max(0, readerContacts - 1); scrollFacts(); };
      track.addEventListener('pointerdown', down); thumb.addEventListener('pointermove', move); thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end); thumb.addEventListener('lostpointercapture', end);
      chromeCleanups.push(() => { if (drag && thumb.hasPointerCapture(drag.id)) thumb.releasePointerCapture(drag.id); drag = null; track.removeEventListener('pointerdown', down); thumb.removeEventListener('pointermove', move); thumb.removeEventListener('pointerup', end); thumb.removeEventListener('pointercancel', end); thumb.removeEventListener('lostpointercapture', end); });
    }
    projectChrome();
  }
  const scroll: NativeScroll = {
    axes: scrollAxes.handle, horizontal: horizontal.handle, vertical: vertical.handle, scrolling: scrolling.handle, projection: scrollProjection.handle, endFollow: { state: followState.handle, requestStatus: followRequest.handle },
    configure(config) { setup('scroll.configure'); if (config.axes && !['horizontal','vertical','both'].includes(String(config.axes))) throw new Error('[Scroll] invalid axes.'); if (config.projection && !['auto','system','composed'].includes(String(config.projection))) throw new Error('[Scroll] invalid projection.'); scrollConfig = { ...scrollConfig, ...config }; scrollAxes.set(String(scrollConfig.axes)); const follow = scrollConfig.endFollow as NativeConfig; followState.set(follow?.mode === 'while-at-end' ? 'pending' : 'off'); },
    bindComposedChrome(binding) { setup('scroll.bindComposedChrome'); if (!binding.anatomy || !binding.scrollbarRole || !binding.thumbRole || !binding.orientationExpose || !binding.scope) throw new Error('[Scroll] composed chrome requires explicit Context/Anatomy binding.'); scrollChrome = binding; },
    request(request) { runtime('scroll.request'); return applyScroll(request); },
    pauseFollowing() { runtime('scroll.pauseFollowing'); return pauseScrollFollowing(); },
    getSnapshot() {
      alive(); const snapshot = (axis: NativeScrollAxis) => Object.freeze({ position: axis.position.get(), visibleRatio: axis.visibleRatio.get(), canScrollBefore: axis.canScrollBefore.get(), canScrollAfter: axis.canScrollAfter.get(), atEnd: axis.atEnd.get() });
      return Object.freeze({ axes: scrollAxes.handle.get(), horizontal: snapshot(horizontal.handle), vertical: snapshot(vertical.handle), scrolling: scrolling.handle.get(), projection: scrollProjection.handle.get(), endFollow: { state: followState.handle.get(), requestStatus: followRequest.handle.get() } });
    },
  };
  function attachScroll() {
    if (!hooks.has('asScrollSurface') || !root) return;
    const binding: ScrollBinding = { surface: root, epoch: generation }, surface = binding.surface;
    const attachment = { binding, requests: [] as NativeConfig[] };
    scrollAttachment = attachment;
    const acquiring = () => scrollAttachment === attachment && generation === binding.epoch && root === surface && ready();
    const current = () => currentScrollBinding(binding);
    try {
      const preference = String(scrollConfig.requireProjection ?? scrollConfig.projection);
      if (preference === 'composed' && !scrollChrome) throw new Error('[Scroll] required composed projection needs authored chrome binding.');
      const projection = preference === 'composed' || preference === 'auto' && scrollChrome ? 'composed' : 'system';
      if (projection === 'composed') { styleProperty(surface, 'scrollbar-width', 'none'); styleProperty(surface, '-ms-overflow-style', 'none'); }
      styleProperty(surface, 'overflow-x', scrollConfig.axes === 'vertical' ? 'hidden' : 'auto'); styleProperty(surface, 'overflow-y', scrollConfig.axes === 'horizontal' ? 'hidden' : 'auto');
      if (!acquiring()) return;
      const view = surface.ownerDocument.defaultView;
      listen(surface, 'scroll', () => {
        if (!current()) return;
        scrolling.set(true); if (!current()) return;
        scrollFacts(undefined, scrollCommandVersion, 'observed'); if (!current()) return;
        view?.clearTimeout(scrollTimer);
        scrollTimer = view?.setTimeout(() => { if (!current()) return; scrollTimer = undefined; scrolling.set(false); if (current()) scrollFacts(); }, 120);
      }, { passive: true });
      listen(surface, 'wheel', event => {
        if (!current()) return;
        const wheel = event as WheelEvent; if (wheel.defaultPrevented || wheel.ctrlKey) return;
        readerIntent = Date.now() + 250;
        const follow = scrollConfig.endFollow as NativeConfig, followDelta = follow?.axis === 'horizontal' ? wheel.deltaX || (wheel.shiftKey ? wheel.deltaY : 0) : wheel.deltaY;
        if (followDelta !== 0) readerArrivalUntil = readerIntent;
        if (scrollProjection.handle.get() === 'composed') {
          const axis = scrollConfig.axes === 'horizontal' || Math.abs(wheel.deltaX) > Math.abs(wheel.deltaY) ? 'horizontal' : 'vertical';
          const delta = axis === 'horizontal' ? wheel.deltaX || wheel.deltaY : wheel.deltaY;
          options.invoke(() => applyScroll({ kind: 'by', axis, delta: delta * (wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? surface.clientHeight : 1) }, false, true)); event.preventDefault();
        }
        if (current() && followState.handle.get() !== 'off' && !(scrollConfig.axes === 'horizontal' ? horizontal.handle : vertical.handle).atEnd.get()) followState.set('paused');
      }, { passive: false });
      listen(surface, 'pointerdown', event => { if (current()) { const pointer = event as PointerEvent; if (!readerPoints.has(pointer.pointerId)) readerContacts++; readerPoints.set(pointer.pointerId, {x:pointer.clientX,y:pointer.clientY}); readerIntent = Date.now() + 250; } });
      listen(surface.ownerDocument, 'pointermove', event => {
        if (!current()) return;
        const pointer = event as PointerEvent, previous = readerPoints.get(pointer.pointerId); if (!previous) return;
        const follow = scrollConfig.endFollow as NativeConfig;
        if (follow?.axis === 'horizontal' ? pointer.clientX !== previous.x : pointer.clientY !== previous.y) readerArrivals.add(pointer.pointerId);
        readerPoints.set(pointer.pointerId, {x:pointer.clientX,y:pointer.clientY});
      }, { capture: true });
      const endContact = (event: Event) => { if (current()) { const id = (event as PointerEvent).pointerId; if (readerPoints.delete(id)) readerContacts = Math.max(0, readerContacts - 1); readerArrivals.delete(id); readerIntent = Date.now() + 250; scrollFacts(); } };
      listen(surface.ownerDocument, 'pointerup', endContact, { capture: true }); listen(surface.ownerDocument, 'pointercancel', endContact, { capture: true });
      listen(surface, 'keydown', event => {
        if (!current()) return;
        const key = event as KeyboardEvent;
        if (key.defaultPrevented || key.ctrlKey || key.metaKey || key.altKey || isElement(key.target) && key.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
        const follow = scrollConfig.endFollow as NativeConfig;
        const keys = follow?.axis === 'horizontal' ? ['ArrowLeft','ArrowRight','Home','End'] : ['ArrowUp','ArrowDown','Home','End','PageUp','PageDown',' '];
        if (keys.includes(key.key)) { readerIntent = Date.now() + 250; readerArrivalUntil = readerIntent; }
      });
      if (typeof ResizeObserver !== 'undefined') { const resize = new ResizeObserver(() => { if (current()) endFollowContentChanged(); }); resize.observe(surface); for (const child of surface.children) resize.observe(child); cleanups.push(() => resize.disconnect()); }
      if (typeof MutationObserver !== 'undefined') { const mutation = new MutationObserver(records => {
        if (!current() || records.every(record => record.type === 'attributes' && (record.target === surface || isElement(record.target) && chromeTargets.has(record.target) && record.attributeName === 'style'))) return;
        endFollowContentChanged(); if (current()) attachChrome();
      }); mutation.observe(surface, { childList: true, subtree: true, characterData: true, attributes: true }); cleanups.push(() => mutation.disconnect()); }
      if (!acquiring()) return;
      scrollBinding = binding;
      attachChrome(); if (!acquiring()) return;
      // Publish only after host resources are acquired. Reentrant position
      // requests belong to this transaction; reveal never joins its queue.
      scrollProjection.set(projection); if (!acquiring()) return;
      scrollFacts(); if (!acquiring()) return;
      // Keep the transaction active while draining: commands issued by fact
      // subscribers append after every already queued command.
      for (const request of attachment.requests) { if (!current()) break; if (request.kind === 'pause-following') pauseScrollFollowing(true); else applyScroll(request, true); }
    } finally {
      if (scrollAttachment === attachment) scrollAttachment = null;
    }
  }
  let positionConnection: NativeConfig | null = null, positionSnapshot: NativePositionSnapshot | null = null, positionGeneration = 0;
  let removePosition: (() => void) | null = null;
  let alignmentPosition: { lease: ReturnType<typeof createTargetAlignmentLease> | null; epoch: number } | null = null;
  const positionDefaults = { side: 'bottom', align: 'start', sideOffset: 0, alignOffset: 0, strategy: 'absolute', avoidCollisions: true, collisionBoundary: 'clippingAncestors', collisionPadding: 0 };
  const positionBaselines = new Map<HTMLElement, { position: string; left: string; top: string; side: string | null; align: string | null; variables: Map<string, string> }>();
  function positioningTarget() {
    const anchor = targetOf(positionConnection?.anchor), floating = targetOf(positionConnection?.floating);
    return anchor && floating ? { anchor, floating } : null;
  }
  async function positionNow() {
    if (!ready() || !positionConnection) return;
    if (__nativeFeature('target-alignment') && positionConnection.targetAlignment) { syncAlignmentPosition(); return; }
    const connection = positionConnection, target = positioningTarget(); if (!target) return;
    const { anchor, floating } = target;
    const config: NativeConfig = { ...positionDefaults, ...connection.config as NativeConfig };
    const version = ++positionGeneration, epoch = generation;
    const current = () => ready() && version === positionGeneration && epoch === generation && connection === positionConnection;
    if (!['top','bottom','left','right'].includes(String(config.side)) || !['start','center','end'].includes(String(config.align))) throw new Error('[Positioning] invalid placement.');
    const placement = (config.align === 'center' ? config.side : config.side + '-' + config.align) as Placement;
    let reference: HTMLElement | { getBoundingClientRect(): DOMRect } = anchor;
    if (config.excludeAnchorTranslation) reference = { getBoundingClientRect() {
      const rect = anchor.getBoundingClientRect(); const transform = anchor.ownerDocument.defaultView?.getComputedStyle(anchor).transform;
      const matrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null;
      const dx = matrix?.m41 ?? 0, dy = matrix?.m42 ?? 0;
      return DOMRect.fromRect({ x: rect.x - dx, y: rect.y - dy, width: rect.width, height: rect.height });
    } };
    const boundary = config.collisionBoundary === 'viewport' ? [] : 'clippingAncestors';
    const middleware: Middleware[] = [offset({ mainAxis: Number(config.sideOffset), crossAxis: Number(config.alignOffset) })];
    if (config.avoidCollisions) middleware.push(flip({ boundary, rootBoundary: 'viewport', padding: Number(config.collisionPadding) }), shift({ boundary, rootBoundary: 'viewport', padding: Number(config.collisionPadding) }));
    let baseline = positionBaselines.get(floating);
    if (!baseline) { baseline = { position: floating.style.position, left: floating.style.left, top: floating.style.top, side: floating.getAttribute('data-side'), align: floating.getAttribute('data-align'), variables: new Map() }; positionBaselines.set(floating, baseline); }
    middleware.push(size({ boundary, rootBoundary: 'viewport', padding: Number(config.collisionPadding), apply({ availableWidth, availableHeight, rects }) {
      if (!current()) return;
      const values: Record<string, number> = { '--proto-ui-anchor-width': rects.reference.width, '--proto-ui-anchor-height': rects.reference.height, '--proto-ui-available-width': availableWidth, '--proto-ui-available-height': availableHeight };
      for (const [name, value] of Object.entries(values)) { if (!baseline!.variables.has(name)) baseline!.variables.set(name, floating.style.getPropertyValue(name)); floating.style.setProperty(name, value + 'px'); }
    } }));
    const result = await computePosition(reference, floating, { placement, strategy: config.strategy === 'fixed' ? 'fixed' : 'absolute', middleware });
    if (!current()) return;
    floating.style.position = result.strategy; floating.style.left = result.x + 'px'; floating.style.top = result.y + 'px';
    const [side, align] = result.placement.split('-'); floating.setAttribute('data-side', side); floating.setAttribute('data-align', align ?? 'center');
    positionSnapshot = Object.freeze({ side, align: align ?? 'center', strategy: result.strategy });
    const onResolved = connection.onResolved;
    if (typeof onResolved === 'function' && current() && (options.isReady?.() ?? true)) options.invoke(() => onResolved(positionSnapshot));
  }
  function syncAlignmentPosition() {
    const connection = positionConnection;
    if (!ready() || !connection?.targetAlignment) return;
    const epoch = generation;
    if (removePosition) { ++positionGeneration; const remove = removePosition; removePosition = null; remove(); }
    const slot = alignmentPosition ?? { lease: null, epoch };
    alignmentPosition = slot;
    const callback = connection.onAlignment;
    const current = () => alignmentPosition === slot && slot.epoch === generation && epoch === generation && ready() && positionConnection === connection;
    const native = { ...connection, config: { ...positionDefaults, ...connection.config as NativeConfig }, onAlignment(status: Parameters<OverlayTargetAlignmentBinding['onAlignment']>[0]) {
      if (current() && typeof callback === 'function' && (options.isReady?.() ?? true)) options.invoke(() => { if (current()) callback(status); });
    } } as AnchoredPositionConnection;
    if (slot.lease) { slot.lease.update(native); return; }
    // Native attachment can report synchronously and retire or replace this view.
    const lease = createTargetAlignmentLease(native);
    if (current()) slot.lease = lease;
    else lease.dispose();
  }
  function stopPosition() { ++positionGeneration; const remove = removePosition; removePosition = null; remove?.(); if (__nativeFeature('target-alignment')) { const alignment = alignmentPosition; alignmentPosition = null; alignment?.lease?.dispose(); } }
  function attachPosition() {
    stopPosition(); if (!ready() || !positionConnection) return;
    if (__nativeFeature('target-alignment') && positionConnection.targetAlignment) { syncAlignmentPosition(); return; }
    const target = positioningTarget(); if (!target) return;
    removePosition = autoUpdate(target.anchor, target.floating, () => { void positionNow(); }, { animationFrame: false });
  }
  const positioning: NativePositioning = {
    connect(connection) { alive(); const same = positionConnection?.anchor === connection.anchor && positionConnection?.floating === connection.floating; positionConnection = connection; if (!same) positionSnapshot = null; attachPosition(); },
    update(config) { alive(); if (!positionConnection) return; positionConnection = { ...positionConnection, config }; if (removePosition) void positionNow(); else attachPosition(); },
    requestUpdate() { alive(); void positionNow(); },
    disconnect() { alive(); stopPosition(); positionConnection = null; positionSnapshot = null; },
    getSnapshot() { alive(); return positionSnapshot; },
  };
  let overlayConfig: NativeConfig = { defaultOpen: false, closeOnEscape: false, closeOnOutsidePress: false, closeOnFocusOutside: false, closeOnAnchorPress: false, closeOnTriggerPress: false, placement: 'bottom', align: 'start', sideOffset: 4, alignOffset: 0, anchored: false, availableSpace: false, strategy: 'absolute', avoidCollisions: true, collisionBoundary: 'clippingAncestors', collisionPadding: 0, entry: 'content', restore: 'trigger', portal: false, modal: false, layerOffset: 0 };
  const overlayOpen = observed<boolean>(false, true);
  let overlayTrigger: unknown = null, overlayAnchor: unknown = null, overlayContent: unknown = null, overlayKeepMounted = false;
  let overlayPresence: NativeConfig | null = null, modalBody: HTMLElement | null = null, previousOverlayFocus: HTMLElement | null = null;
  let overlayRevision = 0;
  let overlayAlignment: OverlayTargetAlignment | null = null, overlayAlignmentRevision = 0, overlayAlignmentRetired = false;
  let reconcilingOverlay = false, reconcileOverlayAgain = false;
  const overlayRegions: Record<string, object> = { trigger: {}, anchor: {}, content: {} };
  let overlayMaterialized = false, overlayFocusCaptured = false;
  function alignmentBinding() {
    if (!overlayAlignment) overlayAlignment = new OverlayTargetAlignment({
      subscribeTargets(_family, callback) {
        const changed = () => { if (!disposed && options.isAlive() && (options.isSetupComplete?.() ?? true)) options.invoke(() => callback(undefined)); };
        topologySubscribers.add(changed); return () => { topologySubscribers.delete(changed); };
      },
      isCurrentPart: (family, part) => currentAnatomyPart(family, part) !== null,
      resolvePartInstance: (part) => parts.get(part)?.identity ?? null,
      resolveSelfInstance: () => options.identity,
      resolveSelfRole: (family) => claims.get(family)?.role ?? null,
      resolvePartTarget: (part) => parts.get(part)?.target() ?? null,
      resolveAncestorInstance(family, part, role) {
        const participant = currentAnatomyPart(family, part), rootOwner = domain(family, false);
        if (!participant || !rootOwner) return null;
        let parent = participant.parent(); const visited = new Set<object>();
        while (parent && !visited.has(parent)) {
          visited.add(parent); const candidate = owners.get(parent);
          if (!candidate?.alive()) return null;
          if (candidate.claims.get(family)?.role === role) return candidate.identity;
          if (candidate === rootOwner) return null;
          parent = candidate.parent();
        }
        return null;
      },
      descendantsOf: anatomyDescendants,
    }, {
      replaceImplicitRoot(target) { const lease = { target }; boundaryRootReplacement = lease; boundaryRevision++; return () => { if (boundaryRootReplacement === lease) { boundaryRootReplacement = null; boundaryRevision++; } }; },
    }, () => { if (overlayViewActive()) reconcileOverlay(); });
    return overlayAlignment;
  }
  type AvailableHost = ReturnType<typeof createWebAvailableSpaceHost>;
  type AvailableBinding = Parameters<typeof readAvailableLayout>[0];
  let availableHost: AvailableHost | null = null, availableLease: ReturnType<AvailableHost['attach']> | null = null;
  let availableTarget: HTMLElement | null = null, availableBinding: AvailableBinding | undefined;
  let availableEpoch = 0;
  const availableWatches: (() => void)[] = [];
  function releaseAvailable() {
    ++availableEpoch;
    for (const off of availableWatches.splice(0)) off();
    const lease = availableLease; availableLease = null; availableTarget = null;
    lease?.dispose();
  }
  function overlayViewActive() { return overlayPresence ? Boolean(readValue(overlayPresence.present)) : overlayOpen.handle.get(); }
  function reconcileAvailable(content: HTMLElement | null) {
    if (!ready() || !overlayConfig.availableSpace || !overlayViewActive() || !content) { releaseAvailable(); return; }
    if (availableLease && availableTarget === content) {
      if (availableBinding) availableLease.updateLayout?.(readAvailableLayout(availableBinding));
      else availableLease.requestUpdate();
      return;
    }
    releaseAvailable();
    const epoch = availableEpoch, viewEpoch = generation, binding = availableBinding;
    availableHost ??= createWebAvailableSpaceHost();
    const lease = availableHost.attach({target:content,boundary:'root-content',viewEpoch,
      ...(binding ? {layout:readAvailableLayout(binding)} : {})});
    if (epoch !== availableEpoch || !ready() || generation !== viewEpoch) { lease.dispose(); return; }
    availableLease = lease; availableTarget = content;
    if (!binding) return;
    const current = () => epoch === availableEpoch && viewEpoch === generation && ready() && availableLease === lease && availableBinding === binding;
    try {
      for (const state of availableLayoutStates(binding)) {
        if (!options.watchState) throw new Error('[Positioning] layout State observation unavailable.');
        const off = options.watchState(state, () => { if (!current()) return; const frame = readAvailableLayout(binding); if (current()) lease.updateLayout?.(frame); });
        if (!current()) { off(); return; }
        availableWatches.push(off);
      }
    } catch (error) { if (epoch === availableEpoch) releaseAvailable(); throw error; }
  }
  function unlockModal() {
    if (!modalBody) return;
    const body = modalBody; modalBody = null;
    const lock = modalLocks.get(body); if (!lock) return;
    lock.owners.delete(options.identity); if (lock.owners.size) return;
    if (lock.overflow) body.style.setProperty('overflow', lock.overflow, lock.overflowPriority); else body.style.removeProperty('overflow');
    if (lock.padding) body.style.setProperty('padding-right', lock.padding, lock.paddingPriority); else body.style.removeProperty('padding-right');
    modalLocks.delete(body);
  }
  function lockModal() {
    if (!root || modalBody) return;
    const body = root.ownerDocument.body; if (!body) return;
    modalBody = body;
    let lock = modalLocks.get(body);
    if (!lock) {
      lock = { owners: new Set(), overflow: body.style.getPropertyValue('overflow'), overflowPriority: body.style.getPropertyPriority('overflow'), padding: body.style.getPropertyValue('padding-right'), paddingPriority: body.style.getPropertyPriority('padding-right') };
      modalLocks.set(body, lock);
      const view = root.ownerDocument.defaultView;
      const scrollbar = view ? Math.max(0, view.innerWidth - root.ownerDocument.documentElement.clientWidth) : 0;
      if (scrollbar > 0) body.style.setProperty('padding-right', ((Number.parseFloat(view!.getComputedStyle(body).paddingRight) || 0) + scrollbar) + 'px');
      body.style.setProperty('overflow', 'hidden', lock.overflowPriority);
    }
    lock.owners.add(options.identity);
  }
  function overlayPositionConfig() { return { ...overlayConfig, side: overlayConfig.placement }; }
  let overlayCloseReason: string | undefined;
  function restoreOverlayFocus() {
    if (!overlayMaterialized) return;
    // Retire this entry before native focus dispatch can reopen the overlay.
    overlayMaterialized = false;
    overlayFocusCaptured = false;
    // Current-focus dismissal observes a completed handoff; it must preserve
    // that destination rather than restoring the old entry focus.
    if (overlayConfig.restore === 'none' || overlayCloseReason === 'focus.outside') return;
    const restore = overlayConfig.restore === 'previous' ? previousOverlayFocus : targetOf(overlayTrigger);
    if (restore?.isConnected && !restore.closest('[hidden],[inert]')) restore.focus();
  }
  function reconcileOverlay() {
    if (reconcilingOverlay) { reconcileOverlayAgain = true; return; }
    reconcilingOverlay = true;
    try { do { reconcileOverlayAgain = false; reconcileOverlayPass(); } while (reconcileOverlayAgain && ready()); }
    finally { reconcilingOverlay = false; }
  }
  function reconcileOverlayPass() {
    if (!ready() || !hooks.has('asOverlay')) return;
    const epoch = generation, revision = overlayRevision, alignmentRevision = overlayAlignmentRevision;
    const open = overlayOpen.handle.get();
    reconcileStack();
    if (__nativeFeature('available-space')) reconcileAvailable(targetOf(overlayContent) ?? root);
    // Presence owns the physical view lifetime, including its leaving interval.
    // Semantic open owns dismissal and focus; it cannot retire geometry or modal
    // leases while the bound presentation still displays that view.
    if (!overlayViewActive()) {
      if (__nativeFeature('target-alignment')) overlayAlignment?.clearPhysical();
      stopPosition(); unlockModal();
      restoreOverlayFocus(); return;
    }
    if (overlayConfig.modal) lockModal(); else unlockModal();
    if (__nativeFeature('target-alignment')) overlayAlignment?.syncSurface();
    const content = targetOf(overlayContent) ?? root!, anchor = targetOf(overlayAnchor) ?? targetOf(overlayTrigger);
    if (overlayConfig.anchored && anchor) {
      const config = overlayPositionConfig();
      const alignment = __nativeFeature('target-alignment') ? overlayAlignment?.resolve() : null;
      const changed = positionConnection?.anchor !== anchor || positionConnection?.floating !== content || !!positionConnection?.targetAlignment !== !!alignment;
      positionConnection = { anchor, floating: content, config, ...(alignment ?? {}) };
      if (__nativeFeature('target-alignment') && alignment && !changed && alignmentPosition) syncAlignmentPosition();
      else if (changed || !removePosition) attachPosition();
    }
    if (!ready() || epoch !== generation || revision !== overlayRevision || alignmentRevision !== overlayAlignmentRevision) return;
    // Leaving retains its already committed layer after the semantic candidate
    // has left the dismissal stack.
    if (open) styleProperty(content, 'z-index', String(1000 + (boundaryStacks.get(root!.ownerDocument)?.indexOf(owner) ?? 0) * 2 + Number(overlayConfig.layerOffset ?? 0)));
    if (!open) { restoreOverlayFocus(); return; }
    if (!overlayMaterialized) {
      overlayMaterialized = true;
      // A framework portal relocation replaces the physical root while retaining
      // the same logical opening. It must not replace the original restore target.
      if (!overlayFocusCaptured) {
        previousOverlayFocus = content.ownerDocument.activeElement as HTMLElement | null;
        overlayFocusCaptured = true;
      }
      if (overlayConfig.entry === 'content') content.focus();
      else if (overlayConfig.entry !== 'manual') navigate(overlayConfig.entry === 'selected' ? 'selected' : 'first', undefined, owner.rovingDeclared);
    }
  }
  function setOverlayOpen(value: boolean, reason?: string) {
    if (overlayOpen.handle.get() === value) { if (value) reconcileOverlay(); return; }
    const revision = ++overlayRevision;
    overlayCloseReason = value ? undefined : reason;
    overlayOpen.set(value, reason);
    // A controlled owner can synchronously refuse dismissal or replace its view
    // from an open observation. The superseded request owns no later effects.
    if (revision !== overlayRevision || disposed || !options.isAlive()) return;
    if (value) retireBoundaryStack();
    stackActive = value; reconcileStack();
    if (!value && !overlayMaterialized) overlayFocusCaptured = false;
    if (overlayPresence) {
      const callback = value ? overlayPresence.enter : overlayPresence.leave;
      if (typeof callback !== 'function') throw new Error('[Overlay] presence binding requires enter/leave controls.');
      callback();
    } else if (!overlayKeepMounted) options.setPresent?.(value);
    if (revision !== overlayRevision || disposed || !options.isAlive()) return;
    reconcileOverlay(); projectModuleAttributes(); requestPresentation();
  }
  const overlay: NativeOverlay = {
    open: overlayOpen.handle,
    configure(config) {
      setup('overlay.configure');
      const layout = config.availableLayout ?? overlayConfig.availableLayout;
      if (layout && !(config.availableSpace ?? overlayConfig.availableSpace)) throw new Error('[Overlay] availableLayout requires availableSpace.');
      if (__nativeFeature('available-space') && config.availableLayout !== undefined) {
        const binding = config.availableLayout as AvailableBinding;
        if (readAvailableLayout(binding, true).status === 'invalid') throw new TypeError('[Positioning] Invalid available layout binding.');
        availableBinding = binding;
      }
      overlayConfig = { ...overlayConfig, ...config };
      if (config.defaultOpen !== undefined) { overlayOpen.set(Boolean(config.defaultOpen)); stackActive = Boolean(config.defaultOpen); }
    },
    isOpen() { alive(); return overlayOpen.handle.get(); },
    openOverlay(reason) { runtime('overlay.openOverlay'); setOverlayOpen(true, reason); },
    close(reason) { runtime('overlay.close'); setOverlayOpen(false, reason); },
    toggle(reason) { runtime('overlay.toggle'); setOverlayOpen(!overlayOpen.handle.get(), reason); },
    updatePosition(config) { alive(); overlayConfig = { ...overlayConfig, ...config }; if (positionConnection) { positionConnection = { ...positionConnection, config: overlayPositionConfig() }; void positionNow(); } },
    registerTrigger(target) { alive(); overlayTrigger = target; boundaryRegions.set(overlayRegions.trigger, { target, config: { role: 'trigger' } }); boundaryRevision++; reconcileOverlay(); },
    registerAnchor(target) { alive(); overlayAnchor = target; boundaryRegions.set(overlayRegions.anchor, { target, config: { role: 'anchor' } }); boundaryRevision++; reconcileOverlay(); },
    registerAnchorPart(part) { alive(); overlayAnchor = part; boundaryRegions.set(overlayRegions.anchor, { target: part, config: { role: 'anchor' } }); boundaryRevision++; reconcileOverlay(); },
    registerContent(target) { alive(); overlayContent = target; if (!(__nativeFeature('target-alignment') && overlayAlignment?.hasBinding())) { boundaryRegions.set(overlayRegions.content, { target, config: { role: 'content' } }); boundaryRevision++; } reconcileOverlay(); },
    registerTargetAlignment(binding) {
      runtime('overlay.registerTargetAlignment');
      if (overlayAlignmentRetired) throw new Error('[Overlay] target alignment owner is terminally disposed.');
      ++overlayAlignmentRevision;
      alignmentBinding().set(binding);
      if (boundaryRegions.delete(overlayRegions.content)) boundaryRevision++;
      if (!binding && overlayContent) { boundaryRegions.set(overlayRegions.content, { target: overlayContent, config: { role: 'content' } }); boundaryRevision++; }
      reconcileOverlay();
    },
    getPositionSnapshot() { alive(); return positionSnapshot; },
    keepMounted() { setup('overlay.keepMounted'); if (overlayPresence) throw new Error('[Overlay] cannot keep mounted after binding Presence.'); overlayKeepMounted = true; },
    bindPresence(binding) {
      setup('overlay.bindPresence'); if (overlayPresence === binding) return; if (overlayPresence || overlayKeepMounted) throw new Error('[Overlay] presence already bound or keepMounted declared.'); overlayPresence = binding;
      const present = binding.present;
      const update = () => {
        if (!disposed && options.isAlive() && (options.isSetupComplete?.() ?? true)) options.invoke(() => {
          options.setPresent?.(Boolean(readValue(present)));
          if (!disposed && options.isAlive()) { reconcileOverlay(); requestPresentation(); }
        });
      };
      if (present && typeof present === 'object' && 'get' in present) {
        if (options.watchState) terminalCleanups.push(options.watchState(present as { get(): unknown }, update));
        else if ('watch' in present && typeof present.watch === 'function') terminalCleanups.push(present.watch(update));
        else throw new Error('[Overlay] Presence requires a watchable state handle.');
      }
    },
  };
  let overlayInitialized = false;
  function reconcileLogicalState() {
    if (!(options.isReady?.() ?? true)) return;
    if (__nativeFeature('overlay') && hooks.has('asOverlay') && !overlayInitialized) { overlayInitialized = true; options.invoke(() => { if (!overlayKeepMounted && !overlayPresence) options.setPresent?.(overlayOpen.handle.get()); }); }
  }
  function rootTag(): string | null { alive(); return __nativeFeature('text') && textDeclaration ? textDeclaration.config.lineMode === 'single' ? 'input' : 'textarea' : __nativeFeature('image') && imageDeclaration ? 'img' : __nativeFeature('native-link') && nativeLinkDeclaration ? 'a' : null; }
  function adoptControlState(): void {
    alive(); if (root) throw new Error('[Modules] adopt control state before the first view mount.');
    const target = options.getRoot(); if (!target) throw new Error('[Modules] hydration requires the adopted physical Root.');
    if (target.id) hostIds.set(options.identity, target.id);
    if (__nativeFeature('text') && textDeclared) {
      if (target.localName !== 'input' && target.localName !== 'textarea') throw new Error('[TextControl] adopted Root does not match the physical declaration.');
      textValue = canonicalText((target as HTMLInputElement | HTMLTextAreaElement).value);
    }
  }
  function rootProperties(): Readonly<Record<string, string | number | boolean | null>> {
    alive();
    const result: Record<string, string | number | boolean | null> = Object.create(null);
    if (__nativeFeature('text') && textDeclaration) {
      if (textDeclaration.config.lineMode === 'single') result.type = 'text';
      result.value = textValue;
      for (const [key, value] of Object.entries(textPatch)) if (!['value','valueMode','defaultValue'].includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        if (key === 'minLength' || key === 'maxLength') result[key] = typeof value === 'number' && value >= 0 ? Math.trunc(value) : null;
        else if (key === 'rows') result[key] = Math.max(1, Math.trunc(Number(value)));
        else result[key] = value;
      }
    }
    if (__nativeFeature('image') && imageDeclaration) { result.src = imageSource || null; result.alt = imagePatch.a11yMode === 'decorative' ? '' : String(imagePatch.alternativeText ?? ''); result.style = 'object-fit:' + imageFit; }
    return result;
  }
  function projectAttributes(): Readonly<Record<string, string | null>> {
    alive();
    if (__nativeFeature('table')) refreshTable(!ready());
    const result: Record<string, string | null> = Object.create(null);
    if (__nativeFeature('boundary') && typeof boundaryConfig.debugLabel === 'string') result['data-pui-boundary'] = boundaryConfig.debugLabel;
    if (__nativeFeature('a11y')) {
    const identity = readValue(explicitId);
    if (explicitId !== undefined || hostIds.has(options.identity)) result.id = typeof identity === 'string' && identity ? identity : hostIds.has(options.identity) ? hostId(options.identity) : null;
    if (accessibleName !== undefined) { const name = readValue(accessibleName); result['aria-label'] = typeof name === 'string' && name ? name : null; }
    if (accessibleDescription !== undefined) { const description = readValue(accessibleDescription); result['aria-description'] = typeof description === 'string' && description ? description : null; }
    const level = readValue(accessibleLevel);
    if (accessibleLevel !== undefined && typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6 && (options.getAccessibleRole?.() ?? root?.getAttribute('role')) === 'heading') result['aria-level'] = String(level);
    else if (accessibleLevel !== undefined) result['aria-level'] = null;
    if (accessibleTree.hidden !== undefined) { const hidden = Boolean(readValue(accessibleTree.hidden)); result['aria-hidden'] = String(hidden); result.hidden = hidden ? '' : null; }
    if (accessibleTree.mergeChildren !== undefined) result['data-pui-a11y-merge-children'] = readValue(accessibleTree.mergeChildren) ? '' : null;
    for (const [kind, relation] of relations) {
      if (__nativeFeature('control-label')) {
        const authoredTarget = readValue(relation.target);
        if (kind === 'labelledBy' && controlLabelProjection && (authoredTarget == null || typeof authoredTarget === 'string' && !authoredTarget.trim())) continue;
      }
      const name = relationAttributes[kind], semantic = relationValue(relation);
      const baseline = options.getAttributeBaseline ? options.getAttributeBaseline(name) : attributeBaselines.has(name) ? attributeBaselines.get(name)!.baseline : root?.getAttribute(name);
      const value = relation.mode === 'append' && baseline ? [...new Set((baseline + ' ' + (semantic ?? '')).trim().split(/\s+/))].join(' ') : semantic;
      if (Object.hasOwn(result, name) && result[name] !== value) throw new Error('[A11y] conflicting relation ownership on a shared attribute.');
      result[name] = value;
    }
    }
    if (__nativeFeature('focus') && owner.focusDeclared && focusConfig.navParticipation !== 'none') {
      const provider = ancestor(owner, candidate => candidate !== owner && candidate.rovingDeclared);
      if (provider) { const members = [...owners.values()].filter(candidate => candidate.focusDeclared && !candidate.focusConfig.disabled && ancestor(candidate, entry => entry !== candidate && entry.rovingDeclared) === provider).sort(hostOrder); const selected = members.find(candidate => candidate.active) ?? members.find(candidate => candidate.selected) ?? members[0]; result.tabindex = focusConfig.disabled || selected !== owner ? '-1' : '0'; }
    }
    if (__nativeFeature('overlay') && hooks.has('asOverlay')) { result['data-pui-overlay-open'] = String(overlayOpen.handle.get()); if (overlayConfig.modal) result['aria-modal'] = String(overlayOpen.handle.get()); if (overlayKeepMounted) { result['data-pui-view-detached'] = overlayOpen.handle.get() ? null : ''; if (!overlayOpen.handle.get()) { result.hidden = ''; result['aria-hidden'] = 'true'; } } }
    if (__nativeFeature('hit') && hooks.has('asHitParticipation')) result['data-pui-hit-participation'] = selfHitMode();
    if (__nativeFeature('native-link') && nativeLinkDeclared) {
      result.href = !nativeLinkConfig.disabled && nativeLinkConfig.href ? nativeLinkConfig.href : null;
      result.target = nativeLinkConfig.target || null; result.rel = nativeLinkConfig.rel || null;
      result['aria-disabled'] = nativeLinkConfig.disabled ? 'true' : options.getAttributeBaseline?.('aria-disabled') ?? null;
      result.tabindex = nativeLinkConfig.disabled ? '-1' : options.getAttributeBaseline?.('tabindex') ?? null;
    }
    return result;
  }
  const attributeBaselines = new Map<string, { baseline: string | null; projected: string | null }>();
  function projectModuleAttributes() {
    if (!ready()) return;
    if (options.requestAttributeRefresh) { options.requestAttributeRefresh(); return; }
    for (const [name, value] of Object.entries(projectAttributes())) {
      const current = root!.getAttribute(name);
      let ownership = attributeBaselines.get(name);
      if (!ownership) { ownership = { baseline: current, projected: current }; attributeBaselines.set(name, ownership); }
      else if (current !== ownership.projected) ownership.baseline = current;
      if (current !== value) { if (value === null) root!.removeAttribute(name); else root!.setAttribute(name, value); }
      ownership.projected = value;
    }
  }
  function refresh() {
    if (disposed || !options.isAlive()) return;
    if (__nativeFeature('overlay')) reconcileLogicalState();
    if (__nativeFeature('axis-input')) refreshAxis();
    if (__nativeFeature('table')) refreshTable(false);
    if (!ready()) { requestPresentation(); return; }
    projectModuleAttributes();
    if (__nativeFeature('part-relationships')) partRelationships?.refresh(root);
    if (__nativeFeature('hit')) projectHit();
    if (__nativeFeature('text')) applyText();
    if (__nativeFeature('image')) applyImage();
    if (__nativeFeature('overlay')) reconcileOverlay();
    if (__nativeFeature('scope') && owner.scopeDeclared) { const focused = root!.ownerDocument.activeElement; hasFocused.set(!!focused && contains(root!, focused)); scopeActive.set(owner.scopeActive); }
    if (__nativeFeature('roving') && owner.rovingDeclared) { const focused = root!.ownerDocument.activeElement; const members = focusCandidates(true); rovingHasFocused.set(members.some(member => member.target() === focused)); rovingActive.set(members.some(member => member.active)); }
    if (__nativeFeature('focus') && pendingFocus) { const request = pendingFocus; pendingFocus = null; requestFocus(request); }
    if ((__nativeFeature('scope') || __nativeFeature('roving')) && pendingNavigation) { const request = pendingNavigation; pendingNavigation = null; navigate(request.operation, request.options); }
    if (__nativeFeature('scope') && ownedEntry) fulfillOwnedEntry();
    requestPresentation();
  }
  function portalTarget(): HTMLElement | null { return __nativeFeature('overlay') && ready() && hooks.has('asOverlay') && overlayConfig.portal && overlayViewActive() ? root!.ownerDocument.body : null; }
  function unmount() {
    const previous = root;
    if (__nativeFeature('boundary')) leaveBoundaryPointerScope();
    if (__nativeFeature('part-relationships')) partRelationships?.unmount();
    if (__nativeFeature('scope')) releaseEntryRoot();
    if (__nativeFeature('axis-input')) disconnectAxis('disposed');
    if (__nativeFeature('available-space')) releaseAvailable();
    if (__nativeFeature('target-alignment')) overlayAlignment?.clearPhysical();
    ++generation;
    if (__nativeFeature('image')) imageRequest = null;
    if (__nativeFeature('native-link')) { for (const task of nativeLinkTasks) clearTimeout(task); nativeLinkTasks.clear(); }
    if (__nativeFeature('positioning')) stopPosition();
    if (__nativeFeature('overlay')) unlockModal();
    root = null;
    if (__nativeFeature('scroll')) {
      scrollBinding = null; scrollAttachment = null; explicitlyPaused = false; ++scrollCommandVersion;
      const work = scrollEndWork; scrollEndWork = null;
      if (work && work.frame !== null) work.binding.surface.ownerDocument.defaultView?.cancelAnimationFrame(work.frame);
      if (work) setScrollRequestStatus('rejected');
      scrollProjection.set('unresolved');
    }
    if (__nativeFeature('table') && table) { tableSignature = null; clearTable(); }
    if (previous && targets.get(previous) === owner) targets.delete(previous);
    const failures: unknown[] = [];
    for (const cleanup of cleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
    if (__nativeFeature('scroll')) for (const cleanup of chromeCleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
    if (__nativeFeature('hit')) for (const target of [...hitApplied]) releaseHit(target);
    if (previous) {
      if (__nativeFeature('scroll')) { previous.ownerDocument.defaultView?.clearTimeout(scrollTimer); scrollTimer = undefined; }
      for (const [name, ownership] of attributeBaselines) if (previous.getAttribute(name) === ownership.projected) { if (ownership.baseline === null) previous.removeAttribute(name); else previous.setAttribute(name, ownership.baseline); }
      for (const [name, ownership] of propertyBaselines) if (previous.style.getPropertyValue(name) === ownership.projected) { if (ownership.value) previous.style.setProperty(name, ownership.value); else previous.style.removeProperty(name); }
    }
    attributeBaselines.clear(); propertyBaselines.clear();
    if (__nativeFeature('positioning')) for (const [target, snapshot] of positionBaselines) { target.style.position = snapshot.position; target.style.left = snapshot.left; target.style.top = snapshot.top; for (const [name, value] of snapshot.variables) { if (value) target.style.setProperty(name, value); else target.style.removeProperty(name); } if (snapshot.side === null) target.removeAttribute('data-side'); else target.setAttribute('data-side', snapshot.side); if (snapshot.align === null) target.removeAttribute('data-align'); else target.setAttribute('data-align', snapshot.align); }
    if (__nativeFeature('positioning')) positionBaselines.clear();
    if (__nativeFeature('scroll')) for (const [target, snapshot] of chromeTargets) { target.style.width = snapshot.width; target.style.height = snapshot.height; target.style.transform = snapshot.transform; target.style.display = snapshot.display; if (snapshot.size) target.style.setProperty('--proto-ui-scroll-thumb-size', snapshot.size); else target.style.removeProperty('--proto-ui-scroll-thumb-size'); if (snapshot.offset) target.style.setProperty('--proto-ui-scroll-thumb-offset', snapshot.offset); else target.style.removeProperty('--proto-ui-scroll-thumb-offset'); }
    if (__nativeFeature('scroll')) { chromeTargets.clear(); readerContacts = 0; readerPoints.clear(); readerArrivals.clear(); readerIntent = 0; readerArrivalUntil = 0; lastScrollGeometry = null; }
    if (__nativeFeature('text')) { detachText(); textComposing = false; textCallbackPrelude = null; ++textEventGeneration; }
    if (__nativeFeature('overlay')) overlayMaterialized = false;
    if (previous) {
      if (options.isAlive() && (options.isReady?.() ?? true)) {
        if (__nativeFeature('scope') || __nativeFeature('roving') || __nativeFeature('scroll')) options.invoke(() => { if (__nativeFeature('scope')) hasFocused.set(false); if (__nativeFeature('roving')) rovingHasFocused.set(false); if (__nativeFeature('scroll')) scrolling.set(false); });
      }
      announceTopology();
    }
    if (failures.length) throw new AggregateError(failures, '[Modules] view cleanup failed.');
  }
  function mount() {
    alive(); const candidate = options.getRoot(); if (root === candidate && ready()) { refresh(); return; }
    unmount(); root = candidate;
    if (!root) return;
    const mountEpoch = generation;
    targets.set(root, owner);
    if (root.id) hostIds.set(options.identity, root.id);
    try {
      const doc = root.ownerDocument;
      if (__nativeFeature('scope') || __nativeFeature('roving')) listen(doc, 'focusin', () => { if (owner.rovingDeclared) { const active = doc.activeElement; for (const member of focusCandidates(true)) { member.active = member.target() === active; if (rovingConfig.selectOnFocus && member.active) member.selected = true; } } refresh(); });
      if (__nativeFeature('scope') || __nativeFeature('roving')) listen(root, 'keydown', native => {
        const event = native as KeyboardEvent; const scopeNavigation = owner.scopeDeclared && owner.scopeActive, rovingNavigation = owner.rovingDeclared;
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!scopeNavigation && !rovingNavigation) return;
        const config = rovingNavigation ? rovingConfig : scopeConfig, navigation = String(config.navigation), orientation = String(config.orientation);
        if (event.key === 'Tab' && navigation.includes('tab')) { if (scopeNavigation && scopeConfig.trap || rovingNavigation) { options.invoke(() => navigate(event.shiftKey ? 'prev' : 'next', undefined, rovingNavigation)); event.preventDefault(); } return; }
        if (!navigation.includes('arrow')) return;
        const rtl = root!.ownerDocument.defaultView?.getComputedStyle(root!).direction === 'rtl';
        const forward = orientation !== 'vertical' && event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') || orientation !== 'horizontal' && event.key === 'ArrowDown';
        const backward = orientation !== 'vertical' && event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') || orientation !== 'horizontal' && event.key === 'ArrowUp';
        if (forward || backward || event.key === 'Home' || event.key === 'End') { options.invoke(() => navigate(event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : forward ? 'next' : 'prev', undefined, rovingNavigation)); event.preventDefault(); }
      });
      if (__nativeFeature('boundary') && (boundaryObserved || boundaryFocusObserved || __nativeFeature('overlay') && hooks.has('asOverlay'))) {
        enterBoundaryPointerScope(doc);
        listen(doc, 'pointerdown', native => withBoundaryPointerScope(sequence => {
          if (!sequence.sample || sequence.sample.nativeEvent !== native) {
            sequence.sample = Object.freeze({ type: 'pointerdown', target: native.target, nativeEvent: native });
            sequence.outside.clear();
          }
          const sample = sequence.sample, selected = nativeBoundaryOwner(doc, sample);
          const epoch = generation, revision = __nativeFeature('overlay') ? overlayRevision : 0;
          const overlayOutside = __nativeFeature('overlay') && hooks.has('asOverlay') && overlayOpen.handle.get() && overlayConfig.closeOnOutsidePress;
          const classification = boundaryObserved || overlayOutside ? notifyOutside(sample, 'pointer.press') : classify(sample);
          if (!ready() || epoch !== generation || sequence !== boundaryPointerSequence) return;
          if (__nativeFeature('overlay') && revision === overlayRevision && hooks.has('asOverlay') && overlayOpen.handle.get() && selected === owner) {
            if (overlayConfig.closeOnOutsidePress && classification === 'outside') options.invoke(() => setOverlayOpen(false, 'outside.press'));
            else if (overlayConfig.closeOnTriggerPress && targetOf(overlayTrigger)?.contains(native.target as Node) || overlayConfig.closeOnAnchorPress && targetOf(overlayAnchor)?.contains(native.target as Node)) options.invoke(() => setOverlayOpen(false, 'trigger.press'));
          }
        }), { capture: true });
        const endPointer = () => { if (boundaryPointerSequence) { boundaryPointerSequence.sample = undefined; boundaryPointerSequence.outside.clear(); } };
        for (const type of ['pointerup', 'pointercancel', 'keydown']) listen(doc, type, endPointer, { capture: true });
        if (doc.defaultView) listen(doc.defaultView, 'blur', endPointer);
        if (boundaryFocusObserved || __nativeFeature('overlay') && overlayConfig.closeOnFocusOutside) listen(doc, 'focusin', native => withBoundaryPointerScope(sequence => {
          const epoch = generation, revision = boundaryRevision, overlayVersion = __nativeFeature('overlay') ? overlayRevision : 0;
          const sample = sampleBoundaryFocus(native, doc);
          if (!sample || !ready() || epoch !== generation || revision !== boundaryRevision || sequence !== boundaryPointerSequence) return;
          if (sequence.sample && sequence.outside.has(owner)) return;
          const classification = notifyOutside(sample, 'focus.move', sequence.sample ?? sample);
          if (__nativeFeature('overlay') && ready() && epoch === generation && overlayVersion === overlayRevision && hooks.has('asOverlay') && overlayOpen.handle.get() && overlayConfig.closeOnFocusOutside && classification === 'outside') options.invoke(() => setOverlayOpen(false, 'focus.outside'));
        }), { capture: true });
      }
      if (__nativeFeature('overlay')) listen(doc, 'keydown', native => { const event = native as KeyboardEvent; if (event.key !== 'Escape' || !overlayOpen.handle.get() || !overlayConfig.closeOnEscape) return; if (nativeBoundaryOwner(doc, { nativeEvent: native }) !== owner) return; options.invoke(() => setOverlayOpen(false, 'escape')); event.preventDefault(); }, { capture: true });
      if (__nativeFeature('text')) attachText();
      if (__nativeFeature('image')) attachImage();
      if (__nativeFeature('native-link')) attachNativeLink();
      if (__nativeFeature('scroll')) { attachScroll(); if (mountEpoch !== generation || root !== candidate) return; }
      if (__nativeFeature('positioning')) attachPosition();
      if (__nativeFeature('boundary')) reconcileStack();
      refresh(); announceTopology();
      if ((__nativeFeature('anatomy') || __nativeFeature('scope') || __nativeFeature('roving') || __nativeFeature('scroll')) && typeof MutationObserver !== 'undefined' && (claims.size || __nativeFeature('scope') && owner.scopeDeclared || __nativeFeature('roving') && owner.rovingDeclared || __nativeFeature('scroll') && scrollChrome)) { const mutation = new MutationObserver(records => { if (!records.some(record => record.type === 'childList')) return; announceTopology(); if (__nativeFeature('scope') && ownedEntry) fulfillOwnedEntry(); if (__nativeFeature('scroll') && scrollChrome) attachChrome(); }); mutation.observe(root, { childList: true, subtree: true }); cleanups.push(() => mutation.disconnect()); }
    } catch (error) { if (mountEpoch === generation && root === candidate) try { unmount(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[Modules] mount and cleanup failed.'); } throw error; }
  }
  const registeredFacts = new Set<object>();
  function registerFacts<T extends boolean | string | number>(state: NativeObserved<T>) { if (registeredFacts.has(state)) return; registeredFacts.add(state); options.registerObservedState?.(state); }
  const capabilities: NativeModuleCapabilities<Run> = {
    hasAuthoredControlLabelName() { const name = readValue(accessibleName), target = readValue(relations.get('labelledBy')?.target); return typeof name === 'string' && name.trim().length > 0 || (typeof target === 'string' ? target.trim().length > 0 : target != null) || Boolean(options.getAttributeBaseline?.('aria-label')?.trim()); },
    beginControlLabelName() { const lease = {}; controlLabelProjection = lease; try { projectModuleAttributes(); } catch (error) { if (controlLabelProjection === lease) controlLabelProjection = null; throw error; } return () => { if (controlLabelProjection === lease) controlLabelProjection = null; }; },
    controlLabelAnatomyScope(pair: NativeControlLabelAnatomyPair, kind: 'label' | 'target') { const expected = kind === 'label' ? pair.labelRole : pair.targetRole; return claims.get(pair.family)?.role === expected ? domain(pair.family, false)?.identity ?? null : null; },
    subscribeControlLabelAnatomy(callback: () => void) { topologySubscribers.add(callback); return () => topologySubscribers.delete(callback); },
    anatomy, accessible, positioning,
    asFocusEntry() { declare('asFocusEntry'); owner.entryDeclared = true; return entry; },
    asFocusScope() { declare('asFocusScope'); owner.scopeDeclared = true; registerFacts(scope.active); registerFacts(scope.hasFocused); return scope; },
    asFocusRoving() { declare('asFocusRoving'); owner.rovingDeclared = true; registerFacts(roving.active); registerFacts(roving.hasFocused); return roving; },
    asCollection() { declare('asCollection'); return declareCollection(); }, asCollectionItem() { declare('asCollectionItem'); return declareCollectionItem(); },
    asBoundary() { declare('asBoundary'); return boundary; }, asHitParticipation(config) { declare('asHitParticipation'); if (config) hit.configure(config); return hit; },
    asOverlay() { declare('asOverlay'); registerFacts(overlay.open); return overlay; },
    asScrollSurface() { declare('asScrollSurface'); registerFacts(scroll.axes); registerFacts(scroll.scrolling); registerFacts(scroll.projection); registerFacts(scroll.endFollow.state); registerFacts(scroll.endFollow.requestStatus); for (const axis of [scroll.horizontal, scroll.vertical]) { registerFacts(axis.position); registerFacts(axis.visibleRatio); registerFacts(axis.canScrollBefore); registerFacts(axis.canScrollAfter); registerFacts(axis.atEnd); } return scroll; },
    asTextControl() { declare('asTextControl'); if (!textDeclaration) throw new Error('[TextControl] asTextControl requires its static physical declaration.'); textDeclared = true; return textControl; },
    asImageView() { declare('asImageView'); if (!imageDeclaration) throw new Error('[ImageView] asImageView requires its static physical declaration.'); imageDeclared = true; return imageView; },
    asNativeLink() { declare('asNativeLink'); if (!nativeLinkDeclaration) throw new Error('[NativeLink] asNativeLink requires its static physical declaration.'); if (nativeLinkDeclared) throw new Error('[NativeLink] only one native link may be declared per owner.'); nativeLinkDeclared = true; return nativeLink; },
    asAxisInput() { declare('asAxisInput'); if (axisDeclared) throw new Error('[AxisInput] One input may be declared per instance.'); axisDeclared = true; return axisInput; },
    asTableStructure(role) { declare('asTableStructure'); return declareTable(role); },
    configureFocusable(config) { setup('focus.configure'); owner.focusDeclared = true; hooks.add('asFocusable'); Object.assign(focusConfig, config); },
    setFocusDisabled(value) { runtime('focus.setDisabled'); focusConfig.disabled = value; if (value) pendingFocus = null; announceTopology(); },
    setNavParticipation(value) { runtime('focus.setNavParticipation'); if (!['auto','none'].includes(value)) throw new Error('[Focus] invalid navigation participation.'); focusConfig.navParticipation = value; refresh(); },
    setRovingStatus(status) { runtime('focus.setRovingStatus'); if (status.selected !== undefined) owner.selected = Boolean(status.selected); if (status.active !== undefined) owner.active = Boolean(status.active); refresh(); },
    canFocus,
    focus(request) { runtime('focus.focus'); requestFocus(request); },
    blur() { runtime('focus.blur'); ++scopeActivation; cancelOwnedEntry(); pendingFocus = null; if (ready()) root!.blur(); },
    rootTag, rootProperties, projectAttributes, portalTarget, adoptControlState,
    commitHost() { if (__nativeFeature('text')) applyText(); },
    refresh, mount, unmount,
    dispose() {
      if (disposed) return;
      if (__nativeFeature('hit')) hitRetired = true;
      if (__nativeFeature('target-alignment')) { overlayAlignmentRetired = true; overlayAlignment?.dispose(); overlayAlignment = null; }
      if (__nativeFeature('scope')) { ++scopeActivation; cancelOwnedEntry(); }
      const rootOwner = logicalRoot(owner);
      const failures: unknown[] = [];
      if (__nativeFeature('part-relationships')) try { partRelationships?.dispose(); partRelationships = null; } catch (error) { failures.push(error); }
      try { unmount(); } catch (error) { failures.push(error); }
      disposed = true;
      if (__nativeFeature('scope') || __nativeFeature('roving') || __nativeFeature('scroll') || __nativeFeature('overlay')) nativeNotifications.length = 0;
      owners.delete(options.identity); claims.clear(); hooks.clear(); topologySubscribers.clear();
      if (__nativeFeature('table')) tableRecords.delete(owner);
      if (__nativeFeature('boundary')) { retireBoundaryStack(); outsideListeners.clear(); boundaryRegions.clear(); boundaryRootReplacement = null; }
      if (__nativeFeature('hit')) hitRegions.clear();
      if (__nativeFeature('text')) textListeners.clear();
      if (__nativeFeature('image')) imageListeners.clear();
      if (__nativeFeature('native-link')) nativeLinkListeners.clear();
      if (__nativeFeature('axis-input')) axisListeners.length = 0;
      if (__nativeFeature('scope')) { const scopeIndex = activeScopes.indexOf(owner); if (scopeIndex >= 0) { activeScopes.splice(scopeIndex, 1); ++scopeRevision; } }
      if (__nativeFeature('a11y')) { for (const off of accessibleSubscriptions.values()) try { off(); } catch (error) { failures.push(error); }
      accessibleSubscriptions.clear(); }
      for (const cleanup of terminalCleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
      if (__nativeFeature('anatomy')) anatomyVersions.clear();
      announceTopology(rootOwner);
      if (failures.length) throw new AggregateError(failures, '[Modules] terminal cleanup failed.');
    },
  };
  owners.set(options.identity, owner);
  return capabilities;
}
`;
