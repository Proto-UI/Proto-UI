import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as bootstrap from '../src';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { DRAFT_FAMILY_STYLE_TOKENS } from '../../../cli/src/generated/draft-family-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

type Host = HTMLElement & { getExposes(): Record<string, any> };
const families = [['bootstrap-2-3-2', bootstrap]] as const;
const parts = [
  'checkboxRoot',
  'checkboxIndicator',
  'switchRoot',
  'switchThumb',
  'toggle',
  'inputRoot',
  'textareaRoot',
  'separatorRoot',
] as const;
for (const [, family] of families)
  for (const part of parts) AdaptToWebComponent(family[part] as any);

async function settle() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
async function mount(
  proto: { name: string },
  props: Record<string, unknown> = {},
  child?: { name: string }
) {
  const root = document.createElement(proto.name) as Host;
  setElementProps(root, props);
  const part = child ? (document.createElement(child.name) as Host) : null;
  if (part) root.appendChild(part);
  document.body.appendChild(root);
  await settle();
  return { root, part };
}
async function update(root: Host, props: Record<string, unknown>) {
  setElementProps(root, props);
  await settle();
}
async function click(root: Host) {
  root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await settle();
}
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

for (const [name, family] of families)
  describe(`${name}: Base state/text parts (simulated WC host)`, () => {
    it('keeps eight distinct authored parts with inherited hooks, not old-family aliases', async () => {
      await mount(family.checkboxRoot, {}, family.checkboxIndicator);
      await mount(family.switchRoot, {}, family.switchThumb);
      await mount(family.toggle);
      await mount(family.inputRoot);
      await mount(family.textareaRoot);
      await mount(family.separatorRoot);

      expect(new Set(parts.map((part) => family[part].name)).size).toBe(8);
      const sources = [
        'checkbox/root',
        'checkbox/indicator',
        'switch/root',
        'switch/thumb',
        'toggle/toggle',
        'input/root',
        'textarea/root',
        'separator/root',
      ];
      const calls = [
        'asCheckboxRoot',
        'asCheckboxIndicator',
        'asSwitchRoot',
        'asSwitchThumb',
        'asToggle',
        'asInputRoot',
        'asTextareaRoot',
        'asSeparatorRoot',
      ];
      parts.forEach((part, index) => {
        expect(family[part].name.startsWith(`${name}-`)).toBe(true);
        const source = readFileSync(
          `packages/prototypes/${name}/src/${sources[index]}.proto.ts`,
          'utf8'
        );
        expect(source.split(`${calls[index]}().stateHandles`)).toHaveLength(2);
        expect(source).not.toMatch(/prototypes-(shadcn|brutalist)/);
      });
    });
    it('derives checkbox indicator checked/mixed state from one root and restores disabled', async () => {
      const { root, part } = await mount(family.checkboxRoot, {}, family.checkboxIndicator);
      expect(root.getExposes().checked.get()).toBe(false);
      expect(part!.querySelectorAll('svg path')).toHaveLength(0);
      await click(root);
      expect(root.getExposes().checked.get()).toBe(true);
      expect(part!.getExposes().isChecked()).toBe(true);
      expect(part!.querySelector('svg path')?.getAttribute('d')).toBe('M5 12L10 17L19 7');
      await update(root, { checked: true, indeterminate: true, disabled: true });
      expect(part!.querySelector('svg path')?.getAttribute('d')).toBe('M5 12H19');
      await click(root);
      expect(root.getExposes().checked.get()).toBe(true);
      await update(root, { checked: false, indeterminate: false, disabled: false });
      expect(part!.getExposes().isChecked()).toBe(false);
      expect(part!.getExposes().isIndeterminate()).toBe(false);
      expect(part!.querySelectorAll('svg path')).toHaveLength(0);
      expect(root.getExposes().disabled.get()).toBe(false);
    });
    it('keeps Switch value ownership at the root and a context-only thumb', async () => {
      const { root, part } = await mount(family.switchRoot, {}, family.switchThumb);
      expect(part!.getExposes().isChecked()).toBe(false);
      await click(root);
      expect(root.getExposes().checked.get()).toBe(true);
      expect(part!.getExposes().isChecked()).toBe(true);
      await update(root, { checked: false, disabled: true });
      await click(root);
      expect(root.getExposes().checked.get()).toBe(false);
      expect(part!.getExposes().isChecked()).toBe(false);
      await update(root, { checked: true, disabled: false });
      expect(part!.getExposes().isChecked()).toBe(true);
      expect(root.getExposes().disabled.get()).toBe(false);
      expect(part!.getExposes()).not.toHaveProperty('checkedChange');
    });
    it('inherits Toggle activation and controlled/disabled behavior', async () => {
      const { root } = await mount(family.toggle);
      expect(root.getExposes().active.get()).toBe(false);
      await click(root);
      expect(root.getExposes().active.get()).toBe(true);
      await update(root, { active: false });
      await click(root);
      expect(root.getExposes().active.get()).toBe(false);
      await update(root, { active: true, disabled: true });
      await click(root);
      expect(root.getExposes().active.get()).toBe(true);
      await update(root, { active: false, disabled: false });
      expect(root.getExposes().disabled.get()).toBe(false);
      expect(root.getExposes().active.get()).toBe(false);
    });
    for (const kind of ['input', 'textarea'] as const)
      it(`keeps one physical ${kind}, value and IME owner`, async () => {
        const { root } = await mount(kind === 'input' ? family.inputRoot : family.textareaRoot, {
          defaultValue: 'draft',
          ariaLabel: 'Message',
        });
        const editor = root.querySelector(kind) as HTMLInputElement | HTMLTextAreaElement;
        expect(root.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(1);
        expect(editor.value).toBe('draft');
        editor.value = 'edited';
        editor.dispatchEvent(
          new InputEvent('input', { bubbles: true, data: 'd', inputType: 'insertText' })
        );
        await settle();
        expect(root.getExposes().value.get()).toBe('edited');
        editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        await settle();
        expect(root.getExposes().composing.get()).toBe(true);
        editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '字' }));
        await settle();
        expect(root.getExposes().composing.get()).toBe(false);
        // Controlledness is fixed at the first sync by Text Control. Use a
        // separate controlled owner; a visual family cannot change that rule.
        const controlled = await mount(kind === 'input' ? family.inputRoot : family.textareaRoot, {
          value: 'initial',
        });
        const controlledEditor = controlled.root.querySelector(kind) as
          | HTMLInputElement
          | HTMLTextAreaElement;
        await update(controlled.root, { value: 'controlled', readOnly: true, disabled: true });
        expect(controlledEditor.value).toBe('controlled');
        expect(controlledEditor.readOnly).toBe(true);
        expect(controlledEditor.disabled).toBe(true);
        await update(controlled.root, { value: 'restored', readOnly: false, disabled: false });
        expect(controlledEditor.value).toBe('restored');
        expect(controlledEditor.disabled).toBe(false);
        expect(controlledEditor.readOnly).toBe(false);
        expect(root.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(1);
      });
    for (const [part, state, event, role] of [
      ['checkboxRoot', 'checked', 'checkedChange', 'checkbox'],
      ['switchRoot', 'checked', 'checkedChange', 'switch'],
      ['toggle', 'active', 'activeChange', 'button'],
    ] as const) {
      it(`${part} emits one controlled request, suppresses disabled requests, and restores`, async () => {
        const { root } = await mount(family[part], { [state]: false });
        const details: any[] = [];
        root.addEventListener(event, (event) => details.push((event as CustomEvent).detail));
        expect(root.getAttribute('role')).toBe(role);
        await click(root);
        expect(details).toHaveLength(1);
        expect(details[0][state]).toBe(true);
        expect(root.getExposes()[state].get()).toBe(false);
        await update(root, { [state]: true, disabled: true });
        await click(root);
        expect(details).toHaveLength(1);
        expect(root.getExposes()[state].get()).toBe(true);
        expect(root.getAttribute('aria-disabled')).toBe('true');
        await update(root, { [state]: true, disabled: false });
        await click(root);
        expect(details).toHaveLength(2);
        expect(details[1][state]).toBe(false);
      });
    }
    it('inherits separator orientation without a second content owner', async () => {
      const { root } = await mount(family.separatorRoot, { decorative: false });
      expect(root.getAttribute('role')).toBe('separator');
      await update(root, { orientation: 'vertical', decorative: false });
      expect(root.getExposes().orientation.get()).toBe('vertical');
      expect(root.getAttribute('aria-orientation')).toBe('vertical');
      expect(root.children).toHaveLength(0);
    });
    it('closes the whole source vocabulary through the physical translator', async () => {
      const tokens = (await collectProtoStyleTokens(`packages/prototypes/${name}/src`)) as string[];
      expect(tokens.length).toBeGreaterThan(40);
      expect(tokens).toEqual([...DRAFT_FAMILY_STYLE_TOKENS[name]]);
      expect(renderProtoStyleTokenCss(tokens)).not.toContain('Unsupported Proto UI style tokens');
    });
  });
