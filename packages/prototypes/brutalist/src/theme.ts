export type BrutalistThemeMode = Readonly<Record<string, string>>;

export interface BrutalistThemeManifest {
  readonly light: BrutalistThemeMode;
  readonly dark: BrutalistThemeMode;
}

const SHARED_ACCENTS = {
  main: '#5294ff',
  'main-foreground': '#000000',
  destructive: '#ff4d50',
  'destructive-foreground': '#000000',
  border: '#000000',
  input: '#000000',
  primary: '#5294ff',
  'primary-foreground': '#000000',
  secondary: '#7a83ff',
  'secondary-foreground': '#000000',
  accent: '#5294ff',
  'accent-foreground': '#000000',
  selection: '#f4f1ea',
  'selection-foreground': '#1c1914',
  canary: '#FACC00',
  'canary-foreground': '#000000',
  mint: '#05E17A',
  'mint-foreground': '#000000',
  lavender: '#7A83FF',
  'lavender-foreground': '#000000',
  coral: '#FF4D50',
  'coral-foreground': '#000000',
  sky: '#5294FF',
  'sky-foreground': '#000000',
} as const;

export const BRUTALIST_THEME: BrutalistThemeManifest = Object.freeze({
  light: Object.freeze({
    radius: '5px',
    'radius-sm': '3px',
    'radius-md': '5px',
    'radius-lg': '5px',
    'radius-xl': '5px',
    'font-sans': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    'font-heading': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    background: '#dcebfe',
    foreground: '#000000',
    'secondary-background': '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.8)',
    card: '#ffffff',
    'card-foreground': '#171717',
    popover: '#ffffff',
    'popover-foreground': '#171717',
    muted: '#e5e5e5',
    'muted-foreground': '#525252',
    ring: '#000000',
    // `destructive` is a fill, so it cannot double as resting text. This is its
    // ink counterpart and it flips, because the pale fill already reads well on
    // the Dark panel and would need no help there.
    'destructive-ink': '#9f1239',
    ...SHARED_ACCENTS,
  }),
  dark: Object.freeze({
    radius: '5px',
    'radius-sm': '3px',
    'radius-md': '5px',
    'radius-lg': '5px',
    'radius-xl': '5px',
    'font-sans': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    'font-heading': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    background: '#171717',
    foreground: '#f5f5f5',
    'secondary-background': '#262626',
    overlay: 'rgba(0, 0, 0, 0.85)',
    card: '#262626',
    'card-foreground': '#f5f5f5',
    popover: '#262626',
    'popover-foreground': '#f5f5f5',
    muted: '#404040',
    'muted-foreground': '#d4d4d4',
    ring: '#f5f5f5',
    // Unchanged from what the row already painted here: 10.73:1 on the panel.
    'destructive-ink': '#fecdd3',
    ...SHARED_ACCENTS,
  }),
});

export interface RenderBrutalistThemeCssOptions {
  readonly variablePrefix?: string;
  readonly lightSelector?: string;
  readonly darkSelector?: string;
}

function renderDeclarations(mode: BrutalistThemeMode, variablePrefix: string): string {
  return Object.entries(mode)
    .map(([name, value]) => `  --${variablePrefix}${name}: ${value};`)
    .join('\n');
}

export function renderBrutalistThemeCss(options: RenderBrutalistThemeCssOptions = {}): string {
  const variablePrefix = options.variablePrefix ?? '';
  const lightSelector = options.lightSelector ?? ':root';
  const darkSelector = options.darkSelector ?? ":root.dark,\n:root[data-theme='dark']";

  return [
    `${lightSelector} {`,
    renderDeclarations(BRUTALIST_THEME.light, variablePrefix),
    '}',
    '',
    `${darkSelector} {`,
    renderDeclarations(BRUTALIST_THEME.dark, variablePrefix),
    '}',
    '',
  ].join('\n');
}
