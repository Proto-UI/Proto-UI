// packages/modules/props/src/kernel/kernel.ts
import type { EmptyBehavior, PropSpec, PropsSpecMap, PropsBaseType } from '@proto.ui/types';
import { mergeSpecs } from './merge';
import type { PropsDefaults, PropsSnapshot } from '@proto.ui/core';
import type { PropsKernelDiag } from '../types';
import type { PropsResolveMeta } from './types';
import { isJsonPropsValue } from './json-value';

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

function shallowFreeze<T extends object>(o: T): Readonly<T> {
  return Object.freeze({ ...(o as any) });
}

function objectIs(a: any, b: any) {
  return Object.is(a, b);
}

function diffKeys(prev: Record<string, any>, next: Record<string, any>, keys: string[]) {
  const changed: string[] = [];
  for (const k of keys) {
    if (!objectIs((prev as any)[k], (next as any)[k])) changed.push(k);
  }
  return changed;
}

type FallbackResult =
  | { ok: true; value: any; usedDefault: boolean; isNonEmpty: boolean }
  | { ok: false; usedDefault: boolean; isNonEmpty: false };

export type PropsChangeReport<P extends PropsBaseType> = {
  prevRaw: Readonly<P & PropsBaseType>;
  nextRaw: Readonly<P & PropsBaseType>;
  prevResolved: PropsSnapshot<P>;
  nextResolved: PropsSnapshot<P>;

  // precomputed diffs to help dispatcher
  changedAllResolved: string[]; // declared keys
  changedAllRaw: string[]; // union keys

  meta: PropsResolveMeta<P>;
};

export class PropsKernel<P extends PropsBaseType> {
  private specs: PropsSpecMap<P> = {} as PropsSpecMap<P>;
  private defaultStack: PropsDefaults<P>[] = []; // latest-first

  /**
   * Per-key previous non-empty valid resolved candidate.
   * Used only for provided-empty or invalid fallback; missing always skips it.
   */
  private prevValid: Partial<Record<keyof P, any>> = {};

  private raw: Readonly<P & PropsBaseType> = Object.freeze({} as Readonly<P & PropsBaseType>);
  private resolved: PropsSnapshot<P> = Object.freeze({} as PropsSnapshot<P>) as PropsSnapshot<P>;

  private diags: PropsKernelDiag[] = [];
  private hydrated = false;

  getDiagnostics(): readonly PropsKernelDiag[] {
    return this.diags;
  }

  /** setup-only */
  define(input: Partial<PropsSpecMap<P>>) {
    const { specs, diags } = mergeSpecs(this.specs, input);
    const hasError = diags.some((d: PropsKernelDiag) => d.level === 'error');
    if (hasError) {
      const msg = diags
        .filter((d: PropsKernelDiag) => d.level === 'error')
        .map((d: PropsKernelDiag) => (d.key ? `${d.key}: ${d.message}` : d.message))
        .join('; ');
      // Merge conflicts are transaction-level blocking errors: do not assign specs or persist warnings from the failed merge.
      throw new Error(`[Props] define merge error: ${msg}`);
    }
    for (const d of diags) {
      if (d.level === 'warning') {
        this.diags.push({ level: 'warning', key: d.key, message: d.message });
      }
    }

    this.specs = specs;

    // ✅ contract: after define(), get() must be usable (defaults are materialized)
    // Do NOT flip hydrated here (hydration is applyRaw-only semantics).
    this.recomputeResolved();
  }

