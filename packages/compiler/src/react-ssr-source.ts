import type { PrototypeIR } from './ir';

export const reactSSRTransportArtifact = {
  path: '.proto-ui/context/react-ssr-v1.ts', kind: 'source' as const,
  contents: `import { createContext } from 'react';
// Framework transport only. Request ownership and projections remain in editable target source.
export const ServerTransport = createContext<unknown>(null);
export const HydrationTransport = createContext<unknown>(null);
export const OwnerReady = createContext(true);
`,
};

/** Target-native request lifetime and a data-only speculative hydration shell. */
export function emitReactSSRSupport(p: string, component: string, ir: PrototypeIR): string {
  return `
export type GeneratedTemplateProjection = null | string | number | readonly GeneratedTemplateProjection[]
  | { kind: 'element'; tag: string; key: string | null; attributes: Readonly<Record<string, string>>; children: GeneratedTemplateProjection }
  | { kind: 'slot'; key: string | null };
export type GeneratedInitialData = { kind: 'undefined' } | { kind: 'number'; value: number; negativeZero: boolean }
  | { kind: 'value'; value: null | boolean | string }
  | { kind: 'array'; entries: readonly GeneratedInitialData[] }
  | { kind: 'object'; entries: readonly (readonly [string, GeneratedInitialData])[] };
export interface GeneratedRenderProjection {
  readonly source: string;
  readonly present: boolean;
  readonly rootTag: string;
  readonly properties: Readonly<Record<string, string | number | boolean | null>>;
  readonly template: GeneratedTemplateProjection;
  readonly attributes: Readonly<Record<string, string | null>>;
  readonly raw: GeneratedInitialData;
}
export interface GeneratedHydrationCarrier {
  readonly version: 1;
  readonly profile: 'react-dom-ssr-v1';
  readonly source: string;
  readonly identifierPrefix: string;
  readonly html: string;
  readonly projections: Readonly<Record<string, GeneratedRenderProjection>>;
}
export interface GeneratedServerResult { readonly html: string; readonly carrier: GeneratedHydrationCarrier }
interface ${p}HydrationSession {
  readonly carrier: GeneratedHydrationCarrier;
  readonly pending: Set<string>;
}
const ${p}ServerTransport = ${p}SharedServerTransport as ${p}React.Context<${p}ServerRequest | null>;
const ${p}HydrationTransport = ${p}SharedHydrationTransport as ${p}React.Context<${p}HydrationSession | null>;
const ${p}OwnerReady = ${p}SharedOwnerReady;
function ${p}EncodeData(value: unknown, ancestors = new Set<object>()): GeneratedInitialData {
  if (value === undefined) return { kind: 'undefined' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return { kind: 'value', value };
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value, negativeZero: Object.is(value, -0) };
  if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('[SSR] initial data must be acyclic checked data, not execution identity.');
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new TypeError('[SSR] initial data must be plain data.');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) throw new TypeError('[SSR] sparse/extended initial arrays are not transportable.');
      return { kind: 'array', entries: value.map(item => ${p}EncodeData(item, ancestors)) };
    }
    const entries: [string, GeneratedInitialData][] = [];
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor))
        throw new TypeError('[SSR] initial data cannot transport symbols/accessors/nonenumerable fields.');
      entries.push([key, ${p}EncodeData(descriptor.value, ancestors)]);
    }
    return { kind: 'object', entries };
  } finally { ancestors.delete(value); }
}
function ${p}DecodeData(data: GeneratedInitialData): unknown {
  switch (data.kind) {
    case 'undefined': return undefined;
    case 'value': return data.value;
    case 'number': return data.negativeZero ? -0 : data.value;
    case 'array': return data.entries.map(${p}DecodeData);
    case 'object': {
      const record: Record<string, unknown> = Object.create(null);
      for (const [key, value] of data.entries) record[key] = ${p}DecodeData(value);
      return record;
    }
    default: throw new TypeError('[Hydration] malformed initial-data carrier.');
  }
}
function ${p}EncodeTemplate(node: unknown): GeneratedTemplateProjection {
  if (node === null || node === undefined) return null;
  if (typeof node === 'string' || typeof node === 'number' && Number.isFinite(node)) return node;
  if (Array.isArray(node)) return node.map(${p}EncodeTemplate);
  if (!${p}React.isValidElement(node)) throw new TypeError('[SSR] invalid template projection.');
  const element = node as ${p}React.ReactElement<Record<string, unknown>>;
  if (${p}Slots.has(element)) return { kind: 'slot', key: element.key };
  if (typeof element.type !== 'string') throw new TypeError('[SSR] authored template must contain native elements or portable slots.');
  const attributes: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(element.props)) {
    if (key === 'children') continue;
    if (typeof value !== 'string') throw new TypeError('[SSR] template attribute is not serializable: ' + key);
    attributes[key] = value;
  }
  return { kind: 'element', tag: element.type, key: element.key, attributes, children: ${p}EncodeTemplate(element.props.children) };
}
function ${p}DecodeTemplate(node: GeneratedTemplateProjection, children: ${p}React.ReactNode): ${p}React.ReactNode {
  if (node === null || typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map(item => ${p}DecodeTemplate(item, children));
  const element = node as Exclude<GeneratedTemplateProjection, null | string | number | readonly GeneratedTemplateProjection[]>;
  if (element.kind === 'slot') return ${p}React.createElement(${p}React.Fragment, { key: element.key }, children);
  const decoded = ${p}DecodeTemplate(element.children, children);
  return ${p}React.createElement(element.tag, { ...element.attributes, key: element.key }, ...(Array.isArray(decoded) ? decoded : [decoded]));
}
function ${p}RootAttributes(projection: GeneratedRenderProjection): Record<string, unknown> {
  const attributes: Record<string, unknown> = ${p}RootProperties(projection.properties);
  for (const [key, value] of Object.entries(projection.attributes)) {
    if (value === null) continue;
    attributes[key === 'tabindex' ? 'tabIndex' : key] = key === 'hidden' ? true : value;
  }
  return attributes;
}
function ${p}CheckCarrier(carrier: GeneratedHydrationCarrier): void {
  if (carrier.version !== 1 || carrier.profile !== 'react-dom-ssr-v1' || carrier.source !== ${JSON.stringify(ir.source.sha256)})
    throw new Error('[Hydration] carrier version/source/profile mismatch; adoption was not attempted.');
  if (!Object.keys(carrier.projections).length)
    throw new Error('[Hydration] missing initial component projections; adoption was not attempted.');
}
class ${p}ServerRequest {
  readonly projections: Record<string, GeneratedRenderProjection> = Object.create(null);
  readonly failures: unknown[] = [];
  private readonly instances = new Map<string, { owner: ${p}Owner; projection: GeneratedRenderProjection }>();
  private disposed = false;
  constructor(readonly signal?: AbortSignal) {}
  get ownerCount() { return this.instances.size; }
  prepare(id: string, create: () => { owner: ${p}Owner; projection: GeneratedRenderProjection }) {
    if (this.disposed || this.signal?.aborted) throw this.signal?.reason ?? new Error('[SSR] request aborted.');
    const existing = this.instances.get(id);
    if (existing) {
      try { existing.projection = existing.owner.prepareServer(); this.projections[id] = existing.projection; return existing; }
      catch (error) { this.failures.push(error); throw error; }
    }
    let entry: { owner: ${p}Owner; projection: GeneratedRenderProjection };
    try { entry = create(); } catch (error) { this.failures.push(error); throw error; }
    if (this.disposed || this.signal?.aborted) {
      const error = this.signal?.reason ?? new Error('[SSR] request aborted during owner preparation.');
      try { entry.owner.disposeNow(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[SSR] abort cleanup failed.'); }
      throw error;
    }
    this.instances.set(id, entry); this.projections[id] = entry.projection;
    return entry;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const failures: unknown[] = [];
    for (const entry of [...this.instances.values()].reverse()) {
      try { entry.owner.disposeNow(); } catch (error) { failures.push(error); }
    }
    this.instances.clear();
    if (failures.length) throw new AggregateError(failures, '[SSR] request cleanup failed.');
  }
}
/** An explicit request owns all nested server instances, including failure/abort rollback. */
export function renderGeneratedToString(props: GeneratedComponentProps = {}, options: { signal?: AbortSignal; identifierPrefix?: string } = {}): GeneratedServerResult {
  const request = new ${p}ServerRequest(options.signal);
  const abort = () => request.dispose();
  options.signal?.addEventListener('abort', abort, { once: true });
  let failure: unknown;
  try {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('[SSR] request aborted.');
    const identifierPrefix = options.identifierPrefix ?? '';
    const element = ${p}React.createElement(${p}ServerTransport.Provider, { value: request }, ${p}React.createElement(${component}, props));
    // Discover nested logical owners before serialization. The serialization pass
    // reuses those instances, reflecting child-created Context/state intent and
    // direct-ref IDs without repeating setup/created or claiming physical commits.
    const discovered = ${p}RenderToString(element, { identifierPrefix });
    if (request.failures.length) throw request.failures.length === 1 ? request.failures[0]
      : new AggregateError(request.failures, '[SSR] source failures cannot be accepted as Suspense fallback serialization.');
    const html = request.ownerCount > 1 ? ${p}RenderToString(element, { identifierPrefix }) : discovered;
    if (request.failures.length) throw request.failures.length === 1 ? request.failures[0]
      : new AggregateError(request.failures, '[SSR] source failures cannot be accepted as Suspense fallback serialization.');
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('[SSR] request aborted.');
    return { html, carrier: { version: 1, profile: 'react-dom-ssr-v1', source: ${JSON.stringify(ir.source.sha256)}, identifierPrefix, html, projections: request.projections } };
  } catch (error) { failure = error; throw error; }
  finally {
    options.signal?.removeEventListener('abort', abort);
    try { request.dispose(); } catch (cleanup) { if (failure !== undefined) throw new AggregateError([failure, cleanup], '[SSR] render and cleanup failed.'); throw cleanup; }
  }
}
export interface GeneratedHydratedRoot {
  readonly root: ${p}ReactRoot;
  readonly diagnostics: readonly unknown[];
  getHandle(): GeneratedHandle;
  render(props: GeneratedComponentProps): void;
  unmount(): void;
}
/** React adoption is real; recoverable regeneration is diagnosed and never counted as successful adoption. */
export function hydrateGeneratedRoot(container: Element | Document, props: GeneratedComponentProps, carrier: GeneratedHydrationCarrier,
  options: ${p}HydrationOptions = {}): GeneratedHydratedRoot {
  ${p}CheckCarrier(carrier);
  if (options.identifierPrefix !== undefined && options.identifierPrefix !== carrier.identifierPrefix)
    throw new Error('[Hydration] identifierPrefix differs from the server request.');
  if (container.nodeType !== 1) throw new Error('[Hydration] generated single-Root HTML requires an Element container.');
  const host = container as Element;
  const parsed = host.ownerDocument.createElement('template');
  parsed.innerHTML = carrier.html;
  if (host.innerHTML !== parsed.innerHTML)
    throw new Error('[Hydration] existing HTML differs from the serialized source-bound server view; no owner or replacement was started.');
  const diagnostics: unknown[] = [];
  const ref = ${p}React.createRef<GeneratedHandle>();
  const session: ${p}HydrationSession = { carrier, pending: new Set(Object.keys(carrier.projections)) };
  const render = (next: GeneratedComponentProps) => ${p}React.createElement(${p}HydrationTransport.Provider, { value: session },
    ${p}React.createElement(${component}, { ...next, ref }));
  const originalRoot = container.querySelector('[data-pui-root]');
  let adoptionConfirmed = false;
  const root = ${p}HydrateRoot(container, render(props), { ...options, identifierPrefix: carrier.identifierPrefix,
    onRecoverableError(error, info) { diagnostics.push(error); options.onRecoverableError?.(error, info); if (!options.onRecoverableError) console.error('[Hydration] diagnosed React recovery, not successful adoption:', error); },
  });
  return { root, diagnostics,
    getHandle() {
      if (diagnostics.length || !adoptionConfirmed && originalRoot && container.querySelector('[data-pui-root]') !== originalRoot)
        throw new Error('[Hydration] mismatch recovery replaced/rejected the server view; adoption did not succeed.');
      if (session.pending.size) throw new Error('[Hydration] initial component adoption is not complete.');
      if (!ref.current) throw new Error('[Hydration] owner is not ready before accepted commit.');
      ref.current.getExposes();
      adoptionConfirmed = true;
      return ref.current;
    },
    render(next) { root.render(render(next)); },
    unmount() { root.unmount(); },
  };
}
`;
}
