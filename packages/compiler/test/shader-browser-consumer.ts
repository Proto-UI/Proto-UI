import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import {
  createFeedbackModule,
  EFFECTS_CAP,
  SHADER_PRESENTATION_SINK_CAP,
  type FeedbackInternalHooks,
  type FeedbackPort,
  type ShaderPresentationFrame,
} from '@proto.ui/module-feedback';
import { createWebShaderPresentationSink } from '../../adapters/base/src/material/shader-webgl2';
import prototype from './fixtures/shader-presentation-owner.proto';
import {
  createWebShaderDevice,
  createWebShaderPresenter,
} from '../../adapters/base/src/material/shader-webgl2-host';

type Target = 'react' | 'vue' | 'vue2' | 'wc';
type Execution = 'runtime' | 'compiled';
const adapters = {
  react: createReactAdapter(React),
  vue: createVueAdapter(Vue),
  vue2: createVue2Adapter({
    extend: Vue2.extend.bind(Vue2) as any,
    nextTick: Vue2.nextTick.bind(Vue2),
    set: Vue2.set.bind(Vue2),
    delete: Vue2.delete.bind(Vue2),
  }),
};
const pixels = [255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64, 64, 128, 192, 255];
const tint = [0.5, 1, 0.25, 0.5] as const;
const frame = (
  revision: number,
  fallback: readonly [number, number, number, number] = [0.15, 0.2, 0.25, 1]
) => ({ view: 1, revision, key: String(revision), fallback });
const program = (device: ReturnType<typeof createWebShaderDevice>) =>
  device.tint(device.copy(device.upload({ width: 2, height: 2, pixels })), tint);

