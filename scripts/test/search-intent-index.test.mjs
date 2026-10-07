import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  compareFragments,
  extractHtmlIds,
  validateIndexPair,
  validateResultLinks,
} from './search-intent-index.mjs';

const origin = 'http://127.0.0.1:9000';
const url = '/zh-cn/ui-libraries/shadcn/button/';
const anchor = (element, id, text = '', location = 1) => ({ element, id, text, location });
const fragment = (nonce = 'abc12345') => ({
  url,
  content: 'Button content exactly the same',
  word_count: 6,
  filters: {},
  meta: { title: 'Button' },
  anchors: [
    anchor('h1', '_top', 'Button', 0),
    anchor('h2', 'usage', 'Usage', 1),
    anchor('div', `pp-${nonce}-preview`),
    anchor('span', `adapter-select-label-${nonce}`, 'Choose adapter'),
    anchor('button', `code-example-${nonce}-host-tab-0`, 'Web Components'),
    anchor('section', `code-example-${nonce}-host-panel-0`),
    anchor('button', `code-example-${nonce}-0-file-tab-1`, 'Button.vue'),
    anchor('figure', `code-example-${nonce}-0-file-panel-1`),
    anchor('span', `wiki-term-style-tokens-${nonce}`, 'Style tokens'),
    anchor('span', `wiki-term-style-tokens-${nonce}-card`, 'Style tokens'),
    anchor('figure', `install-command-${nonce}`),
    anchor('wc-shadcn-select-root', 'adapter-select'),
  ],
});
const pair = () => [fragment(), fragment('def67890')];
const packed = (body) => gzipSync(Buffer.concat([Buffer.from('pagefind_dcd'), body]));
const packedFragment = (value) => packed(Buffer.from(JSON.stringify(value)));

// A small independent fixture writer for the pinned definite-length CBOR shape.
function cbor(value) {
  function prefix(major, length) {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    const bytes = Buffer.alloc(3);
    bytes[0] = (major << 5) | 25;
    bytes.writeUInt16BE(length, 1);
    return bytes;
  }
  if (typeof value === 'number') return prefix(0, value);
  if (typeof value === 'string') {
    const text = Buffer.from(value);
    return Buffer.concat([prefix(3, text.length), text]);
  }
  if (Array.isArray(value)) return Buffer.concat([prefix(4, value.length), ...value.map(cbor)]);
  throw Error('Unsupported test fixture type');
}
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const html = (value) =>
  '<!doctype html><html><body>' +
  value.anchors.map((a) => `<${a.element} id="${escape(a.id)}">${a.text}</${a.element}>`).join('') +
  '</body></html>';

async function fixture(t, configure = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'search-native-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const variants = [];
  for (const [index, name] of ['baseline', 'candidate'].entries()) {
    const dist = path.join(root, name);
    const value = fragment(index ? 'def67890' : 'abc12345');
    const id = index ? 'zh-cn_bbbbbbb' : 'zh-cn_aaaaaaa';
    const metaId = index ? 'zh-cn_bbbbbb' : 'zh-cn_aaaaaa';
    const entry = {
      version: '1.4.0',
      languages: { 'zh-cn': { hash: metaId, wasm: null, page_count: 1 } },
      include_characters: ['_'],
    };
    const metadata = ['1.4.0', [[id, value.word_count]], [['a', 'z', 'zh-cn_abcdef0']], [], []];
    const setup = { name, dist, value, id, metaId, entry, metadata, html: null };
    configure(setup);
    const files = {
      'pagefind.js': '/* pinned fixture runtime; never executed */',
      'wasm.unknown.pagefind': Buffer.from([0, 97, 115, 109]),
      'index/zh-cn_abcdef0.pf_index': 'same exact index shard bytes',
      [`fragment/${id}.pf_fragment`]: packedFragment(value),
      [`pagefind.${metaId}.pf_meta`]: packed(cbor(metadata)),
      'pagefind-entry.json': JSON.stringify(entry),
    };
    for (const [file, bytes] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dist, 'pagefind', file)), { recursive: true });
      await writeFile(path.join(dist, 'pagefind', file), bytes);
    }
    await mkdir(path.join(dist, url), { recursive: true });
    await writeFile(path.join(dist, url, 'index.html'), setup.html ?? html(value));
    variants.push(setup);
  }
  return { root, a: variants[0], b: variants[1] };
}

