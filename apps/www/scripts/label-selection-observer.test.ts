import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';
import { parse } from 'yaml';
import { observeLabelDescriptionSelection } from '../src/content/docs/zh-cn/label-selection-observer';

test('serialized observer reports controlled hit geometry without changing selection or DOM', () => {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML =
    '<section style="user-select: none"><div data-demo-ref="description">Copyable description</div><button>Outside</button></section>';
  const element = doc.querySelector('div')!;
  const button = doc.querySelector('button')!;
  button.focus();
  const selection = window.getSelection()!;
  const selected = doc.createRange();
  selected.selectNodeContents(button);
  selection.addRange(selected);
  const before = {
    html: doc.body.outerHTML,
    selected: selection.toString(),
    active: doc.activeElement,
  };
  // Geometry is deliberately supplied here. Only official Chromium can establish
  // the actual text line boxes and pointer hit-test result of the public demo.
  const realCreateRange = doc.createRange.bind(doc);
  doc.createRange = () => {
    const range = realCreateRange();
    range.getClientRects = () => [{ x: 5, y: 10, width: 100, height: 16 }] as any;
    return range;
  };
  const points: number[][] = [];
  doc.elementFromPoint = (x, y) => {
    points.push([x, y]);
    return element;
  };
  const source = observeLabelDescriptionSelection.toString();
  assert.doesNotMatch(source, /\b__name\s*\(/);
  const observe = runInNewContext(`(${source})`);
  const result = observe(element, { x: 3, y: 8, width: 500, height: 40 });
  assert.deepEqual(points, [
    [5, 28],
    [353, 28],
  ]);
  assert.equal(result.start.hit.ref, 'description');
  assert.equal(result.rects[0].height, 16);
  assert.equal(result.ancestors[1].userSelect, 'none');
  assert.equal(result.selectedLength, before.selected.length);
  assert.equal(doc.body.outerHTML, before.html);
  assert.equal(selection.toString(), before.selected);
  assert.equal(doc.activeElement, before.active);
  window.happyDOM.close();
});

test('native drag and strict selection assertion remain; focused artifacts share the uploaded directory', () => {
  const source = readFileSync(
    new URL('../src/content/docs/zh-cn/home-demo-runtime.browser.test.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /await page\.mouse\.down\(\)/);
  assert.match(source, /steps: 20/);
  assert.match(source, /await page\.mouse\.up\(\)/);
  assert.match(
    source,
    /\(await page\.evaluate\(\(\) => window\.getSelection\(\)\?\.toString\(\) \?\? ''\)\)\.length\s*\)\.toBeGreaterThan\(5\)/
  );
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const steps = Object.values(workflow.jobs).flatMap((job: any) => job.steps ?? []);
  const focused = steps.find(
    (step: any) => step.name === 'Execute focused real-browser regressions on the exact candidate'
  ) as any;
  const upload = steps.find(
    (step: any) => step.name === 'Retain actual images, measurements and failure output'
  ) as any;
  assert.equal(focused.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, `${upload.with.path}/runtime`);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
});
