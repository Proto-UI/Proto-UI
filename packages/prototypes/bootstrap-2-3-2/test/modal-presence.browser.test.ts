// @vitest-environment node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderThemeCss } from '../src/theme';
import {
  isRetainedClosedPortal,
  isPhysicallyRetiredPortal,
} from '../../../../scripts/test/bootstrap-modal-observation';

type Family = 'dialog' | 'alert-dialog';
type Part = 'content' | 'mask';
type Phase = 'closed' | 'preparing' | 'entering' | 'entered' | 'leaving';
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof launchBrowser>>['newPage']>>;
type PartSample = {
  phase: Phase;
  present: boolean;
  connected: boolean;
  portaled: boolean;
  detached: boolean;
  owner: number;
  viewEpoch: number | null;
  created: number;
  mounted: number;
  unmounted: number;
  top: number;
  opacity: number;
  display: string;
  visibility: string;
  inert: boolean;
  inline: Record<string, { value: string; priority: string }>;
  rect: { x: number; y: number; width: number; height: number };
  concealed: boolean;
};
type Sample = {
  time: number;
  open: boolean;
  content: PartSample;
  mask: PartSample;
  referenceTop: number;
  referenceLeaveTop: number;
};
type Trace = {
  stage: string;
  started: number;
  reason: 'condition' | 'deadline';
  samples: (Sample & { elapsed: number; frameTimestamp: number | null })[];
};
type Reversal = {
  entered: Sample;
  closing: Trace;
  before: Sample;
  after: Sample;
  returning: Trace;
};
type ImageEvidence = {
  file: string;
  sha256: string;
  before: Sample | null;
  after: Sample | null;
};

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const testPath = 'packages/prototypes/bootstrap-2-3-2/test/modal-presence.browser.test.ts';
const sourceFiles = ['dialog', 'alert-dialog'].flatMap((family) =>
  ['root', 'content', 'mask', 'title', 'description'].map(
    (part) => `packages/prototypes/bootstrap-2-3-2/src/${family}/${part}.proto.ts`
  )
);
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
let output: string, script: string, css: string;
let sourceEvidence: Record<string, unknown>;

