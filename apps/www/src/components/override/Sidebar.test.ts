// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
import {
  sidebarGroupIdentities,
  sidebarManagedGroups,
  type SidebarPolicyEntry,
} from '../site-sidebar-disclosure-policy';
const config = readFileSync(new URL('../../../astro.config.mjs', import.meta.url), 'utf8');
const source = readFileSync(new URL('./Sidebar.astro', import.meta.url), 'utf8');
const ast = ts.createSourceFile(
  'astro.config.mjs',
  config,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
);
const property = (node: ts.ObjectLiteralExpression, name: string) =>
  node.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name.getText(ast).replace(/^['"]|['"]$/g, '') === name
  )?.initializer;
let sidebar: ts.ArrayLiteralExpression | undefined;
function find(node: ts.Node) {
  if (ts.isObjectLiteralExpression(node)) {
    const value = property(node, 'sidebar');
    if (value && ts.isArrayLiteralExpression(value)) sidebar = value;
  }
  ts.forEachChild(node, find);
}
find(ast);
function entries(array: ts.ArrayLiteralExpression, locale: string): SidebarPolicyEntry[] {
  return array.elements.map((node) => {
    if (ts.isStringLiteral(node)) return { type: 'link', href: `/${locale}/${node.text}/` };
    if (!ts.isObjectLiteralExpression(node)) throw new Error('Unsupported authored Sidebar entry');
    const items = property(node, 'items');
    if (items && ts.isArrayLiteralExpression(items))
      return { type: 'group', entries: entries(items, locale) };
    const slug = property(node, 'slug');
    const link = property(node, 'link');
    if (slug && ts.isStringLiteral(slug)) return { type: 'link', href: `/${locale}/${slug.text}/` };
    if (link && ts.isStringLiteral(link)) return { type: 'link', href: link.text };
    throw new Error('Unsupported authored Sidebar link');
  });
}
it('all actual authored groups have unique locale-safe identities, independent of translated labels', () => {
  expect(sidebar).toBeDefined();
  const english = sidebarGroupIdentities(entries(sidebar!, 'en'), ['en', 'zh-cn']);
  const chinese = sidebarGroupIdentities(entries(sidebar!, 'zh-cn'), ['en', 'zh-cn']);
  expect(english.length).toBeGreaterThan(5);
  expect(new Set(english).size).toBe(english.length);
  expect(chinese).toEqual(english);
});
it('uses the public native tree with one scoped restore owner and the existing legacy session writer or density overrides', () => {
  expect(source).toContain("from '@astrojs/starlight/components/SidebarSublist.astro'");
  expect(source).toContain('collapsedSidebar(Astro.locals.starlightRoute.sidebar, locales)');
  expect(source).toContain("from '../site-sidebar-disclosure-bootstrap.js?raw'");
  expect(source).toContain('data-sidebar-identities={JSON.stringify(identities)}');
  expect(source).toContain('set:html={bootstrap}');
  expect(source).toContain('data-sidebar-managed={JSON.stringify(managed)}');
  expect(source).toContain('<sl-sidebar-state-persist');
  expect(source).toContain('data-hash={legacyHash}');
  expect(source).not.toMatch(/\.toString\s*\(|new\s+Function\s*\(|\beval\s*\(/);
  expect(source).toContain('<SidebarSublist sublist={entries} />');
  expect(source).not.toContain('MobileMenuFooter');
  expect(source).not.toMatch(/<style|SidebarPersister|sl-sidebar-restore|opacity|visibility/);
});
it('actual canonical scope retains non-UI sections and does not install another legacy writer or global restore element', () => {
  const english = sidebarManagedGroups(entries(sidebar!, 'en'), ['en', 'zh-cn']);
  expect(english).toContain(true);
  expect(english).toContain(false);
  expect(sidebarManagedGroups(entries(sidebar!, 'zh-cn'), ['en', 'zh-cn'])).toEqual(english);
  const bootstrap = readFileSync(
    new URL('../site-sidebar-disclosure-bootstrap.js', import.meta.url),
    'utf8'
  );
  const script = ts.createSourceFile(
    'bootstrap.js',
    bootstrap,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const forbidden: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const call = node.expression;
      if (call.name.text === 'define' && call.expression.getText(script).endsWith('customElements'))
        forbidden.push(call.getText(script));
      if (
        call.name.text === 'setItem' &&
        call.expression.getText(script).endsWith('sessionStorage')
      )
        forbidden.push(call.getText(script));
    }
    ts.forEachChild(node, visit);
  }
  visit(script);
  expect(forbidden).toEqual([]);
});

it('renders every early draft as a badge without appending status to translated link labels', () => {
  const drafts = new Map<string, string[]>();
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const label = property(node, 'label');
      const translations = property(node, 'translations');
      for (const value of [label, ...(translations && ts.isObjectLiteralExpression(translations)
        ? translations.properties.filter(ts.isPropertyAssignment).map((entry) => entry.initializer)
        : [])]) {
        if (value && ts.isStringLiteral(value)) {
          expect(value.text).not.toMatch(/[（(](?:Draft|草案)[）)]/u);
        }
      }
      const badge = property(node, 'badge');
      if (badge && ts.isIdentifier(badge) && badge.text === 'earlyDraftBadge') {
        const slug = property(node, 'slug');
        expect(slug && ts.isStringLiteral(slug)).toBe(true);
        if (slug && ts.isStringLiteral(slug)) {
          const family = slug.text.split('/')[1]!;
          drafts.set(family, [...(drafts.get(family) ?? []), slug.text]);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(Object.fromEntries([...drafts].map(([family, slugs]) => [family, slugs.length]))).toEqual({
    base: 31,
    shadcn: 34,
    brutalist: 35,
    'bootstrap-2-3-2': 30,
    'liquid-glass': 31,
  });
  expect(config).toContain("text: 'Early draft'");
  expect(config).toContain("class: 'docs-wip-badge docs-early-draft-badge'");
  // Existing WIP and experimental family states are not relabeled as drafts.
  expect(config).toContain("text: { en: 'WIP', 'zh-CN': '施工中' }");
  expect(config).toContain("text: { en: 'WIP / Experimental', 'zh-CN': 'WIP / 实验性' }");
});
