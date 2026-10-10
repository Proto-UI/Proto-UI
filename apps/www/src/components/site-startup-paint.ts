import { shadcnButton } from '@proto.ui/prototypes-shadcn/button';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { ShadcnSurfaceRoot } from '@proto.ui/prototypes-shadcn/surface';
import { BrutalistSurfaceRoot } from '@proto.ui/prototypes-brutalist/surface';
import { createStyleSnapshotter, renderSnapshotTokenCss } from './snapshot-prototype-style';
import type { SiteLibraryFamily } from './site-library-family';

export const snapshotStartupStyle = createStyleSnapshotter(
  {
    'shadcn-button': shadcnButton,
    'brutalist-button': brutalistButton,
    'shadcn-surface': ShadcnSurfaceRoot,
    'brutalist-surface': BrutalistSurfaceRoot,
  },
  ['shadcn-button', 'brutalist-button']
);

export const startupButtonProps = (family: SiteLibraryFamily, size = 'icon') => ({
  variant: family === 'brutalist' ? 'surface' : 'ghost',
  size,
});

/** Surface snapshots contain only static paint declarations. Store those at
 * each family boundary as inherited inputs, so the nearest scope wins exactly
 * as runtimePreviewFamily does, including overrides on the surface itself. */
export async function codeStartupPaintCss() {
  const output: string[] = [];
  for (const family of ['shadcn', 'brutalist'] as const) {
    const scope =
      family === 'shadcn'
        ? ":root, [data-site-library-family='shadcn']:not([data-projection-family='brutalist']), [data-projection-family='shadcn']"
        : "[data-site-library-family='brutalist']:not([data-projection-family='shadcn']), [data-projection-family='brutalist'], .brutalist-demo-frame:not([data-projection-family='shadcn']):not([data-site-library-family='shadcn'])";
    for (const part of ['frame', 'toolbar'] as const) {
      const tokens = await snapshotStartupStyle(`${family}-surface`, {
        variant: part === 'toolbar' ? 'transparent' : family === 'shadcn' ? 'muted' : 'outline',
        radius: part === 'toolbar' ? 'none' : 'default',
        border: part === 'toolbar' ? 'bottom' : 'all',
        elevation: 'none',
      });
      const declarations = staticSurfaceDeclarations(tokens);
      const variables = Object.entries(declarations).map(([property, raw]) => {
        // Runtime's Brutalist projection resolves these exact family inputs.
        const value = family === 'brutalist' ? raw.replaceAll('--pui-', '--site-brutalist-') : raw;
        return `--site-startup-code-${part}-${property}: ${value};`;
      });
      output.push(`${scope} { ${variables.join(' ')} }`);
      const paint = Object.keys(declarations).map(
        (property) => `${property}: var(--site-startup-code-${part}-${property});`
      );
      output.push(`[data-site-code-surface='${part}']::before { ${paint.join(' ')} }`);
    }
  }
  return output.join('\n');
}

function staticSurfaceDeclarations(tokens: string[]): Record<string, string> {
  const css = renderSnapshotTokenCss(tokens);
  const declarations: Record<string, string> = {};
  const body = css.replace(/^@layer proto-ui \{/, '').replace(/}\s*$/, '');
  const remainder = body.replace(
    /:where\(\[data-pui-style~="(?:\\.|[^"\\])*"\]\)\s*\{([^}]*)}/g,
    (_rule, block: string) => {
      for (const declaration of block.split(';')) {
        if (!declaration.trim()) continue;
        const colon = declaration.indexOf(':');
        const property = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();
        if (
          !/^(?:background-color|color|border-(?:color|radius|width|style|(?:top|right|bottom|left)-(?:width|style)))$/.test(
            property
          )
        )
          throw new Error(`Unsupported static Surface paint: ${property}`);
        declarations[property] = value;
      }
      return '';
    }
  );
  if (remainder.trim()) throw new Error('Static Surface snapshot must not contain dynamic CSS');
  return declarations;
}
