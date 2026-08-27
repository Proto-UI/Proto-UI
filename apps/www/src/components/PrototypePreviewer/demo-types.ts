import type { RuntimeId } from './runtimes/registry';

export type DemoTextNode = {
  kind: 'text';
  text: string;
};

export type DemoNode =
  | DemoTextNode
  | {
      kind: 'box';
      className?: string;
      ref?: string;
      children?: DemoChild[];
    }
  | {
      kind: 'proto';
      prototypeId: string;
      className?: string;
      surfaceStyle?: string | Record<string, string> | Array<Record<string, string>>;
      ref?: string;
      props?: Record<string, unknown>;
      children?: DemoChild[];
    };

export type DemoChild = DemoNode | string;

export type DemoRuntimeApi = {
  call(ref: string, path: string, ...args: unknown[]): unknown;
  getExposes(ref: string): Record<string, unknown> | undefined;
  setProps(ref: string, next: Record<string, unknown>): void;
};

export type DemoSetupContext = {
  host: HTMLElement;
  refs: Record<string, HTMLElement>;
  api: DemoRuntimeApi;
};

export type DemoSpec = {
  type: 'demo';
  root: DemoNode;
  setup?: (ctx: DemoSetupContext) => void | (() => void);
};

export type DemoRenderResult = {
  destroy: () => Promise<void> | void;
};

function assertJsonLike(value: unknown, path: string[] = []) {
  const makePath = () => (path.length === 0 ? '(root)' : path.join('.'));
  const fail = (detail: string) => {
    throw new Error(
      `[PrototypePreviewer] demo props 必须是 JSON-like 数据。\n` +
        `非法值位置: ${makePath()}\n` +
        `问题: ${detail}`
    );
  };

  if (value === null) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') {
    fail(`不支持的类型 "${t}"`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertJsonLike(value[i], [...path, `[${i}]`]);
    }
    return;
  }
  if (t === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail('仅支持普通对象');
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertJsonLike(v, [...path, k]);
    }
    return;
  }

  fail(`不支持的类型 "${t}"`);
}

function assertClassName(value: unknown, path: string[]) {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new Error(
      `[PrototypePreviewer] demo className 必须是字符串。\n` + `非法值位置: ${path.join('.')}`
    );
  }
}

export function assertDemoSpec(demo: DemoSpec) {
  if (!demo || typeof demo !== 'object' || demo.type !== 'demo') {
    throw new Error('[PrototypePreviewer] demo 格式错误：缺少 type="demo"。');
  }
  if (!demo.root) {
    throw new Error('[PrototypePreviewer] demo 格式错误：缺少 root。');
  }
  if (demo.setup !== undefined && typeof demo.setup !== 'function') {
    throw new Error('[PrototypePreviewer] demo.setup 必须是函数。');
  }

  const walk = (node: DemoChild, path: string[]) => {
    if (typeof node === 'string') return;
    if (!node || typeof node !== 'object') {
      throw new Error(`[PrototypePreviewer] demo 节点非法：${path.join('.')}`);
    }
    if (node.kind === 'text') {
      if (typeof (node as any).text !== 'string') {
        throw new Error(`[PrototypePreviewer] demo text 必须是字符串：${path.join('.')}`);
      }
      return;
    }
    if (node.kind === 'box') {
      assertClassName((node as any).className, [...path, 'className']);
      if ((node as any).surfaceStyle !== undefined) {
        assertJsonLike((node as any).surfaceStyle, [...path, 'surfaceStyle']);
      }
      if (
        (node as Record<string, unknown>).ref !== undefined &&
        typeof (node as Record<string, unknown>).ref !== 'string'
      ) {
        throw new Error(`[PrototypePreviewer] demo ref 必须是字符串：${path.join('.')}`);
      }
    } else if (node.kind === 'proto') {
      const protoId = (node as any).prototypeId;
      if (!protoId || typeof protoId !== 'string') {
        throw new Error(`[PrototypePreviewer] demo 节点缺少 prototypeId：${path.join('.')}`);
      }
      assertClassName((node as any).className, [...path, 'className']);
      if (
        (node as Record<string, unknown>).ref !== undefined &&
        typeof (node as Record<string, unknown>).ref !== 'string'
      ) {
        throw new Error(`[PrototypePreviewer] demo ref 必须是字符串：${path.join('.')}`);
      }
      if ((node as any).props !== undefined) {
        assertJsonLike((node as any).props, [...path, 'props']);
      }
    } else {
      throw new Error(`[PrototypePreviewer] demo 节点 kind 不合法：${path.join('.')}`);
    }

    if ((node as any).children) {
      if (!Array.isArray((node as any).children)) {
        throw new Error(`[PrototypePreviewer] demo children 必须是数组：${path.join('.')}`);
      }
      (node as any).children.forEach((child: DemoChild, i: number) =>
        walk(child, [...path, 'children', String(i)])
      );
    }
  };

  walk(demo.root, ['root']);
}

export function collectPrototypeIds(node: DemoChild, out: Set<string>) {
  if (typeof node === 'string') return;
  if (node.kind === 'proto') {
    out.add(node.prototypeId);
  }
  if (node.kind === 'text') return;
  const kids = node.children ?? [];
  for (const child of kids) collectPrototypeIds(child, out);
}

export type DemoRenderOptions = {
  runtime: RuntimeId;
  demo: DemoSpec;
  host: HTMLElement;
  /** Returns false once the caller has switched away or been destroyed. */
  isCurrent?: () => boolean;
};
