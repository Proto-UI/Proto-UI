// packages/modules/rule/src/when-builder.ts
import type { RuleDep, WhenBuilder, WhenExpr, WhenLiteral, WhenSignal } from './types';
import type { PropsBaseType } from '@proto.ui/types';

function stateIdOf(s: any): string {
  const id = s?.__stateId ?? s?.id ?? s;
  if (typeof id === 'string' || typeof id === 'number') return String(id);
  return `obj:${String(id)}`;
}

export function createWhenBuilder<Props extends PropsBaseType>(opts?: {
  onStateHandle?: (id: any, handle: any) => void;
}) {
  const deps: RuleDep<Props>[] = [];
  const depKeySet = new Set<string>();

  const pushDep = (d: RuleDep<Props>) => {
    const key =
      d.kind === 'prop'
        ? `prop:${String(d.key)}`
        : d.kind === 'state'
          ? `state:${stateIdOf(d.id)}`
          : d.kind === 'context'
            ? `context:${String(d.key)}`
            : `meta:${String(d.key)}`;

    if (depKeySet.has(key)) return;
    depKeySet.add(key);
    deps.push(d);
  };

  const makeSignal = (left: any, stateKind?: string): WhenSignal<Props, any> => ({
    gte(lit: number): WhenExpr<Props> {
      if (stateKind === 'number.list')
        throw new Error('[Rule] number.list does not support scalar gte comparisons');
      if (typeof lit !== 'number' || !Number.isFinite(lit))
        throw new Error('[Rule] gte requires a finite number literal');
      return { type: 'gte', left, right: lit };
    },
    eq(lit: WhenLiteral): WhenExpr<Props> {
      if (stateKind === 'number.list') {
        throw new Error('[Rule] number.list does not support scalar eq comparisons');
      }
      return { type: 'eq', left, right: lit };
    },
  });

  const w: WhenBuilder<Props> = {
    prop(key) {
      pushDep({ kind: 'prop', key });
      return makeSignal({ type: 'prop', key });
    },
    state(s: any) {
      const id = s?.__stateId ?? s?.id ?? s;
      pushDep({ kind: 'state', id });
      if (opts?.onStateHandle) opts.onStateHandle(id, s);
      return makeSignal({ type: 'state', id }, s?.__stateSpec?.kind ?? s?.__stateKind);
    },
    ctx(key: any) {
      pushDep({ kind: 'context', key });
      return makeSignal({ type: 'context', key });
    },
    meta(key: string) {
      pushDep({ kind: 'meta', key });
      return makeSignal({ type: 'meta', key });
    },

    all(...exprs: WhenExpr<Props>[]): WhenExpr<Props> {
      return { type: 'all', exprs };
    },
    any(...exprs: WhenExpr<Props>[]): WhenExpr<Props> {
      return { type: 'any', exprs };
    },
    not(expr: WhenExpr<Props>): WhenExpr<Props> {
      return { type: 'not', expr };
    },

    t(): WhenExpr<Props> {
      return { type: 'true' };
    },
    f(): WhenExpr<Props> {
      return { type: 'false' };
    },
  };

  return {
    w,
    getDeps: () => deps.slice(),
  };
}