test('only the five demonstrated nonheading random-ID classes compare equal', () => {
  const [a, b] = pair();
  const before = structuredClone([a, b]);
  const changes = compareFragments(a, b);
  assert.equal(changes.length, 9);
  assert.deepEqual(
    new Set(changes.map((x) => x.kind.split(':')[0])),
    new Set(['preview', 'adapter', 'code-example', 'wiki-term', 'install'])
  );
  assert.deepEqual([a, b], before, 'Comparison must not mutate either native fragment');
  assert.deepEqual(compareFragments(a, a), []);
});

for (const [name, mutate] of [
  [
    'content',
    (b) => {
      b.content += ' drift';
    },
  ],
  [
    'URL',
    (b) => {
      b.url = '/changed/';
    },
  ],
  [
    'word count',
    (b) => {
      b.word_count++;
    },
  ],
  [
    'filters',
    (b) => {
      b.filters.type = ['changed'];
    },
  ],
  [
    'title metadata',
    (b) => {
      b.meta.title = 'Another title';
    },
  ],
  [
    'new metadata',
    (b) => {
      b.meta.extra = 'drift';
    },
  ],
  [
    'unknown fragment field',
    (b) => {
      b.extra = true;
    },
  ],
  [
    'anchor count',
    (b) => {
      b.anchors.pop();
    },
  ],
  [
    'anchor order',
    (b) => {
      [b.anchors[2], b.anchors[3]] = [b.anchors[3], b.anchors[2]];
    },
  ],
  [
    'anchor text',
    (b) => {
      b.anchors[2].text = 'drift';
    },
  ],
  [
    'anchor location',
    (b) => {
      b.anchors[2].location++;
    },
  ],
  [
    'anchor element',
    (b) => {
      b.anchors[2].element = 'span';
    },
  ],
  [
    'anchor field',
    (b) => {
      b.anchors[2].extra = 1;
    },
  ],
  [
    'heading ID',
    (b) => {
      b.anchors[1].id = 'usage-new';
    },
  ],
  [
    'heading text',
    (b) => {
      b.anchors[1].text = 'Changed usage';
    },
  ],
  [
    'unknown random ID class',
    (b) => {
      b.anchors[2].id = 'future-random-12345678';
    },
  ],
  [
    'code host suffix',
    (b) => {
      b.anchors[4].id = 'code-example-def67890-host-tab-1';
    },
  ],
  [
    'code file suffix',
    (b) => {
      b.anchors[6].id = 'code-example-def67890-1-file-tab-1';
    },
  ],
  [
    'wiki slug',
    (b) => {
      b.anchors[8].id = 'wiki-term-new-slug-def67890';
    },
  ],
  [
    'wiki card suffix',
    (b) => {
      b.anchors[8].id += '-card';
    },
  ],
  [
    'wiki random length',
    (b) => {
      b.anchors[8].id = 'wiki-term-style-tokens-random';
    },
  ],
  [
    'stable nonheading ID',
    (b) => {
      b.anchors[11].id = 'adapter-select-new';
    },
  ],
]) {
  test(`rejects ${name} drift while random IDs also differ`, () => {
    const [a, b] = pair();
    mutate(b);
    assert.throws(() => compareFragments(a, b));
  });
}

test('a random-looking ID on a heading never qualifies', () => {
  const [a, b] = pair();
  a.anchors[2].element = b.anchors[2].element = 'h2';
  assert.throws(() => compareFragments(a, b), /Heading ID changed/);
});

test('static HTML inventory handles real attributes and excludes comments, script strings and templates', () => {
  const ids = extractHtmlIds(`<!doctype html><html><body>
    <!-- <h2 id="comment-fake">Fake</h2> -->
    <script>const string = '<h2 id="script-fake">';</script>
    <style>.x { content: '<h2 id="style-fake">'; }</style>
    <textarea><h2 id="textarea-fake"></textarea>
    <title><h2 id="title-fake"></title>
    <noscript><h2 id="noscript-fake"></h2></noscript>
    <div data-example='<h2 id="attribute-fake">' id = "real&gt;value"></div>
    <DIV ID='upper' id='ignored-duplicate'></DIV><h2 id=unquoted>Title</h2>
    <h2 id="&#x4e2d;&#25991;">中文</h2><h3 id="amp&amp;quote&quot;">Title</h3>
    <template id="template-element"><h2 id="template-fake"></h2>
      <template><h2 id="nested-fake"></h2></template><script>'</template>'</script>
    </template><h2 id="after-template"></h2>
  </body></html>`);
  assert.deepEqual(
    [...ids.keys()],
    ['real>value', 'upper', 'unquoted', '中文', 'amp&quote"', 'template-element', 'after-template']
  );
  assert.ok(ids.get('upper').has('div'));
  assert.ok(ids.get('中文').has('h2'));
});

