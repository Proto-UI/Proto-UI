import type { ImageViewStatusChange } from '@proto.ui/core';
import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';

const landscape = '/images/base-image/landscape.svg';
const portrait = '/images/base-image/portrait.svg';
const unavailable = 'data:image/png;base64,invalid';
const resourceProps = {
  source: '',
  a11yMode: 'informative',
  alternativeText: 'Selected illustration',
  fit: 'contain',
} as const;

function image(ref: string, props: Record<string, unknown>, height: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'base-image-root',
    ref,
    props,
    surfaceStyle: {
      display: 'block',
      width: '100%',
      height,
      backgroundColor: 'var(--color-muted)',
      borderRadius: '8px',
    },
  };
}

function action(ref: string, label: string): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'base-button',
    ref,
    props: {},
    className:
      'cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
    children: [label],
  };
}

export default {
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    const history: string[] = [];
    let frame = 0;
    const renderStatus = () => {
      refs.status.textContent = String(api.call('resource', 'loadingStatus.get') ?? 'idle');
    };
    const record = (event: ImageViewStatusChange) => {
      history.push(event.status);
      refs.transitions.textContent = history.slice(-8).join(' → ');
      renderStatus();
    };
    const setSource = (source: string) =>
      api.setProps('resource', { ...resourceProps, source, onLoadingStatusChange: record });
    setSource('');
    const onStatus = (event: Event) => {
      if (event instanceof CustomEvent) record(event.detail);
    };
    refs.resource.addEventListener('loadingStatusChange', onStatus);

    const actions = {
      loadImage: () => setSource(`${landscape}?resource`),
      replaceImage: () => setSource(`${portrait}?resource`),
      failImage: () => setSource(unavailable),
      clearImage: () => setSource(''),
    };
    const disposers = Object.entries(actions).map(([ref, activate]) => {
      api.setProps(ref, { onClick: activate });
      const onClick = (event: Event) => {
        if (event instanceof CustomEvent) activate();
      };
      refs[ref].addEventListener('click', onClick);
      return () => refs[ref].removeEventListener('click', onClick);
    });
    frame = requestAnimationFrame(renderStatus);
    return () => {
      cancelAnimationFrame(frame);
      refs.resource.removeEventListener('loadingStatusChange', onStatus);
      disposers.forEach((dispose) => dispose());
    };
  },
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-3 gap-3',
        children: (['contain', 'cover', 'fill'] as const).map((fit) => ({
          kind: 'box',
          className: 'flex min-w-0 flex-col gap-2',
          children: [
            image(
              `fit-${fit}`,
              {
                source: landscape,
                a11yMode: 'informative',
                alternativeText: `Mountains and a sun (${fit})`,
                fit,
              },
              '112px'
            ),
            { kind: 'box', className: 'text-center font-mono text-xs', children: [fit] },
          ],
        })),
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3 text-sm text-muted-foreground',
        children: [
          {
            kind: 'box',
            className: 'w-12 shrink-0',
            children: [image('decorative', { source: portrait, a11yMode: 'decorative' }, '48px')],
          },
          'Decorative image · the text carries the meaning.',
        ],
      },
      image('resource', resourceProps, '160px'),
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          action('loadImage', 'Load landscape'),
          action('replaceImage', 'Replace source'),
          action('failImage', 'Broken source'),
          action('clearImage', 'Clear source'),
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
        children: ['Choose a source to inspect its status transitions.'],
      },
    ],
  },
} satisfies DemoSpec;
