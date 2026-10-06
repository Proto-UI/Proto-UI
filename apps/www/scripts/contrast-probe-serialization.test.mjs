import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { transform } from 'esbuild';

// Execute the real source-reader loop and emitted exterior expression with
// controlled CSSOM/paint inputs. This is a model-domain regression, not native
// evidence that a sampled point lands on a dash, gap or double-border stripe.
const borderRatioFixture = async () => {
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const borderStart = source.indexOf("for (const side of ['top', 'right', 'bottom', 'left']) {");
  const borderEnd = source.indexOf('const nodes: Node[] = [];', borderStart);
  const exteriorStart = source.indexOf('exterior: exterior.map(') + 'exterior: '.length;
  const exteriorEnd = source.indexOf('\n        cueDisposition:', exteriorStart);
  assert.ok(borderStart >= 0 && borderEnd > borderStart);
  assert.ok(exteriorStart >= 'exterior: '.length && exteriorEnd > exteriorStart);
  const readBorders = new Function(
    'style',
    'border',
    'paint',
    `const borders = {}; ${source.slice(borderStart, borderEnd)} return borders;`
  );
  const readExterior = new Function(
    'exterior',
    'inactive',
    'inkUnmodified',
    'rectangularPerimeter',
    'borders',
    'backdrop',
    'fill',
    'contrast',
    `return ${source.slice(exteriorStart, exteriorEnd).trim().replace(/,$/, '')};`
  );
  const sides = ['top', 'right', 'bottom', 'left'];
  const luminance = (color) =>
    color
      .slice(0, 3)
      .map((channel) => channel / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  return ({
    styles = {},
    borderImageSource = 'none',
    width = 4,
    alpha = 1,
    inactive = false,
    inkUnmodified = true,
    rectangularPerimeter = true,
    color = [0, 0, 0, 255],
  } = {}) => {
    const ink = () => ({ rgba: color, alpha, limits: [] });
    const borders = readBorders(
      {
        borderImageSource,
        getPropertyValue: (property) => {
          const [, side, kind] = property.split('-');
          return kind === 'style'
            ? (styles[side] ?? 'solid')
            : kind === 'width'
              ? `${width}px`
              : 'black';
        },
      },
      ink(),
      ink
    );
    const exterior = readExterior(
      sides.map((side) => ({ side, point: { x: 1, y: 1, rgb: [255, 255, 255] } })),
      inactive,
      inkUnmodified,
      rectangularPerimeter,
      borders,
      { rgba: [255, 255, 255, 255] },
      { rgba: [255, 255, 255, 255], alpha: 1, limits: [] },
      contrast
    );
    return { borders, exterior };
  };
};

for (const style of [
  'dashed',
  'dotted',
  'double',
  'none',
  'hidden',
  'groove',
  'ridge',
  'inset',
  'outset',
]) {
  test(`border source ratios withhold unsupported ${style} geometry independently per side`, async () => {
    const measure = await borderRatioFixture();
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const { borders, exterior } = measure({ styles: { [side]: style } });
      for (const edge of exterior) {
        if (edge.side === side) {
          assert.equal(edge.innerBorderVsBackground, null);
          assert.equal(edge.opaqueBorderVsPixel, null);
          assert.equal(borders[side].style, style);
          assert.ok(borders[side].limits.includes('unsupported-border-style'));
        } else {
          assert.equal(edge.innerBorderVsBackground, 21);
          assert.equal(edge.opaqueBorderVsPixel, 21);
          assert.equal(borders[edge.side].style, 'solid');
          assert.deepEqual(borders[edge.side].limits, []);
        }
        assert.equal(edge.opaqueFillVsPixel, 1);
      }
    }
  });
}

test('border source ratios retain solid low/high contrasts and existing withholding guards', async () => {
  const measure = await borderRatioFixture();
  for (const edge of measure().exterior) {
    assert.equal(edge.innerBorderVsBackground, 21);
    assert.equal(edge.opaqueBorderVsPixel, 21);
  }
  for (const edge of measure({ color: [255, 255, 255, 255] }).exterior) {
    assert.equal(edge.innerBorderVsBackground, 1);
    assert.equal(edge.opaqueBorderVsPixel, 1);
  }
  for (const options of [
    { width: 0 },
    { alpha: 0.999 },
    { color: null },
    { inactive: true },
    { inkUnmodified: false },
    { rectangularPerimeter: false },
  ]) {
    for (const edge of measure(options).exterior) {
      assert.equal(edge.innerBorderVsBackground, null);
      assert.equal(edge.opaqueBorderVsPixel, null);
      assert.equal(
        edge.opaqueFillVsPixel,
        options.inactive ||
          options.inkUnmodified === false ||
          options.rectangularPerimeter === false
          ? null
          : 1
      );
    }
  }
});

test('border images withhold only border metrics while retaining independent fill evidence', async () => {
  const measure = await borderRatioFixture();
  for (const borderImageSource of [
    'linear-gradient(white, white)',
    'url("data:image/svg+xml,<svg/>")',
  ]) {
    const result = measure({ borderImageSource });
    for (const edge of result.exterior) {
      assert.equal(edge.innerBorderVsBackground, null);
      assert.equal(edge.opaqueBorderVsPixel, null);
      assert.equal(edge.opaqueFillVsPixel, 1);
      assert.ok(result.borders[edge.side].limits.includes('unsupported-border-image'));
    }
  }
});

