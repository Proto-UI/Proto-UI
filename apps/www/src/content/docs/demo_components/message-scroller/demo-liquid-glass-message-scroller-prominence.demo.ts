import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const NOTES = [
  '1. Regular prominence uses secondary surface fill paired with high-contrast foreground ink.',
  '2. Prominent styling uses primary accent fill and white foreground for unread emphasis.',
  '3. Disabled controls withdraw elevation without applying opacity-50 washout.',
  '4. Root (rounded-2xl + p-1) nests concentric Viewport (rounded-xl) cleanly.',
  '5. Root and Viewport stay neutral so scrolling text stays crisp over any backdrop.',
  '6. Scroll to verify how the floating capsule overlays scrolling entries.',
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'h-60 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-message-scroller-root',
            props: { a11yLabel: 'Prominence notes', newContentCount: 2 },
            children: [
              {
                kind: 'box',
                className:
                  'flex items-center justify-between border-b border-[var(--pui-border,#c7c7cc)] px-4 py-2.5',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm font-semibold',
                    children: ['Prominence & Disabled Contrast'],
                  },
                  {
                    kind: 'box',
                    ref: 'lgPromStatus',
                    className: 'text-xs text-[var(--pui-muted-foreground,#626267)]',
                    attrs: { role: 'status', 'aria-live': 'polite' },
                    children: ['variant: prominent'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-viewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-2.5 p-4 pb-16 text-sm',
                    children: NOTES.map((note) => ({
                      kind: 'box' as const,
                      className:
                        'rounded-xl bg-[var(--pui-secondary,#ffffff)] px-3.5 py-2 text-[var(--pui-secondary-foreground,#1d1d1f)] shadow-xs',
                      children: [note],
                    })),
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-message-scroller-jump',
                ref: 'lgPromJump',
                props: { variant: 'prominent', disabled: false },
                children: ['2 new notes ↓'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            ref: 'lgVariantToggleBtn',
            children: ['Switch to regular'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            ref: 'lgDisableToggleBtn',
            children: ['Disable Jump'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let variant: 'regular' | 'prominent' = 'prominent';
    let disabled = false;

    const sync = () => {
      api.setProps('lgPromJump', { variant, disabled });
      refs.lgPromStatus.textContent = `variant: ${variant}${disabled ? ' · disabled' : ''}`;
      refs.lgVariantToggleBtn.textContent =
        variant === 'prominent' ? 'Switch to regular' : 'Switch to prominent';
      refs.lgDisableToggleBtn.textContent = disabled ? 'Enable Jump' : 'Disable Jump';
    };

    sync();

    api.setProps('lgVariantToggleBtn', {
      onClick: () => {
        variant = variant === 'prominent' ? 'regular' : 'prominent';
        sync();
      },
    });
    api.setProps('lgDisableToggleBtn', {
      onClick: () => {
        disabled = !disabled;
        sync();
      },
    });
  },
} satisfies DemoSpec;
