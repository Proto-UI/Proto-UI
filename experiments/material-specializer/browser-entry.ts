import button from './button.proto';
import { definePrototype } from '@proto.ui/core';
import type { ButtonProps, ButtonExposes } from '@proto.ui/prototypes-base/button';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { installExperimentalVisualConsumer } from '@proto.ui/adapter-web-component/internal/visual-consumer';
import {
  createOwnedTextureVisualSink,
  type OwnedTexture,
  type MaterialPreferences,
} from '@proto.ui/adapter-web-component/internal/owned-texture-sink';
import program from 'material-program';
import baselineProgram from 'material-baseline-program';
const viewMode = new URL(location.href).searchParams.get('view') ?? 'light';
// Test-only view topology; the Base Button/material declaration is unchanged.
const fixtureButton =
  viewMode === 'nested'
    ? definePrototype<ButtonProps, ButtonExposes>({
        ...button,
        name: 'experimental-material-nested-view',
        setup(def) {
          button.setup(def);
          return (r) => r.el('span', [r.slot()]);
        },
      })
    : button;
const diagnosticBaseline =
  new URL(location.href).searchParams.get('profile') === 'source-157-control';

const scene = document.querySelector<HTMLElement>('#scene')!;
const backdrop = document.querySelector<HTMLCanvasElement>('#backdrop')!;
const pixels = new Uint8Array(800 * 480 * 4);
function drawScene(kind = 'checker') {
  backdrop.width = 800;
  backdrop.height = 480;
  const context = backdrop.getContext('2d')!;
  if (kind === 'checker') {
    for (let y = 0; y < 480; y++)
      for (let x = 0; x < 800; x++) {
        const i = (y * 800 + x) * 4;
        const band = ((Math.floor(x / 28) + Math.floor(y / 44)) % 2) * 65;
        pixels[i] = 135 + band + Math.round((x / 800) * 45);
        pixels[i + 1] = 140 + Math.round((y / 480) * 95);
        pixels[i + 2] = 230 - band;
        pixels[i + 3] = 255;
      }
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels), 800, 480), 0, 0);
  } else {
    // Owned procedural scene pixels, never DOM capture or imported imagery.
    context.fillStyle = kind === 'dark' ? '#182239' : kind === 'solid' ? '#b9c4d1' : '#e7edf5';
    context.fillRect(0, 0, 800, 480);
    if (kind === 'text') {
      context.fillStyle = '#8991a0';
      context.font = '600 18px system-ui';
      for (let y = 20; y < 480; y += 27)
        context.fillText('OWNED SCENE  ·  FIELD NOTES 024  ·  TYPE & LIGHT  ·  OWNED SCENE', 10, y);
    }
    pixels.set(context.getImageData(0, 0, 800, 480).data);
  }
}
drawScene();
let generation = 1;
function texture(): OwnedTexture {
  return {
    generation,
    width: 800,
    height: 480,
    pixels,
    bounds(host) {
      const root = scene.getBoundingClientRect(),
        rect = host.getBoundingClientRect();
      return [
        (rect.left - root.left) / 800,
        (rect.top - root.top) / 480,
        rect.width / 800,
        rect.height / 480,
      ];
    },
  };
}
let current: OwnedTexture | null = texture();
let clonedSnapshots = false;
const sourceListeners = new Set<() => void>();
const preferenceListeners = new Set<() => void>();
let safe = true;
const preferences: MaterialPreferences = {
  current: () => ({
    reducedMotion: safe ? 'no-preference' : 'reduce',
    reducedTransparency: 'no-preference',
    contrast: 'no-preference',
    forcedColors: 'none',
  }),
  subscribe: (fn) => {
    preferenceListeners.add(fn);
    return () => preferenceListeners.delete(fn);
  },
};
let preparationCount = 0;
let preparationMode = 'normal';
const candidateProgram = {
  ...program,
  prepareSource(pixels: Uint8Array, width: number, height: number) {
    preparationCount++;
    if (preparationMode === 'throw') throw new Error('diagnostic-preparation-failure');
    if (preparationMode === 'short') return new Uint8Array(4);
    if (preparationMode === 'transparent') return new Uint8Array(pixels.length);
    return program.prepareSource(pixels, width, height);
  },
};
installExperimentalVisualConsumer(fixtureButton, (host, style, surface) =>
  createOwnedTextureVisualSink(
    host,
    style,
    diagnosticBaseline ? baselineProgram : candidateProgram,
    {
      current: () => (current && clonedSnapshots ? { ...current } : current),
      subscribe: (fn) => {
        sourceListeners.add(fn);
        return () => sourceListeners.delete(fn);
      },
    },
    preferences,
    surface
  )
);
const Button = AdaptToWebComponent(fixtureButton, {
  registerAs: 'owned-material-button',
  shadow: viewMode === 'shadow',
});
let element = new Button();
let clicks = 0;
function mount() {
  element.id = 'glass';
  element.textContent = 'Continue';
  element.addEventListener('click', (event) => {
    if (event instanceof CustomEvent) {
      clicks++;
      document.querySelector('#count')!.textContent = String(clicks);
    }
  });
  scene.append(element);
}
mount();
const probe = {
  state() {
    const exposes = element.getExposes();
    return {
      profile: diagnosticBaseline ? 'source-157-control' : 'regular-readable-v3',
      preparationCount,
      materialFrame: Number(element.dataset.materialFrame ?? 0),
      sourceGeneration: generation,
      viewMode,
      surfaceRoot: element.shadowRoot ? 'shadow' : 'light',
      canvasDirect:
        (element.shadowRoot ?? element).querySelector('canvas')?.parentNode ===
        (element.shadowRoot ?? element),
      pressed: exposes.pressed.get(),
      disabled: exposes.disabled.get(),
      focused: exposes.focused.get(),
      focusVisible: exposes.focusVisible.get(),
      clicks,
      quality: element.dataset.materialQuality,
      reason: element.dataset.materialReason,
      phase: element.dataset.materialPhase,
      radius: element.dataset.materialRadius,
      sourceListeners: sourceListeners.size,
      preferenceListeners: preferenceListeners.size,
    };
  },
  listeners() {
    return { sourceListeners: sourceListeners.size, preferenceListeners: preferenceListeners.size };
  },
  disabled(value: boolean) {
    setElementProps(element, { disabled: value });
  },
  safe(value: boolean) {
    safe = value;
    for (const listener of preferenceListeners) listener();
  },
  source(value: boolean) {
    generation++;
    current = value ? texture() : null;
    for (const listener of sourceListeners) listener();
  },
  invalidSource() {
    generation++;
    current = { ...texture(), pixels: new Uint8Array(4) };
    for (const listener of sourceListeners) listener();
  },
  preparation(mode: string) {
    if (!['normal', 'throw', 'short', 'transparent'].includes(mode))
      throw new Error('unknown mode');
    preparationMode = mode;
    generation++;
    current = texture();
    for (const listener of sourceListeners) listener();
  },
  scene(kind: string) {
    if (!['checker', 'text', 'solid', 'light', 'dark'].includes(kind))
      throw new Error('unknown scene');
    drawScene(kind);
    generation++;
    current = texture();
    for (const listener of sourceListeners) listener();
  },
  clonedSnapshots(value: boolean) {
    clonedSnapshots = value;
    for (const listener of sourceListeners) listener();
  },
  move(x: number, y: number) {
    element.style.left = `${310 + x}px`;
    element.style.top = `${216 + y}px`;
  },
  pixels() {
    return (element.shadowRoot ?? element).querySelector('canvas')?.toDataURL();
  },
  update() {
    element.update();
  },
  remove() {
    element.remove();
  },
  remount() {
    element = new Button();
    mount();
  },
};
(window as any).probe = probe;
(window as any).ready = true;