async function settled(target?: Target) {
  await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

/** Framework-native mounting; compiled outputs never receive a Proto definition or IR. */
export function createShaderBrowserFixture(generated: Record<Target, any>) {
  let sequence = 0;
  let active: {
    host: HTMLElement;
    update(visible: boolean): Promise<void>;
    close(): Promise<void>;
  } | null = null;
  let direct: ReturnType<typeof createWebShaderPresenter> | null = null;
  let capabilityControl: {
    override(): void;
    reset(): void;
    remount(): void;
    oldCommit(): void;
    oldRelease(): void;
    read(): { views: number[]; releases: number[]; diagnostics: readonly string[] };
  } | null = null;
  let clicks = 0,
    clickedTag = '';
  const components = new Map<string, any>();
  function component(target: Target, execution: Execution) {
    const key = target + '/' + execution;
    if (components.has(key)) return components.get(key);
    let value: any;
    if (target === 'wc') {
      value = `shader-${execution}-${++sequence}`;
      if (execution === 'compiled') generated.wc.register(value);
      else AdaptToWebComponent(prototype as any, { registerAs: value });
    } else
      value =
        execution === 'compiled'
          ? target === 'react'
            ? generated.react.CompiledComponent
            : generated[target].default
          : adapters[target](prototype as any);
    components.set(key, value);
    return value;
  }
  function surface() {
    if (!active) return null;
    const elements: Element[] = [];
    const visit = (root: Element | ShadowRoot) => {
      for (const child of root.children) {
        elements.push(child);
        visit(child);
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    visit(active.host);
    return (
      (elements.find((element) =>
        (element as HTMLElement).style?.getPropertyValue('background-image')
      ) as HTMLElement | undefined) ?? null
    );
  }
  async function close() {
    capabilityControl = null;
    direct?.dispose();
    direct = null;
    if (active) {
      const old = active;
      active = null;
      await old.close();
      old.host.remove();
    }
    await settled();
  }
  return {
    async mount(target: Target, execution: Execution) {
      await close();
      clicks = 0;
      clickedTag = '';
      const host = document.createElement('div');
      host.id = 'consumer';
      document.body.append(host);
      host.addEventListener('click', (event) => {
        clicks++;
        clickedTag = (event.composedPath()[0] as Element).tagName;
      });
      const Component = component(target, execution);
      let visible = true;
      let update: () => Promise<void>, unmount: () => void;
      if (target === 'react') {
        const app = createRoot(host);
        update = async () => {
          flushSync(() => app.render(React.createElement(Component, { visible }, 'slot child')));
          await settled(target);
        };
        unmount = () => flushSync(() => app.unmount());
        await update();
      } else if (target === 'vue') {
        const props = Vue.shallowRef({ visible });
        const app = Vue.createApp({
          render: () => Vue.h(Component, props.value, () => 'slot child'),
        });
        app.mount(host);
        update = async () => {
          props.value = { visible };
          await settled(target);
        };
        unmount = () => app.unmount();
      } else if (target === 'vue2') {
        const app = new Vue2({
          render(h) {
            return h(
              Component,
              {
                props: execution === 'compiled' ? { visible } : {},
                ...(execution === 'runtime' ? { attrs: { visible } } : {}),
              },
              ['slot child']
            );
          },
        }).$mount();
        host.append(app.$el);
        update = async () => {
          app.$forceUpdate();
          await settled(target);
        };
        unmount = () => app.$destroy();
      } else {
        const element = document.createElement(Component) as any;
        element.textContent = 'slot child';
        update = async () => {
          if (execution === 'compiled') element.setProps({ visible });
          else setElementProps(element, { visible });
          await settled(target);
        };
        await update();
        host.append(element);
        unmount = () => {
          element.remove();
          if (execution === 'compiled') element.dispose();
        };
      }
      active = {
        host,
        update: async (next) => {
          visible = next;
          await update();
        },
        close: async () => {
          unmount();
          await settled(target);
        },
      };
      await settled(target);
    },
    async visible(value: boolean) {
      if (!active) throw new Error('No consumer');
      await active.update(value);
    },
    ready() {
      return surface()?.style.backgroundImage.includes('data:image/png') ?? false;
    },
    read() {
      const root = surface();
      const texts: string[] = [];
      let canvases = 0;
      const visit = (element: Element | ShadowRoot) => {
        for (const child of element.children) {
          if (child.tagName === 'CANVAS') canvases++;
          if (child.tagName === 'BUTTON') texts.push(child.textContent ?? '');
          visit(child);
          if (child.shadowRoot) visit(child.shadowRoot);
        }
      };
      if (active) visit(active.host);
      return {
        background: root?.style.backgroundImage ?? null,
        fallback: root ? getComputedStyle(root).backgroundColor : null,
        childText: active?.host.textContent ?? '',
        buttonTexts: texts,
        canvases,
        clicks,
        clickedTag,
      };
    },
    async pixels() {
      const root = surface();
      if (!root) throw new Error('No shader surface');
      const match = root.style.backgroundImage.match(
        /^url\(["']?(data:image\/png;base64,[A-Za-z0-9+/=]+)["']?\)$/
      );
      if (!match) throw new Error('No decoded shader image');
      const image = new Image();
      image.src = match[1];
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    },
    directPixels() {
      const device = createWebShaderDevice(document, () => {});
      try {
        const source = device.upload({ width: 2, height: 2, pixels });
        const copy = device.copy(source);
        const output = device.tint(copy, tint);
        return { copy: Array.from(device.read(copy)), tint: Array.from(device.read(output)) };
      } finally {
        device.dispose();
      }
    },
    async capabilityStart() {
      await close();
      const host = document.createElement('div'),
        root = document.createElement('div');
      root.textContent = 'retained child';
      host.append(root);
      document.body.append(host);
      const effects = { queueStyle() {}, requestFlush() {} };
      const caps = new CapsVault();
      const frames: ShaderPresentationFrame[] = [],
        releases: number[] = [];
      const wrap = () => {
        const provider = createWebShaderPresentationSink(() => root, effects);
        return {
          commit(frame: ShaderPresentationFrame) {
            frames.push(frame);
            provider.commit(frame);
          },
          release(view: number) {
            releases.push(view);
            provider.release(view);
          },
          diagnostics: provider.diagnostics,
        };
      };
      const base = wrap(),
        replacement = wrap();
      caps.attachBase([
        [SYS_CAP, undefined],
        [EFFECTS_CAP, effects],
        [SHADER_PRESENTATION_SINK_CAP, base],
      ]);
      const module = createFeedbackModule({
        init: { prototypeName: 'shader-capability-owner', declarations: [] },
        caps,
        deps: {
          requireFacade() {
            throw new Error('unexpected semantic dependency');
          },
          requirePort() {
            throw new Error('unexpected semantic dependency');
          },
          tryFacade: () => undefined,
          tryPort: () => undefined,
        },
      });
      module.facade.material.shader({
        version: 1,
        source: {
          kind: 'owned-pixels',
          width: 2,
          height: 2,
          pixels,
          colorSpace: 'linear-srgb',
          alpha: 'premultiplied',
          origin: 'top-left',
        },
        passes: [
          { id: 'copy', kernel: 'copy-rgba8-v1', input: '$source' },
          { id: 'tint', kernel: 'tint-rgba8-v1', input: 'copy', tint },
        ],
        output: 'tint',
        fallback: [0.15, 0.2, 0.25, 1],
      });
      const hooks = module.hooks as FeedbackInternalHooks;
      const port = (module as typeof module & { port: FeedbackPort }).port;
      let epoch = 1;
      const mount = () => {
        hooks.onMountPhase?.('mounting', epoch);
        hooks.onProtoPhase?.('mounted');
        hooks.onMountPhase?.('mounted', epoch);
      };
      active = { host, update: async () => {}, close: async () => hooks.dispose?.() };
      mount();
      const original = frames[0];
      if (!original) throw new Error('No shader binding');
      capabilityControl = {
        override: () => caps.attach([[SHADER_PRESENTATION_SINK_CAP, replacement]]),
        reset: () => caps.resetAttached(),
        remount() {
          hooks.onMountPhase?.('unmounting', epoch);
          hooks.onMountPhase?.('detached', epoch);
          epoch++;
          mount();
        },
        oldCommit: () => base.commit(original),
        oldRelease: () => base.release(original.view),
        read: () => ({
          views: frames.map((frame) => frame.view),
          releases: [...releases],
          diagnostics: port.shaderDiagnostics?.() ?? [],
        }),
      };
    },
    capabilityOverride: () => capabilityControl!.override(),
    capabilityReset: () => capabilityControl!.reset(),
    capabilityRemount: () => capabilityControl!.remount(),
    capabilityOldCommit: () => capabilityControl!.oldCommit(),
    capabilityOldRelease: () => capabilityControl!.oldRelease(),
    capabilityRead: () => capabilityControl!.read(),
    async prepareFailure() {
      await close();
      const host = document.createElement('div');
      host.textContent = 'direct child';
      document.body.append(host);
      active = { host, update: async () => {}, close: async () => {} };
      // A child is the provider surface so the ordinary observation boundary stays identical.
      const root = document.createElement('div');
      root.textContent = 'retained child';
      host.append(root);
      let throws = false;
      direct = createWebShaderPresenter({
        root: () => root,
        prepare() {
          if (throws) throw new Error('semantic prepare');
        },
      });
      direct.commit(frame(1), program);
      // Hold an actually decoded old image before entering the throwing preparation.
      // Releasing that completion later is the stale-publication negative control.
      await (window as any).shaderProbe.waitForHeldDecode();
      throws = true;
      direct.commit(frame(2, [0, 0.5, 0, 1]), program);
    },
    async cleanupReentry() {
      await close();
      const host = document.createElement('div');
      const root = document.createElement('div');
      root.textContent = 'retained child';
      host.append(root);
      document.body.append(host);
      active = { host, update: async () => {}, close: async () => {} };
      direct = createWebShaderPresenter({ root: () => root, prepare() {} });
      direct.commit(frame(1), program);
      (window as any).shaderProbe.onDelete = () =>
        direct!.commit(frame(3, [0, 0, 0.5, 1]), program);
      direct.commit(frame(2, [0.5, 0, 0, 1]), program);
    },
    async externalWriter() {
      await close();
      const host = document.createElement('div'),
        root = document.createElement('div');
      root.textContent = 'retained child';
      host.append(root);
      document.body.append(host);
      active = { host, update: async () => {}, close: async () => {} };
      direct = createWebShaderPresenter({ root: () => root, prepare() {} });
      direct.commit(frame(1), program);
      await (window as any).shaderProbe.waitForHeldDecode();
      root.style.backgroundImage = 'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))';
      return root.style.backgroundImage;
    },
    recommitDirect() {
      direct?.commit(frame(2), program);
    },
    disposeDirect() {
      direct?.dispose();
    },
    diagnostics: () => direct?.diagnostics() ?? [],
    close,
  };
}
