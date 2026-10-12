/** Exact public demo inventory, checked against demo-shadcn-switch.demo.ts. */
export const SHADCN_SWITCH_DEMO_CASES = [
  { name: 'Small email alerts', size: 'sm', checked: false, disabled: false },
  { name: 'Small release alerts', size: 'sm', checked: true, disabled: false },
  { name: 'Email alerts', size: 'default', checked: false, disabled: false },
  { name: 'Release alerts', size: 'default', checked: true, disabled: false },
  { name: 'Archived alerts', size: 'default', checked: true, disabled: true },
] as const;

/** Source units, not a rendered result: New York switch.tsx at this immutable revision. */
export const SHADCN_SWITCH_SOURCE_PIN = '02cad61166c4c20edbc8a3f71bd720eed4c1f49b';
export const SHADCN_SWITCH_REM_GEOMETRY = {
  default: { width: 2, height: 1.15, thumb: 1 },
  sm: { width: 1.5, height: 0.875, thumb: 0.75 },
} as const;