  /** setup-only */
  setDefaults(partial: PropsDefaults<P>) {
    // ✅ contract: reject keys not in specs
    const declKeys = Object.keys(this.specs);
    if (declKeys.length === 0) {
      // no declared specs => no defaults allowed
      const keys = Object.keys(partial as any);
      if (keys.length > 0) {
        throw new Error(`[Props] setDefaults() rejects keys not in specs: ${keys.join(', ')}`);
      }
    } else {
      for (const k of Object.keys(partial as any)) {
        if (!hasOwn(this.specs, k)) {
          throw new Error(`[Props] setDefaults() rejects key not in specs: ${k}`);
        }
        if (!isJsonPropsValue((partial as any)[k])) {
          throw new Error(`[Props] setDefaults() rejects non-JSON props value for key: ${k}`);
        }
      }
    }

    this.defaultStack.unshift({ ...partial });

    // ✅ contract: setDefaults affects missing keys (i.e., not provided in raw)
    // Recompute resolved from current raw.
    this.recomputeResolved();
  }

  /** runtime-only */
  get(): PropsSnapshot<P> {
    return this.resolved;
  }

  /** runtime-only */
  getRaw(): Readonly<P & PropsBaseType> {
    return this.raw as Readonly<P & PropsBaseType>;
  }

  /** runtime-only */
  isProvided(key: keyof P): boolean {
    return hasOwn(this.raw, key);
  }

  /**
   * runtime-only
   * Apply raw and return a change report for dispatchers.
   * - First hydration never reports (keeps legacy semantics).
   * - Does NOT execute any watchers.
   *
   * IMPORTANT: nextRawInput is treated as a FULL snapshot (not a patch).
   */
  applyRaw(nextRawInput: Record<string, any>): {
    meta: PropsResolveMeta<P>;
    report?: PropsChangeReport<P>;
  } {
    const prevRaw = this.raw;
    const prevResolved = this.resolved;

    const normalized = this.normalizeRawInput(nextRawInput ?? {});
    const nextRaw = shallowFreeze(normalized) as Readonly<P & PropsBaseType>;
    this.raw = nextRaw;

    const { snapshot: nextResolved, meta } = this.resolve(nextRaw, /* strict */ true);
    this.resolved = nextResolved;

    if (!this.hydrated) {
      this.hydrated = true;
      return { meta };
    }

    // Compute diffs
    const declKeys = Object.keys(this.specs);
    const changedAllResolved = diffKeys(prevResolved as any, nextResolved as any, declKeys);

    const unionKeys = Array.from(
      new Set([...Object.keys(prevRaw as any), ...Object.keys(nextRaw as any)])
    );
    const changedAllRaw = diffKeys(prevRaw as any, nextRaw as any, unionKeys);

    if (changedAllResolved.length === 0 && changedAllRaw.length === 0) {
      return { meta };
    }

    return {
      meta,
      report: {
        prevRaw,
        nextRaw,
        prevResolved,
        nextResolved,
        changedAllResolved,
        changedAllRaw,
        meta,
      },
    };
  }

  /**
   * internal: recompute resolved snapshot from current raw + current specs/defaults.
   * Contract: define/setDefaults should make get() immediately meaningful.
   */
  private recomputeResolved(): void {
    const { snapshot } = this.resolve(this.raw as any, /* strict */ false);
    this.resolved = snapshot;
  }

