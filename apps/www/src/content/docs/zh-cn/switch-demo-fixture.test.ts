import { describe, expect, it } from 'vitest';
import demo from './demo-shadcn-switch.demo';
import { SHADCN_SWITCH_DEMO_CASES, SHADCN_SWITCH_REM_GEOMETRY } from './switch-demo-fixture';

// Source inventory only. Native readiness and geometry remain browser assertions.
describe('Shadcn Switch public demo acceptance inventory', () => {
  it('keeps exact readiness count and named variant expectations aligned with the real demo', () => {
    expect(demo.root.prototypeId).toBe('shadcn-style-scope');
    expect(demo.root.props).toEqual({ styleProfile: 'rhea' });
    expect(demo.root.children).toHaveLength(1);
    const authoredRoot = demo.root.children[0];
    expect(authoredRoot.kind).toBe('box');
    const actual = authoredRoot.children
      .filter((node) => node.kind === 'proto' && node.prototypeId === 'shadcn-switch-root')
      .map((root) => ({
        name: root.children.find((part) => part.kind === 'box')!.children!.join(''),
        size: root.props.size ?? 'default',
        checked: root.props.defaultChecked,
        disabled: root.props.disabled ?? false,
      }));
    expect(actual).toEqual(SHADCN_SWITCH_DEMO_CASES);
    expect(SHADCN_SWITCH_DEMO_CASES).toHaveLength(5);
  });

  it('retains both small examples and default pressed coverage with fixed source rem geometry', () => {
    expect(
      SHADCN_SWITCH_DEMO_CASES.filter((entry) => entry.size === 'sm').map((entry) => entry.checked)
    ).toEqual([false, true]);
    expect(
      SHADCN_SWITCH_DEMO_CASES.filter((entry) => !entry.disabled && !entry.checked).map(
        (entry) => entry.size
      )
    ).toEqual(['sm', 'default']);
    expect(SHADCN_SWITCH_REM_GEOMETRY).toEqual({
      default: { width: 2, height: 1.15, thumb: 1 },
      sm: { width: 1.5, height: 0.875, thumb: 0.75 },
    });
  });
});
