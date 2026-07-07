export const ADAPTER_PACKAGES = {
  vue: '@proto.ui/adapter-vue',
  react: '@proto.ui/adapter-react',
  'web-component': '@proto.ui/adapter-web-component',
  wc: '@proto.ui/adapter-web-component',
};

export const PROTOTYPE_PACKAGES = {
  shadcn: '@proto.ui/prototypes-shadcn',
};

export const CLI_PACKAGE = '@proto.ui/cli';

export const DEFAULT_THEME_NAME = 'shadcn';
export const DEFAULT_THEME_IMPORT = './shadcn-theme.css';
export const DEFAULT_TOKENS_IMPORT = './proto-ui-tokens.generated.css';

export const SHADCN_STYLE_TOKENS = [
  '-translate-x-1/2',
  '-translate-y-1/2',
  'absolute',
  'active:bg-background',
  'active:bg-muted',
  'active:bg-muted/80',
  'active:scale-[0.98]',
  'active:scale-[0.99]',
  'active:shadow-xs',
  'active:text-foreground',
  'active:translate-y-px',
  'data-[active]:bg-muted',
  'data-[active]:text-foreground',
  'data-[checked]:bg-accent',
  'data-[checked]:bg-muted',
  'data-[checked]:bg-primary',
  'data-[checked]:pl-[20px]',
  'data-[checked]:pr-0.5',
  'data-[checked]:text-accent-foreground',
  'data-[checked]:text-muted-foreground',
  'data-[checked]:text-primary-foreground',
  'data-[current]:hidden',
  'data-[expanded]:bg-muted',
  'data-[expanded]:bg-secondary',
  'data-[expanded]:text-foreground',
  'data-[expanded]:text-secondary-foreground',
  'data-[invalid]:border-destructive',
  'data-[invalid]:ring-3',
  'data-[invalid]:ring-destructive/20',
  'data-[selected]:bg-background',
  'data-[selected]:shadow-xs',
  'data-[selected]:text-foreground',
  'backdrop-blur-xs',
  'bg-accent',
  'bg-background',
  'bg-background/70',
  'bg-black/80',
  'bg-clip-padding',
  'bg-destructive/10',
  'bg-destructive/20',
  'bg-destructive/30',
  'bg-input',
  'bg-input/30',
  'bg-input/50',
  'bg-input/80',
  'bg-muted',
  'bg-muted/60',
  'bg-muted/80',
  'bg-primary',
  'bg-primary/80',
  'bg-primary/90',
  'bg-secondary',
  'bg-secondary/80',
  'bg-transparent',
  'block',
  'border',
  'border-border',
  'border-border/50',
  'border-border/60',
  'border-destructive',
  'border-destructive/40',
  'border-destructive/50',
  'border-input',
  'border-ring',
  'border-transparent',
  'cursor-default',
  'dark:data-[checked]:bg-input/50',
  'dark:data-[checked]:bg-primary',
  'dark:data-[invalid]:border-destructive/50',
  'dark:data-[invalid]:ring-destructive/40',
  'dark:bg-destructive/20',
  'dark:bg-input/30',
  'dark:border-input',
  'dark:data-[focus-visible]:ring-destructive/40',
  'dark:hover:bg-destructive/30',
  'dark:hover:bg-input/50',
  'data-[disabled]:opacity-50',
  'data-[disabled]:pointer-events-none',
  'data-[focus-visible]:bg-background',
  'data-[focus-visible]:border-destructive/40',
  'data-[focus-visible]:border-ring',
  'data-[focus-visible]:ring-2',
  'data-[focus-visible]:ring-3',
  'data-[focus-visible]:ring-destructive/20',
  'data-[focus-visible]:ring-inset',
  'data-[focus-visible]:ring-offset-2',
  'data-[focus-visible]:ring-offset-background',
  'data-[focus-visible]:ring-ring/40',
  'data-[focus-visible]:ring-ring/50',
  'data-[focus-visible]:shadow-xs',
  'data-[focus-visible]:text-foreground',
  'data-[hovered]:not-[data-active]:bg-muted',
  'data-[hovered]:not-[data-active]:text-foreground',
  'data-[hovered]:not-[data-checked]:bg-input',
  'data-[hovered]:not-[data-selected]:bg-background/70',
  'data-[hovered]:not-[data-selected]:shadow-xs',
  'data-[hovered]:not-[data-selected]:text-foreground',
  'duration-200',
  'ease-in-out',
  'fixed',
  'flex',
  'flex-col',
  'font-medium',
  'font-semibold',
  'gap-1',
  'gap-1.5',
  'gap-2',
  'gap-3',
  'gap-4',
  'grid',
  'group/button',
  'h-10',
  'h-6',
  'h-7',
  'h-8',
  'h-9',
  'hidden',
  'hover:data-[checked]:bg-input',
  'hover:data-[checked]:bg-muted/60',
  'hover:data-[checked]:bg-primary/90',
  'hover:data-[checked]:text-foreground',
  'hover:data-[selected]:bg-background/70',
  'hover:data-[selected]:shadow-xs',
  'hover:data-[selected]:text-foreground',
  'hover:bg-destructive/20',
  'hover:bg-muted',
  'hover:bg-primary/80',
  'hover:bg-secondary/80',
  'hover:data-[focus-visible]:data-[focused]:bg-muted',
  'hover:data-[focus-visible]:data-[focused]:text-foreground',
  'hover:text-foreground',
  'hover:underline',
  'inline-flex',
  'inset-0',
  'items-center',
  'items-start',
  'justify-center',
  'leading-6',
  'leading-none',
  'left-0',
  'left-1/2',
  'max-w-lg',
  'min-h-28',
  'min-w-10',
  'min-w-56',
  'min-w-8',
  'min-w-9',
  'mt-2',
  'opacity-50',
  'outline-none',
  'overflow-hidden',
  'p-1',
  'p-4',
  'p-6',
  'peer',
  'pl-0.5',
  'pl-[20px]',
  'pointer-events-none',
  'pr-0.5',
  'pr-[20px]',
  'px-2.5',
  'px-3',
  'px-5',
  'py-1.5',
  'py-2',
  'relative',
  'ring-0',
  'ring-2',
  'ring-3',
  'ring-destructive/20',
  'ring-destructive/40',
  'ring-inset',
  'ring-offset-2',
  'ring-offset-background',
  'ring-ring/40',
  'ring-ring/50',
  'rounded-[min(var(--radius-md),12px)]',
  'rounded-full',
  'rounded-lg',
  'rounded-md',
  'rounded-xl',
  'scale-[0.98]',
  'scale-[0.99]',
  'select-none',
  'shadow-lg',
  'shadow-xs',
  'shrink-0',
  'size-5',
  'size-8',
  'text-[0.8rem]',
  'text-accent-foreground',
  'text-destructive',
  'text-foreground',
  'text-left',
  'text-lg',
  'text-muted-foreground',
  'text-primary',
  'text-primary-foreground',
  'text-secondary-foreground',
  'text-sm',
  'top-1/2',
  'top-full',
  'tracking-tight',
  'transition-all',
  'transition-colors',
  'translate-x-0',
  'translate-y-px',
  'underline',
  'underline-offset-4',
  'w-11',
  'w-80',
  'w-full',
  'whitespace-nowrap',
  'will-change-transform',
  'z-40',
];

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
