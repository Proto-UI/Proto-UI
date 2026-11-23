import type { APIRoute } from 'astro';
import { prepareBrowserAssets } from '../../../../../scripts/compiler/browser-assets';

export const prerender = true;
export async function getStaticPaths() {
  const assets = await prepareBrowserAssets();
  return [...assets.keys()].map((asset) => ({ params: { asset } }));
}
export const GET: APIRoute = async ({ params }) => {
  const asset = (await prepareBrowserAssets()).get(params.asset ?? '');
  if (!asset) return new Response('Unknown compiler asset', { status: 404 });
  return new Response(asset, {
    headers: {
      'Content-Type': params.asset?.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : 'application/json; charset=utf-8',
    },
  });
};
