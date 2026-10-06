import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  classifyKnownUnsupportedContrastFrame,
  KnownUnsupportedContrastDomain,
  isKnownUnsupportedContrastCase,
  isUnresolvedContrastCase,
} from './contrast-known-unsupported.mjs';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { transform } from 'esbuild';
import { readContrastProvenance } from './contrast-provenance.mjs';
import { createContrastReportJournal } from './contrast-report-journal.mjs';
import {
  establishContrastPopupEscapeBaseline,
  readContrastPopupEscapeBefore,
  readContrastPopupEscapeAfter,
} from './contrast-popup-escape.mjs';
import {
  parseContrastRuntimeOptions,
  contrastHeldBinaryTargets,
  assertContrastCaseCoverage,
  classifyFlatTabPaint,
  establishNativeItemPointerBaseline,
} from './contrast-audit-plan.mjs';
import { compileContrastAnatomy, compareContrastAnatomy } from './contrast-anatomy.mjs';
import { BRUTALIST_THEME } from '../../../packages/prototypes/brutalist/src/theme';
import { surfacePrototypeId } from '../src/components/surface-recipes';
import type {
  Browser,
  BrowserContext,
  Page,
  Locator,
  ElementHandle,
  JSHandle,
} from 'playwright-core';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionRecipe,
  type ProjectionFamilyManifest,
} from '../src/components/PrototypePreviewer/projection-families';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
  type DemoSpec,
} from '../src/components/PrototypePreviewer/demo-types';
import {
  RUNTIMES,
  launchBrowser,
  choosePreviewRuntime,
  applyColorScheme,
} from '../src/content/docs/zh-cn/browser-harness';

// Observation only: neither collected frames nor achieved target predicates are
// WCAG certification, cue-necessity decisions, migration approval or Issue closure.
const baseUrl = process.env.PROTO_UI_BROWSER_BASE_URL;
if (!baseUrl)
  throw new Error('Set PROTO_UI_BROWSER_BASE_URL to an independently supervised docs server.');
const runID = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
const output = resolve(
  process.env.PROTO_UI_CONTRAST_EVIDENCE_DIR ?? `/tmp/pui469-rendered-${runID}`
);
const runtimes = RUNTIMES;
const themes = ['light', 'dark'] as const;
const families = Object.keys(PROJECTION_FAMILY_MANIFESTS.brutalist.families);
const requestedFamilies = process.env.PROTO_UI_CONTRAST_FAMILIES?.split(',');
if (
  requestedFamilies &&
  (!requestedFamilies.length ||
    new Set(requestedFamilies).size !== requestedFamilies.length ||
    requestedFamilies.some((family) => !families.includes(family)))
) {
  throw new Error(
    'Choose distinct existing projection manifest family identities; an empty selection is not evidence.'
  );
}
const selectedFamilies = requestedFamilies ?? families;
const viewport = { width: 1440, height: 1000 };
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
const digest = (data: string | Buffer) =>
  `sha256:${createHash('sha256').update(data).digest('hex')}`;
const message = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
type Observation = { achieved: boolean; [key: string]: unknown };
type Case = {
  family: string;
  runtime: string;
  theme: string;
  route: string;
  status: 'pending' | 'running' | 'observed' | 'failed' | 'known-unsupported';
  knownUnsupported?: Record<string, unknown>;
  plannedStates: string[];
  achievedTargets: string[];
  errors: { phase: string; error: string }[];
  passiveSurfaceCoverage?: Observation;
  motionContext?: {
    requestedReducedMotion: 'reduce';
    observedReducedMotion?: boolean;
    scope: string;
    uncovered: string[];
  };
  hoverCardClosedBaseline?: Observation;
  binaryKeyboardActivation?: Observation;
  pointerItemBaselines?: Record<string, unknown>[];
  projectionReadinessFailure?: Observation;
  escapeTransition?: Record<string, unknown>;
};
type AuditSubject = {
  previewer: ElementHandle<HTMLElement>;
  previewerId: string;
  expected: import('./contrast-probe.browser').ContrastProjectionExpectation;
};
const caseSubjects = new WeakMap<Page, AuditSubject>();
async function bindCaseSubject(page: Page, previewer: Locator, item: Case): Promise<void> {
  if (caseSubjects.has(page)) throw new Error('An audit page already has a selected subject.');
  const handle = await previewer.elementHandle();
  if (!handle) throw new Error('Selected audit Previewer is missing.');
  const previewerId = await handle.getAttribute('data-previewer-id');
  if (!previewerId) {
    await handle.dispose();
    throw new Error('Selected audit Previewer has no identity.');
  }
  caseSubjects.set(page, {
    previewer: handle as ElementHandle<HTMLElement>,
    previewerId,
    expected: projectionExpectation(item),
  });
}
function caseSubject(page: Page): AuditSubject {
  const subject = caseSubjects.get(page);
  if (!subject) throw new Error('The case-selected audit subject has not been bound.');
  return subject;
}
function casePreviewer(page: Page): Locator {
  return page.locator(`[data-previewer-id=${JSON.stringify(caseSubject(page).previewerId)}]`);
}
async function releaseCaseSubject(page: Page): Promise<void> {
  const subject = caseSubjects.get(page);
  caseSubjects.delete(page);
  await subject?.previewer.dispose();
}
const passiveFamilies = new Set(['badge', 'card', 'skeleton', 'separator', 'spinner']);
function plannedStates(family: string): string[] {
  const states = ['rest'];
  if (passiveFamilies.has(family)) return states;
  states.push('hover', 'keyboard-focus');
  if (
    [
      'button',
      'toggle',
      'switch',
      'tabs',
      'checkbox',
      'dropdown-menu',
      'select',
      'dialog',
    ].includes(family)
  )
    states.push('pointer-down', 'activation-result');
  if (family === 'button') {
    for (const variant of ['surface', 'destructive']) {
      states.push(
        `${variant}-rest`,
        `${variant}-hover`,
        `${variant}-pointer-down`,
        `${variant}-activation-result`,
        `${variant}-keyboard-focus`
      );
    }
  }
  if (['toggle', 'switch', 'checkbox'].includes(family)) states.push('keyboard-activation');
  if (family === 'tabs') states.push('keyboard-selection-overview', 'selected-and-pointer-held');
  if (family === 'toggle') states.push('already-active', 'active-and-pointer-held');
  for (const target of contrastHeldBinaryTargets(family))
    states.push(`${target.state}-and-pointer-held`);
  if (family === 'tooltip') states.push('hover-open', 'focus-open');
  if (family === 'hover-card') states.push('hover-open', 'focus-open');
  if (['dropdown-menu', 'select', 'dialog'].includes(family)) states.push('open');
  if (['dropdown-menu', 'select'].includes(family))
    states.push('item-focus-first', 'item-focus-last');
  if (family === 'dropdown-menu')
    for (const variant of ['default', 'destructive'])
      states.push(`item-${variant}-hover`, `item-${variant}-pointer-held`);
  if (family === 'select')
    for (const selection of ['selected', 'unselected'])
      states.push(`item-${selection}-hover`, `item-${selection}-pointer-held`);
  if (family === 'dialog') states.push('close-icon-hover', 'close-icon-keyboard-focus');
  if (family === 'textarea')
    states.push('empty-placeholder', 'disabled-and-readonly', 'live-props-restored');
  if (family === 'scroll-area') states.push('scroll-end', 'wheel-both-axes');
  return states;
}
// Populate this matrix only after reading each exact page's declared runtimes.
// A discovery failure remains a failed case; it never silently removes a family.
const cases: Case[] = [];
const runtimeAvailability: Record<string, unknown> = {};
function createCase(family: string, runtime: string, theme: string): Case {
  return {
    family,
    runtime,
    theme,
    route: `/en/ui-libraries/brutalist/components/${family}/`,
    status: 'pending',
    plannedStates: plannedStates(family),
    achievedTargets: [],
    errors: [],
    ...(family === 'spinner'
      ? {
          motionContext: {
            requestedReducedMotion: 'reduce' as const,
            scope: 'Styled-only Spinner static reduced-motion rest observation only.',
            uncovered: ['Normal-motion 1000ms linear infinite rotation and timing sequence.'],
          },
        }
      : {}),
  };
}
// An existing directory, including an old failed attempt, is never reused.
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output);
const journal = await createContrastReportJournal(output);
const frames: Record<string, unknown>[] = journal.frames;
const failures: Record<string, unknown>[] = [];
const report: Record<string, unknown> = {
  schemaVersion: 3,
  runID,
  baseline,
  observedAt: new Date().toISOString(),
  output,
  sourceCodeVersion: {
    head: baseline,
    kind: 'baseline only; exact worktree source recording pending',
    status: 'pending',
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    argv: process.argv,
    execArgv: process.execArgv,
    baseUrl,
    viewport,
    variables: Object.fromEntries(
      [
        'PROTO_UI_BROWSER_BASE_URL',
        'PROTO_UI_CONTRAST_EVIDENCE_DIR',
        'PROTO_UI_CONTRAST_FAMILIES',
        'CHROME_PATH',
        'LOCALAPPDATA',
        'DISPLAY',
      ].map((key) => [key, process.env[key] ?? null])
    ),
  },
  selectedFamilies,
  runtimeAvailability,
  runtimes,
  themes,
  cases,
  frames,
  failedCases: failures,
  evidenceDebt: [
    'Recipe-derived anatomy checks cover current authored identities, multiplicities, parent ownership and native conditional presence. They are not general anatomy protocol conformance or proof of every visual cue; full native family evidence remains separate.',
    'All cue necessity and required/redundant/decorative classifications remain independent-review debt; no frame is automatically a WCAG verdict.',
    'Only the declared ScrollArea rest fixed-px owned rounded-overflow profile may end known-unsupported after complete PNG/fact identity pairing. It earns no achieved target or numeric approval; unexecuted targets and runtime/theme cases are counted explicitly. Follow-up: https://github.com/Proto-UI/Proto-UI/issues/853. Other unsupported domains and hidden or changed identity remain failures.',
    'Passive-family acceptance covers only the current recipe identity multiplicities, anatomy, ownership and visible physical regions at rest. Auxiliary controls are observed at rest only; their interactions, prop transitions and semantic criteria remain uncovered.',
    'Portable Transition entered state is not directly exposed on every runtime DOM; modal entry observations use owned visibility and completed authored CSS animations, not an invented transition attribute.',
    'Spinner snapshots request and observe the real reduced-motion preference only for Spinner cases. Normal-motion rotation/timing and parent composition interactions remain uncovered; no Spinner hover or keyboard-focus claim.',
    'Tooltip hover/focus observations target the first authored Root only. The second Root is structural anatomy coverage, not a sibling warm-window timing or Group handoff journey; dedicated Tooltip semantic/browser evidence remains separate.',
    'Dialog mask hit ownership is a paint-layer observation, not outside-press dismissal coverage under draft P-BASE-DIALOG-CONTENT-DISMISS. A dedicated native outside-press/focus-restoration journey remains follow-up.',
    'Button captures pointer release and keyboard focus only; native Space/Enter command activation under draft P-BASE-BUTTON-KEYBOARD-ACTIVATION remains dedicated semantic/browser follow-up, not an achieved target here.',
    'Hover Card Trigger hover/focus and existing Escape retention do not exercise Trigger-to-Content pointer bridging under draft P-BASE-HOVER-CARD-CONTENT-HOVER-BRIDGE; that native journey remains follow-up.',
    'Hover Card focus-open observes the current one-Root zero-delay demo against draft P-BASE-HOVER-CARD-INTERACTION-INTENT after an independently closed non-hover baseline; not protocol conformance.',
  ],
  authority: [
    'https://github.com/Proto-UI/Proto-UI/issues/469',
    'https://github.com/Proto-UI/Proto-UI/issues/427#issuecomment-5376913069',
    'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',
  ],
  scope:
    'Selected current documented Brutalist consumers only; no historical attempt is merged or cleared by this run.',
  methodology: [
    "runtimes is the supported adapter universe; runtimeAvailability records each exact source-bound page declaration. Only that page's available runtimes become cases, and discovery failures remain unresolved. The case matrix is frozen before the first journal checkpoint and any frame capture.",
    'Schema 3 stores each started/result frame once in a create-only journal and references immutable PNG/facts files. report.json is an atomic current manifest while running; final reports materialize compact frame references once. Replay readContrastReportJournal(output) after interruption; incomplete attempts remain unresolved.',
    'Native reader controls choose runtime/theme. Native pointer and keyboard input change subject state; helpers never write subject CSS, attributes or state.',
    'General keyboard focus uses a programmatic seed followed by native Tab/Shift+Tab; not a whole-page Tab-order claim. Modal CloseIcon uses native Tab inside the modal.',
    'Target predicates and collected states are distinct from coverage of all authored cues and from independent WCAG classification.',
    'Passive expectations come from the exact manifest recipe and existing demo-schema accessors, never a runner-owned count table. Structural projection wrappers and reader controls are not component physical roots.',
    'One shared state fingerprint binds the pre-PNG state to measured facts and post-measurement state. Mismatch is a preserved failed attempt, never a retry.',
    'Scroll claims require observed offset movement after native input and stable offsets/geometry across consecutive animation frames; no timed sleep substitutes for movement.',
    'Every cue remains unclassified unless independently reviewed. Inactive compositing observations are not normal-text conformance assertions.',
  ],
  disposition: 'running; no acceptance determination',
};
async function persist(reason: string, changedCase?: Case): Promise<void> {
  report.summary = {
    collectedFrames: frames.length,
    pngFactMatchedFrames: journal.matchedFrames,
    achievedTargetPredicates: cases.reduce((sum, item) => sum + item.achievedTargets.length, 0),
    expectedRuntimeThemeCases: cases.length,
    observedRuntimeThemeCases: cases.filter((item) => item.status === 'observed').length,
    knownUnsupportedRuntimeThemeCases: cases.filter(isKnownUnsupportedContrastCase).length,
    knownUnsupportedPairedRawFrames: frames.filter((frame) => frame.status === 'known-unsupported')
      .length,
    knownUnsupportedUnexecutedTargets: cases
      .filter(isKnownUnsupportedContrastCase)
      .reduce(
        (sum, item) =>
          sum + item.plannedStates.filter((state) => !item.achievedTargets.includes(state)).length,
        0
      ),
    unresolvedRuntimeThemeCases: cases.filter(isUnresolvedContrastCase).length,
    distinctUnresolvedFamilies: new Set(
      cases.filter(isUnresolvedContrastCase).map((item) => item.family)
    ).size,
    caseCoverage: cases.map((item) => ({
      family: item.family,
      runtime: item.runtime,
      theme: item.theme,
      status: item.status,
      ...(item.knownUnsupported ? { knownUnsupported: item.knownUnsupported } : {}),
      missingTargets: item.plannedStates.filter((state) => !item.achievedTargets.includes(state)),
    })),
    conformance: 'not evaluated; frame count and target predicate count are not full conformance',
  };
  await journal.persist(reason, report, changedCase);
}
// The journal registers an immutable case identity matrix at its first checkpoint.
// Runtime discovery must finish before that checkpoint; no frame starts before it.
let browser: Browser | undefined;
let browserProbe = '';
let phase = 'source-provenance';
let cleanSource: ReturnType<typeof readContrastProvenance>;
let servedSource:
  | ({ schemaVersion: number; serverId: string } & ReturnType<typeof readContrastProvenance>)
  | undefined;

