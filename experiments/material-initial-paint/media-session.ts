import assert from 'node:assert/strict';
export type MediaSession = {
  send(
    method: 'Emulation.setEmulatedMedia',
    params: { features: { name: string; value: string }[] }
  ): Promise<unknown>;
  detach(): Promise<void>;
};
export type MediaPage = {
  evaluate<Result, Arg>(callback: (arg: Arg) => Result, arg: Arg): Promise<Result>;
};

type Issue = { operation: string; error: string };
export type MediaFeatures = Record<string, string>;
const values: Record<string, string[]> = {
  'prefers-color-scheme': ['light', 'dark'],
  'prefers-reduced-motion': ['no-preference', 'reduce'],
  'prefers-reduced-transparency': ['no-preference', 'reduce'],
  'prefers-contrast': ['no-preference', 'more', 'less', 'custom'],
  'forced-colors': ['none', 'active'],
};
async function bounded<T>(work: () => Promise<T>, milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** CDP media overrides belong to a session. Keep that session alive through
 * navigation, CSS checks and screenshots, and release it only at case cleanup. */
export async function holdMediaEmulation<PageType>(
  context: { newCDPSession(page: PageType): Promise<MediaSession> },
  page: PageType,
  requested: MediaFeatures,
  report: (issue: Issue) => void
) {
  let session: MediaSession | undefined;
  let retired = false;
  let released = false;
  const detach = async (target: MediaSession) => {
    try {
      await bounded(() => target.detach(), 1000, 'Media session detach exceeded 1000ms');
    } catch (error) {
      try {
        report({ operation: 'media-session.detach', error: String(error) });
      } catch {
        /* A reporter cannot replace the original failure. */
      }
    }
  };
  const close = async () => {
    if (released) return;
    released = true;
    retired = true;
    if (session) await detach(session);
  };
  try {
    await bounded(
      async () => {
        const obtained = await context.newCDPSession(page);
        if (retired) {
          await detach(obtained);
          return;
        }
        session = obtained;
        await session.send('Emulation.setEmulatedMedia', {
          features: Object.entries(requested).map(([name, value]) => ({ name, value })),
        });
        if (retired) throw new Error('Media emulation completed after its deadline');
      },
      5000,
      'Media emulation acquisition/send exceeded 5000ms'
    );
    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function readMediaObservation(page: MediaPage, requested: MediaFeatures) {
  return bounded(
    () =>
      page.evaluate(
        ({ requested, values }) => ({
          requested,
          actual: Object.fromEntries(
            Object.entries(values).map(([name, options]) => [
              name,
              Object.fromEntries(
                options.map((value) => [value, matchMedia(`(${name}: ${value})`).matches])
              ),
            ])
          ),
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          url: location.href,
        }),
        { requested: { ...requested }, values }
      ),
    5000,
    'Media observation exceeded 5000ms'
  );
}

export function assertMediaObservation(
  observation: Awaited<ReturnType<typeof readMediaObservation>>
) {
  for (const [name, expected] of Object.entries(observation.requested)) {
    assert.equal(
      observation.actual[name]?.[expected],
      true,
      `Media emulation did not apply: ${name}: ${expected}`
    );
    for (const [value, matched] of Object.entries(observation.actual[name] ?? {}))
      if (value !== expected)
        assert.equal(matched, false, `Conflicting media value: ${name}: ${value}`);
  }
}
