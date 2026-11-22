import { ownerInitialDataGuard, ownerInitialDataDecoder } from './owner-initial-data';
// Vue2-specific server/hydration host entrypoints. The framework owns VNodes and slots.
export function vue2SsrEntrypoints(prefix: string, component: string, source: string): string {
  return String.raw`
${ownerInitialDataGuard(`${prefix}InitialData`, false)}
${ownerInitialDataDecoder(`${prefix}DecodeInitialData`, `${prefix}InitialData`, false)}
const ${prefix}SessionKey = '__proto_ui_vue2_ssr_v1_session';
function ${prefix}FindSession(vm) {
  for (let current = vm; current; current = current.$parent) {
    if (current.$options && current.$options[${prefix}SessionKey]) return current.$options[${prefix}SessionKey];
  }
  return null;
}
function ${prefix}EncodeRaw(raw) {
  raw = ${prefix}InitialData(raw);
  const seen = new Set();
  function encode(value) {
    if (value === undefined) return ['undefined'];
    if (Object.is(value, -0)) return ['negative-zero'];
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) throw new TypeError('[Vue2 SSR] invalid portable initial data');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError('[Vue2 SSR] capability cannot enter initial data');
    seen.add(value);
    try { return array ? ['array', value.map(encode)] : ['record', Object.keys(value).map(key => [key, encode(value[key])])]; }
    finally { seen.delete(value); }
  }
  return encode(raw);
}
function ${prefix}DecodeRaw(raw) { return ${prefix}DecodeInitialData(raw); }
function ${prefix}CheckVue(Vue) {
  if (!Vue || Vue.version !== '2.6.14') throw new Error('[Vue2 SSR] requires Vue 2.6.14.');
}
function ${prefix}CloseSession(session) {
  if (session.closed) return;
  session.closed = true;
  const failures = [];
  // Descendant subscriptions retire before their providers.
  for (const owner of session.owners.slice().reverse()) {
    try { owner.dispose(); } catch (error) { failures.push(error); }
  }
  session.owners.length = 0;
  if (failures.length === 1) throw failures[0];
  if (failures.length) throw new AggregateError(failures, '[Vue2 SSR] request cleanup failed.');
}
function ${prefix}Root(Vue, session, options) {
  const root = new Vue({
    [${prefix}SessionKey]: session,
    data() { return { input: options.props || {}, attrs: options.attrs || {} }; },
    errorCaptured(error) { session.failure ??= { value: error }; return false; },
    render(h) {
      const data = { props: this.input, attrs: this.attrs, on: options.on || {} };
      if (options.scopedSlots) data.scopedSlots = options.scopedSlots;
      return h(${component}, data, options.children ? options.children(h) : undefined);
    },
  });
  return root;
}
/** Supply the real Vue2 constructor and matching vue-server-renderer createRenderer() instance.
 * Native children/scopedSlots are supplied by their host owner, never transported as handles.
 */
export async function renderToString(options) {
  const { Vue, renderer, signal } = options;
  signal?.throwIfAborted();
  ${prefix}CheckVue(Vue);
  if (!renderer || typeof renderer.renderToString !== 'function') throw new TypeError('[Vue2 SSR] requires vue-server-renderer 2.6.14 createRenderer().');
  options = { ...options, props: ${prefix}InitialData(options.props ?? {}), attrs: ${prefix}InitialData(options.attrs ?? {}) };
  const session = { mode: 'server', owners: [], projections: [], closed: false, failure: undefined };
  const context = options.context || {};
  let root, failure;
  const cancellation = Promise.withResolvers();
  void cancellation.promise.catch(() => {});
  const abort = () => {
    failure ??= { value: signal.reason }; session.failure ??= failure;
    try { ${prefix}CloseSession(session); } catch { /* Abort keeps its initiating reason. */ }
    cancellation.reject(failure.value);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    root = ${prefix}Root(Vue, session, options);
    const render = Promise.resolve(renderer.renderToString(root, context));
    void render.catch(() => {});
    const html = await Promise.race([render, cancellation.promise]);
    if (failure) throw failure.value;
    if (session.failure) throw session.failure.value;
    signal?.throwIfAborted();
    const carrier = validateGeneratedCarrier(JSON.parse(JSON.stringify({
      version: 1, profile: 'vue2-ssr-v1', source: '${source}',
      initialProps: ${prefix}EncodeRaw(options.props),
      initialAttrs: ${prefix}EncodeRaw(options.attrs),
      projections: session.projections,
    })));
    if (!${prefix}Json(carrier) || carrier.projections.length !== session.owners.length) throw new Error('[Vue2 SSR] incomplete request projection.');
    return { html, carrier };
  } catch (error) {
    failure ??= { value: error };
    throw failure.value;
  } finally {
    signal?.removeEventListener('abort', abort);
    // Vue's server renderer does not own Proto cleanup; retire the request even
    // when a lifecycle callback or the framework's destruction path fails.
    const cleanup = [];
    try { ${prefix}CloseSession(session); } catch (error) { cleanup.push(error); }
    try { root?.$destroy(); } catch (error) { cleanup.push(error); }
    if (!failure) {
      signal?.throwIfAborted();
      if (cleanup.length === 1) throw cleanup[0];
      if (cleanup.length) throw new AggregateError(cleanup, '[Vue2 SSR] request cleanup failed.');
    }
  }
}
function ${prefix}Nodes(root) {
  const nodes = [];
  const visit = (node) => { nodes.push(node); for (const child of Array.from(node.childNodes)) visit(child); };
  visit(root);
  return nodes;
}
/** Validate the complete encoded transport before server publication or client startup. */
export function validateGeneratedCarrier(input) {
  const carrier = ${prefix}InitialData(input);
  if (!carrier || carrier.version !== 1 || carrier.profile !== 'vue2-ssr-v1' || carrier.source !== '${source}' || !${prefix}Json(carrier) || !Array.isArray(carrier.projections)) throw new Error('[Vue2 SSR] invalid source/profile carrier.');
  ${prefix}DecodeRaw(carrier.initialProps); ${prefix}DecodeRaw(carrier.initialAttrs);
  for (const projection of carrier.projections) ${prefix}DecodeRaw(projection.raw);
  return carrier;
}
/** Hydrate matching HTML. Resolves only after actual accepted commit and Vue nextTick readiness.
 * options.props/attrs may differ from the carrier; the normal Props update policy is retained.
 */
export async function hydrate(options) {
  const { Vue, target } = options;
  ${prefix}CheckVue(Vue);
  const carrier = validateGeneratedCarrier(options.carrier);
  if (!target || ![1, 8].includes(target.nodeType)) throw new TypeError('[Vue2 SSR] hydration requires the serialized Root or absence comment.');
  const session = { mode: 'hydrate', carrier, owners: [], closed: false, failure: null };
  const before = ${prefix}Nodes(target);
  const text = before.map((node) => node.nodeType === 3 || node.nodeType === 8 ? node.data : null);
  const controls = before.filter(node => node.nodeType === 1 && ['input','textarea'].includes(node.localName)).map(node => ({ node, value: node.value, start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection }));
  const root = ${prefix}Root(Vue, session, {
    ...options,
    props: options.props === undefined ? ${prefix}DecodeRaw(carrier.initialProps) : options.props,
    attrs: options.attrs === undefined ? ${prefix}DecodeRaw(carrier.initialAttrs) : options.attrs,
  });
  try {
    root.$mount(target, true);
    if (session.failure) throw session.failure.value;
    const after = ${prefix}Nodes(root.$el);
    const projection = carrier.projections[0];
    if (projection?.present && typeof projection.rootTag === 'string' && root.$el
      && root.$el.tagName !== projection.rootTag.toUpperCase()) {
      throw new Error('[Vue2 SSR] hydration mismatch: serialized Root tag differs from the client Root.');
    }
    if (root.$el !== target || before.length !== after.length
      || before.some((node, index) => node !== after[index] || text[index] !== null && node.data !== text[index])
      || session.owners.length !== carrier.projections.length) {
      throw new Error('[Vue2 SSR] hydration mismatch: Vue replaced or failed to adopt the serialized nodes.');
    }
    // beforeCreate order is provider-first, even though Vue's mounted hooks are descendant-first.
    for (const saved of controls) { saved.node.value = saved.value; if (saved.start !== null && saved.end !== null) saved.node.setSelectionRange(saved.start, saved.end, saved.direction); }
    session.mode = 'client';
    for (const owner of session.owners.slice()) owner.acceptHydration();
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();
    if (session.failure) throw session.failure.value;
    return {
      root,
      get instance() { return root.$children[0]; },
      setProps(props, attrs = root.attrs) { if (session.closed || root._isDestroyed) throw new Error('[Vue2 SSR] hydrated root disposed.'); root.input = props; root.attrs = attrs; },
      dispose() { try { ${prefix}CloseSession(session); } finally { root.$destroy(); } },
    };
  } catch (error) {
    try { ${prefix}CloseSession(session); }
    catch { /* Keep the initiating hydration failure. */ }
    try { root.$destroy(); } catch { /* Keep the initiating hydration failure. */ }
    throw error;
  }
}
`;
}
