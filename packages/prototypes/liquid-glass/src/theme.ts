/** Family-owned semantic palette. The consumer owns font resources and theme activation. */
export const THEME = {
  'light': {
    'background': '#f5f5f7',
    'foreground': '#1d1d1f',
    'secondary': '#ffffff',
    'secondary-foreground': '#1d1d1f',
    'primary': '#0061cc',
    'primary-foreground': '#ffffff',
    'border': '#c7c7cc',
    'muted': '#e8e8ed',
    'ring': '#0061cc',
    'radius': '9999px',
  },
  'dark': {
    'background': '#1c1c1e',
    'foreground': '#f5f5f7',
    'secondary': '#2c2c2e',
    'secondary-foreground': '#f5f5f7',
    'primary': '#0a6cdb',
    'primary-foreground': '#ffffff',
    'border': '#636366',
    'muted': '#3a3a3c',
    'ring': '#78b7ff',
    'radius': '9999px',
  },
} as const;

export function renderThemeCss(
  options: {
    variablePrefix?: string;
    lightSelector?: string;
    darkSelector?: string;
  } = {}
): string {
  const prefix = options.variablePrefix ?? 'pui-';
  const block = (selector: string, values: Readonly<Record<string, string>>) =>
    `${selector} {\n${Object.entries(values)
      .map(([name, value]) => `  --${prefix}${name}: ${value};`)
      .join('\n')}\n}`;
  return [
    block(options.lightSelector ?? ':root', THEME.light),
    block(options.darkSelector ?? ':root.dark, :root[data-theme="dark"]', THEME.dark),
    '',
  ].join('\n');
}
