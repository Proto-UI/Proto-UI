import { assertDemoSpec } from './demo-types';

export type DemoModuleLoader = () => Promise<any>;

const DEMO_SUFFIX = '.demo.ts';

function getDemoIdFromPath(path: string): string | null {
  const file = path.split('/').pop();
  if (!file || !file.endsWith(DEMO_SUFFIX)) return null;
  return file.slice(0, -DEMO_SUFFIX.length);
}

const demoModuleLoaders = import.meta.glob('../../content/**/*.demo.ts');
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

export async function loadDemo(demoId: string) {
  const loader = demoModules[demoId];
  if (!loader) {
    throw new Error(
      `[PrototypePreviewer] 未找到 demo "${demoId}" 的加载器。\n` +
        `可用的 demo: ${Object.keys(demoModules).join(', ')}`
    );
  }
  const mod = await loader();
  const demo = mod?.default;
  assertDemoSpec(demo);
  return demo;
}

export function getAvailableDemos(): string[] {
  return Object.keys(demoModules);
}

/** Exact repository path from the same glob that loads the executable recipe. */
export function getDemoSourcePath(demoId: string): string {
  const path = demoSourcePaths[demoId];
  if (!path) throw new Error(`[PrototypePreviewer] missing source path for demo ${demoId}.`);
  return path;
}
