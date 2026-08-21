import { createReactAdapter, type ReactRuntime } from '../../src/adapt';

type EffectRecord = {
  deps?: any[];
  cleanup?: (() => void) | void;
  kind?: 'layout' | 'effect';
  create?: () => void | (() => void);
};

type HookInstance = {
  hooks: any[];
  hookIndex: number;
  dirty: boolean;
  pendingLayoutEffects: Array<() => void>;
  pendingEffects: Array<() => void>;
  hostEl: HTMLElement;
  rootEl: HTMLElement | null;
  component: any;
  props: any;
  ref: any;
};

type FakeContext<T> = {
  current: T;
  Provider: { __fakeContext: FakeContext<T> };
};

let CURRENT: HookInstance | null = null;
const OWNED_STYLE_KEYS = new WeakMap<HTMLElement, Set<string>>();
const OWNED_ATTR_KEYS = new WeakMap<HTMLElement, Set<string>>();
const HAS_AUTHORED_CHILDREN = new WeakMap<HTMLElement, boolean>();
const WRAPPED_UPDATE = Symbol('fake-react-wrapped-update');

export function createFakeReactRuntime(
  options: {
    context?: boolean;
    createPortal?: (children: any, container: Element) => any;
  } = {}
) {
  const runtime: ReactRuntime = {
    useState<T>(init: T) {
      const inst = getCurrent();
      const index = inst.hookIndex++;
      if (!(index in inst.hooks)) inst.hooks[index] = init;
      const setState = (next: T) => {
        const value = typeof next === 'function' ? (next as any)(inst.hooks[index]) : next;
        if (Object.is(inst.hooks[index], value)) return;
        inst.hooks[index] = value;
        inst.dirty = true;
      };
      return [inst.hooks[index], setState];
    },
    useRef<T>(init: T) {
      const inst = getCurrent();
      const index = inst.hookIndex++;
      if (!(index in inst.hooks)) inst.hooks[index] = { current: init };
      return inst.hooks[index];
    },
    useEffect(cb, deps) {
      registerEffect('effect', cb, deps);
    },
    useLayoutEffect(cb, deps) {
      registerEffect('layout', cb, deps);
    },
    useImperativeHandle(ref, create) {
      const value = create();
      if (ref && typeof ref === 'object') ref.current = value;
    },
    forwardRef(render) {
      const component = (props: any, ref: any) => render(props, ref);
      (component as any).__forwardRefRender = render;
      return component;
    },
    createElement(type: any, props?: any, ...children: any[]) {
      const flatChildren = children.flat();
      const nextProps =
        flatChildren.length === 0
          ? { ...(props ?? {}) }
          : {
              ...(props ?? {}),
              children: flatChildren.length === 1 ? flatChildren[0] : flatChildren,
            };
      return {
        type,
        props: nextProps,
        children: flatChildren,
      };
    },
    createPortal(children: any, container: Element) {
      return options.createPortal?.(children, container) ?? children;
    },
  };

  if (options.context) {
    runtime.createContext = <T>(defaultValue: T) => {
      const context = { current: defaultValue } as FakeContext<T>;
      context.Provider = { __fakeContext: context };
      return context;
    };
    runtime.useContext = <T>(context: { Provider: any }) => {
      getCurrent().hookIndex += 1;
      return (context as unknown as FakeContext<T>).current;
    };
  }

  function render(
    Component: any,
    props: any = {},
    ref: any = { current: null },
    hostEl: HTMLElement = appendHost()
  ) {
    const inst: HookInstance = {
      hooks: [],
      hookIndex: 0,
      dirty: false,
      pendingLayoutEffects: [],
      pendingEffects: [],
      hostEl,
      rootEl: null,
      component: Component,
      props,
      ref,
    };

    runInstance(inst);

    return {
      ref,
      get root() {
        return inst.rootEl;
      },
      update(nextProps: any = inst.props) {
        inst.props = nextProps;
        runInstance(inst);
      },
      replayLayoutEffects() {
        const effects = inst.hooks.filter(
          (hook): hook is EffectRecord =>
            hook?.kind === 'layout' && typeof hook.create === 'function'
        );
        for (const effect of effects) effect.cleanup?.();
        for (const effect of effects) effect.cleanup = effect.create?.() ?? undefined;
        if (inst.dirty) runInstance(inst);
      },
      unmount() {
        for (const hook of inst.hooks) {
          if (
            hook &&
            typeof hook === 'object' &&
            'cleanup' in hook &&
            typeof hook.cleanup === 'function'
          ) {
            hook.cleanup();
          }
        }
        inst.rootEl?.remove();
        inst.rootEl = null;
        inst.hostEl.remove();
      },
    };
  }

  return { runtime, render };
}