async function verifyServedSource(): Promise<void> {
  const local = readContrastProvenance(repositoryRoot);
  if (!isDeepStrictEqual(local, cleanSource))
    throw new Error('Local rendered source changed during the audit.');
  const response = await fetch(new URL('/__pui_contrast_provenance', baseUrl), {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(
      `Served contrast provenance unavailable (HTTP ${response.status}); start a clean opt-in audit server.`
    );
  const current = (await response.json()) as NonNullable<typeof servedSource>;
  if (
    current.schemaVersion !== 1 ||
    typeof current.serverId !== 'string' ||
    !current.serverId ||
    !isDeepStrictEqual(
      { head: current.head, tree: current.tree, generated: current.generated },
      cleanSource
    )
  ) {
    throw new Error(
      'Served build does not match the complete clean local source and generated CSS.'
    );
  }
  if (servedSource && !isDeepStrictEqual(current, servedSource))
    throw new Error('Audit server identity changed during the run.');
  servedSource = current;
}

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    (subject) => {
      const boundary = (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe.readContrastAuditSubject(subject);
      if (!boundary.observation.achieved) return false;
      const scope = boundary.scope;
      const owner = scope?.dataset.projectionOwner ?? scope?.dataset.projectionScope;
      const generation = scope?.dataset.projectionGeneration;
      if (!owner || !generation || scope?.dataset.projectionState !== 'ready') return false;
      const roots = [...document.querySelectorAll<HTMLElement>('[data-pui-root]')].filter(
        (element) =>
          element.dataset.projectionOwner === owner &&
          element.dataset.projectionGeneration === generation
      );
      return (
        roots.length > 0 &&
        roots.every((element) => {
          const transition = element.getAttribute('data-transition-state');
          return (
            transition !== 'entering' &&
            transition !== 'leaving' &&
            element
              .getAnimations({ subtree: true })
              .every(
                (animation) => animation.playState === 'finished' || animation.playState === 'idle'
              )
          );
        })
      );
    },
    caseSubject(page),
    { timeout: 20_000 }
  );
}
async function fingerprint(page: Page): Promise<string> {
  return page.evaluate(
    (subject) =>
      (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe.readSubjectContrastState(subject),
    caseSubject(page)
  );
}
async function stableFingerprint(page: Page): Promise<string> {
  // Screenshot waits for fonts too; read the same painted text geometry before
  // the PNG instead of measuring fallback fonts that it will replace.
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  let previous = await fingerprint(page);
  let stableFrames = 0;
  for (let attempt = 0; attempt < 12 && stableFrames < 2; attempt++) {
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );
    const next = await fingerprint(page);
    stableFrames = next === previous ? stableFrames + 1 : 0;
    previous = next;
  }
  if (stableFrames < 2) throw new Error('Measured state did not stabilize before capture.');
  return previous;
}
function projectionExpectation(
  item: Pick<Case, 'family' | 'runtime'>
): import('./contrast-probe.browser').ContrastProjectionExpectation {
  const manifest = (PROJECTION_FAMILY_MANIFESTS.brutalist as ProjectionFamilyManifest).families[
    item.family
  ];
  if (!manifest?.parts.root) throw new Error('Requested family has no authored projection root.');
  return {
    recipeId: manifest.recipeId,
    // Pinned against the real runtimePreviewRecipe producer for every family.
    contentRecipeId: `website-runtime-preview:${manifest.recipeId}`,
    shellPrototypeId: surfacePrototypeId('brutalist'),
    serializedRuntimes: (runtimeAvailability[item.family] as { serialized: string }).serialized,
    family: item.family,
    runtime: item.runtime,
    rootPrototypeId: manifest.parts.root.prototypeId,
    prototypeIds: manifest.recipePrototypeIds,
  };
}
async function projectionObservation(page: Page, item: Case): Promise<Observation> {
  const subject = caseSubject(page);
  if (subject.expected.family !== item.family || subject.expected.runtime !== item.runtime)
    throw new Error('Observation does not match the frozen case subject.');
  return page.evaluate(
    (subject) =>
      (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe.readContrastAuditSubject(subject).observation,
    subject
  );
}
async function assertProjectionReadiness(page: Page, item: Case): Promise<void> {
  const observation = await projectionObservation(page, item);
  if (!observation.achieved) {
    // Preserve the failed coordinates before the case catch journals the error.
    // This is unresolved identity evidence, never a frame or contrast result.
    item.projectionReadinessFailure = observation;
    throw new Error('Ready previewer is not the requested Brutalist recipe/component/runtime.');
  }
}
const anatomyPlans = new Map<string, ReturnType<typeof compileContrastAnatomy>>();
async function anatomyObservation(page: Page, item: Case, state: string): Promise<Observation> {
  let plan = anatomyPlans.get(item.family);
  if (!plan) {
    const manifest = (PROJECTION_FAMILY_MANIFESTS.brutalist as ProjectionFamilyManifest).families[
      item.family
    ];
    const resolution = resolveProjectionRecipe(manifest.recipeId);
    if (resolution.projectionFamilyId !== 'brutalist' || resolution.familyId !== item.family)
      throw new Error('Anatomy recipe does not match the requested Brutalist family.');
    const demo = (
      await import(
        new URL(`../src/content/docs/zh-cn/${manifest.recipeId}.demo.ts`, import.meta.url).href
      )
    ).default as DemoSpec;
    assertDemoSpec(demo);
    plan = compileContrastAnatomy(demo, manifest);
    anatomyPlans.set(item.family, plan);
  }
  const target = primary(casePreviewer(page), item.family);
  if (!target) throw new Error('Interactive anatomy has no current primary target.');
  const observed = await target.evaluate(
    (element, subject) =>
      (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe.readSubjectContrastAnatomy(element, subject),
    caseSubject(page)
  );
  const requirePrimaryOpen =
    ['tooltip', 'hover-card'].includes(item.family) &&
    ['hover', 'hover-open', 'keyboard-focus', 'focus-open'].includes(state);
  return {
    ...compareContrastAnatomy(plan, observed, { requirePrimaryOpen }),
    owner: observed.owner,
    generation: observed.generation,
    observed,
    requestedFrame: state,
    requirePrimaryOpen,
  };
}
function measurementLeaseMatches(projection: unknown, observations: readonly unknown[]): boolean {
  const expected = projection as { owner?: unknown; generation?: unknown } | null;
  if (
    !expected ||
    typeof expected.owner !== 'string' ||
    !expected.owner ||
    typeof expected.generation !== 'string' ||
    !expected.generation
  )
    return false;
  return observations.every((value) => {
    if (value === null) return true; // Explicitly absent passive anatomy only.
    if (!value || typeof value !== 'object') return false;
    const observed = value as { owner?: unknown; generation?: unknown };
    return observed.owner === expected.owner && observed.generation === expected.generation;
  });
}
async function capture(
  page: Page,
  item: Case,
  state: string,
  observe: () => Promise<Observation>
): Promise<void> {
  phase = `capture:${state}`;
  const name = `${item.family}-${item.runtime}-${item.theme}-${state}`;
  const frame: Record<string, unknown> = {
    family: item.family,
    runtime: item.runtime,
    theme: item.theme,
    requestedState: state,
    status: 'attempting',
    image: null,
    facts: null,
  };
  await journal.beginFrame(name, frame);
  try {
    const before = await stableFingerprint(page);
    frame.beforeFingerprintDigest = digest(before);
    const projectionBefore = await projectionObservation(page, item);
    frame.projectionBefore = projectionBefore;
    const anatomyBefore = passiveFamilies.has(item.family)
      ? null
      : await anatomyObservation(page, item, state);
    frame.anatomyBefore = anatomyBefore;
    if (!projectionBefore.achieved)
      throw new Error('Requested Brutalist recipe/component/runtime or current lease is missing.');
    // Default caret hiding writes native editor styles; preserve the reader's
    // state rather than weakening the exact PNG/fact fingerprint guards.
    const png = await page.screenshot({ caret: 'initial' });
    await writeFile(join(output, `${name}.png`), png, { flag: 'wx' });
    frame.image = {
      path: `${name}.png`,
      absolutePath: join(output, `${name}.png`),
      digest: digest(png),
      origin: 'native Playwright page.screenshot PNG',
      route: page.url(),
      capturedAt: new Date().toISOString(),
    };
    const facts = await page.evaluate(
      (input) =>
        (
          globalThis as typeof globalThis & {
            puiContrastProbe: typeof import('./contrast-probe.browser');
          }
        ).puiContrastProbe.collectSubjectContrastFrame(input),
      { image: png.toString('base64'), family: item.family, subject: caseSubject(page) }
    );
    const { stateFingerprint, ...storedFacts } = facts;
    frame.facts = { ...storedFacts, stateFingerprintDigest: digest(stateFingerprint) };
    const factsJSON = JSON.stringify(frame.facts, null, 2) + '\n';
    await writeFile(join(output, `${name}.facts.json`), factsJSON, { flag: 'wx' });
    frame.factsFile = { path: `${name}.facts.json`, digest: digest(factsJSON) };
    frame.targetObservation = await observe();
    const physicalTarget = primary(casePreviewer(page), item.family);
    if (physicalTarget) {
      frame.primaryPaint = await targetObservation(physicalTarget);
    }
    const after = await fingerprint(page);
    frame.afterFingerprintDigest = digest(after);
    const projectionAfter = await projectionObservation(page, item);
    frame.projectionAfter = projectionAfter;
    const anatomyAfter = passiveFamilies.has(item.family)
      ? null
      : await anatomyObservation(page, item, state);
    frame.anatomyAfter = anatomyAfter;
    const sameProjectionLease =
      projectionBefore.owner === projectionAfter.owner &&
      projectionBefore.generation === projectionAfter.generation &&
      projectionBefore.shellGeneration === projectionAfter.shellGeneration;
    frame.sameProjectionLease = sameProjectionLease;
    const sameMeasurementLease = measurementLeaseMatches(projectionBefore, [
      facts,
      anatomyBefore,
      anatomyAfter,
      JSON.parse(before),
      JSON.parse(facts.stateFingerprint),
      JSON.parse(after),
    ]);
    frame.sameMeasurementLease = sameMeasurementLease;

    if (before !== facts.stateFingerprint || before !== after) {
      const mismatchJSON =
        JSON.stringify(
          {
            before: JSON.parse(before),
            facts: JSON.parse(facts.stateFingerprint),
            after: JSON.parse(after),
          },
          null,
          2
        ) + '\n';
      const mismatchPath = `${name}.mismatch.json`;
      await writeFile(join(output, mismatchPath), mismatchJSON, { flag: 'wx' });
      frame.mismatchFile = { path: mismatchPath, digest: digest(mismatchJSON) };
      throw new Error(
        'PNG/fact state mismatch: physical state or projection lease changed; raw attempt retained, no retry.'
      );
    }
    if (!projectionAfter.achieved || !sameProjectionLease || !sameMeasurementLease)
      throw new Error(
        'Requested Brutalist projection changed during capture; raw attempt retained.'
      );
    if (anatomyBefore && (!anatomyBefore.achieved || !anatomyAfter?.achieved))
      throw new Error(
        'Authored materialized anatomy or current conditional subtree is missing; raw frame retained.'
      );
    if (!(frame.targetObservation as Observation).achieved)
      throw new Error(`Requested target predicate not achieved: ${state}.`);
    if (physicalTarget && !(frame.primaryPaint as Observation).achieved) {
      const known = classifyKnownUnsupportedContrastFrame(item, frame);
      if (!known)
        throw new Error('Interactive family primary target is not supported painted content.');
      frame.status = 'known-unsupported';
      frame.knownUnsupported = known;
      throw new KnownUnsupportedContrastDomain(known);
    }
    frame.status = 'matched';
    item.achievedTargets.push(state);
    console.log(
      `Captured ${name}: PNG/facts matched; target predicate achieved, cues unclassified.`
    );
  } catch (error) {
    if (!(error instanceof KnownUnsupportedContrastDomain)) frame.status = 'failed';
    frame.error = message(error);
    throw error;
  } finally {
    await journal.finishFrame(name, frame);
    await persist('frame', item);
  }
}
function primary(previewer: Locator, family: string): Locator | null {
  if (family === 'tabs') return previewer.getByRole('tab', { name: 'Details', exact: true });
  const selector = (
    {
      button: '[data-demo-ref="solidMain"]',
      toggle: '[role="button"][aria-pressed]',
      switch: '[role="switch"]',
      checkbox: '[role="checkbox"]',
      'dropdown-menu': '[data-projection-prototype="brutalist-dropdown-trigger"][data-pui-root]',
      select: '[data-projection-prototype="brutalist-select-trigger"][data-pui-root]',
      dialog: '[data-projection-prototype="brutalist-dialog-trigger"][data-pui-root]',
      'hover-card': '[data-projection-prototype="brutalist-hover-card-trigger"][data-pui-root]',
      textarea: 'textarea',
      'scroll-area': '[data-demo-ref="scrollViewport"]',
      tooltip: '[data-projection-prototype="brutalist-tooltip-trigger"][data-pui-root]',
    } as Record<string, string>
  )[family];
  if (!selector) return null;
  const targets = previewer.locator(`[data-projection-content] ${selector}`);
  // Native editor identity is singular; keep Playwright strictness instead of
  // choosing one live editor when a wrapper projection accidentally duplicates it.
  return family === 'textarea' ? targets : targets.first();
}
async function passiveSurfaceObservation(
  page: Page,
  family: string,
  runtime: string
): Promise<Observation> {
  if (
    caseSubject(page).expected.family !== family ||
    caseSubject(page).expected.runtime !== runtime
  )
    throw new Error('Passive observation does not match the frozen case subject.');

  const manifest = (PROJECTION_FAMILY_MANIFESTS.brutalist as ProjectionFamilyManifest).families[
    family
  ];
  if (!passiveFamilies.has(family) || !manifest)
    return { achieved: false, unsupportedCoverage: [{ reason: 'Unsupported passive family.' }] };
  const resolution = resolveProjectionRecipe(manifest.recipeId);
  const recipePath = `apps/www/src/content/docs/zh-cn/${manifest.recipeId}.demo.ts`;
  // loadDemo is the browser's Vite registry (import.meta.glob). Import the same
  // exact authored recipe in Node without constructing a second recipe registry.
  const recipeURL = new URL(
    `../src/content/docs/zh-cn/${manifest.recipeId}.demo.ts`,
    import.meta.url
  );
  const demo = (await import(recipeURL.href)).default as DemoSpec;
  assertDemoSpec(demo);
  const recipeIdentities = new Set<string>();
  collectPrototypeIds(demo.root, recipeIdentities);
  const sourceUnsupported = [
    ...manifest.recipePrototypeIds
      .filter((prototypeId) => !recipeIdentities.has(prototypeId))
      .map((prototypeId) => ({ prototypeId, reason: 'Manifest identity missing from recipe.' })),
    ...[...recipeIdentities]
      .filter((prototypeId) => !manifest.recipePrototypeIds.includes(prototypeId))
      .map((prototypeId) => ({ prototypeId, reason: 'Recipe identity absent from manifest.' })),
  ];
  if (resolution.projectionFamilyId !== 'brutalist' || resolution.familyId !== family)
    sourceUnsupported.push({ prototypeId: '', reason: 'Recipe resolution does not match family.' });
  const instances: {
    prototypeId: string;
    path: string;
    ancestorPrototypeIds: string[];
    ref: string | null;
    props: Record<string, unknown>;
  }[] = [];
  function collect(node: DemoChild, path: string, ancestors: string[]): void {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto') {
      instances.push({
        prototypeId: node.prototypeId,
        path,
        ancestorPrototypeIds: ancestors,
        ref: node.ref ?? null,
        props: node.props ?? {},
      });
      ancestors = [...ancestors, node.prototypeId];
    }
    for (const [index, child] of (node.children ?? []).entries())
      collect(child, `${path}.children.${index}`, ancestors);
  }
  collect(demo.root, 'root', []);
  const expected = manifest.recipePrototypeIds.map((prototypeId) => ({
    prototypeId,
    expectedCount: instances.filter((instance) => instance.prototypeId === prototypeId).length,
    partIds: Object.entries(manifest.parts)
      .filter(([, part]) => part.prototypeId === prototypeId)
      .map(([partId]) => partId),
    auxiliary: (manifest.auxiliaryPrototypes ?? []).some(
      (prototype) => prototype.prototypeId === prototypeId
    ),
    // These bounded author templates own physical regions, including Card
    // Content's padded text region. No positive box is required of scope/box
    // wrappers, and aria-hidden Skeleton/Separator regions still need paint.
    visibilityRequirement:
      family === 'spinner' && prototypeId !== manifest.parts.root?.prototypeId
        ? 'owned-parent-composition-only'
        : 'visible-physical-region',
  }));
  return page.evaluate(
    (input) => {
      const probe = (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe;
      const boundary = probe.readContrastAuditSubject(input.subject);
      const { content, retained, shell, owner, generation } = boundary;
      const ready = boundary.observation.achieved;
      const surfaces = [...document.querySelectorAll<HTMLElement>('[data-pui-root]')]
        .filter(
          (element) =>
            !(ready && element === shell) &&
            (content?.contains(element) ||
              (owner &&
                generation &&
                element.dataset.projectionOwner === owner &&
                element.dataset.projectionGeneration === generation &&
                !element.closest('[data-projection-control]')))
        )
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const own = getComputedStyle(element);
          const paintVisibility = probe.readContrastPaintedVisibility(element);
          let visible =
            paintVisibility.visible &&
            own.visibility === 'visible' &&
            [...element.getClientRects()].some((box) => box.width > 0 && box.height > 0);
          let left = 0,
            top = 0,
            right = innerWidth,
            bottom = innerHeight;
          // Shared calibrated paint-domain limits apply to passive regions too.
          // Keep this reader's additional conservative region restrictions.
          const limits: string[] = [...paintVisibility.limits];
          const ancestorPrototypeIds: string[] = [];
          for (
            let current: HTMLElement | null = element;
            current;
            current = current.parentElement
          ) {
            const style = getComputedStyle(current);
            if (
              style.display === 'none' ||
              style.contentVisibility === 'hidden' ||
              Number(style.opacity) === 0
            )
              visible = false;
            if (style.clip !== 'auto' || style.clipPath !== 'none' || style.maskImage !== 'none')
              limits.push('unsupported-clip-or-mask');
            if (
              style.filter !== 'none' ||
              style.backdropFilter !== 'none' ||
              style.mixBlendMode !== 'normal'
            )
              limits.push('unsupported-filter-or-blend');
            if (
              style.transform !== 'none' ||
              style.translate !== 'none' ||
              style.rotate !== 'none' ||
              style.scale !== 'none'
            )
              limits.push('unsupported-transformed-region');
            if (style.contain.includes('paint')) limits.push('unsupported-paint-containment');
            if (current !== element) {
              const ancestorRect = current.getBoundingClientRect();
              if (style.overflowX !== 'visible') {
                left = Math.max(left, ancestorRect.left + current.clientLeft);
                right = Math.min(
                  right,
                  ancestorRect.left + current.clientLeft + current.clientWidth
                );
              }
              if (style.overflowY !== 'visible') {
                top = Math.max(top, ancestorRect.top + current.clientTop);
                bottom = Math.min(
                  bottom,
                  ancestorRect.top + current.clientTop + current.clientHeight
                );
              }
              // Identity ancestry stops at the borrowed recipe boundary; the
              // visibility/paint loop still measures every physical ancestor.
              if (retained?.contains(current) && current.hasAttribute('data-pui-root'))
                ancestorPrototypeIds.unshift(current.dataset.projectionPrototype ?? '');
            }
          }
          visible =
            visible &&
            rect.right > left &&
            rect.left < right &&
            rect.bottom > top &&
            rect.top < bottom;
          if (
            visible &&
            (rect.left < left || rect.right > right || rect.top < top || rect.bottom > bottom)
          )
            limits.push('partially-clipped-region');
          return {
            prototypeId: element.dataset.projectionPrototype ?? null,
            owner: element.dataset.projectionOwner ?? null,
            generation: element.dataset.projectionGeneration ?? null,
            currentLease:
              !!owner &&
              !!generation &&
              element.dataset.projectionOwner === owner &&
              element.dataset.projectionGeneration === generation,
            withinContent: !!retained?.contains(element),
            ancestorPrototypeIds,
            ref: element.getAttribute('data-demo-ref'),
            text: element.textContent,
            display: own.display,
            ariaHidden: element.getAttribute('aria-hidden'),
            ...(input.family === 'spinner' &&
            element.dataset.projectionPrototype === input.rootPrototypeId
              ? {
                  staticReducedMotion:
                    own.animationName === 'none' &&
                    element.getAnimations({ subtree: true }).length === 0 &&
                    own.borderTopColor === 'rgba(0, 0, 0, 0)' &&
                    own.borderRightColor === own.color &&
                    own.borderBottomColor === own.color &&
                    own.borderLeftColor === own.color &&
                    [
                      own.borderTopWidth,
                      own.borderRightWidth,
                      own.borderBottomWidth,
                      own.borderLeftWidth,
                    ].every((width) => width === '2px'),
                  animationName: own.animationName,
                  borderColors: [
                    own.borderTopColor,
                    own.borderRightColor,
                    own.borderBottomColor,
                    own.borderLeftColor,
                  ],
                }
              : {}),
            visible,
            paintVisibility,
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            visibilityLimits: [...new Set(limits)],
          };
        });
      const currentSurfaces = surfaces.filter(
        (surface) => surface.currentLease && surface.withinContent
      );
      const counts = input.expected.map((expectation) => ({
        ...expectation,
        actualCount: currentSurfaces.filter(
          (surface) => surface.prototypeId === expectation.prototypeId
        ).length,
      }));
      const missing = counts.filter((count) => count.actualCount < count.expectedCount);
      const extra = counts.filter((count) => count.actualCount > count.expectedCount);
      const unexpectedIdentities = currentSurfaces.filter(
        (surface) =>
          !input.expected.some((expectation) => expectation.prototypeId === surface.prototypeId)
      );
      const unmatched = [...currentSurfaces];
      const missingInstances = input.instances.filter((instance) => {
        const index = unmatched.findIndex(
          (surface) =>
            surface.prototypeId === instance.prototypeId &&
            surface.ref === instance.ref &&
            JSON.stringify(surface.ancestorPrototypeIds) ===
              JSON.stringify(instance.ancestorPrototypeIds)
        );
        if (index < 0) return true;
        unmatched.splice(index, 1);
        return false;
      });
      const unsupportedCoverage = [
        ...input.sourceUnsupported,
        ...surfaces
          .filter((surface) => !surface.currentLease || !surface.withinContent)
          .map((surface) => ({ reason: 'Physical root outside current content lease.', surface })),
        ...currentSurfaces
          .filter(
            (surface) =>
              surface.visibilityLimits.length > 0 &&
              input.expected.some(
                (expectation) =>
                  expectation.prototypeId === surface.prototypeId &&
                  expectation.visibilityRequirement === 'visible-physical-region'
              )
          )
          .map((surface) => ({ reason: 'Physical-region visibility is unsupported.', surface })),
      ];
      const notVisible = currentSurfaces.filter(
        (surface) =>
          !surface.visible &&
          input.expected.some(
            (expectation) =>
              expectation.prototypeId === surface.prototypeId &&
              expectation.visibilityRequirement === 'visible-physical-region'
          )
      );
      const spinnerSurfaces = currentSurfaces.filter(
        (surface) => surface.prototypeId === input.rootPrototypeId
      );
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const staticSpinner =
        input.family !== 'spinner' ||
        (reducedMotion &&
          spinnerSurfaces.length > 0 &&
          spinnerSurfaces.every((surface) => surface.staticReducedMotion === true));
      return {
        achieved:
          ready &&
          !missing.length &&
          !extra.length &&
          !unexpectedIdentities.length &&
          !missingInstances.length &&
          !unmatched.length &&
          !unsupportedCoverage.length &&
          !notVisible.length &&
          staticSpinner,
        scope:
          'Current authored passive recipe physical regions at rest only; not semantic or cue conformance.',
        owner: owner ?? null,
        generation: generation ?? null,
        ready,
        projection: boundary.observation,
        expectationSource: {
          manifest: 'apps/www/src/components/PrototypePreviewer/projection-families.ts',
          recipe: input.recipePath,
          recipeId: input.recipeId,
          derivation:
            'Validated authored proto nodes counted with exact manifest identities; ancestry/ref from the same recipe tree.',
        },
        counts,
        expectedInstances: input.instances,
        surfaces,
        missing,
        extra,
        unexpectedIdentities,
        missingInstances,
        extraInstances: unmatched,
        unsupportedCoverage,
        notVisible,
        ...(input.family === 'spinner'
          ? {
              requestedReducedMotion: 'reduce',
              observedReducedMotion: reducedMotion,
              staticSpinner,
              criterion: 'P-BRUTALIST-SPINNER-MOTION-REDUCED-MOTION (draft)',
              motionScope:
                'Static supported open-edge Spinner roots at reduced-motion rest only; parent regions are ownership/composition observations, not required painted cues.',
            }
          : {}),
        unexercisedCoverage: [
          'Prop/state transitions, semantic criteria and independent cue/WCAG classification.',
          ...input.expected
            .filter((expectation) => expectation.auxiliary)
            .map(
              (expectation) =>
                `${expectation.prototypeId}: observed at rest only; interaction journey not exercised.`
            ),
        ],
      };
    },
    {
      family,
      subject: caseSubject(page),
      recipeId: manifest.recipeId,
      recipePath,
      rootPrototypeId: manifest.parts.root?.prototypeId,
      expected,
      instances,
      sourceUnsupported,
    }
  );
}
async function auditedPopupEscape(page: Page, item: Case, target: Locator): Promise<void> {
  const family = item.family;
  const trigger = await target.elementHandle();
  if (!trigger) throw new Error(`${family}: Escape trigger missing.`);
  let popup: Awaited<ReturnType<Locator['elementHandle']>> = null;
  let baseline: JSHandle<ReturnType<typeof readContrastPopupEscapeBefore>> | undefined;
  const lease = async () =>
    page.evaluate((subject) => {
      const boundary = (
        globalThis as typeof globalThis & {
          puiContrastProbe: typeof import('./contrast-probe.browser');
        }
      ).puiContrastProbe.readContrastAuditSubject(subject);
      return {
        achieved: boundary.observation.achieved,
        owner: boundary.owner,
        generation: boundary.generation,
      };
    }, caseSubject(page));
  try {
    const beforeLease = await lease();
    if (!beforeLease.achieved) throw new Error(`${family}: Escape subject lease is invalid.`);
    const controlledId = await target.getAttribute('aria-controls');
    const popupLocator =
      family === 'tooltip'
        ? await tooltipPortal(page, target)
        : family === 'hover-card'
          ? await owned(page, 'brutalist-hover-card-content')
          : (
              await owned(
                page,
                family === 'dialog'
                  ? 'brutalist-dialog-content'
                  : family === 'select'
                    ? 'brutalist-select-content'
                    : 'brutalist-dropdown-content'
              )
            ).and(page.locator(`[id=${JSON.stringify(controlledId)}]`));
    if ((await popupLocator.count()) !== 1)
      throw new Error(`${family}: Escape requires exactly one controlled owned popup.`);
    popup = await popupLocator.elementHandle();
    if (!popup) throw new Error(`${family}: Escape popup missing.`);
    baseline = await page.evaluateHandle(readContrastPopupEscapeBefore, {
      family,
      trigger,
      popup,
      owner: beforeLease.owner,
      generation: beforeLease.generation,
    });
    const record = (item.escapeTransition = {
      basis:
        'Existing Escape input is observed before any pointer/focus reset: Hover Card retains its same painted owned popup and focus; Tooltip closes while preserving prior focus; Dropdown/Select/Dialog close and restore Trigger; Select preserves observed selection.',
      criterion:
        family === 'hover-card'
          ? 'P-BASE-HOVER-CARD-CONTENT-OVERLAY (draft)'
          : family === 'tooltip'
            ? 'P-BASE-TOOLTIP-CONTENT-OVERLAY / ESCAPE (draft)'
            : family === 'select'
              ? 'P-BASE-SELECT-CONTENT-DISMISS / P-BASE-SELECT-SELECTION-INVARIANT (draft)'
              : family === 'dialog'
                ? 'P-BASE-DIALOG-CONTENT-FOCUS / DISMISS (draft)'
                : 'P-BASE-DROPDOWN-MENU-CONTENT-DISMISS (draft)',
    });
    await establishContrastPopupEscapeBaseline({
      family,
      record,
      readBefore: () => baseline!.evaluate((value) => value.observation),
      pressEscape: () => page.keyboard.press('Escape'),
      waitForClosed: () => popup!.waitForElementState('hidden'),
      waitForSettled: () => settle(page),
      waitForFocus: () =>
        page.waitForFunction((value) => document.activeElement === value.trigger, baseline!),
      readAfter: async () => {
        const afterLease = await lease();
        if (
          !afterLease.achieved ||
          afterLease.owner !== beforeLease.owner ||
          afterLease.generation !== beforeLease.generation
        )
          throw new Error(`${family}: subject changed during Escape dismissal.`);
        return page.evaluate(readContrastPopupEscapeAfter, baseline!);
      },
    });
  } finally {
    await baseline?.dispose();
    await popup?.dispose();
    await trigger.dispose();
  }
}
async function targetObservation(target: Locator): Promise<Observation> {
  return target.evaluate((element) =>
    (
      globalThis as typeof globalThis & {
        puiContrastProbe: typeof import('./contrast-probe.browser');
      }
    ).puiContrastProbe.readContrastTargetObservation(element)
  );
}
async function requireTarget(
  target: Locator,
  predicate: (observation: Observation) => boolean
): Promise<Observation> {
  const observation = await targetObservation(target);
  return { ...observation, achieved: observation.achieved && predicate(observation) };
}
async function pointerJourney(
  page: Page,
  item: Case,
  target: Locator,
  previewer: Locator,
  prefix = ''
): Promise<void> {
  const before = await targetObservation(target);
  const family = item.family;
  if (family === 'tabs' && before.ariaSelected !== 'false') {
    throw new Error(
      'Details must initially be unselected; no selection transition can be claimed.'
    );
  }
  const popupName = (
    {
      dialog: 'brutalist-dialog-content',
      'dropdown-menu': 'brutalist-dropdown-content',
      select: 'brutalist-select-content',
    } as Record<string, string>
  )[family];
  const controlledId = popupName ? await target.getAttribute('aria-controls') : null;
  if (popupName && !controlledId)
    throw new Error('Popup trigger has no controls identity to bind its activation result.');
  // The runtime selector is itself a Select with the same owner/generation.
  // Use the product trigger's relation, not the first owned listbox.
  const popup = popupName
    ? (await owned(page, popupName)).and(page.locator(`[id=${JSON.stringify(controlledId)}]`))
    : null;
  const popupBefore = popup ? await popup.isVisible() : null;
  if (popupBefore)
    throw new Error('Pointer open journey requires an initially closed owned popup.');
  const clicks =
    family === 'button'
      ? await target.evaluateHandle((element) => {
          // This observes native click delivery only; no subject state or handler is replaced.
          const observation = {
            count: 0,
            listener(event: Event) {
              if (event instanceof MouseEvent && event.isTrusted && event.button === 0)
                observation.count++;
            },
            dispose() {
              element.removeEventListener('click', observation.listener);
            },
          };
          element.addEventListener('click', observation.listener);
          return observation;
        })
      : null;
  try {
    const bounds = await target.boundingBox();
    if (!bounds) throw new Error(`${family}: physical input target lacks bounds.`);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    try {
      await capture(page, item, `${prefix}pointer-down`, () =>
        requireTarget(target, (value) => value.nativeActive === true)
      );
    } finally {
      await page.mouse.up();
    }
    if (family === 'tabs') {
      await target.locator('xpath=self::*[@aria-selected="true"]').waitFor();
      await capture(page, item, `${prefix}activation-result`, () =>
        tabsObservation(previewer, 'Details')
      );
      return;
    }
    if (popup) await popup.waitFor({ state: 'visible' });
    await capture(page, item, `${prefix}activation-result`, async () => {
      const after = await targetObservation(target);
      if (family === 'button') {
        const delivered = await clicks!.evaluate((observation) => observation.count);
        return {
          ...after,
          achieved: after.achieved && delivered === 1,
          trustedNativeClicks: delivered,
          basis:
            'One trusted native click delivered to this Button after release; not application-effect or Expose-protocol acceptance.',
        };
      }
      if (popup) {
        const popupPaint = await paintedPopupObservation(popup);
        const popupAfter = popupPaint.achieved;
        const maskProof = family === 'dialog' ? await dialogOpenObservation(page, popup) : null;
        return {
          ...after,
          achieved:
            after.achieved &&
            popupBefore === false &&
            popupAfter &&
            (family === 'dialog' || after.ariaExpanded === 'true') &&
            (!maskProof || maskProof.achieved),
          before,
          after,
          popupBefore,
          popupAfter,
          popupPrototype: popupName,
          popupPaint,
          maskProof,
        };
      }
      const attribute = family === 'toggle' ? 'ariaPressed' : 'ariaChecked';
      const oldValue = before[attribute];
      const expected = oldValue === 'true' ? 'false' : 'true';
      const validBefore =
        oldValue === 'true' ||
        oldValue === 'false' ||
        (family === 'checkbox' && oldValue === 'mixed');
      return {
        ...after,
        achieved: after.achieved && validBefore && after[attribute] === expected,
        attribute,
        before: oldValue,
        expected,
        after: after[attribute],
      };
    });
  } finally {
    if (clicks) {
      await clicks.evaluate((observation) => observation.dispose());
      await clicks.dispose();
    }
  }
}
async function owned(page: Page, prototype: string): Promise<Locator> {
  const lease = await page.evaluate((subject) => {
    const boundary = (
      globalThis as typeof globalThis & {
        puiContrastProbe: typeof import('./contrast-probe.browser');
      }
    ).puiContrastProbe.readContrastAuditSubject(subject);
    if (!boundary.observation.achieved) throw new Error('Selected audit subject is invalid.');
    return { owner: boundary.owner, generation: boundary.generation };
  }, caseSubject(page));
  if (!lease.owner || !lease.generation) throw new Error('Current projection lease missing.');
  return page.locator(
    `[data-pui-root][data-projection-prototype=${JSON.stringify(prototype)}][data-projection-owner=${JSON.stringify(lease.owner)}][data-projection-generation=${JSON.stringify(lease.generation)}]`
  );
}
async function failedKeyboardDiagnostics(page: Page): Promise<Record<string, unknown>> {
  // Read-only, source-bound diagnostics on this independently supervised local
  // Vite audit server. Never use these private observations as acceptance facts.
  const moduleURL = new URL(
    `/@fs${join(repositoryRoot, 'packages/modules/focus/src/center.ts')}`,
    baseUrl!
  );
  try {
    return await page.evaluate(
      async ({ url, subject }) => {
        const probe = (
          globalThis as typeof globalThis & {
            puiContrastProbe: typeof import('./contrast-probe.browser');
          }
        ).puiContrastProbe;
        return {
          ...probe.readContrastFocusDiagnostics((await import(url)).FOCUS_CENTER, url),
          requestedSubject: probe.readContrastAuditSubject(subject).observation,
          diagnosticScope:
            'Global Focus center diagnostics with the selected subject attached; never an owner-selection or acceptance source.',
        };
      },
      { url: moduleURL.href, subject: caseSubject(page) }
    );
  } catch (error) {
    return { unavailable: message(error), source: moduleURL.href };
  }
}
async function paintedPopupObservation(popup: Locator): Promise<Observation> {
  if ((await popup.count()) !== 1)
    return { achieved: false, reason: 'Expected exactly one controlled owned popup.' };
  return popup.evaluate((element) => {
    const visibility = (
      globalThis as typeof globalThis & {
        puiContrastProbe: typeof import('./contrast-probe.browser');
      }
    ).puiContrastProbe.readContrastPaintedVisibility(element);
    return {
      achieved: visibility.visible && visibility.classification === 'source-model-visible',
      visibility,
      prototype: element.getAttribute('data-projection-prototype'),
      owner: element.getAttribute('data-projection-owner'),
      generation: element.getAttribute('data-projection-generation'),
      id: element.id,
      basis: 'Exact trigger-controlled owned popup; same painted-visibility model as frame facts.',
    };
  });
}
async function popupItemPointerJourneys(page: Page, item: Case, trigger: Locator): Promise<void> {
  const family = item.family;
  const isSelect = family === 'select';
  const contentName = isSelect ? 'brutalist-select-content' : 'brutalist-dropdown-content';
  const rows = isSelect
    ? [
        { name: 'Paper', identity: 'selected', pair: 'main', selected: 'true' },
        { name: 'Ink', identity: 'unselected', pair: 'main', selected: 'false' },
      ]
    : [
        { name: 'Profile', identity: 'default', pair: 'main', selected: null },
        { name: 'Delete', identity: 'destructive', pair: 'destructive', selected: null },
      ];
  // These exact authored rows come from demo-brutalist-{select,dropdown-menu}.demo.ts.
  // Selection is observed before mouseup; activation is not suppressed or rewritten.
  for (const row of rows) {
    phase = `item-pointer-close:${row.identity}`;
    const previousId = await trigger.getAttribute('aria-controls');
    if (!previousId)
      throw new Error('Item pointer journey has no prior controlled popup identity.');
    await page.keyboard.press('Escape');
    await (await owned(page, contentName))
      .and(page.locator(`[id=${JSON.stringify(previousId)}]`))
      .waitFor({ state: 'hidden' });
    await page.mouse.move(0, 0);
    await trigger.click();
    const controlledId = await trigger.getAttribute('aria-controls');
    if (!controlledId) throw new Error('Item pointer journey has no controlled popup identity.');
    const popup = (await owned(page, contentName)).and(
      page.locator(`[id=${JSON.stringify(controlledId)}]`)
    );
    await popup.waitFor({ state: 'visible' });
    const target = popup.getByRole(isSelect ? 'option' : 'menuitem', {
      name: row.name,
      exact: true,
    });
    // Visibility can precede deferred native entry focus. Start from an
    // observed item in this exact popup before sending End/Home; then require
    // focus on the OTHER authored row, rather than merely hoping the key ran.
    const role = isSelect ? 'option' : 'menuitem';
    const otherRow = rows.find((candidate) => candidate !== row)!;
    const other = popup.getByRole(role, { name: otherRow.name, exact: true });
    const baselineRecord: Record<string, unknown> = {
      identity: row.identity,
      targetName: row.name,
      expectedOtherName: otherRow.name,
      expectedSelection: row.selected,
      stage: 'popup-visible',
      beforeEntryWait: await targetObservation(target),
      achieved: false,
    };
    (item.pointerItemBaselines ??= []).push(baselineRecord);
    phase = `item-pointer-baseline:${row.identity}`;
    const before = await establishNativeItemPointerBaseline({
      waitForPaint: async () => {
        baselineRecord.stage = 'waiting-authored-entry-paint';
        baselineRecord.settledFingerprint = await stableFingerprint(page);
      },
      waitForEntry: async () => {
        baselineRecord.stage = 'waiting-native-entry';
        const entry = popup.locator(
          `[role="${role}"]:focus:not([aria-disabled="true"]):not([disabled])`
        );
        await entry.waitFor({ state: 'visible' });
        baselineRecord.entry = await targetObservation(entry);
      },
      pressEdge: async () => {
        baselineRecord.stage = 'requesting-other-item';
        await page.keyboard.press(row === rows[0] ? 'End' : 'Home');
        await page.mouse.move(0, 0);
      },
      waitForOther: async () => {
        baselineRecord.stage = 'waiting-other-item-focus';
        await other.and(page.locator(':focus')).waitFor({ state: 'visible' });
        baselineRecord.other = await targetObservation(other);
      },
      readTarget: async () => {
        baselineRecord.stage = 'checking-independent-target';
        const observation = await targetObservation(target);
        baselineRecord.observed = observation;
        return observation;
      },
      expectedSelection: row.selected,
      identity: row.identity,
    });
    baselineRecord.stage = 'verified';
    baselineRecord.achieved = true;
    const physical = await target.elementHandle();
    if (!physical) throw new Error('Pointer item has no physical target.');
    const theme = BRUTALIST_THEME[item.theme as keyof typeof BRUTALIST_THEME];
    const expected = { fill: theme[row.pair], foreground: theme[`${row.pair}-foreground`] };
    const observe = async (held: boolean): Promise<Observation> => {
      const control = await target.evaluate(
        (element, input) => {
          const pair = (
            globalThis as typeof globalThis & {
              puiContrastProbe: typeof import('./contrast-probe.browser');
            }
          ).puiContrastProbe.readContrastPointerPair(element, input.expected, input.held);
          return {
            ...pair,
            achieved:
              pair.achieved &&
              element === input.physical &&
              (!input.isSelect || element.getAttribute('aria-selected') === input.selected),
            samePhysicalTarget: element === input.physical,
            focused: document.activeElement === element,
            selected: element.getAttribute('aria-selected'),
          };
        },
        { physical, held, isSelect, selected: row.selected, expected }
      );
      const popupPaint = await paintedPopupObservation(popup);
      return {
        ...control,
        achieved: control.achieved && popupPaint.achieved,
        popupPaint,
        before,
        identity: row.identity,
        expectedPairSource: 'packages/prototypes/brutalist/src/theme.ts',
        criterion: isSelect
          ? 'P-BRUTALIST-SELECT-ITEM-INTERACTION (draft)'
          : 'P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION (draft)',
      };
    };
    try {
      await target.hover();
      await capture(page, item, `item-${row.identity}-hover`, () => observe(false));
      await page.mouse.down();
      try {
        await capture(page, item, `item-${row.identity}-pointer-held`, () => observe(true));
      } finally {
        await page.mouse.up();
      }
    } finally {
      await physical.dispose();
    }
  }
}
async function dialogOpenObservation(page: Page, modal: Locator): Promise<Observation> {
  const masks = await owned(page, 'brutalist-dialog-mask');
  if ((await masks.count()) !== 1)
    return { achieved: false, reason: 'Open Dialog requires exactly one owned mask.' };
  const handle = await masks.elementHandle();
  if (!handle) return { achieved: false, reason: 'Owned Dialog mask has no physical target.' };
  try {
    return await modal.evaluate((content, mask) => {
      const visibility = [content, mask].map((element): boolean => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        for (let current: Element | null = element; current; ) {
          const style = getComputedStyle(current);
          if (
            style.display === 'none' ||
            style.visibility !== 'visible' ||
            style.contentVisibility === 'hidden' ||
            Number(style.opacity) === 0
          )
            return false;
          const root = current.getRootNode();
          current =
            current.assignedSlot ??
            current.parentElement ??
            (root instanceof ShadowRoot ? root.host : null);
        }
        return true;
      });
      const rect = content.getBoundingClientRect();
      const maskRect = mask.getBoundingClientRect();
      const style = getComputedStyle(mask);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const paint = canvas.getContext('2d');
      if (!paint) return { achieved: false, reason: 'Mask fill could not be observed.' };
      paint.fillStyle = style.backgroundColor;
      paint.fillRect(0, 0, 1, 1);
      const fillAlpha = paint.getImageData(0, 0, 1, 1).data[3];
      const maskVisible = visibility[1] === true && fillAlpha > 0;
      const coversViewport =
        maskRect.left <= 0 &&
        maskRect.top <= 0 &&
        maskRect.right >= innerWidth &&
        maskRect.bottom >= innerHeight;
      // Same twelve one-CSS-pixel exterior locations sampled by the probe.
      // Hit ownership establishes the receiving layer, not a contrast verdict
      // or a claim that content box-shadow cannot paint over that layer.
      const exterior = [0.25, 0.5, 0.75]
        .flatMap((fraction) => [
          { side: 'top', x: rect.x + rect.width * fraction, y: rect.y - 1 },
          { side: 'left', x: rect.x - 1, y: rect.y + rect.height * fraction },
          { side: 'bottom', x: rect.x + rect.width * fraction, y: rect.bottom + 1 },
          { side: 'right', x: rect.right + 1, y: rect.y + rect.height * fraction },
        ])
        .map((point) => {
          const insideViewport =
            point.x >= 0 && point.y >= 0 && point.x < innerWidth && point.y < innerHeight;
          const hit = insideViewport ? document.elementFromPoint(point.x, point.y) : null;
          return {
            ...point,
            insideViewport,
            maskIsExteriorLayer: hit === mask,
            hitPrototype: hit?.getAttribute('data-projection-prototype') ?? null,
          };
        });
      const center = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const contentInFront = center !== null && content.contains(center);
      const ownedMask =
        mask.getAttribute('data-projection-owner') ===
          content.getAttribute('data-projection-owner') &&
        mask.getAttribute('data-projection-generation') ===
          content.getAttribute('data-projection-generation');
      return {
        achieved:
          content.getAttribute('role') === 'dialog' &&
          visibility[0] === true &&
          ownedMask &&
          maskVisible &&
          coversViewport &&
          style.position === 'fixed' &&
          contentInFront &&
          exterior.every((point) => point.insideViewport && point.maskIsExteriorLayer),
        maskVisible,
        coversViewport,
        ownedMask,
        fillAlpha,
        contentInFront,
        exterior,
        contentBounds: rect.toJSON(),
        maskBounds: maskRect.toJSON(),
        maskBackground: style.backgroundColor,
        basis:
          'Owned visible filled full-viewport mask is the hit-tested exterior receiving layer; content remains above it. Pixel ratios and shadow-overhang classification remain separate.',
      };
    }, handle);
  } finally {
    await handle.dispose();
  }
}
async function tooltipPortal(page: Page, target: Locator): Promise<Locator> {
  const content = await owned(page, 'brutalist-tooltip-content');
  // Opened content moves into the body portal; the first owned node may be a
  // different, closed Tooltip. Description tokens are additive, not one ID.
  const handle = await target.elementHandle();
  if (!handle) throw new Error('Tooltip physical trigger missing.');
  try {
    await page.waitForFunction(
      ({ trigger, subject }) => {
        const boundary = (
          globalThis as typeof globalThis & {
            puiContrastProbe: typeof import('./contrast-probe.browser');
          }
        ).puiContrastProbe.readContrastAuditSubject(subject);
        if (!boundary.observation.achieved) return false;
        const { scope, owner } = boundary;
        return (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => {
          const element = document.getElementById(id);
          return (
            element !== null &&
            element.dataset.projectionOwner === owner &&
            element.dataset.projectionGeneration === scope?.dataset.projectionGeneration &&
            element.dataset.projectionPrototype === 'brutalist-tooltip-content' &&
            element.getBoundingClientRect().width > 0 &&
            element.getBoundingClientRect().height > 0
          );
        });
      },
      { trigger: handle, subject: caseSubject(page) },
      { timeout: 10_000 }
    );
  } finally {
    await handle.dispose();
  }
  const tokens = ((await target.getAttribute('aria-describedby')) ?? '').split(/\s+/);
  const ids = (
    await content.evaluateAll((elements) => elements.map((element) => element.id))
  ).filter((id) => id && tokens.includes(id));
  if (ids.length !== 1)
    throw new Error('Tooltip description does not resolve to exactly one current owned content.');
  const portal = content.and(page.locator(`[id=${JSON.stringify(ids[0])}]`));
  await portal.waitFor({ state: 'visible' });
  return portal;
}
async function hoverCardObservation(
  page: Page,
  target: Locator,
  intent: 'hover' | 'focus' | 'closed'
): Promise<Observation> {
  const roots = await owned(page, 'brutalist-hover-card-root');
  const triggers = await owned(page, 'brutalist-hover-card-trigger');
  const contents = await owned(page, 'brutalist-hover-card-content');
  const rootCount = await roots.count();
  const triggerCount = await triggers.count();
  const contentCount = await contents.count();
  if (
    rootCount !== 1 ||
    triggerCount !== 1 ||
    contentCount > 1 ||
    (intent !== 'closed' && contentCount !== 1)
  )
    return {
      achieved: false,
      reason:
        'Hover Card requires the authored one-Root/one-Trigger composition and unambiguous current owned content.',
      rootCount,
      triggerCount,
      contentCount,
    };
  const handle = await target.elementHandle();
  if (!handle) return { achieved: false, reason: 'Hover Card physical trigger missing.' };
  try {
    const binding = await roots.evaluate(
      (root, trigger) => ({
        owner: root.getAttribute('data-projection-owner'),
        generation: root.getAttribute('data-projection-generation'),
        ownsTrigger:
          root.contains(trigger) &&
          trigger.getAttribute('data-projection-prototype') === 'brutalist-hover-card-trigger' &&
          trigger.getAttribute('data-projection-owner') ===
            root.getAttribute('data-projection-owner') &&
          trigger.getAttribute('data-projection-generation') ===
            root.getAttribute('data-projection-generation'),
      }),
      handle
    );
    const trigger = await targetObservation(target);
    const visible = contentCount === 1 && (await contents.isVisible());
    const portal = contentCount === 1 ? await targetObservation(contents) : null;
    return {
      ...binding,
      achieved:
        binding.ownsTrigger &&
        trigger.achieved &&
        (intent === 'closed'
          ? !visible && trigger.focused === false && trigger.hovered === false
          : visible &&
            portal?.achieved === true &&
            (intent === 'hover'
              ? trigger.hovered === true
              : trigger.focused === true &&
                trigger.focusVisible === true &&
                trigger.hovered === false)),
      rootCount,
      triggerCount,
      contentCount,
      visible,
      trigger,
      portal,
      intent,
      criterion: 'P-BASE-HOVER-CARD-INTERACTION-INTENT (draft)',
      boundary:
        'Current demo-brutalist-hover-card authored one Root, one Trigger/Content, openDelay:0 and closeDelay:0; current owner/generation binds the sole content, not a general cross-Root association or conformance claim.',
    };
  } finally {
    await handle.dispose();
  }
}
async function tabsObservation(
  previewer: Locator,
  selected: 'Details' | 'Overview'
): Promise<Observation> {
  const overview = previewer.getByRole('tab', { name: 'Overview', exact: true });
  const details = previewer.getByRole('tab', { name: 'Details', exact: true });
  // The previewer itself has a tabpanel wrapper; only the materialized product
  // part proves that selection changed the current Tabs content.
  const panel = previewer.locator(
    '[data-projection-content] [data-pui-root][data-projection-prototype="brutalist-tabs-content"][role="tabpanel"]:visible'
  );
  const expectedText =
    selected === 'Details'
      ? 'Dark mode keeps black shadows on warm paper.'
      : 'Hard borders, loud yellow, no radius.';
  const overviewTarget = await targetObservation(overview);
  const detailsTarget = await targetObservation(details);
  const panelTarget = (await panel.count()) === 1 ? await targetObservation(panel) : null;
  return {
    achieved:
      overviewTarget.achieved &&
      detailsTarget.achieved &&
      panelTarget?.achieved === true &&
      (await overview.getAttribute('aria-selected')) === String(selected === 'Overview') &&
      (await details.getAttribute('aria-selected')) === String(selected === 'Details') &&
      (await panel.count()) === 1 &&
      (await panel.innerText()).trim() === expectedText,
    overview: overviewTarget,
    details: detailsTarget,
    panelTarget,
    panel: await panel.allTextContents(),
  };
}
async function scrollOffsets(target: Locator) {
  return target.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
    maxLeft: element.scrollWidth - element.clientWidth,
    maxTop: element.scrollHeight - element.clientHeight,
  }));
}
async function waitScroll(
  page: Page,
  target: Locator,
  before: Awaited<ReturnType<typeof scrollOffsets>>,
  axes: 'vertical-end' | 'vertical-start' | 'both'
) {
  const handle = await target.elementHandle();
  if (!handle) throw new Error('Scroll physical target missing.');
  try {
    await page.waitForFunction(
      ({ element, before, axes }) =>
        axes === 'vertical-end'
          ? element.scrollTop !== before.top &&
            Math.abs(element.scrollTop - (element.scrollHeight - element.clientHeight)) <= 1
          : axes === 'vertical-start'
            ? element.scrollTop !== before.top && element.scrollTop <= 1
            : element.scrollLeft !== before.left && element.scrollTop !== before.top,
      { element: handle, before, axes },
      { timeout: 10_000 }
    );
    // The browser callback must not capture tsx's Node-only naming helper.
    // Reuse the exact leased paint/scroll geometry guard on the Node boundary.
    await stableFingerprint(page);
  } finally {
    await handle.dispose();
  }
}

