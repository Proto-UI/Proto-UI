// @vitest-environment node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';

type Browser = Awaited<ReturnType<typeof launchBrowser>>;
type Page = Awaited<ReturnType<Browser['newPage']>>;
type Scope = 'document' | 'direct-shadow' | 'shadow-split';
type Sample = {
  time: number;
  width: number;
  computedWidth: number;
  hostWidth: number;
  surfaceWidth: number;
  trackWidth: number;
  inlineWidth: string;
  inlinePriority: string;
  percentageVariable: string;
  tokens: string;
  value: number;
  percentage: number;
  indicatorValue: number;
  indicatorPercentage: number;
  indeterminate: boolean;
  ariaValueNow: string | null;
  diagnostics: string[];
  motionCallbacks: number;
  projectedTime: number;
};
type Trace = {
  started: number;
  samples: (Sample & { elapsed: number; referenceWidth?: number })[];
};
let output: string;
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
let script: string, css: string;
let artifact: ReturnType<typeof renderProtoShadowSplitStyleArtifact>;
let sourceEvidence: Record<string, unknown>;

beforeAll(async () => {
  output = process.env.PUI_FINF_FEATURE_EVIDENCE_DIR
    ? path.join(process.env.PUI_FINF_FEATURE_EVIDENCE_DIR, 'bootstrap-progress-width')
    : await mkdtemp(path.join(tmpdir(), 'pui-bootstrap-progress-width-'));
  await mkdir(output, { recursive: true });
  try {
    const tokens = (
      await collectProtoStyleTokens('packages/prototypes/bootstrap-2-3-2/src/progress')
    ).map((token) => {
      if (typeof token !== 'string') throw new TypeError('Expected collected source token');
      return token;
    });
    css = renderProtoStyleTokenCss(tokens);
    artifact = renderProtoShadowSplitStyleArtifact(tokens);
    const result = await build({
      stdin: {
        contents: [
          "export {progressRoot,progressTrack,progressIndicator} from './packages/prototypes/bootstrap-2-3-2/src/progress';",
          "export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';",
          "export {setElementProps} from './packages/adapters/web-component/src/props';",
        ].join('\n'),
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'BootstrapProgressConsumer',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
    });
    script = result.outputFiles[0].text;
    sourceEvidence = {
      source: 'Real Bootstrap Progress Root/Track/Indicator and Web Component adapter',
      bundleSha256: createHash('sha256').update(script).digest('hex'),
      cssSha256: createHash('sha256').update(css).digest('hex'),
      tokenCount: tokens.length,
      timing:
        'Actual requestAnimationFrame/performance.now observations; no fake clock or computed-style mock',
      limit:
        'Headless browser coverage does not establish physical 120 Hz hardware or frame-budget performance.',
    };
    await writeFile(path.join(output, 'consumer.js'), script);
    await writeFile(path.join(output, 'tokens.css'), css);
    await writeFile(path.join(output, 'shadow-artifact.json'), JSON.stringify(artifact, null, 2));
    await writeFile(path.join(output, 'source.json'), JSON.stringify(sourceEvidence, null, 2));
    browser = await launchBrowser();
  } catch (error) {
    await writeFile(
      path.join(output, 'setup-error.json'),
      JSON.stringify({ error: error instanceof Error ? error.stack : String(error) }, null, 2)
    );
    throw error;
  }
}, 30000);
afterAll(async () => browser?.close());

async function createPage(
  scope: Scope,
  errors: string[],
  allocated: (page: Page) => void,
  requireReady = true
): Promise<Page> {
  if (!browser) throw new Error('Browser was not launched');
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  allocated(page);
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setContent(
    '<main style="padding:40px"><h1>Bootstrap Progress width</h1><div id="mount" style="width:400px"></div></main>'
  );
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ scope, css, artifact }) => {
      const p = (window as any).BootstrapProgressConsumer;
      const runtimeErrors: string[] = [];
      (window as any).progressRuntimeErrors = runtimeErrors;
      window.addEventListener('error', (event) =>
        runtimeErrors.push(String(event.error ?? event.message))
      );
      const stylesheet = document.createElement('style');
      stylesheet.textContent = css;
      document.head.append(stylesheet);
      const options: any =
        scope === 'shadow-split'
          ? { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
          : scope === 'direct-shadow'
            ? { shadow: true }
            : {};
      let latestDiagnostics: string[] = [],
        motionCallbacks = 0,
        projectedTime = 0;
      const diagnosticHistory: { time: number; reasons: string[] }[] = [];
      const Root = p.adapt(p.progressRoot, options);
      const Track = p.adapt(p.progressTrack, options);
      const Indicator = p.adapt(p.progressIndicator, {
        ...options,
        residentMotion: {
          diagnostics(reasons: readonly string[]) {
            motionCallbacks++;
            // The final diagnostics callback follows the synchronous host projection.
            projectedTime = performance.now();
            latestDiagnostics = [...reasons];
            diagnosticHistory.push({ time: performance.now(), reasons: [...reasons] });
          },
        },
      });
      const root = new Root(),
        track = new Track(),
        indicator = new Indicator();
      root.id = 'progress-root';
      track.id = 'progress-track';
      indicator.id = 'progress-indicator';
      let props: Record<string, unknown> = {
        min: 0,
        max: 100,
        value: 20,
        ariaLabel: 'Upload',
      };
      p.setElementProps(root, props);
      track.append(indicator);
      root.append(track);
      document.querySelector('#mount')!.append(root);
      const surface = (el: HTMLElement): HTMLElement =>
        (el.shadowRoot?.querySelector('[part="surface"]') ?? el) as HTMLElement;
      const flush = async () => {
        for (let index = 0; index < 24; index++) await Promise.resolve();
      };
      const rootValues: number[] = [],
        indicatorValues: number[] = [];
      const subscriptions: (() => void)[] = [];
      const installSubscriptions = () => {
        subscriptions.push(
          root.getExposes().value.subscribe(() => rootValues.push(root.getExposes().value.get())),
          indicator
            .getExposes()
            .value.subscribe(() => indicatorValues.push(indicator.getExposes().value.get()))
        );
      };
      const sample = (): Sample => {
        const paintSurface = surface(indicator);
        // Width placement belongs to the Root boundary in the experimental
        // split profile. Its rejected consumer is observed only as a negative control.
        const physical = scope === 'shadow-split' ? indicator : paintSurface;
        const trackSurface = surface(track);
        const computed = getComputedStyle(physical);
        const semantic = root.getExposes(),
          borrowed = indicator.getExposes();
        const a11y = root.getAttribute('role') === 'progressbar' ? root : surface(root);
        return {
          time: performance.now(),
          width: physical.getBoundingClientRect().width,
          computedWidth: Number.parseFloat(computed.width),
          hostWidth: indicator.getBoundingClientRect().width,
          surfaceWidth: paintSurface.getBoundingClientRect().width,
          trackWidth: trackSurface.getBoundingClientRect().width,
          inlineWidth: physical.style.getPropertyValue('width'),
          inlinePriority: physical.style.getPropertyPriority('width'),
          percentageVariable: computed.getPropertyValue('--pui-percentage').trim(),
          tokens: [
            physical.getAttribute('data-pui-style') ?? '',
            indicator.getAttribute('data-pui-split-root-style') ?? '',
          ].join(' '),
          value: semantic.value.get(),
          percentage: semantic.percentage.get(),
          indicatorValue: borrowed.value.get(),
          indicatorPercentage: borrowed.percentage.get(),
          indeterminate: borrowed.indeterminate.get(),
          ariaValueNow: a11y.getAttribute('aria-valuenow'),
          diagnostics: [...latestDiagnostics],
          motionCallbacks,
          projectedTime,
        };
      };
      const update = async (next: Record<string, unknown>) => {
        const started = performance.now();
        props = { ...props, ...next };
        p.setElementProps(root, props);
        await flush();
        return started;
      };
      // A separate native CSS animation is an independent easing oracle. It
      // never drives the Proto component and does not supply its target.
      const trace = async (
        duration: number,
        started = performance.now(),
        reference?: { from: number; to: number }
      ): Promise<Trace> => {
        let probe: HTMLDivElement | undefined, animation: Animation | undefined;
        if (reference) {
          probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;left:-10000px;top:0;height:1px;';
          document.body.append(probe);
          animation = probe.animate(
            [{ width: reference.from + 'px' }, { width: reference.to + 'px' }],
            { duration: 600, easing: 'ease', fill: 'both' }
          );
          animation.pause();
        }
        const samples: Trace['samples'] = [];
        const take = () => {
          const value = sample(),
            elapsed = value.time - started;
          let referenceWidth: number | undefined;
          if (animation && probe) {
            // ResizeObserver can put this observer before the host RAF in a
            // frame. Compare the latest projected sample at its own time,
            // rather than comparing an older width with the observer's clock.
            animation.currentTime = Math.max(0, Math.min(600, value.projectedTime - started));
            referenceWidth = Number.parseFloat(getComputedStyle(probe).width);
          }
          samples.push({
            ...value,
            elapsed,
            ...(referenceWidth === undefined ? {} : { referenceWidth }),
          });
        };
        try {
          take();
          do {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            take();
          } while (performance.now() - started < duration);
          return { started, samples };
        } finally {
          animation?.cancel();
          probe?.remove();
        }
      };
      (window as any).progressSubject = {
        root,
        track,
        indicator,
        surface,
        sample,
        update,
        trace,
        flush,
        installSubscriptions,
        history: () => ({ rootValues: [...rootValues], indicatorValues: [...indicatorValues] }),
        clearHistory() {
          rootValues.length = 0;
          indicatorValues.length = 0;
        },
        diagnostics: () => [...diagnosticHistory],
        disposeSubscriptions() {
          for (const off of subscriptions.splice(0)) off();
        },
      };
    },
    { scope, css, artifact }
  );
  if (!requireReady) return page;
  await page.waitForFunction(
    () => {
      const subject = (window as any).progressSubject;
      if (!subject) return false;
      const semantic = subject.root.getExposes?.(),
        borrowed = subject.indicator.getExposes?.();
      if (!semantic?.value || !semantic?.percentage || !borrowed?.value || !borrowed?.percentage)
        return false;
      const sample = subject.sample();
      return (
        sample.value === 20 &&
        sample.percentage === 20 &&
        Math.abs(sample.trackWidth - 400) < 0.1 &&
        Math.abs(sample.width - 80) < 0.1 &&
        sample.inlineWidth === ''
      );
    },
    undefined,
    { timeout: 5000 }
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    (window as any).progressSubject.installSubscriptions();
  });
  return page;
}

