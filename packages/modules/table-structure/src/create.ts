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
      this.clearProjection();
      this.notifyRoot();
    }
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.release();
  }

  dispose(): void {
    this.release();
  }

  private release(): void {
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
    if (!this.role) return;
    const next = this.anatomy.resolveDomainScope(TABLE_STRUCTURE_FAMILY);
    const previous = this.domainScope;
    const previousRoot = previous === null ? null : rootsByDomain.get(previous);
    if (!Object.is(next, previous)) {
      if (previous !== null && rootsByDomain.get(previous) === this) {
        rootsByDomain.delete(previous);
      }
      this.clearProjection();
      this.domainScope = next;
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

    for (const { impl } of domainRecords) impl.clearProjection();
    const next = projectTableStructure({
      root: this.a11y.getObjectRef(),
      captions: captions.map(({ impl }) => impl.a11y.getObjectRef()),
      rows,
      unmatchedCells,
      roleMismatches: roleMismatches.map(({ impl }) => impl.a11y.getObjectRef()),
    });
    this.snapshot = next;
    this.applyTable(next);
    if (!next.valid) return;

    const byRef = new Map(records.map(({ impl }) => [impl.a11y.getObjectRef(), impl]));
    if (next.caption) byRef.get(next.caption)?.applyCaption();
    for (const row of next.rows) {
      byRef.get(row.ref)?.applyRow(row.index);
      for (const cell of row.cells) byRef.get(cell.ref)?.applyCell(cell);
    }
  }

  private clearProjection(): void {
    if (this.role === null) return;
    this.applyRow(null);
    this.applyCell(null);
    if (this.role === 'root') this.applyTable(null);
  }

  private applyTable(snapshot: TableStructureSnapshot | null): void {
    const valid = snapshot?.valid === true;
    this.state.set(this.states.a11yRole, valid ? 'table' : '', 'table.structure');
    this.state.set(this.states.rowCount, valid ? snapshot.rowCount : 0, 'table.structure');
    this.state.set(this.states.columnCount, valid ? snapshot.columnCount : 0, 'table.structure');
    this.a11y.setRelation('caption', {
      target: valid && snapshot.caption ? [snapshot.caption] : [],
    });
    this.a11y.setRelation('labelledBy', {
      target: valid && snapshot.caption ? [snapshot.caption] : [],
    });
  }

  private applyCaption(): void {
    this.state.set(this.states.a11yRole, 'caption', 'table.structure');
  }

  private applyRow(index: number | null): void {
    this.state.set(this.states.a11yRole, index === null ? '' : 'row', 'table.structure');
    this.state.set(this.states.row, index === null ? 0 : index + 1, 'table.structure');
  }

  private applyCell(snapshot: TableStructureCellSnapshot | null): void {
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
    this.state.set(this.states.row, snapshot ? snapshot.row + 1 : 0, 'table.structure');
    this.state.set(this.states.column, snapshot ? snapshot.column + 1 : 0, 'table.structure');
    this.state.set(this.states.rowSpan, snapshot?.rowSpan ?? 0, 'table.structure');
    this.state.set(this.states.columnSpan, snapshot?.columnSpan ?? 0, 'table.structure');
    this.a11y.setRelation('columnHeaders', { target: snapshot?.columnHeaders ?? [] });
    this.a11y.setRelation('rowHeaders', { target: snapshot?.rowHeaders ?? [] });
    const labels = snapshot?.orderedHeaders ?? [];
    this.a11y.setRelation('labelledBy', {
      target: snapshot && labels.length > 0 ? [...labels, snapshot.ref] : [],
    });
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
