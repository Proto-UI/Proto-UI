import { ownerInitialDataGuard, ownerInitialDataDecoder } from './owner-initial-data';
/** Target-native request ownership and render-data transport; never semantic IR. */
export const vueSsrSupportArtifact = {
  path: '.proto-ui/vue/ssr-v1.ts',
  kind: 'source' as const,
  contents: `import * as Vue from 'vue';
${ownerInitialDataGuard('cloneInitialData')}
${ownerInitialDataDecoder('decodeInitialData', 'cloneInitialData')}
export type Data = null | boolean | number | string | ['undefined'] | ['negative-zero'] | ['array', Data[]] | ['record', [string, Data][]];
export type Projection = null | string | number | Projection[] | { tag: string; attrs: Record<string, unknown> | null; children: Projection[] } | { slot: true };
export type RecordData = { source: string; raw: Data; present: boolean; tag: string; properties: Readonly<Record<string, string | number | boolean | null>>; attrs: Record<string, string | null>; children: Projection[] };
export type Handoff = { version: 1; profile: 'vue-ssr-v1'; source: string; html: string; records: Record<string, RecordData> };
export type Tree = { id: string; next: number; initialReady?: () => boolean; ready?: () => boolean };
type Commit = { prepare: () => void; accept?: () => void };
export type Session = {
  server: boolean; hydrating: boolean; data: Handoff; next: number; closed: boolean; failure?: { value: unknown };
  owners: Set<() => void>; pending: Map<string, Commit>; scheduled: boolean;
  initializing: boolean; initialOwners: Set<string>; initialCommits: Map<string, () => void>; deferredProps: Map<string, () => void>;
};
// Shared across independently generated components, but values belong to one app/request.
export const sessionKey = Symbol.for('ProtoUI.Vue.SSR.Session.v1');
export const treeKey = Symbol.for('ProtoUI.Vue.SSR.Tree.v1');
export function encode(value: unknown, ancestors = new Set<object>()): Data {
  if (!ancestors.size) value = cloneInitialData(value);
  if (value === undefined) return ['undefined'];
  if (Object.is(value, -0)) return ['negative-zero'];
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('[Vue SSR] handoff requires finite, acyclic portable data');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError('[Vue SSR] handoff cannot carry capabilities or class instances');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) throw new TypeError('[Vue SSR] sparse arrays are not portable data');
      return ['array', value.map(item => encode(item, ancestors))];
    }
    const entries: [string, Data][] = [];
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('[Vue SSR] handoff requires ordinary enumerable data fields');
      entries.push([key, encode(descriptor.value, ancestors)]);
    }
    return ['record', entries];
  } finally { ancestors.delete(value); }
}
export function decode(value: Data): unknown { return decodeInitialData(value); }
export function project(nodes: Vue.VNodeArrayChildren, slot: Vue.Component): Projection[] {
  const output: Projection[] = [];
  function visit(value: unknown): void {
    if (value === null || value === undefined) { output.push(null); return; }
    if (Array.isArray(value)) { output.push(project(value, slot)); return; }
    if (typeof value === 'string' || typeof value === 'number') { output.push(value); return; }
    if (!Vue.isVNode(value)) throw new TypeError('[Vue SSR] invalid native render projection');
    if (value.type === slot) { output.push({ slot: true }); return; }
    if (value.type === Vue.Text) { output.push(String(value.children ?? '')); return; }
    if (value.type === Vue.Comment) { output.push(null); return; }
    if (value.type === Vue.Fragment) { output.push(project(value.children as Vue.VNodeArrayChildren, slot)); return; }
    if (typeof value.type !== 'string') throw new TypeError('[Vue SSR] portable templates cannot serialize arbitrary component capabilities');
    const children = value.children == null ? [] : Array.isArray(value.children) ? value.children : [value.children];
    output.push({ tag: value.type, attrs: value.props ? { ...value.props } : null, children: project(children as Vue.VNodeArrayChildren, slot) });
  }
  nodes.forEach(visit);
  return output;
}
export function adopt(nodes: Projection[], slot: () => Vue.VNode): Vue.VNodeArrayChildren {
  return nodes.map(value => {
    if (value === null || typeof value === 'string' || typeof value === 'number') return value;
    if (Array.isArray(value)) return adopt(value, slot);
    if ('slot' in value) return slot();
    return Vue.h(value.tag, value.attrs, adopt(value.children, slot));
  });
}
export function createSession(server: boolean, source: string, data?: Handoff): Session {
  if (data) data = cloneInitialData(data);
  if (data && (data.version !== 1 || data.profile !== 'vue-ssr-v1' || data.source !== source)) throw new TypeError('[Vue SSR] handoff source/profile mismatch');
  if (data) {
    if (!data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw new TypeError('[Vue SSR] malformed handoff records');
    for (const record of Object.values(data.records)) decode(record.raw);
  }
  return { server, hydrating: !server, data: data ?? { version: 1, profile: 'vue-ssr-v1', source, html: '', records: Object.create(null) }, next: 0, closed: false, owners: new Set(), pending: new Map(), scheduled: false, initializing: !server, initialOwners: new Set(server ? [] : Object.keys(data?.records ?? {})), initialCommits: new Map(), deferredProps: new Map() };
}
export function close(session: Session): void {
  if (session.closed) return;
  session.closed = true; session.initializing = false; session.pending.clear(); session.initialOwners.clear(); session.initialCommits.clear(); session.deferredProps.clear();
  const errors: unknown[] = [];
  for (const dispose of [...session.owners].reverse()) try { dispose(); } catch (error) { errors.push(error); }
  session.owners.clear();
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, '[Vue SSR] owner cleanup failed');
}
/** Current Props and accepted view effects follow validation of the entire initial owner graph. */
export function deferInitialProps(session: Session, id: string, callback: () => void): boolean {
  if (session.closed) return true;
  if (!session.initializing) { session.deferredProps.delete(id); return false; }
  session.deferredProps.set(id, callback);
  return true;
}
export function acceptInitialOwner(session: Session, id: string): void {
  if (!session.closed) session.initialOwners.delete(id);
}
export function committed(session: Session, id: string, prepare: () => void, accept?: () => void): void {
  if (session.closed) return;
  session.pending.set(id, { prepare, accept });
  if (session.scheduled) return;
  session.scheduled = true;
  void Vue.nextTick().then(() => {
    session.scheduled = false;
    if (session.closed) return;
    const tasks = [...session.pending].sort(([a], [b]) => a.split('.').length - b.split('.').length);
    session.pending.clear();
    for (const [id, task] of tasks) {
      if (session.closed) return;
      task.prepare();
      if (session.closed) return;
      if (task.accept) {
        if (session.initializing) session.initialCommits.set(id, task.accept);
        else task.accept();
      }
    }
    if (session.closed || !session.initializing || session.initialOwners.size) return;
    // A parent's mounted/updated effect may synchronously change shared Context.
    // Validate every initial descendant before accepting any physical commit.
    session.initializing = false;
    const commits = [...session.initialCommits].sort(([a], [b]) => a.split('.').length - b.split('.').length);
    session.initialCommits.clear();
    for (const [, commit] of commits) { if (session.closed) return; commit(); }
    const updates = [...session.deferredProps].sort(([a], [b]) => a.split('.').length - b.split('.').length);
    session.deferredProps.clear();
    for (const [, update] of updates) { if (session.closed) return; update(); }
  }).catch(error => { session.failure ??= { value: error }; try { close(session); } catch { /* Preserve the initiating asynchronous failure. */ } });
}
`,
};
