import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const prefix = 'apps/www/public/diagrams/';
const generator = 'apps/www/scripts/generate-whitepaper-diagrams.mjs';
const groups = [
  {
    name: 'component-anatomy',
    variants: ['en', 'zh-cn', 'mobile.en', 'mobile.zh-cn'],
    kind: 'generated',
    mobileEntrypoint: 'anatomyMobile',
    entrypoint: 'anatomy',
    captureProfile: 'component-anatomy',
    reason:
      'Keep the Root/Thumb ownership comparison and the independent Select parts. The fixed Caret is a boundary example, not a new Base part or a prescribed Host tree.',
  },
  {
    name: 'switch-activation',
    variants: ['en', 'zh-cn', 'mobile.en', 'mobile.zh-cn'],
    kind: 'generated',
    mobileEntrypoint: 'activationMobile',
    entrypoint: 'activation',
    captureProfile: 'switch-activation',
    reason:
      'Keep the landed uncontrolled, enabled Switch example: Root owns checked; Expose reaches App Maker; Context reaches Thumb; both request their own Feedback. Arrow placement does not promise synchronous callbacks.',
  },
  {
    name: 'conditional-consistency',
    variants: ['en', 'zh-cn', 'mobile.en', 'mobile.zh-cn'],
    kind: 'generated',
    mobileEntrypoint: 'consistencyMobile',
    entrypoint: 'consistency',
    captureProfile: 'conditional-consistency',
    reason:
      'Keep the obligations baseline and aligned condition-to-comparison rows. The rows are not automatic tiers and do not claim complete cross-Host evidence.',
  },
  {
    name: 'evolution-feedback',
    variants: ['en', 'zh-cn', 'mobile.en', 'mobile.zh-cn'],
    kind: 'generated',
    entrypoint: 'evolution',
    mobileEntrypoint: 'evolutionMobile',
    captureProfile: 'evolution-feedback',
    reason:
      'Keep the three concurrent work lines, evidence, four alternative diagnoses and explicit revise/test-again loop. The mobile layout preserves the same meaning; its readability requires its own evidence.',
  },
  {
    name: 'component-boundary',
    variants: ['en', 'zh-cn'],
    kind: 'authored-export',
    reason:
      'Keep the author layout: independent Event/Props/Expose/Context requires a Component; Feedback-only structure may remain attached. Preserve the distinction between may and must.',
  },
  {
    name: 'translation-responsibility',
    variants: ['en', 'zh-cn'],
    kind: 'authored-export',
    reason:
      'Keep the runtime Adapter responsibility map, required host facts/operations and attribution. Its illustrative Flutter/Qt targets do not promise equal delivery or describe the thin compiler path.',
  },
  {
    name: 'information-channels',
    variants: [null],
    kind: 'authored-export',
    reason:
      'Keep the five directed relations between User, App Maker and Component. Context allows both directions without specifying callback scheduling; the bilingual article supplies the explanation.',
  },
  {
    name: 'lifecycle',
    variants: [null],
    kind: 'authored-export',
    reason:
      'Keep the author timeline separating setup, repeatable mount epochs and terminal disposal. A repeated mount is not a new instance and detach is not terminal disposal.',
  },
  {
    name: 'information-flow-model',
    variants: [null],
    kind: 'retained-legacy',
    captureProfile: 'information-flow-model',
    reason:
      'Keep the canonical chapter 2 comparison and the original State/Lifecycle/Meta content. Anatomy does not rename Meta; these internal dimensions are not additional channels. Draft legacy articles are retained references, not production routes.',
  },
];

export const diagramDecisions = Object.freeze(
  groups.flatMap((group) =>
    group.variants.map((variant) =>
      Object.freeze({
        asset: `${prefix}${group.kind === 'retained-legacy' ? '' : 'whitepaper-'}${group.name}${variant ? `.${variant}` : ''}.svg`,
        kind: group.kind,
        originalInventory: !variant?.startsWith('mobile.'),
        editableSource: group.kind === 'generated' ? generator : null,
        ...(group.entrypoint
          ? {
              entrypoint: variant?.startsWith('mobile.')
                ? group.mobileEntrypoint
                : group.entrypoint,
            }
          : {}),
        captureProfile: group.captureProfile ?? null,
        disposition: 'keep',
        reason: group.reason,
      })
    )
  )
);

