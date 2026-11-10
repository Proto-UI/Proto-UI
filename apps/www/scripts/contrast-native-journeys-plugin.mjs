import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recipe = 'apps/www/src/content/docs/zh-cn/demo-brutalist-button.demo.ts';
const helper = 'apps/www/scripts/contrast-native-journeys.mjs';
export const CONTRAST_JOURNEY_TRANSFORM_ENDPOINT = '/__pui_contrast_native_journeys';

// Audit-only App Maker observation of the existing outward event, not a
// Prototype/Adapter transform. The ordinary production recipe stays literal.
export function contrastNativeJourneysPlugin(root) {
  if (process.env.PROTO_UI_CONTRAST_AUDIT !== '1') return undefined;
  const recipePath = path.resolve(root, recipe).replaceAll('\\', '/');
  const helperPath = path.resolve(root, helper).replaceAll('\\', '/');
  let retained;
  return {
    name: 'proto-ui-contrast-native-journeys',
    apply: /** @type {const} */ ('serve'),
    enforce: /** @type {const} */ ('pre'),
    transform(code, id) {
      if (id.split('?')[0].replaceAll('\\', '/') !== recipePath || id.includes('?raw'))
        return null;
      const original = readFileSync(recipePath, 'utf8');
      if (code !== original)
        throw new Error('Button observation requires the exact untransformed authored recipe.');
      const marker = 'export default {';
      const start = code.indexOf(marker);
      if (start < 0 || code.indexOf(marker, start + marker.length) !== -1)
        throw new Error('Button observation requires one literal authored default demo.');
      const binding = { schemaVersion: 1, source: recipe,
        originalSHA: sha(original), helperSHA: sha(readFileSync(helperPath)),
        kind: 'audit-only public DemoRuntimeApi onClick consumer subscription',
      };
      const transformed =
        `import { withContrastButtonCommands } from ${JSON.stringify(`/@fs${helperPath}`)};\n` +
        code.slice(0, start) + 'const contrastObservedButtonDemo = {' +
        code.slice(start + marker.length) +
        `\nexport default withContrastButtonCommands(contrastObservedButtonDemo, ${JSON.stringify(binding)});\n`;
      const receipt = { ...binding, transformedSHA: sha(transformed), original, transformed,
        stage: 'Vite serve pre-transform; original source and callback-free admission retained',
      };
      if (retained && JSON.stringify(retained) !== JSON.stringify(receipt))
        throw new Error('Button audit transform changed during one server lifetime.');
      retained = receipt;
      return { code: transformed, map: null };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== CONTRAST_JOURNEY_TRANSFORM_ENDPOINT) return next();
        // Main installs the existing provenance middleware first. Its actual
        // loopback/origin guard and server identity also protect this endpoint.
        if (typeof res.getHeader('x-proto-ui-contrast-server') !== 'string') {
          res.statusCode = 503;
          res.end('Native journey instrumentation requires the provenance guard.');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          res.end(JSON.stringify({ error: 'Use GET for the retained transform.' }));
          return;
        }
        res.statusCode = retained ? 200 : 409;
        res.end(JSON.stringify(retained ?? { error: 'The authored Button has not loaded.' }));
      });
    },
  };
}
