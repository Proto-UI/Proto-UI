import type { AnatomyPartView, MountPhase, ProtoPhase } from '@proto.ui/core';
import {
  createModule,
  defineModule,
  ModuleBase,
  type ModuleFactoryArgs,
} from '@proto.ui/module-base';
import type { A11yPort } from '@proto.ui/module-a11y';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
import { projectTableStructure, type TableStructureCellInput } from './projection';
import { TABLE_STRUCTURE_FAMILY } from './family';
import type {
  TablePartConfig,
  TablePartRole,
  TableStructureCellSnapshot,
  TableStructureFacade,
  TableStructureHandle,
  TableStructureModule,
  TableStructurePort,
  TableStructureSnapshot,
  TableStructureStateHandles,
} from './types';

const rootsByDomain = new Map<unknown, TableStructureModuleImpl>();
const partsByInstance = new Map<unknown, TableStructureModuleImpl>();

export class TableStructureModuleImpl extends ModuleBase {
  private role: TablePartRole | null = null;
  private config: TablePartConfig = Object.freeze({});
  private snapshot: TableStructureSnapshot | null = null;
  private domainScope: unknown | null = null;
  private stopOrder: (() => void) | null = null;
  private stopTargets: (() => void) | null = null;
  private readonly states: TableStructureStateHandles;
  private instanceIdentity: unknown | null = null;
  private recomputeRevision = 0;
  private membershipRevision = 0;
  private projectionRevision = 0;
  private projecting = false;
  private pendingProjection: ((current: () => boolean) => void) | null = null;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly anatomy: AnatomyPort,
    private readonly a11y: A11yPort,
    private readonly state: StatePort,
    stateFacade: StateFacade
  ) {
    super(caps);
    this.states = Object.freeze({
      a11yRole: stateFacade.string('tableA11yRole', ''),
      rowCount: stateFacade.numberDiscrete('tableRowCount', 0),
      columnCount: stateFacade.numberDiscrete('tableColumnCount', 0),
      row: stateFacade.numberDiscrete('tableRow', -1),
      column: stateFacade.numberDiscrete('tableColumn', -1),
      rowSpan: stateFacade.numberDiscrete('tableRowSpan', 0),
      columnSpan: stateFacade.numberDiscrete('tableColumnSpan', 0),
    });
  }

  readonly facade: TableStructureFacade = { declare: (role) => this.declare(role) };
  readonly port: TableStructurePort = { getSnapshot: () => this.snapshot };

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.bindDomain();
      this.notifyRoot();
      return;
    }
    if (phase === 'unmounting' || phase === 'detached') {
      // Only a Table part has a projection of its own to clear. Any other
      // instance's relations are its Prototype's.
      if (this.role) this.clearProjection();
      this.notifyRoot();
    }
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (
      phase === 'updated' &&
      this.role &&
      !Object.is(this.domainScope, this.anatomy.resolveDomainScope(TABLE_STRUCTURE_FAMILY))
    ) {
      // A retained renderer can reparent the logical owner without another
      // mount epoch. Revoke the old domain before publishing its new facts.
      this.notifyRoot();
    }
    if (phase === 'unmounted') this.release();
  }

  dispose(): void {
    this.release();
  }

  private release(): void {
    this.recomputeRevision++;
    this.membershipRevision++;
    this.projectionRevision++;
    this.pendingProjection = null;
    const oldRoot = this.domainScope === null ? null : rootsByDomain.get(this.domainScope);
    this.stopOrder?.();
    this.stopOrder = null;
    this.stopTargets?.();
    this.stopTargets = null;
    if (this.domainScope !== null && rootsByDomain.get(this.domainScope) === this) {
      rootsByDomain.delete(this.domainScope);
    }
    if (this.instanceIdentity !== null) partsByInstance.delete(this.instanceIdentity);
    this.domainScope = null;
    if (oldRoot && oldRoot !== this) oldRoot.recompute();
  }

  private declare(role: TablePartRole): TableStructureHandle {
    if (this.role && this.role !== role) {
      throw new Error(
        `[TableStructure] part role already declared as ${this.role}; received ${role}.`
      );
    }
    if (this.instanceIdentity === null) {
      this.instanceIdentity = this.anatomy.resolveSelfInstance();
      partsByInstance.set(this.instanceIdentity, this);
    }
    this.role = role;
    if (role === 'root' && !this.stopOrder) {
      this.stopOrder = this.anatomy.subscribeOrder(TABLE_STRUCTURE_FAMILY, () => {
        if (this.mountPhase === 'mounted') this.notifyRoot();
      });
    }
    if (role === 'root' && !this.stopTargets) {
      this.stopTargets = this.anatomy.subscribeTargets(TABLE_STRUCTURE_FAMILY, () => {
        if (this.mountPhase === 'mounted') this.notifyRoot();
      });
    }
    return Object.freeze({
      role,
      states: this.states,
      configure: (patch) => this.configure(patch),
      getObjectRef: () => this.a11y.getObjectRef(),
      getSnapshot: () => this.snapshot,
    });
  }

  private configure(patch: TablePartConfig): void {
    this.config = Object.freeze({
      ...this.config,
      ...patch,
      ...(patch.headers ? { headers: Object.freeze([...patch.headers]) } : {}),
    });
    this.bindDomain();
    this.notifyRoot();
  }

  private bindDomain(): void {
    if (!this.role || partsByInstance.get(this.instanceIdentity) !== this) return;
    const next = this.anatomy.resolveDomainScope(TABLE_STRUCTURE_FAMILY);
    const previous = this.domainScope;
    const previousRoot = previous === null ? null : rootsByDomain.get(previous);
    if (!Object.is(next, previous)) {
      if (previous !== null && rootsByDomain.get(previous) === this) {
        rootsByDomain.delete(previous);
      }
      this.domainScope = next;
      const revision = ++this.membershipRevision;
      this.clearProjection();
      // Cleanup can call a host callback which rebinds this retained part again.
      // The original old root still needs a current-inventory refresh.
      if (
        revision !== this.membershipRevision ||
        !Object.is(this.anatomy.resolveDomainScope(TABLE_STRUCTURE_FAMILY), next)
      ) {
        // A retained renderer may defer its next updated phase while a host
        // callback moves the part again. Re-read its actual logical ancestry.
        this.bindDomain();
        if (previousRoot && previousRoot !== this) previousRoot.recompute();
        return;
      }
    }
    if (next !== null) {
      const registered = rootsByDomain.get(next);
      const ownsRoot =
        this.role === 'root' && this.anatomy.resolveSelfRole(TABLE_STRUCTURE_FAMILY) === 'root';
      if (ownsRoot && !registered) rootsByDomain.set(next, this);
      else if (!ownsRoot && registered === this) rootsByDomain.delete(next);
    }
    if (!Object.is(next, previous) && previousRoot && previousRoot !== this) {
      previousRoot.recompute();
    }
  }

  private notifyRoot(): void {
    this.bindDomain();
    if (this.domainScope !== null) rootsByDomain.get(this.domainScope)?.recompute();
  }

  private readPart(part: AnatomyPartView): TableStructureModuleImpl | null {
    const identity = this.anatomy.resolvePartInstance(part);
    return identity === null ? null : (partsByInstance.get(identity) ?? null);
  }

  private recompute(): void {
    if (
      this.role !== 'root' ||
      this.mountPhase !== 'mounted' ||
      this.domainScope === null ||
      rootsByDomain.get(this.domainScope) !== this
    )
      return;
    const revision = ++this.recomputeRevision;
    const domain = this.domainScope;
    const current = () =>
      this.recomputeRevision === revision &&
      this.mountPhase === 'mounted' &&
      Object.is(this.domainScope, domain) &&
      rootsByDomain.get(domain) === this;
    const memberCurrent = (impl: TableStructureModuleImpl) => () =>
      current() &&
      Object.is(impl.domainScope, domain) &&
      Object.is(impl.anatomy.resolveDomainScope(TABLE_STRUCTURE_FAMILY), domain) &&
      partsByInstance.get(impl.instanceIdentity) === impl;
    const ordered = this.anatomy.order.parts(TABLE_STRUCTURE_FAMILY);
    const domainRecords = ordered
      .map((part) => ({ part, impl: this.readPart(part) }))
      .filter(
        (entry): entry is { part: AnatomyPartView; impl: TableStructureModuleImpl } =>
          entry.impl !== null && Object.is(entry.impl.domainScope, this.domainScope)
      );
    const roleMismatches = domainRecords.filter(({ part, impl }) => part.role !== impl.role);
    const records = domainRecords.filter(({ part, impl }) => part.role === impl.role);
    const captions = records.filter((entry) => entry.impl.role === 'caption');
    const rowRecords = records.filter((entry) => entry.impl.role === 'row');
    const cells = records.filter(
      (entry) => entry.impl.role === 'headerCell' || entry.impl.role === 'cell'
    );
    const rowIndexByIdentity = new Map<unknown, number>();
    const rows = rowRecords.map(({ part, impl }, index) => {
      const identity = this.anatomy.resolvePartInstance(part);
      if (identity !== null) rowIndexByIdentity.set(identity, index);
      return { ref: impl.a11y.getObjectRef(), cells: [] as TableStructureCellInput[] };
    });
    const unmatchedCells: ReturnType<A11yPort['getObjectRef']>[] = [];
    for (const { part, impl: cell } of cells) {
      const rowIdentity = this.anatomy.resolveAncestorInstance(TABLE_STRUCTURE_FAMILY, part, 'row');
      const rowIndex = rowIdentity === null ? undefined : rowIndexByIdentity.get(rowIdentity);
      if (rowIndex === undefined) {
        unmatchedCells.push(cell.a11y.getObjectRef());
        continue;
      }
      rows[rowIndex]!.cells.push({
        ref: cell.a11y.getObjectRef(),
        kind: cell.role === 'headerCell' ? 'headerCell' : 'cell',
        headerKey: cell.config.headerKey,
        headerKind: cell.config.headerKind,
        headers: cell.config.headers ?? [],
        rowSpan: cell.config.rowSpan,
        columnSpan: cell.config.columnSpan,
      });
    }

    const next = projectTableStructure({
      root: this.a11y.getObjectRef(),
      captions: captions.map(({ impl }) => impl.a11y.getObjectRef()),
      rows,
      unmatchedCells,
      roleMismatches: roleMismatches.map(({ impl }) => impl.a11y.getObjectRef()),
    });
    // Valid topology updates its current facts directly. Withdrawing every
    // part first emits false invalid states on ordinary target notifications.
    // Invalid topology still clears the whole previous semantic projection.
    if (!current()) return;
    this.snapshot = next;
    if (!next.valid) {
      for (const { impl } of domainRecords) {
        if (!current()) return;
        impl.clearProjection(memberCurrent(impl));
      }
    }
    if (!current()) return;
    this.applyTable(next, current);
    if (!next.valid || !current()) return;

    const byRef = new Map(records.map(({ impl }) => [impl.a11y.getObjectRef(), impl]));
    const caption = next.caption ? byRef.get(next.caption) : undefined;
    caption?.applyCaption(true, memberCurrent(caption));
    for (const row of next.rows) {
      if (!current()) return;
      const rowImpl = byRef.get(row.ref);
      rowImpl?.applyRow(row.index, memberCurrent(rowImpl));
      for (const cell of row.cells) {
        if (!current()) return;
        const cellImpl = byRef.get(cell.ref);
        cellImpl?.applyCell(cell, memberCurrent(cellImpl));
      }
    }
  }

  /** Serialize writes for one part, including reentry from synchronous host
   * attribute callbacks. A newer projection invalidates the old continuation;
   * it runs only after the current external setter has completely returned. */
  private project(write: (current: () => boolean) => void, live: () => boolean): void {
    if (!live()) return;
    this.projectionRevision++;
    this.pendingProjection = (current) => write(() => current() && live());
    if (this.projecting) return;
    this.projecting = true;
    try {
      while (this.pendingProjection) {
        const next = this.pendingProjection;
        const revision = this.projectionRevision;
        this.pendingProjection = null;
        next(() => this.projectionRevision === revision);
      }
    } finally {
      this.projecting = false;
    }
  }

  private clearProjection(live: () => boolean = () => true): void {
    if (this.role === null) return;
    this.project((current) => {
      const set = (handle: Parameters<StatePort['set']>[0], value: string | number) => {
        if (current()) this.state.set(handle, value, 'table.structure');
      };
      set(this.states.a11yRole, '');
      set(this.states.row, 0);
      set(this.states.column, 0);
      set(this.states.rowSpan, 0);
      set(this.states.columnSpan, 0);
      for (const key of ['columnHeaders', 'rowHeaders', 'labelledBy'] as const) {
        if (current()) this.a11y.setRelation(key, { target: [] });
      }
      if (this.role === 'root') {
        set(this.states.rowCount, 0);
        set(this.states.columnCount, 0);
        if (current()) this.a11y.setRelation('caption', { target: [] });
      }
    }, live);
  }

  private applyTable(snapshot: TableStructureSnapshot | null, live: () => boolean): void {
    const valid = snapshot?.valid === true;
    this.project((current) => {
      if (current()) this.state.set(this.states.a11yRole, valid ? 'table' : '', 'table.structure');
      if (current())
        this.state.set(this.states.rowCount, valid ? snapshot.rowCount : 0, 'table.structure');
      if (current())
        this.state.set(
          this.states.columnCount,
          valid ? snapshot.columnCount : 0,
          'table.structure'
        );
      if (current())
        this.a11y.setRelation('caption', {
          target: valid && snapshot.caption ? [snapshot.caption] : [],
        });
      if (current())
        this.a11y.setRelation('labelledBy', {
          target: valid && snapshot.caption ? [snapshot.caption] : [],
        });
    }, live);
  }

  private applyCaption(active: boolean, live: () => boolean): void {
    this.project((current) => {
      if (current())
        this.state.set(this.states.a11yRole, active ? 'caption' : '', 'table.structure');
    }, live);
  }

  private applyRow(index: number | null, live: () => boolean): void {
    this.project((current) => {
      if (current())
        this.state.set(this.states.a11yRole, index === null ? '' : 'row', 'table.structure');
      if (current())
        this.state.set(this.states.row, index === null ? 0 : index + 1, 'table.structure');
    }, live);
  }

  private applyCell(snapshot: TableStructureCellSnapshot | null, live: () => boolean): void {
    this.project((current) => {
      if (current())
        this.state.set(
          this.states.a11yRole,
          snapshot
            ? snapshot.kind === 'column-header'
              ? 'columnheader'
              : snapshot.kind === 'row-header'
                ? 'rowheader'
                : 'cell'
            : '',
          'table.structure'
        );
      if (current())
        this.state.set(this.states.row, snapshot ? snapshot.row + 1 : 0, 'table.structure');
      if (current())
        this.state.set(this.states.column, snapshot ? snapshot.column + 1 : 0, 'table.structure');
      if (current()) this.state.set(this.states.rowSpan, snapshot?.rowSpan ?? 0, 'table.structure');
      if (current())
        this.state.set(this.states.columnSpan, snapshot?.columnSpan ?? 0, 'table.structure');
      if (current())
        this.a11y.setRelation('columnHeaders', { target: snapshot?.columnHeaders ?? [] });
      if (current()) this.a11y.setRelation('rowHeaders', { target: snapshot?.rowHeaders ?? [] });
      const labels = snapshot?.orderedHeaders ?? [];
      if (current())
        this.a11y.setRelation('labelledBy', {
          target: snapshot && labels.length > 0 ? [...labels, snapshot.ref] : [],
        });
    }, live);
  }
}

export function createTableStructureModule(ctx: ModuleFactoryArgs): TableStructureModule {
  const { init, caps, deps } = ctx;
  return createModule<'table-structure', 'instance', TableStructureFacade, TableStructurePort>({
    name: 'table-structure',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps, deps }) => {
      const impl = new TableStructureModuleImpl(
        caps,
        deps.requirePort<AnatomyPort>('anatomy'),
        deps.requirePort<A11yPort>('a11y'),
        deps.requirePort<StatePort>('state'),
        deps.requireFacade<StateFacade>('state')
      );
      return {
        facade: impl.facade,
        port: impl.port,
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          onProtoPhase: (phase) => impl.onProtoPhase(phase),
          dispose: () => impl.dispose(),
        },
      };
    },
  }) as TableStructureModule;
}

export const TableStructureModuleDef = defineModule({
  name: 'table-structure',
  resourceOwnership: 'mixed',
  deps: ['anatomy', 'a11y', 'state'],
  create: createTableStructureModule,
});
