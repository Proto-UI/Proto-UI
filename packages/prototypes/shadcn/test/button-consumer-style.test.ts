import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import button from '../src/button';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { SHADCN_THEME_CSS } from '../../../cli/src/legacy/type';
import {
  renderProtoStyleEntryCss,
  renderProtoStyleTokenCss,
  renderPrefixedThemeCss,
} from '../../../cli/src/services/proto-style-css';
import {
  assertStyledButton,
  loadConsumerStyles,
} from '../../../../scripts/release/consumer-smoke-css.mjs';

if (!customElements.get(button.name)) AdaptToWebComponent(button);
const flush = async () => {
  for (let index = 0; index < 25; index++) await Promise.resolve();
};

it('runs the styled consumer oracle against the real default Button host and generated CSS', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'button-consumer-host-'));
  const stylesDir = join(directory, 'src/styles');
  mkdirSync(stylesDir, { recursive: true });
  for (const [name, css] of Object.entries({
    'proto-ui-style.css': renderProtoStyleEntryCss({
      themeImport: './shadcn-theme.css',
      tokensImport: './proto-ui-tokens.generated.css',
    }),
    'shadcn-theme.css': renderPrefixedThemeCss(SHADCN_THEME_CSS),
    'proto-ui-tokens.generated.css': renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS),
  }))
    writeFileSync(join(stylesDir, name), css);
  const { styles } = loadConsumerStyles(document, { root: directory });
  const element = document.createElement(button.name);
  element.className = 'consumer-owned';
  element.textContent = 'Consumer button';
  const arbitraryHeight = document.createElement('div');
  arbitraryHeight.setAttribute('data-pui-style', 'h-[1.15rem]');
  try {
    document.body.append(element, arbitraryHeight);
    await flush();
    // The full generated sheet includes Switch's arbitrary height. Both rules
    // must stay independent in the HappyDOM structural oracle: h-8 is still
    // 2rem/32px, never 1.15rem/18.4px from the unrelated selector.
    expect(document.defaultView!.getComputedStyle(arbitraryHeight).height).toBe('18.4px');
    assertStyledButton(element, 'source Web Component');
    expect(element.className).toBe('consumer-owned');
    expect(element.textContent).toBe('Consumer button');
    expect(element.getAttribute('tabindex')).toBe('0');
    setElementProps(element, { disabled: true });
    await flush();
    expect(element.getAttribute('aria-disabled')).toBe('true');
    // HappyDOM's tabIndex=-1 setter removes the attribute; assert the focus property.
    expect(element.tabIndex).toBe(-1);
    assertStyledButton(element, 'disabled Button still owns its paint');
    setElementProps(element, { disabled: false });
    await flush();
    expect(element.getAttribute('aria-disabled')).toBe('false');
    expect(element.getAttribute('tabindex')).toBe('0');
    assertStyledButton(element, 'restored Button');
  } finally {
    element.remove();
    arbitraryHeight.remove();
    for (const style of styles) style.remove();
    rmSync(directory, { recursive: true, force: true });
    await flush();
  }
});
