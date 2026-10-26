import type { Page } from 'playwright-core';

export function createQueryDispatchTrace(
  page: Page,
  directory: string
): {
  prepare(): Promise<void>;
  markVerdict(observation: unknown): void;
  beforeContextClose(): void;
  finish(contextClosed: boolean, observation: unknown): Promise<void>;
};