test('shadow source metrics withhold unsupported receiving sides without rejecting covered negative offsets', async () => {
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const start = source.indexOf('const shadowParts: string[] = [];');
  const end = source.indexOf('      return {\n        prototype:', start);
  assert.ok(start >= 0 && end > start);
  const compiled = await transform(`${source.slice(start, end)}; return shadows;`, {
    loader: 'ts',
  });
  const measure = new Function(
    'style',
    'rect',
    'measurablePerimeter',
    'rectangularPerimeter',
    'inkUnmodified',
    'paint',
    'sample',
    'contrast',
    'backdrop',
    'visibility',
    'perimeterLimits',
    compiled.code
  );
  const read = (x, y, spread, rectangular = true) =>
    measure(
      { boxShadow: `rgb(0, 0, 0) ${x}px ${y}px 0px ${spread}px` },
      { x: 40, y: 40, right: 140, bottom: 80, width: 100, height: 40 },
      true,
      rectangular,
      true,
      () => ({ rgba: [0, 0, 0, 255], alpha: 1, limits: [] }),
      (x, y) => ({ x, y, rgb: [255, 255, 255] }),
      () => 21,
      { rgba: [255, 255, 255, 255] },
      { limits: [] },
      rectangular ? [] : ['unsupported-rounded-perimeter']
    )[0];
  for (const args of [
    [0, 0, 0],
    [-8, -6, 0],
    [60, 60, -21],
  ]) {
    assert.deepEqual(read(...args).receiving, [
      { side: 'right', point: null, ratio: null },
      { side: 'bottom', point: null, ratio: null },
    ]);
  }
  assert.deepEqual(read(-2, -3, 8).receiving, [
    { side: 'right', point: { x: 147, y: 57, rgb: [255, 255, 255] }, ratio: 21 },
    { side: 'bottom', point: { x: 88, y: 86, rgb: [255, 255, 255] }, ratio: 21 },
  ]);
  assert.deepEqual(read(-8, 6, 0).receiving[0], { side: 'right', point: null, ratio: null });
  assert.equal(read(-8, 6, 0).receiving[1].ratio, 21);
  assert.deepEqual(read(8, 6, 0, false).receiving, []);
});

test('browser-side Focus diagnostics run without Node transpiler helpers', async () => {
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, {
    loader: 'ts',
    format: 'iife',
    globalName: 'puiContrastProbe',
    keepNames: false,
  });
  const sandbox = { document: { activeElement: null } };
  vm.runInNewContext(compiled.code, sandbox);
  const center = { entries: new Map(), activeScopes: [] };
  const result = sandbox.puiContrastProbe.readContrastFocusDiagnostics(center, 'fixture-source');
  assert.equal(result.entryCount, 0);
  assert.equal(result.source, 'fixture-source');
  assert.match(result.boundary, /separate module identity/);
  assert.equal(center.entries.size, 0);
  assert.equal(center.activeScopes.length, 0);
});

// Synthetic geometry and computed styles calibrate the actual serialized browser
// function. They do not establish native CSS rendering or hit testing.
const targetObservationFixture = async () => {
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, {
    loader: 'ts',
    format: 'iife',
    globalName: 'puiContrastProbe',
    keepNames: false,
  });
  const style = {
    visibility: 'visible',
    display: 'block',
    contentVisibility: 'visible',
    opacity: '1',
    mixBlendMode: 'normal',
    backgroundColor: '#5294ff',
    backgroundImage: 'none',
    backgroundClip: 'border-box',
    color: '#000',
    webkitTextFillColor: '#000',
    webkitTextStrokeWidth: '0px',
    textShadow: 'none',
    filter: 'none',
    backdropFilter: 'none',
    clip: 'auto',
    clipPath: 'none',
    maskImage: 'none',
    perspective: 'none',
    transformStyle: 'flat',
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    zoom: '1',
    contain: 'none',
    overflowX: 'visible',
    overflowY: 'visible',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    boxShadow: 'none',
    fontSize: '16px',
    borderImageSource: 'none',
  };
  style.getPropertyValue = (property) =>
    style[property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? '';
  const bounds = { x: 10, y: 10, left: 10, top: 10, right: 50, bottom: 40, width: 40, height: 30 };
  const element = {
    nodeType: 1,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes: [],
    parentElement: null,
    assignedSlot: null,
    textContent: 'Native-state fixture',
    isConnected: true,
    getRootNode: () => ({}),
    getClientRects: () => [bounds],
    getBoundingClientRect: () => bounds,
    getAttribute: () => null,
    matches: (selector) => selector.startsWith(':'),
  };
  const ancestor = {
    ...element,
    textContent: '',
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 40,
    clientHeight: 30,
  };
  const ancestorStyle = { ...style };
  element.parentElement = ancestor;
  const textNode = {
    nodeType: 3,
    textContent: element.textContent,
    parentElement: element,
    childNodes: [],
  };
  element.childNodes = [textNode];
  ancestor.childNodes = [element];
  const styleByElement = new Map();
  const sandbox = {
    document: {
      activeElement: element,
      createElement: () => ({ getContext: () => ({ fillStyle: '' }) }),
      createRange: () => ({ selectNodeContents: () => {}, getClientRects: () => [bounds] }),
    },
    CSS: { supports: () => true },
    innerWidth: 800,
    innerHeight: 600,
    ShadowRoot: class {},
    Element: class {
      static [Symbol.hasInstance](node) {
        return node?.nodeType === 1;
      }
    },
    HTMLSlotElement: class {},
    Node: { TEXT_NODE: 3 },
    getComputedStyle: (current) =>
      styleByElement.get(current) ?? (current === element ? style : ancestorStyle),
  };
  vm.runInNewContext(compiled.code, sandbox);
  const observe = () => sandbox.puiContrastProbe.readContrastTargetObservation(element);
  const observePair = (held = true) =>
    sandbox.puiContrastProbe.readContrastPointerPair(
      element,
      { fill: '#5294ff', foreground: '#000' },
      held
    );
  return {
    style,
    ancestorStyle,
    element,
    ancestor,
    sandbox,
    observe,
    observePair,
    textNode,
    styleByElement,
    bounds,
  };
};

