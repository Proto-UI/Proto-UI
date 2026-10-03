import type { ChildProcess } from 'node:child_process';

export function waitForServerReadiness(
  url: string,
  options: {
    timeoutMs: number;
    server?: ChildProcess | null;
    readOutput?: () => string;
    report?: (message: string) => void;
  }
): Promise<void>;
