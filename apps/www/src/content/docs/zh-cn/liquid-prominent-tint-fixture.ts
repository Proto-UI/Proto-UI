import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
export const PROMINENT_TINT_PARTS = ['button', 'submit'] as const;
export const PROMINENT_TINT_CONTROLS = ['neutral', 'tinted', 'opaque'] as const;
export const PROMINENT_TINT_SOURCES = ['pastel', 'gray-boundary', 'chromatic-regions'] as const;
// Separate source-response sequence. Existing structured optical inputs remain
// byte-for-byte unchanged; the final field repeats A after three new revisions.
export const PROMINENT_TINT_CONSTANT_CODES = [32, 96, 160, 224, 32] as const;
export type TintPart = (typeof PROMINENT_TINT_PARTS)[number];
export type TintControl = (typeof PROMINENT_TINT_CONTROLS)[number];
export type TintSource = (typeof PROMINENT_TINT_SOURCES)[number];
export type TintContent = 'text' | 'icon-only';
export type TintRequest = { kind: string; detail: unknown };
export function prominentTintDemo(
  part: TintPart,
  control: TintControl,
  content: TintContent,
  capture: (api: DemoRuntimeApi) => void,
  requests: TintRequest[]
): DemoSpec {
  const neutral = control === 'neutral',
    label = part === 'button' ? 'Continue' : neutral ? 'Reset' : 'Submit';
  const atom = (
    name: string,
    ref: string,
    props: Record<string, unknown>,
    children: DemoChild[]
  ): DemoNode => ({ kind: 'proto', prototypeId: `liquid-glass-${name}`, ref, props, children });
  const slot: DemoNode = {
    kind: 'box',
    tag: 'span',
    attrs: {
      'data-tint-foreground': '',
      ...(content === 'icon-only' ? { 'role': 'img', 'aria-label': label } : {}),
    },
    children: [content === 'icon-only' ? (part === 'submit' && neutral ? '↺' : '→') : label],
  };
  const props = {
    material: control === 'opaque' ? 'opaque' : 'auto',
    ...(part === 'button' ? { variant: neutral ? 'regular' : 'prominent' } : {}),
  };
  const subject = atom(
    part === 'button' ? 'button' : neutral ? 'form-reset' : 'form-submit',
    'subject',
    props,
    [slot]
  );
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'prominent-tint-layout',
      children: [
        part === 'button'
          ? subject
          : atom('form-root', 'owner', { ariaLabel: `${label} native tint evidence` }, [subject]),
      ],
    },
    setup({ api }) {
      capture(api);
      const kind = part === 'button' ? 'Click' : neutral ? 'Reset' : 'Submit';
      api.setProps(part === 'button' ? 'subject' : 'owner', {
        [`on${kind}`]: (detail: unknown) => requests.push({ kind, detail }),
      });
    },
  };
}
/** Actual scene lease painter. Pastel colors/diagonal cadence are the existing
 * preview recipe; gray/chroma are low-frequency owned application regions.
 * phase is a fixed spatial shift/complement, never time-varying added noise. */
export function paintProminentTintSource(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: TintSource,
  theme: 'light' | 'dark',
  phase: 0 | 1,
  dpr = 1
) {
  const dark = theme === 'dark';
  if (source === 'pastel') {
    ctx.fillStyle = dark ? '#182238' : '#e9eef8';
    ctx.fillRect(0, 0, width, height);
    const colors = dark ? ['#243b58', '#254b4c', '#493654'] : ['#a9c9f4', '#c9dfe8', '#f0bdca'];
    const shift = (phase * width) / 12;
    for (let i = -2; i < 18; i++) {
      ctx.fillStyle = colors[(i + 3) % 3];
      ctx.beginPath();
      ctx.moveTo((i * width) / 12 + shift, 0);
      ctx.lineTo(((i + 1) * width) / 12 + shift, 0);
      ctx.lineTo(((i + 1) * width) / 12 - height / 3 + shift, height);
      ctx.lineTo((i * width) / 12 - height / 3 + shift, height);
      ctx.fill();
    }
    ctx.fillStyle = dark ? '#59728d' : '#7386aa';
    ctx.font = `${Math.max(10, Math.round(12 * dpr))}px system-ui`;
    for (let y = 25 * dpr; y < height; y += 44 * dpr)
      ctx.fillText('PROTO UI  ·  VISIBLE APP BACKDROP  ·  LIVE CANVAS', 15 * dpr + shift / 3, y);
    return;
  }
  // Boundary cadence is visible in context and broad relative to the real
  // small control; no geometry inflation or high-frequency noise is added.
  const colors =
    source === 'gray-boundary'
      ? dark
        ? ['#303030', '#707070']
        : ['#a8a8a8', '#e0e0e0']
      : dark
        ? ['#68454f', '#315b59']
        : ['#d9afc8', '#a5c1b2'];
  const region = 32 * dpr;
  for (let x = 0; x < width; x += region) {
    ctx.fillStyle = colors[(Math.floor(x / region) + phase) % 2];
    ctx.fillRect(x, 0, region, height);
  }
}

export function paintProminentTintConstantSource(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  code: number
) {
  if (!PROMINENT_TINT_CONSTANT_CODES.some((value) => value === code))
    throw new Error('Undeclared constant tint source');
  ctx.fillStyle = `rgb(${code}, ${code}, ${code})`;
  ctx.fillRect(0, 0, width, height);
}