for (const overflow of ['hidden', 'clip', 'auto', 'scroll']) {
  test(`shared target acceptance withholds rounded ${overflow} clipping without inventing hidden bounds`, async () => {
    const { ancestorStyle, observe } = await targetObservationFixture();
    ancestorStyle.overflowX = overflow;
    ancestorStyle.overflowY = overflow;
    assert.equal(observe().achieved, true); // Square clipping control.
    ancestorStyle.borderTopLeftRadius = '50%';
    const rounded = observe();
    assert.equal(rounded.achieved, false);
    assert.equal(rounded.visibility.visible, true); // Intersecting bounds remain evidence.
    assert.equal(rounded.visibility.classification, 'unsupported');
    assert.ok(rounded.visibility.limits.includes('unsupported-rounded-overflow-clip'));
    ancestorStyle.borderTopLeftRadius = '5px';
    const center = {
      x: 20,
      y: 20,
      left: 20,
      top: 20,
      right: 30,
      bottom: 30,
      width: 10,
      height: 10,
    };
    // Proof applies only when the entire target lies in the unaffected rectangle.
    const fixture = await targetObservationFixture();
    fixture.ancestorStyle.overflowX = fixture.ancestorStyle.overflowY = overflow;
    fixture.ancestorStyle.borderTopLeftRadius = '5px';
    fixture.element.getClientRects = () => [center];
    fixture.element.getBoundingClientRect = () => center;
    assert.equal(fixture.observe().achieved, true);
    fixture.ancestorStyle.zoom = '2';
    assert.equal(fixture.observe().achieved, false);
    assert.ok(fixture.observe().visibility.limits.includes('unsupported-zoomed-paint'));
    ancestorStyle.overflowX = ancestorStyle.overflowY = 'visible';
    assert.equal(observe().achieved, true); // Radius alone is not clipping.
  });
}

test('shared interactive target predicate rejects non-painted boxes without losing native state facts', async () => {
  const { style, element, observe } = await targetObservationFixture();
  assert.equal(observe().achieved, true);
  // The old bounds-only predicate accepts this fixture. The new predicate must
  // reject it for paint, not merely because native interaction flags vanished.
  style.opacity = '0';
  assert.equal(
    element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
    true
  );
  const transparent = observe();
  assert.equal(transparent.achieved, false);
  assert.equal(transparent.focused, true);
  assert.equal(transparent.hovered, true);
  assert.equal(transparent.nativeActive, true);
  style.opacity = '1';
  style.clipPath = 'inset(100%)';
  assert.equal(observe().achieved, false);
  assert.equal(observe().visibility.classification, 'unsupported');
  style.clipPath = 'none';
  assert.equal(observe().achieved, true);
});

for (const placement of ['target', 'ancestor']) {
  for (const [property, value] of [
    ['filter', 'opacity(0)'],
    ['filter', 'blur(2px)'],
    ['backdropFilter', 'blur(2px)'],
  ]) {
    test(`shared target predicate rejects ${placement} ${property}: ${value}`, async () => {
      const { style, ancestorStyle, element, observe } = await targetObservationFixture();
      assert.equal(observe().achieved, true);
      const filteredStyle = placement === 'target' ? style : ancestorStyle;
      filteredStyle[property] = value;
      // Only the filter changes. Opacity, nonempty geometry and native-state
      // facts must not let unsupported paint count as an achieved target.
      assert.equal(style.opacity, '1');
      assert.equal(ancestorStyle.opacity, '1');
      assert.equal(element.getBoundingClientRect().width > 0, true);
      const filtered = observe();
      assert.equal(filtered.achieved, false);
      assert.equal(filtered.visibility.classification, 'unsupported');
      assert.ok(filtered.visibility.limits.includes('unsupported-filter-or-backdrop-filter'));
      assert.equal(filtered.focused, true);
      assert.equal(filtered.hovered, true);
      assert.equal(filtered.nativeActive, true);
      filteredStyle[property] = 'none';
      assert.equal(observe().achieved, true);
      assert.equal(observe().visibility.classification, 'source-model-visible');
    });
  }
}

for (const placement of ['target', 'ancestor']) {
  for (const [property, value, normal, limit] of [
    ['opacity', '0.5', '1', 'ancestor-or-target-opacity'],
    ['mixBlendMode', 'multiply', 'normal', 'blend-mode'],
  ]) {
    test(`pointer pair rejects ${placement} ${property} without redefining visibility`, async () => {
      const { style, ancestorStyle, observe, observePair } = await targetObservationFixture();
      assert.equal(observePair().achieved, true);
      const changedStyle = placement === 'target' ? style : ancestorStyle;
      changedStyle[property] = value;
      // Synthetic CSSOM injection: expected tokens and native-state flags stay
      // fixed, while the actual serialized pair predicate must reject paint.
      assert.equal(observe().achieved, true);
      const changed = observePair();
      assert.equal(changed.achieved, false);
      assert.equal(changed.hovered, true);
      assert.equal(changed.nativeActive, true);
      assert.equal(changed.fill, '#5294ff');
      assert.equal(changed.foreground, '#000');
      assert.ok(changed.paintLimits.includes(limit));
      changedStyle[property] = normal;
      assert.equal(observePair().achieved, true);
      assert.deepEqual(Array.from(observePair().paintLimits), []);
    });
  }
}

