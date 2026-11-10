import { renderThemeCss as renderBootstrapThemeCss } from '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme';
import { renderBrutalistThemeCss } from '../../../../../packages/prototypes/brutalist/src/theme';
import { SHADCN_TYPOGRAPHY } from '../../../../../packages/prototypes/shadcn/src/text/typography';

export function GET() {
  // Keep the canonical Website Shadcn --pui-* input intact while another family
  // is active. Projection candidates can therefore prepare either family safely.
  const themeCss = [
    // A separate bank survives a retained non-Shadcn ancestor while the next
    // Shadcn generation stages. This does not paint the whole document.
    `:root {\n${Object.entries(SHADCN_TYPOGRAPHY)
      .map(([name, value]) => `  --site-shadcn-${name}: ${value};`)
      .join('\n')}\n}`,
    renderBootstrapThemeCss({
      variablePrefix: 'site-bootstrap-',
      lightSelector: ':root',
      darkSelector: ":root.dark, :root[data-theme='dark']",
    }),
    renderBrutalistThemeCss({
      variablePrefix: 'site-brutalist-',
      includeSelection: false,
      lightSelector: ':root',
      darkSelector: ":root.dark, :root[data-theme='dark']",
    }),
    renderBrutalistThemeCss({
      variablePrefix: 'pui-',
      lightSelector: "[data-site-control-family='brutalist']",
      darkSelector:
        ":root.dark [data-site-control-family='brutalist'], :root[data-theme='dark'] [data-site-control-family='brutalist']",
    }),
  ].join('\n');
  return new Response(themeCss, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
