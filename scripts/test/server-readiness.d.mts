import type { ChildProcess } from 'node:child_process';

export function waitForServerReadiness(
  url: string,
  options: {
    timeoutMs: number;
    rejectRedirects?: boolean;
    server?: ChildProcess | null;
    readOutput?: () => string;
    report?: (message: string) => void;
  }
): Promise<void>;
