import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import { transformSync } from 'esbuild';
import YAML from 'yaml';
import {
  collectReadingBreakpoint,
  readingBreakpointFailures,
  READING_BREAKPOINT_CASES,
} from '../../apps/www/scripts/reading-reference-breakpoints.mjs';

const normal = (width) => READING_BREAKPOINT_CASES.find((entry) => entry.viewport.width === width);
const stress = READING_BREAKPOINT_CASES.find((entry) => entry.stressOnly);
const box = (values = {}) => ({ visible: true, width: 200, left: 900, right: 1100, ...values });
function fixture(target) {
  const rootFontSize = (16 * target.textPercent) / 100;
  const hidden = target.viewport.width < 1280;
  const observation = {
    errors: [],
    viewport: {
      innerWidth: target.viewport.width,
      innerHeight: 757,
      devicePixelRatio: 1,
      visualViewport: { scale: 1 },
      rootZoom: '1',
      bodyZoom: '1',
    },
    root: { attributes: { 'data-theme': target.colorScheme } },
    fonts: { status: 'loaded' },
    roles: {},
  };
  const breakpoint = {
    rootFontSize,
    rootInlineFontSize: target.stressOnly ? '200%' : '',
    viewportWidth: target.viewport.width,
    viewportHeight: 757,
    scrollY: 0,
    boxes: {
      '.docs-shell': box(),
      '.docs-reading-columns': box({ flexDirection: target.stressOnly ? 'column' : 'row' }),
      '.right-sidebar-container': box({
        visible: !hidden,
        position: target.stressOnly ? 'static' : 'relative',
        order: target.stressOnly ? '0' : '2',
      }),
      '.right-sidebar': box(),
      '.right-sidebar-panel .sl-container': box(),
      '.right-sidebar-panel sl-toc': box({
        visible: !hidden,
        width: target.stressOnly ? 500 : 200,
      }),
      '.right-sidebar-panel nav': box(),
      '.main-pane': box({ left: 250, right: 900 }),
    },
  };
  const reflow = {
    overflow: 0,
    visibleTocLinks: hidden ? [] : [{ label: 'Overview', width: 11 * rootFontSize }],
    controls: [{ selector: 'theme', width: 44, height: 44, left: 1100, right: 1144 }],
  };
  return { observation, breakpoint, reflow, target };
}
const failures = ({ observation, breakpoint, reflow, target }) =>
  readingBreakpointFailures(observation, breakpoint, reflow, target);

