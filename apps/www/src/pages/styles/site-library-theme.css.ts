import { renderBrutalistThemeCss } from '../../../../../packages/prototypes/brutalist/src/theme';

export function GET() {
  // Keep the canonical Website Shadcn --pui-* input intact while another family
  // is active. Projection candidates can therefore prepare either family safely.
  const themeCss = [
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
