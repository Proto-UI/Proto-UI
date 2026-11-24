import { createHash } from 'node:crypto';
import { parse, parseFragment, serialize } from 'parse5';

// Issue834 research only. Nothing in this module admits promotion evidence,
// sanitizes HTML, executes candidate code, or alters the coverage collector.
export const markupDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');

const attribute = (node, name) => node.attrs?.find((attr) => attr.name === name)?.value;
const descendants = (node) => (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
const serializedComparison = (left, right) => ({
  matches: left === right,
  expectedDigest: markupDigest(left),
  observedDigest: markupDigest(right),
});

export function markupComparison(expected, observed) {
  if (typeof expected !== 'string' || typeof observed !== 'string') {
    return { matches: false, expectedDigest: null, observedDigest: null };
  }
  // This is a parser-normalized observation, not original HTML byte equality.
  const left = serialize(parseFragment(expected));
  const right = serialize(parseFragment(observed));
  return serializedComparison(left, right);
}

export function sourceBindingIssues(profile, binding) {
  const issues = [];
  if (!/^[a-f0-9]{40}$/.test(profile?.revision ?? '')) issues.push('reference revision is missing');
  if (!/^[a-f0-9]{40}$/.test(binding?.revision ?? '')) issues.push('capture revision is missing');
  if (!Array.isArray(profile?.sources) || profile.sources.length === 0) {
    return [...issues, 'reference source profile is missing'];
  }
  for (const [name, sources] of [['reference', profile.sources], ['capture', binding?.sources]]) {
    if (!Array.isArray(sources)) {
      issues.push(`${name} source inventory is missing`);
      continue;
    }
    const paths = new Set();
    for (const source of sources) {
      if (typeof source?.path !== 'string' || paths.has(source.path)) {
        issues.push(`${name} source path is missing or duplicated`);
      }
      paths.add(source?.path);
      if (!/^[a-f0-9]{64}$/.test(source?.sha256 ?? '')) issues.push(`${name} source digest is missing`);
    }
  }
  const expected = new Map(profile.sources.map((source) => [source?.path, source?.sha256]));
  const actual = new Map((Array.isArray(binding?.sources) ? binding.sources : [])
    .map((source) => [source?.path, source?.sha256]));
  for (const [path, digest] of expected) {
    if (actual.get(path) !== digest) issues.push(`source bytes are missing or changed: ${path}`);
  }
  for (const path of actual.keys()) {
    if (!expected.has(path)) issues.push(`unrecognized source profile member: ${path}`);
  }
  return issues;
}

function stringMap(value) {
  if (!value) return null;
  let result;
  try {
    result = JSON.parse(value);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return null;
  }
  return result && !Array.isArray(result) && typeof result === 'object' &&
    Object.values(result).every((entry) => typeof entry === 'string') ? result : null;
}

/** Extract only original response nodes, never page.content() or live outerHTML. */
export function originalCodePanels(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  return descendants(document)
    .filter((node) => attribute(node, 'data-previewer-id') !== undefined)
    .map((root) => {
      // Do not descend through a nested previewer's ownership boundary.
      const owned = [];
      const visit = (parent) => {
        for (const child of parent.childNodes ?? []) {
          if (attribute(child, 'data-previewer-id') !== undefined) continue;
          owned.push(child);
          visit(child);
        }
      };
      visit(root);
      const contents = owned.filter((node) => attribute(node, 'data-code-content') !== undefined);
      const contentLocation = contents.length === 1 ? contents[0].sourceCodeLocation : null;
      return {
        id: attribute(root, 'data-previewer-id'),
        demoId: attribute(root, 'data-demo-id') ?? null,
        initialRuntime: attribute(root, 'data-initial-runtime'),
        highlightsAttribute: attribute(root, 'data-code-highlights') ?? '',
        codeMapAttribute: attribute(root, 'data-code-map') ?? '',
        contentCount: contents.length,
        // Retain the response spelling of character references until comparison.
        contentHtml: contentLocation?.startTag && contentLocation.endTag
          ? html.slice(contentLocation.startTag.endOffset, contentLocation.endTag.startOffset) : null,
        // parse5 offsets are UTF-16 code units in the retained response text.
        sourceRange: root.sourceCodeLocation
          ? [root.sourceCodeLocation.startOffset, root.sourceCodeLocation.endOffset] : null,
      };
    });
}

export function originalInstallCommands(html) {
  const text = (node) => node.nodeName === '#text' ? node.value :
    (node.childNodes ?? []).map(text).join('');
  return descendants(parse(html)).filter((node) =>
    attribute(node, 'data-install-command-card') !== undefined).map((card) => ({
    id: attribute(card, 'id'),
    activeManager: attribute(card, 'data-active-manager'),
    commands: descendants(card).filter((node) => attribute(node, 'data-command-panel') !== undefined)
      .map((panel) => ({
        manager: attribute(panel, 'data-command-panel'),
        text: descendants(panel).filter((node) => attribute(node, 'data-command') !== undefined)
          .map(text).join(''),
      })),
  }));
}

// A deliberately finite *candidate shape*, not a trusted helper-name exception.
// New Shiki output, CSS syntax or attributes must stay unrecognized for review.
export function highlightedFragmentIssues(html, raw) {
  if (typeof html !== 'string' || typeof raw !== 'string') return ['producer value is opaque'];
  const fragment = parseFragment(html);
  const roots = fragment.childNodes.filter((node) => node.nodeName !== '#text' || node.value.trim());
  const nodes = descendants(fragment);
  const pre = roots.length === 1 && roots[0].tagName === 'pre' ? roots[0] : null;
  const codes = nodes.filter((node) => node.tagName === 'code');
  const issues = [];
  if (!pre || codes.length !== 1 || codes[0].parentNode !== pre) issues.push('unrecognized code structure');
  if (attribute(pre ?? {}, 'tabindex') !== '0') issues.push('code viewport is not keyboard focusable');
  if (codes.length !== 1 || attribute(codes[0], 'data-raw-code') !== raw) issues.push('raw producer bytes differ');
  for (const node of nodes) {
    if (node.nodeName === '#text') continue;
    if (!['pre', 'code', 'span'].includes(node.tagName) ||
        node.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      issues.push('unrecognized markup node');
      continue;
    }
    const allowed = node.tagName === 'pre' ? ['class', 'style', 'tabindex'] :
      node.tagName === 'code' ? ['class', 'data-raw-code'] : ['class', 'style'];
    for (const attr of node.attrs) {
      if (attr.namespace || !allowed.includes(attr.name)) issues.push('unrecognized markup attribute');
      if (attr.name === 'style' && attr.value.split(';').filter(Boolean).some((declaration) =>
        !/^\s*(?:--shiki-(?:light|dark)(?:-(?:bg|font-style|font-weight|text-decoration))?|color|background-color|font-style|font-weight|text-decoration):\s*(?:#[a-fA-F0-9]{3,8}|normal|bold|italic|underline|line-through|none|\d+|var\(--shiki-(?:light|dark)(?:-[a-z-]+)?\))\s*$/.test(declaration)
      )) issues.push('unrecognized highlight style');
    }
  }
  return [...new Set(issues)];
}

const codeScrollSources = [
  'apps/www/src/components/PrototypePreviewer/CodeScrollArea.astro',
  'apps/www/src/components/PrototypePreviewer/code-scroll-area-client.ts',
  'apps/www/src/components/PrototypePreviewer/code-panel-client.ts',
];

// The public ScrollArea enhancement moves the existing receiver below its
// Viewport and withdraws only the native pre's tabindex="0". Keep this named,
// source-bound transformation separate from an unchanged producer comparison.
// A marker alone, an unrelated viewport, or any other markup change cannot
// supply this observation. This remains a supplied native sample, not proof of
// served source, arbitrary intervening mutations, or general HTML admission.
function nativeCodeComparison(profile, observation, producer) {
  const producerComparison = markupComparison(producer, observation?.contentHtml);
  const result = { producerComparison, expectedComparison: producerComparison, transformation: null, issues: [] };
  const focus = observation?.codeScrollFocus;
  if (focus === undefined || focus === null) return result;

  const sourcePaths = new Set((Array.isArray(profile?.sources) ? profile.sources : []).map((source) => source?.path));
  if (!codeScrollSources.every((path) => sourcePaths.has(path))) {
    result.issues.push('code scroll focus transformation source is unbound');
  }
  if (focus.kind !== 'public-scroll-area-viewport' || focus.ready !== true ||
      focus.anatomyCount !== 1 || focus.anatomyTag !== 'wc-site-code-scroll-root' ||
      focus.viewportCount !== 1 || focus.viewportTag !== 'wc-site-code-scroll-viewport' ||
      focus.anatomyIsContainerChild !== true || focus.viewportIsAnatomyChild !== true ||
      focus.receiverIsViewportChild !== true || focus.connected !== true ||
      focus.ownerPreviewerId !== observation?.previewerId ||
      !['0', '-1'].includes(focus.tabindex) || focus.role !== 'region' ||
      typeof focus.label !== 'string' || !focus.label.trim() ||
      !['composed', 'system'].includes(focus.projection)) {
    result.issues.push('code scroll viewport focus ownership is unproven');
  }
  if (result.issues.length) return result;

  const fragment = parseFragment(producer);
  const roots = fragment.childNodes.filter((node) => node.nodeName !== '#text' || node.value.trim());
  const pre = roots.length === 1 && roots[0].tagName === 'pre' ? roots[0] : null;
  if (!pre || attribute(pre, 'tabindex') !== '0' ||
      !attribute(pre, 'class')?.split(/\s+/).includes('proto-previewer__code')) {
    result.issues.push('code scroll focus transformation producer is unrecognized');
    return result;
  }
  pre.attrs = pre.attrs.filter((attr) => attr.name !== 'tabindex');
  result.transformation = 'code-scroll-viewport-focus-handover';
  // Parse each side once: reparsing serialized attributes would normalize a
  // producer's character-reference-preserved CR into LF and lose raw bytes.
  result.expectedComparison = typeof observation.contentHtml === 'string'
    ? serializedComparison(serialize(fragment), serialize(parseFragment(observation.contentHtml)))
    : markupComparison(null, observation.contentHtml);
  return result;
}

/** Correlate a supplied native sample to a retained navigation response.
 * The caller records browser/runner identity. This function cannot authenticate it.
 */
export function analyzeMarkupObservation({ profile, binding, response, observation }) {
  const issues = sourceBindingIssues(profile, binding);
  const validResponse = response?.kind === 'navigation-response' && response.status === 200 &&
    typeof response.navigationId === 'string' && response.navigationId.length > 0 &&
    /^text\/html(?:\s*;|$)/i.test(response.contentType ?? '') && typeof response.html === 'string';
  const responseDigest = validResponse ? markupDigest(response.html) : null;
  if (!validResponse) issues.push('original HTML navigation response is unavailable');
  if (!responseDigest || observation?.responseDigest !== responseDigest ||
      observation?.navigationId !== response.navigationId) {
    issues.push('native sample is not bound to this response');
  }
  const panels = validResponse ? originalCodePanels(response.html).filter((panel) =>
    panel.id === observation?.previewerId) : [];
  const original = panels.length === 1 ? panels[0] : null;
  if (!original) issues.push('original receiver identity is missing or ambiguous');
  const raw = stringMap(original?.codeMapAttribute);
  const highlights = stringMap(original?.highlightsAttribute);
  const runtime = observation?.runtime;
  const selected = typeof runtime === 'string' && ['wc', 'react', 'vue', 'vue2'].includes(runtime) &&
    raw && highlights && Object.hasOwn(raw, runtime) && Object.hasOwn(highlights, runtime);
  const nativeComparison = selected ? nativeCodeComparison(profile, observation, highlights[runtime]) : null;
  if (!selected) issues.push('selected original producer output is unavailable');
  if (original?.contentCount !== 1) issues.push('original code receiver is missing or ambiguous');
  if (!observation?.connected || observation.receiverTag !== 'div' ||
      observation.receiverCount !== 1 || observation.ownerPreviewerId !== observation.previewerId) {
    issues.push('native receiver ownership or insertion context is unproven');
  }
  if (!original || observation.highlightsAttribute !== original.highlightsAttribute ||
      observation.codeMapAttribute !== original.codeMapAttribute) issues.push('native producer attributes changed');
  if (selected) {
    issues.push(...highlightedFragmentIssues(highlights[runtime], raw[runtime]));
    issues.push(...nativeComparison.issues);
    if (!nativeComparison.expectedComparison.matches) {
      issues.push('native output differs from recorded producer output');
    }
    const initial = original.initialRuntime;
    if (!Object.hasOwn(highlights, initial) ||
        !markupComparison(highlights[initial], original.contentHtml).matches) {
      issues.push('original SSR output differs from recorded initial producer output');
    }
  }
  return {
    schemaVersion: 1,
    scope: 'issue:834',
    sourceAdmission: 'unverified',
    servedSource: 'unobservable',
    sourceReferenceRevision: profile?.revision ?? null,
    captureRevision: binding?.revision ?? null,
    originalHTML: { responseDigest, navigationId: response?.navigationId ?? null, receiver: original },
    nativeRuntime: { kind: 'native-runtime-output', observation, comparison: nativeComparison && {
      producer: nativeComparison.producerComparison,
      expected: nativeComparison.expectedComparison,
      transformation: nativeComparison.transformation,
    } },
    matchesRecordedProducer: issues.length === 0 && nativeComparison?.producerComparison.matches === true,
    matchesExpectedNativeOutput: issues.length === 0,
    issues: [...new Set(issues)],
    limits: [
      'Local source digests do not authenticate which source produced the response.',
      'A response match and a native DOM sample do not prove intervening mutations or arbitrary JavaScript data flow.',
      'Parser normalization is separate from original response bytes and native insertion-context equivalence.',
      'A named code-scroll focus handover models only removal of the original pre tabindex="0" after the observed public viewport takes ownership.',
      'This finite observation cannot admit opaque snapshots or promote Website matrix rows.',
    ],
  };
}
