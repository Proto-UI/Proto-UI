/** Target-native request ownership and render-data transport; never semantic IR. */
export const vueSsrSupportArtifact = {
  path: '.proto-ui/vue/ssr-v1.ts',
  kind: 'source' as const,
  contents: `import * as Vue from 'vue';
export type Data = null | boolean | number | string | ['undefined'] | ['negative-zero'] | ['array', Data[]] | ['record', [string, Data][]];
export type Projection = null | string | number | Projection[] | { tag: string; attrs: Record<string, unknown> | null; children: Projection[] } | { slot: true };
export type RecordData = { source: string; raw: Data; present: boolean; tag: string; properties: Readonly<Record<string, string | number | boolean | null>>; attrs: Record<string, string | null>; children: Projection[] };
export type Handoff = { version: 1; profile: 'vue-ssr-v1'; source: string; html: string; records: Record<string, RecordData> };
export type Tree = { id: string; next: number; ready?: () => boolean };
export type Session = {
  server: boolean; hydrating: boolean; data: Handoff; next: number; closed: boolean; failure?: unknown;
  owners: Set<() => void>; pending: Map<string, () => void>; scheduled: boolean;
};
// Shared across independently generated components, but values belong to one app/request.
export const sessionKey = Symbol.for('ProtoUI.Vue.SSR.Session.v1');
export const treeKey = Symbol.for('ProtoUI.Vue.SSR.Tree.v1');
export function encode(value: unknown, ancestors = new Set<object>()): Data {
  if (value === undefined) return ['undefined'];
  if (Object.is(value, -0)) return ['negative-zero'];
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('[Vue SSR] handoff requires finite, acyclic portable data');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError('[Vue SSR] handoff cannot carry capabilities or class instances');
  ancestors.add(value);
  try {
    if (array) {
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
export function decode(value: Data): unknown {
  if (!Array.isArray(value)) return value;
  if (value[0] === 'undefined') return undefined;
  if (value[0] === 'negative-zero') return -0;
  if (value[0] === 'array') return value[1].map(decode);
  if (value[0] === 'record') return Object.fromEntries(value[1].map(([key, item]) => [key, decode(item)]));
  throw new TypeError('[Vue SSR] invalid handoff data');
}
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
  if (data && (data.version !== 1 || data.profile !== 'vue-ssr-v1' || data.source !== source)) throw new TypeError('[Vue SSR] handoff source/profile mismatch');
  return { server, hydrating: !server, data: data ?? { version: 1, profile: 'vue-ssr-v1', source, html: '', records: Object.create(null) }, next: 0, closed: false, owners: new Set(), pending: new Map(), scheduled: false };
}
export function close(session: Session): void {
  if (session.closed) return;
  session.closed = true; session.pending.clear();
  const errors: unknown[] = [];
  for (const dispose of [...session.owners].reverse()) try { dispose(); } catch (error) { errors.push(error); }
  session.owners.clear();
  if (errors.length) throw new AggregateError(errors, '[Vue SSR] owner cleanup failed');
}
export function committed(session: Session, id: string, callback: () => void): void {
  if (session.closed) return;
  session.pending.set(id, callback);
  if (session.scheduled) return;
  session.scheduled = true;
  void Vue.nextTick().then(() => {
    session.scheduled = false;
    if (session.closed) return;
    const tasks = [...session.pending].sort(([a], [b]) => a.split('.').length - b.split('.').length);
    session.pending.clear();
    for (const [, task] of tasks) { if (session.closed) return; task(); }
  }).catch(error => { session.failure = error; close(session); throw error; });
}
`,
};
