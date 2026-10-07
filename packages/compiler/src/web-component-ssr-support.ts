interface SsrOptions { className: string; tagName: string; binding: string }

/** Ordinary presentation nodes, not semantic IR. Server owns no DOM objects or browser globals. */
export function webComponentSsrSupport(options: SsrOptions) {
  const {className, tagName, binding} = options;
  const imports = `import {type HostPort, type Presentation, type Carrier, type ServerOptions, type ServerParent, presentationElement, presentationChildren, isPresentation, withServerOwner} from './.proto-ui/web-component/ssr-v1';\nexport type {Carrier, ServerOptions, ServerParent} from './.proto-ui/web-component/ssr-v1';\nexport const hydrationBinding = ${JSON.stringify(binding)};\nexport const defaultTagName = ${JSON.stringify(tagName)};\n`;
  const server = `export function renderToString(props: GeneratedProps & Record<string, unknown> = {}, options: ServerOptions = {}): {html: string; carrier: Carrier} {
  return renderWithScope(props, options, result => result);
}
/** Descendants render inside this callback while this request's actual provider owner is live. */
export function renderWithScope<T>(props: GeneratedProps & Record<string, unknown>, options: ServerOptions, consume: (result: {html: string; carrier: Carrier}, parent: ServerParent) => T): T {
  return withServerOwner(createHydrationOwner, props, options, hydrationBinding, defaultTagName, consume);
}
`;
  const client = `// Browser-only entry. Import Component.ts on the server, never this module.
import {createHydrationOwner, hydrationBinding, defaultTagName, type GeneratedProps, type GeneratedExposes, type HydrationOwner} from './Component';
import {type Carrier, type BrowserPort, createBrowserPort, readCarrier, checkCarrier, decodeRaw, pendingProviderDefinition, HydrationMismatch} from './.proto-ui/web-component/ssr-v1';
export {HydrationMismatch} from './.proto-ui/web-component/ssr-v1';
export class ${className} extends HTMLElement {
  private owner: HydrationOwner | null = null;
  private port: BrowserPort | null = null;
  private raw: Record<string, unknown> = {};
  private hasRaw = false;
  private carrier: Carrier | null = null;
  private closed = false;
  private disconnectVersion = 0;
  private recovering = false;
  private initializedCarrier = false;
  private failedCarrier: Carrier | null = null;
  hydrationStatus: 'pending' | 'adopted' | 'recovered' | 'client' | 'mismatch' = 'pending';
  hydrationDiagnostic: HydrationMismatch | null = null;
  get logicalOwner(): symbol | null { return this.owner?.identity ?? null; }
  get viewEpoch(): number { return this.owner?.epoch ?? 0; }
  get present(): boolean { return this.owner?.view ?? false; }
  connectedCallback(): void {
    ++this.disconnectVersion;
    if (this.closed) return;
    if (this.owner) { this.owner.reconcile(); return; }
    const definition = pendingProviderDefinition(this);
    if (definition) {
      const version = this.disconnectVersion;
      definition.then(() => {
        if (this.closed || version !== this.disconnectVersion || !this.isConnected || this.owner) return;
        this.connectedCallback();
      });
      return;
    }
    try {
      const carrier = this.recovering ? this.failedCarrier : this.carrier ?? (!this.initializedCarrier ? readCarrier(this) : null);
      this.failedCarrier = carrier;
      if (carrier && !this.recovering) checkCarrier(carrier, hydrationBinding, this.localName);
      let mode = carrier?.mode ?? 'light';
      if (this.recovering) mode = carrier?.mode === 'shadow' || this.shadowRoot || this.querySelector(':scope > template[shadowrootmode="open"]') ? 'shadow' : 'light';
      const port = createBrowserPort(this, mode, carrier && !this.recovering ? carrier : null, this.recovering);
      this.port = port;
      const pending = this.hasRaw ? this.raw : null;
      const initial = carrier && !this.recovering ? decodeRaw(carrier.raw) : this.raw;
      if (!pending) this.raw = {...initial};
      const owner = createHydrationOwner(port, initial);
      this.owner = owner;
      try { owner.reconcile(); }
      catch (error) { this.owner = null; try { owner.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Hydration and cleanup failed'); } throw error; }
      port.accept();
      if (this.closed || this.owner !== owner) return;
      this.initializedCarrier = true;
      this.carrier = null;
      this.failedCarrier = null;
      this.hydrationStatus = this.recovering ? 'recovered' : carrier ? 'adopted' : 'client';
      this.recovering = false;
      // Initial handoff is silent; a newer client snapshot is a real post-commit Props transition.
      if (this.hasRaw && carrier) owner.hydrate(this.raw);
    } catch (error) {
      const owner = this.owner; this.owner = null;
      let failure = error;
      try { owner?.dispose(); } catch (cleanup) { failure = new AggregateError([error, cleanup], 'Initialization and cleanup failed'); }
      finally { this.port?.dispose(); this.port = null; }
      if (error instanceof HydrationMismatch) { this.hydrationStatus = 'mismatch'; this.hydrationDiagnostic = error; }
      throw failure;
    }
  }
  disconnectedCallback(): void {
    const version = ++this.disconnectVersion, owner = this.owner;
    queueMicrotask(() => {
      if (version !== this.disconnectVersion || this.isConnected || !owner || owner !== this.owner) return;
      this.owner = null;
      try { owner.dispose(); } finally { this.port?.dispose(); this.port = null; }
    });
  }
  setProps(next: GeneratedProps & Record<string, unknown>): void {
    if (this.closed) throw new Error('Custom element is disposed');
    this.hasRaw = true; this.raw = {...next};
    if (this.owner) this.owner.hydrate(this.raw);
  }
  update(): void { if (this.closed) throw new Error('Custom element is disposed'); this.owner?.update(); }
  getExposes(): Partial<GeneratedExposes> { return this.isConnected && this.owner ? {...this.owner.exposes} as Partial<GeneratedExposes> : {}; }
  hydrate(next: Carrier): void {
    if (this.closed) throw new Error('Custom element is disposed');
    checkCarrier(next, hydrationBinding, this.localName);
    if (this.owner) throw new Error('Custom element already owns a committed instance');
    if (this.initializedCarrier) throw new Error('Carrier has already been adopted');
    this.carrier = next;
    if (this.isConnected) this.connectedCallback();
  }
  /** Recovery is opt-in and reports recovered, never adopted. Existing external slot nodes are preserved. */
  recover(next?: GeneratedProps & Record<string, unknown>): void {
    if (this.closed) throw new Error('Custom element is disposed');
    if (this.hydrationStatus !== 'mismatch') throw new Error('Recovery requires a diagnosed hydration mismatch');
    if (next) { this.raw = {...next}; this.hasRaw = true; }
    this.carrier = this.failedCarrier;
    this.recovering = true;
    if (this.isConnected) this.connectedCallback();
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true; ++this.disconnectVersion;
    const owner = this.owner; this.owner = null;
    try { owner?.dispose(); } finally { this.port?.dispose(); this.port = null; this.carrier = null; }
  }
}
export function register(tagName = defaultTagName, registry: CustomElementRegistry = customElements): typeof ${className} {
  const existing = registry.get(tagName);
  if (existing && existing !== ${className}) throw new Error('Custom element tag already registered: ' + tagName);
  if (!existing) registry.define(tagName, ${className});
  return ${className};
}
/** Define first; server carriers auto-adopt on upgrade. This entry also accepts an explicit carrier on a detached element. */
export function hydrate(element: ${className}, carrier?: Carrier): ${className} {
  if (!(element instanceof ${className})) throw new Error('Register the generated Custom Element before hydrating');
  if (carrier) checkCarrier(carrier, hydrationBinding, element.localName);
  if (element.hydrationStatus === 'mismatch') throw element.hydrationDiagnostic;
  if (carrier && element.hydrationStatus === 'pending') element.hydrate(carrier);
  else if (!element.logicalOwner && element.isConnected) element.connectedCallback();
  return element;
}
export default ${className};
`;
  return {imports, server, files: [
    {path: '.proto-ui/web-component/ssr-v1.ts', kind: 'source' as const, contents: runtimeSource},
    {path: 'Component.client.ts', kind: 'source' as const, contents: client},
  ]};
}

