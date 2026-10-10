import { defineConfig, mergeConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import base from '../../vitest.config';
const websiteRequire = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const config = mergeConfig(base, {});
config.resolve = {
  ...config.resolve,
  alias: [
    { find: /^react$/, replacement: websiteRequire.resolve('react') },
    { find: /^react-dom$/, replacement: websiteRequire.resolve('react-dom') },
    { find: /^react-dom\/client$/, replacement: websiteRequire.resolve('react-dom/client') },
    { find: /^vue$/, replacement: websiteRequire.resolve('vue') },
    { find: /^vue2-runtime$/, replacement: websiteRequire.resolve('vue2-runtime') },
  ],
};
config.test = { ...config.test, include: ['experiments/material-v2/*.test.ts'] };
export default defineConfig(config);
