import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, test } from 'node:test';
import { createProcessor as createMarkdownProcessor } from '@mdx-js/mdx';
import { parse as parseHtml, parseFragment as parseHtmlFragment, defaultTreeAdapter } from 'parse5';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MATRIX_CONFIGS,
  boundedPackageGlobTargets,
  promotionBarePackageTargets,
  createScriptSpecifierCache,
  collectCoverageMatrixIssues,
  validateCoverageMatrices,
} from '../check-coverage-matrices.mjs';

const temporaryRoots = [];

for (const mode of ['file', 'directory', 'ancestor-directory']) {
  test(`resource closure review: rejects retargeted ${mode} symlink assets`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const directory = path.dirname(path.join(root, implementationPath));
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    const suffix = mode === 'ancestor-directory' ? 'nested/surface.bin' : 'surface.bin';
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      "---\nimport './surface.css';\n---\n<main>Search</main>"
    );
    fs.writeFileSync(
      path.join(directory, 'surface.css'),
      `.surface{background:url(./${mode === 'file' ? 'surface.bin' : `assets/${suffix}`})}`
    );
    const before = mode === 'file' ? 'before.bin' : 'before-assets';
    const after = mode === 'file' ? 'after.bin' : 'after-assets';
    const beforeFile = mode === 'file' ? before : `${before}/${suffix}`;
    const afterFile = mode === 'file' ? after : `${after}/${suffix}`;
    for (const [filename, bytes] of [
      [beforeFile, [0, 128, 255]],
      [afterFile, [0, 129, 255]],
    ]) {
      fs.mkdirSync(path.dirname(path.join(directory, filename)), { recursive: true });
      fs.writeFileSync(path.join(directory, filename), Buffer.from(bytes));
    }
    const link = path.join(directory, mode === 'file' ? 'surface.bin' : 'assets');
    fs.symlinkSync(before, link, mode === 'file' ? 'file' : 'dir');
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    fs.unlinkSync(link);
    fs.symlinkSync(after, link, mode === 'file' ? 'file' : 'dir');
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promotion CSS resource.*symlink.*unverified/
    );
  });
}

test('resource closure review: regular nested assets preserve unchanged and changed controls', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const directory = path.dirname(path.join(root, implementationPath));
  const asset = path.join(directory, 'assets/nested/surface.bin');
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(asset), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    "---\nimport './surface.css';\n---\n<main>Search</main>"
  );
  fs.writeFileSync(
    path.join(directory, 'surface.css'),
    '.surface{background:url(./assets/nested/surface.bin)}'
  );
  fs.writeFileSync(asset, Buffer.from([0, 128, 255]));
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.doesNotThrow(() =>
    validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
  );
  fs.writeFileSync(asset, Buffer.from([0, 129, 255]));
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted dependency.*surface\.bin.*differs from evidence Commit/
  );
});

for (const embedded of [false, true]) {
  test(`resource closure review: rejects raw CSS NUL before ${embedded ? 'embedded' : 'stylesheet'} URL normalization`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const directory = path.dirname(path.join(root, implementationPath));
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    const style = '.surface{background:url("\0surface.bin")}';
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      embedded
        ? `<main>Search</main><style>${style}</style>`
        : "---\nimport './surface.css';\n---\n<main>Search</main>"
    );
    if (!embedded) fs.writeFileSync(path.join(directory, 'surface.css'), style);
    fs.writeFileSync(path.join(directory, 'surface.bin'), Buffer.from([0, 128, 255]));
    const browserAsset = path.join(directory, '\uFFFDsurface.bin');
    fs.writeFileSync(browserAsset, Buffer.from([0, 128, 255]));
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    fs.writeFileSync(browserAsset, Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promotion CSS resource URL.*unverified/
    );
  });
}

for (const mode of ['import', 'import-only', 'browser', 'cached-require', 'nested']) {
  test(`resource closure: rejects ${mode} conditional wildcard package entry`, () => {
    const root = createRoot();
    const name = '@example/conditional-widget';
    const directory = path.join(root, 'node_modules', name);
    const source = path.join(root, 'apps/www/src/components/ConditionalWidget.ts');
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    const conditions =
      mode === 'import-only'
        ? { import: './src/*.mjs' }
        : mode === 'browser'
          ? { browser: { import: './src/*.mjs' }, import: './src/*.cjs', require: './src/*.cjs' }
          : { require: './src/safe.cjs', import: './src/*.mjs' };
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name, exports: { './*': conditions } })
    );
    fs.writeFileSync(path.join(directory, 'src/safe.cjs'), 'module.exports = {};');
    fs.writeFileSync(path.join(directory, 'src/feature.cjs'), 'module.exports = {};');
    fs.writeFileSync(path.join(directory, 'src/safe.mjs'), 'export const safe = true;');
    fs.writeFileSync(
      path.join(directory, 'src/feature.mjs'),
      "import '@proto.ui/runtime'; throw new Error('must only resolve, never execute');"
    );
    if (mode !== 'import-only')
      assert.match(createRequire(source).resolve(`${name}/feature`), /\.cjs$/);
    if (mode === 'nested') {
      const bridge = path.join(root, 'node_modules/conditional-bridge');
      fs.mkdirSync(bridge, { recursive: true });
      fs.writeFileSync(
        path.join(bridge, 'package.json'),
        JSON.stringify({
          name: 'conditional-bridge',
          main: './index.js',
          dependencies: { [name]: '1.0.0' },
        })
      );
      fs.writeFileSync(path.join(bridge, 'index.js'), `import '${name}/feature';`);
      fs.writeFileSync(source, "import 'conditional-bridge';");
    } else
      fs.writeFileSync(
        source,
        `${mode === 'cached-require' ? `import '${name}/safe';` : ''} import '${name}/feature';`
      );
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /raw Proto UI import.*(?:conditional-widget\/feature|conditional-bridge)/
    );
  });
}

for (const mode of ['exact', 'prefix', 'suffix', 'default-first', 'import-first']) {
  test(`resource closure: respects ${mode} export precedence`, () => {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/precedence-widget');
    const source = path.join(root, 'apps/www/src/components/PrecedenceWidget.ts');
    fs.mkdirSync(path.join(directory, 'safe/features'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'guarded/features'), { recursive: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    const exports =
      mode === 'default-first'
        ? { './*': { default: './safe/*.js', import: './guarded/*.js' } }
        : mode === 'import-first'
          ? { './*': { import: './guarded/*.js', default: './safe/*.js' } }
          : { './*': './guarded/*.js' };
    if (mode === 'exact') exports['./features/one.js'] = './safe/features/one.js';
    if (mode === 'prefix') exports['./features/*'] = './safe/features/*';
    if (mode === 'suffix') {
      exports['./features/*'] = './guarded/features/*';
      exports['./features/*.js'] = './safe/features/*.js';
    }
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'precedence-widget', exports })
    );
    for (const suffix of ['one.js', 'one.js.js']) {
      fs.writeFileSync(
        path.join(directory, 'safe/features', suffix),
        "throw new Error('resolver must not execute candidate code');"
      );
      fs.writeFileSync(
        path.join(directory, 'guarded/features', suffix),
        "import '@proto.ui/runtime';"
      );
    }
    fs.writeFileSync(source, "import 'precedence-widget/features/one.js';");
    const nativeTarget = fileURLToPath(
      execFileSync(
        process.execPath,
        [
          '--conditions=browser',
          '--conditions=module',
          '--conditions=production',
          '--experimental-import-meta-resolve',
          '--input-type=module',
          '--eval',
          'process.stdout.write(import.meta.resolve(process.argv[1], process.argv[2]));',
          'precedence-widget/features/one.js',
          pathToFileURL(source).href,
        ],
        { encoding: 'utf8' }
      )
    );
    assert.equal(
      nativeTarget,
      path.join(
        directory,
        mode === 'import-first'
          ? 'guarded/features/one.js.js'
          : mode === 'default-first'
            ? 'safe/features/one.js.js'
            : 'safe/features/one.js'
      )
    );
    writeValidMatrices(root);
    if (mode === 'import-first')
      assert.match(validationMessage(root), /raw Proto UI import.*precedence-widget/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  });
}

for (const [label, url, assetPath, before, after] of [
  [
    'SVG query and fragment',
    './surface.svg?v=1#paint',
    'apps/www/src/components/override/surface.svg',
    '<svg/>',
    '<svg><rect/></svg>',
  ],
  [
    'bare relative URL',
    'surface.svg',
    'apps/www/src/components/override/surface.svg',
    '<svg/>',
    '<svg><rect/></svg>',
  ],
  [
    'percent-encoded local URL',
    './surface%20one.svg',
    'apps/www/src/components/override/surface one.svg',
    '<svg/>',
    '<svg><rect/></svg>',
  ],
  [
    'CSS-escaped local URL',
    './surface\\20 one.svg',
    'apps/www/src/components/override/surface one.svg',
    '<svg/>',
    '<svg><rect/></svg>',
  ],
  [
    'public-root URL',
    '/media/surface.svg#paint',
    'apps/www/public/media/surface.svg',
    '<svg/>',
    '<svg><rect/></svg>',
  ],
  [
    'binary font',
    './surface.woff2',
    'apps/www/src/components/override/surface.woff2',
    Buffer.from([119, 79, 70, 50, 0, 128, 255]),
    Buffer.from([119, 79, 70, 50, 0, 129, 255]),
  ],
  [
    'opaque code-like resource',
    './surface.bin',
    'apps/www/src/components/override/surface.bin',
    Buffer.from("\0import '@proto.ui/runtime';\0"),
    Buffer.from("\0import '@proto.ui/core';\0"),
  ],
]) {
  test(`resource closure: changed CSS ${label} invalidates promotion evidence`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.mkdirSync(path.dirname(path.join(root, assetPath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      "---\nimport './surface.css';\n---\n<main>Search</main>"
    );
    fs.writeFileSync(
      path.join(root, 'apps/www/src/components/override/surface.css'),
      `@font-face { font-family: Surface; src: url('${url}'); } .surface { background-image: url('${url}'); }`
    );
    fs.writeFileSync(path.join(root, assetPath), before);
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    assert.doesNotThrow(() =>
      validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
    );
    fs.writeFileSync(path.join(root, assetPath), after);
    assert.ok(
      validationMessage(root, promotionOptions(revision)).includes(
        `promoted dependency \`${assetPath}\` differs from evidence Commit`
      )
    );
  });
}

for (const [label, style, expected] of [
  [
    'padded remote resource with local lookalike',
    '.surface {background: url(" https://cdn.example/surface.svg")}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'image-set string resource',
    '.surface {background: image-set("./surface.svg" 1x)}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'prefixed image-set resource',
    '.surface {background: -webkit-image-set("./surface.svg" 1x)}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'public-root escape',
    '.surface {background: url(/../../surface.svg)}',
    /promotion CSS resource.*unverified/,
  ],
  [
    'encoded public-root escape',
    '.surface {background: url(/%2e%2e/%2e%2e/surface.svg)}',
    /promotion CSS resource.*unverified/,
  ],
  [
    'remote resource',
    '.surface {background: url(https://cdn.example/surface.svg)}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'protocol-relative resource',
    '.surface {background: url(//cdn.example/surface.svg)}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'missing local resource',
    '.surface {background: url(./missing.svg)}',
    /promotion CSS resource URL.*unresolved/,
  ],
  [
    'malformed percent encoding',
    '.surface {background: url(./surface%GG.svg)}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'dynamic resource',
    '.surface {background: url(var(--surface))}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'unterminated URL',
    '.surface {background: url("./surface.svg"}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'escaped remote URL function',
    '.surface {background: u\\72l("https://cdn.example/surface.svg")}',
    /promotion CSS resource URL.*unverified/,
  ],
  [
    'inline data and fragment',
    '.surface {background: url("data:image/svg+xml,%3Csvg/%3E");filter:url(#paint)}',
    null,
  ],
  [
    'opaque comments and strings',
    '/* url(https://cdn.example/ignored.svg) */ .surface::before {content:"url(https://cdn.example/example.svg)"}',
    null,
  ],
]) {
  test(`resource closure: ${label} has an explicit promotion boundary`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `<main>Search</main><style>${style}</style>`
    );
    fs.writeFileSync(path.join(root, 'apps/surface.svg'), '<svg/>');
    const remoteLookalike = path.join(
      root,
      'apps/www/src/components/override/ https:/cdn.example/surface.svg'
    );
    fs.mkdirSync(path.dirname(remoteLookalike), { recursive: true });
    fs.writeFileSync(remoteLookalike, '<svg/>');
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    if (expected) assert.match(validationMessage(root, promotionOptions(revision)), expected);
    else
      assert.doesNotThrow(() =>
        validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
      );
  });
}

for (const kind of ['website', 'harness']) {
  for (const [label, mutation] of [
    ['text', `script.text = "import('https://cdn.example/runtime.js')";`],
    ['textContent', `script.textContent = "import('https://cdn.example/runtime.js')";`],
    ['computed textContent', `script['textContent'] = payload;`],
    ['compound text', `script.text += payload;`],
    ['innerText', `script.innerText = payload;`],
    ['innerHTML', `script.innerHTML = payload;`],
    ['aliased body', `const alias = script; alias.textContent = payload;`],
    ['Object.assign body', `Object.assign(script, { textContent: payload });`],
    ['Reflect.set body', `Reflect.set(script, 'text', payload);`],
    ['append text', `script.append("import('https://cdn.example/runtime.js')");`],
    ['append text node', `script.appendChild(document.createTextNode(payload));`],
    ['replace children', `script.replaceChildren(payload);`],
  ]) {
    test(`inline DOM script body: rejects ${kind} ${label}`, () => {
      const root = createRoot();
      const sourcePath =
        kind === 'website'
          ? 'apps/www/src/components/ScriptBody.ts'
          : 'apps/agent-harness/src/run/ScriptBody.ts';
      fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
      fs.writeFileSync(
        path.join(root, sourcePath),
        `const script = document.createElement('script'); ${mutation} document.head.append(script);`
      );
      if (kind === 'website')
        writeValidMatrices(
          root,
          {},
          {},
          { websiteBindings: [[sourcePath, ['www.demo.prototype-previewer']]] }
        );
      else writeValidMatrices(root, {}, { Path: `\`${sourcePath}\`` });
      assert.match(validationMessage(root), /dynamic executable script source/);
    });
  }
  for (const [label, source] of [
    ['ordinary DOM text', `const span=document.createElement('span');span.textContent='hello';`],
    ['business receiver', `const script={};script.textContent='hello';script.append('hello');`],
    [
      'reassigned receiver',
      `let script=document.createElement('script');script={};script.textContent='hello';`,
    ],
    [
      'shadowed document',
      `function business(document){const script=document.createElement('script');script.textContent='hello';}`,
    ],
    [
      'no body mutation',
      `const script=document.createElement('script');script.async=true;script.append();`,
    ],
    [
      'data attributes',
      `const script=document.createElement('script');script.setAttribute('textContent','data');`,
    ],
  ]) {
    test(`inline DOM script body: retains ${kind} ${label}`, () => {
      const root = createRoot();
      const sourcePath =
        kind === 'website'
          ? 'apps/www/src/components/ScriptControl.ts'
          : 'apps/agent-harness/src/run/ScriptControl.ts';
      fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
      fs.writeFileSync(path.join(root, sourcePath), source);
      if (kind === 'website')
        writeValidMatrices(
          root,
          {},
          {},
          { websiteBindings: [[sourcePath, ['www.demo.prototype-previewer']]] }
        );
      else writeValidMatrices(root, {}, { Path: `\`${sourcePath}\`` });
      assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
    });
  }
}

for (const kind of ['website', 'harness']) {
  for (const owner of ['window', 'self', 'globalThis']) {
    for (const alias of [false, true]) {
      test(`inline DOM qualified source: rejects ${kind} ${owner} ${alias ? 'alias' : 'direct'}`, () => {
        const root = createRoot();
        const sourcePath =
          kind === 'website'
            ? 'apps/www/src/components/QualifiedScript.ts'
            : 'apps/agent-harness/src/run/QualifiedScript.ts';
        fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
        fs.writeFileSync(
          path.join(root, sourcePath),
          `${alias ? `const doc=${owner}.document;` : ''} const script=${alias ? 'doc' : `${owner}.document`}.createElement('script'); script.textContent=payload;`
        );
        if (kind === 'website')
          writeValidMatrices(
            root,
            {},
            {},
            { websiteBindings: [[sourcePath, ['www.demo.prototype-previewer']]] }
          );
        else writeValidMatrices(root, {}, { Path: `\`${sourcePath}\`` });
        assert.match(validationMessage(root), /dynamic executable script source/);
      });
    }
    test(`inline DOM qualified source: retains ${kind} shadowed ${owner}`, () => {
      const root = createRoot();
      const sourcePath =
        kind === 'website'
          ? 'apps/www/src/components/ShadowedScript.ts'
          : 'apps/agent-harness/src/run/ShadowedScript.ts';
      fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
      fs.writeFileSync(
        path.join(root, sourcePath),
        `function business(${owner}) {const doc=${owner}.document; const script=doc.createElement('script'); script.textContent='data';}`
      );
      if (kind === 'website')
        writeValidMatrices(
          root,
          {},
          {},
          { websiteBindings: [[sourcePath, ['www.demo.prototype-previewer']]] }
        );
      else writeValidMatrices(root, {}, { Path: `\`${sourcePath}\`` });
      assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
    });
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const TEST_PNG_CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
function testPngCrc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = TEST_PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const typeAndPayload = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(testPngCrc32(typeAndPayload), 0);
  return Buffer.concat([length, typeAndPayload, crc]);
}

function indexedPng({ includePalette, pixel = 0, bitDepth = 1, color = [0xff, 0x00, 0x00] }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.writeUInt8(bitDepth, 8);
  ihdr.writeUInt8(3, 9);
  const scanline = zlib.deflateSync(Buffer.from([0x00, pixel << (8 - bitDepth)]));
  const chunks = [
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    ...(includePalette ? [pngChunk('PLTE', Buffer.from(color))] : []),
    pngChunk('IDAT', scanline),
    pngChunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ui-coverage-matrices-'));
  const catalogRoot = path.join(root, 'spec', 'fixtures');
  fs.mkdirSync(catalogRoot, { recursive: true });
  for (const [id, status] of [
    ['P-ACTIVE-BUTTON', 'active'],
    ['P-BASE-BUTTON', 'draft'],
    ['P-BASE-INPUT', 'draft'],
    ['P-BASE-SCROLL-AREA', 'draft'],
    ['P-REMOVED-BUTTON', 'removed'],
    ['A-WEB-COMPONENT-0001', 'active'],
    ['A-REACT-18-19-0001', 'active'],
    ['A-VUE-3-0001', 'active'],
    ['A-VUE-2-0001', 'active'],
  ]) {
    fs.writeFileSync(
      path.join(catalogRoot, `${id}.yaml`),
      `id: ${id}\ntype: fixture\nstatus: ${status}\n`,
      'utf8'
    );
  }
  for (const config of MATRIX_CONFIGS) {
    for (const repositoryPath of Object.values(config.requiredRepositoryPathsByRow ?? {}).flat()) {
      const absolutePath = path.join(root, repositoryPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      if (!fs.existsSync(absolutePath)) fs.writeFileSync(absolutePath, '', 'utf8');
    }
  }
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    `lockfileVersion: '9.0'
importers:
  apps/www:
    dependencies:
      '@astrojs/starlight':
        specifier: ^0.35.2
        version: 0.35.3(astro@5.18.1)
packages:
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7': {}
snapshots:
  '@astrojs/starlight@0.35.3(astro@5.18.1)':
    dependencies:
      astro-expressive-code: 0.41.7(astro@5.18.1)
  'astro-expressive-code@0.41.7(astro@5.18.1)':
    dependencies:
      rehype-expressive-code: 0.41.7
  'rehype-expressive-code@0.41.7':
    dependencies:
      expressive-code: 0.41.7
  'expressive-code@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
      '@expressive-code/plugin-frames': 0.41.7
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
`,
    'utf8'
  );
  writeGovernanceSnapshot(root);
  fs.mkdirSync(path.join(root, 'docs', 'evidence', '579-docs-content-flow'), {
    recursive: true,
  });
  for (const repositoryPath of [
    'apps/www/src/styles/markdown.css',
    'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'fixture', 'utf8');
  }
  temporaryRoots.push(root);
  return root;
}

function writeGovernanceSnapshot(root, issueOverrides = {}) {
  const issues = [
    {
      number: 420,
      nodeId: 'I_kwDOMhQZjc_fixture_420',
      state: 'OPEN',
      stateReason: null,
      title: 'Website Self-Hosting',
      url: 'https://github.com/Proto-UI/Proto-UI/issues/420',
      updatedAt: '2026-09-01T00:00:00Z',
      labels: ['area: website'],
      assignees: [],
      milestone: 'Website Self-Hosting — Complete Proto UI Dogfood',
      owners: ['website search', 'website team'],
    },
    {
      number: 519,
      nodeId: 'I_kwDOMhQZjc_fixture_519',
      state: 'OPEN',
      stateReason: null,
      title: 'End-follow semantics',
      url: 'https://github.com/Proto-UI/Proto-UI/issues/519',
      updatedAt: '2026-09-01T00:00:00Z',
      labels: ['area: adapters'],
      assignees: [],
      milestone: null,
      owners: ['scroll domain'],
    },
    {
      number: 533,
      nodeId: 'I_kwDOMhQZjc_fixture_533',
      state: 'OPEN',
      stateReason: null,
      title: 'Coverage enforcement',
      url: 'https://github.com/Proto-UI/Proto-UI/issues/533',
      updatedAt: '2026-09-01T00:00:00Z',
      labels: ['area: agent-harness'],
      assignees: [],
      milestone: null,
      owners: ['harness infrastructure owner'],
    },
  ].map((issue) => ({ ...issue, ...(issueOverrides[issue.number] ?? {}) }));
  const snapshotPath = path.join(
    root,
    'internal',
    'coverage-matrices',
    'github-governance-snapshot.json'
  );
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(
    snapshotPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        repository: 'Proto-UI/Proto-UI',
        issues,
        pullRequests: [
          {
            number: 580,
            state: 'MERGED',
            headSha: '2a6d5f3208d91e5c9862a67408a39ff208d43306',
            mergeCommit: '9841c86a10940267fb30ee25b63c9a5a39f76fe6',
            url: 'https://github.com/Proto-UI/Proto-UI/pull/580',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function writeReviewedPromotionConfig(
  root,
  config = fs.readFileSync(new URL('../../../apps/www/astro.config.mjs', import.meta.url), 'utf8')
) {
  fs.mkdirSync(path.join(root, 'apps/www/scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
  fs.copyFileSync(
    new URL('../../../apps/www/scripts/contrast-provenance.mjs', import.meta.url),
    path.join(root, 'apps/www/scripts/contrast-provenance.mjs')
  );
  fs.copyFileSync(
    new URL('../../../apps/www/scripts/runtime-retry-urls.mjs', import.meta.url),
    path.join(root, 'apps/www/scripts/runtime-retry-urls.mjs')
  );
}

function commitFixtureRoot(root) {
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'fixture baseline',
    ],
    { cwd: root }
  );
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}
function commitFixtureChange(root, repositoryPath, content, message = 'fixture change') {
  const absolutePath = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
  execFileSync('git', ['add', repositoryPath], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      message,
    ],
    { cwd: root }
  );
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function promotionOptions(baseRevision, headRevision = baseRevision) {
  return { baseRevision, headRevision };
}

function gitTreeForRevision(root, revision) {
  try {
    return execFileSync('git', ['rev-parse', `${revision}^{tree}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '0'.repeat(40);
  }
}

function machineReadableResults(root, revision, artifactPaths, overrides = {}) {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'proto-ui.coverage-evidence-results',
      repository: 'Proto-UI/Proto-UI',
      revision,
      tree: gitTreeForRevision(root, revision),
      commands: [
        {
          command: 'corepack pnpm@10.32.1 --filter @proto-ui/www build',
          status: 'passed',
        },
        { command: 'corepack pnpm@10.32.1 test', status: 'passed' },
      ],
      results: [{ name: 'fixture acceptance', status: 'passed' }],
      artifacts: artifactPaths.map((repositoryPath) => ({
        path: repositoryPath,
        size: fs.statSync(path.join(root, repositoryPath)).size,
        sha256: sourceDigest(root, repositoryPath),
      })),
      ...overrides,
    },
    null,
    2
  )}\n`;
}
function sourceDigest(root, repositoryPath) {
  const absolutePath = path.join(root, repositoryPath);
  return fs.existsSync(absolutePath)
    ? createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex')
    : '0'.repeat(64);
}
function sourceScanDigest(root, repositoryPath) {
  const absolutePath = path.join(root, repositoryPath);
  const normalizedSource = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n?/gu, '\n');
  return createHash('sha256').update(normalizedSource).digest('hex');
}

function separator(headers) {
  return `| ${headers.map(() => '---').join(' | ')} |`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    separator(headers),
    ...rows.map((row) => `| ${headers.map((header) => row[header] ?? '—').join(' | ')} |`),
  ].join('\n');
}

function totals(config, rows) {
  const counts = new Map(config.allowedStates.map((state) => [state, 0]));
  for (const row of rows) counts.set(row.State, (counts.get(row.State) ?? 0) + 1);
  return [
    '## State totals',
    '',
    '| State | Count |',
    '| --- | --- |',
    ...config.allowedStates.map((state) => `| ${state} | ${counts.get(state)} |`),
  ].join('\n');
}

function targetClassTotals(config, rows) {
  const counts = new Map(config.allowedTargetClasses.map((targetClass) => [targetClass, 0]));
  for (const row of rows) {
    counts.set(row['Target class'], (counts.get(row['Target class']) ?? 0) + 1);
  }
  return [
    '## Target-class totals',
    '',
    '| Target class | Count |',
    '| --- | --- |',
    ...config.allowedTargetClasses.map(
      (targetClass) => `| ${targetClass} | ${counts.get(targetClass)} |`
    ),
  ].join('\n');
}

function validWebsiteRow(overrides = {}) {
  return {
    ID: 'www.shell.search',
    Path: 'apps/www/src/components/override/Search.astro',
    'User job': 'Search documentation',
    'Current owner': 'Website team',
    'Target class': 'official-prototype',
    'Proto UI chain': 'P-ACTIVE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'P-ACTIVE-BUTTON=active; A-WEB-COMPONENT-0001=active',
    'WC host and SSR/no-JS strategy':
      'WC: generated facade; SSR: meaningful light DOM; no-JS: native search link remains',
    'Dependency and owner': 'No blocker; owner: website team',
    Difficulty: 'F3',
    Milestone: 'M2',
    State: 'ready',
    Evidence: 'apps/www/src/components/override/Search.astro',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
    ...overrides,
  };
}

function validDocumentSemanticsRow(overrides = {}) {
  return validWebsiteRow({
    ID: 'www.content.document-semantics',
    Path: '`apps/www/src/content/docs/{en,zh-cn}/**`, `apps/www/src/components/override/MarkdownContent.astro`',
    'User job': 'Read headings, prose, lists, tables, code, and links in document order',
    'Current owner': 'Website content authors',
    'Target class': 'native/static',
    'Proto UI chain': 'Native document HTML generated from Markdown/MDX',
    Lifecycle: 'Native semantic content; interactive embeds are tracked separately',
    'WC host and SSR/no-JS strategy':
      'WC: not needed for document semantics; SSR: complete content is rendered in order; no-JS: prose and native links remain readable',
    'Dependency and owner': 'No Proto UI dependency; owner: website content governance',
    Difficulty: 'F2',
    Milestone: 'M0 / S14',
    State: 'native/static',
    Evidence:
      'Issue #579; merged PR #580; reviewed implementation head `2a6d5f3208d91e5c9862a67408a39ff208d43306`; merged ancestry commit `9841c86a10940267fb30ee25b63c9a5a39f76fe6`; routes `/en/ui-libraries/shadcn/select/`, `/zh-cn/ui-libraries/shadcn/select/`, `/en/start-here/quick-start/`, `/zh-cn/start-here/quick-start/`; `apps/www/src/components/override/MarkdownContent.astro`; `apps/www/src/styles/markdown.css`; `apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts`; `docs/evidence/579-docs-content-flow`',
    'Escape or exemption':
      'Reason: native document flow and Starlight presentation are the intended semantic end state; limit: static HTML/CSS flow only',
    'Re-review or removal issue':
      '#420 when the MarkdownContent override, docs-flow selectors, Starlight reset behavior, or relevant MarkdownContent/Starlight dependency changes',
    ...overrides,
  });
}

function validSelfHostedWebsiteEvidence(overrides = {}) {
  return Object.entries({
    Commit: '0123456789abcdef0123456789abcdef01234567',
    Environment: 'Node.js 22 and Chromium on CI',
    Routes: '`/en/` and `/zh-cn/`',
    Build: '`internal/website/evidence/s14/build.log`',
    Browser: '`internal/website/evidence/s14/browser-results.json`',
    Accessibility: '`internal/website/evidence/s14/accessibility-results.json`',
    Screenshot: '`internal/website/evidence/s14/home-desktop.png`',
    'Multi-frame': '`internal/website/evidence/s14/navigation-frames.json`',
    Commands:
      '`corepack pnpm@10.32.1 --filter @proto-ui/www build` and `corepack pnpm@10.32.1 test`',
    Results: '`internal/website/evidence/s14/results.json`',
    ...overrides,
  })
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function writeSelfHostedWebsiteArtifacts(
  root,
  revision = '0123456789abcdef0123456789abcdef01234567',
  resultRevision = revision
) {
  const artifactRoot = path.join(root, 'internal/website/evidence/s14');
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'build.log'), 'build completed\n', 'utf8');
  fs.writeFileSync(path.join(artifactRoot, 'browser-results.json'), '{"passed":true}\n', 'utf8');
  fs.writeFileSync(
    path.join(artifactRoot, 'accessibility-results.json'),
    '{"violations":[]}\n',
    'utf8'
  );
  fs.writeFileSync(path.join(artifactRoot, 'home-desktop.png'), onePixelPng);
  fs.writeFileSync(path.join(artifactRoot, 'navigation-before.png'), onePixelPng);
  fs.writeFileSync(
    path.join(artifactRoot, 'navigation-after.png'),
    indexedPng({ includePalette: true })
  );
  fs.writeFileSync(
    path.join(artifactRoot, 'navigation-frames.json'),
    JSON.stringify({
      frames: [
        'internal/website/evidence/s14/navigation-before.png',
        'internal/website/evidence/s14/navigation-after.png',
      ],
    }),
    'utf8'
  );
  const retainedArtifactPaths = [
    'internal/website/evidence/s14/build.log',
    'internal/website/evidence/s14/browser-results.json',
    'internal/website/evidence/s14/accessibility-results.json',
    'internal/website/evidence/s14/home-desktop.png',
    'internal/website/evidence/s14/navigation-frames.json',
    'internal/website/evidence/s14/navigation-before.png',
    'internal/website/evidence/s14/navigation-after.png',
  ];
  fs.writeFileSync(
    path.join(artifactRoot, 'results.json'),
    machineReadableResults(root, resultRevision, retainedArtifactPaths),
    'utf8'
  );
}
function writeSelfHostedPromotion(
  root,
  revision,
  {
    manifestOverrides = {},
    evidenceOverrides = {},
    matrixOverrides = {},
    websiteBindings = [],
  } = {}
) {
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const resultsPath = 'internal/website/evidence/s14/results.json';
  writeSelfHostedWebsiteArtifacts(root, revision);
  if (Object.keys(manifestOverrides).length > 0) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, resultsPath), 'utf8'));
    fs.writeFileSync(
      path.join(root, resultsPath),
      `${JSON.stringify({ ...manifest, ...manifestOverrides }, null, 2)}\n`,
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision, ...evidenceOverrides }),
    'utf8'
  );
  writeValidMatrices(
    root,
    {
      State: 'self-hosted',
      Evidence: `\`${evidencePath}\``,
      ...matrixOverrides,
    },
    {},
    { websiteBindings }
  );
  return { evidencePath, resultsPath };
}

function writeVideoPromotionFixture(root, revision, websiteBindings, videoPath, videoBytes) {
  writeSelfHostedPromotion(root, revision, {
    websiteBindings,
    evidenceOverrides: { 'Multi-frame': `\`${videoPath}\`` },
  });
  const videoAbsolutePath = path.join(root, videoPath);
  fs.mkdirSync(path.dirname(videoAbsolutePath), { recursive: true });
  fs.writeFileSync(videoAbsolutePath, videoBytes);
  const resultsPath = path.join(root, 'internal/website/evidence/s14/results.json');
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const frameManifestArtifacts = new Set([
    'internal/website/evidence/s14/navigation-frames.json',
    'internal/website/evidence/s14/navigation-before.png',
    'internal/website/evidence/s14/navigation-after.png',
  ]);
  results.artifacts = results.artifacts.filter(
    (artifact) => !frameManifestArtifacts.has(artifact.path)
  );
  results.artifacts.push({
    path: videoPath,
    size: fs.statSync(videoAbsolutePath).size,
    sha256: sourceDigest(root, videoPath),
  });
  fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
}

function validHarnessRow(overrides = {}) {
  return {
    ID: 'harness.transcript.viewport',
    Path: 'apps/agent-harness/src/transcript/TranscriptViewport.tsx',
    'User job': 'Read a transcript',
    'Current owner': 'Harness application',
    'Target owner': 'Proto UI Scroll Area composition',
    'Target class': 'composition',
    'Proto UI chain': 'P-BASE-SCROLL-AREA draft; A-REACT-18-19-0001 active',
    'App state and semantic events':
      'App state: message IDs and ordering; Events: jumpToLatestRequest',
    'Production host and equivalence evidence':
      'Host: React 19; WC: required fixture; React: production; Vue: required fixture',
    'Dependency and owner': '#519; owner: scroll domain',
    Difficulty: 'F5',
    Milestone: 'M2',
    State: 'research',
    Evidence: '#519 acceptance and baseline plan',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
    ...overrides,
  };
}

function writeHarnessPromotionArtifacts(root, commit, resultRevision = commit) {
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  const evidenceRoot = 'internal/agent-harness/evidence/m1';
  const resultsPath = `${evidenceRoot}/tool-invocation-results.json`;
  const artifactPaths = [
    `${evidenceRoot}/build.log`,
    `${evidenceRoot}/browser-results.json`,
    `${evidenceRoot}/accessibility-results.json`,
    `${evidenceRoot}/lifecycle-results.json`,
    `${evidenceRoot}/design-review.txt`,
  ];
  for (const repositoryPath of artifactPaths) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'passed\n', 'utf8');
  }
  fs.writeFileSync(
    path.join(root, resultsPath),
    machineReadableResults(root, resultRevision, artifactPaths),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, evidencePath),
    `Build: \`${artifactPaths[0]}\`\nBrowser: \`${artifactPaths[1]}\`\nAccessibility: \`${artifactPaths[2]}\`\nLifecycle: \`${artifactPaths[3]}\`\nDesign: \`${artifactPaths[4]}\`\nCommit: ${commit}\nEnvironment: fixture\nFixtures: tool invocation\nCommands: \`corepack pnpm@10.32.1 test\`\nResults: \`${resultsPath}\`\n`,
    'utf8'
  );
  return { implementationPath, evidencePath };
}

function writeMatrix(
  root,
  config,
  rows,
  { headers = config.headers, totalsText, targetClassTotalsText, extraText = '' } = {}
) {
  const defaultWebsiteBindings = [
    '## Source-scan bindings',
    '',
    '| Interactive or integration source | Owning matrix row | Source SHA-256 |',
    '| --- | --- | --- |',
    `| \`apps/www/src/components/override/Header.astro\` | \`www.shell.primary-nav\`, \`www.shell.header-separators\` | \`${sourceScanDigest(root, 'apps/www/src/components/override/Header.astro')}\` |`,
  ].join('\n');
  const absolutePath = path.join(root, config.relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      '# Fixture matrix',
      '',
      config.startMarker,
      table(headers, rows),
      '<!-- coverage-matrix:end -->',
      '',
      totalsText ?? totals(config, rows),
      '',
      config.kind === 'agent-harness'
        ? (targetClassTotalsText ?? targetClassTotals(config, rows))
        : '',
      '',
      extraText || (config.kind === 'website' ? defaultWebsiteBindings : ''),
      '',
    ].join('\n'),
    'utf8'
  );
}

function rowsWithRequiredIds(config, primaryRow, rowFactory) {
  const nonInteractiveEntries = new Map(
    (config.nonInteractiveSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.entries.map((entry) => [entry.id, entry])
    )
  );
  const requiredIds = new Set([
    ...(config.requiredIds ?? []),
    ...Object.keys(config.requiredCatalogIdsByRow ?? {}),
    ...Object.keys(config.requiredRepositoryPathsByRow ?? {}),
    ...Object.keys(config.requiredInlineCodeByRow ?? {}),
    ...Object.keys(config.closureBindingsByRow ?? {}),
    ...(config.inheritedSurfaceManifests ?? []).flatMap((manifest) => manifest.ids),
    ...nonInteractiveEntries.keys(),
  ]);
  return [
    primaryRow,
    ...[...requiredIds]
      .filter((id) => id !== primaryRow.ID)
      .map((id) => {
        if (id === 'www.content.document-semantics') return validDocumentSemanticsRow();
        const requiredCatalogIds = config.requiredCatalogIdsByRow?.[id] ?? [];
        const requiredRepositoryPaths = config.requiredRepositoryPathsByRow?.[id] ?? [];
        const requiredInlineCode = config.requiredInlineCodeByRow?.[id] ?? [];
        const nonInteractiveExpectation = nonInteractiveEntries.get(id);
        return rowFactory({
          ID: id,
          ...(nonInteractiveExpectation
            ? {
                'Target class': nonInteractiveExpectation.targetClass,
                State: nonInteractiveExpectation.state,
                ...(nonInteractiveExpectation.targetClass === 'native/static'
                  ? {
                      'Proto UI chain': 'Native semantic HTML',
                      Lifecycle: 'Native HTML; no catalog entity required',
                      'Dependency and owner': 'No Proto UI dependency; owner: website team',
                      'Escape or exemption':
                        'Reason: native semantic HTML owns the complete information path',
                      'Re-review or removal issue': '#420 if app-owned interaction is introduced',
                    }
                  : {}),
                ...(nonInteractiveExpectation.state === 'blocked' ||
                nonInteractiveExpectation.state === 'research'
                  ? { 'Dependency and owner': '#420; owner: website team' }
                  : {}),
                ...(nonInteractiveExpectation.targetClass === 'infrastructure-exempt'
                  ? {
                      'Proto UI chain': 'Website-owned static presentation infrastructure',
                      Lifecycle: 'No catalog entity required',
                      'Dependency and owner': 'owner: website team',
                      'Escape or exemption':
                        'Reason: static styling remains bounded website presentation infrastructure',
                      'Re-review or removal issue':
                        '#420 if the projection gains interaction or semantic state',
                    }
                  : {}),
              }
            : {}),
          ...(requiredCatalogIds.length > 0
            ? {
                'Proto UI chain': requiredCatalogIds.join('; '),
                Lifecycle: requiredCatalogIds.map((entry) => `${entry}=active`).join('; '),
                ...(config.kind === 'website' &&
                requiredCatalogIds.every((entry) => !/^(?:P|M)-/.test(entry))
                  ? {
                      State: 'research',
                      'Dependency and owner': '#420; owner: website team',
                    }
                  : {}),
              }
            : {}),
          ...(requiredRepositoryPaths.length > 0
            ? {
                Path: requiredRepositoryPaths.map((entry) => `\`${entry}\``).join(', '),
                Evidence: `${requiredRepositoryPaths
                  .map((entry) => `\`${entry}\``)
                  .join(', ')} source baseline`,
              }
            : {}),
          ...(requiredInlineCode.length > 0
            ? {
                Evidence: `Reviewed interaction dependency ${requiredInlineCode
                  .map((entry) => `\`${entry}\``)
                  .join(', ')}`,
              }
            : {}),
          ...(id === 'www.search.input-results'
            ? {
                'Current owner': '`@pagefind/default-ui` plus Website search orchestration',
                'Proto UI chain': '`P-BASE-INPUT` draft target plus current Pagefind UI',
                Lifecycle: '`P-BASE-INPUT=draft`; third-party UI remains current',
                State: 'blocked',
                'Dependency and owner': '#420; owner: website search',
                Evidence:
                  '`@pagefind/default-ui` constructs `new PagefindUI` for the Website search input and results',
              }
            : {}),
        });
      }),
  ];
}

function writeValidMatrices(
  root,
  websiteOverrides = {},
  harnessOverrides = {},
  { websiteBindings = [], harnessBindings = [] } = {}
) {
  const websiteBindingEntries = [
    [
      'apps/www/src/components/override/Header.astro',
      ['www.shell.primary-nav', 'www.shell.header-separators'],
    ],
    ...websiteBindings,
  ];
  const extraText = [
    '## Source-scan bindings',
    '',
    '| Interactive or integration source | Owning matrix row | Source SHA-256 |',
    '| --- | --- | --- |',
    ...websiteBindingEntries.map(
      ([sourcePath, ownerIds]) =>
        `| \`${sourcePath}\` | ${ownerIds.map((ownerId) => `\`${ownerId}\``).join(', ')} | \`${sourceScanDigest(root, sourcePath)}\` |`
    ),
  ].join('\n');
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(websiteOverrides), validWebsiteRow),
    { extraText }
  );
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(harnessOverrides), validHarnessRow),
    {
      extraText:
        harnessBindings.length === 0
          ? ''
          : [
              '## Source-scan bindings',
              '',
              '| Interactive or integration source | Owning matrix row |',
              '| --- | --- |',
              ...harnessBindings.map(
                ([sourcePath, ownerIds]) =>
                  `| \`${sourcePath}\` | ${ownerIds.map((ownerId) => `\`${ownerId}\``).join(', ')} |`
              ),
            ].join('\n'),
    }
  );
}

function validationMessage(root, options = {}) {
  let caught;
  try {
    validateCoverageMatrices({ rootDir: root, ...options });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, 'expected coverage matrix validation to fail');
  return caught.message;
}

test('accepts both matrices with exact headers, policies, and matching totals', () => {
  const root = createRoot();
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('keeps non-interactive path and class/state manifest IDs identical', () => {
  const websiteConfig = MATRIX_CONFIGS.find((config) => config.kind === 'website');
  const pathIds = Object.keys(websiteConfig.requiredRepositoryPathsByRow).sort();
  const expectationIds = websiteConfig.nonInteractiveSurfaceManifests
    .flatMap((manifest) => manifest.entries.map((entry) => entry.id))
    .sort();
  assert.deepEqual(pathIds, expectationIds);
});

test('rejects omission of required inherited and parent-named inventory surfaces', () => {
  const root = createRoot();
  writeMatrix(root, MATRIX_CONFIGS[0], [validWebsiteRow()]);
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /required inventory surface ID `www\.shell\.skip-link` is missing/);
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.mobile-table-of-contents` is missing/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.mobile-menu-toggle` is missing from inherited manifest @astrojs\/starlight@0\.35\.3/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.sidebar-navigation` is missing from inherited manifest @astrojs\/starlight@0\.35\.3/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.site-title` is missing from non-interactive manifest repository-owned non-interactive website projections/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.social-links` is missing from non-interactive manifest/
  );
  assert.match(message, /required inventory surface ID `www\.docs\.phase-badge` is missing/);
  assert.match(message, /required inventory surface ID `www\.icons\.static-lucide` is missing/);
  assert.match(
    message,
    /required inventory surface ID `www\.demo\.raw-adapter-runtimes` is missing/
  );
  assert.match(
    message,
    /required inventory surface ID `harness\.workspace\.branch-checkpoints` is missing/
  );
});

test('rejects an interactive website source that is not bound to the matrix', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewControl.astro');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    '<button>New</button><script>addEventListener("click", () => {})</script>'
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewControl\.astro` is not bound/
  );
});

test('includes interactive authored demo controllers in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'demo-new-control.demo.ts'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'host.addEventListener("click", () => api.call("demo", "open"));');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/demo-new-control\.demo\.ts` is not bound/
  );
});

test('includes content-local JavaScript and TypeScript interactions in the website scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/content/docs/Widget.tsx',
      'export const Widget = () => <button onClick={() => {}} />;',
    ],
    ['apps/www/src/content/docs/behavior.js', 'host.addEventListener("click", activate);'],
    [
      'apps/www/src/content/docs/registry.ts',
      'window.customElements.define("x-fixture", FixtureElement);',
    ],
    [
      'apps/www/src/content/docs/observer.ts',
      'const observer = new window.MutationObserver(update);',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/content/docs/Widget.tsx',
    'apps/www/src/content/docs/behavior.js',
    'apps/www/src/content/docs/registry.ts',
    'apps/www/src/content/docs/observer.ts',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('detects DOM event-property assignments in website helpers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    ['apps/www/src/content/docs/click-property.ts', 'button.onclick = activate;'],
    ['apps/www/src/content/docs/key-property.js', 'window.onkeydown = handleKey;'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/content/docs/click-property.ts',
    'apps/www/src/content/docs/key-property.js',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('ignores interactive-looking source snippets stored as content data', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/demo_components/example/exampleCode.ts';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    'export const codeMap = { wc: `<script>host.addEventListener("click", activate)</script>`, react: `<button onClick={() => activate()} />` };'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores inert JSON data scripts during interaction discovery', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/content/docs/StructuredData.astro',
      '<script type="application/ld+json">{"@type":"WebSite"}</script>',
    ],
    [
      'apps/www/src/content/docs/data.mdx',
      `<script type="application/json">{'{"fixture":true}'}</script>`,
    ],
  ];
  assert.throws(
    () =>
      createMarkdownProcessor({ format: 'mdx' }).parse(
        '<script type="application/json">{"fixture":true}</script>'
      ),
    /Could not parse expression/u
  );
  assert.doesNotThrow(() => createMarkdownProcessor({ format: 'mdx' }).parse(cases[1][1]));
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [[cases[0][0], ['www.content.document-semantics']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects camel-cased JSX event handler props in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewControl.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export const NewControl = () => <button onClick={() => {}} />;');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewControl\.tsx` is not bound/
  );
});

test('detects form submission handlers in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewForm.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export const NewForm = () => <form onSubmit={() => {}} />;');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewForm\.tsx` is not bound/
  );
});

test('detects JSX interaction handlers without an event-name allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const handler of ['onBlur', 'onFocus', 'onDoubleClick', 'onMouseDown']) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', `${handler}Control.tsx`);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `export const Control = () => <button ${handler}={() => {}} />;`);
  }
  const message = validationMessage(root);
  for (const handler of ['onBlur', 'onFocus', 'onDoubleClick', 'onMouseDown']) {
    assert.ok(
      message.includes(
        `interactive website source \`apps/www/src/components/${handler}Control.tsx\` is not bound`
      )
    );
  }
});

test('detects native HTML event attributes case-insensitively', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, attribute] of [
    ['apps/www/src/components/BlurControl.astro', 'onblur'],
    ['apps/www/src/content/docs/focus-control.mdx', 'onfocus'],
    ['apps/www/src/components/DoubleClickControl.astro', 'ondblclick'],
    ['apps/www/src/components/UppercaseClickControl.astro', 'ONCLICK'],
    ['apps/www/src/components/UnicodeLookalikeClickControl.astro', 'onKeydown'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `<input ${attribute}="validate()" />`);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/BlurControl.astro',
    'apps/www/src/content/docs/focus-control.mdx',
    'apps/www/src/components/DoubleClickControl.astro',
    'apps/www/src/components/UppercaseClickControl.astro',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
  assert.ok(
    !message.includes(
      'interactive website source `apps/www/src/components/UnicodeLookalikeClickControl.astro` is not bound'
    )
  );
});

test('discovers DOM event-property assignments in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/components/EventPropertyControl.ts';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    "const button = document.querySelector('button'); button.onclick = () => {};"
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/EventPropertyControl\.ts` is not bound/
  );
});

test('does not classify ordinary lowercase on-prefixed component props as events', () => {
  const root = createRoot();
  const cases = [
    ['apps/www/src/components/OnlyCard.astro', '<Card only={true} />'],
    ['apps/www/src/components/OnceCard.tsx', '<Card once="session" />'],
    ['apps/www/src/components/OngoingCard.vue', '<template><Card ongoing="yes" /></template>'],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: cases.map(([relativePath]) => [relativePath, ['www.shell.search']]),
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('discovers interactive Vue and Svelte website components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/NewControl.vue',
      '<template><button onblur="close()">Close</button></template>',
    ],
    ['apps/www/src/content/docs/NewControl.svelte', '<button ondblclick="open()">Open</button>'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/NewControl.vue',
    'apps/www/src/content/docs/NewControl.svelte',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('detects Vue and Svelte template event directives', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/VueShortControl.vue',
      '<template><button @click="open" /></template>',
    ],
    [
      'apps/www/src/components/VueLongControl.vue',
      '<template><button v-on:click.prevent="open" /></template>',
    ],
    [
      'apps/www/src/content/docs/SvelteControl.svelte',
      '<button on:click|preventDefault={open}>Open</button>',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/VueShortControl.vue',
    'apps/www/src/components/VueLongControl.vue',
    'apps/www/src/content/docs/SvelteControl.svelte',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('does not confuse comparisons and ordinary onXxx variables with JSX handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'comparison.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      'const a = 1;',
      'const b = 2;',
      'const lower = a < b;',
      'let onDoubleClick = () => {};',
      'export const result = lower ? onDoubleClick : undefined;',
    ].join('\n')
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/comparison.tsx', ['www.shell.search']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat JSX-looking TypeScript strings as executable handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [fileName, content] of [
    [
      'single-quoted-example.ts',
      "export const example = '<button onDoubleClick={handler}>Example</button>';",
    ],
    ['template-example.tsx', 'export const example = `<button onBlur={handler}>Example</button>`;'],
  ]) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', fileName);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/template-example.tsx', ['www.shell.search']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat JSX-looking Astro frontmatter strings as template handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [fileName, declaration] of [
    [
      'single-quoted-example.astro',
      "const example = '<button onDoubleClick={handler}>Example</button>';",
    ],
    ['template-example.astro', 'const example = `<button onBlur={handler}>Example</button>`;'],
  ]) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', fileName);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, ['---', declaration, '---', '<p>{example}</p>'].join('\n'));
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [
        ['apps/www/src/components/single-quoted-example.astro', ['www.shell.search']],
        ['apps/www/src/components/template-example.astro', ['www.shell.search']],
      ],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores inline and backtick/tilde-fenced MDX examples during interaction scanning', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'content', 'docs', 'examples.mdx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Event examples',
      '',
      'Inline `onBlur={handler}` and `onFocus={handler}` examples are prose.',
      '',
      '```tsx',
      '<button onDoubleClick={handler}>Example</button>',
      '```',
      '',
      '~~~tsx',
      '<button onMouseDown={handler}>Example</button>',
      '~~~~',
    ].join('\n')
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores four-space and tab-indented Markdown code examples', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'indented-examples.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Indented examples',
      '',
      '    button.addEventListener("click", runExample);',
      '    import "@proto.ui/runtime";',
      '',
      '\telement.focus();',
      '\timport "@proto.ui/prototypes-base";',
    ].join('\n')
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('keeps real MDX handler markup visible after Markdown code removal', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'interactive-example.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      'Inline `onBlur={example}` is prose.',
      '',
      '~~~tsx',
      '<button onFocus={example}>Fenced example</button>',
      '~~~',
      '',
      '<button onBlur={() => runDemo()}>Live MDX control</button>',
    ].join('\n')
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/interactive-example\.mdx` is not bound/
  );
});

test('keeps indented live handlers inside nested MDX JSX visible', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'nested-interactive-example.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Live nested control',
      '',
      '<section>',
      '    <button onClick={runDemo}>Run</button>',
      '</section>',
    ].join('\n')
  );

  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/nested-interactive-example\.mdx` is not bound/
  );
});

test('keeps nested same-tag MDX depth before classifying later indented live markup', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/content/docs/nested-same-tag-interactive.mdx';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '<section>',
      '  <section>',
      '  </section>',
      '    <button onClick={runDemo}>Run</button>',
      '</section>',
    ].join('\n')
  );

  assert.ok(
    validationMessage(root).includes(`interactive website source \`${relativePath}\` is not bound`)
  );
});

test('detects Astro client hydration directives in live MDX markup', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const hydratedSources = ['load', 'visible', 'idle', 'only'].map(
    (directive) => `apps/www/src/content/docs/hydrated-${directive}.mdx`
  );
  for (const relativePath of hydratedSources) {
    const directive = path.basename(relativePath, '.mdx').replace('hydrated-', '');
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(
      sourcePath,
      [
        "import ExternalWidget from '@example/widget';",
        '',
        `<ExternalWidget client:${directive}${directive === 'only' ? '="react"' : ''} />`,
      ].join('\n')
    );
  }
  const examplePath = 'apps/www/src/content/docs/hydration-example.mdx';
  const exampleSource = path.join(root, examplePath);
  fs.writeFileSync(
    exampleSource,
    [
      '# Hydration example',
      '',
      '```mdx',
      '<ExternalWidget client:load />',
      '```',
      '',
      '{"<ExternalWidget client:visible />"}',
      '{/* <ExternalWidget client:idle /> */}',
    ].join('\n')
  );

  const message = validationMessage(root);
  for (const relativePath of hydratedSources) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
});

test('detects bounded DOM focus, scroll, ARIA, and class-state mutations', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    ['blur-owner.ts', 'element.blur();'],
    ['focus-owner.ts', 'element.focus();'],
    ['scroll-by-owner.ts', 'element.scrollBy({ top: 1 });'],
    ['scroll-into-view-owner.ts', 'element.scrollIntoView({ block: "nearest" });'],
    ['scroll-to-owner.ts', 'element.scrollTo({ top: 1 });'],
    ['aria-set-owner.ts', "element.setAttribute('aria-expanded', 'true');"],
    ['aria-toggle-owner.ts', "element.toggleAttribute('aria-hidden');"],
    ['aria-remove-owner.ts', "element.removeAttribute('aria-expanded');"],
    ['class-add-owner.ts', "element.classList.add('is-open');"],
    ['class-remove-owner.ts', "element.classList.remove('is-open');"],
    ['class-replace-owner.ts', "element.classList.replace('closed', 'open');"],
    ['class-toggle-owner.ts', "element.classList.toggle('is-open');"],
    ['typed-owner.ts', 'const control: HTMLButtonElement = getControl(); control.focus();'],
    [
      'queried-owner.ts',
      "const control = document.querySelector('button'); control?.scrollIntoView();",
    ],
  ];
  for (const [fileName, content] of cases) {
    const relativePath = `apps/www/src/content/docs/${fileName}`;
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `export function ownState(element) { ${content} }`);
  }
  const examplePath = 'apps/www/src/content/docs/dom-mutation-examples.ts';
  fs.writeFileSync(
    path.join(root, examplePath),
    [
      'export const focusExample = "element.focus()";',
      'export const scrollExample = `element.scrollIntoView()`;',
      'export const ariaExample = "element.setAttribute(\'aria-expanded\', true)";',
      'export const classExample = "element.classList.toggle(\'open\')";',
    ].join('\n')
  );

  const message = validationMessage(root);
  for (const [fileName] of cases) {
    const relativePath = `apps/www/src/content/docs/${fileName}`;
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
});

test('follows post-declaration DOM receiver assignments without leaking inner scopes', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const livePath = 'apps/www/src/content/docs/assigned-dom-receiver.ts';
  const safePath = 'apps/www/src/content/docs/scoped-dom-receiver.ts';
  for (const [relativePath, content] of [
    [livePath, "let element; element = document.querySelector('button'); element.focus();"],
    [
      safePath,
      "let element = model; function inspect() { element = document.querySelector('button'); } element.focus();",
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  assert.ok(message.includes(`interactive website source \`${livePath}\` is not bound`));
  assert.ok(!message.includes(`interactive website source \`${safePath}\` is not bound`));
});

test('does not let function-like parameters hide later outer DOM receiver uses', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/content/docs/dom-after-function-parameter.ts',
      "const control = document.querySelector('button'); function inspect(control) { control.focus(); } control.focus();",
    ],
    [
      'apps/www/src/content/docs/dom-after-arrow-parameter.ts',
      "const control = document.querySelector('button'); const inspect = (control) => control.focus(); control.focus();",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('does not infer DOM ownership from generic receiver method names', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = 'apps/www/src/content/docs/generic-methods.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'searchIndex.blur();',
      'searchIndex.focus();',
      'searchIndex.scrollBy();',
      'searchIndex.scrollIntoView();',
      'searchIndex.scrollTo();',
      "metadata.setAttribute('aria-label', 'result');",
      "metadata.toggleAttribute('aria-hidden');",
      "metadata.removeAttribute('aria-expanded');",
      "model.classList.add('one');",
      "model.classList.remove('one');",
      "model.classList.replace('one', 'two');",
      "model.classList.toggle('two');",
    ].join('\n')
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects DOM mutations in live MDX ESM while excluding authored examples', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const livePath = 'apps/www/src/content/docs/live-restore.mdx';
  const liveSource = path.join(root, livePath);
  fs.mkdirSync(path.dirname(liveSource), { recursive: true });
  fs.writeFileSync(
    liveSource,
    ['export function restore(element) {', '  element.focus();', '}', '', '# Restore'].join('\n')
  );
  const liveAriaPath = 'apps/www/src/content/docs/live-aria-reset.mdx';
  fs.writeFileSync(
    path.join(root, liveAriaPath),
    [
      'export function reset(element) {',
      "  element.removeAttribute('aria-expanded');",
      '}',
      '',
      '# Reset',
    ].join('\n')
  );
  const examplePath = 'apps/www/src/content/docs/dom-authored-examples.mdx';
  fs.writeFileSync(
    path.join(root, examplePath),
    [
      '# DOM examples',
      '',
      'Inline `element.focus()` is prose.',
      '',
      '```ts',
      'export function example(element) { element.blur(); }',
      '```',
      '',
      '{"element.scrollIntoView()"}',
      '{/* element.scrollTo() */}',
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(message.includes(`interactive website source \`${livePath}\` is not bound`));
  assert.ok(message.includes(`interactive website source \`${liveAriaPath}\` is not bound`));
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
});

test('rejects adapter and implementation-internal imports outside the website allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/ReactEscape.tsx',
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/www/src/components/VueEscape.tsx',
      '@proto.ui/adapter-vue',
      "import { createVueAdapter } from '@proto.ui/adapter-vue';",
    ],
    [
      'apps/www/src/components/Vue2Escape.tsx',
      '@proto.ui/adapter-vue2',
      "import { createVue2Adapter } from '@proto.ui/adapter-vue2';",
    ],
    [
      'apps/www/src/components/WebComponentEscape.ts',
      '@proto.ui/adapter-web-component',
      "import { createWebComponentAdapter } from '@proto.ui/adapter-web-component';",
    ],
    [
      'apps/www/src/components/BasePackageEscape.ts',
      '@proto.ui/prototypes-base',
      "import { basePrototypes } from '@proto.ui/prototypes-base';",
    ],
    [
      'apps/www/src/components/ShadcnPackageEscape.ts',
      '@proto.ui/prototypes-shadcn',
      "import { shadcnPrototypes } from '@proto.ui/prototypes-shadcn';",
    ],
    [
      'apps/www/src/components/BrutalistPackageEscape.ts',
      '@proto.ui/prototypes-brutalist',
      "import { brutalistPrototypes } from '@proto.ui/prototypes-brutalist';",
    ],
    [
      'apps/www/src/components/LucidePackageEscape.ts',
      '@proto.ui/prototypes-lucide',
      "import { icon } from '@proto.ui/prototypes-lucide';",
    ],
    [
      'apps/www/src/components/CorePackageEscape.ts',
      '@proto.ui/core',
      "import { definePrototype } from '@proto.ui/core';",
    ],
    [
      'apps/www/src/components/RuntimePackageEscape.ts',
      '@proto.ui/runtime',
      "import { createRuntimeSession } from '@proto.ui/runtime';",
    ],
    [
      'apps/www/src/components/ModulePackageEscape.ts',
      '@proto.ui/module-overlay',
      "import { overlay } from '@proto.ui/module-overlay';",
    ],
    [
      'apps/www/src/components/AdapterBasePackageEscape.ts',
      '@proto.ui/adapter-base',
      "import { adapter } from '@proto.ui/adapter-base';",
    ],
    [
      'apps/www/src/components/BaseInternalEscape.tsx',
      '../../../../packages/prototypes/base/src/button/root.proto',
      "import { root } from '../../../../packages/prototypes/base/src/button/root.proto';",
    ],
    [
      'apps/www/src/components/ShadcnInternalEscape.tsx',
      '../../../../packages/prototypes/shadcn/src/button/root.proto',
      "import { root } from '../../../../packages/prototypes/shadcn/src/button/root.proto';",
    ],
    [
      'apps/www/src/components/BrutalistInternalEscape.astro',
      '../../../../packages/prototypes/brutalist/src/theme',
      [
        '---',
        "import { renderBrutalistThemeCss } from '../../../../packages/prototypes/brutalist/src/theme';",
        '---',
        '<style>{renderBrutalistThemeCss()}</style>',
      ].join('\n'),
    ],
    [
      'apps/www/src/components/LucideInternalEscape.ts',
      '../../../../packages/prototypes/lucide/src/icon/icon.proto',
      "import { asLucideIcon } from '../../../../packages/prototypes/lucide/src/icon/icon.proto';",
    ],
    [
      'apps/www/src/components/CoreInternalEscape.ts',
      '../../../../packages/core/src/index',
      "import { definePrototype } from '../../../../packages/core/src/index';",
    ],
    [
      'apps/www/src/components/RuntimeInternalEscape.ts',
      '../../../../packages/runtime/src/index',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index';",
    ],
    [
      'apps/www/src/components/ModuleInternalEscape.ts',
      '../../../../packages/modules/overlay/src/index',
      "import { overlay } from '../../../../packages/modules/overlay/src/index';",
    ],
    [
      'apps/www/src/components/AdapterInternalEscape.ts',
      '../../../../packages/adapters/react/src/index',
      "import { adapter } from '../../../../packages/adapters/react/src/index';",
    ],
  ];
  for (const [sourcePath, , content] of cases) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  const message = validationMessage(root);
  for (const [sourcePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${sourcePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('classifies Vite import suffixes before enforcing exact Website allowances', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
      '@proto.ui/core?raw',
      "import { definePrototype } from '@proto.ui/core?raw';",
    ],
    [
      'apps/www/src/components/InternalQueryEscape.ts',
      '../../../../packages/runtime/src/index#fixture',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index#fixture';",
    ],
  ];
  for (const [relativePath, , content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('resolves the configured Website source alias before enforcing the consumer wall', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "import { fileURLToPath } from 'node:url';",
      "export default { vite: { resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } } };",
    ].join('\n')
  );
  const sourcePath = 'apps/www/src/components/AliasEscape.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { localHelper } from '@/utils/local-helper';",
      "import { createRuntimeSession } from '@/../../../packages/runtime/src/index';",
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      `raw Proto UI import \`@/../../../packages/runtime/src/index\` in \`${sourcePath}\` escapes the website consumer-wall allowlist`
    )
  );
  assert.doesNotMatch(message, /@\/utils\/local-helper.*escapes the website consumer-wall/);
});

test('rejects raw Proto UI imports outside the Harness bootstrap allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const bootstrapSource = 'apps/agent-harness/src/proto-ui/bootstrap.tsx';
  const forbiddenImports = [
    [
      'apps/agent-harness/src/run/UnsafeRuntimeConsumer.tsx',
      '@proto.ui/runtime',
      "import { createRuntimeSession } from '@proto.ui/runtime';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeAdapterConsumer.tsx',
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/agent-harness/src/run/UnsafePrototypeConsumer.tsx',
      '@proto.ui/prototypes-base/button',
      "import { button } from '@proto.ui/prototypes-base/button';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeInternalConsumer.tsx',
      '../../../../packages/runtime/src/index',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeHooksConsumer.tsx',
      '@proto.ui/hooks',
      "import { hook } from '@proto.ui/hooks';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeHooksInternalConsumer.tsx',
      '../../../../packages/hooks/src/index',
      "import { hook } from '../../../../packages/hooks/src/index';",
    ],
    [
      'apps/agent-harness/src/run/unsafe-theme.scss',
      '@proto.ui/prototypes-brutalist/theme',
      "@use '@proto.ui/prototypes-brutalist/theme';",
    ],
  ];
  for (const [relativePath, , content] of [
    ...forbiddenImports,
    [
      bootstrapSource,
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  const message = validationMessage(root);
  for (const [sourcePath, specifier] of forbiddenImports) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${sourcePath}\` escapes the Harness consumer-wall allowlist`
      )
    );
  }
  assert.doesNotMatch(message, /bootstrap\.tsx.*escapes the Harness consumer-wall allowlist/);
});

test('allows only the reviewed Adapter entry at the Harness bootstrap boundary', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const bootstrapSource = 'apps/agent-harness/src/proto-ui/bootstrap.tsx';
  const absolutePath = path.join(root, bootstrapSource);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
      "import { definePrototype } from '@proto.ui/core';",
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      `raw Proto UI import \`@proto.ui/core\` in \`${bootstrapSource}\` escapes the Harness consumer-wall allowlist`
    )
  );
  assert.ok(
    !message.includes(
      `raw Proto UI import \`@proto.ui/adapter-react\` in \`${bootstrapSource}\` escapes the Harness consumer-wall allowlist`
    )
  );
});

test('classifies Vite import suffixes before enforcing exact Harness allowances', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/agent-harness/src/proto-ui/bootstrap.tsx',
      '@proto.ui/adapter-react?worker',
      "import { createReactAdapter } from '@proto.ui/adapter-react?worker';",
    ],
    [
      'apps/agent-harness/src/run/InternalHashEscape.ts',
      '../../../../packages/runtime/src/index#fixture',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index#fixture';",
    ],
  ];
  for (const [relativePath, , content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the Harness consumer-wall allowlist`
      )
    );
  }
});

test('rejects guarded imports from embedded component style blocks', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, specifier] of [
    ['apps/www/src/components/AstroStyleEscape.astro', '@proto.ui/prototypes-base/styles.css'],
    ['apps/www/src/components/VueStyleEscape.vue', '@proto.ui/runtime/styles.css'],
    ['apps/www/src/components/SvelteStyleEscape.svelte', '@proto.ui/module-overlay/styles.css'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `<style>@import "${specifier}";</style>`);
  }
  const message = validationMessage(root);
  for (const [relativePath, specifier] of [
    ['apps/www/src/components/AstroStyleEscape.astro', '@proto.ui/prototypes-base/styles.css'],
    ['apps/www/src/components/VueStyleEscape.vue', '@proto.ui/runtime/styles.css'],
    ['apps/www/src/components/SvelteStyleEscape.svelte', '@proto.ui/module-overlay/styles.css'],
  ]) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('ignores import-looking CSS strings and comments in embedded style blocks', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/StyleExamples.astro';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '<style>',
      '/* @import "@proto.ui/prototypes-base/comment.css"; */',
      '.example::before { content: "@import \'@proto.ui/runtime/string.css\'"; }',
      '</style>',
    ].join('\n')
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [[relativePath, ['www.shell.search']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects guarded imports nested in embedded Sass and Less style blocks', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/components/NestedStyleEscape.vue',
      '<style lang="scss">.scope { @import "@proto.ui/runtime/styles.css"; }</style>',
      '@proto.ui/runtime/styles.css',
    ],
    [
      'apps/www/src/components/NestedStyleEscape.svelte',
      '<style lang="less">.scope { @import "@proto.ui/module-overlay/styles.css"; }</style>',
      '@proto.ui/module-overlay/styles.css',
    ],
    [
      'apps/www/src/components/CommentMarkerStyleEscape.vue',
      '<style lang="scss">$marker: "/*"; @import "@proto.ui/runtime/marker.css"; /* trailing comment */</style>',
      '@proto.ui/runtime/marker.css',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: cases.map(([relativePath]) => [relativePath, ['www.shell.search']]),
    }
  );
  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('rejects guarded Sass module directives in standalone and embedded styles', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/styles/ModuleEscape.scss',
      '@use "@proto.ui/runtime/styles" as runtime;',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/www/src/components/ForwardEscape.astro',
      '<style lang="scss">@forward "@proto.ui/prototypes-base/theme";</style>',
      '@proto.ui/prototypes-base/theme',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [['apps/www/src/components/ForwardEscape.astro', ['www.shell.search']]] }
  );
  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('inspects every target in a Sass multi-target import', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/styles/MultiTargetEscape.scss',
      '@import url("./base"), "@proto.ui/runtime/styles";',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/agent-harness/src/run/MultiTargetEscape.scss',
      '@import url("./base"), "@proto.ui/runtime/styles";',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/www/src/components/MultiTargetEscape.astro',
      '<style lang="scss">@import "./base", "@proto.ui/prototypes-base/theme";</style>',
      '@proto.ui/prototypes-base/theme',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [['apps/www/src/components/MultiTargetEscape.astro', ['www.shell.search']]] }
  );

  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases.filter(([relativePath]) =>
    relativePath.startsWith('apps/www/')
  )) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles` in `apps/agent-harness/src/run/MultiTargetEscape.scss` escapes the Harness consumer-wall allowlist'
    )
  );
});

test('ignores Sass and Less line-comment directives', () => {
  const root = createRoot();
  const componentPath = 'apps/www/src/components/CommentedStyle.astro';
  for (const [relativePath, content] of [
    ['apps/www/src/styles/Commented.scss', '// @use "@proto.ui/runtime/styles";'],
    [
      componentPath,
      '<style lang="less">// @import "@proto.ui/module-overlay/styles.css";\n.safe { color: red; }</style>',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(root, {}, {}, { websiteBindings: [[componentPath, ['www.shell.search']]] });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not confuse an unquoted URL protocol with a Sass line comment', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/styles/UrlThenModule.scss';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    '@import url(https://cdn.example/x.css); @use "@proto.ui/runtime/styles" as runtime;'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/runtime\/styles` in `apps\/www\/src\/styles\/UrlThenModule\.scss` escapes the website consumer-wall allowlist/
  );
});

test('requires new static website components to have a matrix classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'StaticSurface.astro');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, '<h2>Help</h2><a href="/docs">Docs</a><details>More</details>');
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/StaticSurface\.astro` is not classified by a matrix row/
  );
});

test('requires new static website layouts to have a matrix classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'layouts', 'StaticLayout.astro');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, '<main><slot /></main>', 'utf8');

  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/layouts\/StaticLayout\.astro` is not classified by a matrix row/
  );
});

test('discovers exported Website components rendered through React factories in JS and TS', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/ClassicSurface.js',
      "import React from 'react'; export function ClassicSurface() { return React.createElement('section', null, 'Classic'); }",
    ],
    [
      'apps/www/src/components/AliasedSurface.ts',
      "import { createElement as h } from 'react'; export const AliasedSurface = () => h('section', null, 'Aliased');",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(
      message.includes(
        `website component source \`${relativePath}\` is not classified by a matrix row`
      ),
      `${relativePath} must remain protected by the Website component scan`
    );
  }
});

test('does not classify non-exported or non-React JavaScript factories as Website components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/PrivateFactory.js',
      "import * as React from 'react'; function PrivateFactory() { return React.createElement('section'); }",
    ],
    [
      'apps/www/src/components/LocalFactory.ts',
      "const createElement = (name) => ({ name }); export function makeDescriptor() { return createElement('section'); }",
    ],
    [
      'apps/www/src/components/ExportedData.ts',
      "import React from 'react'; export const metadata = { renderer: React };",
    ],
    [
      'apps/www/src/components/PrivateReactFactory.js',
      "import React from 'react'; const PrivateSurface = () => React.createElement('section'); export const metadata = { kind: 'data' };",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects a conflicting source binding for a static website component with one direct owner', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/override/SiteTitle.astro', ['www.shell.search']]],
    }
  );
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/override\/SiteTitle\.astro` has direct matrix owner `www\.shell\.site-title` outside source binding owner\(s\).*`www\.shell\.search`/
  );
});

test('requires static Markdown and MDX website routes to have a matrix classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const routes = [
    ['apps/www/src/pages/release-notes.md', '# Release notes\n\nStatic route.'],
    ['apps/www/src/pages/about.mdx', '# About\n\nAuthored MDX route.'],
  ];
  for (const [relativePath, content] of routes) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }

  const message = validationMessage(root);
  for (const [relativePath] of routes) {
    assert.ok(
      message.includes(
        `website component source \`${relativePath}\` is not classified by a matrix row`
      )
    );
  }
});

test('excludes component test and spec fixtures from static classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const relativePath of [
    'apps/www/src/components/Widget.test.astro',
    'apps/www/src/components/Widget.spec.vue',
    'apps/www/src/components/Widget.test.svelte',
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, '<div>Fixture only</div>');
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('restricts Lucide component allowances to the Lucide package family', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const sourcePath of [
    'apps/www/src/components/LucideIconGallery.astro',
    'apps/www/src/components/StaticLucideIcon.astro',
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      ['---', "import { basePrototypes } from '@proto.ui/prototypes-base';", '---'].join('\n')
    );
  }
  const message = validationMessage(root);
  assert.match(
    message,
    /raw Proto UI import `@proto\.ui\/prototypes-base` in `apps\/www\/src\/components\/LucideIconGallery\.astro`/
  );
  assert.match(
    message,
    /raw Proto UI import `@proto\.ui\/prototypes-base` in `apps\/www\/src\/components\/StaticLucideIcon\.astro`/
  );
});

test('accepts Lucide package root and subpath imports in reviewed Lucide components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [sourcePath, specifier] of [
    ['apps/www/src/components/LucideIconGallery.astro', '@proto.ui/prototypes-lucide'],
    ['apps/www/src/components/StaticLucideIcon.astro', '@proto.ui/prototypes-lucide/check'],
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, ['---', `import icon from '${specifier}';`, '---'].join('\n'));
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts reviewed demo raw imports and ignores import-looking code strings', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [sourcePath, content] of [
    [
      'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
      "export const load = () => import('../../../../../packages/prototypes/base/src/button/root.proto');",
    ],
    [
      'apps/www/src/components/BrutalistPageStyle.astro',
      [
        '---',
        "import { renderBrutalistThemeCss } from '../../../../packages/prototypes/brutalist/src/theme';",
        '---',
        '<style is:inline set:html={renderBrutalistThemeCss()} />',
      ].join('\n'),
    ],
    [
      'apps/www/src/components/CodeExample.ts',
      "export const example = `import { createVueAdapter } from '@proto.ui/adapter-vue';`;",
    ],
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('allows reviewed prototype package dependencies only through an approved prototype entry', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const prototypeEntry = path.join(
    root,
    'apps/www/src/components/PrototypePreviewer/prototype-modules.ts'
  );
  const prototypeSource = path.join(root, 'packages/prototypes/shadcn/src/button/index.ts');
  const prototypeTypes = path.join(root, 'packages/prototypes/shadcn/src/button/types.ts');
  fs.mkdirSync(path.dirname(prototypeEntry), { recursive: true });
  fs.mkdirSync(path.dirname(prototypeSource), { recursive: true });
  fs.writeFileSync(
    prototypeEntry,
    "export const load = () => import('../../../../../packages/prototypes/shadcn/src/button/index');",
    'utf8'
  );
  fs.writeFileSync(
    prototypeSource,
    "import '@proto.ui/core';\nimport '@proto.ui/prototypes-base/button';\nimport './types';",
    'utf8'
  );
  fs.writeFileSync(
    prototypeTypes,
    'export type ButtonOptions = Record<string, unknown>;\n',
    'utf8'
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects forbidden consumer imports transitive from an approved prototype entry', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const prototypeEntry = path.join(
    root,
    'apps/www/src/components/PrototypePreviewer/prototype-modules.ts'
  );
  const prototypeSource = path.join(root, 'packages/prototypes/shadcn/src/button/index.ts');
  fs.mkdirSync(path.dirname(prototypeEntry), { recursive: true });
  fs.mkdirSync(path.dirname(prototypeSource), { recursive: true });
  fs.writeFileSync(
    prototypeEntry,
    "export const load = () => import('../../../../../packages/prototypes/shadcn/src/button/index');",
    'utf8'
  );
  fs.writeFileSync(prototypeSource, "import '@proto.ui/adapter-react';\n", 'utf8');

  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/adapter-react` in `packages\/prototypes\/shadcn\/src\/button\/index\.ts` escapes/
  );
});

test('binds inherited surface manifests to the resolved dependency version', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n  apps/www:\n    dependencies:\n      '@astrojs/starlight':\n        specifier: ^0.35.2\n        version: 0.35.4(astro@5.18.1)\n",
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /inherited manifest @astrojs\/starlight@0\.35\.3 must match resolved @astrojs\/starlight@0\.35\.4/
  );
});

test('fails closed when an inherited dependency is absent from the lockfile importer', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n  apps/www:\n    dependencies: {}\n",
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /cannot resolve inherited dependency @astrojs\/starlight from pnpm-lock\.yaml importer apps\/www/
  );
});

test('binds inherited transitive Expressive Code surfaces to package versions', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const lockfilePath = path.join(root, 'pnpm-lock.yaml');
  fs.writeFileSync(
    lockfilePath,
    fs
      .readFileSync(lockfilePath, 'utf8')
      .replace(
        "'@expressive-code/plugin-frames': 0.41.7",
        "'@expressive-code/plugin-frames': 0.42.0"
      ),
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /inherited manifest .*@expressive-code\/plugin-frames@0\.41\.7.* must match resolved @expressive-code\/plugin-frames@0\.42\.0/
  );
});

test('ignores transitive Expressive Code versions reachable only from another workspace', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    `lockfileVersion: '9.0'
importers:
  apps/www:
    dependencies:
      '@astrojs/starlight':
        specifier: ^0.35.2
        version: 0.35.3(astro@5.18.1)
  apps/unrelated:
    dependencies:
      expressive-code:
        specifier: ^0.42.0
        version: 0.42.0
packages:
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/core@0.42.0': {}
  '@expressive-code/plugin-frames@0.41.7': {}
  '@expressive-code/plugin-frames@0.42.0': {}
snapshots:
  '@astrojs/starlight@0.35.3(astro@5.18.1)':
    dependencies:
      astro-expressive-code: 0.41.7(astro@5.18.1)
  'astro-expressive-code@0.41.7(astro@5.18.1)':
    dependencies:
      rehype-expressive-code: 0.41.7
  'rehype-expressive-code@0.41.7':
    dependencies:
      expressive-code: 0.41.7
  'expressive-code@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
      '@expressive-code/plugin-frames': 0.41.7
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
  'expressive-code@0.42.0':
    dependencies:
      '@expressive-code/core': 0.42.0
      '@expressive-code/plugin-frames': 0.42.0
  '@expressive-code/core@0.42.0': {}
  '@expressive-code/plugin-frames@0.42.0':
    dependencies:
      '@expressive-code/core': 0.42.0
`,
    'utf8'
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects client interaction added to a native/static manifest source', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'apps', 'www', 'src', 'components', 'override', 'SiteTitle.astro'),
    '<a href="/">Home</a><script>addEventListener("click", () => {})</script>'
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/override\/SiteTitle\.astro` is owned only by native\/static rows/
  );
});

test('does not accept a prose path mention as an interactive source binding', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'scripts', 'NewControl.ts');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'addEventListener("click", () => {})');
  writeMatrix(root, website, websiteRows, {
    extraText: 'A prose note mentions apps/www/src/scripts/NewControl.ts but assigns no row.',
  });
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/scripts\/NewControl\.ts` is not bound/
  );
});

test('requires a grouped binding to name every direct owner across exemption classes', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const sharedSource = 'apps/www/src/components/SharedPreviewClient.ts';
  const sourcePath = path.join(root, sharedSource);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'addEventListener("click", () => {})');

  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  websiteRows[0] = validWebsiteRow({
    ID: 'www.demo.runtime-select',
    Path: `\`${sharedSource}\``,
  });
  websiteRows[1] = validWebsiteRow({
    ID: 'www.demo.prototype-previewer',
    Path: `\`${sharedSource}\``,
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Proto UI chain': 'Website-owned preview infrastructure',
    Lifecycle: 'No catalog entity required',
    'Dependency and owner': 'owner: website team',
    'Escape or exemption':
      'Reason: raw preview mounting remains bounded demonstration infrastructure',
    'Re-review or removal issue': '#420 if the preview owns user-facing selection semantics',
  });
  writeMatrix(root, website, websiteRows, {
    extraText: [
      '## Source-scan bindings',
      '',
      '| Interactive or integration source | Owning matrix row | Source SHA-256 |',
      '| --- | --- | --- |',
      `| \`${sharedSource}\` | grouped row \`www.demo.runtime-select\` | \`${sourceScanDigest(root, sharedSource)}\` |`,
    ].join('\n'),
  });
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );

  assert.match(
    validationMessage(root),
    /grouped binding .* must name exactly the matrix Path owners \(www\.demo\.prototype-previewer, www\.demo\.runtime-select\)/
  );
});

test('rejects uncataloged entity IDs and stale lifecycle reporting', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'C-NOT-REAL; K-NOT-REAL; V-NOT-REAL; P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Adapter profile is active',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  const message = validationMessage(root);
  assert.match(message, /references uncataloged entity ID `C-NOT-REAL`/);
  assert.match(message, /references uncataloged entity ID `K-NOT-REAL`/);
  assert.match(message, /references uncataloged entity ID `V-NOT-REAL`/);
  assert.match(message, /Lifecycle must report catalog status `draft`/);
});

test('loads quoted catalog scalars and the governed default draft status', () => {
  const quotedRoot = createRoot();
  fs.writeFileSync(
    path.join(quotedRoot, 'spec', 'fixtures', 'quoted.yml'),
    'id: "P-QUOTED-BUTTON"\ntype: "fixture"\nstatus: "active"\n',
    'utf8'
  );
  writeValidMatrices(quotedRoot, {
    'Proto UI chain': 'P-QUOTED-BUTTON',
    Lifecycle: 'P-QUOTED-BUTTON=active',
  });
  assert.deepEqual(validateCoverageMatrices({ rootDir: quotedRoot }), { matrixCount: 2 });

  const defaultRoot = createRoot();
  fs.writeFileSync(
    path.join(defaultRoot, 'spec', 'fixtures', 'default-status.yaml'),
    'id: P-DEFAULT-BUTTON\ntype: fixture\n',
    'utf8'
  );
  writeValidMatrices(defaultRoot, {
    'Proto UI chain': 'P-DEFAULT-BUTTON',
    Lifecycle: 'P-DEFAULT-BUTTON=draft',
    State: 'blocked',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.deepEqual(validateCoverageMatrices({ rootDir: defaultRoot }), { matrixCount: 2 });
});

test('binds every website lifecycle status to its exact catalog entity', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'P-BASE-BUTTON=active; A-WEB-COMPONENT-0001=draft',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  const message = validationMessage(root);
  assert.match(
    message,
    /Lifecycle must associate catalog entity `P-BASE-BUTTON` with status `draft`/
  );
  assert.match(
    message,
    /Lifecycle must associate catalog entity `A-WEB-COMPONENT-0001` with status `active`/
  );
});

test('rejects swapped per-entity lifecycle statuses in the Harness chain', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'Proto UI chain': 'P-BASE-SCROLL-AREA active; A-REACT-18-19-0001 draft',
    }
  );
  const message = validationMessage(root);
  assert.match(
    message,
    /Proto UI chain must associate catalog entity `P-BASE-SCROLL-AREA` with status `draft`/
  );
  assert.match(
    message,
    /Proto UI chain must associate catalog entity `A-REACT-18-19-0001` with status `active`/
  );
});

test('rejects stable website states backed by non-active catalog entities', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Prototype is draft; Adapter profile is active',
    State: 'ready',
  });
  assert.match(
    validationMessage(root),
    /website State `ready` requires every catalog entity in Proto UI chain to be active; received `P-BASE-BUTTON` \(draft\)/
  );
});

test('rejects removed catalog entities from every shipped Website state', () => {
  const cases = [
    {
      State: 'ready',
    },
    {
      State: 'self-hosted',
    },
    {
      ID: 'www.shell.site-title',
      Path: '`apps/www/src/components/override/SiteTitle.astro`',
      'Target class': 'native/static',
      State: 'native/static',
      'Dependency and owner': 'No Proto UI dependency; owner: website team',
      'Escape or exemption': 'Reason: native semantics remain the complete information path',
      'Re-review or removal issue': '#420 if application-owned interaction is introduced',
    },
    {
      ID: 'www.demo.brutalist-theme-style',
      Path: '`apps/www/src/components/BrutalistPageStyle.astro`',
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Dependency and owner': 'No Proto UI dependency; owner: website demos',
      'Escape or exemption': 'Reason: static theme infrastructure remains bounded to demos',
      'Re-review or removal issue': '#420 if the theme gains interaction state',
    },
  ];

  for (const overrides of cases) {
    const root = createRoot();
    writeValidMatrices(root, {
      'Proto UI chain': 'P-REMOVED-BUTTON',
      Lifecycle: 'P-REMOVED-BUTTON=removed',
      ...overrides,
    });
    assert.match(
      validationMessage(root),
      new RegExp(
        `shipped website State \`${overrides.State}\` must not consume removed catalog entities: \`P-REMOVED-BUTTON\``
      )
    );
  }
});

test('rejects a stable website state that removes every catalog identity from its chain', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'Generated facade with no catalog identity',
    Lifecycle: 'Claimed stable',
    State: 'self-hosted',
  });
  assert.match(
    validationMessage(root),
    /website State `self-hosted` must inventory at least one catalog entity in Proto UI chain/
  );
});

test('rejects a stable website state backed only by an active Adapter profile', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'A-WEB-COMPONENT-0001',
    Lifecycle: 'A-WEB-COMPONENT-0001=active',
    State: 'ready',
  });
  assert.match(
    validationMessage(root),
    /website State ready requires an active Prototype or Module semantic owner.*Adapter profile alone is insufficient/
  );
});

test('rejects self-hosted website rows backed only by prose evidence', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: 'Browser checks passed',
  });

  assert.match(
    validationMessage(root),
    /self-hosted rows must bind an exact internal\/website\/evidence\/\*\* path in Evidence/
  );
});

test('rejects self-hosted website evidence without every closeout dimension', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(absoluteEvidencePath, 'Build: passed\n', 'utf8');
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /self-hosted evidence record .* missing required `Accessibility:` label/);
  assert.match(message, /self-hosted evidence record .* missing required `Screenshot:` label/);
  assert.match(message, /self-hosted evidence record .* missing required `Multi-frame:` label/);
});

test('rejects self-hosted website evidence without an exact commit SHA', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({ Commit: 'not-an-exact-sha' }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.match(
    validationMessage(root),
    /self-hosted evidence record .* must bind Commit to an exact 40-character Git SHA/
  );
});

test('rejects a nonexistent self-hosted Website evidence commit', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const nonexistentCommit = 'f'.repeat(40);
  writeSelfHostedWebsiteArtifacts(root, nonexistentCommit);
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: nonexistentCommit }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(
    validationMessage(root),
    /self-hosted evidence Commit `f{40}` does not resolve to a Git commit/
  );
});

test('rejects self-hosted Website results bound to a different revision', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, revision, 'e'.repeat(40));
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(validationMessage(root), /self-hosted evidence Results revision must equal Commit/);
});

test('rejects a missing self-hosted website evidence artifact', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/missing-closeout.md';
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.ok(
    validationMessage(root).includes(
      `Evidence references missing repository path \`${evidencePath}\``
    )
  );
});

test('rejects empty acceptance dimensions in self-hosted website evidence', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({ Screenshot: '—' }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.match(
    validationMessage(root),
    /self-hosted evidence record .* required `Screenshot:` label must have a meaningful value/
  );
});

test('rejects vacuous self-hosted website evidence labels without reproducible artifacts', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({
      Routes: 'ok',
      Build: 'ok',
      Browser: 'ok',
      Accessibility: 'ok',
      Screenshot: 'ok',
      'Multi-frame': 'ok',
      Commands: 'ok',
      Results: 'ok',
    }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /Routes: must name at least one exact `\/route\/`/);
  assert.match(message, /Commands: must name at least one executable command in inline code/);
  for (const label of [
    'Build:',
    'Browser:',
    'Accessibility:',
    'Screenshot:',
    'Multi-frame:',
    'Results:',
  ]) {
    assert.ok(
      message.includes(
        `${label} must bind an exact retained artifact under internal/website/evidence/**`
      )
    );
  }
});

test('rejects mislabeled screenshots and canonically duplicate multi-frame manifests', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  writeSelfHostedWebsiteArtifacts(root);
  fs.writeFileSync(
    path.join(root, 'internal/website/evidence/s14/home-desktop.png'),
    'not an image',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'internal/website/evidence/s14/navigation-frames.json'),
    JSON.stringify({
      frames: [
        'internal/website/evidence/s14/navigation-before.png',
        'internal/website/evidence/s14/nested/../navigation-before.png',
      ],
    }),
    'utf8'
  );
  fs.writeFileSync(absoluteEvidencePath, validSelfHostedWebsiteEvidence(), 'utf8');
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /Screenshot: retained artifact must be a recognized image file/);
  assert.match(
    message,
    /Multi-frame: JSON manifest must retain at least two canonically distinct frame paths/
  );
});

test('rejects fake images and traversal in multi-frame manifests', () => {
  for (const mode of ['fake-images', 'traversal']) {
    const root = createRoot();
    const evidencePath = 'internal/website/evidence/s14/closeout.md';
    writeSelfHostedWebsiteArtifacts(root);
    const manifestPath = path.join(root, 'internal/website/evidence/s14/navigation-frames.json');
    if (mode === 'fake-images') {
      fs.writeFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-before.png'),
        'fake before',
        'utf8'
      );
      fs.writeFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-after.png'),
        'fake after',
        'utf8'
      );
    } else {
      const outsidePath = path.join(root, 'internal/website/outside.png');
      fs.copyFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-after.png'),
        outsidePath
      );
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          frames: [
            'internal/website/evidence/s14/navigation-before.png',
            'internal/website/evidence/s14/../../outside.png',
          ],
        }),
        'utf8'
      );
    }
    fs.writeFileSync(path.join(root, evidencePath), validSelfHostedWebsiteEvidence(), 'utf8');
    writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

    const message = validationMessage(root);
    if (mode === 'fake-images') {
      assert.match(message, /Multi-frame: JSON manifest frame must be a recognized image file/);
    } else {
      assert.match(
        message,
        /Multi-frame: JSON manifest frame must be an existing retained artifact under internal\/website\/evidence\/\*\*/
      );
    }
  }
});

test('accepts reproducible multi-dimensional evidence for a self-hosted website row', () => {
  const root = createRoot();
  const implementationPath = path.join(root, 'apps/www/src/components/override/Search.astro');
  fs.mkdirSync(path.dirname(implementationPath), { recursive: true });
  fs.writeFileSync(implementationPath, '<main>search</main>', 'utf8');
  const websiteBindings = [['apps/www/src/components/override/Search.astro', ['www.shell.search']]];
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  writeSelfHostedWebsiteArtifacts(root, revision);
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(
    root,
    { State: 'self-hosted', Evidence: `\`${evidencePath}\`` },
    {},
    { websiteBindings }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });
});

test('requires the raw-runtime row to inventory every shipped active Adapter profile', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.demo.raw-adapter-runtimes',
    'Proto UI chain': 'A-WEB-COMPONENT-0001; A-REACT-18-19-0001; A-VUE-3-0001',
    Lifecycle: 'All referenced Adapter profiles are active',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.demo\.raw-adapter-runtimes` must inventory catalog entity `A-VUE-2-0001`/
  );
});

test('reports both required files with actionable markers when they are missing', () => {
  const issues = collectCoverageMatrixIssues({ rootDir: createRoot() });
  assert.equal(issues.length, 2);
  assert.match(issues[0], /internal\/website\/self-hosting-coverage-matrix\.md: file is missing/);
  assert.match(issues[0], /coverage-matrix:start website/);
  assert.match(issues[1], /internal\/agent-harness\/dogfood-coverage-matrix\.md: file is missing/);
  assert.match(issues[1], /coverage-matrix:start agent-harness/);
});

test('rejects a reordered or renamed main-table header', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const badHeaders = [...website.headers];
  badHeaders[2] = 'Job';
  writeMatrix(root, website, [validWebsiteRow()], { headers: badHeaders });
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  assert.match(validationMessage(root), /header mismatch; expected exactly/);
});

test('rejects a blank or prose interruption that splits the governed matrix table', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const matrixPath = path.join(root, MATRIX_CONFIGS[0].relativePath);
  const content = fs.readFileSync(matrixPath, 'utf8');
  fs.writeFileSync(
    matrixPath,
    content.replace('\n| www.shell.primary-nav |', '\n\n| www.shell.primary-nav |'),
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /interrupts the matrix; data rows must remain contiguous through <!-- coverage-matrix:end -->/
  );
});

test('rejects unstable and duplicate IDs plus unsupported classifications', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const rows = [
    validWebsiteRow({ ID: 'Search', 'Target class': 'unknown', State: 'unclassified' }),
    validWebsiteRow({ ID: 'Search' }),
  ];
  writeMatrix(root, website, rows);
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /unstable ID/);
  assert.match(message, /duplicate ID/);
  assert.match(message, /must not contain unknown or unclassified/);
  assert.match(message, /unsupported Target class/);
  assert.match(message, /unsupported State/);
});

test('requires an issue for every blocked or research row', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Dependency and owner': 'Harness team' });
  assert.match(validationMessage(root), /research rows must link a dependency as #<issue>/);
});

test('requires a concrete dependency owner for every blocked or research row', () => {
  for (const state of ['blocked', 'research']) {
    const root = createRoot();
    writeValidMatrices(root, {}, { State: state, 'Dependency and owner': '#519' });
    assert.match(
      validationMessage(root),
      new RegExp(`${state} rows must give the .*label a concrete value`)
    );
  }
});

test('rejects dependency issues absent from the repository-owned snapshot', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Dependency and owner': '#999999; owner: scroll domain' });

  assert.match(
    validationMessage(root),
    /dependency issue #999999 is absent from the Proto-UI\/Proto-UI governance snapshot/
  );
});

test('rejects closed dependency issues for blocked and research rows', () => {
  const root = createRoot();
  writeGovernanceSnapshot(root, { 519: { state: 'CLOSED', stateReason: 'COMPLETED' } });
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /dependency issue #519 must be OPEN for a research row; snapshot state is CLOSED\/COMPLETED/
  );
});

test('rejects dependency owners not reviewed in governance metadata', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Dependency and owner': '#519; owner: unrelated team' });

  assert.match(
    validationMessage(root),
    /dependency owner `unrelated team` is not reviewed for issue #519/
  );
});

test('requires reasons and re-review triggers for native and infrastructure exemptions', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
  });
  const message = validationMessage(root);
  assert.match(message, /must state a reason in Escape or exemption/);
  assert.match(message, /must state a re-review trigger/);
});

test('rejects vague exemptions without structured owner, reason, limit, and issue fields', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'Website platform',
    'Escape or exemption': 'temporary',
    'Re-review or removal issue': 'later',
  });
  const message = validationMessage(root);
  assert.match(message, /must give the `owner:` or `owners:` label a concrete value/);
  assert.match(message, /must give the `reason:` label a substantive explanation/);
  assert.match(message, /must state a bounded `limit:` or conditional trigger/);
  assert.match(message, /must link re-review or removal as #<issue>/);
});

test('rejects Website difficulty values outside F1 through F5', () => {
  const root = createRoot();
  writeValidMatrices(root, { Difficulty: 'F13' });
  assert.match(
    validationMessage(root),
    /unsupported Difficulty `F13`; allowed: F1, F2, F3, F4, F5/
  );
});

test('rejects empty Website host and rendering strategy values', () => {
  const root = createRoot();
  writeValidMatrices(root, { 'WC host and SSR/no-JS strategy': 'WC:; SSR:; no-JS:' });
  const message = validationMessage(root);
  for (const label of ['WC:', 'SSR:', 'no-JS:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('does not let an empty Website strategy consume the next required label', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'WC host and SSR/no-JS strategy':
      'WC: SSR: meaningful light DOM remains; no-JS: native link remains',
  });
  assert.match(validationMessage(root), /required `WC:` label must have a meaningful value/);
});

test('rejects empty exemption labels and issue-only re-review text', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'owner:',
    'Escape or exemption': 'Reason: only',
    'Re-review or removal issue': '#420',
  });
  const message = validationMessage(root);
  assert.match(message, /must give the `owner:` or `owners:` label a concrete value/);
  assert.match(message, /must give the `reason:` label a substantive explanation/);
  assert.match(message, /must state a bounded `limit:` or conditional trigger/);
});

test('requires every native/static website row to be registered in the manifest', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.unregistered-static',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor owns complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /native\/static website row `www\.shell\.unregistered-static` must be registered in a non-interactive surface manifest/
  );
});

test('requires every non-interactive manifest entry to retain its expected class and state', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.site-title',
    'Target class': 'site-composition',
    State: 'blocked',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.match(
    validationMessage(root),
    /non-interactive manifest row `www\.shell\.site-title` must use Target class `native\/static` and State `native\/static`/
  );
});

test('rejects deletion of a non-native static projection even when totals are updated', () => {
  const root = createRoot();
  const websiteRows = rowsWithRequiredIds(
    MATRIX_CONFIGS[0],
    validWebsiteRow(),
    validWebsiteRow
  ).filter((row) => row.ID !== 'www.shell.social-links');
  writeMatrix(root, MATRIX_CONFIGS[0], websiteRows);
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /required inventory surface ID `www\.shell\.social-links` is missing from non-interactive manifest/
  );
});

test('rejects class or state drift for a non-native static projection', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.social-links',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchors own complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /non-interactive manifest row `www\.shell\.social-links` must use Target class `site-composition` and State `research`/
  );
});

test('requires manifest rows to retain exact source-path bindings', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.site-title',
    Path: 'apps/www/src/components/Missing.astro',
    Evidence: 'source baseline without an exact path code span',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor owns complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.shell\.site-title` must bind repository path `apps\/www\/src\/components\/override\/SiteTitle\.astro` as an exact code span/
  );
});

test('requires non-native static projections to retain exact source-path bindings', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.social-links',
    Path: 'apps/www/src/components/Missing.astro',
    Evidence: 'source baseline without an exact path code span',
    'Target class': 'site-composition',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.shell\.social-links` must bind repository path `apps\/www\/src\/components\/override\/SocialIcons\.astro` as an exact code span/
  );
});

test('rejects deletion of the PR #580 document-flow closure binding', () => {
  const root = createRoot();
  const row = validDocumentSemanticsRow();
  writeValidMatrices(root, {
    ...row,
    Evidence: row.Evidence.replace(
      '; `apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts`',
      ''
    ),
  });

  assert.match(
    validationMessage(root),
    /closure binding for `www\.content\.document-semantics` must retain `apps\/www\/src\/content\/docs\/zh-cn\/docs-content-flow\.browser\.test\.ts`/
  );
});

test('rejects a stale PR #580 document-flow implementation head', () => {
  const root = createRoot();
  const row = validDocumentSemanticsRow();
  writeValidMatrices(root, {
    ...row,
    Evidence: row.Evidence.replace(
      '2a6d5f3208d91e5c9862a67408a39ff208d43306',
      '0123456789abcdef0123456789abcdef01234567'
    ),
  });

  assert.match(
    validationMessage(root),
    /closure binding for `www\.content\.document-semantics` must retain reviewed PR #580 head `2a6d5f3208d91e5c9862a67408a39ff208d43306`/
  );
});

test('requires a removal issue for a temporary escape', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Escape or exemption': 'Temporary raw Adapter import',
    'Re-review or removal issue': 'Remove after migration',
  });
  assert.match(validationMessage(root), /temporary escapes must link their removal as #<issue>/);
});

test('requires website and Harness policy labels on every row', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    { 'WC host and SSR/no-JS strategy': 'generated facade' },
    {
      'App state and semantic events': 'message IDs',
      'Production host and equivalence evidence': 'React production',
    }
  );
  const message = validationMessage(root);
  for (const label of [
    'WC:',
    'SSR:',
    'no-JS:',
    'App state:',
    'Events:',
    'Host:',
    'React:',
    'Vue:',
  ]) {
    assert.ok(message.includes(`missing required \`${label}\` label`));
  }
});

test('rejects empty Harness state, event, host, and equivalence values', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'App state and semantic events': 'App state:; Events:',
      'Production host and equivalence evidence': 'Host:; WC:; React:; Vue:',
    }
  );
  const message = validationMessage(root);
  for (const label of ['App state:', 'Events:', 'Host:', 'WC:', 'React:', 'Vue:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('rejects punctuated placeholder values in Harness policy labels', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'App state and semantic events': 'App state: none.; Events: n/a.',
      'Production host and equivalence evidence': 'Host: none.; WC: n/a.; React: none.; Vue: n/a.',
    }
  );
  const message = validationMessage(root);
  for (const label of ['App state:', 'Events:', 'Host:', 'WC:', 'React:', 'Vue:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('requires app-local-proto state to retain the app-local target class', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Target class': 'composition', State: 'app-local-proto' });
  assert.match(
    validationMessage(root),
    /State `app-local-proto` requires Target class `app-local-proto`, received `composition`/
  );
});

test('requires owner and evidence cells to name concrete ownership and evidence', () => {
  const root = createRoot();
  writeValidMatrices(root, { 'Current owner': '—', Evidence: 'TBD' });
  const message = validationMessage(root);
  assert.match(message, /Current owner must name an owner/);
  assert.match(message, /Evidence must name a baseline, executable check, or evidence path/);
});

test('rejects stale explicit website paths and terminal class/state mismatches', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    Path: '`apps/www/src/components/Missing.astro`',
    'Target class': 'native/static',
    State: 'ready',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor needs no protocol owner',
    'Re-review or removal issue': '#420 if interaction state is added',
  });
  const message = validationMessage(root);
  assert.match(message, /Path references missing repository path/);
  assert.match(message, /Target class `native\/static` requires State `native\/static`/);

  const reverseRoot = createRoot();
  writeValidMatrices(reverseRoot, {
    'Target class': 'official-prototype',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'owner: website team',
    'Escape or exemption': 'Reason: temporary website infrastructure boundary',
    'Re-review or removal issue': '#420 when the boundary changes',
  });
  assert.match(
    validationMessage(reverseRoot),
    /State `infrastructure-exempt` requires Target class `infrastructure-exempt`, received `official-prototype`/
  );
});

test('allows an app-local prototype row to advance to dogfooded with implementation evidence', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence:
        'Build: `internal/agent-harness/evidence/m1/build.log`; Browser: `internal/agent-harness/evidence/m1/browser-results.json`; Accessibility: `internal/agent-harness/evidence/m1/accessibility-results.json`; Lifecycle: `internal/agent-harness/evidence/m1/lifecycle-results.json`; Design: `internal/agent-harness/evidence/m1/design-review.txt`; `internal/agent-harness/evidence/m1/tool-invocation.md`',
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });
});

test('requires dogfooded Harness evidence to bind an exact 40-character Git SHA', () => {
  for (const commit of ['latest', 'abc123']) {
    const root = createRoot();
    const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
    const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
    for (const [repositoryPath, content] of [
      [implementationPath, 'fixture'],
      [
        evidencePath,
        `Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: ${commit}\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n`,
      ],
    ]) {
      const absolutePath = path.join(root, repositoryPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf8');
    }
    writeValidMatrices(
      root,
      {},
      {
        ID: 'harness.run.tool-invocation',
        'Target owner': 'Harness app-local Tool Invocation prototype',
        'Target class': 'app-local-proto',
        State: 'dogfooded',
        Path: `\`${implementationPath}\``,
        Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
        'Dependency and owner': 'No blocker; owner: Harness application',
      }
    );
    assert.match(
      validationMessage(root),
      /dogfooded evidence record .* must bind Commit to an exact 40-character Git SHA/
    );
  }
});

test('rejects a nonexistent dogfooded Harness evidence commit', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  const nonexistentCommit = 'f'.repeat(40);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, nonexistentCommit);
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(
    validationMessage(root),
    /dogfooded evidence Commit `f{40}` does not resolve to a Git commit/
  );
});

test('rejects dogfooded Harness results bound to a different revision', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision, 'e'.repeat(40));
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(validationMessage(root), /dogfooded evidence Results revision must equal Commit/);
});

test('requires a dogfooded implementation path under the Harness application root', () => {
  const root = createRoot();
  const implementationPath = 'spec/fixtures/not-harness.ts';
  const evidencePath = 'internal/agent-harness/evidence/m1/wrong-root.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: wrong root\nCommands: pnpm test\nResults: passed\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root),
    /dogfooded rows must bind at least one existing implementation file under apps\/agent-harness\//
  );
});

test('requires dogfooded Harness implementation paths to bind regular files', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run';
  const evidencePath = 'internal/agent-harness/evidence/m1/run.md';
  fs.mkdirSync(path.join(root, implementationPath), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, evidencePath),
    'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: run\nCommands: pnpm test\nResults: passed\n',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  const message = validationMessage(root);
  assert.match(message, /dogfooded implementation path must be a file/);
  assert.match(
    message,
    /dogfooded rows must bind at least one existing implementation file under apps\/agent-harness\//
  );
});

test('rejects dogfooded Harness rows that consume removed catalog entities', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/RemovedButton.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/removed-button.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: removed button\nCommands: pnpm test\nResults: passed\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Removed Button prototype',
      'Target class': 'app-local-proto',
      'Proto UI chain': 'P-REMOVED-BUTTON removed',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root),
    /dogfooded rows must not consume removed catalog entities: `P-REMOVED-BUTTON`/
  );
});

test('rejects dogfooded Harness rows without real multi-dimensional evidence', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: '`apps/agent-harness/src/run/Missing.tsx`',
      Evidence: 'shipped',
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(message, /dogfooded implementation path does not exist/);
  assert.match(
    message,
    /dogfooded rows must bind an exact internal\/agent-harness\/evidence\/\*\* path/
  );
  for (const label of ['Build:', 'Browser:', 'Accessibility:', 'Lifecycle:', 'Design:']) {
    assert.ok(message.includes(`missing required \`${label}\` label`));
  }
});

test('rejects a dogfooded evidence file without reproducible record fields', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [evidencePath, 'Build: passed'],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(message, /dogfooded evidence record .* missing required `Browser:` label/);
  assert.match(message, /dogfooded evidence record .* missing required `Commit:` label/);
  assert.match(message, /dogfooded evidence record .* missing required `Commands:` label/);
});

test('rejects empty required values in dogfooded matrix and evidence records', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build:\nBrowser:\nAccessibility:\nLifecycle:\nDesign:\nCommit:\nEnvironment:\nFixtures:\nCommands:\nResults:\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build:; Browser:; Accessibility:; Lifecycle:; Design:; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(
    message,
    /dogfooded evidence record .* required `Commit:` label must have a meaningful value/
  );
  assert.match(
    message,
    /dogfooded evidence record .* required `Results:` label must have a meaningful value/
  );
  assert.match(message, /required `Build:` label must have a meaningful value/);
  assert.match(message, /required `Design:` label must have a meaningful value/);
});

test('protects every authoritative Harness baseline row from deletion', () => {
  const root = createRoot();
  const harness = MATRIX_CONFIGS[1];
  const harnessRows = rowsWithRequiredIds(harness, validHarnessRow(), validHarnessRow).filter(
    (row) => row.ID !== 'harness.composer.root'
  );
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(), validWebsiteRow)
  );
  writeMatrix(root, harness, harnessRows);
  assert.match(
    validationMessage(root),
    /required inventory surface ID `harness\.composer\.root` is missing/
  );
});

test('requires newly exported Harness user-facing surfaces to have a matrix disposition', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/agent-harness/src/run/NewRunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function NewRunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );

  assert.match(
    validationMessage(root),
    /Harness user-facing source `apps\/agent-harness\/src\/run\/NewRunSummary\.tsx` is not classified by a matrix row or Source-scan binding/
  );
});

test('inventories handwritten Harness components beside generated proto-ui facades', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/agent-harness/src/proto-ui/components/manual.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function ManualSurface() { return <section>Manual</section>; }',
    'utf8'
  );

  assert.ok(
    validationMessage(root).includes(
      `Harness user-facing source \`${relativePath}\` is not classified by a matrix row or Source-scan binding`
    )
  );
});

test('scans forbidden mechanics in handwritten files beside generated Harness facades', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/proto-ui/components/manual-action.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function ManualAction() { document.addEventListener("selectionchange", sync); return <section>Manual</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('excludes only exact CLI-generated Harness facade indexes', () => {
  const root = createRoot();
  const generatedPaths = [
    'apps/agent-harness/src/proto-ui/components/index.ts',
    'apps/agent-harness/src/proto-ui/components/react/index.ts',
    'apps/agent-harness/src/proto-ui/components/vue/index.ts',
    'apps/agent-harness/src/proto-ui/components/wc/index.ts',
  ];
  for (const relativePath of generatedPaths) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "import React from 'react'; export function GeneratedFacade() { document.addEventListener('selectionchange', sync); return React.createElement('section'); }",
      'utf8'
    );
  }
  writeValidMatrices(root);

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('discovers exported Harness surfaces rendered with React.createElement', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/agent-harness/src/run/ClassicRunSummary.ts',
      "import * as React from 'react'; export function ClassicRunSummary() { return React.createElement('section', null, 'Run summary'); }",
    ],
    [
      'apps/agent-harness/src/run/AliasedRunSummary.js',
      "import { createElement as h } from 'react'; export const AliasedRunSummary = () => h('section', null, 'Run summary');",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(
      message.includes(
        `Harness user-facing source \`${relativePath}\` is not classified by a matrix row or Source-scan binding`
      )
    );
  }
});

test('allows an exported Harness surface to reuse a row through an explicit source binding', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NewRunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function NewRunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      harnessBindings: [[relativePath, ['harness.transcript.viewport']]],
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts a Harness user-facing source directly owned by a matrix Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function RunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts a planned Harness source directly owned by an exact plain-text matrix Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  writeValidMatrices(root, {}, { ID: 'harness.shell.frame', Path: relativePath });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <main>Harness</main>; }',
    'utf8'
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat prose containing a Harness path as a direct matrix Path owner', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <main>Harness</main>; }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.shell.frame',
      Path: `Planned implementation: ${relativePath}`,
    }
  );

  assert.match(
    validationMessage(root),
    /Harness user-facing source `apps\/agent-harness\/src\/app\/AppShell\.tsx` is not classified/
  );
});

test('rejects forbidden interaction state machines in ordinary Harness sources', () => {
  const cases = [
    ['RawKeyboard.tsx', 'export const RawKeyboard = () => <div onKeyDown={() => {}}>x</div>;'],
    [
      'RawCreateElement.ts',
      "import { createElement as h } from 'react'; export const Raw = () => h('div', { onPointerDown: dismiss });",
    ],
    ['Listener.ts', 'window.addEventListener("pointerdown", dismiss);'],
    ['Focus.ts', 'const element = document.querySelector("button"); element?.focus();'],
    ['Scroll.ts', 'const element = document.querySelector("main"); element?.scrollIntoView();'],
    [
      'Aria.ts',
      'const element = document.querySelector("button"); element?.setAttribute("aria-expanded", "true");',
    ],
    [
      'ClassMutation.ts',
      'const element = document.querySelector("div"); element?.classList.toggle("open");',
    ],
    ['Observer.ts', 'const observer = new ResizeObserver(reflow);'],
  ];

  for (const [fileName, content] of cases) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${fileName}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.ok(
      validationMessage(root).includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('rejects governed DOM state property assignments on bounded receivers', () => {
  const cases = [
    ['ScrollTop', 'scrollTop', '+=', false],
    ['ScrollLeft', 'scrollLeft', '=', true],
    ['InputValue', 'value', '=', false],
    ['SelectionStart', 'selectionStart', '=', true],
    ['SelectionEnd', 'selectionEnd', '=', false],
    ['SelectionDirection', 'selectionDirection', '=', true],
  ];
  for (const [stem, property, operator, elementAccess] of cases) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${stem}.ts`;
    const absolutePath = path.join(root, relativePath);
    const propertyAccess = elementAccess ? `["${property}"]` : `.${property}`;
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `const element = document.querySelector("input"); element${propertyAccess} ${operator} next;`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.ok(
      validationMessage(root).includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      ),
      `${property} assignment must remain protected by the Harness forbidden-state scan`
    );
  }
});
test('detects unary updates to governed DOM state', () => {
  const root = createRoot();
  const websitePath = 'apps/www/src/content/docs/UnaryWebsiteScroll.ts';
  const harnessPath = 'apps/agent-harness/src/run/UnaryHarnessScroll.ts';
  const safePath = 'apps/agent-harness/src/run/DomainUnaryState.ts';
  for (const [relativePath, content] of [
    [websitePath, 'const pane = document.querySelector("div"); pane.scrollTop++;'],
    [harnessPath, 'const pane = document.querySelector("div"); --pane.scrollLeft;'],
    [safePath, 'const model = { scrollTop: 0 }; model.scrollTop++;'],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root, {}, { Path: `\`${harnessPath}\`` });

  const message = validationMessage(root);
  assert.ok(message.includes(`interactive website source \`${websitePath}\` is not bound`));
  assert.ok(
    message.includes(
      `Harness source \`${harnessPath}\` contains a forbidden interaction or DOM state machine`
    )
  );
  assert.ok(!message.includes(safePath));
});

test('resolves imported native handler objects spread into intrinsic elements', () => {
  const root = createRoot();
  const componentPath = 'apps/agent-harness/src/run/ImportedNativeHandlers.tsx';
  const handlersPath = 'apps/agent-harness/src/run/native-handlers.ts';
  for (const [relativePath, content] of [
    [handlersPath, 'export const handlers = { onKeyDown: () => {} };'],
    [
      componentPath,
      "import { handlers } from './native-handlers'; export const Raw = () => <button {...handlers}>raw</button>;",
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root, {}, { Path: `\`${componentPath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${componentPath}\` contains a forbidden interaction or DOM state machine`
    )
  );

  const safeRoot = createRoot();
  const safeSourcePath = 'apps/agent-harness/src/run/ImportedSafeProps.tsx';
  const safePropsPath = 'apps/agent-harness/src/run/safe-props.ts';
  for (const [relativePath, content] of [
    [safePropsPath, "export const presentation = { title: 'safe' };"],
    [
      safeSourcePath,
      "import { presentation } from './safe-props'; function Safe() { return <button {...presentation}>safe</button>; }",
    ],
  ]) {
    const absolutePath = path.join(safeRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(safeRoot);
  assert.deepEqual(validateCoverageMatrices({ rootDir: safeRoot }), { matrixCount: 2 });
});

test('does not treat domain-model property assignments as DOM state machines', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DomainState.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function update(model) { model.value = "ready"; model.scrollTop += 1; model.selectionStart = 0; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects bounded event receiver aliases and native JSX handler spreads in every script extension', () => {
  for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
    for (const [stem, content] of [
      ['CurrentTargetFocus', 'export function focusCurrent(ev) { ev.currentTarget.focus(); }'],
      [
        'NativeHandlerSpread',
        'const onKeyDown = () => {}; const handlers = { onKeyDown }; export const Raw = () => <div {...handlers}>raw</div>;',
      ],
    ]) {
      const root = createRoot();
      const relativePath = `apps/agent-harness/src/run/${stem}.${extension}`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf8');
      writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

      assert.ok(
        validationMessage(root).includes(
          `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
        ),
        `${relativePath} must remain protected by the Harness forbidden-state scan`
      );
    }
  }
});

test('follows lexical aliases for native JSX handler spread objects', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AliasedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; const handlers = { onKeyDown }; const alias = handlers; export const Raw = () => <div {...alias}>raw</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('follows plain identifier assignment flow for native JSX handler spreads', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AssignedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; let handlers; handlers = { onKeyDown }; export const Raw = () => <div {...handlers}>raw</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('does not treat compound, property, or inner-scope assignments as outer object bindings', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NonPlainAssignments.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'const onKeyDown = run;',
      'let compound = {}; compound ||= { onKeyDown };',
      'let property = {}; property.handlers = { onKeyDown };',
      'let scoped = {}; function mutate() { scoped = { onKeyDown }; }',
      'export const Safe = () => <><div {...compound}/><div {...property}/><div {...scoped}/></>;',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not let function-like parameters hide later outer native handler spreads', () => {
  for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
    for (const [stem, shadowDeclaration] of [
      ['Function', 'function Safe(handlers) { return <div {...handlers}>safe</div>; }'],
      ['Arrow', 'const Safe = (handlers) => <div {...handlers}>safe</div>;'],
    ]) {
      const root = createRoot();
      const relativePath = `apps/agent-harness/src/run/OuterHandlersAfter${stem}.${extension}`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(
        absolutePath,
        `const onKeyDown = run; const handlers = { onKeyDown }; ${shadowDeclaration} export const Raw = () => <div {...handlers}>raw</div>;`,
        'utf8'
      );
      writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

      assert.ok(
        validationMessage(root).includes(
          `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
        ),
        `${relativePath} must resolve the outer handler binding after the function-like shadow`
      );
    }
  }
});

test('lets a function parameter shadow an outer native handler object', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ShadowedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; const handlers = { onKeyDown }; export function Safe(handlers) { return <div {...handlers}>safe</div>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not permit a forbidden Harness state machine merely because it is bound to any row', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RawKeyboardHelper.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'document.onkeydown = handleKeyDown;', 'utf8');
  writeValidMatrices(
    root,
    {},
    {},
    {
      harnessBindings: [[relativePath, ['harness.transcript.viewport']]],
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/RawKeyboardHelper\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('allows bounded interaction mechanics only for an exact infrastructure-exempt Harness disposition', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'const observer = new ResizeObserver(reflow);', 'utf8');
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${relativePath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 if it owns surrounding controls or focus behavior',
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not let an infrastructure binding exempt a forbidden unrelated source', () => {
  const root = createRoot();
  const exemptPath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  const rawPath = 'apps/agent-harness/src/run/raw-focus.ts';
  fs.mkdirSync(path.join(root, 'apps', 'agent-harness', 'src', 'run'), { recursive: true });
  fs.writeFileSync(
    path.join(root, rawPath),
    'export function focusCurrent(ev) { ev.currentTarget.focus(); }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${exemptPath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 if it owns surrounding controls or focus behavior',
    },
    {
      harnessBindings: [[rawPath, ['harness.infrastructure.viewport-engine']]],
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/raw-focus\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('requires a source-exact limit before an infrastructure row exempts forbidden mechanics', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, relativePath), 'new ResizeObserver(reflow);', 'utf8');
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${relativePath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption': 'Reason: bounded viewport observation is infrastructure only',
      'Re-review or removal issue': '#533 when the viewport policy changes',
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/infrastructure\/viewport-engine\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('does not apply this-exact-source infrastructure prose to multiple Path sources', () => {
  const root = createRoot();
  const sourcePaths = [
    'apps/agent-harness/src/infrastructure/viewport-engine.ts',
    'apps/agent-harness/src/infrastructure/focus-engine.ts',
  ];
  for (const relativePath of sourcePaths) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'new ResizeObserver(reflow);', 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: sourcePaths.map((sourcePath) => `\`${sourcePath}\``).join(', '),
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 when the viewport policy changes',
    }
  );

  const message = validationMessage(root);
  for (const relativePath of sourcePaths) {
    assert.ok(
      message.includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('ignores Harness tests, strings, comments, and semantic component callbacks', () => {
  const root = createRoot();
  const sourceRoot = path.join(root, 'apps', 'agent-harness', 'src', 'run');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'Safe.tsx'),
    [
      'const example = "element.scrollIntoView(); window.addEventListener(\\"keydown\\", fn)";',
      '// element.focus(); new MutationObserver(fn);',
      'const onKeyDown = requestAction;',
      'const handlers = { onKeyDown };',
      'export const Safe = () => <><ProtoButton {...handlers}>Run</ProtoButton><Composer onSubmit={send} /><Button onPress={approve} /></>;',
      'function Shadowed() {',
      '  const handlers = { role: "button" };',
      '  return <div {...handlers}>Static</div>;',
      '}',
      'export function DomainModel(model) { model.currentTarget.focus(); }',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'RawKeyboard.test.tsx'),
    'export const Fixture = () => <div onKeyDown={() => {}}>fixture</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: '`apps/agent-harness/src/run/Safe.tsx`' });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('protects every authoritative Website baseline row from deletion', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(
    website,
    validWebsiteRow({ ID: 'www.docs.code-panel-expand' }),
    validWebsiteRow
  ).filter((row) => row.ID !== 'www.docs.code-panel-expand');
  writeMatrix(root, website, websiteRows);
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /required inventory surface ID `www\.docs\.code-panel-expand` is missing/
  );
});

test('rejects totals that omit a state or disagree with matrix rows', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const rows = [validWebsiteRow()];
  const badTotals = [
    '## State totals',
    '',
    '| State | Count |',
    '| --- | --- |',
    '| self-hosted | 0 |',
    '| ready | 0 |',
    '| research | 0 |',
    '| blocked | 0 |',
    '| native/static | 0 |',
  ].join('\n');
  writeMatrix(root, website, rows, { totalsText: badTotals });
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /declares ready=0, but the matrix contains 1/);
  assert.match(message, /State totals is missing `infrastructure-exempt`/);
});

test('rejects Harness target-class totals that disagree with matrix rows', () => {
  const root = createRoot();
  const harness = MATRIX_CONFIGS[1];
  const harnessRows = rowsWithRequiredIds(harness, validHarnessRow(), validHarnessRow);
  const compositionCount = harnessRows.filter(
    (row) => row['Target class'] === 'composition'
  ).length;
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(), validWebsiteRow)
  );
  writeMatrix(root, harness, harnessRows, {
    targetClassTotalsText: targetClassTotals(harness, harnessRows).replace(
      `| composition | ${compositionCount} |`,
      `| composition | ${compositionCount - 1} |`
    ),
  });
  assert.ok(
    validationMessage(root).includes(
      `Target-class totals declares composition=${compositionCount - 1}, but the matrix contains ${compositionCount}`
    )
  );
});

test('accepts an optional Total row and verifies it against the matrix size', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  const harnessRows = rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow);
  const websiteTotals = `${totals(website, websiteRows)}\n| Total | ${websiteRows.length + 1} |`;
  writeMatrix(root, website, websiteRows, { totalsText: websiteTotals });
  writeMatrix(root, MATRIX_CONFIGS[1], harnessRows);
  assert.match(
    validationMessage(root),
    new RegExp(
      `declares Total=${websiteRows.length + 1}, but the matrix contains ${websiteRows.length} rows`
    )
  );

  const correctedRoot = createRoot();
  writeMatrix(correctedRoot, website, websiteRows, {
    totalsText: `${totals(website, websiteRows)}\n| Total | ${websiteRows.length} |`,
  });
  writeMatrix(correctedRoot, MATRIX_CONFIGS[1], harnessRows);
  assert.deepEqual(validateCoverageMatrices({ rootDir: correctedRoot }), { matrixCount: 2 });
});

test('loads catalog entities from both YAML extensions', () => {
  const root = createRoot();
  const catalogPath = path.join(root, 'spec', 'fixtures', 'YmlEntity.yml');
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, 'id: P-YML-ENTITY\nstatus: active\n', 'utf8');
  writeValidMatrices(root, {
    'Proto UI chain': 'P-YML-ENTITY',
    Lifecycle: 'P-YML-ENTITY=active',
  });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects guarded Less imports with option lists', () => {
  const root = createRoot();
  for (const [relativePath, content] of [
    ['apps/www/src/styles/Optioned.less', '@import (reference) "@proto.ui/runtime/styles.less";'],
    [
      'apps/agent-harness/src/run/Optioned.less',
      '@import (reference, once) "@proto.ui/runtime/styles.less";',
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root);

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles.less` in `apps/www/src/styles/Optioned.less`'
    )
  );
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles.less` in `apps/agent-harness/src/run/Optioned.less`'
    )
  );
});

test('rejects forbidden Harness interaction sources outside infrastructure disposition', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RawState.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function ownState(element) { window.addEventListener("keydown", () => {}); element.focus(); }',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/RawState\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('reuses a planned Harness row from its plain-text Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <section>Harness</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: relativePath });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores indented Markdown code examples during interaction and import scans', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/indented-examples.mdx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      '# Examples',
      '',
      '    import "@proto.ui/runtime/styles";',
      '    button.addEventListener("click", activate);',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root);

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('classifies exported factory-rendered Website components', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/FactorySurface.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import * as React from 'react'; export function FactorySurface() { return React.createElement('section', null, 'Surface'); }",
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/FactorySurface\.ts` is not classified by a matrix row/
  );
});

test('requires exact commit SHAs in dogfooded Harness evidence records', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: latest\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(
    validationMessage(root),
    /dogfooded evidence record .* must bind Commit to an exact 40-character Git SHA/
  );
});

test('requires named owners on blocked and research rows', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { State: 'research', 'Dependency and owner': '#515' });

  assert.match(
    validationMessage(root),
    /research rows must give the `owner:` or `owners:` label a concrete value in Dependency and owner/
  );
});

test('classifies Vite query imports by their base specifier', () => {
  const root = createRoot();
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/QueryImport.astro',
      '---\nimport value from "@proto.ui/runtime?raw";\n---\n<div>{value}</div>',
    ],
    [
      'apps/agent-harness/src/run/QueryImport.ts',
      'import value from "@proto.ui/adapter-react?url"; export const query = value;',
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root);

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime?raw` in `apps/www/src/components/QueryImport.astro`'
    )
  );
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/adapter-react?url` in `apps/agent-harness/src/run/QueryImport.ts`'
    )
  );
});

test('tracks destructured DOM receiver bindings in forbidden Harness state machines', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DestructuredFocus.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'export function DestructuredFocus({ inputRef }) {',
      '  const { current: input } = inputRef;',
      '  input.focus();',
      '  return <section>Focus owner</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('rejects Harness Agent actions executed from render effects', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/EffectApproval.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { useEffect } from 'react';",
      'export function EffectApproval({ approve, requestId }) {',
      '  useEffect(() => approve(requestId), [approve, requestId]);',
      '  return <section>Approval</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('discovers interactive executable scripts under the Website public directory', () => {
  const root = createRoot();
  const relativePath = 'apps/www/public/client-state.js';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'document.addEventListener("keydown", activate);', 'utf8');
  writeValidMatrices(root);

  assert.ok(
    validationMessage(root).includes(
      `interactive website source \`${relativePath}\` is not bound to a matrix row`
    )
  );
});

test('enforces the Website consumer wall for Vite glob imports', () => {
  const root = createRoot();
  const targetPath = path.join(root, 'packages/runtime/src/runtime.ts');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, 'export const fixture = true;', 'utf8');
  const relativePath = 'apps/www/src/components/RuntimeGlob.ts';
  const specifier = '../../../../packages/runtime/src/**/*.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    `export const modules = import.meta.glob('${specifier}');`,
    'utf8'
  );
  writeValidMatrices(root);

  assert.ok(
    validationMessage(root).includes(
      `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
    )
  );
});

test('tracks nested destructured DOM receiver provenance', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NestedDestructuredFocus.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'export function NestedDestructuredFocus({ props }) {',
      '  const { inputRef: { current: input } } = props;',
      '  input.focus();',
      '  return <section>Focus owner</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('does not infer Agent-action provenance from an ordinary local domain verb', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/BudgetDraft.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'function approveBudgetDraft() { return true; }',
      'export function BudgetDraft() {',
      '  const approved = approveBudgetDraft();',
      '  return <section>{approved ? "Ready" : "Draft"}</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects imported Agent-action verbs without filename provenance', () => {
  const root = createRoot();
  const localPath = 'apps/agent-harness/src/run/LocalSend.tsx';
  const importedPath = 'apps/agent-harness/src/run/ImportedDomainApproval.tsx';
  for (const [relativePath, content] of [
    [
      localPath,
      [
        'function send() { return "sent"; }',
        'export function LocalSend() {',
        '  return <section>{send()}</section>;',
        '}',
      ].join('\n'),
    ],
    [
      importedPath,
      [
        "import { approve } from './budget-domain';",
        'export function ImportedDomainApproval() {',
        '  return <section>{approve() ? "Approved" : "Draft"}</section>;',
        '}',
      ].join('\n'),
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root, {}, { Path: `\`${localPath}\`, \`${importedPath}\`` });

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ImportedDomainApproval\.tsx` contains a forbidden interaction/
  );
});

test('rejects Agent actions during render in HOC-wrapped default exports', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/MemoSend.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { memo } from 'react';",
      "import { send } from './agent-actions';",
      'export default memo(function MemoSend() {',
      '  send();',
      '  return <section>Sending</section>;',
      '});',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('expands brace Vite globs before enforcing the Website consumer wall', () => {
  const root = createRoot();
  for (const relativePath of ['packages/runtime/src/runtime.ts', 'packages/core/src/core.ts']) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'export const fixture = true;', 'utf8');
  }
  const relativePath = 'apps/www/src/components/BraceGlob.ts';
  const specifier = '../../../../packages/{runtime,core}/src/*.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    `export const modules = import.meta.glob('${specifier}');`,
    'utf8'
  );
  writeValidMatrices(root);

  assert.ok(
    validationMessage(root).includes(
      `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
    )
  );
});

test('applies ordered negative Vite globs before consumer-wall classification', () => {
  const root = createRoot();
  const targetPath = path.join(root, 'packages/runtime/src/only.ts');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, 'export const fixture = true;', 'utf8');
  const relativePath = 'apps/www/src/components/NegatedRuntimeGlob.ts';
  const positive = '../../../../packages/runtime/src/*.ts';
  const negative = '!../../../../packages/runtime/src/only.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    `export const modules = import.meta.glob(['${positive}', '${negative}']);`,
    'utf8'
  );
  writeValidMatrices(root);

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('applies Vite negative globs globally regardless of authored order', () => {
  const root = createRoot();
  const targetPath = path.join(root, 'packages/runtime/src/only.ts');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, 'export const fixture = true;', 'utf8');
  const positive = '../../../../packages/runtime/src/*.ts';
  const negative = '!../../../../packages/runtime/src/only.ts';
  for (const [name, patterns] of [
    ['NegativeThenPositiveGlob', [negative, positive]],
    ['PositiveNegativePositiveGlob', [positive, negative, positive]],
  ]) {
    const relativePath = `apps/www/src/components/${name}.ts`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `export const modules = import.meta.glob(${JSON.stringify(patterns)});`,
      'utf8'
    );
  }
  writeValidMatrices(root);

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not execute nested semantic action callbacks merely declared by an effect', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/EffectShortcut.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { useEffect } from 'react';",
      'export function EffectShortcut({ approve, registerShortcut }) {',
      '  useEffect(() => {',
      '    const onApprove = () => approve();',
      '    registerShortcut(onApprove);',
      '  }, [approve, registerShortcut]);',
      '  return <section>Shortcut</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('tracks aliases of React namespace effect hooks', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AliasedEffectSend.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import * as React from 'react';",
      "import { send } from './agent-actions';",
      'const effect = React.useEffect;',
      'export function AliasedEffectSend() {',
      '  effect(() => send(), []);',
      '  return <section>Sending</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('allows exact bindings for governed public JS, MJS, and CJS interaction sources', () => {
  const root = createRoot();
  const interactivePaths = [
    'apps/www/public/vendor/client.js',
    'apps/www/public/vendor/module.min.mjs',
    'apps/www/public/workers/search.cjs',
  ];
  for (const [index, relativePath] of interactivePaths.entries()) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      index === 2
        ? 'self.addEventListener("message", receive);'
        : 'document.addEventListener("click", activate);',
      'utf8'
    );
  }
  const dataPath = path.join(root, 'apps/www/public/data/catalog.js');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, 'globalThis.__CATALOG__ = ["static-data-only"];', 'utf8');
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: interactivePaths.map((relativePath) => [
        relativePath,
        ['www.shell.primary-nav'],
      ]),
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('uses action-capable imports and service owners as Agent-action provenance', () => {
  const root = createRoot();
  const importedPath = 'apps/agent-harness/src/run/ImportedApproval.tsx';
  const servicePath = 'apps/agent-harness/src/run/ServiceApproval.tsx';
  for (const [relativePath, content] of [
    [
      importedPath,
      [
        "import { useEffect } from 'react';",
        "import { approveBudgetDraft as execute } from './agent-actions';",
        'export function ImportedApproval() {',
        '  useEffect(() => execute(), []);',
        '  return <section>Approval</section>;',
        '}',
      ].join('\n'),
    ],
    [
      servicePath,
      [
        'export function ServiceApproval({ agentActions }) {',
        '  agentActions.approveBudgetDraft();',
        '  return <section>Approval</section>;',
        '}',
      ].join('\n'),
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      Path: `\`${importedPath}\`, \`${servicePath}\``,
    }
  );

  const message = validationMessage(root);
  for (const relativePath of [importedPath, servicePath]) {
    assert.ok(
      message.includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('follows directly invoked local callbacks on an effect execution path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/InvokedEffectSend.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { useEffect } from 'react';",
      "import { send } from './agent-actions';",
      'export function InvokedEffectSend() {',
      '  useEffect(() => {',
      '    const execute = () => send();',
      '    execute();',
      '  }, []);',
      '  return <section>Sending</section>;',
      '}',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('rejects third-party Harness packages outside the reviewed allowlist', () => {
  for (const specifier of [
    '@ariakit/react',
    '@radix-ui/react-dialog',
    '@tanstack/react-virtual',
    'downshift',
    'react-dom',
    'react-hook-form',
    'react-select',
    'react?raw',
    'unknown-ui-runtime',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/ExternalOwner.ts';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `import owner from '${specifier}'; void owner;`, 'utf8');
    writeValidMatrices(root);
    assert.ok(
      validationMessage(root).includes(`forbidden third-party Harness UI package \`${specifier}\``),
      `${specifier} must not bypass the reviewed Harness package boundary`
    );
  }
});

test('allows only exact reviewed React and Node builtin imports in Harness sources', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/services/reviewed-imports.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import React from 'react'; import path from 'node:path'; void React; void path;",
    'utf8'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('enforces the Harness package allowlist across script and style import forms', () => {
  const cases = [
    ['StaticImport.ts', "import owner from 'downshift'; void owner;"],
    ['Reexport.ts', "export { useSelect } from 'downshift';"],
    ['DynamicImport.ts', "void import('downshift');"],
    ['CommonJs.cjs', "void require('downshift');"],
    ['ExternalOwner.css', "@import 'downshift';"],
  ];
  for (const [fileName, content] of cases) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${fileName}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.ok(
      validationMessage(root).includes(
        `forbidden third-party Harness UI package \`downshift\` in \`${relativePath}\``
      ),
      `${fileName} must not bypass the reviewed Harness package boundary`
    );
  }
});

test('guards the privileged hooks package in Website consumers', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/HookEscape.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { useContext } from '@proto.ui/hooks';", 'utf8');
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/hooks` in `apps\/www\/src\/components\/HookEscape\.ts`/
  );
});

test('detects destructured DOM receivers in Website interactions', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/destructured-focus.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function focusCurrent(inputRef) { const { current: input } = inputRef; input.focus(); }',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/destructured-focus\.ts` is not bound/
  );
});

test('scans executable Website scripts under public assets', () => {
  const root = createRoot();
  const relativePath = 'apps/www/public/raw-navigation.js';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'window.addEventListener("keydown", navigate);', 'utf8');
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/public\/raw-navigation\.js` is not bound/
  );
});

test('discovers static components co-located with Website documentation', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/Callout.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function Callout() { return <aside>Note</aside>; }',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/content\/docs\/Callout\.tsx` is not classified/
  );
});

test('inspects external Astro script src module paths', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/ExternalScriptEscape.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<script src="../../../../packages/runtime/src/index.ts"></script>',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/index\.ts` in `apps\/www\/src\/components\/ExternalScriptEscape\.astro`/
  );
});

test('canonicalizes symlinked Website import targets', () => {
  const root = createRoot();
  const runtimeRoot = path.join(root, 'packages', 'runtime', 'src');
  const symlinkRoot = path.join(root, 'apps', 'www', 'src', 'vendor');
  const sourcePath = 'apps/www/src/components/SymlinkEscape.ts';
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(symlinkRoot, { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, 'escape.ts'), 'export const escape = true;', 'utf8');
  fs.symlinkSync(runtimeRoot, path.join(symlinkRoot, 'runtime'), 'dir');
  const absoluteSourcePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  fs.writeFileSync(
    absoluteSourcePath,
    'import { escape } from "../vendor/runtime/escape";',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /raw Proto UI import `\.\.\/vendor\/runtime\/escape` in `apps\/www\/src\/components\/SymlinkEscape\.ts`/
  );
});

test('canonicalizes an authored root alias before classifying guarded imports', () => {
  const canonicalRoot = createRoot();
  const aliasParent = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ui-authored-root-alias-'));
  temporaryRoots.push(aliasParent);
  const authoredRoot = path.join(aliasParent, 'repository');
  fs.symlinkSync(canonicalRoot, authoredRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const runtimePath = path.join(canonicalRoot, 'packages/runtime/src/index.ts');
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, 'export const runtime = true;', 'utf8');
  const cases = [
    ['apps/www/src/components/RootAliasEscape.ts', 'website', 'WebsiteRootAliasEscape'],
    ['apps/agent-harness/src/run/RootAliasEscape.ts', 'Harness', 'HarnessRootAliasEscape'],
  ];
  for (const [sourcePath, , exportName] of cases) {
    const absolutePath = path.join(canonicalRoot, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import { runtime } from '../../../../packages/runtime/src/index'; export const ${exportName} = runtime;`,
      'utf8'
    );
  }
  writeValidMatrices(canonicalRoot);

  const message = validationMessage(authoredRoot);
  for (const [sourcePath, boundary] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`../../../../packages/runtime/src/index\` in \`${sourcePath}\` escapes the ${boundary} consumer-wall allowlist`
      )
    );
  }
});

test('scans handwritten sources beside generated Harness facades', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/proto-ui/manual.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'document.querySelector("button")?.focus();', 'utf8');
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/proto-ui\/manual\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('rejects dogfooded Harness evidence symlinks escaping the retained root', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/proof.md';
  const outsidePath = 'internal/contracts/proof.md';
  fs.mkdirSync(path.join(root, 'apps/agent-harness/src/run'), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), 'fixture', 'utf8');
  fs.mkdirSync(path.dirname(path.join(root, outsidePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, outsidePath),
    'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: proof\nCommands: pnpm test\nResults: passed\n',
    'utf8'
  );
  fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
  fs.symlinkSync(path.join(root, outsidePath), path.join(root, evidencePath));
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root),
    /dogfooded evidence path must resolve within internal\/agent-harness\/evidence\/\*\*/
  );
});

test('discovers exported Harness surfaces across Node module extensions', () => {
  for (const extension of ['mjs', 'cjs', 'mts', 'cts']) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/ModuleSurface.${extension}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "import React from 'react'; export function ModuleSurface() { return React.createElement('section', null, 'Run'); }",
      'utf8'
    );
    writeValidMatrices(root);
    assert.ok(
      validationMessage(root).includes(
        `Harness user-facing source \`${relativePath}\` is not classified`
      )
    );
  }
});

test('discovers exported Website components across Node module extensions', () => {
  for (const extension of ['mjs', 'cjs', 'mts', 'cts']) {
    const root = createRoot();
    const relativePath = `apps/www/src/components/ModuleSurface.${extension}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "import React from 'react'; export function ModuleSurface() { return React.createElement('section', null, 'Website'); }",
      'utf8'
    );
    writeValidMatrices(root);
    assert.ok(
      validationMessage(root).includes(
        `website component source \`${relativePath}\` is not classified by a matrix row`
      )
    );
  }
});

test('discovers interactive Astro components co-located with Website content', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/Picker.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<button>Pick</button><script>document.addEventListener("selectionchange", select)</script>',
    'utf8'
  );
  writeValidMatrices(root);
  assert.ok(
    validationMessage(root).includes(
      `interactive website source \`${relativePath}\` is not bound to a matrix row`
    )
  );
});

test('discovers bounded native JSX handlers supplied through Website spreads', () => {
  for (const source of [
    'const handlers = { onClick() {} }; export function Button() { return <button {...handlers}>Run</button>; }',
    'const base = { onKeyDown() {} }; const handlers = base; export function Button() { return <button {...handlers}>Run</button>; }',
    'let handlers; handlers = { onFocus() {} }; export function Button() { return <button {...handlers}>Run</button>; }',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/www/src/content/docs/SpreadButton.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.ok(
      validationMessage(root).includes(
        `interactive website source \`${relativePath}\` is not bound to a matrix row`
      )
    );
  }

  for (const source of [
    'const handlers = { onClick() {} }; export function WidgetHost() { return <Widget {...handlers} />; }',
    'const props = { title: "Run" }; export function Button() { return <button {...props}>Run</button>; }',
    'let handlers; export function Button() { return <button {...handlers}>Run</button>; } handlers = { onClick() {} };',
    'const handlers = { onClick() {} }; export function Button() { { const handlers = { title: "Run" }; return <button {...handlers}>Run</button>; } }',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/www/src/content/docs/InertSpread.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(
      root,
      {},
      {},
      {
        websiteBindings: [[relativePath, ['www.shell.site-title']]],
      }
    );
    assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
  }
});

test('rejects self-hosted Website evidence records symlinked outside the retained root', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const outsidePath = 'internal/records/closeout.md';
  writeSelfHostedWebsiteArtifacts(root);
  fs.mkdirSync(path.dirname(path.join(root, outsidePath)), { recursive: true });
  fs.writeFileSync(path.join(root, outsidePath), validSelfHostedWebsiteEvidence(), 'utf8');
  fs.symlinkSync(path.join(root, outsidePath), path.join(root, evidencePath));
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(
    validationMessage(root),
    /self-hosted evidence path must resolve within internal\/website\/evidence\/\*\*/
  );
});

test('fails closed when a self-hosted Website evidence record is missing', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/missing-record.md';
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });
  assert.ok(
    validationMessage(root).includes(`self-hosted evidence path does not exist: ${evidencePath}`)
  );
});

test('tracks imported qualified Agent actions in React namespace and layout effects', () => {
  for (const source of [
    [
      "import React from 'react';",
      "import * as ops from './agent-actions';",
      'export function QualifiedEffect() {',
      '  React.useEffect(() => ops.send(), []);',
      '  return <section>Run</section>;',
      '}',
    ].join('\n'),
    [
      "import { useLayoutEffect } from 'react';",
      "import { send } from './agent-actions';",
      'export function LayoutEffect() {',
      '  useLayoutEffect(() => send(), []);',
      '  return <section>Run</section>;',
      '}',
    ].join('\n'),
    [
      "import { useLayoutEffect as onLayout } from 'react';",
      "import actions from './agent-actions';",
      'export function AliasedLayoutEffect() {',
      '  onLayout(() => actions.send(), []);',
      '  return <section>Run</section>;',
      '}',
    ].join('\n'),
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/QualifiedEffect.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.ok(
      validationMessage(root).includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('does not infer Agent-action ownership from a local qualified domain object', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/LocalApproval.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function LocalApproval() { const actions = { send() { return true; } }; const ok = actions.send(); return <section>{String(ok)}</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects qualified actions in React and layout effects', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/QualifiedApprove.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import * as React from 'react'; import { useLayoutEffect } from 'react'; import * as actions from './agent-actions'; export function QualifiedApprove({ id }) { React.useEffect(() => actions.approve(id), [id]); useLayoutEffect(() => actions.send(id), [id]); return <main>Run</main>; }",
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    { harnessBindings: [[relativePath, ['harness.transcript.viewport']]] }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/QualifiedApprove\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('rejects unreviewed third-party Harness UI dependencies by default', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/UnreviewedPrimitive.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useSelect } from '@ariakit/react'; import Downshift from 'downshift'; import { useForm } from 'react-hook-form'; import { useVirtualizer } from '@tanstack/react-virtual';",
    'utf8'
  );
  writeValidMatrices(root);

  const message = validationMessage(root);
  for (const specifier of [
    '@ariakit/react',
    'downshift',
    'react-hook-form',
    '@tanstack/react-virtual',
  ]) {
    assert.ok(message.includes(`forbidden third-party Harness UI package \`${specifier}\``));
  }
});

test('requires renderable Website sources in unlisted source roots to have a classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/features/HiddenSurface.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, '<main><slot /></main>', 'utf8');

  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/features\/HiddenSurface\.astro` is not classified by a matrix row/
  );
});

test('rejects symlink escapes for every retained Website artifact label', () => {
  for (const [label, repositoryPath] of Object.entries({
    'Build:': 'internal/website/evidence/s14/build.log',
    'Browser:': 'internal/website/evidence/s14/browser-results.json',
    'Accessibility:': 'internal/website/evidence/s14/accessibility-results.json',
    'Screenshot:': 'internal/website/evidence/s14/home-desktop.png',
    'Multi-frame:': 'internal/website/evidence/s14/navigation-frames.json',
    'Results:': 'internal/website/evidence/s14/results.json',
  })) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    const evidencePath = 'internal/website/evidence/s14/closeout.md';
    writeSelfHostedWebsiteArtifacts(root, revision);
    fs.writeFileSync(
      path.join(root, evidencePath),
      validSelfHostedWebsiteEvidence({ Commit: revision }),
      'utf8'
    );
    const outsidePath = path.join(root, 'internal', 'records', path.basename(repositoryPath));
    fs.mkdirSync(path.dirname(outsidePath), { recursive: true });
    fs.copyFileSync(path.join(root, repositoryPath), outsidePath);
    fs.rmSync(path.join(root, repositoryPath));
    fs.symlinkSync(outsidePath, path.join(root, repositoryPath));
    writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

    assert.match(
      validationMessage(root),
      new RegExp(`${label} retained artifact must resolve within internal/website/evidence/\\*\\*`)
    );
  }
});

test('rejects interaction drift inside an already mapped Website source', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/components/override/Header.astro';
  fs.writeFileSync(
    path.join(root, relativePath),
    '<nav>Docs</nav><script>window.addEventListener("keydown", openPalette)</script>',
    'utf8'
  );

  assert.match(
    validationMessage(root),
    /source fingerprint for `apps\/www\/src\/components\/override\/Header\.astro` does not match its reviewed SHA-256/
  );
});

test('requires Pagefind default UI ownership on the search interaction row', () => {
  const root = createRoot();
  const searchPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(root, searchPath)), { recursive: true });
  fs.writeFileSync(path.join(root, searchPath), '<div id="starlight__search"></div>', 'utf8');
  writeValidMatrices(root, {
    ID: 'www.search.input-results',
    Path: `\`${searchPath}\``,
    'Target class': 'site-composition',
    State: 'blocked',
    'Proto UI chain': 'Input, Collection, links, and async result state',
    Lifecycle: 'Search interaction ownership remains blocked',
    'Dependency and owner': '#420; owner: website search',
    Evidence: `${searchPath} input and result baseline`,
  });

  assert.match(
    validationMessage(root),
    /matrix row `www\.search\.input-results` must bind `@pagefind\/default-ui` as interaction-owned UI/
  );
});

test('rejects unreviewed external executable script sources in the Website shell', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/ExternalRuntime.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<main>Docs</main><script src="https://cdn.example/react.production.min.js"></script>',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [[relativePath, ['www.shell.primary-nav']]] }
  );

  assert.match(
    validationMessage(root),
    /external executable script `https:\/\/cdn\.example\/react\.production\.min\.js` in `apps\/www\/src\/components\/ExternalRuntime\.astro` is not reviewed/
  );
});
test('rejects executable scripts injected through DOM APIs', () => {
  for (const [relativePath, content, expected, kind] of [
    [
      'apps/www/src/components/InjectedExternalScript.ts',
      "const script = document.createElement('script'); script.src = 'https://cdn.example/raw-runtime.js'; document.head.append(script);",
      /external executable script `https:\/\/cdn\.example\/raw-runtime\.js`/,
      'website',
    ],
    [
      'apps/www/src/components/InjectedDynamicScript.ts',
      "function inject(scriptUrl) { const script = document.createElement('script'); script.src = scriptUrl; document.head.append(script); }",
      /dynamic executable script source/,
      'website',
    ],
    [
      'apps/agent-harness/src/run/InjectedExternalScript.ts',
      "const script = document.createElement('script'); script.src = 'https://cdn.example/raw-runtime.js'; document.head.append(script);",
      /external executable script `https:\/\/cdn\.example\/raw-runtime\.js`/,
      'harness',
    ],
    [
      'apps/agent-harness/src/run/InjectedDynamicScript.ts',
      "function inject(scriptUrl) { const script = document.createElement('script'); script.src = scriptUrl; document.head.append(script); }",
      /dynamic executable script source/,
      'harness',
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    if (kind === 'website') {
      writeValidMatrices(
        root,
        {},
        {},
        { websiteBindings: [[relativePath, ['www.demo.prototype-previewer']]] }
      );
    } else {
      writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    }
    assert.match(validationMessage(root), expected);
  }
});

test('rejects dogfooded Harness implementation symlinks escaping the application root', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const outsidePath = 'packages/runtime/src/ToolInvocation.tsx';
  fs.mkdirSync(path.dirname(path.join(root, outsidePath)), { recursive: true });
  fs.writeFileSync(path.join(root, outsidePath), 'export const tool = true;', 'utf8');
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.symlinkSync(path.join(root, outsidePath), path.join(root, implementationPath));
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(
    validationMessage(root),
    /dogfooded implementation path must resolve within apps\/agent-harness\/\*\*/
  );
});

test('rejects Agent actions in render-evaluated hook callbacks', () => {
  for (const renderHook of [
    'const value = useMemo(() => { actions.send(); return 1; }, []);',
    'const [value] = useState(() => { actions.send(); return 1; });',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/RenderHook.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import { useMemo, useState } from 'react'; import * as actions from './agent-actions'; export function RenderHook() { ${renderHook} return <section>{value}</section>; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/RenderHook\.tsx` contains a forbidden interaction or DOM state machine/
    );
  }
});

test('enforces consumer walls for Vite Worker and SharedWorker URL entries', () => {
  for (const [applicationRoot, constructorName, expected] of [
    [
      'apps/www/src/components/worker.ts',
      'Worker',
      /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/worker\.ts`/,
    ],
    [
      'apps/agent-harness/src/run/worker.ts',
      'SharedWorker',
      /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/worker\.ts`/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, applicationRoot);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `new ${constructorName}(new URL('../../../../packages/runtime/src/worker.ts', import.meta.url), { type: 'module' });`,
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('fails closed on classic worker importScripts targets', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/public/worker.js',
      "importScripts('https://cdn.example/raw-runtime.js');",
      /external executable script `https:\/\/cdn\.example\/raw-runtime\.js` in `apps\/www\/public\/worker\.js` is not reviewed/,
    ],
    [
      'apps/www/public/worker-constant.js',
      "const target = 'https://cdn.example/raw-runtime.js'; importScripts(target);",
      /external executable script `https:\/\/cdn\.example\/raw-runtime\.js` in `apps\/www\/public\/worker-constant\.js` is not reviewed/,
    ],
    [
      'apps/www/public/worker-dynamic.js',
      'importScripts(workerUrl);',
      /unresolved importScripts target in `apps\/www\/public\/worker-dynamic\.js` must be statically bounded/,
    ],
    [
      'apps/www/src/components/WorkerImportScripts.ts',
      "importScripts('../../../../packages/runtime/src/worker.ts');",
      /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/worker\.ts` in `apps\/www\/src\/components\/WorkerImportScripts\.ts` escapes the website consumer-wall allowlist/,
    ],
    [
      'apps/agent-harness/src/run/WorkerImportScripts.ts',
      "importScripts('https://cdn.example/raw-runtime.js');",
      /external executable worker script `https:\/\/cdn\.example\/raw-runtime\.js` in `apps\/agent-harness\/src\/run\/WorkerImportScripts\.ts` is not reviewed/,
    ],
    [
      'apps/agent-harness/src/run/WorkerDynamicImportScripts.ts',
      'importScripts(workerUrl);',
      /unresolved importScripts target in `apps\/agent-harness\/src\/run\/WorkerDynamicImportScripts\.ts` must be statically bounded/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});
test('fails closed on non-Vite Worker entry URLs', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/DirectWorkerUrl.ts',
      "new Worker('/raw-runtime.js');",
      /external executable script `\/raw-runtime\.js` in `apps\/www\/src\/components\/DirectWorkerUrl\.ts` is not reviewed/,
    ],
    [
      'apps/www/src/components/DynamicWorkerUrl.ts',
      'new Worker(workerUrl);',
      /unresolved Worker\/SharedWorker entry in `apps\/www\/src\/components\/DynamicWorkerUrl\.ts` must be statically bounded for Website consumer-wall review/,
    ],
    [
      'apps/agent-harness/src/run/DirectWorkerUrl.ts',
      "new Worker('/raw-runtime.js');",
      /external executable worker script `\/raw-runtime\.js` in `apps\/agent-harness\/src\/run\/DirectWorkerUrl\.ts` is not reviewed for Harness consumer-wall review/,
    ],
    [
      'apps/agent-harness/src/run/DynamicWorkerUrl.ts',
      'new Worker(workerUrl);',
      /unresolved Worker\/SharedWorker entry in `apps\/agent-harness\/src\/run\/DynamicWorkerUrl\.ts` must be statically bounded for Harness consumer-wall review/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});
test('fails closed on qualified WorkerGlobalScope importScripts calls', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/public/worker-self.js',
      "self.importScripts('https://cdn.example/raw-runtime.js');",
      /external executable script `https:\/\/cdn\.example\/raw-runtime\.js` in `apps\/www\/public\/worker-self\.js` is not reviewed/,
    ],
    [
      'apps/www/public/worker-global.js',
      'globalThis.importScripts(workerUrl);',
      /unresolved importScripts target in `apps\/www\/public\/worker-global\.js` must be statically bounded/,
    ],
    [
      'apps/agent-harness/src/run/WorkerSelfImportScripts.ts',
      "self.importScripts('https://cdn.example/raw-runtime.js');",
      /external executable worker script `https:\/\/cdn\.example\/raw-runtime\.js` in `apps\/agent-harness\/src\/run\/WorkerSelfImportScripts\.ts` is not reviewed/,
    ],
    [
      'apps/agent-harness/src/run/WorkerGlobalImportScripts.ts',
      'globalThis.importScripts(workerUrl);',
      /unresolved importScripts target in `apps\/agent-harness\/src\/run\/WorkerGlobalImportScripts\.ts` must be statically bounded/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('resolves named effect callbacks in their enclosing lexical scope', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NamedEffect.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useEffect } from 'react'; import * as actions from './agent-actions'; export function NamedEffect() { function runOnMount() { actions.send(); } useEffect(runOnMount, []); return <section>Run</section>; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/NamedEffect\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('scans local components exposed through named exports for render actions', () => {
  for (const source of [
    "import * as actions from './agent-actions'; function Surface() { actions.send(); return <div>Run</div>; } export { Surface };",
    "import React from 'react'; import * as actions from './agent-actions'; class Surface extends React.Component { render() { actions.send(); return <div>Run</div>; } } export { Surface };",
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/NamedSurface.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/NamedSurface\.tsx` contains a forbidden interaction or DOM state machine/
    );
  }
});

test('detects reflected ARIA property writes on Website and Harness DOM receivers', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/aria-state.ts',
      /interactive website source `apps\/www\/src\/components\/aria-state\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/aria-state.ts',
      /Harness source `apps\/agent-harness\/src\/run\/aria-state\.ts` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "const element = document.querySelector('button'); if (element) element.ariaExpanded = 'true';",
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('detects string-literal computed DOM calls in Website and Harness sources', () => {
  for (const [relativePath, source, expected] of [
    [
      'apps/www/src/components/computed-focus.ts',
      "document.querySelector('button')?.['focus']();",
      /interactive website source `apps\/www\/src\/components\/computed-focus\.ts` is not bound/,
    ],
    [
      'apps/www/src/components/computed-listener.ts',
      "document.querySelector('button')?.['addEventListener']('click', run);",
      /interactive website source `apps\/www\/src\/components\/computed-listener\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/computed-focus.ts',
      "document.querySelector('button')?.['focus']();",
      /Harness source `apps\/agent-harness\/src\/run\/computed-focus\.ts` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('validates every dependency issue binding in a cell independently', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'Dependency and owner': '#519 and #999999; owner: scroll domain',
    }
  );
  assert.match(
    validationMessage(root),
    /dependency issue #999999 is absent from the Proto-UI\/Proto-UI governance snapshot/
  );
});

test('rejects duplicate and noncanonical dependency Issue bindings', () => {
  for (const [dependency, expected] of [
    ['#519 and #519; owner: scroll domain', /dependency issue #519 is bound more than once/],
    [
      '[#519](https://github.com/Elsewhere/Other/issues/519); owner: scroll domain',
      /dependency issue #519 must use the canonical Proto-UI\/Proto-UI Issue URL/,
    ],
  ]) {
    const root = createRoot();
    writeValidMatrices(root, {}, { 'Dependency and owner': dependency });
    assert.match(validationMessage(root), expected);
  }
});

test('rejects incomplete machine-readable evidence result manifests', () => {
  for (const missingField of ['tree', 'commands', 'results', 'artifacts']) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    const evidencePath = 'internal/website/evidence/s14/closeout.md';
    writeSelfHostedWebsiteArtifacts(root, revision);
    const resultsPath = path.join(root, 'internal/website/evidence/s14/results.json');
    const manifest = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    delete manifest[missingField];
    fs.writeFileSync(resultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(root, evidencePath),
      validSelfHostedWebsiteEvidence({ Commit: revision }),
      'utf8'
    );
    writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

    assert.match(
      validationMessage(root),
      new RegExp(`self-hosted evidence Results manifest must contain non-empty ${missingField}`)
    );
  }
});

test('rejects evidence commits outside the candidate revision ancestry', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const evidenceRevision = commitFixtureRoot(root);
  execFileSync('git', ['checkout', '--quiet', '--orphan', 'unrelated-candidate'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--allow-empty',
      '--no-gpg-sign',
      '-m',
      'unrelated candidate',
    ],
    { cwd: root }
  );
  const candidateRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, evidenceRevision);
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: evidenceRevision }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(
    validationMessage(root, promotionOptions(candidateRevision)),
    /self-hosted evidence Commit .* is not contained in the reviewed base/
  );
});

test('follows indexed DOM collection receivers in Website and Harness scans', () => {
  for (const [relativePath, source, expected] of [
    [
      'apps/www/src/components/indexed-focus.ts',
      "document.querySelectorAll('button')[0]?.focus();",
      /interactive website source `apps\/www\/src\/components\/indexed-focus\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/indexed-aria.ts',
      "const buttons = document.querySelectorAll('button'); buttons[0].ariaExpanded = 'true';",
      /Harness source `apps\/agent-harness\/src\/run\/indexed-aria\.ts` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('follows item and namedItem results from DOM collections', () => {
  for (const [relativePath, source, expected] of [
    [
      'apps/www/src/components/collection-item-focus.ts',
      "document.querySelectorAll('button').item(0)?.focus();",
      /interactive website source `apps\/www\/src\/components\/collection-item-focus\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/collection-named-item.ts',
      "document.forms.namedItem('login')?.focus();",
      /Harness source `apps\/agent-harness\/src\/run\/collection-named-item\.ts` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, source, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
  const domainRoot = createRoot();
  const domainPath = 'apps/www/src/components/domain-item-focus.ts';
  const absoluteDomainPath = path.join(domainRoot, domainPath);
  fs.mkdirSync(path.dirname(absoluteDomainPath), { recursive: true });
  fs.writeFileSync(
    absoluteDomainPath,
    'const model = { item() { return { focus() {} }; } }; model.item().focus();',
    'utf8'
  );
  writeValidMatrices(domainRoot);
  assert.deepEqual(validateCoverageMatrices({ rootDir: domainRoot }), { matrixCount: 2 });
});

test('rejects Agent actions from exported class mount lifecycle methods', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ClassMount.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import React from 'react'; import * as actions from './agent-actions'; class ClassMount extends React.Component { componentDidMount() { actions.send(); } render() { return <section>Run</section>; } } export { ClassMount };",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ClassMount\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('allows resolved rows to retain closed dependency Issues as provenance', () => {
  const root = createRoot();
  writeGovernanceSnapshot(root, { 533: { state: 'CLOSED', stateReason: 'COMPLETED' } });
  writeValidMatrices(
    root,
    {},
    {
      State: 'ready',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('requires every multi-frame image in the evidence results manifest', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, revision);
  const resultsPath = path.join(root, 'internal/website/evidence/s14/results.json');
  const manifest = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  manifest.artifacts = manifest.artifacts.filter(
    (artifact) => artifact.path !== 'internal/website/evidence/s14/navigation-after.png'
  );
  fs.writeFileSync(resultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(
    validationMessage(root),
    /self-hosted evidence Results artifacts must include record artifact `internal\/website\/evidence\/s14\/navigation-after\.png`/
  );
});

test('accepts same-root evidence symlinks after canonical validation', () => {
  const root = createRoot();
  const implementationPath = path.join(root, 'apps/www/src/components/override/Search.astro');
  fs.mkdirSync(path.dirname(implementationPath), { recursive: true });
  fs.writeFileSync(implementationPath, '<main>search</main>', 'utf8');
  const websiteBindings = [['apps/www/src/components/override/Search.astro', ['www.shell.search']]];
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, revision);
  const buildPath = path.join(root, 'internal/website/evidence/s14/build.log');
  const canonicalBuildPath = path.join(root, 'internal/website/evidence/s14/build-canonical.log');
  fs.renameSync(buildPath, canonicalBuildPath);
  fs.symlinkSync(canonicalBuildPath, buildPath);
  const resultsPath = path.join(root, 'internal/website/evidence/s14/results.json');
  const manifest = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const buildArtifact = manifest.artifacts.find(
    (artifact) => artifact.path === 'internal/website/evidence/s14/build.log'
  );
  buildArtifact.size = fs.statSync(canonicalBuildPath).size;
  buildArtifact.sha256 = sourceDigest(root, 'internal/website/evidence/s14/build.log');
  fs.writeFileSync(resultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(
    root,
    { State: 'self-hosted', Evidence: `\`${evidencePath}\`` },
    {},
    { websiteBindings }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });
});

test('rejects a multi-frame image symlink escaping the Website evidence root', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, revision);
  const framePath = path.join(root, 'internal/website/evidence/s14/navigation-after.png');
  const outsidePath = path.join(root, 'internal/records/navigation-after.png');
  fs.mkdirSync(path.dirname(outsidePath), { recursive: true });
  fs.renameSync(framePath, outsidePath);
  fs.symlinkSync(outsidePath, framePath);
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: JSON manifest frame must be an existing retained artifact under internal\/website\/evidence\/\*\*/
  );
});

test('treats LF and CRLF scanner inputs as one reviewed fingerprint', () => {
  const root = createRoot();
  const sourcePath = 'apps/www/src/components/override/Header.astro';
  const lfSource =
    '<nav>Docs</nav>\n<script>window.addEventListener("keydown", openPalette)</script>\n';
  fs.writeFileSync(path.join(root, sourcePath), lfSource, 'utf8');
  writeValidMatrices(root);
  fs.writeFileSync(path.join(root, sourcePath), lfSource.replaceAll('\n', '\r\n'), 'utf8');

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts reviewed fingerprints embedded in Website source bindings', () => {
  const root = createRoot();
  const sourcePath = 'apps/www/src/components/override/Header.astro';
  const source =
    '<nav>Docs</nav>\n<script>window.addEventListener("keydown", openPalette)</script>\n';
  fs.writeFileSync(path.join(root, sourcePath), source, 'utf8');
  const digest = createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');
  const websiteRows = rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(), validWebsiteRow);
  writeMatrix(root, MATRIX_CONFIGS[0], websiteRows, {
    extraText: [
      '## Source-scan bindings',
      '',
      '| Interactive or integration source | Owning matrix row | Source SHA-256 |',
      '| --- | --- | --- |',
      `| \`${sourcePath}\` | \`www.shell.primary-nav\`, \`www.shell.header-separators\` | \`${digest}\` |`,
    ].join('\n'),
  });
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not classify remote inert JSON script sources as executable', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/RemoteStructuredData.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<main>Docs</main><script type="application/ld+json" src="https://cdn.example/schema.json"></script>',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [[relativePath, ['www.content.document-semantics']]],
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});
test('fails closed on external and dynamic document base URLs', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/ExternalDocumentBase.astro',
      '<base href="https://cdn.example/"><script src="raw-runtime.js"></script>',
      /external document base href `https:\/\/cdn\.example\/` in `apps\/www\/src\/components\/ExternalDocumentBase\.astro` is not reviewed/,
    ],
    [
      'apps/www/src/components/DynamicDocumentBase.astro',
      '<base href={baseUrl}><script src="raw-runtime.js"></script>',
      /dynamic document base href in `apps\/www\/src\/components\/DynamicDocumentBase\.astro` must be statically bounded for Website consumer-wall review/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(
      root,
      {},
      {},
      {
        websiteBindings: [[relativePath, ['www.demo.prototype-previewer']]],
      }
    );
    assert.match(validationMessage(root), expected);
  }
  const root = createRoot();
  const relativePath = 'apps/www/src/components/LocalDocumentBase.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, '<base href="/docs/"><script src="runtime.js"></script>', 'utf8');
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [[relativePath, ['www.demo.prototype-previewer']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});
test('fails closed on character references in executable and URL attributes', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/EntityEncodedMarkup.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      '<base href="https&#x3A;//cdn.example/">',
      '<script src="https&#x3A//cdn.example/runtime.js"></script>',
      '<script type="text&#x2F;javascript" src="https://cdn.example/typed.js"></script>',
      '<link rel="stylesheet" href="https&#x3A;//cdn.example/theme.css">',
      '<link rel="style&#x73;heet" href="https://cdn.example/entity-rel.css">',
      '<main>Docs</main>',
    ].join(''),
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [[relativePath, ['www.demo.prototype-previewer']]] }
  );

  const message = validationMessage(root);
  assert.match(message, /dynamic document base href/);
  assert.match(message, /dynamic executable script source/);
  assert.match(message, /dynamic executable script type/);
  assert.match(message, /dynamic stylesheet source/);
  assert.match(message, /dynamic stylesheet relation/);
});

test('fails closed on dynamically typed scripts with a source URL', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/DynamicScriptType.astro',
      '<script type={enabled ? "module" : "application/json"} src="https://cdn.example/runtime.js"></script>',
      /dynamic executable script type in `apps\/www\/src\/components\/DynamicScriptType\.astro` must be statically bounded/,
    ],
    [
      'apps/www/src/components/BoundScriptType.vue',
      '<script :type="scriptType" src="https://cdn.example/runtime.js"></script>',
      /dynamic executable script type in `apps\/www\/src\/components\/BoundScriptType\.vue` must be statically bounded/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(
      root,
      {},
      {},
      {
        websiteBindings: [[relativePath, ['www.demo.prototype-previewer']]],
      }
    );
    assert.match(validationMessage(root), expected);
  }
});

test('rejects render-evaluated reducer and external-store callbacks', () => {
  for (const renderHook of [
    'const [value] = useReducer(() => { actions.send(); return 1; }, 0);',
    'const [value] = useReducer((state) => state, 0, () => { actions.send(); return 1; });',
    'const value = useSyncExternalStore(() => { actions.send(); return () => {}; }, () => 1);',
    'const value = useSyncExternalStore(subscribe, () => { actions.send(); return 1; }, () => { actions.send(); return 1; });',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/RenderCallback.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import { useReducer, useSyncExternalStore } from 'react'; import * as actions from './agent-actions'; const subscribe = () => () => {}; export function RenderCallback() { ${renderHook} return <section>{value}</section>; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/RenderCallback\.tsx` contains a forbidden interaction or DOM state machine/
    );
  }
});

test('does not execute callbacks merely memoized by useCallback', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/MemoizedCallback.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useCallback } from 'react'; import * as actions from './agent-actions'; export function MemoizedCallback() { const run = useCallback(() => actions.send(), []); return <section>{String(Boolean(run))}</section>; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores ordinary new URL expressions outside Worker constructors', () => {
  for (const relativePath of [
    'apps/www/src/components/asset-url.ts',
    'apps/agent-harness/src/run/asset-url.ts',
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "export const asset = new URL('../../../../packages/runtime/src/worker.ts', import.meta.url);",
      'utf8'
    );
    writeValidMatrices(root);
    assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
  }
});

test('scans aliased local named exports for render actions', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AliasedSurface.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import * as actions from './agent-actions'; function Surface() { actions.send(); return <div>Run</div>; } export { Surface as AliasedSurface };",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/AliasedSurface\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('ignores named re-exports and exported data functions without rendered roots', () => {
  for (const source of [
    "export { Surface } from './surface';",
    'function selectData() { return { send: true }; } export { selectData as Surface };',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/DataExports.ts';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
  }
});

test('respects lexical shadowing for named effect callbacks', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ShadowedEffect.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useEffect } from 'react'; import * as actions from './agent-actions'; const runOnMount = () => actions.send(); export function ShadowedEffect() { const runOnMount = () => undefined; useEffect(runOnMount, []); return <section>Run</section>; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects computed reflected ARIA writes without flagging domain models', () => {
  for (const [relativePath, source, expected] of [
    [
      'apps/www/src/components/computed-aria.ts',
      "const element = document.querySelector('button'); if (element) element['ariaExpanded'] = 'true';",
      /interactive website source `apps\/www\/src\/components\/computed-aria\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/computed-aria.ts',
      "const element = document.querySelector('button'); if (element) element['ariaExpanded'] = 'true';",
      /Harness source `apps\/agent-harness\/src\/run\/computed-aria\.ts` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }

  const root = createRoot();
  const modelPath = path.join(root, 'apps/agent-harness/src/run/model-aria.ts');
  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  fs.writeFileSync(
    modelPath,
    "const model = { ariaExpanded: 'false' }; model.ariaExpanded = 'true';",
    'utf8'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects computed Harness addEventListener calls', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/computed-listener.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "document.querySelector('button')?.['addEventListener']('click', run);",
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/computed-listener\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('requires structural Pagefind UI ownership on the input-results row', () => {
  const root = createRoot();
  const searchPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(root, searchPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, searchPath),
    "---\nconst { PagefindUI } = await import('@pagefind/default-ui');\nnew PagefindUI({ element: '#search' });\n---\n<div id=\"search\"></div>",
    'utf8'
  );
  writeValidMatrices(root, {
    ID: 'www.search.input-results',
    Path: `\`${searchPath}\``,
    'Target class': 'site-composition',
    State: 'blocked',
    'Proto UI chain': 'Input and result UI',
    Lifecycle: 'Third-party UI remains current',
    'Dependency and owner': '#420; owner: website search',
    Evidence: 'Reviewed interaction dependency `@pagefind/default-ui`',
  });

  assert.match(
    validationMessage(root),
    /matrix row `www\.search\.input-results` must structurally own `new PagefindUI`/
  );
});

test('discovers governed symlink sources and rejects source-root escapes', () => {
  const internalRoot = createRoot();
  const internalTarget = path.join(internalRoot, 'apps/www/src/features/internal-surface.txt');
  const internalLink = path.join(internalRoot, 'apps/www/src/features/LinkedSurface.astro');
  fs.mkdirSync(path.dirname(internalTarget), { recursive: true });
  fs.writeFileSync(internalTarget, '<main>Linked</main>', 'utf8');
  fs.symlinkSync(internalTarget, internalLink);
  writeValidMatrices(internalRoot);
  assert.match(
    validationMessage(internalRoot),
    /website component source `apps\/www\/src\/features\/LinkedSurface\.astro` is not classified/
  );

  const externalRoot = createRoot();
  const externalTarget = path.join(externalRoot, 'internal/records/escaped-source.ts');
  const externalLink = path.join(externalRoot, 'apps/agent-harness/src/run/escaped-source.ts');
  fs.mkdirSync(path.dirname(externalTarget), { recursive: true });
  fs.writeFileSync(externalTarget, "document.querySelector('button')?.focus();", 'utf8');
  fs.mkdirSync(path.dirname(externalLink), { recursive: true });
  fs.symlinkSync(externalTarget, externalLink);
  writeValidMatrices(externalRoot);
  assert.match(
    validationMessage(externalRoot),
    /Harness source symlink `apps\/agent-harness\/src\/run\/escaped-source\.ts` resolves outside its governed source root/
  );
});

test('validates every exemption re-review Issue through governance', () => {
  for (const [issueOverrides, reReview, expected] of [
    [
      {},
      '#999999 if the native surface gains interaction',
      /re-review issue #999999 is absent from the Proto-UI\/Proto-UI governance snapshot/,
    ],
    [
      { 533: { state: 'CLOSED', stateReason: 'COMPLETED' } },
      '#533 if the native surface gains interaction',
      /re-review issue #533 must be OPEN; snapshot state is CLOSED\/COMPLETED/,
    ],
  ]) {
    const root = createRoot();
    writeGovernanceSnapshot(root, issueOverrides);
    writeValidMatrices(root, {
      ID: 'www.shell.site-title',
      Path: '`apps/www/src/components/override/SiteTitle.astro`',
      'Target class': 'native/static',
      State: 'native/static',
      'Proto UI chain': 'Native semantic HTML',
      Lifecycle: 'Native HTML; no catalog entity required',
      'Dependency and owner': 'No Proto UI dependency; owner: website team',
      'Escape or exemption': 'Reason: native semantic HTML owns the complete information path',
      'Re-review or removal issue': reReview,
    });
    assert.match(validationMessage(root), expected);
  }
});

test('requires retained artifacts for every dogfooded evidence dimension', () => {
  for (const label of ['Build', 'Browser', 'Accessibility', 'Lifecycle', 'Design']) {
    const root = createRoot();
    const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
    const absoluteImplementationPath = path.join(root, implementationPath);
    fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
    fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
    const absoluteEvidencePath = path.join(root, evidencePath);
    const record = fs.readFileSync(absoluteEvidencePath, 'utf8');
    fs.writeFileSync(
      absoluteEvidencePath,
      record.replace(new RegExp(`^${label}:.*$`, 'mu'), `${label}: passed`),
      'utf8'
    );
    writeValidMatrices(
      root,
      {},
      {
        ID: 'harness.run.tool-invocation',
        'Target owner': 'Harness app-local Tool Invocation prototype',
        'Target class': 'app-local-proto',
        State: 'dogfooded',
        Path: `\`${implementationPath}\``,
        Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
        'Dependency and owner': 'No blocker; owner: Harness application',
      }
    );
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      new RegExp(`dogfooded evidence ${label}: must bind exactly one retained artifact`)
    );
  }
});

test('rejects blob and annotated-tag object IDs as evidence commits', () => {
  for (const objectKind of ['tag', 'blob']) {
    const root = createRoot();
    writeValidMatrices(root);
    const commit = commitFixtureRoot(root);
    let objectId;
    if (objectKind === 'tag') {
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Coverage Fixture',
          '-c',
          'user.email=coverage@example.com',
          'tag',
          '-a',
          'evidence-tag',
          '-m',
          'not a commit id',
          commit,
        ],
        { cwd: root }
      );
      objectId = execFileSync('git', ['rev-parse', 'refs/tags/evidence-tag'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
    } else {
      objectId = execFileSync('git', ['hash-object', '-w', 'pnpm-lock.yaml'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
    }
    writeSelfHostedPromotion(root, objectId);
    assert.match(
      validationMessage(root, promotionOptions(commit)),
      /self-hosted evidence Commit .* must identify a commit object directly/
    );
  }
});

test('rejects evidence revisions that have not landed in the reviewed base', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>base</main>', 'utf8');
  writeValidMatrices(root);
  const baseRevision = commitFixtureRoot(root);
  const evidenceRevision = commitFixtureChange(
    root,
    implementationPath,
    '<main>unmerged feature</main>',
    'unmerged implementation'
  );
  writeSelfHostedPromotion(root, evidenceRevision);

  assert.match(
    validationMessage(root, promotionOptions(baseRevision, evidenceRevision)),
    /self-hosted evidence Commit .* is not contained in the reviewed base/
  );
});

test('fails closed when base or head history proof is unavailable', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision);

  assert.match(
    validationMessage(root, promotionOptions('e'.repeat(40), revision)),
    /promotion history proof is unavailable for base `e{40}`/
  );
});

test('rejects the temporary pull-request merge commit as evidence', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision);

  assert.match(
    validationMessage(root, {
      ...promotionOptions(revision),
      mergeRevision: revision,
    }),
    /evidence Commit must not equal the temporary pull-request merge commit/
  );
});

test('requires explicit reviewed base and exact head for promotion checks', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision);

  assert.match(
    validationMessage(root),
    /promotion validation requires explicit base and head revisions/
  );
});

test('rejects mismatched manifest tree, repository, kind, and schema', () => {
  for (const [manifestOverrides, expected] of [
    [{ tree: 'f'.repeat(40) }, /Results tree must (?:equal|match) (?:the )?Commit tree/],
    [{ repository: 'Elsewhere/Other' }, /Results repository must be Proto-UI\/Proto-UI/],
    [
      { kind: 'other-results' },
      /Results manifest kind must be proto-ui\.coverage-evidence-results/,
    ],
    [{ schemaVersion: 2 }, /Results manifest schemaVersion must be 1/],
  ]) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { manifestOverrides });
    assert.match(validationMessage(root, promotionOptions(revision)), expected);
  }
});

test('rejects empty, unnamed, or failing command and result entries', () => {
  for (const [manifestOverrides, expected] of [
    [{ commands: [] }, /Results manifest must contain non-empty commands/],
    [
      { commands: [{ command: 'corepack pnpm test', status: 'failed' }] },
      /Results commands must name non-empty commands with passed status/,
    ],
    [{ results: [] }, /Results manifest must contain non-empty results/],
    [
      { results: [{ name: '', status: 'passed' }] },
      /Results entries must have non-empty names and passed status/,
    ],
    [
      { results: [{ name: 'browser', status: 'failed' }] },
      /Results entries must have non-empty names and passed status/,
    ],
  ]) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { manifestOverrides });
    assert.match(validationMessage(root, promotionOptions(revision)), expected);
  }
});

test('rejects retained artifact size and digest mismatches', () => {
  for (const field of ['size', 'sha256']) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    const { resultsPath } = writeSelfHostedPromotion(root, revision);
    const absoluteResultsPath = path.join(root, resultsPath);
    const manifest = JSON.parse(fs.readFileSync(absoluteResultsPath, 'utf8'));
    manifest.artifacts[0][field] =
      field === 'size' ? manifest.artifacts[0].size + 1 : 'f'.repeat(64);
    fs.writeFileSync(absoluteResultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /Results artifact metadata does not match retained file/
    );
  }
});

test('rejects unlisted, duplicate, and self-referential result artifacts', () => {
  for (const mode of ['unlisted', 'duplicate', 'self']) {
    const root = createRoot();
    writeValidMatrices(root);
    const revision = commitFixtureRoot(root);
    const { resultsPath } = writeSelfHostedPromotion(root, revision);
    const absoluteResultsPath = path.join(root, resultsPath);
    const manifest = JSON.parse(fs.readFileSync(absoluteResultsPath, 'utf8'));
    if (mode === 'unlisted') {
      const extraPath = 'internal/website/evidence/s14/unlisted.log';
      fs.writeFileSync(path.join(root, extraPath), 'unlisted\n', 'utf8');
      manifest.artifacts.push({
        path: extraPath,
        size: fs.statSync(path.join(root, extraPath)).size,
        sha256: sourceDigest(root, extraPath),
      });
    } else if (mode === 'duplicate') {
      manifest.artifacts.push({ ...manifest.artifacts[0] });
    } else {
      manifest.artifacts.push({
        path: resultsPath,
        size: fs.statSync(absoluteResultsPath).size,
        sha256: sourceDigest(root, resultsPath),
      });
    }
    fs.writeFileSync(absoluteResultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      mode === 'unlisted'
        ? /Results artifacts contain unreferenced retained artifact/
        : mode === 'duplicate'
          ? /Results artifacts must have unique canonical paths/
          : /Results artifacts must not include the Results manifest itself/
    );
  }
});

test('rejects canonical artifact aliases listed more than once', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { resultsPath } = writeSelfHostedPromotion(root, revision);
  const aliasPath = 'internal/website/evidence/s14/build-alias.log';
  fs.symlinkSync(
    path.join(root, 'internal/website/evidence/s14/build.log'),
    path.join(root, aliasPath)
  );
  const absoluteResultsPath = path.join(root, resultsPath);
  const manifest = JSON.parse(fs.readFileSync(absoluteResultsPath, 'utf8'));
  manifest.artifacts.push({
    path: aliasPath,
    size: fs.statSync(path.join(root, aliasPath)).size,
    sha256: sourceDigest(root, aliasPath),
  });
  fs.writeFileSync(absoluteResultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Results artifacts must have unique canonical paths/
  );
});

test('rejects promoted implementation paths absent at the evidence revision', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>late implementation</main>', 'utf8');
  writeSelfHostedPromotion(root, revision);

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted implementation `apps\/www\/src\/components\/override\/Search\.astro` is absent at evidence Commit/
  );
});

test('rejects implementation changed after its evidence revision', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    '<main>reviewed implementation</main>',
    'utf8'
  );
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  fs.writeFileSync(
    path.join(root, implementationPath),
    '<main>changed implementation</main>',
    'utf8'
  );
  writeSelfHostedPromotion(root, revision);

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted implementation `apps\/www\/src\/components\/override\/Search\.astro` differs from evidence Commit/
  );
});

test('rejects evidence when a reachable Website helper changes after capture', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const helperPath = 'apps/www/src/components/override/search-helper.ts';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    "---\nimport { searchLabel } from './search-helper';\n---\n<main>{searchLabel}</main>",
    'utf8'
  );
  fs.writeFileSync(path.join(root, helperPath), "export const searchLabel = 'Search';", 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  fs.writeFileSync(
    path.join(root, helperPath),
    "export const searchLabel = 'Changed after evidence';",
    'utf8'
  );

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted dependency `apps\/www\/src\/components\/override\/search-helper\.ts` differs from evidence Commit/
  );
});

test('binds PR580 provenance head separately from merged ancestry evidence', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const matrixPath = path.join(root, 'internal/website/self-hosting-coverage-matrix.md');
  fs.writeFileSync(
    matrixPath,
    fs
      .readFileSync(matrixPath, 'utf8')
      .replace('merged ancestry commit `9841c86a10940267fb30ee25b63c9a5a39f76fe6`; ', ''),
    'utf8'
  );

  assert.match(
    validationMessage(root),
    /closure binding for `www\.content\.document-semantics` must retain merged PR #580 commit `9841c86a10940267fb30ee25b63c9a5a39f76fe6`/
  );
});

test('recognizes on-prefixed Agent action callbacks with proven props ownership', () => {
  for (const source of [
    "import { useEffect } from 'react'; export function Surface({ onSend }) { useEffect(() => onSend(), []); return <section>Run</section>; }",
    "import { useEffect } from 'react'; export function Surface(props) { useEffect(() => props.onApprove(), [props]); return <section>Run</section>; }",
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/OnAction.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/OnAction\.tsx` contains a forbidden interaction or DOM state machine/
    );
  }
});

test('rejects Agent actions from exported class update lifecycle methods', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ClassUpdate.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import React from 'react'; import * as actions from './agent-actions'; class ClassUpdate extends React.Component { componentDidUpdate() { actions.send(); } render() { return <section>Run</section>; } } export { ClassUpdate };",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ClassUpdate\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('binds plain-text Harness evidence commands to manifest commands', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.writeFileSync(
    absoluteEvidencePath,
    fs.readFileSync(absoluteEvidencePath, 'utf8').replace(/^Commands:.*$/mu, 'Commands: pnpm test'),
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /dogfooded evidence Results commands must include record command `pnpm test`/
  );
});

test('discovers local components exported through React wrappers', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/WrappedSurface.tsx',
      /website component source `apps\/www\/src\/components\/WrappedSurface\.tsx` is not classified/,
    ],
    [
      'apps/agent-harness/src/run/WrappedSurface.tsx',
      /Harness user-facing source `apps\/agent-harness\/src\/run\/WrappedSurface\.tsx` is not classified/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "import { memo } from 'react'; const Surface = () => <section>Wrapped</section>; export default memo(Surface);",
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('rejects Agent actions from callable render class fields', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ClassFieldRender.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import React from 'react'; import * as actions from './agent-actions'; class ClassFieldRender extends React.Component { render = () => { actions.send(); return <section>Run</section>; }; } export { ClassFieldRender };",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ClassFieldRender\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('follows object spreads while resolving native handler props', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/SpreadHandlers.tsx',
      /interactive website source `apps\/www\/src\/components\/SpreadHandlers\.tsx` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/SpreadHandlers.tsx',
      /Harness source `apps\/agent-harness\/src\/run\/SpreadHandlers\.tsx` contains a forbidden interaction or DOM state machine/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      'const base = { onKeyDown() {} }; const handlers = { ...base }; export function Surface() { return <button {...handlers}>Run</button>; }',
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('follows local props factories used by intrinsic JSX spreads', () => {
  for (const factory of [
    'const createProps = () => ({ onClick() {} });',
    'function createProps() { return { onClick() {} }; }',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/FactoryHandlers.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `${factory} export function Surface() { return <button {...createProps()}>Run</button>; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/FactoryHandlers\.tsx` contains a forbidden interaction or DOM state machine/
    );
  }
});

test('resolves every configured Website alias before consumer-wall classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "import { fileURLToPath } from 'node:url';",
      "export default { vite: { resolve: { alias: { rawRuntime: fileURLToPath(new URL('../../packages/runtime/src', import.meta.url)) } } } };",
    ].join('\n'),
    'utf8'
  );
  const runtimePath = path.join(root, 'packages/runtime/src/index.ts');
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, 'export const runtime = true;', 'utf8');
  const sourcePath = 'apps/www/src/components/AliasRuntime.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { runtime } from 'rawRuntime';", 'utf8');

  assert.match(
    validationMessage(root),
    /raw Proto UI import `rawRuntime` in `apps\/www\/src\/components\/AliasRuntime\.ts` escapes the website consumer-wall allowlist/
  );
});
test('rejects non-active catalog entities from every shipped Website state', () => {
  for (const state of ['ready', 'self-hosted', 'native/static', 'infrastructure-exempt']) {
    const root = createRoot();
    const overrides = {
      'Proto UI chain': 'P-BASE-BUTTON',
      Lifecycle: 'P-BASE-BUTTON=draft',
      State: state,
    };
    if (state === 'native/static') {
      overrides.ID = 'www.shell.site-title';
      overrides.Path = '`apps/www/src/components/override/SiteTitle.astro`';
      overrides['Target class'] = 'native/static';
      overrides['Dependency and owner'] = 'No Proto UI dependency; owner: website team';
      overrides['Escape or exemption'] =
        'Reason: native semantic HTML owns the complete information path';
      overrides['Re-review or removal issue'] =
        '#420 if application-owned interaction is introduced';
    }
    if (state === 'infrastructure-exempt') {
      overrides.ID = 'www.demo.brutalist-theme-style';
      overrides.Path = '`apps/www/src/components/BrutalistPageStyle.astro`';
      overrides['Target class'] = 'infrastructure-exempt';
      overrides['Dependency and owner'] = 'No Proto UI dependency; owner: website demos';
      overrides['Escape or exemption'] =
        'Reason: static theme infrastructure remains bounded to demos';
      overrides['Re-review or removal issue'] = '#420 if the theme gains interaction state';
    }
    writeValidMatrices(root, overrides);
    assert.match(
      validationMessage(root),
      new RegExp(
        `shipped website State \`${state}\` requires every catalog entity in Proto UI chain to be active`
      )
    );
  }
});

test('requires Harness dogfooded matrix dimensions to bind retained artifacts', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /dogfooded matrix Evidence Build: must bind exactly one retained artifact/
  );
});

test('binds object-form multi-frame paths into the evidence results manifest', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  writeSelfHostedWebsiteArtifacts(root, revision);
  const frameManifestPath = path.join(root, 'internal/website/evidence/s14/navigation-frames.json');
  fs.writeFileSync(
    frameManifestPath,
    JSON.stringify({
      frames: [
        { path: 'internal/website/evidence/s14/navigation-before.png' },
        { path: 'internal/website/evidence/s14/navigation-after.png' },
      ],
    }),
    'utf8'
  );
  const resultsPath = path.join(root, 'internal/website/evidence/s14/results.json');
  const manifest = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  manifest.artifacts = manifest.artifacts.filter(
    (artifact) => artifact.path !== 'internal/website/evidence/s14/navigation-after.png'
  );
  fs.writeFileSync(resultsPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(root, evidencePath),
    validSelfHostedWebsiteEvidence({ Commit: revision }),
    'utf8'
  );
  writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /self-hosted evidence Results artifacts must include record artifact `internal\/website\/evidence\/s14\/navigation-after\.png`/
  );
});

test('discovers element-valued DOM property receivers in Website and Harness sources', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/ElementPropertyFocus.ts',
      'export function ElementPropertyFocus() { document.body.firstElementChild?.focus(); return null; }',
      /interactive website source `apps\/www\/src\/components\/ElementPropertyFocus\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/ElementPropertyAria.tsx',
      "export function ElementPropertyAria() { document.body.firstElementChild?.setAttribute('aria-expanded', 'true'); return <section />; }",
      /Harness source `apps\/agent-harness\/src\/run\/ElementPropertyAria\.tsx` contains a forbidden interaction/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(
      root,
      {},
      relativePath.startsWith('apps/agent-harness/') ? { Path: `\`${relativePath}\`` } : {}
    );
    assert.match(validationMessage(root), expected);
  }
});

test('scans production-reachable Harness helpers outside the source root', () => {
  const root = createRoot();
  const sourcePath = 'apps/agent-harness/src/run/ReachableHelperCall.tsx';
  const helperPath = 'apps/agent-harness/shared/review-focus-helper.js';
  const source = path.join(root, sourcePath);
  const helper = path.join(root, helperPath);
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.writeFileSync(
    source,
    "import { focusReviewButton } from '../../shared/review-focus-helper.js';\nfocusReviewButton();",
    'utf8'
  );
  fs.writeFileSync(
    helper,
    'export function focusReviewButton() { document.body.firstElementChild?.focus(); }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${sourcePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/shared\/review-focus-helper\.js` contains a forbidden interaction/
  );
});

test('rejects Agent actions from derived-state class lifecycles', () => {
  for (const method of ['getDerivedStateFromProps', 'getDerivedStateFromError']) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${method}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import React from 'react'; import * as actions from './agent-actions'; class DerivedState extends React.Component { static ${method}() { actions.send(); return null; } render() { return <section />; } } export { DerivedState };`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        `Harness source \`${relativePath.replaceAll('/', '\\/')}\` contains a forbidden interaction`
      )
    );
  }
});

test('requires each exported Harness surface to have a distinct row owner', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/TwoSurfaces.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function FirstSurface() { return <section>First</section>; } export function SecondSurface() { return <section>Second</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness user-facing source `apps\/agent-harness\/src\/run\/TwoSurfaces\.tsx` exposes 2 exported surfaces but has only 1 distinct matrix owner/
  );
});

test('scans test-named modules reachable from production Website sources', () => {
  const root = createRoot();
  const productionPath = 'apps/www/src/components/ProductionBridge.astro';
  const bridgePath = 'apps/www/src/components/bridge.test.ts';
  fs.mkdirSync(path.dirname(path.join(root, productionPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, productionPath),
    "---\nimport bridge from './bridge.test';\n---\n<main>{bridge}</main>",
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, bridgePath),
    "import '@proto.ui/runtime'; export default 'bridge';",
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/runtime` in `apps\/www\/src\/components\/bridge\.test\.ts` escapes the website consumer-wall allowlist/
  );
});

test('follows DOM receivers destructured from semantic event parameters', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DestructuredEvent.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'function handler({ currentTarget }) { currentTarget.focus(); } export function Surface() { return <ProtoButton onPress={handler} />; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/DestructuredEvent\.tsx` contains a forbidden interaction/
  );
});

test('classifies native dialog and popover state-changing methods', () => {
  for (const [relativePath, method, expected] of [
    [
      'apps/www/src/components/DialogController.ts',
      'showModal',
      /interactive website source `apps\/www\/src\/components\/DialogController\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/PopoverController.tsx',
      'togglePopover',
      /Harness source `apps\/agent-harness\/src\/run\/PopoverController\.tsx` contains a forbidden interaction/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `export function Surface() { document.querySelector('dialog').${method}(); return null; }`,
      'utf8'
    );
    writeValidMatrices(
      root,
      {},
      relativePath.startsWith('apps/agent-harness/') ? { Path: `\`${relativePath}\`` } : {}
    );
    assert.match(validationMessage(root), expected);
  }
});

test('recognizes computed native-handler keys in intrinsic JSX spreads', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ComputedHandler.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "const props = { ['onClick']() {} }; export function Surface() { return <button {...props} />; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ComputedHandler\.tsx` contains a forbidden interaction/
  );
});

test('rejects Agent actions through class props and neutral named imports', () => {
  for (const [name, source] of [
    [
      'ClassProps',
      "import React from 'react'; class Surface extends React.Component { render() { this.props.onSend(); return <section />; } } export { Surface };",
    ],
    [
      'NeutralImport',
      "import { navigate } from './router'; export function Surface() { navigate(); return <section />; }",
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        `Harness source \`apps/agent-harness/src/run/${name}\\.tsx\` contains a forbidden interaction`
      )
    );
  }
});

test('scans imperative handles, class initialization and teardown, and module initialization', () => {
  for (const [name, source] of [
    [
      'ImperativeHandle',
      "import { useImperativeHandle } from 'react'; import * as actions from './agent-actions'; export function Surface({ ref }) { useImperativeHandle(ref, () => { actions.send(); return {}; }); return <section />; }",
    ],
    [
      'ClassField',
      "import React from 'react'; import * as actions from './agent-actions'; class Surface extends React.Component { state = actions.send(); render() { return <section />; } } export { Surface };",
    ],
    [
      'ClassTeardown',
      "import React from 'react'; import * as actions from './agent-actions'; class Surface extends React.Component { componentWillUnmount() { actions.stop(); } render() { return <section />; } } export { Surface };",
    ],
    [
      'ClassCatch',
      "import React from 'react'; import * as actions from './agent-actions'; class Surface extends React.Component { componentDidCatch() { actions.send(); } render() { return <section />; } } export { Surface };",
    ],
    [
      'ModuleInitialization',
      "import * as actions from './agent-actions'; actions.send(); export function Surface() { return <section />; }",
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        `Harness source \`apps/agent-harness/src/run/${name}\\.tsx\` contains a forbidden interaction`
      )
    );
  }
});

test('resolves imported local render-time callables', () => {
  const root = createRoot();
  const surfacePath = 'apps/agent-harness/src/run/ImportedHook.tsx';
  const helperPath = 'apps/agent-harness/src/run/use-send-on-render.ts';
  fs.mkdirSync(path.dirname(path.join(root, surfacePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, helperPath),
    "import * as actions from './agent-actions'; export function useSendOnRender() { actions.send(); }",
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, surfacePath),
    "import { useSendOnRender } from './use-send-on-render'; export function Surface() { useSendOnRender(); return <section />; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${surfacePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/ImportedHook\.tsx` contains a forbidden interaction/
  );
});

test('keeps the reviewed Harness bootstrap inside forbidden-state scanning', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/agent-harness/src/proto-ui/bootstrap.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useEffect } from 'react'; import * as actions from '../run/agent-actions'; export function Bootstrap() { useEffect(() => actions.send(), []); return <section />; }",
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/proto-ui\/bootstrap\.tsx` contains a forbidden interaction/
  );
});

test('follows local render helpers when inventorying exported surfaces', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/DelegatedSurface.tsx',
      /website component source `apps\/www\/src\/components\/DelegatedSurface\.tsx` is not classified/,
    ],
    [
      'apps/agent-harness/src/run/DelegatedSurface.tsx',
      /Harness user-facing source `apps\/agent-harness\/src\/run\/DelegatedSurface\.tsx` is not classified/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      'function View() { return <section />; } export function Surface() { return View(); }',
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('resolves array-form Vite aliases before consumer-wall classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "import { fileURLToPath } from 'node:url';",
      "export default { vite: { resolve: { alias: [{ find: 'rawRuntime', replacement: fileURLToPath(new URL('../../packages/runtime/src', import.meta.url)) }] } } };",
    ].join('\n'),
    'utf8'
  );
  const runtimePath = path.join(root, 'packages/runtime/src/index.ts');
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, 'export const runtime = true;', 'utf8');
  const sourcePath = 'apps/www/src/components/ArrayAliasRuntime.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { runtime } from 'rawRuntime';", 'utf8');
  assert.match(
    validationMessage(root),
    /raw Proto UI import `rawRuntime` in `apps\/www\/src\/components\/ArrayAliasRuntime\.ts` escapes the website consumer-wall allowlist/
  );
});

test('inspects transitive Proto UI imports from bare packages', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const packageRoot = path.join(root, 'node_modules/example-transport');
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({
      name: 'example-transport',
      version: '1.0.0',
      main: 'index.js',
      dependencies: { '@proto.ui/runtime': '1.0.0' },
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(packageRoot, 'index.js'),
    "import '@proto.ui/runtime'; export const transport = true;",
    'utf8'
  );
  const sourcePath = 'apps/www/src/components/BareTransport.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { transport } from 'example-transport';", 'utf8');
  assert.match(
    validationMessage(root),
    /raw Proto UI import `example-transport` in `apps\/www\/src\/components\/BareTransport\.ts` escapes the website consumer-wall allowlist/
  );
});

test('follows nested bare packages to governed Proto UI imports', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const packageA = path.join(root, 'node_modules/example-package-a');
  const packageB = path.join(packageA, 'node_modules/example-package-b');
  fs.mkdirSync(packageB, { recursive: true });
  fs.writeFileSync(
    path.join(packageA, 'package.json'),
    JSON.stringify({
      name: 'example-package-a',
      version: '1.0.0',
      main: 'index.js',
      dependencies: { 'example-package-b': '1.0.0' },
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(packageA, 'index.js'),
    "import 'example-package-b'; export const packageA = true;",
    'utf8'
  );
  fs.writeFileSync(
    path.join(packageB, 'package.json'),
    JSON.stringify({
      name: 'example-package-b',
      version: '1.0.0',
      main: 'index.js',
      dependencies: { '@proto.ui/runtime': '1.0.0' },
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(packageB, 'index.js'),
    "import '@proto.ui/runtime'; export const packageB = true;",
    'utf8'
  );
  const sourcePath = path.join(root, 'apps/www/src/components/NestedBarePackage.ts');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, "import 'example-package-a';", 'utf8');

  assert.match(
    validationMessage(root),
    /raw Proto UI import `example-package-a` in `apps\/www\/src\/components\/NestedBarePackage\.ts` escapes the website consumer-wall allowlist/
  );
});

test('inspects every conditional export entry of a bare package', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const packageRoot = path.join(root, 'node_modules/example-conditional');
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({
      name: 'example-conditional',
      version: '1.0.0',
      exports: {
        '.': {
          require: './safe.cjs',
          import: './browser.mjs',
        },
      },
      dependencies: { '@proto.ui/runtime': '1.0.0' },
    }),
    'utf8'
  );
  fs.writeFileSync(path.join(packageRoot, 'safe.cjs'), 'module.exports = { safe: true };', 'utf8');
  fs.writeFileSync(
    path.join(packageRoot, 'browser.mjs'),
    "import '@proto.ui/runtime'; export const browser = true;",
    'utf8'
  );
  const sourcePath = 'apps/www/src/components/ConditionalTransport.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { browser } from 'example-conditional';", 'utf8');
  assert.match(
    validationMessage(root),
    /raw Proto UI import `example-conditional` in `apps\/www\/src\/components\/ConditionalTransport\.ts` escapes the website consumer-wall allowlist/
  );
});

test('scans interaction in test-named modules reachable from production', () => {
  const root = createRoot();
  const productionPath = 'apps/www/src/components/InteractionBridge.astro';
  const bridgePath = 'apps/www/src/components/interaction.test.ts';
  fs.mkdirSync(path.dirname(path.join(root, productionPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, productionPath),
    "---\nimport './interaction.test';\n---\n<main />",
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, bridgePath),
    "document.querySelector('button').focus();",
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/interaction\.test\.ts` is not bound/
  );
});

test('follows Harness imports outside the source root', () => {
  const root = createRoot();
  const surfacePath = 'apps/agent-harness/src/run/OutsideHelper.tsx';
  const helperPath = 'apps/agent-harness/shared/runtime-bridge.ts';
  fs.mkdirSync(path.dirname(path.join(root, surfacePath)), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(root, helperPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, surfacePath),
    "import '../../shared/runtime-bridge'; export function Surface() { return <section />; }",
    'utf8'
  );
  fs.writeFileSync(path.join(root, helperPath), "import '@proto.ui/runtime';", 'utf8');
  writeValidMatrices(root, {}, { Path: `\`${surfacePath}\`` });
  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/runtime` in `apps\/agent-harness\/shared\/runtime-bridge\.ts` escapes the Harness consumer-wall allowlist/
  );
});

test('scans inline handlers and executable script sources in public HTML', () => {
  for (const [name, content, expected] of [
    [
      'inline-handler.html',
      '<button onkeydown="handleKey(event)">Run</button>',
      /interactive website source `apps\/www\/public\/inline-handler\.html` is not bound/,
    ],
    [
      'external-script.html',
      '<script src="/vendor/react.js"></script>',
      /external executable script `\/vendor\/react\.js` in `apps\/www\/public\/external-script\.html` is not reviewed/,
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/www/public/${name}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('ignores Markdown dimension artifacts that are not the dogfood evidence record', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const absoluteImplementationPath = path.join(root, implementationPath);
  fs.mkdirSync(path.dirname(absoluteImplementationPath), { recursive: true });
  fs.writeFileSync(absoluteImplementationPath, 'fixture', 'utf8');
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeHarnessPromotionArtifacts(root, revision);
  const evidenceRoot = 'internal/agent-harness/evidence/m1';
  const keyboardPath = `${evidenceRoot}/keyboard.md`;
  fs.writeFileSync(path.join(root, keyboardPath), 'Keyboard journey passed.\n', 'utf8');
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: \`${evidenceRoot}/build.log\`; Browser: \`${evidenceRoot}/browser-results.json\`; Accessibility: \`${evidenceRoot}/accessibility-results.json\`; Lifecycle: \`${evidenceRoot}/lifecycle-results.json\`; Design: \`${evidenceRoot}/design-review.txt\`; \`${evidencePath}\`; \`${keyboardPath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });
});

test('rejects truncated evidence images that contain only recognized magic bytes', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const revision = commitFixtureRoot(root);
  const { evidencePath } = writeSelfHostedPromotion(root, revision);
  const screenshotPath = path.join(root, 'internal/website/evidence/s14/home-desktop.png');
  fs.writeFileSync(screenshotPath, Buffer.from('ffd8ff', 'hex'));
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot: retained artifact must be a recognized image file/
  );
  assert.ok(evidencePath);
});

test('the ordinary local checker supplies stable checkout revisions after promotion', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  const env = { ...process.env };
  delete env.COVERAGE_BASE_REVISION;
  delete env.COVERAGE_HEAD_REVISION;
  delete env.COVERAGE_MERGE_REVISION;
  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/coverage-matrices/check-coverage-matrices.mjs')],
    { cwd: root, env, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[coverage-matrices\] OK \(2 matrices\)/);
});

test('CI runs the full pull-request suite on GitHub merge checkout', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/ci.yml'), 'utf8');
  const testJobStart = workflow.indexOf('\n  test-general:\n');
  const remainingWorkflow = workflow.slice(testJobStart + 1);
  const nextJobOffset = remainingWorkflow.slice(1).search(/^  [a-zA-Z0-9_-]+:\n/mu);
  const testJob =
    nextJobOffset < 0 ? remainingWorkflow : remainingWorkflow.slice(0, nextJobOffset + 1);
  assert.match(testJob, /COVERAGE_HEAD_REVISION:.*pull_request\.head\.sha/u);
  assert.match(testJob, /COVERAGE_BASE_REVISION:.*pull_request\.base\.sha/u);
  assert.match(testJob, /COVERAGE_MERGE_REVISION:.*github\.sha/u);
  const checkout = testJob.match(/- uses: actions\/checkout@v4[\s\S]*?fetch-depth: 0/u)?.[0] ?? '';
  assert.doesNotMatch(checkout, /^\s*ref:/mu);
});

test('promotion history accepts a checked-out merge revision distinct from the exact head', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const baseRevision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, baseRevision, { websiteBindings });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'exact head',
    ],
    { cwd: root }
  );
  const headRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const mergeRevision = commitFixtureChange(
    root,
    'merge-result-marker.txt',
    'synthetic merge result\n',
    'synthetic merge result'
  );
  assert.deepEqual(
    validateCoverageMatrices({ rootDir: root, baseRevision, headRevision, mergeRevision }),
    { matrixCount: 2 }
  );
});

test('promotion history accepts divergent base and head revisions through a two-parent merge', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const evidenceRevision = commitFixtureRoot(root);

  execFileSync('git', ['switch', '--quiet', '-c', 'feature'], { cwd: root });
  writeSelfHostedPromotion(root, evidenceRevision, { websiteBindings });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'exact head',
    ],
    { cwd: root }
  );
  const headRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  const evidenceTree = execFileSync('git', ['rev-parse', `${evidenceRevision}^{tree}`], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const baseRevision = execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit-tree',
      evidenceTree,
      '-p',
      evidenceRevision,
      '-m',
      'advance base',
    ],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  const headTree = execFileSync('git', ['rev-parse', `${headRevision}^{tree}`], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const mergeRevision = execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit-tree',
      headTree,
      '-p',
      headRevision,
      '-p',
      baseRevision,
      '-m',
      'synthetic merge',
    ],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  execFileSync('git', ['update-ref', 'HEAD', mergeRevision], { cwd: root });

  assert.deepEqual(
    validateCoverageMatrices({ rootDir: root, baseRevision, headRevision, mergeRevision }),
    { matrixCount: 2 }
  );
});

test('promotion history rejects invalid and incomplete merge revision proofs', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const baseRevision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, baseRevision, { websiteBindings });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Coverage Fixture',
      '-c',
      'user.email=coverage@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'exact head',
    ],
    { cwd: root }
  );
  const headRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const blobRevision = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: 'not a commit\n',
  }).trim();

  assert.match(
    validationMessage(root, { baseRevision, headRevision, mergeRevision: blobRevision }),
    new RegExp(
      'promotion merge revision `' + blobRevision + '` must identify a commit object directly'
    )
  );
  assert.match(
    validationMessage(root, { baseRevision, headRevision, mergeRevision: baseRevision }),
    new RegExp(
      'exact head `' +
        headRevision +
        '` must be an ancestor of merge revision `' +
        baseRevision +
        '`'
    )
  );
});

test('resolves useCallback-returned functions that execute during render', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/CallbackAction.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import { useCallback } from 'react'; import * as actions from './agent-actions'; export function Surface() { const run = useCallback(() => actions.send(), []); run(); return <section />; }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/CallbackAction\.tsx` contains a forbidden interaction/
  );
});

test('scans callbacks scheduled during render or effects', () => {
  for (const [name, scheduler] of [
    ['Timeout', 'setTimeout'],
    ['Interval', 'setInterval'],
    ['Microtask', 'queueMicrotask'],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/Scheduled${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const scheduledCall = `${scheduler}(() => actions.send(), 0)`;
    const source =
      scheduler === 'setTimeout' || scheduler === 'setInterval'
        ? `import { useEffect } from 'react'; import * as actions from './agent-actions'; export function Surface() { useEffect(() => { ${scheduledCall}; }, []); return <section />; }`
        : `import * as actions from './agent-actions'; export function Surface() { ${scheduledCall}; return <section />; }`;
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        `Harness source \`apps/agent-harness/src/run/Scheduled${name}\\.tsx\` contains a forbidden interaction`
      )
    );
  }
});

test('follows Promise reaction callbacks scheduled during render and effects', () => {
  for (const [name, imports, body] of [
    [
      'Then',
      "import * as actions from './agent-actions';",
      'Promise.resolve().then(() => actions.send());',
    ],
    [
      'Catch',
      "import * as actions from './agent-actions';",
      "Promise.reject(new Error('failure')).catch(() => actions.send());",
    ],
    [
      'FinallyInEffect',
      "import { useEffect } from 'react'; import * as actions from './agent-actions';",
      'useEffect(() => { Promise.resolve().finally(() => actions.send()); }, []);',
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/Promise${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `${imports} export function Surface() { ${body} return <section />; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      /Harness source `apps\/agent-harness\/src\/run\/Promise(?:Then|Catch|FinallyInEffect)\.tsx` contains a forbidden interaction/
    );
  }
});

test('does not reject Promise continuations without Agent actions', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/PromiseNoAction.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function Surface() { Promise.resolve().then(() => 1); return <section />; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('scans executable script sources in Markdown and MDX content', () => {
  for (const extension of ['md', 'mdx']) {
    const root = createRoot();
    const relativePath = `apps/www/src/content/docs/remote-script.${extension}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, '<script src="https://cdn.example/react.js"></script>', 'utf8');
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      new RegExp(
        `external executable script \`https://cdn\\.example/react\\.js\` in \`apps/www/src/content/docs/remote-script\\.${extension}\` is not reviewed`
      )
    );
  }
});

test('fails closed on variable dynamic imports in Website and Harness sources', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/VariableRuntime.ts',
      /unresolved dynamic import in `apps\/www\/src\/components\/VariableRuntime\.ts` must be statically bounded/,
    ],
    [
      'apps/agent-harness/src/run/VariableRuntime.ts',
      /unresolved dynamic import in `apps\/agent-harness\/src\/run\/VariableRuntime\.ts` must be statically bounded/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      'export function load(name) { return import(`../../../../packages/runtime/src/${name}.ts`); }',
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('fails closed on dynamic CommonJS requires in Website and Harness sources', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/ConstantRequire.ts',
      "const target = '@proto.ui/runtime'; require(target);",
      /raw Proto UI import `@proto\.ui\/runtime` in `apps\/www\/src\/components\/ConstantRequire\.ts` escapes the website consumer-wall allowlist/,
    ],
    [
      'apps/agent-harness/src/run/ConstantRequire.ts',
      "const target = '@proto.ui/runtime'; require(target);",
      /raw Proto UI import `@proto\.ui\/runtime` in `apps\/agent-harness\/src\/run\/ConstantRequire\.ts` escapes the Harness consumer-wall allowlist/,
    ],
    [
      'apps/agent-harness/src/run/ThirdPartyRequire.ts',
      "const target = 'downshift'; require(target);",
      /forbidden third-party Harness UI package `downshift` in `apps\/agent-harness\/src\/run\/ThirdPartyRequire\.ts`/,
    ],
    [
      'apps/www/src/components/DynamicRequire.ts',
      'export function load(name) { return require(name); }',
      /unresolved dynamic require in `apps\/www\/src\/components\/DynamicRequire\.ts` must be statically bounded/,
    ],
    [
      'apps/agent-harness/src/run/DynamicRequire.ts',
      'export function load(name) { return require(name); }',
      /unresolved dynamic require in `apps\/agent-harness\/src\/run\/DynamicRequire\.ts` must be statically bounded/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('rejects dynamic executable script sources in Astro and MDX', () => {
  for (const extension of ['astro', 'mdx']) {
    const root = createRoot();
    const relativePath = `apps/www/src/content/docs/dynamic-script.${extension}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, '<script is:inline src={runtimeUrl}></script>', 'utf8');
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      new RegExp(
        `dynamic executable script source in \`apps/www/src/content/docs/dynamic-script\\.${extension}\` must be static`
      )
    );
  }
});

test('rejects DOM handlers installed through Object.assign', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/AssignedHandler.ts',
      /interactive website source `apps\/www\/src\/components\/AssignedHandler\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/AssignedHandler.tsx',
      /Harness source `apps\/agent-harness\/src\/run\/AssignedHandler\.tsx` contains a forbidden interaction/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      "const button = document.querySelector('button'); Object.assign(button, { onclick() {} });",
      'utf8'
    );
    writeValidMatrices(
      root,
      {},
      relativePath.startsWith('apps/agent-harness/') ? { Path: `\`${relativePath}\`` } : {}
    );
    assert.match(validationMessage(root), expected);
  }
});

test('classifies event attributes installed through DOM attribute APIs', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/SetAttributeOnclick.ts',
      "const button = document.querySelector('button'); button?.setAttribute('ONCLICK', 'source');",
      /interactive website source `apps\/www\/src\/components\/SetAttributeOnclick\.ts` is not bound/,
    ],
    [
      'apps/www/src/components/RemoveAttributeOnclick.ts',
      "const button = document.querySelector('button'); button?.removeAttribute('onclick');",
      /interactive website source `apps\/www\/src\/components\/RemoveAttributeOnclick\.ts` is not bound/,
    ],
    [
      'apps/www/src/components/ToggleAttributeOnclick.ts',
      "const button = document.querySelector('button'); button?.toggleAttribute('onclick');",
      /interactive website source `apps\/www\/src\/components\/ToggleAttributeOnclick\.ts` is not bound/,
    ],
    [
      'apps/www/src/components/DynamicAttributeName.ts',
      "const button = document.querySelector('button'); button?.setAttribute(attributeName, 'source');",
      /interactive website source `apps\/www\/src\/components\/DynamicAttributeName\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/SetAttributeOnclick.tsx',
      "const button = document.querySelector('button'); button?.setAttribute('onclick', 'source');",
      /Harness source `apps\/agent-harness\/src\/run\/SetAttributeOnclick\.tsx` contains a forbidden interaction/,
    ],
    [
      'apps/agent-harness/src/run/RemoveAttributeOnclick.tsx',
      "const button = document.querySelector('button'); button?.removeAttribute('onclick');",
      /Harness source `apps\/agent-harness\/src\/run\/RemoveAttributeOnclick\.tsx` contains a forbidden interaction/,
    ],
    [
      'apps/agent-harness/src/run/ToggleAttributeOnclick.tsx',
      "const button = document.querySelector('button'); button?.toggleAttribute('onclick');",
      /Harness source `apps\/agent-harness\/src\/run\/ToggleAttributeOnclick\.tsx` contains a forbidden interaction/,
    ],
    [
      'apps/agent-harness/src/run/DynamicAttributeName.tsx',
      "const button = document.querySelector('button'); button?.setAttribute(attributeName, 'source');",
      /Harness source `apps\/agent-harness\/src\/run\/DynamicAttributeName\.tsx` contains a forbidden interaction/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(
      root,
      {},
      relativePath.startsWith('apps/agent-harness/') ? { Path: `\`${relativePath}\`` } : {}
    );
    assert.match(validationMessage(root), expected);
  }
});

test('does not fail closed on unknown attributes of non-DOM receivers', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/MetadataAttributes.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const metadata = { setAttribute(name, value) {} }; metadata.setAttribute(name, value);',
    'utf8'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('inventories static public HTML pages as user-facing surfaces', () => {
  const root = createRoot();
  const relativePath = 'apps/www/public/help.html';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<main><h1>Help</h1><form><button>Search</button></form></main>',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/public\/help\.html` is not classified by a matrix row/
  );
});

test('rejects truncated retained video evidence with recognized header bytes', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const videoPath = 'internal/website/evidence/s14/navigation.mp4';
  writeSelfHostedPromotion(root, revision, {
    websiteBindings,
    evidenceOverrides: { 'Multi-frame': `\`${videoPath}\`` },
  });
  fs.writeFileSync(path.join(root, videoPath), Buffer.from('000000186674797069736f6d', 'hex'));
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: retained video artifact must be structurally valid and contain frame data/
  );
});

test('rejects MP4 marker strings without a video sample table', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const videoPath = 'internal/website/evidence/s14/marker-only.mp4';
  const makeBox = (type, payload = Buffer.alloc(0)) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(header.length + payload.length, 0);
    header.write(type, 4, 4, 'ascii');
    return Buffer.concat([header, payload]);
  };
  const fakeMoov = Buffer.alloc(20);
  fakeMoov.write('vide', 0, 4, 'ascii');
  fakeMoov.write('stsz', 4, 4, 'ascii');
  fakeMoov.writeUInt32BE(1, 16);
  const fakeVideo = Buffer.concat([
    makeBox('ftyp', Buffer.from('isom\0\0\0\0', 'binary')),
    makeBox('moov', fakeMoov),
    makeBox('mdat', Buffer.from([0xff])),
  ]);
  writeVideoPromotionFixture(root, revision, websiteBindings, videoPath, fakeVideo);

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: retained video artifact must be structurally valid and contain frame data/
  );
});

test('rejects one-frame MP4 evidence despite a complete video sample table', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const uint32 = (value) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value, 0);
    return bytes;
  };
  const box = (type, payload = Buffer.alloc(0)) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(header.length + payload.length, 0);
    header.write(type, 4, 4, 'ascii');
    return Buffer.concat([header, payload]);
  };
  const fullBox = (type, payload = Buffer.alloc(0), flags = 0) => {
    const versionAndFlags = Buffer.alloc(4);
    versionAndFlags.writeUInt32BE(flags, 0);
    return box(type, Buffer.concat([versionAndFlags, payload]));
  };
  const makeMovie = (sampleOffset) => {
    const sampleEntry = Buffer.alloc(78);
    sampleEntry.writeUInt16BE(1, 6);
    sampleEntry.writeUInt16BE(1, 24);
    sampleEntry.writeUInt16BE(1, 26);
    sampleEntry.writeUInt16BE(1, 40);
    sampleEntry.writeUInt16BE(24, 74);
    sampleEntry.writeUInt16BE(0xffff, 76);
    const stsd = fullBox('stsd', Buffer.concat([uint32(1), box('raw ', sampleEntry)]));
    const stts = fullBox('stts', Buffer.concat([uint32(1), uint32(1), uint32(1)]));
    const stsc = fullBox('stsc', Buffer.concat([uint32(1), uint32(1), uint32(1), uint32(1)]));
    const stsz = fullBox('stsz', Buffer.concat([uint32(3), uint32(1)]));
    const stco = fullBox('stco', Buffer.concat([uint32(1), uint32(sampleOffset)]));
    const stbl = box('stbl', Buffer.concat([stsd, stts, stsc, stsz, stco]));
    const vmhd = fullBox('vmhd', Buffer.alloc(8), 1);
    const url = fullBox('url ', Buffer.alloc(0), 1);
    const dinf = box('dinf', fullBox('dref', Buffer.concat([uint32(1), url])));
    const minf = box('minf', Buffer.concat([vmhd, dinf, stbl]));
    const mdhdPayload = Buffer.alloc(20);
    mdhdPayload.writeUInt32BE(1, 8);
    mdhdPayload.writeUInt32BE(1, 12);
    const mdhd = fullBox('mdhd', mdhdPayload);
    const hdlr = fullBox(
      'hdlr',
      Buffer.concat([uint32(0), Buffer.from('vide'), Buffer.alloc(12), Buffer.from([0])])
    );
    const mdia = box('mdia', Buffer.concat([mdhd, hdlr, minf]));
    const tkhdPayload = Buffer.alloc(80);
    tkhdPayload.writeUInt32BE(1, 8);
    tkhdPayload.writeUInt32BE(1, 16);
    const tkhd = fullBox('tkhd', tkhdPayload, 3);
    const trak = box('trak', Buffer.concat([tkhd, mdia]));
    const mvhd = fullBox('mvhd', Buffer.alloc(100));
    return box('moov', Buffer.concat([mvhd, trak]));
  };
  const fileType = box('ftyp', Buffer.from('qt  \0\0\0\0qt  ', 'binary'));
  const firstMovie = makeMovie(0);
  const sampleOffset = fileType.length + firstMovie.length + 8;
  const video = Buffer.concat([
    fileType,
    makeMovie(sampleOffset),
    box('mdat', Buffer.from([0, 0, 0])),
  ]);
  const videoPath = 'internal/website/evidence/s14/one-frame.mp4';
  writeVideoPromotionFixture(root, revision, websiteBindings, videoPath, video);

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame:.*bounded decoder unverified/
  );
});

test('rejects WebM marker bytes without parsed track and block elements', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const ebmlId = (hex) => Buffer.from(hex, 'hex');
  const ebmlSize = (value) => {
    if (value < 0x80) {
      const bytes = Buffer.alloc(1);
      bytes.writeUInt8(value | 0x80, 0);
      return bytes;
    }
    const length = value < 0x4000 ? 2 : value < 0x200000 ? 3 : 4;
    const bytes = Buffer.alloc(length);
    const mask = 0x80 >> (length - 1);
    bytes.writeUInt8(mask | ((value >> (8 * (length - 1))) & (0xff >> length)), 0);
    for (let index = 1; index < length; index += 1) {
      bytes.writeUInt8((value >> (8 * (length - 1 - index))) & 0xff, index);
    }
    return bytes;
  };
  const element = (hex, payload) => Buffer.concat([ebmlId(hex), ebmlSize(payload.length), payload]);
  const ebmlHeader = element('1a45dfa3', Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
  const markerOnly = Buffer.concat([
    ebmlHeader,
    element('18538067', Buffer.concat([Buffer.from('1654ae6b1f43b675a3', 'hex')])),
  ]);
  const markerOnlyPath = 'internal/website/evidence/s14/webm-marker-only.webm';
  writeVideoPromotionFixture(
    root,
    revision,
    websiteBindings,
    markerOnlyPath,
    Buffer.concat([markerOnly, Buffer.from('1654ae6b1f43b675a3', 'hex')])
  );
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: retained video artifact must be structurally valid and contain frame data/
  );

  const structuredRoot = createRoot();
  const structuredImplementationPath = 'apps/www/src/components/override/Search.astro';
  fs.mkdirSync(path.dirname(path.join(structuredRoot, structuredImplementationPath)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(structuredRoot, structuredImplementationPath),
    '<main>reviewed</main>',
    'utf8'
  );
  writeValidMatrices(structuredRoot, {}, {}, { websiteBindings });
  const structuredRevision = commitFixtureRoot(structuredRoot);
  const trackEntry = element('ae', Buffer.from('01', 'hex'));
  const tracks = element('1654ae6b', trackEntry);
  const simpleBlock = element('a3', Buffer.from([0x81, 0x00, 0x03, 0xff, 0xfe, 0xfd]));
  const cluster = element('1f43b675', simpleBlock);
  const validWebm = Buffer.concat([
    ebmlHeader,
    element('18538067', Buffer.concat([tracks, cluster])),
  ]);
  const validWebmPath = 'internal/website/evidence/s14/webm-one-frame.webm';
  writeVideoPromotionFixture(
    structuredRoot,
    structuredRevision,
    websiteBindings,
    validWebmPath,
    validWebm
  );
  assert.match(
    validationMessage(structuredRoot, promotionOptions(structuredRevision)),
    /Multi-frame:.*bounded decoder unverified/
  );
});

test('rejects @vite-ignore dynamic imports without an exact reviewed boundary', () => {
  for (const [relativePath, expected] of [
    [
      'apps/www/src/components/IgnoredRuntime.ts',
      /@vite-ignore dynamic import in `apps\/www\/src\/components\/IgnoredRuntime\.ts` is not reviewed/,
    ],
    [
      'apps/agent-harness/src/run/IgnoredRuntime.ts',
      /@vite-ignore dynamic import in `apps\/agent-harness\/src\/run\/IgnoredRuntime\.ts` is not reviewed/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      'const runtimeUrl = globalThis.runtimeUrl; void import(/* @vite-ignore */ runtimeUrl);',
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('derives callable identity from explicit Agent action modules', () => {
  for (const [name, actionImport, invocation] of [
    ['DefaultAction', "import send from './agent-actions';", 'send();'],
    ['NamedAction', "import { createSession } from './agent-actions';", 'createSession();'],
    ['QualifiedAction', "import * as actions from './agent-actions';", 'actions.archiveSession();'],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `${actionImport} export function Surface() { ${invocation} return <section />; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        'Harness source `apps/agent-harness/src/run/' +
          name +
          '\\.tsx` contains a forbidden interaction'
      )
    );
  }
});

test('classifies checkbox and select state assignments as governed DOM state', () => {
  for (const [relativePath, source, expected] of [
    [
      'apps/www/src/components/CheckedState.ts',
      "const input = document.querySelector('input'); input.checked = true;",
      /interactive website source `apps\/www\/src\/components\/CheckedState\.ts` is not bound/,
    ],
    [
      'apps/agent-harness/src/run/SelectedIndex.ts',
      "const select = document.querySelector('select'); select.selectedIndex = 1;",
      /Harness source `apps\/agent-harness\/src\/run\/SelectedIndex\.ts` contains a forbidden interaction/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('rejects unreviewed external Website stylesheet imports', () => {
  for (const [relativePath, content] of [
    ['apps/www/src/styles/external.css', '@import url(https://cdn.example/proto-ui-theme.css);'],
    [
      'apps/www/src/components/ExternalStyle.astro',
      '<style>@import "https://cdn.example/controls.css";</style>',
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      new RegExp(
        'external stylesheet .* in `' + relativePath.replaceAll('.', '\\.') + '` is not reviewed'
      )
    );
  }
});

test('classifies DOM selection methods as governed interaction state', () => {
  for (const [name, expression] of [
    ['SetSelectionRange', 'input.setSelectionRange(0, 1)'],
    ['SetRangeText', "input.setRangeText('x')"],
    ['Select', 'input.select()'],
  ]) {
    const root = createRoot();
    const relativePath = `apps/www/src/components/${name}.ts`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `const input = document.querySelector('input'); ${expression};`,
      'utf8'
    );
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      new RegExp(
        'interactive website source `apps/www/src/components/' + name + '\\.ts` is not bound'
      )
    );
  }
});

test('classifies programmatic DOM activation as governed interaction state', () => {
  for (const [name, expression] of [
    [
      'Click',
      "const buttonRef = { current: document.querySelector('button') }; buttonRef.current?.click()",
    ],
    [
      'DispatchEvent',
      "const button = document.querySelector('button'); button.dispatchEvent(new Event('click'))",
    ],
  ]) {
    for (const [relativePath, matrixOverrides, expected] of [
      [
        `apps/www/src/components/${name}.ts`,
        [{}, {}],
        new RegExp(
          'interactive website source `apps/www/src/components/' + name + '\\.ts` is not bound'
        ),
      ],
      [
        `apps/agent-harness/src/run/${name}.tsx`,
        [{}, { Path: `\`apps/agent-harness/src/run/${name}.tsx\`` }],
        new RegExp(
          'Harness source `apps/agent-harness/src/run/' +
            name +
            '\\.tsx` contains a forbidden interaction'
        ),
      ],
    ]) {
      const root = createRoot();
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, expression, 'utf8');
      writeValidMatrices(root, ...matrixOverrides);
      assert.match(validationMessage(root), expected);
    }
  }
});

test('follows action callbacks through executed helpers and local effect wrappers', () => {
  for (const [name, helper, invocation] of [
    [
      'InvokedCallback',
      'const invoke = (callback) => callback();',
      'invoke(() => actions.send());',
    ],
    [
      'EffectWrapper',
      "import { useEffect } from 'react'; const useMount = (callback) => useEffect(callback, []);",
      'useMount(() => actions.send());',
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import * as actions from './agent-actions'; ${helper} export function Surface() { ${invocation} return <section />; }`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        'Harness source `apps/agent-harness/src/run/' +
          name +
          '\\.tsx` contains a forbidden interaction'
      )
    );
  }
});

test('rejects retained PNG screenshots without image data', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  const screenshotPath = path.join(root, 'internal/website/evidence/s14/home-desktop.png');
  fs.writeFileSync(
    screenshotPath,
    Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000049454e44ae426082',
      'hex'
    )
  );
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot: retained artifact must be a recognized image file/
  );
});

test('rejects indexed PNG evidence without a PLTE chunk and accepts palette-complete PNG', () => {
  const makeFixtureRoot = (pngBytes) => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    const { resultsPath } = writeSelfHostedPromotion(root, revision, { websiteBindings });
    const screenshotRelativePath = 'internal/website/evidence/s14/home-desktop.png';
    fs.writeFileSync(path.join(root, screenshotRelativePath), pngBytes);
    const manifestPath = path.join(root, resultsPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const artifact = manifest.artifacts.find((entry) => entry.path === screenshotRelativePath);
    assert.ok(artifact);
    artifact.size = pngBytes.length;
    artifact.sha256 = createHash('sha256').update(pngBytes).digest('hex');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return { root, revision };
  };

  const missingPalette = makeFixtureRoot(indexedPng({ includePalette: false }));
  assert.match(
    validationMessage(missingPalette.root, promotionOptions(missingPalette.revision)),
    /Screenshot: retained artifact must be a recognized image file/
  );

  const palette = makeFixtureRoot(indexedPng({ includePalette: true }));
  const paletteIssues = collectCoverageMatrixIssues({
    rootDir: palette.root,
    ...promotionOptions(palette.revision),
  });
  assert.ok(paletteIssues.length === 0, JSON.stringify(paletteIssues, null, 2));
});
test('rejects PNG screenshots with CRC-valid invalid image data streams', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const { resultsPath } = writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });
  const screenshotPath = 'internal/website/evidence/s14/home-desktop.png';
  const screenshotBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAABElEQVQA//8Ax58umAAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(root, screenshotPath), screenshotBytes);

  const manifestPath = path.join(root, resultsPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const artifact = manifest.artifacts.find((entry) => entry.path === screenshotPath);
  assert.ok(artifact);
  artifact.size = screenshotBytes.length;
  artifact.sha256 = createHash('sha256').update(screenshotBytes).digest('hex');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot: retained artifact must be a recognized image file/
  );
});
test('rejects undecodable GIF/JPEG/WebP evidence and accepts decoded images', async () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>', 'utf8');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const { evidencePath, resultsPath } = writeSelfHostedPromotion(root, revision, {
    websiteBindings,
  });
  const manifestPath = path.join(root, resultsPath);
  const probePaths = new Set([
    'internal/website/evidence/s14/probe.jpg',
    'internal/website/evidence/s14/probe.gif',
    'internal/website/evidence/s14/probe.webp',
  ]);
  const originalScreenshotPath = 'internal/website/evidence/s14/home-desktop.png';
  const replaceScreenshot = (relativePath, bytes) => {
    for (const existingPath of [...probePaths, originalScreenshotPath]) {
      fs.rmSync(path.join(root, existingPath), { force: true });
    }
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, bytes);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.artifacts = manifest.artifacts.filter(
      (artifact) => !probePaths.has(artifact.path) && artifact.path !== originalScreenshotPath
    );
    manifest.artifacts.push({
      path: relativePath,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(root, evidencePath),
      validSelfHostedWebsiteEvidence({
        Commit: revision,
        Screenshot: `\`${relativePath}\``,
      }),
      'utf8'
    );
  };

  assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
    matrixCount: 2,
  });

  const malformedJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x00, 0x01, 0x00, 0x01, 0xff, 0xd9,
  ]);
  const malformedGif = Buffer.from([
    ...Buffer.from('GIF89a', 'ascii'),
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x3b,
  ]);
  const malformedWebp = Buffer.alloc(20);
  malformedWebp.write('RIFF', 0, 'ascii');
  malformedWebp.writeUInt32LE(12, 4);
  malformedWebp.write('WEBP', 8, 'ascii');
  malformedWebp.write('VP8 ', 12, 'ascii');
  malformedWebp.writeUInt32LE(0, 16);

  for (const [relativePath, bytes] of [
    ['internal/website/evidence/s14/probe.jpg', malformedJpeg],
    ['internal/website/evidence/s14/probe.gif', malformedGif],
    ['internal/website/evidence/s14/probe.webp', malformedWebp],
  ]) {
    replaceScreenshot(relativePath, bytes);
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /Screenshot: retained artifact must be a recognized image file/,
      `${relativePath} must not pass as a decodable screenshot`
    );
  }

  const decodedImages = [
    [
      'internal/website/evidence/s14/probe.jpg',
      Buffer.from(
        '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJoAcC7/2Q==',
        'base64'
      ),
    ],
    [
      'internal/website/evidence/s14/probe.gif',
      Buffer.from('R0lGODlhAQABAIAAAExpcRhQoCH5BAUAAAAALAAAAAABAAEAAAICTAEAOw==', 'base64'),
    ],
    [
      'internal/website/evidence/s14/probe.webp',
      Buffer.from(
        'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoBAAEAAUAmJaACdLoAA5gA/vdZL/5Kf13eUXPd+tTIx8+4AAA=',
        'base64'
      ),
    ],
  ];
  for (const [relativePath, bytes] of decodedImages) {
    replaceScreenshot(relativePath, bytes);
    assert.deepEqual(
      validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }),
      { matrixCount: 2 },
      `${relativePath} must remain accepted when its image stream decodes`
    );
  }
});

test('rejects production import maps without an exact reviewed allowance', () => {
  const root = createRoot();
  const relativePath = 'apps/www/public/import-map.html';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<script type="importmap">{"imports":{"proto":"https://cdn.example/proto-ui.js"}}</script><script type="module">import "proto";</script>',
    'utf8'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /production import map(?: or unverified script type)? in `apps\/www\/public\/import-map\.html` is not reviewed/
  );
});

test('recognizes object-form Vue event directives', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/ObjectEvents.vue';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<template><button v-on="{ click: open }">Open</button></template>'
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/ObjectEvents\.vue` is not bound/
  );
});

test('rejects external and dynamic stylesheet links in Website markup', () => {
  for (const [relativePath, content, expected] of [
    [
      'apps/www/src/components/ExternalLink.astro',
      '<link rel="stylesheet" href="https://cdn.example/astro.css" />',
      /external stylesheet `https:\/\/cdn\.example\/astro\.css`/,
    ],
    [
      'apps/www/public/external-link.html',
      '<link rel="alternate stylesheet" href="https://cdn.example/html.css">',
      /external stylesheet `https:\/\/cdn\.example\/html\.css`/,
    ],
    [
      'apps/www/src/content/docs/external-link.mdx',
      '<link rel="stylesheet" href="https://cdn.example/mdx.css" />',
      /external stylesheet `https:\/\/cdn\.example\/mdx\.css`/,
    ],
    [
      'apps/www/src/components/DynamicLink.astro',
      '<link rel="stylesheet" href={themeUrl} />',
      /dynamic stylesheet source/,
    ],
    [
      'apps/www/public/dynamic-link.html',
      '<link rel="stylesheet" href="{{ themeUrl }}">',
      /dynamic stylesheet source/,
    ],
    [
      'apps/www/src/content/docs/dynamic-link.mdx',
      '<link rel="stylesheet" href={themeUrl} />',
      /dynamic stylesheet source/,
    ],
    [
      'apps/www/src/components/BoundLink.vue',
      '<template><link rel="stylesheet" :href="themeUrl" /></template>',
      /dynamic stylesheet source/,
    ],
    [
      'apps/www/src/components/BoundLonghandLink.vue',
      '<template><link rel="stylesheet" v-bind:href="themeUrl" /></template>',
      /dynamic stylesheet source/,
    ],
    [
      'apps/www/src/components/BrutalistPageStyle.astro',
      `<link rel={enabled ? 'stylesheet' : 'preload'} href="https://cdn.example/raw.css" />`,
      /dynamic stylesheet relation/,
    ],
    [
      'apps/www/src/content/docs/ConditionalRel.mdx',
      `<link rel={enabled ? 'stylesheet' : 'preload'} href="https://cdn.example/raw.css" />`,
      /dynamic stylesheet relation/,
    ],
    [
      'apps/www/src/components/ConditionalRel.vue',
      '<template><link :rel="stylesheetRelation" href="https://cdn.example/raw.css" /></template>',
      /dynamic stylesheet relation/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(
      root,
      relativePath.includes('ConditionalRel') ? { Path: `\`${relativePath}\`` } : {}
    );
    assert.match(validationMessage(root), expected);
  }
});

test('follows default-imported local action wrappers', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DefaultWrapper.tsx';
  const absolutePath = path.join(root, relativePath);
  const wrapperPath = path.join(root, 'apps/agent-harness/src/run/run.ts');
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import run from './run'; export function Surface() { run(); return <section />; }",
    'utf8'
  );
  fs.writeFileSync(
    wrapperPath,
    "import * as actions from './agent-actions'; export default function run() { actions.send(); }",
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/DefaultWrapper\.tsx` contains a forbidden interaction/
  );
});

test('requires rendered output before counting anonymous default Harness exports', () => {
  for (const [name, source] of [
    [
      'AnonymousStore',
      'export function Surface() { return <section />; } export default function () { return { ready: true }; }',
    ],
    [
      'AnonymousService',
      'export function Surface() { return <section />; } export default class { start() { return true; } }',
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
  }

  for (const [name, source] of [
    [
      'AnonymousFunctionSurface',
      'export function Surface() { return <section />; } export default function () { return <aside />; }',
    ],
    [
      'AnonymousClassSurface',
      'export function Surface() { return <section />; } export default class { render() { return <aside />; } }',
    ],
  ]) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${name}.tsx`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      new RegExp(
        'Harness user-facing source `apps/agent-harness/src/run/' +
          name +
          '\\.tsx` exposes 2 exported surfaces but has only 1 distinct matrix owner'
      )
    );
  }
});

test('rejects zero-valued Issue references before governance lookup', () => {
  const dependencyRoot = createRoot();
  writeValidMatrices(dependencyRoot, {}, { 'Dependency and owner': '#0; owner: scroll domain' });
  assert.match(
    validationMessage(dependencyRoot),
    /research rows must link a dependency as #<issue>/
  );

  const exemptionRoot = createRoot();
  writeValidMatrices(exemptionRoot, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'owner: website team',
    'Escape or exemption':
      'Reason: static presentation remains outside semantic ownership; limit: stylesheet only',
    'Re-review or removal issue': '#000 if the projection gains interaction',
  });
  assert.match(validationMessage(exemptionRoot), /must link re-review or removal as #<issue>/);
});

test('review closure: detects idle callbacks, including qualified schedulers', () => {
  for (const scheduler of [
    'requestIdleCallback',
    'window.requestIdleCallback',
    'globalThis.requestIdleCallback',
    'self.requestIdleCallback',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/run/IdleAction.tsx';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `import * as actions from './agent-actions'; export function Surface() { ${scheduler}(() => actions.send()); return <section />; }`
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });
    assert.match(
      validationMessage(root),
      /Harness source .*IdleAction.* contains a forbidden interaction/
    );
  }
});

test('review closure: follows installed peer dependencies to governed layers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [name, manifest, source] of [
    ['peer-consumer', { peerDependencies: { 'peer-runtime': '1.0.0' } }, "import 'peer-runtime';"],
    ['peer-runtime', {}, "import '@proto.ui/runtime';"],
  ]) {
    const directory = path.join(root, 'node_modules', name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', main: 'index.js', ...manifest })
    );
    fs.writeFileSync(path.join(directory, 'index.js'), source);
  }
  const sourcePath = path.join(root, 'apps/www/src/components/PeerConsumer.ts');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, "import 'peer-consumer';");
  assert.match(validationMessage(root), /raw Proto UI import `peer-consumer`.*PeerConsumer/);
});

test('review closure: inventories bracketed Vue event directives', () => {
  for (const directive of ['v-on:[eventName]', '@[eventName]', '@[eventName].stop']) {
    const root = createRoot();
    const relativePath = 'apps/www/src/components/DynamicEvents.vue';
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `<template><button ${directive}="handler">Open</button></template>`
    );
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /interactive website source .*DynamicEvents.vue.* is not bound/
    );
  }
});

test('review closure: rejects URL module imports in browser-owned sources', () => {
  for (const target of [
    'https://cdn.example/runtime.js',
    '//cdn.example/runtime.js',
    'data:text/javascript,void%200',
  ]) {
    const root = createRoot();
    const sourcePath = path.join(root, 'apps/www/public/remote-module.html');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `<script type="module">import '${target}'</script>`);
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /external executable script .*remote-module.html.* is not reviewed/
    );
  }
});

test('review closure: scans Harness entry HTML and public scripts', () => {
  for (const [relativePath, source] of [
    ['apps/agent-harness/index.html', '<script src="https://cdn.example/widget.js"></script>'],
    ['apps/agent-harness/public/worker.js', "import '@proto.ui/runtime';"],
    [
      'apps/agent-harness/public/entry.html',
      '<script type="module">import "https://cdn.example/runtime.js"</script>',
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source);
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /(?:external executable|raw Proto UI import).*apps\/agent-harness\/(?:index|public)/
    );
  }
});

test('review closure: scans service worker registration targets', () => {
  for (const family of ['www', 'agent-harness']) {
    for (const target of ["'/raw-runtime.js'", "'https://cdn.example/sw.js'", 'workerUrl']) {
      const root = createRoot();
      const relativePath = `apps/${family}/src/registered-worker.ts`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `navigator.serviceWorker.register(${target});`);
      writeValidMatrices(root);
      assert.match(
        validationMessage(root),
        /(?:external executable|unresolved Worker).*registered-worker.ts/
      );
    }
  }
});

test('review closure: inspects DOM-created stylesheet links and dynamic relations', () => {
  for (const [source, expected] of [
    [
      "const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.example/theme.css'; document.head.append(link);",
      /external stylesheet .*theme.css/,
    ],
    [
      "const link = document.createElement('link'); link.setAttribute('href', 'https://cdn.example/theme.css'); link.setAttribute('rel', 'stylesheet');",
      /external stylesheet .*theme.css/,
    ],
    [
      "const link = document.createElement('link'); link.rel = relation; link.href = 'https://cdn.example/theme.css';",
      /dynamic stylesheet relation/,
    ],
    [
      "const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = themeUrl;",
      /dynamic stylesheet source/,
    ],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, 'apps/www/src/components/DomStylesheet.ts');
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source);
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('review closure: preserves safe resource objects, icon links and local module bootstraps', () => {
  for (const source of [
    "const link = document.createElement('link'); link.rel = 'icon'; link.href = 'https://cdn.example/icon.png';",
    "const link = { rel: 'stylesheet', href: '' }; link.href = 'https://cdn.example/business-value';",
    "const navigator = { serviceWorker: { register() {} } }; navigator.serviceWorker.register('/business-value');",
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, 'apps/www/src/components/SafeResource.ts');
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
  const root = createRoot();
  fs.mkdirSync(path.join(root, 'apps/agent-harness/src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'apps/agent-harness/index.html'),
    '<script type="module" src="/src/main.ts"></script>'
  );
  fs.writeFileSync(
    path.join(root, 'apps/agent-harness/src/main.ts'),
    'export const bootstrap = true;'
  );
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

test('review closure: tracks link aliases, same-name shadows and qualified service workers', () => {
  for (const [source, expected] of [
    [
      "const link = document.createElement('link'); const alias = link; alias.rel = 'stylesheet'; alias.href = 'https://cdn.example/alias.css';",
      /external stylesheet .*alias.css/,
    ],
    [
      "const link = document.createElement('link'); link.rel = 'stylesheet'; function local() { const link = {}; link.href = 'https://cdn.example/safe'; } link.href = 'https://cdn.example/outer.css';",
      /external stylesheet .*outer.css/,
    ],
    [
      "window.navigator.serviceWorker.register('/worker.js');",
      /external executable script .*worker.js/,
    ],
    ['globalThis.navigator.serviceWorker.register(workerUrl);', /unresolved Worker/],
  ]) {
    const root = createRoot();
    const absolutePath = path.join(root, 'apps/www/src/components/ResourceAlias.ts');
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source);
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  }
});

test('review closure: build-time module identities do not authorize public browser imports', () => {
  for (const target of ['astro:content', 'virtual:starlight/user-config', 'node:fs']) {
    const root = createRoot();
    const absolutePath = path.join(root, 'apps/www/public/build-time-only.html');
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `<script type="module">import '${target}'</script>`);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /external executable script .*build-time-only.html/);
  }
});

test('review closure: local DOM stylesheet contents retain their own consumer-wall scan', () => {
  const root = createRoot();
  const sourcePath = path.join(root, 'apps/www/src/components/LocalStylesheet.ts');
  const stylesheetPath = path.join(root, 'apps/www/public/theme.css');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(stylesheetPath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    "const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/theme.css';"
  );
  fs.writeFileSync(stylesheetPath, '@import "https://cdn.example/unreviewed.css";');
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /external stylesheet .*unreviewed.css.*apps\/www\/public\/theme.css/
  );
});

test('review closure: navigator parameters and hoisted local declarations are business bindings', () => {
  for (const source of [
    "function render(navigator) { navigator.serviceWorker.register('/business'); }",
    "function render() { navigator.serviceWorker.register('/business'); var navigator = { serviceWorker: { register() {} } }; }",
    "function render() { navigator.serviceWorker.register('/business'); let navigator = { serviceWorker: { register() {} } }; }",
    "navigator.serviceWorker.register('/business'); function navigator() {}",
  ]) {
    const root = createRoot();
    const sourcePath = path.join(root, 'apps/www/src/components/ShadowedNavigator.ts');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('follow-up review: scans Vite module and browser entry fields', () => {
  for (const entryFields of [
    { module: './client.js' },
    { browser: './client.js' },
    { 'jsnext:main': './client.js' },
    { jsnext: './client.js' },
    { module: './client' },
    { browser: { './safe.cjs': './client.js' } },
  ]) {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/vite-entry');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'vite-entry', main: './safe.cjs', ...entryFields })
    );
    fs.writeFileSync(path.join(directory, 'safe.cjs'), 'module.exports = {};');
    fs.writeFileSync(path.join(directory, 'client.js'), "import '@proto.ui/runtime';");
    const source = path.join(root, 'apps/www/src/components/ViteEntry.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'vite-entry';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import `vite-entry`.*ViteEntry.ts/);
  }
});

test('follow-up review: an unvisited package graph tail fails closed at the traversal bound', () => {
  const root = createRoot();
  const directory = path.join(root, 'node_modules/large-entry');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'large-entry', main: './0.js' })
  );
  for (let index = 0; index <= 500; index += 1) {
    fs.writeFileSync(
      path.join(directory, `${index}.js`),
      index === 500 ? "import '@proto.ui/runtime';" : `import './${index + 1}.js';`
    );
  }
  const source = path.join(root, 'apps/www/src/components/LargeEntry.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "import 'large-entry';");
  writeValidMatrices(root);
  assert.match(validationMessage(root), /package traversal.*500.*unverified/);
});

test('follow-up review: rejects Harness entry and public HTML interaction ownership', () => {
  for (const relativePath of [
    'apps/agent-harness/index.html',
    'apps/agent-harness/public/interaction.html',
  ]) {
    for (const source of [
      '<button onclick="send()">Send</button>',
      '<script>document.addEventListener("keydown", handler);</script>',
      '<script>document.querySelector("button").focus();</script>',
    ]) {
      const root = createRoot();
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, source);
      writeValidMatrices(root);
      assert.match(validationMessage(root), /Harness source.*\.html.*forbidden interaction/);
    }
  }
});

test('follow-up review: static Harness markup does not gain forbidden state ownership', () => {
  const root = createRoot();
  const source = path.join(root, 'apps/agent-harness/index.html');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, '<main><h1>Overview</h1><p>Read-only content</p></main>');
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

test('follow-up review: unresolved declared Vite entries stay unverified', () => {
  const root = createRoot();
  const directory = path.join(root, 'node_modules/missing-browser-entry');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'missing-browser-entry', main: './safe.cjs', module: './missing.js' })
  );
  fs.writeFileSync(path.join(directory, 'safe.cjs'), 'module.exports = {};');
  const source = path.join(root, 'apps/www/src/components/MissingBrowserEntry.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "import 'missing-browser-entry';");
  writeValidMatrices(root);
  assert.match(validationMessage(root), /package entry target.*missing.js.*unverified/);
});

test('current review: follows hit-test and namespace acquisition receivers without business false positives', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run']) {
    for (const source of [
      'document.elementFromPoint(1, 2)?.focus();',
      'const hit = document.elementFromPoint(1, 2); hit.ariaExpanded = "true";',
      'const hits = document.elementsFromPoint(1, 2); hits[0]?.scrollIntoView();',
      'document.createElementNS("http://www.w3.org/2000/svg", "svg").focus();',
    ]) {
      const root = createRoot();
      const absolutePath = path.join(root, prefix, 'HitTest.ts');
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, source);
      writeValidMatrices(root);
      assert.match(
        validationMessage(root),
        /interactive website source.*HitTest|Harness source.*HitTest.*forbidden interaction/
      );
    }
  }
  const root = createRoot();
  const source = path.join(root, 'apps/www/src/components/BusinessHitTest.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(
    source,
    'const model = { elementFromPoint() { return { focus() {} }; } }; model.elementFromPoint().focus();'
  );
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

test('current review: scans package imports maps, including conditional and pattern targets', () => {
  for (const [imports, imported] of [
    [{ '#runtime': './runtime.js' }, '#runtime'],
    [{ '#runtime': { browser: './runtime.js', default: './safe.cjs' } }, '#runtime'],
    [{ '#internal/*': './*.js' }, '#internal/runtime'],
    [{ '#runtime': '@proto.ui/runtime' }, '#runtime'],
  ]) {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/mapped-entry');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'mapped-entry', main: './entry.js', imports })
    );
    fs.writeFileSync(path.join(directory, 'entry.js'), `import '${imported}';`);
    fs.writeFileSync(path.join(directory, 'runtime.js'), "import '@proto.ui/runtime';");
    fs.writeFileSync(path.join(directory, 'safe.cjs'), 'module.exports = {};');
    const source = path.join(root, 'apps/www/src/components/MappedEntry.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'mapped-entry';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import `mapped-entry`.*MappedEntry.ts/);
  }
});

test('current review: scans stylesheet package entries and relative nested imports', () => {
  for (const extension of ['css', 'scss', 'sass', 'less']) {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/style-entry');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'style-entry', main: `./entry.${extension}` })
    );
    fs.writeFileSync(
      path.join(directory, `entry.${extension}`),
      `@import './nested.${extension}';`
    );
    fs.writeFileSync(
      path.join(directory, `nested.${extension}`),
      "@import '@proto.ui/prototypes-shadcn/styles.css';"
    );
    const source = path.join(root, 'apps/www/src/styles/package.css');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "@import 'style-entry';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import `style-entry`.*package.css/);
  }
});

test('current review: collects Harness markup stylesheet relations and local targets', () => {
  for (const relativePath of [
    'apps/agent-harness/index.html',
    'apps/agent-harness/public/styles.html',
  ]) {
    for (const [source, expected] of [
      ['<link rel="stylesheet" href="https://cdn.example/ui.css">', /external stylesheet.*ui.css/],
      ['<link rel="stylesheet" href={themeHref}>', /dynamic stylesheet source/],
      ['<link rel={relation} href="https://cdn.example/ui.css">', /dynamic stylesheet relation/],
      ['<link rel="stylesheet" href="/theme.css">', /raw Proto UI import.*prototypes-shadcn/],
    ]) {
      const root = createRoot();
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, source);
      const cssPath = path.join(root, 'apps/agent-harness/public/theme.css');
      fs.mkdirSync(path.dirname(cssPath), { recursive: true });
      fs.writeFileSync(cssPath, "@import '@proto.ui/prototypes-shadcn/styles.css';");
      writeValidMatrices(root);
      assert.match(validationMessage(root), expected);
    }
  }
});

function currentReviewPromotion() {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), '<main>reviewed</main>');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  const { resultsPath } = writeSelfHostedPromotion(root, revision, { websiteBindings });
  const replaceArtifact = (repositoryPath, bytes) => {
    fs.writeFileSync(path.join(root, repositoryPath), bytes);
    const manifestPath = path.join(root, resultsPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const artifact = manifest.artifacts.find((entry) => entry.path === repositoryPath);
    artifact.size = bytes.length;
    artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  };
  return { root, revision, replaceArtifact, websiteBindings };
}

test('current review: rejects out-of-palette indexed PNG pixels with valid CRC and digests', () => {
  for (const bitDepth of [1, 2, 4, 8]) {
    const { root, revision, replaceArtifact } = currentReviewPromotion();
    replaceArtifact(
      'internal/website/evidence/s14/home-desktop.png',
      indexedPng({ includePalette: true, pixel: 1, bitDepth })
    );
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /Screenshot: retained artifact must be a recognized image file/
    );
  }
});

test('current review: duplicate bytes at different frame paths cannot prove a transition', () => {
  const { root, revision, replaceArtifact } = currentReviewPromotion();
  replaceArtifact(
    'internal/website/evidence/s14/navigation-after.png',
    fs.readFileSync(path.join(root, 'internal/website/evidence/s14/navigation-before.png'))
  );
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: JSON manifest must retain at least two content-distinct frames/
  );
});

function indexedGridPng({ bitDepth, filter, interlaced, invalid, paletteSize = invalid ? 1 : 2 }) {
  const width = 9,
    height = 9;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = 3;
  header[12] = interlaced ? 1 : 0;
  const passes = interlaced
    ? [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ]
    : [[0, 0, 1, 1]];
  const rows = [];
  for (const [x, y, dx, dy] of passes) {
    const xs = Array.from({ length: Math.ceil((width - x) / dx) }, (_, i) => x + i * dx);
    let previous = Buffer.alloc(Math.ceil((xs.length * bitDepth) / 8));
    for (let row = y; row < height; row += dy) {
      const raw = Buffer.alloc(previous.length);
      xs.forEach((column, index) => {
        const value = (column + row) % 2;
        raw[Math.floor((index * bitDepth) / 8)] |=
          value << (8 - bitDepth - ((index * bitDepth) % 8));
      });
      const encoded = Buffer.alloc(raw.length + 1);
      encoded[0] = filter;
      for (let byte = 0; byte < raw.length; byte += 1) {
        const left = raw[byte - 1] ?? 0,
          above = previous[byte],
          diagonal = previous[byte - 1] ?? 0;
        let prediction = 0;
        if (filter === 1) prediction = left;
        if (filter === 2) prediction = above;
        if (filter === 3) prediction = Math.floor((left + above) / 2);
        if (filter === 4) {
          const p = left + above - diagonal;
          const candidates = [left, above, diagonal];
          prediction = candidates.reduce((best, candidate) =>
            Math.abs(p - candidate) < Math.abs(p - best) ? candidate : best
          );
        }
        encoded[byte + 1] = (raw[byte] - prediction) & 255;
      }
      rows.push(encoded);
      previous = raw;
    }
  }
  const palette = Buffer.alloc(paletteSize * 3);
  if (paletteSize > 1) palette[3] = 255;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('PLTE', palette),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('current review: indexed PNG reconstruction covers all filters, bit depths and Adam7 passes', () => {
  const { root, revision, replaceArtifact } = currentReviewPromotion();
  for (const bitDepth of [1, 2, 4, 8]) {
    for (const filter of [0, 1, 2, 3, 4]) {
      for (const interlaced of [false, true]) {
        for (const invalid of [false, true]) {
          replaceArtifact(
            'internal/website/evidence/s14/home-desktop.png',
            indexedGridPng({ bitDepth, filter, interlaced, invalid })
          );
          const issues = collectCoverageMatrixIssues({
            rootDir: root,
            ...promotionOptions(revision),
          });
          if (invalid)
            assert.ok(
              issues.some((issue) => /Screenshot:.*recognized image/.test(issue)),
              JSON.stringify({ bitDepth, filter, interlaced, issues })
            );
          else
            assert.deepEqual(issues, [], JSON.stringify({ bitDepth, filter, interlaced, issues }));
        }
      }
    }
  }
});

test('current review: palette size and decompression resources fail closed', () => {
  const { root, revision, replaceArtifact } = currentReviewPromotion();
  const oversized = indexedGridPng({
    bitDepth: 1,
    filter: 0,
    interlaced: false,
    invalid: false,
    paletteSize: 3,
  });
  replaceArtifact('internal/website/evidence/s14/home-desktop.png', oversized);
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot:.*recognized image/
  );
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16 * 1024 * 1024 + 1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 3;
  const bomb = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('PLTE', Buffer.from([0, 0, 0])),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from([0, 0]))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  replaceArtifact('internal/website/evidence/s14/home-desktop.png', bomb);
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot:.*recognized image/
  );
});

test('current review: imports maps resolve from package root and reject unverified targets', () => {
  for (const [target, expected] of [
    ['./safe.js', null],
    ['node:fs', null],
    ['./missing.js', /package entry target.*unverified/],
    ['missing-external-package', /package entry target.*unverified/],
    ['../outside.js', /package entry target.*unverified/],
    [null, /package entry target.*unverified/],
  ]) {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/root-map');
    fs.mkdirSync(path.join(directory, 'nested'), { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name: 'root-map',
        main: './nested/entry.js',
        imports: { '#mapped': target },
      })
    );
    fs.writeFileSync(path.join(directory, 'nested/entry.js'), "import '#mapped';");
    fs.writeFileSync(path.join(directory, 'safe.js'), 'export const label = "safe";');
    const source = path.join(root, 'apps/www/src/components/RootMap.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'root-map';");
    writeValidMatrices(root);
    if (expected) assert.match(validationMessage(root), expected);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('current review: harmless Harness icon and local styles remain valid', () => {
  const root = createRoot();
  const html = path.join(root, 'apps/agent-harness/index.html');
  fs.mkdirSync(path.dirname(html), { recursive: true });
  fs.writeFileSync(
    html,
    '<link rel="icon" href="https://cdn.example/icon.ico"><link rel="stylesheet" href="/theme.css">'
  );
  const css = path.join(root, 'apps/agent-harness/public/theme.css');
  fs.mkdirSync(path.dirname(css), { recursive: true });
  fs.writeFileSync(css, 'body { color: black; }');
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

test('current review: equal pixels with different PNG metadata do not prove a transition', () => {
  const { root, revision, replaceArtifact } = currentReviewPromotion();
  assert.doesNotThrow(() =>
    validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
  );
  const before = fs.readFileSync(
    path.join(root, 'internal/website/evidence/s14/navigation-before.png')
  );
  const alternate = Buffer.concat([
    before.subarray(0, -12),
    pngChunk('tEXt', Buffer.from('Comment\0different encoding metadata')),
    before.subarray(-12),
  ]);
  assert.notDeepEqual(before, alternate);
  replaceArtifact('internal/website/evidence/s14/navigation-after.png', alternate);
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Multi-frame: JSON manifest must retain at least two content-distinct frames/
  );
});

test('current review: stylesheet package traversal includes extensionless and compiled markup targets', () => {
  for (const [entry, text, suffix] of [
    ['entry.css', "@import './nested';", 'css'],
    ['entry.vue', "<style>@import './nested.css';</style>", 'css'],
    ['entry.svelte', "<style>@import './nested.css';</style>", 'css'],
  ]) {
    const root = createRoot();
    const directory = path.join(root, 'node_modules/compiled-entry');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'compiled-entry', main: `./${entry}` })
    );
    fs.writeFileSync(path.join(directory, entry), text);
    fs.writeFileSync(
      path.join(directory, `nested.${suffix}`),
      "@import '@proto.ui/prototypes-shadcn/theme';"
    );
    const source = path.join(root, 'apps/www/src/components/CompiledEntry.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'compiled-entry';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import `compiled-entry`/);
  }
});

test('current review: image file byte limit is enforced before read and decode', () => {
  const { root, revision } = currentReviewPromotion();
  const filename = path.join(root, 'internal/website/evidence/s14/home-desktop.png');
  const descriptor = fs.openSync(filename, 'w');
  fs.ftruncateSync(descriptor, 32 * 1024 * 1024 + 1);
  fs.closeSync(descriptor);
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /Screenshot:.*recognized image/
  );
});

test('real decoded MP4 and WebM remain accepted through the complete evidence gate', () => {
  for (const fixture of ['moov-at-end.mp4', 'colors.webm']) {
    const { root, revision, websiteBindings } = currentReviewPromotion();
    const bytes = fs.readFileSync(new URL(`./fixtures/video/${fixture}`, import.meta.url));
    writeVideoPromotionFixture(
      root,
      revision,
      websiteBindings,
      `internal/website/evidence/s14/${fixture}`,
      bytes
    );
    assert.deepEqual(validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }), {
      matrixCount: 2,
    });
  }
});

test('latest review: DOM receiver propagation includes shadow roots and fragments', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run']) {
    for (const source of [
      "document.querySelector('x-host')?.shadowRoot?.querySelector('button')?.focus();",
      "const root = document.querySelector('x-host').shadowRoot; const button = root.querySelector('button'); button.ariaExpanded = 'true';",
      "document.querySelector('x-host').attachShadow({mode:'open'}).querySelector('button').scrollIntoView();",
      "document.querySelector('button').getRootNode().querySelector('input').select();",
      "document.createDocumentFragment().querySelector('input').focus();",
      "document.querySelector('template').content.querySelector('button').focus();",
    ]) {
      const root = createRoot();
      const filename = path.join(root, prefix, 'ShadowReceiver.ts');
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, source);
      writeValidMatrices(root);
      assert.match(
        validationMessage(root),
        /interactive website source.*ShadowReceiver|Harness source.*ShadowReceiver.*forbidden interaction/
      );
    }
  }
});

test('latest review: proven resource elements retain Object.assign initialization boundaries', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run']) {
    for (const [source, expected] of [
      [
        "Object.assign(document.createElement('script'), {src:'https://cdn.example/runtime.js'});",
        /external executable script.*runtime.js/,
      ],
      [
        "const script = document.createElement('script'); Object.assign(script, {['src']: loaderUrl});",
        /dynamic executable script/,
      ],
      [
        "const script = Object.assign(document.createElement('script'), {async:true}); script.src='https://cdn.example/alias.js';",
        /external executable script.*alias.js/,
      ],
      ["Object.assign(document.createElement('script'), options);", /dynamic executable script/],
      [
        "Object.assign(document.createElement('link'), {rel:'stylesheet',href:'https://cdn.example/theme.css'});",
        /external stylesheet.*theme.css/,
      ],
      [
        "Object.assign(document.createElement('link'), {...options});",
        /dynamic stylesheet relation/,
      ],
    ]) {
      const root = createRoot();
      const filename = path.join(root, prefix, 'AssignResource.ts');
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, source);
      writeValidMatrices(root);
      assert.match(validationMessage(root), expected);
    }
  }
});

test('latest review: business roots and shadowed Object helpers remain outside DOM proof', () => {
  for (const source of [
    'const model = {shadowRoot:{querySelector(){return {focus(){}};}}}; model.shadowRoot.querySelector().focus();',
    "const model={}; Object.assign(model,{src:'https://cdn.example/business'});",
    "function business(Object) { Object.assign(document.createElement('script'),{src:'https://cdn.example/business'}); }",
    "Object.assign(document.createElement('link'), {rel:'icon',href:'https://cdn.example/icon.ico'});",
    "Object.assign(document.createElement('script'), {async:true});",
  ]) {
    const root = createRoot();
    const filename = path.join(root, 'apps/www/src/components/BusinessAssign.ts');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('closure review: Vite-root helper changes invalidate captured Website evidence', () => {
  for (const specifier of ['/src/helper.ts', '/src/helper.ts?raw']) {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const helperPath = 'apps/www/src/helper.ts';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `---\nimport { label } from '${specifier}';\n---\n<main>{label}</main>`
    );
    fs.writeFileSync(path.join(root, helperPath), "export const label = 'captured';");
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    assert.doesNotThrow(() =>
      validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
    );
    fs.writeFileSync(path.join(root, helperPath), "export const label = 'changed';");
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promoted dependency `apps\/www\/src\/helper.ts` differs from evidence Commit/
    );
  }
});

test('closure review: Reflect.set resource mutations are checked without business false positives', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run']) {
    for (const [source, expected] of [
      [
        "const script=document.createElement('script'); Reflect.set(script,'src','https://cdn.example/runtime.js');",
        /external executable script.*runtime.js/,
      ],
      [
        "Reflect.set(document.createElement('script'), property, value);",
        /dynamic executable script/,
      ],
      [
        "const link=document.createElement('link'); Reflect.set(link,'rel','stylesheet'); Reflect.set(link,'href','https://cdn.example/theme.css');",
        /external stylesheet.*theme.css/,
      ],
      ["Reflect.set(document.createElement('link'), property, value);", /dynamic stylesheet/],
    ]) {
      const root = createRoot(),
        filename = path.join(root, prefix, 'ReflectResource.ts');
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, source);
      writeValidMatrices(root);
      assert.match(validationMessage(root), expected);
    }
  }
  for (const source of [
    "Reflect.set({},'src','https://cdn.example/business');",
    "function business(Reflect) { Reflect.set(document.createElement('script'),'src','https://cdn.example/business'); }",
    "Reflect.set(document.createElement('script'),'async',true);",
  ]) {
    const root = createRoot(),
      filename = path.join(root, 'apps/www/src/components/BusinessReflect.ts');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('closure review: package-local Vite globs enter the bounded dependency scan', () => {
  for (const pattern of ["'./features/*.js'", "['./features/*.js','!./features/safe.js']"]) {
    const root = createRoot(),
      directory = path.join(root, 'node_modules/glob-entry');
    fs.mkdirSync(path.join(directory, 'features'), { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'glob-entry', main: './entry.js' })
    );
    fs.writeFileSync(
      path.join(directory, 'entry.js'),
      `const modules=import.meta.glob(${pattern},{eager:true});`
    );
    fs.writeFileSync(path.join(directory, 'features/guarded.js'), "import '@proto.ui/runtime';");
    fs.writeFileSync(path.join(directory, 'features/safe.js'), 'export const label="safe";');
    const source = path.join(root, 'apps/www/src/components/GlobEntry.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'glob-entry';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import `glob-entry`/);
  }
});

test('closure review: Vite-root context survives a shared helper outside its app directory', () => {
  const root = createRoot(),
    implementationPath = 'apps/www/src/components/override/Search.astro';
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    "---\nimport { label } from '../../../../../shared/bridge.ts';\n---\n<main>{label}</main>"
  );
  fs.writeFileSync(path.join(root, 'shared/bridge.ts'), "export { label } from '/src/helper.ts';");
  fs.writeFileSync(path.join(root, 'apps/www/src/helper.ts'), "export const label='captured';");
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.doesNotThrow(() =>
    validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
  );
  fs.writeFileSync(path.join(root, 'apps/www/src/helper.ts'), "export const label='changed';");
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted dependency `apps\/www\/src\/helper.ts` differs/
  );
});

test('closure review: Harness Vite-root imports include reachable test-named production code', () => {
  const root = createRoot(),
    entry = path.join(root, 'apps/agent-harness/index.html'),
    helper = path.join(root, 'apps/agent-harness/src/reachable.test.ts');
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.writeFileSync(entry, '<script type="module" src="/src/reachable.test.ts"></script>');
  fs.writeFileSync(helper, "document.querySelector('button').focus();");
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/reachable.test.ts`.*forbidden interaction/
  );
});

test('closure review: package glob exclusions and the 500-module bound remain effective', () => {
  for (const mode of ['safe', 'excluded', 'large']) {
    const root = createRoot(),
      directory = path.join(root, 'node_modules/bounded-glob');
    fs.mkdirSync(path.join(directory, 'features'), { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'bounded-glob', main: './entry.js' })
    );
    fs.writeFileSync(
      path.join(directory, 'entry.js'),
      `const all=import.meta.glob(${mode === 'excluded' ? "['./features/*.js','!./features/guarded.js']" : "'./features/*.js'"},{eager:true});`
    );
    for (let index = 0; index < (mode === 'large' ? 501 : 1); index += 1)
      fs.writeFileSync(path.join(directory, `features/${index}.js`), 'export const safe=true;');
    if (mode === 'excluded')
      fs.writeFileSync(path.join(directory, 'features/guarded.js'), "import '@proto.ui/runtime';");
    const source = path.join(root, 'apps/www/src/components/BoundedGlob.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "import 'bounded-glob';");
    writeValidMatrices(root);
    if (mode === 'large')
      assert.match(validationMessage(root), /package traversal.*500.*unverified/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

for (const [label, source, expected] of [
  [
    'script computed assignment',
    "const node=document.createElement('script'); node[property]=value;",
    /dynamic executable script/,
  ],
  [
    'script dynamic attribute',
    "const node=document.createElement('script'); node.setAttribute(property,value);",
    /dynamic executable script/,
  ],
  [
    'link computed assignment',
    "const node=document.createElement('link'); node[property]=value;",
    /dynamic stylesheet/,
  ],
  [
    'link dynamic attribute',
    "const node=document.createElement('link'); node.setAttribute(property,value);",
    /dynamic stylesheet/,
  ],
]) {
  test(`closure review: ${label} cannot hide an unknown resource write`, () => {
    const root = createRoot(),
      filename = path.join(root, 'apps/www/src/components/ComputedResource.ts');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    writeValidMatrices(root);
    assert.match(validationMessage(root), expected);
  });
}

test('package glob enumeration stops at a small read budget before materializing the tree', () => {
  const root = createRoot();
  const packageRoot = path.join(root, 'small-package');
  fs.mkdirSync(path.join(packageRoot, 'features/deep'), { recursive: true });
  for (let index = 0; index < 8; index++)
    fs.writeFileSync(path.join(packageRoot, `features/${index}.js`), 'export {};');
  fs.writeFileSync(path.join(packageRoot, 'features/deep/nested.js'), 'export {};');
  const budget = { entries: 0 };
  assert.throws(
    () =>
      boundedPackageGlobTargets(packageRoot, path.join(packageRoot, 'features/**/*.js'), budget, {
        entries: 3,
        depth: 64,
        pathBytes: 1024,
      }),
    /entry-enumeration bound.*unverified/
  );
  assert.equal(budget.entries, 4);
  assert.equal(
    boundedPackageGlobTargets(packageRoot, path.join(packageRoot, 'features/**/*.js')).length,
    9
  );
  assert.throws(
    () =>
      boundedPackageGlobTargets(
        packageRoot,
        path.join(packageRoot, 'features/**/*.js'),
        { entries: 0 },
        { entries: 100, depth: 1, pathBytes: 1024 }
      ),
    /directory-depth bound.*unverified/
  );
});

test('package glob rejects an external symlink and carries one budget across scans', () => {
  const root = createRoot(),
    packageRoot = path.join(root, 'glob-package'),
    outside = path.join(root, 'outside');
  fs.mkdirSync(packageRoot);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(packageRoot, 'entry.js'), 'export {};');
  const budget = { entries: 0 };
  const limits = { entries: 1, depth: 64, pathBytes: 1024 };
  assert.equal(
    boundedPackageGlobTargets(packageRoot, path.join(packageRoot, '*.js'), budget, limits).length,
    1
  );
  assert.throws(
    () => boundedPackageGlobTargets(packageRoot, path.join(packageRoot, '*.js'), budget, limits),
    /entry-enumeration bound/
  );
  fs.writeFileSync(path.join(outside, 'escaped.js'), 'export {};');
  fs.symlinkSync(outside, path.join(packageRoot, 'escape'));
  assert.throws(
    () => boundedPackageGlobTargets(packageRoot, path.join(packageRoot, '**/*.js')),
    /outside its package.*unverified/
  );
});

test('closure review: Vite-root symlinks outside the repository never become verified', () => {
  const root = createRoot(),
    outside = createRoot();
  const helper = path.join(outside, 'helper.test.ts');
  fs.writeFileSync(helper, 'export const label="outside";');
  const source = path.join(root, 'apps/www/src/components/RootLink.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.symlinkSync(helper, path.join(root, 'apps/www/src/helper.test.ts'));
  fs.writeFileSync(source, "import '/src/helper.test.ts';");
  writeValidMatrices(root);
  assert.throws(
    () => validateCoverageMatrices({ rootDir: root }),
    /outside the repository|symlink|outside.*root/
  );
});

test('closure review: both Vite-root and public candidates stay in the conservative closure', () => {
  const root = createRoot(),
    entry = path.join(root, 'apps/agent-harness/index.html');
  fs.mkdirSync(path.join(root, 'apps/agent-harness/public'), { recursive: true });
  fs.writeFileSync(entry, '<script type="module" src="/helper.test.ts"></script>');
  fs.writeFileSync(path.join(root, 'apps/agent-harness/helper.test.ts'), 'export const root=true;');
  fs.writeFileSync(
    path.join(root, 'apps/agent-harness/public/helper.test.ts'),
    "document.querySelector('button').focus();"
  );
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/public\/helper.test.ts`.*forbidden interaction/
  );
});

test('package glob supports scoped literal roots and nested brace patterns', () => {
  const root = createRoot(),
    packageRoot = path.join(root, '@scope/library');
  fs.mkdirSync(path.join(packageRoot, 'features/deep'), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'features/deep/a.js'), 'export {};');
  fs.writeFileSync(path.join(packageRoot, 'features/deep/b.ts'), 'export {};');
  fs.writeFileSync(path.join(packageRoot, 'features/deep/c.json'), '{}');
  assert.equal(
    boundedPackageGlobTargets(packageRoot, path.join(packageRoot, 'features/**/*.{js,ts}')).length,
    2
  );
});

test('fresh review: changed workspace package sources invalidate promotion evidence', () => {
  const root = createRoot(),
    implementationPath = 'apps/www/src/components/override/Search.astro';
  const registry = 'apps/www/src/components/PrototypePreviewer/prototype-modules.ts';
  const packageFile = 'packages/prototypes/base/src/index.ts';
  for (const file of [implementationPath, registry, packageFile])
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    "---\nimport { label } from '../PrototypePreviewer/prototype-modules';\n---\n<main>{label}</main>"
  );
  writeReviewedPromotionConfig(root);
  fs.writeFileSync(path.join(root, registry), "export { label } from '@proto.ui/prototypes-base';");
  fs.writeFileSync(
    path.join(root, 'packages/prototypes/base/package.json'),
    JSON.stringify({
      name: '@proto.ui/prototypes-base',
      exports: { '.': { import: './dist/index.js' } },
    })
  );
  fs.writeFileSync(path.join(root, packageFile), "export const label='captured';");
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.doesNotThrow(() =>
    validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
  );
  fs.writeFileSync(path.join(root, packageFile), "export const label='changed';");
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted dependency `packages\/prototypes\/base\/src\/index.ts` differs/
  );
});

test('fresh review: class-local helpers executed by render own their Agent actions', () => {
  const root = createRoot(),
    file = 'apps/agent-harness/src/run/ClassHelper.tsx';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(
    path.join(root, file),
    "import React from 'react'; export class Surface extends React.Component { run() { this.props.actions.send(); } render() { this.run(); return <section/>; } }"
  );
  writeValidMatrices(root, {}, { Path: `\`${file}\`` });
  assert.match(validationMessage(root), /Harness source .*ClassHelper.*forbidden interaction/);
});

test('fresh review: Harness geometry acquisition on proven DOM refs is classified', () => {
  const root = createRoot(),
    file = 'apps/agent-harness/src/run/Geometry.tsx';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(
    path.join(root, file),
    "import {useRef,useLayoutEffect,useState} from 'react'; export function Surface(){ const panelRef=useRef(null); const [box,setBox]=useState(null); useLayoutEffect(()=>{setBox(panelRef.current.getBoundingClientRect());},[]); return <div ref={panelRef}/>; }"
  );
  writeValidMatrices(root, {}, { Path: `\`${file}\`` });
  assert.match(validationMessage(root), /Harness source .*Geometry.*forbidden interaction/);
});

test('fresh review: browser worklet module URLs are governed entry points', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run']) {
    const root = createRoot(),
      file = path.join(prefix, 'Worklet.ts');
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      "CSS.paintWorklet.addModule('https://cdn.example/paint.js');"
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), /external.*paint.js/i);
  }
});

test('fresh review: class helper traversal is literal, cycle-safe and bounded', () => {
  const cases = [
    ["run=()=>{this.props.actions.send()}; render(){this['run']();return <section/>;}", true],
    [
      'run(){this.next()} next(){this.run();this.props.actions.send()} render(){this.run();return <section/>;}',
      true,
    ],
    ['run(){this.next()} next(){this.run()} render(){this.run();return <section/>;}', false],
    ['run(){this.props.actions.send()} render(){return <section/>;}', false],
    ['run(){return 1} componentDidMount(){this.run()} render(){return <section/>;}', false],
    [
      Array.from(
        { length: 501 },
        (_, i) => `run${i}(){${i === 500 ? 'return 1;' : `this.run${i + 1}();`}}`
      ).join('') + 'render(){this.run0();return <section/>;}',
      true,
    ],
  ];
  for (const [body, reject] of cases) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/ClassBound.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      `import React from 'react'; export class Surface extends React.Component { ${body} }`
    );
    writeValidMatrices(root, {}, { Path: `\`${file}\`` });
    if (reject)
      assert.match(validationMessage(root), /Harness source .*ClassBound.*forbidden interaction/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('fresh review: geometry is Harness-only and requires DOM provenance', () => {
  for (const [file, source, reject] of [
    ['apps/agent-harness/src/run/Rect.ts', "document.querySelector('div').getClientRects();", true],
    [
      'apps/agent-harness/src/run/Business.ts',
      'const model={getBoundingClientRect(){return {width:1}}}; model.getBoundingClientRect();',
      false,
    ],
    [
      'apps/agent-harness/src/run/BusinessRef.ts',
      'const panelRef={current:{getBoundingClientRect(){return {width:1}}}}; const panel=panelRef.current; panel.getBoundingClientRect();',
      false,
    ],
    [
      'apps/www/src/components/Rect.ts',
      "document.querySelector('div').getBoundingClientRect();",
      false,
    ],
  ]) {
    const root = createRoot();
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    if (reject)
      assert.match(validationMessage(root), /Harness source .*Rect.*forbidden interaction/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('fresh review: worklet acquisition covers browser aliases and rejects dynamic entries', () => {
  for (const source of [
    "globalThis.CSS.paintWorklet.addModule('https://cdn.example/paint.js');",
    'const paint=CSS.paintWorklet; paint.addModule(url);',
    "const context=new AudioContext(); context.audioWorklet.addModule('https://cdn.example/audio.js');",
    "const context=new window.OfflineAudioContext(1,100,44100); const worklet=context.audioWorklet; worklet.addModule('./local.js');",
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/components/WorkletEntry.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /external executable script|unresolved Worker\/SharedWorker entry/
    );
  }
  for (const source of [
    "const model={paintWorklet:{addModule(){}}}; model.paintWorklet.addModule('https://cdn.example/data');",
    "function business(CSS){CSS.paintWorklet.addModule('https://cdn.example/data');}",
    "function business(AudioContext){const context=new AudioContext();context.audioWorklet.addModule('https://cdn.example/data');}",
    "const business={addModule(){}};business.addModule('https://cdn.example/data');",
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/components/BusinessWorklet.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('fresh review: promotion binds workspace manifests and rejects unbound external packages', () => {
  for (const mode of ['manifest', 'external']) {
    const root = createRoot(),
      file = 'apps/www/src/components/override/Search.astro',
      registry = 'apps/www/src/components/PrototypePreviewer/prototype-modules.ts';
    for (const filename of [file, registry, 'packages/prototypes/base/src/index.ts'])
      fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      "---\nimport {label} from '../PrototypePreviewer/prototype-modules';\n---\n<main>{label}</main>"
    );
    writeReviewedPromotionConfig(root);
    fs.writeFileSync(path.join(root, registry), "export {label} from '@proto.ui/prototypes-base';");
    fs.writeFileSync(
      path.join(root, 'packages/prototypes/base/package.json'),
      JSON.stringify({
        name: '@proto.ui/prototypes-base',
        exports: { '.': { import: './dist/index.js' } },
      })
    );
    fs.writeFileSync(
      path.join(root, 'packages/prototypes/base/src/index.ts'),
      "export const label='captured';"
    );
    const websiteBindings = [[file, ['www.shell.search']]];
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    if (mode === 'manifest') {
      fs.writeFileSync(
        path.join(root, 'packages/prototypes/base/package.json'),
        JSON.stringify({
          name: '@proto.ui/prototypes-base',
          exports: { '.': { import: './dist/index.js' } },
          sideEffects: false,
        })
      );
      assert.match(
        validationMessage(root, promotionOptions(revision)),
        /promoted dependency `packages\/prototypes\/base\/package.json` differs/
      );
    } else {
      fs.writeFileSync(
        path.join(root, 'packages/prototypes/base/src/index.ts'),
        "export {label} from 'unbound-package';"
      );
      assert.throws(
        () => validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) }),
        /promotion package closure.*unbound-package.*unverified/
      );
    }
  }
});

test('fresh review: promotion follows transitive wildcard workspace exports using the Website resolver convention', () => {
  const root = createRoot(),
    file = 'apps/www/src/components/override/Search.astro',
    registry = 'apps/www/src/components/PrototypePreviewer/prototype-modules.ts';
  const leaf = 'packages/core/src/label.ts';
  for (const filename of [file, registry, leaf, 'packages/prototypes/base/src/index.ts'])
    fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
  fs.writeFileSync(
    path.join(root, file),
    "---\nimport {label} from '../PrototypePreviewer/prototype-modules';\n---\n<main>{label}</main>"
  );
  writeReviewedPromotionConfig(root);
  fs.writeFileSync(path.join(root, registry), "export {label} from '@proto.ui/prototypes-base';");
  fs.writeFileSync(
    path.join(root, 'packages/prototypes/base/package.json'),
    JSON.stringify({
      name: '@proto.ui/prototypes-base',
      exports: { '.': { import: './dist/index.js' } },
    })
  );
  fs.writeFileSync(
    path.join(root, 'packages/prototypes/base/src/index.ts'),
    "export {label} from '@proto.ui/core/label';"
  );
  fs.writeFileSync(
    path.join(root, 'packages/core/package.json'),
    JSON.stringify({ name: '@proto.ui/core', exports: { './*': { import: './dist/*.js' } } })
  );
  fs.writeFileSync(path.join(root, leaf), "export const label='captured';");
  const configuration = fs.readFileSync(
    new URL('../../../apps/www/astro.config.mjs', import.meta.url),
    'utf8'
  );
  const resolver = configuration.slice(
    configuration.indexOf('function resolveProtoUiSource('),
    configuration.indexOf('/** @type', configuration.indexOf('function resolveProtoUiSource('))
  );
  const resolve = runInNewContext(`${resolver}\nresolveProtoUiSource;`, {
    fs,
    path,
    repositoryRoot: root,
    PROTO_UI_PREFIX: '@proto.ui/',
  });
  assert.equal(
    resolve('@proto.ui/prototypes-base'),
    path.join(root, 'packages/prototypes/base/src/index.ts')
  );
  assert.equal(resolve('@proto.ui/core/label'), path.join(root, leaf));
  const websiteBindings = [[file, ['www.shell.search']]];
  writeValidMatrices(root, {}, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.doesNotThrow(() =>
    validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
  );
  fs.writeFileSync(path.join(root, leaf), "export const label='changed';");
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promoted dependency `packages\/core\/src\/label.ts` differs/
  );
});

test('fresh review: package source resolver parity covers condition order, directory mapping and wildcard precedence', () => {
  const root = createRoot();
  const config = fs.readFileSync(
    new URL('../../../apps/www/astro.config.mjs', import.meta.url),
    'utf8'
  );
  fs.mkdirSync(path.join(root, 'apps/www'), { recursive: true });
  writeReviewedPromotionConfig(root, config);
  const cases = [
    [
      '@proto.ui/prototypes-example',
      'prototypes/example',
      {
        '.': {
          import: './dist/import.js',
          default: './dist/default.js',
          types: './dist/types.d.ts',
        },
      },
      'import.ts',
    ],
    [
      '@proto.ui/adapter-example',
      'adapters/example',
      { '.': { default: './dist/default.js', types: './dist/types.d.ts' } },
      'default.ts',
    ],
    [
      '@proto.ui/module-example',
      'modules/example',
      { '.': { types: './dist/types.d.ts' } },
      'types.ts',
    ],
    [
      '@proto.ui/example/exact',
      'example',
      { './*': { import: './dist/*.js' }, './exact': { import: './dist/other.js' } },
      'exact.ts',
    ],
    [
      '@proto.ui/other/exact',
      'other',
      { './exact': { import: './dist/other.js' }, './*': { import: './dist/*.js' } },
      'other.ts',
    ],
  ];
  for (const [specifier, directory, exports, target] of cases) {
    const packageRoot = path.join(root, 'packages', directory);
    fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ exports }));
    for (const file of new Set([target, 'other.ts', 'import.ts', 'default.ts', 'types.ts']))
      fs.writeFileSync(path.join(packageRoot, 'src', file), 'export const value=1;');
  }
  commitFixtureRoot(root);
  const resolver = config.slice(
    config.indexOf('function resolveProtoUiSource('),
    config.indexOf('/** @type', config.indexOf('function resolveProtoUiSource('))
  );
  const resolve = runInNewContext(`${resolver}\nresolveProtoUiSource;`, {
    fs,
    path,
    repositoryRoot: root,
    PROTO_UI_PREFIX: '@proto.ui/',
  });
  for (const [specifier, directory, _exports, target] of cases) {
    const expected = path.join(root, 'packages', directory, 'src', target);
    assert.equal(resolve(specifier), expected);
    const metadata = new Set();
    assert.deepEqual(promotionBarePackageTargets(root, specifier, metadata), [expected]);
    assert.ok(metadata.has(path.join(root, 'packages', directory, 'package.json')));
  }
  fs.appendFileSync(
    path.join(root, 'apps/www/astro.config.mjs'),
    '\n// unreviewed resolver shape\n'
  );
  assert.throws(
    () => promotionBarePackageTargets(root, cases[0][0], new Set()),
    /resolver configuration is unrecognized.*unverified/
  );
  const changedResolver = config.replace(
    ".replace('./dist/', './src/')",
    ".replace('./dist/', './different/')"
  );
  assert.notEqual(changedResolver, config);
  fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), changedResolver);
  assert.throws(
    () => promotionBarePackageTargets(root, cases[0][0], new Set()),
    /resolver configuration is unrecognized.*unverified/
  );
  const outside = createRoot();
  const externalConfig = path.join(outside, 'astro.config.mjs');
  fs.writeFileSync(externalConfig, config);
  fs.unlinkSync(path.join(root, 'apps/www/astro.config.mjs'));
  fs.symlinkSync(externalConfig, path.join(root, 'apps/www/astro.config.mjs'));
  assert.throws(
    () => promotionBarePackageTargets(root, cases[0][0], new Set()),
    /resolver configuration is unrecognized.*unverified/
  );
});

test('fresh review: tracked package targets use literal Git pathspecs', () => {
  const root = createRoot(),
    directory = path.join(root, 'packages/prototypes/example');
  fs.mkdirSync(path.join(root, 'apps/www'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  writeReviewedPromotionConfig(root);
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ exports: { '.': './dist/item[1].js' } })
  );
  fs.writeFileSync(path.join(directory, 'src/item1.ts'), 'export const captured=true;');
  commitFixtureRoot(root);
  fs.writeFileSync(path.join(directory, 'src/item[1].ts'), 'export const untracked=true;');
  assert.throws(
    () => promotionBarePackageTargets(root, '@proto.ui/prototypes-example', new Set()),
    /package closure.*unverified/
  );
});

test('latest entry review: qualified browser Worker constructors reach consumer walls', () => {
  for (const prefix of ['apps/www/src/components', 'apps/agent-harness/src/run'])
    for (const ctor of ['window.Worker', 'self.Worker', 'globalThis.SharedWorker']) {
      const root = createRoot(),
        file = path.join(prefix, 'QualifiedWorker.ts');
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), `new ${ctor}('/raw-runtime.js');`);
      writeValidMatrices(root);
      assert.match(validationMessage(root), /external.*raw-runtime.js/);
    }
});

test('latest entry review: wildcard bare-package self references retain the consumer wall', () => {
  for (const name of ['self-widget', '@example/self-widget']) {
    const root = createRoot(),
      packageRoot = path.join(root, 'node_modules', name),
      source = path.join(root, 'apps/www/src/components/SelfWidget.ts');
    fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name, exports: { '.': './src/index.js', './*': './src/*.js' } })
    );
    fs.writeFileSync(path.join(packageRoot, 'src/index.js'), `import '${name}/feature';`);
    fs.writeFileSync(path.join(packageRoot, 'src/feature.js'), "import '@proto.ui/runtime';");
    fs.writeFileSync(source, `import '${name}';`);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /raw Proto UI import.*self-widget/);
  }
});

test('latest entry review: browser Worker constructors preserve global-shadow controls', () => {
  for (const source of [
    "function business(window){new window.Worker('/business');}",
    "const globalThis={SharedWorker:class{}};new globalThis.SharedWorker('/business');",
    "class Worker{};new Worker('/business');",
    "function business(){new self.Worker('/business');var self={};}",
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/components/BusinessWorker.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
  for (const source of [
    'new window.Worker(url);',
    'new globalThis.SharedWorker(new URL(workerPath,import.meta.url));',
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/components/DynamicWorker.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /unresolved Worker\/SharedWorker entry/);
  }
});

test('latest entry review: self-reference conditions, imports aliases and traversal budgets remain explicit', () => {
  for (const mode of ['conditions', 'imports-alias', 'exact', 'cycle', 'large', 'missing']) {
    const root = createRoot(),
      packageRoot = path.join(root, 'node_modules/self-controls'),
      source = path.join(root, 'apps/www/src/components/SelfControls.ts');
    fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    const exports = { '.': './src/index.js', './*': './src/*.js' };
    if (mode === 'conditions') exports['./*'] = { require: './src/*.cjs', import: './src/*.mjs' };
    if (mode === 'exact') exports['./feature'] = './src/safe.js';
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: 'self-controls',
        exports,
        imports: { '#self': 'self-controls/feature' },
      })
    );
    fs.writeFileSync(
      path.join(packageRoot, 'src/index.js'),
      mode === 'imports-alias' ? "import '#self';" : "import 'self-controls/feature';"
    );
    fs.writeFileSync(path.join(packageRoot, 'src/safe.js'), 'export const safe=true;');
    if (mode === 'conditions') {
      fs.writeFileSync(path.join(packageRoot, 'src/feature.cjs'), 'module.exports={};');
      fs.writeFileSync(path.join(packageRoot, 'src/feature.mjs'), "import '@proto.ui/runtime';");
    } else if (mode === 'cycle') {
      fs.writeFileSync(path.join(packageRoot, 'src/feature.js'), "import 'self-controls/other';");
      fs.writeFileSync(path.join(packageRoot, 'src/other.js'), "import 'self-controls/feature';");
    } else if (mode === 'large') {
      fs.writeFileSync(path.join(packageRoot, 'src/feature.js'), "import 'self-controls/part0';");
      for (let i = 0; i < 501; i++)
        fs.writeFileSync(
          path.join(packageRoot, `src/part${i}.js`),
          i < 500 ? `import 'self-controls/part${i + 1}';` : 'export const safe=true;'
        );
    } else if (mode !== 'missing')
      fs.writeFileSync(path.join(packageRoot, 'src/feature.js'), "import '@proto.ui/runtime';");
    fs.writeFileSync(source, "import 'self-controls';");
    writeValidMatrices(root);
    if (['conditions', 'imports-alias'].includes(mode))
      assert.match(validationMessage(root), /raw Proto UI import.*self-controls/);
    else if (mode === 'large')
      assert.match(validationMessage(root), /500-module bound.*unverified/);
    else if (mode === 'missing')
      assert.match(validationMessage(root), /package entry target.*unresolved.*unverified/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('current Harness review: external document bases cannot remap relative resources', () => {
  for (const file of ['apps/agent-harness/index.html', 'apps/agent-harness/public/route.html']) {
    const root = createRoot();
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      '<base href="https://cdn.example/"><script src="./runtime.js"></script>'
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), /external document base.*cdn.example/);
  }
});

test('current Harness review: repository-local shared helpers keep the Harness ownership gate', () => {
  const root = createRoot(),
    entry = 'apps/agent-harness/src/Entry.ts',
    helper = 'apps/shared/raw-focus.ts';
  for (const file of [entry, helper])
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, entry), "import '../../shared/raw-focus';");
  fs.writeFileSync(path.join(root, helper), "document.querySelector('button').focus();");
  writeValidMatrices(root);
  assert.match(
    validationMessage(root),
    /Harness source `apps\/shared\/raw-focus.ts`.*forbidden interaction/
  );
});

test('current Harness review: document-base controls cover external and dynamic values but retain local bases', () => {
  for (const [base, reject] of [
    ['https://cdn.example/', true],
    ['//cdn.example/', true],
    ['{{ resourceBase }}', true],
    ['/local/', false],
  ]) {
    const root = createRoot(),
      file = path.join(root, 'apps/agent-harness/index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<base href="${base}"><script src="./runtime.js"></script>`);
    fs.writeFileSync(path.join(root, 'apps/agent-harness/runtime.js'), 'export const safe=true;');
    writeValidMatrices(root);
    if (reject) assert.match(validationMessage(root), /document base href/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('current Harness review: reachable shared helpers retain geometry and ARIA checks without business false positives', () => {
  for (const [source, reject] of [
    ["document.querySelector('button').ariaExpanded='true';", true],
    ["document.querySelector('button').getBoundingClientRect();", true],
    [
      'const data={focus(){},getBoundingClientRect(){return {width:1}}};data.focus();data.getBoundingClientRect();',
      false,
    ],
  ]) {
    const root = createRoot(),
      entry = 'apps/agent-harness/src/Entry.ts',
      helper = 'apps/shared/helper.ts';
    for (const file of [entry, helper])
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, entry), "import '../../shared/helper';");
    fs.writeFileSync(path.join(root, helper), source);
    writeValidMatrices(root);
    if (reject)
      assert.match(
        validationMessage(root),
        /Harness source `apps\/shared\/helper.ts`.*forbidden interaction/
      );
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('current Harness review: cross-repository imports and symlinks are rejected before source bytes are read', () => {
  for (const symlink of [false, true]) {
    const root = createRoot(),
      outside = createRoot(),
      foreign = path.join(outside, 'foreign.ts'),
      entry = path.join(root, 'apps/agent-harness/src/Entry.ts');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(foreign, 'export const privateFixture=true;');
    const localLink = path.join(root, 'apps/agent-harness/src/foreign[1].ts');
    if (symlink) fs.symlinkSync(foreign, localLink);
    const specifier = symlink
      ? './foreign[1].ts'
      : path.relative(path.dirname(entry), foreign).replaceAll('\\', '/');
    fs.writeFileSync(entry, `import ${JSON.stringify(specifier)};`);
    writeValidMatrices(root);
    const original = fs.readFileSync;
    let readForeign = false;
    fs.readFileSync = function (file, ...args) {
      if (typeof file === 'string' && (file === foreign || file === localLink)) {
        readForeign = true;
        throw new Error('foreign bytes must not be read');
      }
      return original.call(this, file, ...args);
    };
    try {
      assert.throws(() => validateCoverageMatrices({ rootDir: root }), /outside the repository/);
      assert.equal(readForeign, false);
    } finally {
      fs.readFileSync = original;
    }
  }
});

test('fresh Harness review: rejects native executable preview elements before admission', () => {
  for (const markup of [
    '<iframe src="https://preview.example/app" />',
    '<iframe srcDoc="<script>run()</script>" />',
    '<object data="https://preview.example/app" />',
    '<embed src="https://preview.example/app" />',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/future/PreviewSurface.tsx';
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), `export const Preview = () => ${markup};`);
    writeValidMatrices(root, {}, { ID: 'harness.future.preview-chrome', Path: relativePath });
    assert.match(validationMessage(root), /forbidden interaction|unreviewed.*preview/);
  }
});

test('fresh Harness review: rejects root and public HTML import maps', () => {
  for (const entry of ['index.html', 'public/index.html']) {
    const root = createRoot();
    const absolute = path.join(root, 'apps/agent-harness', entry);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(
      absolute,
      '<script type="importmap">{"imports":{"react":"https://cdn.example/runtime.js"}}</script><script type="module" src="./runtime.js"></script>'
    );
    fs.writeFileSync(path.join(path.dirname(absolute), 'runtime.js'), "import 'react';");
    writeValidMatrices(root);
    assert.match(validationMessage(root), /production import map.*Harness/);
  }
});

test('fresh Harness review: preview boundaries cover native creation and static markup controls', () => {
  const rejected = [
    "document.createElement('iframe');",
    "window.document.createElement('object');",
    "const doc=globalThis.document;const kind='embed';doc['createElement'](kind);",
    "document.createElementNS('http://www.w3.org/1999/xhtml','iframe');",
    'document.createElement(dynamicTag);',
    'export const Preview=()=> <webview src="https://preview.example" />;',
  ];
  const accepted = [
    "document.createElement('div');",
    "document.createElementNS('http://www.w3.org/2000/svg','circle');",
    "function helper(document){document.createElement('iframe');}",
    "function helper(){document.createElement('iframe');var document={};}",
    "const service={createElement:()=>({})};service.createElement('iframe');",
    'const text="<iframe src=external>";export const Preview=()=> <section>{text}</section>;',
    'const Iframe=()=> <section/>;export const Preview=()=> <Iframe />;',
  ];
  for (const [source, rejects] of [
    ...rejected.map((x) => [x, true]),
    ...accepted.map((x) => [x, false]),
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/future/PreviewSurface.tsx';
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), source);
    writeValidMatrices(root, {}, { ID: 'harness.future.preview-chrome', Path: relativePath });
    if (rejects) assert.match(validationMessage(root), /unreviewed executable preview/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
  for (const markup of [
    '<IFRAME src="./preview.html"></IFRAME>',
    '<object data="./preview.html"></object>',
    '<embed src="./preview.html">',
  ]) {
    const root = createRoot();
    fs.mkdirSync(path.join(root, 'apps/agent-harness/public'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/agent-harness/public/index.html'), markup);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /unreviewed executable preview/);
  }
});

test('fresh Harness review: ordinary data scripts and markup examples remain inert', () => {
  const root = createRoot();
  fs.mkdirSync(path.join(root, 'apps/agent-harness/public'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'apps/agent-harness/public/index.html'),
    '<!-- <iframe src="https://preview.example"></iframe><script type="importmap">{}</script> --><script type="application/json">{"example":"<iframe>"}</script><p>Static preview placeholder</p>'
  );
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

test('latest state review: native visibility and enablement writes enter the Harness gate', () => {
  for (const assignment of [
    'panel.hidden = !open;',
    'panel.open = true;',
    'panel.disabled = true;',
    'panel.className = "closed";',
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/NativeState.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      `const panel=document.querySelector('section'); export const Surface=()=> <ProtoPanel onOpenChange={()=>{${assignment}}}/>;`
    );
    writeValidMatrices(root, {}, { Path: file });
    assert.match(validationMessage(root), /forbidden interaction or DOM state machine/);
  }
});

test('latest state review: direct Agent action callbacks in eager hooks are rejected', () => {
  for (const call of [
    'useMemo(actions.send, []);',
    'useState(actions.send);',
    'useReducer(actions.send, 0);',
    'useReducer((state)=>state, 0, actions.send);',
    'useSyncExternalStore(subscribe, actions.send);',
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/DirectCallback.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      `import {useMemo,useState,useReducer,useSyncExternalStore} from 'react'; import * as actions from './agent-actions'; export const Surface=()=>{${call}return <section/>;};`
    );
    writeValidMatrices(root, {}, { Path: file });
    assert.match(validationMessage(root), /forbidden interaction or DOM state machine/);
  }
});

test('latest state review: changed config-emitted import maps fail the consumer wall', () => {
  const root = createRoot(),
    file = path.join(root, 'apps/www/astro.config.mjs');
  const reviewed = fs.readFileSync(
    new URL('../../../apps/www/astro.config.mjs', import.meta.url),
    'utf8'
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, reviewed);
  writeValidMatrices(root);
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  fs.writeFileSync(
    file,
    reviewed.replace(
      '"react": "https://esm.sh/react@18"',
      '"react": "https://cdn.example/unreviewed.js"'
    )
  );
  assert.match(validationMessage(root), /import map.*(?:reviewed|unverified)/);
});

test('latest state controls: native properties and equivalent attribute forms remain bounded by DOM provenance', () => {
  for (const action of [
    ...[
      'hidden',
      'inert',
      'open',
      'disabled',
      'selected',
      'indeterminate',
      'tabIndex',
      'className',
    ].map((name) => `panel.${name}=next;`),
    'Object.assign(panel,{hidden:true,disabled:true});',
    "panel.setAttribute('hidden','');",
    "panel.removeAttribute('disabled');",
    "panel.toggleAttribute('class');",
  ]) {
    for (const native of [true, false]) {
      const root = createRoot(),
        file = 'apps/agent-harness/src/run/StateControl.tsx';
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(
        path.join(root, file),
        `const panel=${native ? "document.querySelector('button')" : '{setAttribute(){},removeAttribute(){},toggleAttribute(){}}'}; export const Surface=()=> <ProtoPanel onOpenChange={()=>{${action}}}/>;`
      );
      writeValidMatrices(root, {}, { Path: file });
      if (native) assert.match(validationMessage(root), /forbidden interaction/);
      else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), action);
    }
  }
});

test('latest state controls: eager action aliases are rejected but deferred callbacks and business functions remain valid', () => {
  for (const [setup, call, rejects] of [
    [
      "import {useMemo as memo} from 'react';import * as actions from './agent-actions';",
      "memo(actions['send'],[]);",
      true,
    ],
    [
      "import * as React from 'react';import * as actions from './agent-actions';",
      'React.useState(actions.send);',
      true,
    ],
    [
      "import {useCallback} from 'react';import * as actions from './agent-actions';",
      'useCallback(actions.send,[]);',
      false,
    ],
    [
      "import {useMemo} from 'react';const business={send:()=>1};",
      'useMemo(business.send,[]);',
      false,
    ],
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/CallbackControl.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      `${setup} export const Surface=()=>{${call}return <section/>;};`
    );
    writeValidMatrices(root, {}, { Path: file });
    if (rejects) assert.match(validationMessage(root), /forbidden interaction/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('latest state controls: config import maps reject changed/missing/extra mappings and opaque shapes', () => {
  const imports = {
    react: 'https://esm.sh/react@18',
    'react-dom/client': 'https://esm.sh/react-dom@18/client',
    vue: 'https://esm.sh/vue@3',
  };
  const mapEntry = (value) =>
    `{tag:'script',attrs:{type:'importmap'},content:${JSON.stringify(JSON.stringify(value))}}`;
  const cases = [
    [mapEntry({ imports }), false],
    [mapEntry({ imports: { ...imports, react: 'https://cdn.example/changed.js' } }), true],
    [mapEntry({ imports: { react: imports.react } }), true],
    [mapEntry({ imports: { ...imports, extra: 'https://cdn.example/extra.js' } }), true],
    [mapEntry({ imports, scopes: {} }), true],
    ["{tag:'script',attrs:{type:'importmap'},content:JSON.stringify({imports:{}})}", true],
    ["{tag:'script',attrs:{type:kind},content:'{}'}", true],
    ['...dynamicHead', true],
    [`${mapEntry({ imports })},${mapEntry({ imports })}`, true],
    [
      "{tag:'script',attrs:{type:'application/json'},content:'{}'},{tag:'meta',attrs:{name:'description',content:'ordinary metadata'}}",
      false,
    ],
  ];
  for (const [entry, rejects] of cases) {
    const root = createRoot();
    fs.writeFileSync(
      path.join(root, 'apps/www/astro.config.mjs'),
      `export default {head:[${entry}]};`
    );
    writeValidMatrices(root);
    if (rejects) assert.match(validationMessage(root), /import map.*unverified/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
  for (const config of [
    'export default {head:buildHead()};',
    "const key='head';export default {[key]:[]};",
  ]) {
    const root = createRoot();
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /import map.*unverified/);
  }
});

test('review entry boundaries: shorthand Astro head does not bypass map validation', () => {
  const root = createRoot();
  fs.writeFileSync(
    path.join(root, 'apps/www/astro.config.mjs'),
    `const head=[{tag:'script',attrs:{type:'importmap'},content:'{"imports":{"react":"https://cdn.example/unreviewed.js"}}'}];export default {head};`
  );
  writeValidMatrices(root);
  assert.match(validationMessage(root), /import map.*unverified/);
});

for (const kind of ['website', 'harness'])
  test(`review entry boundaries: ${kind} JSX script sources are execution edges`, () => {
    const root = createRoot();
    const relativePath =
      kind === 'website'
        ? 'apps/www/src/components/JsxScript.tsx'
        : 'apps/agent-harness/src/run/JsxScript.tsx';
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, relativePath),
      'export const Script = () => <script async src="https://cdn.example/runtime.js" />;'
    );
    writeValidMatrices(root, {}, kind === 'harness' ? { Path: relativePath } : {}, {
      websiteBindings: kind === 'website' ? [[relativePath, ['www.shell.primary-nav']]] : [],
    });
    assert.match(validationMessage(root), /external executable script.*cdn\.example/);
  });

for (const relativePath of [
  'apps/www/src/content/docs/unreviewed.mdx',
  'apps/www/public/unreviewed.html',
])
  test(`review entry boundaries: Website embeds are reviewed in ${relativePath}`, () => {
    const root = createRoot();
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, relativePath),
      '<iframe src="https://preview.example/app"></iframe>'
    );
    writeValidMatrices(
      root,
      {},
      {},
      { websiteBindings: [[relativePath, ['www.shell.primary-nav']]] }
    );
    assert.match(validationMessage(root), /unreviewed.*(?:embed|preview)/);
  });

test('review entry boundaries: transport listeners are not DOM ownership', () => {
  for (const expression of [
    "new WebSocket('wss://api.example')",
    "new EventSource('/events')",
    "new BroadcastChannel('updates')",
    'new AbortController().signal',
    '{addEventListener(){}}',
  ]) {
    const root = createRoot();
    const relativePath = 'apps/agent-harness/src/services/agent-service.ts';
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, relativePath),
      `const transport=${expression}; transport.addEventListener('message',receive);`
    );
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), expression);
  }
});

test('review entry boundaries: actual DOM listeners retain the ownership gate', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DomListener.ts';
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, relativePath),
    "const button=document.querySelector('button');button.addEventListener('click',receive);"
  );
  writeValidMatrices(root, {}, { Path: relativePath });
  assert.match(validationMessage(root), /forbidden interaction or DOM state machine/);
});

test('review entry controls: JSX scripts preserve inert/custom forms and fail closed on opaque executable sources', () => {
  const cases = [
    ['<script async src={"https://cdn.example/runtime.js"}/>', true],
    ['<script async src={target}/>', true],
    ['<script src="./runtime.js"/>', true],
    ['<script {...props}/>', true],
    ['<script type={kind} src="https://cdn.example/runtime.js"/>', true],
    ['<script type="importmap">{"{}"}</script>', true],
    ['<script dangerouslySetInnerHTML={{__html: source}}/>', true],
    ['<script>{source}</script>', true],
    ['<script type="application/json">{"{}"}</script>', false],
    ['<script type="application/ld+json" src="https://data.example/value.json"/>', false],
    ['<Script async src="https://business.example/value"/>', false],
    ['<section>{"<script src=external>"}</section>', false],
    ['<script/>', false],
  ];
  for (const kind of ['website', 'harness'])
    for (const [markup, rejects] of cases) {
      const root = createRoot();
      const file =
        kind === 'website'
          ? 'apps/www/src/components/ScriptControl.tsx'
          : 'apps/agent-harness/src/run/ScriptControl.tsx';
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), `export const Surface=()=>${markup};`);
      writeValidMatrices(root, {}, kind === 'harness' ? { Path: file } : {}, {
        websiteBindings: kind === 'website' ? [[file, ['www.shell.primary-nav']]] : [],
      });
      if (rejects)
        assert.match(
          validationMessage(root),
          /(?:external|dynamic) executable script/,
          `${kind}: ${markup}`
        );
      else
        assert.doesNotThrow(
          () => validateCoverageMatrices({ rootDir: root }),
          `${kind}: ${markup}`
        );
    }
});

test('review entry controls: Website embed allowance binds exact path and immutable static content', () => {
  const file = 'apps/www/src/pages/en/test/style-isolation.astro';
  const real = fs.readFileSync(
    new URL('../../../apps/www/src/pages/en/test/style-isolation.astro', import.meta.url),
    'utf8'
  );
  const opening = real.slice(real.indexOf('<iframe'), real.indexOf('</iframe>'));
  for (const [target, markup, rejects] of [
    [file, `${opening}</iframe>`, false],
    [
      file,
      `${opening.replace('Unstyled host control</button>', 'Changed baseline</button>')}</iframe>`,
      true,
    ],
    [file, `${opening.replace('srcdoc=', 'src="https://preview.example" srcdoc=')}</iframe>`, true],
    [file, `${opening}</iframe>${opening}</iframe>`, true],
    ['apps/www/src/pages/en/test/copied.astro', `${opening}</iframe>`, true],
  ]) {
    const root = createRoot();
    fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    fs.writeFileSync(path.join(root, target), markup);
    writeValidMatrices(root, {}, {}, { websiteBindings: [[target, ['www.shell.primary-nav']]] });
    if (rejects) assert.match(validationMessage(root), /unreviewed executable embed/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  }
});

test('review entry controls: Website native embeds cover markup and JSX with data/example controls', () => {
  for (const [file, source, rejects] of [
    ['apps/www/src/content/docs/embed.mdx', '<object data="https://preview.example"/>', true],
    ['apps/www/public/embed.html', '<EMBED src="https://preview.example">', true],
    [
      'apps/www/src/components/Embed.tsx',
      'export const Surface=()=> <iframe srcDoc={html}/>;',
      true,
    ],
    [
      'apps/www/src/components/Embed.tsx',
      'export const Surface=()=> <webview src="https://preview.example"/>;',
      true,
    ],
    [
      'apps/www/src/content/docs/embed.mdx',
      '<!-- <iframe src="external"></iframe> -->\n```html\n<iframe src="external"></iframe>\n```\n<script type="application/json">{\'{"example":"<iframe>"}\'}</script>\n<article>Static</article>',
      false,
    ],
    [
      'apps/www/public/embed.html',
      '<!-- <iframe src="external"></iframe> --><script type="application/json">{"example":"<iframe>"}</script>',
      false,
    ],
    ['apps/www/src/content/docs/embed.mdx', '<Iframe data="business"/>', false],
    [
      'apps/www/src/components/Embed.tsx',
      'export const Surface=()=> <Iframe src="business"/>;',
      false,
    ],
  ]) {
    const root = createRoot();
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
    if (rejects) assert.match(validationMessage(root), /unreviewed executable embed/, file);
    else
      assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), `${file}: ${source}`);
  }
});

test('review entry controls: Harness listener classification follows known DOM acquisition and aliases', () => {
  for (const [source, rejects] of [
    ["document.addEventListener('click',receive);", true],
    ["window.addEventListener('keydown',receive);", true],
    [
      "const el=document.querySelector('button');const alias=el;alias['addEventListener']('click',receive);",
      true,
    ],
    ["function register(node:HTMLElement){node.addEventListener('click',receive)}", true],
    [
      "const transport=new WebSocket('wss://api.example');const alias=transport;alias['addEventListener']('message',receive);",
      false,
    ],
    [
      "function register(transport:WebSocket){transport.addEventListener('message',receive)}",
      false,
    ],
    ["const document={addEventListener(){}};document.addEventListener('message',receive);", false],
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/ListenerControl.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root, {}, { Path: file });
    if (rejects) assert.match(validationMessage(root), /forbidden interaction/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
});

test('review entry controls: shorthand head is conservatively unverified without executing bindings', () => {
  for (const source of [
    'const head=[];export default {head};',
    'function configure(head){return {head}};export default configure(dynamicHead);',
    'const head=loadHead();export default {integrations:[starlight({head})]};',
  ]) {
    const root = createRoot();
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), source);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /shorthand head configuration is unverified/);
  }
});

test('review entry controls: Astro self-closing JSON data does not turn later markup into JSX execution', () => {
  const root = createRoot(),
    file = 'apps/www/src/components/JsonGallery.astro';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(
    path.join(root, file),
    '<script is:inline type="application/json" data-index set:html={serializedIndex} /><section>Static content</section><script>import React from "react";</script>'
  );
  writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
  assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
});

for (const kind of ['script', 'stylesheet'])
  test(`review URL normalization: ${kind} attributes follow browser URL parsing`, () => {
    const root = createRoot(),
      file = 'apps/www/src/components/ResourceUrl.astro';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    const url = ' https://cdn.example/runtime.js ';
    assert.equal(new URL(url, 'https://site.example/docs/').origin, 'https://cdn.example');
    fs.writeFileSync(
      path.join(root, file),
      kind === 'script' ? `<script src="${url}"></script>` : `<link rel="stylesheet" href="${url}">`
    );
    writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
    assert.match(validationMessage(root), /external (?:executable script|stylesheet)/);
  });

test('review URL controls: browser C0 and tab/newline preprocessing is shared by script, stylesheet and base attributes', () => {
  const values = [
    ' https://cdn.example/runtime.js ',
    '\u0001\u001fhttps://cdn.example/runtime.js\u0020',
    ' ht\nt\rps:\t//cdn.example/runtime.js ',
    ' //cdn.example/runtime.js ',
    ' \\\\cdn.example/runtime.js ',
  ];
  for (const value of values)
    for (const kind of ['script', 'stylesheet', 'base']) {
      assert.equal(new URL(value, 'https://site.example/docs/').origin, 'https://cdn.example');
      const root = createRoot(),
        file = 'apps/www/src/components/NormalizedUrl.astro';
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      const markup =
        kind === 'script'
          ? `<script src="${value}"></script>`
          : kind === 'stylesheet'
            ? `<link rel="stylesheet" href="${value}">`
            : `<base href="${value}">`;
      fs.writeFileSync(path.join(root, file), markup);
      writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
      assert.match(
        validationMessage(root),
        /external (?:executable script|stylesheet|document base)/,
        JSON.stringify({ kind, value })
      );
    }
});

test('review URL controls: Harness markup uses the same normalized executable URLs', () => {
  for (const markup of [
    '<script src=" ht\ntps://cdn.example/runtime.js "></script>',
    '<link rel="stylesheet" href=" //cdn.example/runtime.css ">',
    '<base href=" \u001fhttps://cdn.example/ ">',
  ]) {
    const root = createRoot();
    fs.mkdirSync(path.join(root, 'apps/agent-harness'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/agent-harness/index.html'), markup);
    writeValidMatrices(root);
    assert.match(
      validationMessage(root),
      /external (?:executable (?:worker )?script|stylesheet|document base)/
    );
  }
});

test('review URL controls: local dependency closure survives trimming and non-ASCII space is not stripped', () => {
  const root = createRoot(),
    file = 'apps/www/src/components/LocalResource.astro';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), '<script src=" ./local-runtime.js "></script>');
  fs.writeFileSync(
    path.join(root, 'apps/www/src/components/local-runtime.js'),
    "import '@proto.ui/runtime';"
  );
  writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
  assert.match(validationMessage(root), /raw Proto UI import.*local-runtime/);
  const value = '\u00a0https://cdn.example/runtime.js';
  assert.equal(new URL(value, 'https://site.example/docs/').origin, 'https://site.example');
  fs.writeFileSync(path.join(root, file), `<script src="${value}"></script>`);
  fs.rmSync(path.join(root, 'apps/www/src/components/local-runtime.js'));
  writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
  assert.doesNotMatch(
    collectCoverageMatrixIssues({ rootDir: root }).join('\n'),
    /external executable script/
  );
});

test('review URL controls: JSX and standard DOM resource writes share normalization', () => {
  for (const source of [
    'export const Surface=()=> <script src={" ht\\ntps://cdn.example/runtime.js "}/>;',
    "const script=document.createElement('script');script.src=' ht\\ntps://cdn.example/runtime.js ';",
    "const link=document.createElement('link');link.rel='stylesheet';link.href=' //cdn.example/runtime.css ';",
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/components/NormalizedWrite.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
    assert.match(validationMessage(root), /external (?:executable script|stylesheet)/);
  }
});

test('review URL controls: existing CSS import URLs share browser normalization', () => {
  for (const content of [
    '@import " https://cdn.example/runtime.css ";',
    '@import url(" //cdn.example/runtime.css ");',
  ]) {
    const root = createRoot(),
      file = 'apps/www/src/styles/normalized.css';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /external stylesheet/);
  }
});

test('runtime compilation admission: recognized global eval and Function entries remain unverified', () => {
  for (const expression of [
    'eval(source);',
    'new Function(source);',
    'Function(source);',
    'window.eval(source);',
    "globalThis['Function'](source);",
    'new self.Function(source);',
    'const compile=globalThis.Function;new compile(source);',
    'const evaluate=window.eval;evaluate(source);',
  ])
    for (const kind of ['website', 'harness']) {
      const root = createRoot(),
        file =
          kind === 'website'
            ? 'apps/www/src/components/CompileEntry.ts'
            : 'apps/agent-harness/src/run/CompileEntry.ts';
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), expression);
      writeValidMatrices(root, {}, kind === 'harness' ? { Path: file } : {}, {
        websiteBindings: kind === 'website' ? [[file, ['www.shell.primary-nav']]] : [],
      });
      assert.match(validationMessage(root), /runtime code compilation.*unverified/, expression);
    }
});

test('runtime compilation admission: business methods and lexically shadowed globals remain data', () => {
  for (const expression of [
    'const business={eval(){},Function(){}};business.eval(source);business.Function(source);',
    'function run(Function){new Function(source)}',
    'function run(){new Function(source);var Function=BusinessConstructor;}',
    'function run(window){window.eval(source);}',
    'function run(){globalThis.Function(source);const globalThis=business;}',
    'const description="eval(source);new Function(source)";',
    'const descriptor=Function.length;',
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/CompilationControl.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), expression);
    writeValidMatrices(root, {}, { Path: file });
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), expression);
  }
});

test('review follow-up: transport event properties are not UI state ownership', () => {
  for (const source of [
    "const socket=new WebSocket('wss://api.example');socket.onmessage=receive;",
    "const events=new EventSource('/events');events.onerror=receive;",
    'function register(worker:Worker){worker.onmessage=receive;}',
    'const business={};business.onclick=receive;',
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/services/agent-service.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
});

for (const prefix of ['apps/www/public', 'apps/agent-harness/public'])
  test(`review follow-up: encoded import-map types remain unverified in ${prefix}`, () => {
    const root = createRoot(),
      file = `${prefix}/import-map.html`;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      '<script type="import&#109;ap">{"imports":{"react":"https://cdn.example/runtime.js"}}</script>'
    );
    writeValidMatrices(
      root,
      {},
      {},
      { websiteBindings: prefix.includes('/www/') ? [[file, ['www.shell.primary-nav']]] : [] }
    );
    assert.match(validationMessage(root), /production import map|unverified.*script type/);
  });

test('frontmatter review evidence: standard Astro imports already enter the source wall', () => {
  for (const newline of ['\n', '\r\n']) {
    const root = createRoot(),
      file = 'apps/www/src/components/Frontmatter.astro';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      ['---', "import '@proto.ui/runtime';", '---', '<main>Static</main>'].join(newline)
    );
    writeValidMatrices(root, {}, {}, { websiteBindings: [[file, ['www.shell.primary-nav']]] });
    assert.match(validationMessage(root), /raw Proto UI import `@proto.ui\/runtime`.*Frontmatter/);
  }
});

test('review follow-up controls: native event-property assignments require Harness DOM provenance', () => {
  for (const [source, rejects] of [
    ["const button=document.querySelector('button');button.onclick=receive;", true],
    ["const button=document.querySelector('button');button['onclick']??=receive;", true],
    ['window.onmessage=receive;', true],
    ['function update(node:HTMLElement){node.onclick=receive;}', true],
    ["const channel=new BroadcastChannel('events');channel.onmessage=receive;", false],
    ["const socket=new WebSocket('wss://api.example');socket.onmessage??=receive;", false],
    ['function update(model){model.onclick=receive;}', false],
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/EventProperty.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root, {}, { Path: file });
    if (rejects) assert.match(validationMessage(root), /forbidden interaction/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
});

test('review follow-up controls: opaque script types fail closed without a src while literal JSON stays inert', () => {
  for (const [attributes, rejects] of [
    ['type="import&#109;ap"', true],
    ['type="import&#x6d;ap"', true],
    ['type="application/&#106;son"', true],
    ['type={kind}', true],
    [':type="kind"', true],
    ['v-bind:type="kind"', true],
    ['type="application/json"', false],
    ['type="application/ld+json"', false],
  ])
    for (const prefix of ['apps/www/public', 'apps/agent-harness/public']) {
      const root = createRoot(),
        file = `${prefix}/types.html`;
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(
        path.join(root, file),
        `<script ${attributes}>{"imports":{"react":"https://cdn.example/runtime.js"}}</script>`
      );
      writeValidMatrices(
        root,
        {},
        {},
        { websiteBindings: prefix.includes('/www/') ? [[file, ['www.shell.primary-nav']]] : [] }
      );
      if (rejects)
        assert.match(validationMessage(root), /production import map|unverified script type/);
      else
        assert.doesNotThrow(
          () => validateCoverageMatrices({ rootDir: root }),
          `${prefix}: ${attributes}`
        );
    }
});

test('review follow-up controls: native JSX encoded script type is unverified and custom Script is not native', () => {
  for (const [markup, rejects] of [
    ['<script type="import&#109;ap">{"{}"}</script>', true],
    ['<script type={kind}>{payload}</script>', true],
    ['<script type={"application/json"}>{"{}"}</script>', false],
    ['<Script type="import&#109;ap">{"{}"}</Script>', false],
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/ScriptType.tsx';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), `export const Surface=()=>${markup};`);
    writeValidMatrices(root, {}, { Path: file });
    if (rejects) assert.match(validationMessage(root), /dynamic executable script/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), markup);
  }
});

test('documentation media allowances remain bound to exact reviewed sources and imports', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const bridge = 'apps/www/src/components/documentation-image-controls.ts';
  const presentation = 'apps/www/src/components/documentation-image-zoom.proto.ts';
  const copied = 'apps/www/src/components/CopiedDocumentationImageControls.ts';
  const allowed = [
    '@proto.ui/adapter-web-component',
    '@proto.ui/prototypes-shadcn/button',
    '@proto.ui/prototypes-shadcn/dialog',
    '@proto.ui/prototypes-brutalist/button',
    '@proto.ui/prototypes-brutalist/dialog',
    '@proto.ui/prototypes-brutalist/theme',
  ];
  const bridgeSource = allowed.map((specifier) => `import '${specifier}';`).join('\n');
  for (const [relative, source] of [
    [bridge, bridgeSource],
    [presentation, "import '@proto.ui/core'; import '@proto.ui/prototypes-base/dialog';"],
    [copied, bridgeSource],
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), source);
  }
  let message = validationMessage(root);
  for (const specifier of allowed) {
    assert.ok(!message.includes(`raw Proto UI import \`${specifier}\` in \`${bridge}\``));
    assert.ok(message.includes(`raw Proto UI import \`${specifier}\` in \`${copied}\``));
  }
  assert.ok(message.includes(`raw Proto UI import \`@proto.ui/core\` in \`${presentation}\``));
  fs.appendFileSync(path.join(root, bridge), "\nimport '@proto.ui/runtime';");
  fs.appendFileSync(path.join(root, presentation), "\nimport '@proto.ui/adapter-react';");
  message = validationMessage(root);
  assert.ok(message.includes(`raw Proto UI import \`@proto.ui/runtime\` in \`${bridge}\``));
  assert.ok(
    message.includes(`raw Proto UI import \`@proto.ui/adapter-react\` in \`${presentation}\``)
  );
});

// Public SVG documents can be opened directly even when a page uses an <img>.
// Inventory evidence must not become active-document execution admission.
for (const [label, markup, reason] of [
  ['external script href', '<svg><script href="https://cdn.example/runtime.js"/></svg>', 'script'],
  ['local script href', '<svg><script href="/runtime.js"/></svg>', 'script'],
  [
    'legacy script xlink href',
    '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><script xlink:href="runtime.js"/></svg>',
    'script',
  ],
  [
    'prefixed script',
    '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:script href="runtime.js"/></s:svg>',
    'script',
  ],
  [
    'unicode namespace script',
    '<é:svg xmlns:é="http://www.w3.org/2000/svg"><é:script href="runtime.js"/></é:svg>',
    'script',
  ],
  [
    'inline script',
    '<svg><script>document.documentElement.dataset.state="open";</script></svg>',
    'script',
  ],
  ['CDATA inline script', '<svg><script><![CDATA[alert("active")]]></script></svg>', 'script'],
  ['data-looking script', '<svg><script type="application/json">{}</script></svg>', 'script'],
  ['event handler', '<svg onload="alert(1)"><rect/></svg>', 'event'],
  ['encoded handler value', '<svg onload="&#97;lert(1)"><rect/></svg>', 'event'],
  [
    'prefixed event element',
    '<s:svg xmlns:s="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    'event',
  ],
  [
    'foreign content',
    '<svg><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">Preview</div></foreignObject></svg>',
    'foreign',
  ],
  [
    'prefixed foreign content',
    '<svg xmlns:s="http://www.w3.org/2000/svg"><s:foreignObject/></svg>',
    'foreign',
  ],
  [
    'external use resource',
    '<svg><use href="https://cdn.example/other.svg#shape"/></svg>',
    'resource',
  ],
  ['local use resource', '<svg><use xlink:href="other.svg#shape"/></svg>', 'resource'],
  ['encoded resource value', '<svg><use href="&#35;shape"/></svg>', 'resource'],
  [
    'aliased xlink resource',
    '<svg xmlns:r="http://www.w3.org/1999/xlink"><use r:href="other.svg#shape"/></svg>',
    'resource',
  ],
  [
    'external image resource',
    '<svg><image href="https://cdn.example/image.svg"/></svg>',
    'resource',
  ],
  [
    'javascript hyperlink',
    '<svg><a href="javascript:alert(1)"><text>Go</text></a></svg>',
    'resource',
  ],
  ['stylesheet instruction', '<?xml-stylesheet href="style.css"?><svg/>', 'resource'],
  ['stylesheet import', '<svg><style>@import "style.css";</style></svg>', 'resource'],
  [
    'stylesheet CDATA import',
    '<svg><style><![CDATA[@import "style.css";]]></style></svg>',
    'resource',
  ],
  ['stylesheet URL', '<svg><rect style="fill:url(other.svg#paint)"/></svg>', 'resource'],
  ['encoded paint resource', '<svg><rect fill="u&#114;l(other.svg#paint)"/></svg>', 'resource'],
  ['escaped paint resource', '<svg><rect fill="\\75rl(other.svg#paint)"/></svg>', 'resource'],
  [
    'unclosed stylesheet resource',
    '<svg><rect style="fill:url(other.svg#paint"/></svg>',
    'resource',
  ],
  ['encoded stylesheet', '<svg><style>@im\\70ort "style.css";</style></svg>', 'resource'],
  [
    'animated reference',
    '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
    'animation',
  ],
  [
    'external SYSTEM DTD',
    '<!DOCTYPE svg SYSTEM "https://cdn.example/active.dtd"><svg/>',
    'resource',
  ],
  [
    'unreviewed PUBLIC DTD',
    '<!DOCTYPE svg PUBLIC "-//EXAMPLE//DTD ACTIVE//EN" "https://cdn.example/active.dtd"><svg/>',
    'resource',
  ],
  [
    'redirected legacy PUBLIC DTD',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "https://cdn.example/svg11.dtd"><svg/>',
    'resource',
  ],
  [
    'changed legacy PUBLIC identity',
    '<!DOCTYPE svg PUBLIC "-//EXAMPLE//DTD ACTIVE//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>',
    'resource',
  ],
  [
    'changed legacy declaration spelling',
    '<!DOCTYPE svg  PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>',
    'resource',
  ],
  [
    'CDATA comment opener before script',
    '<svg><desc><![CDATA[<!--]]></desc><script>alert(1)</script><!-- --></svg>',
    'script',
  ],
  [
    'CDATA comment opener before resource',
    '<svg><desc><![CDATA[<!--]]></desc><use href="https://cdn.example/other.svg#shape"/><!-- --></svg>',
    'resource',
  ],
  [
    'CDATA CDO stylesheet import',
    '<svg><style><![CDATA[<!-- @import "https://cdn.example/style.css"; -->]]></style></svg>',
    'resource',
  ],
  [
    'quoted CSS comment opener',
    '<svg><style>.shape{font-family:"/*";fill:url(https://cdn.example/other.svg#paint)} /* */</style></svg>',
    'resource',
  ],
  [
    'image-set string resource',
    '<svg><style>svg{background-image:image-set("https://cdn.example/image.png" 1x)}</style></svg>',
    'resource',
  ],
  [
    'prefixed image-set string resource',
    `<svg><rect style='background-image:-webkit-image-set("image.png" 1x)'/></svg>`,
    'resource',
  ],
  [
    'CDATA quoted style closing tag',
    '<svg><style><![CDATA[.shape{font-family:"</style>";fill:url(https://cdn.example/other.svg#paint)}]]></style></svg>',
    'resource',
  ],
  [
    'PI comment opener before script',
    '<svg><?probe <!-- ?><script>alert(1)</script><!-- --></svg>',
    'script',
  ],
  [
    'PI comment opener before resource',
    '<svg><?probe <!-- ?><use href="https://cdn.example/other.svg#shape"/><!-- --></svg>',
    'resource',
  ],
  ['unsupported XML encoding', '<?xml version="1.0" encoding="UTF-16"?><svg/>', 'XML'],
  [
    'entity declarations',
    '<!DOCTYPE svg [<!ENTITY payload "&lt;script/&gt;">]><svg>&payload;</svg>',
    'XML',
  ],
]) {
  test(`public SVG inventory rejects ${label} even with a reviewed source binding`, () => {
    const root = createRoot();
    const source = 'apps/www/public/preview.svg';
    fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
    fs.writeFileSync(path.join(root, source), markup);
    fs.writeFileSync(
      path.join(root, 'apps/www/src/components/override/Header.astro'),
      '<img src="/preview.svg" alt="Preview"/>'
    );
    writeValidMatrices(root);
    const missing = validationMessage(root);
    assert.ok(
      missing.includes(
        `interactive website source \`${source}\` is missing a reviewed Source-scan binding`
      ),
      missing
    );
    assert.match(missing, new RegExp(`public SVG.*${reason}.*unverified.*not admitted`, 'i'));
    writeValidMatrices(root, {}, {}, { websiteBindings: [[source, ['www.shell.primary-nav']]] });
    const bound = validationMessage(root);
    assert.match(bound, new RegExp(`public SVG.*${reason}.*unverified.*not admitted`, 'i'));
    assert.ok(!bound.includes('source binding must name exactly one'), bound);
    assert.ok(!bound.includes(`interactive website source \`${source}\` is missing`), bound);
  });
}

test('public SVG inventory preserves ordinary static image assets and quoted examples', () => {
  const root = createRoot();
  const source = 'apps/www/public/static.svg';
  fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
  fs.writeFileSync(
    path.join(root, source),
    `<?xml version="1.0"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20">
      <!-- <script href="runtime.js"/><svg onload="alert(1)"/><foreignObject/> -->
      <title>&lt;script&gt; is an example</title>
      <desc><![CDATA[<script href="runtime.js"/> onload="alert(1)"]]></desc>
      <desc><![CDATA[<!-- is text, not a comment opener]]></desc>
      <!-- <![CDATA[ <script href="runtime.js"/> is still a true comment -->
      <defs><path id="shape" d="M0 0h20v20z"/><linearGradient id="paint"/></defs>
      <style>/* @import 'ignored.css'; */ .shape { fill:url(#paint); } @font-face {font-family:Embedded;src:url(data:font/woff2;base64,AAAA)}</style>
      <style>.shape { font-family:"/*"; fill:url(#paint) } /* real comment */</style>
      <style><![CDATA[.shape { font-family:"</style>"; fill:url(#paint) }]]></style>
      <use xlink:href="#shape" class="shape"/>
      <image href="data:image/svg+xml;base64,PHN2Zy8+"/>
      <rect width="20" height="20" fill="url(#paint)" data-description="onload='example'"/>
    </svg>`
  );
  fs.writeFileSync(
    path.join(root, 'apps/www/src/components/override/Header.astro'),
    '<img src="/static.svg" alt="Static diagram"/>'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('public SVG inventory keeps UTF-16 source unverified instead of missing active syntax', () => {
  const root = createRoot();
  const source = 'apps/www/public/encoded.svg';
  fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
  fs.writeFileSync(
    path.join(root, source),
    Buffer.from('\ufeff<svg onload="alert(1)"/>', 'utf16le')
  );
  writeValidMatrices(root);
  const message = validationMessage(root);
  assert.match(message, /interactive website source `apps\/www\/public\/encoded\.svg` is missing/);
  assert.match(message, /public SVG.*XML.*unverified.*not admitted/);
});

test('public SVG inventory ignores inert markup in opaque processing instructions', () => {
  const root = createRoot();
  const source = 'apps/www/public/pi.svg';
  fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
  fs.writeFileSync(
    path.join(root, source),
    `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg">
      <?probe <script href="runtime.js"/> <svg onload="alert(1)"/> <use href="other.svg"/> ?>
      <?probe <style>@import "style.css";</style> <?xml-stylesheet href="style.css"?>
      <rect width="20" height="20"/>
    </svg>`
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('fresh Website resource review: imperative embed creation retains DOM provenance', () => {
  for (const [source, rejects] of [
    ["document.createElement('iframe');", true],
    ["window.document.createElement('object');", true],
    ["const doc=globalThis.document;const kind='embed';doc['createElement'](kind);", true],
    ["document.createElementNS('http://www.w3.org/1999/xhtml','webview');", true],
    ["document.createElement('div');", false],
    ["function render(document){document.createElement('iframe');}", false],
    ["const service={createElement(){}};service.createElement('iframe');", false],
  ]) {
    const root = createRoot();
    const file = 'apps/www/src/components/ImperativeEmbed.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(root);
    if (rejects) assert.match(validationMessage(root), /unreviewed executable embed/);
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
});

test('fresh Website resource review: bound native markup handlers expose executable imports', () => {
  for (const file of ['apps/www/public/events.html', 'apps/www/src/components/EventMarkup.astro']) {
    for (const markup of [
      `<body onload="import('https://cdn.example/runtime.js')"></body>`,
      `<div data-label={><button onclick="import('https://cdn.example/runtime.js')">Run</button> }>`,
      '<div data-label=`><button onclick="import(\'https://cdn.example/runtime.js\')">Run</button> `>',
      `<svg><title><button onclick="import('https://cdn.example/runtime.js')">Run</button></title></svg>`,
      `<svg><title><button title=">" onclick="import('https://cdn.example/runtime.js')">Run</button></title></svg>`,
      `<!--><body onload="import('https://cdn.example/runtime.js')"></body>`,
      `<p title="<!--">Label</p><body onload="import('https://cdn.example/runtime.js')"></body><!-- -->`,
      `<p title="<script>">Label</p><body onload="import('https://cdn.example/runtime.js')"></body></script>`,
      String.raw`<button title="\" onclick="import('https://cdn.example/runtime.js')">Run</button>`,
      `<button onclick="import('@proto.ui/runtime')">Run</button>`,
      `<button ONCLICK='import("https://cdn.example/runtime.js")'>Run</button>`,
      `<button onclick="import(&quot;https://cdn.example/runtime.js&quot;)">Run</button>`,
      `<button onclick={runtimeHandler}>Run</button>`,
    ]) {
      // Braces/backticks are HTML attribute data here, but Astro treats these
      // particular data-label forms as template expressions/literals.
      if (!file.endsWith('.html') && /data-label=[{`]/u.test(markup)) continue;
      const root = createRoot();
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), markup);
      writeValidMatrices(
        root,
        { Path: file },
        {},
        {
          websiteBindings: [[file, ['www.shell.primary-nav']]],
        }
      );
      assert.match(
        validationMessage(root),
        /raw Proto UI import|external executable script|unverified markup event handler/
      );
    }
  }
});

test('fresh Website resource review: static bound handlers and inert examples stay separate', () => {
  for (const markup of [
    '<button onclick="return false">Run</button>',
    '<button title="😀" onclick="return false">Run</button>',
    '<!-- <body onload="import(\'https://cdn.example/runtime.js\')"> -->',
    '<script type="application/json">{"example":"<body onload=bad()>"}</script>',
    '<p data-example="onload=bad()">Static</p>',
  ]) {
    const root = createRoot();
    const file = 'apps/www/public/safe-events.html';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), markup);
    writeValidMatrices(
      root,
      { Path: file },
      {},
      {
        websiteBindings: [[file, ['www.shell.primary-nav']]],
      }
    );
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), markup);
  }
});

test('fresh Website resource review: a template handler cannot inherit source-relative module admission', () => {
  const root = createRoot();
  const file = 'apps/www/src/components/HandlerImport.astro';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(
    path.join(root, file),
    `<button onclick="import('./safe-helper.js')">Run</button>`
  );
  fs.writeFileSync(
    path.join(root, 'apps/www/src/components/safe-helper.js'),
    'export const safe=true;'
  );
  writeValidMatrices(
    root,
    { Path: file },
    {},
    {
      websiteBindings: [[file, ['www.shell.primary-nav']]],
    }
  );
  assert.match(validationMessage(root), /unverified markup event handler/);
});

test('fresh Website resource review: Astro parsing preserves expressions and component callbacks', () => {
  for (const source of [
    '<svg><title>Plain &lt;button&gt; label</title></svg>',
    '<div data-label=`><button onclick="import(\'https://cdn.example/runtime.js\')">Run</button> `></div>',
    `---\nconst callback = "import('https://cdn.example/runtime.js')";\n---\n<Widget onClick={callback} />`,
    `{ '<button onclick="import(\\\'https://cdn.example/runtime.js\\\')">Example</button>' }`,
    `<script>const sample = '<button onclick="import(\\\'https://cdn.example/runtime.js\\\')">Example</button>';</script>`,
    `<style is:inline set:html={''} /><button onclick="return false">Run</button>`,
  ]) {
    const root = createRoot();
    const file = 'apps/www/src/components/NativeHandlerControl.astro';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    writeValidMatrices(
      root,
      { Path: file },
      {},
      {
        websiteBindings: [[file, ['www.shell.primary-nav']]],
      }
    );
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), source);
  }
});

test('registered stage-zero family allowances stay bound to their reviewed sources', () => {
  const root = createRoot();
  const source = 'apps/www/src/pages/en/test/liquid-glass-material.astro';
  const copied = 'apps/www/src/pages/en/test/CopiedMaterial.astro';
  const markup =
    "---\nimport { renderThemeCss } from '../../../../../../packages/prototypes/liquid-glass/src/theme';\n---\n<script>import button from '@proto.ui/prototypes-liquid-glass/button';</script>";
  for (const file of [source, copied]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), markup);
  }
  const theme = 'apps/www/src/components/PrototypePreviewer/projection-theme.ts';
  fs.mkdirSync(path.dirname(path.join(root, theme)), { recursive: true });
  fs.writeFileSync(
    path.join(root, theme),
    "import '../../../../../packages/prototypes/bootstrap-2-3-2/src/theme'; import '../../../../../packages/prototypes/liquid-glass/src/theme';"
  );
  writeValidMatrices(root);
  let message = validationMessage(root);
  assert.ok(!message.includes(`in \`${source}\` escapes the website consumer-wall allowlist`));
  assert.ok(!message.includes(`in \`${theme}\` escapes the website consumer-wall allowlist`));
  assert.ok(message.includes(`in \`${copied}\` escapes the website consumer-wall allowlist`));
  fs.appendFileSync(path.join(root, source), "\n<script>import '@proto.ui/runtime';</script>");
  message = validationMessage(root);
  assert.ok(message.includes(`raw Proto UI import \`@proto.ui/runtime\` in \`${source}\``));
});

test('timer compilation admission: string and unresolved global handlers fail closed', () => {
  for (const expression of [
    `setTimeout("import('https://cdn.example/runtime.js')", 0);`,
    `setInterval('run()', 1);`,
    'window.setTimeout(source, 0);',
    "self['setInterval'](source, 0);",
    'globalThis.setTimeout(`run()`, 0);',
    'const schedule=window.setTimeout;schedule(source, 0);',
    'function run(handler){setTimeout(handler, 0)}',
    'function run(handler=()=>{}){setTimeout(handler, 0)}',
    'setTimeout();',
    'window.setTimeout.call(window, source, 0);',
    'setInterval.apply(window, [source, 0]);',
    'const schedule=setTimeout.bind(window);schedule(source, 0);',
    'Reflect.apply(setTimeout, window, [source, 0]);',
    'window.Reflect.apply(window.setTimeout, window, source);',

    'setTimeout(condition ? (()=>{}) : source, 0);',
    'let handler=()=>{};handler=source;setTimeout(handler, 0);',
    'let handler=()=>{};function later(){handler=source}setTimeout(handler, 0);',
    'const handler=externalHandler;setTimeout(handler, 0);',
    'setTimeout(handler, 0);function handler(){};handler=source;',
    'function handler(){};handler &&= source;setTimeout(handler, 0);',
    'function handler(){};({handler}=external);setTimeout(handler, 0);',
    'function handler(){};[handler]=external;setTimeout(handler, 0);',
    'function handler(){};for(handler of values) { setTimeout(handler, 0); }',
  ])
    for (const kind of ['website', 'harness']) {
      const root = createRoot();
      const file =
        kind === 'website'
          ? 'apps/www/src/components/TimerEntry.ts'
          : 'apps/agent-harness/src/run/TimerEntry.ts';
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), expression);
      writeValidMatrices(root, {}, kind === 'harness' ? { Path: file } : {}, {
        websiteBindings: kind === 'website' ? [[file, ['www.shell.primary-nav']]] : [],
      });
      assert.match(validationMessage(root), /runtime code compilation.*unverified/, expression);
    }
});

test('timer compilation admission: proven callable handlers and shadowed timers remain valid', () => {
  for (const expression of [
    'setTimeout(()=>{}, 0);',
    'setTimeout.call(window, ()=>{}, 0);',
    'setTimeout.apply(window, [()=>{}, 0]);',
    'Reflect.apply(setTimeout, window, [()=>{}, 0]);',
    'const schedule=setTimeout.bind(window, ()=>{});schedule(0);',
    'window.setInterval(function(){}, 1);',
    'const handler=()=>{};setTimeout(handler, 0);',
    'const handler=()=>{};function other(){let handler;handler=source;}setTimeout(handler,0);',
    'function handler(){};function other(handler){handler=source;}setTimeout(handler,0);',
    'const handler=function(){};const alias=handler;self.setInterval(alias, 0);',
    'setTimeout(handler, 0);function handler(){}',
    'function run(setTimeout){setTimeout(source, 0)}',
    'function run(window){window.setTimeout(source, 0)}',
    'const business={setInterval(){}};business.setInterval(source, 0);',
    'const description="setTimeout(source, 0)";',
  ]) {
    const root = createRoot(),
      file = 'apps/agent-harness/src/run/TimerControl.ts';
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), expression);
    writeValidMatrices(root, {}, { Path: file });
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }), expression);
  }
});

function probeReview(id, kind, source, ext = 'ts', bind = true) {
  const root = createRoot();
  const file =
    kind === 'website'
      ? `apps/www/src/${/^mdx?$/u.test(ext) ? 'content/docs' : 'components'}/ReviewProbe.${ext}`
      : `apps/agent-harness/src/run/ReviewProbe.${ext}`;
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), source);
  if (kind === 'harness' && ext === 'vue')
    fs.writeFileSync(
      path.join(root, 'apps/agent-harness/src/run/vue-entry.ts'),
      `import './ReviewProbe.vue';`
    );
  writeValidMatrices(root, {}, kind === 'harness' ? { Path: file } : {}, {
    websiteBindings: kind === 'website' && bind ? [[file, ['www.shell.primary-nav']]] : [],
  });
  const issues = collectCoverageMatrixIssues({ rootDir: root });
  return issues;
}
for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'spread reassignment with safe override',
      'let engine={};engine={...engine,compile(){}};engine.compile(bytes);',
      false,
    ],
    [
      'spread reassignment retaining native method',
      'let engine={compile:WebAssembly.compile};engine={...engine};engine.compile(bytes);',
      true,
    ],
    [
      'spread reassignment with native override',
      'let engine={};engine={...engine,compile:WebAssembly.compile};engine.compile(bytes);',
      true,
    ],
  ])
    test(`WASM recursion regression: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-recursion', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}
for (const kind of ['website', 'harness']) {
  for (const [name, source, diagnostic] of [
    [
      'null-namespace script source',
      "const script=document.createElement('script');script.setAttributeNS(null,'src','https://cdn.example/runtime.js');",
      /external executable.*script/u,
    ],
    [
      'location href navigation',
      'window.location.href="javascript:import(\'https://cdn.example/runtime.js\')";',
      /executable navigation URL.*unverified/u,
    ],
    [
      'service worker alias',
      "const worker=navigator.serviceWorker;worker.register('/worker.js');",
      /external executable.*script.*not reviewed|worker.*unverified/u,
    ],
    [
      'service worker extraction',
      "const {serviceWorker:worker}=navigator;worker.register('/worker.js');",
      /external executable.*script.*not reviewed|worker.*unverified/u,
    ],
  ])
    test(`native entry followup red: ${kind} ${name}`, () => {
      const issues = probeReview('native-entry-followup', kind, source);
      assert.ok(
        issues.some((issue) => diagnostic.test(issue)),
        issues.join('\n')
      );
    });
}
for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'XHTML NS script',
      "const s=document.createElementNS('http://www.w3.org/1999/xhtml','script');s.src='https://cdn.example/runtime.js';document.body.append(s);",
      true,
    ],
    [
      'ordinary script control',
      "const s=document.createElement('script');s.src='https://cdn.example/runtime.js';document.body.append(s);",
      true,
    ],
    [
      'qualified NS script',
      "const s=globalThis.document.createElementNS('http://www.w3.org/1999/xhtml','script');s.src='https://cdn.example/runtime.js';document.body.append(s);",
      true,
    ],
    [
      'NS inline body',
      "const s=document.createElementNS('http://www.w3.org/1999/xhtml','script');s.textContent='alert(1)';document.body.append(s);",
      true,
    ],
    [
      'NS shadowed document control',
      "function f(document){const s=document.createElementNS('http://www.w3.org/1999/xhtml','script');s.src='https://cdn.example/runtime.js';}",
      false,
    ],
  ])
    test(`reviewed entry boundaries: 4560 ${kind} ${name}`, () => {
      const issues = probeReview('4176574560', kind, source);
      assert.equal(
        issues.some((x) => /(?:external|dynamic) executable script|unverified/.test(x)),
        reject
      );
    });
  for (const [name, markup, reject] of [
    [
      'javascript anchor',
      `<a href="javascript:import('https://cdn.example/runtime.js')">Run</a>`,
      true,
    ],
    [
      'mixed-case and tab URL',
      `<a href=" \tJaVaScRiPt:import('https://cdn.example/runtime.js')">Run</a>`,
      true,
    ],
    [
      'encoded javascript anchor',
      `<a href="java&#115;cript:import('https://cdn.example/runtime.js')">Run</a>`,
      true,
    ],
    [
      'form action',
      `<form action="javascript:import('https://cdn.example/runtime.js')"><button>Run</button></form>`,
      true,
    ],
    [
      'button formaction',
      `<form><button formaction="javascript:import('https://cdn.example/runtime.js')">Run</button></form>`,
      true,
    ],
    ['normal href control', '<a href="https://example.com">Run</a>', false],
    [
      'comment control',
      `<!-- <a href="javascript:import('https://cdn.example/runtime.js')">Run</a> -->`,
      false,
    ],
    [
      'data example control',
      `<p data-example="javascript:import('https://cdn.example/runtime.js')">Run</p>`,
      false,
    ],
  ])
    test(`reviewed entry boundaries: 6499 ${kind} ${name}`, () => {
      const issues = probeReview('4176576499', kind, markup, 'html');
      assert.equal(
        issues.some((x) => /unverified|executable/.test(x)),
        reject
      );
    });
}
for (const owner of ['document', 'window.document', 'self.document', 'globalThis.document']) {
  for (const [name, source] of [
    ['hidden', `${owner}.body.hidden=true;`],
    ['listener', `${owner}.querySelector('button').addEventListener('click',()=>{});`],
    ['alias', `const doc=${owner};doc.querySelector('button').addEventListener('click',()=>{});`],
  ])
    test(`reviewed entry boundaries: 4565 ${owner} ${name}`, () => {
      const issues = probeReview('4176574565', 'harness', source);
      assert.equal(
        issues.some((x) => /forbidden interaction/.test(x)),
        true
      );
    });
}
for (const owner of ['window', 'self', 'globalThis'])
  test(`reviewed entry boundaries: 4565 shadowed ${owner} control`, () => {
    const source = `function run(${owner}){${owner}.document.body.hidden=true;${owner}.document.querySelector('button').addEventListener('click',()=>{});}`;
    assert.deepEqual(probeReview('4176574565', 'harness', source), []);
  });
for (const [name, source, bind, reject] of [
  ['details', '<details><summary>Title</summary>Body</details>', false, true],
  ['form button', '<form><button>Submit</button></form>', false, true],
  ['input', '<input type="text" />', false, true],
  ['select', '<select><option>One</option></select>', false, true],
  ['textarea', '<textarea />', false, true],
  ['event control', '<button onClick={()=>{}}>Submit</button>', false, true],
  ['bound native control', '<details><summary>Title</summary>Body</details>', true, false],
  ['fenced control', '```html\n<details><summary>Title</summary>Body</details>\n```', false, false],
  ['inline code control', '`<button>Example</button>`', false, false],
  ['comment control', '<!-- <button>Example</button> -->', false, false],
  ['custom name control', '<Details><Summary>Title</Summary>Body</Details>', false, false],
  ['static native control', '<article><h2>Title</h2><p>Text</p></article>', false, false],
])
  test(`reviewed entry boundaries: 6501 ${name}`, () => {
    const issues = probeReview('4176576501', 'website', source, 'mdx', bind);
    assert.equal(
      issues.some((x) => /interactive website source.*not bound/.test(x)),
      reject
    );
  });
for (const file of [
  'scripts/coverage-matrices/README.md',
  'internal/website/self-hosting-coverage-matrix.md',
])
  test(`reviewed entry boundaries: 4562 ${file}`, () => {
    const content = fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
    assert.ok(
      !content.includes('Node 22'),
      `${file} retains stale Node 22 operational instruction`
    );
  });

for (const extension of ['html', 'astro', 'tsx', 'mdx']) {
  for (const kind of extension === 'html' || extension === 'tsx'
    ? ['website', 'harness']
    : ['website']) {
    test(`reviewed navigation formats: ${kind} ${extension} rejects literal execution`, () => {
      for (const source of [
        `<a href="java&#x73;cript:alert(1)">Run</a>`,
        `<a href="java&#x09;script:alert(1)">Run</a>`,
        `<area href="javascript:alert(1)" />`,
        `<input type="submit" formaction="javascript:alert(1)" />`,
        ...(extension === 'html'
          ? []
          : [
              `<a href={'javascript:alert(1)'}>Run</a>`,
              ...(extension === 'mdx' ? [] : ['<form action={`javascript:alert(1)`} />']),
            ]),
      ])
        assert.ok(
          probeReview('4176576499', kind, source, extension).some((issue) =>
            /executable navigation URL.*unverified/.test(issue)
          ),
          source
        );
    });
    test(`reviewed navigation formats: ${kind} ${extension} retains inert values`, () => {
      for (const source of [
        `<a href="https://example.com?a=1&amp;b=2">Run</a>`,
        `<a href="/docs/javascript:example">Run</a>`,
        `<p title="javascript:alert(1)">Example</p>`,
        ...(extension === 'html'
          ? []
          : [
              `<Link href="javascript:alert(1)">Business prop</Link>`,
              `<a href={target}>Run</a>`,
              `<a href={'java&#x73;cript:alert(1)'}>Literal ampersand in expression</a>`,
            ]),
      ])
        assert.ok(
          !probeReview('4176576499', kind, source, extension).some((issue) =>
            /executable navigation URL/.test(issue)
          ),
          source
        );
    });
  }
}
for (const owner of ['window', 'self', 'globalThis']) {
  test(`reviewed document receivers: ${owner} properties and collections`, () => {
    for (const source of [
      `${owner}['document']['body'].hidden = true;`,
      `${owner}.document.documentElement.inert = true;`,
      `${owner}.document.activeElement.disabled = true;`,
      `const doc=${owner}.document;doc.body.hidden=true;`,
      `const {body}= ${owner}.document;body.hidden=true;`,
      `${owner}.document.querySelectorAll('button')[0].addEventListener('click',()=>{});`,
      `${owner}.document.querySelector('button').onclick=()=>{};`,
    ])
      assert.ok(
        probeReview('4176574565', 'harness', source).some((issue) =>
          /forbidden interaction/.test(issue)
        ),
        source
      );
  });
  test(`reviewed document receivers: ${owner} local definitions stay separate`, () => {
    for (const source of [
      `const ${owner}={document:business};${owner}.document.body.hidden=true;`,
      `${owner}.document.body.hidden=true;const ${owner}={document:business};`,
      `function ${owner}(){};${owner}.document.body.hidden=true;`,
      `class ${owner}{};${owner}.document.body.hidden=true;`,
    ])
      assert.ok(
        !probeReview('4176574565', 'harness', source).some((issue) =>
          /forbidden interaction/.test(issue)
        ),
        source
      );
  });
}
test('reviewed XHTML namespace: direct receiver forms and namespace controls', () => {
  for (const [source, reject] of [
    [
      `const s=document.createElementNS('http://www.w3.org/1999/xhtml','x:script');s.src='https://cdn.example/runtime.js';`,
      true,
    ],
    [
      `const s=document.createElementNS('http://www.w3.org/1999/xhtml','script');s.setAttribute('src','https://cdn.example/runtime.js');`,
      true,
    ],
    [
      `Object.assign(document.createElementNS('http://www.w3.org/1999/xhtml','script'),{src:'https://cdn.example/runtime.js'});`,
      true,
    ],
    [
      `const s=document.createElementNS('http://www.w3.org/1999/xhtml','script');Reflect.set(s,'src','https://cdn.example/runtime.js');`,
      true,
    ],
    [
      `const s=document.createElementNS('urn:business','script');s.src='https://cdn.example/runtime.js';`,
      false,
    ],
    [
      `const s=document.createElementNS('http://www.w3.org/1999/xhtml','Script');s.src='https://cdn.example/runtime.js';`,
      false,
    ],
  ])
    assert.equal(
      probeReview('4176574560', 'website', source).some((issue) => /executable script/.test(issue)),
      reject,
      source
    );
});
test('reviewed native MDX: nested live controls and prose boundaries', () => {
  for (const [source, reject] of [
    ['# Title\n\nA paragraph.\n\n<details>\n<summary>More</summary>\nBody\n</details>', true],
    ['<section>\n    <details>\n        <summary>More</summary>\n    </details>\n</section>', true],
    ['{"<details><summary>Example</summary></details>"}', false],
    ['<Widget label="<button>Example</button>" />', false],
    // MDX permits indented JSX; unlike Markdown, this is not a code block.
    ['    <button>Indented example</button>', true],
    ['<a href="/docs">Ordinary document link</a>', false],
  ])
    assert.equal(
      probeReview('4176576501', 'website', source, 'mdx', false).some((issue) =>
        /interactive website source.*not bound/.test(issue)
      ),
      reject,
      source
    );
});
for (const extension of ['mdx', 'vue', 'svelte'])
  test(`reviewed navigation formats: prose and templates ${extension}`, () => {
    const prefix = extension === 'mdx' ? '# Title\n\nOrdinary documentation paragraph.\n\n' : '';
    const source = `${prefix}<a href="javascript:alert(1)">Run</a>`;
    assert.ok(
      probeReview('4176576499', 'website', source, extension).some((issue) =>
        /executable navigation URL.*unverified/.test(issue)
      ),
      source
    );
  });

for (const owner of ['window', 'self', 'globalThis']) {
  test(`reviewed document receivers: ${owner} expression wrappers preserve provenance`, () => {
    for (const expression of [`(${owner})`, `${owner}!`, `(${owner} as typeof ${owner})`])
      assert.ok(
        probeReview('4176574565', 'harness', `${expression}.document.body.hidden=true;`).some(
          (issue) => /forbidden interaction/.test(issue)
        ),
        expression
      );
  });
  test(`reviewed document receivers: ${owner} named function expression is locally shadowed`, () => {
    assert.deepEqual(
      probeReview(
        '4176574565',
        'harness',
        `const run=function ${owner}(){${owner}.document.body.hidden=true;};`
      ),
      []
    );
    assert.ok(
      probeReview(
        '4176574565',
        'harness',
        `const run=function ${owner}(){business();};${owner}.document.body.hidden=true;`
      ).some((issue) => /forbidden interaction/.test(issue))
    );
  });
}
for (const extension of ['md', 'mdx'])
  test(`reviewed native Markdown: ${extension} element name case`, () => {
    for (const tag of ['button', 'details', 'input']) {
      const source = `<${tag.toUpperCase()}>Text</${tag.toUpperCase()}>`;
      assert.equal(
        probeReview('4176576501', 'website', source, extension, false).some((issue) =>
          /interactive website source.*not bound/.test(issue)
        ),
        extension === 'md',
        source
      );
    }
  });
test('reviewed native Markdown: raw HTML URL case and inert JSX-looking value', () => {
  assert.ok(
    probeReview('4176576499', 'website', '<A HREF="javascript:alert(1)">Run</A>', 'md').some(
      (issue) => /executable navigation URL.*unverified/.test(issue)
    )
  );
  assert.ok(
    !probeReview(
      '4176576499',
      'website',
      `<a href={'javascript:alert(1)'}>This is HTML</a>`,
      'md'
    ).some((issue) => /executable navigation URL/.test(issue))
  );
});

for (const owner of ['window', 'self', 'globalThis'])
  test(`reviewed document receivers: ${owner} named class is locally shadowed`, () => {
    assert.deepEqual(
      probeReview(
        '4176574565',
        'harness',
        `const run=class ${owner}{static run(){${owner}.document.body.hidden=true;}};`
      ),
      []
    );
    assert.ok(
      probeReview(
        '4176574565',
        'harness',
        `const run=class ${owner}{};${owner}.document.body.hidden=true;`
      ).some((issue) => /forbidden interaction/.test(issue))
    );
  });
test('reviewed document receivers: inner temporal dead zone does not reuse outer DOM aliases', () => {
  for (const source of [
    `const doc=window.document;{doc.body.hidden=true;const doc={body:{}};}`,
    `const node=window.document.querySelector('button');{node.hidden=true;const node={};}`,
  ])
    assert.deepEqual(probeReview('4176574565', 'harness', source), [], source);
  assert.ok(
    probeReview(
      '4176574565',
      'harness',
      `const doc=window.document;{const other={};doc.body.hidden=true;}`
    ).some((issue) => /forbidden interaction/.test(issue))
  );
});

test('reviewed native MDX: ESM literal examples are not rendered controls or URLs', () => {
  for (const source of [
    `export const example = '<a href="javascript:alert(1)">Run</a>';`,
    `export const example = '<button>Example</button>';`,
    `export const Example = () => '<button>Example</button>';`,
    `export default '<button>Example</button>';`,
    'export const example = `😀<button>Example</button>`;',
    `export const example = '<button>Example</button>';\n\nOrdinary prose.`,
  ])
    assert.deepEqual(probeReview('4176576501', 'website', source, 'mdx', false), [], source);
  assert.ok(
    probeReview(
      '4176576501',
      'website',
      'export const Example=()=> <button>Live</button>;',
      'mdx',
      false
    ).some((issue) => /interactive website source.*not bound/.test(issue))
  );
  assert.ok(
    probeReview(
      '4176576499',
      'website',
      `export const Example=()=> <a href="javascript:alert(1)">Live</a>;`,
      'mdx'
    ).some((issue) => /executable navigation URL.*unverified/.test(issue))
  );
});

test('reviewed native MDX: ESM comments and regex literals remain data', () => {
  for (const source of [
    "export const example = /* <button>Example</button> */ 'plain';",
    'export const pattern = /<button>/;',
    'export const value = 1; // <button>Example</button>',
    'export const value = 1; // <a href="javascript:alert(1)">Example</a>',
    'export const value = /* <a href="javascript:alert(1)">Example</a> */ 1;',
  ])
    assert.deepEqual(probeReview('4176576501', 'website', source, 'mdx', false), [], source);
  assert.ok(
    probeReview(
      '4176576501',
      'website',
      'export const Example=()=> <p>/*<button>Live</button>*/</p>;',
      'mdx',
      false
    ).some((issue) => /interactive website source.*not bound/.test(issue))
  );
});
test('reviewed native MDX: exported JSX attributes retain transparent expression wrappers', () => {
  for (const expression of [
    "('javascript:alert(1)')",
    "(('javascript:alert(1)'))",
    "('javascript:alert(1)' as string)",
    "('javascript:alert(1)' satisfies string)",
    "('javascript:alert(1)')!",
    '(`javascript:alert(1)`)',
  ])
    for (const source of [
      `export const Example=()=> <a href={${expression}}>Live</a>;`,
      `export const Example=<a href={${expression}}>Live</a>;`,
    ])
      assert.ok(
        probeReview('4176576499', 'website', source, 'mdx').some((issue) =>
          /executable navigation URL.*unverified/.test(issue)
        ),
        source
      );
});

for (const [name, source] of [
  [
    'backtick fence',
    '```mdx\nexport const Example=()=> <a href="javascript:alert(1)">Live</a>;\n```',
  ],
  ['tilde fence', '~~~mdx\nexport const Example=()=> <a href="javascript:alert(1)">Live</a>;\n~~~'],
  ['indented example', '    export const Example=()=> <a href="javascript:alert(1)">Live</a>;'],
  ['inline example', '`export const Example=()=> <a href="javascript:alert(1)">Live</a>;`'],
  [
    'quoted tilde fence',
    '> ~~~mdx\n> export const Example=()=> <a href="javascript:alert(1)">Live</a>;\n> ~~~',
  ],
  ['HTML comment', '<!--\nexport const Example=()=> <a href="javascript:alert(1)">Live</a>;\n-->'],
]) {
  test(`reviewed native MDX: ESM scan keeps ${name} inert`, () => {
    const issues = probeReview('4176576499', 'website', source, 'mdx', false);
    assert.ok(!issues.some((issue) => /executable navigation URL/.test(issue)));
  });
}

test('reviewed native MDX: real exported templates survive example and comment exclusion', () => {
  for (const prefix of [
    '~~~mdx\nexport const Example=()=> <a href="https://example.com">Example</a>;\n~~~\n\n',
    '> ~~~mdx\n> export const Example=()=> <a href="https://example.com">Example</a>;\n> ~~~\n\n',
    '<!-- inert example -->\n',
    "export const commentExample = '<!--';\n",
  ]) {
    const source = prefix + 'export const Live=()=> <a href={(`javascript:alert(1)`)}>Live</a>;';
    assert.ok(
      probeReview('4176576499', 'website', source, 'mdx').some((issue) =>
        /executable navigation URL/.test(issue)
      ),
      source
    );
  }
  const inertCommentAttribute =
    'export const Example=()=> <a href="<!--x-->javascript:alert(1)">Text</a>;';
  assert.ok(
    !probeReview('4176576499', 'website', inertCommentAttribute, 'mdx').some((issue) =>
      /executable navigation URL/.test(issue)
    )
  );
});

for (const extension of ['md', 'mdx'])
  for (const tag of ['video', 'audio'])
    test(`media resource review: inventories ${extension} ${tag} controls`, () => {
      const issues = probeReview('4178614707', 'website', `<${tag} controls />`, extension, false);
      assert.ok(issues.some((issue) => /interactive website source.*not bound/u.test(issue)));
    });

for (const [name, markup] of [
  ['image', '<img src="/surface.bin" />'],
  ['Markdown image', '![Surface](/surface.bin)'],
])
  test(`media resource review: binds changed ${name} bytes to evidence`, () => {
    const root = createRoot();
    const implementationPath =
      name === 'image'
        ? 'apps/www/src/components/override/Search.astro'
        : 'apps/www/src/content/docs/search.mdx';
    const asset = path.join(root, 'apps/www/public/surface.bin');
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.mkdirSync(path.dirname(asset), { recursive: true });
    fs.writeFileSync(path.join(root, implementationPath), markup);
    fs.writeFileSync(asset, Buffer.from([0, 128, 255]));
    writeValidMatrices(root, { Path: implementationPath }, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, {
      websiteBindings,
      matrixOverrides: { Path: implementationPath },
    });
    assert.doesNotThrow(() =>
      validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
    );
    fs.writeFileSync(asset, Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promoted dependency.*surface\.bin.*differs from evidence Commit/u
    );
  });

for (const [name, entry, pattern] of [
  [
    'stylesheet',
    "{tag:'link',attrs:{rel:'stylesheet',href:'https://cdn.example/theme.css'}}",
    /external stylesheet/u,
  ],
  ['base', "{tag:'base',attrs:{href:'https://cdn.example/'}}", /external document base/u],
])
  test(`media resource review: inspects config head ${name}`, () => {
    const root = createRoot();
    fs.writeFileSync(
      path.join(root, 'apps/www/astro.config.mjs'),
      `export default {integrations:[starlight({head:[${entry}]})]};`
    );
    writeValidMatrices(root);
    assert.match(validationMessage(root), pattern);
  });

for (const [extension, source, interactive] of [
  ['md', '<VIDEO CONTROLS="false"></VIDEO>', true],
  ['md', '<audio controls=false></audio>', true],
  ['md', '<video data-controls="yes"></video>', false],
  ['md', '<audio title="controls"></audio>', false],
  ['mdx', '<video controls={true}/>', true],
  ['mdx', '<video controls={enabled}/>', true],
  ['mdx', '<audio {...attributes}/>', true],
  ['mdx', '<audio controls="false"/>', true],
  ['mdx', '<audio controls={false}/>', false],
  ['mdx', '<video controls={null}/>', false],
  ['mdx', '<video controls={0}/>', false],
  ['mdx', '<video muted autoPlay/>', false],
  ['mdx', '<Video controls/>', false],
  ['mdx', '<div>{"<video controls/>"}</div>', false],
  ['mdx', 'export const sample = "<audio controls/>";\n\nText', false],
  ['mdx', '```mdx\n<video controls/>\n```\n`<audio controls/>`', false],
  ['mdx', '<!-- <audio controls/> -->', false],
])
  test(`media resource controls: ${extension} ${source}`, () => {
    assert.equal(
      probeReview('4178614707-controls', 'website', source, extension, false).some((issue) =>
        /interactive website source.*not bound/u.test(issue)
      ),
      interactive
    );
  });

function markupPromotionFixture(
  markup,
  { extension = 'astro', config, assets = ['apps/www/public/surface.bin'] } = {}
) {
  const root = createRoot();
  const implementationPath = /^mdx?$/u.test(extension)
    ? `apps/www/src/content/docs/search.${extension}`
    : `apps/www/src/components/override/Search.${extension}`;
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), markup);
  for (const asset of assets) {
    fs.mkdirSync(path.dirname(path.join(root, asset)), { recursive: true });
    fs.writeFileSync(path.join(root, asset), Buffer.from([0, 128, 255]));
  }
  if (config) fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
  writeValidMatrices(root, { Path: implementationPath }, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, {
    websiteBindings,
    matrixOverrides: { Path: implementationPath },
  });
  return {
    root,
    revision,
    websiteBindings,
    options: { rootDir: root, ...promotionOptions(revision) },
  };
}

for (const [name, extension, markup] of [
  ['HTML image', 'html', '<img src="/surface.bin">'],
  ['Astro video poster', 'astro', '<video poster="/surface.bin"/>'],
  ['Astro audio source', 'astro', '<audio><source src="/surface.bin"/></audio>'],
  ['Astro track', 'astro', '<video><track src="/surface.bin"/></video>'],
  ['Vue source', 'vue', '<template><audio src="/surface.bin"/></template>'],
  ['Svelte image', 'svelte', '<img src="/surface.bin"/>'],
  ['JSX image', 'tsx', 'export const Surface=()=> <img src={"/surface.bin"}/>;'],
  [
    'responsive image',
    'tsx',
    'export const Surface=()=> <picture><source srcSet="/surface.bin 1x, /surface.bin 2x"/></picture>;',
  ],
  ['SVG image', 'html', '<svg><image href="/surface.bin"/></svg>'],
  ['SVG use', 'html', '<svg><use href="/surface.bin#check"/></svg>'],
  ['SVG legacy use', 'md', '<svg><use xlink:href="/surface.bin#check"/></svg>'],
  [
    'SVG JSX use',
    'tsx',
    'export const Surface=()=> <svg><use xlinkHref="/surface.bin#check"/></svg>;',
  ],
  ['SVG legacy image', 'md', '<svg><image xlink:href="/surface.bin"/></svg>'],
  ['percent query fragment', 'astro', '<img src="/surf%61ce.bin?v=2#crop"/>'],
  ['browser normalization', 'astro', '<img src=" \tsurface.bin "/>'],
  ['nested alt text', 'md', '![A [nested] label](/surface.bin)'],
  ['even escaped prefix', 'md', '\\\\![Surface](/surface.bin)'],
  ['angle destination', 'md', '![Surface](</surface.bin> "title")'],
  ['full reference', 'md', '![Surface][Art]\n\n[art]: /surface.bin'],
  ['collapsed reference', 'md', '![Art][]\n\n[art]: /surface.bin'],
  ['shortcut reference', 'md', '![Art]\n\n[art]: /surface.bin'],
  ['multiline reference', 'md', '![Art][x]\n\n[x]:\n /surface.bin'],
  ['nested MDX children', 'mdx', '<section>\n![Surface](/surface.bin)\n</section>'],
  ['MDX reference', 'mdx', '![Art][]\n\n[art]: /surface.bin'],
])
  test(`media resource assets: ${name} preserves unchanged and rejects changed bytes`, () => {
    const relative =
      name === 'browser normalization'
        ? 'apps/www/src/components/override/surface.bin'
        : 'apps/www/public/surface.bin';
    const { root, options } = markupPromotionFixture(markup, { extension, assets: [relative] });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
    fs.writeFileSync(path.join(root, relative), Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.bin.*differs from evidence Commit/u
    );
  });

for (const [name, extension, markup] of [
  ['remote', 'astro', '<img src="https://cdn.example/surface.bin"/>'],
  ['missing', 'astro', '<img src="/missing.bin"/>'],
  ['dynamic', 'mdx', '<img src={asset}/>'],
  ['spread', 'tsx', 'export const Surface=()=> <img {...attributes}/>;'],
  ['Vue dynamic', 'vue', '<template><img :src="asset"/></template>'],
  ['Vue spread', 'vue', '<template><img v-bind="attributes"/></template>'],
  ['bad percent', 'astro', '<img src="/%zz.bin"/>'],
  ['encoded traversal', 'astro', '<img src="/%2e%2e/surface.bin"/>'],
  ['repository escape', 'astro', '<img src="../../../../../../surface.bin"/>'],
  ['entity uncertainty', 'astro', '<img src="/surf&#97;ce.bin"/>'],
  ['opaque srcset', 'tsx', 'export const Surface=()=> <img srcSet={choices}/>;'],
  ['unparseable MDX', 'mdx', '![Surface](/surface.bin)\n{'],
])
  test(`media resource assets: ${name} stays unverified`, () => {
    const { root, options } = markupPromotionFixture(markup, { extension });
    assert.match(validationMessage(root, options), /promotion markup resource.*unverified/u);
  });

for (const mode of ['file', 'directory', 'ancestor-directory'])
  test(`media resource assets: rejects ${mode} symlink targets`, () => {
    const { root, options } = markupPromotionFixture('<img src="/alias/surface.bin"/>');
    const publicRoot = path.join(root, 'apps/www/public');
    if (mode === 'file') {
      fs.mkdirSync(path.join(publicRoot, 'alias'));
      fs.symlinkSync('../surface.bin', path.join(publicRoot, 'alias/surface.bin'));
    } else if (mode === 'directory') fs.symlinkSync('.', path.join(publicRoot, 'alias'));
    else {
      fs.mkdirSync(path.join(publicRoot, 'nested'));
      fs.renameSync(
        path.join(publicRoot, 'surface.bin'),
        path.join(publicRoot, 'nested/surface.bin')
      );
      fs.symlinkSync('nested', path.join(publicRoot, 'alias'));
    }
    assert.match(
      validationMessage(root, options),
      /promotion markup resource symlink.*unverified/u
    );
  });

for (const [extension, markup] of [
  ['md', '```md\n![Surface](/missing.bin)\n```\n`![Surface](/missing.bin)`'],
  ['md', '\\![Surface](/missing.bin)\n\n<pre>![Surface](/missing.bin)</pre>'],
  ['mdx', 'export const sample = "![Surface](/missing.bin) <img src=\'/missing.bin\'/>";\n\nText'],
  ['mdx', '<div>{"![Surface](/missing.bin)"}</div>'],
  ['mdx', '<!-- ![Surface](/missing.bin) <img src="/missing.bin"/> -->'],
  [
    'tsx',
    'export const sample="<img src=\'/missing.bin\'/>"; export const Surface=()=> <Image src="/missing.bin"/>;',
  ],
  ['astro', '---\nconst sample="<img src=\'/missing.bin\'/>";\n---\n<main>Static</main>'],
  ['astro', '<img src="data:image/png;base64,AA=="/><svg><image href="#local"/></svg>'],
])
  test(`media resource examples: ${extension} ${markup}`, () => {
    const { options } = markupPromotionFixture(markup, { extension });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const [name, config, rejects] of [
  [
    'meta/icon and business head',
    `const business={head:[{tag:'link',attrs:{rel:'stylesheet',href:'https://cdn.example/business.css'}}]}; export default {head:[{tag:'meta',attrs:{name:'description',content:'ordinary'}},{tag:'link',attrs:{rel:'icon',href:'/icon.png'}}], business:{head:unknownValue}};`,
    false,
  ],
  [
    'aliased Starlight',
    `import star from '@astrojs/starlight'; export default {integrations:[star({head:[{tag:'base',attrs:{href:'https://cdn.example/'}}]})]};`,
    true,
  ],
  [
    'computed keys',
    `export default {['head']:[{['tag']:'link',['attrs']:{['rel']:'stylesheet',['href']:'https://cdn.example/theme.css'}}]};`,
    true,
  ],
  ['opaque attrs', `export default {head:[{tag:'link',attrs:attributes}]};`, true],
  [
    'opaque relation',
    `export default {head:[{tag:'link',attrs:{rel:relation,href:'/theme.css'}}]};`,
    true,
  ],
  ['opaque href', `export default {head:[{tag:'base',attrs:{href:base}}]};`, true],
  ['head spread', `export default {head:[{tag:'link',attrs:{...attributes}}]};`, true],
  [
    'exported alias',
    `const cfg={};cfg.head=[{tag:'base',attrs:{href:'https://cdn.example/'}}];export default cfg;`,
    true,
  ],
  ['named default', `const cfg={head:[]};export {cfg as default};`, true],
  ['quoted default', `const cfg={head:[]};export {cfg as 'default'};`, true],
  [
    'integration alias',
    `const docs=starlight({head:[]});export default {integrations:[docs]};`,
    true,
  ],
  ['integration spread', `const docs=[];export default {integrations:[...docs]};`, true],
  [
    'integration conditional',
    `export default {integrations:[condition?starlight({head:[]}):null]};`,
    true,
  ],
  [
    'options mutation',
    `const options={};options.head=resource;export default {integrations:[starlight(options)]};`,
    true,
  ],
  [
    'style import',
    `export default {head:[{tag:'style',content:'@import "https://cdn.example/theme.css";'}]};`,
    true,
  ],
])
  test(`media resource head: ${name}`, () => {
    const root = createRoot();
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
    writeValidMatrices(root);
    if (rejects)
      assert.match(
        validationMessage(root),
        /(?:unverified|external stylesheet|external document base)/u
      );
    else assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  });

test('media resource head: local stylesheet has its own wall and promotion byte closure', () => {
  const config = `export default {head:[{tag:'link',attrs:{rel:'stylesheet',href:'/surface.css'}}]};`;
  const { root, options, websiteBindings } = markupPromotionFixture('<main>Static</main>', {
    config,
    assets: [],
  });
  const stylesheet = path.join(root, 'apps/www/public/surface.css');
  fs.mkdirSync(path.dirname(stylesheet), { recursive: true });
  fs.writeFileSync(stylesheet, 'main{color:red}');
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  const promoted = { ...options, ...promotionOptions(revision) };
  assert.doesNotThrow(() => validateCoverageMatrices(promoted));
  fs.writeFileSync(stylesheet, 'main{color:blue}');
  assert.match(
    validationMessage(root, promoted),
    /promoted dependency.*surface\.css.*differs from evidence Commit/u
  );
  fs.writeFileSync(stylesheet, '@import "https://cdn.example/raw.css";');
  writeValidMatrices(root, {}, {}, { websiteBindings });
  assert.match(validationMessage(root), /external stylesheet.*raw.css/u);
});

for (const declaration of [
  `const integrations=[starlight({head:[]})];export default {integrations};`,
  `export default {get integrations(){return [starlight({head:[]})]}};`,
])
  test(`media resource head: opaque integration field ${declaration}`, () => {
    const root = createRoot();
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), declaration);
    writeValidMatrices(root);
    assert.match(validationMessage(root), /integration head configuration is unverified/u);
  });

for (const disabled of [true, false])
  test(`media resource head: static boolean attributes preserve link semantics (${disabled})`, () => {
    const root = createRoot();
    fs.writeFileSync(
      path.join(root, 'apps/www/astro.config.mjs'),
      `export default {head:[{tag:'link',attrs:{rel:'icon',href:'/icon.png',crossorigin:true}},{tag:'link',attrs:{rel:'stylesheet',href:'/theme.css',disabled:${disabled}}}]};`
    );
    fs.mkdirSync(path.join(root, 'apps/www/public'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/www/public/theme.css'), 'main{color:blue}');
    writeValidMatrices(root);
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
  });

for (const field of ['href', 'rel'])
  for (const value of [true, false])
    test(`media resource head: ${field}=${value} is not an HTML boolean flag`, () => {
      const root = createRoot();
      const attrs = { rel: 'stylesheet', href: '/theme.css', [field]: value };
      fs.writeFileSync(
        path.join(root, 'apps/www/astro.config.mjs'),
        `export default {head:[{tag:'link',attrs:${JSON.stringify(attrs)}}]};`
      );
      writeValidMatrices(root);
      assert.match(validationMessage(root), /head resource attributes are unverified/u);
    });

test('media resource head: inline style URL bytes enter promotion closure', () => {
  const config = `export default {head:[{tag:'style',content:"main{background:url('/surface.bin')}"}]};`;
  const { root, options } = markupPromotionFixture('<main>Static</main>', { config });
  assert.doesNotThrow(() => validateCoverageMatrices(options));
  fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
  assert.match(
    validationMessage(root, options),
    /promoted dependency.*surface\.bin.*differs from evidence Commit/u
  );
});

for (const source of [
  '<pre>`<img src="/surface.bin">`</pre>',
  '<div>\n`<img src="/surface.bin">`\n</div>',
])
  test(`raw Markdown resource boundary: ${source}`, () => {
    const { root, options } = markupPromotionFixture(source, { extension: 'md' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.bin.*differs from evidence Commit/u
    );
  });

for (const [extension, source, interactive] of [
  ['md', '<pre>`<video controls></video>`</pre>', true],
  ['md', '<div>\n`<audio controls></audio>`\n</div>', true],
  ['md', '`<video controls></video>`', false],
  ['md', '```html\n<pre><audio controls></audio></pre>\n```', false],
  ['mdx', '<pre>`<video controls/>`</pre>', false],
])
  test(`raw Markdown media boundary: ${extension} ${source}`, () => {
    assert.equal(
      probeReview('raw-markdown-media', 'website', source, extension, false).some((issue) =>
        /interactive website source.*not bound/u.test(issue)
      ),
      interactive
    );
  });

for (const [extension, source] of [
  ['md', '<style>.surface{background:url("/surface.bin")}</style>'],
  ['mdx', '<style>{`.surface{background:url("/surface.bin")}`}</style>'],
])
  test(`raw Markdown stylesheet boundary: ${extension} binds changed bytes`, () => {
    const { root, options } = markupPromotionFixture(source, { extension });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.bin.*differs from evidence Commit/u
    );
  });

for (const [extension, source] of [
  ['md', '```html\n<style>.a{background:url("/missing.bin")}</style>\n```'],
  ['md', '`<style>.a{background:url("/missing.bin")}</style>`'],
  ['mdx', '```mdx\n<style>{".a{background:url(/missing.bin)}"}</style>\n```'],
  ['mdx', '`<style>{".a{background:url(/missing.bin)}"}</style>`'],
  ['mdx', 'export const css="<style>.a{background:url(/missing.bin)}</style>";\n\nText'],
  ['mdx', '{"<style>.a{background:url(/missing.bin)}</style>"}'],
  ['md', '<!-- <style>.a{background:url(/missing.bin)}</style> -->'],
  ['mdx', '<pre>`<img src="/missing.bin"/>`</pre>'],
  ['md', '\\<img src="/missing.bin">'],
])
  test(`raw Markdown inert boundary: ${extension} ${source}`, () => {
    const { options } = markupPromotionFixture(source, { extension });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const source of [
  '<style>{stylesheet}</style>',
  '<style children={stylesheet}/>',
  '<style>{`.a{background:url(${resource})}`}</style>',
  'export const Dynamic=()=> <style>{stylesheet}</style>;',
])
  test(`raw Markdown dynamic style boundary: ${source}`, () => {
    const { root, options } = markupPromotionFixture(source, { extension: 'mdx' });
    assert.match(validationMessage(root, options), /promotion CSS resource URL.*unverified/u);
  });

test('raw Markdown inline style text keeps the rendered CSS resource', () => {
  const { root, options } = markupPromotionFixture(
    'Text <style>.a{background:url("/surface.bin")}</style>',
    { extension: 'md' }
  );
  assert.doesNotThrow(() => validateCoverageMatrices(options));
  fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
  assert.match(
    validationMessage(root, options),
    /promoted dependency.*surface\.bin.*differs from evidence Commit/u
  );
});

test('raw Markdown indentation boundary follows the actual format parser', () => {
  const source = '    <button>Indented example</button>';
  assert.equal(createMarkdownProcessor({ format: 'md' }).parse(source).children[0].type, 'code');
  const mdx = createMarkdownProcessor({ format: 'mdx' }).parse(source);
  assert.equal(mdx.children[0].type, 'paragraph');
  assert.equal(mdx.children[0].children[0].type, 'mdxJsxTextElement');
  assert.equal(mdx.children[0].children[0].name, 'button');
  for (const [extension, interactive] of [
    ['md', false],
    ['mdx', true],
  ])
    assert.equal(
      probeReview('raw-indentation', 'website', source, extension, false).some((issue) =>
        /interactive website source.*not bound/u.test(issue)
      ),
      interactive
    );
});

for (const kind of ['website', 'harness']) {
  test(`bounded entry review: Vue directive import ${kind}`, () => {
    assert.ok(
      probeReview(
        '4178643496',
        kind,
        `<template><button @click="import('https://cdn.example/runtime.js')">Run</button></template>`,
        'vue'
      ).some((issue) => /unverified|external.*(?:module|script)|consumer.wall/u.test(issue))
    );
  });
  test(`bounded entry review: DOM HTML sink ${kind}`, () => {
    assert.ok(
      probeReview(
        '4178643498',
        kind,
        `document.write('<script src="https://cdn.example/runtime.js"></script>');`
      ).some((issue) => /unverified|dynamic executable script/u.test(issue))
    );
  });
  test(`bounded entry review: CSS escaped import ${kind}`, () => {
    assert.ok(
      probeReview(
        '4178643502',
        kind,
        String.raw`@import "h\74tps://cdn.example/theme.css";`,
        'css'
      ).some((issue) => /external stylesheet|consumer.wall/u.test(issue))
    );
  });
}
test('bounded entry review: scheduled member Agent callback', () => {
  assert.ok(
    probeReview(
      '4178643504',
      'harness',
      `import * as actions from './agent-actions'; export function Surface() { queueMicrotask(actions.send); return <section/>; }`,
      'tsx'
    ).some((issue) => /forbidden interaction/u.test(issue))
  );
});
test('bounded entry review: inline style changed asset', () => {
  const { root, options } = markupPromotionFixture(
    `<div style="background-image:url('/surface.bin')"></div>`
  );
  assert.doesNotThrow(() => validateCoverageMatrices(options));
  fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
  assert.match(
    validationMessage(root, options),
    /promoted dependency.*surface\.bin.*differs from evidence Commit/u
  );
});
test('bounded entry review: shorthand Vite alias', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'apps/www/astro.config.mjs'),
    `const alias = { rawRuntime: '../../packages/runtime/src' }; export default { vite: { resolve: { alias } } };`
  );
  const runtime = path.join(root, 'packages/runtime/src/index.ts');
  fs.mkdirSync(path.dirname(runtime), { recursive: true });
  fs.writeFileSync(runtime, 'export const runtime = true;');
  const source = path.join(root, 'apps/www/src/components/ShorthandAlias.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, `import { runtime } from 'rawRuntime';`);
  assert.match(
    validationMessage(root),
    /(?:raw Proto UI import|unverified.*alias|alias.*unverified)/u
  );
});

for (const kind of ['website', 'harness']) {
  for (const [name, markup, reject] of [
    [
      'longhand modifier',
      `<button v-on:click.prevent="import('https://cdn.example/runtime.js')"/>`,
      true,
    ],
    ['component handler', `<Widget @activate="import('https://cdn.example/runtime.js')"/>`, true],
    ['bound expression', `<div :title="import('https://cdn.example/runtime.js')"/>`, true],
    [
      'object directive',
      `<button v-on="{click: () => import('https://cdn.example/runtime.js')}"/>`,
      true,
    ],
    ['dynamic import', `<button @click="import(target)"/>`, true],
    ['dynamic argument', `<button @[event]="run"/>`, true],
    [
      'encoded expression',
      `<button @click="&#105;mport('https://cdn.example/runtime.js')"/>`,
      true,
    ],
    ['HTML directive', `<div v-html="content"/>`, true],
    ['malformed expression', `<button @click="import("/>`, true],
    ['ordinary callback', `<button @click="count++"/>`, false],
    ['ordinary bound expression', `<div :title="description"/>`, false],
    [
      'v-pre example',
      `<section v-pre><button @click="import('https://cdn.example/runtime.js')"/></section>`,
      false,
    ],
    [
      'comment example',
      `<!-- <button @click="import('https://cdn.example/runtime.js')"/> -->`,
      false,
    ],
    [
      'inert attribute string',
      `<div title="@click=import('https://cdn.example/runtime.js')"/>`,
      false,
    ],
  ])
    test(`bounded parser controls: ${kind} Vue ${name}`, () => {
      const issues = probeReview('4178643496', kind, `<template>${markup}</template>`, 'vue');
      assert.equal(
        issues.some((issue) =>
          /(?:markup event handler|DOM HTML sink).*unverified|unverified markup event handler/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
    });

  for (const [name, source, reject] of [
    [
      'qualified writeln',
      `window.document.writeln('<img src=x onerror="import(\'https://cdn.example/runtime.js\')">');`,
      true,
    ],
    ['bracket write', `globalThis.document['write'](markup);`, true],
    ['document alias', `const page=document;page.write(markup);`, true],
    [
      'acquired element',
      `document.querySelector('#root').insertAdjacentHTML('beforeend',markup);`,
      true,
    ],
    [
      'element alias',
      `const target=document.getElementById('root');target.insertAdjacentHTML('beforeend',markup);`,
      true,
    ],
    ['shadowed document', `function f(document){document.write(markup);}`, false],
    ['qualified shadow', `function f(window){window.document.writeln(markup);}`, false],
    [
      'business object',
      `const target={insertAdjacentHTML(){}};target.insertAdjacentHTML('beforeend',markup);`,
      false,
    ],
    ['method name string', `const description="document.write(markup)";`, false],
    ['inert text insertion', `document.body.insertAdjacentText('beforeend',markup);`, false],
    ['empty writer', `document.write();`, false],
  ])
    test(`bounded parser controls: ${kind} HTML sink ${name}`, () => {
      const issues = probeReview('4178643498', kind, source);
      assert.equal(
        issues.some((issue) => /DOM HTML sink.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
    });

  for (const [name, css, reject] of [
    ['hex terminator', String.raw`@import "\68 ttps://cdn.example/theme.css";`, true],
    ['six digits', String.raw`@import "\000068ttps://cdn.example/theme.css";`, true],
    ['escaped slash', String.raw`@import "\2f\2f cdn.example/theme.css";`, true],
    ['URL token', String.raw`@import url(\68 ttps://cdn.example/theme.css);`, true],
    ['URL function name', String.raw`@import u\72l("h\74tps://cdn.example/theme.css");`, true],
    ['directive name', String.raw`@\69mport "h\74tps://cdn.example/theme.css";`, true],
    [
      'multiple imports',
      String.raw`@import "./local.css", "h\74tps://cdn.example/theme.css";`,
      true,
    ],
    [
      'quoted content',
      String.raw`.a { content:'@import "h\74tps://cdn.example/theme.css";'; }`,
      false,
    ],
    ['comment example', String.raw`/* @import "h\74tps://cdn.example/theme.css"; */`, false],
    [
      'escaped at in content',
      String.raw`.a { content:"\40 import 'https://cdn.example/theme.css'"; }`,
      false,
    ],
  ])
    for (const extension of ['css', 'vue'])
      test(`bounded resource controls: ${kind} CSS ${name} ${extension}`, () => {
        const source =
          extension === 'vue' ? `<template><div/></template><style>${css}</style>` : css;
        const issues = probeReview('4178643502', kind, source, extension);
        assert.equal(
          issues.some((issue) =>
            /external stylesheet|external.*(?:module|script)|consumer.wall/u.test(issue)
          ),
          reject,
          issues.join('\n')
        );
      });
}

for (const scheduler of [
  'queueMicrotask',
  'window.requestAnimationFrame',
  'globalThis.requestIdleCallback',
  'Promise.resolve().then',
  'Promise.resolve().catch',
  'Promise.resolve().finally',
])
  for (const phase of ['render', 'effect'])
    test(`bounded execution controls: ${scheduler} ${phase} member action`, () => {
      const statement = `${scheduler}(actions['send']);`;
      const source = `import {useEffect} from 'react';import * as actions from './agent-actions';export function Surface(){${phase === 'effect' ? `useEffect(()=>{${statement}},[]);` : statement}return <section/>;}`;
      assert.ok(
        probeReview('4178643504', 'harness', source, 'tsx').some((issue) =>
          /forbidden interaction/u.test(issue)
        )
      );
    });
for (const [name, body] of [
  ['deferred handler', `return <ProtoButton onPress={()=>queueMicrotask(actions.send)}/>;`],
  [
    'business callback',
    `const business={send(){}};queueMicrotask(business.send);return <section/>;`,
  ],
  ['ordinary callback', `queueMicrotask(()=>console.log('ready'));return <section/>;`],
])
  test(`bounded execution controls: ${name} stays allowed`, () => {
    const source = `import * as actions from './agent-actions';export function Surface(){${body}}`;
    assert.ok(
      !probeReview('4178643504', 'harness', source, 'tsx').some((issue) =>
        /forbidden interaction/u.test(issue)
      )
    );
  });

for (const [name, extension, source] of [
  ['HTML attribute', 'html', `<div style="background:url('/surface.bin')"></div>`],
  ['raw Markdown HTML', 'md', `<div style="background:url('/surface.bin')">\nraw \`code\`\n</div>`],
  [
    'inline Markdown HTML',
    'md',
    `Text <span style="background:url('/surface.bin')">surface</span>`,
  ],
  ['MDX attribute', 'mdx', `<div style="background:url('/surface.bin')"/>`],
  ['MDX literal expression', 'mdx', `<div style={"background:url('/surface.bin')"}/>`],
  ['Vue attribute', 'vue', `<template><div style="background:url('/surface.bin')"/></template>`],
  ['Svelte attribute', 'svelte', `<div style="background:url('/surface.bin')"/>`],
  [
    'JSX literal expression',
    'tsx',
    `export const Surface=()=> <div style={"background:url('/surface.bin')"}/>;`,
  ],
  [
    'escaped CSS attribute',
    'astro',
    String.raw`<div style="background:u\72l('/surf\61 ce.bin')"/>`,
  ],
])
  test(`bounded resource controls: inline style ${name} binds asset bytes`, () => {
    const { root, options } = markupPromotionFixture(source, { extension });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.bin.*differs from evidence Commit/u
    );
  });
for (const [name, extension, source] of [
  ['encoded style', 'html', `<div style="background:url(&quot;/surface.bin&quot;)"></div>`],
  ['dynamic style', 'astro', `<div style={style}/>`],
  ['opaque JSX object', 'tsx', `export const Surface=()=> <div style={styles}/>;`],
  ['Vue bound style', 'vue', `<template><div :style="styles"/></template>`],
  [
    'Vue spread obscured style',
    'vue',
    `<template><div style="background:url('/surface.bin')" v-bind="attrs"/></template>`,
  ],
  [
    'Vue duplicate style',
    'vue',
    `<template><div style="color:red" style="background:url('/surface.bin')"/></template>`,
  ],
  [
    'Vue encoded style',
    'vue',
    `<template><div style="background:url(&quot;/surface.bin&quot;)"/></template>`,
  ],
  [
    'external CSS URL',
    'html',
    `<div style="background:url(https://cdn.example/surface.bin)"></div>`,
  ],
])
  test(`bounded resource controls: inline style ${name} stays unverified`, () => {
    const { root, options } = markupPromotionFixture(source, { extension });
    assert.match(validationMessage(root, options), /promotion CSS resource.*unverified/u);
  });
for (const [name, extension, source] of [
  ['Markdown code', 'md', '```html\n<div style="background:url(/surface.bin)"></div>\n```'],
  ['Markdown inline code', 'md', '`<div style="background:url(/surface.bin)"></div>`'],
  ['MDX string', 'mdx', '{\'<div style="background:url(/surface.bin)"></div>\'}'],
  ['HTML comment', 'html', '<!-- <div style="background:url(/surface.bin)"></div> -->'],
  [
    'JS string',
    'tsx',
    'export const description=\'<div style="background:url(/surface.bin)"></div>\';',
  ],
])
  test(`bounded resource controls: inline style ${name} is inert`, () => {
    const { root, options } = markupPromotionFixture(source, { extension });
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const [name, config, reject] of [
  [
    'shorthand',
    `const alias={rawRuntime:'../../packages/runtime/src'}; export default {vite:{resolve:{alias}}};`,
    true,
  ],
  ['getter', `export default {vite:{resolve:{get alias(){return aliases;}}}};`, true],
  [
    'spread entries',
    `const aliases={rawRuntime:'../../packages/runtime/src'}; export default {vite:{resolve:{alias:{...aliases}}}};`,
    true,
  ],
  [
    'shorthand entry',
    `const rawRuntime='../../packages/runtime/src';export default {vite:{resolve:{alias:{rawRuntime}}}};`,
    true,
  ],
  ['dynamic alias', `export default {vite:{resolve:{alias:aliases}}};`, true],
  [
    'ordinary static alias',
    `export default {vite:{resolve:{alias:{rawRuntime:'./src/safe'}}}};`,
    false,
  ],
  [
    'unused alias variable',
    `const alias={rawRuntime:'../../packages/runtime/src'};export default {};`,
    false,
  ],
])
  test(`bounded resource controls: Vite alias ${name}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
    for (const relative of ['packages/runtime/src/index.ts', 'apps/www/src/safe/index.ts']) {
      const absolute = path.join(root, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, 'export const value=true;');
    }
    const source = path.join(root, 'apps/www/src/components/AliasProbe.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, `import {value} from 'rawRuntime';`);
    const issues = collectCoverageMatrixIssues({ rootDir: root });
    assert.equal(
      issues.some((issue) =>
        /raw Proto UI import|alias.*unverified|unverified.*alias/u.test(issue)
      ),
      reject,
      issues.join('\n')
    );
  });

// Independent review of the bounded template patch: real Vue/CSS parser
// semantics, retained byte transitions, and base/candidate false-positive controls.
for (const css of [
  '@import"https://cdn.example/theme.css";',
  '@import/**/url("https://cdn.example/theme.css");',
  String.raw`@\69mport"h\74tps://cdn.example/theme.css";`,
  String.raw`@\69mport/**/u\72l("h\74tps://cdn.example/theme.css");`,
])
  for (const kind of ['website', 'harness']) {
    test(`bounded followup review: CSS token boundary ${kind} ${css}`, () => {
      const issues = probeReview('followup', kind, css, 'css');
      assert.ok(
        issues.some((issue) => /external stylesheet|consumer.wall/u.test(issue)),
        issues.join('\n')
      );
    });
  }
for (const [name, markup, rejected] of [
  [
    'self-closing v-pre siblings',
    `<span v-pre/><button @click="import('https://cdn.example/runtime.js')"/>`,
    true,
  ],
  [
    'native handler under v-pre',
    `<section v-pre><button onclick="import('https://cdn.example/runtime.js')">Go</button></section>`,
    true,
  ],
  [
    'inert directive under v-pre',
    `<section v-pre><button @click="import('https://cdn.example/runtime.js')">Go</button></section>`,
    false,
  ],
])
  for (const kind of ['website', 'harness']) {
    test(`bounded followup review: Vue ${kind} ${name}`, () => {
      const issues = probeReview('followup', kind, `<template>${markup}</template>`, 'vue');
      assert.equal(
        issues.some((issue) =>
          /unverified markup event handler|DOM HTML sink.*unverified/u.test(issue)
        ),
        rejected,
        issues.join('\n')
      );
    });
  }
for (const [name, markup] of [
  [
    'td',
    '<template><table><tr><td style="background:url(/surface.bin)">x</td></tr></table></template>',
  ],
  [
    'tr',
    '<template><table><tr style="background:url(/surface.bin)"><td>x</td></tr></table></template>',
  ],
  [
    'col',
    '<template><table><colgroup><col style="background:url(/surface.bin)"></colgroup></table></template>',
  ],
  [
    'style modifier',
    `<template><div v-bind:style.camel="{backgroundImage:'url(/surface.bin)'}"/></template>`,
  ],
]) {
  test(`bounded followup review: Vue ${name} retains asset closure`, () => {
    const { root, options } = markupPromotionFixture(markup, { extension: 'vue' });
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    let issues;
    try {
      issues = collectCoverageMatrixIssues(options);
    } catch (error) {
      issues = [error.message];
    }
    assert.ok(
      issues.some((issue) =>
        /promotion CSS resource.*unverified|promoted dependency.*surface\.bin.*differs/u.test(issue)
      ),
      issues.join('\n')
    );
  });
}
for (const [name, config] of [
  [
    'business shorthand',
    `const alias={rawRuntime:'../../packages/runtime/src'};const business={alias};export default {}`,
  ],
  ['business method', `const business={alias(){return {}}};export default {}`],
  [
    'uncalled local object',
    `function unused(){const alias={rawRuntime:'../../packages/runtime/src'};return {alias}};export default {}`,
  ],
]) {
  test(`bounded followup review: ignore ${name} outside exported config`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    fs.writeFileSync(path.join(root, 'apps/www/astro.config.mjs'), config);
    const source = path.join(root, 'apps/www/src/components/Alias.ts');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, `import {value} from 'ordinary-business-package';`);
    const issues = collectCoverageMatrixIssues({ rootDir: root });
    assert.equal(
      issues.some((issue) =>
        /raw Proto UI import|alias.*unverified|unverified.*alias/u.test(issue)
      ),
      false,
      issues.join('\n')
    );
  });
}
test('bounded followup review: scheduler respects a local business namespace shadow', () => {
  const issues = probeReview(
    'followup',
    'harness',
    `import * as actions from './agent-actions';export function Surface(){const actions={send(){}};Promise.resolve().then(actions.send);return <section/>;}`,
    'tsx'
  );
  assert.equal(
    issues.some((issue) => /forbidden interaction/u.test(issue)),
    false,
    issues.join('\n')
  );
});

test('bounded followup review: Vue v-pre style directive is inert', () => {
  const { root, options } = markupPromotionFixture(
    `<template><div v-pre :style="{backgroundImage:'url(/surface.bin)'}"/></template>`,
    { extension: 'vue' }
  );
  fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
  assert.equal(
    collectCoverageMatrixIssues(options).some((issue) =>
      /surface\.bin.*differs|CSS resource.*unverified/u.test(issue)
    ),
    false
  );
});

test('bounded followup review: actual alias array entry overriding spread is opaque', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'apps/www/astro.config.mjs'),
    `export default {vite:{resolve:{alias:[{find:'rawRuntime',replacement:'./src/safe',...aliases}]}}}`
  );
  const source = path.join(root, 'apps/www/src/components/Alias.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, `import {value} from 'rawRuntime';`);
  const issues = collectCoverageMatrixIssues({ rootDir: root });
  assert.ok(
    issues.some((issue) => /raw Proto UI import|alias.*unverified|unverified.*alias/u.test(issue)),
    issues.join('\n')
  );
});

for (const [name, body, rejected] of [
  ['real destructured import', 'const {send}=actions;queueMicrotask(send);', true],
  ['renamed destructured import', 'const {send:run}=actions;queueMicrotask(run);', true],
  [
    'shadowed destructured business',
    'const actions={send(){}};const {send}=actions;queueMicrotask(send);',
    false,
  ],
  ['ordinary action alias', 'const run=actions.send;queueMicrotask(run);', true],
]) {
  test(`bounded followup review: scheduler ${name}`, () => {
    const issues = probeReview(
      'followup',
      'harness',
      `import * as actions from './agent-actions';export function Surface(){${body}return <section/>;}`,
      'tsx'
    );
    assert.equal(
      issues.some((issue) => /forbidden interaction/u.test(issue)),
      rejected,
      issues.join('\n')
    );
  });
}

for (const [name, body, rejected] of [
  ['var member function scope', '{var actions={send(){}};}queueMicrotask(actions.send);', false],
  ['var destructuring function scope', '{var {send}={send(){}};}queueMicrotask(send);', false],
  ['block const stays local', '{const actions={send(){}};}queueMicrotask(actions.send);', true],
  [
    'catch binding stays inside catch',
    'try{throw {send(){}};}catch(actions){queueMicrotask(actions.send);}',
    false,
  ],
  [
    'catch binding does not hide outside import',
    'try{throw {send(){}};}catch(actions){}queueMicrotask(actions.send);',
    true,
  ],
  [
    'unrelated block var does not hide imported owner',
    '{var localActions=actions;}queueMicrotask(actions.send);',
    true,
  ],
  ['var retains destructured imported action', '{var {send}=actions;}queueMicrotask(send);', true],
]) {
  test(`bounded followup review: scheduler ${name}`, () => {
    const issues = probeReview(
      'followup',
      'harness',
      `import * as actions from './agent-actions';export function Surface(){${body}return <section/>;}`,
      'tsx'
    );
    assert.equal(
      issues.some((issue) => /forbidden interaction/u.test(issue)),
      rejected,
      issues.join('\n')
    );
  });
}
for (const [name, source, rejected] of [
  [
    'block var DOM acquisition',
    `function render(){ {var target=document.body;} target.insertAdjacentHTML('beforeend',markup); }`,
    true,
  ],
  [
    'block var business document shadow',
    `function render(){ {var document={write(){}};} document.write(markup); }`,
    false,
  ],
]) {
  test(`bounded followup review: DOM ${name}`, () => {
    const issues = probeReview('followup', 'website', source);
    assert.equal(
      issues.some((issue) => /DOM HTML sink.*unverified/u.test(issue)),
      rejected,
      issues.join('\n')
    );
  });
}

for (const [name, body, rejected] of [
  [
    'for-of lexical head ends before next statement',
    'for(const actions of []){}queueMicrotask(actions.send);',
    true,
  ],
  [
    'for-in lexical head ends before next statement',
    'for(const actions in {}){}queueMicrotask(actions.send);',
    true,
  ],
  [
    'for lexical head ends before next statement',
    'for(let actions=0;actions<0;actions++){}queueMicrotask(actions.send);',
    true,
  ],
  [
    'for var remains function scoped',
    'for(var actions of []){}queueMicrotask(actions.send);',
    false,
  ],
  [
    'case lexical binding stays within switch',
    'switch(0){case 1:const actions={send(){}};}queueMicrotask(actions.send);',
    true,
  ],
  [
    'case business binding remains local',
    'switch(1){case 1:const actions={send(){}};queueMicrotask(actions.send);}',
    false,
  ],
]) {
  test(`bounded followup review: scheduler ${name}`, () => {
    const issues = probeReview(
      'followup',
      'harness',
      `import * as actions from './agent-actions';export function Surface(){${body}return <section/>;}`,
      'tsx'
    );
    assert.equal(
      issues.some((issue) => /forbidden interaction/u.test(issue)),
      rejected,
      issues.join('\n')
    );
  });
}
for (const [name, body] of [
  ['for-of destructuring', 'for(const {send} of []){}queueMicrotask(send);'],
  ['for lexical alias', 'for(let send=0;send<0;send++){}queueMicrotask(send);'],
]) {
  test(`bounded followup review: ${name} cannot hide the later imported action`, () => {
    const issues = probeReview(
      'followup',
      'harness',
      `import {send} from './agent-actions';export function Surface(){${body}return <section/>;}`,
      'tsx'
    );
    assert.ok(
      issues.some((issue) => /forbidden interaction/u.test(issue)),
      issues.join('\n')
    );
  });
}

// These source-bound fixtures assert the consumer-wall reason, rather than
// counting an unrelated inventory/ownership failure as a reproduced finding.
for (const kind of ['website', 'harness']) {
  for (const [id, name, source, ext, expected] of [
    [
      '9979',
      'DOM HTML properties',
      `document.body.innerHTML = '<img src=x onerror="import(\\\'https://cdn.example/runtime.js\\\')">';`,
      'ts',
      /DOM HTML sink.*unverified/u,
    ],
    [
      '9980',
      'DOM style body',
      `const style=document.createElement('style');style.textContent='@import url(https://cdn.example/theme.css)';document.head.append(style);`,
      'ts',
      /external stylesheet|unverified.*style|style.*unverified/u,
    ],
    [
      '9983',
      'imperative handler',
      `const image=document.createElement('img');image.setAttribute('onerror', "import('https://cdn.example/runtime.js')");image.src='missing.png';document.body.append(image);`,
      'ts',
      /markup event handler.*unverified|unverified markup event handler/u,
    ],
    [
      '9984',
      'complete attribute name',
      `<script data-type="application/json" src="https://cdn.example/runtime.js"></script>`,
      'html',
      /external executable (?:worker )?script/u,
    ],
    [
      '9985',
      'worker indirect call',
      `self.importScripts.call(self,'https://cdn.example/runtime.js');`,
      'ts',
      /external (?:worker|executable)|importScripts.*(?:unverified|bounded)|consumer.wall/u,
    ],
  ])
    test(`DOM entry closure red: ${id} ${kind} ${name}`, () => {
      const issues = probeReview(id, kind, source, ext);
      assert.ok(
        issues.some((issue) => expected.test(issue)),
        issues.join('\n')
      );
    });
}
for (const ext of ['md', 'mdx'])
  test(`DOM entry closure red: 9990 authored ${ext} inline script`, () => {
    const issues = probeReview(
      '9990',
      'website',
      `<script>import('https://cdn.example/runtime.js')</script>`,
      ext
    );
    assert.ok(
      issues.some((issue) =>
        /external executable script|raw Proto UI import.*https:.*consumer.wall/u.test(issue)
      ),
      issues.join('\n')
    );
  });
for (const [name, source] of [
  ['business HTML', `const state={innerHTML:''};state.innerHTML=markup;`],
  [
    'business style',
    `const style={textContent:''};style.textContent='@import url(https://cdn.example/theme.css)';`,
  ],
  [
    'business attribute',
    `const data={setAttribute(){}};data.setAttribute('onerror',"import('https://cdn.example/runtime.js')");`,
  ],
  ['empty DOM HTML', `document.body.innerHTML='';`],
  ['static inert HTML', `document.body.innerHTML='<span>Ready</span>';`],
  [
    'ordinary DOM CSS',
    `const s=document.createElement('style');s.textContent='body{color:blue}';document.head.append(s);`,
  ],
])
  test(`DOM entry closure controls: ${name}`, () => {
    const issues = probeReview('controls', 'website', source);
    assert.equal(issues.length, 0, issues.join('\n'));
  });
for (const ext of ['md', 'mdx'])
  for (const [name, source] of [
    ['fence', "```html\n<script>import('https://cdn.example/runtime.js')</script>\n```"],
    ['inline code', "`<script>import('https://cdn.example/runtime.js')</script>`"],
    [
      'inert type',
      `<script type="application/json">import('https://cdn.example/runtime.js')</script>`,
    ],
  ])
    test(`DOM entry closure controls: ${ext} ${name}`, () => {
      const issues = probeReview('controls', 'website', source, ext);
      assert.equal(issues.length, 0, issues.join('\n'));
    });

for (const kind of ['website', 'harness']) {
  for (const [name, source, rejects] of [
    ['outerHTML literal', `document.body.outerHTML='<img src=x onerror="alert(1)">';`, true],
    [
      'computed HTML property',
      `document.body['innerHTML']='<button onclick="alert(1)">Run</button>';`,
      true,
    ],
    [
      'qualified receiver alias const HTML',
      `const host=globalThis.document.body; const html='<img src=x onerror="alert(1)">'; host.innerHTML=html;`,
      true,
    ],
    [
      'local scoped const HTML',
      `function f(){const html='<a href="javascript:alert(1)">Run</a>'; document.body.innerHTML=html;}`,
      true,
    ],
    [
      'const name shadow',
      `const html='<img src=x onerror="alert(1)">'; function f(){const html='<span>Safe</span>';document.body.innerHTML=html;}`,
      false,
    ],
    [
      'Object assign literal',
      `Object.assign(document.body,{innerHTML:'<img onerror="alert(1)">'});`,
      true,
    ],
    ['Reflect literal', `Reflect.set(document.body,'outerHTML','<img onerror="alert(1)">');`, true],
    [
      'concatenated HTML mutation',
      `document.body.innerHTML='<img on';document.body.innerHTML+='error="alert(1)">';`,
      true,
    ],
    [
      'business HTML shadow',
      `function f(document){document.body.innerHTML='<img onerror="alert(1)">';}`,
      false,
    ],
    ['comment HTML example', `// document.body.innerHTML='<img onerror="alert(1)">';`, false],
    [
      'static SVG icon',
      `const icon='<svg viewBox="0 0 24 24"><path d="M1 2L3 4"/></svg>';document.body.innerHTML=icon;`,
      false,
    ],
    ['opaque dynamic HTML retained research', `document.body.innerHTML=getRemoteMarkup();`, false],
    [
      'same receiver snapshot retained research',
      `const target=document.body;const html=target.innerHTML;target.innerHTML=html;`,
      false,
    ],
  ])
    test(`DOM entry closure HTML: ${kind} ${name}`, () => {
      const issues = probeReview('9979', kind, source);
      assert.equal(
        issues.some((issue) => /DOM HTML sink.*unverified/u.test(issue)),
        rejects,
        issues.join('\n')
      );
    });
  for (const [name, source, rejects] of [
    [
      'alias escaped CSS',
      String.raw`const s=document.createElement('style');const css='@import "h\\74tps://cdn.example/theme.css";';const alias=s;alias.textContent=css;`,
      true,
    ],
    [
      'XHTML style',
      `const s=self.document.createElementNS('http://www.w3.org/1999/xhtml','style');s.innerHTML='@import "https://cdn.example/theme.css";';`,
      true,
    ],
    [
      'Object assign CSS',
      `Object.assign(document.createElement('style'),{textContent:'@import "https://cdn.example/theme.css";'});`,
      true,
    ],
    [
      'Reflect CSS',
      `const s=document.createElement('style');Reflect.set(s,'textContent','@import "https://cdn.example/theme.css";');`,
      true,
    ],
    [
      'local CSS is browser relative',
      `const s=document.createElement('style');s.textContent='@import "./theme.css";';`,
      true,
    ],
    ['opaque CSS', `const s=document.createElement('style');s.textContent=stylesheet;`, true],
    [
      'fragmented CSS',
      `const s=document.createElement('style');s.append('@im');s.append('port "https://cdn.example/theme.css";');`,
      true,
    ],
    [
      'compound CSS',
      `const s=document.createElement('style');s.textContent='@im';s.textContent+='port "https://cdn.example/theme.css";';`,
      true,
    ],
    [
      'style text is non-native data',
      `const s=document.createElement('style');s.text='@import "https://cdn.example/theme.css";';`,
      false,
    ],
    [
      'inert quoted CSS content',
      `const s=document.createElement('style');s.textContent='p:before{content:"@import url(https://cdn.example/theme.css)"}';`,
      false,
    ],
    [
      'shadowed style factory',
      `function f(document){const s=document.createElement('style');s.textContent='@import "https://cdn.example/theme.css";';}`,
      false,
    ],
  ])
    test(`DOM entry closure style: ${kind} ${name}`, () => {
      const issues = probeReview('9980', kind, source);
      assert.equal(
        issues.some((issue) => /external stylesheet|DOM style body.*unverified/u.test(issue)),
        rejects,
        issues.join('\n')
      );
    });
  for (const [name, source, rejects] of [
    ['computed method', `document.body['setAttribute']('ONCLICK','alert(1)');`, true],
    [
      'const attribute name',
      `const name='onerror';const image=document.createElement('img');image.setAttribute(name,'alert(1)');`,
      true,
    ],
    ['null namespace', `document.body.setAttributeNS(null,'onclick','alert(1)');`, true],
    ['non-null namespace', `document.body.setAttributeNS('urn:data','onclick','alert(1)');`, false],
    ['data-onclick', `document.body.setAttribute('data-onclick','alert(1)');`, false],
    [
      'unknown on-business name',
      `document.body.setAttribute('onbusinessmessage','alert(1)');`,
      false,
    ],
    ['handler string IDL assignment', `document.body.onclick='alert(1)';`, false],
    [
      'locally shadowed receiver',
      `function f(document){document.body.setAttribute('onerror','alert(1)');}`,
      false,
    ],
  ])
    test(`DOM entry closure attributes: ${kind} ${name}`, () => {
      const issues = probeReview('9983', kind, source);
      assert.equal(
        issues.some((issue) =>
          /markup event handler.*unverified|unverified markup event handler/u.test(issue)
        ),
        rejects,
        issues.join('\n')
      );
    });
  for (const [name, source, rejects] of [
    [
      'apply literal list',
      `self.importScripts.apply(self,['https://cdn.example/runtime.js']);`,
      true,
    ],
    [
      'call computed members',
      `globalThis['importScripts']['call'](globalThis,'https://cdn.example/runtime.js');`,
      true,
    ],
    [
      'direct alias invocation',
      `const load=self.importScripts;load.call(self,'https://cdn.example/runtime.js');`,
      true,
    ],
    ['opaque apply arguments', `self.importScripts.apply(self,urls);`, true],
    ['spread apply arguments', `self.importScripts.apply(self,[...urls]);`, true],
    [
      'shadowed self',
      `function f(self){self.importScripts.call(self,'https://cdn.example/runtime.js');}`,
      false,
    ],
    [
      'shadowed global function',
      `function f(importScripts){importScripts.call(self,'https://cdn.example/runtime.js');}`,
      false,
    ],
    [
      'direct global shadow',
      `const importScripts=(...args)=>args;importScripts('https://cdn.example/runtime.js');`,
      false,
    ],
    [
      'direct qualified shadow',
      `const self={importScripts(){}};self.importScripts('https://cdn.example/runtime.js');`,
      false,
    ],
    ['empty call', `self.importScripts.call(self);`, false],
    ['empty apply', `self.importScripts.apply(self,[]);`, false],
    ['null argument list', `self.importScripts.apply(self,null);`, false],
  ])
    test(`DOM entry closure worker: ${kind} ${name}`, () => {
      const issues = probeReview('9985', kind, source);
      assert.equal(
        issues.some((issue) =>
          /external executable (?:worker )?script|unresolved importScripts/u.test(issue)
        ),
        rejects,
        issues.join('\n')
      );
    });
}
for (const [name, source, rejects] of [
  [
    'script data-type collision',
    `<script data-type="application/json" src="https://cdn.example/runtime.js"></script>`,
    true,
  ],
  [
    'script quoted fake type',
    `<script title='type="application/json"' src="https://cdn.example/runtime.js"></script>`,
    true,
  ],
  [
    'link data-rel collision',
    `<link data-rel="icon" rel="stylesheet" href="https://cdn.example/theme.css">`,
    true,
  ],
  [
    'link quoted fake relation',
    `<link title='rel="icon"' rel="stylesheet" href="https://cdn.example/theme.css">`,
    true,
  ],
  ['base data-href collision', `<base data-href="/" href="https://cdn.example/">`, true],
  ['base quoted fake href', `<base title='href="/"' href="https://cdn.example/">`, true],
  ['data-src only', `<script data-src="https://cdn.example/runtime.js"></script>`, false],
  ['quoted fake src only', `<script title='src="https://cdn.example/runtime.js"'></script>`, false],
  ['data-href only', `<base data-href="https://cdn.example/">`, false],
  ['quoted fake href only', `<base title='href="https://cdn.example/"'>`, false],
  ['data-rel only', `<link data-rel="stylesheet" href="https://cdn.example/theme.css">`, false],
  [
    'quoted fake rel only',
    `<link title='rel="stylesheet"' href="https://cdn.example/theme.css">`,
    false,
  ],
  [
    'real inert script',
    `<script type="application/json" data-type="module" src="https://cdn.example/runtime.js"></script>`,
    false,
  ],
  [
    'duplicate type first inert',
    `<script type="application/json" type="module" src="https://cdn.example/runtime.js"></script>`,
    false,
  ],
  [
    'duplicate type first executable',
    `<script type="module" type="application/json" src="https://cdn.example/runtime.js"></script>`,
    true,
  ],
])
  test(`DOM entry closure markup tokens: ${name}`, () => {
    const issues = probeReview('9984', 'website', source, 'html');
    assert.equal(
      issues.some((issue) =>
        /external executable script|external stylesheet|external document base/u.test(issue)
      ),
      rejects,
      issues.join('\n')
    );
  });

for (const [name, source] of [
  ['remote expression', `document.body.innerHTML=remoteMarkup;`],
  [
    'same receiver serialization',
    `const host=document.body;const snapshot=host.innerHTML;host.innerHTML=snapshot;`,
  ],
])
  test(`DOM entry closure promotion: opaque ${name} is research, not evidence admission`, () => {
    assert.deepEqual(probeReview('opaque', 'website', source), []);
    const { root, options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.match(validationMessage(root, options), /promotion opaque DOM HTML sink.*unverified/u);
  });

for (const ext of ['md', 'mdx']) {
  for (const [name, source, reject] of [
    [
      'inline script after prose',
      `Intro <script>import('https://cdn.example/runtime.js')</script>`,
      true,
    ],
    [
      'module script',
      `<script type="module">import('https://cdn.example/runtime.js')</script>`,
      true,
    ],
    [
      'raw script backticks',
      `<script>const template = \`example\`; import('https://cdn.example/runtime.js')</script>`,
      true,
    ],
    [
      'script data-type collision',
      `<script data-type="application/json">import('https://cdn.example/runtime.js')</script>`,
      true,
    ],
    [
      'inert text',
      `<script type="application/json">import('https://cdn.example/runtime.js')</script>`,
      false,
    ],
    ['ordinary inline script', `<script>console.log('ready')</script>`, false],
    ['comment', `<!-- <script>import('https://cdn.example/runtime.js')</script> -->`, false],
    [
      'indented fence',
      `  ~~~html\n  <script>import('https://cdn.example/runtime.js')</script>\n  ~~~`,
      false,
    ],
  ])
    test(`DOM entry closure Markdown: ${ext} ${name}`, () => {
      const issues = probeReview('9990', 'website', source, ext);
      assert.equal(
        issues.some((issue) =>
          /external executable script|raw Proto UI import.*https:.*consumer.wall|dynamic executable script/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
    });
}
for (const [name, source, reject] of [
  ['static string child', `<script>{"import('https://cdn.example/runtime.js')"}</script>`, true],
  ['static template child', "<script>{`import('https://cdn.example/runtime.js')`}</script>", true],
  ['opaque child', `<script>{payload}</script>`, true],
  ['opaque content prop', `<script dangerouslySetInnerHTML={payload}/>`, true],
  [
    'data script expression executes',
    `<script type="application/json">{import('https://cdn.example/runtime.js')}</script>`,
    true,
  ],
  [
    'script attribute expression executes',
    `<script type="application/json" data-id={import('https://cdn.example/runtime.js')}>{'{}'}</script>`,
    true,
  ],
  [
    'custom JSX attribute expression executes',
    `<Widget value={import('https://cdn.example/runtime.js')}/>`,
    true,
  ],
  [
    'ESM remains executable',
    `import value from 'https://cdn.example/runtime.js';\n\n# Title`,
    true,
  ],
  [
    'ESM string is data',
    `export const example="<script>import('https://cdn.example/runtime.js')</script>";\n\n# Title`,
    false,
  ],
  [
    'valid data script literal',
    `<script type="application/json">{'{"example":"<iframe>"}'}</script>`,
    false,
  ],
  ['literal braces in code', '```js\n<script>{bad JavaScript @@@}</script>\n```', false],
])
  test(`DOM entry closure MDX structure: ${name}`, () => {
    assert.doesNotThrow(() => createMarkdownProcessor({ format: 'mdx' }).parse(source));
    const issues = probeReview('9990', 'website', source, 'mdx');
    assert.equal(
      issues.some((issue) =>
        /external executable script|raw Proto UI import.*https:.*consumer.wall|dynamic executable script/u.test(
          issue
        )
      ),
      reject,
      issues.join('\n')
    );
  });
test('DOM entry closure MDX oracle: native JSON syntax differs from authored MDX', () => {
  const raw = '<script type="application/json">{"example":"<iframe>"}</script>';
  const mdx = `<script type="application/json">{'{"example":"<iframe>"}'}</script>`;
  assert.doesNotThrow(() => createMarkdownProcessor({ format: 'md' }).parse(raw));
  assert.throws(
    () => createMarkdownProcessor({ format: 'mdx' }).parse(raw),
    /Could not parse expression/u
  );
  assert.doesNotThrow(() => createMarkdownProcessor({ format: 'mdx' }).parse(mdx));
  assert.deepEqual(probeReview('9990', 'website', raw, 'md'), []);
  assert.deepEqual(probeReview('9990', 'website', mdx, 'mdx'), []);
  assert.ok(
    probeReview('9990', 'website', raw, 'mdx').some((issue) =>
      /dynamic executable script.*must be static/u.test(issue)
    )
  );
});

for (const [name, source] of [
  [
    'style body local image',
    `const style=document.createElement('style');style.textContent='body{background:url(/surface.bin)}';`,
  ],
  [
    'HTML style block local image',
    `document.body.innerHTML='<style>body{background:url(/surface.bin)}</style>';`,
  ],
  [
    'HTML style attribute local image',
    `document.body.innerHTML='<div style="background:url(/surface.bin)"></div>';`,
  ],
  ['HTML media resource', `document.body.innerHTML='<img src="/surface.bin">';`],
  ['HTML source set', `document.body.innerHTML='<img srcset="/surface.bin 1x">';`],
  [
    'style unsupported image-set',
    `const style=document.createElement('style');style.textContent='body{background:image-set("/surface.bin" 1x)}';`,
  ],
])
  test(`DOM entry closure resource promotion: ${name} remains unverified`, () => {
    assert.deepEqual(probeReview('dom-resource', 'website', source), []);
    const { root, options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.match(validationMessage(root, options), /promotion DOM-authored resource.*unverified/u);
  });
for (const [name, source] of [
  ['static text markup', `document.body.innerHTML='<span>Ready</span>';`],
  [
    'static SVG geometry',
    `document.body.innerHTML='<svg viewBox="0 0 24 24"><path d="M1 2L3 4"/></svg>';`,
  ],
  [
    'static resource-free CSS',
    `const style=document.createElement('style');style.textContent='body{color:blue}';`,
  ],
])
  test(`DOM entry closure resource promotion: ${name} retains supported evidence`, () => {
    const { options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const kind of ['website', 'harness']) {
  for (const [name, source] of [
    [
      'table row',
      `const table=document.querySelector('table');table.innerHTML='<tr onclick="alert(1)"><td>Cell</td></tr>';`,
    ],
    [
      'row cell',
      `const row=document.querySelector('tr');row.innerHTML='<td onclick="alert(1)">Cell</td>';`,
    ],
    [
      'table body',
      `const table=document.querySelector('table');table.innerHTML='<tbody onclick="alert(1)"><tr><td>Cell</td></tr></tbody>';`,
    ],
    [
      'script outer replacement',
      `const s=document.createElement('script');document.body.append(s);s.outerHTML='<img src=x onerror="alert(1)">';`,
    ],
    [
      'style outer replacement',
      `const s=document.createElement('style');document.body.append(s);s.outerHTML='<img src=x onerror="alert(1)">';`,
    ],
    [
      'reflected script outer replacement',
      `const s=document.createElement('script');Reflect.set(s,'outerHTML','<img onerror="alert(1)">');`,
    ],
    [
      'assigned script outer replacement',
      `const s=document.createElement('script');Object.assign(s,{outerHTML:'<img onerror="alert(1)">'});`,
    ],
    [
      'Reflect constant property',
      `const key='innerHTML';Reflect.set(document.body,key,'<img onerror="alert(1)">');`,
    ],
    [
      'assign constant property',
      `const key='innerHTML';Object.assign(document.body,{[key]:'<img onerror="alert(1)">'});`,
    ],
    [
      'direct constant property',
      `const key='innerHTML';document.body[key]='<img onerror="alert(1)">';`,
    ],
    [
      'body wrapper attributes',
      `document.documentElement.innerHTML='<body onclick="alert(1)">Body</body>';`,
    ],
  ])
    test(`DOM entry repair source: ${kind} ${name}`, () => {
      const issues = probeReview('independent', kind, source);
      assert.ok(
        issues.some((issue) => /DOM HTML sink.*unverified/u.test(issue)),
        issues.join('\n')
      );
    });
  for (const [name, source, reject] of [
    ['ordinary uppercase HTML', `document.body.setAttribute('ONCLICK','alert(1)');`, true],
    ['NS uppercase HTML', `document.body.setAttributeNS(null,'ONCLICK','alert(1)');`, false],
    ['NS mixed-case HTML', `document.body.setAttributeNS('','onClick','alert(1)');`, false],
    ['NS lowercase HTML', `document.body.setAttributeNS(null,'onclick','alert(1)');`, true],
    [
      'NS empty namespace lowercase',
      `document.body.setAttributeNS('','onclick','alert(1)');`,
      true,
    ],
    [
      'NS non-null lowercase',
      `document.body.setAttributeNS('urn:business','onclick','alert(1)');`,
      false,
    ],
    [
      'ordinary uppercase SVG',
      `const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('ONCLICK','alert(1)');`,
      false,
    ],
    [
      'ordinary lowercase SVG',
      `const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('onclick','alert(1)');`,
      true,
    ],
  ])
    test(`DOM entry repair namespace: ${kind} ${name}`, () => {
      const issues = probeReview('independent', kind, source);
      assert.equal(
        issues.some((issue) => /unverified markup event handler/u.test(issue)),
        reject,
        issues.join('\n')
      );
    });
}
for (const [name, source] of [
  [
    'table cell CSS',
    `const row=document.querySelector('tr');row.innerHTML='<td style="background:url(/surface.bin)">Cell</td>';`,
  ],
  [
    'table row CSS',
    `const table=document.querySelector('table');table.innerHTML='<tr style="background:url(/surface.bin)"><td>Cell</td></tr>';`,
  ],
  [
    'script outer media',
    `const s=document.createElement('script');document.body.append(s);s.outerHTML='<img src="/surface.bin">';`,
  ],
  [
    'style outer media',
    `const s=document.createElement('style');document.body.append(s);s.outerHTML='<img src="/surface.bin">';`,
  ],
])
  test(`DOM entry repair promotion resource: ${name}`, () => {
    const { root, options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.match(validationMessage(root, options), /promotion DOM-authored resource.*unverified/u);
    fs.writeFileSync(path.join(root, 'apps/www/public/surface.bin'), Buffer.from([0, 129, 255]));
    assert.match(validationMessage(root, options), /promotion DOM-authored resource.*unverified/u);
  });
for (const [name, source] of [
  ['assign spread', `Object.assign(document.body,{...attrs});`],
  ['assign unknown object', `Object.assign(document.body,attrs);`],
  ['assign unknown property', `Object.assign(document.body,{[key]:value});`],
  ['Reflect unknown property', `Reflect.set(document.body,key,value);`],
  ['direct unknown property', `document.body[key]=value;`],
  [
    'literal spread remains opaque',
    `Object.assign(document.body,{...{innerHTML:'<img src="/surface.bin">'}});`,
  ],
])
  test(`DOM entry repair promotion unknown: ${name}`, () => {
    assert.deepEqual(probeReview('independent', 'website', source), []);
    const { root, options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.match(validationMessage(root, options), /promotion opaque DOM HTML sink.*unverified/u);
  });
for (const [name, source] of [
  [
    'static table',
    `const table=document.querySelector('table');table.innerHTML='<tr><td>Cell</td></tr>';`,
  ],
  [
    'static SVG icon',
    `document.body.innerHTML='<svg viewBox="0 0 24 24"><path d="M1 2L3 4"/></svg>';`,
  ],
  ['business assign', `const state={};Object.assign(state,{...attrs});`],
  ['business Reflect', `const state={};Reflect.set(state,key,value);`],
  ['business computed assignment', `const state={};state[key]=value;`],
  [
    'constant key inert markup',
    `const key='innerHTML';Reflect.set(document.body,key,'<span>Safe</span>');`,
  ],
])
  test(`DOM entry repair controls: ${name}`, () => {
    const { options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

test('DOM entry repair parser oracle: fragment and document views preserve distinct attributes', () => {
  const collect = (node) => [
    node,
    ...(node.childNodes ?? []).flatMap(collect),
    ...(node.content ? collect(node.content) : []),
  ];
  const row = '<tr onclick="alert(1)"><td style="background:url(/surface.bin)">Cell</td></tr>';
  assert.equal(
    collect(parseHtml(row)).some((node) => node.tagName === 'tr'),
    false
  );
  assert.ok(
    collect(parseHtmlFragment(row)).some(
      (node) =>
        node.tagName === 'tr' && node.attrs.some((attribute) => attribute.name === 'onclick')
    )
  );
  assert.ok(
    collect(parseHtmlFragment(row)).some(
      (node) => node.tagName === 'td' && node.attrs.some((attribute) => attribute.name === 'style')
    )
  );
  const wrapper = '<html><body onclick="alert(1)">Body</body></html>';
  assert.equal(
    collect(parseHtmlFragment(wrapper)).some((node) => node.tagName === 'body'),
    false
  );
  assert.ok(
    collect(parseHtml(wrapper)).some(
      (node) =>
        node.tagName === 'body' && node.attrs.some((attribute) => attribute.name === 'onclick')
    )
  );
  const rawText = defaultTreeAdapter.createElement('textarea', 'http://www.w3.org/1999/xhtml', []);
  assert.equal(
    collect(parseHtmlFragment(rawText, row)).some((node) => node.tagName === 'tr'),
    false
  );
  const svg = '<svg viewBox="0 0 24 24"><path d="M1 2L3 4"/></svg>';
  assert.ok(
    collect(parseHtmlFragment(svg)).some(
      (node) => node.tagName === 'path' && node.namespaceURI === 'http://www.w3.org/2000/svg'
    )
  );
});

for (const source of [
  `const refs:Record<string,HTMLElement>={};refs[key]=document.body;`,
  `const refs:Record<string,HTMLElement>={};const alias=refs;Object.assign(alias,{...values});`,
  `const refs:Map<string,HTMLElement>=new Map();Reflect.set(refs,key,value);`,
])
  test(`DOM entry repair container controls: ${source}`, () => {
    const { options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const source of [
  `const refs:HTMLElement[]=[];Object.assign(refs,attrs);`,
  `function update(wrapper:CustomWrapper<HTMLElement>){Reflect.set(wrapper,key,value);}`,
])
  test(`DOM entry repair container controls: ${source}`, () => {
    const { options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });
for (const source of [
  `const element:HTMLElement=document.body;Object.assign(element,attrs);`,
  `const element:HTMLElement & {owned:true}=document.body as any;const alias=element;Reflect.set(alias,key,value);`,
])
  test(`DOM entry repair actual element controls: ${source}`, () => {
    const { root, options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.match(validationMessage(root, options), /promotion opaque DOM HTML sink.*unverified/u);
  });

for (const source of [
  `const cells:Record<string,HTMLElement>={};cells.innerHTML=document.body;`,
  `const cells:Record<string,HTMLElement|string>={};cells.innerHTML='<img onerror="alert(1)">';`,
  `const cells:Record<string,HTMLElement|string>={};cells.innerHTML+='<img onerror="alert(1)">';`,
  `const state:{element:HTMLElement;setAttribute(name:string,value:string):void}={element:document.body,setAttribute(){}};state.setAttribute('onclick','alert(1)');`,
])
  test(`DOM entry repair shared container controls: ${source}`, () => {
    const { options } = markupPromotionFixture(source, { extension: 'ts' });
    assert.doesNotThrow(() => validateCoverageMatrices(options));
  });

for (const kind of ['website', 'harness']) {
  for (const attribute of ['href', 'xlink:href']) {
    test(`runtime entry review red: SVG ${kind} ${attribute}`, () => {
      const issues = probeReview(
        '48645',
        kind,
        `<svg><script ${attribute}="https://cdn.example/runtime.js"></script></svg>`,
        'html'
      );
      assert.ok(
        issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
        issues.join('\n')
      );
    });
  }
  test(`runtime entry review red: WASM ${kind} streaming`, () => {
    const issues = probeReview(
      '48651',
      kind,
      `WebAssembly.instantiateStreaming(fetch('https://cdn.example/runtime.wasm'), imports);`
    );
    assert.ok(
      issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
      issues.join('\n')
    );
  });
  test(`runtime entry review control: WASM ${kind} shadow`, () => {
    const issues = probeReview(
      '48651',
      kind,
      `function run(WebAssembly){WebAssembly.instantiateStreaming(fetch('https://cdn.example/runtime.wasm'), imports);}`
    );
    assert.equal(issues.length, 0, issues.join('\n'));
  });
  test(`runtime entry review control: SVG ${kind} geometry`, () => {
    const issues = probeReview('48645', kind, `<svg><path d="M0 0 L4 4" /></svg>`, 'html');
    assert.equal(issues.length, 0, issues.join('\n'));
  });
}
for (const linked of [true, false]) {
  test(`runtime entry review ${linked ? 'red' : 'control'}: promotion retargeted module link`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const directory = path.dirname(path.join(root, implementationPath));
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `---\nimport './helper.test.ts';\n---\n<main>Search</main>`
    );
    fs.writeFileSync(path.join(directory, 'old.test.ts'), 'export const answer=1;');
    fs.writeFileSync(path.join(directory, 'new.test.ts'), 'export const answer=2;');
    const link = path.join(directory, 'helper.test.ts');
    if (linked) fs.symlinkSync('old.test.ts', link);
    else fs.writeFileSync(link, 'export const answer=1;');
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    if (linked) {
      fs.unlinkSync(link);
      fs.symlinkSync('new.test.ts', link);
      assert.match(
        validationMessage(root, promotionOptions(revision)),
        /promotion module.*symlink.*unverified/u
      );
    } else
      assert.doesNotThrow(() =>
        validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
      );
  });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    ['compile bytes', 'WebAssembly.compile(bytes);', true],
    ['compile streaming', 'WebAssembly.compileStreaming(response);', true],
    ['instantiate bytes', 'WebAssembly.instantiate(bytes, imports);', true],
    ['qualified window', 'window.WebAssembly.instantiate(bytes, imports);', true],
    ['qualified self', "self['WebAssembly']['compileStreaming'](response);", true],
    ['qualified global', 'globalThis.WebAssembly.instantiateStreaming(response, imports);', true],
    ['method alias', 'const compile=WebAssembly.compile;compile(bytes);', true],
    ['namespace alias', 'const wasm=globalThis.WebAssembly;wasm.compile(bytes);', true],
    ['call', 'WebAssembly.instantiate.call(null,bytes,imports);', true],
    ['apply', 'WebAssembly.compile.apply(null,[bytes]);', true],
    ['Reflect apply', 'Reflect.apply(WebAssembly.compile,null,[bytes]);', true],
    ['Module constructor', 'new WebAssembly.Module(bytes);', true],
    ['Instance constructor', 'new window.WebAssembly.Instance(module, imports);', true],
    ['shadow namespace', 'const WebAssembly={compile(){}};WebAssembly.compile(bytes);', false],
    ['shadow qualified', 'function run(window){window.WebAssembly.compile(bytes);}', false],
    [
      'business member',
      'const engine={WebAssembly:{compile(){}}};engine.WebAssembly.compile(bytes);',
      false,
    ],
    [
      'business method alias',
      'const engine={compile(){}};const compile=engine.compile;compile(bytes);',
      false,
    ],
    ['Memory', 'new WebAssembly.Memory({initial:1});', false],
    ['Table', "new WebAssembly.Table({initial:1,element:'anyfunc'});", false],
    ['validate', 'WebAssembly.validate(bytes);', false],
    ['feature test', "typeof WebAssembly.instantiateStreaming === 'function';", false],
    ['type declaration', 'type Compiled=WebAssembly.Module;', false],
  ])
    test(`runtime entry review WASM boundaries: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-boundary', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}
for (const ext of ['html', 'astro', 'md', 'mdx', 'vue', 'svelte', 'tsx']) {
  for (const [name, markup, reject] of [
    ['href', '<svg><script href="https://cdn.example/runtime.js"></script></svg>', true],
    ['legacy', '<svg><script xlink:href="https://cdn.example/runtime.js"></script></svg>', true],
    [
      'href priority',
      '<svg><script href="./local.js" xlink:href="https://cdn.example/runtime.js"></script></svg>',
      false,
    ],
    ['empty href priority', '<svg><script href="" xlink:href="./local.js"></script></svg>', true],
    ['dynamic href', '<svg><script href={source} xlink:href="./local.js"></script></svg>', true],
    [
      'JSON type',
      '<svg><script type="application/json" href="https://cdn.example/runtime.js"></script></svg>',
      false,
    ],
    ['HTML href inert', '<script href="https://cdn.example/runtime.js"></script>', false],
    [
      'foreignObject HTML href',
      '<svg><foreignObject><script href="https://cdn.example/runtime.js"></script></foreignObject></svg>',
      false,
    ],
    ['SVG src inert', '<svg><script src="https://cdn.example/runtime.js"></script></svg>', false],
    ['geometry', '<svg><path d="M0 0 L2 2" /></svg>', false],
  ])
    test(`runtime entry review SVG formats: ${ext} ${name}`, () => {
      const source =
        ext === 'tsx'
          ? `export const Icon=()=>(${markup});`
          : ext === 'vue'
            ? `<template>${markup}</template>`
            : markup;
      const issues = probeReview('svg-formats', 'website', source, ext);
      assert.equal(
        issues.some((issue) =>
          /external executable (?:worker )?script|dynamic executable script/u.test(issue)
        ),
        reject || (ext === 'tsx' && name === 'href priority'),
        issues.join('\n')
      );
      if (name === 'href priority')
        assert.equal(
          issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
          false,
          issues.join('\n')
        );
    });
}

for (const mode of ['directory', 'ancestor', 'dangling', 'cycle', 'escape', 'regular-changed']) {
  test(`runtime entry review promotion module paths: ${mode}`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const directory = path.dirname(path.join(root, implementationPath));
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    const nested = mode === 'ancestor' ? 'nested/' : '';
    const imported =
      mode === 'directory' || mode === 'ancestor'
        ? `helpers/${nested}helper.test.ts`
        : 'helper.test.ts';
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `---\nimport './${imported}';\n---\n<main>Search</main>`
    );
    for (const [name, value] of [
      ['old', 1],
      ['new', 2],
    ]) {
      fs.mkdirSync(path.join(directory, name, nested), { recursive: true });
      fs.writeFileSync(
        path.join(directory, name, nested, 'helper.test.ts'),
        `export const value=${value};`
      );
    }
    const link = path.join(
      directory,
      mode === 'directory' || mode === 'ancestor' ? 'helpers' : 'helper.test.ts'
    );
    if (mode === 'regular-changed') fs.writeFileSync(link, 'export const value=1;');
    else
      fs.symlinkSync(
        mode === 'directory' || mode === 'ancestor' ? 'old' : 'old/helper.test.ts',
        link
      );
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    if (mode === 'regular-changed') {
      fs.writeFileSync(link, 'export const value=2;');
      assert.match(
        validationMessage(root, promotionOptions(revision)),
        /promoted dependency.*helper\.test\.ts.*differs from evidence Commit/u
      );
      return;
    }
    fs.unlinkSync(link);
    if (mode === 'escape') {
      const outside = createRoot();
      fs.writeFileSync(path.join(outside, 'helper.test.ts'), 'export const value=2;');
      fs.symlinkSync(path.join(outside, 'helper.test.ts'), link);
    } else
      fs.symlinkSync(
        mode === 'dangling' ? 'missing.test.ts' : mode === 'cycle' ? 'helper.test.ts' : 'new',
        link
      );
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promotion module.*symlink.*unverified/u
    );
  });
}
for (const ext of ['astro', 'mdx', 'vue', 'svelte', 'tsx']) {
  for (const [name, markup] of [
    ['component Script', '<svg><Script href="https://cdn.example/runtime.js" /></svg>'],
    ['component Svg', '<Svg><script href="https://cdn.example/runtime.js"></script></Svg>'],
    ['HTML data href', '<svg><script data-href="https://cdn.example/runtime.js"></script></svg>'],
  ])
    test(`runtime entry review SVG native identity: ${ext} ${name}`, () => {
      const source =
        ext === 'tsx'
          ? `export const Icon=()=>(${markup});`
          : ext === 'vue'
            ? `<template>${markup}</template>`
            : markup;
      const issues = probeReview('svg-native', 'website', source, ext);
      assert.equal(
        issues.some((issue) =>
          /external executable (?:worker )?script|dynamic executable script/u.test(issue)
        ),
        false,
        issues.join('\n')
      );
    });
}
for (const ext of ['md', 'mdx']) {
  for (const [name, source] of [
    ['fenced', '```html\n<svg><script href="https://cdn.example/runtime.js"></script></svg>\n```'],
    ['inline code', '`<svg><script href="https://cdn.example/runtime.js"></script></svg>`'],
    ['comment', '<!-- <svg><script href="https://cdn.example/runtime.js"></script></svg> -->'],
  ])
    test(`runtime entry review SVG examples: ${ext} ${name}`, () => {
      const issues = probeReview('svg-examples', 'website', source, ext);
      assert.equal(
        issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
        false,
        issues.join('\n')
      );
    });
}
test('runtime entry review SVG parser oracle: native namespaces and href precedence', () => {
  const tree = parseHtmlFragment(
    '<svg><script href="./local.js" xlink:href="https://cdn.example/runtime.js"></script><foreignObject><script href="https://cdn.example/html.js"></script></foreignObject></svg>'
  );
  const nodes = [];
  const visit = (node) => {
    if (node.tagName === 'script') nodes.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(tree);
  assert.equal(nodes[0].namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(nodes[1].namespaceURI, 'http://www.w3.org/1999/xhtml');
  assert.deepEqual(
    nodes[0].attrs.map(({ name, prefix, namespace, value }) => [name, prefix, namespace, value]),
    [
      ['href', undefined, undefined, './local.js'],
      ['href', 'xlink', 'http://www.w3.org/1999/xlink', 'https://cdn.example/runtime.js'],
    ]
  );
});
for (const ext of ['mdx', 'tsx'])
  test(`runtime entry review SVG React XLink spelling: ${ext}`, () => {
    const markup = '<svg><script xlinkHref="https://cdn.example/runtime.js" /></svg>';
    const issues = probeReview(
      'svg-xlink',
      'website',
      ext === 'tsx' ? `export const Icon=()=>(${markup});` : markup,
      ext
    );
    assert.ok(
      issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
      issues.join('\n')
    );
  });
test('runtime entry review SVG MDX ESM examples stay inert after source selection', () => {
  const issues = probeReview(
    'svg-mdx-esm',
    'website',
    'export const example = `😀<svg><script href="https://cdn.example/runtime.js"></script></svg>`;',
    'mdx'
  );
  assert.equal(issues.length, 0, issues.join('\n'));
});

test('runtime entry review WASM package boundary: retains layer-identity inspection without promotion admission', () => {
  const root = createRoot();
  const implementationPath = 'apps/www/src/components/override/Search.astro';
  const directory = path.join(root, 'node_modules/example-wasm');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'example-wasm', type: 'module', exports: './index.mjs' })
  );
  fs.writeFileSync(
    path.join(directory, 'index.mjs'),
    'export const compile=(bytes)=>WebAssembly.compile(bytes);'
  );
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, implementationPath),
    "---\nimport {compile} from 'example-wasm';\n---\n<main>Search</main>"
  );
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  writeValidMatrices(root, {}, {}, { websiteBindings });
  assert.deepEqual(collectCoverageMatrixIssues({ rootDir: root }), []);
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, { websiteBindings });
  assert.match(
    validationMessage(root, promotionOptions(revision)),
    /promotion package.*(?:unrecognized|unverified)/u
  );
});
for (const [ext, markup] of [
  ['astro', '<svg><script {...attrs}></script></svg>'],
  ['mdx', '<svg><script {...attrs}></script></svg>'],
  ['vue', '<template><svg><script v-bind="attrs"></script></svg></template>'],
  ['vue', '<template><svg><script :[name]="value"></script></svg></template>'],
])
  test(`runtime entry review SVG opaque source: ${ext} ${markup}`, () => {
    const issues = probeReview('svg-opaque', 'website', markup, ext);
    assert.ok(
      issues.some((issue) => /dynamic executable script/u.test(issue)),
      issues.join('\n')
    );
  });
test('runtime entry review SVG MDX lowercased xlinkhref is an unrelated prop', () => {
  const issues = probeReview(
    'svg-xlink-case',
    'website',
    '<svg><script xlinkhref="https://cdn.example/runtime.js" /></svg>',
    'mdx'
  );
  assert.equal(issues.length, 0, issues.join('\n'));
});
for (const markup of [
  '<script-widget src="https://cdn.example/runtime.js"></script-widget>',
  '<svg><script:custom src="https://cdn.example/runtime.js"></script:custom></svg>',
])
  test(`runtime entry review SVG complete native name: ${markup}`, () => {
    const issues = probeReview('svg-complete-name', 'website', markup, 'html');
    assert.equal(
      issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
      false,
      issues.join('\n')
    );
  });

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    ['object parameter', 'function run({WebAssembly}){WebAssembly.compile(bytes);}', false],
    [
      'renamed parameter',
      'function run({engine:WebAssembly}){WebAssembly.instantiate(bytes,imports);}',
      false,
    ],
    ['array parameter', 'function run([WebAssembly]){WebAssembly.compile(bytes);}', false],
    ['qualified parameter', 'function run({window}){window.WebAssembly.compile(bytes);}', false],
    ['business variable', 'const {WebAssembly}=business;WebAssembly.compile(bytes);', false],
    ['catch binding', 'try{run()}catch({WebAssembly}){WebAssembly.compile(bytes);}', false],
    ['true global extraction', 'const {WebAssembly}=globalThis;WebAssembly.compile(bytes);', true],
    ['renamed native namespace', 'const {WebAssembly:wasm}=globalThis;wasm.compile(bytes);', true],
    ['native method extraction', 'const {compile}=globalThis.WebAssembly;compile(bytes);', true],
    [
      'renamed native method',
      'const {instantiate:load}=globalThis.WebAssembly;load(bytes,imports);',
      true,
    ],
    ['ordinary global', 'WebAssembly.compile(bytes);', true],
    ['qualified global', 'window.WebAssembly.instantiateStreaming(response,imports);', true],
  ])
    test(`WASM binding review red: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-review', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'nested business parameter',
      'function f({nested:{engine:WebAssembly}}){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'nested array business parameter',
      'function f([{engine:WebAssembly}]){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'rest object business parameter',
      'function f({...WebAssembly}){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'rest array business parameter',
      'function f([...WebAssembly]){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'default business parameter',
      'function f({WebAssembly={compile(){}}}={}){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'default qualified business parameter',
      'function f({window={WebAssembly:{compile(){}}}}={}){window.WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'destructured globalThis business',
      'function f({globalThis}){globalThis.WebAssembly.compile(bytes);}',
      false,
    ],
    ['destructured self business', 'function f({self}){self.WebAssembly.compile(bytes);}', false],
    [
      'nested catch business',
      'try{f()}catch({engine:{WebAssembly}}){WebAssembly.compile(bytes);}',
      false,
    ],
    ['catch lifetime', 'try{f()}catch({WebAssembly}){}WebAssembly.compile(bytes);', true],
    ['block lifetime', '{const {WebAssembly}=business;}WebAssembly.compile(bytes);', true],
    [
      'function var lifetime',
      'function f(){if(flag){var {WebAssembly}=business;}WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'function var hoist',
      'function f(){WebAssembly.compile(bytes);if(flag){var {WebAssembly}=business;}}',
      false,
    ],
    ['TDZ shadow', 'function f(){WebAssembly.compile(bytes);const {WebAssembly}=business;}', false],
    [
      'let loop shadow',
      'for(let {WebAssembly}=business;flag;){WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'let loop lifetime',
      'for(let {WebAssembly}=business;flag;){}WebAssembly.compile(bytes);',
      true,
    ],
    ['for-of shadow', 'for(const {WebAssembly} of businesses){WebAssembly.compile(bytes);}', false],
    [
      'for-of lifetime',
      'for(const {WebAssembly} of businesses){}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'var loop lifetime',
      'function f(){for(var {WebAssembly} of businesses){}WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'named function expression',
      'const f=function WebAssembly(){WebAssembly.compile(bytes);};',
      false,
    ],
    [
      'named class expression',
      'const C=class WebAssembly{run(){WebAssembly.compile(bytes);}};',
      false,
    ],
    [
      'native nested projection',
      'const {window:{WebAssembly:{compile:run}}}=globalThis;run(bytes);',
      true,
    ],
    [
      'native qualified alias',
      'const {window:w}=globalThis;w.WebAssembly.instantiate(bytes,imports);',
      true,
    ],
    [
      'native constructor extraction',
      'const {Module:Compiled}=globalThis.WebAssembly;new Compiled(bytes);',
      true,
    ],
    [
      'native Instance extraction',
      'const {Instance:Loaded}=WebAssembly;new Loaded(module,imports);',
      true,
    ],
    [
      'native static computed',
      'const {["WebAssembly"]:wasm}=globalThis;const {["compile"]:run}=wasm;run(bytes);',
      true,
    ],
    ['native literal array', 'const [wasm]=[globalThis.WebAssembly];wasm.compile(bytes);', true],
    [
      'native nested literal',
      'const [{engine:{compile:run}}]=[{engine:WebAssembly}];run(bytes);',
      true,
    ],
    [
      'business literal nested',
      'const [{engine:WebAssembly}]=[{engine:{compile(){}}}];WebAssembly.compile(bytes);',
      false,
    ],
    ['native rest unsupported', 'const {...wasm}=WebAssembly;wasm.compile(bytes);', true],
    [
      'native global rest unsupported',
      'const {...scope}=globalThis;scope.WebAssembly.compile(bytes);',
      true,
    ],
    ['business rest', 'const {...WebAssembly}=business;WebAssembly.compile(bytes);', false],
    [
      'business literal rest',
      'const {...WebAssembly}={nested:{compile(){}}};WebAssembly.compile(bytes);',
      false,
    ],
    [
      'native default possible',
      'const {missing:wasm=WebAssembly}=business;wasm.compile(bytes);',
      true,
    ],
    [
      'native parameter default possible',
      'function f({wasm=globalThis.WebAssembly}={}){wasm.compile(bytes);}',
      true,
    ],
    [
      'native root parameter default possible',
      'function f({WebAssembly}=globalThis){WebAssembly.compile(bytes);}',
      true,
    ],
    [
      'business default remains shadow',
      'const {WebAssembly={compile(){}}}=business;WebAssembly.compile(bytes);',
      false,
    ],
    [
      'native computed unknown unsupported',
      'const {[key]:wasm}=globalThis;wasm.compile(bytes);',
      true,
    ],
    ['native method default unknown', 'const {compile=business}=WebAssembly;compile(bytes);', true],
    [
      'business Reflect destructuring',
      'function f({Reflect}){Reflect.apply(WebAssembly.compile,null,[bytes]);}',
      false,
    ],
    [
      'native Reflect destructuring',
      'const {Reflect}=globalThis;Reflect.apply(WebAssembly.compile,null,[bytes]);',
      true,
    ],
    [
      'native hoisted alias initialization',
      'function f(){if(flag){var {WebAssembly:wasm}=globalThis;}wasm.compile(bytes);}',
      true,
    ],
    [
      'assignment stays in sibling scope',
      'const wasm=business;function f(wasm){wasm=WebAssembly;}wasm.compile(bytes);',
      false,
    ],
    ['native assigned alias', 'let run;run=WebAssembly.compile;run(bytes);', true],
    [
      'safe method destructuring',
      'const {validate,Memory,Table}=WebAssembly;validate(bytes);new Memory({initial:1});new Table({element:"anyfunc",initial:1});',
      false,
    ],
  ])
    test(`WASM binding review boundaries: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-boundaries', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}
for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'known global rest exclusion',
      'const {WebAssembly,...scope}=globalThis;scope.WebAssembly.compile(bytes);',
      false,
    ],
    [
      'known method rest exclusion',
      'const {compile,...wasm}=WebAssembly;wasm.compile(bytes);',
      false,
    ],
    [
      'nonexcluded native rest method',
      'const {compile,...wasm}=WebAssembly;wasm.instantiate(bytes,imports);',
      true,
    ],
    [
      'known rest safe method',
      'const {...wasm}=WebAssembly;wasm.validate(bytes);new wasm.Memory({initial:1});',
      false,
    ],
    [
      'rest native fallback',
      'const {WebAssembly,...scope}=globalThis;const {WebAssembly:wasm=globalThis.WebAssembly}=scope;wasm.compile(bytes);',
      true,
    ],
    [
      'literal rest exclusion',
      'const {native,...scope}={native:WebAssembly};scope.native.compile(bytes);',
      false,
    ],
    [
      'literal array rest exclusion',
      'const [native,...scopes]=[WebAssembly,{compile(){}}];scopes[0].compile(bytes);',
      false,
    ],
    [
      'literal array rest native',
      'const [data,...scopes]=[{},WebAssembly];scopes[0].compile(bytes);',
      true,
    ],
  ])
    test(`WASM binding review rest projections: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-rest', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'defined business method excludes default',
      'const {compile=WebAssembly.compile}={compile(){}};compile(bytes);',
      false,
    ],
    [
      'defined business object excludes default',
      'const {engine:wasm=WebAssembly}={engine:{compile(){}}};wasm.compile(bytes);',
      false,
    ],
    [
      'defined array value excludes default',
      'const [wasm=WebAssembly]=[{compile(){}}];wasm.compile(bytes);',
      false,
    ],
    [
      'missing property uses native default',
      'const {engine:wasm=WebAssembly}={};wasm.compile(bytes);',
      true,
    ],
    [
      'explicit business overrides native spread',
      'const {compile}={...WebAssembly,compile(){}};compile(bytes);',
      false,
    ],
    [
      'safe builtin extraction default unused',
      'const {validate=WebAssembly.compile}=WebAssembly;validate(bytes);',
      false,
    ],
  ])
    test(`WASM binding review default projections: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-defaults', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    ['unknown window call is not a WASM entry', 'window[name](value);', false],
    ['unknown global call is not a WASM entry', 'globalThis[name](value);', false],
    ['unknown worker call is not a WASM entry', 'self[name](value);', false],
    [
      'unknown native namespace projection stays unsupported',
      'globalThis[name].compile(bytes);',
      true,
    ],
    ['unknown native method stays unsupported', 'WebAssembly[name](bytes);', true],
  ])
    test(`WASM binding review unknown projections: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-unknown', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'static block var is local',
      'class Scope{static{var {WebAssembly}=business;WebAssembly.compile(bytes);}}',
      false,
    ],
    [
      'static block var does not hide later global',
      'class Scope{static{var {WebAssembly}=business;}}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'namespace var is local',
      'namespace Scope{var {WebAssembly}=business;WebAssembly.compile(bytes);}',
      false,
    ],
    [
      'namespace var does not hide later global',
      'namespace Scope{var {WebAssembly}=business;}WebAssembly.compile(bytes);',
      true,
    ],
  ])
    test(`WASM binding review var containers: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-var-containers', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    ['enum value shadows global', 'enum WebAssembly{compile}WebAssembly.compile(bytes);', false],
    [
      'namespace value shadows global',
      'namespace WebAssembly{export const compile=business;}WebAssembly.compile(bytes);',
      false,
    ],
    [
      'import equals value shadows global',
      'import WebAssembly=business.engine;WebAssembly.compile(bytes);',
      false,
    ],
    [
      'type-only name does not shadow value',
      'type WebAssembly={compile:unknown};WebAssembly.compile(bytes);',
      true,
    ],
  ])
    test(`WASM binding review TypeScript names: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-typescript', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });

for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'ambient const',
      'declare const WebAssembly: typeof globalThis.WebAssembly; WebAssembly.compile(bytes);',
      true,
    ],
    [
      'ambient window',
      'declare const window: Window & typeof globalThis; window.WebAssembly.compile(bytes);',
      true,
    ],
    [
      'ambient namespace',
      'declare namespace WebAssembly { function compile(bytes: Uint8Array): Promise<unknown>; } WebAssembly.compile(bytes);',
      true,
    ],
    [
      'pure type namespace',
      'namespace WebAssembly { export interface Options { value: string } } WebAssembly.compile(bytes);',
      true,
    ],
    [
      'type-only import',
      'import type {WebAssembly} from "./types"; WebAssembly.compile(bytes);',
      true,
    ],
    [
      'inline type import',
      'import {type WebAssembly} from "./types"; WebAssembly.compile(bytes);',
      true,
    ],
    ['type alias control', 'type WebAssembly={compile:unknown}; WebAssembly.compile(bytes);', true],
    [
      'real namespace control',
      'namespace WebAssembly { export const compile=(bytes:unknown)=>bytes; } WebAssembly.compile(bytes);',
      false,
    ],
    [
      'business const control',
      'const WebAssembly={compile(bytes:unknown){return bytes}}; WebAssembly.compile(bytes);',
      false,
    ],
    ['qualified native control', 'globalThis.WebAssembly.compile(bytes);', true],
  ])
    test(`WASM erasure review red: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-erasure-review', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });

for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    ['ambient let global', 'declare let WebAssembly:unknown;WebAssembly.compile(bytes);', true],
    [
      'ambient destructured global',
      'declare const {WebAssembly}:typeof globalThis;WebAssembly.compile(bytes);',
      true,
    ],
    [
      'ambient class',
      'declare class WebAssembly{static compile(bytes:unknown):void}WebAssembly.compile(bytes);',
      true,
    ],
    ['ambient function', 'declare function WebAssembly():void;WebAssembly.compile(bytes);', true],
    ['overload signature erased', 'function WebAssembly():void;WebAssembly.compile(bytes);', true],
    [
      'actual overload implementation',
      'function WebAssembly():void;function WebAssembly(){}WebAssembly.compile(bytes);',
      false,
    ],
    ['ambient enum', 'declare enum WebAssembly{compile}WebAssembly.compile(bytes);', true],
    ['runtime enum', 'enum WebAssembly{compile}WebAssembly.compile(bytes);', false],
    [
      'const enum value or rewrite',
      'const enum WebAssembly{compile=0}WebAssembly.compile(bytes);',
      false,
    ],
    [
      'ambient const enum remains unverified',
      'declare const enum WebAssembly{compile=0}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'const enum namespace remains unverified',
      'namespace WebAssembly{export const enum Code{compile=0}}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'nested pure namespace',
      'namespace WebAssembly.Types{export type Options={value:string}}WebAssembly.compile(bytes);',
      true,
    ],
    ['empty namespace', 'namespace WebAssembly{}WebAssembly.compile(bytes);', true],
    [
      'namespace with emitted shell',
      'namespace WebAssembly{export declare const other:number;}WebAssembly.compile(bytes);',
      false,
    ],
    [
      'nested value namespace',
      'namespace WebAssembly.Nested{export const value=1;}WebAssembly.compile(bytes);',
      false,
    ],
    [
      'ambient nested namespace',
      'declare namespace WebAssembly.Nested{const value:number;}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'ambient member inside real namespace',
      'namespace Scope{declare const WebAssembly:unknown;export function run(){WebAssembly.compile(bytes);}}',
      true,
    ],
    [
      'declare module ancestor',
      'declare module "types"{namespace WebAssembly{const compile:unknown;}}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'declare global ancestor',
      'declare global{const WebAssembly:unknown;}WebAssembly.compile(bytes);',
      true,
    ],
    [
      'type-only default import',
      'import type WebAssembly from "./types";WebAssembly.compile(bytes);',
      true,
    ],
    [
      'type-only namespace import',
      'import type * as WebAssembly from "./types";WebAssembly.compile(bytes);',
      true,
    ],
    [
      'mixed import type shadow',
      'import {type WebAssembly,run} from "./types";run();WebAssembly.compile(bytes);',
      true,
    ],
    [
      'mixed import value shadow',
      'import {WebAssembly,type Options} from "./types";WebAssembly.compile(bytes);',
      false,
    ],
    [
      'mixed default value import',
      'import WebAssembly,{type Options} from "./types";WebAssembly.compile(bytes);',
      false,
    ],
    [
      'real namespace import',
      'import * as WebAssembly from "./types";WebAssembly.compile(bytes);',
      false,
    ],
    [
      'renamed type import',
      'import {type Engine as WebAssembly,run} from "./types";run();WebAssembly.compile(bytes);',
      true,
    ],
    [
      'renamed value import',
      'import {Engine as WebAssembly,type Options} from "./types";WebAssembly.compile(bytes);',
      false,
    ],
    [
      'type-only import equals',
      'import type WebAssembly=business.engine;WebAssembly.compile(bytes);',
      true,
    ],
    [
      'real abstract class',
      'abstract class WebAssembly{static compile(bytes:unknown){return bytes}}WebAssembly.compile(bytes);',
      false,
    ],
    [
      'ambient plus real value merge',
      'declare namespace WebAssembly{interface Options{}}const WebAssembly={compile(){}};WebAssembly.compile(bytes);',
      false,
    ],
    [
      'erased qualifier stays native',
      'import {type Window as window,run} from "./types";run();window.WebAssembly.compile(bytes);',
      true,
    ],
  ])
    test(`WASM erasure review boundaries: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-erasure-boundaries', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });

test('WASM erasure review oracle: erased syntax retains native call without runtime binding', () => {
  const ts = createRequire(import.meta.url)('typescript');
  for (const source of [
    'declare const WebAssembly:typeof globalThis.WebAssembly;',
    'declare namespace WebAssembly{function compile(bytes:unknown):unknown;}',
    'namespace WebAssembly{export interface Options{value:string}}',
    'namespace WebAssembly.Types{export type Options={value:string}}',
    'import type {WebAssembly} from "./types";',
    'import {type WebAssembly,run} from "./types";run();',
  ]) {
    const result = ts.transpileModule(source + 'WebAssembly.compile(bytes);', {
      fileName: 'probe.ts',
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
      },
      reportDiagnostics: true,
    });
    assert.equal(result.diagnostics.length, 0, source);
    assert.match(result.outputText, /WebAssembly\.compile\(bytes\)/u);
    const emitted = ts.createSourceFile(
      'emitted.js',
      result.outputText,
      ts.ScriptTarget.Latest,
      true
    );
    assert.equal(
      emitted.statements.some(
        (statement) =>
          (ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (d) => d.name.getText(emitted) === 'WebAssembly'
            )) ||
          (ts.isImportDeclaration(statement) &&
            statement.importClause?.namedBindings?.elements?.some(
              (e) => e.name.text === 'WebAssembly'
            ))
      ),
      false,
      result.outputText
    );
  }
});
test('WASM erasure review oracle: value namespace and const enum remain emission-sensitive', () => {
  const ts = createRequire(import.meta.url)('typescript');
  for (const source of [
    'namespace WebAssembly{export const compile=(bytes:unknown)=>bytes;}',
    'namespace WebAssembly{export declare const other:number;}',
    'const enum WebAssembly{compile=0}',
    'namespace WebAssembly{export const enum Code{compile=0}}',
  ]) {
    const result = ts.transpileModule(source + 'WebAssembly.compile(bytes);', {
      fileName: 'probe.ts',
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
      },
      reportDiagnostics: true,
    });
    assert.equal(result.diagnostics.length, 0, source);
    assert.match(result.outputText, /var WebAssembly;/u);
  }
});
test('WASM erasure review oracle: const enum references can rewrite without executing generated code', () => {
  const ts = createRequire(import.meta.url)('typescript');
  for (const ambient of [false, true]) {
    const source = `${ambient ? 'declare ' : ''}const enum WebAssembly{compile=0}\nconst entry=WebAssembly.compile;`;
    const file = '/virtual-wasm-enum.ts';
    const options = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      noLib: true,
      noResolve: true,
      preserveConstEnums: false,
    };
    const outputs = [];
    const host = {
      getSourceFile: (name) =>
        name === file ? ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true) : undefined,
      getDefaultLibFileName: () => '',
      writeFile: (_name, text) => outputs.push(text),
      getCurrentDirectory: () => '/virtual',
      getDirectories: () => [],
      fileExists: (name) => name === file,
      readFile: (name) => (name === file ? source : undefined),
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    };
    const result = ts.createProgram([file], options, host).emit();
    assert.equal(result.emitSkipped, false);
    assert.equal(outputs.length, 1);
    assert.match(outputs[0], /const entry = 0/u);
    assert.doesNotMatch(outputs[0], /var WebAssembly/u);
    const isolated = ts.transpileModule(source, {
      fileName: 'probe.ts',
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
      },
    }).outputText;
    assert.match(isolated, /const entry = WebAssembly\.compile/u);
  }
});

// DOM namespace, HTML Location and ServiceWorkerContainer ownership controls.
// These source strings are parsed only; no navigation/worker/payload is run.
for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'empty namespace',
      "const s=document.createElement('script');s.setAttributeNS('', 'src','https://cdn.example/x.js');",
      true,
    ],
    [
      'const null namespace',
      "const ns=null;const s=document.createElement('script');s.setAttributeNS(ns,'src','https://cdn.example/x.js');",
      true,
    ],
    [
      'undefined nullable namespace',
      "const s=document.createElement('script');s.setAttributeNS(undefined,'src','https://cdn.example/x.js');",
      true,
    ],
    [
      'namespace preserves attribute case',
      "const s=document.createElement('script');s.setAttributeNS(null,'SRC','https://cdn.example/x.js');",
      false,
    ],
    [
      'unrelated resource namespace',
      "const s=document.createElement('script');s.setAttributeNS('urn:business','src','https://cdn.example/x.js');",
      false,
    ],
    [
      'business attribute receiver',
      "const s={setAttributeNS(){}};s.setAttributeNS(null,'src','https://cdn.example/x.js');",
      false,
    ],
    [
      'ordinary attribute case',
      "const s=document.createElement('script');s.setAttribute('SRC','https://cdn.example/x.js');",
      true,
    ],
    [
      'namespaced stylesheet',
      "const l=document.createElement('link');l.setAttributeNS(null,'rel','stylesheet');l.setAttributeNS('','href','https://cdn.example/theme.css');",
      true,
    ],
    [
      'namespaced unrelated link',
      "const l=document.createElement('link');l.setAttributeNS('urn:business','rel','stylesheet');l.setAttributeNS('urn:business','href','https://cdn.example/theme.css');",
      false,
    ],
    ['window location', "window.location='javascript:run()';", true],
    ['bare location', "location='javascript:run()';", true],
    [
      'qualified location alias',
      "const loc=globalThis.location;loc.href='javascript:run()';",
      true,
    ],
    ['document location', "document.location='javascript:run()';", true],
    ['location assign', "location.assign('javascript:run()');", true],
    ['location replace', "self.location.replace('javascript:run()');", true],
    [
      'const navigation string',
      String.raw`const url='\tJaVa\nScRiPt:run()';location.href=url;`,
      true,
    ],
    [
      'nested location destructure',
      "const {window:{location:loc}}=globalThis;loc.replace('javascript:run()');",
      true,
    ],
    ['ordinary HTTPS navigation', "location.href='https://example.com/';", false],
    ['relative navigation', "location.assign('/docs/');", false],
    ['encoded HTML is inert in JS URL', "location.href='java&#115;cript:run()';", false],
    ['business location variable', "const location={};location.href='javascript:run()';", false],
    [
      'business location parameter',
      "function run({location}){location.assign('javascript:run()');}",
      false,
    ],
    [
      'business qualified parameter',
      "function run([window]){window.location='javascript:run()';}",
      false,
    ],
    [
      'worker global qualification',
      "const worker=self.navigator.serviceWorker;worker.register('https://cdn.example/worker.js');",
      true,
    ],
    [
      'worker nested destructure',
      "const {navigator:{serviceWorker:worker}}=window;worker.register('/worker.js');",
      true,
    ],
    [
      'worker alias chain',
      "const nav=navigator;const {serviceWorker}=nav;const worker=serviceWorker;worker.register('/worker.js');",
      true,
    ],
    [
      'business worker alias',
      "const nav=business;const worker=nav.serviceWorker;worker.register('/worker.js');",
      false,
    ],
    [
      'business navigator parameter',
      "function run({navigator}){navigator.serviceWorker.register('/worker.js');}",
      false,
    ],
    [
      'business worker parameter',
      "function run({serviceWorker}){serviceWorker.register('/worker.js');}",
      false,
    ],
    [
      'function var shadow',
      "function run(){if(true){var navigator=business;}navigator.serviceWorker.register('/worker.js');}",
      false,
    ],
    [
      'type-only navigator leaves runtime',
      "declare const navigator:Navigator;navigator.serviceWorker.register('/worker.js');",
      true,
    ],
    ['inert navigation example', 'const example="location.assign(\'javascript:run()\')";', false],
  ])
    test(`native entry followup controls: ${kind} ${name}`, () => {
      const issues = probeReview('native-entry-controls', kind, source);
      assert.equal(
        issues.some((issue) =>
          /external executable.*script|executable navigation URL|external stylesheet|worker.*unverified/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}

for (const [name, source] of [
  ['dynamic navigation', 'location.href=target;'],
  ['computed native member', 'const target=window[key];target.assign(url);'],
  ['native rest receiver', 'const {...copy}=window;copy.location=url;'],
  [
    'unknown resource namespace',
    "const s=document.createElement('script');s.setAttributeNS(namespace,'src','/entry.js');",
  ],
])
  test(`native entry promotion: ${name} cannot certify opaque bytes`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `<script>${source}</script><main>Search</main>`
    );
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    assert.match(
      validationMessage(root, promotionOptions(revision)),
      /promotion DOM-authored resource.*unverified/u
    );
  });

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    ['location alias variable rebinding', "let loc=location;loc='javascript:run()';", false],
    ['href variable rebinding', "let {href}=location;href='javascript:run()';", false],
    ['alias property navigation remains', "let loc=location;loc.href='javascript:run()';", true],
    [
      'mutual spread safe overwrite',
      'let a={};let b={...a};a={...b};b={...a,compile(){}};b.compile(bytes);',
      false,
    ],
    [
      'mutual spread native retained',
      'let a={compile:WebAssembly.compile};let b={...a};a={...b};b={...a};b.compile(bytes);',
      true,
    ],
    [
      'aggregate captures earlier native',
      'let compile=WebAssembly.compile;const snapshot={compile};compile=()=>{};snapshot.compile(bytes);',
      true,
    ],
    [
      'aggregate ignores later native',
      'let compile=()=>{};const snapshot={compile};compile=WebAssembly.compile;snapshot.compile(bytes);',
      false,
    ],
  ])
    test(`native entry independent review: ${kind} ${name}`, () => {
      const issues = probeReview('native-entry-independent', kind, source);
      assert.equal(
        issues.some((issue) =>
          /runtime code compilation.*unverified|executable navigation URL.*unverified/u.test(issue)
        ),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.equal(issues.length, 0, issues.join('\n'));
    });
}
for (const [name, source, reject] of [
  [
    'array shadow navigation',
    "const target='/safe';function go([target]){location.href=target;}",
    true,
  ],
  [
    'rest shadow navigation',
    "const target='/safe';function go(...target){location.href=target;}",
    true,
  ],
  [
    'catch array shadow navigation',
    "const target='/safe';try{run()}catch([target]){location.href=target;}",
    true,
  ],
  [
    'array declaration shadow navigation',
    "const target='/safe';{const [target]=values;location.href=target;}",
    true,
  ],
  [
    'array shadow namespace',
    "const ns='urn:business';function go([ns]){const s=document.createElement('script');s.setAttributeNS(ns,'src','/entry.js');}",
    true,
  ],
  [
    'rest shadow namespace',
    "const ns='urn:business';function go(...ns){const s=document.createElement('script');s.setAttributeNS(ns,'src','/entry.js');}",
    true,
  ],
  [
    'native receiver depth bound',
    `const a0=location;${Array.from({ length: 65 }, (_, i) => `const a${i + 1}=a${i};`).join('')}a65.href='javascript:run()';`,
    true,
  ],
  ['opaque variable rebinding', "let target=window[key];target='safe';", false],
])
  test(`native entry independent promotion: ${name}`, () => {
    const root = createRoot();
    const implementationPath = 'apps/www/src/components/override/Search.astro';
    const websiteBindings = [[implementationPath, ['www.shell.search']]];
    fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
    fs.writeFileSync(
      path.join(root, implementationPath),
      `<script>${source}</script><main>Search</main>`
    );
    writeValidMatrices(root, {}, {}, { websiteBindings });
    const revision = commitFixtureRoot(root);
    writeSelfHostedPromotion(root, revision, { websiteBindings });
    if (reject)
      assert.match(
        validationMessage(root, promotionOptions(revision)),
        /promotion DOM-authored resource.*unverified/u
      );
    else
      assert.doesNotThrow(() =>
        validateCoverageMatrices({ rootDir: root, ...promotionOptions(revision) })
      );
  });
for (const count of [10, 32])
  for (const native of [false, true]) {
    test(`WASM spread complexity: ${count} snapshots ${native ? 'native' : 'business'}`, () => {
      const root = createRoot();
      const sourcePath = 'apps/www/src/components/ReviewProbe.ts';
      const source = `let engine={compile:${native ? 'WebAssembly.compile' : '()=>{}'}};${'engine={...engine};'.repeat(count)}engine.compile(bytes);`;
      fs.mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
      fs.writeFileSync(path.join(root, sourcePath), source);
      writeValidMatrices(
        root,
        {},
        {},
        { websiteBindings: [[sourcePath, ['www.shell.primary-nav']]] }
      );
      commitFixtureRoot(root);
      const result = spawnSync(
        process.execPath,
        [
          '--max-old-space-size=256',
          path.resolve('scripts/coverage-matrices/check-coverage-matrices.mjs'),
        ],
        { cwd: root, encoding: 'utf8', timeout: 10000 }
      );
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.signal, null);
      assert.equal(result.status, native ? 1 : 0, result.stderr);
      if (native) assert.match(result.stderr, /runtime code compilation.*unverified/u);
    });
  }

for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'earlier object element assignment',
      'let engine={};const options={x:(engine=WebAssembly),entry:engine.compile};options.entry(bytes);',
      true,
    ],
    [
      'earlier array element assignment',
      'let engine={};const options=[engine=WebAssembly,engine.compile];options[1](bytes);',
      true,
    ],
    [
      'earlier spread element assignment',
      'let engine={};const options={x:(engine=WebAssembly),...engine};options.compile(bytes);',
      true,
    ],
    [
      'later object element assignment',
      'let engine={compile(){}};const options={entry:engine.compile,x:(engine=WebAssembly)};options.entry(bytes);',
      false,
    ],
    [
      'computed snapshot excludes later native',
      'let ns={compile(){}};const box={ns};ns=WebAssembly;box[key].compile(bytes);',
      false,
    ],
    [
      'computed snapshot retains earlier native',
      'let ns=WebAssembly;const box={ns};ns={compile(){}};box[key].compile(bytes);',
      true,
    ],
  ])
    test(`WASM snapshot evaluation order: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-snapshot-order', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.deepEqual(issues, []);
    });

for (const kind of ['website', 'harness'])
  for (const computed of [false, true]) {
    test(`WASM cached depth evidence: ${kind} ${computed ? 'computed' : 'static'} first-deep then shallow`, () => {
      const prefix = `const a0=WebAssembly${computed ? '' : '.compile'};${Array.from({ length: 61 }, (_, i) => `const a${i + 1}=a${i};`).join('')}`;
      const source = computed
        ? `${prefix}const base={ns:a61};const {[key]:entry}=base;entry.compile(bytes);base[key].compile(bytes);`
        : `${prefix}const base={compile:a61};const {compile:entry}=base;entry(bytes);base.compile(bytes);`;
      const issues = probeReview('wasm-cache-depth', kind, source);
      assert.ok(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        issues.join('\n')
      );
    });
  }
test('script source cache binds complete source, path and preview ownership', () => {
  const cache = createScriptSpecifierCache();
  let calls = 0;
  const scan = () => [++calls + ''];
  assert.deepEqual(cache('safe', 'a.ts', {}, scan), ['1']);
  assert.deepEqual(cache('safe', 'a.ts', {}, scan), ['1']);
  assert.deepEqual(cache('unsafe', 'a.ts', {}, scan), ['2']);
  assert.deepEqual(cache('safe', 'b.ts', {}, scan), ['3']);
  assert.deepEqual(cache('safe', 'a.ts', { harnessPreviewBoundary: true }, scan), ['4']);
  assert.deepEqual(cache('safe', 'a.ts', { harnessPreviewBoundary: false }, scan), ['1']);
});
test('script source cache isolates returned arrays, exceptions and invocation instances', () => {
  const cache = createScriptSpecifierCache();
  const original = ['native'];
  const first = cache('source', 'a.ts', {}, () => original);
  first.length = 0;
  original.push('later');
  const second = cache('source', 'a.ts', {}, () => assert.fail('unexpected reparse'));
  assert.deepEqual(second, ['native']);
  second.push('consumer');
  assert.deepEqual(
    cache('source', 'a.ts', {}, () => assert.fail('unexpected reparse')),
    ['native']
  );
  assert.throws(
    () =>
      cache('broken', 'a.ts', {}, () => {
        throw new Error('parse failed');
      }),
    /parse failed/
  );
  assert.deepEqual(
    cache('broken', 'a.ts', {}, () => ['fixed']),
    ['fixed']
  );
  assert.deepEqual(
    createScriptSpecifierCache()('source', 'a.ts', {}, () => ['fresh']),
    ['fresh']
  );
});
test('script source cache capacity falls back to complete parsing', () => {
  const cache = createScriptSpecifierCache();
  let calls = 0;
  for (let i = 0; i < 4096; i++) cache('source', 'file' + i, {}, () => [++calls + '']);
  assert.deepEqual(
    cache('source', 'overflow', {}, () => [++calls + '']),
    ['4097']
  );
  assert.deepEqual(
    cache('source', 'overflow', {}, () => [++calls + '']),
    ['4098']
  );
  assert.deepEqual(
    cache('source', 'file0', {}, () => assert.fail('retained entry lost')),
    ['1']
  );
  const largeCache = createScriptSpecifierCache();
  const large = 'x'.repeat(8 * 1024 * 1024 + 1);
  let largeCalls = 0;
  for (let i = 0; i < 2; i++)
    assert.equal(
      largeCache('source', 'large', {}, () => {
        largeCalls++;
        return [large];
      })[0],
      large
    );
  assert.equal(largeCalls, 2);
});

for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'business identity assignment',
      'let engine=business;engine=engine;engine.compile(bytes);',
      false,
    ],
    ['business earlier binding snapshot', 'let a=business;let b=a;a=b;a.compile(bytes);', false],
    [
      'native identity assignment',
      'let engine=WebAssembly;engine=engine;engine.compile(bytes);',
      true,
    ],
    ['native earlier binding snapshot', 'let a=WebAssembly;let b=a;a=b;a.compile(bytes);', true],
  ])
    test(`WASM binding visit context: ${kind} ${name}`, () => {
      const issues = probeReview('wasm-binding-context', kind, source);
      assert.equal(
        issues.some((issue) => /runtime code compilation.*unverified/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject) assert.deepEqual(issues, []);
    });

for (const kind of ['website', 'harness'])
  for (const computed of [false, true]) {
    test(`WASM cached opaque isolation: ${kind} ${computed ? 'computed' : 'static'} safe deep then shallow`, () => {
      const source = computed
        ? `const a0={compile(){}};${Array.from({ length: 61 }, (_, i) => `const a${i + 1}=a${i};`).join('')}const base={ns:a61};const outer={entry:base[key],entry(){}};outer.entry(bytes);base[key].compile(bytes);`
        : `const base={compile(){}};const a0={...base};${Array.from({ length: 61 }, (_, i) => `const a${i + 1}={...a${i}};`).join('')}const a62={...a61,compile(){}};a62.compile(bytes);a30.compile(bytes);`;
      assert.deepEqual(probeReview('wasm-cache-opaque', kind, source), []);
    });
  }

function scriptAssetPromotionFixture(
  source,
  {
    extension = 'astro',
    assetPath = 'apps/www/src/components/override/surface.png',
    bytes = indexedPng({ includePalette: true }),
    prepare,
  } = {}
) {
  const root = createRoot();
  const implementationPath = `apps/www/src/components/override/Search.${extension}`;
  const websiteBindings = [[implementationPath, ['www.shell.search']]];
  fs.mkdirSync(path.dirname(path.join(root, implementationPath)), { recursive: true });
  fs.writeFileSync(path.join(root, implementationPath), source);
  fs.mkdirSync(path.dirname(path.join(root, assetPath)), { recursive: true });
  fs.writeFileSync(path.join(root, assetPath), bytes);
  prepare?.(root);
  writeValidMatrices(root, { Path: implementationPath }, {}, { websiteBindings });
  const revision = commitFixtureRoot(root);
  writeSelfHostedPromotion(root, revision, {
    websiteBindings,
    matrixOverrides: { Path: implementationPath },
  });
  return { root, assetPath, options: { rootDir: root, ...promotionOptions(revision) } };
}

for (const [name, source, extension] of [
  ['fetch resource', `<script>fetch(new URL('./surface.png', import.meta.url));</script>`, 'astro'],
  ['ordinary import control', `<script>import './surface.png';</script>`, 'astro'],
  ['globalThis URL', `const asset = new globalThis.URL('./surface.png', import.meta.url);`, 'ts'],
  ['window URL', `const asset = new window.URL('./surface.png', import.meta.url);`, 'tsx'],
  [
    'self URL',
    `<script>const asset = new self.URL('./surface.png', import.meta.url);</script>`,
    'vue',
  ],
  [
    'local const target',
    `<script>const assetPath = './surface.png'; fetch(new URL(assetPath, import.meta.url));</script>`,
    'svelte',
  ],
  [
    'query and fragment',
    `<script>fetch(new URL('./surface.png?version=1#surface', import.meta.url));</script>`,
    'html',
  ],
  ['encoded filename', `export const asset = new URL('./%73urface.png', import.meta.url);`, 'mdx'],
  [
    'static computed url base',
    `<script>fetch(new URL('./surface.png', import.meta['url']));</script>`,
    'astro',
  ],
  [
    'type-only shadow is erased',
    `<script>declare const URL: unknown; fetch(new URL('./surface.png', import.meta.url));</script>`,
    'astro',
  ],
  [
    'wrapped static URL and base',
    `<script>fetch(new ((globalThis).URL)('./surface.png', ((import.meta).url)));</script>`,
    'astro',
  ],
  [
    'const-enum rewrite cannot certify a shadow',
    `<script>declare const enum URL { value = 1 } fetch(new URL('./surface.png', import.meta.url));</script>`,
    'astro',
  ],
  [
    'separate business scope',
    `<script>function business(URL) { new URL('./missing.png', import.meta.url); } fetch(new URL('./surface.png', import.meta.url));</script>`,
    'astro',
  ],
]) {
  test(`script asset closure: ${name} accepts unchanged and rejects valid red-to-blue PNG bytes`, () => {
    const { root, assetPath, options } = scriptAssetPromotionFixture(source, { extension });
    assert.deepEqual(collectCoverageMatrixIssues(options), []);
    fs.writeFileSync(
      path.join(root, assetPath),
      indexedPng({ includePalette: true, color: [0, 0, 255] })
    );
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.png.*differs from evidence Commit/u
    );
  });
}

for (const [name, source] of [
  [
    'parameter shadow',
    `function business(URL) { return new URL('./missing.png', import.meta.url); }`,
  ],
  ['array shadow', `const [URL] = business; new URL('./missing.png', import.meta.url);`],
  ['rest shadow', `const { ...URL } = business; new URL('./missing.png', import.meta.url);`],
  ['catch shadow', `try {} catch (URL) { new URL('./missing.png', import.meta.url); }`],
  [
    'hoisted var shadow',
    `function business() { new URL('./missing.png', import.meta.url); var URL; }`,
  ],
  ['TDZ shadow', `{ new URL('./missing.png', import.meta.url); const URL = business; }`],
  [
    'named class shadow',
    `const business = class URL { method() { return new URL('./missing.png', import.meta.url); } };`,
  ],
  [
    'global owner shadow',
    `function business({globalThis}) { return new globalThis.URL('./missing.png', import.meta.url); }`,
  ],
  ['ordinary location base', `new URL('/zh-cn/docs', window.location.href);`],
  ['ordinary localization base', `new URL('/en/docs', 'https://example.com/');`],
  ['base metadata', `new URL('.', import.meta.url); new URL('../', import.meta.url);`],
  ['config directory metadata', `fileURLToPath(new URL('./assets', import.meta.url));`],
]) {
  test(`script asset closure: ${name} preserves supported promotion`, () => {
    const { options } = scriptAssetPromotionFixture(`<script>${source}</script>`, {
      prepare(root) {
        const directory = path.join(root, 'apps/www/src/components/override/assets');
        fs.mkdirSync(directory);
        fs.writeFileSync(path.join(directory, 'metadata.txt'), 'directory fixture');
      },
    });
    assert.deepEqual(collectCoverageMatrixIssues(options), []);
  });
}

for (const [name, target] of [
  ['opaque target', 'assetPath'],
  ['dynamic template', '`./${name}.png`'],
  ['remote asset', `'https://cdn.example/surface.png'`],
  ['protocol-relative asset', `'//cdn.example/surface.png'`],
  ['padded remote asset', `' https://cdn.example/surface.png'`],
  ['missing asset', `'./missing.png'`],
  ['invalid percent encoding', `'./surface%GG.png'`],
  ['encoded NUL', `'./surface%00.png'`],
  ['encoded backslash', `'./surface%5c.png'`],
  ['literal control', `'./sur\\tface.png'`],
  ['public-root escape', `'/%2e%2e/%2e%2e/surface.png'`],
  ['repository escape', `'../../../../../../surface.png'`],
  ['const shadow cannot borrow target', `pathName`],
]) {
  test(`script asset closure: ${name} remains unverified`, () => {
    const source =
      name === 'const shadow cannot borrow target'
        ? `const pathName='./surface.png'; function load([pathName]) { fetch(new URL(pathName, import.meta.url)); }`
        : `fetch(new URL(${target}, import.meta.url));`;
    const { root, options } = scriptAssetPromotionFixture(`<script>${source}</script>`);
    assert.match(validationMessage(root, options), /promotion script resource.*unverified/u);
  });
}

for (const mode of ['file', 'directory']) {
  test(`script asset closure: ${mode} symlink remains unverified`, () => {
    const target = mode === 'file' ? './linked.png' : './linked/surface.png';
    const { root, options } = scriptAssetPromotionFixture(
      `<script>fetch(new URL('${target}', import.meta.url));</script>`,
      {
        prepare(root) {
          const directory = path.join(root, 'apps/www/src/components/override');
          fs.symlinkSync(
            mode === 'file' ? 'surface.png' : '.',
            path.join(directory, mode === 'file' ? 'linked.png' : 'linked'),
            mode === 'file' ? 'file' : 'dir'
          );
        },
      }
    );
    assert.match(
      validationMessage(root, options),
      /promotion script resource.*symlink.*unverified/u
    );
  });
}

for (const [name, assetPath, url] of [
  ['opaque binary bytes', 'apps/www/src/components/override/surface.bin', './surface.bin'],
  ['font bytes', 'apps/www/src/components/override/surface.woff2', './surface.woff2'],
  [
    'source-like extension outside module roots',
    'assets/surface.js',
    '../../../../../assets/surface.js',
  ],
]) {
  test(`script asset closure: ${name} remains a resource-only edge`, () => {
    const { root, options } = scriptAssetPromotionFixture(
      `<script>fetch(new URL('${url}', import.meta.url));</script>`,
      {
        assetPath,
        bytes: Buffer.from(
          "import '@proto.ui/runtime'; throw new Error('must not execute or traverse');"
        ),
      }
    );
    assert.deepEqual(collectCoverageMatrixIssues(options), []);
    fs.writeFileSync(path.join(root, assetPath), Buffer.from("import '@proto.ui/core';"));
    assert.match(
      validationMessage(root, options),
      /promoted dependency.*surface\.(?:bin|js|woff2).*differs from evidence Commit/u
    );
  });
}

test('script asset closure: replacing an evidenced file with a directory cannot become metadata', () => {
  const { root, assetPath, options } = scriptAssetPromotionFixture(
    `<script>fetch(new URL('./surface.png', import.meta.url));</script>`
  );
  assert.deepEqual(collectCoverageMatrixIssues(options), []);
  fs.unlinkSync(path.join(root, assetPath));
  fs.mkdirSync(path.join(root, assetPath));
  assert.match(
    validationMessage(root, options),
    /promotion script resource directory metadata.*unverified/u
  );
});

for (const kind of ['website', 'harness']) {
  test(`script asset closure: ${kind} ordinary source scan does not promote resource or opaque URL to module`, () => {
    assert.deepEqual(
      probeReview(
        '4182138189',
        kind,
        `fetch(new URL('./surface.png', import.meta.url)); fetch(new URL(opaque, import.meta.url));`,
        'ts'
      ),
      []
    );
  });
}

for (const kind of ['website', 'harness'])
  for (const [name, source, reject] of [
    [
      'named native loader',
      "import {createRequire} from 'node:module';const load=createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'renamed native loader',
      "import {createRequire as make} from 'node:module';const load=make(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'namespace native loader',
      "import * as nodeModule from 'node:module';const load=nodeModule.createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'default native loader',
      "import nodeModule from 'node:module';const load=nodeModule.createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'native factory and loader aliases',
      "import {createRequire as make} from 'node:module';const factory=make;const load=factory(import.meta.url);const consume=load;consume('@proto.ui/runtime');",
      true,
    ],
    [
      'native unused factory result',
      "import {createRequire} from 'node:module';const load=createRequire(import.meta.url);",
      false,
    ],
    [
      'business factory name',
      "function createRequire(){return ()=>{}}const load=createRequire(import.meta.url);load('@proto.ui/runtime');",
      false,
    ],
    [
      'business namespace factory',
      "const nodeModule={createRequire(){return ()=>{}}};const load=nodeModule.createRequire(import.meta.url);load('@proto.ui/runtime');",
      false,
    ],
    [
      'business parameter shadows native factory',
      "import {createRequire} from 'node:module';function go(createRequire){const load=createRequire(import.meta.url);load('@proto.ui/runtime');}",
      false,
    ],
    [
      'business destructured parameter shadows native factory',
      "import {createRequire} from 'node:module';function go({createRequire}){const load=createRequire(import.meta.url);load('@proto.ui/runtime');}",
      false,
    ],
    [
      'builtin spelling',
      "import {createRequire} from 'module';createRequire(import.meta.url)('@proto.ui/runtime');",
      true,
    ],
    [
      'namespace destructure',
      "import * as native from 'node:module';const {createRequire: make}=native;const load=make(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'relative unknown loader base',
      "import {createRequire} from 'node:module';const load=createRequire(otherBase);load('./ordinary.js');",
      true,
    ],
    [
      'dynamic loader target',
      "import {createRequire} from 'node:module';const load=createRequire(import.meta.url);load(target);",
      true,
    ],
    [
      'native mutable assignment',
      "import {createRequire} from 'node:module';let load;load=createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'native reassigned to business remains unverified',
      "import {createRequire} from 'node:module';let load=createRequire(import.meta.url);load=business;load('@proto.ui/runtime');",
      true,
    ],
    [
      'business reassigned native',
      "import {createRequire} from 'node:module';let load=business;load=createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'inert resolve path',
      "import {createRequire} from 'node:module';const load=createRequire(import.meta.url);load.resolve('@proto.ui/runtime');",
      false,
    ],
    [
      'same named different imported factory',
      "import {promisify as createRequire} from 'node:util';const load=createRequire(()=>{});load('@proto.ui/runtime');",
      false,
    ],
    [
      'business assignment beside native import',
      "import {createRequire} from 'node:module';let load=business;load=load;load('@proto.ui/runtime');",
      false,
    ],
    [
      'type only factory',
      "import type {createRequire} from 'node:module';const load=createRequire(import.meta.url);load('@proto.ui/runtime');",
      false,
    ],
    [
      'native import after lexical use',
      "const load=createRequire(import.meta.url);load('@proto.ui/runtime');import {createRequire} from 'node:module';",
      true,
    ],
    [
      'business deep aliases beside native import',
      `import {createRequire} from 'node:module';const a0=business;${Array.from({ length: 70 }, (_, i) => `const a${i + 1}=a${i};`).join('')}a70('@proto.ui/runtime');`,
      false,
    ],
    [
      'native deep aliases',
      `import {createRequire} from 'node:module';const a0=createRequire(import.meta.url);${Array.from({ length: 70 }, (_, i) => `const a${i + 1}=a${i};`).join('')}a70('@proto.ui/runtime');`,
      true,
    ],
    [
      'named default namespace import',
      "import {default as native} from 'node:module';const load=native.createRequire(import.meta.url);load('@proto.ui/runtime');",
      true,
    ],
    [
      'later captured loader',
      "import {createRequire} from 'node:module';function run(){load('@proto.ui/runtime');}const load=createRequire(import.meta.url);run();",
      true,
    ],
    [
      'later captured factory',
      "import {createRequire} from 'node:module';function run(){const load=make(import.meta.url);load('@proto.ui/runtime');}const make=createRequire;run();",
      true,
    ],
    [
      'later captured business factory',
      "import {createRequire} from 'node:module';function run(){const load=make();load('@proto.ui/runtime');}const make=()=>()=>{};run();",
      false,
    ],
    [
      'same evaluation domain TDZ',
      "import {createRequire} from 'node:module';load('@proto.ui/runtime');const load=()=>{};",
      false,
    ],
    [
      'deep inert builtin helper',
      `import * as native from 'node:module';const a0=native.isBuiltin;${Array.from({ length: 70 }, (_, i) => `const a${i + 1}=a${i};`).join('')}a70('@proto.ui/runtime');`,
      false,
    ],
    [
      'later captured native assignment',
      "import {createRequire} from 'node:module';let load;function run(){load('@proto.ui/runtime');}load=createRequire(import.meta.url);run();",
      true,
    ],
    [
      'later captured business assignment',
      "import {createRequire} from 'node:module';let load;function run(){load('@proto.ui/runtime');}load=()=>{};run();",
      false,
    ],
    [
      'deep destructured builtin helper',
      `import * as native from 'node:module';const {isBuiltin:a0}=native;${Array.from({ length: 70 }, (_, i) => `const a${i + 1}=a${i};`).join('')}a70('@proto.ui/runtime');`,
      false,
    ],
    [
      'ordinary factory import inert',
      "import {createRequire} from 'node:module';const description='createRequire(import.meta.url)';",
      false,
    ],
  ])
    test(`native Node loader followup: ${kind} ${name}`, () => {
      const issues = probeReview('node-loader', kind, source);
      assert.equal(
        issues.some((issue) => /raw Proto UI import|unresolved dynamic require/u.test(issue)),
        reject,
        issues.join('\n')
      );
      if (!reject)
        assert.deepEqual(
          [
            'business deep aliases beside native import',
            'deep inert builtin helper',
            'deep destructured builtin helper',
          ].includes(name)
            ? issues.filter((issue) => !/runtime code compilation.*unverified/u.test(issue))
            : issues,
          []
        );
    });
test('native Node loader followup: Astro frontmatter is an owned import consumer', () => {
  const issues = probeReview(
    'node-loader-frontmatter',
    'website',
    "---\nimport {createRequire} from 'node:module';const load=createRequire(import.meta.url);load('@proto.ui/runtime');\n---\n<main>Static</main>",
    'astro'
  );
  assert.ok(
    issues.some((issue) => /raw Proto UI import|unresolved dynamic require/u.test(issue)),
    issues.join('\n')
  );
});

test('script asset closure: historical symlink text cannot become current resource bytes', () => {
  const { root, options } = scriptAssetPromotionFixture(
    `<script>fetch(new URL('./linked.bin', import.meta.url));</script>`,
    {
      prepare(root) {
        const dir = path.join(root, 'apps/www/src/components/override');
        fs.writeFileSync(path.join(dir, 'payload.bin'), 'actual resource');
        fs.symlinkSync('payload.bin', path.join(dir, 'linked.bin'));
      },
    }
  );
  assert.match(validationMessage(root, options), /promotion script resource.*symlink.*unverified/u);
  const linked = path.join(root, 'apps/www/src/components/override/linked.bin');
  fs.unlinkSync(linked);
  fs.writeFileSync(linked, 'payload.bin');
  assert.match(
    validationMessage(root, options),
    /promotion script resource historical file identity.*unverified/u
  );
});

for (const [extension, source] of [
  ['astro', '<base href="/assets/"><img src="surface.png" alt="probe">'],
  ['html', '<base href="/assets/"><img src="surface.png" alt="probe">'],
  ['md', '<base href="/assets/">\n\n![probe](surface.png)'],
  ['mdx', '<base href="/assets/" />\n<img src="surface.png" alt="probe" />'],
  ['tsx', 'export const surface=<><base href="/assets/"/><img src="surface.png" alt="probe"/></>;'],
  ['vue', '<template><base href="/assets/"><img src="surface.png" alt="probe"></template>'],
  ['svelte', '<base href="/assets/"><img src="surface.png" alt="probe">'],
])
  test(`document base promotion: ${extension} rejects decoy-relative asset evidence`, () => {
    const { root, options } = scriptAssetPromotionFixture(source, {
      extension,
      prepare(root) {
        const dir = path.join(root, 'apps/www/public/assets');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'surface.png'), indexedPng({ includePalette: true }));
      },
    });
    assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
    fs.writeFileSync(
      path.join(root, 'apps/www/public/assets/surface.png'),
      indexedPng({ includePalette: true, color: [0, 0, 255] })
    );
    assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
  });
for (const [name, source, extension] of [
  ['target only', '<base target="_blank"><img src="surface.png" alt="probe">', 'astro'],
  ['comment', '<!-- <base href="/assets/"> --><img src="surface.png" alt="probe">', 'html'],
  [
    'script example',
    `<script>const example='<base href="/assets/">';</script><img src="surface.png" alt="probe">`,
    'astro',
  ],
  ['fenced example', '```html\n<base href="/assets/">\n```\n\n![probe](surface.png)', 'md'],
  [
    'custom component',
    'export const surface=<><Base href="/assets/"/><img src="surface.png" alt="probe"/></>;',
    'tsx',
  ],
])
  test(`document base promotion: ${name} keeps ordinary bound asset`, () => {
    const { root, assetPath, options } = scriptAssetPromotionFixture(source, { extension });
    assert.deepEqual(collectCoverageMatrixIssues(options), []);
    fs.writeFileSync(
      path.join(root, assetPath),
      indexedPng({ includePalette: true, color: [0, 0, 255] })
    );
    assert.match(validationMessage(root, options), /promoted dependency.*surface\.png.*differs/u);
  });
for (const source of [
  '<base href="../assets/"><img src="surface.png">',
  '<base href=""><img src="surface.png">',
  '<base href={location}><img src="surface.png">',
  '<base {...props}><img src="surface.png">',
])
  test(`document base promotion: remains unverified ${source}`, () => {
    const { root, options } = scriptAssetPromotionFixture(source);
    assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
  });
test('document base promotion: local Astro head base cannot authorize page-relative resources', () => {
  const { root, options } = scriptAssetPromotionFixture('<img src="surface.png">', {
    prepare(root) {
      fs.writeFileSync(
        path.join(root, 'apps/www/astro.config.mjs'),
        `export default {head:[{tag:'base',attrs:{href:'/assets/'}}]};`
      );
    },
  });
  assert.match(
    validationMessage(root, options),
    /promotion config head resources remain unverified/u
  );
});

for (const extension of ['astro', 'tsx', 'svelte', 'html', 'vue', 'mdx'])
  for (const attribute of ['HREF', 'hReF'])
    test(`document base promotion: ${extension} ${attribute} is not a case escape`, () => {
      const raw = `<base ${attribute}="/assets/"/><img src="surface.png"/>`;
      const source = extension === 'tsx' ? `export const sample=<>${raw}</>;` : raw;
      const { root, options } = scriptAssetPromotionFixture(source, { extension });
      assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
    });
for (const attribute of ['HREF', 'hReF'])
  test(`document base promotion: Astro head ${attribute} is not a case escape`, () => {
    const { root, options } = scriptAssetPromotionFixture('<img src="surface.png">', {
      prepare(root) {
        fs.writeFileSync(
          path.join(root, 'apps/www/astro.config.mjs'),
          `export default {head:[{tag:'BASE',attrs:{${attribute}:'/assets/'}}]};`
        );
      },
    });
    assert.match(
      validationMessage(root, options),
      /promotion config head resources remain unverified/u
    );
  });
for (const [name, source, extension] of [
  ['style comment', '<style>/* <base href="/assets/"> */</style><img src="surface.png">', 'astro'],
  ['textarea text', '<textarea><base href="/assets/"></textarea><img src="surface.png">', 'astro'],
  ['title text', '<title><base href="/assets/"></title><img src="surface.png">', 'astro'],
  ['HTML template', '<template><base href="/assets/"></template><img src="surface.png">', 'html'],
  ['Astro template', '<template><base href="/assets/"></template><img src="surface.png">', 'astro'],
  [
    'Svelte style comment',
    '<style>/* <base href="/assets/"> */</style><img src="surface.png">',
    'svelte',
  ],
  ['data attribute', '<base data-href="/assets/"><img src="surface.png">', 'astro'],
])
  test(`document base promotion: ${name} preserves bound bytes`, () => {
    const { root, assetPath, options } = scriptAssetPromotionFixture(source, { extension });
    assert.deepEqual(collectCoverageMatrixIssues(options), []);
    fs.writeFileSync(
      path.join(root, assetPath),
      indexedPng({ includePalette: true, color: [0, 0, 255] })
    );
    assert.match(validationMessage(root, options), /promoted dependency.*surface\.png.*differs/u);
  });
test('document base promotion: inert template does not hide a later active base', () => {
  const { root, options } = scriptAssetPromotionFixture(
    '<template><base href="/safe/"></template><base href="/assets/"><img src="surface.png">',
    { extension: 'html' }
  );
  assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
});

test('document base promotion: foreign title cannot borrow HTML text-only admission', () => {
  const { root, options } = scriptAssetPromotionFixture(
    '<svg><title><base href="/assets/"></title></svg><img src="surface.png">'
  );
  assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
});

test('Vue directive modifier promotion: base property binding cannot certify a decoy-relative asset', () => {
  const { root, options } = scriptAssetPromotionFixture(
    `<template><base v-bind:href.prop="'/assets/'"><img src="surface.png"></template>`,
    {
      extension: 'vue',
      prepare(root) {
        const directory = path.join(root, 'apps/www/public/assets');
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(
          path.join(directory, 'surface.png'),
          indexedPng({ includePalette: true, color: [0, 0, 255] })
        );
      },
    }
  );
  assert.match(validationMessage(root, options), /promotion document base href.*unverified/u);
});

test('Vue directive modifier promotion: resource property binding is not a static byte-bound URL', () => {
  const { root, options } = scriptAssetPromotionFixture(
    `<template><img :src.prop="'surface.png'"></template>`,
    { extension: 'vue' }
  );
  assert.match(validationMessage(root, options), /promotion markup resource URL.*unverified/u);
});

test('Vue directive modifier promotion: v-pre keeps directive-looking base text inert and binds resource bytes', () => {
  const { root, assetPath, options } = scriptAssetPromotionFixture(
    `<template><section v-pre><base v-bind:href.prop="'/assets/'"><img src="surface.png"></section></template>`,
    { extension: 'vue' }
  );
  assert.deepEqual(collectCoverageMatrixIssues(options), []);
  fs.writeFileSync(
    path.join(root, assetPath),
    indexedPng({ includePalette: true, color: [0, 0, 255] })
  );
  assert.match(validationMessage(root, options), /promoted dependency.*surface\.png.*differs/u);
});

test('Vue directive modifier Website: native base property binding remains unverified', () => {
  const issues = probeReview(
    'vue-base-modifier',
    'website',
    `<template><base :href.prop="'https://cdn.example/'"><main>Static</main></template>`,
    'vue'
  );
  assert.ok(
    issues.some((issue) => /(?:dynamic|external) document base href/u.test(issue)),
    issues.join('\n')
  );
});

test('Vue directive modifier Website: v-pre retains inert directive-looking base attributes', () => {
  assert.deepEqual(
    probeReview(
      'vue-base-modifier-inert',
      'website',
      `<template><section v-pre><base :href.prop="'https://cdn.example/'"></section></template>`,
      'vue'
    ),
    []
  );
});

test('Vue directive modifier Website: literal HTML attributes do not acquire Vue binding semantics', () => {
  assert.deepEqual(
    probeReview(
      'html-base-modifier-inert',
      'website',
      `<base :href.prop="'https://cdn.example/'"><main>Static</main>`,
      'html'
    ),
    []
  );
});

test('Vue native base Website: browser preprocessing cannot hide an external href', () => {
  const issues = probeReview(
    'vue-base-preprocessing',
    'website',
    '<template><base href=" \thttps://cdn.example/\r\n "><main>Static</main></template>',
    'vue'
  );
  assert.ok(
    issues.some((issue) => /external document base href/u.test(issue)),
    issues.join('\n')
  );
});

test('Vue native base Website: unsupported template parsing retains an unverified issue', () => {
  const issues = probeReview(
    'vue-base-unparsed',
    'website',
    '<template lang="pug">base(href="https://cdn.example/")</template>',
    'vue'
  );
  assert.ok(
    issues.some((issue) => /dynamic document base href/u.test(issue)),
    issues.join('\n')
  );
});

test('Vue native base Website: bound HTML href names remain case-insensitive', () => {
  const issues = probeReview(
    'vue-base-bound-case',
    'website',
    `<template><base v-bind:HREF.attr="'https://cdn.example/'"></template>`,
    'vue'
  );
  assert.ok(
    issues.some((issue) => /dynamic document base href/u.test(issue)),
    issues.join('\n')
  );
});

for (const extension of ['html', 'astro', 'md', 'mdx', 'vue', 'svelte', 'tsx']) {
  for (const [name, markup, reject] of [
    ['native mixed case', '<sCrIpT src="https://cdn.example/runtime.js"></sCrIpT>', true],
    [
      'application x-ecmascript',
      '<script type="application/x-ecmascript" src="https://cdn.example/runtime.js"></script>',
      true,
    ],
    [
      'text x-ecmascript',
      '<script type="text/x-ecmascript" src="https://cdn.example/runtime.js"></script>',
      true,
    ],
    [
      'component Script',
      '<Script src="https://cdn.example/runtime.js"></Script>',
      ['html', 'md'].includes(extension),
    ],
    [
      'JSON remains inert',
      '<script type="application/json" src="https://cdn.example/data.json"></script>',
      false,
    ],
  ])
    test(`runtime entry latest review: ${extension} ${name}`, () => {
      const source =
        extension === 'tsx'
          ? `export const Surface=()=>(${markup});`
          : extension === 'vue'
            ? `<template>${markup}</template>`
            : markup;
      const issues = probeReview('latest-script-review', 'website', source, extension);
      assert.equal(
        issues.some((issue) => /external executable (?:worker )?script/u.test(issue)),
        reject,
        issues.join('\n')
      );
    });
}

for (const helper of ['browser-harness', 'site-search-evidence']) {
  test(`main test helper boundary: ${helper} is excluded only while unreachable`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    const relative = `apps/www/src/content/docs/zh-cn/${helper}.ts`;
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(
      path.join(root, relative),
      "import '@proto.ui/runtime'; document.addEventListener('click', () => {});"
    );
    assert.doesNotThrow(() => validateCoverageMatrices({ rootDir: root }));
    fs.writeFileSync(
      path.join(root, 'apps/www/src/components/override/Search.astro'),
      `<script>import '../../content/docs/zh-cn/${helper}';</script>`
    );
    const message = validationMessage(root);
    assert.match(message, /raw Proto UI import `@proto.ui\/runtime`/u);
    assert.ok(message.includes(relative));
  });
}

for (const [source, specifiers] of [
  ['Homepage/homepage-text.ts', ['@proto.ui/prototypes-base/text']],
  ['InstallCommandCard.astro', ['@proto.ui/adapter-web-component']],
  ['site-link-recipes.ts', ['@proto.ui/prototypes-base/surface', '@proto.ui/prototypes-base/text']],
  [
    'site-native-controls.ts',
    [
      '@proto.ui/adapter-web-component',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
    ],
  ],
  ['site-search-commands.ts', ['@proto.ui/module-expose-state']],
  ['site-text-recipes.ts', ['@proto.ui/prototypes-base/text']],
  ['surface-recipes.ts', ['@proto.ui/prototypes-base/surface']],
  [
    'site-shadcn-controls.ts',
    ['@proto.ui/prototypes-brutalist/button', '@proto.ui/prototypes-brutalist/select'],
  ],
  [
    'documentation-image-controls.ts',
    [
      '@proto.ui/prototypes-base/button',
      '@proto.ui/prototypes-base/dialog',
      '@proto.ui/prototypes-shadcn/surface',
      '@proto.ui/prototypes-brutalist/surface',
      '@proto.ui/prototypes-shadcn/text',
      '@proto.ui/prototypes-brutalist/text',
    ],
  ],
])
  test(`main source imports remain exact: ${source}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    const relative = `apps/www/src/components/${source}`;
    const copy = `apps/www/src/components/Copied${path.basename(source)}`;
    const code = specifiers.map((specifier) => `import '${specifier}';`).join('\n');
    const content = source.endsWith('.astro') ? `<script>${code}</script>` : code;
    for (const file of [relative, copy]) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), content);
    }
    const message = validationMessage(root);
    for (const specifier of specifiers) {
      assert.ok(
        !message.includes(`raw Proto UI import \`${specifier}\` in \`${relative}\``),
        message
      );
      assert.ok(message.includes(`raw Proto UI import \`${specifier}\` in \`${copy}\``), message);
    }
    fs.writeFileSync(
      path.join(root, relative),
      source.endsWith('.astro')
        ? "<script>import '@proto.ui/runtime';</script>"
        : "import '@proto.ui/runtime';"
    );
    assert.ok(
      validationMessage(root).includes(
        `raw Proto UI import \`@proto.ui/runtime\` in \`${relative}\``
      )
    );
  });

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    ['window open', `window.open("javascript:run()");`, true],
    ['open alias', `const launch=window.open;launch("javascript:run()");`, true],
    ['bare open', `open("javascript:run()");`, true],
    ['business open', `const window={open(){}};window.open("javascript:run()");`, false],
    ['ordinary open', `window.open("https://example.com/");`, false],
    [
      'animation worklet',
      `CSS.animationWorklet.addModule('https://cdn.example/runtime.js');`,
      true,
    ],
    ['layout worklet', `CSS.layoutWorklet.addModule('https://cdn.example/runtime.js');`, true],
    [
      'business CSS',
      `const CSS={layoutWorklet:{addModule(){}}};CSS.layoutWorklet.addModule('https://cdn.example/runtime.js');`,
      false,
    ],
    ['anchor property', `const a=document.createElement('a');a.href='javascript:run()';`, true],
    [
      'anchor attribute',
      `const a=document.createElement('a');a.setAttribute('href','javascript:run()');`,
      true,
    ],
    [
      'anchor namespace attribute',
      `const a=document.createElement('a');a.setAttributeNS(null,'href','javascript:run()');`,
      true,
    ],
    ['business href', `const a={};a.href='javascript:run()';`, false],
    ['ordinary anchor', `const a=document.createElement('a');a.href='/docs/';`, false],
    [
      'namespaced unrelated anchor',
      `const a=document.createElement('a');a.setAttributeNS('urn:business','href','javascript:run()');`,
      false,
    ],
    [
      'JSX stylesheet',
      `export const View=()=> <link rel="stylesheet" href="https://cdn.example/theme.css"/>;`,
      true,
    ],
    [
      'JSX dynamic stylesheet',
      `export const View=()=> <link rel="stylesheet" href={target}/>;`,
      true,
    ],
    [
      'JSX custom Link',
      `export const View=()=> <Link rel="stylesheet" href="https://cdn.example/theme.css"/>;`,
      false,
    ],
    [
      'JSX prefetch',
      `export const View=()=> <link rel="prefetch" href="https://cdn.example/theme.css"/>;`,
      false,
    ],
    [
      'inert link text',
      `const text='<link rel="stylesheet" href="https://cdn.example/theme.css"/>';`,
      false,
    ],
  ])
    test(`unpublished review closure: ${kind} ${name}`, () => {
      const issues = probeReview('unpublished-review-closure', kind, source, 'tsx');
      assert.equal(
        issues.some((issue) =>
          /executable navigation URL|external executable.*script|external stylesheet|dynamic stylesheet/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
    });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    ['open destructure', `const {open:launch}=self;launch('javascript:run()');`, true],
    ['open global member', `globalThis['open']('javascript:run()');`, true],
    ['open parameter shadow', `function run(open){open('javascript:run()');}`, false],
    ['global window parameter', `function run(window){window.open('javascript:run()');}`, false],
    [
      'ordinary business method',
      `const business={open(){}};business.open('javascript:run()');`,
      false,
    ],
    [
      'worklet alias',
      `const worklet=CSS.layoutWorklet;worklet.addModule('https://cdn.example/runtime.js');`,
      true,
    ],
    [
      'CSS parameter shadow',
      `function run(CSS){CSS.animationWorklet.addModule('https://cdn.example/runtime.js');}`,
      false,
    ],
    [
      'button action IDL',
      `const b=document.createElement('button');b.formAction='javascript:run()';`,
      true,
    ],
    [
      'button lowercase expando',
      `const b=document.createElement('button');b.formaction='javascript:run()';`,
      false,
    ],
    [
      'button attribute',
      `const b=document.createElement('button');b.setAttribute('FORMACTION','javascript:run()');`,
      true,
    ],
    [
      'button namespace case',
      `const b=document.createElement('button');b.setAttributeNS(null,'formAction','javascript:run()');`,
      false,
    ],
    [
      'anchor alias',
      `const a=document.createElement('a');const link=a;link.href='javascript:run()';`,
      true,
    ],
    [
      'anchor reassigned business',
      `let a=document.createElement('a');a={};a.href='javascript:run()';`,
      false,
    ],
    [
      'document shadow',
      `function run(document){const a=document.createElement('a');a.href='javascript:run()';}`,
      false,
    ],
    [
      'JSX const style',
      `const href='https://cdn.example/theme.css';export const View=()=> <link rel={'stylesheet'} href={href}/>;`,
      true,
    ],
    [
      'JSX local style',
      `export const View=()=> <link rel={'stylesheet'} href={'/theme.css'}/>;`,
      false,
    ],
    ['JSX link spread', `export const View=()=> <link {...props}/>;`, true],
    ['JSX no href', `export const View=()=> <link rel="stylesheet"/>;`, false],
    [
      'JSX icon',
      `export const View=()=> <link rel="icon" href="https://cdn.example/icon.svg"/>;`,
      false,
    ],
    [
      'JSX encoded relation',
      `export const View=()=> <link rel="style&#115;heet" href="https://cdn.example/theme.css"/>;`,
      true,
    ],
  ])
    test(`unpublished review boundaries: ${kind} ${name}`, () => {
      const issues = probeReview('unpublished-review-boundaries', kind, source, 'tsx');
      assert.equal(
        issues.some((issue) =>
          /executable navigation URL|external executable.*script|external stylesheet|dynamic stylesheet/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
    });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source] of [
    [
      'HTML xlink property',
      `const a=document.createElement('a');a['xlink:href']='javascript:run()';`,
    ],
    [
      'HTML xlink attribute',
      `const a=document.createElement('a');a.setAttribute('xlink:href','javascript:run()');`,
    ],
    [
      'HTML xlink no namespace',
      `const a=document.createElement('a');a.setAttributeNS(null,'xlink:href','javascript:run()');`,
    ],
    [
      'HTML href nonnull namespace',
      `const a=document.createElement('a');a.setAttributeNS('urn:business','href','javascript:run()');`,
    ],
  ])
    test(`unpublished review independent control: ${kind} ${name}`, () => {
      const issues = probeReview('unpublished-review-independent', kind, source, 'tsx');
      assert.equal(
        issues.some((issue) => /executable navigation URL/u.test(issue)),
        false,
        issues.join('\n')
      );
    });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'worker call',
      `navigator.serviceWorker.register.call(navigator.serviceWorker,'https://cdn.example/worker.js');`,
      true,
    ],
    [
      'worker apply',
      `navigator.serviceWorker.register.apply(navigator.serviceWorker,['https://cdn.example/worker.js']);`,
      true,
    ],
    [
      'worker alias call',
      `const sw=navigator.serviceWorker;const register=sw.register;register.call(sw,'https://cdn.example/worker.js');`,
      true,
    ],
    [
      'business register call',
      `const sw={register(){}};sw.register.call(sw,'https://cdn.example/worker.js');`,
      false,
    ],
    [
      'shadowed navigator call',
      `function run(navigator){navigator.serviceWorker.register.call(navigator.serviceWorker,'https://cdn.example/worker.js');}`,
      false,
    ],
    ['Function tag', 'Function`return import("https://cdn.example/runtime.js")`();', true],
    ['Function alias tag', 'const compile=Function;compile`return 1`;', true],
    ['global Function tag', 'globalThis.Function`return 1`;', true],
    ['business Function tag', 'const Function=(parts)=>parts;Function`return 1`;', false],
    ['eval tag does not compile', 'eval`return 1`;', false],
    ['inert template', 'const text=`return import("https://cdn.example/runtime.js")`;', false],
  ])
    registerInvocationReviewTest(kind, name, source, reject);
}
function registerInvocationReviewTest(kind, name, source, reject) {
  test(`new entry invocation review: ${kind} ${name}`, () => {
    const issues = probeReview('new-entry-invocations', kind, source, 'ts');
    assert.equal(
      issues.some((issue) =>
        /external executable.*script|unresolved Worker\/SharedWorker entry|runtime code compilation.*unverified/u.test(
          issue
        )
      ),
      reject,
      issues.join('\n')
    );
  });
}

for (const kind of ['website', 'harness']) {
  for (const [name, source, reject] of [
    [
      'worker apply empty',
      `navigator.serviceWorker.register.apply(navigator.serviceWorker,[]);`,
      true,
    ],
    [
      'worker apply opaque',
      `navigator.serviceWorker.register.apply(navigator.serviceWorker,args);`,
      true,
    ],
    [
      'worker apply spread',
      `navigator.serviceWorker.register.apply(navigator.serviceWorker,[...args]);`,
      true,
    ],
    [
      'worker apply alias',
      `const sw=navigator.serviceWorker;const register=sw.register;register.apply(sw,['https://cdn.example/worker.js']);`,
      true,
    ],
    [
      'business apply',
      `const sw={register(){}};sw.register.apply(sw,['https://cdn.example/worker.js']);`,
      false,
    ],
    ['Function tagged parameter', 'function run(Function){Function`return 1`;}', false],
    ['Function prototype tag', 'Function.prototype`return 1`;', false],
    [
      'Function member business',
      'const service={Function:(parts)=>parts};service.Function`return 1`;',
      false,
    ],
  ])
    test(`new entry invocation boundaries: ${kind} ${name}`, () => {
      const issues = probeReview('new-entry-invocation-boundaries', kind, source, 'ts');
      assert.equal(
        issues.some((issue) =>
          /external executable.*script|unresolved Worker\/SharedWorker entry|runtime code compilation.*unverified/u.test(
            issue
          )
        ),
        reject,
        issues.join('\n')
      );
    });
}

for (const [kind, extension] of [
  ['website', 'html'],
  ['website', 'astro'],
  ['harness', 'html'],
]) {
  for (const [name, source, rejects] of [
    [
      'quoted markers surround native embed',
      '<div data-open="<!--"></div><iframe src="/preview"></iframe><div data-close="-->"></div>',
      true,
    ],
    ['real comment is inert', '<!-- <iframe src="/preview"></iframe> -->', false],
    [
      'quoted markers without embed',
      '<div data-open="<!--"></div><div data-close="-->"></div>',
      false,
    ],
    [
      'script string stays inert',
      '<script>const sample="<iframe src=\'/preview\'></iframe>";</script>',
      false,
    ],
  ])
    test(`embed comment parser review: ${kind} ${extension} ${name}`, () => {
      const issues = probeReview('embed-comment-parser', kind, source, extension);
      assert.equal(
        issues.some((issue) =>
          /unreviewed.*(?:embed|preview)|(?:embed|preview).*not reviewed/iu.test(issue)
        ),
        rejects,
        issues.join('\n')
      );
    });
}

for (const [kind, extension] of [
  ['website', 'html'],
  ['website', 'astro'],
  ['harness', 'html'],
]) {
  for (const [name, source, rejects] of [
    [
      'Unicode before actual comment',
      '😀<!-- <iframe src="/example"></iframe> --><p>Text</p>',
      false,
    ],
    [
      'Unicode before quoted markers',
      '😀<div data-open="<!--"></div><iframe src="/preview"></iframe><div data-close="-->"></div>',
      true,
    ],
    ['actual comment does not join tag bytes', '<i<!-- note -->frame src="/preview">', false],
    [
      'quoted markers in one tag',
      '<div title="<!-- marker -->"><iframe src="/preview"></iframe></div>',
      true,
    ],
    [
      'newline comments retain following embed',
      '<!-- example\n<iframe src="/example"></iframe>\n-->\n<iframe src="/preview"></iframe>',
      true,
    ],
  ])
    test(`embed comment parser boundaries: ${kind} ${extension} ${name}`, () => {
      const issues = probeReview('embed-comment-parser-boundaries', kind, source, extension);
      assert.equal(
        issues.some((issue) =>
          /unreviewed.*(?:embed|preview)|(?:embed|preview).*not reviewed/iu.test(issue)
        ),
        rejects,
        issues.join('\n')
      );
    });
}

for (const [kind, extension] of [
  ['website', 'html'],
  ['website', 'astro'],
  ['harness', 'html'],
])
  test(`embed comment parser UTF-16 suffix: ${kind} ${extension}`, () => {
    const issues = probeReview(
      'embed-comment-utf16-suffix',
      kind,
      '😀<!-- inert --><iframe src="/preview"></iframe>',
      extension
    );
    assert.ok(
      issues.some((issue) =>
        /unreviewed.*(?:embed|preview)|(?:embed|preview).*not reviewed/iu.test(issue)
      ),
      issues.join('\n')
    );
  });

for (const [kind, extension] of [
  ['website', 'html'],
  ['website', 'astro'],
  ['harness', 'html'],
]) {
  for (const text of ['é', '中', '😀', 're\u0301el', 'réel 😀\r\n<iframe/>'])
    test(`embed comment parser non-ASCII body: ${kind} ${extension} ${JSON.stringify(text)}`, () => {
      const issues = probeReview(
        'embed-comment-unicode-body',
        kind,
        `<!-- ${text} --><iframe src="/real"></iframe>`,
        extension
      );
      assert.ok(
        issues.some((issue) =>
          /unreviewed.*(?:embed|preview)|(?:embed|preview).*not reviewed/iu.test(issue)
        ),
        issues.join('\n')
      );
    });
}

for (const [kind, extension] of [
  ['website', 'html'],
  ['website', 'astro'],
  ['harness', 'html'],
]) {
  for (const [name, source, rejects] of [
    [
      'quoted script markers',
      '<div data-open="<script>"></div><iframe src="/preview"></iframe><div data-close="</script>"></div>',
      true,
    ],
    [
      'quoted mixed script markers',
      '<div data-open="<sCrIpT>"></div><iframe src="/preview"></iframe><div data-close="</sCrIpT>"></div>',
      true,
    ],
    [
      'actual script example',
      '<script>const sample="<iframe src=\'/preview\'></iframe>";</script>',
      false,
    ],
    [
      'actual Unicode script with active suffix',
      '<script>const sample="é中😀";</script><iframe src="/real"></iframe>',
      true,
    ],
    [
      'Unicode prefix and quoted markers',
      '😀<div data-open="<script>"></div><iframe src="/preview"></iframe><div data-close="</script>"></div>',
      true,
    ],
    [
      'quoted script markers without embed',
      '<div data-open="<script>"></div><div data-close="</script>"></div>',
      false,
    ],
  ])
    test(`embed script parser review: ${kind} ${extension} ${name}`, () => {
      const issues = probeReview('embed-script-parser', kind, source, extension);
      assert.equal(
        issues.some((issue) =>
          /unreviewed.*(?:embed|preview)|(?:embed|preview).*not reviewed/iu.test(issue)
        ),
        rejects,
        issues.join('\n')
      );
    });
}
for (const [name, content, rejects] of [
  [
    'frontmatter example',
    `---\nconst sample='<iframe src="/example"></iframe>';\n---\n<p>Text</p>`,
    false,
  ],
  [
    'frontmatter followed active embed',
    `---\nconst sample='<script>😀</script>';\n---\n<iframe src="/real"></iframe>`,
    true,
  ],
  ['component Script keeps child markup', '<Script><iframe src="/real"></iframe></Script>', true],
])
  test(`embed script parser Astro context: ${name}`, () => {
    const issues = probeReview('embed-script-astro-context', 'website', content, 'astro');
    assert.equal(
      issues.some((issue) => /unreviewed.*embed/iu.test(issue)),
      rejects,
      issues.join('\n')
    );
  });

test('embed script parser preserves the separate Harness import-map gate', () => {
  const issues = probeReview(
    'embed-script-import-map',
    'harness',
    '<script type="importmap">{"imports":{"runtime":"https://cdn.example/runtime.js"}}</script>',
    'html'
  );
  assert.ok(
    issues.some((issue) => /import.?map/iu.test(issue)),
    issues.join('\n')
  );
});

function auditResolverFixture() {
  const root = createRoot();
  writeReviewedPromotionConfig(root);
  const packageRoot = path.join(root, 'packages/core');
  fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ exports: { '.': './dist/index.js' } })
  );
  fs.writeFileSync(path.join(packageRoot, 'src/index.ts'), 'export const value=1;');
  commitFixtureRoot(root);
  return {
    root,
    config: path.join(root, 'apps/www/astro.config.mjs'),
    plugin: path.join(root, 'apps/www/scripts/contrast-provenance.mjs'),
    target: path.join(packageRoot, 'src/index.ts'),
  };
}

test('audit resolver profile: exact audited helper is mandatory evidence metadata', () => {
  const { root, config, plugin, target } = auditResolverFixture();
  const metadata = new Set();
  assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
  assert.ok(metadata.has(config));
  assert.ok(metadata.has(plugin));
});

test('audit resolver profile: reviewed standard profile remains independently admitted without audit helper', () => {
  const { root, config, plugin, target } = auditResolverFixture();
  const original = fs.readFileSync(
    new URL('./fixtures/promotion-resolver-original-857.txt', import.meta.url),
    'utf8'
  );
  assert.equal(
    createHash('sha256').update(original).digest('hex'),
    'd96e4e9086541e713e95f1fa8cda44a7af04795f37f4a91f9f3f93de75ea9f30'
  );
  fs.writeFileSync(config, original);
  fs.unlinkSync(plugin);
  const metadata = new Set();
  assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
  assert.ok(!metadata.has(plugin));
});

test('audit resolver profile: exact historical audit configuration remains admitted with its helper', () => {
  const { root, config, plugin, target } = auditResolverFixture();
  const historical = fs.readFileSync(
    new URL('./fixtures/promotion-resolver-original-audit.txt', import.meta.url),
    'utf8'
  );
  assert.equal(
    createHash('sha256').update(historical).digest('hex'),
    'b07dfc4350c16a8bee3b65717887cc5d592002f2cb492e134c60a3d18519a6de'
  );
  fs.writeFileSync(config, historical);
  const metadata = new Set();
  assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
  assert.ok(metadata.has(plugin));
  fs.appendFileSync(plugin, '\n// unreviewed change');
  assert.throws(
    () => promotionBarePackageTargets(root, '@proto.ui/core', new Set()),
    /audit resolver plugin.*unrecognized/
  );
});

test('audit resolver profile: reviewed Finf non-audit counterpart needs no audit helper', () => {
  const { root, config, plugin, target } = auditResolverFixture();
  fs.copyFileSync(
    new URL('./fixtures/promotion-resolver-original-finf-audit.txt', import.meta.url),
    config
  );
  const current = fs
    .readFileSync(config, 'utf8')
    .replace("import { contrastProvenancePlugin } from './scripts/contrast-provenance.mjs';\n", '')
    .replace(
      `    plugins: [
      ...(process.env.PROTO_UI_CONTRAST_AUDIT === '1'
        ? [contrastProvenancePlugin(repositoryRoot)]
        : []),
      protoUiSourcePlugin,
      websiteBundleGraphPlugin(),
      tailwindcss(),
    ],`,
      '    plugins: [protoUiSourcePlugin, websiteBundleGraphPlugin(), tailwindcss()],'
    );
  assert.equal(
    createHash('sha256').update(current).digest('hex'),
    '368441f22060c0a9adec23a98320e87fb68df4b64c1a3d8e7e3ff3877944f475'
  );
  fs.writeFileSync(config, current);
  fs.unlinkSync(plugin);
  const metadata = new Set();
  assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
  assert.ok(!metadata.has(plugin));
});

for (const defect of [
  'missing-helper',
  'changed-helper',
  'helper-symlink',
  'helper-parent-symlink',
  'helper-directory',
  'unknown-config',
  'changed-resolver',
  'config-symlink',
]) {
  test(`audit resolver profile: rejects ${defect}`, () => {
    const { root, config, plugin } = auditResolverFixture();
    if (defect === 'missing-helper') fs.unlinkSync(plugin);
    if (defect === 'changed-helper') fs.appendFileSync(plugin, '\n// unreviewed plugin shape\n');
    if (defect === 'helper-symlink' || defect === 'config-symlink') {
      const target = defect === 'helper-symlink' ? plugin : config;
      const copy = `${target}.copy`;
      fs.renameSync(target, copy);
      fs.symlinkSync(copy, target);
    }
    if (defect === 'helper-parent-symlink') {
      const parent = path.dirname(plugin),
        copy = `${parent}-copy`;
      fs.renameSync(parent, copy);
      fs.symlinkSync(copy, parent, 'dir');
    }
    if (defect === 'helper-directory') {
      fs.unlinkSync(plugin);
      fs.mkdirSync(plugin);
    }
    if (defect === 'unknown-config') fs.appendFileSync(config, '\n// unknown config profile\n');
    if (defect === 'changed-resolver')
      fs.writeFileSync(
        config,
        fs
          .readFileSync(config, 'utf8')
          .replace(".replace('./dist/', './src/')", ".replace('./dist/', './foreign/')")
      );
    assert.throws(
      () => promotionBarePackageTargets(root, '@proto.ui/core', new Set()),
      /(?:resolver configuration|audit resolver plugin).*unrecognized|symlink.*unverified/
    );
  });
}

test('Finf demo raw imports remain bounded to reviewed association and Bootstrap fixture paths', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    ['apps/www/src/components/PrototypePreviewer/demo-associations.ts', '@proto.ui/core', false],
    ['apps/www/src/components/PrototypePreviewer/demo-associations.ts', '@proto.ui/runtime', true],
    [
      'apps/www/src/pages/en/test/bootstrap-state-controls.astro',
      '@proto.ui/prototypes-bootstrap-2-3-2',
      false,
    ],
    ['apps/www/src/pages/en/test/bootstrap-state-controls.astro', '@proto.ui/adapter-react', true],
    ['apps/www/src/components/OrdinaryAssociationController.ts', '@proto.ui/core', true],
    ['apps/www/src/content/docs/field-demo.shared.ts', '@proto.ui/prototypes-base/field', false],
    ['apps/www/src/content/docs/field-demo.shared.ts', '@proto.ui/runtime', true],
    ['apps/www/src/content/docs/field-demo.shared.ts', '@proto.ui/prototypes-base/select', true],
    ['apps/www/src/content/docs/unreviewed-field.demo.ts', '@proto.ui/prototypes-base/field', true],
  ];
  for (const [sourcePath, specifier] of cases) {
    const absolute = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const previous = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    const code = `import * as observed from '${specifier}'; console.log(observed);`;
    fs.writeFileSync(
      absolute,
      previous + (sourcePath.endsWith('.astro') ? `\n<script>${code}</script>\n` : `\n${code}\n`)
    );
  }
  const message = validationMessage(root);
  for (const [sourcePath, specifier, rejected] of cases) {
    assert.equal(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${sourcePath}\` escapes the website consumer-wall allowlist`
      ),
      rejected
    );
  }
  // An import allowance does not classify or approve new surrounding UI owners.
  assert.match(message, /OrdinaryAssociationController/);
});

test('retry resolver profile: exact helper is bound as immutable metadata', () => {
  const { root, config, plugin, target } = auditResolverFixture();
  const retry = path.join(root, 'apps/www/scripts/runtime-retry-urls.mjs');
  const metadata = new Set();
  assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
  assert.ok(metadata.has(config));
  assert.ok(metadata.has(plugin));
  assert.ok(metadata.has(retry));
});
for (const defect of ['missing', 'changed', 'symlink', 'parent-symlink', 'directory']) {
  test(`retry resolver profile: rejects ${defect} helper`, () => {
    const { root } = auditResolverFixture();
    const retry = path.join(root, 'apps/www/scripts/runtime-retry-urls.mjs');
    if (defect === 'missing') fs.unlinkSync(retry);
    if (defect === 'changed') fs.appendFileSync(retry, '\n// changed closed URL map');
    if (defect === 'symlink') {
      fs.renameSync(retry, retry + '.copy');
      fs.symlinkSync(retry + '.copy', retry);
    }
    if (defect === 'parent-symlink') {
      const parent = path.dirname(retry);
      fs.renameSync(parent, parent + '.copy');
      fs.symlinkSync(parent + '.copy', parent, 'dir');
    }
    if (defect === 'directory') {
      fs.unlinkSync(retry);
      fs.mkdirSync(retry);
    }
    assert.throws(
      () => promotionBarePackageTargets(root, '@proto.ui/core', new Set()),
      /retry resolver plugin.*unrecognized|symlink.*unverified/
    );
  });
}

for (const scenario of [
  'renderer',
  'react',
  'vue',
  'vue2',
  'foreign-owner',
  'unknown-virtual',
  'missing-plugin',
  'changed-config',
]) {
  test(`Finf retry virtual boundary: ${scenario}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    writeReviewedPromotionConfig(root);
    const owner =
      scenario === 'foreign-owner'
        ? 'apps/www/src/components/ForeignRuntime.ts'
        : ['react', 'vue', 'vue2'].includes(scenario)
          ? `apps/www/src/components/PrototypePreviewer/runtimes/${scenario}-runtime.ts`
          : 'apps/www/src/components/PrototypePreviewer/demo-renderer.ts';
    const specifier =
      scenario === 'unknown-virtual'
        ? 'virtual:proto-ui/foreign'
        : 'virtual:proto-ui/runtime-retry-urls';
    const absolute = path.join(root, owner);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `import urls from '${specifier}'; export const observed=urls;`);
    if (scenario === 'missing-plugin')
      fs.unlinkSync(path.join(root, 'apps/www/scripts/runtime-retry-urls.mjs'));
    if (scenario === 'changed-config')
      fs.appendFileSync(
        path.join(root, 'apps/www/astro.config.mjs'),
        '\n// changed virtual binding'
      );
    const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
    assert.equal(
      message.includes(
        `external executable script \`${specifier}\` in \`${owner}\` is not reviewed`
      ),
      ['foreign-owner', 'unknown-virtual', 'missing-plugin', 'changed-config'].includes(scenario)
    );
  });
}
for (const scenario of ['exact', 'changed-source', 'foreign-owner']) {
  test(`Finf retry dynamic import boundary: ${scenario}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    const owner =
      scenario === 'foreign-owner'
        ? 'apps/www/src/components/ForeignRetry.ts'
        : 'apps/www/src/components/PrototypePreviewer/runtimes/retryable-module.ts';
    const target = path.join(root, owner);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(
      new URL(
        '../../../apps/www/src/components/PrototypePreviewer/runtimes/retryable-module.ts',
        import.meta.url
      ),
      target
    );
    if (scenario === 'changed-source') fs.appendFileSync(target, '\n// changed import source');
    const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
    assert.equal(
      message.includes(`@vite-ignore dynamic import in \`${owner}\` is not reviewed`),
      scenario !== 'exact'
    );
  });
}
test('Finf optical imports admit exact host helpers and reject unrelated runtime imports', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/PrototypePreviewer/preview-material-provider.ts',
      '@proto.ui/core',
      false,
    ],
    [
      'apps/www/src/components/PrototypePreviewer/preview-material-provider.ts',
      '@proto.ui/runtime',
      true,
    ],
    [
      'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
      '@proto.ui/adapter-base/web-material',
      false,
    ],
    [
      'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
      '@proto.ui/adapter-react',
      true,
    ],
    ['apps/www/src/components/ForeignMaterial.ts', '@proto.ui/adapter-base/web-material', true],
  ];
  for (const [owner, specifier] of cases) {
    const target = path.join(root, owner);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, `import '${specifier}';\n`);
  }
  const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
  for (const [owner, specifier, rejected] of cases)
    assert.equal(
      message.includes(`raw Proto UI import \`${specifier}\` in \`${owner}\` escapes`),
      rejected
    );
});

for (const scenario of [
  'exact',
  'unrelated-path',
  'changed-bytes',
  'symlink',
  'foreign-consumer',
]) {
  test(`Finf optical host binding: ${scenario}`, () => {
    const root = createRoot();
    const owner = 'www.demo.raw-adapter-runtimes';
    const source =
      scenario === 'unrelated-path'
        ? 'packages/adapters/base/src/material/unreviewed.ts'
        : 'packages/adapters/base/src/material/program-pool.ts';
    const target = path.join(root, source);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(
      new URL('../../../packages/adapters/base/src/material/program-pool.ts', import.meta.url),
      target
    );
    writeValidMatrices(root, {}, {}, { websiteBindings: [[source, [owner]]] });
    if (scenario === 'changed-bytes') fs.appendFileSync(target, '\n// changed host resource owner');
    if (scenario === 'symlink') {
      fs.renameSync(target, target + '.copy');
      fs.symlinkSync(target + '.copy', target);
    }
    let foreign;
    if (scenario === 'foreign-consumer') {
      foreign = 'apps/www/src/components/ForeignOptical.ts';
      const absolute = path.join(root, foreign);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      let specifier = path.relative(path.dirname(absolute), target).replaceAll('\\', '/');
      fs.writeFileSync(absolute, `import '${specifier}';`);
    }
    const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
    if (scenario === 'unrelated-path')
      assert.match(message, /source binding must name exactly one/);
    else if (scenario === 'changed-bytes' || scenario === 'symlink')
      assert.match(message, /exact optical host source, digest and owner remain unverified/);
    else if (scenario === 'foreign-consumer')
      assert.ok(
        message.includes(`in \`${foreign}\` escapes the website consumer-wall allowlist`),
        message
      );
    else assert.equal(message, '');
  });
}

for (const audit of [true, false]) {
  test(`main #875 profile remains exact and independently admitted (audit=${audit})`, () => {
    const { root, config, plugin, target } = auditResolverFixture();
    let source = fs.readFileSync(
      new URL('./fixtures/promotion-resolver-main-f64-audit.txt', import.meta.url),
      'utf8'
    );
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      'f9736918dfcf0d1eaffc9205e562e18bedcbb61df085ebc20bdbb7ed36f716ee'
    );
    if (!audit) {
      source = source
        .replace(
          "import { contrastProvenancePlugin } from './scripts/contrast-provenance.mjs';\n",
          ''
        )
        .replace(
          `    plugins: [
      ...(process.env.PROTO_UI_CONTRAST_AUDIT === '1'
        ? [contrastProvenancePlugin(repositoryRoot)]
        : []),
      protoUiSourcePlugin,
      websiteBundleGraphPlugin(),
      tailwindcss(),
    ],`,
          '    plugins: [protoUiSourcePlugin, websiteBundleGraphPlugin(), tailwindcss()],'
        );
      assert.equal(
        createHash('sha256').update(source).digest('hex'),
        '21c1a41e74c5ac1d03a9f71cd8c9feb401cc4e3d143df6eb7d1a03b4c510d377'
      );
      fs.unlinkSync(plugin);
    }
    fs.writeFileSync(config, source);
    const metadata = new Set();
    assert.deepEqual(promotionBarePackageTargets(root, '@proto.ui/core', metadata), [target]);
    assert.equal(metadata.has(plugin), audit);
    if (audit) {
      fs.appendFileSync(plugin, '\n// unreviewed helper');
      assert.throws(
        () => promotionBarePackageTargets(root, '@proto.ui/core', new Set()),
        /audit resolver plugin.*unrecognized/
      );
    } else {
      fs.appendFileSync(config, '\n// unreviewed config');
      assert.throws(
        () => promotionBarePackageTargets(root, '@proto.ui/core', new Set()),
        /configuration is unrecognized/
      );
    }
  });
}

for (const name of ['acceptance', 's2', 's3', 's4', 's5']) {
  test(`Shadow split exact import boundary: ${name}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    const relative = `apps/www/src/components/PrototypePreviewer/shadow-split-${name}.ts`;
    const original = fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');
    const absolute = path.join(root, relative);
    const copied = relative.replace('.ts', '-unreviewed.ts');
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, original);
    fs.writeFileSync(path.join(root, copied), original);
    const raw = (file, specifier = '@proto.ui/adapter-web-component') =>
      `raw Proto UI import \`${specifier}\` in \`${file}\``;
    const before = validationMessage(root);
    assert.ok(!before.includes(raw(relative)), before);
    assert.ok(before.includes(raw(copied)), before);
    fs.writeFileSync(absolute, original + '\n// changed source requires another review\n');
    assert.ok(validationMessage(root).includes(raw(relative)));
    fs.writeFileSync(absolute, original + "\nimport '@proto.ui/runtime';\n");
    assert.ok(validationMessage(root).includes(raw(relative, '@proto.ui/runtime')));
  });
}

for (const source of ['site-startup-paint.ts', 'snapshot-prototype-style.ts']) {
  for (const scenario of ['exact', 'foreign', 'changed', 'adjacent-import', 'dynamic-css']) {
    test(`startup prerender import boundary: ${source} ${scenario}`, () => {
      const root = createRoot();
      writeValidMatrices(root);
      const reviewed = `apps/www/src/components/${source}`;
      const owner = scenario === 'foreign' ? `apps/www/src/components/Foreign-${source}` : reviewed;
      const target = path.join(root, owner);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(new URL(`../../../${reviewed}`, import.meta.url), target);
      if (scenario === 'changed') fs.appendFileSync(target, '\n// unreviewed source change');
      if (scenario === 'adjacent-import')
        fs.appendFileSync(target, "\nimport '@proto.ui/prototypes-shadcn/checkbox';");
      if (scenario === 'dynamic-css')
        fs.appendFileSync(
          target,
          "\nconst link=document.createElement('link');link.rel='stylesheet';link.href=window.location.hash;"
        );
      const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
      const escaped = message.includes(
        `in \`${owner}\` escapes the website consumer-wall allowlist`
      );
      assert.equal(escaped, scenario !== 'exact', message);
      if (scenario === 'adjacent-import')
        assert.ok(message.includes('prototypes-shadcn/checkbox'), message);
      if (scenario === 'dynamic-css') assert.match(message, /dynamic stylesheet source/);
    });
  }
}
for (const scenario of [
  'exact',
  'wrong-owner',
  'changed-bytes',
  'adjacent-path',
  'foreign-consumer',
]) {
  test(`startup prerender event source binding: ${scenario}`, () => {
    const root = createRoot();
    const source =
      scenario === 'adjacent-path'
        ? 'packages/modules/event/src/foreign-kernel.ts'
        : 'packages/modules/event/src/kernel.ts';
    const target = path.join(root, source);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(
      new URL('../../../packages/modules/event/src/kernel.ts', import.meta.url),
      target
    );
    const owner = scenario === 'wrong-owner' ? 'www.search.launcher' : 'www.build.style-generation';
    writeValidMatrices(root, {}, {}, { websiteBindings: [[source, [owner]]] });
    if (scenario === 'changed-bytes') fs.appendFileSync(target, '\n// changed event semantics');
    let foreign;
    if (scenario === 'foreign-consumer') {
      foreign = 'apps/www/src/components/ForeignStartup.ts';
      const file = path.join(root, foreign);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "import '../../../../packages/modules/event/src/kernel';");
    }
    const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
    if (scenario === 'adjacent-path') assert.match(message, /source binding must name exactly one/);
    else if (scenario === 'wrong-owner' || scenario === 'changed-bytes')
      assert.match(message, /exact startup event source, digest and build owner remain unverified/);
    else if (scenario === 'foreign-consumer')
      assert.ok(
        message.includes(`in \`${foreign}\` escapes the website consumer-wall allowlist`),
        message
      );
    else assert.equal(message, '');
  });
}

for (const [source, allowed] of [
  ['UiLibraryGallery.astro', '../../../../packages/prototypes/brutalist/src/theme'],
  ['library-card-client.ts', '@proto.ui/adapter-web-component'],
  ['library-card-prototypes.ts', '@proto.ui/prototypes-brutalist/card'],
]) {
  test(`library card import boundary remains exact and content-bound: ${source}`, () => {
    const root = createRoot();
    writeValidMatrices(root);
    const relative = `apps/www/src/components/${source}`;
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const reviewed = fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');
    fs.writeFileSync(file, reviewed);
    const rawIssue = `raw Proto UI import \`${allowed}\` in \`${relative}\``;
    assert.ok(
      !collectCoverageMatrixIssues({ rootDir: root }).join('\n').includes(rawIssue),
      'exact reviewed import is admitted'
    );
    const foreign = `apps/www/src/components/copied-${source}`;
    fs.writeFileSync(path.join(root, foreign), reviewed);
    assert.ok(
      validationMessage(root).includes(`raw Proto UI import \`${allowed}\` in \`${foreign}\``)
    );
    fs.writeFileSync(file, reviewed + '\n// Changed source bytes require review.\n');
    assert.ok(
      validationMessage(root).includes(rawIssue),
      'same path with altered bytes is rejected'
    );
    const extra = source.endsWith('.astro')
      ? "\n<script>import '@proto.ui/adapter-react';</script>"
      : "\nimport '@proto.ui/adapter-react';";
    fs.writeFileSync(file, reviewed + extra);
    assert.ok(
      validationMessage(root).includes(
        `raw Proto UI import \`@proto.ui/adapter-react\` in \`${relative}\``
      )
    );
  });
}

for (const scenario of ['exact', 'unreviewed-sibling', 'foreign-consumer', 'dynamic-css']) {
  test(`Finf continuous optical closure: ${scenario}`, () => {
    const root = createRoot();
    const material = 'packages/adapters/base/src/material/';
    const write = (name, source) => {
      const target = path.join(root, material, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    };
    for (const name of ['program-pool.ts', 'contact-carrier.ts'])
      write(name, fs.readFileSync(new URL(`../../../${material}${name}`, import.meta.url), 'utf8'));
    write('program.ts', "import './contact-profile'; import './source'; export {};");
    write('contact-profile.ts', "import './liquidgl-kernel.generated'; export {};");
    write('source.ts', "import './contact-carrier'; export {};");
    for (const name of ['image-prepare.ts', 'liquidgl-kernel.generated.ts', 'paint-mutations.ts'])
      write(name, 'export {};');
    const entryPath = 'apps/www/src/pages/en/test/liquid-glass-material.astro';
    const entry = path.join(root, entryPath);
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    const entryImport = path
      .relative(path.dirname(entry), path.join(root, material, 'program-pool'))
      .replaceAll('\\', '/');
    fs.writeFileSync(entry, `<script>import '${entryImport}';</script>`);
    writeValidMatrices(
      root,
      { Path: entryPath, Evidence: entryPath },
      {},
      {
        websiteBindings: [
          [material + 'program-pool.ts', ['www.demo.raw-adapter-runtimes']],
          [entryPath, ['www.shell.search']],
        ],
      }
    );
    if (scenario === 'unreviewed-sibling') {
      fs.appendFileSync(path.join(root, material, 'source.ts'), "import './unreviewed';");
      write('unreviewed.ts', 'export {};');
    }
    if (scenario === 'foreign-consumer') {
      const foreign = path.join(root, 'apps/www/src/components/ForeignContact.ts');
      fs.mkdirSync(path.dirname(foreign), { recursive: true });
      fs.writeFileSync(foreign, `import '../../../../${material}contact-carrier';`);
    }
    if (scenario === 'dynamic-css')
      write(
        'contact-carrier.ts',
        `export function install(document: Document, css: string) {
        const node = document.createElement('style'); node.textContent = css;
      }`
      );
    const message = collectCoverageMatrixIssues({ rootDir: root }).join('\n');
    if (scenario === 'exact') assert.equal(message, '');
    else if (scenario === 'dynamic-css') assert.match(message, /DOM style body.*unverified/);
    else if (scenario === 'unreviewed-sibling')
      assert.match(message, /raw Proto UI import `\.\/unreviewed`.*escapes/);
    else assert.match(message, /ForeignContact\.ts.*escapes/);
  });
}

test('Hero fixed-icon import remains exact, content-bound and owner-bound', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relative = 'apps/www/src/components/Homepage/home-action-icons.ts';
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const reviewed = fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8');
  const allowed = '@proto.ui/prototypes-lucide/icons/arrow-right';
  const rawIssue = `raw Proto UI import \`${allowed}\` in \`${relative}\``;
  fs.writeFileSync(file, reviewed);
  assert.ok(!collectCoverageMatrixIssues({ rootDir: root }).join('\n').includes(rawIssue));
  const foreign = 'apps/www/src/components/copied-home-action-icons.ts';
  fs.writeFileSync(path.join(root, foreign), reviewed);
  assert.ok(
    validationMessage(root).includes(`raw Proto UI import \`${allowed}\` in \`${foreign}\``)
  );
  fs.writeFileSync(file, reviewed + '\n// unreviewed bytes\n');
  assert.ok(validationMessage(root).includes(rawIssue));
  fs.writeFileSync(file, reviewed.replace(allowed, '@proto.ui/prototypes-lucide/icons/arrow-left'));
  assert.ok(
    validationMessage(root).includes(
      'raw Proto UI import `@proto.ui/prototypes-lucide/icons/arrow-left`'
    )
  );
});