test('malformed HTML and unsupported ID entities fail closed', () => {
  for (const body of [
    '<!-- missing end',
    '<h2 id="unclosed>',
    '<script>unclosed',
    '<template>',
    '</template>',
    '<![CDATA[<h2 id="fake">]]>',
    '<h2 id="&unsupported;">',
  ]) {
    assert.throws(() => extractHtmlIds(body));
  }
});

test('valid native indexes retain distinct compressed bytes and complete manifests', async (t) => {
  const { a, b } = await fixture(t);
  const original = await readFile(path.join(a.dist, 'pagefind', `fragment/${a.id}.pf_fragment`));
  const evidence = await validateIndexPair(a.dist, b.dist);
  assert.equal(evidence.fragments, 1);
  assert.equal(evidence.anchors, 12);
  assert.equal(evidence.stableHeadings, 2);
  assert.equal(evidence.changedAnchorIds, 9);
  assert.equal(evidence.changedFragmentUrls, 1);
  assert.equal(evidence.runtimeWasmAndIndexBytesEqual, true);
  assert.notEqual(evidence.baseline.manifestSha256, evidence.candidate.manifestSha256);
  assert.equal(Object.keys(evidence.baseline.manifest).length, 6);
  assert.equal(evidence.fragmentBytes.length, 1);
  assert.ok(evidence.byteChanges.length >= 5);
  assert.match(evidence.limitation, /confound/);
  assert.equal(evidence.byteDelta, evidence.candidate.totalBytes - evidence.baseline.totalBytes);
  assert.deepEqual(
    await readFile(path.join(a.dist, 'pagefind', `fragment/${a.id}.pf_fragment`)),
    original
  );
});

for (const file of ['pagefind.js', 'wasm.unknown.pagefind', 'index/zh-cn_abcdef0.pf_index']) {
  test(`rejects byte drift in ${file}`, async (t) => {
    const { a, b } = await fixture(t);
    await writeFile(path.join(b.dist, 'pagefind', file), 'changed');
    await assert.rejects(validateIndexPair(a.dist, b.dist), /static bytes changed/);
  });
}

for (const [name, mutate, message] of [
  [
    'page count',
    (s) => {
      s.entry.languages['zh-cn'].page_count = 2;
    },
    /page_count mismatch/,
  ],
  [
    'entry options',
    (s) => {
      s.entry.include_characters.push('-');
    },
    /entry\/metadata semantics/,
  ],
  [
    'metadata shard',
    (s) => {
      s.metadata[2][0][2] = 'zh-cn_9999999';
    },
    /entry\/metadata semantics/,
  ],
  [
    'metadata word count',
    (s) => {
      s.metadata[1][0][1]++;
    },
    /word_count mismatch/,
  ],
  [
    'metadata missing fragment',
    (s) => {
      s.metadata[1][0][0] = 'zh-cn_9999999';
    },
    /Missing referenced fragment/,
  ],
  [
    'new Pagefind version',
    (s) => {
      s.entry.version = '1.5.0';
    },
    /version must remain pinned/,
  ],
]) {
  test(`rejects ${name}`, async (t) => {
    const { a, b } = await fixture(t, (s) => {
      if (s.name === 'candidate') mutate(s);
    });
    await assert.rejects(validateIndexPair(a.dist, b.dist), message);
  });
}

test('metadata page order cannot silently reorder unchanged fragments', async (t) => {
  const { a, b } = await fixture(t);
  for (const s of [a, b]) {
    const second = { ...fragment(), url: '/second/' };
    const id = 'zh-cn_ccccccc';
    s.entry.languages['zh-cn'].page_count++;
    s.metadata[1].push([id, second.word_count]);
    if (s.name === 'candidate') s.metadata[1].reverse();
    await writeFile(
      path.join(s.dist, 'pagefind', `fragment/${id}.pf_fragment`),
      packedFragment(second)
    );
    await writeFile(
      path.join(s.dist, 'pagefind', `pagefind.${s.metaId}.pf_meta`),
      packed(cbor(s.metadata))
    );
    await writeFile(path.join(s.dist, 'pagefind/pagefind-entry.json'), JSON.stringify(s.entry));
  }
  await assert.rejects(validateIndexPair(a.dist, b.dist), /page ordering changed/);
});

