import type { ExposedStateHandle } from '@proto.ui/core';
import { bootstrap232ActionAppearance } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import type {
  DemoChild,
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

type Family = 'bootstrap-2-3-2' | 'liquid-glass';
type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function part(
  family: Family,
  component: string,
  name: string,
  ref: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = []
): ProtoNode {
  return { kind: 'proto', prototypeId: `${family}-${component}-${name}`, ref, props, children };
}

function portal(node: ProtoNode): ProtoNode {
  return { ...node, previewTheme: 'portal' };
}

function bindDialogCloseAppearance({ api }: DemoSetupContext): () => void {
  if (!api.subscribePublicInstances || !api.getPublicInstance)
    throw new Error('Dialog Close appearance requires public instance subscriptions');
  let live = true;
  let generation = 0;
  let releaseFacts = () => {};
  const releaseInstances = api.subscribePublicInstances(
    ['close', 'closeAppearance'],
    (instances) => {
      const currentGeneration = ++generation;
      releaseFacts();
      const close = instances.close;
      const surface = instances.closeAppearance;
      if (!live || currentGeneration !== generation || !close || !surface) return;
      let active = true;
      let disconnected = false;
      const subscriptions: Array<() => void> = [];
      const release = () => {
        active = false;
        for (const off of subscriptions.splice(0)) off();
      };
      releaseFacts = release;
      const current = () =>
        live &&
        active &&
        currentGeneration === generation &&
        api.getPublicInstance!('close') === close &&
        api.getPublicInstance!('closeAppearance') === surface;
      const exposes = close.getExposes();
      const facts = Object.fromEntries(
        (['disabled', 'hovered', 'pressed', 'focusVisible'] as const).map((key) => {
          const state = exposes?.[key] as ExposedStateHandle<boolean> | undefined;
          if (!state?.get || !state.subscribe)
            throw new Error(`Dialog Close public ${key} state is unavailable`);
          return [key, state];
        })
      ) as Record<'disabled' | 'hovered' | 'pressed' | 'focusVisible', ExposedStateHandle<boolean>>;
      let previous = '';
      let scheduled = false;
      const paint = () => {
        if (!current()) return;
        const disabled = facts.disabled.get();
        const hovered = !disabled && facts.hovered.get();
        const pressed = !disabled && facts.pressed.get();
        const focusVisible = !disabled && facts.focusVisible.get();
        const next = `${hovered}/${pressed}/${focusVisible}`;
        if (!current() || next === previous) return;
        previous = next;
        api.setProps('closeAppearance', { hovered, pressed, focusVisible });
      };
      const requestPaint = () => {
        if (!current() || scheduled) return;
        scheduled = true;
        // Public facts may arrive inside a framework commit. Project their
        // latest snapshot after that commit, without another input/state owner.
        queueMicrotask(() => {
          scheduled = false;
          paint();
        });
      };
      for (const state of Object.values(facts)) {
        const off = state.subscribe((event) => {
          if (event.type === 'disconnect') {
            // Terminal disposal already owns subscription cleanup.
            disconnected = true;
            active = false;
            subscriptions.length = 0;
          } else requestPaint();
        });
        if (current()) subscriptions.push(off);
        else if (!disconnected) off();
      }
      requestPaint();
    }
  );
  return () => {
    live = false;
    generation++;
    releaseInstances();
    releaseFacts();
  };
}

export function createFamilyDialogDemo(family: Family): DemoSpec {
  const title = part(family, 'dialog', 'title', 'title', {}, ['Project details']);
  const description = part(family, 'dialog', 'description', 'description', {}, [
    'This modal contains project information. Close it, press Escape, or use the mask, then reopen to exercise the same dialog owner.',
  ]);
  const closeLabel = 'Close project details';
  const closeAppearance = bootstrap232ActionAppearance({ emphasis: 'secondary' });
  const contents: DemoNode[] =
    family === 'bootstrap-2-3-2'
      ? [
          part(family, 'dialog', 'header', 'header', {}, [title]),
          description,
          part(family, 'dialog', 'footer', 'footer', {}, [
            {
              ...part(family, 'dialog', 'close', 'close', {}, [
                {
                  ...part(
                    family,
                    'surface',
                    'root',
                    'closeAppearance',
                    { ...closeAppearance.surface },
                    [
                      part(family, 'text', 'root', 'closeLabel', { ...closeAppearance.text }, [
                        closeLabel,
                      ]),
                    ]
                  ),
                  // Close owns input and focus. These children provide only the
                  // existing family Button shell, typography and slot geometry.
                  surfaceStyle: { ...closeAppearance.layout, pointerEvents: 'none' },
                },
              ]),
              surfaceStyle: { display: 'inline-flex' },
            },
          ]),
          part(family, 'dialog', 'close-icon', 'closeIcon'),
        ]
      : [title, description, part(family, 'dialog', 'close', 'close', {}, [closeLabel])];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex min-w-0 items-start p-4',
      children: [
        part(family, 'dialog', 'root', 'root', { a11yLabel: 'Project details' }, [
          part(family, 'dialog', 'trigger', 'trigger', {}, ['Open project details']),
          portal(part(family, 'dialog', 'mask', 'mask')),
          portal(part(family, 'dialog', 'content', 'content', {}, contents)),
        ]),
      ],
    },
    ...(family === 'bootstrap-2-3-2' ? { setup: bindDialogCloseAppearance } : {}),
  };
}