  /**
   * internal: resolve raw -> resolved (declared keys only)
   */
  private resolve(
    raw: Readonly<Record<string, any>>,
    strict: boolean
  ): {
    snapshot: PropsSnapshot<P>;
    meta: PropsResolveMeta<P>;
  } {
    const out: Record<string, any> = {};

    const providedKeys: string[] = [];
    const emptyKeys: string[] = [];
    const invalidKeys: string[] = [];
    const usedFallbackKeys: string[] = [];
    const acceptedEmptyKeys: string[] = [];

    const declKeys = Object.keys(this.specs);

    for (const k of declKeys) {
      const decl = this.specs[k]!;
      const provided = Object.prototype.hasOwnProperty.call(raw, k);

      if (provided) providedKeys.push(k);

      const eb: EmptyBehavior = (decl as any).empty ?? 'fallback';
      const rawVal = provided ? (raw as any)[k] : undefined;

      const isProvidedEmpty = provided && (rawVal === null || rawVal === undefined);
      const isMissing = !provided;

      // 1) Missing => defaults only. Omitting a key releases the previous
      // host-provided value and must not revive it through prevValid.
      if (isMissing) {
        const requireNonEmpty = strict && eb === 'error';
        const fb = this.pickFallbackMissingOnly(k, decl, requireNonEmpty);

        if (!fb.ok) {
          throw new Error(
            `[Props] prop "${k}" is missing and empty="error" has no non-empty fallback.`
          );
        }

        out[k] = fb.value;
        if (fb.usedDefault) usedFallbackKeys.push(k);
        continue;
      }

      // 2) Provided but empty
      if (isProvidedEmpty) {
        emptyKeys.push(k);

        if (eb === 'accept') {
          out[k] = null;
          acceptedEmptyKeys.push(k);
          continue;
        }

        const mode: 'any' | 'non-empty' = strict && eb === 'error' ? 'non-empty' : 'any';

        const fb = this.pickFallbackProvidedUnusable(k, decl, mode);

        if (!fb.ok) {
          throw new Error(
            `[Props] prop "${k}" is empty (null/undefined) and empty="error" has no non-empty fallback.`
          );
        }

        out[k] = fb.value;
        if (fb.usedDefault) usedFallbackKeys.push(k);
        if (fb.isNonEmpty) (this.prevValid as any)[k] = fb.value;
        continue;
      }

      // 3) Provided non-empty => validate
      const valid = this.validateNonEmptyValue(rawVal, decl);
      if (valid.ok) {
        out[k] = valid.value;
        (this.prevValid as any)[k] = valid.value;
        continue;
      }

      // 4) Provided non-empty but invalid => invalidKeys + fallback/error
      invalidKeys.push(k);

      const mode: 'any' | 'non-empty' = strict && eb === 'error' ? 'non-empty' : 'any';

      const fb = this.pickFallbackProvidedUnusable(k, decl, mode);

      if (!fb.ok) {
        throw new Error(
          `[Props] prop "${k}" is invalid and empty="error" has no non-empty fallback.`
        );
      }

      out[k] = fb.value;
      if (fb.usedDefault) usedFallbackKeys.push(k);
      if (fb.isNonEmpty) (this.prevValid as any)[k] = fb.value;
    }

    return {
      snapshot: shallowFreeze(out) as PropsSnapshot<P>,
      meta: {
        providedKeys: providedKeys as any,
        emptyKeys: emptyKeys as any,
        invalidKeys: invalidKeys as any,
        usedFallbackKeys: usedFallbackKeys as any,
        acceptedEmptyKeys: acceptedEmptyKeys as any,
      },
    };
  }

  private validateNonEmptyValue(v: any, decl: PropSpec): { ok: true; value: any } | { ok: false } {
    if (!isJsonPropsValue(v)) return { ok: false };

    switch ((decl as any).type) {
      case 'boolean':
        if (typeof v !== 'boolean') return { ok: false };
        break;
      case 'string':
        if (typeof v !== 'string') return { ok: false };
        break;
      case 'enum':
        if (typeof v !== 'string') return { ok: false };
        if (!Array.isArray((decl as any).options) || !(decl as any).options.includes(v)) {
          return { ok: false };
        }
        break;
      case 'number':
        if (typeof v !== 'number' || Number.isNaN(v)) return { ok: false };
        break;
      case 'object':
        if (typeof v !== 'object') return { ok: false };
        break;
      case 'any':
      default:
        break;
    }

    if ((decl as any).range) {
      if (typeof v !== 'number') return { ok: false };
      const min = (decl as any).range.min ?? -Infinity;
      const max = (decl as any).range.max ?? Infinity;
      if (v < min || v > max) return { ok: false };
    }

    if ((decl as any).validator) {
      try {
        if (!(decl as any).validator(v)) return { ok: false };
      } catch {
        return { ok: false };
      }
    }

    return { ok: true, value: v };
  }