for (const [property, value, normal, limit] of [
  ['backgroundImage', 'linear-gradient(white, white)', 'none', 'unsupported-background-image'],
  ['webkitTextFillColor', '#fff', '#000', 'unsupported-text-fill-color'],
  ['textShadow', 'white 0px 0px 3px', 'none', 'unsupported-text-shadow'],
  ['webkitTextStrokeWidth', '2px', '0px', 'unsupported-text-stroke'],
  ['boxShadow', 'white 0px 0px 0px 100px inset', 'none', 'unsupported-inset-shadow'],
  ['backgroundClip', 'text', 'border-box', 'unsupported-background-clip'],
]) {
  test(`pointer pair rejects alternate ${property} while tokens and native facts survive`, async () => {
    const { style, observe, observePair } = await targetObservationFixture();
    assert.equal(observePair().achieved, true);
    style[property] = value;
    assert.equal(observe().achieved, true);
    const changed = observePair();
    assert.equal(changed.achieved, false);
    assert.equal(changed.hovered, true);
    assert.equal(changed.nativeActive, true);
    assert.equal(changed.fill, changed.expectedFill);
    assert.equal(changed.foreground, changed.expectedForeground);
    assert.ok(changed.paintLimits.includes(limit));
    style[property] = normal;
    assert.equal(observePair().achieved, true);
  });
}

test('pointer pair keeps an opaque target over unrelated ancestor image and outer shadow', async () => {
  const { style, ancestorStyle, observePair } = await targetObservationFixture();
  ancestorStyle.backgroundImage = 'linear-gradient(white, white)';
  ancestorStyle.boxShadow = 'white 0px 0px 0px 100px inset';
  style.boxShadow = 'black 4px 4px 0px 0px';
  assert.equal(observePair().achieved, true);
});

for (const kind of ['direct', 'native', 'placeholder']) {
  for (const defect of ['stroke', 'zero-size'])
    test(`${kind} text ink limit builder rejects ${defect} glyph paint`, async () => {
      const source = await readFile(
        new URL('./contrast-probe.browser.ts', import.meta.url),
        'utf8'
      );
      const marker =
        kind === 'direct'
          ? 'const limits = [...textBackdrop.limits'
          : kind === 'native'
            ? 'const textLimits = [...backdrop.limits'
            : 'const placeholderLimits = [';
      const start = source.indexOf(marker);
      const end = source.indexOf(
        kind === 'direct'
          ? 'const large ='
          : kind === 'native'
            ? 'const directRun ='
            : 'const placeholder =',
        start
      );
      assert.ok(start > 0 && end > start);
      const name =
        kind === 'direct' ? 'limits' : kind === 'native' ? 'textLimits' : 'placeholderLimits';
      const compiled = await transform(`${source.slice(start, end)}; return ${name};`, {
        loader: 'ts',
      });
      const read = new Function(
        'style',
        'textStyle',
        'placeholderStyle',
        'backdrop',
        'textBackdrop',
        'visibility',
        'textVisibility',
        'text',
        'textInk',
        'placeholderInk',
        'inactive',
        'parent',
        'nativeText',
        'element',
        compiled.code
      );
      const style = {
        color: '#000',
        fontSize: '16px',
        webkitTextFillColor: '#000',
        textShadow: 'none',
        opacity: '1',
        textIndent: '0px',
        webkitTextStrokeWidth: '0px',
      };
      const clean = { limits: [], alpha: 1 };
      const observe = () =>
        read(
          style,
          style,
          style,
          clean,
          clean,
          clean,
          clean,
          clean,
          clean,
          clean,
          false,
          { namespaceURI: 'http://www.w3.org/1999/xhtml' },
          true,
          { scrollLeft: 0, scrollTop: 0 }
        );
      assert.deepEqual(observe(), []);
      if (defect === 'stroke') {
        for (const width of ['0.5px', '2px']) {
          style.webkitTextStrokeWidth = width;
          assert.ok(
            observe().includes(
              kind === 'placeholder'
                ? 'unsupported-placeholder-text-stroke'
                : 'unsupported-text-stroke'
            )
          );
        }
        style.webkitTextStrokeWidth = '0px';
      } else {
        style.fontSize = '0px';
        assert.ok(
          observe().includes(
            kind === 'placeholder' ? 'unsupported-placeholder-font-size' : 'unsupported-font-size'
          )
        );
        style.fontSize = '16px';
      }
      assert.deepEqual(observe(), []);
    });
}