export function createMountedReactAdapter(
  proto: any,
  props: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
  runtimeOptions: {
    context?: boolean;
    createPortal?: (children: any, container: Element) => any;
  } = {}
) {
  const fake = createFakeReactRuntime(runtimeOptions);
  const adapter = createReactAdapter(fake.runtime);
  const Component = adapter(proto, {
    schedule: (task: () => void) => task(),
    ...(options as any),
  } as any);
  const mounted = fake.render(Component, props);
  wrapAdapterUpdate(mounted);
  return { ...mounted, runtime: fake.runtime, Component };
}

export function createMountedReactAdapterInto(
  proto: any,
  hostEl: HTMLElement,
  props: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
  runtimeOptions: {
    context?: boolean;
    createPortal?: (children: any, container: Element) => any;
  } = {}
) {
  const fake = createFakeReactRuntime(runtimeOptions);
  const adapter = createReactAdapter(fake.runtime);
  const Component = adapter(proto, {
    schedule: (task: () => void) => task(),
    ...(options as any),
  } as any);
  const mounted = fake.render(Component, props, { current: null }, hostEl);
  wrapAdapterUpdate(mounted);
  return { ...mounted, runtime: fake.runtime, Component };
}

function wrapAdapterUpdate(
  mounted: ReturnType<ReturnType<typeof createFakeReactRuntime>['render']>
) {
  const handle = mounted.ref?.current as
    | {
        update?: () => void;
        [WRAPPED_UPDATE]?: true;
      }
    | null
    | undefined;

  if (!handle || typeof handle.update !== 'function' || handle[WRAPPED_UPDATE]) return;

  const rawUpdate = handle.update.bind(handle);
  handle.update = () => {
    rawUpdate();
    mounted.update();
    wrapAdapterUpdate(mounted);
  };
  handle[WRAPPED_UPDATE] = true;
}

function runInstance(inst: HookInstance) {
  let loops = 0;
  do {
    inst.dirty = false;
    inst.hookIndex = 0;
    inst.pendingLayoutEffects = [];
    inst.pendingEffects = [];

    CURRENT = inst;
    const render = (inst.component as any).__forwardRefRender ?? inst.component;
    const vnode = render(inst.props, inst.ref);
    CURRENT = null;

    inst.rootEl = renderVNode(vnode, inst.rootEl);
    syncHost(inst);

    for (const effect of inst.pendingLayoutEffects) effect();
    for (const effect of inst.pendingEffects) effect();

    loops++;
  } while (inst.dirty && loops < 20);
}

function syncHost(inst: HookInstance) {
  if (
    inst.rootEl?.parentNode === inst.hostEl &&
    inst.hostEl.childNodes.length === 1
  ) {
    return;
  }
  inst.hostEl.replaceChildren(...(inst.rootEl ? [inst.rootEl] : []));
}

function appendHost() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

function registerEffect(kind: 'layout' | 'effect', cb: () => void | (() => void), deps?: any[]) {
  const inst = getCurrent();
  const index = inst.hookIndex++;
  const prev = inst.hooks[index] as EffectRecord | undefined;
  const changed = !prev || !depsEqual(prev.deps, deps);
  const nextRecord: EffectRecord = {
    deps,
    cleanup: prev?.cleanup,
    kind,
    create: cb,
  };
  inst.hooks[index] = nextRecord;
  if (!changed) return;

  const runner = () => {
    if (typeof nextRecord.cleanup === 'function') nextRecord.cleanup();
    nextRecord.cleanup = cb() ?? undefined;
  };

  if (kind === 'layout') inst.pendingLayoutEffects.push(runner);
  else inst.pendingEffects.push(runner);
}

