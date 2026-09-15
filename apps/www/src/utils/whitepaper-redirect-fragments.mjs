import { readFile, writeFile } from 'node:fs/promises';

/**
 * Astro's static meta refresh drops fragments. Keep HTTP redirects in development,
 * and enhance their static HTML with a fragment-preserving replacement navigation.
 * @param {Record<string, string>} redirects
 * @returns {import('astro').AstroIntegration}
 */
export function whitepaperRedirectFragments(redirects) {
  return {
    name: 'whitepaper-redirect-fragments',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        for (const [source, target] of Object.entries(redirects)) {
          const file = new URL(`${source.slice(1)}/index.html`, dir);
          const html = await readFile(file, 'utf8');
          const refresh = /<meta http-equiv="refresh"[^>]*>/i;
          if (!refresh.test(html)) throw new Error(`Missing static redirect: ${source}`);
          const script = `<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>`;
          await writeFile(
            file,
            html.replace(refresh, (tag) => `${script}<noscript>${tag}</noscript>`)
          );
        }
      },
    },
  };
}