for (const family of ['badge', 'card', 'skeleton', 'separator', 'spinner']) {
  test(`actual ${family} passive caller rejects rounded clip false visibility`, async () => {
    const { style, ancestorStyle, element, ancestor, sandbox } = await targetObservationFixture();
    const source = await readFile(
      new URL('./audit-brutalist-contrast.mts', import.meta.url),
      'utf8'
    );
    const start = source.indexOf(
      '  return page.evaluate(\n    (input) => {',
      source.indexOf('async function passiveSurfaceObservation')
    );
    const end = source.indexOf('\n    },\n    {\n      family,', start);
    assert.ok(start > 0 && end > start);
    const callback = source.slice(
      start + '  return page.evaluate(\n    '.length,
      end + '\n    }'.length
    );
    const compiled = await transform(`globalThis.readPassive = ${callback};`, { loader: 'ts' });
    const identity = `brutalist-${family}`;
    element.dataset = {
      projectionOwner: 'owner',
      projectionGeneration: '1',
      projectionPrototype: identity,
    };
    element.hasAttribute = (name) => name === 'data-pui-root';
    element.getAttribute = (name) => (name === 'data-demo-ref' ? 'root' : null);
    element.closest = () => null;
    element.getAnimations = () => [];
    ancestor.hasAttribute = () => false;
    ancestor.getBoundingClientRect = () => ({
      x: 10,
      y: 10,
      left: 10,
      top: 10,
      right: 110,
      bottom: 110,
      width: 100,
      height: 100,
    });
    ancestor.clientWidth = ancestor.clientHeight = 100;
    const corner = { x: 10, y: 10, left: 10, top: 10, right: 18, bottom: 18, width: 8, height: 8 };
    element.getClientRects = () => [corner];
    element.getBoundingClientRect = () => corner;
    Object.assign(style, {
      animationName: 'none',
      borderTopColor: 'rgba(0, 0, 0, 0)',
      borderRightColor: '#000',
      borderBottomColor: '#000',
      borderLeftColor: '#000',
      borderTopWidth: '2px',
      borderRightWidth: '2px',
      borderBottomWidth: '2px',
      borderLeftWidth: '2px',
    });
    const content = { contains: (node) => node === element };
    sandbox.document.querySelectorAll = () => [element];
    sandbox.matchMedia = () => ({ matches: true });
    sandbox.puiContrastProbe = {
      ...sandbox.puiContrastProbe,
      readContrastAuditSubject: () => ({
        observation: { achieved: true },
        content,
        retained: content,
        shell: null,
        owner: 'owner',
        generation: '1',
      }),
    };
    vm.runInNewContext(compiled.code, sandbox);
    const input = {
      family,
      subject: {},
      rootPrototypeId: identity,
      expected: [
        {
          prototypeId: identity,
          expectedCount: 1,
          visibilityRequirement: 'visible-physical-region',
        },
      ],
      instances: [{ prototypeId: identity, ref: 'root', ancestorPrototypeIds: [] }],
      sourceUnsupported: [],
    };
    const observe = () => sandbox.readPassive(input);
    assert.equal(observe().achieved, true);
    ancestorStyle.overflowX = ancestorStyle.overflowY = 'hidden';
    ancestorStyle.borderTopLeftRadius =
      ancestorStyle.borderTopRightRadius =
      ancestorStyle.borderBottomLeftRadius =
      ancestorStyle.borderBottomRightRadius =
        '50px';
    const clipped = observe();
    assert.equal(clipped.achieved, false);
    assert.ok(clipped.surfaces[0].visibilityLimits.includes('unsupported-rounded-overflow-clip'));
    const center = {
      x: 25,
      y: 25,
      left: 25,
      top: 25,
      right: 45,
      bottom: 35,
      width: 20,
      height: 10,
    };
    element.getClientRects = () => [center];
    element.getBoundingClientRect = () => center;
    ancestorStyle.borderTopLeftRadius =
      ancestorStyle.borderTopRightRadius =
      ancestorStyle.borderBottomLeftRadius =
      ancestorStyle.borderBottomRightRadius =
        '5px';
    assert.equal(observe().achieved, true); // Shared fixed-px safe interior remains supported.
    style.opacity = '0';
    assert.equal(observe().achieved, false);
    style.opacity = '1';
    element.dataset.projectionOwner = 'foreign-owner';
    assert.equal(observe().achieved, false);
    element.dataset.projectionOwner = 'owner';
    ancestorStyle.overflowX = ancestorStyle.overflowY = 'visible';
    assert.equal(observe().achieved, true);
    const retainedStyle = { ...style };
    eraseTargetPaint({ style });
    const unpainted = observe();
    assert.equal(unpainted.achieved, false);
    assert.ok(unpainted.surfaces[0].visibilityLimits.includes('no-supported-nontransparent-paint'));
    Object.assign(style, retainedStyle);
    assert.equal(observe().achieved, true);
  });
}

for (const placement of ['target', 'ancestor']) {
  for (const pseudo of ['::before', '::after']) {
    test(`pointer pair withholds generated ${placement} ${pseudo} while preserving native facts`, async () => {
      const f = await targetObservationFixture();
      const original = f.sandbox.getComputedStyle;
      const layer = { content: 'none', display: 'block', opacity: '1' };
      const owner = placement === 'target' ? f.element : f.ancestor;
      f.sandbox.getComputedStyle = (element, which) =>
        which
          ? element === owner && which === pseudo
            ? layer
            : { content: 'none', display: 'block' }
          : original(element);
      assert.equal(f.observePair().achieved, true);
      Object.assign(layer, {
        content: '""',
        position: 'absolute',
        inset: '0px',
        backgroundColor: '#fff',
      });
      for (const held of [false, true]) {
        const result = f.observePair(held);
        assert.equal(result.fill, result.expectedFill);
        assert.equal(result.foreground, result.expectedForeground);
        assert.equal(result.hovered, true);
        assert.equal(result.nativeActive, true);
        assert.equal(result.achieved, false);
        assert.ok(result.paintLimits.includes('unsupported-generated-pseudo-element'));
      }
      for (const content of ['none', 'normal', '']) {
        layer.content = content;
        assert.equal(f.observePair().achieved, true);
      }
      layer.content = '""';
      layer.display = 'none';
      assert.equal(f.observePair().achieved, true);
    });
  }
}

