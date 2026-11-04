export type DemoModuleLoader = () => Promise<any>;

const DEMO_SUFFIX = '.demo.ts';

function getDemoIdFromPath(path: string): string | null {
  const file = path.split('/').pop();
  if (!file || !file.endsWith(DEMO_SUFFIX)) return null;
  return file.slice(0, -DEMO_SUFFIX.length);
}

/** Build the same filename-keyed registry used by the production content glob. */
export function buildDemoRegistry(demoModuleLoaders: Record<string, DemoModuleLoader>) {
  const demoModules: Record<string, DemoModuleLoader> = {};
  const demoSourcePaths: Record<string, string> = {};

  for (const [path, loader] of Object.entries(demoModuleLoaders)) {
    const id = getDemoIdFromPath(path);
    if (!id) continue;
    if (demoModules[id]) {
      throw new Error(
        `[PrototypePreviewer] demo ID 冲突: "${id}"。\n` +
          `请确保 *.demo.ts 文件名唯一。\n` +
          `冲突文件: ${path}`
      );
    }
    demoModules[id] = loader as DemoModuleLoader;
    demoSourcePaths[id] = path.replace('../../content/', 'apps/www/src/content/');
  }
  return { demoModules, demoSourcePaths };
}