try {
  cleanSource = readContrastProvenance(repositoryRoot);
  if (cleanSource.head !== baseline) throw new Error('Source HEAD changed during audit startup.');
  await verifyServedSource();
  report.servedSource = servedSource;
  const sourceFiles = [
    ['runner', new URL('./audit-brutalist-contrast.mts', import.meta.url)],
    ['probe', new URL('./contrast-probe.browser.ts', import.meta.url)],
    ['popup-escape', new URL('./contrast-popup-escape.mjs', import.meta.url)],
    ['known-unsupported-domain', new URL('./contrast-known-unsupported.mjs', import.meta.url)],
    ['theme', new URL('../../../packages/prototypes/brutalist/src/theme.ts', import.meta.url)],
    ['provenance-guard', new URL('./contrast-provenance.mjs', import.meta.url)],
    ['surface-recipes', new URL('../src/components/surface-recipes.ts', import.meta.url)],
    ['report-journal', new URL('./contrast-report-journal.mjs', import.meta.url)],
    ['audit-plan', new URL('./contrast-audit-plan.mjs', import.meta.url)],
    ['anatomy-model', new URL('./contrast-anatomy.mjs', import.meta.url)],
    ['browser-harness', new URL('../src/content/docs/zh-cn/browser-harness.ts', import.meta.url)],
    [
      'projection-manifest',
      new URL('../src/components/PrototypePreviewer/projection-families.ts', import.meta.url),
    ],
    ['demo-schema', new URL('../src/components/PrototypePreviewer/demo-types.ts', import.meta.url)],
    ['www-package', new URL('../package.json', import.meta.url)],
    ['workspace-package', new URL('../../../package.json', import.meta.url)],
    ['workspace-lockfile', new URL('../../../pnpm-lock.yaml', import.meta.url)],
    [
      'textarea-live-props-setup',
      new URL('../src/content/docs/zh-cn/demo-base-textarea.demo.ts', import.meta.url),
    ],
    ...selectedFamilies.map((family) => [
      `recipe-${family}`,
      new URL(`../src/content/docs/zh-cn/demo-brutalist-${family}.demo.ts`, import.meta.url),
    ]),
  ] as const;
  const sources: Record<string, unknown>[] = [];
  report.sources = sources;
  let probeSource = '';
  for (const [identity, url] of sourceFiles) {
    const source = await readFile(url, 'utf8');
    const filename = `${identity}.source`;
    await writeFile(join(output, filename), source, { flag: 'wx' });
    sources.push({ identity, original: url.toString(), path: filename, digest: digest(source) });
    if (identity === 'probe') probeSource = source;
  }
  report.sourceCodeVersion = {
    head: baseline,
    status: 'captured',
    kind: 'complete clean Git tree plus generated CSS, bound to the opt-in dev server startup identity and current source checks',
    cleanTree: cleanSource.tree,
    generatedCSS: cleanSource.generated,
    sourceSetDigest: digest(
      JSON.stringify(sources.map(({ identity, digest }) => ({ identity, digest })))
    ),
    runnerDigest: sources.find((source) => source.identity === 'runner')?.digest,
    probeDigest: sources.find((source) => source.identity === 'probe')?.digest,
  };
  browserProbe = (
    await transform(probeSource, {
      loader: 'ts',
      format: 'iife',
      globalName: 'puiContrastProbe',
      keepNames: false,
    })
  ).code;
  await writeFile(join(output, 'probe-executed.js'), browserProbe, { flag: 'wx' });
  report.executedProbe = {
    path: 'probe-executed.js',
    digest: digest(browserProbe),
    transform: { loader: 'ts', format: 'iife', globalName: 'puiContrastProbe', keepNames: false },
  };
  phase = 'browser-launch';
  browser = await launchBrowser();
  report.browser = browser.version();
  phase = 'runtime-discovery';
  for (const family of selectedFamilies) {
    const context = await browser.newContext({ viewport });
    try {
      await verifyServedSource();
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(30_000);
      const route = `/en/ui-libraries/brutalist/components/${family}/`;
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      if (
        !response?.ok() ||
        response.headers()['x-proto-ui-contrast-server'] !== servedSource!.serverId
      )
        throw new Error(
          'Runtime availability page is not from the current source-bound audit server.'
        );
      const previewer = page.locator('[data-previewer-id]').first();
      await previewer.waitFor({ state: 'visible' });
      const recipeId = (PROJECTION_FAMILY_MANIFESTS.brutalist as ProjectionFamilyManifest).families[
        family
      ].recipeId;
      if ((await previewer.getAttribute('data-demo-id')) !== recipeId)
        throw new Error('Runtime availability belongs to another authored recipe.');
      const serialized = await previewer.getAttribute('data-runtimes');
      const available = parseContrastRuntimeOptions(serialized, runtimes) as string[];
      runtimeAvailability[family] = {
        route,
        recipeId,
        serialized,
        available,
        unavailable: runtimes.filter((runtime) => !available.includes(runtime)),
        basis:
          'Exact source-bound preview data-runtimes; unavailable adapters are outside this route, not observed or certified.',
      };
      for (const runtime of available)
        for (const theme of themes) cases.push(createCase(family, runtime, theme));
    } catch (error) {
      const failed = createCase(family, 'undiscovered', 'undiscovered');
      failed.status = 'failed';
      failed.errors.push({ phase, error: message(error) });
      cases.push(failed);
      failures.push({
        family,
        phase,
        error: message(error),
        disposition: 'Unresolved runtime availability; family not excluded.',
      });
      runtimeAvailability[family] = { status: 'failed', error: message(error) };
    } finally {
      await context.close();
    }
  }
  assertContrastCaseCoverage(selectedFamilies, cases);
  await persist('initial');
  for (const item of cases) {
    if (item.status === 'failed') continue;
    const { family, runtime, theme } = item;
    let context: BrowserContext | undefined;
    let casePage: Page | undefined;
    item.status = 'running';
    phase = 'context-creation';
    try {
      phase = 'source-provenance';
      await verifyServedSource();
      // openRoute creates a context before readiness and leaks it on rejection.
      // Keep the same documented setup with ownership established before goto.
      phase = 'context-creation';
      context = await browser.newContext({
        viewport,
        ...(item.motionContext ? { reducedMotion: item.motionContext.requestedReducedMotion } : {}),
      });
      const page = await context.newPage();
      casePage = page;
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(30_000);
      phase = 'route-opening';
      const response = await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'networkidle' });
      if (!response || !response.ok())
        throw new Error(`Route returned HTTP ${response?.status() ?? 'no response'}.`);
      if (response.headers()['x-proto-ui-contrast-server'] !== servedSource!.serverId)
        throw new Error('Rendered page came from a different audit server identity.');
      if (item.motionContext) {
        item.motionContext.observedReducedMotion = await page.evaluate(
          () => matchMedia('(prefers-reduced-motion: reduce)').matches
        );
        if (!item.motionContext.observedReducedMotion)
          throw new Error('Spinner reduced-motion preference was requested but not observed.');
      }
      let previewer = page.locator('[data-previewer-id]').first();
      await previewer.waitFor({ state: 'visible' });
      await bindCaseSubject(page, previewer, item);
      previewer = casePreviewer(page);
      phase = 'runtime-theme-readiness';
      await choosePreviewRuntime(page, previewer, runtime as (typeof runtimes)[number]);
      await previewer
        .and(
          page.locator(
            `[data-previewer-id][data-projection-state="ready"][data-projection-runtime="${runtime}"]`
          )
        )
        .locator(
          `[data-projection-scope][data-projection-family="brutalist"][data-projection-runtime="${runtime}"][data-projection-state="ready"]`
        )
        .waitFor({ state: 'attached' });
      await page.addScriptTag({ content: browserProbe });
      await assertProjectionReadiness(page, item);
      await applyColorScheme(page, theme as (typeof themes)[number]);
      await previewer.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const rest = async () => {
        if (passiveFamilies.has(family)) {
          const observation = await passiveSurfaceObservation(page, family, runtime);
          item.passiveSurfaceCoverage = observation;
          if (item.motionContext)
            item.motionContext.observedReducedMotion = observation.observedReducedMotion === true;
          return observation;
        }
        return projectionObservation(page, item);
      };
      await capture(page, item, 'rest', rest);
      const target = primary(previewer, family);
      if (!target) {
        if (!passiveFamilies.has(family))
          throw new Error(
            `${family}: no planned physical target; unsupported interaction coverage.`
          );
        phase = 'passive-surface-acceptance';
        const captured = item.passiveSurfaceCoverage;
        const current = await passiveSurfaceObservation(page, family, runtime);
        const capturedLeaseMatches =
          current.owner === captured?.owner && current.generation === captured?.generation;
        item.passiveSurfaceCoverage = {
          ...current,
          capturedLeaseMatches,
          achieved:
            current.achieved && capturedLeaseMatches && item.achievedTargets.includes('rest'),
        };
        if (!item.passiveSurfaceCoverage.achieved)
          throw new Error(
            `${family}: current passive surface coverage does not match the captured rest lease.`
          );
        const missing = item.plannedStates.filter((state) => !item.achievedTargets.includes(state));
        if (missing.length) throw new Error(`Unachieved planned targets: ${missing.join(', ')}.`);
        phase = 'source-provenance';
        await verifyServedSource();
        item.status = 'observed';
        await persist('case', item);
        continue;
      }
      if (!(await target.count()))
        throw new Error(`${family}: planned native target was not materialized.`);
      await target.hover();
      if (family === 'tooltip') await tooltipPortal(page, target);
      if (family === 'hover-card')
        await (await owned(page, 'brutalist-hover-card-content')).waitFor({ state: 'visible' });
      await capture(page, item, 'hover', () =>
        requireTarget(target, (value) => value.hovered === true)
      );
      if (family === 'tooltip') {
        const portal = await tooltipPortal(page, target);
        await capture(page, item, 'hover-open', async () => {
          const trigger = await targetObservation(target);
          const content = await targetObservation(portal);
          return {
            achieved: trigger.achieved && content.achieved && trigger.hovered === true,
            trigger,
            portal: content,
          };
        });
      }
      if (family === 'hover-card') {
        await capture(page, item, 'hover-open', () => hoverCardObservation(page, target, 'hover'));
      }
      if (
        [
          'button',
          'toggle',
          'switch',
          'tabs',
          'checkbox',
          'dropdown-menu',
          'select',
          'dialog',
        ].includes(family)
      ) {
        await pointerJourney(page, item, target, previewer);
      }
      // Dismiss open menus before testing the trigger's native keyboard route.
      // No pointer/focus reset may mask this exact Escape transition.
      phase = 'escape-attribution';
      if (['tooltip', 'dropdown-menu', 'select', 'dialog', 'hover-card'].includes(family))
        await auditedPopupEscape(page, item, target);
      else await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
      await target.focus();
      await page.keyboard.press('Tab');
      if (family === 'hover-card') {
        // The native Tab leaves the focused seed. Both pointer and focus must
        // be absent and owned content closed before Shift+Tab can prove open.
        await (await owned(page, 'brutalist-hover-card-content')).waitFor({ state: 'hidden' });
        await settle(page);
        item.hoverCardClosedBaseline = await hoverCardObservation(page, target, 'closed');
        if (!item.hoverCardClosedBaseline.achieved)
          throw new Error(
            'Hover Card did not establish an independent closed non-hover focus baseline.'
          );
      }
      await page.keyboard.press('Shift+Tab');
      if (family === 'tooltip') await tooltipPortal(page, target);
      if (family === 'hover-card')
        await (await owned(page, 'brutalist-hover-card-content')).waitFor({ state: 'visible' });
      await capture(page, item, 'keyboard-focus', () =>
        requireTarget(target, (value) => value.focused === true && value.focusVisible === true)
      );
      if (family === 'button') {
        for (const variant of ['surface', 'destructive']) {
          const variantTarget = previewer.locator(
            `[data-projection-content] [data-pui-root][data-demo-ref="${variant}"]`
          );
          await page.mouse.move(0, 0);
          await capture(page, item, `${variant}-rest`, () => targetObservation(variantTarget));
          await variantTarget.hover();
          await capture(page, item, `${variant}-hover`, () =>
            requireTarget(variantTarget, (value) => value.hovered === true)
          );
          await pointerJourney(page, item, variantTarget, previewer, `${variant}-`);
          await page.mouse.move(0, 0);
          await variantTarget.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          await capture(page, item, `${variant}-keyboard-focus`, () =>
            requireTarget(
              variantTarget,
              (value) => value.focused === true && value.focusVisible === true
            )
          );
        }
      }
      if (family === 'tooltip') {
        const portal = await tooltipPortal(page, target);
        await capture(page, item, 'focus-open', async () => {
          const trigger = await targetObservation(target);
          const content = await targetObservation(portal);
          return {
            achieved: trigger.achieved && content.achieved && trigger.focused === true,
            trigger,
            portal: content,
          };
        });
      }
      if (family === 'hover-card') {
        await capture(page, item, 'focus-open', async () => {
          const observation = await hoverCardObservation(page, target, 'focus');
          const baseline = item.hoverCardClosedBaseline;
          const sameLease =
            observation.owner === baseline?.owner &&
            observation.generation === baseline?.generation;
          return {
            ...observation,
            achieved: observation.achieved && baseline?.achieved === true && sameLease,
            closedBaseline: baseline,
            sameLease,
            input: 'Native Shift+Tab after native Tab closed the seeded trigger; pointer outside.',
          };
        });
      }
      if (['dropdown-menu', 'select', 'dialog'].includes(family)) {
        if (family === 'dialog') {
          await target.press('Enter');
          const modal = (await owned(page, 'brutalist-dialog-content')).first();
          await modal.waitFor({ state: 'visible' });
          await settle(page);
          await capture(page, item, 'open', async () => ({
            ...(await dialogOpenObservation(page, modal)),
            modal: await targetObservation(modal),
            entryBasis:
              'Visible owned Dialog with authored CSS entry animations finished; portable transitionState is not inferred from a fabricated DOM attribute.',
          }));
          const icon = (await owned(page, 'brutalist-dialog-close-icon')).first();
          await icon.waitFor({ state: 'visible' });
          await icon.hover();
          await capture(page, item, 'close-icon-hover', async () => {
            const control = await requireTarget(icon, (value) => value.hovered === true);
            const maskProof = await dialogOpenObservation(page, modal);
            return {
              ...control,
              achieved: control.achieved && maskProof.achieved,
              maskProof,
              footerCloseCount: await modal
                .locator('[data-projection-prototype="brutalist-dialog-close"]')
                .count(),
              identity: 'brutalist-dialog-close-icon, not footer Close',
            };
          });
          await page.mouse.move(0, 0);
          let reached = false;
          for (let step = 0; step < 30; step++) {
            await page.keyboard.press('Tab');
            const inside = await modal.evaluate((element) =>
              element.contains(document.activeElement)
            );
            if (!inside) throw new Error('Native Tab focus escaped the entered modal.');
            const observation = await targetObservation(icon);
            if (observation.focused && observation.focusVisible) {
              reached = true;
              break;
            }
          }
          if (!reached)
            throw new Error('CloseIcon native keyboard focus not reached within 30 modal Tabs.');
          await capture(page, item, 'close-icon-keyboard-focus', async () => {
            const control = await requireTarget(
              icon,
              (value) => value.focused === true && value.focusVisible === true
            );
            const maskProof = await dialogOpenObservation(page, modal);
            return { ...control, achieved: control.achieved && maskProof.achieved, maskProof };
          });
        } else {
          if ((await target.getAttribute('aria-expanded')) === 'true') await target.click();
          await target.press('ArrowDown');
          const role = family === 'select' ? 'option' : 'menuitem';
          await page.waitForFunction(
            (role) => document.activeElement?.getAttribute('role') === role,
            role
          );
          const controlledId = await target.getAttribute('aria-controls');
          if (!controlledId)
            throw new Error('Keyboard item journey has no controlled popup identity.');
          const popup = (
            await owned(
              page,
              family === 'select' ? 'brutalist-select-content' : 'brutalist-dropdown-content'
            )
          ).and(page.locator(`[id=${JSON.stringify(controlledId)}]`));
          const itemFocus = async (edge?: 'first' | 'last') => {
            const focus = await popup.evaluate(
              (popup, { role, edge }) => {
                const focused = document.activeElement as HTMLElement | null;
                const candidates = [
                  ...popup.querySelectorAll<HTMLElement>(`[role="${role}"]`),
                ].filter(
                  (element) =>
                    element.dataset.projectionOwner === focused?.dataset.projectionOwner &&
                    element.dataset.projectionGeneration ===
                      focused?.dataset.projectionGeneration &&
                    element.getAttribute('aria-disabled') !== 'true' &&
                    !element.hasAttribute('disabled') &&
                    element.getBoundingClientRect().width > 0 &&
                    element.getBoundingClientRect().height > 0
                );
                const expected =
                  edge === 'first' ? candidates[0] : edge === 'last' ? candidates.at(-1) : focused;
                const focusedPaint = focused
                  ? (
                      globalThis as typeof globalThis & {
                        puiContrastProbe: typeof import('./contrast-probe.browser');
                      }
                    ).puiContrastProbe.readContrastTargetObservation(focused)
                  : null;
                return {
                  focusedPaint,
                  achieved:
                    focusedPaint?.achieved === true &&
                    focused?.getAttribute('role') === role &&
                    popup.contains(focused) &&
                    focused === expected,
                  focusedText: focused?.textContent,
                  focusVisible: focused?.matches(':focus-visible'),
                  requestedEdge: edge ?? null,
                  eligibleItemTexts: candidates.map((element) => element.textContent),
                };
              },
              { role, edge }
            );
            const popupPaint = await paintedPopupObservation(popup);
            const achieved = focus.achieved && popupPaint.achieved;
            return {
              ...focus,
              achieved,
              popupPaint,
              ...(!achieved ? { diagnostics: await failedKeyboardDiagnostics(page) } : {}),
            };
          };
          await capture(page, item, 'open', itemFocus);
          await page.keyboard.press('Home');
          await capture(page, item, 'item-focus-first', () => itemFocus('first'));
          await page.keyboard.press('End');
          await capture(page, item, 'item-focus-last', () => itemFocus('last'));
          await popupItemPointerJourneys(page, item, target);
        }
      }
      if (family === 'tabs') {
        const overview = previewer.getByRole('tab', { name: 'Overview', exact: true });
        await target.press('ArrowLeft');
        await overview.press('Space');
        await overview.locator('xpath=self::*[@aria-selected="true"]').waitFor();
        await capture(page, item, 'keyboard-selection-overview', () =>
          tabsObservation(previewer, 'Overview')
        );
        // Selection has already committed through native keyboard activation.
        // This is not the initially unselected Details pointerdown journey.
        await overview.hover();
        const physical = await overview.elementHandle();
        if (!physical) throw new Error('Selected Overview Tabs trigger has no physical target.');
        try {
          const observeSelected = async (): Promise<Observation> => {
            const value = await overview.evaluate((element, expected) => {
              const target = (
                globalThis as typeof globalThis & {
                  puiContrastProbe: typeof import('./contrast-probe.browser');
                }
              ).puiContrastProbe.readContrastTargetObservation(element);
              const style = getComputedStyle(element);
              return {
                ...target,
                achieved: target.achieved && element === expected && element.isConnected,
                samePhysicalTarget: element === expected,
                prototype: element.getAttribute('data-projection-prototype'),
                owner: element.getAttribute('data-projection-owner'),
                generation: element.getAttribute('data-projection-generation'),
                id: element.id,
                controls: element.getAttribute('aria-controls'),
                role: element.getAttribute('role'),
                ariaSelected: element.getAttribute('aria-selected'),
                nativeActive: element.matches(':active'),
                focusVisible: element.matches(':focus-visible'),
                background: style.backgroundColor,
                foreground: style.color,
                border: style.borderColor,
                shadow: style.boxShadow,
                transform: style.transform,
                translate: style.translate,
              };
            }, physical);
            const paint = classifyFlatTabPaint(value);
            return {
              ...value,
              ...paint,
              achieved:
                value.achieved &&
                value.prototype === 'brutalist-tabs-trigger' &&
                value.role === 'tab' &&
                value.ariaSelected === 'true' &&
                paint.flatPaint,
            };
          };
          await stableFingerprint(page);
          const releasedBefore = await observeSelected();
          if (
            !releasedBefore.achieved ||
            releasedBefore.nativeActive !== false ||
            releasedBefore.flatPaint !== true
          )
            throw new Error(
              'Committed selected Tabs trigger violates current flat-paint criteria.'
            );
          const bounds = await physical.boundingBox();
          if (!bounds) throw new Error('Selected Overview Tabs trigger lacks physical bounds.');
          const sameSelectedPair = (value: Observation) =>
            value.owner === releasedBefore.owner &&
            value.generation === releasedBefore.generation &&
            value.id === releasedBefore.id &&
            value.controls === releasedBefore.controls &&
            value.background === releasedBefore.background &&
            value.foreground === releasedBefore.foreground &&
            value.border === releasedBefore.border;
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          try {
            await page.mouse.down();
            await capture(page, item, 'selected-and-pointer-held', async () => {
              const held = await observeSelected();
              return {
                ...held,
                achieved:
                  held.achieved &&
                  held.nativeActive === true &&
                  sameSelectedPair(held) &&
                  held.flatPaint === true,
                historicalSetup: {
                  boundary:
                    'Released, already-selected Overview before native pointerdown; not the held PNG state.',
                  observation: releasedBefore,
                },
                criterion: 'P-BRUTALIST-TABS-TRIGGER-SELECTED-PAIR-INVARIANT',
                interactionCriterion: 'P-BRUTALIST-TABS-TRIGGER-INTERACTION',
                criterionStatus: 'draft',
                basis:
                  'Already-selected physical Overview trigger remains aria-selected=true under native held pointer and :active; selected computed fill/foreground/border persist with no elevation or translation before, during and after press, per the current 0.3.0-alpha.1 draft. Zero-offset focus rings and transparent reset layers are recorded separately, not elevation. Observation only, not full criterion or WCAG acceptance.',
              };
            });
          } finally {
            // Do not release until PNG, facts and the post-capture fingerprint
            // have all been collected, including on a preserved failed attempt.
            await page.mouse.up();
          }
          await stableFingerprint(page);
          const releasedAfter = await observeSelected();
          // Release is a separate cleanup boundary, not a mutation of the held
          // frame. Any failure enters the existing unresolved Case.errors path.
          if (
            !releasedAfter.achieved ||
            releasedAfter.nativeActive !== false ||
            !sameSelectedPair(releasedAfter) ||
            releasedAfter.flatPaint !== true
          )
            throw new Error('Selected Tabs trigger did not preserve released flat paint.');
        } finally {
          await physical.dispose();
        }
      }
      if (['toggle', 'switch', 'checkbox'].includes(family)) {
        const attribute = family === 'toggle' ? 'aria-pressed' : 'aria-checked';
        const before = await target.getAttribute(attribute);
        const validBefore = before === 'true' || before === 'false';
        const expected = validBefore ? (before === 'true' ? 'false' : 'true') : null;
        item.binaryKeyboardActivation = {
          achieved: false,
          attribute,
          before,
          expected,
          actual: before,
          input: 'Not yet activated; true/false precondition required before native Space.',
        };
        if (!validBefore)
          throw new Error(
            `${family}: keyboard activation requires binary ${attribute}; observed ${JSON.stringify(before)}.`
          );
        await target.press('Space');
        await capture(page, item, 'keyboard-activation', async () => {
          const after = await targetObservation(target);
          const actual = family === 'toggle' ? after.ariaPressed : after.ariaChecked;
          item.binaryKeyboardActivation = {
            ...after,
            achieved: after.achieved && validBefore && actual === expected,
            attribute,
            before,
            expected,
            actual,
            after: actual,
            input:
              'Native Space on the current uncontrolled binary demo target; Checkbox mixed/indeterminate modes are outside this journey.',
          };
          return item.binaryKeyboardActivation;
        });
      }
      for (const planned of contrastHeldBinaryTargets(family)) {
        const heldTarget = previewer.locator(
          `[data-projection-content] [data-pui-root][data-demo-ref="${planned.ref}"]`
        );
        if ((await heldTarget.count()) !== 1)
          throw new Error(
            `${family}: authored ${planned.ref} held-state target is missing or ambiguous.`
          );
        const physical = await heldTarget.elementHandle();
        if (!physical) throw new Error(`${family}: held-state physical target missing.`);
        try {
          const before = await targetObservation(heldTarget);
          if (!before.achieved || before.ariaChecked !== planned.ariaChecked)
            throw new Error(`${family}: ${planned.ref} does not have its authored initial state.`);
          await heldTarget.hover();
          const bounds = await physical.boundingBox();
          if (!bounds) throw new Error(`${family}: held-state target lacks physical bounds.`);
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await page.mouse.down();
          try {
            await capture(page, item, `${planned.state}-and-pointer-held`, async () => {
              const held = await targetObservation(heldTarget);
              const samePhysicalTarget = await heldTarget.evaluate(
                (element, original) => element === original,
                physical
              );
              return {
                ...held,
                achieved:
                  held.achieved &&
                  samePhysicalTarget &&
                  held.nativeActive === true &&
                  held.ariaChecked === planned.ariaChecked,
                samePhysicalTarget,
                authoredRef: planned.ref,
                expectedAriaChecked: planned.ariaChecked,
                releasedBefore: before,
                criterion:
                  family === 'switch'
                    ? 'P-BRUTALIST-SWITCH-INTERACTION (draft)'
                    : 'P-BRUTALIST-CHECKBOX-STATE-PRESENTATION (draft)',
                basis:
                  'Native pointer remains held on the same authored checked/mixed control through PNG and facts. Visual cues are recorded, not independently classified.',
              };
            });
          } finally {
            await page.mouse.up();
          }
        } finally {
          await physical.dispose();
        }
      }
      if (family === 'toggle') {
        const active = previewer.getByRole('button', { name: 'Active', exact: true });
        await capture(page, item, 'already-active', () =>
          requireTarget(active, (value) => value.ariaPressed === 'true')
        );
        await active.hover();
        const bounds = await active.boundingBox();
        if (!bounds) throw new Error('Already-active Toggle lacks physical bounds.');
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        try {
          await capture(page, item, 'active-and-pointer-held', async () => {
            const value = await targetObservation(active);
            const layers = String(value.shadow)
              .split(/,(?![^()]*\))/)
              .map((layer) => layer.trim());
            const visibleLayers = layers.filter(
              (layer) => !/^rgba\([^)]*,\s*0(?:\.0*)?\)\s/.test(layer)
            );
            return {
              ...value,
              rawShadowLayers: layers,
              visibleShadowLayers: visibleLayers,
              achieved:
                value.achieved &&
                value.ariaPressed === 'true' &&
                value.nativeActive === true &&
                visibleLayers.length === 1 &&
                visibleLayers[0].includes('inset'),
              basis:
                'Native pointer held on aria-pressed active Toggle; the sole visible inset is the authored active&&pressed cue. Transparent reset layers are not visible state indicators.',
            };
          });
        } finally {
          await page.mouse.up();
        }
      }
      if (family === 'scroll-area') {
        const beforeEnd = await scrollOffsets(target);
        await target.press('End');
        await waitScroll(page, target, beforeEnd, 'vertical-end');
        await capture(page, item, 'scroll-end', async () => {
          const after = await scrollOffsets(target);
          return {
            achieved: after.top !== beforeEnd.top && Math.abs(after.top - after.maxTop) <= 1,
            input: 'native End',
            before: beforeEnd,
            after,
          };
        });
        // End leaves the vertical axis saturated. Return with native Home so
        // a positive two-axis wheel can actually move both offsets.
        const beforeHome = await scrollOffsets(target);
        await target.press('Home');
        await waitScroll(page, target, beforeHome, 'vertical-start');
        const beforeWheel = await scrollOffsets(target);
        if (
          beforeWheel.top === beforeHome.top ||
          beforeWheel.maxLeft <= beforeWheel.left ||
          beforeWheel.maxTop <= beforeWheel.top
        )
          throw new Error('Native wheel setup has no available movement on both axes.');
        await target.hover();
        await page.mouse.wheel(1000, 1000);
        await waitScroll(page, target, beforeWheel, 'both');
        await capture(page, item, 'wheel-both-axes', async () => {
          const after = await scrollOffsets(target);
          return {
            achieved: after.left !== beforeWheel.left && after.top !== beforeWheel.top,
            input: 'native wheel(1000,1000)',
            before: beforeWheel,
            after,
          };
        });
      }
      if (family === 'textarea') {
        await target.click();
        await target.press('ControlOrMeta+A');
        await target.press('Backspace');
        await capture(page, item, 'empty-placeholder', () =>
          target.evaluate((element: HTMLTextAreaElement) => ({
            achieved: element.value === '' && element.matches(':placeholder-shown'),
            value: element.value,
            placeholder: element.placeholder,
          }))
        );
        const toggle = previewer.locator('[data-demo-ref="toggleProps"]');
        await toggle.click();
        await target.locator('xpath=self::*[@disabled and @readonly]').waitFor();
        await capture(page, item, 'disabled-and-readonly', () =>
          target.evaluate((element: HTMLTextAreaElement) => ({
            achieved:
              element.disabled && element.readOnly && getComputedStyle(element).opacity === '0.5',
            disabled: element.disabled,
            readOnly: element.readOnly,
            opacity: getComputedStyle(element).opacity,
            applicability:
              'coupled inactive disabled+readOnly observation; not a readOnly-only claim or active contrast verdict',
          }))
        );
        await toggle.click();
        await capture(page, item, 'live-props-restored', () =>
          target.evaluate((element: HTMLTextAreaElement) => ({
            achieved: !element.disabled && !element.readOnly,
            disabled: element.disabled,
            readOnly: element.readOnly,
          }))
        );
      }
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
      const missing = item.plannedStates.filter((state) => !item.achievedTargets.includes(state));
      if (missing.length) throw new Error(`Unachieved planned targets: ${missing.join(', ')}.`);
      phase = 'source-provenance';
      await verifyServedSource();
      item.status = 'observed';
    } catch (error) {
      let knownUnsupported: KnownUnsupportedContrastDomain | undefined;
      if (error instanceof KnownUnsupportedContrastDomain) {
        try {
          phase = 'source-provenance';
          await verifyServedSource();
          knownUnsupported = error;
        } catch (sourceError) {
          // A known paint limit never bypasses end-of-case source verification.
          // Route drift through the same failed-case journal path below.
          error = sourceError;
        }
      }
      if (knownUnsupported) {
        item.status = 'known-unsupported';
        item.knownUnsupported = knownUnsupported.observation;
        // The classifier ran only after all original pairing/anatomy checks.
        // No later state is exercised and no target is added to achievedTargets.
        console.warn(
          `${family}/${runtime}/${theme}: known-unsupported ${knownUnsupported.observation.domain}; no painted/numeric acceptance; follow-up ${knownUnsupported.observation.followup}`
        );
        await persist('known-unsupported', item);
      } else {
        item.status = 'failed';
        item.errors.push({ phase, error: message(error) });
        failures.push({
          family,
          runtime,
          theme,
          phase,
          error: message(error),
          disposition:
            'unresolved case; achieved earlier targets retained, not excluded or passing',
        });
        console.error(`${family}/${runtime}/${theme}: ${phase}: ${message(error)}`);
        await persist('failure', item);
      }
    } finally {
      if (context) {
        try {
          try {
            if (casePage) await releaseCaseSubject(casePage);
          } finally {
            await context.close();
          }
        } catch (error) {
          item.status = 'failed';
          item.errors.push({ phase: 'context-cleanup', error: message(error) });
          failures.push({
            family,
            runtime,
            theme,
            phase: 'context-cleanup',
            error: message(error),
          });
        }
      }
      await persist('case', item);
    }
  }
} catch (error) {
  report.fatalError = { phase, error: message(error) };
  for (const item of cases) {
    if (item.status === 'pending' || item.status === 'running') {
      item.status = 'failed';
      item.errors.push({
        phase,
        error: `Case not completed because run failed: ${message(error)}`,
      });
      failures.push({
        family: item.family,
        runtime: item.runtime,
        theme: item.theme,
        phase,
        error: message(error),
        disposition: 'not completed due to run failure; unresolved, not passing',
      });
    }
  }
  process.exitCode = 1;
  await persist('failure');
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      report.browserCleanupError = message(error);
      process.exitCode = 1;
    }
  }
  report.completedAt = new Date().toISOString();
  const unresolved = cases.filter(isUnresolvedContrastCase);
  const knownUnsupported = cases.filter(isKnownUnsupportedContrastCase);
  report.disposition =
    unresolved.length || report.fatalError || report.browserCleanupError
      ? 'partial observation; unresolved evidence retained'
      : knownUnsupported.length
        ? 'Declared known-unsupported domains retained; other planned observations collected. Unsupported cases have no achieved targets or numeric acceptance.'
        : 'planned target observations collected; conformance and acceptance not evaluated';
  await persist('final');
  console.log(
    `Recorded ${frames.length} raw frame attempts; ${unresolved.length} unresolved runtime/theme cases in ${new Set(unresolved.map((item) => item.family)).size} distinct families. No conformance approval or Issue closure implied. Report: ${join(output, 'report.json')}`
  );
  console.log(
    `Known-unsupported: ${knownUnsupported.length} runtime/theme cases; ${knownUnsupported.map((item) => `${item.family}/${item.runtime}/${item.theme}`).join(', ') || 'none'}. Their missing planned targets remain unexecuted; no numeric acceptance. Tracking: https://github.com/Proto-UI/Proto-UI/issues/853`
  );
  if (unresolved.length) process.exitCode = 1;
}