for (const placement of ['target', 'ancestor']) {
  for (const pseudo of ['::before', '::after']) {
    test(`numeric paint background withholds generated ${placement} ${pseudo}`, async () => {
      const source = await readFile(
        new URL('./contrast-probe.browser.ts', import.meta.url),
        'utf8'
      );
      const helper = source.slice(
        source.indexOf('const generatedPseudoPaintLimits ='),
        source.indexOf('export const readContrastPointerPair')
      );
      const start = source.indexOf('  const background = (element: Element)');
      const end = source.indexOf('\n  return {\n    family,', start);
      assert.ok(start > 0 && end > start);
      const compiled = await transform(
        `${helper}\n${source.slice(start, end)}\nreturn background(element);`,
        { loader: 'ts' }
      );
      const read = new Function(
        'getComputedStyle',
        'paint',
        'composedParent',
        'HTMLSlotElement',
        'element',
        compiled.code
      );
      const ancestor = { parent: null };
      const target = { parent: ancestor };
      const owner = placement === 'target' ? target : ancestor;
      const layer = { content: 'none', display: 'block' };
      const plain = {
        opacity: '1',
        filter: 'none',
        backdropFilter: 'none',
        mixBlendMode: 'normal',
        backgroundImage: 'none',
        backgroundClip: 'border-box',
        backgroundColor: '#fff',
      };
      const observe = () =>
        read(
          (element, which) =>
            which
              ? element === owner && which === pseudo
                ? layer
                : { content: 'none', display: 'block' }
              : plain,
          () => ({ rgba: [255, 255, 255, 255], alpha: 1, limits: [] }),
          (element) => element.parent,
          class {},
          target
        );
      assert.deepEqual(observe(), { rgba: [255, 255, 255, 255], limits: [] });
      layer.content = '""';
      const altered = observe();
      assert.equal(altered.rgba, null);
      assert.ok(altered.limits.includes('unsupported-generated-pseudo-element'));
      layer.display = 'none';
      assert.deepEqual(observe(), { rgba: [255, 255, 255, 255], limits: [] });
    });
  }
}

// Run the complete exported fingerprint against a controlled DOM/CSSOM. These
// tests establish serialization/identity behavior, not browser paint coverage.
const stateIdentityFixture = async ({ shadow = false, native = false } = {}) => {
  const window = new Window();
  window.visualViewport = null;
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, {
    loader: 'ts',
    format: 'iife',
    globalName: 'puiContrastProbe',
  });
  window.document.body.innerHTML = `<section data-projection-scope="fixture" data-projection-owner="fixture" data-projection-generation="1"><${native ? 'textarea' : 'div'} data-pui-root data-projection-owner="fixture" data-projection-generation="1" data-projection-prototype="brutalist-textarea-root"></${native ? 'textarea' : 'div'}></section>`;
  const host = window.document.querySelector('[data-pui-root]');
  const container = shadow ? host.attachShadow({ mode: 'open' }) : host;
  const editor = native ? host : window.document.createElement('textarea');
  if (!native) container.append(editor);
  editor.value = 'Current editor';
  window.eval(compiled.code);
  return {
    window,
    host,
    container,
    editor,
    read: () => window.puiContrastProbe.readContrastState(),
    close: () => window.happyDOM.abort(),
  };
};

for (const property of [
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-decoration-style',
  'text-underline-offset',
  'text-decoration-skip-ink',
  'stroke-dasharray',
]) {
  test(`fingerprint rejects CSSOM-only ${property} drift without attribute or geometry changes`, async () => {
    const f = await stateIdentityFixture();
    try {
      let value = 'initial-controlled-value';
      const original = f.window.getComputedStyle.bind(f.window);
      f.window.getComputedStyle = (node, pseudo) => {
        const computed = original(node, pseudo);
        return new Proxy(computed, {
          get(target, name) {
            if (name === 'getPropertyValue')
              return (key) =>
                node === f.editor && key === property ? value : target.getPropertyValue(key);
            const item = Reflect.get(target, name, target);
            return typeof item === 'function' ? item.bind(target) : item;
          },
        });
      };
      const attributes = f.editor.outerHTML;
      const before = f.read();
      assert.equal(f.read(), before);
      value = 'changed-controlled-value';
      assert.equal(f.editor.outerHTML, attributes);
      assert.notEqual(f.read(), before);
    } finally {
      await f.close();
    }
  });
}

for (const profile of [{ native: true }, {}, { shadow: true }]) {
  test(`native editor identity accepts one physical editor ${JSON.stringify(profile)}`, async () => {
    const f = await stateIdentityFixture(profile);
    try {
      const state = JSON.parse(f.read());
      assert.equal(state.surfaces.length, 1);
      assert.equal(state.surfaces[0].target[0].tag, 'TEXTAREA');
      assert.equal(state.surfaces[0].target[0].value, 'Current editor');
      assert.equal(f.read(), JSON.stringify(state));
    } finally {
      await f.close();
    }
  });
}

