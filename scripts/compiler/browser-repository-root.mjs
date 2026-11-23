import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve both source modules and Astro's relocated server bundles. */
export function findBrowserRepositoryRoot(moduleURL) {
  let directory = path.dirname(fileURLToPath(moduleURL));
  for (;;) {
    if (existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
      const packageName = (file) =>
        JSON.parse(readFileSync(path.join(directory, file), 'utf8')).name;
      if (
        packageName('package.json') !== 'proto-ui' ||
        packageName('packages/compiler/package.json') !== '@proto.ui/compiler' ||
        packageName('apps/www/package.json') !== 'apps-www'
      )
        throw new Error(`Unexpected browser compiler workspace: ${directory}`);
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error(`Browser compiler workspace not found above ${moduleURL}`);
    directory = parent;
  }
}
