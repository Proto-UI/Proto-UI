/** Exact public size-demo inventory, checked against demo-shadcn-switch-sizes.demo.ts. */
export const SHADCN_SWITCH_DEMO_CASES = [
  { name: 'Small', size: 'sm', checked: false, disabled: false },
  { name: 'Default', size: 'default', checked: true, disabled: false },
] as const;

/** Source units, not a rendered result: New York switch.tsx at this immutable revision. */
export const SHADCN_SWITCH_SOURCE_PIN = '02cad61166c4c20edbc8a3f71bd720eed4c1f49b';
export const SHADCN_SWITCH_REM_GEOMETRY = {
  default: { width: 2, height: 1.15, thumb: 1 },
  sm: { width: 1.5, height: 0.875, thumb: 0.75 },
} as const;
