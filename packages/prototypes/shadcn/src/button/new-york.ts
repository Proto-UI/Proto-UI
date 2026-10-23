/** Explicit legacy direct-Button projection. Static source: shadcn-ui/ui
 * 02cad61166c4c20edbc8a3f71bd720eed4c1f49b, registry/new-york-v4/ui/button.tsx.
 * Do not substitute the independently pinned compound command paint recipe.
 * wrap and icon-compact are Proto extensions, not upstream API claims.
 */
export const NEW_YORK_BASE =
  'inline-flex box-border shrink-0 items-center justify-center rounded-md text-sm leading-5 font-medium transition-all outline-none';
export const NEW_YORK_VARIANTS = {
  default: 'bg-primary text-primary-foreground',
  destructive: 'bg-destructive text-white',
  outline: 'border border-border bg-background text-foreground shadow-xs',
  secondary: 'bg-secondary text-secondary-foreground',
  ghost: 'bg-transparent text-foreground',
  link: 'bg-transparent text-primary underline-offset-4',
} as const;
export const NEW_YORK_SIZES = {
  default: 'h-9 gap-2 px-4 py-2 whitespace-nowrap',
  sm: 'h-8 gap-1.5 px-3 whitespace-nowrap',
  lg: 'h-10 gap-2 px-6 whitespace-nowrap',
  icon: 'size-9 gap-2 whitespace-nowrap',
  'icon-compact': 'size-7 gap-2 whitespace-nowrap',
} as const;
export const NEW_YORK_WRAP_SIZES = {
  default: 'min-h-9 h-auto gap-2 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
  sm: 'min-h-8 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  lg: 'min-h-10 h-auto gap-2 px-6 py-1 min-w-0 max-w-full whitespace-normal break-words',
} as const;
