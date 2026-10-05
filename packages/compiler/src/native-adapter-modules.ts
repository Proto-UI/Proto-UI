export const nativeAdapterModulesArtifact = {
  path: '.proto-ui/interaction/adapter-modules-v1.ts',
  kind: 'source' as const,
  contents: String.raw`// Standalone full DOM capability lowering. No Proto Runtime/Adapter or semantic-IR interpreter.
import { autoUpdate, computePosition, offset, flip, shift, size, type Middleware, type Placement } from '@floating-ui/dom';
export type NativeConfig = Readonly<Record<string, unknown>>;
export type NativeStateEvent<T> = { type: 'next'; prev: T; next: T; reason?: unknown } | { type: 'disconnect'; reason: 'unmount' };
export type NativeObservedSpec = { kind: 'bool' | 'string' | 'enum' | 'number.discrete' | 'number.range'; options?: readonly string[]; min?: number; max?: number; clamp?: boolean };
export type NativeObserved<T> = { readonly semantic?: string; readonly spec?: Readonly<NativeObservedSpec>; get(): T; watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void): () => void; subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void): () => void };
export type NativeOwnedState<T> = { get(): T; set(value: T, reason?: unknown): void; setDefault(value: T): void };
export type NativeBorrowedState<T> = NativeOwnedState<T> & { watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void): () => void };
export type NativeOwnedStateSpec = { kind: 'bool' | 'string' | 'enum' | 'number.discrete'; options?: readonly string[] };
export type NativeTransitionHooks = { created(): void; mounted(): void; unmounted(): void; beforeDispose(): void; propsChanged(): void };
type NativeStateCell<T> = { handle: NativeOwnedState<T>; set(value: T): void };
export type NativeFocusRequest = { reason?: 'programmatic' | 'keyboard' | 'pointer'; preventScroll?: boolean; defer?: boolean };
export type NativeFocusBase = { focused: NativeObserved<boolean>; focusVisible: NativeObserved<boolean>; focusable: NativeObserved<boolean>; configure(config: NativeConfig): void; setDisabled(value: boolean): void; focusSelf(options?: NativeFocusRequest): void };
export interface NativeFocusEntry { configure(config: NativeConfig): void; setDisabled(value: boolean): void; focus(options?: NativeFocusRequest): void }
export interface NativeFocusRoving {
  active: NativeObserved<boolean>; hasFocused: NativeObserved<boolean>;
  configure(config: NativeConfig): void; setLoop(value: boolean): void; setOrientation(value: string): void;
  focusFirst(options?: NativeFocusRequest): void; focusLast(options?: NativeFocusRequest): void; focusSelected(options?: NativeFocusRequest): void; focusNext(): void; focusPrev(): void;
}
export interface NativeFocusScope { active: NativeObserved<boolean>; hasFocused: NativeObserved<boolean>; configure(config: NativeConfig): void; focusFirst(): void; focusLast(): void; focusNext(): void; focusPrev(): void; focusSelected(): void; activate(options?: NativeFocusRequest): void; deactivate(options?: NativeFocusRequest): void; restoreFocus(): void; isActive(): boolean; getRoving(): NativeFocusRoving | null }
export type NativeAnatomyFamily = { debugName: string; roles: Readonly<Record<string, { cardinality: { min: number; max: number | '*' }; requires?: readonly { kind: string; name: string }[] }>>; relations?: readonly unknown[]; profiles?: Readonly<Record<string, unknown>> };
export interface NativeAnatomyPart { readonly role: string; hasExpose(key: string): boolean; getExpose(key: string): unknown | null; hasHook(name: string): boolean }
export interface NativeAnatomyOrder {
  version(family: NativeAnatomyFamily): number; parts(family: NativeAnatomyFamily): readonly NativeAnatomyPart[]; partsOf(family: NativeAnatomyFamily, role: string): readonly NativeAnatomyPart[];
  indexOfSelf(family: NativeAnatomyFamily, role: string): number; prevOfSelf(family: NativeAnatomyFamily, role: string): NativeAnatomyPart | null; nextOfSelf(family: NativeAnatomyFamily, role: string): NativeAnatomyPart | null;
}
export interface NativeAnatomy<Run = unknown> extends NativeAnatomyOrder { claim(family: NativeAnatomyFamily, declaration: { role: string; profile?: string }): void; has(family: NativeAnatomyFamily, role: string): boolean; subscribeParts(family: NativeAnatomyFamily, role: string, callback: (run: Run, parts: readonly NativeAnatomyPart[]) => void): () => void; readonly order: NativeAnatomyOrder }
export type NativeCollectionSnapshot = Readonly<Record<string, unknown> & {index: number; total: number; first: boolean; last: boolean}>;
export interface NativeCollection { readonly count: NativeOwnedState<number>; configure(config: NativeConfig): void; getItems(): readonly NativeCollectionSnapshot[]; getCount(): number }
export interface NativeCollectionItem { readonly collectionIndex: NativeOwnedState<number>; readonly collectionTotal: NativeOwnedState<number>; readonly collectionFirst: NativeOwnedState<boolean>; readonly collectionLast: NativeOwnedState<boolean>; configure(config: NativeConfig): void; getSnapshot(): NativeCollectionSnapshot }
export interface NativeBoundary<Run = unknown> { configure(config: NativeConfig): void; observe(type: string): void; setStackActive(active: boolean): void; registerRegion(target: unknown, options?: NativeConfig): () => void; unregisterRegion(target: unknown): void; classify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown'; notify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown'; subscribeOutside(callback: (event: NativeConfig) => void): () => void }
export interface NativeHitParticipation { configure(config: NativeConfig): void; registerRegion(target: unknown, options?: NativeConfig): () => void; unregisterRegion(target: unknown): void }
export type NativePositionSnapshot = Readonly<{side: string; align: string; strategy: string}>;
export interface NativePositioning { connect(connection: NativeConfig): void; update(config: NativeConfig): void; requestUpdate(): void; disconnect(): void; getSnapshot(): NativePositionSnapshot | null }
export interface NativeOverlay { readonly open: NativeObserved<boolean>; configure(config: NativeConfig): void; isOpen(): boolean; openOverlay(reason?: string): void; close(reason?: string): void; toggle(reason?: string): void; updatePosition(config: NativeConfig): void; registerTrigger(target: unknown): void; registerAnchor(target: unknown): void; registerAnchorPart(part: NativeAnatomyPart | null): void; registerContent(target: unknown): void; getPositionSnapshot(): NativePositionSnapshot | null; keepMounted(): void; bindPresence(binding: NativeConfig): void }
export interface NativeScrollAxis { position: NativeObserved<number>; visibleRatio: NativeObserved<number>; canScrollBefore: NativeObserved<boolean>; canScrollAfter: NativeObserved<boolean>; atEnd: NativeObserved<boolean> }
export type NativeScrollAxisSnapshot = Readonly<{position: number; visibleRatio: number; canScrollBefore: boolean; canScrollAfter: boolean; atEnd: boolean}>;
export type NativeScrollSnapshot = Readonly<{axes: string; horizontal: NativeScrollAxisSnapshot; vertical: NativeScrollAxisSnapshot; scrolling: boolean; projection: string; endFollow: Readonly<{state: string; requestStatus: string}>}>;
export interface NativeScroll { axes: NativeObserved<string>; horizontal: NativeScrollAxis; vertical: NativeScrollAxis; scrolling: NativeObserved<boolean>; projection: NativeObserved<string>; endFollow: { state: NativeObserved<string>; requestStatus: NativeObserved<string> }; configure(config: NativeConfig): void; bindComposedChrome(binding: NativeConfig): void; request(request: NativeConfig): void; getSnapshot(): NativeScrollSnapshot }
export type NativeTextEvent = Readonly<{type: string; value: string; composing: boolean; data: string | null; inputType: string | null}>;
export type NativeImageEvent = Readonly<{status: string; previousStatus: string; source: string}>;
export interface NativeTextControl<Run = unknown> { on(type: string, callback: (run: Run, event: NativeTextEvent) => void): () => void; sync(patch: NativeConfig): void; snapshot(): { value: string; composing: boolean } | null }
export interface NativeImageView<Run = unknown> { on(type: string, callback: (run: Run, event: NativeImageEvent) => void): () => void; sync(patch: NativeConfig): void; snapshot(): { source: string; loadingStatus: string; fit: string } | null }
export interface NativeTransition { transitionState: NativeBorrowedState<string>; isPresent: NativeBorrowedState<boolean>; controls: { enter(): void; leave(): void; complete(): void }; configure(config: NativeConfig): void; enter(): void; leave(): void; complete(): void }
export interface NativeTableStructure {
  readonly role: string;
  readonly states: { a11yRole: NativeOwnedState<string>; rowCount: NativeOwnedState<number>; columnCount: NativeOwnedState<number>; row: NativeOwnedState<number>; column: NativeOwnedState<number>; rowSpan: NativeOwnedState<number>; columnSpan: NativeOwnedState<number> };
  configure(patch: NativeConfig): void; getObjectRef(): object; getSnapshot(): NativeTableSnapshot | null;
}
export type NativeTableCell = Readonly<{ ref: object; kind: 'column-header' | 'row-header' | 'cell'; row: number; column: number; rowSpan: number; columnSpan: number; columnHeaders: readonly object[]; rowHeaders: readonly object[]; orderedHeaders: readonly object[] }>;
export type NativeTableRow = Readonly<{ ref: object; index: number; cells: readonly NativeTableCell[] }>;
export type NativeTableDiagnostic = Readonly<{ code: string; ref?: object; row?: number; headerKey?: string }>;
export type NativeTableSnapshot = Readonly<{ root: object; caption: object | undefined; rowCount: number; columnCount: number; rows: readonly NativeTableRow[]; valid: boolean; diagnostics: readonly NativeTableDiagnostic[] }>;
export interface NativeAccessibleExtension { readonly objectRef: object; id(value: string | { get(): string | null | undefined }): void; name(value: string | { get(): string | null | undefined }): void; description(value: string | { get(): string | null | undefined }): void; relation(kind: string, target: NativeConfig): void; tree(config: NativeConfig): void; level(value: number | { get(): number }): void }
export type NativeModuleCapability<Kind extends string, Run = unknown> = Kind extends 'transition-controls' ? NativeTransition['controls'] : Kind extends 'transition-action' | 'binding-disposer' ? () => void : Kind extends 'collection-snapshot' ? NativeConfig : Kind extends 'collection-snapshot-list' ? readonly NativeConfig[] : Kind extends 'focus-entry' ? NativeFocusEntry : Kind extends 'focus-roving' ? NativeFocusRoving : Kind extends 'focus-scope' ? NativeFocusScope : Kind extends 'anatomy-family' ? NativeAnatomyFamily : Kind extends 'anatomy-part' ? NativeAnatomyPart : Kind extends 'anatomy-parts' ? readonly NativeAnatomyPart[] : Kind extends 'anatomy-order' ? NativeAnatomyOrder : Kind extends 'collection' ? NativeCollection : Kind extends 'collection-item' ? NativeCollectionItem : Kind extends 'boundary' ? NativeBoundary<Run> : Kind extends 'hit-participation' ? NativeHitParticipation : Kind extends 'positioning' ? NativePositioning : Kind extends 'overlay' ? NativeOverlay : Kind extends 'scroll' ? NativeScroll : Kind extends 'scroll-axis' ? NativeScrollAxis : Kind extends 'scroll-follow' ? NativeScroll['endFollow'] : Kind extends 'text-control' ? NativeTextControl<Run> : Kind extends 'image-view' ? NativeImageView<Run> : Kind extends 'transition' ? NativeTransition : Kind extends 'table-structure' ? NativeTableStructure : Kind extends 'table-states' ? NativeTableStructure['states'] : Kind extends 'table-snapshot' ? NativeTableSnapshot : Kind extends 'table-row' ? NativeTableRow : Kind extends 'table-cell' ? NativeTableCell : Kind extends 'table-diagnostic' ? NativeTableDiagnostic : Kind extends 'table-row-list' ? readonly NativeTableRow[] : Kind extends 'table-cell-list' ? readonly NativeTableCell[] : Kind extends 'table-diagnostic-list' ? readonly NativeTableDiagnostic[] : Kind extends 'a11y-ref-list' ? readonly object[] : Kind extends 'subscription-disposer' ? () => void : Kind extends 'host-target' ? Element : Kind extends 'focus-scope-key' | 'focus-roving-key' | 'a11y-ref' ? object : NativeConfig;
export interface NativeModuleCapabilities<Run = unknown> {
  anatomy: NativeAnatomy<Run>; accessible: NativeAccessibleExtension; positioning: NativePositioning;
  asFocusEntry(): NativeFocusEntry; asFocusRoving(): NativeFocusRoving; asFocusScope(): NativeFocusScope; asCollection(): NativeCollection; asCollectionItem(): NativeCollectionItem;
  asBoundary(): NativeBoundary<Run>; asHitParticipation(): NativeHitParticipation; asOverlay(): NativeOverlay; asScrollSurface(): NativeScroll; asTextControl(): NativeTextControl<Run>; asImageView(): NativeImageView<Run>; asTableStructure(role: string): NativeTableStructure; asTransition(): NativeTransition;
  configureFocusable(config: NativeConfig): void; setFocusDisabled(value: boolean): void; setNavParticipation(value: string): void; setRovingStatus(status: NativeConfig): void; canFocus(): boolean; focus(options?: NativeFocusRequest): void; blur(): void;
  rootTag(): string | null; rootProperties(): Readonly<Record<string, string | number | boolean | null>>; projectAttributes(): Readonly<Record<string, string | null>>; portalTarget(): HTMLElement | null;
  adoptControlState(): void; mount(): void; unmount(): void; refresh(): void; dispose(): void;
}
export interface NativeAdapterModuleOptions<Run> {
  ensureSetup(operation: string): void; ensureRuntime(operation: string): void; ensureEvent(operation: string): void;
  isAlive(): boolean; isReady?(): boolean; invoke<T>(callback: () => T): T; getRun(): Run; getResolvedProps(): Readonly<Record<string, unknown>>; getRoot(): HTMLElement | null; getHost?(): HTMLElement | null;
  declarations: readonly { id: string; config: NativeConfig }[]; getLogicalParent(): object | null; identity: object;
  registerObservedState?<T extends boolean | string | number>(state: NativeObserved<T>): void;
  getExposes?(): Readonly<Record<string, unknown>>; setPresent?(value: boolean): void; requestHostUpdate?(): void; baseFocus?(): NativeFocusBase; getAccessibleRole?(): string | null;
  emit?(key: string): void;
  createOwnedState?<T extends boolean | string | number>(name: string, initial: T, spec?: NativeOwnedStateSpec): NativeOwnedState<T>;
  watchState?<T>(state: { get(): T }, callback: (run: Run, event: NativeStateEvent<T>) => void): () => void;
  declareTransition?(hooks: NativeTransitionHooks): void;
  isPropProvided?(key: string): boolean;
  getMeta?(key: string): unknown;
  registerExpose?(key: string, value: unknown): void;
  tableFamily?: NativeAnatomyFamily;
  requestAttributeRefresh?(): void;
  getAttributeBaseline?(name: string): string | null;
  subscribeState?(state: { get(): unknown }, callback: () => void): () => void;
}
type Claim = { family: NativeAnatomyFamily; role: string; profile?: string; part: NativeAnatomyPart };
type Owner = { identity: object; parent(): object | null; target(): HTMLElement | null; host(): HTMLElement | null; alive(): boolean; hooks: Set<string>; claims: Map<object, Claim>; exposes(): Readonly<Record<string, unknown>>; focusConfig: Record<string, unknown>; scopeConfig: Record<string, unknown>; rovingConfig: Record<string, unknown>; selected: boolean; active: boolean; scopeDeclared: boolean; rovingDeclared: boolean; focusDeclared: boolean; entryDeclared: boolean; scopeActive: boolean; focus(request?: NativeFocusRequest): void; changed(): void };
type NativeTableRecord = { role: string; config: NativeConfig; snapshot: NativeTableSnapshot | null; family?: NativeAnatomyFamily; ready(): boolean; refresh(logical: boolean): void; clear(): void; apply(role: string, row?: number, cell?: NativeTableCell, snapshot?: NativeTableSnapshot): void };
const tableRecords = new WeakMap<Owner, NativeTableRecord>();
const owners = new Map<object, Owner>();
const activeScopes: Owner[] = [];
const parts = new WeakMap<NativeAnatomyPart, Owner>();
const targets = new WeakMap<HTMLElement, Owner>();
const boundaryStacks = new WeakMap<Document, Owner[]>();
const boundarySampleOwners = new WeakMap<object, Owner | null>();
const modalLocks = new WeakMap<HTMLElement, { owners: Set<object>; overflow: string; overflowPriority: string; padding: string; paddingPriority: string }>();
const hitClaims = new WeakMap<HTMLElement, { owners: Map<object, string>; value: string; priority: string }>();
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
  const scopeConfig: Record<string, unknown> = { trap: false, loop: false, navigation: 'tab', orientation: 'both', entry: 'first', restore: 'previous', emptyPolicy: 'container' };
  const rovingConfig: Record<string, unknown> = { loop: false, navigation: 'arrow', orientation: 'both', entry: 'active', selectOnFocus: false };
  let pendingFocus: NativeFocusRequest | null = null, pendingNavigation: { operation: string; options?: NativeFocusRequest } | null = null;
  let restoreTarget: HTMLElement | null = null;
  const observed = <T extends boolean | string | number>(initial: T, semantic?: string, spec?: NativeObservedSpec) => {
    let value = initial;
    const listeners = new Set<(event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void>();
    const handle: NativeObserved<T> = Object.freeze({
      semantic, spec: Object.freeze(spec ?? { kind: typeof initial === 'boolean' ? 'bool' : typeof initial === 'number' ? 'number.discrete' : 'string' }),
      get() { alive(); return value; },
      watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void) { setup('state.watch'); const listener = (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => callback(options.getRun() as unknown as R, event); listeners.add(listener); return () => { listeners.delete(listener); }; },
      subscribe(callback: (event: { type: 'next'; prev: T; next: T; reason?: unknown }) => void) { alive(); listeners.add(callback); return () => listeners.delete(callback); },
    });
    terminalCleanups.push(() => listeners.clear());
    return { handle, set(next: T) { if (Object.is(value, next)) return; const prev = value; value = next; const epoch = generation; for (const callback of [...listeners]) { if (epoch !== generation || !ready() || !(options.isReady?.() ?? true)) break; if (listeners.has(callback)) options.invoke(() => callback({ type: 'next', prev, next, reason: 'native-module' })); } } };
  };
  const scopeActive = observed<boolean>(false, '@focus/active'), hasFocused = observed<boolean>(false, '@focus/hasFocused'), rovingActive = observed<boolean>(false, '@focus/active'), rovingHasFocused = observed<boolean>(false, '@focus/hasFocused');
  const owner: Owner = { identity: options.identity, parent: options.getLogicalParent, target: () => root, host: () => root ? options.getHost?.() ?? root : null, alive: () => !disposed && options.isAlive(), hooks, claims, exposes: () => options.getExposes?.() ?? {}, focusConfig, scopeConfig, rovingConfig, selected: false, active: false, scopeDeclared: false, rovingDeclared: false, focusDeclared: false, entryDeclared: false, scopeActive: false, focus: request => requestFocus(request), changed: () => { const epoch = generation; for (const callback of [...topologySubscribers]) { if (epoch !== generation || !ready() || !(options.isReady?.() ?? true)) break; if (topologySubscribers.has(callback)) options.invoke(callback); } refresh(); } };
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
    const guarded = (event: Event) => { if (epoch === generation && ready() && (options.isReady?.() ?? true)) callback(event); };
    target.addEventListener(type, guarded, listenerOptions); cleanups.push(() => target.removeEventListener(type, guarded, listenerOptions));
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
  function focusCandidates(roving: boolean): Owner[] {
    const found: Owner[] = [];
    for (const candidate of owners.values()) {
      if (candidate === owner || !candidate.alive() || !candidate.focusDeclared || candidate.focusConfig.disabled || candidate.focusConfig.navParticipation === 'none') continue;
      const target = candidate.target();
      if (!target?.isConnected || target.closest('[hidden],[inert],[data-pui-view-detached]')) continue;
      if (roving) {
        const key = candidate.focusConfig.groupKey;
        const provider = ancestor(candidate, participant => participant !== candidate && participant.rovingDeclared && (!key || participant.rovingConfig.key === key));
        if (provider !== owner) continue;
      } else if (!descends(candidate, owner)) continue;
      const duplicate = found.findIndex(entry => entry.target() === target);
      if (duplicate < 0) found.push(candidate);
      else if (descends(candidate, found[duplicate])) found[duplicate] = candidate;
    }
    return found.sort(hostOrder);
  }
  function requestFocus(request?: NativeFocusRequest) {
    alive();
    if (focusConfig.disabled || !canFocus()) return;
    if (!ready() || root!.closest('[hidden],[inert],[data-pui-view-detached]')) { pendingFocus = request ?? {}; return; }
    if (options.baseFocus) options.invoke(() => options.baseFocus!().focusSelf(request));
    else root!.focus({ preventScroll: request?.preventScroll });
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
  const entry: NativeFocusEntry = {
    configure(config) { setup('focusEntry.configure'); entryConfig = { ...entryConfig, ...config }; },
    setDisabled(value) { runtime('focusEntry.setDisabled'); entryConfig.disabled = value; },
    focus(request) {
      runtime('focusEntry.focus'); if (entryConfig.disabled || !ready() || !canFocus()) return;
      if (entryConfig.strategy === 'descendant-first') {
        const candidates = root!.querySelectorAll<HTMLElement>('a[href],area[href],button,input,select,textarea,summary,iframe,audio[controls],video[controls],[contenteditable],[tabindex]');
        for (const candidate of candidates) {
          if (candidate.closest('[hidden],[inert],[aria-hidden="true"],[data-pui-view-detached]') || candidate.hasAttribute('disabled') || candidate.getAttribute('aria-disabled') === 'true' || candidate.tabIndex < 0) continue;
          if (candidate.localName === 'input' && (candidate as HTMLInputElement).type === 'hidden') continue;
          candidate.focus({ preventScroll: request?.preventScroll }); return;
        }
      }
      if (entryConfig.fallback === 'self') root!.focus({ preventScroll: request?.preventScroll });
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
      if (ready()) { const current = root!.ownerDocument.activeElement; if (current && !contains(root!, current)) restoreTarget = current as HTMLElement; }
      const index = activeScopes.indexOf(owner); if (index >= 0) activeScopes.splice(index, 1); activeScopes.push(owner);
      owner.scopeActive = true; scopeActive.set(true);
      if (scopeConfig.entry !== 'manual') {
        const candidates = focusCandidates(owner.rovingDeclared);
        if (candidates.length) candidates[0].focus(request ?? { reason: 'programmatic' });
        else if (scopeConfig.emptyPolicy !== 'container') { activeScopes.pop(); owner.scopeActive = false; scopeActive.set(false); }
      }
    },
    deactivate(request) { runtime('focusScope.deactivate'); const index = activeScopes.indexOf(owner); if (index >= 0) activeScopes.splice(index, 1); owner.scopeActive = false; scopeActive.set(false); if (ready() && restoreTarget?.isConnected && !restoreTarget.closest('[hidden],[inert],[data-pui-view-detached]')) restoreTarget.focus({ preventScroll: request?.preventScroll }); },
    restoreFocus() { runtime('focusScope.restoreFocus'); if (ready() && restoreTarget?.isConnected) restoreTarget.focus(); },
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
    subscribeParts(family, role, callback) {
      setup('anatomy.subscribeParts');
      let previous: readonly NativeAnatomyPart[] = [];
      const changed = () => { if (!domain(family, false)) return; const next = anatomyOrder.partsOf(family, role); if (next.length === previous.length && next.every((part, index) => part === previous[index])) return; previous = next; callback(options.getRun(), next); };
      topologySubscribers.add(changed); return () => { setup('anatomy.subscribeParts.off'); topologySubscribers.delete(changed); };
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
  let boundaryObserved = false, stackActive = true;
  let boundaryConfig: NativeConfig = {};
  const boundaryRegions = new Map<object, { target: unknown; config: NativeConfig }>(), hitRegions = new Map<object, { target: unknown; config: NativeConfig }>();
  const outsideListeners = new Set<(event: NativeConfig) => void>();
  let hitConfig: NativeConfig = { mode: 'participating' };
  const hitApplied = new Set<HTMLElement>();
  function classify(sample?: NativeConfig): 'inside' | 'outside' | 'unknown' {
    const sampleTarget = sample?.target ?? (sample?.nativeEvent as Event | undefined)?.target;
    if ([...boundaryRegions.values()].some(region => Object.is(region.target, sampleTarget))) return 'inside';
    if (!sampleTarget || typeof sampleTarget !== 'object' || typeof (sampleTarget as Node).nodeType !== 'number') return 'unknown';
    let known = !!root;
    const boundaryRoot = options.getHost?.() ?? root;
    if (boundaryRoot && contains(boundaryRoot, sampleTarget as Node)) return 'inside';
    for (const region of boundaryRegions.values()) {
      const target = targetOf(region.target);
      if (!target) { known = false; continue; }
      known = true;
      if (contains(target, sampleTarget as Node)) return 'inside';
    }
    return known ? 'outside' : 'unknown';
  }
  function notifyOutside(sample?: NativeConfig) {
    const classification = classify(sample);
    if (!ready() || !(options.isReady?.() ?? true)) return 'unknown';
    if (classification !== 'outside') return classification;
    const native = sample?.nativeEvent;
    const identity = native && typeof native === 'object' ? native as object : sample;
    const stack = boundaryStacks.get(root!.ownerDocument) ?? [];
    let selected = identity && boundarySampleOwners.has(identity) ? boundarySampleOwners.get(identity)! : stack[stack.length - 1] ?? null;
    if (identity && !boundarySampleOwners.has(identity)) boundarySampleOwners.set(identity, selected);
    if (stackActive && selected && selected !== owner) return 'unknown';
    const event = Object.freeze({ classification, sample }), epoch = generation;
    for (const callback of [...outsideListeners]) { if (epoch !== generation || !ready() || !(options.isReady?.() ?? true)) break; if (outsideListeners.has(callback)) options.invoke(() => callback(event)); }
    return classification;
  }
  function reconcileStack() {
    if (!root) return;
    const stack = boundaryStacks.get(root.ownerDocument) ?? [];
    const index = stack.indexOf(owner), active = stackActive && (hooks.has('asOverlay') ? overlayOpen.handle.get() : hooks.has('asBoundary'));
    if (!active && index >= 0) stack.splice(index, 1);
    if (active && index < 0) stack.push(owner);
    boundaryStacks.set(root.ownerDocument, stack);
  }
  const boundary: NativeBoundary<Run> = {
    configure(config) { setup('boundary.configure'); if (config.meta && typeof config.meta !== 'object') throw new TypeError('[Boundary] metadata must be a record.'); boundaryConfig = { ...boundaryConfig, ...config }; },
    observe(type) { setup('boundary.observe'); if (type !== 'pointer.press') throw new Error('[Boundary] only pointer.press observation is portable.'); boundaryObserved = true; reconcileStack(); },
    setStackActive(value) { alive(); stackActive = value; reconcileStack(); },
    registerRegion(target, config = {}) { alive(); const token = {}; boundaryRegions.set(token, { target, config }); return () => { boundaryRegions.delete(token); }; },
    unregisterRegion(target) { alive(); for (const [token, region] of boundaryRegions) if (Object.is(region.target, target)) boundaryRegions.delete(token); },
    classify(sample) { alive(); return classify(sample); },
    notify(sample) { alive(); return notifyOutside(sample); },
    subscribeOutside(callback) { alive(); outsideListeners.add(callback); return () => { outsideListeners.delete(callback); }; },
  };
  function releaseHit(target: HTMLElement) {
    const claims = hitClaims.get(target);
    if (!claims) return;
    claims.owners.delete(options.identity);
    if (!claims.owners.size) {
      if (claims.value) target.style.setProperty('pointer-events', claims.value, claims.priority); else target.style.removeProperty('pointer-events');
      hitClaims.delete(target); target.removeAttribute('data-pui-hit-participation');
    }
    hitApplied.delete(target);
  }
  function projectHit() {
    if (!ready()) return;
    const next = new Map<HTMLElement, string>();
    if (hooks.has('asHitParticipation')) next.set(root!, String(hitConfig.mode));
    for (const region of hitRegions.values()) { const target = targetOf(region.target); if (target) next.set(target, String(region.config.mode ?? hitConfig.mode)); }
    for (const [target, mode] of next) for (const [identity, other] of hitClaims.get(target)?.owners ?? [])
      if (identity !== options.identity && other !== mode) throw new Error('[HitParticipation] conflicting modes on a shared target.');
    for (const target of [...hitApplied]) if (!next.has(target)) releaseHit(target);
    for (const [target, mode] of next) {
      let claims = hitClaims.get(target);
      if (!claims) { claims = { owners: new Map(), value: target.style.getPropertyValue('pointer-events'), priority: target.style.getPropertyPriority('pointer-events') }; hitClaims.set(target, claims); }
      claims.owners.set(options.identity, mode); hitApplied.add(target);
      target.setAttribute('data-pui-hit-participation', mode);
      if (mode === 'participating') { if (claims.value) target.style.setProperty('pointer-events', claims.value, claims.priority); else target.style.removeProperty('pointer-events'); }
      else target.style.setProperty('pointer-events', 'none');
    }
  }
  const hit: NativeHitParticipation = {
    configure(config) { setup('hitParticipation.configure'); if (config.mode && !['participating','disabled','passthrough'].includes(String(config.mode))) throw new Error('[HitParticipation] invalid mode.'); hitConfig = { ...hitConfig, ...config }; },
    registerRegion(target, config = {}) { alive(); const token = {}; hitRegions.set(token, { target, config }); projectHit(); return () => { hitRegions.delete(token); if (!disposed && options.isAlive()) projectHit(); }; },
    unregisterRegion(target) { alive(); for (const [token, region] of hitRegions) if (Object.is(region.target, target)) hitRegions.delete(token); projectHit(); },
  };
  let explicitId: string | { get(): string | null | undefined } | undefined, accessibleName: string | { get(): string | null | undefined } | undefined, accessibleDescription: string | { get(): string | null | undefined } | undefined, accessibleLevel: number | { get(): number } | undefined;
  let accessibleTree: NativeConfig = {};
  const accessibleSubscriptions = new Map<string, () => void>();
  const relations = new Map<string, NativeConfig>();
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
    id(value) { setup('accessible.id'); explicitId = value; watchAccessible('id', value); const current = readValue(value); if (typeof current === 'string' && current) hostIds.set(options.identity, current); },
    name(value) { setup('accessible.name'); accessibleName = value; watchAccessible('name', value); },
    description(value) { setup('accessible.description'); accessibleDescription = value; watchAccessible('description', value); },
    relation(kind, spec) { setup('accessible.relation'); if (!Object.hasOwn(relationAttributes, kind)) throw new Error('[A11y] invalid direct relationship kind.'); const mode = String(spec.mode ?? 'replace'); if (mode !== 'replace' && mode !== 'append') throw new Error('[A11y] relation mode must be replace or append.'); relations.set(kind, { ...spec, mode }); watchAccessible('relation:' + kind, spec.target); },
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
  if (textDeclaration && imageDeclaration) throw new Error('[Modules] one physical Root cannot be both a text control and an image.');
  if (textDeclaration && (textDeclaration.config.content !== 'plain-text' || textDeclaration.config.engine !== 'host' || !['single','multiline'].includes(String(textDeclaration.config.lineMode))))
    throw new Error('[TextControl] unsupported physical declaration.');
  const textListeners = new Map<string, Set<(run: Run, event: NativeTextEvent) => void>>();
  let textDeclared = false, textInitialized = false, textValue = '', textComposing = false, textMode = 'uncontrolled';
  let textPatch: NativeConfig = {};
  const canonicalText = (value: string) => { const normalized = value.replace(/\r\n?/g, '\n'); return textDeclaration?.config.lineMode === 'single' ? normalized.replace(/\n/g, '') : normalized; };
  function restoreTextValue(target: HTMLInputElement | HTMLTextAreaElement) {
    if (target.value === textValue || textComposing) return;
    const start = target.selectionStart, end = target.selectionEnd, direction = target.selectionDirection;
    const top = target.scrollTop, left = target.scrollLeft;
    target.value = textValue;
    if (start !== null && end !== null) target.setSelectionRange(Math.min(start, textValue.length), Math.min(end, textValue.length), direction ?? 'none');
    target.scrollTop = top; target.scrollLeft = left;
  }
  function applyText() {
    if (!ready() || !textDeclared) return;
    if (root!.localName !== 'input' && root!.localName !== 'textarea') throw new Error('[TextControl] renderer did not bind the required physical Root.');
    const target = root as HTMLInputElement | HTMLTextAreaElement;
    if (target.localName === 'input' && !['text','search','tel','password'].includes((target as HTMLInputElement).type)) throw new Error('[TextControl] incompatible input sanitization.');
    for (const [key, value] of Object.entries(textPatch)) {
      if (['value','valueMode','defaultValue'].includes(key)) continue;
      if (['disabled','readOnly','required'].includes(key)) { Reflect.set(target, key, value); continue; }
      if (key === 'rows' && target.localName === 'textarea') { Reflect.set(target, key, Math.max(1, Math.trunc(Number(value)))); continue; }
      if (key === 'minLength' || key === 'maxLength') { if (Number(value) < 0) target.removeAttribute(key.toLowerCase()); else Reflect.set(target, key, Math.trunc(Number(value))); continue; }
      if (['placeholder','name','autoComplete','inputMode','enterKeyHint','wrap'].includes(key)) { if (value === '') target.removeAttribute(key.toLowerCase()); else target.setAttribute(key.toLowerCase(), String(value)); }
    }
    if (typeof textPatch.defaultValue === 'string') target.defaultValue = canonicalText(textPatch.defaultValue);
    restoreTextValue(target);
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
        ...(typeof patch.value === 'string' ? { value: canonicalText(patch.value) } : {}),
        ...(typeof patch.defaultValue === 'string' ? { defaultValue: canonicalText(patch.defaultValue) } : {}) };
      if (textMode === 'controlled') textValue = String(textPatch.value ?? '');
      applyText(); requestPresentation();
    },
    snapshot() { alive(); return textDeclared ? Object.freeze({ value: textValue, composing: textComposing }) : null; },
  };
  function attachText() {
    if (!textDeclared) return;
    applyText();
    const target = root as HTMLInputElement | HTMLTextAreaElement, epoch = generation;
    for (const type of ['input','change','compositionstart','compositionupdate','compositionend']) listen(target, type, native => {
      const editing = native as InputEvent;
      if (type === 'compositionstart' || type === 'input' && editing.isComposing) textComposing = true;
      if (type === 'compositionend') textComposing = false;
      const value = canonicalText(target.value);
      if (textMode === 'uncontrolled' && type === 'input') textValue = value;
      const event = Object.freeze({ type, value, composing: textComposing, data: typeof editing.data === 'string' ? canonicalText(editing.data) : null, inputType: type === 'input' && typeof editing.inputType === 'string' ? editing.inputType : null });
      for (const callback of [...textListeners.get(type) ?? []]) { if (epoch !== generation || !ready() || !(options.isReady?.() ?? true)) break; options.invoke(() => callback(options.getRun(), event)); }
      if (textMode === 'controlled' && (type === 'compositionend' || type === 'input' && !textComposing)) queueMicrotask(() => { if (epoch === generation && ready()) applyText(); });
    });
  }
  const imageListeners = new Set<(run: Run, event: NativeImageEvent) => void>();
  let imageDeclared = false, imageFit = String(imageDeclaration?.config.fit ?? 'contain'), imageGeneration = 0;
  let imagePatch: NativeConfig = imageDeclaration?.config ?? {};
  function validatedImageSource(): string { const source = String(imagePatch.source ?? ''); if (!source) return ''; const hasAlternative = String(imagePatch.alternativeText ?? '').trim().length > 0; return imagePatch.a11yMode === 'informative' && hasAlternative || imagePatch.a11yMode === 'decorative' && !hasAlternative ? source : ''; }
  let imageSource = validatedImageSource(), imageStatus = imageSource ? 'loading' : 'idle';
  function imageTransition(status: string) {
    if (imageStatus === status) return;
    const previousStatus = imageStatus; imageStatus = status;
    const event = Object.freeze({ status, previousStatus, source: imageSource }), epoch = generation, request = imageGeneration;
    for (const callback of [...imageListeners]) { if (!ready() || !(options.isReady?.() ?? true) || epoch !== generation || request !== imageGeneration) break; options.invoke(() => callback(options.getRun(), event)); }
  }
  function completeImage(request: number, epoch: number, target: HTMLImageElement, status: string) {
    if (!ready() || request !== imageGeneration || epoch !== generation || root !== target || imageStatus !== 'loading' || !imageSource) return;
    imageTransition(status);
  }
  function applyImage(restart = false) {
    if (!ready() || !imageDeclared) return;
    if (root!.localName !== 'img') throw new Error('[ImageView] renderer did not bind the required img Root.');
    const target = root as HTMLImageElement;
    target.alt = imagePatch.a11yMode === 'decorative' ? '' : String(imagePatch.alternativeText ?? '');
    styleProperty(target, 'object-fit', imageFit);
    if (!imageSource) { target.removeAttribute('src'); return; }
    const changed = target.getAttribute('src') !== imageSource;
    if (changed) { target.removeAttribute('src'); target.src = imageSource; }
    if (!changed && !restart) return;
    const request = ++imageGeneration, epoch = generation;
    if (imageStatus !== 'loading') return;
    if (target.complete && target.naturalWidth > 0) { queueMicrotask(() => completeImage(request, epoch, target, 'loaded')); return; }
    if (typeof target.decode !== 'function') throw new Error('[ImageView] the concrete browser must support request-bound image.decode().');
    void target.decode().then(() => completeImage(request, epoch, target, 'loaded'), () => completeImage(request, epoch, target, 'error'));
  }
  const imageView: NativeImageView<Run> = {
    on(type, callback) { setup('imageView.on'); if (type !== 'loadingStatusChange') throw new Error('[ImageView] invalid event type.'); imageListeners.add(callback); return () => { setup('imageView.off'); imageListeners.delete(callback); }; },
    sync(patch) {
      runtime('imageView.sync');
      const previousSource = imageSource;
      if (patch.fit !== undefined && !['contain','cover','fill'].includes(String(patch.fit))) throw new Error('[ImageView] invalid fit.');
      if (patch.a11yMode !== undefined && !['informative','decorative'].includes(String(patch.a11yMode))) throw new Error('[ImageView] invalid accessibility mode.');
      const { loadingStatus: _moduleOwnedStatus, ...portablePatch } = patch;
      imagePatch = { ...imagePatch, ...portablePatch };
      imageSource = validatedImageSource(); imageFit = String(imagePatch.fit ?? 'contain');
      if (imageSource !== previousSource) { ++imageGeneration; imageTransition(imageSource ? 'loading' : 'idle'); }
      applyImage(imageSource !== previousSource); requestPresentation();
    },
    snapshot() { alive(); return imageDeclared ? Object.freeze({ source: imageSource, loadingStatus: imageStatus, fit: imageFit }) : null; },
  };
  const scrollAxes = observed<string>('vertical', '@scroll/axes', { kind: 'enum', options: ['horizontal', 'vertical', 'both'] }), scrollProjection = observed<string>('unresolved', '@scroll/projection', { kind: 'enum', options: ['unresolved', 'system', 'composed'] }), scrolling = observed<boolean>(false, '@scroll/scrolling');
  const followState = observed<string>('off', '@scroll/endFollowState', { kind: 'enum', options: ['off', 'pending', 'following', 'paused'] }), followRequest = observed<string>('idle', '@scroll/endFollowRequestStatus', { kind: 'enum', options: ['idle', 'pending', 'applied', 'rejected'] });
  function axisFacts(axis: 'horizontal' | 'vertical'): { handle: NativeScrollAxis; update(position: number, viewport: number, extent: number): void } {
    const position = observed<number>(0, '@scroll/' + axis + 'Position', { kind: 'number.range', min: 0, max: 1, clamp: true }), ratio = observed<number>(1, '@scroll/' + axis + 'VisibleRatio', { kind: 'number.range', min: 0, max: 1, clamp: true }), before = observed<boolean>(false, '@scroll/' + axis + 'CanScrollBefore'), after = observed<boolean>(false, '@scroll/' + axis + 'CanScrollAfter'), end = observed<boolean>(true, '@scroll/' + axis + 'AtEnd');
    return { handle: { position: position.handle, visibleRatio: ratio.handle, canScrollBefore: before.handle, canScrollAfter: after.handle, atEnd: end.handle },
      update(offsetValue, viewport, extent) { const range = Math.max(0, extent - viewport); const clamped = Math.min(range, Math.max(0, offsetValue)); position.set(range > 0 ? clamped / range : 0); ratio.set(extent > 0 ? Math.max(0, Math.min(1, viewport / extent)) : 1); before.set(clamped > 0); after.set(clamped < range); end.set(range - clamped <= 1); },
    };
  }
  const horizontal = axisFacts('horizontal'), vertical = axisFacts('vertical');
  let scrollConfig: NativeConfig = { axes: 'vertical', projection: 'auto', endFollow: { mode: 'off' } };
  let scrollChrome: NativeConfig | null = null, readerContacts = 0, scrollTimer: number | undefined;
  let readerIntent = 0, scrollEndFrame: number | null = null;
  const chromeCleanups: (() => void)[] = [];
  const chromeTargets = new Map<HTMLElement, { width: string; height: string; transform: string; display: string; size: string; offset: string }>();
  function scrollFacts() {
    if (!ready() || !hooks.has('asScrollSurface')) return;
    horizontal.update(root!.scrollLeft, root!.clientWidth, root!.scrollWidth);
    vertical.update(root!.scrollTop, root!.clientHeight, root!.scrollHeight);
    const follow = scrollConfig.endFollow as NativeConfig;
    if (follow?.mode === 'while-at-end') {
      const atEnd = follow.axis === 'horizontal' ? horizontal.handle.atEnd.get() : vertical.handle.atEnd.get();
      if (readerContacts || !atEnd && Date.now() < readerIntent) followState.set('paused');
      else if (atEnd) followState.set('following');
    }
    projectChrome();
  }
  function applyScroll(request: NativeConfig) {
    if (!ready()) { pendingScroll = request; return; }
    if (request.axis !== 'horizontal' && request.axis !== 'vertical') throw new Error('[Scroll] request axis must be horizontal or vertical.');
    const horizontalAxis = request.axis === 'horizontal';
    const viewport = horizontalAxis ? root!.clientWidth : root!.clientHeight, extent = horizontalAxis ? root!.scrollWidth : root!.scrollHeight;
    const current = horizontalAxis ? root!.scrollLeft : root!.scrollTop, range = Math.max(0, extent - viewport);
    let next: number;
    if (request.kind === 'by') next = current + Number(request.delta);
    else if (request.kind === 'to') next = Number(request.position);
    else if (request.kind === 'control-drag') next = Math.max(0, Math.min(1, Number(request.position))) * range;
    else if (request.kind === 'page') next = current + (request.direction === 'before' ? -viewport : viewport);
    else if (request.kind === 'to-end') next = range;
    else throw new Error('[Scroll] invalid request kind.');
    if (!Number.isFinite(next)) throw new Error('[Scroll] request coordinate must be finite.');
    if (horizontalAxis) root!.scrollLeft = Math.max(0, Math.min(range, next)); else root!.scrollTop = Math.max(0, Math.min(range, next));
    scrollFacts();
    if (request.kind === 'to-end') { followRequest.set('applied'); followState.set('following'); }
  }
  let pendingScroll: NativeConfig | null = null;
  function endFollowContentChanged() {
    if (!ready()) return;
    const follow = scrollConfig.endFollow as NativeConfig;
    if (follow?.mode !== 'while-at-end' || followState.handle.get() !== 'following' || readerContacts || Date.now() < readerIntent) { scrollFacts(); return; }
    const view = root!.ownerDocument.defaultView, epoch = generation;
    if (!view || scrollEndFrame !== null) return;
    followRequest.set('pending');
    scrollEndFrame = view.requestAnimationFrame(() => {
      scrollEndFrame = null;
      if (epoch !== generation || !ready()) return;
      if (readerContacts || Date.now() < readerIntent || followState.handle.get() !== 'following') { followRequest.set('rejected'); return; }
      options.invoke(() => applyScroll({ kind: 'to-end', axis: follow.axis ?? 'vertical' }));
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
          options.invoke(() => applyScroll({ kind: 'page', axis, direction: before ? 'before' : 'after' })); event.preventDefault();
        }
      };
      const move = (native: Event) => {
        const event = native as PointerEvent; if (!drag || event.pointerId !== drag.id || !ready()) return;
        const travel = (axis === 'horizontal' ? track.clientWidth - thumb.getBoundingClientRect().width : track.clientHeight - thumb.getBoundingClientRect().height);
        if (travel <= 0) return;
        const coordinate = axis === 'horizontal' ? event.clientX : event.clientY;
        options.invoke(() => applyScroll({ kind: 'control-drag', axis, position: drag!.offset + (coordinate - drag!.start) / travel })); event.preventDefault();
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
    request(request) { runtime('scroll.request'); applyScroll(request); },
    getSnapshot() {
      alive(); const snapshot = (axis: NativeScrollAxis) => Object.freeze({ position: axis.position.get(), visibleRatio: axis.visibleRatio.get(), canScrollBefore: axis.canScrollBefore.get(), canScrollAfter: axis.canScrollAfter.get(), atEnd: axis.atEnd.get() });
      return Object.freeze({ axes: scrollAxes.handle.get(), horizontal: snapshot(horizontal.handle), vertical: snapshot(vertical.handle), scrolling: scrolling.handle.get(), projection: scrollProjection.handle.get(), endFollow: { state: followState.handle.get(), requestStatus: followRequest.handle.get() } });
    },
  };
  function attachScroll() {
    if (!hooks.has('asScrollSurface')) return;
    const preference = String(scrollConfig.requireProjection ?? scrollConfig.projection);
    if (preference === 'composed' && !scrollChrome) throw new Error('[Scroll] required composed projection needs authored chrome binding.');
    scrollProjection.set(preference === 'composed' || preference === 'auto' && scrollChrome ? 'composed' : 'system');
    if (scrollProjection.handle.get() === 'composed') { styleProperty(root!, 'scrollbar-width', 'none'); styleProperty(root!, '-ms-overflow-style', 'none'); }
    styleProperty(root!, 'overflow-x', scrollConfig.axes === 'vertical' ? 'hidden' : 'auto'); styleProperty(root!, 'overflow-y', scrollConfig.axes === 'horizontal' ? 'hidden' : 'auto');
    listen(root!, 'scroll', () => { scrolling.set(true); scrollFacts(); root!.ownerDocument.defaultView?.clearTimeout(scrollTimer); const epoch = generation; scrollTimer = root!.ownerDocument.defaultView!.setTimeout(() => { scrollTimer = undefined; if (epoch === generation && ready()) { scrolling.set(false); scrollFacts(); } }, 120); }, { passive: true });
    listen(root!, 'wheel', event => { readerIntent = Date.now() + 250; const wheel = event as WheelEvent; if (scrollProjection.handle.get() === 'composed') { const axis = scrollConfig.axes === 'horizontal' || Math.abs(wheel.deltaX) > Math.abs(wheel.deltaY) ? 'horizontal' : 'vertical'; const delta = axis === 'horizontal' ? wheel.deltaX || wheel.deltaY : wheel.deltaY; options.invoke(() => applyScroll({ kind: 'by', axis, delta: delta * (wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? root!.clientHeight : 1) })); event.preventDefault(); } if (followState.handle.get() !== 'off' && !(scrollConfig.axes === 'horizontal' ? horizontal.handle : vertical.handle).atEnd.get()) followState.set('paused'); }, { passive: false });
    listen(root!, 'pointerdown', () => { readerContacts++; readerIntent = Date.now() + 250; });
    const endContact = () => { readerContacts = Math.max(0, readerContacts - 1); readerIntent = Date.now() + 250; scrollFacts(); };
    listen(root!.ownerDocument, 'pointerup', endContact, { capture: true }); listen(root!.ownerDocument, 'pointercancel', endContact, { capture: true });
    listen(root!, 'keydown', () => { readerIntent = Date.now() + 250; });
    if (typeof ResizeObserver !== 'undefined') { const resize = new ResizeObserver(endFollowContentChanged); resize.observe(root!); for (const child of root!.children) resize.observe(child); cleanups.push(() => resize.disconnect()); }
    if (typeof MutationObserver !== 'undefined') { const mutation = new MutationObserver(records => { if (records.every(record => record.type === 'attributes' && (record.target === root || isElement(record.target) && chromeTargets.has(record.target) && record.attributeName === 'style'))) return; endFollowContentChanged(); attachChrome(); }); mutation.observe(root!, { childList: true, subtree: true, characterData: true, attributes: true }); cleanups.push(() => mutation.disconnect()); }
    scrollFacts(); attachChrome();
    if (pendingScroll) { const request = pendingScroll; pendingScroll = null; options.invoke(() => applyScroll(request)); }
  }
  let positionConnection: NativeConfig | null = null, positionSnapshot: NativePositionSnapshot | null = null, positionGeneration = 0;
  let removePosition: (() => void) | null = null;
  const positionDefaults = { side: 'bottom', align: 'start', sideOffset: 0, alignOffset: 0, strategy: 'absolute', avoidCollisions: true, collisionBoundary: 'clippingAncestors', collisionPadding: 0 };
  const positionBaselines = new Map<HTMLElement, { position: string; left: string; top: string; side: string | null; align: string | null; variables: Map<string, string> }>();
  function positioningTarget() {
    const anchor = targetOf(positionConnection?.anchor), floating = targetOf(positionConnection?.floating);
    return anchor && floating ? { anchor, floating } : null;
  }
  async function positionNow() {
    if (!ready() || !positionConnection) return;
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
  function stopPosition() { ++positionGeneration; removePosition?.(); removePosition = null; }
  function attachPosition() {
    stopPosition(); if (!ready() || !positionConnection) return;
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
  let overlayConfig: NativeConfig = { defaultOpen: false, closeOnEscape: true, closeOnOutsidePress: true, closeOnFocusOutside: false, closeOnAnchorPress: false, closeOnTriggerPress: false, placement: 'bottom', align: 'start', sideOffset: 0, alignOffset: 0, anchored: true, strategy: 'absolute', avoidCollisions: true, collisionBoundary: 'clippingAncestors', collisionPadding: 0, entry: 'first', restore: 'trigger', portal: false, modal: false, layerOffset: 0 };
  const overlayOpen = observed<boolean>(false);
  let overlayTrigger: unknown = null, overlayAnchor: unknown = null, overlayContent: unknown = null, overlayKeepMounted = false;
  let overlayPresence: NativeConfig | null = null, modalBody: HTMLElement | null = null, previousOverlayFocus: HTMLElement | null = null;
  const overlayRegions: Record<string, object> = { trigger: {}, anchor: {}, content: {} };
  let overlayMaterialized = false;
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
  function reconcileOverlay() {
    if (!ready() || !hooks.has('asOverlay')) return;
    const open = overlayOpen.handle.get();
    reconcileStack();
    if (!open) {
      stopPosition(); unlockModal();
      if (overlayMaterialized && overlayConfig.restore !== 'none') {
        const restore = overlayConfig.restore === 'previous' ? previousOverlayFocus : targetOf(overlayTrigger);
        if (restore?.isConnected && !restore.closest('[hidden],[inert]')) restore.focus();
      }
      overlayMaterialized = false; return;
    }
    if (overlayConfig.modal) lockModal();
    const content = targetOf(overlayContent) ?? root!, anchor = targetOf(overlayAnchor) ?? targetOf(overlayTrigger);
    if (overlayConfig.anchored && anchor) {
      const config = overlayPositionConfig();
      const changed = positionConnection?.anchor !== anchor || positionConnection?.floating !== content;
      positionConnection = { anchor, floating: content, config };
      if (changed || !removePosition) attachPosition();
    }
    styleProperty(content, 'z-index', String(1000 + (boundaryStacks.get(root!.ownerDocument)?.indexOf(owner) ?? 0) * 2 + Number(overlayConfig.layerOffset ?? 0)));
    if (!overlayMaterialized) {
      overlayMaterialized = true;
      previousOverlayFocus = content.ownerDocument.activeElement as HTMLElement | null;
      if (overlayConfig.entry === 'content') content.focus();
      else if (overlayConfig.entry !== 'manual') navigate(overlayConfig.entry === 'selected' ? 'selected' : 'first', undefined, owner.rovingDeclared);
    }
  }
  function setOverlayOpen(value: boolean, reason?: string) {
    if (overlayOpen.handle.get() === value) return;
    overlayOpen.set(value);
    if (overlayPresence) {
      const callback = value ? overlayPresence.enter : overlayPresence.leave;
      if (typeof callback !== 'function') throw new Error('[Overlay] presence binding requires enter/leave controls.');
      callback();
    } else if (!overlayKeepMounted) options.setPresent?.(value);
    reconcileOverlay(); projectModuleAttributes(); requestPresentation();
  }
  const overlay: NativeOverlay = {
    open: overlayOpen.handle,
    configure(config) { setup('overlay.configure'); overlayConfig = { ...overlayConfig, ...config }; if (config.defaultOpen !== undefined) overlayOpen.set(Boolean(config.defaultOpen)); },
    isOpen() { alive(); return overlayOpen.handle.get(); },
    openOverlay(reason) { runtime('overlay.openOverlay'); setOverlayOpen(true, reason); },
    close(reason) { runtime('overlay.close'); setOverlayOpen(false, reason); },
    toggle(reason) { runtime('overlay.toggle'); setOverlayOpen(!overlayOpen.handle.get(), reason); },
    updatePosition(config) { alive(); overlayConfig = { ...overlayConfig, ...config }; if (positionConnection) { positionConnection = { ...positionConnection, config: overlayPositionConfig() }; void positionNow(); } },
    registerTrigger(target) { alive(); overlayTrigger = target; boundaryRegions.set(overlayRegions.trigger, { target, config: { role: 'trigger' } }); reconcileOverlay(); },
    registerAnchor(target) { alive(); overlayAnchor = target; boundaryRegions.set(overlayRegions.anchor, { target, config: { role: 'anchor' } }); reconcileOverlay(); },
    registerAnchorPart(part) { alive(); overlayAnchor = part; boundaryRegions.set(overlayRegions.anchor, { target: part, config: { role: 'anchor' } }); reconcileOverlay(); },
    registerContent(target) { alive(); overlayContent = target; boundaryRegions.set(overlayRegions.content, { target, config: { role: 'content' } }); reconcileOverlay(); },
    getPositionSnapshot() { alive(); return positionSnapshot; },
    keepMounted() { setup('overlay.keepMounted'); if (overlayPresence) throw new Error('[Overlay] cannot keep mounted after binding Presence.'); overlayKeepMounted = true; },
    bindPresence(binding) {
      setup('overlay.bindPresence'); if (overlayPresence === binding) return; if (overlayPresence || overlayKeepMounted) throw new Error('[Overlay] presence already bound or keepMounted declared.'); overlayPresence = binding;
      const present = binding.present;
      const update = () => { if (!disposed && options.isAlive() && (options.isReady?.() ?? true)) options.invoke(() => options.setPresent?.(Boolean(readValue(present)))); };
      if (present && typeof present === 'object' && 'get' in present) {
        if (options.watchState) terminalCleanups.push(options.watchState(present as { get(): unknown }, update));
        else if ('watch' in present && typeof present.watch === 'function') terminalCleanups.push(present.watch(update));
        else throw new Error('[Overlay] Presence requires a watchable state handle.');
      }
    },
  };
  let transitionState: NativeStateCell<string>, transitionPresent: NativeStateCell<boolean>;
  let transition: NativeTransition | null = null;
  let appearDefault: NativeOwnedState<boolean>, enterDurationDefault: NativeOwnedState<number>, leaveDurationDefault: NativeOwnedState<number>, interruptDefault: NativeOwnedState<string>;
  let transitionTarget = false, transitionMounted = false, transitionDisposed = false;
  type TransitionIntent = 'enter' | 'leave';
  let queuedTransition: TransitionIntent | null = null, transitionGeneration = 0;
  let transitionTimer: number | undefined;
  function invalidateTransition() { ++transitionGeneration; root?.ownerDocument.defaultView?.clearTimeout(transitionTimer); transitionTimer = undefined; }
  function emitTransition(event: string) { if (!transitionDisposed && options.isAlive()) options.emit?.(event); }
  function setTransitionState(state: string) { if (transitionDisposed) return; transitionState.set(state); transitionPresent.set(state !== 'closed'); }
  function setViewPresent(present: boolean) { if (!transitionDisposed && options.isAlive()) options.setPresent?.(present); }
  function getTransitionInterrupt(): string {
    const value = options.isPropProvided!('interrupt') ? options.getResolvedProps().interrupt ?? interruptDefault.get() : interruptDefault.get();
    if (!['reverse','wait','immediate'].includes(String(value))) throw new Error('[Transition] interrupt must be reverse, wait, or immediate.');
    return String(value);
  }
  function getTransitionDuration(state: 'entering' | 'leaving'): number {
    if (options.getMeta?.('reducedMotion') === 'reduce') return 0;
    const key = state === 'entering' ? 'enterDuration' : 'leaveDuration';
    const fallback = state === 'entering' ? enterDurationDefault.get() : leaveDurationDefault.get();
    const value = Number(options.isPropProvided!(key) ? options.getResolvedProps()[key] ?? fallback : fallback);
    if (!Number.isFinite(value) || value < 0) throw new Error('[Transition] duration must be a finite nonnegative number.');
    return value;
  }
  function armTransitionCompletion(state: 'entering' | 'leaving') {
    invalidateTransition();
    const activeGeneration = transitionGeneration, epoch = generation;
    transitionTimer = root!.ownerDocument.defaultView!.setTimeout(() => {
      if (activeGeneration !== transitionGeneration || epoch !== generation || transitionDisposed || !ready() || !(options.isReady?.() ?? true) || transitionState.handle.get() !== state) return;
      transitionTimer = undefined; options.invoke(() => transitionComplete(true));
    }, getTransitionDuration(state));
  }
  function beginTransition(entering: boolean) {
    if (entering) { setViewPresent(true); if (!transitionMounted) return; }
    queuedTransition = null; emitTransition(entering ? 'beforeEnter' : 'beforeLeave'); setTransitionState(entering ? 'entering' : 'leaving');
    if (!ready()) return;
    armTransitionCompletion(entering ? 'entering' : 'leaving');
  }
  function consumeQueuedTransition() { const next = queuedTransition; queuedTransition = null; if (next === 'enter') beginTransitionIntent('enter'); else if (next === 'leave') beginLeaveIntent(); }
  function transitionComplete(consumeQueue = true) {
    const current = transitionState.handle.get(); if (current !== 'entering' && current !== 'leaving') return;
    invalidateTransition();
    if (current === 'entering') { setTransitionState('entered'); emitTransition('afterEnter'); }
    else { setTransitionState('closed'); emitTransition('afterLeave'); setViewPresent(false); }
    if (consumeQueue) consumeQueuedTransition();
  }
  function beginTransitionIntent(intent: TransitionIntent) {
    transitionTarget = true;
    const current = transitionState.handle.get();
    if (current === 'entered') return;
    if (current === 'closed') { beginTransition(true); return; }
    if (current === 'entering') { if (getTransitionInterrupt() === 'wait') queuedTransition = null; return; }
    if (getTransitionInterrupt() === 'wait') queuedTransition = intent;
    else if (getTransitionInterrupt() === 'immediate') { transitionComplete(false); beginTransition(true); }
    else { invalidateTransition(); beginTransition(true); }
  }
  function beginLeaveIntent() {
    transitionTarget = false;
    const current = transitionState.handle.get();
    if (current === 'closed') { setViewPresent(false); return; }
    if (current === 'leaving') { if (getTransitionInterrupt() === 'wait') queuedTransition = null; return; }
    if (current === 'entered') { beginTransition(false); return; }
    if (getTransitionInterrupt() === 'wait') queuedTransition = 'leave';
    else if (getTransitionInterrupt() === 'immediate') { transitionComplete(false); beginTransition(false); }
    else { invalidateTransition(); beginTransition(false); }
  }
  function setTransitionTarget(open: boolean) {
    if (open === transitionTarget) return;
    if (open) beginTransitionIntent('enter'); else beginLeaveIntent();
  }
  function initializeTransition(open: boolean, appear: boolean) {
    transitionTarget = open; queuedTransition = null; invalidateTransition();
    if (!open) { setTransitionState('closed'); setViewPresent(false); return; }
    setViewPresent(true); if (!appear) setTransitionState('entered');
  }
  function transitionViewMounted() { transitionMounted = true; if (transitionTarget && transitionState.handle.get() === 'closed') beginTransition(true); }
  function transitionViewUnmounted() { transitionMounted = false; invalidateTransition(); queuedTransition = null; if (transitionState.handle.get() !== 'closed') setTransitionState('closed'); }
  const transitionControls = {
    enter() { runtime('transition.enter'); beginTransitionIntent('enter'); },
    leave() { runtime('transition.leave'); beginLeaveIntent(); },
    complete() { runtime('transition.complete'); transitionComplete(); },
  };
  function borrow<T>(state: NativeOwnedState<T>): NativeBorrowedState<T> {
    return Object.freeze({ get: () => state.get(), set: (value: T, reason?: unknown) => state.set(value, reason), setDefault: (value: T) => state.setDefault(value),
      watch<R>(callback: (run: R, event: NativeStateEvent<T>) => void) { setup('state.watch'); if (!options.watchState) throw new Error('[State] borrowed watch requires owner state-watch facility.'); return options.watchState(state, (run, event) => callback(run as unknown as R, event)); } });
  }
  function declareTransition(): NativeTransition {
    if (transition) return transition;
    if (!options.declareTransition || !options.isPropProvided || !options.emit || !options.setPresent) throw new Error('[Transition] owner Props, lifecycle, Expose and presence facilities are required.');
    const state = owned('transitionState', 'closed' as string, { kind: 'enum', options: ['closed','entering','entered','leaving'] }), present = owned('isPresent', false as boolean);
    transitionState = { handle: state, set: value => writeOwned(state, value, 'transition.state') };
    transitionPresent = { handle: present, set: value => writeOwned(present, value, 'transition.presence') };
    appearDefault = owned('transitionAppearDefault', false as boolean); enterDurationDefault = owned('transitionEnterDurationDefault', 300 as number); leaveDurationDefault = owned('transitionLeaveDurationDefault', 200 as number);
    interruptDefault = owned('transitionInterruptDefault', 'reverse' as string, { kind: 'enum', options: ['reverse','wait','immediate'] });
    transition = { transitionState: borrow(state), isPresent: borrow(present), controls: transitionControls, ...transitionControls,
      configure(config) { setup('transition.configure'); if (config.appear !== undefined) appearDefault.setDefault(Boolean(config.appear)); if (config.enterDuration !== undefined) enterDurationDefault.setDefault(Number(config.enterDuration)); if (config.leaveDuration !== undefined) leaveDurationDefault.setDefault(Number(config.leaveDuration)); if (config.interrupt !== undefined) interruptDefault.setDefault(String(config.interrupt)); } };
    options.declareTransition({
      created() { const props = options.getResolvedProps(); initializeTransition(Boolean(options.isPropProvided!('open') ? props.open : props.defaultOpen), options.isPropProvided!('appear') ? Boolean(props.appear) : appearDefault.get()); },
      mounted: transitionViewMounted,
      unmounted: transitionViewUnmounted,
      beforeDispose() { transitionDisposed = true; transitionMounted = false; queuedTransition = null; invalidateTransition(); },
      propsChanged() { if (options.isPropProvided!('open')) setTransitionTarget(Boolean(options.getResolvedProps().open)); },
    });
    expose('transitionState', state); expose('isPresent', present); expose('enter', transitionControls.enter); expose('leave', transitionControls.leave); expose('complete', transitionControls.complete); expose('controls', Object.freeze(transitionControls));
    return transition;
  }
  let overlayInitialized = false;
  function reconcileLogicalState() {
    if (!(options.isReady?.() ?? true)) return;
    if (hooks.has('asOverlay') && !overlayInitialized) { overlayInitialized = true; options.invoke(() => { if (!overlayKeepMounted && !overlayPresence) options.setPresent?.(overlayOpen.handle.get()); }); }
  }
  function rootTag(): string | null { alive(); return textDeclaration ? textDeclaration.config.lineMode === 'single' ? 'input' : 'textarea' : imageDeclaration ? 'img' : null; }
  function adoptControlState(): void {
    alive(); if (root) throw new Error('[Modules] adopt control state before the first view mount.');
    const target = options.getRoot(); if (!target) throw new Error('[Modules] hydration requires the adopted physical Root.');
    if (target.id) hostIds.set(options.identity, target.id);
    if (textDeclared) {
      if (target.localName !== 'input' && target.localName !== 'textarea') throw new Error('[TextControl] adopted Root does not match the physical declaration.');
      textValue = canonicalText((target as HTMLInputElement | HTMLTextAreaElement).value);
    }
  }
  function rootProperties(): Readonly<Record<string, string | number | boolean | null>> {
    alive();
    const result: Record<string, string | number | boolean | null> = Object.create(null);
    if (textDeclaration) {
      if (textDeclaration.config.lineMode === 'single') result.type = 'text';
      result.value = textValue;
      for (const [key, value] of Object.entries(textPatch)) if (!['value','valueMode','defaultValue'].includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        if (key === 'minLength' || key === 'maxLength') result[key] = typeof value === 'number' && value >= 0 ? Math.trunc(value) : null;
        else if (key === 'rows') result[key] = Math.max(1, Math.trunc(Number(value)));
        else result[key] = value;
      }
    }
    if (imageDeclaration) { result.src = imageSource || null; result.alt = imagePatch.a11yMode === 'decorative' ? '' : String(imagePatch.alternativeText ?? ''); result.style = 'object-fit:' + imageFit; }
    return result;
  }
  function projectAttributes(): Readonly<Record<string, string | null>> {
    alive();
    refreshTable(!ready());
    const result: Record<string, string | null> = Object.create(null);
    if (typeof boundaryConfig.debugLabel === 'string') result['data-pui-boundary'] = boundaryConfig.debugLabel;
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
      const name = relationAttributes[kind], semantic = relationValue(relation);
      const baseline = options.getAttributeBaseline ? options.getAttributeBaseline(name) : attributeBaselines.has(name) ? attributeBaselines.get(name)!.baseline : root?.getAttribute(name);
      const value = relation.mode === 'append' && baseline ? [...new Set((baseline + ' ' + (semantic ?? '')).trim().split(/\s+/))].join(' ') : semantic;
      if (Object.hasOwn(result, name) && result[name] !== value) throw new Error('[A11y] conflicting relation ownership on a shared attribute.');
      result[name] = value;
    }
    if (owner.focusDeclared && focusConfig.navParticipation !== 'none') {
      const provider = ancestor(owner, candidate => candidate !== owner && candidate.rovingDeclared);
      if (provider) { const members = [...owners.values()].filter(candidate => candidate.focusDeclared && !candidate.focusConfig.disabled && ancestor(candidate, entry => entry !== candidate && entry.rovingDeclared) === provider).sort(hostOrder); const selected = members.find(candidate => candidate.active) ?? members.find(candidate => candidate.selected) ?? members[0]; result.tabindex = focusConfig.disabled || selected !== owner ? '-1' : '0'; }
    }
    if (hooks.has('asOverlay')) { result['data-pui-overlay-open'] = String(overlayOpen.handle.get()); if (overlayConfig.modal) result['aria-modal'] = String(overlayOpen.handle.get()); if (overlayKeepMounted) { result['data-pui-view-detached'] = overlayOpen.handle.get() ? null : ''; if (!overlayOpen.handle.get()) { result.hidden = ''; result['aria-hidden'] = 'true'; } } }
    if (hooks.has('asTransition')) result['data-pui-transition-state'] = transitionState.handle.get();
    if (hooks.has('asHitParticipation')) result['data-pui-hit-participation'] = String(hitConfig.mode);
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
    reconcileLogicalState();
    refreshTable(false);
    if (!ready()) { requestPresentation(); return; }
    projectModuleAttributes(); projectHit(); applyText(); applyImage(); reconcileOverlay();
    if (owner.scopeDeclared) { const focused = root!.ownerDocument.activeElement; hasFocused.set(!!focused && contains(root!, focused)); scopeActive.set(owner.scopeActive); }
    if (owner.rovingDeclared) { const focused = root!.ownerDocument.activeElement; const members = focusCandidates(true); rovingHasFocused.set(members.some(member => member.target() === focused)); rovingActive.set(members.some(member => member.active)); }
    if (pendingFocus) { const request = pendingFocus; pendingFocus = null; requestFocus(request); }
    if (pendingNavigation) { const request = pendingNavigation; pendingNavigation = null; navigate(request.operation, request.options); }
    requestPresentation();
  }
  function portalTarget(): HTMLElement | null { return ready() && hooks.has('asOverlay') && overlayConfig.portal && overlayOpen.handle.get() ? root!.ownerDocument.body : null; }
  function unmount() {
    const previous = root;
    ++generation; ++imageGeneration;
    invalidateTransition(); stopPosition(); unlockModal();
    root = null;
    if (table) { tableSignature = null; clearTable(); }
    if (previous && targets.get(previous) === owner) targets.delete(previous);
    const failures: unknown[] = [];
    for (const cleanup of cleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
    for (const cleanup of chromeCleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
    for (const target of [...hitApplied]) releaseHit(target);
    if (previous) {
      const stack = boundaryStacks.get(previous.ownerDocument); const index = stack?.indexOf(owner) ?? -1; if (index >= 0) stack!.splice(index, 1);
      previous.ownerDocument.defaultView?.clearTimeout(scrollTimer); scrollTimer = undefined;
      if (scrollEndFrame !== null) previous.ownerDocument.defaultView?.cancelAnimationFrame(scrollEndFrame); scrollEndFrame = null;
      for (const [name, ownership] of attributeBaselines) if (previous.getAttribute(name) === ownership.projected) { if (ownership.baseline === null) previous.removeAttribute(name); else previous.setAttribute(name, ownership.baseline); }
      for (const [name, ownership] of propertyBaselines) if (previous.style.getPropertyValue(name) === ownership.projected) { if (ownership.value) previous.style.setProperty(name, ownership.value); else previous.style.removeProperty(name); }
    }
    attributeBaselines.clear(); propertyBaselines.clear();
    for (const [target, snapshot] of positionBaselines) { target.style.position = snapshot.position; target.style.left = snapshot.left; target.style.top = snapshot.top; for (const [name, value] of snapshot.variables) { if (value) target.style.setProperty(name, value); else target.style.removeProperty(name); } if (snapshot.side === null) target.removeAttribute('data-side'); else target.setAttribute('data-side', snapshot.side); if (snapshot.align === null) target.removeAttribute('data-align'); else target.setAttribute('data-align', snapshot.align); }
    positionBaselines.clear();
    for (const [target, snapshot] of chromeTargets) { target.style.width = snapshot.width; target.style.height = snapshot.height; target.style.transform = snapshot.transform; target.style.display = snapshot.display; if (snapshot.size) target.style.setProperty('--proto-ui-scroll-thumb-size', snapshot.size); else target.style.removeProperty('--proto-ui-scroll-thumb-size'); if (snapshot.offset) target.style.setProperty('--proto-ui-scroll-thumb-offset', snapshot.offset); else target.style.removeProperty('--proto-ui-scroll-thumb-offset'); }
    chromeTargets.clear(); readerContacts = 0; textComposing = false; overlayMaterialized = false;
    if (previous) {
      if (options.isAlive() && (options.isReady?.() ?? true)) {
        options.invoke(() => { hasFocused.set(false); rovingHasFocused.set(false); scrolling.set(false); });
      }
      announceTopology();
    }
    if (failures.length) throw new AggregateError(failures, '[Modules] view cleanup failed.');
  }
  function mount() {
    alive(); const candidate = options.getRoot(); if (root === candidate && ready()) { refresh(); return; }
    unmount(); root = candidate;
    if (!root) return;
    targets.set(root, owner);
    if (root.id) hostIds.set(options.identity, root.id);
    try {
      const doc = root.ownerDocument;
      listen(doc, 'focusin', () => { if (owner.rovingDeclared) { const active = doc.activeElement; for (const member of focusCandidates(true)) { member.active = member.target() === active; if (rovingConfig.selectOnFocus && member.active) member.selected = true; } } refresh(); });
      listen(root, 'keydown', native => {
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
      listen(doc, 'pointerdown', native => {
        const sample = Object.freeze({ type: 'pointer.press', target: native.target, nativeEvent: native });
        if (boundaryObserved) notifyOutside(sample);
        if (hooks.has('asOverlay') && overlayOpen.handle.get()) {
          const stack = boundaryStacks.get(doc) ?? [], selected = boundarySampleOwners.has(native) ? boundarySampleOwners.get(native) : stack[stack.length - 1];
          if (!boundarySampleOwners.has(native)) boundarySampleOwners.set(native, selected ?? null);
          if (selected === owner && overlayConfig.closeOnOutsidePress && classify(sample) === 'outside') options.invoke(() => setOverlayOpen(false, 'outside.press'));
          else if (selected === owner && (overlayConfig.closeOnTriggerPress && targetOf(overlayTrigger)?.contains(native.target as Node) || overlayConfig.closeOnAnchorPress && targetOf(overlayAnchor)?.contains(native.target as Node))) options.invoke(() => setOverlayOpen(false, 'trigger.press'));
        }
      }, { capture: true });
      listen(doc, 'keydown', native => { const event = native as KeyboardEvent; if (event.key !== 'Escape' || !overlayOpen.handle.get() || !overlayConfig.closeOnEscape) return; const stack = boundaryStacks.get(doc) ?? []; if (stack[stack.length - 1] !== owner) return; options.invoke(() => setOverlayOpen(false, 'escape')); event.preventDefault(); }, { capture: true });
      listen(doc, 'focusin', native => { if (overlayOpen.handle.get() && overlayConfig.closeOnFocusOutside && classify({ target: native.target, nativeEvent: native }) === 'outside') options.invoke(() => setOverlayOpen(false, 'focus.outside')); });
      attachText(); applyImage(true); attachScroll(); attachPosition();
      reconcileStack(); refresh(); announceTopology();
      if (typeof MutationObserver !== 'undefined' && (claims.size || owner.scopeDeclared || owner.rovingDeclared || scrollChrome)) { const mutation = new MutationObserver(records => { if (!records.some(record => record.type === 'childList')) return; announceTopology(); if (scrollChrome) attachChrome(); }); mutation.observe(root, { childList: true, subtree: true }); cleanups.push(() => mutation.disconnect()); }
    } catch (error) { try { unmount(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[Modules] mount and cleanup failed.'); } throw error; }
  }
  const registeredFacts = new Set<object>();
  function registerFacts<T extends boolean | string | number>(state: NativeObserved<T>) { if (registeredFacts.has(state)) return; registeredFacts.add(state); options.registerObservedState?.(state); }
  const capabilities: NativeModuleCapabilities<Run> = {
    anatomy, accessible, positioning,
    asFocusEntry() { declare('asFocusEntry'); owner.entryDeclared = true; return entry; },
    asFocusScope() { declare('asFocusScope'); owner.scopeDeclared = true; registerFacts(scope.active); registerFacts(scope.hasFocused); return scope; },
    asFocusRoving() { declare('asFocusRoving'); owner.rovingDeclared = true; registerFacts(roving.active); registerFacts(roving.hasFocused); return roving; },
    asCollection() { declare('asCollection'); return declareCollection(); }, asCollectionItem() { declare('asCollectionItem'); return declareCollectionItem(); },
    asBoundary() { declare('asBoundary'); return boundary; }, asHitParticipation() { declare('asHitParticipation'); return hit; },
    asOverlay() { declare('asOverlay'); registerFacts(overlay.open); return overlay; },
    asScrollSurface() { declare('asScrollSurface'); registerFacts(scroll.axes); registerFacts(scroll.scrolling); registerFacts(scroll.projection); registerFacts(scroll.endFollow.state); registerFacts(scroll.endFollow.requestStatus); for (const axis of [scroll.horizontal, scroll.vertical]) { registerFacts(axis.position); registerFacts(axis.visibleRatio); registerFacts(axis.canScrollBefore); registerFacts(axis.canScrollAfter); registerFacts(axis.atEnd); } return scroll; },
    asTextControl() { declare('asTextControl'); if (!textDeclaration) throw new Error('[TextControl] asTextControl requires its static physical declaration.'); textDeclared = true; return textControl; },
    asImageView() { declare('asImageView'); if (!imageDeclaration) throw new Error('[ImageView] asImageView requires its static physical declaration.'); imageDeclared = true; return imageView; },
    asTableStructure(role) { declare('asTableStructure'); return declareTable(role); },
    asTransition() { declare('asTransition'); return declareTransition(); },
    configureFocusable(config) { setup('focus.configure'); owner.focusDeclared = true; hooks.add('asFocusable'); Object.assign(focusConfig, config); },
    setFocusDisabled(value) { runtime('focus.setDisabled'); focusConfig.disabled = value; if (value) pendingFocus = null; announceTopology(); },
    setNavParticipation(value) { runtime('focus.setNavParticipation'); if (!['auto','none'].includes(value)) throw new Error('[Focus] invalid navigation participation.'); focusConfig.navParticipation = value; refresh(); },
    setRovingStatus(status) { runtime('focus.setRovingStatus'); if (status.selected !== undefined) owner.selected = Boolean(status.selected); if (status.active !== undefined) owner.active = Boolean(status.active); refresh(); },
    canFocus,
    focus(request) { runtime('focus.focus'); requestFocus(request); },
    blur() { runtime('focus.blur'); pendingFocus = null; if (ready()) root!.blur(); },
    rootTag, rootProperties, projectAttributes, portalTarget, adoptControlState, refresh, mount, unmount,
    dispose() {
      if (disposed) return;
      transitionDisposed = true; transitionMounted = false; queuedTransition = null;
      const rootOwner = logicalRoot(owner);
      const failures: unknown[] = [];
      try { unmount(); } catch (error) { failures.push(error); }
      disposed = true; owners.delete(options.identity); tableRecords.delete(owner); claims.clear(); hooks.clear(); topologySubscribers.clear(); outsideListeners.clear(); boundaryRegions.clear(); hitRegions.clear(); textListeners.clear(); imageListeners.clear();
      const scopeIndex = activeScopes.indexOf(owner); if (scopeIndex >= 0) activeScopes.splice(scopeIndex, 1);
      for (const off of accessibleSubscriptions.values()) try { off(); } catch (error) { failures.push(error); }
      accessibleSubscriptions.clear();
      for (const cleanup of terminalCleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
      anatomyVersions.clear(); announceTopology(rootOwner);
      if (failures.length) throw new AggregateError(failures, '[Modules] terminal cleanup failed.');
    },
  };
  owners.set(options.identity, owner);
  return capabilities;
}
`,
};
