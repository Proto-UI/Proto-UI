import { shadcnCheckboxDemoChildren } from '../PrototypePreviewer/shadcn-checkbox-composition';
import {
  appendHomepageGalleryActivityBars,
  appendHomepageGalleryGlyph,
  appendHomepageGalleryMiniBars,
  appendHomepageGalleryQrMatrix,
  appendHomepageGallerySampleBars,
  homepageBarHeight,
  homepageGalleryIcon,
  renderHomepageGalleryAreaChart,
  type GalleryCardOptions,
  type HomepageGalleryIcon,
} from './homepage-gallery-icons';
import { createHomepageCompositionParts } from './homepage-composition-parts';
import { homepageTextProps, setHomepageText } from './homepage-text';
import { homepageButtonVariant, type HomepageButtonIntent } from './homepage-button-variants';
import type { DemoChild, DemoNode, DemoSetupContext } from '../PrototypePreviewer/demo-types';
import { resolveProjectionPart } from '../PrototypePreviewer/projection-families';
import type { SiteLibraryFamily } from '../site-library-family';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/ids';
import { surfacePrototypeId, panelSurfaceProps, panelSurfaceLayout } from '../surface-recipes';

export type {
  GalleryCardBody,
  GalleryCardDensity,
  GalleryCardEmphasis,
  GalleryCardOptions,
} from './homepage-gallery-icons';

function toggleProps(family: SiteLibraryFamily): Record<string, unknown> {
  if (family === 'shadcn' || family === 'brutalist') {
    return { defaultActive: false, variant: 'outline', size: 'sm' };
  }
  return { defaultActive: false, variant: 'default', size: 'small' };
}

