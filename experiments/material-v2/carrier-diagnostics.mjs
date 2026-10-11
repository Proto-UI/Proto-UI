/** Test-only, bounded observation of the real computed-style reads used by
 * carrier admission. The sink removes a rejected carrier synchronously, so a
 * timeout's DOM snapshot cannot recover the values that caused its rejection.
 * This function is self-contained for Playwright's addInitScript serialization.
 * It never changes a returned CSSStyleDeclaration or material admission. */
export function installCarrierStyleDiagnostics() {
  const original = window.getComputedStyle;
  const samples = [];
  window.__carrierStyleDiagnostics = samples;
  window.getComputedStyle = function (...args) {
    const css = Reflect.apply(original, this, args);
    try {
      const [host, pseudo] = args;
      if (
        pseudo === '::before' &&
        host.getAttribute('data-pui-material-carrier') === 'contact-v1' &&
        samples.length < 32
      ) {
        const hostCss = Reflect.apply(original, this, [host]);
        const values = (style) =>
          Object.fromEntries(
            Array.from({ length: style.length }, (_, index) => {
              const name = style.item(index);
              return [name, style.getPropertyValue(name)];
            })
          );
        samples.push({
          runtime: host.closest('[data-runtime]')?.getAttribute('data-runtime') ?? null,
          time: performance.now(),
          inline: host.getAttribute('style'),
          connected: host.isConnected,
          tree: host.getRootNode() === document ? 'document' : 'other',
          host: { position: hostCss.position, isolation: hostCss.isolation },
          computed: values(css),
        });
      }
    } catch {
      // Observation must not replace or suppress production return values.
    }
    return css;
  };
}
