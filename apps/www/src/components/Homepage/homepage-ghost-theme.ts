import { THEME as BOOTSTRAP_THEME } from '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme';
import { BRUTALIST_THEME } from '../../../../../packages/prototypes/brutalist/src/theme';

// Same public token banks as projection-theme.ts. These passive SSR hosts live
// outside a projection generation, so they must not inherit the document's
// intentionally Shadcn-only --pui-* bank when another family is selected.
export function homepageGhostThemeCss(): string {
  const declarations = (mode: Readonly<Record<string, string>>) =>
    Object.entries(mode).map(([name, value]) => `--pui-${name}:${value};`).join('');
  return Object.entries({ brutalist: BRUTALIST_THEME, 'bootstrap-2-3-2': BOOTSTRAP_THEME })
    .map(([family, palette]) => {
      const host = `[data-home-ghost-theme="${family}"]`;
      const dark = declarations(palette.dark);
      return `${host}{${declarations(palette.light)}}\n`
        + `html.dark ${host},html[data-theme="dark"] ${host}{${dark}}\n`
        + `@media(prefers-color-scheme:dark){html:not(.light):not(.dark):not([data-theme="light"]):not([data-theme="dark"]) ${host}{${dark}}}`;
    })
    .join('\n');
}
