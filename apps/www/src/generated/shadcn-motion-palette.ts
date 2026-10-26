/**
 * Generated from packages/cli/src/legacy/type.ts#SHADCN_THEME_VARIABLES_CSS.
 * Run: node --import tsx scripts/styles/generate-shadcn-motion-palette.ts [--check]
 * Do not edit by hand. sourceHash hashes the exact extracted CSS literal.
 * RGBA is non-premultiplied, gamma-encoded sRGB in [0,1], with channel clipping.
 * Lab conversion uses CSS Color 4 D50 -> Bradford D65; no perceptual gamut mapping.
 * expectedInputs contains resolved source Lab strings for provenance checks only.
 * External variables and unsupported values remain unresolved; no fallback is invented.
 */
export type ShadcnMotionRgba = readonly [number, number, number, number];
export type ShadcnMotionPaletteMode = {
  readonly colors: Readonly<Record<string, ShadcnMotionRgba>>;
  readonly expectedInputs: Readonly<Record<string, string>>;
  readonly unresolved: Readonly<
    Record<
      string,
      {
        readonly code: 'missing-reference' | 'reference-cycle' | 'unsupported-value';
        readonly value: string;
        readonly path: readonly string[];
      }
    >
  >;
};
export const SHADCN_MOTION_PALETTE = {
  'sourceHash': 'sha256:8bb5d047e6c6aff5ffe8c7a71302f2343b51320c523edf09de8d929c34d624e5',
  'light': {
    'colors': {
      'accent': [0.960586783, 0.960587058, 0.960586891, 1],
      'accent-foreground': [0.09052732, 0.090527427, 0.090527399, 1],
      'background': [1, 1, 1, 1],
      'border': [0.898160632, 0.898160666, 0.898160753, 1],
      'card': [1, 1, 1, 1],
      'card-foreground': [0.039388211, 0.039388211, 0.039388211, 1],
      'code': [0.973691065, 0.973691342, 0.973691174, 1],
      'code-foreground': [0.039388211, 0.039388211, 0.039388211, 1],
      'code-highlight': [0.947516435, 0.947516435, 0.947516435, 1],
      'code-number': [0.456078361, 0.456078361, 0.456078361, 1],
      'destructive': [0.906457153, 0, 0.042213675, 1],
      'destructive-foreground': [0.987558074, 0.951130919, 0.951301072, 1],
      'foreground': [0.039388211, 0.039388211, 0.039388211, 1],
      'input': [0.898160632, 0.898160666, 0.898160753, 1],
      'muted': [0.960586783, 0.960587058, 0.960586891, 1],
      'muted-foreground': [0.451519243, 0.451519243, 0.451519243, 1],
      'popover': [1, 1, 1, 1],
      'popover-foreground': [0.039388211, 0.039388211, 0.039388211, 1],
      'primary': [0.09052732, 0.090527427, 0.090527399, 1],
      'primary-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'ring': [0.630163016, 0.63016327, 0.630163116, 1],
      'secondary': [0.960586783, 0.960587058, 0.960586891, 1],
      'secondary-foreground': [0.09052732, 0.090527427, 0.090527399, 1],
      'selection': [0.039388211, 0.039388211, 0.039388211, 1],
      'selection-foreground': [1, 1, 1, 1],
      'sidebar': [0.98025598, 0.98025598, 0.98025598, 1],
      'sidebar-accent': [0.960586783, 0.960587058, 0.960586891, 1],
      'sidebar-accent-foreground': [0.09052732, 0.090527427, 0.090527399, 1],
      'sidebar-border': [0.898160632, 0.898160666, 0.898160753, 1],
      'sidebar-foreground': [0.039388211, 0.039388211, 0.039388211, 1],
      'sidebar-primary': [0.09052732, 0.090527427, 0.090527399, 1],
      'sidebar-primary-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'sidebar-ring': [0.630163016, 0.63016327, 0.630163116, 1],
      'surface': [0.973691065, 0.973691342, 0.973691174, 1],
      'surface-foreground': [0.039388211, 0.039388211, 0.039388211, 1],
    },
    'expectedInputs': {
      'accent': 'lab(96.52% -0.0000298023 0.0000119209)',
      'accent-foreground': 'lab(7.78201% -0.0000149012 0)',
      'background': 'lab(100% 0 0)',
      'border': 'lab(90.952% 0 -0.0000119209)',
      'card': 'lab(100% 0 0)',
      'card-foreground': 'lab(2.75381% 0 0)',
      'code': 'lab(97.68% -0.0000298023 0.0000119209)',
      'code-foreground': 'lab(2.75381% 0 0)',
      'code-highlight': 'lab(95.36% 0 0)',
      'code-number': 'lab(48.96% 0 0)',
      'destructive': 'lab(48.4493% 77.4328 61.5452)',
      'destructive-foreground': 'lab(96.4152% 3.22586 1.14673)',
      'foreground': 'lab(2.75381% 0 0)',
      'input': 'lab(90.952% 0 -0.0000119209)',
      'muted': 'lab(96.52% -0.0000298023 0.0000119209)',
      'muted-foreground': 'lab(48.496% 0 0)',
      'popover': 'lab(100% 0 0)',
      'popover-foreground': 'lab(2.75381% 0 0)',
      'primary': 'lab(7.78201% -0.0000149012 0)',
      'primary-foreground': 'lab(98.26% 0 0)',
      'ring': 'lab(66.128% -0.0000298023 0.0000119209)',
      'secondary': 'lab(96.52% -0.0000298023 0.0000119209)',
      'secondary-foreground': 'lab(7.78201% -0.0000149012 0)',
      'selection': 'lab(2.75381% 0 0)',
      'selection-foreground': 'lab(100% 0 0)',
      'sidebar': 'lab(98.26% 0 0)',
      'sidebar-accent': 'lab(96.52% -0.0000298023 0.0000119209)',
      'sidebar-accent-foreground': 'lab(7.78201% -0.0000149012 0)',
      'sidebar-border': 'lab(90.952% 0 -0.0000119209)',
      'sidebar-foreground': 'lab(2.75381% 0 0)',
      'sidebar-primary': 'lab(7.78201% -0.0000149012 0)',
      'sidebar-primary-foreground': 'lab(98.26% 0 0)',
      'sidebar-ring': 'lab(66.128% -0.0000298023 0.0000119209)',
      'surface': 'lab(97.68% -0.0000298023 0.0000119209)',
      'surface-foreground': 'lab(2.75381% 0 0)',
    },
    'unresolved': {
      'chart-1': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-300)',
        'path': ['--chart-1', '--color-blue-300'],
      },
      'chart-2': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-500)',
        'path': ['--chart-2', '--color-blue-500'],
      },
      'chart-3': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-600)',
        'path': ['--chart-3', '--color-blue-600'],
      },
      'chart-4': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-700)',
        'path': ['--chart-4', '--color-blue-700'],
      },
      'chart-5': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-800)',
        'path': ['--chart-5', '--color-blue-800'],
      },
    },
  },
  'dark': {
    'colors': {
      'accent': [0.250470902, 0.250470902, 0.250470902, 1],
      'accent-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'background': [0.039388211, 0.039388211, 0.039388211, 1],
      'border': [1, 1, 1, 0.1],
      'card': [0.09052732, 0.090527427, 0.090527399, 1],
      'card-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'code': [0.086104116, 0.086104228, 0.086104199, 1],
      'code-foreground': [0.630163016, 0.63016327, 0.630163116, 1],
      'code-highlight': [0.150332249, 0.150332249, 0.150332249, 1],
      'code-number': [0.64470978, 0.644710067, 0.644709994, 1],
      'destructive': [1, 0.39115265, 0.403857033, 1],
      'destructive-foreground': [0.874158559, 0.132691, 0.146676952, 1],
      'foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'input': [1, 1, 1, 0.15],
      'muted': [0.149382066, 0.149382078, 0.14938211, 1],
      'muted-foreground': [0.630163016, 0.63016327, 0.630163116, 1],
      'popover': [0.09052732, 0.090527427, 0.090527399, 1],
      'popover-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'primary': [0.898160632, 0.898160666, 0.898160753, 1],
      'primary-foreground': [0.09052732, 0.090527427, 0.090527399, 1],
      'ring': [0.451519243, 0.451519243, 0.451519243, 1],
      'secondary': [0.149382066, 0.149382078, 0.14938211, 1],
      'secondary-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'selection': [0.898160632, 0.898160666, 0.898160753, 1],
      'selection-foreground': [0.090527401, 0.090527401, 0.090527401, 1],
      'sidebar': [0.09052732, 0.090527427, 0.090527399, 1],
      'sidebar-accent': [0.149382066, 0.149382078, 0.14938211, 1],
      'sidebar-accent-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'sidebar-border': [1, 1, 1, 0.1],
      'sidebar-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'sidebar-primary': [0.077908515, 0.279135511, 0.901775373, 1],
      'sidebar-primary-foreground': [0.98025598, 0.98025598, 0.98025598, 1],
      'sidebar-ring': [0.321992847, 0.321992847, 0.321992847, 1],
      'surface': [0.086104116, 0.086104228, 0.086104199, 1],
      'surface-foreground': [0.630163016, 0.63016327, 0.630163116, 1],
    },
    'expectedInputs': {
      'accent': 'lab(27.036% 0 0)',
      'accent-foreground': 'lab(98.26% 0 0)',
      'background': 'lab(2.75381% 0 0)',
      'border': 'lab(100% 0 0 / 0.1)',
      'card': 'lab(7.78201% -0.0000149012 0)',
      'card-foreground': 'lab(98.26% 0 0)',
      'code': 'lab(7.22637% -0.0000149012 0)',
      'code-foreground': 'lab(66.128% -0.0000298023 0.0000119209)',
      'code-highlight': 'lab(15.32% 0 0)',
      'code-number': 'lab(67.52% -0.0000298023 0)',
      'destructive': 'lab(63.7053% 60.745 31.3109)',
      'destructive-foreground': 'lab(49.0747% 69.3434 49.6251)',
      'foreground': 'lab(98.26% 0 0)',
      'input': 'lab(100% 0 0 / 0.15)',
      'muted': 'lab(15.204% 0 -0.00000596046)',
      'muted-foreground': 'lab(66.128% -0.0000298023 0.0000119209)',
      'popover': 'lab(7.78201% -0.0000149012 0)',
      'popover-foreground': 'lab(98.26% 0 0)',
      'primary': 'lab(90.952% 0 -0.0000119209)',
      'primary-foreground': 'lab(7.78201% -0.0000149012 0)',
      'ring': 'lab(48.496% 0 0)',
      'secondary': 'lab(15.204% 0 -0.00000596046)',
      'secondary-foreground': 'lab(98.26% 0 0)',
      'selection': 'lab(90.952% 0 -0.0000119209)',
      'selection-foreground': 'lab(7.78201% 0 0)',
      'sidebar': 'lab(7.78201% -0.0000149012 0)',
      'sidebar-accent': 'lab(15.204% 0 -0.00000596046)',
      'sidebar-accent-foreground': 'lab(98.26% 0 0)',
      'sidebar-border': 'lab(100% 0 0 / 0.1)',
      'sidebar-foreground': 'lab(98.26% 0 0)',
      'sidebar-primary': 'lab(36.9089% 35.0961 -85.6872)',
      'sidebar-primary-foreground': 'lab(98.26% 0 0)',
      'sidebar-ring': 'lab(34.924% 0 0)',
      'surface': 'lab(7.22637% -0.0000149012 0)',
      'surface-foreground': 'lab(66.128% -0.0000298023 0.0000119209)',
    },
    'unresolved': {
      'chart-1': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-300)',
        'path': ['--chart-1', '--color-blue-300'],
      },
      'chart-2': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-500)',
        'path': ['--chart-2', '--color-blue-500'],
      },
      'chart-3': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-600)',
        'path': ['--chart-3', '--color-blue-600'],
      },
      'chart-4': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-700)',
        'path': ['--chart-4', '--color-blue-700'],
      },
      'chart-5': {
        'code': 'missing-reference',
        'value': 'var(--color-blue-800)',
        'path': ['--chart-5', '--color-blue-800'],
      },
    },
  },
} as const satisfies {
  readonly sourceHash: string;
  readonly light: ShadcnMotionPaletteMode;
  readonly dark: ShadcnMotionPaletteMode;
};