function renderVNode(vnode: any, existing: HTMLElement | null): HTMLElement | null {
  if (vnode == null) return null;
  if (vnode.type?.__fakeContext) {
    const child = Array.isArray(vnode.children) ? vnode.children[0] : vnode.children;
    return renderVNode(child, existing);
  }
  if (typeof vnode.type !== 'string') {
    throw new Error('fake-react runtime only supports string host elements in tests');
  }

  const el =
    existing && existing.tagName.toLowerCase() === vnode.type
      ? existing
      : document.createElement(vnode.type);

  applyProps(el, vnode.props ?? {});
  renderChildren(el, vnode.children ?? []);

  return el;
}

function applyProps(el: HTMLElement, props: Record<string, any>) {
  el.className = props.className ?? '';
  const prevOwnedAttrs = OWNED_ATTR_KEYS.get(el) ?? new Set<string>();
  const nextOwnedAttrs = new Set<string>();

  for (const attr of prevOwnedAttrs) {
    const nextValue = props[attr];
    if (!(attr in props) || nextValue == null || nextValue === false) el.removeAttribute(attr);
  }
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith('data-')) continue;
    if (value == null || value === false) continue;
    el.setAttribute(key, String(value));
    nextOwnedAttrs.add(key);
  }
  OWNED_ATTR_KEYS.set(el, nextOwnedAttrs);

  const prevOwned = OWNED_STYLE_KEYS.get(el) ?? new Set<string>();
  const nextOwned = new Set<string>();
  const flatStyle = flattenInlineStyle(props.style);

  if (flatStyle) {
    for (const key of prevOwned) {
      if (!(key in flatStyle)) {
        (el.style as any)[key] = '';
      }
    }
    for (const [key, value] of Object.entries(flatStyle)) {
      (el.style as any)[key] = value as any;
      nextOwned.add(key);
    }
  } else if (prevOwned.size > 0) {
    for (const key of prevOwned) {
      (el.style as any)[key] = '';
    }
  }
  OWNED_STYLE_KEYS.set(el, nextOwned);

  if (props.ref && typeof props.ref === 'object') props.ref.current = el;
}

function renderChildren(parent: HTMLElement, children: any[]) {
  const nodes = children.flat().map(renderChild).filter(Boolean) as Node[];
  // Preserve host-owned content when React did not author children: this covers both
  // native fallback content and independently mounted compound adapter parts.
  // A transition from authored children to none still clears the prior React children.
  const hadAuthoredChildren = HAS_AUTHORED_CHILDREN.get(parent) ?? false;
  const hasAuthoredChildren = nodes.length > 0;
  HAS_AUTHORED_CHILDREN.set(parent, hasAuthoredChildren);
  if (!hasAuthoredChildren && !hadAuthoredChildren) return;
  parent.replaceChildren(...nodes);
}

function renderChild(child: any): Node | null {
  if (child == null || child === false) return null;
  if (typeof child === 'string' || typeof child === 'number') {
    return document.createTextNode(String(child));
  }
  if (Array.isArray(child)) {
    const frag = document.createDocumentFragment();
    for (const part of child) {
      const node = renderChild(part);
      if (node) frag.appendChild(node);
    }
    return frag;
  }
  if (child.type?.__fakeContext) {
    const nested = Array.isArray(child.children) ? child.children[0] : child.children;
    return renderChild(nested);
  }
  if (typeof child.type === 'string') {
    const el = document.createElement(child.type);
    applyProps(el, child.props ?? {});
    renderChildren(el, child.children ?? []);
    return el;
  }
  return null;
}

function depsEqual(a?: any[], b?: any[]) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function getCurrent() {
  if (!CURRENT) throw new Error('fake-react hooks called outside render');
  return CURRENT;
}

function flattenInlineStyle(value: unknown): Record<string, string> | null {
  if (value == null) return null;

  const items = Array.isArray(value) ? value : [value];
  const out: Record<string, string> = {};

  for (const item of items) {
    if (typeof item === 'string') {
      for (const part of item.split(';')) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) out[key] = val;
      }
      continue;
    }
    if (item && typeof item === 'object') {
      for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
        if (val == null || val === '') continue;
        out[key] = String(val);
      }
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}
