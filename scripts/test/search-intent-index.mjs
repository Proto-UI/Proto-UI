// Read-only, Node-built-in-only evidence for the native-index Search A/B probe.
// This never rewrites an index, HTML, result URL, or the measured service.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const MAGIC = Buffer.from('pagefind_dcd');
const VERSION = '1.4.0';
const LOCAL_ORIGIN = 'https://search-index.invalid';

async function filesBelow(root, relative = '') {
  assert.ok(
    (await lstat(path.join(root, relative))).isDirectory(),
    'Index must be a real directory'
  );
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Index symlink is not evidence: ${name}`);
    if (entry.isDirectory()) files.push(...(await filesBelow(root, name)));
    else {
      assert.ok(entry.isFile(), `Non-file index entry: ${name}`);
      files.push(name);
    }
  }
  return files.sort();
}

async function readIndex(dist) {
  const root = path.join(dist, 'pagefind');
  const files = new Map();
  const manifest = {};
  for (const name of await filesBelow(root)) {
    const bytes = await readFile(path.join(root, name));
    files.set(name, bytes);
    manifest[name] = { sha256: sha256(bytes), bytes: bytes.length };
  }
  assert.ok(files.has('pagefind.js'), 'Real Pagefind runtime is required');
  assert.ok(
    [...files.keys()].some((name) => name.endsWith('.pf_index')),
    'Real index shards are required'
  );
  assert.ok(
    [...files.keys()].some((name) => /^wasm\.[a-z-]+\.pagefind$/.test(name)),
    'Real Pagefind WASM is required'
  );
  assert.ok(files.has('pagefind-entry.json'), 'Pagefind entry metadata is required');
  return { root, files, manifest };
}

function unpack(bytes, name) {
  const body = gunzipSync(bytes);
  assert.ok(body.subarray(0, MAGIC.length).equals(MAGIC), `Unknown Pagefind payload: ${name}`);
  return body.subarray(MAGIC.length);
}

// The pinned 1.4.0 metadata uses definite-length arrays, UTF-8 text and unsigned
// integers. Reject extensions rather than silently normalizing a new format.
function decodeMetadata(bytes, name) {
  const body = unpack(bytes, name);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let offset = 0;
  const take = (size) => {
    assert.ok(offset + size <= body.length, `Truncated metadata: ${name}`);
    const value = body.subarray(offset, offset + size);
    offset += size;
    return value;
  };
  function decode(depth = 0) {
    assert.ok(depth < 20, `Unexpected metadata nesting: ${name}`);
    const header = take(1)[0];
    const major = header >> 5;
    let size = header & 31;
    if (size === 24) size = take(1)[0];
    else if (size === 25) size = take(2).readUInt16BE();
    else if (size === 26) size = take(4).readUInt32BE();
    else assert.ok(size < 24, `Unsupported metadata length: ${name}`);
    if (major === 0) return size;
    if (major === 3) return decoder.decode(take(size));
    if (major === 4) {
      assert.ok(size <= body.length - offset, `Impossible metadata array: ${name}`);
      return Array.from({ length: size }, () => decode(depth + 1));
    }
    assert.fail(`Unsupported Pagefind metadata type ${major}: ${name}`);
  }
  const result = decode();
  assert.equal(offset, body.length, `Trailing metadata bytes: ${name}`);
  assert.ok(Array.isArray(result) && result.length === 5, `Unexpected metadata shape: ${name}`);
  assert.equal(result[0], VERSION, `Unexpected metadata version: ${name}`);
  assert.ok(result.slice(1).every(Array.isArray), `Unexpected metadata arrays: ${name}`);
  return result;
}

function corpus(index) {
  const byUrl = new Map();
  const byId = new Map();
  for (const [file, bytes] of index.files) {
    if (!file.endsWith('.pf_fragment')) continue;
    assert.match(file, /^fragment\/[a-z-]+_[a-f0-9]+\.pf_fragment$/, 'Unexpected fragment path');
    const fragment = JSON.parse(unpack(bytes, file).toString('utf8'));
    assert.equal(typeof fragment.url, 'string', `Missing fragment URL: ${file}`);
    assert.ok(Array.isArray(fragment.anchors), `Missing anchors: ${file}`);
    assert.ok(!byUrl.has(fragment.url), `Duplicate fragment URL: ${fragment.url}`);
    const id = path.posix.basename(file, '.pf_fragment');
    const value = { file, id, fragment };
    byUrl.set(fragment.url, value);
    byId.set(id, value);
  }
  assert.ok(byUrl.size > 0, 'A nonempty fragment corpus is required');
  return { byUrl, byId };
}

function normalizedEntry(index, fragments) {
  const entry = JSON.parse(index.files.get('pagefind-entry.json').toString('utf8'));
  assert.equal(entry.version, VERSION, 'Pagefind version must remain pinned');
  assert.ok(entry.languages && typeof entry.languages === 'object', 'Missing languages');
  const metadata = {};
  const consumed = new Set();
  const metaFiles = [];
  for (const [language, options] of Object.entries(entry.languages)) {
    assert.match(language, /^[a-z]+(?:-[a-z]+)*$/, 'Unexpected language');
    assert.equal(typeof options.hash, 'string', 'Missing language metadata hash');
    assert.match(options.hash, new RegExp(`^${language}_[a-f0-9]+$`), 'Unexpected metadata hash');
    const file = `pagefind.${options.hash}.pf_meta`;
    assert.ok(index.files.has(file), `Missing referenced metadata: ${file}`);
    const value = decodeMetadata(index.files.get(file), file);
    assert.equal(value[1].length, options.page_count, `Language page_count mismatch: ${language}`);
    value[1] = value[1].map((row) => {
      assert.ok(Array.isArray(row) && row.length === 2, `Unexpected metadata page row: ${file}`);
      const [id, count] = row;
      assert.equal(typeof id, 'string', `Unexpected metadata fragment reference: ${file}`);
      assert.ok(id.startsWith(language + '_'), `Wrong fragment language: ${id}`);
      assert.ok(!consumed.has(id), `Duplicate metadata fragment reference: ${id}`);
      const page = fragments.byId.get(id);
      assert.ok(page, `Missing referenced fragment: ${id}`);
      assert.equal(count, page.fragment.word_count, `Metadata word_count mismatch: ${id}`);
      consumed.add(id);
      return [page.fragment.url, count];
    });
    metadata[language] = value;
    metaFiles.push(file);
    delete options.hash;
  }
  assert.equal(
    consumed.size,
    fragments.byId.size,
    'Every fragment must be referenced exactly once'
  );
  assert.deepEqual(
    [...index.files.keys()].filter((file) => file.endsWith('.pf_meta')).sort(),
    metaFiles.sort(),
    'Unexpected unreferenced Pagefind metadata'
  );
  return { entry, metadata };
}

// Only the random segment may change. Stable slug/tab/host/file suffixes and the
// owning element are part of the class identity; future classes fail closed.
function randomIdClass(anchor) {
  const { element, id } = anchor;
  if (element === 'div' && /^pp-[a-z0-9]+-preview$/.test(id)) return 'preview';
  if (element === 'span' && /^adapter-select-label-[a-z0-9]+$/.test(id)) return 'adapter';
  if (element === 'figure' && /^install-command-[a-z0-9]+$/.test(id)) return 'install';
  const wiki = /^wiki-term-([a-z0-9]+(?:-[a-z0-9]+)*)-([a-z0-9]{8})(-card)?$/.exec(id);
  if (element === 'span' && wiki) return `wiki-term:${wiki[1]}:${wiki[3] ?? ''}`;
  const code = /^code-example-[a-z0-9]+-(host-(tab|panel)-\d+|\d+-file-(tab|panel)-\d+)$/.exec(id);
  if (code) {
    const expected = code[2] === 'panel' ? 'section' : code[3] === 'panel' ? 'figure' : 'button';
    if (element === expected) return `code-example:${code[1]}`;
  }
  return null;
}

export function compareFragments(baseline, candidate) {
  const a = structuredClone(baseline);
  const b = structuredClone(candidate);
  assert.ok(Array.isArray(a.anchors) && Array.isArray(b.anchors), 'Fragment anchors required');
  assert.equal(a.anchors.length, b.anchors.length, `Anchor count changed: ${a.url}`);
  const differences = [];
  for (let position = 0; position < a.anchors.length; position++) {
    const before = a.anchors[position];
    const after = b.anchors[position];
    if (before.id === after.id) continue;
    assert.ok(
      !/h\d/i.test(before.element) && !/h\d/i.test(after.element),
      `Heading ID changed: ${a.url}`
    );
    const kind = randomIdClass(before);
    assert.ok(
      kind && kind === randomIdClass(after),
      `Unapproved anchor ID class or suffix: ${a.url}`
    );
    differences.push({
      url: a.url,
      position,
      kind,
      before: before.id,
      after: after.id,
      element: before.element,
    });
    // Only id is normalized, only after matching the two proven owning classes.
    after.id = before.id;
  }
  assert.deepEqual(b, a, `Fragment semantic fields or anchor order changed: ${a.url}`);
  return differences;
}

function decodeAttribute(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z0-9]+);/gi, (whole, entity) => {
    if (entity[0] !== '#') {
      assert.ok(Object.hasOwn(named, entity), `Unsupported named entity in HTML id: ${whole}`);
      return named[entity];
    }
    const number =
      entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    assert.ok(
      number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff),
      'Invalid HTML id entity'
    );
    return String.fromCodePoint(number);
  });
}

// This is a conservative static ID inventory, not a general DOM implementation.
// Quoted attributes, comments, raw text/RCDATA and inert templates are handled;
// unsupported/malformed constructs fail closed. No dependencies or scripts run.
export function extractHtmlIds(html) {
  const ids = new Map();
  let cursor = 0;
  let templateDepth = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      assert.ok(end >= 0, 'Unclosed HTML comment');
      cursor = end + 3;
      continue;
    }
    if (/^<!doctype\s/i.test(html.slice(start, start + 11))) {
      const end = html.indexOf('>', start + 2);
      assert.ok(end >= 0, 'Unclosed HTML doctype');
      cursor = end + 1;
      continue;
    }
    const match = /^<(\/)?([a-z][a-z0-9:-]*)(?=[\s/>])/i.exec(html.slice(start));
    if (!match) {
      assert.ok(!/^<[!?]/.test(html.slice(start, start + 2)), 'Unsupported HTML declaration');
      cursor = start + 1;
      continue;
    }
    const closing = !!match[1];
    const tag = match[2].toLowerCase();
    let end = start + match[0].length;
    let quote = null;
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    assert.ok(end < html.length, 'Unclosed HTML tag');
    cursor = end + 1;
    if (closing) {
      if (tag === 'template') {
        assert.ok(templateDepth > 0, 'Unmatched HTML template');
        templateDepth--;
      }
      continue;
    }
    const attributes = html.slice(start + match[0].length, end);
    const attribute = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gy;
    let offset = 0;
    let id;
    while (offset < attributes.length) {
      if (/^\s*\/?\s*$/.test(attributes.slice(offset))) break;
      attribute.lastIndex = offset;
      const found = attribute.exec(attributes);
      assert.ok(found, 'Unsupported HTML attribute syntax');
      offset = attribute.lastIndex;
      if (found[1].toLowerCase() === 'id' && id === undefined)
        id = decodeAttribute(found[2] ?? found[3] ?? found[4] ?? '');
    }
    if (!templateDepth && id !== undefined) {
      if (!ids.has(id)) ids.set(id, new Set());
      ids.get(id).add(tag);
    }
    if (tag === 'template') templateDepth++;
    if (tag === 'plaintext') break;
    if (/^(script|style|textarea|title|xmp|iframe|noembed|noframes|noscript)$/.test(tag)) {
      const close = new RegExp(`</${tag}(?=[\\s/>])`, 'gi');
      close.lastIndex = cursor;
      const found = close.exec(html);
      assert.ok(found, `Unclosed HTML raw-text element: ${tag}`);
      cursor = found.index;
    }
  }
  assert.equal(templateDepth, 0, 'Unclosed HTML template');
  return ids;
}

function localUrl(href, origin) {
  assert.equal(typeof href, 'string', 'Result href must be a string');
  const url = new URL(href, origin);
  assert.equal(url.origin, new URL(origin).origin, `External result URL: ${href}`);
  assert.ok(!url.username && !url.password && !url.search, `Unexpected result URL fields: ${href}`);
  return url;
}

async function htmlFor(dist, url, cache) {
  const root = path.resolve(dist);
  const pathname = decodeURIComponent(url.pathname);
  assert.ok(!pathname.includes('\\') && !pathname.includes('\0'), 'Unsafe HTML path');
  let file = path.resolve(root, '.' + pathname);
  assert.ok(file === root || file.startsWith(root + path.sep), 'HTML path is outside dist');
  const info = await lstat(file);
  assert.ok(!info.isSymbolicLink(), 'HTML evidence cannot use symbolic links');
  if (info.isDirectory()) file = path.join(file, 'index.html');
  assert.equal(path.extname(file), '.html', 'Result must target an HTML page');
  const resolved = await realpath(file);
  assert.ok(resolved.startsWith((await realpath(root)) + path.sep), 'HTML target escapes dist');
  const key = resolved;
  if (!cache.has(key)) cache.set(key, extractHtmlIds(await readFile(file, 'utf8')));
  return cache.get(key);
}

function requireAnchor(ids, anchor, label) {
  assert.equal(typeof anchor.id, 'string', `Invalid anchor ID: ${label}`);
  assert.ok(
    ids.get(anchor.id)?.has(anchor.element.toLowerCase()),
    `Missing real HTML anchor ${anchor.id} (${anchor.element}): ${label}`
  );
}

export async function validateIndexPair(baselineDist, candidateDist) {
  const [a, b] = await Promise.all([readIndex(baselineDist), readIndex(candidateDist)]);
  const ca = corpus(a);
  const cb = corpus(b);
  assert.deepEqual(
    [...ca.byUrl.keys()].sort(),
    [...cb.byUrl.keys()].sort(),
    'Fragment URL corpus changed'
  );
  const allowedDerived = (file) =>
    file === 'pagefind-entry.json' || file.endsWith('.pf_meta') || file.endsWith('.pf_fragment');
  const stable = (index) =>
    Object.fromEntries(Object.entries(index.manifest).filter(([file]) => !allowedDerived(file)));
  assert.deepEqual(
    stable(a),
    stable(b),
    'Pagefind runtime, WASM, index shards or other static bytes changed'
  );
  assert.deepEqual(
    normalizedEntry(a, ca),
    normalizedEntry(b, cb),
    'Pagefind entry/metadata semantics or page ordering changed'
  );
  const differences = [];
  const cache = new Map();
  let stableHeadings = 0;
  let anchors = 0;
  const fragmentBytes = [];
  for (const [url, before] of ca.byUrl) {
    const after = cb.byUrl.get(url);
    const delta = compareFragments(before.fragment, after.fragment);
    differences.push(...delta);
    const parsed = localUrl(url, LOCAL_ORIGIN);
    const [idsA, idsB] = await Promise.all([
      htmlFor(baselineDist, parsed, cache),
      htmlFor(candidateDist, parsed, cache),
    ]);
    anchors += before.fragment.anchors.length;
    for (let i = 0; i < before.fragment.anchors.length; i++) {
      const anchor = before.fragment.anchors[i];
      // Pagefind's nonempty-heading predicate controls its sub-result URLs.
      if (/h\d/i.test(anchor.element)) {
        requireAnchor(idsA, anchor, `baseline ${url}`);
        requireAnchor(idsB, anchor, `candidate ${url}`);
        stableHeadings++;
      } else if (anchor.id !== after.fragment.anchors[i].id) {
        requireAnchor(idsA, anchor, `baseline ${url}`);
        requireAnchor(idsB, after.fragment.anchors[i], `candidate ${url}`);
      }
    }
    const left = a.manifest[before.file];
    const right = b.manifest[after.file];
    if (left.sha256 !== right.sha256)
      fragmentBytes.push({
        url,
        baseline: { path: before.file, ...left },
        candidate: { path: after.file, ...right },
        byteDelta: right.bytes - left.bytes,
      });
  }
  const byteChanges = [...new Set([...Object.keys(a.manifest), ...Object.keys(b.manifest)])]
    .sort()
    .filter((file) => a.manifest[file]?.sha256 !== b.manifest[file]?.sha256)
    .map((file) => ({
      path: file,
      baseline: a.manifest[file] ?? null,
      candidate: b.manifest[file] ?? null,
    }));
  const totalBytes = (manifest) =>
    Object.values(manifest).reduce((sum, file) => sum + file.bytes, 0);
  return {
    method: 'native HTML and native Pagefind index per build; no index rewriting or substitution',
    limitation:
      'Compressed fragment/metadata bytes can differ. Query and reopen timings retain this confound; no full-byte-equal or pure-causal claim.',
    pagefindVersion: VERSION,
    fragments: ca.byUrl.size,
    anchors,
    stableHeadings,
    changedFragmentUrls: fragmentBytes.length,
    changedAnchorIds: differences.length,
    idClasses: differences.reduce((counts, change) => {
      const kind = change.kind.split(':')[0];
      counts[kind] = (counts[kind] ?? 0) + 1;
      return counts;
    }, {}),
    runtimeWasmAndIndexBytesEqual: true,
    baseline: {
      indexRoot: a.root,
      manifest: a.manifest,
      manifestSha256: sha256(JSON.stringify(a.manifest)),
      totalBytes: totalBytes(a.manifest),
    },
    candidate: {
      indexRoot: b.root,
      manifest: b.manifest,
      manifestSha256: sha256(JSON.stringify(b.manifest)),
      totalBytes: totalBytes(b.manifest),
    },
    byteDelta: totalBytes(b.manifest) - totalBytes(a.manifest),
    byteChanges,
    fragmentBytes,
    differences,
  };
}

export async function validateResultLinks(links, origin, baselineDist, candidateDist) {
  assert.ok(Array.isArray(links) && links.length > 0, 'Actual result links are required');
  const cache = new Map();
  const checked = [];
  for (const link of links) {
    const href = typeof link === 'string' ? link : link.href;
    const url = localUrl(href, origin);
    const anchor = decodeURIComponent(url.hash.slice(1));
    for (const [variant, dist] of [
      ['baseline', baselineDist],
      ['candidate', candidateDist],
    ]) {
      const ids = await htmlFor(dist, url, cache);
      if (url.hash)
        assert.ok(
          ids.has(anchor),
          `Missing actual result anchor ${anchor}: ${variant} ${url.pathname}`
        );
    }
    checked.push({ pathname: url.pathname, hash: url.hash, existsInBoth: true });
  }
  return { checked: checked.length, links: checked };
}
