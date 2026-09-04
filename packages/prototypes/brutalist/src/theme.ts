export type BrutalistThemeMode = Readonly<Record<string, string>>;

export interface BrutalistThemeManifest {
  readonly light: BrutalistThemeMode;
  readonly dark: BrutalistThemeMode;
}

const SHARED_ACCENTS = {
  main: '#fef08a',
  'main-foreground': '#000000',
  destructive: '#fecdd3',
  'destructive-foreground': '#000000',
  border: '#000000',
  input: '#000000',
  primary: '#fef08a',
  'primary-foreground': '#000000',
  secondary: '#ddd6fe',
  'secondary-foreground': '#000000',
  accent: '#bae6fd',
  'accent-foreground': '#000000',
  selection: '#f4f1ea',
  'selection-foreground': '#1c1914',
  canary: '#FEF08A',
  'canary-foreground': '#000000',
  mint: '#A7F3D0',
  'mint-foreground': '#000000',
  lavender: '#DDD6FE',
  'lavender-foreground': '#000000',
  coral: '#FECDD3',
  'coral-foreground': '#000000',
  sky: '#BAE6FD',
  'sky-foreground': '#000000',
} as const;

export const BRUTALIST_THEME: BrutalistThemeManifest = Object.freeze({
  light: Object.freeze({
    radius: '0',
    'radius-sm': '2px',
    background: '#f5f5f5',
    foreground: '#171717',
    'secondary-background': '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.75)',
    card: '#ffffff',
    'card-foreground': '#171717',
    popover: '#ffffff',
    'popover-foreground': '#171717',
    muted: '#e5e5e5',
    'muted-foreground': '#525252',
    ring: '#171717',
    // `destructive` is a fill, so it cannot double as resting text. This is its
    // ink counterpart and it flips, because the pale fill already reads well on
    // the Dark panel and would need no help there.
    'destructive-ink': '#9f1239',
    ...SHARED_ACCENTS,
  }),
  dark: Object.freeze({
    radius: '0',
    'radius-sm': '2px',
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
