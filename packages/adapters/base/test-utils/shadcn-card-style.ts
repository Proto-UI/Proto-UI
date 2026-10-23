import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { ShadcnCardRoot } from '../../../prototypes/shadcn/src/card';
type Mounted = {
  host: HTMLElement;
  act(fn: () => void): Promise<void>;
  setProps(props: any): Promise<void>;
  unmount(): Promise<void>;
};
export function describeShadcnCardStyle(
  adapter: string,
  mount: (proto: Prototype<any>, options: any) => Promise<Mounted>
) {
  describe(`${adapter} public passive Card`, () => {
    it('switches source-bound paint on the same roleless native surface', async () => {
      const m = await mount(ShadcnCardRoot, { autoUpdateOnPropsChange: false });
      try {
        await m.act(() => {});
        const surface = m.host.querySelector('[data-pui-root]') ?? m.host.firstElementChild!;
        const tokens = () => surface.getAttribute('data-pui-style') ?? '';
        expect(tokens()).toContain('py-6');
        await m.setProps({ styleProfile: 'rhea', size: 'sm' });
        expect(tokens()).toContain('py-4');
        expect(tokens()).toContain('rounded-[min(var(--pui-radius-4xl),24px)]');
        expect(tokens()).toContain('ring-foreground/5');
        expect(tokens().split(/\s+/)).not.toContain('border');
        expect(surface.hasAttribute('role')).toBe(false);
        await m.setProps({ styleProfile: 'new-york', size: 'default' });
        expect(tokens()).toContain('py-6');
        expect(tokens()).not.toContain('ring-1');
        expect(m.host.querySelector('[data-pui-root]') ?? m.host.firstElementChild).toBe(surface);
      } finally {
        await m.unmount();
      }
    });
  });
}
