export interface ProductionBrowserService {
  url: string;
  receipt: any;
  files: Record<string, { bytes: number; sha256: string }>;
  close(completed: boolean): Promise<void>;
}
export function prepareProductionBrowserService(options: {
  root: string;
  output: string;
  environment: Record<string, string | undefined>;
}): Promise<ProductionBrowserService>;
export function verifyProductionBrowserService(service: unknown): void;
export function verifyProductionBrowserEvidence(
  receipt: unknown,
  environment?: Record<string, string | undefined>
): void;
