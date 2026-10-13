import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { switchRoot, switchThumb } from '../src/switch';
let tokens: string[],
  serial = 0;
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
beforeAll(async () => {
  tokens = (await collectProtoStyleTokens('packages/prototypes/brutalist/src/switch')).map(
    (token) => {
      if (typeof token !== 'string') throw new TypeError('Expected collected token');
      return token;
    }
  );
});
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('actual Brutalist Shadow Switch setup with canonical companion', () => {
  it.each([false, true])(
    'admits initial checked=%s and later targets without unresolved-role failure',
    async (checked) => {
      // T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-CASE-RESIDENT-SPACING
      // No affirmative unit/measurement environment: final CSS targets must remain admitted.
      const shadow = {
        mode: 'open',
        presentation: 'split',
        styleArtifact: renderProtoShadowSplitStyleArtifact(tokens),
      } as const;
      const Root = AdaptToWebComponent(switchRoot, {
        registerAs: `admission-root-${++serial}`,
        shadow,
      });
      const Thumb = AdaptToWebComponent(switchThumb, {
        registerAs: `admission-thumb-${serial}`,
        shadow,
      });
      const root = new Root(),
        thumb = new Thumb(),
        errors: unknown[] = [];
      const capture = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', capture);
      try {
        setElementProps(root, { defaultChecked: checked });
        root.append(thumb);
        document.body.append(root);
        await flush();
        expect(errors).toEqual([]);
        expect(thumb.getExposes().isChecked()).toBe(checked);
        const surface = thumb.shadowRoot!.querySelector('[part="surface"]')!;
        expect(surface.getAttribute('data-pui-style')).toContain('bg-white');
        expect(thumb.getAttribute('data-pui-split-root-style')).toContain('-translate-y-1/2');
        expect(thumb.getAttribute('data-pui-split-root-style')).toContain(
          checked ? 'translate-x-5' : 'translate-x-0'
        );
        root.click();
        await flush();
        expect(errors).toEqual([]);
        expect(thumb.getExposes().isChecked()).toBe(!checked);
        expect(thumb.getAttribute('data-pui-split-root-style')).toContain(
          checked ? 'translate-x-0' : 'translate-x-5'
        );
        expect(surface.getAttribute('data-pui-style')).not.toMatch(/translate-[xy]-/);
      } finally {
        root.remove();
        await flush();
        window.removeEventListener('error', capture);
      }
    }
  );
});
