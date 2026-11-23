import type { APIRoute } from 'astro';
import {
  browserSourceRegistrations,
  readBrowserSource,
} from '../../../../../../scripts/compiler/browser-assets';

export const prerender = true;
export async function getStaticPaths() {
  return (await browserSourceRegistrations())
    .filter((row) => row.entry)
    .map((row) => ({ params: { id: row.id } }));
}
export const GET: APIRoute = async ({ params }) => {
  try {
    return new Response(JSON.stringify(await readBrowserSource(params.id ?? '')), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    // Retain an explicit source-closure failure; never silently serve another prototype.
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
