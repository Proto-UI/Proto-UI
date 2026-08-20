// packages/adapters/web-component/src/props.ts
import type { RuntimeController } from '@proto.ui/runtime';
import type { HostSurfaceProjection } from '@proto.ui/adapter-base';

const rawMap = new WeakMap<HTMLElement, Record<string, any>>();
const ctrlMap = new WeakMap<HTMLElement, RuntimeController>();
const classTokenMap = new WeakMap<HTMLElement, Set<string>>();
const surfacePropsMap = new WeakMap<
  HTMLElement,
  Readonly<{ className: unknown; style: unknown }>
>();

type OwnedStyleValue = Readonly<{
  previousValue: string;
  previousPriority: string;
  appliedValue: string;
  appliedPriority: string;
}>;

type SurfaceBinding = {
  projection: HostSurfaceProjection<HTMLElement>;
  unsubscribe: () => void;
  classTarget: HTMLElement | null;
  ownedClasses: Set<string>;
  styleTarget: HTMLElement | null;
  ownedStyles: Map<string, OwnedStyleValue>;
};

const surfaceBindingMap = new WeakMap<HTMLElement, SurfaceBinding>();

export function setElementProps(el: HTMLElement, nextRaw: Record<string, any>) {
  const raw = { ...(nextRaw ?? {}) };
  syncClassProps(el, raw.className ?? raw.class);
  const surfaceProps = Object.freeze({
    className: raw.surfaceClassName ?? raw.surfaceClass,
    style: raw.surfaceStyle,
  });
  delete raw.className;
  delete raw.class;
  delete raw.surfaceClassName;
  delete raw.surfaceClass;
  delete raw.surfaceStyle;

  surfacePropsMap.set(el, surfaceProps);
  syncSurfaceProps(el);

  rawMap.set(el, raw);
  const ctrl = ctrlMap.get(el);
  if (ctrl) {
    ctrl.applyRawProps(raw);
  }
}

export function bindElementSurfaceProjection(
  el: HTMLElement,
  projection: HostSurfaceProjection<HTMLElement>
) {
  const previous = surfaceBindingMap.get(el);
  if (previous) {
    previous.unsubscribe();
    clearOwnedSurfaceClasses(previous);
    clearOwnedSurfaceStyles(previous);
  }

  const binding: SurfaceBinding = {
    projection,
    unsubscribe: () => {},
    classTarget: null,
    ownedClasses: new Set(),
    styleTarget: null,
    ownedStyles: new Map(),
  };
  binding.unsubscribe = projection.subscribeSurfaceTarget(() => {
    clearOwnedSurfaceClasses(binding);
    clearOwnedSurfaceStyles(binding);
    syncSurfaceProps(el);
  });
  surfaceBindingMap.set(el, binding);
  syncSurfaceProps(el);

  return () => {
    if (surfaceBindingMap.get(el) !== binding) return;
    binding.unsubscribe();
    clearOwnedSurfaceClasses(binding);
    clearOwnedSurfaceStyles(binding);
    surfaceBindingMap.delete(el);
  };
}

export function getElementProps(el: HTMLElement) {
  return rawMap.get(el);
}

export function bindController(el: HTMLElement, ctrl: RuntimeController) {
  ctrlMap.set(el, ctrl);

  // if props already set before connected, apply once now
  const raw = rawMap.get(el);
  if (raw) ctrl.applyRawProps(raw);
}

export function unbindController(el: HTMLElement) {
  ctrlMap.delete(el);
}

function syncClassProps(el: HTMLElement, value: unknown) {
  const prev = classTokenMap.get(el) ?? new Set<string>();
  const next = normalizeClassTokens(value);

  for (const token of prev) {
    if (!next.has(token)) el.classList.remove(token);
  }

  const owned = new Set<string>();
  for (const token of next) {
    if (!el.classList.contains(token)) {
      el.classList.add(token);
      owned.add(token);
    } else if (prev.has(token)) {
      owned.add(token);
    }
  }

  if (owned.size > 0) {
    classTokenMap.set(el, owned);
  } else {
    classTokenMap.delete(el);
  }
}

function syncSurfaceProps(el: HTMLElement) {
  const binding = surfaceBindingMap.get(el);
  if (!binding) return;
  const props = surfacePropsMap.get(el) ?? { className: undefined, style: undefined };
  syncOwnedSurfaceClasses(binding, props.className);
  syncOwnedSurfaceStyles(binding, props.style);
}