const runtimeSource = String.raw`// Standalone WC presentation/serialization/adoption helper. Not an IR interpreter.
// No DOM global is accessed at module evaluation or during server rendering.
import {createNativeInteraction, markNativeExposeEvent, type NativeInteraction} from '../interaction/native-v1';
import {ownerScopes, type ContextScope} from '../context/scope-v1';
export type Presentation = {kind: 'element'; tag: string; style?: string; children: Presentation[]} | {kind: 'text'; text: string} | {kind: 'slot'};
export type RawData = [string, {kind: 'undefined'} | {kind: 'value'; value: unknown}][];
export type ControlProjection = {tag: string; properties: Readonly<Record<string, string | number | boolean | null>>; attributes: Record<string, string>};
export type Carrier = {version: 1; profile: 'web-component-ssr-v1'; binding: string; tagName: string; mode: 'light' | 'shadow'; raw: RawData; presentation: Presentation[]; control: ControlProjection | null; attributes: Record<string, string>; interactionAttributes: Record<string, string | null>; baselines: Record<string, string>; present: boolean};
export type InteractionOptions<R> = Parameters<typeof createNativeInteraction<R>>[0];
export type HostPort = {
  readonly server: boolean; readonly isConnected: boolean; readonly root: HTMLElement | null;
  readonly host: HTMLElement | null;
  readonly hydrationAttributes?: Readonly<Record<string, string | null>>;
  readonly hydrationBaselines?: Readonly<Record<string, string | null>>;
  createInteraction<R>(options: InteractionOptions<R>): NativeInteraction<R>;
  projectRoot(tag: string | null, properties: Readonly<Record<string, string | number | boolean | null>>, portal: HTMLElement | null): void;
  attribute(name: string, value: string | null): void;
  projectInteraction(snapshot: Readonly<Record<string, string | null>>): void;
  commit(children: Presentation[]): void; clear(): void; visible(present: boolean): void;
  emit(key: string, payload?: unknown, options?: CustomEventInit): void;
  parentContext(): ContextScope | null; bindContext(scope: ContextScope | null): void;
};
export type ServerParent = {readonly context: ContextScope | null; readonly alive: boolean};
export type ServerOptions = {mode?: 'light' | 'shadow'; slotHtml?: string | ((parent: ServerParent) => string); signal?: AbortSignal; parent?: ServerParent; rootAttributes?: Record<string, string>};
export class HydrationMismatch extends Error {
  readonly code = 'PUI_WC_HYDRATION_MISMATCH';
  constructor(readonly reason: string, readonly path = 'Root') { super('WC hydration mismatch at ' + path + ': ' + reason); this.name = 'HydrationMismatch'; }
}
export function isPresentation(value: unknown): value is Presentation {
  return !!value && typeof value === 'object' && ['element','text','slot'].includes((value as {kind: string}).kind);
}
export function presentationChildren(input: unknown): Presentation[] {
  const result: Presentation[] = [];
  function append(value: unknown) {
    if (value === null) return;
    if (Array.isArray(value)) { for (const child of value) append(child); return; }
    const node = typeof value === 'string' || typeof value === 'number' ? {kind: 'text' as const, text: String(value)} : value;
    if (!isPresentation(node)) throw new TypeError('Invalid template child');
    if (node.kind === 'text') {
      // HTML parsers coalesce adjacent text; canonicalize without changing the text content.
      if (!node.text) return;
      const previous = result[result.length - 1];
      if (previous?.kind === 'text') { previous.text += node.text; return; }
      result.push({kind: 'text', text: node.text});
    } else result.push(node);
  }
  append(input); return result;
}
export function presentationElement(tag: string, style: string | undefined, children: unknown): Presentation {
  if (!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(tag)) throw new TypeError('Invalid template tag');
  return {kind: 'element', tag: tag.toLowerCase(), ...(style === undefined ? {} : {style}), children: presentationChildren(children)};
}
function checkData(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || seen.has(value)) throw new TypeError('SSR transport requires finite acyclic JSON data');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError('SSR transport rejects non-data objects');
  seen.add(value);
  try {
    if (array && Object.keys(value).length !== (value as unknown[]).length) throw new TypeError('SSR transport rejects sparse arrays');
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      const field = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== 'string' || !field.enumerable || !('value' in field)) throw new TypeError('SSR transport rejects accessor/symbol fields');
      checkData(field.value, seen);
    }
  } finally { seen.delete(value); }
}
function encodeRaw(raw: Record<string, unknown>): RawData {
  function encode(value: unknown, seen = new Set<object>()): unknown {
    if (value === undefined) return ['undefined'];
    if (Object.is(value, -0)) return ['negative-zero'];
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) throw new TypeError('Non-portable initial data');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError('Capabilities cannot enter initial data');
    seen.add(value);
    try { return array ? ['array', value.map(item => encode(item, seen))] : ['record', Object.entries(value).map(([key,item]) => [key,encode(item, seen)])]; }
    finally { seen.delete(value); }
  }
  return Object.keys(raw).map(key => [key, {kind:'value',value:encode(raw[key])}]);
}
export function decodeRaw(data: RawData): Record<string, unknown> {
  function decode(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    if (value[0] === 'undefined') return undefined;
    if (value[0] === 'negative-zero') return -0;
    if (value[0] === 'array') return value[1].map(decode);
    if (value[0] === 'record') return Object.fromEntries(value[1].map(([key,item]: [string,unknown]) => [key,decode(item)]));
    throw new HydrationMismatch('invalid initial data tag');
  }
  const raw = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of data) {
    if (Object.hasOwn(raw, key)) throw new HydrationMismatch('duplicate raw Prop key');
    raw[key] = value.kind === 'undefined' ? undefined : decode(value.value);
  }
  return raw;
}
export function checkCarrier(carrier: Carrier, binding: string, tag: string): void {
  try { checkData(carrier); } catch { throw new HydrationMismatch('carrier contains non-transport data'); }
  if (!carrier || typeof carrier !== 'object') throw new HydrationMismatch('invalid carrier');
  if (carrier.version !== 1 || carrier.profile !== 'web-component-ssr-v1' || carrier.binding !== binding || carrier.tagName !== tag)
    throw new HydrationMismatch('source/profile/tag binding differs');
  if (!['light', 'shadow'].includes(carrier.mode) || typeof carrier.present !== 'boolean' || !Array.isArray(carrier.raw) || !Array.isArray(carrier.presentation)) throw new HydrationMismatch('invalid carrier');
  for (const entry of carrier.raw) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[1] || typeof entry[1] !== 'object' || !['undefined','value'].includes(entry[1].kind) || entry[1].kind === 'value' && !Object.hasOwn(entry[1], 'value')) throw new HydrationMismatch('invalid raw Prop entry');
  }
  for (const snapshot of [carrier.attributes, carrier.interactionAttributes, carrier.baselines]) {
    if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || Object.values(snapshot).some(value => value !== null && typeof value !== 'string')) throw new HydrationMismatch('invalid Root attribute snapshot');
  }
  let slots = 0;
  function checkChildren(children: Presentation[]) {
    for (const node of children) {
      if (!node || typeof node !== 'object') throw new HydrationMismatch('invalid presentation node');
      if (node.kind === 'slot') { if (++slots > 1) throw new HydrationMismatch('multiple slot projection'); }
      else if (node.kind === 'text') { if (typeof node.text !== 'string') throw new HydrationMismatch('invalid text projection'); }
      else if (node.kind === 'element') {
        if (typeof node.tag !== 'string' || !/^[a-z][a-z0-9:_-]*$/.test(node.tag) || node.style !== undefined && typeof node.style !== 'string' || !Array.isArray(node.children)) throw new HydrationMismatch('invalid element projection');
        checkChildren(node.children);
      } else throw new HydrationMismatch('unknown presentation node');
    }
  }
  checkChildren(carrier.presentation);
  decodeRaw(carrier.raw);
}
function escapeText(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttribute(value: string): string { return escapeText(value).replace(/"/g, '&quot;'); }
const voidTags: Record<string, true> = {area:true,base:true,br:true,col:true,embed:true,hr:true,img:true,input:true,link:true,meta:true,param:true,source:true,track:true,wbr:true};
function serialize(children: Presentation[], mode: 'light' | 'shadow', slotHtml: string): string {
  return children.map(node => {
    if (node.kind === 'text') return escapeText(node.text);
    if (node.kind === 'slot') return mode === 'shadow' ? '<slot></slot>' : '<!--pui-slot-start-->' + slotHtml + '<!--pui-slot-end-->';
    const style = node.style === undefined ? '' : ' data-pui-style="' + escapeAttribute(node.style) + '"';
    if (voidTags[node.tag]) {
      if (node.children.length) throw new TypeError('Void template element cannot have children: ' + node.tag);
      return '<' + node.tag + style + '>';
    }
    return '<' + node.tag + style + '>' + serialize(node.children, mode, slotHtml) + '</' + node.tag + '>';
  }).join('');
}
export type ServerPort = HostPort & {presentation: Presentation[]; control: ControlProjection | null; attributes: Record<string, string>; interactionAttributes: Record<string, string | null>; present: boolean; parent: ServerParent; emissions: {key: string; payload: unknown; options?: CustomEventInit}[]; close(): void};
export function createServerPort(options: ServerOptions): ServerPort {
  let alive = true, context: ContextScope | null = null;
  if (options.parent && !options.parent.alive) throw new Error('Server logical parent is disposed');
  const parent: ServerParent = {get context() { if (!alive) throw new Error('Server owner is disposed'); return context; }, get alive() { return alive; }};
  const port: ServerPort = {
    server: true, get isConnected() { return alive; }, root: null, host: null, parent, control: null,
    presentation: [], attributes: {...options.rootAttributes}, interactionAttributes: Object.create(null), present: true, emissions: [],
    createInteraction: createNativeInteraction,
    projectRoot(tag, properties) { if (tag && !['input','textarea','img'].includes(tag)) throw new Error('Unsupported physical Root tag'); port.control = tag ? {tag, properties, attributes: port.control?.attributes ?? {}} : null; },
    attribute(name, value) { const attributes = port.control?.attributes ?? port.attributes; if (value === null) delete attributes[name]; else attributes[name] = value; },
    projectInteraction(snapshot) { port.interactionAttributes = {...snapshot}; for (const [key, value] of Object.entries(snapshot)) port.attribute(key, value); },
    commit(children) { if (port.control && children.length) throw new Error('[Template] physical control Root requires empty children'); port.presentation = children; }, clear() { port.presentation = []; }, visible(next) { port.present = next; },
    emit(key, payload, eventOptions) { port.emissions.push({key, payload, options: eventOptions}); },
    parentContext() { if (options.parent && !options.parent.alive) throw new Error('Server logical parent is disposed'); return options.parent?.context ?? null; },
    bindContext(next) { context = next; },
    close() { alive = false; context = null; port.presentation = []; port.emissions.length = 0; },
  };
  return port;
}
export function finishServer(port: ServerPort, props: Record<string, unknown>, options: ServerOptions, binding: string, tagName: string): {html: string; carrier: Carrier} {
  const mode = options.mode ?? 'light';
  if (mode !== 'light' && mode !== 'shadow') throw new TypeError('Invalid server rendering mode');
  const attributes = {...port.attributes};
  for (const [name, value] of Object.entries(attributes)) {
    if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name) || typeof value !== 'string') throw new TypeError('Invalid serialized Root attribute: ' + name);
  }
  if (!port.present) attributes.style = (attributes.style ? attributes.style + ';' : '') + 'display:none!important';
  const carrier: Carrier = {version: 1, profile: 'web-component-ssr-v1', binding, tagName, mode, raw: encodeRaw(props), presentation: JSON.parse(JSON.stringify(port.presentation)), control: port.control, attributes, interactionAttributes: {...port.interactionAttributes}, baselines: {...options.rootAttributes}, present: port.present};
  const tokens = Object.entries(attributes).map(([name, value]) => ' ' + name + '="' + escapeAttribute(value) + '"').join('');
  const slotHtml = typeof options.slotHtml === 'function' ? options.slotHtml(port.parent) : options.slotHtml ?? '';
  if (typeof slotHtml !== 'string') throw new TypeError('Native server slot must serialize to HTML');
  options.signal?.throwIfAborted();
  let content = serialize(carrier.presentation, mode, slotHtml);
  if (carrier.control && carrier.present) {
    const control = carrier.control, properties = {...control.properties, ...control.attributes};
    let attrs = ' part="' + (control.tag === 'img' ? 'image' : 'control') + '"';
    for (const [name, value] of Object.entries(properties)) {
      if (value === null || value === false || control.tag === 'textarea' && name === 'value') continue;
      attrs += ' ' + name + '="' + escapeAttribute(value === true ? '' : String(value)) + '"';
    }
    content = '<' + control.tag + attrs + '>' + (control.tag === 'textarea' ? escapeText(String(properties.value ?? '')) + '</textarea>' : '');
  }
  function hasSlot(children: Presentation[]): boolean {
    for (const child of children) if (child.kind === 'slot' || child.kind === 'element' && hasSlot(child.children)) return true;
    return false;
  }
  const retained = mode === 'shadow' || !hasSlot(carrier.presentation) ? slotHtml : '';
  const projection = mode === 'shadow' ? '<template shadowrootmode="open">' + content + '</template>' + retained : '<!--pui-root-start-->' + content + '<!--pui-root-end-->' + retained;
  const json = JSON.stringify(carrier).replace(/</g, '\\u003c').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return {html: '<' + tagName + tokens + '>' + projection + '<script type="application/json" data-pui-carrier="' + binding + '">' + json + '</script></' + tagName + '>', carrier};
}
type ServerOwner = {serialize(): void; dispose(): void};
export function withServerOwner<O extends ServerOwner, T>(factory: (port: HostPort, raw: Record<string, unknown>) => O, props: Record<string, unknown>, options: ServerOptions, binding: string, tag: string, consume: (result: {html: string; carrier: Carrier}, parent: ServerParent) => T): T {
  options.signal?.throwIfAborted();
  const port = createServerPort(options);
  let owner: O | undefined, failure: unknown, result: T, failed = false;
  let abortFailure: unknown, abortFailed = false;
  const abort = () => { try { owner?.dispose(); } catch (error) { abortFailure = error; abortFailed = true; } finally { port.close(); } };
  options.signal?.addEventListener('abort', abort, {once: true});
  try {
    owner = factory(port, props);
    options.signal?.throwIfAborted();
    // Resolve supplied children while the logical provider is live, before its final projection.
    // Child created callbacks may update the provider; the parent then serializes the latest intent.
    const slotHtml = typeof options.slotHtml === 'function' ? options.slotHtml(port.parent) : options.slotHtml;
    if (slotHtml !== undefined && typeof slotHtml !== 'string') throw new TypeError('Native server slot must serialize to HTML');
    options.signal?.throwIfAborted();
    owner.serialize();
    options.signal?.throwIfAborted();
    result = consume(finishServer(port, props, {...options, slotHtml}, binding, tag), port.parent);
    if (result && typeof (result as {then?: unknown}).then === 'function') throw new TypeError('Server logical scope callback must be synchronous');
    options.signal?.throwIfAborted();
  } catch (error) { failure = error; failed = true; }
  finally {
    options.signal?.removeEventListener('abort', abort);
    try { owner?.dispose(); } catch (error) { failure = failed ? new AggregateError([failure, error], 'Server execution and cleanup failed') : error; failed = true; }
    port.close();
    if (abortFailed) { failure = failed ? new AggregateError([failure, abortFailure], 'Server abort cleanup failed') : abortFailure; failed = true; }
  }
  if (failed) throw failure;
  return result!;
}
export type BrowserPort = HostPort & {accept(): void; dispose(): void};
function marker(node: Node | null, text: string): node is Comment { return !!node && node.nodeType === 8 && node.nodeValue === text; }
function carrierNode(host: HTMLElement): HTMLScriptElement | null {
  const nodes = Array.from(host.children).filter(node => node.localName === 'script' && node.hasAttribute('data-pui-carrier'));
  if (nodes.length > 1) throw new HydrationMismatch('multiple transport carriers');
  return nodes[0] as HTMLScriptElement | undefined ?? null;
}
export function readCarrier(host: HTMLElement): Carrier | null {
  const node = carrierNode(host);
  if (!node) return null;
  try { return JSON.parse(node.textContent ?? '') as Carrier; }
  catch (error) { throw new HydrationMismatch('invalid carrier JSON'); }
}
function logicalParent(host: HTMLElement): ContextScope | null {
  if (!host.isConnected) return null;
  let node: Node | null = host;
  while (node) {
    const slot: HTMLSlotElement | null = node.nodeType === 1 ? (node as Element).assignedSlot : null;
    node = slot ?? (node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : node.parentNode);
    if (node) { const scope = ownerScopes.get(node); if (scope) return scope; }
  }
  return null;
}
/** Delay owner construction, not just input delivery, until an actual carrier-bearing provider upgrades. */
export function pendingProviderDefinition(host: HTMLElement): Promise<CustomElementConstructor> | null {
  let node: Node | null = host;
  while (node) {
    const slot: HTMLSlotElement | null = node.nodeType === 1 ? (node as Element).assignedSlot : null;
    node = slot ?? (node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : node.parentNode);
    if (node?.nodeType !== 1 || ownerScopes.has(node)) continue;
    const parent = node as HTMLElement;
    if (!parent.localName.includes('-') || !carrierNode(parent)) continue;
    const registry = parent.ownerDocument.defaultView!.customElements;
    if (!registry.get(parent.localName)) return registry.whenDefined(parent.localName);
  }
  return null;
}
export function createBrowserPort(host: HTMLElement, mode: 'light' | 'shadow', carrier: Carrier | null, recovery: boolean): BrowserPort {
  const doc = host.ownerDocument;
  let root: HTMLElement | ShadowRoot = host;
  if (recovery) for (const node of Array.from(host.children)) if (node.localName === 'script' && node.hasAttribute('data-pui-carrier')) node.remove();
  const script = carrierNode(host);
  if (carrier && mode === 'light' && host.shadowRoot) throw new HydrationMismatch('light carrier has a physical Shadow Root');
  if (mode === 'shadow') {
    if (host.shadowRoot) root = host.shadowRoot;
    else {
      const declarative = Array.from(host.children).find(node => node.localName === 'template' && node.getAttribute('shadowrootmode') === 'open') as HTMLTemplateElement | undefined;
      if (carrier && !declarative) throw new HydrationMismatch('declarative Shadow Root is absent');
      root = host.attachShadow({mode: 'open'});
      if (declarative) { root.appendChild(declarative.content); declarative.remove(); }
    }
  }
  let accepted = false, disposed = false, hydrating = !!carrier;
  let control: HTMLElement | null = null;
  let portalAnchor: Comment | null = null, portalParent: ContextScope | null = null;
  const emissions: {key: string; payload: unknown; options?: CustomEventInit}[] = [];
  let owned = new WeakSet<Node>(), projected: Node[] = [], start: Comment | null = null, end: Comment | null = null;
  let rootStart: Comment | null = null, rootEnd: Comment | null = null;
  let observer: MutationObserver | null = null;
  const attributes = new Map<string, {baseline: string | null; projected: string | null}>();
  let display: {value: string; priority: string} | null = null;
  if (carrier && !carrier.present) {
    const baseline = doc.createElement('div').style;
    baseline.cssText = carrier.baselines.style ?? '';
    display = {value: baseline.getPropertyValue('display'), priority: baseline.getPropertyPriority('display')};
  }
  let expected: Presentation[] | null = null;
  function slotNodes(): Node[] {
    if (!start || !end || start.parentNode !== end.parentNode) return [];
    const nodes: Node[] = [];
    for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) nodes.push(node);
    return nodes;
  }
  function matchList(parent: Node, first: Node | null, boundary: Node | null, children: Presentation[], path: string, mark: boolean): void {
    let current = first;
    for (let index = 0; index < children.length; ++index) {
      const expected = children[index], at = path + '/' + index;
      if (!current || current === boundary) throw new HydrationMismatch('missing physical node', at);
      if (expected.kind === 'slot' && mode === 'light') {
        if (!marker(current, 'pui-slot-start')) throw new HydrationMismatch('light slot start differs', at);
        const slotStart = current;
        let slotEnd: Node | null = current.nextSibling;
        while (slotEnd && slotEnd !== boundary && !marker(slotEnd, 'pui-slot-end')) slotEnd = slotEnd.nextSibling;
        if (!marker(slotEnd, 'pui-slot-end')) throw new HydrationMismatch('light slot end differs', at);
        if (mark) { start = slotStart; end = slotEnd; owned.add(start); owned.add(end); projected = slotNodes(); }
        current = slotEnd.nextSibling; continue;
      }
      if (expected.kind === 'text') {
        if (current.nodeType !== 3 || current.nodeValue !== expected.text) throw new HydrationMismatch('text differs', at);
      } else {
        const tag = expected.kind === 'slot' ? 'slot' : expected.tag;
        if (current.nodeType !== 1 || (current as Element).localName !== tag) throw new HydrationMismatch('element tag differs', at);
        const el = current as Element;
        if (expected.kind === 'element' && (el.getAttribute('data-pui-style') ?? undefined) !== expected.style) throw new HydrationMismatch('template style differs', at);
        matchList(el, el.firstChild, null, expected.kind === 'slot' ? [] : expected.children, at, mark);
      }
      if (mark) owned.add(current);
      current = current.nextSibling;
    }
    if (current !== boundary) throw new HydrationMismatch('unexpected physical node', path);
  }
  function locateRange(): void {
    if (mode !== 'light') return;
    for (const node of Array.from(host.childNodes)) {
      if (marker(node, 'pui-root-start')) { if (rootStart) throw new HydrationMismatch('duplicate Root marker'); rootStart = node; }
      if (marker(node, 'pui-root-end')) { if (rootEnd) throw new HydrationMismatch('duplicate Root marker'); rootEnd = node; }
    }
    if (carrier && (!rootStart || !rootEnd)) throw new HydrationMismatch('light Root ownership markers are absent');
  }
  locateRange();
  if (carrier) {
    if (carrier.control && carrier.present) {
      const candidate = mode === 'light' ? rootStart!.nextSibling : root.firstChild;
      if (candidate?.nodeType !== 1 || (candidate as Element).localName !== carrier.control.tag || candidate.nextSibling !== (mode === 'light' ? rootEnd : null)) throw new HydrationMismatch('physical control Root differs');
      control = candidate as HTMLElement; owned.add(control);
    } else matchList(root, mode === 'light' ? rootStart!.nextSibling : root.firstChild, mode === 'light' ? rootEnd : null, carrier.presentation, 'Root', true);
    expected = carrier.presentation;
  }
  function pool(): Node[] {
    const result = [...projected.filter(node => !!node.parentNode)];
    if (mode === 'light') for (const node of Array.from(host.childNodes)) {
      if (node === script || node === rootStart || node === rootEnd || owned.has(node)) continue;
      result.push(node);
    }
    return [...new Set(result)];
  }
  function projectNewChildren(): void {
    if (!end?.parentNode || disposed) return;
    const inPlace = end.parentNode === host ? new Set(slotNodes()) : null;
    for (const node of Array.from(host.childNodes)) {
      if (node === script || node === rootStart || node === rootEnd || owned.has(node) || node === end || node === start) continue;
      // Direct slot range requires no movement; every other external direct child is projected.
      if (inPlace?.has(node)) continue;
      end.parentNode.insertBefore(node, end);
      if (!projected.includes(node)) projected.push(node);
    }
    projected = projected.filter(node => !!node.parentNode);
  }
  function observe(): void {
    if (mode !== 'light' || !end) return;
    if (!observer) {
      observer = new (doc.defaultView!.MutationObserver)(projectNewChildren);
      observer.observe(host, {childList: true, subtree: true});
    }
  }
  function materialize(parent: Node, children: Presentation[], slotPool: Node[]): void {
    for (const child of children) {
      let node: Node;
      if (child.kind === 'slot' && mode === 'light') {
        start = doc.createComment('pui-slot-start'); end = doc.createComment('pui-slot-end');
        owned.add(start); owned.add(end); parent.appendChild(start);
        for (const external of slotPool) parent.appendChild(external);
        parent.appendChild(end); projected = slotPool; continue;
      }
      if (child.kind === 'text') node = doc.createTextNode(child.text);
      else {
        const el = doc.createElement(child.kind === 'slot' ? 'slot' : child.tag);
        if (child.kind === 'element') { if (child.style !== undefined) el.setAttribute('data-pui-style', child.style); materialize(el, child.children, slotPool); }
        node = el;
      }
      owned.add(node); parent.appendChild(node);
    }
  }
  function ownRootRange(first: Node, last: Node): void {
    if (first.parentNode !== last.parentNode) throw new HydrationMismatch('owned range has different physical parents');
    for (let node: Node | null = first; node; node = node.nextSibling) {
      owned.add(node);
      if (node === last) return;
    }
    throw new HydrationMismatch('owned range end is unreachable');
  }
  function removeOwned(): void {
    for (const node of Array.from(root.childNodes)) if (mode === 'shadow' || owned.has(node) || node === rootStart || node === rootEnd) node.parentNode?.removeChild(node);
    rootStart = null; rootEnd = null;
  }
  const port: BrowserPort = {
    server: false, get isConnected() { return host.isConnected && !disposed; }, host, get root() { return control ?? host; },
    hydrationAttributes: carrier?.interactionAttributes,
    hydrationBaselines: carrier?.baselines,
    createInteraction: createNativeInteraction,
    projectRoot(tag, properties, portal) {
      if (tag && !['input','textarea','img'].includes(tag)) throw new Error('Unsupported physical Root tag');
      if (hydrating && (carrier?.control?.tag ?? null) !== tag) throw new HydrationMismatch('client physical Root differs from carrier');
      if (tag && !control) { control = doc.createElement(tag); control.setAttribute('part', tag === 'img' ? 'image' : 'control'); owned.add(control); }
      if (control && control.localName !== tag) throw new Error('Physical control declaration cannot change during an owner lifetime');
      if (control && !hydrating) for (const [name, value] of Object.entries(properties)) {
        if (name === 'value') { if (!accepted) (control as HTMLInputElement).value = String(value ?? ''); continue; }
        if (value === null || value === false) control.removeAttribute(name);
        else control.setAttribute(name, value === true ? '' : String(value));
      }
      if (portal) {
        if (!portalAnchor) { portalParent = logicalParent(host); portalAnchor = doc.createComment('pui-portal'); host.parentNode?.insertBefore(portalAnchor, host); }
        if (host.parentNode !== portal) portal.appendChild(host);
      } else if (portalAnchor) {
        portalAnchor.parentNode?.insertBefore(host, portalAnchor); portalAnchor.remove(); portalAnchor = null; portalParent = null;
      }
    },
    projectInteraction(snapshot) { for (const [key, value] of Object.entries(snapshot)) port.attribute(key, value); },
    attribute(name, value) {
      let entry = attributes.get(name);
      const target = control ?? host;
      const current = target.getAttribute(name);
      if (!entry) {
        const projectedByServer = carrier && Object.hasOwn(carrier.attributes, name) && current === carrier.attributes[name];
        entry = {baseline: projectedByServer ? carrier.baselines[name] ?? null : current, projected: current}; attributes.set(name, entry);
      }
      else if (current !== entry.projected) entry.baseline = current;
      if (current !== value) { if (value === null) target.removeAttribute(name); else target.setAttribute(name, value); }
      entry.projected = value;
    },
    commit(children) {
      if (disposed) throw new Error('Browser port is disposed');
      if (hydrating) {
        if (JSON.stringify(children) !== JSON.stringify(expected)) throw new HydrationMismatch('fresh client presentation differs from server projection');
        // Validate a second time immediately before semantic commit; never clear on matching adoption.
        if (!control) matchList(root, mode === 'light' ? rootStart!.nextSibling : root.firstChild, mode === 'light' ? rootEnd : null, children, 'Root', false);
        hydrating = false; projectNewChildren(); observe(); return;
      }
      if (control) {
        if (children.length) throw new Error('[Template] physical control Root requires empty children');
        if (control.parentNode !== root) root.appendChild(control);
        return;
      }
      const slotPool = mode === 'light' ? pool() : [];
      for (const node of slotPool) node.parentNode?.removeChild(node);
      observer?.disconnect(); observer = null;
      removeOwned(); owned = new WeakSet(); projected = []; start = null; end = null;
      const fragment = doc.createDocumentFragment(); materialize(fragment, children, slotPool);
      root.appendChild(fragment);
      if (!start) for (const node of slotPool) host.appendChild(node);
      observe();
    },
    visible(present) {
      if (!present) {
        if (!display) display = {value: host.style.getPropertyValue('display'), priority: host.style.getPropertyPriority('display')};
        host.style.setProperty('display', 'none', 'important');
      } else if (display) {
        if (host.style.getPropertyValue('display') === 'none' && host.style.getPropertyPriority('display') === 'important') {
          if (display.value) host.style.setProperty('display', display.value, display.priority); else host.style.removeProperty('display');
        }
        display = null;
      }
    },
    clear() {
      if (!accepted && hydrating) return; // Failed matching checks must not destroy server output.
      const slotPool = mode === 'light' ? pool().filter(node => node !== control) : [];
      for (const node of slotPool) node.parentNode?.removeChild(node);
      observer?.disconnect(); observer = null;
      removeOwned(); start = null; end = null; projected = [];
      for (const node of slotPool) host.appendChild(node);
    },
    emit(key, payload, options) {
      if (!accepted) { emissions.push({key, payload, options}); return; }
      host.dispatchEvent(markNativeExposeEvent(new (doc.defaultView!.CustomEvent)(key, {detail: payload, bubbles: true, cancelable: true, ...options})));
    },
    parentContext: () => portalAnchor ? portalParent : logicalParent(host),
    bindContext(scope) { if (scope) ownerScopes.set(host, scope); else ownerScopes.delete(host); },
    accept() {
      if (hydrating && carrier?.present) throw new HydrationMismatch('present carrier was not adopted');
      accepted = true;
      if (script) script.remove();
      if (carrier && !carrier.present) hydrating = false;
      if (rootStart) owned.add(rootStart); if (rootEnd) owned.add(rootEnd);
      for (const emission of emissions.splice(0)) {
        if (disposed) break;
        port.emit(emission.key, emission.payload, emission.options);
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      emissions.length = 0;
      observer?.disconnect(); observer = null;
      const target = control ?? host;
      for (const [name, entry] of attributes) if (target.getAttribute(name) === entry.projected) {
        if (entry.baseline === null) target.removeAttribute(name); else target.setAttribute(name, entry.baseline);
      }
      attributes.clear(); ownerScopes.delete(host);
      if (portalAnchor) { portalAnchor.parentNode?.insertBefore(host, portalAnchor); portalAnchor.remove(); portalAnchor = null; }
      if (display) { if (display.value) host.style.setProperty('display', display.value, display.priority); else host.style.removeProperty('display'); display = null; }
    },
  };
  if (recovery) {
    // Known SSR range identifies only owned nodes. Unknown roots are a diagnosed explicit rebuild.
    if (mode === 'light') {
      const walker = doc.createTreeWalker(host, 128);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (marker(node, 'pui-slot-start') && !start) start = node;
        else if (marker(node, 'pui-slot-end') && start && node.parentNode === start.parentNode && !end) end = node;
      }
      projected = slotNodes();
    }
    if (rootStart && rootEnd) ownRootRange(rootStart, rootEnd);
    else if (mode === 'shadow') for (const node of Array.from(root.childNodes)) owned.add(node);
  }
  return port;
}
`;
