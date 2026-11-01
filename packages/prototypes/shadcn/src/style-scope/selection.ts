import type { DefHandle, RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_IDS,
  SHADCN_STYLE_SCOPE,
  normalizeShadcnStyle,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from './context';

function declareChoice<Props extends ShadcnStyleProps, Exposes = Record<string, unknown>>(
  def: DefHandle<Props, Exposes>
) {
  const cdef = def as unknown as DefHandle<ShadcnStyleProps>;
  cdef.props.define({
    styleProfile: {
      type: 'enum',
      options: [...SHADCN_STYLE_IDS, 'new-york', 'inherit'],
      empty: 'fallback',
    },
  });
  // Only a non-selecting sentinel may default: a concrete default would mask inheritance.
  cdef.props.setDefaults({ styleProfile: 'inherit' });
}

/** Derives paint only. Does not own Base state or mutate host/editor instances. */
export function setupShadcnStyleSelection<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  compatibilityStyle: ShadcnStyleId,
  options: { supportedStyles?: readonly ShadcnStyleId[] } = {}
) {
  declareChoice(def);
  const selected = def.state.enum('shadcnStyleSelection', compatibilityStyle, {
    options: SHADCN_STYLE_IDS,
  });
  const sync = (run: RunHandle<Props>) => {
    const explicit = normalizeShadcnStyle(run.props.getRaw().styleProfile);
    const inherited = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? null;
    const next = explicit ?? inherited ?? compatibilityStyle;
    if (options.supportedStyles && !options.supportedStyles.includes(next)) {
      throw new Error(`[shadcn-style-scope] Unsupported style for this consumer: ${next}`);
    }
    selected.set(next, 'reason: shadcn style selection');
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
  def.props.watchRaw(['styleProfile'], sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  // Existing lifecycle callbacks re-read at actual update boundaries. They do not
  // manufacture an invalidation for arbitrary ancestry-only reparent operations.
  def.lifecycle.onUpdated(sync);
  return selected;
}

/** Nested scope inherits strictly above itself; null preserves each leaf's baseline. */
export function setupShadcnStyleScope<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  declareChoice(def);
  def.context.provide(SHADCN_STYLE_SCOPE, { style: null });
  const sync = (run: RunHandle<Props>) => {
    const next =
      normalizeShadcnStyle(run.props.getRaw().styleProfile) ??
      run.context.tryReadAncestor(SHADCN_STYLE_SCOPE)?.style ??
      null;
    // Avoid publishing equivalent JSON and creating redundant callback cascades.
    if (run.context.tryRead(SHADCN_STYLE_SCOPE)?.style !== next) {
      run.context.update(SHADCN_STYLE_SCOPE, { style: next });
    }
  };
  // Self read is required for equality above; ancestor read is required for inheritance.
  def.context.trySubscribe(SHADCN_STYLE_SCOPE);
  def.context.trySubscribeAncestor(SHADCN_STYLE_SCOPE, sync);
  def.props.watchRaw(['styleProfile'], sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
}
