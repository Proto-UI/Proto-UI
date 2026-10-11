import { afterEach, describe, it, expect, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '../../web-component/src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { createResidentMotionFixture, RESIDENT_FIXTURE_TOKENS } from './fixtures/resident-motion';
let serial = 0;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});
describe('resident own fixture actual Runtime to Web surface', () => {
  it.each(['document', 'shadow'] as const)(
    '%s admits active into resolved Rule targets and targets the visual surface',
    async (scope) => {
      vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
      const diagnostics: unknown[] = [];
      const options: any = {
        residentMotion: {
          palette: {
            current: () => ({
              revision: 1,
              colors: { input: [0, 0, 0, 1], primary: [1, 1, 1, 1] },
            }),
            subscribe: () => () => {},
          },
          diagnostics: (value: unknown) => diagnostics.push(value),
        },
      };
      if (scope === 'shadow')
        options.shadow = {
          mode: 'open',
          presentation: 'split',
          styleArtifact: renderProtoShadowSplitStyleArtifact(RESIDENT_FIXTURE_TOKENS),
        };
      const C = AdaptToWebComponent(
        createResidentMotionFixture(`resident-runtime-${++serial}`),
        options
      );
      const el = new C();
      document.body.append(el);
      await flush();
      const surface = (el.shadowRoot?.querySelector('[part="surface"]') ?? el) as HTMLElement;
      expect(surface.style.getPropertyValue('background-color')).toMatch(
        /^rgba?\(0, 0, 0(?:, 1)?\)$/
      );
      setElementProps(el, { active: true });
      await flush();
      expect((el.getExposes() as any).readResolved()).toEqual({ active: true });
      expect(surface.getAttribute('data-pui-style')).toContain('bg-primary');
      const rgb = surface.style
        .getPropertyValue('background-color')
        .match(/[\d.]+/g)!
        .map(Number);
      expect(rgb.length).toBeGreaterThanOrEqual(3);
      for (const channel of rgb.slice(0, 3)) expect(channel).toBeCloseTo(255, 3);
      if (scope === 'shadow') expect(el.style.getPropertyValue('background-color')).toBe('');
      expect(diagnostics).not.toEqual([]);
    }
  );
});