describe('normal reading boundary diagnosis', () => {
  it('keeps every 1279/1280/1281 normal case separate from the labelled 200% control', () => {
    assert.equal(READING_BREAKPOINT_CASES.length, 16);
    assert.equal(new Set(READING_BREAKPOINT_CASES.map(({ id }) => id)).size, 16);
    for (const width of [1279, 1280, 1281]) {
      const cases = READING_BREAKPOINT_CASES.filter((entry) => entry.viewport.width === width);
      assert.equal(cases.length, 4);
      assert.ok(cases.every((entry) => !entry.stressOnly && entry.textPercent === 100));
      assert.deepEqual(
        [...new Set(cases.map(({ colorScheme }) => colorScheme))],
        ['light', 'dark']
      );
    }
    assert.ok(
      READING_BREAKPOINT_CASES.filter((entry) => entry.stressOnly).every(
        (entry) => entry.textPercent === 200 && entry.viewport.width === 1440
      )
    );
  });
  it('accepts distinct native hidden, lateral and enlarged-flow fixtures', () => {
    for (const target of [normal(1279), normal(1280), normal(1281), stress])
      assert.deepEqual(failures(fixture(target)), []);
  });
  it('rejects the inclusive reflow defect at 1280 and its padded/scrollbar neighbour at 1281', () => {
    for (const width of [1280, 1281]) {
      const input = fixture(normal(width));
      input.breakpoint.boxes['.docs-reading-columns'].flexDirection = 'column';
      Object.assign(input.breakpoint.boxes['.right-sidebar-container'], {
        position: 'static',
        order: '0',
      });
      input.breakpoint.boxes['.right-sidebar-panel sl-toc'].left = 250;
      const result = failures(input);
      assert.ok(result.some((error) => error.includes('stacked TOC reflow')));
      assert.ok(result.some((error) => error.includes('not above it')));
    }
  });
  it('rejects false-green hidden or absent desktop TOCs and accidental 1279 disclosure', () => {
    const absent = fixture(normal(1280));
    absent.breakpoint.boxes['.right-sidebar-panel sl-toc'] = null;
    assert.ok(failures(absent).some((error) => error.includes('Missing actual reading owner')));
    const hidden = fixture(normal(1280));
    hidden.reflow.visibleTocLinks = [];
    assert.ok(failures(hidden).some((error) => error.includes('paint the actual')));
    const exposed = fixture(normal(1279));
    exposed.breakpoint.boxes['.right-sidebar-container'].visible = true;
    assert.ok(failures(exposed).some((error) => error.includes('existing hidden')));
  });
  it('cannot substitute stress, different width, CSS zoom or changed normal root for normal evidence', () => {
    for (const mutate of [
      (input) => {
        input.breakpoint.rootFontSize = 32;
      },
      (input) => {
        input.breakpoint.rootInlineFontSize = '100%';
      },
      (input) => {
        input.observation.viewport.innerWidth = 1440;
      },
      (input) => {
        input.observation.viewport.rootZoom = '2';
      },
      (input) => {
        input.breakpoint.viewportHeight = 1000;
      },
    ]) {
      const input = fixture(normal(1280));
      mutate(input);
      assert.ok(failures(input).length);
    }
  });
  it('retains the enlarged-text actual-link width and Header reachability checks', () => {
    const input = fixture(stress);
    input.breakpoint.boxes['.right-sidebar-panel sl-toc'].width = 170;
    input.reflow.visibleTocLinks[0].width = 100;
    input.reflow.controls[0].right = 1500;
    const result = failures(input);
    assert.equal(result.length, 3);
  });
  it('serializes without transform helpers and reads content-box/scrollbar facts without DOM writes', () => {
    const source = readFileSync('apps/www/scripts/reading-reference-breakpoints.mjs', 'utf8');
    const module = { exports: {} };
    runInNewContext(transformSync(source, { loader: 'js', format: 'cjs', keepNames: true }).code, {
      module,
      exports: module.exports,
      require: () => ({ READING_ROUTES: [] }),
    });
    const serialized = module.exports.collectReadingBreakpoint.toString();
    assert.doesNotMatch(serialized, /\b__name\s*\(/);
    for (const scrollbarWidth of [0, 15]) {
      const style = {
        fontSize: '16px',
        paddingLeft: '16px',
        paddingRight: '16px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
        containerName: 'docs-canvas',
        containerType: 'inline-size',
      };
      const element = {
        clientWidth: 1281 - scrollbarWidth,
        scrollWidth: 1281 - scrollbarWidth,
        checkVisibility: () => true,
        getBoundingClientRect: () => ({ toJSON: () => ({ width: 1281 - scrollbarWidth }) }),
      };
      const result = runInNewContext(`(${serialized})()`, {
        document: {
          querySelector: () => element,
          documentElement: { clientWidth: 1281 - scrollbarWidth, style: { fontSize: '' } },
        },
        getComputedStyle: () => style,
        innerWidth: 1281,
        innerHeight: 757,
        scrollY: 0,
        matchMedia: () => ({ matches: true }),
      });
      assert.equal(result.scrollbarWidth, scrollbarWidth);
      assert.equal(result.docsCanvasContentWidth, 1249 - scrollbarWidth);
      assert.equal(result.derivedCanvasAtMost80RootRem, true);
      assert.equal(result.boxes['.docs-shell'].containerName, 'docs-canvas');
    }
    assert.doesNotMatch(
      collectReadingBreakpoint.toString(),
      /(?:\.style\.[a-zA-Z]+\s*=|appendChild|setAttribute)/
    );
  });
  it('rejects link or ancestor opacity/visibility hiding rather than accepting a visible wrapper', () => {
    const source = readFileSync(
      'apps/www/src/content/docs/zh-cn/reading-reflow-evidence.ts',
      'utf8'
    );
    const module = { exports: {} };
    runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs', keepNames: true }).code, {
      module,
      exports: module.exports,
    });
    const serialized = module.exports.readReadingReflow.toString();
    for (const target of [normal(1280), normal(1281), stress])
      for (const hiddenBy of [
        'self-opacity',
        'self-visibility',
        'ancestor-opacity',
        'ancestor-visibility',
      ]) {
        const element = {
          getBoundingClientRect: () => ({
            toJSON: () => ({ width: 440, height: 44, left: 0, right: 440 }),
          }),
        };
        const link = {
          ...element,
          textContent: 'Overview',
          // Model the CSSOM option gates, not a claim of browser paint execution.
          checkVisibility: (options = {}) =>
            hiddenBy.includes('opacity') ? !options.checkOpacity : !options.checkVisibilityCSS,
        };
        const reflow = runInNewContext(`(${serialized})()`, {
          document: {
            documentElement: { scrollWidth: target.viewport.width },
            querySelector: () => element,
            querySelectorAll: () => [link],
          },
          innerWidth: target.viewport.width,
          getComputedStyle: () => ({ fontSize: `${(16 * target.textPercent) / 100}px` }),
        });
        assert.equal(reflow.visibleTocLinks.length, 0, `${target.id}/${hiddenBy}`);
        const value = fixture(target);
        value.reflow = reflow;
        assert.ok(
          failures(value).some((failure) =>
            /actual native TOC|same visible native TOC/.test(failure)
          )
        );
      }
  });
  it('uses the same source/build/network/screenshot runner and a separately named retained profile', () => {
    const runner = readFileSync('apps/www/scripts/capture-reading-reference.mjs', 'utf8');
    assert.match(runner, /breakpointMode \? READING_BREAKPOINT_CASES : READING_CASES/);
    assert.match(runner, /breakpointMode \? 'reading-breakpoints.json' : 'reading-reference.json'/);
    assert.match(runner, /readSourceBinding\(process.env.PROTO_UI_EXPECTED_HEAD\)/);
    assert.match(runner, /await verifyReadingBuild\(/);
    assert.match(runner, /routeOwnResponse\(route, baseUrl/);
    assert.match(runner, /entry.reflow = await page.evaluate\(readReadingReflow\)/);
    assert.match(runner, /if \(target.stressOnly\)/);
    assert.ok(
      runner.indexOf("await screenshot('viewport'") <
        runner.indexOf('if (entry.observationFailures.length)')
    );
    const workflow = YAML.parse(
      readFileSync('.github/workflows/reading-reference-evidence.yml', 'utf8')
    );
    const step = workflow.jobs.capture.steps.find((step) => step.name?.includes('Diagnose normal'));
    assert.match(step.run, /capture-reading-reference.mjs --breakpoints/);
    assert.match(step.if, /steps.build.outcome == 'success'/);
    assert.equal(
      step['continue-on-error'],
      undefined,
      'Expected CSS regression cannot become a false-green workflow.'
    );
  });
});
