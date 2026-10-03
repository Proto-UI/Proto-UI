/**
 * Finite facts for the default Web token -> style -> DOM pipeline. This provider
 * is installed only by the four Web adapters that implement those lowerings.
 * CSS.supports is a necessary browser syntax filter, not paint/fidelity evidence;
 * real-host consumer evidence must still prove each claimed pipeline.
 */
export function readWebStyleSupport(
  doc: Document | undefined,
  key: string
): boolean | 'unknown' | undefined {
  if (key !== 'styleSupport.alphaFill' && key !== 'styleSupport.backdropBlur4px') return undefined;
  const css = doc?.defaultView?.CSS;
  if (typeof css?.supports !== 'function') return 'unknown';
  try {
    if (key === 'styleSupport.alphaFill')
      return (
        css.supports('background-color', 'color-mix(in oklab, rgb(44 44 46) 80%, transparent)') &&
        css.supports(
          'background-color',
          'color-mix(in oklab, var(--pui-secondary) 80%, transparent)'
        )
      );
    return css.supports('backdrop-filter', 'blur(4px)');
  } catch {
    return 'unknown';
  }
}
/**
 * Default browser/pipeline support is constant for this Document lifetime; the
 * lease has no observer. Capability replacement/loss still invalidates the owner.
 * Other hosts/providers need their own paired source and realization evidence.
 */
export function createDefaultWebStyleSupportSource(
  getter: (key: string) => unknown,
  doc = typeof document === 'undefined' ? undefined : document
) {
  if (typeof doc?.defaultView?.CSS?.supports !== 'function') return undefined;
  return {
    getter,
    subscribe(
      _keys: readonly ('styleSupport.alphaFill' | 'styleSupport.backdropBlur4px')[],
      _invalidate: () => void
    ) {
      return () => {};
    },
  };
}
