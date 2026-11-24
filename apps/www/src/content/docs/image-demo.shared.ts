import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

// Website demos stay behind the #420 consumer wall: the status-change payload
// is typed structurally here instead of importing a raw Proto UI package.
export type ImageViewStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type ImageViewStatusChange = Readonly<{
  status: ImageViewStatus;
  previousStatus: ImageViewStatus;
  source: string;
}>;

export const IMAGE_ASSETS = {
  landscape: '/images/base-image/landscape.svg',
  portrait: '/images/base-image/portrait.svg',
  unavailable: 'data:image/png;base64,invalid',
} as const;

export function imageNode(
  family: string,
  ref: string,
  props: Record<string, unknown>,
  surfaceStyle?: Record<string, string>
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-image-root`,
    ref,
    props,
    ...(surfaceStyle ? { surfaceStyle } : {}),
  };
}

export function actionButton(
  family: string,
  ref: string,
  label: string,
  props: Record<string, unknown> = {}
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props,
    children: [label],
  };
}

/**
 * Shared Fit Modes comparison grid (`contain`, `cover`, `fill`) without inline
 * border-radius overrides so each family's own framing shines through.
 */
export function createImageFitDemo(
  family: string,
  options: {
    imageProps?: Record<string, unknown>;
    frameClassName?: string;
    containerClassName?: string;
  } = {}
): DemoSpec {
  const frameClass =
    options.frameClassName ?? 'overflow-hidden rounded-xl border border-border bg-muted/60 p-1.5';
  const containerClass =
    options.containerClassName ?? 'grid w-full max-w-2xl grid-cols-1 gap-4 p-4 sm:grid-cols-3';

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: containerClass,
      children: (['contain', 'cover', 'fill'] as const).map((fit) => ({
        kind: 'box',
        className: 'flex min-w-0 flex-col gap-2',
        children: [
          {
            kind: 'box',
            className: frameClass,
            children: [
              imageNode(
                family,
                `fit-${fit}`,
                {
                  source: IMAGE_ASSETS.landscape,
                  a11yMode: 'informative',
                  alternativeText: `Mountain ridge illustration (${fit} fit)`,
                  fit,
                  ...options.imageProps,
                },
                { width: '100%', height: '120px' }
              ),
            ],
          },
          {
            kind: 'box',
            className: 'text-center font-mono text-xs text-muted-foreground',
            children: [`fit="${fit}"`],
          },
        ],
      })),
    },
  } satisfies DemoSpec;
}

/**
 * Shared Informative vs Decorative accessibility demo showing proper semantic
 * pairing for meaningful figures and decorative thumbnails.
 */
export function createImageA11yDemo(
  family: string,
  options: {
    informativeProps?: Record<string, unknown>;
    decorativeProps?: Record<string, unknown>;
    decorativeSize?: string;
    cardClassName?: string;
    containerClassName?: string;
  } = {}
): DemoSpec {
  const cardClass =
    options.cardClassName ?? 'rounded-xl border border-border bg-background p-4 shadow-xs';
  const containerClass = options.containerClassName ?? 'flex w-full max-w-xl flex-col gap-4 p-4';
  const decorativeSize = options.decorativeSize ?? '56px';

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: containerClass,
      children: [
        {
          kind: 'box',
          className: `${cardClass} flex flex-col gap-3`,
          children: [
            imageNode(
              family,
              'informative-photo',
              {
                source: IMAGE_ASSETS.landscape,
                a11yMode: 'informative',
                alternativeText: 'Sunlit mountain ridge overlooking a calm alpine valley',
                fit: 'cover',
                ...options.informativeProps,
              },
              { width: '100%', height: '160px' }
            ),
            {
              kind: 'box',
              className: 'flex flex-col gap-0.5',
              children: [
                {
                  kind: 'box',
                  className: 'text-sm font-medium text-foreground',
                  children: ['Informative figure'],
                },
                {
                  kind: 'box',
                  className: 'text-xs text-muted-foreground',
                  children: [
                    'Uses a11yMode="informative" with descriptive alternativeText for screen readers.',
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: `${cardClass} flex items-center gap-3.5`,
          children: [
            {
              kind: 'box',
              className: 'shrink-0',
              children: [
                imageNode(
                  family,
                  'decorative-thumb',
                  {
                    source: IMAGE_ASSETS.portrait,
                    a11yMode: 'decorative',
                    fit: 'cover',
                    ...options.decorativeProps,
                  },
                  { width: decorativeSize, height: decorativeSize }
                ),
              ],
            },
            {
              kind: 'box',
              className: 'flex min-w-0 flex-col gap-0.5',
              children: [
                {
                  kind: 'box',
                  className: 'text-sm font-medium text-foreground',
                  children: ['Alpine Field Notes'],
                },
                {
                  kind: 'box',
                  className: 'text-xs text-muted-foreground',
                  children: [
                    'Decorative accent (a11yMode="decorative") — surrounding text conveys the full meaning.',
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  } satisfies DemoSpec;
}

/**
 * Shared interactive Loading & Error Fallback demo: starts loaded, responds to
 * `loadingStatusChange`, and renders real placeholder / error-recovery UI.
 */
export function createImageLoadingDemo(
  family: string,
  options: {
    imageProps?: Record<string, unknown>;
    primaryButtonProps?: Record<string, unknown>;
    secondaryButtonProps?: Record<string, unknown>;
    destructiveButtonProps?: Record<string, unknown>;
    containerClassName?: string;
    stageClassName?: string;
    overlayClassName?: string;
  } = {}
): DemoSpec {
  const initialProps = {
    source: IMAGE_ASSETS.landscape,
    a11yMode: 'informative',
    alternativeText: 'Selected landscape scene',
    fit: 'cover',
    ...options.imageProps,
  };

  return {
    type: 'demo',
    setup({ refs, api }: DemoSetupContext) {
      const updateUi = (status: ImageViewStatus) => {
        if (refs.statusBadge) {
          const labels: Record<ImageViewStatus, string> = {
            loaded: 'Status: Loaded',
            loading: 'Status: Loading…',
            error: 'Status: Error',
            idle: 'Status: Idle',
          };
          refs.statusBadge.textContent = labels[status];
        }
        if (!refs.fallbackOverlay) return;
        if (status === 'loaded') {
          refs.fallbackOverlay.style.display = 'none';
          refs.fallbackOverlay.setAttribute('aria-hidden', 'true');
          return;
        }
        refs.fallbackOverlay.style.display = 'flex';
        refs.fallbackOverlay.setAttribute('aria-hidden', 'false');
        if (refs.fallbackTitle && refs.fallbackDetail) {
          if (status === 'loading') {
            refs.fallbackTitle.textContent = 'Loading image…';
            refs.fallbackDetail.textContent = 'Preparing the selected asset.';
          } else if (status === 'error') {
            refs.fallbackTitle.textContent = 'Unable to load image';
            refs.fallbackDetail.textContent =
              'The requested source could not be decoded. Retry or switch assets.';
          } else {
            refs.fallbackTitle.textContent = 'No image selected';
            refs.fallbackDetail.textContent = 'Choose a sample asset below to load the frame.';
          }
        }
        if (refs.retryWrap) {
          refs.retryWrap.style.display = status === 'error' ? 'flex' : 'none';
        }
      };

      const onStatusChange = (event: ImageViewStatusChange) => {
        updateUi(event.status);
      };

      const loadSource = (source: string, alternativeText: string) => {
        api.setProps('resource', {
          ...initialProps,
          source,
          alternativeText,
          onLoadingStatusChange: onStatusChange,
        });
      };

      // Subscribe on initial mounted resource without blanking the preview.
      loadSource(IMAGE_ASSETS.landscape, 'Selected landscape scene');

      api.setProps('loadLandscape', {
        ...(options.primaryButtonProps ?? {}),
        onClick: () => loadSource(`${IMAGE_ASSETS.landscape}?scene=1`, 'Mountain ridge landscape'),
      });
      api.setProps('loadPortrait', {
        ...(options.secondaryButtonProps ?? {}),
        onClick: () =>
          loadSource(`${IMAGE_ASSETS.portrait}?scene=2`, 'Vertical botanical portrait'),
      });
      api.setProps('loadBroken', {
        ...(options.destructiveButtonProps ?? options.secondaryButtonProps ?? {}),
        onClick: () => loadSource(IMAGE_ASSETS.unavailable, 'Unavailable photo source'),
      });
      api.setProps('clearSource', {
        ...(options.secondaryButtonProps ?? {}),
        onClick: () => loadSource('', 'Empty image frame'),
      });
      api.setProps('retryLoad', {
        ...(options.primaryButtonProps ?? {}),
        onClick: () => loadSource(`${IMAGE_ASSETS.landscape}?retry=1`, 'Recovered landscape scene'),
      });

      const frame = requestAnimationFrame(() => {
        const current = (api.call('resource', 'loadingStatus.get') ?? 'idle') as ImageViewStatus;
        updateUi(current);
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    },
    root: {
      kind: 'box',
      className: options.containerClassName ?? 'flex w-full max-w-lg flex-col gap-4 p-4',
      children: [
        {
          kind: 'box',
          className:
            options.stageClassName ??
            'relative overflow-hidden rounded-xl border border-border bg-muted',
          children: [
            imageNode(family, 'resource', initialProps, { width: '100%', height: '200px' }),
            {
              kind: 'box',
              ref: 'fallbackOverlay',
              attrs: { 'aria-hidden': 'true' },
              className:
                options.overlayClassName ??
                'hidden absolute inset-0 flex-col items-center justify-center gap-2 bg-muted/95 p-4 text-center',
              children: [
                {
                  kind: 'box',
                  ref: 'fallbackTitle',
                  className: 'text-sm font-medium text-foreground',
                  children: ['Loading image…'],
                },
                {
                  kind: 'box',
                  ref: 'fallbackDetail',
                  className: 'max-w-xs text-xs text-muted-foreground',
                  children: ['Preparing the selected asset.'],
                },
                {
                  kind: 'box',
                  ref: 'retryWrap',
                  className: 'hidden pt-1',
                  children: [
                    actionButton(family, 'retryLoad', 'Retry', options.primaryButtonProps ?? {}),
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-between gap-2',
          children: [
            {
              kind: 'box',
              className: 'flex flex-wrap gap-2',
              children: [
                actionButton(
                  family,
                  'loadLandscape',
                  'Landscape',
                  options.primaryButtonProps ?? {}
                ),
                actionButton(
                  family,
                  'loadPortrait',
                  'Portrait',
                  options.secondaryButtonProps ?? {}
                ),
                actionButton(
                  family,
                  'loadBroken',
                  'Broken URL',
                  options.destructiveButtonProps ?? options.secondaryButtonProps ?? {}
                ),
                actionButton(family, 'clearSource', 'Clear', options.secondaryButtonProps ?? {}),
              ],
            },
            {
              kind: 'box',
              ref: 'statusBadge',
              attrs: { role: 'status', 'aria-live': 'polite' },
              className:
                'rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground',
              children: ['Status: Loaded'],
            },
          ],
        },
      ],
    },
  } satisfies DemoSpec;
}

/** Backwards-compatible entry point returning the clean interactive hero demo. */
export function createImageDemo(family: string): DemoSpec {
  return createImageLoadingDemo(family);
}
