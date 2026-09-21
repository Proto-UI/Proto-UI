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
import { TABLE_STRUCTURE_FAMILY, TABLE_STRUCTURE_PART_EXPOSE } from './family';
import type {
  TablePartConfig,
  TablePartRole,
  TableStructureCellSnapshot,
  TableStructureFacade,
  TableStructureHandle,
  TableStructureModule,
  TableStructurePartBridge,
  TableStructurePort,
  TableStructureSnapshot,
  TableStructureStateHandles,
} from './types';

const rootsByDomain = new Map<unknown, TableStructureModuleImpl>();

export class TableStructureModuleImpl extends ModuleBase {
  private role: TablePartRole | null = null;
  private config: TablePartConfig = Object.freeze({});
  private stopTargets: (() => void) | null = null;
  private snapshot: TableStructureSnapshot | null = null;
  private domainScope: unknown | null = null;
  private stopOrder: (() => void) | null = null;
  private readonly states: TableStructureStateHandles;
  private readonly bridge: TableStructurePartBridge;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly anatomy: AnatomyPort,
    private readonly a11y: A11yPort,
    private readonly state: StatePort,
    stateFacade: StateFacade
  ) {
    super(caps);
    this.states = Object.freeze({
      rowCount: stateFacade.numberDiscrete('tableRowCount', 0),
      columnCount: stateFacade.numberDiscrete('tableColumnCount', 0),
      row: stateFacade.numberDiscrete('tableRow', -1),
      column: stateFacade.numberDiscrete('tableColumn', -1),
      rowSpan: stateFacade.numberDiscrete('tableRowSpan', 0),
      columnSpan: stateFacade.numberDiscrete('tableColumnSpan', 0),
    });
    const impl = this;
    this.bridge = Object.freeze({
      get role() {
        if (!impl.role) throw new Error('[TableStructure] part role has not been declared.');
        return impl.role;
      },
      ref: this.a11y.getObjectRef(),
      readConfig: () => this.config,
      applyRow: (index) => this.applyRow(index),
      applyCell: (snapshot) => this.applyCell(snapshot),
      applyTable: (snapshot) => this.applyTable(snapshot),
    });
  }
  readonly facade: TableStructureFacade = {
    declare: (role) => this.declare(role),
  };

  readonly port: TableStructurePort = {
    getSnapshot: () => this.snapshot,
  };

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.bindDomain();
      this.notifyRoot();
      return;
    }
    if (phase === 'unmounting' || phase === 'detached') this.notifyRoot();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.stopOrder?.();
    this.stopOrder = null;
    if (this.role === 'root' && this.domainScope !== null) rootsByDomain.delete(this.domainScope);
    this.stopTargets?.();
    this.stopTargets = null;
    this.notifyRoot();
    this.domainScope = null;
  }

  dispose(): void {
    this.stopOrder?.();
    this.stopOrder = null;
    this.stopTargets?.();
    this.stopTargets = null;
    if (this.role === 'root' && this.domainScope !== null) rootsByDomain.delete(this.domainScope);
    this.domainScope = null;
  }

  private declare(role: TablePartRole): TableStructureHandle {
    if (this.role && this.role !== role) {
      throw new Error(
        `[TableStructure] part role already declared as ${this.role}; received ${role}.`
      );
    }
    this.role = role;
    if (role === 'root' && !this.stopOrder) {
      this.stopOrder = this.anatomy.subscribeOrder(TABLE_STRUCTURE_FAMILY, () => this.recompute());
    }
    if (role === 'root' && !this.stopTargets) {
      this.stopTargets = this.anatomy.subscribeTargets(TABLE_STRUCTURE_FAMILY, () =>
        this.recompute()
      );
    }
    return Object.freeze({
      role,
      states: this.states,
      configure: (patch) => this.configure(patch),
      getObjectRef: () => this.a11y.getObjectRef(),
      getSnapshot: () => this.snapshot,
      getPartBridge: () => this.bridge,
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
    if (Object.is(next, this.domainScope)) return;
    if (this.role === 'root' && this.domainScope !== null) rootsByDomain.delete(this.domainScope);
    this.domainScope = next;
    if (this.role === 'root' && next !== null) rootsByDomain.set(next, this);
  }

  private notifyRoot(): void {
    this.bindDomain();
    if (this.role === 'root') this.recompute();
    else if (this.domainScope !== null) rootsByDomain.get(this.domainScope)?.recompute();
  }

  private readBridge(part: AnatomyPartView): TableStructurePartBridge | null {
    const exposed = part.getExpose(TABLE_STRUCTURE_PART_EXPOSE);
    return exposed && typeof exposed === 'object' && 'readConfig' in exposed
      ? (exposed as TableStructurePartBridge)
      : null;
  }

  private recompute(): void {
    if (this.role !== 'root' || this.mountPhase !== 'mounted') return;
    const ordered = this.anatomy.order.parts(TABLE_STRUCTURE_FAMILY);
    const captions = ordered
      .filter((part) => part.role === 'caption')
      .map((part) => this.readBridge(part))
      .filter((part): part is TableStructurePartBridge => part !== null);
    const rowParts = ordered.filter((part) => part.role === 'row');
    const rows = rowParts.map((rowPart, rowIndex) => {
      const rowBridge = this.readBridge(rowPart);
      const start = ordered.indexOf(rowPart) + 1;
      const nextRow = rowParts[rowIndex + 1];
      const end = nextRow ? ordered.indexOf(nextRow) : ordered.length;
      const cells: TableStructureCellInput[] = [];
      for (const part of ordered.slice(start, end)) {
        if (part.role !== 'headerCell' && part.role !== 'cell') continue;
        const bridge = this.readBridge(part);
        if (!bridge || (bridge.role !== 'headerCell' && bridge.role !== 'cell')) continue;
        const config = bridge.readConfig();
        cells.push({
          ref: bridge.ref,
          kind: bridge.role,
          headerKey: config.headerKey,
          headerKind: config.headerKind,
          headers: config.headers ?? [],
          rowSpan: config.rowSpan,
          columnSpan: config.columnSpan,
        });
      }
      return { ref: rowBridge?.ref ?? this.a11y.getObjectRef(), cells };
    });

    const bridges = ordered
      .map((part) => this.readBridge(part))
      .filter((part): part is TableStructurePartBridge => part !== null);
    for (const bridge of bridges) {
      bridge.applyRow(null);
      bridge.applyCell(null);
      if (bridge.role === 'root') bridge.applyTable(null);
    }

    const next = projectTableStructure({
      root: this.a11y.getObjectRef(),
      captions: captions.map((caption) => caption.ref),
      rows,
    });
    this.snapshot = next;
    this.applyTable(next);
    if (!next.valid) return;
    for (const row of next.rows) {
      bridges.find((bridge) => bridge.ref === row.ref)?.applyRow(row.index);
      for (const cell of row.cells) {
        bridges.find((bridge) => bridge.ref === cell.ref)?.applyCell(cell);
      }
    }
  }

  private applyTable(snapshot: TableStructureSnapshot | null): void {
    const valid = snapshot?.valid === true;
    this.state.set(this.states.rowCount, valid ? snapshot.rowCount : 0, 'table.structure');
    this.state.set(this.states.columnCount, valid ? snapshot.columnCount : 0, 'table.structure');
    this.a11y.setRelation('caption', {
      target: valid && snapshot.caption ? [snapshot.caption] : [],
    });
  }

  private applyRow(index: number | null): void {
    this.state.set(this.states.row, index ?? -1, 'table.structure');
  }

  private applyCell(snapshot: TableStructureCellSnapshot | null): void {
    this.state.set(this.states.row, snapshot?.row ?? -1, 'table.structure');
    this.state.set(this.states.column, snapshot?.column ?? -1, 'table.structure');
    this.state.set(this.states.rowSpan, snapshot?.rowSpan ?? 0, 'table.structure');
    this.state.set(this.states.columnSpan, snapshot?.columnSpan ?? 0, 'table.structure');
    this.a11y.setRelation('columnHeaders', { target: snapshot?.columnHeaders ?? [] });
    this.a11y.setRelation('rowHeaders', { target: snapshot?.rowHeaders ?? [] });
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
