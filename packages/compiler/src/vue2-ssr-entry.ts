// Vue2-specific server/hydration host entrypoints. The framework owns VNodes and slots.
export function vue2SsrEntrypoints(prefix: string, component: string, source: string): string {
  return String.raw`
const ${prefix}SessionKey = '__proto_ui_vue2_ssr_v1_session';
function ${prefix}FindSession(vm) {
  for (let current = vm; current; current = current.$parent) {
    if (current.$options && current.$options[${prefix}SessionKey]) return current.$options[${prefix}SessionKey];
  }
  return null;
}
function ${prefix}EncodeRaw(raw) {
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
function ${prefix}DecodeRaw(raw) {
  function decode(value) {
    if (!Array.isArray(value)) return value;
    if (value[0] === 'undefined') return undefined;
    if (value[0] === 'negative-zero') return -0;
    if (value[0] === 'array') return value[1].map(decode);
    if (value[0] === 'record') return Object.fromEntries(value[1].map(([key, item]) => [key, decode(item)]));
    throw new TypeError('[Vue2 SSR] invalid initial data tag');
  }
  return Object.freeze(decode(raw));
}
function ${prefix}CheckVue(Vue) {
  if (!Vue || Vue.version !== '2.6.14') throw new Error('[Vue2 SSR] requires Vue 2.6.14.');
}
function ${prefix}CloseSession(session) {
  if (session.closed) return;
  session.closed = true;
  let failure;
  // Descendant subscriptions retire before their providers.
  for (const owner of session.owners.slice().reverse()) {
    try { owner.dispose(); } catch (error) { failure ??= error; }
  }
  session.owners.length = 0;
  if (failure) throw failure;
}
function ${prefix}Root(Vue, session, options) {
  const root = new Vue({
    [${prefix}SessionKey]: session,
    data() { return { input: options.props || {}, attrs: options.attrs || {} }; },
    errorCaptured(error) { session.failure ??= error; return false; },
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
  ${prefix}CheckVue(Vue);
  if (!renderer || typeof renderer.renderToString !== 'function') throw new TypeError('[Vue2 SSR] requires vue-server-renderer 2.6.14 createRenderer().');
  const session = { mode: 'server', owners: [], projections: [], closed: false, failure: null };
  const context = options.context || {};
  let root, aborted, rejectAbort, renderFailure;
  const abort = () => {
    aborted = signal.reason || new Error('[Vue2 SSR] request aborted.');
    try { ${prefix}CloseSession(session); } catch (error) { aborted = new AggregateError([aborted, error], '[Vue2 SSR] abort cleanup failed.'); }
    rejectAbort?.(aborted);
  };
  try {
    if (signal?.aborted) throw signal.reason || new Error('[Vue2 SSR] request aborted.');
    root = ${prefix}Root(Vue, session, options);
    const render = Promise.resolve(renderer.renderToString(root, context));
    let result = render;
    if (signal) {
      const cancellation = Promise.withResolvers();
      rejectAbort = cancellation.reject;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      result = Promise.race([render, cancellation.promise]);
    }
    const html = await result;
    if (aborted) throw aborted;
    if (session.failure) throw session.failure;
    const carrier = JSON.parse(JSON.stringify({
      version: 1, profile: 'vue2-ssr-v1', source: '${source}',
      initialProps: ${prefix}EncodeRaw(options.props || {}),
      initialAttrs: ${prefix}EncodeRaw(options.attrs || {}),
      projections: session.projections,
    }));
    if (!${prefix}Json(carrier) || carrier.projections.length !== session.owners.length) throw new Error('[Vue2 SSR] incomplete request projection.');
    return { html, carrier };
  } catch (error) {
    renderFailure = error;
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    // Vue's server renderer does not call beforeDestroy. Explicitly retire the request.
    try { ${prefix}CloseSession(session); }
    catch (error) {
      if (renderFailure) throw new AggregateError([renderFailure, error], '[Vue2 SSR] rendering and cleanup failed.');
      throw error;
    } finally { root?.$destroy(); }
  }
}
function ${prefix}Nodes(root) {
  const nodes = [];
  const visit = (node) => { nodes.push(node); for (const child of Array.from(node.childNodes)) visit(child); };
  visit(root);
  return nodes;
}
/** Hydrate matching HTML. Resolves only after actual accepted commit and Vue nextTick readiness.
 * options.props/attrs may differ from the carrier; the normal Props update policy is retained.
 */
export async function hydrate(options) {
  const { Vue, target, carrier } = options;
  ${prefix}CheckVue(Vue);
  if (!carrier || carrier.version !== 1 || carrier.profile !== 'vue2-ssr-v1' || carrier.source !== '${source}' || !${prefix}Json(carrier) || !Array.isArray(carrier.projections)) throw new Error('[Vue2 SSR] invalid source/profile carrier.');
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
    if (session.failure) throw session.failure;
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
    if (session.failure) throw session.failure;
    return {
      root,
      get instance() { return root.$children[0]; },
      setProps(props, attrs = root.attrs) { if (session.closed || root._isDestroyed) throw new Error('[Vue2 SSR] hydrated root disposed.'); root.input = props; root.attrs = attrs; },
      dispose() { try { ${prefix}CloseSession(session); } finally { root.$destroy(); } },
    };
  } catch (error) {
    try { ${prefix}CloseSession(session); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], '[Vue2 SSR] hydration and cleanup failed.'); }
    finally { root.$destroy(); }
    throw error;
  }
}
`;
}
