import { OFFICIAL_EXPOSED_STATE_NAMES } from '../../modules/expose-state-web/src/utils';
export type { ExposeStateWebMode } from '../../modules/expose-state-web/src/caps';

/** Standalone lowering of M-EXPOSE-STATE-WEB-0001; naming aliases remain module-owned. */
export const nativeExposeStateWebArtifact = {
  path: '.proto-ui/expose-state/web-v1.ts',
  kind: 'source' as const,
  contents: String.raw`// Web-only ExposedState projection. No Proto-UI Runtime/Core/Adapter dependency.
export type NativeWebStateEvent = { type: 'next'; next: unknown } | { type: 'disconnect' };
export type NativeWebStateSource = {
  semantic?: string;
  kind: string;
  get(): unknown;
  subscribe(callback: (event: NativeWebStateEvent) => void): () => void;
};
export type NativeWebStateMode = { allowContinuousAttr?: boolean; allowStringVar?: boolean };
const officialNames: Readonly<Record<string, string>> = ${JSON.stringify(OFFICIAL_EXPOSED_STATE_NAMES)};

function names(semantic: string) {
  const base = Object.hasOwn(officialNames, semantic) ? officialNames[semantic] : semantic
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return { attr: 'data-' + base, cssVar: '--pui-' + base };
}

export function createNativeExposeStateWeb(options: {
  isAlive(): boolean;
  getHost(): HTMLElement | null;
  getMirrors?(): readonly (HTMLElement | null | undefined)[];
  mode?: NativeWebStateMode;
}) {
  const sources = new WeakMap<object, NativeWebStateSource>();
  const declarations = new Map<string, { source: NativeWebStateSource; attr: string; cssVar: string }>();
  const removals: (() => void)[] = [];
  let disposed = false, active = false, generation = 0;
  const mode = options.mode;

  function apply(host: HTMLElement, binding: { source: NativeWebStateSource; attr: string; cssVar: string }, value: unknown) {
    const { source, attr, cssVar } = binding;
    const scalar = value == null ? '' : String(value);
    const attrValue = source.kind === 'bool' ? value ? '' : null : scalar;
    const setAttr = source.kind === 'bool' || source.kind === 'enum' || source.kind === 'string'
      || source.kind === 'number.discrete' || source.kind === 'number.range' && mode?.allowContinuousAttr;
    const setVar = source.kind === 'number.discrete' || source.kind === 'number.range'
      || (source.kind === 'enum' || source.kind === 'string') && mode?.allowStringVar;
    function write(target: HTMLElement) {
      if (setAttr) {
        if (attrValue === null) target.removeAttribute(attr);
        else target.setAttribute(attr, attrValue);
      }
      if (setVar) target.style.setProperty(cssVar, scalar);
    }
    write(host);
    const mirrors = options.getMirrors?.();
    if (mirrors) for (let index = 0; index < mirrors.length; ++index) {
      const target = mirrors[index];
      if (target && target !== host && mirrors.indexOf(target) === index) write(target);
    }
  }

  function unmount(): void {
    active = false;
    ++generation;
    while (removals.length) removals.pop()!();
    // The catalog leaves erasing/restoring old DOM artifacts unresolved.
  }

  function mount(): void {
    unmount();
    if (disposed || !options.isAlive()) return;
    const host = options.getHost();
    if (!host) return;
    active = true;
    const epoch = generation;
    try {
      for (const binding of declarations.values()) {
        apply(host, binding, binding.source.get());
        removals.push(binding.source.subscribe(event => {
          if (disposed || !active || generation !== epoch || !options.isAlive()
            || options.getHost() !== host || event.type !== 'next') return;
          apply(host, binding, event.next);
        }));
      }
    } catch (error) { unmount(); throw error; }
  }

  return {
    track(handle: object, source: NativeWebStateSource): void { sources.set(handle, source); },
    expose(key: string, handle: unknown): void {
      if (!handle || typeof handle !== 'object') return;
      const source = sources.get(handle);
      if (!source) return;
      const mapping = names(source.semantic || key);
      declarations.set(key, { source, ...mapping });
    },
    mount,
    refresh(): void { if (active) mount(); },
    unmount,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unmount();
      declarations.clear();
    },
  };
}
`,
};
