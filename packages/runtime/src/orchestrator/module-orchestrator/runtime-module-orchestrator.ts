// packages/runtime/src/orchestrator/module-orchestrator/runtime-module-orchestrator.ts
import type {
  CapEntries,
  CapsVaultView,
  InstancePhase,
  ModuleFacade,
  MountPhase,
  ProtoPhase,
  PrototypeModuleDeclaration,
} from '@proto.ui/core';
import { SYS_CAP, type SystemCaps, type ExecPhase, CapsVault } from '@proto.ui/module-base';

import type { ModuleDeps, ModuleDef } from '@proto.ui/module-base';
import type { AnyModule, ModuleOrchestrator, ModuleWiring } from './types';
import type { CapsController } from '../caps';
import { buildModuleGraph, type ModuleDepsSpec } from './graph';

export type ModuleDecl = ModuleDef;

type ModuleRecord = {
  name: string;
  vault: CapsVault;
  controller: CapsController;
  module: AnyModule;
};

export class RuntimeModuleOrchestrator implements ModuleOrchestrator {
  private readonly prototypeName: string;
  private readonly getExecPhase: () => ExecPhase;

  private protoPhase: ProtoPhase = 'setup';
  private instancePhase: InstancePhase = 'setup';
  private mountPhase: MountPhase = 'detached';
  private disposed = false;

  private records: ModuleRecord[] = [];
  private recordByName = new Map<string, ModuleRecord>();

  private facades: Record<string, ModuleFacade> = {};
  private ports: Record<string, any> = {};
  private wiring: ModuleWiring;

  // runtime-owned callback ctx (opaque)
  private callbackCtx: unknown = undefined;
  private afterCallbackTasks: Array<() => void> = [];

  constructor(
    init: {
      prototypeName: string;
      declarations?: readonly PrototypeModuleDeclaration[];
      getPhase: () => ExecPhase;
    },
    modules: ModuleDecl[]
  ) {
    this.prototypeName = init.prototypeName;
    this.getExecPhase = init.getPhase;
    const declarations = Object.freeze((init.declarations ?? []).slice());

    const fail = (msg: string) => {
      throw new Error(`[Runtime] ${msg}`);
    };

    // --- sys caps implementation (runtime-owned object) ---
    const sys: SystemCaps = {
      execPhase: () => this.getExecPhase(),
      domain: () => (this.getExecPhase() === 'setup' ? 'setup' : 'runtime'),
      protoPhase: () => this.protoPhase,
      instancePhase: () => this.instancePhase,
      mountPhase: () => this.mountPhase,
      isDisposed: () => this.disposed,

      ensureNotDisposed: (op) => {
        if (this.disposed) fail(`${this.prototypeName} is disposed. op=${op}`);
      },

      ensureExecPhase: (op, expected) => {
        if (this.disposed) fail(`${this.prototypeName} is disposed. op=${op}`);

        const actual = this.getExecPhase();
        const ex = Array.isArray(expected) ? expected : [expected];
        if (!ex.includes(actual)) {
          fail(
            `exec-phase violation: ${this.prototypeName} op=${op} ` +
              `expected=${ex.join('|')} actual=${actual} protoPhase=${this.protoPhase}`
          );
        }
      },

      ensureSetup: (op) => {
        sys.ensureExecPhase(op, 'setup');
      },

      ensureRuntime: (op) => {
        if (this.disposed) fail(`${this.prototypeName} is disposed. op=${op}`);
        if (this.getExecPhase() === 'setup') {
          fail(
            `runtime-only violation: ${this.prototypeName} op=${op} ` +
              `actual=setup protoPhase=${this.protoPhase}`
          );
        }
      },

      ensureCallback: (op) => {
        sys.ensureExecPhase(op, 'callback');
      },

      getCallbackCtx: () => {
        return this.getExecPhase() === 'callback' ? this.callbackCtx : undefined;
      },

      deferAfterCallback: (task) => {
        this.afterCallbackTasks.push(task);
      },
    };

    // -------------------------
    // validate + sort modules
    // -------------------------
    const graph = buildModuleGraph(this.prototypeName, modules);

    // -------------------------
    // create modules
    // -------------------------
    for (const m of graph.order) {
      const vault = new CapsVault();

      // base layer: SYS_CAP must survive host reset
      vault.attachBase([[SYS_CAP, sys]]);

      // adapter-facing controller (with reserved enforcement)
      const controller = this.createController(m.name, vault);

      // create module (caps passed as view only)
      const deps = this.createDepsAccess(m.name, graph.depsByName.get(m.name)!);
      const module: AnyModule = m.create({
        init: { prototypeName: this.prototypeName, declarations },
        caps: vault as unknown as CapsVaultView,
        deps,
      });

      const rec: ModuleRecord = { name: m.name, vault, controller, module };

      // record
      this.records.push(rec);
      this.recordByName.set(m.name, rec);

      // expose facade/port
      this.facades[m.name] = module.facade;
      if ((module as any).port !== undefined) {
        this.ports[m.name] = (module as any).port;
      }
    }

    // -------------------------
    // wiring API (adapter-facing)
    // -------------------------
    this.wiring = {
      attach: (moduleName: string, entries: CapEntries) => {
        const rec = this.recordByName.get(moduleName);
        if (!rec) return false;
        rec.controller.attach(entries);
        return true;
      },

      reset: (moduleName?: string) => {
        if (!moduleName) {
          for (const r of this.records) {
            try {
              r.controller.reset();
            } catch {
              // ignore v0
            }
          }
          return;
        }

        const rec = this.recordByName.get(moduleName);
        if (!rec) return;
        rec.controller.reset();
      },
    };
  }

