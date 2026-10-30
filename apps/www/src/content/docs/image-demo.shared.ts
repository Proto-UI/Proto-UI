import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

// Website demos stay behind the #420 consumer wall: the status-change payload
// is typed structurally here instead of importing a raw Proto UI package.
type ImageViewStatusChange = Readonly<{
  status: 'idle' | 'loading' | 'loaded' | 'error';
  previousStatus: 'idle' | 'loading' | 'loaded' | 'error';
  source: string;
}>;

const landscape = '/images/base-image/landscape.svg';
const portrait = '/images/base-image/portrait.svg';
const unavailable = 'data:image/png;base64,invalid';

function image(
  family: string,
  ref: string,
  props: Record<string, unknown>,
  height: string
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-image-root`,
    ref,
    props,
    surfaceStyle: {
      display: 'block',
      width: '100%',
      height,
      borderRadius: '8px',
    },
  };
}

function action(family: string, ref: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props: {},
    children: [label],
  };
}

const resourceProps = {
  source: '',
  a11yMode: 'informative',
  alternativeText: 'Selected illustration · 所选插图',
  fit: 'contain',
} as const;

/**
 * The family projections keep the host-owned Image View module: source, fit,
 * a11yMode/alternativeText, loadingStatus exposes and the loadingStatusChange
 * event. The demo uses only real checked-in assets plus a genuinely broken
 * data URI, and observes status through the governed callback/expose path.
 * bootstrap-2-3-2 additionally supplies its source-pinned appearance variants.
 */
export function createImageDemo(family: string): DemoSpec {
  const fitCells = (['contain', 'cover', 'fill'] as const).map((fit) => ({
    kind: 'box' as const,
    className: 'flex min-w-0 flex-col gap-2',
    children: [
      image(
        family,
        `fit-${fit}`,
        {
          source: landscape,
          a11yMode: 'informative',
          alternativeText: `Mountains and a sun (${fit}) · 山与太阳（${fit}）`,
          fit,
        },
        '112px'
      ),
      { kind: 'box' as const, className: 'text-center font-mono text-xs', children: [fit] },
    ],
  }));
  const appearanceCells =
    family === 'bootstrap-2-3-2'
      ? (['default', 'rounded', 'polaroid', 'circle'] as const).map((appearance) => ({
          kind: 'box' as const,
          className: 'flex min-w-0 flex-col gap-2',
          children: [
            image(
              family,
              `appearance-${appearance}`,
              {
                source: portrait,
                a11yMode: 'informative',
                alternativeText: `Portrait illustration (${appearance}) · 竖幅插图（${appearance}）`,
                fit: 'cover',
                appearance,
              },
              '112px'
            ),
            {
              kind: 'box' as const,
              className: 'text-center font-mono text-xs',
              children: [appearance],
            },
          ],
        }))
      : [];
  return {
    type: 'demo',
    setup({ refs, api }: DemoSetupContext) {
      const history: string[] = [];
      const renderStatus = () => {
        if (refs.status)
          refs.status.textContent = String(api.call('resource', 'loadingStatus.get') ?? 'idle');
      };
      const record = (event: ImageViewStatusChange) => {
        history.push(event.status);
        if (refs.transitions) refs.transitions.textContent = history.slice(-8).join(' → ');
        renderStatus();
      };
      const setSource = (source: string) =>
        api.setProps('resource', { ...resourceProps, source, onLoadingStatusChange: record });
      setSource('');
      const actions = {
        loadImage: () => setSource(`${landscape}?resource`),
        replaceImage: () => setSource(`${portrait}?resource`),
        failImage: () => setSource(unavailable),
        clearImage: () => setSource(''),
      };
      for (const [ref, activate] of Object.entries(actions)) {
        api.setProps(ref, { onClick: activate });
      }
      const frame = requestAnimationFrame(renderStatus);
      return () => {
        cancelAnimationFrame(frame);
      };
    },
    root: {
      kind: 'box',
      className: 'flex w-full min-w-0 max-w-full flex-col gap-4 p-4',
      children: [
        {
          kind: 'box',
          className: 'grid grid-cols-3 gap-3',
          children: fitCells,
        },
        ...(appearanceCells.length > 0
          ? [
              {
                kind: 'box' as const,
                className: 'grid grid-cols-4 gap-3',
                children: appearanceCells,
              },
            ]
          : []),
        {
          kind: 'box',
          className: 'flex items-center gap-3 text-sm text-muted-foreground',
          children: [
            {
              kind: 'box',
              className: 'w-12 shrink-0',
              children: [
                image(family, 'decorative', { source: portrait, a11yMode: 'decorative' }, '48px'),
              ],
            },
            'Decorative image · the text carries the meaning. · 装饰图像，含义由文本承载。',
          ],
        },
        image(family, 'resource', { ...resourceProps }, '160px'),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            action(family, 'loadImage', 'Load landscape · 加载横幅'),
            action(family, 'replaceImage', 'Replace source · 替换来源'),
            action(family, 'failImage', 'Broken source · 损坏来源'),
            action(family, 'clearImage', 'Clear source · 清除来源'),
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2 font-mono text-xs text-muted-foreground',
          children: ['loadingStatus:', { kind: 'box', ref: 'status', children: ['idle'] }],
        },
        {
          kind: 'box',
          ref: 'transitions',
          className: 'min-h-5 break-words font-mono text-xs text-muted-foreground',
          children: ['Choose a source to inspect its status transitions. · 选择来源查看状态转换。'],
        },
      ],
    },
  } satisfies DemoSpec;
}
