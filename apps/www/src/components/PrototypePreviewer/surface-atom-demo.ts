import type { DemoSpec } from './demo-types';

/** Explicit external visual facts, never a replacement input/activation protocol. */
export function createSurfaceAtomDemo(
  family: 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass'
): DemoSpec {
  const prototypeId = `${family}-surface-root`;
  const cases: Array<{ label: string; props: Record<string, unknown> }> = [
    { label: 'Outline · rest', props: { variant: 'outline', radius: 'md' } },
    { label: 'Muted · no border', props: { variant: 'muted', border: 'none' } },
    { label: 'Solid · supplied focus', props: { variant: 'solid', focusVisible: true } },
    {
      label: 'Raised · supplied press',
      props: { variant: 'accent', elevation: 'raised', pressed: true },
    },
  ];
  if (family === 'liquid-glass') {
    cases.push({
      label: 'Explicit material opt-in · regular glass when available',
      props: { variant: 'outline', material: 'auto' },
    });
  }
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex max-w-xl flex-col gap-4 p-2',
      children: cases.map(({ label, props }) => ({
        kind: 'proto',
        prototypeId,
        props,
        children: [{ kind: 'box', className: 'p-4', children: [label] }],
      })),
    },
  };
}
