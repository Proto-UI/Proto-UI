type OwnedResource = { close(): Promise<void> };

/** Vitest's timeout races the body; it does not cancel its pending promises. */
export function createNativeCaseOwner() {
  let retired = false;
  let completed = false;
  let closing: Promise<void> | null = null;
  const resources = new Set<OwnedResource>();
  return {
    assertActive() {
      if (retired) throw new Error('Native browser case owner has retired');
    },
    async acquire<T extends OwnedResource>(pending: Promise<T>): Promise<T> {
      const resource = await pending;
      if (retired) {
        await resource.close();
        throw new Error('Native browser setup completed after its owner retired');
      }
      resources.add(resource);
      return resource;
    },
    complete() {
      if (retired) return false;
      completed = true;
      return true;
    },
    retire() {
      retired = true;
    },
    close() {
      retired = true;
      if (!closing) {
        const owned = [...resources];
        resources.clear();
        closing = Promise.allSettled(owned.map(async (resource) => resource.close())).then(
          (results) => {
            const errors = results.flatMap((result) =>
              result.status === 'rejected' ? [result.reason] : []
            );
            if (errors.length) throw new AggregateError(errors, 'Native case cleanup failed');
          }
        );
      }
      return closing;
    },
    observation(runnerState: string | undefined, cleanupErrors: readonly string[]) {
      return {
        outcome:
          runnerState === 'pass' && completed && cleanupErrors.length === 0 ? 'OBSERVED' : 'FAIL',
        bodyCompletedBeforeRetirement: completed,
        runnerStateAtCapture: runnerState ?? null,
        finalAcceptance: false,
        authoritativeReport: 'browser-vitest.json',
      };
    },
  };
}

/** Own the phase deadline as well as Vitest's enclosing hook deadline. */
export async function withinNativePhase<T>(
  phase: string,
  milliseconds: number,
  run: () => Promise<T>,
  expire?: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expire?.();
      reject(new Error(`Native browser ${phase} exceeded ${milliseconds}ms`));
    }, milliseconds);
  });
  try {
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
