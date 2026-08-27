export function corepackCliCandidates(execPath: string, platform?: NodeJS.Platform): string[];

export function resolveCorepackCli(
  execPath: string,
  options?: {
    platform?: NodeJS.Platform;
    fileExists?: (candidate: string) => boolean;
  }
): string;
