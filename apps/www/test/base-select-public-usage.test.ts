// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { transform } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import * as wcAdapter from '@proto.ui/adapter-web-component';
import * as reactAdapter from '@proto.ui/adapter-react';
import * as vueAdapter from '@proto.ui/adapter-vue';
import * as vue2Adapter from '@proto.ui/adapter-vue2';
import * as select from '@proto.ui/prototypes-base/select';
import lucideChevronDownIcon from '@proto.ui/prototypes-lucide/icons/chevron-down';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeMap } from '../src/content/docs/demo_components/base-select/baseSelectCode';

const hosts = ['wc', 'react', 'vue', 'vue2'] as const;
type Host = (typeof hosts)[number];
const requireVue2 = createRequire(resolve('packages/adapters/vue2/package.json'));
const Vue2 = requireVue2('vue/dist/vue.common.js');
const consumers: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  for (const dispose of consumers.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

async function loadSource(source: string, host: Host, filename: string) {
  const { code } = await transform(source, {
    loader: host === 'react' ? 'tsx' : 'ts',
    format: 'cjs',
    target: 'es2022',
    sourcefile: filename,
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  });
  const publicModules: Record<string, unknown> = {
    react: React,
    'react-dom': ReactDOM,
    vue: host === 'vue2' ? Vue2 : Vue,
    '@proto.ui/adapter-web-component': wcAdapter,
    '@proto.ui/adapter-react': reactAdapter,
    '@proto.ui/adapter-vue': vueAdapter,
    '@proto.ui/adapter-vue2': vue2Adapter,
    '@proto.ui/prototypes-base/select': select,
    '@proto.ui/prototypes-lucide/icons/chevron-down': {
      __esModule: true,
      default: lucideChevronDownIcon,
    },
  };
  const module = { exports: {} as { default?: any } };
  const requirePublicSource = (id: string) => {
    // Like Vitest's CSS handling, this executes no JavaScript for a stylesheet.
    // The documented app build owns generated structural CSS; these cases verify
    // the displayed application source and real host behavior, not native paint.
    if (id === './styles/proto-ui-style.css' || id === './src/styles/proto-ui-style.css') return {};
    if (!Object.hasOwn(publicModules, id))
      throw new Error('Unexpected import in public Select Usage: ' + id);
    return publicModules[id];
  };
  new Function('require', 'module', 'exports', code)(requirePublicSource, module, module.exports);
  return module.exports;
}

async function mountSource(host: Host) {
  const source = codeMap[host]?.['demo-base-select'];
  if (!source) throw new Error('Missing public Select Usage for ' + host);
  const container = document.createElement('div');
  document.body.append(container);
  const styles: HTMLStyleElement[] = [];
  let unmount: () => void = () => {};
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      unmount();
    } finally {
      container.remove();
      for (const style of styles) style.remove();
    }
  };
  consumers.push(dispose);
  const installStyle = (css: string) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    styles.push(style);
  };

  if (host === 'wc') {
    const documentSource = new DOMParser().parseFromString(source, 'text/html');
    const scripts = documentSource.querySelectorAll('script[type="module"]');
    if (scripts.length !== 1) throw new Error('WC Usage needs one real application module');
    const script = scripts[0]!.textContent ?? '';
    scripts[0]!.remove();
    for (const style of documentSource.querySelectorAll('style'))
      installStyle(style.textContent ?? '');
    // HappyDOM 15 replaces ancestors during late custom-element upgrade without
    // reconnecting their copied descendants. Parse the authored body after the
    // real registrations, at the module's first template lookup. Browser upgrade
    // behavior remains a separate native check; no Adapter or prop is replaced.
    const bodyHTML = documentSource.body.innerHTML;
    const querySelector = document.querySelector;
    const query = vi.spyOn(document, 'querySelector').mockImplementation(function <
      E extends Element = Element,
    >(selectors: string): E | null {
      if (selectors === '#base-select-example') {
        query.mockRestore();
        container.innerHTML = bodyHTML;
      }
      return querySelector.call(document, selectors) as E | null;
    });
    try {
      await loadSource(script, host, 'index.html.module.ts');
    } finally {
      query.mockRestore();
    }
  } else if (host === 'react') {
    const { default: App } = await loadSource(source, host, 'App.tsx');
    if (typeof App !== 'function') throw new Error('React Usage must export an App component');
    const root = createRoot(container);
    unmount = () => root.unmount();
    root.render(React.createElement(App));
  } else {
    const { descriptor, errors } = parse(source, { filename: 'App.vue' });
    if (errors.length) throw new Error('Invalid public Select SFC: ' + errors.join('\n'));
    if (!descriptor.template) throw new Error('Select SFC has no authored template');
    for (const style of descriptor.styles) installStyle(style.content);
    if (host === 'vue') {
      const script = compileScript(descriptor, {
        id: 'base-select-public-usage',
        inlineTemplate: true,
      });
      const { default: App } = await loadSource(script.content, host, 'App.vue.ts');
      const app = Vue.createApp(App);
      unmount = () => app.unmount();
      app.mount(container);
    } else {
      if (!descriptor.script) throw new Error('Vue 2 Usage has no component registration');
      const { default: App } = await loadSource(descriptor.script.content, host, 'App.vue.js');
      const template = Vue2.compile(descriptor.template.content);
      const app = new Vue2({ ...App, ...template });
      unmount = () => app.$destroy();
      // Descendant mounted hooks must see the connected application ancestry.
      const point = document.createElement('div');
      container.append(point);
      app.$mount(point);
    }
  }
  return { container, dispose };
}

