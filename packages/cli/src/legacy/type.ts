export const ADAPTER_PACKAGES = {
  vue: '@proto.ui/adapter-vue',
  react: '@proto.ui/adapter-react',
  'web-component': '@proto.ui/adapter-web-component',
  wc: '@proto.ui/adapter-web-component',
};

export const PROTOTYPE_PACKAGES = {
  shadcn: '@proto.ui/prototypes-shadcn',
  brutalist: '@proto.ui/prototypes-brutalist',
};

export const CLI_PACKAGE = '@proto.ui/cli';

export const DEFAULT_THEME_NAME = 'shadcn';
export const DEFAULT_THEME_IMPORT = './shadcn-theme.css';
export const DEFAULT_TOKENS_IMPORT = './proto-ui-tokens.generated.css';
export { SHADCN_STYLE_TOKENS } from '../generated/shadcn-style-tokens.js';
export { BRUTALIST_STYLE_TOKENS } from '../generated/brutalist-style-tokens.js';
export { BRUTALIST_THEME_CSS } from '../generated/brutalist-theme.js';

export const SHADCN_THEME_CSS = `:root {
    --radius: 0.625rem;
    --background: lab(100% 0 0);
    --foreground: lab(2.75381% 0 0);
    --card: lab(100% 0 0);
    --card-foreground: lab(2.75381% 0 0);
    --popover: lab(100% 0 0);
    --popover-foreground: lab(2.75381% 0 0);
    --primary: lab(7.78201% -0.0000149012 0);
    --primary-foreground: lab(98.26% 0 0);
    --secondary: lab(96.52% -0.0000298023 0.0000119209);
    --secondary-foreground: lab(7.78201% -0.0000149012 0);
    --muted: lab(96.52% -0.0000298023 0.0000119209);
    --muted-foreground: lab(48.496% 0 0);
    --accent: lab(96.52% -0.0000298023 0.0000119209);
    --accent-foreground: lab(7.78201% -0.0000149012 0);
    --destructive: lab(48.4493% 77.4328 61.5452);
    --destructive-foreground: lab(96.4152% 3.22586 1.14673);
    --border: lab(90.952% 0 -0.0000119209);
    --input: lab(90.952% 0 -0.0000119209);
    --ring: lab(66.128% -0.0000298023 0.0000119209);
    --chart-1: var(--color-blue-300);
    --chart-2: var(--color-blue-500);
    --chart-3: var(--color-blue-600);
    --chart-4: var(--color-blue-700);
    --chart-5: var(--color-blue-800);
    --sidebar: lab(98.26% 0 0);
    --sidebar-foreground: lab(2.75381% 0 0);
    --sidebar-primary: lab(7.78201% -0.0000149012 0);
    --sidebar-primary-foreground: lab(98.26% 0 0);
    --sidebar-accent: lab(96.52% -0.0000298023 0.0000119209);
    --sidebar-accent-foreground: lab(7.78201% -0.0000149012 0);
    --sidebar-border: lab(90.952% 0 -0.0000119209);
    --sidebar-ring: lab(66.128% -0.0000298023 0.0000119209);
    --surface: lab(97.68% -0.0000298023 0.0000119209);
    --surface-foreground: var(--foreground);
    --code: var(--surface);
    --code-foreground: var(--surface-foreground);
    --code-highlight: lab(95.36% 0 0);
    --code-number: lab(48.96% 0 0);
    --selection: lab(2.75381% 0 0);
    --selection-foreground: lab(100% 0 0);
  }
  
  :root.dark,
  :root[data-theme='dark'] {
    --background: lab(2.75381% 0 0);
    --foreground: lab(98.26% 0 0);
    --card: lab(7.78201% -0.0000149012 0);
    --card-foreground: lab(98.26% 0 0);
    --popover: lab(7.78201% -0.0000149012 0);
    --popover-foreground: lab(98.26% 0 0);
    --primary: lab(90.952% 0 -0.0000119209);
    --primary-foreground: lab(7.78201% -0.0000149012 0);
    --secondary: lab(15.204% 0 -0.00000596046);
    --secondary-foreground: lab(98.26% 0 0);
    --muted: lab(15.204% 0 -0.00000596046);
    --muted-foreground: lab(66.128% -0.0000298023 0.0000119209);
    --accent: lab(27.036% 0 0);
    --accent-foreground: lab(98.26% 0 0);
    --destructive: lab(63.7053% 60.745 31.3109);
    --destructive-foreground: lab(49.0747% 69.3434 49.6251);
    --border: lab(100% 0 0 / 0.1);
    --input: lab(100% 0 0 / 0.15);
    --ring: lab(48.496% 0 0);
    --chart-1: var(--color-blue-300);
    --chart-2: var(--color-blue-500);
    --chart-3: var(--color-blue-600);
    --chart-4: var(--color-blue-700);
    --chart-5: var(--color-blue-800);
    --sidebar: lab(7.78201% -0.0000149012 0);
    --sidebar-foreground: lab(98.26% 0 0);
    --sidebar-primary: lab(36.9089% 35.0961 -85.6872);
    --sidebar-primary-foreground: lab(98.26% 0 0);
    --sidebar-accent: lab(15.204% 0 -0.00000596046);
    --sidebar-accent-foreground: lab(98.26% 0 0);
    --sidebar-border: lab(100% 0 0 / 0.1);
    --sidebar-ring: lab(34.924% 0 0);
    --surface: lab(7.22637% -0.0000149012 0);
    --surface-foreground: lab(66.128% -0.0000298023 0.0000119209);
    --code: var(--surface);
    --code-foreground: var(--surface-foreground);
    --code-highlight: lab(15.32% 0 0);
    --code-number: lab(67.52% -0.0000298023 0);
    --selection: lab(90.952% 0 -0.0000119209);
    --selection-foreground: lab(7.78201% -0.0000149012 0);
  }
  `;
