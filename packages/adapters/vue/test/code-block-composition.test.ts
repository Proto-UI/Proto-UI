import { describe, expect, it } from 'vitest';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { CodeBlock } from '../../../compositions/chatui/src/code-block';
import { createVueAdapter } from '../src/adapt';
import { flushVue, VueAny } from './utils/vue';

const CODE_SAMPLE = `function greet(name: string) {
  return \`hello ${'${name}'}\`;
}
${'x'.repeat(160)}`;
const UPDATED_CODE_SAMPLE = CODE_SAMPLE.replace('hello', 'welcome');

describe('adapter-vue: private CodeBlock composition', () => {
  it('mounts every part, preserves authored code, and does not invoke Button on rerender', async () => {
    const adapt = createVueAdapter(VueAny);
    const Root = adapt(CodeBlock.Root);
    const Header = adapt(CodeBlock.Header);
    const Content = adapt(CodeBlock.Content);
    const Button = adapt(brutalistButton);
    const code = VueAny.ref(CODE_SAMPLE);
    let actionCalls = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = VueAny.createApp({
      setup() {
        return () =>
          VueAny.h(Root, { 'data-demo-ref': 'root' }, () => [
            VueAny.h(Header, { 'data-demo-ref': 'header' }, () => [
              VueAny.h('span', null, 'TypeScript · server.ts'),
              VueAny.h(
                Button,
                {
                  'data-demo-ref': 'copy',
                  onClick: () => {
                    actionCalls += 1;
                  },
                },
                () => 'Copy'
              ),
            ]),
            VueAny.h(Content, { 'data-demo-ref': 'content' }, () => code.value),
          ]);
      },
    });

    try {
      app.mount(host);
      await flushVue();
      await flushVue();

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

      code.value = UPDATED_CODE_SAMPLE;
      await flushVue();
      expect(content?.textContent).toBe(UPDATED_CODE_SAMPLE);
      expect(actionCalls).toBe(0);

      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue();
      expect(actionCalls).toBe(1);
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