/** Complete finite collection plan, available without loading a browser. */
export function prominentTintPreferenceStages(part: TintPart) {
  return [
    'focus',
    'held',
    'reduced-motion-held',
    'reduced-motion-release',
    'unknown-motion-before-held',
    'synthetic-unknown-motion-held',
    'unknown-motion-release',
    ...['prefers-reduced-transparency', 'prefers-contrast', 'forced-colors'].flatMap((feature) => [
      feature,
      `${feature}-recovered`,
    ]),
    ...[
      'prefers-reduced-motion',
      'prefers-reduced-transparency',
      'prefers-contrast',
      'forced-colors',
    ].flatMap((feature) => [`synthetic-unknown-${feature}`, `unknown-${feature}-recovered`]),
    'unsafe-source',
    'unsafe-recovered',
    'missing-source',
    'source-recovered',
    'cancel-held',
    'injected-cancel',
    ...(part === 'submit' ? ['subject', 'owner'] : ['subject']).flatMap((ref) => [
      `${ref}-disable-held`,
      `${ref}-disabled`,
      `${ref}-reenabled`,
    ]),
    'explicit-opaque',
    'auto-restored',
    'remounted',
  ];
}
export function createProminentTintPlan(shard?: string) {
  const all = ['wc', 'react', 'vue', 'vue2'] as const;
  if (shard && !all.includes(shard as (typeof all)[number]))
    throw new Error('Invalid prominent tint runtime shard');
  const runtimes = shard ? all.filter((runtime) => runtime === shard) : [...all];
  const cases: {
    id: string;
    kind: 'journey' | 'preferences' | 'constant-field';
    captures: string[];
  }[] = [];
  for (const runtime of runtimes)
    for (const theme of ['light', 'dark'])
      for (const part of PROMINENT_TINT_PARTS) {
        for (const content of ['text', 'icon-only']) {
          const id = `${runtime}-${theme}-${part}-${content}`;
          cases.push({
            id,
            kind: 'journey',
            captures: [
              ...PROMINENT_TINT_CONTROLS.flatMap((control) =>
                ['idle', 'hover', 'down', 'release', 'leave'].map(
                  (phase) => `${id}-${control}-${phase}`
                )
              ),
              ...PROMINENT_TINT_SOURCES.flatMap((source) =>
                [0, 1].flatMap((phase) =>
                  PROMINENT_TINT_CONTROLS.map((control) => `${id}-${source}-${phase}-${control}`)
                )
              ),
            ],
          });
        }
        const id = `${runtime}-${theme}-${part}-preferences`;
        cases.push({
          id,
          kind: 'preferences',
          captures: prominentTintPreferenceStages(part).map(
            (stage, index) => `${id}-${index}-${stage}`
          ),
        });
        if (part === 'button') {
          const id = `${runtime}-${theme}-button-constant-field`;
          cases.push({
            id,
            kind: 'constant-field',
            captures: PROMINENT_TINT_CONSTANT_CODES.flatMap((code, step) =>
              ['tinted', 'opaque'].map((control) => `${id}-${step}-${code}-${control}`)
            ),
          });
        }
      }
  return { runtimes, cases };
}
export type TintCheckpointStatus = { status: string; error?: string };
export function assessProminentTintCompletion(
  plan: ReturnType<typeof createProminentTintPlan>,
  cases: Record<string, TintCheckpointStatus>,
  captures: Record<string, TintCheckpointStatus>,
  errors: readonly string[] = []
) {
  const expectedCases = new Set(plan.cases.map((entry) => entry.id));
  const expectedCaptures = new Set(plan.cases.flatMap((entry) => entry.captures));
  const incompleteCases = [...expectedCases].filter(
    (id) => cases[id]?.status !== 'completed' || cases[id]?.error
  );
  const incompleteCaptures = [...expectedCaptures].filter(
    (id) => captures[id]?.status !== 'passed-observation-checks' || captures[id]?.error
  );
  const unexpectedCases = Object.keys(cases).filter((id) => !expectedCases.has(id));
  const unexpectedCaptures = Object.keys(captures).filter((id) => !expectedCaptures.has(id));
  return {
    status:
      !incompleteCases.length &&
      !incompleteCaptures.length &&
      !unexpectedCases.length &&
      !unexpectedCaptures.length &&
      !errors.length
        ? 'completed'
        : 'incomplete',
    incompleteCases,
    incompleteCaptures,
    unexpectedCases,
    unexpectedCaptures,
    errors,
  };
}
/** Executed but unresolved work is interrupted, never labeled unexecuted. */
export function finalizeProminentTintStatus(record: TintCheckpointStatus) {
  if (record.status === 'not-run') return { ...record, status: 'blocked-at-normal-finalization' };
  if (['running', 'captured-before-assertion'].includes(record.status))
    return { ...record, status: 'interrupted-at-normal-finalization' };
  return record;
}
/** Cancellation cannot execute afterAll. Running snapshots therefore retain
 * not-run entries; only normal finalization labels them terminal blocked. */
export function createProminentTintCheckpoint(
  plan: ReturnType<typeof createProminentTintPlan>,
  state: {
    cases: Record<string, TintCheckpointStatus>;
    captures: Record<string, TintCheckpointStatus>;
  },
  phase: 'planned' | 'running' | 'terminal'
) {
  const terminal = (record: TintCheckpointStatus | undefined) => {
    const result = record ?? { status: 'not-run' };
    return phase === 'terminal' ? finalizeProminentTintStatus(result) : result;
  };
  return {
    schemaVersion: 1,
    phase,
    partial: phase !== 'terminal',
    runtimes: plan.runtimes,
    cases: plan.cases.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      ...terminal(state.cases[entry.id]),
      captures: entry.captures.map((id) => ({ id, ...terminal(state.captures[id]) })),
    })),
    expectedCases: plan.cases.length,
    expectedCaptures: plan.cases.reduce((sum, entry) => sum + entry.captures.length, 0),
  };
}