async function evidenceCase(
  scope: Scope,
  name: string,
  run: (page: Page, evidence: Record<string, unknown>) => Promise<void>
) {
  const errors: string[] = [];
  const evidence: Record<string, unknown> = { ...sourceEvidence, scope, name };
  let page: Page | undefined;
  try {
    page = await createPage(scope, errors, (created) => {
      page = created;
    });
    evidence.initial = await page.evaluate(() => (window as any).progressSubject.sample());
    await run(page, evidence);
    expect(errors).toEqual([]);
  } catch (error) {
    evidence.failure = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    if (page) {
      evidence.final = await page
        .evaluate(() => {
          const subject = (window as any).progressSubject;
          if (!subject) return null;
          const result = {
            sample: subject.sample(),
            diagnostics: subject.diagnostics(),
            history: subject.history(),
          };
          subject.disposeSubscriptions();
          return result;
        })
        .catch((error) => ({ captureError: String(error) }));
      await page
        .screenshot({ path: path.join(output, scope + '-' + name + '.png') })
        .catch((error) => {
          evidence.screenshotError = String(error);
        });
      await page.close();
    }
    evidence.errors = errors;
    await writeFile(
      path.join(output, scope + '-' + name + '.json'),
      JSON.stringify(evidence, null, 2)
    );
  }
}