export function createFamilyHoverCardDemo(family: Family): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex min-w-0 flex-col gap-4 p-8',
      children: [
        'Hover or focus the project name for a supplementary preview.',
        part(family, 'hover-card', 'root', 'root', { openDelay: 700, closeDelay: 300 }, [
          part(family, 'hover-card', 'trigger', 'trigger', {}, ['Proto UI project']),
          portal(
            part(family, 'hover-card', 'content', 'content', { side: 'bottom', align: 'start' }, [
              'Proto UI builds host-neutral interaction protocols. This preview supplements the project name; it is not a task or a click-to-open control.',
            ])
          ),
        ]),
      ],
    },
  };
}

export function createFamilyTooltipDemo(family: Family): DemoSpec {
  const tooltip = (ref: string, label: string, description: string): DemoNode =>
    part(family, 'tooltip', 'root', ref, {}, [
      part(family, 'tooltip', 'trigger', `${ref}Trigger`, {}, [label]),
      portal(
        part(family, 'tooltip', 'content', `${ref}Content`, { side: 'top', align: 'center' }, [
          description,
        ])
      ),
    ]);

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex min-w-0 flex-col gap-4 p-8',
      children: [
        'Hover the first trigger for 700ms, move to its sibling during the warm window, or use keyboard focus for immediate supplementary text.',
        // Group provides the delay domain; each child Root owns its own Tooltip anatomy.
        part(
          family,
          'tooltip',
          'group',
          'group',
          { openDelay: 700, closeDelay: 100, skipDelay: 300 },
          [
            {
              kind: 'box',
              className: 'flex flex-wrap items-center gap-8',
              children: [
                tooltip('account', 'Account information', 'Your profile and account preferences.'),
                tooltip(
                  'notifications',
                  'Notification information',
                  'Recent updates and notification preferences.'
                ),
              ],
            },
          ]
        ),
      ],
    },
  };
}

export function createFamilyRadioGroupDemo(family: Family): DemoSpec {
  const option = (groupRef: string, value: string, label: string, disabled = false): DemoNode => {
    const ref = `${groupRef}-${value}`;
    const association = { controlLabel: `${family}-${ref}` };
    return {
      kind: 'box',
      className: 'flex min-w-0 items-center gap-3',
      children: [
        {
          ...part(family, 'radio-group', 'item', ref, { value, disabled }, [
            part(family, 'radio-group', 'indicator', `${ref}-indicator`),
          ]),
          associations: association,
        },
        {
          ...part(family, 'label', 'root', `${ref}-label`, { naming: true, activation: true }, [
            label,
          ]),
          associations: association,
        },
      ],
    };
  };
  const group = (ref: string, title: string, props: Record<string, unknown>): DemoNode => ({
    kind: 'box',
    className: 'flex min-w-0 flex-col gap-3',
    children: [
      { kind: 'box', children: [title] },
      part(family, 'radio-group', 'root', ref, { a11yLabel: title, ...props }, [
        option(ref, 'comfortable', 'Comfortable'),
        option(ref, 'compact', 'Compact'),
        option(ref, 'unavailable', 'Unavailable', true),
      ]),
    ],
  });

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-6 p-4',
      children: [
        'Use the choices, their associated labels, Space, arrows, Home, or End. Selection and roving focus remain with each group.',
        group('root', 'Density preference', { defaultValue: 'comfortable' }),
        group('disabledGroup', 'Disabled density preference', {
          defaultValue: 'comfortable',
          disabled: true,
        }),
        group('controlledGroup', 'Controlled density: owner keeps Comfortable selected', {
          value: 'comfortable',
        }),
      ],
    },
  };
}

export function createFamilyScrollAreaDemo(family: Family): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex w-full max-w-80 min-w-0 flex-col gap-4 p-4',
      children: [
        'Release activity extends beyond this viewport in both directions.',
        {
          ...part(family, 'scroll-area', 'root', 'root', {}, [
            part(family, 'scroll-area', 'viewport', 'scrollViewport', {}, [
              {
                kind: 'box',
                ref: 'scrollContent',
                className: 'flex w-[520px] flex-col gap-3 p-4',
                children: [
                  'Release activity',
                  ...Array.from({ length: 14 }, (_, index) => ({
                    kind: 'box' as const,
                    children: [`Activity ${index + 1}: the viewport owns this scroll surface.`],
                  })),
                ],
              },
            ]),
            part(
              family,
              'scroll-area',
              'scrollbar',
              'verticalScrollbar',
              { orientation: 'vertical' },
              [part(family, 'scroll-area', 'thumb', 'verticalThumb')]
            ),
            part(
              family,
              'scroll-area',
              'scrollbar',
              'horizontalScrollbar',
              { orientation: 'horizontal' },
              [part(family, 'scroll-area', 'thumb', 'horizontalThumb')]
            ),
          ]),
          // Application allocation only. Viewport, chrome geometry and input remain Base/host-owned.
          className: 'h-48 w-full',
        },
      ],
    },
  };
}
