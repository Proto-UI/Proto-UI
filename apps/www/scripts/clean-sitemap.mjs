import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIR = new URL('../dist/', import.meta.url);
const ROOT_URL = 'https://www.proto-ui.com/';

async function cleanSitemapFile(filename) {
  const filePath = new URL(filename, DIST_DIR);
  const raw = await readFile(filePath, 'utf8');
  const cleaned = raw.replace(
    new RegExp(`<url><loc>${ROOT_URL.replaceAll('/', '\\/')}</loc>[\\s\\S]*?<\\/url>`, 'g'),
    (entry) => (entry.includes('<loc>https://www.proto-ui.com/</loc>') ? '' : entry)
  );

  if (cleaned !== raw) {
    await writeFile(filePath, cleaned, 'utf8');
    console.log(`[clean-sitemap] removed root redirect URL from ${filename}`);
  }
}

await cleanSitemapFile('sitemap-0.xml');
