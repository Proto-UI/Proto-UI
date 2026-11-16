/** React host-looking inputs are not an implicit DOM forwarding channel. */
export function diagnoseHostProps(
  prototypeName: string,
  rawProps: Readonly<Record<string, unknown>>,
  declaredProps: Readonly<Record<string, unknown>>,
  warned: Set<string>
): void {
  try {
    // Keep the direct expression for production bundlers that replace NODE_ENV
    // without installing a browser process global.
    if (process.env.NODE_ENV === 'production') return;
  } catch {
    // An unbundled browser has no process global; retain actionable diagnostics.
  }
  for (const key of Object.keys(rawProps)) {
    if (
      key === 'data-demo-ref' ||
      Object.hasOwn(declaredProps, key) ||
      warned.has(key) ||
      !(/^(aria-|data-)/.test(key) || ['id', 'role', 'tabIndex', 'title'].includes(key))
    )
      continue;
    warned.add(key);
    console.warn(
      `[React Adapter:${prototypeName}] "${key}" is not a declared prototype Prop and is not forwarded to the host. ` +
        'Use the documented component API; for an independent accessible name on an opted-in control, ' +
        'pair Label and control with instanceAssociations.controlLabel. Use a native wrapper for application metadata. ' +
        'Prototype-owned role and ARIA state remain authoritative.'
    );
  }
}
