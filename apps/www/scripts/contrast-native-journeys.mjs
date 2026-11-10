// Issue #852 audit observers. Retained objects identify physical targets; IDs
// describe those targets and never authorize borrowing a replacement.
// The browser-executable observer bundle lives in
// contrast-native-journeys.browser.ts (self-contained for the esbuild IIFE);
// this module re-exports it and adds the opt-in consumer wrapper that only the
// declared serve transform may reference.
export * from './contrast-native-journeys.browser.ts';

const commandRegistryKey = Symbol.for('proto-ui.contrast-button-commands.v1');

/** Only the opt-in development transform calls this consumer wrapper. */
export function withContrastButtonCommands(demo, sourceBinding) {
  if (demo.setup !== undefined)
    throw new Error('Button command observation cannot replace an authored setup/callback.');
  const refs = ['solidMain', 'disabledSolid', 'disabledSurface'];
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node === 'string') return;
    if (refs.includes(node.ref)) nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(demo.root);
  for (const ref of refs) {
    const matches = nodes.filter((node) => node.ref === ref);
    if (matches.length !== 1 || matches[0].prototypeId !== 'brutalist-button' ||
        Object.keys(matches[0].props ?? {}).some((key) => /^on[A-Z]/.test(key)))
      throw new Error(`Button audit requires one callback-free authored ${ref}.`);
  }
  return {
    ...demo,
    setup(ctx) {
      if (!ctx.api.removeProps || !ctx.api.getPublicInstance)
        throw new Error('Button audit requires the built-in public consumer API.');
      const registry = globalThis[commandRegistryKey] ??= new Set();
      const sessions = refs.map((ref) => ({
        ref, ctx, sourceBinding, active: true, count: 0, deliveries: [],
      }));
      const dispose = () => {
        // Retire every observer before removing any callback: cleanup can reenter.
        for (const session of sessions) {
          session.active = false;
          registry.delete(session);
        }
        let failure;
        let failed = false;
        for (const ref of refs) {
          try { ctx.api.removeProps(ref, ['onClick']); }
          catch (error) { if (!failed) { failed = true; failure = error; } }
        }
        if (failed) throw failure;
      };
      try {
        for (const session of sessions) {
          registry.add(session);
          ctx.api.setProps(session.ref, {
            onClick(payload) {
              if (!session.active) return;
              session.count++;
              session.deliveries.push({ index: session.count, at: performance.now(), payload });
            },
          });
        }
      } catch (error) {
        try { dispose(); } catch { /* Keep the original setup failure. */ }
        throw error;
      }
      return dispose;
    },
  };
}
