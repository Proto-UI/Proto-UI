// packages/modules/state/src/validate.ts
import type { StateSpec } from '@proto.ui/types';

export function validateSemantic(semantic: string): void {
  // 先做一个足够用的规则：非空，且只能 [a-z0-9-] + '.' 分段
  // 你之后要严格对齐 state-v0.md 再收紧
  if (!semantic || typeof semantic !== 'string') {
    throw new Error(`[State] illegal semantic`);
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(semantic)) {
    throw new Error(`[State] illegal semantic: ${semantic}`);
  }
}

export function validateAndNormalizeDefaultValue(spec: StateSpec, defaultValue: unknown): any {
  // 这里返回“可能被 clamp 修正后的默认值”
  switch (spec.kind) {
    case 'number.list':
      return normalizeNumberList(defaultValue);
    case 'bool': {
      if (typeof defaultValue !== 'boolean')
        throw new Error(`[State] bool defaultValue must be boolean`);
      return defaultValue;
    }
    case 'enum': {
      if (typeof defaultValue !== 'string')
        throw new Error(`[State] enum defaultValue must be string`);
      const opts = spec.options ?? [];
      if (!opts.includes(defaultValue))
        throw new Error(`[State] enum defaultValue must be in options`);
      return defaultValue;
    }
    case 'string': {
      if (typeof defaultValue !== 'string')
        throw new Error(`[State] string defaultValue must be string`);
      // 你现在 types 允许 options 可选；但契约若要求 options 必填，未来收紧到：options.includes(defaultValue)
      if (spec.options && spec.options.length && !spec.options.includes(defaultValue)) {
        throw new Error(`[State] string defaultValue must be in options`);
      }
      return defaultValue;
    }
    case 'number.range': {
      if (typeof defaultValue !== 'number' || Number.isNaN(defaultValue)) {
        throw new Error(`[State] numberRange defaultValue must be number`);
      }
      const { min, max, clamp } = spec;
      if (defaultValue < min)
        return clamp ? min : throwSpec(`[State] numberRange defaultValue out of range`);
      if (defaultValue > max)
        return clamp ? max : throwSpec(`[State] numberRange defaultValue out of range`);
      return defaultValue;
    }
    case 'number.discrete': {
      if (typeof defaultValue !== 'number' || Number.isNaN(defaultValue)) {
        throw new Error(`[State] numberDiscrete defaultValue must be number`);
      }
      if (spec.options && spec.options.length) {
        if (!spec.options.includes(defaultValue))
          throw new Error(`[State] numberDiscrete defaultValue must be in options`);
        return defaultValue;
      }
      const { min, max, step } = spec;
      if (min != null && defaultValue < min) throwSpec(`[State] numberDiscrete defaultValue < min`);
      if (max != null && defaultValue > max) throwSpec(`[State] numberDiscrete defaultValue > max`);
      if (step != null && step > 0) {
        // 不强制对齐 step（否则会引入“默认值被悄悄修正”的惊喜），先只校验可整除（容忍浮点误差先不做）
        const base = min ?? 0;
        const n = (defaultValue - base) / step;
        if (!Number.isInteger(n)) throwSpec(`[State] numberDiscrete defaultValue violates step`);
      }
      return defaultValue;
    }
    default: {
      const _exhaust: never = spec;
      return _exhaust;
    }
  }
}

export function validateValue(spec: StateSpec, next: unknown): void {
  // set / setDefault 时校验（不做 clamp；clamp 只用于 range 的默认值 define 时）
  switch (spec.kind) {
    case 'number.list':
      normalizeNumberList(next);
      return;
    case 'bool':
      if (typeof next !== 'boolean') throwSpec(`[State] bool value must be boolean`);
      return;
    case 'enum':
      if (typeof next !== 'string' || !spec.options.includes(next))
        throwSpec(`[State] enum value must be in options`);
      return;
    case 'string':
      if (typeof next !== 'string') throwSpec(`[State] string value must be string`);
      if (spec.options && spec.options.length && !spec.options.includes(next))
        throwSpec(`[State] string value must be in options`);
      return;
    case 'number.range':
      if (typeof next !== 'number' || Number.isNaN(next))
        throwSpec(`[State] numberRange value must be number`);
      if (next < spec.min || next > spec.max) throwSpec(`[State] numberRange value out of range`);
      return;
    case 'number.discrete':
      if (typeof next !== 'number' || Number.isNaN(next))
        throwSpec(`[State] numberDiscrete value must be number`);
      if (spec.options && spec.options.length) {
        if (!spec.options.includes(next))
          throwSpec(`[State] numberDiscrete value must be in options`);
        return;
      }
      if (spec.min != null && next < spec.min) throwSpec(`[State] numberDiscrete value < min`);
      if (spec.max != null && next > spec.max) throwSpec(`[State] numberDiscrete value > max`);
      if (spec.step != null && spec.step > 0) {
        const base = spec.min ?? 0;
        const n = (next - base) / spec.step;
        if (!Number.isInteger(n)) throwSpec(`[State] numberDiscrete value violates step`);
      }
      return;
  }
}

function throwSpec(msg: string): never {
  throw new Error(msg);
}

/** Own descriptors avoid evaluating ordinary element or extra-property accessors. */
export function normalizeNumberList(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    throwSpec('[State] number.list value must be a dense finite-number array');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const length = descriptors.length.value as number;
  if (Reflect.ownKeys(descriptors).length !== length + 1) {
    throwSpec('[State] number.list value must have only dense indices and length');
  }
  const snapshot: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(descriptors, String(index))?.value;
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'number' ||
      !Number.isFinite(descriptor.value)
    ) {
      throwSpec('[State] number.list elements must be own finite-number data values');
    }
    snapshot.push(Object.is(descriptor.value, -0) ? 0 : descriptor.value);
  }
  return Object.freeze(snapshot);
}

export function numberListEqual(left: readonly number[], right: readonly number[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
  );
}
