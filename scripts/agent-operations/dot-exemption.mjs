import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

// An owner-authorized role disclosure, deliberately not a ModelTrace receipt.
// This module neither samples a model nor grants repository/action permission.
export const DOT_EXEMPTION = 'owner-authorized-2026-10-06';
export const DOT_DISCLOSURE = [
  'Agent: dot',
  'ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)',
  'This role declaration is not authenticated model identity, permission, independent review, or acceptance.',
].join('\n');

export function isDotExemption(args) {
  const agent = args.get('--agent');
  const exemption = args.get('--dot-exemption');
  if (agent === undefined && exemption === undefined) return false;
  if (agent !== 'dot' || exemption !== DOT_EXEMPTION)
    throw new Error('dot exemption requires --agent dot and the exact owner-authorized exemption');
  if (args.has('--record') || args.has('--context'))
    throw new Error('dot exemption must not be combined with a ModelTrace record or context');
  return true;
}

let markdownTools;
function quotedOrHidden(node) {
  return (
    ['blockquote', 'code', 'inlineCode'].includes(node.type) ||
    (node.type === 'element' &&
      (['blockquote', 'pre', 'code', 'script', 'style', 'template'].includes(node.tagName) ||
        Object.hasOwn(node.properties ?? {}, 'hidden')))
  );
}
function textContent(node) {
  if (quotedOrHidden(node)) return '';
  if (node.type === 'text') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  if (node.type === 'element' && node.tagName === 'img') return node.properties?.alt ?? '';
  if (node.type === 'break' || (node.type === 'element' && node.tagName === 'br')) return '\n';
  return (node.children ?? []).map(textContent).join('');
}
function disclosureParagraph(value) {
  // Reserve dot's own role and the ModelTrace namespace even when partial.
  // An unrelated task field such as "Agent: browser" remains ordinary prose.
  return /^\s*Agent:\s*dot\b/im.test(value) || /^\s*ModelTrace:/im.test(value);
}
function visibleDisclosureOffsets(text) {
  if (!markdownTools) {
    const require = createRequire(import.meta.url);
    markdownTools = {
      fromMarkdown: require('mdast-util-from-markdown').fromMarkdown,
      gfm: require('micromark-extension-gfm').gfm,
      gfmFromMarkdown: require('mdast-util-gfm').gfmFromMarkdown,
      toHast: require('mdast-util-to-hast').toHast,
      toHtml: require('hast-util-to-html').toHtml,
      fromHtml: require('hast-util-from-html').fromHtml,
    };
  }
  const { fromMarkdown, gfm, gfmFromMarkdown, toHast, toHtml, fromHtml } = markdownTools;
  const ast = fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const marker = `pui-dot-disclosure-${randomBytes(16).toString('hex')}-`;
  const candidates = new Map();
  for (const node of ast.children) {
    const value = textContent(node);
    const kind =
      node.type === 'paragraph' && disclosureParagraph(value)
        ? 'dot'
        : node.type === 'heading' && /^ModelTrace$/i.test(value.trim())
          ? 'measured'
          : null;
    if (!kind) continue;
    const id = `${marker}${node.position.start.offset}`;
    node.data = { hProperties: { id } };
    candidates.set(id, { kind, offset: node.position.start.offset, end: node.position.end.offset });
  }
  // Parse one continuous serialization so comments/raw-HTML nesting cannot
  // expose an AST node that the rendered document actually hides. Only root
  // paragraphs can identify dot; quoted/fenced/HTML examples cannot.
  const html = fromHtml(
    toHtml(toHast(ast, { allowDangerousHtml: true }), { allowDangerousHtml: true }),
    { fragment: true }
  );
  const offsets = [];
  const canonicalCandidate = (node) =>
    node.type === 'element' &&
    node.tagName === 'p' &&
    candidates.get(node.properties?.id)?.kind === 'dot';
  // Raw HTML can leave text/inline nodes directly under the fragment root.
  // Inspect that visible flow too, excluding paragraphs validated exactly below.
  if (
    disclosureParagraph(
      textContent({ ...html, children: html.children.filter((node) => !canonicalCandidate(node)) })
    )
  )
    throw new Error('raw HTML text cannot supply or compete with the canonical dot disclosure');
  function inspect(parent) {
    for (const node of parent.children ?? []) {
      if (node.type === 'text' && disclosureParagraph(node.value))
        throw new Error('visible text cannot supply or compete with the canonical dot disclosure');
      if (node.type !== 'element' || quotedOrHidden(node)) continue;
      const candidate = candidates.get(node.properties?.id);
      if (
        candidate?.kind === 'measured' ||
        (/^h[1-6]$/.test(node.tagName) && /^ModelTrace$/i.test(textContent(node).trim()))
      )
        throw new Error(
          'dot disclosure cannot substitute or compete with a visible fingerprint receipt'
        );
      if (canonicalCandidate(node) && parent === html) {
        offsets.push(candidate);
        continue;
      }
      if (disclosureParagraph(textContent(node)))
        throw new Error(
          'nested or raw HTML cannot supply or compete with the canonical dot disclosure'
        );
      inspect(node);
    }
  }
  inspect(html);
  return offsets;
}

export function hasDotDisclosure(text, format = 'markdown') {
  if (typeof text !== 'string') throw new Error('dot disclosure requires text');
  if (format === 'markdown') {
    const offsets = visibleDisclosureOffsets(text);
    if (offsets.length === 0) return false;
    const { offset: start, end } = offsets[0];
    const after = text.slice(start + DOT_DISCLOSURE.length);
    if (
      offsets.length !== 1 ||
      text.slice(start, end) !== DOT_DISCLOSURE ||
      (after !== '' && !after.startsWith('\n'))
    )
      throw new Error('dot publication requires one visible standalone exact disclosure');
    return true;
  }
  if (format !== 'commit') throw new Error('unsupported dot disclosure format');
  const agents = text.split(/\r?\n/).filter((line) => /^\s*Agent:/i.test(line));
  const traces = text.split(/\r?\n/).filter((line) => /^\s*ModelTrace:/i.test(line));
  if (agents.length === 0 && traces.length === 0) return false;
  if (
    agents.length !== 1 ||
    agents[0] !== 'Agent: dot' ||
    traces.length !== 1 ||
    traces[0] !== DOT_DISCLOSURE.split('\n')[1]
  )
    throw new Error('dot publication requires one exact Agent and not-measured disclosure');
  const start = text.indexOf(DOT_DISCLOSURE);
  const after = text.slice(start + DOT_DISCLOSURE.length);
  if (start < 0 || (after !== '' && !after.startsWith('\n')))
    throw new Error('dot commit disclosure must be exact');
  return true;
}

export function assertDotDisclosure(text, format = 'markdown') {
  if (!hasDotDisclosure(text, format)) throw new Error('dot publication is missing its disclosure');
}
