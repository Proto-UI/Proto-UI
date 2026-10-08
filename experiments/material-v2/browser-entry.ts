import {
  mountMaterialConsumer,
  type MaterialRuntime,
  type MaterialView,
} from '../../apps/www/test/material-v2-direct-consumer';
import { createPreviewMaterialScene } from '../../apps/www/src/components/PrototypePreviewer/preview-material-scene';
import { observeWebPointerContact } from 'material-v2-contact-diagnostics';
import { createWebOpticalProgram } from 'material-v2-program-diagnostics';
import { inspectWebOpticalResources } from 'material-v2-diagnostics';
const scenes: ReturnType<typeof createPreviewMaterialScene>[] = [];
const views: MaterialView[] = [];
const counts = new Map<string, number>();
const activations: { runtime: string; time: number }[] = [];
(window as any).v2Material = {
  activations: () => activations.slice(),
  metrics: () => inspectWebOpticalResources(document),
  scenes: () => scenes,
  controls() {
    const scene = scenes[0],
      source = scene.lease.current();
    if (!source) throw Error('Control source unavailable');
    const host = scene.mount.querySelector<HTMLElement>('[data-demo-ref="regular"]')!;
    const rect = host.getBoundingClientRect(),
      backdrop = source.canvas.getBoundingClientRect();
    const outset = Math.ceil(Math.max(rect.width, rect.height) * 0.08 + 1);
    const frame = {
      source,
      geometry: {
        width: rect.width,
        height: rect.height,
        radius: Math.min(parseFloat(getComputedStyle(host).borderTopLeftRadius), rect.height / 2),
        paintOutset: outset,
        dpr: devicePixelRatio,
        bounds: [
          (rect.left - backdrop.left) / backdrop.width,
          (rect.top - backdrop.top) / backdrop.height,
          rect.width / backdrop.width,
          rect.height / backdrop.height,
        ],
      },
      pressed: true,
      contact: { x: 0.72, y: 0.25, deltaX: 0.4, deltaY: -0.1, strength: 1 },
      variant: 'clear',
      fill: [1, 1, 1, 1],
      foreground: [0, 0, 0, 1],
    };
    return [null, 'zero-refraction', 'zero-deformation', 'zero-aberration'].map((control) => {
      const program = createWebOpticalProgram(document.createElement('canvas'), control);
      try {
        return {
          control: control ?? 'full',
          image: program.render(frame),
          metrics: program.inspect(),
          geometry: frame.geometry,
        };
      } finally {
        program.dispose();
      }
    });
  },
  observeContact: (el: HTMLElement, fn: (value: unknown) => void) =>
    observeWebPointerContact(el, fn),
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
        activations.push({ runtime, time: performance.now() });
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
