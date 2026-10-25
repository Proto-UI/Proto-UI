// Controlled imports: only the existing registrator and import-free diagnostic.
// Inherited bootstrap preloads are not inspected or stripped.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { observeStandaloneConnectionOrder } from './preassembled-ce-order.mjs';

let result;
try {
  GlobalRegistrator.register();
  result = observeStandaloneConnectionOrder();
  console.log(JSON.stringify({
    kind: 'standalone-preassembled-custom-element-order',
    host: 'installed-happy-dom',
    fixtureProductImports: false,
    bootstrap: {
      nodeOptionsPresent: Object.hasOwn(process.env, 'NODE_OPTIONS'),
      execArgvPresent: process.execArgv.length > 0,
      preloadIsolationVerified: false,
    },
    ...result,
  }));
  if (result.errors.length || result.observations.length !== 2) {
    throw new Error('standalone HappyDOM diagnostic collection incomplete; see observations/errors');
  }
  // A collected child-first result is NOT a pass of the parent-first contract.
  // The original required product fixture and failure exit remain independent.
} finally {
  GlobalRegistrator.unregister();
}