beforeAll(async () => {
  output = process.env.PUI_FINF_FEATURE_EVIDENCE_DIR
    ? path.join(process.env.PUI_FINF_FEATURE_EVIDENCE_DIR, 'bootstrap-modal-presence')
    : await mkdtemp(path.join(tmpdir(), 'pui-bootstrap-modal-presence-'));
  await mkdir(output, { recursive: true });
  try {
    const tokens = await collectProtoStyleTokensFromFiles(
      sourceFiles.map((file) => path.join(repositoryRoot, file))
    );
    // Use the actual layered CSS, selectors and family palette. The Happy DOM
    // compatibility rewriting in the separate source test is not used here.
    css = renderThemeCss() + renderProtoStyleTokenCss(tokens);
    const result = await build({
      absWorkingDir: repositoryRoot,
      stdin: {
        contents: [
          "export * as dialog from './packages/prototypes/bootstrap-2-3-2/src/dialog';",
          "export * as alertDialog from './packages/prototypes/bootstrap-2-3-2/src/alert-dialog';",
          "export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';",
          "export {setElementProps} from './packages/adapters/web-component/src/props';",
          "export {isWebComponentPortaled} from './packages/adapters/web-component/src/portal-mount';",
          "export {isRetainedClosedPortal,isPhysicallyRetiredPortal} from './scripts/test/bootstrap-modal-observation.ts';",
        ].join('\n'),
        resolveDir: repositoryRoot,
        loader: 'ts',
      },
      bundle: true,
      write: false,
      metafile: true,
      format: 'iife',
      globalName: 'BootstrapModalConsumer',
      platform: 'browser',
      tsconfig: path.join(repositoryRoot, 'tsconfig.json'),
    });
    script = result.outputFiles[0].text;
    const inputs = new Set([
      ...Object.keys(result.metafile.inputs).filter((file) => file !== '<stdin>'),
      ...sourceFiles,
      testPath,
      'packages/prototypes/bootstrap-2-3-2/src/theme.ts',
      'packages/cli/src/services/prototype-style-tokens.ts',
      'packages/cli/src/services/proto-style-css.ts',
    ]);
    const sourceSha256 = Object.fromEntries(
      await Promise.all(
        [...inputs]
          .sort()
          .map(async (file) => [file, sha256(await readFile(path.resolve(repositoryRoot, file)))])
      )
    );
    sourceEvidence = {
      runtime: 'Real Bootstrap Dialog/AlertDialog source with the Web Component adapter',
      scope: 'document',
      viewport: { width: 1000, height: 700 },
      sourceSha256,
      bundleSha256: sha256(script),
      cssSha256: sha256(css),
      tokenCount: tokens.length,
      timing:
        'Native requestAnimationFrame and performance.now; no component clock, RAF or computed-style mock',
      captureBoundary:
        'Measured timing traces finish before screenshots; separate visual journeys retain their own traces and capture intervals',
      oracle:
        'An offscreen, paused native CSS ease-out animation is sampled independently; it never drives the component',
      limits: [
        'Document source-Web coverage; no Web Component shadow-split claim',
        'Headless browser samples and PNGs do not establish physical 120 Hz hardware or a frame-budget result',
        'No native or assistive-technology conformance claim',
      ],
    };
    await writeFile(path.join(output, 'consumer.js'), script);
    await writeFile(path.join(output, 'tokens.css'), css);
    await writeFile(path.join(output, 'source.json'), JSON.stringify(sourceEvidence, null, 2));
    browser = await launchBrowser();
    sourceEvidence.browserVersion = browser.version();
    await writeFile(path.join(output, 'source.json'), JSON.stringify(sourceEvidence, null, 2));
  } catch (error) {
    await writeFile(
      path.join(output, 'setup-error.json'),
      JSON.stringify(
        {
          source: sourceEvidence ?? null,
          error: error instanceof Error ? error.stack : String(error),
        },
        null,
        2
      )
    );
    throw error;
  }
}, 30000);
afterAll(async () => browser?.close());