export function collectDiagramInventory(root, revision, decisions = diagramDecisions) {
  assert.match(revision, /^[a-f0-9]{40}$/, 'Inventory requires a full commit SHA');
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { maxBuffer: 32 * 1024 * 1024 });
  assert.equal(git('rev-parse', '--verify', `${revision}^{commit}`).toString().trim(), revision);
  const files = new Map(
    git('ls-tree', '-rz', revision)
      .toString()
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const [header, path] = entry.split('\t');
        const [mode, type, blob] = header.split(' ');
        return [path, { path, mode, type, blob }];
      })
  );
  const bytes = new Map();
  const read = (path) => {
    const file = files.get(path);
    assert.ok(
      file?.type === 'blob' && file.mode === '100644',
      `Expected ordinary tracked file: ${path}`
    );
    if (!bytes.has(path)) bytes.set(path, git('cat-file', 'blob', file.blob));
    return bytes.get(path);
  };
  const bind = (path) => ({
    path,
    blob: files.get(path)?.blob,
    sha256: createHash('sha256').update(read(path)).digest('hex'),
  });
  const actualAssets = [...files.keys()]
    .filter((path) => path.startsWith(prefix) && path.endsWith('.svg'))
    .sort();
  assert.deepEqual(
    decisions.map((entry) => entry.asset).sort(),
    actualAssets,
    'Every explanatory SVG needs exactly one disposition'
  );
  const pages = [...files.keys()].filter((path) =>
    /^apps\/www\/src\/content\/docs\/(en|zh-cn)\/whitepaper\/[^/]+\.md$/.test(path)
  );
  const references = [];
  for (const path of pages) {
    const source = read(path).toString();
    const draft = /^---\r?\n(?:(?!---)[\s\S])*?^draft:\s*true\s*$/m.test(source);
    for (const match of source.matchAll(/\/diagrams\/([^\s"'()<>]+\.svg)/g)) {
      const asset = `${prefix}${match[1]}`;
      assert.ok(actualAssets.includes(asset), `Missing referenced asset: ${asset}`);
      references.push({
        asset,
        ...bind(path),
        line: source.slice(0, match.index).split('\n').length,
        locale: path.split('/')[5],
        status: draft ? 'retained-draft' : 'canonical-article',
      });
    }
  }
  const assets = decisions
    .map((decision) => {
      assert.equal(
        decision.disposition,
        'keep',
        'A replacement requires a separately reviewed source change'
      );
      assert.ok(
        decision.reason?.trim(),
        `A disposition needs its semantic reason: ${decision.asset}`
      );
      const refs = references
        .filter((reference) => reference.asset === decision.asset)
        .map(({ asset, ...reference }) => reference);
      assert.ok(
        refs.some((reference) => reference.status === 'canonical-article'),
        `No canonical consumer: ${decision.asset}`
      );
      return {
        ...decision,
        ...bind(decision.asset),
        editableSource: bind(decision.editableSource ?? decision.asset),
        ...(decision.kind === 'authored-export'
          ? {
              originalDrawing: 'Author-held; no original drawing hash is available.',
            }
          : {}),
        references: refs,
      };
    })
    .sort((a, b) => a.asset.localeCompare(b.asset));
  return {
    schemaVersion: 1,
    kind: 'proto-ui.whitepaper-diagram-inventory',
    revision,
    tree: git('rev-parse', `${revision}^{tree}`).toString().trim(),
    scope:
      'Source preservation and semantic disposition. This inventory is not visual, browser, assistive-technology or release acceptance.',
    assets,
    provenance: [
      `${prefix}README.md`,
      `${prefix}licenses/Devicon-MIT.txt`,
      `${prefix}licenses/Excalifont-OFL.txt`,
      `${prefix}licenses/Xiaolai-OFL.txt`,
      `${prefix}licenses/Nunito-OFL.txt`,
      'apps/www/scripts/whitepaper-diagram-fonts.json',
    ].map(bind),
    counts: {
      assets: assets.length,
      originalInventory: assets.filter((asset) => asset.originalInventory).length,
      additionalResponsiveVariants: assets.filter((asset) => !asset.originalInventory).length,
      references: references.length,
      canonicalReferences: references.filter(
        (reference) => reference.status === 'canonical-article'
      ).length,
      retainedDraftReferences: references.filter(
        (reference) => reference.status === 'retained-draft'
      ).length,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const revision =
    process.argv[2] ?? execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim();
  assert.ok(
    process.argv.length <= 3,
    'Usage: node whitepaper-diagram-inventory.mjs [full-commit-sha]'
  );
  process.stdout.write(JSON.stringify(collectDiagramInventory(root, revision), null, 2) + '\n');
}
