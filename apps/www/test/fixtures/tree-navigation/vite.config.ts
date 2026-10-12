import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sourceConfig from '../../../../../vitest.config';
const root = fileURLToPath(new URL('.', import.meta.url));
export default {
  root,
  plugins: sourceConfig.plugins,
  server: { host: '127.0.0.1', fs: { allow: [path.resolve(root, '../../../../..')] } },
};
