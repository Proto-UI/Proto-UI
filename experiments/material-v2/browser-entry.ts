import {
  mountMaterialConsumer,
  type MaterialRuntime,
  type MaterialView,
} from '../../apps/www/test/material-v2-direct-consumer';
import { createPreviewMaterialScene } from '../../apps/www/src/components/PrototypePreviewer/preview-material-scene';
import { inspectWebOpticalResources } from 'material-v2-diagnostics';
const scenes: ReturnType<typeof createPreviewMaterialScene>[] = [];
const views: MaterialView[] = [];
const counts = new Map<string, number>();
(window as any).v2Material = {
  metrics: () => inspectWebOpticalResources(document),
  pause() {
    for (const scene of scenes) scene.pause(true);
  },
  source(available: boolean) {
    for (const scene of scenes) scene.sourceAvailable(available);
  },
  async dispose() {
    for (const view of views.splice(0).reverse()) await view.destroy();
    for (const scene of scenes.splice(0)) scene.dispose();
  },
};
async function mount() {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as MaterialRuntime[]) {
    const parent = document.querySelector<HTMLElement>(`[data-runtime="${runtime}"]`)!;
    const scene = createPreviewMaterialScene(parent);
    scenes.push(scene);
    views.push(
      await mountMaterialConsumer(runtime, scene.mount, () => {
        counts.set(runtime, (counts.get(runtime) ?? 0) + 1);
        document.querySelector(`[data-count="${runtime}"]`)!.textContent = String(
          counts.get(runtime)
        );
      })
    );
  }
  document.documentElement.dataset.ready = 'true';
}
void mount().catch((error) => {
  document.documentElement.dataset.error = String(error);
  console.error(error);
});