describe.each(['document', 'direct-shadow'] as const)(
  'Bootstrap Progress real browser percentage projection (%s)',
  (scope) => {
    it('runs 600ms CSS ease and reverses without tweening Base semantic State', async () => {
      await evidenceCase(scope, 'ease-and-reversal', async (page, evidence) => {
        const forward = (await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          subject.clearHistory();
          const started = await subject.update({ value: 80 });
          const trace = await subject.trace(760, started, { from: 80, to: 320 });
          return { ...trace, history: subject.history() };
        })) as Trace & { history: { rootValues: number[]; indicatorValues: number[] } };
        evidence.forward = forward;
        const last = forward.samples.at(-1)!;
        expect(last.width).toBeCloseTo(320, 1);
        expect(last.computedWidth).toBeCloseTo(320, 1);
        expect(last.inlineWidth).toBe('');
        expect(last.tokens).toContain('w-[calc(var(--pui-percentage)*1%)]');
        expect(forward.history.rootValues).toEqual([80]);
        expect(forward.history.indicatorValues).toEqual([80]);
        for (const sample of forward.samples) {
          expect(sample.value).toBe(80);
          expect(sample.indicatorValue).toBe(80);
          expect(sample.percentage).toBe(80);
          expect(sample.indicatorPercentage).toBe(80);
          expect(sample.ariaValueNow).toBe('80');
          expect(sample.percentageVariable).toBe('80');
          expect(sample.trackWidth).toBeCloseTo(400, 1);
          expect(sample.surfaceWidth).toBeCloseTo(sample.width, 1);
        }
        const interior = forward.samples.filter(
          (sample) => sample.elapsed >= 100 && sample.elapsed <= 520
        );
        expect(interior.length).toBeGreaterThan(2);
        expect(interior.some((sample) => sample.width > 85 && sample.width < 315)).toBe(true);
        // Time is observed, not faked. Allow scheduling/serialization skew while
        // distinguishing upstream CSS ease from linear or ease-out interpolation.
        for (const sample of interior)
          expect(Math.abs(sample.width - sample.referenceWidth!)).toBeLessThan(12);
        const settled = forward.samples.find(
          (sample) =>
            sample.elapsed > 0 && sample.inlineWidth === '' && Math.abs(sample.width - 320) < 0.1
        );
        expect(settled).toBeDefined();
        const gaps = forward.samples
          .slice(1)
          .map((sample, index) => sample.time - forward.samples[index].time);
        expect(settled!.elapsed).toBeGreaterThanOrEqual(580);
        expect(settled!.elapsed).toBeLessThanOrEqual(600 + Math.max(...gaps) + 40);
        evidence.observedFrameGaps = gaps;

        const reversal = await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          subject.clearHistory();
          const started = await subject.update({ value: 20 });
          const outward = await subject.trace(140, started);
          const before = subject.sample();
          const reversedAt = await subject.update({ value: 80 });
          const after = subject.sample();
          const returning = await subject.trace(700, reversedAt);
          return { outward, before, after, returning, history: subject.history() };
        });
        evidence.reversal = reversal;
        expect(reversal.before.width).toBeGreaterThan(80);
        expect(reversal.before.width).toBeLessThan(320);
        expect(reversal.after.width).toBeCloseTo(reversal.before.width, 1);
        expect(
          reversal.returning.samples.some(
            (sample: Sample) => sample.width > reversal.before.width + 1 && sample.width < 319
          )
        ).toBe(true);
        expect(reversal.returning.samples.at(-1).width).toBeCloseTo(320, 1);
        expect(reversal.returning.samples.at(-1).inlineWidth).toBe('');
        expect(reversal.history.rootValues).toEqual([20, 80]);
        expect(reversal.history.indicatorValues).toEqual([20, 80]);
      });
    }, 30000);

    it('settles on reduced motion while preserving indeterminate and Base range ownership', async () => {
      await evidenceCase(scope, 'reduced-and-indeterminate', async (page, evidence) => {
        const inFlight = (await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          const started = await subject.update({ value: 80 });
          const trace = await subject.trace(120, started);
          const media = matchMedia('(prefers-reduced-motion: reduce)');
          subject.reductionProbe = new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('No reduced-motion change event')),
              1500
            );
            media.addEventListener(
              'change',
              async () => {
                try {
                  const eventTime = performance.now(),
                    atEvent = subject.sample();
                  await subject.flush();
                  const afterMicrotasks = subject.sample(),
                    frames: Sample[] = [];
                  for (let index = 0; index < 2; index++) {
                    await new Promise<void>((done) => requestAnimationFrame(() => done()));
                    frames.push(subject.sample());
                  }
                  resolve({ eventTime, atEvent, afterMicrotasks, frames });
                } catch (error) {
                  reject(error);
                } finally {
                  clearTimeout(timeout);
                }
              },
              { once: true }
            );
          });
          return trace;
        })) as Trace;
        evidence.inFlight = inFlight;
        const active = inFlight.samples.at(-1)!;
        expect(active.inlineWidth).not.toBe('');
        expect(active.width).toBeGreaterThan(80);
        expect(active.width).toBeLessThan(320);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const interruption = await page.evaluate(
          () => (window as any).progressSubject.reductionProbe
        );
        evidence.reducedInterruption = interruption;
        // The media change must interrupt this still-running 600ms attempt.
        // Waiting for its ordinary endpoint would not establish cancellation.
        expect(interruption.eventTime - inFlight.started).toBeLessThan(500);
        expect(interruption.afterMicrotasks.time - inFlight.started).toBeLessThan(580);
        expect(interruption.afterMicrotasks.width).toBeCloseTo(320, 1);
        expect(interruption.afterMicrotasks.inlineWidth).toBe('');
        for (const sample of interruption.frames) {
          expect(sample.width).toBeCloseTo(320, 1);
          expect(sample.inlineWidth).toBe('');
        }
        const reduced = (await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          subject.clearHistory();
          const started = await subject.update({ value: 10 });
          return { ...(await subject.trace(100, started)), history: subject.history() };
        })) as Trace & { history: { rootValues: number[]; indicatorValues: number[] } };
        evidence.reduced = reduced;
        for (const sample of reduced.samples) {
          expect(sample.width).toBeCloseTo(40, 1);
          expect(sample.inlineWidth).toBe('');
          expect(sample.value).toBe(10);
          expect(sample.percentage).toBe(10);
        }
        expect(reduced.history.rootValues).toEqual([10]);
        expect(reduced.history.indicatorValues).toEqual([10]);

        const indeterminate = (await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          await subject.update({ indeterminate: true });
          return subject.sample();
        })) as Sample;
        evidence.indeterminate = indeterminate;
        expect(indeterminate.indeterminate).toBe(true);
        expect(indeterminate.percentage).toBe(0);
        expect(indeterminate.ariaValueNow).toBeNull();
        expect(indeterminate.tokens).toContain('w-1/3');
        expect(indeterminate.width).toBeCloseTo(400 / 3, 1);
        expect(indeterminate.inlineWidth).toBe('');

        const clamped = await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          subject.clearHistory();
          await subject.update({ min: 10, max: 90, value: 500, indeterminate: false });
          return { sample: subject.sample(), history: subject.history() };
        });
        evidence.clamped = clamped;
        expect(clamped.sample.value).toBe(90);
        expect(clamped.sample.indicatorValue).toBe(90);
        expect(clamped.sample.percentage).toBe(100);
        expect(clamped.sample.width).toBeCloseTo(400, 1);
        expect(clamped.sample.inlineWidth).toBe('');
        expect(clamped.sample.ariaValueNow).toBe('90');
        expect(clamped.history.rootValues).toEqual([90]);
        expect(clamped.history.indicatorValues).toEqual([90]);
      });
    }, 30000);

    it('rejects a foreign important width, releases its lease and stops sampling it', async () => {
      await evidenceCase(scope, 'important-owner', async (page, evidence) => {
        const blocked = await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          const started = await subject.update({ value: 80 });
          const beforeTrace = await subject.trace(140, started);
          const physical = subject.surface(subject.indicator) as HTMLElement;
          physical.id = 'progress-physical-indicator';
          const override = document.createElement('style');
          override.textContent = '#progress-physical-indicator { width: 0px !important; }';
          const root = physical.getRootNode();
          if (root instanceof ShadowRoot) root.append(override);
          else document.head.append(override);
          (window as any).widthOverride = override;
          const rejected = await subject.trace(180);
          const atRest = subject.sample();
          const tail = await subject.trace(700);
          return { beforeTrace, rejected, atRest, tail, diagnostics: subject.diagnostics() };
        });
        evidence.blocked = blocked;
        expect(
          blocked.beforeTrace.samples.some(
            (sample: Sample) => sample.width > 80 && sample.width < 320
          )
        ).toBe(true);
        expect(blocked.atRest.width).toBe(0);
        expect(blocked.atRest.inlineWidth).toBe('');
        expect(
          blocked.diagnostics.some((entry: { reasons: string[] }) =>
            entry.reasons.includes('width:projection-rejected')
          )
        ).toBe(true);
        for (const sample of blocked.tail.samples) {
          expect(sample.width).toBe(0);
          expect(sample.inlineWidth).toBe('');
          expect(sample.motionCallbacks).toBe(blocked.atRest.motionCallbacks);
          expect(sample.value).toBe(80);
        }
        const recovered = (await page.evaluate(async () => {
          const subject = (window as any).progressSubject;
          (window as any).widthOverride.remove();
          await subject.update({ value: 40 });
          return subject.trace(100);
        })) as Trace;
        evidence.recovered = recovered;
        for (const sample of recovered.samples) {
          expect(sample.width).toBeCloseTo(160, 1);
          expect(sample.inlineWidth).toBe('');
          expect(sample.value).toBe(40);
        }
      });
    }, 30000);
  }
);

