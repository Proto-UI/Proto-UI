import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot, fieldControl, fieldLabel, fieldError } from '../src/field';
import fieldTextarea from '../src/field/textarea.proto';
import fieldSelectTrigger from '../src/field/select-trigger.proto';
import { numberFieldRoot, numberFieldControl } from '../src/number-field';
import { inputOtpRoot, inputOtpControl } from '../src/input-otp';
import { selectRoot } from '../src/select';
import { THEME } from '../src/theme';
import type { AdapterPrototype } from '@proto.ui/adapter-base';
import { DRAFT_FAMILY_STYLE_TOKENS } from '../../../cli/src/generated/draft-family-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

type Host = HTMLElement & { getExposes(): { invalid?: { get(): boolean } } };
const cases: Array<{ control: AdapterPrototype; root?: AdapterPrototype }> = [
  { control: fieldControl },
  { control: fieldTextarea },
  { control: numberFieldControl, root: numberFieldRoot },
  { control: inputOtpControl, root: inputOtpRoot },
  { control: fieldSelectTrigger, root: selectRoot },
];
for (const proto of [
  fieldRoot,
  fieldLabel,
  fieldError,
  ...cases.flatMap(({ control, root }) => (root ? [control, root] : [control])),
]) {
  if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
}
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});
const deliveredTokens: readonly string[] = DRAFT_FAMILY_STYLE_TOKENS['bootstrap-2-3-2'];
const deliveredCss = renderProtoStyleTokenCss([...deliveredTokens]);
const tokens = (host: Element) => (host.getAttribute('data-pui-style') ?? '').split(/\s+/);
function luminance(hex: string) {
  const c = hex
    .replace('#', '')
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('Bootstrap light control invalid ink (simulated WC host)', () => {
  it('pairs historical focused-error ink with every fixed light control fill', () => {
    for (const bg of ['#ffffff', '#eeeeee', '#e6e6e6']) {
      expect(contrast('#953b39', bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(THEME.dark.destructive, bg)).toBeLessThan(4.5);
    }
  });
  for (const { control: proto, root: rootProto } of cases) {
    it(`${proto.name} keeps invalid ink through readonly/disabled and restores validity`, async () => {
      const field = document.createElement(fieldRoot.name) as Host;
      const control = document.createElement(proto.name) as Host;
      const label = document.createElement(fieldLabel.name);
      label.textContent = 'Value';
      const error = document.createElement(fieldError.name);
      const owner = rootProto ? document.createElement(rootProto.name) : control;
      if (owner !== control) {
        setElementProps(owner, { defaultValue: rootProto === numberFieldRoot ? 2 : '12' });
        owner.append(control);
      }
      setElementProps(field, { invalid: false });
      // Theme-token contrast is checked above. Here the real WC adapter is
      // observed for state projection, not computed CSS or native painting.
      field.append(label, owner, error);
      document.body.append(field);
      await settle();
      const target = control.querySelector('input, textarea') ?? control;
      expect(field.hasAttribute('data-invalid')).toBe(false);
      for (const policy of [{}, { readOnly: true }, { disabled: true }, {}]) {
        setElementProps(field, { invalid: true, errors: ['Invalid value'], ...policy });
        await settle();
        expect(field.getExposes().invalid!.get()).toBe(true);
        expect(field.hasAttribute('data-invalid')).toBe(true);
        expect(target.getAttribute('aria-invalid')).toBe('true');
        // A conditional token remains emitted on valid controls: the state attribute,
        // not token removal, is the activation gate in the WC lowering.
        const painted = [control, ...control.querySelectorAll('[data-pui-style]')].find((el) =>
          tokens(el).some((t) => t.endsWith('text-[#953b39]'))
        );
        expect(painted, control.outerHTML).toBeDefined();
        const ink = tokens(painted!).find((t) => t.endsWith('text-[#953b39]'))!;
        expect(ink).toBe('data-[invalid]:text-[#953b39]');
        // Join the actual emitted token to the real generated website stylesheet.
        expect(deliveredTokens).toContain(ink);
        expect(deliveredTokens).toContain('data-[invalid]:border-[#953b39]');
        expect(deliveredCss).toContain(`[data-pui-style~="${ink}"]`);
        expect(deliveredCss).toContain('color: #953b39;');
        expect(painted!.hasAttribute('data-invalid')).toBe(true);
        expect(tokens(painted!)).not.toContain('data-[invalid]:text-destructive');
        expect(tokens(painted!)).not.toContain('text-destructive');
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          expect(target.disabled).toBe(Boolean('disabled' in policy && policy.disabled));
          expect(target.readOnly).toBe(Boolean('readOnly' in policy && policy.readOnly));
        } else {
          expect(target.getAttribute('aria-disabled')).toBe(
            String(Boolean('disabled' in policy && policy.disabled))
          );
          expect(target.getAttribute('aria-readonly')).toBe(
            String(Boolean('readOnly' in policy && policy.readOnly))
          );
        }
      }
      setElementProps(field, { invalid: false });
      await settle();
      expect(field.hasAttribute('data-invalid')).toBe(false);
      expect(target.getAttribute('aria-invalid')).not.toBe('true');
      const painted = [control, ...control.querySelectorAll('[data-pui-style]')].find((el) =>
        tokens(el).some((t) => t.endsWith('text-[#953b39]'))
      );
      expect(painted).toBeDefined();
      expect(painted!.hasAttribute('data-invalid')).toBe(false);
      expect(tokens(painted!)).toContain(
        proto === fieldSelectTrigger
          ? 'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)]'
          : 'text-[#555]'
      );
      expect(control.querySelector('input, textarea') ?? control).toBe(target);
    });
  }
});
