import type { ShadcnStyleProps } from '../src/style-scope';
import { afterEach, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { styleContains } from '../../test-utils/style';
import {
  selectRoot,
  selectContent,
  selectGroup,
  selectLabel,
  selectSeparator,
} from '../src/select';
import * as publicBase from '../../base/src';
import * as publicShadcn from '../src';
import type {
  SelectGroupProps,
  SelectLabelExposes,
  SelectSeparatorAsHookContract,
} from '../../base/src/select';
import type {
  ShadcnSelectGroupProps,
  ShadcnSelectLabelExposes,
  ShadcnSelectSeparatorAsHookContract,
} from '../src/select';
for (const p of [selectRoot, selectContent, selectGroup, selectLabel, selectSeparator])
  AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('publishes family and whole-entry prototypes, hooks and structural types', () => {
  expectTypeOf<ShadcnSelectGroupProps>().toEqualTypeOf<SelectGroupProps & ShadcnStyleProps>();
  expectTypeOf<ShadcnSelectLabelExposes>().toEqualTypeOf<SelectLabelExposes>();
  expectTypeOf<ShadcnSelectSeparatorAsHookContract>().toEqualTypeOf<SelectSeparatorAsHookContract>();
  for (const name of ['Group', 'Label', 'Separator'] as const) {
    expect(publicBase[`select${name}`].name).toBe(`base-select-${name.toLowerCase()}`);
    expect(typeof publicBase[`asSelect${name}`]).toBe('function');
    expect(publicShadcn[`select${name}`]).toBe(publicShadcn[`shadcnSelect${name}`]);
  }
});
it('keeps Base naming and decorative semantics while applying exact upstream recipes', async () => {
  const root = document.createElement('shadcn-select-root'),
    content = document.createElement('shadcn-select-content');
  const group = document.createElement('shadcn-select-group'),
    label = document.createElement('shadcn-select-label'),
    separator = document.createElement('shadcn-select-separator');
  label.textContent = 'Frameworks';
  separator.append(document.createElement('button'));
  group.append(label);
  content.append(group, separator);
  root.append(content);
  document.body.append(root);
  await flush();
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(label.id);
  expect(label.textContent).toBe('Frameworks');
  for (const token of ['px-2', 'py-1.5', 'text-xs', 'text-muted-foreground'])
    expect(styleContains(label, token)).toBe(true);
  for (const token of ['pointer-events-none', '-mx-1', 'my-1', 'h-px', 'bg-border'])
    expect(styleContains(separator, token)).toBe(true);
  expect(separator.getAttribute('aria-hidden')).toBe('true');
  expect(separator.getAttribute('role')).toBeNull();
  expect(separator.querySelector('button')).toBeNull();
});
it('projects canonical generated recipes with real document and shadow CSS mappings', () => {
  const tokens = [
    'px-2',
    'py-1.5',
    'text-xs',
    'text-muted-foreground',
    'pointer-events-none',
    '-mx-1',
    'my-1',
    'h-px',
    'bg-border',
  ];
  for (const token of tokens) expect(SHADCN_STYLE_TOKENS).toContain(token);
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const expected of [
      'margin-inline: -0.25rem;',
      'margin-block: 0.25rem;',
      'padding-inline: 0.5rem;',
      'padding-block: 0.375rem;',
      'font-size: 0.75rem;',
      'height: 1px;',
      'pointer-events: none;',
    ])
      expect(css).toContain(expected);
  }
});
