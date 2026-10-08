import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';
import { parse } from 'yaml';
import {
  measureLabelTextDrag,
  observeLabelDescriptionSelection,
  recordLabelPointerTrace,
} from '../src/content/docs/zh-cn/label-selection-observer';

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

for (const [family, y] of [
  ['shadcn', 562.5],
  ['brutalist', 608.5],
  ['bootstrap-2-3-2', 608.5],
  ['liquid-glass', 608.5],
] as const) {
  test(`${family}: real failed-run line geometry yields pointer coordinates inside one text line`, () => {
    const window = new Window();
    const doc = window.document;
    doc.body.innerHTML =
      '<div data-demo-ref="description">Long descriptions are useful copyable content. Selecting this sentence does not activate a control.</div>';
    const element = doc.querySelector('div')!;
    const bounds = { x: 352, y, width: 576, height: 52 };
    const rects = [
      { x: 352, y: y + 3, width: 566.4375, height: 19 },
      { x: 352, y: y + 29, width: 219.734375, height: 19 },
    ];
    element.getBoundingClientRect = () => bounds as DOMRect;
    const createRange = doc.createRange.bind(doc);
    doc.createRange = () => {
      const range = createRange();
      range.getClientRects = () => rects as any;
      return range;
    };
    const oldY = bounds.y + bounds.height / 2;
    assert.equal(
      rects.some((rect) => oldY > rect.y && oldY < rect.y + rect.height),
      false
    );
    // This replays observed geometry, not browser selection or a native pass.
    const measure = runInNewContext(`(${measureLabelTextDrag.toString()})`);
    const before = doc.body.outerHTML;
    const result = measure(element);
    for (const point of [result.start, result.end]) {
      assert.ok(
        rects.some(
          (rect) =>
            point.x > rect.x &&
            point.x < rect.x + rect.width &&
            point.y > rect.y &&
            point.y < rect.y + rect.height
        ),
        'drag must land inside rendered text'
      );
    }
    assert.equal(doc.body.outerHTML, before);
    assert.equal(window.getSelection()!.toString(), '');
    window.happyDOM.close();
  });
}

test('text geometry reads nested text only, retains existing selection/focus and rejects missing layout', () => {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = '<div><span>Copyable text</span></div><button>Outside</button>';
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
  const measure = runInNewContext(`(${measureLabelTextDrag.toString()})`);
  assert.throws(() => measure(element), /visible rendered text line/);
  const createRange = doc.createRange.bind(doc);
  doc.createRange = () => {
    const range = createRange();
    range.getClientRects = () => {
      assert.equal(range.startContainer.nodeType, 3, 'do not use wrapper element bounds as text');
      return [{ x: 12, y: 24, width: 100, height: 16 }] as any;
    };
    return range;
  };
  const result = measure(element);
  assert.deepEqual(JSON.parse(JSON.stringify(result.start)), { x: 14, y: 32 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.end)), { x: 110, y: 32 });
  assert.equal(selection.toString(), before.selected);
  assert.equal(doc.body.outerHTML, before.html);
  assert.equal(doc.activeElement, before.active);
  window.happyDOM.close();
});

test('pointer tracing observes native-event facts without cancelling and retires its listeners', () => {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = '<div data-demo-ref="description">Copyable text</div>';
  const element = doc.querySelector('div')!;
  const start = runInNewContext(`(${recordLabelPointerTrace.toString()})`);
  const trace = start(element);
  const down = new window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: 14,
    clientY: 32,
  });
  assert.equal(element.dispatchEvent(down), true);
  assert.equal(down.defaultPrevented, false);
  const events = trace.finish();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'mousedown');
  assert.equal(events[0].trusted, down.isTrusted);
  assert.equal(events[0].target, 'description');
  element.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
  assert.equal(trace.finish().length, 1);
  window.happyDOM.close();
});
