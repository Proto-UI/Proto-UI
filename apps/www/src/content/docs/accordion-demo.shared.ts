import type { DemoNode, DemoSpec, DemoChild } from '@/components/PrototypePreviewer/demo-types';
type Request = { openItems: string[]; value: string; open: boolean; reason: string };
export function createAccordionDemo(family: string): DemoSpec {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown>,
    children: DemoChild[]
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-accordion-${role}`,
    ref,
    props,
    // The Base demo owns panel layout. Make its open panels block-formatted
    // without overriding the Prototype's retained hidden state.
    ...(family === 'base'
      ? {
          className:
            role === 'trigger'
              ? 'block w-full rounded border p-3 text-left whitespace-normal'
              : role === 'content'
                ? 'data-[open]:block p-3'
                : 'block min-w-0',
        }
      : {}),
    children,
  });
  const item = (
    scope: string,
    value: string,
    label: string,
    props: Record<string, unknown> = {},
    retained = false,
    children: DemoChild[] = ['Authored content remains selectable. 作者内容保持可选择。']
  ): DemoNode =>
    atom('item', `${scope}-${value}-item`, { value, ...props }, [
      atom('heading', `${scope}-${value}-heading`, { level: 3 }, [
        atom('trigger', `${scope}-${value}-trigger`, {}, [label]),
      ]),
      atom(
        'content',
        `${scope}-${value}-content`,
        { keepMounted: retained, region: true },
        children
      ),
    ]);
  const group = (ref: string, props: Record<string, unknown>, children: DemoNode[]): DemoNode =>
    atom('root', ref, props, children);
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-6 p-2',
      children: [
        group('single', { defaultOpenItems: ['overview'] }, [
          item('single', 'overview', 'Overview · 概览', {}, false, [
            'Open another heading to switch sections. 展开其他标题会切换章节。',
            group('nested', {}, [
              item('nested', 'overview', 'Nested overview · 嵌套概览'),
              item('nested', 'details', 'Nested details · 嵌套详情'),
            ]),
          ]),
          item('single', 'lifetime', 'Content lifetime · 内容生命周期', {}, false, [
            'Default L1 detach keeps the logical instance; host children are not promised retention. 默认 L1 不承诺宿主子节点保留。',
          ]),
          item('single', 'disabled', 'Disabled section · 禁用章节', { disabled: true }),
          item(
            'single',
            'long',
            'A deliberately long heading remains readable at narrow widths and larger text sizes · 很长的标题在窄屏和放大字号下仍应完整可读',
            {},
            false,
            [
              {
                kind: 'box',
                className: 'min-w-0',
                children: [
                  'UnbrokenContentBoundary_0123456789012345678901234567890123456789012345678901234567890123456789',
                ],
              },
            ]
          ),
        ]),
        { kind: 'box', children: ['Multiple, one stays open · 多开，至少一项保持展开'] },
        group('multiple', { mode: 'multiple', allowEmpty: false, defaultOpenItems: ['a'] }, [
          item('multiple', 'a', 'Retained A · 保留 A', {}, true),
          item('multiple', 'b', 'Retained B · 保留 B', {}, true),
        ]),
        { kind: 'box', children: ['Horizontal RTL header navigation · 横向 RTL 标题导航'] },
        group('rtl', { orientation: 'horizontal', direction: 'rtl', loop: false }, [
          item('rtl', 'a', 'RTL A'),
          item('rtl', 'b', 'RTL B'),
        ]),
        group('controlled', { openItems: [] }, [
          item('controlled', 'a', 'Controlled: request, then accept · 受控：先请求，再接受'),
        ]),
        {
          kind: 'box',
          ref: 'requestStatus',
          attrs: { 'aria-live': 'polite' },
          children: ['No pending request · 暂无请求'],
        },
        {
          kind: 'proto',
          prototypeId: `${family}-button`,
          ref: 'accept',
          className: 'rounded border px-3 py-2',
          children: ['Accept pending request · 接受请求'],
        },
      ],
    },
    setup({ refs, api }) {
      let pending: Request | null = null;
      let openItems: string[] = [];
      const propose = (request: Request) => {
        pending = request;
        refs.requestStatus.textContent = `Requested / 请求: ${request.openItems.join(', ') || 'empty / 全关'} (${request.reason})`;
      };
      const sync = () => api.setProps('controlled', { openItems, onOpenChange: propose });
      const accept = () => {
        if (!pending) return;
        openItems = [...pending.openItems];
        pending = null;
        sync();
        refs.requestStatus.textContent = `Accepted / 已接受: ${openItems.join(', ') || 'empty / 全关'}`;
      };
      sync();
      api.setProps('accept', { onClick: accept });
      const requestListener = (event: Event) => {
        if (event instanceof CustomEvent && event.target === refs.controlled)
          propose(event.detail as Request);
      };
      const acceptListener = (event: Event) => {
        if (event instanceof CustomEvent) accept();
      };
      refs.controlled.addEventListener('openChange', requestListener);
      refs.accept.addEventListener('click', acceptListener);
      return () => {
        refs.controlled.removeEventListener('openChange', requestListener);
        refs.accept.removeEventListener('click', acceptListener);
      };
    },
  };
}
