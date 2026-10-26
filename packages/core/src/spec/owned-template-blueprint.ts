import { createRendererPrimitives } from './template';
import type {
  ReservedType,
  SvgTemplateNode,
  SvgTemplateTag,
  TemplateChild,
  TemplateChildren,
  TemplateNode,
} from './template';
import type { OwnedDecorationTarget, TemplateStyleHandle } from './feedback/style';

const svg = createRendererPrimitives().svg;
const svgTags: readonly string[] = [
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'ellipse',
  'polygon',
];
const svgKeys = [
  'viewBox',
  'width',
  'height',
  'aria-hidden',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'fillRule',
  'clipRule',
  'opacity',
  'd',
  'cx',
  'cy',
  'r',
  'x',
  'y',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
];
function fail(reason: string): never {
  throw new Error(`[Template] invalid owned blueprint: ${reason}`);
}

type Fields = {
  keys: readonly PropertyKey[];
  has(key: string): boolean;
  read(key: string): unknown;
};

/**
 * Internal fixed-blueprint capture for owners with setup-declared decorations.
 * Do not apply this stricter boundary to ordinary no-decoration templates.
 * Callers must recheck owner/lifecycle authority after author getters have run.
 * Only owned copies are frozen; decoration targets remain opaque references.
 */
export function snapshotOwnedTemplateBlueprint(input: unknown): TemplateChildren {
  const fields = new WeakMap<object, Fields>();
  const memo = new WeakMap<object, Map<string, unknown>>();
  const active = new Set<object>();

  const inspect = (source: object): Fields => {
    const existing = fields.get(source);
    if (existing) return existing;
    const keys = Reflect.ownKeys(source);
    const own = new Set(keys);
    const values = new Map<string, unknown>();
    const captured: Fields = {
      keys,
      has: (key) => own.has(key),
      read(key) {
        if (!own.has(key)) return undefined;
        if (!values.has(key)) values.set(key, Reflect.get(source, key));
        return values.get(key);
      },
    };
    fields.set(source, captured);
    return captured;
  };
  const record = (value: unknown, allowed: readonly string[]): [object, Fields] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected record');
    const source = value as object;
    const captured = inspect(source);
    for (const key of captured.keys) {
      // Do not interpolate untrusted values, invoke coercion or inspect symbols.
      if (typeof key !== 'string' || !allowed.includes(key)) fail('unsupported own field');
    }
    return [source, captured];
  };
  const copy = <T>(source: object, role: string, build: () => T): T => {
    if (active.has(source)) fail('cycle');
    let roles = memo.get(source);
    if (roles?.has(role)) return roles.get(role) as T;
    active.add(source);
    try {
      const result = build();
      if (!roles) memo.set(source, (roles = new Map()));
      roles.set(role, result);
      return result;
    } finally {
      active.delete(source);
    }
  };
  const array = <T>(value: unknown, role: string, item: (value: unknown) => T): T[] => {
    if (!Array.isArray(value)) fail('expected array');
    const source = value as unknown[];
    return copy(source, role, () => {
      const captured = inspect(source);
      const length = captured.read('length');
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
        fail('invalid array length');
      // A dense array owns exactly length plus its index fields. This catches
      // symbols, non-enumerable extras, holes and custom iteration methods.
      if (captured.keys.length !== length + 1) fail('array hole or extra field');
      for (const key of captured.keys) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key))
          fail('unsupported array field');
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index >= length) fail('unsupported array field');
      }
      const result: T[] = [];
      for (let i = 0; i < length; i++) {
        const key = String(i);
        if (!captured.has(key)) fail('array hole');
        const child = captured.read(key);
        if (child === undefined) fail('undefined array item');
        result.push(item(child));
      }
      return Object.freeze(result) as T[];
    });
  };
  const style = (value: unknown): TemplateStyleHandle => {
    const [source, captured] = record(value, ['kind', 'tokens']);
    return copy(source, 'style', () => {
      if (captured.read('kind') !== 'tw') fail('unsupported style kind');
      const tokens = array(captured.read('tokens'), 'tokens', (token) => {
        if (typeof token !== 'string') fail('style token must be a string');
        return token as string;
      });
      return Object.freeze({ kind: 'tw' as const, tokens });
    });
  };
  const type = (value: unknown): string | ReservedType => {
    if (typeof value === 'string') return value;
    const [source, captured] = record(value, ['kind', 'target', 'name', 'ref']);
    return copy(source, 'type', () => {
      const kind = captured.read('kind');
      if (kind === 'prototype') {
        throw new Error('[Template] PrototypeRef is not allowed in Template v0.');
      }
      if (kind === 'slot') {
        record(source, ['kind']);
        return Object.freeze({ kind: 'slot' as const });
      }
      if (kind === 'decoration') {
        record(source, ['kind', 'target']);
        const target = captured.read('target');
        if (!target || typeof target !== 'object') fail('invalid decoration target');
        return Object.freeze({
          kind: 'decoration' as const,
          target: target as OwnedDecorationTarget,
        });
      }
      return fail('unsupported template type');
    });
  };
  const props = (tag: SvgTemplateTag, value: unknown): object => {
    const [source, captured] = record(value, svgKeys);
    return copy(source, `svg-props:${tag}`, () => {
      const result: Record<string, string | number> = {};
      for (const key of captured.keys as readonly string[]) {
        const scalar = captured.read(key);
        if (typeof scalar !== 'string' && typeof scalar !== 'number') fail('invalid SVG scalar');
        if (typeof scalar === 'number' && !Number.isFinite(scalar)) fail('non-finite SVG scalar');
        if ((key === 'viewBox' || key === 'd' || key === 'points') && typeof scalar !== 'string')
          fail('SVG text prop must be a string');
        if (
          tag === 'ellipse' &&
          ['cx', 'cy', 'rx', 'ry'].includes(key) &&
          typeof scalar !== 'number'
        )
          fail('ellipse coordinate must be a number');
        result[key] = scalar as string | number;
      }
      // Reuse the governed constructor's per-tag allowed/required validation,
      // but only on our data copy: no author accessor can be read a second time.
      const factory = tag === 'svg' ? svg.root : svg[tag];
      factory(result as never);
      return Object.freeze(result);
    });
  };
  const child = (value: unknown): TemplateChild => {
    if (value === null || typeof value === 'string') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('non-finite text');
      return value;
    }
    const [source, captured] = record(value, ['kind', 'tag', 'props', 'type', 'style', 'children']);
    return copy(source, 'node', () => {
      if (captured.has('kind')) {
        record(source, ['kind', 'tag', 'props', 'children']);
        if (captured.read('kind') !== 'svg-node') fail('unsupported node kind');
        const tag = captured.read('tag');
        if (typeof tag !== 'string' || !svgTags.includes(tag)) fail('unsupported SVG tag');
        const capturedProps = props(tag as SvgTemplateTag, captured.read('props'));
        const capturedChildren = children(captured.read('children'));
        if (
          tag !== 'svg' &&
          tag !== 'g' &&
          capturedChildren !== null &&
          (!Array.isArray(capturedChildren) || capturedChildren.length !== 0)
        )
          fail('SVG leaf must not have children');
        return Object.freeze({
          kind: 'svg-node',
          tag,
          props: capturedProps,
          children: capturedChildren,
        }) as SvgTemplateNode;
      }
      record(source, ['type', 'style', 'children']);
      const nodeType = type(captured.read('type'));
      if (typeof nodeType === 'object' && nodeType.kind === 'decoration') {
        record(source, ['type']);
        return Object.freeze({ type: nodeType });
      }
      const rawStyle = captured.read('style');
      const rawChildren = captured.read('children');
      if (typeof nodeType === 'object') {
        if (rawStyle !== undefined || (rawChildren !== null && rawChildren !== undefined))
          fail('slot must be an empty unstyled node');
        return Object.freeze({ type: nodeType, children: null });
      }
      const result: TemplateNode = { type: nodeType, children: children(rawChildren) };
      if (rawStyle !== undefined) result.style = style(rawStyle);
      return Object.freeze(result);
    });
  };
  const children = (value: unknown): TemplateChildren => {
    if (value === undefined) return null; // Constructor's absent children normalization.
    return Array.isArray(value) ? array(value, 'children', child) : child(value);
  };

  const result = children(input);
  // Count occurrences, not unique source objects: an aliased slot is still two
  // insertion points. This traversal only reads our frozen, cycle-free copies.
  let slots = 0;
  const countSlots = (value: TemplateChildren): void => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) countSlots(value[i]);
    } else if (value && typeof value === 'object') {
      if ('type' in value && typeof value.type === 'object' && value.type.kind === 'slot') {
        if (++slots > 1) fail('multiple slots');
      } else {
        countSlots(value.children ?? null);
      }
    }
  };
  countSlots(result);
  return result;
}

/** Compare only captured blueprints. Opaque targets are never traversed. */
export function equalOwnedTemplateBlueprint(
  left: TemplateChildren,
  right: TemplateChildren
): boolean {
  const compared = new WeakMap<object, WeakSet<object>>();
  const equal = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    let pairs = compared.get(a);
    if (pairs?.has(b)) return true;
    if (!pairs) compared.set(a, (pairs = new WeakSet()));
    pairs.add(b);
    const aa = a as Record<string, unknown>;
    const bb = b as Record<string, unknown>;
    const keys = Object.keys(aa);
    if (keys.length !== Object.keys(bb).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(bb, key)) return false;
      if (key === 'target' && aa.kind === 'decoration') {
        if (!Object.is(aa[key], bb[key])) return false;
      } else if (!equal(aa[key], bb[key])) return false;
    }
    return true;
  };
  return equal(left, right);
}
