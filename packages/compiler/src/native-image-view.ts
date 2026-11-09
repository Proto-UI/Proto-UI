/** Direct Web host realization of the checked Image View atomic capability.
 * C/M/HC-IMAGE-VIEW-0001 and D-IMAGE-VIEW-PROJECTION-0001 remain draft.
 * Declaration selection happens in the compiler, not in this emitted helper.
 */
export const nativeImageViewArtifact = {
  path: '.proto-ui/interaction/image-v1.ts',
  kind: 'source' as const,
  contents: String.raw`// Reached Image View Web host, native request state and shared ownership.
import { owners, targets, hostIds, activeScopes, logicalRoot, descends, rootOwners, logicalOwners, type Owner, type Claim, type NativeFocusRequest } from './ownership-v1';
export type NativeImageConfig = Readonly<{ source: string; alternativeText: string; a11yMode: 'informative' | 'decorative'; fit: 'contain' | 'cover' | 'fill' }>;
export type NativeImageStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type NativeImageEvent = Readonly<{ status: NativeImageStatus; previousStatus: NativeImageStatus; source: string }>;
export type NativeImageSnapshot = Readonly<{ source: string; loadingStatus: NativeImageStatus; fit: NativeImageConfig['fit'] }>;
export interface NativeImageView<Run> {
  on(type: string, callback: (run: Run, event: NativeImageEvent) => void): () => void;
  sync(patch: Partial<NativeImageConfig> & { loadingStatus?: NativeImageStatus }): void;
  snapshot(): NativeImageSnapshot | null;
}
export interface NativeInteraction<Run> {
  asImageView(): NativeImageView<Run>;
  rootTag(): string;
  rootProperties(): Readonly<Record<string, string | number | boolean | null>>;
  projectAttributes(): Readonly<Record<string, string | null>>;
  refresh(): void; mount(): void; unmount(): void; dispose(): void;
}
export interface NativeImageOptions<Run> {
  imageConfig: NativeImageConfig;
  ensureSetup(operation: string): void; ensureRuntime(operation: string): void;
  isAlive(): boolean; isReady?(): boolean; invoke<T>(callback: () => T): T;
  getRun(): Run; getRoot(): HTMLElement | null; getHost?(): HTMLElement | null;
  identity: object; getLogicalParent(): object | null;
  getExposes?(): Readonly<Record<string, unknown>>; requestHostUpdate?(): void;
}
type ImageRequest = { target: HTMLImageElement; generation: number; attachment: number; terminal: boolean };
export function createNativeInteraction<Run>(options: NativeImageOptions<Run>): NativeInteraction<Run> {
  let disposed = false, declared = false;
  let root: HTMLImageElement | null = null, host: HTMLElement | null = null;
  let attachment = 0, generation = 0, lastHostedGeneration: number | null = null;
  let request: ImageRequest | null = null, pendingFocus: NativeFocusRequest | null = null;
  let config: NativeImageConfig = { ...options.imageConfig };
  let diagnostic = '';
  const listeners = new Set<(run: Run, event: NativeImageEvent) => void>();
  const cleanups: Array<() => void> = [];
  const attributes = new Map<string, { baseline: string | null; projected: string | null }>();
  const styles = new Map<string, { baseline: string; priority: string; projected: string }>();
  const hooks = new Set<string>(), claims = new Map<object, Claim>();
  let hostProperties: Readonly<Record<string, string | number | boolean | null>> | null = null;
  function alive() { if (disposed || !options.isAlive()) throw new Error('[ImageView] owner is terminally disposed.'); }
  function ready() { return !disposed && options.isAlive() && !!root && root === options.getRoot() && root.isConnected; }
  function validSource(): string {
    if (!config.source) { diagnostic = ''; return ''; }
    const alternative = config.alternativeText.trim().length > 0;
    if (config.a11yMode === 'informative' && alternative || config.a11yMode === 'decorative' && !alternative) { diagnostic = ''; return config.source; }
    const next = JSON.stringify([config.source, config.a11yMode, config.alternativeText]);
    if (next !== diagnostic) { diagnostic = next; console.warn('[ImageView] contradictory or missing accessibility input; source failed closed to idle.'); }
    return '';
  }
  let source = validSource();
  let status: NativeImageStatus = source ? 'loading' : 'idle';
  if (source) generation = 1;
  const owner: Owner = {
    identity: options.identity, parent: options.getLogicalParent, target: () => root,
    host: () => root ? options.getHost?.() ?? root : null,
    alive: () => !disposed && options.isAlive(), hooks, claims,
    exposes: () => options.getExposes?.() ?? {},
    focusConfig: { disabled: false, navParticipation: 'auto' }, scopeConfig: {}, rovingConfig: {},
    selected: false, active: false, scopeDeclared: false, rovingDeclared: false,
    focusDeclared: false, entryDeclared: false, scopeActive: false,
    focus: requestFocus, cancelPendingFocus() { pendingFocus = null; }, changed: refresh,
  };
  if (owners.has(options.identity)) throw new Error('[Modules] duplicate live owner identity.');
  function announceTopology(rootOwner = logicalRoot(owner)) {
    for (const participant of [...owners.values()])
      if (participant.alive() && logicalRoot(participant) === rootOwner) participant.changed();
  }
  function requestFocus(next?: NativeFocusRequest) {
    alive();
    for (let index = activeScopes.length - 1; index >= 0; index--) {
      const scope = activeScopes[index];
      if (!scope.alive()) { activeScopes.splice(index, 1); continue; }
      if (scope.target()?.isConnected) { if (!descends(owner, scope)) return; break; }
    }
    if (!ready() || root!.closest('[hidden],[inert],[data-pui-view-detached]')) { pendingFocus = next ?? {}; return; }
    root!.focus({ preventScroll: next?.preventScroll });
  }
  function transition(next: NativeImageStatus) {
    if (next === status) return;
    const event: NativeImageEvent = Object.freeze({ status: next, previousStatus: status, source });
    status = next;
    const epoch = attachment, version = generation;
    for (const listener of [...listeners]) {
      if (disposed || !options.isAlive() || attachment !== epoch || generation !== version) break;
      options.invoke(() => listener(options.getRun(), event));
    }
  }
  function retireRequest() { request = null; }
  function complete(current: ImageRequest, next: 'loaded' | 'error') {
    if (request !== current || current.terminal || current.generation !== generation || current.attachment !== attachment || root !== current.target || !ready() || !(options.isReady?.() ?? true) || !source || status !== 'loading') return;
    current.terminal = true;
    transition(next);
  }
  function projectStyle(target: HTMLElement, name: string, value: string) {
    const current = target.style.getPropertyValue(name);
    let record = styles.get(name);
    if (!record) { record = { baseline: current, priority: target.style.getPropertyPriority(name), projected: current }; styles.set(name, record); }
    else if (current !== record.projected) { record.baseline = current; record.priority = target.style.getPropertyPriority(name); }
    if (current !== value) target.style.setProperty(name, value);
    record.projected = value;
  }
  function applyImage() {
    if (!ready() || !declared) return;
    const target = root!;
    target.alt = config.a11yMode === 'decorative' ? '' : config.alternativeText;
    projectStyle(target, 'object-fit', config.fit);
    if (!source) { retireRequest(); target.removeAttribute('src'); return; }
    if (request && request.target === target && request.generation === generation && request.attachment === attachment) return;
    retireRequest();
    if (target.getAttribute('src') !== source) { target.removeAttribute('src'); target.src = source; }
    if (status !== 'loading') return;
    const current: ImageRequest = { target, generation, attachment, terminal: false };
    request = current; lastHostedGeneration = generation;
    if (target.complete && target.naturalWidth > 0) { complete(current, 'loaded'); return; }
    if (typeof target.decode !== 'function') throw new Error('[ImageView] the concrete browser must support request-bound image.decode().');
    void target.decode().then(() => complete(current, 'loaded'), () => complete(current, 'error'));
  }
  const image: NativeImageView<Run> = {
    on(type, callback) {
      alive(); options.ensureSetup('imageView.on');
      if (type !== 'loadingStatusChange') throw new Error('[ImageView] invalid event type.');
      listeners.add(callback);
      return () => { alive(); options.ensureSetup('imageView.off'); listeners.delete(callback); };
    },
    sync(patch) {
      alive(); options.ensureRuntime('imageView.sync');
      if (patch.fit !== undefined && !['contain', 'cover', 'fill'].includes(patch.fit)) throw new Error('[ImageView] invalid fit.');
      if (patch.a11yMode !== undefined && !['informative', 'decorative'].includes(patch.a11yMode)) throw new Error('[ImageView] invalid accessibility mode.');
      config = {
        source: typeof patch.source === 'string' ? patch.source : config.source,
        alternativeText: typeof patch.alternativeText === 'string' ? patch.alternativeText : config.alternativeText,
        a11yMode: patch.a11yMode ?? config.a11yMode, fit: patch.fit ?? config.fit,
      };
      const next = validSource();
      if (next !== source) { retireRequest(); source = next; ++generation; transition(source ? 'loading' : 'idle'); }
      applyImage(); requestPresentation();
    },
    snapshot() { alive(); return declared ? Object.freeze({ source, loadingStatus: status, fit: config.fit }) : null; },
  };
  function rootTag() { alive(); return 'img'; }
  function rootProperties(): Readonly<Record<string, string | number | boolean | null>> {
    alive(); return { src: source || null, alt: config.a11yMode === 'decorative' ? '' : config.alternativeText, style: 'object-fit:' + config.fit };
  }
  function requestPresentation() {
    if (disposed || !options.isAlive()) return;
    const next = rootProperties();
    const changed = !hostProperties || Object.keys(next).some(key => next[key] !== hostProperties![key]);
    hostProperties = next;
    if (changed) options.requestHostUpdate?.();
  }
  function projectAttributes(): Readonly<Record<string, string | null>> {
    alive();
    if (!hostIds.has(options.identity)) return {};
    if (root?.id) hostIds.set(options.identity, root.id);
    return { id: hostIds.get(options.identity)! };
  }
  function refresh() {
    if (disposed || !options.isAlive()) return;
    if (!ready()) { requestPresentation(); return; }
    const next = projectAttributes();
    for (const [name, value] of Object.entries(next)) {
      const current = root!.getAttribute(name);
      let record = attributes.get(name);
      if (!record) { record = { baseline: current, projected: current }; attributes.set(name, record); }
      else if (current !== record.projected) record.baseline = current;
      if (current !== value) { if (value === null) root!.removeAttribute(name); else root!.setAttribute(name, value); }
      record.projected = value;
    }
    applyImage();
    if (pendingFocus) { const next = pendingFocus; pendingFocus = null; requestFocus(next); }
    requestPresentation();
  }
  function unmount() {
    const previous = root, previousHost = host;
    ++attachment; retireRequest(); root = host = null;
    if (previous && targets.get(previous) === owner) targets.delete(previous);
    if (previous && rootOwners.get(previous)?.identity === options.identity) rootOwners.delete(previous);
    if (previousHost && rootOwners.get(previousHost)?.identity === options.identity) rootOwners.delete(previousHost);
    logicalOwners.delete(options.identity);
    const failures: unknown[] = [];
    for (const cleanup of cleanups.splice(0)) try { cleanup(); } catch (error) { failures.push(error); }
    if (previous) {
      for (const [name, record] of attributes) if (previous.getAttribute(name) === record.projected) {
        if (record.baseline === null) previous.removeAttribute(name); else previous.setAttribute(name, record.baseline);
      }
      for (const [name, record] of styles) if (previous.style.getPropertyValue(name) === record.projected) {
        if (record.baseline) previous.style.setProperty(name, record.baseline, record.priority); else previous.style.removeProperty(name);
      }
      try { announceTopology(); } catch (error) { failures.push(error); }
    }
    attributes.clear(); styles.clear();
    if (failures.length) throw new AggregateError(failures, '[ImageView] view cleanup failed.');
  }
  function mount() {
    alive(); const candidate = options.getRoot();
    if (root === candidate && ready()) { refresh(); return; }
    unmount(); alive();
    if (!candidate) return;
    if (candidate.localName !== 'img') throw new Error('[ImageView] renderer did not bind the required img Root.');
    root = candidate as HTMLImageElement; host = options.getHost?.() ?? root;
    const routeOwner = { identity: options.identity, parent: options.getLogicalParent, trigger: () => false, target: root };
    rootOwners.set(root, routeOwner); rootOwners.set(host, routeOwner); logicalOwners.set(options.identity, routeOwner);
    targets.set(root, owner);
    if (root.id) hostIds.set(options.identity, root.id);
    const target = root, epoch = attachment;
    const contain = (event: Event) => { if (root === target && attachment === epoch && ready()) event.stopPropagation(); };
    for (const name of ['load', 'error']) { target.addEventListener(name, contain); cleanups.push(() => target.removeEventListener(name, contain)); }
    try {
      if (source && lastHostedGeneration === generation) { ++generation; transition('loading'); }
      lastHostedGeneration = generation;
      refresh(); announceTopology();
    } catch (error) {
      try { unmount(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[ImageView] mount and cleanup failed.'); }
      throw error;
    }
  }
  owners.set(options.identity, owner);
  return {
    asImageView() { alive(); options.ensureSetup('hook.asImageView'); if (declared) throw new Error('[ImageView] one image view may be declared.'); declared = true; hooks.add('asImageView'); return image; },
    rootTag, rootProperties, projectAttributes, refresh, mount, unmount,
    dispose() {
      if (disposed) return;
      const rootOwner = logicalRoot(owner), failures: unknown[] = [];
      disposed = true;
      try { unmount(); } catch (error) { failures.push(error); }
      owners.delete(options.identity); listeners.clear(); claims.clear(); hooks.clear(); pendingFocus = null;
      try { announceTopology(rootOwner); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, '[ImageView] terminal cleanup failed.');
    },
  };
}
`,
};