for (const shadow of [false, true]) {
  for (const defect of ['missing', 'duplicate', 'foreign-owner', 'stale-generation']) {
    test(`native editor identity rejects ${defect} in ${shadow ? 'shadow' : 'light'} wrapper`, async () => {
      const f = await stateIdentityFixture({ shadow });
      try {
        if (defect === 'missing') f.editor.remove();
        else if (defect === 'duplicate') f.container.append(f.editor.cloneNode(true));
        else
          f.editor.setAttribute(
            defect === 'foreign-owner' ? 'data-projection-owner' : 'data-projection-generation',
            'foreign'
          );
        assert.throws(f.read, /native editor|native Textarea/i);
      } finally {
        await f.close();
      }
    });
  }
}

test('Textarea runner retains locator strictness instead of first-match selection', async () => {
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf('function primary(');
  const end = source.indexOf('async function passiveSurfaceObservation', start);
  assert.ok(start >= 0 && end > start);
  const compiled = await transform(
    source.slice(start, end) + '\n globalThis.selectPrimary = primary;',
    { loader: 'ts' }
  );
  const sandbox = {};
  vm.runInNewContext(compiled.code, sandbox);
  const first = {};
  const strict = { first: () => first };
  const previewer = { locator: () => strict };
  assert.equal(sandbox.selectPrimary(previewer, 'textarea'), strict);
  assert.equal(sandbox.selectPrimary(previewer, 'button'), first);
});

const glyphAreaFixture = async () => {
  const source = await readFile(new URL('./contrast-probe.browser.ts', import.meta.url), 'utf8');
  const helperStart = source.indexOf('const supportedSvgFillArea =');
  const helperEnd = source.indexOf('\n\nconst ', helperStart + 1);
  const helper = helperStart < 0 ? '' : source.slice(helperStart, helperEnd);
  const start = source.indexOf('const glyphs = nodes');
  const end = source.indexOf('const nativeText =', start);
  assert.ok(start >= 0 && end > start);
  const compiled = await transform(
    `globalThis.readGlyphArea = () => { ${helper}\n${source.slice(start, end)} return glyphs; };`,
    { loader: 'ts' }
  );
  class Shape {
    constructor(tag, path, bounds) {
      this.tagName = tag;
      this.namespaceURI = 'http://www.w3.org/2000/svg';
      this.path = path;
      this.bounds = bounds;
    }
    matches(selector) {
      return selector.split(',').includes(this.tagName);
    }
    closest() {
      return null;
    }
    getBBox() {
      return this.bounds;
    }
    getBoundingClientRect() {
      return { ...this.bounds, x: 1, y: 1 };
    }
  }
  return ({ tag = 'path', path = 'M2 2L22 22', bounds = { width: 20, height: 20 } } = {}) => {
    const shape = new Shape(tag, path, bounds);
    const sandbox = {
      nodes: [shape],
      Element: Shape,
      inactive: false,
      getComputedStyle: () => ({
        fill: 'rgb(0, 0, 0)',
        stroke: 'rgb(0, 0, 0)',
        color: 'rgb(0, 0, 0)',
        fillOpacity: '1',
        strokeOpacity: '1',
        strokeWidth: '2px',
        getPropertyValue: (property) => (property === 'd' ? `path("${path}")` : ''),
      }),
      background: () => ({ rgba: [255, 255, 255, 255], limits: [] }),
      paintedVisibility: () => ({ limits: [] }),
      paint: () => ({ rgba: [0, 0, 0, 255], alpha: 1, limits: [] }),
      contrast: () => 21,
    };
    vm.runInNewContext(compiled.code, sandbox);
    return sandbox.readGlyphArea()[0];
  };
};

for (const [name, input] of [
  ['line with diagonal bounds', { tag: 'line' }],
  ['one-segment path', {}],
  ['closed collinear path', { path: 'M2 2L12 12L22 22Z' }],
  ['zero-width rect', { tag: 'rect', bounds: { width: 0, height: 20 } }],
  ['relative path outside the bounded profile', { path: 'm2 2l22 2l22 22z' }],
  [
    'multiple-subpath fill outside the bounded profile',
    { path: 'M2 2L22 2L22 22Z M2 2L22 2L22 22Z' },
  ],
]) {
  test(`SVG numeric reader withholds ${name} fill without losing independent stroke`, async () => {
    const read = await glyphAreaFixture();
    const glyph = read(input);
    assert.equal(glyph.fillContrast, null);
    assert.ok(glyph.fillLimits.includes('unsupported-svg-fill-geometry'));
    assert.equal(glyph.strokeContrast, 21);
    assert.deepEqual(Array.from(glyph.strokeLimits), []);
  });
}
for (const [name, input] of [
  ['rect', { tag: 'rect' }],
  ['circle', { tag: 'circle' }],
  ['ellipse', { tag: 'ellipse' }],
  ['closed absolute triangle', { path: 'M2 2L22 2L22 22Z' }],
  ['implicitly closed absolute triangle', { path: 'M2,2 L22,2 L22,22' }],
]) {
  test(`SVG numeric reader retains positive-area ${name}`, async () => {
    const read = await glyphAreaFixture();
    const glyph = read(input);
    assert.equal(glyph.fillContrast, 21);
    assert.equal(glyph.strokeContrast, 21);
    assert.deepEqual(Array.from(glyph.fillLimits), []);
  });
}

const eraseTargetPaint = (fixture) => {
  Object.assign(fixture.style, {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'rgba(0, 0, 0, 0)',
    webkitTextFillColor: 'rgba(0, 0, 0, 0)',
    boxShadow: 'none',
    outlineStyle: 'none',
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
  });
};

