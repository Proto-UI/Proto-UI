import type { CreateElement, VueConstructor } from 'vue';
import { describe, expect, it } from 'vitest';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { CodeBlock } from '../../../compositions/chatui/src/code-block';
import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

const CODE_SAMPLE = `function greet(name: string) {
  return \`hello ${'${name}'}\`;
}
${'x'.repeat(160)}`;
const UPDATED_CODE_SAMPLE = CODE_SAMPLE.replace('hello', 'welcome');

describe('adapter-vue2: private CodeBlock composition', () => {
  it('mounts every part, preserves authored code, and does not invoke Button on rerender', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(CodeBlock.Root);
    const Header = adapt(CodeBlock.Header);
    const Content = adapt(CodeBlock.Content);
    const Button = adapt(brutalistButton);
    const RootComponent = Root as unknown as VueConstructor;
    const HeaderComponent = Header as unknown as VueConstructor;
    const ContentComponent = Content as unknown as VueConstructor;
    const ButtonComponent = Button as unknown as VueConstructor;
    let actionCalls = 0;
    let currentCode = CODE_SAMPLE;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const App = Vue2Any.extend({
      render(createElement: CreateElement) {
        return createElement(RootComponent, { attrs: { 'data-demo-ref': 'root' } }, [
          createElement(HeaderComponent, { attrs: { 'data-demo-ref': 'header' } }, [
            createElement('span', {}, ['TypeScript · server.ts']),
            createElement(
              ButtonComponent,
              {
                attrs: { 'data-demo-ref': 'copy' },
                on: {
                  click: () => {
                    actionCalls += 1;
                  },
                },
              },
              ['Copy']
            ),
          ]),
          createElement(ContentComponent, { attrs: { 'data-demo-ref': 'content' } }, [currentCode]),
        ]);
      },
    });
    const app = new App().$mount();
    host.appendChild(app.$el);

    try {
      await flushVue2();
      await flushVue2();

      const root = host.querySelector<HTMLElement>('[data-demo-ref="root"]');
      const header = host.querySelector<HTMLElement>('[data-demo-ref="header"]');
      const content = host.querySelector<HTMLElement>('[data-demo-ref="content"]');
      const button = host.querySelector<HTMLElement>('[data-demo-ref="copy"]');
      expect(root).not.toBeNull();
      expect(header).not.toBeNull();
      expect(root?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-w-0', 'flex-col', 'rounded-lg'])
      );
      expect(header?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'items-center', 'justify-between'])
      );
      expect(content?.textContent).toBe(CODE_SAMPLE);
      expect(content?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['whitespace-pre-wrap', 'wrap-anywhere'])
      );
      expect(button?.textContent).toBe('Copy');
      currentCode = UPDATED_CODE_SAMPLE;
      app.$forceUpdate();
      await flushVue2();
      expect(content?.textContent).toBe(UPDATED_CODE_SAMPLE);
      expect(actionCalls).toBe(0);

      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      expect(actionCalls).toBe(1);
    } finally {
      app.$destroy();
      host.remove();
    }
  });
});