  /**
   * Missing fallback: setDefaults layers -> spec.default -> null (never prevValid).
   *
   * - if requireNonEmpty=true: must find non-empty valid fallback; otherwise fail.
   * - else: may return null if nothing provided.
   */
  private pickFallbackMissingOnly(
    key: string,
    decl: PropSpec,
    requireNonEmpty: boolean
  ): FallbackResult {
    const acceptAny = (v: any) => v !== undefined;
    const acceptNonEmpty = (v: any) => v !== null && v !== undefined;
    const accept = requireNonEmpty ? acceptNonEmpty : acceptAny;

    const tryTake = (v: any, usedDefault: boolean): FallbackResult => {
      if (!accept(v)) return { ok: false, usedDefault, isNonEmpty: false };
      if (v === null || v === undefined) {
        return { ok: true, value: null, usedDefault, isNonEmpty: false };
      }
      const valid = this.validateNonEmptyValue(v, decl);
      if (!valid.ok) return { ok: false, usedDefault, isNonEmpty: false };
      return { ok: true, value: valid.value, usedDefault, isNonEmpty: true };
    };

    // defaultStack latest-first
    for (const layer of this.defaultStack) {
      if (hasOwn(layer, key)) {
        const r = tryTake((layer as any)[key], true);
        if (r.ok) return r;
      }
    }

    if (hasOwn(decl as any, 'default')) {
      const r = tryTake((decl as any).default, true);
      if (r.ok) return r;
    }

    if (!requireNonEmpty) {
      return { ok: true, value: null, usedDefault: true, isNonEmpty: false };
    }

    return { ok: false, usedDefault: false, isNonEmpty: false };
  }

  /**
   * Provided-but-unusable fallback: prevValid first, then defaults, then spec.default, then null (mode any).
   * This is for invalid raw values or empty=fallback scenarios.
   */
  private pickFallbackProvidedUnusable(
    key: string,
    decl: PropSpec,
    mode: 'any' | 'non-empty'
  ): FallbackResult {
    const acceptAny = (v: any) => v !== undefined;
    const acceptNonEmpty = (v: any) => v !== null && v !== undefined;

    const accept = mode === 'non-empty' ? acceptNonEmpty : acceptAny;

    const tryTake = (v: any, usedDefault: boolean): FallbackResult => {
      if (!accept(v)) return { ok: false, usedDefault, isNonEmpty: false };
      if (v === null || v === undefined) {
        return { ok: true, value: null, usedDefault, isNonEmpty: false };
      }
      const valid = this.validateNonEmptyValue(v, decl);
      if (!valid.ok) return { ok: false, usedDefault, isNonEmpty: false };
      return { ok: true, value: valid.value, usedDefault, isNonEmpty: true };
    };

    if (hasOwn(this.prevValid, key)) {
      const v = (this.prevValid as any)[key];
      const r = tryTake(v, false);
      if (r.ok) return r;
    }

    for (const layer of this.defaultStack) {
      if (hasOwn(layer, key)) {
        const r = tryTake((layer as any)[key], true);
        if (r.ok) return r;
      }
    }

    if (hasOwn(decl as any, 'default')) {
      const r = tryTake((decl as any).default, true);
      if (r.ok) return r;
    }

    if (mode === 'any') {
      return { ok: true, value: null, usedDefault: true, isNonEmpty: false };
    }

    return { ok: false, usedDefault: false, isNonEmpty: false };
  }

  dispose() {
    this.hydrated = false;
    this.defaultStack = [];
    this.prevValid = {};
    this.raw = Object.freeze({} as Readonly<P & PropsBaseType>);
    this.resolved = Object.freeze({} as PropsSnapshot<P>) as PropsSnapshot<P>;
  }

  private normalizeRawInput(input: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of Object.keys(input)) {
      const v = (input as any)[k];
      out[k] = v === undefined ? null : v;
    }
    return out;
  }
}