for (const [name, modify] of [
  ['fully transparent control', () => {}],
  [
    'empty box with an opaque inherited text color',
    (f) => {
      f.textNode.textContent = '';
      f.style.webkitTextFillColor = f.style.color = '#000';
    },
  ],
  [
    'whitespace-only box',
    (f) => {
      f.textNode.textContent = '   ';
      f.style.webkitTextFillColor = f.style.color = '#000';
    },
  ],
  [
    'zero-size text ink',
    (f) => {
      f.style.fontSize = '0px';
      f.style.webkitTextFillColor = f.style.color = '#000';
    },
  ],
  [
    'transparent effective text fill despite opaque color',
    (f) => {
      f.style.color = '#000';
    },
  ],
  [
    'ancestor fill without target paint',
    (f) => {
      f.textNode.textContent = '';
      f.ancestorStyle.backgroundColor = '#fff';
    },
  ],
  [
    'border-image overriding the claimed border ink',
    (f) => {
      Object.assign(f.style, {
        borderTopStyle: 'solid',
        borderTopColor: '#000',
        borderTopWidth: '4px',
        borderImageSource: 'url(transparent.png)',
      });
    },
  ],
  [
    'unverified standalone shadow or outline',
    (f) => {
      Object.assign(f.style, {
        boxShadow: 'black 4px 4px 0px',
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineColor: '#000',
      });
    },
  ],
  [
    'native fallback DOM text',
    (f) => {
      f.style.webkitTextFillColor = f.style.color = '#000';
      f.element.matches = (selector) =>
        selector.startsWith(':') || selector.split(',').includes('textarea');
    },
  ],
  [
    'fully transparent non-sRGB background',
    (f) => {
      f.style.backgroundColor = 'oklch(0.7 0.1 40 / 0)';
    },
  ],
]) {
  test(`shared target predicate withholds ${name} rather than geometry-only achievement`, async () => {
    const f = await targetObservationFixture();
    eraseTargetPaint(f);
    modify(f);
    const observed = f.observe();
    assert.equal(observed.achieved, false);
    assert.equal(observed.visibility.visible, true);
    assert.equal(observed.visibility.classification, 'unsupported');
    assert.ok(observed.visibility.limits.includes('no-supported-nontransparent-paint'));
    assert.equal(observed.focused, true);
    assert.equal(observed.hovered, true);
  });
}

for (const [name, modify] of [
  [
    'own opaque fill',
    (f) => {
      f.style.backgroundColor = '#fff';
    },
  ],
  [
    'opaque non-sRGB fill without numeric conversion',
    (f) => {
      f.style.backgroundColor = 'oklch(0.7 0.1 40)';
    },
  ],
  [
    'solid border ink',
    (f) => {
      Object.assign(f.style, {
        borderTopStyle: 'solid',
        borderTopColor: '#000',
        borderTopWidth: '4px',
      });
    },
  ],
  [
    'direct nonempty Range ink',
    (f) => {
      f.style.webkitTextFillColor = f.style.color = '#000';
    },
  ],
]) {
  test(`shared target predicate keeps ${name} as a bounded paint witness`, async () => {
    const f = await targetObservationFixture();
    eraseTargetPaint(f);
    modify(f);
    assert.equal(f.observe().achieved, true);
  });
}

for (const visible of [true, false]) {
  test(`composed descendant text witness ${visible ? 'qualifies' : 'rejects hidden ink'}`, async () => {
    const f = await targetObservationFixture();
    eraseTargetPaint(f);
    const child = { ...f.element, parentElement: f.element, childNodes: [] };
    const text = { ...f.textNode, parentElement: child };
    child.childNodes = [text];
    f.element.childNodes = [child];
    const childStyle = {
      ...f.style,
      color: '#000',
      webkitTextFillColor: '#000',
      opacity: visible ? '1' : '0',
    };
    f.styleByElement.set(child, childStyle);
    assert.equal(f.observe().achieved, visible);
  });
}

for (const opaque of [true, false]) {
  test(`SVG-only target ${opaque ? 'keeps proven solid stroke' : 'rejects transparent stroke'}`, async () => {
    const f = await targetObservationFixture();
    eraseTargetPaint(f);
    Object.assign(f.element, {
      namespaceURI: 'http://www.w3.org/2000/svg',
      childNodes: [],
      closest: () => null,
      getBBox: () => ({ width: 20, height: 20 }),
      getTotalLength: () => 20,
    });
    f.element.matches = (selector) =>
      selector.startsWith(':') || selector.split(',').includes('path');
    Object.assign(f.style, {
      fill: 'none',
      fillOpacity: '1',
      stroke: opaque ? '#000' : 'rgba(0,0,0,0)',
      strokeOpacity: '1',
      strokeWidth: '2px',
      strokeDasharray: 'none',
    });
    assert.equal(f.observe().achieved, opaque);
  });
}

for (const hidden of [false, true]) {
  test(`assigned text uses its composed slot paint chain ${hidden ? 'to reject hidden ink' : 'as a positive witness'}`, async () => {
    const f = await targetObservationFixture();
    eraseTargetPaint(f);
    const slot = { ...f.element, parentElement: f.element, childNodes: [] };
    const assigned = { ...f.textNode, parentElement: f.element, assignedSlot: slot };
    slot.childNodes = [assigned];
    f.element.childNodes = [slot];
    f.styleByElement.set(slot, {
      ...f.style,
      color: '#000',
      webkitTextFillColor: '#000',
      opacity: hidden ? '0' : '1',
    });
    assert.equal(f.observe().achieved, !hidden);
  });
}
