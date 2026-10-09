import { initialPaintSceneColors } from './scene';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import surface from '@proto.ui/prototypes-liquid-glass/surface';
import { THEME } from '../../packages/prototypes/liquid-glass/src/theme';
import { createCanvasBackdropLease } from '../../packages/adapters/base/src/material/source';
import { createWebMaterialSink } from '../../packages/adapters/base/src/material/sink';
import { createWebMaterialPreferences } from '../../packages/adapters/base/src/material/preferences';
import {
  armExperimentalInitialPaintCapture,
  prepareExperimentalInitialPaint,
} from '../../packages/adapters/base/src/material/initial-paint-experiment';
import type { InitialPaintManifestBinding } from '../../packages/adapters/base/src/material/initial-paint-receipt';

const scope = document.querySelector<HTMLElement>('[data-seed-scene]')!;
const canvas = scope.querySelector<HTMLCanvasElement>('canvas')!;
const host = document.querySelector<HTMLElement>('#seed-control')!;
const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
const lease = createCanvasBackdropLease(scope, canvas);
const preferences = createWebMaterialPreferences(window);
const palette = {
  current: () => ({ revision: 1, colors: THEME[theme] }),
  subscribe: () => () => {},
};
const options = { source: lease, preferences, palette };
// The same repository-owned deterministic scene runs in producer and consumer.
// No fonts, images, fetched input, DOM sampling, or live animation enters it.
lease.draw((context, width, height) => {
  const scene = initialPaintSceneColors(
    theme,
    new URL(location.href).searchParams.has('unsafe-dark-control')
  );
  const colors = scene.bands;
  context.fillStyle = colors[0];
  context.fillRect(0, 0, width, height);
  for (let band = 0; band < 12; band++) {
    context.fillStyle = colors[band % colors.length];
    context.fillRect(Math.floor((band * width) / 12), 0, Math.ceil(width / 12), height);
  }
  context.fillStyle = scene.centre;
  context.fillRect(
    Math.floor(width * 0.34),
    Math.floor(height * 0.18),
    Math.floor(width * 0.22),
    Math.floor(height * 0.64)
  );
});
const captureMode = new URL(location.href).searchParams.has('capture');
const layout: import('../../packages/adapters/base/src/material/initial-paint-receipt').InitialPaintLayout =
  {
    id: 'rest-surface-480x200',
    viewportWidth: 1000,
    viewportHeight: 800,
    dpr: 1,
    theme,
  };
const capture = captureMode ? armExperimentalInitialPaintCapture(host, layout) : null;
let disposeInitial = () => {};
const browser = window as typeof window & {
  initialPaintExperiment?: {
    artifact(): ReturnType<NonNullable<typeof capture>['artifact']>;
    dispose(): void;
    revokeSource(): void;
  };
};
async function enhance() {
  if (!captureMode) {
    const serialized = document.querySelector<HTMLScriptElement>('#seed-receipt')!.textContent!;
    const binding = JSON.parse(
      document.querySelector<HTMLScriptElement>('#seed-binding')!.textContent!
    ) as InitialPaintManifestBinding;
    const prepared = await prepareExperimentalInitialPaint(host, serialized, binding, options);
    disposeInitial = prepared.dispose;
  }
  // SSR supplies the exact rest props before upgrade. The native <a> outside
  // this static Surface remains the one keyboard/click owner.
  setElementProps(host, { variant: 'outline', radius: 'full', border: 'none', elevation: 'none' });
  AdaptToWebComponent(surface, {
    registerAs: 'initial-paint-surface',
    createVisualSink: (element, effects) => createWebMaterialSink(element, effects, options),
  });
  document.documentElement.dataset.seedEnhanced = 'true';
}
browser.initialPaintExperiment = {
  artifact() {
    if (!capture) throw new Error('capture-mode-required');
    return capture.artifact();
  },
  revokeSource() {
    lease.revoke();
  },
  dispose() {
    host.remove();
    disposeInitial();
    capture?.dispose();
    lease.dispose();
  },
};
void enhance().catch((error) => {
  document.documentElement.dataset.seedError = String(error);
  console.error(error);
});
