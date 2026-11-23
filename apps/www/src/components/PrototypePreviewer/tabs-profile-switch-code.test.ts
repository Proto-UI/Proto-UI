// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transform } from 'esbuild';
import { afterEach, expect, it, vi } from 'vitest';
import { tabsProfileSwitchCode } from '../../content/docs/demo_components/tabs/tabs-profile-switch-code';

// Execute exactly the displayed source against the built public package exports.
// These are ordinary framework consumers; no DemoRenderer or source alias is used.
const require = createRequire(resolve('apps/www/package.json'));
const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  document.body.replaceChildren();
});

async function execute(source: string, runtime: string) {
  const output = await transform(source, { loader: 'tsx', format: 'cjs', target: 'es2022' });
  const module = { exports: {} as Record<string, any> };
  const resolveImport = (id: string) =>
    runtime === 'vue2' && id === 'vue' ? require('vue2-runtime/dist/vue.common.js') : require(id);
  new Function('require', 'module', 'exports', output.code)(resolveImport, module, module.exports);
  return module.exports;
}

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: the published profile-switch source builds and preserves its live Tabs child`, async () => {
    const source = tabsProfileSwitchCode[runtime];
    const host = document.createElement('div');
    document.body.append(host);
    if (runtime === 'react') {
      const React = require('react');
      const { createRoot } = require('react-dom/client');
      const { flushSync } = require('react-dom');
      const { TabsProfiles } = await execute(source, runtime);
      const root = createRoot(host);
      disposers.push(() => flushSync(() => root.unmount()));
      flushSync(() => root.render(React.createElement(TabsProfiles)));
    } else if (runtime === 'vue') {
      const { descriptor, errors } = parse(source, { filename: 'TabsProfiles.vue' });
      expect(errors).toEqual([]);
      const script = compileScript(descriptor, {
        id: 'tabs-profiles-consumer',
        inlineTemplate: true,
      });
      const component = (await execute(script.content, runtime)).default;
      const app = require('vue').createApp(component);
      app.mount(host);
      disposers.push(() => app.unmount());
    } else if (runtime === 'vue2') {
      const { descriptor, errors } = parse(source, { filename: 'TabsProfiles.vue' });
      expect(errors).toEqual([]);
      const component = (await execute(descriptor.script!.content, runtime)).default;
      const Vue = require('vue2-runtime/dist/vue.common.js');
      const app = new Vue({ ...component, ...Vue.compile(descriptor.template!.content) });
      app.$mount();
      host.append(app.$el);
      disposers.push(() => app.$destroy());
    } else {
      const script = source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
      expect(script).toBeTruthy();
      host.innerHTML = source.replace(/<script type="module">[\s\S]*?<\/script>/, '');
      const module = await execute(`${script}\nexport { dispose };`, runtime);
      disposers.push(() => module.dispose());
    }

    const tabs = () => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
    await vi.waitFor(() => expect(tabs(), host.innerHTML).toHaveLength(3));
    const password = tabs().find((tab) => tab.textContent?.trim() === 'Password')!;
    const account = tabs().find((tab) => tab.textContent?.trim() === 'Account')!;
    expect(account.getAttribute('aria-selected')).toBe('true');
    password.click();
    await vi.waitFor(() => expect(password.getAttribute('aria-selected')).toBe('true'));
    const child = password.firstChild;
    const select = (name: string) => {
      const button = [...host.querySelectorAll('button')].find((node) => node.textContent === name);
      expect(button, `authored ${name} profile button`).toBeTruthy();
      button!.click();
    };
    for (const [profile, radius] of [
      ['nova', 'rounded-md'],
      ['rhea', 'rounded-2xl'],
      ['new-york-v4', 'rounded-md'],
    ]) {
      select(profile!);
      await vi.waitFor(() =>
        expect(password.getAttribute('data-pui-style')?.split(/\s+/)).toContain(radius)
      );
      expect(password.isConnected).toBe(true);
      expect(password.firstChild).toBe(child);
      expect(password.getAttribute('aria-selected')).toBe('true');
      expect(tabs().find((tab) => tab.textContent?.trim() === 'Password')).toBe(password);
    }
  }, 20_000);
}
