import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Astro can choose a different free port. Never accept that fallback: the
 * readiness probe must address this exact owned preview, not another server. */
export async function startStrictPreview(
  { root, port },
  start = async (config) => (await import('astro')).preview(config)
) {
  // Astro's preview passes inlineConfig.root into path.relative while building
  // its route manifest. Its public config boundary needs a filesystem string.
  const rootPath = root instanceof URL ? fileURLToPath(root) : root;
  const preview = await start({ root: rootPath, server: { host: '127.0.0.1', port, open: false } });
  const address = preview.server.address();
  if (!address || typeof address === 'string' || address.port !== port) {
    await preview.stop();
    const error = new Error(
      `EADDRINUSE: requested production preview port ${port} was unavailable; refusing fallback ${typeof address === 'object' ? address?.port : address}`
    );
    error.code = 'EADDRINUSE';
    throw error;
  }
  return preview;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const port = Number(process.env.PROTO_UI_SEARCH_PRODUCTION_PORT);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error('Invalid production preview port');
    const preview = await startStrictPreview({ root: new URL('../', import.meta.url), port });
    process.send?.({ type: 'search-production-preview-ready', port });
    await preview.closed();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