describe('Base Select public Usage is executable application source', () => {
  it.each(hosts)(
    '%s compiles, commits the authored value, and retires its open portal',
    async (host) => {
      const consumer = await mountSource(host);
      const trigger = () => consumer.container.querySelector<HTMLElement>('[role="combobox"]');
      await vi.waitFor(() =>
        expect(trigger()?.getAttribute('aria-label')).toBe('Framework selector')
      );
      const control = trigger()!;
      const root = consumer.container.querySelector<HTMLElement>(
        '[data-pui-root][data-value][data-text-value]'
      )!;
      const value = consumer.container.querySelector<HTMLElement>(
        '[data-pui-root][data-display-value]'
      )!;
      expect(root).not.toBeNull();
      expect(value).not.toBeNull();
      expect(value.textContent).toBe('Pick a framework');
      expect(root.getAttribute('data-value')).toBe('');
      expect(root.getAttribute('data-text-value')).toBe('');

      control.click();
      await vi.waitFor(() => expect(control.getAttribute('aria-expanded')).toBe('true'));
      const content = () => document.getElementById(control.getAttribute('aria-controls') ?? '');
      await vi.waitFor(() => expect(content()?.getAttribute('role')).toBe('listbox'));
      const options = Array.from(content()!.querySelectorAll<HTMLElement>('[role="option"]'));
      expect(options.map((option) => option.textContent?.trim())).toEqual([
        'React',
        'Vue',
        'Web Components',
      ]);
      await vi.waitFor(() => expect(document.activeElement).toBe(options[0]));
      options[0]!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        })
      );
      await vi.waitFor(() => expect(document.activeElement).toBe(options[1]));
      expect(root.getAttribute('data-value')).toBe('');
      options[1]!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      );
      await vi.waitFor(() => {
        expect(root.getAttribute('data-value')).toBe('vue');
        expect(root.getAttribute('data-text-value')).toBe('Vue');
        expect(value.textContent).toBe('Vue');
        expect(control.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(control);
      });
      expect(control.getAttribute('aria-label')).toBe('Framework selector');

      control.click();
      await vi.waitFor(() => expect(control.getAttribute('aria-expanded')).toBe('true'));
      await vi.waitFor(() => expect(content()?.isConnected).toBe(true));
      const retiring = content()!;
      expect(consumer.container.contains(retiring)).toBe(false);
      consumer.dispose();
      await vi.waitFor(() => expect(retiring.isConnected).toBe(false));
    },
    30_000
  );
});
