// packages/modules/expose/src/impl.ts
import type { CapsVaultView } from '@proto.ui/core';
import { illegalPhase } from '@proto.ui/core';

import { ModuleBase } from '@proto.ui/module-base';

import { ExposeKernel } from './kernel';
import type { ExposeDiag, ExposeFacade, ExposePort } from './types';
import {
  exposeDisposed,
  exposeDuplicateKey,
  exposeInvalidKey,
  exposePhaseViolation,
} from './error';

function isValidKey(key: any): key is string {
  return typeof key === 'string' && key.length > 0;
}

function toDiag(key: string, value: unknown): ExposeDiag {
  const t = typeof value;
  return {
    key,
    valueType: t,
    isFunction: t === 'function',
    isObject: value !== null && t === 'object',
  };
}

export class ExposeModuleImpl extends ModuleBase {
  private readonly kernel = new ExposeKernel();
  private readonly prototypeName: string;
  private disposed = false;

  constructor(caps: CapsVaultView, prototypeName: string) {
    super(caps);
    this.prototypeName = prototypeName;
  }

  // -------------------------
  // setup-only API (guarded)
  // -------------------------

  expose(key: string, value: unknown): void {
    this.ensureSetup('def.expose');
    this.ensureAlive('def.expose');

    if (!isValidKey(key)) {
      throw exposeInvalidKey(`[Expose] key must be a non-empty string.`, {
        prototypeName: this.prototypeName,
        key,
      });
    }

    if (this.kernel.has(key)) {
      throw exposeDuplicateKey(`[Expose] duplicate key: ${key}`, {
        prototypeName: this.prototypeName,
        key,
      });
    }

    this.kernel.set(key, value);
  }

  // -------------------------
  // runtime port
  // -------------------------

  readonly port: ExposePort = {
    get: (key) => {
      this.ensureAlive('rt.expose.get');
      return this.kernel.get(key);
    },

    getAll: () => {
      this.ensureAlive('rt.expose.getAll');
      return this.kernel.toRecord();
    },

    has: (key) => {
      this.ensureAlive('rt.expose.has');
      return this.kernel.has(key);
    },

    keys: () => {
      this.ensureAlive('rt.expose.keys');
      return this.kernel.keys();
    },

    getDiagnostics: () => {
      this.ensureAlive('rt.expose.getDiagnostics');
      const entries = this.kernel.entries();
      return entries.map((e) => toDiag(e.key, e.value));
    },
  };

  // -------------------------
  // lifecycle + caps wiring
  // -------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.kernel.clear();
  }

  // -------------------------
  // helpers
  // -------------------------

  private ensureSetup(op: string) {
    // Prefer system caps (most precise)
    if (this.sys) {
      try {
        this.sys.ensureSetup(op);
        return;
      } catch (e) {
        throw exposePhaseViolation(`[Expose] setup-only: ${op}`, {
          prototypeName: this.prototypeName,
          error: e,
        });
      }
    }

    // Fallback to protoPhase guard (for tests)
    if (this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private ensureAlive(op: string) {
    this.sys?.ensureNotDisposed(op);
    if (this.disposed) {
      throw exposeDisposed(`[Expose] disposed. op=${op}`, {
        prototypeName: this.prototypeName,
      });
    }
  }

  // -------------------------
  // facade
  // -------------------------

  readonly facade: ExposeFacade = {
    expose: (key, value) => this.expose(key, value),
  };
}
