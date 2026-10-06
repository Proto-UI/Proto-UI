import { homepageTextProps, setHomepageText } from './homepage-text';
import type { DemoChild, DemoNode, DemoSetupContext } from '../PrototypePreviewer/demo-types';
import {
  resolveProjectionPart,
  type ProjectionFamilyId,
} from '../PrototypePreviewer/projection-families';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/ids';
import { surfacePrototypeId, panelSurfaceProps, panelSurfaceLayout } from '../surface-recipes';

/** Consumer geometry only: retain family paint and the public default height,
 * while allowing enlarged text to make a command taller than that minimum. */
export const homepageCommandLayout = (family: ProjectionFamilyId) => ({
  minWidth: '0',
  maxWidth: '100%',
  height: 'auto',
  minHeight: family === 'brutalist' ? '2.5rem' : '2rem',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});

export function createHomepageGalleryParts(
  family: ProjectionFamilyId,
  runtime: RuntimeId,
  locale: string,
  isActive: () => boolean,
  isCurrent: () => boolean
) {
  const zh = locale === 'zh-cn';
  const PREVIEW_SURFACE_ID = surfacePrototypeId(family);
  const ids = new Set<string>([PREVIEW_SURFACE_ID]);
  const authoredProps = new Map<string, Record<string, unknown>>();
  const box = (
    className: string,
    children: DemoChild[],
    ref?: string,
    attrs?: Record<string, string>
  ): DemoNode => ({
    kind: 'box',
    className,
    children,
    ...(ref ? { ref } : {}),
    ...(attrs ? { attrs } : {}),
  });
  const p = (
    id: string,
    children: DemoChild[] = [],
    props: Record<string, unknown> = {},
    ref?: string
  ): DemoNode => {
    ids.add(id);
    if (ref) authoredProps.set(ref, { ...props });
    return {
      kind: 'proto',
      prototypeId: id,
      props,
      children,
      ...(ref ? { ref } : {}),
      ...(id === PREVIEW_SURFACE_ID
        ? { surfaceStyle: { ...panelSurfaceLayout, padding: '1.25rem' } }
        : {}),
      ...(/-(?:button|dialog-trigger|dropdown-menu-trigger)$/.test(id)
        ? { surfaceStyle: homepageCommandLayout(family) }
        : {}),
      ...(id === 'brutalist-tabs-list'
        ? {
            surfaceStyle: {
              minWidth: '0',
              maxWidth: '100%',
              width: '100%',
              height: 'auto',
              minHeight: '3rem',
              flexWrap: 'wrap',
            },
          }
        : {}),
      ...(id === 'brutalist-tabs-trigger'
        ? {
            surfaceStyle: {
              minWidth: '0',
              maxWidth: '100%',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            },
          }
        : {}),
    };
  };
  const part = (kind: Parameters<typeof resolveProjectionPart>[1], name = 'root') =>
    resolveProjectionPart(family, kind, name).prototypeId;
  const button = (label: string, ref?: string, variant = 'primary', disabled = false) =>
    p(
      part('button'),
      [label],
      {
        variant:
          family === 'brutalist'
            ? variant === 'primary'
              ? 'solid'
              : variant === 'danger'
                ? 'destructive'
                : 'surface'
            : variant === 'primary'
              ? 'default'
              : variant === 'danger'
                ? 'destructive'
                : 'outline',
        disabled,
      },
      ref
    );
  const toggle = (label: string, ref: string) =>
    p(part('toggle'), [label], { defaultActive: false }, ref);
  const checkbox = (label: string, ref: string, checked = false) =>
    box('home-gallery__choice', [
      p(
        `${family}-checkbox-root`,
        [p(`${family}-checkbox-indicator`), box('sr-only', [label])],
        { defaultChecked: checked },
        ref
      ),
      box('home-gallery__choice-label', [label]),
    ]);
  const status = (value: string, ref: string) =>
    box('home-gallery__status', [value], ref, { role: 'status', 'aria-live': 'polite' });
  const sample = zh
    ? '用同一份原型，组合你的界面。'
    : 'Compose your interface from the same prototypes.';
  const card = (title: string, caption: string, children: DemoChild[], id: string): DemoNode =>
    box(
      'home-gallery__item',
      [
        p(
          PREVIEW_SURFACE_ID,
          [
            box('home-gallery__card-body', [
              box('home-gallery__card-heading', [
                box('home-gallery__title', [title], undefined, {
                  role: 'heading',
                  'aria-level': '2',
                }),
                box('home-gallery__caption', [caption]),
              ]),
              ...children,
            ]),
          ],
          { ...panelSurfaceProps(family === 'brutalist' && id === 'editor' ? 'canvas' : 'card') }
        ),
      ],
      undefined,
      { 'data-gallery-demo': id }
    );
  const controls = card(
    zh ? '按钮与选择' : 'Buttons & selection',
    'Button · Toggle · Checkbox · Switch',
    [
      box('home-gallery__row', [
        button(zh ? '主要' : 'Primary', 'gallery-primary'),
        button(zh ? '次要' : 'Outline', 'gallery-secondary', 'secondary'),
        button(zh ? '危险' : 'Delete', 'gallery-danger', 'danger'),
      ]),
      p(part('separator')),
      box('home-gallery__row', [
        toggle(zh ? '粗体' : 'Bold', 'gallery-bold'),
        toggle(zh ? '斜体' : 'Italic', 'gallery-italic'),
        button(zh ? '禁用' : 'Disabled', undefined, 'secondary', true),
      ]),
      box('home-gallery__row', [
        checkbox(zh ? '选中' : 'Select', 'gallery-checkbox', true),
        p(
          part('switch'),
          [p(part('switch', 'thumb')), box('sr-only', [zh ? '切换状态' : 'Toggle state'])],
          { defaultChecked: true },
          'gallery-switch'
        ),
      ]),
      status(zh ? '点击任意控件' : 'Try any control', 'gallery-controls-feedback'),
    ],
    'controls'
  );
  const editor = card(
    zh ? '文本编辑' : 'Text editor',
    'Tabs · Textarea · Toggle',
    [
      p(
        part('tabs'),
        [
          p(part('tabs', 'list'), [
            p(part('tabs', 'trigger'), [zh ? '编辑' : 'Edit'], { value: 'edit' }),
            p(part('tabs', 'trigger'), [zh ? '预览' : 'Preview'], { value: 'preview' }),
          ]),
          p(
            part('tabs', 'content'),
            [
              box('home-gallery__stack', [
                box('home-gallery__row', [
                  toggle(zh ? '粗体' : 'Bold', 'editor-bold'),
                  toggle(zh ? '斜体' : 'Italic', 'editor-italic'),
                ]),
                p(
                  part('textarea'),
                  [],
                  {
                    value: sample,
                    rows: 4,
                    ariaLabel: zh ? '编辑示例文本' : 'Edit example text',
                  },
                  'editor-text'
                ),
              ]),
            ],
            { value: 'edit', keepMounted: true }
          ),
          p(
            part('tabs', 'content'),
            [box('home-gallery__text-preview', [sample], 'editor-preview')],
            { value: 'preview', keepMounted: true }
          ),
        ],
        { defaultValue: 'edit' },
        'editor-tabs'
      ),
      box('home-gallery__row', [
        button(zh ? '重置文本' : 'Reset text', 'editor-reset', 'secondary'),
      ]),
    ],
    'editor'
  );
  const dialog = p(
    part('dialog'),
    [
      p(part('dialog', 'trigger'), [
        family === 'brutalist'
          ? zh
            ? '打开对话框'
            : 'Open dialog'
          : button(zh ? '打开对话框' : 'Open dialog'),
      ]),
      p(part('dialog', 'mask'), [], {}, 'gallery-dialog-mask'),
      p(part('dialog', 'content'), [
        p(part('dialog', 'header'), [
          p(part('dialog', 'title'), [zh ? '确认这次选择？' : 'Confirm this choice?']),
          p(part('dialog', 'description'), [
            zh ? '这是一个可操作的对话框示例。' : 'An interactive confirmation example.',
          ]),
        ]),
        p(part('dialog', 'footer'), [
          p(part('dialog', 'close'), [button(zh ? '取消' : 'Cancel', undefined, 'secondary')]),
          p(part('dialog', 'close'), [button(zh ? '确认' : 'Confirm', 'gallery-confirm')]),
        ]),
        p(part('dialog', 'closeIcon')),
      ]),
    ],
    {},
    'gallery-dialog'
  );
  const menu = p(
    part('dropdown-menu'),
    [
      p(part('dropdown-menu', 'trigger'), [zh ? '更多操作' : 'More actions']),
      p(
        part('dropdown-menu', 'content'),
        [
          p(
            part('dropdown-menu', 'item'),
            [zh ? '增加一份' : 'Add a copy'],
            { value: 'add', textValue: zh ? '增加一份' : 'Add a copy' },
            'gallery-menu-add'
          ),
          p(
            part('dropdown-menu', 'item'),
            [zh ? '清空计数' : 'Clear count'],
            { value: 'clear', textValue: zh ? '清空计数' : 'Clear count' },
            'gallery-menu-clear'
          ),
        ],
        { align: 'start' }
      ),
    ],
    {},
    'gallery-menu'
  );
  const overlays = card(
    zh ? '对话与菜单' : 'Dialogs & menus',
    'Dialog · DropdownMenu',
    [
      dialog,
      p(part('separator')),
      menu,
      status(zh ? '等待选择' : 'Ready for a choice', 'gallery-dialog-feedback'),
    ],
    'overlays'
  );
  const hover = card(
    zh ? '悬浮资料' : 'Profile preview',
    'HoverCard',
    [
      p(
        part('hover-card'),
        [
          p(part('hover-card', 'trigger'), ['@Proto UI'], {}, 'gallery-hover-trigger'),
          p(
            part('hover-card', 'content'),
            [
              box('home-gallery__stack', [
                box('home-gallery__title', ['Proto UI']),
                box('home-gallery__copy', [
                  zh
                    ? '组件原型 · 交互协议 · 多 Runtime'
                    : 'Component prototypes · interaction protocols · multiple runtimes',
                ]),
              ]),
            ],
            { side: 'bottom', align: 'start' },
            'gallery-hover-content'
          ),
        ],
        { openDelay: 150, closeDelay: 200 }
      ),
      box('home-gallery__copy', [zh ? '悬停或聚焦查看资料' : 'Hover or focus to reveal details']),
    ],
    'hover'
  );
  const choices = card(
    zh ? '通知选项' : 'Notification choices',
    'Checkbox · Button',
    [
      checkbox(zh ? '产品更新' : 'Product updates', 'choice-product', true),
      checkbox(zh ? '新组件' : 'New components', 'choice-components', true),
      checkbox(zh ? '社区活动' : 'Community events', 'choice-events'),
      button(zh ? '应用选择' : 'Apply selection', 'choice-apply'),
      status(zh ? '已选择 2 项' : '2 selected', 'choice-feedback'),
    ],
    'choices'
  );
  return {
    ids,
    card,
    columns(form: DemoNode): DemoNode[] {
      return [
        box('home-gallery__column', [controls, hover]),
        box('home-gallery__column', [form]),
        box('home-gallery__column', [editor]),
        box('home-gallery__column', [overlays, choices]),
      ];
    },
    setup(context: DemoSetupContext) {
      let alive = true,
        editorText = sample,
        copies = 0;
      const selected = new Set(['choice-product', 'choice-components']);
      const pending = new Map<string, Record<string, unknown>>();
      const currentProps = new Map([...authoredProps].map(([ref, props]) => [ref, { ...props }]));
      currentProps.set('editor-preview-text', {
        ...homepageTextProps('home-gallery__text-preview', family),
      });
      const completeProps = (ref: string, next: Record<string, unknown>) => {
        const complete = { ...currentProps.get(ref), ...next };
        currentProps.set(ref, complete);
        return complete;
      };
      let queued = false;
      const cleanups: Array<() => void> = [];
      const canAct = () => alive && isActive();
      const write = (ref: string, props: Record<string, unknown>) => {
        if (!alive || !isCurrent()) return;
        props = completeProps(ref, props);
        if (runtime === 'vue' || runtime === 'vue2') {
          context.api.setProps(ref, props);
          return;
        }
        pending.set(ref, { ...pending.get(ref), ...props });
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          const writes = [...pending];
          pending.clear();
          for (const [key, value] of writes)
            if (alive && isCurrent()) context.api.setProps(key, value);
        });
      };
      const bind = (
        ref: string,
        name: string,
        callback: (detail: Record<string, unknown>) => void
      ) => {
        const deliver = (detail: unknown) => {
          if (canAct())
            callback(
              detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : {}
            );
        };
        if (runtime === 'wc') {
          const node = context.refs[ref]!;
          const listener = (event: Event) => {
            if (event instanceof context.host.ownerDocument.defaultView!.CustomEvent)
              deliver(event.detail);
          };
          node.addEventListener(name, listener);
          cleanups.push(() => node.removeEventListener(name, listener));
        } else {
          const prop = `on${name[0]!.toUpperCase()}${name.slice(1)}`;
          context.api.setProps(ref, completeProps(ref, { [prop]: deliver }));
          // Framework callbacks are owned by the view. Revoking alive gates them;
          // writing props during cleanup would replay an uncommitted queued bag.
        }
      };
      const feedback = (ref: string, value: string) => {
        setHomepageText(context.refs[ref]!, value);
      };
      for (const [ref, label] of [
        ['gallery-primary', zh ? '主要按钮' : 'Primary button'],
        ['gallery-secondary', zh ? '次要按钮' : 'Secondary button'],
        ['gallery-danger', zh ? '危险按钮示例' : 'Destructive button example'],
      ])
        bind(ref!, 'click', () => feedback('gallery-controls-feedback', `${label} ✓`));
      for (const ref of ['gallery-bold', 'gallery-italic'])
        bind(ref, 'activeChange', ({ active }) =>
          feedback(
            'gallery-controls-feedback',
            `${ref.endsWith('bold') ? (zh ? '粗体' : 'Bold') : zh ? '斜体' : 'Italic'} ${active === true ? '✓' : '—'}`
          )
        );
      for (const ref of ['gallery-checkbox', 'gallery-switch'])
        bind(ref, 'checkedChange', ({ checked }) =>
          feedback(
            'gallery-controls-feedback',
            checked === true ? (zh ? '已开启' : 'On') : zh ? '已关闭' : 'Off'
          )
        );
      bind('editor-text', 'valueChange', ({ value }) => {
        if (typeof value !== 'string') return;
        editorText = value;
        write('editor-text', { value });
        feedback('editor-preview', value);
      });
      bind('editor-bold', 'activeChange', ({ active }) => {
        write('editor-preview-text', {
          weight: active === true ? 'bold' : family === 'brutalist' ? 'medium' : 'normal',
        });
      });
      bind('editor-italic', 'activeChange', ({ active }) => {
        write('editor-preview-text', { emphasis: active === true ? 'italic' : 'normal' });
      });
      bind('editor-reset', 'click', () => {
        editorText = sample;
        write('editor-text', { value: editorText });
        feedback('editor-preview', editorText);
      });
      bind('gallery-confirm', 'click', () =>
        feedback('gallery-dialog-feedback', zh ? '已确认' : 'Confirmed')
      );
      bind('gallery-menu-add', 'select', () => {
        copies++;
        feedback('gallery-dialog-feedback', `${zh ? '副本' : 'Copies'}: ${copies}`);
      });
      bind('gallery-menu-clear', 'select', () => {
        copies = 0;
        feedback('gallery-dialog-feedback', `${zh ? '副本' : 'Copies'}: 0`);
      });
      for (const ref of ['choice-product', 'choice-components', 'choice-events'])
        bind(ref, 'checkedChange', ({ checked }) => {
          if (checked === true) selected.add(ref);
          else selected.delete(ref);
          feedback(
            'choice-feedback',
            zh ? `已选择 ${selected.size} 项` : `${selected.size} selected`
          );
        });
      bind('choice-apply', 'click', () =>
        feedback(
          'choice-feedback',
          zh ? `已应用 ${selected.size} 项选择` : `Applied ${selected.size} selections`
        )
      );
      return () => {
        if (!alive) return;
        alive = false;
        pending.clear();
        for (const cleanup of cleanups) cleanup();
      };
    },
  };
}