function syncOwnedSurfaceClasses(binding: SurfaceBinding, value: unknown) {
  const target = binding.projection.getSurfaceTarget();
  if (binding.classTarget !== target) clearOwnedSurfaceClasses(binding);
  binding.classTarget = target;
  if (!target) return;

  const next = normalizeClassTokens(value);
  for (const token of binding.ownedClasses) {
    if (!next.has(token)) target.classList.remove(token);
  }

  const owned = new Set<string>();
  for (const token of next) {
    if (!target.classList.contains(token)) {
      target.classList.add(token);
      owned.add(token);
    } else if (binding.ownedClasses.has(token)) {
      owned.add(token);
    }
  }
  binding.ownedClasses = owned;
}

function clearOwnedSurfaceClasses(binding: SurfaceBinding) {
  if (binding.classTarget) {
    for (const token of binding.ownedClasses) binding.classTarget.classList.remove(token);
  }
  binding.classTarget = null;
  binding.ownedClasses = new Set();
}

function syncOwnedSurfaceStyles(binding: SurfaceBinding, value: unknown) {
  const target = binding.projection.getSurfaceTarget();
  if (binding.styleTarget !== target) clearOwnedSurfaceStyles(binding);
  binding.styleTarget = target;
  if (!target) return;

  const next = normalizeSurfaceStyle(value, target.ownerDocument);
  for (const [property, owned] of Array.from(binding.ownedStyles)) {
    if (next.has(property)) continue;
    restoreOwnedStyle(target, property, owned);
    binding.ownedStyles.delete(property);
  }

  for (const [property, style] of next) {
    const owned = binding.ownedStyles.get(property);
    const previousValue = owned?.previousValue ?? target.style.getPropertyValue(property);
    const previousPriority = owned?.previousPriority ?? target.style.getPropertyPriority(property);
    target.style.setProperty(property, style.value, style.priority);
    binding.ownedStyles.set(
      property,
      Object.freeze({
        previousValue,
        previousPriority,
        appliedValue: style.value,
        appliedPriority: style.priority,
      })
    );
  }
}

function clearOwnedSurfaceStyles(binding: SurfaceBinding) {
  if (binding.styleTarget) {
    for (const [property, owned] of binding.ownedStyles) {
      restoreOwnedStyle(binding.styleTarget, property, owned);
    }
  }
  binding.styleTarget = null;
  binding.ownedStyles = new Map();
}

function restoreOwnedStyle(target: HTMLElement, property: string, owned: OwnedStyleValue) {
  if (
    target.style.getPropertyValue(property) !== owned.appliedValue ||
    target.style.getPropertyPriority(property) !== owned.appliedPriority
  ) {
    return;
  }
  if (owned.previousValue) {
    target.style.setProperty(property, owned.previousValue, owned.previousPriority);
  } else {
    target.style.removeProperty(property);
  }
}

function normalizeSurfaceStyle(
  value: unknown,
  doc: Document
): Map<string, Readonly<{ value: string; priority: string }>> {
  const out = new Map<string, Readonly<{ value: string; priority: string }>>();
  if (!value) return out;

  if (typeof value === 'string') {
    const probe = doc.createElement('span');
    probe.style.cssText = value;
    for (let index = 0; index < probe.style.length; index += 1) {
      const property = probe.style.item(index);
      out.set(
        property,
        Object.freeze({
          value: probe.style.getPropertyValue(property),
          priority: probe.style.getPropertyPriority(property),
        })
      );
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      for (const [property, style] of normalizeSurfaceStyle(item, doc)) out.set(property, style);
    }
    return out;
  }

  if (typeof value === 'object') {
    for (const [rawProperty, rawValue] of Object.entries(value as Record<string, unknown>)) {
      if (rawValue == null || rawValue === false) continue;
      const property = normalizeCssProperty(rawProperty);
      const text = String(rawValue);
      const important = /\s*!important\s*$/.test(text);
      out.set(
        property,
        Object.freeze({
          value: important ? text.replace(/\s*!important\s*$/, '') : text,
          priority: important ? 'important' : '',
        })
      );
    }
  }
  return out;
}

function normalizeCssProperty(property: string): string {
  if (property.startsWith('--')) return property;
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function normalizeClassTokens(value: unknown): Set<string> {
  const out = new Set<string>();
  collectClassTokens(value, out);
  return out;
}

function collectClassTokens(value: unknown, out: Set<string>) {
  if (!value) return;

  if (typeof value === 'string') {
    for (const token of value.split(/\s+/)) {
      const normalized = token.trim();
      if (normalized) out.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectClassTokens(item, out);
    return;
  }

  if (typeof value === 'object') {
    for (const [token, enabled] of Object.entries(value as Record<string, unknown>)) {
      if (enabled) collectClassTokens(token, out);
    }
  }
}
