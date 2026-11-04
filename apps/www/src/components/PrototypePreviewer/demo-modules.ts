import { assertDemoSpec } from './demo-types';
import { buildDemoRegistry } from './demo-registry';

export type { DemoModuleLoader } from './demo-registry';

const demoModuleLoaders = import.meta.glob('../../content/**/*.demo.ts');
const { demoModules, demoSourcePaths } = buildDemoRegistry(demoModuleLoaders);

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