export function createHomepageGalleryParts(
  family: SiteLibraryFamily,
  runtime: RuntimeId,
  locale: string,
  isActive: () => boolean,
  isCurrent: () => boolean
) {
  const zh = locale === 'zh-cn';
  const PREVIEW_SURFACE_ID = surfacePrototypeId(family);
  const ids = new Set<string>();
  const authoredProps = new Map<string, Record<string, unknown>>();
  const registeredIcons: Array<{ ref: string; name: HomepageGalleryIcon; size: number }> = [];
  const icon = (name: HomepageGalleryIcon, size = 16, ref?: string): DemoNode => {
    const slotRef = ref ?? `gallery-icon-${registeredIcons.length}-${name}`;
    registeredIcons.push({ ref: slotRef, name, size });
    return homepageGalleryIcon(name, slotRef);
  };
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
    ref?: string,
    associationKey?: string,
    surfaceStyle?: Record<string, string>
  ): DemoNode => {
    ids.add(id);
    if (ref) authoredProps.set(ref, { ...props });
    const defaultSurfaceStyle =
      id === PREVIEW_SURFACE_ID
        ? { ...panelSurfaceLayout, padding: '1.25rem' }
        : id === 'brutalist-tabs-list'
          ? {
              minWidth: '0',
              maxWidth: '100%',
              width: 'fit-content',
              height: 'auto',
              minHeight: '3rem',
              flexWrap: 'wrap',
            }
          : id === 'brutalist-tabs-trigger'
            ? {
                minWidth: '0',
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }
            : undefined;
    const mergedSurfaceStyle =
      defaultSurfaceStyle || surfaceStyle
        ? { ...(defaultSurfaceStyle ?? {}), ...(surfaceStyle ?? {}) }
        : undefined;
    return {
      kind: 'proto',
      prototypeId: id,
      ...(associationKey ? { associations: { controlLabel: associationKey } } : {}),
      props,
      children,
      ...(ref ? { ref } : {}),
      ...(mergedSurfaceStyle ? { surfaceStyle: mergedSurfaceStyle } : {}),
    };
  };
  const part = (kind: Parameters<typeof resolveProjectionPart>[1], name = 'root') =>
    resolveProjectionPart(family, kind, name).prototypeId;
  const button = (
    label: string,
    ref?: string,
    variant: HomepageButtonIntent = 'primary',
    disabled = false,
    options: { fullWidth?: boolean; children?: DemoChild[] } = {}
  ) =>
    p(
      part('button'),
      options.children ?? [label],
      {
        variant: homepageButtonVariant(family, variant),
        disabled,
        wrap: true,
      },
      ref,
      undefined,
      options.fullWidth ? { width: '100%' } : undefined
    );
  const pillBadge = (
    label: string,
    variant: 'solid' | 'secondary' | 'outline' | 'muted' = 'solid',
    ref?: string
  ): DemoNode =>
    p(
      PREVIEW_SURFACE_ID,
      [box('home-gallery__badge-text', [label], ref)],
      {
        variant,
        radius: 'full',
        border: variant === 'outline' ? 'all' : 'none',
        elevation: 'none',
      },
      undefined,
      undefined,
      {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'fit-content',
        padding: '0.1875rem 0.625rem',
      }
    );
  const toggle = (label: string, ref: string) =>
    p(part('toggle'), [label], toggleProps(family), ref);
  const checkbox = (label: string, ref: string, checked = false, description?: string) => {
    const control =
      family === 'shadcn'
        ? shadcnCheckboxDemoChildren(
            {
              associationKey: `choice:${ref}`,
              label: [label],
              controlProps: { defaultChecked: checked },
              controlRef: ref,
            },
            p
          )
        : [
            p(
              `${family}-checkbox-root`,
              [p(`${family}-checkbox-indicator`)],
              { defaultChecked: checked },
              ref,
              `choice:${ref}`
            ),
            p(
              `${family}-label-root`,
              [label],
              { naming: true, activation: true },
              undefined,
              `choice:${ref}`
            ),
          ];
    if (!description) return box('home-gallery__choice', control);
    const [boxControl, boxLabel] = control;
    return box('home-gallery__choice home-gallery__choice--detailed', [
      boxControl!,
      box('home-gallery__choice-copy', [
        boxLabel!,
        box('home-gallery__choice-desc', [description]),
      ]),
    ]);
  };
  const status = (value: string, ref: string) =>
    box('home-gallery__status', [value], ref, { role: 'status', 'aria-live': 'polite' });
  const sample = zh
    ? '用同一份原型，组合你的界面。'
    : 'Compose your interface from the same prototypes.';

  const wrapCardShell = (
    headerChildren: DemoChild[] | null,
    bodyChildren: DemoChild[],
    options: {
      size?: 'default' | 'sm';
      media?: DemoChild[];
      mediaClass?: string;
      footerMedia?: DemoChild[];
    } = {}
  ): DemoNode => {
    const { size = 'default', media, mediaClass = 'home-gallery__media', footerMedia } = options;
    if (family === 'shadcn') {
      const cardParts: DemoChild[] = [];
      if (headerChildren) cardParts.push(p('shadcn-card-header', headerChildren));
      if (media) cardParts.push(box(mediaClass, media));
      if (bodyChildren.length)
        cardParts.push(p('shadcn-card-content', [box('home-gallery__stack', bodyChildren)]));
      if (footerMedia) cardParts.push(box('home-gallery__media--bleed', footerMedia));
      return p(
        'shadcn-card-root',
        cardParts,
        size === 'sm' ? { styleProfile: 'luma', size: 'sm' } : { styleProfile: 'luma' },
        undefined,
        undefined,
        footerMedia ? { paddingBlockEnd: '0' } : undefined
      );
    }
    if (family === 'brutalist') {
      const cardParts: DemoChild[] = [];
      if (headerChildren) cardParts.push(p('brutalist-card-header', headerChildren));
      if (media) cardParts.push(box(mediaClass, media));
      if (bodyChildren.length)
        cardParts.push(p('brutalist-card-content', [box('home-gallery__stack', bodyChildren)]));
      if (footerMedia) cardParts.push(box('home-gallery__media--bleed', footerMedia));
      return p(
        'brutalist-card-root',
        cardParts,
        size === 'sm' ? { size: 'sm' } : {},
        undefined,
        undefined,
        footerMedia ? { paddingBlockEnd: '0' } : undefined
      );
    }
    const surfaceChildren: DemoChild[] = [];
    if (headerChildren) surfaceChildren.push(...headerChildren);
    if (media) surfaceChildren.push(box(mediaClass, media));
    if (bodyChildren.length) surfaceChildren.push(box('home-gallery__stack', bodyChildren));
    if (footerMedia) surfaceChildren.push(box('home-gallery__media--bleed', footerMedia));
    const bootstrapSurfaceStyle =
      size === 'sm' || footerMedia
        ? {
            ...panelSurfaceLayout,
            padding: size === 'sm' ? '0.875rem' : '1.25rem',
            ...(footerMedia ? { paddingBlockEnd: '0', overflow: 'hidden' } : {}),
          }
        : undefined;
    return p(
      PREVIEW_SURFACE_ID,
      [box('home-gallery__card-body', surfaceChildren)],
      { ...panelSurfaceProps('card') },
      undefined,
      undefined,
      bootstrapSurfaceStyle
    );
  };

  const card = (
    title: string,
    caption: string,
    children: DemoChild[],
    id: string,
    options: GalleryCardOptions = {},
    media?: DemoChild[]
  ): DemoNode => {
    const {
      density = 'regular',
      emphasis = 'standard',
      body = 'inset',
      headerAction,
      headless = false,
      icon: headingIcon,
    } = options;
    const titleBox = (): DemoNode => ({
      kind: 'box',
      className: 'home-gallery__title',
      attrs: { role: 'heading', 'aria-level': '2' },
      children: [title],
    });
    const titleNode = headingIcon
      ? box('home-gallery__title-row', [headingIcon, titleBox()])
      : titleBox();
    const headingBlock = caption
      ? box('home-gallery__card-heading', [titleNode, box('home-gallery__caption', [caption])])
      : box('home-gallery__card-heading', [titleNode]);
    const headerChildren = headless
      ? null
      : headerAction
        ? [box('home-gallery__header-split', [headingBlock, headerAction])]
        : [headingBlock];
    const surface = wrapCardShell(headerChildren, children, {
      media: body === 'edge-media' ? (media ?? children) : undefined,
      mediaClass: 'home-gallery__media',
    });
    const finalSurface =
      body === 'edge-media' && !media
        ? wrapCardShell(headerChildren, [], { media: children, mediaClass: 'home-gallery__media' })
        : surface;
    return box(
      `home-gallery__item home-gallery__item--${density} home-gallery__item--${emphasis}`,
      [finalSurface],
      undefined,
      {
        'data-gallery-demo': id,
        'data-gallery-density': density,
        'data-gallery-emphasis': emphasis,
        ...(body === 'edge-media' ? { 'data-gallery-body': body } : {}),
      }
    );
  };

  // Column 1 Top: Title-less high-density UI Elements showcase (shadcn Luma focal card)
  const controls = card(
    zh ? '按钮与选择' : 'Buttons & selection',
    '',
    [
      box('home-gallery__row', [
        button(zh ? '主要' : 'Button', 'gallery-primary', 'primary', false, {
          children: [zh ? '主要' : 'Button', icon('arrow-right', 14)],
        }),
        button(zh ? '次要' : 'Secondary', 'gallery-secondary', 'secondary'),
        button(zh ? '描边' : 'Outline', 'gallery-outline', 'outline'),
      ]),
      p(
        `${family}-input-root`,
        [],
        {
          defaultValue: '',
          placeholder: zh ? '组件名称' : 'Name',
          ariaLabel: zh ? '组件名称输入示例' : 'Component name example',
        },
        'gallery-input',
        undefined,
        { width: '100%', minWidth: '0' }
      ),
      p(
        part('textarea'),
        [],
        {
          defaultValue: '',
          rows: 3,
          placeholder: zh ? '写下交互说明…' : 'Message',
          ariaLabel: zh ? '交互说明输入示例' : 'Sample message input',
        },
        'gallery-message',
        undefined,
        { width: '100%', minWidth: '0' }
      ),
      box('home-gallery__control-bar', [
        box('home-gallery__row', [
          toggle(zh ? '粗体' : 'Bold', 'gallery-bold'),
          toggle(zh ? '斜体' : 'Italic', 'gallery-italic'),
        ]),
        box('home-gallery__row', [
          p(
            `${family}-radio-group-root`,
            [
              p(
                `${family}-radio-group-item`,
                [
                  p(`${family}-radio-group-indicator`),
                  box('sr-only', [zh ? '选项一' : 'Option one']),
                ],
                { value: 'a' }
              ),
              p(
                `${family}-radio-group-item`,
                [
                  p(`${family}-radio-group-indicator`),
                  box('sr-only', [zh ? '选项二' : 'Option two']),
                ],
                { value: 'b' }
              ),
            ],
            {
              defaultValue: 'a',
              a11yLabel: zh ? '快速单选示例' : 'Quick radio choice',
            },
            'gallery-radio-group',
            undefined,
            {
              display: 'inline-flex',
              flexDirection: 'row',
              width: 'auto',
              alignItems: 'center',
              gap: '0.5rem',
            }
          ),
          checkbox(zh ? '选中' : 'Select', 'gallery-checkbox', true),
        ]),
      ]),
      box('home-gallery__control-bar', [
        box('home-gallery__row', [
          button(zh ? '危险' : 'Delete', 'gallery-danger', 'danger'),
          button(zh ? '禁用' : 'Disabled', undefined, 'outline', true),
        ]),
        p(
          part('switch'),
          [p(part('switch', 'thumb')), box('sr-only', [zh ? '切换状态' : 'Toggle state'])],
          { defaultChecked: true },
          'gallery-switch'
        ),
      ]),
      status(zh ? '点击任意控件' : 'Try any control', 'gallery-controls-feedback'),
    ],
    'controls',
    { emphasis: 'accent', headless: true }
  );

  // Column 1 Middle: 2x2 interactive ToggleGroup mini-cards (unselectable + real hover & click)
  const shortcutGroups: ReadonlyArray<{
    id: string;
    title: string;
    defaultValue: readonly string[];
    items: ReadonlyArray<{ value: string; label: string; glyph: HomepageGalleryIcon }>;
  }> = [
    {
      id: 'prototypes',
      title: zh ? '核心原型' : 'Prototypes',
      defaultValue: ['buttons'],
      items: [
        { value: 'buttons', label: zh ? '按钮与开关' : 'Buttons', glyph: 'nav-blocks' },
        { value: 'cards', label: zh ? '卡片容器' : 'Cards', glyph: 'nav-layers' },
        { value: 'tabs', label: zh ? '标签与折叠' : 'Tabs', glyph: 'nav-grid' },
        { value: 'dialogs', label: zh ? '弹层对话' : 'Dialogs', glyph: 'nav-box' },
      ],
    },
    {
      id: 'modules',
      title: zh ? '语义模块' : 'Modules',
      defaultValue: [],
      items: [
        { value: 'focus', label: zh ? '焦点管理' : 'Focus', glyph: 'nav-workflow' },
        { value: 'overlay', label: zh ? '浮层定位' : 'Overlay', glyph: 'nav-compass' },
        { value: 'a11y', label: zh ? '无障碍语义' : 'A11y', glyph: 'nav-shield' },
        { value: 'state', label: zh ? '状态协议' : 'State', glyph: 'nav-activity' },
      ],
    },
    {
      id: 'adapters',
      title: zh ? '多端适配' : 'Adapters',
      defaultValue: [runtime],
      items: [
        { value: 'wc', label: 'Web', glyph: 'nav-globe' },
        { value: 'react', label: 'React', glyph: 'nav-code' },
        { value: 'vue', label: 'Vue 3', glyph: 'nav-cpu' },
        { value: 'vue2', label: 'Vue 2', glyph: 'nav-terminal' },
      ],
    },
    {
      id: 'styles',
      title: zh ? '设计投影' : 'Styles',
      defaultValue: [family],
      items: [
        { value: 'shadcn', label: 'Shadcn', glyph: 'nav-palette' },
        { value: 'brutalist', label: 'Brutalist', glyph: 'nav-sparkles' },
        { value: 'bootstrap-2-3-2', label: 'Bootstrap', glyph: 'nav-wrench' },
        { value: 'liquid-glass', label: 'Glass', glyph: 'nav-book' },
      ],
    },
  ];
  const toggleGroupProps = (
    title: string,
    defaultValue: readonly string[]
  ): Record<string, unknown> => {
    const base = {
      orientation: 'vertical',
      multiple: false,
      defaultValue,
      a11yLabel: title,
    };
    if (family === 'shadcn') {
      return { ...base, variant: 'default', size: 'sm', spacing: 1 };
    }
    if (family === 'brutalist') {
      return { ...base, variant: 'default', size: 'sm', spacing: 0 };
    }
    return { ...base, variant: 'default', size: 'small' };
  };
  const shortcuts = box(
    'home-gallery__item home-gallery__item--regular home-gallery__item--standard',
    [
      box(
        'home-gallery__shortcuts-grid',
        shortcutGroups.map((group) =>
          wrapCardShell(
            null,
            [
              box('home-gallery__shortcut-title', [group.title]),
              p(
                `${family}-toggle-group-root`,
                group.items.map((entry) =>
                  p(
                    `${family}-toggle-group-item`,
                    [
                      icon(entry.glyph, 14),
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'home-gallery__shortcut-text',
                        children: [entry.label],
                      },
                    ],
                    { value: entry.value },
                    `shortcut-${group.id}-${entry.value}`,
                    undefined,
                    {
                      width: '100%',
                      justifyContent: 'flex-start',
                      gap: '0.45rem',
                      paddingInline: '0.5rem',
                    }
                  )
                ),
                toggleGroupProps(group.title, group.defaultValue),
                `shortcut-group-${group.id}`,
                undefined,
                { width: '100%' }
              ),
            ],
            { size: 'sm' }
          )
        )
      ),
    ],
    undefined,
    {
      'data-gallery-demo': 'shortcuts',
      'data-gallery-density': 'regular',
      'data-gallery-emphasis': 'standard',
    }
  );

  // Column 4 Top: Centered high-contrast geometric protocol QR + HoverCard
  const hover = card(
    zh ? '悬浮资料' : 'Profile preview',
    '',
    [
      box('home-gallery__profile', [
        box('home-gallery__qr', [], 'gallery-qr-matrix', {
          role: 'img',
          'aria-label': zh ? 'Proto UI 协议矩阵示意图' : 'Proto UI geometric protocol matrix',
        }),
        box('home-gallery__profile-copy', [
          {
            kind: 'box',
            className: 'home-gallery__title',
            attrs: { role: 'heading', 'aria-level': '2' },
            children: [zh ? '同一份定义，跨框架投影' : 'One definition, every runtime'],
          },
          box('home-gallery__caption', [
            zh
              ? '悬停或聚焦下方标识，查看组件原型的多框架协议说明。'
              : 'Hover or focus below to inspect how one prototype projects across runtimes.',
          ]),
        ]),
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
              { side: 'bottom', align: 'center' },
              'gallery-hover-content'
            ),
          ],
          { openDelay: 150, closeDelay: 200 }
        ),
      ]),
    ],
    'hover',
    { density: 'compact', emphasis: 'quiet', headless: true }
  );

  // Column 4 Middle: Text Editor with Tabs + Toggles + Textarea
  const editor = card(
    zh ? '文本编辑' : 'Text editor',
    zh ? '写下来，再换个角度看。' : 'Write it down. See it take shape.',
    [
      p(
        part('tabs'),
        [
          p(
            part('tabs', 'list'),
            [
              p(part('tabs', 'trigger'), [zh ? '编辑' : 'Edit'], { value: 'edit' }),
              p(part('tabs', 'trigger'), [zh ? '预览' : 'Preview'], { value: 'preview' }),
            ],
            {},
            undefined,
            undefined,
            { width: 'fit-content', maxWidth: '100%', alignSelf: 'flex-start' }
          ),
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
      button(zh ? '重置文本' : 'Reset text', 'editor-reset', 'secondary', false, {
        fullWidth: true,
      }),
    ],
    'editor',
    { emphasis: 'standard' }
  );

  // Column 5 Top: Centered minimal Release / Dialog + Dropdown card
  const dialog = p(
    part('dialog'),
    [
      p(part('dialog', 'trigger'), [
        family === 'shadcn'
          ? button(zh ? '打开对话框' : 'Open dialog')
          : zh
            ? '打开对话框'
            : 'Open dialog',
      ]),
      p(part('dialog', 'mask'), [], {}, 'gallery-dialog-mask'),
      p(part('dialog', 'content'), [
        p(part('dialog', 'header'), [
          p(part('dialog', 'title'), [zh ? '确认这次选择？' : 'Confirm this choice?']),
          ...(family === 'bootstrap-2-3-2'
            ? []
            : [
                p(part('dialog', 'description'), [
                  zh ? '这是一个可操作的对话框示例。' : 'An interactive confirmation example.',
                ]),
              ]),
        ]),
        // Bootstrap has a distinct modal-body between its title bar and footer.
        ...(family === 'bootstrap-2-3-2'
          ? [
              p(part('dialog', 'description'), [
                zh ? '这是一个可操作的对话框示例。' : 'An interactive confirmation example.',
              ]),
            ]
          : []),
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
      p(
        part('dropdown-menu', 'trigger'),
        [zh ? '更多操作' : 'More actions'],
        family === 'shadcn' ? { indicator: true } : {}
      ),
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
  const releaseIconTile = p(
    PREVIEW_SURFACE_ID,
    [icon('release-plus', 18)],
    { variant: 'muted', radius: 'xl', border: 'none', elevation: 'none' },
    undefined,
    undefined,
    {
      width: '2.75rem',
      height: '2.75rem',
      padding: '0',
      display: 'grid',
      placeItems: 'center',
    }
  );
  const overlays = card(
    zh ? '对话与菜单' : 'Dialogs & menus',
    '',
    [
      box('home-gallery__release', [
        releaseIconTile,
        box('home-gallery__release-copy', [
          {
            kind: 'box',
            className: 'home-gallery__title',
            attrs: { role: 'heading', 'aria-level': '2' },
            children: [zh ? '对话与菜单' : 'Dialogs & menus'],
          },
          box('home-gallery__caption', [
            zh
              ? '一份交互协议驱动模态对话框与下拉菜单，跨框架保持一致体验。'
              : 'One interaction protocol powering modal dialogs and menus across frameworks.',
          ]),
        ]),
        box('home-gallery__release-actions', [dialog, menu]),
        status(zh ? '等待选择' : 'Ready for a choice', 'gallery-dialog-feedback'),
      ]),
    ],
    'overlays',
    { emphasis: 'standard', headless: true }
  );

  // Column 5 Middle: Compact KPI + Edge-to-Edge Area Sparkline card
  const sparkViews = [
    { metric: zh ? '4 套框架' : '4 Runtimes', badge: 'WC · React · Vue' },
    { metric: zh ? '4 套风格' : '4 Styles', badge: 'Shadcn · Brutalist' },
    { metric: zh ? '1 份协议' : '1 Protocol', badge: 'Base → Family' },
    { metric: zh ? '0 重复写' : '0 Rewrites', badge: '+100% Reuse' },
  ] as const;
  const sparkHeaderBlock = box('home-gallery__card-heading', [
    {
      kind: 'box',
      className: 'home-gallery__title',
      attrs: { role: 'heading', 'aria-level': '2' },
      children: [zh ? '多端覆盖' : 'Analytics'],
    },
  ]);
  const spark = box(
    'home-gallery__item home-gallery__item--compact home-gallery__item--quiet',
    [
      wrapCardShell(
        [
          box('home-gallery__header-split', [
            sparkHeaderBlock,
            button(zh ? '切换视角' : 'View', 'gallery-spark-toggle', 'secondary'),
          ]),
        ],
        [
          box('home-gallery__spark-kpi', [
            box('home-gallery__stat-value', [sparkViews[0].metric], 'gallery-spark-metric'),
            pillBadge(sparkViews[0].badge, 'solid', 'gallery-spark-badge'),
          ]),
        ],
        {
          footerMedia: [
            box('home-gallery__spark-chart', [], 'gallery-spark-chart', {
              role: 'img',
              'aria-label': zh ? '多端覆盖趋势示意面积图' : 'Sample monochrome area trend chart',
            }),
          ],
        }
      ),
    ],
    undefined,
    {
      'data-gallery-demo': 'spark',
      'data-gallery-density': 'compact',
      'data-gallery-emphasis': 'quiet',
      'data-gallery-body': 'edge-media',
    }
  );

  // Column 5 Bottom: Rich Notifications checklist with descriptions
  const choices = card(
    zh ? '通知选项' : 'Notifications',
    zh ? '选择希望在演示中开启的提醒类型。' : 'Choose which alerts you want to receive.',
    [
      checkbox(
        zh ? '产品更新' : 'Product updates',
        'choice-product',
        true,
        zh ? '版本发布、契约变更与迁移提示。' : 'Release notes, spec changes, and upgrades.'
      ),
      checkbox(
        zh ? '新组件' : 'New components',
        'choice-components',
        true,
        zh ? '新增原型与多套设计体系投影。' : 'New prototypes and design-system projections.'
      ),
      checkbox(
        zh ? '社区活动' : 'Community events',
        'choice-events',
        false,
        zh ? 'RFC 讨论、路线图与线上交流。' : 'RFC discussions, milestones, and meetups.'
      ),
      button(zh ? '应用选择' : 'Apply selection', 'choice-apply', 'primary', false, {
        fullWidth: true,
      }),
      status(zh ? '已选择 2 项' : '2 selected', 'choice-feedback'),
    ],
    'choices',
    { emphasis: 'quiet' }
  );

  // Column 1 Bottom: Release milestones with real Progress bars (balanced bottom horizon)
  const milestoneTile = (
    eyebrow: string,
    figure: string,
    value: number,
    leftCaption: string,
    rightCaption: string,
    ariaLabel: string
  ): DemoNode =>
    p(
      PREVIEW_SURFACE_ID,
      [
        box('home-gallery__eyebrow', [eyebrow]),
        box('home-gallery__submetric', [figure]),
        p(
          `${family}-progress-root`,
          [p(`${family}-progress-track`, [p(`${family}-progress-indicator`)])],
          { value, min: 0, max: 100, ariaLabel }
        ),
        box('home-gallery__meta-row', [
          box('home-gallery__caption', [leftCaption]),
          box('home-gallery__eyebrow', [rightCaption]),
        ]),
      ],
      { variant: 'muted', radius: 'lg', border: 'none', elevation: 'none' },
      undefined,
      undefined,
      { display: 'grid', gap: '0.5rem', padding: '0.875rem', width: '100%' }
    );
  const milestones = card(
    zh ? '演进里程碑' : 'Release milestones',
    zh ? '以下数量和百分比均为示例。' : 'The counts and percentages are examples.',
    [
      milestoneTile(
        zh ? '运行时适配' : 'RUNTIME ADAPTERS',
        zh ? '4 / 4 端' : '4 / 4 targets',
        84,
        zh ? '84% 已覆盖' : '84% covered',
        'WC · React · Vue',
        zh ? '运行时适配覆盖率示例' : 'Runtime adapter coverage example'
      ),
      milestoneTile(
        zh ? '设计体系投影' : 'DESIGN PROJECTIONS',
        zh ? '4 套风格' : '4 families',
        68,
        zh ? '68% 已就绪' : '68% ready',
        'Shadcn · Brutalist',
        zh ? '设计体系投影就绪度示例' : 'Design projection readiness example'
      ),
      milestoneTile(
        zh ? '语义规范目录' : 'SPEC CATALOG',
        zh ? '50+ 原型' : '50+ specs',
        92,
        zh ? '92% 已编目' : '92% cataloged',
        '0.3 RC',
        zh ? '语义规范编目覆盖率示例' : 'Spec catalog coverage example'
      ),
    ],
    'milestones',
    { density: 'compact', emphasis: 'quiet' }
  );

  // Column 2 Bottom: Adapter parity rows with compact 4-bar indicators
  const parityRows: ReadonlyArray<{ title: string; detail: string; ref: string }> = [
    {
      title: 'Web Components',
      detail: 'Custom Elements',
      ref: 'gallery-parity-bars-0',
    },
    {
      title: 'React 19',
      detail: 'Hooks & Props',
      ref: 'gallery-parity-bars-1',
    },
    {
      title: 'Vue 3',
      detail: 'Composition API',
      ref: 'gallery-parity-bars-2',
    },
    {
      title: 'Vue 2',
      detail: 'Legacy Bridge',
      ref: 'gallery-parity-bars-3',
    },
  ];
  const ecosystem = card(
    zh ? '适配层分布' : 'Adapter parity',
    zh ? '同一份语义原型在各宿主运行时的落地状态。' : 'Shared semantic prototypes across runtimes.',
    parityRows.map((row) =>
      p(
        PREVIEW_SURFACE_ID,
        [
          box('home-gallery__parity-row', [
            box('home-gallery__parity-copy', [
              box('home-gallery__stat-value', [row.title]),
              box('home-gallery__caption', [row.detail]),
            ]),
            box('home-gallery__mini-bars', [], row.ref, { 'aria-hidden': 'true' }),
          ]),
        ],
        { variant: 'muted', radius: 'lg', border: 'none', elevation: 'none' },
        undefined,
        undefined,
        { display: 'block', padding: '0.625rem 0.75rem', width: '100%' }
      )
    ),
    'ecosystem',
    { density: 'compact', emphasis: 'quiet' }
  );

  // Column 3 Bottom: Quick setup form snippet (balanced bottom horizon)
  const initialTarget = 'react / vue / web-components';
  const initialCommand = 'npx @proto.ui/cli@latest init';
  const protocol = card(
    zh ? '快速接入' : 'Quick setup',
    zh ? '预览目标框架和初始化命令。' : 'Preview the target runtime and CLI command.',
    [
      box('home-settings__field', [
        box('home-settings__label', [zh ? '目标框架' : 'Target runtime']),
        p(
          `${family}-input-root`,
          [],
          {
            defaultValue: initialTarget,
            ariaLabel: zh ? '目标框架示例' : 'Target runtime example',
          },
          'gallery-protocol-target',
          undefined,
          { width: '100%', minWidth: '0' }
        ),
      ]),
      box('home-settings__field', [
        box('home-settings__label', [zh ? '初始化命令' : 'CLI command']),
        p(
          `${family}-input-root`,
          [],
          {
            defaultValue: initialCommand,
            ariaLabel: zh ? '初始化命令示例' : 'CLI command example',
          },
          'gallery-protocol-cmd',
          undefined,
          { width: '100%', minWidth: '0' }
        ),
      ]),
      button(zh ? '预览生成清单' : 'Preview setup', 'gallery-protocol-preview', 'primary', false, {
        fullWidth: true,
      }),
      status(zh ? '命令仅作展示。' : 'Command preview only.', 'gallery-protocol-status'),
    ],
    'protocol',
    { density: 'compact', emphasis: 'quiet' }
  );

  // Column 5 Bottom: Component matrix histogram (balanced bottom horizon)
  const throughput = card(
    zh ? '原型矩阵' : 'Component matrix',
    zh ? '跨设计语言与交互协议的覆盖密度。' : 'Coverage across design languages and protocols.',
    [
      box(
        'home-gallery__activity-chart',
        [
          box('home-gallery__activity-bars', [], 'gallery-activity-bars', {
            'aria-hidden': 'true',
          }),
        ],
        undefined,
        {
          role: 'img',
          'aria-label': zh
            ? '八组示例柱形，展示不同组件类别的原型分布。'
            : 'Eight sample bars showing prototype distribution across categories.',
        }
      ),
      box(
        'home-gallery__chart-labels',
        ['WC', 'R19', 'V3', 'V2', 'SH', 'BR', 'BS', 'LG'].map((label) =>
          box('home-gallery__chart-label', [label])
        )
      ),
      p(part('separator')),
      box('home-gallery__stats', [
        box('home-gallery__stat', [
          box('home-gallery__eyebrow', [zh ? '交互原型' : 'Prototypes']),
          box('home-gallery__stat-value', ['50+']),
        ]),
        box('home-gallery__stat', [
          box('home-gallery__eyebrow', [zh ? '设计体系' : 'Families']),
          box('home-gallery__stat-value', ['4']),
        ]),
      ]),
      box('home-gallery__caption', [
        zh
          ? '跨设计体系共用同一套 Base 交互契约。'
          : 'Shared Base interaction contracts across families.',
      ]),
    ],
    'throughput',
    { density: 'compact', emphasis: 'quiet' }
  );

  // Column 4 Bottom: Architecture highlights (balances Col 4 into the shared bottom fade horizon)
  const highlightRows: ReadonlyArray<{
    glyph: HomepageGalleryIcon;
    title: string;
    desc: string;
  }> = [
    {
      glyph: 'controls',
      title: zh ? '无框架交互协议' : 'Portable protocols',
      desc: zh
        ? '一套状态机与无障碍语义跨宿主运行。'
        : 'One state and a11y model across every host.',
    },
    {
      glyph: 'preferences',
      title: zh ? '可替换设计投影' : 'Swappable projections',
      desc: zh
        ? '外观与交互解耦，按需切换设计体系。'
        : 'Swap design systems without rewriting logic.',
    },
  ];
  const highlights = card(
    zh ? '架构要点' : 'Architecture notes',
    zh
      ? '一次定义，投影到不同框架与设计语言。'
      : 'Defined once, projected across frameworks and styles.',
    highlightRows.map((row) =>
      p(
        PREVIEW_SURFACE_ID,
        [
          box('home-gallery__highlight-row', [
            icon(row.glyph, 16),
            box('home-gallery__parity-copy', [
              box('home-gallery__stat-value', [row.title]),
              box('home-gallery__caption', [row.desc]),
            ]),
          ]),
        ],
        { variant: 'muted', radius: 'lg', border: 'none', elevation: 'none' },
        undefined,
        undefined,
        { display: 'block', padding: '0.625rem 0.75rem', width: '100%' }
      )
    ),
    'highlights',
    { density: 'compact', emphasis: 'quiet' }
  );

  const composition = createHomepageCompositionParts(family, locale, {
    p,
    box,
    card,
    button,
    status,
  });

  return {
    ids,
    card,
    analytics: composition.analytics,
    columns(form: DemoNode, analyticsCard: DemoNode = composition.analytics): DemoNode[] {
      return [
        box('home-gallery__column', [controls, shortcuts, milestones]),
        box('home-gallery__column', [analyticsCard, composition.command, ecosystem]),
        box('home-gallery__column', [form, composition.progress, protocol]),
        box('home-gallery__column', [hover, editor, composition.help, highlights]),
        box('home-gallery__column', [overlays, spark, choices, throughput]),
      ];
    },
    setup(context: DemoSetupContext) {
      let target = initialTarget;
      let command = initialCommand;
      let alive = true,
        editorText = sample,
        copies = 0,
        sparkIndex = 0;
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
      // Website-owned sample series. The public Progress root stays the only
      // authored value owner; this observer never patches prototype geometry.
      const updateGalleryRhythm = (value: number) => {
        const chart = context.refs['gallery-rhythm-bars'];
        if (chart && Number.isFinite(value) && value >= 0 && value <= 100) {
          feedback('gallery-rhythm-value', `${value}%`);
          feedback('gallery-rhythm-remaining', `${100 - value}%`);
          feedback(
            'gallery-rhythm-next',
            value < 25
              ? zh
                ? '整理提纲'
                : 'Outline an idea'
              : value < 60
                ? zh
                  ? '制作原型'
                  : 'Build a prototype'
                : value < 100
                  ? zh
                    ? '复查细节'
                    : 'Review the details'
                  : zh
                    ? '计划完成'
                    : 'Plan complete'
          );

          const bars = chart.querySelectorAll<SVGRectElement>('rect[data-gallery-bar]');
          bars.forEach((bar, index) => {
            const height = homepageBarHeight(value, index);
            bar.setAttribute('y', String(166 - height));
            bar.setAttribute('height', String(height));
          });
        }
      };
      for (const entry of registeredIcons) {
        const slot = context.refs[entry.ref];
        if (slot) appendHomepageGalleryGlyph(slot, entry.name, entry.size);
      }
      const chartSlot = context.refs['gallery-rhythm-bars'];
      if (chartSlot) appendHomepageGallerySampleBars(chartSlot);
      const qrSlot = context.refs['gallery-qr-matrix'];
      if (qrSlot) appendHomepageGalleryQrMatrix(qrSlot);
      const sparkSlot = context.refs['gallery-spark-chart'];
      if (sparkSlot) renderHomepageGalleryAreaChart(sparkSlot, sparkIndex);
      for (let index = 0; index < parityRows.length; index++) {
        const slot = context.refs[parityRows[index]!.ref];
        if (slot) appendHomepageGalleryMiniBars(slot, index);
      }
      const activitySlot = context.refs['gallery-activity-bars'];
      if (activitySlot) appendHomepageGalleryActivityBars(activitySlot);
      composition.setup({ bind, write, feedback });
      // The chart observes the same public Progress value that Command, Slider
      // and Reset already share. No duplicated plan map or second write channel.
      const planRoot = context.refs['composition-progress'];
      const planDocument = planRoot?.ownerDocument;
      const planWindow = planDocument?.defaultView;
      if (planRoot && planWindow) {
        let last = -1;
        const readPlan = () => {
          const raw = Number(planRoot.getAttribute('aria-valuenow'));
          if (!Number.isFinite(raw) || raw === last) return;
          last = raw;
          updateGalleryRhythm(raw);
        };
        const observer = new planWindow.MutationObserver(readPlan);
        observer.observe(planRoot, {
          attributes: true,
          attributeFilter: ['aria-valuenow'],
        });
        cleanups.push(() => observer.disconnect());
        readPlan();
      }
      for (const [ref, label] of [
        ['gallery-primary', zh ? '主要按钮' : 'Primary button'],
        ['gallery-secondary', zh ? '次要按钮' : 'Secondary button'],
        ['gallery-outline', zh ? '描边按钮' : 'Outline button'],
        ['gallery-danger', zh ? '危险按钮示例' : 'Destructive button example'],
      ])
        bind(ref!, 'click', () =>
          feedback('gallery-controls-feedback', `${label}: ${zh ? '已触发' : 'Activated'}`)
        );
      for (const ref of ['gallery-bold', 'gallery-italic'])
        bind(ref, 'activeChange', ({ active }) =>
          feedback(
            'gallery-controls-feedback',
            `${ref.endsWith('bold') ? (zh ? '粗体' : 'Bold') : zh ? '斜体' : 'Italic'} ${active === true ? (zh ? '已开启' : 'On') : zh ? '已关闭' : 'Off'}`
          )
        );
      bind('gallery-radio-group', 'valueChange', ({ value }) => {
        if (typeof value === 'string')
          feedback(
            'gallery-controls-feedback',
            `${zh ? '单选' : 'Radio'}: ${value === 'a' ? (zh ? '选项一' : 'Option one') : zh ? '选项二' : 'Option two'}`
          );
      });
      for (const ref of ['gallery-checkbox', 'gallery-switch'])
        bind(ref, 'checkedChange', ({ checked }) =>
          feedback(
            'gallery-controls-feedback',
            checked === true ? (zh ? '已开启' : 'On') : zh ? '已关闭' : 'Off'
          )
        );
      bind('gallery-spark-toggle', 'click', () => {
        sparkIndex = (sparkIndex + 1) % sparkViews.length;
        const next = sparkViews[sparkIndex]!;
        feedback('gallery-spark-metric', next.metric);
        feedback('gallery-spark-badge', next.badge);
        if (sparkSlot) renderHomepageGalleryAreaChart(sparkSlot, sparkIndex);
      });
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
      bind('gallery-protocol-target', 'valueChange', ({ value }) => {
        if (typeof value === 'string') target = value;
      });
      bind('gallery-protocol-cmd', 'valueChange', ({ value }) => {
        if (typeof value === 'string') command = value;
      });
      bind('gallery-protocol-preview', 'click', () => {
        const required = zh ? '（必填）' : '(required)';
        const previewTarget = target.trim() ? target : required;
        const previewCommand = command.trim() ? command : required;
        feedback(
          'gallery-protocol-status',
          zh
            ? `目标框架：${previewTarget} · 初始化命令：${previewCommand}`
            : `Target runtime: ${previewTarget} · CLI command: ${previewCommand}`
        );
      });
      return () => {
        if (!alive) return;
        alive = false;
        pending.clear();
        for (const cleanup of cleanups) cleanup();
      };
    },
  };
}