  private createDepsAccess(moduleName: string, spec: ModuleDepsSpec): ModuleDeps {
    const allow = new Set<string>([...spec.hard, ...spec.optional]);
    const require = (name: string) => {
      if (!allow.has(name)) {
        throw new Error(
          `[Runtime] ${this.prototypeName}/${moduleName} tried to access undeclared dep: ${name}`
        );
      }
    };

    const requireFacade = <T extends ModuleFacade>(name: string): T => {
      require(name);
      const f = this.facades[name];
      if (!f) {
        throw new Error(
          `[Runtime] ${this.prototypeName}/${moduleName} missing dep facade: ${name}`
        );
      }
      return f as T;
    };

    const requirePort = <T>(name: string): T => {
      require(name);
      const p = this.ports[name];
      if (!p) {
        throw new Error(`[Runtime] ${this.prototypeName}/${moduleName} missing dep port: ${name}`);
      }
      return p as T;
    };

    const tryFacade = <T extends ModuleFacade>(name: string): T | undefined => {
      require(name);
      return this.facades[name] as T | undefined;
    };

    const tryPort = <T>(name: string): T | undefined => {
      require(name);
      return this.ports[name] as T | undefined;
    };

    return { requireFacade, requirePort, tryFacade, tryPort };
  }

  // -------------------------
  // adapter-facing controller
  // -------------------------

  private createController(moduleName: string, vault: CapsVault): CapsController {
    const prototypeName = this.prototypeName;

    const findReserved = (entries: CapEntries): string | null => {
      for (const [token] of entries) {
        // reserved caps must not be overridden by host wiring
        if (token.id === SYS_CAP.id) return token.id;
      }
      return null;
    };

    return {
      attach: (entries: CapEntries) => {
        const reserved = findReserved(entries);
        if (reserved) {
          throw new Error(
            `[Wiring] ${prototypeName}/${moduleName} attempted to provide reserved cap: ${reserved}`
          );
        }
        vault.attach(entries);
      },

      reset: () => {
        // clear ONLY host layer
        vault.resetAttached();
      },
    };
  }

  // -------------------------
  // runtime -> modules
  // -------------------------

  setProtoPhase(phase: ProtoPhase): void {
    this.protoPhase = phase;
    for (const r of this.records) {
      r.module.hooks.onProtoPhase?.(phase);
    }
  }

  setInstancePhase(phase: InstancePhase): void {
    this.instancePhase = phase;
    for (const r of this.records) {
      r.module.hooks.onInstancePhase?.(phase);
    }
  }

  setMountPhase(phase: MountPhase, epoch: number): void {
    this.mountPhase = phase;
    for (const r of this.records) {
      r.module.hooks.onMountPhase?.(phase, epoch);
    }
  }

  afterRenderCommit(): void {
    for (const r of this.records) {
      r.module.hooks.afterRenderCommit?.();
    }
  }

  // -------------------------
  // runtime -> handles
  // -------------------------

  getFacades(): Record<string, ModuleFacade> {
    return this.facades;
  }

  getPorts(): Record<string, unknown> {
    return this.ports;
  }

  // -------------------------
  // runtime -> ports
  // -------------------------

  getPort<T>(moduleName: string): T | undefined {
    return this.ports[moduleName] as T | undefined;
  }

  // -------------------------
  // runtime -> adapter
  // -------------------------

  getCapsController(moduleName: string): CapsController | undefined {
    return this.recordByName.get(moduleName)?.controller;
  }

  getWiring(): ModuleWiring {
    return this.wiring;
  }

  // -------------------------
  // runtime internal: callback ctx
  // -------------------------

  __setCallbackCtx(ctx: unknown): void {
    this.callbackCtx = ctx;
  }

  __getCallbackCtx(): unknown {
    return this.callbackCtx;
  }

  __flushAfterCallbackTasks(): void {
    while (this.afterCallbackTasks.length > 0) {
      const tasks = this.afterCallbackTasks;
      this.afterCallbackTasks = [];
      for (const task of tasks) task();
    }
  }

  // -------------------------
  // lifecycle
  // -------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // best-effort clear callback ctx
    this.callbackCtx = undefined;
    this.afterCallbackTasks = [];

    // dispose hooks first so modules can teardown while caps still readable
    for (const r of this.records) {
      r.module.hooks.dispose?.();
    }

    // invalidate host-attached caps only (sys remains)
    for (const r of this.records) {
      try {
        r.vault.resetAttached();
      } catch {
        // ignore in v0
      }
    }
  }
}
