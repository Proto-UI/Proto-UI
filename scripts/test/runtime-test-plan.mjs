import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BROWSER_SUITE_ROOT = path.join(REPOSITORY_ROOT, 'apps', 'www', 'src', 'content', 'docs');

function discoverBrowserSuites(directory) {
  const suites = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) suites.push(...discoverBrowserSuites(absolutePath));
    else if (entry.isFile() && /\.browser\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      suites.push(path.relative(REPOSITORY_ROOT, absolutePath).replaceAll('\\', '/'));
    }
  }
  return suites.sort();
}

export const BROWSER_SUITES = Object.freeze(discoverBrowserSuites(BROWSER_SUITE_ROOT));
export function corepackInvocation(platform = process.platform) {
  return {
    executable: platform === 'win32' ? 'corepack.cmd' : 'corepack',
    shell: platform === 'win32',
  };
}

function fullRuntimeTestPlan(forwardedArgs = []) {
  return [
    {
      needsServer: false,
      // Bound process fan-out so a large core count cannot starve the 5s
      // fixture timeouts or the CLI subprocess tests on developer machines.
      // Vitest derives a CPU-count-based minimum unless both bounds are
      // provided; on high-core machines that minimum can exceed maxWorkers.
      args: [
        '--minWorkers=1',
        '--maxWorkers=2',
        ...forwardedArgs,
        ...BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
      ],
    },
    {
      needsServer: true,
      // One dev server compiles for every suite, so running the files in
      // parallel makes them queue behind each other and blow their own
      // readiness timeouts. Measured on five suites: 75s sequential against
      // 102s parallel, with the parallel run intermittently timing out.
      args: ['--no-file-parallelism', ...forwardedArgs, ...BROWSER_SUITES],
    },
  ];
}

function normalizeTestFilter(argument) {
  const absoluteFilter = path.resolve(REPOSITORY_ROOT, argument);
  const relativeFilter = path.relative(REPOSITORY_ROOT, absoluteFilter);
  if (!relativeFilter.startsWith('..') && !path.isAbsolute(relativeFilter)) {
    return relativeFilter.replaceAll('\\', '/');
  }
  return argument.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function createRuntimeTestPlan(rawArgs) {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  if (args.length > 0) {
    const positionalFilters = args
      .filter((argument) => !argument.startsWith('-'))
      .map(normalizeTestFilter);
    // Vitest accepts file filters after options. `--name=value` is
    // self-contained, but an option without `=` may consume the following
    // token. Keep that ambiguous form behind the shared server instead of
    // mistaking an option value for an exact browser-suite filter.
    const hasAmbiguousOptionValue = args.some(
      (argument) => argument.startsWith('-') && !argument.includes('=')
    );
    if (positionalFilters.length === 0 || hasAmbiguousOptionValue) {
      return [{ needsServer: true, args: ['--no-file-parallelism', ...args] }];
    }

    const selectsExactlyOneBrowserSuite =
      positionalFilters.length === 1 && BROWSER_SUITES.includes(positionalFilters[0]);
    if (selectsExactlyOneBrowserSuite) {
      // Every browser suite can start and warm its own documentation server.
      // Keep that focused path standalone so it does not wait for the shared
      // runner's full cross-suite READY_ROUTES inventory.
      return [{ needsServer: false, args }];
    }

    const canSelectBrowserSuite = positionalFilters.some((argument) =>
      BROWSER_SUITES.some((suite) => suite.includes(argument) || argument.includes(suite))
    );
    if (canSelectBrowserSuite) {
      return [{ needsServer: true, args: ['--no-file-parallelism', ...args] }];
    }
    return [{ needsServer: false, args }];
  }
  return fullRuntimeTestPlan();
}
