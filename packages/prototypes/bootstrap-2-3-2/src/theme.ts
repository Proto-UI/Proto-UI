/** Family-owned semantic palette. The consumer owns font resources and theme activation. */
export const THEME = {
  'light': {
    'background': '#ffffff',
    'foreground': '#333333',
    'secondary': '#f5f5f5',
    'secondary-foreground': '#333333',
    'primary': '#0044cc',
    'primary-foreground': '#ffffff',
    'border': '#cccccc',
    'muted': '#e6e6e6',
    'ring': '#0055aa',
    'radius': '4px',
  },
  'dark': {
    'background': '#ffffff',
    'foreground': '#333333',
    'secondary': '#f5f5f5',
    'secondary-foreground': '#333333',
    'primary': '#0044cc',
    'primary-foreground': '#ffffff',
    'border': '#cccccc',
    'muted': '#e6e6e6',
    'ring': '#0055aa',
    'radius': '4px',
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