test('missing or extra fragment and unreferenced metadata fail', async (t) => {
  const f = await fixture(t);
  await writeFile(
    path.join(f.b.dist, 'pagefind/fragment/zh-cn_ddddddd.pf_fragment'),
    packedFragment({ ...fragment(), url: '/new-page/' })
  );
  await assert.rejects(validateIndexPair(f.a.dist, f.b.dist), /corpus changed/);
  const g = await fixture(t);
  await writeFile(
    path.join(g.b.dist, 'pagefind/pagefind.zh-cn_dddddd.pf_meta'),
    packed(cbor(g.b.metadata))
  );
  await assert.rejects(validateIndexPair(g.a.dist, g.b.dist), /unreferenced Pagefind metadata/);
});

test('symlinked index files are not accepted as original build evidence', async (t) => {
  const { a, b } = await fixture(t);
  const file = path.join(b.dist, 'pagefind/pagefind.js');
  await rm(file);
  await symlink(path.join(a.dist, 'pagefind/pagefind.js'), file);
  await assert.rejects(validateIndexPair(a.dist, b.dist), /symlink/);
});

for (const variant of ['baseline', 'candidate']) {
  for (const [name, target] of [
    ['heading', 'usage'],
    ['changed random ID', null],
  ]) {
    test(`missing ${name} in ${variant} HTML fails even if mentioned in a script/comment`, async (t) => {
      const { a, b } = await fixture(t, (s) => {
        if (s.name !== variant) return;
        const id = target ?? s.value.anchors[2].id;
        s.html =
          html(s.value).replace(`id="${id}"`, `data-old-id="${id}"`) +
          `<!-- <h2 id="${id}"> --><script>const fake = '<div id="${id}">';</script>`;
      });
      await assert.rejects(validateIndexPair(a.dist, b.dist), /Missing real HTML anchor/);
    });
  }
}

test('same ID on a different element cannot prove its indexed heading', async (t) => {
  const { a, b } = await fixture(t, (s) => {
    if (s.name === 'candidate')
      s.html = html(s.value).replace('<h2 id="usage">Usage</h2>', '<div id="usage">Usage</div>');
  });
  await assert.rejects(validateIndexPair(a.dist, b.dist), /Missing real HTML anchor usage/);
});

test('checks every actual result and sub-result page/anchor in both native HTML trees', async (t) => {
  const { a, b } = await fixture(t);
  const result = await validateResultLinks(
    [url, { href: origin + url + '#usage' }, url + '#_top'],
    origin,
    a.dist,
    b.dist
  );
  assert.equal(result.checked, 3);
  assert.ok(result.links.every((x) => x.existsInBoth));
  await assert.rejects(
    validateResultLinks([url, url + '#missing'], origin, a.dist, b.dist),
    /Missing actual result anchor/
  );
  // A generated ID exists only in its own page, so it is never a valid common result target.
  await assert.rejects(
    validateResultLinks([url + '#pp-abc12345-preview'], origin, a.dist, b.dist),
    /candidate/
  );
});

test('actual result target missing only from baseline is rejected', async (t) => {
  const { a, b } = await fixture(t, (s) => {
    if (s.name === 'baseline') s.html = html(s.value).replace('id="usage"', 'data-id="usage"');
  });
  await assert.rejects(validateResultLinks([url + '#usage'], origin, a.dist, b.dist), /baseline/);
});

test('result checks reject empty, external, non-HTML, missing, traversal and malformed targets', async (t) => {
  const { a, b } = await fixture(t);
  for (const links of [
    [],
    ['https://other.invalid' + url],
    ['/missing/'],
    ['/pagefind/pagefind.js'],
    ['/..%2f..%2fsecret.html'],
    [url + '?other=1'],
    [url + '#%zz'],
    [url + '#:~:text=Button'],
  ]) {
    await assert.rejects(validateResultLinks(links, origin, a.dist, b.dist));
  }
});

test('result URL percent escapes resolve real Unicode HTML IDs', async (t) => {
  const { a, b } = await fixture(t, (s) => {
    s.html = html(s.value) + '<h2 id="中文">Title</h2>';
  });
  const result = await validateResultLinks([url + '#%E4%B8%AD%E6%96%87'], origin, a.dist, b.dist);
  assert.equal(result.checked, 1);
});
