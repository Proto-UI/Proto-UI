import { traceCallableDemand } from './callable-effects';
import type { PrototypeIR, SourceSpan } from './ir';
import { OPERATION_RULES } from './operations';
import type { PropsUpdatePolicy } from './observable-semantics';

export interface PropsUpdateRead {
  readonly channel: 'resolved' | 'raw' | 'provided';
  readonly span: SourceSpan;
}

/** An advisory about authored source, never a compiler rejection or a render request. */
export interface PropsUpdateAdvisory {
  readonly code: 'props-update:no-authored-request';
  readonly severity: 'warning';
  readonly message: string;
  readonly span: SourceSpan;
}

export interface PropsUpdateAnalysis {
  readonly version: 'props-update-analysis-v1';
  readonly policy: PropsUpdatePolicy;
  readonly status:
    | 'host-policy'
    | 'no-direct-render-props'
    | 'authored-update-present'
    | 'missing-authored-update'
    | 'unknown';
  /** A present request is not proof that every Props change reaches that request. */
  readonly authoredUpdate: 'present' | 'absent' | 'unknown';
  readonly closed: boolean;
  readonly reads: readonly PropsUpdateRead[];
  readonly updateRequests: readonly SourceSpan[];
  readonly unknownReasons: readonly ('opaque-callable' | 'external-callable')[];
  readonly advisories: readonly PropsUpdateAdvisory[];
}

/**
 * Analyze admitted IR with the compiler's existing callable-demand proof. The
 * proof follows actual helper/hook/callback demand, not names or the presence of
 * a direct Props watcher. Its opaque/cyclic boundary remains unknown.
 *
 * The result concerns direct render-time Props reads and authored update
 * requests. It does not prove output dependence through arbitrary State/data
 * flow, callback execution for every changed key, or the absence of a consumer's
 * public handle.update(). It neither changes the IR nor enters generated code.
 */
export function analyzePropsUpdates(
  ir: PrototypeIR,
  policy: PropsUpdatePolicy
): PropsUpdateAnalysis {
  const reads = new Map<string, PropsUpdateRead>();
  const updates = new Map<string, SourceSpan>();
  const unknown = new Set<'opaque-callable' | 'external-callable'>();
  const key = (span: SourceSpan) => JSON.stringify([span.file, span.start, span.end]);
  traceCallableDemand(ir, {
    expression(value) {
      if (value.kind !== 'operation') return;
      const channel =
        value.operation === 'render.read.props.get'
          ? 'resolved'
          : value.operation === 'render.read.props.getRaw'
            ? 'raw'
            : value.operation === 'render.read.props.isProvided'
              ? 'provided'
              : undefined;
      if (channel) reads.set(key(value.span), { channel, span: { ...value.span } });
      if (
        OPERATION_RULES[value.operation].effects.some(
          (effect) => effect.kind === 'request-update' && effect.resource === 'update-queue'
        )
      )
        updates.set(key(value.span), { ...value.span });
    },
    function() {},
    hook() {},
    call(_value, provenance) {
      // An admitted host callable can arrange a lawful external update. Its
      // checked signature does not reveal its body or prove that it is inert.
      if (provenance.external) unknown.add('external-callable');
    },
    opaque() {
      unknown.add('opaque-callable');
    },
  });
  const order = (left: SourceSpan, right: SourceSpan) =>
    (left.file < right.file ? -1 : left.file > right.file ? 1 : 0) ||
    left.start - right.start ||
    left.end - right.end;
  const observedReads = [...reads.values()].sort((left, right) => order(left.span, right.span));
  const updateRequests = [...updates.values()].sort(order);
  const closed = unknown.size === 0;
  const status: PropsUpdateAnalysis['status'] =
    policy === 'host'
      ? 'host-policy'
      : !closed
        ? 'unknown'
        : !observedReads.length
          ? 'no-direct-render-props'
          : updateRequests.length
            ? 'authored-update-present'
            : 'missing-authored-update';
  return {
    version: 'props-update-analysis-v1',
    policy,
    status,
    authoredUpdate: updateRequests.length ? 'present' : closed ? 'absent' : 'unknown',
    closed,
    reads: observedReads,
    updateRequests,
    unknownReasons: [...unknown].sort(),
    advisories:
      status === 'missing-authored-update'
        ? observedReads.map(({ span }) => ({
            code: 'props-update:no-authored-request',
            severity: 'warning',
            message:
              'This template reads Props, but the closed authored invocation graph contains no update request. Under the explicit policy, Props delivery alone does not commit a render. If changed Props should refresh this output, retain a lawful callback/public-handle update or deliberately select an admitted host policy. This advisory does not prove an application bug or require a direct Props watcher.',
            span,
          }))
        : [],
  };
}
