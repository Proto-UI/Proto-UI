/** @returns {import('astro').AstroIntegration} */
export function websiteClientChunkIsolation() {
  return {
    name: 'proto-ui-client-chunk-isolation',
    hooks: {
      'astro:build:setup': ({ target, updateConfig }) => {
        if (target !== 'client') return;
        // Keep optional providers out of eager browser chunks without changing
        // the server chunks used during static page rendering.
        updateConfig({
          build: {
            rollupOptions: { output: { onlyExplicitManualChunks: true } },
          },
        });
      },
    },
  };
}
