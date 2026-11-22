import assert from 'node:assert/strict';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileHash, readJson, writeJson } from './common.mjs';

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    assert.equal(lstatSync(file).isSymbolicLink(), false, `Asset/capture symlink rejected: ${file}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
export function archiveProductionAssets(repo, output, source, origin) {
  const assets = path.join(repo, 'apps/www/dist/_astro');
  const target = path.join(output, 'production-assets');
  mkdirSync(target, { recursive: true });
  const entries = [];
  for (const file of walk(assets).filter((file) => /\.(?:m?js|map)$/.test(file))) {
    const relative = path.relative(assets, file);
    const archived = path.join(target, '_astro', relative);
    mkdirSync(path.dirname(archived), { recursive: true });
    copyFileSync(file, archived);
    const urlPath = `/_astro/${relative.split(path.sep).join('/')}`;
    entries.push({ urlPath, expectedPreviewUrl: `http://127.0.0.1:4397${urlPath}`,
      artifactPath: path.relative(output, archived).split(path.sep).join('/'),
      bytes: readFileSync(file).length, sha256: fileHash(file) });
  }
  const byPath = new Map(entries.map((entry) => [entry.urlPath, entry]));
  const captures = path.join(output, 'search-production/homepage-evidence/search-production');
  const profiles = [];
  for (const file of walk(captures).filter((file) => file.endsWith('-cpu-profile.json'))) {
    const urls = [...new Set((readJson(file).nodes ?? []).map((node) => node.callFrame?.url).filter(Boolean))];
    profiles.push({ profile: path.relative(output, file).split(path.sep).join('/'), sha256: fileHash(file),
      frames: urls.map((url) => {
        let key = null;
        try { key = new URL(url).pathname; } catch {}
        const asset = byPath.get(key);
        return { observedUrl: url, urlPath: key, asset: asset?.artifactPath ?? null,
          sha256: asset?.sha256 ?? null, mapping: asset ? 'archived-byte-match-by-url-path' : 'not-a-mapped-build-asset' };
      }) });
  }
  const index = { schemaVersion: 1, source, origin, diagnosticOnly: true, formalAcceptance: false,
    copiedAt: new Date().toISOString(), expectedPreviewOrigin: 'http://127.0.0.1:4397',
    boundary: 'Expected origin is the unchanged production producer port; actual CPU frame URLs are separately retained. No asset URL is fetched.',
    distPresent: existsSync(assets), entries, profiles };
  writeJson(path.join(target, 'index.json'), index);
  return { assets: entries.length, profiles: profiles.length, index: path.join(target, 'index.json'),
    indexSha256: fileHash(path.join(target, 'index.json')) };
}
