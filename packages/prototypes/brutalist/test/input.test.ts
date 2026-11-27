import { describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  inputRoot,
  type InputRootProps,
  type InputValueChangeDetail,
} from '@proto.ui/prototypes-base/input';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { COMPONENT_REGISTRY } from '../../../cli/src/registry/components';
import input, { brutalistInputRoot, type BrutalistInputRootProps } from '../src/input';
import { readFileSync } from 'node:fs';

AdaptToWebComponent(input);
const flush = async () => {
  for (let n = 0; n < 4; n++) await Promise.resolve();
};
async function mount(props: BrutalistInputRootProps = {}) {
  const host = document.createElement('brutalist-input-root') as HTMLElement & {
    getExposes(): any;
  };
  host.appendChild(document.createElement('textarea'));
  setElementProps(host, props);
  document.body.appendChild(host);
  await flush();
  const target = host.querySelector<HTMLInputElement>('input')!;
  expect(host.querySelectorAll('input,textarea,[contenteditable]')).toHaveLength(1);
  return { host, target, exposes: host.getExposes() };
}

describe('Brutalist standalone Input', () => {
  it('exports the actual Base-derived prototype and registers its CLI/package subpath', () => {
    expect(brutalistInputRoot).toBe(input);
    expect(input.name).toBe('brutalist-input-root');
    expect(input.modules).toEqual(inputRoot.modules);
    expectTypeOf<BrutalistInputRootProps>().toEqualTypeOf<InputRootProps>();
    const manifest = JSON.parse(readFileSync('packages/prototypes/brutalist/package.json', 'utf8'));
    expect(manifest.exports['./input'].import).toBe('./dist/input/index.js');
    expect(COMPONENT_REGISTRY['brutalist-input']).toMatchObject({
      id: 'brutalist-input',
      packageName: '@proto.ui/prototypes-brutalist',
      importPath: '@proto.ui/prototypes-brutalist/input',
      items: [{ prototypeImport: 'brutalistInputRoot', reactExport: 'BrutalistInputRoot' }],
    });
  });
  it('keeps one editor, hints and dirty uncontrolled text over updates', async () => {
    const { host, target, exposes } = await mount({
      defaultValue: 'first',
      ariaLabel: 'Name',
      placeholder: 'Type here',
      required: true,
    });
    const changes: InputValueChangeDetail[] = [];
    host.addEventListener('valueChange', (event) => changes.push((event as CustomEvent).detail));
    expect(target.type).toBe('text');
    expect(target.getAttribute('aria-label')).toBe('Name');
    expect(target.placeholder).toBe('Type here');
    expect(target.required).toBe(true);
    target.value = 'edited';
    target.dispatchEvent(new InputEvent('input', { data: 'd', inputType: 'insertText' }));
    expect(changes.at(-1)).toMatchObject({ value: 'edited', composing: false });
    expect(exposes.value.get()).toBe('edited');
    setElementProps(host, { defaultValue: 'ignored', placeholder: 'Updated' });
    await flush();
    expect(target.value).toBe('edited');
    expect(target.placeholder).toBe('Updated');
    expect(host.querySelector('input')).toBe(target);
    host.remove();
  });
  it('preserves controlled acceptance/refusal and synthetic composition candidates', async () => {
    const { host, target } = await mount({ value: 'owner' });
    const changes: InputValueChangeDetail[] = [];
    const composition: string[] = [];
    host.addEventListener('valueChange', (event) => changes.push((event as CustomEvent).detail));
    for (const name of ['compositionStart', 'compositionUpdate', 'compositionEnd'])
      host.addEventListener(name, () => composition.push(name));
    target.value = 'proposal';
    target.dispatchEvent(new InputEvent('input', { data: 'l', inputType: 'insertText' }));
    expect(changes.at(-1)).toMatchObject({ value: 'proposal', composing: false });
    setElementProps(host, { value: 'owner' });
    await flush();
    expect(target.value).toBe('owner');
    setElementProps(host, { value: 'accepted' });
    await flush();
    expect(target.value).toBe('accepted');
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '候' }));
    target.value = '候选';
    target.dispatchEvent(
      new InputEvent('input', { data: '选', inputType: 'insertCompositionText', isComposing: true })
    );
    target.dispatchEvent(
      new CompositionEvent('compositionupdate', { bubbles: true, data: '候选' })
    );
    expect(changes.at(-1)).toMatchObject({ value: '候选', composing: true });
    expect(target.value).toBe('候选');
    target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '候选' }));
    expect(composition).toEqual(['compositionStart', 'compositionUpdate', 'compositionEnd']);
    expect(host.querySelector('input')).toBe(target);
    host.remove();
  });
  it('keeps disabled/readOnly and disabled-aware physical focus Base-owned through repeated updates', async () => {
    const { host, target, exposes } = await mount();
    exposes.focusSelf();
    expect(document.activeElement).toBe(target);
    exposes.blurSelf();
    expect(document.activeElement).not.toBe(target);
    for (const disabled of [true, false, true, false]) {
      setElementProps(host, { disabled, readOnly: true });
      await flush();
      expect(host.querySelector('input')).toBe(target);
      expect(target.disabled).toBe(disabled);
      expect(target.readOnly).toBe(true);
      expect(target.hasAttribute('data-disabled')).toBe(disabled);
      target.blur();
      exposes.focusSelf();
      expect(document.activeElement === target).toBe(!disabled);
    }
    host.remove();
  });
  it('closes the source-relative surface and states through the real CSS renderer', async () => {
    const { host, target } = await mount();
    const tokens = (target.getAttribute('data-pui-style') ?? '').split(/\s+/);
    for (const token of [
      'h-10',
      'w-full',
      'px-3',
      'py-2',
      'text-sm',
      'font-medium',
      'rounded-base',
      'border-2',
      'selection:bg-main',
      'data-[focus-visible]:ring-ring',
      'data-[focus-visible]:ring-offset-2',
      'data-[disabled]:cursor-not-allowed',
      'data-[disabled]:opacity-50',
    ])
      expect(tokens).toContain(token);
    for (const token of [
      'h-[40px]',
      'shadow-shadow',
      'leading-6',
      'data-[disabled]:pointer-events-none',
    ])
      expect(tokens).not.toContain(token);
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const declaration of [
      'height: 2.5rem;',
      'padding-inline: 0.75rem;',
      'padding-block: 0.5rem;',
      'font-size: 0.875rem;',
      'line-height: 1.25rem;',
    ])
      expect(css).toContain(declaration);
    host.remove();
  });
});
