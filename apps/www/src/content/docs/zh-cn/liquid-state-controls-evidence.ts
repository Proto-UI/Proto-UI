// Frozen #799 consumer inventory. A filtered or interrupted run must never turn
// the completed subset into a complete four-host acceptance receipt.
const runtimes = ['wc', 'react', 'vue', 'vue2'] as const;
export const LIQUID_STATE_CONTROL_CASES = Object.freeze([
  ...(['light', 'dark'] as const).flatMap((theme) => [
    `renders source-owned paint for all eight parts in ${theme}`,
    ...runtimes.map(
      (runtime) =>
        `${runtime}/${theme}: real activation, context, controlled requests and disabled recovery`
    ),
  ]),
  ...runtimes.map(
    (runtime) =>
      `${runtime}: native singleton editors, controlled values, readonly and disabled recovery`
  ),
  ...runtimes.flatMap((runtime) =>
    (['input', 'textarea'] as const).flatMap((kind) =>
      ['uncontrolled', 'controlled'].map(
        (owner) => `${runtime}/${kind}/${owner}: native CDP composition preserves editor and owner`
      )
    )
  ),
  'updates semantic/decorative separators, remains readable on mobile, and disposes every real host',
]);

export type LiquidControlCaseResult = {
  name: string;
  status: string;
  errors: unknown;
};

export function assessLiquidStateControls(
  executed: readonly LiquidControlCaseResult[],
  failures: readonly string[] = []
) {
  const expected = new Set(LIQUID_STATE_CONTROL_CASES);
  const byName = new Map<string, LiquidControlCaseResult[]>();
  for (const result of executed) {
    const entries = byName.get(result.name) ?? [];
    entries.push(result);
    byName.set(result.name, entries);
  }
  const missing = LIQUID_STATE_CONTROL_CASES.filter((name) => !byName.has(name));
  const duplicates = [...byName]
    .filter(([, entries]) => entries.length !== 1)
    .map(([name]) => name);
  const unexpected = [...byName.keys()].filter((name) => !expected.has(name));
  const failed = executed.some(
    (result) =>
      result.status !== 'pass' ||
      (Array.isArray(result.errors) ? result.errors.length > 0 : result.errors != null)
  );
  const status =
    failed || duplicates.length || unexpected.length || failures.length
      ? 'failed'
      : missing.length
        ? 'blocked'
        : 'passed';
  return {
    status,
    missing,
    duplicates,
    unexpected,
    failures: [...failures],
    results: [
      ...executed,
      ...missing.map((name) => ({
        name,
        status: 'blocked',
        errors: [
          { message: 'The required consumer case did not reach an executed terminal result.' },
        ],
      })),
    ],
  };
}
