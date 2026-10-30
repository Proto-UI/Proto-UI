import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { formRoot, formSubmit } from '../src/form';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

for (const prototype of [formRoot, formSubmit]) {
  if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype);
}
const owned: HTMLElement[] = [];
afterEach(() => {
  for (const element of owned.splice(0)) element.remove();
});

describe('shared Button paint cannot silently remove passive-consumer CSS', () => {
  it('retains every runtime-authored Form Submit token after Button changes its own hover recipe', async () => {
    const root = document.createElement('shadcn-form-root');
    const submit = document.createElement('shadcn-form-submit');
    owned.push(root);
    root.append(submit);
    document.body.append(root);
    for (let index = 0; index < 16; index++) await Promise.resolve();
    submit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    for (let index = 0; index < 16; index++) await Promise.resolve();
    expect(submit.hasAttribute('data-hovered')).toBe(true);
    const actual = (submit.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    for (const token of actual) expect(SHADCN_STYLE_TOKENS, token).toContain(token);
    expect(renderProtoStyleTokenCss(actual)).toContain(
      'background-color: color-mix(in oklab, var(--pui-primary) 80%, transparent);'
    );
  });
});