describe('Bootstrap Progress experimental split admission boundary', () => {
  it('rejects unresolved Track clipping atomically without claiming split visual support', async () => {
    const reason =
      '[bootstrap-2-3-2-progress-track]setup token "overflow-hidden":unresolved-role; fix: companion or change/remove token';
    const errors: string[] = [];
    const evidence: Record<string, unknown> = {
      ...sourceEvidence,
      scope: 'shadow-split',
      disposition: 'unsupported',
      countsAsVisualAcceptance: false,
      reason,
      boundary:
        'Existing split admission rejects unresolved overflow-hidden; this is not a replacement for a successful Progress split journey.',
    };
    let page: Page | undefined;
    try {
      page = await createPage(
        'shadow-split',
        errors,
        (created) => {
          page = created;
        },
        false
      );
      await page.waitForFunction(
        (expected) =>
          ((window as any).progressRuntimeErrors as string[]).some((message) =>
            message.includes(expected)
          ),
        reason,
        { timeout: 3000 }
      );
      const rejected = await page.evaluate(async () => {
        const subject = (window as any).progressSubject;
        const capture = () => {
          const track = subject.track as HTMLElement,
            indicator = subject.indicator as HTMLElement;
          const elements = (host: HTMLElement) =>
            Array.from(host.shadowRoot?.querySelectorAll('*') ?? []).filter(
              (node): node is HTMLElement => node instanceof HTMLElement
            );
          const trackNodes = elements(track),
            indicatorNodes = elements(indicator);
          // Do not use the positive fixture's surface-or-host fallback here.
          // Rejection may precede part assignment or remove that assignment.
          // Inspect raw Shadow contents as well as either currently named part.
          const trackSurface =
            track.shadowRoot?.querySelector<HTMLElement>('[part~="surface"]') ?? null;
          const indicatorSurface =
            indicator.shadowRoot?.querySelector<HTMLElement>('[part~="surface"]') ?? null;
          const trackSplitSurfaceMarkers = trackNodes
            .filter((node) => node.hasAttribute('data-pui-split-surface'))
            .map((node) => ({
              node: node.localName,
              part: node.getAttribute('part'),
              tokens: node.getAttribute('data-pui-style'),
            }));
          const trackTokenFragments = [track, ...trackNodes]
            .flatMap((node, index) =>
              ['data-pui-split-root-style', 'data-pui-style'].map((attribute) => ({
                index,
                node: node.localName,
                attribute,
                tokens: node.getAttribute(attribute) ?? '',
              }))
            )
            .filter((entry) => entry.tokens.trim() !== '');
          const allInlineWidthLeases = [
            { owner: 'track', nodes: [track, ...trackNodes] },
            { owner: 'indicator', nodes: [indicator, ...indicatorNodes] },
          ]
            .flatMap(({ owner, nodes }) =>
              nodes.map((node, index) => ({
                owner,
                index,
                node: node.localName,
                part: node.getAttribute('part'),
                value: node.style.getPropertyValue('width'),
                priority: node.style.getPropertyPriority('width'),
              }))
            )
            .filter((entry) => entry.value !== '');
          return {
            time: performance.now(),
            trackSurfaceExists: trackSurface !== null,
            trackHostTokens: track.getAttribute('data-pui-split-root-style'),
            trackSurfaceTokens: trackSurface?.getAttribute('data-pui-style') ?? null,
            trackSurfaceMembership: trackSurface?.hasAttribute('data-pui-split-surface') ?? false,
            trackSplitSurfaceMarkers,
            trackTokenFragments,
            allInlineWidthLeases,
            widthLeases: [
              track.style.getPropertyValue('width'),
              trackSurface?.style.getPropertyValue('width') ?? '',
              indicator.style.getPropertyValue('width'),
              indicatorSurface?.style.getPropertyValue('width') ?? '',
            ],
            diagnostics: subject.diagnostics(),
            runtimeErrors: [...(window as any).progressRuntimeErrors],
          };
        };
        for (let index = 0; index < 2; index++)
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const first = capture();
        for (let index = 0; index < 4; index++)
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { first, later: capture() };
      });
      evidence.rejected = rejected;
      for (const observed of [rejected.first, rejected.later]) {
        // An unassigned or removed surface is a valid atomic rejection.
        // Raw scanning also catches partless remnants that the host fallback
        // would otherwise conceal.
        for (const marker of observed.trackSplitSurfaceMarkers)
          expect((marker.tokens ?? '').trim()).toBe('');
        expect(observed.trackTokenFragments).toEqual([]);
        expect(observed.allInlineWidthLeases).toEqual([]);
        expect((observed.trackHostTokens ?? '').trim()).toBe('');
        expect((observed.trackSurfaceTokens ?? '').trim()).toBe('');
        expect(observed.widthLeases).toEqual(['', '', '', '']);
        expect(observed.runtimeErrors.some((message: string) => message.includes(reason))).toBe(
          true
        );
        expect(
          observed.runtimeErrors.filter((message: string) => !message.includes(reason))
        ).toEqual([]);
      }
      expect(errors.some((message) => message.includes(reason))).toBe(true);
      expect(errors.filter((message) => !message.includes(reason))).toEqual([]);
    } catch (error) {
      evidence.failure = error instanceof Error ? error.stack : String(error);
      throw error;
    } finally {
      evidence.errors = errors;
      if (page) {
        evidence.final = await page
          .evaluate(() => {
            const subject = (window as any).progressSubject;
            return {
              runtimeErrors: (window as any).progressRuntimeErrors ?? [],
              diagnostics: subject?.diagnostics?.() ?? [],
              trackHostTokens: subject?.track?.getAttribute('data-pui-split-root-style'),
              trackSurfaceTokens:
                subject?.track?.shadowRoot
                  ?.querySelector('[part~="surface"]')
                  ?.getAttribute('data-pui-style') ?? null,
            };
          })
          .catch((error) => ({ captureError: String(error) }));
        await page
          .screenshot({ path: path.join(output, 'shadow-split-unsupported.png') })
          .catch((error) => {
            evidence.screenshotError = String(error);
          });
        await page.close();
      }
      await writeFile(
        path.join(output, 'shadow-split-unsupported.json'),
        JSON.stringify(evidence, null, 2)
      );
    }
  }, 15000);
});