async function createPage(family: Family, errors: string[], allocated: (page: Page) => void) {
  if (!browser) throw new Error('Browser was not launched');
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  allocated(page);
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.setContent(`
    <style>
      html { font-size:16px; color-scheme:light }
      body { margin:0; background:#eef0f2; font-family:Arial,sans-serif; color:#333 }
      main { margin:48px auto; width:760px }
    </style>
    <main><h1>Bootstrap 2.3.2 ${family}</h1>
      <p>Actual source motion: Content 300ms, Mask 150ms.</p>
      <button id="underlying-page">Underlying page</button><div id="mount"></div>
    </main>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate((family) => {
    const p = (window as any).BootstrapModalConsumer;
    const source = family === 'dialog' ? p.dialog : p.alertDialog;
    const prefix = family === 'dialog' ? 'dialog' : 'alertDialog';
    const lifecycle: { time: number; part: string; event: Record<string, unknown> }[] = [];
    const phaseEvents: { time: number; part: Part; phase: Phase }[] = [];
    const facts = {
      content: { viewEpoch: null as number | null, created: 0, mounted: 0, unmounted: 0 },
      mask: { viewEpoch: null as number | null, created: 0, mounted: 0, unmounted: 0 },
    };
    const make = (part: string) => {
      const Constructor = p.adapt(source[prefix + part], {
        diagnostics: {
          onLifecycleEvent(event: Record<string, unknown>) {
            lifecycle.push({ time: performance.now(), part, event: { ...event } });
            const count = part === 'Content' ? facts.content : part === 'Mask' ? facts.mask : null;
            if (!count) return;
            if (event.type === 'instance.created') count.created++;
            if (event.type === 'mount.mounted') {
              count.viewEpoch = event.epoch as number;
              count.mounted++;
            }
            if (event.type === 'unmount.done') count.unmounted++;
          },
        },
      });
      return new Constructor();
    };
    const root = make('Root'),
      content = make('Content'),
      mask = make('Mask');
    const title = make('Title'),
      description = make('Description');
    title.textContent = family === 'dialog' ? 'Modal preferences' : 'Confirm these preferences';
    description.textContent =
      'This panel and backdrop use the real Bootstrap family sources. The close handoff must stay concealed until the retained Portal view is withdrawn.';
    content.append(title, description);
    root.append(mask, content);
    p.setElementProps(root, { open: false, a11yLabel: 'Modal preferences' });
    document.querySelector('#mount')!.append(root);
    const flush = async () => {
      for (let index = 0; index < 24; index++) await Promise.resolve();
    };
    const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const owners = new Map<object, number>();
    const ownerId = (owner: object) => {
      if (!owners.has(owner)) owners.set(owner, owners.size + 1);
      return owners.get(owner)!;
    };
    // This separate oracle consumes an observed progress value. It cannot
    // change the subject's clock, style, semantic target or completion.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-10000px;width:1px;height:1px;pointer-events:none';
    document.body.append(probe);
    const oracle = probe.animate([{ top: '-175px' }, { top: '70px' }], {
      duration: 300,
      easing: 'ease-out',
      fill: 'both',
    });
    oracle.pause();
    const readPart = (element: any, part: Part): PartSample => {
      const exposed = element.getExposes(),
        style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const opacity = Number(style.opacity);
      return {
        phase: exposed.transitionState.get(),
        present: exposed.isPresent.get(),
        connected: element.isConnected,
        portaled: p.isWebComponentPortaled(element),
        detached: element.hasAttribute('data-pui-view-detached'),
        owner: ownerId(exposed.getPresentationOwner()),
        ...facts[part],
        top: Number.parseFloat(style.top),
        opacity,
        display: style.display,
        visibility: style.visibility,
        inert: element.hasAttribute('inert'),
        inline: Object.fromEntries(
          ['top', 'opacity', 'visibility'].map((property) => [
            property,
            {
              value: element.style.getPropertyValue(property),
              priority: element.style.getPropertyPriority(property),
            },
          ])
        ),
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
        concealed:
          !element.isConnected ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          opacity === 0,
      };
    };
    const sample = (): Sample => {
      const time = performance.now(),
        c = readPart(content, 'content'),
        m = readPart(mask, 'mask');
      oracle.currentTime = Math.min(1, Math.max(0, c.opacity)) * 300;
      const referenceTop = Number.parseFloat(getComputedStyle(probe).top);
      oracle.currentTime = (1 - Math.min(1, Math.max(0, c.opacity))) * 300;
      return {
        time,
        open: root.getExposes().open.get(),
        content: c,
        mask: m,
        referenceTop,
        referenceLeaveTop: -105 - Number.parseFloat(getComputedStyle(probe).top),
      };
    };
    const traces: Trace[] = [],
      subscriptions: (() => void)[] = [];
    let stage = 'initial';
    let pending: Promise<Trace | Reversal> | null = null;
    const update = async (open: boolean) => {
      const started = performance.now();
      p.setElementProps(root, { open, a11yLabel: 'Modal preferences' });
      await flush();
      return started;
    };
    const observe = (
      started: number,
      name: string,
      until: (value: Sample, elapsed: number) => boolean,
      trailingFrames = 2
    ): Promise<Trace> =>
      new Promise((resolve) => {
        const trace: Trace = { stage: name, started, reason: 'deadline', samples: [] };
        traces.push(trace);
        let ticket: number | null = null,
          complete = false,
          satisfied = 0;
        const finish = (reason: Trace['reason']) => {
          if (complete) return;
          complete = true;
          trace.reason = reason;
          if (ticket !== null) cancelAnimationFrame(ticket);
          clearTimeout(deadline);
          resolve(trace);
        };
        // The authored completion deadline is 1000ms. This is an observation
        // watchdog, not a longer animation or a command to complete the subject.
        const deadline = setTimeout(() => finish('deadline'), 1000);
        const take = (frameTimestamp: number | null) => {
          const value = sample(),
            elapsed = value.time - started;
          trace.samples.push({ ...value, elapsed, frameTimestamp });
          satisfied = until(value, elapsed) ? satisfied + 1 : 0;
          if (satisfied > trailingFrames) finish('condition');
        };
        const frame = async (timestamp: number) => {
          ticket = null;
          await flush();
          if (complete) return;
          take(timestamp);
          if (!complete) ticket = requestAnimationFrame(frame);
        };
        take(null);
        if (!complete) ticket = requestAnimationFrame(frame);
      });
    const settled = (open: boolean, reference: Sample) => (value: Sample) =>
      open
        ? value.content.phase === 'entered' && value.mask.phase === 'entered'
        : p.isPhysicallyRetiredPortal(value.content, reference.content) &&
          p.isPhysicallyRetiredPortal(value.mask, reference.mask);
    const subject = {
      sample,
      async ready() {
        await flush();
        await nextFrame();
        await nextFrame();
        await flush();
        for (const [part, element] of [
          ['content', content],
          ['mask', mask],
        ] as const) {
          const state = element.getExposes().transitionState;
          subscriptions.push(
            state.subscribe(() =>
              phaseEvents.push({ time: performance.now(), part, phase: state.get() })
            )
          );
        }
        return sample();
      },
      begin(open: boolean, name: string) {
        stage = name;
        const reference = sample();
        pending = (async () => observe(await update(open), name, settled(open, reference)))();
      },
      reverse(kind: 'leaving' | 'barrier', label: string = kind) {
        pending = (async () => {
          const entered = sample();
          stage = label + '-close';
          const closing = await observe(
            await update(false),
            stage,
            (value, elapsed) =>
              kind === 'barrier'
                ? p.isRetainedClosedPortal(value.content, entered.content)
                : elapsed >= 75,
            0
          );
          const before = sample();
          stage = label + '-reopen';
          const started = await update(true),
            after = sample();
          const returning = await observe(started, stage, settled(true, entered));
          return { entered, closing, before, after, returning };
        })();
      },
      finish: () => pending,
      stage: () => stage,
      history: () => ({ traces, lifecycle, phaseEvents }),
      async dispose() {
        for (const off of subscriptions.splice(0)) off();
        oracle.cancel();
        probe.remove();
        root.remove();
        // Portals can be physically outside the original Root during teardown.
        content.remove();
        mask.remove();
        await flush();
        await nextFrame();
        await nextFrame();
        await flush();
        return {
          rootConnected: root.isConnected,
          contentConnected: content.isConnected,
          maskConnected: mask.isConnected,
          contentStyle: content.style.cssText,
          maskStyle: mask.style.cssText,
          contentInert: content.hasAttribute('inert'),
          maskInert: mask.hasAttribute('inert'),
          lifecycle,
        };
      },
    };
    (window as any).modalSubject = subject;
  }, family);
  await page.evaluate(() => (window as any).modalSubject.ready());
  return page;
}

async function capture(page: Page, name: string): Promise<ImageEvidence> {
  const read = () =>
    page.evaluate(() => (window as any).modalSubject?.sample() ?? null) as Promise<Sample | null>;
  const before = await read();
  const file = name + '.png';
  await page.screenshot({ path: path.join(output, file), animations: 'allow' });
  const after = await read();
  return { file, sha256: sha256(await readFile(path.join(output, file))), before, after };
}

async function captureInterior(page: Page, name: string, stage: string) {
  await page.waitForFunction(
    (stage) => {
      const subject = (window as any).modalSubject,
        value = subject.sample();
      return (
        subject.stage() === stage &&
        value.content.phase !== 'closed' &&
        value.content.opacity >= 0.55 &&
        value.content.opacity <= 0.85
      );
    },
    stage,
    { polling: 'raf', timeout: 1000 }
  );
  // Screenshot readbacks bound the actual capture interval. Never label a PNG
  // as a particular animation instant solely because that stage was requested.
  return capture(page, name);
}

async function captureVisualJourney(
  page: Page,
  family: Family,
  kind: 'enter-close' | 'leaving' | 'barrier',
  evidence: Record<string, any>,
  images: ImageEvidence[]
) {
  // Rasterization/readback can stall the main thread. These separate journeys
  // preserve real visual samples without perturbing any timed assertion above.
  if (kind === 'enter-close') {
    await page.evaluate(() => (window as any).modalSubject.begin(true, 'visual-enter'));
    images.push(await captureInterior(page, `${family}-enter-sample`, 'visual-enter'));
    const entering = (await page.evaluate(() => (window as any).modalSubject.finish())) as Trace;
    await page.evaluate(() => (window as any).modalSubject.begin(false, 'visual-leave'));
    images.push(await captureInterior(page, `${family}-leave-sample`, 'visual-leave'));
    const leaving = (await page.evaluate(() => (window as any).modalSubject.finish())) as Trace;
    evidence.visualJourney = { role: 'separate screenshot capture', entering, leaving };
    expect(entering.reason).toBe('condition');
    expect(leaving.reason).toBe('condition');
  } else {
    await page.evaluate(
      (kind) => (window as any).modalSubject.reverse(kind, 'visual-' + kind),
      kind
    );
    images.push(
      kind === 'barrier'
        ? await captureInterior(
            page,
            `${family}-${kind}-reopen-sample`,
            'visual-' + kind + '-reopen'
          )
        : await capture(page, `${family}-${kind}-reopen-sample`)
    );
    const reversal = (await page.evaluate(() => (window as any).modalSubject.finish())) as Reversal;
    evidence.visualJourney = { role: 'separate screenshot capture', ...reversal };
    expect(reversal.closing.reason).toBe('condition');
    expect(reversal.returning.reason).toBe('condition');
  }
}

async function evidenceCase(
  family: Family,
  name: string,
  run: (page: Page, evidence: Record<string, any>, images: ImageEvidence[]) => Promise<void>
) {
  const errors: string[] = [],
    images: ImageEvidence[] = [];
  const evidence: Record<string, any> = { ...sourceEvidence, family, name, images };
  let page: Page | undefined, failure: unknown;
  try {
    page = await createPage(family, errors, (created) => {
      page = created;
    });
    evidence.initial = await page.evaluate(() => (window as any).modalSubject.sample());
    await run(page, evidence, images);
    expect(errors).toEqual([]);
  } catch (error) {
    failure = error;
    evidence.failure = error instanceof Error ? error.stack : String(error);
  } finally {
    if (page) {
      evidence.history = await page
        .evaluate(() => (window as any).modalSubject?.history() ?? null)
        .catch((error) => ({ captureError: String(error) }));
      try {
        images.push(await capture(page, `${family}-${name}-terminal`));
      } catch (error) {
        evidence.screenshotError = String(error);
        failure ??= error;
      }
      evidence.disposal = await page
        .evaluate(() => (window as any).modalSubject?.dispose() ?? null)
        .catch((error) => ({ disposeError: String(error) }));
      await page.close();
    }
    evidence.errors = errors;
    evidence.status = failure ? 'failed' : 'passed';
    await writeFile(path.join(output, `${family}-${name}.json`), JSON.stringify(evidence, null, 2));
  }
  if (failure) throw failure;
}

function assertCompletion(trace: Trace, index: number, origin: number, duration: number) {
  expect(index).toBeGreaterThan(0);
  const before = trace.samples[index - 1],
    after = trace.samples[index];
  expect(after.time - origin).toBeGreaterThanOrEqual(duration - 8);
  expect(before.time - origin).toBeLessThanOrEqual(duration + 8);
  expect(after.time - origin).toBeLessThanOrEqual(duration + (after.time - before.time) + 12);
}

function assertTiming(
  trace: Trace,
  part: Part,
  from: number,
  to: number,
  duration: number,
  options: { cold?: boolean; opacityEndpoint?: boolean } = {}
) {
  expect(trace.reason).toBe('condition');
  const activePhase = to > from ? 'entering' : 'leaving';
  const finalPhase = to > from ? 'entered' : 'closed';
  const interior = trace.samples.filter((sample) => {
    const progress = (sample[part].opacity - from) / (to - from);
    return sample[part].phase === activePhase && progress > 0.05 && progress < 0.95;
  });
  expect(
    interior.length,
    `${trace.stage} ${part}: require actual intermediate frames`
  ).toBeGreaterThan(2);
  // For linear opacity, observed time minus progress*duration is one start
  // instant. A different duration/easing cannot be hidden by a late final poll.
  const starts = interior.map(
    (sample) => sample.time - ((sample[part].opacity - from) / (to - from)) * duration
  );
  const origin = [...starts].sort((a, b) => a - b)[Math.floor(starts.length / 2)];
  expect(
    Math.max(...starts) - Math.min(...starts),
    `${trace.stage} ${part}: linear time residual`
  ).toBeLessThan(12);
  // Cold views acknowledge their initial sample on the first real frame;
  // retained views start at the accepted request. Bind the inferred origin so
  // an extra idle delay cannot pass just by preserving the later slope.
  expect(origin).toBeGreaterThanOrEqual(trace.started - 8);
  if (options.cold) {
    const firstFrame = trace.samples.find((sample) => sample.frameTimestamp !== null)!;
    expect(
      Math.abs(origin - firstFrame.time),
      `${trace.stage} ${part}: cold start acknowledgement`
    ).toBeLessThan(12);
  } else {
    // The request precedes the synchronous pipeline; its post-flush sample
    // bounds that interval but is not the timestamp of the earlier host write.
    expect(origin, `${trace.stage} ${part}: warm start interval`).toBeLessThanOrEqual(
      trace.samples[0].time + 8
    );
  }
  const firstSettled = trace.samples.findIndex((sample) =>
    options.opacityEndpoint
      ? Math.abs(sample[part].opacity - to) < 0.000001
      : sample[part].phase === finalPhase
  );
  assertCompletion(trace, firstSettled, origin, duration);
  return origin;
}

function assertRetained(trace: Trace, expected: Sample) {
  for (const sample of trace.samples) {
    expect(sample.open).toBe(true);
    expect(sample.content.owner).toBe(expected.content.owner);
    expect(sample.content.viewEpoch).toBe(expected.content.viewEpoch);
    expect(sample.content.created).toBe(expected.content.created);
    expect(sample.content.mounted).toBe(expected.content.mounted);
    expect(sample.content.unmounted).toBe(expected.content.unmounted);
    expect(sample.content.portaled).toBe(true);
    expect(sample.content.detached).toBe(false);
    expect(sample.content.inert).toBe(false);
  }
}

describe.each(['dialog', 'alert-dialog'] as const)(
  'Bootstrap real browser %s presence',
  (family) => {
    it('uses 300ms ease-out top and linear opacity, then conceals both Portal barriers', async () => {
      await evidenceCase(family, 'enter-close', async (page, evidence, images) => {
        await page.evaluate(() => (window as any).modalSubject.begin(true, 'enter'));
        const entering = (await page.evaluate(() =>
          (window as any).modalSubject.finish()
        )) as Trace;
        evidence.entering = entering;
        assertTiming(entering, 'content', 0, 1, 300, { cold: true });
        assertTiming(entering, 'mask', 0, 0.8, 150, { cold: true });
        expect(entering.samples[0].content.phase).toBe('entering');
        expect(entering.samples[0].content.top).toBeCloseTo(-175, 1);
        expect(entering.samples[0].content.opacity).toBe(0);
        for (const value of entering.samples.filter(
          (value) => value.content.phase === 'entering'
        )) {
          expect(Math.abs(value.content.top - value.referenceTop)).toBeLessThan(1);
          expect(value.content.portaled).toBe(true);
          expect(value.mask.portaled).toBe(true);
        }
        expect(
          entering.samples.some(
            (value) => value.mask.phase === 'entered' && value.content.phase === 'entering'
          )
        ).toBe(true);
        const entered = entering.samples.at(-1)!;
        expect(entered.content.top).toBeCloseTo(70, 1);
        expect(entered.content.rect.y).toBeCloseTo(70, 1);
        expect(entered.content.opacity).toBe(1);
        expect(entered.mask.opacity).toBeCloseTo(0.8, 6);
        expect(entered.content.inline.top.value).toBe('');
        expect(entered.content.inline.opacity.value).toBe('');
        expect(entered.mask.inline.opacity.value).toBe('');
        images.push(await capture(page, `${family}-entered`));

        await page.evaluate(() => (window as any).modalSubject.begin(false, 'leave'));
        const leaving = (await page.evaluate(() => (window as any).modalSubject.finish())) as Trace;
        evidence.leaving = leaving;
        assertTiming(leaving, 'content', 1, 0, 300);
        assertTiming(leaving, 'mask', 0.8, 0, 150);
        for (const value of leaving.samples.filter((value) => value.content.phase === 'leaving'))
          expect(Math.abs(value.content.top - value.referenceLeaveTop)).toBeLessThan(1);
        for (const part of ['content', 'mask'] as const) {
          const barrier = leaving.samples.filter((value) =>
            isRetainedClosedPortal(value[part], entered[part])
          );
          expect(barrier.length, `${part}: observe the retained Portal barrier`).toBeGreaterThan(0);
          for (const value of barrier) {
            expect(value[part].portaled).toBe(true);
            expect(value[part].present).toBe(false);
            expect(value[part].concealed).toBe(true);
            expect(value[part].inert).toBe(true);
          }
          for (const value of leaving.samples.filter((value) => value[part].phase === 'closed')) {
            expect(value[part].detached).toBe(true);
            expect(value[part].concealed, `${part}: closed must not recover visible paint`).toBe(
              true
            );
          }
          const retired = leaving.samples.at(-1)![part];
          expect(isPhysicallyRetiredPortal(retired, entered[part])).toBe(true);
          expect(retired.portaled).toBe(false);
          expect(retired.mounted).toBe(entered[part].mounted);
          expect(retired.unmounted).toBe(entered[part].unmounted + 1);
        }
        await captureVisualJourney(page, family, 'enter-close', evidence, images);
      });
    }, 20000);

    it.each(['leaving', 'barrier'] as const)(
      'reopens during %s without replacing the retained Content owner',
      async (kind) => {
        await evidenceCase(family, `${kind}-reopen`, async (page, evidence, images) => {
          await page.evaluate(() => (window as any).modalSubject.begin(true, 'initial-enter'));
          const initial = (await page.evaluate(() =>
            (window as any).modalSubject.finish()
          )) as Trace;
          evidence.initialEnter = initial;
          expect(initial.reason).toBe('condition');
          await page.evaluate((kind) => (window as any).modalSubject.reverse(kind), kind);
          const reversal = (await page.evaluate(() =>
            (window as any).modalSubject.finish()
          )) as Reversal;
          evidence.reversal = reversal;
          expect(reversal.closing.reason).toBe('condition');
          expect(reversal.before.content.portaled).toBe(true);
          expect(reversal.before.content.connected).toBe(true);
          expect(reversal.before.content.owner).toBe(reversal.entered.content.owner);
          expect(reversal.before.content.viewEpoch).toBe(reversal.entered.content.viewEpoch);
          expect(reversal.before.content.created).toBe(reversal.entered.content.created);
          expect(reversal.before.content.mounted).toBe(reversal.entered.content.mounted);
          expect(reversal.before.content.unmounted).toBe(reversal.entered.content.unmounted);
          expect(reversal.after.content.phase).toBe('entering');
          expect(reversal.after.content.opacity).toBeCloseTo(
            kind === 'barrier' ? 0 : reversal.before.content.opacity,
            5
          );
          expect(reversal.after.content.top).toBeCloseTo(
            kind === 'barrier' ? -175 : reversal.before.content.top,
            1
          );
          if (kind === 'barrier') {
            expect(isRetainedClosedPortal(reversal.before.content, reversal.entered.content)).toBe(
              true
            );
            expect(reversal.before.content.detached).toBe(true);
            expect(reversal.before.content.phase).toBe('closed');
            expect(reversal.before.content.present).toBe(false);
            expect(reversal.before.content.concealed).toBe(true);
            expect(reversal.before.content.inert).toBe(true);
          } else {
            expect(reversal.before.content.detached).toBe(false);
            expect(reversal.before.content.phase).toBe('leaving');
            expect(reversal.before.content.opacity).toBeGreaterThan(0);
            expect(reversal.before.content.opacity).toBeLessThan(1);
            expect(reversal.after.mask.opacity).toBeCloseTo(reversal.before.mask.opacity, 5);
          }
          if (kind === 'barrier') {
            assertTiming(reversal.returning, 'content', 0, 1, 300);
            // Mask has already completed its own 150ms close and detached;
            // reopening it creates a cold view without replacing its instance.
            assertTiming(reversal.returning, 'mask', 0, 0.8, 150, { cold: true });
          } else {
            // C-FEEDBACK-PRESENCE-PRESENTATION-0001: each warm channel reverses
            // with CSS shortening from its acknowledged eased progress.
            const opacityDuration = 300 * (1 - reversal.before.content.opacity);
            const topDuration = (300 * (70 - reversal.before.content.top)) / 245;
            const maskDuration = 150 * (1 - reversal.before.mask.opacity / 0.8);
            const origin = assertTiming(
              reversal.returning,
              'content',
              reversal.before.content.opacity,
              1,
              opacityDuration,
              { opacityEndpoint: true }
            );
            assertTiming(
              reversal.returning,
              'mask',
              reversal.before.mask.opacity,
              0.8,
              maskDuration
            );
            assertCompletion(
              reversal.returning,
              reversal.returning.samples.findIndex((value) => value.content.phase === 'entered'),
              origin,
              Math.max(opacityDuration, topDuration)
            );
            expect(
              reversal.returning.samples.some(
                (value) =>
                  value.content.opacity === 1 &&
                  value.content.top < 69.99 &&
                  value.content.phase === 'entering'
              )
            ).toBe(true);
            evidence.shortenedDurations = { opacityDuration, topDuration, maskDuration };
          }
          assertRetained(reversal.returning, reversal.entered);
          expect(reversal.after.content.inline.opacity.priority).toBe('');
          expect(reversal.after.content.inline.visibility.value).toBe('');
          const final = reversal.returning.samples.at(-1)!;
          expect(final.content.phase).toBe('entered');
          expect(final.content.opacity).toBe(1);
          expect(final.content.top).toBeCloseTo(70, 1);
          expect(final.mask.phase).toBe('entered');
          expect(final.mask.opacity).toBeCloseTo(0.8, 6);
          expect(final.content.owner).toBe(reversal.entered.content.owner);
          expect(final.mask.owner).toBe(reversal.entered.mask.owner);
          expect(final.content.created).toBe(reversal.entered.content.created);
          expect(final.mask.created).toBe(reversal.entered.mask.created);
          await captureVisualJourney(page, family, kind, evidence, images);
        });
      },
      20000
    );
  }
);
