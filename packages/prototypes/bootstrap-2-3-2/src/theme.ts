/** Family-owned semantic palette. The consumer owns font resources and theme activation. */
export const THEME = {
  'light': {
    'muted-foreground': '#666666',
    'font-sans': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-heading': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-mono': 'Monaco, Menlo, Consolas, "Courier New", monospace',
    'background': '#ffffff',
    'foreground': '#333333',
    'secondary': '#f5f5f5',
    'secondary-foreground': '#333333',
    'primary': '#0044cc',
    'primary-foreground': '#ffffff',
    'border': '#cccccc',
    'accent': '#d9edf7',
    'accent-foreground': '#333333',
    'navbar-top': '#ffffff',
    'navbar-bottom': '#f2f2f2',
    'navbar-border': '#d4d4d4',
    'muted': '#e6e6e6',
    'ring': '#0055aa',
    'destructive': '#b94a48',
    'radius': '4px',
  },
  // Proto UI dark adaptation. Bootstrap 2.3.2 has no historical dark page palette;
  // literal light controls retain their paired ink rather than inheriting this text.
  'dark': {
    'muted-foreground': '#bdbdbd',
    'font-sans': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-heading': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-mono': 'Monaco, Menlo, Consolas, "Courier New", monospace',
    'background': '#161616',
    'foreground': '#eeeeee',
    'secondary': '#2c2c2c',
    'secondary-foreground': '#eeeeee',
    'primary': '#0044cc',
    'primary-foreground': '#ffffff',
    'border': '#5a5a5a',
    'accent': '#3a3a3a',
    'accent-foreground': '#ffffff',
    'navbar-top': '#333333',
    'navbar-bottom': '#222222',
    'navbar-border': '#080808',
    'muted': '#2c2c2c',
    'ring': '#7abfff',
    'destructive': '#f2a6a4',
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
